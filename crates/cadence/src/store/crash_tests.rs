//! Real-process tests of the production store. Barriers live only in this driver.
// The library test harness owns the driver and its test-only store hooks.
use crate::store as production_store;
use production_store::filesystem::{Filesystem, Stage};
use production_store::model::{
    Decision, DecisionRecord, Disposition, Evidence, ItemRecord, Origin, VERSION,
};
use production_store::transaction::Transaction;
use production_store::writer::{Operation, Store};
use production_store::{Error, MutationContext, Policy, Result};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}
fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
}
fn operation(id: &str) -> Transaction {
    let origin = Origin {
        source: "process-test".into(),
        original: Evidence::Missing,
    };
    Transaction {
        id: id.into(),
        items: vec![ItemRecord {
            version: VERSION,
            id: id.into(),
            revision: 1,
            origin: origin.clone(),
            text: format!("{id} complete content"),
            kind: "todo".into(),
            disposition: Disposition::Captured,
            completed: false,
            filing_uncertain: false,
        }],
        decisions: vec![DecisionRecord {
            version: VERSION,
            id: id.into(),
            revision: 1,
            origin,
            decision: Decision::Gate {
                outcome: id.into(),
                evidence: Evidence::Null,
            },
        }],
        snapshot: Some(serde_json::json!({"value":id})),
        external: vec![],
    }
}
fn apply(root: &Path, id: &str) {
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root).unwrap(), Allow)
            .await
            .unwrap();
        store
            .request(Operation::Transact(operation(id)))
            .await
            .unwrap();
    });
}
const TARGETS: [&str; 3] = ["items.jsonl", "decisions.jsonl", "state.json"];
fn values(root: &Path) -> Vec<Option<Vec<u8>>> {
    TARGETS
        .iter()
        .map(|target| std::fs::read(root.join(target)).ok())
        .collect()
}
fn assert_complete(root: &Path, old: &[Option<Vec<u8>>], new: &[Option<Vec<u8>>]) {
    for ((target, actual), (old, new)) in TARGETS.iter().zip(values(root)).zip(old.iter().zip(new))
    {
        assert!(actual == *old || actual == *new, "torn target {target}");
    }
}
fn barrier(stage: Stage, path: &Path, wanted_stage: &str, target: &str) {
    if format!("{stage:?}") == wanted_stage && path.file_name().unwrap() == target {
        println!("CADENCE_BARRIER");
        std::io::stdout().flush().unwrap();
        loop {
            std::thread::park();
        }
    }
}

#[test]
fn crash_child() {
    let Ok(root) = std::env::var("CADENCE_CRASH_ROOT") else {
        return;
    };
    if let Ok(mode) = std::env::var("CADENCE_AC8_MODE") {
        measured_child(Path::new(&root), &mode);
        return;
    }
    let stage = std::env::var("CADENCE_CRASH_STAGE").unwrap();
    let target = std::env::var("CADENCE_CRASH_TARGET").unwrap();
    let fs = Filesystem::new(root).unwrap().with_probe(move |at, path| {
        barrier(at, path, &stage, &target);
        Ok(())
    });
    runtime().block_on(async {
        let store = Store::open(fs, Allow).await.unwrap();
        if std::env::var("CADENCE_CRASH_MODE").unwrap() == "write" {
            store
                .request(Operation::Transact(operation("new")))
                .await
                .unwrap();
        } else {
            store.request(Operation::Read).await.unwrap();
        }
        println!("CADENCE_SUCCESS");
    });
}

fn kill_at(root: &Path, stage: &str, target: &str, mode: &str) {
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "store::crash_tests::crash_child", "--nocapture"])
        .env("CADENCE_CRASH_ROOT", root)
        .env("CADENCE_CRASH_STAGE", stage)
        .env("CADENCE_CRASH_TARGET", target)
        .env("CADENCE_CRASH_MODE", mode)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let (sender, receiver) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let line = line.unwrap();
            if line.contains("CADENCE_BARRIER") {
                let _ = sender.send(());
                return;
            }
        }
    });
    let reached = receiver.recv_timeout(Duration::from_secs(10));
    child.kill().unwrap();
    let status = child.wait().unwrap();
    reader.join().unwrap();
    assert!(reached.is_ok(), "barrier not reached: {stage} {target}");
    assert!(!status.success());
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        assert_eq!(status.signal(), Some(libc::SIGKILL));
    }
}

