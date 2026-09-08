use cadence::execution::{
    boundary::{PreparedAnswer, Receipt, Success},
    dispatch::{build_routed_dispatch, validate_route_choice},
    model::{ActiveDispatch, DispatchRoute, ExecutionPlan, ExecutorRung, TaskSpec},
};
use cadence::store::{
    model::{Decision, DecisionRecord, Evidence, Origin},
    writer::{routing_decision, validate_routing},
};
use serde_json::{Value, json};

const ROUTE: &str = r#"{"choice":{"role":"cad-executor","agent":"cad-executor","rung":"high","starting_rung":"high","model":"sonnet","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"high"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"sonnet"},"attempt":1,"escalated":false,"pinned":false,"reasons":["fixture selection"],"warnings":[]},"inputs":{"repo":{"identity":"/project/.planning/config.v4.json","content":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","stamp":null},"global":null,"global_alias":false}}"#;
const DISPATCH_ID: &str = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

fn plan() -> ExecutionPlan {
    ExecutionPlan {
        phase: 8,
        plan: 1,
        requirements: vec!["AC10".into()],
        files: vec!["src/a.rs".into()],
        directories: vec![],
        schema: 1,
        suite: "verify".into(),
        tasks: vec![TaskSpec {
            id: "T1".into(),
            verify: vec!["verify".into()],
        }],
        body: "fixture".into(),
        fingerprint: "1".repeat(64),
    }
}
fn dispatch() -> ActiveDispatch {
    serde_json::from_value(json!({"schema":1,"id":DISPATCH_ID,"expected_execution_version":1,"phase":8,"plan":1,
        "plan_fingerprint":"1".repeat(64),"plan_set_fingerprint":"2".repeat(64),"requirements":["AC10"],
        "tasks":[{"id":"T1","verify":["verify"]}],"suite":"verify","files":["src/a.rs"],
        "policy":{"rung":"high","branch":"current","reviews":"disabled"},"route":serde_json::from_str::<Value>(ROUTE).unwrap(),
        "base_sha":"3".repeat(40),"prompt_bytes":7,"body":"fixture"})).unwrap()
}
fn record() -> DecisionRecord {
    DecisionRecord {
        version: 1,
        id: format!("routing:{DISPATCH_ID}"),
        revision: 1,
        origin: Origin {
            source: "native-routing".into(),
            original: Evidence::Missing,
        },
        decision: Decision::Routing {
            choice: r#"{"agent":"cad-executor","rung":"high","model":"sonnet"}"#.into(),
            config_provenance: [
                ("dispatch_id".into(), Evidence::Text(DISPATCH_ID.into())),
                ("route".into(), Evidence::Text(ROUTE.into())),
            ]
            .into(),
            requested_effort: Evidence::Text("high".into()),
            observed_effort: Evidence::Missing,
            receipt: Evidence::Missing,
        },
    }
}

#[test]
fn routed_builder_binds_the_literal_model_agent_and_config_input_to_identity() {
    for (model, rung, agent, expected_id) in [
        (
            Some("sonnet"),
            "high",
            "cad-executor",
            "084eb3c64bb53ffe239d64828ed060f97350b57de55126a0b5b7ab50782d0e0a",
        ),
        (
            Some("opus"),
            "xhigh",
            "cad-executor-xhigh",
            "56c03d3b23bdf18ba11d828a02fa21e60dc9e77fab156eb5fe3272ad8f471969",
        ),
        (
            None,
            "high",
            "cad-executor",
            "15ee31f9186f41765436e97c790600e1fb259084074d995cca38ff903ec13160",
        ),
    ] {
        let mut route: DispatchRoute = serde_json::from_str(ROUTE).unwrap();
        route.choice.agent = agent.into();
        route.choice.rung = rung.into();
        route.choice.starting_rung = rung.into();
        route.choice.effort_source.stored = Some(json!(rung));
        route.choice.model = model.map(String::from);
        route.choice.model_source.stored = Some(model.map_or(Value::Null, |model| json!(model)));
        if model.is_none() {
            route.choice.model_source.kind = "reset".into();
        }
        let answer =
            build_routed_dispatch(&plan(), &"2".repeat(64), 0, &"3".repeat(40), 7, route).unwrap();
        let choice = &answer.route.as_ref().unwrap().choice;
        assert_eq!(
            (
                answer.id.as_str(),
                choice.agent.as_str(),
                choice.model.as_deref(),
                answer.policy.rung
            ),
            (
                expected_id,
                agent,
                model,
                if rung == "high" {
                    ExecutorRung::High
                } else {
                    ExecutorRung::Xhigh
                }
            )
        );
    }
}

