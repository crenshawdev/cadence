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
