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
        phase: None,
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
fn equal_scores_keep_candidate_order() {
    let candidates = (1..=7).map(|i| prose("quasar seam", i)).collect();
    let answer = Corpus::new(candidates, &BTreeSet::new()).query("quasar", None, "builtin").unwrap();
    for (i, hit) in answer.results.iter().enumerate() {
        assert_eq!(hit.provenance, prose("", i + 1).provenance);
    }
}

#[test]
fn a_repeated_query_term_does_not_change_the_answer() {
    let candidates = (1..=7).map(|i| prose("quasar seam", i)).collect();
    let corpus = Corpus::new(candidates, &BTreeSet::new());
    let answer = corpus.query("quasar", None, "builtin").unwrap();
    assert_eq!(
        answer,
        corpus.query("quasar quasar", None, "builtin").unwrap()
    );
    assert_eq!(answer, corpus.query("quasar", None, "builtin").unwrap());
}

#[test]
fn the_default_limit_is_5_while_total_counts_every_match() {
    let candidates = (1..=7).map(|i| prose("quasar seam", i)).collect();
    let answer = Corpus::new(candidates, &BTreeSet::new()).query("quasar", None, "builtin").unwrap();
    assert_eq!(answer.total, 7);
    assert_eq!(answer.results.len(), 5);
}

#[test]
fn an_explicit_limit_caps_the_results() {
    let candidates = (1..=7).map(|i| prose("quasar seam", i)).collect();
    assert_eq!(
        Corpus::new(candidates, &BTreeSet::new())
            .query("seams", Some(2), "builtin")
            .unwrap()
            .results
            .len(),
        2
    );
}

#[test]
fn a_non_positive_limit_is_refused() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
    for limit in [0, -1] {
        assert!(corpus.query("quasar", Some(limit), "builtin").is_err());
    }
}

#[test]
fn a_blank_query_is_refused() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
    assert!(corpus.query(" ", None, "builtin").is_err());
}

#[test]
fn an_unknown_backend_is_refused() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
    assert!(corpus.query("quasar", None, "other").is_err());
}

#[test]
fn backend_none_answers_empty_and_names_itself() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
    let disabled = corpus.query("quasar", None, "none").unwrap();
    assert_eq!(disabled.backend, "none");
    assert_eq!((disabled.total, disabled.results.len()), (0, 0));
}

