use super::execution_service;

#[test]
fn execute_next_decodes_an_optional_owner_selected_plan() {
    let decoded = serde_json::from_value::<super::QueryArguments>(serde_json::json!({
        "operation":"execute-next","phase":6,"plan":2
    }));
    let Ok(super::QueryArguments::ExecuteNext { phase, plan }) = decoded else {
        panic!("execute-next must accept an owner-selected admitted plan");
    };
    assert_eq!(phase.get(), 6);
    assert_eq!(plan.map(std::num::NonZeroU32::get), Some(2));
}

#[test]
fn select_ready_plan_picks_the_named_plan_else_the_lowest_ready_one() {
    let selected = std::num::NonZeroU32::new(2);
    assert_eq!(execution_service::select_ready_plan(&[1,2], &[], selected), Ok(2));
    assert_eq!(execution_service::select_ready_plan(&[1,2], &[], None), Ok(1));
}

#[test]
fn select_ready_plan_refuses_a_plan_not_admitted_or_already_completed() {
    let selected = std::num::NonZeroU32::new(2);
    assert_eq!(execution_service::select_ready_plan(&[1], &[], selected), Err("plan-not-admitted"));
    assert_eq!(execution_service::select_ready_plan(&[1,2], &[2], selected), Err("plan-completed"));
}

#[test]
fn suite_repair_answer_requires_owner() {
    let attributed = serde_json::json!({"operation":"execution-suite-repair-answer","request":{
        "request_id":"answer-1","plan":{"phase":6,"occurrence":"phase-6-execution",
            "admission_digest":"admission","plan":1},"expected_version":3,
        "question_id":"suite-repair:run-1","owner":"Fixture Owner",
        "at":"2026-09-15T18:00:00Z","disposition":"approve"}});
    let cadence::execution::runner::PlanApply::RepairAnswer { request } =
        serde_json::from_value::<cadence::execution::runner::PlanApply>(attributed).unwrap() else { unreachable!() };
    assert!(request.plan_request().is_ok(), "an attributed answer is a plan request");
    let blank = serde_json::json!({"operation":"execution-suite-repair-answer","request":{
        "request_id":"answer-blank","plan":{"phase":6,"occurrence":"phase-6-execution",
            "admission_digest":"admission","plan":1},"expected_version":3,
        "question_id":"suite-repair:run-1","owner":"","at":"2026-09-15T18:00:00Z",
        "disposition":"approve"}});
    let cadence::execution::runner::PlanApply::RepairAnswer { request } =
        serde_json::from_value::<cadence::execution::runner::PlanApply>(blank).unwrap() else { unreachable!() };
    assert!(request.plan_request().unwrap_err().to_string().contains("suite-repair-answer"),
        "blank owner attribution must be refused at the public boundary");
}

#[test]
fn execution_service_conversion_is_public_before_receipt_creation() {
    use cadence::execution::boundary::Response;
    use cadence::{
        envelope::Envelope,
        execution::boundary::{PreparedAnswer, Receipt},
    };
    let answer = PreparedAnswer::new(
        Response::Refused {
            phase: 6,
            code: "invalid-phase".into(),
            reason: "phase must be positive".into(),
        }
        .into_envelope(),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(&answer.envelope).unwrap(),
        serde_json::json!({
            "status":"refused","code":"invalid-phase","reason":"phase must be positive"
        })
    );
    assert!(matches!(
        answer.receipt,
        Receipt::Compact {
            envelope: Envelope::Refused { .. }
        }
    ));
    assert_eq!(
        answer.response_digest,
        "6914d5f0a8f7869ca24286a3432df51d4114d9f9f3163293e2d0be6f8f1148c7"
    );
}

#[test]
fn execution_service_name_status_reader_rejects_incomplete_and_invalid_git_bytes() {
    use execution_service::read_name_status;
    assert_eq!(
        read_name_status(b"M\0src/a.rs\0R100\0src/old\0src/new\0").unwrap(),
        ["src/a.rs", "src/new", "src/old"]
    );
    assert_eq!(read_name_status(b"").unwrap(), Vec::<String>::new());
    for bytes in [
        b"M\0src/a.rs".as_slice(),
        b"R100\0src/a.rs\0",
        b"M\0\0",
        b"Z\0path\0",
        b"U\0path\0",
        b"R101\0old\0new\0",
        b"R\0old\0new\0",
        b"M\0../outside\0",
        b"M\0bad-\xff\0",
        b"\0",
    ] {
        assert!(read_name_status(bytes).is_err(), "{bytes:?}");
    }
}
