//! File-ownership guard for host Write and Edit tool calls.
mod bash;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    ffi::OsString,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::ExitCode,
};

#[cfg(test)]
pub(crate) mod tests;

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

const CONFIG_DENIAL: &str =
    "Cadence owns this config destination; use cadence_apply config operations instead of Write/Edit";

/// What the filesystem answers about one path, asked one lookup at a time.
pub(crate) trait Lookup {
    /// As `std::fs::metadata`: follows a symlink.
    fn metadata(&self, path: &Path) -> std::io::Result<Entry>;
    /// As `std::fs::symlink_metadata`: whether anything, a symlink included, is at the path.
    fn present(&self, path: &Path) -> std::io::Result<()>;
    fn canonicalize(&self, path: &Path) -> std::io::Result<PathBuf>;
    /// As `std::path::absolute`: a relative path is taken from the process's directory.
    fn absolute(&self, path: &Path) -> std::io::Result<PathBuf>;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Entry {
    pub(crate) directory: bool,
    /// Device and inode: two paths with one identity are one file.
    pub(crate) identity: (u64, u64),
}

struct Disk;

impl Lookup for Disk {
    fn metadata(&self, path: &Path) -> std::io::Result<Entry> {
        use std::os::unix::fs::MetadataExt;
        std::fs::metadata(path).map(|metadata| Entry {
            directory: metadata.is_dir(),
            identity: (metadata.dev(), metadata.ino()),
        })
    }

    fn present(&self, path: &Path) -> std::io::Result<()> {
        std::fs::symlink_metadata(path).map(|_| ())
    }

    fn canonicalize(&self, path: &Path) -> std::io::Result<PathBuf> {
        std::fs::canonicalize(path)
    }

    fn absolute(&self, path: &Path) -> std::io::Result<PathBuf> {
        std::path::absolute(path)
    }
}

/// What the hook input asks of the guard, judged from its bytes alone.
enum Input {
    /// Not a Write/Edit event: the hook answers nothing.
    Silent,
    /// A Write/Edit event that cannot be read safely.
    Denied(String),
    Bash,
    WriteEdit(Event),
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
    match input(&bytes) {
        Input::Silent => ExitCode::SUCCESS,
        Input::Denied(reason) => write_denial(reason),
        Input::Bash => bash::run(&bytes, &mut cadence::process::System),
        Input::WriteEdit(event) => {
            let global = global_setting(
                std::env::var_os("CADENCE_GLOBAL_CONFIG"),
                std::env::var_os("HOME"),
            );
            match write_edit(&event, global.as_deref(), &Disk) {
                Ok(()) => ExitCode::SUCCESS,
                Err(reason) => write_denial(reason),
            }
        }
    }
}

/// `bytes` is the input read up to one byte past the bound.
fn input(bytes: &[u8]) -> Input {
    let matched = matched_tool(bytes);
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        return if matched {
            Input::Denied(format!(
                "Write/Edit hook input exceeds the {MAX_INPUT_BYTES}-byte bound"
            ))
        } else {
            Input::Silent
        };
    }
    let tool = match serde_json::from_slice::<ToolOnly>(bytes) {
        Ok(tool) => tool.tool_name.as_str().map(str::to_owned),
        Err(error) => {
            return if matched {
                Input::Denied(format!("malformed Write/Edit hook input: {error}"))
            } else {
                Input::Silent
            };
        }
    };
    if tool.as_deref() == Some("Bash") {
        return Input::Bash;
    }
    if !matches!(tool.as_deref(), Some("Write" | "Edit")) {
        return Input::Silent;
    }
    let event: Event = match serde_json::from_slice(bytes) {
        Ok(event) => event,
        Err(error) => return Input::Denied(format!("malformed Write/Edit hook input: {error}")),
    };
    if !matches!(event.tool_name.as_str(), "Write" | "Edit") {
        return Input::Denied("ambiguous Write/Edit tool identity".into());
    }
    if event
        .hook_event_name
        .as_deref()
        .is_some_and(|name| name != "PreToolUse")
    {
        return Input::Denied("Write/Edit event is not a PreToolUse event".into());
    }
    Input::WriteEdit(event)
}

/// The global legacy config path: the setting when present, else the default
/// under HOME. An empty setting turns the global layer off.
fn global_setting(setting: Option<OsString>, home: Option<OsString>) -> Option<PathBuf> {
    setting
        .map(PathBuf::from)
        .or_else(|| home.map(|home| PathBuf::from(home).join(".claude/cadence/config.json")))
        .filter(|path| !path.as_os_str().is_empty())
}

/// Allows the event, or answers why it is denied. Every failure to decide denies.
fn write_edit(event: &Event, global: Option<&Path>, fs: &dyn Lookup) -> Result<(), String> {
    let bindings = config_destinations(&event.cwd, global, fs)?;
    // Inspect native spelling first: a POSIX backslash can name a real alias.
    for spelling in [
        event.tool_input.file_path.clone(),
        event.tool_input.file_path.replace('\\', "/"),
    ] {
        let target = resolve_target(&event.cwd, &spelling, fs)?;
        for destination in &bindings {
            if same_destination(&target, destination, fs)? {
                return Err(CONFIG_DENIAL.into());
            }
        }
        if protected_target(&target)? {
            return Err(format!(
                "Cadence owns {}; use the native execution boundary instead of Write/Edit",
                target.display()
            ));
        }
    }
    Ok(())
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
    write_decision("deny", reason)
}

