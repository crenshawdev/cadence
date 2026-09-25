use super::{
    ReadDomain,
    model::{DocumentIdentity, DocumentRequest, DocumentSearchRequest},
};
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use grep_searcher::{Searcher, SearcherBuilder, sinks::UTF8};
use serde::Serialize;
use serde_json::{Value, json};

use crate::process::Process;
use crate::envelope::Refusal;
use std::path::Path;

const PART_BOUND: usize = 24_576;

fn bounded_parts(parts: Vec<Part>) -> Vec<Part> {
    parts.into_iter().flat_map(|part| {
        let mut chunks = Vec::new();
        let mut remaining = part.body.as_str();
        loop {
            let mut end = remaining.len().min(PART_BOUND);
            while !remaining.is_char_boundary(end) { end -= 1; }
            let selector = if chunks.is_empty() { part.selector.clone() }
                else { format!("{}:{}", part.selector, chunks.len() + 1) };
            chunks.push(Part { selector, title: part.title.clone(), body: remaining[..end].to_owned() });
            remaining = &remaining[end..];
            if remaining.is_empty() { break; }
        }
        chunks
    }).collect()
}

fn dispatch(root: &Path, identity: &DocumentIdentity, id: &str, process: &mut dyn Process) -> Result<Resolved, Value> {
    use cadence::execution::{admission, dispatch::{changed_part, issue_binding}, history, model::ExecutionSnapshot};
    let fail = |error: cadence::store::Error| refusal("identity", "document-unavailable", error.to_string());
    let data = snapshot(root)?;
    let execution: ExecutionSnapshot = serde_json::from_value(data["execution"].clone())
        .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?;
    let occurrence = execution.occurrences.values().find(|occurrence| occurrence.issues.contains_key(id)
        || occurrence.active.as_ref().is_some_and(|active| active.id == id))
        .ok_or_else(|| refusal("identity", "document-not-found", "issued dispatch identity is absent"))?;
    let issue = occurrence.issues.get(id);
    let Some(active) = &occurrence.active else {
        let records = history::records(&data, occurrence.phase).map_err(fail)?;
        let slot = issue.and_then(|issue| issue.binding["tasks"].as_array()).and_then(|tasks| {
            tasks.iter().find(|task| records.iter().any(|record| record.request.task.task == task["id"]
                && matches!(record.request.event, history::Event::Close(_) | history::Event::Retirement { .. })))
        }).and_then(|task| task["id"].as_str()).map(|task| format!("task:{task}"));
        let mut answer = refusal(slot.as_deref().unwrap_or("identity"), "dispatch-superseded", "the dispatch has ended");
        answer["value"] = json!({"dispatch_id":null});
        return Err(answer);
    };
    let binding = issue_binding(&data, active).map_err(fail)?;
    if let Some(issue) = issue
        && let Some(slot) = changed_part(&issue.binding, &binding) {
            let current = occurrence.issues.iter().find(|(_, issue)| issue.binding == binding)
                .map(|(id, _)| id.clone());
            let mut answer = refusal(&slot, "dispatch-superseded", "the issued dispatch binding has changed");
            answer["value"] = json!({"dispatch_id":current});
            return Err(answer);
    }
    let publications = cadence::plan::persistence::saved(&data, active.phase).map_err(fail)?
        .ok_or_else(|| refusal("identity", "document-not-found", "dispatch publication is absent"))?;
    let publication = publications.publications.get(&active.plan)
        .ok_or_else(|| refusal("identity", "document-not-found", "dispatch plan is absent"))?;
    let records = history::records(&data, active.phase).map_err(fail)?;
    let views = history::plan_task_views(&data, &records, active.phase, active.plan).map_err(fail)?;
    let admissions = admission::records(&data, active.phase).map_err(fail)?;
    let basis = admissions.iter().find(|record| record.request_digest == binding["admission_digest"])
        .ok_or_else(|| refusal("identity", "document-not-found", "dispatch admission is absent"))?;
    let mut operational = issue.map(|issue| issue.operational.clone()).unwrap_or_else(|| json!({
        "protocol":cadence::execution::dispatch::NATIVE_PROTOCOL,
        "instructions":cadence::execution::instructions::VERSION,"phase":active.phase,"plan":active.plan,
        "occurrence":basis.request.contract.occurrence,"admission_digest":basis.request_digest,
        "set_version":binding["set_version"],"base_sha":active.base_sha,
        "expected_execution_version":active.expected_execution_version,"lease":{"files":active.files,"directories":active.directories},
        "commands":{},"continuation":null,"policy":active.policy,"route":active.route
    }));
    let head = cadence::git_process::run(
        &cadence::git_process::launch(cadence::git_process::Caller::ReadDocumentHead).args(["rev-parse", "HEAD"]).cwd(root.parent().unwrap_or(root)), process)
        .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?;
    if !head.success() { return Err(refusal("head", "document-unavailable", "cannot observe project head")); }
    operational["head"] = json!(String::from_utf8_lossy(&head.stdout).trim());
    operational["dispatch_id"] = json!(id);
    operational["admitted_dispatch_id"] = json!(active.id);
    // The issue pins eligibility; continuation and command provenance are views.
    let mut current = cadence::evidence::persistence::read(&data).map_err(fail)?;
    let decisions = &data.0.0.decisions;
    for decision in decisions.iter().rev() {
        let Some(historical) = cadence::evidence::persistence::decode_history(decision).map_err(fail)? else { continue };
        let Some(record) = current.remove(&historical.key().map_err(fail)?) else { continue };
        if record.scope.phase != active.phase.to_string()
            || record.scope.planning_root != root.to_string_lossy()
            || record.scope.plan != "native-execution" { continue; }
        if let cadence::evidence::Fact::Gate(gate) = record.fact
            && gate.purpose == cadence::evidence::gates::Purpose::Progress
            && let cadence::evidence::gates::State::Answered(answer) = gate.state {
            operational["continuation"] = json!({"question_id":answer.question_id,
                "authorization_id":answer.authorization_id,"response":answer.actual_response,
                "checkpoint":gate.checkpoint_id});
            break;
        }
    }
    let paths = data.get("layers").and_then(|layers| layers.get("active"))
        .filter(|paths| !paths.is_null()).unwrap_or(&data["import"]["active"]);
    let paths = serde_json::from_value(paths.clone())
        .map_err(|error| refusal("commands", "document-unavailable", error.to_string()))?;
    let config = crate::config::reload::Reload::new(paths, crate::config::reload::FileIo)
        .refresh().map_err(|error| refusal("commands", "document-unavailable", error.to_string()))?;
    let configured = ["workflow.test_command", "workflow.lint_command"].into_iter().map(|key|
        cadence::execution::instructions::ConfiguredCommand {
            key: key.into(),
            value: crate::config::merge::get(&config.effective.values, key).and_then(Value::as_str).map(str::to_owned),
            layer: config.effective.sources.get(key).and_then(|layer| serde_json::to_value(layer).ok()?.as_str().map(str::to_owned)),
        }).collect::<Vec<_>>();
    let project = root.parent().unwrap_or(root);
    let present = cadence::execution::instructions::MANIFESTS.iter().map(|(name, _)| *name)
        .filter(|name| project.join(name).exists()).collect::<Vec<_>>();
    operational["commands"] = cadence::execution::instructions::command_policy(&configured, &present);
    let mut parts = Vec::new();
    let mut identity_fields = serde_json::Map::new();
    for key in ["protocol", "instructions", "phase", "plan", "occurrence", "admission_digest",
        "expected_execution_version", "set_version", "base_sha", "head", "dispatch_id", "admitted_dispatch_id"] {
        identity_fields.insert(key.into(), operational[key].clone());
    }
    let mut add = |selector: String, body: String| parts.push(Part { title: selector.clone(), selector, body });
    add("identity".into(), Value::Object(identity_fields).to_string());
    for (slot, body) in [("goal", &publication.content.goal), ("context", &publication.content.context), ("notes", &publication.content.notes)] {
        if !body.is_empty() { add(slot.into(), body.clone()); }
    }
    let mut unfinished = Vec::new();
    let mut completed = Vec::new();
    for view in views {
        if let Some(mut done) = history::completed_view(&records, &view) {
            done["document_identity"] = json!({"kind":"task-summary","phase":view.task.phase,
                "occurrence":view.task.occurrence,"plan":view.task.plan,"task":view.task.task});
            completed.push(done);
            continue;
        }
        let mut task = publication.content.tasks.iter().find(|task| task.id == view.task.task)
            .map(serde_json::to_value).transpose().map_err(|error| refusal("part", "document-invalid", error.to_string()))?
            .unwrap_or_else(|| json!({"id":view.task.task,"verify":view.verify}));
        task["checks"] = json!(view.checks);
        task["state"] = json!(view.state);
        task["uncertainty"] = cadence::execution::runner::uncertainty(root.parent().unwrap_or(root), &records, &view, process).map_err(fail)?;
        task["checkpoints"] = json!(history::task_checkpoints(&records, &view.task));
        add(format!("task:{}", view.task.task), task.to_string());
        unfinished.push(view);
    }
    for check in cadence::execution::dispatch::admitted_checks(&data, active.phase, basis, &unfinished).map_err(fail)? {
        add(format!("check:{}", check["id"].as_str().unwrap_or_default()), check.to_string());
    }
    add("completed".into(), json!(completed).to_string());
    let suite_records = history::plan_records(&data, active.phase).map_err(fail)?;
    let suite = history::plan_project(&suite_records, &history::PlanIdentity { phase: active.phase,
        occurrence: basis.request.contract.occurrence.clone(), admission_digest: basis.request_digest.clone(), plan: active.plan });
    if let Some(cadence::next_action::continuation::Decision::RepairSuite { question_id, approved: true }) =
        cadence::next_action::continuation::plan_repair_decision(&suite) {
        operational["continuation"] = json!({"suite_repair":{"question_id":question_id,"approved":true}});
    }
    add("suite".into(), json!({"command":active.suite,"state":suite}).to_string());
    add("execution".into(), json!(suite).to_string());
    for key in ["continuation", "lease", "commands", "policy", "route"] {
        add(key.into(), operational[key].to_string());
    }
    let parts = bounded_parts(parts);
    let bytes = parts.iter().flat_map(|part| part.body.bytes()).collect::<Vec<_>>();
    Ok(Resolved { identity: identity.clone(), classification: "native-dispatch",
        revision: cadence::store::model::digest(&bytes), parts })
}

