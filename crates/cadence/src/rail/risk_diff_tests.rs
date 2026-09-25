//! The staged-diff classifier over diff bytes: what it reports per category,
//! and when it cannot tell.
use super::risk_diff::{Match, scan};
use std::path::PathBuf;

fn categories() -> Vec<String> {
    vec!["destructive".into(), "untrusted_input".into()]
}

fn diff(path: &str, added: &[&str]) -> Vec<u8> {
    let mut body = format!(
        "diff --git a/{path} b/{path}\nindex 1111111..2222222 100644\n--- a/{path}\n+++ b/{path}\n@@ -1 +1,{} @@\n context\n",
        added.len() + 1
    );
    for line in added {
        body.push_str(&format!("+{line}\n"));
    }
    body.into_bytes()
}

#[test]
fn each_category_reports_the_changed_line_that_signals_it() {
    let path = "work/notes.txt";
    let scan = scan(
        Some(&diff(path, &["DROP TABLE accounts;", "const body = JSON.parse(input);"])),
        &[PathBuf::from(path)],
        &categories(),
    )
    .unwrap();
    assert_eq!(
        scan.matches,
        [
            Match { category: "destructive".into(), signal: "changed line: a DROP statement".into() },
            Match { category: "untrusted_input".into(), signal: "changed line: a JSON.parse call".into() },
        ]
    );
    assert!(scan.checked && !scan.inconclusive);
}

#[test]
fn a_signal_for_a_category_not_configured_is_not_reported() {
    let path = "work/notes.txt";
    let scan = scan(Some(&diff(path, &["DROP TABLE accounts;"])), &[PathBuf::from(path)], &["untrusted_input".into()])
        .unwrap();
    assert!(scan.matches.is_empty());
}

#[test]
fn a_binary_change_is_checked_but_inconclusive_with_no_matches() {
    let body = b"diff --git a/logo.bin b/logo.bin\nindex 1111111..2222222 100644\nBinary files a/logo.bin and b/logo.bin differ\n";
    let scan = scan(Some(body), &[PathBuf::from("logo.bin")], &categories()).unwrap();
    assert!(scan.checked && scan.inconclusive);
    assert!(scan.matches.is_empty());
}

// Beside a readable text change, the binary section alone is what makes the
// scan inconclusive.
#[test]
fn a_binary_change_beside_a_text_change_is_still_inconclusive() {
    let mut body = diff("work/notes.txt", &["a plain sentence"]);
    body.extend_from_slice(b"diff --git a/logo.bin b/logo.bin\nindex 1111111..2222222 100644\nBinary files a/logo.bin and b/logo.bin differ\n");
    let scan = scan(Some(&body), &[PathBuf::from("work/notes.txt"), PathBuf::from("logo.bin")], &categories()).unwrap();
    assert!(scan.checked && scan.inconclusive);
    assert!(scan.matches.is_empty());
}

#[test]
fn a_change_matching_nothing_is_checked_conclusive_and_clear() {
    let path = "work/notes.txt";
    let scan = scan(Some(&diff(path, &["a plain sentence"])), &[PathBuf::from(path)], &categories()).unwrap();
    assert!(scan.checked && !scan.inconclusive);
    assert!(scan.matches.is_empty());
}
