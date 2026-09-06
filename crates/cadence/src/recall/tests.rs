use super::*;
use cadence::store::model::{ItemRecord, Origin, Snapshot, VERSION};

fn item(id: &str, text: &str) -> ItemRecord {
    ItemRecord {
        version: VERSION,
        id: id.into(),
        revision: 1,
        origin: Origin {
            source: "capture".into(),
            original: Evidence::Missing,
        },
        text: text.into(),
        kind: "note".into(),
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}
fn view(items: Vec<ItemRecord>) -> View {
    View {
        items,
        decisions: vec![],
        snapshot: Snapshot::new(0, b"", b"", serde_json::Value::Null).unwrap(),
    }
}
fn prose(text: &str, line: usize) -> Candidate {
    Candidate {
        text: text.into(),
        item_id: None,
        provenance: Provenance::Document {
            path: "CONTEXT.md".into(),
            line,
            heading: "Durable decisions".into(),
            commit: None,
        },
    }
}

#[test]
fn frozen_token_relationships_and_raw_stopword_order() {
    for (a, b) in [
        ("seams", "seam"),
        ("closes", "close"),
        ("files", "file"),
        ("notes", "note"),
        ("types", "type"),
        ("changes", "change"),
        ("refused", "refuse"),
        ("removed", "remove"),
        ("running", "run"),
    ] {
        assert_eq!(rank::tokenize(a), rank::tokenize(b), "{a} / {b}");
    }
    assert_eq!(rank::tokenize("THE being its"), vec!["be", "it"]);
    assert_eq!(rank::tokenize("freed agreed"), vec!["freed", "agree"]);
    assert_ne!(rank::tokenize("verifies"), rank::tokenize("verify"));
    assert_ne!(rank::tokenize("indices"), rank::tokenize("index"));
}

#[test]
fn deterministic_ties_deduplicated_query_default_limit_and_total() {
    let candidates = (1..=7).map(|i| prose("quasar seam", i)).collect();
    let corpus = Corpus::new(candidates, &BTreeSet::new());
    let answer = corpus.query("quasar", None, "builtin").unwrap();
    assert_eq!(answer.total, 7);
    assert_eq!(answer.results.len(), 5);
    for (i, hit) in answer.results.iter().enumerate() {
        assert_eq!(hit.provenance, prose("", i + 1).provenance);
    }
    assert_eq!(
        answer,
        corpus.query("quasar quasar", None, "builtin").unwrap()
    );
    assert_eq!(answer, corpus.query("quasar", None, "builtin").unwrap());
    assert_eq!(
        corpus
            .query("seams", Some(2), "builtin")
            .unwrap()
            .results
            .len(),
        2
    );
}

#[test]
fn empty_zero_hits_invalid_limits_disabled_and_unknown() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
    for limit in [0, -1] {
        assert!(corpus.query("quasar", Some(limit), "builtin").is_err());
    }
    assert!(corpus.query(" ", None, "builtin").is_err());
    assert!(corpus.query("quasar", None, "other").is_err());
    let disabled = corpus.query("quasar", None, "none").unwrap();
    assert_eq!(disabled.backend, "none");
    assert_eq!((disabled.total, disabled.results.len()), (0, 0));
    assert_eq!(corpus.query("absent", None, "builtin").unwrap().total, 0);
    assert_eq!(
        Corpus::new(vec![], &BTreeSet::new())
            .query("quasar", None, "builtin")
            .unwrap()
            .total,
        0
    );
}

#[test]
fn declined_current_and_historical_candidates_never_affect_ranking_or_totals() {
    let old = item("declined", "quasar quasar");
    let historical = records(view(vec![old.clone()]).recall_items());
    let mut dead = old.clone();
    dead.revision = 2;
    dead.disposition = Disposition::Declined {
        reason: "quasar secret reason".into(),
    };
    let live = view(vec![old, dead, item("kept", "quasar")]);
    let mut candidates = current(&live);
    candidates.extend(historical);
    let actual = Corpus::new(candidates, &declined(&live))
        .query("quasar", None, "builtin")
        .unwrap();
    let expected = Corpus::new(
        records(view(vec![item("kept", "quasar")]).recall_items()),
        &BTreeSet::new(),
    )
    .query("quasar", None, "builtin")
    .unwrap();
    assert_eq!(actual, expected);
    assert_eq!(actual.total, 1);
}

use crate::import::SessionFactory;
use cadence::store::writer::Operation;
use std::{fs, path::Path, sync::Arc};

