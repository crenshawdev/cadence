# The consequence gate: the `blocking` arm

The `blocking` gate's own text, split out of `references/triage-gate.md`: its
bullet and the one-round cap on its re-arm. The receipt and record rules every
blocking settle writes under, and the narrowed round with its terminal
STOP-and-ask, stay in that file.

- **blocking** - PASS if no `blocker`/`high` finding survives, else FAIL. On
  FAIL, halt and surface the findings; resume only after they are fixed or the
  user explicitly overrides. A reviewer that could not run does not silently
  PASS - report that the gate could not be evaluated and ask. The re-arm on that
  fix is CAPPED - see below. Its below-blocker/high REMAINDER - the findings it
  reports and moves past - is settled in the same step, by "What happens to a
  finding this fire will not fix" in `references/triage-gate-unfixed.md`. That remainder is RECORDABLE: a
  `survived` finding raised below blocker/high is one that was confirmed and
  NOT fixed, so the record holds it as it happened instead of forcing a
  downgrade. How the entry is composed is `references/review-record.md`'s.

**The blocking re-arm is capped at ONE round.** A fix made to clear a blocking
FAIL is itself reviewable work, so the trigger re-arms on it; unbounded, that is
a loop with no terminal state. It is bounded in the vocabulary the spine's other
blocking loop already uses (`workflows/plan.md`'s ONE revision, maximum), in the two steps
`references/triage-gate.md` states under "The narrowed round and its terminal
STOP-and-ask".


The round count PERSISTS in the trace, so a `/clear` between rounds cannot
reset it. Before firing the narrowed round, read that count in ONE chained
step - the render is bulk output, so it rides this RUN's own scratch directory
and only the ANSWER reaches the transcript
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/conventions.md` states the
rule; the scratch file is the model's own, never a phase artifact):

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-rearm-XXXXXX")" \
  && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D holds a character a carried literal cannot survive" >&2; exit 1;; esac \
  && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <N> > "$D/render.json" \
  && node -e 'const f=require("fs");let r;try{r=JSON.parse(f.readFileSync(process.argv[1],"utf8"))}catch(e){console.error("scratch-unreadable: "+process.argv[1]+": "+e.message);process.exit(1)}if(!r||typeof r!=="object"){console.error("scratch-shape: "+process.argv[1]+" is not an object");process.exit(1)}if(!Array.isArray(r.outcomes)){console.error("scratch-shape: outcomes is not an array in "+process.argv[1]);process.exit(1)}if(!r.outcomes.every((o)=>o&&typeof o==="object")){console.error("scratch-shape: outcomes has a non-object entry in "+process.argv[1]);process.exit(1)}console.log(r.outcomes.filter((o)=>o.event==="rearm"&&o.trigger===process.argv[2]&&o.corr===r.corr&&(o.plan??"")===(process.argv[3]??"")).length)' "$D/render.json" "<trigger>" "<k>"
```

A carried literal is pasted into a later command unquoted-by-construction, so the guard REFUSES the directory at creation rather than trying to quote it defensively at every use site: `mktemp` builds the path from `$TMPDIR`, which the operator does not always own (a cloned repo's `.envrc`, a devcontainer, a CI runner), and one `"` in it closes the argument and runs the rest as commands. The character class is deliberately narrow - a `TMPDIR` holding a space is refused too, and fixing that is one `export` away, where a path that executes is not.

The directory is made for this run and the two calls are `&&`-chained to it,
which is what makes the count this run's OWN. A fixed shared scratch name is
one file that every concurrent run on the machine writes and reads, so a
render taken in another repository could spend or refund the one round this
gate has - and the chaining is what stops the read-back running on a render
that failed.

A NON-ZERO EXIT from that read-back is NEITHER answer. It names
`scratch-unreadable` when the render could not be read or parsed and
`scratch-shape` when `outcomes` is not an array, and in both cases the cap
could not be EVALUATED, which is not the zero arm and not the non-zero arm.
Treat it exactly as the `blocking` bullet above treats a reviewer that could
not run: STOP and ask the user. The shape this replaced defaulted a missing
array to `[]` and printed `0`, which reads as "the round is unspent" and
re-fires a blocking gate off a file it never managed to read.

The count is keyed on FOUR things - the event name, the trigger FIELD, this
run's `corr` and the PLAN `<k>` - which is the same key the append below
writes, so that one number is the whole answer: non-zero means a `rearm`
outcome for this trigger UNDER THIS PLAN is already recorded under that same id
and the one round is SPENT - do not fire again, go straight to the STOP-and-ask
arm in `references/triage-gate.md`. The match is on the event's `trigger` FIELD and never on its detail
text, for the reason the receipt paragraph in `references/triage-gate.md` states.

The plan key rides as the THIRD argument beside the trigger, so the block stays
the one line a coordinator copies and runs. Without that term a `rearm` written
for plan 1 reads as SPENT for plan 2 on the same trigger, and plan 2's fix can
never be reviewed at all. OMIT the argument on a fire that carries no plan
(`/cad-debug`, `/cad-verify`, `/cad-task`'s inline path - the discriminator
grammar in `references/review-triggers.md` names them): the append writes a
`plan` field only when `--plan` was passed, so those events carry none, and an
omitted key is what matches them.

Zero -> record the round as you fire it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event rearm --trigger <trigger> --plan <k> --base <base> --sha <head> --detail "<trigger>"
```

The `--sha` is what makes this round a receipt for the range it re-armed on as
well as the marker that spends the round; without it the narrowed round leaves
that range looking unfired.

A fresh `phase_start` (a genuine re-run) derives a new id and gets a fresh
round. The append is best-effort by the trace seam's own contract: when the
record cannot be written or read, the count falls back to what this context
remembers - the pre-persistence behavior, not a new failure mode.
