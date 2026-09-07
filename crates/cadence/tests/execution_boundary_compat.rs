//! Independent wire fixtures and real recovery evidence for the boundary format.
use cadence::envelope::Envelope;
use cadence::execution::{
    boundary::{BoundaryScope, BoundaryV1, PreparedAnswer},
    model::BoundaryTool,
};
use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{self, DECISIONS, Decision, DecisionRecord, ITEMS, STATE, Snapshot};
use cadence::store::transaction::INTENT;
use cadence::store::writer::{BoundaryChange, Operation, Store};
use cadence::store::{Error, MutationContext, Policy, Result, Storage};
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

// These builders spell the 2aa77d64 wire format independently of the domain
// serializers: store/model.rs, store/transaction.rs and execution/model.rs.
// Only filesystem observations vary by fixture directory. In particular the
// old integrity preimages are ordered JSON, never canonical-envelope JSON.
const OLD_ITEMS: &[u8] = b"{\"version\":1,\"id\":\"item-3\",\"revision\":1,\"origin\":{\"source\":\"CAPTURE.md\",\"original\":{\"text\":\"original capture\"}},\"text\":\"retained item\",\"kind\":\"todo\",\"disposition\":{\"status\":\"captured\"},\"completed\":false,\"filing_uncertain\":false}\n";
const OLD_GATE: &[u8] = b"{\"version\":1,\"id\":\"gate-5\",\"revision\":1,\"origin\":{\"source\":\"evidence\",\"original\":\"missing\"},\"decision\":{\"class\":\"gate\",\"outcome\":\"accepted\",\"evidence\":{\"text\":\"source evidence\"}}}\n";

fn old_data() -> Value {
    json!({"import":{"manifest":["CAPTURE.md"],"provenance":{"CAPTURE.md":"original"}},
        "lifecycle":{"memo":{"phase":6,"status":"planned"}},
        "evidence":{"permissions":["E1"]},"pause":{"pending":true},
        "unrelated":{"ordered":[null,1,{"keep":"日本語"}]}})
}

fn old_snapshot(data: Value, decisions: &[u8], generation: u64) -> Vec<u8> {
    let mut state = json!({"version":1,"generation":generation,
        "items_digest":model::digest(OLD_ITEMS),"decisions_digest":model::digest(decisions),
        "data":data,"operations":{"old-operation":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},"integrity":""});
    state["integrity"] = json!(model::digest(&serde_json::to_vec(&state).unwrap()));
    serde_json::to_vec(&state).unwrap()
}

fn old_boundary(outcome: &str, generation: u64, response: Value) -> Value {
    let patch = matches!(outcome, "complete" | "judgment-stop");
    let mut preimage = json!({"phase":6,"tool":if patch {"cadence-apply"} else {"cadence-query"},
        "operation":if patch {"executor"} else {"execute-next"},
        "request_digest":model::digest(format!("old-{generation}").as_bytes()),"outcome":outcome,
        "subject_id":if outcome == "refused:invalid-plan" {Value::Null} else {json!("old-dispatch")},
        "prompt_bytes":if outcome == "dispatch" {json!(512)} else {Value::Null},
        "response_digest":model::digest(&serde_json::to_vec(&response).unwrap())});
    let id = model::digest(&serde_json::to_vec(&json!(["boundary", preimage])).unwrap());
    let prompt = preimage
        .as_object_mut()
        .unwrap()
        .shift_remove("prompt_bytes")
        .unwrap();
    let digest = preimage
        .as_object_mut()
        .unwrap()
        .shift_remove("response_digest")
        .unwrap();
    let mut decision = json!({"class":"boundary"});
    decision
        .as_object_mut()
        .unwrap()
        .extend(preimage.as_object().unwrap().clone());
    decision["store_generation"] = json!(generation);
    decision["prompt_bytes"] = prompt;
    decision["response_digest"] = digest;
    decision["terminal"] = json!(false);
    json!({"version":1,"id":id,"revision":1,"origin":{"source":"execution-boundary","original":"missing"},"decision":decision})
}

