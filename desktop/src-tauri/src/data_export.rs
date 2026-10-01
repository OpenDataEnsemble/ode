//! Local Parquet export from the profile workspace SQLite.
//!
//! Produces analyst-compatible files (envelope + top-level `data_*` columns),
//! not bit-for-bit parity with Synkronus server export.

use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    fs::{self, File},
    path::{Path, PathBuf},
    sync::Arc,
};

use arrow::array::{ArrayRef, BooleanBuilder, Float64Builder, Int64Builder, StringBuilder};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use chrono::Utc;
use parquet::arrow::ArrowWriter;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::local_api::forms::FieldInfo;
use crate::{CustodianError, ObservationExtras, resolve_attachment_path};

const EXPORTER_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportParquetRequest {
    /// Parent directory chosen by the user; leaf `YYYYMMDD` is created underneath.
    pub parent_dir: String,
    #[serde(default)]
    pub include_pending: bool,
    #[serde(default)]
    pub include_attachments: bool,
    /// When true, replace an existing `YYYYMMDD` leaf folder.
    #[serde(default)]
    pub overwrite: bool,
    #[serde(default)]
    pub profile_label: Option<String>,
    /// Only export these form types; empty exports all.
    #[serde(default)]
    pub form_types: Vec<String>,
    /// Filled in by the host (Tauri command or `ode` CLI), never by the frontend.
    #[serde(skip)]
    pub context: ExportContext,
}

/// Host-provided extras for an export (see `local_api::export::export_context`).
#[derive(Debug, Clone, Default)]
pub struct ExportContext {
    pub profile_id: Option<String>,
    /// Comment lines prepended to load snippets (see `local_api::hint_lines`).
    pub snippet_hint: Vec<String>,
    /// Field metadata per form type from the profile's bundle, written to the manifest.
    pub form_fields: BTreeMap<String, Vec<FieldInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportParquetResult {
    pub export_dir: String,
    pub form_type_counts: BTreeMap<String, usize>,
    /// Absolute paths keyed by form type (same stem as the `.parquet` file when possible).
    pub parquet_files: BTreeMap<String, String>,
    pub total_rows: usize,
    pub attachments_copied: usize,
    pub attachments_missing: usize,
    pub include_pending: bool,
    pub include_attachments: bool,
    pub workspace_attachments_path: String,
    pub export_attachments_path: Option<String>,
    pub manifest_path: String,
}

/// `export_manifest.json`. Portable: paths are relative to the export folder, no internal paths.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportManifest {
    schema_version: u32,
    exported_at: String,
    exporter_version: String,
    include_pending: bool,
    include_attachments: bool,
    profile_id: Option<String>,
    profile_label: Option<String>,
    form_type_counts: BTreeMap<String, usize>,
    total_rows: usize,
    attachments_copied: usize,
    attachments_missing: usize,
    /// `attachments` when attachments were included.
    attachments_dir: Option<String>,
    forms: Vec<ManifestForm>,
    notice: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestForm {
    form_type: String,
    rows: usize,
    parquet: String,
    /// From the bundle form definition; empty when the form is no longer in the bundle.
    fields: Vec<ManifestField>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestField {
    #[serde(flatten)]
    field: FieldInfo,
    /// Parquet column holding the value; nested objects are stored as JSON strings.
    column: String,
}

const MANIFEST_SCHEMA_VERSION: u32 = 1;
const MANIFEST_NOTICE: &str = "This export may contain sensitive personal data. Handle it according to your project's data protection rules.";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ColKind {
    Float64,
    Boolean,
    String,
}

#[derive(Debug, Clone)]
pub(crate) struct ExportRow {
    observation_id: String,
    form_type: String,
    form_version: String,
    created_at: String,
    updated_at: String,
    synced_at: Option<String>,
    deleted: bool,
    version: i64,
    geolocation: Option<String>,
    author: Option<String>,
    device_id: Option<String>,
    tags: Option<String>,
    pending: bool,
    /// Flattened data for Parquet columns (nested objects stringified).
    data: BTreeMap<String, Value>,
    /// Original observation payload preserved for attachment basename extraction
    /// (nested objects like `{"filename": "photo.jpg", …}` must stay structured).
    raw_payload: Value,
}

impl ExportRow {
    pub(crate) fn form_type(&self) -> &str {
        &self.form_type
    }
}

/// Sanitize a form type for use as a filename stem.
pub fn sanitize_filename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "unknown".to_string()
    } else {
        out
    }
}

/// Identifier safe for R / Python / Julia / Stata frame names.
pub fn sanitize_identifier(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    while out.contains("__") {
        out = out.replace("__", "_");
    }
    let out = out.trim_matches('_').to_string();
    if out.is_empty() {
        "form".to_string()
    } else if out.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        format!("f_{out}")
    } else {
        out
    }
}

/// Progress callback: (done, total, message).
pub type ExportProgressFn<'a> = dyn FnMut(usize, usize, &str) + 'a;

/// Today's export leaf folder name (`YYYYMMDD`).
pub fn export_leaf_folder_name() -> String {
    Utc::now().format("%Y%m%d").to_string()
}

