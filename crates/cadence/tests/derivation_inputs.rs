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

/// Switch snapshots at the second root resolution, precisely between the
/// production preparation and recheck. No domain implementation is replaced.
struct ChangingIo {
    before: MemoryIo,
    after: MemoryIo,
    captures: usize,
}

impl ChangingIo {
    fn new(before: MemoryIo, after: MemoryIo) -> Self {
        Self {
            before,
            after,
            captures: 0,
        }
    }
    fn active(&mut self) -> &mut MemoryIo {
        if self.captures < 2 {
            &mut self.before
        } else {
            &mut self.after
        }
    }
}

impl ArtifactIo for ChangingIo {
    fn resolve_root(&mut self, selected: &Path) -> Result<PathBuf, InputFailure> {
        self.captures += 1;
        self.active().resolve_root(selected)
    }
    fn probe_root(&mut self, path: &Path) -> Observation<()> {
        self.active().probe_root(path)
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        self.active().list_phase(path)
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        self.active().probe_summary(path)
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        self.active().read(path)
    }
}

struct DenialAsAbsence<I>(I);

fn swallow<T>(value: Observation<T>) -> Observation<T> {
    match value {
        Observation::Failed(_) => Observation::Absent,
        value => value,
    }
}

impl<I: ArtifactIo> ArtifactIo for DenialAsAbsence<I> {
    fn resolve_root(&mut self, selected: &Path) -> Result<PathBuf, InputFailure> {
        self.0.resolve_root(selected)
    }
    fn probe_root(&mut self, path: &Path) -> Observation<()> {
        swallow(self.0.probe_root(path))
    }
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        swallow(self.0.list_phase(path))
    }
    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        swallow(self.0.probe_summary(path))
    }
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        swallow(self.0.read(path))
    }
}

// The consumer intentionally knows nothing about artifact truth tables. It
// replaces its existing memo only when the supplied query returns success.
fn publication_guard(
    result: Result<Lifecycle, DerivationError>,
    expected: &DerivationError,
) -> Result<(), String> {
    let prior = b"existing memo: retain these exact bytes\n".to_vec();
    let mut memo = prior.clone();
    let mut publications = 0;
    let error = match result {
        Ok(answer) => {
            memo = serde_json::to_vec(&answer).unwrap();
            publications += 1;
            None
        }
        Err(error) => Some(error),
    };
    if error.as_ref() != Some(expected) || publications != 0 || memo != prior {
        return Err(format!(
            "error={error:?}, publications={publications}, prior_preserved={}",
            memo == prior
        ));
    }
    Ok(())
}

fn run_query(io: &mut impl ArtifactIo) -> Result<Lifecycle, DerivationError> {
    query(Path::new("/planning"), io).map(|candidate| candidate.answer().clone())
}

fn change_cases() -> Vec<(&'static str, MemoryIo, MemoryIo)> {
    let mut pending = MemoryIo::one();
    pending.probes.insert(
        "/planning/phases/1/SUMMARY.md".into(),
        Observation::Present(()),
    );
    pending.reads.insert(
        "/planning/phases/1/UAT.md".into(),
        Observation::Present(b"### 1. Item\nstatus: pending".to_vec()),
    );
    let mut pass = pending.clone();
    pass.reads.insert(
        "/planning/phases/1/UAT.md".into(),
        Observation::Present(b"### 1. Item\nstatus: pass".to_vec()),
    );
    let mut complete = pass.clone();
    complete.reads.insert(
        "/planning/ROADMAP.md".into(),
        Observation::Present(roadmap("- [x] **Phase 1: One**")),
    );
    let mut disappeared = complete.clone();
    disappeared
        .probes
        .remove(Path::new("/planning/phases/1/SUMMARY.md"));
    let mut absent = pass.clone();
    absent
        .probes
        .remove(Path::new("/planning/phases/1/SUMMARY.md"));
    vec![
        ("UAT byte change", pending, pass.clone()),
        ("SUMMARY appearance", absent, pass),
        ("SUMMARY disappearance", complete, disappeared),
    ]
}

#[test]
fn ac7_changes_refuse_candidate_and_preserve_prior_memo() {
    for (label, before, after) in change_cases() {
        let mut io = ChangingIo::new(before, after);
        let result = run_query(&mut io);
        assert_eq!(
            result.as_ref().unwrap_err().code(),
            "inputs-changed",
            "{label}"
        );
        assert_eq!(io.captures, 2);
        assert_eq!(
            publication_guard(result, &DerivationError::InputsChanged),
            Ok(()),
            "{label}"
        );
    }
}

#[test]
fn ac7_omitted_recheck_mutant_fails_same_publication_guard() {
    for (label, before, after) in change_cases() {
        let mut io = ChangingIo::new(before, after);
        let omitted = prepare_query(Path::new("/planning"), &mut io)
            .map(|prepared| prepared.answer().clone());
        assert_eq!(io.captures, 1);
        assert!(
            publication_guard(omitted, &DerivationError::InputsChanged).is_err(),
            "mutant survived: {label}"
        );
    }
}

fn denied(operation: &str, path: &str) -> MemoryIo {
    let mut io = MemoryIo::one();
    match operation {
        "root" | "summary" => {
            io.probes
                .insert(path.into(), Observation::Failed(denial(path)));
        }
        "list" => {
            io.lists
                .insert(path.into(), Observation::Failed(denial(path)));
        }
        _ => {
            io.reads
                .insert(path.into(), Observation::Failed(denial(path)));
        }
    }
    io
}

