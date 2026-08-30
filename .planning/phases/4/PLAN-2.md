---
phase: 4
plan: 2
requirements: [LND-02]
files:
  - cadence-core/bin/lib/close-decision.mjs
  - cadence-core/bin/close-decision.test.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/land-cleanup.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 4: Land reads rulings, not raw findings - Plan 2 of 4

## Goal

`land-cleanup.mjs gate` decides an autonomous close from ADJUDICATED state: it
classifies the record entries it is piped through the one predicate Plan 1
owns, halts on what is genuinely unfixed and on a review nothing ruled, and
names an overridden halt on its envelope instead of passing it silently.

## Must be true when done

- Fed the v3.7.7 close's own artifacts, the gate under `auto_close` does NOT
  halt on the already-fixed `high`; the same entry with its fix commit removed
  returns `action: "halt"`.
- A `REVIEW-risk_surface-*.md` the caller reports as having no sibling record
  produces a FIFTH state, reported by its own name, and halts under
  `auto_close`.
- `stdin-unreadable`, `stdin-empty`, `malformed-json` and
  `not-a-findings-payload` are unchanged, each still halts under `auto_close`,
  and `close-decision.test.mjs`'s `UNREADABLE` loop passes with no edit to it.
- An entry with `overridden: true` and no fix commit is named on the gate
  envelope with `action` unchanged; one carrying both a fix commit and the
  override marker appears nowhere in that surfacing and does not halt.
- `lib/close-decision.mjs` states no severity of its own - the string literals
  `'blocker'` and `'high'` no longer appear in it - and it still imports
  nothing.
- `land-cleanup.mjs`'s header states what the gate reads, where it comes from,
  and that it still reads stdin alone.

## Context

Locked: D-06 (the classification runs at the `land-cleanup.mjs` seam, which
hands `decideGateHalt` an already-classified halting list plus the overridden
list; `close-decision.mjs` does NOT import `filing-decision.mjs`), D-07 (the
gate keeps taking its payload from stdin, grows no disk read, and `--dir` stays
the config-only flag it is today - what changes is what the CALLER pipes), D-09
(the overridden list is an ADDITIVE envelope key; `action` does not change),
D-11 (the inline `'blocker' || 'high'` literal is resolved here), D-13 (the
four names keep their one home and the fifth is added BESIDE them, never by
folding one), D-14 (the fixture is recoverable from this repository's history at
`220f99d3`; `.planning/config.json` sets `git.auto_close: true`, so this repo is
on the halting arm).

SEQUENTIAL: this plan runs after Plan 1 and before Plans 3 and 4. Names fixed by
this phase and used here: the predicate's third answer is `halting`; the payload's
additive key is `unruled`; the fifth state's name is `unruled-review`; the
envelope's additive key is `overridden`; Plan 3's carry destination is
`.planning/risk-carry/<N>/`.

## Tasks

### Task 1: `decideGateHalt` takes a decided list, and gains the fifth state

- **Files:** cadence-core/bin/close-decision.test.mjs,
  cadence-core/bin/lib/close-decision.mjs (start at `decideGateHalt`)
