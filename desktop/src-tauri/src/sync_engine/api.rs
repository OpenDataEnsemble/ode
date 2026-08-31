//! Minimal Synkronus HTTP client for sync (pull/push/manifest/admin reset).

use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Deserializer};
use serde_json::{Value, json};

fn deserialize_null_as_empty_vec<'de, D>(deserializer: D) -> Result<Vec<Value>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt = Option::<Vec<Value>>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

#[derive(Debug, Clone)]
pub(crate) struct SyncHttpClient {
    pub base_url: String,
    pub token: String,
    pub client_id: String,
    pub x_ode_version: String,
    inner: reqwest::Client,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ErrorWire {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SyncPullWire {
    #[serde(default, deserialize_with = "deserialize_null_as_empty_vec")]
    pub records: Vec<Value>,
    #[serde(default)]
    pub has_more: bool,
    pub change_cutoff: i64,
    pub repository_generation: i64,
    /// Returned by Synkronus; kept for serde compatibility.
    #[serde(default)]
    #[allow(dead_code)]
    pub current_version: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) struct SyncPushWire {
    #[serde(default)]
    #[allow(dead_code)]
    pub current_version: Option<i64>,
    pub repository_generation: i64,
    /// Returned by Synkronus; kept for serde compatibility.
    #[serde(default)]
    #[allow(dead_code)]
    pub success_count: Option<i64>,
    #[serde(default)]
    pub failed_records: Option<Vec<Value>>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ManifestWire {
    #[serde(default)]
    pub operations: Option<Vec<ManifestOpWire>>,
    pub current_version: i64,
    #[serde(default)]
    pub repository_generation: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ManifestOpWire {
    pub operation: String,
    #[serde(default)]
    pub attachment_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RepoResetWire {
    #[serde(default)]
    pub repository_generation: Option<i64>,
}

impl SyncHttpClient {
    pub fn new(base_url: String, token: String, client_id: String, x_ode_version: String) -> Self {
        Self {
            base_url,
            token,
            client_id,
            x_ode_version,
            inner: reqwest::Client::new(),
        }
    }

    fn auth_headers(
        &self,
        req: reqwest::RequestBuilder,
        repo_gen: Option<i64>,
    ) -> reqwest::RequestBuilder {
        let mut r = req
            .header(AUTHORIZATION, format!("Bearer {}", self.token.trim()))
            .header("x-ode-version", self.x_ode_version.trim())
            .header("x-ode-client-id", self.client_id.trim());
        if let Some(g) = repo_gen.filter(|g| *g > 0) {
            r = r.header("x-repository-generation", g.to_string());
        }
        r
    }

    pub async fn sync_pull(
        &self,
        since_version: Option<i64>,
        repository_generation: i64,
        limit: i64,
    ) -> Result<SyncPullWire, String> {
        let base = self.base_url.trim_end_matches('/');
        let mut body = json!({
            "client_id": self.client_id.trim(),
        });
        if let Some(v) = since_version {
            body["since"] = json!({ "version": v });
        }
        if repository_generation > 0 {
            body["repository_generation"] = json!(repository_generation);
        }
        let gen_hdr = (repository_generation > 0).then_some(repository_generation);
        let url = format!("{}/api/sync/pull?limit={}", base, limit);
        let res = self
            .auth_headers(self.inner.post(&url).json(&body), gen_hdr)
            .send()
            .await
            .map_err(|e| format!("pull request failed: {e}"))?;
        let status = res.status().as_u16();
        let server_generation = repo_gen_from_headers(res.headers());
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("pull read failed: {e}"))?;
        if status == 401 || status == 403 {
            return Err(format!("HTTP {status}: unauthorized"));
        }
        if status == 409 {
            return Err(parse_repo_conflict(&bytes, server_generation));
        }
        if !status_is_success(status) {
            return Err(format!(
                "pull failed: HTTP {} {}",
                status,
                String::from_utf8_lossy(&bytes)
                    .chars()
                    .take(200)
                    .collect::<String>()
            ));
        }
        serde_json::from_slice(&bytes).map_err(|e| format!("pull decode failed: {e}"))
    }

    /// Empty-body probe: Omits generation when `omit_generation` (fresh install alignment).
    pub async fn sync_push_probe(
        &self,
        omit_generation: bool,
        repository_generation: i64,
    ) -> Result<i64, String> {
        let base = self.base_url.trim_end_matches('/');
        let transmission_id = uuid::Uuid::new_v4().to_string();
        let mut body = json!({
            "transmission_id": transmission_id,
            "client_id": self.client_id.trim(),
            "records": Value::Array(vec![]),
        });
        let gen_hdr = if omit_generation {
            None
        } else if repository_generation > 0 {
            Some(repository_generation)
        } else {
            None
        };
        if let Some(g) = gen_hdr {
            body["repository_generation"] = json!(g);
        }
        let req = self.auth_headers(
            self.inner
                .post(format!("{}/api/sync/push", base))
                .header(CONTENT_TYPE, "application/json")
                .json(&body),
            gen_hdr,
        );
        let res = req
            .send()
            .await
            .map_err(|e| format!("push probe failed: {e}"))?;
        let status = res.status().as_u16();
        let server_generation = repo_gen_from_headers(res.headers());
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("push probe read failed: {e}"))?;
        if status == 401 || status == 403 {
            return Err(format!("HTTP {status}: unauthorized"));
        }
        if status == 409 {
            return Err(parse_repo_conflict(&bytes, server_generation));
        }
        if !status_is_success(status) {
            return Err(format!(
                "push probe failed: HTTP {} {}",
                status,
                String::from_utf8_lossy(&bytes)
                    .chars()
                    .take(200)
                    .collect::<String>()
            ));
        }
        let wire: SyncPushWire =
            serde_json::from_slice(&bytes).map_err(|e| format!("push probe decode: {e}"))?;
        Ok(wire.repository_generation)
    }

    pub async fn sync_push_records(
        &self,
        transmission_id: &str,
        repository_generation: i64,
        records: Vec<Value>,
    ) -> Result<SyncPushWire, String> {
        let base = self.base_url.trim_end_matches('/');
        let mut body = json!({
            "transmission_id": transmission_id,
            "client_id": self.client_id.trim(),
            "records": records,
        });
        let gen_hdr = (repository_generation > 0).then_some(repository_generation);
        if let Some(g) = gen_hdr {
            body["repository_generation"] = json!(g);
        }
        let res = self
            .auth_headers(
                self.inner
                    .post(format!("{}/api/sync/push", base))
                    .header(CONTENT_TYPE, "application/json")
                    .json(&body),
                gen_hdr,
            )
            .send()
            .await
            .map_err(|e| format!("push failed: {e}"))?;
        let status = res.status().as_u16();
        let server_generation = repo_gen_from_headers(res.headers());
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("push read failed: {e}"))?;
        if status == 401 || status == 403 {
            return Err(format!("HTTP {status}: unauthorized"));
        }
        if status == 409 {
            return Err(parse_repo_conflict(&bytes, server_generation));
        }
        if !status_is_success(status) {
            return Err(format!(
                "push failed: HTTP {} {}",
                status,
                String::from_utf8_lossy(&bytes)
                    .chars()
                    .take(200)
                    .collect::<String>()
            ));
        }
        serde_json::from_slice(&bytes).map_err(|e| format!("push decode failed: {e}"))
    }

    pub async fn attachment_manifest(
        &self,
        since_version: i64,
        repository_generation: i64,
    ) -> Result<ManifestWire, String> {
        let base = self.base_url.trim_end_matches('/');
        let mut body = json!({
            "client_id": self.client_id.trim(),
            "since_version": since_version,
        });
        if repository_generation > 0 {
            body["repository_generation"] = json!(repository_generation);
        }
        let gen_hdr = (repository_generation > 0).then_some(repository_generation);
        let url = format!("{}/api/attachments/manifest", base);
        let res = self
            .auth_headers(self.inner.post(url).json(&body), gen_hdr)
            .send()
            .await
            .map_err(|e| format!("manifest failed: {e}"))?;
        let status = res.status().as_u16();
        let server_generation = repo_gen_from_headers(res.headers());
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("manifest read: {e}"))?;
        if status == 401 || status == 403 {
            return Err(format!("HTTP {status}: unauthorized"));
        }
        if status == 409 {
            return Err(parse_repo_conflict(&bytes, server_generation));
        }
        if !status_is_success(status) {
            return Err(format!(
                "manifest failed: HTTP {} {}",
                status,
                String::from_utf8_lossy(&bytes)
                    .chars()
                    .take(200)
                    .collect::<String>()
            ));
        }
        serde_json::from_slice(&bytes).map_err(|e| format!("manifest decode: {e}"))
    }

    pub async fn admin_repository_reset(&self) -> Result<i64, String> {
        let base = self.base_url.trim_end_matches('/');
        let body = json!({ "confirm": "RESET_REPOSITORY" });
        let res = self
            .auth_headers(
                self.inner
                    .post(format!("{}/api/admin/repository/reset", base))
                    .json(&body),
                None,
            )
            .send()
            .await
            .map_err(|e| format!("admin reset failed: {e}"))?;
        let status = res.status().as_u16();
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("admin reset read: {e}"))?;
        if !status_is_success(status) {
            return Err(format!(
                "admin reset: HTTP {} {}",
                status,
                String::from_utf8_lossy(&bytes)
                    .chars()
                    .take(200)
                    .collect::<String>()
            ));
        }
        let wire: RepoResetWire =
            serde_json::from_slice(&bytes).map_err(|e| format!("admin reset decode: {e}"))?;
        wire.repository_generation
            .ok_or_else(|| "missing repository_generation".to_string())
    }