const DENIALS: [(&str, &str); 5] = [
    ("root", "/planning"),
    ("read", "/planning/ROADMAP.md"),
    ("list", "/planning/phases/1"),
    ("summary", "/planning/phases/1/SUMMARY.md"),
    ("read", "/planning/phases/1/UAT.md"),
];

#[test]
fn ac7_read_list_probe_denials_refuse_at_prepare_and_recheck() {
    for (operation, path) in DENIALS {
        for second in [false, true] {
            let after = denied(operation, path);
            let before = if second {
                MemoryIo::one()
            } else {
                after.clone()
            };
            let mut io = ChangingIo::new(before, after);
            let result = run_query(&mut io);
            assert_eq!(result.as_ref().unwrap_err().code(), "input-error");
            assert_eq!(
                publication_guard(result, &DerivationError::InputFailure(denial(path))),
                Ok(()),
                "{operation} {path} second={second}"
            );
        }
    }
}

#[test]
fn ac7_denial_as_absence_mutant_fails_same_publication_guard() {
    for (operation, path) in DENIALS {
        let mut io = DenialAsAbsence(denied(operation, path));
        let result = run_query(&mut io);
        assert!(
            publication_guard(result, &DerivationError::InputFailure(denial(path))).is_err(),
            "mutant survived: {path}"
        );
    }
}

#[test]
fn ac7_ordinary_absence_keeps_truth_table_and_same_capture() {
    for (plan, summary, uat, status) in [
        (false, false, None, LifecycleStatus::Unplanned),
        (true, false, None, LifecycleStatus::Planned),
        (false, true, None, LifecycleStatus::Executed),
        (false, true, Some(""), LifecycleStatus::Executed),
        (
            false,
            true,
            Some("---\nstatus: complete\n---"),
            LifecycleStatus::Executed,
        ),
        (
            false,
            true,
            Some("### 1. Item\nstatus: pass"),
            LifecycleStatus::Complete,
        ),
        (
            true,
            true,
            Some("### 1. Item\nstatus: pass"),
            LifecycleStatus::Complete,
        ),
    ] {
        let mut io = MemoryIo::one();
        if plan {
            io.lists.insert(
                "/planning/phases/1".into(),
                Observation::Present(vec!["PLAN.md".into()]),
            );
        }
        if summary {
            io.probes.insert(
                "/planning/phases/1/SUMMARY.md".into(),
                Observation::Present(()),
            );
        }
        if let Some(text) = uat {
            io.reads.insert(
                "/planning/phases/1/UAT.md".into(),
                Observation::Present(text.as_bytes().to_vec()),
            );
        }
        if status == LifecycleStatus::Complete {
            io.reads.insert(
                "/planning/ROADMAP.md".into(),
                Observation::Present(roadmap("- [x] **Phase 1: One**")),
            );
        }
        let prepared = prepare_query(Path::new("/planning"), &mut io).unwrap();
        let rechecked = recheck_query(&prepared, &mut io).unwrap();
        assert_eq!(prepared.capture(), rechecked.capture());
        assert_eq!(prepared.answer(), rechecked.answer());
        assert_eq!(rechecked.answer().phases[0].status, status);
        assert_eq!(run_query(&mut io).unwrap(), *rechecked.answer());
    }
}

#[test]
fn ac7_other_named_changes_refuse_but_excluded_names_do_not() {
    for change in [
        "root absent",
        "roadmap absent",
        "roadmap invalid",
        "plan appearance",
        "UAT absent to empty",
    ] {
        let before = MemoryIo::one();
        let mut after = before.clone();
        match change {
            "root absent" => {
                after.probes.remove(Path::new("/planning"));
            }
            "roadmap absent" => {
                after.reads.remove(Path::new("/planning/ROADMAP.md"));
            }
            "roadmap invalid" => {
                after.reads.insert(
                    "/planning/ROADMAP.md".into(),
                    Observation::Present(b"invalid".to_vec()),
                );
            }
            "plan appearance" => {
                after.lists.insert(
                    "/planning/phases/1".into(),
                    Observation::Present(vec!["PLAN.md".into()]),
                );
            }
            _ => {
                after.reads.insert(
                    "/planning/phases/1/UAT.md".into(),
                    Observation::Present(vec![]),
                );
            }
        }
        assert_eq!(
            publication_guard(
                run_query(&mut ChangingIo::new(before, after)),
                &DerivationError::InputsChanged
            ),
            Ok(()),
            "{change}"
        );
    }
    let mut before = MemoryIo::one();
    before.lists.insert(
        "/planning/phases/1".into(),
        Observation::Present(vec![
            "PLAN-2.md".into(),
            "PLAN-1.md".into(),
            "CONTEXT.md".into(),
        ]),
    );
    let mut after = before.clone();
    after.lists.insert(
        "/planning/phases/1".into(),
        Observation::Present(vec![
            "STATE.md".into(),
            "PLAN-1.md".into(),
            "PLAN-2.md".into(),
        ]),
    );
    assert_eq!(
        run_query(&mut ChangingIo::new(before, after))
            .unwrap()
            .phases[0]
            .status,
        LifecycleStatus::Planned
    );
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
