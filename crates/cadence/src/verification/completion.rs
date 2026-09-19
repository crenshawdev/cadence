//! Native acceptance completion: one owner request, evaluated by the binary
//! against current inputs, confirmed with its required projections (D-131).
//!
//! Completion requires all required execution complete, a complete current
//! verification, every truth met or effectively waived, and every required
//! human result resolved. Concerns stays incomplete. The record is immutable
//! and carries the full verdict, waiver, human and execution basis; the
//! ROADMAP phase box and the phase's REQUIREMENTS trace rows change in the
//! same confirmed transaction, and UAT.md and the approved context do not.
//! The record's lifecycle authority names the native inputs it certified, so
//! a later change to them makes it inapplicable and the disagreement exact.
use super::{human, inputs, model::{Basis, Projections}, persistence, projections, status, waivers, verdicts};
use crate::{execution::{admission, history}, plan, store::{Error, Result, model::{digest, DecisionRecord, Decision, Origin, Evidence}}};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::{Path, PathBuf}};

pub const SCHEMA: &str = "verification-completion-1";
pub const RULE: &str = "verification-incomplete";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String,
    pub attempt: String,
    pub basis: Basis,
    pub projections: Projections,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub schema: String,
    pub id: String,
    pub request_id: String,
    pub root_binding: String,
    pub phase: u32,
    pub occurrence: String,
    pub attempt: String,
    pub patch: String,
    pub basis: Basis,
    /// Digest of the native inputs this completion certified; lifecycle
    /// applicability compares it with the same inputs observed later.
    pub authority: String,
    pub label: String,
    pub truths: Vec<Value>,
    pub humans: Vec<Value>,
    pub projections: Value,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Claim {
    pub schema: String,
    pub root: PathBuf,
    pub root_binding: String,
    pub request: Request,
    pub payload_digest: String,
    pub authority_digest: String,
    pub observed: Option<Basis>,
    pub documents: BTreeMap<String, String>,
    pub unavailable: Option<Value>,
    pub roadmap: Option<String>,
    pub requirements: Option<String>,
    /// The caller-owned UAT.md observed on disk, classification only.
    pub uat: Option<String>,
    pub unreadable: Option<String>,
    pub answer: Value,
}

pub fn records(data: &Value) -> Result<Vec<Record>> {
    persistence::attempt_values(data)?;
    Ok(data[persistence::NAMESPACE].get("completions").cloned().map(serde_json::from_value).transpose()?.unwrap_or_default())
}

pub fn payload_digest(request: &Request) -> Result<String> {
    Ok(digest(&serde_json::to_vec(request)?))
}

/// The native inputs a completion certifies, from the snapshot alone: the
/// approved context, the current publication set, every admission and the
/// retained execution history of the phase. Source is verification's basis,
/// not lifecycle's: later commits do not uncheck a completed phase.
pub fn authority(data: &Value, phase: u32) -> Result<String> {
    let occurrence = plan::persistence::saved(data, phase)?;
    let value = json!({
        "context": data["context"]["phases"].get(phase.to_string()),
        "occurrence": occurrence.as_ref().map(|o| &o.id),
        "publications": occurrence.as_ref().map(|o| o.publications.iter()
            .map(|(number, p)| json!({"plan":number,"revision":p.revision,"map_revision":p.map_revision})).collect::<Vec<_>>()),
        "admissions": admission::records(data, phase)?.iter().map(|r| r.request_digest.clone()).collect::<Vec<_>>(),
        "tasks": history::records(data, phase)?.iter().map(|r| r.request_digest.clone()).collect::<Vec<_>>(),
        "plans": history::plan_records(data, phase)?.iter().map(|r| r.request_digest.clone()).collect::<Vec<_>>(),
    });
    Ok(digest(&serde_json::to_vec(&value)?))
}

/// The latest completion of a phase and whether it still applies.
pub fn applicable(data: &Value, phase: u32) -> Result<Option<(Record, bool, String)>> {
    let Some(record) = records(data)?.into_iter().rev().find(|r| r.phase == phase) else { return Ok(None) };
    let current = authority(data, phase)?;
    let (applies, reason) = if record.authority == current { (true, "native inputs unchanged since completion".to_owned()) }
        else { (false, format!("native inputs changed since completion: {}", disagreement(data, &record)?.join(", "))) };
    Ok(Some((record, applies, reason)))
}

