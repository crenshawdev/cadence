use cadence::process::Process;
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{envelope::Refusal, rail::{branch, commit, git}, undo::{manifest, model::{self, Apply, Completed, Conflict, Mode, Pending, Record}, revert},
    store::{Error, Result, writer::{Operation, Store, View}}};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

pub enum Command { Read { phase: u32 }, Apply(Apply) }

pub async fn execute<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    let phase = match &command { Command::Read { phase } => *phase, Command::Apply(Apply::Phase { request }) => request.phase.get() };
    let request = match &command { Command::Apply(Apply::Phase { request }) => Some(request.clone()), _ => None };
    let answer = match execute_inner(factory, root, command, process).await {
        Ok(answer) => answer,
        Err(error) => Refusal::new("undo-unavailable", error.to_string()).slot("phase")
            .details(json!({"phase":phase})).value(),
    };
    if let Some(request) = request.filter(|r| !r.request_id.trim().is_empty())
        && answer["status"] == "refused" && answer["code"] != "request-reused" {
        use cadence::milestone::model as receipts;
        let session = factory.first_touch(root).await?;
        let store = session.review_store();
        let view = store.request(Operation::ReadVerified).await?;
        let binding = cadence::verification::inputs::root_binding(root)?;
        let raw = serde_json::to_value(&request)?;
        let mut saved = receipts::records::<Value>(&view.snapshot.data, "undo_requests")?;
        if let Some(replayed) = receipts::replay(&saved, &binding, &request.request_id, &raw)? { return Ok(replayed); }
        return receipts::persist(store, &view, "undo_requests", &mut saved, receipts::Receipt {
            root_binding: binding, request_id: request.request_id, request: raw, answer }).await;
    }
    Ok(answer)
}

async fn persist(store: &Store, view: &mut View, write: model::Write) -> Result<()> {
    *view = store.request(Operation::UndoV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(), write: Box::new(write) }).await?;
    Ok(())
}

fn projections(root: &Path, view: &View, phase: u32, config: &Value) -> Result<BTreeMap<String, model::Document>> {
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    let roadmap = revert::read_regular(&root.join("ROADMAP.md"))?.ok_or_else(|| Error::Invalid("ROADMAP.md is absent".into()))?;
    let roadmap = revert::roadmap(&roadmap, phase)?;
    let lifecycle = super::derivation_service::undo_lifecycle(root, &view.snapshot.data, phase, roadmap.clone())?;
    let next = super::next_action_service::undo_next(root, &lifecycle, view, config).map_err(|e| Error::Invalid(e.to_string()))?;
    let current = lifecycle.phases.iter().find(|p| Some(p.id) == lifecycle.current)
        .ok_or_else(|| Error::Invalid("undo did not derive a current phase".into()))?;
    let status = serde_json::to_value(current.status)?.as_str().unwrap_or("planned").to_owned();
    let state = format!("# State\n\nPhase: {} of {} ({})\nStatus: {status}\nNext: {next}\n\nDerived from the retained phase record after undo.\n", current.id.address(), lifecycle.total, current.name);
    let mut out = BTreeMap::from([
        (".planning/ROADMAP.md".into(), revert::document(project, ".planning/ROADMAP.md", roadmap)?),
        (".planning/STATE.md".into(), revert::document(project, ".planning/STATE.md", state.into_bytes())?),
    ]);
    if let Some(bytes) = revert::read_regular(&root.join("REQUIREMENTS.md"))? {
        let text = std::str::from_utf8(&bytes).map_err(|e| Error::Invalid(e.to_string()))?;
        let mut lines: Vec<_> = text.split('\n').map(str::to_owned).collect();
        if let Some(table) = cadence::verification::projections::traceability(text) {
            for row in table.rows.iter().filter(|r| r.phase == format!("Phase {phase}")) {
                let cells: Vec<_> = lines[row.line].split('|').map(str::to_owned).collect();
                if cells.len() < 5 { return Err(Error::Invalid("invalid REQUIREMENTS trace row".into())); }
                let mut cells = cells;
                cells[3] = " Pending ".into();
                lines[row.line] = cells.join("|");
            }
        }
        out.insert(".planning/REQUIREMENTS.md".into(), model::Document { before: Some(bytes), after: lines.join("\n").into_bytes() });
    }
    Ok(out)
}

