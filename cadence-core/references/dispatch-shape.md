# Dispatch shape

Read by whoever writes or edits a workflow's dispatch or a deferred read.

**Prompt shape (cache discipline).** Order every dispatch prompt stable-first:
context that repeats across dispatches of the same role (phase/goal, shared
files to read) goes BEFORE the volatile per-dispatch specifics (this plan, this
scope, a continuation's completed-task table). The prompt cache matches the
longest identical prefix, so the 2nd..Nth dispatch of a role reads most of its
prompt from cache. Never restate rules the agent's own definition already
carries: the definition is a cached prefix, and the dispatch prompt is billed
fresh each time.

**Return shape (bounded handoff).** Keep a subagent's return bounded. When the
agent produced a durable artifact (a written file, commits), return a slim
summary plus the path/hashes and let the orchestrator open the artifact only if
it must - never echo its contents back. With no artifact, cap the structured
return to what the orchestrator will act on and push raw evidence to a file.

**Handoff read discipline.** The coordinator reads a source doc for handoff only
when it will DISTILL it into the dispatch prompt. If the spawned agent reads the
file whole itself, pass the pointer (the path), not the bytes - reading it in the
orchestrator just to hand it down doubles the read and bloats the main context
with a file the agent is about to open anyway.

**File round-trip (when the extra turn pays).** Routing an artifact through a
file costs one extra turn - the parent's read-back - so it pays only when BOTH
hold: the read-back folds into a turn the parent was taking anyway (writing
SUMMARY, making the docs commit, merging a worktree), and the artifact lands
LATE enough in the run that its bytes would otherwise ride every remaining turn.
A small return the parent acts on immediately stays inline. The side with the
SMALLER resident context extracts: the child (holding one plan) writes the file
and the parent (holding the whole phase) reads a digest.

The same test covers any deferred read: deferring a reference pays when the
read folds into a turn the command was taking anyway AND only some branches
reach it, so an eager `@`-include consulted on EVERY path stays eager - unless
its SIZE says otherwise. An eager include costs its bytes times every remaining
turn, a deferred read one tool call, so an every-path reference whose residency
outweighs that call defers anyway; `weight.mjs resident` decides which side an
include falls on. A reference consulted at more than one distinct STEP stays
eager whatever its size, since no single deferred read covers them all;
mutually exclusive arms of ONE step count as one site (`cad-land` defers
`references/git-publish.md`, step 4a or 4b, while `references/git-guard.md`
stays eager at steps 1, 2 and 3).

Every deferral states, inline at the Read itself, the reference's consult-site
count: distinct consult STEPS, found by grepping the reference name and reading
which step each hit sits under, mutually exclusive arms counted once - never a
raw grep total. It does NOT state the reference's byte size, which goes stale;
cite the file, not its size. "Folds into" admits an extra tool round-trip inside
a turn the command was already taking, never a read that forces a turn the
command would not otherwise have taken.
