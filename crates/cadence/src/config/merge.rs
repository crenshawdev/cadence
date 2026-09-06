use super::{Diagnostic, Diagnostics, Effective, GLOBAL_ONLY, Layer, schema};
use serde_json::{Value, json};
use std::collections::BTreeMap;

pub fn get<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    key.split('.')
        .try_fold(value, |value, part| value.as_object()?.get(part))
}

pub fn set(value: &mut Value, key: &str, new: Value) {
    let (head, tail) = key.split_once('.').unwrap_or((key, ""));
    if !value.is_object() {
        *value = json!({});
    }
    let object = value.as_object_mut().expect("object established");
    if tail.is_empty() {
        object.insert(head.into(), new);
    } else {
        set(object.entry(head).or_insert_with(|| json!({})), tail, new);
    }
}

fn remove(value: &mut Value, key: &str) {
    let (head, tail) = key.split_once('.').unwrap_or((key, ""));
    if let Some(object) = value.as_object_mut() {
        if tail.is_empty() {
            object.remove(head);
        } else if let Some(child) = object.get_mut(head) {
            remove(child, tail);
        }
    }
}

/// Frozen config-merge.mjs:75-85: absence inherits; null, arrays and scalars replace.
pub fn deep_merge(base: &Value, over: &Value) -> Value {
    match (base.as_object(), over.as_object()) {
        (Some(base), Some(over)) => {
            let mut merged = base.clone();
            for (key, value) in over {
                let next = base
                    .get(key)
                    .map_or_else(|| value.clone(), |old| deep_merge(old, value));
                merged.insert(key.clone(), next);
            }
            Value::Object(merged)
        }
        _ => over.clone(),
    }
}

fn diagnostic(layer: Layer, key: &str, reason: &str) -> Diagnostic {
    Diagnostic {
        layer,
        key: key.into(),
        reason: reason.into(),
    }
}

fn scoped(raw: &Value, layer: Layer, global_intent: bool, diagnostics: &mut Diagnostics) -> Value {
    let mut value = raw.clone();
    if layer == Layer::Repo && !global_intent {
        for key in GLOBAL_ONLY {
            let ancestor = key.split('.').next().unwrap();
            let path = if value.get(ancestor).is_some_and(|v| !v.is_object()) {
                ancestor
            } else {
                key
            };
            if let Some(old) = get(&value, path) {
                if !old.is_null() {
                    diagnostics.scope.push(diagnostic(
                        layer,
                        path,
                        "ignored: global-only setting or blocking ancestor",
                    ));
                }
                remove(&mut value, path);
            }
        }
    }
    if layer == Layer::Global && get(&value, "git.forge_repo").is_some_and(|v| !v.is_null()) {
        diagnostics.scope.push(diagnostic(
            layer,
            "git.forge_repo",
            "imported global provenance; new global writes refused",
        ));
    }
    value
}

/// Keep containers (including explicit null) intact for merge semantics. Unknown
/// branches and retired leaves are evidence only; raw layers retain their values.
fn project(
    value: &Value,
    prefix: &str,
    layer: Layer,
    diagnostics: &mut Diagnostics,
) -> Option<Value> {
    if let Some(spec) = schema().get(prefix) {
        if spec["disposition"] == "dead" {
            diagnostics.migration.push(diagnostic(
                layer,
                prefix,
                "retired; non-effective source evidence only",
            ));
            return None;
        }
        return Some(value.clone());
    }
    let start = format!("{prefix}.");
    let container = prefix.is_empty() || schema().keys().any(|k| k.starts_with(&start));
    if !container {
        diagnostics.migration.push(diagnostic(
            layer,
            prefix,
            "unknown; non-effective source evidence only",
        ));
        return None;
    }
    // A wholly retired container cannot suppress inherited/default policy.
    if !prefix.is_empty()
        && !schema()
            .iter()
            .any(|(k, s)| k.starts_with(&start) && s["disposition"] != "dead")
    {
        if let Some(object) = value.as_object() {
            for (key, child) in object {
                project(child, &format!("{prefix}.{key}"), layer, diagnostics);
            }
        } else {
            diagnostics.migration.push(diagnostic(
                layer,
                prefix,
                "retired container; non-effective source evidence only",
            ));
        }
        return None;
    }
    match value.as_object() {
        None => Some(value.clone()),
        Some(object) => {
            let mut out = serde_json::Map::new();
            for (key, child) in object {
                let path = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{prefix}.{key}")
                };
                if let Some(child) = project(child, &path, layer, diagnostics) {
                    out.insert(key.clone(), child);
                }
            }
            Some(Value::Object(out))
        }
    }
}

pub fn merge(global: Option<Value>, repo: Option<Value>, global_intent: bool) -> Effective {
    let mut diagnostics = Diagnostics::default();
    let mut layer = |raw: &Option<Value>, source| match raw {
        None => json!({}),
        Some(value) if value.is_object() => {
            let value = scoped(value, source, global_intent, &mut diagnostics);
            project(&value, "", source, &mut diagnostics).unwrap_or_else(|| json!({}))
        }
        Some(_) => {
            diagnostics.invalid_layer.push(diagnostic(
                source,
                "",
                "top-level is not a JSON object",
            ));
            json!({})
        }
    };
    let global_values = layer(&global, Layer::Global);
    let repo_values = layer(&repo, Layer::Repo);
    let merged = deep_merge(&global_values, &repo_values);
    let mut defaults = json!({});
    let mut sources = BTreeMap::new();
    for (key, spec) in schema() {
        if spec["disposition"] == "dead" {
            continue;
        }
        set(&mut defaults, key, spec["default"].clone());
        if get(&repo_values, key).is_some() {
            sources.insert(key.clone(), Layer::Repo);
        } else if get(&global_values, key).is_some() {
            sources.insert(key.clone(), Layer::Global);
        }
    }
    Effective {
        raw_global: global,
        raw_repo: repo,
        global: global_values,
        repo: repo_values,
        values: deep_merge(&defaults, &merged),
        sources,
        global_intent,
        diagnostics,
    }
}
