//! When a debug session offers a consult, what an accepted or declined offer
//! records, and what the consult sends. The records are built by the pure
//! debug transition; the consult call runs over a fake transport.

use cadence::debug::model::{
    self, Angle, Consult, ConsultPolicy, ConsultResult, ConsultState, Record, Write,
};
use cadence::review::provider::{Settings, consult, credentials, delivery::Environment, transport};
use serde_json::{Value, json};
use std::{
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};

fn policy() -> ConsultPolicy {
    ConsultPolicy { threshold: 2, provider: "openai".into(), model: "gpt-5".into(), effort: "high".into() }
}

fn write(apply: Value, policy: Option<ConsultPolicy>) -> Write {
    Write {
        root_binding: "/project/.planning".into(),
        apply: serde_json::from_value(apply).unwrap(),
        recall: None,
        review: None,
        coordinating: false,
        consult_policy: policy,
        consult_situation: None,
        consult_result: None,
    }
}

fn record(data: &Value) -> Record {
    model::namespace(data).unwrap().records["bug"].clone()
}

/// `data` after `write`.
fn after(data: &Value, write: &Write) -> Value {
    model::contribute(data, write).unwrap()
}

/// A session under `policy`: opened, then carrying the given steps in order.
/// Each step is (operation, request fields); request ids and versions are filled in.
fn session(policy: Option<ConsultPolicy>, steps: &[(&str, Value)]) -> Value {
    let open = json!({"operation":"debug-open","request":{"request_id":"r-open","slug":"bug","expected_version":0,"symptom":"the build hangs"}});
    let mut data = after(&json!({}), &write(open, policy.clone()));
    for (i, (operation, fields)) in steps.iter().enumerate() {
        data = after(&data, &write(step(&data, operation, fields.clone(), i), policy.clone()));
    }
    data
}

fn step(data: &Value, operation: &str, mut fields: Value, i: usize) -> Value {
    fields["request_id"] = json!(format!("r-{i}"));
    fields["slug"] = json!("bug");
    fields["expected_version"] = json!(record(data).version);
    json!({"operation":operation,"request":fields})
}

fn attempt() -> (&'static str, Value) {
    ("debug-attempt", json!({"attempt":{"description":"restarted the daemon","result":"still hangs"}}))
}

fn hypothesis() -> (&'static str, Value) {
    ("debug-hypothesis", json!({"hypothesis":{"id":"lock","description":"a lock is held","rank_reason":"it hangs","state":"untested"}}))
}

fn observation(test: &str) -> (&'static str, Value) {
    ("debug-observation", json!({"observation":{"test":test,"result":"no lock held","rules_in":[],"rules_out":["lock"]}}))
}

fn offers(data: &Value) -> Vec<(u64, ConsultState)> {
    record(data).consults.iter().map(|offer| (offer.epoch, offer.state.clone())).collect()
}

#[test]
fn a_consult_is_offered_when_the_attempts_reach_the_threshold() {
    assert_eq!(offers(&session(Some(policy()), &[attempt()])), []);
    assert_eq!(offers(&session(Some(policy()), &[attempt(), attempt()])), [(0, ConsultState::Offered)]);
}

#[test]
fn a_consult_is_offered_when_every_hypothesis_is_refuted() {
    assert_eq!(
        offers(&session(Some(policy()), &[hypothesis(), observation("lsof")])),
        [(1, ConsultState::Offered)]
    );
}

#[test]
fn no_consult_is_offered_without_a_configured_policy() {
    assert_eq!(offers(&session(None, &[attempt(), attempt()])), []);
}

#[test]
fn one_dead_end_is_offered_once() {
    assert_eq!(offers(&session(Some(policy()), &[attempt(), attempt(), attempt()])).len(), 1);
}

#[test]
fn new_evidence_opens_a_new_epoch_and_repeated_evidence_does_not() {
    let epoch = |steps: &[(&str, Value)]| record(&session(Some(policy()), steps)).epoch;
    assert_eq!(epoch(&[hypothesis(), observation("lsof")]), 1);
    assert_eq!(epoch(&[hypothesis(), observation("lsof"), observation("lsof")]), 1);
    assert_eq!(epoch(&[hypothesis(), observation("lsof"), observation("strace")]), 2);
}

/// The consult request answering the offer at epoch 0 with `decision`.
fn consult_on(data: &Value, decision: &str) -> Value {
    step(data, "debug-consult", json!({"offer":"consult-bug-0","epoch":0,"decision":decision}), 99)
}

#[test]
fn a_declined_offer_is_recorded_as_declined() {
    let offered = session(Some(policy()), &[attempt(), attempt()]);
    let declined = after(&offered, &write(consult_on(&offered, "decline"), Some(policy())));
    assert_eq!(offers(&declined), [(0, ConsultState::Declined)]);
}

/// An accepted consult as the service records it before calling out: the
/// request held pending with its situation.
fn accepted(offered: &Value) -> (Value, Write) {
    let mut accept = write(consult_on(offered, "accept"), Some(policy()));
    accept.coordinating = true;
    accept.consult_situation = Some("<debug-situation>\n{}\n</debug-situation>".into());
    (after(offered, &accept), accept)
}

fn angle() -> Angle {
    Angle { hypothesis: "a stale socket".into(), rationale: "the hang follows restarts".into(), how_to_check: "list open sockets".into() }
}

