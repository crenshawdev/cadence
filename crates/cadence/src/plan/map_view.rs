//! Authoritative acceptance inputs, independent of Markdown inventory and repair.
//!
//! Canonical input JSON sorts object keys recursively by UTF-8 bytes. Set arrays
//! use: truths (id, version); contributions/projections (numeric plan); items
//! (opaque id, item revision); aliases (numeric plan, map revision, item id,
//! item revision); associations (that origin, truth id, version, authored edge
//! index); history (numeric plan, map revision). Authored arrays inside retained
//! maps and specs keep their order. The edge index breaks otherwise equal
//! association identities without losing repeated reasons or their provenance.
//! Only the documented input fields are hashed; coherence, explanatory prose,
//! read transport ids, clocks and absolute roots are excluded.
use super::{map_history, model::{self, Answer}, persistence};
use cadence::store::{Result, model::{Snapshot, STATE, ITEMS, DECISIONS, digest}};
use serde_json::{Value, json};
use std::{collections::{BTreeMap, BTreeSet}, path::Path, time::SystemTime};

const SCHEMA: &str = "acceptance-map-view-1";
const INTENT: &str = ".store-intent.json";

#[derive(PartialEq, Eq)]
struct Input {
    bytes: Option<Vec<u8>>,
    modified: Option<SystemTime>,
}

fn observe(root: &Path, path: &str) -> std::io::Result<Input> {
    let path = root.join(path);
    let before = match std::fs::metadata(&path) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Input { bytes: None, modified: None }),
        Err(error) => return Err(error),
    };
    let bytes = std::fs::read(&path)?;
    let after = std::fs::metadata(&path)?;
    if before.modified().ok() != after.modified().ok() || before.len() != after.len() {
        return Err(std::io::Error::other("input changed while reading"));
    }
    Ok(Input { bytes: Some(bytes), modified: after.modified().ok() })
}

fn inconsistent(phase: u32, inputs: Vec<String>, reason: String) -> Answer {
    model::ok("evidence-read", json!({"schema":SCHEMA,"phase":phase,
        "coherence":"inconsistent","rule":"inconsistent-inputs","inputs":inputs,"reason":reason}))
}

/// Observe every participating file twice. No ownership, Store, first_touch,
/// recovery or inventory parser is involved. This detects observed changes; it
/// does not claim filesystem-wide atomicity or acquire a reader-start guard.
pub fn read(root: &Path, phase: u32) -> Result<Answer> {
    let mut before = BTreeMap::new();
    for path in [INTENT, STATE, ITEMS, DECISIONS] {
        let input = match observe(root, path) {
            Ok(input) => input,
            Err(error) => return Ok(inconsistent(phase, vec![path.into()], error.to_string())),
        };
        if path == INTENT && input.bytes.is_some() {
            return Ok(inconsistent(phase, vec![INTENT.into()], "outstanding intent; readback does not recover owner work".into()));
        }
        before.insert(path.to_owned(), input);
    }
    let data = match before[STATE].bytes.as_deref() {
        None if before[ITEMS].bytes.is_none() && before[DECISIONS].bytes.is_none() => json!({}),
        bytes => {
            let snapshot = match Snapshot::parse(bytes.unwrap_or_default(),
                before[ITEMS].bytes.as_deref().unwrap_or_default(), before[DECISIONS].bytes.as_deref().unwrap_or_default()) {
                Ok(snapshot) => snapshot,
                Err(error) => return Ok(inconsistent(phase, vec![STATE.into(), ITEMS.into(), DECISIONS.into()], error.to_string())),
            };
            // Match normal verified snapshot readback's JSONL record validation.
            for result in [
                cadence::store::model::parse_lines(before[ITEMS].bytes.as_deref().unwrap_or_default())
                    .and_then(|records| cadence::store::model::validate_items(&records)),
                cadence::store::model::parse_lines(before[DECISIONS].bytes.as_deref().unwrap_or_default())
                    .and_then(|records| cadence::store::model::validate_decisions(&records)),
            ] {
                if let Err(error) = result {
                    return Ok(inconsistent(phase, vec![ITEMS.into(), DECISIONS.into()], error.to_string()));
                }
            }
            snapshot.data
        }
    };
    let saved = match persistence::saved(&data, phase) {
        Ok(saved) => saved,
        Err(error) => return Ok(inconsistent(phase, vec![STATE.into()], error.to_string())),
    };
    if let Some(saved) = &saved {
        for publication in saved.publications.values() {
            let path = format!("phases/{phase}/PLAN-{}.md", publication.identity.plan);
            let input = match observe(root, &path) {
                Ok(input) => input,
                Err(error) => return Ok(inconsistent(phase, vec![path], error.to_string())),
            };
            before.insert(path, input);
        }
    }
    let assembled = assemble(&data, phase, &before);
    let changed: Vec<_> = before.iter().filter_map(|(path, input)| {
        let after = observe(root, path);
        (!after.is_ok_and(|after| after == *input)).then(|| path.clone())
    }).collect();
    if !changed.is_empty() {
        return Ok(inconsistent(phase, changed, "participating inputs changed during readback".into()));
    }
    let mut view = match assembled {
        Ok(view) => view,
        Err(error) => return Ok(inconsistent(phase, vec![STATE.into()], error.to_string())),
    };
    let input_digest = digest(&serde_json::to_vec(&canonical(&view))?);
    view["coherence"] = json!("consistent");
    view["input_digest"] = json!(input_digest);
    Ok(model::ok("evidence-read", view))
}

