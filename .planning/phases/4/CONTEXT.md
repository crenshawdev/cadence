# Phase 4: Costs argued from the new record - Context

Gathered: 2026-08-17
Feeds: /cad-plan 4

## Scope boundary

In: The record phase 2 taught to see turns and window gets spent. A dispatch's
live context window carries a per-role token ceiling and a crossing is REPORTED
in the `budget-overrun` shape self-verify already uses (MSR-03); bulk tool
OUTPUT rides a file with the rule stated once, a register of the sites, and a
self-verify check that reads it (TRN-02); and `workflow.max_plan_tasks` carries
a written decision against both forces - cold-prefix cost and context risk -
with the measured figure behind each (PLN-01). Each lands with a check watched
failing against the unpatched code first.

Out: Recording a NEW window key, or any host-capture mechanism to obtain one -
phase 2 D-02 settled that the figure comes off the host's subagent return and
Cadence adds no hook or seam for it. Refusing a dispatch on a crossing (D-04).
A declared-`files:` byte rail as the window budget: D-06 measured it as a
different quantity, and it may still land later as its own honestly-named
pre-dispatch figure, but it is not MSR-03. Cache-hit-rate work of any kind -
the rate is 96.1% and cache-read is the cheap rate. Storing any multiplier or
ratio constant (phase 2 D-06). SGT-01 and MSR-04, which are phase 5.

Deferred: None.

Plan shape: multiple plans, same phase - split by requirement, since the three
sit on disjoint seams (a config key plus a `planning.mjs trace` reader; a
register plus a rule module plus a self-verify walk; a written decision on an
existing surface). Shared surfaces - `cadence-core/bin/weight-budgets.json`,
the `CONTRACTS` table in `cadence-core/bin/self-verify.mjs`, and
`cadence-core/references/config-catalog.md` - get explicit `files:` leases per
plan.

## Durable decisions

- D-01 (MSR-03): The budgeted quantity is the `tokens` value on a `brackets[]`
  row of `trace render` - the `return`/`checkpoint` lifecycle event's
  `--tokens` - read as a FINAL-WINDOW PROXY. No new window key is recorded and
  no new capture mechanism is added. Carries phase 2 D-02 forward, which settled
  that the figure comes off the host's subagent return metadata and that Cadence
  adds no hook, seam or capture path to obtain it. Evidence:
  `cadence-core/bin/lib/trace.mjs` (bracket rows carry
  `corr/phase/plan/role/event/ts/end/ms/tokens/turns` and no window field),
  `cadence-core/workflows/report.md` (already states it in those words - the
  per-dispatch window figure is the `tokens` on each `brackets[]` row, and it is
  a PROXY behaving like that dispatch's final context window rather than a sum
  across its turns). If wrong: the budget is denominated in a figure nothing in
  `trace.jsonl` holds, so MSR-03 needs the capture path phase 2 forbade.
- D-02 (MSR-03): The budget is stated PER ROLE rather than as one global window
  number. Measured 2026-08-17 over all 153 `return` events in
  `.planning/trace.jsonl`: `cad-verifier` n=24 mean 73,354 (47,148-131,728),
  `cad-plan-checker` n=5 mean 57,563, `cad-reviewer` n=2 mean 101,944,
  `cad-assumptions-analyzer` n=24 mean 131,541, `cad-executor` n=60 mean 144,752
  (51,988-275,285), `cad-planner` n=27 mean 165,185 (79,918-247,585). The
  rejected alternative was one ceiling argued from the 121,250 seven-day average
  with the role named in the detail string only. Evidence:
  `cadence-core/bin/weight-budgets.json` (per-surface, not global),
  `cadence-core/bin/lib/resident-weight.mjs` (already reports per-role
  `dispatchBytes`). If wrong: a single ceiling near the average never fires on a
  verifier dispatch and fires on roughly half of all executor and planner
  dispatches, so the check reports the role mix rather than a crossing.