#[derive(Clone, Debug, Serialize)]
pub struct Part {
    pub selector: String,
    pub title: String,
    #[serde(skip)]
    pub body: String,
}

#[derive(Clone, Debug)]
pub struct Resolved {
    pub identity: DocumentIdentity,
    pub classification: &'static str,
    pub revision: String,
    pub parts: Vec<Part>,
}

fn refusal(slot: &str, code: &str, reason: impl Into<String>) -> Value {
    // D-148: process records are reached by identity, never by path.
    Refusal::new(code, reason).rule("record-identity").slot(slot).value()
}

struct SnapshotData(cadence::store::cache::SharedSnapshot);
impl std::ops::Deref for SnapshotData {
    type Target = Value;
    fn deref(&self) -> &Value { &self.0.data }
}

fn snapshot(root: &Path) -> Result<SnapshotData, Value> {
    cadence::context::persistence::read_snapshot(root)
        .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?
        .map(SnapshotData)
        .ok_or_else(|| refusal("identity", "document-not-found", "native process authority is absent"))
}

struct AttemptExecution {
    snapshot: std::sync::Weak<cadence::store::writer::View>,
    attempt: String,
    phase: u32,
    execution: std::sync::Arc<Value>,
}
thread_local! {
    static ATTEMPT_EXECUTION: std::cell::RefCell<Option<AttemptExecution>> = const { std::cell::RefCell::new(None) };
}

