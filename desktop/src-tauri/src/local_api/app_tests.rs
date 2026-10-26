use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use super::config::{LocalConfig, merge_external_changes};
use super::policy::Capability;
use super::{ErrorCode, app, profiles, skills};
use crate::AppConfigFile;

fn temp_base(name: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!("ode_app_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).unwrap();
    base
}

fn write_json(path: &Path, v: &Value) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, v.to_string()).unwrap();
}

fn write_form(forms: &Path, name: &str, version: &str, extra_field: bool) {
    let mut props = json!({ "name": { "type": "string" } });
    if extra_field {
        props["age"] = json!({ "type": "integer" });
    }
    write_json(
        &forms.join(name).join("schema.json"),
        &json!({ "type": "object", "version": version, "properties": props }),
    );
    write_json(
        &forms.join(name).join("ui.json"),
        &json!({ "type": "SwipeLayout", "elements": [
            { "type": "VerticalLayout", "elements": [{ "type": "Control", "scope": "#/properties/name" }] }
        ] }),
    );
}

/// Source folder of a custom app: index.html + forms/.
fn write_app(dir: &Path) {
    fs::create_dir_all(dir).unwrap();
    fs::write(dir.join("index.html"), "<html>app</html>").unwrap();
    write_form(&dir.join("forms"), "household", "1", false);
}

/// Config with one existing (server) profile `srv`; returns (base, config path).
fn setup(name: &str) -> (PathBuf, PathBuf) {
    let base = temp_base(name);
    let ws = base.join("profiles/srv");
    fs::create_dir_all(&ws).unwrap();
    let cfg = json!({
        "schemaVersion": 3,
        "activeProfileId": "srv",
        "profiles": [{
            "id": "srv", "label": "Server", "serverUrl": "https://example.invalid",
            "username": "u", "workspacePath": ws.to_string_lossy(),
            "databasePath": ws.join("sqlite/custodian.sqlite3").to_string_lossy(),
            "attachmentsPath": null, "defaultAppMode": "data_management"
        }]
    });
    let path = base.join("config.json");
    write_json(&path, &cfg);
    (base, path)
}

