use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{BufWriter, Cursor},
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::Mutex,
};

use chrono::{DateTime, Utc};
use keyring::Entry;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;
use thiserror::Error;
use url::Url;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

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

/// Client-side guardrail for confirmations (not interpreted by Synkronus).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum ProfileEnvironment {
    #[default]
    Production,
    Staging,
    Development,
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
    environment: ProfileEnvironment,
    #[serde(default)]
    default_app_mode: DefaultAppMode,
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

fn ensure_workspace_layout(workspace: &Path) -> Result<(), CustodianError> {
    fs::create_dir_all(workspace.join("sqlite"))?;
    fs::create_dir_all(workspace.join("attachments"))?;
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

fn ensure_active_workspace_dirs(ctx: &AppCtx) -> Result<(), CustodianError> {
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

#[derive(Debug)]
struct AppCtx {
    config_path: PathBuf,
    data_dir: PathBuf,
    config: Mutex<AppConfigFile>,
    auth: Mutex<Option<AuthSession>>,
    /// Serializes SQLite access and workspace filesystem operations that require a quiesced DB.
    workspace_sqlite_lock: Mutex<()>,
}

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportResult {
    imported: usize,
    conflicts: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppHealth {
    workspace_path: Option<String>,
    db_path: String,
    total_observations: i64,
    dirty_count: i64,
    conflict_count: i64,
    last_save_at: Option<String>,
    last_pull_at: Option<String>,
    last_push_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncLoginRequest {
    base_url: String,
    username: String,
    password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncPullRequest {
    base_url: Option<String>,
    endpoint: Option<String>,
    token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncPushRequest {
    base_url: Option<String>,
    endpoint: Option<String>,
    token: Option<String>,
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
        "INSERT OR IGNORE INTO sync_state(id, last_pull_at, last_push_at, last_error, repository_generation, observation_sync_version, last_attachment_version) VALUES (1, NULL, NULL, NULL, 1, 0, 0)",
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
            "ALTER TABLE sync_state ADD COLUMN repository_generation INTEGER NOT NULL DEFAULT 1",
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
            environment: ProfileEnvironment::default(),
            default_app_mode: DefaultAppMode::default(),
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
            environment: ProfileEnvironment::default(),
            default_app_mode: DefaultAppMode::default(),
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

fn resolve_db_path(ctx: &AppCtx) -> Result<PathBuf, CustodianError> {
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

fn open_db(ctx: &AppCtx) -> Result<ScopedDb<'_>, CustodianError> {
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
fn quiesce_sqlite_unlocked(ctx: &AppCtx) -> Result<(), CustodianError> {
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
fn with_workspace_fs_exclusive<T, F>(ctx: &AppCtx, f: F) -> Result<T, CustodianError>
where
    F: FnOnce(&AppCtx) -> Result<T, CustodianError>,
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
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else {
            fs::copy(&path, &target)?;
        }
    }
    Ok(())
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

fn backup_workspace_zip(ctx: &AppCtx, zip_path: &Path) -> Result<(), CustodianError> {
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

fn extract_zip_to_dir(zip_bytes: &[u8], dest: &Path) -> Result<(), CustodianError> {
    let reader = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| CustodianError::Message(format!("invalid zip: {}", e)))?;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| CustodianError::Message(format!("zip entry: {}", e)))?;
        let rel = match file.enclosed_name() {
            Some(p) => p.to_owned(),
            None => continue,
        };
        let outpath = dest.join(rel);
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
    }
    Ok(())
}

fn read_app_bundle_state_unlocked(bundles_root: &Path) -> Result<Option<AppBundleState>, CustodianError> {
    let path = bundles_root.join("state.json");
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)?;
    let v: AppBundleState =
        serde_json::from_str(&raw).map_err(|e| CustodianError::Message(e.to_string()))?;
    Ok(Some(v))
}

fn persist_config(ctx: &AppCtx) -> Result<(), CustodianError> {
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

fn get_workspace_path(ctx: &AppCtx) -> Result<PathBuf, CustodianError> {
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
    ctx: &AppCtx,
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

fn build_auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

fn read_auth_token(ctx: &AppCtx, explicit: Option<String>) -> Result<String, CustodianError> {
    if let Some(token) = explicit {
        return Ok(token);
    }

    let guard = ctx
        .auth
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock auth state".to_string()))?;
    guard
        .as_ref()
        .map(|session| session.token.clone())
        .ok_or_else(|| {
            CustodianError::Message("no auth token found; call synk_login first".to_string())
        })
}

fn read_base_url(ctx: &AppCtx, explicit: Option<String>) -> Result<String, CustodianError> {
    if let Some(base_url) = explicit {
        return Ok(base_url);
    }

    let guard = ctx
        .auth
        .lock()
        .map_err(|_| CustodianError::Message("failed to lock auth state".to_string()))?;
    guard
        .as_ref()
        .map(|session| session.base_url.clone())
        .ok_or_else(|| {
            CustodianError::Message("no base url found; call synk_login first".to_string())
        })
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
                     last_saved_at = ?4
                 WHERE id = ?5",
                params![
                    payload,
                    incoming.form_type,
                    incoming.updated_at,
                    timestamp,
                    incoming.observation_id
                ],
            )?;
        }
        return Ok(false);
    }

    conn.execute(
        "INSERT INTO observations (
            id, payload, form_type, updated_at, remote_updated_at,
            dirty, sync_status, conflict_payload, last_saved_at, last_pushed_at
         ) VALUES (?1, ?2, ?3, ?4, ?4, 0, 'clean', NULL, ?5, NULL)",
        params![
            incoming.observation_id,
            payload,
            incoming.form_type,
            incoming.updated_at,
            timestamp
        ],
    )?;
    Ok(false)
}

#[tauri::command]
fn get_settings(ctx: tauri::State<'_, AppCtx>) -> Result<SettingsResponse, String> {
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
fn set_active_profile(profile_id: String, ctx: tauri::State<'_, AppCtx>) -> Result<(), String> {
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
fn upsert_profile(mut profile: ServerProfile, ctx: tauri::State<'_, AppCtx>) -> Result<(), String> {
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
fn delete_profile(profile_id: String, ctx: tauri::State<'_, AppCtx>) -> Result<(), String> {
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
    ctx: tauri::State<'_, AppCtx>,
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
    ctx: tauri::State<'_, AppCtx>,
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
    ctx: tauri::State<'_, AppCtx>,
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
fn get_workspace(ctx: tauri::State<'_, AppCtx>) -> Result<Option<String>, String> {
    let cfg = ctx
        .config
        .lock()
        .map_err(|_| "failed to lock config".to_string())?;
    let profile = active_profile_ref(&cfg).map_err(|e: CustodianError| e.to_string())?;
    Ok(profile.workspace_path.clone())
}

#[tauri::command]
fn set_workspace(path: String, ctx: tauri::State<'_, AppCtx>) -> Result<(), String> {
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
    ctx: tauri::State<'_, AppCtx>,
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
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[tauri::command]
fn save_observation(
    req: SaveObservationRequest,
    ctx: tauri::State<'_, AppCtx>,
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
    }
    get_observation(req.id, ctx)
}

#[tauri::command]
fn restore_last_backup(
    observation_id: String,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<ObservationRecord, String> {
    {
        let mut conn = open_db(&ctx).map_err(|err| err.to_string())?;
        let tx = conn.transaction().map_err(|err| err.to_string())?;
        let backup: Option<String> = tx
            .query_row(
                "SELECT payload FROM observation_history WHERE observation_id = ?1 ORDER BY created_at DESC LIMIT 1",
                params![observation_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|err| err.to_string())?;

        let payload = backup.ok_or_else(|| "no backup found".to_string())?;
        let timestamp = now_iso();
        tx.execute(
            "UPDATE observations
             SET payload = ?1, dirty = 1, sync_status = 'dirty', conflict_payload = NULL, last_saved_at = ?2
             WHERE id = ?3",
            params![payload, timestamp, observation_id],
        )
        .map_err(|err| err.to_string())?;
        tx.commit().map_err(|err| err.to_string())?;
    }
    get_observation(observation_id, ctx)
}

#[tauri::command]
fn get_observation(id: String, ctx: tauri::State<'_, AppCtx>) -> Result<ObservationRecord, String> {
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
    ctx: tauri::State<'_, AppCtx>,
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
    ctx: tauri::State<'_, AppCtx>,
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

#[tauri::command]
fn list_form_types(ctx: tauri::State<'_, AppCtx>) -> Result<Vec<String>, String> {
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
struct SyncStateInfo {
    repository_generation: i64,
    observation_sync_version: i64,
    last_attachment_version: i64,
}

#[tauri::command]
fn get_sync_state(ctx: tauri::State<'_, AppCtx>) -> Result<SyncStateInfo, String> {
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
fn set_sync_state(req: SetSyncStateRequest, ctx: tauri::State<'_, AppCtx>) -> Result<(), String> {
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

#[tauri::command]
fn move_workspace(destination: String, ctx: tauri::State<'_, AppCtx>) -> Result<String, String> {
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
fn backup_workspace(zip_path: String, ctx: tauri::State<'_, AppCtx>) -> Result<String, String> {
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
    ctx: tauri::State<'_, AppCtx>,
) -> Result<String, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let stamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let dest = ws
        .join("previous_generations")
        .join(format!("{stamp}_archive"));
    with_workspace_fs_exclusive(&ctx, move |_ctx| {
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
    ctx: tauri::State<'_, AppCtx>,
) -> Result<(), String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let path = ws.join("attachments").join(&attachment_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, data).map_err(|e| e.to_string())
}

/// Write arbitrary bytes under the active profile workspace (e.g. `bundles/app-bundle.zip`).
/// Rejects empty paths, `..`, and other traversal attempts.
#[tauri::command]
fn write_workspace_file(
    relative_path: String,
    data: Vec<u8>,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<String, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let rel = relative_path
        .trim()
        .trim_start_matches(['/', '\\'])
        .to_string();
    if rel.is_empty() {
        return Err("relative path is required".to_string());
    }
    for part in rel.split(|c| c == '/' || c == '\\') {
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
fn get_app_bundle_state(ctx: tauri::State<'_, AppCtx>) -> Result<Option<AppBundleState>, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let bundles = ws.join("bundles");
    read_app_bundle_state_unlocked(&bundles).map_err(|e| e.to_string())
}

/// Writes `bundles/archives/{version}.zip`, replaces `bundles/active/` with extracted contents,
/// and updates `bundles/state.json`. Removes legacy `bundles/app-bundle.zip` if present.
#[tauri::command]
fn apply_app_bundle_download(
    version: String,
    hash: String,
    zip_bytes: Vec<u8>,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<AppBundleState, String> {
    let ver = version.trim();
    if ver.is_empty() {
        return Err("version is required".to_string());
    }
    let hash = hash.trim();
    if hash.is_empty() {
        return Err("hash is required".to_string());
    }
    if zip_bytes.is_empty() {
        return Err("zip is empty".to_string());
    }
    with_workspace_fs_exclusive(&ctx, |ctx| {
        let ws = get_workspace_path(ctx)?;
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
        fs::write(&archive_zip, &zip_bytes)?;
        if active_dir.exists() {
            fs::remove_dir_all(&active_dir)?;
        }
        fs::create_dir_all(&active_dir)?;
        extract_zip_to_dir(&zip_bytes, &active_dir)?;
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
            serde_json::to_string_pretty(&state)
                .map_err(|e| CustodianError::Message(e.to_string()))?,
        )?;
        let legacy = bundles.join("app-bundle.zip");
        if legacy.exists() {
            let _ = fs::remove_file(&legacy);
        }
        Ok(state)
    })
    .map_err(|e: CustodianError| e.to_string())
}

fn active_bundle_form_roots(workspace: &Path) -> Vec<PathBuf> {
    vec![
        workspace.join("bundles/active/forms"),
        workspace.join("bundles/active/app/forms"),
    ]
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
    ctx: tauri::State<'_, AppCtx>,
) -> Result<Vec<ActiveBundleFormEntry>, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for root in active_bundle_form_roots(&ws) {
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
    ctx: tauri::State<'_, AppCtx>,
) -> Result<BundleFormSpec, String> {
    let ft = sanitize_form_type_id(&form_type)?;
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    for root in active_bundle_form_roots(&ws) {
        let dir = root.join(&ft);
        let schema_path = dir.join("schema.json");
        let ui_path = dir.join("ui.json");
        if schema_path.is_file() && ui_path.is_file() {
            let form_schema: Value = serde_json::from_str(
                &fs::read_to_string(&schema_path).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            let ui_schema: Value = serde_json::from_str(
                &fs::read_to_string(&ui_path).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            return Ok(BundleFormSpec {
                form_type: ft,
                form_schema,
                ui_schema,
            });
        }
    }
    Err(format!(
        "Form \"{}\" not found under bundles/active (expected schema.json + ui.json).",
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
    ctx: tauri::State<'_, AppCtx>,
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
    ctx: tauri::State<'_, AppCtx>,
) -> Result<String, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let forms = ws.join("bundles/active/forms");
    Url::from_directory_path(&forms)
        .map(|u| u.to_string().trim_end_matches('/').to_string())
        .map_err(|()| "failed to build file URL for bundles/active/forms".to_string())
}

/// `file://` URL for an existing directory under the workspace (trailing slash per `Url` rules).
#[tauri::command]
fn workspace_directory_file_url(
    relative_path: String,
    ctx: tauri::State<'_, AppCtx>,
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

/// Resolve `attachments/<file_name>` to a `file://` URL if the file exists (basename only; no path segments).
#[tauri::command]
fn workspace_attachment_file_url(
    file_name: String,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<Option<String>, String> {
    let t = file_name.trim();
    if t.is_empty() || t.contains('/') || t.contains('\\') || t.contains("..") {
        return Err("invalid attachment file name".to_string());
    }
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let path = ws.join("attachments").join(t);
    if !path.is_file() {
        return Ok(None);
    }
    Url::from_file_path(&path)
        .map(|u| Some(u.to_string()))
        .map_err(|()| "invalid file URL".to_string())
}

#[tauri::command]
fn scan_bundle_custom_question_types(ctx: tauri::State<'_, AppCtx>) -> Result<Value, String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let qt_dirs = [
        "bundles/active/question_types",
        "bundles/active/forms/question_types",
    ];
    let val_dirs = [
        "bundles/active/validators",
        "bundles/active/forms/validators",
    ];
    let custom_types = scan_js_modules_first_wins(&ws, &qt_dirs, false)?;
    let validators = scan_js_modules_first_wins(&ws, &val_dirs, true)?;
    Ok(bundle_cqt_to_json(custom_types, validators))
}

#[tauri::command]
fn remove_workspace_attachment(
    attachment_id: String,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<(), String> {
    let ws = get_workspace_path(&ctx).map_err(|e| e.to_string())?;
    let path = ws.join("attachments").join(&attachment_id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn import_observations(
    observations: Vec<ApiObservation>,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<ImportResult, String> {
    let mut conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let mut imported = 0usize;
    let mut conflicts = 0usize;

    for observation in observations {
        let conflict =
            upsert_observation_from_api(&tx, &observation).map_err(|err| err.to_string())?;
        imported += 1;
        if conflict {
            conflicts += 1;
        }
    }
    tx.execute(
        "UPDATE sync_state SET last_pull_at = ?1, last_error = NULL WHERE id = 1",
        params![now_iso()],
    )
    .map_err(|err| err.to_string())?;
    tx.commit().map_err(|err| err.to_string())?;

    Ok(ImportResult {
        imported,
        conflicts,
    })
}

#[tauri::command]
fn mark_observations_pushed(ids: Vec<String>, ctx: tauri::State<'_, AppCtx>) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let mut conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let now = now_iso();
    for id in ids {
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
fn get_app_health(ctx: tauri::State<'_, AppCtx>) -> Result<AppHealth, String> {
    let conn = open_db(&ctx).map_err(|err| err.to_string())?;
    let total_observations: i64 = conn
        .query_row("SELECT COUNT(*) FROM observations", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let dirty_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM observations WHERE dirty = 1",
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
        conflict_count,
        last_save_at,
        last_pull_at,
        last_push_at,
    })
}

#[tauri::command]
fn repair_repository(ctx: tauri::State<'_, AppCtx>) -> Result<AppHealth, String> {
    {
        let conn = open_db(&ctx).map_err(|err| err.to_string())?;
        conn.execute_batch("VACUUM; REINDEX;")
            .map_err(|err| err.to_string())?;
    }
    get_app_health(ctx)
}

#[tauri::command]
async fn synk_login(
    req: SyncLoginRequest,
    ctx: tauri::State<'_, AppCtx>,
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

#[tauri::command]
async fn synk_pull(
    req: SyncPullRequest,
    ctx: tauri::State<'_, AppCtx>,
) -> Result<ImportResult, String> {
    let base_url = read_base_url(&ctx, req.base_url).map_err(|err| err.to_string())?;
    let token = read_auth_token(&ctx, req.token).map_err(|err| err.to_string())?;
    let endpoint = req
        .endpoint
        .unwrap_or_else(|| "/api/observations".to_string());
    let url = format!("{}{}", base_url.trim_end_matches('/'), endpoint);

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header(AUTHORIZATION, build_auth_header(&token))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    if !response.status().is_success() {
        return Err(format!("pull failed with status {}", response.status()));
    }
    let body: Value = response.json().await.map_err(|err| err.to_string())?;
    let observations = if body.is_array() {
        serde_json::from_value::<Vec<ApiObservation>>(body).map_err(|err| err.to_string())?
    } else if let Some(value) = body.get("observations") {
        serde_json::from_value::<Vec<ApiObservation>>(value.clone())
            .map_err(|err| err.to_string())?
    } else {
        return Err("pull response does not contain an observations array".to_string());
    };
    import_observations(observations, ctx)
}

#[tauri::command]
async fn synk_push(req: SyncPushRequest, ctx: tauri::State<'_, AppCtx>) -> Result<usize, String> {
    let base_url = read_base_url(&ctx, req.base_url).map_err(|err| err.to_string())?;
    let token = read_auth_token(&ctx, req.token).map_err(|err| err.to_string())?;
    let endpoint = req
        .endpoint
        .unwrap_or_else(|| "/api/observations".to_string());
    let url = format!("{}{}", base_url.trim_end_matches('/'), endpoint);
    let outgoing = {
        let conn = open_db(&ctx).map_err(|err| err.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, payload, form_type, updated_at FROM observations WHERE dirty = 1 ORDER BY last_saved_at ASC",
            )
            .map_err(|err| err.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let payload: String = row.get(1)?;
                let payload_value = serde_json::from_str::<Value>(&payload).unwrap_or(Value::Null);
                Ok(ApiObservation {
                    observation_id: row.get(0)?,
                    data: payload_value,
                    form_type: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|err| err.to_string())?;
        let mut outgoing = Vec::new();
        for item in rows {
            outgoing.push(item.map_err(|err| err.to_string())?);
        }
        outgoing
    };

    if outgoing.is_empty() {
        return Ok(0);
    }

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header(AUTHORIZATION, build_auth_header(&token))
        .header(CONTENT_TYPE, "application/json")
        .json(&serde_json::json!({ "observations": outgoing }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        return Err(format!("push failed with status {}", response.status()));
    }
    let pushed_ids = outgoing
        .into_iter()
        .map(|item| item.observation_id)
        .collect::<Vec<_>>();
    mark_observations_pushed(pushed_ids.clone(), ctx)?;
    Ok(pushed_ids.len())
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

            let ctx = AppCtx {
                config_path: config_path.clone(),
                data_dir: data_dir.clone(),
                config: Mutex::new(config),
                auth: Mutex::new(None),
                workspace_sqlite_lock: Mutex::new(()),
            };
            persist_config(&ctx).map_err(|err| err.to_string())?;
            ensure_active_workspace_dirs(&ctx).map_err(|err| err.to_string())?;
            open_db(&ctx).map_err(|err| err.to_string())?;
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
            list_form_types,
            get_sync_state,
            set_sync_state,
            archive_workspace_for_repository_generation,
            move_workspace,
            backup_workspace,
            write_workspace_attachment,
            write_workspace_file,
            get_app_bundle_state,
            apply_app_bundle_download,
            list_active_bundle_forms,
            read_bundle_form_spec,
            read_workspace_text_file,
            write_text_file,
            get_active_bundle_forms_file_base_url,
            workspace_directory_file_url,
            workspace_attachment_file_url,
            scan_bundle_custom_question_types,
            remove_workspace_attachment,
            get_observation,
            save_observation,
            restore_last_backup,
            import_observations,
            mark_observations_pushed,
            get_app_health,
            repair_repository,
            synk_login,
            synk_pull,
            synk_push
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{parse_time, should_mark_conflict};

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
}
