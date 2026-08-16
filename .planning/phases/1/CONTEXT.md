# Phase 1: One transport for caller-derived text - Context

Gathered: 2026-08-16
Feeds: /cad-plan 1

## Scope boundary

In: the transport rule stated once in `cadence-core/references/conventions.md`;
a committed register classifying every examined site; `-file` transports on the
free-text seam flags (`trace append|close --detail`, `uat record`'s free-text
fields via one `--fields-file`, `milestone-prune --label`, the two
`trace append --read` target refs, `cursor set --next` at its two composed
sites); the `git tag -m` -> `-F` swap in `skills/cad-land/SKILL.md`; a
self-verify check that refuses site seventeen and reports what it cannot see.

Out: flags whose value the seam already validates against a closed enum or an
integer grammar (`--phase`, `--status`, `--result`, `--severity`, `--origin`,
`--family`, `--event`, `--tokens`) - a value that must survive
`CURSOR_STATUSES.includes()` or `requireInt` cannot be arbitrary repository
prose. The seven `cursor set --next "/cad-slash-command N"` sites, whose value
the workflow authors as a literal. Deleting the inline form anywhere. `gh pr
create` / `tea pr create` arms, which pass no repository-derived free text.

Deferred: None.

Plan shape: multiple plans, same phase - the seam work (`planning.mjs` flags,
refusals, tests) and the prose sweep (~16 workflow surfaces at 0 B budget
headroom, the register, the check in `self-verify.mjs`) are disjoint files with
different failure modes, and AC3 requires the check to land before the prose
fix.

## Durable decisions

- D-01 (Scope): The caller-derived test is applied per FLAG by the seam field's
  semantics, not per placeholder spelling in prose. A flag whose value the seam
  validates against a closed enum or an integer grammar is out of scope by
  construction. Evidence: `cadence-core/bin/planning.mjs:470` (`CURSOR_STATUSES`),
  `:663` (`UAT_RESULTS`), `:743-790`, `:2793-2846`;
  `cadence-core/bin/lib/planning-files.mjs:12-15`;
  `cadence-core/bin/lib/trace.mjs:96`.
- D-02 (Scope): `cursor set --next` is classified PER SITE, not per flag: in
  scope at the two composed sites (`skills/cad-pause/SKILL.md:33-34`,
  `cadence-core/workflows/progress.md:58`), out at the seven sites passing a
  literal slash command. The register therefore carries site-level rows.
  Evidence: `skills/cad-pause/SKILL.md:33-34`,
  `cadence-core/workflows/{adopt,new-project,milestone,plan,context,execute}.md`.
- D-03 (Scope): `git tag -a <version> -m "<milestone label>"` at
  `skills/cad-land/SKILL.md:186` is IN scope and swaps to
  `git tag -a <version> -F <path>`. It is the one site in the tree that provably
  puts repository content (a PROJECT.md milestone name) into a double-quoted
  shell word, and it is the goal statement's own example. Evidence:
  `skills/cad-land/SKILL.md:186`, `.planning/ROADMAP.md` phase 1 failure-mode
  paragraph.
- D-04 (Transport): New flags are named `--<field>-file`, are ADDITIVE (the
  inline form survives), and reproduce `cmdCapture`'s refusal vocabulary
  verbatim in shape - `bad-args` for a valueless flag, an unreadable path
  (naming the read error), an empty file, and both forms together. They do NOT
  reuse `readJsonPayload`, whose envelope is `no-payload`/`bad-payload`.
  Evidence: `cadence-core/bin/planning.mjs:3815-3846` vs `:614-640`;
  `cadence-core/bin/capture-file.test.mjs:361-397`.
- D-05 (Transport): `uat record` takes ONE `--fields-file <path>` holding a JSON
  object of the free-text fields, not per-field `-file` flags. `verify.md`
  already passes two or three text flags on a single call, and per-field files
  would cost up to three extra Write calls per failed item on the workflow whose
  per-item round-trip discipline is explicit. The refusals are still capture's
  `bad-args` set, not `uat merge --payload`'s. Evidence:
  `cadence-core/workflows/verify.md:229-230,239,269`;
  `cadence-core/bin/planning.mjs:800-804`, `:2814`.
