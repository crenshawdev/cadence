use super::*;
use crate::derivation::*;
use serde_json::json;
use std::fs;

fn repo() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    assert!(temp.path().starts_with("/tmp"));
    git::run(temp.path(), ["init", "-b", "main"]).unwrap();
    fs::write(temp.path().join("baseline"), "baseline\n").unwrap();
    git::run(temp.path(), ["add", "--", "baseline"]).unwrap();
    commit(temp.path());
    temp
}

fn commit(root: &Path) {
    let output = std::process::Command::new("git")
        .current_dir(root)
        .args([
            "-c",
            "user.name=Pause Fixture",
            "-c",
            "user.email=pause@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-m",
            "test fixture",
        ])
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn input(root: &Path) -> Input {
    Input {
        scope: Scope {
            project: root.to_str().unwrap().into(),
            planning_root: root.join(".planning").to_str().unwrap().into(),
            cycle: "cycle".into(),
            occurrence: "pause-1".into(),
            phase: "1".into(),
            plan: "PLAN.md".into(),
            report: "reports/plan-1.md".into(),
        },
        phase: Some(Phase {
            identity: "1".into(),
            name: "Work".into(),
            total: 7,
            provenance: "recorded work".into(),
        }),
        sentence: Some("  verify the fix on the device 日本語  ".into()),
        authorized: BTreeSet::new(),
    }
}

#[test]
fn capture_clean_is_read_only_and_preserves_the_exact_sentence() {
    let temp = repo();
    let before = git::observe(temp.path()).unwrap();
    let captured = capture(input(temp.path()), None).unwrap();
    assert!(captured.originally_clean());
    assert_eq!(captured.sentence, "  verify the fix on the device 日本語  ");
    assert_eq!(captured.observed, before);
    assert_eq!(git::observe(temp.path()).unwrap(), before);
}

#[test]
fn capture_staged_unstaged_untracked_deleted_and_renamed_paths() {
    let temp = repo();
    let root = temp.path();
    for name in [
        "staged",
        "unstaged",
        "deleted 日本語",
        "rename source",
        "unrelated",
    ] {
        fs::write(root.join(name), format!("original {name}\n")).unwrap();
        git::run(root, ["add", "--", name]).unwrap();
    }
    commit(root);
    fs::write(root.join("staged"), b"staged bytes\0\xff").unwrap();
    git::run(root, ["add", "--", "staged"]).unwrap();
    fs::write(root.join("unstaged"), "unstaged bytes").unwrap();
    fs::write(root.join("unrelated"), "do not authorize").unwrap();
    fs::write(root.join("untracked 空 白"), "new bytes").unwrap();
    fs::remove_file(root.join("deleted 日本語")).unwrap();
    git::run(root, ["mv", "--", "rename source", "renamed 空 白"]).unwrap();
    let mut request = input(root);
    request.authorized = [
        "staged",
        "unstaged",
        "deleted 日本語",
        "rename source",
        "renamed 空 白",
        "untracked 空 白",
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect();
    let before = git::observe(root).unwrap();
    let captured = capture(request, None).unwrap();
    assert_eq!(
        captured.unrelated(),
        BTreeSet::from([PathBuf::from("unrelated")])
    );
    let change = |name: &str| {
        captured
            .observed
            .changes
            .iter()
            .find(|c| c.path == Path::new(name))
            .unwrap()
    };
    assert_eq!(
        (change("staged").index, change("staged").worktree),
        (b'M', b' ')
    );
    assert_eq!(
        (change("unstaged").index, change("unstaged").worktree),
        (b' ', b'M')
    );
    assert_eq!(change("untracked 空 白").index, b'?');
    assert_eq!(change("deleted 日本語").material, git::Material::Missing);
    assert_eq!(
        change("renamed 空 白").original.as_deref(),
        Some(Path::new("rename source"))
    );
    assert_eq!(git::observe(root).unwrap(), before);
    assert_eq!(captured.observed, before);
}

#[test]
fn capture_refuses_missing_or_multiline_input_and_unsafe_paths_without_mutation() {
    let temp = repo();
    let before = git::observe(temp.path()).unwrap();
    for note in [
        None,
        Some(""),
        Some(" \t "),
        Some("first\nsecond"),
        Some("first\rsecond"),
    ] {
        let mut request = input(temp.path());
        request.sentence = note.map(str::to_owned);
        assert!(capture(request, None).is_err());
    }
    let mut request = input(temp.path());
    request.phase = None;
    assert!(
        capture(request, None)
            .unwrap_err()
            .to_string()
            .contains("missing pause phase")
    );
    for path in ["../outside", "/absolute", ".git/index", ""] {
        let mut request = input(temp.path());
        request.authorized.insert(path.into());
        assert!(capture(request, None).is_err());
    }
    assert_eq!(git::observe(temp.path()).unwrap(), before);
}

struct Intake(IntakeObservation);
impl IntakeIo for Intake {
    fn observe_intake(&mut self) -> std::result::Result<IntakeObservation, DerivationError> {
        Ok(self.0.clone())
    }
}

#[test]
fn capture_retained_interrupted_close_keeps_name_total_and_original_provenance() {
    let temp = repo();
    let planning = temp.path().join(".planning");
    fs::create_dir(&planning).unwrap();
    fs::write(
        planning.join("ROADMAP.md"),
        "# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Work**\n",
    )
    .unwrap();
    let original = json!({"available":true,"phase":1,"total":7,"name":"Retained name",
        "status":"paused","next":"original pause", "updated":"2026-09-06"});
    let data = json!({"cursor":original,"unrelated":{"keep":true}});
    let selected = select_intake(&data).unwrap();
    let checked = query_with_intake(
        &planning,
        &mut ArtifactFiles,
        &selected.cursor,
        &selected.observation,
        &mut Intake(selected.observation.clone()),
    )
    .unwrap();
    let adopted = adopt(&data, json!({"existing":"memo"}), checked.intake().unwrap()).unwrap();
    fs::write(
        planning.join("ROADMAP.md"),
        "# Roadmap\n\n## Phases\n\nNo active phases.\n",
    )
    .unwrap();
    let selected = select_intake(&adopted).unwrap();
    let checked = query_with_intake(
        &planning,
        &mut ArtifactFiles,
        &selected.cursor,
        &selected.observation,
        &mut Intake(selected.observation.clone()),
    )
    .unwrap();
    assert_eq!(checked.answer().current, None);
    assert_eq!(checked.answer().total, 0);
    let before = adopted.clone();
    let mut request = input(temp.path());
    request.phase = None;
    let captured = capture(request, checked.intake()).unwrap();
    assert_eq!(captured.phase.name, "Retained name");
    assert_eq!(captured.phase.total, 7);
    assert_eq!(captured.phase.identity, "1");
    assert_eq!(
        serde_json::from_str::<CursorProvenance>(&captured.phase.provenance)
            .unwrap()
            .original_cursor,
        original
    );
    assert_eq!(adopted, before);
}

#[cfg(unix)]
#[test]
fn capture_preserves_non_utf8_and_shell_metacharacter_pathnames() {
    use std::os::unix::ffi::OsStrExt;
    let temp = repo();
    let path = PathBuf::from(std::ffi::OsStr::from_bytes(
        b"literal $(touch escaped)\n\xff",
    ));
    fs::write(temp.path().join(&path), b"exact\0bytes").unwrap();
    let mut request = input(temp.path());
    request.authorized.insert(path.clone());
    let captured = capture(request, None).unwrap();
    assert_eq!(captured.observed.changes[0].path, path);
    assert!(captured.unrelated().is_empty());
    assert!(!temp.path().join("escaped").exists());
    assert_eq!(git::observe(temp.path()).unwrap(), captured.observed);
}
