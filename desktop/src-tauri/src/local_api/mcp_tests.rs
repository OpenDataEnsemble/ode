use std::fs;

use serde_json::{Value, json};

use super::mcp::Server;

fn call(server: &Server, id: i64, method: &str, params: Value) -> Value {
    server
        .handle(&json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }))
        .expect("requests get a response")
}

fn tool(server: &Server, name: &str, args: Value) -> Value {
    call(
        server,
        9,
        "tools/call",
        json!({ "name": name, "arguments": args }),
    )["result"]
        .clone()
}

/// Config with one profile whose local tools are enabled but data access is off.
fn server(name: &str) -> Server {
    let base = std::env::temp_dir().join(format!("ode_mcp_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&base);
    let ws = base.join("ws");
    let form = ws.join("bundles/active/forms/household");
    fs::create_dir_all(&form).unwrap();
    fs::write(
        form.join("schema.json"),
        r#"{"type":"object","version":"2","properties":{"a":{"type":"string"}}}"#,
    )
    .unwrap();
    fs::write(
        form.join("ui.json"),
        r#"{"type":"SwipeLayout","elements":[]}"#,
    )
    .unwrap();
    let cfg = json!({
        "activeProfileId": "p1",
        "profiles": [{ "id": "p1", "label": "Study", "serverUrl": "", "username": null,
            "workspacePath": ws.to_string_lossy(), "databasePath": "", "attachmentsPath": null }]
    });
    let path = base.join("config.json");
    fs::write(&path, cfg.to_string()).unwrap();
    Server::new(Some(path))
}

#[test]
fn initialize_negotiates_version_and_ignores_notifications() {
    let s = server("init");
    let r = call(
        &s,
        1,
        "initialize",
        json!({ "protocolVersion": "2025-06-18", "capabilities": {} }),
    );
    assert_eq!(r["result"]["protocolVersion"], json!("2025-06-18"));
    assert_eq!(r["result"]["serverInfo"]["name"], json!("ode"));
    assert!(r["result"]["capabilities"]["tools"].is_object());
    let unknown = call(
        &s,
        2,
        "initialize",
        json!({ "protocolVersion": "1999-01-01" }),
    );
    assert_eq!(unknown["result"]["protocolVersion"], json!("2025-11-25"));
    assert!(
        s.handle(&json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }))
            .is_none()
    );
    assert_eq!(
        call(&s, 3, "nope", json!({}))["error"]["code"],
        json!(-32601)
    );
}

#[test]
fn tools_list_has_schemas_and_marks_publishing_destructive() {
    let s = server("list");
    let tools = call(&s, 1, "tools/list", json!({}))["result"]["tools"].clone();
    let tools = tools.as_array().unwrap();
    assert!(tools.len() >= 10);
    assert!(
        tools
            .iter()
            .all(|t| t["inputSchema"]["type"] == json!("object"))
    );
    let push = tools
        .iter()
        .find(|t| t["name"] == json!("ode_app_push"))
        .unwrap();
    assert_eq!(push["annotations"]["destructiveHint"], json!(true));
}

#[test]
fn tool_calls_return_structured_results_and_permission_errors() {
    let s = server("call");
    let forms = tool(&s, "ode_list_forms", json!({ "profile": "study" }));
    assert_eq!(forms["isError"], json!(false));
    assert_eq!(
        forms["structuredContent"]["forms"][0]["formType"],
        json!("household")
    );

    let show = tool(
        &s,
        "ode_show_form",
        json!({ "profile": "p1", "form_type": "household" }),
    );
    assert_eq!(show["structuredContent"]["version"], json!("2"));

    let export = tool(
        &s,
        "ode_export_data",
        json!({ "profile": "p1", "forms": ["household"], "destination": "." }),
    );
    assert_eq!(export["isError"], json!(true));
    assert_eq!(
        export["structuredContent"]["error"]["code"],
        json!("permission_denied")
    );

    let missing = tool(&s, "ode_show_form", json!({ "profile": "p1" }));
    assert_eq!(
        missing["structuredContent"]["error"]["code"],
        json!("invalid_argument")
    );

    let skill = tool(&s, "ode_get_skill", json!({ "name": "ode-edit-form" }));
    assert!(
        skill["content"][0]["text"]
            .as_str()
            .unwrap()
            .contains("# Edit an ODE form")
    );
}