fn value_as_object_map(payload: &Value) -> BTreeMap<String, Value> {
    match payload {
        Value::Object(map) => map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
        _ => BTreeMap::new(),
    }
}

fn json_value_to_export_cell(v: &Value) -> Value {
    match v {
        Value::Null => Value::Null,
        Value::Bool(_) | Value::Number(_) | Value::String(_) => v.clone(),
        other => Value::String(other.to_string()),
    }
}

fn infer_col_kind(values: &[&Value]) -> ColKind {
    let mut saw_bool = false;
    let mut saw_number = false;
    let mut saw_other = false;
    for v in values {
        match v {
            Value::Null => {}
            Value::Bool(_) => saw_bool = true,
            Value::Number(_) => saw_number = true,
            Value::String(_) | Value::Array(_) | Value::Object(_) => saw_other = true,
        }
    }
    if saw_other {
        ColKind::String
    } else if saw_bool && !saw_number {
        ColKind::Boolean
    } else if saw_number && !saw_bool {
        ColKind::Float64
    } else {
        // Mixed bool+number, or all null → string for analyst-safe parquet.
        ColKind::String
    }
}

struct DbExportCandidate {
    id: String,
    payload: Value,
    form_type: Option<String>,
    updated_at: Option<String>,
    dirty: bool,
    sync_status: String,
    last_saved_at: String,
    extras: Option<ObservationExtras>,
}

fn row_from_db(c: DbExportCandidate) -> ExportRow {
    let form_type = c
        .form_type
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "unknown".to_string());
    let pending = c.dirty && c.sync_status == "dirty";
    let created_at = c
        .extras
        .as_ref()
        .and_then(|e| e.created_at.clone())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| c.last_saved_at.clone());
    let updated = c
        .updated_at
        .filter(|s| !s.is_empty())
        .unwrap_or(c.last_saved_at);
    let form_version = c
        .extras
        .as_ref()
        .and_then(|e| e.form_version.clone())
        .unwrap_or_default();
    let synced_at = c.extras.as_ref().and_then(|e| e.synced_at.clone());
    let geolocation = c.extras.as_ref().and_then(|e| {
        e.geolocation
            .as_ref()
            .map(|g| g.to_string())
            .filter(|s| s != "null")
    });
    let author = c.extras.as_ref().and_then(|e| e.author.clone());
    let device_id = c.extras.as_ref().and_then(|e| e.device_id.clone());
    let tags = c
        .extras
        .as_ref()
        .and_then(|e| e.tags.as_ref().and_then(|t| serde_json::to_string(t).ok()));
    let data = value_as_object_map(&c.payload)
        .into_iter()
        .map(|(k, v)| (k, json_value_to_export_cell(&v)))
        .collect();
    ExportRow {
        observation_id: c.id,
        form_type,
        form_version,
        created_at,
        updated_at: updated,
        synced_at,
        deleted: false,
        version: 0,
        geolocation,
        author,
        device_id,
        tags,
        pending,
        data,
        raw_payload: c.payload,
    }
}

/// Load exportable rows; `form_types` empty means all forms.
pub(crate) fn load_export_rows(
    conn: &Connection,
    include_pending: bool,
    form_types: &[String],
) -> Result<Vec<ExportRow>, CustodianError> {
    let mut sql = String::from(
        "SELECT id, payload, form_type, updated_at, dirty, sync_status, last_saved_at, observation_extras
         FROM observations
         WHERE deleted = 0 AND sync_status != 'conflict'",
    );
    if !include_pending {
        sql.push_str(" AND dirty = 0");
    }
    if !form_types.is_empty() {
        let placeholders = vec!["?"; form_types.len()].join(", ");
        sql.push_str(&format!(" AND form_type IN ({placeholders})"));
    }
    sql.push_str(" ORDER BY COALESCE(form_type, ''), id");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(form_types.iter()), |row| {
        let payload_raw: String = row.get(1)?;
        let payload = serde_json::from_str::<Value>(&payload_raw).unwrap_or(Value::Null);
        let dirty: i64 = row.get(4)?;
        let extras_raw: Option<String> = row.get(7)?;
        let extras = extras_raw.and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                serde_json::from_str(t).ok()
            }
        });
        Ok((
            row.get::<_, String>(0)?,
            payload,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            dirty == 1,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            extras,
        ))
    })?;

    let mut out = Vec::new();
    for row in rows {
        let (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at, extras) = row?;
        out.push(row_from_db(DbExportCandidate {
            id,
            payload,
            form_type,
            updated_at,
            dirty,
            sync_status,
            last_saved_at,
            extras,
        }));
    }
    Ok(out)
}

