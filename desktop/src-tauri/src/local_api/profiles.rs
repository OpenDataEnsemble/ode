use serde::Serialize;

use super::config::LocalConfig;
use super::policy::{self, Capability};

/// Redacted profile view: never add credentials, server URLs, usernames, or paths here.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub id: String,
    pub label: String,
    pub active: bool,
    pub capabilities: Vec<Capability>,
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
