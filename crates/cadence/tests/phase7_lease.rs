//! Lease admission, ordering and Git-backed enforcement at native boundaries.
use cadence::execution::{
    dispatch::build_dispatch,
    lease::covers,
    model::{ActiveDispatch, ExecutionPlan},
    plan::{MAX_FIELD_BYTES, MAX_FIELDS, parse_plan, plan_set_fingerprint},
};
use cadence::store::{
    MutationContext, Policy, Result,
    filesystem::Filesystem,
    model::digest,
    writer::{Operation, Store, View},
};
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
};

#[path = "support/signing.rs"]
mod signing;

const BASE: &str = "1111111111111111111111111111111111111111";
const START: &str = "248bd8c668815e11c23e06cdc70c1d505eb82586";

fn source(number: u32, lease: &str) -> String {
    format!(
        "---\nphase: 7\nplan: {number}\nrequirements: [AC3]\n{lease}\nexecution:\n  schema: 1\n  suite: printf suite\n  tasks:\n    - id: T1\n      verify: [printf T1]\n---\nTask body\n"
    )
}

fn plan(lease: &str) -> ExecutionPlan {
    parse_plan(source(1, lease).as_bytes(), 7, 1).unwrap()
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

async fn open(root: &Path) -> Store {
    Store::open(Filesystem::new(root.join(".planning")).unwrap(), Allow)
        .await
        .unwrap()
}

struct Client {
    child: Child,
    input: ChildStdin,
    output: BufReader<std::process::ChildStdout>,
}
impl Client {
    fn new(root: &Path) -> Self {
        Self::with_path(root, None)
    }
    fn with_path(root: &Path, path: Option<&str>) -> Self {
        let mut command = Command::new(env!("CARGO_BIN_EXE_cadence"));
        if let Some(path) = path {
            command.env("PATH", path);
        }
        let mut child = command
            .args(["serve", "--project-root"])
            .arg(root)
            .env("CADENCE_GLOBAL_CONFIG", "")
            .env("GNUPGHOME", signing::home(root))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let input = child.stdin.take().unwrap();
        let output = BufReader::new(child.stdout.take().unwrap());
        let mut client = Self {
            child,
            input,
            output,
        };
        client.send(json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"lease-fixture","version":"1"}}}));
        let response = client.recv();
        assert!(response.get("error").is_none(), "{response}");
        client.send(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
        client
    }
    fn send(&mut self, value: Value) {
        writeln!(self.input, "{value}").unwrap();
        self.input.flush().unwrap();
    }
    fn recv(&mut self) -> Value {
        let mut line = String::new();
        assert_ne!(self.output.read_line(&mut line).unwrap(), 0);
        serde_json::from_str(&line).unwrap()
    }
    fn call(&mut self, tool: &str, input: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":tool,"arguments":input}}));
        let wire = self.recv();
        assert!(wire.get("error").is_none(), "{wire}");
        wire["result"]["structuredContent"].clone()
    }
    fn query(&mut self) -> Value {
        self.call(
            "cadence_query",
            json!({"operation":"execute-next","phase":7}),
        )
    }
    fn finish(mut self) {
        drop(self.input);
        assert!(self.child.wait().unwrap().success());
    }
}

struct Fixture {
    _temp: tempfile::TempDir,
    root: PathBuf,
}
impl Fixture {
    fn new(lease: &str) -> Self {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("repo");
        let key = signing::generate(&root);
        fs::create_dir_all(root.join(".planning/phases/7")).unwrap();
        fs::create_dir(root.join("src")).unwrap();
        fs::write(root.join("src/a.rs"), "initial\n").unwrap();
        fs::write(root.join(".gitignore"), ".planning/state.json\n.planning/items.jsonl\n.planning/decisions.jsonl\n.planning/config.v4.json\n.planning/phases/7/SUMMARY.md\n").unwrap();
        fs::write(
            root.join(".planning/ROADMAP.md"),
            "## Phases\n- [ ] **Phase 7: Source leases**\n",
        )
        .unwrap();
        fs::write(root.join(".planning/config.json"), serde_json::to_vec(&serde_json::json!({"review":{"triggers":{"risk_surface":{"surfaces":cadence::rail::risk::CATEGORIES}}}})).unwrap()).unwrap();
        fs::write(root.join(".planning/phases/7/PLAN-1.md"), source(1, lease)).unwrap();
        let fixture = Self { _temp: temp, root };
        fixture.git(&["init", "-q"]);
        for (name, value) in [
            ("user.name", "John Crenshaw"),
            ("user.email", "john@jcrenshaw.dev"),
            ("gpg.format", "openpgp"),
            ("gpg.program", "gpg"),
            ("user.signingkey", &key),
            ("commit.gpgsign", "true"),
        ] {
            fixture.git(&["config", "--local", name, value]);
        }
        fixture.git(&["add", "."]);
        fixture.git(&["commit", "-q", "-m", "test(7): initialize lease fixture"]);
        let mut client = fixture.client();
        let initial = client.call("cadence_query", Value::Null);
        assert_eq!(initial["status"], "refused", "{initial}");
        client.finish();
        fixture.seed_authority();
        fixture
    }
    fn git(&self, args: &[&str]) -> String {
        let output = Command::new("git")
            .args(args)
            .current_dir(&self.root)
            .env("GNUPGHOME", signing::home(&self.root))
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap().trim().to_owned()
    }
    fn client(&self) -> Client {
        Client::new(&self.root)
    }
    fn read(&self) -> View {
        runtime().block_on(async {
            open(&self.root)
                .await
                .request(Operation::ReadVerified)
                .await
                .unwrap()
        })
    }
    fn seed_authority(&self) {
        use cadence::{
            evidence::{Record, persistence},
            store::transaction::Transaction,
        };
        let planning = self.root.join(".planning");
        let mut record = json!({"version":1,"scope":{"project":self.root,"planning_root":planning,
            "cycle":"live","occurrence":"phase-7-execution","phase":"7","plan":"native-execution","report":"phases/7/SUMMARY.md"},
            "fact":{"kind":"gate","value":{"id":"fixture-progress","purpose":"progress","checkpoint_id":null,
                "question":"Continue?","need":"Execution authority","options":[],"state":{"status":"unanswered"}}}});
        runtime().block_on(async {
            let store = open(&self.root).await;
            for (index, state) in [json!({"status":"unanswered"}), json!({"status":"answered","value":{
                "question_id":"fixture-progress","actual_response":"Proceed","selected_option":null,"adjustment":null,
                "disposition":"approve","authorization_id":"fixture-authorization"}})].into_iter().enumerate() {
                record["fact"]["value"]["state"] = state;
                let native: Record = serde_json::from_value(record.clone()).unwrap();
                let view = store.request(Operation::ReadVerified).await.unwrap();
                let id = format!("fixture-authority-{index}");
                store.request(Operation::Transact(Transaction {id:id.clone(),items:vec![],
                    decisions:vec![persistence::history(&id, &native).unwrap()],
                    snapshot:Some(persistence::project(&view.snapshot.data, &native).unwrap()),external:vec![]})).await.unwrap();
            }
        });
    }
}

#[test]
fn admission_accepts_exact_and_directory_only_without_existence_checks() {
    let exact = plan("files: [./src//new.rs]");
    assert_eq!(exact.files, ["src/new.rs"]);
    assert!(exact.directories.is_empty());
    let directory = plan("files: []\ndirectories: ['./src//nested/', 'other\\root\\']");
    assert!(directory.files.is_empty());
    assert_eq!(directory.directories, ["src/nested", "other/root"]);
    assert!(covers(
        &directory.files,
        &directory.directories,
        "src/nested/new.rs"
    ));
    assert!(covers(
        &directory.files,
        &directory.directories,
        "src/nested"
    ));
    assert!(!covers(
        &directory.files,
        &directory.directories,
        "src/nested-other/a.rs"
    ));
    assert!(!covers(
        &exact.files,
        &exact.directories,
        "src/new.rs/child"
    ));
    assert!(!covers(&exact.files, &exact.directories, "src/new.rsx"));
    assert!(!covers(&exact.files, &exact.directories, "./src/new.rs"));
    assert!(!covers(&exact.files, &exact.directories, "src\\new.rs"));
}

