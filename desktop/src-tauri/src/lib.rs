use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{BufWriter, Cursor, Write},
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
    sync::{Arc, Mutex},
    time::{Duration, Instant, UNIX_EPOCH},
};

use futures_util::StreamExt;

use chrono::{DateTime, Datelike, NaiveDate, Utc};
use keyring::Entry;
use rayon::prelude::*;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::multipart;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Emitter, Manager};
use thiserror::Error;
use url::Url;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

mod observation_index;
mod observation_query;
mod sync_engine;

#[derive(Debug, Error)]
enum CustodianError {
    #[error("workspace is not configured")]
    WorkspaceMissing,
    #[error("path is outside workspace")]
    PathOutsideWorkspace,
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Serde(#[from] serde_json::Error),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
}

impl From<CustodianError> for String {
    fn from(value: CustodianError) -> Self {
        value.to_string()
    }
}

const CREDENTIAL_SERVICE: &str = "org.opendataensemble.custodian.password";

/// Local app-bundle layout under `<workspace>/bundles/` (`archives/*.zip`, `active/`, `state.json`).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppBundleState {
    pub schema_version: u32,
    pub active_version: String,
    pub active_hash: String,
    pub downloaded_at: String,
    pub archived_versions: Vec<String>,
}

/// Emitted on `bundle/apply-progress` and `bundle/index-rebuild`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BundleApplyProgressEvent {
    job_id: String,
    phase: String,
    done: i64,
    total: i64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadAndApplyAppBundleResult {
    state: AppBundleState,
    index_rebuild_scheduled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActiveBundleFormEntry {
    pub form_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleFormSpec {
    pub form_type: String,
    pub form_schema: Value,
    pub ui_schema: Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum DefaultAppMode {
    #[default]
    DataManagement,
    Workbench,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerProfile {
    id: String,
    label: String,
    server_url: String,
    username: Option<String>,
    workspace_path: Option<String>,
    database_path: String,
    attachments_path: Option<String>,
    #[serde(default)]
    default_app_mode: DefaultAppMode,
    #[serde(default)]
    custom_app_developer_mode: bool,
    #[serde(default)]
    custom_app_local_folder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppConfigFile {
    #[serde(default = "schema_version_default")]
    schema_version: u32,
    active_profile_id: String,
    profiles: Vec<ServerProfile>,
}

fn schema_version_default() -> u32 {
    3
}

/// `<workspace>/sqlite/custodian.sqlite3`
fn sqlite_path_for_workspace(workspace: &Path) -> PathBuf {
    workspace.join("sqlite").join("custodian.sqlite3")
}

/// V2 attachment layout (matches Formulus `attachmentStorage` / `WebViewFileUrlResolver`).
/// `pending/` is the outbound upload queue.
const ATTACH_SUBDIR_DRAFT: &str = "draft";
const ATTACH_SUBDIR_PENDING: &str = "pending";
const ATTACH_SUBDIR_SYNCED: &str = "synced";

fn attachments_root(workspace: &Path) -> PathBuf {
    workspace.join("attachments")
}

fn count_regular_files_in_dir(dir: &Path) -> i64 {
    if !dir.is_dir() {
        return 0;
    }
    let Ok(read) = fs::read_dir(dir) else {
        return 0;
    };
    let mut n = 0i64;
    for entry in read.flatten() {
        if let Ok(ft) = entry.file_type()
            && ft.is_file()
        {
            n += 1;
        }
    }
    n
}

/// Regular files directly under `attachments/pending/` (physical outbound queue only).
/// Does not infer counts from observation JSON.
fn count_attachment_pending_dir_files(workspace: &Path) -> i64 {
    count_regular_files_in_dir(&attachments_root(workspace).join(ATTACH_SUBDIR_PENDING))
}

/// All regular files under `attachments/` (recursive), including subfolders.
fn count_all_attachment_files(workspace: &Path) -> i64 {
    let root = attachments_root(workspace);
    if !root.is_dir() {
        return 0;
    }
    let mut n = 0i64;
    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            n += 1;
        }
    }
    n
}

/// Prefer configured `workspace_path` when it exists; otherwise infer from `database_path` (`…/sqlite/custodian.sqlite3` → workspace root).
fn resolve_workspace_root_for_profile(profile: &ServerProfile) -> Option<PathBuf> {
    if let Some(ws) = profile
        .workspace_path
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        let p = PathBuf::from(ws);
        if p.is_dir() {
            return Some(p);
        }
    }
    infer_workspace_from_legacy_database_path(profile.database_path.trim())
}

fn resolve_active_workspace_dir(ctx: &AppCtxHandle) -> Result<PathBuf, CustodianError> {
    let db_path = resolve_db_path(ctx)?;
    if let Some(ws) = workspace_root_from_resolved_db_path(&db_path)
        && ws.is_dir()
    {
        return Ok(ws);
    }
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock config".to_string()))?;
    let profile = active_profile_ref(&cfg)?;
    resolve_workspace_root_for_profile(profile).ok_or(CustodianError::WorkspaceMissing)
}

fn ensure_workspace_layout(workspace: &Path) -> Result<(), CustodianError> {
    fs::create_dir_all(workspace.join("sqlite"))?;
    let root = attachments_root(workspace);
    fs::create_dir_all(&root)?;
    fs::create_dir_all(root.join(ATTACH_SUBDIR_DRAFT))?;
    fs::create_dir_all(root.join(ATTACH_SUBDIR_PENDING))?;
    fs::create_dir_all(root.join(ATTACH_SUBDIR_SYNCED))?;
    migrate_attachments_flat_to_synced_layout(workspace)?;
    migrate_legacy_pending_upload_into_pending(workspace)?;
    Ok(())
}

/// Move historical `attachments/pending_upload/` files into `attachments/pending/` (layout no longer uses `pending_upload`).
fn migrate_legacy_pending_upload_into_pending(workspace: &Path) -> Result<(), CustodianError> {
    let root = attachments_root(workspace);
    let legacy = root.join("pending_upload");
    if !legacy.is_dir() {
        return Ok(());
    }
    let pending = root.join(ATTACH_SUBDIR_PENDING);
    fs::create_dir_all(&pending)?;
    let entries: Vec<_> = fs::read_dir(&legacy)?.flatten().collect();
    for entry in entries {
        if !entry.file_type()?.is_file() {
            continue;
        }
        let src = entry.path();
        let dest = pending.join(entry.file_name());
        if dest.exists() {
            fs::remove_file(&src)?;
            continue;
        }
        if fs::rename(&src, &dest).is_err() {
            fs::copy(&src, &dest)?;
            fs::remove_file(&src)?;
        }
    }
    let leftover: Vec<_> = fs::read_dir(&legacy)?.flatten().collect();
    if leftover.is_empty() {
        let _ = fs::remove_dir(&legacy);
    }
    Ok(())
}

/// One-shot: move loose files from `attachments/<name>` into `attachments/synced/<name>`.
fn migrate_attachments_flat_to_synced_layout(workspace: &Path) -> Result<(), CustodianError> {
    let root = attachments_root(workspace);
    if !root.is_dir() {
        return Ok(());
    }
    let synced = root.join(ATTACH_SUBDIR_SYNCED);
    fs::create_dir_all(&synced)?;
    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let path = entry.path();
        let dest = synced.join(entry.file_name());
        if !dest.exists() {
            fs::rename(&path, &dest)?;
        }
    }
    Ok(())
}

/// Local resolution: draft → outbound queue (`pending` before `synced`) → loose under `attachments/`.
fn resolve_attachment_path(workspace: &Path, basename: &str) -> Option<PathBuf> {
    let root = attachments_root(workspace);
    let candidates = [
        root.join(ATTACH_SUBDIR_DRAFT).join(basename),
        root.join(ATTACH_SUBDIR_PENDING).join(basename),
        root.join(ATTACH_SUBDIR_SYNCED).join(basename),
        root.join(basename),
    ];
    candidates.into_iter().find(|p| p.is_file())
}

fn attachment_path_synced(workspace: &Path, basename: &str) -> PathBuf {
    attachments_root(workspace)
        .join(ATTACH_SUBDIR_SYNCED)
        .join(basename)
}

fn attachment_path_pending(workspace: &Path, basename: &str) -> PathBuf {
    attachments_root(workspace)
        .join(ATTACH_SUBDIR_PENDING)
        .join(basename)
}

/// True when manifest-driven pull does not need a GET: synced/outbound queue already holds bytes.
/// Typical after pushing from this workspace before updating `last_attachment_version`.
pub(crate) fn skip_manifest_attachment_download(workspace: &Path, basename: &str) -> bool {
    [
        attachment_path_synced(workspace, basename),
        attachment_path_pending(workspace, basename),
    ]
    .into_iter()
    .any(|p| {
        fs::metadata(&p)
            .map(|m| m.is_file() && m.len() > 0)
            .unwrap_or(false)
    })
}

/// Read source for uploading to Synkronus: prefer outbound queue, then draft, then synced, then loose under `attachments/`.
fn first_path_for_attachment_upload(workspace: &Path, basename: &str) -> Option<PathBuf> {
    let root = attachments_root(workspace);
    let candidates = [
        root.join(ATTACH_SUBDIR_PENDING).join(basename),
        root.join(ATTACH_SUBDIR_DRAFT).join(basename),
        root.join(ATTACH_SUBDIR_SYNCED).join(basename),
        root.join(basename),
    ];
    candidates.into_iter().find(|p| p.is_file())
}

fn should_promote_upload_source_to_synced(workspace: &Path, src: &Path) -> bool {
    let pending = attachments_root(workspace).join(ATTACH_SUBDIR_PENDING);
    src.starts_with(&pending)
}

fn promote_uploaded_queue_file_to_synced(
    workspace: &Path,
    basename: &str,
    src: &Path,
) -> Result<(), CustodianError> {
    let dest = attachment_path_synced(workspace, basename);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    if dest.exists() {
        fs::remove_file(&dest).map_err(CustodianError::Io)?;
    }
    if fs::rename(src, &dest).is_ok() {
        return Ok(());
    }
    fs::copy(src, &dest).map_err(CustodianError::Io)?;
    fs::remove_file(src).map_err(CustodianError::Io)?;
    Ok(())
}

fn derived_database_path_for_profile(profile: &ServerProfile) -> Result<PathBuf, CustodianError> {
    let ws = profile
        .workspace_path
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or(CustodianError::WorkspaceMissing)?;
    Ok(sqlite_path_for_workspace(Path::new(ws)))
}

/// Normalize `database_path` from `workspace_path` and clear legacy `attachments_path`.
fn apply_workspace_derived_paths(profile: &mut ServerProfile) -> Result<(), CustodianError> {
    profile.attachments_path = None;
    let derived = derived_database_path_for_profile(profile)?;
    let old_path = PathBuf::from(profile.database_path.trim());
    if old_path != derived && old_path.exists() && !derived.exists() {
        if let Some(parent) = derived.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&old_path, &derived).map_err(|e| CustodianError::Message(e.to_string()))?;
    }
    profile.database_path = derived.to_string_lossy().to_string();
    Ok(())
}

fn infer_workspace_from_legacy_database_path(database_path: &str) -> Option<PathBuf> {
    let db = PathBuf::from(database_path.trim());
    let file_name = db.file_name()?.to_str()?;
    if file_name != "custodian.sqlite3" {
        return None;
    }
    let parent = db.parent()?;
    if parent.file_name()?.to_str()? == "sqlite" {
        return parent.parent().map(|p| p.to_path_buf());
    }
    Some(parent.to_path_buf())
}

/// Workspace root for attachment file counting — aligned with [`resolve_db_path`] / [`open_db`],
/// not only `profile.workspace_path` (which may be stale).
fn workspace_root_from_resolved_db_path(db_path: &Path) -> Option<PathBuf> {
    let s = db_path.to_string_lossy();
    if let Some(ws) = infer_workspace_from_legacy_database_path(s.trim()) {
        return Some(ws);
    }
    let mut cur = db_path.parent()?.to_path_buf();
    for _ in 0..12 {
        if cur.join("attachments").is_dir() {
            return Some(cur);
        }
        cur = cur.parent()?.to_path_buf();
    }
    None
}

/// Set `workspace_path` when missing by inferring from `database_path`, then derive DB path under `sqlite/`.
fn migrate_profile_workspace(profile: &mut ServerProfile) -> Result<(), CustodianError> {
    if profile
        .workspace_path
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
    {
        return apply_workspace_derived_paths(profile);
    }
    if let Some(ws) = infer_workspace_from_legacy_database_path(&profile.database_path) {
        profile.workspace_path = Some(ws.to_string_lossy().to_string());
        return apply_workspace_derived_paths(profile);
    }
    Ok(())
}

fn normalize_config_profiles(cfg: &mut AppConfigFile) -> Result<(), CustodianError> {
    for p in &mut cfg.profiles {
        migrate_profile_workspace(p)?;
    }
    Ok(())
}

fn ensure_active_workspace_dirs(ctx: &AppCtxHandle) -> Result<(), CustodianError> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock config".to_string()))?;
    let profile = active_profile_ref(&cfg)?;
    if let Some(ws) = profile.workspace_path.as_ref() {
        let trimmed = ws.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            fs::create_dir_all(&p)?;
            ensure_workspace_layout(&p)?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AuthSession {
    base_url: String,
    token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsResponse {
    active_profile_id: String,
    profiles: Vec<ServerProfile>,
    /// App data dir for constructing default per-profile DB paths in the UI.
    data_directory: String,
}

/// Global app state managed by Tauri (config, auth, SQLite lock, active sync).
struct AppCtx {
    config_path: PathBuf,
    data_dir: PathBuf,
    config: Mutex<AppConfigFile>,
    auth: Mutex<Option<AuthSession>>,
    /// Serializes SQLite access and workspace filesystem operations that require a quiesced DB.
    workspace_sqlite_lock: Mutex<()>,
    /// In-memory pause/cancel handles for the active sync worker (job row persists checkpoints).
    active_sync: Mutex<Option<sync_engine::ActiveSyncHandle>>,
    /// Coalesces overlapping observation-index rebuild jobs into one run (+ optional follow-up).
    index_rebuild_gate: Mutex<IndexRebuildGate>,
}

#[derive(Default)]
struct IndexRebuildGate {
    running: bool,
    pending: bool,
    current_job_id: Option<String>,
}

pub(crate) type AppCtxHandle = Arc<AppCtx>;

struct ScopedDb<'a> {
    _guard: std::sync::MutexGuard<'a, ()>,
    conn: Connection,
}

impl Deref for ScopedDb<'_> {
    type Target = Connection;

    fn deref(&self) -> &Connection {
        &self.conn
    }
}

impl DerefMut for ScopedDb<'_> {
    fn deref_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceItem {
    path: String,
    name: String,
    is_dir: bool,
}

/// Synkronus `Observation` fields stored as JSON (see `synkronus/openapi/synkronus.yaml` — Observation).
/// Row columns hold `observation_id`, `form_type`, `data` (payload), and `updated_at`; the rest live here.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ObservationExtras {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    form_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    deleted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    synced_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    geolocation: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    device_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationRecord {
    id: String,
    payload: Value,
    form_type: Option<String>,
    updated_at: Option<String>,
    remote_updated_at: Option<String>,
    dirty: bool,
    sync_status: SyncStatus,
    has_conflict_copy: bool,
    last_saved_at: String,
    last_pushed_at: Option<String>,
    extras: Option<ObservationExtras>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum SyncStatus {
    Clean,
    Dirty,
    Conflict,
}

