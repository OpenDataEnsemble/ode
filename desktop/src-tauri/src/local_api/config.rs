//! Access to ODE Desktop's `config.json`.
//!
//! Desktop owns the config. Local tools only write two things, both via [`LocalConfig::modify`]:
//! the developer-mode fields of a profile, and new profiles. Desktop merges these on its next
//! read/write (see [`merge_external_changes`]).

use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::{ApiError, ApiResult, ErrorCode};
use crate::{
    AppConfigFile, DefaultAppMode, ServerProfile, ensure_workspace_layout,
    resolve_workspace_root_for_profile, sqlite_path_for_workspace,
};

/// Tauri `identifier` from `tauri.conf.json`; Tauri's app config dir is `<OS config dir>/<identifier>`.
const APP_IDENTIFIER: &str = "org.opendataensemble.custodian";

/// Default location of ODE Desktop's config file for the current OS user.
pub fn default_config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join(APP_IDENTIFIER).join("config.json"))
}

/// Tauri's `app_data_dir` (profile workspaces live under `<data dir>/profiles/<id>`).
fn default_data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join(APP_IDENTIFIER))
}

pub struct LocalConfig {
    cfg: AppConfigFile,
    path: PathBuf,
    data_dir: PathBuf,
}

fn read_config(path: &Path) -> ApiResult<AppConfigFile> {
    let raw = fs::read_to_string(path).map_err(|_| {
        ApiError::new(
            ErrorCode::ConfigNotFound,
            format!(
                "ODE Desktop config not found at {}. Start ODE Desktop once, or pass --config.",
                path.display()
            ),
        )
    })?;
    serde_json::from_str(&raw).map_err(|e| {
        ApiError::new(
            ErrorCode::ConfigInvalid,
            format!("ODE Desktop config could not be parsed: {e}"),
        )
    })
}

fn io_err(e: impl std::fmt::Display) -> ApiError {
    ApiError::new(ErrorCode::Io, e.to_string())
}

impl LocalConfig {
    pub fn load(path: &Path) -> ApiResult<Self> {
        let cfg = read_config(path)?;
        // Real Desktop config → Tauri's data dir; any other config (tests, --config) → its folder.
        let data_dir = if default_config_path().as_deref() == Some(path) {
            default_data_dir()
        } else {
            None
        }
        .or_else(|| path.parent().map(Path::to_path_buf))
        .unwrap_or_default();
        Ok(Self {
            cfg,
            path: path.to_path_buf(),
            data_dir,
        })
    }

    /// Re-read `config.json`, apply `f`, and write it back atomically (temp file + rename).
    fn modify<T>(&mut self, f: impl FnOnce(&mut AppConfigFile) -> ApiResult<T>) -> ApiResult<T> {
        let mut cfg = read_config(&self.path)?;
        let out = f(&mut cfg)?;
        let tmp = self.path.with_extension("json.ode-tmp");
        let body = serde_json::to_string_pretty(&cfg).map_err(io_err)?;
        fs::write(&tmp, body).map_err(io_err)?;
        fs::rename(&tmp, &self.path).map_err(io_err)?;
        self.cfg = cfg;
        Ok(out)
    }

    /// Set developer mode, and optionally the local custom app folder. Policy is checked by callers.
    pub(crate) fn set_developer_mode(
        &mut self,
        profile_id: &str,
        enabled: bool,
        folder: Option<String>,
    ) -> ApiResult<()> {
        self.modify(|cfg| {
            let p = cfg
                .profiles
                .iter_mut()
                .find(|p| p.id == profile_id)
                .ok_or_else(|| {
                    ApiError::new(ErrorCode::ProfileNotFound, "Profile no longer exists.")
                })?;
            p.custom_app_developer_mode = enabled;
            if folder.is_some() {
                p.custom_app_local_folder = folder;
            }
            Ok(())
        })
    }

