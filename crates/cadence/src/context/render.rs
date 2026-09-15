use super::model::{ApprovedContext, TruthSlots};
use cadence::store::{Error, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Part {
    pub selector: String,
    pub title: String,
    pub body: String,
}

pub fn sentence(slots: &TruthSlots) -> Result<String> {
    let required = |value: &Option<String>| {
        value
            .clone()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| Error::Invalid("truth sentence needs every slot".into()))
    };
    Ok(format!(
        "When {}, {} {} {}.",
        required(&slots.trigger)?,
        required(&slots.observer)?,
        required(&slots.verb)?,
        required(&slots.outcome)?
    ))
}

pub fn document(context: &ApprovedContext) -> String {
    let input = &context.submission;
    let mut text = format!(
        "# Phase {}: {}\n\n## Scope boundary\n\n{}\n\n## Durable decisions\n\n",
        input.phase, input.title, input.scope
    );
    for decision in &input.durable_decisions {
        text.push_str(&format!("- {}. {}\n", decision.id, decision.text));
    }
    text.push_str("\n## Decisions\n\n");
    for decision in &input.decisions {
        text.push_str(&format!("- {}. {}\n", decision.id, decision.text));
    }
    text.push_str("\n## Truths\n\n");
    for truth in &context.truths {
        text.push_str(&format!("- {}. {}\n", truth.id, truth.text));
    }
    text.push_str("\n## Flagged assumptions\n\n");
    for assumption in &input.assumptions {
        text.push_str(&format!("- {assumption}\n"));
    }
    text
}

/// Identity-addressed fragments rendered from the approved native record.
pub fn parts(context: &ApprovedContext) -> Vec<Part> {
    let input = &context.submission;
    let mut parts = vec![Part {
        selector: "scope".into(),
        title: "Scope boundary".into(),
        body: format!("{}\n", input.scope),
    }];
    parts.extend(input.durable_decisions.iter().map(|decision| Part {
        selector: format!("durable-decision:{}", decision.id),
        title: decision.id.clone(),
        body: format!("{}\n", decision.text),
    }));
    parts.extend(input.decisions.iter().map(|decision| Part {
        selector: format!("decision:{}", decision.id),
        title: decision.id.clone(),
        body: format!("{}\n", decision.text),
    }));
    parts.extend(context.truths.iter().map(|truth| Part {
        selector: format!("truth:{}", truth.id),
        title: truth.id.clone(),
        body: format!("{}\n", truth.text),
    }));
    parts.extend(input.assumptions.iter().enumerate().map(|(index, assumption)| Part {
        selector: format!("assumption:{}", index + 1),
        title: format!("Assumption {}", index + 1),
        body: format!("{assumption}\n"),
    }));
    parts
}
