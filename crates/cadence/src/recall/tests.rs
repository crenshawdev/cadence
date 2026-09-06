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

#[tokio::test]
async fn production_clones_share_import_writer_and_invalidate_warm_recall() {
    let dir = temp();
    let root = dir.path().join(".planning");
    put(&root, "PROJECT.md", "ownerfalcon authored prose");
    let server = crate::server::CadenceServer::with_factory(factory());
    let clone = server.clone();
    let first = server.store(&root, Operation::Read).await.unwrap();
    assert_eq!(first.snapshot.generation, 1);
    let captured = item("resident-capture", "ownerfalcon captured knowledge");
    let appended = server
        .store(&root, Operation::AppendItem(captured.clone()))
        .await
        .unwrap();
    assert_eq!(appended.snapshot.generation, 2);
    assert_eq!(clone.store(&root, Operation::Read).await.unwrap(), appended);
    let warm = clone.recall(&root, "ownerfalcon", None).await.unwrap();
    assert_eq!(warm.total, 2);
    assert_eq!(
        server.recall(&root, "ownerfalcon", None).await.unwrap(),
        warm
    );
    let dead = cadence::store::items::revise(
        &captured,
        cadence::store::items::ItemChange::Decline {
            reason: "declined".into(),
        },
    )
    .unwrap();
    server
        .store(&root, Operation::AppendItem(dead))
        .await
        .unwrap();
    let after = clone.recall(&root, "ownerfalcon", None).await.unwrap();
    assert_eq!(after.total, 1);
    assert!(
        after
            .results
            .iter()
            .all(|h| matches!(h.provenance, Provenance::Document { .. }))
    );
    put(&root, "PROJECT.md", "changedfalcon document edit");
    assert_eq!(
        server
            .recall(&root, "ownerfalcon", None)
            .await
            .unwrap()
            .total,
        0
    );
    assert_eq!(
        clone
            .recall(&root, "changedfalcon", None)
            .await
            .unwrap()
            .total,
        1
    );
    put(&root, "config.v4.json", r#"{"memory":{"backend":"none"}}"#);
    let disabled = server.recall(&root, "changedfalcon", None).await.unwrap();
    assert_eq!(disabled.backend, "none");
    assert_eq!(disabled.total, 0);
    put(
        &root,
        "config.v4.json",
        r#"{"memory":{"backend":"builtin"}}"#,
    );
    assert_eq!(
        clone
            .recall(&root, "changedfalcon", None)
            .await
            .unwrap()
            .total,
        1
    );
    // A checkout changes reachable history and must change the next answer.
    git(dir.path(), &["init", "-q"]);
    put(&root, "phases/1/CONTEXT.md", "checkoutfalcon history");
    git(dir.path(), &["add", ".planning/phases/1/CONTEXT.md"]);
    let old = commit(dir.path(), "docs: checkout history exists");
    fs::remove_file(root.join("phases/1/CONTEXT.md")).unwrap();
    git(dir.path(), &["add", ".planning/phases/1/CONTEXT.md"]);
    commit(dir.path(), "docs: historical document is pruned");
    let history = server.recall(&root, "checkoutfalcon", None).await.unwrap();
    assert!(
        matches!(&history.results[0].provenance,Provenance::Document {commit:Some(sha),..} if sha == &old)
    );
    git(dir.path(), &["checkout", "--quiet", &old]);
    let checked_out = clone.recall(&root, "checkoutfalcon", None).await.unwrap();
    assert_eq!(checked_out.total, 1);
    assert!(matches!(
        &checked_out.results[0].provenance,
        Provenance::Document { commit: None, .. }
    ));
}

#[tokio::test]
async fn resident_never_answers_from_cached_config_after_reload_failure() {
    use crate::config::reload::{ConfigIo, FileIo, Input};
    use std::sync::atomic::{AtomicBool, Ordering};
    #[derive(Clone)]
    struct Switch(Arc<AtomicBool>);
    impl ConfigIo for Switch {
        fn read(&mut self, path: &Path) -> cadence::store::Result<Input> {
            if self.0.load(Ordering::SeqCst) && path.ends_with("config.v4.json") {
                return Err(cadence::store::Error::Io("PermissionDenied".into()));
            }
            FileIo.read(path)
        }
    }
    let denied = Arc::new(AtomicBool::new(false));
    let dir = temp();
    put(dir.path(), "PROJECT.md", "configfalcon text");
    let server = crate::server::CadenceServer::with_factory(SessionFactory::with_io(
        None,
        Switch(denied.clone()),
        Arc::new(|_, _| Ok(())),
    ));
    assert_eq!(
        server
            .recall(dir.path(), "configfalcon", None)
            .await
            .unwrap()
            .total,
        1
    );
    denied.store(true, Ordering::SeqCst);
    assert!(matches!(
        server.recall(dir.path(), "configfalcon", None).await,
        Err(cadence::store::Error::Io(_))
    ));
    denied.store(false, Ordering::SeqCst);
    put(dir.path(), "config.v4.json", "{");
    assert!(
        server
            .recall(dir.path(), "configfalcon", None)
            .await
            .is_err()
    );
    put(
        dir.path(),
        "config.v4.json",
        r#"{"memory":{"backend":"none"}}"#,
    );
    assert_eq!(
        server
            .recall(dir.path(), "configfalcon", None)
            .await
            .unwrap()
            .backend,
        "none"
    );
}

#[tokio::test]
async fn version_is_lazy_and_owner_releases_sessions_after_handles_close() {
    use std::sync::mpsc;
    let dir = temp();
    let (done, completion) = mpsc::channel();
    struct Notice(mpsc::Sender<()>);
    impl Drop for Notice {
        fn drop(&mut self) {
            let _ = self.0.send(());
        }
    }
    let notice = Notice(done);
    let server = crate::server::CadenceServer::with_factory(SessionFactory::new(
        None,
        Arc::new(move |_, _| {
            let _ = &notice;
            Ok(())
        }),
    ));
    server.cadence_version().await.unwrap();
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    let clone = server.clone();
    let root = dir.path().join(".planning");
    let pending = tokio::spawn(async move { clone.store(&root, Operation::Read).await });
    drop(server);
    assert_eq!(pending.await.unwrap().unwrap().snapshot.generation, 1);
    tokio::task::spawn_blocking(move || completion.recv_timeout(std::time::Duration::from_secs(5)))
        .await
        .unwrap()
        .unwrap();
}

const RESTART_QUERY: &str = "saffronotter cobaltnebula";
const RESTART_DOC: &str = "tasks/recall-continuity/CONTEXT.md";
const RESTART_TERMS: [&str; 2] = ["declinequartzalpha", "declinequartzbeta"];
const RESTART_LEDGER: &str = "# Filed\n- 2026-09-06 github continuity/recall a11fa: declinequartzalpha\n- 2026-09-06 github continuity/recall be7a: declinequartzbeta\n";

fn restart_items() -> Vec<ItemRecord> {
    crate::import::items::translate(
        None,
        Some(&crate::import::Source {
            path: "FILED.md".into(),
            bytes: RESTART_LEDGER.as_bytes().into(),
        }),
        None,
    )
    .unwrap()
    .records
}

fn assert_mixed_response(answer: &Answer) {
    assert_eq!(answer.backend, "builtin");
    assert_eq!(answer.total, 2);
    assert_eq!(answer.results.len(), 2);
    assert!(answer.results.iter().any(|hit| {
        hit.snippet == RESTART_QUERY
            && matches!(&hit.provenance, Provenance::Record { id, revision: 1, commit: None, .. } if id == "restart-mixed")
    }));
    assert!(answer.results.iter().any(|hit| {
        hit.snippet == RESTART_QUERY
            && matches!(&hit.provenance, Provenance::Document { path, line: 3, commit: None, .. } if path == RESTART_DOC)
    }));
}

fn assert_no_declined_hits(answer: &Answer) {
    assert_eq!(answer.backend, "builtin");
    assert_eq!(answer.total, 0, "declined identity affected result total");
    assert!(
        answer.results.is_empty(),
        "declined identity reached snippets"
    );
}

#[derive(Serialize, Deserialize)]
struct RestartEvidence {
    pid: u32,
    generation: u64,
    mixed_before: Answer,
    mixed_after: Answer,
    warm_eligible: Option<Answer>,
    excluded: Vec<Answer>,
    store_commit: Option<String>,
}

// A fresh process runs the production constructor and methods; the test only
// drives operations and records their actual responses for the parent to check.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn recall_restart_child() {
    let Ok(fixture) = std::env::var("CADENCE_RECALL_FIXTURE") else {
        return;
    };
    let fixture = Path::new(&fixture);
    assert!(
        !fixture.starts_with(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .parent()
                .unwrap()
        )
    );
    let stage = std::env::var("CADENCE_RECALL_STAGE").unwrap();
    let root = fixture.join(".planning");
    let server = crate::server::CadenceServer::new();
    let reader = server.clone();
    let mut store_commit = None;
    let initial = server.store(&root, Operation::Read).await.unwrap();
    let targets = restart_items();
    if stage == "first" {
        assert_eq!(
            initial.snapshot.generation, 1,
            "first touch must perform import"
        );
        assert_eq!(initial.snapshot.data["import"]["complete"], true);
        server
            .store(
                &root,
                Operation::AppendItem(item("restart-mixed", RESTART_QUERY)),
            )
            .await
            .unwrap();
        for target in &targets {
            server
                .store(&root, Operation::AppendItem(target.clone()))
                .await
                .unwrap();
        }
        git(fixture, &["add", ".planning/items.jsonl"]);
        store_commit = Some(commit(
            fixture,
            "feat: eligible structured revisions are retained",
        ));
    } else {
        assert_eq!(
            initial.snapshot.generation,
            if stage == "restart" { 5 } else { 6 }
        );
        assert!(matches!(
            initial.lookup_item(&targets[0].id).unwrap().disposition,
            Disposition::Declined { .. }
        ));
    }
    let mixed_before = reader.recall(&root, RESTART_QUERY, None).await.unwrap();
    assert_mixed_response(&mixed_before);
    assert_eq!(
        server.recall(&root, RESTART_QUERY, None).await.unwrap(),
        mixed_before
    );
    let mut excluded = Vec::new();
    if stage != "first" {
        let old_decline = reader.recall(&root, RESTART_TERMS[0], None).await.unwrap();
        assert_no_declined_hits(&old_decline);
        excluded.push(old_decline);
    }
    let warm_eligible = if stage == "first" || stage == "restart" {
        let index = usize::from(stage == "restart");
        let target = &targets[index];
        // The item demonstrably reaches the response before the decline. The
        // identical second query uses the resident's already-built index.
        let warm = reader
            .recall(&root, RESTART_TERMS[index], None)
            .await
            .unwrap();
        assert_eq!(warm.total, 1);
        assert_eq!(warm.results.len(), 1);
        assert!(
            matches!(&warm.results[0].provenance, Provenance::Record { id, .. } if id == &target.id)
        );
        assert_eq!(
            server
                .recall(&root, RESTART_TERMS[index], None)
                .await
                .unwrap(),
            warm
        );
        let declined = cadence::store::items::revise(
            target,
            cadence::store::items::ItemChange::Decline {
                reason: "outside this project's scope".into(),
            },
        )
        .unwrap();
        server
            .store(&root, Operation::AppendItem(declined))
            .await
            .unwrap();
        let after = reader
            .recall(&root, RESTART_TERMS[index], None)
            .await
            .unwrap();
        assert_no_declined_hits(&after);
        assert_eq!(
            server
                .recall(&root, RESTART_TERMS[index], None)
                .await
                .unwrap(),
            after
        );
        excluded.push(after);
        Some(warm)
    } else {
        assert_eq!(stage, "confirm");
        None
    };
    if stage == "restart" {
        put(
            &root,
            "tasks/restart-probe/CONTEXT.md",
            "# Restart\n\nreopenedcachetoken\n",
        );
    }
    if stage != "first" {
        assert_eq!(
            reader
                .recall(&root, "reopenedcachetoken", None)
                .await
                .unwrap()
                .total,
            1
        );
    }
    for term in RESTART_TERMS
        .iter()
        .take(if stage == "first" { 1 } else { 2 })
    {
        let answer = reader.recall(&root, term, None).await.unwrap();
        assert_no_declined_hits(&answer);
        excluded.push(answer);
    }
    // Even a combined query must contain only the two eligible mixed-source
    // hits, so a declined snippet cannot hide beyond a single-term assertion.
    let combined = reader
        .recall(
            &root,
            &format!("{RESTART_QUERY} {}", RESTART_TERMS[0]),
            None,
        )
        .await
        .unwrap();
    assert_mixed_response(&combined);
    let mixed_after = reader.recall(&root, RESTART_QUERY, None).await.unwrap();
    assert_mixed_response(&mixed_after);
    assert_eq!(
        reader.recall(&root, RESTART_QUERY, None).await.unwrap(),
        mixed_after
    );
    let final_view = server.store(&root, Operation::Read).await.unwrap();
    let evidence = RestartEvidence {
        pid: std::process::id(),
        generation: final_view.snapshot.generation,
        mixed_before,
        mixed_after,
        warm_eligible,
        excluded,
        store_commit,
    };
    fs::write(
        fixture.join(format!("{stage}-response.json")),
        serde_json::to_vec(&evidence).unwrap(),
    )
    .unwrap();
}