- D-03 (MSR-03): The crossing is reported by a seam that can SEE A RUN - the
  `planning.mjs trace` surface - reusing self-verify's `budget-overrun` problem
  SHAPE (`{kind, file, detail: "<n>B exceeds budget <m>B by <d>B"}`) rather than
  by adding a check inside `self-verify.mjs`. That file's prose-budget check
  walks `weighAll(root)` only, and its full-tree predicate is
  `existsSync(join(root, '.claude-plugin', 'plugin.json'))` - the PLUGIN root,
  which in a consumer install is not the project holding `.planning/trace.jsonl`.
  A grep for `.planning` across that file returns two comment mentions and zero
  reads. Evidence: `cadence-core/bin/self-verify.mjs:888-909`, `:631`. If wrong:
  the check passes in this repo (where plugin root and project root coincide) and
  is silently inert in every consumer install - the exact "control that never
  reached its path" shape phase 1 of this milestone existed to remove.
- D-04 (MSR-03): The crossing is REPORTED after the fact, never refused.
  Nothing in the dispatch seam can resize or cancel a running dispatch, so a
  window budget is a post-return finding by construction. Evidence:
  `cadence-core/references/seams.md:56-72` (`maxTurns: 200` is "the only [bound]
  this seam has: no wall-clock kill, and no way to cancel a dispatch already
  running", and records `subagent_timeout` deleted in v2.7.0 "for naming a
  control nothing could apply"); all 19 files under `agents/` carry
  `maxTurns: 200` and no window key. If wrong: the phase ships a refusal at a
  seam with no authority to stop anything, recreating the deleted-key mistake
  the same reference cites as precedent.
- D-05 (MSR-03): The ceiling's number lives as a `config.schema.json` KEY,
  mirroring `review.max_prompt_tokens`'s int/min/default/purpose row - not as a
  manifest beside the check. The rejected alternative was a sibling to
  `weight-budgets.json` under phase 1's D-15 re-pin discipline, and that file's
  own `_comment` argues against this decision in terms ("This is NOT a
  config.schema.json key - do not migrate it into config; it is a manifest
  beside the check"). It is overridden because the budgeted quantity here is
  per-PROJECT rather than per-shipped-surface: the measured per-role means span
  57k-165k on this repo, and a repo whose files are twice this one's size needs
  a different number. The `subagent_timeout` objection - a config key no seam can
  enforce - does not apply, because D-03's reporting seam does enforce it, as a
  report. Evidence: `cadence-core/config.schema.json:58`
  (`review.max_prompt_tokens`, int, default 120000),
  `cadence-core/bin/review-provider.mjs:385-389` (`assertUnderCap`, reason
  `over-cap`), `cadence-core/bin/weight-budgets.json` (`_comment`). If wrong: a
  pinned manifest value makes a per-project window untunable.
- D-06 (MSR-03): A plan's DECLARED read-set weight is NOT a usable proxy for the
  live window, so a budget built on declared bytes budgets a different quantity
  than MSR-03 names. Measured 2026-08-17, n=5 (every plan in this repo carrying
  both a declared `files:` list and a `return` bracket with `tokens`), summing
  `statSync` on each frontmatter entry over 4: `phases/2/PLAN-1.md` 174,262 est
  tok declared vs 185,999 actual (1.07x); `2/PLAN-2` 84,270 vs 151,188 (1.79x);
  `3/PLAN-1` 51,174 vs 196,928 (3.85x); `3/PLAN-2` 42,508 vs 130,795 (3.08x);
  `3/PLAN-3` 41,398 vs 89,618 (2.16x). This CONTRADICTS the recalled
  `.planning/CAPTURE.md` claim (phase-2 execute run, 2026-08-13) that "the
  declared source is ~90% of the bill": on phase 3 the declared set accounts for
  26-47% and the rest is in-dispatch reading. If wrong: the phase ships the
  `plan-weight`-style declared-byte rail CAPTURE.md proposes, and it passes
  cleanly on the three phase-3 plans whose live windows ran 89k-197k, so the
  budget never sees the crossings it exists for.
- D-07 (TRN-02): "Bulk" is MEASURED rather than asserted, because
  `.planning/reads.jsonl` already records the tool RESPONSE byte length rather
  than the input file size. Measured 2026-08-17 over all 9,587 rows: coverage
  1.000, 26.2 MB total, `Bash` n=8,770 mean 2,073 max 35,404, `Read` n=780 mean
  10,323 max 63,190, and 189 calls returned over 20 KB. Top targets by total
  output: `Bash:sed` 6.27 MB, `Bash:grep` 3.21 MB, `Bash:cat` 3.11 MB,
  `Read:.planning/PROJECT.md` 1.22 MB over 50 calls. The field is taken
  OPPORTUNISTICALLY and is undocumented for PostToolUse (user's call, 2026-08-17);
  `bytesCoverage` in `summarizeReads` already reports a fraction rather than a
  total, so a host that stops sending it reads as degraded rather than as zero.
  Evidence: `cadence-core/bin/lib/read-trace.mjs:251-261`.
- D-08 (TRN-02): The registered sites are PROSE sites that prescribe a
  bulk-output tool call, and the conversion is a shell REDIRECT plus a digest in
  the transcript - not a new seam, flag or subcommand. The precedent exists
  twice already. Evidence: `cadence-core/references/review-triggers.md:190-215`
  (composes the payload FILE in two shell steps against the "EXISTING
  `--payload <file>` flag - no new subcommand or flag", redirecting
  `git diff <base_ref>..<head_ref> > "${TMPDIR:-/tmp}/cad-artifact.txt"`),
  `skills/cad-executor-contract/SKILL.md:163-179` and
  `cadence-core/workflows/execute.md:236-242` (RES-01's `reports/plan-<k>.md`
  plus a digest return), `cadence-core/workflows/verify-deep.md:39`. The
  rejected alternative was a seam subcommand writing the output and returning a
  digest envelope. If wrong: a new seam is built for a transport two shipped
  sites already perform with a `>` redirect, and self-verify's `CONTRACTS` table
  gains rows for flags nothing needed.
- D-09 (PLN-01): The cold-prefix figure the decision names comes from
  `weight.mjs resident`'s per-role `dispatchBytes`, and that term is SMALL - so
  the written argument must say what the REST of the window is rather than
  resting on the prefix. Measured 2026-08-17 via
  `node cadence-core/bin/weight.mjs resident`: `agents/cad-executor.md`
  `dispatchBytes` 12,488 (~3,122 est tok), `cad-planner` 11,664, `cad-verifier`
  11,277, `cad-assumptions-analyzer` 5,986; `zeroResidentBytes` 38,492. Against
  a measured executor mean return of 144,752 tokens the fixed prefix is ~2% of a
  dispatch. Evidence: `cadence-core/bin/lib/resident-weight.mjs:1-45`. If wrong:
  the decision names a force worth 2% of a dispatch as one of two co-equal
  terms, and lands on a number the record does not support - the "asserted
  constant" the success criteria forbid.
- D-10 (PLN-01): The written decision lands on a surface a CHECK already binds -
  the `config-catalog.md` row and the schema `purpose` string - not only in a
  phase SUMMARY. Evidence: `cadence-core/references/config-catalog.md:30`,
  `cadence-core/config.schema.json:31`, `cadence-core/bin/self-verify.mjs:866-873`
  (files `inert-config-key` for a schema key no prose token references);
  `design-notes/` is tracked and is a viable second home for the dated
  arithmetic. If wrong: the decision is recorded only in
  `.planning/phases/4/SUMMARY.md`, which `milestone-prune` removes at the close -
  the exact reachability failure RCL-07 was filed for in phase 1 of this
  milestone.
- D-11 (mechanics): The prose-surface budget check is a CEILING, not an
  equality - a surface UNDER its pin passes, and there is no shrink arm. This
  CORRECTS the standing summary carried into this phase and the ROADMAP's
  phase-4 phrase "fails self-verify on a crossing in either direction". The
  v2.6.1 shrink arm named in `PROJECT.md` was later removed. Evidence:
  `cadence-core/bin/self-verify.mjs:882-908` - "A CEILING, not an equality.
  Exactness was tried and cost more than it caught... A surface under its entry
  is a surface that got smaller, which needs no gate" - and the code is
  `if (bytes > budget)` with the single kind `budget-overrun`. If wrong: MSR-03
  is planned to mirror a two-directional failure that does not exist, so it
  ships a shrink arm the tree deliberately removed, and the plan's "same failure
  shape" claim is false in its own terms.

## Decisions

- D-12 (MSR-03): Any pre-dispatch estimate uses the tree's single estimator,
  `Math.ceil(text.length / 4)`, and CITES it rather than restating a ratio.
  Evidence: `cadence-core/bin/lib/surface-weight.mjs:130-138`,
  `cadence-core/references/config-catalog.md:57`,
  `cadence-core/references/seams.md:305` (both name it "chars/4").
- D-13 (TRN-02): TRN-02 follows the `lib/text-transport.mjs` shape exactly - a
  hand-maintained frozen register plus a pure rule module in
  `cadence-core/bin/lib/`, walked by `self-verify.mjs` over prose surfaces, with
  the rule itself stated ONCE in `references/conventions.md` and cited by every
  converted site. Evidence: `cadence-core/bin/lib/text-transport.mjs:1-88`
  ("THE RULE ITSELF IS NOT HERE"), `cadence-core/references/conventions.md:78-91`,
  `cadence-core/bin/self-verify.mjs:830-833`,
  `cadence-core/bin/lib/deferred-reads.mjs:1-35` (the second instance of the
  same pattern).
- D-14 (TRN-02): The register's rows are reportable-when-unclassified rather
  than skippable, and a row OUTLIVES the occurrence it converted. Evidence:
  `cadence-core/bin/lib/text-transport.mjs:35-40` ("A ROW OUTLIVES ITS
  OCCURRENCE... deleting a converted row... makes the next reintroduction read
  as site seventeen"), `:58-65` (D-11 there: what the scan cannot delimit is
  reported, never skipped), `:79-88` (the three-code `inline`/`unregistered`/
  `unclear` vocabulary a bulk-output rule mirrors).
- D-15 (TRN-02): A converted site still owes the transcript a DIGEST, because
  coordinator steps branch on the content they would otherwise be handed whole.
  Measured 2026-08-17: `planning.mjs trace render` returns 67,835 bytes
  unscoped and 14,857 with `--phase 3`; `weight.mjs` returns 8,513. Evidence:
  `cadence-core/workflows/report.md` ("Never ask for the raw `events` array:
  nothing here reads one, and the flag re-buys 27 KB on the one path that reads
  a record into a model's context"), `cadence-core/workflows/execute.md:237`
  (the partial arm). A site whose coordinator branches on content and cannot
  take a digest is registered OUT of scope with a stated reason, the way
  `--bracket-read` and `--payload` are excluded by construction in
  `text-transport.mjs:98-108`.
- D-16 (PLN-01): PLN-01 delivers a WRITTEN DECISION, not necessarily a value
  change; 8 is a legitimate landing point if the reason is stated. Evidence:
  `.planning/ROADMAP.md:280-284`, `.planning/REQUIREMENTS.md:45-47`.
- D-17 (PLN-01): The context-risk force already has both a mechanism and a
  figure in the record - executor checkpoint pressure, R4 in `trace suggest`.
  Measured 2026-08-17 over `.planning/trace.jsonl`: 20 `checkpoint` events, 14
  of them `cad-executor`, against 177 `dispatch` and 153 `return` events.
  Evidence: `cadence-core/bin/lib/trace-suggest.mjs:300-311`
  (`MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION = 2`, `action:
  'workflow.max_plan_tasks'`).
- D-18 (PLN-01): Re-deciding the value changes nothing in the seam: `plan-size`
  counts tasks PER PLAN and takes the ceiling as the CALLER's resolved number,
  reading no config itself. Evidence:
  `cadence-core/bin/planning.mjs:1636-1700` (`cmdPlanSize` - "`--max-reqs` and
  `--max-tasks` are the CALLER's resolved values; this seam reads no config for
  them"), `cadence-core/workflows/plan.md:35,45,139,244,276`. Both config layers
  are `{}` as of 2026-08-17, so the live value is the schema default 8
  (`cadence-core/config.schema.json:31`).
- D-19 (mechanics): Any new seam flag or subcommand this phase adds requires a
  row in `self-verify.mjs`'s `CONTRACTS` table in the SAME commit. Evidence:
  `cadence-core/bin/self-verify.mjs:241-360`, `.planning/CAPTURE.md:288`
  (records this constraint being hit by SGT-01).
- D-20 (mechanics): Every prose surface this phase edits is re-pinned in
  `weight-budgets.json` in the same commit, and that file's `_comment` forbids
  migrating those pins into config. Current bytes: `conventions.md` 8,363,
  `seams.md` 20,542, `report.md` 9,605, `config-catalog.md` 8,815,
  `execute.md` 26,522. Evidence: `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:899-908` (`unbudgeted-surface`), phase 1
  D-15.
- D-21 (mechanics): Each of MSR-03, TRN-02 and PLN-01 gets a falsifier
  committed with a `WATCHED FAILING AT <sha>` header, and the audit of those
  headers EXTRACTS the SHA per line rather than counting occurrences. Evidence:
  `.planning/phases/3/PLAN-3.md:170,192-206` (the phase-3 deviation that
  replaced `grep -c "WATCHED FAILING AT"` because the count was a proxy),
  `.planning/phases/3/PLAN-1.md:45,267`, `.planning/phases/2/PLAN-2.md:183,214`.

## Acceptance criteria

- [ ] AC1: A new `config.schema.json` key names the dispatch-window ceiling in
      tokens, and a `planning.mjs trace` surface reports a per-role crossing of
      it in the `budget-overrun` shape (`{kind, file, detail: "<n> exceeds
      budget <m> by <d>"}`) read off the `tokens` on `brackets[]` rows; run
      against this repo's `trace.jsonl` it prints at least one crossing and
      names the role that crossed.
- [ ] AC2: The ceiling's value is argued in shipped prose from named
      `trace.jsonl` keys with the per-role figures behind it, and no dispatch is
      refused on the crossing - the run completes and the crossing is a finding.
- [ ] AC3: The bulk-output rule is stated exactly once: `grep -rn` over
      `cadence-core/` finds the statement in `references/conventions.md` and in
      no other file, with a frozen register in `cadence-core/bin/lib/` and the
      rule module carrying no copy of it.
- [ ] AC4: `node cadence-core/bin/self-verify.mjs` reports a named problem when
      a registered bulk-output site is edited back to riding the transcript, and
      reports an unclassified site rather than skipping it.
- [ ] AC5: `workflow.max_plan_tasks` carries a written decision on a surface
      self-verify binds, naming both forces with a measured figure behind each -
      the checkpoint count from `trace.jsonl` and the per-role `dispatchBytes`
      from `weight.mjs resident` - and the value it lands on, whether or not
      that value changed.
- [ ] AC6: For each of MSR-03, TRN-02 and PLN-01 a check carries a
      `WATCHED FAILING AT <sha>` header, and running that check against the SHA
      it names exits non-zero; the audit extracts each SHA per line rather than
      counting occurrences.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and
      `node cadence-core/bin/self-verify.mjs` both exit 0, with
      `weight-budgets.json` re-pinned for every edited surface and a `CONTRACTS`
      row for any new flag or subcommand.

## Flagged assumptions

- Whether Claude Code agent frontmatter exposes a per-agent context-window or
  max-input-tokens key alongside the `maxTurns: 200` all 19 `agents/` files
  carry - Unclear, left flagged by the user 2026-08-17; if wrong, MSR-03's
  budget could be a host-enforced BOUND at dispatch time rather than a
  post-return report, which changes D-04. With it unsettled, D-04 rests on
  `references/seams.md:56-72` alone.
- `tool_response` on PostToolUse is undocumented and taken opportunistically -
  Confident it works today (1.000 coverage across 9,587 records, measured
  2026-08-17); if a host update stops sending it, `bytesCoverage` reports a
  fraction rather than a total, so TRN-02's threshold reads as degraded rather
  than as zero.
- The exact config key name (`workflow.max_dispatch_tokens` or another
  spelling), its default, and whether the per-role ceilings are one key holding
  a map or one key per role, are the planner's call - Likely; if wrong a rename
  costs the schema row, the `config-catalog.md` row and the prose citing it, and
  the per-role arrangement decides whether the schema gains one row or six.
- Which bulk-output sites the register carries at landing, and which are
  recorded out of scope with a stated reason (D-15), is the planner's call from
  the measured `reads.jsonl` top targets - Likely; if wrong the register is
  either thin enough to miss the transport it exists for or wide enough to
  convert sites whose coordinators branch on content.
- `.planning/ROADMAP.md`'s phase-4 prose says a prose-surface budget "fails
  self-verify on a crossing in either direction", which D-11 falsifies against
  the code. The `REQUIREMENTS.md` MSR-03 row does not carry that claim, so no
  row correction was offered; the ROADMAP line is outside this workflow's write
  set and stays for /cad-plan to read past.
