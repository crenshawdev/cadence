//! The declaration pass of the import, through `SessionFactory::first_touch`
//! on a fixture tree: which ticked phases get a declared completion, which
//! documents guard the import, and that an edit between read and commit
//! refuses it with nothing written. A phase with a native completion record
//! cannot reach this pass (the import runs only where no completed store
//! exists) and is covered at the pass's own boundary in `adoption::tests`.
use super::*;
use cadence::adoption;
use serde_json::json;

const ROADMAP: &str = "## Phases\n\
- [x] **Phase 1: Done right** - summary and passing UAT\n\
- [x] **Phase 9: Review delivery** - summary, one failed UAT item\n\
- [x] **Phase 10: Closed by hand** - plans only\n\
- [ ] **Phase 13: Verification** - unticked and planned\n";
/// sha256 of ROADMAP, computed by hand with sha256sum.
const ROADMAP_DIGEST: &str = "779ab772536f4b50c5638de090d163c0b460ec1d9b545a896bbbfb47918d2182";

fn legacy_tree() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    for phase in [1, 9, 10, 13] {
        std::fs::create_dir_all(root.join(format!("phases/{phase}"))).unwrap();
        std::fs::write(root.join(format!("phases/{phase}/PLAN-1.md")), format!("# Phase {phase} plan\n")).unwrap();
    }
    std::fs::write(root.join("ROADMAP.md"), ROADMAP).unwrap();
    std::fs::write(root.join("config.json"), "{}\n").unwrap();
    std::fs::write(root.join("phases/1/SUMMARY.md"), "# Phase 1 summary\n").unwrap();
    std::fs::write(root.join("phases/1/UAT.md"), "## Items\n\n### 1. Done\nstatus: pass\n").unwrap();
    std::fs::write(root.join("phases/9/SUMMARY.md"), "# Phase 9 summary\n").unwrap();
    std::fs::write(root.join("phases/9/UAT.md"), "## Items\n\n### 1. A\nstatus: pass\n\n### 2. B\nstatus: pass\n\n### 3. C\nstatus: fail\n").unwrap();
    temp
}

fn tree_bytes(root: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    fn walk(root: &Path, at: &Path, out: &mut BTreeMap<PathBuf, Vec<u8>>) {
        for entry in std::fs::read_dir(at).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() { walk(root, &path, out) } else { out.insert(path.strip_prefix(root).unwrap().into(), std::fs::read(&path).unwrap()); }
        }
    }
    let mut out = BTreeMap::new();
    walk(root, root, &mut out);
    out
}

fn allow() -> Evaluate {
    Arc::new(|_, _| Ok(()))
}