#[test]
fn no_match_or_an_empty_corpus_answers_total_0() {
    let corpus = Corpus::new(vec![prose("quasar", 1)], &BTreeSet::new());
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

use std::{collections::BTreeMap, fs, path::Path};

fn put(root: &Path, path: &str, text: &str) {
    let dest = root.join(path);
    fs::create_dir_all(dest.parent().unwrap()).unwrap();
    fs::write(dest, text).unwrap();
}

#[test]
fn authored_sources_archives_and_receipts_are_eligible() {
    for path in [
        "PROJECT.md",
        "ROADMAP.md",
        "phases/1/SUMMARY.md",
        "phases/1/UAT.md",
        "phases/1/CONTEXT.md",
        "tasks/receipt/RECORD.md",
        "_archive-v1/2/CONTEXT.md",
    ] {
        assert!(documents::eligible(path), "{path}");
    }
}

#[test]
fn a_phase_context_offers_its_other_sections_and_not_its_local_decisions() {
    let snippets = documents::snippets(
        "phases/1/CONTEXT.md",
        "## Decisions\n- D-02 localquasar\n### Nested\nlocalquasar\n## Other\notherquasar\n## Durable decisions\n",
        None,
    );
    let corpus = Corpus::new(snippets, &BTreeSet::new());
    assert_eq!(corpus.query("otherquasar", None, "builtin").unwrap().total, 1);
    assert_eq!(
        corpus.query("localquasar", None, "builtin").unwrap().total,
        0
    );
}

#[test]
fn a_legacy_context_offers_its_decisions() {
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
fn ledgers_config_evidence_reports_credentials_and_traces_are_not_eligible() {
    for path in [
        "DECLINED.md",
        "FILED.md",
        "config.json",
        "source-evidence/PROJECT.md",
        "phases/1/reports/SUMMARY.md",
        "credentials.md",
        "trace.jsonl",
    ] {
        assert!(!documents::eligible(path), "{path}");
    }
}

#[test]
fn a_linked_or_escaping_entry_is_refused() {
    use documents::{Seen, Step, step};
    let link_file = Seen { link: true, contained: false, dir: false, file: false };
    let link_dir = Seen { link: true, contained: false, dir: false, file: false };
    let escaping = Seen { link: false, contained: false, dir: false, file: true };
    assert_eq!(step("phases/1/CONTEXT.md", &link_file), Step::Refuse);
    assert_eq!(step("phases/2", &link_dir), Step::Refuse);
    assert_eq!(step("phases/1/CONTEXT.md", &escaping), Step::Refuse);
}

#[test]
fn a_contained_directory_is_descended_and_a_contained_eligible_file_read() {
    use documents::{Seen, Step, step};
    let dir = Seen { link: false, contained: true, dir: true, file: false };
    let file = Seen { link: false, contained: true, dir: false, file: true };
    assert_eq!(step("phases/2", &dir), Step::Descend);
    assert_eq!(step("phases/1/CONTEXT.md", &file), Step::Read);
    assert_eq!(step("phases/1/reports/SUMMARY.md", &file), Step::Skip);
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
    let dir = tempfile::tempdir().unwrap();
    put(dir.path(), "PROJECT.md", "unreadablequasar");
    let docs = documents::read(dir.path(), &mut Denied);
    assert!(docs.candidates.is_empty());
    assert!(docs.incomplete[0].contains("PROJECT.md: source unavailable"));
}

#[test]
fn an_archive_residue_line_yields_its_label_origin_and_phase_and_no_commit() {
    let candidates = history::residue(
        "ARCHIVE.md",
        "# Archive\n## release/with/slashes\n- `phases/1.10/SUMMARY.md`: residuefalcon is only a snippet\n",
        None,
    );
    assert_eq!(candidates.len(), 1);
    assert!(
        matches!(&candidates[0].provenance,Provenance::Residue {path,line:3,label,origin,phase,commit:None} if path == "ARCHIVE.md" && label == "release/with/slashes" && origin == "phases/1.10/SUMMARY.md" && phase == "1.10")
    );
}

#[test]
fn a_git_launch_failure_is_incomplete_coverage_while_archive_residue_still_answers() {
    struct Missing;
    impl cadence::process::Process for Missing {
        fn run(
            &mut self,
            _: &cadence::process::Launch,
        ) -> std::io::Result<cadence::process::Output> {
            Err(std::io::Error::other("git executable unavailable"))
        }
    }
    let dir = tempfile::tempdir().unwrap();
    put(
        dir.path(),
        "ARCHIVE.md",
        "# Archive\n## release/with/slashes\n- `phases/1.10/SUMMARY.md`: residuefalcon is only a snippet\n",
    );
    let history = history::read(dir.path(), &view(vec![]), &[], &mut Missing);
    assert!(
        history
            .incomplete
            .iter()
            .any(|r| r.contains("git executable unavailable"))
    );
    assert_eq!(
        Corpus::new(history.candidates, &BTreeSet::new())
            .query("residuefalcon", None, "builtin")
            .unwrap()
            .total,
        1
    );
}

#[test]
fn one_query_answers_a_record_hit_and_a_document_hit_together() {
    let store = view(vec![item("orbit-item", "orbit from the store")]);
    let mut candidates = current(&store);
    candidates.extend(documents::snippets("PROJECT.md", "orbit from a document\n", None));
    let answer = Corpus::new(candidates, &declined(&store))
        .query("orbit", None, "builtin")
        .unwrap();
    assert!(answer.results.iter().any(|hit| matches!(
        &hit.provenance,
        Provenance::Record { id, revision: 1, .. } if id == "orbit-item"
    )));
    assert!(answer.results.iter().any(|hit| matches!(
        &hit.provenance,
        Provenance::Document { path, .. } if path == "PROJECT.md"
    )));
}

#[test]
fn a_paragraph_snippet_cites_its_first_line_and_keeps_its_continuation() {
    let snippets = documents::snippets(
        "PROJECT.md",
        "# Project\n\norbit starts here\nand carries on here\n",
        None,
    );
    let paragraph = snippets
        .iter()
        .find(|c| c.text.starts_with("orbit starts here"))
        .unwrap();
    assert!(paragraph.text.contains("and carries on here"));
    assert!(matches!(&paragraph.provenance, Provenance::Document { line: 3, .. }));
}

/// Git's answers, supplied: the planning root is `/repo/.planning`, commits
/// come newest first, each commit lists `(path, blob)` rows under the root,
/// and each blob answers its text or a read failure.
#[derive(Default)]
struct Answers {
    shallow: bool,
    commits: Vec<&'static str>,
    trees: BTreeMap<&'static str, Vec<(&'static str, &'static str)>>,
    blobs: BTreeMap<&'static str, std::result::Result<String, &'static str>>,
}

impl history::ReadGit for Answers {
    fn shallow(&mut self) -> std::result::Result<Vec<u8>, String> {
        Ok(if self.shallow { "true\n" } else { "false\n" }.into())
    }
    fn toplevel(&mut self) -> std::result::Result<Vec<u8>, String> {
        Ok(b"/repo\n".to_vec())
    }
    fn commits(&mut self) -> std::result::Result<Vec<u8>, String> {
        Ok(self.commits.iter().map(|c| format!("{c}\n")).collect::<String>().into())
    }
    fn tree(&mut self, commit: &str, _: &str) -> std::result::Result<Vec<u8>, String> {
        Ok(self.trees[commit]
            .iter()
            .map(|(path, blob)| format!("100644 blob {blob}\t.planning/{path}\0"))
            .collect::<String>()
            .into())
    }
    fn blob(&mut self, id: &str) -> std::result::Result<Vec<u8>, String> {
        self.blobs[id].clone().map(String::into_bytes).map_err(String::from)
    }
}

fn traverse(store: &View, git: &mut Answers) -> history::History {
    history::traverse(Path::new("/repo/.planning"), store, BTreeSet::new(), git)
}

/// PROJECT.md was removed in c3; c2 and c1 both hold the same blob of it.
fn removed_project() -> Answers {
    Answers {
        commits: vec!["c3", "c2", "c1"],
        trees: BTreeMap::from([
            ("c3", vec![]),
            ("c2", vec![("PROJECT.md", "b1")]),
            ("c1", vec![("PROJECT.md", "b1")]),
        ]),
        blobs: BTreeMap::from([("b1", Ok("# Project\n\nremoved orbit\n".into()))]),
        ..Answers::default()
    }
}

#[test]
fn a_removed_document_cites_its_path_line_and_the_newest_commit_holding_it() {
    let history = traverse(&view(vec![]), &mut removed_project());
    let paragraph = history
        .candidates
        .iter()
        .find(|c| c.text == "removed orbit")
        .unwrap();
    assert_eq!(
        paragraph.provenance,
        Provenance::Document {
            path: "PROJECT.md".into(),
            line: 3,
            heading: "Project".into(),
            commit: Some("c2".into()),
        }
    );
}

#[test]
fn a_blob_held_by_several_commits_yields_one_candidate() {
    let history = traverse(&view(vec![]), &mut removed_project());
    assert_eq!(
        history.candidates.iter().filter(|c| c.text == "removed orbit").count(),
        1
    );
}

#[test]
fn an_unborn_repository_reports_history_incomplete() {
    let history = traverse(&view(vec![]), &mut Answers::default());
    assert_eq!(
        history.incomplete,
        ["history incomplete: unborn repository: no reachable history"]
    );
}

#[test]
fn a_shallow_repository_adds_a_shallow_history_note() {
    let mut git = Answers {
        shallow: true,
        commits: vec!["c1"],
        trees: BTreeMap::from([("c1", vec![])]),
        ..Answers::default()
    };
    assert_eq!(
        traverse(&view(vec![]), &mut git).incomplete,
        ["shallow history: ancestors beyond the shallow boundary are unavailable"]
    );
}

#[test]
fn a_failed_blob_read_names_its_commit_and_path_and_the_other_hits_stay() {
    let mut git = Answers {
        commits: vec!["c1"],
        trees: BTreeMap::from([("c1", vec![("PROJECT.md", "b1"), ("ROADMAP.md", "b2")])]),
        blobs: BTreeMap::from([
            ("b1", Err("git cat-file failed (exit status: 128)")),
            ("b2", Ok("roadmap orbit\n".into())),
        ]),
        ..Answers::default()
    };
    let history = traverse(&view(vec![]), &mut git);
    assert_eq!(
        history.incomplete,
        ["c1:PROJECT.md: git cat-file failed (exit status: 128)"]
    );
    assert!(history.candidates.iter().any(|c| c.text == "roadmap orbit"));
}

#[test]
fn a_declined_item_has_no_history_candidates_while_a_document_with_its_text_answers() {
    let filed = "- 2026-09-01 github GH-1 abc123: declined orbit\n";
    let id = crate::import::items::translate(
        None,
        Some(&crate::import::Source {
            path: "FILED.md".into(),
            bytes: filed.into(),
        }),
        None,
    )
    .unwrap()
    .records[0]
        .id
        .clone();
    let captured = item(&id, "declined orbit");
    let mut declined = captured.clone();
    declined.revision = 2;
    declined.disposition = Disposition::Declined {
        reason: "not wanted".into(),
    };
    let mut git = Answers {
        commits: vec!["c1"],
        trees: BTreeMap::from([(
            "c1",
            vec![("FILED.md", "b1"), ("items.jsonl", "b2"), ("PROJECT.md", "b3")],
        )]),
        blobs: BTreeMap::from([
            ("b1", Ok(filed.into())),
            ("b2", Ok(serde_json::to_string(&captured).unwrap() + "\n")),
            ("b3", Ok("declined orbit\n".into())),
        ]),
        ..Answers::default()
    };
    let history = traverse(&view(vec![captured, declined]), &mut git);
    assert!(history.candidates.iter().all(|c| c.item_id.as_deref() != Some(id.as_str())));
    assert!(history.candidates.iter().any(|c| matches!(
        &c.provenance,
        Provenance::Document { path, .. } if path == "PROJECT.md"
    )));
}

/// The cache key over a store at `generation`, a config at `config`, one
/// document with digest `document`, and history that reached `commit`.
fn inputs(generation: u64, config: u64, document: &str, commit: &str) -> resident::Inputs {
    let store = View {
        snapshot: Snapshot::new(generation, b"", b"", serde_json::Value::Null).unwrap(),
        ..view(vec![])
    };
    let docs = documents::Documents {
        identities: BTreeMap::from([("PROJECT.md".to_string(), document.to_string())]),
        ..documents::Documents::default()
    };
    let history = history::History {
        identities: BTreeSet::from([format!("commit:{commit}")]),
        ..history::History::default()
    };
    resident::Inputs::new(&store, config, docs, BTreeMap::new(), history)
}

#[test]
fn a_warm_corpus_is_rebuilt_when_the_store_documents_config_or_history_change() {
    let warm = resident::Cached {
        inputs: inputs(1, 1, "d1", "c1"),
        corpus: Corpus::new(vec![], &BTreeSet::new()),
        phase: None,
    };
    assert!(warm.answers(&inputs(1, 1, "d1", "c1"), None));
    for changed in [
        inputs(2, 1, "d1", "c1"),
        inputs(1, 2, "d1", "c1"),
        inputs(1, 1, "d2", "c1"),
        inputs(1, 1, "d1", "c2"),
    ] {
        assert!(!warm.answers(&changed, None));
    }
}

#[test]
fn the_backend_is_the_one_the_reloaded_config_names() {
    let values = serde_json::json!({"memory": {"backend": "none"}});
    assert_eq!(resident::backend(&values).unwrap(), "none");
}

#[test]
fn review_material_reads_a_project_file_named_relative_to_the_project() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join(".planning")).unwrap();
    std::fs::create_dir_all(dir.path().join("src")).unwrap();
    std::fs::write(dir.path().join("src/lib.rs"), "fn material() {}\n").unwrap();
    let (path, bytes) = resident::project_source(&dir.path().join(".planning"), "src/lib.rs").unwrap();
    assert_eq!(path, std::fs::canonicalize(dir.path().join("src/lib.rs")).unwrap().to_string_lossy());
    assert_eq!(bytes, b"fn material() {}\n");
}

#[test]
fn review_material_refuses_a_file_under_the_planning_root() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join(".planning")).unwrap();
    std::fs::write(dir.path().join(".planning/STATE.json"), "{}").unwrap();
    let error = resident::project_source(&dir.path().join(".planning"), ".planning/STATE.json").unwrap_err();
    assert_eq!(error, ".planning/STATE.json is not a project source file");
}

#[test]
fn review_material_refuses_a_file_outside_the_project() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("project/.planning")).unwrap();
    std::fs::write(dir.path().join("outside.rs"), "fn outside() {}\n").unwrap();
    let error = resident::project_source(&dir.path().join("project/.planning"), "../outside.rs").unwrap_err();
    assert_eq!(error, "../outside.rs is not a project source file");
}
