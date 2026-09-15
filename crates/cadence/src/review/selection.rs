//! Selection over saved admission and observations; no reviewer transport.
//! The second half selects the owner's explicit review target (D-133): one
//! kind, one exactly resolved target, never a widening to a parent or a tree.
use super::contract::{ReturnClassification, classify_return};
use super::io::{MaterialIo, NodeKind};
use super::model::{AttemptState, Selection, Target, Usage};
use super::targets::DecisionMaterial;
use cadence::store::model::digest;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;

/// Supplied terminal bytes are classified by the frozen H4-1 validator.
/// Absence of a record means unattempted; absence of bytes on an accepted
/// observation is a failed return, never an empty successful review.
#[derive(Clone, Debug, Deserialize)]
pub struct AttemptOutcome {
    pub attempt: String,
    pub state: AttemptState,
    pub raw: Option<String>,
    pub usage: Option<Usage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Completion {
    Incomplete,
    UsableComplete,
    CompleteWithFailure,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NextSelection {
    pub request: Option<String>,
    pub not_selected: Vec<String>,
    pub state: Completion,
}

fn outcome(attempt: &AttemptOutcome) -> Completion {
    match attempt.state {
        AttemptState::Accepted => {
            match classify_return(attempt.raw.as_deref().map(str::as_bytes)) {
                ReturnClassification::Usable { .. } => Completion::UsableComplete,
                ReturnClassification::Failed { .. } => Completion::CompleteWithFailure,
            }
        }
        AttemptState::Failed => Completion::CompleteWithFailure,
        _ => Completion::Incomplete,
    }
}

/// FIRST visits the admitted order, requesting at most one unattempted choice.
/// A running/interrupted/uncertain attempt waits for recovery, not redispatch.
/// The fallback is checked against its saved outcome just like any other work.
pub fn select_next(
    selection: &Selection,
    attempts: &BTreeMap<String, AttemptOutcome>,
) -> NextSelection {
    let mut next = NextSelection {
        request: None,
        not_selected: vec![],
        state: Completion::Incomplete,
    };
    for (index, choice) in selection.choices.iter().enumerate() {
        let Some(attempt) = attempts.get(choice) else {
            next.request = Some(choice.clone());
            return next;
        };
        match outcome(attempt) {
            Completion::UsableComplete => {
                next.not_selected = selection.choices[index + 1..].to_vec();
                next.state = Completion::UsableComplete;
                return next;
            }
            Completion::Incomplete => return next,
            Completion::CompleteWithFailure => {}
        }
    }
    next.state = match &selection.fallback {
        Some(fallback) => match attempts.get(fallback) {
            Some(attempt) => outcome(attempt),
            None => {
                next.request = Some(fallback.clone());
                Completion::Incomplete
            }
        },
        None => Completion::CompleteWithFailure,
    };
    next
}

/// Failure does not erase spent usage. No observation means explicit unknowns.
pub fn attempt_usage(attempt: &AttemptOutcome) -> Usage {
    attempt.usage.clone().unwrap_or(Usage {
        input: None,
        output: None,
        cost: None,
        currency: None,
    })
}

use super::model::{CompletionRule, SelectionMode};

#[derive(Clone, Debug, Deserialize)]
pub struct RequiredSlot {
    pub voice: String,
    pub fallback: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct PanelAdmission {
    pub combination: SelectionMode,
    pub slots: Vec<RequiredSlot>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DispatchRoster {
    pub required_requests: Vec<String>,
    pub fallbacks: BTreeMap<String, Option<String>>,
    pub completion: CompletionRule,
}

/// Both panel and adjudicated delivery freeze the complete supplied roster.
/// Combination affects later interpretation, never which required slots remain.
pub fn dispatch_roster(admission: &PanelAdmission) -> DispatchRoster {
    DispatchRoster {
        required_requests: admission
            .slots
            .iter()
            .map(|slot| slot.voice.clone())
            .collect(),
        fallbacks: admission
            .slots
            .iter()
            .map(|slot| (slot.voice.clone(), slot.fallback.clone()))
            .collect(),
        completion: CompletionRule::AllRequiredTerminal,
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct SlotOutcome {
    pub primary: AttemptOutcome,
    pub fallback: Option<AttemptOutcome>,
}

/// Missing, running or interrupted required work keeps delivery incomplete.
/// Failure is terminal only after the slot's admitted fallback is exhausted.
pub fn delivery_completion(
    roster: &DispatchRoster,
    slots: &BTreeMap<String, SlotOutcome>,
) -> Completion {
    let mut completion = Completion::UsableComplete;
    for voice in &roster.required_requests {
        let Some(slot) = slots.get(voice) else {
            return Completion::Incomplete;
        };
        let mut state = outcome(&slot.primary);
        if state == Completion::CompleteWithFailure {
            let Some(fallback_rule) = roster.fallbacks.get(voice) else {
                // An absent rule is unknown, not an admitted no-fallback rule.
                return Completion::Incomplete;
            };
            if fallback_rule.is_some() {
                state = slot
                    .fallback
                    .as_ref()
                    .map(outcome)
                    .unwrap_or(Completion::Incomplete);
            }
        }
        match state {
            Completion::Incomplete => return Completion::Incomplete,
            Completion::CompleteWithFailure => completion = Completion::CompleteWithFailure,
            Completion::UsableComplete => {}
        }
    }
    completion
}

// ---------------------------------------------------------------------------
// Explicit target selection (D-133). Pure over the supplied file boundary and
// the snapshot; the service turns the result into an admission request.
// ---------------------------------------------------------------------------

pub const CANONICAL: &str = "cad-review";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    Decision,
    Minimalism,
    Plan,
}

impl Kind {
    pub fn alias(self) -> &'static str {
        match self {
            Kind::Decision => "cad-decision-review",
            Kind::Minimalism => "cad-minimalism-review",
            Kind::Plan => "cad-plan-review",
        }
    }
    fn hint(self) -> &'static str {
        match self {
            Kind::Decision => "<document> <decision-id>",
            Kind::Minimalism => "<file|directory|phase>",
            Kind::Plan => "<phase|plan-path>",
        }
    }
    fn parse(token: &str) -> Option<Self> {
        match token {
            "decision" => Some(Kind::Decision),
            "minimalism" => Some(Kind::Minimalism),
            "plan" => Some(Kind::Plan),
            _ => None,
        }
    }
}

/// A selection that stops: the code names the failure class and the reason
/// names exactly what the caller must supply or disambiguate.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Refusal {
    pub code: &'static str,
    pub reason: String,
}

fn required(kind: Kind, missing: &str) -> Refusal {
    Refusal { code: "review-target-required", reason: format!("{} needs {}; supply {missing}", kind.alias().trim_start_matches("cad-").trim_end_matches("-review"), kind.hint()) }
}
fn ambiguous(reason: String) -> Refusal {
    Refusal { code: "review-target-ambiguous", reason }
}
fn unresolvable(reason: String) -> Refusal {
    Refusal { code: "review-target-unresolvable", reason }
}

/// One retained source: where it came from, its one-based line span and digest.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Material {
    pub label: String,
    pub path: String,
    pub lines: [u64; 2],
    pub digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Selected {
    pub kind: Kind,
    pub target: Target,
    pub decision: Option<DecisionMaterial>,
    /// The document binding a decision selection carries into admission.
    pub selection: Option<Value>,
    pub material: Vec<Material>,
    pub phase: Option<u32>,
    /// Digest of the resolved kind, target and material identities.
    pub discriminator: String,
}

/// `cad-review <kind> <target...>` or an alias that implies its kind.
pub fn command_kind(command: &str, arguments: &[String]) -> Result<(Kind, Vec<String>), Refusal> {
    if command == CANONICAL {
        let Some(first) = arguments.first() else {
            return Err(Refusal { code: "review-kind-required", reason: "cad-review needs a kind first: decision, minimalism or plan".into() });
        };
        let Some(kind) = Kind::parse(first) else {
            return Err(Refusal { code: "review-kind-unknown", reason: format!("{first} is not a review kind; use decision, minimalism or plan") });
        };
        return Ok((kind, arguments[1..].to_vec()));
    }
    for kind in [Kind::Decision, Kind::Minimalism, Kind::Plan] {
        if command == kind.alias() {
            return Ok((kind, arguments.to_vec()));
        }
    }
    Err(Refusal { code: "review-command-unknown", reason: format!("{command} is not a review command; use cad-review or one of its aliases cad-decision-review, cad-minimalism-review, cad-plan-review") })
}

fn line_count(bytes: &[u8]) -> u64 {
    bytes.split_inclusive(|b| *b == b'\n').count() as u64
}

fn material(label: &str, path: &str, bytes: &[u8]) -> Material {
    Material { label: label.into(), path: path.into(), lines: [1, line_count(bytes)], digest: digest(bytes) }
}

fn read_file(source: &mut impl MaterialIo, path: &str) -> Result<Option<Vec<u8>>, Refusal> {
    match source.read(path) {
        Ok(observed) => Ok(observed.bytes),
        Err(cadence::store::Error::Invalid(reason)) => Err(unresolvable(format!("{path}: {reason}"))),
        Err(error) => Err(unresolvable(format!("{path}: {error}"))),
    }
}

/// The exact bytes of one `- <id>` bullet and its indented continuation
/// lines, with the one-based line span. Two bullets with the id are ambiguous.
pub fn decision_lines(document: &[u8], id: &str) -> Result<([u64; 2], Vec<u8>), Refusal> {
    let lines: Vec<&[u8]> = document.split_inclusive(|b| *b == b'\n').collect();
    let heads: Vec<usize> = lines.iter().enumerate().filter(|(_, line)| {
        let Ok(text) = std::str::from_utf8(line) else { return false };
        let text = text.trim_start();
        let Some(rest) = text.strip_prefix("- ").or_else(|| text.strip_prefix("* ")) else { return false };
        let rest = rest.trim_start();
        let rest = rest.strip_prefix("**").unwrap_or(rest);
        let Some(after) = rest.strip_prefix(id) else { return false };
        matches!(after.chars().next(), None | Some('.' | ':' | '(' | ' ' | '*' | '\n' | '\r' | '\t'))
    }).map(|(index, _)| index).collect();
    match heads.as_slice() {
        [] => Err(unresolvable(format!("{id} is not a decision bullet in the document"))),
        [head] => {
            let mut end = *head;
            while end + 1 < lines.len() {
                let next = lines[end + 1];
                let text = std::str::from_utf8(next).unwrap_or_default();
                if text.trim().is_empty() || !text.starts_with([' ', '\t']) { break }
                end += 1;
            }
            Ok(([*head as u64 + 1, end as u64 + 1], lines[*head..=end].concat()))
        }
        many => Err(ambiguous(format!("{id} is declared more than once, at lines {}", many.iter().map(|i| (i + 1).to_string()).collect::<Vec<_>>().join(" and ")))),
    }
}

/// Every file under a directory, as sorted paths relative to it; symlinks and
/// special nodes refuse instead of being silently skipped.
fn directory_members(source: &mut impl MaterialIo, path: &str) -> Result<Vec<String>, Refusal> {
    let mut pending = vec![String::new()];
    let mut files = std::collections::BTreeSet::new();
    while let Some(relative) = pending.pop() {
        let full = if relative.is_empty() { path.to_owned() } else { format!("{path}/{relative}") };
        let observed = source.members(&full).map_err(|e| unresolvable(format!("{full}: {e}")))?;
        for member in observed.members {
            let child = if relative.is_empty() { member.name.clone() } else { format!("{relative}/{}", member.name) };
            match member.kind {
                NodeKind::File => { files.insert(child); }
                NodeKind::Directory => pending.push(child),
                NodeKind::Symlink | NodeKind::Special => return Err(unresolvable(format!("{full}/{}: unsupported directory node", member.name))),
            }
        }
    }
    Ok(files.into_iter().collect())
}

/// A phase's native committed range: the first task attempt's base commit to
/// the last closed task's completion commit. No history, no range.
pub fn phase_range(data: &Value, phase: u32) -> Result<(String, String), Refusal> {
    use cadence::execution::history::{self, Event};
    let records = history::records(data, phase).map_err(|e| unresolvable(format!("phase {phase}: {e}")))?;
    let base = records.iter().find_map(|r| match &r.request.event { Event::Attempt { base_commit, .. } => Some(base_commit.clone()), _ => None });
    let head = records.iter().rev().find_map(|r| match &r.request.event { Event::Close(proof) => Some(proof.submission.completion.clone()), _ => None });
    match (base, head) {
        (Some(base), Some(head)) => Ok((base, head)),
        _ => Err(unresolvable(format!("phase {phase} has no closed native execution to bound a committed range"))),
    }
}

/// The phase's approved locked context and every native plan slice, each as
/// its exact installed bytes; a missing or drifted projection refuses.
pub fn plan_material(data: &Value, phase: u32, source: &mut impl MaterialIo) -> Result<Vec<(String, String, Vec<u8>)>, Refusal> {
    let context = cadence::context::persistence::saved(data, phase).map_err(|e| unresolvable(e.to_string()))?
        .ok_or_else(|| unresolvable(format!("phase {phase} has no native approved context")))?;
    let occurrence = cadence::plan::persistence::saved(data, phase).map_err(|e| unresolvable(e.to_string()))?
        .filter(|o| !o.publications.is_empty())
        .ok_or_else(|| unresolvable(format!("phase {phase} has no native plan publication")))?;
    let mut entries = Vec::new();
    let context_path = format!(".planning/phases/{phase}/CONTEXT.md");
    let bytes = read_file(source, &context_path)?.ok_or_else(|| unresolvable(format!("{context_path} is absent")))?;
    if bytes != cadence::context::render::document(&context).into_bytes() {
        return Err(unresolvable(format!("{context_path} differs from the approved context")));
    }
    entries.push(("locked-context".to_owned(), context_path, bytes));
    for (number, publication) in &occurrence.publications {
        let path = format!(".planning/phases/{phase}/PLAN-{number}.md");
        let bytes = read_file(source, &path)?.ok_or_else(|| unresolvable(format!("{path} is absent")))?;
        if digest(&bytes) != publication.revision {
            return Err(unresolvable(format!("{path} differs from its native publication")));
        }
        entries.push(("plan".to_owned(), path, bytes));
    }
    Ok(entries)
}

fn phase_of_path(path: &str) -> Option<u32> {
    path.split('/').collect::<Vec<_>>().windows(2)
        .find(|pair| pair[0] == "phases")
        .and_then(|pair| pair[1].parse::<u32>().ok().filter(|n| *n > 0))
}

fn finish(kind: Kind, target: Target, decision: Option<DecisionMaterial>, selection: Option<Value>, material: Vec<Material>, phase: Option<u32>) -> Selected {
    let identity = json!({"kind":kind,"target":target,"material":material.iter().map(|m| (&m.label, &m.path, &m.digest)).collect::<Vec<_>>()});
    let discriminator = digest(&serde_json::to_vec(&identity).expect("selection identity"));
    Selected { kind, target, decision, selection, material, phase, discriminator }
}

/// Resolve one explicit selection against the real files and the snapshot.
pub fn select(command: &str, arguments: &[String], source: &mut impl MaterialIo, data: &Value) -> Result<Selected, Refusal> {
    let (kind, arguments) = command_kind(command, arguments)?;
    match kind {
        Kind::Decision => {
            let (document, id) = match arguments.as_slice() {
                [] => return Err(required(kind, "the document path and the decision id")),
                [_] => return Err(required(kind, "the decision id after the document: <decision-id>")),
                [document, id] => (document, id),
                _ => return Err(ambiguous("a decision selection names one document and one decision id; nothing else".into())),
            };
            let bytes = read_file(source, document)?.ok_or_else(|| unresolvable(format!("{document} does not exist")))?;
            let (lines, text) = decision_lines(&bytes, id)?;
            let text = String::from_utf8(text).map_err(|_| unresolvable(format!("{document}: {id} is not UTF-8 text")))?;
            let context = String::from_utf8(bytes.clone()).map_err(|_| unresolvable(format!("{document} is not UTF-8 text")))?;
            let selection = json!({"kind":"decision","document":document,"digest":digest(&bytes),"lines":lines});
            let material = vec![
                Material { label: "decision".into(), path: document.clone(), lines, digest: digest(text.as_bytes()) },
                material("context", document, &bytes),
            ];
            Ok(finish(kind, Target::Decision { selected: id.clone(), context_entries: vec![document.clone()] },
                Some(DecisionMaterial { decision: id.clone(), text, context }), Some(selection), material, phase_of_path(document)))
        }
        Kind::Minimalism => {
            let token = match arguments.as_slice() {
                [] => return Err(required(kind, "one file, directory or phase")),
                [token] => token,
                _ => return Err(ambiguous("a minimalism selection names one file, directory or phase; nothing else".into())),
            };
            let (explicit, name) = match token.split_once(':') {
                Some((prefix @ ("file" | "dir" | "phase"), rest)) => (Some(prefix), rest),
                _ => (None, token.as_str()),
            };
            let mut candidates: Vec<(&str, String)> = Vec::new();
            if explicit.is_none_or(|p| p == "phase") && !name.is_empty() && name.bytes().all(|b| b.is_ascii_digit()) {
                candidates.push(("phase", name.to_owned()));
            }
            if explicit.is_none_or(|p| p == "file") && source.read(name).ok().is_some_and(|o| o.bytes.is_some()) {
                candidates.push(("file", name.to_owned()));
            }
            if explicit.is_none_or(|p| p == "dir") && source.members(name).is_ok() {
                candidates.push(("dir", name.to_owned()));
            }
            let (class, name) = match candidates.as_slice() {
                [] => return Err(unresolvable(format!("{token} is not a file, a directory or a native phase in this project"))),
                [one] => one.clone(),
                many => return Err(ambiguous(format!("{token} resolves to more than one target ({}); select one with {}", many.iter().map(|(c, _)| *c).collect::<Vec<_>>().join(", "),
                    many.iter().map(|(c, n)| format!("{c}:{n}")).collect::<Vec<_>>().join(" or ")))),
            };
            match class {
                "file" => {
                    let bytes = read_file(source, &name)?.ok_or_else(|| unresolvable(format!("{name} does not exist")))?;
                    Ok(finish(kind, Target::NamedFile { path: name.clone(), head: None }, None, None, vec![material("file", &name, &bytes)], phase_of_path(&name)))
                }
                "dir" => {
                    let members = directory_members(source, &name)?;
                    let mut material_rows = Vec::new();
                    for member in &members {
                        let path = format!("{name}/{member}");
                        let bytes = read_file(source, &path)?.ok_or_else(|| unresolvable(format!("{path} vanished during selection")))?;
                        material_rows.push(material("member", &path, &bytes));
                    }
                    Ok(finish(kind, Target::Directory { path: name, members }, None, None, material_rows, None))
                }
                _ => {
                    let phase: u32 = name.parse().ok().filter(|n| *n > 0).ok_or_else(|| unresolvable(format!("{name} is not a positive phase number")))?;
                    let (base, head) = phase_range(data, phase)?;
                    let material_rows = vec![Material { label: "range".into(), path: format!("{base}..{head}"), lines: [0, 0], digest: digest(format!("{base}..{head}").as_bytes()) }];
                    Ok(finish(kind, Target::PhaseRange { phase: phase.to_string(), base, head }, None, None, material_rows, Some(phase)))
                }
            }
        }
        Kind::Plan => {
            let token = match arguments.as_slice() {
                [] => return Err(required(kind, "one phase number or one plan document path")),
                [token] => token,
                _ => return Err(ambiguous("a plan selection names one phase or one plan path; nothing else".into())),
            };
            let numeric = !token.is_empty() && token.bytes().all(|b| b.is_ascii_digit());
            let exists = source.read(token).ok().is_some_and(|o| o.bytes.is_some());
            match (numeric, exists) {
                (true, true) => Err(ambiguous(format!("{token} is both a phase number and a file; rename the file or select the plan by its document path"))),
                (true, false) => {
                    let phase: u32 = token.parse().ok().filter(|n| *n > 0).ok_or_else(|| unresolvable(format!("{token} is not a positive phase number")))?;
                    let entries = plan_material(data, phase, source)?;
                    let material_rows = entries.iter().map(|(label, path, bytes)| material(label, path, bytes)).collect();
                    Ok(finish(kind, Target::InlineText { label: format!("plan:{phase}") }, None, None, material_rows, Some(phase)))
                }
                (false, true) => {
                    let bytes = read_file(source, token)?.ok_or_else(|| unresolvable(format!("{token} does not exist")))?;
                    Ok(finish(kind, Target::NamedFile { path: token.clone(), head: None }, None, None, vec![material("plan", token, &bytes)], phase_of_path(token)))
                }
                (false, false) => Err(unresolvable(format!("{token} is neither a phase number nor an existing plan document"))),
            }
        }
    }
}
