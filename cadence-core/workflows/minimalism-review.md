<purpose>
An on-demand delete-hunting pass over code the user names. It asks the one
question an adversarial correctness review structurally cannot: does this code
need to exist at all? A correctness reviewer refutes an artifact against its
goal, so a hand-rolled helper the platform already ships, a base class with one
subclass, a hook nothing calls and a key nothing reads all pass it - nothing
they do is WRONG. This pass hunts exactly those four species and returns a
ranked delete-list.

It reuses the review subsystem's own reviewer (references/review-triggers.md's
`claude-subagent` backend): the base `cad-reviewer` is dispatched with a
minimalism instruction that RETARGETS its subject, and the list comes back in
the findings schema every reviewer in the subsystem shares.

This workflow never auto-fires - no entry in references/review-triggers.md's
wiring table, no `review.triggers` key, no gate and no verdict. It runs only
when a human invokes `/cad-minimalism-review <target>` on code they chose to
question, and it applies NOTHING (see `<guardrails>`).
</purpose>

<process>

<step name="resolve_target">
Parse `$ARGUMENTS` for the target - the code this pass is asked to question.
Three shapes, and the run NAMES the one it resolved:
- **a path** - one file.
- **a directory** - the files under it, which the reviewer globs for itself.
- **a phase number** - the committed range that phase's
  `.planning/phases/<N>/SUMMARY.md` records, as a `<base_ref>..<head_ref>` pair.

When `$ARGUMENTS` is empty or resolves to more than one of those at once, ask
ONCE (ask-user seam): "What should this pass try to delete? (a path, a
directory, or a phase number)". Take that answer and continue - never a second
round of questions.

When the named target does not resolve - a path or directory that is not there,
a phase with no SUMMARY.md, a range whose refs this tree does not carry - say
which one failed and STOP. Do not widen the target to its parent and do not
guess which file was meant: a delete-list over the wrong code is worse than no
list, because it reads exactly like a correct one.
</step>

<step name="dispatch">
Assemble `{ instruction, artifact }`:
- `artifact` = the target as a REFERENCE, never its bytes (references/seams.md's
  deferred-read rule - the reviewer produces what it needs with its own
  Read/Grep/Bash): the path for a file, the directory for a directory, the
  `<base_ref>..<head_ref>` pair for a phase range.
- `instruction` = "Hunt code that WORKS and should not exist. Four species:
  (1) reinvented standard library or reinvented dependency - a hand-rolled
  helper the language, its stdlib, or a dependency already in this project
  ships; (2) an abstraction with ONE implementation - an interface, base class,
  factory, wrapper or indirection layer with a single subclass or a single
  caller; (3) dead flexibility - a parameter, hook, mode, strategy or extension
  point nothing exercises; (4) config nobody sets - a key, flag or environment
  variable no code path reads, or that every caller leaves at its default. For
  each, name the file and the line, and say what deleting it would cost.
  Correctness defects are NOT the subject of this pass - a bug you find here is
  out of scope, and 'it works' is not a defence against any of the four species.
  Rank with `severity`: `blocker` for the surface whose deletion buys the most,
  `low` for the one that barely pays."

The instruction is what retargets the reviewer. `skills/cad-reviewer-contract`
defaults to correctness and rules approach differences out of scope, so a prompt
that does not say the subject changed gets a correctness review back.

Bracket the worker in the joined run record first. `<N>` is the target phase
when the target IS a phase, and the STATE cursor's phase
(`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor get`)
for a path or directory target. The read-set is the target the USER named,
resolved, so write that reference to a scratch file and pass the path
(caller-derived text - references/conventions.md):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --read-file <path>
```

Then dispatch `cad-reviewer` through the spawn-agent seam with the payload above
as its prompt. No routing cell resolves a model for this arm - it is the base
`cad-reviewer` at the session default, at every stakes level - and this pass
reads no config key of its own, so there is no tier/effort pair to look for and
none to report. There is no cross-model arm either: a provider call needs a
resolved tier and this pass owns no tier key.

Parse the returned `{findings:[...]}` and close the bracket the moment you have
it. OMIT `--tokens` on a figureless return (seams.md's bracket rule):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --tokens <the token count on the subagent return>
```

A dispatch that failed or returned nothing parseable writes what failed to a
scratch file and adds `--detail-file <path>` to that same line (caller-derived
text - references/conventions.md), closing as a checkpoint, so the burned budget
still reaches the record.

That arm reports NO LIST, never an empty one: an unusable return and a clean
sweep are opposite results and must not read alike.
</step>

<step name="present">
Present the delete-list ranked by `severity` - every `blocker`, then `high`,
then `medium`, then `low` - each entry carrying the reviewer's own `file`,
`line`, `claim` and `failure_scenario` as it returned them. On this pass
`failure_scenario` reads as what keeping the surface costs; it is the
reviewer's answer and not yours to rewrite.

Zero findings is a RESULT with its own line - "the pass read `<target>` and
found nothing to delete" - naming the target that was read. Never a bare "no
findings": that reads identically to a pass that never ran.

Close in one line with what happens next: this is a list, not a change. The
user picks what to delete and deletes it, or parks it (`/cad-capture`).
</step>

</process>

<guardrails>
- Applies NOTHING. This pass edits, deletes, moves, stages and commits nothing -
  no source file, no planning file, no config key - so `git status --short` is
  byte-identical before and after a run. The delete-list is input to the user's
  decision exactly as references/triage-gate.md treats review findings, and this
  pass carries no fix arm at all: there is not even an apply-the-survivors step
  to decline.
- Never auto-fires: no wiring-table entry, no `review.triggers` key, no gate. It
  has no verdict, because a delete-list cannot PASS or FAIL anything.
- The return shape is the subsystem's, unchanged -
  `{findings:[{file,line,severity,claim,failure_scenario}]}`, with `severity`
  carrying the rank. A bespoke ranked-list shape would lose the cross-model
  interchangeability the schema exists for and the adjudication path that
  already parses these findings.
- Reviewer resolution is not re-derived here: ONE `cad-reviewer` dispatch at the
  session default, whatever the stakes level. This pass resolves no routing cell
  and reads no config key, so it has no tier, no effort and no reviewer set.
- Never runs on a target it could not resolve. Stopping is the correct outcome
  there; a list produced over the wrong bytes is indistinguishable from a real
  one.
</guardrails>

<success_criteria>
- [ ] The resolved target is NAMED in the output, or the run stopped because it
      did not resolve
- [ ] Exactly one `cad-reviewer` dispatch ran, bracketed in the run record, and
      its bracket is closed - `return`, or `checkpoint` when it came back
      unusable
- [ ] The list came back in the shared findings schema, ranked by `severity`,
      every entry's `file`, `line`, `claim` and `failure_scenario` presented as
      the reviewer returned them
- [ ] A zero-finding pass was reported as a result naming the target, and an
      unusable dispatch was reported as no list at all - never either as the
      other
- [ ] Nothing was edited, deleted or committed: `git status --short` is
      unchanged
</success_criteria>
