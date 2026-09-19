use crate::{config::{Layer, merge, reload::ConfigIo, roles}, import::SessionFactory};
use super::config_service::{RouteRequest, resolve_role};
use cadence::{
    envelope::Refusal,
    execution::{boundary::BoundaryScope, model::DispatchRoute},
    rail::receipts,
    review::{model::{Admission, HomeKind}, persistence},
    store::{Error, Result, model::{Decision, DecisionRecord, Evidence}, writer::View},
    suggest::rules::{self, GateFire, RoutingDecision},
};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

fn text(value: &Evidence) -> Option<&str> {
    match value { Evidence::Text(text) => Some(text), _ => None }
}

fn phase(value: &Value) -> Option<u32> {
    value.as_u64().and_then(|n| u32::try_from(n).ok())
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
        .filter(|n| *n > 0)
}

fn latest(view: &View) -> Vec<&DecisionRecord> {
    let mut records = BTreeMap::new();
    for (index, record) in view.decisions.iter().enumerate() {
        records.insert(&record.id, (index, record));
    }
    let mut records = records.into_values().collect::<Vec<_>>();
    records.sort_by_key(|(index, _)| *index);
    records.into_iter().map(|(_, record)| record).collect()
}

fn routes(view: &View, selected: Option<u32>) -> Result<BTreeMap<String, Vec<RoutingDecision>>> {
    let records = latest(view);
    let dispatches: BTreeMap<_, _> = records.iter().filter_map(|record| {
        let Decision::BoundaryV1(record) = &record.decision else { return None };
        let BoundaryScope::Execution { phase } = record.boundary.scope else { return None };
        (record.boundary.outcome == "dispatch").then_some(())?;
        Some((record.boundary.subject_id.as_deref()?, phase))
    }).collect();
    let mut roles = BTreeMap::<String, Vec<RoutingDecision>>::new();
    for record in records {
        let Decision::Routing { choice, config_provenance, requested_effort, .. } = &record.decision else { continue };
        let (role, row_phase, escalated, rung) = if let Some(route) = config_provenance.get("route").and_then(text) {
            let route: DispatchRoute = serde_json::from_str(route)?;
            let id = config_provenance.get("dispatch_id").and_then(text);
            (route.choice.role, id.and_then(|id| dispatches.get(id).copied()),
                route.choice.escalated || route.choice.attempt > 1, Some(route.choice.rung))
        } else {
            let choice: Value = serde_json::from_str(choice)?;
            let Some(role) = choice["role"].as_str().filter(|role| roles::ROLES.contains(role)) else { continue };
            (role.to_owned(), phase(&choice["phase"]),
                choice["escalated"] == true || choice["attempt"].as_u64().is_some_and(|n| n > 1),
                text(requested_effort).map(str::to_owned))
        };
        if selected.is_some() && selected != row_phase { continue; }
        roles.entry(role).or_default().push(RoutingDecision { id: record.id.clone(), escalated, rung });
    }
    Ok(roles)
}

fn fires(view: &View, selected: Option<u32>) -> Result<BTreeMap<String, Vec<GateFire>>> {
    let records = persistence::records(&view.snapshot.data)?;
    let mut groups = BTreeMap::<String, Vec<GateFire>>::new();
    if let Some(admissions) = records.get("admissions").and_then(Value::as_object) {
        for value in admissions.values() {
            let admission: Admission = serde_json::from_value(value.clone())?;
            let row_phase = (admission.home.kind == HomeKind::Phase)
                .then(|| admission.home.id.parse::<u32>().ok()).flatten();
            if selected.is_some() && selected != row_phase { continue; }
            if let Some(trigger) = admission.trigger {
                // Admission and delivery failure are not a failed gate outcome.
                groups.entry(trigger).or_default().push(GateFire { id: admission.fire, failed: false });
            }
        }
    }
    // The rail retains explicit adjudication outcomes independently of review
    // delivery. Pending, interrupted and overridden fires never imply failure.
    receipts::confirmed_history(view)?;
    let (_, fires, outcomes) = receipts::history(&view.snapshot.data)?;
    for fire in fires {
        if selected.is_some_and(|phase| phase != fire.binding.boundary.scope.phase.get()) { continue; }
        let failed = outcomes.iter().any(|outcome| outcome.fire == fire
            && matches!(outcome.consequence, receipts::Consequence::Adjudication { passed: false, .. }));
        groups.entry("risk_surface".into()).or_default().push(GateFire { id: fire.id, failed });
    }
    Ok(groups)
}

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>, root: &Path, phase: Option<u32>,
) -> Result<Value> {
    let session = factory.first_touch(root).await?;
    let view = session.derivation_view().await?;
    let config = session.config()?;
    let mut suggestions = Vec::new();
    for (role, decisions) in routes(&view, phase)? {
        let resolved = resolve_role(&config, &RouteRequest { role: role.clone(), phase: None, plan: None, attempt: None })?;
        let layer = match resolved.effort_source.layer.as_str() { "global" => "global", _ => "repo" };
        suggestions.push(rules::role(&format!("roles.{role}.effort"), layer, &resolved.rung, &decisions));
    }
    for (trigger, fires) in fires(&view, phase)? {
        let key = format!("review.triggers.{trigger}.gate");
        let Some(current) = merge::get(&config.effective.values, &key).and_then(Value::as_str) else { continue };
        let layer = match config.effective.sources.get(&key) { Some(Layer::Global) => "global", _ => "repo" };
        suggestions.push(rules::gate(&key, layer, current, &fires));
    }
    if session.derivation_view().await?.snapshot != view.snapshot || session.config()? != config {
        return Err(Error::Conflict("suggest inputs changed during the read".into()));
    }
    let answer = json!({"status":"ok","suggestions":suggestions});
    if serde_json::to_vec(&answer)?.len() > 24_576 {
        return Ok(Refusal::new("suggest-bound", "suggest exceeds the 24576-byte answer bound").slot("suggest").value());
    }
    Ok(answer)
}
