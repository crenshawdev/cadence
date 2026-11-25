<purpose>
An on-demand delete-hunting pass over code the user names. It asks whether that
code needs to exist at all, and returns a ranked delete-list. It uses the review
subsystem's own reviewer (references/review-triggers.md's `claude-subagent`
backend): the base `cad-reviewer`, dispatched with a minimalism instruction that
RETARGETS its subject off correctness.
</purpose>

<process>

<step name="resolve_target">
Parse `$ARGUMENTS` for the target - the code this pass is asked to question.
Three shapes, and the run NAMES the one it resolved:
- **a path** - one file.
- **a directory** - the files under it, which the reviewer globs for itself.
- **a phase number** - the committed range that phase's
  `.planning/phases/<N>/SUMMARY.md` records, as a `<base_ref>..<head_ref>` pair.
  An agile project (`.planning/agile/` exists and `.planning/PROJECT.md` doesn't)
  has no phases, so there a number does not resolve and the ask below leaves it out.

When `$ARGUMENTS` is empty or resolves to more than one of those at once, ask
ONCE (ask-user seam): "What should this pass try to delete? (a path, a
directory, or a phase number)". Take that answer and continue - never a second
round of questions.

When the named target does not resolve - a path or directory that is not there,
a phase with no SUMMARY.md, a range whose refs this tree does not carry - say
which one failed and STOP. Do not widen the target to its parent and do not
guess which file was meant.
</step>

<step name="dispatch">
Assemble `{ instruction, artifact }`:
- `artifact` = the target as a REFERENCE, never its bytes
  (references/dispatch-shape.md's handoff read discipline): the path for a file,
  the directory for a directory, the `<base_ref>..<head_ref>` pair for a phase
  range.
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

Bracket the worker in the joined run record first. `<N>` is the target phase
when the target IS a phase, and the STATE cursor's phase
(`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor get`)
for a path or directory target. On an agile project it is 0, with no cursor read.
The read-set is the target the USER named,
resolved, so write that reference to a scratch file and pass the path
(caller-derived text - references/conventions.md):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent --read-file <path>
```

Then dispatch the `agent_type` that
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" agent-type --stem cad-reviewer`
prints (on `{ok:false}`, the bare `cad-reviewer`) through the spawn-agent seam
with the payload above as its prompt. This is one dispatch that resolves no
routing at all: it runs at the session's model and at the effort its agent file
pins. There is no cross-model arm.

Parse the returned `{findings:[...]}` and close the bracket at once, under
seam-spawn-agent.md's bracket rule:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase <N> --plan cad-reviewer --role cad-reviewer --agent-id <the id on the subagent return> --reviewer claude-subagent --tokens <the token count on the subagent return> --turns <the tool-call count on the subagent return> --duration-ms <the wall clock on the subagent return>
```

When the dispatch failed or its return can't be parsed, write what failed to a
scratch file, add `--detail-file <path>` to that line (caller-derived text -
references/conventions.md), and report NO LIST, never an empty one.
</step>

<step name="present">
Present the delete-list ranked by `severity` - every `blocker`, then `high`,
then `medium`, then `low` - each entry carrying the reviewer's own `file`,
`line`, `claim` and `failure_scenario` as it returned them. On this pass
`failure_scenario` reads as what keeping the surface costs; it is the
reviewer's answer and not yours to rewrite.

Zero findings is a RESULT with its own line - "the pass read `<target>` and
found nothing to delete" - naming the target that was read. Never a bare "no
findings".

Close in one line with what happens next: this is a list, not a change. The
user picks what to delete and deletes it, or parks it (`/cad-capture`).
</step>

</process>

<guardrails>
- Applies NOTHING. This pass edits, deletes, moves, stages and commits nothing -
  no source file, no planning file, no config key - and leaves
  `git status --short` as it found it.
- Never auto-fires: it runs only when the user invokes `/cad-minimalism-review`
  on code they chose. It has no gate and no verdict.
</guardrails>
