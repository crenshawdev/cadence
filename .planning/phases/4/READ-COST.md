# Phase 4: the read cost the split bought

Measured, not asserted, by `wc -c` - the same method `LOD-02` was measured
with. Every figure below is reproducible by re-running the command beside it.

The saving applies to a dispatch that READS the source to EDIT it - an
executor or a reviewer opening `planning.mjs` to touch one command. It does
NOT apply to every dispatch and it does NOT apply to agent startup: an agent
that only ever RUNS `planning.mjs` (`node "${CLAUDE_PLUGIN_ROOT}/.../planning.mjs" <command>`)
invokes it as a subprocess, which costs no context at all, split or not. The
honest headline is narrower than "every dispatch is cheaper now": it is that
every command is reachable inside one 50,000-token read cap where before the
whole file was 2.1x over it, and a command that could be read at all before
the split could only be read with several windowed reads or a truncated one.

## BEFORE the split

The commit this phase branched from:

```
$ git show 22eca08a:cadence-core/bin/planning.mjs | wc -c
417009
```

417,009 bytes, ~104,252 tokens (chars/4). Reaching any single handler in that
file meant reading the whole file - there was no smaller unit to read - against
a 50,000-token read cap, so the file was 2.1x over the cap before a single
command's code was reached.

## AFTER the split

Reaching one handler today means reading three files: the entry file
(`planning.mjs`, the `COMMANDS` dispatch table), `planning/core.mjs` (the
envelope helpers and multi-use readers every handler calls), and the one
module that holds the handler - never the module alone, which would be the
self-claim the measurement exists to avoid, since a handler cannot be read
without the envelope and helpers it calls.

```
$ wc -c cadence-core/bin/planning.mjs cadence-core/bin/planning/core.mjs
  23616 cadence-core/bin/planning.mjs
  38515 cadence-core/bin/planning/core.mjs
  62131 total
```

Two handlers are recorded, not one (D-13): measuring only the smallest
handler (`cmdCursorGet`, `planning/cursor-get.mjs`, 1,337 bytes) would report
a cut no real dispatch experiences.

### The MEDIAN command module

```
$ wc -c cadence-core/bin/planning/*.mjs | grep -v core.mjs | grep -v ' total$' | sort -n
  1337 cadence-core/bin/planning/cursor-get.mjs
  2825 cadence-core/bin/planning/capture-sections.mjs
  3627 cadence-core/bin/planning/reads.mjs
  4060 cadence-core/bin/planning/deferred-list.mjs
  4881 cadence-core/bin/planning/plan-overlap.mjs
  5346 cadence-core/bin/planning/seed-reqs.mjs
  5534 cadence-core/bin/planning/plan-size.mjs
  5882 cadence-core/bin/planning/deferred-record.mjs
  5901 cadence-core/bin/planning/capture.mjs
  6917 cadence-core/bin/planning/debt-harvest.mjs
  6969 cadence-core/bin/planning/criteria-size.mjs
  7571 cadence-core/bin/planning/deferred-carry.mjs
  8035 cadence-core/bin/planning/cursor-set.mjs
  8495 cadence-core/bin/planning/recall.mjs
  9854 cadence-core/bin/planning/phase-done.mjs      <- median (15th of 29)
 11029 cadence-core/bin/planning/detect-surfaces.mjs
 11257 cadence-core/bin/planning/detect-commands.mjs
 11586 cadence-core/bin/planning/adjudication.mjs
 12450 cadence-core/bin/planning/cite-count.mjs
 12737 cadence-core/bin/planning/status.mjs
 13027 cadence-core/bin/planning/task-record.mjs
 15642 cadence-core/bin/planning/audit.mjs
 15811 cadence-core/bin/planning/criteria-coverage.mjs
 16228 cadence-core/bin/planning/lease-check.mjs
 18423 cadence-core/bin/planning/milestone-prune.mjs
 25327 cadence-core/bin/planning/renumber.mjs
 28972 cadence-core/bin/planning/uat.mjs
 44859 cadence-core/bin/planning/risk-check.mjs
 55342 cadence-core/bin/planning/trace.mjs
```

29 command modules (`core.mjs` excluded - it is the shared envelope, not a
command). Sorted, the middle (15th of 29) entry is `planning/phase-done.mjs`
at 9,854 bytes - `phase-done`, holding `cmdPhaseDone`.

**Median total**: entry (23,616) + core (38,515) + `phase-done.mjs` (9,854) =
**71,985 bytes, ~17,996 tokens**. Ratio against BEFORE: 417,009 / 71,985 =
**5.79x smaller**.

### The WORST-CASE command module

The largest of the 29 by `wc -c`, from the same sorted listing above:
`planning/trace.mjs` at 55,342 bytes - the `trace` family (D-07 co-locates
`cmdTrace` and `cmdTraceIgnore`, the two handler-to-handler call edges in the
old file, in one module rather than splitting them).

**Worst-case total**: entry (23,616) + core (38,515) + `trace.mjs` (55,342) =
**117,473 bytes, ~29,368 tokens**. Ratio against BEFORE: 417,009 / 117,473 =
**3.55x smaller**.

Both totals land under the 50,000-token read cap; BEFORE did not (417,009
bytes, ~104,252 tokens, 2.1x over it).

## The test surface, same method

`planning.test.mjs` was 418,298 bytes at `22eca08a`:

```
$ git show 22eca08a:cadence-core/bin/planning.test.mjs | wc -c
418298
```

and the file that now holds a given command's tests is what a verifier reads
instead of that whole file. For the median command found above,
`planning-phase-done.test.mjs` is 13,317 bytes:

```
$ wc -c cadence-core/bin/planning-phase-done.test.mjs
13317 cadence-core/bin/planning-phase-done.test.mjs
```

## Prose for the phase SUMMARY

> Before the split, reaching any one of `planning.mjs`'s 32 handlers meant
> reading the whole 417,009-byte (~104,252-token) file - 2.1x over the
> 50,000-token read cap - because there was no smaller unit to read. After
> the split, reaching a handler means reading the entry file, the shared
> core, and the one module that holds it: 71,985 bytes (~17,996 tokens) for
> the median handler (`phase-done`), 117,473 bytes (~29,368 tokens) for the
> worst case (`trace`), both now inside the cap where the whole file was
> not. This is the saving for a dispatch that reads the source to edit it -
> not for every dispatch, and not for agent startup, since an agent that
> only runs `planning.mjs` invokes it as a subprocess and pays no context
> for it at all, split or not. `planning.test.mjs` (418,298 bytes at the
> pre-split commit) split the same way: a verifier now reads the one file
> holding a command's tests - 13,317 bytes for `phase-done`'s - instead of
> the whole test file.
