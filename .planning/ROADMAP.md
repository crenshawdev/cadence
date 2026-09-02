# Roadmap: v3.7.11 - unresolved inputs

## Overview

**`v3.7.11`, opened 2026-09-02.** The source is the sentence v3.7.10's own
overview used to defer `GH-229`: both it and `GH-178` "are about resolving an
INPUT before a gate runs; this cycle is about what the record says AFTER one
did." That deferral comes due here, and two more members of the same class
joined the board since: `GH-246` and `GH-244`.

**The thread.** A gate ran, and the input it ran on could not be resolved. Not
wrong - unresolvable, and the gate proceeded anyway. A blocking risk check
picks its review categories off a diff it never obtained. A completion contract
asks whether a record reached the trace on a repository where no trace can
exist. A create is retried after an outcome nothing could determine. In every
case the gate reports an answer it had no input to compute, and in every case
the shape of the failure is the same: the code treats "could not resolve" as if
it were an ordinary value.

**What is broken.**

`cadence-core/bin/planning/core.mjs:509-528` puts both `rev-parse` calls inside
one `try`, so a range with one unresolvable end discards the end that resolved.
Observed on verbatim 2026-08-30T18:28:50.960Z during `/cad-verify`:
`base_id` and `head_id` both null for the pair `HEAD`..`STAGED`, when `HEAD`
always resolves. The gate wrote `checked:false, inconclusive:true` and the
review that followed scoped itself on nothing.

