//! Rust-first sync orchestration: pull / push / admin reset with checkpoints, retries, pause/resume/cancel.

mod api;
mod job;
mod retry;

use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use tokio::sync::Notify;

pub(crate) fn migrate_sync_jobs_db(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
    job::migrate_sync_jobs(conn)
}

pub(crate) fn reconcile_interrupted_running_jobs(
    conn: &rusqlite::Connection,
) -> Result<usize, rusqlite::Error> {
    job::reconcile_interrupted_running_jobs(conn)
}

/// Drop paused / failed / completed / cancelled job rows so a local-data reset
/// leaves no stale job that would keep blocking the next sync.
pub(crate) fn clear_non_running_jobs_db(
    conn: &rusqlite::Connection,
) -> Result<usize, rusqlite::Error> {
    job::delete_non_running_jobs(conn)
}

pub(crate) use api::SyncHttpClient;

#[derive(Clone)]
pub(crate) struct ActiveSyncHandle {
    pub job_id: String,
    pub paused: Arc<AtomicBool>,
    pub cancelled: Arc<AtomicBool>,
    pub resume: Arc<Notify>,
}

impl ActiveSyncHandle {
    pub fn new(job_id: String) -> Self {
        Self {
            job_id,
            paused: Arc::new(AtomicBool::new(false)),
            cancelled: Arc::new(AtomicBool::new(false)),
            resume: Arc::new(Notify::new()),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushPreparePayload {
    pub ready_observation_ids: Vec<String>,
    /// Legacy clients sent observation refs here; uploads use `attachments/pending/` only.
    #[serde(default)]
    #[allow(dead_code)]
    pub extra_attachment_ids: Vec<String>,
    #[serde(default)]
    pub skip_summary: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStartRequest {
    pub op: String,
    pub base_url: String,
    pub bearer_token: String,
    pub client_id: String,
    pub x_ode_version: String,
    #[serde(default)]
    pub push_prepare: Option<SyncPushPreparePayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStartAck {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncProgressEvent {
    job_id: String,
    op: String,
    phase: String,
    done: i64,
    total: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncStateEvent {
    job_id: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushCheckpoint {
    transmission_id: String,
    repository_generation: i64,
    ready_observation_ids: Vec<String>,
    #[serde(default)]
    skip_summary: Option<String>,
    all_attachment_ids: Vec<String>,
    uploaded_attachment_ids: Vec<String>,
}

/// Attachment uploads follow files under `attachments/pending/` only; union with already-uploaded
/// IDs so resumed jobs shrink bogus checkpoint lists after older clients sent observation refs as extras.
fn reconcile_push_attachment_queue_with_disk(
    ws: &Path,
    checkpoint: &mut PushCheckpoint,
) -> Result<(), String> {
    let pending = crate::collect_outbound_queue_basenames(ws)?;
    let mut merged: HashSet<String> = checkpoint.uploaded_attachment_ids.iter().cloned().collect();
    merged.extend(pending);
    let mut v: Vec<String> = merged.into_iter().collect();
    v.sort();
    checkpoint.all_attachment_ids = v;
    Ok(())
}

struct Cancelled;

async fn wait_unpaused(handle: &ActiveSyncHandle) -> Result<(), Cancelled> {
    loop {
        if handle.cancelled.load(Ordering::SeqCst) {
            return Err(Cancelled);
        }
        if !handle.paused.load(Ordering::SeqCst) {
            return Ok(());
        }
        handle.resume.notified().await;
    }
}

struct ProgressEmit<'a> {
    job_id: &'a str,
    op: &'a str,
    phase: &'a str,
    done: i64,
    total: i64,
    detail: Option<&'a str>,
    message: &'a str,
}

fn emit_progress(app: &AppHandle, p: ProgressEmit<'_>) {
    let _ = app.emit(
        "sync/progress",
        SyncProgressEvent {
            job_id: p.job_id.to_string(),
            op: p.op.to_string(),
            phase: p.phase.to_string(),
            done: p.done,
            total: p.total,
            detail: p.detail.map(|s| s.to_string()),
            message: p.message.to_string(),
        },
    );
}

fn emit_sync_state(
    app: &AppHandle,
    job_id: &str,
    status: &str,
    code: Option<&str>,
    msg: Option<&str>,
) {
    let _ = app.emit(
        "sync/state",
        SyncStateEvent {
            job_id: job_id.to_string(),
            status: status.to_string(),
            error_code: code.map(|s| s.to_string()),
            error_message: msg.map(|s| s.to_string()),
        },
    );
}

fn read_sync_tuple(ctx: &crate::AppCtxHandle) -> Result<(i64, i64, i64), String> {
    let conn = crate::open_db(ctx).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT repository_generation, observation_sync_version, last_attachment_version FROM sync_state WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .map_err(|e| e.to_string())
}

fn observation_to_push_json(o: &crate::ObservationRecord) -> Value {
    let form_type = o.form_type.clone().unwrap_or_else(|| "unknown".into());
    let ex = o.extras.as_ref();
    let form_version = ex
        .and_then(|e| e.form_version.clone())
        .unwrap_or_else(|| "1.0.0".into());
    let created_at = ex
        .and_then(|e| e.created_at.clone())
        .filter(|s| !s.trim().is_empty())
        .or_else(|| o.updated_at.clone())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    let updated_at = o
        .updated_at
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| created_at.clone());
    json!({
        "observation_id": o.id.trim(),
        "form_type": form_type,
        "form_version": form_version,
        "data": o.payload.clone(),
        "created_at": created_at,
        "updated_at": updated_at,
        "deleted": ex.and_then(|e| e.deleted).unwrap_or(false),
        "synced_at": ex.and_then(|e| e.synced_at.clone()),
        "geolocation": ex.and_then(|e| e.geolocation.clone()),
        "author": ex.and_then(|e| e.author.clone()),
        "device_id": ex.and_then(|e| e.device_id.clone()),
        "tags": ex.and_then(|e| e.tags.clone()),
    })
}

fn pull_record_to_api_observation(v: &Value) -> Option<crate::ApiObservation> {
    let o = v.as_object()?;
    let tags = o.get("tags").and_then(|t| {
        t.as_array().map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
    });
    let extras = Some(crate::ObservationExtras {
        form_version: o
            .get("form_version")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        created_at: o
            .get("created_at")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        deleted: o.get("deleted").and_then(|x| x.as_bool()),
        synced_at: o
            .get("synced_at")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        geolocation: o.get("geolocation").cloned(),
        author: o
            .get("author")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        device_id: o
            .get("device_id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        tags,
    });
    Some(crate::ApiObservation {
        observation_id: o.get("observation_id")?.as_str()?.to_string(),
        data: o.get("data").cloned().unwrap_or(Value::Null),
        form_type: o
            .get("form_type")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        updated_at: o
            .get("updated_at")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        extras,
    })
}

async fn with_retries_http<F, Fut, T>(label: &'static str, mut op: F) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let mut attempt = 0u32;
    loop {
        match op().await {
            Ok(v) => return Ok(v),
            Err(e) => {
                let transient = e.contains("502")
                    || e.contains("503")
                    || e.contains("504")
                    || e.contains("timed out")
                    || e.contains("timeout")
                    || e.contains("request failed")
                    || e.contains("connection");
                if !transient || attempt >= retry::MAX_STEP_RETRIES {
                    return Err(e);
                }
                retry::sleep_backoff(attempt).await;
                attempt += 1;
                let _ = label;
            }
        }
    }
}

async fn run_push(
    app: AppHandle,
    ctx: &crate::AppCtxHandle,
    job_id: &str,
    handle: &ActiveSyncHandle,
    req: &SyncStartRequest,
    prepare: &SyncPushPreparePayload,
    resume_ck: Option<PushCheckpoint>,
) -> Result<(), String> {
    let api = SyncHttpClient::new(
        req.base_url.clone(),
        req.bearer_token.clone(),
        req.client_id.clone(),
        req.x_ode_version.clone(),
    );
    let ws = crate::resolve_active_workspace_dir(ctx).map_err(|e| e.to_string())?;
    let mut repo_gen = read_sync_tuple(ctx)?.0;

    let mut phase = "align";
    let mut ck = resume_ck;

    if ck.is_none() {
        wait_unpaused(handle)
            .await
            .map_err(|_| "cancelled".to_string())?;
        emit_progress(
            &app,
            ProgressEmit {
                job_id,
                op: "push",
                phase,
                done: 0,
                total: 1,
                detail: None,
                message: "Checking repository generation…",
            },
        );

        log_sync(format!(
            "push align: local_generation={repo_gen} send_generation={}",
            if repo_gen > 0 {
                repo_gen.to_string()
            } else {
                "omit".to_string()
            }
        ));
        let server_gen = if repo_gen <= 0 {
            with_retries_http("probe", || async { api.sync_push_probe(true, 0).await }).await?
        } else {
            match api.sync_push_probe(false, repo_gen).await {
                Ok(g) => g,
                Err(e) => {
                    if api::is_repository_reset_error(&e) {
                        let server = api::repository_reset_server_generation(&e);
                        log_sync(format!(
                            "push probe 409 repository_reset_required local_generation={repo_gen} server_generation={server:?}: {e}"
                        ));
                        return Err(
                            "repository_reset_required: Server repository was reset or upgraded. Pull to archive this generation and align, then push."
                                .to_string(),
                        );
                    }
                    return Err(e);
                }
            }
        };
        log_sync(format!(
            "push probe ok server_generation={server_gen} local_generation={repo_gen}"
        ));

        if repo_gen <= 0 {
            crate::set_sync_state_merge(ctx, Some(server_gen), None, None)?;
            repo_gen = server_gen;
        }

        let transmission_id = uuid::Uuid::new_v4().to_string();
        ck = Some(PushCheckpoint {
            transmission_id,
            repository_generation: repo_gen,
            ready_observation_ids: prepare.ready_observation_ids.clone(),
            skip_summary: prepare.skip_summary.clone(),
            all_attachment_ids: vec![],
            uploaded_attachment_ids: vec![],
        });
    }

    let mut checkpoint = ck.ok_or_else(|| "missing push checkpoint".to_string())?;
    repo_gen = checkpoint.repository_generation;

    phase = "attachments";
    reconcile_push_attachment_queue_with_disk(&ws, &mut checkpoint)?;
    let total_att = checkpoint.all_attachment_ids.len() as i64;
    let uploaded_set: HashSet<String> =
        checkpoint.uploaded_attachment_ids.iter().cloned().collect();

    for id in &checkpoint.all_attachment_ids {
        if uploaded_set.contains(id) {
            continue;
        }
        wait_unpaused(handle)
            .await
            .map_err(|_| "cancelled".to_string())?;

        let done_before = checkpoint.uploaded_attachment_ids.len() as i64;
        emit_progress(
            &app,
            ProgressEmit {
                job_id,
                op: "push",
                phase,
                done: done_before,
                total: total_att,
                detail: Some(id),
                message: "Uploading attachments",
            },
        );

        let Some(src) = crate::first_path_for_attachment_upload(&ws, id) else {
            continue;
        };

        let bytes = std::fs::read(&src).map_err(|e| format!("read attachment {id}: {e}"))?;
        let gen_hdr = (repo_gen > 0).then_some(repo_gen);

        let mut attempt = 0u32;
        loop {
            wait_unpaused(handle)
                .await
                .map_err(|_| "cancelled".to_string())?;
            if handle.cancelled.load(Ordering::SeqCst) {
                return Err("cancelled".to_string());
            }
            let status = api.put_attachment(id, bytes.clone(), gen_hdr).await?;
            if (200..300).contains(&status) {
                if crate::should_promote_upload_source_to_synced(&ws, &src) {
                    let _ = crate::promote_uploaded_queue_file_to_synced(&ws, id, &src);
                }
                checkpoint.uploaded_attachment_ids.push(id.clone());
                let conn = crate::open_db(ctx).map_err(|e| e.to_string())?;
                job::update_job_checkpoint(
                    &conn,
                    job_id,
                    phase,
                    Some(&serde_json::to_string(&checkpoint).map_err(|e| e.to_string())?),
                    checkpoint.uploaded_attachment_ids.len() as i64,
                    total_att,
                    Some("attachments"),
                )
                .map_err(|e| e.to_string())?;
                break;
            }
            if status == 409 {
                if crate::should_promote_upload_source_to_synced(&ws, &src) {
                    let _ = crate::promote_uploaded_queue_file_to_synced(&ws, id, &src);
                }
                checkpoint.uploaded_attachment_ids.push(id.clone());
                let conn = crate::open_db(ctx).map_err(|e| e.to_string())?;
                job::update_job_checkpoint(
                    &conn,
                    job_id,
                    phase,
                    Some(&serde_json::to_string(&checkpoint).map_err(|e| e.to_string())?),
                    checkpoint.uploaded_attachment_ids.len() as i64,
                    total_att,
                    Some("attachments"),
                )
                .map_err(|e| e.to_string())?;
                break;
            }
            if status == 401 || status == 403 {
                return Err(format!("HTTP {status}: unauthorized"));
            }
            if retry::http_status_transient(status) || attempt >= retry::MAX_STEP_RETRIES {
                if attempt >= retry::MAX_STEP_RETRIES {
                    let conn = crate::open_db(ctx).map_err(|e| e.to_string())?;
                    job::update_job_checkpoint(
                        &conn,
                        job_id,
                        phase,
                        Some(&serde_json::to_string(&checkpoint).map_err(|e| e.to_string())?),
                        checkpoint.uploaded_attachment_ids.len() as i64,
                        total_att,
                        Some("attachments"),
                    )
                    .map_err(|e| e.to_string())?;
                    job::update_job_status(
                        &conn,
                        job_id,
                        "paused",
                        phase,
                        Some("transient"),
                        Some(&format!("attachment {id} HTTP {status}")),
                    )
                    .map_err(|e| e.to_string())?;
                    emit_sync_state(
                        &app,
                        job_id,
                        "paused",
                        Some("transient"),
                        Some(&format!("attachment upload stalled ({id})")),
                    );
                    return Err("__sync_paused__".to_string());
                }
                retry::sleep_backoff(attempt).await;
                attempt += 1;
                continue;
            }
            return Err(format!("attachment upload failed ({id}): HTTP {status}"));
        }
    }

    phase = "observations";
    let obs_rows = crate::load_dirty_observations_by_ids(ctx, &checkpoint.ready_observation_ids)?;
    if !checkpoint.ready_observation_ids.is_empty() && obs_rows.is_empty() {
        return Err(
            "Prepared observations no longer match dirty rows locally (workspace may have changed). Try push again."
                .to_string(),
        );
    }
    let records: Vec<Value> = obs_rows.iter().map(observation_to_push_json).collect();
    let n = records.len() as i64;
    let push_msg = format!("Pushing {n} observation(s)…");
    emit_progress(
        &app,
        ProgressEmit {
            job_id,
            op: "push",
            phase,
            done: 0,
            total: n.max(1),
            detail: None,
            message: &push_msg,
        },
    );

    wait_unpaused(handle)
        .await
        .map_err(|_| "cancelled".to_string())?;
    let push_res = with_retries_http("push", || async {
        api.sync_push_records(&checkpoint.transmission_id, repo_gen, records.clone())
            .await
    })
    .await?;

    let pushed_ids: Vec<String> = obs_rows.iter().map(|r| r.id.trim().to_string()).collect();
    let failed = api::failed_record_ids(push_res.failed_records.as_deref().unwrap_or(&[]));
    let failed_set: HashSet<_> = failed.iter().map(|s| s.trim().to_string()).collect();

    let accepted: Vec<String> = pushed_ids
        .into_iter()
        .filter(|id| !failed_set.contains(id.as_str()))
        .collect();

    let failed_n = failed.len();
    let accepted_n = accepted.len();
    if accepted_n > 0 {
        crate::mark_observations_pushed_inner(accepted, ctx)?;
    }
    crate::set_sync_state_merge(ctx, Some(push_res.repository_generation), None, None)?;
    let finish_msg = format!("Push finished: {accepted_n} accepted, {failed_n} rejected.");
    emit_progress(
        &app,
        ProgressEmit {
            job_id,
            op: "push",
            phase,
            done: n,
            total: n.max(1),
            detail: None,
            message: &finish_msg,
        },
    );
    Ok(())
}

async fn run_pull(
    app: AppHandle,
    ctx: &crate::AppCtxHandle,
    job_id: &str,
    handle: &ActiveSyncHandle,
    req: &SyncStartRequest,
) -> Result<(), String> {
    let api = SyncHttpClient::new(
        req.base_url.clone(),
        req.bearer_token.clone(),
        req.client_id.clone(),
        req.x_ode_version.clone(),
    );

    let mut imported_total = 0usize;
    let mut conflicts_total = 0usize;
    let mut attachments_downloaded = 0usize;
    let mut attachments_skipped_local = 0usize;
    let mut attachments_failed = 0usize;

    let (mut repo_gen, mut obs_ver, _) = read_sync_tuple(ctx)?;

    emit_progress(
        &app,
        ProgressEmit {
            job_id,
            op: "pull",
            phase: "import",
            done: 0,
            total: 1,
            detail: None,
            message: "Pulling observations…",
        },
    );

    let mut realigned = false;
    let mut page = loop {
        wait_unpaused(handle)
            .await
            .map_err(|_| "cancelled".to_string())?;
        let since = if obs_ver > 0 { Some(obs_ver) } else { None };
        log_sync(format!(
            "pull start local_generation={repo_gen} since={since:?} send_generation={}",
            if repo_gen > 0 {
                repo_gen.to_string()
            } else {
                "omit".to_string()
            }
        ));
        match with_retries_http("pull", || async {
            api.sync_pull(since, repo_gen, 500).await
        })
        .await
        {
            Ok(page) => {
                log_sync(format!(
                    "pull page ok server_generation={} change_cutoff={} has_more={} records={}",
                    page.repository_generation,
                    page.change_cutoff,
                    page.has_more,
                    page.records.len()
                ));
                if repo_gen > 0 && page.repository_generation > repo_gen {
                    if realigned {
                        return Err(format!(
                            "pull still on older generation after realign (local={repo_gen} server={})",
                            page.repository_generation
                        ));
                    }
                    repo_gen = realign_workspace_after_generation_change(
                        &app,
                        ctx,
                        job_id,
                        &req.op,
                        repo_gen,
                        Some(page.repository_generation),
                    )?;
                    obs_ver = 0;
                    realigned = true;
                    continue;
                }
                break page;
            }
            Err(e) if api::is_repository_reset_error(&e) && !realigned => {
                let server_gen = api::repository_reset_server_generation(&e);
                log_sync(format!(
                    "pull HTTP 409 repository_reset_required local_generation={repo_gen} server_generation={server_gen:?}: {e}"
                ));
                repo_gen = realign_workspace_after_generation_change(
                    &app, ctx, job_id, &req.op, repo_gen, server_gen,
                )?;
                obs_ver = 0;
                realigned = true;
            }
            Err(e) => return Err(e),
        }
    };

    if realigned {
        log_sync(format!(
            "pull resumed after realign local_generation={repo_gen} server_generation={}",
            page.repository_generation
        ));
    }

    loop {
        wait_unpaused(handle)
            .await
            .map_err(|_| "cancelled".to_string())?;
        let api_obs: Vec<crate::ApiObservation> = page
            .records
            .iter()
            .filter_map(pull_record_to_api_observation)
            .collect();
        let imp = crate::import_observations_run(api_obs, false, ctx)?;
        imported_total += imp.imported;
        conflicts_total += imp.conflicts;

        if !page.has_more {
            break;
        }
        page = with_retries_http("pull", || async {
            api.sync_pull(Some(page.change_cutoff), page.repository_generation, 500)
                .await
        })
        .await?;
    }

    crate::set_sync_state_merge(
        ctx,
        Some(page.repository_generation),
        Some(page.change_cutoff),
        None,
    )?;

    let (_, _, last_att_ver) = read_sync_tuple(ctx)?;
    repo_gen = page.repository_generation;

    emit_progress(
        &app,
        ProgressEmit {
            job_id,
            op: "pull",
            phase: "manifest",
            done: 0,
            total: 1,
            detail: None,
            message: "Fetching attachment manifest…",
        },
    );

    let manifest = match api.attachment_manifest(last_att_ver, repo_gen).await {
        Ok(m) => m,
        Err(e) => {
            tracing_or_log(&format!("manifest failed (observations imported): {e}"));
            emit_progress(
                &app,
                ProgressEmit {
                    job_id,
                    op: "pull",
                    phase: "manifest",
                    done: 1,
                    total: 1,
                    detail: None,
                    message: "Attachment manifest skipped.",
                },
            );
            return Ok(());
        }
    };

    let ops = manifest.operations.unwrap_or_default();
    let total_ops = ops.len().max(1) as i64;
    let ws_pull = crate::resolve_active_workspace_dir(ctx).map_err(|e| e.to_string())?;
    for (i, op) in ops.iter().enumerate() {
        wait_unpaused(handle)
            .await
            .map_err(|_| "cancelled".to_string())?;
        emit_progress(
            &app,
            ProgressEmit {
                job_id,
                op: "pull",
                phase: "manifest",
                done: i as i64,
                total: total_ops,
                detail: op.attachment_id.as_deref(),
                message: "Attachment manifest",
            },
        );
        match op.operation.as_str() {
            "download" => {
                if let Some(aid) = op
                    .attachment_id
                    .as_ref()
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                {
                    if crate::skip_manifest_attachment_download(&ws_pull, aid) {
                        attachments_skipped_local += 1;
                        continue;
                    }
                    match api.get_attachment_bytes(aid).await {
                        Ok(bytes) => {
                            let path = crate::attachment_path_synced(&ws_pull, aid);
                            if let Some(parent) = path.parent() {
                                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                            }
                            std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
                            attachments_downloaded += 1;
                        }
                        Err(_) => attachments_failed += 1,
                    }
                }
            }
            "delete" => {
                if let Some(aid) = &op.attachment_id {
                    let _ = crate::remove_workspace_attachment_inner(ctx, aid);
                }
            }
            _ => {}
        }
    }

    let repo_after = manifest.repository_generation.unwrap_or(repo_gen);
    crate::set_sync_state_merge(ctx, Some(repo_after), None, Some(manifest.current_version))?;

    let skip_seg = if attachments_skipped_local > 0 {
        format!(", {attachments_skipped_local} already on disk (skipped download)")
    } else {
        String::new()
    };
    let pull_finish_msg = format!(
        "Pull finished: {imported_total} observations ({conflicts_total} conflicts); \
attachments: {attachments_downloaded} fetched{skip_seg}; {attachments_failed} failed.",
    );
    emit_progress(
        &app,
        ProgressEmit {
            job_id,
            op: "pull",
            phase: "manifest",
            done: total_ops,
            total: total_ops,
            detail: None,
            message: &pull_finish_msg,
        },
    );

    Ok(())
}

fn tracing_or_log(msg: &str) {
    eprintln!("{msg}");
}

fn log_sync(msg: impl std::fmt::Display) {
    eprintln!("[sync] {msg}");
}

/// After a server repository reset, local sqlite/attachments belong to the old
/// epoch. Archive them, then adopt the server generation (or 0 = omit header).
fn realign_workspace_after_generation_change(
    app: &AppHandle,
    ctx: &crate::AppCtxHandle,
    job_id: &str,
    op: &str,
    local_gen: i64,
    server_gen: Option<i64>,
) -> Result<i64, String> {
    log_sync(format!(
        "realigning: archive local_generation={local_gen} adopt server_generation={server_gen:?}"
    ));
    emit_progress(
        app,
        ProgressEmit {
            job_id,
            op,
            phase: "align",
            done: 0,
            total: 1,
            detail: None,
            message: "Server repository was reset. Archiving local data from the previous generation…",
        },
    );
    let dest = crate::archive_workspace_for_repository_generation_inner(ctx)?;
    log_sync(format!("archived previous generation workspace to {dest}"));
    let adopted = server_gen.filter(|g| *g > 0).unwrap_or(0);
    crate::set_sync_state_merge(ctx, Some(adopted), Some(0), Some(0))?;
    // Archive moved the sqlite folder; recreate the running job row in the new DB
    // so later status updates are not no-ops.
    let conn = crate::open_db(ctx).map_err(|e| e.to_string())?;
    let _ = job::insert_job(&conn, job_id, op, "running", "align");
    log_sync(format!(
        "realign complete: local_generation={adopted} (0 omits x-repository-generation)"
    ));
    Ok(adopted)
}

async fn run_job_inner(
    app: AppHandle,
    ctx: crate::AppCtxHandle,
    job_id: String,
    req: SyncStartRequest,
    resume: bool,
) {
    let handle_slot = {
        let guard = ctx.active_sync.lock().unwrap();
        guard.clone()
    };
    let Some(handle) = handle_slot else {
        return;
    };

    let op = req.op.to_lowercase();
    let result = async {
        let resume_push = if resume {
            let row = {
                let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
                conn.query_row(
                    "SELECT checkpoint_json, phase, op FROM sync_jobs WHERE id = ?1",
                    rusqlite::params![job_id],
                    |row| {
                        Ok((
                            row.get::<_, Option<String>>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    },
                )
                .optional()
                .map_err(|e| e.to_string())?
            };
            let Some((ck_json, phase, op_row)) = row else {
                return Err("job not found".to_string());
            };
            if op_row != op {
                return Err("job operation mismatch".to_string());
            }
            if op == "push" && phase == "attachments" {
                let ck: PushCheckpoint = serde_json::from_str(ck_json.as_deref().unwrap_or("{}"))
                    .map_err(|e| e.to_string())?;
                let prepare = SyncPushPreparePayload {
                    ready_observation_ids: ck.ready_observation_ids.clone(),
                    extra_attachment_ids: vec![],
                    skip_summary: ck.skip_summary.clone(),
                };
                Some((prepare, ck))
            } else {
                None
            }
        } else {
            None
        };

        if let Some((prepare, ck)) = resume_push {
            return run_push(
                app.clone(),
                &ctx,
                &job_id,
                &handle,
                &req,
                &prepare,
                Some(ck),
            )
            .await;
        }

        match op.as_str() {
            "push" => {
                let prepare = req
                    .push_prepare
                    .as_ref()
                    .ok_or_else(|| "push_prepare is required for push".to_string())?;
                run_push(app.clone(), &ctx, &job_id, &handle, &req, prepare, None).await
            }
            "pull" => run_pull(app.clone(), &ctx, &job_id, &handle, &req).await,
            "reset" => {
                let api = SyncHttpClient::new(
                    req.base_url.clone(),
                    req.bearer_token.clone(),
                    req.client_id.clone(),
                    req.x_ode_version.clone(),
                );
                emit_progress(
                    &app,
                    ProgressEmit {
                        job_id: &job_id,
                        op: "reset",
                        phase: "admin",
                        done: 0,
                        total: 1,
                        detail: None,
                        message: "Resetting server repository…",
                    },
                );
                wait_unpaused(&handle)
                    .await
                    .map_err(|_| "cancelled".to_string())?;
                let new_gen = api.admin_repository_reset().await?;
                log_sync(format!(
                    "admin repository reset ok server_generation={new_gen}"
                ));
                let local_gen = read_sync_tuple(&ctx)?.0;
                realign_workspace_after_generation_change(
                    &app,
                    &ctx,
                    &job_id,
                    &req.op,
                    local_gen,
                    Some(new_gen),
                )?;
                run_pull(app.clone(), &ctx, &job_id, &handle, &req).await
            }
            _ => Err(format!("unknown sync op: {op}")),
        }
    }
    .await;

    let conn = match crate::open_db(&ctx) {
        Ok(c) => c,
        Err(_) => return,
    };

    match &result {
        Ok(()) => {
            let _ = job::update_job_status(&conn, &job_id, "completed", "done", None, None);
            emit_sync_state(&app, &job_id, "completed", None, None);
        }
        Err(e) if e == "cancelled" => {
            let _ = job::update_job_status(&conn, &job_id, "cancelled", "cancelled", None, None);
            emit_sync_state(&app, &job_id, "cancelled", None, None);
        }
        Err(e) if e == "__sync_paused__" => {
            // Job row marked paused + sync/state emitted; resume via sync_resume_job.
        }
        Err(e) if e.contains("unauthorized") => {
            let _ = job::update_job_status(
                &conn,
                &job_id,
                "paused",
                "needs_auth",
                Some("needs_auth"),
                Some(e.as_str()),
            );
            emit_sync_state(&app, &job_id, "paused", Some("needs_auth"), Some(e));
        }
        Err(e) if api::is_repository_reset_error(e) => {
            let _ = job::update_job_status(
                &conn,
                &job_id,
                "failed",
                "failed",
                Some("repository_reset_required"),
                Some(e.as_str()),
            );
            emit_sync_state(
                &app,
                &job_id,
                "failed",
                Some("repository_reset_required"),
                Some(e),
            );
        }
        Err(e) => {
            let _ = job::update_job_status(
                &conn,
                &job_id,
                "failed",
                "failed",
                Some("error"),
                Some(e.as_str()),
            );
            emit_sync_state(&app, &job_id, "failed", Some("error"), Some(e));
        }
    }

    let mut g = ctx.active_sync.lock().unwrap();
    if g.as_ref().map(|h| h.job_id.as_str()) == Some(job_id.as_str()) {
        *g = None;
    }
}

#[tauri::command]
pub async fn sync_start(
    req: SyncStartRequest,
    app: AppHandle,
    ctx: tauri::State<'_, crate::AppCtxHandle>,
) -> Result<SyncStartAck, String> {
    let op = req.op.to_lowercase();
    if op == "push" && req.push_prepare.is_none() {
        return Err("push_prepare is required for push".to_string());
    }

    {
        let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
        if let Ok(Some(_)) = job::find_active_running_job(&conn) {
            return Err("A sync job is already running.".to_string());
        }
        if let Ok(Some(j)) = job::load_resumable_job(&conn)
            && (j.status == "paused" || j.status == "failed")
        {
            return Err("Resume or cancel the paused sync job first.".to_string());
        }
    }

    {
        let g = ctx.active_sync.lock().map_err(|_| "lock".to_string())?;
        if g.is_some() {
            return Err("Sync already active.".to_string());
        }
    }

    let _ = crate::open_db(&ctx).map_err(|e| e.to_string())?;
    let job_id = uuid::Uuid::new_v4().to_string();
    let handle = ActiveSyncHandle::new(job_id.clone());

    {
        let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
        let _ = job::delete_completed_stale(&conn);
        job::insert_job(&conn, &job_id, &op, "running", "starting").map_err(|e| e.to_string())?;
    }

    {
        let mut g = ctx.active_sync.lock().map_err(|_| "lock".to_string())?;
        *g = Some(handle.clone());
    }

    emit_sync_state(&app, &job_id, "running", None, None);

    let ctx_arc = ctx.inner().clone();
    let app_c = app.clone();
    let req_c = req.clone();
    let jid = job_id.clone();
    tauri::async_runtime::spawn(async move {
        run_job_inner(app_c, ctx_arc, jid, req_c, false).await;
    });
    Ok(SyncStartAck { job_id })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResumeJobRequest {
    pub job_id: String,
    pub base_url: String,
    pub bearer_token: String,
    pub client_id: String,
    pub x_ode_version: String,
}

#[tauri::command]
pub fn sync_pause(ctx: tauri::State<'_, crate::AppCtxHandle>) -> Result<(), String> {
    let g = ctx
        .active_sync
        .lock()
        .map_err(|_| "failed to lock".to_string())?;
    let Some(h) = g.as_ref() else {
        return Err("No active sync.".to_string());
    };
    h.paused.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn sync_continue(ctx: tauri::State<'_, crate::AppCtxHandle>) -> Result<(), String> {
    let g = ctx
        .active_sync
        .lock()
        .map_err(|_| "failed to lock".to_string())?;
    let Some(h) = g.as_ref() else {
        return Err("Nothing to resume in memory.".to_string());
    };
    h.paused.store(false, Ordering::SeqCst);
    h.resume.notify_waiters();
    Ok(())
}

#[tauri::command]
pub async fn sync_resume_job(
    resume: SyncResumeJobRequest,
    app: AppHandle,
    ctx: tauri::State<'_, crate::AppCtxHandle>,
) -> Result<(), String> {
    let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
    let op: String = conn
        .query_row(
            "SELECT op FROM sync_jobs WHERE id = ?1 AND status IN ('paused', 'failed')",
            rusqlite::params![resume.job_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No resumable job with that id.".to_string())?;
    job::update_job_status(&conn, &resume.job_id, "running", "resuming", None, None)
        .map_err(|e| e.to_string())?;
    let _ = job::clear_retry_fields(&conn, &resume.job_id);

    let full = SyncStartRequest {
        op,
        base_url: resume.base_url,
        bearer_token: resume.bearer_token,
        client_id: resume.client_id,
        x_ode_version: resume.x_ode_version,
        push_prepare: None,
    };

    {
        let mut g = ctx.active_sync.lock().map_err(|_| "lock".to_string())?;
        if g.is_some() {
            return Err("Another sync session is active.".to_string());
        }
        *g = Some(ActiveSyncHandle::new(resume.job_id.clone()));
    }

    emit_sync_state(&app, &resume.job_id, "running", None, None);

    let ctx_arc = ctx.inner().clone();
    let app_c = app.clone();
    let jid = resume.job_id.clone();
    let req_c = full;
    tauri::async_runtime::spawn(async move {
        run_job_inner(app_c, ctx_arc, jid, req_c, true).await;
    });
    Ok(())
}

#[tauri::command]
pub async fn sync_cancel(
    job_id: Option<String>,
    app: AppHandle,
    ctx: tauri::State<'_, crate::AppCtxHandle>,
) -> Result<(), String> {
    let target = if let Some(j) = job_id.filter(|s| !s.trim().is_empty()) {
        j
    } else {
        let g = ctx.active_sync.lock().map_err(|_| "lock".to_string())?;
        if let Some(h) = g.as_ref() {
            h.job_id.clone()
        } else {
            drop(g);
            let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
            job::find_active_running_job(&conn)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| {
                    "No active sync job. If sync looks stuck after a crash, restart the app — stale jobs are cleared on startup."
                        .to_string()
                })?
        }
    };
    {
        let g = ctx.active_sync.lock().map_err(|_| "lock".to_string())?;
        if let Some(h) = g.as_ref()
            && h.job_id == target
        {
            h.cancelled.store(true, Ordering::SeqCst);
            h.paused.store(false, Ordering::SeqCst);
            h.resume.notify_waiters();
        }
    }
    let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
    job::update_job_status(&conn, &target, "cancelled", "cancelled", None, None)
        .map_err(|e| e.to_string())?;
    emit_sync_state(&app, &target, "cancelled", None, Some("Sync cancelled."));
    Ok(())
}

#[tauri::command]
pub fn sync_get_status(
    ctx: tauri::State<'_, crate::AppCtxHandle>,
) -> Result<Option<job::SyncJobRowOut>, String> {
    let conn = crate::open_db(&ctx).map_err(|e| e.to_string())?;
    job::load_resumable_job(&conn).map_err(|e| e.to_string())
}