#[test]
fn admission_rejects_trailing_file_separators_with_typed_field_error() {
    for path in ["src/", "src\\", "src//", "src/./"] {
        let error =
            parse_plan(source(1, &format!("files: ['{path}']")).as_bytes(), 7, 1).unwrap_err();
        assert_eq!(error.code, "invalid-path");
        assert!(error.detail.contains("files"));
        assert!(error.detail.contains("trailing"));
    }
}

#[test]
fn admission_rejects_malformed_duplicate_empty_and_over_limit_leases() {
    for lease in [
        "files: []",
        "files: []\ndirectories: []",
        "directories: [src]",
        "files: src",
        "files: null",
        "files: []\ndirectories: null",
        "files: []\ndirectories: src",
        "files: []\ndirectories: {src: true}",
        "files: []\ndirectory: [src]",
        "files: [a]\ndirectories: [src]\ndirectories: [other]",
        "files: [a, ./a]",
        "files: []\ndirectories: [src, ./src/]",
        "files: ['../x']",
        "files: []\ndirectories: ['src/../x']",
        "files: []\ndirectories: ['/src']",
        "files: []\ndirectories: ['C:\\src']",
        "files: []\ndirectories: ['.']",
        "files: ['']",
        "files: []\ndirectories: ['']",
        "files: [\"a\\nb\"]",
    ] {
        assert!(
            parse_plan(source(1, lease).as_bytes(), 7, 1).is_err(),
            "accepted {lease}"
        );
    }
    let paths = (0..MAX_FIELDS)
        .map(|n| format!("p{n}"))
        .collect::<Vec<_>>()
        .join(", ");
    plan(&format!("files: [{paths}]"));
    let too_many = source(1, &format!("files: [{paths}]\ndirectories: [extra]"));
    assert_eq!(
        parse_plan(too_many.as_bytes(), 7, 1).unwrap_err().code,
        "field-bound"
    );
    for field in ["files", "directories"] {
        let lease = if field == "files" {
            format!("files: [{}]", "x".repeat(MAX_FIELD_BYTES + 1))
        } else {
            format!(
                "files: []\ndirectories: [{}]",
                "x".repeat(MAX_FIELD_BYTES + 1)
            )
        };
        let error = parse_plan(source(1, &lease).as_bytes(), 7, 1).unwrap_err();
        assert_eq!(error.code, "invalid-path");
        assert!(error.detail.contains(field));
    }
}

#[test]
fn independently_encoded_old_exact_dispatch_keeps_fingerprint_and_reopen_bytes() {
    let plan = plan("files: [src/a.rs]");
    let old_preimage = br#"{"phase":7,"plan":1,"requirements":["AC3"],"files":["src/a.rs"],"schema":1,"suite":"printf suite","tasks":[{"id":"T1","verify":["printf T1"]}],"body":[84,97,115,107,32,98,111,100,121,10]}"#;
    assert_eq!(plan.fingerprint, digest(old_preimage));
    let old_set = [b"[".as_slice(), old_preimage, b"]"].concat();
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    assert_eq!(set, digest(&old_set));
    let identity = json!({"schema":1,"execution_version":0,"phase":7,"plan":1,
        "plan_fingerprint":digest(old_preimage),"plan_set_fingerprint":digest(&old_set),"base_sha":BASE});
    let old = json!({"schema":1,"id":digest(&serde_json::to_vec(&identity).unwrap()),"expected_execution_version":0,
        "phase":7,"plan":1,"plan_fingerprint":digest(old_preimage),"plan_set_fingerprint":digest(&old_set),
        "requirements":["AC3"],"tasks":[{"id":"T1","verify":["printf T1"]}],"suite":"printf suite","files":["src/a.rs"],
        "policy":{"rung":"fixed","branch":"current","reviews":"disabled"},"base_sha":BASE,"prompt_bytes":512,"body":"Task body\n"});
    let bytes = serde_json::to_vec(&old).unwrap();
    let decoded: ActiveDispatch = serde_json::from_slice(&bytes).unwrap();
    assert!(decoded.directories.is_empty());
    assert_eq!(serde_json::to_vec(&decoded).unwrap(), bytes);
    assert_eq!(build_dispatch(&plan, &set, 0, BASE, 512).unwrap(), decoded);
    let temp = tempfile::tempdir().unwrap();
    fs::create_dir(temp.path().join(".planning")).unwrap();
    runtime().block_on(async {
        let store = open(temp.path()).await;
        store.request(Operation::RewriteSnapshot(json!({"execution":{"schema":1,"occurrences":{"7":{
            "phase":7,"plan_set_fingerprint":set,"version":0,"active":old,"plans":[],"terminal":null,"receipts":{}}}}}))).await.unwrap();
    });
    let before = fs::read(temp.path().join(".planning/state.json")).unwrap();
    runtime().block_on(async {
        let store = open(temp.path()).await;
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let active: ActiveDispatch = serde_json::from_value(
            view.snapshot.data["execution"]["occurrences"]["7"]["active"].clone(),
        )
        .unwrap();
        assert_eq!(serde_json::to_vec(&active).unwrap(), bytes);
    });
    assert_eq!(
        fs::read(temp.path().join(".planning/state.json")).unwrap(),
        before
    );
    assert_eq!(
        plan.fingerprint,
        self::plan("files: [src/a.rs]\ndirectories: []").fingerprint
    );
    assert_ne!(
        plan.fingerprint,
        self::plan("files: [src/a.rs]\ndirectories: [src]").fingerprint
    );
}

#[test]
fn public_prompt_carries_directory_lease_and_reopens_exactly() {
    for lease in ["files: [src/a.rs]", "files: []\ndirectories: [src/]"] {
        let fixture = Fixture::new(lease);
        let mut client = fixture.client();
        let first = client.query();
        assert_eq!(first["outcome"], "dispatch", "{first}");
        let prompt = first["prompt"].as_str().unwrap();
        if lease.contains("directories") {
            assert_eq!(first["dispatch"]["directories"], json!(["src"]));
            assert!(prompt.contains("\"directories\": [\n    \"src\"\n  ]"));
        } else {
            assert!(first["dispatch"].get("directories").is_none());
            assert!(!prompt.contains("\"directories\""));
        }
        client.finish();
        let before = fixture.read().snapshot.data["execution"].clone();
        let mut restarted = fixture.client();
        assert_eq!(restarted.query(), first);
        assert_eq!(fixture.read().snapshot.data["execution"], before);
        restarted.finish();
    }
}

#[test]
fn sole_production_coverage_definition_is_exercised() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    fn count(root: &Path) -> usize {
        fs::read_dir(root)
            .unwrap()
            .map(|entry| {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    count(&path)
                } else if path.extension().is_some_and(|ext| ext == "rs") {
                    fs::read_to_string(path)
                        .unwrap()
                        .split("#[cfg(test)]")
                        .next()
                        .unwrap()
                        .matches("fn covers(")
                        .count()
                } else {
                    0
                }
            })
            .sum()
    }
    assert_eq!(count(&root), 1);
    let admitted = plan("files: [file]\ndirectories: [src]");
    assert!(covers(&admitted.files, &admitted.directories, "src/child"));
    assert!(!covers(
        &admitted.files,
        &admitted.directories,
        "src-other/child"
    ));
    // This revision anchors the historical records; later tasks assert their bytes.
    assert_eq!(START.len(), 40);
}

