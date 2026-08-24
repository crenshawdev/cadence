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

- [x] **Phase 1: Every refusal names its next step** - a plain-language hint at every reason site in `bin/`, plus the self-verify check that makes a hintless reason a reported problem
- [x] **Phase 2: A repo-scoped key refuses at the layer that cannot honour it** - `config.mjs set` reads the schema's `repo_only` marker and complains at write time instead of at land time

## Phase Details

### Phase 1: Every refusal names its next step
**Goal:** A user who hits a seam refusal is told what to do next in their own
terms, and the invariant is enforced by a check rather than by remembering.

**Requirements:** HNT-01, HNT-02

The two halves are one phase because the second is what makes the first hold.
A sweep across 186 sites is a one-time correction of a number that has drifted
twice already; the check is what converts it into a property of the tree. #238
says this in its own scope section, and the measurement above is the evidence:
130/10 at filing, 186/13 today, with every hint still confined to the two files
that had them.

The 13 existing hints are the model to copy, and they share a shape - they name
the action in the user's terms without explaining the internals. `make them
readable and re-run - an unreadable queue refuses a land exactly as a member
does` says what to do; `unprovable-queue` does not.

The check is the part with a real decision in it. Not every reason site is a
user-facing refusal: some are internal branches, some are re-thrown, and some
already carry their explanation in a sibling field. A check that demands a hint
at all 186 will be silenced rather than satisfied, so the phase has to state
which reason sites are in scope and let the check read that rule rather than
count occurrences. Getting that boundary wrong in either direction is how this
lands as noise.

`bin/` is not weight-budgeted, so hint text costs no context bytes. It is not
free of every constraint: `git-guard.mjs` runs inside a PreToolUse hook on every
Bash call, and `lib/global-only-keys.mjs` states why that path stays free of
cross-file reads at runtime. A check that walks the tree belongs in
`self-verify.mjs`, which already runs at build time and already reports
`problems: []`.

**Success Criteria:**

1. Every reason site the phase declares in scope sets a companion hint that
   names an action, and the count of in-scope reason sites without one is zero
   - stated as both numbers, not as "all of them".
2. The in-scope boundary is recorded as a numbered CONTEXT decision naming what
   it excludes and why, so a later reader can tell a deliberate exclusion from
   an oversight.
3. `node cadence-core/bin/self-verify.mjs --root .` reports a hintless in-scope
   reason as a `problems[]` entry naming the file and the reason token, and the
   check fails against the tree as it stands before the sweep.
4. No reason token string changes: `git diff` over the cycle shows no edit to
   any `reason:` literal value, and `node cadence-core/bin/test.mjs` reports 0
   failures without any test's expected reason being updated.
5. No weight budget moves: `node cadence-core/bin/weight.mjs` reports every
   budgeted surface within its pin, and the diff touches no file under
   `workflows/`, `references/` or the agent contracts.
6. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
   `problems: []` on the finished tree, and `node cadence-core/bin/test.mjs`
   reports 0 failures.

### Phase 2: A repo-scoped key refuses at the layer that cannot honour it
**Goal:** Writing a repo-scoped key into the user-global layer is refused at
write time, by a rule read from the schema rather than hard-coded per key.

**Requirements:** SCP-01

The defect is silence, not the eventual refusal. `git.auto_close` written
globally produces no error; the repository never opts in, and the user finds out
when the close refuses at land time. The correct refusal at the wrong moment is
what makes this worth its own phase.

It is a general rule and not a special case. 33 keys carry `"src": "repo"` in
`config.schema.json`, so the fix changes write behaviour for 32 keys beyond the
one that surfaced it, and that blast radius is why it is not folded into phase
1. No `repoScoped` symbol exists anywhere under `cadence-core/bin/` today.

The precedent to follow is `lib/global-only-keys.mjs`: the same scope question
in the opposite direction, hand-maintained rather than read off the schema at
runtime, and cross-checked against the schema marker by self-verify in both
directions. It states its reasons in the file - a cross-file read at runtime is
how a cross-key check came to fire unconditionally, and that module runs inside
the PreToolUse hook. Phase 2 has to decide whether the repo-scope set follows
that pattern or reads the schema directly, and `config.mjs` is not in the hook
path, which is the fact that makes the answer different here.

This phase shares no files with phase 1 and carries no ordering against it.

**Success Criteria:**

1. `node cadence-core/bin/config.mjs set git.auto_close=true --global` refuses
   with a reason naming the key's scope, and the same pair at the repo layer
   still applies.
2. The refused set is DERIVED from a schema marker rather than from a literal
   list of key names, demonstrated by a test that substitutes a schema fixture
   marking a different key and shows it refused with no line of the rule
   changed. (Superseded premise, corrected by CONTEXT D-01: this criterion was
   originally written as "covers all 33 `"src": "repo"` keys", on the
   assumption that `src` was the layer-scope marker. The schema's own legend
   defines `"src": "repo"` as "settable in either layer", so the phase shipped a
   new `repo_only` field instead. The derivation is what this criterion was
   asking for; the count rested on the wrong field.)
3. The check runs inside `checkPairs`, so `config.mjs check` reports the same
   scope error `set` refuses on, and the refusal stays atomic - no partial write.
4. Adding a new `"src": "repo"` key to `config.schema.json` requires no edit to
   the scope rule, or self-verify reports the two as disagreeing; whichever the
   phase chooses is recorded as a numbered CONTEXT decision against
   `lib/global-only-keys.mjs`'s stated reasons for the opposite choice.
5. The refusal carries a hint naming what to do next, meeting phase 1's bar even
   though the two phases do not depend on each other.
6. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
   `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.
