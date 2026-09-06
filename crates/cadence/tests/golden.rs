//! The comparison instrument and its controls; a green test is not a parity claim.

use regex::Regex;
use serde::{Deserialize, Deserializer, de::DeserializeOwned};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

type Result<T> = std::result::Result<T, String>;
type Files = BTreeMap<String, String>;

// Provenance and driver inputs remain typed even before operations are activated.
#[expect(
    dead_code,
    reason = "later port drivers consume the invocation metadata"
)]
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Invocation {
    invocation: String,
    operation: String,
    bundle: String,
    script: String,
    argv: Vec<String>,
    git: bool,
    stdin: Option<String>,
    setup: Option<Value>,
    offline: Option<String>,
    global_config: Option<String>,
    refusal_source: Option<String>,
}

#[expect(
    dead_code,
    reason = "retain recording provenance independently of comparison keys"
)]
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct Recording {
    invocation: String,
    operation: String,
    bundle: String,
    script: String,
    argv: Vec<String>,
    #[serde(deserialize_with = "required_nullable")]
    stdin: Option<String>,
    env: BTreeMap<String, String>,
    node: String,
    exit: i32,
    #[serde(deserialize_with = "required_nullable")]
    stdout: Option<Value>,
    stderr: String,
    files: Files,
    deleted: Vec<String>,
}

fn required_nullable<'de, D, T>(deserializer: D) -> std::result::Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::deserialize(deserializer)
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RuleFile {
    mechanism: String,
    rules: Vec<RuleSpec>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RuleSpec {
    id: String,
    target: String,
    path_suffix: Option<String>,
    key: Option<String>,
    pattern: String,
    replace: String,
    site: String,
}

#[derive(Debug)]
enum Target {
    File(String),
    Stdout(String),
}

#[derive(Debug)]
struct Rule {
    target: Target,
    pattern: Regex,
    replace: String,
}

#[derive(Debug)]
struct Golden {
    invocations: Vec<Invocation>,
    // Keyed by filename, so duplicate payload ids cannot conceal an extra file.
    recordings: BTreeMap<String, Recording>,
    rules: Vec<Rule>,
}

fn golden_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/golden")
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("{}: {e}", path.display()))
}

fn load(root: &Path) -> Result<Golden> {
    let invocations = read_json(&root.join("operations.json"))?;
    let mut recordings = BTreeMap::new();
    let directory = root.join("recordings");
    for entry in fs::read_dir(&directory).map_err(|e| format!("{}: {e}", directory.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let recording: Recording = read_json(&path)?;
        if recording.node.is_empty()
            || !recording.node.bytes().all(|b| b.is_ascii_digit())
            || recording.stdout.as_ref().is_some_and(|v| !v.is_object())
            || recording.invocation.is_empty()
            || recording.operation.is_empty()
        {
            return Err(format!("{}: invalid recording contract", path.display()));
        }
        recordings.insert(
            path.file_name().unwrap().to_string_lossy().into_owned(),
            recording,
        );
    }
    let path = root.join("normalization.json");
    let rule_file: RuleFile = read_json(&path)?;
    if rule_file.mechanism != "named-fields" {
        return Err(format!("{}: unknown mechanism", path.display()));
    }
    let rules = rule_file
        .rules
        .into_iter()
        .map(|spec| {
            let error = |message: &str| format!("{}: rule {}: {message}", path.display(), spec.id);
            let target = match spec.target.as_str() {
                "file" => Target::File(
                    spec.path_suffix
                        .filter(|s| !s.is_empty())
                        .ok_or_else(|| error("missing path_suffix"))?,
                ),
                "stdout" => Target::Stdout(
                    spec.key
                        .filter(|s| !s.is_empty())
                        .ok_or_else(|| error("missing key"))?,
                ),
                _ => return Err(error("invalid target")),
            };
            if spec.replace.contains('$') {
                return Err(error("replacement must be literal and contain no $"));
            }
            if spec.site.is_empty() {
                return Err(error("missing source site"));
            }
            let pattern = Regex::new(&spec.pattern).map_err(|e| error(&e.to_string()))?;
            Ok(Rule {
                target,
                pattern,
                replace: spec.replace,
            })
        })
        .collect::<Result<_>>()?;
    Ok(Golden {
        invocations,
        recordings,
        rules,
    })
}

fn copy_tree(source: &Path, destination: &Path) -> Result<()> {
    fs::create_dir_all(destination).map_err(|e| format!("{}: {e}", destination.display()))?;
    for entry in fs::read_dir(source).map_err(|e| format!("{}: {e}", source.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let target = destination.join(entry.file_name());
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), target).map_err(|e| e.to_string())?;
        } else {
            return Err(format!(
                "{}: expected regular file or directory",
                entry.path().display()
            ));
        }
    }
    Ok(())
}