/// Only immutable attempt material is memoized. Judgment and source observation
/// still run on each read; their external inputs can change without a store write.
fn attempt_execution(snapshot: &cadence::store::cache::SharedSnapshot,
    saved: &cadence::verification::persistence::Attempt) -> cadence::store::Result<std::sync::Arc<Value>> {
    let key = std::sync::Arc::downgrade(&snapshot.0);
    if let Some(hit) = ATTEMPT_EXECUTION.with(|cache| cache.borrow().as_ref()
        .filter(|entry| entry.snapshot.ptr_eq(&key) && entry.attempt == saved.id && entry.phase == saved.inputs.basis.phase)
        .map(|entry| entry.execution.clone())) { return Ok(hit); }
    let phase = saved.inputs.basis.phase;
    let mut execution = cadence::verification::dispatch::execution_view(&saved.inputs)?;
    for plan in execution["plans"].as_array_mut().into_iter().flatten() {
        for run in plan["suite_runs"].as_array_mut().into_iter().flatten() {
            run["identity"] = json!({"kind":"run-output","phase":phase,"run":run["run_id"]});
        }
        for task in plan["tasks"].as_array_mut().into_iter().flatten() {
            for run in task["runs"].as_array_mut().into_iter().flatten() {
                run["identity"] = json!({"kind":"run-output","phase":phase,"run":run["run_id"]});
            }
        }
    }
    let execution = std::sync::Arc::new(execution);
    ATTEMPT_EXECUTION.with(|cache| *cache.borrow_mut() = Some(AttemptExecution {
        snapshot: key, attempt: saved.id.clone(), phase, execution: execution.clone(),
    }));
    Ok(execution)
}

fn roadmap(root: &Path, phase: u32) -> Result<Resolved, Value> {
    let text = crate::acquisition::text(&root.join("ROADMAP.md"), crate::acquisition::Class::Source)
        .map_err(|error| match error {
            crate::acquisition::Error::Crossing(crossing) => json!({"status":"ok","kind":"acquisition","incomplete":true,
                "crossing":crossing,"notes":[crossing.to_string()]}),
            _ => refusal("identity", "document-not-found", "roadmap authority is absent"),
        })?;
    let parsed = cadence::derivation::parse_roadmap(&text)
        .map_err(|error| refusal("identity", "document-invalid", format!("roadmap authority is invalid: {error:?}")))?;
    let matches = parsed
        .phases
        .iter()
        .filter(|entry| entry.id.address() == phase.to_string())
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        let (code, reason) = if matches.is_empty() {
            ("document-not-found", "the requested roadmap phase is absent")
        } else {
            ("document-ambiguous", "the requested roadmap phase is ambiguous")
        };
        return Err(refusal("identity", code, reason));
    }
    let normalized = text.strip_prefix('\u{feff}').unwrap_or(&text).replace("\r\n", "\n");
    let line = normalized
        .lines()
        .nth(matches[0].source_line - 1)
        .ok_or_else(|| refusal("identity", "document-invalid", "the selected roadmap row is unavailable"))?;
    let body = format!("{line}\n");
    Ok(Resolved {
        identity: DocumentIdentity::PhaseRoadmapRow {
            phase: std::num::NonZeroU32::new(phase).unwrap(),
        },
        classification: "canonical-roadmap-row",
        revision: cadence::store::model::digest(text.as_bytes()),
        parts: vec![Part {
            selector: "row".into(),
            title: format!("Phase {phase}"),
            body,
        }],
    })
}