fn graph(leases: &[(u32, &str)]) -> cadence::execution::plan::PlanGraph {
    let plans = leases
        .iter()
        .map(|(number, lease)| parse_plan(source(*number, lease).as_bytes(), 7, *number).unwrap())
        .collect::<Vec<_>>();
    cadence::execution::plan::PlanGraph::build(&plans).unwrap()
}

#[test]
fn ac4_directory_and_descendant_file_require_lower_number_first_in_either_direction() {
    use std::collections::BTreeSet;
    // The exact AC4 pair must fail if ordering regresses to files.contains.
    for (left, right) in [
        ("files: []\ndirectories: [src/]", "files: [src/shared.txt]"),
        ("files: [src/shared.txt]", "files: []\ndirectories: [src/]"),
        (
            "files: []\ndirectories: [src]",
            "files: []\ndirectories: [src/nested]",
        ),
        (
            "files: []\ndirectories: [src/nested]",
            "files: []\ndirectories: [src]",
        ),
        (
            "files: []\ndirectories: [src]",
            "files: []\ndirectories: [src/]",
        ),
        ("files: [src]", "files: []\ndirectories: [src]"),
    ] {
        for leases in [[(1, left), (2, right)], [(2, right), (1, left)]] {
            let graph = graph(&leases);
            assert_eq!(graph.prerequisites(1), Some(&BTreeSet::new()));
            assert_eq!(
                graph.prerequisites(2),
                Some(&BTreeSet::from([1])),
                "{leases:?}"
            );
            assert_eq!(graph.ready(&BTreeSet::new()), [1]);
            assert_eq!(graph.ready(&BTreeSet::from([1])), [2]);
        }
    }
}

#[test]
fn overlap_readiness_remains_transitive_and_deterministic() {
    use std::collections::BTreeSet;
    let graph = graph(&[
        (3, "files: []\ndirectories: [other/nested]"),
        (2, "files: [src/shared.txt, other/nested/a.rs]"),
        (1, "files: []\ndirectories: [src/]"),
    ]);
    assert_eq!(graph.prerequisites(2), Some(&BTreeSet::from([1])));
    assert_eq!(graph.prerequisites(3), Some(&BTreeSet::from([2])));
    assert_eq!(graph.ready(&BTreeSet::new()), [1]);
    assert_eq!(graph.ready(&BTreeSet::from([1])), [2]);
    assert_eq!(graph.ready(&BTreeSet::from([1, 2])), [3]);
    assert_eq!(graph.next_ready(&BTreeSet::from([1, 2])), Some(3));
}

#[test]
fn textual_prefixes_and_exact_files_never_create_recursive_overlap() {
    use std::collections::BTreeSet;
    let graph = graph(&[
        (5, "files: []\ndirectories: [other]"),
        (3, "files: [src-other/a.rs]"),
        (1, "files: []\ndirectories: [src]"),
        (2, "files: [exact]"),
        (4, "files: [exact/child]"),
    ]);
    assert_eq!(graph.ready(&BTreeSet::new()), [1, 2, 3, 4, 5]);
    assert_eq!(graph.next_ready(&BTreeSet::new()), Some(1));
    for number in 1..=5 {
        assert_eq!(graph.prerequisites(number), Some(&BTreeSet::new()));
    }
}

const COMMIT_1: &str = "2222222222222222222222222222222222222222";
const COMMIT_2: &str = "3333333333333333333333333333333333333333";

type CommitPaths = std::collections::BTreeMap<String, Vec<String>>;

fn writer_input(lease: &str, blocked: bool) -> (Value, cadence::execution::model::ExecutorPatch) {
    use cadence::execution::{dispatch::admit_dispatch, model::ExecutionOccurrence};
    let text = source(1, lease).replace(
        "---\nTask body",
        "    - id: T2\n      verify: [printf T2]\n---\nTask body",
    );
    let plan = parse_plan(text.as_bytes(), 7, 1).unwrap();
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    let candidate = build_dispatch(&plan, &set, 0, BASE, 512).unwrap();
    let occurrence = ExecutionOccurrence {
        phase: 7,
        plan_set_fingerprint: set,
        version: 0,
        active: None,
        plans: vec![],
        terminal: None,
        receipts: Default::default(),
    };
    let (occurrence, dispatch) = admit_dispatch(&occurrence, candidate).unwrap();
    let row = |id: &str, sha: &str| {
        json!({"status":"completed","task_id":id,"commit":sha,
        "verification":{"disposition":"passed","commands":[{"command":format!("printf {id}"),"exit_code":0,"output_digest":"a".repeat(64)}]},
        "evidence":[{"kind":"commit","sha":sha}]})
    };
    let mut patch = json!({"schema":1,"kind":"executor","dispatch_id":dispatch.id,
        "expected_execution_version":1,"outcome":"complete","tasks":[row("T1", COMMIT_1),row("T2", COMMIT_2)],"deviations":[],"blockers":[]});
    if blocked {
        patch["outcome"] = json!("blocked");
        patch["tasks"][1] = json!({"status":"blocked","task_id":"T2","blocker_id":"B1"});
        patch["blockers"] = json!([{"id":"B1","text":"stop task work","evidence":[{"kind":"criterion","id":"AC5"}]}]);
    }
    (
        json!({"execution":{"schema":1,"occurrences":{"7":occurrence}},"unrelated":{"retained":true}}),
        serde_json::from_value(patch).unwrap(),
    )
}

fn writer_operation(
    view: &View,
    scoped: bool,
    patch: cadence::execution::model::ExecutorPatch,
    commit_paths: CommitPaths,
    staged_paths: Vec<String>,
) -> Operation {
    use cadence::{
        envelope::Envelope,
        execution::{
            boundary::{BoundaryScope, BoundaryV1, PreparedAnswer, Success},
            model::{BoundaryDecision, BoundaryTool, PlanDisposition},
        },
        store::writer::BoundaryChange,
    };
    let blocked = patch.outcome == PlanDisposition::Blocked;
    if scoped {
        let success = if blocked {
            Success::JudgmentStop {
                phase: 7,
                dispatch_id: patch.dispatch_id.clone(),
                blocker_ids: vec!["B1".into()],
            }
        } else {
            Success::Complete { phase: 7 }
        };
        let answer = PreparedAnswer::new(Envelope::Ok(success)).unwrap();
        let decision = BoundaryV1::new(
            BoundaryScope::Execution { phase: 7 },
            BoundaryTool::CadenceApply,
            "executor".into(),
            digest(b"writer-patch"),
            Some(patch.dispatch_id.clone()),
            &answer,
        );
        Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: "writer-patch".into(),
            decision,
            change: Box::new(BoundaryChange::Patch {
                patch,
                commit_paths,
                staged_paths,
                render_version: 1,
                complete_phase: !blocked,
            }),
        }
    } else {
        Operation::ApplyExecutionPatch {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: "writer-patch".into(),
            decision: BoundaryDecision {
                phase: 7,
                tool: BoundaryTool::CadenceApply,
                operation: "executor".into(),
                request_digest: digest(b"writer-patch"),
                outcome: if blocked { "judgment-stop" } else { "accepted" }.into(),
                subject_id: Some(patch.dispatch_id.clone()),
                prompt_bytes: None,
                response_digest: digest(b"writer-answer"),
            },
            patch,
            commit_paths,
            staged_paths,
            render_version: 1,
            complete_phase: !blocked,
        }
    }
}

