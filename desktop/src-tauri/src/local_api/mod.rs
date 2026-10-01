//! Headless operations for local tools (the `ode` CLI, later `ode mcp`).
//!
//! ODE Desktop owns the configuration; this module only reads it. Every operation
//! resolves a profile through [`config::LocalConfig`] and checks [`policy`] before
//! touching workspace content. See `desktop/docs/LOCAL_TOOLS.md`.

pub mod config;
pub mod export;
pub mod forms;
pub mod policy;
pub mod profiles;
pub mod validate;

#[cfg(test)]
mod tests;
#[cfg(test)]
mod validate_tests;

use std::path::PathBuf;

use serde::Serialize;

use crate::ServerProfile;

pub use policy::Capability;

/// Version of the JSON contract emitted by local tools.
pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    ConfigNotFound,
    ConfigInvalid,
    ProfileNotFound,
    WorkspaceNotFound,
    FormNotFound,
    PermissionDenied,
    InvalidArgument,
    Io,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capability: Option<Capability>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
}

impl ApiError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            capability: None,
            profile_id: None,
        }
    }

    pub(crate) fn with_profile(mut self, profile_id: &str) -> Self {
        self.profile_id = Some(profile_id.to_string());
        self
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for ApiError {}

pub type ApiResult<T> = Result<T, ApiError>;

/// The `ode` executable next to the running binary (Desktop or CLI), if present.
pub fn cli_path() -> Option<PathBuf> {
    let name = if cfg!(windows) { "ode.exe" } else { "ode" };
    let path = std::env::current_exe().ok()?.parent()?.join(name);
    path.is_file().then_some(path)
}

/// Comment lines (without comment prefix) pointing agents at `ode` from generated files such
/// as export load snippets. `None` when the profile is hidden from local tools.
/// Keep in sync with `localToolsHintLines` in `desktop/src/lib/localTools.ts`.
pub(crate) fn hint_lines(profile: &ServerProfile) -> Option<Vec<String>> {
    if !policy::allows(profile, Capability::FormMetadata) {
        return None;
    }
    let cli = match cli_path().map(|p| p.display().to_string()) {
        Some(p) if p.contains(char::is_whitespace) => format!("\"{p}\""),
        Some(p) => p,
        None => "ode".to_string(),
    };
    let id = &profile.id;
    Some(vec![
        "AI assistants / agents: form definitions for these tables (question labels,".into(),
        "coded choice values, linked sub-forms) are available from ODE Desktop's CLI:".into(),
        format!("  {cli} forms list --profile {id}"),
        format!("  {cli} forms show <form_type> --profile {id}"),
        format!(
            "Profile: {}. Run {cli} --help for details (JSON output).",
            profile.label.trim()
        ),
    ])
}
