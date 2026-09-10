//! Mechanical syntax only. Semantic ownership belongs to the two attestations.
use super::model::{Answer, refused};
use serde_json::Value;

pub fn validate(raw: &Value) -> Option<Answer> {
    let submission = &raw["submission"];
    let phase = submission["phase"].as_u64().and_then(|n| u32::try_from(n).ok());
    let Some(truths) = submission["truths"].as_array().filter(|truths| !truths.is_empty()) else {
        return Some(refused("required-slot", "truths", "a context needs a nonempty truth set", phase, None, None));
    };
    for (entry, truth) in truths.iter().enumerate() {
        let failure = |rule, slot, reason| Some(refused(rule, slot, reason, phase, Some(entry), truth["id"].as_str().map(str::to_owned)));
        for slot in ["trigger", "observer", "verb", "outcome", "kind"] {
            if truth[slot].as_str().is_none_or(|value| value.trim().is_empty()) {
                return failure("required-slot", slot, "required sentence slot must be a nonblank string");
            }
        }
        if truth["trigger"].as_str().unwrap().contains(" or ") {
            return failure("one-trigger", "trigger", "one trigger: literal alternative delimiter ' or ' is forbidden");
        }
        if [" and ", " & ", ",", ";"].iter().any(|separator| truth["observer"].as_str().unwrap().contains(separator)) {
            return failure("one-observer", "observer", "one observer: conjunction and list separators are forbidden");
        }
        if !matches!(truth["verb"].as_str(), Some("sees" | "gets" | "is refused")) {
            return failure("allowed-verb", "verb", "verb must be sees, gets or is refused");
        }
        if !matches!(truth["kind"].as_str(), Some("literal" | "property")) {
            return failure("allowed-kind", "kind", "kind must be literal or property");
        }
    }
    None
}