fn schema_for_rows(rows: &[ExportRow]) -> (Schema, Vec<(String, ColKind)>) {
    let mut key_values: BTreeMap<String, Vec<&Value>> = BTreeMap::new();
    for row in rows {
        for (k, v) in &row.data {
            key_values.entry(k.clone()).or_default().push(v);
        }
    }
    let data_cols: Vec<(String, ColKind)> = key_values
        .iter()
        .map(|(k, vals)| (k.clone(), infer_col_kind(vals)))
        .collect();

    let mut fields = vec![
        Field::new("observation_id", DataType::Utf8, false),
        Field::new("form_type", DataType::Utf8, false),
        Field::new("form_version", DataType::Utf8, false),
        Field::new("created_at", DataType::Utf8, false),
        Field::new("updated_at", DataType::Utf8, false),
        Field::new("synced_at", DataType::Utf8, true),
        Field::new("deleted", DataType::Boolean, false),
        Field::new("version", DataType::Int64, false),
        Field::new("geolocation", DataType::Utf8, true),
        Field::new("author", DataType::Utf8, true),
        Field::new("device_id", DataType::Utf8, true),
        Field::new("tags", DataType::Utf8, true),
        Field::new("pending", DataType::Boolean, false),
    ];
    for (key, kind) in &data_cols {
        let dt = match kind {
            ColKind::Float64 => DataType::Float64,
            ColKind::Boolean => DataType::Boolean,
            ColKind::String => DataType::Utf8,
        };
        fields.push(Field::new(format!("data_{key}"), dt, true));
    }
    (Schema::new(fields), data_cols)
}

fn append_optional_string(builder: &mut StringBuilder, value: &Option<String>) {
    match value {
        Some(s) => builder.append_value(s),
        None => builder.append_null(),
    }
}