fn check_writer(
    scoped: bool,
    lease: &str,
    blocked: bool,
    commit_paths: CommitPaths,
    staged_paths: Vec<String>,
    offending: Option<&str>,
) {
    let temp = tempfile::tempdir().unwrap();
    fs::create_dir_all(temp.path().join(".planning/phases/7")).unwrap();
    let summary = temp.path().join(".planning/phases/7/SUMMARY.md");
    fs::write(&summary, b"unchanged summary\n").unwrap();
    let (data, patch) = writer_input(lease, blocked);
    runtime().block_on(async {
        let store = open(temp.path()).await;
        let view = if scoped {
            use cadence::{
                envelope::Envelope,
                execution::{
                    boundary::{BoundaryScope, BoundaryV1, PreparedAnswer, Success},
                    model::BoundaryTool,
                },
                store::writer::BoundaryChange,
            };
            let mut seed = data.clone();
            seed.as_object_mut().unwrap().remove("execution");
            let view = store
                .request(Operation::RewriteSnapshot(seed))
                .await
                .unwrap();
            let returned: ActiveDispatch =
                serde_json::from_value(data["execution"]["occurrences"]["7"]["active"].clone())
                    .unwrap();
            let answer = PreparedAnswer::new(Envelope::Ok(Success::Dispatch {
                dispatch: Box::new(returned.clone()),
                prompt: "x".repeat(returned.prompt_bytes as usize),
            }))
            .unwrap();
            let decision = BoundaryV1::new(
                BoundaryScope::Execution { phase: 7 },
                BoundaryTool::CadenceQuery,
                "execute-next".into(),
                digest(b"writer-dispatch"),
                Some(returned.id.clone()),
                &answer,
            );
            let mut candidate = returned;
            candidate.expected_execution_version = 0;
            store
                .request(Operation::BoundaryV1 {
                    expected_generation: view.snapshot.generation,
                    expected_integrity: view.snapshot.integrity.clone(),
                    operation_id: "writer-dispatch".into(),
                    decision,
                    change: Box::new(BoundaryChange::Dispatch {
                        plan_set_fingerprint: candidate.plan_set_fingerprint.clone(),
                        dispatch: candidate,
                    }),
                })
                .await
                .unwrap()
        } else {
            store
                .request(Operation::RewriteSnapshot(data.clone()))
                .await
                .unwrap()
        };
        let mut persisted = data.clone();
        if scoped {
            persisted["execution"]["occurrences"]["7"]["active"]
                .as_object_mut()
                .unwrap()
                .remove("body");
        }
        assert_eq!(view.snapshot.data, persisted);
        let operation = writer_operation(
            &view,
            scoped,
            patch.clone(),
            commit_paths.clone(),
            staged_paths.clone(),
        );
        let result = store.request(operation).await;
        if let Some(path) = offending {
            let error = result.unwrap_err().to_string();
            assert!(error.contains("undeclared-files"), "{error}");
            assert!(error.contains(path), "{error}");
            assert_eq!(store.request(Operation::ReadVerified).await.unwrap(), view);
            assert_eq!(fs::read(&summary).unwrap(), b"unchanged summary\n");
        } else {
            let accepted = result.unwrap();
            assert_ne!(accepted.snapshot.data["execution"], data["execution"]);
            assert_eq!(accepted.snapshot.data["unrelated"], data["unrelated"]);
            assert_ne!(fs::read(&summary).unwrap(), b"unchanged summary\n");
            assert_eq!(
                store
                    .request(writer_operation(
                        &view,
                        scoped,
                        patch,
                        commit_paths,
                        staged_paths
                    ))
                    .await
                    .unwrap(),
                accepted
            );
        }
    });
}

fn observed(first: &[&str], second: Option<&[&str]>) -> CommitPaths {
    let mut paths =
        CommitPaths::from([(COMMIT_1.into(), first.iter().map(|s| (*s).into()).collect())]);
    if let Some(second) = second {
        paths.insert(
            COMMIT_2.into(),
            second.iter().map(|s| (*s).into()).collect(),
        );
    }
    paths
}

#[test]
fn both_writers_refuse_ordinary_new_lockfile_and_report_paths_in_commits_and_index() {
    for scoped in [false, true] {
        for path in [
            "other.txt",
            "new.txt",
            "Cargo.lock",
            ".planning/phases/7/reports/plan-1.md",
        ] {
            check_writer(
                scoped,
                "files: [src/a.rs]",
                false,
                observed(&["src/a.rs"], Some(&[path])),
                vec![],
                Some(path),
            );
            check_writer(
                scoped,
                "files: [src/a.rs]",
                false,
                observed(&["src/a.rs"], Some(&["src/a.rs"])),
                vec![path.into()],
                Some(path),
            );
            check_writer(
                scoped,
                "files: [src/a.rs]",
                true,
                observed(&[path], None),
                vec![],
                Some(path),
            );
        }
    }
}

#[test]
fn both_writers_require_both_staged_rename_endpoints_and_accept_complete_coverage() {
    for scoped in [false, true] {
        let commit_paths = observed(&["src/a.rs"], Some(&["src/a.rs"]));
        for (lease, offending) in [
            ("files: [src/a.rs, new.txt]", "old.txt"),
            ("files: [src/a.rs, old.txt]", "new.txt"),
        ] {
            check_writer(
                scoped,
                lease,
                false,
                commit_paths.clone(),
                vec!["new.txt".into(), "old.txt".into()],
                Some(offending),
            );
        }
        check_writer(
            scoped,
            "files: [src/a.rs, new.txt, old.txt]",
            false,
            commit_paths.clone(),
            vec!["new.txt".into(), "old.txt".into()],
            None,
        );
        check_writer(
            scoped,
            "files: []\ndirectories: [src/]",
            false,
            commit_paths,
            vec!["src/new.rs".into(), "src/old.rs".into()],
            None,
        );
    }
}

#[test]
fn binding_retains_complete_violations_and_validates_binary_observations_first() {
    use cadence::execution::patch::{apply_executor_patch, attach_commit_paths};
    let (data, patch) = writer_input("files: [src/a.rs]", false);
    let proposed = || apply_executor_patch(&data, &patch).unwrap();
    let paths = observed(&["a.txt", "src/a.rs", "z.txt"], Some(&["Cargo.lock"]));
    let error = attach_commit_paths(proposed(), &paths, &["old.txt".into()]).unwrap_err();
    let evidence = error.undeclared.unwrap();
    assert_eq!(
        evidence.committed,
        observed(&["a.txt", "z.txt"], Some(&["Cargo.lock"]))
    );
    assert_eq!(evidence.staged, ["old.txt"]);
    assert_eq!(evidence.tasks.len(), 2);
    for paths in [
        observed(&["z", "a"], Some(&[])),
        observed(&["a", "a"], Some(&[])),
        observed(&["../escape"], Some(&[])),
        observed(&["src\\a.rs"], Some(&[])),
        observed(&[], None),
    ] {
        assert_eq!(
            attach_commit_paths(proposed(), &paths, &[])
                .unwrap_err()
                .code,
            "commit-path-set"
        );
    }
    for staged in [
        vec!["b".into(), "a".into()],
        vec!["a".into(), "a".into()],
        vec!["../escape".into()],
    ] {
        assert_eq!(
            attach_commit_paths(proposed(), &observed(&[], Some(&[])), &staged)
                .unwrap_err()
                .code,
            "commit-path-set"
        );
    }
}

