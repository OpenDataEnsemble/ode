//! Static validation of form definitions (`ode forms validate`).
//!
//! Works on files on disk (the agent's source folder), so no profile or permission is needed.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use serde::Serialize;
use serde_json::Value;

use super::forms::{choices_of, schema_fields};
use super::{ApiError, ApiResult, ErrorCode};
use crate::import_validate::build_validator;
use crate::reserved_form_dir_name;

const RULE_EFFECTS: [&str; 4] = ["SHOW", "HIDE", "ENABLE", "DISABLE"];
const MAX_DEPTH: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub severity: Severity,
    pub code: &'static str,
    /// `schema.json` or `ui.json`.
    pub file: &'static str,
    /// JSON pointer into `file` (`""` for the document root).
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormReport {
    pub form_type: String,
    pub dir: String,
    pub valid: bool,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    /// False when any form has an error (warnings do not fail validation).
    pub valid: bool,
    pub forms: Vec<FormReport>,
}

const SCHEMA: &str = "schema.json";
const UI: &str = "ui.json";

fn is_form_dir(dir: &Path) -> bool {
    dir.join(SCHEMA).is_file() || dir.join(UI).is_file()
}

/// Form folders directly under `root` (by name).
fn form_dirs_in(root: &Path) -> Vec<(String, std::path::PathBuf)> {
    let mut out: Vec<_> = fs::read_dir(root)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path();
            (path.is_dir() && !reserved_form_dir_name(&name) && is_form_dir(&path))
                .then_some((name, path))
        })
        .collect();
    out.sort();
    out
}

/// Validate one form folder, or every form in a forms root.
pub fn validate_path(path: &Path) -> ApiResult<ValidationReport> {
    let (targets, siblings) = if is_form_dir(path) {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let siblings = path.parent().map(form_dirs_in).unwrap_or_default();
        (vec![(name, path.to_path_buf())], siblings)
    } else if path.is_dir() {
        let forms = form_dirs_in(path);
        (forms.clone(), forms)
    } else {
        return Err(ApiError::new(
            ErrorCode::InvalidArgument,
            format!("Not a folder: {}", path.display()),
        ));
    };
    if targets.is_empty() {
        return Err(ApiError::new(
            ErrorCode::InvalidArgument,
            format!(
                "No forms found in {} (expected <form>/schema.json and <form>/ui.json).",
                path.display()
            ),
        ));
    }
    let known: BTreeSet<String> = siblings.into_iter().map(|(n, _)| n).collect();
    let forms: Vec<FormReport> = targets
        .into_iter()
        .map(|(name, dir)| validate_form_dir(&name, &dir, &known))
        .collect();
    Ok(ValidationReport {
        valid: forms.iter().all(|f| f.valid),
        forms,
    })
}

struct Ctx<'a> {
    schema: &'a Value,
    out: Vec<Diagnostic>,
}

impl Ctx<'_> {
    fn push(
        &mut self,
        severity: Severity,
        code: &'static str,
        file: &'static str,
        path: impl Into<String>,
        message: impl Into<String>,
    ) {
        self.out.push(Diagnostic {
            severity,
            code,
            file,
            path: path.into(),
            message: message.into(),
        });
    }
}

fn read_json(dir: &Path, file: &'static str, out: &mut Vec<Diagnostic>) -> Option<Value> {
    let diag = |code, message: String| Diagnostic {
        severity: Severity::Error,
        code,
        file,
        path: String::new(),
        message,
    };
    let raw = match fs::read_to_string(dir.join(file)) {
        Ok(raw) => raw,
        Err(_) => {
            out.push(diag("missing_file", format!("{file} is missing.")));
            return None;
        }
    };
    match serde_json::from_str(&raw) {
        Ok(v) => Some(v),
        Err(e) => {
            out.push(diag(
                "invalid_json",
                format!("{file} is not valid JSON: {e}"),
            ));
            None
        }
    }
}

pub(crate) fn validate_form_dir(name: &str, dir: &Path, known: &BTreeSet<String>) -> FormReport {
    let mut out = Vec::new();
    let schema = read_json(dir, SCHEMA, &mut out);
    let ui = read_json(dir, UI, &mut out);
    if let (Some(schema), Some(ui)) = (&schema, &ui) {
        let mut ctx = Ctx {
            schema,
            out: std::mem::take(&mut out),
        };
        check_schema(&mut ctx, ui, known);
        check_ui(&mut ctx, ui);
        out = ctx.out;
    }
    FormReport {
        form_type: name.to_string(),
        dir: dir.display().to_string(),
        valid: !out.iter().any(|d| d.severity == Severity::Error),
        diagnostics: out,
    }
}

