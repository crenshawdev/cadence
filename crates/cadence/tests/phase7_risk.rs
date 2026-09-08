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
        json!({"kind":"committed","base_id":base,"head_id":head})
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

fn scan_of(answer: &Value) -> risk_diff::Scan {
    assert_eq!(answer["status"], "ok", "{answer}");
    serde_json::from_value(answer["observation"]["scan"].clone()).unwrap()
}

#[test]
fn real_added_and_removed_lines_classify_all_eight_categories_in_table_order() {
    let repo = Repo::new();
    let cases = [
        ("auth", "jwt.verify(token)"),
        ("migrations", "ALTER TABLE example"),
        ("billing", "stripe"),
        ("concurrency", "Mutex"),
        ("destructive", "DROP TABLE example"),
        ("secrets", "APP_SECRET=value"),
        ("api_contract", "router.get('/example')"),
        ("untrusted_input", "JSON.parse(input)"),
    ];
    for (category, line) in cases {
        let base = repo.git(&["rev-parse", "HEAD"]);
        repo.write("work.txt", format!("{line}\n").as_bytes());
        let head = repo.commit(&["work.txt"]);
        let scan = scan_of(&repo.call(repo.request(&format!("add-{category}"), &base, &head)));
        assert!(scan.checked && !scan.inconclusive && !scan.empty);
        assert!(
            scan.matches
                .iter()
                .any(|m| m.category == category && m.signal.starts_with("changed line:")),
            "{scan:?}"
        );
        repo.write("work.txt", b"ordinary\n");
        let removed = repo.commit(&["work.txt"]);
        let scan =
            scan_of(&repo.call(repo.request(&format!("remove-{category}"), &head, &removed)));
        assert!(
            scan.matches.iter().any(|m| m.category == category),
            "{scan:?}"
        );
    }
}

#[test]
fn real_paths_keep_unicode_spaces_tabs_extensions_and_both_rename_endpoints() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    let paths = [
        "auth/naïve space\tfile.txt",
        "migrations/change.txt",
        "billing/tariff.txt",
        "workers/one.txt",
        "unicode/ключ space\tname.key",
        "wire/example.proto",
    ];
    for path in paths {
        repo.write(path, b"ordinary\n");
    }
    let head = repo.commit(&paths);
    let scan = scan_of(&repo.call(repo.request("paths", &base, &head)));
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        [
            "auth",
            "migrations",
            "billing",
            "concurrency",
            "secrets",
            "api_contract"
        ]
    );
    assert!(
        scan.matches
            .iter()
            .all(|m| !m.signal.starts_with("changed line"))
    );
    repo.git(&["mv", "auth/naïve space\tfile.txt", "renamed.txt"]);
    repo.git(&["commit", "-q", "-S", "-m", "feat(7): fixture rename"]);
    let renamed = repo.git(&["rev-parse", "HEAD"]);
    let scan = scan_of(&repo.call(repo.request("rename", &head, &renamed)));
    assert_eq!(scan.matches[0].category, "auth");
    let material = MaterialIdentity::Committed {
        base_id: head,
        head_id: renamed,
    };
    let diff = cadence::rail::git::diff(&repo.root, &material).unwrap();
    assert_eq!(
        diff.paths,
        vec![
            PathBuf::from("auth/naïve space\tfile.txt"),
            PathBuf::from("renamed.txt")
        ]
    );
}

#[test]
fn unchanged_context_is_not_changed_content_in_a_real_diff() {
    let repo = Repo::new();
    repo.write("work.txt", b"DROP TABLE context\nold\n");
    let base = repo.commit(&["work.txt"]);
    repo.write("work.txt", b"DROP TABLE context\nnew\n");
    let head = repo.commit(&["work.txt"]);
    let scan = scan_of(&repo.call(repo.request("context", &base, &head)));
    assert!(scan.checked && !scan.inconclusive && scan.matches.is_empty());
}