- **Action:** `findings` becomes the ALREADY-CLASSIFIED halting list the seam
  hands in, and this function stops deciding severity: delete the
  `f.severity === 'blocker' || f.severity === 'high'` filter and halt on a
  non-empty list. Do not replace it with an import, a local constant or any
  third spelling of the pair - that literal is a statement of
  `HALTING_SEVERITIES` that nothing watches, and this module's header promise
  ("Zero-dep (node builtins only, and it uses none) ... never does I/O") has to
  stay true, which is why the classification lives at the seam instead. Add an
  `unruled` input: under `auto_close`, a non-empty array returns
  `action: 'halt'` with a reason naming `unruled-review` and naming what it
  holds. It is its OWN arm and is never folded into `unreadable` - the payload
  WAS read here, so the unreadable sentence would be a false statement about
  input this gate did parse. Arm order: `unreadable` first (a payload nobody
  parsed says nothing about anything else), then `unruled`, then the halting
  list. With `auto_close` off all three still proceed, unchanged, because the
  manual publish ask owns the decision. Add an `overridden` input carried onto
  the returned object UNCHANGED on every arm including `proceed`: an override is
  a halt a person already cleared, so folding it into `findings` re-adds the
  false halt this phase removes, and `/cad-land` keeps branching on `action`
  alone. State the fifth name in the docblock beside the four so the pure core
  and the seam still cannot drift. Stay total: a non-array `unruled` or
  `overridden` coerces to `[]` and never throws. Keep every reason string naming
  `risk_surface` as the producer - a test pins that, and it is what makes a
  fed-by-nothing gate visible. One existing arm changes meaning and must be
  rewritten rather than deleted quietly: the `only medium/low -> proceed` test
  asserted a filter this function no longer performs, so replace it with an arm
  proving the function halts on whatever list it is handed and reads no severity
  at all, and say in its comment that the classification moved to the seam.
  Leave the `UNREADABLE` loop untouched.
- **Verify:** `node --test cadence-core/bin/close-decision.test.mjs` is green;
  `git diff` shows no change inside the `UNREADABLE` list or its two generated
  arms; `grep -n "'blocker'\|'high'" cadence-core/bin/lib/close-decision.mjs`
  returns nothing; new arms cover a non-empty `unruled` halting under
  `auto_close` with the reason naming `unruled-review`, the same input
  proceeding with `auto_close` off, and `overridden` riding both the halt and
  the proceed shape without moving `action`.

### Task 2: The seam classifies from record entries

- **Files:** cadence-core/bin/land-cleanup.test.mjs,
  cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/land-cleanup.mjs (start at `readFindings` and `gate`)
- **Action:** `readFindings` additionally returns `unruled`, read off an
  `unruled` key on the same stdin object; absent, or present but not an array,
  reads as `[]`. Its four names, the order they are decided in, the empty-stdin
  rule and the bare-JSON-array form are all unchanged, because they are what the
  four-name contract is. `gate` imports `unfixedFromEntries` from
  `./lib/filing-decision.mjs` - the classification belongs at this seam, not in
  the pure core - runs it over what was piped, and passes `halting` as the
  halting list and `haltingSurvivors` as the overridden list, then spreads the
  decision onto the envelope as it already does, so the overridden list rides
  out on `overridden`. The gate reads no disk for this: `--dir` still resolves
  config and nothing else. The payload's members are now adjudication record
  `entries[]` rather than raw review findings, so the existing gate arms that
  pipe `{"findings":[{"severity":"blocker"}]}` must be updated to entries
  carrying `"ruling":"survived"` and no fix commit. Do NOT add a severity
  fallback for a member that carries no ruling in order to keep those arms
  passing - reading a raw review finding as a live blocker is precisely the
  behaviour this requirement removes. `self-verify.test.mjs` is in the lease
  because it holds the census whose subject list names `land-cleanup.mjs`; leave
  its count alone unless a `mergeLayers` callsite moves, which it must not.
- **Verify:** `node --test cadence-core/bin/land-cleanup.test.mjs` is green;
  piping `{"findings":[{"ruling":"survived","severity":"blocker"}]}` under
  `git.auto_close: true` returns `action:"halt"`, and the same entry plus
  `"fix_commit":"3341ffb0"` returns `action:"proceed"`; the four unreadable arms
  and the `warnings[]` arm behave exactly as before.

### Task 3: Reproduce the v3.7.7 close as a fixture

