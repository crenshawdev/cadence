//! The Write/Edit guard judged over values. The filesystem is a table of what
//! each lookup answers for one exact path, and a path not in it is missing. The
//! table resolves nothing: a link names the canonical path it leads to. Nothing
//! here touches a disk, reads the environment or starts a program.

use super::{
    CONFIG_DENIAL, Entry, Event, Input, Lookup, MAX_INPUT_BYTES, ToolInput, config_destinations,
    global_setting, input, protected_target, resolve_existing_prefix, resolve_target,
    same_destination, write_edit,
};
use clap::Parser;
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::io::{Error, ErrorKind, Result};
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Ask {
    Metadata,
    Present,
    Canonicalize,
}

struct Seen {
    canonical: PathBuf,
    entry: Entry,
}

struct Tree {
    paths: BTreeMap<PathBuf, Seen>,
    /// One lookup of one path that fails with something other than missing.
    failure: Option<(Ask, PathBuf)>,
    /// The process's own directory, where a relative path is made absolute.
    process_dir: PathBuf,
}

fn tree() -> Tree {
    Tree { paths: BTreeMap::new(), failure: None, process_dir: "/".into() }
}

impl Tree {
    fn add(mut self, path: &str, directory: bool) -> Self {
        let identity = (1, self.paths.len() as u64 + 1);
        self.paths.insert(path.into(), Seen { canonical: path.into(), entry: Entry { directory, identity } });
        self
    }

    fn dir(self, path: &str) -> Self {
        self.add(path, true)
    }

    fn file(self, path: &str) -> Self {
        self.add(path, false)
    }

    /// A symlink at `path` to the listed `to`.
    fn link(mut self, path: &str, to: &str) -> Self {
        let entry = self.paths[Path::new(to)].entry;
        self.paths.insert(path.into(), Seen { canonical: to.into(), entry });
        self
    }

    /// A second name for the listed file `of`.
    fn hard(mut self, path: &str, of: &str) -> Self {
        let entry = self.paths[Path::new(of)].entry;
        self.paths.insert(path.into(), Seen { canonical: path.into(), entry });
        self
    }

    fn failing(mut self, ask: Ask, path: &str) -> Self {
        self.failure = Some((ask, path.into()));
        self
    }

    fn seen(&self, ask: Ask, path: &Path) -> Result<&Seen> {
        if self.failure.as_ref().is_some_and(|(failing, at)| *failing == ask && at == path) {
            return Err(Error::from(ErrorKind::PermissionDenied));
        }
        self.paths.get(path).ok_or_else(|| Error::from(ErrorKind::NotFound))
    }
}

impl Lookup for Tree {
    fn metadata(&self, path: &Path) -> Result<Entry> {
        self.seen(Ask::Metadata, path).map(|seen| seen.entry)
    }

    fn present(&self, path: &Path) -> Result<()> {
        self.seen(Ask::Present, path).map(|_| ())
    }

    fn canonicalize(&self, path: &Path) -> Result<PathBuf> {
        self.seen(Ask::Canonicalize, path).map(|seen| seen.canonical.clone())
    }

    fn absolute(&self, path: &Path) -> Result<PathBuf> {
        Ok(self.process_dir.join(path))
    }
}

fn event(cwd: &str, target: &str) -> Event {
    Event {
        tool_name: "Write".into(),
        cwd: cwd.into(),
        tool_input: ToolInput { file_path: target.into() },
        hook_event_name: Some("PreToolUse".into()),
    }
}

fn owned(path: &str) -> std::result::Result<(), String> {
    Err(format!("Cadence owns {path}; use the native execution boundary instead of Write/Edit"))
}

fn denied(reason: &str) -> std::result::Result<PathBuf, String> {
    Err(reason.into())
}

fn write_input(file_path: &str) -> Vec<u8> {
    format!(
        r#"{{"hook_event_name":"PreToolUse","tool_name":"Write","cwd":"/p","tool_input":{{"file_path":"{file_path}","content":"x"}}}}"#
    )
    .into_bytes()
}

fn is_denied(input: Input) -> bool {
    matches!(input, Input::Denied(_))
}

// Every file under .planning that the binary alone writes, and the project
// tree that holds them. Configuration destinations have their own trees.
fn project() -> Tree {
    tree()
        .dir("/p")
        .dir("/p/nested")
        .dir("/p/.planning")
        .dir("/p/.planning/phases")
        .dir("/p/.planning/phases/6")
        .file("/p/.planning/state.json")
        .link("/p/planning-alias", "/p/.planning")
}

