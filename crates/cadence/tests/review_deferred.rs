use cadence::review::{deferred, io, persistence};

use serde_json::{Value, json};
struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}
fn fixture(name: &str) -> Value {
    let input: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h5-all-homes.json")).unwrap();
    input[name].clone()
}
/// The review records one snapshot holds.
fn records(input: &Value) -> Value {
    persistence::records(&json!({"review":input["records"]})).unwrap()
}
fn answered(decision: deferred::Enqueue) -> Value {
    match decision {
        deferred::Enqueue::Answered(reply) => serde_json::to_value(reply).unwrap(),
        deferred::Enqueue::Write { member, .. } => panic!("wrote a new member: {member:?}"),
    }
}
#[test]
fn deferred_advisory_ac146() {
    let input = fixture("advisory");
    let decision = deferred::decide_enqueue(records(&input), "f1", &mut FixedClock).unwrap();
    assert_eq!(answered(decision), json!({"member":null}));
}
#[test]
fn deferred_off_ac147() {
    let input = fixture("off");
    let decision = deferred::decide_enqueue(records(&input), "f1", &mut FixedClock).unwrap();
    assert_eq!(answered(decision), json!({"member":null}));
}
/// A member already saved is answered from what was saved: no new member, so
/// its first timestamp stands.
#[test]
fn deferred_replay_preserves_initial_member() {
    let input = fixture("replay");
    assert_eq!(input["records"]["deferred"]["f1"]["enqueued_at"], 99);
    let decision = deferred::decide_enqueue(records(&input), "f1", &mut FixedClock).unwrap();
    assert_eq!(
        answered(decision),
        json!({"member":"f1","state":"unruled","continuation":"allowed"})
    );
}
#[test]
fn deferred_adjudication_rendering_does_not_filter() {
    let input = fixture("with-adjudication-rendering");
    let output = deferred::inventory(&records(&input)).unwrap();
    assert_eq!(
        output
            .members
            .iter()
            .map(|member| member.member.as_str())
            .collect::<Vec<_>>(),
        ["f1", "f2", "f3"]
    );
}
/// A fixture's records with a second attempt of `f1` beside `a1`, one that
/// has no original yet.
fn two_attempts(input: &Value) -> Value {
    let mut review = input["records"].clone();
    let mut second = review["attempts"]["a1"].clone();
    second["attempt"] = json!("a2");
    second["original"] = Value::Null;
    second["host_return"] = Value::Null;
    review["attempts"]["a2"] = second;
    records(&json!({"records":review}))
}
/// The new member a fixture's records enqueue, and the records holding it.
fn written(records: Value) -> (deferred::QueuedMember, Value) {
    match deferred::decide_enqueue(records, "f1", &mut FixedClock).unwrap() {
        deferred::Enqueue::Write { member, records } => (*member, records),
        deferred::Enqueue::Answered(reply) => panic!("no new member: {reply:?}"),
    }
}
#[test]
fn a_new_member_records_its_home_one_reference_per_attempt_the_time_and_the_contract() {
    for home in ["phase", "task", "root-inline", "root-debug", "root-diagnosis"] {
        let input = fixture(home);
        let (member, _) = written(two_attempts(&input));
        let admission = &input["records"]["admissions"]["f1"];
        assert_eq!(
            serde_json::to_value(member).unwrap(),
            json!({
                "member":"f1",
                "home":admission["home"],
                "references":[
                    {"fire":"f1","manifest":"m1","attempt":"a1","original":"o1"},
                    {"fire":"f1","manifest":"m1","attempt":"a2","original":null}
                ],
                "enqueued_at":100,
                "contract":admission["contract"],
                "state":"unruled"
            }),
            "{home}"
        );
    }
}
#[test]
fn a_committed_member_replies_unruled_with_continuation_allowed() {
    let (member, committed) = written(records(&fixture("phase")));
    let reply = deferred::settle("f1", &member, persistence::Outcome::Committed(committed)).unwrap();
    assert_eq!(
        serde_json::to_value(reply).unwrap(),
        json!({"member":"f1","state":"unruled","continuation":"allowed"})
    );
}
#[test]
fn a_failed_commit_replies_enqueue_write_failed_with_continuation_wait() {
    let (member, _) = written(records(&fixture("phase")));
    let refused = deferred::settle("f1", &member, persistence::Outcome::Failed).unwrap_err();
    assert_eq!(
        serde_json::to_value(refused).unwrap(),
        json!({"code":"enqueue-write-failed","fire":"f1","continuation":"wait"})
    );
}
/// The same-winner fixture's winning records, changed by `change`.
fn winner(input: &Value, change: impl FnOnce(&mut Value)) -> persistence::Outcome {
    let mut review = input["winner_records"].clone();
    change(&mut review["deferred"]["f1"]);
    persistence::Outcome::Lost(records(&json!({"records":review})))
}
#[test]
fn a_lost_race_to_an_equal_member_answers_with_the_winner() {
    let input = fixture("same-winner");
    let (member, _) = written(records(&input));
    let reply = deferred::settle("f1", &member, winner(&input, |_| {})).unwrap();
    assert_eq!(
        serde_json::to_value(reply).unwrap(),
        json!({"member":"f1","state":"unruled","continuation":"allowed"})
    );
}
#[test]
fn a_lost_race_to_a_different_member_is_refused() {
    let input = fixture("same-winner");
    let (member, _) = written(records(&input));
    let changes: [fn(&mut Value); 4] = [
        |saved| saved["member"] = json!("f2"),
        |saved| saved["home"]["id"] = json!("h2"),
        |saved| saved["references"][0]["attempt"] = json!("a9"),
        |saved| saved["contract"]["validator"] = json!("H4-2"),
    ];
    for change in changes {
        let refused = deferred::settle("f1", &member, winner(&input, change)).unwrap_err();
        assert_eq!(refused.code, "enqueue-write-failed");
    }
}
/// The references fixture's records, with `change` applied to member `f1`.
fn saved_member(change: impl FnOnce(&mut Value)) -> Value {
    let mut review = fixture("references")["records"].clone();
    change(&mut review["deferred"]["f1"]);
    records(&json!({"records":review}))
}
#[test]
fn the_inventory_has_one_row_per_saved_reference() {
    let review = saved_member(|saved| {
        saved["references"]
            .as_array_mut()
            .unwrap()
            .push(json!({"fire":"f1","manifest":"m1","attempt":"a2","original":null}))
    });
    let rows = deferred::inventory(&review).unwrap().members;
    assert_eq!(
        rows.iter()
            .map(|row| (row.member.as_str(), row.references.attempt.as_str()))
            .collect::<Vec<_>>(),
        [("f1", "a1"), ("f1", "a2")]
    );
}
#[test]
fn the_inventory_refuses_a_member_whose_references_or_home_do_not_match() {
    let changes: [fn(&mut Value); 2] = [
        |saved| saved["references"][0]["manifest"] = json!("m9"),
        |saved| saved["home"]["id"] = json!("h2"),
    ];
    for change in changes {
        assert!(deferred::inventory(&saved_member(change)).is_err());
    }
}