#[test]
fn process_kill_replacements_leave_complete_old_or_new_bytes() {
    for initially_absent in [true, false] {
        let reference = tempfile::tempdir().unwrap();
        if !initially_absent {
            apply(reference.path(), "old");
        }
        let old = values(reference.path());
        apply(reference.path(), "new");
        let new = values(reference.path());
        for target in TARGETS {
            for stage in ["Writing", "TemporarySynced", "Renamed", "DirectorySynced"] {
                let root = tempfile::tempdir().unwrap();
                if !initially_absent {
                    apply(root.path(), "old");
                }
                kill_at(root.path(), stage, target, "write");
                assert_complete(root.path(), &old, &new);
                // Retry after recovery is also the first operation after a kill
                // during preparation, when no intent had yet been installed.
                apply(root.path(), "new");
                assert_eq!(values(root.path()), new);
                apply(root.path(), "new");
                assert_eq!(values(root.path()), new);
            }
        }
    }
}

#[test]
fn process_kill_during_replay_preserves_complete_targets_and_retry_identity() {
    let reference = tempfile::tempdir().unwrap();
    apply(reference.path(), "old");
    let old = values(reference.path());
    apply(reference.path(), "new");
    let new = values(reference.path());
    for (stage, target) in [
        ("RecoverySync", "items.jsonl"),
        ("Writing", "decisions.jsonl"),
        ("Renamed", "state.json"),
    ] {
        let root = tempfile::tempdir().unwrap();
        apply(root.path(), "old");
        runtime().block_on(async {
            let fs = Filesystem::new(root.path())
                .unwrap()
                .with_probe(|at, path| {
                    if at == Stage::Confirmation && path.file_name().unwrap() == "items.jsonl" {
                        Err(Error::Io("interrupted".into()))
                    } else {
                        Ok(())
                    }
                });
            let store = Store::open(fs, Allow).await.unwrap();
            assert!(
                store
                    .request(Operation::Transact(operation("new")))
                    .await
                    .is_err()
            );
        });
        kill_at(root.path(), stage, target, "read");
        assert_complete(root.path(), &old, &new);
        apply(root.path(), "new");
        assert_eq!(values(root.path()), new);
    }
}

#[test]
fn acknowledged_operations_survive_normal_process_restart() {
    let root = tempfile::tempdir().unwrap();
    for mode in ["write", "read"] {
        let output = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "store::crash_tests::crash_child", "--nocapture"])
            .env("CADENCE_CRASH_ROOT", root.path())
            .env("CADENCE_CRASH_STAGE", "disabled")
            .env("CADENCE_CRASH_TARGET", "state.json")
            .env("CADENCE_CRASH_MODE", mode)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(String::from_utf8_lossy(&output.stdout).contains("CADENCE_SUCCESS"));
    }
    runtime().block_on(async {
        let store = Store::open(Filesystem::new(root.path()).unwrap(), Allow)
            .await
            .unwrap();
        let view = store.request(Operation::Read).await.unwrap();
        assert_eq!(view.items.len(), 1);
        assert_eq!(view.decisions.len(), 1);
        assert_eq!(view.items[0].id, "new");
    });
}

const MEASURED_ID: &str = "ac8-1";

fn pipe_marker(kind: &str, id: &str) -> Result<()> {
    let marker = format!("{kind}:{id}\n");
    // stdout is a parent-owned pipe. One synchronous unbuffered write is the
    // marker; stdio buffering or a receiver-side marker cannot establish send order.
    let written = unsafe { libc::write(libc::STDOUT_FILENO, marker.as_ptr().cast(), marker.len()) };
    if written != marker.len() as isize {
        return Err(Error::Io("marker pipe write failed".into()));
    }
    Ok(())
}