    pub async fn put_attachment(
        &self,
        attachment_id: &str,
        bytes: Vec<u8>,
        repository_generation: Option<i64>,
    ) -> Result<u16, String> {
        let base = self.base_url.trim_end_matches('/');
        let url = format!(
            "{}/api/attachments/{}",
            base,
            urlencoding::encode(attachment_id.trim())
        );
        let parsed = url::Url::parse(&url).map_err(|e| format!("bad attachment URL: {e}"))?;
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(attachment_id.to_string())
            .mime_str("application/octet-stream")
            .map_err(|e| e.to_string())?;
        let form = reqwest::multipart::Form::new().part("file", part);
        let res = self
            .auth_headers(
                self.inner.put(parsed).multipart(form),
                repository_generation.filter(|g| *g > 0),
            )
            .send()
            .await
            .map_err(|e| format!("attachment upload failed ({attachment_id}): {e}"))?;
        Ok(res.status().as_u16())
    }

    pub async fn get_attachment_bytes(&self, attachment_id: &str) -> Result<Vec<u8>, String> {
        let base = self.base_url.trim_end_matches('/');
        let url = format!(
            "{}/api/attachments/{}",
            base,
            urlencoding::encode(attachment_id.trim())
        );
        let parsed = url::Url::parse(&url).map_err(|e| format!("bad URL: {e}"))?;
        let res = self
            .auth_headers(self.inner.get(parsed), None)
            .send()
            .await
            .map_err(|e| format!("attachment download failed: {e}"))?;
        if !res.status().is_success() {
            return Err(format!("attachment GET failed: HTTP {}", res.status()));
        }
        res.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("attachment read failed: {e}"))
    }
}