/// Check the retained map event and every definition before exposing it as
/// execution authority. The aggregate readback digest is not an item identity.
pub fn checked_map(data: &Value, phase: u32, publication: &model::Publication) -> Result<map_history::Revision> {
    let invalid = |field: &str, id: &str, reason: &str| model::Diagnostic {
        rule: "map-authority".into(), slot: format!("current.plans[{}].{field}", publication.identity.plan),
        phase: Some(phase), entry: None, id: Some(id.into()), reason: reason.into(), details: None,
    }.error();
    let id = publication.identity.plan.to_string();
    let revision = publication.map_revision.as_ref().ok_or_else(|| invalid("map_revision", &id, "attached map required"))?;
    let history = map_history::saved(data, phase)?.ok_or_else(|| invalid("map_revision", &id, "map history absent"))?;
    let event = history.revisions.iter().find(|r| &r.revision == revision)
        .ok_or_else(|| invalid("map_revision", &id, "map event absent"))?;
    let submission = publication.approval.submission.as_ref().ok_or_else(|| invalid("approval", &id, "approval absent"))?;
    if history.occurrence != publication.occurrence || history.superseded.contains_key(revision)
        || event.identity != publication.identity || event.content_revision != publication.revision
        || event.occurrence != publication.occurrence || event.request_id != submission.request_id
        || event.payload_digest != persistence::payload_digest(submission, &publication.approval)?
        || event.revision != map_history::event_id(submission, &publication.identity)?
        || publication.content.evidence_map.as_ref() != Some(&super::evidence::Map::Attached { items: event.items.clone() })
        || event.item_revisions.len() != event.items.len()
    {
        return Err(invalid("map_revision", &id, "map event differs from exact publication authority"));
    }
    for item in &event.items {
        if event.item_revisions.get(item.id()) != Some(&digest(&serde_json::to_vec(&map_history::definition(item)?)?)) {
            return Err(invalid("item_revision", item.id(), "item revision differs from retained definition"));
        }
    }
    Ok(event.clone())
}

