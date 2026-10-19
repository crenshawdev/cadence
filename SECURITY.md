# Security

## Reporting a vulnerability

Report it privately through GitHub: open the repository's Security tab and choose "Report a vulnerability", or go straight to https://github.com/crenshawdev/cadence/security/advisories/new. Please don't open a public issue for it. Say which version you ran (the `version` in `.claude-plugin/plugin.json`, or the commit), what you did, and what happened.

## What runs on every pull request and every push to main

The `sentinel-fast` workflow, `.github/workflows/fast.yml`, runs two jobs on a pull request. A push to main runs only `mechanical`.

`mechanical` installs the check tools and runs `.sentinel/mechanical/check.sh .`. Cadence has no `Cargo.toml`, `package.json`, `pyproject.toml` or `requirements.txt`, so two checks apply here. semgrep runs with the `p/rust`, `p/secrets`, `p/javascript` and `p/python` rulesets and metrics off, and it is a gate: a semgrep finding fails the job and the pull request. gitleaks reads every commit on every ref, so it also finds a secret that was committed and later removed. It is reported only: the log shows each finding's fingerprint (commit, file, rule and line) and never the matched text, and a finding does not fail the job. Both tools are pinned, semgrep 1.181.0 and gitleaks 8.30.1, with the gitleaks download checked against its SHA-256, and either one failing to install fails the job. The Rust, npm and Python checks are skipped, and the job output says so.

`security-review` runs on GitHub pull requests only, at the same time as `mechanical`, so a failed gate does not skip it. It is skipped on Dependabot's pull requests because GitHub gives those no Actions secrets. Claude Opus 5.5, on a pinned Claude Code (2.1.300), reviews the pull request's diff against `THREAT-MODEL.md` with read-only tools (Read, Grep, Glob) and none of the pull request's own `.claude` settings loaded. This repository is public, so the review is encrypted to the maintainer's age key and uploaded as the `security-review` artifact, kept 14 days, and the pull request comment, the log and the job summary show only the count of findings by severity. The job fails the pull request when the review did not run, or when its output holds neither findings nor a "No findings" marker. Findings themselves do not fail it.

The `test` workflow also runs on every pull request and every push to main, for the test suite, the prose-to-code drift check, the typecheck and plugin validation. It checks correctness, not security.

## The full audit

The full audit runs on the maintainer's machine through `/snt:audit`, never in CI, because it needs a Claude Code session and its findings must stay off public CI. It runs five steps, stopping after each one:

1. Mechanical checks: `.sentinel/mechanical/check.sh .`, with the output saved to `audit/check.txt` and the failures summarized by tool. Its fuzz run applies only to a repository with a `Cargo.toml`, so it does not run here.
2. A Claude Security scan the maintainer picks: a release scan of the whole repository at `medium`, a branch scan of the current branch's committed changes at `high`, or a quick scan of the whole repository at `low`. Its results are copied to `audit/claude-security.md`. When a whole-repository scan leaves production files uncovered, the step opens with an ALERT line naming them and offers a scoped scan of exactly those files, whose report goes to `audit/claude-security-skipped.md`. Its suggest-patches job is never run.
3. An optional lens pass: eight review prompts in `.sentinel/lenses/`, one concern each, that read the whole repository against `THREAT-MODEL.md`. They run on Claude, Codex or both, or not at all, and nothing runs until the maintainer picks, in one question that states the cost. Their output goes to `audit/lenses/<timestamp>/`.
4. A read-only check of the lens findings. Findings the Claude Security report already has, or that `THREAT-MODEL.md` already documents, are set aside with a reason, read-only subagents trace the rest in the code, and the confirmed and partly confirmed findings are written to `audit/lenses.md`.
5. A findings log: one row per step in `audit/findings-log.md`, with the date, the step and what it found.

The audit only finds and records. It fixes nothing, writes no tests and commits nothing. `audit/` and `CLAUDE-SECURITY-*/` are in `.gitignore`, because they hold findings that are not fixed yet.

## Threat model

`THREAT-MODEL.md` states what Cadence reads, writes and runs, where untrusted data enters, and what it must never touch. `.claude/claude-security-guidance.md` carries its key points as the rules every security review applies.

The `sentinel-fast` workflow and the audit come from sentinel: https://github.com/jcrenshaw-dev/sentinel