#[test]
fn first_touch_declares_the_ticked_phases_the_documents_derive_short_of_complete() {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let fixture = legacy_tree();
        let root = fixture.path().canonicalize().unwrap();
        let before = tree_bytes(&root);
        let session = SessionFactory::new(None, allow()).first_touch(&root).await.unwrap();
        let view = session.request(Operation::Read).await.unwrap();
        assert_eq!(view.snapshot.generation, 1);
        let records = adoption::records(&view.snapshot.data).unwrap();
        let root_binding = cadence::verification::inputs::root_binding(&root).unwrap();
        let source_generation = session.import_manifest().source_generation.clone();
        let expected = |phase: u32, line: usize, entry: usize, status: cadence::derivation::LifecycleStatus, human: Option<(usize, usize)>| {
            adoption::record(&root_binding, &adoption::Declaration { phase,
                roadmap: adoption::Roadmap { line, entry, digest: ROADMAP_DIGEST.into() },
                derived: adoption::Derived { status, legacy_rule: "summary-and-uat".into() },
                human_results: human.map(|(pass, fail)| adoption::HumanResults { present: true, pass, fail, skipped: 0 }),
            }, adoption::AT_IMPORT, 1, &source_generation).unwrap()
        };
        // (a) phase 9: SUMMARY present, one UAT item fails, so the table says
        // executed; (b) phase 10: no SUMMARY, no UAT, so planned; (c) phase 1
        // derives complete and (d) phase 13 is unticked: neither is declared.
        assert_eq!(records, vec![
            expected(9, 3, 1, cadence::derivation::LifecycleStatus::Executed, Some((2, 1))),
            expected(10, 4, 2, cadence::derivation::LifecycleStatus::Planned, None),
        ]);
        assert_eq!(view.snapshot.data["adoption"]["schema"], "adoption-1");
        assert_eq!(view.snapshot.data.get("verification"), None);
        // The roadmap and each declared phase's two documents are source guards,
        // present or absent; the complete phase's documents are not.
        let guarded: Vec<(PathBuf, bool)> = session.import_manifest().sources.iter()
            .filter(|g| g.path.starts_with(root.join("phases")) || g.path == root.join("ROADMAP.md"))
            .map(|g| (g.path.strip_prefix(&root).unwrap().to_path_buf(), g.content.is_some())).collect();
        assert_eq!(guarded, [
            (PathBuf::from("ROADMAP.md"), true),
            (PathBuf::from("phases/9/SUMMARY.md"), true), (PathBuf::from("phases/9/UAT.md"), true),
            (PathBuf::from("phases/10/SUMMARY.md"), false), (PathBuf::from("phases/10/UAT.md"), false),
        ]);
        assert_eq!(session.import_manifest().created.len(), 4, "no document is created");
        // Every document byte is as it was.
        for (path, bytes) in &before {
            assert_eq!(std::fs::read(root.join(path)).unwrap(), *bytes, "{}", path.display());
        }
        // The lifecycle now agrees with every tick; the store is the only thing that changed.
        let answer = cadence::derivation::query(&root, &mut cadence::derivation::ArtifactFiles).unwrap();
        assert_eq!(answer.answer().phases.iter().map(|p| p.status).collect::<Vec<_>>(),
            [cadence::derivation::LifecycleStatus::Complete; 3].into_iter().chain([cadence::derivation::LifecycleStatus::Planned]).collect::<Vec<_>>());
        // No later write may add, drop or edit a declared completion.
        let current = session.derivation_view().await.unwrap();
        let mut data = current.snapshot.data.clone();
        data["adoption"]["declared_completions"] = json!([records[0]]);
        let refused = session.review_store().request(Operation::CompareTransact {
            expected_generation: current.snapshot.generation, expected_integrity: current.snapshot.integrity.clone(),
            transaction: Transaction { id: "later".into(), items: vec![], decisions: vec![], snapshot: Some(data), external: vec![] },
        }).await.unwrap_err();
        assert_eq!(refused, Error::Invalid("declared completions are written only by the import".into()));
        // A refused commit fails its owner; the bytes on disk are the answer.
        drop(session);
        assert!(!root.join(INTENT).exists(), "the refusal wrote no intent");
        let durable = cadence::context::persistence::read_snapshot(&root).unwrap().unwrap();
        assert_eq!(adoption::records(&durable.data).unwrap(), records);
        assert_eq!(durable.generation, 1);
        // A second first touch of the same tree writes nothing more.
        let again = SessionFactory::new(None, allow()).first_touch(&root).await.unwrap();
        let reopened = again.request(Operation::Read).await.unwrap();
        assert_eq!(adoption::records(&reopened.snapshot.data).unwrap(), records);
        assert_eq!(reopened.snapshot.generation, 1);
    });
}

#[test]
fn a_document_edited_between_read_and_commit_refuses_the_import_with_nothing_written() {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        for (name, edit) in [("phases/9/UAT.md", "## Items\n\n### 1. A\nstatus: pass\n"), ("ROADMAP.md", "## Phases\n- [ ] **Phase 9: Review delivery**\n"), ("phases/10/SUMMARY.md", "appeared\n")] {
            let fixture = legacy_tree();
            let root = fixture.path().canonicalize().unwrap();
            let before = tree_bytes(&root);
            let changed = root.join(name);
            let factory = SessionFactory::new(None, allow()).with_probe(Arc::new(move |stage, _| {
                if stage == Stage::Prepared { std::fs::write(&changed, edit)?; }
                Ok(())
            }));
            let error = factory.first_touch(&root).await.err().expect("the import is refused");
            assert_eq!(error, Error::Conflict(format!("legacy source changed during import: {}", root.join(name).display())));
            for file in [ITEMS, DECISIONS, STATE, "config.v4.json", INTENT] {
                assert!(!root.join(file).exists(), "{name}: {file} was written");
            }
            let mut after = tree_bytes(&root);
            assert_eq!(after.remove(Path::new(name)), Some(edit.as_bytes().to_vec()));
            let mut expected = before;
            expected.remove(Path::new(name));
            assert_eq!(after, expected, "{name}: only the probe's edit differs");
        }
        // A phase the documents derive complete is not guarded: an edit to its
        // UAT during the import does not refuse it (the same exposure as today).
        let fixture = legacy_tree();
        let root = fixture.path().canonicalize().unwrap();
        let changed = root.join("phases/1/UAT.md");
        let factory = SessionFactory::new(None, allow()).with_probe(Arc::new(move |stage, _| {
            if stage == Stage::Prepared { std::fs::write(&changed, "## Items\n\n### 1. Done\nstatus: fail\n")?; }
            Ok(())
        }));
        let session = factory.first_touch(&root).await.unwrap();
        assert_eq!(adoption::records(&session.request(Operation::Read).await.unwrap().snapshot.data).unwrap().iter().map(|r| r.phase).collect::<Vec<_>>(), [9, 10]);
    });
}
