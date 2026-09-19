use cadence::envelope::Refusal;
use cadence::why::{corpus, git, render};
use serde_json::{Value, json};
use std::path::Path;

/// The owner's question: a repository-relative path, an optional 1-based
/// line, and an optional entry cap. The path is a question, never a read
/// location: the binary reads the repository itself.
pub struct Request {
    pub path: String,
    pub line: Option<u32>,
    pub top: Option<u32>,
}

/// The next step for a `git-failed` refusal, the same for the probe and the
/// chain query: neither knows which git fact failed.
const GIT_FAILED_HINT: &str = "this query needs a readable git repository: run it inside one, or bind the resident to a working tree where `git log` answers, then re-run";

fn git_failed(detail: &str) -> Value {
    Refusal::new("git-failed", format!("{detail} failed; {GIT_FAILED_HINT}")).slot("path").value()
}

/// Answer `why` for one path or line over the bound repository. `root` is the
/// bound `.planning` directory every service receives; the repository git
/// answers for is its parent. Runs git and reads the record synchronously;
/// the caller decides the thread.
pub fn query(root: &Path, request: &Request) -> Value {
    let root = root.parent().unwrap_or(root);
    let path = request.path.as_str();
    if path.trim().is_empty() {
        return Refusal::new("bad-query", "the path is blank; pass one repository-relative path").slot("path").value();
    }
    let line = request.line.map(Value::from).unwrap_or(Value::Null);

    // The explicit not-in-history probe, run before either chain query so a
    // mistyped path is answered by the smallest invocation that can answer it.
    let probe = git::run(root, &git::probe_argv(path));
    match git::classify(&probe) {
        git::Outcome::NotInHistory => return json!({
            "status":"ok","path":path,"line":line,"result":"not-in-history",
            "text":format!("No commits: git has never seen \"{path}\" in this repository's history."),
        }),
        git::Outcome::GitFailed => return git_failed("the not-in-history probe"),
        git::Outcome::Ok | git::Outcome::LinePastEnd => {}
    }

    let chain = match request.line {
        None => git::run(root, &git::bare_argv(path)),
        Some(line) => git::run(root, &git::line_argv(path, line)),
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

    let index = corpus::build_index(root);
    let raws = git::parse_entries(&chain.stdout);
    // The bare arm only: the line arm carries its own simplification. A
    // comparand that could not run makes the answer thinner, not wrong.
    let excluded = match request.line {
        None => {
            let comparand = git::run(root, &git::comparand_argv(path));
            comparand.ok().then(|| git::excluded_from(&raws, &git::parse_comparand(&comparand.stdout)))
        }
        Some(_) => None,
    };
    let (entries, joined_warnings) = corpus::join_chain(root, path, &index, &raws);
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
