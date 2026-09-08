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

fn seed_empty(root: &std::path::Path) {
    std::fs::write(root.join("state.json"), EMPTY_STATE).unwrap();
    std::fs::write(root.join("items.jsonl"), b"").unwrap();
    std::fs::write(root.join("decisions.jsonl"), b"").unwrap();
}

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
                prompt_bytes: 7,
            },
            lease_refusal: None,
        },
        change: Box::new(BoundaryChange::Dispatch {
            plan_set_fingerprint: "2".repeat(64),
            dispatch: candidate,
        }),
    }
}

#[test]
fn each_routing_persistence_failure_returns_no_confirmed_admission() {
    use cadence::store::{
        Error,
        filesystem::{Filesystem, Stage},
        writer::{PlanningPolicy, Store},
    };
    for (stage, target, occurrence) in [
        (Stage::Writing, "decisions.jsonl", 1),
        (Stage::TemporarySync, ".store-intent.json", 1),
        (Stage::Renamed, "decisions.jsonl", 1),
        (Stage::Renamed, "state.json", 1),
        (Stage::Confirmation, "state.json", 1),
        (Stage::Confirmation, ".store-intent.json", 1),
        (Stage::DirectorySync, "intent-removal", 1),
    ] {
        let root = tempfile::tempdir().unwrap();
        seed_empty(root.path());
        let mut seen = 0;
        let intent_path = root.path().join(".store-intent.json");
        let storage = Filesystem::new(root.path())
            .unwrap()
            .with_probe(move |at, path| {
                let selected = match stage {
                    Stage::TemporarySync => path.file_name().is_some_and(|name| {
                        name.to_string_lossy().starts_with("..store-intent.json.")
                    }),
                    Stage::DirectorySync => !intent_path.exists(),
                    _ => path.file_name().is_some_and(|name| name == target),
                };
                if at == stage && selected {
                    seen += 1;
                    if seen == occurrence {
                        return Err(Error::Io("injected routing persistence failure".into()));
                    }
                }
                Ok(())
            });
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let store = Store::open(storage, PlanningPolicy).await.unwrap();
            assert_eq!(
                store.request(admission()).await,
                Err(Error::Io("injected routing persistence failure".into()))
            );
        });
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
    let boundary = json!({"codec":1,"scope":{"scope":"execution","phase":8},"tool":"cadence-query","operation":"execute-next","request_digest":"4".repeat(64),"outcome":"dispatch","subject_id":DISPATCH_ID,"response_digest":"281a096470439f1147be2843416cd400f527c633d0b92704b50e4eec81b38b96","receipt":{"receipt":"dispatch","dispatch_id":DISPATCH_ID,"prompt_bytes":7}});
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
    let active = json!({"schema":1,"id":DISPATCH_ID,"expected_execution_version":1,"phase":8,"plan":1,"plan_fingerprint":"1".repeat(64),"plan_set_fingerprint":"2".repeat(64),"requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],"suite":"verify","files":["src/a.rs"],"policy":{"rung":"high","branch":"current","reviews":"disabled"},"route":serde_json::from_str::<Value>(ROUTE).unwrap(),"base_sha":"3".repeat(40),"prompt_bytes":7});
    let mut state = json!({"version":1,"generation":1,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":digest(records.as_bytes()),"data":{"execution":{"schema":1,"occurrences":{"8":{"phase":8,"plan_set_fingerprint":"2".repeat(64),"version":1,"active":active,"plans":[],"terminal":null,"receipts":{}}}}},"operations":{},"integrity":""});
    state["integrity"] = json!(digest(&serde_json::to_vec(&state).unwrap()));
    (
        records.into_bytes(),
        serde_json::to_vec(&state).unwrap(),
        boundary_id,
    )
}

fn pending_unit(root: &std::path::Path, defect: &str, installed: usize) -> (Vec<u8>, Vec<u8>) {
    use cadence::store::{Storage, filesystem::Filesystem, model::digest};
    seed_empty(root);
    let (decisions, state, id) = wire_unit(defect);
    let mut fs = Filesystem::new(root).unwrap();
    let participants = [("items.jsonl", Vec::new()), ("decisions.jsonl", decisions.clone()), ("state.json", state.clone())].into_iter().map(|(target, bytes)| {
        let observed = fs.read(target).unwrap();
        json!({"target":target,"expected":{"bytes":observed.bytes,"identity":observed.identity,"directory_identity":observed.directory_identity},"bytes":bytes})
    }).collect::<Vec<_>>();
    let kind = json!({"operation":"execution-dispatch-v1","phase":8,"decision_id":id});
    let integrity = digest(&serde_json::to_vec(&json!([1, kind, participants])).unwrap());
    std::fs::write(
        root.join(".store-intent.json"),
        serde_json::to_vec(
            &json!({"version":1,"kind":kind,"participants":participants,"integrity":integrity}),
        )
        .unwrap(),
    )
    .unwrap();
    if installed >= 1 {
        std::fs::write(root.join("decisions.jsonl"), &decisions).unwrap();
    }
    if installed >= 2 {
        std::fs::write(root.join("state.json"), &state).unwrap();
    }
    (decisions, state)
}

#[test]
fn recovery_returns_the_exact_unit_from_independent_interruption_states() {
    use cadence::store::{
        filesystem::Filesystem,
        writer::{PlanningPolicy, Store},
    };
    for installed in [0, 1, 2] {
        let root = tempfile::tempdir().unwrap();
        let (decisions, state) = pending_unit(root.path(), "valid", installed);
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let answer = Store::open(Filesystem::new(root.path()).unwrap(), PlanningPolicy).await;
            assert_eq!(
                (
                    answer.map(|_| ()),
                    std::fs::read(root.path().join("decisions.jsonl")).unwrap(),
                    std::fs::read(root.path().join("state.json")).unwrap(),
                    root.path().join(".store-intent.json").exists()
                ),
                (Ok(()), decisions, state, false)
            );
        });
    }
}

#[test]
fn recovery_refuses_semantically_incomplete_units_even_with_recomputed_digests() {
    use cadence::store::{
        Error,
        filesystem::Filesystem,
        writer::{PlanningPolicy, Store},
    };
    for defect in [
        "missing",
        "effort",
        "model",
        "provenance",
        "observation",
        "receipt",
    ] {
        let root = tempfile::tempdir().unwrap();
        pending_unit(root.path(), defect, 0);
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            assert_eq!(
                Store::open(Filesystem::new(root.path()).unwrap(), PlanningPolicy)
                    .await
                    .map(|_| ()),
                Err(Error::Invalid(
                    "dispatch lacks its exact routing decision".into()
                ))
            );
        });
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
fn duplicate_request_returns_the_single_previously_confirmed_routing_record() {
    use cadence::store::{
        filesystem::Filesystem,
        model::digest,
        writer::{PlanningPolicy, Store},
    };
    let root = tempfile::tempdir().unwrap();
    let (records, state, _) = wire_unit("valid");
    let mut state: Value = serde_json::from_slice(&state).unwrap();
    let boundary: Value =
        serde_json::from_slice(records.split(|byte| *byte == b'\n').nth(1).unwrap()).unwrap();
    let mut candidate = state["data"]["execution"]["occurrences"]["8"]["active"].clone();
    candidate["expected_execution_version"] = json!(0);
    candidate["body"] = json!("fixture");
    state["operations"]["fixture-admission"] = json!(digest(&serde_json::to_vec(&json!(["boundary-operation-v1", boundary["decision"]["boundary"], {"Dispatch":{"plan_set_fingerprint":"2".repeat(64),"dispatch":candidate}}])).unwrap()));
    state["integrity"] = json!("");
    state["integrity"] = json!(digest(&serde_json::to_vec(&state).unwrap()));
    std::fs::write(root.path().join("items.jsonl"), b"").unwrap();
    std::fs::write(root.path().join("decisions.jsonl"), records).unwrap();
    std::fs::write(
        root.path().join("state.json"),
        serde_json::to_vec(&state).unwrap(),
    )
    .unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), PlanningPolicy)
            .await
            .unwrap();
        let answer = store.request(admission()).await.unwrap();
        assert_eq!(
            (
                answer.snapshot.generation,
                answer
                    .decisions
                    .iter()
                    .filter(|record| matches!(record.decision, Decision::Routing { .. }))
                    .cloned()
                    .collect::<Vec<_>>()
            ),
            (1, vec![record()])
        );
    });
}