#[test]
fn only_the_four_reviewer_pathspecs_exclude_material_and_planning_prose_is_scanned() {
    let repo = Repo::new();
    for (n, name) in [
        "ADJUDICATION-fixture.json",
        "REVIEW-fixture.md",
        "FINDINGS.json",
        "verifier-findings.json",
    ]
    .iter()
    .enumerate()
    {
        let base = repo.git(&["rev-parse", "HEAD"]);
        let path = format!(".planning/phases/7/{name}");
        repo.write(&path, b"DROP TABLE example\n");
        let head = repo.commit(&[&path]);
        let scan = scan_of(&repo.call(repo.request(&format!("exclude-{n}"), &base, &head)));
        assert!(
            scan.checked && scan.empty && !scan.inconclusive && scan.matches.is_empty(),
            "{name}: {scan:?}"
        );
    }
    for (n, path) in [
        ".planning/phases/7/PLAN-3.md",
        ".planning/phases/7/CONTEXT.md",
        ".planning/phases/7/reports/plan-3.md",
        "docs/REVIEW-fixture.md",
        "Cargo.lock",
    ]
    .iter()
    .enumerate()
    {
        let base = repo.git(&["rev-parse", "HEAD"]);
        repo.write(path, b"DROP TABLE example\n");
        let head = repo.commit(&[path]);
        let scan = scan_of(&repo.call(repo.request(&format!("included-{n}"), &base, &head)));
        assert!(
            scan.matches.iter().any(|m| m.category == "destructive"),
            "{path}: {scan:?}"
        );
    }
}

#[test]
fn binary_gitlink_and_undecodable_material_are_inconclusive_without_hiding_readable_matches() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("binary", b"\0\xff\0");
    let binary = repo.commit(&["binary"]);
    let scan = scan_of(&repo.call(repo.request("binary", &base, &binary)));
    assert!(scan.checked && scan.inconclusive && !scan.empty);
    repo.git(&[
        "update-index",
        "--add",
        "--cacheinfo",
        &format!("160000,{base},module"),
    ]);
    repo.git(&["commit", "-q", "-S", "-m", "feat(7): fixture gitlink"]);
    let link = repo.git(&["rev-parse", "HEAD"]);
    let scan = scan_of(&repo.call(repo.request("gitlink", &binary, &link)));
    assert!(scan.checked && scan.inconclusive && !scan.empty);
    repo.write(".gitattributes", b"undecodable diff\n");
    repo.write("undecodable", b"line\xff\n");
    repo.write("work.txt", b"JSON.parse(input)\n");
    let bad = repo.commit(&[".gitattributes", "undecodable", "work.txt"]);
    let scan = scan_of(&repo.call(repo.request("undecodable", &link, &bad)));
    assert!(
        scan.checked
            && scan.inconclusive
            && scan.matches.iter().any(|m| m.category == "untrusted_input")
    );
}

#[cfg(unix)]
#[test]
fn non_utf8_git_paths_remain_unreadable_evidence_instead_of_lossy_clean_paths() {
    use std::os::unix::ffi::OsStrExt;
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    let name = std::ffi::OsStr::from_bytes(b"bad-\xff");
    fs::write(repo.root.join(name), b"ordinary\n").unwrap();
    let output = Command::new("git")
        .current_dir(&repo.root)
        .args([
            std::ffi::OsStr::new("add"),
            std::ffi::OsStr::new("--"),
            name,
        ])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success());
    repo.git(&["commit", "-q", "-S", "-m", "feat(7): fixture byte path"]);
    let head = repo.git(&["rev-parse", "HEAD"]);
    let scan = scan_of(&repo.call(repo.request("byte-path", &base, &head)));
    assert!(scan.checked && scan.inconclusive && !scan.empty);
}

#[test]
fn external_diff_and_textconv_are_disabled_for_names_and_patch_body() {
    use std::os::unix::fs::PermissionsExt;
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    let helper = repo._temp.path().join("helper");
    let sentinel = repo._temp.path().join("helper-ran");
    fs::write(
        &helper,
        format!(
            "#!/bin/sh\ntouch '{}'\nprintf 'DROP TABLE fabricated\\n'\n",
            sentinel.display()
        ),
    )
    .unwrap();
    fs::set_permissions(&helper, fs::Permissions::from_mode(0o700)).unwrap();
    repo.git(&[
        "config",
        "--local",
        "diff.external",
        helper.to_str().unwrap(),
    ]);
    repo.git(&[
        "config",
        "--local",
        "diff.probe.textconv",
        helper.to_str().unwrap(),
    ]);
    repo.git(&["config", "--local", "color.ui", "always"]);
    repo.write(".gitattributes", b"work.txt diff=probe\n");
    repo.write("work.txt", b"JSON.parse(input)\n");
    let head = repo.commit(&[".gitattributes", "work.txt"]);
    let scan = scan_of(&repo.call(repo.request("helpers", &base, &head)));
    assert!(!sentinel.exists());
    assert!(!scan.inconclusive);
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["untrusted_input"]
    );
}

