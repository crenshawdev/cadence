# Phase 2: Unforeclose the shared rung prefix - Context

Gathered: 2026-08-26
Feeds: /cad-plan 2

## Scope boundary

NARROWED 2026-08-26 at `/cad-plan 2`. The measurement half moved to phase 3
(TRC-07, promoted out of deferral the same day). What follows is the scope as it
now stands; the moved material is kept below under its own headings rather than
deleted, because phase 3 is built from it.

Why it moved: the planner replayed the `SubagentStop` hook's own rule against
the live record and found the refusal happens TWO GATES EARLIER than D-03
assumes. `terminalOf` answers NOT-TERMINAL for 16 of 16 subagent transcripts
written 2026-08-26, so `closeForStop` returns null before GATE 2a is reached,
and GATE 2a has never yet been the blocker: only 5 of 399 brackets carry
`agent_id` at all and none of those sit anywhere but last on their worker key.
The unpaired-row fallback is separately dead - 11 stale rows spanning
2026-08-09 to 2026-08-26 count as open workers forever. All of that is TRC-07,
which the `Out` line below already excluded, so this CONTEXT was asking the
phase to build on the one thing it had ruled out.

In: deleting the rung sentence from every agent body so a role's rung files
share one cached prefix instead of diverging at body line 2 (RNG-03), with a
check that fails when a future rung file breaks it.
Out: consolidating or renaming any rung file (spike recommendation 4 - the split
is already minimal, and any rename fails AC2); changing `route-table.json`, the
stakes ladder or any `model.effort.*` pin; `weight-budgets.json` re-pins, which a
shrinking surface does not need; and the measurement itself - whether the prefix
recovers anything is phase 3's question, not this one's.
Deferred: the measurement, to phase 3.
Plan shape: ONE plan. The two seams that justified a split no longer both sit in
this phase.

One planning detail carried out of the planner's read: deleting the rung
sentence falsifies the sentence left behind it, which still says "This file
names that contract **and your rung**". Reword the pointer paragraph in the same
edit or the tree ships a stale self-description.

## Durable decisions

- D-01 (Rung line): the rung sentence is DELETED from every agent body, not
  relocated within it. Deletion is what makes a role's rung bodies
  byte-identical with no divergence point left at all; relocation moves the
  divergence from body byte 15 to roughly byte 156 and leaves the whole contract
  behind it, recovering about 140 bytes. Measured 2026-08-26 across all 19 files
  in `agents/`: today's shared body prefix is 15 bytes for all six roles, bodies
  run 176-191 B, and with the sentence removed every role's rung bodies are
  byte-identical (6 of 6). The frontmatter `effort:` already carries the rung.
  Evidence: `agents/` (19 files), `cadence-core/bin/lib/rung-agent.mjs`
  (`rungBody`), `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md:100-120`.
- D-02 (Rung line): `skills/cad-plan-checker-contract/SKILL.md:19-27` is
  rewritten and the rung reaches the plan checker through its dispatch prompt,
  which is billed fresh and costs no prefix. This CORRECTS the spike, which
  states "nothing in the contracts branches on the prose line": that `<rung>`
  section is the one place that does, telling the agent "the higher your rung,
  the harder you reason and the stricter you are on borderline BLOCKER vs
  WARNING calls." The other five contracts mention `rung` only in frontmatter
  `description:`. Evidence: `skills/cad-plan-checker-contract/SKILL.md:19-27`,
  `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md` recommendation 2.
MOVED TO PHASE 3 (2026-08-26): D-03, D-05 and D-06 below are the measurement
half's decisions and are not this phase's to honor. They are kept here as
gathered input for phase 3's own context pass. D-03's premise is superseded -
see the Scope boundary above - and D-06's choice of `cad-verifier` has to be
RE-DECIDED, because that role holds one of the 11 stale unpaired rows, so the
hook would mis-attribute its figures to an archived phase-3 bracket
(`corr 3-23fb76d`, 2026-08-21) rather than abstain.