fn scratch_goldens() -> TempDir {
    let scratch = tempfile::tempdir().unwrap();
    copy_tree(&golden_root(), scratch.path()).unwrap();
    scratch
}

#[test]
fn loads_committed_recordings_manifest_and_rules() {
    let golden = load(&golden_root()).unwrap();
    println!(
        "recordings={} invocations={} rules={}",
        golden.recordings.len(),
        golden.invocations.len(),
        golden.rules.len()
    );
    assert!(!golden.recordings.is_empty());
    assert_eq!(golden.recordings.len(), golden.invocations.len());
}

#[test]
fn corrupt_recording_names_its_file() {
    let scratch = scratch_goldens();
    let path = scratch.path().join("recordings/replay-check-slice.json");
    let bytes = fs::read(&path).unwrap();
    fs::write(&path, &bytes[..bytes.len() / 2]).unwrap();
    assert!(
        load(scratch.path())
            .unwrap_err()
            .contains("replay-check-slice.json")
    );
}

#[test]
fn malformed_rule_names_file_and_rule() {
    let scratch = scratch_goldens();
    let path = scratch.path().join("normalization.json");
    let mut rules: Value = read_json(&path).unwrap();
    let id = rules["rules"][0]["id"].as_str().unwrap().to_owned();
    rules["rules"][0]["target"] = Value::from("flie");
    fs::write(path, serde_json::to_vec(&rules).unwrap()).unwrap();
    let error = load(scratch.path()).unwrap_err();
    assert!(
        error.contains("normalization.json") && error.contains(&id),
        "{error}"
    );
}

fn materialize(root: &Path, bundle: &str) -> Result<TempDir> {
    let source = root.join("fixtures").join(bundle);
    if Path::new(bundle).components().count() != 1
        || !matches!(
            Path::new(bundle).components().next(),
            Some(std::path::Component::Normal(_))
        )
        || !source.is_dir()
    {
        return Err(format!("bundle {bundle}: no fixture directory"));
    }
    let scratch = tempfile::tempdir().map_err(|e| format!("bundle {bundle}: {e}"))?;
    copy_tree(&source, scratch.path())?;
    Ok(scratch)
}

fn tree_bytes(root: &Path) -> Result<BTreeMap<String, Vec<u8>>> {
    fn walk(root: &Path, directory: &Path, files: &mut BTreeMap<String, Vec<u8>>) -> Result<()> {
        for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_dir() {
                walk(root, &path, files)?;
            } else if kind.is_file() {
                let name = path
                    .strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                files.insert(
                    name,
                    fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?,
                );
            } else {
                return Err(format!(
                    "{}: expected regular file or directory",
                    path.display()
                ));
            }
        }
        Ok(())
    }
    let mut files = BTreeMap::new();
    walk(root, root, &mut files)?;
    Ok(files)
}

#[test]
fn every_manifest_bundle_materializes_intact() {
    let root = golden_root();
    let golden = load(&root).unwrap();
    let bundles: std::collections::BTreeSet<_> =
        golden.invocations.iter().map(|i| &i.bundle).collect();
    for bundle in &bundles {
        let scratch = materialize(&root, bundle).unwrap();
        let expected = tree_bytes(&root.join("fixtures").join(bundle)).unwrap();
        let actual = tree_bytes(scratch.path()).unwrap();
        assert_eq!(
            actual.keys().collect::<Vec<_>>(),
            expected.keys().collect::<Vec<_>>(),
            "bundle {bundle}"
        );
        for (path, bytes) in expected {
            assert_eq!(actual[&path], bytes, "bundle {bundle}: {path}");
        }
    }
    println!("bundles_materialized={}", bundles.len());
}

#[test]
fn nonexistent_bundle_names_the_bundle() {
    let error = materialize(&golden_root(), "missing-bundle").unwrap_err();
    assert!(error.contains("missing-bundle"), "{error}");
}

#[derive(Debug, Clone)]
enum Projection {
    Keys(Vec<String>),
    FilesOnly,
    // git-guard's null success uses files-only; its object answer has this key.
    HookDecision(String),
}

type Projections = BTreeMap<String, Projection>;

fn keys(paths: &[&str]) -> Projection {
    Projection::Keys(paths.iter().map(|p| (*p).to_owned()).collect())
}

fn validate_projections(table: &Projections) -> Result<()> {
    for (operation, projection) in table {
        let invalid = match projection {
            Projection::Keys(keys) => keys.is_empty() || keys.iter().any(|k| k.is_empty()),
            Projection::HookDecision(key) => key.is_empty(),
            Projection::FilesOnly => false,
        };
        if invalid {
            return Err(format!("{operation}: empty projection"));
        }
    }
    Ok(())
}

