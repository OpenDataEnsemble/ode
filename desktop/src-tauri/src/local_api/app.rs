//! Custom app authoring (`ode app ...`): developer mode, source folder, validation, and publishing.
//!
//! Agents edit the profile's *source folder* (`customAppLocalFolder`). `bundles/active/` (Synkronus
//! download) and `bundles/dev-local/` (mirror, overwritten on refresh) are never edited directly.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::config::{LocalConfig, workspace_for};
use super::forms::{form_version, specs_in_roots};
use super::policy::{self, Capability};
use super::validate::{ValidationReport, validate_path};
use super::{ApiError, ApiResult, ErrorCode};
use crate::{
    ServerProfile, bundle_form_roots, copy_dir_recursive, credential_entry,
    mirror_custom_app_dev_folder, push_app_bundle_zip, read_app_bundle_state_unlocked,
    strip_ode_desktop_injection, switch_app_bundle_version, synk_login_token,
    validate_custom_app_dev_source_folder, zip_dev_mirror_bundle,
};

/// Sent as `x-ode-version`; matches `SYNKRONUS_CLIENT_VERSION` per the release checklist.
const ODE_VERSION: &str = env!("CARGO_PKG_VERSION");

fn err(code: ErrorCode, profile: &ServerProfile, message: impl Into<String>) -> ApiError {
    ApiError::new(code, message).with_profile(&profile.id)
}

fn absolute(path: &Path) -> ApiResult<PathBuf> {
    std::path::absolute(path).map_err(|e| ApiError::new(ErrorCode::InvalidArgument, e.to_string()))
}

fn configured_source(profile: &ServerProfile) -> Option<PathBuf> {
    profile
        .custom_app_local_folder
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
}

/// Source folder of a profile in developer mode, or an actionable error.
fn dev_source(profile: &ServerProfile) -> ApiResult<PathBuf> {
    let source = configured_source(profile).ok_or_else(|| {
        err(
            ErrorCode::InvalidArgument,
            profile,
            "No local custom app folder is configured. Run `ode app checkout --dest <dir>` \
             (copy the downloaded bundle) or `ode app dev on --source <dir>`.",
        )
    })?;
    if !profile.custom_app_developer_mode {
        return Err(err(
            ErrorCode::InvalidArgument,
            profile,
            "Developer mode is off for this profile. Run `ode app dev on`.",
        ));
    }
    Ok(source)
}

// ---------------------------------------------------------------------------------------------
// Status

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveBundle {
    pub version: String,
    pub downloaded_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub profile_id: String,
    pub capabilities: Vec<Capability>,
    pub developer_mode: bool,
    /// Bundle that forms and the app are read from: `active` or `dev-local`.
    pub bundle: &'static str,
    /// Last bundle downloaded from Synkronus (`bundles/state.json`).
    pub active_bundle: Option<ActiveBundle>,
    pub dev_mirror_present: bool,
    pub server_configured: bool,
    /// Only with the authoring capability (it reveals local paths).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_folder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_has_index_html: Option<bool>,
    /// A `package.json` next to or above the folder suggests it is build output (edit sources, rebuild).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_looks_like_build_output: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credentials_saved: Option<bool>,
    /// Current bundle version on Synkronus (`--check-server`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_version: Option<String>,
    /// Suggested next steps for an agent.
    pub hints: Vec<String>,
}

fn credentials_saved(profile: &ServerProfile) -> bool {
    profile
        .username
        .as_deref()
        .is_some_and(|u| !u.trim().is_empty())
        && credential_entry(&profile.id)
            .and_then(|e| e.get_password().map_err(|e| e.to_string()))
            .is_ok()
}

fn looks_like_build_output(source: &Path) -> bool {
    source
        .ancestors()
        .skip(1)
        .take(2)
        .any(|dir| dir.join("package.json").is_file())
}