fn line(value: &Value) -> Vec<u8> {
    let mut bytes = serde_json::to_vec(value).unwrap();
    bytes.push(b'\n');
    bytes
}

fn old_fixture(case: &str) -> (Value, Vec<(String, Vec<u8>)>) {
    let mut decisions = OLD_GATE.to_vec();
    let mut data = old_data();
    let mut generation = 1;
    let mut summary = None;
    let kind = match case {
        "store" => json!({"operation":"store"}),
        "refusal" | "terminal" => json!({"operation":"execution-refusal","phase":6}),
        "dispatch" => json!({"operation":"execution-dispatch","phase":6}),
        "accepted" | "blocked" => {
            json!({"operation":"execution-patch","phase":6,"render_version":1,"summary":true})
        }
        "patch-no-summary" => {
            json!({"operation":"execution-patch","phase":6,"render_version":1,"summary":false})
        }
        _ => panic!("unknown old fixture: {case}"),
    };
    if matches!(case, "refusal" | "terminal" | "patch-no-summary") {
        for _ in 0..if case == "terminal" { 256 } else { 1 } {
            generation += 1;
            decisions.extend(line(&old_boundary(
                "refused:invalid-plan",
                generation,
                json!({"outcome":"refused","phase":6,"code":"invalid-plan","reason":"old refusal"}),
            )));
        }
        if case == "terminal" {
            generation += 1;
            let identity = model::digest(b"execution-log-bound:6");
            decisions.extend(line(&json!({"version":1,"id":identity,"revision":1,
                "origin":{"source":"execution-boundary","original":"missing"},
                "decision":{"class":"boundary","phase":6,"tool":"cadence-boundary","operation":"execution",
                    "request_digest":identity,"outcome":"log-bound","subject_id":null,"store_generation":generation,
                    "prompt_bytes":null,"response_digest":identity,"terminal":true}})));
        }
    } else if case != "store" {
        let dispatch = json!({"schema":1,"id":"old-dispatch","expected_execution_version":1,"phase":6,"plan":1,
            "plan_fingerprint":"a".repeat(64),"plan_set_fingerprint":"b".repeat(64),"requirements":["AC4"],
            "tasks":[{"id":"T1","verify":["verify-T1"]}],"suite":"suite-command","files":["src/a.rs"],
            "policy":{"rung":"fixed","branch":"current","reviews":"disabled"},
            "base_sha":"1".repeat(40),"prompt_bytes":512,"body":""});
        generation += 1;
        decisions.extend(line(&old_boundary(
            "dispatch",
            generation,
            json!({"outcome":"dispatch","dispatch":dispatch,"prompt":"x".repeat(512)}),
        )));
        let mut occurrence = json!({"phase":6,"plan_set_fingerprint":"b".repeat(64),"version":1,
            "active":dispatch,"plans":[],"terminal":null,"receipts":{}});
        if case != "dispatch" {
            let blocked = case == "blocked";
            let tasks = if blocked {
                json!([{"status":"blocked","task_id":"T1","blocker_id":"B1"}])
            } else {
                json!([{"status":"completed","task_id":"T1","commit":"2".repeat(40),
                    "verification":{"disposition":"passed","commands":[{"command":"verify-T1","exit_code":0,"output_digest":"d".repeat(64)}]},
                    "evidence":[{"kind":"commit","sha":"2".repeat(40)}]}])
            };
            let outcome = json!({"dispatch_id":"old-dispatch","phase":6,"plan":1,"disposition":if blocked {"blocked"} else {"complete"},
                "tasks":tasks,"deviations":[],"blockers":if blocked {json!([{"id":"B1","text":"old judgment","evidence":[{"kind":"criterion","id":"AC4"}]}])} else {json!([])},
                "commit_paths":if blocked {json!({})} else {json!({"2222222222222222222222222222222222222222":["src/a.rs"]})},"transition_id":"old-transition"});
            occurrence["version"] = json!(2);
            occurrence["active"] = Value::Null;
            occurrence["plans"] = if blocked { json!([]) } else { json!([outcome]) };
            occurrence["terminal"] = if blocked {
                json!({"status":"judgment-stop","dispatch_id":"old-dispatch","blocker_ids":["B1"]})
            } else {
                json!({"status":"complete","phase":6})
            };
            occurrence["receipts"] = json!({"old-dispatch":{"dispatch_id":"old-dispatch","request_digest":"e".repeat(64),"transition_id":"old-transition","outcome":outcome}});
            generation += 1;
            decisions.extend(line(&old_boundary(if blocked {"judgment-stop"} else {"complete"}, generation,
                if blocked {json!({"outcome":"judgment-stop","phase":6,"dispatch_id":"old-dispatch","blocker_ids":["B1"]})} else {json!({"outcome":"complete","phase":6})})));
            let row = if blocked {
                "| 1 | T1 | blocked |  | not-passed |".into()
            } else {
                format!("| 1 | T1 | completed | {} | passed |", "2".repeat(40))
            };
            summary = Some(format!("# Phase 6 Execution Summary\n\nSchema: 1\nStatus: {}\n\n| Plan | Task | Status | Commit | Verification |\n|---|---|---|---|---|\n{row}\n\nDeviation references: none\nBlocker references: {}\n", if blocked {"blocked"} else {"complete"}, if blocked {"B1"} else {"none"}).into_bytes());
        }
        data["execution"] = json!({"schema":1,"occurrences":{"6":occurrence}});
    }
    let state = old_snapshot(data, &decisions, generation);
    // Prove original integrity before asking the new reader to interpret it.
    let mut original: Value = serde_json::from_slice(&state).unwrap();
    let integrity = original["integrity"].take();
    original["integrity"] = json!("");
    assert_eq!(
        integrity,
        model::digest(&serde_json::to_vec(&original).unwrap())
    );
    let mut files = vec![
        (ITEMS.into(), OLD_ITEMS.to_vec()),
        (DECISIONS.into(), decisions),
    ];
    if let Some(summary) = summary {
        files.push(("phase-summary:6".into(), summary));
    }
    files.push((STATE.into(), state));
    (kind, files)
}