impl From<&str> for SyncStatus {
    fn from(value: &str) -> Self {
        match value {
            "dirty" => Self::Dirty,
            "conflict" => Self::Conflict,
            _ => Self::Clean,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveObservationRequest {
    id: String,
    payload: Value,
    form_type: Option<String>,
    /// Synkronus `updated_at` (ISO 8601). If omitted, set to the save timestamp.
    updated_at: Option<String>,
    extras: Option<ObservationExtras>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiObservation {
    observation_id: String,
    data: Value,
    form_type: Option<String>,
    updated_at: Option<String>,
    #[serde(default)]
    extras: Option<ObservationExtras>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportResult {
    imported: usize,
    conflicts: usize,
    #[serde(default)]
    attachments_downloaded: usize,
    #[serde(default)]
    attachments_failed: usize,
    #[serde(default)]
    index_rebuild_scheduled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppHealth {
    workspace_path: Option<String>,
    db_path: String,
    total_observations: i64,
    /// Observations queued for push (`dirty = 1` and `sync_status = 'dirty'`). Conflicts use `sync_status = 'conflict'` and are counted in `conflict_count`.
    dirty_count: i64,
    /// Regular files across the local attachment layout (draft, synced, queues, loose under `attachments/`).
    total_attachment_count: i64,
    /// Regular files under `attachments/pending/` only (disk queue, not observation references).
    pending_attachment_count: i64,
    conflict_count: i64,
    last_save_at: Option<String>,
    last_pull_at: Option<String>,
    last_push_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutboundAttachmentUploadResult {
    uploaded: usize,
    skipped_conflicts: usize,
    /// Required extras (or queue entries) with no file on disk — skipped, no whole-run abort.
    skipped_missing: usize,
    failed: usize,
    error_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncLoginRequest {
    base_url: String,
    username: String,
    password: String,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn parse_observation_extras(raw: Option<String>) -> Option<ObservationExtras> {
    raw.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            return None;
        }
        serde_json::from_str(t).ok()
    })
}

fn parse_time(value: &Option<String>) -> Option<DateTime<Utc>> {
    value.as_ref().and_then(|v| {
        DateTime::parse_from_rfc3339(v)
            .ok()
            .map(|dt| dt.with_timezone(&Utc))
    })
}

fn should_mark_conflict(
    local_dirty: bool,
    local_remote: &Option<String>,
    incoming: &Option<String>,
) -> bool {
    if !local_dirty {
        return false;
    }

    match (parse_time(local_remote), parse_time(incoming)) {
        (Some(local), Some(remote)) => remote > local,
        (None, Some(_)) => true,
        _ => false,
    }
}

fn init_db(conn: &Connection) -> Result<(), CustodianError> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS observations (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            form_type TEXT,
            updated_at TEXT,
            remote_updated_at TEXT,
            dirty INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'clean',
            conflict_payload TEXT,
            last_saved_at TEXT NOT NULL,
            last_pushed_at TEXT,
            observation_extras TEXT
        );
        CREATE TABLE IF NOT EXISTS observation_history (
            backup_id TEXT PRIMARY KEY,
            observation_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_observations_dirty ON observations(dirty);
        CREATE INDEX IF NOT EXISTS idx_observations_sync_status ON observations(sync_status);
        CREATE INDEX IF NOT EXISTS idx_observations_form_type ON observations(form_type);
        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            last_pull_at TEXT,
            last_push_at TEXT,
            last_error TEXT
        );
        INSERT OR IGNORE INTO sync_state(id, last_pull_at, last_push_at, last_error) VALUES (1, NULL, NULL, NULL);
        "#,
    )?;
    migrate_sync_state_columns(conn)?;
    conn.execute(
        "INSERT OR IGNORE INTO sync_state(id, last_pull_at, last_push_at, last_error, repository_generation, observation_sync_version, last_attachment_version) VALUES (1, NULL, NULL, NULL, 0, 0, 0)",
        [],
    )?;
    migrate_repository_generation_fresh_install_defaults(conn)?;
    sync_engine::migrate_sync_jobs_db(conn).map_err(CustodianError::Sqlite)?;
    observation_index::migrate_index_schema(conn).map_err(CustodianError::Sqlite)?;
    Ok(())
}

fn bundle_app_config_path(ctx: &AppCtxHandle) -> Result<PathBuf, String> {
    let workspace = get_workspace_path(ctx).map_err(|e| e.to_string())?;
    let dev = profile_developer_mode(ctx)?;
    let seg = bundle_segment(dev);
    Ok(workspace
        .join("bundles")
        .join(seg)
        .join("app")
        .join("app.config.json"))
}

fn load_active_index_defs(ctx: &AppCtxHandle) -> Vec<observation_index::ObservationIndexDef> {
    bundle_app_config_path(ctx)
        .ok()
        .map(|p| observation_index::load_index_config(&p))
        .unwrap_or_default()
}

/// Older builds defaulted `repository_generation` to 1, which Synkronus treats as an explicit
/// epoch — fresh profiles then got HTTP 409 against servers at generation > 1. Generation `0`
/// means "not yet aligned" (omit epoch on pull/push like Formulus). Reset rows that still look
/// like the old default and have no synced data to `0`.
fn migrate_repository_generation_fresh_install_defaults(
    conn: &Connection,
) -> Result<(), rusqlite::Error> {
    let row = conn
        .query_row(
            "SELECT repository_generation, observation_sync_version, last_attachment_version FROM sync_state WHERE id = 1",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)),
        )
        .optional()?;
    let Some((repo, obs_ver, att_ver)) = row else {
        return Ok(());
    };
    if repo != 1 || obs_ver != 0 || att_ver != 0 {
        return Ok(());
    }
    let obs_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM observations", [], |row| row.get(0))?;
    if obs_count > 0 {
        return Ok(());
    }
    conn.execute(
        "UPDATE sync_state SET repository_generation = 0 WHERE id = 1",
        [],
    )?;
    Ok(())
}

fn migrate_sync_state_columns(conn: &Connection) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare("PRAGMA table_info(sync_state)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<_, _>>()?;
    if !cols.iter().any(|c| c == "repository_generation") {
        conn.execute(
            "ALTER TABLE sync_state ADD COLUMN repository_generation INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "observation_sync_version") {
        conn.execute(
            "ALTER TABLE sync_state ADD COLUMN observation_sync_version INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "last_attachment_version") {
        conn.execute(
            "ALTER TABLE sync_state ADD COLUMN last_attachment_version INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    Ok(())
}

fn default_app_config(data_dir: &Path) -> AppConfigFile {
    let id = Uuid::new_v4().to_string();
    let workspace_dir = data_dir.join("profiles").join(&id);
    let db_path = sqlite_path_for_workspace(&workspace_dir);
    AppConfigFile {
        schema_version: 3,
        active_profile_id: id.clone(),
        profiles: vec![ServerProfile {
            id,
            label: "Default".to_string(),
            server_url: String::new(),
            username: None,
            workspace_path: Some(workspace_dir.to_string_lossy().to_string()),
            database_path: db_path.to_string_lossy().to_string(),
            attachments_path: None,
            default_app_mode: DefaultAppMode::default(),
            custom_app_developer_mode: false,
            custom_app_local_folder: None,
        }],
    }
}

fn migrate_legacy_workspace(workspace_path: &str, _data_dir: &Path) -> AppConfigFile {
    let id = Uuid::new_v4().to_string();
    let ws = PathBuf::from(workspace_path);
    let db = sqlite_path_for_workspace(&ws);
    AppConfigFile {
        schema_version: 3,
        active_profile_id: id.clone(),
        profiles: vec![ServerProfile {
            id,
            label: "Default".to_string(),
            server_url: String::new(),
            username: None,
            workspace_path: Some(workspace_path.to_string()),
            database_path: db.to_string_lossy().to_string(),
            attachments_path: None,
            default_app_mode: DefaultAppMode::default(),
            custom_app_developer_mode: false,
            custom_app_local_folder: None,
        }],
    }
}

fn load_app_config(path: &Path, data_dir: &Path) -> AppConfigFile {
    let mut cfg = load_app_config_inner(path, data_dir);
    let _ = normalize_config_profiles(&mut cfg);
    cfg
}

fn load_app_config_inner(path: &Path, data_dir: &Path) -> AppConfigFile {
    let raw = match fs::read_to_string(path) {
        Ok(r) => r,
        Err(_) => return default_app_config(data_dir),
    };
    if raw.trim().is_empty() {
        return default_app_config(data_dir);
    }
    let v: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return default_app_config(data_dir),
    };
    if v.get("profiles")
        .and_then(|x| x.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false)
    {
        return serde_json::from_value(v).unwrap_or_else(|_| default_app_config(data_dir));
    }
    if let Some(wp) = v.get("workspacePath").and_then(|x| x.as_str()) {
        return migrate_legacy_workspace(wp, data_dir);
    }
    default_app_config(data_dir)
}

fn resolve_db_path(ctx: &AppCtxHandle) -> Result<PathBuf, CustodianError> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock config".to_string()))?;
    let profile = active_profile_ref(&cfg)?;
    match derived_database_path_for_profile(profile) {
        Ok(p) => Ok(p),
        Err(CustodianError::WorkspaceMissing) => {
            let p = profile.database_path.trim();
            if p.is_empty() {
                Err(CustodianError::Message(
                    "workspace path is not configured".to_string(),
                ))
            } else {
                Ok(PathBuf::from(p))
            }
        }
        Err(e) => Err(e),
    }
}

fn open_db(ctx: &AppCtxHandle) -> Result<ScopedDb<'_>, CustodianError> {
    let guard = ctx
        .workspace_sqlite_lock
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock workspace sqlite".to_string()))?;
    let db_path = resolve_db_path(ctx)?;
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&db_path)?;
    init_db(&conn)?;
    Ok(ScopedDb {
        _guard: guard,
        conn,
    })
}

/// Caller must hold `workspace_sqlite_lock`. Opens the DB, checkpoints WAL, then closes.
fn quiesce_sqlite_unlocked(ctx: &AppCtxHandle) -> Result<(), CustodianError> {
    let db_path = resolve_db_path(ctx)?;
    if !db_path.exists() {
        return Ok(());
    }
    let conn = Connection::open(&db_path)?;
    init_db(&conn)?;
    conn.execute_batch("PRAGMA wal_checkpoint(FULL);")?;
    Ok(())
}

/// Lock + checkpoint so filesystem copies/moves see a consistent DB; runs `f` while still holding the lock.
fn with_workspace_fs_exclusive<T, F>(ctx: &AppCtxHandle, f: F) -> Result<T, CustodianError>
where
    F: FnOnce(&AppCtxHandle) -> Result<T, CustodianError>,
{
    let _guard = ctx
        .workspace_sqlite_lock
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock workspace sqlite".to_string()))?;
    quiesce_sqlite_unlocked(ctx)?;
    f(ctx)
}

fn path_is_strict_descendant(ancestor: &Path, maybe_desc: &Path) -> bool {
    let a = ancestor.components();
    let mut b = maybe_desc.components();
    for ac in a {
        match b.next() {
            Some(bc) if bc == ac => continue,
            _ => return false,
        }
    }
    b.next().is_some()
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), CustodianError> {
    copy_dir_recursive_counting(src, dst, &mut 0)
}

fn should_skip_mirror_entry(name: &str) -> bool {
    matches!(name, ".DS_Store" | "Thumbs.db" | "desktop.ini")
}

fn copy_dir_recursive_counting(
    src: &Path,
    dst: &Path,
    copied_files: &mut u64,
) -> Result<(), CustodianError> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if should_skip_mirror_entry(name_str.as_ref()) {
            continue;
        }
        let path = entry.path();
        let target = dst.join(&name);
        if path.is_dir() {
            copy_dir_recursive_counting(&path, &target, copied_files)?;
        } else {
            fs::copy(&path, &target)?;
            *copied_files += 1;
        }
    }
    Ok(())
}

const CUSTOM_APP_DEV_MIRROR_INDEX_REL: &str = "bundles/dev-local/app/index.html";

fn validate_custom_app_dev_source_folder(source: &Path) -> Result<(), String> {
    if !source.exists() {
        return Err(format!("local folder does not exist: {}", source.display()));
    }
    if !source.is_dir() {
        return Err("local folder must be a directory".to_string());
    }
    let index = source.join("index.html");
    if !index.is_file() {
        return Err("local folder must contain index.html".to_string());
    }
    Ok(())
}

fn mirror_custom_app_dev_folder(ws: &Path, source: &Path) -> Result<u64, CustodianError> {
    validate_custom_app_dev_source_folder(source).map_err(CustodianError::Message)?;
    let dev_local = ws.join("bundles/dev-local");
    if dev_local.exists() {
        fs::remove_dir_all(&dev_local)?;
    }
    let mirror_app = dev_local.join("app");
    let mut copied_files = 0u64;
    copy_dir_recursive_counting(source, &mirror_app, &mut copied_files)?;
    let mirrored_index = mirror_app.join("index.html");
    if !mirrored_index.is_file() {
        return Err(CustodianError::Message(
            "mirror failed: index.html missing after copy".to_string(),
        ));
    }
    let forms_src = source.join("forms");
    if forms_src.is_dir() {
        let mirror_forms = dev_local.join("forms");
        copy_dir_recursive_counting(&forms_src, &mirror_forms, &mut copied_files)?;
    }
    let mirror_qt = mirror_app.join("question_types");
    if !mirror_qt.is_dir() {
        let qt_candidates = [
            source.join("question_types"),
            source.join("public").join("question_types"),
            source.join("..").join("public").join("question_types"),
            source.join("..").join("..").join("question_types"),
        ];
        for qt_src in qt_candidates {
            if qt_src.is_dir() {
                copy_dir_recursive_counting(&qt_src, &mirror_qt, &mut copied_files)?;
                break;
            }
        }
    }
    Ok(copied_files)
}

fn profile_developer_mode(ctx: &AppCtxHandle) -> Result<bool, String> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| "failed to lock config".to_string())?;
    let profile = active_profile_ref(&cfg).map_err(|e: CustodianError| e.to_string())?;
    Ok(profile.custom_app_developer_mode)
}

fn bundle_segment(dev: bool) -> &'static str {
    if dev { "dev-local" } else { "active" }
}

fn bundle_form_roots(workspace: &Path, dev: bool) -> Vec<PathBuf> {
    let seg = bundle_segment(dev);
    vec![
        workspace.join("bundles").join(seg).join("forms"),
        workspace
            .join("bundles")
            .join(seg)
            .join("app")
            .join("forms"),
    ]
}

fn bundle_form_roots_for_ctx(ctx: &AppCtxHandle) -> Result<Vec<PathBuf>, String> {
    let ws = get_workspace_path(ctx).map_err(|e| e.to_string())?;
    let dev = profile_developer_mode(ctx)?;
    Ok(bundle_form_roots(&ws, dev))
}

fn bundle_relative_dirs_for_ctx(
    ctx: &AppCtxHandle,
    suffixes: &[&str],
) -> Result<Vec<String>, String> {
    let dev = profile_developer_mode(ctx)?;
    let seg = bundle_segment(dev);
    Ok(suffixes
        .iter()
        .map(|s| format!("bundles/{seg}/{s}"))
        .collect())
}

fn rename_or_move_entry(src: &Path, dst: &Path) -> Result<(), CustodianError> {
    if fs::rename(src, dst).is_err() {
        if src.is_dir() {
            copy_dir_recursive(src, dst)?;
            fs::remove_dir_all(src)?;
        } else {
            if let Some(p) = dst.parent() {
                fs::create_dir_all(p)?;
            }
            fs::copy(src, dst)?;
            fs::remove_file(src)?;
        }
    }
    Ok(())
}

fn validate_move_destination(src: &Path, dest: &Path) -> Result<(), CustodianError> {
    let src_canon = src
        .canonicalize()
        .map_err(|e| CustodianError::Message(e.to_string()))?;
    if path_is_strict_descendant(&src_canon, dest) {
        return Err(CustodianError::Message(
            "destination cannot be inside the workspace".to_string(),
        ));
    }
    if dest.exists() {
        if !dest.is_dir() {
            return Err(CustodianError::Message(
                "destination must be a directory".to_string(),
            ));
        }
        let dest_canon = dest
            .canonicalize()
            .map_err(|e| CustodianError::Message(e.to_string()))?;
        if src_canon == dest_canon {
            return Err(CustodianError::Message(
                "destination is the same as workspace".to_string(),
            ));
        }
        if dest_canon.starts_with(&src_canon) {
            return Err(CustodianError::Message(
                "destination cannot be inside the workspace".to_string(),
            ));
        }
        if src_canon.starts_with(&dest_canon) {
            return Err(CustodianError::Message(
                "workspace cannot be inside destination".to_string(),
            ));
        }
    } else if path_is_strict_descendant(&src_canon, dest) {
        return Err(CustodianError::Message(
            "destination cannot be inside the workspace".to_string(),
        ));
    }
    Ok(())
}

fn backup_workspace_zip(ctx: &AppCtxHandle, zip_path: &Path) -> Result<(), CustodianError> {
    let ws = get_workspace_path(ctx)?;
    let file = fs::File::create(zip_path)?;
    let mut zip = ZipWriter::new(BufWriter::new(file));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in WalkDir::new(&ws).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        let rel = path
            .strip_prefix(&ws)
            .map_err(|e| CustodianError::Message(e.to_string()))?;
        let name = rel.to_string_lossy();
        if name.ends_with(".sqlite3-wal") || name.ends_with(".sqlite3-shm") {
            continue;
        }
        zip.start_file(name.as_ref(), options)
            .map_err(|e| CustodianError::Message(e.to_string()))?;
        let mut f = fs::File::open(path)?;
        std::io::copy(&mut f, &mut zip).map_err(|e| CustodianError::Message(e.to_string()))?;
    }
    zip.finish()
        .map_err(|e| CustodianError::Message(e.to_string()))?;
    Ok(())
}

fn sanitize_version_for_filename(version: &str) -> String {
    let s: String = version
        .trim()
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '-' | '_' | '+' => c,
            _ => '_',
        })
        .collect();
    if s.is_empty() {
        "unknown".to_string()
    } else {
        s
    }
}

fn format_byte_progress_mb(done: i64, total: i64) -> String {
    const MB: f64 = 1024.0 * 1024.0;
    if total > 0 {
        format!("{:.1} / {:.1} MB", done as f64 / MB, total as f64 / MB)
    } else {
        format!("{:.1} MB", done as f64 / MB)
    }
}

fn emit_bundle_apply_progress(
    app: &tauri::AppHandle,
    job_id: &str,
    phase: &str,
    done: i64,
    total: i64,
    message: &str,
    detail: Option<&str>,
) {
    let _ = app.emit(
        "bundle/apply-progress",
        BundleApplyProgressEvent {
            job_id: job_id.to_string(),
            phase: phase.to_string(),
            done,
            total,
            message: message.to_string(),
            detail: detail.map(|s| s.to_string()),
        },
    );
}

fn emit_bundle_index_rebuild_progress(
    app: &tauri::AppHandle,
    job_id: &str,
    phase: &str,
    done: i64,
    total: i64,
    message: &str,
    detail: Option<&str>,
) {
    let _ = app.emit(
        "bundle/index-rebuild",
        BundleApplyProgressEvent {
            job_id: job_id.to_string(),
            phase: phase.to_string(),
            done,
            total,
            message: message.to_string(),
            detail: detail.map(|s| s.to_string()),
        },
    );
}

type BundleExtractProgress<'a> = dyn FnMut(i64, i64, Option<&str>) + 'a;

#[allow(dead_code)]
fn extract_zip_to_dir(zip_bytes: &[u8], dest: &Path) -> Result<(), CustodianError> {
    extract_zip_to_dir_with_progress(zip_bytes, dest, None)
}

fn extract_zip_to_dir_with_progress(
    zip_bytes: &[u8],
    dest: &Path,
    mut on_progress: Option<&mut BundleExtractProgress<'_>>,
) -> Result<(), CustodianError> {
    let reader = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| CustodianError::Message(format!("invalid zip: {}", e)))?;
    let total = archive.len() as i64;
    if let Some(ref mut cb) = on_progress {
        cb(0, total, None);
    }
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| CustodianError::Message(format!("zip entry: {}", e)))?;
        let rel = match file.enclosed_name() {
            Some(p) => p.to_owned(),
            None => continue,
        };
        let outpath = dest.join(&rel);
        if file.is_dir() || file.name().ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| CustodianError::Message(e.to_string()))?;
        }
        let done = (i + 1) as i64;
        if let Some(ref mut cb) = on_progress {
            let emit = done == total || done % 10 == 0;
            if emit {
                let detail = rel.to_string_lossy();
                cb(done, total, Some(detail.as_ref()));
            }
        }
    }
    Ok(())
}

