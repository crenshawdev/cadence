# Roadmap: v3.7.5 - the defects a user's own project feels

## Overview

**`v3.7.5`, opened 2026-08-26.** Five phases, eight issues, one admission
criterion: would a user running Cadence on their own project ever feel this, or
does it only bite while Cadence is being developed on Cadence?

**Why this scope and not the tracker.** The 22 open issues were re-triaged
2026-08-26 against that question alone, and seven answered the first way. They
are not a subject, they are a standard, and the cycle is honest about that: the
forge cluster hard-blocks a user with a self-hosted instance on a non-default
port, the replay bug charges them for a dispatch that does nothing, the risk
detector trips on their own review record, an abandoned rotation claim quietly
drops the bound the record is supposed to keep, and recall misses `seams` when
they typed `seam`.

**What was left out, and why.** GH-144, GH-130 and GH-100 are Cadence-on-Cadence
by their own labels. GH-119, GH-120, GH-107 and GH-102 are measurements and
questions, not deliverables. GH-140 is a keep/cut decision with no code behind
it yet. GH-148 was filed this same day out of the GH-137 spike and is genuinely
real, but its whole consequence lands in a trace record users do not read, so it
fails the standard this cycle is built on and waits.

**GH-145 is the close call.** `.planning/reads.jsonl` goes permanently
write-dead at 8 MiB with no rotation, and this repo is at 7.00 MiB. That is a
real deadline, but it is OUR deadline: the file got there on 935 sessions of
Cadence-on-Cadence. A user reaches it eventually and no user reaches it soon, so
it is excluded on the same standard as everything else rather than promoted on
urgency that belongs to the maintainer.

**What phase 2 already knows.** GH-137's blast radius is measured, not assumed:
`.planning/spikes/execute-replay-blast-radius/SPIKE.md` (bd052ac3) ran two real
executor dispatches against already-committed work and found both noisy - zero
commits, zero byte changes. That is why phase 2 is a guard and not a resume
path, and it is why phase 2 is small.

## Open Questions

- **OQ-1 - where the replay guard lives.** The spike recommends `execute.md`'s
  `locate` step, because minting a new derived status in `derivePhases`
  (`bin/planning/core.mjs:191-206`) makes `status`, `audit`, `phase-done` and
  the cursor all learn it at once. The workflow guard is the smaller change and
  covers the reported bug. The derivation is the more honest place, since the
  wrong answer is the derivation's. Phase 2 planning decides, and the cheaper
  reading is not automatically right.
- **OQ-2 - whether the port half belongs in the key or comes out of the
  comparison.** GH-106 states both readings: `git.forge_host` grows a port
  grammar, or `loginNamesHost` drops the port half it cannot be given. Phase 1
  picks one, and the one that leaves a ported instance addressable wins.

## Phases

- [ ] **Phase 1: Land on a forge that is not on port 22** - a self-hosted instance on a non-default port is addressable in config, wired correctly at create, and refuses what it cannot honor
- [ ] **Phase 2: Refuse the replay** - a phase whose work is already committed stops before any executor is dispatched, rather than paying for a run that does nothing
- [ ] **Phase 3: Stop the risk detector tripping on the review record** - an adjudication record quoting a destructive command is evidence, not a destructive change
- [ ] **Phase 4: A killed rotation must not disable rotation** - an abandoned claim is reclaimed on the next append, so the record keeps the bound it promises
- [ ] **Phase 5: Recall matches the word the user typed** - `seam` finds `seams`, and the records of what failed are inside the corpus that searches them

## Phase Details

### Phase 1: Land on a forge that is not on port 22
**Goal:** A user whose Forgejo lives on `forge.example:3001` can state that in config, have `forge.mjs create` wire an origin that actually answers, and get a refusal rather than silence when they pass something the arm will never read. Today the first of those is impossible, which blocks landing outright.
**Depends on:** nothing
**Requirements:** FRG-03, FRG-04, FRG-05, FRG-06
**Success Criteria:**
1. A `git.forge_host` of `forge.example:3001` round-trips through config and reaches `teaLoginNameForHost` with its port intact, and `loginNamesHost` compares the same port rather than a half it was never given. If OQ-2 resolves the other way, criterion 1 instead reads: `loginNamesHost` drops the port from both sides, and a ported instance matches its login by host alone - stated in `config-catalog.md` either way.
2. `forge.mjs create` refuses a `--remote-url` whose port disagrees with the port the instance's canonical clone URL serves, naming both ports in the refusal. The observed failure - an scp-style `git@host:owner/repo.git` implying 22 against an instance serving 2222 - is the fixture.
3. A forge slug or host the user TYPES is shape-checked before it is persisted, not only the origin-derived default (`lib/forge-decision.mjs:244`). A malformed typed value is refused at the write face naming what is wrong with it, and never reaches config.
4. The gitlab arm of `forge.mjs create` refuses a `--remote-url` by naming its conflict with the pinned `--remoteName origin`, rather than accepting an argument it will never read.
5. `node cadence-core/bin/test.mjs` is green, `self-verify` reports `ok:true`, and any new or changed config key is registered in `config.schema.json` and `config-catalog.md`.