fn target(root: &Path, name: &str) -> std::path::PathBuf {
    root.join(if name == "phase-summary:6" {
        "phases/6/SUMMARY.md"
    } else {
        name
    })
}

fn install_old_intent(root: &Path, kind: Value, files: &[(String, Vec<u8>)]) -> Vec<u8> {
    std::fs::create_dir_all(root.join("phases/6")).unwrap();
    let mut storage = Filesystem::new(root).unwrap();
    let participants: Vec<_> = files.iter().map(|(name, bytes)| {
        let observed = storage.read(name).unwrap();
        json!({"target":name,"expected":{"bytes":observed.bytes,"identity":observed.identity,"directory_identity":observed.directory_identity},"bytes":bytes})
    }).collect();
    let mut intent = json!({"version":1,"kind":kind,"participants":participants,"integrity":""});
    seal_intent(&mut intent);
    let bytes = serde_json::to_vec(&intent).unwrap();
    std::fs::write(root.join(INTENT), &bytes).unwrap();
    bytes
}

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}
async fn open(root: &Path) -> Result<Store> {
    Store::open(Filesystem::new(root).unwrap(), Allow).await
}
fn refusal(unique: &str) -> BoundaryV1 {
    BoundaryV1::new(
        BoundaryScope::RootRefusal,
        BoundaryTool::CadenceQuery,
        "execute-next".into(),
        model::digest(unique.as_bytes()),
        None,
        &PreparedAnswer::new(Envelope::Refused {
            code: "invalid-input".into(),
            reason: "invalid execution input".into(),
        })
        .unwrap(),
    )
}
fn canonical(value: &Value) -> Vec<u8> {
    match value {
        Value::Object(object) => format!(
            "{{{}}}",
            object
                .iter()
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .map(|(k, v)| format!(
                    "{}:{}",
                    serde_json::to_string(k).unwrap(),
                    String::from_utf8(canonical(v)).unwrap()
                ))
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        Value::Array(array) => format!(
            "[{}]",
            array
                .iter()
                .map(|v| String::from_utf8(canonical(v)).unwrap())
                .collect::<Vec<_>>()
                .join(",")
        )
        .into_bytes(),
        _ => serde_json::to_vec(value).unwrap(),
    }
}
fn wire_record(boundary: Value, generation: u64, terminal: bool) -> Value {
    let id = model::digest(&canonical(&json!(["boundary-envelope-v1", boundary])));
    json!({"version":1,"id":id,"revision":1,"origin":{"source":"execution-boundary-v1","original":"missing"},
        "decision":{"class":"boundary_v1","boundary":boundary,"store_generation":generation,"terminal":terminal}})
}
fn validate(values: Vec<Value>) -> bool {
    let bytes = values
        .iter()
        .map(|v| serde_json::to_string(v).unwrap() + "\n")
        .collect::<String>();
    let records = model::parse_lines::<DecisionRecord>(bytes.as_bytes());
    records
        .and_then(|records| model::validate_decisions(&records))
        .is_ok()
}

#[test]
fn legacy_record_snapshot_and_operation_receipt_encodings_round_trip_and_mix() {
    // Literal field order and encodings from baseline 2aa77d64, before envelope receipts.
    let legacy = br#"{"version":1,"id":"old-refusal","revision":1,"origin":{"source":"execution-boundary","original":"missing"},"decision":{"class":"boundary","phase":6,"tool":"cadence-query","operation":"execute-next","request_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","outcome":"refused:invalid-plan","subject_id":null,"store_generation":1,"prompt_bytes":null,"response_digest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","terminal":false}}"#;
    let record: DecisionRecord = serde_json::from_slice(legacy).unwrap();
    assert_eq!(serde_json::to_vec(&record).unwrap(), legacy);
    model::validate_decisions(&[record]).unwrap();
    assert!(!validate(vec![
        json!({"version":1,"id":"unknown","revision":1,"origin":{"source":"old"},"decision":{"class":"boundary_v99"}})
    ]));
    let root = tempfile::tempdir().unwrap();
    let decisions = b"{\"version\":1,\"id\":\"gate-5\",\"revision\":1,\"origin\":{\"source\":\"evidence\",\"original\":\"missing\"},\"decision\":{\"class\":\"gate\",\"outcome\":\"accepted\",\"evidence\":{\"text\":\"source evidence\"}}}\n";
    let mut snapshot = json!({"version":1,"generation":1,"items_digest":model::digest(b""),"decisions_digest":model::digest(decisions),
        "data":{"import":{"manifest":["legacy"],"provenance":"retained"},"lifecycle":{"memo":"retained"},"evidence":{"permissions":["E1"]},"pause":{"pending":true},"other":[null,1]},
        "operations":{"old-operation":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},"integrity":""});
    snapshot["integrity"] = json!(model::digest(&serde_json::to_vec(&snapshot).unwrap()));
    let bytes = serde_json::to_vec(&snapshot).unwrap();
    assert_eq!(
        Snapshot::parse(&bytes, b"", decisions)
            .unwrap()
            .render()
            .unwrap(),
        bytes
    );
    std::fs::write(root.path().join(ITEMS), b"").unwrap();
    std::fs::write(root.path().join(DECISIONS), decisions).unwrap();
    std::fs::write(root.path().join(STATE), &bytes).unwrap();
    runtime().block_on(async {
        let store = open(root.path()).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let updated = store
            .request(Operation::BoundaryV1 {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity,
                operation_id: "new-refusal".into(),
                decision: refusal("new"),
                change: Box::new(BoundaryChange::Observe),
            })
            .await
            .unwrap();
        assert_eq!(updated.snapshot.data, snapshot["data"]);
        assert_eq!(updated.snapshot.operations["old-operation"], "c".repeat(64));
        assert!(
            std::fs::read(root.path().join(DECISIONS))
                .unwrap()
                .starts_with(decisions)
        );
        assert!(matches!(
            updated.decisions[0].decision,
            Decision::Gate { .. }
        ));
        drop(store);
        assert_eq!(
            open(root.path())
                .await
                .unwrap()
                .request(Operation::ReadVerified)
                .await
                .unwrap(),
            updated
        );
    });
}

#[test]
fn immutable_records_reject_duplicate_revisions_terminals_and_post_terminal_admissions() {
    let boundary = serde_json::to_value(refusal("one")).unwrap();
    let first = wire_record(boundary, 1, false);
    assert!(validate(vec![first.clone()]));
    assert!(!validate(vec![first.clone(), first.clone()]));
    let mut revision = first.clone();
    revision["revision"] = json!(2);
    assert!(!validate(vec![first.clone(), revision]));
    for field in [
        "codec",
        "scope",
        "response_digest",
        "receipt",
        "operation",
        "outcome",
    ] {
        let mut invalid = serde_json::to_value(refusal("invalid")).unwrap();
        invalid[field] = match field {
            "codec" => json!(99),
            "scope" => json!({"scope":"execution","phase":0}),
            "response_digest" => json!("d".repeat(64)),
            "receipt" => json!({"receipt":"unknown"}),
            _ => json!("wrong"),
        };
        assert!(!validate(vec![wire_record(invalid, 1, false)]), "{field}");
    }
    let mut history: Vec<_> = (0..256)
        .map(|i| {
            wire_record(
                serde_json::to_value(refusal(&i.to_string())).unwrap(),
                i + 1,
                false,
            )
        })
        .collect();
    let terminal_boundary =
        serde_json::to_value(BoundaryV1::terminal(BoundaryScope::RootRefusal).unwrap()).unwrap();
    let terminal = wire_record(terminal_boundary, 257, true);
    assert!(!validate(vec![terminal.clone()]));
    history.push(terminal.clone());
    assert!(validate(history.clone()));
    let mut second = history.clone();
    second.push(terminal);
    assert!(!validate(second));
    history.push(wire_record(
        serde_json::to_value(refusal("late")).unwrap(),
        258,
        false,
    ));
    assert!(!validate(history));
}

async fn pending_root(root: &Path) -> Value {
    let store = Store::open(
        Filesystem::new(root).unwrap().with_probe(|stage, path| {
            if stage == Stage::Confirmation && path.file_name().is_some_and(|name| name == INTENT) {
                Err(Error::Io("intent confirmation injected".into()))
            } else {
                Ok(())
            }
        }),
        Allow,
    )
    .await
    .unwrap();
    let view = store.request(Operation::Read).await.unwrap();
    assert!(
        store
            .request(Operation::BoundaryV1 {
                expected_generation: 0,
                expected_integrity: view.snapshot.integrity,
                operation_id: "pending-root".into(),
                decision: refusal("pending"),
                change: Box::new(BoundaryChange::Observe)
            })
            .await
            .is_err()
    );
    drop(store);
    serde_json::from_slice(&std::fs::read(root.join(INTENT)).unwrap()).unwrap()
}
fn seal_intent(intent: &mut Value) {
    intent["integrity"] = json!(model::digest(
        &serde_json::to_vec(&json!([
            intent["version"],
            intent["kind"],
            intent["participants"]
        ]))
        .unwrap()
    ));
}

#[test]
fn root_intent_rejects_unknown_scope_generation_receipt_targets_and_tampering_before_install() {
    for case in [
        "scope",
        "zero",
        "identity",
        "generation",
        "codec",
        "digest",
        "receipt",
        "target",
        "summary",
        "config",
        "format",
        "tamper",
    ] {
        let root = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            let mut intent = pending_root(root.path()).await;
            match case {
                "scope" => intent["kind"]["scope"] = json!({"scope":"execution","phase":6}),
                "zero" => intent["kind"]["scope"] = json!({"scope":"execution","phase":0}),
                "identity" => intent["kind"]["decision_id"] = json!("foreign"),
                "format" => intent["kind"]["operation"] = json!("boundary-observation-v99"),
                "target"|"summary"|"config" => {
                    let target = match case { "target"=>"../foreign", "summary"=>"phase-summary:6", _=>"repo-config" };
                    let mut participant = intent["participants"][0].clone(); participant["target"]=json!(target);
                    intent["participants"].as_array_mut().unwrap().insert(0,participant);
                }
                "generation"|"codec"|"digest"|"receipt" => {
                    let index = intent["participants"].as_array().unwrap().iter().position(|p|p["target"]==DECISIONS).unwrap();
                    let bytes: Vec<u8> = serde_json::from_value(intent["participants"][index]["bytes"].clone()).unwrap();
                    let mut record: Value = serde_json::from_slice(&bytes).unwrap();
                    match case {
                        "generation" => record["decision"]["store_generation"]=json!(2),
                        "codec" => record["decision"]["boundary"]["codec"]=json!(99),
                        "digest" => record["decision"]["boundary"]["response_digest"]=json!("0".repeat(64)),
                        _ => record["decision"]["boundary"]["receipt"]=json!({"receipt":"dispatch","dispatch_id":"foreign","prompt_bytes":5}),
                    }
                    let mut bytes = serde_json::to_vec(&record).unwrap(); bytes.push(b'\n');
                    intent["participants"][index]["bytes"] = json!(bytes);
                    let state_index = intent["participants"].as_array().unwrap().iter().position(|p| p["target"] == STATE).unwrap();
                    let state_bytes: Vec<u8> = serde_json::from_value(intent["participants"][state_index]["bytes"].clone()).unwrap();
                    let mut state: Value = serde_json::from_slice(&state_bytes).unwrap();
                    state["decisions_digest"] = json!(model::digest(&bytes));
                    state["integrity"] = json!("");
                    state["integrity"] = json!(model::digest(&serde_json::to_vec(&state).unwrap()));
                    intent["participants"][state_index]["bytes"] = json!(serde_json::to_vec(&state).unwrap());
                }
                _ => {}
            }
            seal_intent(&mut intent);
            if case=="tamper" { intent["integrity"]=json!("0".repeat(64)); }
            let encoded = serde_json::to_vec(&intent).unwrap();
            std::fs::write(root.path().join(INTENT), &encoded).unwrap();
            assert!(open(root.path()).await.is_err(), "accepted {case}");
            for target in [ITEMS, DECISIONS, STATE] { assert!(!root.path().join(target).exists(), "installed {target} in {case}"); }
            assert_eq!(std::fs::read(root.path().join(INTENT)).unwrap(),encoded);
        });
    }
}