fn check_schema(ctx: &mut Ctx<'_>, ui: &Value, known: &BTreeSet<String>) {
    let schema = ctx.schema;
    if let Err(e) = build_validator(schema) {
        ctx.push(
            Severity::Error,
            "invalid_schema",
            SCHEMA,
            "",
            format!("schema.json is not a valid JSON Schema: {e}"),
        );
    }

    let version = |key: &str| schema.get(key);
    match (version("schemaVersion"), version("version")) {
        (None, None) => ctx.push(
            Severity::Warning,
            "missing_version",
            SCHEMA,
            "",
            "Add a top-level \"version\" (e.g. \"1\") and bump it on every change to the form.",
        ),
        (Some(a), Some(b)) if a != b => ctx.push(
            Severity::Warning,
            "version_mismatch",
            SCHEMA,
            "/schemaVersion",
            format!(
                "\"schemaVersion\" ({a}) takes precedence over \"version\" ({b}); keep only one."
            ),
        ),
        _ => {}
    }
    for key in ["schemaVersion", "version"] {
        if version(key).is_some_and(|v| !v.is_string()) {
            ctx.push(
                Severity::Warning,
                "version_not_string",
                SCHEMA,
                format!("/{key}"),
                format!("\"{key}\" should be a string, e.g. \"2\"."),
            );
        }
    }

    if let Some(required) = schema.get("required").and_then(Value::as_array) {
        for (i, name) in required.iter().enumerate() {
            let Some(name) = name.as_str() else { continue };
            if resolve(schema, schema, &["properties", name], 0).is_none() {
                ctx.push(
                    Severity::Error,
                    "unknown_required",
                    SCHEMA,
                    format!("/required/{i}"),
                    format!("\"{name}\" is required but is not a property of the form."),
                );
            }
        }
    }

    for field in schema_fields(schema, ui) {
        let Some(linked) = &field.linked_form else {
            continue;
        };
        if !known.contains(linked) {
            ctx.push(
                Severity::Error,
                "missing_linked_form",
                SCHEMA,
                format!("/properties/{}", field.path.replace('.', "/properties/")),
                format!("Sub-observation field \"{}\" links to form \"{linked}\", which is not in the bundle.", field.path),
            );
        }
    }
}

fn check_ui(ctx: &mut Ctx<'_>, ui: &Value) {
    let root_type = ui.get("type").and_then(Value::as_str);
    if root_type != Some("SwipeLayout") {
        ctx.push(
            Severity::Warning,
            "root_not_swipe_layout",
            UI,
            "/type",
            format!(
                "ODE forms should use \"SwipeLayout\" as the root element (found {}).",
                root_type.map_or("none".to_string(), |t| format!("\"{t}\""))
            ),
        );
    }
    check_element(ctx, ui, "", 0);
}

fn check_element(ctx: &mut Ctx<'_>, el: &Value, ptr: &str, depth: usize) {
    if depth > MAX_DEPTH || !el.is_object() {
        return;
    }
    let el_type = el.get("type").and_then(Value::as_str);
    if el_type.is_none() {
        ctx.push(
            Severity::Error,
            "missing_type",
            UI,
            ptr,
            "UI element has no \"type\".",
        );
    }
    if el_type == Some("Control") {
        match el.get("scope").and_then(Value::as_str) {
            None => ctx.push(
                Severity::Error,
                "missing_scope",
                UI,
                ptr,
                "Control has no \"scope\".",
            ),
            Some(scope) => {
                if resolve_scope(ctx.schema, scope).is_none() {
                    ctx.push(
                        Severity::Error,
                        "invalid_scope",
                        UI,
                        format!("{ptr}/scope"),
                        format!("Scope \"{scope}\" does not match a property in schema.json."),
                    );
                }
            }
        }
    }
    if let Some(rule) = el.get("rule") {
        check_rule(ctx, rule, &format!("{ptr}/rule"));
    }
    if let Some(elements) = el.get("elements").and_then(Value::as_array) {
        for (i, child) in elements.iter().enumerate() {
            check_element(ctx, child, &format!("{ptr}/elements/{i}"), depth + 1);
        }
    }
}

fn check_rule(ctx: &mut Ctx<'_>, rule: &Value, ptr: &str) {
    let effect = rule.get("effect").and_then(Value::as_str);
    if !effect.is_some_and(|e| RULE_EFFECTS.contains(&e)) {
        ctx.push(
            Severity::Error,
            "invalid_rule_effect",
            UI,
            format!("{ptr}/effect"),
            format!(
                "Rule effect must be one of {} (found {}).",
                RULE_EFFECTS.join(", "),
                effect.map_or("none".to_string(), |e| format!("\"{e}\""))
            ),
        );
    }
    match rule.get("condition") {
        Some(cond) => check_condition(ctx, cond, &format!("{ptr}/condition"), 0),
        None => ctx.push(
            Severity::Error,
            "missing_rule_condition",
            UI,
            ptr,
            "Rule has no \"condition\".",
        ),
    }
}