- D-06 (Rule site): The rule is stated once in
  `cadence-core/references/conventions.md` and CITED BY PATH at each site - not
  `@`-included and not a new reference file. That file already describes itself
  as one-line rules cited by path and already holds the sibling spawn-agent
  rule, so the phase adds no `weight-budgets.json` entry, no check-16 consumer
  sentence, and no `DEFERRED_READS` row. Evidence:
  `cadence-core/references/conventions.md:1-6,124`;
  `cadence-core/workflows/new-project.md:119,188`;
  `cadence-core/bin/lib/include-consumers.mjs`.
- D-07 (Enumeration): The committed enumeration is a FROZEN REGISTER MODULE
  under `cadence-core/bin/lib/` - one row per site (surface, flag, value,
  caller-derived yes/no, reason when no), read by `self-verify.mjs` and
  count-pinned in a test - following the `DEFERRED_READS` shape, not a markdown
  table. A check must not parse a grammarless markdown table, and a prose
  enumeration the check does not read can drift from the one it enforces.
  Evidence: `cadence-core/bin/lib/deferred-reads.mjs:141-200`;
  `cadence-core/bin/self-verify.mjs:152,1824-1829`;
  `cadence-core/bin/self-verify.test.mjs:1696`;
  `cadence-core/bin/prose-agreement.test.mjs:1-13`.

## Decisions

- D-08 (Scope): The in-scope free-text flag set entering the phase is
  `trace append|close --detail`, `uat record`'s free-text fields
  (`--reason`, `--reported`, `--cause`, `--fix`, `--evidence`),
  `capture --text` (already fixed), `milestone-prune --label`, the two
  `trace append --read` sites carrying a user-supplied target reference, and
  `cursor set --next` at its two composed sites. The register, not this list, is
  the deliverable. Evidence: `cadence-core/workflows/verify.md:177-178,228-230,239,269,271`,
  `execute.md:202-209`, `verify-deep.md:19-22`, `context.md:183`,
  `minimalism-review.md:73,91`, `decision-review.md:52,65`,
  `references/review-triggers.md:111,135,279`, `references/plan-revision.md:27,55`,
  `plan.md:186,283`, `milestone.md:96-100`.
- D-09 (Check): The check cannot be built on check 2's existing invocation
  parser. Of the free-text-flag mentions, 24 sit on a line carrying a
  `[a-z-]+\.mjs <word>` invocation and 30 sit in prose fragments with no such
  prefix, which `self-verify.mjs:701` (`if (!contract) continue`) skips. Evidence:
  measured 2026-08-16 over `cadence-core/{workflows,references,templates}`,
  `skills/`, `agents/`; `cadence-core/bin/self-verify.mjs:701`.
- D-10 (Check): Value inspection is new machinery - nothing in `self-verify.mjs`
  inspects the token after a flag today. The discriminator between "prescribes a
  value" and "merely names the flag" is the immediately following quoted word, so
  prose that names a flag in order to FORBID it stays green. Evidence:
  `cadence-core/bin/self-verify.mjs:723-728`;
  `cadence-core/workflows/execute.md:205,405`;
  `cadence-core/references/review-triggers.md:283`;
  `cadence-core/references/seams.md:120`; `skills/cad-capture/SKILL.md:44-45`.
- D-11 (Check): "States what it cannot see" is a reported problem KIND for a
  site the check can classify as neither safe nor unsafe - an unquoted
  placeholder, a value spanning a line break, an interpolated composite - never
  a silent skip. Evidence: `cadence-core/workflows/milestone.md:96-97`;
  `cadence-core/workflows/verify.md:303-306`;
  `cadence-core/references/review-triggers.md:279`;
  `cadence-core/bin/self-verify.mjs:1290-1296`.
- D-12 (Blast radius): Every new flag is added to its `CONTRACTS` row in
  `self-verify.mjs`, or check 2 files `unknown-flag` against the workflow that
  uses it. Evidence: `cadence-core/bin/self-verify.mjs:226-330`, `:309`
  (`capture: [... '--text-file' ...]`), `:701-728`.