fn temp() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    assert!(
        !dir.path().starts_with(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .parent()
                .unwrap()
        )
    );
    dir
}
fn put(root: &Path, path: &str, text: &str) {
    let dest = root.join(path);
    fs::create_dir_all(dest.parent().unwrap()).unwrap();
    fs::write(dest, text).unwrap();
}
fn factory() -> SessionFactory {
    SessionFactory::new(None, Arc::new(|_, _| Ok(())))
}

#[tokio::test]
async fn ac7_one_response_contains_real_capture_and_context_with_citations() {
    let dir = temp();
    let root = dir.path().join(".planning");
    put(
        &root,
        "CAPTURE.md",
        "# Capture\n## Notes\n- cobalt otter architecture\n",
    );
    put(
        &root,
        "phases/1.10/CONTEXT.md",
        "# Context\n\n## Design\n\ncobalt otter architecture\n  continuation remains attached\n",
    );
    let service = factory().first_touch(&root).await.unwrap();
    let stored = service.request(Operation::Read).await.unwrap();
    let (corpus, coverage) = live(&stored, &root);
    assert!(coverage.is_empty());
    let actual = corpus.query("cobalt otter", None, "builtin").unwrap();
    assert_eq!(actual.total, 2);
    assert!(actual.results.iter().any(|h| matches!(&h.provenance,Provenance::Record { id, revision:1, .. } if id.starts_with("legacy:"))));
    assert!(actual.results.iter().any(|h| matches!(&h.provenance,Provenance::Document { path,line:5,.. } if path == "phases/1.10/CONTEXT.md") && h.snippet.contains("continuation remains attached")));
    fs::remove_file(root.join("CAPTURE.md")).unwrap();
    let (corpus, _) = live(&service.request(Operation::Read).await.unwrap(), &root);
    assert_eq!(
        corpus.query("cobalt otter", None, "builtin").unwrap(),
        actual
    );
}

#[test]
fn authored_sources_archives_receipts_and_context_selection_are_explicit() {
    let dir = temp();
    for (path, term) in [
        ("PROJECT.md", "projectquasar"),
        ("ROADMAP.md", "roadmapquasar"),
        ("phases/1/SUMMARY.md", "summaryquasar"),
        ("phases/1/UAT.md", "uatquasar"),
        ("tasks/receipt/RECORD.md", "recordquasar"),
        ("_archive-v1/2/CONTEXT.md", "archivequasar"),
    ] {
        put(dir.path(), path, &format!("# Evidence\n\n{term}\n"));
    }
    put(
        dir.path(),
        "phases/1/CONTEXT.md",
        "## Decisions\n- D-02 localquasar\n### Nested\nlocalquasar\n## Other\notherquasar\n## Durable decisions\n",
    );
    let docs = documents::read(dir.path(), &mut documents::Files);
    assert!(docs.incomplete.is_empty());
    let corpus = Corpus::new(docs.candidates, &BTreeSet::new());
    for term in [
        "projectquasar",
        "roadmapquasar",
        "summaryquasar",
        "uatquasar",
        "recordquasar",
        "archivequasar",
        "otherquasar",
    ] {
        assert_eq!(
            corpus.query(term, None, "builtin").unwrap().total,
            1,
            "{term}"
        );
    }
    assert_eq!(
        corpus.query("localquasar", None, "builtin").unwrap().total,
        0
    );
    let legacy = documents::snippets("CONTEXT.md", "## Decisions\n- D-01 legacyquasar\n", None);
    assert_eq!(
        Corpus::new(legacy, &BTreeSet::new())
            .query("legacyquasar", None, "builtin")
            .unwrap()
            .total,
        1
    );
}

#[test]
fn disallowed_files_and_escaping_links_cannot_supply_hits() {
    use std::os::unix::fs::symlink;
    let dir = temp();
    let outside = temp();
    put(outside.path(), "CONTEXT.md", "escapedquasar");
    for path in [
        "DECLINED.md",
        "FILED.md",
        "config.json",
        "source-evidence/PROJECT.md",
        "phases/1/reports/SUMMARY.md",
        "credentials.md",
        "trace.jsonl",
    ] {
        put(dir.path(), path, "forbiddenquasar");
    }
    fs::create_dir_all(dir.path().join("phases/1")).unwrap();
    symlink(
        outside.path().join("CONTEXT.md"),
        dir.path().join("phases/1/CONTEXT.md"),
    )
    .unwrap();
    symlink(outside.path(), dir.path().join("phases/2")).unwrap();
    let docs = documents::read(dir.path(), &mut documents::Files);
    assert_eq!(docs.incomplete.len(), 2);
    let corpus = Corpus::new(docs.candidates, &BTreeSet::new());
    assert_eq!(
        corpus
            .query("escapedquasar forbiddenquasar", None, "builtin")
            .unwrap()
            .total,
        0
    );
}

