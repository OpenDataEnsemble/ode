//! Form discovery and definitions from a profile's bundle (`active` or `dev-local`).

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::config::{LocalConfig, workspace_for};
use super::policy::{self, Capability};
use super::{ApiError, ApiResult, ErrorCode};
use crate::import_validate::ATTACHMENT_SCHEMA_FORMATS;
use crate::{
    ActiveBundleFormEntry, BundleFormSpec, bundle_form_roots, bundle_segment,
    reserved_form_dir_name, sanitize_form_type_id,
};

/// Form types (dirs with `schema.json` + `ui.json`) across `roots`; first root wins on duplicates.
pub(crate) fn list_forms_in_roots(roots: &[PathBuf]) -> Result<Vec<ActiveBundleFormEntry>, String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for root in roots {
        let rd = match fs::read_dir(root) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
                continue;
            }
            if reserved_form_dir_name(&name) {
                continue;
            }
            let schema = entry.path().join("schema.json");
            let ui = entry.path().join("ui.json");
            if schema.is_file() && ui.is_file() && seen.insert(name.clone()) {
                out.push(ActiveBundleFormEntry { form_type: name });
            }
        }
    }
    out.sort_by(|a, b| a.form_type.cmp(&b.form_type));
    Ok(out)
}

/// `Ok(None)` when the form does not exist in any root.
fn find_form_spec_in_roots(
    roots: &[PathBuf],
    form_type: &str,
) -> Result<Option<BundleFormSpec>, String> {
    let ft = sanitize_form_type_id(form_type)?;
    for root in roots {
        let dir = root.join(&ft);
        let schema_path = dir.join("schema.json");
        let ui_path = dir.join("ui.json");
        if schema_path.is_file() && ui_path.is_file() {
            let read_json = |p: &PathBuf| -> Result<Value, String> {
                let raw = fs::read_to_string(p).map_err(|e| e.to_string())?;
                serde_json::from_str(&raw).map_err(|e| format!("{}: {e}", p.display()))
            };
            return Ok(Some(BundleFormSpec {
                form_type: ft,
                form_schema: read_json(&schema_path)?,
                ui_schema: read_json(&ui_path)?,
            }));
        }
    }
    Ok(None)
}

pub(crate) fn read_form_spec_in_roots(
    roots: &[PathBuf],
    segment: &str,
    form_type: &str,
) -> Result<BundleFormSpec, String> {
    find_form_spec_in_roots(roots, form_type)?.ok_or_else(|| {
        format!(
            "Form \"{}\" not found under bundles/{segment} (expected schema.json + ui.json).",
            form_type.trim()
        )
    })
}

/// Effective form version, resolved like Formulus (#909): non-empty string `schemaVersion`,
/// then `version`, else `"1.0"`.
pub(crate) fn form_version(schema: &Value) -> String {
    ["schemaVersion", "version"]
        .iter()
        .filter_map(|k| schema.get(*k).and_then(Value::as_str))
        .map(str::trim)
        .find(|v| !v.is_empty())
        .unwrap_or("1.0")
        .to_string()
}

/// Form definitions in `roots` keyed by form type (unreadable forms are skipped).
pub(crate) fn specs_in_roots(roots: &[PathBuf]) -> BTreeMap<String, BundleFormSpec> {
    let mut out = BTreeMap::new();
    for entry in list_forms_in_roots(roots).unwrap_or_default() {
        if let Ok(Some(spec)) = find_form_spec_in_roots(roots, &entry.form_type) {
            out.insert(entry.form_type, spec);
        }
    }
    out
}