fn compat_command(root: &Path, mode: &str) -> std::process::Command {
    let mut command = std::process::Command::new(std::env::current_exe().unwrap());
    command
        .args(["--exact", "compatibility_restart_child", "--nocapture"])
        .env("CADENCE_COMPAT_ROOT", root)
        .env("CADENCE_COMPAT_MODE", mode)
        .stdin(std::process::Stdio::null());
    command
}

#[test]
fn compatibility_restart_child() {
    use std::io::Write;
    let Some(root) = std::env::var_os("CADENCE_COMPAT_ROOT") else {
        return;
    };
    let root = Path::new(&root);
    let mode = std::env::var("CADENCE_COMPAT_MODE").unwrap();
    runtime().block_on(async {
        let storage = Filesystem::new(root).unwrap().with_probe(move |stage, path| {
            if mode == format!("{stage:?}:{}", path.file_name().unwrap().to_string_lossy()) {
                println!("COMPAT_BARRIER:{mode}");
                std::io::stdout().flush().unwrap();
                loop { std::thread::park(); }
            }
            Ok(())
        });
        let store = Store::open(storage, Allow).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let compatibility = cadence::store::writer::require_current_execution(&view);
        if compatibility.is_err() {
            assert_eq!(compatibility, Err(cadence::execution::boundary::Failure::LegacyExecution));
            let failure = store.request(Operation::BoundaryV1 {
                expected_generation:view.snapshot.generation,expected_integrity:view.snapshot.integrity.clone(),
                operation_id:"cross-format-resume".into(),decision:refusal("resume"),change:Box::new(BoundaryChange::Observe),
            }).await.unwrap_err();
            assert!(matches!(failure, Error::Invalid(ref reason) if reason == "cross-format native execution resume is unsupported"));
        }
        println!("COMPAT_RESULT {}", json!({"generation":view.snapshot.generation,"decisions":view.decisions.len(),"legacy_execution":compatibility.is_err()}));
    });
}