#[test]
fn historical_accepted_out_of_lease_receipts_replay_without_reclassification() {
    use cadence::execution::patch::{
        ApplicationDisposition, apply_executor_patch, attach_commit_paths,
    };
    let (data, patch) = writer_input("files: [src/a.rs]", false);
    // Encode an already-confirmed pre-enforcement completion, bypassing new admission.
    let mut historical = apply_executor_patch(&data, &patch).unwrap().data;
    let paths = observed(
        &["Cargo.lock"],
        Some(&[".planning/phases/7/reports/plan-1.md"]),
    );
    let occurrence = &mut historical["execution"]["occurrences"]["7"];
    occurrence["plans"][0]["commit_paths"] = json!(paths);
    occurrence["receipts"][&patch.dispatch_id]["outcome"]["commit_paths"] = json!(paths);
    let replay = attach_commit_paths(
        apply_executor_patch(&historical, &patch).unwrap(),
        &paths,
        &["unrelated-staged".into()],
    )
    .unwrap();
    assert_eq!(replay.disposition, ApplicationDisposition::Replay);
    assert_eq!(replay.data, historical);
    let temp = tempfile::tempdir().unwrap();
    runtime().block_on(async {
        let store = open(temp.path()).await;
        let view = store
            .request(Operation::RewriteSnapshot(historical))
            .await
            .unwrap();
        let replayed = store
            .request(writer_operation(&view, false, patch, paths, vec![]))
            .await
            .unwrap();
        assert_eq!(replayed, view);
    });
}

fn wire_patch(dispatch: &Value, sha: &str) -> Value {
    json!({"schema":1,"kind":"executor","dispatch_id":dispatch["id"],
        "expected_execution_version":dispatch["expected_execution_version"],"outcome":"complete",
        "tasks":[{"status":"completed","task_id":"T1","commit":sha,
            "verification":{"disposition":"passed","commands":[{"command":"printf T1","exit_code":0,"output_digest":"a".repeat(64)}]},
            "evidence":[{"kind":"commit","sha":sha}]}],"deviations":[],"blockers":[]})
}

fn wire_dispatch(fixture: &Fixture) -> Value {
    let mut client = fixture.client();
    let answer = client.query();
    assert_eq!(answer["outcome"], "dispatch", "{answer}");
    client.finish();
    answer["dispatch"].clone()
}

fn settle_wire(client: &mut Client, dispatch: &Value) {
    let scan = client.call("cadence_apply", json!({"operation":"risk-check","request_id":format!("settle-{}",dispatch["id"].as_str().unwrap()),
        "scope":{"phase":7,"occurrence":"phase-7-execution","worker":"1"},
        "source":{"kind":"execution","plan":1,"dispatch_id":dispatch["id"]},"surfaces":null}));
    assert_eq!(scan["status"], "ok", "{scan}");
    assert_eq!(scan["observation"]["scan"]["matches"], json!([]), "{scan}");
    assert_eq!(scan["observation"]["scan"]["checked"], true);
    assert_eq!(client.query()["outcome"], "complete");
}

fn task_commit(fixture: &Fixture, paths: &[&str]) -> String {
    for path in paths {
        let absolute = fixture.root.join(path);
        fs::create_dir_all(absolute.parent().unwrap()).unwrap();
        fs::write(absolute, format!("task content for {path}\n")).unwrap();
        fixture.git(&["add", "--", path]);
    }
    fixture.git(&["commit", "-q", "-m", "feat(7): complete T1"]);
    fixture.git(&["rev-parse", "HEAD"])
}

fn assert_wire_lease_refusal(
    fixture: &Fixture,
    dispatch: &Value,
    sha: &str,
    committed: &[String],
    staged: &[String],
) -> Value {
    let before = fixture.read();
    let summary = fixture.root.join(".planning/phases/7/SUMMARY.md");
    let summary_before = fs::read(&summary).ok();
    let index = fs::read(fixture.root.join(".git/index")).unwrap();
    let patch = wire_patch(dispatch, sha);
    let mut client = fixture.client();
    let answer = client.call("cadence_apply", patch.clone());
    assert_eq!(answer["code"], "undeclared-files", "{answer}");
    assert!(answer["reason"].as_str().unwrap().len() <= 1024);
    client.finish();
    let after = fixture.read();
    assert_eq!(after.snapshot.data, before.snapshot.data);
    assert_eq!(fs::read(&summary).ok(), summary_before);
    assert_eq!(fs::read(fixture.root.join(".git/index")).unwrap(), index);
    fixture.git(&["cat-file", "-e", &format!("{sha}^{{commit}}")]);
    assert_eq!(after.decisions.len(), before.decisions.len() + 1);
    let record = after.decisions.last().unwrap();
    let cadence::store::model::Decision::BoundaryV1(record) = &record.decision else {
        panic!("native decision required")
    };
    let evidence = record.boundary.lease_refusal.as_ref().unwrap();
    assert_eq!(evidence.paths.dispatch_id, dispatch["id"].as_str().unwrap());
    assert_eq!((evidence.paths.phase, evidence.paths.plan), (7, 1));
    assert_eq!(
        evidence.paths.tasks,
        std::collections::BTreeMap::from([("T1".into(), sha.into())])
    );
    let expected = if committed.is_empty() {
        Default::default()
    } else {
        std::collections::BTreeMap::from([(sha.into(), committed.to_vec())])
    };
    assert_eq!(evidence.paths.committed, expected);
    assert_eq!(evidence.paths.staged, staged);
    assert!(evidence.disposition.contains("dispatch remains open"));
    assert_eq!(
        record.boundary.response_digest,
        cadence::execution::boundary::envelope_digest(
            &serde_json::from_value(answer.clone()).unwrap()
        )
        .unwrap()
    );
    let bytes = fs::read(fixture.root.join(".planning/decisions.jsonl")).unwrap();
    let mut client = fixture.client();
    assert_eq!(client.call("cadence_apply", patch), answer);
    client.finish();
    assert_eq!(
        fs::read(fixture.root.join(".planning/decisions.jsonl")).unwrap(),
        bytes
    );
    assert_eq!(fixture.read(), after);
    assert_eq!(fs::read(fixture.root.join(".git/index")).unwrap(), index);
    answer
}

#[test]
fn public_git_refusals_preserve_both_rename_endpoints_with_config_enabled_or_disabled() {
    for configured in ["true", "false"] {
        for committed in [true, false] {
            for source_only in [true, false] {
                let lease = if source_only {
                    "files: [src/covered.txt, dest.txt]"
                } else {
                    "files: [src/covered.txt, src/a.rs]"
                };
                let fixture = Fixture::new(lease);
                fixture.git(&["config", "diff.renames", configured]);
                let dispatch = wire_dispatch(&fixture);
                let covered = task_commit(&fixture, &["src/covered.txt"]);
                fixture.git(&["mv", "src/a.rs", "dest.txt"]);
                let sha = if committed {
                    fixture.git(&["commit", "-q", "-m", "feat(7): rename T1"]);
                    fixture.git(&["rev-parse", "HEAD"])
                } else {
                    covered
                };
                let offending = vec![if source_only { "src/a.rs" } else { "dest.txt" }.to_owned()];
                let (commits, index) = if committed {
                    (offending, vec![])
                } else {
                    (vec![], offending)
                };
                let answer = assert_wire_lease_refusal(&fixture, &dispatch, &sha, &commits, &index);
                assert!(answer["reason"].as_str().unwrap().contains(if source_only {
                    "src/a.rs"
                } else {
                    "dest.txt"
                }));
            }
        }
    }
}

#[test]
fn public_git_has_zero_exemptions_for_committed_and_staged_new_report_and_lockfile_paths() {
    for path in [
        "outside.txt",
        "new/path.txt",
        "Cargo.lock",
        ".planning/phases/7/reports/plan-1.md",
    ] {
        for committed in [true, false] {
            let fixture = Fixture::new("files: [src/a.rs]");
            let dispatch = wire_dispatch(&fixture);
            let sha = if committed {
                task_commit(&fixture, &[path])
            } else {
                let sha = task_commit(&fixture, &["src/a.rs"]);
                let absolute = fixture.root.join(path);
                fs::create_dir_all(absolute.parent().unwrap()).unwrap();
                fs::write(absolute, "staged material\n").unwrap();
                fixture.git(&["add", "--", path]);
                sha
            };
            assert_wire_lease_refusal(
                &fixture,
                &dispatch,
                &sha,
                &if committed { vec![path.into()] } else { vec![] },
                &if committed { vec![] } else { vec![path.into()] },
            );
        }
    }
}

