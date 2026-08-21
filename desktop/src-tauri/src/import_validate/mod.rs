//! Parallel import parse + JSON Schema validation + attachment reference checks.
//!
//! Mirrors Desktop TS `importValidation.ts` / `attachmentReferenceExtraction.ts` closely enough
//! for import preflight (AJV with `strict: false` and `validateFormats: false`).

mod attachments;

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;

use jsonschema::{Draft, Validator};
use rayon::prelude::*;
use serde::Serialize;
use serde_json::Value;

use crate::{ApiObservation, ParsedImportFileResult, parse_import_json_file};

pub use attachments::referenced_attachment_names_for_observation;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIssue {
    pub severity: &'static str,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub form_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportValidateBatchResult {
    pub files: Vec<ParsedImportFileResult>,
    pub issues: Vec<ImportIssue>,
    pub observation_count: usize,
    pub form_type_count: usize,
    pub referenced_attachment_names: Vec<String>,
    pub missing_attachment_names: Vec<String>,
    pub orphan_attachment_names: Vec<String>,
}

enum SchemaCompileState {
    Ok(Arc<Validator>),
    CompileError(String),
    Missing,
}

/// Build reusable validators once per form type (AJV-like: formats not enforced).
fn compile_validators(
    form_types: &HashSet<String>,
    schemas_by_form_type: &HashMap<String, Value>,
) -> HashMap<String, SchemaCompileState> {
    let mut out = HashMap::new();
    for ft in form_types {
        match schemas_by_form_type.get(ft) {
            None => {
                out.insert(ft.clone(), SchemaCompileState::Missing);
            }
            Some(schema) => match build_validator(schema) {
                Ok(v) => {
                    out.insert(ft.clone(), SchemaCompileState::Ok(Arc::new(v)));
                }
                Err(e) => {
                    out.insert(ft.clone(), SchemaCompileState::CompileError(e));
                }
            },
        }
    }
    out
}

fn build_validator(schema: &Value) -> Result<Validator, String> {
    jsonschema::options()
        .with_draft(Draft::Draft7)
        .should_validate_formats(false)
        .build(schema)
        .map_err(|e| e.to_string())
}

fn normalize_basename(s: &str) -> String {
    s.trim().to_lowercase()
}

fn schema_error_message(instance_path: &str, error: &str) -> String {
    let path = if instance_path.is_empty() {
        "(root)"
    } else {
        instance_path
    };
    format!("{path}: {error}")
}

struct FileValidateOutcome {
    file: ParsedImportFileResult,
    issues: Vec<ImportIssue>,
    referenced: HashSet<String>,
    form_types: HashSet<String>,
    observation_count: usize,
}

fn push_observation_issues(
    file_name: &str,
    obs: &ApiObservation,
    validators: &HashMap<String, SchemaCompileState>,
    schemas_by_form_type: &HashMap<String, Value>,
    issues: &mut Vec<ImportIssue>,
    referenced: &mut HashSet<String>,
    form_types: &mut HashSet<String>,
) {
    let ft = obs
        .form_type
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let schema = ft
        .as_ref()
        .and_then(|t| schemas_by_form_type.get(t.as_str()));

    match &ft {
        None => {
            issues.push(ImportIssue {
                severity: "warning",
                code: "missing_form_type".to_string(),
                message: format!(
                    "Observation {} has no formType; schema validation was skipped (attachment checks use heuristics only).",
                    obs.observation_id
                ),
                file_name: Some(file_name.to_string()),
                observation_id: Some(obs.observation_id.clone()),
                form_type: None,
            });
        }
        Some(form_type) => {
            form_types.insert(form_type.clone());
            match validators.get(form_type) {
                Some(SchemaCompileState::Missing) | None => {}
                Some(SchemaCompileState::CompileError(_)) => {}
                Some(SchemaCompileState::Ok(validator)) => {
                    for error in validator.iter_errors(&obs.data) {
                        let path = error.instance_path.to_string();
                        issues.push(ImportIssue {
                            severity: "error",
                            code: "schema_validation".to_string(),
                            message: format!(
                                "{}: {}",
                                obs.observation_id,
                                schema_error_message(&path, &error.to_string())
                            ),
                            file_name: Some(file_name.to_string()),
                            observation_id: Some(obs.observation_id.clone()),
                            form_type: Some(form_type.clone()),
                        });
                    }
                }
            }
        }
    }

    for name in referenced_attachment_names_for_observation(schema, &obs.data) {
        referenced.insert(name);
    }
}