pub fn resolve(root: &Path, identity: &DocumentIdentity, process: &mut dyn Process) -> Result<Resolved, Value> {
    match identity {
        DocumentIdentity::ReviewEntry { attempt, entry } => {
            use crate::review::{material, persistence};
            let unavailable = |error: cadence::store::Error| refusal("identity", "document-unavailable", error.to_string());
            let records = persistence::records(&*snapshot(root)?).map_err(unavailable)?;
            let saved = material::authorized_entry(&records, attempt, entry).map_err(unavailable)?;
            let bytes = material::read_material(&mut persistence::MaterialStorage::from_records(&records).map_err(unavailable)?, &saved).map_err(unavailable)?;
            let text = String::from_utf8(bytes).map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?;
            let mut parts = vec![Part { selector: "entry".into(), title: "entry".into(),
                body: material::entry_metadata(&saved).map_err(unavailable)?.to_string() }];
            // Each line-map part is a complete array, independently readable.
            let mut lines = Vec::new();
            let mut size = 2;
            let mut ordinal = 1;
            for line in &saved.lines {
                let value = json!(line);
                let length = value.to_string().len() + usize::from(!lines.is_empty());
                if size + length > PART_BOUND {
                    parts.push(Part { selector: format!("lines:{ordinal}"), title: "line map".into(), body: json!(lines).to_string() });
                    ordinal += 1;
                    lines.clear();
                    size = 2;
                }
                size += value.to_string().len() + usize::from(!lines.is_empty());
                lines.push(value);
            }
            parts.push(Part { selector: format!("lines:{ordinal}"), title: "line map".into(), body: json!(lines).to_string() });
            let mut first = 1;
            for (index, mut part) in bounded_parts(vec![Part { selector: "text".into(), title: "text".into(), body: text }]).into_iter().enumerate() {
                let newlines = part.body.bytes().filter(|b| *b == b'\n').count();
                let last = first + newlines - usize::from(part.body.ends_with('\n'));
                part.selector = format!("text:{}", index + 1);
                part.title = format!("text lines {first}-{}", last.max(first));
                first += newlines;
                parts.push(part);
            }
            let revision = cadence::store::model::digest(parts.iter().flat_map(|p| p.body.bytes()).collect::<Vec<_>>().as_slice());
            Ok(Resolved { identity: identity.clone(), classification: "review-entry", revision, parts })
        }
        DocumentIdentity::VerificationAttempt { phase, attempt } => {
            let data = snapshot(root)?;
            let unavailable = |error: cadence::store::Error| refusal("identity", "document-unavailable", error.to_string());
            let saved = cadence::verification::persistence::attempt(&data, Some(phase.get()), attempt).map_err(unavailable)?
                .ok_or_else(|| refusal("identity", "document-not-found", "retained verification attempt absent"))?;
            let part = |selector: &str, value: Value| Part { selector: selector.into(), title: selector.into(), body: value.to_string() };
            let mut parts = vec![
                part("basis", json!(saved.inputs.basis)),
                part("map", saved.inputs.map.clone()),
                part("truths", saved.inputs.map["truths"].clone()),
                part("publications", json!(saved.inputs.basis.publications)),
                part("admissions", json!(saved.inputs.admissions.iter().map(|a| json!({"request_id":a.request.request_id,
                    "request_digest":a.request_digest,"set_version":a.set_version})).collect::<Vec<_>>())),
            ];
            let execution = attempt_execution(&data.0, &saved).map_err(unavailable)?;
            for check in &saved.inputs.checks {
                let id = check["id"].as_str().unwrap_or_default();
                let mut body = check.clone();
                body["evidence"] = execution["items"][id].clone();
                for key in ["owner_statements", "classifications"] {
                    body["evidence"][key] = json!(execution["plans"].as_array().into_iter().flatten()
                        .flat_map(|p| p["tasks"].as_array().into_iter().flatten())
                        .flat_map(|t| t[key].as_array().into_iter().flatten())
                        .filter(|r| r["statement"]["submission"]["check"]["id"] == id).collect::<Vec<_>>());
                }
                parts.push(part(&format!("check:{id}"), body));
            }
            for plan in execution["plans"].as_array().into_iter().flatten() {
                parts.push(part(&format!("plan:{}", plan["plan"]["plan"]), plan.clone()));
            }
            let mut report = cadence::verification::status::report(root, &data, phase.get(), process).map_err(unavailable)?;
            report["history"].as_array_mut().into_iter().for_each(|rows| rows.retain(|r| r["attempt"] == *attempt));
            parts.push(part("judgment", report.clone()));
            parts.push(Part { selector: "report".into(), title: "report".into(), body: cadence::verification::render::text(&report) });
            // Full caller observations remain available at this identity even
            // when verification-read truncates their current row previews.
            let claims = cadence::verification::verdicts::claims(&data).map_err(unavailable)?;
            for claim in claims.iter().filter(|c| c.patch.attempt == *attempt) {
                parts.push(part(&format!("claim:{}", claim.patch.request_id), json!({"patch":claim.patch,"answer":claim.answer})));
            }
            let revision = cadence::store::model::digest(parts.iter().flat_map(|p| p.body.bytes()).collect::<Vec<_>>().as_slice());
            Ok(Resolved { identity: identity.clone(), classification: "verification-attempt", revision, parts: bounded_parts(parts) })
        }
        DocumentIdentity::RunOutput { phase, run } => {
            let data = snapshot(root)?;
            let view = cadence::execution::history::run_view(&data, phase.get(), run)?;
            let mut parts = bounded_parts(vec![
                Part { selector: "launch".into(), title: "launch".into(), body: view.launch.to_string() },
                Part { selector: "result".into(), title: "result".into(), body: view.result.to_string() },
            ]);
            for (stream, text) in ["stdout", "stderr"].into_iter().zip(view.streams) {
                let chunks = bounded_parts(vec![Part { selector: stream.into(), title: stream.into(), body: text }]);
                for (index, mut part) in chunks.into_iter().enumerate() {
                    part.selector = format!("{stream}:{}", index + 1);
                    parts.push(part);
                }
            }
            let revision = cadence::store::model::digest(parts.iter().flat_map(|p| p.body.bytes()).collect::<Vec<_>>().as_slice());
            Ok(Resolved { identity: identity.clone(), classification: "run-output", revision, parts })
        }
        DocumentIdentity::Dispatch { id } => dispatch(root, identity, id, process),
        DocumentIdentity::PlanDraft { phase, plan, digest } => {
            let drafts = crate::import::drafts(root)
                .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?;
            let drafts = drafts.lock()
                .map_err(|_| refusal("identity", "document-unavailable", "drafts unavailable"))?;
            drafts.plans.get(&(phase.get(), digest.clone()))
                .and_then(|draft| draft.documents.iter().find(|document| matches!(
                    &document.identity, DocumentIdentity::PlanDraft { plan: number, .. } if number == plan
                ))).cloned()
                .ok_or_else(|| refusal("identity", "document-not-found", "held plan draft is absent"))
        }
        DocumentIdentity::ContextDraft { phase, digest } => {
            let drafts = crate::import::drafts(root)
                .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?;
            let drafts = drafts.lock()
                .map_err(|_| refusal("identity", "document-unavailable", "drafts unavailable"))?;
            drafts.contexts.get(&(phase.get(), digest.clone())).map(|draft| draft.document.clone())
                .ok_or_else(|| refusal("identity", "document-not-found", "held context draft is absent"))
        }
        DocumentIdentity::PhaseContext { phase } => {
            let data = snapshot(root)?;
            let context = cadence::context::persistence::saved(&data, phase.get())
                .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?
                .ok_or_else(|| refusal("identity", "document-not-found", "native context identity is absent"))?;
            let bytes = cadence::context::render::document(&context);
            Ok(Resolved {
                identity: identity.clone(),
                classification: "native-context",
                revision: cadence::store::model::digest(bytes.as_bytes()),
                parts: cadence::context::render::parts(&context)
                    .into_iter()
                    .map(|part| Part {
                        selector: part.selector,
                        title: part.title,
                        body: part.body,
                    })
                    .collect(),
            })
        }
        DocumentIdentity::PhasePlan { phase, plan } => {
            use cadence::execution::history;
            let data = snapshot(root)?;
            let occurrence = cadence::plan::persistence::saved(&data, phase.get())
                .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?
                .ok_or_else(|| refusal("identity", "document-not-found", "native plan occurrence is absent"))?;
            let publication = occurrence
                .publications
                .get(&plan.get())
                .ok_or_else(|| refusal("identity", "document-not-found", "native plan identity is absent"))?;
            let mut parts = cadence::plan::render::task_parts(&publication.content)
                .map_err(|error| refusal("part", "document-ambiguous", error.to_string()))?;
            for (selector, body) in [("goal", &publication.content.goal),
                ("context", &publication.content.context), ("notes", &publication.content.notes)] {
                if !body.is_empty() {
                    parts.push(cadence::plan::render::Part { selector: selector.into(), title: selector.into(), body: body.clone() });
                }
            }
            if let Some(cadence::plan::evidence::Map::Attached { items }) = &publication.content.evidence_map {
                for item in items {
                    let value = serde_json::to_value(item).map_err(|error| refusal("part", "document-invalid", error.to_string()))?;
                    let selector = format!("evidence:{}", value["id"].as_str().unwrap_or_default());
                    parts.push(cadence::plan::render::Part { title: selector.clone(), selector, body: value.to_string() });
                }
            }
            let unavailable = |error: cadence::store::Error| refusal("identity", "document-unavailable", error.to_string());
            if let Some((identity, _)) = history::admitted_plans(&data, phase.get()).map_err(unavailable)?
                .into_iter().find(|(identity, _)| identity.plan == plan.get()) {
                let plan_records = history::selected_plan_records(&data, phase.get(), Some(plan.get())).map_err(unavailable)?;
                let task_records = history::selected_records(&data, phase.get(), Some(plan.get()), None).map_err(unavailable)?;
                if plan_records.iter().any(|record| record.request.plan == identity)
                    || task_records.iter().any(|record| {
                        let task = &record.request.task;
                        task.plan == identity.plan && task.occurrence == identity.occurrence
                            && task.admission_digest == identity.admission_digest
                    }) {
                    let body = serde_json::to_string(&history::plan_project(&plan_records, &identity))
                        .map_err(|error| refusal("part", "document-invalid", error.to_string()))?;
                    parts.push(cadence::plan::render::Part { selector: "execution".into(), title: "execution".into(), body });
                }
            }
            Ok(Resolved {
                identity: identity.clone(),
                classification: "native-publication",
                revision: publication.revision.clone(),
                parts: bounded_parts(parts
                    .into_iter()
                    .map(|part| Part {
                        selector: part.selector,
                        title: part.title,
                        body: part.body,
                    })
                    .collect()),
            })
        }
        DocumentIdentity::TaskRecord { slug } => {
            if slug.trim().is_empty() {
                return Err(refusal("identity", "document-identity", "task record identity must name a slug"));
            }
            let data = snapshot(root)?;
            let record = cadence::task::model::store_namespace(&data)
                .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?
                .records.get(slug).cloned()
                .ok_or_else(|| refusal("identity", "document-not-found", "rooted task record is absent"))?;
            let body = serde_json::to_string(&record)
                .map_err(|error| refusal("part", "document-invalid", error.to_string()))?;
            Ok(Resolved {
                identity: identity.clone(),
                classification: "native-task-record",
                revision: cadence::store::model::digest(body.as_bytes()),
                parts: bounded_parts(vec![Part { selector: "record".into(), title: slug.clone(), body }]),
            })
        }
        DocumentIdentity::PhaseRoadmapRow { phase } => roadmap(root, phase.get()),
        DocumentIdentity::TaskSummary {
            phase,
            occurrence,
            plan,
            task,
        } => {
            if occurrence.trim().is_empty() || task.trim().is_empty() {
                return Err(refusal("identity", "document-identity", "task summary identity must be complete"));
            }
            let data = snapshot(root)?;
            let records = cadence::execution::history::selected_records(&data, phase.get(), Some(plan.get()), Some(task))
                .map_err(|error| refusal("identity", "document-unavailable", error.to_string()))?;
            let body = cadence::execution::render::render_native_task_row(
                &records,
                phase.get(),
                occurrence,
                plan.get(),
                task,
            )
            .map_err(|error| refusal("identity", "document-ambiguous", error.to_string()))?
            .ok_or_else(|| refusal("identity", "document-not-found", "completed task summary identity is absent"))?;
            Ok(Resolved {
                identity: identity.clone(),
                classification: "native-task-summary",
                revision: cadence::store::model::digest(body.as_bytes()),
                parts: vec![Part {
                    selector: "row".into(),
                    title: task.clone(),
                    body,
                }],
            })
        }
        DocumentIdentity::PlannerRound { .. } => {
            let report = super::measurement::resolve(root, identity)?;
            Ok(Resolved {
                identity: identity.clone(),
                classification: "claude-planner-round",
                revision: report.revision,
                parts: vec![Part {
                    selector: "report".into(),
                    title: "Claude planner round measurement".into(),
                    body: report.body,
                }],
            })
        }
        DocumentIdentity::CodexRollout { session_id } => {
            let report = super::measurement::resolve_rollout(session_id)?;
            Ok(Resolved {
                identity: identity.clone(),
                classification: "codex-rollout",
                revision: report.revision,
                parts: vec![Part {
                    selector: "report".into(),
                    title: "Codex rollout measurement".into(),
                    body: report.body,
                }],
            })
        }
    }
}