#[test]
fn public_git_accepts_directory_covered_rename_and_compares_merge_against_every_parent() {
    let fixture = Fixture::new("files: []\ndirectories: [src/]");
    let dispatch = wire_dispatch(&fixture);
    let sha = task_commit(&fixture, &["src/new.rs"]);
    fixture.git(&["mv", "src/a.rs", "src/moved.rs"]);
    let mut client = fixture.client();
    let answer = client.call("cadence_apply", wire_patch(&dispatch, &sha));
    assert_eq!(answer["code"], "risk-pending", "{answer}");
    settle_wire(&mut client, &dispatch);
    client.finish();

    for covered in [false, true] {
        let fixture = Fixture::new("files: []\ndirectories: [src/]");
        let dispatch = wire_dispatch(&fixture);
        let branch = fixture.git(&["symbolic-ref", "--short", "HEAD"]);
        fixture.git(&["checkout", "-q", "-b", "side"]);
        let side = if covered {
            "src/side.rs"
        } else {
            "outside.txt"
        };
        task_commit(&fixture, &[side]);
        fixture.git(&["checkout", "-q", &branch]);
        task_commit(&fixture, &["src/a.rs"]);
        fixture.git(&["merge", "-q", "--no-ff", "side", "-m", "feat(7): merge T1"]);
        let sha = fixture.git(&["rev-parse", "HEAD"]);
        if covered {
            let mut client = fixture.client();
            let answer = client.call("cadence_apply", wire_patch(&dispatch, &sha));
            assert_eq!(answer["code"], "risk-pending", "{answer}");
            settle_wire(&mut client, &dispatch);
            client.finish();
            let paths = &fixture.read().snapshot.data["execution"]["occurrences"]["7"]["plans"][0]
                ["commit_paths"][&sha];
            assert_eq!(*paths, json!(["src/a.rs", "src/side.rs"]));
        } else {
            assert_wire_lease_refusal(&fixture, &dispatch, &sha, &[side.into()], &[]);
        }
    }
}

#[test]
fn public_long_lease_evidence_survives_compact_answer_limits_without_truncation() {
    let fixture = Fixture::new("files: [src/a.rs]");
    let dispatch = wire_dispatch(&fixture);
    let paths = (0..100)
        .map(|i| format!("outside/{i:03}-{}.txt", "x".repeat(180)))
        .collect::<Vec<_>>();
    let refs = paths.iter().map(String::as_str).collect::<Vec<_>>();
    let sha = task_commit(&fixture, &refs);
    let answer = assert_wire_lease_refusal(&fixture, &dispatch, &sha, &paths, &[]);
    assert!(
        answer["reason"]
            .as_str()
            .unwrap()
            .contains("100 undeclared path observations")
    );
    let view = fixture.read();
    let cadence::store::model::Decision::BoundaryV1(record) =
        &view.decisions.last().unwrap().decision
    else {
        panic!()
    };
    assert!(
        answer["reason"].as_str().unwrap().contains(
            &record
                .boundary
                .lease_refusal
                .as_ref()
                .unwrap()
                .identity()
                .unwrap()
        )
    );
    assert!(serde_json::to_vec(&record).unwrap().len() > 16 * 1024);
}

#[cfg(unix)]
#[test]
fn public_staged_observation_refuses_unreadable_malformed_non_utf8_and_changed_inputs() {
    use std::os::unix::{ffi::OsStringExt, fs::PermissionsExt};
    for case in [
        "unreadable",
        "malformed",
        "non-utf8",
        "changed-set",
        "changed-blob",
    ] {
        let fixture = Fixture::new("files: [src/a.rs, src/staged.rs]");
        let dispatch = wire_dispatch(&fixture);
        let sha = task_commit(&fixture, &["src/a.rs"]);
        fs::write(fixture.root.join("src/staged.rs"), "initial staged\n").unwrap();
        fixture.git(&["add", "src/staged.rs"]);
        let before = fixture.read();
        let saved_index = fs::read(fixture.root.join(".git/index")).unwrap();
        let bin = fixture._temp.path().join("bin");
        fs::create_dir_all(&bin).unwrap();
        let real_git = Command::new("sh")
            .args(["-c", "command -v git"])
            .stdin(Stdio::null())
            .output()
            .unwrap();
        let real_git = String::from_utf8(real_git.stdout)
            .unwrap()
            .trim()
            .to_owned();
        let body = match case {
            "unreadable" => "case \" $* \" in *' diff --cached --raw '*) printf 'invalid index bytes' > \"$2/.git/index\";; esac\n".into(),
            "non-utf8" => {
                let path = std::ffi::OsString::from_vec(b"src/bad-\xff.txt".to_vec());
                fs::write(fixture.root.join(&path), "invalid UTF-8 path\n").unwrap();
                let status = Command::new(&real_git).arg("-C").arg(&fixture.root)
                    .args(["add", "--"]).arg(path).stdin(Stdio::null()).status().unwrap();
                assert!(status.success());
                String::new()
            }
            "malformed" => "case \" $* \" in *' diff --cached --name-status '*) printf 'R100\\000src/a.rs\\000'; exit 0;; esac\n".into(),
            _ => {
                let path = if case == "changed-set" { "src/a.rs" } else { "src/staged.rs" };
                format!("case \" $* \" in *' diff --cached --raw '*)\ncount=0; test ! -f '{bin}/count' || count=$(cat '{bin}/count'); count=$((count + 1)); printf '%s' \"$count\" > '{bin}/count'\nif test \"$count\" = 3; then printf 'changed staged content\\n' > \"$2/{path}\"; '{real_git}' -C \"$2\" add -- '{path}'; fi;; esac\n", bin=bin.display())
            }
        };
        let wrapper = bin.join("git");
        fs::write(
            &wrapper,
            format!("#!/bin/sh\n{body}exec '{real_git}' \"$@\"\n"),
        )
        .unwrap();
        fs::set_permissions(&wrapper, fs::Permissions::from_mode(0o755)).unwrap();
        let path = format!("{}:{}", bin.display(), std::env::var("PATH").unwrap());
        let mut client = Client::with_path(&fixture.root, Some(&path));
        let answer = client.call("cadence_apply", wire_patch(&dispatch, &sha));
        assert_eq!(
            answer["code"],
            if case.starts_with("changed-") {
                "inputs-changed"
            } else {
                "staged-paths"
            },
            "{case}: {answer}"
        );
        client.finish();
        let after = fixture.read();
        assert_eq!(after.snapshot.data, before.snapshot.data, "{case}");
        assert_eq!(after.decisions.len(), before.decisions.len() + 1);
        assert!(!fixture.root.join(".planning/phases/7/SUMMARY.md").exists());
        fs::write(fixture.root.join(".git/index"), saved_index).unwrap();
        fixture.git(&["cat-file", "-e", &sha]);
    }
}

