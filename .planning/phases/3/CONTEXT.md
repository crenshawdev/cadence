# Phase 3: The lens and the loop back - Context

Gathered: 2026-08-13
Feeds: /cad-plan 3

## Scope boundary

In: A lean-first build posture for `cad-executor`, stated in a NEW
`cadence-core/references/*` file the contract Reads at one named step and
anchored by a `lib/deferred-reads.mjs` promotion row (D-01), with the declined
fuller option recorded as an `Open items:` line in the executor's report file
(D-02). A NEW on-demand minimalism command - its own skill plus
`cadence-core/workflows/*` file, dispatching the existing `cad-reviewer` role
with a minimalism instruction (D-04) - returning a ranked delete-list in the
shared reviewer findings shape and applying nothing (D-05). A Cadence-directed
arm on `/cad-capture` writing to the user-global Cadence directory beside the
global config layer (D-07), carrying the host project and the provoking
command, transmitting nothing and committing nothing in the target (D-08). The
two CTW-06 prose cuts - `skills/cad-land/SKILL.md`'s `<guardrails>`
re-derivation of the `git.auto_close` mechanic and
`cad-executor-contract`'s duplicated static-analysis carve-out - each with its
`weight-budgets.json` row re-pinned in the same commit (D-10, D-11). A NEW
`/cad-suggest` command whose `cadence-core/workflows/suggest.md` becomes the
ONE statement of the presentation rules, with `workflows/milestone.md` step 8
and `workflows/report.md`'s closing pointer rewritten to point at it (D-12).
Plus the surfaces those changes force: `weight-budgets.json` rows for every new
and cut surface, `/cad-suggest` and the minimalism command in
`cadence-core/references/COMMANDS.md` (which IS the `cad-help` registration,
D-16), `README.md`, and the `.planning/DOCS-CLAIMS.md` rows this phase's line
shifts touch.

Out: No new routable role, route-table cell or rung agent file (D-04). No sixth
`review` trigger, no `minimalism` key in `config.schema.json`'s trigger set, and
so no edit to the "five triggers" claims in `docs/WORKFLOW.md` and
`references/review-triggers.md` (D-04). No sixth field on the executor's return
digest and no widening of the deviation definition (D-02). No new taxonomy of
change shapes in the executor contract (D-03). No redaction machinery -
`EVD-01` stays deferred (D-09). No network delivery and no commit outside the
current repo (D-08). No seam edit for the thin-trace refusal, no new
`trace suggest` flag, and no `corr` scoping (D-13, D-14). No change to
`trace-suggest.mjs`'s denominators (D-15).

Deferred: None.

Plan shape: multiple plans, same phase - /cad-plan breaks it down. The four
requirements share almost no surface: MIN-01's build half is the executor
contract plus a register row, MIN-01's review half is a new command dispatching
an existing role, XCP-01 is a new write target outside every project boundary
`/cad-capture` respects today, CTW-06 is two prose cuts with re-pins, and
TUN-01 is a new command plus a three-surface registration. CTW-06's executor
cut and MIN-01's executor Read touch the same file and the same budget row, so
they sequence together rather than in parallel.

## Durable decisions

- D-01 (Lean posture placement): The lean-first posture ships as a NEW
  `cadence-core/references/*` file that `skills/cad-executor-contract/SKILL.md`
  Reads at one named step, registered as a PROMOTION row in `DEFERRED_READS` -
  not as a new `@`-include and not as inline contract prose. Evidence:
  `.planning/ROADMAP.md:73` (criterion 1 names the register row);
  `cadence-core/bin/lib/deferred-reads.mjs:22-45` states the promotion-row
  doctrine for "prose that was never an `@`-include at all", and `:226-230`
  shows the contract already carrying one such row anchored `worktree_mode`;
  `cadence-core/bin/self-verify.mjs:1121-1125` (check 13 applies to contract
  skills - "a dispatch context is a context"). Measured 2026-08-13 via
  `node cadence-core/bin/weight.mjs`: the contract is 10,372 B against a 10,372
  budget row, so inline prose is a `budget-overrun` on its own. An eager
  `@`-include additionally lands under check 16's consumer rule with no
  register row watching it - the resident-bytes objection that deferred MIN-01
  out of two cycles.
