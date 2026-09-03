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
- **OQ-2 - whether a treeless task may report done at all. ANSWERED 2026-09-02:
  it may - the lightweight path stands, and the done block says what did not
  land.** A `/cad-task` on a repository with no `.planning/` finishes; its
  report states the risk check's verdict and that the receipt is unrecorded
  because there is no planning root, and git is the code record. Done is
  reported on a `written:false` ONLY when the seam's own `reason` is the absent
  root - `ENOENT` from the trace seams, "no planning root" from `task-record` -
  and any other reason still withholds done, told apart on the envelope and
  never on a `[ -d .planning ]` check beside it. The deciding evidence: every
  seam the task calls already answers `ok:true, written:false` and creates
  nothing (`lib/trace.mjs:1110-1209`, `task-record.mjs:132-143`,
  `risk-check.mjs:386-450`), the check itself genuinely runs and returns a real
  verdict, and the rail-1 guard and atomic commits hold there - what a treeless
  run cannot deliver is a durable Cadence receipt, and the report says so. The
  mandatory-record direction was considered and rejected: it narrows the
  product the workflow advertises in four places, and refusing before the
  first commit buys nothing the honest report does not. Phase 2 CONTEXT
  D-01/D-02 hold the decision. As originally posed: `GH-246` can be
  closed in two directions and they are not equivalent. Preserve the advertised
  lightweight path - the task finishes, states plainly that no durable Cadence
  receipt exists, and leans on git for the code record - or make a durable gate
  record mandatory, in which case `/cad-task` must refuse BEFORE its first
  commit and say the repository needs adopting. The second is defensible and
  narrows the product; the first is what the workflow currently advertises in
  four places.

## Phases


## Phase Details