/// Name the inputs that differ from the ones the completion certified.
fn disagreement(data: &Value, record: &Record) -> Result<Vec<String>> {
    let phase = record.phase;
    let mut fields = Vec::new();
    let context = data["context"]["phases"].get(phase.to_string()).map(|c| digest(&serde_json::to_vec(c).unwrap_or_default()));
    if context.as_deref() != Some(&record.basis.context_digest) { fields.push("context".to_owned()); }
    let occurrence = plan::persistence::saved(data, phase)?;
    if occurrence.as_ref().map(|o| &o.id) != Some(&record.occurrence) { fields.push("occurrence".to_owned()); }
    let admissions = admission::records(data, phase)?;
    if admissions.iter().map(|r| r.request_digest.clone()).collect::<Vec<_>>() != record.basis.admission_digests { fields.push("admissions".to_owned()); }
    let admitted: Vec<_> = admissions.last().map(|a| a.request.contract.plans.clone()).unwrap_or_default();
    let published: Vec<_> = occurrence.as_ref().map(|o| o.publications.iter().map(|(n, p)| (*n, p.revision.clone(), p.map_revision.clone())).collect()).unwrap_or_default();
    if published != admitted.iter().map(|b| (b.plan, b.content_revision.clone(), Some(b.map_revision.clone()))).collect::<Vec<_>>()
        || admitted != record.basis.publications { fields.push("publications".to_owned()); }
    let events = history::records(data, phase)?;
    let plan_events = history::plan_records(data, phase)?;
    let outcomes = history::plan_outcomes(data, phase)?;
    if digest(&serde_json::to_vec(&json!({"events":events,"plan_events":plan_events,"outcomes":outcomes}))?) != record.basis.execution_digest { fields.push("execution".to_owned()); }
    if fields.is_empty() { fields.push("native inputs".to_owned()); }
    Ok(fields)
}

fn read_text(path: &Path) -> std::result::Result<Option<String>, String> {
    match std::fs::read(path) {
        Ok(bytes) => String::from_utf8(bytes).map(Some).map_err(|_| format!("{} is not UTF-8 text", path.display())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("{}: {error}", path.display())),
    }
}

pub fn prepare(root: &Path, data: &Value, request: Request) -> Result<Claim> {
    let phase = request.basis.phase;
    let mut claim = Claim { schema: SCHEMA.into(), root: root.into(), root_binding: inputs::root_binding(root)?,
        payload_digest: payload_digest(&request)?, authority_digest: inputs::authority_digest(data)?, request,
        observed: None, documents: BTreeMap::new(), unavailable: None, roadmap: None, requirements: None, uat: None, unreadable: None, answer: Value::Null };
    let observation = (|| -> Result<()> {
        let observed = inputs::observe(root, data, phase)?;
        claim.documents = plan::inventory::read(root, &phase.to_string(), data)?.documents;
        claim.observed = Some(observed.basis);
        Ok(())
    })();
    if let Err(error) = observation { claim.unavailable = Some(verdicts::error_answer(error)); }
    match (read_text(&root.join("ROADMAP.md")), read_text(&root.join("REQUIREMENTS.md"))) {
        (Ok(roadmap), Ok(requirements)) => { claim.roadmap = roadmap; claim.requirements = requirements; }
        (Err(reason), _) | (_, Err(reason)) => claim.unreadable = Some(reason),
    }
    match read_text(&human::uat_path(root, phase)) {
        Ok(uat) => claim.uat = uat,
        Err(reason) => claim.unreadable = Some(reason),
    }
    claim.answer = assess(data, &claim)?;
    Ok(claim)
}

/// The ROADMAP.md bytes with exactly this phase's box checked; refuses an
/// absent, repeated or already checked declaration instead of guessing.
pub fn render_roadmap(text: &str, phase: u32) -> std::result::Result<(String, usize), String> {
    let parsed = crate::derivation::parse_roadmap(text).map_err(|e| format!("ROADMAP.md is not a readable roadmap: {e}"))?;
    let declarations: Vec<_> = parsed.phases.iter().filter(|p| p.id.address() == phase.to_string()).collect();
    let declaration = match declarations.as_slice() {
        [one] => *one,
        [] => return Err(format!("ROADMAP.md declares no phase {phase}")),
        _ => return Err(format!("ROADMAP.md declares phase {phase} more than once")),
    };
    if declaration.checked { return Err(format!("ROADMAP.md already declares phase {phase} complete")); }
    let normalized = text.strip_prefix('\u{feff}').unwrap_or(text);
    let mut lines: Vec<&str> = normalized.split('\n').collect();
    let index = declaration.source_line - 1;
    let line = lines.get(index).ok_or_else(|| "ROADMAP.md line addressing failed".to_owned())?;
    let stripped = line.strip_suffix('\r').unwrap_or(line);
    let Some(rest) = stripped.strip_prefix("- [ ] **Phase ") else { return Err(format!("ROADMAP.md line {} is not the phase {phase} box", declaration.source_line)) };
    let checked = format!("- [x] **Phase {rest}{}", if line.ends_with('\r') { "\r" } else { "" });
    lines[index] = &checked;
    Ok((lines.join("\n"), declaration.source_line))
}

