use super::{derivation_service::{self, Driver, store_error}, next_action_service};
use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::envelope::Refusal;
use cadence::{derivation::{self, DerivationError}, store::{Error, model::{Decision, Evidence}, writer::View}};
use serde_json::{Value, json};
use std::path::Path;

fn evidence(value: &Evidence) -> Value {
    match value {
        Evidence::Text(text) => serde_json::from_str(text).unwrap_or(Value::Null),
        _ => Value::Null,
    }
}

fn in_phase(value: &Value, phase: &str) -> bool {
    let value = value.get("phase").or_else(|| value.get("scope").and_then(|scope| scope.get("phase")));
    value.is_some_and(|value| value.as_str() == Some(phase)
        || value.as_u64().is_some_and(|value| phase.parse::<u64>() == Ok(value)))
}

/// One refusal line's material: its code, its located summary and the second
/// it was written, which a record from before D-143 does not have.
fn detail(record: &cadence::store::model::DecisionRecord, code: &str, located: String) -> Value {
    let mut detail = json!({"code":code,"located":located});
    if let Some(at) = record.at {
        detail["at"] = json!(at);
    }
    detail
}

fn records(view: &View, phase: &str) -> Value {
    let mut routing = 0;
    let mut gates = 0;
    let mut refusals = Vec::new();
    let dispatches: std::collections::BTreeSet<_> = view.decisions.iter().filter_map(|record| {
        let Decision::BoundaryV1(value) = &record.decision else { return None };
        let boundary = serde_json::to_value(&value.boundary).expect("boundary record");
        (in_phase(&boundary, phase) && value.boundary.outcome == "dispatch")
            .then_some(value.boundary.subject_id.as_deref()).flatten()
    }).collect();
    let latest: std::collections::BTreeMap<_, _> = view.decisions.iter().map(|r| (&r.id, r)).collect();
    for record in &view.decisions {
        if latest[&record.id].revision != record.revision { continue; }
        match &record.decision {
            Decision::Routing { choice, config_provenance, .. } => {
                let choice = serde_json::from_str(choice).unwrap_or(Value::Null);
                let dispatch = config_provenance.get("dispatch_id").and_then(|value| match value {
                    Evidence::Text(id) => Some(id.as_str()), _ => None,
                });
                if in_phase(&choice, phase) || dispatch.is_some_and(|id| dispatches.contains(id)) { routing += 1; }
            }
            Decision::Gate { outcome, evidence: value } => {
                let value = evidence(value);
                if (outcome == "risk-fired" && in_phase(&value["fact"]["fire"]["binding"]["boundary"], phase))
                    || (outcome == "gate_fire" && in_phase(&value, phase)) { gates += 1; }
            }
            Decision::Refusal { reason, evidence: value } if in_phase(&evidence(value), phase) => {
                refusals.push(detail(record, reason, evidence(value).to_string()));
            }
            Decision::BoundaryV1(value) => {
                let boundary = serde_json::to_value(&value.boundary).expect("boundary record");
                if in_phase(&boundary, phase) && boundary["receipt"]["envelope"]["status"] == "refused" {
                    let envelope = &boundary["receipt"]["envelope"];
                    // The typed located object when the record carries one; a
                    // record written before D-140 has only its bounded reason.
                    let located = value.boundary.located.as_deref().map_or_else(
                        || envelope["reason"].as_str().unwrap_or_default().to_owned(),
                        cadence::execution::boundary::Located::summary);
                    refusals.push(detail(record, envelope["code"].as_str().unwrap_or("unknown"), located));
                }
            }
            _ => {}
        }
    }
    json!({"phase":phase,"routing_decisions":routing,"refusals":refusals.len(),"gate_fires":gates,"details":refusals})
}

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, root: &Path, driver: &Driver,
) -> Result<Value, DerivationError> {
    // Age the work at query entry. A cursor/memo repair performed by this
    // progress read is not another generation of elapsed worker activity.
    let observed_generation = factory.first_touch(root).await.map_err(store_error)?
        .derivation_view().await.map_err(store_error)?.snapshot.generation;
    let (checked, view) = derivation_service::checked_progress(factory, root, driver).await?;
    let mut lifecycle = checked.answer().clone();
    let overlay = checked.overlay().clone();
    for phase in &mut lifecycle.phases {
        if overlay.phases.get(&phase.id.address()).and_then(|p| p.label.as_deref())
            .is_some_and(|label| label.starts_with("declared-at-")) {
            let path = Path::new("phases").join(phase.id.address());
            phase.uat = checked.capture().phases.iter().find(|p| p.relative_path == path)
                .and_then(|p| match &p.uat {
                    derivation::Observation::Present(bytes) if !bytes.is_empty() =>
                        Some(derivation::parse_uat(&String::from_utf8_lossy(bytes)).counts),
                    _ => None,
                });
        }
    }
    let declarations = checked.capture().declarations.as_ref()
        .ok_or(DerivationError::InputsChanged)?.as_ref().map_err(Clone::clone)?;
    let issues = derivation::roadmap_conflicts(declarations, &lifecycle);
    let root = checked.capture().root.clone();
    let session = factory.first_touch(&root).await.map_err(store_error)?;
    let config = session.config().map_err(store_error)?;
    let captures = session.capture_report().await.map_err(store_error)?;
    let record = records(&view, &lifecycle.current.map_or(String::new(), |p| p.address()));
    let next = next_action_service::query_checked(factory, checked, view.clone(), driver, &issues).await?
        .ok_or_else(|| store_error(Error::Invalid("progress has no next action".into())))?;
    if session.derivation_view().await.map_err(store_error)?.snapshot != view.snapshot
        || session.config().map_err(store_error)? != config {
        return Err(DerivationError::InputsChanged);
    }
    let answer = cadence::progress::render::answer(
        &root.parent().and_then(Path::file_name).unwrap_or_default().to_string_lossy(),
        &lifecycle, &overlay, &issues, record,
        json!({"active":captures.active,"bound":captures.bound,"exceeded":captures.exceeded}), &next.instruction());
    let interruption = match lifecycle.current.and_then(|p| p.address().parse::<u32>().ok()) {
        Some(phase) => cadence::execution::history::interrupted_dispatch(&view.snapshot.data, phase, observed_generation).map_err(store_error)?,
        None => None,
    };
    let answer = cadence::progress::render::with_dispatch(answer, interruption);
    if serde_json::to_vec(&answer).expect("progress answer").len() > 24_576 {
        return Ok(Refusal::new("progress-bound", "progress exceeds the 24576-byte answer bound")
            .slot("progress").value());
    }
    Ok(answer)
}
