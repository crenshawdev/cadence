use super::*;
use crate::derivation::{IntakeObservation, normalize_imported_cursor};

/// Capture judges values only: the project path has to be absolute, and the
/// Git observation is whatever the caller already took.
const PROJECT: &str = "/project";
const NOTE: &str = "  verify the fix on the device 日本語  ";

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
        sentence: Some(NOTE.into()),
        authorized: BTreeSet::new(),
    }
}

fn observed(changes: Vec<git::Change>) -> git::Observation {
    git::Observation {
        head: "a".repeat(40),
        branch: b"work".to_vec(),
        index: Vec::new(),
        changes,
    }
}

fn change(path: &str, original: Option<&str>) -> git::Change {
    git::Change {
        index: if original.is_some() { b'R' } else { b' ' },
        worktree: b'M',
        path: path.into(),
        original: original.map(PathBuf::from),
        material: git::Material::Missing,
    }
}

fn retained(available: bool) -> ValidatedIntake {
    let raw = serde_json::json!({"available": available, "phase": 3, "total": 4, "name": "Three",
        "status": "planned", "next": "/cad-execute 3", "updated": "2026-09-06"});
    ValidatedIntake {
        cursor: normalize_imported_cursor(&raw).unwrap(),
        observation: IntakeObservation { cursor: Some(raw), retirement: None },
    }
}

#[test]
fn capture_refuses_a_missing_blank_or_multiline_note() {
    for note in [
        None,
        Some(""),
        Some(" \t "),
        Some("first\nsecond"),
        Some("first\rsecond"),
    ] {
        let mut request = input(Path::new(PROJECT));
        request.sentence = note.map(str::to_owned);
        assert!(capture(request, None, observed(vec![])).is_err(), "{note:?}");
    }
}

#[test]
fn capture_refuses_a_missing_phase() {
    let mut request = input(Path::new(PROJECT));
    request.phase = None;
    assert!(
        capture(request, None, observed(vec![]))
            .unwrap_err()
            .to_string()
            .contains("missing pause phase")
    );
}

#[test]
fn capture_refuses_an_unsafe_authorized_path() {
    for path in ["../outside", "/absolute", ".git/index", ""] {
        let mut request = input(Path::new(PROJECT));
        request.authorized.insert(path.into());
        assert!(capture(request, None, observed(vec![])).is_err(), "{path}");
    }
}

#[test]
fn capture_keeps_the_note_exactly_as_given() {
    let captured = capture(input(Path::new(PROJECT)), None, observed(vec![])).unwrap();
    assert_eq!(captured.sentence, NOTE);
}

#[test]
fn a_capture_whose_observation_has_no_changes_is_originally_clean() {
    let clean = capture(input(Path::new(PROJECT)), None, observed(vec![])).unwrap();
    assert!(clean.originally_clean());
    let dirty = capture(input(Path::new(PROJECT)), None, observed(vec![change("a", None)])).unwrap();
    assert!(!dirty.originally_clean());
}

#[test]
fn unrelated_lists_every_changed_path_and_rename_source_outside_the_authorized_set() {
    let mut request = input(Path::new(PROJECT));
    request.authorized = ["a", "new"].map(PathBuf::from).into();
    let changes = vec![change("a", None), change("new", Some("old")), change("c", None)];
    let captured = capture(request, None, observed(changes)).unwrap();
    assert_eq!(captured.unrelated(), ["c", "old"].map(PathBuf::from).into());
}

// The roadmap is never consulted: a phase it no longer lists still comes back
// from the cursor retained at import.
#[test]
fn without_a_phase_capture_takes_the_retained_cursors_phase() {
    let mut request = input(Path::new(PROJECT));
    request.phase = None;
    request.scope.phase = String::new();
    let intake = retained(true);
    let captured = capture(request, Some(&intake), observed(vec![])).unwrap();
    assert_eq!(
        (captured.phase.identity.as_str(), captured.phase.name.as_str(), captured.phase.total),
        ("3", "Three", 4)
    );
    assert_eq!(captured.scope.phase, "3");
    let provenance: CursorProvenance = serde_json::from_str(&captured.phase.provenance).unwrap();
    assert_eq!(&provenance, intake.cursor().provenance());
}

#[test]
fn an_unusable_retained_cursor_supplies_no_phase() {
    let mut request = input(Path::new(PROJECT));
    request.phase = None;
    request.scope.phase = String::new();
    assert!(
        capture(request, Some(&retained(false)), observed(vec![]))
            .unwrap_err()
            .to_string()
            .contains("missing pause phase")
    );
}