`STAGED` is not a sentinel anywhere in this codebase - the three occurrences are
unrelated prose. `cadence-core/workflows/verify.md:270-274` describes the
staged-diff scope in words ("the reviewer runs `git diff --cached` in the cwd it
inherits") and gives no argument spelling for it, so a coordinator asked for a
rev pair git cannot name.

`cadence-core/workflows/execute.md:339` documents `--base {pre-plan HEAD} --head
HEAD`. A plan that lands no commits makes those the same commit, and the gate
writes `checked:true, empty:true` - the correct answer for a zero-byte diff, and
a completed clean check that established nothing. Observed twice on smithers,
2026-08-27T23:55:38 and 2026-08-28T14:28:12.

`cadence-core/workflows/task.md:173-174` says done is reported only on a run
whose record reached the trace, stated as `written: true`. `:179-181` extends
that to a repository with no `.planning/` and offers an escape - "or say the
check is unrecorded rather than reporting done on it" - while `:258-260` states
the seam "creates NOTHING where `.planning/` is absent: there it answers
`written: false`." The first rule and the escape cannot both hold. An inline
task on an unadopted repository commits its work and then cannot honestly
report done under either reading.

`cadence-core/bin/issue-filing.mjs:90-99` collapses every `execFileSync` throw
into `{ ok: false, stdout: '' }`, so a create that landed on the forge and one
that never ran are the same value. The seam's own comment at `:583` calls the
result "AMBIGUOUS rather than known-failed" and `:585` tells the operator to
search the tracker by hand before re-running. On the re-run the only dedup set
consulted is `DECLINED.md` (`:322-345`); `FILED.md` is written and never read,
and the tracker is never asked. This repository filed `#241` and `#242` four
seconds apart, byte-identical, fingerprint `084c9ce03c072e0b`, with one row in
`.planning/FILED.md:35`.

**The standard.** Would a user on their own project feel it. The `GH-229`
observations came off verbatim and smithers, not off Cadence-on-Cadence.
`GH-246` lands on `/cad-task`'s advertised treeless path, which is the arm an
unadopted repository is supposed to use. `GH-244` puts a duplicate on any
project's public tracker whenever a create times out - the case the code
already documents as expected.

**Out of scope, deliberately.** `GH-178` (`reads.jsonl` stores a Bash call's
program, not its shape) is the fourth member of this exact class and the one
v3.7.10 paired with `GH-229` by name. It is held out to keep this cycle at
three phases, not because it belongs elsewhere; `/cad-phase add` is the whole
cost of bringing it in. `GH-247` is a README wording fix that rides the cycle as
a `/cad-task`, not a phase. `GH-240` and `GH-241` are guard-tightening on values
no provider has been observed to send. `GH-230`, `GH-140` and `GH-119` are
decisions, not defects.

## Open Questions

- **OQ-1 - what the staged scope is spelled as. ANSWERED 2026-09-02: neither
  of the two shapes below - an explicit `--staged` arm on the seam.**
  `risk-check run` and `risk-check status` accept `--base <ref> --staged` in
  place of `--head`, diff `git diff --cached` against the resolved base, and
  record `staged: true` with `base_id` set and `head_id` honestly null. The
  branch lives at the two call sites in `risk-check.mjs` (`:241`, `:428`)
  BEFORE `resolveRange` is reached, so `resolveRange` keeps its contract and no
  non-ref spelling ever passes `riskRef`. `verify.md:273` and `debug.md:111`
  then carry that one machine spelling. The deciding evidence: detection is
  mandated through the seam (`risk-surface.md:11-14`, "a SEAM's answer, never a
  model's reading"), the seam is ref-only (`core.mjs:641`), and `git-guard.md:123`
  fires the gate BEFORE the commit lands - so the staged scope cannot be turned
  into a committed range, and a diff FILE (shape (c)) reaches only the reviewer,
  never detection. Two projects improvised `HEAD..STAGED` to satisfy exactly this
  gap: verbatim 2026-08-30T18:28:50 and weathervane 2026-08-31T11:21:11. The two
  shapes as originally posed: either `resolveRange` learns a staged sentinel,
  which puts a non-rev value into a function whose whole contract is "the
  commit ids a caller's two refs name"; or `verify.md` passes the staged diff
  as a file the way shape (c) already does, which leaves detection with no
  spelling at all. The partial-resolve fix is owed either way and does not
  depend on this.
- **OQ-2 - whether a treeless task may report done at all.** `GH-246` can be
  closed in two directions and they are not equivalent. Preserve the advertised
  lightweight path - the task finishes, states plainly that no durable Cadence
  receipt exists, and leans on git for the code record - or make a durable gate
  record mandatory, in which case `/cad-task` must refuse BEFORE its first
  commit and say the repository needs adopting. The second is defensible and
  narrows the product; the first is what the workflow currently advertises in
  four places.

## Phases

- [ ] **Phase 1: A gate refuses the range it could not resolve** - a partial resolve keeps the end that resolved, and no caller hands a blocking check a range that cannot match
- [ ] **Phase 2: A treeless task can finish honestly** - one rule for whether done may be reported when no record can land, and the inline path holds to it
- [ ] **Phase 3: A create states what it did** - an ambiguous create is resolved against the tracker before it is retried, never re-filed blind

## Phase Details

### Phase 1: A gate refuses the range it could not resolve

**Requirements:** `RNG-05`, `RSK-10`

`GH-229`, which is three separable defects sharing one symptom: a blocking gate
that reports a verdict it had no diff to compute.

The partial resolve is the smallest and is owed regardless of how OQ-1 lands.
`resolveRange` runs `id(base)` and `id(head)` inside a single `try` and its
catch returns both ends empty, so a caller learns nothing about which end
failed and a resolvable `HEAD` is discarded alongside an unresolvable sibling.
Resolve the ends independently and let the refusal name the end that failed.

The staged scope was OQ-1 and is answered above: a `--staged` arm on
`risk-check run` and `status`, branched before `resolveRange` at
`risk-check.mjs:241` and `:428`, and `verify.md:273` plus `debug.md:111`
rewritten to spell it. The invariant the answer serves is that no workflow asks
the seam for a rev spelling git cannot name, and that a scope the workflow
describes in prose has exactly one machine spelling.

The self-comparing range is a caller fix. `execute.md:339` should not emit a
range whose two ends are the same commit; a plan that landed nothing has
nothing to check, and the honest record for that is a skip that says so, not a
clean check over an empty diff. Worth checking in the same pass whether
`task.md:155` can reach the same state.

**Success criteria**

- `resolveRange` given one resolvable and one unresolvable ref returns the id it
  resolved and names the end that failed. A test covers each end failing.
- A `risk_check` on an unresolvable range writes a row a reader can tell apart
  from a clean check. `checked:false` with a stated cause, never a bare
  `inconclusive` a caller can proceed past.
- The staged scope has one spelling, and `verify.md` uses it. No workflow in
  the tree passes a rev value that `git rev-parse --verify` rejects.
- A plan that lands no commits produces no `checked:true, empty:true` row for a
  range whose ends are the same commit.
- `GH-229` traces to a REQUIREMENTS row pointing at Phase 1.

### Phase 2: A treeless task can finish honestly

`GH-246`. The defect is a contradiction inside one workflow, and OQ-2 decides
which sentence survives.

`task.md:173-174` and `:179-181` disagree about whether a run may report done
when no record can reach the trace. On a repository with no `.planning/` the
answer to `written:` is always false by construction (`:258-260`), so under the
first sentence the inline path can never finish and under the escape it always
can. A user on an unadopted repository - the audience the inline arm is built
for - commits their work and then meets whichever reading the coordinator picks.

The mechanics for the preferred direction already exist. `:203-209` builds the
transient risk diff in a `mktemp -d` run directory precisely so the inline path
creates nothing under `.planning/`, and says in as many words that "the same
applies when `.planning/` does not exist at all." What is missing is the
completion rule agreeing with it.

**Success criteria**

- `workflows/task.md` states one rule for reporting done when no record can
  land. The `:173-174` sentence and the `:179-181` escape read as one
  instruction, not two.
- An inline `/cad-task` on a repository with no `.planning/` completes, and its
  final report states the risk check's disposition explicitly rather than
  implying it passed.
- That run creates no `.planning/` directory and leaves no slug directory
  behind - the success criterion `:211-212` already claims.
- If OQ-2 lands on mandatory records instead, `/cad-task` refuses before its
  first commit and names adoption as the fix; no path commits work it cannot
  then close.
- `GH-246` traces to a REQUIREMENTS row pointing at Phase 2.

### Phase 3: A create states what it did

`GH-244`. A create whose outcome the client could not determine is retried with
no idempotence key, and the fingerprint that would make the retry safe is
already in the issue title.

`run` cannot distinguish a create that committed from one that never ran, and
that is not worth fixing at the `execFileSync` layer - a transport that drops
after the write is genuinely indistinguishable from the caller's side. The fix
is on the other end: before creating, ask the forge whether an issue carrying
this fingerprint already exists.

Every piece exists. `issueTitle` (`lib/filing-decision.mjs:337`) writes the
fingerprint into the title; `fingerprintInTitle` (`:355`) reads it back;
`normalizeDeclines` (`:426`) already turns a forge list response into a set of
fingerprint tokens and already refuses a response that filled its page rather
than proceeding on a partial one. All of it points at the local decline set and
none of it at the tracker.

Reading `FILED.md` before a create is worth doing beside this, but it does not
close the case on its own: the ambiguous first create leaves no row, which is
exactly why a retry is needed.

**Success criteria**

- A create is preceded by a lookup for the finding's fingerprint on the target
  repository. An existing open or closed issue carrying it is not filed again.
- An incomplete lookup response refuses the fire and names why, the way
  `normalizeDeclines` refuses a filled page - never a create on a partial
  answer.
- Re-running a filing whose previous create landed but reported failure files
  nothing new and reports the issue that already exists.
- `FILED.md` is consulted before a create, so a fingerprint with a row is not
  re-filed even when the tracker lookup is unavailable.
- `GH-244` traces to a REQUIREMENTS row pointing at Phase 3.