/// The REQUIREMENTS.md bytes with this phase's declared trace rows Complete.
/// None when no row is required; a row on another phase or already Complete
/// is ambiguous and refuses.
pub fn render_requirements(text: &str, phase: u32, declared: &[String]) -> std::result::Result<Option<(String, Vec<String>)>, String> {
    let Some(table) = projections::traceability(text) else { return Ok(None) };
    let mut lines: Vec<String> = text.split('\n').map(str::to_owned).collect();
    let mut changed = Vec::new();
    for id in declared {
        let rows: Vec<_> = table.rows.iter().filter(|r| r.id == *id).collect();
        let row = match rows.as_slice() {
            [] => continue,
            [row] => *row,
            _ => return Err(format!("REQUIREMENTS.md traces {id} more than once")),
        };
        if row.phase != format!("Phase {phase}") { return Err(format!("REQUIREMENTS.md traces {id} to {}, not phase {phase}", row.phase)); }
        if row.status == "Complete" { return Err(format!("REQUIREMENTS.md already marks {id} Complete")); }
        let line = &lines[row.line];
        let eol = if line.ends_with('\r') { "\r" } else { "" };
        let mut parts = line.trim_end_matches('\r').splitn(4, '|');
        let (lead, id_cell, phase_cell, rest) = (parts.next().unwrap_or_default(), parts.next().unwrap_or_default(), parts.next().unwrap_or_default(), parts.next().unwrap_or_default());
        let tail = rest.split_once('|').map(|(_, tail)| format!("|{tail}")).unwrap_or_else(|| "|".into());
        lines[row.line] = format!("{lead}|{id_cell}|{phase_cell}| Complete {tail}{eol}");
        changed.push(id.clone());
    }
    if changed.is_empty() { return Ok(None) }
    Ok(Some((lines.join("\n"), changed)))
}

