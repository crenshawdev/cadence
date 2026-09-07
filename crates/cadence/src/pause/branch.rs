//! Pause-local branch policy. Observations and decisions remain separate.
use super::git;
use crate::{
    evidence::gates::{Gate, OptionChoice, Purpose, State},
    store::{Error, Result},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::Path,
    process::{Command, Stdio},
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Policy {
    pub protected: Vec<String>,
    pub on_protected: String,
    pub base: Option<String>,
    pub integration: String,
    pub auto_branch: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Observed {
    pub branch: String,
    pub head: String,
    pub branches: BTreeMap<String, String>,
    pub tags: Vec<String>,
    pub base: Option<String>,
    pub shared_history: bool,
    pub project: String,
    pub roadmap: String,
}

fn text(bytes: Vec<u8>) -> Result<String> {
    String::from_utf8(bytes).map_err(|_| Error::Invalid("branch policy input is not UTF-8".into()))
}
fn document(path: &Path) -> Result<String> {
    match std::fs::read_to_string(path) {
        Ok(value) => Ok(value),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.into()),
    }
}

pub fn observe(root: &Path, planning: &Path, policy: &Policy) -> Result<Observed> {
    let branch = text(git::run(root, ["branch", "--show-current"])?)?
        .trim_end_matches('\n')
        .into();
    let head = text(git::run(root, ["rev-parse", "--verify", "HEAD"])?)?
        .trim_end_matches('\n')
        .to_owned();
    let refs = text(git::run(
        root,
        [
            "for-each-ref",
            "--format=%(refname) %(objectname)",
            "refs/heads/",
        ],
    )?)?;
    let branches: BTreeMap<String, String> = refs
        .lines()
        .map(|line| {
            let (name, sha) = line
                .split_once(' ')
                .ok_or_else(|| Error::Invalid("invalid branch observation".into()))?;
            Ok((
                name.strip_prefix("refs/heads/").unwrap_or(name).into(),
                sha.into(),
            ))
        })
        .collect::<Result<_>>()?;
    let base = match &policy.base {
        Some(name) => branches.contains_key(name).then(|| name.clone()),
        None => policy
            .protected
            .iter()
            .find(|name| branches.contains_key(*name))
            .cloned(),
    };
    let shared_history = if let Some(base) = &base {
        let output = Command::new("git")
            .current_dir(root)
            .args(["merge-base", branches[base].as_str(), head.as_str()])
            .stdin(Stdio::null())
            .output()?;
        match output.status.code() {
            Some(0) => !output.stdout.is_empty(),
            Some(1) => false,
            _ => {
                return Err(Error::Invalid(format!(
                    "merge-base failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }
        }
    } else {
        false
    };
    Ok(Observed {
        branch,
        head,
        branches,
        base,
        shared_history,
        tags: text(git::run(root, ["tag", "--list"])?)?
            .lines()
            .map(str::to_owned)
            .collect(),
        project: document(&planning.join("PROJECT.md"))?,
        roadmap: document(&planning.join("ROADMAP.md"))?,
    })
}

pub fn question(
    kind: &str,
    need: &str,
    options: &[(&str, &str)],
    policy: &Policy,
    observed: &Observed,
) -> Result<Gate> {
    let identity = crate::store::model::digest(&serde_json::to_vec(&(kind, policy, observed))?);
    Ok(Gate {
        id: format!("pause-{kind}-{identity}"),
        purpose: Purpose::Decision,
        checkpoint_id: None,
        question: need.into(),
        need: need.into(),
        options: options
            .iter()
            .map(|(id, text)| OptionChoice {
                id: (*id).into(),
                text: (*text).into(),
            })
            .collect(),
        state: State::Unanswered,
    })
}

pub fn protected(policy: &Policy, observed: &Observed) -> Result<Option<Gate>> {
    if !policy.protected.contains(&observed.branch) {
        return Ok(None);
    }
    match policy.on_protected.as_str() {
        "allow" => Ok(None),
        "refuse" => Err(Error::Policy("pause refused on protected branch".into())),
        "ask" => question(
            "protected",
            "Pause on a protected branch: create a work branch, proceed here, or abort?",
            &[
                ("create", "Create and switch to a work branch"),
                ("proceed", "Proceed on this branch"),
                ("abort", "Abort"),
            ],
            policy,
            observed,
        )
        .map(Some),
        _ => Err(Error::Policy("invalid protected-branch policy".into())),
    }
}

pub fn base(policy: &Policy, observed: &Observed) -> Result<Vec<Gate>> {
    let mut questions = Vec::new();
    if observed.branch.is_empty() {
        questions.push(question(
            "detached",
            "HEAD is detached. Create a work branch, proceed detached, or abort?",
            &[
                ("create", "Create a work branch"),
                ("proceed", "Proceed detached"),
                ("abort", "Abort"),
            ],
            policy,
            observed,
        )?);
    }
    let missing = policy.base.is_some() && observed.base.is_none();
    let need = if missing {
        Some((
            "missing-base",
            "Configured base does not resolve as a local branch. Correct configuration, proceed explicitly, or abort?",
        ))
    } else if observed.base.is_none() {
        Some((
            "unknown-base",
            "No base branch resolves. Set the base configuration, proceed explicitly, or abort?",
        ))
    } else if !observed.shared_history {
        Some((
            "unrelated-base",
            "HEAD and the base share no history. Proceed explicitly or abort?",
        ))
    } else {
        None
    };
    if let Some((kind, need)) = need {
        questions.push(question(
            kind,
            need,
            &[
                ("configure", "Correct the base configuration"),
                ("proceed", "Proceed explicitly"),
                ("abort", "Abort"),
            ],
            policy,
            observed,
        )?);
    }
    Ok(questions)
}

fn version(text: &str) -> Option<&str> {
    for (start, _) in text.match_indices('v') {
        let bytes = text.as_bytes();
        let mut end = start + 1;
        let mut valid = true;
        for component in 0..3 {
            let begin = end;
            while bytes.get(end).is_some_and(u8::is_ascii_digit) {
                end += 1;
            }
            if begin == end {
                valid = false;
                break;
            }
            if component < 2 {
                if bytes.get(end) != Some(&b'.') {
                    valid = false;
                    break;
                }
                end += 1;
            }
        }
        if !valid {
            continue;
        }
        if bytes.get(end) == Some(&b'-') {
            let begin = end;
            end += 1;
            while bytes
                .get(end)
                .is_some_and(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-'))
            {
                end += 1;
            }
            if end == begin + 1 {
                end = begin;
            }
        }
        return Some(&text[start..end]);
    }
    None
}

pub fn integration_name(project: &str, roadmap: &str) -> Option<String> {
    let lines: Vec<_> = project.lines().collect();
    let active = lines.iter().position(|line| {
        line.strip_prefix("###").is_some_and(|rest| {
            rest.starts_with(char::is_whitespace)
                && rest
                    .trim_start()
                    .strip_prefix("Active")
                    .is_some_and(|s| !s.starts_with(|c: char| c.is_alphanumeric() || c == '_'))
        })
    });
    let active = active.and_then(|start| {
        let body: Vec<_> = lines[start + 1..]
            .iter()
            .take_while(|line| {
                let count = line.chars().take_while(|c| *c == '#').count();
                !(1..=3).contains(&count) || !line[count..].starts_with(char::is_whitespace)
            })
            .copied()
            .collect();
        let loose = body.iter().find_map(|line| version(line));
        for (i, line) in body.iter().enumerate() {
            let stripped =
                line.trim_start_matches(|c: char| c.is_whitespace() || ">*_`-".contains(c));
            let candidate = version(stripped).filter(|v| stripped.starts_with(v));
            let opens = i == 0
                || body[i - 1].trim().is_empty()
                || body[i - 1]
                    .trim_end_matches(|c: char| c.is_whitespace() || "`*_)]\"'".contains(c))
                    .ends_with(['.', '!', '?']);
            if candidate.is_some() && (candidate == loose || opens) {
                return candidate.map(str::to_owned);
            }
        }
        loose.map(str::to_owned)
    });
    active
        .or_else(|| {
            roadmap
                .lines()
                .find(|l| {
                    l.strip_prefix('#')
                        .is_some_and(|r| r.starts_with(char::is_whitespace))
                })
                .and_then(version)
                .map(str::to_owned)
        })
        .map(|v| format!("cadence/{v}"))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Integration {
    Stay,
    Create(String),
    Ask(Box<Gate>, Option<String>),
}

pub fn integration(policy: &Policy, observed: &Observed) -> Result<Integration> {
    if policy.integration != "milestone"
        || !policy.protected.contains(&observed.branch)
        || !matches!(policy.auto_branch.as_str(), "auto" | "ask")
    {
        return Ok(Integration::Stay);
    }
    let name = integration_name(&observed.project, &observed.roadmap);
    let published =
        name.as_deref()
            .and_then(|name| name.strip_prefix("cadence/v"))
            .is_some_and(|version| {
                observed.tags.iter().any(|tag| {
                    tag.strip_prefix('v').unwrap_or(tag).split('+').next() == Some(version)
                })
            });
    if name.is_none() || published {
        let kind = if published {
            "published-version"
        } else {
            "missing-version"
        };
        let need = if published {
            "The milestone version is already published. Set the intended version, stay on the base, or abort?"
        } else {
            "No milestone version was found. Set the version, stay on the base, or abort?"
        };
        return Ok(Integration::Ask(
            Box::new(question(
                kind,
                need,
                &[
                    ("configure", "Set the milestone version"),
                    ("proceed", "Stay on the base"),
                    ("abort", "Abort"),
                ],
                policy,
                observed,
            )?),
            None,
        ));
    }
    if policy.auto_branch == "auto" {
        return Ok(Integration::Create(name.unwrap()));
    }
    Ok(Integration::Ask(
        Box::new(question(
            "integration",
            "Create the milestone integration branch, stay on the base, or abort?",
            &[
                ("create", "Create the named integration branch"),
                ("proceed", "Stay on the base"),
                ("abort", "Abort"),
            ],
            policy,
            observed,
        )?),
        name,
    ))
}
