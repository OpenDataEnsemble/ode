use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;

use super::ErrorCode;
use super::config::LocalConfig;
use super::export::{ExportOptions, export_parquet};
use super::forms::{FieldInfo, get_form_details, list_forms, schema_fields};
use super::policy::{self, Capability};
use super::profiles::list_profiles;

fn temp_base(name: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!("ode_local_api_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).unwrap();
    base
}

fn write_form(forms_root: &Path, form_type: &str) {
    let dir = forms_root.join(form_type);
    fs::create_dir_all(&dir).unwrap();
    fs::write(
        dir.join("schema.json"),
        json!({ "type": "object", "properties": { "name": { "type": "string" } } }).to_string(),
    )
    .unwrap();
    fs::write(
        dir.join("ui.json"),
        json!({ "type": "VerticalLayout" }).to_string(),
    )
    .unwrap();
}

/// Profiles: `secret` (sensitive fields set), `hidden` (local tools off), `dev` (developer
/// mode, no server, only dev-local forms), `data` (data access allowed).
fn fixture(name: &str) -> (PathBuf, LocalConfig) {
    let base = temp_base(name);
    let ws = |id: &str| {
        let p = base.join(id);
        fs::create_dir_all(&p).unwrap();
        p.to_string_lossy().to_string()
    };
    let (ws_secret, ws_hidden, ws_dev, ws_data) =
        (ws("secret"), ws("hidden"), ws("dev"), ws("data"));
    write_form(&base.join("secret/bundles/active/forms"), "household");
    write_form(&base.join("dev/bundles/dev-local/forms"), "draft_form");
    let profile = |id: &str, ws: &str| {
        json!({
            "id": id, "label": format!("Label {id}"),
            "serverUrl": "https://secret-server.example", "username": "secret-user",
            "workspacePath": ws, "databasePath": format!("{ws}/sqlite/custodian.sqlite3"),
            "attachmentsPath": null
        })
    };
    let mut hidden = profile("hidden", &ws_hidden);
    hidden["localToolsEnabled"] = json!(false);
    let mut dev = profile("dev", &ws_dev);
    dev["serverUrl"] = json!("");
    dev["customAppDeveloperMode"] = json!(true);
    let mut data = profile("data", &ws_data);
    data["localToolsAllowData"] = json!(true);
    let cfg = json!({
        "schemaVersion": 3,
        "activeProfileId": "secret",
        "profiles": [profile("secret", &ws_secret), hidden, dev, data]
    });
    let path = base.join("config.json");
    fs::write(&path, cfg.to_string()).unwrap();
    (base, LocalConfig::load(&path).unwrap())
}

#[test]
fn profile_list_is_redacted_and_omits_disabled_profiles() {
    let (base, cfg) = fixture("redacted");
    let profiles = list_profiles(&cfg);
    let ids: Vec<_> = profiles.iter().map(|p| p.id.as_str()).collect();
    assert_eq!(ids, ["secret", "dev", "data"]);
    assert!(profiles[0].active);

    let out = serde_json::to_string(&profiles).unwrap();
    for leaked in [
        "secret-server",
        "secret-user",
        "sqlite",
        base.to_string_lossy().as_ref(),
    ] {
        assert!(
            !out.contains(leaked),
            "profile output leaked {leaked:?}: {out}"
        );
    }
}

#[test]
fn defaults_grant_form_metadata_but_not_data() {
    let (_base, cfg) = fixture("defaults");
    let secret = cfg.profile("secret").unwrap();
    assert_eq!(policy::granted(secret), [Capability::FormMetadata]);
    let err = policy::require(secret, Capability::Data).unwrap_err();
    assert_eq!(err.code, ErrorCode::PermissionDenied);
    assert_eq!(err.capability, Some(Capability::Data));

    let data = cfg.profile("data").unwrap();
    assert_eq!(
        policy::granted(data),
        [Capability::FormMetadata, Capability::Data]
    );
}

#[test]
fn disabled_profile_is_rejected_like_unknown() {
    let (_base, cfg) = fixture("disabled");
    for id in ["hidden", "nope"] {
        let err = list_forms(&cfg, id).unwrap_err();
        assert_eq!(err.code, ErrorCode::ProfileNotFound);
    }
}

/// Seeds the `data` profile: bundle forms `household` + `person`, observations for
/// `household` (2 synced, 1 pending) and `person` (1 synced).
fn seed_data_profile(base: &Path) {
    let ws = base.join("data");
    write_form(&ws.join("bundles/active/forms"), "household");
    write_form(&ws.join("bundles/active/forms"), "person");
    fs::create_dir_all(ws.join("sqlite")).unwrap();
    let conn = rusqlite::Connection::open(crate::sqlite_path_for_workspace(&ws)).unwrap();
    crate::init_db(&conn).unwrap();
    for (id, form, dirty) in [
        ("h1", "household", 0),
        ("h2", "household", 0),
        ("h3", "household", 1),
        ("p1", "person", 0),
    ] {
        conn.execute(
            "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at)
             VALUES (?1, ?2, ?3, '2026-01-01T00:00:00Z', ?4, ?5, '2026-01-01T00:00:00Z')",
            rusqlite::params![
                id,
                json!({ "name": id }).to_string(),
                form,
                dirty,
                if dirty == 1 { "dirty" } else { "clean" }
            ],
        )
        .unwrap();
    }
}

fn export_opts(base: &Path, forms: &[&str]) -> ExportOptions {
    let dest = base.join("out");
    fs::create_dir_all(&dest).unwrap();
    ExportOptions {
        form_types: forms.iter().map(|f| f.to_string()).collect(),
        destination: dest,
        include_pending: false,
        include_attachments: false,
        overwrite: true,
    }
}

#[test]
fn export_requires_data_permission() {
    let (base, cfg) = fixture("export_denied");
    let err = export_parquet(
        &cfg,
        "secret",
        &export_opts(&base, &["household"]),
        &mut |_, _, _| {},
    )
    .unwrap_err();
    assert_eq!(err.code, ErrorCode::PermissionDenied);
    assert_eq!(err.capability, Some(Capability::Data));
    assert!(!base.join("out").read_dir().unwrap().any(|_| true));
}

#[test]
fn export_validates_forms() {
    let (base, cfg) = fixture("export_forms");
    seed_data_profile(&base);
    let noop = &mut |_: usize, _: usize, _: &str| {};
    let err = export_parquet(&cfg, "data", &export_opts(&base, &[]), noop).unwrap_err();
    assert_eq!(err.code, ErrorCode::InvalidArgument);
    let err = export_parquet(&cfg, "data", &export_opts(&base, &["nope"]), noop).unwrap_err();
    assert_eq!(err.code, ErrorCode::FormNotFound);
}

#[test]
fn export_writes_only_requested_forms_with_manifest() {
    let (base, cfg) = fixture("export_ok");
    seed_data_profile(&base);
    let summary = export_parquet(
        &cfg,
        "Label data",
        &export_opts(&base, &["household"]),
        &mut |_, _, _| {},
    )
    .unwrap();
    assert_eq!(summary.profile_id, "data");
    assert_eq!(summary.total_rows, 2, "pending row excluded by default");
    assert_eq!(
        summary.parquet_files.keys().collect::<Vec<_>>(),
        ["household"]
    );
    assert!(summary.forms_without_rows.is_empty());

    let manifest: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&summary.manifest).unwrap()).unwrap();
    assert_eq!(manifest["profileId"], json!("data"));
    assert_eq!(manifest["forms"].as_array().unwrap().len(), 1);
    assert_eq!(manifest["forms"][0]["fields"][0]["path"], json!("name"));
    assert_eq!(
        manifest["forms"][0]["fields"][0]["column"],
        json!("data_name")
    );
    let raw = manifest.to_string();
    assert!(!raw.contains("secret-server") && !raw.contains("sqlite"));

    // A bundle form without observations is reported, not an error.
    let mut opts = export_opts(&base, &["person", "household"]);
    opts.include_pending = true;
    seed_extra_bundle_form(&base, "empty_form");
    opts.form_types.push("empty_form".into());
    let summary = export_parquet(&cfg, "data", &opts, &mut |_, _, _| {}).unwrap();
    assert_eq!(summary.total_rows, 4);
    assert_eq!(summary.forms_without_rows, ["empty_form"]);
}

