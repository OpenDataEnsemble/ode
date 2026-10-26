use std::path::Path;

use serde::Serialize;

use super::config::{LocalConfig, workspace_for};
use super::policy::{self, Capability};
use super::{ApiError, ApiResult, ErrorCode};
use crate::{mirror_custom_app_dev_folder, validate_custom_app_dev_source_folder};

/// Redacted profile view: never add credentials, server URLs, usernames, or paths here.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub id: String,
    pub label: String,
    pub active: bool,
    pub capabilities: Vec<Capability>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedProfile {
    #[serde(flatten)]
    pub profile: ProfileSummary,
    pub developer_mode: bool,
    pub source_folder: Option<String>,
    pub next_step: String,
}

/// `ode profiles create`: new local profile; with `source`, developer mode on that folder.
pub fn create_profile(
    cfg: &mut LocalConfig,
    label: &str,
    source: Option<&Path>,
) -> ApiResult<CreatedProfile> {
    let source = source
        .map(|s| {
            let abs = std::path::absolute(s)
                .map_err(|e| ApiError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            validate_custom_app_dev_source_folder(&abs)
                .map_err(|e| ApiError::new(ErrorCode::InvalidArgument, e))?;
            Ok::<_, ApiError>(abs)
        })
        .transpose()?;
    let profile = cfg.create_profile(label, source.as_ref().map(|s| s.display().to_string()))?;
    if let Some(src) = &source {
        let ws = workspace_for(&profile)?;
        mirror_custom_app_dev_folder(&ws, src)
            .map_err(|e| ApiError::new(ErrorCode::Io, e.to_string()).with_profile(&profile.id))?;
    }
    Ok(CreatedProfile {
        profile: ProfileSummary {
            id: profile.id.clone(),
            label: profile.label.clone(),
            active: false,
            capabilities: policy::granted(&profile),
        },
        developer_mode: profile.custom_app_developer_mode,
        source_folder: profile.custom_app_local_folder.clone(),
        next_step: "Ask the user to open ODE Desktop and select this profile (Profiles page). \
            To publish later, they add a Synkronus server and credentials there and enable \
            \"Allow agents to push the app bundle\"."
            .to_string(),
    })
}

pub fn list_profiles(cfg: &LocalConfig) -> Vec<ProfileSummary> {
    cfg.visible_profiles()
        .map(|p| ProfileSummary {
            id: p.id.clone(),
            label: p.label.clone(),
            active: p.id == cfg.active_profile_id(),
            capabilities: policy::granted(p),
        })
        .collect()
}
