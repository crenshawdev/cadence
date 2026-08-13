---
phase: 3
plan: 4
requirements: [TUN-01]
files:
  - cadence-core/workflows/suggest.md
  - skills/cad-suggest/SKILL.md
  - cadence-core/workflows/milestone.md
  - cadence-core/workflows/report.md
  - cadence-core/references/COMMANDS.md
  - README.md
  - .planning/DOCS-CLAIMS.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: The lens and the loop back - Plan 4 (the tuner gets a front door)

## Goal

The recommendations the run record already produces are reachable by name:
`/cad-suggest` relays `planning.mjs trace suggest` with the trace figures behind
each recommendation, writes no config itself, refuses a thin trace in one line,
and both of this phase's new commands are registered where a user would look for
them.

## Must be true when done

- `cadence-core/workflows/suggest.md` is the ONE statement of the presentation
  rules; `workflows/milestone.md` step 8 and `workflows/report.md`'s closing
  pointer both point at it instead of restating them.
- `/cad-suggest` presents each recommendation with the trace figures behind it
  and names the `/cad-config` key for anything accepted, and writes no config
  itself.
- A trace with nothing to read, or one whose events do not clear the evidence
  floors, gets one factual refusal line and zero suggestions - never an invented
  suggestion and never a figure the seam did not return.
