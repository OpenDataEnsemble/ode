//! Attachment basename extraction for import validation (TS parity).

use std::collections::HashSet;

use serde_json::Value;

const ATTACHMENT_SCHEMA_FORMATS: &[&str] = &["photo", "select_file", "signature", "audio", "video"];

const ATTACHMENT_BASENAME_EXT: &[&str] = &[
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".heic", ".tif", ".tiff", ".pdf", ".doc",
    ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".txt", ".mp3", ".mp4", ".m4a", ".wav",
    ".aac", ".flac", ".webm", ".mov", ".mkv", ".svg",
];

#[derive(Debug, Clone, PartialEq, Eq)]
enum SchemaPathSegment {
    Key(String),
    Each,
}

fn is_object(v: &Value) -> bool {
    v.is_object()
}

fn resolve_json_pointer<'a>(root: &'a Value, ref_str: &str) -> Option<&'a Value> {
    if !ref_str.starts_with("#/") {
        return None;
    }
    let mut cur = root;
    for raw in ref_str[2..].split('/') {
        let p = raw.replace("~1", "/").replace("~0", "~");
        cur = cur.as_object()?.get(&p)?;
    }
    Some(cur)
}

fn has_attachment_format(schema: &Value) -> bool {
    schema
        .get("format")
        .and_then(|f| f.as_str())
        .is_some_and(|fmt| ATTACHMENT_SCHEMA_FORMATS.contains(&fmt))
}

fn path_sig(path: &[SchemaPathSegment]) -> String {
    path.iter()
        .map(|s| match s {
            SchemaPathSegment::Key(k) => k.as_str(),
            SchemaPathSegment::Each => "*",
        })
        .collect::<Vec<_>>()
        .join("\0")
}

/// Walk JSON Schema (draft-07 style) and collect property paths with attachment formats.
fn collect_attachment_paths_from_schema(schema_root: &Value) -> Vec<Vec<SchemaPathSegment>> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let mut stack: HashSet<*const Value> = HashSet::new();

    fn visit(
        schema_root: &Value,
        schema: &Value,
        path_prefix: &[SchemaPathSegment],
        stack: &mut HashSet<*const Value>,
        seen: &mut HashSet<String>,
        out: &mut Vec<Vec<SchemaPathSegment>>,
    ) {
        if !schema.is_object() {
            return;
        }
        let ptr = schema as *const Value;
        if !stack.insert(ptr) {
            return;
        }

        if let Some(Value::String(r)) = schema.get("$ref") {
            if let Some(resolved) = resolve_json_pointer(schema_root, r) {
                visit(schema_root, resolved, path_prefix, stack, seen, out);
            }
            stack.remove(&ptr);
            return;
        }

        for combiner in ["allOf", "anyOf", "oneOf"] {
            if let Some(Value::Array(arr)) = schema.get(combiner) {
                for branch in arr {
                    visit(schema_root, branch, path_prefix, stack, seen, out);
                }
            }
        }
        if let Some(then_schema) = schema.get("then")
            && then_schema.is_object()
        {
            visit(schema_root, then_schema, path_prefix, stack, seen, out);
        }
        if let Some(else_schema) = schema.get("else")
            && else_schema.is_object()
        {
            visit(schema_root, else_schema, path_prefix, stack, seen, out);
        }

        if has_attachment_format(schema) && !path_prefix.is_empty() {
            let sig = path_sig(path_prefix);
            if seen.insert(sig) {
                out.push(path_prefix.to_vec());
            }
            stack.remove(&ptr);
            return;
        }

        if let Some(Value::Object(props)) = schema.get("properties") {
            for (key, sub) in props {
                if !sub.is_object() {
                    continue;
                }
                let mut next_path = path_prefix.to_vec();
                next_path.push(SchemaPathSegment::Key(key.clone()));

                if has_attachment_format(sub) {
                    let sig = path_sig(&next_path);
                    if seen.insert(sig) {
                        out.push(next_path);
                    }
                } else {
                    let is_array = match sub.get("type") {
                        Some(Value::String(t)) => t == "array",
                        Some(Value::Array(arr)) => arr.iter().any(|x| x.as_str() == Some("array")),
                        _ => false,
                    };
                    if is_array {
                        if let Some(items) = sub.get("items")
                            && items.is_object()
                        {
                            if has_attachment_format(items) {
                                let mut segs = next_path;
                                segs.push(SchemaPathSegment::Each);
                                let sig = path_sig(&segs);
                                if seen.insert(sig) {
                                    out.push(segs);
                                }
                            } else {
                                let mut segs = next_path;
                                segs.push(SchemaPathSegment::Each);
                                visit(schema_root, items, &segs, stack, seen, out);
                            }
                        }
                    } else {
                        visit(schema_root, sub, &next_path, stack, seen, out);
                    }
                }
            }
        }

        match schema.get("additionalProperties") {
            Some(Value::Bool(true)) => {
                visit(
                    schema_root,
                    &Value::Object(Default::default()),
                    path_prefix,
                    stack,
                    seen,
                    out,
                );
            }
            Some(addl) if addl.is_object() => {
                visit(schema_root, addl, path_prefix, stack, seen, out);
            }
            _ => {}
        }

        stack.remove(&ptr);
    }

    visit(
        schema_root,
        schema_root,
        &[],
        &mut stack,
        &mut seen,
        &mut out,
    );
    out
}

