# Security

## Reporting a vulnerability

Report it privately through GitHub: open the repository's Security tab and choose "Report a vulnerability", or go straight to https://github.com/crenshawdev/cadence/security/advisories/new. Please don't open a public issue for it. Say which version you ran (the `version` in `.claude-plugin/plugin.json`, or the commit), what you did, and what happened.

## What runs on every pull request

The `sentinel-fast` workflow, `.github/workflows/fast.yml`, runs two jobs.

`mechanical` installs the check tools and runs `.sentinel/mechanical/check.sh .`. Cadence has no `Cargo.toml`, `package.json`, `pyproject.toml` or `requirements.txt`, so the one check that applies here is semgrep, with the `p/rust`, `p/secrets`, `p/javascript` and `p/python` rulesets and metrics off. It is a gate: a semgrep finding, or semgrep failing to install, fails the job and the pull request. The Rust, npm and Python checks are skipped, and the job output says so.

`security-review` runs on GitHub only, after `mechanical` passes, and is skipped on Dependabot's pull requests because GitHub gives those no Actions secrets. Claude Opus 5.5, on a pinned Claude Code (2.1.300), reviews the pull request's diff against `THREAT-MODEL.md` with read-only tools (Read, Grep, Glob) and none of the pull request's own `.claude` settings loaded. This repository is public, so the review is encrypted to the maintainer's age key and uploaded as the `security-review` artifact, kept 14 days, and the pull request comment, the log and the job summary show only the count of findings by severity. The job fails the pull request when the review did not run, or when its output holds neither findings nor a "No findings" marker. Findings themselves do not fail it.

The `test` workflow also runs on every pull request, for the test suite, the prose-to-code drift check, the typecheck and plugin validation. It checks correctness, not security.

## The full audit

The full audit runs on the maintainer's machine through `/snt:audit`, never in CI, because it needs a Claude Code session and its findings must stay off public CI. It runs three steps, stopping after each one:

1. Mechanical checks: `.sentinel/mechanical/check.sh .`, with the output saved to `audit/check.txt` and the failures summarized by tool.
2. A Claude Security codebase scan of the whole repository, with its results copied to `audit/claude-security.md`. Its suggest-patches job is never run.
3. A findings log: one row per step in `audit/findings-log.md`, with the date, the step and what it found.

The audit only finds and records. It fixes nothing, writes no tests and commits nothing. `audit/` and `CLAUDE-SECURITY-*/` are in `.gitignore`, because they hold findings that are not fixed yet.

## Threat model

`THREAT-MODEL.md` states what Cadence reads, writes and runs, where untrusted data enters, and what it must never touch. `.claude/claude-security-guidance.md` carries its key points as the rules every security review applies.

The pull request workflow and the audit come from sentinel: https://github.com/jcrenshaw-dev/sentinel
