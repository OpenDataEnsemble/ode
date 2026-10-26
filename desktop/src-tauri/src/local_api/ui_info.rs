//! Per-field information from `ui.json`: skip-logic rules in readable form, labels per locale,
//! and where the question sits (page, group). Used by `forms show` and the export manifest.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use serde::Serialize;
use serde_json::Value;

const MAX_DEPTH: usize = 32;

/// A rule that affects a field, e.g. `{ "effect": "SHOW", "when": "consent == \"1\"" }`.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct FieldRule {
    pub effect: String,
    pub when: String,
    /// Set when the rule sits on an enclosing page or group (its label, or `page N`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct UiFieldInfo {
    pub rules: Vec<FieldRule>,
    /// `default` (the base `label`) plus one entry per translated locale.
    pub labels: BTreeMap<String, String>,
    /// 1-based page within a `SwipeLayout` root.
    pub page: Option<usize>,
    /// Label of the nearest enclosing labelled layout (e.g. a `Group`).
    pub group: Option<String>,
}

pub(crate) struct UiInfo {
    pub fields: HashMap<String, UiFieldInfo>,
    /// Locales with translations anywhere in `ui.json`.
    pub locales: Vec<String>,
}

/// `#/properties/a/properties/b` → `a.b`.
pub(crate) fn scope_to_path(scope: &str) -> String {
    scope
        .trim_start_matches('#')
        .trim_start_matches('/')
        .split('/')
        .filter(|seg| !seg.is_empty() && *seg != "properties")
        .collect::<Vec<_>>()
        .join(".")
}

fn short(v: &Value) -> String {
    let s = v.to_string();
    if s.chars().count() > 80 {
        format!("{}…", s.chars().take(80).collect::<String>())
    } else {
        s
    }
}

/// JSON Schema condition on one field → readable text (falls back to the raw schema).
fn describe_schema(path: &str, schema: &Value, depth: usize) -> String {
    if depth > MAX_DEPTH {
        return format!("{path} matches …");
    }
    let Some(map) = schema.as_object() else {
        return format!("{path} matches {}", short(schema));
    };
    let mut parts = Vec::new();
    let mut understood = true;
    for (key, v) in map {
        match key.as_str() {
            "const" => parts.push(format!("{path} == {v}")),
            "enum" => parts.push(format!("{path} in {v}")),
            "minLength" if v.as_u64() == Some(1) => parts.push(format!("{path} is not empty")),
            "minLength" => parts.push(format!("length of {path} >= {v}")),
            "minimum" => parts.push(format!("{path} >= {v}")),
            "maximum" => parts.push(format!("{path} <= {v}")),
            "exclusiveMinimum" => parts.push(format!("{path} > {v}")),
            "exclusiveMaximum" => parts.push(format!("{path} < {v}")),
            "contains" => match v.get("const") {
                Some(c) => parts.push(format!("{path} includes {c}")),
                None => parts.push(format!("{path} includes an item matching {}", short(v))),
            },
            "not" => parts.push(format!("not ({})", describe_schema(path, v, depth + 1))),
            // Type hints and evaluation flags don't change the meaning for readers.
            "type" | "failWhenUndefined" | "$comment" => {}
            _ => understood = false,
        }
    }
    if !understood || parts.is_empty() {
        return format!("{path} matches {}", short(schema));
    }
    parts.join(" and ")
}

/// JSON Forms rule condition (schema-based, `LEAF`, or `AND`/`OR` composite) → readable text.
pub(crate) fn describe_condition(cond: &Value, depth: usize) -> String {
    if depth > MAX_DEPTH {
        return "…".to_string();
    }
    if let Some(conditions) = cond.get("conditions").and_then(Value::as_array) {
        let op = match cond.get("type").and_then(Value::as_str) {
            Some("OR") => " or ",
            Some("AND") => " and ",
            // JSON Forms evaluates an untyped composite as false; say so instead of guessing.
            _ => return format!("<composite condition without \"type\": {}>", short(cond)),
        };
        let inner: Vec<String> = conditions
            .iter()
            .map(|c| describe_condition(c, depth + 1))
            .collect();
        return if depth == 0 {
            inner.join(op)
        } else {
            format!("({})", inner.join(op))
        };
    }
    let path = cond
        .get("scope")
        .and_then(Value::as_str)
        .map(scope_to_path)
        .unwrap_or_else(|| "?".to_string());
    if let Some(expected) = cond.get("expectedValue") {
        return format!("{path} == {expected}");
    }
    match cond.get("schema") {
        Some(schema) => describe_schema(&path, schema, depth),
        None => format!("<incomplete condition on {path}>"),
    }
}

