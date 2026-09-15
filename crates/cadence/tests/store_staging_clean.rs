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