fn projections() -> Result<Projections> {
    let table = BTreeMap::from([
        ("replay-check".into(), keys(&["replay", "dispatch_set"])),
        (
            "plan-overlap".into(),
            keys(&["overlaps", "frontmatter_issues"]),
        ),
        // A wildcard projects each array element, preserving phase order.
        ("status".into(), keys(&["phases.*.status", "cursor.agrees"])),
        ("worktree-base resolve".into(), keys(&["parallelSafe"])),
        ("trace append".into(), keys(&["written", "corr"])),
        (
            "cursor set".into(),
            keys(&["cursor.status", "cursor.updated"]),
        ),
        ("capture".into(), keys(&["file"])),
        ("read-trace".into(), Projection::FilesOnly),
        ("subagent-trace".into(), Projection::FilesOnly),
        (
            "git-guard".into(),
            Projection::HookDecision("hookSpecificOutput.permissionDecision".into()),
        ),
    ]);
    validate_projections(&table)?;
    Ok(table)
}

#[derive(Debug, Clone)]
struct Answer {
    stdout: Option<Value>,
    files: Files,
    deleted: Vec<String>,
}

// Every control adapts the recorded JavaScript envelope through this one seam.
// In particular, ok:true is NOT a Rust success until status:"ok" is present.
fn recorded_answer(recording: &Recording) -> Answer {
    let stdout = recording.stdout.clone().map(|mut value| {
        let object = value.as_object_mut().unwrap();
        match object.remove("ok") {
            Some(Value::Bool(true)) => {
                object.insert("status".into(), Value::from("ok"));
            }
            Some(Value::Bool(false)) => {
                let code = object
                    .remove("reason")
                    .expect("recorded refusal has a reason");
                object.insert("status".into(), Value::from("refused"));
                object.insert("code".into(), code);
                object.insert(
                    "reason".into(),
                    Value::from("recorded refusal for a comparison control"),
                );
            }
            None => {}
            _ => panic!("unexpected recorded ok shape"),
        }
        value
    });
    Answer {
        stdout,
        files: recording.files.clone(),
        deleted: recording.deleted.clone(),
    }
}

fn tree_text(root: &Path) -> Result<Files> {
    tree_bytes(root)?
        .into_iter()
        .map(|(path, bytes)| {
            String::from_utf8(bytes)
                .map(|text| (path.clone(), text))
                .map_err(|e| format!("{path}: {e}"))
        })
        .collect()
}

struct Roots<'a> {
    fixture: &'a str,
    repo: &'a str,
}

impl Roots<'_> {
    fn substitute(&self, text: &str) -> String {
        text.replace(self.fixture, "<FIXTURE>")
            .replace(self.repo, "<REPO>")
    }
}

fn map_strings(value: &mut Value, transform: &impl Fn(&str) -> String) {
    match value {
        Value::String(text) => *text = transform(text),
        Value::Array(values) => values.iter_mut().for_each(|v| map_strings(v, transform)),
        Value::Object(object) => {
            *object = std::mem::take(object)
                .into_iter()
                .map(|(key, mut value)| {
                    map_strings(&mut value, transform);
                    (transform(&key), value)
                })
                .collect();
        }
        _ => {}
    }
}

fn at_mut<'a>(value: &'a mut Value, path: &str) -> Option<&'a mut Value> {
    let mut current = value;
    for segment in path.split('.') {
        current = current.as_object_mut()?.get_mut(segment)?;
    }
    Some(current)
}

fn normalize(mut answer: Answer, before: &Files, roots: &Roots<'_>, rules: &[Rule]) -> Answer {
    if let Some(stdout) = &mut answer.stdout {
        map_strings(stdout, &|text| roots.substitute(text));
    }
    answer.files = answer
        .files
        .into_iter()
        .map(|(path, text)| (roots.substitute(&path), roots.substitute(&text)))
        .collect();
    answer.deleted = answer
        .deleted
        .into_iter()
        .map(|path| roots.substitute(&path))
        .collect();
    // Match record.mjs: the skip set is the union of normalized pre-run lines
    // across the whole tree, including a line subsequently moved to a new path.
    let before: Vec<_> = before.values().map(|text| roots.substitute(text)).collect();
    let seeded: BTreeSet<_> = before.iter().flat_map(|text| text.split('\n')).collect();
    for rule in rules {
        match &rule.target {
            Target::Stdout(key) => {
                if let Some(Value::String(text)) =
                    answer.stdout.as_mut().and_then(|v| at_mut(v, key))
                {
                    *text = rule
                        .pattern
                        .replace_all(text, regex::NoExpand(&rule.replace))
                        .into_owned();
                }
            }
            Target::File(suffix) => {
                for (path, text) in &mut answer.files {
                    if path.ends_with(suffix) {
                        *text = text
                            .split('\n')
                            .map(|line| {
                                if seeded.contains(line) {
                                    line.to_owned()
                                } else {
                                    rule.pattern
                                        .replace_all(line, regex::NoExpand(&rule.replace))
                                        .into_owned()
                                }
                            })
                            .collect::<Vec<_>>()
                            .join("\n");
                    }
                }
            }
        }
    }
    answer
}

