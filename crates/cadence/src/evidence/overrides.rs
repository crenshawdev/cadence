//! Reasoned exceptions retain the outcome and the exact work being authorized.
use super::{Fact, Record, Scope, checker::Disposition, gates, nonblank};
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Authorization {
    Invocation { id: String, invocation: String },
    Answer { id: String, question_id: String },
}
impl Authorization {
    pub fn id(&self) -> &str {
        match self {
            Self::Invocation { id, .. } | Self::Answer { id, .. } => id,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Bypass {
    Skipped {
        check: String,
    },
    Result {
        checker_id: String,
        disposition: Disposition,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewReceipt {
    pub base: String,
    pub head: String,
    pub trigger: String,
    pub plan: Option<String>,
    pub correlation: String,
    pub round: Option<u32>,
    pub anchor: Option<String>,
    /// The finding record remains distinct from this receipt's aggregate counts.
    pub finding_record: String,
    pub settled: SettledCounts,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettledCounts {
    pub survivors: u32,
    pub downgraded: u32,
    pub refuted: u32,
}

impl ReviewReceipt {
    pub fn settles(&self, base: &str, head: &str, trigger: &str, plan: Option<&str>) -> bool {
        self.base == base
            && self.head == head
            && self.trigger == trigger
            && self.plan.as_deref() == plan
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Meaning {
    Rerun { admitted_plans: Vec<String> },
    Bypass { target: Bypass },
    PausedNext { sentence: String },
    Review(ReviewReceipt),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Override {
    pub id: String,
    pub reason: String,
    pub authorization: Authorization,
    pub meaning: Meaning,
}
impl Override {
    pub fn validate(&self, scope: &Scope) -> Result<()> {
        nonblank("override identity", &self.id)?;
        nonblank("operator reason", &self.reason)?;
        nonblank("authorization identity", self.authorization.id())?;
        match &self.authorization {
            Authorization::Invocation { invocation, .. } => {
                nonblank("explicit invocation", invocation)?
            }
            Authorization::Answer { question_id, .. } => {
                nonblank("originating question", question_id)?
            }
        }
        match &self.meaning {
            Meaning::Rerun { admitted_plans } => {
                let unique: BTreeSet<_> = admitted_plans.iter().collect();
                if admitted_plans.is_empty() || unique.len() != admitted_plans.len() {
                    return Err(Error::Invalid(
                        "rerun requires every admitted plan exactly once".into(),
                    ));
                }
                for plan in admitted_plans {
                    nonblank("admitted plan", plan)?;
                }
            }
            Meaning::Bypass { target } => match target {
                Bypass::Skipped { check } => nonblank("skipped check", check)?,
                Bypass::Result { checker_id, .. } => {
                    nonblank("bypassed checker result", checker_id)?
                }
            },
            Meaning::PausedNext { sentence } => {
                nonblank("pause sentence", sentence)?;
                if sentence.contains(['\n', '\r']) {
                    return Err(Error::Invalid("pause requires one exact line".into()));
                }
            }
            Meaning::Review(receipt) => {
                nonblank("review base", &receipt.base)?;
                nonblank("review head", &receipt.head)?;
                nonblank("review trigger", &receipt.trigger)?;
                nonblank("review correlation", &receipt.correlation)?;
                nonblank("finding record reference", &receipt.finding_record)?;
                if let Some(anchor) = &receipt.anchor {
                    nonblank("review anchor", anchor)?;
                }
                if receipt.round == Some(0) {
                    return Err(Error::Invalid("review round must be positive".into()));
                }
                if let Some(plan) = &receipt.plan {
                    nonblank("review plan", plan)?;
                    if plan != &scope.plan {
                        return Err(Error::Invalid("review plan differs from work scope".into()));
                    }
                }
            }
        }
        Ok(())
    }
}

pub(crate) fn validate_submission(
    records: &BTreeMap<String, Record>,
    record: &Record,
    value: &Override,
) -> Result<()> {
    if records.contains_key(&record.key()?) {
        return Err(Error::Conflict("override identity already recorded".into()));
    }
    if let Authorization::Answer { id, question_id } = &value.authorization {
        let answered = records.values().any(|r| r.scope == record.scope && matches!(&r.fact,
            Fact::Gate(g) if &g.id == question_id && matches!(&g.state,
                gates::State::Answered(a) if a.authorization_id.as_ref() == Some(id) && a.disposition != gates::Disposition::Stop)));
        if !answered {
            return Err(Error::Invalid(
                "override lacks its recorded authorizing answer".into(),
            ));
        }
    }
    if let Meaning::Bypass {
        target: Bypass::Result {
            checker_id,
            disposition,
        },
    } = &value.meaning
        && !records.values().any(|r| {
            r.scope == record.scope
                && matches!(&r.fact,
            Fact::Checker(c) if &c.id == checker_id && &c.disposition == disposition)
        })
    {
        return Err(Error::Invalid(
            "bypass must preserve its actual checker outcome".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unified_override_round_trips_and_requires_reason() {
        let scope = Scope {
            project: "/p".into(),
            planning_root: "/p/.planning".into(),
            cycle: "v4".into(),
            occurrence: "run-1".into(),
            phase: "5".into(),
            plan: "PLAN-1.md".into(),
            report: "reports/plan-1.md".into(),
        };
        for meaning in [
            Meaning::Rerun {
                admitted_plans: vec!["PLAN-1.md".into(), "PLAN-2.md".into()],
            },
            Meaning::Bypass {
                target: Bypass::Skipped {
                    check: "plan-check".into(),
                },
            },
            Meaning::PausedNext {
                sentence: "  Resume 日本語\t exactly  ".into(),
            },
            Meaning::Review(ReviewReceipt {
                base: "A".into(),
                head: "B".into(),
                trigger: "execute".into(),
                plan: Some(scope.plan.clone()),
                correlation: "review-run".into(),
                round: None,
                anchor: None,
                finding_record: "ADJUDICATION.md".into(),
                settled: SettledCounts {
                    survivors: 1,
                    downgraded: 0,
                    refuted: 0,
                },
            }),
        ] {
            let mut record = Record {
                version: super::super::VERSION,
                scope: scope.clone(),
                fact: Fact::Override(Override {
                    id: "exception".into(),
                    reason: "  Preserve my words\n".into(),
                    authorization: Authorization::Invocation {
                        id: "answer".into(),
                        invocation: "explicit request".into(),
                    },
                    meaning,
                }),
            };
            record.validate().unwrap();
            let bytes = serde_json::to_vec(&record).unwrap();
            assert_eq!(serde_json::from_slice::<Record>(&bytes).unwrap(), record);
            let Fact::Override(value) = &mut record.fact else {
                unreachable!()
            };
            value.reason = " \t\n".into();
            assert!(record.validate().is_err());
            let mut missing = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap();
            missing["fact"]["value"]
                .as_object_mut()
                .unwrap()
                .remove("reason");
            assert!(serde_json::from_value::<Record>(missing).is_err());
        }
    }
}
