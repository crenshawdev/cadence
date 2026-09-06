use cadence::derivation::*;
use std::collections::BTreeMap;
use std::fs;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};

fn roadmap(entries: &str) -> Vec<u8> {
    format!("## Phases\n{entries}\n").into_bytes()
}

/// Every unconfigured operation is genuine absence. Reads assert the exact
/// allowlist, so a PLAN/SUMMARY body or excluded input read fails the fixture.
#[derive(Clone, Default)]
struct MemoryIo {
    reads: BTreeMap<PathBuf, Observation<Vec<u8>>>,
    lists: BTreeMap<PathBuf, Observation<Vec<String>>>,
    probes: BTreeMap<PathBuf, Observation<()>>,
    calls: Vec<(String, PathBuf)>,
}

impl MemoryIo {
    fn one() -> Self {
        let mut io = Self::default();
        io.probes
            .insert("/planning".into(), Observation::Present(()));
        io.reads.insert(
            "/planning/ROADMAP.md".into(),
            Observation::Present(roadmap("- [ ] **Phase 1: One**")),
        );
        io
    }
    fn record(&mut self, operation: &str, path: &Path) {
        self.calls.push((operation.into(), path.into()));
    }
}

impl ArtifactIo for MemoryIo {
    fn resolve_root(&mut self, selected: &Path) -> Result<PathBuf, InputFailure> {
        self.record("resolve", selected);
        assert!(selected.is_absolute());
        Ok(selected.into())
    }
    fn probe_root(&mut self, path: &Path) -> Observation<()> {
        self.record("root", path);
        self.probes
            .get(path)
            .cloned()
            .unwrap_or(Observation::Absent)
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        self.record("list", path);
        self.lists.get(path).cloned().unwrap_or(Observation::Absent)
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        self.record("summary", path);
        self.probes
            .get(path)
            .cloned()
            .unwrap_or(Observation::Absent)
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        assert!(
            matches!(
                path.file_name().unwrap().to_str(),
                Some("ROADMAP.md" | "UAT.md")
            ),
            "excluded read: {}",
            path.display()
        );
        self.record("read", path);
        self.reads.get(path).cloned().unwrap_or(Observation::Absent)
    }
}

fn denial(path: &str) -> InputFailure {
    InputFailure {
        path: path.into(),
        category: InputFailureCategory::PermissionDenied,
        diagnostic: Some("injected denial".into()),
    }
}

#[test]
fn capture_matching_directories_count_and_dangling_summary_is_absent() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    fs::write(root.join("ROADMAP.md"), roadmap("- [ ] **Phase 1: One**")).unwrap();
    let phase = root.join("phases/1");
    fs::create_dir_all(phase.join("PLAN-01.md")).unwrap();
    fs::create_dir(phase.join("SUMMARY.md")).unwrap();
    for name in [
        "PLAN.md",
        "PLAN-2.md",
        "PLAN-10.md",
        "PLAN-.md",
        "PLAN-１.md",
        "PLAN-1.md.bak",
        "plan.md",
        "CONTEXT.md",
    ] {
        fs::write(phase.join(name), []).unwrap();
    }
    let capture = capture_inputs(root, &mut ArtifactFiles).unwrap();
    assert_eq!(
        capture.phases[0].plans,
        Observation::Present(vec![
            "PLAN-01.md".into(),
            "PLAN-10.md".into(),
            "PLAN-2.md".into(),
            "PLAN.md".into()
        ])
    );
    assert_eq!(capture.phases[0].summary, Observation::Present(()));
    fs::remove_dir(phase.join("SUMMARY.md")).unwrap();
    symlink("missing", phase.join("SUMMARY.md")).unwrap();
    assert_eq!(
        capture_inputs(root, &mut ArtifactFiles).unwrap().phases[0].summary,
        Observation::Absent
    );
}

#[test]
fn capture_numeric_aliases_once_and_permuted_lists_are_identical() {
    let mut io = MemoryIo::one();
    io.reads.insert(
        "/planning/ROADMAP.md".into(),
        Observation::Present(roadmap("- [ ] **Phase 1.10: A**\n- [ ] **Phase 1.1: B**")),
    );
    io.lists.insert(
        "/planning/phases/1.1".into(),
        Observation::Present(vec![
            "SUMMARY.md".into(),
            "PLAN-2.md".into(),
            "PLAN-1.md".into(),
            "STATE.md".into(),
        ]),
    );
    let a = capture_inputs(Path::new("/planning"), &mut io).unwrap();
    assert_eq!(a.phases.len(), 1);
    assert_eq!(
        a.declarations
            .as_ref()
            .unwrap()
            .as_ref()
            .unwrap()
            .phases
            .len(),
        2
    );
    assert_eq!(
        io.calls,
        vec![
            ("resolve".into(), "/planning".into()),
            ("root".into(), "/planning".into()),
            ("read".into(), "/planning/ROADMAP.md".into()),
            ("list".into(), "/planning/phases/1.1".into()),
            ("summary".into(), "/planning/phases/1.1/SUMMARY.md".into()),
            ("read".into(), "/planning/phases/1.1/UAT.md".into()),
        ]
    );
    if let Observation::Present(names) =
        io.lists.get_mut(Path::new("/planning/phases/1.1")).unwrap()
    {
        names.reverse();
    }
    assert_eq!(a, capture_inputs(Path::new("/planning"), &mut io).unwrap());
}

