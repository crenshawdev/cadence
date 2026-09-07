//! Native history has an explicit origin and marker; legacy Gate text stays opaque.
use super::{Record, nonblank};
use crate::store::{
    Error, Result,
    model::{Decision, DecisionRecord, Evidence, Origin, VERSION},
};
use serde_json::Value;
use std::collections::BTreeMap;

pub const NAMESPACE: &str = "native_evidence";
const MARKER: &str = "cadence.native_evidence.v1";

pub fn read(data: &Value) -> Result<BTreeMap<String, Record>> {
    let Some(value) = data.get(NAMESPACE) else {
        return Ok(BTreeMap::new());
    };
    let records: BTreeMap<String, Record> = serde_json::from_value(value.clone())?;
    for (key, record) in &records {
        record.validate()?;
        if *key != record.key()? {
            return Err(Error::Invalid("native evidence key mismatch".into()));
        }
    }
    Ok(records)
}

pub fn project(data: &Value, record: &Record) -> Result<Value> {
    record.validate()?;
    let mut records = read(data)?;
    validate_transition(&records, record)?;
    records.insert(record.key()?, record.clone());
    let mut result = if data.is_null() {
        serde_json::json!({})
    } else {
        data.clone()
    };
    result
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("snapshot data must be an object".into()))?
        .insert(NAMESPACE.into(), serde_json::to_value(records)?);
    Ok(result)
}

pub fn history(operation_id: &str, record: &Record) -> Result<DecisionRecord> {
    nonblank("operation identity", operation_id)?;
    record.validate()?;
    Ok(DecisionRecord {
        version: VERSION,
        id: format!("native-evidence:{operation_id}"),
        revision: 1,
        origin: Origin {
            source: MARKER.into(),
            original: Evidence::Missing,
        },
        decision: Decision::Gate {
            outcome: MARKER.into(),
            evidence: Evidence::Text(serde_json::to_string(record)?),
        },
    })
}

pub fn decode_history(decision: &DecisionRecord) -> Result<Option<Record>> {
    if decision.origin.source != MARKER {
        return Ok(None);
    }
    let Decision::Gate {
        outcome,
        evidence: Evidence::Text(text),
    } = &decision.decision
    else {
        return Err(Error::Invalid("malformed native history".into()));
    };
    if outcome != MARKER {
        return Err(Error::Invalid("native history marker mismatch".into()));
    }
    let record: Record = serde_json::from_str(text)?;
    record.validate()?;
    Ok(Some(record))
}

fn validate_transition(records: &BTreeMap<String, Record>, record: &Record) -> Result<()> {
    use super::{Fact, checker::Attempt};
    if let Fact::Override(value) = &record.fact {
        super::overrides::validate_submission(records, record, value)?;
    }
    if let Fact::Checker(check) = &record.fact {
        let prior: Vec<_> = records
            .values()
            .filter(|r| r.scope == record.scope)
            .filter_map(|r| match &r.fact {
                Fact::Checker(check) => Some(check),
                _ => None,
            })
            .collect();
        if prior.iter().any(|old| old.id == check.id) {
            return Err(Error::Conflict(
                "checker observation identity already recorded".into(),
            ));
        }
        let spent = prior.iter().any(|old| old.revision_spent);
        match &check.attempt {
            Attempt::Initial if check.revision_spent != spent => {
                return Err(Error::Invalid(
                    "initial check cannot spend or refund revision".into(),
                ));
            }
            Attempt::Revision {
                previous_check,
                previous_blockers,
                ..
            } => {
                if spent {
                    return Err(Error::Conflict("one checker revision already spent".into()));
                }
                let previous = prior
                    .iter()
                    .find(|old| old.id == *previous_check)
                    .ok_or_else(|| {
                        Error::Invalid("revision lacks recorded initial check".into())
                    })?;
                if previous.blockers() != *previous_blockers {
                    return Err(Error::Invalid(
                        "revision changed the blocker list under reconsideration".into(),
                    ));
                }
            }
            _ => (),
        }
    }
    if let Fact::Gate(gate) = &record.fact {
        use super::gates::State;
        if let Some(checkpoint_id) = &gate.checkpoint_id {
            let checkpoint = records
                .values()
                .filter(|r| r.scope == record.scope)
                .find_map(|r| match &r.fact {
                    Fact::Checkpoint(cp) if cp.id == *checkpoint_id => Some(cp),
                    _ => None,
                })
                .ok_or_else(|| Error::Invalid("gate lacks its checkpoint".into()))?;
            if !checkpoint.requires_operator_answer() {
                return Err(Error::Invalid(
                    "suite-red does not require an operator gate".into(),
                ));
            }
        }
        match records.get(&record.key()?) {
            None if gate.state != State::Unanswered => {
                return Err(Error::Invalid(
                    "answer requires its recorded pending question".into(),
                ));
            }
            Some(Record {
                fact: Fact::Gate(prior),
                ..
            }) => {
                let mut question = gate.clone();
                question.state = prior.state.clone();
                if &question != prior
                    || prior.state != State::Unanswered
                    || gate.state == State::Unanswered
                {
                    return Err(Error::Conflict(
                        "question changed, already answered, or superseded".into(),
                    ));
                }
            }
            _ => (),
        }
    }
    if let Fact::AcceptedResult(result) = &record.fact {
        if records.contains_key(&record.key()?) {
            return Err(Error::Conflict(
                "accepted result identity already recorded".into(),
            ));
        }
        if let Some(checker_id) = &result.checker_id {
            let checker = records
                .values()
                .filter(|r| r.scope == record.scope)
                .find_map(|r| match &r.fact {
                    Fact::Checker(check) if check.id == *checker_id => Some(check),
                    _ => None,
                })
                .ok_or_else(|| {
                    Error::Invalid("accepted checker result lacks its observation".into())
                })?;
            use super::checker::Disposition;
            let disposition = match checker.disposition {
                Disposition::Pass => "pass",
                Disposition::Fail => "fail",
                Disposition::Unusable => "unusable",
            };
            if result.result != disposition {
                return Err(Error::Invalid(
                    "acceptance cannot change the checker disposition".into(),
                ));
            }
        }
    }
    Ok(())
}