/// Parse + validate import JSON paths in parallel against preloaded form schemas.
pub fn parse_and_validate_paths(
    paths: Vec<String>,
    schemas_by_form_type: &HashMap<String, Value>,
    staged_attachment_basenames: &[String],
) -> ImportValidateBatchResult {
    if paths.is_empty() {
        return ImportValidateBatchResult {
            files: Vec::new(),
            issues: Vec::new(),
            observation_count: 0,
            form_type_count: 0,
            referenced_attachment_names: Vec::new(),
            missing_attachment_names: Vec::new(),
            orphan_attachment_names: Vec::new(),
        };
    }

    // Pass 1: parallel parse (ordered).
    let mut parsed_index: Vec<(usize, ParsedImportFileResult)> = paths
        .par_iter()
        .enumerate()
        .map(|(i, raw)| {
            let p = Path::new(raw.trim());
            (i, parse_import_json_file(p))
        })
        .collect();
    parsed_index.sort_by_key(|(i, _)| *i);

    let mut form_types = HashSet::new();
    for (_, file) in &parsed_index {
        if file.error.is_some() {
            continue;
        }
        for obs in &file.observations {
            if let Some(ft) = obs
                .form_type
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                form_types.insert(ft.to_string());
            }
        }
    }

    let validators = compile_validators(&form_types, schemas_by_form_type);

    // Pass 2: parallel schema + attachment checks on already-parsed files.
    let mut outcomes: Vec<(usize, FileValidateOutcome)> = parsed_index
        .into_par_iter()
        .map(|(i, file)| {
            let mut issues = Vec::new();
            let mut referenced = HashSet::new();
            let mut file_form_types = HashSet::new();
            let mut observation_count = 0usize;

            if let Some(err) = &file.error {
                issues.push(ImportIssue {
                    severity: "error",
                    code: "parse_file".to_string(),
                    message: format!("{}: {err}", file.file_name),
                    file_name: Some(file.file_name.clone()),
                    observation_id: None,
                    form_type: None,
                });
                return (
                    i,
                    FileValidateOutcome {
                        file,
                        issues,
                        referenced,
                        form_types: file_form_types,
                        observation_count,
                    },
                );
            }

            for obs in &file.observations {
                observation_count += 1;
                push_observation_issues(
                    &file.file_name,
                    obs,
                    &validators,
                    schemas_by_form_type,
                    &mut issues,
                    &mut referenced,
                    &mut file_form_types,
                );
            }

            (
                i,
                FileValidateOutcome {
                    file,
                    issues,
                    referenced,
                    form_types: file_form_types,
                    observation_count,
                },
            )
        })
        .collect();
    outcomes.sort_by_key(|(i, _)| *i);

    let mut files = Vec::with_capacity(outcomes.len());
    let mut issues = Vec::new();
    let mut all_referenced = HashSet::new();
    let mut all_form_types = HashSet::new();
    let mut observation_count = 0usize;

    for (_, outcome) in outcomes {
        observation_count += outcome.observation_count;
        all_form_types.extend(outcome.form_types);
        all_referenced.extend(outcome.referenced);
        issues.extend(outcome.issues);
        files.push(outcome.file);
    }

    let mut missing_schema_types: Vec<String> = all_form_types
        .iter()
        .filter(|ft| {
            matches!(
                validators.get(*ft),
                Some(SchemaCompileState::Missing) | None
            )
        })
        .cloned()
        .collect();
    missing_schema_types.sort();
    for ft in missing_schema_types {
        issues.push(ImportIssue {
            severity: "error",
            code: "missing_form_schema".to_string(),
            message: format!("No form schema in the active app bundle for form type \"{ft}\"."),
            file_name: None,
            observation_id: None,
            form_type: Some(ft),
        });
    }

    let mut compile_error_types: Vec<(String, String)> = Vec::new();
    for ft in &all_form_types {
        if let Some(SchemaCompileState::CompileError(msg)) = validators.get(ft) {
            compile_error_types.push((ft.clone(), msg.clone()));
        }
    }
    compile_error_types.sort_by(|a, b| a.0.cmp(&b.0));
    for (ft, msg) in compile_error_types {
        issues.push(ImportIssue {
            severity: "error",
            code: "invalid_form_schema".to_string(),
            message: format!("Could not compile JSON Schema for form type \"{ft}\": {msg}"),
            file_name: None,
            observation_id: None,
            form_type: Some(ft),
        });
    }

    let staged_norm: HashMap<String, String> = {
        let mut m = HashMap::new();
        for b in staged_attachment_basenames {
            let k = normalize_basename(b);
            if !k.is_empty() {
                m.entry(k).or_insert_with(|| b.clone());
            }
        }
        m
    };

    let mut referenced_list: Vec<String> = all_referenced.into_iter().collect();
    referenced_list.sort();

    let mut missing = Vec::new();
    for ref_name in &referenced_list {
        let kn = normalize_basename(ref_name);
        if !kn.is_empty() && !staged_norm.contains_key(&kn) {
            missing.push(ref_name.clone());
        }
    }
    missing.sort();

    let referenced_norm: HashSet<String> = referenced_list
        .iter()
        .map(|r| normalize_basename(r))
        .filter(|s| !s.is_empty())
        .collect();

    let mut orphan: Vec<String> = staged_norm
        .iter()
        .filter(|(norm, _)| !referenced_norm.contains(*norm))
        .map(|(_, display)| display.clone())
        .collect();
    orphan.sort();

    for m in &missing {
        issues.push(ImportIssue {
            severity: "error",
            code: "missing_attachment".to_string(),
            message: format!("Referenced attachment \"{m}\" is not in the staged attachment list."),
            file_name: None,
            observation_id: None,
            form_type: None,
        });
    }
    for o in &orphan {
        issues.push(ImportIssue {
            severity: "warning",
            code: "orphan_attachment".to_string(),
            message: format!(
                "Staged attachment \"{o}\" is not referenced by any staged observation payload."
            ),
            file_name: None,
            observation_id: None,
            form_type: None,
        });
    }

    ImportValidateBatchResult {
        files,
        issues,
        observation_count,
        form_type_count: all_form_types.len(),
        referenced_attachment_names: referenced_list,
        missing_attachment_names: missing,
        orphan_attachment_names: orphan,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    fn write_obs(dir: &std::path::Path, name: &str, body: &str) -> String {
        let path = dir.join(name);
        fs::write(&path, body).unwrap();
        path.to_string_lossy().to_string()
    }

    #[test]
    fn schema_validation_flags_type_mismatch() {
        let mut schemas = HashMap::new();
        schemas.insert(
            "PhotoForm".to_string(),
            json!({
                "type": "object",
                "properties": {
                    "pic": { "type": "object", "format": "photo" }
                }
            }),
        );

        let base =
            std::env::temp_dir().join(format!("ode_import_validate_schema_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let path = write_obs(
            &base,
            "a.json",
            r#"{
              "observationId": "o1",
              "formType": "PhotoForm",
              "updatedAt": "2026-01-01T00:00:00Z",
              "data": { "pic": "not-an-object" }
            }"#,
        );

        let result = parse_and_validate_paths(vec![path], &schemas, &[]);
        assert!(
            result.issues.iter().any(|i| i.code == "schema_validation"),
            "issues: {:?}",
            result.issues
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn photo_format_does_not_fail_when_formats_disabled() {
        let mut schemas = HashMap::new();
        schemas.insert(
            "PhotoForm".to_string(),
            json!({
                "type": "object",
                "properties": {
                    "pic": { "type": "object", "format": "photo" }
                }
            }),
        );

        let base =
            std::env::temp_dir().join(format!("ode_import_validate_format_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let path = write_obs(
            &base,
            "a.json",
            r#"{
              "observationId": "o1",
              "formType": "PhotoForm",
              "updatedAt": "2026-01-01T00:00:00Z",
              "data": { "pic": { "filename": "used.jpg" } }
            }"#,
        );

        let result = parse_and_validate_paths(vec![path], &schemas, &["used.jpg".to_string()]);
        assert!(
            !result.issues.iter().any(|i| i.code == "schema_validation"),
            "issues: {:?}",
            result.issues
        );
        assert!(
            result
                .referenced_attachment_names
                .contains(&"used.jpg".to_string())
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn missing_and_orphan_attachments() {
        let mut schemas = HashMap::new();
        schemas.insert(
            "PhotoForm".to_string(),
            json!({
                "type": "object",
                "properties": {
                    "pic": { "type": "object", "format": "photo" }
                }
            }),
        );

        let base =
            std::env::temp_dir().join(format!("ode_import_validate_att_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let path = write_obs(
            &base,
            "a.json",
            r#"{
              "observationId": "o1",
              "formType": "PhotoForm",
              "updatedAt": "2026-01-01T00:00:00Z",
              "data": { "pic": { "filename": "missing.jpg" } }
            }"#,
        );

        let result = parse_and_validate_paths(vec![path], &schemas, &["orphan.jpg".to_string()]);
        assert!(
            result
                .missing_attachment_names
                .contains(&"missing.jpg".to_string())
        );
        assert!(
            result
                .orphan_attachment_names
                .contains(&"orphan.jpg".to_string())
        );
        let _ = fs::remove_dir_all(&base);
    }
}
