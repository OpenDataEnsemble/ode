//! `ode mcp`: a minimal Model Context Protocol server over stdio (newline-delimited JSON-RPC 2.0).
//!
//! Tools map 1:1 onto the CLI operations in this module tree, so behaviour and permissions are
//! identical. Desktop's config is re-read on every call, so permission changes apply immediately.
//! Hand-rolled instead of using `rmcp`: we need only `initialize`, `ping`, `tools/list`, and
//! `tools/call`, and this keeps the dependency surface and churn at zero.

use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::{Value, json};

use super::config::LocalConfig;
use super::export::ExportOptions;
use super::{ApiError, ApiResult, ErrorCode, SCHEMA_VERSION, app, export, forms, profiles, skills};

/// Protocol revisions this server speaks; the newest is offered when the client asks for another.
const PROTOCOL_VERSIONS: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS: &str = "Tools for ODE Desktop (Open Data Ensemble): profiles, form \
definitions, data export, form validation, and custom app authoring. Access is set per profile \
by the user in ODE Desktop → Profiles → Local tools; a permission_denied result names the \
missing permission. Form metadata and exported data may be sensitive: only read what the task \
needs. For step-by-step workflows call ode_get_skill (see ode_list_skills), e.g. ode-edit-form. \
Never call ode_app_push with publish=true without the user's explicit confirmation.";

pub struct Server {
    config_path: Option<PathBuf>,
}

fn object_schema(properties: Value, required: &[&str]) -> Value {
    json!({ "type": "object", "properties": properties, "required": required })
}

fn profile_prop() -> Value {
    json!({ "type": "string", "description": "Profile id or label (see ode_list_profiles)." })
}

/// (name, description, input schema, read-only, destructive)
fn tool_specs() -> Vec<(&'static str, &'static str, Value, bool, bool)> {
    vec![
        (
            "ode_list_profiles",
            "List ODE Desktop profiles available to local tools, with their capabilities.",
            object_schema(json!({}), &[]),
            true,
            false,
        ),
        (
            "ode_list_forms",
            "List the form types in a profile's bundle (dev-local when developer mode is on).",
            object_schema(json!({ "profile": profile_prop() }), &["profile"]),
            true,
            false,
        ),
        (
            "ode_show_form",
            "A form's title, version, locales, and questions in UI order: labels per locale, types, coded choices, required, skip-logic rules (readable), page/group, and linked sub-forms.",
            object_schema(
                json!({
                    "profile": profile_prop(),
                    "form_type": { "type": "string" },
                    "include_raw": { "type": "boolean", "default": false, "description": "Also return the raw schema.json and ui.json (large; rarely needed)." }
                }),
                &["profile", "form_type"],
            ),
            true,
            false,
        ),
        (
            "ode_validate_forms",
            "Validate form files on disk (a form folder or a folder of forms). Returns diagnostics with JSON pointers.",
            object_schema(
                json!({ "path": { "type": "string", "description": "Absolute path to a form folder or forms folder." } }),
                &["path"],
            ),
            true,
            false,
        ),
        (
            "ode_export_data",
            "Export observations of selected forms to Parquet with export_manifest.json (data dictionary) and load snippets. Needs \"Allow agent access to data and attachments\". The data may be sensitive.",
            object_schema(
                json!({
                    "profile": profile_prop(),
                    "forms": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
                    "destination": { "type": "string", "description": "Existing parent folder; output goes to <destination>/<YYYYMMDD>/." },
                    "include_pending": { "type": "boolean", "default": false },
                    "include_attachments": { "type": "boolean", "default": false },
                    "overwrite": { "type": "boolean", "default": false }
                }),
                &["profile", "forms", "destination"],
            ),
            false,
            false,
        ),
        (
            "ode_app_status",
            "Custom app status: developer mode, source folder, bundle versions, and suggested next steps.",
            object_schema(
                json!({ "profile": profile_prop(), "check_server": { "type": "boolean", "default": false, "description": "Log in to Synkronus and report the server's bundle version." } }),
                &["profile"],
            ),
            true,
            false,
        ),
        (
            "ode_app_checkout",
            "Copy the downloaded app bundle into a new, empty source folder and turn developer mode on for it.",
            object_schema(
                json!({ "profile": profile_prop(), "dest": { "type": "string" } }),
                &["profile", "dest"],
            ),
            false,
            false,
        ),
        (
            "ode_app_dev",
            "Turn developer mode on (refreshing Desktop's copy of the source folder) or off.",
            object_schema(
                json!({
                    "profile": profile_prop(),
                    "on": { "type": "boolean" },
                    "source": { "type": "string", "description": "Folder containing index.html; replaces the configured source folder." }
                }),
                &["profile", "on"],
            ),
            false,
            false,
        ),
        (
            "ode_app_validate",
            "Validate the profile's source folder: index.html and every form.",
            object_schema(json!({ "profile": profile_prop() }), &["profile"]),
            true,
            false,
        ),
        (
            "ode_app_push",
            "Refresh, validate, and list form changes (dry run). With publish=true, publish and activate the bundle on Synkronus; it reaches every device on their next sync. Only publish after the user explicitly confirms the dry-run result.",
            object_schema(
                json!({ "profile": profile_prop(), "publish": { "type": "boolean", "default": false } }),
                &["profile"],
            ),
            false,
            true,
        ),
        (
            "ode_create_profile",
            "Create a new local ODE Desktop profile (no server). With source, developer mode points at that folder.",
            object_schema(
                json!({ "label": { "type": "string" }, "source": { "type": "string" } }),
                &["label"],
            ),
            false,
            false,
        ),
        (
            "ode_list_skills",
            "List step-by-step guides for common ODE tasks.",
            object_schema(json!({}), &[]),
            true,
            false,
        ),
        (
            "ode_get_skill",
            "Get a step-by-step guide (Markdown) by name, e.g. ode-edit-form or ode-new-project.",
            object_schema(json!({ "name": { "type": "string" } }), &["name"]),
            true,
            false,
        ),
    ]
}

