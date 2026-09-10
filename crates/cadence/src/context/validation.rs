//! Mechanical syntax only. Semantic ownership belongs to the two attestations.
use super::model::{Answer, refused};
use serde_json::Value;

pub fn validate(raw: &Value) -> Option<Answer> {
    let submission = &raw["submission"];
    let phase = submission["phase"]
        .as_u64()
        .and_then(|n| u32::try_from(n).ok());
    let Some(truths) = submission["truths"]
        .as_array()
        .filter(|truths| !truths.is_empty())
    else {
        return Some(refused(
            "required-slot",
            "truths",
            "a context needs a nonempty truth set",
            phase,
            None,
            None,
        ));
    };
    if truths.len() > 7 {
        return Some(refused(
            "seven-truths",
            "truths",
            "at most seven truths: split the phase",
            phase,
            None,
            None,
        ));
    }
    for (entry, truth) in truths.iter().enumerate() {
        let failure = |rule, slot, reason| {
            Some(refused(
                rule,
                slot,
                reason,
                phase,
                Some(entry),
                truth["id"].as_str().map(str::to_owned),
            ))
        };
        for slot in ["trigger", "observer", "verb", "outcome", "kind"] {
            if truth[slot]
                .as_str()
                .is_none_or(|value| value.trim().is_empty())
            {
                return failure(
                    "required-slot",
                    slot,
                    "required sentence slot must be a nonblank string",
                );
            }
        }
        if truth["trigger"].as_str().unwrap().contains(" or ") {
            return failure(
                "one-trigger",
                "trigger",
                "one trigger: literal alternative delimiter ' or ' is forbidden",
            );
        }
        if [" and ", " & ", ",", ";"]
            .iter()
            .any(|separator| truth["observer"].as_str().unwrap().contains(separator))
        {
            return failure(
                "one-observer",
                "observer",
                "one observer: conjunction and list separators are forbidden",
            );
        }
        if !matches!(truth["verb"].as_str(), Some("sees" | "gets" | "is refused")) {
            return failure(
                "allowed-verb",
                "verb",
                "verb must be sees, gets or is refused",
            );
        }
        if !matches!(truth["kind"].as_str(), Some("literal" | "property")) {
            return failure("allowed-kind", "kind", "kind must be literal or property");
        }
        if truth["observable"] != true {
            return failure(
                "unobservable",
                "observable",
                "the owner must attest that the outcome is observable from outside",
            );
        }
        if truth["fixed_oracle"] != true {
            return failure(
                "prose-oracle",
                "fixed_oracle",
                "the owner must attest that the expected answer is fixed and does not come from model prose",
            );
        }
    }
    None
}

pub fn identities(
    submission: &super::model::Submission,
    existing: Option<&super::model::ApprovedContext>,
) -> Option<Answer> {
    use std::collections::BTreeSet;
    let mut occupied = BTreeSet::new();
    if let Some(existing) = existing {
        occupied.extend(
            existing
                .submission
                .truths
                .iter()
                .map(|truth| truth.id.as_str()),
        );
        occupied.extend(
            existing
                .submission
                .durable_decisions
                .iter()
                .chain(&existing.submission.decisions)
                .map(|decision| decision.id.as_str()),
        );
    }
    let entries = submission
        .truths
        .iter()
        .enumerate()
        .map(|(index, truth)| ("truths.id", index, truth.id.as_str()))
        .chain(
            submission
                .durable_decisions
                .iter()
                .enumerate()
                .map(|(index, decision)| ("durable_decisions.id", index, decision.id.as_str())),
        )
        .chain(
            submission
                .decisions
                .iter()
                .enumerate()
                .map(|(index, decision)| ("decisions.id", index, decision.id.as_str())),
        );
    for (slot, entry, id) in entries {
        if id.trim().is_empty() {
            return Some(refused(
                "required-slot",
                slot,
                "identity must be nonblank",
                Some(submission.phase.get()),
                Some(entry),
                Some(id.into()),
            ));
        }
        if !occupied.insert(id) {
            return Some(refused(
                "identity-collision",
                slot,
                format!(
                    "identity {id} is already used in phase {}",
                    submission.phase
                ),
                Some(submission.phase.get()),
                Some(entry),
                Some(id.into()),
            ));
        }
    }
    None
}