fn raw_config(path: &Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

/// Config as Desktop would write it (all defaulted fields present).
fn normalized_config(path: &Path) -> Value {
    let cfg: AppConfigFile = serde_json::from_value(raw_config(path)).unwrap();
    serde_json::to_value(cfg).unwrap()
}

#[test]
fn push_requires_authoring_too() {
    let (_base, path) = setup("policy");
    let mut v = raw_config(&path);
    v["profiles"][0]["localToolsAllowPush"] = json!(true);
    write_json(&path, &v);
    let cfg = LocalConfig::load(&path).unwrap();
    let p = cfg.profile("srv").unwrap();
    assert!(!super::policy::allows(p, Capability::Push));
    assert!(!super::policy::allows(p, Capability::Authoring));
}

#[test]
fn create_profile_writes_only_a_new_profile() {
    let (base, path) = setup("create");
    let before = normalized_config(&path);
    let src = base.join("src/dist");
    write_app(&src);

    let mut cfg = LocalConfig::load(&path).unwrap();
    let created = profiles::create_profile(&mut cfg, "Malaria 2027", Some(&src)).unwrap();
    assert_eq!(
        created.profile.capabilities,
        [Capability::FormMetadata, Capability::Authoring]
    );
    assert!(created.developer_mode);

    let after = raw_config(&path);
    assert_eq!(after["profiles"][0], before["profiles"][0]);
    assert_eq!(after["activeProfileId"], json!("srv"));
    let new = &after["profiles"][1];
    assert_eq!(new["label"], json!("Malaria 2027"));
    assert_eq!(new["localToolsAllowPush"], json!(false));
    assert_eq!(new["serverUrl"], json!(""));
    let ws = PathBuf::from(new["workspacePath"].as_str().unwrap());
    assert!(ws.starts_with(&base) && ws.join("attachments/pending").is_dir());
    assert!(ws.join("bundles/dev-local/app/index.html").is_file());
    assert!(
        ws.join("bundles/dev-local/forms/household/schema.json")
            .is_file()
    );

    let err = profiles::create_profile(&mut cfg, "malaria 2027", None).unwrap_err();
    assert_eq!(err.code, ErrorCode::InvalidArgument);
    // Agents see the new profile's dev-local forms.
    let forms = super::forms::list_forms(&cfg, "Malaria 2027").unwrap();
    assert_eq!(forms.bundle, "dev-local");
}

#[test]
fn dev_mode_changes_only_developer_fields_and_needs_authoring() {
    let (base, path) = setup("devmode");
    let mut cfg = LocalConfig::load(&path).unwrap();
    let err = app::set_dev_mode(&mut cfg, "srv", false, None).unwrap_err();
    assert_eq!(err.capability, Some(Capability::Authoring));

    let id = profiles::create_profile(&mut cfg, "Local", None)
        .unwrap()
        .profile
        .id;
    let before = raw_config(&path);
    let src = base.join("app");
    write_app(&src);
    let res = app::set_dev_mode(&mut cfg, &id, true, Some(&src)).unwrap();
    assert!(res.mirrored_files.is_some_and(|n| n > 0));
    let mut after = raw_config(&path);
    assert_eq!(after["profiles"][1]["customAppDeveloperMode"], json!(true));
    for key in [
        "customAppDeveloperMode",
        "customAppLocalFolder",
        "defaultAppMode",
    ] {
        after["profiles"][1][key] = before["profiles"][1][key].clone();
    }
    assert_eq!(after, before);
}

#[test]
fn desktop_merge_keeps_its_own_edits_and_takes_cli_edits() {
    let base_cfg: AppConfigFile = serde_json::from_value(json!({
        "activeProfileId": "a", "deletedProfileIds": ["gone"],
        "profiles": [
            { "id": "a", "label": "A", "serverUrl": "", "databasePath": "", "workspacePath": null,
              "username": null, "attachmentsPath": null, "customAppLocalFolder": "/old" },
            { "id": "b", "label": "B", "serverUrl": "", "databasePath": "", "workspacePath": null,
              "username": null, "attachmentsPath": null }
        ]
    }))
    .unwrap();
    // Desktop renamed A and changed B's folder in memory.
    let mut mem = base_cfg.clone();
    mem.profiles[0].label = "A renamed".into();
    mem.profiles[1].custom_app_local_folder = Some("/desktop".into());
    // The CLI turned on dev mode for A and B, changed B's folder, and created C and "gone".
    let mut disk = base_cfg.clone();
    disk.profiles[0].custom_app_developer_mode = true;
    disk.profiles[1].custom_app_developer_mode = true;
    disk.profiles[1].custom_app_local_folder = Some("/cli".into());
    let mut c = disk.profiles[1].clone();
    c.id = "c".into();
    let mut gone = c.clone();
    gone.id = "gone".into();
    disk.profiles.push(c);
    disk.profiles.push(gone);

    merge_external_changes(&mut mem, &base_cfg, &disk);
    assert_eq!(mem.profiles[0].label, "A renamed");
    assert!(mem.profiles[0].custom_app_developer_mode);
    assert!(mem.profiles[1].custom_app_developer_mode);
    assert_eq!(
        mem.profiles[1].custom_app_local_folder.as_deref(),
        Some("/desktop")
    );
    let ids: Vec<_> = mem.profiles.iter().map(|p| p.id.as_str()).collect();
    assert_eq!(ids, ["a", "b", "c"]);
}

#[test]
fn checkout_push_dry_run_and_permission_gates() {
    let (base, path) = setup("push");
    let mut cfg = LocalConfig::load(&path).unwrap();
    let id = profiles::create_profile(&mut cfg, "Proj", None)
        .unwrap()
        .profile
        .id;
    let ws = super::config::workspace_for(cfg.profile(&id).unwrap()).unwrap();
    // A "downloaded" bundle with two forms.
    let active = ws.join("bundles/active");
    fs::create_dir_all(active.join("app")).unwrap();
    fs::write(active.join("app/index.html"), "<html>v1</html>").unwrap();
    write_form(&active.join("forms"), "household", "1", false);
    write_form(&active.join("forms"), "person", "1", false);
    write_json(
        &ws.join("bundles/state.json"),
        &json!({ "schemaVersion": 1, "activeVersion": "7", "activeHash": "h",
                 "downloadedAt": "2026-01-01T00:00:00Z", "archivedVersions": [] }),
    );

    let status = app::status(&cfg, &id, false).unwrap();
    assert_eq!(status.active_bundle.unwrap().version, "7");
    assert!(status.source_folder.is_none());

    let dest = base.join("checkout");
    let res = app::checkout(&mut cfg, &id, &dest).unwrap();
    assert!(res.developer_mode);
    assert!(dest.join("index.html").is_file() && dest.join("forms/person/ui.json").is_file());
    assert_eq!(
        app::checkout(&mut cfg, &id, &dest).unwrap_err().code,
        ErrorCode::InvalidArgument
    );

    // Edit: change household without bumping, remove person, add visit.
    write_form(&dest.join("forms"), "household", "1", true);
    fs::remove_dir_all(dest.join("forms/person")).unwrap();
    write_form(&dest.join("forms"), "visit", "1", false);

    let report = app::push(&cfg, &id, false).unwrap();
    assert!(report.dry_run && !report.pushed && report.validation.valid);
    let changes: Vec<_> = report
        .changes
        .iter()
        .map(|c| (c.form_type.as_str(), c.change))
        .collect();
    assert_eq!(
        changes,
        [
            ("household", "changed"),
            ("person", "removed"),
            ("visit", "added")
        ]
    );
    assert!(
        report
            .warnings
            .iter()
            .any(|w| w.contains("\"household\" changed"))
    );
    assert!(report.next_step.contains("may not publish"));

    // --yes without the push permission is refused before any network call.
    let err = app::push(&cfg, &id, true).unwrap_err();
    assert_eq!(err.capability, Some(Capability::Push));

    // With push allowed but no server configured: auth_required (still no network).
    let mut v = raw_config(&path);
    v["profiles"][1]["localToolsAllowPush"] = json!(true);
    write_json(&path, &v);
    let cfg = LocalConfig::load(&path).unwrap();
    assert_eq!(
        app::push(&cfg, &id, true).unwrap_err().code,
        ErrorCode::AuthRequired
    );

    // A broken form blocks the push.
    fs::write(dest.join("forms/visit/ui.json"), "{").unwrap();
    let report = app::push(&cfg, &id, true).unwrap();
    assert!(!report.validation.valid && !report.pushed);
}

#[test]
fn skills_list_show_and_install() {
    let list = skills::list();
    let names: Vec<_> = list.iter().map(|s| s.name).collect();
    assert_eq!(
        names,
        [
            "ode-describe-app",
            "ode-describe-form",
            "ode-describe-question",
            "ode-analyze-export",
            "ode-edit-form",
            "ode-new-project"
        ]
    );
    assert!(list.iter().all(|s| !s.description.is_empty()));
    assert!(
        skills::show("ode-new-project")
            .unwrap()
            .contains("--template OpenDataEnsemble/custom_app")
    );
    assert!(skills::show("nope").is_err());

    let dest = temp_base("skills");
    let first = skills::install(&dest, false).unwrap();
    assert_eq!(first.installed.len(), names.len());
    let again = skills::install(&dest, false).unwrap();
    assert_eq!(again.unchanged.len(), names.len());
    let edited = dest.join("ode-edit-form/SKILL.md");
    fs::write(&edited, "my notes").unwrap();
    assert_eq!(skills::install(&dest, false).unwrap().skipped.len(), 1);
    assert_eq!(fs::read_to_string(&edited).unwrap(), "my notes");
    assert_eq!(skills::install(&dest, true).unwrap().installed.len(), 1);
}