fn restart_fixture() -> tempfile::TempDir {
    use std::io::Write;
    let dir = temp();
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap();
    let archive = Command::new("git")
        .current_dir(repo)
        .args(["archive", "v3.7.12", ".planning"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        archive.status.success(),
        "{}",
        String::from_utf8_lossy(&archive.stderr)
    );
    let mut tar = Command::new("tar")
        .args(["-x", "-C"])
        .arg(dir.path())
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    tar.stdin
        .take()
        .unwrap()
        .write_all(&archive.stdout)
        .unwrap();
    assert!(tar.wait().unwrap().success());
    for name in ["config.json", "STATE.md", "FILED.md", "DECLINED.md"] {
        let frozen = Command::new("git")
            .current_dir(repo)
            .args(["show", &format!("v3.7.12:.planning/{name}")])
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(frozen.status.success());
        assert_eq!(
            fs::read(dir.path().join(".planning").join(name)).unwrap(),
            frozen.stdout
        );
    }
    for name in [
        "items.jsonl",
        "decisions.jsonl",
        "state.json",
        "config.v4.json",
    ] {
        assert!(!dir.path().join(".planning").join(name).exists());
    }
    dir
}

fn run_restart_child(fixture: &Path, stage: &str) -> RestartEvidence {
    let output = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "server::recall::tests::recall_restart_child",
            "--nocapture",
        ])
        .current_dir(fixture)
        .env("CADENCE_RECALL_FIXTURE", fixture)
        .env("CADENCE_RECALL_STAGE", stage)
        .env("CADENCE_GLOBAL_CONFIG", fixture.join("global/config.json"))
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "child {stage}:\n{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&fs::read(fixture.join(format!("{stage}-response.json"))).unwrap())
        .unwrap()
}

