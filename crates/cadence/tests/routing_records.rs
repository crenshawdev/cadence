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
        "base_sha":"3".repeat(40),"prompt":"fixture","prompt_digest":"f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d","body":"fixture"})).unwrap()
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
        at: None,
    }
}

/// The record without D-143's write-time stamp, which no caller rebuilding a
/// record from the dispatch can observe. The stamp is asserted where it lands.
fn undated(mut record: DecisionRecord) -> DecisionRecord {
    record.at = None;
    record
}

#[test]
fn routed_builder_binds_the_literal_model_agent_and_config_input_to_identity() {
    let mut ids = std::collections::BTreeSet::new();
    for (model, rung, agent) in [
        (Some("sonnet"), "high", "cad-executor"),
        (Some("opus"), "xhigh", "cad-executor-xhigh"),
        (None, "high", "cad-executor"),
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
            build_routed_dispatch(&plan(), &"2".repeat(64), 0, &"3".repeat(40), route).unwrap();
        let choice = &answer.route.as_ref().unwrap().choice;
        assert_eq!(
            (choice.agent.as_str(), choice.model.as_deref(), answer.policy.rung),
            (
                agent,
                model,
                if rung == "high" {
                    ExecutorRung::High
                } else {
                    ExecutorRung::Xhigh
                }
            )
        );
        // The identity binds the route: no two different routes share one.
        assert!(ids.insert(answer.id), "two different routes share an identity");
    }
}