/// Flattened fields for every form in the bundle (unreadable forms are skipped).
pub(crate) fn bundle_form_fields(workspace: &Path, dev: bool) -> BTreeMap<String, Vec<FieldInfo>> {
    let roots = bundle_form_roots(workspace, dev);
    let mut out = BTreeMap::new();
    for entry in list_forms_in_roots(&roots).unwrap_or_default() {
        if let Ok(Some(spec)) = find_form_spec_in_roots(&roots, &entry.form_type) {
            out.insert(
                entry.form_type,
                schema_fields(&spec.form_schema, &spec.ui_schema),
            );
        }
    }
    out
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormSummary {
    pub form_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormList {
    pub profile_id: String,
    /// `active` (Synkronus bundle) or `dev-local` (developer mode mirror).
    pub bundle: &'static str,
    pub forms: Vec<FormSummary>,
}

/// Leaf field from `schema.json`, derived from metadata only.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldInfo {
    /// Dot-separated property path, e.g. `household.head_name`.
    pub path: String,
    #[serde(rename = "type")]
    pub json_type: Option<String>,
    pub title: Option<String>,
    pub format: Option<String>,
    pub attachment: bool,
    /// Allowed coded values (`enum`, or `const` entries of `oneOf`/`anyOf`); for arrays, of `items`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub choices: Option<Vec<Choice>>,
    /// Form type of sub-observations (`format: sub-observation`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_form: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Choice {
    pub value: Value,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormDetails {
    pub profile_id: String,
    pub bundle: &'static str,
    pub form_type: String,
    /// Effective form version (see [`form_version`]).
    pub version: String,
    pub schema: Value,
    pub ui_schema: Value,
    pub fields: Vec<FieldInfo>,
}

struct ProfileForms {
    profile_id: String,
    bundle: &'static str,
    roots: Vec<PathBuf>,
}

fn profile_forms(cfg: &LocalConfig, profile_id: &str) -> ApiResult<ProfileForms> {
    let profile = cfg.profile(profile_id)?;
    policy::require(profile, Capability::FormMetadata)?;
    let workspace = workspace_for(profile)?;
    let dev = profile.custom_app_developer_mode;
    Ok(ProfileForms {
        profile_id: profile.id.clone(),
        bundle: bundle_segment(dev),
        roots: bundle_form_roots(&workspace, dev),
    })
}

fn io_error(profile_id: &str, message: String) -> ApiError {
    ApiError::new(ErrorCode::Io, message).with_profile(profile_id)
}

pub fn list_forms(cfg: &LocalConfig, profile_id: &str) -> ApiResult<FormList> {
    let pf = profile_forms(cfg, profile_id)?;
    let forms = list_forms_in_roots(&pf.roots)
        .map_err(|e| io_error(&pf.profile_id, e))?
        .into_iter()
        .map(|f| FormSummary {
            form_type: f.form_type,
        })
        .collect();
    Ok(FormList {
        profile_id: pf.profile_id,
        bundle: pf.bundle,
        forms,
    })
}

pub fn get_form_details(
    cfg: &LocalConfig,
    profile_id: &str,
    form_type: &str,
) -> ApiResult<FormDetails> {
    let pf = profile_forms(cfg, profile_id)?;
    let spec = find_form_spec_in_roots(&pf.roots, form_type)
        .map_err(|e| ApiError::new(ErrorCode::InvalidArgument, e).with_profile(&pf.profile_id))?
        .ok_or_else(|| {
            ApiError::new(
                ErrorCode::FormNotFound,
                format!(
                    "Form \"{}\" not found in bundles/{}.",
                    form_type.trim(),
                    pf.bundle
                ),
            )
            .with_profile(&pf.profile_id)
        })?;
    let fields = schema_fields(&spec.form_schema, &spec.ui_schema);
    Ok(FormDetails {
        profile_id: pf.profile_id,
        bundle: pf.bundle,
        version: form_version(&spec.form_schema),
        form_type: spec.form_type,
        schema: spec.form_schema,
        ui_schema: spec.ui_schema,
        fields,
    })
}

/// Flatten `properties` into leaf fields, ordered as they appear in `ui.json` (fields not
/// referenced by the UI come last). Objects with nested `properties` are descended (unless
/// they are attachment fields); arrays are reported as leaves.
pub(crate) fn schema_fields(schema: &Value, ui_schema: &Value) -> Vec<FieldInfo> {
    let mut out = Vec::new();
    collect_fields(schema, schema, "", &mut out);

    let ui_order = ui_scope_paths(ui_schema);
    let rank = |path: &str| {
        ui_order
            .iter()
            .position(|s| path == s || path.starts_with(&format!("{s}.")))
            .unwrap_or(usize::MAX)
    };
    // Stable sort keeps alphabetical order among fields absent from the UI.
    out.sort_by_key(|f| rank(&f.path));
    out
}

fn collect_fields(root: &Value, schema: &Value, prefix: &str, out: &mut Vec<FieldInfo>) {
    let Some(props) = schema.get("properties").and_then(Value::as_object) else {
        return;
    };
    for (key, prop) in props {
        let path = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        let format = prop.get("format").and_then(Value::as_str);
        let attachment = format.is_some_and(|f| ATTACHMENT_SCHEMA_FORMATS.contains(&f));
        if !attachment && prop.get("properties").is_some_and(Value::is_object) {
            collect_fields(root, prop, &path, out);
            continue;
        }
        let choices = match prop.get("items") {
            Some(items) if prop.get("type").and_then(Value::as_str) == Some("array") => {
                choices_of(root, items, 0)
            }
            _ => choices_of(root, prop, 0),
        };
        let linked_form = (format == Some("sub-observation"))
            .then(|| prop.get("linkedForm").and_then(Value::as_str))
            .flatten()
            .map(str::to_string);
        let json_type = match prop.get("type") {
            Some(Value::String(s)) => Some(s.clone()),
            Some(Value::Array(a)) => Some(
                a.iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join("|"),
            ),
            _ => None,
        };
        out.push(FieldInfo {
            path,
            json_type,
            title: prop
                .get("title")
                .and_then(Value::as_str)
                .map(str::to_string),
            format: format.map(str::to_string),
            attachment,
            choices,
            linked_form,
        });
    }
}

/// Coded values of `node`, following local `$ref`s (`#/...`).
pub(crate) fn choices_of(root: &Value, node: &Value, depth: usize) -> Option<Vec<Choice>> {
    if depth > 8 {
        return None;
    }
    if let Some(values) = node.get("enum").and_then(Value::as_array) {
        return Some(
            values
                .iter()
                .map(|v| Choice {
                    value: v.clone(),
                    label: None,
                })
                .collect(),
        );
    }
    for key in ["oneOf", "anyOf"] {
        if let Some(options) = node.get(key).and_then(Value::as_array) {
            let consts: Vec<Choice> = options
                .iter()
                .filter_map(|o| {
                    Some(Choice {
                        value: o.get("const")?.clone(),
                        label: o.get("title").and_then(Value::as_str).map(str::to_string),
                    })
                })
                .collect();
            if !consts.is_empty() {
                return Some(consts);
            }
        }
    }
    let target = node
        .get("$ref")
        .and_then(Value::as_str)
        .and_then(|r| r.strip_prefix('#'))
        .and_then(|pointer| root.pointer(pointer))?;
    choices_of(root, target, depth + 1)
}

/// Field paths (`a.b`) referenced by `scope: "#/properties/a/properties/b"` in document order.
fn ui_scope_paths(ui: &Value) -> Vec<String> {
    fn walk(v: &Value, out: &mut Vec<String>) {
        match v {
            Value::Object(map) => {
                if let Some(scope) = map.get("scope").and_then(Value::as_str) {
                    let path = scope
                        .trim_start_matches("#/")
                        .split('/')
                        .filter(|seg| *seg != "properties")
                        .collect::<Vec<_>>()
                        .join(".");
                    if !path.is_empty() && !out.contains(&path) {
                        out.push(path);
                    }
                }
                // `elements` first so layout order wins over e.g. rule condition scopes.
                if let Some(elements) = map.get("elements") {
                    walk(elements, out);
                }
                for (k, child) in map {
                    if k != "elements" && k != "rule" {
                        walk(child, out);
                    }
                }
            }
            Value::Array(items) => items.iter().for_each(|i| walk(i, out)),
            _ => {}
        }
    }
    let mut out = Vec::new();
    walk(ui, &mut out);
    out
}
