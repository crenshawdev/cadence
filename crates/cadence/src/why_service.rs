use cadence::process::Process;
use cadence::envelope::Refusal;
use cadence::why::{corpus, git, render};
use serde_json::{Value, json};
use std::path::Path;

/// The owner's question: a repository-relative path, an optional 1-based
/// line, and an optional entry cap. The path is a question, never a read
/// location: the binary reads the repository itself.
pub struct Request {
    pub path: Option<String>,
    pub line: Option<u32>,
    pub top: Option<u32>,
    pub phase: Option<u32>,
    pub part: Option<String>,
}

/// The next step for a `git-failed` refusal, the same for the probe and the
/// chain query: neither knows which git fact failed.
const GIT_FAILED_HINT: &str = "this query needs a readable git repository: run it inside one, or bind the resident to a working tree where `git log` answers, then re-run";

/// Read immutable boundary receipts from the verified journal, in append order.
pub fn refusals(view: &cadence::store::writer::View, phase: u32) -> Value {
    let rows: Vec<Value> = view.decisions.iter().filter_map(|record| {
        let cadence::store::model::Decision::BoundaryV1(saved) = &record.decision else { return None; };
        let boundary = &saved.boundary;
        if boundary.scope != (cadence::execution::boundary::BoundaryScope::Execution { phase }) { return None; }
        let cadence::execution::boundary::Receipt::Compact {
            envelope: cadence::envelope::Envelope::Refused { code, reason }
        } = &boundary.receipt else { return None; };
        Some(json!({ "decision": record.id, "code": code, "reason": reason,
            "rule": boundary.located.as_ref().and_then(|l| l.rule.as_deref()),
            "slot": boundary.located.as_ref().and_then(|l| l.slot.as_deref()),
            "id": boundary.located.as_ref().and_then(|l| l.id.as_deref()) }))
    }).collect();
    let mut text = format!("Phase {phase} refusals\n");
    for row in &rows {
        text.push_str(&format!("{} rule={} slot={} id={}: {}\n",
            row["code"].as_str().unwrap_or(""), row["rule"].as_str().unwrap_or(""),
            row["slot"].as_str().unwrap_or(""), row["id"].as_str().unwrap_or(""),
            row["reason"].as_str().unwrap_or("")));
    }
    json!({"status":"ok","phase":phase,"part":"refusals","refusals":rows,"text":text})
}

fn git_failed(detail: &str) -> Value {
    Refusal::new("git-failed", format!("{detail} failed; {GIT_FAILED_HINT}")).slot("path").value()
}

/// Answer `why` for one path or line over the bound repository. `root` is the
/// bound `.planning` directory every service receives; the repository git
/// answers for is its parent. Runs git and reads the record synchronously;
/// the caller decides the thread.
pub fn query(root: &Path, request: &Request, process: &mut dyn Process) -> Value {
    let root = root.parent().unwrap_or(root);
    let path = request.path.as_deref().unwrap_or_default();
    if path.trim().is_empty() {
        return Refusal::new("bad-query", "the path is blank; pass one repository-relative path").slot("path").value();
    }
    let line = request.line.map(Value::from).unwrap_or(Value::Null);

    // The explicit not-in-history probe, run before either chain query so a
    // mistyped path is answered by the smallest invocation that can answer it.
    let probe = match git::run(root, &git::probe_argv(path), process) {
        Ok(run) => run,
        Err(limit) => return git_limit(limit),
    };
    match git::classify(&probe) {
        git::Outcome::NotInHistory => return json!({
            "status":"ok","path":path,"line":line,"result":"not-in-history",
            "text":format!("No commits: git has never seen \"{path}\" in this repository's history."),
        }),
        git::Outcome::GitFailed => return git_failed("the not-in-history probe"),
        git::Outcome::Ok | git::Outcome::LinePastEnd => {}
    }

    let chain = match request.line {
        None => git::run(root, &git::bare_argv(path), process),
        Some(line) => git::run(root, &git::line_argv(path, line), process),
    };
    let chain = match chain {
        Ok(run) => run,
        Err(limit) => return git_limit(limit),
    };
    match git::classify(&chain) {
        git::Outcome::NotInHistory => return json!({
            "status":"ok","path":path,"line":line,"result":"not-in-history",
            "text":format!("No commits: git has never seen \"{path}\" at the point this query resolves against."),
        }),
        git::Outcome::LinePastEnd => return json!({
            "status":"ok","path":path,"line":line,"result":"line-past-end",
            "text":format!("Line {} is past the end of \"{path}\" (or the path is absent at the commit this query resolves against) - no diffs to report.", request.line.unwrap_or(0)),
        }),
        git::Outcome::GitFailed => return git_failed(
            if request.line.is_none() { "the bare-path chain query" } else { "the line-scoped chain query" }),
        git::Outcome::Ok => {}
    }

    let mut index = corpus::build_index(root, process);
    let raws = git::parse_entries(&chain.stdout);
    // The bare arm only: the line arm carries its own simplification. A
    // comparand that could not run makes the answer thinner, not wrong.
    let excluded = match request.line {
        None => {
            let comparand = corpus::coverage(git::run(root, &git::comparand_argv(path), process), &mut index.warnings);
            comparand.ok().then(|| git::excluded_from(&raws, &git::parse_comparand(&comparand.stdout)))
        }
        Some(_) => None,
    };
    let (entries, joined_warnings) = corpus::join_chain(root, path, &index, &raws, process);
    let rendered = render::render_chain(&entries, request.top, excluded.as_deref(), path);
    let warnings: Vec<&String> = index.warnings.iter().chain(&joined_warnings).collect();
    json!({
        "status":"ok","path":path,"line":line,"result":"chain",
        "text":rendered.text,"shown":rendered.shown,"total":rendered.total,
        "entries":rendered.entries,
        "excluded":excluded,
        "warnings":warnings,
    })
}

fn git_limit(limit: cadence::git_process::Limit) -> Value {
    Refusal::new("git-limit", limit.to_string()).slot("path").value()
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_git_limit_refuses_why_with_its_command_and_bound() {
        let answer = super::git_limit(cadence::git_process::Limit {
            command: "git log -- a.rs".into(),
            bound: std::time::Duration::from_secs(60),
        });
        assert_eq!(answer["status"], "refused");
        assert_eq!(answer["code"], "git-limit");
        assert_eq!(answer["reason"], "git log -- a.rs exceeded git deadline of 60 seconds");
    }
}
