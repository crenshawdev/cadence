//! The adoption slice, end to end: a legacy tree whose ticked phases cannot
//! derive complete is first-touched by the real binary over stdio, the import
//! writes a declared completion for each such phase, `execute-next` is no
//! longer refused `state-conflict` at them, and not one document byte moves.
#[path = "support/phase13.rs"]
pub mod phase13;
use phase13::*;
use serde_json::{Value, json};
use std::{collections::BTreeMap, fs, path::Path};

const ROADMAP: &str = "## Phases\n\
- [x] **Phase 1: Done right** - summary and passing UAT\n\
- [x] **Phase 9: Review delivery** - summary, one failed UAT item\n\
- [x] **Phase 10: Closed by hand** - plans only\n\
- [ ] **Phase 13: Verification** - the phase to execute\n";
/// sha256 of ROADMAP, computed by hand with sha256sum.
const ROADMAP_DIGEST: &str = "3753a2a10870eb0d09170e168be9784cf186a6683ee32b3c78cf818d48f4c340";

const UAT_9: &str = "---\nstatus: testing\nphase: 9\n---\n\n## Items\n\n\
### 1. Advisory prompt\nexpected: the prompt is read-only.\nstatus: pass\nfirst_pass: pass\n\n\
### 2. Raw forwarding\nexpected: bytes forward unchanged.\nstatus: pass\nfirst_pass: pass\n\n\
### 3. Retained identity\nexpected: the retained id survives restart.\nstatus: fail\nfirst_pass: fail\n";

/// Every regular file under the planning root as (relative path, bytes).
fn documents(root: &Path) -> BTreeMap<String, Vec<u8>> {
    fn visit(base: &Path, path: &Path, out: &mut BTreeMap<String, Vec<u8>>) {
        for entry in fs::read_dir(path).unwrap() {
            let child = entry.unwrap().path();
            if child.is_dir() {
                visit(base, &child, out);
            } else {
                out.insert(child.strip_prefix(base).unwrap().to_string_lossy().into_owned(), fs::read(&child).unwrap());
            }
        }
    }
    let mut out = BTreeMap::new();
    visit(root, root, &mut out);
    out
}

fn legacy_project() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    for phase in [1, 9, 10, 13] {
        fs::create_dir_all(root.join(format!("phases/{phase}"))).unwrap();
        fs::write(root.join(format!("phases/{phase}/PLAN-1.md")), format!("# Phase {phase} plan\n")).unwrap();
    }
    fs::write(root.join("ROADMAP.md"), ROADMAP).unwrap();
    fs::write(root.join("config.json"), "{}\n").unwrap();
    fs::write(root.join("phases/1/SUMMARY.md"), "# Phase 1 summary\n").unwrap();
    fs::write(root.join("phases/1/UAT.md"), "## Items\n\n### 1. Done\nstatus: pass\n").unwrap();
    fs::write(root.join("phases/9/SUMMARY.md"), "# Phase 9 summary\n").unwrap();
    fs::write(root.join("phases/9/UAT.md"), UAT_9).unwrap();
    git(temp.path(), &["init", "--initial-branch=fixture/adoption"]);
    fs::write(temp.path().join(".gitignore"), ".planning/\n").unwrap();
    git(temp.path(), &["add", ".gitignore"]);
    git(temp.path(), &["commit", "-m", "Adoption fixture baseline"]);
    temp
}

