# Security

## Reporting a vulnerability

Report it privately through GitHub: open the repository's Security tab and choose "Report a vulnerability", or go straight to https://github.com/crenshawdev/cadence/security/advisories/new. Please don't open a public issue for it. Say which version you ran (the `version` in `.claude-plugin/plugin.json`, or the commit), what you did, and what happened.

## How Cadence is checked

Cadence is audited with [sentinel](https://github.com/jcrenshaw-dev/sentinel), which this repo carries as a git submodule at `.sentinel`, pinned to the version Cadence runs. [THREAT-MODEL.md](THREAT-MODEL.md) states what Cadence reads, writes and runs, where untrusted data enters, and what it must never touch, and every review works from it. `.claude/claude-security-guidance.md` carries its key points as the rules every security review applies.

Every pull request and every push to `main` runs sentinel's mechanical checks through `.github/workflows/fast.yml`. The gates among them fail the run; the rest report. On a pull request from this repository, a second job has Claude Code review the diff against THREAT-MODEL.md with read-only tools. This repository is public, so the review is encrypted to the maintainer's key, and the pull request comment shows only the count of findings. Findings do not fail that job; a review that did not run does. The kit's `README.md` in `.sentinel` lists every check and says which ones gate.

Every pull request and every push to `main` also runs `.github/workflows/test.yml`: the test suite, the prose-to-code drift check, the typecheck and plugin validation. It checks correctness, not security.

The full audit runs by hand on the maintainer's machine through `/snt:audit`, never in CI. [SENTINEL.md](SENTINEL.md) at the repo root is the record of the last one: what ran, how each step went, and the open findings as counts by severity. It never names a finding or where it is, so an open finding stays private until it is fixed. The release workflow fails any release from a commit the last audit did not cover. The audit finds and records: it fixes nothing, writes no tests and commits nothing.