// Rebuild nested maps too: preserve_order must not make insertion order a diff.
fn canonical(value: &Value) -> Value {
    match value {
        Value::Object(object) => {
            let ordered: BTreeMap<_, _> = object.iter().collect();
            Value::Object(
                ordered
                    .into_iter()
                    .map(|(k, v)| (k.clone(), canonical(v)))
                    .collect(),
            )
        }
        Value::Array(values) => Value::Array(values.iter().map(canonical).collect()),
        _ => value.clone(),
    }
}

fn projected(value: Option<&Value>, path: &[&str]) -> Option<Value> {
    let value = value?;
    let Some((head, tail)) = path.split_first() else {
        return Some(canonical(value));
    };
    if *head == "*" {
        value.as_array().map(|values| {
            Value::Array(
                values
                    .iter()
                    .map(|v| present(projected(Some(v), tail)))
                    .collect(),
            )
        })
    } else {
        projected(value.as_object()?.get(*head), tail)
    }
}

// Missing is different from a present null, including inside wildcard arrays.
fn present(value: Option<Value>) -> Value {
    match value {
        Some(value) => serde_json::json!({"present": true, "value": value}),
        None => serde_json::json!({"present": false}),
    }
}

#[derive(Debug)]
struct Comparison {
    expected: Value,
    actual: Value,
    differing: Vec<String>,
}

impl Comparison {
    fn new() -> Self {
        Self {
            expected: serde_json::json!({}),
            actual: serde_json::json!({}),
            differing: Vec::new(),
        }
    }

    fn field(&mut self, name: &str, expected: Option<Value>, actual: Option<Value>) {
        if expected != actual {
            self.differing.push(name.to_owned());
        }
        for (object, value) in [(&mut self.expected, expected), (&mut self.actual, actual)] {
            let object = object.as_object_mut().unwrap();
            object.insert(format!("{name}.present"), Value::Bool(value.is_some()));
            object.insert(name.into(), value.unwrap_or(Value::Null));
        }
    }

    fn texts(&self) -> (String, String) {
        (
            serde_json::to_string_pretty(&self.expected).unwrap(),
            serde_json::to_string_pretty(&self.actual).unwrap(),
        )
    }

    fn assert_matches(&self, invocation: &str) {
        if !self.differing.is_empty() {
            self.render_mismatch(invocation);
        }
    }

    fn render_mismatch(&self, invocation: &str) -> ! {
        let scratch = tempfile::tempdir().unwrap();
        let (expected, actual) = self.texts();
        fs::write(
            scratch.path().join(format!("{invocation}.snap")),
            format!("---\nsource: golden.rs\n---\n{expected}\n"),
        )
        .unwrap();
        fs::write(scratch.path().join("actual.txt"), actual).unwrap();
        // insta's update/force-pass controls are process-wide, not Settings.
        // An isolated worker pins them without unsafe environment mutation in
        // the multithreaded test process, and contains all snapshot artifacts.
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "snapshot_worker", "--nocapture"])
            .env_clear()
            .env("INSTA_UPDATE", "no")
            .env("INSTA_FORCE_PASS", "0")
            .env("INSTA_OUTPUT", "diff")
            .env("INSTA_WORKSPACE_ROOT", env!("CARGO_MANIFEST_DIR"))
            .env("GOLDEN_SNAPSHOT_DIR", scratch.path())
            .env("GOLDEN_INVOCATION", invocation)
            .stdin(std::process::Stdio::null())
            .output()
            .unwrap();
        print!("{}", String::from_utf8_lossy(&output.stdout));
        eprint!("{}", String::from_utf8_lossy(&output.stderr));
        assert!(
            !output.status.success(),
            "insta worker accepted a known mismatch"
        );
        assert!(
            String::from_utf8_lossy(&output.stderr).contains("snapshot assertion for"),
            "insta worker failed before its assertion"
        );
        panic!(
            "golden mismatch: {} ({invocation})",
            self.differing.join(", ")
        );
    }
}

#[test]
fn snapshot_worker() {
    let Some(directory) = std::env::var_os("GOLDEN_SNAPSHOT_DIR") else {
        return;
    };
    let directory = PathBuf::from(directory);
    let name = std::env::var("GOLDEN_INVOCATION").unwrap();
    let actual = fs::read_to_string(directory.join("actual.txt")).unwrap();
    let mut settings = insta::Settings::new();
    settings.set_snapshot_path(&directory);
    settings.set_prepend_module_to_snapshot(false);
    settings.bind(|| insta::assert_snapshot!(name, actual));
}

