//! Local observation_index EAV table (never synced) + snapshot generation rebuild.

use rusqlite::{Connection, params};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationIndexDef {
    pub key: String,
    pub path: String,
    #[serde(default)]
    pub value_type: Option<String>,
    #[serde(default)]
    pub form_types: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
struct AppConfigIndexes {
    #[serde(rename = "observationIndexes", alias = "observation_indexes", default)]
    observation_indexes: Vec<ObservationIndexDef>,
}

pub fn migrate_index_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS observation_index_meta (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            active_generation INTEGER NOT NULL DEFAULT 1,
            building_generation INTEGER,
            last_rebuild_at TEXT
        );
        INSERT OR IGNORE INTO observation_index_meta(id, active_generation) VALUES (1, 1);

        CREATE TABLE IF NOT EXISTS observation_index (
            observation_id TEXT NOT NULL,
            index_key TEXT NOT NULL,
            index_generation INTEGER NOT NULL,
            value_text TEXT,
            value_num REAL,
            PRIMARY KEY (observation_id, index_key, index_generation)
        );
        CREATE INDEX IF NOT EXISTS idx_observation_index_lookup
            ON observation_index(index_generation, index_key, value_text, observation_id);
        CREATE INDEX IF NOT EXISTS idx_observation_index_lookup_num
            ON observation_index(index_generation, index_key, value_num, observation_id);
        "#,
    )?;
    Ok(())
}

pub fn load_index_config(bundle_app_config_path: &Path) -> Vec<ObservationIndexDef> {
    let Ok(text) = std::fs::read_to_string(bundle_app_config_path) else {
        return Vec::new();
    };
    let Ok(cfg) = serde_json::from_str::<AppConfigIndexes>(&text) else {
        return Vec::new();
    };
    cfg.observation_indexes
        .into_iter()
        .filter(|d| !d.key.is_empty() && !d.path.is_empty())
        .collect()
}

pub fn index_keys_set(defs: &[ObservationIndexDef]) -> HashSet<String> {
    defs.iter().map(|d| d.key.clone()).collect()
}

fn form_type_matches(form_type: &str, patterns: Option<&Vec<String>>) -> bool {
    let Some(patterns) = patterns else {
        return true;
    };
    for p in patterns {
        if p.ends_with('*') {
            let prefix = &p[..p.len() - 1];
            if form_type.starts_with(prefix) {
                return true;
            }
        } else if form_type == p {
            return true;
        }
    }
    false
}

fn json_path_to_key(path: &str) -> String {
    path.strip_prefix("$.").unwrap_or(path).to_string()
}

fn extract_scalar(payload: &str, path: &str) -> Option<Value> {
    let v: Value = serde_json::from_str(payload).ok()?;
    let key = json_path_to_key(path);
    v.get(&key).cloned()
}

pub fn reindex_observation(
    conn: &Connection,
    observation_id: &str,
    form_type: &str,
    payload: &str,
    defs: &[ObservationIndexDef],
    generation: i64,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM observation_index WHERE observation_id = ?1 AND index_generation = ?2",
        params![observation_id, generation],
    )?;
    for def in defs {
        if !form_type_matches(form_type, def.form_types.as_ref()) {
            continue;
        }
        let Some(val) = extract_scalar(payload, &def.path) else {
            continue;
        };
        if val.is_null() {
            continue;
        }
        let (value_text, value_num) = scalar_to_columns(&val, def.value_type.as_deref());
        conn.execute(
            "INSERT OR REPLACE INTO observation_index (observation_id, index_key, index_generation, value_text, value_num)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![observation_id, def.key, generation, value_text, value_num],
        )?;
    }
    Ok(())
}

fn scalar_to_columns(val: &Value, value_type: Option<&str>) -> (Option<String>, Option<f64>) {
    if (value_type == Some("number") || val.is_number())
        && let Some(n) = val.as_f64()
    {
        return (None, Some(n));
    }
    if val.is_string() {
        return (Some(val.as_str().unwrap().to_string()), None);
    }
    if val.is_number() {
        return (Some(val.to_string()), val.as_f64());
    }
    if val.as_bool().is_some() {
        return (Some(val.to_string()), None);
    }
    (Some(val.to_string()), None)
}