fn basename_only(raw: &str) -> String {
    let t = raw.trim().replace('\\', "/");
    t.rsplit('/').next().unwrap_or("").trim().to_string()
}

fn has_attachment_ext(basename: &str) -> bool {
    let lower = basename.to_lowercase();
    ATTACHMENT_BASENAME_EXT
        .iter()
        .any(|ext| lower.ends_with(ext))
}

fn string_looks_like_attachment_ref(raw: &str) -> bool {
    let t = raw.trim();
    if t.is_empty() || t == "*" {
        return false;
    }
    if regex_is_mime(t) {
        return false;
    }
    let b = basename_only(t);
    if b.is_empty() || b == "*" || b.contains("..") {
        return false;
    }
    if has_attachment_ext(&b) {
        return true;
    }
    if regex_is_uuid(&b) {
        return true;
    }
    if b.len() >= 12
        && b.chars().any(|c| c == '/' || c == '_' || c == '-')
        && t.replace('\\', "/")
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '/' | '-'))
    {
        return true;
    }
    false
}

fn regex_is_mime(t: &str) -> bool {
    // image/jpeg etc.
    let bytes = t.as_bytes();
    if bytes.is_empty() || !bytes[0].is_ascii_alphabetic() {
        return false;
    }
    let Some(slash) = t.find('/') else {
        return false;
    };
    if slash == 0 || slash + 1 >= t.len() {
        return false;
    }
    t[..slash]
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '+' | '-'))
        && t[slash + 1..]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '+' | '-' | '/'))
}

fn regex_is_uuid(b: &str) -> bool {
    if b.len() != 36 {
        return false;
    }
    let bytes = b.as_bytes();
    for (i, ch) in bytes.iter().enumerate() {
        match i {
            8 | 13 | 18 | 23 => {
                if *ch != b'-' {
                    return false;
                }
            }
            _ => {
                if !ch.is_ascii_hexdigit() {
                    return false;
                }
            }
        }
    }
    true
}