pub fn status(cfg: &LocalConfig, profile_id: &str, check_server: bool) -> ApiResult<AppStatus> {
    let profile = cfg.profile(profile_id)?;
    policy::require(profile, Capability::FormMetadata)?;
    let ws = workspace_for(profile)?;
    let authoring = policy::allows(profile, Capability::Authoring);
    let active_bundle = read_app_bundle_state_unlocked(&ws.join("bundles"))
        .ok()
        .flatten()
        .map(|s| ActiveBundle {
            version: s.active_version,
            downloaded_at: s.downloaded_at,
        });
    let source = configured_source(profile);
    let server_configured = !profile.server_url.trim().is_empty();

    let mut hints = Vec::new();
    if !authoring {
        hints.push(
            "Agents may not manage this profile's app bundle; you can still edit files and run \
             `ode forms validate`. The user can enable \"Allow agents to manage the app bundle\" \
             in ODE Desktop → Profiles → Local tools."
                .to_string(),
        );
    } else if source.is_none() {
        hints.push(if active_bundle.is_some() {
            "No local source folder yet: run `ode app checkout --dest <empty dir>` to start from \
             the downloaded bundle."
                .to_string()
        } else {
            "No app yet: see the `ode-new-project` skill (`ode skills show ode-new-project`)."
                .to_string()
        });
    } else if !profile.custom_app_developer_mode {
        hints.push("Developer mode is off: run `ode app dev on`.".to_string());
    }
    if authoring && !server_configured {
        hints.push(
            "No Synkronus server configured; publishing needs the user to add one in ODE Desktop \
             → Profiles."
                .to_string(),
        );
    }

    let server_version = if check_server {
        Some(server_manifest_version(profile)?)
    } else {
        None
    };

    Ok(AppStatus {
        profile_id: profile.id.clone(),
        capabilities: policy::granted(profile),
        developer_mode: profile.custom_app_developer_mode,
        bundle: crate::bundle_segment(profile.custom_app_developer_mode),
        active_bundle,
        dev_mirror_present: ws.join("bundles/dev-local/app/index.html").is_file(),
        server_configured,
        source_folder: authoring
            .then(|| source.as_ref().map(|s| s.display().to_string()))
            .flatten(),
        source_has_index_html: authoring
            .then(|| source.as_ref().map(|s| s.join("index.html").is_file()))
            .flatten(),
        source_looks_like_build_output: authoring
            .then(|| source.as_deref().map(looks_like_build_output))
            .flatten(),
        credentials_saved: authoring.then(|| credentials_saved(profile)),
        server_version,
        hints,
    })
}

// ---------------------------------------------------------------------------------------------
// Synkronus

/// Log in with the profile's server URL, username, and saved password. Returns `(base_url, token)`.
fn login(profile: &ServerProfile) -> ApiResult<(String, String)> {
    let base = profile.server_url.trim().trim_end_matches('/').to_string();
    let username = profile.username.as_deref().map(str::trim).unwrap_or("");
    if base.is_empty() || username.is_empty() {
        return Err(err(
            ErrorCode::AuthRequired,
            profile,
            "No Synkronus server URL or username configured. Ask the user to add them in ODE \
             Desktop → Profiles.",
        ));
    }
    let password = credential_entry(&profile.id)
        .and_then(|e| e.get_password().map_err(|e| e.to_string()))
        .map_err(|_| {
            err(
                ErrorCode::AuthRequired,
                profile,
                "No saved password for this profile. Ask the user to save it in ODE Desktop → \
                 Profiles.",
            )
        })?;
    let token = tauri::async_runtime::block_on(synk_login_token(&base, username, &password))
        .map_err(|e| {
            err(
                ErrorCode::Network,
                profile,
                format!("Synkronus login failed: {e}"),
            )
        })?;
    Ok((base, token))
}