#[test]
fn capture_denials_preserve_path_category_and_absence() {
    for (operation, path) in [
        ("root", "/planning"),
        ("read", "/planning/ROADMAP.md"),
        ("list", "/planning/phases/1"),
        ("summary", "/planning/phases/1/SUMMARY.md"),
        ("read", "/planning/phases/1/UAT.md"),
    ] {
        let mut io = MemoryIo::one();
        let error = denial(path);
        match operation {
            "root" | "summary" => {
                io.probes
                    .insert(path.into(), Observation::Failed(error.clone()));
            }
            "list" => {
                io.lists
                    .insert(path.into(), Observation::Failed(error.clone()));
            }
            _ => {
                io.reads
                    .insert(path.into(), Observation::Failed(error.clone()));
            }
        }
        let captured = capture_inputs(Path::new("/planning"), &mut io).unwrap();
        let encoded = serde_json::to_value(captured).unwrap();
        assert!(
            encoded
                .to_string()
                .contains(&serde_json::to_string(&error).unwrap()),
            "{encoded}"
        );
    }
    let ordinary = capture_inputs(Path::new("/planning"), &mut MemoryIo::one()).unwrap();
    assert_eq!(ordinary.phases[0].plans, Observation::Absent);
    assert_eq!(ordinary.phases[0].summary, Observation::Absent);
    assert_eq!(ordinary.phases[0].uat, Observation::Absent);
}

#[test]
fn capture_missing_root_stays_absent_and_addresses_are_normalized() {
    let temp = tempfile::tempdir().unwrap();
    let selected = temp.path().join("unused/../missing/.");
    let captured = capture_inputs(&selected, &mut ArtifactFiles).unwrap();
    assert_eq!(captured.root, temp.path().join("missing"));
    assert_eq!(captured.root_probe, Observation::Absent);
    assert!(!captured.root.exists());
    assert!(!temp.path().join("unused").exists());
    assert!(captured.declarations.is_none());
}

#[test]
fn capture_non_directory_nonregular_and_symlink_loop_failures() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    fs::write(root.join("ROADMAP.md"), roadmap("- [ ] **Phase 1: One**")).unwrap();
    fs::create_dir(root.join("phases")).unwrap();
    let phase = root.join("phases/1");
    fs::write(&phase, []).unwrap();
    let captured = capture_inputs(root, &mut ArtifactFiles).unwrap();
    assert!(
        matches!(&captured.phases[0].plans, Observation::Failed(e) if e.path == phase && e.category == InputFailureCategory::NotDirectory)
    );
    fs::remove_file(&phase).unwrap();
    fs::create_dir_all(phase.join("UAT.md")).unwrap();
    symlink("SUMMARY.md", phase.join("SUMMARY.md")).unwrap();
    let captured = capture_inputs(root, &mut ArtifactFiles).unwrap();
    assert!(
        matches!(&captured.phases[0].uat, Observation::Failed(e) if e.path == phase.join("UAT.md") && e.category == InputFailureCategory::OtherIo)
    );
    assert!(
        matches!(&captured.phases[0].summary, Observation::Failed(e) if e.path == phase.join("SUMMARY.md") && e.category == InputFailureCategory::SymlinkLoop)
    );
}

#[test]
fn capture_retains_raw_bytes_and_decodes_with_replacement() {
    let mut io = MemoryIo::one();
    let bytes = b"## Phases\n- [ ] **Phase 1: Bad \xff**\n".to_vec();
    io.reads.insert(
        "/planning/ROADMAP.md".into(),
        Observation::Present(bytes.clone()),
    );
    let captured = capture_inputs(Path::new("/planning"), &mut io).unwrap();
    assert_eq!(captured.roadmap, Observation::Present(bytes));
    assert_eq!(
        captured.declarations.unwrap().unwrap().phases[0].name,
        "Bad \u{fffd}"
    );
}
