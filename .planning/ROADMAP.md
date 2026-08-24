# Roadmap: v3.7.1 - one spelling, one phase

## Overview

**`v3.7.1`, opened 2026-08-24.** A patch cycle over one theme: a phase number
written two ways is two names for one phase, and Cadence should say so at the
door rather than resolve it silently to whichever one it rounded to.

The guard already exists. `phaseSpellingRefusal`
(`cadence-core/bin/planning.mjs:278`) compares the caller's raw `--phase`
spelling against `String(parsed.value)` and refuses when they differ, naming
both fixes - retype the flag, or rename the directory. It is the right shape and
it is wired at **two** of the roughly twenty-eight `requirePhaseArg` callsites
in that file: `cursor set` (`:612`) and `seed-reqs` (`:2586`). Those two were
wired because D-07 caught them writing a lossy value into a durable artifact -
the STATE cursor and a Traceability row. Every other command that resolves
`--phase` to a `phases/<N>/` path takes the normalized number and never
mentions that it discarded a spelling.

**The directory grammar contradicts its own diagnostic.** `PHASE_DIR_NAME`
(`planning.mjs:343`) is `/^[1-9]\d*(?:\.\d+)?$/`. The leading `[1-9]` makes
`08` a violation, which is what D-08 wanted, but nothing guards the fraction:
verified on this tree, `1.01`, `1.00` and `2.0` all test true, so
`phases/1.01` is silently legal and never reported as `phase-dir-grammar`
drift - while the detail `phaseDirGrammarDrift` prints for the entries it does
catch reads "bare integer or N.M, no zero-padding, no slug". The check says one
thing and enforces another, and `phases/1.01` beside a legal `phases/1.1` is
exactly the collision that kind of drift entry exists to name.

**Why now and why small.** These are the last two live pieces of the
sub-phase-identity cluster; the rest of it closed in `v3.6.x` and `v3.7.0`.
The work is a regex tightened by one character class, a guard called at the
sites that already parse the argument, and a census test so the twenty-ninth
callsite cannot ship unguarded. No new command, no new artifact, no reason
token renamed - the tokens are matched by tests and by callers, and renaming
one is a breaking change dressed as a wording fix.

**What this cycle is not.** It does not make the cursor hold a raw spelling.
`parseCursor` returns a Number that `renumber`'s shift arithmetic,
`cmdStatus`' `parsed.phase === current` agreement test and `phase-plans.mjs`'
`cursorPhase` all consume; D-07 decided that refusing a lossy spelling at the
write face beats carrying a half-raw one through three readers, and that
decision stands. It also does not widen `PHASE_LINE` or the two `phases/`
listing filters - `references/roadmap-phases.md` states why the phase-list
grammar is deliberately narrow, and D-09 states why the listing filters are
deliberately looser than `PHASE_DIR_NAME`.

This cycle seeds ids up front - `SPL-01`, `SPL-02` - so every one is either
traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.
Phases are added with `/cad-phase add`.

## Phases

- [ ] **Phase 1: One spelling, one phase** - tighten the phase-directory grammar to reject a zero-padded fraction, and apply the existing spelling refusal at every command that resolves `--phase` to a path

## Phase Details

### Phase 1: One spelling, one phase
**Goal:** A phase spelling that would be silently normalized is refused where
it is written, and a phase directory whose name would collide with another
phase is reported as drift. One rule, stated once, enforced everywhere it
applies.
**Depends on:** Nothing (first phase)
**Requirements:** SPL-01, SPL-02
**Success Criteria:**
1. `PHASE_DIR_NAME` rejects a zero-padded fraction: with `phases/1.01`,
   `phases/1.00` and `phases/2.0` on disk, `planning.mjs status` reports a
   `phase-dir-grammar` drift entry naming each of them, and names the legal
   directory it collides with when one is present. `phases/1.1`, `phases/1.10`
   and `phases/8` stay legal and produce no entry.
2. Whether `2.0` is a legal spelling of phase 2 is DECIDED and stated once, in
   `cadence-core/references/roadmap-phases.md`, and `PHASE_DIR_NAME`,
   `phaseDirGrammarDrift`'s printed detail and the two `phases/` listing
   filters each match that statement or carry a comment naming why they
   deliberately differ (D-09 is the standing example).
3. Every `planning.mjs` command that resolves `--phase` to a `phases/<N>/`
   path refuses a lossy spelling through `phaseSpellingRefusal`, not just
   `cursor set` and `seed-reqs`: for each such command, `--phase 1.10` against
   a tree holding `phases/1.1/` returns `ok:false` with a `bad-args` reason
   that names both fixes, rather than acting on phase 1.1.
4. A census test pins the guarded-callsite count against the
   `requirePhaseArg` callsite count in `planning.mjs`, so adding an unguarded
   path-resolving callsite fails the suite with a message naming the new
   callsite rather than passing silently.
5. The full suite is green and no `reason` token changed: a diff of the
   literal `reason` strings in `cadence-core/bin/` before and after the phase
   is empty.
