use cadence::{
    evidence::{Scope, results::AcceptedResult},
    pause::{
        git::Staged,
        risk::{CommitKind, Fire, Review},
    },
    rail::{
        risk::{self, MaterialIdentity},
        risk_diff,
    },
};
use serde_json::json;
use std::path::PathBuf;

#[test]
fn shared_classifier_keeps_category_order_and_changed_line_signals() {
    let categories = risk::CATEGORIES.map(str::to_owned);
    let body = b"diff --git a/work b/work\n--- a/work\n+++ b/work\n@@ -1 +1,8 @@\n-jwt.verify(token)\n+ALTER TABLE example\n+stripe\n+Mutex\n+DROP TABLE example\n+APP_SECRET=value\n+router.get('/hello')\n+JSON.parse(input)\n";
    let scan = risk_diff::scan(Some(body), &[PathBuf::from("work")], &categories).unwrap();
    assert!(scan.checked && !scan.empty && !scan.inconclusive);
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        risk::CATEGORIES
    );
    assert_eq!(
        scan,
        cadence::pause::risk_diff::scan(Some(body), &[PathBuf::from("work")], &categories).unwrap()
    );
}

#[test]
fn empty_unavailable_binary_and_unchanged_context_stay_distinct() {
    let categories = vec!["destructive".into()];
    let empty = risk_diff::scan(Some(b""), &[], &categories).unwrap();
    assert!(empty.checked && empty.empty && !empty.inconclusive);
    let unavailable = risk_diff::scan(None, &[], &categories).unwrap();
    assert!(!unavailable.checked && unavailable.inconclusive && !unavailable.empty);
    let binary = risk_diff::scan(
        Some(b"diff --git a/a b/a\nBinary files a/a and b/a differ\n"),
        &["a".into()],
        &categories,
    )
    .unwrap();
    assert!(binary.checked && binary.inconclusive && !binary.empty);
    let context = risk_diff::scan(
        Some(b"diff --git a/a b/a\n@@ -1,2 +1,2 @@\n DROP TABLE old\n-old\n+new\n"),
        &["a".into()],
        &categories,
    )
    .unwrap();
    assert!(context.matches.is_empty() && !context.inconclusive);
}

#[test]
fn shared_surface_selection_keeps_unanswered_invalid_and_explicit_choices_distinct() {
    assert_eq!(risk::configured_surfaces(&json!(null)).unwrap(), None);
    assert_eq!(
        risk::configured_surfaces(&json!(["secrets", "auth"])).unwrap(),
        Some(vec!["secrets".into(), "auth".into()])
    );
    for value in [
        json!([]),
        json!(["auth", "auth"]),
        json!(["unknown"]),
        json!([2]),
        json!("auth"),
    ] {
        assert!(risk::configured_surfaces(&value).is_err());
    }
}

#[test]
fn independently_encoded_pause_fire_preserves_bytes_digest_and_exact_review_matching() {
    let scope: Scope = serde_json::from_value(json!({"project":"/project","planning_root":"/project/.planning","cycle":"4","occurrence":"pause-1","phase":"7","plan":"3","report":"pause"})).unwrap();
    let scan = risk_diff::scan(Some(b""), &[], &["auth".into()]).unwrap();
    let staged = Staged {
        base: "a".repeat(40),
        index_id: "b".repeat(40),
        scope: vec!["work".into()],
        authored: vec![],
        diff: vec![],
    };
    // This is the pre-extraction tuple and field order, encoded independently.
    let prior_input = format!(
        r#"[{{"project":"/project","planning_root":"/project/.planning","cycle":"4","occurrence":"pause-1","phase":"7","plan":"3","report":"pause"}},"wip",1,"{}","{}",["work"],[],{{"checked":true,"categories":["auth"],"matches":[],"inconclusive":false,"empty":true}}]"#,
        "a".repeat(40),
        "b".repeat(40)
    );
    let id = format!(
        "pause-risk-{}",
        cadence::store::model::digest(prior_input.as_bytes())
    );
    let prior_bytes = format!(
        r#"{{"id":"{id}","commit_kind":"wip","round":1,"base":"{}","staged":true,"head_id":null,"index_id":"{}","scope":["work"],"authored":[],"scan":{{"checked":true,"categories":["auth"],"matches":[],"inconclusive":false,"empty":true}}}}"#,
        "a".repeat(40),
        "b".repeat(40)
    );
    let old: Fire = serde_json::from_str(&prior_bytes).unwrap();
    let new = Fire::new(&scope, CommitKind::Wip, 1, &staged, scan).unwrap();
    assert_eq!(old, new);
    assert_eq!(serde_json::to_string(&new).unwrap(), prior_bytes);
    assert_eq!(
        new.material().unwrap(),
        MaterialIdentity::Staged {
            base_id: staged.base,
            index_id: staged.index_id
        }
    );
    let record = AcceptedResult {
        id,
        contract: "cadence.pause.risk-surface.v1".into(),
        result: "reviewed".into(),
        evidence_text: format!(
            r#"{{"version":1,"fire":{prior_bytes},"finding_record":"review.md","findings":[]}}"#
        ),
        references: vec![],
        checker_id: None,
    };
    assert_eq!(Review::parse(&record, &new).unwrap().fire, old);
    let mut different = new;
    different.index_id = "c".repeat(40);
    assert!(Review::parse(&record, &different).is_err());
}