fn measured_child(root: &Path, mode: &str) {
    use production_store::filesystem::OmitSync;
    apply(root, "fixture");
    let omission = match mode {
        "positive" => OmitSync::Neither,
        "omit-temporary" => OmitSync::Temporary,
        "omit-directory" => OmitSync::Directory,
        _ => panic!("unknown trace mode"),
    };
    runtime().block_on(async {
        let fs = Filesystem::new(root).unwrap().omit_sync_for_test(omission);
        let store =
            Store::open_observed_for_test(fs, Allow, Box::new(|id| pipe_marker("PRESEND", id)))
                .await
                .unwrap();
        pipe_marker("START", MEASURED_ID).unwrap();
        let reply = store
            .request_identified_for_test(
                MEASURED_ID,
                Operation::RewriteSnapshot(serde_json::json!({"measured":MEASURED_ID})),
            )
            .await;
        let view = reply.expect("measured request must receive its actual success reply");
        assert_eq!(
            view.snapshot.data,
            serde_json::json!({"measured":MEASURED_ID})
        );
        pipe_marker("REPLY", MEASURED_ID).unwrap();
    });
}

#[derive(Debug)]
enum TraceError {
    Blocked(String),
    Failed(String),
}
impl std::fmt::Display for TraceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Blocked(reason) => write!(f, "BLOCKED AC8: {reason}"),
            Self::Failed(reason) => write!(f, "FAILED AC8: {reason}"),
        }
    }
}
struct Call {
    start: usize,
    end: usize,
    text: String,
}

fn completed_calls(trace: &str) -> std::result::Result<Vec<Call>, TraceError> {
    use std::collections::BTreeMap;
    let mut pending: BTreeMap<String, (usize, String)> = BTreeMap::new();
    let mut calls = Vec::new();
    for (index, line) in trace.lines().enumerate() {
        // -f -o prefixes each thread/process line with its numeric TID.
        let Some((tid, text)) = line.trim().split_once(char::is_whitespace) else {
            continue;
        };
        if !tid.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let text = text.trim();
        if let Some(prefix) = text.strip_suffix("<unfinished ...>") {
            if pending.insert(tid.into(), (index, prefix.into())).is_some() {
                return Err(TraceError::Blocked(
                    "overlapping unfinished calls for one thread".into(),
                ));
            }
        } else if let Some(resumed) = text.strip_prefix("<... ") {
            let Some((name, tail)) = resumed.split_once(" resumed>") else {
                continue;
            };
            let Some((start, prefix)) = pending.remove(tid) else {
                return Err(TraceError::Blocked("resumed call has no entry".into()));
            };
            if !prefix.starts_with(&format!("{name}(")) {
                return Err(TraceError::Blocked(
                    "unfinished/resumed syscall mismatch".into(),
                ));
            }
            calls.push(Call {
                start,
                end: index,
                text: format!("{prefix}{tail}"),
            });
        } else if text.contains(" = ") {
            calls.push(Call {
                start: index,
                end: index,
                text: text.into(),
            });
        }
    }
    if !pending.is_empty() {
        return Err(TraceError::Blocked("incomplete syscall trace".into()));
    }
    Ok(calls)
}
fn returned(call: &Call) -> Option<i64> {
    call.text
        .rsplit_once(" = ")?
        .1
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}
fn quoted(text: &str) -> Vec<&str> {
    // Fixture paths and markers have no quote/backslash characters. Keep exact
    // path strings rather than guessing descriptor numbers across threads.
    text.split('"')
        .enumerate()
        .filter_map(|(i, part)| (i % 2 == 1).then_some(part))
        .collect()
}
fn descriptor(call: &Call) -> Option<&str> {
    let (_, rest) = call.text.split_once('<')?;
    Some(rest.split_once('>')?.0)
}
fn marker<'a>(calls: &'a [Call], kind: &str) -> std::result::Result<&'a Call, TraceError> {
    let payload = format!("{kind}:{MEASURED_ID}\\n");
    let expected_bytes = format!("{kind}:{MEASURED_ID}\n").len() as i64;
    let matching: Vec<_> = calls
        .iter()
        .filter(|call| {
            call.text.starts_with("write(")
                && descriptor(call).is_some_and(|path| path.starts_with("pipe:["))
                && quoted(&call.text).first().copied() == Some(payload.as_str())
                && returned(call) == Some(expected_bytes)
        })
        .collect();
    if matching.len() != 1 {
        return Err(TraceError::Blocked(format!(
            "missing or nonunique successful {kind} pipe marker"
        )));
    }
    Ok(matching[0])
}