fn seed_extra_bundle_form(base: &Path, form: &str) {
    write_form(&base.join("data/bundles/active/forms"), form);
}

#[test]
fn profile_resolves_by_label_but_not_for_disabled_profiles() {
    let (_base, cfg) = fixture("label");
    assert_eq!(cfg.profile("label DEV").unwrap().id, "dev");
    assert_eq!(
        cfg.profile("Label hidden").unwrap_err().code,
        ErrorCode::ProfileNotFound
    );
}

#[test]
fn lists_active_and_dev_local_forms() {
    let (_base, cfg) = fixture("forms");
    let active = list_forms(&cfg, "secret").unwrap();
    assert_eq!(active.bundle, "active");
    assert_eq!(active.forms[0].form_type, "household");

    let dev = list_forms(&cfg, "dev").unwrap();
    assert_eq!(dev.bundle, "dev-local");
    assert_eq!(dev.forms.len(), 1);
    assert_eq!(dev.forms[0].form_type, "draft_form");

    let details = get_form_details(&cfg, "dev", "draft_form").unwrap();
    assert_eq!(details.fields[0].path, "name");

    let err = get_form_details(&cfg, "dev", "household").unwrap_err();
    assert_eq!(err.code, ErrorCode::FormNotFound);
    let err = get_form_details(&cfg, "dev", "../secret").unwrap_err();
    assert_eq!(err.code, ErrorCode::InvalidArgument);
}

