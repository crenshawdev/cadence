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
            accepted: false,
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

/// The action `select` answers for the authored progress-table case `name`,
/// checked against the instruction the table authors for it.
fn authored(name: &str) -> Action {
    let case = fixtures().into_iter().find(|case| case.name == name).unwrap();
    let action = select(
        &case.lifecycle,
        &case.observations,
        case.pause.as_ref(),
        case.skip,
    )
    .unwrap();
    assert_eq!(action.instruction(), case.expected, "{name}");
    action
}

macro_rules! authored_rows {
    ($($test:ident => $name:literal),* $(,)?) => {
        $(
            #[test]
            fn $test() {
                authored($name);
            }
        )*
    };
}

authored_rows! {
    authored_w2 => "W2",
    authored_w3 => "W3",
    authored_w4 => "W4",
    authored_w5 => "W5",
    authored_w5_skip => "W5-skip",
    authored_w6 => "W6",
    authored_w6_unreadable => "W6-unreadable",
    authored_w7 => "W7",
    authored_w8 => "W8",
    authored_w9 => "W9",
    authored_p12 => "P12",
    authored_p23 => "P23",
    authored_p34 => "P34",
    authored_p45 => "P45",
    authored_p56 => "P56",
    authored_p67 => "P67",
    authored_p78 => "P78",
    authored_p89 => "P89",
}

#[test]
fn authored_w1_resumes_the_saved_pause() {
    assert!(matches!(authored("W1"), Action::Resume(_)));
}

#[test]
fn the_deferred_queue_answer_names_the_triage_gate_reference() {
    assert_eq!(
        authored("W6").reference(),
        Some(("cadence-core/references/triage-gate.md", "deferred"))
    );
}

#[test]
fn the_lowest_numbered_planned_phase_is_chosen_whatever_the_record_order() {
    let mut case = fixture(
        "order",
        &[LifecycleStatus::Planned, LifecycleStatus::Planned],
        "/cad-execute 1",
    );
    case.lifecycle.phases.reverse();
    assert_eq!(
        select(&case.lifecycle, &case.observations, None, false)
            .unwrap()
            .instruction(),
        case.expected
    );
}

#[test]
fn a_pause_saved_for_another_phase_is_not_offered() {
    let mut case = fixture(
        "other phase",
        &[LifecycleStatus::Planned, LifecycleStatus::Planned],
        "/cad-execute 1",
    );
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

#[test]
fn skipping_discussion_changes_only_an_unplanned_phases_answer() {
    for case in fixtures() {
        let answer = |skip| select(&case.lifecycle, &case.observations, case.pause.as_ref(), skip);
        match answer(false) {
            Some(Action::Context(id)) => assert_eq!(answer(true), Some(Action::Plan(id)), "{}", case.name),
            without => assert_eq!(answer(true), without, "{}", case.name),
        }
    }
}