fn status_is_success(code: u16) -> bool {
    (200..300).contains(&code)
}

fn repo_gen_from_headers(headers: &reqwest::header::HeaderMap) -> Option<i64> {
    headers
        .get("x-repository-generation")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<i64>().ok())
        .filter(|&g| g > 0)
}

pub(crate) fn is_repository_reset_error(err: &str) -> bool {
    err.contains("repository_reset_required")
        || err.contains("Pull first to align")
        || err.contains("Pull to archive this generation")
        || err.contains("Pull to align")
}

pub(crate) fn repository_reset_server_generation(err: &str) -> Option<i64> {
    let rest = err.split_once("server_generation=")?.1;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok().filter(|&g| g > 0)
}

fn format_repo_reset_err(detail: String, server_generation: Option<i64>) -> String {
    match server_generation {
        Some(g) => format!("repository_reset_required server_generation={g}: {detail}"),
        None => format!("repository_reset_required: {detail}"),
    }
}

fn parse_repo_conflict(bytes: &[u8], server_generation: Option<i64>) -> String {
    const FALLBACK: &str =
        "Server repository was reset. Pull to archive this generation and align.";
    if let Ok(w) = serde_json::from_slice::<ErrorWire>(bytes) {
        if w.code.as_deref() == Some("repository_reset_required") {
            let detail = w
                .message
                .filter(|s| !s.is_empty())
                .or(w.error)
                .unwrap_or_else(|| FALLBACK.to_string());
            return format_repo_reset_err(detail, server_generation);
        }
        return w
            .message
            .or(w.error)
            .unwrap_or_else(|| "repository conflict".to_string());
    }
    format_repo_reset_err(FALLBACK.to_string(), server_generation)
}

