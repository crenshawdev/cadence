//! D-160: the store's own staging files are the binary's, never the user's.
//!
//! A commit stages `.planning/.state.json.<pid>.<seq>.tmp` beside its target,
//! then re-observes the source before every rename. A project that tracks its
//! `.planning` documents in Git, ignoring only the store files, saw those
//! staging names as untracked and refused its own write as
//! `evidence-source-dirty`. Every other fixture ignores `.planning/` whole,
//! which is why no test saw it before verify-next ran on the rewrite itself.
use cadence::execution::runner;
use cadence::store::filesystem::{Filesystem, Stage};
use cadence::store::model::{Disposition, Evidence, ItemRecord, Origin, VERSION};
use cadence::store::writer::{Operation, Store};
use cadence::store::{MutationContext, Policy, Result};
use cadence::verification::inputs;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

#[path = "support/phase31.rs"]
#[allow(dead_code)]
mod round_support;

#[test]
fn native_suite_repair_accounts_for_installed_untracked_summary() {
    use serde_json::json;

    let mut round = round_support::ClosedRound::admitted();
    round.close_tasks();
    let project = round.fixture.project().to_path_buf();
    let name = ".planning/phases/31/SUMMARY.md";
    let summary_only = vec![("?? ".into(), name.into())];
    assert_eq!(runner::status(&project).unwrap(), summary_only);
    assert_eq!(std::fs::read(project.join(name)).unwrap(), inputs::confirmed_summaries(&project).unwrap()[name]);

    // The admitted command also serves the suite. Give it a recognized failure
    // after the native last close, without adding the installed summary to Git.
    let test = std::fs::read_to_string(project.join("tests/tiny.py")).unwrap();
    let failing = test.replace(", 7)", ", 8)");
    assert_ne!(failing, test);
    std::fs::write(project.join("tests/tiny.py"), failing).unwrap();
    round_support::git(&project, &["add", "tests/tiny.py"]);
    round_support::git(&project, &["commit", "-S", "-m", "test(round): expose suite failure"]);
    let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    let suite = round.client.call("cadence_apply", json!({"operation":"execution-suite","request":{
        "request_id":"summary-suite","plan":round.plan,"expected_version":history["plans"][0]["state"]["version"],
        "proposed_paths":["tests/tiny.py"]}}));
    assert_eq!(suite["status"], "ok", "{suite}");
    let result = round.client.wait_for_event(31, "summary-suite");
    assert_eq!(result["observation"]["summary"]["failed"], true, "{result}");
    let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    let question = &history["plans"][0]["state"]["repair_question"];
    assert_eq!(question["failed_run"], "summary-suite", "{history}");
    let question_id = question["id"].clone();
    let answer = round.client.call("cadence_apply", json!({"operation":"execution-suite-repair-answer","request":{
        "request_id":"summary-repair-answer","plan":round.plan,"expected_version":history["plans"][0]["state"]["version"],
        "question_id":question_id,"owner":"Fixture Owner","at":"2026-09-18T12:00:00Z","disposition":"approve"}}));
    assert_eq!(answer["status"], "ok", "{answer}");
    std::fs::write(project.join("tests/tiny.py"), test).unwrap();
    round_support::git(&project, &["add", "tests/tiny.py"]);
    round_support::git(&project, &["commit", "-S", "-m", "fix(round): repair suite failure"]);
    let commit = round_support::git(&project, &["rev-parse", "HEAD"]);
    let history = round.client.call("cadence_query", json!({"operation":"execution-history","phase":31}));
    let repair = json!({"operation":"execution-suite-repair","request":{
        "request_id":"summary-repair","plan":round.plan,"expected_version":history["plans"][0]["state"]["version"],
        "question_id":question_id,"commits":[commit]}});

    // An owner's edit must still be refused, and cannot consume the repair.
    let installed = std::fs::read(project.join(name)).unwrap();
    assert_eq!(installed, inputs::confirmed_summaries(&project).unwrap()[name]);
    std::fs::write(project.join(name), b"owner edit\n").unwrap();
    let refused = round.client.call("cadence_apply", repair.clone());
    assert_eq!(refused["status"], "refused", "{refused}");
    assert!(refused.to_string().contains("evidence-source-dirty"), "{refused}");
    std::fs::write(project.join(name), installed).unwrap();
    assert_eq!(runner::status(&project).unwrap(), summary_only);
    let repaired = round.client.call("cadence_apply", repair);
    assert_eq!(repaired["status"], "ok", "{repaired}");
    assert_eq!(repaired["receipt"]["request"]["event"]["commits"], json!([commit]));
    assert_eq!(repaired["receipt"]["request"]["event"]["changed_paths"][&commit], json!(["tests/tiny.py"]));
    round.client.finish();
}

