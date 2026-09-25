//! Read-only verification audit (D-128, D-132): one phase-scoped join from
//! each requirement through its assigned phase, the published plans that
//! claim it, the phase's current truth set, the typed map's evidence and the
//! current verdicts and waivers. Every missing edge is reported with its
//! origin and a next action. The audit infers no semantic requirement-to-truth
//! edge, counts no structural coverage as met, and writes nothing.
use crate::process::Process;
use super::{inputs, projections, status};
use crate::{plan, store::{Result, model::digest}};
use serde_json::{Value, json};
use std::{collections::{BTreeMap, BTreeSet}, path::Path};

pub const SCHEMA: &str = "verification-audit-1";
pub const CANONICAL: &str = "cad-audit";
pub const ALIAS: &str = "cad-coverage";
pub const OPERATION: &str = "verification-audit";
pub const SCOPE_LIMIT: &str = "phase-scoped: the requirement-to-truth association is the phase's whole truth set, never a semantic edge";
pub const READ_ONLY_LIMIT: &str = "read-only: no status, map, UAT or store record is written or repaired";
const OUT_OF_SCOPE_LIMIT: &str = "rows assigned to other declared phases are listed as out of scope, not joined";
const NO_VERDICT: &str = "no complete verification on the current basis";

pub fn association_note(phase: u32) -> String {
    format!("a requirement assigned to phase {phase} is joined to every current truth of phase {phase} through the phase's typed map; no direct requirement-to-truth edge is authored or inferred")
}

fn verify_next(phase: u32) -> String {
    format!("run the verifier for phase {phase} and submit one complete item patch")
}

/// `- **<id>**` bullets under `## Active`, with their one-based lines, for
/// exactly the ids the projection grammar declares active.
fn active_lines(text: &str) -> Option<BTreeMap<String, usize>> {
    let ids = projections::active_ids(text)?;
    let mut lines = BTreeMap::new();
    let mut in_active = false;
    for (index, line) in text.split('\n').enumerate() {
        if line.starts_with("## ") { in_active = line.trim() == "## Active"; continue }
        if !in_active { continue }
        let Some(rest) = line.strip_prefix('-') else { continue };
        let rest = rest.trim_start();
        let rest = ["[ ]", "[x]", "[X]"].iter().find_map(|m| rest.strip_prefix(m)).map(str::trim_start).unwrap_or(rest);
        let Some(rest) = rest.strip_prefix("**") else { continue };
        let Some((id, _)) = rest.split_once("**") else { continue };
        let id = id.trim();
        if ids.contains(id) { lines.entry(id.to_owned()).or_insert(index + 1); }
    }
    Some(lines)
}

fn read_text(path: &Path) -> std::result::Result<Option<String>, String> {
    match std::fs::read(path) {
        Ok(bytes) => String::from_utf8(bytes).map(Some).map_err(|_| format!("{} is not UTF-8 text", path.display())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("{}: {error}", path.display())),
    }
}

fn edge(name: &str, state: &str, value: Value) -> Value {
    json!({"edge":name,"state":state,"value":value})
}

fn broken(edge: &str, reason: String, next_action: String) -> Value {
    json!({"edge":edge,"reason":reason,"next_action":next_action})
}

fn phase_number(cell: &str) -> Option<u32> {
    cell.strip_prefix("Phase ")?.trim().parse::<u32>().ok().filter(|n| *n > 0)
}

struct Roadmap {
    phases: Vec<Value>,
}

impl Roadmap {
    fn declaration(&self, phase: u32) -> Option<Value> {
        let address = phase.to_string();
        self.phases.iter().find(|p| p["phase"] == address)
            .map(|p| json!({"path":"ROADMAP.md","line":p["line"],"checked":p["checked"]}))
    }
}