fn compare(
    recording: &Recording,
    answer: Answer,
    before: &Files,
    roots: &Roots<'_>,
    rules: &[Rule],
    table: &Projections,
) -> Result<Comparison> {
    validate_projections(table)?;
    let projection = table
        .get(&recording.operation)
        .ok_or_else(|| format!("{}: no projection", recording.operation))?;
    let answer = normalize(answer, before, roots, rules);
    let mut comparison = Comparison::new();
    let expected = recording.stdout.as_ref();
    let actual = answer.stdout.as_ref();
    match expected {
        None if matches!(
            projection,
            Projection::FilesOnly | Projection::HookDecision(_)
        ) => {}
        Some(value) if value.get("ok") == Some(&Value::Bool(true)) => {
            let Projection::Keys(keys) = projection else {
                return Err(format!("{}: success requires keys", recording.operation));
            };
            comparison.field(
                "status",
                Some(Value::from("ok")),
                actual.and_then(|v| v.get("status")).cloned(),
            );
            for key in keys {
                let path: Vec<_> = key.split('.').collect();
                comparison.field(key, projected(expected, &path), projected(actual, &path));
            }
        }
        Some(value) if value.get("ok") == Some(&Value::Bool(false)) => {
            let code = value
                .get("reason")
                .filter(|v| v.is_string())
                .ok_or_else(|| format!("{}: refusal lacks machine reason", recording.invocation))?;
            let status = actual.and_then(|v| v.get("status"));
            let valid = status
                .and_then(Value::as_str)
                .is_some_and(|s| matches!(s, "refused" | "unknown" | "not-applicable"));
            // Canonicalize the three permitted tags to a single verdict class.
            comparison.field(
                "status",
                Some(Value::from("non-ok")),
                if valid {
                    Some(Value::from("non-ok"))
                } else {
                    status.cloned()
                },
            );
            comparison.field(
                "code",
                Some(code.clone()),
                actual.and_then(|v| v.get("code")).cloned(),
            );
        }
        Some(value) if value.is_object() && value.get("ok").is_none() => {
            let Projection::HookDecision(key) = projection else {
                return Err(format!(
                    "{}: hook requires decision projection",
                    recording.operation
                ));
            };
            let path: Vec<_> = key.split('.').collect();
            let decision = projected(expected, &path)
                .ok_or_else(|| format!("{}: missing {key}", recording.invocation))?;
            comparison.field(key, Some(decision), projected(actual, &path));
        }
        _ => {
            return Err(format!(
                "{}: unsupported recording shape",
                recording.invocation
            ));
        }
    }
    let paths: BTreeSet<_> = recording.files.keys().chain(answer.files.keys()).collect();
    for path in paths {
        comparison.field(
            &format!("files[{path}]"),
            recording.files.get(path).map(|v| Value::from(v.as_str())),
            answer.files.get(path).map(|v| Value::from(v.as_str())),
        );
    }
    comparison.field(
        "deleted",
        Some(serde_json::to_value(&recording.deleted).unwrap()),
        Some(serde_json::to_value(&answer.deleted).unwrap()),
    );
    Ok(comparison)
}

fn control(golden: &Golden, id: &str, answer: Answer) -> Comparison {
    let recording = &golden.recordings[&format!("{id}.json")];
    let before = tree_text(&golden_root().join("fixtures").join(&recording.bundle)).unwrap();
    compare(
        recording,
        answer,
        &before,
        &Roots {
            fixture: "<FIXTURE>",
            repo: "<REPO>",
        },
        &golden.rules,
        &projections().unwrap(),
    )
    .unwrap()
}

#[test]
fn replay_control_accepts_own_answer_and_names_flipped_key() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["replay-check-slice.json"];
    let mut answer = recorded_answer(recording);
    control(&golden, "replay-check-slice", answer.clone()).assert_matches(&recording.invocation);
    answer.stdout.as_mut().unwrap()["replay"] = Value::Bool(false);
    assert_eq!(
        control(&golden, "replay-check-slice", answer).differing,
        ["replay"]
    );
    let mut raw = recorded_answer(recording);
    raw.stdout = recording.stdout.clone();
    assert_eq!(
        control(&golden, "replay-check-slice", raw).differing,
        ["status"]
    );
}

#[test]
fn refusal_control_compares_machine_code_for_each_non_ok_arm() {
    let golden = load(&golden_root()).unwrap();
    let recording = golden
        .recordings
        .values()
        .find(|r| {
            r.operation == "replay-check" && r.stdout.as_ref().is_some_and(|v| v["ok"] == false)
        })
        .unwrap();
    for status in ["refused", "unknown", "not-applicable"] {
        let mut answer = recorded_answer(recording);
        answer.stdout.as_mut().unwrap()["status"] = Value::from(status);
        control(&golden, &recording.invocation, answer.clone())
            .assert_matches(&recording.invocation);
        answer.stdout.as_mut().unwrap()["code"] = Value::from("different-code");
        assert_eq!(
            control(&golden, &recording.invocation, answer).differing,
            ["code"]
        );
    }
}