fn check_trace(trace: &str, root: &Path) -> std::result::Result<(), TraceError> {
    let calls = completed_calls(trace)?;
    let start = marker(&calls, "START")?;
    let presend = marker(&calls, "PRESEND")?;
    let reply = marker(&calls, "REPLY")?;
    if start.end >= presend.start || presend.end >= reply.start {
        return Err(TraceError::Failed("request markers are reordered".into()));
    }
    let state = root.join("state.json");
    let state = state.to_str().unwrap();
    let renames: Vec<_> = calls
        .iter()
        .filter(|call| {
            (call.text.starts_with("rename(")
                || call.text.starts_with("renameat(")
                || call.text.starts_with("renameat2("))
                && call.start > start.end
                && call.end < presend.start
                && quoted(&call.text).get(1).copied() == Some(state)
        })
        .collect();
    if renames.len() != 1 || returned(renames[0]) != Some(0) {
        return Err(TraceError::Failed(
            "missing, failed, or repeated measured state rename".into(),
        ));
    }
    let rename = renames[0];
    let names = quoted(&rename.text);
    let temporary = Path::new(names[0]);
    if temporary.parent() != Some(root)
        || !temporary
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with(".state.json.")
        || temporary.extension().is_none_or(|ext| ext != "tmp")
    {
        return Err(TraceError::Failed(
            "rename did not install an exact sibling temporary file".into(),
        ));
    }
    let syncs: Vec<_> = calls
        .iter()
        .filter(|call| {
            call.text.starts_with("fsync(") && call.start > start.end && call.end < presend.start
        })
        .collect();
    let file_syncs: Vec<_> = syncs
        .iter()
        .copied()
        .filter(|call| descriptor(call) == Some(names[0]))
        .collect();
    if file_syncs.len() != 1
        || returned(file_syncs[0]) != Some(0)
        || file_syncs[0].end >= rename.start
    {
        return Err(TraceError::Failed(
            "temporary-file fsync is missing, failed, or did not complete before rename".into(),
        ));
    }
    let directory = root.to_str().unwrap();
    let directory_syncs: Vec<_> = syncs
        .iter()
        .copied()
        .filter(|call| descriptor(call) == Some(directory) && call.start > rename.end)
        .collect();
    if directory_syncs.is_empty() || directory_syncs.iter().any(|call| returned(call) != Some(0)) {
        return Err(TraceError::Failed(
            "directory fsync is missing or failed between rename and pre-send".into(),
        ));
    }
    Ok(())
}

#[test]
fn ac8_syscall_order() {
    if !cfg!(target_os = "linux") {
        panic!("BLOCKED AC8: Linux strace is required");
    }
    let version = Command::new("strace")
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .unwrap_or_else(|error| panic!("BLOCKED AC8: strace is unavailable: {error}"));
    assert!(
        version.status.success(),
        "BLOCKED AC8: strace cannot execute"
    );
    for mode in ["positive", "omit-temporary", "omit-directory"] {
        let root = tempfile::tempdir().unwrap();
        let trace_dir = tempfile::tempdir().unwrap();
        let trace_file = trace_dir.path().join("syscalls.trace");
        let output = Command::new("strace")
            .args(["-f", "-yy", "-o"])
            .arg(&trace_file)
            .arg(std::env::current_exe().unwrap())
            .args(["--exact", "store::crash_tests::crash_child", "--nocapture"])
            .env("CADENCE_CRASH_ROOT", root.path())
            .env("CADENCE_AC8_MODE", mode)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "BLOCKED AC8: tracing or child failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(
            String::from_utf8_lossy(&output.stdout).contains(&format!("REPLY:{MEASURED_ID}\n")),
            "BLOCKED AC8: actual request success reply was not received"
        );
        let trace = std::fs::read_to_string(trace_file).unwrap();
        let checked = check_trace(&trace, root.path());
        match (mode, checked) {
            ("positive", Ok(())) => (),
            ("positive", Err(error)) => panic!("{error}"),
            (_, Err(TraceError::Failed(_))) => (),
            (_, Err(error)) => panic!("{error}"),
            (_, Ok(())) => panic!("negative control {mode} was incorrectly accepted"),
        }
    }
}
