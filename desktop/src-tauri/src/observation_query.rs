//! Compile ObservationFilter AST to parameterized SQL for Desktop custodian DB.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryObservationsRequest {
    pub form_type: String,
    pub include_deleted: Option<bool>,
    pub filter: Option<Value>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryCompileError {
    pub code: String,
    pub message: String,
}

#[derive(Debug)]
pub struct CompiledSql {
    pub sql: String,
    pub params: Vec<SqlParam>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum SqlParam {
    Text(String),
    Integer(i64),
    Real(f64),
    Null,
}

pub fn compile_observation_query(
    form_type: &str,
    include_deleted: bool,
    filter: Option<&Value>,
    index_keys: &HashSet<String>,
) -> Result<CompiledSql, QueryCompileError> {
    let _ = include_deleted;
    let mut warnings = Vec::new();
    let mut params: Vec<SqlParam> = Vec::new();
    let mut where_parts = Vec::new();
    let normalized_form_type = form_type.trim();
    if !normalized_form_type.is_empty() && normalized_form_type != "*" {
        where_parts.push("o.form_type = ?".to_string());
        params.push(SqlParam::Text(normalized_form_type.to_string()));
    }

    if let Some(f) = filter {
        let sql = compile_filter_node(f, index_keys, &mut params, &mut warnings)?;
        where_parts.push(sql);
    }

    let sql = format!(
        "SELECT o.id, o.payload, o.form_type, o.updated_at, o.remote_updated_at, o.dirty, o.sync_status, o.conflict_payload, o.last_saved_at, o.last_pushed_at, o.observation_extras FROM observations o WHERE {}",
        where_parts.join(" AND ")
    );

    Ok(CompiledSql {
        sql,
        params,
        warnings,
    })
}

fn compile_filter_node(
    filter: &Value,
    index_keys: &HashSet<String>,
    params: &mut Vec<SqlParam>,
    warnings: &mut Vec<String>,
) -> Result<String, QueryCompileError> {
    let obj = filter.as_object().ok_or_else(|| QueryCompileError {
        code: "INVALID_FILTER".into(),
        message: "Filter must be an object".into(),
    })?;

    let op = obj.get("op").and_then(|v| v.as_str());

    if op == Some("and") || op == Some("or") {
        let conditions = obj
            .get("conditions")
            .and_then(|v| v.as_array())
            .filter(|a| !a.is_empty())
            .ok_or_else(|| QueryCompileError {
                code: "EMPTY_LOGICAL".into(),
                message: "Logical filter must have conditions".into(),
            })?;
        let joiner = if op == Some("and") { " AND " } else { " OR " };
        let mut parts = Vec::new();
        for c in conditions {
            parts.push(format!(
                "({})",
                compile_filter_node(c, index_keys, params, warnings)?
            ));
        }
        return Ok(format!("({})", parts.join(joiner)));
    }

    if op == Some("any") {
        return compile_quantifier(obj, params);
    }

    compile_condition(obj, index_keys, params, warnings)
}

fn compile_quantifier(
    obj: &serde_json::Map<String, Value>,
    params: &mut Vec<SqlParam>,
) -> Result<String, QueryCompileError> {
    let path = obj
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| QueryCompileError {
            code: "INVALID_QUANTIFIER".into(),
            message: "any() requires path".into(),
        })?;
    let alias = obj
        .get("as")
        .and_then(|v| v.as_str())
        .ok_or_else(|| QueryCompileError {
            code: "INVALID_QUANTIFIER".into(),
            message: "any() requires as".into(),
        })?;
    let where_clause = obj.get("where").ok_or_else(|| QueryCompileError {
        code: "INVALID_QUANTIFIER".into(),
        message: "any() requires where".into(),
    })?;
    let where_obj = where_clause.as_object().ok_or_else(|| QueryCompileError {
        code: "INVALID_QUANTIFIER".into(),
        message: "where must be object".into(),
    })?;
    let member_field = where_obj
        .get("field")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let value = where_obj.get("value").cloned().unwrap_or(Value::Null);
    let member_key = member_field
        .strip_prefix(&format!("{alias}."))
        .or_else(|| member_field.strip_prefix("data."))
        .unwrap_or(member_field);
    let array_path = path.strip_prefix("data.").unwrap_or(path);
    let json_path = format!("$.{}", array_path);
    let p = push_param(params, &value);
    Ok(format!(
        "EXISTS (SELECT 1 FROM json_each(o.payload, '{json_path}') AS {alias} WHERE json_extract({alias}.value, '$.{member_key}') = {p})"
    ))
}

