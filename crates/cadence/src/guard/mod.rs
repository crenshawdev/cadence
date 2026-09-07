//! File-ownership guard for host Write and Edit tool calls.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    ffi::OsString,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::ExitCode,
};

#[cfg(test)]
mod tests;

pub const MAX_INPUT_BYTES: u64 = 65_536;

#[derive(Deserialize)]
struct ToolOnly {
    tool_name: Value,
}

#[derive(Deserialize)]
struct Event {
    tool_name: String,
    cwd: String,
    tool_input: ToolInput,
    #[serde(default)]
    hook_event_name: Option<String>,
}

#[derive(Deserialize)]
struct ToolInput {
    file_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Output {
    hook_specific_output: HookOutput,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HookOutput {
    hook_event_name: &'static str,
    permission_decision: &'static str,
    permission_decision_reason: String,
}

pub fn run() -> ExitCode {
    let mut bytes = Vec::new();
    if let Err(error) = std::io::stdin()
        .lock()
        .take(MAX_INPUT_BYTES + 1)
        .read_to_end(&mut bytes)
    {
        return write_denial(format!("cannot read hook input safely: {error}"));
    }
    let matched = matched_tool(&bytes);
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        return if matched {
            write_denial(format!(
                "Write/Edit hook input exceeds the {MAX_INPUT_BYTES}-byte bound"
            ))
        } else {
            ExitCode::SUCCESS
        };
    }
    let tool = match serde_json::from_slice::<ToolOnly>(&bytes) {
        Ok(tool) => tool.tool_name.as_str().map(str::to_owned),
        Err(error) => {
            return if matched {
                write_denial(format!("malformed Write/Edit hook input: {error}"))
            } else {
                ExitCode::SUCCESS
            };
        }
    };
    if !matches!(tool.as_deref(), Some("Write" | "Edit")) {
        return ExitCode::SUCCESS;
    }
    let event: Event = match serde_json::from_slice(&bytes) {
        Ok(event) => event,
        Err(error) => return write_denial(format!("malformed Write/Edit hook input: {error}")),
    };
    if !matches!(event.tool_name.as_str(), "Write" | "Edit") {
        return write_denial("ambiguous Write/Edit tool identity");
    }
    if event
        .hook_event_name
        .as_deref()
        .is_some_and(|name| name != "PreToolUse")
    {
        return write_denial("Write/Edit event is not a PreToolUse event");
    }
    let target = match resolve_target(&event.cwd, &event.tool_input.file_path) {
        Ok(target) => target,
        Err(reason) => return write_denial(reason),
    };
    match protected_target(&target) {
        Ok(true) => write_denial(format!(
            "Cadence owns {}; use the native execution boundary instead of Write/Edit",
            target.display()
        )),
        Ok(false) => ExitCode::SUCCESS,
        Err(reason) => write_denial(reason),
    }
}

fn matched_tool(bytes: &[u8]) -> bool {
    let compact = bytes
        .iter()
        .copied()
        .filter(|byte| !byte.is_ascii_whitespace())
        .collect::<Vec<_>>();
    compact
        .windows(br#""tool_name":"Write""#.len())
        .any(|window| window == br#""tool_name":"Write""#)
        || compact
            .windows(br#""tool_name":"Edit""#.len())
            .any(|window| window == br#""tool_name":"Edit""#)
}

fn write_denial(reason: impl Into<String>) -> ExitCode {
    let output = Output {
        hook_specific_output: HookOutput {
            hook_event_name: "PreToolUse",
            permission_decision: "deny",
            permission_decision_reason: reason.into(),
        },
    };
    let mut stdout = std::io::stdout().lock();
    if serde_json::to_writer(&mut stdout, &output).is_err()
        || stdout.write_all(b"\n").is_err()
        || stdout.flush().is_err()
    {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}

fn resolve_target(cwd: &str, target: &str) -> Result<PathBuf, String> {
    validate_text(cwd, "cwd")?;
    validate_text(target, "target")?;
    let cwd = Path::new(cwd);
    if !cwd.is_absolute() {
        return Err("Write/Edit cwd must be an absolute path".into());
    }
    let cwd = std::fs::canonicalize(cwd)
        .map_err(|error| format!("cannot resolve Write/Edit cwd: {error}"))?;
    if !cwd.is_dir() {
        return Err("Write/Edit cwd is not a directory".into());
    }
    let portable = target.replace('\\', "/");
    if portable.starts_with("//") || portable.as_bytes().get(1).is_some_and(|byte| *byte == b':') {
        return Err("Write/Edit target uses an ambiguous path prefix".into());
    }
    let supplied = Path::new(&portable);
    let joined = if supplied.is_absolute() {
        supplied.to_path_buf()
    } else {
        cwd.join(supplied)
    };
    let normalized = lexical_normalize(&joined)?;
    resolve_existing_prefix(&normalized)
}

fn validate_text(value: &str, name: &str) -> Result<(), String> {
    if value.is_empty() || value.chars().any(char::is_control) {
        return Err(format!(
            "Write/Edit {name} is empty or contains control bytes"
        ));
    }
    Ok(())
}

fn lexical_normalize(path: &Path) -> Result<PathBuf, String> {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(_) => {
                return Err("Write/Edit target has an unsupported path prefix".into());
            }
            Component::RootDir => normalized.push(Path::new("/")),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err("Write/Edit target escapes the filesystem root".into());
                }
            }
            Component::Normal(value) => normalized.push(value),
        }
    }
    if !normalized.is_absolute() {
        return Err("Write/Edit target did not resolve to an absolute path".into());
    }
    Ok(normalized)
}

fn resolve_existing_prefix(path: &Path) -> Result<PathBuf, String> {
    let mut cursor = path.to_path_buf();
    let mut missing = Vec::<OsString>::new();
    loop {
        match std::fs::symlink_metadata(&cursor) {
            Ok(metadata) => {
                if !missing.is_empty() && !metadata.is_dir() {
                    return Err("Write/Edit target has a non-directory parent".into());
                }
                let mut resolved = std::fs::canonicalize(&cursor)
                    .map_err(|error| format!("cannot resolve Write/Edit target: {error}"))?;
                for component in missing.iter().rev() {
                    resolved.push(component);
                }
                return Ok(resolved);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let name = cursor
                    .file_name()
                    .ok_or_else(|| "Write/Edit target has no resolvable ancestor".to_owned())?;
                missing.push(name.to_os_string());
                cursor = cursor
                    .parent()
                    .ok_or_else(|| "Write/Edit target escapes its root".to_owned())?
                    .to_path_buf();
            }
            Err(error) => {
                return Err(format!("cannot inspect Write/Edit target safely: {error}"));
            }
        }
    }
}

fn protected_target(target: &Path) -> Result<bool, String> {
    let components = target
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => {
                Some(value.to_str().map(str::to_owned).ok_or_else(|| {
                    "Write/Edit target contains a non-UTF-8 path component".to_owned()
                }))
            }
            _ => None,
        })
        .collect::<Result<Vec<_>, _>>()?;
    for index in components
        .iter()
        .enumerate()
        .filter_map(|(index, value)| (value == ".planning").then_some(index))
    {
        let suffix = &components[index + 1..];
        if matches!(suffix, [file] if matches!(file.as_str(), "state.json" | "decisions.jsonl" | "items.jsonl"))
            || matches!(suffix, [phases, number, summary]
                if phases == "phases"
                    && summary == "SUMMARY.md"
                    && positive_integer(number))
        {
            return Ok(true);
        }
    }
    Ok(false)
}

fn positive_integer(value: &str) -> bool {
    !value.is_empty()
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && value.bytes().any(|byte| byte != b'0')
}