#[test]
fn lease_refusal_intent_recovery_preserves_evidence_and_rejects_forged_coverage() {
    use cadence::execution::{boundary::BoundaryV1, patch::UndeclaredPaths};
    use cadence::store::{
        Error, filesystem::Stage, model, transaction::INTENT, writer::BoundaryChange,
    };
    use std::collections::BTreeMap;
    for tampered in [false, true] {
        let fixture = Fixture::new("files: [src/a.rs]");
        let dispatch = wire_dispatch(&fixture);
        let sha = task_commit(&fixture, &["outside.txt"]);
        let before = fixture.read();
        let decision = BoundaryV1::lease_refusal(
            digest(b"pending-lease"),
            UndeclaredPaths {
                schema: 1,
                dispatch_id: dispatch["id"].as_str().unwrap().into(),
                phase: 7,
                plan: 1,
                tasks: BTreeMap::from([("T1".into(), sha.clone())]),
                committed: BTreeMap::from([(sha.clone(), vec!["outside.txt".into()])]),
                staged: vec![],
            },
        )
        .unwrap();
        runtime().block_on(async {
            let store = Store::open(
                Filesystem::new(fixture.root.join(".planning"))
                    .unwrap()
                    .with_probe(|stage, path| {
                        if stage == Stage::Confirmation && path.ends_with(INTENT) {
                            Err(Error::Io("injected pending lease intent".into()))
                        } else {
                            Ok(())
                        }
                    }),
                Allow,
            )
            .await
            .unwrap();
            assert!(
                store
                    .request(Operation::BoundaryV1 {
                        expected_generation: before.snapshot.generation,
                        expected_integrity: before.snapshot.integrity.clone(),
                        operation_id: "pending-lease".into(),
                        decision: decision.clone(),
                        change: Box::new(BoundaryChange::Observe),
                    })
                    .await
                    .is_err()
            );
        });
        let planning = fixture.root.join(".planning");
        assert!(planning.join(INTENT).exists());
        if tampered {
            let mut intent: Value =
                serde_json::from_slice(&fs::read(planning.join(INTENT)).unwrap()).unwrap();
            let participants = intent["participants"].as_array_mut().unwrap();
            let entry = participants
                .iter_mut()
                .find(|p| p["target"] == model::DECISIONS)
                .unwrap();
            let bytes: Vec<u8> = serde_json::from_value(entry["bytes"].clone()).unwrap();
            let mut records: Vec<model::DecisionRecord> = model::parse_lines(&bytes).unwrap();
            let record = records.last_mut().unwrap();
            let model::Decision::BoundaryV1(value) = &mut record.decision else {
                panic!()
            };
            let mut paths = value.boundary.lease_refusal.as_ref().unwrap().paths.clone();
            paths.committed.insert(sha, vec!["src/a.rs".into()]);
            value.boundary =
                BoundaryV1::lease_refusal(value.boundary.request_digest.clone(), paths).unwrap();
            record.id = value.boundary.identity().unwrap();
            let id = record.id.clone();
            // Reseal every outer digest: recovery must validate the evidence's
            // actual lease meaning, not merely detect a damaged checksum.
            let bytes = records
                .iter()
                .flat_map(|r| {
                    let mut b = serde_json::to_vec(r).unwrap();
                    b.push(b'\n');
                    b
                })
                .collect::<Vec<_>>();
            entry["bytes"] = json!(bytes);
            let state = participants
                .iter_mut()
                .find(|p| p["target"] == model::STATE)
                .unwrap();
            let bytes_state: Vec<u8> = serde_json::from_value(state["bytes"].clone()).unwrap();
            let mut snapshot: Value = serde_json::from_slice(&bytes_state).unwrap();
            snapshot["decisions_digest"] = json!(digest(&bytes));
            snapshot["integrity"] = json!("");
            snapshot["integrity"] = json!(digest(&serde_json::to_vec(&snapshot).unwrap()));
            state["bytes"] = json!(serde_json::to_vec(&snapshot).unwrap());
            intent["kind"]["decision_id"] = json!(id);
            intent["integrity"] = json!(digest(
                &serde_json::to_vec(&json!([
                    intent["version"],
                    intent["kind"],
                    intent["participants"]
                ]))
                .unwrap()
            ));
            fs::write(planning.join(INTENT), serde_json::to_vec(&intent).unwrap()).unwrap();
            let disk = [model::STATE, model::DECISIONS, INTENT]
                .map(|p| fs::read(planning.join(p)).unwrap());
            runtime().block_on(async {
                assert!(
                    Store::open(Filesystem::new(&planning).unwrap(), Allow)
                        .await
                        .is_err()
                );
            });
            assert_eq!(
                [model::STATE, model::DECISIONS, INTENT]
                    .map(|p| fs::read(planning.join(p)).unwrap()),
                disk
            );
        } else {
            let after = fixture.read();
            assert_eq!(after.snapshot.data, before.snapshot.data);
            assert_eq!(after.decisions.len(), before.decisions.len() + 1);
            let model::Decision::BoundaryV1(value) = &after.decisions.last().unwrap().decision
            else {
                panic!()
            };
            assert_eq!(value.boundary, decision);
            assert!(!planning.join(INTENT).exists());
            assert_eq!(fixture.read(), after);
        }
    }
}

#[test]
fn public_corrected_signed_full_patch_recovers_same_dispatch_after_operator_history_repair() {
    let fixture = Fixture::new("files: [src/a.rs]");
    let dispatch = wire_dispatch(&fixture);
    let rejected = task_commit(&fixture, &["outside.txt"]);
    assert_wire_lease_refusal(&fixture, &dispatch, &rejected, &["outside.txt".into()], &[]);
    let refusal = fixture.read().decisions.last().unwrap().clone();
    let mut client = fixture.client();
    let query = client.query();
    assert_eq!(query["dispatch"], dispatch);
    for text in [
        "zero exemptions",
        "operator-controlled repair",
        "same dispatch ID and execution version",
        "unchanged lease",
    ] {
        assert!(query["prompt"].as_str().unwrap().contains(text));
    }
    let plan = fixture.root.join(".planning/phases/7/PLAN-1.md");
    let original = fs::read_to_string(&plan).unwrap();
    for changed in [
        original.replace("files: [src/a.rs]", "files: [src/a.rs, outside.txt]"),
        format!("{original}Changed body\n"),
    ] {
        fs::write(&plan, changed).unwrap();
        let answer = client.call("cadence_apply", wire_patch(&dispatch, &rejected));
        assert_eq!(answer["code"], "plan-set-changed", "{answer}");
        fs::write(&plan, &original).unwrap();
    }
    assert_eq!(
        client.call("cadence_apply", wire_patch(&dispatch, &rejected))["code"],
        "undeclared-files"
    );
    client.finish();

    // The fixture operator controls this disposable, unpublished repository.
    // Keep the rejected object reachable while replacing its local history.
    fixture.git(&["update-ref", "refs/fixture/rejected", &rejected]);
    fixture.git(&["reset", "--hard", dispatch["base_sha"].as_str().unwrap()]);
    let corrected = task_commit(&fixture, &["src/a.rs"]);
    assert_ne!(corrected, rejected);
    fixture.git(&["verify-commit", &corrected]);
    fixture.git(&["cat-file", "-e", &rejected]);
    let mut client = fixture.client();
    assert_eq!(client.query()["dispatch"], dispatch);
    assert_eq!(
        client.call("cadence_apply", wire_patch(&dispatch, &rejected))["code"],
        "git-order"
    );
    let accepted = client.call("cadence_apply", wire_patch(&dispatch, &corrected));
    assert_eq!(accepted["code"], "risk-pending", "{accepted}");
    settle_wire(&mut client, &dispatch);
    client.finish();
    let view = fixture.read();
    assert!(view.decisions.contains(&refusal));
    let occurrence = &view.snapshot.data["execution"]["occurrences"]["7"];
    assert_eq!(occurrence["plans"][0]["tasks"][0]["commit"], corrected);
    assert_eq!(
        occurrence["plans"][0]["commit_paths"],
        json!({corrected.as_str(): ["src/a.rs"]})
    );
    assert!(
        !serde_json::to_string(occurrence)
            .unwrap()
            .contains(&rejected)
    );
    assert_eq!(fixture.git(&["rev-parse", "HEAD"]), corrected);
    assert_eq!(fs::read_to_string(plan).unwrap(), original);
}