fn compat_read(root: &Path) -> Value {
    let output = compat_command(root, "read").output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_str(
        String::from_utf8(output.stdout)
            .unwrap()
            .lines()
            .find_map(|line| line.strip_prefix("COMPAT_RESULT "))
            .unwrap(),
    )
    .unwrap()
}

fn compat_kill(root: &Path, barrier: &str) {
    use std::io::{BufRead, BufReader};
    let mut child = compat_command(root, barrier)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let expected = format!("COMPAT_BARRIER:{barrier}");
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if line.unwrap() == expected {
                let _ = sender.send(());
                return;
            }
        }
    });
    let reached = receiver.recv_timeout(std::time::Duration::from_secs(10));
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    assert!(reached.is_ok(), "missed {barrier}");
    use std::os::unix::process::ExitStatusExt;
    assert_eq!(status.signal(), Some(libc::SIGKILL));
}

#[test]
fn legacy_native_formats_read_but_cross_format_resume_fails_without_rewriting_bytes() {
    for case in [
        "store", "dispatch", "accepted", "blocked", "refusal", "terminal",
    ] {
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(root.path().join("phases/6")).unwrap();
        let (_, files) = old_fixture(case);
        for (name, bytes) in &files {
            std::fs::write(target(root.path(), name), bytes).unwrap();
        }
        let first = compat_read(root.path());
        assert_eq!(first["legacy_execution"], case != "store", "{case}");
        assert_eq!(compat_read(root.path()), first);
        for (name, bytes) in &files {
            assert_eq!(
                std::fs::read(target(root.path(), name)).unwrap(),
                *bytes,
                "{case} {name}"
            );
        }
        assert!(!root.path().join(INTENT).exists());
    }
}

