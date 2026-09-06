//! The comparison instrument and its controls; a green test is not a parity claim.

use regex::Regex;
use serde::{Deserialize, Deserializer, de::DeserializeOwned};
use serde_json::Value;
use std::collections::BTreeMap;
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

#[expect(dead_code, reason = "normalization is implemented in the next task")]
#[derive(Debug)]
enum Target {
    File(String),
    Stdout(String),
}

#[expect(dead_code, reason = "normalization is implemented in the next task")]
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
