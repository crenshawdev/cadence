# Phase 1: The filed defects - Context

Gathered: 2026-08-09
Feeds: /cad-plan 1

## Scope boundary

In: The four defects `v2.6.0`'s doc sweep filed rather than reworded away.
DFC-01 - the two literal NUL bytes in `cadence-core/bin/lib/trace.mjs`, plus a
guard that fails against the unpatched file. DFC-02 - the `phase_diff` gate row
in `cadence-core/references/review-triggers.md` and its copy in
`docs/WORKFLOW.md`. DFC-03 - `skills/cad-plan-checker-contract/SKILL.md`'s
five-vs-six self-contradiction. DFC-04 - the `risk_surface` row's qualifier
(the workflow half is already closed; see D-09). Plus the coupling those edits
disturb: the four sites quoting `review-triggers.md`'s size, `docs/EVIDENCE.md`'s
aggregates, and the `.planning/DOCS-CLAIMS.md` rows that link to these filings.

Out: Reverting `cadence-core/workflows/task.md` to shape (a) refs - ROADMAP
criterion 4 forbids losing the path, never-stage and cleanup rules `716fb60`
restored (D-10). Editing `.planning/_archive-v2.5.0/1/PLAN-2.md`, which carries
the same two NULs inside an immutable phase record (D-03). Re-correcting
`METHOD.md` or `cadence-core/workflows/execute.md`'s `phase_diff` prose, already
fixed in `b2bad1a` and `044806c` (D-04). Any of the six older Deferred
requirements (PRS-01, EVD-01, XCP-01, MIN-01, RCL-06, CTX-02).

Deferred: None.

Plan shape: One plan. Every edit is located and small; the two self-verify
checks are the only real work, and the four coupled byte figures have to move in
a single commit anyway to keep CI green.

## Durable decisions

