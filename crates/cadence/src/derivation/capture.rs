use super::*;
use std::fs;
use std::io::{self, Read};
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Component, Path, PathBuf};

/// Read-only evidence boundary. Operations never create the selected root.
pub trait ArtifactIo {
    fn resolve_root(&mut self, selected: &Path) -> Result<PathBuf, InputFailure>;
    fn probe_root(&mut self, root: &Path) -> Observation<()>;
    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>>;
    fn probe_summary(&mut self, path: &Path) -> Observation<()>;
    fn read(&mut self, path: &Path) -> Observation<Vec<u8>>;
}

#[derive(Default)]
pub struct ArtifactFiles;

fn failure(path: &Path, error: io::Error) -> InputFailure {
    let category = match error.raw_os_error() {
        Some(libc::ELOOP) => InputFailureCategory::SymlinkLoop,
        Some(libc::ENAMETOOLONG) => InputFailureCategory::InvalidPath,
        _ => match error.kind() {
            io::ErrorKind::PermissionDenied => InputFailureCategory::PermissionDenied,
            io::ErrorKind::NotADirectory => InputFailureCategory::NotDirectory,
            io::ErrorKind::InvalidInput => InputFailureCategory::InvalidPath,
            _ => InputFailureCategory::OtherIo,
        },
    };
    InputFailure {
        path: path.into(),
        category,
        diagnostic: Some(error.to_string()),
    }
}

fn observation<T>(path: &Path, result: io::Result<T>) -> Observation<T> {
    match result {
        Ok(value) => Observation::Present(value),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Observation::Absent,
        Err(error) => Observation::Failed(failure(path, error)),
    }
}

impl ArtifactIo for ArtifactFiles {
    fn resolve_root(&mut self, selected: &Path) -> Result<PathBuf, InputFailure> {
        let absolute = if selected.is_absolute() {
            selected.to_owned()
        } else {
            std::env::current_dir()
                .map_err(|e| failure(selected, e))?
                .join(selected)
        };
        let mut normalized = PathBuf::new();
        for component in absolute.components() {
            match component {
                Component::CurDir => {}
                Component::ParentDir => {
                    normalized.pop();
                }
                component => normalized.push(component.as_os_str()),
            }
        }
        Ok(normalized)
    }

    fn probe_root(&mut self, root: &Path) -> Observation<()> {
        observation(
            root,
            fs::metadata(root).and_then(|m| {
                if m.is_dir() {
                    Ok(())
                } else {
                    Err(io::Error::from(io::ErrorKind::NotADirectory))
                }
            }),
        )
    }

    fn list_phase(&mut self, path: &Path) -> Observation<Vec<String>> {
        observation(
            path,
            fs::read_dir(path).and_then(|entries| {
                entries
                    .map(|entry| entry.map(|e| e.file_name().to_string_lossy().into_owned()))
                    .collect()
            }),
        )
    }

    fn probe_summary(&mut self, path: &Path) -> Observation<()> {
        observation(path, fs::metadata(path).map(|_| ()))
    }

    fn read(&mut self, path: &Path) -> Observation<Vec<u8>> {
        observation(
            path,
            (|| {
                // Nonblocking open also prevents a replacement FIFO from waiting
                // for a writer between the observation and the read.
                let mut file = fs::OpenOptions::new()
                    .read(true)
                    .custom_flags(libc::O_NONBLOCK)
                    .open(path)?;
                if !file.metadata()?.is_file() {
                    return Err(io::Error::other("artifact is not a regular readable file"));
                }
                let mut bytes = Vec::new();
                file.read_to_end(&mut bytes)?;
                Ok(bytes)
            })(),
        )
    }
}

fn admitted(name: &str) -> bool {
    name == "PLAN.md"
        || name
            .strip_prefix("PLAN-")
            .and_then(|n| n.strip_suffix(".md"))
            .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}

pub fn capture_inputs(
    selected: &Path,
    io: &mut (impl ArtifactIo + ?Sized),
) -> Result<CapturedInputs, DerivationError> {
    let root = io
        .resolve_root(selected)
        .map_err(DerivationError::InputFailure)?;
    let root_probe = io.probe_root(&root);
    let roadmap = if matches!(root_probe, Observation::Present(())) {
        io.read(&root.join("ROADMAP.md"))
    } else {
        Observation::Absent
    };
    let declarations = match &roadmap {
        Observation::Present(bytes) => Some(parse_roadmap(&String::from_utf8_lossy(bytes))),
        _ => None,
    };
    let mut phases: Vec<PhaseObservation> = Vec::new();
    if let Some(Ok(parsed)) = &declarations {
        for phase in &parsed.phases {
            if phases
                .iter()
                .any(|p| p.relative_path == phase.relative_path)
            {
                continue;
            }
            let path = root.join(&phase.relative_path);
            let plans = match io.list_phase(&path) {
                Observation::Present(names) => {
                    let mut names: Vec<_> = names.into_iter().filter(|n| admitted(n)).collect();
                    names.sort();
                    Observation::Present(names)
                }
                other => other,
            };
            phases.push(PhaseObservation {
                relative_path: phase.relative_path.clone(),
                plans,
                summary: io.probe_summary(&path.join("SUMMARY.md")),
                uat: io.read(&path.join("UAT.md")),
            });
        }
    }
    Ok(CapturedInputs {
        root,
        root_probe,
        roadmap,
        declarations,
        phases,
    })
}