- `/cad-suggest` and `/cad-minimalism-review` both appear in
  `cadence-core/references/COMMANDS.md` (which is `/cad-help`'s registration)
  and in `README.md`'s command lists.
- `README.md`'s self-description names the right number of skills.
- `.planning/DOCS-CLAIMS.md` names this phase's README shift and every row it
  moved cites the line its claim now lives on.
- `node cadence-core/bin/self-verify.mjs` reports an empty `problems` array,
  with every new and edited budgeted surface at its row.

## Context

- D-12 locks the single statement: the rules live in the new
  `cadence-core/workflows/suggest.md`; `workflows/milestone.md:155-172` (which
  today states the whole contract) and `workflows/report.md:67-71` (the
  footnote) are rewritten to point at it. `workflows/milestone.md` sits at its
  budget row and a new command must not depend on a close-workflow surface.
- D-13, D-14, D-15 lock the relay: the thin-trace refusal is PROSE, not a seam
  change; the scope actually read is reported rather than narrowed, with no new
  flag and no `corr` scoping; and the rules - including R3's
  resolve-denominated evidence - are relayed unchanged.
- D-16 locks registration: `COMMANDS.md` plus `README.md` plus
  `DOCS-CLAIMS.md`; `skills/cad-help/SKILL.md` `@`-includes COMMANDS.md, so the
  COMMANDS row IS the help registration and that skill needs no edit.
- D-17: `README.md:144`'s skill count is already stale by two before this phase
  and by four after it. The README update is its own task per
  `.planning/ROADMAP.md:81`.
- Plan 2 must have landed: this plan registers `/cad-minimalism-review`.

## Tasks

### Task 1: Write the suggest workflow as the one statement of the rules

- **Files:** cadence-core/workflows/suggest.md, cadence-core/bin/weight-budgets.json
- **Action:** Create `cadence-core/workflows/suggest.md` holding the presentation
  contract that `cadence-core/workflows/milestone.md:155-172` states today, and
  nothing more, in the step shape the other workflows use. Scope step: parse
  `$ARGUMENTS` for a phase number, which becomes `--phase <N>`; no argument means
  the WHOLE record on purpose (`cadence-core/bin/planning.mjs:2366-2369`), and the
  presentation SAYS which it read - including that an unscoped run spans every
  milestone still in the file, since nothing prunes `.planning/trace.jsonl` at a
  close. Add no flag of any kind: `self-verify.mjs`' CONTRACTS row fixes
  `trace suggest` at `--phase` alone, so a scoping flag would be a contract change
  this phase does not make, and there is no `corr` scoping (D-14). Run step: one
  call to
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace suggest [--phase <N>]`.
  Present step: read `scope`, `events_read`, `suggestions` and, when present,
  `capped` and `malformed` off the returned line; present each `kind:"suggest"`
  entry as a numbered item carrying its `subject`, its `evidence` VERBATIM as the
  seam computed it, and the `action` it names, and each `kind:"info"` entry as one
  receipt line. Relay the figures unchanged and recompute none of them (D-15) -
  R3's evidence is denominated in `routing/resolve` events
  (`cadence-core/bin/lib/trace-suggest.mjs:138-153`), which on a cross-model-only
  configuration counts routing decisions no agent acted on, and correcting that
  means editing the seam's denominators, which is outside this phase. Apply
  NOTHING: name `/cad-config` as the route for any suggestion the user accepts,
  and say that an unanswered list means no change - this is the triage gate's
  posture applied to configuration. Thin-trace step, as PROSE (D-13): the only
  discriminator the envelope offers is `events_read`, so `events_read: 0` gets one
  line saying the record holds no events in the scope read, and a non-zero
  `events_read` with an empty `suggestions` gets one line saying how many events
  were read and that none of them cleared the evidence floors - never a line
  claiming "no trace" for a record that merely sits below the floors, and never a
  floor figure, because the envelope returns none and this is the one command
  whose whole posture is that it invents no number. `ok:false` or a missing
  subcommand degrades to one line too. `<guardrails>`: writes no config file and
  no planning file, dispatches no subagent, and states no config key that
  `cadence-core/config.schema.json` does not carry - check 1 fails a dotted token
  the schema lacks, and each suggestion names its own key at runtime anyway. Add
  the file's measured byte count as a row in
  `cadence-core/bin/weight-budgets.json` in the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`
  (no `unbudgeted-surface`, no `unknown-flag`, no `inert-config-key`), and
  `node cadence-core/bin/weight.mjs` reports `cadence-core/workflows/suggest.md`
  at exactly its budgets row.

### Task 2: Ship `/cad-suggest` as a discoverable skill

- **Files:** skills/cad-suggest/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Create `skills/cad-suggest/SKILL.md` in the mold of
  `skills/cad-report/SKILL.md` - the closest existing shape, a thin read-only
  relay over one workflow. Frontmatter: `name: cad-suggest`, a ONE-LINE routing
  description saying it turns the run record into evidence-backed retune
  suggestions and applies none of them, `argument-hint: "[phase]"`, and
  `allowed-tools` of exactly Read and Bash - no Write, no Edit, because the
  command's defining property is that it writes no config. Body: an
  `<objective>` naming what it relays and that every figure comes from the
  record, an `<execution_context>` `@`-including
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/suggest.md`, and a `<process>`
  that runs the workflow end to end. Add the skill's measured byte count as a row
  in `cadence-core/bin/weight-budgets.json` in the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `node cadence-core/bin/weight.mjs` reports `skills/cad-suggest/SKILL.md` at
  exactly its budgets row; and the skill's frontmatter `allowed-tools` contains
  neither `Write` nor `Edit`.
  human-verify: run `/cad-suggest` in this repo and observe (1) each
  recommendation presented with the trace figures behind it and its
  `/cad-config` key named, (2) `.planning/config.json` and the global Cadence
  config byte-identical before and after, and then run it against a `.planning/`
  whose trace is absent and observe exactly one refusal line and zero
  suggestions.

### Task 3: Repoint the milestone close and the report footnote at the one statement

- **Files:** cadence-core/workflows/milestone.md, cadence-core/workflows/report.md, cadence-core/bin/weight-budgets.json
- **Action:** Rewrite `cadence-core/workflows/milestone.md`'s "## 8. Retune
  check" so it no longer restates the presentation contract - the numbered-list
  rule, the `info` receipt lines, "apply NOTHING", the `/cad-config` route and the
  empty-list wording all move out, since they now live in
  `cadence-core/workflows/suggest.md`. In their place the step invokes
  `/cad-suggest` through the SlashCommand tool, exactly as step 7 already invokes
  `/cad-land` and the audit step invokes `/cad-audit`, and names
  `cadence-core/workflows/suggest.md` as where its rules live. Keep the close's
  OWN posture, which is not a presentation rule and lives nowhere else: a failed
  or missing run degrades to a one-line note rather than a halt, because the close
  does not gate on its own accounting. Then rewrite
  `cadence-core/workflows/report.md`'s `done` step so the closing pointer names
  `/cad-suggest` as the front door - with its rules at
  `cadence-core/workflows/suggest.md` - instead of pointing at the raw seam call;
  keep "name it, do not run it unasked", which is `/cad-report`'s own read-only
  posture. Do not delete the pointer: criterion AC7 requires both surfaces to
  point at the new workflow. Re-pin both
  `cadence-core/workflows/milestone.md` and `cadence-core/workflows/report.md` in
  `cadence-core/bin/weight-budgets.json` to their newly measured byte counts in
  the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c 'workflows/suggest.md' cadence-core/workflows/milestone.md` and
  `grep -c 'workflows/suggest.md' cadence-core/workflows/report.md` each return
  at least 1; `grep -c 'apply NOTHING' cadence-core/workflows/milestone.md`
  returns 0; and `node cadence-core/bin/weight.mjs` reports both files at exactly
  their budgets rows.

### Task 4: Register both new commands in the command reference

- **Files:** cadence-core/references/COMMANDS.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a row for `/cad-suggest` and a row for
  `/cad-minimalism-review` to `cadence-core/references/COMMANDS.md`, each in the
  cluster it belongs to: `/cad-minimalism-review` under "## Review & quality
  gates" beside `/cad-plan-review` and `/cad-decision-review`, which are the other
  on-demand standalone gates; `/cad-suggest` under "## Support" beside
  `/cad-report`, whose record it reads. One line of "What it does" each, in the
  register the surrounding rows use, naming the argument shape in the Command
  cell. This file IS `/cad-help`'s registration -
  `skills/cad-help/SKILL.md:14-16` `@`-includes it - so no edit to that skill is
  needed or wanted (D-16). Re-pin
  `cadence-core/references/COMMANDS.md` in `cadence-core/bin/weight-budgets.json`
  to the newly measured byte count in the same commit: the surface sits exactly
  at its row, so two new rows are a `budget-overrun` without the re-pin.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c 'cad-suggest\|cad-minimalism-review' cadence-core/references/COMMANDS.md`
  returns 2; and `node cadence-core/bin/weight.mjs` reports
  `cadence-core/references/COMMANDS.md` at exactly its budgets row.

### Task 5: Update the README's command lists and its skill count

- **Files:** README.md
- **Action:** Add a bullet for `/cad-minimalism-review` to `README.md`'s
  "**Review & quality**" list and a bullet for `/cad-suggest` to its
  "**Support**" list, matching the one-line voice of the bullets around them -
  `/cad-suggest` reads the record `/cad-report` prices and turns it into retune
  suggestions it never applies; `/cad-minimalism-review` returns a ranked
  delete-list over code that works and should not exist. Then correct the stale
  self-description at `README.md:144`, "Today it is 23 skills and 6 agent roles
  across 19 rung files": it was already wrong before this phase (measured
  2026-08-13: 25 user-invocable skills on this branch) and this phase's two new
  commands move it again. Re-measure and state the true numbers rather than
  incrementing the printed one, keeping the sentence a concrete count - the
  paragraph's whole point is the comparison against GSD's seventy-one skills and
  thirty-four agents, and a pointer-to-a-command in that position (the treatment
  `README.md:138`'s byte figures got) would leave the comparison with one side
  missing. Change nothing else in that paragraph. `README.md` is not a
  weight-budgeted surface, so this task re-pins nothing; it is deliberately its
  own commit per `.planning/ROADMAP.md:81`.
- **Verify:** `grep -c 'cad-suggest' README.md` and
  `grep -c 'cad-minimalism-review' README.md` each return at least 1; the count
  in `README.md`'s "Today it is N skills and 6 agent roles across M rung files"
  sentence equals `grep -L "user-invocable: false" skills/*/SKILL.md | wc -l` and
  `ls agents/*.md | wc -l` respectively; and
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`.

### Task 6: Carry the README shift into the claim ledger

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Update `.planning/DOCS-CLAIMS.md` for what task 5 moved and
  changed, following the treatment phase 2 recorded in the same file's line-shift
  section. Re-pin the `line` cell of every `README-*` row whose cited line sits at
  or below the first inserted bullet, so each row names where the live file states
  its claim - `README-39`'s range ("Every command in the three command lists
  exists") and every row below it, including the tail rows from `README-41` on.
  `README-44`'s CLAIM text has itself become false, so correct the text to the
  count task 5 measured and set its `resolution` to `corrected - <sha>` naming
  task 5's commit; leave its `verdict` cell as run 1 recorded it, the way phase 2
  left verdicts alone. Add a short paragraph to the line-shift section stating
  what moved and why - this phase added a `/cad-minimalism-review` bullet and a
  `/cad-suggest` bullet to the command lists, and corrected the skill count - and
  note the one claim-text change explicitly, since the ledger's join is `doc` plus
  claim text and a silently rewritten claim would join to nothing in the next
  sweep. Add no new rows: the ledger holds run-1 provenance and new claims are
  extracted by the next `/cad-docs-verify` run, not hand-added here.
- **Verify:** `grep -c 'cad-suggest' .planning/DOCS-CLAIMS.md` returns at least
  1; for `README-39`, `README-41`, `README-44` and `README-48`, running
  `sed -n '<the row's line cell>p' README.md` prints the line that states that
  row's claim; and `grep -n 'README-44' .planning/DOCS-CLAIMS.md` shows a
  `corrected - ` resolution whose claim text matches the sentence now in
  `README.md`.

## Notes

- D-12 left open whether `/cad-report`'s closing pointer should be deleted
  rather than repointed. It is REPOINTED: AC7 requires `workflows/report.md`'s
  closing pointer to point at `cadence-core/workflows/suggest.md`, which a
  deletion cannot satisfy.
- Step 8 delegates by INVOKING `/cad-suggest` rather than by Reading
  `workflows/suggest.md`. `skills/cad-milestone/SKILL.md` already declares
  SlashCommand and `workflows/milestone.md` already invokes `/cad-audit` and
  `/cad-land` that way, and a Read would earn a `DEFERRED_READS` promotion row
  on a surface CONTEXT's scope boundary does not name.
- This plan shares `cadence-core/bin/weight-budgets.json` with plans 1-3 and
  registers plan 2's command, so it runs last, sequentially.
- The `/cad-capture` rows in `COMMANDS.md` and `README.md` are deliberately not
  touched for plan 3's new arm: the CONTEXT scope boundary names those surfaces
  for this phase's two NEW commands only.