#[test]
fn unreadable_permitted_source_states_incomplete_coverage() {
    struct Denied;
    impl documents::ReadDocuments for Denied {
        fn list(&mut self, path: &Path) -> std::io::Result<Vec<std::path::PathBuf>> {
            documents::ReadDocuments::list(&mut documents::Files, path)
        }
        fn text(&mut self, _: &Path) -> std::io::Result<String> {
            Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied))
        }
    }
    let dir = temp();
    put(dir.path(), "PROJECT.md", "unreadablequasar");
    let docs = documents::read(dir.path(), &mut Denied);
    assert!(docs.candidates.is_empty());
    assert!(docs.incomplete[0].contains("PROJECT.md: source unavailable"));
}

use std::process::{Command, Stdio};
fn git(root: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .env("GIT_AUTHOR_NAME", "John Crenshaw")
        .env("GIT_AUTHOR_EMAIL", "john@jcrenshaw.dev")
        .env("GIT_COMMITTER_NAME", "John Crenshaw")
        .env("GIT_COMMITTER_EMAIL", "john@jcrenshaw.dev")
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
fn commit(root: &Path, message: &str) -> String {
    git(
        root,
        &[
            "-c",
            "gpg.program=gpg",
            "commit",
            "-S693AB15F91734B0C",
            "-m",
            message,
        ],
    );
    git(root, &["rev-parse", "HEAD"])
}
fn history_answer(
    root: &Path,
    view: &View,
    query: &str,
    git: &mut impl history::ReadGit,
) -> Answer {
    let docs = documents::read(root, &mut documents::Files);
    let mut candidates = current(view);
    candidates.extend(docs.candidates);
    let history = history::read(root, view, &candidates, git);
    candidates.extend(history.candidates);
    let mut result = Corpus::new(candidates, &declined(view))
        .query(query, None, "builtin")
        .unwrap();
    result.incomplete = docs
        .incomplete
        .into_iter()
        .chain(history.incomplete)
        .collect();
    result
}

#[test]
fn removed_authored_memory_has_exact_commit_and_path_without_duplicate_blobs() {
    let dir = temp();
    git(dir.path(), &["init", "-q"]);
    let root = dir.path().join(".planning");
    put(
        &root,
        "phases/1.10/CONTEXT.md",
        "## Durable decisions\n\n- D-01 amberfalcon stays remembered\n",
    );
    put(
        &root,
        "_archive-v1/2/SUMMARY.md",
        "# Summary\n\nretainedfalcon stays readable\n",
    );
    git(
        dir.path(),
        &[
            "add",
            ".planning/phases/1.10/CONTEXT.md",
            ".planning/_archive-v1/2/SUMMARY.md",
        ],
    );
    commit(dir.path(), "docs: memory is recorded");
    git(
        dir.path(),
        &[
            "-c",
            "gpg.program=gpg",
            "commit",
            "-S693AB15F91734B0C",
            "--allow-empty",
            "-m",
            "chore: unchanged memory remains reachable",
        ],
    );
    let containing = git(dir.path(), &["rev-parse", "HEAD"]);
    fs::remove_file(root.join("phases/1.10/CONTEXT.md")).unwrap();
    git(dir.path(), &["add", ".planning/phases/1.10/CONTEXT.md"]);
    commit(dir.path(), "docs: phase is pruned");
    let answer = history_answer(&root, &view(vec![]), "amberfalcon", &mut history::Git);
    assert!(answer.incomplete.is_empty(), "{:?}", answer.incomplete);
    assert_eq!(answer.total, 1);
    assert!(
        matches!(&answer.results[0].provenance,Provenance::Document {path,line:3,commit:Some(sha),..} if path == "phases/1.10/CONTEXT.md" && sha == &containing)
    );
    assert_eq!(
        history_answer(&root, &view(vec![]), "retainedfalcon", &mut history::Git).total,
        1
    );
    assert_eq!(
        history_answer(&root, &view(vec![]), "amberfalcon", &mut history::Git),
        answer
    );
}

#[test]
fn residue_preserves_label_origin_and_absence_of_invented_history() {
    struct Missing;
    impl history::ReadGit for Missing {
        fn run(&mut self, _: &Path, _: &[&str]) -> Result<Vec<u8>, String> {
            Err("git executable unavailable".into())
        }
    }
    let dir = temp();
    put(
        dir.path(),
        "ARCHIVE.md",
        "# Archive\n## release/with/slashes\n- `phases/1.10/SUMMARY.md`: residuefalcon is only a snippet\n",
    );
    let answer = history_answer(dir.path(), &view(vec![]), "residuefalcon", &mut Missing);
    assert_eq!(answer.total, 1);
    assert!(
        answer
            .incomplete
            .iter()
            .any(|r| r.contains("git executable unavailable"))
    );
    assert!(
        matches!(&answer.results[0].provenance,Provenance::Residue {path,line:3,label,origin,phase,commit:None} if path == "ARCHIVE.md" && label == "release/with/slashes" && origin == "phases/1.10/SUMMARY.md" && phase == "1.10")
    );
}

#[test]
fn unborn_shallow_and_failed_blob_reads_state_incomplete_coverage() {
    let dir = temp();
    git(dir.path(), &["init", "-q"]);
    let root = dir.path().join(".planning");
    put(&root, "PROJECT.md", "livefalcon evidence");
    let unborn = history_answer(&root, &view(vec![]), "livefalcon", &mut history::Git);
    assert_eq!(unborn.total, 1);
    assert!(
        unborn
            .incomplete
            .iter()
            .any(|r| r.contains("history incomplete"))
    );
    git(dir.path(), &["add", ".planning/PROJECT.md"]);
    commit(dir.path(), "docs: initial evidence exists");
    put(
        &root,
        "phases/1/SUMMARY.md",
        "oldfalcon historical evidence",
    );
    git(dir.path(), &["add", ".planning/phases/1/SUMMARY.md"]);
    commit(dir.path(), "docs: historical evidence exists");
    let clone = temp();
    git(
        clone.path(),
        &[
            "clone",
            "--quiet",
            "--depth=1",
            &format!("file://{}", dir.path().display()),
            "shallow",
        ],
    );
    let shallow = history_answer(
        &clone.path().join("shallow/.planning"),
        &view(vec![]),
        "livefalcon",
        &mut history::Git,
    );
    assert_eq!(shallow.total, 1);
    assert!(
        shallow
            .incomplete
            .iter()
            .any(|r| r.contains("shallow history"))
    );
    struct FailedBlob;
    impl history::ReadGit for FailedBlob {
        fn run(&mut self, root: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
            if args[0] == "cat-file" {
                Err("injected missing object".into())
            } else {
                history::ReadGit::run(&mut history::Git, root, args)
            }
        }
    }
    let failed = history_answer(&root, &view(vec![]), "livefalcon", &mut FailedBlob);
    assert_eq!(failed.total, 1);
    assert!(
        failed
            .incomplete
            .iter()
            .any(|r| r.contains("injected missing object"))
    );
}

#[tokio::test]
async fn current_decline_suppresses_git_filed_and_store_identity_but_not_independent_prose() {
    let dir = temp();
    git(dir.path(), &["init", "-q"]);
    let root = dir.path().join(".planning");
    put(
        &root,
        "FILED.md",
        "# Filed\n- 2026-09-06 github owner/repo abcdef: declinedfalcon formerly filed\n",
    );
    git(dir.path(), &["add", ".planning/FILED.md"]);
    commit(dir.path(), "docs: filed finding is retained");
    let service = factory().first_touch(&root).await.unwrap();
    let before = service.request(Operation::Read).await.unwrap();
    let held = before.recall_items().iter().next().unwrap().clone();
    git(dir.path(), &["add", ".planning/items.jsonl"]);
    commit(dir.path(), "feat: structured finding is retained");
    assert_eq!(
        history_answer(&root, &before, "declinedfalcon", &mut history::Git).total,
        1
    );
    let dead = cadence::store::items::revise(
        &held,
        cadence::store::items::ItemChange::Decline {
            reason: "out of scope".into(),
        },
    )
    .unwrap();
    let after = service.request(Operation::AppendItem(dead)).await.unwrap();
    assert_eq!(
        history_answer(&root, &after, "declinedfalcon", &mut history::Git).total,
        0
    );
    put(
        &root,
        "PROJECT.md",
        "declinedfalcon appears independently in prose",
    );
    let answer = history_answer(&root, &after, "declinedfalcon", &mut history::Git);
    assert_eq!(answer.total, 1);
    assert!(
        matches!(&answer.results[0].provenance,Provenance::Document {path,..} if path == "PROJECT.md")
    );
}