async fn execute_inner<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command, process: &mut (dyn Process + Send)) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let mut view = store.request(Operation::ReadVerified).await?;
    let binding = cadence::verification::inputs::root_binding(root)?;
    let project = root.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?;
    let phase = match &command { Command::Read { phase } => *phase, Command::Apply(Apply::Phase { request }) => request.phase.get() };
    if let Command::Apply(Apply::Phase { request }) = &command {
        use cadence::milestone::model as receipts;
        let saved = receipts::records::<Value>(&view.snapshot.data, "undo_requests")?;
        if let Some(answer) = receipts::replay(&saved, &binding, &request.request_id, &serde_json::to_value(request)?)? { return Ok(answer); }
        if receipts::reused(&saved, &binding, &request.request_id) {
            return Ok(Refusal::new("request-reused", "undo request identity binds different inputs").slot("request.request_id").value());
        }
    }
    let selected = manifest::read(root, &view.snapshot.data, &binding, phase, process)?;
    let request = match command {
        Command::Read { .. } => return Ok(json!({"status":"ok","manifest":selected,"modes":["committed","no-commit"]})),
        Command::Apply(Apply::Phase { request }) => request,
    };
    cadence::milestone::model::name(&request.request_id)?;
    let records = model::records(&view.snapshot.data)?;
    let id = cadence::milestone::model::identity("undo", &binding, &request.request_id);
    if let Some(prior) = records.get(&id) {
        if prior.request != request { return Ok(Refusal::new("request-reused", "undo request identity binds different inputs").slot("request.request_id").value()); }
        if prior.state != "running" { return Ok(model::answer(prior)); }
    }
    if request.manifest != selected.id {
        return Ok(Refusal::new("undo-manifest", "request must name the exact manifest returned by undo-read").slot("request.manifest")
            .details(json!({"phase":phase,"supplied":request.manifest,"manifest":selected.id})).value());
    }
    if let Some(prior) = records.values().find(|r| r.manifest.phase == phase && r.id != id) {
        return Ok(Refusal::new("undo-exists", "retry the original identified undo request").slot("request.request_id")
            .details(json!({"undo":prior.id,"request":prior.request})).value());
    }
    let config = session.config()?;
    let protected = branch::protected_branches(config.effective.values.pointer("/git/protected_branches"));
    let on_protected = config.effective.values.pointer("/git/on_protected").and_then(Value::as_str).unwrap_or("ask");
    let mut record = if let Some(prior) = records.get(&id) { prior.clone() } else {
        revert::preflight(project, &request.mode, &protected, on_protected, process)?;
        Record { id, request, manifest: selected, completed: vec![], pending: None, conflict: None, state: "running".into() }
    };
    // All projection reads are preflight, before the first revert can change a file.
    let documents = if record.request.mode == Mode::Committed { projections(root, &view, phase, &config.effective.values)? } else { BTreeMap::new() };
    if !records.contains_key(&record.id) { persist(store, &mut view, revert::write(record.clone(), &protected, on_protected)).await?; }
    if let Some(pending) = &record.pending {
        return Ok(Refusal::new("undo-reconciliation-required", "a retained revert invocation has no result; preserve its actual Git state")
            .details(json!({"undo":record.id,"pending":pending,"completed":record.completed})).value());
    }
    while record.completed.len() < record.manifest.hashes.len() {
        let hash = record.manifest.hashes[record.manifest.hashes.len() - 1 - record.completed.len()].clone();
        if record.request.mode == Mode::Committed { revert::policy(project, &protected, on_protected, process)?; }
        record.pending = Some(Pending { hash: hash.clone(), head: git::resolve_commit(project, "HEAD", process)?, index: git::index_id(project, process)? });
        persist(store, &mut view, revert::write(record.clone(), &protected, on_protected)).await?;
        if let Err(error) = revert::perform(project, &hash, process) {
            record.conflict = Some(Conflict { hash, paths: revert::conflicts(project, process)?, reason: error.to_string() });
            record.state = "conflict".into();
            persist(store, &mut view, revert::write(record.clone(), &protected, on_protected)).await?;
            return Ok(model::answer(&record));
        }
        let last = record.completed.len() + 1 == record.manifest.hashes.len();
        let mut write = revert::write(record.clone(), &protected, on_protected);
        if record.request.mode == Mode::Committed {
            if last { write.documents = documents.clone(); }
            let seal = commit::freeze_staged(project, &revert::tracked_changes(&write.documents), &format!("revert({phase}): undo {hash}"), process)?;
            record.completed.push(Completed { hash, commit: Some(seal.commit.id.clone()), index: seal.tree.clone() });
            write.seal = Some(seal);
        } else {
            record.completed.push(Completed { hash, commit: None, index: git::index_id(project, process)? });
        }
        record.pending = None;
        if last { record.state = if record.request.mode == Mode::Committed { "committed" } else { "staged" }.into(); }
        write.record = record.clone();
        persist(store, &mut view, write).await?;
    }
    if record.state == "committed" {
        super::derivation_service::checked_query(factory, root, &super::derivation_service::Driver::default()).await
            .map_err(|e| Error::Invalid(e.to_string()))?;
    }
    Ok(model::answer(&record))
}
