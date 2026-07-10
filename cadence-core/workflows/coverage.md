# cad-coverage workflow

Find and close failing-capable test-coverage gaps for a completed phase. The
whole flow turns on one definition:

> **Covered** = there exists a test whose failure would signal that this
> requirement regressed. A test that imports or runs the code but would still
> pass if the behavior were wrong is NOT coverage.

## 1. Resolve the phase
`$ARGUMENTS` = a phase number, else the last completed phase (STATE.md cursor /
ROADMAP.md). If the phase was not executed (no SUMMARY.md / no commits), say so
and stop - there is nothing to cover yet.

## 2. Gather the phase's requirements and artifacts
- Requirements: the phase's requirement IDs and their acceptance criteria -
  from REQUIREMENTS.md (rows for this phase), the phase PLAN's `requirements`
  frontmatter, and CONTEXT.md's falsifiable criteria if present.
- Implementation: the files the phase produced - from its SUMMARY.md and the
  phase's commit range (`git diff <phase-start>..<phase-end> --stat`).
- Existing tests: locate the project's tests (test dirs, `*.test.*`,
  `*_test.*`, spec files) and the runner (`workflow.test_command`; if null,
  detect from the repo - package.json scripts, pytest, cargo test, go test).

## 3. Audit coverage (the gap map)
For each requirement, decide covered vs gap by the definition above:
- Find the tests that exercise the requirement's behavior. Read them - confirm
  an assertion would actually fail if the behavior were wrong (wrong output,
  missing branch, error not raised). Presence of a test file is not enough.
- Classify each requirement: **covered** (name the guarding test) or **gap**.

Report the map: covered requirements with their guarding test, gaps listed
plainly. If there are no gaps, state that and stop - the phase is covered.

## 4. Propose a gap test plan (approval gate)
For each gap, propose: the requirement, the test kind that fits (unit /
integration / end-to-end - chosen from what the code is, not a default), the
target test file, and the behavior the test will pin. Present the plan via the
ask-user seam and get approval before writing anything. Let the user drop or
adjust entries.

## 5. Generate the tests
Write each approved test in the project's framework and conventions (match the
existing tests' style). Prefer a RED check where feasible: the test should fail
if the requirement's behavior were absent - sanity-check that it is testing the
behavior, not a tautology. Do not invent a new framework or add a heavy E2E
dependency the project does not already use; if a gap truly needs one, flag it
for the user rather than pulling it in silently.

## 6. Run and report
Run `workflow.test_command` (or the detected runner) over the new tests.
- Green -> report the closed gaps and the updated coverage map.
- Red -> the test or the code is wrong; report which, and either fix the test
  (if it was miswritten) or hand the failure to /cad-debug (if it found a real
  defect). Never leave a red test committed as "coverage."
- Report any requirement still uncovered (e.g. the user dropped it, or it needs
  a dependency they declined).

## 7. Commit
Commit the generated tests atomically, `test(phase-<N>): cover <requirements>`,
honoring the protected-branch guard (references/git.md) - if HEAD is protected,
ask before committing. Never auto-push.