fn compile_condition(
    obj: &serde_json::Map<String, Value>,
    index_keys: &HashSet<String>,
    params: &mut Vec<SqlParam>,
    warnings: &mut Vec<String>,
) -> Result<String, QueryCompileError> {
    let field = obj
        .get("field")
        .and_then(|v| v.as_str())
        .ok_or_else(|| QueryCompileError {
            code: "INVALID_FIELD".into(),
            message: "Condition requires field".into(),
        })?;
    let op = obj
        .get("op")
        .and_then(|v| v.as_str())
        .ok_or_else(|| QueryCompileError {
            code: "INVALID_OP".into(),
            message: "Condition requires op".into(),
        })?;
    let value = obj.get("value").cloned().unwrap_or(Value::Null);

    if field == "observation_id" {
        let p = push_param(params, &value);
        return Ok(format!("o.id = {p}"));
    }

    if !field.starts_with("data.") {
        return Err(QueryCompileError {
            code: "INVALID_FIELD".into(),
            message: format!("Unknown field: {field}"),
        });
    }

    let index_key = &field[5..];
    let json_path = format!("$.{}", index_key);

    if index_keys.contains(index_key) {
        return compile_index_condition(index_key, op, &value, params);
    }

    warnings.push(format!(
        "Undeclared index for {field}; using json_extract fallback"
    ));
    compile_json_extract(op, &json_path, &value, params)
}

fn compile_index_condition(
    index_key: &str,
    op: &str,
    value: &Value,
    params: &mut Vec<SqlParam>,
) -> Result<String, QueryCompileError> {
    let key_ph = push_param(params, &Value::String(index_key.to_string()));

    if op == "in" {
        let arr = value.as_array().ok_or_else(|| QueryCompileError {
            code: "INVALID_IN".into(),
            message: "in requires array value".into(),
        })?;
        if arr.is_empty() {
            return Ok("0".into());
        }
        let placeholders: Vec<String> = arr.iter().map(|v| push_param(params, v)).collect();
        let all_num = arr.iter().all(|v| v.is_number());
        if all_num {
            return Ok(format!(
                "EXISTS (SELECT 1 FROM observation_index idx WHERE idx.observation_id = o.id AND idx.index_key = {key_ph} AND idx.index_generation = (SELECT active_generation FROM observation_index_meta WHERE id = 1) AND idx.value_num IN ({}))",
                placeholders.join(",")
            ));
        }
        return Ok(format!(
            "EXISTS (SELECT 1 FROM observation_index idx WHERE idx.observation_id = o.id AND idx.index_key = {key_ph} AND idx.index_generation = (SELECT active_generation FROM observation_index_meta WHERE id = 1) AND idx.value_text IN ({}))",
            placeholders.join(",")
        ));
    }

    let numeric_ops = ["eq", "neq", "gt", "gte", "lt", "lte"];
    if value.is_number() && numeric_ops.contains(&op) {
        let p = push_param(params, value);
        let sql_op = match op {
            "eq" => "=",
            "neq" => "!=",
            "gt" => ">",
            "gte" => ">=",
            "lt" => "<",
            "lte" => "<=",
            _ => "=",
        };
        return Ok(format!(
            "EXISTS (SELECT 1 FROM observation_index idx WHERE idx.observation_id = o.id AND idx.index_key = {key_ph} AND idx.index_generation = (SELECT active_generation FROM observation_index_meta WHERE id = 1) AND idx.value_num {sql_op} {p})"
        ));
    }

    if op == "eq" || op == "neq" {
        let p = push_param(params, value);
        let sql_op = if op == "eq" { "=" } else { "!=" };
        return Ok(format!(
            "EXISTS (SELECT 1 FROM observation_index idx WHERE idx.observation_id = o.id AND idx.index_key = {key_ph} AND idx.index_generation = (SELECT active_generation FROM observation_index_meta WHERE id = 1) AND idx.value_text {sql_op} {p})"
        ));
    }

    Err(QueryCompileError {
        code: "UNSUPPORTED_OP".into(),
        message: format!("Unsupported op {op} on indexed field"),
    })
}