impl Resolved {
    pub fn bytes(&self) -> Vec<u8> {
        self.parts.iter().flat_map(|part| part.body.bytes()).collect()
    }

    /// Compare in the newest document's order, then report a removed part.
    pub fn first_difference(&self, previous: &Self) -> Option<String> {
        self.parts.iter().find(|part| {
            previous.parts.iter().find(|old| old.selector == part.selector)
                .is_none_or(|old| old.body != part.body)
        }).or_else(|| previous.parts.iter().find(|old| {
            !self.parts.iter().any(|part| part.selector == old.selector)
        })).map(|part| part.selector.clone())
    }
}

/// Partition by the typed slots' lengths, never by headings in authored prose.
pub fn plan_draft(
    data: &Value, content: &cadence::plan::model::Content, digest: &str,
) -> cadence::store::Result<Resolved> {
    use cadence::plan::{persistence, render};
    let retained = persistence::rendered_content(data, content)?;
    let bytes = render::document(&retained)?;
    let text = String::from_utf8(bytes.clone())
        .map_err(|error| cadence::store::Error::Invalid(error.to_string()))?;
    let mut spans = vec![("frontmatter".to_owned(), text.len() - retained.body.len())];
    let slot_len = |value: &str| value.len() + usize::from(!value.ends_with('\n')) + 1;
    spans.push(("goal".into(), "## Goal\n\n".len() + slot_len(&content.goal)));
    let truths = persistence::required_truths(data, content)?;
    spans.push(("truths".into(), "## Must be true when done\n\n".len()
        + truths.iter().map(|(id, sentence)| format!("- {id}. {sentence}\n").len()).sum::<usize>() + 1));
    spans.push(("context".into(), "## Context\n\n".len() + slot_len(&content.context)));
    spans.push(("evidence-map".into(), content.evidence_map.as_ref()
        .map(render::section).transpose()?.map_or(0, |text| text.len())));
    spans.push(("tasks-heading".into(), "## Tasks\n\n".len()));
    spans.extend(render::task_parts(&retained)?.into_iter().map(|part| (part.selector, part.body.len())));
    let used = spans.iter().map(|(_, size)| size).sum::<usize>();
    spans.push(("notes".into(), text.len().checked_sub(used)
        .ok_or_else(|| cadence::store::Error::Invalid("draft partition exceeds document".into()))?));
    let mut offset = 0;
    let mut parts = Vec::new();
    for (selector, size) in spans {
        let body = text.get(offset..offset + size)
            .ok_or_else(|| cadence::store::Error::Invalid("draft partition is invalid".into()))?.to_owned();
        offset += size;
        parts.push(Part { title: selector.clone(), selector, body });
    }
    Ok(Resolved {
        identity: DocumentIdentity::PlanDraft { phase: content.phase, plan: content.plan, digest: digest.into() },
        classification: "held-draft", revision: cadence::store::model::digest(&bytes), parts,
    })
}