fn server_manifest_version(profile: &ServerProfile) -> ApiResult<String> {
    let (base, token) = login(profile)?;
    let fetch = async {
        let res = reqwest::Client::new()
            .get(format!("{base}/api/app-bundle/manifest"))
            .bearer_auth(&token)
            .header("x-ode-version", ODE_VERSION)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("HTTP {}", res.status()));
        }
        let manifest: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        Ok(manifest
            .get("version")
            .map(|v| {
                v.as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| v.to_string())
            })
            .unwrap_or_default())
    };
    tauri::async_runtime::block_on(fetch).map_err(|e| {
        err(
            ErrorCode::Network,
            profile,
            format!("Could not read the server's app bundle manifest: {e}"),
        )
    })
}

// ---------------------------------------------------------------------------------------------
// Developer mode and checkout

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevModeResult {
    pub profile_id: String,
    pub developer_mode: bool,
    pub source_folder: Option<String>,
    /// Files copied into `bundles/dev-local/` (when developer mode was turned on).
    pub mirrored_files: Option<u64>,
    pub next_step: String,
}

fn mirror(profile: &ServerProfile, ws: &Path, source: &Path) -> ApiResult<u64> {
    mirror_custom_app_dev_folder(ws, source).map_err(|e| {
        err(
            ErrorCode::Io,
            profile,
            format!("Could not refresh the dev mirror: {e}"),
        )
    })
}

const PREVIEW_STEP: &str = "Ask the user to open ODE Desktop, select this profile, and press \
    \"Refresh app\" in Workbench to preview the custom app and forms.";

/// Turn developer mode on (refreshing the mirror) or off. `source` replaces the configured folder.
pub fn set_dev_mode(
    cfg: &mut LocalConfig,
    profile_id: &str,
    on: bool,
    source: Option<&Path>,
) -> ApiResult<DevModeResult> {
    let profile = cfg.profile(profile_id)?.clone();
    policy::require(&profile, Capability::Authoring)?;
    let ws = workspace_for(&profile)?;
    if !on {
        cfg.set_developer_mode(&profile.id, false, None)?;
        return Ok(DevModeResult {
            profile_id: profile.id,
            developer_mode: false,
            source_folder: None,
            mirrored_files: None,
            next_step: "Desktop now uses the bundle downloaded from Synkronus again.".to_string(),
        });
    }
    let folder = match source {
        Some(s) => absolute(s)?,
        None => configured_source(&profile).ok_or_else(|| {
            err(
                ErrorCode::InvalidArgument,
                &profile,
                "Pass --source <dir> (the folder containing index.html).",
            )
        })?,
    };
    validate_custom_app_dev_source_folder(&folder)
        .map_err(|e| err(ErrorCode::InvalidArgument, &profile, e))?;
    let folder_str = folder.display().to_string();
    cfg.set_developer_mode(&profile.id, true, source.map(|_| folder_str.clone()))?;
    let mirrored = mirror(&profile, &ws, &folder)?;
    Ok(DevModeResult {
        profile_id: profile.id,
        developer_mode: true,
        source_folder: Some(folder_str),
        mirrored_files: Some(mirrored),
        next_step: PREVIEW_STEP.to_string(),
    })
}