fn compile_json_extract(
    op: &str,
    json_path: &str,
    value: &Value,
    params: &mut Vec<SqlParam>,
) -> Result<String, QueryCompileError> {
    let expr = format!("json_extract(o.payload, '{json_path}')");
    if op == "in" {
        let arr = value.as_array().ok_or_else(|| QueryCompileError {
            code: "INVALID_IN".into(),
            message: "in requires array".into(),
        })?;
        if arr.is_empty() {
            return Ok("0".into());
        }
        let ph: Vec<String> = arr.iter().map(|v| push_param(params, v)).collect();
        return Ok(format!("{} IN ({})", expr, ph.join(",")));
    }
    let sql_op = match op {
        "eq" => "=",
        "neq" => "!=",
        "gt" => ">",
        "gte" => ">=",
        "lt" => "<",
        "lte" => "<=",
        _ => {
            return Err(QueryCompileError {
                code: "UNSUPPORTED_OP".into(),
                message: format!("Unsupported op {op}"),
            });
        }
    };
    let p = push_param(params, value);
    Ok(format!("{expr} {sql_op} {p}"))
}

fn push_param(params: &mut Vec<SqlParam>, value: &Value) -> String {
    match value {
        Value::Null => {
            params.push(SqlParam::Null);
        }
        Value::Bool(b) => {
            params.push(SqlParam::Integer(if *b { 1 } else { 0 }));
        }
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                params.push(SqlParam::Integer(i));
            } else if let Some(f) = n.as_f64() {
                params.push(SqlParam::Real(f));
            }
        }
        Value::String(s) => {
            params.push(SqlParam::Text(s.clone()));
        }
        _ => {
            params.push(SqlParam::Text(value.to_string()));
        }
    }
    "?".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn runs_golden_fixtures() {
        let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        dir.push("../../packages/observation-query/fixtures");
        for entry in fs::read_dir(&dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let text = fs::read_to_string(&path).unwrap();
            let fixture: Value = serde_json::from_str(&text).unwrap();
            let name = fixture["name"].as_str().unwrap();
            let expect_error = fixture["expectError"].as_bool().unwrap_or(false);
            let index_keys: HashSet<String> = fixture["indexKeys"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect();
            let filter = fixture.get("filter");
            let result = compile_observation_query(
                fixture["formType"].as_str().unwrap(),
                !fixture["includeDeleted"].as_bool().unwrap_or(false),
                filter,
                &index_keys,
            );
            if expect_error {
                assert!(result.is_err(), "expected error for {name}");
                continue;
            }
            let compiled = result.expect(&name);
            let fragments = fixture["expectedSqlFragmentsByDialect"]["desktop"]
                .as_array()
                .or_else(|| fixture["expectedSqlFragments"].as_array());
            if let Some(fragments) = fragments {
                for frag in fragments {
                    let s = frag.as_str().unwrap();
                    assert!(compiled.sql.contains(s), "{name} missing {s}");
                }
            }
        }
    }
}