fn assess(data: &Value, claim: &Claim) -> Result<Value> {
    let request = &claim.request;
    let phase = request.basis.phase;
    let denied = |rule: &str, slot: &str, id: &str, reason: &str, requested: Value, current: Value| {
        Ok(verdicts::refusal(rule, slot, id, reason, requested, current))
    };
    if request.request_id.trim().is_empty() || request.request_id.len() > 256 {
        return denied("verification-request", "request_id", "", "bounded nonblank request identity required", json!(request.request_id.len()), json!(256));
    }
    if phase == 0 || crate::context::persistence::saved(data, phase)?.is_none() {
        return denied("native-approved-truths", "basis.phase", "", "completion belongs to a phase with native approved truths", json!(phase), Value::Null);
    }
    if let Some(reason) = &claim.unreadable {
        return denied("verification-projection", "projections", "", "a required projection could not be observed", json!(reason), Value::Null);
    }
    let Some(observed) = &claim.observed else {
        // Unfinished execution, dirty source or an incoherent map is itself the
        // unfinished work; the located refusal names it.
        return Ok(claim.unavailable.clone().unwrap_or_else(|| verdicts::refusal("verification-inputs", "basis", "", "current verification authority unavailable", Value::Null, Value::Null)));
    };
    let differs = status::differs(&request.basis, observed)?;
    if let Some(field) = differs.first() {
        let (requested, current) = (serde_json::to_value(&request.basis)?, serde_json::to_value(observed)?);
        let name = field.trim_start_matches("basis.");
        return denied("verification-basis", field, "", "requested basis differs from the current verification basis", requested[name].clone(), current[name].clone());
    }
    let attempts = persistence::attempts(data)?;
    let patches = verdicts::patches(data)?;
    let Some((attempt, patch)) = attempts.iter().rev().filter(|a| a.inputs.basis == *observed)
        .find_map(|a| patches.iter().find(|p| p.attempt == a.id).map(|p| (a, p))) else {
        return denied(RULE, "verification", "", "no complete verification on the current basis; every item needs a current verdict", json!(request.attempt), Value::Null);
    };
    if attempt.id != request.attempt {
        return denied("verification-attempt", "attempt", "", "requested attempt is not the current complete verification", json!(request.attempt), json!(attempt.id));
    }
    let mut truths = serde_json::to_value(status::rows(attempt, patch)?)?;
    let effective = waivers::applicability(data, phase, Some((attempt, &attempt.inputs.basis)))?;
    status::overlay(&mut truths, &effective);
    let mut unfinished = Vec::new();
    for row in truths.as_array().into_iter().flatten() {
        if row["status"] != "met" && row["status"] != "waived" {
            unfinished.push(json!({"kind":"truth","id":row["id"],"version":row["version"],"status":row["status"],"reason":row["reason"],
                "items":row["items"].as_array().into_iter().flatten().filter(|i| i["verdict"] != "accepted")
                    .map(|i| json!({"id":i["id"],"verdict":i["verdict"]})).collect::<Vec<_>>()}));
        }
    }
    for item in human::unfinished(data, phase, claim.uat.as_deref())? {
        unfinished.push(json!({"kind":"human","id":item["id"],"status":item["status"],"source":item["source"],"first_pass":item["first_pass"]}));
    }
    if let Some(first) = unfinished.first() {
        let slot = if first["kind"] == "truth" { "truths" } else { "humans" };
        return Ok(verdicts::refusal(RULE, slot, first["id"].as_str().unwrap_or_default(),
            "acceptance work is unfinished; every truth must be met or waived and every required human result resolved",
            json!({"unfinished":unfinished}), json!({"counts":status::counts(&truths)})));
    }
    if let Some((prior, true, _)) = applicable(data, phase)? {
        return denied("verification-complete", "phase", "", "phase completion is already recorded on these native inputs", json!(request.request_id), json!(prior.id));
    }
    let Some(roadmap) = &claim.roadmap else {
        return denied("verification-projection", "projections.roadmap", "", "ROADMAP.md is absent; completion needs the phase box it checks", Value::Null, Value::Null);
    };
    if request.projections.roadmap != digest(roadmap.as_bytes()) {
        return denied("verification-projection", "projections.roadmap", "", "ROADMAP.md differs from the preimage the owner read",
            json!(request.projections.roadmap), json!(digest(roadmap.as_bytes())));
    }
    if request.projections.requirements != claim.requirements.as_ref().map(|t| digest(t.as_bytes())) {
        return denied("verification-projection", "projections.requirements", "", "REQUIREMENTS.md differs from the preimage the owner read",
            json!(request.projections.requirements), json!(claim.requirements.as_ref().map(|t| digest(t.as_bytes()))));
    }
    let (roadmap_bytes, line) = match render_roadmap(roadmap, phase) {
        Ok(rendered) => rendered,
        Err(reason) => return denied("verification-projection", "projections.roadmap", "", &reason, json!(phase), Value::Null),
    };
    let occurrence = plan::persistence::saved(data, phase)?.ok_or_else(|| Error::Invalid("native publications absent".into()))?;
    let declared = plan::persistence::declared_requirements(&occurrence.publications.values().cloned().collect::<Vec<_>>());
    let requirements = match claim.requirements.as_deref().map(|text| render_requirements(text, phase, &declared)).transpose() {
        Ok(rendered) => rendered.flatten(),
        Err(reason) => return denied("verification-projection", "projections.requirements", "", &reason, json!(declared), Value::Null),
    };
    let waived: Vec<_> = truths.as_array().into_iter().flatten().filter(|r| r["status"] == "waived").map(|r| r["id"].clone()).collect();
    let record = Record { schema: SCHEMA.into(), id: digest(&serde_json::to_vec(&(&request.request_id, &claim.root_binding, &request.basis))?),
        request_id: request.request_id.clone(), root_binding: claim.root_binding.clone(), phase, occurrence: occurrence.id.clone(),
        attempt: attempt.id.clone(), patch: patch.request_id.clone(), basis: request.basis.clone(), authority: authority(data, phase)?,
        label: if waived.is_empty() { "complete".into() } else { "complete-with-waivers".into() },
        truths: truths.as_array().into_iter().flatten().map(|r| json!({"id":r["id"],"version":r["version"],"status":r["status"],
            "derived":r.get("derived").cloned().unwrap_or(r["status"].clone()),"waiver":r["waiver"]["id"]})).collect(),
        humans: human::items_with(data, phase, claim.uat.as_deref())?.into_iter().map(|i| json!({"id":i["id"],"status":i["status"],"first_pass":i["first_pass"],"source":i["source"]})).collect(),
        projections: json!({"roadmap":{"preimage":digest(roadmap.as_bytes()),"installed":digest(roadmap_bytes.as_bytes()),"line":line},
            "requirements":requirements.as_ref().map(|(bytes, ids)| json!({"preimage":claim.requirements.as_ref().map(|t| digest(t.as_bytes())),
                "installed":digest(bytes.as_bytes()),"rows":ids}))}) };
    Ok(json!({"status":"ok","receipt":{"schema":SCHEMA,"record":record,"counts":status::counts(&truths),"waived":waived,"replayed":false}}))
}