fn write_decision(decision: &'static str, reason: impl Into<String>) -> ExitCode {
    let output = Output {
        hook_specific_output: HookOutput {
            hook_event_name: "PreToolUse",
            permission_decision: decision,
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

fn resolve_target(cwd: &str, target: &str, fs: &dyn Lookup) -> Result<PathBuf, String> {
    validate_text(cwd, "cwd")?;
    validate_text(target, "target")?;
    let cwd = Path::new(cwd);
    if !cwd.is_absolute() {
        return Err("Write/Edit cwd must be an absolute path".into());
    }
    let cwd = fs
        .canonicalize(cwd)
        .map_err(|error| format!("cannot resolve Write/Edit cwd: {error}"))?;
    if !fs.metadata(&cwd).is_ok_and(|entry| entry.directory) {
        return Err("Write/Edit cwd is not a directory".into());
    }
    if target.starts_with("//") || target.as_bytes().get(1).is_some_and(|byte| *byte == b':') {
        return Err("Write/Edit target uses an ambiguous path prefix".into());
    }
    let supplied = Path::new(target);
    let joined = if supplied.is_absolute() {
        supplied.to_path_buf()
    } else {
        cwd.join(supplied)
    };
    resolve_existing_prefix(&joined, fs)
}

fn validate_text(value: &str, name: &str) -> Result<(), String> {
    if value.is_empty() || value.chars().any(char::is_control) {
        return Err(format!(
            "Write/Edit {name} is empty or contains control bytes"
        ));
    }
    Ok(())
}

fn resolve_existing_prefix(path: &Path, fs: &dyn Lookup) -> Result<PathBuf, String> {
    let mut resolved = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(_) => {
                return Err("Write/Edit target has an unsupported path prefix".into());
            }
            Component::RootDir => resolved.push("/"),
            Component::CurDir => {}
            Component::ParentDir => {
                if !resolved.pop() {
                    return Err("Write/Edit target escapes the filesystem root".into());
                }
            }
            Component::Normal(value) => {
                match fs.metadata(&resolved) {
                    Ok(entry) if !entry.directory => {
                        return Err("Write/Edit target has a non-directory parent".into());
                    }
                    Ok(_) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => {
                        return Err(format!("cannot inspect Write/Edit parent safely: {error}"));
                    }
                }
                resolved.push(value);
                match fs.present(&resolved) {
                    Ok(()) => {
                        resolved = fs
                            .canonicalize(&resolved)
                            .map_err(|error| format!("cannot resolve Write/Edit target: {error}"))?
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => {
                        return Err(format!("cannot inspect Write/Edit target safely: {error}"));
                    }
                }
            }
        }
    }
    Ok(resolved)
}

fn config_destinations(
    cwd: &str,
    global: Option<&Path>,
    fs: &dyn Lookup,
) -> Result<Vec<PathBuf>, String> {
    let repo = resolve_target(cwd, ".planning/config.json", fs)?;
    let mut legacy = vec![repo];
    if let Some(global) = global {
        let absolute = fs.absolute(global).map_err(|error| error.to_string())?;
        legacy.push(resolve_existing_prefix(&absolute, fs)?);
    }
    legacy
        .into_iter()
        .map(|path| resolve_existing_prefix(&path.with_file_name("config.v4.json"), fs))
        .collect()
}

fn same_destination(target: &Path, destination: &Path, fs: &dyn Lookup) -> Result<bool, String> {
    if target == destination {
        return Ok(true);
    }
    let identity = |path| match fs.metadata(path) {
        Ok(entry) => Ok(Some(entry.identity)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("cannot inspect config destination safely: {error}")),
    };
    Ok(match (identity(target)?, identity(destination)?) {
        (Some(left), Some(right)) => left == right,
        _ => false,
    })
}

fn protected_target(target: &Path) -> Result<bool, String> {
    if cadence::execution::render::RENDERED_PROJECT_FILES
        .iter()
        .any(|rendered| target.ends_with(rendered.path))
    {
        return Ok(true);
    }
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
        // SUMMARY.md is the execution projection; UAT.md is the binary's render
        // of attributed human results (D-127). Both are exact owned outputs,
        // never a claim over arbitrary shell writes.
        if matches!(suffix, [file] if matches!(file.as_str(), "state.json" | "decisions.jsonl" | "items.jsonl"))
            || matches!(suffix, [directory, file] if directory == "debug" && file.ends_with(".md"))
            || matches!(suffix, [directory, ..] if directory == "spikes")
            || matches!(suffix, [tasks, slug, ..] if tasks == "tasks" && !slug.is_empty())
            || matches!(suffix, [phases, number, owned]
                if phases == "phases"
                    && matches!(owned.as_str(), "SUMMARY.md" | "UAT.md")
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