#[test]
fn native_summary_accounts_for_exact_untracked_and_modified_bytes() {
    let mut round = round_support::ClosedRound::admitted();
    round.close_tasks();
    let project = round.fixture.project();
    let name = ".planning/phases/31/SUMMARY.md";
    let installed = std::fs::read(project.join(name)).unwrap();
    assert!(runner::status(project).unwrap().contains(&("?? ".into(), name.into())));
    assert!(inputs::source(project).is_ok());
    assert!(runner::material(project, "python3 -B tests/tiny.py", "tests/tiny.py").is_ok());
    std::fs::write(project.join(name), b"owner edit\n").unwrap();
    assert!(inputs::source(project).is_err());
    assert!(runner::material(project, "python3 -B tests/tiny.py", "tests/tiny.py").is_err());
    round_support::git(project, &["add", name]);
    round_support::git(project, &["-c", "commit.gpgsign=false", "commit", "-m", "test(round): track prior summary"]);
    std::fs::write(project.join(name), &installed).unwrap();
    assert!(runner::status(project).unwrap().contains(&(" M ".into(), name.into())));
    assert!(inputs::source(project).is_ok());
    assert!(runner::material(project, "python3 -B tests/tiny.py", "tests/tiny.py").is_ok());
    std::fs::write(project.join("src/other.rs"), "owner edit").unwrap();
    assert!(inputs::source(project).is_err());
    assert!(runner::material(project, "python3 -B tests/tiny.py", "tests/tiny.py").is_err());
}

#[test]
fn native_plan_summary_recovers_after_install_before_snapshot() {
    use cadence::execution::history::{PlanEvent, PlanIdentity, PlanRequest, SuiteLaunch};
    let mut round = round_support::ClosedRound::admitted();
    round.close_tasks();
    let project = round.fixture.project().to_path_buf();
    let plan: PlanIdentity = serde_json::from_value(round.plan.clone()).unwrap();
    round.client.finish();
    let root = project.join(".planning");
    let request = PlanRequest { request_id: "recovery-suite".into(), plan, expected_version: 0,
        event: PlanEvent::SuiteLaunch(SuiteLaunch { run_id: "recovery-suite".into(),
            material: runner::material(&project, "python3 -B tests/tiny.py", "").unwrap(),
            launched_at: 1, proposed_paths: vec![] }) };
    let fired = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let probe = fired.clone();
    let filesystem = Filesystem::new(&root).unwrap().with_probe(move |stage, target| {
        if stage == Stage::Renamed && target.file_name().is_some_and(|n| n == "SUMMARY.md") {
            probe.store(true, std::sync::atomic::Ordering::SeqCst);
            return Err(cadence::store::Error::Invalid("fixture process loss".into()));
        }
        Ok(())
    });
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(filesystem, Allow).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        assert!(store.request(Operation::NativePlanV1 { expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity, request: Box::new(request.clone()) }).await.is_err());
    });
    assert!(fired.load(std::sync::atomic::Ordering::SeqCst));
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(Filesystem::new(&root).unwrap(), Allow).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        let events = cadence::execution::history::plan_records(&view.snapshot.data, 31).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].request, request);
        let installed = cadence::execution::render::installed_summaries(&view.snapshot.data).unwrap();
        assert_eq!(std::fs::read(project.join(".planning/phases/31/SUMMARY.md")).unwrap(), installed[".planning/phases/31/SUMMARY.md"]);
        assert!(inputs::source(&project).is_ok());
    });
}