- D-02 (The NUL guard reads raw bytes): The check that proves DFC-01 fixed
  cannot be built on `git grep`. Git's binary heuristic inspects only the head
  of a blob and the NULs sit at offset ~14.8k, so `git grep -n "const worker"
  -- cadence-core/bin` prints the line TODAY and would pass against the
  unpatched file - the vacuous assertion ROADMAP criterion 6 exists to forbid.
  Measured in-tree 2026-08-09: GNU `grep -rn "const worker" cadence-core/bin/`
  exits 1 with no output, `rg -n` exits 0 with no output, `git grep -n` prints
  `cadence-core/bin/lib/trace.mjs:336` rendering the NULs as `^@`. Evidence: the
  three commands above; `cadence-core/bin/self-verify.mjs:326-350` (`binFiles`,
  the existing recursive `.mjs` source walker), `:1024-1041` (check 12, "the
  only check that walks .mjs SOURCE rather than prose").
- D-03 (Scan scope is `cadence-core/bin/**`): The guard scans the surface DFC-01
  and ROADMAP criterion 1 both name, not the whole tree.
  `.planning/_archive-v2.5.0/1/PLAN-2.md:90` carries the same two NULs - copied
  into the archived plan text that specified this key - and `file(1)` reports
  that file as `data` too. A tree-wide guard would land red on its first run
  against an immutable phase record this cycle declared out of scope, forcing
  the phase either to rewrite history or to weaken the guard it just wrote.
  Evidence: `.planning/_archive-v2.5.0/1/PLAN-2.md:90`;
  `.planning/REQUIREMENTS.md` DFC-01; `.planning/ROADMAP.md` phase 1 criterion 1.
- D-10 (Broaden the row's qualifier, never revert `task.md`): DFC-04 is closed
  by dropping "the checkpoint returned" from the `risk_surface` row's shape-(c)
  description, so the row admits a shape-(c) path however it was produced.
  Section 2's own definition of shape (c) is already broad enough ("a file
  artifact... or one the reviewer's tree cannot reach"), so this is the smallest
  correct fix. Admitting shape (a) instead - DFC-04's other stated exit - would
  force `task.md` back to refs, discarding the named path, never-stage rule and
  cleanup that ROADMAP criterion 4 explicitly forbids losing, and would make
  ledger row `TASK-01`'s `corrected - 044806c` resolution false. Evidence:
  `cadence-core/references/review-triggers.md:59-63` (shape definitions), `:243`
  (the row); `cadence-core/workflows/task.md:74-82`;
  `.planning/DOCS-CLAIMS.md:588`.
- D-13 (Zero slack becomes mechanical): `self-verify.mjs` check 4 changes from
  `bytes > budget` to `bytes !== budget`, so a surface that SHRINKS below its
  entry fails too. Today "93 surfaces at exactly their byte count, total slack
  0" is a maintenance convention that `docs/EVIDENCE.md` publishes as though it
  were enforced: the check fails only on overrun, there is no `--write-budgets`
  or any other regeneration command, and entries are hand-edited from
  `weight.mjs`. DFC-03's own fix is the worked example - it shrinks its file by
  one byte and goes silently under budget with CI fully green. The flip passes
  on the clean tree today. Evidence: `cadence-core/bin/self-verify.mjs:634-644`;
  `cadence-core/bin/weight.mjs:84` (report only, no write path);
  `docs/EVIDENCE.md:171-173`; `.planning/tasks/bound-plan-size/PLAN.md:27`.
- D-15 (The ledger records closure): `.planning/DOCS-CLAIMS.md`'s
  `## Defects filed out of this sweep` block names DFC-01..03 as open, and five
  rows carry a `+ DFC-0k` suffix documented as "the row's only link to its
  filing, so a future diff can tell a corrected copy from a fixed source". Both
  are updated as each defect closes. Leaving them frozen makes the ledger assert
  three open filings that shipped, and strips the suffix of the one job it is
  documented as having. Evidence: `.planning/DOCS-CLAIMS.md:91-112`, `:114-116`,
  `:173-175`, `:449-450`.

## Decisions

- D-01 (The NUL fix is two escapes): Two U+0000 bytes at offsets 14815 and
  14831, both inside the single template literal at
  `cadence-core/bin/lib/trace.mjs:336`. Each becomes `\0`, which is
  byte-for-byte behaviour-identical (`` `${a}\0${b}` `` yields a 3-char string
  whose middle code unit is 0) and grows the file by 2 bytes. No budget moves:
  `cadence-core/bin/**` is not a weighed surface. The separator itself is NOT
  changed - a different separator would silently merge or split worker keys in
  `renderTrace`'s pairing map. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs` (five measured branches, `bin/`
  absent); `cadence-core/bin/weight-budgets.json` (93 keys, none under
  `cadence-core/bin/`).
- D-04 (Two `phase_diff` sites remain): `cadence-core/references/review-triggers.md:244`
  and `docs/WORKFLOW.md:168`. `METHOD.md` and `cadence-core/workflows/execute.md`
  were corrected in `b2bad1a` and `044806c` and are not touched here. The live
  values are `off / advisory / adjudicated`. Evidence:
  `cadence-core/route-table.json:47-49`; `cadence-core/config.schema.json:92`
  (`default: "advisory"`); `cadence-core/bin/route.test.mjs:952-989` (all three
  levels asserted through three surfaces).
- D-05 (`docs/WORKFLOW.md` is unguarded and free to correct): It carries no byte
  budget, is not walked by `weighAll`, and has no `.planning/DOCS-CLAIMS.md`
  rows - nothing guards it in either direction. Evidence:
  `cadence-core/bin/weight-budgets.json` (no `docs/` entry);
  `cadence-core/bin/lib/surface-weight.mjs:8-19`.
- D-06 (`METHOD.md:282-283` is a known re-break site): Its sentence about which
  triggers are off at `solo` was already re-corrected once, in `716fb60`, after
  the first correction introduced a self-contradiction nine lines below it. Any
  edit to the source row must leave that derived sentence still true - `diff` is
  ALSO `off` at solo. Evidence: `716fb60`; `METHOD.md:282-283`;
  `cadence-core/route-table.json:47`.
- D-07 (Six is correct, `<success_criteria>` is stale):
  `skills/cad-plan-checker-contract/SKILL.md:41-74` says "Check six dimensions"
  and enumerates six ending in Proportionality, while `:113` still reads "All
  five dimensions checked". `<returns>:91` says "one line per dimension" and
  carries no number, so it needs no edit. Correcting downward instead would
  delete the dimension v2.5.0 shipped a cycle early to install and would
  contradict `METHOD.md:91`, corrected to six in `b2bad1a`.
- D-08 (DFC-03's fix shrinks its surface): 5,344 -> 5,343 against a budget of
  exactly 5,344. Invisible to today's check, which is D-13's motivation; the
  entry is re-pinned in the same commit either way. Evidence:
  `cadence-core/bin/weight-budgets.json`; measured size 5,344 B;
  `cadence-core/bin/self-verify.mjs:639-644`.
- D-09 (DFC-04's workflow half is already closed): `cadence-core/workflows/task.md:73-88`
  already carries all three things ROADMAP criterion 4 says must not be lost -
  the named transient path `.planning/tasks/{slug}/risk-task-{slug}.diff`, the
  never-stage rule, and the delete-on-return cleanup. DFC-04's requirement text
  describes `044806c`'s state, which `716fb60` superseded during `/cad-verify 5`.
  The open work is the wiring-table row alone. **The DFC-04 row in
  `.planning/REQUIREMENTS.md` is corrected in place to say so** (requirement
  wording drift), so the planner is not told to restore prose that is present.
  Evidence: `cadence-core/workflows/task.md:73-88`; `716fb60`;
  `cadence-core/workflows/execute.md:449-457`.
- D-11 (The fire sites are a closed set): `execute.md` (c), `debug.md` (b),
  `verify.md` (b at commit time), `task.md` (c). A check for the shapes must be
  written against that enumeration and must NOT match `verify.md:262`'s
  shape-(c) fire, which is a diagnosis review naming no wiring-table trigger and
  carrying no resolved gate. Evidence:
  `cadence-core/references/review-triggers.md:243`;
  `cadence-core/workflows/execute.md:306-309`, `debug.md:110-112`,
  `verify.md:262`, `:275-281`, `task.md:78-80`.
- D-12 (`17,733` appears in FOUR places): `cadence-core/bin/weight-budgets.json:35`,
  `skills/cad-land/SKILL.md:44`, `skills/cad-plan-review/SKILL.md:39`, and
  `docs/EVIDENCE.md:165` - the fourth is not in ROADMAP criterion 5 and is the
  one a planner working from that criterion alone would miss. `docs/EVIDENCE.md`
  also carries a derived est-token figure (`4,433`) that moves with it. The two
  skill figures are digit-count-neutral while the value stays five digits, so
  those two surfaces keep their exact budgets. Evidence: the four sites above.
- D-14 (`docs/EVIDENCE.md`'s aggregates are already stale): They state 200,050
  for `cadence-core/workflows/` and 475,412 total; summing
  `weight-budgets.json` today gives 200,209 and 475,571. The 159 B gap is
  exactly `716fb60`'s `task.md` growth (4,484 -> 4,643), committed after that
  file's last re-measure at `f8f22cf`. Re-measured in this phase, with the
  cause named so the diff does not read as unexplained drift introduced here.
  Evidence: computed from `cadence-core/bin/weight-budgets.json`;
  `docs/EVIDENCE.md:145-152`; `git log -- docs/EVIDENCE.md`.

## Acceptance criteria

- [ ] AC1: `node cadence-core/bin/self-verify.mjs --root .` fails with a named
      problem when a literal U+0000 is present in any file under
      `cadence-core/bin/**`, proved by planting one and re-running; on the clean
      tree it prints `"problems":[]`, and
      `grep -rn "const worker" cadence-core/bin/` returns the `trace.mjs` line
      without `-a`.
- [ ] AC2: `node --test cadence-core/bin/trace.test.mjs` stays green and
      `renderTrace`'s worker key still separates its parts with U+0000, so the
      change is to the source bytes and not to behaviour.
- [ ] AC3: The `phase_diff` gate cell at
      `cadence-core/references/review-triggers.md` and its copy in
      `docs/WORKFLOW.md` both read what
      `node cadence-core/bin/route.mjs resolve --role cad-reviewer` returns per
      level, and no prose site in the tree still states `phase_diff` as `off` at
      `shipped`.
- [ ] AC4: `skills/cad-plan-checker-contract/SKILL.md` states the same dimension
      count in `<dimensions>` and `<success_criteria>`, and that count equals
      the number of enumerated dimensions in the block.
- [ ] AC5: The `risk_surface` row of the wiring table admits the artifact
      `/cad-task` actually produces, and `cadence-core/workflows/task.md` still
      names its transient diff path, forbids staging it, and deletes it on
      return.
- [ ] AC6: `node cadence-core/bin/self-verify.mjs --root .` fails when any
      budgeted surface's byte count differs from its `weight-budgets.json` entry
      in EITHER direction, proved by planting a one-byte shrink and re-running;
      on the clean tree all 93 surfaces are exactly at budget.
- [ ] AC7: All four sites naming `review-triggers.md`'s size -
      `weight-budgets.json`, `skills/cad-land/SKILL.md`,
      `skills/cad-plan-review/SKILL.md`, `docs/EVIDENCE.md` - state the same
      number that `node cadence-core/bin/weight.mjs --root .` reports, and
      `docs/EVIDENCE.md`'s aggregate totals equal the sums of the budgets it
      tabulates.
- [ ] AC8: `.planning/DOCS-CLAIMS.md`'s `## Defects filed out of this sweep`
      block and every row carrying a `+ DFC-0k` suffix state each defect's real
      status, and `node --test cadence-core/bin/*.test.mjs`,
      `node cadence-core/bin/self-verify.mjs --root .` and
      `npx tsc -p tsconfig.ci.json` are green.

## Flagged assumptions

- The NUL guard's host is either a new `self-verify.mjs` check reusing
  `binFiles(root)` or a `cadence-core/bin/*.test.mjs` file - Likely; left to the
  planner. The trade-off is stated: `binFiles` skips `*.test.mjs`, so a NUL
  typed into a test file would go unguarded, while a check hosted in a
  `lib/*.test.mjs` file sits outside CI's top-level `cadence-core/bin/*.test.mjs`
  glob and never runs in CI. If wrong: the guard exists but does not cover the
  file that reintroduces the defect.
- No mechanical check ties the wiring table to `route-table.json`, and that
  absence is a stated decision rather than an oversight - `self-verify.mjs:886-899`
  draws its gate vocabulary from `config.schema.json` "rather than from parsing
  `references/review-triggers.md`'s Wiring table, which has no stated grammar" -
  Likely. So AC3's mechanical half needs either a stated grammar for that
  table's gate cell or a check that does not parse it. If wrong: a regex over
  prose goes red on a future reformat that changed nothing factual, the failure
  mode `lib/deferred-reads.mjs:31-38` already documents.