#[test]
fn trace_control_normalizes_only_new_fields_and_rejects_restamped_seed() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["trace-append-ok.json"];
    let path = ".planning/trace.jsonl";
    let mut answer = recorded_answer(recording);
    assert!(answer.files[path].contains("<NOW>"));
    answer
        .files
        .get_mut(path)
        .unwrap()
        .clone_from(&recording.files[path].replace("<NOW>", "2030-01-02T03:04:05.006Z"));
    control(&golden, &recording.invocation, answer.clone()).assert_matches(&recording.invocation);
    let mut wrong = answer.clone();
    *wrong.files.get_mut(path).unwrap() = wrong.files[path].replace("phase_start", "phase_stArt");
    assert_eq!(
        control(&golden, &recording.invocation, wrong).differing,
        [format!("files[{path}]")]
    );
    let first_line: Value =
        serde_json::from_str(answer.files[path].lines().next().unwrap()).unwrap();
    let seeded_ts = first_line["ts"].as_str().unwrap();
    *answer.files.get_mut(path).unwrap() =
        answer.files[path].replacen(seeded_ts, "2031-01-02T03:04:05.006Z", 1);
    let comparison = control(&golden, &recording.invocation, answer);
    assert_eq!(comparison.differing, [format!("files[{path}]")]);
    // Changed seed is no longer verbatim: normalization produces <NOW>, which
    // disagrees with the recording's original literal instant.
    assert!(
        comparison.actual[format!("files[{path}]")]
            .as_str()
            .unwrap()
            .lines()
            .next()
            .unwrap()
            .contains("<NOW>")
    );
}

#[test]
fn cursor_control_normalizes_real_day_in_stdout_and_file() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["cursor-set-ok.json"];
    let mut answer = recorded_answer(recording);
    answer.stdout.as_mut().unwrap()["cursor"]["updated"] = Value::from("2030-01-02");
    for text in answer.files.values_mut() {
        *text = text.replace("<TODAY>", "2030-01-02");
    }
    control(&golden, &recording.invocation, answer).assert_matches(&recording.invocation);
}

#[test]
fn stdout_root_control_requires_substitution() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["capture-ok.json"];
    let scratch = tempfile::tempdir().unwrap();
    let live = scratch.path().to_str().unwrap();
    let mut answer = recorded_answer(recording);
    assert!(
        answer.stdout.as_ref().unwrap()["file"]
            .as_str()
            .unwrap()
            .contains("<FIXTURE>")
    );
    map_strings(answer.stdout.as_mut().unwrap(), &|text| {
        text.replace("<FIXTURE>", live)
    });
    let before = tree_text(&golden_root().join("fixtures").join(&recording.bundle)).unwrap();
    compare(
        recording,
        answer.clone(),
        &before,
        &Roots {
            fixture: live,
            repo: "<REPO>",
        },
        &golden.rules,
        &projections().unwrap(),
    )
    .unwrap()
    .assert_matches(&recording.invocation);
    // Identity roots deliberately skip substitution. This proves presence;
    // committed roots and clock rules do not intersect, so it does not prove order.
    assert_eq!(
        control(&golden, &recording.invocation, answer).differing,
        ["file"]
    );
}

#[test]
fn files_only_control_names_changed_file_and_deleted_list() {
    let golden = load(&golden_root()).unwrap();
    for id in ["read-trace-ok", "subagent-trace-ok", "git-guard-ok"] {
        let recording = &golden.recordings[&format!("{id}.json")];
        assert!(recording.stdout.is_none());
        let answer = recorded_answer(recording);
        control(&golden, id, answer.clone()).assert_matches(id);
        if let Some(path) = answer.files.keys().next().cloned() {
            let mut wrong = answer.clone();
            wrong.files.get_mut(&path).unwrap().push('x');
            assert_eq!(
                control(&golden, id, wrong).differing,
                [format!("files[{path}]")]
            );
        }
        let mut wrong = answer;
        wrong.deleted.push("unexpected.txt".into());
        assert_eq!(control(&golden, id, wrong).differing, ["deleted"]);
    }
}

#[test]
fn hook_decision_control_rejects_allow() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["git-guard-refused.json"];
    let mut answer = recorded_answer(recording);
    control(&golden, &recording.invocation, answer.clone()).assert_matches(&recording.invocation);
    answer.stdout.as_mut().unwrap()["hookSpecificOutput"]["permissionDecision"] =
        Value::from("allow");
    assert_eq!(
        control(&golden, &recording.invocation, answer).differing,
        ["hookSpecificOutput.permissionDecision"]
    );
}

#[test]
fn empty_projection_fails_at_build_by_operation() {
    let mut table = projections().unwrap();
    table.insert("replay-check".into(), keys(&[]));
    assert!(
        validate_projections(&table)
            .unwrap_err()
            .contains("replay-check")
    );
}

#[test]
#[should_panic(expected = "golden mismatch: replay")]
fn flipped_replay_renders_insta_diff() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["replay-check-slice.json"];
    let mut answer = recorded_answer(recording);
    answer.stdout.as_mut().unwrap()["replay"] = Value::Bool(false);
    control(&golden, &recording.invocation, answer).assert_matches(&recording.invocation);
}

