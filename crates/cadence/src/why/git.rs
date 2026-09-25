//! The git invocations behind `why`, as cadence-core/bin/lib/why-query.mjs
//! and why.mjs make them: argv arrays, never a shell string; a fixed
//! `--format` and an explicit `-M` so a reader's `log.follow` or
//! `diff.renames` cannot change the answer; and a classification that carries
//! no git bytes onward, because a `fatal:` line reaching an answer is how a
//! credential leaked once.

use crate::process::{Output, Process};
use crate::git_process::{self, Caller, Limit};
use std::path::Path;

/// One finished git invocation. A spawn failure is a non-zero status with
/// its message in `stderr`, so every caller classifies one shape.
pub struct Run {
    pub status: i32,
    pub stdout: String,
    pub stderr: String,
}

impl Run {
    pub fn ok(&self) -> bool { self.status == 0 }
}

/// Run `git -C <dir> <args>`, never panicking on the repository's state.
pub fn run(dir: &Path, args: &[String], process: &mut dyn Process) -> Result<Run, Limit> {
    finish(git_process::run(&git_process::launch(Caller::WhyRead).arg("-C").arg(dir).args(args), process))
}

/// Run git with bytes on stdin, for the batched object probe.
pub fn run_with_input(dir: &Path, args: &[String], input: &str, process: &mut dyn Process) -> Result<Run, Limit> {
    finish(git_process::run(&git_process::launch(Caller::WhyInput).arg("-C").arg(dir).args(args).stdin(input.as_bytes()), process))
}

/// One shape for both arms: a program that could not start is a non-zero
/// status carrying its message, exactly as a git failure is.
fn finish(answer: Result<Output, git_process::Error>) -> Result<Run, Limit> {
    Ok(match answer {
        Ok(output) => Run {
            status: output.code().unwrap_or(1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        },
        Err(git_process::Error::Limit(limit)) => return Err(limit),
        Err(git_process::Error::Io(error)) => Run { status: 1, stdout: String::new(), stderr: error.to_string() },
    })
}

fn argv(parts: &[&str]) -> Vec<String> { parts.iter().map(|part| (*part).to_owned()).collect() }

/// Shared `--format` for both chain arms: full sha, strict-ISO commit date,
/// the commit's epoch seconds (the sort key, read here rather than parsed
/// back out of the ISO spelling) and the subject, joined by `\x1f`.
const LOG_FORMAT: &str = "%H%x1f%cI%x1f%ct%x1f%s";

/// The comparand's `--format`: the full sha and the parent list.
const COMPARAND_FORMAT: &str = "%H%x1f%P";

/// The cheap "does git know this path" probe, run before the chain query.
pub fn probe_argv(path: &str) -> Vec<String> {
    argv(&["log", "-1", "--format=%H", "--", path])
}

/// Every commit that touched `path`, newest first, following renames.
pub fn bare_argv(path: &str) -> Vec<String> {
    argv(&["log", &format!("--format={LOG_FORMAT}"), "-M", "--follow", "--", path])
}

/// Only the commits whose diff touched `line` in `path`. `-L` takes the path
/// as part of its own argument and refuses a trailing pathspec.
pub fn line_argv(path: &str, line: u32) -> Vec<String> {
    argv(&["log", &format!("-L{line},{line}:{path}"), "-s", &format!("--format={LOG_FORMAT}"), "-M"])
}

/// The bare arm's comparand: the same path with history simplification off
/// and no `--follow`, because the two flags do not compose.
pub fn comparand_argv(path: &str) -> Vec<String> {
    argv(&["log", "--full-history", "-M", &format!("--format={COMPARAND_FORMAT}"), "--", path])
}

/// One chain entry as git reported it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub sha: String,
    pub date: String,
    /// Commit time in epoch seconds: the order `sortEntries` uses.
    pub at: i64,
    pub subject: String,
}

/// Split raw chain stdout into entries, one record per line.
pub fn parse_entries(stdout: &str) -> Vec<Entry> {
    stdout.lines().filter(|line| !line.trim().is_empty()).map(|line| {
        let mut parts = line.splitn(4, '\x1f');
        let sha = parts.next().unwrap_or("").to_owned();
        let date = parts.next().unwrap_or("").to_owned();
        let at = parts.next().unwrap_or("").parse().unwrap_or(0);
        let subject = parts.next().unwrap_or("").to_owned();
        Entry { sha, date, at, subject }
    }).collect()
}

/// One comparand record: the sha and its parents, empty on a root commit.
pub struct Comparand {
    pub sha: String,
    pub parents: Vec<String>,
}

pub fn parse_comparand(stdout: &str) -> Vec<Comparand> {
    stdout.lines().filter(|line| !line.trim().is_empty()).map(|line| {
        let (sha, parents) = line.split_once('\x1f').unwrap_or((line, ""));
        Comparand {
            sha: sha.to_owned(),
            parents: parents.split(' ').filter(|p| !p.is_empty()).map(str::to_owned).collect(),
        }
    }).collect()
}

