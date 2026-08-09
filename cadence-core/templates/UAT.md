# UAT template

Template for `.planning/phases/<N>/UAT.md` - the persistent checklist
cad-verify builds, walks, and updates. One file per phase; committed with
the planning docs; survives /clear and session ends.

---

## File template

```markdown
---
status: testing | partial | complete
phase: <N>
fields_version: 1
sources: [CONTEXT.md | PLAN.md + ROADMAP.md, SUMMARY.md]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Items

### 1. [Name]
expected: [observable behavior - what the user should see]
criterion: AC1
status: pending

### 2. [Name]
expected: [observable behavior]
criterion: AC2
status: pass

### 3. [Name]
expected: [observable behavior]
origin: smoke
status: pass
source: verifier
evidence: [what cad-verifier observed, file:line or command output]

### 4. [Name]
expected: [observable behavior]
origin: verifier
status: fail
first_pass: fail
reported: "[verbatim user reply]"
severity: blocker | major | minor | cosmetic
cause: [root cause, once diagnosed]
fix: [{commit hash}, retest | routed to /cad-plan | open]

### 5. [Name]
expected: [observable behavior]
status: skipped
reason: [why]

### 6. [Name]
expected: [observable behavior]
status: blocked
reason: [what is missing - server, device, build, another phase]

### 7. [Name]
expected: [observable behavior]
origin: verifier
why_human: [why inspection cannot settle it - credentials, GUI, hardware]
status: pending

## Summary

total: [N]
passed: [N]
failed: [N]
pending: [N]
skipped: [N]
blocked: [N]
reworked: [N]
```

---

## Rules

- Frontmatter `status` and `updated`: overwrite on every change.
  `phase` and `started`: set once.
- Items are append-only; a status field is overwritten when the user
  answers or a fix lands (fail -> pending for retest). Never delete an
  item or a recorded result.
- A hand-added `### ` section that is not a numbered item (e.g.
  `### Manual notes`) is preserved verbatim across seam rewrites - a
  numbered line inside it is prose, never an item.
- `first_pass`: the item's FIRST non-pending result (`pass` or `fail`),
  written once and never overwritten. It preserves whether an item passed
  clean or only after a fix, since `status` is later overwritten to `pass`
  on retest. Items that passed on the first answer may omit it.
- `reworked` (Summary): count of items whose `first_pass` is `fail` - the
  phase needed N human fix-and-retest rounds. A clean run reports `0`; a
  bumpy one does not hide behind `failed: 0`.
- `criterion`: the CONTEXT `## Acceptance criteria` id (`AC<N>`) this item
  was built from, written by `uat init`/`uat refresh` from the payload and
  carried through every later rewrite. It is what lets `/cad-audit` prove
  every criterion reached the checklist
  (`references/acceptance-criteria.md`).
- `origin`: `criterion | verifier | smoke` - declared on an item that
  legitimately has no criterion, so it is exempt rather than merely
  unlinked. A verifier-appended gap gets `verifier`, the cold-start smoke
  item `smoke`. Written, never derived: a present `criterion` is itself the
  criterion-derived marker. The two repairs are different: `uat record
  --criterion AC<N>` restores a LINK that was never written or was lost,
  while `uat record --origin` declares an item that legitimately has none.
  `--origin criterion` is not a substitute for the link - it names no id, so
  it proves nothing.
- `fields_version: 1` (frontmatter): written by `uat init` on every new
  checklist, unconditionally. It is the POSITIVE marker that this file came
  from a seam that knows `criterion` and `origin`. `/cad-audit`'s legacy
  exemption needs it absent AND five terms in all: items present, no
  `criterion` or `origin` on any of them, and a CONTEXT declaring no `AC<N>`
  ids. That is legacy - reported, never broken on. The same file beside a
  CONTEXT that DID declare ids is a `fieldless-checklist` break naming the
  file to repair, because the AC-id grammar post-dates the fields. And a
  checklist carrying the marker is never legacy however few links its items
  hold - dropped links break.
- `source`: `user | verifier | model` - where a RESULT came from, never
  where an ITEM came from (that is `origin`'s job, and conflating them
  exempts nearly every item). `user` is implicit and never written.
  `verifier` marks results merged from a cad-verifier pass; they are
  skipped in the walk but stay visible here with their evidence. `model`
  marks a check the walk ran itself and cited its command and output for.
- `why_human`: the verifier's per-item reason inspection cannot settle
  this check, written by `uat merge` from `human_checks[].why_human`. The
  walk reads it as already judged and does not re-litigate the reason.
- Failure evidence lives on the item (reported / severity / cause / fix) -
  there is no separate gaps section.
- Summary counts: recomputed and overwritten after every response.

## Severity (inferred from the reply, never asked)

| Reply mentions | Severity |
|---|---|
| crash, error, exception, unusable, data loss | blocker |
| doesn't work, wrong, missing, can't | major |
| works but, slow, weird, small | minor |
| color, font, spacing, alignment, visual | cosmetic |

Default: major.

## Lifecycle

- Created by cad-verify from the phase's acceptance criteria; all items
  `pending`, status `testing`.
- Every user reply updates one item + Summary + `updated`, and the file
  is written immediately - it IS the session state.
- Session end: status `complete` (every item pass or skipped-with-reason,
  none failed) or `partial` (anything pending, failed, blocked, or
  skipped without a reason). Partial sessions resume at the first
  `pending` item on the next run.
- A fixed failure goes back to `pending` with `fix: {hash}, retest`;
  `complete` requires the retest to pass.
