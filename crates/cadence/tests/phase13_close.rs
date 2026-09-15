#[path = "support/phase13.rs"]
pub mod phase13;
use phase13::*;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, BTreeSet}, fs, io::Write, os::unix::fs::PermissionsExt, path::{Path, PathBuf}, process::{Command, Stdio}};

fn sha(raw: &[u8]) -> String { format!("{:x}", Sha256::digest(raw)) }

/// Every regular file under a tree as (relative path, sha256); a symlink
/// contributes its link text and a special node refuses instead of being
/// silently skipped.
fn manifest(root: &Path) -> BTreeMap<String, String> {
    fn visit(base: &Path, path: &Path, out: &mut BTreeMap<String, String>) {
        for entry in fs::read_dir(path).unwrap() {
            let entry = entry.unwrap();
            let child = entry.path();
            let kind = fs::symlink_metadata(&child).unwrap().file_type();
            let relative = child.strip_prefix(base).unwrap().to_string_lossy().into_owned();
            if kind.is_symlink() {
                out.insert(relative, sha(fs::read_link(&child).unwrap().as_os_str().as_encoded_bytes()));
            } else if kind.is_dir() {
                visit(base, &child, out);
            } else if kind.is_file() {
                out.insert(relative, sha(&fs::read(&child).unwrap()));
            } else {
                panic!("unsupported node in the planning tree: {}", child.display());
            }
        }
    }
    let mut out = BTreeMap::new();
    visit(root, root, &mut out);
    out
}

fn identity(manifest: &BTreeMap<String, String>) -> String {
    sha(&serde_json::to_vec(manifest).unwrap())
}

/// Byte-for-byte copy of a tree: files and directories only, symlinks kept as links.
fn copy_tree(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let from = entry.path();
        let to = destination.join(entry.file_name());
        let kind = fs::symlink_metadata(&from).unwrap().file_type();
        if kind.is_symlink() {
            std::os::unix::fs::symlink(fs::read_link(&from).unwrap(), &to).unwrap();
        } else if kind.is_dir() {
            copy_tree(&from, &to);
        } else {
            fs::copy(&from, &to).unwrap();
        }
    }
}

/// `- [x] **Phase N: ...` lines of the copied ROADMAP, read by hand.
fn declared_phases(roadmap: &str) -> Vec<(u32, bool)> {
    roadmap.lines().filter_map(|line| {
        let rest = line.strip_prefix("- [")?;
        let checked = rest.starts_with('x');
        let rest = rest.get(1..)?.strip_prefix("] **Phase ")?;
        let number: u32 = rest.split(':').next()?.trim().parse().ok()?;
        Some((number, checked))
    }).collect()
}

const STORE_FILES: [&str; 4] = ["state.json", "items.jsonl", "decisions.jsonl", "config.v4.json"];

/// The rewrite tree as it stood at the adoption rehearsal (cea1f28c, phase 13
/// close). The live tree has carried its own native store since dogfooding
/// began and is no longer a pre-adoption source.
const ADOPTION_SOURCE: &str = "cea1f28c192d868995fd74167bb81f936263dc8c";

/// Export the pinned `.planning` tree from git into `into`, never the live tree.
fn adoption_source(into: &Path) -> PathBuf {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..").canonicalize().unwrap();
    let archive = into.join("source.tar");
    let exported = Command::new("git").args(["archive", "--format=tar", "-o"]).arg(&archive)
        .args([ADOPTION_SOURCE, ".planning"]).current_dir(&repository).stdin(Stdio::null()).output().unwrap();
    assert!(exported.status.success(), "{}", String::from_utf8_lossy(&exported.stderr));
    let source = into.join("source");
    fs::create_dir_all(&source).unwrap();
    let extracted = Command::new("tar").arg("-xf").arg(&archive).arg("-C").arg(&source)
        .stdin(Stdio::null()).output().unwrap();
    assert!(extracted.status.success(), "{}", String::from_utf8_lossy(&extracted.stderr));
    fs::remove_file(&archive).unwrap();
    source.join(".planning")
}