    /// New local profile, laid out like Desktop's "Add profile". Agents may author on it (it has
    /// no server, credentials, or data) but not push. Not made active.
    pub(crate) fn create_profile(
        &mut self,
        label: &str,
        source: Option<String>,
    ) -> ApiResult<ServerProfile> {
        let label = label.trim();
        if label.is_empty() {
            return Err(ApiError::new(
                ErrorCode::InvalidArgument,
                "--label must not be empty.",
            ));
        }
        let id = Uuid::new_v4().to_string();
        let workspace = self.data_dir.join("profiles").join(&id);
        let profile = ServerProfile {
            id,
            label: label.to_string(),
            server_url: String::new(),
            username: None,
            workspace_path: Some(workspace.to_string_lossy().to_string()),
            database_path: sqlite_path_for_workspace(&workspace)
                .to_string_lossy()
                .to_string(),
            attachments_path: None,
            default_app_mode: if source.is_some() {
                DefaultAppMode::Workbench
            } else {
                DefaultAppMode::DataManagement
            },
            custom_app_developer_mode: source.is_some(),
            custom_app_local_folder: source,
            export_destination_parent: None,
            last_export_at: None,
            last_export: None,
            local_tools_enabled: true,
            local_tools_allow_data: false,
            local_tools_allow_authoring: true,
            local_tools_allow_push: false,
        };
        let created = profile.clone();
        self.modify(move |cfg| {
            if cfg
                .profiles
                .iter()
                .any(|p| p.label.trim().eq_ignore_ascii_case(label))
            {
                return Err(ApiError::new(
                    ErrorCode::InvalidArgument,
                    format!("A profile labelled \"{label}\" already exists."),
                ));
            }
            fs::create_dir_all(&workspace).map_err(io_err)?;
            ensure_workspace_layout(&workspace).map_err(io_err)?;
            cfg.profiles.push(profile);
            Ok(())
        })?;
        Ok(created)
    }

    pub(crate) fn active_profile_id(&self) -> &str {
        &self.cfg.active_profile_id
    }

    /// Profiles visible to local tools (disabled profiles are omitted entirely).
    pub(crate) fn visible_profiles(&self) -> impl Iterator<Item = &ServerProfile> {
        self.cfg.profiles.iter().filter(|p| p.local_tools_enabled)
    }

    /// Resolve by id, or by label (case-insensitive) when exactly one profile matches.
    /// Disabled and unknown profiles are indistinguishable to callers.
    pub(crate) fn profile(&self, id_or_label: &str) -> ApiResult<&ServerProfile> {
        let key = id_or_label.trim();
        if let Some(p) = self.visible_profiles().find(|p| p.id == key) {
            return Ok(p);
        }
        let mut by_label = self
            .visible_profiles()
            .filter(|p| p.label.trim().eq_ignore_ascii_case(key));
        match (by_label.next(), by_label.next()) {
            (Some(p), None) => Ok(p),
            (Some(_), Some(_)) => Err(ApiError::new(
                ErrorCode::InvalidArgument,
                format!("Several profiles are labelled \"{key}\"; pass the profile id instead."),
            )),
            _ => Err(ApiError::new(
                ErrorCode::ProfileNotFound,
                format!(
                    "No profile \"{key}\" is available to local tools. Run `ode profiles list` to see ids and labels."
                ),
            )),
        }
    }
}

/// Three-way merge of CLI edits into Desktop's in-memory config: `baseline` is what Desktop last
/// read/wrote, `disk` is the current file. Only CLI-owned changes are taken over: new profiles
/// and the developer-mode fields (when Desktop has not changed them itself).
pub(crate) fn merge_external_changes(
    mem: &mut AppConfigFile,
    baseline: &AppConfigFile,
    disk: &AppConfigFile,
) {
    for d in &disk.profiles {
        let base = baseline.profiles.iter().find(|p| p.id == d.id);
        match (mem.profiles.iter_mut().find(|p| p.id == d.id), base) {
            (None, None) if !mem.deleted_profile_ids.contains(&d.id) => {
                mem.profiles.push(d.clone());
            }
            (Some(m), Some(b)) => {
                if d.custom_app_developer_mode != b.custom_app_developer_mode
                    && m.custom_app_developer_mode == b.custom_app_developer_mode
                {
                    m.custom_app_developer_mode = d.custom_app_developer_mode;
                }
                if d.custom_app_local_folder != b.custom_app_local_folder
                    && m.custom_app_local_folder == b.custom_app_local_folder
                {
                    m.custom_app_local_folder = d.custom_app_local_folder.clone();
                }
            }
            _ => {}
        }
    }
}

pub(crate) fn workspace_for(profile: &ServerProfile) -> ApiResult<PathBuf> {
    resolve_workspace_root_for_profile(profile).ok_or_else(|| {
        ApiError::new(
            ErrorCode::WorkspaceNotFound,
            "The profile's workspace folder does not exist.",
        )
        .with_profile(&profile.id)
    })
}