#[test]
fn routing_decision_returns_the_exact_record_without_observed_effort_or_receipt() {
    assert_eq!(routing_decision(&dispatch()).unwrap(), Some(record()));
}

#[test]
fn routing_validation_accepts_the_exact_independently_encoded_record() {
    assert_eq!(validate_routing(&dispatch(), &[record()]), Ok(()));
}

#[test]
fn routing_validation_rejects_missing_evidence() {
    assert_eq!(
        validate_routing(&dispatch(), &[]),
        Err(cadence::store::Error::Invalid(
            "dispatch lacks its exact routing decision".into()
        ))
    );
}

#[test]
fn routing_validation_rejects_mismatched_evidence() {
    let mut wrong = record();
    if let Decision::Routing {
        requested_effort, ..
    } = &mut wrong.decision
    {
        *requested_effort = Evidence::Text("max".into());
    }
    assert_eq!(
        validate_routing(&dispatch(), &[wrong]),
        Err(cadence::store::Error::Invalid(
            "dispatch lacks its exact routing decision".into()
        ))
    );
}

#[test]
fn dispatch_envelope_has_an_independently_encoded_exact_digest() {
    let answer = PreparedAnswer::new(cadence::envelope::Envelope::Ok(Success::Dispatch {
        dispatch: Box::new(dispatch()),
        prompt: "fixture".into(),
    }))
    .unwrap();
    assert_eq!(
        (answer.response_digest.as_str(), answer.receipt),
        (
            "281a096470439f1147be2843416cd400f527c633d0b92704b50e4eec81b38b96",
            Receipt::Dispatch {
                dispatch_id: DISPATCH_ID.into(),
                prompt_bytes: 7
            }
        )
    );
}

#[test]
fn mismatched_policy_and_agent_are_rejected_before_admission() {
    let mut supplied = dispatch();
    supplied.policy.rung = ExecutorRung::Max;
    let error = validate_route_choice(&supplied).unwrap_err();
    assert_eq!(
        (error.code, error.detail.as_str()),
        (
            "invalid-route",
            "dispatch route does not match its agent, effort or config identity"
        )
    );
}

#[test]
fn writer_admits_the_route_and_routing_record_in_one_persistence_result() {
    use cadence::execution::{
        boundary::{BoundaryScope, BoundaryV1},
        model::BoundaryTool,
    };
    use cadence::store::{
        filesystem::Filesystem,
        writer::{BoundaryChange, Operation, PlanningPolicy, Store},
    };
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("state.json"), br#"{"version":1,"generation":0,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","data":{},"operations":{},"integrity":"e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"}"#).unwrap();
    std::fs::write(root.path().join("items.jsonl"), b"").unwrap();
    std::fs::write(root.path().join("decisions.jsonl"), b"").unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), PlanningPolicy)
            .await
            .unwrap();
        let mut candidate = dispatch();
        candidate.expected_execution_version = 0;
        let decision = BoundaryV1 {
            codec: 1,
            scope: BoundaryScope::Execution { phase: 8 },
            tool: BoundaryTool::CadenceQuery,
            operation: "execute-next".into(),
            request_digest: "4".repeat(64),
            outcome: "dispatch".into(),
            subject_id: Some(DISPATCH_ID.into()),
            response_digest: "281a096470439f1147be2843416cd400f527c633d0b92704b50e4eec81b38b96"
                .into(),
            receipt: Receipt::Dispatch {
                dispatch_id: DISPATCH_ID.into(),
                prompt_bytes: 7,
            },
            lease_refusal: None,
        };
        let written = store
            .request(Operation::BoundaryV1 {
                expected_generation: 0,
                expected_integrity:
                    "e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd".into(),
                operation_id: "fixture-admission".into(),
                decision,
                change: Box::new(BoundaryChange::Dispatch {
                    plan_set_fingerprint: "2".repeat(64),
                    dispatch: candidate,
                }),
            })
            .await
            .unwrap();
        let active = &written.snapshot.data["execution"]["occurrences"]["8"]["active"];
        assert_eq!(
            (
                written.decisions.len(),
                &written.decisions[0],
                written.snapshot.generation,
                &active["route"]["choice"]["model"],
                &active["id"]
            ),
            (2, &record(), 1, &json!("sonnet"), &json!(DISPATCH_ID))
        );
    });
}