#[test]
fn import_declares_ticked_phases_the_documents_cannot_derive_complete() {
    let temp = legacy_project();
    let project = temp.path();
    let root = project.join(".planning");
    let before = documents(&root);
    let mut client = Client::open(project);
    let execute = client.call("cadence_query", json!({"operation":"execute-next","phase":13}));
    client.finish();
    assert_ne!(execute["code"], "state-conflict", "the import declared the ticked phases: {execute}");
    assert!(!execute["reason"].as_str().unwrap_or_default().contains("ROADMAP.md:3"), "{execute}");
    // Every document byte is as it was; the store's own files are the only additions.
    let after = documents(&root);
    for (path, bytes) in &before {
        assert_eq!(after.get(path), Some(bytes), "{path} changed under first touch");
    }
    let created: Vec<&String> = after.keys().filter(|k| !before.contains_key(*k)).collect();
    assert_eq!(created, ["config.v4.json", "decisions.jsonl", "items.jsonl", "state.json"]);
    // Two records, one per ticked phase the legacy table derives short of
    // complete: phase 9 (UAT fail) and phase 10 (no SUMMARY, no UAT). Phase 1
    // derives complete and gets none; phase 13 is unticked and gets none.
    let snapshot = reopened(project).snapshot;
    assert_eq!(snapshot.data.get("verification"), None, "no verification authority was invented");
    let records = snapshot.data["adoption"]["declared_completions"].as_array().unwrap().clone();
    assert_eq!(snapshot.data["adoption"]["schema"], "adoption-1");
    assert_eq!(records.len(), 2, "{records:?}");
    let root_binding = records[0]["root_binding"].as_str().unwrap().to_owned();
    assert!(!root_binding.is_empty());
    for record in &records {
        assert_eq!(record["id"].as_str().unwrap().len(), 64);
        assert_eq!(record["root_binding"], json!(root_binding));
        assert_eq!(record["import_generation"], json!(1), "the import is the store's first commit");
        assert_eq!(record["source_generation"], snapshot.data["import"]["source_generation"]);
    }
    let shape = |record: &Value| {
        let mut shape = record.clone();
        for key in ["id", "root_binding", "import_generation", "source_generation"] {
            shape.as_object_mut().unwrap().remove(key);
        }
        shape
    };
    assert_eq!(shape(&records[0]), json!({
        "schema":"verification-declared-completion-1","phase":9,"provenance":"declared-at-import",
        "roadmap":{"line":3,"entry":1,"digest":ROADMAP_DIGEST},
        "derived":{"status":"executed","legacy_rule":"summary-and-uat"},
        "human_results":{"present":true,"pass":2,"fail":1,"skipped":0},
        "claims":[]}));
    assert_eq!(shape(&records[1]), json!({
        "schema":"verification-declared-completion-1","phase":10,"provenance":"declared-at-import",
        "roadmap":{"line":4,"entry":2,"digest":ROADMAP_DIGEST},
        "derived":{"status":"planned","legacy_rule":"summary-and-uat"},
        "human_results":null,
        "claims":[]}));
    // The documents the records were computed from are the import's source guards.
    let guarded: Vec<String> = snapshot.data["import"]["sources"].as_array().unwrap().iter()
        .map(|s| s["path"].as_str().unwrap().strip_prefix(root.canonicalize().unwrap().to_str().unwrap()).unwrap().to_owned()).collect();
    for name in ["/ROADMAP.md", "/phases/9/SUMMARY.md", "/phases/9/UAT.md", "/phases/10/SUMMARY.md", "/phases/10/UAT.md"] {
        assert!(guarded.contains(&name.to_owned()), "{name} is not guarded: {guarded:?}");
    }
    assert!(!guarded.contains(&"/phases/1/UAT.md".to_owned()), "a phase the documents derive complete needs no guard");
    // Negative control: a row ticked after the import is still a conflict; the
    // declaration is written once, at import, and never repairs a later tick.
    fs::write(root.join("ROADMAP.md"), ROADMAP.replace("- [ ] **Phase 13", "- [x] **Phase 13")).unwrap();
    let conflict = query(project, json!({"operation":"execute-next","phase":13}));
    assert_eq!(conflict["code"], "state-conflict", "{conflict}");
    assert_eq!(serde_json::from_str::<Value>(conflict["reason"].as_str().unwrap()).unwrap(),
        json!({"source":"ROADMAP.md:5 entry 3","field":"complete","declared":"true","derived":"false"}));
    assert_eq!(reopened(project).snapshot.data["adoption"]["declared_completions"].as_array().unwrap().len(), 2);
    println!("ADOPTION_EXECUTE_NEXT {execute}");
}