#[test]
fn nested_insertion_order_does_not_create_a_diff() {
    fn reverse(value: &mut Value) {
        match value {
            Value::Object(object) => {
                let entries: Vec<_> = std::mem::take(object).into_iter().collect();
                for (key, mut value) in entries.into_iter().rev() {
                    reverse(&mut value);
                    object.insert(key, value);
                }
            }
            Value::Array(values) => values.iter_mut().for_each(reverse),
            _ => {}
        }
    }
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["plan-overlap-malformed.json"];
    let mut answer = recorded_answer(recording);
    reverse(answer.stdout.as_mut().unwrap());
    let comparison = control(&golden, &recording.invocation, answer);
    comparison.assert_matches(&recording.invocation);
    let (expected, actual) = comparison.texts();
    assert_eq!(expected, actual);
}

#[test]
fn normalization_preserves_moved_seed_lines_tree_wide() {
    let golden = load(&golden_root()).unwrap();
    let recording = &golden.recordings["milestone-prune-ok.json"];
    let before = tree_text(&golden_root().join("fixtures").join(&recording.bundle)).unwrap();
    let answer = recorded_answer(recording);
    let normalized = normalize(
        answer.clone(),
        &before,
        &Roots {
            fixture: "<FIXTURE>",
            repo: "<REPO>",
        },
        &golden.rules,
    );
    let moved: Vec<_> = answer
        .files
        .keys()
        .filter(|p| p.ends_with("UAT.md") && !before.contains_key(*p))
        .collect();
    assert!(!moved.is_empty(), "control must contain a moved UAT");
    for path in moved {
        assert_eq!(normalized.files[path], answer.files[path]);
        assert!(
            answer.files[path]
                .lines()
                .any(|line| line.starts_with("started: ") && !line.contains("<TODAY>"))
        );
    }
}

// Port phases add operation drivers here. A driver receives the writable bundle
// and invocation, then collects the binary's serialized answer and mutations.
type Driver = fn(&Path, &Invocation) -> Result<Answer>;
type Activations = BTreeMap<String, Driver>;

fn activations() -> Activations {
    BTreeMap::new()
}

#[derive(Debug)]
struct Accounting {
    compared: Vec<String>,
    pending: Vec<String>,
    pending_operations: BTreeSet<String>,
}

fn walk(root: &Path, table: &Projections, active: &Activations) -> Result<Accounting> {
    let golden = load(root)?;
    validate_projections(table)?;
    let mut expected_names = BTreeSet::new();
    let mut operations = BTreeSet::new();
    for invocation in &golden.invocations {
        if !expected_names.insert(format!("{}.json", invocation.invocation)) {
            return Err(format!(
                "operations.json: duplicate invocation {}",
                invocation.invocation
            ));
        }
        operations.insert(invocation.operation.as_str());
    }
    for name in &expected_names {
        if !golden.recordings.contains_key(name) {
            return Err(format!(
                "{}: missing recording",
                root.join("recordings").join(name).display()
            ));
        }
    }
    for name in golden.recordings.keys() {
        if !expected_names.contains(name) {
            return Err(format!(
                "{}: extra recording without manifest entry",
                root.join("recordings").join(name).display()
            ));
        }
    }
    // Check every binding before any driver runs, including pending operations.
    // argv is retained as provenance, not compared here: the recorder resolves
    // manifest <BASE>/<HEAD> placeholders to fixture commit ids.
    for invocation in &golden.invocations {
        let name = format!("{}.json", invocation.invocation);
        let recording = &golden.recordings[&name];
        if recording.invocation != invocation.invocation
            || recording.operation != invocation.operation
            || recording.bundle != invocation.bundle
            || recording.script != invocation.script
            || recording.stdin != invocation.stdin
        {
            return Err(format!(
                "{name}: recording metadata disagrees with operations.json"
            ));
        }
    }
    for operation in active.keys() {
        if !operations.contains(operation.as_str()) {
            return Err(format!(
                "{operation}: activation names an unrecorded operation"
            ));
        }
        if !table.contains_key(operation) {
            return Err(format!("{operation}: activation has no projection"));
        }
    }
    let mut accounting = Accounting {
        compared: Vec::new(),
        pending: Vec::new(),
        pending_operations: BTreeSet::new(),
    };
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap();
    for invocation in &golden.invocations {
        let Some(driver) = active.get(&invocation.operation) else {
            accounting.pending.push(invocation.invocation.clone());
            accounting
                .pending_operations
                .insert(invocation.operation.clone());
            continue;
        };
        let scratch = materialize(root, &invocation.bundle)?;
        let before = tree_text(scratch.path())?;
        let answer = driver(scratch.path(), invocation)
            .map_err(|e| format!("{}: {e}", invocation.invocation))?;
        let roots = Roots {
            fixture: scratch.path().to_str().unwrap(),
            repo: repo.to_str().unwrap(),
        };
        let recording = &golden.recordings[&format!("{}.json", invocation.invocation)];
        compare(recording, answer, &before, &roots, &golden.rules, table)?
            .assert_matches(&invocation.invocation);
        accounting.compared.push(invocation.invocation.clone());
    }
    assert_eq!(
        accounting.compared.len() + accounting.pending.len(),
        golden.recordings.len()
    );
    Ok(accounting)
}