#[test]
fn ac7_and_ac2_survive_real_import_warm_declines_and_two_process_restarts() {
    let dir = restart_fixture();
    let root = dir.path().join(".planning");
    let originals: Vec<_> = ["config.json", "STATE.md", "FILED.md", "DECLINED.md"]
        .into_iter()
        .map(|name| (name, fs::read(root.join(name)).unwrap()))
        .collect();
    git(dir.path(), &["init", "-q"]);
    put(
        &root,
        RESTART_DOC,
        &format!("## Design\n\n{RESTART_QUERY}\n"),
    );
    // Retain synthetic FILED evidence in git, then restore the actual frozen
    // FILED bytes before automatic import. Both provenance claims are exact.
    put(&root, "FILED.md", RESTART_LEDGER);
    git(
        dir.path(),
        &[
            "add",
            ".planning/FILED.md",
            ".planning/tasks/recall-continuity/CONTEXT.md",
        ],
    );
    let filed_commit = commit(
        dir.path(),
        "docs: earlier filed identities and authored context exist",
    );
    assert_eq!(
        git(
            dir.path(),
            &["show", &format!("{filed_commit}:.planning/FILED.md")]
        ),
        RESTART_LEDGER.trim()
    );
    fs::write(
        root.join("FILED.md"),
        &originals
            .iter()
            .find(|(name, _)| *name == "FILED.md")
            .unwrap()
            .1,
    )
    .unwrap();

    let first = run_restart_child(dir.path(), "first");
    let restart = run_restart_child(dir.path(), "restart");
    let confirm = run_restart_child(dir.path(), "confirm");
    assert_eq!(
        (first.generation, restart.generation, confirm.generation),
        (5, 6, 6)
    );
    assert_ne!(first.pid, restart.pid);
    assert_ne!(restart.pid, confirm.pid);
    for evidence in [&first, &restart, &confirm] {
        assert_mixed_response(&evidence.mixed_before);
        assert_mixed_response(&evidence.mixed_after);
        assert!(!evidence.excluded.is_empty());
        for answer in &evidence.excluded {
            assert_no_declined_hits(answer);
        }
    }
    assert_eq!(first.warm_eligible.as_ref().unwrap().total, 1);
    assert_eq!(restart.warm_eligible.as_ref().unwrap().total, 1);
    // Across each restart the inputs match exactly: compare the full result
    // collection, including order, scores, snippets, total and citations.
    assert_eq!(first.mixed_after, restart.mixed_before);
    assert_eq!(restart.mixed_after, confirm.mixed_before);
    let history = git(
        dir.path(),
        &[
            "show",
            &format!(
                "{}:.planning/items.jsonl",
                first.store_commit.as_ref().unwrap()
            ),
        ],
    );
    let prior: Vec<ItemRecord> = history
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    for target in restart_items() {
        assert!(prior.iter().any(|record| record.id == target.id
            && record.revision == 1
            && matches!(record.disposition, Disposition::Filed { .. })));
    }
    for (name, bytes) in originals {
        assert_eq!(
            fs::read(root.join(name)).unwrap(),
            bytes,
            "frozen import source changed: {name}"
        );
    }
}