pub fn contribute(data: &Value, binding: &str, claim: &Claim) -> Result<Value> {
    if claim.schema != SCHEMA || claim.root_binding != binding
        || claim.payload_digest != payload_digest(&claim.request)?
        || claim.authority_digest != inputs::authority_digest(data)?
        || replay(data, &claim.request)?.is_some() || claim.answer != assess(data, claim)? {
        return Err(Error::Invalid("completion claim differs from committing authority or immutable outcome".into()));
    }
    if claim.answer["status"] != "ok" {
        return Err(Error::Invalid("a refused completion is never retained".into()));
    }
    let record: Record = serde_json::from_value(claim.answer["receipt"]["record"].clone())?;
    let mut history = records(data)?;
    history.push(record);
    let mut next = data.clone();
    next[persistence::NAMESPACE]["completions"] = json!(history);
    Ok(next)
}

pub fn replay(data: &Value, request: &Request) -> Result<Option<Value>> {
    let Some(prior) = records(data)?.into_iter().find(|r| r.request_id == request.request_id) else { return Ok(None) };
    Ok(Some(if prior.basis == request.basis && prior.attempt == request.attempt
        && prior.projections["roadmap"]["preimage"] == request.projections.roadmap
        && prior.projections["requirements"]["preimage"] == json!(request.projections.requirements) {
        json!({"status":"ok","receipt":{"schema":SCHEMA,"record":prior,"replayed":true}})
    } else {
        verdicts::refusal("verification-complete-reuse", "request_id", &request.request_id,
            "request already names a different completion payload", json!(payload_digest(request)?), json!(prior.id))
    }))
}

pub fn decision(claim: &Claim) -> Result<DecisionRecord> {
    Ok(DecisionRecord { version: 1, id: format!("verification-completion:{}", digest(claim.request.request_id.as_bytes())), revision: 1,
        origin: Origin { source: SCHEMA.into(), original: Evidence::Missing },
        decision: Decision::Gate { outcome: SCHEMA.into(), evidence: Evidence::Text(serde_json::to_string(claim)?) },
        at: crate::store::model::stamped_at() })
}

/// The projection participants an accepted claim installs, in order.
pub fn installed(claim: &Claim) -> Result<Vec<(String, Vec<u8>)>> {
    let phase = claim.request.basis.phase;
    let roadmap = claim.roadmap.as_deref().ok_or_else(|| Error::Invalid("completion lacks its roadmap preimage".into()))?;
    let (roadmap_bytes, _) = render_roadmap(roadmap, phase).map_err(Error::Invalid)?;
    let mut out = vec![("roadmap".to_owned(), roadmap_bytes.into_bytes())];
    if claim.answer["receipt"]["record"]["projections"]["requirements"].is_object() {
        let text = claim.requirements.as_deref().ok_or_else(|| Error::Invalid("completion lacks its requirements preimage".into()))?;
        let declared: Vec<String> = serde_json::from_value(claim.answer["receipt"]["record"]["projections"]["requirements"]["rows"].clone())?;
        let (bytes, _) = render_requirements(text, phase, &declared).map_err(Error::Invalid)?
            .ok_or_else(|| Error::Invalid("completion requirements render absent".into()))?;
        out.push(("requirements".to_owned(), bytes.into_bytes()));
    }
    Ok(out)
}

