//! Persistent `sync_jobs` rows for pause / resume across restarts.

use chrono::Utc;
use rusqlite::{OptionalExtension, params};
use serde::{Deserialize, Serialize};

pub(crate) fn migrate_sync_jobs(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS sync_jobs (
            id TEXT PRIMARY KEY,
            op TEXT NOT NULL,
            status TEXT NOT NULL,
            phase TEXT NOT NULL,
            checkpoint_json TEXT,
            progress_done INTEGER NOT NULL DEFAULT 0,
            progress_total INTEGER NOT NULL DEFAULT 0,
            progress_message TEXT,
            error_code TEXT,
            error_message TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
        "#,
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncJobRowOut {
    pub id: String,
    pub op: String,
    pub status: String,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkpoint_json: Option<String>,
    pub progress_done: i64,
    pub progress_total: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub retry_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_retry_at: Option<String>,
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

pub(crate) fn insert_job(
    conn: &rusqlite::Connection,
    id: &str,
    op: &str,
    status: &str,
    phase: &str,
) -> Result<(), rusqlite::Error> {
    let t = now_rfc3339();
    conn.execute(
        "INSERT INTO sync_jobs (id, op, status, phase, checkpoint_json, progress_done, progress_total, progress_message, error_code, error_message, retry_count, next_retry_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, NULL, 0, 0, NULL, NULL, NULL, 0, NULL, ?5, ?5)",
        params![id, op, status, phase, t],
    )?;
    Ok(())
}

pub(crate) fn update_job_status(
    conn: &rusqlite::Connection,
    id: &str,
    status: &str,
    phase: &str,
    err_code: Option<&str>,
    err_msg: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let t = now_rfc3339();
    conn.execute(
        "UPDATE sync_jobs SET status = ?2, phase = ?3, error_code = ?4, error_message = ?5, updated_at = ?6 WHERE id = ?1",
        params![id, status, phase, err_code, err_msg, t],
    )?;
    Ok(())
}

pub(crate) fn update_job_checkpoint(
    conn: &rusqlite::Connection,
    id: &str,
    phase: &str,
    checkpoint_json: Option<&str>,
    progress_done: i64,
    progress_total: i64,
    progress_message: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let t = now_rfc3339();
    conn.execute(
        "UPDATE sync_jobs SET phase = ?2, checkpoint_json = ?3, progress_done = ?4, progress_total = ?5, progress_message = ?6, updated_at = ?7 WHERE id = ?1",
        params![
            id,
            phase,
            checkpoint_json,
            progress_done,
            progress_total,
            progress_message,
            t
        ],
    )?;
    Ok(())
}

pub(crate) fn clear_retry_fields(
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<(), rusqlite::Error> {
    let t = now_rfc3339();
    conn.execute(
        "UPDATE sync_jobs SET retry_count = 0, next_retry_at = NULL, updated_at = ?2 WHERE id = ?1",
        params![id, t],
    )?;
    Ok(())
}

pub fn load_resumable_job(
    conn: &rusqlite::Connection,
) -> Result<Option<SyncJobRowOut>, rusqlite::Error> {
    let row = conn
        .query_row(
            "SELECT id, op, status, phase, checkpoint_json, progress_done, progress_total, progress_message,
                    error_code, error_message, retry_count, next_retry_at
             FROM sync_jobs
             WHERE status IN ('running', 'paused', 'failed')
             ORDER BY updated_at DESC
             LIMIT 1",
            [],
            |row| {
                Ok(SyncJobRowOut {
                    id: row.get(0)?,
                    op: row.get(1)?,
                    status: row.get(2)?,
                    phase: row.get(3)?,
                    checkpoint_json: row.get(4)?,
                    progress_done: row.get(5)?,
                    progress_total: row.get(6)?,
                    progress_message: row.get(7)?,
                    error_code: row.get(8)?,
                    error_message: row.get(9)?,
                    retry_count: row.get(10)?,
                    next_retry_at: row.get(11)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

pub(crate) fn find_active_running_job(
    conn: &rusqlite::Connection,
) -> Result<Option<String>, rusqlite::Error> {
    let id: Option<String> = conn
        .query_row(
            "SELECT id FROM sync_jobs WHERE status = 'running' ORDER BY updated_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()?;
    Ok(id)
}

pub(crate) fn delete_completed_stale(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM sync_jobs WHERE status IN ('completed', 'cancelled')",
        [],
    )?;
    Ok(())
}

/// Clear every job that is not actively running (paused / failed / completed /
/// cancelled). Used by "Reset local data" so a stale paused or failed job cannot
/// keep blocking a fresh sync after the workspace has been wiped.
pub(crate) fn delete_non_running_jobs(
    conn: &rusqlite::Connection,
) -> Result<usize, rusqlite::Error> {
    let n = conn.execute("DELETE FROM sync_jobs WHERE status != 'running'", [])?;
    Ok(n)
}

/// Rows left `running` after a crash have no in-process worker. Reset them so sync can start again.
pub(crate) fn reconcile_interrupted_running_jobs(
    conn: &rusqlite::Connection,
) -> Result<usize, rusqlite::Error> {
    let t = now_rfc3339();
    let n = conn.execute(
        r#"UPDATE sync_jobs SET status = 'cancelled', phase = 'cancelled',
            error_code = 'interrupted', error_message = 'Sync was interrupted (app closed or crashed).',
            updated_at = ?1
            WHERE status = 'running'"#,
        params![t],
    )?;
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn reconcile_interrupted_running_jobs_clears_running() {
        let conn = Connection::open_in_memory().unwrap();
        migrate_sync_jobs(&conn).unwrap();
        insert_job(&conn, "job-a", "pull", "running", "pull_data").unwrap();
        let n = reconcile_interrupted_running_jobs(&conn).unwrap();
        assert_eq!(n, 1);
        let status: String = conn
            .query_row(
                "SELECT status FROM sync_jobs WHERE id = 'job-a'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "cancelled");
        let code: String = conn
            .query_row(
                "SELECT error_code FROM sync_jobs WHERE id = 'job-a'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(code, "interrupted");
    }

    #[test]
    fn delete_non_running_jobs_clears_failed_and_paused_only() {
        let conn = Connection::open_in_memory().unwrap();
        migrate_sync_jobs(&conn).unwrap();
        insert_job(&conn, "job-failed", "push", "failed", "failed").unwrap();
        insert_job(&conn, "job-paused", "pull", "paused", "needs_auth").unwrap();
        insert_job(&conn, "job-running", "pull", "running", "pull_data").unwrap();

        let n = delete_non_running_jobs(&conn).unwrap();
        assert_eq!(n, 2);

        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM sync_jobs", [], |row| row.get(0))
            .unwrap();
        assert_eq!(remaining, 1);
        let status: String = conn
            .query_row(
                "SELECT status FROM sync_jobs WHERE id = 'job-running'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "running");
    }
}
