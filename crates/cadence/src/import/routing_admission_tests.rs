use super::*;
use crate::config::reload::{Input, Paths, Reload};
use cadence::execution::model::{ConfigInput, ConfigInputs};

#[derive(Clone)]
struct InputIo;
impl ConfigIo for InputIo {
    fn read(&mut self, path: &Path) -> Result<Input> {
        Ok(Input {
            identity: path.into(),
            bytes: Some(b"{}".to_vec()),
            stamp: None,
        })
    }
}

fn policy() -> SessionPolicy<InputIo> {
    SessionPolicy {
        config: Arc::new(Mutex::new(Reload::new(
            Paths {
                repo: "/project/config.json".into(),
                global: None,
            },
            InputIo,
        ))),
        importing: Arc::new(Mutex::new(None)),
        io: InputIo,
        evaluate: Arc::new(crate::config::planning_policy),
    }
}

#[test]
fn new_admission_refuses_a_different_captured_input() {
    let snapshot =
        cadence::store::model::Snapshot::new(1, b"", b"", serde_json::json!({})).unwrap();
    let inputs = ConfigInputs {
        repo: ConfigInput {
            identity: "/project/config.json".into(),
            content: None,
            stamp: None,
        },
        global: None,
        global_alias: false,
    };
    assert_eq!(
        policy().validate_routing_admission(
            &MutationContext {
                operation: "boundary_v1",
                snapshot: &snapshot
            },
            &inputs
        ),
        Err(Error::Conflict(
            "routing inputs changed before admission".into()
        ))
    );
}

#[test]
fn recovery_only_requires_current_config_usability() {
    let snapshot = cadence::store::model::Snapshot::new(
        1,
        b"",
        b"",
        serde_json::json!({"execution":{"historical_route":"different inputs"}}),
    )
    .unwrap();
    assert_eq!(
        policy().validate(&MutationContext {
            operation: "recovery",
            snapshot: &snapshot
        }),
        Ok(())
    );
}
#[test]
fn final_intent_preparation_cannot_admit_a_stale_route() {
    use cadence::execution::boundary::{BoundaryScope, BoundaryV1, Receipt};
    use cadence::store::filesystem::{Filesystem, Stage};
    use cadence::store::writer::BoundaryChange;
    use serde_json::json;
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("state.json"), r#"{"version":1,"generation":0,"items_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","decisions_digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","data":{},"operations":{},"integrity":"e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"}"#).unwrap();
    std::fs::write(root.path().join("items.jsonl"), b"").unwrap();
    std::fs::write(root.path().join("decisions.jsonl"), b"").unwrap();
    let config_path = root.path().join("config.json");
    std::fs::write(&config_path, b"{}").unwrap();
    let mut expected = Reload::new(
        Paths {
            repo: config_path.clone(),
            global: None,
        },
        FileIo,
    )
    .refresh()
    .unwrap()
    .routing_inputs();
    expected.repo.content =
        Some("44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a".into());
    let dispatch = serde_json::from_value(json!({"schema":1,"id":"d".repeat(64),"expected_execution_version":0,"phase":8,"plan":1,
        "plan_fingerprint":"1".repeat(64),"plan_set_fingerprint":"2".repeat(64),"requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],"suite":"verify","files":["src/a.rs"],"policy":{"rung":"high","branch":"current","reviews":"disabled"},
        "route":{"choice":{"role":"cad-executor","agent":"cad-executor","rung":"high","starting_rung":"high","model":"sonnet","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"high"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"sonnet"},"attempt":1,"escalated":false,"pinned":false,"reasons":["fixture selection"],"warnings":[]},"inputs":expected},"base_sha":"3".repeat(40),"prompt_bytes":7,"body":"fixture"})).unwrap();
    let policy = SessionPolicy {
        config: Arc::new(Mutex::new(Reload::new(
            Paths {
                repo: config_path.clone(),
                global: None,
            },
            FileIo,
        ))),
        importing: Arc::new(Mutex::new(None)),
        io: FileIo,
        evaluate: Arc::new(crate::config::planning_policy),
    };
    let storage = Filesystem::new(root.path())
        .unwrap()
        .with_probe(move |stage, path| {
            if stage == Stage::Prepared
                && path
                    .file_name()
                    .is_some_and(|name| name == ".store-intent.json")
            {
                std::fs::write(
                    &config_path,
                    br#"{"roles":{"cad-executor":{"model":"opus"}}}"#,
                )?;
            }
            Ok(())
        });
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(storage, policy).await.unwrap();
        assert_eq!(
            store
                .request(Operation::BoundaryV1 {
                    expected_generation: 0,
                    expected_integrity:
                        "e9756a2c9107069a015c009d174bacbc989df7121a7646ecc1a770afdfbf35bd"
                            .into(),
                    operation_id: "fixture-admission".into(),
                    decision: BoundaryV1 {
                        codec: 1,
                        scope: BoundaryScope::Execution { phase: 8 },
                        tool: cadence::execution::model::BoundaryTool::CadenceQuery,
                        operation: "execute-next".into(),
                        request_digest: "4".repeat(64),
                        outcome: "dispatch".into(),
                        subject_id: Some("d".repeat(64)),
                        response_digest: "5".repeat(64),
                        receipt: Receipt::Dispatch {
                            dispatch_id: "d".repeat(64),
                            prompt_bytes: 7
                        },
                        lease_refusal: None
                    },
                    change: Box::new(BoundaryChange::Dispatch {
                        plan_set_fingerprint: "2".repeat(64),
                        dispatch
                    })
                })
                .await,
            Err(Error::Conflict(
                "routing inputs changed before admission".into()
            ))
        );
    });
}
