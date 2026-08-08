---
phase: 2
status: complete
completed: 2026-08-08
---

# Phase 2: Context reduction - Summary

A `weight.mjs resident` subcommand that composes what a command and a dispatch
actually carry, the first CONTRACTS entry `weight.mjs` has ever had, two
load-order cuts the measurement justifies, and a self-verify check that fails
when a de-preloaded reference loses the Read instruction that replaced it.

One plan, 8 tasks, 8 commits. The phase opened with five roadmap criteria and
finished with five different ones: three of the originals were struck at context
time against tree evidence (the `references/**` budget shipped in v2.3.0 as
BUD-02, `panel-review` is retired Codex-era prior art this codebase never
contained, and the 2.4x figure is runtime billed-equiv that `PROJECT.md ### Out
of Scope` excludes), and CTX-02 was deferred out of the cycle because both its
halves add resident bytes in the phase that exists to cut them.

## What shipped

- **The measurement** - `lib/resident-weight.mjs` + `lib/frontmatter.mjs`, behind
  `weight.mjs resident`. Per command: eager bytes (`SKILL.md` + its `@`-includes)
  and reachable bytes (one hop from the eager set). Per role: dispatch bytes
  (agent file + preloaded contract skills), returning every rung under a role
  rather than one figure. `parseSkillsField` moved OUT of `self-verify.mjs` into
  a pure lib with no re-export, because `self-verify.mjs` emits on import and any
  import from it would have printed a second JSON envelope.
- **The contract** - `weight.mjs` gains `{'*': ['--root'], resident:
  ['--command','--role']}` and `INTERNALS.md` gains the prose surface that
  invokes it, which is what gives the entry teeth: self-verify check 2 only fires
  on prose that invokes a script.
- **The break-even rule, corrected** - `references/seams.md` gains the size term
  its every-path clause omitted, scoped so it cannot license the next cut by
  assertion: it names `weight.mjs resident` as the decider, names
  `references/git-guard.md` as the multi-step case that stays eager, and limits
  the inline bytes-and-count requirement to deferrals made from that sentence
  forward.
- **The two cuts** - `references/review-triggers.md` de-preloaded from both
  skills. `cad-land` 32,676 -> 17,934 B eager, strictly below the 20,530.33 B
  workhorse mean (AC3). `cad-plan-review` 17,511 -> 2,353 B, a drop of 15,158
  against the 15,134 B the criterion required (AC4). `git-guard.md` stays eager
  in `cad-land` - four consult sites across four distinct steps.
- **The guard on the cut** - `lib/deferred-reads.mjs`, a frozen four-row register
  wired as self-verify check 13. The unit is the SENTENCE, not the blank-line
  block, because `cad-land:99-144` is a single ~2,900 B paragraph that a
  block-level test would pass while the real instruction was gone.
- **The record** - `phases/2/MEASUREMENTS.md`, before and after, every reachable
  change split by cause, and the 26,095 B of budgeted-but-never-loaded references
  marked rather than counted as a saving.

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | a2dfa78 | compose per-command and per-dispatch resident bytes behind `weight.mjs resident` |
| 2 | 01d220a | contract `weight.mjs` in self-verify and give it a prose surface that invokes it |
| 3 | 1489508 | record the pre-cut resident-bytes baseline |
| 4 | 0d11825 | state the size term the break-even rule was missing |
| 5 | 9521954 | defer review-triggers.md out of cad-land's eager load |
| 6 | 48c6b64 | defer review-triggers.md out of cad-plan-review's eager load |
| 7 | a3f6e1c | fail self-verify when a de-preloaded reference has no Read at its step |
| 8 | 292b599 | record the after numbers and the scope corrections |

Range `a2dfa78..292b599`, 8 commits. Gates at HEAD: **1341 tests pass, 0 fail**;
`tsc -p tsconfig.ci.json` exits 0; `self-verify` `ok:true` across 18 checks with
zero problems.

## Deviations

- **[deviation] task 7 narrows `deferred-read-missing-skill`.** The plan said to
  raise it whenever a row's SKILL.md is absent, exempting only an absent
  `skills/` directory. Every fixture `self-verify.test.mjs` builds creates an
  EMPTY `skills/`, so that rule reported the whole register against them -
  measured, not assumed: with the exemption removed an existing test fails
  (108/109). The row is now skipped when the skill's own DIRECTORY is absent and
  raised when the directory exists with no readable SKILL.md, which keeps the
  kind reachable (a test row proves it fires) while leaving partial fixtures
  usable.
- **[deviation] task 8's `seed-reqs` premise was already satisfied.** The task
  expected `seed-reqs --phase 2` to WRITE the row clearing an `unpicked` CTX-01
  and an orphan `phases/2/PLAN.md`; it returned `{"seeded":[],"skipped":
  ["CTX-01"]}` against an audit that was already clean, because `/cad-plan`'s own
  commit had seeded it. The command ran unconditionally as instructed,
  `REQUIREMENTS.md` is byte-unchanged, and the observed envelope is recorded in
  `MEASUREMENTS.md ## Scope corrections` rather than the predicted one.