- D-03 (Measurement, MOVED to phase 3, premise superseded): GATE 2a at `cadence-core/bin/lib/subagent-trace.mjs:199`
  fills only the cache fields on an already-closed bracket instead of refusing
  the whole row. This is what makes AC4-AC6 buildable at all. The phase's
  roadmap premise - "TRC-05 shipped the figures in v3.7.3, so the claim is now
  checkable" - is FALSE as it stands: `.planning/trace.jsonl` carries 0 cache
  figures across 2,320 events and 398 brackets. The cause is not a missing hook
  and not a stale process (`hooks/hooks.json` registered `SubagentStop` at
  `518728f6`, 2026-08-25 20:08, before this session started 2026-08-26 06:30) -
  it is that every Cadence workflow instructs the caller to pass `--agent-id` on
  `trace close`, and GATE 2a then returns null and writes nothing. The seam's own
  contract says the second close should fold in "filling only the fields that row
  left empty"; GATE 2a refuses the row instead. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:164-199`,
  `cadence-core/references/seam-spawn-agent.md` (bracket rule), `hooks/hooks.json`,
  `.planning/trace.jsonl` (measured 2026-08-26).
- D-04 (Enforcement): the new check compares RAW BYTES, scoped to the rung
  bodies of one role. This knowingly reverses `normalizeBody`'s deliberate
  whitespace tolerance for that span - a re-wrap of the pointer paragraph in one
  rung file and not its siblings becomes a CI failure - and that is correct
  here, because two line-break variants are two different cache prefixes.
  `rungBodyIssue`'s tolerance is untouched everywhere else. Evidence:
  `cadence-core/bin/lib/rung-agent.mjs` (`normalizeBody`),
  `cadence-core/bin/rung-agent.test.mjs:100-102`.
- D-05 (Measurement, MOVED to phase 3): the before/after forces the rung alternation DIRECTLY -
  one role dispatched at two rungs in one sitting - rather than flipping a
  `model.effort.*` pin (which strands whatever the previous rung had warmed, the
  very condition being measured) or setting `model.escalate_on_failure: true`
  (spike recommendation 3 says keep it false). No role alternates rungs under
  today's configuration: over the 99 resolves since 2026-08-24 every one of the
  six roles resolves exactly one rung, so a naturally occurring before/after
  measures nothing. Evidence: `.planning/config.json:13-21`,
  `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md:122-139` (C5).
- D-06 (Measurement, MOVED to phase 3, RE-DECIDE the role): the measured role is `cad-verifier`. It has four rungs,
  runs in the MAIN tree - a worktree role's hook close lands in a
  `.planning/trace.jsonl` that `.gitignore:29` keeps out of the worktree and that
  is destroyed with it - and its 10,792 B contract is not the contract this phase
  edits, so the before and after are not contaminated by D-02's rewrite.
  Evidence: `skills/cad-verifier-contract/SKILL.md`, `.gitignore:29`,
  `cadence-core/bin/subagent-trace.mjs` (`planningRoot`).

## Decisions

- D-07 (Enforcement): the prefix rule is stated in
  `cadence-core/bin/lib/rung-agent.mjs` beside `RUNG_FILES` and returns a problem
  CODE; `self-verify.mjs` owns the envelope and names the new check in its single
  `checked:` list. Putting it in `self-verify.mjs` directly would stop
  `rung-agent.mjs` being the one statement of what a rung file is, which is the
  duplication its own header cites #39/#43/#64 for. Evidence:
  `cadence-core/bin/lib/rung-agent.mjs` (header), `cadence-core/bin/self-verify.mjs:255-256,
  949-973, 1374`.
- D-08 (Enforcement): no `weight-budgets.json` re-pin. The manifest is a CEILING
  and a surface under its entry needs no gate; these 19 files only shrink. This
  narrows the phase-1 note that any `weight-budgets` edit must re-pin in the same
  change - true of a surface that GROWS, not one that shrinks. Evidence:
  `cadence-core/bin/self-verify.mjs:795-818`, `cadence-core/bin/weight-budgets.json:4-22`.
