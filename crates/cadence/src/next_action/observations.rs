//! Synchronous routing reads, deliberately outside the lifecycle capture/key.
use crate::derivation::{
    ArtifactFiles, ArtifactIo, Cycle, DerivationError, Lifecycle, Observation, PhaseId,
};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Report {
    pub path: PathBuf,
    pub bytes: Observation<Vec<u8>>,
}

impl Report {
    pub fn complete(&self) -> bool {
        match &self.bytes {
            Observation::Present(bytes) => {
                String::from_utf8_lossy(bytes)
                    .split('\n')
                    .next()
                    .unwrap_or("")
                    .trim_matches(space)
                    == "PLAN COMPLETE"
            }
            _ => false,
        }
    }
}

fn space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct QueueMember {
    pub path: PathBuf,
    pub phase: String,
    pub trigger: String,
    pub discriminator: String,
    pub round: u64,
    pub findings: usize,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Queue {
    pub members: Vec<QueueMember>,
    pub unreadable: Vec<PathBuf>,
}
impl Queue {
    pub fn needs_triage(&self) -> bool {
        !self.unreadable.is_empty() || self.members.iter().any(|m| m.findings != 0)
    }
}

/// Modern queue identity comes from the saved all-home index, independently of
/// historical filename/sibling filtering in `queue`.
pub fn include_reviews(queue: &mut Queue, members: Vec<QueueMember>, unreadable: Vec<PathBuf>) {
    queue.members.extend(members);
    queue.unreadable.extend(unreadable);
    queue.unreadable.sort();
    queue.unreadable.dedup();
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Observations {
    pub reports: Vec<(PhaseId, Vec<Report>)>,
    pub queue: Queue,
    pub residue: Vec<String>,
}

impl Observations {
    pub fn outstanding(&self, phase: PhaseId) -> bool {
        self.reports
            .iter()
            .any(|(id, reports)| *id == phase && reports.iter().any(|r| !r.complete()))
    }
}

fn legal_phase(name: &str) -> bool {
    let mut parts = name.split('.');
    let legal = |p: &str| {
        p.starts_with(|c: char| ('1'..='9').contains(&c)) && p.bytes().all(|b| b.is_ascii_digit())
    };
    legal(parts.next().unwrap_or("")) && parts.next().is_none_or(legal) && parts.next().is_none()
}

fn queue_member(path: PathBuf, phase: &str, name: &str, value: Value) -> Option<QueueMember> {
    let string = |key| {
        value
            .get(key)?
            .as_str()
            .filter(|s| !s.trim_matches(space).is_empty())
    };
    let claimed = string("phase")?;
    let trigger = string("trigger")?;
    let discriminator = string("discriminator")?;
    let round = value.get("round")?.as_f64()?;
    if !(1.0..=9_007_199_254_740_991.0).contains(&round) || round.fract() != 0.0 {
        return None;
    }
    let round = round as u64;
    let suffix = if round > 1 {
        format!("-r{round}")
    } else {
        String::new()
    };
    if claimed != phase || name != format!("DEFERRED-{trigger}-{discriminator}{suffix}.json") {
        return None;
    }
    Some(QueueMember {
        path,
        phase: claimed.into(),
        trigger: trigger.into(),
        discriminator: discriminator.into(),
        round,
        findings: value.get("findings")?.as_array()?.len(),
    })
}

fn queue(root: &Path) -> Queue {
    let mut queue = Queue::default();
    for home in ["phases", "deferred"] {
        let entries = match fs::read_dir(root.join(home)) {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => {
                queue.unreadable.push(home.into());
                continue;
            }
        };
        for entry in entries {
            let Ok(entry) = entry else {
                queue.unreadable.push(home.into());
                continue;
            };
            let phase = entry.file_name().to_string_lossy().into_owned();
            let rel = Path::new(home).join(&phase);
            match entry.file_type() {
                Ok(t) if t.is_symlink() => {
                    queue.unreadable.push(rel);
                    continue;
                }
                Ok(t) if !t.is_dir() => continue,
                Err(_) => {
                    queue.unreadable.push(rel);
                    continue;
                }
                _ => {}
            }
            let names = match fs::read_dir(entry.path()) {
                Ok(names) => names,
                Err(_) => {
                    queue.unreadable.push(rel);
                    continue;
                }
            };
            for file in names {
                let Ok(file) = file else {
                    queue.unreadable.push(rel.clone());
                    continue;
                };
                let name = file.file_name().to_string_lossy().into_owned();
                if !name.starts_with("DEFERRED-")
                    || !name.ends_with(".json")
                    || name.len() <= "DEFERRED-.json".len()
                {
                    continue;
                }
                let path = rel.join(&name);
                let member = (|| {
                    if !file.file_type().ok()?.is_file() {
                        return None;
                    }
                    let Observation::Present(bytes) = ArtifactFiles.read(&file.path()) else {
                        return None;
                    };
                    queue_member(
                        path.clone(),
                        &phase,
                        &name,
                        serde_json::from_slice(&bytes).ok()?,
                    )
                })();
                let Some(member) = member else {
                    queue.unreadable.push(path);
                    continue;
                };
                let sibling = entry
                    .path()
                    .join(name.replacen("DEFERRED-", "ADJUDICATION-", 1));
                if fs::symlink_metadata(sibling).is_ok_and(|m| m.is_file()) {
                    continue;
                }
                queue.members.push(member);
            }
        }
    }
    queue.members.sort_by(|a, b| a.path.cmp(&b.path));
    queue.unreadable.sort();
    queue
}

pub fn capture(selected: &Path, lifecycle: &Lifecycle) -> Result<Observations, DerivationError> {
    let root = ArtifactFiles
        .resolve_root(selected)
        .map_err(DerivationError::InputFailure)?;
    let reports = lifecycle
        .phases
        .iter()
        .map(|phase| {
            let reports = phase
                .plans
                .iter()
                .map(|plan| {
                    let digits = plan
                        .strip_prefix("PLAN-")
                        .and_then(|p| p.strip_suffix(".md"))
                        .unwrap_or("1");
                    let number = PhaseId(digits.parse::<f64>().unwrap_or(f64::INFINITY));
                    let path = PathBuf::from(format!(
                        "phases/{}/reports/plan-{}.md",
                        phase.id.address(),
                        number.address()
                    ));
                    let bytes = ArtifactFiles.read(&root.join(&path));
                    Report { path, bytes }
                })
                .collect();
            (phase.id, reports)
        })
        .collect();
    let mut residue = Vec::new();
    if lifecycle.cycle == Cycle::Closed
        && let Ok(entries) = fs::read_dir(root.join("phases"))
    {
        residue = entries
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| legal_phase(n))
            .collect();
        residue.sort_by(|a, b| {
            a.parse::<f64>()
                .unwrap_or(f64::INFINITY)
                .total_cmp(&b.parse::<f64>().unwrap_or(f64::INFINITY))
                .then_with(|| a.cmp(b))
        });
    }
    Ok(Observations {
        reports,
        queue: queue(&root),
        residue,
    })
}