// The repo destination under /p and the global one under /g, with a link and
// a second name reaching each.
fn configured() -> Tree {
    tree()
        .dir("/p")
        .dir("/p/.planning")
        .dir("/p/.planning/subdir")
        .file("/p/.planning/config.v4.json")
        .dir("/g")
        .file("/g/config.v4.json")
        .link("/p/alias", "/p/.planning")
        .link("/p/file-alias", "/p/.planning/config.v4.json")
        .hard("/p/hard-link", "/p/.planning/config.v4.json")
        .link("/p/global-alias", "/g")
        .hard("/p/global-file", "/g/config.v4.json")
}

fn global() -> Option<&'static Path> {
    Some(Path::new("/g/config.json"))
}

#[test]
pub(crate) fn rendered_skill_files_are_protected() {
    let root = Path::new("/fixture");
    assert_eq!(cadence::execution::render::RENDERED_PROJECT_FILES.len(), 24);
    for rendered in cadence::execution::render::RENDERED_PROJECT_FILES {
        let relative = rendered.path;
        assert!(
            super::protected_target(&root.join(relative)).unwrap(),
            "{relative} must be protected as a binary-rendered project file"
        );
    }
    assert!(!super::protected_target(&root.join("skills/authored/SKILL.md")).unwrap());
}

#[test]
fn the_cli_names_the_guard_and_serve_subcommands() {
    let command = |word| crate::Cli::try_parse_from(["cadence", word]).unwrap().command;
    assert!(matches!(command("guard"), crate::Command::Guard));
    assert!(matches!(command("serve"), crate::Command::Serve));
}