fn assemble(data: &Value, phase: u32, inputs: &BTreeMap<String, Input>) -> Result<Value> {
    let context = cadence::context::persistence::saved(data, phase)?;
    let mut truths = context.as_ref().map(|c| c.truths.iter().collect::<Vec<_>>()).unwrap_or_default();
    truths.sort_by(|a, b| (&a.id, a.version).cmp(&(&b.id, b.version)));
    let mut contributions = Vec::new();
    let mut items = BTreeMap::new();
    let mut associations = Vec::new();
    let mut aliases = Vec::new();
    let mut projections = Vec::new();
    let mut covered = BTreeSet::new();
    let mut checks: BTreeMap<(String, u32), BTreeSet<String>> = BTreeMap::new();
    if let Some(saved) = persistence::saved(data, phase)? {
        for publication in saved.publications.values() {
            persistence::validate_retained(data, phase, publication)?;
            let number = publication.identity.plan.get();
            let request = publication.approval.submission.as_ref()
                .ok_or_else(|| cadence::store::Error::Invalid("publication lacks its receipt request".into()))?;
            contributions.push(json!({"identity":publication.identity,"content_revision":publication.revision,
                "map_revision":publication.map_revision,"request_id":request.request_id}));
            let bytes = inputs[&format!("phases/{phase}/PLAN-{number}.md")].bytes.as_deref();
            let observed_digest = bytes.map(digest);
            projections.push(json!({"identity":publication.identity,"current_revision":publication.revision,
                "observed_digest":observed_digest,"status":match &observed_digest {
                    None => "missing", Some(d) if d == &publication.revision => "installed", _ => "drifted",
                }}));
            let Some(revision) = &publication.map_revision else { continue };
            let event = checked_map(data, phase, publication)?;
            let mut ordered = event.items.iter().collect::<Vec<_>>();
            ordered.sort_by_key(|item| item.id());
            for item in ordered {
                let item_revision = event.item_revisions.get(item.id())
                    .ok_or_else(|| cadence::store::Error::Invalid("item revision is absent".into()))?;
                let mut definition = map_history::definition(item)?;
                definition["item_revision"] = json!(item_revision);
                if items.insert(item.id().to_owned(), definition.clone()).is_some_and(|prior| prior != definition) {
                    return Err(cadence::store::Error::Invalid("conflicting current item definitions".into()));
                }
                let origin = json!({"plan":number,"map_revision":revision,"item_id":item.id(),"item_revision":item_revision});
                aliases.push(json!({"origin":origin,"id":item.id(),"item_revision":item_revision}));
                let mut edges = item.associations().iter().enumerate().collect::<Vec<_>>();
                edges.sort_by_key(|(index, edge)| (&edge.truth_id, edge.truth_version, *index));
                for (index, edge) in edges {
                    let mut origin = origin.clone();
                    origin["association_index"] = json!(index);
                    associations.push(json!({"truth_id":edge.truth_id,"truth_version":edge.truth_version,
                        "reason":edge.reason,"origin":origin}));
                    let key = (edge.truth_id.clone(), edge.truth_version);
                    covered.insert(key.clone());
                    if matches!(item, super::evidence::Item::Check { .. }) {
                        checks.entry(key).or_default().insert(item.id().to_owned());
                    }
                }
            }
        }
    }
    let uncovered: Vec<_> = truths.iter().filter(|t| !covered.contains(&(t.id.clone(), t.version))).map(|t| &t.id).collect();
    let without_check: Vec<_> = truths.iter().filter(|t| !checks.contains_key(&(t.id.clone(), t.version))).map(|t| &t.id).collect();
    let check_ids: Vec<_> = truths.iter().map(|t| json!({"truth_id":t.id,"truth_version":t.version,
        "item_ids":checks.get(&(t.id.clone(), t.version)).cloned().unwrap_or_default()})).collect();
    let mut history = map_history::view(data, phase)?;
    history.sort_by(|a, b| {
        (a["publication"]["identity"]["plan"].as_u64(), a["publication"]["revision"].as_str())
            .cmp(&(b["publication"]["identity"]["plan"].as_u64(), b["publication"]["revision"].as_str()))
    });
    Ok(json!({"schema":SCHEMA,"phase":phase,"occurrence":persistence::occurrence(data, phase)?,
        "truths":truths.iter().map(|t| json!({"id":t.id,"version":t.version,"text":t.text,"kind":t.kind})).collect::<Vec<_>>(),
        "contributions":contributions,"items":items.into_values().collect::<Vec<_>>(),
        "associations":associations,"aliases":aliases,"history":history,
        "coverage":{"uncovered":uncovered,"without_check":without_check,"checks":check_ids},
        "readiness":"provisional-authoring","projections":projections}))
}

fn canonical(value: &Value) -> Value {
    match value {
        Value::Object(object) => {
            let keys: BTreeSet<_> = object.keys().collect();
            Value::Object(keys.into_iter().map(|key| (key.clone(), canonical(&object[key]))).collect())
        }
        Value::Array(array) => Value::Array(array.iter().map(canonical).collect()),
        value => value.clone(),
    }
}