use cadence::store::{
    self,
    filesystem::{Filesystem, Stage},
    transaction::INTENT,
    writer::{Operation, Store, View},
};
use serde_json::Value;
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
};
#[path = "support/signing.rs"]
mod signing;

struct Allow;
impl store::Policy for Allow {
    fn validate(&mut self, _: &store::MutationContext<'_>) -> store::Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}

struct Repo {
    _temp: tempfile::TempDir,
    root: PathBuf,
}
impl Repo {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("repo");
        fs::create_dir_all(root.join(".planning/phases/7")).unwrap();
        let key = signing::generate(&root);
        let repo = Self { _temp: temp, root };
        repo.git(&["init", "-q"]);
        for (key, value) in [
            ("user.name", "John Crenshaw"),
            ("user.email", "john@jcrenshaw.dev"),
            ("gpg.format", "openpgp"),
            ("gpg.program", "gpg"),
            ("user.signingkey", key.as_str()),
            ("commit.gpgsign", "true"),
        ] {
            repo.git(&["config", "--local", key, value]);
        }
        repo.write(
            ".planning/ROADMAP.md",
            b"## Phases\n- [ ] **Phase 7: Risk**\n",
        );
        repo.write(".planning/config.json", br#"{"review":{"triggers":{"risk_surface":{"surfaces":["auth","migrations","billing","concurrency","destructive","secrets","api_contract","untrusted_input"]}}}}"#);
        repo.write("work.txt", b"initial\n");
        repo.commit(&["work.txt", ".planning/ROADMAP.md", ".planning/config.json"]);
        repo
    }
    fn git(&self, args: &[&str]) -> String {
        let output = Command::new("git")
            .current_dir(&self.root)
            .env("GNUPGHOME", signing::home(&self.root))
            .args(args)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap().trim().into()
    }
    fn write(&self, path: &str, body: &[u8]) {
        let path = self.root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }
    fn commit(&self, paths: &[&str]) -> String {
        let mut args = vec!["add", "--"];
        args.extend_from_slice(paths);
        self.git(&args);
        self.git(&["commit", "-q", "-S", "-m", "feat(7): fixture material"]);
        self.git(&["rev-parse", "HEAD"])
    }
    fn request(&self, id: &str, base: &str, head: &str) -> Value {
        json!({"operation":"risk-check","request_id":id,"scope":{"phase":7,"occurrence":"risk-1","worker":null},"source":{"kind":"committed","base":base,"head":head},"surfaces":null})
    }
    fn view(&self) -> View {
        runtime().block_on(async {
            Store::open(Filesystem::new(self.root.join(".planning")).unwrap(), Allow)
                .await
                .unwrap()
                .request(Operation::ReadVerified)
                .await
                .unwrap()
        })
    }
    fn call(&self, input: Value) -> Value {
        let mut client = Client::new(&self.root);
        let result = client.call("cadence_apply", input);
        client.finish();
        assert!(result.get("error").is_none(), "{result}");
        result["result"]["structuredContent"].clone()
    }
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
        let mut client = Self {
            input: child.stdin.take().unwrap(),
            output: BufReader::new(child.stdout.take().unwrap()),
            child,
        };
        client.send(json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"risk-probe","version":"1"}}}));
        assert!(client.recv().get("error").is_none());
        client.send(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
        client
    }
    fn send(&mut self, value: Value) {
        writeln!(self.input, "{value}").unwrap();
        self.input.flush().unwrap();
    }
    fn recv(&mut self) -> Value {
        let mut line = String::new();
        self.output.read_line(&mut line).unwrap();
        serde_json::from_str(&line).unwrap()
    }
    fn call(&mut self, tool: &str, input: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":tool,"arguments":input}}));
        self.recv()
    }
    fn finish(mut self) {
        drop(self.input);
        assert!(self.child.wait().unwrap().success());
    }
}