#[test]
fn public_staged_only_operator_repair_accepts_original_in_lease_commit() {
    let fixture = Fixture::new("files: [src/a.rs]");
    let dispatch = wire_dispatch(&fixture);
    let sha = task_commit(&fixture, &["src/a.rs"]);
    fs::write(
        fixture.root.join("Cargo.lock"),
        "staged dependency change\n",
    )
    .unwrap();
    fixture.git(&["add", "Cargo.lock"]);
    let answer = assert_wire_lease_refusal(&fixture, &dispatch, &sha, &[], &["Cargo.lock".into()]);
    let reason = answer["reason"].as_str().unwrap();
    assert!(reason.contains("repair the staged index"));
    assert!(!reason.contains("repair or split"));
    let refusal = fixture.read().decisions.last().unwrap().clone();
    fixture.git(&["restore", "--staged", "Cargo.lock"]);
    let mut client = fixture.client();
    assert_eq!(client.query()["dispatch"], dispatch);
    let accepted = client.call("cadence_apply", wire_patch(&dispatch, &sha));
    assert_eq!(accepted["code"], "risk-pending", "{accepted}");
    settle_wire(&mut client, &dispatch);
    client.finish();
    assert!(fixture.read().decisions.contains(&refusal));
    assert_eq!(fixture.git(&["rev-parse", "HEAD"]), sha);
    assert_eq!(
        fs::read_to_string(fixture.root.join("Cargo.lock")).unwrap(),
        "staged dependency change\n"
    );
}

#[test]
fn historical_exact_file_prompt_reconstructs_with_original_admitted_answer_digest() {
    use cadence::{
        envelope::Envelope,
        execution::{
            boundary::{BoundaryScope, BoundaryV1, PreparedAnswer, Success},
            model::BoundaryTool,
        },
        store::writer::BoundaryChange,
    };
    let fixture = Fixture::new("files: [src/a.rs]");
    let plan = plan("files: [src/a.rs]");
    let set = plan_set_fingerprint(std::slice::from_ref(&plan)).unwrap();
    let mut candidate =
        build_dispatch(&plan, &set, 0, &fixture.git(&["rev-parse", "HEAD"]), 1).unwrap();
    let mut returned = candidate.clone();
    returned.expected_execution_version = 1;
    // Independently spell the pre-lease-instructions operational fields and text.
    let operational = json!({"schema":1,"dispatch_id":returned.id,"expected_execution_version":1,
        "phase":7,"plan":1,"requirements":["AC3"],"files":["src/a.rs"],"suite":"printf suite",
        "tasks":[{"id":"T1","verify":["printf T1"]}],"policy":{"rung":"fixed","branch":"current","reviews":"disabled"},"base_sha":returned.base_sha});
    let prompt = format!(
        "Cadence native execution dispatch\n\nOperational input:\n{}\n\nExecutor patch schema:\n{}\n\nInstructions:\nComplete tasks in listed order. Use one distinct signed commit per completed task. Run each task's exact verification commands and the suite. Return exactly one executor patch matching this schema. Stop at the first blocker and mark all later tasks not-run.\n\nOpaque plan body (10 UTF-8 bytes):\nTask body\n",
        serde_json::to_string_pretty(&operational).unwrap(),
        serde_json::to_string_pretty(&cadence::execution::model::patch_schema()).unwrap()
    );
    candidate.prompt_bytes = prompt.len() as u64;
    returned.prompt_bytes = candidate.prompt_bytes;
    let answer = PreparedAnswer::new(Envelope::Ok(Success::Dispatch {
        dispatch: Box::new(returned),
        prompt,
    }))
    .unwrap();
    let request = digest(&serde_json::to_vec(&json!(["execution-request-v1","cadence-query","execute-next",{"operation":"execute-next","phase":7}])).unwrap());
    let decision = BoundaryV1::new(
        BoundaryScope::Execution { phase: 7 },
        BoundaryTool::CadenceQuery,
        "execute-next".into(),
        request,
        Some(candidate.id.clone()),
        &answer,
    );
    runtime().block_on(async {
        let store = open(&fixture.root).await;
        let view = store.request(Operation::ReadVerified).await.unwrap();
        store
            .request(Operation::BoundaryV1 {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity,
                operation_id: "historical-prompt".into(),
                decision,
                change: Box::new(BoundaryChange::Dispatch {
                    plan_set_fingerprint: set,
                    dispatch: candidate,
                }),
            })
            .await
            .unwrap();
    });
    let before = fixture.read();
    for _ in 0..2 {
        let mut client = fixture.client();
        assert_eq!(
            client.query(),
            serde_json::to_value(&answer.envelope).unwrap()
        );
        client.finish();
        assert_eq!(fixture.read(), before);
    }
}

#[test]
fn native_guidance_and_phase_seven_roadmap_match_parser_without_migrating_history() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap();
    let planner = fs::read_to_string(root.join("skills/cad-planner-contract/SKILL.md")).unwrap();
    let checker =
        fs::read_to_string(root.join("skills/cad-plan-checker-contract/SKILL.md")).unwrap();
    for contract in [&planner, &checker] {
        for token in [
            "zero exemptions",
            "covers()",
            "trailing separator",
            "exact paths",
            "directories",
            "patch",
            "rename endpoints",
            "schema: 1",
            "suite",
            "verify",
            "fingerprint",
            "256",
        ] {
            assert!(contract.contains(token), "missing contract token {token}");
        }
        assert!(!contract.contains("lease-check"));
    }
    let example = planner
        .split_once("```yaml\n")
        .unwrap()
        .1
        .split_once("\n```")
        .unwrap()
        .0;
    let admitted = parse_plan(example.as_bytes(), 7, 1).unwrap();
    assert_eq!(admitted.files, ["Cargo.lock"]);
    assert_eq!(admitted.directories, ["src"]);
    assert!(covers(
        &admitted.files,
        &admitted.directories,
        "src/shared.txt"
    ));
    assert!(!covers(
        &admitted.files,
        &admitted.directories,
        "src-other/shared.txt"
    ));
    let bad = example.replace("files: [Cargo.lock]", "files: [src/]");
    let error = parse_plan(bad.as_bytes(), 7, 1).unwrap_err();
    assert!(error.detail.contains("files"));
    let roadmap = fs::read_to_string(root.join(".planning/ROADMAP.md")).unwrap();
    let phase = roadmap
        .split_once("### Phase 7:")
        .unwrap()
        .1
        .split_once("### Phase 8:")
        .unwrap()
        .0;
    for token in [
        "zero exemptions",
        "reported-commit paths",
        "patch time",
        "whole staged set",
        "rename endpoints",
        "overlap-derived ordering",
        "Write/Edit",
        "Bash",
        "phase 6",
        "Wrappers",
        "substitutions",
        "planning/core.mjs:650",
        "lib/risk-diff.mjs:391",
    ] {
        assert!(phase.contains(token), "missing roadmap token {token}");
    }
    for old in [
        "lockfile and report exceptions",
        "every commit passes through",
        "before any skill that commits",
        "Delete the pairwise",
        "planning/core.mjs:519-524",
    ] {
        assert!(!phase.contains(old), "stale roadmap claim {old}");
    }
    let git = |args: &[&str]| {
        let output = Command::new("git")
            .current_dir(root)
            .args(args)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(output.status.success());
        output.stdout
    };
    let historical = String::from_utf8(git(&[
        "ls-tree",
        "-r",
        "--name-only",
        START,
        "--",
        ".planning/phases/2/",
    ]))
    .unwrap();
    let plans = historical
        .lines()
        .filter(|path| {
            Path::new(path)
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .starts_with("PLAN")
        })
        .collect::<Vec<_>>();
    assert!(!plans.is_empty());
    for path in plans {
        assert_eq!(
            fs::read(root.join(path)).unwrap(),
            git(&["show", &format!("{START}:{path}")])
        );
    }
}