#[test]
fn phase13_adoption_copy_preserves_history_and_recovers() {
    // The pinned rewrite tree is the source: exported, hashed, copied, never opened.
    let disposable = tempfile::tempdir().unwrap();
    let source_root = adoption_source(disposable.path());
    for file in STORE_FILES {
        assert!(!source_root.join(file).exists(), "the rehearsal source has no native store and this rehearsal gives it none");
    }
    let source = manifest(&source_root);
    let source_identity = identity(&source);
    let project = disposable.path().join("project");
    fs::create_dir_all(&project).unwrap();
    git(&project, &["init", "--initial-branch=fixture/adoption"]);
    fs::write(project.join(".gitignore"), ".planning/\n").unwrap();
    git(&project, &["add", ".gitignore"]);
    git(&project, &["commit", "-m", "Adoption rehearsal baseline"]);
    let copy = project.join(".planning");
    copy_tree(&source_root, &copy);
    assert_eq!(manifest(&copy), source, "the copy carries every source byte");
    let backup = disposable.path().join("backup");
    copy_tree(&copy, &backup);
    let backup_identity = identity(&manifest(&backup));
    assert_eq!(backup_identity, source_identity, "the backup is the exact pre-touch copy");
    // Classify every declared phase from the copy's own authority through
    // the real binary. Nothing here is native: no approval, map or red
    // history exists to import, and none is invented.
    let roadmap = fs::read_to_string(copy.join("ROADMAP.md")).unwrap();
    let declared = declared_phases(&roadmap);
    assert_eq!(declared.len(), 30);
    let mut client = Client::open(&project);
    let version = client.call("cadence_version", json!({}));
    assert_eq!(version["status"], "ok", "{version}");
    let mut classified = Vec::new();
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for (phase, checked) in &declared {
        let read = client.call("cadence_query", json!({"operation":"plan-read","phase_address":phase.to_string()}));
        assert_eq!(read["status"], "ok", "{read}");
        assert_eq!(read["native_truths_approved"], false, "no native truths exist for phase {phase}");
        assert!(read["native"]["publications"].as_object().is_none_or(|p| p.is_empty()), "no native publication for phase {phase}");
        let directory = copy.join(format!("phases/{phase}"));
        let documents: Vec<String> = if directory.is_dir() {
            let mut names: Vec<String> = fs::read_dir(&directory).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
            names.sort();
            names
        } else { vec![] };
        let plans: Vec<Value> = read["plans"].as_array().unwrap().iter().map(|p| {
            assert_eq!(p["classification"], "legacy-input", "phase {phase}: {p}");
            let plan = p["identity"]["plan"].as_u64().unwrap();
            let numbered = directory.join(format!("PLAN-{plan}.md"));
            let path = if numbered.is_file() { numbered } else { directory.join("PLAN.md") };
            json!({"plan":plan,"document_sha256":sha(&fs::read(path).unwrap())})
        }).collect();
        let unretained: Vec<&String> = documents.iter().filter(|name| !(name.starts_with("PLAN") || name.starts_with("SUMMARY")
            || name.starts_with("UAT") || *name == "CONTEXT.md" || *name == "reports")).collect();
        let class = if documents.is_empty() { "unavailable" } else { "imported" };
        *counts.entry(class).or_default() += 1;
        classified.push(json!({"phase":phase,"roadmap_checked":checked,"classification":class,"documents":documents,
            "legacy_plans":plans,"unretained_inputs":unretained,
            "human_results":documents.iter().any(|d| d.starts_with("UAT"))}));
    }
    assert_eq!(counts, BTreeMap::from([("imported", 16), ("unavailable", 14)]));
    // The compiled front doors refuse to run copied history as native work.
    let verify_copy = client.call("cadence_query", json!({"operation":"verify-next","phase":13,"request_id":"adoption-copy"}));
    assert_eq!(verify_copy["status"], "refused", "{verify_copy}");
    assert_eq!(verify_copy["rule"], "native-approved-truths");
    let execute = client.call("cadence_query", json!({"operation":"execute-next","phase":13}));
    assert_eq!(execute["status"], "refused", "{execute}");
    let audit = client.call("cadence_query", json!({"operation":"verification-audit","phase":13,"command":"cad-audit"}));
    assert_eq!(audit["status"], "ok", "{audit}");
    assert_eq!(audit["read_only"], true);
    assert_eq!(audit["sources"]["context"]["available"], false);
    assert_eq!(audit["counts"]["met"], 0, "nothing in copied history is current met evidence: {}", audit["counts"]);
    assert!(audit["traces"].as_array().unwrap().iter().all(|t| t["outcome"] == "broken"), "{}", audit["counts"]);
    client.finish();
    // First touch created only the store's own files; every copied byte is
    // preserved, and every unsupported historical input stays as it was.
    let touched = manifest(&copy);
    let created: BTreeSet<&String> = touched.keys().filter(|k| !source.contains_key(*k)).collect();
    assert!(created.iter().all(|k| STORE_FILES.contains(&k.as_str())), "{created:?}");
    for (path, digest) in &source {
        assert_eq!(touched.get(path), Some(digest), "{path} changed under first touch");
    }
    let imported = reopened(&project).snapshot;
    assert_eq!(imported.data["import"]["complete"], true);
    assert_eq!(imported.data.get("context"), None, "no approved context was invented");
    assert_eq!(imported.data.get("plan_publications"), None, "no publication was invented");
    assert_eq!(imported.data.get("acceptance_maps"), None, "no map was invented");
    assert_eq!(imported.data.get("verification"), None, "no verification was invented");
    // One writer at a time: two live servers write through the same store and
    // both writes are durable and ordered, never interleaved.
    let mut first = Client::open(&project);
    let mut second = Client::open(&project);
    let one = first.call("cadence_apply", json!({"operation":"config-apply","layer":"repo","updates":[{"key":"roles.cad-executor.effort","value":"high"}]}));
    let two = second.call("cadence_apply", json!({"operation":"config-apply","layer":"repo","updates":[{"key":"roles.cad-verifier.effort","value":"high"}]}));
    assert_eq!(one["status"], "ok", "{one}");
    assert_eq!(two["status"], "ok", "{two}");
    first.finish();
    second.finish();
    let facts = query(&project, json!({"operation":"config-facts"}));
    let effective = |facts: &Value, key: &str| facts["facts"]["keys"].as_array().unwrap().iter().find(|r| r["key"] == key).unwrap()["effective"].clone();
    assert_eq!(effective(&facts, "roles.cad-executor.effort"), "high");
    assert_eq!(effective(&facts, "roles.cad-verifier.effort"), "high");
    let written = reopened(&project).snapshot;
    assert!(written.generation > imported.generation);
    // Interruption: the server is killed the moment a write is sent, three
    // times. Reopening recovers or rolls back the intent; the store is never
    // half-written and the copied documents are untouched.
    let mut outcomes = Vec::new();
    let mut previous = effective(&facts, "roles.cad-planner.effort");
    for value in ["medium", "high", "low"] {
        let client = Client::open(&project);
        client.interrupt("cadence_apply", json!({"operation":"config-apply","layer":"repo","updates":[{"key":"roles.cad-planner.effort","value":value}]}));
        let recovered = recovered(&project);
        assert!(!copy.join(".store-intent.json").exists(), "recovery leaves no intent behind");
        let facts = query(&project, json!({"operation":"config-facts"}));
        let observed = effective(&facts, "roles.cad-planner.effort");
        let landed = observed == json!(value);
        assert!(landed || observed == previous, "{observed} after interrupting {value}; before: {previous}");
        let now = manifest(&copy);
        for (path, digest) in &source {
            assert_eq!(now.get(path), Some(digest), "{path} changed under an interrupted write");
        }
        outcomes.push(json!({"requested":value,"before":previous,"landed":landed,"generation":recovered.snapshot.generation}));
        if landed { previous = json!(value); }
    }
    // Explicit restore: the backup's identity is the identity that comes
    // back, and a fresh server works on the restored copy again.
    fs::remove_dir_all(&copy).unwrap();
    copy_tree(&backup, &copy);
    assert_eq!(identity(&manifest(&copy)), backup_identity);
    let restored = query(&project, json!({"operation":"plan-read","phase_address":"13"}));
    assert_eq!(restored["status"], "ok", "{restored}");
    assert_eq!(restored["native_truths_approved"], false);
    assert_eq!(manifest(&source_root), source, "the live tree was never touched");
    // The full native path on a separately authored fixture: approved truths,
    // published maps, admitted and executed plans with real red/green
    // receipts, independent verification runs, one complete patch, the
    // derived report, the read-only audit and native completion. Copied
    // history is not this oracle and this fixture is not the rewrite.
    let native = Completed::new();
    let host = native.project();
    let (attempt, patch) = verify(host, "adoption-native", &[]);
    let read = query(host, json!({"operation":"verification-read","phase":13}));
    assert_eq!(read["counts"], json!({"met":2,"concerns":0,"unmet":0,"pending":0,"waived":0}));
    assert_eq!(read["current"]["attempt"], attempt["id"]);
    let basis = read["current"]["verified_at"].clone();
    let native_audit = query(host, json!({"operation":"verification-audit","phase":13,"command":"cad-audit"}));
    assert_eq!(native_audit["status"], "ok", "{native_audit}");
    assert_eq!(native_audit["sources"]["verification"]["applicable"], true);
    assert_eq!(native_audit["sources"]["requirements"]["available"], false, "the fixture authors no REQUIREMENTS.md");
    let roadmap_path = host.join(".planning/ROADMAP.md");
    let completion = apply(host, json!({"operation":"verification-complete","request_id":"adoption-complete","attempt":attempt["id"],"basis":basis,
        "projections":{"roadmap":digest_of(&roadmap_path),"requirements":null}}));
    assert_eq!(completion["status"], "ok", "{completion}");
    assert_eq!(completion["receipt"]["record"]["label"], "complete");
    let after = query(host, json!({"operation":"verification-read","phase":13}));
    assert_eq!(after["completion"]["status"], "complete");
    let store = reopened(host).snapshot;
    let runs: Vec<String> = patch["items"].as_array().unwrap().iter().flat_map(|i| i["runs"].as_array().unwrap().iter().map(|r| r.as_str().unwrap().to_owned())).collect();
    let mut output = std::io::stdout().lock();
    writeln!(output, "ADOPTION_COPY {}", json!({
        "source_root":source_root,"source_files":source.len(),"source_identity":source_identity,
        "copy_root":copy,"backup_root":backup,"backup_identity":backup_identity,
        "binary":env!("CARGO_BIN_EXE_cadence"),"version":version,
        "classification_counts":counts,"phases":classified,
        "first_touch_created":created,"verify_next":verify_copy,"execute_next":{"status":execute["status"],"code":execute["code"],"rule":execute["rule"],"reason":execute["reason"]},
        "audit_counts":audit["counts"],"audit_traces":audit["traces"],"audit_out_of_scope":audit["out_of_scope"],
        "audit_sources":{"requirements":audit["sources"]["requirements"],"roadmap":audit["sources"]["roadmap"]},
        "import_generation":imported.generation,"writers_generation":written.generation,
        "interruptions":outcomes})).unwrap();
    writeln!(output, "ADOPTION_NATIVE {}", json!({
        "project":host,"root_binding":basis["root_binding"],"occurrence":basis["occurrence"],
        "context_digest":basis["context_digest"],"truths":basis["truths"],"publications":basis["publications"],
        "map_digest":basis["map_digest"],"admission_digests":basis["admission_digests"],"execution_digest":basis["execution_digest"],
        "source":basis["source"],"allocation":native.admission["receipt"]["request"]["contract"]["allocation"],
        "red_green":native.pairs,"verification_attempt":attempt["id"],"verification_runs":runs,"patch":patch["request_id"],
        "completion":completion["receipt"]["record"]["id"],"audit_counts":native_audit["counts"],"audit_digest":sha(&serde_json::to_vec(&native_audit["traces"]).unwrap()),
        "store_generation":store.generation})).unwrap();
}

