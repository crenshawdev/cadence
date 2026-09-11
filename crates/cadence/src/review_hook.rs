//! Silent SubagentStop bridge. A stop is an observation, never raw delivery.
use cadence::review::{attempts, io::Clock, material_io::WallClock, model::*, persistence};
use serde::Deserialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, ExitCode, Stdio},
    sync::Arc,
};

#[derive(Deserialize)]
struct Stop {
    cwd: PathBuf,
    agent_id: String,
    hook_event_name: String,
}

fn bounded(path: &Path, cap: usize) -> Option<Vec<u8>> {
    let file = std::fs::File::open(path).ok()?;
    let mut bytes = Vec::new();
    file.take(cap as u64 + 1).read_to_end(&mut bytes).ok()?;
    (bytes.len() <= cap).then_some(bytes)
}
fn root(cwd: &Path) -> Option<PathBuf> {
    cwd.ancestors().find_map(|path| {
        let planning = path.join(".planning");
        planning.is_dir().then_some(planning)
    })
}
fn legacy_bound(root: &Path, agent: &str) -> bool {
    let Some(bytes) = bounded(&root.join("trace.jsonl"), 1024 * 1024) else {
        return false;
    };
    let mut identities = std::collections::BTreeSet::new();
    for line in bytes.split(|b| *b == b'\n').filter(|line| !line.is_empty()) {
        let Ok(record) = serde_json::from_slice::<Value>(line) else {
            return false;
        };
        if record["agent_id"] == agent
            && record["family"] == "lifecycle"
            && !record["corr"].is_null()
        {
            identities.insert(record["corr"].to_string());
        }
    }
    identities.len() == 1
}
/// The only legacy subprocess boundary; stdin is the original hook event.
fn legacy(bytes: &[u8]) {
    let Some(plugin) = std::env::var_os("CLAUDE_PLUGIN_ROOT") else {
        return;
    };
    let script = PathBuf::from(plugin).join("cadence-core/bin/subagent-trace.mjs");
    let Ok(mut child) = Command::new("node")
        .arg(script)
        .env("TMPDIR", "/tmp")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return;
    };
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(bytes);
    }
    let _ = child.wait();
}

async fn observe(event: &Stop, root: &Path) -> Option<bool> {
    if !root.join(cadence::store::model::STATE).exists() {
        return Some(false);
    }
    let global = std::env::var_os("CADENCE_GLOBAL_CONFIG")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".claude/cadence/config.json"))
        });
    let factory =
        crate::import::SessionFactory::new(global, Arc::new(crate::config::planning_policy));
    let session = factory.first_touch(root).await.ok()?;
    let store = session.review_store();
    let records = persistence::records(&persistence::read(store).await.ok()?.snapshot.data).ok()?;
    let Some(id) = records["host_launches"][&event.agent_id].as_str() else {
        return Some(false);
    };
    let attempt: Attempt = persistence::get(&records, "attempts", id).ok()?;
    if attempt.launch.as_deref() != Some(&event.agent_id) {
        return None;
    }
    let observation_id = format!("subagent-stop:{}:{}", attempt.attempt, event.agent_id);
    if records["observations"].get(&observation_id).is_some() {
        return Some(true);
    }
    let mut clock = WallClock;
    let observation = Observation {
        observation: observation_id,
        attempt: attempt.attempt,
        launch: Some(event.agent_id.clone()),
        host_return: None,
        kind: ObservationKind::Interrupted,
        reference: format!("SubagentStop:{}", event.agent_id),
        observed_at: clock.now(),
        host: None,
        model: None,
        usage: Usage {
            input: None,
            output: None,
            cost: None,
            currency: None,
        },
        contract: Contract::current(),
    };
    // Even a failed native write must never fall through to a legacy close.
    let _ = attempts::record_observation(store, observation, &mut clock).await;
    Some(true)
}

pub fn run() -> ExitCode {
    let mut bytes = Vec::new();
    if std::io::stdin()
        .lock()
        .take(65_537)
        .read_to_end(&mut bytes)
        .is_err()
        || bytes.len() > 65_536
    {
        return ExitCode::SUCCESS;
    }
    let Ok(event) = serde_json::from_slice::<Stop>(&bytes) else {
        return ExitCode::SUCCESS;
    };
    if event.hook_event_name != "SubagentStop" || event.agent_id.is_empty() {
        return ExitCode::SUCCESS;
    }
    let Some(root) = root(&event.cwd) else {
        return ExitCode::SUCCESS;
    };
    let Ok(runtime) = tokio::runtime::Runtime::new() else {
        return ExitCode::SUCCESS;
    };
    if runtime.block_on(observe(&event, &root)) == Some(false)
        && legacy_bound(&root, &event.agent_id)
    {
        legacy(&bytes);
    }
    ExitCode::SUCCESS
}
