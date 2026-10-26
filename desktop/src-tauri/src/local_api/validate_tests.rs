use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use super::validate::{Severity, ValidationReport, validate_path};

fn temp_forms(name: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!("ode_validate_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).unwrap();
    base
}

fn write(root: &Path, form: &str, schema: &Value, ui: &Value) -> PathBuf {
    let dir = root.join(form);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("schema.json"), schema.to_string()).unwrap();
    fs::write(dir.join("ui.json"), ui.to_string()).unwrap();
    dir
}

fn codes(report: &ValidationReport) -> Vec<(&'static str, Severity)> {
    report.forms[0]
        .diagnostics
        .iter()
        .map(|d| (d.code, d.severity))
        .collect()
}

fn good_schema() -> Value {
    json!({
        "type": "object",
        "version": "1",
        "$defs": { "yes_no": { "oneOf": [{ "const": "1", "title": "Yes" }, { "const": "2", "title": "No" }] } },
        "properties": {
            "consent": { "$ref": "#/$defs/yes_no", "type": "string" },
            "reason": { "type": "string" },
            "rooms": { "type": "array", "format": "sub-observation", "linkedForm": "room" },
            "conditional": { "if": { "properties": { "consent": { "const": "1" } } },
                             "then": { "properties": { "detail": { "type": "string" } } } }
        },
        "required": ["consent"]
    })
}

fn good_ui() -> Value {
    json!({ "type": "SwipeLayout", "elements": [
        { "type": "VerticalLayout", "elements": [
            { "type": "Control", "scope": "#/properties/consent" },
            { "type": "Control", "scope": "#/properties/reason",
              "rule": { "effect": "SHOW", "condition": { "scope": "#/properties/consent", "schema": { "const": "2" } } } },
            { "type": "Control", "scope": "#/properties/rooms" },
            { "type": "Control", "scope": "#/properties/conditional/then/properties/detail" }
        ] }
    ] })
}

#[test]
fn valid_form_has_no_diagnostics_and_sees_sibling_linked_forms() {
    let root = temp_forms("valid");
    let dir = write(&root, "household", &good_schema(), &good_ui());
    write(
        &root,
        "room",
        &json!({ "type": "object", "version": "1" }),
        &json!({ "type": "SwipeLayout" }),
    );

    let report = validate_path(&dir).unwrap();
    assert!(report.valid, "{:#?}", report.forms[0].diagnostics);
    assert!(
        codes(&report).is_empty(),
        "{:#?}",
        report.forms[0].diagnostics
    );

    let all = validate_path(&root).unwrap();
    assert_eq!(all.forms.len(), 2);
    assert!(all.valid);
}

#[test]
fn reports_errors_and_warnings_with_pointers() {
    let root = temp_forms("broken");
    let mut schema = good_schema();
    schema.as_object_mut().unwrap().remove("version");
    schema["required"] = json!(["consent", "ghost"]);
    let ui = json!({ "type": "VerticalLayout", "elements": [
        { "type": "Control", "scope": "#/properties/typo" },
        { "type": "Control" },
        { "scope": "#/properties/reason" },
        { "type": "Control", "scope": "#/properties/reason",
          "rule": { "effect": "SHOWN", "condition": { "scope": "#/properties/nope", "schema": { "const": "2" } } } },
        { "type": "Control", "scope": "#/properties/reason",
          "rule": { "effect": "HIDE", "condition": { "type": "OR", "conditions": [
              { "scope": "#/properties/consent", "schema": { "const": 2 } },
              { "scope": "#/properties/consent" }
          ] } } },
        { "type": "Control", "scope": "#/properties/reason", "rule": { "effect": "SHOW" } }
    ] });
    let dir = write(&root, "household", &schema, &ui);

    let report = validate_path(&dir).unwrap();
    assert!(!report.valid);
    let got = codes(&report);
    use Severity::{Error, Warning};
    for expected in [
        ("missing_version", Warning),
        ("unknown_required", Error),
        ("missing_linked_form", Error),
        ("root_not_swipe_layout", Warning),
        ("invalid_scope", Error),
        ("missing_scope", Error),
        ("missing_type", Error),
        ("invalid_rule_effect", Error),
        ("invalid_rule_scope", Error),
        ("rule_value_not_a_choice", Warning),
        ("missing_rule_schema", Error),
        ("missing_rule_condition", Error),
    ] {
        assert!(got.contains(&expected), "missing {expected:?} in {got:?}");
    }
    let diag = |code: &str| {
        report.forms[0]
            .diagnostics
            .iter()
            .find(|d| d.code == code)
            .unwrap()
    };
    assert_eq!(diag("invalid_scope").path, "/elements/0/scope");
    assert_eq!(diag("unknown_required").path, "/required/1");
    assert_eq!(
        diag("rule_value_not_a_choice").path,
        "/elements/4/rule/condition/conditions/0/schema/const"
    );
}

#[test]
fn reports_unreadable_files_and_version_conflicts() {
    let root = temp_forms("files");
    let dir = root.join("bad");
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("schema.json"), "{ not json").unwrap();
    let report = validate_path(&dir).unwrap();
    let got = codes(&report);
    assert!(got.contains(&("invalid_json", Severity::Error)));
    assert!(got.contains(&("missing_file", Severity::Error)));

    let mut schema = good_schema();
    schema["schemaVersion"] = json!(3);
    write(
        &root,
        "room",
        &json!({ "type": "object", "version": "1" }),
        &json!({ "type": "SwipeLayout" }),
    );
    let dir = write(&root, "household", &schema, &good_ui());
    let got = codes(&validate_path(&dir).unwrap());
    assert!(got.contains(&("version_mismatch", Severity::Warning)));
    assert!(got.contains(&("version_not_string", Severity::Warning)));

    assert!(validate_path(&root.join("missing")).is_err());
}