struct Settings {
    root: PathBuf,
    before: Vec<u8>,
    after: Vec<u8>,
    hook: Vec<u8>,
    command: String,
}

impl Settings {
    fn new(parent: &Path, name: &str) -> Self {
        let root = parent.join(name);
        fs::create_dir_all(root.join("hooks")).unwrap();
        let command = format!("node {}", root.join("hooks/rules-gate.mjs").display());
        let target = serde_json::to_string(&command).unwrap();
        let near = serde_json::to_string(&format!("{command}.disabled")).unwrap();
        let flagged = serde_json::to_string(&format!("{command} --flag")).unwrap();
        let entry = format!(r#"{{"type":"command","command":{target}}}"#);
        let sibling = r#"{"type":"command","command":"node guard.mjs"}"#;
        let similar = format!(r#"{{"type":"command","command":{near}}}"#);
        let flags = format!(r#"{{"type":"command","command":{flagged}}}"#);
        // Handwritten output retains event/group/matcher order and untouched bytes.
        let before = format!(r#"{{
  "theme" : "unchanged", "hooks": {{
    "PreToolUse": [{{"matcher":"Write|Edit","hooks":[{entry}, {sibling}, {entry}, {similar}]}}],
    "Stop": [{{"matcher":"","hooks":[{flags}, {entry}]}}],
    "SessionStart": [{{"matcher":"all","hooks":[{{"type":"command","command":"node reviewer-stop-bridge.mjs"}}]}}]
  }}, "permissions" : {{ "allow" : ["Read", "Bash"] }}
}}
"#).into_bytes();
        let after = format!(r#"{{
  "theme" : "unchanged", "hooks": {{
    "PreToolUse": [{{"matcher":"Write|Edit","hooks":[{sibling}, {similar}]}}],
    "Stop": [{{"matcher":"","hooks":[{flags}]}}],
    "SessionStart": [{{"matcher":"all","hooks":[{{"type":"command","command":"node reviewer-stop-bridge.mjs"}}]}}]
  }}, "permissions" : {{ "allow" : ["Read", "Bash"] }}
}}
"#).into_bytes();
        let hook = b"// obsolete rules gate fixture\n".to_vec();
        fs::write(root.join("settings.json"), &before).unwrap();
        fs::write(root.join("hooks/rules-gate.mjs"), &hook).unwrap();
        fs::write(root.join("hooks/guard.mjs"), b"guard stays byte-for-byte\n").unwrap();
        fs::write(root.join("hooks/reviewer-stop-bridge.mjs"), b"bridge stays byte-for-byte\n").unwrap();
        Self {root,before,after,hook,command}
    }

    fn invoke(&self, action: &str, recovery: &Path, settings_hash: &str, hook_hash: &str) -> (i32, Value) {
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.planning/phases/13/close/retire-rules-gate.py").canonicalize().unwrap();
        let args = vec![action.to_owned(), "--settings-root".into(), self.root.display().to_string(),
            "--settings-sha256".into(), settings_hash.into(), "--hook-sha256".into(), hook_hash.into(),
            "--command".into(), self.command.clone(), "--recovery".into(), recovery.display().to_string()];
        let output = Command::new("python3").arg("-B").arg(&script).args(&args)
            .env("HOME", self.root.join("unused-home")).stdin(Stdio::null()).output().unwrap();
        assert!(output.stderr.is_empty(), "{}", String::from_utf8_lossy(&output.stderr));
        let value: Value = serde_json::from_slice(&output.stdout).unwrap();
        let code = output.status.code().unwrap();
        // Bypass libtest capture so the report can quote this actual invocation.
        let mut output = std::io::stdout().lock();
        writeln!(output, "CLOSE_REHEARSAL {}", json!({
            "program":"python3","script":script,"args":args,"exit":code,"answer":value})).unwrap();
        (code, value)
    }

    fn guards(&self) {
        assert_eq!(fs::read(self.root.join("hooks/guard.mjs")).unwrap(), b"guard stays byte-for-byte\n");
        assert_eq!(fs::read(self.root.join("hooks/reviewer-stop-bridge.mjs")).unwrap(), b"bridge stays byte-for-byte\n");
    }
}

#[test]
fn phase13_rules_gate_retirement_rehearsal() {
    // The credited planner front door is project-free compiled text; its native
    // authoring/publication protocol is exercised over real serve/stdio below.
    let output = Command::new(env!("CARGO_BIN_EXE_cadence")).arg("plan-instructions")
        .stdin(Stdio::null()).output().unwrap();
    assert!(output.status.success());
    let planner = String::from_utf8(output.stdout).unwrap();
    assert!(planner.contains("**Planner.** For each truth, write its ONE check"));
    assert!(planner.contains("plan-submit"));
    let fixture = Completed::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    let plans = client.read("13", None);
    assert_eq!(plans["status"], "ok", "{plans}");
    assert_eq!(plans["native_truths_approved"], true);
    assert_eq!(plans["plans"].as_array().unwrap().len(), 2);
    for plan in plans["plans"].as_array().unwrap() {
        assert_eq!(plan["classification"], "native-publication");
    }
    assert!(plans["contract"]["$defs"]["Submission"].is_object());
    assert_eq!(fixture.dispatches.len(), 2);
    for dispatch in &fixture.dispatches {
        assert_eq!(dispatch["outcome"], "dispatch");
        assert!(dispatch["prompt"].as_str().unwrap().contains("**Executor.**"));
    }
    let verify = client.call("cadence_query", json!({"operation":"verify-next","phase":13,"request_id":"close-prerequisite"}));
    assert_eq!(verify["status"], "ok", "{verify}");
    assert!(verify["attempt"]["prompt"].as_str().unwrap().contains("**Verifier.**"));
    client.finish();
    let baseline = tree(project);
    reopened(project);
    assert_eq!(query(project, json!({"operation":"verify-next","phase":13,"request_id":"close-prerequisite"})), verify);
    assert_eq!(tree(project), baseline);
    let mut output = std::io::stdout().lock();
    writeln!(output, "CLOSE_PREREQUISITE {}", json!({
        "planner":"plan-instructions plus real stdio native plan-read/plan-submit",
        "planner_bytes_sha256":sha(planner.as_bytes()),"executor_dispatches":fixture.dispatches.iter().map(|d| &d["dispatch"]["id"]).collect::<Vec<_>>(),
        "verifier_attempt":verify["attempt"]["id"],"prompt_digest":verify["attempt"]["prompt_digest"]})).unwrap();
    drop(output);

    let disposable = tempfile::tempdir().unwrap();
    let case = Settings::new(disposable.path(), "success");
    let recovery = disposable.path().join("success-recovery");
    let (code, result) = case.invoke("retire", &recovery, &sha(&case.before), &sha(&case.hook));
    assert_eq!((code, result["status"].as_str()), (0, Some("retired")));
    assert_eq!(result["removed"], 3);
    assert!(!case.root.join("hooks/rules-gate.mjs").exists());
    assert_eq!(fs::read(case.root.join("settings.json")).unwrap(), case.after);
    assert_eq!(fs::read(recovery.join("settings.original")).unwrap(), case.before);
    assert_eq!(fs::read(recovery.join("hook.original")).unwrap(), case.hook);
    case.guards();
    let (code, result) = case.invoke("retire", &recovery, &sha(&case.before), &sha(&case.hook));
    assert_eq!((code, result["status"].as_str()), (0, Some("already-retired")));
    let (code, result) = case.invoke("retire", &disposable.path().join("absent-recovery"), &sha(&case.after), "absent");
    assert_eq!((code, result["status"].as_str()), (0, Some("already-absent")));
    assert_eq!(fs::read(case.root.join("settings.json")).unwrap(), case.after);
    case.guards();

    let ambiguous = Settings::new(disposable.path(), "ambiguous");
    let raw = b"{\"hooks\":{},\"hooks\":{}}\n";
    fs::write(ambiguous.root.join("settings.json"), raw).unwrap();
    let recovery = disposable.path().join("ambiguous-recovery");
    let (code, result) = ambiguous.invoke("retire", &recovery, &sha(raw), &sha(&ambiguous.hook));
    assert_eq!(code, 1);
    assert_eq!(result["reason"], "ambiguous duplicate JSON key: hooks");
    assert!(!recovery.exists());
    assert_eq!(fs::read(ambiguous.root.join("settings.json")).unwrap(), raw);
    assert_eq!(fs::read(ambiguous.root.join("hooks/rules-gate.mjs")).unwrap(), ambiguous.hook);
    ambiguous.guards();

    let stale = Settings::new(disposable.path(), "stale");
    let recovery = disposable.path().join("stale-recovery");
    for (settings_hash, hook_hash) in [("0".repeat(64), sha(&stale.hook)), (sha(&stale.before), "0".repeat(64))] {
        let (code, result) = stale.invoke("retire", &recovery, &settings_hash, &hook_hash);
        assert_eq!(code, 1);
        assert_eq!(result["reason"], "stale inspected preimage");
        assert!(!recovery.exists());
    }
    assert_eq!(fs::read(stale.root.join("settings.json")).unwrap(), stale.before);
    assert_eq!(fs::read(stale.root.join("hooks/rules-gate.mjs")).unwrap(), stale.hook);
    stale.guards();

    let partial = Settings::new(disposable.path(), "partial");
    let recovery = disposable.path().join("partial-recovery");
    // Real filesystem denial after hook unlink, before settings replacement.
    // This permission-denial case requires the normal unprivileged executor.
    assert_ne!(unsafe { libc::geteuid() }, 0, "partial-failure rehearsal requires an unprivileged runner");
    fs::set_permissions(&partial.root, fs::Permissions::from_mode(0o500)).unwrap();
    let (code, result) = partial.invoke("retire", &recovery, &sha(&partial.before), &sha(&partial.hook));
    fs::set_permissions(&partial.root, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!((code, result["status"].as_str()), (2, Some("unfinished")));
    assert!(!partial.root.join("hooks/rules-gate.mjs").exists());
    assert_eq!(fs::read(partial.root.join("settings.json")).unwrap(), partial.before);
    assert_eq!(fs::read(recovery.join("settings.original")).unwrap(), partial.before);
    assert_eq!(fs::read(recovery.join("hook.original")).unwrap(), partial.hook);
    let (code, result) = partial.invoke("retire", &recovery, &sha(&partial.before), &sha(&partial.hook));
    assert_eq!(code, 1);
    assert!(result["reason"].as_str().unwrap().starts_with("unfinished"));
    let (code, result) = partial.invoke("recover", &recovery, &sha(&partial.before), &sha(&partial.hook));
    assert_eq!((code, result["status"].as_str()), (0, Some("recovered")));
    assert_eq!(fs::read(partial.root.join("settings.json")).unwrap(), partial.before);
    assert_eq!(fs::read(partial.root.join("hooks/rules-gate.mjs")).unwrap(), partial.hook);
    partial.guards();
    let (code, result) = partial.invoke("retire", &disposable.path().join("reinspected-recovery"), &sha(&partial.before), &sha(&partial.hook));
    assert_eq!((code, result["status"].as_str()), (0, Some("retired")));
    assert_eq!(fs::read(partial.root.join("settings.json")).unwrap(), partial.after);
    assert!(!partial.root.join("hooks/rules-gate.mjs").exists());
    partial.guards();
}