#[test]
fn a_write_or_edit_input_that_is_not_one_readable_event_is_denied() {
    for bytes in [
        br#"{"tool_name":"Write","cwd":"/p","tool_input":{"file_path":null}}"#.to_vec(),
        br#"{"tool_name":"Write","cwd":1,"tool_input":{"file_path":"x"}}"#.to_vec(),
        br#"{"tool_name":"Edit","cwd":"/","tool_input":{}}"#.to_vec(),
        br#"{"tool_name":"Write","cwd":"/","tool_input":{"file_path":"a","file_path":"b"}}"#
            .to_vec(),
        br#"{"tool_name":"Write","cwd":"/","tool_input":{"file_path":"x"}} {}"#.to_vec(),
        [br#"{"tool_name":"Write","#.as_slice(), &[0xff]].concat(),
    ] {
        assert!(is_denied(input(&bytes)), "{}", String::from_utf8_lossy(&bytes));
    }
}

#[test]
fn a_malformed_input_names_write_or_edit_through_any_whitespace() {
    assert!(is_denied(input(b"{ \"tool_name\" :\n \"Edit\" , oops")));
}

#[test]
fn a_malformed_input_for_any_other_tool_is_silent() {
    for bytes in [
        br#"{"tool_name":"Read", oops"#.as_slice(),
        br#"{"tool_name":"Writer", oops"#,
        b"not json",
    ] {
        assert!(matches!(input(bytes), Input::Silent), "{}", String::from_utf8_lossy(bytes));
    }
}

#[test]
fn a_write_edit_input_is_denied_one_byte_past_the_bound() {
    let fill = MAX_INPUT_BYTES as usize - write_input("").len();
    let at_bound = write_input(&"x".repeat(fill));
    assert_eq!(at_bound.len() as u64, MAX_INPUT_BYTES);
    assert!(matches!(input(&at_bound), Input::WriteEdit(_)));
    assert!(is_denied(input(&write_input(&"x".repeat(fill + 1)))));
}

#[test]
fn an_oversized_input_for_another_tool_is_silent() {
    let mut bytes = br#"{"tool_name":"Bash","tool_input":{"command":""#.to_vec();
    bytes.resize(MAX_INPUT_BYTES as usize + 1, b'x');
    assert!(matches!(input(&bytes), Input::Silent));
}

#[test]
fn a_bash_event_goes_to_the_bash_guard_even_when_it_names_an_owned_file() {
    let bytes = br#"{"tool_name":"Bash","cwd":"/p","tool_input":{"file_path":".planning/state.json"}}"#;
    assert!(matches!(input(bytes), Input::Bash));
}

#[test]
fn other_tools_get_no_answer() {
    for bytes in [
        br#"{"tool_name":"Read","cwd":"/p","tool_input":{"file_path":".planning/state.json"}}"#.as_slice(),
        br#"{"tool_name":"Glob","tool_input":{}}"#,
        br#"{"tool_name":7,"tool_input":{}}"#,
        br#"{"tool_input":{"file_path":".planning/state.json"}}"#,
    ] {
        assert!(matches!(input(bytes), Input::Silent), "{}", String::from_utf8_lossy(bytes));
    }
}

#[test]
fn a_write_edit_event_for_another_hook_is_denied() {
    let hook = |name: &str| {
        format!(r#"{{{name}"tool_name":"Edit","cwd":"/p","tool_input":{{"file_path":"x"}}}}"#).into_bytes()
    };
    assert!(is_denied(input(&hook(r#""hook_event_name":"PostToolUse","#))));
    assert!(matches!(input(&hook(r#""hook_event_name":"PreToolUse","#)), Input::WriteEdit(_)));
    assert!(matches!(input(&hook("")), Input::WriteEdit(_)));
}

#[test]
fn a_cwd_or_target_that_is_empty_or_holds_a_control_byte_is_denied() {
    let fs = tree().dir("/p");
    let cwd = denied("Write/Edit cwd is empty or contains control bytes");
    let target = denied("Write/Edit target is empty or contains control bytes");
    assert_eq!(resolve_target("", "x", &fs), cwd);
    assert_eq!(resolve_target("/p\n", "x", &fs), cwd);
    assert_eq!(resolve_target("/p", "", &fs), target);
    assert_eq!(resolve_target("/p", "bad\0path", &fs), target);
}

#[test]
fn a_relative_cwd_is_denied() {
    assert_eq!(
        resolve_target("p", "x", &tree().dir("p")),
        denied("Write/Edit cwd must be an absolute path")
    );
}

#[test]
fn a_cwd_that_is_not_an_existing_directory_is_denied() {
    assert_eq!(
        resolve_target("/p", "x", &tree().file("/p")),
        denied("Write/Edit cwd is not a directory")
    );
    assert!(resolve_target("/p", "x", &tree())
        .unwrap_err()
        .starts_with("cannot resolve Write/Edit cwd: "));
}

#[test]
fn a_drive_letter_or_double_slash_target_is_denied() {
    let fs = tree().dir("/p");
    for target in ["C:\\ambiguous\\path", "c:x", "//server/share"] {
        assert_eq!(
            resolve_target("/p", target, &fs),
            denied("Write/Edit target uses an ambiguous path prefix"),
            "{target}"
        );
    }
}

#[test]
fn dots_resolve_against_the_spelled_path_when_nothing_is_a_link() {
    let fs = project();
    assert_eq!(
        resolve_target("/p", "./.planning/phases/6/../6/SUMMARY.md", &fs),
        Ok("/p/.planning/phases/6/SUMMARY.md".into())
    );
    assert_eq!(
        resolve_target("/p/nested", "../.planning/state.json", &fs),
        Ok("/p/.planning/state.json".into())
    );
}

#[test]
fn a_linked_name_resolves_to_its_target() {
    let fs = configured();
    assert_eq!(resolve_target("/p", "alias/config.v4.json", &fs), Ok("/p/.planning/config.v4.json".into()));
    assert_eq!(resolve_target("/p", "file-alias", &fs), Ok("/p/.planning/config.v4.json".into()));
    assert_eq!(resolve_target("/p", "alias/new.md", &fs), Ok("/p/.planning/new.md".into()));
}

#[test]
fn a_parent_step_after_a_linked_directory_leaves_the_link_target() {
    let fs = tree()
        .dir("/p")
        .dir("/p/.planning")
        .dir("/p/.planning/subdir")
        .file("/p/config.v4.json")
        .link("/p/jump", "/p/.planning/subdir");
    let expected = Ok("/p/.planning/config.v4.json".into());
    assert_eq!(resolve_target("/p", "jump/../config.v4.json", &fs), expected);
    let fs = fs.file("/p/.planning/config.v4.json");
    assert_eq!(resolve_target("/p", "jump/../config.v4.json", &fs), expected);
}

#[test]
fn a_parent_step_above_the_root_is_denied() {
    let escapes = denied("Write/Edit target escapes the filesystem root");
    assert_eq!(resolve_existing_prefix(Path::new("/.."), &tree()), escapes);
    assert_eq!(resolve_target("/p", "../../x", &tree().dir("/p")), escapes);
}

#[test]
fn a_path_through_a_file_is_denied() {
    let fs = tree().dir("/p").file("/p/notes.md");
    assert_eq!(
        resolve_target("/p", "notes.md/x", &fs),
        denied("Write/Edit target has a non-directory parent")
    );
}

#[test]
fn a_lookup_that_fails_other_than_missing_denies() {
    let fs = |ask| tree().dir("/p").dir("/p/.planning").failing(ask, "/p/.planning");
    for (ask, reason) in [
        (Ask::Metadata, "cannot inspect Write/Edit parent safely: "),
        (Ask::Present, "cannot inspect Write/Edit target safely: "),
        (Ask::Canonicalize, "cannot resolve Write/Edit target: "),
    ] {
        let answer = resolve_target("/p", ".planning/x", &fs(ask)).unwrap_err();
        assert!(answer.starts_with(reason), "{answer}");
    }
}

#[test]
fn the_global_setting_wins_over_home() {
    assert_eq!(
        global_setting(Some("/g/config.json".into()), Some("/home/u".into())),
        Some("/g/config.json".into())
    );
}

#[test]
fn without_a_global_setting_home_names_the_default() {
    assert_eq!(
        global_setting(None, Some("/home/u".into())),
        Some("/home/u/.claude/cadence/config.json".into())
    );
    assert_eq!(global_setting(None, None), None);
}

#[test]
fn an_empty_global_setting_turns_the_global_layer_off() {
    assert_eq!(global_setting(Some(OsString::new()), Some("/home/u".into())), None);
}

#[test]
fn the_destinations_are_the_v4_siblings_of_the_repo_and_global_settings() {
    let fs = tree().dir("/p").dir("/p/.planning").dir("/g");
    assert_eq!(
        config_destinations("/p", global(), &fs),
        Ok(vec!["/p/.planning/config.v4.json".into(), "/g/config.v4.json".into()])
    );
    assert_eq!(config_destinations("/p", None, &fs), Ok(vec!["/p/.planning/config.v4.json".into()]));
}

#[test]
fn a_relative_global_setting_is_taken_from_the_process_directory() {
    let mut fs = tree().dir("/p").dir("/w").dir("/w/x").dir("/w/g");
    fs.process_dir = "/w/x".into();
    assert_eq!(
        config_destinations("/p", Some(Path::new("../g/config.json")), &fs).unwrap()[1],
        Path::new("/w/g/config.v4.json")
    );
}

#[test]
fn a_linked_legacy_setting_moves_its_destination_with_it() {
    let fs = tree()
        .dir("/p")
        .dir("/p/.planning")
        .dir("/g")
        .dir("/u")
        .file("/u/config.json")
        .dir("/v")
        .file("/v/config.json")
        .link("/p/.planning/config.json", "/u/config.json")
        .link("/g/config.json", "/v/config.json");
    assert_eq!(
        config_destinations("/p", global(), &fs),
        Ok(vec!["/u/config.v4.json".into(), "/v/config.v4.json".into()])
    );
}

#[test]
fn a_linked_v4_file_is_its_target() {
    let fs = tree()
        .dir("/p")
        .dir("/p/.planning")
        .dir("/u")
        .file("/u/active")
        .link("/p/.planning/config.v4.json", "/u/active");
    assert_eq!(config_destinations("/p", None, &fs), Ok(vec!["/u/active".into()]));
}

#[test]
fn one_path_is_one_destination_without_any_lookup() {
    let path = Path::new("/p/.planning/config.v4.json");
    assert_eq!(same_destination(path, path, &tree()), Ok(true));
}

#[test]
fn two_names_of_one_file_are_one_destination() {
    let fs = configured().file("/p/other.json");
    let repo = Path::new("/p/.planning/config.v4.json");
    assert_eq!(same_destination(Path::new("/p/hard-link"), repo, &fs), Ok(true));
    assert_eq!(same_destination(Path::new("/p/other.json"), repo, &fs), Ok(false));
}

#[test]
fn a_missing_side_is_never_the_same_destination() {
    let fs = tree().file("/p/present");
    assert_eq!(same_destination(Path::new("/p/present"), Path::new("/p/missing"), &fs), Ok(false));
    assert_eq!(same_destination(Path::new("/p/missing"), Path::new("/p/gone"), &fs), Ok(false));
}

#[test]
fn a_failed_identity_lookup_denies() {
    let fs = tree().file("/p/a").file("/p/b").failing(Ask::Metadata, "/p/a");
    assert!(same_destination(Path::new("/p/a"), Path::new("/p/b"), &fs)
        .unwrap_err()
        .starts_with("cannot inspect config destination safely: "));
}

#[test]
fn the_owned_planning_records_are_protected() {
    for path in [
        "/p/.planning/state.json",
        "/p/.planning/decisions.jsonl",
        "/p/.planning/items.jsonl",
        "/p/.planning/phases/6/SUMMARY.md",
        "/p/.planning/phases/0007/SUMMARY.md",
    ] {
        assert_eq!(protected_target(Path::new(path)), Ok(true), "{path}");
    }
}

#[test]
fn planning_notes_plans_and_source_are_not_protected() {
    for path in [
        "/p/src/lib.rs",
        "/p/state.json",
        "/p/.planning/notes.md",
        "/p/.planning/nested/state.json",
        "/p/.planning/phases/6/PLAN-1.md",
        "/p/.planning/phases/0/SUMMARY.md",
        "/p/.planning/phases/6a/SUMMARY.md",
        "/elsewhere/outside.rs",
    ] {
        assert_eq!(protected_target(Path::new(path)), Ok(false), "{path}");
    }
}

#[test]
fn an_owned_output_is_denied_however_its_path_is_spelled() {
    let fs = project();
    for (cwd, target, path) in [
        ("/p", ".planning/state.json", "/p/.planning/state.json"),
        ("/p", ".planning/phases/0007/SUMMARY.md", "/p/.planning/phases/0007/SUMMARY.md"),
        ("/p", "./.planning/phases/6/../6/SUMMARY.md", "/p/.planning/phases/6/SUMMARY.md"),
        ("/p", ".planning\\state.json", "/p/.planning/state.json"),
        ("/p", "/p/.planning/state.json", "/p/.planning/state.json"),
        ("/p/nested", "../.planning/state.json", "/p/.planning/state.json"),
        ("/p", "planning-alias/state.json", "/p/.planning/state.json"),
    ] {
        assert_eq!(write_edit(&event(cwd, target), None, &fs), owned(path), "{cwd} {target}");
    }
}

#[test]
fn an_unowned_target_is_allowed() {
    let fs = project();
    for target in [
        "src/lib.rs",
        ".planning/notes.md",
        ".planning/phases/6/PLAN-1.md",
        "/elsewhere/outside.rs",
    ] {
        assert_eq!(write_edit(&event("/p", target), None, &fs), Ok(()), "{target}");
    }
}

#[test]
fn a_config_destination_is_denied_however_it_is_reached() {
    let fs = configured();
    for target in [
        ".planning/config.v4.json",
        "/p/.planning/config.v4.json",
        "./.planning/subdir/../config.v4.json",
        ".planning\\config.v4.json",
        "alias/config.v4.json",
        "file-alias",
        "hard-link",
        "/g/config.v4.json",
        "../g/./config.v4.json",
        "..\\g\\config.v4.json",
        "global-alias/config.v4.json",
        "global-file",
    ] {
        assert_eq!(write_edit(&event("/p", target), global(), &fs), Err(CONFIG_DENIAL.into()), "{target}");
    }
}

#[test]
fn a_config_destination_that_does_not_exist_yet_is_denied() {
    let fs = tree()
        .dir("/p")
        .dir("/p/.planning")
        .dir("/g")
        .link("/p/alias", "/p/.planning")
        .link("/p/global-alias", "/g");
    for target in [".planning/config.v4.json", "alias/config.v4.json", "global-alias/config.v4.json"] {
        assert_eq!(write_edit(&event("/p", target), global(), &fs), Err(CONFIG_DENIAL.into()), "{target}");
    }
}

#[test]
fn a_config_name_outside_both_destinations_is_allowed() {
    let fs = configured()
        .dir("/u")
        .file("/u/config.v4.json")
        .dir("/server-project")
        .dir("/server-project/.planning")
        .file("/server-project/.planning/config.v4.json");
    for target in ["../u/config.v4.json", "../server-project/.planning/config.v4.json"] {
        assert_eq!(write_edit(&event("/p", target), global(), &fs), Ok(()), "{target}");
    }
}

#[test]
fn the_native_spelling_is_judged_before_the_backslash_spelling() {
    let fs = configured()
        .dir("/p/raw")
        .file("/p/raw/alias")
        .hard("/p/raw\\alias", "/p/.planning/config.v4.json");
    assert_eq!(write_edit(&event("/p", "raw\\alias"), global(), &fs), Err(CONFIG_DENIAL.into()));
}
