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
sources: [CONTEXT.md | PLAN.md + ROADMAP.md, SUMMARY.md]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Items

### 1. [Name]
expected: [observable behavior - what the user should see]
status: pending

### 2. [Name]
expected: [observable behavior]
status: pass

### 3. [Name]
expected: [observable behavior]
status: pass
source: verifier
evidence: [what cad-verifier observed, file:line or command output]

### 4. [Name]
expected: [observable behavior]
status: fail
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

## Summary

total: [N]
passed: [N]
failed: [N]
pending: [N]
skipped: [N]
blocked: [N]
```

---

## Rules

- Frontmatter `status` and `updated`: overwrite on every change.
  `phase` and `started`: set once.
- Items are append-only; a status field is overwritten when the user
  answers or a fix lands (fail -> pending for retest). Never delete an
  item or a recorded result.
- `source: verifier` marks results merged from a cad-verifier pass; they
  are skipped in the walk but stay visible here with their evidence.
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
