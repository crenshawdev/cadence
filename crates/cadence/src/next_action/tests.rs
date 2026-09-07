use super::{
    observations::{Observations, QueueMember, Report},
    *,
};
use crate::derivation::*;

struct Fixture {
    name: &'static str,
    lifecycle: Lifecycle,
    observations: Observations,
    pause: Option<Pause>,
    skip: bool,
    expected: &'static str,
}

fn fixture(name: &'static str, statuses: &[LifecycleStatus], expected: &'static str) -> Fixture {
    let phases: Vec<_> = statuses
        .iter()
        .enumerate()
        .map(|(i, status)| PhaseRecord {
            id: PhaseId((i + 1) as f64),
            name: format!("Phase {}", i + 1),
            plans: if *status == LifecycleStatus::Unplanned {
                vec![]
            } else {
                vec!["PLAN.md".into()]
            },
            status: *status,
            uat: None,
        })
        .collect();
    let observations = Observations {
        reports: phases
            .iter()
            .map(|phase| {
                (
                    phase.id,
                    phase
                        .plans
                        .iter()
                        .map(|_| Report {
                            path: format!("phases/{}/reports/plan-1.md", phase.id.address()).into(),
                            bytes: Observation::Present(b"PLAN COMPLETE\n".to_vec()),
                        })
                        .collect(),
                )
            })
            .collect(),
        ..Observations::default()
    };
    Fixture {
        name,
        lifecycle: Lifecycle {
            cycle: if phases.is_empty() {
                Cycle::Closed
            } else {
                Cycle::Live
            },
            current: phases
                .iter()
                .find(|p| p.status != LifecycleStatus::Complete)
                .map(|p| p.id),
            total: phases.len(),
            phases,
        },
        observations,
        pause: None,
        skip: false,
        expected,
    }
}
impl Fixture {
    fn paused(mut self) -> Self {
        self.pause = Some(Pause {
            phase: PhaseId(1.0),
            next: "verify the fix on the device".into(),
        });
        self
    }
    fn outstanding(mut self, id: f64) -> Self {
        self.observations
            .reports
            .iter_mut()
            .find(|(phase, _)| *phase == PhaseId(id))
            .unwrap()
            .1[0]
            .bytes = Observation::Absent;
        self
    }
    fn queue(mut self) -> Self {
        self.observations.queue.members.push(QueueMember {
            path: "deferred/1/DEFERRED-diff-1.json".into(),
            phase: "1".into(),
            trigger: "diff".into(),
            discriminator: "1".into(),
            round: 1,
            findings: 1,
        });
        self
    }
    fn unreadable(mut self) -> Self {
        self.observations.queue.unreadable.push("deferred".into());
        self
    }
    fn residue(mut self) -> Self {
        self.observations.residue.push("1".into());
        self
    }
    fn skip(mut self) -> Self {
        self.skip = true;
        self
    }
}

// Expected answers are authored literals from progress.md:194-202.
fn fixtures() -> Vec<Fixture> {
    use LifecycleStatus::*;
    vec![
        fixture("W1", &[Unplanned], "verify the fix on the device").paused(),
        fixture("W2", &[Planned], "/cad-execute 1"),
        fixture("W3", &[Executed], "/cad-execute 1").outstanding(1.0),
        fixture("W4", &[Executed], "/cad-verify 1"),
        fixture("W5", &[Unplanned], "/cad-context 1"),
        fixture("W5-skip", &[Unplanned], "/cad-plan 1").skip(),
        fixture("W6", &[Complete], "Triage the deferred queue").queue(),
        fixture("W6-unreadable", &[Complete], "Triage the deferred queue").unreadable(),
        fixture("W7", &[], "/cad-milestone").residue(),
        fixture("W8", &[], "/cad-phase add"),
        fixture("W9", &[Complete], "/cad-milestone"),
        fixture("P12", &[Planned], "verify the fix on the device").paused(),
        fixture("P23", &[Executed, Planned], "/cad-execute 2").outstanding(1.0),
        fixture("P34", &[Executed, Executed], "/cad-execute 2").outstanding(2.0),
        fixture("P45", &[Unplanned, Executed], "/cad-verify 2"),
        fixture("P56", &[Unplanned], "/cad-context 1").queue(),
        fixture("P67", &[], "Triage the deferred queue")
            .queue()
            .residue(),
        fixture("P78", &[], "/cad-milestone").residue(),
        fixture("P89", &[], "/cad-phase add"),
    ]
}

#[test]
fn authored_w1_w9_and_p12_p89_inventory_and_answers() {
    let cases = fixtures();
    assert_eq!(
        cases.iter().map(|c| c.name).collect::<Vec<_>>(),
        [
            "W1",
            "W2",
            "W3",
            "W4",
            "W5",
            "W5-skip",
            "W6",
            "W6-unreadable",
            "W7",
            "W8",
            "W9",
            "P12",
            "P23",
            "P34",
            "P45",
            "P56",
            "P67",
            "P78",
            "P89"
        ]
    );
    for case in cases {
        let action = select(
            &case.lifecycle,
            &case.observations,
            case.pause.as_ref(),
            case.skip,
        )
        .unwrap();
        assert_eq!(action.instruction(), case.expected, "{}", case.name);
        if case.name == "W1" {
            assert!(matches!(action, Action::Resume(_)));
        }
        if case.name == "W6" {
            assert_eq!(
                action.reference(),
                Some(("cadence-core/references/triage-gate.md", "deferred"))
            );
        }
    }
}

#[test]
fn all_eight_adjacent_swaps_fail_their_authored_fixture() {
    let cases = fixtures();
    for (i, name) in ["P12", "P23", "P34", "P45", "P56", "P67", "P78", "P89"]
        .iter()
        .enumerate()
    {
        let case = cases
            .iter()
            .find(|c| c.name == *name)
            .expect("missing adjacent case");
        let mut rules = super::select::RULES;
        assert!(
            rules[..i].iter().all(|rule| rule
                .apply(
                    &case.lifecycle,
                    &case.observations,
                    case.pause.as_ref(),
                    case.skip
                )
                .is_none()),
            "earlier rule applies: {name}"
        );
        assert!(
            rules[i]
                .apply(
                    &case.lifecycle,
                    &case.observations,
                    case.pause.as_ref(),
                    case.skip
                )
                .is_some()
        );
        assert!(
            rules[i + 1]
                .apply(
                    &case.lifecycle,
                    &case.observations,
                    case.pause.as_ref(),
                    case.skip
                )
                .is_some()
        );
        rules.swap(i, i + 1);
        let wrong = rules
            .iter()
            .find_map(|rule| {
                rule.apply(
                    &case.lifecycle,
                    &case.observations,
                    case.pause.as_ref(),
                    case.skip,
                )
            })
            .unwrap();
        assert_ne!(wrong.instruction(), case.expected, "swap escaped {name}");
    }
}

#[test]
fn numeric_order_and_different_phase_pause() {
    let mut case = fixture(
        "order",
        &[LifecycleStatus::Planned, LifecycleStatus::Planned],
        "/cad-execute 1",
    );
    case.lifecycle.phases.reverse();
    case.pause = Some(Pause {
        phase: PhaseId(2.0),
        next: "different phase".into(),
    });
    assert_eq!(
        select(
            &case.lifecycle,
            &case.observations,
            case.pause.as_ref(),
            false
        )
        .unwrap()
        .instruction(),
        case.expected
    );
}