### Phase 2: Refuse the replay
**Goal:** A session that dies between the last task's commit and the SUMMARY write leaves a phase deriving `planned` with real commits on the branch. The next `/cad-execute <N>` must stop instead of dispatching, so the user pays nothing and the run record claims nothing.
**Depends on:** nothing
**Requirements:** EXP-03
**Success Criteria:**
1. `/cad-execute <N>` on a phase deriving `planned` whose `.planning/phases/<N>/reports/plan-<k>.md` reads `PLAN COMPLETE` stops before `git_guard`, before the `phase_start` trace anchor and before any executor dispatch, naming the phase, the report file it read, and both remedies (`/cad-undo <N>`, or `--rerun`).
2. The stop does NOT fire for an ordinary first execute (plans present, no reports directory), nor for a report reading `PLAN PARTIAL`, which is a genuine continuation and must still dispatch.
3. `/cad-execute <N> --rerun` still reaches the dispatch, unchanged.
4. Reproduced against the spike's own probe shape - tasks committed, report on disk, no `SUMMARY.md` - the run stops with zero executors dispatched and zero tokens spent, verified by the absence of a `dispatch` event in `trace.jsonl` for that run.
5. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 3: Stop the risk detector tripping on the review record
**Goal:** `ADJUDICATION-*.json` holds verbatim `failure_scenario` strings by design, so any phase that adjudicates a finding quoting `rm -rf` or `DROP TABLE` re-trips the destructive category on the docs commit that lands the record. A user reviewing their own work should not have to override a gate to file what the gate found.
**Depends on:** nothing
**Requirements:** RSK-06
**Success Criteria:**
1. A docs commit landing an `ADJUDICATION-*.json` whose stored reviewer text quotes a destructive command does not trip the destructive category. `planning/risk-check.mjs:224` no longer calls `scanDiff(body, categories)` with no path exclusion.
2. A genuine destructive command in a code path still trips the category at the same level it does today, proved by a case that fails without the fix - the exclusion must not buy quiet by weakening detection.
3. The range phase 1 of an earlier cycle settled with an override, `f70a0443..HEAD`, no longer needs one.
4. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 4: A killed rotation must not disable rotation
**Goal:** `rotateTrace` claims the record with a hard `linkSync` and releases it only in its own `finally` (`bin/lib/trace.mjs:684-690`), so a SIGKILL or host timeout leaves the claim standing forever. The record never write-deads, but the unconditional bound it promises is gone and every append pays for the state.
**Depends on:** nothing
**Requirements:** TRC-09
**Success Criteria:**
1. A claim abandoned by a killed process is reclaimed on the next append, and the 2 MiB bound holds across that kill - proved by a test that creates the abandoned claim directly rather than by asserting the happy path.
2. The per-append cost the abandoned state imposes (measured at ~266 ms) does not persist past one append once the stale claim is reclaimed.
3. A claim held by a LIVE rotation is not broken by the reclaim path; the discriminator is stated, not inferred, and a test covers both sides of it.
4. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.

### Phase 5: Recall matches the word the user typed
**Goal:** Recall ranks well over the corpus it sees, and both halves of that sentence are the problem: it does not fold suffixes, so `seam` misses `seams`, and some of what a user most needs back is outside the corpus entirely.
**Depends on:** nothing
**Requirements:** RCL-08
**Success Criteria:**
1. A suffix fold (`s` / `es` / `ing` / `ed`) is applied IDENTICALLY at index time and query time - `bin/lib/bm25.mjs:20` states the absence outright - so a query for `seam` returns documents containing only `seams`, and `close` returns `closes`.
2. Ranking does not regress on the existing corpus: a stated fixture query set returns its known-good top hits before and after, and the fixture is committed rather than run once by hand.
3. The remaining two items GH-93 names - one phrasing per call, and the failure records sitting outside the corpus - are each either delivered or recorded as an open item naming why they were not, rather than silently dropped by scoping the phase to the stemming half.
4. `node cadence-core/bin/test.mjs` is green and `self-verify` reports `ok:true`.