#[test]
fn routing_decision_returns_the_exact_record_without_observed_effort_or_receipt() {
    let written = routing_decision(&dispatch(), Some(1_700_000_000)).unwrap().unwrap();
    assert_eq!(written.at, Some(1_700_000_000), "{written:?}");
    assert_eq!(undated(written), record());
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
    let answer = PreparedAnswer::new(cadence::envelope::Envelope::Ok(Success::dispatch(&dispatch())))
    .unwrap();
    assert_eq!(
        answer.receipt,
        Receipt::Dispatch {
            dispatch_id: DISPATCH_ID.into(),
            prompt_bytes: None,
            prompt_digest: "f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d".into()
        }
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
fn completed_route_resolver_keeps_saved_spending_for_separate_generations() {
    use cadence::{
        config::{
            merge,
            reload::{Generation, Input},
        },
        config_service::{RouteRequest, resolve_route},
    };
    for (number, model, effort, expected_agent) in [
        (18, json!("sonnet"), "high", "cad-executor"),
        (19, json!("opus"), "xhigh", "cad-executor-xhigh"),
        (20, Value::Null, "high", "cad-executor"),
    ] {
        let generation = Generation {
            number,
            global: None,
            repo: Input {
                identity: "/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: merge::merge(
                None,
                Some(
                    json!({"roles":{"cad-executor":{"model":model,"effort":effort}},"review":{"triggers":{"plan":{"gate":"off"}}}}),
                ),
                false,
            ),
        };
        let result = resolve_route(
            &generation,
            &RouteRequest {
                role: "cad-executor".into(),
                phase: None,
                plan: None,
                attempt: None,
            },
        )
        .unwrap();
        assert_eq!(
            (
                result.generation,
                result.choice.agent.as_str(),
                result.choice.rung.as_str(),
                result.choice.model.as_deref(),
                result.choice.model_source.kind.as_str(),
                result.choice.effort_source.layer.as_str()
            ),
            (
                number,
                expected_agent,
                effort,
                match number {
                    18 => Some("sonnet"),
                    19 => Some("opus"),
                    _ => None,
                },
                if number == 20 { "reset" } else { "role" },
                "repo"
            )
        );
    }
}

#[derive(Clone)]
struct SuppliedConfig(cadence::store::Result<cadence::config::reload::Input>);
impl cadence::config::reload::ConfigIo for SuppliedConfig {
    fn identity(&mut self, path: &std::path::Path) -> cadence::store::Result<std::path::PathBuf> {
        Ok(path.into())
    }
    fn read(
        &mut self,
        _: &std::path::Path,
    ) -> cadence::store::Result<cadence::config::reload::Input> {
        self.0.clone()
    }
}

#[test]
fn final_reload_compares_bytes_presence_identity_stamp_and_alias_without_generation_numbers() {
    use cadence::config::reload::{Input, Paths, Reload};
    use cadence::execution::model::{ConfigInput, ConfigInputs};
    let expected = ConfigInputs {
        repo: ConfigInput {
            identity: "/project/config.json".into(),
            content: Some(
                "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a".into(),
            ),
            stamp: Some((1, 2, 33188)),
        },
        global: None,
        global_alias: false,
    };
    for (identity, bytes, stamp, alias, result) in [
        (
            "/project/config.json",
            Some(b"{}".as_slice()),
            Some((1, 2, 33188)),
            false,
            Ok(1),
        ),
        (
            "/project/config.json",
            Some(b"{ }".as_slice()),
            Some((1, 2, 33188)),
            false,
            Err(cadence::store::Error::Conflict(
                "routing inputs changed before admission".into(),
            )),
        ),
        (
            "/other/config.json",
            Some(b"{}".as_slice()),
            Some((1, 2, 33188)),
            false,
            Err(cadence::store::Error::Conflict(
                "routing inputs changed before admission".into(),
            )),
        ),
        (
            "/project/config.json",
            None,
            None,
            false,
            Err(cadence::store::Error::Conflict(
                "routing inputs changed before admission".into(),
            )),
        ),
        (
            "/project/config.json",
            Some(b"{}".as_slice()),
            Some((1, 3, 33188)),
            false,
            Err(cadence::store::Error::Conflict(
                "routing inputs changed before admission".into(),
            )),
        ),
        (
            "/project/config.json",
            Some(b"{}".as_slice()),
            Some((1, 2, 33188)),
            true,
            Err(cadence::store::Error::Conflict(
                "routing inputs changed before admission".into(),
            )),
        ),
    ] {
        let mut reload = Reload::new(
            Paths {
                repo: "/project/config.json".into(),
                global: alias.then(|| "/project/config.json".into()),
            },
            SuppliedConfig(Ok(Input {
                identity: identity.into(),
                bytes: bytes.map(Vec::from),
                stamp,
            })),
        );
        assert_eq!(
            reload
                .refresh_expected(&expected)
                .map(|generation| generation.number),
            result
        );
    }
}

#[test]
fn final_reload_preserves_failed_io_refusal() {
    use cadence::config::reload::{Paths, Reload};
    let route: DispatchRoute = serde_json::from_str(ROUTE).unwrap();
    let mut reload = Reload::new(
        Paths {
            repo: "/project/config.json".into(),
            global: None,
        },
        SuppliedConfig(Err(cadence::store::Error::Io(
            "injected read denial".into(),
        ))),
    );
    assert_eq!(
        reload.refresh_expected(&route.inputs),
        Err(cadence::store::Error::Io("injected read denial".into()))
    );
}

#[test]
fn final_reload_rejects_independent_model_reset_and_waiver_changes() {
    use cadence::config::reload::{Input, Paths, Reload};
    use cadence::execution::model::{ConfigInput, ConfigInputs};
    for (before, after, global) in [
        (
            br#"{"roles":{"cad-executor":{"model":"sonnet"}}}"#.as_slice(),
            br#"{"roles":{"cad-executor":{"model":"opus"}}}"#.as_slice(),
            false,
        ),
        (
            br#"{"roles":{"cad-executor":{"model":"opus"}}}"#.as_slice(),
            br#"{"roles":{"cad-executor":{"model":"null"}}}"#.as_slice(),
            false,
        ),
        (
            br#"{"roles":{"cad-executor":{"model":"opus"}}}"#.as_slice(),
            br#"{"roles":{"cad-executor":{"model":null}}}"#.as_slice(),
            true,
        ),
        (
            br#"{"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}}"#.as_slice(),
            br#"{"review":{"triggers":{"risk_surface":{"waive_routing_floor":["auth"]}}}}"#
                .as_slice(),
            false,
        ),
    ] {
        let input = ConfigInput {
            identity: "/project/config.json".into(),
            content: Some(cadence::store::model::digest(before)),
            stamp: None,
        };
        let expected = ConfigInputs {
            repo: input.clone(),
            global: global.then_some(input),
            global_alias: false,
        };
        let mut reload = Reload::new(
            Paths {
                repo: "/project/config.json".into(),
                global: global.then(|| "/global/config.json".into()),
            },
            SuppliedConfig(Ok(Input {
                identity: "/project/config.json".into(),
                bytes: Some(after.to_vec()),
                stamp: None,
            })),
        );
        assert_eq!(
            reload.refresh_expected(&expected),
            Err(cadence::store::Error::Conflict(
                "routing inputs changed before admission".into()
            ))
        );
    }
}

const EMPTY_STATE: &[u8] = br#"{"version":1,"generation":0,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","data":{},"operations":{},"integrity":"e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"}"#;

fn admission() -> cadence::store::writer::Operation {
    use cadence::execution::{
        boundary::{BoundaryScope, BoundaryV1},
        model::BoundaryTool,
    };
    use cadence::store::writer::{BoundaryChange, Operation};
    let mut candidate = dispatch();
    candidate.expected_execution_version = 0;
    Operation::BoundaryV1 {
        expected_generation: 0,
        expected_integrity: "e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"
            .into(),
        operation_id: "fixture-admission".into(),
        decision: BoundaryV1 {
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
                prompt_bytes: None,
                prompt_digest: "f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d".into(),
            },
            lease_refusal: None,
            located: None,
        },
        change: Box::new(BoundaryChange::Dispatch {
            plan_set_fingerprint: "2".repeat(64),
            dispatch: candidate,
        }),
    }
}

fn canonical_wire(value: &Value) -> Vec<u8> {
    match value {
        Value::Object(fields) => format!(
            "{{{}}}",
            fields
                .iter()
                .collect::<std::collections::BTreeMap<_, _>>()
                .into_iter()
                .map(|(key, value)| format!(
                    "{}:{}",
                    serde_json::to_string(key).unwrap(),
                    String::from_utf8(canonical_wire(value)).unwrap()
                ))
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        Value::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(|value| String::from_utf8(canonical_wire(value)).unwrap())
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        _ => serde_json::to_vec(value).unwrap(),
    }
}

fn wire_unit(defect: &str) -> (Vec<u8>, Vec<u8>, String) {
    use cadence::store::model::digest;
    let boundary = json!({"codec":1,"scope":{"scope":"execution","phase":8},"tool":"cadence-query","operation":"execute-next","request_digest":"4".repeat(64),"outcome":"dispatch","subject_id":DISPATCH_ID,"response_digest":"281a096470439f1147be2843416cd400f527c633d0b92704b50e4eec81b38b96","receipt":{"receipt":"dispatch","dispatch_id":DISPATCH_ID,"prompt_digest":"f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d"}});
    let boundary_id = digest(&canonical_wire(&json!(["boundary-envelope-v1", boundary])));
    let mut routing = json!({"version":1,"id":format!("routing:{DISPATCH_ID}"),"revision":1,"origin":{"source":"native-routing","original":"missing"},"decision":{"class":"routing","choice":"{\"agent\":\"cad-executor\",\"rung\":\"high\",\"model\":\"sonnet\"}","config_provenance":{"dispatch_id":{"text":DISPATCH_ID},"route":{"text":ROUTE}},"requested_effort":{"text":"high"},"observed_effort":"missing","receipt":"missing"}});
    match defect {
        "effort" => routing["decision"]["requested_effort"] = json!({"text":"max"}),
        "model" => {
            routing["decision"]["choice"] =
                json!("{\"agent\":\"cad-executor\",\"rung\":\"high\",\"model\":\"opus\"}")
        }
        "provenance" => routing["decision"]["config_provenance"]["route"] = json!({"text":"{}"}),
        "observation" => routing["decision"]["observed_effort"] = json!({"text":"high"}),
        "receipt" => routing["decision"]["receipt"] = json!({"text":"invented"}),
        _ => {}
    }
    let mut records = if defect == "missing" {
        String::new()
    } else {
        serde_json::to_string(&routing).unwrap() + "\n"
    };
    records.push_str(&(serde_json::to_string(&json!({"version":1,"id":boundary_id,"revision":1,"origin":{"source":"execution-boundary-v1","original":"missing"},"decision":{"class":"boundary_v1","boundary":boundary,"store_generation":1,"terminal":false}})).unwrap()+"\n"));
    let active = json!({"schema":1,"id":DISPATCH_ID,"expected_execution_version":1,"phase":8,"plan":1,"plan_fingerprint":"1".repeat(64),"plan_set_fingerprint":"2".repeat(64),"requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],"suite":"verify","files":["src/a.rs"],"policy":{"rung":"high","branch":"current","reviews":"disabled"},"route":serde_json::from_str::<Value>(ROUTE).unwrap(),"base_sha":"3".repeat(40),"prompt":"fixture","prompt_digest":"f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d"});
    let mut state = json!({"version":1,"generation":1,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":digest(records.as_bytes()),"data":{"execution":{"schema":1,"occurrences":{"8":{"phase":8,"plan_set_fingerprint":"2".repeat(64),"version":1,"active":active,"plans":[],"terminal":null,"receipts":{}}}}},"operations":{},"integrity":""});
    state["integrity"] = json!(digest(&serde_json::to_vec(&state).unwrap()));
    (
        records.into_bytes(),
        serde_json::to_vec(&state).unwrap(),
        boundary_id,
    )
}

/// A target as a store directory holds it: `bytes` under the file identity
/// `identity`, in the one store directory.
fn observed(bytes: &[u8], identity: &str) -> cadence::store::Observed {
    cadence::store::Observed {
        bytes: Some(bytes.to_vec()),
        identity: identity.into(),
        directory_identity: "store".into(),
    }
}

type Current = std::collections::BTreeMap<String, cadence::store::Observed>;

/// A dispatch intent over the empty store, as the writer journals it, and each
/// target as recovery finds it after the first `installed` of its two changed
/// participants were renamed in. A rename gives the file a new identity.
fn pending_unit(defect: &str, installed: usize) -> (Vec<u8>, Current, Vec<u8>, Vec<u8>) {
    use cadence::store::model::digest;
    let (decisions, state, id) = wire_unit(defect);
    let participants = [
        ("items.jsonl", b"".as_slice(), Vec::new()),
        ("decisions.jsonl", b"".as_slice(), decisions.clone()),
        ("state.json", EMPTY_STATE, state.clone()),
    ]
    .into_iter()
    .map(|(target, before, bytes)| {
        json!({"target":target,"expected":{"bytes":before,"identity":format!("{target} before"),"directory_identity":"store"},"bytes":bytes})
    })
    .collect::<Vec<_>>();
    let kind = json!({"operation":"execution-dispatch-v1","phase":8,"decision_id":id});
    let integrity = digest(&serde_json::to_vec(&json!([1, kind, participants])).unwrap());
    let intent = serde_json::to_vec(
        &json!({"version":1,"kind":kind,"participants":participants,"integrity":integrity}),
    )
    .unwrap();
    let mut current = Current::from([
        ("items.jsonl".to_owned(), observed(b"", "items.jsonl before")),
        ("decisions.jsonl".to_owned(), observed(b"", "decisions.jsonl before")),
        ("state.json".to_owned(), observed(EMPTY_STATE, "state.json before")),
    ]);
    if installed >= 1 {
        current.insert("decisions.jsonl".into(), observed(&decisions, "decisions.jsonl after"));
    }
    if installed >= 2 {
        current.insert("state.json".into(), observed(&state, "state.json after"));
    }
    (intent, current, decisions, state)
}

#[test]
fn recovery_returns_the_exact_unit_from_independent_interruption_states() {
    use cadence::process::Recorded;
    use cadence::store::transaction::{Pending, recovery};
    for installed in [0, 1, 2] {
        let (intent, current, decisions, state) = pending_unit("valid", installed);
        let unit = recovery(Pending::parse(&intent).unwrap(), &current, &mut Recorded::new())
            .unwrap();
        assert_eq!(
            unit.participants()
                .iter()
                .map(|participant| (participant.target.as_str(), participant.bytes.clone()))
                .collect::<Vec<_>>(),
            vec![
                ("items.jsonl", Vec::new()),
                ("decisions.jsonl", decisions),
                ("state.json", state)
            ],
            "installed {installed}"
        );
    }
}

#[test]
fn recovery_refuses_semantically_incomplete_units_even_with_recomputed_digests() {
    use cadence::process::Recorded;
    use cadence::store::{
        Error,
        transaction::{Pending, recovery},
    };
    for defect in [
        "missing",
        "effort",
        "model",
        "provenance",
        "observation",
        "receipt",
    ] {
        let (intent, current, _, _) = pending_unit(defect, 0);
        assert_eq!(
            recovery(Pending::parse(&intent).unwrap(), &current, &mut Recorded::new())
                .map(|_| ()),
            Err(Error::Invalid(
                "dispatch lacks its exact routing decision".into()
            )),
            "{defect}"
        );
    }
}

#[test]
fn replay_requires_the_matching_dispatch_boundary_in_addition_to_routing() {
    use cadence::store::{
        model::Snapshot,
        writer::{View, require_current_execution},
    };
    let (records, state, _) = wire_unit("valid");
    let mut view = View {
        snapshot: serde_json::from_slice::<Snapshot>(&state).unwrap(),
        items: vec![],
        decisions: cadence::store::model::parse_lines(&records).unwrap(),
    };
    if let Decision::BoundaryV1(value) = &mut view.decisions[1].decision {
        value.boundary.subject_id = Some("unrelated".into());
    }
    assert_eq!(
        require_current_execution(&view),
        Err(cadence::execution::boundary::Failure::RoutingEvidence)
    );
}

#[test]
fn replay_accepts_the_independently_persisted_historical_route_unit() {
    use cadence::store::writer::{View, require_current_execution};
    let (records, state, _) = wire_unit("valid");
    let view = View {
        snapshot: serde_json::from_slice(&state).unwrap(),
        items: vec![],
        decisions: cadence::store::model::parse_lines(&records).unwrap(),
    };
    assert_eq!(require_current_execution(&view), Ok(()));
}

#[test]
fn duplicate_admission_is_a_replay_of_the_confirmed_operation() {
    use cadence::store::{
        model::digest,
        writer::{Operation, boundary_operation},
    };
    let (records, state, _) = wire_unit("valid");
    let state: Value = serde_json::from_slice(&state).unwrap();
    let boundary: Value =
        serde_json::from_slice(records.split(|byte| *byte == b'\n').nth(1).unwrap()).unwrap();
    let mut candidate = state["data"]["execution"]["occurrences"]["8"]["active"].clone();
    candidate["expected_execution_version"] = json!(0);
    candidate["body"] = json!("fixture");
    // The fingerprint the first admission recorded, encoded from the wire.
    let confirmed = std::collections::BTreeMap::from([(
        "fixture-admission".to_owned(),
        digest(&serde_json::to_vec(&json!(["boundary-operation-v1", boundary["decision"]["boundary"], {"Dispatch":{"plan_set_fingerprint":"2".repeat(64),"dispatch":candidate}}])).unwrap()),
    )]);
    let Operation::BoundaryV1 {
        operation_id,
        decision,
        change,
        ..
    } = admission()
    else {
        unreachable!()
    };
    assert_eq!(
        boundary_operation(&confirmed, &operation_id, &decision, &change),
        Ok(None)
    );
}

struct SavedCase {
    model: Option<&'static str>,
    rung: &'static str,
    stored: &'static str,
    route: &'static str,
    id: &'static str,
}
const SAVED: [SavedCase; 3] = [
    SavedCase {
        model: Some("sonnet"),
        rung: "high",
        stored: r#"{
  "roles": {
    "cad-executor": {
      "model": "sonnet",
      "effort": "high"
    }
  }
}"#,
        route: r#"{"choice":{"role":"cad-executor","agent":"cad-executor","rung":"high","starting_rung":"high","model":"sonnet","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"high"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"sonnet"},"attempt":1,"escalated":false,"pinned":false,"reasons":["roles.cad-executor.effort: role from repo; starting rung high","roles.cad-executor.model: role from repo; sonnet"],"warnings":[]},"inputs":{"repo":{"identity":"/project/.planning/config.v4.json","content":"26f39647895f5607ad04a8e5cad9e1fa67c304e1014fc5f74708fb7fbb8ad282","stamp":null},"global":null,"global_alias":false}}"#,
        id: "fb5d0571637ee342cdc0b4719132195e477a085c9bc3d1c45d4f4d5f24ba07bd",
    },
    SavedCase {
        model: Some("opus"),
        rung: "xhigh",
        stored: r#"{
  "roles": {
    "cad-executor": {
      "model": "opus",
      "effort": "xhigh"
    }
  }
}"#,
        route: r#"{"choice":{"role":"cad-executor","agent":"cad-executor-xhigh","rung":"xhigh","starting_rung":"xhigh","model":"opus","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"xhigh"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"opus"},"attempt":1,"escalated":false,"pinned":false,"reasons":["roles.cad-executor.effort: role from repo; starting rung xhigh","roles.cad-executor.model: role from repo; opus"],"warnings":[]},"inputs":{"repo":{"identity":"/project/.planning/config.v4.json","content":"37024e43a0630149ea71e1a283911411fab1287744e69195f688c55bccc023c4","stamp":null},"global":null,"global_alias":false}}"#,
        id: "95bfd239172b542536fdc88fb2cd0ccaf0bb9d6d31e8c67442368e56e2c66cbc",
    },
    SavedCase {
        model: None,
        rung: "xhigh",
        stored: r#"{
  "roles": {
    "cad-executor": {
      "model": null,
      "effort": "xhigh"
    }
  }
}"#,
        route: r#"{"choice":{"role":"cad-executor","agent":"cad-executor-xhigh","rung":"xhigh","starting_rung":"xhigh","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"xhigh"},"model_source":{"kind":"reset","key":"roles.cad-executor.model","layer":"repo","stored":null},"attempt":1,"escalated":false,"pinned":false,"reasons":["roles.cad-executor.effort: role from repo; starting rung xhigh","roles.cad-executor.model: reset from repo; omit model; inherit session"],"warnings":[]},"inputs":{"repo":{"identity":"/project/.planning/config.v4.json","content":"0a500276235db1450dbb6d6ca088ddd8b7d794d72e91206892b7b89fefc66ba4","stamp":null},"global":null,"global_alias":false}}"#,
        id: "afa483fa5f82bd58b20ef660b53ceac308f2b3fa1fed50e5f1cdde01e4bfcb77",
    },
];

#[test]
fn saved_generation_resolves_literal_sources_resets_and_reason_trails() {
    use cadence::{
        config::{
            merge,
            reload::{Generation, Input},
        },
        config_service::{RouteRequest, resolve_route},
    };
    for case in &SAVED {
        let supplied = Generation {
            number: 8,
            repo: Input {
                identity: "/project/.planning/config.v4.json".into(),
                bytes: Some(case.stored.as_bytes().to_vec()),
                stamp: None,
            },
            global: None,
            effective: merge::merge(
                None,
                Some(serde_json::from_str(case.stored).unwrap()),
                false,
            ),
        };
        let answer = resolve_route(
            &supplied,
            &RouteRequest {
                role: "cad-executor".into(),
                phase: None,
                plan: None,
                attempt: None,
            },
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(answer.choice).unwrap(),
            serde_json::from_str::<Value>(case.route).unwrap()["choice"]
        );
    }
}

fn saved_dispatch(case: &SavedCase) -> ActiveDispatch {
    let mut supplied = dispatch();
    supplied.id = case.id.into();
    supplied.policy.rung = if case.rung == "high" {
        ExecutorRung::High
    } else {
        ExecutorRung::Xhigh
    };
    supplied.route = Some(Box::new(serde_json::from_str(case.route).unwrap()));
    supplied
}

#[test]
fn each_new_admission_returns_the_exact_saved_choice_and_missing_host_evidence() {
    use cadence::store::writer::{Operation, View, admit_boundary_dispatch};
    for case in &SAVED {
        let mut supplied = saved_dispatch(case);
        supplied.expected_execution_version = 0;
        let Operation::BoundaryV1 { mut decision, .. } = admission() else {
            unreachable!()
        };
        decision.subject_id = Some(case.id.into());
        decision.receipt = Receipt::Dispatch {
            dispatch_id: case.id.into(),
            prompt_bytes: None,
            prompt_digest: "f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d".into(),
        };
        let mut next = View {
            snapshot: serde_json::from_slice(EMPTY_STATE).unwrap(),
            items: vec![],
            decisions: vec![],
        };
        admit_boundary_dispatch(&mut next, &decision, "2".repeat(64), supplied, None).unwrap();
        let expected_choice = match case.model {
            Some("sonnet") => r#"{"agent":"cad-executor","rung":"high","model":"sonnet"}"#,
            Some("opus") => r#"{"agent":"cad-executor-xhigh","rung":"xhigh","model":"opus"}"#,
            None => r#"{"agent":"cad-executor-xhigh","rung":"xhigh"}"#,
            _ => unreachable!(),
        };
        assert_eq!(
            (
                next.snapshot.data["execution"]["occurrences"]["8"]["active"]["id"].clone(),
                next.decisions
            ),
            (
                json!(case.id),
                vec![DecisionRecord {
                    version: 1,
                    id: format!("routing:{}", case.id),
                    revision: 1,
                    origin: Origin {
                        source: "native-routing".into(),
                        original: Evidence::Missing
                    },
                    decision: Decision::Routing {
                        choice: expected_choice.into(),
                        config_provenance: [
                            ("dispatch_id".into(), Evidence::Text(case.id.into())),
                            ("route".into(), Evidence::Text(case.route.into()))
                        ]
                        .into(),
                        requested_effort: Evidence::Text(case.rung.into()),
                        observed_effort: Evidence::Missing,
                        receipt: Evidence::Missing
                    },
                    at: None
                }]
            )
        );
    }
}

#[test]
fn changed_content_under_a_recorded_operation_id_is_refused() {
    use cadence::store::{Error, model::digest, writer::{Operation, boundary_operation}};
    let Operation::BoundaryV1 { operation_id, decision, change, .. } = admission() else {
        unreachable!()
    };
    let recorded = boundary_operation(&Default::default(), &operation_id, &decision, &change).unwrap().unwrap();
    let confirmed = std::collections::BTreeMap::from([(operation_id.clone(), recorded)]);
    let mut changed = decision.clone();
    changed.request_digest = digest(b"another request");
    assert_eq!(
        boundary_operation(&confirmed, &operation_id, &changed, &change),
        Err(Error::Conflict("operation identity reused for different content".into()))
    );
}

#[test]
fn a_routed_dispatch_answer_carries_its_route() {
    use cadence::execution::{boundary::Success, model::ActiveDispatch};
    let (_, state, _) = wire_unit("valid");
    let state: Value = serde_json::from_slice(&state).unwrap();
    let mut active = state["data"]["execution"]["occurrences"]["8"]["active"].clone();
    active["body"] = json!("fixture");
    let active: ActiveDispatch = serde_json::from_value(active).unwrap();
    assert!(active.route.is_some());
    let Success::Dispatch { route, .. } = Success::dispatch(&active) else {
        panic!("not a dispatch answer")
    };
    assert_eq!(route, active.route);
}

/// The routed dispatch the wire fixture admits, with a plan body.
fn routed_dispatch() -> cadence::execution::model::ActiveDispatch {
    let (_, state, _) = wire_unit("valid");
    let state: Value = serde_json::from_slice(&state).unwrap();
    let mut active = state["data"]["execution"]["occurrences"]["8"]["active"].clone();
    active["body"] = json!("Build the thing.\n");
    serde_json::from_value(active).unwrap()
}

/// The prompt as specified, section by section, with `lease` as the lease
/// paragraph when there is one.
fn specified_prompt(dispatch: &cadence::execution::model::ActiveDispatch, schema: &Value, lease: &str) -> String {
    let operational = serde_json::to_string_pretty(&cadence::execution::render::prompt_operational(dispatch)).unwrap();
    format!(
        "Cadence native execution dispatch\n\nOperational input:\n{operational}\n\nExecutor patch schema:\n{}\n\nInstructions:\n{}\n\n\
Complete tasks in listed order. Use one distinct signed commit per completed task. Run each task's exact verification commands and the suite. \
Return exactly one executor patch matching this schema. Stop at the first blocker and mark all later tasks not-run.{lease}\n\n\
Opaque plan body (17 UTF-8 bytes):\nBuild the thing.\n",
        serde_json::to_string_pretty(schema).unwrap(),
        cadence::read::instructions::CONTRACT,
    )
}

#[test]
fn the_dispatch_prompt_without_the_lease_section_is_the_specified_bytes() {
    let dispatch = routed_dispatch();
    let schema = json!({"type": "object"});
    assert_eq!(
        cadence::execution::render::render_dispatch_prompt(&dispatch, &schema, false),
        specified_prompt(&dispatch, &schema, "")
    );
}

#[test]
fn the_dispatch_prompt_with_the_lease_section_is_the_specified_bytes() {
    let dispatch = routed_dispatch();
    let schema = json!({"type": "object"});
    let lease = "\nThe lease has zero exemptions: all reported commit paths and the whole staged set must be covered by files or directories, \
including both rename endpoints, new files, lockfiles and reports. A repairable mistake within this lease is not a blocker; correct it and rerun \
the required verification. If an undeclared-files refusal occurs, stop execution, preserve the rejected SHAs and request operator-controlled repair. \
Cadence leaves Git and the index untouched and the dispatch open. Do not push, reset, amend, revert or force-push automatically. After operator \
repair, resubmit a corrected full patch with the same dispatch ID and execution version, within the unchanged lease and plan fingerprint. An \
undeclared necessary file requires an operator planning correction; changing the lease or body cannot repair this active dispatch.";
    assert_eq!(
        cadence::execution::render::render_dispatch_prompt(&dispatch, &schema, true),
        specified_prompt(&dispatch, &schema, lease)
    );
}

