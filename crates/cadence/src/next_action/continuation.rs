//! Continuation of explicitly named work, independent of progress routing.
use crate::evidence::{
    Fact, Record, Scope,
    authority::{self, CheckerApplicability, Occurrence},
    checker::{Checker, Disposition as Verdict},
    checkpoint::{Checkpoint, CheckpointType, State as CheckpointState},
    gates::{Answer, Disposition, Gate, OptionChoice, Purpose, State},
    material::Freshness,
    overrides::Meaning,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Decision {
    AwaitAcceptance,
    NeedQuestion(Gate),
    Wait(Gate),
    Stop(Answer),
    Ended(Occurrence),
    RepairSuite {
        failing_output: String,
    },
    Revise,
    FreshCheck,
    OverrideRequired,
    Continue {
        answer: Option<Answer>,
        override_id: Option<String>,
        rerun_plans: Vec<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Continuation {
    pub checkpoint: Option<Checkpoint>,
    pub checker: Option<Checker>,
    pub applicability: Option<CheckerApplicability>,
    pub decision: Decision,
}

pub fn latest_checker<'a>(records: &'a [Record], scope: &Scope) -> Option<&'a Checker> {
    records.iter().rev().find_map(|r| {
        if r.scope == *scope {
            if let Fact::Checker(c) = &r.fact {
                Some(c)
            } else {
                None
            }
        } else {
            None
        }
    })
}

fn checkpoint_question(checkpoint: &Checkpoint) -> Gate {
    let purpose = match checkpoint.checkpoint_type {
        CheckpointType::Structural => Purpose::Structural,
        CheckpointType::HumanVerify => Purpose::HumanVerify,
        CheckpointType::Decision => Purpose::Decision,
        CheckpointType::Blocked => Purpose::Blocked,
        CheckpointType::SuiteRed => unreachable!("suite repair never asks"),
    };
    Gate {
        id: format!("continuation/checkpoint/{}", checkpoint.id),
        purpose,
        checkpoint_id: Some(checkpoint.id.clone()),
        question: checkpoint.need.clone(),
        need: checkpoint.need.clone(),
        options: if checkpoint.checkpoint_type == CheckpointType::Structural {
            [
                ("approve", "Approve the proposed change"),
                ("adjust", "Adjust it"),
                ("stop", "Stop the phase"),
            ]
            .into_iter()
            .map(|(id, text)| OptionChoice {
                id: id.into(),
                text: text.into(),
            })
            .collect()
        } else {
            vec![]
        },
        state: State::Unanswered,
    }
}

/// Records must be current projections in history order, oldest first.
pub fn select(
    records: &[Record],
    scope: &Scope,
    applicability: Option<CheckerApplicability>,
    admitted_plans: &[String],
) -> Continuation {
    let checkpoint = records.iter().rev().find_map(|r| {
        if r.scope == *scope
            && let Fact::Checkpoint(cp) = &r.fact
            && cp.state == CheckpointState::Unresolved
        {
            Some(cp.clone())
        } else {
            None
        }
    });
    let checker = latest_checker(records, scope).cloned();
    let decision = decide(
        records,
        scope,
        checkpoint.as_ref(),
        checker.as_ref(),
        applicability.as_ref(),
        admitted_plans,
    );
    Continuation {
        checkpoint,
        checker,
        applicability,
        decision,
    }
}

fn decide(
    records: &[Record],
    scope: &Scope,
    checkpoint: Option<&Checkpoint>,
    checker: Option<&Checker>,
    applicability: Option<&CheckerApplicability>,
    admitted_plans: &[String],
) -> Decision {
    let scoped: Vec<_> = records.iter().filter(|r| r.scope == *scope).collect();
    if let Some(state) = scoped.iter().find_map(|r| {
        if let Fact::Occurrence(state) = &r.fact {
            Some(state)
        } else {
            None
        }
    }) {
        return Decision::Ended(state.clone());
    }
    let gates: Vec<_> = scoped
        .iter()
        .rev()
        .filter_map(|r| {
            let Fact::Gate(g) = &r.fact else {
                return None;
            };
            (g.purpose == Purpose::Progress
                || checkpoint.is_some_and(|cp| g.checkpoint_id.as_ref() == Some(&cp.id)))
            .then_some(g)
        })
        .filter(|g| !matches!(g.state, State::Superseded { .. }))
        .collect();
    // A Stop stays in force until a later progress authorization names the
    // same checkpoint; a restart or an unlinked approval never continues it.
    for (index, gate) in gates.iter().enumerate() {
        let State::Answered(answer) = &gate.state else { continue };
        if answer.disposition != Disposition::Stop {
            continue;
        }
        let continued = gate.checkpoint_id.is_some()
            && gates[..index].iter().any(|later| {
                later.purpose == Purpose::Progress
                    && later.checkpoint_id == gate.checkpoint_id
                    && matches!(&later.state, State::Answered(a) if a.disposition == Disposition::Approve)
            });
        if !continued {
            return Decision::Stop(answer.clone());
        }
    }
    if let Some(cp) = checkpoint {
        if cp.checkpoint_type == CheckpointType::SuiteRed {
            return Decision::RepairSuite {
                failing_output: cp
                    .failing_output
                    .clone()
                    .expect("validated suite-red output"),
            };
        }
        if !gates
            .iter()
            .any(|g| g.checkpoint_id.as_ref() == Some(&cp.id))
        {
            return Decision::NeedQuestion(checkpoint_question(cp));
        }
    }
    if let Some(gate) = gates.iter().find(|g| g.state == State::Unanswered) {
        return Decision::Wait((*gate).clone());
    }

    if let Some(check) = checker {
        let Some(applicable) = applicability else {
            return Decision::FreshCheck;
        };
        if !applicable.continuation_allowed {
            if applicable.freshness != Freshness::Current {
                return Decision::FreshCheck;
            }
            return if check.disposition == Verdict::Fail && !applicable.revision_spent {
                Decision::Revise
            } else {
                Decision::OverrideRequired
            };
        }
    }
    let answer = gates.iter().find_map(|g| match &g.state {
        State::Answered(a) => Some(a.clone()),
        _ => None,
    });
    let mut override_id = applicability.and_then(|a| a.override_id.clone());
    let mut rerun_plans = Vec::new();
    for record in scoped.iter().rev() {
        let Fact::Override(value) = &record.fact else {
            continue;
        };
        if !authority::permission(records, scope, &value.id).active() {
            continue;
        }
        match &value.meaning {
            Meaning::Rerun {
                admitted_plans: plans,
            } => {
                if plans.iter().collect::<std::collections::BTreeSet<_>>()
                    != admitted_plans.iter().collect()
                {
                    return Decision::OverrideRequired;
                }
                rerun_plans = admitted_plans.to_vec();
                override_id = Some(value.id.clone());
                break;
            }
            Meaning::Bypass {
                target: crate::evidence::overrides::Bypass::Skipped { .. },
            } if checker.is_none() => {
                override_id = Some(value.id.clone());
                break;
            }
            // A saved sentence offers resume. It is not acceptance of that offer.
            Meaning::PausedNext { .. } | Meaning::Review(_) | Meaning::Bypass { .. } => {}
        }
    }
    if answer.is_none() && override_id.is_none() {
        Decision::AwaitAcceptance
    } else {
        Decision::Continue {
            answer,
            override_id,
            rerun_plans,
        }
    }
}