fn tools_list() -> Value {
    let tools: Vec<Value> = tool_specs()
        .into_iter()
        .map(
            |(name, description, input_schema, read_only, destructive)| {
                json!({
                    "name": name,
                    "description": description,
                    "inputSchema": input_schema,
                    "annotations": {
                        "readOnlyHint": read_only,
                        "destructiveHint": destructive,
                        "openWorldHint": name == "ode_app_push" || name == "ode_app_status"
                    }
                })
            },
        )
        .collect();
    json!({ "tools": tools })
}

fn arg_str<'a>(args: &'a Value, key: &str) -> ApiResult<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| {
            ApiError::new(
                ErrorCode::InvalidArgument,
                format!("Missing argument \"{key}\"."),
            )
        })
}

fn arg_bool(args: &Value, key: &str) -> bool {
    args.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn to_value<T: Serialize>(body: T) -> Value {
    let mut v = serde_json::to_value(body).unwrap_or(Value::Null);
    if let Value::Object(map) = &mut v {
        map.insert("schemaVersion".into(), json!(SCHEMA_VERSION));
    }
    v
}

impl Server {
    pub fn new(config_path: Option<PathBuf>) -> Self {
        Self { config_path }
    }

    fn config(&self) -> ApiResult<LocalConfig> {
        let path = self
            .config_path
            .clone()
            .or_else(super::config::default_config_path)
            .ok_or_else(|| {
                ApiError::new(
                    ErrorCode::ConfigNotFound,
                    "Could not determine the ODE Desktop config directory.",
                )
            })?;
        LocalConfig::load(&path)
    }

    /// Run a tool; the bool is `isError` (validation failures are reported, not thrown).
    fn call_tool(&self, name: &str, args: &Value) -> ApiResult<(Value, bool)> {
        let ok = |v: Value| Ok((v, false));
        match name {
            "ode_validate_forms" => {
                let r = super::validate::validate_path(Path::new(arg_str(args, "path")?))?;
                let failed = !r.valid;
                return Ok((to_value(r), failed));
            }
            "ode_list_skills" => return ok(to_value(json!({ "skills": skills::list() }))),
            "ode_get_skill" => {
                return ok(Value::String(skills::show(arg_str(args, "name")?)?.into()));
            }
            _ => {}
        }
        let mut cfg = self.config()?;
        let cfg = &mut cfg;
        match name {
            "ode_list_profiles" => ok(to_value(
                json!({ "profiles": profiles::list_profiles(cfg) }),
            )),
            "ode_list_forms" => ok(to_value(forms::list_forms(cfg, arg_str(args, "profile")?)?)),
            "ode_show_form" => ok(to_value(forms::get_form_details(
                cfg,
                arg_str(args, "profile")?,
                arg_str(args, "form_type")?,
                arg_bool(args, "include_raw"),
            )?)),
            "ode_export_data" => {
                let forms = args
                    .get("forms")
                    .and_then(Value::as_array)
                    .map(|a| {
                        a.iter()
                            .filter_map(Value::as_str)
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default();
                let opts = ExportOptions {
                    form_types: forms,
                    destination: PathBuf::from(arg_str(args, "destination")?),
                    include_pending: arg_bool(args, "include_pending"),
                    include_attachments: arg_bool(args, "include_attachments"),
                    overwrite: arg_bool(args, "overwrite"),
                };
                ok(to_value(export::export_parquet(
                    cfg,
                    arg_str(args, "profile")?,
                    &opts,
                    &mut |_, _, _| {},
                )?))
            }
            "ode_app_status" => ok(to_value(app::status(
                cfg,
                arg_str(args, "profile")?,
                arg_bool(args, "check_server"),
            )?)),
            "ode_app_checkout" => ok(to_value(app::checkout(
                cfg,
                arg_str(args, "profile")?,
                Path::new(arg_str(args, "dest")?),
            )?)),
            "ode_app_dev" => ok(to_value(app::set_dev_mode(
                cfg,
                arg_str(args, "profile")?,
                arg_bool(args, "on"),
                args.get("source").and_then(Value::as_str).map(Path::new),
            )?)),
            "ode_app_validate" => {
                let r = app::validate(cfg, arg_str(args, "profile")?)?;
                let failed = !r.valid;
                Ok((to_value(r), failed))
            }
            "ode_app_push" => {
                let r = app::push(cfg, arg_str(args, "profile")?, arg_bool(args, "publish"))?;
                let failed = !r.validation.valid;
                Ok((to_value(r), failed))
            }
            "ode_create_profile" => ok(to_value(profiles::create_profile(
                cfg,
                arg_str(args, "label")?,
                args.get("source").and_then(Value::as_str).map(Path::new),
            )?)),
            _ => Err(ApiError::new(
                ErrorCode::InvalidArgument,
                format!("Unknown tool \"{name}\"."),
            )),
        }
    }

    fn tool_result(&self, params: &Value) -> Value {
        let name = params.get("name").and_then(Value::as_str).unwrap_or("");
        let args = params
            .get("arguments")
            .cloned()
            .unwrap_or_else(|| json!({}));
        let (body, is_error) = match self.call_tool(name, &args) {
            Ok(r) => r,
            Err(error) => (to_value(json!({ "error": error })), true),
        };
        let text = match &body {
            Value::String(s) => s.clone(),
            other => serde_json::to_string_pretty(other).unwrap_or_default(),
        };
        let mut result =
            json!({ "content": [{ "type": "text", "text": text }], "isError": is_error });
        if body.is_object() {
            result["structuredContent"] = body;
        }
        result
    }

    /// Handle one JSON-RPC message; `None` for notifications (no response).
    pub fn handle(&self, msg: &Value) -> Option<Value> {
        let id = msg.get("id").cloned()?;
        let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
        let params = msg.get("params").cloned().unwrap_or_else(|| json!({}));
        let result = match method {
            "initialize" => {
                let requested = params.get("protocolVersion").and_then(Value::as_str);
                let version = requested
                    .filter(|v| PROTOCOL_VERSIONS.contains(v))
                    .unwrap_or(PROTOCOL_VERSIONS[0]);
                json!({
                    "protocolVersion": version,
                    "capabilities": { "tools": { "listChanged": false } },
                    "serverInfo": { "name": "ode", "title": "ODE Desktop", "version": env!("CARGO_PKG_VERSION") },
                    "instructions": INSTRUCTIONS
                })
            }
            "ping" => json!({}),
            "tools/list" => tools_list(),
            "tools/call" => self.tool_result(&params),
            _ => {
                return Some(json!({
                    "jsonrpc": "2.0", "id": id,
                    "error": { "code": -32601, "message": format!("Method not found: {method}") }
                }));
            }
        };
        Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
    }

    /// Serve until stdin closes.
    pub fn serve(&self) -> std::io::Result<()> {
        let stdin = std::io::stdin();
        let mut stdout = std::io::stdout();
        for line in stdin.lock().lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let response = match serde_json::from_str::<Value>(&line) {
                Ok(msg) => self.handle(&msg),
                Err(e) => Some(json!({
                    "jsonrpc": "2.0", "id": null,
                    "error": { "code": -32700, "message": format!("Parse error: {e}") }
                })),
            };
            if let Some(response) = response {
                writeln!(stdout, "{response}")?;
                stdout.flush()?;
            }
        }
        Ok(())
    }
}