#[test]
fn schema_fields_flattens_objects_and_keeps_attachments_as_leaves() {
    let schema = json!({
        "type": "object",
        "properties": {
            "head": {
                "type": "object",
                "properties": { "age": { "type": ["integer", "null"], "title": "Age" } }
            },
            "pic": { "type": "object", "format": "photo", "properties": { "filename": {} } },
            "tags": { "type": "array", "items": { "type": "string" } }
        }
    });
    let fields = schema_fields(&schema, &json!({}));
    let get = |p: &str| fields.iter().find(|f| f.path == p).cloned();
    assert_eq!(
        get("head.age"),
        Some(FieldInfo {
            path: "head.age".into(),
            json_type: Some("integer|null".into()),
            title: Some("Age".into()),
            format: None,
            attachment: false,
            choices: None,
            linked_form: None,
        })
    );
    assert!(get("pic").unwrap().attachment);
    assert!(get("pic.filename").is_none());
    assert_eq!(get("tags").unwrap().json_type.as_deref(), Some("array"));
}

#[test]
fn schema_fields_include_choices_links_and_follow_ui_order() {
    let schema = json!({
        "$defs": { "yes_no": { "oneOf": [
            { "const": "1", "title": "Yes" }, { "const": "2", "title": "No" }
        ] } },
        "properties": {
            "a_unused": { "type": "string" },
            "consent": { "$ref": "#/$defs/yes_no", "type": "string" },
            "method": { "type": "string", "enum": ["scan", "manual"] },
            "multi": { "type": "array", "items": { "$ref": "#/$defs/yes_no" } },
            "rooms": { "type": "array", "format": "sub-observation", "linkedForm": "room" },
            "count": { "oneOf": [{ "type": "integer" }, { "const": 88 }] }
        }
    });
    let ui = json!({ "type": "VerticalLayout", "elements": [
        { "type": "Group", "elements": [
            { "type": "Control", "scope": "#/properties/rooms" },
            { "type": "Control", "scope": "#/properties/consent",
              "rule": { "condition": { "scope": "#/properties/method" } } }
        ] },
        { "type": "Control", "scope": "#/properties/method" },
        { "type": "Control", "scope": "#/properties/multi" },
        { "type": "Control", "scope": "#/properties/count" }
    ] });
    let fields = schema_fields(&schema, &ui);
    let order: Vec<_> = fields.iter().map(|f| f.path.as_str()).collect();
    assert_eq!(
        order,
        ["rooms", "consent", "method", "multi", "count", "a_unused"]
    );

    let get = |p: &str| fields.iter().find(|f| f.path == p).unwrap();
    let consent = get("consent").choices.clone().unwrap();
    assert_eq!(consent[0].value, json!("1"));
    assert_eq!(consent[0].label.as_deref(), Some("Yes"));
    assert_eq!(get("method").choices.as_ref().unwrap().len(), 2);
    assert_eq!(get("multi").choices.as_ref().unwrap().len(), 2);
    assert_eq!(get("rooms").linked_form.as_deref(), Some("room"));
    assert_eq!(get("count").choices.as_ref().unwrap()[0].value, json!(88));
    assert!(get("a_unused").choices.is_none());
}