- **Files:** cadence-core/bin/land-cleanup.test.mjs
- **Action:** recover the two artifacts with
  `git show 220f99d3:.planning/phases/2/REVIEW-risk_surface-plan-1.md` and
  `git show 220f99d3:.planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json`
  and inline their real bytes as fixture constants in the test, citing that
  commit in the comment. Use the real ones and do not synthesize an equivalent:
  the record is round TWO with no round-one sibling, which is the shape a
  handmade fixture would not have, and the `high` it rules `survived` names the
  fix commit `3341ffb0` against `adjudication-record.mjs:460` - the finding that
  actually halted the v3.7.7 close. Four arms, all driven through the seam with
  `git.auto_close: true`: (a) pipe the record's `entries[]` and assert
  `action:"proceed"` - this is the regression itself; (b) the same entries with
  the `fix_commit` key deleted from the `high` and assert `action:"halt"` with
  that entry on `findings`; (c) pipe the REVIEW file's own `findings` array with
  `unruled` naming the review file, and assert `action:"halt"` with the reason
  naming `unruled-review`; (d) an entry with `overridden: true` and no fix
  commit proceeds with that entry named on `overridden`, and the same entry
  carrying a fix commit as well proceeds with `overridden` empty.
- **Verify:** `node --test cadence-core/bin/land-cleanup.test.mjs` is green with
  the four arms; arm (a)'s finding is the one raised at
  `cadence-core/bin/lib/adjudication-record.mjs:460`; arm (b) halts on that same
  entry and no other. Check arm (a) is a real regression rather than a
  tautology BY THE PAIR: assert arm (a)'s entries carry a `survived` `high`
  whose `fix_commit` is `3341ffb0`, and that arm (b) is that same entries array
  differing by exactly that one deleted key while the decision flips `proceed`
  to `halt`. Do NOT use stripped `ruling` keys as the falsifier:
  `cadence-core/bin/lib/filing-decision.mjs:120` gates on
  `ruling === 'survived'`, so a ruling-less entry is not a halting survivor and
  the gate proceeds either way - that check passes under both the fixed and the
  broken predicate and proves nothing.

### Task 4: State the gate's input in the contract comment

- **Files:** cadence-core/bin/land-cleanup.mjs
- **Action:** start at the `gate` paragraph of this file's header comment, the
  sentences naming the two `REVIEW-risk_surface` globs, and rewrite that
  paragraph to state the ADJUDICATED input, because it
  is the only statement in code of where the gate's findings come from - a grep
  over `cadence-core/bin/` returns this file and test fixtures and nothing else.
  It must say: the caller unions the `entries[]` of every
  `ADJUDICATION-risk_surface*.json` for this branch's fires, across EVERY round,
  from `.planning/phases/*/` and - after `/cad-milestone` prunes the phase dirs
  - from the copies `planning.mjs risk-carry` leaves at
  `.planning/risk-carry/<N>/`; that it names on `unruled` every
  `REVIEW-risk_surface*.md` carrying no such sibling, which halts under
  `auto_close` as `unruled-review`; that an overridden halt comes back on
  `overridden` without moving `action`; and that the gate still reads stdin
  alone and `--dir` is still config-only. Keep the four-name paragraph as it
  stands. The carry seam it names is Plan 3's and does not exist yet; the path
  and the subcommand name are fixed by this phase, so write them.
- **Verify:** `grep -n "REVIEW-risk_surface" cadence-core/bin/land-cleanup.mjs`
  no longer returns a sentence instructing a union of `findings` arrays, and the
  header names `ADJUDICATION-risk_surface`, `.planning/risk-carry/`,
  `unruled-review` and `overridden`; `node cadence-core/bin/test.mjs` is green
  and `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

- Carried from Plan 1: a record `buildEntries` accepted can never hold a
  `halting` entry, since it refuses a `survived` blocker/high that names neither
  a fix commit nor the override marker. So arm (b) of Task 3 constructs a shape
  no valid writer produces - which is the point. The halting arm is the rail
  under a payload the gate never validated, and the gate's live halts are the
  four unreadable states plus `unruled-review`.
- Accepted residue, stated rather than fixed: a hand-rolled caller that pipes
  raw review findings AND names nothing on `unruled` now gets `proceed` where it
  used to get `halt`. Shipped prose is the only caller and Plan 4 moves it in
  the same phase, and a tree whose reviews are genuinely unruled halts on the
  fifth state instead. Closing it properly would mean a SIXTH state for a
  payload member that carries no ruling, which no CONTEXT decision authorizes.