/// Relative paths of the installed projections with their bytes, for source
/// accounting: the project sees `.planning/ROADMAP.md` change and nothing else.
pub fn accounted(claim: &Claim) -> Result<BTreeMap<String, Vec<u8>>> {
    let project = Path::new(&claim.request.basis.project);
    let mut out = BTreeMap::new();
    for (target, bytes) in installed(claim)? {
        let name = crate::store::filesystem::projection_target(&target).ok_or_else(|| Error::Invalid("unknown projection".into()))?;
        let relative = claim.root.join(name);
        let relative = relative.strip_prefix(project).map_err(|_| Error::Invalid("projection outside the project".into()))?;
        out.insert(relative.to_string_lossy().into_owned(), bytes);
    }
    Ok(out)
}

pub fn transaction(data: &Value, claim: &Claim, expected: &[crate::store::Observed]) -> Result<crate::store::transaction::Transaction> {
    let installed = installed(claim)?;
    if expected.len() != installed.len() {
        return Err(Error::Invalid("completion participants differ from its projections".into()));
    }
    let mut external = Vec::new();
    for ((target, bytes), expected) in installed.into_iter().zip(expected) {
        let preimage = match target.as_str() { "roadmap" => claim.roadmap.as_deref(), _ => claim.requirements.as_deref() };
        if expected.bytes.as_deref() != preimage.map(str::as_bytes) {
            return Err(Error::Conflict(format!("{target} changed after completion was observed")));
        }
        external.push(crate::store::transaction::ExternalChange { target, expected: expected.clone(), bytes });
    }
    Ok(crate::store::transaction::Transaction { id: format!("verification-complete:{}", digest(claim.request.request_id.as_bytes())),
        items: vec![], decisions: vec![decision(claim)?], snapshot: Some(contribute(data, &claim.root_binding, claim)?), external })
}

/// Commit and recovery reobserve root, source and installed plans; the
/// transaction's own confirmed projections are accounted for, never stale.
pub fn reobserve(data: &Value, claim: &Claim) -> Result<()> {
    if inputs::root_binding(&claim.root)? != claim.root_binding {
        return Err(Error::Conflict("completion claim root changed".into()));
    }
    let attempt = persistence::attempt(data, None, &claim.request.attempt)?
        .ok_or_else(|| Error::Invalid("completion attempt absent".into()))?;
    let mut installed = crate::execution::render::installed_summaries(data)?;
    installed.extend(accounted(claim)?);
    inputs::reobserve_external_accounting(&claim.root, &attempt.inputs, &claim.documents, &installed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roadmap_render_checks_exactly_one_open_box() {
        let text = "# Roadmap\n\n## Phases\n- [ ] **Phase 12: Twelve** - done soon\n- [ ] **Phase 13: Thirteen**\r\n- [x] **Phase 14: Fourteen**\n";
        let (rendered, line) = render_roadmap(text, 13).unwrap();
        assert_eq!(line, 5);
        assert_eq!(rendered, text.replace("- [ ] **Phase 13: Thirteen**\r\n", "- [x] **Phase 13: Thirteen**\r\n"));
        assert_eq!(render_roadmap(text, 14).unwrap_err(), "ROADMAP.md already declares phase 14 complete");
        assert_eq!(render_roadmap(text, 15).unwrap_err(), "ROADMAP.md declares no phase 15");
        let twice = "## Phases\n- [ ] **Phase 13: A**\n- [ ] **Phase 13: B**\n";
        assert_eq!(render_roadmap(twice, 13).unwrap_err(), "ROADMAP.md declares phase 13 more than once");
    }

    #[test]
    fn requirements_render_completes_only_this_phase_rows_and_refuses_ambiguity() {
        let text = "## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n| A-01 | Phase 13 | Pending |\n| B-02 | Phase 14 | Pending |\n| C-03 | Phase 13 | Complete |\n";
        let ids = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let (rendered, rows) = render_requirements(text, 13, &ids(&["A-01", "Z-99"])).unwrap().unwrap();
        assert_eq!(rows, ["A-01"]);
        assert_eq!(rendered, text.replace("| A-01 | Phase 13 | Pending |", "| A-01 | Phase 13 | Complete |"));
        assert_eq!(render_requirements(text, 13, &ids(&["Z-99"])).unwrap(), None);
        assert_eq!(render_requirements("no table\n", 13, &ids(&["A-01"])).unwrap(), None);
        assert_eq!(render_requirements(text, 13, &ids(&["B-02"])).unwrap_err(), "REQUIREMENTS.md traces B-02 to Phase 14, not phase 13");
        assert_eq!(render_requirements(text, 13, &ids(&["C-03"])).unwrap_err(), "REQUIREMENTS.md already marks C-03 Complete");
    }
}