#[test]
fn failed_ref_and_blob_reads_record_unchecked_observations_with_partial_endpoints() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"JSON.parse(input)\n");
    let head = repo.commit(&["work.txt"]);
    for (id, left, right, expected) in [
        (
            "bad-base",
            "missing",
            head.as_str(),
            json!({"kind":"committed","base_id":null,"head_id":head}),
        ),
        (
            "bad-head",
            base.as_str(),
            "missing",
            json!({"kind":"committed","base_id":base,"head_id":null}),
        ),
    ] {
        let answer = repo.call(repo.request(id, left, right));
        let scan = scan_of(&answer);
        assert!(!scan.checked && scan.inconclusive && !scan.empty && scan.matches.is_empty());
        assert_eq!(answer["observation"]["resolution"], expected);
    }
    let blob = repo.git(&["rev-parse", "HEAD:work.txt"]);
    fs::remove_file(
        repo.root
            .join(".git/objects")
            .join(&blob[..2])
            .join(&blob[2..]),
    )
    .unwrap();
    let answer = repo.call(repo.request("bad-blob", &base, &head));
    let scan = scan_of(&answer);
    assert!(!scan.checked && scan.inconclusive && !scan.empty);
    assert_eq!(answer["observation"]["resolution"]["head_id"], head);
    assert!(
        !answer["observation"]["diagnostics"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(risk::read(&repo.view().snapshot.data).unwrap().len(), 3);
}

#[test]
fn strict_scope_source_and_surface_validation_refuse_without_a_scan_or_policy_change() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"JSON.parse(input)\n");
    let head = repo.commit(&["work.txt"]);
    let request = repo.request("valid", &base, &head);
    repo.call(request.clone());
    let before = repo.view();
    for (pointer, value) in [
        ("/scope/phase", json!(0)),
        ("/scope/phase", json!(999)),
        ("/scope/worker", json!("../foreign")),
        ("/scope/occurrence", json!("")),
        ("/source", json!({"kind":"staged","base":base,"head":head})),
        ("/surfaces", json!([])),
        ("/surfaces", json!(["auth", "auth"])),
        ("/surfaces", json!(["unknown"])),
    ] {
        let mut input = request.clone();
        input["request_id"] = json!("invalid");
        *input.pointer_mut(pointer).unwrap() = value;
        assert_eq!(repo.call(input)["status"], "refused");
        assert_eq!(repo.view(), before);
    }
    let config = repo.root.join(".planning/config.v4.json");
    let mut value: Value = serde_json::from_slice(&fs::read(&config).unwrap()).unwrap();
    value["review"]["triggers"]["risk_surface"]["surfaces"] = Value::Null;
    fs::write(&config, serde_json::to_vec(&value).unwrap()).unwrap();
    let mut input = request;
    input["request_id"] = json!("explicit");
    assert_eq!(repo.call(input.clone())["code"], "unanswered-surfaces");
    let bytes = fs::read(&config).unwrap();
    input["surfaces"] = json!(["auth"]);
    let scan = scan_of(&repo.call(input.clone()));
    assert!(scan.checked && scan.matches.is_empty());
    assert_eq!(scan.categories, ["auth"]);
    assert_eq!(fs::read(&config).unwrap(), bytes);
    let recorded = repo.view();
    fs::write(&config, b"{").unwrap();
    input["request_id"] = json!("torn");
    assert_eq!(repo.call(input)["status"], "refused");
    fs::write(&config, bytes).unwrap();
    assert_eq!(repo.view(), recorded);
}