pub fn context_draft(
    submission: &cadence::context::model::Submission, digest: &str,
) -> cadence::store::Result<Resolved> {
    use cadence::context::{persistence, render};
    let text = persistence::rendered(submission)?;
    let mut parts = vec![
        Part { selector: "title".into(), title: "Title".into(),
            body: format!("# Phase {}: {}\n\n", submission.phase, submission.title) },
        Part { selector: "scope".into(), title: "Scope boundary".into(),
            body: format!("## Scope boundary\n\n{}\n\n", submission.scope) },
    ];
    // Section headings belong to their first entry. Empty sections remain
    // with the preceding part so every byte has exactly one owner.
    for (heading, entries) in [
        ("Durable decisions", submission.durable_decisions.iter()
            .map(|value| (format!("durable-decision:{}", value.id), format!("- {}. {}\n", value.id, value.text))).collect::<Vec<_>>()),
        ("Decisions", submission.decisions.iter()
            .map(|value| (format!("decision:{}", value.id), format!("- {}. {}\n", value.id, value.text))).collect()),
        ("Truths", submission.truths.iter().map(|value| Ok((
            format!("truth:{}", value.id), format!("- {}. {}\n", value.id, render::sentence(value)?)
        ))).collect::<cadence::store::Result<Vec<_>>>()?),
        ("Flagged assumptions", submission.assumptions.iter().enumerate()
            .map(|(index, value)| (format!("assumption:{}", index + 1), format!("- {value}\n"))).collect()),
    ] {
        let mut prefix = format!("## {heading}\n\n");
        if entries.is_empty() {
            parts.last_mut().unwrap().body.push_str(&prefix);
        } else {
            for (selector, body) in entries {
                parts.push(Part { title: selector.clone(), selector, body: format!("{prefix}{body}") });
                prefix.clear();
            }
        }
        if heading != "Flagged assumptions" { parts.last_mut().unwrap().body.push('\n'); }
    }
    let resolved = Resolved {
        identity: DocumentIdentity::ContextDraft { phase: submission.phase, digest: digest.into() },
        classification: "held-draft", revision: cadence::store::model::digest(text.as_bytes()), parts,
    };
    if resolved.bytes() != text.as_bytes() {
        return Err(cadence::store::Error::Invalid("context draft partition differs from document".into()));
    }
    Ok(resolved)
}