fn observation_id_from_failed_entry(obj: &serde_json::Map<String, Value>) -> Option<String> {
    for key in ["observation_id", "id"] {
        if let Some(Value::String(s)) = obj.get(key) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    if let Some(rec_val) = obj.get("record") {
        match rec_val {
            Value::Object(rec) => return observation_id_from_failed_entry(rec),
            Value::String(encoded) => {
                if let Ok(v) = serde_json::from_str::<Value>(encoded.trim())
                    && let Some(o) = v.as_object()
                {
                    return observation_id_from_failed_entry(o);
                }
            }
            _ => {}
        }
    }
    None
}

/// Synkronus returns failures as `{ "index", "error", "record": { "observation_id", ... } }`.
pub(crate) fn failed_record_ids(failed: &[Value]) -> Vec<String> {
    let mut out = Vec::new();
    for entry in failed {
        let Some(obj) = entry.as_object() else {
            continue;
        };
        if let Some(s) = observation_id_from_failed_entry(obj) {
            out.push(s);
        }
    }
    out
}

#[cfg(test)]
mod failed_record_tests {
    use super::*;

    #[test]
    fn failed_record_ids_reads_nested_record_observation_id() {
        let failed = vec![json!({
            "index": 0,
            "error": "database error: duplicate",
            "record": { "observation_id": "obs-a", "form_type": "t" }
        })];
        assert_eq!(failed_record_ids(&failed), vec!["obs-a".to_string()]);
    }

    #[test]
    fn failed_record_ids_reads_record_as_json_string() {
        let failed = vec![json!({
            "index": 0,
            "error": "bad",
            "record": "{\"observation_id\":\"obs-str\",\"form_type\":\"t\"}"
        })];
        assert_eq!(failed_record_ids(&failed), vec!["obs-str".to_string()]);
    }

    #[test]
    fn failed_record_ids_reads_top_level_observation_id() {
        let failed = vec![json!({
            "observation_id": "obs-b",
            "error": "bad payload"
        })];
        assert_eq!(failed_record_ids(&failed), vec!["obs-b".to_string()]);
    }
}

#[cfg(test)]
mod repo_conflict_tests {
    use super::*;

    #[test]
    fn parse_repo_conflict_includes_server_generation() {
        let body = serde_json::to_vec(&json!({
            "code": "repository_reset_required",
            "message": "Client repository_generation does not match the server"
        }))
        .unwrap();
        let err = parse_repo_conflict(&body, Some(5));
        assert!(err.contains("repository_reset_required"));
        assert!(err.contains("server_generation=5"));
        assert_eq!(repository_reset_server_generation(&err), Some(5));
        assert!(is_repository_reset_error(&err));
    }

    #[test]
    fn parse_repo_conflict_without_header_still_tagged() {
        let body = serde_json::to_vec(&json!({
            "code": "repository_reset_required",
            "message": "align generation before pulling"
        }))
        .unwrap();
        let err = parse_repo_conflict(&body, None);
        assert!(err.starts_with("repository_reset_required:"));
        assert_eq!(repository_reset_server_generation(&err), None);
    }

    #[test]
    fn is_repository_reset_error_matches_legacy_push_copy() {
        assert!(is_repository_reset_error(
            "Server repository was reset or upgraded. Pull first to align before pushing."
        ));
    }
}