#[test]
fn legacy_each_pending_intent_recovers_original_bytes_once_after_repeated_process_death() {
    for case in [
        "store",
        "dispatch",
        "accepted",
        "blocked",
        "refusal",
        "terminal",
        "patch-no-summary",
    ] {
        let root = tempfile::tempdir().unwrap();
        let (kind, files) = old_fixture(case);
        let intent = install_old_intent(root.path(), kind, &files);
        compat_kill(root.path(), "Renamed:decisions.jsonl");
        assert!(!root.path().join(STATE).exists());
        assert_eq!(std::fs::read(root.path().join(INTENT)).unwrap(), intent);
        compat_kill(root.path(), "RecoverySync:decisions.jsonl");
        assert!(!root.path().join(STATE).exists());
        let first = compat_read(root.path());
        assert_eq!(compat_read(root.path()), first);
        for (name, bytes) in &files {
            assert_eq!(
                std::fs::read(target(root.path(), name)).unwrap(),
                *bytes,
                "{case} {name}"
            );
        }
        assert!(!root.path().join(INTENT).exists());
    }
}

#[test]
fn recovery_admits_identical_content_replacement_inode_under_original_directory_ancestry() {
    use std::os::unix::fs::MetadataExt;
    // D-28 deliberately applies to both legacy and envelope intent formats.
    for legacy in [true, false] {
        let root = tempfile::tempdir().unwrap();
        if legacy {
            let (kind, files) = old_fixture("store");
            install_old_intent(root.path(), kind, &files);
        } else {
            runtime().block_on(pending_root(root.path()));
        }
        compat_kill(root.path(), "Renamed:decisions.jsonl");
        let installed = root.path().join(DECISIONS);
        let before = std::fs::metadata(&installed).unwrap();
        let bytes = std::fs::read(&installed).unwrap();
        let replacement = root.path().join("replacement");
        std::fs::write(&replacement, &bytes).unwrap();
        std::fs::rename(replacement, &installed).unwrap();
        let after = std::fs::metadata(&installed).unwrap();
        assert_ne!((before.dev(), before.ino()), (after.dev(), after.ino()));
        assert!(!root.path().join(STATE).exists());
        let recovered = compat_read(root.path());
        assert!(root.path().join(STATE).exists());
        assert_eq!(std::fs::read(installed).unwrap(), bytes);
        assert_eq!(compat_read(root.path()), recovered);
        assert!(!root.path().join(INTENT).exists());
    }
}

