//! Completion declared at import (the owner's ruling of 2026-09-11).
//!
//! A roadmap-ticked phase whose documents cannot derive Complete under the
//! legacy SUMMARY/UAT table gets one record saying what adoption believed:
//! the tick, the status the documents do derive, and the human results as
//! they are on disk. The binary computes it from the documents; no caller
//! supplies it. It claims nothing (`claims: []`): no truth met, no verdict,
//! no human result resolved, no red or green observed. It lives in its own
//! namespace because the store refuses to seed verification authority at
//! import, and this record is exactly not that authority. It applies only
//! while the phase has no native authority; an approved context for the
//! phase makes the native path decide and leaves the record as history.
use crate::derivation::{CapturedInputs, Lifecycle, LifecycleStatus, Observation, parse_uat};
use crate::store::{Error, Result, model::digest};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const NAMESPACE: &str = "adoption";
pub const NAMESPACE_SCHEMA: &str = "adoption-1";
pub const SCHEMA: &str = "verification-declared-completion-1";
pub const AT_IMPORT: &str = "declared-at-import";
pub const LEGACY_RULE: &str = "summary-and-uat";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Roadmap {
    /// One-based line of the ticked row in ROADMAP.md.
    pub line: usize,
    /// Zero-based entry ordinal, the way a state conflict names it.
    pub entry: usize,
    /// Digest of the ROADMAP.md bytes the declaration was read from.
    pub digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Derived {
    /// The status the documents DO derive under the legacy table.
    pub status: LifecycleStatus,
    pub legacy_rule: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HumanResults {
    pub present: bool,
    pub pass: usize,
    pub fail: usize,
    pub skipped: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub id: String,
    pub root_binding: String,
    pub phase: u32,
    pub provenance: String,
    pub roadmap: Roadmap,
    /// The store generation the declaring transaction committed.
    pub import_generation: u64,
    pub source_generation: String,
    pub derived: Derived,
    pub human_results: Option<HumanResults>,
    /// Written explicitly and always empty: a reader sees the absence.
    pub claims: Vec<Value>,
}

/// What the documents say about one ticked phase the legacy table derives
/// short of Complete. Pure document facts; the record adds provenance.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Declaration {
    pub phase: u32,
    pub roadmap: Roadmap,
    pub derived: Derived,
    pub human_results: Option<HumanResults>,
}

pub fn records(data: &Value) -> Result<Vec<Record>> {
    let Some(namespace) = data.get(NAMESPACE) else { return Ok(vec![]) };
    if namespace["schema"] != NAMESPACE_SCHEMA {
        return Err(Error::Invalid("unsupported adoption namespace".into()));
    }
    Ok(namespace.get("declared_completions").cloned().map(serde_json::from_value).transpose()?.unwrap_or_default())
}

/// The ticked phases the legacy table cannot derive complete, from one
/// capture and its legacy derivation: never an unticked phase, never a phase
/// the documents derive Complete, never a phase with a native completion
/// record, and only a phase the native path can address (a positive integer).
pub fn declarations(capture: &CapturedInputs, legacy: &Lifecycle, data: &Value) -> Result<Vec<Declaration>> {
    let (Some(Ok(parsed)), Observation::Present(roadmap)) = (&capture.declarations, &capture.roadmap) else { return Ok(vec![]) };
    let roadmap_digest = digest(roadmap);
    let mut out = Vec::new();
    for (row, derived) in parsed.phases.iter().zip(&legacy.phases) {
        if !row.checked || derived.status == LifecycleStatus::Complete { continue }
        let address = row.id.address();
        let Ok(phase) = address.parse::<u32>() else { continue };
        if phase == 0 || phase.to_string() != address { continue }
        if crate::verification::completion::applicable(data, phase)?.is_some() { continue }
        let human_results = capture.phases.iter().find(|p| p.relative_path == row.relative_path)
            .and_then(|p| match &p.uat { Observation::Present(bytes) => Some(bytes), _ => None })
            .map(|bytes| {
                let counts = parse_uat(&String::from_utf8_lossy(bytes)).counts;
                HumanResults { present: true, pass: counts.pass, fail: counts.fail, skipped: counts.skipped }
            });
        out.push(Declaration {
            phase,
            roadmap: Roadmap { line: row.source_line, entry: row.ordinal, digest: roadmap_digest.clone() },
            derived: Derived { status: derived.status, legacy_rule: LEGACY_RULE.into() },
            human_results,
        });
    }
    Ok(out)
}

pub fn record_id(root_binding: &str, phase: u32, roadmap_digest: &str) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&(root_binding, phase, roadmap_digest))?))
}

/// One declared record with its provenance; the id binds root, phase and
/// the roadmap bytes read, never the generation it lands in.
pub fn record(root_binding: &str, declaration: &Declaration, provenance: &str, import_generation: u64, source_generation: &str) -> Result<Record> {
    Ok(Record {
        schema: SCHEMA.into(),
        id: record_id(root_binding, declaration.phase, &declaration.roadmap.digest)?,
        root_binding: root_binding.into(),
        phase: declaration.phase,
        provenance: provenance.into(),
        roadmap: declaration.roadmap.clone(),
        import_generation,
        source_generation: source_generation.into(),
        derived: declaration.derived.clone(),
        human_results: declaration.human_results.clone(),
        claims: vec![],
    })
}

/// The one writer: appends the records under the namespace, creating it on
/// first use. The import calls it at first touch; a later explicit adoption
/// operation calls the same function with its own provenance.
pub fn contribute(data: &Value, records: &[Record]) -> Result<Value> {
    if records.is_empty() { return Ok(data.clone()) }
    let mut history = self::records(data)?;
    history.extend(records.iter().cloned());
    let mut next = if data.is_null() { json!({}) } else { data.clone() };
    if next.get(NAMESPACE).is_none() { next[NAMESPACE] = json!({"schema": NAMESPACE_SCHEMA}); }
    next[NAMESPACE]["declared_completions"] = json!(history);
    Ok(next)
}

/// The latest declared record for the phase, only while the phase has no
/// native authority: no approved context, no publication, no admission.
pub fn applicable(data: &Value, phase: u32) -> Result<Option<Record>> {
    let Some(record) = records(data)?.into_iter().rev().find(|r| r.phase == phase) else { return Ok(None) };
    if data["context"]["phases"].get(phase.to_string()).is_some()
        || crate::plan::persistence::saved(data, phase)?.is_some_and(|o| !o.publications.is_empty())
        || !crate::execution::admission::records(data, phase)?.is_empty()
    {
        return Ok(None);
    }
    Ok(Some(record))
}

#[cfg(test)]
mod tests;