#[test]
fn staged_scan_reads_the_captured_index_instead_of_unstaged_worktree_bytes() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"DROP TABLE staged\n");
    repo.git(&["add", "--", "work.txt"]);
    let index = repo.git(&["write-tree"]);
    repo.write("work.txt", b"JSON.parse(unstaged)\n");
    let mut request = repo.request("staged", &base, "HEAD");
    request["source"] = json!({"kind":"staged","base":base});
    request["scope"]["worker"] = json!("3");
    let answer = repo.call(request);
    let scan = scan_of(&answer);
    assert!(scan.checked && !scan.inconclusive && !scan.empty);
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["destructive"]
    );
    assert_eq!(
        answer["observation"]["resolution"],
        json!({"kind":"staged","base_id":base,"index_id":index})
    );
    assert_eq!(answer["observation"]["scope"]["worker"], "3");
}

#[test]
fn unreadable_index_records_unchecked_staged_observation_with_resolved_base() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    let index_path = repo.root.join(".git/index");
    let bytes = fs::read(&index_path).unwrap();
    fs::write(&index_path, b"bad-index").unwrap();
    let mut request = repo.request("bad-index", &base, "HEAD");
    request["source"] = json!({"kind":"staged","base":base});
    let answer = repo.call(request);
    let scan = scan_of(&answer);
    assert!(!scan.checked && scan.inconclusive && !scan.empty);
    assert_eq!(
        answer["observation"]["resolution"],
        json!({"kind":"staged","base_id":base,"index_id":null})
    );
    fs::write(index_path, bytes).unwrap();
    assert_eq!(risk::read(&repo.view().snapshot.data).unwrap().len(), 1);
}

#[test]
fn no_commit_range_is_distinct_from_excluded_commits_empty_staging_and_zero_net_diff() {
    let repo = Repo::new();
    let original = repo.git(&["rev-parse", "HEAD"]);
    repo.git(&["branch", "same-commit", "HEAD"]);
    let mut no_ranges = Vec::new();
    for (id, base, head) in [("same", "HEAD", "HEAD"), ("aliases", "same-commit", "HEAD")] {
        let answer = repo.call(repo.request(id, base, head));
        assert_eq!(answer["status"], "ok", "{answer}");
        assert_eq!(answer["observation"]["outcome"], "no-range");
        assert!(answer["observation"]["scan"].is_null());
        assert_eq!(
            answer["observation"]["resolution"],
            json!({"kind":"committed","base_id":original,"head_id":original})
        );
        no_ranges.push(
            answer["confirmation"]["decision_id"]
                .as_str()
                .unwrap()
                .to_owned(),
        );
    }
    repo.write(
        ".planning/phases/7/REVIEW-only.md",
        b"DROP TABLE excluded\n",
    );
    let excluded = repo.commit(&[".planning/phases/7/REVIEW-only.md"]);
    assert_ne!(excluded, original);
    let answer = repo.call(repo.request("excluded-commits", &original, &excluded));
    assert_eq!(answer["observation"]["outcome"], "checked");
    let scan = scan_of(&answer);
    assert!(scan.checked && scan.empty && !scan.inconclusive);
    let mut staged = repo.request("empty-staged", &excluded, "HEAD");
    staged["source"] = json!({"kind":"staged","base":excluded});
    let answer = repo.call(staged);
    let scan = scan_of(&answer);
    assert_eq!(answer["observation"]["outcome"], "checked");
    assert!(scan.checked && scan.empty && !scan.inconclusive);
    let resolution = &answer["observation"]["resolution"];
    assert_eq!(resolution["kind"], "staged");
    assert!(resolution.get("head_id").is_none());
    assert_eq!(
        resolution["index_id"],
        repo.git(&["rev-parse", "HEAD^{tree}"])
    );
    repo.git(&[
        "commit",
        "-q",
        "-S",
        "--allow-empty",
        "-m",
        "feat(7): fixture empty commit",
    ]);
    let empty_commit = repo.git(&["rev-parse", "HEAD"]);
    let answer = repo.call(repo.request("empty-commit", &excluded, &empty_commit));
    let scan = scan_of(&answer);
    assert!(scan.checked && scan.empty && !scan.inconclusive);
    assert_eq!(answer["observation"]["outcome"], "checked");
    let view = repo.view();
    let records = risk::read(&view.snapshot.data).unwrap();
    assert_eq!(records.len(), 5);
    for id in no_ranges {
        let record = &records[&id];
        assert_eq!(
            record.observation.outcome,
            risk::ObservationOutcome::NoRange
        );
        assert!(record.observation.scan.is_none());
        assert!(
            matches!(&record.decision().unwrap().decision, store::model::Decision::Gate { outcome, .. } if outcome == "risk-skipped-no-range")
        );
        let mut false_clean = record.observation.clone();
        false_clean.outcome = risk::ObservationOutcome::Checked;
        false_clean.scan = Some(risk_diff::scan(Some(b""), &[], &false_clean.surfaces).unwrap());
        assert!(false_clean.validate().is_err());
    }
}