#[test]
fn native_last_close_recovers_its_summary_and_receipt() {
    use cadence::execution::{history, receipts};
    let Ok(project) = std::env::var("CADENCE_SUMMARY_RECOVERY_PROJECT") else {
        let mut round = round_support::ClosedRound::admitted();
        let close = round.prepare_last_close();
        let project = round.fixture.project().to_path_buf();
        round.client.finish();
        // The bounded history index is not the full retained close-proof input.
        let snapshot = cadence::context::persistence::read_snapshot(&project.join(".planning")).unwrap().unwrap();
        let dispatch = &snapshot.data["execution"]["occurrences"]["31"]["active"];
        let result = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "native_last_close_recovers_its_summary_and_receipt", "--nocapture"])
            .env("CADENCE_SUMMARY_RECOVERY_PROJECT", &project)
            .env("CADENCE_SUMMARY_RECOVERY_CLOSE", close.to_string())
            .env("CADENCE_SUMMARY_RECOVERY_DISPATCH", dispatch.to_string())
            .env("GNUPGHOME", project.join(".fixture-gnupg"))
            .env("GIT_CONFIG_GLOBAL", "/dev/null").env("GIT_CONFIG_NOSYSTEM", "1")
            .output().unwrap();
        assert!(result.status.success(), "{}\n{}", String::from_utf8_lossy(&result.stdout), String::from_utf8_lossy(&result.stderr));
        return;
    };
    let project = std::path::PathBuf::from(project);
    let close: serde_json::Value = serde_json::from_str(&std::env::var("CADENCE_SUMMARY_RECOVERY_CLOSE").unwrap()).unwrap();
    let submission: receipts::Close = serde_json::from_value(close["request"].clone()).unwrap();
    let dispatch = serde_json::from_str(&std::env::var("CADENCE_SUMMARY_RECOVERY_DISPATCH").unwrap()).unwrap();
    let root = project.join(".planning");
    let source = receipts::observe_source(&project, &dispatch, &submission.task.task, &submission.completion, &[]).unwrap();
    let request = history::Request { request_id: submission.request_id.clone(), task: submission.task.clone(),
        attempt: submission.attempt.clone(), expected_version: submission.expected_version,
        event: history::Event::Close(Box::new(receipts::CloseProof { submission, project: project.clone(),
            planning_root: root.clone(), dispatch, source })) };
    let fired = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let probe = fired.clone();
    let filesystem = Filesystem::new(&root).unwrap().with_probe(move |stage, target| {
        if stage == Stage::Renamed && target.file_name().is_some_and(|n| n == "SUMMARY.md") {
            probe.store(true, std::sync::atomic::Ordering::SeqCst);
            return Err(cadence::store::Error::Invalid("fixture process loss".into()));
        }
        Ok(())
    });
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(filesystem, Allow).await.unwrap();
        let view = store.request(Operation::ReadVerified).await.unwrap();
        assert!(store.request(Operation::NativeTaskV1 { expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity, request: Box::new(request.clone()) }).await.is_err());
    });
    assert!(fired.load(std::sync::atomic::Ordering::SeqCst));
    let mut client = round_support::Client::open(&project);
    let replay = client.call("cadence_apply", close.clone());
    assert_eq!(replay["status"], "ok", "{replay}");
    let summary = std::fs::read(project.join(".planning/phases/31/SUMMARY.md")).unwrap();
    assert_eq!(replay["summary"]["revision"], cadence::store::model::digest(&summary));
    let before = round_support::tree(&project);
    assert_eq!(client.call("cadence_apply", close), replay);
    assert_eq!(round_support::tree(&project), before);
    client.finish();
}

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}

/// The rewrite's own shape: `.planning` documents tracked, store files ignored.
const IGNORE: &str = "/.planning/config.v4.json\n/.planning/decisions.jsonl\n/.planning/items.jsonl\n/.planning/state.json\n/.planning/.store-intent.json\n";

fn git(project: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(project)
        .env("GIT_AUTHOR_NAME", "fixture")
        .env("GIT_AUTHOR_EMAIL", "fixture@example.invalid")
        .env("GIT_COMMITTER_NAME", "fixture")
        .env("GIT_COMMITTER_EMAIL", "fixture@example.invalid")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

fn project() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let project = temp.path();
    std::fs::create_dir_all(project.join(".planning/phases/1")).unwrap();
    std::fs::write(project.join(".gitignore"), IGNORE).unwrap();
    std::fs::write(project.join(".planning/PROJECT.md"), "# Fixture\n").unwrap();
    std::fs::write(project.join(".planning/phases/1/PLAN-1.md"), "# Plan\n").unwrap();
    git(project, &["init", "--initial-branch=fixture/staging"]);
    git(project, &["config", "commit.gpgsign", "false"]);
    git(project, &["add", "-A"]);
    git(project, &["commit", "-m", "Fixture base"]);
    temp
}