fn check_condition(ctx: &mut Ctx<'_>, cond: &Value, ptr: &str, depth: usize) {
    if depth > MAX_DEPTH {
        return;
    }
    // Composite (OR / AND) condition.
    if let Some(conditions) = cond.get("conditions").and_then(Value::as_array) {
        for (i, c) in conditions.iter().enumerate() {
            check_condition(ctx, c, &format!("{ptr}/conditions/{i}"), depth + 1);
        }
        return;
    }
    let Some(scope) = cond.get("scope").and_then(Value::as_str) else {
        ctx.push(
            Severity::Error,
            "invalid_rule_scope",
            UI,
            ptr,
            "Rule condition has no \"scope\".",
        );
        return;
    };
    let Some(target) = resolve_scope(ctx.schema, scope) else {
        ctx.push(
            Severity::Error,
            "invalid_rule_scope",
            UI,
            format!("{ptr}/scope"),
            format!("Rule condition scope \"{scope}\" does not match a property in schema.json."),
        );
        return;
    };
    let Some(cond_schema) = cond.get("schema") else {
        // JSON Forms LEAF condition (`expectedValue`) needs no schema.
        if cond.get("expectedValue").is_none() {
            ctx.push(
                Severity::Error,
                "missing_rule_schema",
                UI,
                ptr,
                "Rule condition needs a \"schema\" (e.g. {\"const\": \"1\"}).",
            );
        }
        return;
    };
    check_condition_values(ctx, target, cond_schema, scope, &format!("{ptr}/schema"));
}

/// Warn when a condition compares against a value that is not one of the field's coded choices.
fn check_condition_values(
    ctx: &mut Ctx<'_>,
    target: &Value,
    cond_schema: &Value,
    scope: &str,
    ptr: &str,
) {
    // For multi-selects the condition usually applies to items (`contains`).
    let target = match target.get("items") {
        Some(items) => items,
        None => target,
    };
    let Some(choices) = choices_of(ctx.schema, target, 0) else {
        return;
    };
    let cond_schema = cond_schema.get("contains").unwrap_or(cond_schema);
    let mut values: Vec<(&Value, String)> = Vec::new();
    if let Some(v) = cond_schema.get("const") {
        values.push((v, format!("{ptr}/const")));
    }
    if let Some(list) = cond_schema.get("enum").and_then(Value::as_array) {
        values.extend(
            list.iter()
                .enumerate()
                .map(|(i, v)| (v, format!("{ptr}/enum/{i}"))),
        );
    }
    for (value, path) in values {
        if !choices.iter().any(|c| &c.value == value) {
            let allowed: Vec<String> = choices.iter().map(|c| c.value.to_string()).collect();
            ctx.push(
                Severity::Warning,
                "rule_value_not_a_choice",
                UI,
                path,
                format!(
                    "Condition value {value} is not a choice of \"{scope}\" (choices: {}). Check the type, e.g. 1 vs \"1\".",
                    allowed.join(", ")
                ),
            );
        }
    }
}

/// Resolve a JSON Forms scope (`#/properties/a/properties/b`, or `#` for the root).
fn resolve_scope<'a>(schema: &'a Value, scope: &str) -> Option<&'a Value> {
    let rest = scope.strip_prefix('#')?;
    let segments: Vec<String> = rest
        .split('/')
        .filter(|s| !s.is_empty())
        .map(|s| s.replace("~1", "/").replace("~0", "~"))
        .collect();
    let refs: Vec<&str> = segments.iter().map(String::as_str).collect();
    resolve(schema, schema, &refs, 0)
}

/// Follow `segments` from `node`, dereferencing local `$ref`s and searching combinator branches
/// (`allOf`/`anyOf`/`oneOf`/`if`/`then`/`else`) when a key is not found directly.
fn resolve<'a>(
    root: &'a Value,
    node: &'a Value,
    segments: &[&str],
    depth: usize,
) -> Option<&'a Value> {
    if depth > MAX_DEPTH {
        return None;
    }
    let node = match node
        .get("$ref")
        .and_then(Value::as_str)
        .and_then(|r| r.strip_prefix('#'))
    {
        Some(pointer) => root.pointer(pointer)?,
        None => node,
    };
    let Some((first, rest)) = segments.split_first() else {
        return Some(node);
    };
    if let Some(found) = node
        .get(*first)
        .and_then(|child| resolve(root, child, rest, depth + 1))
    {
        return Some(found);
    }
    for key in ["allOf", "anyOf", "oneOf"] {
        for branch in node
            .get(key)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(found) = resolve(root, branch, segments, depth + 1) {
                return Some(found);
            }
        }
    }
    ["if", "then", "else"]
        .iter()
        .filter_map(|k| node.get(*k))
        .find_map(|branch| resolve(root, branch, segments, depth + 1))
}