fn cell_as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn cell_as_bool(v: &Value) -> Option<bool> {
    match v {
        Value::Bool(b) => Some(*b),
        Value::String(s) => match s.to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => Some(true),
            "false" | "0" | "no" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

fn cell_as_string(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

fn build_record_batch(
    rows: &[ExportRow],
    schema: &Schema,
    data_cols: &[(String, ColKind)],
) -> Result<RecordBatch, CustodianError> {
    let n = rows.len();
    let mut obs_id = StringBuilder::with_capacity(n, n * 36);
    let mut form_type = StringBuilder::with_capacity(n, n * 16);
    let mut form_version = StringBuilder::with_capacity(n, n * 8);
    let mut created_at = StringBuilder::with_capacity(n, n * 24);
    let mut updated_at = StringBuilder::with_capacity(n, n * 24);
    let mut synced_at = StringBuilder::with_capacity(n, n * 24);
    let mut deleted = BooleanBuilder::with_capacity(n);
    let mut version = Int64Builder::with_capacity(n);
    let mut geolocation = StringBuilder::with_capacity(n, n * 32);
    let mut author = StringBuilder::with_capacity(n, n * 16);
    let mut device_id = StringBuilder::with_capacity(n, n * 16);
    let mut tags = StringBuilder::with_capacity(n, n * 16);
    let mut pending = BooleanBuilder::with_capacity(n);

    for row in rows {
        obs_id.append_value(&row.observation_id);
        form_type.append_value(&row.form_type);
        form_version.append_value(&row.form_version);
        created_at.append_value(&row.created_at);
        updated_at.append_value(&row.updated_at);
        append_optional_string(&mut synced_at, &row.synced_at);
        deleted.append_value(row.deleted);
        version.append_value(row.version);
        append_optional_string(&mut geolocation, &row.geolocation);
        append_optional_string(&mut author, &row.author);
        append_optional_string(&mut device_id, &row.device_id);
        append_optional_string(&mut tags, &row.tags);
        pending.append_value(row.pending);
    }

    let mut columns: Vec<ArrayRef> = vec![
        Arc::new(obs_id.finish()),
        Arc::new(form_type.finish()),
        Arc::new(form_version.finish()),
        Arc::new(created_at.finish()),
        Arc::new(updated_at.finish()),
        Arc::new(synced_at.finish()),
        Arc::new(deleted.finish()),
        Arc::new(version.finish()),
        Arc::new(geolocation.finish()),
        Arc::new(author.finish()),
        Arc::new(device_id.finish()),
        Arc::new(tags.finish()),
        Arc::new(pending.finish()),
    ];

    for (key, kind) in data_cols {
        match kind {
            ColKind::Float64 => {
                let mut b = Float64Builder::with_capacity(n);
                for row in rows {
                    match row.data.get(key) {
                        None | Some(Value::Null) => b.append_null(),
                        Some(v) => match cell_as_f64(v) {
                            Some(f) => b.append_value(f),
                            None => b.append_null(),
                        },
                    }
                }
                columns.push(Arc::new(b.finish()));
            }
            ColKind::Boolean => {
                let mut b = BooleanBuilder::with_capacity(n);
                for row in rows {
                    match row.data.get(key) {
                        None | Some(Value::Null) => b.append_null(),
                        Some(v) => match cell_as_bool(v) {
                            Some(x) => b.append_value(x),
                            None => b.append_null(),
                        },
                    }
                }
                columns.push(Arc::new(b.finish()));
            }
            ColKind::String => {
                let mut b = StringBuilder::with_capacity(n, n * 16);
                for row in rows {
                    match row.data.get(key) {
                        None | Some(Value::Null) => b.append_null(),
                        Some(v) => b.append_value(cell_as_string(v)),
                    }
                }
                columns.push(Arc::new(b.finish()));
            }
        }
    }

    RecordBatch::try_new(Arc::new(schema.clone()), columns)
        .map_err(|e| CustodianError::Message(format!("arrow record batch: {e}")))
}

fn write_parquet_file(path: &Path, batch: &RecordBatch) -> Result<(), CustodianError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = File::create(path)?;
    let mut writer = ArrowWriter::try_new(file, batch.schema(), None)
        .map_err(|e| CustodianError::Message(format!("parquet writer: {e}")))?;
    writer
        .write(batch)
        .map_err(|e| CustodianError::Message(format!("parquet write: {e}")))?;
    writer
        .close()
        .map_err(|e| CustodianError::Message(format!("parquet close: {e}")))?;
    Ok(())
}

/// Heuristic attachment basename extraction (mirrors Desktop import heuristic).
pub fn collect_attachment_basenames(value: &Value) -> HashSet<String> {
    let mut names = HashSet::new();
    walk_attachment_refs(value, 0, &mut names);
    names
}

fn basename_only(s: &str) -> String {
    let t = s.trim().replace('\\', "/");
    t.rsplit('/').next().unwrap_or(&t).to_string()
}

fn string_looks_like_attachment_ref(s: &str) -> bool {
    let t = s.trim();
    if t.is_empty() || t.len() > 512 {
        return false;
    }
    let b = basename_only(t);
    if b.is_empty() || b.contains("..") {
        return false;
    }
    let lower = b.to_ascii_lowercase();
    const EXTS: &[&str] = &[
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp", ".tif", ".tiff", ".pdf", ".mp3",
        ".wav", ".m4a", ".aac", ".ogg", ".mp4", ".mov", ".webm", ".avi", ".mkv", ".svg", ".bin",
        ".dat", ".zip",
    ];
    if EXTS.iter().any(|e| lower.ends_with(e)) {
        return true;
    }
    // UUID-like attachment ids without extension
    if b.len() >= 32
        && b.chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-' || c == '_')
    {
        return true;
    }
    false
}

fn walk_attachment_refs(v: &Value, depth: usize, out: &mut HashSet<String>) {
    if depth > 16 {
        return;
    }
    match v {
        Value::Null | Value::Bool(_) | Value::Number(_) => {}
        Value::String(s) => {
            if string_looks_like_attachment_ref(s) {
                let b = basename_only(s);
                if !b.is_empty() && !b.contains("..") {
                    out.insert(b);
                }
            }
        }
        Value::Array(arr) => {
            for el in arr {
                walk_attachment_refs(el, depth + 1, out);
            }
        }
        Value::Object(map) => {
            for key in ["attachmentId", "attachment_id", "filename"] {
                if let Some(Value::String(s)) = map.get(key) {
                    let b = basename_only(s);
                    if !b.is_empty() && !b.contains("..") {
                        out.insert(b);
                    }
                }
            }
            for (k, val) in map {
                if k == "filename" || k == "attachmentId" || k == "attachment_id" {
                    continue;
                }
                walk_attachment_refs(val, depth + 1, out);
            }
        }
    }
}

fn prepare_export_dir(parent: &Path, overwrite: bool) -> Result<PathBuf, CustodianError> {
    let leaf = export_leaf_folder_name();
    let dest = parent.join(&leaf);
    if dest.exists() {
        if !overwrite {
            return Err(CustodianError::Message(format!(
                "export folder already exists: {}",
                dest.display()
            )));
        }
        if dest.is_dir() {
            fs::remove_dir_all(&dest)?;
        } else {
            fs::remove_file(&dest)?;
        }
    }
    fs::create_dir_all(&dest)?;
    Ok(dest)
}

fn escape_for_double_quoted(path: &str) -> String {
    path.replace('\\', "\\\\").replace('"', "\\\"")
}

fn escape_for_r_string(path: &str) -> String {
    path.replace('\\', "/").replace('"', "\\\"")
}

fn escape_for_stata(path: &str) -> String {
    path.replace('\\', "/")
}

fn comment_block(prefix: &str, lines: &[String]) -> String {
    let mut out: String = lines
        .iter()
        .map(|l| format!("{prefix} {l}").trim_end().to_string() + "\n")
        .collect();
    if !out.is_empty() {
        out.push('\n');
    }
    out
}

fn write_load_snippets(
    export_dir: &Path,
    parquet_files: &BTreeMap<String, String>,
    hint: &[String],
) -> Result<(), CustodianError> {
    if parquet_files.is_empty() {
        return Ok(());
    }
    let snippets_dir = export_dir.join("snippets");
    fs::create_dir_all(&snippets_dir)?;

    let mut entries: Vec<(&String, &String)> = parquet_files.iter().collect();
    entries.sort_by(|a, b| a.0.cmp(b.0));

    // Deduplicate identifiers if form types collide after sanitize.
    let mut used: HashMap<String, usize> = HashMap::new();
    let mut named: Vec<(String, String)> = Vec::new();
    for (form_type, path) in &entries {
        let base = sanitize_identifier(form_type);
        let n = used.entry(base.clone()).or_insert(0);
        *n += 1;
        let ident = if *n == 1 { base } else { format!("{base}_{n}") };
        named.push((ident, (*path).clone()));
    }

    // R
    {
        let mut body = comment_block("#", hint)
            + "# ODE Desktop export — load Parquet with arrow\nlibrary(arrow)\n\n";
        for (ident, path) in &named {
            body.push_str(&format!(
                "{ident} <- read_parquet(\"{}\")\n",
                escape_for_r_string(path)
            ));
        }
        fs::write(snippets_dir.join("load_r.R"), body)?;
    }

    // Python
    {
        let mut body = comment_block("#", hint)
            + "# ODE Desktop export — load Parquet with pandas\nimport pandas as pd\n\n";
        for (ident, path) in &named {
            body.push_str(&format!(
                "{ident} = pd.read_parquet(r\"{}\")\n",
                path.replace('"', "")
            ));
        }
        fs::write(snippets_dir.join("load_python.py"), body)?;
    }

    // Stata 19+ native import parquet (one frame per form type)
    {
        let mut body = comment_block("*", hint)
            + "* ODE Desktop export — Stata 19+ import parquet (one frame per form type)\n\n";
        for (ident, path) in &named {
            let p = escape_for_stata(path);
            let quoted = if p.contains(char::is_whitespace) {
                format!("\"{p}\"")
            } else {
                p
            };
            body.push_str(&format!("capture frame drop {ident}\n"));
            body.push_str(&format!("frame create {ident}\n"));
            body.push_str(&format!(
                "frame {ident}: import parquet using {quoted}, clear\n\n"
            ));
        }
        fs::write(snippets_dir.join("load_stata.do"), body)?;
    }

    // Julia
    {
        let mut body = comment_block("#", hint)
            + "# ODE Desktop export — load Parquet with Parquet2 + DataFrames\nusing Parquet2, DataFrames\n\n";
        for (ident, path) in &named {
            body.push_str(&format!(
                "{ident} = DataFrame(Parquet2.Dataset(\"{}\"))\n",
                escape_for_double_quoted(path)
            ));
        }
        fs::write(snippets_dir.join("load_julia.jl"), body)?;
    }

    Ok(())
}

fn copy_referenced_attachments_with_progress(
    workspace: &Path,
    export_dir: &Path,
    rows: &[ExportRow],
    progress: &mut ExportProgressFn<'_>,
) -> Result<(usize, usize, PathBuf), CustodianError> {
    let mut names: BTreeSet<String> = BTreeSet::new();
    for row in rows {
        // Use the original (unflattened) payload so that nested attachment
        // objects like `{"filename": "photo.jpg", …}` are walked properly.
        // The Parquet-flattened `row.data` stringifies nested structures,
        // which prevents `walk_attachment_refs` from finding `filename` /
        // `attachmentId` keys inside them.
        for n in collect_attachment_basenames(&row.raw_payload) {
            names.insert(n);
        }
    }
    let att_dir = export_dir.join("attachments");
    fs::create_dir_all(&att_dir)?;
    let total = names.len().max(1);
    let mut copied = 0usize;
    let mut missing = 0usize;
    for (i, name) in names.into_iter().enumerate() {
        progress(
            i,
            total,
            &format!("Copying attachments ({}/{})…", i + 1, total),
        );
        match resolve_attachment_path(workspace, &name) {
            Some(src) => {
                let dest = att_dir.join(&name);
                fs::copy(&src, &dest).map_err(CustodianError::Io)?;
                copied += 1;
            }
            None => {
                missing += 1;
            }
        }
    }
    progress(total, total, "Attachments copy finished");
    Ok((copied, missing, att_dir))
}

/// Write a Parquet export from already-loaded rows (DB lock should be released before calling).
pub fn write_parquet_export(
    workspace: &Path,
    req: &ExportParquetRequest,
    rows: Vec<ExportRow>,
    progress: &mut ExportProgressFn<'_>,
) -> Result<ExportParquetResult, CustodianError> {
    let parent = PathBuf::from(req.parent_dir.trim());
    if parent.as_os_str().is_empty() {
        return Err(CustodianError::Message(
            "parent directory is required".to_string(),
        ));
    }
    if !parent.is_dir() {
        return Err(CustodianError::Message(format!(
            "parent directory does not exist: {}",
            parent.display()
        )));
    }

    progress(0, 1, "Preparing export folder…");
    let export_dir = prepare_export_dir(&parent, req.overwrite)?;

    let mut by_form: BTreeMap<String, Vec<ExportRow>> = BTreeMap::new();
    for row in rows {
        by_form.entry(row.form_type.clone()).or_default().push(row);
    }

    let form_count = by_form.len().max(1);
    let mut form_type_counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut parquet_files: BTreeMap<String, String> = BTreeMap::new();
    let mut manifest_forms: Vec<ManifestForm> = Vec::new();
    let mut total_rows = 0usize;
    let mut used_names: HashMap<String, usize> = HashMap::new();

    for (idx, (form_type, form_rows)) in by_form.iter().enumerate() {
        if form_rows.is_empty() {
            continue;
        }
        progress(
            idx,
            form_count,
            &format!("Writing {form_type}.parquet ({}/{})…", idx + 1, form_count),
        );
        let (schema, data_cols) = schema_for_rows(form_rows);
        let batch = build_record_batch(form_rows, &schema, &data_cols)?;
        let stem = sanitize_filename(form_type);
        let count = used_names.entry(stem.clone()).or_insert(0);
        *count += 1;
        let file_stem = if *count == 1 {
            stem
        } else {
            format!("{stem}_{}", *count)
        };
        let file_name = format!("{file_stem}.parquet");
        let path = export_dir.join(&file_name);
        write_parquet_file(&path, &batch)?;
        manifest_forms.push(ManifestForm {
            form_type: form_type.clone(),
            rows: form_rows.len(),
            parquet: file_name,
            fields: manifest_fields(req.context.form_fields.get(form_type)),
        });
        parquet_files.insert(form_type.clone(), path.to_string_lossy().to_string());
        form_type_counts.insert(form_type.clone(), form_rows.len());
        total_rows += form_rows.len();
    }
    progress(form_count, form_count, "Parquet files written");

    let workspace_attachments_path = workspace.join("attachments");
    let mut attachments_copied = 0usize;
    let mut attachments_missing = 0usize;
    let mut export_attachments_path = None;

    if req.include_attachments {
        let flat: Vec<ExportRow> = by_form.values().flatten().cloned().collect();
        let (copied, missing, att_dir) =
            copy_referenced_attachments_with_progress(workspace, &export_dir, &flat, progress)?;
        attachments_copied = copied;
        attachments_missing = missing;
        export_attachments_path = Some(att_dir.to_string_lossy().to_string());
    }

    progress(0, 1, "Writing load snippets…");
    write_load_snippets(&export_dir, &parquet_files, &req.context.snippet_hint)?;

    let manifest = ExportManifest {
        schema_version: MANIFEST_SCHEMA_VERSION,
        exported_at: Utc::now().to_rfc3339(),
        exporter_version: EXPORTER_VERSION.to_string(),
        include_pending: req.include_pending,
        include_attachments: req.include_attachments,
        profile_id: req.context.profile_id.clone(),
        profile_label: req.profile_label.clone(),
        form_type_counts: form_type_counts.clone(),
        total_rows,
        attachments_copied,
        attachments_missing,
        attachments_dir: req.include_attachments.then(|| "attachments".to_string()),
        forms: manifest_forms,
        notice: MANIFEST_NOTICE,
    };
    let manifest_path = export_dir.join("export_manifest.json");
    fs::write(&manifest_path, serde_json::to_string_pretty(&manifest)?)?;

    progress(1, 1, "Export complete");

    let export_dir_out = export_dir
        .canonicalize()
        .unwrap_or_else(|_| export_dir.clone());

    Ok(ExportParquetResult {
        export_dir: export_dir_out.to_string_lossy().to_string(),
        form_type_counts,
        parquet_files,
        total_rows,
        attachments_copied,
        attachments_missing,
        include_pending: req.include_pending,
        include_attachments: req.include_attachments,
        workspace_attachments_path: workspace_attachments_path.to_string_lossy().to_string(),
        export_attachments_path,
        manifest_path: manifest_path.to_string_lossy().to_string(),
    })
}

fn manifest_fields(fields: Option<&Vec<FieldInfo>>) -> Vec<ManifestField> {
    fields
        .into_iter()
        .flatten()
        .map(|f| {
            let top = f.path.split('.').next().unwrap_or(&f.path);
            ManifestField {
                column: format!("data_{top}"),
                field: f.clone(),
            }
        })
        .collect()
}

/// Preview destination path without writing (`{parent}/{YYYYMMDD}`).
pub fn preview_export_dir(parent_dir: &str) -> Result<String, CustodianError> {
    let parent = PathBuf::from(parent_dir.trim());
    if parent.as_os_str().is_empty() {
        return Err(CustodianError::Message(
            "parent directory is required".to_string(),
        ));
    }
    Ok(parent
        .join(export_leaf_folder_name())
        .to_string_lossy()
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{Connection, params};
    use serde_json::json;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE observations (
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
                observation_extras TEXT,
                deleted INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn sanitize_filename_replaces_unsafe_chars() {
        assert_eq!(sanitize_filename("hh/person"), "hh_person");
        assert_eq!(sanitize_filename(""), "unknown");
    }

    #[test]
    fn infer_col_kind_prefers_string_on_mixed() {
        let a = json!(1);
        let b = json!(true);
        assert_eq!(infer_col_kind(&[&a, &b]), ColKind::String);
        let c = json!(1.5);
        let d = json!(2);
        assert_eq!(infer_col_kind(&[&c, &d]), ColKind::Float64);
        let e = json!(true);
        let f = json!(false);
        assert_eq!(infer_col_kind(&[&e, &f]), ColKind::Boolean);
    }

    #[test]
    fn load_export_rows_filters_in_sql() {
        let conn = setup_db();
        for (id, form_type, deleted, dirty, sync_status) in [
            ("requested-clean", "person", 0, 0, "clean"),
            ("requested-pending", "person", 0, 1, "dirty"),
            ("requested-deleted", "person", 1, 0, "clean"),
            ("requested-conflict", "person", 0, 1, "conflict"),
            ("unrequested-clean", "household", 0, 0, "clean"),
        ] {
            conn.execute(
                "INSERT INTO observations (
                    id, payload, form_type, updated_at, dirty, sync_status,
                    last_saved_at, observation_extras, deleted
                 ) VALUES (?1, '{}', ?2, '2026-01-01T00:00:00Z', ?3, ?4,
                    '2026-01-01T00:00:00Z', '{}', ?5)",
                params![id, form_type, dirty, sync_status, deleted],
            )
            .unwrap();
        }

        let requested = vec!["person".to_string()];
        let rows = load_export_rows(&conn, false, &requested).unwrap();
        assert_eq!(
            rows.iter()
                .map(|row| row.observation_id.as_str())
                .collect::<Vec<_>>(),
            ["requested-clean"]
        );

        let rows = load_export_rows(&conn, true, &requested).unwrap();
        assert_eq!(
            rows.iter()
                .map(|row| row.observation_id.as_str())
                .collect::<Vec<_>>(),
            ["requested-clean", "requested-pending"]
        );

        let rows = load_export_rows(&conn, true, &[]).unwrap();
        assert_eq!(
            rows.iter()
                .map(|row| row.observation_id.as_str())
                .collect::<Vec<_>>(),
            ["unrequested-clean", "requested-clean", "requested-pending"]
        );
    }

    #[test]
    fn flatten_and_write_parquet_roundtrip_shape() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at, observation_extras)
             VALUES (?1, ?2, ?3, ?4, 0, 'clean', ?4, ?5)",
            params![
                "obs-1",
                json!({"age": 12, "name": "Ada", "meta": {"x": 1}}).to_string(),
                "person",
                "2026-01-01T00:00:00Z",
                json!({"formVersion": "1", "createdAt": "2026-01-01T00:00:00Z", "author": "a"}).to_string(),
            ],
        )
        .unwrap();
        // pending row excluded by default
        conn.execute(
            "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at)
             VALUES ('obs-pending', '{}', 'person', '2026-01-02T00:00:00Z', 1, 'dirty', '2026-01-02T00:00:00Z')",
            [],
        )
        .unwrap();
        // conflict excluded
        conn.execute(
            "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at)
             VALUES ('obs-conflict', '{}', 'person', '2026-01-02T00:00:00Z', 1, 'conflict', '2026-01-02T00:00:00Z')",
            [],
        )
        .unwrap();

        let base = std::env::temp_dir().join(format!(
            "ode_export_test_{}_{}",
            std::process::id(),
            Utc::now().timestamp_millis()
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let ws = base.join("workspace");
        fs::create_dir_all(ws.join("attachments")).unwrap();
        let parent = base.join("out");
        fs::create_dir_all(&parent).unwrap();

        let rows = load_export_rows(&conn, false, &[]).unwrap();
        let field = FieldInfo {
            path: "meta.x".into(),
            json_type: Some("integer".into()),
            title: Some("X".into()),
            ..Default::default()
        };
        let result = write_parquet_export(
            &ws,
            &ExportParquetRequest {
                parent_dir: parent.to_string_lossy().to_string(),
                include_pending: false,
                include_attachments: false,
                overwrite: true,
                profile_label: Some("test".into()),
                form_types: vec![],
                context: ExportContext {
                    profile_id: Some("p1".into()),
                    snippet_hint: vec!["AI hint".into()],
                    form_fields: BTreeMap::from([("person".to_string(), vec![field])]),
                },
            },
            rows,
            &mut |_done, _total, _msg| {},
        )
        .unwrap();

        assert_eq!(result.total_rows, 1);
        assert_eq!(result.form_type_counts.get("person"), Some(&1));
        assert!(result.parquet_files.contains_key("person"));
        let parquet_path = PathBuf::from(result.parquet_files.get("person").unwrap());
        assert!(parquet_path.is_file());
        assert!(PathBuf::from(&result.manifest_path).is_file());
        let snippets = PathBuf::from(&result.export_dir).join("snippets");
        let r = fs::read_to_string(snippets.join("load_r.R")).unwrap();
        assert!(r.starts_with("# AI hint\n\n# ODE Desktop export"));
        let stata = fs::read_to_string(snippets.join("load_stata.do")).unwrap();
        assert!(stata.starts_with("* AI hint\n"));

        let manifest: Value =
            serde_json::from_str(&fs::read_to_string(&result.manifest_path).unwrap()).unwrap();
        assert_eq!(manifest["schemaVersion"], json!(1));
        assert_eq!(manifest["profileId"], json!("p1"));
        assert_eq!(manifest["forms"][0]["parquet"], json!("person.parquet"));
        assert_eq!(manifest["forms"][0]["rows"], json!(1));
        assert_eq!(manifest["forms"][0]["fields"][0]["path"], json!("meta.x"));
        assert_eq!(
            manifest["forms"][0]["fields"][0]["column"],
            json!("data_meta")
        );
        let raw = manifest.to_string();
        assert!(!raw.contains(&base.to_string_lossy().replace('\\', "\\\\")));
        assert!(!raw.contains("workspace"));

        let rows = load_export_rows(&conn, true, &[]).unwrap();
        assert_eq!(rows.len(), 2); // clean + pending
        assert!(rows.iter().any(|r| r.pending));
        let rows = load_export_rows(&conn, true, &["other".to_string()]).unwrap();
        assert!(rows.is_empty());

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn collect_attachment_basenames_from_objects() {
        let v = json!({
            "photo": { "filename": "a.jpg", "attachmentId": "uuid-1" },
            "note": "hello",
            "nested": [{ "filename": "b.png" }]
        });
        let names = collect_attachment_basenames(&v);
        assert!(names.contains("a.jpg"));
        assert!(names.contains("uuid-1"));
        assert!(names.contains("b.png"));
        assert!(!names.contains("hello"));
    }

    #[test]
    fn sanitize_identifier_for_languages() {
        assert_eq!(sanitize_identifier("censo_milda"), "censo_milda");
        assert_eq!(sanitize_identifier("hh-person"), "hh_person");
        assert_eq!(sanitize_identifier("2bad"), "f_2bad");
    }

    #[test]
    fn schema_includes_pending_and_data_prefix() {
        let rows = vec![ExportRow {
            observation_id: "1".into(),
            form_type: "f".into(),
            form_version: "1".into(),
            created_at: "t".into(),
            updated_at: "t".into(),
            synced_at: None,
            deleted: false,
            version: 0,
            geolocation: None,
            author: None,
            device_id: None,
            tags: None,
            pending: false,
            data: BTreeMap::from([("age".into(), json!(3))]),
            raw_payload: json!({"age": 3}),
        }];
        let (schema, cols) = schema_for_rows(&rows);
        let names: Vec<_> = schema.fields().iter().map(|f| f.name().clone()).collect();
        assert!(names.contains(&"pending".to_string()));
        assert!(names.contains(&"data_age".to_string()));
        assert_eq!(cols[0].1, ColKind::Float64);
    }

    #[test]
    fn export_copies_attachments_from_nested_photo_objects() {
        // Formulus photo/audio/video fields store nested objects:
        // { "photo": { "filename": "img.jpg", "metadata": {..} } }
        // The Parquet exporter flattens these to strings in `row.data`, but
        // attachment extraction must use the original `raw_payload` to find
        // the nested `filename` key.
        let conn = setup_db();
        let photo_payload = json!({
            "photo": {
                "id": "cam-1",
                "type": "image",
                "filename": "photo-abc123.jpg",
                "timestamp": "2026-06-01T10:00:00Z",
                "metadata": {
                    "width": 1920,
                    "height": 1080,
                    "size": 123456,
                    "mimeType": "image/jpeg",
                    "quality": 80
                }
            },
            "name": "Test observation"
        });
        conn.execute(
            "INSERT INTO observations (id, payload, form_type, updated_at, dirty, sync_status, last_saved_at)
             VALUES (?1, ?2, 'survey', '2026-06-01T10:00:00Z', 0, 'clean', '2026-06-01T10:00:00Z')",
            params!["obs-photo", photo_payload.to_string()],
        )
        .unwrap();

        let base = std::env::temp_dir().join(format!(
            "ode_export_att_test_{}_{}_{}",
            std::process::id(),
            Utc::now().timestamp_millis(),
            line!()
        ));
        let _ = fs::remove_dir_all(&base);
        let ws = base.join("workspace");
        // Place a fake attachment file in the synced sub-directory.
        let synced_dir = ws.join("attachments").join("synced");
        fs::create_dir_all(&synced_dir).unwrap();
        fs::write(synced_dir.join("photo-abc123.jpg"), b"fake-jpeg").unwrap();

        let parent = base.join("out");
        fs::create_dir_all(&parent).unwrap();

        let rows = load_export_rows(&conn, false, &[]).unwrap();
        assert_eq!(rows.len(), 1);

        let result = write_parquet_export(
            &ws,
            &ExportParquetRequest {
                parent_dir: parent.to_string_lossy().to_string(),
                include_pending: false,
                include_attachments: true,
                overwrite: true,
                profile_label: None,
                form_types: vec![],
                context: ExportContext::default(),
            },
            rows,
            &mut |_done, _total, _msg| {},
        )
        .unwrap();

        assert_eq!(
            result.attachments_copied, 1,
            "should copy the photo attachment"
        );
        assert_eq!(result.attachments_missing, 0);
        let export_att = PathBuf::from(result.export_attachments_path.as_ref().unwrap());
        assert!(
            export_att.join("photo-abc123.jpg").is_file(),
            "attachment file should exist in export"
        );

        let _ = fs::remove_dir_all(&base);
    }
}