#[test]
fn moving_refs_and_changing_staged_bytes_cannot_relabel_captured_objects() {
    use cadence::rail::git;
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"DROP TABLE committed\n");
    let first = repo.commit(&["work.txt"]);
    repo.git(&["branch", "moving", &first]);
    let (resolved, diagnostics) = git::resolve(
        &repo.root,
        &risk::Source::Committed {
            base: base.clone(),
            head: "moving".into(),
        },
    );
    assert!(diagnostics.is_empty());
    repo.write("work.txt", b"JSON.parse(newer)\n");
    let second = repo.commit(&["work.txt"]);
    repo.git(&["update-ref", "refs/heads/moving", &second]);
    let material = resolved.material().unwrap();
    assert_eq!(material.tip_id(), first);
    let scan = git::scan(&repo.root, &material, &risk::CATEGORIES.map(str::to_owned)).unwrap();
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["destructive"]
    );
    repo.write("work.txt", b"Mutex staged-first\n");
    repo.git(&["add", "--", "work.txt"]);
    let source = risk::Source::Staged { base: base.clone() };
    let (old, diagnostics) = git::resolve(&repo.root, &source);
    assert!(diagnostics.is_empty());
    repo.write("work.txt", b"jwt.verify(staged_second)\n");
    repo.git(&["add", "--", "work.txt"]);
    let (new, diagnostics) = git::resolve(&repo.root, &source);
    assert!(diagnostics.is_empty());
    assert_ne!(
        old.material().unwrap().tip_id(),
        new.material().unwrap().tip_id()
    );
    let scan = git::scan(
        &repo.root,
        &old.material().unwrap(),
        &risk::CATEGORIES.map(str::to_owned),
    )
    .unwrap();
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["concurrency"]
    );
    let scan = git::scan(
        &repo.root,
        &new.material().unwrap(),
        &risk::CATEGORIES.map(str::to_owned),
    )
    .unwrap();
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["auth"]
    );
    assert!(
        git::diff(
            &repo.root,
            &MaterialIdentity::Committed {
                base_id: base,
                head_id: "moving".into()
            }
        )
        .is_err()
    );
}