fn rule_of(el: &Value) -> Option<(String, String)> {
    let rule = el.get("rule")?;
    let effect = rule
        .get("effect")
        .and_then(Value::as_str)
        .unwrap_or("?")
        .to_string();
    let when = rule
        .get("condition")
        .map(|c| describe_condition(c, 0))
        .unwrap_or_else(|| "<no condition>".to_string());
    Some((effect, when))
}

struct Walk {
    fields: HashMap<String, UiFieldInfo>,
    locales: BTreeSet<String>,
}

impl Walk {
    fn element(
        &mut self,
        el: &Value,
        page: Option<usize>,
        group: Option<&str>,
        inherited: &[FieldRule],
        depth: usize,
    ) {
        if depth > MAX_DEPTH || !el.is_object() {
            return;
        }
        if let Some(t) = el.get("translations").and_then(Value::as_object) {
            self.locales.extend(t.keys().cloned());
        }
        let is_control = el.get("type").and_then(Value::as_str) == Some("Control");
        let label = el
            .get("label")
            .and_then(Value::as_str)
            .filter(|l| !l.trim().is_empty());
        let own_rule = rule_of(el);

        if is_control {
            let Some(scope) = el.get("scope").and_then(Value::as_str) else {
                return;
            };
            let path = scope_to_path(scope);
            if path.is_empty() || self.fields.contains_key(&path) {
                return;
            }
            let mut info = UiFieldInfo {
                rules: inherited.to_vec(),
                page,
                group: group.map(str::to_string),
                ..Default::default()
            };
            if let Some((effect, when)) = own_rule {
                info.rules.push(FieldRule {
                    effect,
                    when,
                    on: None,
                });
            }
            if let Some(l) = label {
                info.labels.insert("default".into(), l.to_string());
            }
            for (locale, t) in el
                .get("translations")
                .and_then(Value::as_object)
                .into_iter()
                .flatten()
            {
                if let Some(l) = t.get("label").and_then(Value::as_str) {
                    info.labels.insert(locale.clone(), l.to_string());
                }
            }
            self.fields.insert(path, info);
            return;
        }

        let group = label.or(group);
        let mut rules = inherited.to_vec();
        if let Some((effect, when)) = own_rule {
            let on = label
                .map(str::to_string)
                .or_else(|| page.map(|p| format!("page {p}")))
                .unwrap_or_else(|| "section".to_string());
            rules.push(FieldRule {
                effect,
                when,
                on: Some(on),
            });
        }
        for child in el
            .get("elements")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            self.element(child, page, group, &rules, depth + 1);
        }
    }
}

pub(crate) fn analyze(ui: &Value) -> UiInfo {
    let mut walk = Walk {
        fields: HashMap::new(),
        locales: BTreeSet::new(),
    };
    if let Some(t) = ui.get("translations").and_then(Value::as_object) {
        walk.locales.extend(t.keys().cloned());
    }
    let swipe = ui.get("type").and_then(Value::as_str) == Some("SwipeLayout");
    match ui.get("elements").and_then(Value::as_array) {
        Some(pages) if swipe => {
            for (i, page) in pages.iter().enumerate() {
                walk.element(page, Some(i + 1), None, &[], 1);
            }
        }
        _ => walk.element(ui, None, None, &[], 0),
    }
    UiInfo {
        fields: walk.fields,
        locales: walk.locales.into_iter().collect(),
    }
}