## Open items

From the `diff` review at plan close (advisory gate; single `claude-subagent`
voice at `xhigh` - the cross-model set was empty, see the note below):

- **MEDIUM.** Check 13 counts qualifying sentences FILE-WIDE, not per step or per
  arm, so `cad-land`'s step-4b Read can be deleted and the check stays green as
  long as any compensating sentence naming the path with `Read` survives anywhere
  in the file - contradicting `lib/deferred-reads.mjs:24-33`, which claims the
  sentence unit protects "each arm's own sentence". Reproduced: relocating one
  equivalent sentence into `<guardrails>` keeps `found (2) === read_paragraphs
  (2)` and self-verify `ok:true`, with the `git.auto_close: true` arm reaching
  `gh pr merge` with `references/git-publish.md` never loaded.
- **MEDIUM.** `weight.mjs:39` `flagValue(argv,'--root') || join(HERE,'..','..')`
  turns a valueless or empty `--root` into a silent fallback to the plugin's own
  tree. At `406b1e1` a valueless `--root` returned `ok:false`/`internal`; at
  `292b599` it returns `ok:true` with the Cadence repo's own numbers. A caller
  passing an unset `$TREE` gets measurements for a tree it never asked about.
- **LOW.** The `weight.mjs` CONTRACTS entry enumerates only `resident`, but the
  script's primary form takes no subcommand. The first linted surface that
  documents `weight.mjs --root` (the form `weight.mjs:16` and
  `phases/1/PLAN.md:104` both describe) turns self-verify red on correct prose.
- **LOW.** `MEASUREMENTS.md`'s recorded evidence "`orphans` null" does not
  reproduce - `planning.mjs:934` spreads the key only when non-empty, so it is
  ABSENT, never null. Every other claim in that bullet reproduces; only the
  stated evidence is wrong.
- **LOW.** The hardcoded `15,134 B` figures now in `cad-land/SKILL.md:44` and
  `cad-plan-review/SKILL.md:39`, which `seams.md:240-242` makes mandatory for
  every future deferral, are checked against nothing. Editing
  `review-triggers.md` moves the `weight-budgets.json` entry (enforced) while the
  prose figures stay (unenforced) - a new prose-vs-code drift class that expands
  by rule with each deferral.
- **LOW.** `weight.test.mjs:198`/`:214`/`:165` assert only internal
  self-consistency of one envelope - both sides derive from the same Map inside
  `surfaceSet()`, so making `readSurface` return `buf.length - 1` leaves all four
  assertions passing. AC1's real requirement is pinned against disk only by the
  synthetic fixtures at `:239`, `:265`, `:293`, never against `cad-land` or
  `cad-executor`, the two the criterion names.

Infrastructure, carried out of this phase:

- The cross-model reviewer set is EMPTY. `deepseek` was removed from
  `review.reviewers` at both config layers on 2026-08-08 after repeated
  `transport`/`ECONNRESET` drop-outs, and `openai` returns `http 401`
  `invalid_api_key`. Both the `plan` and `diff` triggers this phase fell back to
  a single `claude-subagent` voice. `risk_surface` is `blocking` and would fall
  back the same way.

## Goal check

The phase goal names two clauses and eight commits deliver both, with the
measurement now mechanical rather than asserted. The bytes a command carries are
budgeted and cut where the measurement says they are worst: `weight.mjs resident`
exists and composes what one flat per-file list could not (`lib/resident-weight.mjs`,
a2dfa78), and its numbers reproduce a hand sum - `cad-land` `eagerBytes` 32,676
equalled `wc -c` over its own `eagerFiles` at plan time, and 17,934 does now.
The cut landed where the measurement pointed: `cad-land` 32,676 -> 17,934 B
against a workhorse mean of 20,530.33 read from the same envelope (9521954), and
`cad-plan-review` 17,511 -> 2,353 B, a 15,158 B drop against the 15,134 B
required (48c6b64). Both were load-order changes; no prose was rewritten to hit a
number. The always-resident surfaces stop being unmeasured: `weight.mjs` now
carries a CONTRACTS entry (01d220a) with `INTERNALS.md` invoking it, and the
26,095 B of budgeted-but-never-loaded references are marked in
`MEASUREMENTS.md` rather than available to be claimed as a saving.

What the phase does NOT deliver at the same standard is the durability of its own
guard. Check 13 fires (proved live: deleting task 5's Read sentence yields
`deferred-read-unread` "0 of 1", restoring returns `ok:true`), but the `diff`
review reproduced a file-wide counting hole that lets a real Read be deleted from
the auto-close arm while the check stays green - and the module header asserts the
opposite. `weight.mjs`'s `--root` handling also regressed from failing loudly to
falling back silently, which is the quiet-wrong-number class this repo already
tracks for that walker. Neither is fixed here; both are open items above, and the
first one matters most because it weakens the mechanism this phase shipped to
make the cut safe. The honest headline: the cut is real and measured, the rule
behind it is stated and bounded, and the check that holds future deferrals to it
is one counting rule short of doing what its own header claims.