- D-02 (Declined build record): The rejected fuller option is recorded as an
  `Open items:` line in the executor's report FILE, not as a `[deviation]`
  line, and the five-field return digest gains no field. Evidence:
  `skills/cad-executor-contract/SKILL.md:81-101` defines a deviation as
  "exactly ONE thing - an acceptance criterion or a locked decision turned out
  wrong" and explicitly excludes shape choices ("Choosing a shape the Action
  did not picture... is not a deviation, and you do not record it"), routing
  everything else to an open item; `:183-191` gives the report file both
  `Deviations:` and `Open items:` lines; `:200-214` forbids a sixth digest
  field. Widening the deviation definition was rejected on `:95-96`, which
  treats deviation narrowness as the signal ("A report with a dozen of them is
  evidence the plan was authored above its knowledge"); a third `Declined:`
  report field was rejected because `cadence-core/workflows/execute.md`'s
  SUMMARY writer would have to learn it. This is why REQUIREMENTS.md's MIN-01
  row was corrected in this pass - its "deviation record" wording is a shape
  the shipped contract cannot carry.
- D-04 (Minimalism pass shape): The pass is an on-demand command in the
  `/cad-decision-review` mold - its own skill and `cadence-core/workflows/*`
  file dispatching the EXISTING `cad-reviewer` role with a minimalism
  instruction - not a sixth `fire(trigger)` and not a seventh routable role.
  Evidence: `cadence-core/route-table.json:16` declares a closed `roles` array
  of six (phase 2 D-03); `cadence-core/bin/lib/route-cells.mjs:221-232` makes
  any schema trigger mandatory in all three `review` rows (`missing-cell`) and
  any review key absent from the schema an `unknown-trigger`;
  `.planning/_archive-v2.5.0/2/CONTEXT.md:104-113` already priced this same lens
  as a trigger at "at least six mutually self-verified surfaces - three schema
  keys, a `route-table.json` gate at all three levels, a `config-reach.md` row,
  the `/cad-config` catalog, the wiring table and a fire site";
  `cadence-core/workflows/decision-review.md:1-15,44-80` is the shipped
  precedent for a pass with no wiring-table row and no routing cell ("the base
  `cad-reviewer` at the session default, at every stakes level"). A sixth
  trigger would additionally drift `docs/WORKFLOW.md:132,144` and
  `cadence-core/references/review-triggers.md:259-271`, which both state "five
  triggers", plus README row `README-34`. A `/cad-verify --deep` arm was
  rejected because the delete-list would then ride a gate whose verdict is UAT
  completion.
- D-07 (Capture queue home): The Cadence-directed queue is the user-global
  Cadence directory beside the global config layer (`~/.claude/cadence/`,
  relocatable by `CADENCE_GLOBAL_CONFIG`), with a Cadence checkout path as an
  optional override rather than the primary. It is explicitly NOT under
  `${CLAUDE_PLUGIN_ROOT}`. Evidence: measured 2026-08-13 with `ls` and `test -w`
  over all 8 cache versions at
  `/home/john/.claude/plugins/cache/cadence/cadence/*` - every version dir is
  writable, none is a git checkout, each ships a `.planning/` tree and none
  carries a `CAPTURE.md`, because `.gitignore:26` keeps `.planning/CAPTURE.md`
  out of the shipped tree. `cadence-core/bin/lib/config-merge.mjs:11-26` defines
  the global path and its env override and degrades to no layer when
  `homedir()` throws; the directory exists in the field
  (`/home/john/.claude/cadence/config.json`, 2026-08-12);
  `cadence-core/bin/config.mjs:242-243` shows `--global` already addressing it.
  A cache write is orphaned by the next plugin upgrade - the 2.0.0 through
  2.7.0 dirs on this machine are already inert - so the loop XCP-01 exists to
  close would silently drop its input. A config key naming a checkout was
  rejected as dead for every installed-plugin user; keeping the note in the
  host's own CAPTURE.md under a distinct section was rejected because the note
  then stays in the host repo the requirement says it must leave.
- D-08 (No transmission, no foreign commit): A cross-project capture makes no
  commit in the target and Cadence transmits nothing; delivery to a maintainer
  who is not the user stays a manual export. Evidence:
  `skills/cad-capture/SKILL.md:39-43` commits only `.planning/CAPTURE.md` in
  the CURRENT repo ("Stage ONLY `.planning/CAPTURE.md`... this never touches the
  user's in-flight changes"), and the global target is not a repo working tree
  (D-07's measurement); `.gitignore:24-26` gitignores Cadence's own queue on
  purpose ("keeps candid working notes out of the public repo"), so even the
  maintainer's landed notes are local-only; `README.md:132` claims Cadence
  ships no instrumentation and phones nothing home, carried as ledger row
  `README-41` in `.planning/DOCS-CLAIMS.md`. Any network delivery breaks a
  CI-checked prose claim, and a commit in an unrelated tree makes `/cad-capture`
  a writer outside the project boundary every other seam respects
  (`cadence-core/bin/planning.mjs:2244-2251`, the `--root`-refuses-empty rail).
- D-10 (Cut plus re-pin): Both CTW-06 cuts are prose deletions replaced by a
  pointer, and both `weight-budgets.json` rows are re-pinned to the newly
  measured values in the same commit even though check 4 does not demand it.
  Evidence: `.planning/ROADMAP.md` criterion 4;
  `cadence-core/bin/self-verify.mjs:698-703` states the check is "A CEILING, not
  an equality... re-pin the row when convenient, or leave the headroom" (phase 1
  D-16); measured 2026-08-13 via `node cadence-core/bin/weight.mjs`, both
  surfaces sit at exactly their pins - `skills/cad-land/SKILL.md` 12,076/12,076
  and `skills/cad-executor-contract/SKILL.md` 10,372/10,372 - so the cut is
  invisible to CI and the re-pin is the only thing stopping the bytes coming
  back. That is the ratchet CTW-03 set the same-commit rule to preserve.
- D-11 (cad-land cut scope): The `cad-land` cut is scoped to the
  `<guardrails>` block's re-derivation of the `git.auto_close` mechanic; the
  step-3 and step-4 Read sentences and the "NOT scoped to the GitHub arm"
  clause are untouched at SENTENCE granularity. Evidence:
  `skills/cad-land/SKILL.md:197-201` is the re-derivation ("it SKIPS the 4a ask
  rather than preselecting a default in it, and it still halts on a blocking
  `pre_ship` finding"), restating `:67-75` and `:104-109`; the named keeps are
  `:198` and `:113-115`; `cadence-core/bin/lib/deferred-reads.mjs:161-180`
  anchors regions `3`, `4(a)` and `4(b)` and `:88-104` records that the matching
  unit is the SENTENCE, so an edit that merges or splits the 4(b) Read sentence
  fails check 13 while deleting nothing;
  `cadence-core/bin/prose-agreement.test.mjs:267-278` grandfathers all three
  `cad-land` rows out of the consult-site-count arm, so only check 13's `unread`
  arm binds here. Editing near `:110-117` drops `deferred-read-unread` on region
  `4(b)` - the unattended arm then reaches `gh pr merge` with
  `references/git-publish.md` never loaded, the reproduced defect the register's
  header documents.
- D-12 (One statement of the suggest rules): The presentation rules live in ONE
  place and it is the new `cadence-core/workflows/suggest.md`;
  `cadence-core/workflows/milestone.md` step 8 and `workflows/report.md`'s
  closing pointer are REWRITTEN to point at it rather than restating it.
  Evidence: TUN-01's claim that the only path to the tuner is a one-line
  pointer at the end of `/cad-report` is contradicted by
  `cadence-core/workflows/milestone.md:155-172`, which already runs
  `planning.mjs trace suggest` and already states the whole contract - `suggest`
  as a numbered list naming each config key, `info` as receipt lines, "apply
  NOTHING", the `/cad-config` route, and "an empty list is reported as 'the
  record supports no retune'"; `cadence-core/workflows/report.md:67-71` is the
  footnote; phase 2 D-02 fixes the skill-plus-one-workflow shape and
  `lib/include-consumers.mjs` exempts a `cadence-core/workflows/*` include from
  check 16. Restating the rules in the new workflow would add a third copy in
  the phase that is cutting two; pointing at `milestone.md` instead was rejected
  because it is at 9,427/9,427 and makes a new command depend on a
  close-workflow surface.
- D-13 (Thin-trace refusal is prose): The thin-trace refusal is prose in the new
  workflow, not a seam change: the seam reports success with an empty list and
  the only discriminator available is `events_read`. Evidence: measured
  2026-08-13, four cases via
  `node cadence-core/bin/planning.mjs trace suggest --dir <d>/.planning` -
  absent trace returns
  `{"ok":true,"scope":"all","events_read":0,"suggestions":[]}`, an empty file
  returns the same, a lone `routing/resolve` event returns
  `events_read:1, suggestions:[]`, and the live repo record returns 9
  suggestions. The arm at `cadence-core/bin/planning.mjs:2364-2383` emits only
  `{scope, events_read, capped?, malformed?, suggestions}` - no `corr` and no
  floor report. A refusal line claiming "no trace" when the trace is merely
  below the floors is an invented figure in the one command whose whole posture
  is that it invents none (phase 1 D-03, D-06).

## Decisions

- D-03 (Posture is a boundary, not a taxonomy): The lean posture is stated as a
  boundary inside the executor's existing rules, never as a new taxonomy of
  change shapes. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:219-226` asserts the executor
  contract never re-grows `**Trivial` and never re-carries "input validation,
  error handling" - the buckets that "sorted departures by shape rather than
  authorization"; `:212-214` pins "Your authority is the task's `Verify:`". A
  lean-versus-fuller bucket list trips that test in CI, and a "build the lean
  shape" licence stated outside `Verify:` re-opens the unplanned-write path
  those assertions closed.
- D-05 (Delete-list return shape): The delete-list returns in the reviewer
  subsystem's existing
  `{findings:[{file,line,severity,claim,failure_scenario}]}` shape, with
  `severity` carrying the rank, and its apply-nothing posture is the triage
  gate's arms minus any fix arm. Evidence:
  `skills/cad-reviewer-contract/SKILL.md:50-71` states that schema is shared
  with every cross-model backend "so an adjudicator can merge your findings
  with theirs without knowing which reviewer produced which";
  `cadence-core/references/triage-gate.md:1-13` holds the apply-nothing arms;
  `cadence-core/bin/lib/trace-suggest.mjs:53-63` shows the adjudication detail
  line the trace already parses per trigger. A bespoke ranked-list shape loses
  the cross-model interchangeability and the adjudication path that parses
  survivor counts.
- D-06 (Minimalism config shape): Any config the minimalism pass takes follows
  `review.decision_review`'s two-key shape - `tier` and `effort`, no `gate` -
  stays out of the `/cad-config` catalog, and still earns a `config-reach.md`
  row plus a prose mention. Evidence: `cadence-core/config.schema.json` carries
  `review.decision_review.tier`/`.effort` and no gate;
  `cadence-core/workflows/config.md:28-34` names those two keys as one of four
  edit-the-file-only sets "which belong to an on-demand command rather than the
  phase loop"; `cadence-core/references/config-reach.md:173-174` shows both
  rows; `cadence-core/bin/self-verify.mjs:685-688` files `inert-config-key` for
  any schema key no prose mentions. Taking no keys at all and running at the
  session default is the cheaper arm and is the planner's call.
- D-09 (No redaction machinery): No redaction machinery is built. The capture is
  the author's own sentence plus two mechanically-known fields - host project
  and provoking command - and the rule that nothing else is quoted is stated
  prose. Evidence: `EVD-01`'s `trace export` redaction is DEFERRED and unbuilt
  (`.planning/REQUIREMENTS.md:170`); a grep for `redact` across `cadence-core/`
  hits only `bin/trace.test.mjs` and a fixture, so there is no rule to reuse;
  run 2026-08-13, `planning.mjs status` returns no project name and
  `cursor get` returns only `{phase,total,name,status,next,updated}`, so host
  identity has to come from the repo (remote URL or directory) rather than a
  seam. Redacting by destination with a token filter is `EVD-01`'s machinery
  arriving early under a different id; carrying no host/command fields drops the
  two fields ROADMAP criterion 3 names.
- D-14 (Scope is reported, not narrowed): `/cad-suggest` reports the scope it
  actually read, including that an unscoped run spans every milestone in the
  file; it adds no pruning, no new flag and no `corr` scoping. Evidence:
  measured 2026-08-13 over `.planning/trace.jsonl` (261 events) - phases appear
  as both numbers (v2.x, `corr` `"1"`-`"5"`, dated 2026-08-07) and strings
  (v3.1.0, `corr` `"2-b3748a4"`, dated 2026-08-12/13), and
  `cadence-core/bin/lib/trace.mjs:132-139` keys by `String(v)`, so
  `trace suggest --phase 1` reads 103 events, 64 from the old cycle and 39 from
  this one, while `trace render --phase 1` reports a `''` role with 4
  unrecorded dispatches beside the current roles under one derived `corr`.
  Nothing in `cadence-core/workflows/milestone.md` or
  `cadence-core/bin/lib/milestone-prune.mjs` prunes the trace at a close.
  `cadence-core/bin/self-verify.mjs:216-218` fixes `trace suggest`'s flag set to
  `--phase` alone, so any scoping flag is a CONTRACTS-row change in the same
  commit (phase 1 D-15). Defaulting to the cursor's phase contradicts the
  seam's stated "No `--phase` means the WHOLE record on purpose"
  (`cadence-core/bin/planning.mjs:2366-2369`).
- D-15 (Rules relayed unchanged): The suggest rules are relayed unchanged,
  including R3's resolve-denominated evidence, which on a cross-model-only
  configuration counts routing decisions no agent acted on. Evidence:
  `cadence-core/bin/lib/trace-suggest.mjs:138-153` counts `routing/resolve`
  events, not brackets; measured on this repo 2026-08-13, the global layer sets
  `review.reviewers = ["openai"]` so no `claude-subagent` reviewer is
  dispatched, yet `trace suggest --phase 1` returns "start rung held across 12
  resolves, 0 escalations" for `cad-reviewer` while `trace render --phase 1`
  shows `cad-reviewer: {dispatches: 1, unrecorded: 1}`. This reproduces the open
  `.planning/CAPTURE.md` note of 2026-08-12, which reported the same shape at 20
  resolves; the count differs because the phase filter also admits the older
  cycle. Correcting it means editing `trace-suggest.mjs`'s denominators, which
  is outside this phase's scope - so the command relays the figure and the
  defect stays a capture item.
- D-16 (Registration surfaces): Registration is COMMANDS.md plus README.md plus
  DOCS-CLAIMS.md, and `skills/cad-help/SKILL.md` needs no edit of its own.
  Evidence: `skills/cad-help/SKILL.md:14-16` `@`-includes
  `cadence-core/references/COMMANDS.md`, so the COMMANDS row IS the help
  registration; that surface is at 4,370/4,370 (measured 2026-08-13), so a new
  row needs a re-pin in the same commit (phase 2 D-14 makes an
  `unbudgeted-surface` a hard problem); `README.md:100-128` holds the three
  command lists that ledger row `README-39` covers as "103-126", and
  `.planning/DOCS-CLAIMS.md:194-210` shows phase 2 re-pinning 19 README rows for
  exactly this kind of insertion (phase 1 D-17). The README update is its own
  execution task, per `.planning/ROADMAP.md:81`.
- D-17 (Stale skill count): `README.md:142`'s "Today it is 23 skills and 6 agent
  roles across 19 rung files" is ALREADY stale before this phase touches it -
  measured 2026-08-13, user-invocable skills are 25 on this branch (24 at
  `main`) - and this phase's two new commands make it 27. The README task
  corrects it, and converting it to a reproducible pointer the way the byte
  figures above it were converted (`README.md:138`, "run
  `node cadence-core/bin/weight.mjs resident --root .`") is the planner's call,
  recorded as a ledger `resolution` either way. Left alone, the phase ships a
  README whose self-description is wrong by four.

## Acceptance criteria

- [ ] AC1: `cadence-core/bin/lib/deferred-reads.mjs` carries a register row for
      the new lean-posture reference file,
      `skills/cad-executor-contract/SKILL.md` names that file in a `Read` at the
      step the row anchors, and `node cadence-core/bin/self-verify.mjs` reports
      no `deferred-read-unread`, no `budget-overrun` and no
      `unbudgeted-surface`.
- [ ] AC2: The executor contract's deviation rules state that a declined fuller
      option is recorded as an `Open items:` line, its return digest is still
      exactly five fields, and
      `node --test cadence-core/bin/prose-agreement.test.mjs` is green.
- [ ] AC3: The new minimalism command run against a named target returns a
      ranked delete-list in the reviewer findings shape, `git status --short` is
      byte-identical before and after the run,
      `cadence-core/route-table.json`'s `roles` array still holds six entries,
      and `cadence-core/config.schema.json` has no `minimalism` review trigger.
      (human-verify: needs a walked minimalism-command run)
- [ ] AC4: A Cadence-directed `/cad-capture` run from inside a host project
      appends an entry naming the host project and the provoking command to the
      global Cadence queue, and the host repo's `.planning/CAPTURE.md` and
      `git status --short` are both unchanged.
      (human-verify: needs a walked `/cad-capture` run from a host project)
- [ ] AC5: `skills/cad-land/SKILL.md` states the `git.auto_close` mechanic once
      with its `<guardrails>` block no longer restating it, while the
      no-preselected-default sentence and the not-scoped-to-GitHub clause both
      survive verbatim; `skills/cad-executor-contract/SKILL.md` states the
      static-analysis carve-out once with a pointer to `<deviation_rules>`; both
      `weight-budgets.json` rows equal the measured byte counts in the same
      commit; and `node cadence-core/bin/self-verify.mjs` is green with no
      `deferred-read-unread`.
- [ ] AC6: `/cad-suggest` on this repo's own trace presents each recommendation
      with the trace figures behind it and names its `/cad-config` key, leaves
      `.planning/config.json` and the global Cadence config byte-identical, and
      against a `.planning/` whose trace is absent or below the evidence floors
      emits exactly one refusal line and zero suggestions.
      (human-verify: needs a walked `/cad-suggest` run)
- [ ] AC7: `/cad-suggest` appears in `cadence-core/references/COMMANDS.md`,
      `README.md` and `.planning/DOCS-CLAIMS.md`, and
      `cadence-core/workflows/milestone.md` step 8 plus
      `cadence-core/workflows/report.md`'s closing pointer both point at
      `cadence-core/workflows/suggest.md` instead of restating the presentation
      rules.

## Flagged assumptions

- The lean-posture reference file's name and the minimalism command's name are
  the planner's call, constrained only by D-01 (a promotion row, not an
  `@`-include) and D-04 (skill plus one `cadence-core/workflows/*` file). If
  wrong: a rename after the register row and the budget rows land forces a
  three-surface edit in a later commit.
- Whether the minimalism pass takes config keys at all is left open by D-06,
  which settles only the SHAPE if it does. Likely no keys, running at the
  session default like decision-review's claude-subagent arm. If wrong: two
  schema keys arrive with a `config-reach.md` row and a prose mention nobody
  needs, and `inert-config-key` fires if the prose is forgotten.
- How the host project is identified for a cross-project capture - remote URL,
  directory basename, or both - is unsettled; D-09 establishes only that it
  comes from the repo rather than a seam, since no seam returns a project name.
  If wrong: a capture from a worktree or a detached checkout names something the
  maintainer cannot map back to a project.
- `.planning/ROADMAP.md`'s phase-3 criterion 1 still says "records the fuller
  option in its deviation record", the wording D-02 contradicts and the
  REQUIREMENTS.md MIN-01 row was corrected away from in this pass. The roadmap
  was left alone because this workflow edits at most one REQUIREMENTS row. If
  wrong: `/cad-verify 3` reads a roadmap criterion naming a record shape AC2
  forbids.
- `.planning/PROJECT.md`'s `### Active` block lists seven requirements for
  v3.1.0 and omits `TUN-01`, which `.planning/ROADMAP.md:79` names in this
  phase and `.planning/REQUIREMENTS.md:24` tracks as #110. Assumed a stale
  count from before TUN-01 was scoped in, corrected at the milestone close
  rather than here. If wrong: `/cad-audit` counts eight requirements against a
  project doc claiming seven.
- Whether `/cad-report`'s closing pointer should be deleted outright rather than
  repointed at `workflows/suggest.md` is the planner's call; D-12 settles only
  that the RULES live in one place. If wrong: the footnote survives as a third
  mention of a command that now has a front door.
