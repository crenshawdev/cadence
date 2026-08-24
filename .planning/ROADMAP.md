# Roadmap: v3.7.0 - the refusal that names the next step

## Overview

**`v3.7.0`, opened 2026-08-23.** A minor cycle over one theme: a seam that
refuses hands the user a kebab-case token and nothing else, so the token IS the
error message. Filed as #238, reassigned here from `v3.6.1` because it is a
named theme rather than a defect, and it ships alongside #249, a scope rule the
config write face has never enforced.

**The theme is one sentence: Cadence tells the user what went wrong in its own
vocabulary and never tells them what to do about it.** Measured 2026-08-23
across `cadence-core/bin/`, tests excluded: **186 sites set a literal `reason`
and 13 set a literal `hint`**, and 40 of the 42 non-test files that refuse
carry zero hints. Every hint in the tree is in `planning.mjs` (15) or
`skim.mjs` (2); `release-decision.mjs` sets 14 reasons and no hint,
`text-transport.mjs` 16 and none, `bulk-output.mjs` 14 and none, `route.mjs` 9
and none. The workflows correctly say "relay reason/hint", which is exactly why
a missing hint reaches the user unmediated.

The ratio is getting worse, not better. #238 counted 130 reason sites against
10 hints when it was filed; `v3.6.0` and `v3.6.1` added seam surface faster
than they added hints, and the same measurement today reads 186 against 13.
That drift is the argument for the second half of phase 1: a sweep fixes the
count once, and a self-verify check is what stops the 187th refusal shipping
without a next step.

**Why this surface and not the other one.** There are two prose surfaces in
this tree and only one should get simpler. Model-facing prose - `workflows/`,
the agent contracts, `references/` - is weight-budgeted and load-bearing;
`workflows/plan.md` sits at its 22,638 B budget with zero headroom and
self-verify fails the build on overrun. Simplifying that prose makes it longer
and strips the precision that makes gates falsifiable. Hints live in `bin/`,
which is not weight-budgeted, so this theme costs no context bytes on any
surface.

**Phase 2 is the same defect one layer over.** `config.mjs set` applies whatever
it is passed at whatever layer. `checkPairs` (`cadence-core/bin/config.mjs:151`)
validates retired keys, unknown keys and value types, and nothing about layer
scope, so a repo-scoped key written into the user-global layer draws no
complaint at write time. `git.auto_close` is the sharp case: the user learns the
repository never opted in when the close refuses at land time, which is correct
and far too late. The schema already carries the marker the fix reads - 33 keys
tagged `"src": "repo"` in `config.schema.json` - and `lib/global-only-keys.mjs`
is the same rule already enforced in the opposite direction, at the merge rather
than at the write.

**What this cycle is not.** No reason token changes: they are matched by tests
and by callers, and renaming one is a breaking change dressed as a wording fix.
No behavior change in phase 1 - purely additive text plus one new check. No
rewrite of model-facing prose. The two accessibility gaps #238 names as deferred
stay deferred: the ask-user register rail needs a seam rule rather than a code
change, and the done-step report field lists are model-facing.

This cycle seeds ids up front - `HNT-01`, `HNT-02`, `SCP-01` - so every one is
either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.
Phases are added with `/cad-phase add`.

## Phases


## Phase Details
