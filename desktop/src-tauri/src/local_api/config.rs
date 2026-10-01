//! Read-only access to ODE Desktop's `config.json`.
//!
//! Local tools never write the config; Desktop normalizes and persists it on startup.

use std::fs;
use std::path::{Path, PathBuf};

use super::{ApiError, ApiResult, ErrorCode};
use crate::{AppConfigFile, ServerProfile, resolve_workspace_root_for_profile};

/// Tauri `identifier` from `tauri.conf.json`; Tauri's app config dir is `<OS config dir>/<identifier>`.
const APP_IDENTIFIER: &str = "org.opendataensemble.custodian";

/// Default location of ODE Desktop's config file for the current OS user.
pub fn default_config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join(APP_IDENTIFIER).join("config.json"))
}

pub struct LocalConfig {
    cfg: AppConfigFile,
}

impl LocalConfig {
    pub fn load(path: &Path) -> ApiResult<Self> {
        let raw = fs::read_to_string(path).map_err(|_| {
            ApiError::new(
                ErrorCode::ConfigNotFound,
                format!(
                    "ODE Desktop config not found at {}. Start ODE Desktop once, or pass --config.",
                    path.display()
                ),
            )
        })?;
        let cfg: AppConfigFile = serde_json::from_str(&raw).map_err(|e| {
            ApiError::new(
                ErrorCode::ConfigInvalid,
                format!("ODE Desktop config could not be parsed: {e}"),
            )
        })?;
        Ok(Self { cfg })
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

pub(crate) fn workspace_for(profile: &ServerProfile) -> ApiResult<PathBuf> {
    resolve_workspace_root_for_profile(profile).ok_or_else(|| {
        ApiError::new(
            ErrorCode::WorkspaceNotFound,
            "The profile's workspace folder does not exist.",
        )
        .with_profile(&profile.id)
    })
}