#[test]
fn public_range_records_exact_material_without_a_review_pass_and_replays_lost_reply() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"JSON.parse(input)\n");
    let head = repo.commit(&["work.txt"]);
    let request = repo.request("recorded", &base, &head);
    let answer = repo.call(request.clone());
    assert_eq!(answer["status"], "ok", "{answer}");
    assert_eq!(
        answer["observation"]["resolution"],
        json!({"base_id":base,"head_id":head,"index_id":null})
    );
    assert_eq!(
        answer["observation"]["scan"]["matches"][0]["category"],
        "untrusted_input"
    );
    let view = repo.view();
    let record: risk::Recorded = serde_json::from_value(
        json!({"observation":answer["observation"],"confirmation":answer["confirmation"]}),
    )
    .unwrap();
    assert_eq!(
        risk::confirmed(&view, &record.observation.scope, "recorded").unwrap(),
        Some(record.clone())
    );
    assert!(view.decisions.contains(&record.decision().unwrap()));
    assert_eq!(
        cadence::evidence::persistence::read(&view.snapshot.data)
            .unwrap()
            .len(),
        0
    );
    assert!(view.snapshot.data.get("execution").is_none());
    assert!(!repo.root.join(".planning/phases/7/SUMMARY.md").exists());
    assert_eq!(repo.call(request.clone()), answer);
    assert_eq!(repo.view(), view);
    // Discard a reply after acceptance, then reopen and replay exactly that observation.
    let mut lost = request.clone();
    lost["request_id"] = json!("lost");
    let mut client = Client::new(&repo.root);
    client.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"cadence_apply","arguments":lost}}));
    client.finish();
    let before = repo.view();
    let retry = repo.call(lost);
    assert_eq!(retry["status"], "ok");
    assert_eq!(repo.view(), before);
    let mut reused = request;
    reused["source"]["head"] = json!(base);
    assert_eq!(repo.call(reused)["code"], "request-reused");
    assert_eq!(repo.view(), before);
}

#[test]
fn rail_writer_confirms_atomic_namespace_preservation_and_recovers_persistence_faults() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"JSON.parse(input)\n");
    let head = repo.commit(&["work.txt"]);
    let answer = repo.call(repo.request("sample", &base, &head));
    let observation: risk::Observation =
        serde_json::from_value(answer["observation"].clone()).unwrap();
    for (stage, target) in [
        (Stage::Renamed, INTENT),
        (Stage::Renamed, "decisions.jsonl"),
        (Stage::Confirmation, "state.json"),
    ] {
        let dir = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            let initial = Store::open(Filesystem::new(dir.path()).unwrap(), Allow).await.unwrap();
            let seed = json!({"execution":{"opaque":"preserve"},"native_evidence":{"old":true},"pause":{"old":true},"import":{"old":true},"current":{"old":true}});
            let view = initial.request(Operation::RewriteSnapshot(seed.clone())).await.unwrap();
            let record = risk::Recorded::new(observation.clone(), view.snapshot.generation + 1).unwrap();
            let store = Store::open(Filesystem::new(dir.path()).unwrap().with_probe(move |at, path| {
                if at == stage && path.file_name().is_some_and(|name| name == target) { return Err(store::Error::Io("injected rail confirmation fault".into())); } Ok(())
            }), Allow).await.unwrap();
            let operation = || Operation::RailObservation { expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity.clone(), record: Box::new(record.clone()) };
            assert!(store.request(operation()).await.is_err());
            assert!(store.request(operation()).await.is_err());
            let reopened = Store::open(Filesystem::new(dir.path()).unwrap(), Allow).await.unwrap();
            let recovered = reopened.request(operation()).await.unwrap();
            for (key, value) in seed.as_object().unwrap() { assert_eq!(&recovered.snapshot.data[key], value); }
            assert_eq!(recovered.decisions, vec![record.decision().unwrap()]);
            assert_eq!(risk::confirmed(&recovered, &record.observation.scope, &record.observation.request_id).unwrap(), Some(record.clone()));
            assert_eq!(reopened.request(operation()).await.unwrap(), recovered);
        });
    }
}

#[test]
fn public_persistence_failure_never_returns_a_recorded_success() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"JSON.parse(input)\n");
    let head = repo.commit(&["work.txt"]);
    repo.call(repo.request("initialize", &base, &head));
    let before = repo.view();
    let mut client = Client::new(&repo.root);
    fs::create_dir(repo.root.join(".planning").join(INTENT)).unwrap();
    let answer = client.call("cadence_apply", repo.request("fault", &base, &head));
    assert_eq!(answer["error"]["code"], -32603, "{answer}");
    client.finish();
    fs::remove_dir(repo.root.join(".planning").join(INTENT)).unwrap();
    assert_eq!(repo.view(), before);
}