impl Repo {
    fn execution() -> Self {
        let repo = Self::new();
        repo.write(".planning/phases/7/PLAN-1.md", b"---\nphase: 7\nplan: 1\nrequirements: [AC7]\nfiles: [work.txt]\nexecution:\n  schema: 1\n  suite: printf suite\n  tasks:\n    - id: T1\n      verify: [printf T1]\n    - id: T2\n      verify: [printf T2]\n---\nChange the declared work file.\n");
        repo.commit(&[".planning/phases/7/PLAN-1.md"]);
        repo.call(repo.request("bootstrap", "HEAD", "HEAD"));
        let planning = repo.root.join(".planning");
        let mut record = json!({"version":1,"scope":{"project":repo.root,"planning_root":planning,"cycle":"live","occurrence":"phase-7-execution","phase":"7","plan":"native-execution","report":"phases/7/SUMMARY.md"},"fact":{"kind":"gate","value":{"id":"fixture-progress","purpose":"progress","checkpoint_id":null,"question":"Continue?","need":"Execution authority","options":[],"state":{"status":"unanswered"}}}});
        runtime().block_on(async {
            let store = Store::open(Filesystem::new(&planning).unwrap(), Allow).await.unwrap();
            for (index, state) in [json!({"status":"unanswered"}), json!({"status":"answered","value":{"question_id":"fixture-progress","actual_response":"Proceed","selected_option":null,"adjustment":null,"disposition":"approve","authorization_id":"fixture-authorization"}})].into_iter().enumerate() {
                record["fact"]["value"]["state"] = state;
                let native: cadence::evidence::Record = serde_json::from_value(record.clone()).unwrap();
                let view = store.request(Operation::ReadVerified).await.unwrap(); let id = format!("fixture-authority-{index}");
                store.request(Operation::Transact(store::transaction::Transaction { id: id.clone(), items: vec![], decisions: vec![cadence::evidence::persistence::history(&id, &native).unwrap()], snapshot: Some(cadence::evidence::persistence::project(&view.snapshot.data, &native).unwrap()), external: vec![] })).await.unwrap();
            }
        });
        repo
    }
    fn dispatch(&self) -> Value {
        let mut client = Client::new(&self.root);
        let raw = client.call(
            "cadence_query",
            json!({"operation":"execute-next","phase":7}),
        );
        client.finish();
        let answer = &raw["result"]["structuredContent"];
        assert_eq!(answer["outcome"], "dispatch", "{raw}");
        answer["dispatch"].clone()
    }
    fn complete_execution(&self, dispatch: &Value) -> Vec<String> {
        let mut tasks = Vec::new();
        let mut commits = Vec::new();
        for (i, task) in ["T1", "T2"].into_iter().enumerate() {
            self.write(
                "work.txt",
                format!("JSON.parse(accepted)\nordinary-{i}\n").as_bytes(),
            );
            let output = Command::new("printf")
                .arg(task)
                .stdin(Stdio::null())
                .output()
                .unwrap();
            assert!(output.status.success());
            self.git(&["add", "--", "work.txt"]);
            self.git(&[
                "commit",
                "-q",
                "-S",
                "-m",
                &format!("feat(7): fixture task {task}"),
            ]);
            let commit = self.git(&["rev-parse", "HEAD"]);
            assert_eq!(self.git(&["log", "-1", "--format=%G?"]), "G");
            tasks.push(json!({"status":"completed","task_id":task,"commit":commit,"verification":{"disposition":"passed","commands":[{"command":format!("printf {task}"),"exit_code":0,"output_digest":store::model::digest(&output.stdout)}]},"evidence":[{"kind":"commit","sha":commit}]}));
            commits.push(commit);
        }
        let suite = Command::new("printf")
            .arg("suite")
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(suite.status.success());
        let answer = self.call(json!({"schema":1,"kind":"executor","dispatch_id":dispatch["id"],"expected_execution_version":dispatch["expected_execution_version"],"outcome":"complete","tasks":tasks,"deviations":[],"blockers":[]}));
        assert_eq!(answer["outcome"], "complete", "{answer}");
        commits
    }
    fn execution_request(&self, id: &str, dispatch: &Value) -> Value {
        json!({"operation":"risk-check","request_id":id,"scope":{"phase":7,"occurrence":"phase-7-execution","worker":"1"},"source":{"kind":"execution","plan":1,"dispatch_id":dispatch["id"]},"surfaces":null})
    }
}