#[test]
fn recovery_rejects_foreign_bytes_directory_ancestry_and_legacy_tampering_before_any_write() {
    for case in [
        "bytes",
        "directory",
        "version",
        "kind",
        "field",
        "integrity",
        "snapshot",
    ] {
        for legacy in [true, false] {
            let parent = tempfile::tempdir().unwrap();
            let root = parent.path().join("store");
            std::fs::create_dir(&root).unwrap();
            if legacy {
                let (kind, files) = old_fixture("accepted");
                install_old_intent(&root, kind, &files);
            } else {
                runtime().block_on(pending_root(&root));
            }
            let mut intent: Value =
                serde_json::from_slice(&std::fs::read(root.join(INTENT)).unwrap()).unwrap();
            match case {
                "bytes" => std::fs::write(root.join(STATE), b"foreign final participant").unwrap(),
                "directory" => {
                    std::fs::rename(&root, parent.path().join("old-directory")).unwrap();
                    std::fs::create_dir_all(root.join("phases/6")).unwrap();
                }
                "version" => intent["version"] = json!(99),
                "kind" => intent["kind"]["operation"] = json!("unknown"),
                "field" => intent["unexpected"] = json!(true),
                "snapshot" => {
                    let last = intent["participants"]
                        .as_array_mut()
                        .unwrap()
                        .last_mut()
                        .unwrap();
                    let bytes: Vec<u8> = serde_json::from_value(last["bytes"].clone()).unwrap();
                    let mut state: Value = serde_json::from_slice(&bytes).unwrap();
                    state["data"]["foreign"] = json!(true);
                    last["bytes"] = json!(serde_json::to_vec(&state).unwrap());
                }
                _ => {}
            }
            seal_intent(&mut intent);
            if case == "integrity" {
                intent["integrity"] = json!("0".repeat(64));
            }
            let bytes = serde_json::to_vec(&intent).unwrap();
            std::fs::write(root.join(INTENT), &bytes).unwrap();
            let paths = [ITEMS, DECISIONS, STATE, "phase-summary:6"];
            let before = paths.map(|name| std::fs::read(target(&root, name)).ok());
            let output = compat_command(&root, "read").output().unwrap();
            assert!(!output.status.success(), "accepted {case}, legacy={legacy}");
            assert!(!String::from_utf8_lossy(&output.stdout).contains("COMPAT_RESULT"));
            assert_eq!(
                paths.map(|name| std::fs::read(target(&root, name)).ok()),
                before
            );
            assert_eq!(std::fs::read(root.join(INTENT)).unwrap(), bytes);
        }
    }
}
