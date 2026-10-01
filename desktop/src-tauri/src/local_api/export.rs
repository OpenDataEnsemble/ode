//! Parquet export of selected forms (`ode data export`). Requires [`Capability::Data`].

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use super::config::{LocalConfig, workspace_for};
use super::forms::bundle_form_fields;
use super::policy::{self, Capability};
use super::{ApiError, ApiResult, ErrorCode, hint_lines};
use crate::data_export::{
    ExportContext, ExportParquetRequest, ExportProgressFn, load_export_rows, write_parquet_export,
};
use crate::{ServerProfile, sqlite_path_for_workspace};

/// Manifest field metadata + snippet hint for exports of `profile` (Desktop UI and CLI).
pub(crate) fn export_context(profile: &ServerProfile, workspace: &Path) -> ExportContext {
    ExportContext {
        profile_id: Some(profile.id.clone()),
        snippet_hint: hint_lines(profile).unwrap_or_default(),
        form_fields: bundle_form_fields(workspace, profile.custom_app_developer_mode),
    }
}

pub struct ExportOptions {
    pub form_types: Vec<String>,
    /// Parent folder; the export is written to `<destination>/<YYYYMMDD>/`.
    pub destination: PathBuf,
    pub include_pending: bool,
    pub include_attachments: bool,
    pub overwrite: bool,
}

/// CLI-facing result: only paths inside the chosen destination, never workspace paths.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSummary {
    pub profile_id: String,
    pub export_dir: String,
    pub manifest: String,
    pub parquet_files: BTreeMap<String, String>,
    pub form_type_counts: BTreeMap<String, usize>,
    pub total_rows: usize,
    pub include_pending: bool,
    pub include_attachments: bool,
    pub attachments_copied: usize,
    pub attachments_missing: usize,
    /// Requested forms that exist in the bundle but have no exportable observations.
    pub forms_without_rows: Vec<String>,
}

fn invalid(profile_id: &str, message: impl Into<String>) -> ApiError {
    ApiError::new(ErrorCode::InvalidArgument, message).with_profile(profile_id)
}

fn io(profile_id: &str, message: impl Into<String>) -> ApiError {
    ApiError::new(ErrorCode::Io, message).with_profile(profile_id)
}

fn open_read_only(workspace: &Path, profile_id: &str) -> ApiResult<Connection> {
    let path = sqlite_path_for_workspace(workspace);
    if !path.is_file() {
        return Err(ApiError::new(
            ErrorCode::WorkspaceNotFound,
            "The profile has no local database yet. Sync or import data in ODE Desktop first.",
        )
        .with_profile(profile_id));
    }
    let conn = Connection::open_with_flags(
        &path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| {
        io(
            profile_id,
            format!("Could not open the local database: {e}"),
        )
    })?;
    conn.busy_timeout(Duration::from_secs(30))
        .map_err(|e| io(profile_id, e.to_string()))?;
    Ok(conn)
}

pub fn export_parquet(
    cfg: &LocalConfig,
    profile_id: &str,
    opts: &ExportOptions,
    progress: &mut ExportProgressFn<'_>,
) -> ApiResult<ExportSummary> {
    let profile = cfg.profile(profile_id)?;
    let id = profile.id.as_str();
    policy::require(profile, Capability::Data)?;

    let requested: BTreeSet<String> = opts
        .form_types
        .iter()
        .map(|f| f.trim().to_string())
        .filter(|f| !f.is_empty())
        .collect();
    if requested.is_empty() {
        return Err(invalid(
            id,
            "Pass at least one --form (see `ode forms list`).",
        ));
    }
    if !opts.destination.is_dir() {
        return Err(invalid(
            id,
            format!(
                "Destination folder does not exist: {}",
                opts.destination.display()
            ),
        ));
    }
    // Plain absolute paths in the output (no relative paths, no Windows `\\?\` prefix).
    let destination =
        std::path::absolute(&opts.destination).map_err(|e| invalid(id, e.to_string()))?;

    let workspace = workspace_for(profile)?;
    let context = export_context(profile, &workspace);
    let form_types: Vec<String> = requested.iter().cloned().collect();

    progress(0, 1, "Reading observations…");
    let rows = {
        let conn = open_read_only(&workspace, id)?;
        load_export_rows(&conn, opts.include_pending, &form_types)
            .map_err(|e| io(id, e.to_string()))?
    };

    let with_rows: BTreeSet<&str> = rows.iter().map(|r| r.form_type()).collect();
    let unknown: Vec<&str> = requested
        .iter()
        .map(String::as_str)
        .filter(|f| !with_rows.contains(f) && !context.form_fields.contains_key(*f))
        .collect();
    if !unknown.is_empty() {
        return Err(ApiError::new(
            ErrorCode::FormNotFound,
            format!(
                "Unknown form type(s): {}. Run `ode forms list` to see available forms.",
                unknown.join(", ")
            ),
        )
        .with_profile(id));
    }
    let forms_without_rows = requested
        .iter()
        .filter(|f| !with_rows.contains(f.as_str()))
        .cloned()
        .collect();

    let request = ExportParquetRequest {
        parent_dir: destination.to_string_lossy().to_string(),
        include_pending: opts.include_pending,
        include_attachments: opts.include_attachments,
        overwrite: opts.overwrite,
        profile_label: Some(profile.label.clone()),
        form_types,
        context,
    };
    let result = write_parquet_export(&workspace, &request, rows, progress)
        .map_err(|e| io(id, e.to_string()))?;

    let export_dir = Path::new(&result.manifest_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(result.export_dir);
    Ok(ExportSummary {
        profile_id: profile.id.clone(),
        export_dir,
        manifest: result.manifest_path,
        parquet_files: result.parquet_files,
        form_type_counts: result.form_type_counts,
        total_rows: result.total_rows,
        include_pending: result.include_pending,
        include_attachments: result.include_attachments,
        attachments_copied: result.attachments_copied,
        attachments_missing: result.attachments_missing,
        forms_without_rows,
    })
}
