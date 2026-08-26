# Filed: issues this repository's gates opened

Written by `issue-filing.mjs file` when a gate's finding is ACCEPTED and filed
on the tracker, read by `planning.mjs recall` beside CAPTURE.md. One `- ` row
per filed issue: the date, the provider, the repository slug, the finding's
(file, claim) fingerprint and the issue's title. No finding body - a row is a
pointer to an issue, not a copy of it, and NOTHING here is a queue. A declined
finding is never written here; its only record is the decline label on the
forge. A line that is not a row is skipped, so a note added here mints no
recall entry.

- 2026-08-25 github crenshawdev/cadence e7cfd661a15c38fa: [cadence e7cfd661a15c38fa] Task 6 classifies `risk-check.mjs:70` and `:326` as exempt and makes that exemption part of the new census, despite CONTEXT D-06 identifying the corresponding `risk-check.mj
- 2026-08-25 github crenshawdev/cadence b9ae737ae1a77a4f: [cadence b9ae737ae1a77a4f] The proposed terminal dedup treats any close that finds a pending dispatch for the same `(corr, phase, plan)` as that pending dispatch's first close, so it cannot distinguis
- 2026-08-26 github crenshawdev/cadence 55d0841ac5ee9c94: [cadence 55d0841ac5ee9c94] The hook trusts parsed stdin `cwd` and `agent_type` without validating that they describe the hook invocation's actual project or a host-authentic Cadence subagent.