fn apply_app_bundle_zip_at_workspace(
    ws: &Path,
    version: &str,
    hash: &str,
    zip_bytes: &[u8],
    on_extract_progress: Option<&mut BundleExtractProgress<'_>>,
) -> Result<AppBundleState, CustodianError> {
    let ver = version.trim();
    if ver.is_empty() {
        return Err(CustodianError::Message("version is required".to_string()));
    }
    let hash = hash.trim();
    if hash.is_empty() {
        return Err(CustodianError::Message("hash is required".to_string()));
    }
    if zip_bytes.is_empty() {
        return Err(CustodianError::Message("zip is empty".to_string()));
    }
    let bundles = ws.join("bundles");
    let archives_dir = bundles.join("archives");
    let active_dir = bundles.join("active");
    fs::create_dir_all(&archives_dir)?;
    let prev = read_app_bundle_state_unlocked(&bundles)?;
    let mut archived = prev
        .as_ref()
        .map(|s| s.archived_versions.clone())
        .unwrap_or_default();
    if !archived.iter().any(|v| v == ver) {
        archived.push(ver.to_string());
    }
    archived.sort();
    let sanit = sanitize_version_for_filename(ver);
    let archive_zip = archives_dir.join(format!("{sanit}.zip"));
    fs::write(&archive_zip, zip_bytes)?;
    if active_dir.exists() {
        fs::remove_dir_all(&active_dir)?;
    }
    fs::create_dir_all(&active_dir)?;
    if let Some(cb) = on_extract_progress {
        extract_zip_to_dir_with_progress(zip_bytes, &active_dir, Some(cb))?;
    } else {
        extract_zip_to_dir_with_progress(zip_bytes, &active_dir, None)?;
    }
    let state = AppBundleState {
        schema_version: 1,
        active_version: ver.to_string(),
        active_hash: hash.to_string(),
        downloaded_at: Utc::now().to_rfc3339(),
        archived_versions: archived,
    };
    let state_path = bundles.join("state.json");
    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        &state_path,
        serde_json::to_string_pretty(&state).map_err(|e| CustodianError::Message(e.to_string()))?,
    )?;
    let legacy = bundles.join("app-bundle.zip");
    if legacy.exists() {
        let _ = fs::remove_file(&legacy);
    }
    Ok(state)
}

fn apply_app_bundle_zip_bytes(
    app: &tauri::AppHandle,
    job_id: &str,
    ctx: &AppCtxHandle,
    version: &str,
    hash: &str,
    zip_bytes: &[u8],
) -> Result<AppBundleState, CustodianError> {
    emit_bundle_apply_progress(app, job_id, "archiving", 0, 1, "Saving archive…", None);
    let app_c = app.clone();
    let job = job_id.to_string();
    let state = with_workspace_fs_exclusive(ctx, |ctx| {
        let ws = get_workspace_path(ctx)?;
        emit_bundle_apply_progress(&app_c, &job, "archiving", 1, 1, "Saving archive…", None);
        emit_bundle_apply_progress(&app_c, &job, "extracting", 0, 0, "Extracting bundle…", None);
        let mut extract_cb = |done: i64, total: i64, detail: Option<&str>| {
            emit_bundle_apply_progress(
                &app_c,
                &job,
                "extracting",
                done,
                total,
                "Extracting bundle…",
                detail,
            );
        };
        apply_app_bundle_zip_at_workspace(&ws, version, hash, zip_bytes, Some(&mut extract_cb))
    })?;
    Ok(state)
}

async fn download_synkronus_app_bundle_zip(
    app: &tauri::AppHandle,
    job_id: &str,
    base_url: &str,
    bearer_token: &str,
    x_ode_version: &str,
) -> Result<Vec<u8>, CustodianError> {
    let url = format!(
        "{}/api/app-bundle/download-zip",
        base_url.trim().trim_end_matches('/')
    );
    let parsed =
        Url::parse(&url).map_err(|e| CustodianError::Message(format!("invalid URL: {e}")))?;
    let client = reqwest::Client::new();
    let res = client
        .get(parsed)
        .header(AUTHORIZATION, format!("Bearer {}", bearer_token.trim()))
        .header("x-ode-version", x_ode_version.trim())
        .send()
        .await?;
    if !res.status().is_success() {
        return Err(CustodianError::Message(format!(
            "bundle download failed: HTTP {}",
            res.status()
        )));
    }
    let total_bytes = res.content_length().map(|n| n as i64).unwrap_or(0);
    emit_bundle_apply_progress(
        app,
        job_id,
        "downloading",
        0,
        total_bytes,
        "Downloading bundle from server…",
        None,
    );
    let mut buf = Vec::new();
    let mut received: i64 = 0;
    let mut last_emit = Instant::now();
    let mut last_emit_bytes: i64 = 0;
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        received += chunk.len() as i64;
        buf.extend_from_slice(&chunk);
        let elapsed = last_emit.elapsed();
        let bytes_since = received - last_emit_bytes;
        if elapsed >= Duration::from_millis(250) || bytes_since >= 512 * 1024 {
            emit_bundle_apply_progress(
                app,
                job_id,
                "downloading",
                received,
                total_bytes,
                "Downloading bundle from server…",
                Some(&format_byte_progress_mb(received, total_bytes)),
            );
            last_emit = Instant::now();
            last_emit_bytes = received;
        }
    }
    emit_bundle_apply_progress(
        app,
        job_id,
        "downloading",
        received,
        total_bytes.max(received),
        "Downloading bundle from server…",
        Some(&format_byte_progress_mb(
            received,
            total_bytes.max(received),
        )),
    );
    if buf.is_empty() {
        return Err(CustodianError::Message("zip is empty".to_string()));
    }
    Ok(buf)
}

fn spawn_observation_index_rebuild(app: tauri::AppHandle, ctx: AppCtxHandle, job_id: String) {
    {
        let gate = ctx
            .index_rebuild_gate
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let is_active = gate.running && gate.current_job_id.as_deref() == Some(job_id.as_str());
        if !is_active {
            eprintln!("[observation_index] skip rebuild spawn for inactive job_id={job_id}");
            return;
        }
    }

    tauri::async_runtime::spawn_blocking(move || {
        struct IndexRebuildRunGuard {
            ctx: AppCtxHandle,
            app: tauri::AppHandle,
        }

        impl Drop for IndexRebuildRunGuard {
            fn drop(&mut self) {
                let _ = finish_index_rebuild_gate(&self.ctx, &self.app);
            }
        }

        let _run_guard = IndexRebuildRunGuard {
            ctx: ctx.clone(),
            app: app.clone(),
        };

        let app_config = match bundle_app_config_path(&ctx) {
            Ok(p) if p.exists() => p,
            _ => return,
        };
        let defs = observation_index::load_index_config(&app_config);
        if defs.is_empty() {
            return;
        }
        let conn = match open_db(&ctx) {
            Ok(c) => c,
            Err(err) => {
                emit_bundle_index_rebuild_progress(
                    &app,
                    &job_id,
                    "failed",
                    0,
                    0,
                    "Rebuilding observation indexes…",
                    Some(&err.to_string()),
                );
                return;
            }
        };
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM observations", [], |r| r.get(0))
            .unwrap_or(0);
        emit_bundle_index_rebuild_progress(
            &app,
            &job_id,
            "indexing",
            0,
            total.max(1),
            "Indexing observations…",
            None,
        );
        let mut progress_cb = |done: i64, tot: i64, phase: Option<&str>| {
            emit_bundle_index_rebuild_progress(
                &app,
                &job_id,
                "indexing",
                done,
                tot,
                phase.unwrap_or("Indexing observations…"),
                None,
            );
        };
        match observation_index::rebuild_all_indexes(&conn, &defs, Some(&mut progress_cb)) {
            Ok(_) => emit_bundle_index_rebuild_progress(
                &app,
                &job_id,
                "completed",
                total,
                total.max(1),
                "Observation indexes rebuilt.",
                None,
            ),
            Err(err) => emit_bundle_index_rebuild_progress(
                &app,
                &job_id,
                "failed",
                0,
                0,
                "Rebuilding observation indexes…",
                Some(&err.to_string()),
            ),
        }
    });
}

/// Marks the active rebuild finished; runs one coalesced follow-up if requests arrived mid-flight.
fn finish_index_rebuild_gate(ctx: &AppCtxHandle, app: &tauri::AppHandle) -> Option<String> {
    let follow_up = {
        let mut gate = ctx
            .index_rebuild_gate
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        gate.running = false;
        if gate.pending {
            gate.pending = false;
            let job_id = Uuid::new_v4().to_string();
            gate.running = true;
            gate.current_job_id = Some(job_id.clone());
            Some(job_id)
        } else {
            gate.current_job_id = None;
            None
        }
    };
    if let Some(job_id) = follow_up {
        spawn_observation_index_rebuild(app.clone(), ctx.clone(), job_id.clone());
        Some(job_id)
    } else {
        None
    }
}

/// Starts a background full index rebuild when the active bundle declares indexes.
fn schedule_observation_index_rebuild(
    app: &tauri::AppHandle,
    ctx: &AppCtxHandle,
) -> Option<String> {
    let app_config = bundle_app_config_path(ctx).ok().filter(|p| p.exists())?;
    let defs = observation_index::load_index_config(&app_config);
    if defs.is_empty() {
        return None;
    }
    let mut gate = ctx
        .index_rebuild_gate
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if gate.running {
        gate.pending = true;
        return gate.current_job_id.clone();
    }
    let job_id = Uuid::new_v4().to_string();
    gate.running = true;
    gate.pending = false;
    gate.current_job_id = Some(job_id.clone());
    drop(gate);
    spawn_observation_index_rebuild(app.clone(), ctx.clone(), job_id.clone());
    Some(job_id)
}

fn read_app_bundle_state_unlocked(
    bundles_root: &Path,
) -> Result<Option<AppBundleState>, CustodianError> {
    let path = bundles_root.join("state.json");
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)?;
    let v: AppBundleState =
        serde_json::from_str(&raw).map_err(|e| CustodianError::Message(e.to_string()))?;
    Ok(Some(v))
}

fn persist_config(ctx: &AppCtxHandle) -> Result<(), CustodianError> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock config".to_string()))?
        .clone();
    if let Some(parent) = ctx.config_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&ctx.config_path, serde_json::to_string_pretty(&cfg)?)?;
    Ok(())
}

fn active_profile_ref(cfg: &AppConfigFile) -> Result<&ServerProfile, CustodianError> {
    let id = &cfg.active_profile_id;
    cfg.profiles
        .iter()
        .find(|p| p.id == *id)
        .ok_or_else(|| CustodianError::Message("active profile not found".to_string()))
}

fn active_profile_mut(cfg: &mut AppConfigFile) -> Result<&mut ServerProfile, CustodianError> {
    let id = cfg.active_profile_id.clone();
    cfg.profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| CustodianError::Message("active profile not found".to_string()))
}

fn get_workspace_path(ctx: &AppCtxHandle) -> Result<PathBuf, CustodianError> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock config".to_string()))?;
    let profile = active_profile_ref(&cfg)?;
    let value = profile
        .workspace_path
        .clone()
        .ok_or(CustodianError::WorkspaceMissing)?;
    Ok(PathBuf::from(value))
}

fn resolve_workspace_path(
    ctx: &AppCtxHandle,
    relative: Option<String>,
) -> Result<PathBuf, CustodianError> {
    let workspace = get_workspace_path(ctx)?;
    let candidate = match relative {
        Some(rel) if !rel.is_empty() => workspace.join(rel),
        _ => workspace.clone(),
    };
    let canonical_workspace = workspace.canonicalize().unwrap_or(workspace);
    let canonical_candidate = candidate.canonicalize().unwrap_or(candidate);

    if !canonical_candidate.starts_with(&canonical_workspace) {
        return Err(CustodianError::PathOutsideWorkspace);
    }
    Ok(canonical_candidate)
}

fn serialize_observation_extras(
    extras: &Option<ObservationExtras>,
) -> Result<Option<String>, CustodianError> {
    match extras {
        Some(e) => Ok(Some(serde_json::to_string(e)?)),
        None => Ok(None),
    }
}

fn upsert_observation_from_api(
    conn: &Connection,
    incoming: &ApiObservation,
) -> Result<bool, CustodianError> {
    let existing: Option<(bool, Option<String>, String)> = conn
        .query_row(
            "SELECT dirty, remote_updated_at, payload FROM observations WHERE id = ?1",
            params![incoming.observation_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)? == 1,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;

    let payload = serde_json::to_string(&incoming.data)?;
    let timestamp = now_iso();
    let extras_json = serialize_observation_extras(&incoming.extras)?;

    if let Some((local_dirty, local_remote_updated_at, local_payload)) = existing {
        if should_mark_conflict(local_dirty, &local_remote_updated_at, &incoming.updated_at) {
            conn.execute(
                "UPDATE observations
                 SET sync_status = 'conflict',
                     conflict_payload = ?1,
                     remote_updated_at = ?2,
                     last_saved_at = ?3
                 WHERE id = ?4",
                params![
                    payload,
                    incoming.updated_at,
                    timestamp,
                    incoming.observation_id
                ],
            )?;
            return Ok(true);
        }

        if local_dirty {
            // Last write wins in favor of local data while dirty; keep remote timestamp updated.
            conn.execute(
                "UPDATE observations
                 SET remote_updated_at = ?1,
                     updated_at = ?2,
                     form_type = COALESCE(?3, form_type),
                     payload = ?4
                 WHERE id = ?5",
                params![
                    incoming.updated_at,
                    incoming.updated_at,
                    incoming.form_type,
                    local_payload,
                    incoming.observation_id
                ],
            )?;
        } else {
            conn.execute(
                "UPDATE observations
                 SET payload = ?1,
                     form_type = ?2,
                     updated_at = ?3,
                     remote_updated_at = ?3,
                     dirty = 0,
                     sync_status = 'clean',
                     conflict_payload = NULL,
                     last_saved_at = ?4,
                     observation_extras = COALESCE(?5, observation_extras)
                 WHERE id = ?6",
                params![
                    payload,
                    incoming.form_type,
                    incoming.updated_at,
                    timestamp,
                    extras_json,
                    incoming.observation_id
                ],
            )?;
        }
        return Ok(false);
    }

    conn.execute(
        "INSERT INTO observations (
            id, payload, form_type, updated_at, remote_updated_at,
            dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
         ) VALUES (?1, ?2, ?3, ?4, ?4, 0, 'clean', NULL, ?5, NULL, ?6)",
        params![
            incoming.observation_id,
            payload,
            incoming.form_type,
            incoming.updated_at,
            timestamp,
            extras_json
        ],
    )?;
    Ok(false)
}

/// Inserts or updates from a user file import: rows must be pending push (dirty), not server-clean.
fn upsert_observation_from_local_import(
    conn: &Connection,
    incoming: &ApiObservation,
) -> Result<(), CustodianError> {
    let existing: Option<()> = conn
        .query_row(
            "SELECT 1 FROM observations WHERE id = ?1",
            params![incoming.observation_id],
            |_| Ok(()),
        )
        .optional()?;

    let payload = serde_json::to_string(&incoming.data)?;
    let timestamp = now_iso();
    let updated = incoming
        .updated_at
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| timestamp.clone());
    let extras_json = serialize_observation_extras(&incoming.extras)?;

    if existing.is_some() {
        conn.execute(
            "UPDATE observations SET
                payload = ?1,
                form_type = ?2,
                updated_at = ?3,
                dirty = 1,
                sync_status = 'dirty',
                conflict_payload = NULL,
                last_saved_at = ?4,
                observation_extras = COALESCE(?5, observation_extras)
             WHERE id = ?6",
            params![
                payload,
                incoming.form_type,
                updated,
                timestamp,
                extras_json,
                incoming.observation_id
            ],
        )?;
    } else {
        conn.execute(
            "INSERT INTO observations (
                id, payload, form_type, updated_at, remote_updated_at,
                dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             ) VALUES (?1, ?2, ?3, ?4, NULL, 1, 'dirty', NULL, ?5, NULL, ?6)",
            params![
                incoming.observation_id,
                payload,
                incoming.form_type,
                updated,
                timestamp,
                extras_json
            ],
        )?;
    }
    Ok(())
}