- D-09 (Enforcement): `rungBodyIssue`'s body-vs-frontmatter-effort arm goes away
  with the line, and `rungEffortIssue` (filename stem vs frontmatter `effort:`)
  is what holds the chain. The loss is a redundant arm, not a hole - but the plan
  must say so explicitly, because deleting
  `cadence-core/bin/rung-agent.test.mjs:122-124` silently reads as a weakened gate
  at review. Evidence: `cadence-core/bin/rung-agent.test.mjs:122-124`,
  `cadence-core/bin/self-verify.mjs:966-975`, `INTERNALS.md:11`.
- D-10 (Routing): no rung file is renamed, added or removed. `route.mjs` imports
  only `rungFile` and `RUNG_FILES` and never opens an agent body, so AC2 holds by
  construction as long as the file stems are untouched; any consolidation changes
  the returned `agent` string and fails AC2 outright. Evidence:
  `cadence-core/bin/route.mjs:121`, `cadence-core/route-table.json` (`cells`),
  `.planning/spikes/agent-prefix-cache-fragmentation/SPIKE.md:179-181`.

## Acceptance criteria

- [ ] AC1: every rung file of one role has a byte-identical body (frontmatter
      excluded), and a check fails when one rung body differs from its siblings
      by a single byte.
- [ ] AC2: `node cadence-core/bin/route.mjs resolve` returns the same agent,
      model and effort for all 18 (level, role) cells as it does today, pinned by
      a test.
- [ ] AC3: `skills/cad-plan-checker-contract/SKILL.md` no longer tells the agent
      its agent file names its rung, and the rung reaches the plan checker
      through its dispatch prompt instead.
- [ ] AC4: `node cadence-core/bin/test.mjs` is green and `self-verify` reports
      `problems: []`.

MOVED TO PHASE 3 (2026-08-26), kept as gathered input for its context pass. The
AC4 above is the old AC7 renumbered; the three below were AC4-AC6.

- [ ] (phase 3) a bracket closed by the caller AND then by the hook carries the
      caller's `tokens` and `turns` together with the hook's
      `cache_read_input_tokens` and `cache_creation_input_tokens`.
- [ ] (phase 3) `.planning/trace.jsonl` shows at least one bracket carrying a
      non-zero `cache_read_input_tokens` after a real dispatch. Today it is 0 of
      399.
- [ ] (phase 3) two dispatches of one role at two different rungs, run in one
      sitting, are recorded with both cache figures and with the method - which
      rungs, elapsed time, which tree - including the case where the delta is
      zero. The role is re-decided per D-06 above.

## Flagged assumptions

- Whether the Claude Code host attempts prompt-cache prefix reuse ACROSS two
  different agent definitions at all. Two rungs are two registered agents; if the
  host keys the cache per agent definition, a byte-identical body recovers
  nothing regardless of layout - Unclear; if wrong, AC6 records a substantiated
  zero and RNG-03 closes on a measured negative rather than a recovery. Not
  observable from this repository: the spike says so, and 220 sidechain
  transcripts scanned 2026-08-26 carry no system prompt to inspect.
- The role contract is assembled AFTER the agent body in the subagent's prompt,
  which is what makes deletion (rather than relocation) the effective edit -
  Likely; if wrong, the layout already shares the contract, the phase's premise
  is void, and the honest deliverable is a recorded zero plus a note that the
  spike's C4 finding was mis-modelled.
- Whether the frontmatter `effort:` value causes the host to inject any per-rung
  text into the assembled prompt. If it does, deleting the body line does not
  make the prompt byte-identical across rungs and AC1's divergence point moves to
  wherever that injection lands - Unclear; if wrong, AC1 passes on the files
  while the actual prefix stays fragmented.
- The before and after runs must sit inside one cache TTL window or the
  comparison measures expiry rather than layout - Likely; if wrong, the after-run
  shows a cold prefix for unrelated reasons and AC6 enshrines a false zero.
  `~/.claude/settings.json` sets `ENABLE_PROMPT_CACHING_1H`, an environment fact
  outside this repo, and nothing in `cadence-core/` records or asserts a TTL.
- The minimum cacheable prefix is not a blocker: it is roughly 1,024 tokens and
  the six contracts run 5,980-12,811 B (about 1,500-3,200 tokens), so all six
  clear it - Confident; if wrong, the recovery is structurally zero for the
  smaller contracts and the phase should say so before running AC6.