/// A commit the comparand carries and the chain does not, with its parent
/// count so a caller states how many are merges from evidence.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Excluded {
    pub sha: String,
    pub parent_count: usize,
}

/// Which comparand commits the chain lacks, in the comparand's own order.
pub fn excluded_from(chain: &[Entry], records: &[Comparand]) -> Vec<Excluded> {
    let carried: std::collections::BTreeSet<&str> = chain.iter().map(|entry| entry.sha.as_str()).collect();
    records.iter()
        .filter(|record| !record.sha.is_empty() && !carried.contains(record.sha.as_str()))
        .map(|record| Excluded { sha: record.sha.clone(), parent_count: record.parents.len() })
        .collect()
}

/// The stated outcomes of a chain or probe invocation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Ok,
    NotInHistory,
    LinePastEnd,
    GitFailed,
}

/// Classify one invocation. `stderr` is inspected here and never returned.
pub fn classify(run: &Run) -> Outcome {
    if run.status == 0 {
        return if run.stdout.trim().is_empty() { Outcome::NotInHistory } else { Outcome::Ok };
    }
    let unknown_path = regex::Regex::new(r"(?m)^fatal: There is no path .* in the commit$").expect("static pattern");
    let past_end = regex::Regex::new(r"(?m)has only \d+ lines$").expect("static pattern");
    if unknown_path.is_match(&run.stderr) { return Outcome::NotInHistory; }
    if past_end.is_match(&run.stderr) { return Outcome::LinePastEnd; }
    Outcome::GitFailed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_deadline_is_not_classified_as_missing_history() {
        let answer = finish(Err(git_process::Error::Limit(Limit {
            command: "git log -- a.rs".into(),
            bound: std::time::Duration::from_secs(60),
        })));
        let Err(limit) = answer else { panic!("deadline became an ordinary git answer"); };
        assert_eq!(limit.command, "git log -- a.rs");
        assert_eq!(limit.bound, std::time::Duration::from_secs(60));
    }

    #[test]
    fn a_clean_exit_with_no_output_is_not_in_history() {
        let run = Run { status: 0, stdout: "\n".into(), stderr: String::new() };
        assert_eq!(classify(&run), Outcome::NotInHistory);
        let run = Run { status: 0, stdout: "abc\n".into(), stderr: String::new() };
        assert_eq!(classify(&run), Outcome::Ok);
    }

    #[test]
    fn the_line_arm_tells_an_unknown_path_from_a_short_file_by_stderr() {
        let run = Run { status: 128, stdout: String::new(), stderr: "fatal: There is no path a.py in the commit\n".into() };
        assert_eq!(classify(&run), Outcome::NotInHistory);
        let run = Run { status: 128, stdout: String::new(), stderr: "fatal: file a.py has only 3 lines\n".into() };
        assert_eq!(classify(&run), Outcome::LinePastEnd);
        let run = Run { status: 128, stdout: String::new(), stderr: "fatal: not a git repository\n".into() };
        assert_eq!(classify(&run), Outcome::GitFailed);
    }

    #[test]
    fn entries_keep_a_subject_that_carries_the_separator() {
        let parsed = parse_entries("aaaa\x1f2026-01-01T00:00:00+00:00\x1f1767225600\x1ffeat: a\x1fb\n\n");
        assert_eq!(parsed, vec![Entry { sha: "aaaa".into(), date: "2026-01-01T00:00:00+00:00".into(), at: 1767225600, subject: "feat: a\x1fb".into() }]);
    }

    #[test]
    fn excluded_keeps_the_comparand_order_and_counts_parents() {
        let chain = parse_entries("bbbb\x1fd\x1f2\x1fs\n");
        let records = parse_comparand("aaaa\x1fp1 p2\nbbbb\x1fp1\ncccc\x1f\n\x1f\n");
        assert_eq!(excluded_from(&chain, &records), vec![
            Excluded { sha: "aaaa".into(), parent_count: 2 },
            Excluded { sha: "cccc".into(), parent_count: 0 },
        ]);
    }

    #[test]
    fn the_line_arm_embeds_the_path_and_takes_no_pathspec() {
        assert_eq!(line_argv("a/b.rs", 7), ["log", "-L7,7:a/b.rs", "-s", "--format=%H%x1f%cI%x1f%ct%x1f%s", "-M"]);
    }

    #[test]
    fn the_bare_arm_follows_renames_and_ends_with_the_pathspec() {
        assert_eq!(bare_argv("HEAD"), ["log", "--format=%H%x1f%cI%x1f%ct%x1f%s", "-M", "--follow", "--", "HEAD"]);
    }
}
