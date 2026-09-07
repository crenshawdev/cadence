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
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
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