pub fn catalog(root: &Path, phase: u32, process: &mut dyn Process) -> Result<Vec<Resolved>, Value> {
    let phase = std::num::NonZeroU32::new(phase)
        .ok_or_else(|| refusal("scope", "document-identity", "phase must be positive"))?;
    let mut identities = vec![
        DocumentIdentity::PhaseContext { phase },
        DocumentIdentity::PhaseRoadmapRow { phase },
    ];
    if let Ok(data) = snapshot(root) {
        if let Ok(Some(plans)) = cadence::plan::persistence::saved(&data, phase.get()) {
            identities.extend(
                plans
                    .publications
                    .keys()
                    .filter_map(|plan| std::num::NonZeroU32::new(*plan))
                    .map(|plan| DocumentIdentity::PhasePlan { phase, plan }),
            );
        }
        if let Ok(records) = cadence::execution::history::records(&data, phase.get()) {
            for record in records {
                if matches!(record.request.event, cadence::execution::history::Event::Close(_)) {
                    let task = record.request.task;
                    if let Some(plan) = std::num::NonZeroU32::new(task.plan) {
                        identities.push(DocumentIdentity::TaskSummary {
                            phase,
                            occurrence: task.occurrence,
                            plan,
                            task: task.task,
                        });
                    }
                }
            }
        }
    }
    let mut found = Vec::new();
    for identity in identities {
        if let Ok(resolved) = resolve(root, &identity, process) {
            found.push(resolved);
        }
    }
    Ok(found)
}