#[test]
fn public_execution_source_uses_only_the_retained_dispatch_base_and_accepted_task_range() {
    let repo = Repo::execution();
    let dispatch = repo.dispatch();
    let missing = repo.call(repo.execution_request("not-accepted", &dispatch));
    assert_eq!(missing["code"], "missing-execution-material");
    let commits = repo.complete_execution(&dispatch);
    let before = repo.view();
    let bases = risk::execution_bases(&before.snapshot.data).unwrap();
    let basis = &bases[dispatch["id"].as_str().unwrap()];
    assert_eq!(basis.base_id, dispatch["base_sha"].as_str().unwrap());
    assert_eq!(basis.commits, commits);
    assert!(before.snapshot.data["execution"]["occurrences"]["7"]["active"].is_null());
    repo.write("later.txt", b"stripe\n");
    let later = repo.commit(&["later.txt"]);
    repo.write(
        ".planning/phases/7/reports/plan-1.md",
        format!("Invented base {later}; invented head {later}. DROP TABLE prose\n").as_bytes(),
    );
    let summary = fs::read(repo.root.join(".planning/phases/7/SUMMARY.md")).unwrap();
    let answer = repo.call(repo.execution_request("execution-risk", &dispatch));
    let scan = scan_of(&answer);
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["untrusted_input"]
    );
    assert_eq!(
        answer["observation"]["resolution"],
        json!({"kind":"committed","base_id":dispatch["base_sha"],"head_id":commits.last().unwrap()})
    );
    assert_eq!(
        answer["observation"]["source"],
        json!({"kind":"execution","plan":1,"dispatch_id":dispatch["id"]})
    );
    assert_eq!(answer["observation"]["scope"]["plan"], 1);
    assert_eq!(answer["observation"]["scope"]["worker"], "1");
    let after = repo.view();
    assert_eq!(
        after.snapshot.data["execution"],
        before.snapshot.data["execution"]
    );
    assert_eq!(
        after.snapshot.data["native_evidence"],
        before.snapshot.data["native_evidence"]
    );
    assert_eq!(
        fs::read(repo.root.join(".planning/phases/7/SUMMARY.md")).unwrap(),
        summary
    );
    repo.write(
        ".planning/phases/7/reports/plan-1.md",
        b"entirely different report and refs\n",
    );
    let second = repo.call(repo.execution_request("execution-risk-again", &dispatch));
    assert_eq!(
        second["observation"]["resolution"],
        answer["observation"]["resolution"]
    );
    assert_eq!(second["observation"]["scan"], answer["observation"]["scan"]);
    let before = repo.view();
    for (pointer, value) in [
        ("/scope/occurrence", json!("foreign")),
        ("/source/plan", json!(2)),
        ("/source/dispatch_id", json!("foreign")),
        ("/scope/worker", json!("foreign")),
    ] {
        let mut input = repo.execution_request("foreign-risk", &dispatch);
        *input.pointer_mut(pointer).unwrap() = value;
        assert_eq!(repo.call(input)["status"], "refused");
        assert_eq!(repo.view(), before);
    }
}

#[test]
fn pause_authored_tree_and_shared_diff_observe_identical_immutable_bytes() {
    let repo = Repo::new();
    let base = repo.git(&["rev-parse", "HEAD"]);
    repo.write("work.txt", b"JSON.parse(authored)\n");
    repo.write("receipt.json", b"DROP TABLE receipt\n");
    repo.git(&["add", "--", "work.txt", "receipt.json"]);
    let receipts = [PathBuf::from("receipt.json")].into_iter().collect();
    let paused = cadence::pause::git::staged(&repo.root, &base, &receipts).unwrap();
    assert_eq!(paused.authored, [PathBuf::from("work.txt")]);
    let material = MaterialIdentity::Staged {
        base_id: paused.base.clone(),
        index_id: paused.index_id.clone(),
    };
    let shared =
        cadence::rail::git::diff_selected(&repo.root, &material, &paused.authored).unwrap();
    assert_eq!(shared.body, paused.diff);
    assert_eq!(shared.paths, paused.authored);
    let scan =
        cadence::rail::git::scan(&repo.root, &material, &risk::CATEGORIES.map(str::to_owned))
            .unwrap();
    assert_eq!(
        scan,
        risk_diff::scan(
            Some(&paused.diff),
            &paused.authored,
            &risk::CATEGORIES.map(str::to_owned)
        )
        .unwrap()
    );
    assert_eq!(
        scan.matches
            .iter()
            .map(|m| m.category.as_str())
            .collect::<Vec<_>>(),
        ["untrusted_input"]
    );
    repo.write("receipt.json", b"changed binary receipt\n");
    repo.git(&["add", "--", "receipt.json"]);
    let again = cadence::pause::git::staged(&repo.root, &base, &receipts).unwrap();
    assert_eq!(again.index_id, paused.index_id);
    assert_eq!(again.diff, paused.diff);
    repo.write("work.txt", b"unrelated live worktree\n");
    repo.git(&["add", "--", "work.txt"]);
    let old = cadence::rail::git::diff_selected(&repo.root, &material, &paused.authored).unwrap();
    assert_eq!(old.body, paused.diff);
}