/// Copy the downloaded bundle (`bundles/active/`) into a new source folder and switch to it.
pub fn checkout(cfg: &mut LocalConfig, profile_id: &str, dest: &Path) -> ApiResult<DevModeResult> {
    let profile = cfg.profile(profile_id)?.clone();
    policy::require(&profile, Capability::Authoring)?;
    let ws = workspace_for(&profile)?;
    let active = ws.join("bundles/active");
    if !active.join("app/index.html").is_file() {
        return Err(err(
            ErrorCode::InvalidArgument,
            &profile,
            "This profile has no downloaded app bundle to check out. Download it in ODE Desktop \
             → Workbench → Bundles, or start a new app (`ode skills show ode-new-project`).",
        ));
    }
    let dest = absolute(dest)?;
    if dest.exists()
        && fs::read_dir(&dest)
            .map(|mut d| d.next().is_some())
            .unwrap_or(true)
    {
        return Err(err(
            ErrorCode::InvalidArgument,
            &profile,
            format!("Destination must be empty or not exist: {}", dest.display()),
        ));
    }
    let io = |e: crate::CustodianError| err(ErrorCode::Io, &profile, e.to_string());
    copy_dir_recursive(&active.join("app"), &dest).map_err(io)?;
    if active.join("forms").is_dir() && !dest.join("forms").exists() {
        copy_dir_recursive(&active.join("forms"), &dest.join("forms")).map_err(io)?;
    }
    // Desktop's preview inject must not end up in the user's source.
    let index = dest.join("index.html");
    if let Ok(html) = fs::read_to_string(&index) {
        let _ = fs::write(&index, strip_ode_desktop_injection(&html));
    }
    let mut result = set_dev_mode(cfg, &profile.id, true, Some(&dest))?;
    result.next_step = format!(
        "Edit the app and forms in {} (forms: <folder>/forms/<form_type>/), run `ode app \
         validate`, then: {PREVIEW_STEP}",
        dest.display()
    );
    Ok(result)
}