fn item(id: &str) -> ItemRecord {
    ItemRecord {
        version: VERSION,
        id: id.into(),
        revision: 1,
        origin: Origin { source: "test".into(), original: Evidence::Missing },
        text: id.into(),
        kind: "todo".into(),
        phase: None,
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}

fn dirty(result: &Result<()>) -> bool {
    matches!(result, Err(error) if error.to_string().contains("evidence-source-dirty"))
}

/// The real store, mid-commit: at every `Prepared` stage the staging file
/// exists beside its target, and the source observation must still read the
/// tree as clean.
#[test]
fn a_commit_in_flight_does_not_dirty_its_own_source() {
    let temp = project();
    let project = temp.path().to_path_buf();
    let root = project.join(".planning");
    assert!(runner::clean(&project).is_ok(), "fixture starts clean");
    let seen = Arc::new(Mutex::new(Vec::new()));
    let probe_project = project.clone();
    let probe_seen = Arc::clone(&seen);
    let fs = Filesystem::new(&root).unwrap().with_probe(move |stage, target| {
        if stage == Stage::Prepared {
            let name = target.file_name().unwrap().to_string_lossy().into_owned();
            let staged = std::fs::read_dir(target.parent().unwrap()).unwrap()
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|n| n.starts_with(&format!(".{name}.")) && n.ends_with(".tmp"))
                .count();
            probe_seen.lock().unwrap().push((
                name,
                staged,
                runner::clean(&probe_project),
                inputs::source(&probe_project).map(|_| ()),
            ));
        }
        Ok(())
    });
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let store = Store::open(fs, Allow).await.unwrap();
        store.request(Operation::AppendItem(item("first"))).await.unwrap();
    });
    let seen = seen.lock().unwrap();
    assert!(!seen.is_empty(), "the append staged at least one file");
    for (name, staged, clean, source) in seen.iter() {
        assert!(*staged >= 1, "{name}: the staging file exists at Prepared");
        assert!(clean.is_ok(), "{name}: runner::clean at Prepared: {clean:?}");
        assert!(source.is_ok(), "{name}: inputs::source at Prepared: {source:?}");
    }
    assert!(runner::clean(&project).is_ok(), "the tree is clean after the commit");
    assert!(inputs::source(&project).is_ok());
}

/// The exact names `prepare` writes, at both places it writes them, by hand.
#[test]
fn the_stores_staging_names_are_not_the_users_files() {
    let temp = project();
    let project = temp.path();
    for name in [".planning/.state.json.4242.7.tmp", ".planning/..store-intent.json.4242.9.tmp", ".planning/phases/1/.PLAN-1.md.4242.3.tmp"] {
        std::fs::write(project.join(name), b"half").unwrap();
        assert!(runner::clean(project).is_ok(), "{name}");
        assert!(inputs::source(project).is_ok(), "{name}");
        std::fs::remove_file(project.join(name)).unwrap();
    }
}

/// Negative controls: a user's untracked file still refuses, wherever it is
/// and however it is named.
#[test]
fn a_users_untracked_file_still_refuses() {
    let temp = project();
    let project = temp.path();
    for name in [
        ".planning/notes.md",
        ".planning/.state.json.tmp",
        ".planning/.state.json.pid.7.tmp",
        ".planning/state.json.4242.7.tmp",
        ".x.4242.7.tmp",
        "src/.main.rs.4242.7.tmp",
    ] {
        std::fs::create_dir_all(project.join(name).parent().unwrap()).unwrap();
        std::fs::write(project.join(name), b"mine").unwrap();
        assert!(dirty(&runner::clean(project)), "{name}: runner::clean");
        assert!(dirty(&inputs::source(project).map(|_| ())), "{name}: inputs::source");
        std::fs::remove_file(project.join(name)).unwrap();
    }
    std::fs::write(project.join(".planning/PROJECT.md"), "# Edited\n").unwrap();
    assert!(dirty(&runner::clean(project)), "a modified tracked file");
    assert!(dirty(&inputs::source(project).map(|_| ())), "a modified tracked file");
}