- D-13 (Blast radius): `cadence-core/bin/weight-budgets.json` is in the phase's
  `files:` lease. 16 of 17 candidate surfaces sit at exactly 0 B headroom
  (`verify.md` 16823/16823, `execute.md` 26211/26211, `review-triggers.md`
  29151/29151, `seams.md` 19157/19157, and 12 more); only
  `skills/cad-capture/SKILL.md` has 55 B. Evidence: measured 2026-08-16 against
  `cadence-core/bin/weight-budgets.json`; `cadence-core/bin/self-verify.mjs:834-843`.
- D-14 (Blast radius): Criterion AC3's watched-FAIL is produced as a RUN RECORD
  at an intermediate SHA - the check and register land in one commit, the prose
  fix in the next - not as a permanent test asserting the tree is broken. The
  repo has no artifact convention for a watched-FAIL, and self-verify's own
  tests build synthetic roots, which satisfies "the check can fail" but not "on
  the real sites". Evidence: `cadence-core/bin/self-verify.test.mjs:92-193`;
  `cadence-core/bin/planning.test.mjs:3472`; `.planning/ROADMAP.md:90`.

## Acceptance criteria

- [ ] AC1: The transport rule appears in exactly one file
      (`cadence-core/references/conventions.md`) and its text states the
      derivation test (value derived from agent output or repository content
      rather than authored by the workflow itself); every workflow site this
      phase converted cites that path, and no converted site restates the
      reasoning.
- [ ] AC2: A frozen register module under `cadence-core/bin/lib/` carries one
      row per examined site with its surface, flag, the value it passes, and its
      caller-derived classification; every out-of-scope row carries a reason
      string. A test pins the row count, and `node cadence-core/bin/self-verify.mjs`
      reads the register rather than a markdown table.
- [ ] AC3: Run at the commit where the register and check land but the prose fix
      does not, the check prints a non-empty list naming real tree sites, not
      fixtures. The phase SUMMARY records that SHA and the site list it printed.
- [ ] AC4: For every `-file` flag this phase adds, each of - a missing path, an
      empty file, an unreadable path, and passing both the inline and file form -
      returns `bad-args`; the unreadable case names the read error; no case
      resolves by precedence.
- [ ] AC5: `uat record --fields-file <path>` accepts a JSON object of the
      free-text fields and writes the same record the inline flags produce for
      identical values, and `cadence-core/workflows/verify.md` prescribes the
      file form at its failing-item sites.
- [ ] AC6: Out-of-scope sites are unchanged: the seven literal
      `cursor set --next "/cad-<command> N"` sites still prescribe the inline
      form, no enum- or integer-validated flag (`--phase`, `--status`,
      `--result`, `--severity`, `--origin`) gained a `-file` variant, the check
      reports no problem for any of them, and `capture --text` and its siblings
      still accept an inline value at the CLI.
- [ ] AC7: `skills/cad-land/SKILL.md` prescribes `git tag -a <version> -F <path>`
      and no `-m "<...>"` carrying a repository-derived label remains in the
      tree; `node --test 'cadence-core/bin/*.test.mjs'` and
      `node cadence-core/bin/self-verify.mjs` both exit 0.

## Flagged assumptions

- The in-scope flag set (D-08) is Likely, not Confident: it is the analyzer's
  reading of 44 lines carrying a `--<flag> "…"` form, and the register is what
  settles it. If wrong: a genuinely derived value ships unguarded and becomes
  site seventeen, or a literal gets a needless file transport.
- The register-module shape (D-07) is Likely: the alternative is extending the
  `CONTRACTS` rows with a per-flag `textFlags` list, which puts the
  classification beside the flag allowlist but gives out-of-scope sites nowhere
  to record their reason. If wrong: the enumeration and the check read two
  artifacts that can drift.
- The unclassifiable-shape kind (D-11) is Likely: the alternative is refusing
  unquoted placeholders after a text flag outright, which is stricter but forces
  prose rewrites at sites whose value is genuinely a path or a version.
- The watched-FAIL convention (D-14) is Likely and constrains commit ordering
  for the plan that owns the check. If wrong: the demonstration lands against a
  fixture and AC3's "on the real sites" clause re-opens at verify.
- The real run cost of this phase - one added scratch-file Write per converted
  site - is invisible to every count the repo keeps, because
  `seam-calls.test.mjs:44-46` matches only `node "${CLAUDE_PLUGIN_ROOT}/…"`
  invocations. Confident; if wrong in the other direction, a census row moves
  unexpectedly.
