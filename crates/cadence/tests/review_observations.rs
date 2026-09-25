use cadence::review::{attempts, io, model, persistence};

use cadence::store::Error;
use cadence::store::model::Snapshot;
use cadence::store::writer::View;
use serde_json::{Value, json};
struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}
fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/h3-observations.json")).unwrap()
}
fn view(records: Value, generation: u64) -> View {
    View {
        items: vec![],
        decisions: vec![],
        snapshot: Snapshot::new(generation, b"", b"", json!({"review":records})).unwrap(),
    }
}
fn records(basis: &View) -> Value {
    persistence::records(&basis.snapshot.data).unwrap()
}

#[test]
fn observation_duplicate_ac81() {
    let input = fixture();
    let basis = view(input["accepted"].clone(), 2);
    let event = serde_json::from_value(input["obs1"].clone()).unwrap();
    let attempts::Recording::Replay(result) =
        attempts::decide_observation(records(&basis), &event, &mut FixedClock).unwrap()
    else {
        panic!("a saved observation was contributed again")
    };
    assert_eq!(
        json!({"attempt":result.attempt.attempt,"observation":result.observation,"replayed":result.replayed}),
        json!({"attempt":"a1","observation":"obs1","replayed":true})
    );
}
#[test]
fn observation_late_usage_ac82() {
    let input = fixture();
    let basis = view(input["accepted"].clone(), 2);
    let event = serde_json::from_value(input["obs2"].clone()).unwrap();
    let attempts::Recording::Contribute(contributed) =
        attempts::decide_observation(records(&basis), &event, &mut FixedClock).unwrap()
    else {
        panic!("a new observation was replayed")
    };
    let result = attempts::receipt(&contributed, &event, false).unwrap();
    assert_eq!(
        json!({"attempt":result.attempt.attempt,"terminal_count":result.terminal_count,"original":result.attempt.original,"observed_model":result.attempt.observed_model,"input_usage":result.attempt.usage.input}),
        json!({"attempt":"a1","terminal_count":1,"original":"o1","observed_model":"observed-A","input_usage":7})
    );
}
#[test]
fn observation_conflicting_replay_refuses() {
    let input = fixture();
    let basis = view(input["accepted"].clone(), 2);
    let mut event: model::Observation = serde_json::from_value(input["obs1"].clone()).unwrap();
    event.attempt = "a2".into();
    assert_eq!(
        attempts::decide_observation(records(&basis), &event, &mut FixedClock).err().unwrap(),
        Error::Conflict("observation identity reused".into())
    );
}