/// The owner-visible audit for one phase, from the documents and records as
/// they are; a stray `command` is refused instead of guessed at.
pub fn report(root: &Path, data: &Value, phase: u32, requested: Option<&str>, process: &mut dyn Process) -> Result<Value> {
    if let Some(name) = requested && name != CANONICAL && name != ALIAS {
        return Err(inputs::refuse(phase, OPERATION, "command", format!("{name} is not an audit command; use {CANONICAL} or its read-only alias {ALIAS}")));
    }
    let mut limits = vec![SCOPE_LIMIT.to_owned(), READ_ONLY_LIMIT.to_owned(), OUT_OF_SCOPE_LIMIT.to_owned()];
    // Sources, each observed as it is and named when it is unavailable.
    let (requirements, requirements_note) = match read_text(&root.join("REQUIREMENTS.md")) {
        Ok(text) => (text, None),
        Err(reason) => (None, Some(reason)),
    };
    let (roadmap_text, roadmap_note) = match read_text(&root.join("ROADMAP.md")) {
        Ok(text) => (text, None),
        Err(reason) => (None, Some(reason)),
    };
    let active = requirements.as_deref().and_then(active_lines).unwrap_or_default();
    let rows = requirements.as_deref().and_then(projections::traceability).map(|t| t.rows).unwrap_or_default();
    let requirements_source = match &requirements {
        Some(text) => json!({"path":"REQUIREMENTS.md","available":true,"digest":digest(text.as_bytes()),
            "active":active.keys().collect::<Vec<_>>(),
            "rows":rows.iter().map(|r| json!({"line":r.line + 1,"id":r.id,"phase":r.phase,"status":r.status})).collect::<Vec<_>>()}),
        None => {
            limits.push(match &requirements_note {
                Some(reason) => format!("REQUIREMENTS.md is unreadable ({reason}): active declarations and trace rows are unknown"),
                None => "REQUIREMENTS.md is absent: active declarations and trace rows are unknown".into(),
            });
            json!({"path":"REQUIREMENTS.md","available":false,"digest":null,"active":[],"rows":[]})
        }
    };
    let roadmap = match roadmap_text.as_deref().map(crate::derivation::parse_roadmap) {
        Some(Ok(parsed)) => Some(Roadmap { phases: parsed.phases.iter()
            .map(|p| json!({"phase":p.id.address(),"line":p.source_line,"checked":p.checked})).collect() }),
        Some(Err(error)) => { limits.push(format!("ROADMAP.md is not a readable roadmap ({error}): no phase declaration is known")); None }
        None => {
            limits.push(match &roadmap_note {
                Some(reason) => format!("ROADMAP.md is unreadable ({reason}): no phase declaration is known"),
                None => "ROADMAP.md is absent: no phase declaration is known".into(),
            });
            None
        }
    };
    let roadmap_source = match (&roadmap, &roadmap_text) {
        (Some(parsed), Some(text)) => json!({"path":"ROADMAP.md","available":true,"digest":digest(text.as_bytes()),"phases":parsed.phases}),
        _ => json!({"path":"ROADMAP.md","available":false,"digest":null,"phases":[]}),
    };
    let context = crate::context::persistence::saved(data, phase)?;
    let truths: Vec<Value> = context.as_ref().map(|c| {
        let mut truths: Vec<_> = c.truths.iter().collect();
        truths.sort_by(|a, b| (&a.id, a.version).cmp(&(&b.id, b.version)));
        truths.iter().map(|t| json!({"id":t.id,"version":t.version})).collect()
    }).unwrap_or_default();
    let context_source = json!({"available":context.is_some(),"truths":truths});
    let occurrence = plan::persistence::saved(data, phase)?;
    let publications: Vec<Value> = occurrence.as_ref().map(|o| o.publications.iter().map(|(number, p)| json!({
        "plan":number,"revision":p.revision,"map_revision":p.map_revision,"requirements":p.content.requirements})).collect()).unwrap_or_default();
    let map = match plan::map_view::read(root, phase)? {
        plan::model::Answer::Ok { data, .. } => Value::Object(data),
        other => serde_json::to_value(other)?,
    };
    let map_consistent = map["coherence"] == "consistent";
    let superseded: Vec<Value> = map["history"].as_array().into_iter().flatten().filter(|h| h["status"] == "superseded")
        .map(|h| json!({"plan":h["publication"]["identity"]["plan"],"revision":h["publication"]["revision"],"superseded_by":h["superseded_by"]})).collect();
    let map_source = if map_consistent {
        json!({"coherence":"consistent","input_digest":map["input_digest"],"superseded":superseded})
    } else {
        limits.push(format!("the evidence map is not readable coherently ({}): no item or association is known", map["reason"].as_str().unwrap_or("inconsistent")));
        json!({"coherence":map["coherence"],"rule":map["rule"],"reason":map["reason"],"superseded":superseded})
    };
    let verification = match &context {
        Some(_) => Some(status::report(root, data, phase, process)?),
        None => None,
    };
    let verification_source = match &verification {
        Some(report) => json!({"applicable":report["current"]["applicable"],"attempt":report["current"]["attempt"],"patch":report["current"]["patch"],
            "reason":report["current"]["reason"],"unavailable":report["current"]["unavailable"],
            "waivers":report["waivers"].as_array().into_iter().flatten().map(|w| json!({"id":w["id"],"truth":w["truth"],"effective":w["effective"],"reason":w["reason"]})).collect::<Vec<_>>(),
            "history":report["history"].as_array().into_iter().flatten().map(|h| json!({"attempt":h["attempt"],"applicability":h["applicability"],"reason":h["reason"]})).collect::<Vec<_>>()}),
        None => json!({"applicable":false,"attempt":null,"patch":null,"reason":"native approved truths required","unavailable":null,"waivers":[],"history":[]}),
    };
    // The join, one row per requirement id seen anywhere.
    let claimants: BTreeMap<String, Vec<u32>> = occurrence.as_ref().map(|o| {
        let mut claimants: BTreeMap<String, Vec<u32>> = BTreeMap::new();
        for (number, p) in &o.publications { for id in &p.content.requirements { claimants.entry(id.clone()).or_default().push(*number); } }
        claimants
    }).unwrap_or_default();
    let mut ids: BTreeSet<String> = active.keys().cloned().collect();
    ids.extend(rows.iter().map(|r| r.id.clone()));
    ids.extend(claimants.keys().cloned());
    let this_phase = roadmap.as_ref().and_then(|r| r.declaration(phase));
    let associations = map["associations"].as_array().cloned().unwrap_or_default();
    let item_ids = |truth: &Value| -> Vec<String> {
        let mut ids: Vec<String> = associations.iter().filter(|a| a["truth_id"] == truth["id"] && a["truth_version"] == truth["version"])
            .filter_map(|a| a["origin"]["item_id"].as_str().map(str::to_owned)).collect();
        ids.sort(); ids.dedup(); ids
    };
    let mut traces = Vec::new();
    let mut out_of_scope = Vec::new();
    for id in ids {
        let active_line = active.get(&id).copied();
        let row = rows.iter().find(|r| r.id == id);
        let claimed = claimants.get(&id).cloned().unwrap_or_default();
        let assigned = row.and_then(|r| phase_number(&r.phase));
        let row_json = row.map(|r| json!({"path":"REQUIREMENTS.md","line":r.line + 1,"phase":r.phase,"status":r.status}));
        let plan_rows = |plans: &[u32]| -> Vec<Value> { publications.iter().filter(|p| plans.iter().any(|n| p["plan"] == *n))
            .map(|p| json!({"plan":p["plan"],"revision":p["revision"],"map_revision":p["map_revision"]})).collect() };
        let mut edges = Vec::new();
        let mut breaks = Vec::new();
        let scope;
        let mut origins = json!({"active":active_line.map(|line| json!({"path":"REQUIREMENTS.md","line":line})),"row":row_json,"roadmap":null,"plans":[]});
        match (row, assigned) {
            (Some(row), Some(number)) if number == phase => {
                scope = "phase";
                edges.push(edge("requirement->phase", "present", json!(row.phase)));
                match &this_phase {
                    Some(declaration) => { origins["roadmap"] = declaration.clone(); edges.push(edge("phase->roadmap", "present", json!(format!("ROADMAP.md:{}", declaration["line"])))); }
                    None => { edges.push(edge("phase->roadmap", "missing", Value::Null));
                        breaks.push(broken("phase->roadmap", format!("ROADMAP.md declares no phase {phase}"), format!("declare Phase {phase} in ROADMAP.md, or reassign {id}'s trace row"))); }
                }
                if active_line.is_none() {
                    breaks.push(broken("requirement->active", format!("{id} has a trace row but no ## Active declaration"), format!("declare {id} under ## Active in REQUIREMENTS.md, or remove its trace row")));
                }
                origins["plans"] = json!(plan_rows(&claimed));
                if claimed.is_empty() {
                    edges.push(edge("phase->plan", "missing", Value::Null));
                    breaks.push(broken("phase->plan", format!("no published plan of phase {phase} names {id}"), format!("publish a phase {phase} plan naming {id}, or reassign its trace row")));
                } else {
                    edges.push(edge("phase->plan", "present", json!(claimed)));
                }
            }
            (Some(row), Some(number)) => {
                if roadmap.as_ref().is_some_and(|r| r.declaration(number).is_some()) {
                    out_of_scope.push(json!({"requirement":id,"phase":row.phase,"line":row.line + 1,"reason":"assigned to another declared phase; audit that phase"}));
                    continue;
                }
                scope = "global";
                edges.push(edge("requirement->phase", "present", json!(row.phase)));
                edges.push(edge("phase->roadmap", "missing", Value::Null));
                breaks.push(broken("phase->roadmap", format!("ROADMAP.md declares no phase {number}"), format!("declare Phase {number} in ROADMAP.md, or reassign {id}'s trace row")));
            }
            (Some(row), None) => {
                scope = "global";
                edges.push(edge("requirement->phase", "missing", json!(row.phase)));
                breaks.push(broken("requirement->phase", format!("{id}'s trace row names {:?}, not a phase", row.phase), format!("write {id}'s Phase cell as Phase <n>")));
            }
            (None, _) if active_line.is_some() => {
                scope = "global";
                edges.push(edge("requirement->phase", "missing", Value::Null));
                breaks.push(broken("requirement->phase", format!("{id} is active with no ## Traceability row"),
                    format!("publish a plan naming {id} in its requirements so publication seeds its trace row, or add the row by hand")));
            }
            (None, _) => {
                scope = "phase";
                origins["roadmap"] = this_phase.clone().unwrap_or(Value::Null);
                origins["plans"] = json!(plan_rows(&claimed));
                edges.push(edge("plan->requirement", "missing", json!(claimed)));
                let plans = claimed.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(", ");
                breaks.push(broken("plan->requirement", format!("plan {plans} names {id}, which REQUIREMENTS.md does not declare under ## Active"),
                    format!("declare {id} under ## Active in REQUIREMENTS.md, or remove it from plan {plans}")));
            }
        }
        let mut truth_rows = Vec::new();
        let mut verdict_missing = false;
        if breaks.is_empty() {
            match &context {
                None => {
                    edges.push(edge("plan->truths", "missing", Value::Null));
                    breaks.push(broken("plan->truths", format!("phase {phase} has no native approved context"), format!("approve native context for phase {phase} through /cad-context")));
                }
                Some(_) => {
                    edges.push(json!({"edge":"plan->truths","state":"present","scope":"phase-scoped","value":truths.iter().map(|t| t["id"].clone()).collect::<Vec<_>>()}));
                    if !map_consistent {
                        edges.push(edge("truth->evidence", "missing", Value::Null));
                        breaks.push(broken("truth->evidence", format!("the evidence map is unavailable: {}", map["reason"].as_str().unwrap_or("inconsistent")), "settle the outstanding intent or inconsistent input, then audit again".into()));
                    } else {
                        let uncovered: Vec<_> = truths.iter().filter(|t| item_ids(t).is_empty()).map(|t| t["id"].as_str().unwrap_or_default().to_owned()).collect();
                        let mut all: Vec<String> = truths.iter().flat_map(&item_ids).collect();
                        all.sort(); all.dedup();
                        if uncovered.is_empty() {
                            edges.push(edge("truth->evidence", "present", json!(all)));
                        } else {
                            edges.push(edge("truth->evidence", "missing", json!(uncovered)));
                            breaks.push(broken("truth->evidence", format!("no current evidence item is associated with {}", uncovered.join(", ")), format!("publish a phase {phase} plan whose map covers {}", uncovered.join(", "))));
                        }
                    }
                }
            }
        }
        if breaks.is_empty() && let Some(report) = &verification {
            if report["current"]["applicable"] == true {
                edges.push(edge("evidence->verdict", "present", report["current"]["attempt"].clone()));
            } else {
                verdict_missing = true;
                edges.push(edge("evidence->verdict", "missing", Value::Null));
                let unavailable = &report["current"]["unavailable"];
                let (reason, next) = if unavailable.is_object() {
                    let rule = unavailable["rule"].as_str().unwrap_or_default().to_owned();
                    let next = if rule.starts_with("admission") || rule == "publication-authority" {
                        format!("admit the current plan set (execution-extend) and verify phase {phase} again")
                    } else { verify_next(phase) };
                    (format!("current verification inputs unavailable: {rule}"), next)
                } else { (NO_VERDICT.to_owned(), verify_next(phase)) };
                breaks.push(broken("evidence->verdict", reason, next));
            }
            for row in report["truths"].as_array().into_iter().flatten() {
                let mut row = row.clone();
                let (truth_id, truth_version) = (row["id"].clone(), row["version"].clone());
                for item in row["items"].as_array_mut().into_iter().flatten() {
                    let mut plans: Vec<u64> = associations.iter().filter(|a| a["truth_id"] == truth_id && a["truth_version"] == truth_version && a["origin"]["item_id"] == item["id"])
                        .filter_map(|a| a["origin"]["plan"].as_u64()).collect();
                    plans.sort(); plans.dedup();
                    item["origins"] = json!(plans.iter().map(|p| json!({"plan":p,"item_id":item["id"]})).collect::<Vec<_>>());
                }
                truth_rows.push(row);
            }
        }
        let outcome = if breaks.iter().any(|b| b["edge"] != "evidence->verdict") { "broken" }
            else if verdict_missing { "pending" }
            else {
                let status = |name: &str| truth_rows.iter().any(|r| r["status"] == name);
                if status("unmet") { "unmet" } else if status("pending") { "pending" } else if status("concerns") { "concerns" }
                else if status("waived") { "waived" } else { "met" }
            };
        traces.push(json!({"requirement":id,"scope":scope,"origins":origins,"edges":edges,"truths":truth_rows,"breaks":breaks,"outcome":outcome}));
    }
    let count = |name: &str| traces.iter().filter(|t| t["outcome"] == name).count();
    let mut answer = json!({"status":"ok","schema":SCHEMA,"phase":phase,"read_only":true,
        "command":{"requested":requested.unwrap_or(OPERATION),"canonical":CANONICAL,"operation":OPERATION,"generate":null},
        "association":{"kind":"phase-scoped","note":association_note(phase)},
        "sources":{"requirements":requirements_source,"roadmap":roadmap_source,"context":context_source,"publications":publications,
            "map":map_source,"verification":verification_source},
        "traces":traces,
        "counts":{"met":count("met"),"waived":count("waived"),"concerns":count("concerns"),"unmet":count("unmet"),"pending":count("pending"),
            "broken":count("broken"),"out_of_scope":out_of_scope.len()},
        "out_of_scope":out_of_scope,"limits":limits});
    answer["report"] = json!(super::render::audit_text(&answer));
    Ok(answer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_lines_follow_the_projection_grammar() {
        let text = "# R\n\n## Active\n\n- **A-01**: first\n- [ ] **B-02**: second\n- prose\n\n## Traceability\n\n| **A-01** | Phase 1 | Pending |\n";
        assert_eq!(active_lines(text), Some(BTreeMap::from([("A-01".to_owned(), 5), ("B-02".to_owned(), 6)])));
        assert_eq!(active_lines("# none\n"), None);
    }

    #[test]
    fn phase_cells_parse_only_the_projection_shape() {
        assert_eq!(phase_number("Phase 13"), Some(13));
        assert_eq!(phase_number("Phase 0"), None);
        assert_eq!(phase_number("13"), None);
        assert_eq!(phase_number("Phase later"), None);
    }
}
