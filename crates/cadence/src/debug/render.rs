use super::model::Record;

/// A readable projection; continuation always reads the typed record.
pub fn render(record: &Record) -> String {
    let mut out = format!("# Debug: {}\n\nSymptom: {}\nStatus: {}\nAttempts: {}\nVersion: {}\n", record.slug,
        record.symptom, serde_json::to_value(&record.status).unwrap().as_str().unwrap(), record.attempt_count, record.version);
    if let Some(recall) = &record.recall {
        out.push_str(&format!("\n## Recall (candidate evidence)\n\nBackend: {}\nTotal: {}\n", recall.backend, recall.total));
        for hit in &recall.results {
            let phase = hit.phase.map(|phase| format!(", phase {phase}")).unwrap_or_default();
            out.push_str(&format!("\nSource: {}{}\n{}\n", hit.source, phase, hit.snippet));
        }
        for incomplete in &recall.incomplete { out.push_str(&format!("\nIncomplete: {incomplete}\n")); }
    }
    out.push_str("\n## Hypotheses\n");
    for h in &record.hypotheses {
        out.push_str(&format!("\n{} [{}]: {}\nRank reason: {}\n", h.id,
            serde_json::to_value(&h.state).unwrap().as_str().unwrap(), h.description, h.rank_reason));
    }
    out.push_str("\n## Observations\n");
    for observation in &record.observations {
        out.push_str(&format!("\nTest: {}\nResult: {}\nRules in: {}\nRules out: {}\n", observation.test,
            observation.result, observation.rules_in.join(", "), observation.rules_out.join(", ")));
    }
    out.push_str("\n## Failed attempts\n");
    for attempt in &record.attempts { out.push_str(&format!("\nAttempt: {}\nResult: {}\n", attempt.description, attempt.result)); }
    if let Some(review) = &record.review {
        out.push_str(&format!("\n## Risk review\n\nScope: root-debug {}\nBase: {}\nIndex: {}\nHead: null\nObservation: {}\nAdmission request: {}\n",
            review.occurrence, review.material.base_id(), review.material.tip_id(), review.observation, review.admission_request_id));
        if let Some(fire) = &review.fire {
            out.push_str(&format!("Fire: {fire}\nHome: reviews/{fire}\nResolve: {}\n",
                if review.settled { "receipt accepted; verify reproduction" } else { "pending review" }));
        }
        for entry in &review.history {
            out.push_str(&format!("\nFire: {}\nScope: {}\n", entry.fire.id, entry.fire.review_scope.join(", ")));
            if let Some(parent) = &entry.fire.rearm_of { out.push_str(&format!("Re-arm of: {parent}\n")); }
            for returned in &entry.returns {
                out.push_str(&format!("Original: {}\nFinding identities: {}\nFindings: {}\n",
                    returned.original, returned.finding_ids.join(", "), returned.findings));
            }
            if let Some(receipt) = &entry.receipt {
                out.push_str(&format!("Receipt: {}\nConsequence: {}\n", receipt.id,
                    serde_json::to_string(&receipt.consequence).unwrap()));
            }
        }
        if !review.pending_fires.is_empty() { out.push_str(&format!("Pending fires: {}\n", review.pending_fires.join(", "))); }
    }
    for consult in &record.consults {
        out.push_str(&format!("\n## Consult {} (investigative suggestions)\n\nEpoch: {}\nProvider: {}/{}\nEffort: {}\nState: {:?}\n",
            consult.id, consult.epoch, consult.provider, consult.model, consult.effort, consult.state));
        if let Some(request) = &consult.request_id { out.push_str(&format!("Request: {request}\n")); }
        if let Some(situation) = &consult.situation { out.push_str(&format!("Situation: {situation}\n")); }
        for angle in &consult.angles {
            out.push_str(&format!("\nHypothesis: {}\nRationale: {}\nHow to check: {}\n", angle.hypothesis, angle.rationale, angle.how_to_check));
        }
        if let Some(failure) = &consult.failure { out.push_str(&format!("Failure: {failure}\n")); }
    }
    if let Some(resolution) = &record.resolution {
        out.push_str(&format!("\n## Resolution\n\n{}\nTest: {}\nResult: {}\n", resolution.description, resolution.reproduction.test, resolution.reproduction.result));
    }
    out
}