fn extract_attachment_names_from_field_value(value: &Value) -> Vec<String> {
    let mut names = Vec::new();

    fn walk(v: &Value, depth: usize, names: &mut Vec<String>) {
        if depth > 16 {
            return;
        }
        match v {
            Value::Null => {}
            Value::String(s) => {
                if string_looks_like_attachment_ref(s) {
                    let b = basename_only(s);
                    if !b.is_empty() && !b.contains("..") {
                        names.push(b);
                    }
                }
            }
            Value::Array(arr) => {
                for el in arr {
                    walk(el, depth + 1, names);
                }
            }
            Value::Object(obj) => {
                let id = obj
                    .get("attachmentId")
                    .and_then(|x| x.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .or_else(|| {
                        obj.get("attachment_id")
                            .and_then(|x| x.as_str())
                            .map(str::trim)
                            .filter(|s| !s.is_empty())
                    });
                if let Some(id) = id {
                    names.push(basename_only(id));
                }
                if let Some(fn_) = obj.get("filename").and_then(|x| x.as_str())
                    && !fn_.trim().is_empty()
                {
                    let b = basename_only(fn_);
                    if !b.is_empty() && !b.contains("..") {
                        names.push(b);
                    }
                }
                for (k, val) in obj {
                    if k == "filename" || k == "attachmentId" || k == "attachment_id" {
                        continue;
                    }
                    walk(val, depth + 1, names);
                }
            }
            _ => {}
        }
    }

    walk(value, 0, &mut names);
    let mut uniq = HashSet::new();
    names
        .into_iter()
        .filter(|n| !n.is_empty() && uniq.insert(n.clone()))
        .collect()
}

fn values_at_schema_paths(data: &Value, paths: &[Vec<SchemaPathSegment>]) -> Vec<Value> {
    let mut values = Vec::new();

    fn follow(
        current: &Value,
        segments: &[SchemaPathSegment],
        idx: usize,
        values: &mut Vec<Value>,
    ) {
        if idx >= segments.len() {
            values.push(current.clone());
            return;
        }
        match &segments[idx] {
            SchemaPathSegment::Each => {
                if let Value::Array(arr) = current {
                    for el in arr {
                        follow(el, segments, idx + 1, values);
                    }
                }
            }
            SchemaPathSegment::Key(key) => {
                if let Value::Object(obj) = current
                    && let Some(next) = obj.get(key)
                {
                    follow(next, segments, idx + 1, values);
                }
            }
        }
    }

    if !is_object(data) {
        return values;
    }
    for p in paths {
        follow(data, p, 0, &mut values);
    }
    values
}

pub fn referenced_attachment_names_from_schema_and_data(
    form_schema: &Value,
    data: &Value,
) -> HashSet<String> {
    let paths = collect_attachment_paths_from_schema(form_schema);
    let mut names = HashSet::new();
    for v in values_at_schema_paths(data, &paths) {
        for n in extract_attachment_names_from_field_value(&v) {
            names.insert(n);
        }
    }
    names
}

pub fn referenced_attachment_names_heuristic(data: &Value) -> HashSet<String> {
    let mut names = HashSet::new();

    fn walk(v: &Value, depth: usize, names: &mut HashSet<String>) {
        if depth > 14 {
            return;
        }
        match v {
            Value::Array(arr) => {
                for el in arr {
                    walk(el, depth + 1, names);
                }
            }
            Value::Object(obj) => {
                for (k, val) in obj {
                    let kl = k.to_lowercase();
                    if (k == "attachmentId" || kl == "attachment_id")
                        && let Some(s) = val.as_str()
                        && !s.trim().is_empty()
                    {
                        names.insert(basename_only(s));
                    }
                    if kl == "attachments"
                        && let Value::Array(arr) = val
                    {
                        for el in arr {
                            if let Value::Object(el_obj) = el {
                                let id = el_obj
                                    .get("attachmentId")
                                    .and_then(|x| x.as_str())
                                    .or_else(|| {
                                        el_obj.get("attachment_id").and_then(|x| x.as_str())
                                    })
                                    .or_else(|| el_obj.get("id").and_then(|x| x.as_str()));
                                if let Some(id) = id
                                    && !id.trim().is_empty()
                                {
                                    names.insert(basename_only(id));
                                }
                                if let Some(fn_) = el_obj.get("filename").and_then(|x| x.as_str())
                                    && !fn_.trim().is_empty()
                                {
                                    names.insert(basename_only(fn_));
                                }
                            }
                        }
                    }
                    walk(val, depth + 1, names);
                }
            }
            _ => {}
        }
    }

    walk(data, 0, &mut names);
    names
}

/// Schema paths + heuristic (same union as TS `referencedNamesForObservation`).
pub fn referenced_attachment_names_for_observation(
    form_schema: Option<&Value>,
    data: &Value,
) -> HashSet<String> {
    let mut names = HashSet::new();
    if let Some(schema) = form_schema {
        names.extend(referenced_attachment_names_from_schema_and_data(
            schema, data,
        ));
    }
    names.extend(referenced_attachment_names_heuristic(data));
    names
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn schema_photo_path_extracts_filename() {
        let schema = json!({
            "type": "object",
            "properties": {
                "pic": { "type": "object", "format": "photo" }
            }
        });
        let data = json!({ "pic": { "filename": "a.jpg" } });
        let names = referenced_attachment_names_from_schema_and_data(&schema, &data);
        assert!(names.contains("a.jpg"));
    }

    #[test]
    fn heuristic_finds_attachment_id() {
        let data = json!({ "x": { "attachment_id": "uuid-here-12" } });
        let names = referenced_attachment_names_heuristic(&data);
        assert!(names.contains("uuid-here-12"));
    }
}