impl ReadDomain {
    pub(super) fn document(&self, request: DocumentRequest, process: &mut dyn Process) -> Value {
        let resolved = match resolve(&self.planning_root, &request.identity, process) {
            Ok(value) => value,
            Err(answer) => return answer,
        };
        let part = match request.part.as_deref() {
            None => {
                return json!({"status":"ok","kind":"document-index","bound":PART_BOUND,
                    "identity":resolved.identity,"classification":resolved.classification,"revision":resolved.revision,
                    "parts":resolved.parts.iter().map(|part| json!({"part":part.selector,"title":part.title,
                        "bytes":part.body.len()})).collect::<Vec<_>>()});
            }
            Some(part) => part,
        };
        let Some(selected) = resolved.parts.iter().find(|candidate| candidate.selector == part) else {
            return refusal("part", "document-part-not-found", "the requested part is absent from this identity");
        };
        if selected.body.len() > PART_BOUND {
            return refusal(
                "part",
                "document-part-too-large",
                format!(
                    "document part `{}` is {} bytes, exceeding the bound of {} bytes",
                    selected.selector,
                    selected.body.len(),
                    PART_BOUND
                ),
            );
        }
        let next = resolved.parts.iter().position(|candidate| candidate.selector == part)
            .and_then(|index| resolved.parts.get(index + 1))
            .filter(|following| {
                let (base, number) = selected.selector.rsplit_once(':')
                    .and_then(|(base, n)| n.parse::<usize>().ok().map(|n| (base, n)))
                    .unwrap_or((&selected.selector, 1));
                matches!(resolved.identity, DocumentIdentity::RunOutput { .. } | DocumentIdentity::ReviewEntry { .. })
                    || (following.title == selected.title && (following.selector == format!("{}:2", selected.selector)
                        || following.selector == format!("{base}:{}", number + 1)))
            })
            .map(|following| &following.selector);
        json!({"status":"ok","kind":"document-slice","bound":PART_BOUND,
            "identity":resolved.identity,"classification":resolved.classification,"revision":resolved.revision,
            "part":selected.selector,"body":&selected.body,"next":next})
    }
}

/// Ceiling on a document-search answer. Hits carry no bodies, so an answer
/// holds a few hundred of them and an ordinary phase never reaches it.
const SEARCH_BOUND: usize = 65_536;

fn matcher(pattern: &str, case_insensitive: bool) -> Result<RegexMatcher, Value> {
    RegexMatcherBuilder::new().case_insensitive(case_insensitive).build(pattern)
        .map_err(|error| refusal("pattern", "invalid-pattern", error.to_string()))
}

/// The 1-based line numbers of `content` that match, ascending, each once.
/// Without line numbers the sink reports none, and a hit with no line number
/// is a hit nothing can be resolved from.
fn matching_lines(searcher: &mut Searcher, matcher: &RegexMatcher, content: &str) -> Vec<usize> {
    let mut lines = Vec::new();
    let outcome = searcher.search_slice(matcher, content.as_bytes(), UTF8(|number, _| { lines.push(number as usize); Ok(true) }));
    // Searching a slice already in memory has no I/O to fail at, but the
    // sink's signature admits an error; one part's failure is that part's.
    if outcome.is_err() { lines.clear(); }
    lines
}

impl ReadDomain {
    /// Which parts of one phase's process records mention `pattern`: each
    /// hit is an identity and a part for `document`, with the matching line
    /// numbers, and never a body. Hits are in identity-then-part order.
    pub(super) fn document_search(&self, request: DocumentSearchRequest, process: &mut dyn Process) -> Value {
        let matcher = match matcher(&request.pattern, request.case_insensitive.unwrap_or(false)) {
            Ok(matcher) => matcher,
            Err(answer) => return answer,
        };
        let mut searcher = SearcherBuilder::new().line_number(true).build();
        let records = match catalog(&self.planning_root, request.phase.get(), process) {
            Ok(records) => records,
            Err(answer) => return answer,
        };
        let mut hits = Vec::new();
        for record in records {
            for part in record.parts {
                let match_lines = matching_lines(&mut searcher, &matcher, &part.body);
                if match_lines.is_empty() { continue; }
                hits.push(json!({"identity":record.identity,"part":part.selector,"title":part.title,
                    "classification":record.classification,"revision":record.revision,"match_lines":match_lines}));
            }
        }
        hits.sort_by(|left, right| left["identity"].to_string().cmp(&right["identity"].to_string())
            .then(left["part"].as_str().cmp(&right["part"].as_str())));
        let total = hits.len();
        let mut answer = json!({"status":"ok","kind":"document-search","bound":SEARCH_BOUND,"phase":request.phase,
            "hits":hits,"total":total,"incomplete":false,"notes":[]});
        while serde_json::to_vec(&answer).is_ok_and(|bytes| bytes.len() > SEARCH_BOUND) {
            answer["hits"].as_array_mut().unwrap().pop();
            answer["incomplete"] = json!(true);
            answer["notes"] = json!(["document-search answer was bounded; tighten the pattern"]);
        }
        answer
    }
}