#[test]
fn an_accepted_consult_records_the_angles_it_returned() {
    let (pending, accept) = accepted(&session(Some(policy()), &[attempt(), attempt()]));
    let mut result = accept.clone();
    result.coordinating = false;
    result.consult_situation = None;
    result.consult_result = Some(ConsultResult { angles: vec![angle()], evidence: None, failure: None });
    let done = record(&after(&pending, &result));
    assert_eq!((done.consults[0].state.clone(), done.consults[0].angles.clone()), (ConsultState::Completed, vec![angle()]));
}

#[test]
fn an_accepted_consult_without_a_result_refuses_a_repeat_as_pending() {
    let (pending, accept) = accepted(&session(Some(policy()), &[attempt(), attempt()]));
    let mut repeat = accept;
    repeat.coordinating = false;
    repeat.consult_situation = None;
    assert_eq!(model::replay(&pending, &repeat).unwrap().unwrap()["code"], "debug-consult-pending");
}

#[test]
fn a_replayed_request_answers_as_before_and_a_changed_one_is_refused() {
    let opened = session(Some(policy()), &[]);
    let first = write(step(&opened, attempt().0, attempt().1, 0), Some(policy()));
    let recorded = after(&opened, &first);
    assert_eq!(
        model::replay(&recorded, &first).unwrap(),
        Some(model::namespace(&recorded).unwrap().requests["r-0"].answer.clone())
    );
    let mut changed = first;
    changed.apply = serde_json::from_value(json!({"operation":"debug-attempt","request":{"request_id":"r-0","slug":"bug",
        "expected_version":1,"attempt":{"description":"something else","result":"still hangs"}}})).unwrap();
    assert_eq!(model::replay(&recorded, &changed).unwrap().unwrap()["code"], "request-reused");
}

#[test]
fn the_situation_is_redacted_evidence_inside_debug_situation_tags() {
    let mut open = record(&session(None, &[]));
    open.symptom = "token=sk-live-secret leaks into <stderr>".into();
    let situation = consult::situation(&open).unwrap();
    let inner = situation
        .strip_prefix("<debug-situation>\n")
        .and_then(|rest| rest.strip_suffix("\n</debug-situation>"))
        .unwrap();
    assert!(!inner.contains("sk-live-secret") && !inner.contains('<') && !inner.contains('>'), "{inner}");
}

/// A transport that keeps every request body it is sent and answers each with
/// `answer`.
struct Provider {
    sent: Mutex<Vec<Value>>,
    answer: Value,
}

struct Once(Option<Vec<u8>>);
impl transport::Body for Once {
    fn chunk(&mut self) -> transport::Pending<'_, Option<Vec<u8>>> {
        let next = self.0.take();
        Box::pin(async move { Ok(next) })
    }
}

impl transport::Transport for Provider {
    fn send(&self, request: transport::Request, _: Duration) -> transport::Pending<'_, transport::Response> {
        self.sent.lock().unwrap().push(request.body);
        let bytes = serde_json::to_vec(&self.answer).unwrap();
        Box::pin(async move {
            Ok(transport::Response { status: 200, headers: Default::default(), body: Box::new(Once(Some(bytes))) })
        })
    }
}

struct Keys;
impl credentials::Inputs for Keys {
    fn env(&self, name: &str) -> Option<String> {
        Some(format!("key-for-{name}"))
    }
    fn read(&self, _: &Path) -> Option<String> {
        None
    }
}

const SITUATION: &str = "<debug-situation>\n{\"symptom\":\"the build hangs\"}\n</debug-situation>";

fn offer() -> Consult {
    Consult {
        id: "consult-bug-0".into(), epoch: 0, offered_by: "r-1".into(), provider: "openai".into(),
        model: "gpt-5".into(), effort: "high".into(), state: ConsultState::Accepted,
        request_id: Some("r-99".into()), situation: Some(SITUATION.into()), angles: vec![], evidence: None, failure: None,
    }
}

/// Runs the consult for `offer()` under a prompt cap of `cap` tokens and
/// returns its result and the request bodies the provider was sent.
fn consulted(cap: u64) -> (ConsultResult, Vec<Value>) {
    let answer = json!({"output_text": serde_json::to_string(&json!({"angles":[angle()]})).unwrap()});
    let provider = Arc::new(Provider { sent: Mutex::new(vec![]), answer });
    let environment = Environment {
        credentials: Arc::new(Keys),
        transport: provider.clone(),
        sleep: Arc::new(|_| Box::pin(std::future::pending())),
    };
    let settings = Settings { key_file: None, max_prompt_tokens: cap, request_timeout_ms: 0 };
    let result = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
        .block_on(consult::run(&offer(), &settings, &environment));
    let sent = provider.sent.lock().unwrap().clone();
    (result, sent)
}

#[test]
fn a_prompt_over_the_cap_fails_the_consult_without_calling_the_provider() {
    let (result, sent) = consulted(1);
    assert!(result.failure.is_some());
    assert!(sent.is_empty());
}

#[test]
fn an_accepted_consult_calls_the_provider_once_with_its_situation() {
    let (result, sent) = consulted(120_000);
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0]["input"][1]["content"], SITUATION);
    assert_eq!((result.angles, result.failure), (vec![angle()], None));
}