#[test]
fn every_recording_is_compared_or_pending() {
    let accounting = walk(&golden_root(), &projections().unwrap(), &activations()).unwrap();
    println!(
        "compared={} pending={}",
        accounting.compared.len(),
        accounting.pending.len()
    );
    println!(
        "pending operations: {}",
        accounting
            .pending_operations
            .into_iter()
            .collect::<Vec<_>>()
            .join(", ")
    );
}

#[test]
fn missing_recording_fails_walk_by_invocation() {
    let scratch = scratch_goldens();
    fs::remove_file(scratch.path().join("recordings/replay-check-slice.json")).unwrap();
    let error = walk(scratch.path(), &projections().unwrap(), &activations()).unwrap_err();
    assert!(error.contains("replay-check-slice.json"), "{error}");
}

#[test]
fn extra_recording_fails_walk_by_file() {
    let scratch = scratch_goldens();
    fs::copy(
        scratch.path().join("recordings/replay-check-slice.json"),
        scratch.path().join("recordings/extra-recording.json"),
    )
    .unwrap();
    let error = walk(scratch.path(), &projections().unwrap(), &activations()).unwrap_err();
    assert!(error.contains("extra-recording.json"), "{error}");
}

// A control driver only: it never enters the real activation table.
fn recorded_driver(bundle: &Path, invocation: &Invocation) -> Result<Answer> {
    if tree_bytes(bundle)? != tree_bytes(&golden_root().join("fixtures").join(&invocation.bundle))?
    {
        return Err("driver did not receive the intact bundle".into());
    }
    let recording = read_json(
        &golden_root()
            .join("recordings")
            .join(format!("{}.json", invocation.invocation)),
    )?;
    Ok(recorded_answer(&recording))
}

#[test]
fn unrecorded_activation_fails_walk_by_operation() {
    let mut active = activations();
    active.insert("unrecorded-operation".into(), recorded_driver);
    let error = walk(&golden_root(), &projections().unwrap(), &active).unwrap_err();
    assert!(error.contains("unrecorded-operation"), "{error}");
}

#[test]
fn empty_activated_projection_fails_walk_before_driver() {
    let mut active = activations();
    active.insert("replay-check".into(), recorded_driver);
    let mut table = projections().unwrap();
    table.insert("replay-check".into(), keys(&[]));
    let error = walk(&golden_root(), &table, &active).unwrap_err();
    assert!(
        error.contains("replay-check") && error.contains("empty projection"),
        "{error}"
    );
}

#[test]
fn absent_activated_projection_fails_walk_by_operation() {
    let mut active = activations();
    active.insert("replay-check".into(), recorded_driver);
    let mut table = projections().unwrap();
    table.remove("replay-check");
    let error = walk(&golden_root(), &table, &active).unwrap_err();
    assert!(
        error.contains("replay-check") && error.contains("no projection"),
        "{error}"
    );
}

#[test]
fn control_driver_accounts_for_each_activated_invocation() {
    let golden = load(&golden_root()).unwrap();
    let expected: BTreeSet<_> = golden
        .invocations
        .iter()
        .filter(|i| i.operation == "replay-check")
        .map(|i| i.invocation.clone())
        .collect();
    assert!(!expected.is_empty());
    let mut active = activations();
    active.insert("replay-check".into(), recorded_driver);
    let accounting = walk(&golden_root(), &projections().unwrap(), &active).unwrap();
    assert_eq!(
        accounting.compared.into_iter().collect::<BTreeSet<_>>(),
        expected
    );
    assert_eq!(
        accounting.pending.len(),
        golden.recordings.len() - expected.len()
    );
}

fn wrong_replay_driver(bundle: &Path, invocation: &Invocation) -> Result<Answer> {
    let mut answer = recorded_driver(bundle, invocation)?;
    if let Some(stdout) = &mut answer.stdout
        && stdout["status"] == "ok"
    {
        let original = stdout["replay"].as_bool().unwrap();
        stdout["replay"] = Value::Bool(!original);
    }
    Ok(answer)
}

#[test]
#[should_panic(expected = "golden mismatch: replay")]
fn wrong_control_driver_fails_the_walk_through_insta() {
    let mut active = activations();
    active.insert("replay-check".into(), wrong_replay_driver);
    walk(&golden_root(), &projections().unwrap(), &active).unwrap();
}
