use super::*;
use crate::config::reload::{Input, Paths, Reload};
use cadence::execution::model::{ConfigInput, ConfigInputs};

#[derive(Clone)]
struct InputIo;
impl ConfigIo for InputIo {
    fn identity(&mut self, path: &Path) -> Result<std::path::PathBuf> {
        Ok(path.into())
    }
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
        // A retained active dispatch routed on inputs that no longer match the
        // current config: the place a route comparison would have to read.
        serde_json::json!({"execution":{"schema":1,"occurrences":{"8":{"phase":8,"active":{
            "route":{"inputs":{"repo":{"identity":"/elsewhere/config.json","content":"0".repeat(64),"stamp":null},
                "global":null,"global_alias":false}}}}}}}),
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
/// The config as it reads after a route was captured against `{}`.
#[derive(Clone)]
struct ChangedIo;
impl ConfigIo for ChangedIo {
    fn identity(&mut self, path: &Path) -> Result<std::path::PathBuf> {
        Ok(path.into())
    }
    fn read(&mut self, path: &Path) -> Result<Input> {
        Ok(Input {
            identity: path.into(),
            bytes: Some(br#"{"roles":{"cad-executor":{"model":"opus"}}}"#.to_vec()),
            stamp: None,
        })
    }
}

fn policy_with<I: ConfigIo + Clone>(io: I) -> SessionPolicy<I> {
    SessionPolicy {
        config: Arc::new(Mutex::new(Reload::new(
            Paths {
                repo: "/project/config.json".into(),
                global: None,
            },
            io.clone(),
        ))),
        importing: Arc::new(Mutex::new(None)),
        io,
        evaluate: Arc::new(crate::config::planning_policy),
    }
}

/// The dispatch a prospective snapshot admits carries the route it was chosen
/// on; the final preparation rechecks that route's captured inputs, and a
/// config that changed since then refuses the admission.
#[test]
fn final_intent_preparation_cannot_admit_a_stale_route() {
    use serde_json::json;
    let captured = ConfigInputs {
        repo: ConfigInput {
            identity: "/project/config.json".into(),
            content: Some(cadence::store::model::digest(b"{}")),
            stamp: None,
        },
        global: None,
        global_alias: false,
    };
    let dispatch = json!({"schema":1,"id":"d".repeat(64),"expected_execution_version":0,"phase":8,"plan":1,
        "plan_fingerprint":"1".repeat(64),"plan_set_fingerprint":"2".repeat(64),"requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],"suite":"verify","files":["src/a.rs"],"policy":{"rung":"high","branch":"current","reviews":"disabled"},
        "route":{"choice":{"role":"cad-executor","agent":"cad-executor","rung":"high","starting_rung":"high","model":"sonnet","effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"high"},"model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"sonnet"},"attempt":1,"escalated":false,"pinned":false,"reasons":["fixture selection"],"warnings":[]},"inputs":captured},"base_sha":"3".repeat(40),"prompt":"fixture","prompt_digest":"f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d","body":"fixture"});
    let snapshot = cadence::store::model::Snapshot::new(
        1,
        b"",
        b"",
        json!({"execution":{"schema":1,"occurrences":{"8":{"phase":8,"plan_set_fingerprint":"2".repeat(64),
            "version":1,"active":dispatch,"plans":[],"terminal":null,"receipts":{}}}}}),
    )
    .unwrap();
    let route = cadence::store::transaction::active_route(&snapshot, 8)
        .unwrap()
        .expect("the phase 8 dispatch carries its route");
    assert_eq!(route.inputs, captured);
    let context = MutationContext {
        operation: "boundary_v1",
        snapshot: &snapshot,
    };
    assert_eq!(
        policy_with(ChangedIo).validate_routing_admission(&context, &route.inputs),
        Err(Error::Conflict(
            "routing inputs changed before admission".into()
        ))
    );
    assert_eq!(
        policy_with(InputIo).validate_routing_admission(&context, &route.inputs),
        Ok(())
    );
}