// ---------------------------------------------------------------------------------------------
// Validation

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppValidation {
    pub valid: bool,
    pub source_folder: String,
    /// App-level problems (`missing_index_html`, `no_forms`).
    pub problems: Vec<AppProblem>,
    /// `ode forms validate` on `<source>/forms`.
    pub forms: Option<ValidationReport>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppProblem {
    pub severity: super::validate::Severity,
    pub code: &'static str,
    pub message: String,
}

fn validate_source(source: &Path) -> AppValidation {
    use super::validate::Severity;
    let mut problems = Vec::new();
    if !source.join("index.html").is_file() {
        problems.push(AppProblem {
            severity: Severity::Error,
            code: "missing_index_html",
            message: format!(
                "{} has no index.html. Point developer mode at the built app folder.",
                source.display()
            ),
        });
    }
    let forms_dir = source.join("forms");
    let forms = if forms_dir.is_dir() {
        match validate_path(&forms_dir) {
            Ok(report) => Some(report),
            Err(e) => {
                problems.push(AppProblem {
                    severity: Severity::Warning,
                    code: "no_forms",
                    message: e.message,
                });
                None
            }
        }
    } else {
        problems.push(AppProblem {
            severity: Severity::Warning,
            code: "no_forms",
            message: "The app has no forms/ folder.".to_string(),
        });
        None
    };
    let valid = !problems.iter().any(|p| p.severity == Severity::Error)
        && forms.as_ref().is_none_or(|f| f.valid);
    AppValidation {
        valid,
        source_folder: source.display().to_string(),
        problems,
        forms,
    }
}

pub fn validate(cfg: &LocalConfig, profile_id: &str) -> ApiResult<AppValidation> {
    let profile = cfg.profile(profile_id)?;
    policy::require(profile, Capability::Authoring)?;
    let source = configured_source(profile).ok_or_else(|| {
        err(
            ErrorCode::InvalidArgument,
            profile,
            "No local custom app folder is configured (see `ode app status`).",
        )
    })?;
    Ok(validate_source(&source))
}

// ---------------------------------------------------------------------------------------------
// Push

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormChange {
    pub form_type: String,
    /// `added`, `removed`, or `changed` (compared with the last downloaded bundle).
    pub change: &'static str,
    pub version_before: Option<String>,
    pub version_after: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushReport {
    pub profile_id: String,
    pub dry_run: bool,
    pub pushed: bool,
    /// Synkronus server that would receive / received the bundle.
    pub server_url: String,
    pub validation: AppValidation,
    pub changes: Vec<FormChange>,
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub next_step: String,
}

/// Forms in the dev mirror vs the last downloaded bundle.
fn diff_forms(ws: &Path) -> (Vec<FormChange>, Vec<String>) {
    let before = specs_in_roots(&bundle_form_roots(ws, false));
    let after = specs_in_roots(&bundle_form_roots(ws, true));
    let names: BTreeSet<&String> = before.keys().chain(after.keys()).collect();
    let mut changes = Vec::new();
    let mut warnings = Vec::new();
    for name in names {
        let (b, a) = (before.get(name), after.get(name));
        let change = match (b, a) {
            (None, Some(_)) => "added",
            (Some(_), None) => "removed",
            (Some(b), Some(a)) if b.form_schema != a.form_schema || b.ui_schema != a.ui_schema => {
                "changed"
            }
            _ => continue,
        };
        let version_before = b.map(|s| form_version(&s.form_schema));
        let version_after = a.map(|s| form_version(&s.form_schema));
        if change == "changed" && version_before == version_after {
            warnings.push(format!(
                "Form \"{name}\" changed but its version is still {}. Bump \"version\" in its \
                 schema.json.",
                version_after.as_deref().unwrap_or("1.0")
            ));
        }
        if change == "removed" {
            warnings.push(format!(
                "Form \"{name}\" would be removed from the server bundle. Existing observations \
                 keep their data, but devices can no longer open the form."
            ));
        }
        changes.push(FormChange {
            form_type: name.clone(),
            change,
            version_before,
            version_after,
        });
    }
    (changes, warnings)
}

/// Refresh the mirror, validate, and diff; with `yes` (and the push capability) publish to Synkronus.
pub fn push(cfg: &LocalConfig, profile_id: &str, yes: bool) -> ApiResult<PushReport> {
    let profile = cfg.profile(profile_id)?;
    policy::require(profile, Capability::Authoring)?;
    let ws = workspace_for(profile)?;
    let source = dev_source(profile)?;
    let validation = validate_source(&source);
    if validation
        .problems
        .iter()
        .all(|p| p.code != "missing_index_html")
    {
        mirror(profile, &ws, &source)?;
    }
    let (changes, warnings) = diff_forms(&ws);
    let mut report = PushReport {
        profile_id: profile.id.clone(),
        dry_run: !yes,
        pushed: false,
        server_url: profile.server_url.trim().to_string(),
        validation,
        changes,
        warnings,
        version: None,
        message: None,
        next_step: String::new(),
    };
    if !report.validation.valid {
        report.next_step = "Fix the validation errors, then run `ode app push` again.".to_string();
        return Ok(report);
    }
    let push_allowed = policy::allows(profile, Capability::Push);
    if !yes {
        report.next_step = if push_allowed {
            format!(
                "Show these changes and the target server to the user. Only after explicit \
                 confirmation run `ode app push --profile {} --yes`. A push reaches every device \
                 on its next sync.",
                profile.id
            )
        } else {
            "Show these changes to the user. Agents may not publish for this profile: the user \
             can enable \"Allow agents to push the app bundle\" in ODE Desktop → Profiles → \
             Local tools, or publish from ODE Desktop → Workbench → Custom app."
                .to_string()
        };
        return Ok(report);
    }

    policy::require(profile, Capability::Push)?;
    let (base, token) = login(profile)?;
    let zip = zip_dev_mirror_bundle(&ws).map_err(|e| err(ErrorCode::Io, profile, e.to_string()))?;
    let published = tauri::async_runtime::block_on(async {
        let res = push_app_bundle_zip(&base, &token, ODE_VERSION, &zip).await?;
        switch_app_bundle_version(&base, &token, ODE_VERSION, &res.manifest.version).await?;
        Ok::<_, crate::CustodianError>(res)
    });
    let _ = fs::remove_file(&zip);
    let published = published.map_err(|e| err(ErrorCode::Network, profile, e.to_string()))?;
    report.pushed = true;
    report.version = Some(published.manifest.version);
    report.message = Some(published.message);
    report.next_step = "Published and activated. Devices pick up the new bundle on their next \
        sync; in ODE Desktop, download it again under Workbench → Bundles to update the local copy."
        .to_string();
    Ok(report)
}