#[tauri::command]
fn get_settings(ctx: tauri::State<'_, AppCtxHandle>) -> Result<SettingsResponse, String> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| "failed to lock config".to_string())?;
    Ok(SettingsResponse {
        active_profile_id: cfg.active_profile_id.clone(),
        profiles: cfg.profiles.clone(),
        data_directory: ctx.data_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn set_active_profile(
    profile_id: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    {
        let mut cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        if !cfg.profiles.iter().any(|p| p.id == profile_id) {
            return Err("profile not found".to_string());
        }
        cfg.active_profile_id = profile_id;
    }
    persist_config(&ctx).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn upsert_profile(
    mut profile: ServerProfile,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    if profile
        .workspace_path
        .as_ref()
        .map(|s| s.trim().is_empty())
        .unwrap_or(true)
    {
        return Err("workspacePath is required".to_string());
    }
    apply_workspace_derived_paths(&mut profile).map_err(|e| e.to_string())?;
    let ws = PathBuf::from(profile.workspace_path.as_ref().unwrap().trim());
    fs::create_dir_all(&ws).map_err(|e| e.to_string())?;
    ensure_workspace_layout(&ws).map_err(|e| e.to_string())?;
    {
        let mut cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        if let Some(i) = cfg.profiles.iter().position(|p| p.id == profile.id) {
            cfg.profiles[i] = profile;
        } else {
            cfg.profiles.push(profile);
        }
    }
    persist_config(&ctx).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_profile(profile_id: String, ctx: tauri::State<'_, AppCtxHandle>) -> Result<(), String> {
    {
        let mut cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        if cfg.profiles.len() <= 1 {
            return Err("cannot delete the last profile".to_string());
        }
        cfg.profiles.retain(|p| p.id != profile_id);
        if cfg.active_profile_id == profile_id {
            cfg.active_profile_id = cfg.profiles[0].id.clone();
        }
    }
    let _ = credential_delete_internal(&profile_id);
    persist_config(&ctx).map_err(|err| err.to_string())?;
    Ok(())
}

fn credential_entry(profile_id: &str) -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, profile_id).map_err(|e| e.to_string())
}

fn credential_delete_internal(profile_id: &str) -> Result<(), String> {
    let entry = credential_entry(profile_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CredentialGetResult {
    password: Option<String>,
    /// False when the OS secure store cannot be used (e.g. Linux without Secret Service).
    storage_available: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CredentialSetResult {
    saved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CredentialDeleteResult {
    cleared: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    warning: Option<String>,
}

#[tauri::command]
fn credential_set(
    profile_id: String,
    password: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<CredentialSetResult, String> {
    let _ = &ctx;
    let entry = match credential_entry(&profile_id) {
        Ok(e) => e,
        Err(msg) => {
            return Ok(CredentialSetResult {
                saved: false,
                warning: Some(format!(
                    "Password was not saved (secure storage unavailable): {msg}"
                )),
            });
        }
    };
    match entry.set_password(&password) {
        Ok(()) => Ok(CredentialSetResult {
            saved: true,
            warning: None,
        }),
        Err(e) => Ok(CredentialSetResult {
            saved: false,
            warning: Some(format!(
                "Password was not saved (secure storage unavailable): {e}"
            )),
        }),
    }
}

#[tauri::command]
fn credential_get(
    profile_id: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<CredentialGetResult, String> {
    let _ = &ctx;
    let entry = match credential_entry(&profile_id) {
        Err(_) => {
            return Ok(CredentialGetResult {
                password: None,
                storage_available: false,
            });
        }
        Ok(e) => e,
    };
    match entry.get_password() {
        Ok(p) => Ok(CredentialGetResult {
            password: Some(p),
            storage_available: true,
        }),
        Err(keyring::Error::NoEntry) => Ok(CredentialGetResult {
            password: None,
            storage_available: true,
        }),
        Err(_) => Ok(CredentialGetResult {
            password: None,
            storage_available: false,
        }),
    }
}

#[tauri::command]
fn credential_delete(
    profile_id: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<CredentialDeleteResult, String> {
    let _ = &ctx;
    let entry = match credential_entry(&profile_id) {
        Err(msg) => {
            return Ok(CredentialDeleteResult {
                cleared: false,
                warning: Some(msg),
            });
        }
        Ok(e) => e,
    };
    match entry.delete_credential() {
        Ok(()) => Ok(CredentialDeleteResult {
            cleared: true,
            warning: None,
        }),
        Err(keyring::Error::NoEntry) => Ok(CredentialDeleteResult {
            cleared: true,
            warning: None,
        }),
        Err(e) => Ok(CredentialDeleteResult {
            cleared: false,
            warning: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
fn get_workspace(ctx: tauri::State<'_, AppCtxHandle>) -> Result<Option<String>, String> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| "failed to lock config".to_string())?;
    let profile = active_profile_ref(&cfg).map_err(|e: CustodianError| e.to_string())?;
    Ok(profile.workspace_path.clone())
}

#[tauri::command]
fn set_workspace(path: String, ctx: tauri::State<'_, AppCtxHandle>) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err("workspace path does not exist".to_string());
    }
    if !path_buf.is_dir() {
        return Err("workspace path must be a directory".to_string());
    }

    {
        let mut cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        let profile = active_profile_mut(&mut cfg).map_err(|e: CustodianError| e.to_string())?;
        profile.workspace_path = Some(path);
        apply_workspace_derived_paths(profile).map_err(|e| e.to_string())?;
    }
    let workspace = {
        let cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        let profile = active_profile_ref(&cfg).map_err(|e: CustodianError| e.to_string())?;
        PathBuf::from(
            profile
                .workspace_path
                .as_ref()
                .ok_or_else(|| "workspace not set".to_string())?
                .trim(),
        )
    };
    ensure_workspace_layout(&workspace).map_err(|e| e.to_string())?;
    persist_config(&ctx).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_workspace_items(
    relative_path: Option<String>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Vec<WorkspaceItem>, String> {
    let path = resolve_workspace_path(&ctx, relative_path).map_err(|err| err.to_string())?;
    let mut items = Vec::new();
    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let ty = entry.file_type().map_err(|err| err.to_string())?;
        let path_str = entry.path().to_string_lossy().to_string();
        items.push(WorkspaceItem {
            path: path_str,
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: ty.is_dir(),
        });
    }
    items.sort_by_key(|a| a.name.to_lowercase());
    Ok(items)
}

#[tauri::command]
fn save_observation(
    req: SaveObservationRequest,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<ObservationRecord, String> {
    {
        let mut conn = open_db(&ctx).map_err(|err| err.to_string())?;
        let tx = conn.transaction().map_err(|err| err.to_string())?;

        let payload_raw = serde_json::to_string(&req.payload).map_err(|err| err.to_string())?;
        let timestamp = now_iso();
        let existing_payload: Option<String> = tx
            .query_row(
                "SELECT payload FROM observations WHERE id = ?1",
                params![req.id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|err| err.to_string())?;

        if let Some(previous) = existing_payload {
            tx.execute(
                "INSERT INTO observation_history (backup_id, observation_id, payload, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![Uuid::new_v4().to_string(), req.id, previous, timestamp],
            )
            .map_err(|err| err.to_string())?;
        }

        let logical_updated = req
            .updated_at
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| timestamp.clone());
        let extras_json: Option<String> = req
            .extras
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;

        tx.execute(
            "INSERT INTO observations (
                id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             ) VALUES (?1, ?2, ?3, ?4, NULL, 1, 'dirty', NULL, ?5, NULL, ?6)
             ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload,
                form_type = COALESCE(excluded.form_type, observations.form_type),
                updated_at = excluded.updated_at,
                dirty = 1,
                sync_status = 'dirty',
                conflict_payload = NULL,
                last_saved_at = excluded.last_saved_at,
                observation_extras = excluded.observation_extras",
            params![req.id, payload_raw, req.form_type, logical_updated, timestamp, extras_json],
        )
        .map_err(|err| err.to_string())?;

        tx.commit().map_err(|err| err.to_string())?;
        let defs = load_active_index_defs(&ctx);
        if !defs.is_empty() {
            let ft = req.form_type.as_deref().unwrap_or("");
            let is_deleted = req.extras.as_ref().and_then(|e| e.deleted).unwrap_or(false);
            if is_deleted {
                let _ = observation_index::delete_observation_indexes(&conn, &req.id);
            } else {
                let _ =
                    observation_index::incremental_reindex(&conn, &req.id, ft, &payload_raw, &defs);
            }
        }
    }
    get_observation(req.id, ctx)
}

#[tauri::command]
fn get_observation(
    id: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<ObservationRecord, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let record = conn
        .query_row(
            "SELECT id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             FROM observations WHERE id = ?1",
            params![id],
            |row| {
                let payload_raw: String = row.get(1)?;
                let payload = serde_json::from_str::<Value>(&payload_raw).unwrap_or(Value::Null);
                let status: String = row.get(6)?;
                let conflict_payload: Option<String> = row.get(7)?;
                let extras_raw: Option<String> = row.get(10)?;
                Ok(ObservationRecord {
                    id: row.get(0)?,
                    payload,
                    form_type: row.get(2)?,
                    updated_at: row.get(3)?,
                    remote_updated_at: row.get(4)?,
                    dirty: row.get::<_, i64>(5)? == 1,
                    sync_status: SyncStatus::from(status.as_str()),
                    has_conflict_copy: conflict_payload.is_some(),
                    last_saved_at: row.get(8)?,
                    last_pushed_at: row.get(9)?,
                    extras: parse_observation_extras(extras_raw),
                })
            },
        )
        .optional()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "observation not found".to_string())?;
    Ok(record)
}

#[tauri::command]
fn list_observations(
    query: Option<String>,
    limit: Option<i64>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Vec<ObservationRecord>, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let text_query = query.unwrap_or_default();
    let pattern = format!("%{}%", text_query.to_lowercase());
    let max_rows = limit.unwrap_or(200).clamp(1, 5000);

    let mut stmt = conn
        .prepare(
            "SELECT id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             FROM observations
             WHERE lower(id) LIKE ?1 OR lower(COALESCE(form_type, '')) LIKE ?1
             ORDER BY last_saved_at DESC
             LIMIT ?2",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![pattern, max_rows], |row| {
            let payload_raw: String = row.get(1)?;
            let payload = serde_json::from_str::<Value>(&payload_raw).unwrap_or(Value::Null);
            let status: String = row.get(6)?;
            let conflict_payload: Option<String> = row.get(7)?;
            let extras_raw: Option<String> = row.get(10)?;
            Ok(ObservationRecord {
                id: row.get(0)?,
                payload,
                form_type: row.get(2)?,
                updated_at: row.get(3)?,
                remote_updated_at: row.get(4)?,
                dirty: row.get::<_, i64>(5)? == 1,
                sync_status: SyncStatus::from(status.as_str()),
                has_conflict_copy: conflict_payload.is_some(),
                last_saved_at: row.get(8)?,
                last_pushed_at: row.get(9)?,
                extras: parse_observation_extras(extras_raw),
            })
        })
        .map_err(|err| err.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|err| err.to_string())?);
    }
    Ok(result)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ListObservationsPageResult {
    rows: Vec<ObservationRecord>,
    total: i64,
}

#[tauri::command]
fn list_observations_page(
    query: Option<String>,
    form_type: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<ListObservationsPageResult, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let text_query = query.unwrap_or_default();
    let pattern = format!("%{}%", text_query.to_lowercase());
    let max_rows = limit.unwrap_or(50).clamp(1, 5000);
    let off = offset.unwrap_or(0).max(0);
    let form_filter = form_type
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let total: i64 = if let Some(ref ft) = form_filter {
        conn.query_row(
            "SELECT COUNT(*) FROM observations
             WHERE (lower(id) LIKE ?1 OR lower(COALESCE(form_type, '')) LIKE ?1)
             AND COALESCE(form_type, '') = ?2",
            params![pattern, ft],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?
    } else {
        conn.query_row(
            "SELECT COUNT(*) FROM observations
             WHERE lower(id) LIKE ?1 OR lower(COALESCE(form_type, '')) LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?
    };

    let mut stmt = if form_filter.is_some() {
        conn.prepare(
            "SELECT id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             FROM observations
             WHERE (lower(id) LIKE ?1 OR lower(COALESCE(form_type, '')) LIKE ?1)
             AND COALESCE(form_type, '') = ?2
             ORDER BY last_saved_at DESC
             LIMIT ?3 OFFSET ?4",
        )
        .map_err(|err| err.to_string())?
    } else {
        conn.prepare(
            "SELECT id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             FROM observations
             WHERE lower(id) LIKE ?1 OR lower(COALESCE(form_type, '')) LIKE ?1
             ORDER BY last_saved_at DESC
             LIMIT ?2 OFFSET ?3",
        )
        .map_err(|err| err.to_string())?
    };

    let rows = if let Some(ref ft) = form_filter {
        stmt.query_map(params![pattern, ft, max_rows, off], map_observation_row)
            .map_err(|err| err.to_string())?
    } else {
        stmt.query_map(params![pattern, max_rows, off], map_observation_row)
            .map_err(|err| err.to_string())?
    };

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|err| err.to_string())?);
    }
    Ok(ListObservationsPageResult { rows: out, total })
}

fn map_observation_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ObservationRecord> {
    let payload_raw: String = row.get(1)?;
    let payload = serde_json::from_str::<Value>(&payload_raw).unwrap_or(Value::Null);
    let status: String = row.get(6)?;
    let conflict_payload: Option<String> = row.get(7)?;
    let extras_raw: Option<String> = row.get(10)?;
    Ok(ObservationRecord {
        id: row.get(0)?,
        payload,
        form_type: row.get(2)?,
        updated_at: row.get(3)?,
        remote_updated_at: row.get(4)?,
        dirty: row.get::<_, i64>(5)? == 1,
        sync_status: SyncStatus::from(status.as_str()),
        has_conflict_copy: conflict_payload.is_some(),
        last_saved_at: row.get(8)?,
        last_pushed_at: row.get(9)?,
        extras: parse_observation_extras(extras_raw),
    })
}

fn bind_query_params(
    stmt: &mut rusqlite::Statement<'_>,
    params: &[observation_query::SqlParam],
) -> Result<(), rusqlite::Error> {
    for (i, p) in params.iter().enumerate() {
        let idx = i + 1;
        match p {
            observation_query::SqlParam::Text(s) => stmt.raw_bind_parameter(idx, s.as_str())?,
            observation_query::SqlParam::Integer(n) => stmt.raw_bind_parameter(idx, *n)?,
            observation_query::SqlParam::Real(f) => stmt.raw_bind_parameter(idx, *f)?,
            observation_query::SqlParam::Null => {
                stmt.raw_bind_parameter(idx, rusqlite::types::Null)?
            }
        }
    }
    Ok(())
}

fn query_sql_preview(sql: &str) -> String {
    const MAX_SQL_CHARS: usize = 240;
    let compact = sql.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.len() <= MAX_SQL_CHARS {
        compact
    } else {
        format!("{}...", &compact[..MAX_SQL_CHARS])
    }
}

fn query_filter_preview(filter: Option<&Value>) -> String {
    const MAX_FILTER_CHARS: usize = 240;
    let Some(f) = filter else {
        return "null".to_string();
    };
    let raw = serde_json::to_string(f).unwrap_or_else(|_| "<unserializable-filter>".to_string());
    if raw.len() <= MAX_FILTER_CHARS {
        raw
    } else {
        format!("{}...", &raw[..MAX_FILTER_CHARS])
    }
}

fn query_log(message: &str) {
    eprintln!("{message}");
    let _ = std::io::stderr().flush();
}

fn query_param_values(params: &[observation_query::SqlParam]) -> String {
    params
        .iter()
        .map(|p| match p {
            observation_query::SqlParam::Text(s) => format!("'{}'", s.replace('\'', "''")),
            observation_query::SqlParam::Integer(n) => n.to_string(),
            observation_query::SqlParam::Real(f) => f.to_string(),
            observation_query::SqlParam::Null => "NULL".to_string(),
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn query_param_summary(params: &[observation_query::SqlParam]) -> String {
    params
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let label = match p {
                observation_query::SqlParam::Text(_) => "text",
                observation_query::SqlParam::Integer(_) => "int",
                observation_query::SqlParam::Real(_) => "real",
                observation_query::SqlParam::Null => "null",
            };
            format!("${}:{}", i + 1, label)
        })
        .collect::<Vec<_>>()
        .join(", ")
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartObservationIndexRebuildResult {
    job_id: String,
    scheduled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateObservationSqliteIndexesResult {
    created_count: usize,
    executed_statements: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexRebuildStatus {
    active_generation: i64,
    last_rebuild_at: Option<String>,
}

#[tauri::command]
fn query_observations(
    req: observation_query::QueryObservationsRequest,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Vec<ObservationRecord>, String> {
    let started = Instant::now();
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let defs = load_active_index_defs(&ctx);
    let mut index_keys = observation_index::index_keys_set(&defs);
    let filter_ref = req.filter.as_ref();
    if filter_ref.is_some() && !index_keys.is_empty() {
        let active_generation = observation_index::active_generation(&conn).unwrap_or(1);
        let has_index_rows = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM observation_index WHERE index_generation = ?1 LIMIT 1)",
                params![active_generation],
                |row| row.get::<_, i64>(0),
            )
            .map(|v| v == 1)
            .unwrap_or(false);
        if !has_index_rows {
            query_log(
                "[query_observations] active observation_index rows missing; forcing json_extract fallback for correctness",
            );
            index_keys.clear();
        }
    }
    let compiled = observation_query::compile_observation_query(
        &req.form_type,
        req.include_deleted.unwrap_or(false),
        filter_ref,
        &index_keys,
    )
    .map_err(|e| format!("{}: {}", e.code, e.message))?;

    if !compiled.warnings.is_empty() {
        for warning in &compiled.warnings {
            eprintln!("observation query warning: {warning}");
        }
    }

    let mut sql = compiled.sql;
    if let Some(limit) = req.limit {
        sql.push_str(&format!(
            " ORDER BY o.last_saved_at DESC LIMIT {}",
            limit.clamp(1, 5000)
        ));
    } else {
        sql.push_str(" ORDER BY o.last_saved_at DESC LIMIT 5000");
    }

    query_log(&format!(
        "[query_observations] start form_type={} include_deleted={} has_filter={} limit={} sql=\"{}\" param_count={} params=[{}]",
        req.form_type,
        req.include_deleted.unwrap_or(false),
        filter_ref.is_some(),
        req.limit.unwrap_or(5000),
        query_sql_preview(&sql),
        compiled.params.len(),
        query_param_summary(&compiled.params),
    ));
    query_log(&format!("[query_observations] sql_full={}", sql));
    query_log(&format!(
        "[query_observations] params_full=[{}]",
        query_param_values(&compiled.params)
    ));
    query_log(&format!(
        "[query_observations] filter_ast={}",
        query_filter_preview(filter_ref)
    ));
    let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
    bind_query_params(&mut stmt, &compiled.params).map_err(|err| err.to_string())?;
    let mut out = Vec::new();
    let mut rows = stmt.raw_query();
    while let Some(row) = rows.next().map_err(|err| {
        query_log(&format!(
            "[query_observations] error phase=iterate elapsed_ms={} err={}",
            started.elapsed().as_millis(),
            err
        ));
        err.to_string()
    })? {
        out.push(map_observation_row(row).map_err(|err| {
            query_log(&format!(
                "[query_observations] error phase=map_row elapsed_ms={} err={}",
                started.elapsed().as_millis(),
                err
            ));
            err.to_string()
        })?);
    }
    query_log(&format!(
        "[query_observations] done rows={} elapsed_ms={}",
        out.len(),
        started.elapsed().as_millis()
    ));
    Ok(out)
}

#[tauri::command]
fn start_observation_index_rebuild(
    app: tauri::AppHandle,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<StartObservationIndexRebuildResult, String> {
    let ctx = ctx.inner().clone();
    match schedule_observation_index_rebuild(&app, &ctx) {
        Some(job_id) => Ok(StartObservationIndexRebuildResult {
            job_id,
            scheduled: true,
        }),
        None => Ok(StartObservationIndexRebuildResult {
            job_id: String::new(),
            scheduled: false,
        }),
    }
}

#[tauri::command]
fn rebuild_observation_indexes(
    app: tauri::AppHandle,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<StartObservationIndexRebuildResult, String> {
    start_observation_index_rebuild(app, ctx)
}

#[tauri::command]
async fn create_observation_sqlite_indexes(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<CreateObservationSqliteIndexesResult, String> {
    let ctx = ctx.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let defs = load_active_index_defs(&ctx);
        if defs.is_empty() {
            return Ok(CreateObservationSqliteIndexesResult {
                created_count: 0,
                executed_statements: Vec::new(),
            });
        }
        let conn = open_db(&ctx).map_err(|err| err.to_string())?;
        let executed = observation_index::create_missing_sqlite_indexes(&conn, &defs)
            .map_err(|e| e.to_string())?;
        query_log(&format!(
            "[create_observation_sqlite_indexes] created_count={}",
            executed.len()
        ));
        for statement in &executed {
            query_log(&format!(
                "[create_observation_sqlite_indexes] executed {}",
                statement
            ));
        }
        Ok(CreateObservationSqliteIndexesResult {
            created_count: executed.len(),
            executed_statements: executed,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_observation_index_status(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<IndexRebuildStatus, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let active_generation =
        observation_index::active_generation(&conn).map_err(|err| err.to_string())?;
    let last_rebuild_at: Option<String> = conn
        .query_row(
            "SELECT last_rebuild_at FROM observation_index_meta WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(IndexRebuildStatus {
        active_generation,
        last_rebuild_at,
    })
}

/// Locally dirty observations eligible for sync push (`dirty = 1`, `sync_status = 'dirty'`).
/// Cap matches `list_observations_page` max.
const MAX_DIRTY_OBSERVATIONS_FOR_PUSH: i64 = 10_000;

#[tauri::command]
fn list_dirty_observations(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Vec<ObservationRecord>, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             FROM observations
             WHERE dirty = 1 AND sync_status = 'dirty'
             ORDER BY last_saved_at ASC
             LIMIT ?1",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(
            params![MAX_DIRTY_OBSERVATIONS_FOR_PUSH],
            map_observation_row,
        )
        .map_err(|err| err.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|err| err.to_string())?);
    }
    Ok(out)
}

pub(crate) fn load_dirty_observations_by_ids(
    ctx: &AppCtxHandle,
    ids: &[String],
) -> Result<Vec<ObservationRecord>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let conn = open_db(ctx).map_err(|err| err.to_string())?;
    let mut found: HashMap<String, ObservationRecord> = HashMap::new();
    for chunk in ids.chunks(400) {
        let placeholders = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, payload, form_type, updated_at, remote_updated_at, dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at, observation_extras
             FROM observations
             WHERE dirty = 1 AND sync_status = 'dirty' AND id IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
        let mut rows = stmt
            .query(rusqlite::params_from_iter(chunk.iter()))
            .map_err(|err| err.to_string())?;
        while let Some(row) = rows.next().map_err(|err| err.to_string())? {
            let rec = map_observation_row(row).map_err(|err| err.to_string())?;
            found.insert(rec.id.clone(), rec);
        }
    }
    let mut ordered = Vec::new();
    for id in ids {
        if let Some(r) = found.remove(id.as_str()) {
            ordered.push(r);
        }
    }
    Ok(ordered)
}

#[tauri::command]
fn list_form_types(ctx: tauri::State<'_, AppCtxHandle>) -> Result<Vec<String>, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT form_type FROM observations
             WHERE form_type IS NOT NULL AND TRIM(form_type) != ''
             ORDER BY form_type COLLATE NOCASE",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| err.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|err| err.to_string())?);
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationTimelineBucket {
    bucket_start: String,
    label: String,
    count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationOverviewTimeline {
    bucket_unit: String,
    range_start: String,
    range_end: String,
    buckets: Vec<ObservationTimelineBucket>,
    observations_without_date: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationGeolocationSummary {
    with_location: i64,
    without_location: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationMapPoint {
    id: String,
    form_type: String,
    latitude: f64,
    longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationOverviewMap {
    points: Vec<ObservationMapPoint>,
    truncated: bool,
    cap: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationOverviewRow {
    form_type: String,
    observation_count: i64,
    pending_sync_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObservationOverviewResult {
    rows: Vec<ObservationOverviewRow>,
    totals: ObservationOverviewRow,
    timeline: ObservationOverviewTimeline,
    geolocation_summary: ObservationGeolocationSummary,
    map: ObservationOverviewMap,
    computed_at: String,
}

const OVERVIEW_MAP_POINT_CAP: i64 = 5000;

fn parse_iso_to_naive_date(raw: &str) -> Option<NaiveDate> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(dt.date_naive());
    }
    if let Ok(dt) = trimmed.parse::<DateTime<Utc>>() {
        return Some(dt.date_naive());
    }
    NaiveDate::parse_from_str(&trimmed[..trimmed.len().min(10)], "%Y-%m-%d").ok()
}

fn resolve_observation_created_at(
    extras_raw: Option<&str>,
    updated_at: Option<&str>,
    last_saved_at: &str,
) -> Option<NaiveDate> {
    if let Some(raw) = extras_raw
        && let Ok(extras) = serde_json::from_str::<ObservationExtras>(raw)
        && let Some(ref created) = extras.created_at
        && let Some(d) = parse_iso_to_naive_date(created)
    {
        return Some(d);
    }
    updated_at
        .and_then(parse_iso_to_naive_date)
        .or_else(|| parse_iso_to_naive_date(last_saved_at))
}

fn geolocation_from_extras_raw(extras_raw: Option<&str>) -> Option<(f64, f64)> {
    let raw = extras_raw?;
    let extras: ObservationExtras = serde_json::from_str(raw).ok()?;
    let geo = extras.geolocation?;
    let lat = geo.get("latitude")?.as_f64()?;
    let lng = geo.get("longitude")?.as_f64()?;
    if lat.is_finite() && lng.is_finite() && lat.abs() <= 90.0 && lng.abs() <= 180.0 {
        Some((lat, lng))
    } else {
        None
    }
}

fn week_start(date: NaiveDate) -> NaiveDate {
    date - chrono::Duration::days(date.weekday().num_days_from_monday() as i64)
}

fn format_day_label(date: NaiveDate) -> String {
    format!("{} {}", date.format("%b"), date.day())
}

fn format_week_label(date: NaiveDate) -> String {
    format!("{} {}", date.format("%b"), date.day())
}

fn build_observation_timeline(
    dates: &[NaiveDate],
    without_date: i64,
) -> ObservationOverviewTimeline {
    if dates.is_empty() {
        return ObservationOverviewTimeline {
            bucket_unit: "day".to_string(),
            range_start: String::new(),
            range_end: String::new(),
            buckets: Vec::new(),
            observations_without_date: without_date,
        };
    }

    let min_date = *dates.iter().min().unwrap();
    let max_date = *dates.iter().max().unwrap();
    let span_days = (max_date - min_date).num_days();
    let use_weeks = span_days >= 365;

    let mut counts: HashMap<NaiveDate, i64> = HashMap::new();
    for date in dates {
        let bucket = if use_weeks { week_start(*date) } else { *date };
        *counts.entry(bucket).or_insert(0) += 1;
    }

    let (range_start, range_end) = if use_weeks {
        (week_start(min_date), week_start(max_date))
    } else {
        (min_date, max_date)
    };

    let step = if use_weeks { 7 } else { 1 };
    let mut buckets = Vec::new();
    let mut cursor = range_start;
    while cursor <= range_end {
        let count = counts.get(&cursor).copied().unwrap_or(0);
        buckets.push(ObservationTimelineBucket {
            bucket_start: cursor.format("%Y-%m-%d").to_string(),
            label: if use_weeks {
                format_week_label(cursor)
            } else {
                format_day_label(cursor)
            },
            count,
        });
        cursor += chrono::Duration::days(step);
    }

    ObservationOverviewTimeline {
        bucket_unit: if use_weeks {
            "week".to_string()
        } else {
            "day".to_string()
        },
        range_start: range_start.format("%Y-%m-%d").to_string(),
        range_end: range_end.format("%Y-%m-%d").to_string(),
        buckets,
        observations_without_date: without_date,
    }
}

fn build_observation_overview(
    conn: &Connection,
) -> Result<ObservationOverviewResult, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT COALESCE(NULLIF(TRIM(form_type), ''), '(no form type)') AS form_type,
                COUNT(*) AS observation_count,
                SUM(CASE WHEN dirty = 1 AND sync_status = 'dirty' THEN 1 ELSE 0 END) AS pending_sync_count
         FROM observations
         GROUP BY 1
         ORDER BY 1 COLLATE NOCASE",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ObservationOverviewRow {
                form_type: row.get(0)?,
                observation_count: row.get(1)?,
                pending_sync_count: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut total_observations: i64 = 0;
    let mut total_pending: i64 = 0;
    for row in &rows {
        total_observations += row.observation_count;
        total_pending += row.pending_sync_count;
    }

    let mut scan_stmt = conn.prepare(
        "SELECT id,
                COALESCE(NULLIF(TRIM(form_type), ''), '(no form type)') AS form_type,
                observation_extras,
                updated_at,
                last_saved_at
         FROM observations",
    )?;

    let mut dates: Vec<NaiveDate> = Vec::new();
    let mut without_date: i64 = 0;
    let mut with_location: i64 = 0;
    let mut without_location: i64 = 0;
    let mut map_points: Vec<ObservationMapPoint> = Vec::new();
    let mut map_truncated = false;

    let scan_rows = scan_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, String>(4)?,
        ))
    })?;

    for row in scan_rows {
        let (id, form_type, extras_raw, updated_at, last_saved_at) = row?;
        if let Some(d) = resolve_observation_created_at(
            extras_raw.as_deref(),
            updated_at.as_deref(),
            &last_saved_at,
        ) {
            dates.push(d);
        } else {
            without_date += 1;
        }

        if let Some((lat, lng)) = geolocation_from_extras_raw(extras_raw.as_deref()) {
            with_location += 1;
            if (map_points.len() as i64) < OVERVIEW_MAP_POINT_CAP {
                map_points.push(ObservationMapPoint {
                    id,
                    form_type,
                    latitude: lat,
                    longitude: lng,
                });
            } else {
                map_truncated = true;
            }
        } else {
            without_location += 1;
        }
    }

    let timeline = build_observation_timeline(&dates, without_date);

    Ok(ObservationOverviewResult {
        rows,
        totals: ObservationOverviewRow {
            form_type: String::new(),
            observation_count: total_observations,
            pending_sync_count: total_pending,
        },
        timeline,
        geolocation_summary: ObservationGeolocationSummary {
            with_location,
            without_location,
        },
        map: ObservationOverviewMap {
            points: map_points,
            truncated: map_truncated,
            cap: OVERVIEW_MAP_POINT_CAP,
        },
        computed_at: now_iso(),
    })
}

#[tauri::command]
fn get_observation_overview(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<ObservationOverviewResult, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    build_observation_overview(&conn).map_err(|err| err.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncStateInfo {
    repository_generation: i64,
    observation_sync_version: i64,
    last_attachment_version: i64,
}

#[tauri::command]
fn get_sync_state(ctx: tauri::State<'_, AppCtxHandle>) -> Result<SyncStateInfo, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    conn.query_row(
        "SELECT repository_generation, observation_sync_version, last_attachment_version FROM sync_state WHERE id = 1",
        [],
        |row| {
            Ok(SyncStateInfo {
                repository_generation: row.get(0)?,
                observation_sync_version: row.get(1)?,
                last_attachment_version: row.get(2)?,
            })
        },
    )
    .map_err(|err| err.to_string())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetSyncStateRequest {
    repository_generation: Option<i64>,
    observation_sync_version: Option<i64>,
    last_attachment_version: Option<i64>,
}

#[tauri::command]
fn set_sync_state(
    req: SetSyncStateRequest,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let current = conn
        .query_row(
            "SELECT repository_generation, observation_sync_version, last_attachment_version FROM sync_state WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(|err| err.to_string())?;
    let repo = req.repository_generation.unwrap_or(current.0);
    let obs = req.observation_sync_version.unwrap_or(current.1);
    let att = req.last_attachment_version.unwrap_or(current.2);
    conn.execute(
        "UPDATE sync_state SET repository_generation = ?1, observation_sync_version = ?2, last_attachment_version = ?3 WHERE id = 1",
        params![repo, obs, att],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

pub(crate) fn set_sync_state_merge(
    ctx: &AppCtxHandle,
    repository_generation: Option<i64>,
    observation_sync_version: Option<i64>,
    last_attachment_version: Option<i64>,
) -> Result<(), String> {
    let conn = open_db(ctx).map_err(|err| err.to_string())?;
    let current = conn
        .query_row(
            "SELECT repository_generation, observation_sync_version, last_attachment_version FROM sync_state WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(|err| err.to_string())?;
    let repo = repository_generation.unwrap_or(current.0);
    let obs = observation_sync_version.unwrap_or(current.1);
    let att = last_attachment_version.unwrap_or(current.2);
    conn.execute(
        "UPDATE sync_state SET repository_generation = ?1, observation_sync_version = ?2, last_attachment_version = ?3 WHERE id = 1",
        params![repo, obs, att],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn move_workspace(
    destination: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    let dest = PathBuf::from(destination.trim());
    let src = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    validate_move_destination(&src, &dest).map_err(|e| e.to_string())?;

    if dest.exists() {
        let mut dir = fs::read_dir(&dest).map_err(|e| e.to_string())?;
        if dir.next().is_some() {
            return Err("destination directory must be empty".to_string());
        }
    } else {
        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    }

    let dest_norm = with_workspace_fs_exclusive(&ctx, |ctx| {
        for entry in fs::read_dir(&src).map_err(|e| CustodianError::Message(e.to_string()))? {
            let entry = entry.map_err(|e| CustodianError::Message(e.to_string()))?;
            let from = entry.path();
            let to = dest.join(entry.file_name());
            rename_or_move_entry(&from, &to)?;
        }
        let canon = dest
            .canonicalize()
            .map_err(|e| CustodianError::Message(e.to_string()))?;
        {
            let mut cfg = ctx
                .config
                .lock()
                .map_err(|_| CustodianError::Message("failed to lock config".to_string()))?;
            let profile = active_profile_mut(&mut cfg)?;
            profile.workspace_path = Some(canon.to_string_lossy().to_string());
            apply_workspace_derived_paths(profile)?;
        }
        persist_config(ctx)?;
        ensure_workspace_layout(&canon)?;
        Ok(canon)
    })
    .map_err(|e| e.to_string())?;

    Ok(dest_norm.to_string_lossy().to_string())
}

#[tauri::command]
fn backup_workspace(
    zip_path: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    let path = PathBuf::from(zip_path.trim());
    if path.as_os_str().is_empty() {
        return Err("zip path is required".to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    with_workspace_fs_exclusive(&ctx, |ctx| {
        backup_workspace_zip(ctx, &path)?;
        let out = path.canonicalize().unwrap_or_else(|_| path.clone());
        Ok(out.to_string_lossy().to_string())
    })
    .map_err(|e| e.to_string())
}

/// Moves `sqlite` and `attachments` under `workspace/previous_generations/<stamp>/`, then recreates a fresh layout.
#[tauri::command]
fn archive_workspace_for_repository_generation(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    archive_workspace_for_repository_generation_inner(&ctx)
}

pub(crate) fn archive_workspace_for_repository_generation_inner(
    ctx: &AppCtxHandle,
) -> Result<String, String> {
    let ws = get_workspace_path(ctx).map_err(|e| e.to_string())?;
    let stamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let dest = ws
        .join("previous_generations")
        .join(format!("{stamp}_archive"));
    with_workspace_fs_exclusive(ctx, move |_ctx| {
        fs::create_dir_all(&dest).map_err(|e| CustodianError::Message(e.to_string()))?;
        for sub in ["sqlite", "attachments"] {
            let p = ws.join(sub);
            if p.exists() {
                rename_or_move_entry(&p, &dest.join(sub))?;
            }
        }
        ensure_workspace_layout(&ws)?;
        Ok(dest.to_string_lossy().to_string())
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_workspace_attachment(
    attachment_id: String,
    data: Vec<u8>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let t = attachment_id.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment id".to_string());
    }
    // Outbound queue (upload on sync); pulls still land in `synced/` via download.
    let path = attachment_path_pending(&ws, t);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, data).map_err(|e| e.to_string())
}

/// Copy an attachment from a host filesystem path into the workspace outbound queue (same destination as [`write_workspace_attachment`]).
/// Prefer this over sending bytes through IPC when the WebView exposes `File.path` (Tauri / WebView2).
#[tauri::command]
fn copy_workspace_attachment_from_path(
    source_path: String,
    attachment_id: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let t = attachment_id.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment id".to_string());
    }
    let src = PathBuf::from(source_path.trim());
    let meta = fs::metadata(&src).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("source path is not a regular file".to_string());
    }
    let path = attachment_path_pending(&ws, t);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&src, &path).map_err(|e| e.to_string())?;
    Ok(())
}

const MAX_IMPORT_SCAN_ENTRIES: usize = 100_000;
const MAX_IMPORT_WALK_DEPTH: usize = 256;
const MAX_HOST_TEXT_BYTES: u64 = 64 * 1024 * 1024;

/// When the user selects only files (no directories), cap count so large imports use "folder" pick.
const DEFAULT_MAX_INDIVIDUAL_IMPORT_FILES: usize = 20;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportStagingScanEntry {
    path: String,
    file_name: String,
    size: u64,
    last_modified_ms: i64,
    is_json: bool,
}

fn import_scan_mtime_ms(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| {
            let ms = d.as_millis();
            if ms > i64::MAX as u128 {
                i64::MAX
            } else {
                ms as i64
            }
        })
        .unwrap_or(0)
}

/// Skip dotfiles except `*.json` (e.g. `.DS_Store`, Thumbs.db).
fn import_scan_skip_noise_file_name(file_name: &str) -> bool {
    let lower = file_name.to_lowercase();
    file_name.starts_with('.') && !lower.ends_with(".json")
}

fn import_scan_push_file(
    path: &Path,
    out: &mut Vec<ImportStagingScanEntry>,
    seen: &mut HashSet<String>,
) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    if file_name.is_empty() {
        return Ok(());
    }
    if import_scan_skip_noise_file_name(&file_name) {
        return Ok(());
    }
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };
    if !meta.is_file() {
        return Ok(());
    }

    if out.len() >= MAX_IMPORT_SCAN_ENTRIES {
        return Err(
            "Too many files matched this import (100k file limit). Pick a smaller folder or selection."
                .to_string(),
        );
    }

    let dedupe_key = match fs::canonicalize(path) {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => path.to_string_lossy().to_string(),
    };
    if !seen.insert(dedupe_key) {
        return Ok(());
    }

    let is_json = file_name.to_lowercase().ends_with(".json");
    out.push(ImportStagingScanEntry {
        path: path.to_string_lossy().to_string(),
        file_name,
        size: meta.len(),
        last_modified_ms: import_scan_mtime_ms(&meta),
        is_json,
    });
    Ok(())
}

/// Flatten `paths` (files or directories) into a bounded list of regular files with metadata for import staging.
/// When **no** path is a directory, applies `max_individual_files` (default 20) so large selections must use a folder.
#[tauri::command]
fn expand_import_staging_paths(
    paths: Vec<String>,
    max_individual_files: Option<usize>,
) -> Result<Vec<ImportStagingScanEntry>, String> {
    let max_files = max_individual_files.unwrap_or(DEFAULT_MAX_INDIVIDUAL_IMPORT_FILES);
    let mut dirs: Vec<PathBuf> = Vec::new();
    let mut loose_files: Vec<PathBuf> = Vec::new();

    for raw in paths {
        let t = raw.trim();
        if t.is_empty() {
            continue;
        }
        let p = PathBuf::from(t);
        let meta = fs::metadata(&p).map_err(|e| format!("{}: {e}", p.to_string_lossy()))?;
        if meta.is_dir() {
            dirs.push(p);
        } else if meta.is_file() {
            loose_files.push(p);
        }
    }

    let mut out = Vec::new();
    let mut seen = HashSet::<String>::new();

    if dirs.is_empty() {
        if loose_files.len() > max_files {
            return Err(format!(
                "Too many files at once ({} files). You can select up to {max_files} without a folder. Use “Import folder…” for larger imports.",
                loose_files.len()
            ));
        }
        for p in loose_files {
            import_scan_push_file(&p, &mut out, &mut seen)?;
        }
        return Ok(out);
    }

    for p in loose_files {
        import_scan_push_file(&p, &mut out, &mut seen)?;
    }
    for d in dirs {
        for entry in WalkDir::new(&d)
            .follow_links(false)
            .max_depth(MAX_IMPORT_WALK_DEPTH)
        {
            let entry = entry.map_err(|e| e.to_string())?;
            if !entry.file_type().is_file() {
                continue;
            }
            import_scan_push_file(entry.path(), &mut out, &mut seen)?;
        }
    }

    Ok(out)
}

/// Read a UTF-8 text file from an arbitrary absolute path (import JSON validation / parsing).
fn read_host_text_file_inner(path: &Path) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("path is not a file".to_string());
    }
    if meta.len() > MAX_HOST_TEXT_BYTES {
        return Err(format!(
            "file is too large to read as text (max {} MiB)",
            MAX_HOST_TEXT_BYTES / (1024 * 1024)
        ));
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

const MAX_HOST_TEXT_BATCH_PATHS: usize = 128;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostTextReadResult {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// Read many UTF-8 text files in parallel (one IPC round-trip; reduces validation latency).
#[tauri::command]
fn read_host_text_files_batch(paths: Vec<String>) -> Result<Vec<HostTextReadResult>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    if paths.len() > MAX_HOST_TEXT_BATCH_PATHS {
        return Err(format!(
            "batch too large (max {} paths per request)",
            MAX_HOST_TEXT_BATCH_PATHS
        ));
    }
    let out: Vec<HostTextReadResult> = paths
        .par_iter()
        .map(|raw| {
            let trimmed = raw.trim().to_string();
            let p = Path::new(&trimmed);
            match read_host_text_file_inner(p) {
                Ok(text) => HostTextReadResult {
                    path: trimmed,
                    text: Some(text),
                    error: None,
                },
                Err(e) => HostTextReadResult {
                    path: trimmed,
                    text: None,
                    error: Some(e),
                },
            }
        })
        .collect();
    Ok(out)
}

#[tauri::command]
fn read_host_text_file(path: String) -> Result<String, String> {
    let p = Path::new(path.trim());
    read_host_text_file_inner(p)
}

/// True when `path` exists and is a directory (for session folder dialog defaults).
#[tauri::command]
fn host_path_is_directory(path: String) -> bool {
    Path::new(path.trim()).is_dir()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ParsedImportFileResult {
    file_name: String,
    observations: Vec<ApiObservation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn observation_id_from_obj(obj: &serde_json::Map<String, Value>) -> Option<String> {
    for key in ["observationId", "observation_id", "id"] {
        if let Some(Value::String(s)) = obj.get(key) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn optional_import_str(
    obj: &serde_json::Map<String, Value>,
    snake: &str,
    camel: &str,
) -> Option<String> {
    obj.get(snake)
        .or_else(|| obj.get(camel))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn optional_import_tags(obj: &serde_json::Map<String, Value>) -> Option<Vec<String>> {
    let tags = obj.get("tags").and_then(|t| {
        t.as_array().map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
    })?;
    if tags.is_empty() { None } else { Some(tags) }
}

/// Synkronus envelope fields outside `data` / `payload` (snake_case or camelCase).
fn observation_extras_from_import_obj(
    obj: &serde_json::Map<String, Value>,
) -> Option<ObservationExtras> {
    let geolocation = obj.get("geolocation").filter(|v| !v.is_null()).cloned();
    let extras = ObservationExtras {
        form_version: optional_import_str(obj, "form_version", "formVersion"),
        created_at: optional_import_str(obj, "created_at", "createdAt"),
        deleted: obj.get("deleted").and_then(|v| v.as_bool()),
        synced_at: optional_import_str(obj, "synced_at", "syncedAt"),
        geolocation,
        author: optional_import_str(obj, "author", "author"),
        device_id: optional_import_str(obj, "device_id", "deviceId"),
        tags: optional_import_tags(obj),
    };
    let has_any = extras.form_version.is_some()
        || extras.created_at.is_some()
        || extras.deleted.is_some()
        || extras.synced_at.is_some()
        || extras.geolocation.is_some()
        || extras.author.is_some()
        || extras.device_id.is_some()
        || extras.tags.is_some();
    if has_any { Some(extras) } else { None }
}

fn extract_observations_from_json_value(
    root: &Value,
    _file_name: &str,
) -> Result<Vec<ApiObservation>, String> {
    let rows: Vec<&Value> = match root {
        Value::Array(a) => a.iter().collect(),
        Value::Object(map) => {
            if let Some(Value::Array(inner)) = map.get("observations") {
                inner.iter().collect()
            } else {
                vec![root]
            }
        }
        _ => vec![root],
    };

    let mut observations = Vec::new();
    for item in rows {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let Some(id) = observation_id_from_obj(obj) else {
            continue;
        };
        let data = obj
            .get("data")
            .cloned()
            .or_else(|| obj.get("payload").cloned())
            .unwrap_or(Value::Object(serde_json::Map::new()));

        let form_type = obj
            .get("formType")
            .or_else(|| obj.get("form_type"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let updated_at = obj
            .get("updatedAt")
            .or_else(|| obj.get("updated_at"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .or_else(|| Some(Utc::now().to_rfc3339()));

        observations.push(ApiObservation {
            observation_id: id,
            data,
            form_type,
            updated_at,
            extras: observation_extras_from_import_obj(obj),
        });
    }

    if observations.is_empty() {
        return Err(
            "No observation objects with an id (observationId / observation_id / id)".to_string(),
        );
    }
    Ok(observations)
}

fn parse_import_json_file(path: &Path) -> ParsedImportFileResult {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    match read_host_text_file_inner(path) {
        Err(e) => ParsedImportFileResult {
            file_name: file_name.clone(),
            observations: vec![],
            error: Some(e),
        },
        Ok(text) => match serde_json::from_str::<Value>(&text) {
            Err(_) => ParsedImportFileResult {
                file_name: file_name.clone(),
                observations: vec![],
                error: Some("Invalid JSON".to_string()),
            },
            Ok(root) => match extract_observations_from_json_value(&root, &file_name) {
                Err(e) => ParsedImportFileResult {
                    file_name: file_name.clone(),
                    observations: vec![],
                    error: Some(e),
                },
                Ok(obs) => ParsedImportFileResult {
                    file_name,
                    observations: obs,
                    error: None,
                },
            },
        },
    }
}

/// Parse observation JSON files on the host (parallel) in import order.
#[tauri::command]
fn parse_import_observation_json_paths(
    paths: Vec<String>,
) -> Result<Vec<ParsedImportFileResult>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    if paths.len() > MAX_HOST_TEXT_BATCH_PATHS {
        return Err(format!(
            "batch too large (max {} paths per request)",
            MAX_HOST_TEXT_BATCH_PATHS
        ));
    }

    let indexed: Vec<(usize, ParsedImportFileResult)> = paths
        .into_iter()
        .enumerate()
        .collect::<Vec<_>>()
        .into_par_iter()
        .map(|(i, raw)| {
            let p = Path::new(raw.trim());
            (i, parse_import_json_file(p))
        })
        .collect();

    let mut indexed = indexed;
    indexed.sort_by_key(|(i, _)| *i);
    Ok(indexed.into_iter().map(|(_, r)| r).collect())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentCopyPair {
    source_path: String,
    attachment_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentCopyProgressEvent {
    done: usize,
    total: usize,
    attachment_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentCopyBatchResult {
    copied: usize,
    failed: usize,
    errors: Vec<String>,
}

fn copy_one_attachment_to_pending(
    ws: &Path,
    source_path: &str,
    attachment_id: &str,
) -> Result<(), String> {
    let t = attachment_id.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment id".to_string());
    }
    let src = PathBuf::from(source_path.trim());
    let meta = fs::metadata(&src).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("source path is not a regular file".to_string());
    }
    let dest = attachment_path_pending(ws, t);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

/// Cap parallel host copies so large imports do not saturate disk I/O.
const ATTACHMENT_COPY_MAX_PARALLEL: usize = 8;

/// Minimum wall time between progress events forwarded to the WebView.
const ATTACHMENT_COPY_PROGRESS_MIN_INTERVAL: Duration = Duration::from_millis(250);

/// Emit a progress event every N files (scaled to batch size).
fn attachment_copy_progress_step(total: usize) -> usize {
    if total <= 20 {
        1
    } else if total <= 200 {
        10
    } else if total <= 2000 {
        25
    } else {
        50
    }
}

fn should_emit_attachment_copy_progress(
    done: usize,
    total: usize,
    step: usize,
    last_emit: Instant,
) -> bool {
    if done == 0 {
        return false;
    }
    if done == 1 || done >= total {
        return true;
    }
    if step > 0 && done.is_multiple_of(step) {
        return true;
    }
    last_emit.elapsed() >= ATTACHMENT_COPY_PROGRESS_MIN_INTERVAL
}

fn emit_attachment_copy_progress(
    app: &tauri::AppHandle,
    done: usize,
    total: usize,
    attachment_id: &str,
    last_emit: &Mutex<Instant>,
    step: usize,
) {
    let mut last = last_emit.lock().unwrap();
    if !should_emit_attachment_copy_progress(done, total, step, *last) {
        return;
    }
    *last = Instant::now();
    drop(last);
    let _ = app.emit(
        "import/attachment-copy-progress",
        AttachmentCopyProgressEvent {
            done,
            total,
            attachment_id: attachment_id.trim().to_string(),
        },
    );
}

/// Copy many attachments into `attachments/pending/` with throttled progress events.
#[tauri::command]
fn copy_workspace_attachments_batch(
    app: tauri::AppHandle,
    items: Vec<AttachmentCopyPair>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<AttachmentCopyBatchResult, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let total = items.len();
    if total == 0 {
        return Ok(AttachmentCopyBatchResult {
            copied: 0,
            failed: 0,
            errors: vec![],
        });
    }

    let done = AtomicUsize::new(0);
    let errors = Mutex::new(Vec::<String>::new());
    let progress_step = attachment_copy_progress_step(total);
    let last_emit = Mutex::new(Instant::now() - ATTACHMENT_COPY_PROGRESS_MIN_INTERVAL);

    let workers = ATTACHMENT_COPY_MAX_PARALLEL.min(total.max(1));
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(workers)
        .build()
        .map_err(|e| e.to_string())?;

    pool.install(|| {
        items.par_iter().for_each(|it| {
            let r = copy_one_attachment_to_pending(&ws, &it.source_path, &it.attachment_id);
            let n = done.fetch_add(1, Ordering::Relaxed) + 1;
            if let Err(e) = r {
                errors
                    .lock()
                    .unwrap()
                    .push(format!("{}: {e}", it.attachment_id.trim()));
            }
            emit_attachment_copy_progress(
                &app,
                n,
                total,
                &it.attachment_id,
                &last_emit,
                progress_step,
            );
        });
    });

    emit_attachment_copy_progress(&app, total, total, "", &last_emit, progress_step);

    let errs = errors.into_inner().unwrap();
    let failed = errs.len();
    Ok(AttachmentCopyBatchResult {
        copied: total.saturating_sub(failed),
        failed,
        errors: errs,
    })
}

/// GET `GET {base}/api/attachments/{id}` with Bearer auth and write bytes under `attachments/synced/`.
/// Used during sync so downloads do not rely on the WebView `fetch` implementation (CORS / TLS quirks).
/// `x_ode_version` is required: Synkronus [`formulusversion.Middleware`] rejects requests without `x-ode-version`.
#[tauri::command]
async fn download_workspace_attachment_from_url(
    base_url: String,
    bearer_token: String,
    attachment_id: String,
    x_ode_version: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    let base = base_url.trim();
    if base.is_empty() {
        return Err("base_url is required".to_string());
    }
    let token = bearer_token.trim();
    if token.is_empty() {
        return Err("bearer token is required".to_string());
    }
    let ode_ver = x_ode_version.trim();
    if ode_ver.is_empty() {
        return Err("x_ode_version is required".to_string());
    }
    let t = attachment_id.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment_id".to_string());
    }
    let url = format!(
        "{}/api/attachments/{}",
        base.trim_end_matches('/'),
        urlencoding::encode(t)
    );
    let parsed = Url::parse(&url).map_err(|e| format!("invalid attachment URL: {e}"))?;

    let client = reqwest::Client::new();
    let res = client
        .get(parsed)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .header("x-ode-version", ode_ver)
        .send()
        .await
        .map_err(|e| format!("attachment request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("attachment download failed: HTTP {}", res.status()));
    }
    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("attachment read failed: {e}"))?;

    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let path = attachment_path_synced(&ws, t);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn collect_outbound_queue_basenames(ws: &Path) -> Result<HashSet<String>, String> {
    let mut s = HashSet::new();
    let dir = attachments_root(ws).join(ATTACH_SUBDIR_PENDING);
    if !dir.is_dir() {
        return Ok(s);
    }
    for e in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let ft = e.file_type().map_err(|e| e.to_string())?;
        if ft.is_file() {
            s.insert(e.file_name().to_string_lossy().to_string());
        }
    }
    Ok(s)
}

/// `PUT /api/attachments/{id}` for each regular file under `attachments/pending/`, then move into `synced/` on success or 409.
/// `extra_attachment_ids` is ignored (legacy parameter kept for stable IPC signature).
#[tauri::command]
async fn upload_outbound_attachments(
    base_url: String,
    bearer_token: String,
    x_ode_version: String,
    repository_generation: Option<i64>,
    _extra_attachment_ids: Vec<String>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<OutboundAttachmentUploadResult, String> {
    let base = base_url.trim();
    if base.is_empty() {
        return Err("base_url is required".to_string());
    }
    let token = bearer_token.trim();
    if token.is_empty() {
        return Err("bearer token is required".to_string());
    }
    let ode_ver = x_ode_version.trim();
    if ode_ver.is_empty() {
        return Err("x_ode_version is required".to_string());
    }

    let ws = resolve_active_workspace_dir(&ctx).map_err(|e| e.to_string())?;

    let mut id_list: Vec<String> = collect_outbound_queue_basenames(&ws)?.into_iter().collect();
    id_list.sort();

    let client = reqwest::Client::new();
    let mut uploaded = 0usize;
    let mut skipped_conflicts = 0usize;
    let mut skipped_missing = 0usize;
    let mut failed = 0usize;
    let mut first_err: Option<String> = None;

    for id in id_list {
        let Some(src) = first_path_for_attachment_upload(&ws, &id) else {
            skipped_missing += 1;
            continue;
        };

        let bytes = fs::read(&src)
            .map_err(|e| format!("failed to read attachment {} at {}: {e}", id, src.display()))?;

        let part = multipart::Part::bytes(bytes)
            .file_name(id.clone())
            .mime_str("application/octet-stream")
            .map_err(|e| e.to_string())?;
        let form = multipart::Form::new().part("file", part);
        let url = format!(
            "{}/api/attachments/{}",
            base.trim_end_matches('/'),
            urlencoding::encode(&id)
        );
        let parsed = Url::parse(&url).map_err(|e| format!("invalid attachment URL: {e}"))?;

        let mut req = client
            .put(parsed)
            .multipart(form)
            .header(AUTHORIZATION, format!("Bearer {token}"))
            .header("x-ode-version", ode_ver);
        if let Some(g) = repository_generation
            && g > 0
        {
            req = req.header("x-repository-generation", g.to_string());
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("attachment upload request failed ({id}): {e}"))?;
        let status = res.status();

        if status.is_success() {
            uploaded += 1;
            if should_promote_upload_source_to_synced(&ws, &src)
                && let Err(e) = promote_uploaded_queue_file_to_synced(&ws, &id, &src)
                && first_err.is_none()
            {
                first_err = Some(format!("uploaded {id} but could not move to synced: {e}"));
            }
        } else if status.as_u16() == 409 {
            skipped_conflicts += 1;
            if should_promote_upload_source_to_synced(&ws, &src) {
                let _ = promote_uploaded_queue_file_to_synced(&ws, &id, &src);
            }
        } else {
            failed += 1;
            if first_err.is_none() {
                let body = res.text().await.unwrap_or_default();
                first_err = Some(format!(
                    "attachment upload failed ({id}): HTTP {} {}",
                    status.as_u16(),
                    body.trim()
                ));
            }
        }
    }

    Ok(OutboundAttachmentUploadResult {
        uploaded,
        skipped_conflicts,
        skipped_missing,
        failed,
        error_summary: first_err,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceAttachmentPresenceEntry {
    file_name: String,
    present: bool,
}

/// Whether each basename resolves to an existing file under the attachment layout (same lookup as upload).
#[tauri::command]
fn check_workspace_attachment_presence(
    file_names: Vec<String>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Vec<WorkspaceAttachmentPresenceEntry>, String> {
    let ws = resolve_active_workspace_dir(&ctx).map_err(|e| e.to_string())?;
    let mut seen = HashSet::<String>::new();
    let mut out = Vec::new();
    for raw in file_names {
        let t = raw.trim();
        if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
            continue;
        }
        if !seen.insert(t.to_string()) {
            continue;
        }
        let present = first_path_for_attachment_upload(&ws, t).is_some();
        out.push(WorkspaceAttachmentPresenceEntry {
            file_name: t.to_string(),
            present,
        });
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CustomAppDevMirrorResult {
    source_path: String,
    mirrored_index_relative_path: String,
    copied_files: u64,
    index_defs_loaded: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    index_rebuild_generation: Option<i64>,
    index_rebuild_scheduled: bool,
    sqlite_indexes_needed: bool,
    pending_sqlite_index_statements: Vec<String>,
}

/// Copies the active profile's configured local custom app folder into
/// `bundles/dev-local/app/` (developer mode mirror). Does not modify the source folder.
#[tauri::command]
fn refresh_custom_app_dev_mirror(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<CustomAppDevMirrorResult, String> {
    let started = Instant::now();
    let source_path = {
        let cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        let profile = active_profile_ref(&cfg).map_err(|e: CustodianError| e.to_string())?;
        if !profile.custom_app_developer_mode {
            return Err("developer mode is not enabled for the active profile".to_string());
        }
        profile
            .custom_app_local_folder
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                "custom app local folder is not configured for the active profile".to_string()
            })?
    };
    let source = PathBuf::from(&source_path);
    validate_custom_app_dev_source_folder(&source)?;
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let mirror_started = Instant::now();
    let copied_files = mirror_custom_app_dev_folder(&ws, &source).map_err(|e| e.to_string())?;
    let app_config_path = bundle_app_config_path(&ctx).ok();
    query_log(&format!(
        "[refresh_custom_app_dev_mirror] source_path={} app_config_path={} app_config_exists={}",
        source_path,
        app_config_path
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "<unresolved>".to_string()),
        app_config_path
            .as_ref()
            .map(|p| p.exists())
            .unwrap_or(false),
    ));
    let defs = load_active_index_defs(&ctx);
    let index_rebuild_generation = None;
    let index_rebuild_scheduled = false;
    let (sqlite_indexes_needed, pending_sqlite_index_statements) = if defs.is_empty() {
        query_log(
            "[refresh_custom_app_dev_mirror] no observationIndexes found in mirrored app.config.json",
        );
        (false, Vec::new())
    } else {
        match open_db(&ctx) {
            Ok(conn) => {
                let missing = observation_index::missing_sqlite_indexes(&conn, &defs)
                    .map_err(|e| e.to_string())?;
                let pending: Vec<String> =
                    missing.iter().map(|idx| format!("{};", idx.sql)).collect();
                let needed = !pending.is_empty();
                query_log(&format!(
                    "[refresh_custom_app_dev_mirror] sqlite_indexes_needed={} defs={} pending_count={}",
                    needed,
                    defs.len(),
                    pending.len()
                ));
                if needed {
                    query_log("[refresh_custom_app_dev_mirror] pending_index_sql begin");
                    for statement in &pending {
                        query_log(&format!(
                            "[refresh_custom_app_dev_mirror] pending_index_sql {}",
                            statement
                        ));
                    }
                    query_log("[refresh_custom_app_dev_mirror] pending_index_sql end");
                }
                (needed, pending)
            }
            Err(err) => {
                query_log(&format!(
                    "[refresh_custom_app_dev_mirror] sqlite index check skipped err={err}"
                ));
                (false, Vec::new())
            }
        }
    };
    query_log(&format!(
        "[refresh_custom_app_dev_mirror] done copied_files={} mirror_elapsed_ms={} total_elapsed_ms={}",
        copied_files,
        mirror_started.elapsed().as_millis(),
        started.elapsed().as_millis()
    ));
    Ok(CustomAppDevMirrorResult {
        source_path,
        mirrored_index_relative_path: CUSTOM_APP_DEV_MIRROR_INDEX_REL.to_string(),
        copied_files,
        index_defs_loaded: defs.len(),
        index_rebuild_generation,
        index_rebuild_scheduled,
        sqlite_indexes_needed,
        pending_sqlite_index_statements,
    })
}

/// Write arbitrary bytes under the active profile workspace (e.g. `bundles/app-bundle.zip`).
/// Rejects empty paths, `..`, and other traversal attempts.
#[tauri::command]
fn write_workspace_file(
    relative_path: String,
    data: Vec<u8>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let rel = relative_path
        .trim()
        .trim_start_matches(['/', '\\'])
        .to_string();
    if rel.is_empty() {
        return Err("relative path is required".to_string());
    }
    for part in rel.split(['/', '\\']) {
        if part.is_empty() || part == "." || part == ".." {
            return Err("invalid relative path".to_string());
        }
    }
    let dest = ws.join(&rel);
    if !dest.starts_with(&ws) {
        return Err("path escapes workspace".to_string());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&dest, data).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn get_app_bundle_state(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Option<AppBundleState>, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let bundles = ws.join("bundles");
    read_app_bundle_state_unlocked(&bundles).map_err(|e| e.to_string())
}

/// Downloads the active app bundle from Synkronus and applies it under `bundles/active/`.
/// Progress: `bundle/apply-progress` (download/archive/extract) and `bundle/index-rebuild` (background).
#[tauri::command]
async fn download_and_apply_app_bundle(
    app: tauri::AppHandle,
    base_url: String,
    bearer_token: String,
    x_ode_version: String,
    version: String,
    hash: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<DownloadAndApplyAppBundleResult, String> {
    let base = base_url.trim();
    if base.is_empty() {
        return Err("base_url is required".to_string());
    }
    let token = bearer_token.trim();
    if token.is_empty() {
        return Err("bearer token is required".to_string());
    }
    let ode_ver = x_ode_version.trim();
    if ode_ver.is_empty() {
        return Err("x_ode_version is required".to_string());
    }
    let ver = version.trim();
    if ver.is_empty() {
        return Err("version is required".to_string());
    }
    let hash = hash.trim();
    if hash.is_empty() {
        return Err("hash is required".to_string());
    }

    let job_id = Uuid::new_v4().to_string();
    emit_bundle_apply_progress(
        &app,
        &job_id,
        "downloading",
        0,
        0,
        "Downloading bundle from server…",
        None,
    );

    let zip_bytes =
        match download_synkronus_app_bundle_zip(&app, &job_id, base, token, ode_ver).await {
            Ok(b) => b,
            Err(e) => {
                let msg = e.to_string();
                emit_bundle_apply_progress(
                    &app,
                    &job_id,
                    "failed",
                    0,
                    0,
                    "Bundle download failed.",
                    Some(&msg),
                );
                return Err(msg);
            }
        };

    let ctx_inner = ctx.inner().clone();
    let state = match apply_app_bundle_zip_bytes(&app, &job_id, &ctx_inner, ver, hash, &zip_bytes) {
        Ok(s) => s,
        Err(e) => {
            let msg = e.to_string();
            emit_bundle_apply_progress(
                &app,
                &job_id,
                "failed",
                0,
                0,
                "Applying bundle failed.",
                Some(&msg),
            );
            return Err(msg);
        }
    };

    emit_bundle_apply_progress(&app, &job_id, "completed", 1, 1, "Bundle applied.", None);

    let needs_index = bundle_app_config_path(&ctx_inner)
        .ok()
        .filter(|p| p.exists())
        .is_some();
    let index_rebuild_scheduled = if needs_index {
        schedule_observation_index_rebuild(&app, &ctx_inner).is_some()
    } else {
        false
    };

    Ok(DownloadAndApplyAppBundleResult {
        state,
        index_rebuild_scheduled,
    })
}

fn reserved_form_dir_name(name: &str) -> bool {
    matches!(name, "extensions" | "question_types" | "validators")
        || name.starts_with('.')
        || name.starts_with("temp_")
}

fn sanitize_form_type_id(raw: &str) -> Result<String, String> {
    let t = raw.trim();
    if t.is_empty() {
        return Err("form_type is required".to_string());
    }
    if t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid form_type".to_string());
    }
    Ok(t.to_string())
}

#[tauri::command]
fn list_active_bundle_forms(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Vec<ActiveBundleFormEntry>, String> {
    let roots = bundle_form_roots_for_ctx(&ctx)?;
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for root in roots {
        let rd = match fs::read_dir(&root) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in rd {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
                continue;
            }
            if reserved_form_dir_name(&name) {
                continue;
            }
            let schema = entry.path().join("schema.json");
            let ui = entry.path().join("ui.json");
            if schema.is_file() && ui.is_file() && seen.insert(name.clone()) {
                out.push(ActiveBundleFormEntry { form_type: name });
            }
        }
    }
    out.sort_by(|a, b| a.form_type.cmp(&b.form_type));
    Ok(out)
}

#[tauri::command]
fn read_bundle_form_spec(
    form_type: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<BundleFormSpec, String> {
    let ft = sanitize_form_type_id(&form_type)?;
    let dev = profile_developer_mode(&ctx)?;
    let seg = bundle_segment(dev);
    let roots = bundle_form_roots_for_ctx(&ctx)?;
    for root in roots {
        let dir = root.join(&ft);
        let schema_path = dir.join("schema.json");
        let ui_path = dir.join("ui.json");
        if schema_path.is_file() && ui_path.is_file() {
            let form_schema: Value =
                serde_json::from_str(&fs::read_to_string(&schema_path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            let ui_schema: Value =
                serde_json::from_str(&fs::read_to_string(&ui_path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            return Ok(BundleFormSpec {
                form_type: ft,
                form_schema,
                ui_schema,
            });
        }
    }
    Err(format!(
        "Form \"{}\" not found under bundles/{seg} (expected schema.json + ui.json).",
        ft
    ))
}

fn scan_js_modules_first_wins(
    workspace: &Path,
    dirs: &[&str],
    validator: bool,
) -> Result<HashMap<String, String>, String> {
    let mut out = HashMap::new();
    for dir in dirs {
        let full = workspace.join(dir);
        if !full.is_dir() {
            continue;
        }
        let rd = fs::read_dir(&full).map_err(|e| e.to_string())?;
        for entry in rd {
            let entry = entry.map_err(|e| e.to_string())?;
            let ty = entry.file_type().map_err(|e| e.to_string())?;
            if !ty.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if out.contains_key(&name) {
                continue;
            }
            let path = if validator {
                entry.path().join("index.js")
            } else {
                let r = entry.path().join("renderer.js");
                if r.is_file() {
                    r
                } else {
                    entry.path().join("index.js")
                }
            };
            if path.is_file() {
                let source = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                out.insert(name, source);
            }
        }
    }
    Ok(out)
}

fn bundle_cqt_to_json(
    custom_types: HashMap<String, String>,
    validators: HashMap<String, String>,
) -> Value {
    let mut m = serde_json::Map::new();
    if !custom_types.is_empty() {
        let mut o = serde_json::Map::new();
        for (k, v) in custom_types {
            let mut inner = serde_json::Map::new();
            inner.insert("source".to_string(), Value::String(v));
            o.insert(k, Value::Object(inner));
        }
        m.insert("custom_types".to_string(), Value::Object(o));
    }
    if !validators.is_empty() {
        let mut o = serde_json::Map::new();
        for (k, v) in validators {
            let mut inner = serde_json::Map::new();
            inner.insert("source".to_string(), Value::String(v));
            o.insert(k, Value::Object(inner));
        }
        m.insert("validators".to_string(), Value::Object(o));
    }
    Value::Object(m)
}

#[tauri::command]
fn read_workspace_text_file(
    relative_path: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    let path = resolve_workspace_path(&ctx, Some(relative_path)).map_err(|e| e.to_string())?;
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let t = path.trim();
    if t.is_empty() {
        return Err("path is empty".to_string());
    }
    fs::write(t, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_active_bundle_forms_file_base_url(
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let dev = profile_developer_mode(&ctx)?;
    let seg = bundle_segment(dev);
    let forms = ws.join("bundles").join(seg).join("forms");
    Url::from_directory_path(&forms)
        .map(|u| u.to_string().trim_end_matches('/').to_string())
        .map_err(|()| format!("failed to build file URL for bundles/{seg}/forms"))
}

/// `file://` URL for an existing directory under the workspace (trailing slash per `Url` rules).
#[tauri::command]
fn workspace_directory_file_url(
    relative_path: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<String, String> {
    let path = resolve_workspace_path(&ctx, Some(relative_path)).map_err(|e| e.to_string())?;
    if !path.exists() {
        return Err(format!("path does not exist: {}", path.display()));
    }
    if !path.is_dir() {
        return Err("path is not a directory".to_string());
    }
    Url::from_directory_path(&path)
        .map(|u| u.to_string())
        .map_err(|()| "invalid directory for file URL".to_string())
}

/// Resolve an attachment basename to a `file://` URL (draft → synced → pending → loose under `attachments/`).
/// Same lookup order as Formulus `resolveAttachmentFileUrl`.
fn resolve_workspace_attachment_file_url(
    file_name: String,
    ctx: &AppCtxHandle,
) -> Result<Option<String>, String> {
    let t = file_name.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment file name".to_string());
    }
    let ws = get_workspace_path(ctx).map_err(|e| e.to_string())?;
    let Some(path) = resolve_attachment_path(&ws, t) else {
        return Ok(None);
    };
    Url::from_file_path(&path)
        .map(|u| Some(u.to_string()))
        .map_err(|()| "invalid file URL".to_string())
}

/// Resolve `attachments/.../<file_name>` to a `file://` URL if the file exists (basename only).
#[tauri::command]
fn workspace_attachment_file_url(
    file_name: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Option<String>, String> {
    resolve_workspace_attachment_file_url(file_name, &ctx)
}

/// Alias for [`workspace_attachment_file_url`] — basename-only resolution across draft/synced/pending.
#[tauri::command]
fn resolve_attachment_file_url(
    file_name: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<Option<String>, String> {
    resolve_workspace_attachment_file_url(file_name, &ctx)
}

#[tauri::command]
fn scan_bundle_custom_question_types(ctx: tauri::State<'_, AppCtxHandle>) -> Result<Value, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let qt_dirs = bundle_relative_dirs_for_ctx(
        &ctx,
        &[
            "app/question_types",
            "app/forms/question_types",
            "question_types",
            "forms/question_types",
        ],
    )?;
    let val_dirs = bundle_relative_dirs_for_ctx(
        &ctx,
        &[
            "app/validators",
            "app/forms/validators",
            "validators",
            "forms/validators",
        ],
    )?;
    let qt_refs: Vec<&str> = qt_dirs.iter().map(String::as_str).collect();
    let val_refs: Vec<&str> = val_dirs.iter().map(String::as_str).collect();
    let custom_types = scan_js_modules_first_wins(&ws, &qt_refs, false)?;
    let validators = scan_js_modules_first_wins(&ws, &val_refs, true)?;
    Ok(bundle_cqt_to_json(custom_types, validators))
}

#[tauri::command]
fn remove_workspace_attachment(
    attachment_id: String,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    remove_workspace_attachment_inner(&ctx, &attachment_id)
}

pub(crate) fn remove_workspace_attachment_inner(
    ctx: &AppCtxHandle,
    attachment_id: &str,
) -> Result<(), String> {
    let ws = get_workspace_path(ctx).map_err(|e| e.to_string())?;
    let t = attachment_id.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment id".to_string());
    }
    let root = attachments_root(&ws);
    let paths = [
        root.join(ATTACH_SUBDIR_DRAFT).join(t),
        root.join(ATTACH_SUBDIR_SYNCED).join(t),
        root.join(ATTACH_SUBDIR_PENDING).join(t),
        root.join(t),
    ];
    for path in paths {
        if path.is_file() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn import_observations_run(
    observations: Vec<ApiObservation>,
    mark_pending: bool,
    ctx: &AppCtxHandle,
) -> Result<ImportResult, String> {
    let mut conn = open_db(ctx).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let mut imported = 0usize;
    let mut conflicts = 0usize;

    let index_defs = load_active_index_defs(ctx);
    for observation in observations {
        if mark_pending {
            upsert_observation_from_local_import(&tx, &observation)
                .map_err(|err| err.to_string())?;
        } else {
            let conflict =
                upsert_observation_from_api(&tx, &observation).map_err(|err| err.to_string())?;
            if conflict {
                conflicts += 1;
            }
        }
        if !index_defs.is_empty() && !mark_pending {
            // Sync pull: update indexes incrementally per page (no full rebuild follows).
            // Local file import: skip here — `import_observations` schedules one background
            // full rebuild after the batch commit (incremental work would be discarded).
            let payload = serde_json::to_string(&observation.data).map_err(|e| e.to_string())?;
            let form_type = observation.form_type.as_deref().unwrap_or("");
            observation_index::incremental_reindex(
                &tx,
                &observation.observation_id,
                form_type,
                &payload,
                &index_defs,
            )
            .map_err(|err| err.to_string())?;
        }
        imported += 1;
    }
    if !mark_pending {
        tx.execute(
            "UPDATE sync_state SET last_pull_at = ?1, last_error = NULL WHERE id = 1",
            params![now_iso()],
        )
        .map_err(|err| err.to_string())?;
    }
    tx.commit().map_err(|err| err.to_string())?;

    Ok(ImportResult {
        imported,
        conflicts,
        attachments_downloaded: 0,
        attachments_failed: 0,
        index_rebuild_scheduled: false,
    })
}

#[tauri::command]
fn import_observations(
    app: tauri::AppHandle,
    observations: Vec<ApiObservation>,
    mark_pending: Option<bool>,
    schedule_index_rebuild: Option<bool>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<ImportResult, String> {
    let ctx_inner = ctx.inner().clone();
    let mark = mark_pending.unwrap_or(false);
    let mut result = import_observations_run(observations, mark, &ctx_inner)?;
    let should_schedule = schedule_index_rebuild.unwrap_or(mark) && result.imported > 0;
    if should_schedule {
        result.index_rebuild_scheduled =
            schedule_observation_index_rebuild(&app, &ctx_inner).is_some();
    }
    Ok(result)
}

#[tauri::command]
fn mark_observations_pushed(
    ids: Vec<String>,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<(), String> {
    mark_observations_pushed_inner(ids, &ctx)
}

pub(crate) fn mark_observations_pushed_inner(
    ids: Vec<String>,
    ctx: &AppCtxHandle,
) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let mut conn = open_db(ctx).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let now = now_iso();
    for raw in ids {
        let id = raw.trim();
        if id.is_empty() {
            continue;
        }
        tx.execute(
            "UPDATE observations
             SET dirty = 0,
                 sync_status = 'clean',
                 conflict_payload = NULL,
                 last_pushed_at = ?1
             WHERE id = ?2",
            params![now, id],
        )
        .map_err(|err| err.to_string())?;
    }
    tx.execute(
        "UPDATE sync_state SET last_push_at = ?1, last_error = NULL WHERE id = 1",
        params![now],
    )
    .map_err(|err| err.to_string())?;
    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_app_health(ctx: tauri::State<'_, AppCtxHandle>) -> Result<AppHealth, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let total_observations: i64 = conn
        .query_row("SELECT COUNT(*) FROM observations", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let dirty_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM observations WHERE dirty = 1 AND sync_status = 'dirty'",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let conflict_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM observations WHERE sync_status = 'conflict'",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let last_save_at: Option<String> = conn
        .query_row("SELECT MAX(last_saved_at) FROM observations", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|err| err.to_string())?
        .flatten();
    let (last_pull_at, last_push_at): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT last_pull_at, last_push_at FROM sync_state WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|err| err.to_string())?;
    let (total_attachment_count, pending_attachment_count) =
        match resolve_active_workspace_dir(&ctx) {
            Ok(ws) => (
                count_all_attachment_files(&ws),
                count_attachment_pending_dir_files(&ws),
            ),
            Err(_) => (0, 0),
        };

    let (workspace_path, db_path_str) = {
        let cfg = ctx
            .config
            .lock()
            .map_err(|_| "failed to lock config".to_string())?;
        let profile = active_profile_ref(&cfg).map_err(|e: CustodianError| e.to_string())?;
        (
            profile.workspace_path.clone(),
            profile.database_path.clone(),
        )
    };

    Ok(AppHealth {
        workspace_path,
        db_path: db_path_str,
        total_observations,
        dirty_count,
        total_attachment_count,
        pending_attachment_count,
        conflict_count,
        last_save_at,
        last_pull_at,
        last_push_at,
    })
}

/// Clears local observations, backup history, attachment files, and generation archives; resets
/// `sync_state` to fresh-install values. Does not modify `bundles/` or app auth.
#[tauri::command]
fn reset_local_workspace_data(ctx: tauri::State<'_, AppCtxHandle>) -> Result<AppHealth, String> {
    with_workspace_fs_exclusive(&ctx, |ctx| {
        let db_path = resolve_db_path(ctx)?;
        let conn = Connection::open(&db_path)?;
        init_db(&conn)?;
        conn.execute("DELETE FROM observation_history", [])?;
        conn.execute("DELETE FROM observations", [])?;
        conn.execute("DELETE FROM observation_index", [])?;
        conn.execute(
            "UPDATE sync_state SET repository_generation = 0, observation_sync_version = 0, \
             last_attachment_version = 0, last_pull_at = NULL, last_push_at = NULL, last_error = NULL \
             WHERE id = 1",
            [],
        )?;
        conn.execute_batch("PRAGMA wal_checkpoint(FULL);")?;
        drop(conn);

        let ws = resolve_active_workspace_dir(ctx)?;
        let att = attachments_root(&ws);
        if att.exists() {
            fs::remove_dir_all(&att)?;
        }
        let prev_gen = ws.join("previous_generations");
        if prev_gen.exists() {
            fs::remove_dir_all(&prev_gen)?;
        }
        ensure_workspace_layout(&ws)?;
        Ok(())
    })
    .map_err(|e: CustodianError| e.to_string())?;
    get_app_health(ctx)
}

#[tauri::command]
async fn synk_login(
    req: SyncLoginRequest,
    ctx: tauri::State<'_, AppCtxHandle>,
) -> Result<AuthSession, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!(
            "{}/api/auth/login",
            req.base_url.trim_end_matches('/')
        ))
        .header(CONTENT_TYPE, "application/json")
        .json(&serde_json::json!({
            "username": req.username,
            "password": req.password
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    if !response.status().is_success() {
        return Err(format!("login failed with status {}", response.status()));
    }
    let payload: Value = response.json().await.map_err(|err| err.to_string())?;
    let token = payload
        .get("token")
        .or_else(|| payload.get("access_token"))
        .or_else(|| payload.get("jwt"))
        .and_then(Value::as_str)
        .ok_or_else(|| "login response does not contain token/access_token/jwt".to_string())?
        .to_string();

    let session = AuthSession {
        base_url: req.base_url,
        token,
    };
    {
        let mut auth_guard = ctx
            .auth
            .lock()
            .map_err(|_| "failed to lock auth state".to_string())?;
        *auth_guard = Some(session.clone());
    }
    Ok(session)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config_dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
            let data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
            fs::create_dir_all(&config_dir).map_err(|err| err.to_string())?;
            fs::create_dir_all(&data_dir).map_err(|err| err.to_string())?;

            let config_path = config_dir.join("config.json");
            let config = load_app_config(&config_path, &data_dir);

            let ctx = Arc::new(AppCtx {
                config_path: config_path.clone(),
                data_dir: data_dir.clone(),
                config: Mutex::new(config),
                auth: Mutex::new(None),
                workspace_sqlite_lock: Mutex::new(()),
                active_sync: Mutex::new(None),
                index_rebuild_gate: Mutex::new(IndexRebuildGate::default()),
            });
            persist_config(&ctx).map_err(|err| err.to_string())?;
            ensure_active_workspace_dirs(&ctx).map_err(|err| err.to_string())?;
            {
                let scoped = open_db(&ctx).map_err(|err| err.to_string())?;
                sync_engine::reconcile_interrupted_running_jobs(&scoped)
                    .map_err(|e| e.to_string())?;
            }
            app.manage(ctx);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_active_profile,
            upsert_profile,
            delete_profile,
            credential_set,
            credential_get,
            credential_delete,
            get_workspace,
            set_workspace,
            list_workspace_items,
            list_observations,
            list_observations_page,
            query_observations,
            start_observation_index_rebuild,
            rebuild_observation_indexes,
            create_observation_sqlite_indexes,
            get_observation_index_status,
            list_dirty_observations,
            list_form_types,
            get_observation_overview,
            get_sync_state,
            set_sync_state,
            archive_workspace_for_repository_generation,
            move_workspace,
            backup_workspace,
            write_workspace_attachment,
            copy_workspace_attachment_from_path,
            expand_import_staging_paths,
            parse_import_observation_json_paths,
            copy_workspace_attachments_batch,
            read_host_text_file,
            host_path_is_directory,
            read_host_text_files_batch,
            download_workspace_attachment_from_url,
            upload_outbound_attachments,
            check_workspace_attachment_presence,
            write_workspace_file,
            get_app_bundle_state,
            refresh_custom_app_dev_mirror,
            download_and_apply_app_bundle,
            list_active_bundle_forms,
            read_bundle_form_spec,
            read_workspace_text_file,
            write_text_file,
            get_active_bundle_forms_file_base_url,
            workspace_directory_file_url,
            workspace_attachment_file_url,
            resolve_attachment_file_url,
            scan_bundle_custom_question_types,
            remove_workspace_attachment,
            get_observation,
            save_observation,
            import_observations,
            mark_observations_pushed,
            get_app_health,
            reset_local_workspace_data,
            synk_login,
            sync_engine::sync_start,
            sync_engine::sync_pause,
            sync_engine::sync_continue,
            sync_engine::sync_resume_job,
            sync_engine::sync_cancel,
            sync_engine::sync_get_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::{
        ATTACHMENT_COPY_PROGRESS_MIN_INTERVAL, ApiObservation, CompressionMethod,
        ObservationExtras, SimpleFileOptions, ZipWriter, apply_app_bundle_zip_at_workspace,
        attachment_copy_progress_step, bind_query_params, build_observation_overview,
        extract_observations_from_json_value, init_db, mirror_custom_app_dev_folder,
        parse_observation_extras, parse_time, resolve_attachment_path,
        should_emit_attachment_copy_progress, should_mark_conflict,
        upsert_observation_from_local_import, validate_custom_app_dev_source_folder,
    };
    use crate::observation_query::SqlParam;
    use rusqlite::{Connection, params};
    use serde_json::Value;
    use std::time::Instant;

    #[test]
    fn attachment_copy_progress_step_scales_with_batch_size() {
        assert_eq!(attachment_copy_progress_step(5), 1);
        assert_eq!(attachment_copy_progress_step(100), 10);
        assert_eq!(attachment_copy_progress_step(1500), 25);
        assert_eq!(attachment_copy_progress_step(5000), 50);
    }

    #[test]
    fn attachment_copy_progress_emit_first_last_and_interval() {
        let total = 100;
        let step = attachment_copy_progress_step(total);
        let old = Instant::now() - ATTACHMENT_COPY_PROGRESS_MIN_INTERVAL;
        assert!(should_emit_attachment_copy_progress(1, total, step, old));
        assert!(should_emit_attachment_copy_progress(
            total, total, step, old
        ));
        assert!(!should_emit_attachment_copy_progress(
            2,
            total,
            step,
            Instant::now()
        ));
        assert!(should_emit_attachment_copy_progress(
            step,
            total,
            step,
            Instant::now()
        ));
    }

    #[test]
    fn parse_time_handles_valid_timestamp() {
        let parsed = parse_time(&Some("2026-03-28T10:11:12Z".to_string()));
        assert!(parsed.is_some());
    }

    #[test]
    fn conflict_when_local_is_dirty_and_server_newer() {
        let local_remote = Some("2026-03-27T10:00:00Z".to_string());
        let incoming = Some("2026-03-28T10:00:00Z".to_string());
        assert!(should_mark_conflict(true, &local_remote, &incoming));
    }

    #[test]
    fn no_conflict_when_local_not_dirty() {
        let local_remote = Some("2026-03-27T10:00:00Z".to_string());
        let incoming = Some("2026-03-28T10:00:00Z".to_string());
        assert!(!should_mark_conflict(false, &local_remote, &incoming));
    }

    #[test]
    fn sanitize_version_for_filename_keeps_semverish_tokens() {
        assert_eq!(
            super::sanitize_version_for_filename("1.2.3-rc1"),
            "1.2.3-rc1"
        );
        assert_eq!(
            super::sanitize_version_for_filename("weird/name"),
            "weird_name"
        );
    }

    #[test]
    fn resolve_attachment_prefers_draft_over_synced() {
        let base =
            std::env::temp_dir().join(format!("ode_attach_test_draft_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("attachments/draft")).unwrap();
        fs::create_dir_all(base.join("attachments/synced")).unwrap();
        fs::write(base.join("attachments/synced/a.jpg"), b"1").unwrap();
        fs::write(base.join("attachments/draft/a.jpg"), b"2").unwrap();
        let p = resolve_attachment_path(Path::new(&base), "a.jpg").unwrap();
        assert!(p.to_string_lossy().contains("draft"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn validate_custom_app_dev_source_requires_index_html() {
        let base =
            std::env::temp_dir().join(format!("ode_dev_app_validate_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        assert!(validate_custom_app_dev_source_folder(Path::new(&base)).is_err());
        fs::write(base.join("index.html"), b"<html></html>").unwrap();
        assert!(validate_custom_app_dev_source_folder(Path::new(&base)).is_ok());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn mirror_custom_app_dev_folder_copies_tree() {
        let base = std::env::temp_dir().join(format!("ode_dev_app_mirror_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let source = base.join("source");
        let ws = base.join("workspace");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(ws.join("bundles/active/app")).unwrap();
        fs::write(source.join("index.html"), b"<html>dev</html>").unwrap();
        fs::write(source.join("app.js"), b"console.log(1)").unwrap();
        fs::create_dir_all(source.join("forms/demo")).unwrap();
        fs::write(source.join("forms/demo/schema.json"), b"{}").unwrap();
        fs::write(source.join("forms/demo/ui.json"), b"{}").unwrap();
        let copied = mirror_custom_app_dev_folder(Path::new(&ws), Path::new(&source)).unwrap();
        assert_eq!(copied, 6);
        let mirrored = ws.join("bundles/dev-local/app/index.html");
        assert!(mirrored.is_file());
        assert!(ws.join("bundles/dev-local/app/app.js").is_file());
        assert!(
            ws.join("bundles/dev-local/forms/demo/schema.json")
                .is_file()
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn resolve_attachment_falls_back_to_legacy_flat_root() {
        let base =
            std::env::temp_dir().join(format!("ode_attach_test_legacy_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("attachments")).unwrap();
        fs::write(base.join("attachments/b.jpg"), b"x").unwrap();
        let p = resolve_attachment_path(Path::new(&base), "b.jpg").unwrap();
        assert_eq!(p.file_name().unwrap(), "b.jpg");
        assert!(!p.to_string_lossy().contains("synced"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn build_observation_overview_groups_by_form_type_and_pending() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let insert = |id: &str, form_type: &str, dirty: i64, sync_status: &str| {
            conn.execute(
                "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at)
                 VALUES (?1, '{}', ?2, '2026-01-01T00:00:00Z', ?3, ?4, '2026-01-01T00:00:00Z')",
                params![id, form_type, dirty, sync_status],
            )
            .unwrap();
        };
        insert("a1", "hh_hut", 1, "dirty");
        insert("a2", "hh_hut", 0, "clean");
        insert("b1", "hh_person", 1, "dirty");
        insert("c1", "", 0, "clean");

        let result = build_observation_overview(&conn).unwrap();
        assert_eq!(result.rows.len(), 3);

        let hut = result
            .rows
            .iter()
            .find(|r| r.form_type == "hh_hut")
            .unwrap();
        assert_eq!(hut.observation_count, 2);
        assert_eq!(hut.pending_sync_count, 1);

        let no_type = result
            .rows
            .iter()
            .find(|r| r.form_type == "(no form type)")
            .unwrap();
        assert_eq!(no_type.observation_count, 1);

        assert_eq!(result.totals.observation_count, 4);
        assert_eq!(result.totals.pending_sync_count, 2);
        assert_eq!(result.geolocation_summary.with_location, 0);
        assert_eq!(result.geolocation_summary.without_location, 4);
        assert_eq!(result.map.points.len(), 0);
    }

    #[test]
    fn build_observation_overview_timeline_uses_day_buckets_under_one_year() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let insert = |id: &str, created_at: &str| {
            let extras = format!(r#"{{"createdAt":"{created_at}"}}"#);
            conn.execute(
                "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at, observation_extras)
                 VALUES (?1, '{}', 'hh_hut', ?2, 0, 'clean', ?2, ?3)",
                params![id, created_at, extras],
            )
            .unwrap();
        };
        insert("a", "2026-01-01T10:00:00Z");
        insert("b", "2026-01-01T12:00:00Z");
        insert("c", "2026-01-03T12:00:00Z");

        let result = build_observation_overview(&conn).unwrap();
        assert_eq!(result.timeline.bucket_unit, "day");
        assert_eq!(result.timeline.buckets.len(), 3);
        assert_eq!(result.timeline.buckets[0].count, 2);
        assert_eq!(result.timeline.buckets[1].count, 0);
        assert_eq!(result.timeline.buckets[2].count, 1);
        assert_eq!(result.timeline.observations_without_date, 0);
    }

    #[test]
    fn build_observation_overview_extracts_geolocation_and_map_points() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let extras = r#"{"createdAt":"2026-01-01T10:00:00Z","geolocation":{"latitude":1.23,"longitude":4.56}}"#;
        conn.execute(
            "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at, observation_extras)
             VALUES ('obs-1', '{}', 'hh_hut', '2026-01-01T10:00:00Z', 0, 'clean', '2026-01-01T10:00:00Z', ?1)",
            params![extras],
        )
        .unwrap();

        let result = build_observation_overview(&conn).unwrap();
        assert_eq!(result.geolocation_summary.with_location, 1);
        assert_eq!(result.geolocation_summary.without_location, 0);
        assert_eq!(result.map.points.len(), 1);
        assert!((result.map.points[0].latitude - 1.23).abs() < f64::EPSILON);
        assert_eq!(result.map.points[0].form_type, "hh_hut");
    }

    #[test]
    fn extract_observations_from_json_value_preserves_envelope_extras() {
        let root: Value = serde_json::from_str(
            r#"{
              "observation_id": "uuid:test",
              "form_type": "hh_hut",
              "data": { "hh_hut_gps": "{\"latitude\":1}" },
              "updated_at": "2024-07-03T14:39:06.407Z",
              "geolocation": { "latitude": 5.33, "longitude": 36.07 },
              "author": "username:device02",
              "tags": ["migrated"]
            }"#,
        )
        .unwrap();
        let obs = extract_observations_from_json_value(&root, "f.json").unwrap();
        assert_eq!(obs.len(), 1);
        let extras = obs[0].extras.as_ref().unwrap();
        assert_eq!(extras.author.as_deref(), Some("username:device02"));
        assert_eq!(extras.tags.as_deref(), Some(&["migrated".to_string()][..]));
        assert!(extras.geolocation.is_some());
    }

    #[test]
    fn upsert_observation_from_local_import_persists_extras() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let incoming = ApiObservation {
            observation_id: "uuid:import-1".to_string(),
            data: serde_json::json!({ "x": 1 }),
            form_type: Some("hh_hut".to_string()),
            updated_at: Some("2024-07-03T14:39:06.407Z".to_string()),
            extras: Some(ObservationExtras {
                author: Some("username:device02".to_string()),
                tags: Some(vec!["migrated".to_string()]),
                geolocation: Some(serde_json::json!({
                    "latitude": 5.33,
                    "longitude": 36.07
                })),
                ..Default::default()
            }),
        };
        upsert_observation_from_local_import(&conn, &incoming).unwrap();
        let extras_raw: Option<String> = conn
            .query_row(
                "SELECT observation_extras FROM observations WHERE id = ?1",
                params!["uuid:import-1"],
                |row| row.get(0),
            )
            .unwrap();
        let parsed = parse_observation_extras(extras_raw).unwrap();
        assert_eq!(parsed.author.as_deref(), Some("username:device02"));
        assert_eq!(parsed.tags.as_deref(), Some(&["migrated".to_string()][..]));
        assert!(parsed.geolocation.is_some());
    }

    #[test]
    fn bound_query_params_execute_with_raw_query() {
        let conn = Connection::open_in_memory().unwrap();
        let mut stmt = conn.prepare("SELECT ?1 AS a, ?2 AS b").unwrap();
        let params = vec![
            SqlParam::Text("household".to_string()),
            SqlParam::Integer(7),
        ];
        bind_query_params(&mut stmt, &params).unwrap();

        let mut rows = stmt.raw_query();
        let row = rows.next().unwrap().unwrap();
        let a: String = row.get(0).unwrap();
        let b: i64 = row.get(1).unwrap();

        assert_eq!(a, "household");
        assert_eq!(b, 7);
        assert!(rows.next().unwrap().is_none());
    }

    fn minimal_bundle_zip_bytes() -> Vec<u8> {
        use std::io::Write;
        let base =
            std::env::temp_dir().join(format!("ode_bundle_zip_fixture_{}", std::process::id()));
        let zip_path = base.join("fixture.zip");
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        {
            let file = fs::File::create(&zip_path).unwrap();
            let mut zip = ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
            zip.start_file("app/index.html", options).unwrap();
            zip.write_all(b"<html></html>").unwrap();
            zip.finish().unwrap();
        }
        let bytes = fs::read(&zip_path).unwrap();
        let _ = fs::remove_dir_all(&base);
        bytes
    }

    #[test]
    fn apply_app_bundle_zip_at_workspace_writes_state_and_active() {
        let base =
            std::env::temp_dir().join(format!("ode_bundle_apply_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let zip_bytes = minimal_bundle_zip_bytes();
        let state = apply_app_bundle_zip_at_workspace(
            Path::new(&base),
            "1.0.0",
            "abc123",
            &zip_bytes,
            None,
        )
        .unwrap();
        assert_eq!(state.active_version, "1.0.0");
        assert_eq!(state.active_hash, "abc123");
        assert!(base.join("bundles/active/app/index.html").is_file());
        assert!(base.join("bundles/archives/1.0.0.zip").is_file());
        assert!(base.join("bundles/state.json").is_file());
        let _ = fs::remove_dir_all(&base);
    }
}