pub fn rebuild_all_indexes(
    conn: &Connection,
    defs: &[ObservationIndexDef],
    mut progress: Option<&mut dyn FnMut(i64, i64)>,
) -> rusqlite::Result<i64> {
    let active: i64 = conn.query_row(
        "SELECT active_generation FROM observation_index_meta WHERE id = 1",
        [],
        |r| r.get(0),
    )?;
    let new_gen = if active == 1 { 2 } else { 1 };

    conn.execute(
        "UPDATE observation_index_meta SET building_generation = ?1 WHERE id = 1",
        params![new_gen],
    )?;

    conn.execute(
        "DELETE FROM observation_index WHERE index_generation = ?1",
        params![new_gen],
    )?;

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM observations", [], |r| r.get(0))?;
    if let Some(ref mut cb) = progress {
        cb(0, total);
    }

    let mut stmt = conn.prepare("SELECT id, form_type, payload FROM observations")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut done = 0i64;
    for row in rows {
        let (id, form_type, payload) = row?;
        let ft = form_type.unwrap_or_default();
        reindex_observation(conn, &id, &ft, &payload, defs, new_gen)?;
        done += 1;
        if let Some(ref mut cb) = progress {
            if total == 0 || done == total || done % 50 == 0 {
                cb(done, total);
            }
        }
    }

    recreate_sqlite_indexes(conn, defs)?;

    conn.execute(
        "DELETE FROM observation_index WHERE index_generation != ?1",
        params![new_gen],
    )?;

    conn.execute(
        "UPDATE observation_index_meta SET active_generation = ?1, building_generation = NULL, last_rebuild_at = datetime('now') WHERE id = 1",
        params![new_gen],
    )?;

    Ok(new_gen)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedSqliteIndex {
    pub name: String,
    pub sql: String,
}

pub fn planned_sqlite_indexes(defs: &[ObservationIndexDef]) -> Vec<PlannedSqliteIndex> {
    let mut out = Vec::new();
    out.push(PlannedSqliteIndex {
        name: "idx_observations_form_type".to_string(),
        sql: "CREATE INDEX IF NOT EXISTS idx_observations_form_type ON observations(form_type)"
            .to_string(),
    });
    for def in defs {
        let idx_name = format!("idx_{}_text", sanitize_ident(&def.key));
        out.push(PlannedSqliteIndex {
            name: idx_name.clone(),
            sql: format!(
                "CREATE INDEX IF NOT EXISTS {idx_name} ON observation_index(value_text) WHERE index_key = '{}'",
                def.key.replace('\'', "''")
            ),
        });

        let expr_name = format!("data_{}", sanitize_ident(&def.key));
        let json_path = if def.path.starts_with("$.") {
            def.path.clone()
        } else {
            format!("$.{}", def.path)
        };
        out.push(PlannedSqliteIndex {
            name: expr_name.clone(),
            sql: format!(
                "CREATE INDEX IF NOT EXISTS {expr_name} ON observations(json_extract(payload, '{json_path}'))"
            ),
        });
    }
    out
}

fn sqlite_index_exists(conn: &Connection, name: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
        params![name],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

pub fn missing_sqlite_indexes(
    conn: &Connection,
    defs: &[ObservationIndexDef],
) -> rusqlite::Result<Vec<PlannedSqliteIndex>> {
    let mut missing = Vec::new();
    for idx in planned_sqlite_indexes(defs) {
        if !sqlite_index_exists(conn, &idx.name)? {
            missing.push(idx);
        }
    }
    Ok(missing)
}

pub fn create_missing_sqlite_indexes(
    conn: &Connection,
    defs: &[ObservationIndexDef],
) -> rusqlite::Result<Vec<String>> {
    let missing = missing_sqlite_indexes(conn, defs)?;
    let mut executed = Vec::new();
    for idx in missing {
        conn.execute(&idx.sql, [])?;
        executed.push(format!("{};", idx.sql));
    }
    Ok(executed)
}

pub fn recreate_sqlite_indexes(
    conn: &Connection,
    defs: &[ObservationIndexDef],
) -> rusqlite::Result<()> {
    for idx in planned_sqlite_indexes(defs) {
        conn.execute(&idx.sql, [])?;
    }
    Ok(())
}

fn sanitize_ident(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn delete_observation_indexes(conn: &Connection, observation_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM observation_index WHERE observation_id = ?1",
        params![observation_id],
    )?;
    Ok(())
}

pub fn active_generation(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT active_generation FROM observation_index_meta WHERE id = 1",
        [],
        |r| r.get(0),
    )
}

pub fn incremental_reindex(
    conn: &Connection,
    observation_id: &str,
    form_type: &str,
    payload: &str,
    defs: &[ObservationIndexDef],
) -> rusqlite::Result<()> {
    let generation = active_generation(conn)?;
    reindex_observation(conn, observation_id, form_type, payload, defs, generation)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate_index_schema(&conn).unwrap();
        conn.execute_batch(
            "CREATE TABLE observations (
                id TEXT PRIMARY KEY,
                form_type TEXT,
                payload TEXT NOT NULL
            );",
        )
        .unwrap();
        conn
    }

    fn sample_defs() -> Vec<ObservationIndexDef> {
        vec![
            ObservationIndexDef {
                key: "p_id".into(),
                path: "$.p_id".into(),
                value_type: None,
                form_types: None,
            },
            ObservationIndexDef {
                key: "age".into(),
                path: "$.age".into(),
                value_type: Some("number".into()),
                form_types: Some(vec!["person".into()]),
            },
        ]
    }

    #[test]
    fn incremental_reindex_writes_index_rows() {
        let conn = test_conn();
        let defs = sample_defs();
        conn.execute(
            "INSERT INTO observations (id, form_type, payload) VALUES ('obs1', 'person', '{\"p_id\":\"P1\",\"age\":30}')",
            [],
        )
        .unwrap();
        incremental_reindex(
            &conn,
            "obs1",
            "person",
            "{\"p_id\":\"P1\",\"age\":30}",
            &defs,
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM observation_index WHERE observation_id = 'obs1' AND index_generation = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
        let p_id: String = conn
            .query_row(
                "SELECT value_text FROM observation_index WHERE observation_id = 'obs1' AND index_key = 'p_id'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(p_id, "P1");
        let age: f64 = conn
            .query_row(
                "SELECT value_num FROM observation_index WHERE observation_id = 'obs1' AND index_key = 'age'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(age, 30.0);
    }

    #[test]
    fn form_type_glob_skips_non_matching() {
        let conn = test_conn();
        let defs = sample_defs();
        incremental_reindex(
            &conn,
            "obs1",
            "household",
            "{\"p_id\":\"H1\",\"age\":5}",
            &defs,
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM observation_index WHERE observation_id = 'obs1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn rebuild_swaps_generation() {
        let conn = test_conn();
        let defs = sample_defs();
        conn.execute(
            "INSERT INTO observations (id, form_type, payload) VALUES ('obs1', 'person', '{\"p_id\":\"P1\"}')",
            [],
        )
        .unwrap();
        let gen1 = rebuild_all_indexes(&conn, &defs, None).unwrap();
        assert_eq!(gen1, 2);
        let active: i64 = active_generation(&conn).unwrap();
        assert_eq!(active, 2);
        let rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM observation_index WHERE index_generation = 2",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rows, 1);
    }

    #[test]
    fn missing_sqlite_indexes_detects_absent_names() {
        let conn = test_conn();
        let defs = sample_defs();
        let missing = missing_sqlite_indexes(&conn, &defs).unwrap();
        let names: Vec<&str> = missing.iter().map(|i| i.name.as_str()).collect();
        assert!(names.contains(&"idx_observations_form_type"));
        assert!(names.contains(&"idx_p_id_text"));
        assert!(names.contains(&"data_p_id"));
        recreate_sqlite_indexes(&conn, &defs).unwrap();
        let missing_after = missing_sqlite_indexes(&conn, &defs).unwrap();
        assert!(missing_after.is_empty());
    }

    #[test]
    fn delete_observation_indexes_removes_rows() {
        let conn = test_conn();
        let defs = sample_defs();
        incremental_reindex(&conn, "obs1", "person", "{\"p_id\":\"P1\"}", &defs).unwrap();
        delete_observation_indexes(&conn, "obs1").unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM observation_index", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
