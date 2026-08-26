# Spike: agent-prefix-cache-fragmentation

**Status:** complete. Verdict: validated, with one latent defect.

## The question

Does Cadence's dispatch path fragment the subagent prompt cache, and is any of
the fragmentation avoidable by a change to this repository?

A subagent dispatch's cacheable prefix is the host system prompt, the tool
definitions, and the agent definition file (plus whatever that file pulls in).
The dispatch prompt sits beyond it. So the prefix is shared across two
dispatches of the same rung iff every one of those inputs is byte-identical
between them.

## The decision that hinges on it

Whether to change the rung/contract file layout in `agents/` and
`skills/cad-*-contract/`, and whether the `model.effort.*` pins in
`.planning/config.json` should be treated as a cache lever rather than only a
quality lever. If every criterion below holds, the answer is "change nothing"
and the cost question is closed rather than carried.

## Criteria, risk-first

Ordered so the assumption whose failure would most change the answer is tested
first. C1 failing means the prefix is non-deterministic and every later
criterion is moot, because no amount of file consolidation caches a prefix that
differs on every run.

### C1 - the cached prefix is deterministic across runs

Given the 19 `agents/*.md` rung files and the 6 `skills/cad-*-contract/SKILL.md`
contracts, When each is hashed and each is scanned for a construct whose
expansion varies per run (an `@`-include of a `.planning/` file, a shell
substitution, a date, an absolute path, a cwd-relative reference resolved at
load), Then zero files carry such a construct and the hash of a file is a
function of the file alone -> validated; any file whose effective content
depends on run state -> invalidated, and that file is the finding.

### C2 - rungs of one role preload the same contract

Given each role's rung files, When the set of contract skills each rung declares
or references is compared across the rungs of that role, Then every rung of a
role names the same contract set -> validated; any role whose rungs pull
different contracts -> invalidated (each such rung is a separate prefix for a
reason unrelated to effort).

### C3 - rungs of one role declare identical tools

Given each role's rung files, When the `tools:` frontmatter of every rung is
compared against the other rungs of that role, Then the tool set is identical
within a role -> validated; any intra-role difference -> invalidated, because
tool definitions sit in the prefix ahead of the agent body.

### C4 - a role's body diverges only where effort requires

Given each role's rung files with frontmatter stripped, When each rung's body is
diffed against the role's base rung, Then bodies are byte-identical within a
role -> validated (the rungs are a frontmatter-only split, the minimum possible
fragmentation); any body difference -> the divergence is measured and reported,
which bounds how much of each prefix is unshareable.

### C5 - this project exercises one rung per role per cycle

Given `.planning/trace.jsonl`, When the distinct agent rungs actually dispatched
per role are counted over the most recent completed milestone, Then each role
shows exactly one rung -> validated (pins are holding, no alternation cost);
a role showing two or more rungs -> invalidated, and the alternation is the
finding, since neither rung stays warm.

## Observations

### C1 - VALIDATED

No `@`-include, shell substitution, date, absolute path, or cwd-relative
load-time reference in any of the 19 agent files or 6 contract skills. The
initial pattern hit 19 lines, all of them backtick literals in static prose
(`` `xhigh` ``, `` `bin/route.mjs` ``) - false positives of the search, not
run-varying content. Concatenated hash is stable across two passes:
`ee05ec19d28862867d4399d55668262a5032b7f2e5ddd22d47c1c65a97540525`.

The prefix is a function of the files alone. Caching within a rung works.

### C2 - VALIDATED

Every one of the 19 rungs references exactly one contract, and it is its own
role's. No rung pulls a contract belonging to another role, and no role's rungs
disagree about which contract they load.

### C3 - VALIDATED

`tools:` is byte-identical within every role. (Across roles it varies as the
roles' jobs vary, and `cad-assumptions-analyzer` orders `Grep, Glob` where
`cad-reviewer` orders `Glob, Grep` - irrelevant, since two roles never share a
prefix anyway.)

### C4 - DIVERGENCE FOUND AND MEASURED

Every non-base rung differs from its role's base rung by exactly one changed
line, in all six roles. The line is the rung label:

```
< Your rung is `high`.
---
> Your rung is `xhigh`.
```

Its POSITION is the finding, not its existence. It sits at line 2 of a 177-byte
agent body, and the contract it precedes is 11,235 bytes
(`skills/cad-planner-contract/SKILL.md`). So the divergence falls roughly 100
bytes into the assembled prefix, and the ~11 KB of identical contract below it
is, byte-for-byte, a different prefix in every rung of the same role.

Cross-rung prefix sharing is therefore impossible in principle under this
layout. Whether the host would otherwise have shared it is not observable from
here - two rungs are two different agent definitions, and the harness may not
attempt cross-agent prefix reuse regardless of byte layout. The defect is that
the layout forecloses it either way, for one line that carries no behavior the
frontmatter's `effort:` does not already carry.

### C5 - VALIDATED for the current configuration

Over the full record (1,858 events) every role shows two or three distinct
rungs, which reads as live alternation. It is not. Narrowed to the last 400
events, every role shows exactly one:

| role | rungs, last 400 events |
| --- | --- |
| `cad-assumptions-analyzer` | `cad-assumptions-analyzer-high` |
| `cad-executor` | `cad-executor` |
| `cad-planner` | `cad-planner-xhigh` |
| `cad-reviewer` | `cad-reviewer` |
| `cad-verifier` | `cad-verifier` |

The full-record spread is historical - config changed across milestones - and a
whole-file count cannot tell that from alternation happening now. The
`model.effort.*` pins in `.planning/config.json` plus
`model.escalate_on_failure: false` are what hold it to one rung per role today.

## Verdict

**Validated.** The dispatch path does not meaningfully fragment the prompt cache
under the current configuration. C1-C3 hold outright, and C5 holds today, which
is what makes C4 cost nothing right now: a divergence between rungs is only paid
when more than one rung of a role actually runs, and none does.

The C4 defect is real but LATENT. It becomes live the moment a role alternates
rungs, and two configuration changes would do that:

- setting `model.escalate_on_failure: true`, which makes a failed dispatch retry
  on a different rung file - a fully cold ~11 KB prefix on top of an
  already-failed dispatch, which is the worst moment to pay for one, and
- changing any `model.effort.<role>` pin mid-cycle, which strands whatever the
  previous rung had warmed.

## Recommendation

Ordered. 1 gates 2, and the ordering is the recommendation, not a preference
about it.

1. **Record cache figures in the trace FIRST** (issue #242). The bracket
   captures `tokens` and `turns` only; `cache_read_input_tokens` and
   `cache_creation_input_tokens` are what a hit rate is computed from, and
   Cadence stores neither. Every claim in this spike is structural - the byte
   layout forecloses sharing - and none of it is a measured hit rate, because
   the record cannot produce one.
2. **Then move the rung label below the contract reference, or delete it**
   (issue #241, marked blocked by #242). One line, six roles, no behavior
   change - the frontmatter's `effort:` already carries the rung, and nothing in
   the contracts branches on the prose line. This makes the ~11 KB contract a
   shared prefix across a role's rungs instead of a per-rung copy. It is cheap
   enough to be tempting to do first; doing it first reproduces the defect #242
   describes, since there would be no before/after to show it recovered
   anything.
3. **Keep `model.escalate_on_failure: false`** (pinned in `.planning/config.json`
   during this session, previously only inherited from the shipped template
   default - which the v2.6.0 docs-verify runs record as having been `true`).
4. **Do not consolidate the rung files.** The split is already minimal: one
   changed line per rung, identical tools, identical contract. There is nothing
   to merge.

Neither 1 nor 2 is scoped into `v3.6.1`, whose roadmap states the cycle closes
the three named `/cad-why` gaps and nothing else. Both are captured as a seed in
`.planning/CAPTURE.md` for the next milestone.

## Throwaway code

None. Every criterion was answered by read-only inspection of files already in
the repository plus `.planning/trace.jsonl`; nothing was built and nothing needs
discarding.

## Post-ship: what the shared rung prefix recovered (2026-08-26)

Recommendation 2 shipped in `v3.7.4` phase 2 at commit `8ca0dfdc`: the rung
label moved out of the agent body, so a role's rungs now share the ~11 KB
contract below it instead of each carrying a private copy. Recommendation 1 -
"record cache figures in the trace FIRST" - is phase 3 of the same cycle, and
this section is the before/after that ordering exists to make possible. RNG-03
closes here, on a number, whichever way the number falls.

### The role, and why this one

`cad-verifier`. Three reasons, carried from `.planning/phases/2/CONTEXT.md`
D-06:

- It runs in the MAIN tree, so its `SubagentStop` write lands in this
  repository's `.planning/trace.jsonl` rather than in a worktree's, which is
  discarded with the worktree.
- It has four rungs, so it is a role the C4 defect could actually cost
  something.
- Its contract is not the one phase 2 rewrote, so neither side of the comparison
  is contaminated by that edit.

D-06 marked the choice RE-DECIDE for one reason: `cad-verifier` held one of the
11 stale `unpaired` rows that made the `SubagentStop` hook's two-open-dispatch
gate refuse unconditionally. Phase 3 scopes that gate's candidate set to the
current run, which removes the objection.

### The two sides, and what each of them proves

They are the SAME ARITHMETIC over the same kind of file, and they are not the
same instrument. Both are recorded here as part of the method.

- **Before** - `cacheOf` (`cadence-core/bin/lib/subagent-transcript.mjs`) summed
  over `cad-verifier`'s own subagent transcripts under the host's project
  directory for this repository, restricted to transcripts that predate
  `8ca0dfdc`.
- **After** - `cache_read_input_tokens` and `cache_creation_input_tokens` on
  that role's BRACKETS in `.planning/trace.jsonl`, once phase 3 is live and the
  role has been dispatched again. Those bracket figures are `cacheOf` over the
  stopped worker's OWN transcript, so the two sides are the same sum over the
  same kind of file.

That equality is NEW as of phase 3 plan 3, and stating it needs the correction
that made it true. Until commit `68cfeddc` the `SubagentStop` hook read the
payload's `transcript_path`, which names the ORCHESTRATOR's session rather than
the worker that stopped, so the figures it wrote were a different actor's
traffic. Both of the two cache-bearing brackets on the record were written that
way, and both are wrong by more than a factor of four: the `cad-verifier`
bracket at `3-a0fd304f` carries 52,918 / 528,568 where that worker's own
transcript sums 100,439 / 2,115,871, and the `cad-planner` bracket beside it
carries 50,428 / 527,186 against 240,156 / 10,405,827. Neither is an after
figure and neither is comparable to the before side.

What the after side ADDITIONALLY proves is that the RECORD carried the number.
That is the only thing this phase exists to fix, and it is the whole reason
reading both sides from transcripts was rejected: that comparison would pass
even if every withholding gate still threw the figures away, and the record, not
the transcript, is what every downstream cost claim reads. Post-`8ca0dfdc`
`cad-verifier` transcripts are already on disk and could supply the number
today; they are deliberately not the after figure.

A before-side BRACKET cannot be produced at all. Measured on the live record
2026-08-26 at this plan's tip: 409 brackets, 2 carrying either cache key - the
two mis-sourced ones named above - and 64 of the 409 are `cad-verifier`'s. There
is nothing correct to read back.

The two sides also cannot hold the same number of dispatches, so the comparable
quantity is a total over a DISPATCH COUNT, not a total. Both figures below are
reported per dispatch for that reason.

### The command behind each side

Before, from the repository root. The role of a transcript is not in the
transcript: it is in the read recorder's own rows, which carry `agent` and
`agent_id` together, and `agent_id` is the transcript's file stem.

```
node --input-type=module -e '
import { readFileSync, globSync } from "node:fs";
import { cacheOf } from "./cadence-core/bin/lib/subagent-transcript.mjs";
const SHIP = Date.parse("2026-08-26T13:42:33-04:00");   // 8ca0dfdc
const ids = new Set();
for (const l of readFileSync(".planning/reads.jsonl", "utf8").split("\n")) {
  if (!l.trim()) continue;
  const o = JSON.parse(l);
  if (o.agent_id && /^cadence:cad-verifier(-|$)/.test(o.agent)) ids.add(o.agent_id);
}
let n = 0, read = 0, creation = 0;
for (const f of globSync("/claude/.claude/projects/-code-cadence/*/subagents/*.jsonl")) {
  const id = (f.match(/agent-([^/]+)\.jsonl$/) || [])[1];
  if (!ids.has(id)) continue;
  const text = readFileSync(f, "utf8");
  const first = text.split("\n").map((x) => { try { return JSON.parse(x).timestamp; } catch { return null; } })
    .find((x) => typeof x === "string");
  if (!(Date.parse(first) < SHIP)) continue;
  const c = cacheOf(text);
  n++; read += c.cache_read_input_tokens || 0; creation += c.cache_creation_input_tokens || 0;
}
console.log(n, read, creation, Math.round(read / n), Math.round(creation / n));
'
```

After, once the phase is live and `cad-verifier` has been dispatched at least
twice:

```
node cadence-core/bin/planning.mjs trace render --dir .planning \
  | python3 -c 'import sys,json
b=[x for x in json.load(sys.stdin)["brackets"] if x.get("role")=="cad-verifier" and "cache_read_input_tokens" in x]
r=sum(x["cache_read_input_tokens"] for x in b); c=sum(x.get("cache_creation_input_tokens",0) for x in b)
print(len(b), r, c, round(r/len(b)), round(c/len(b)))'
```

There is deliberately NO script for either side under `cadence-core/bin/`. A new
bin surface drags a CONTRACTS row into the flag census, and this is a recipe
rather than a shipped tool.

### Before, measured 2026-08-26

UNCHANGED and deliberately NOT re-measured by phase 3. The before side reads
transcripts directly and never went through the hook, so nothing phase 3
corrected touches it.

54 distinct `cad-verifier` agent ids appear in the read recorder's rows. 34 of
their transcripts are still on disk - transcripts do not outlive the record, so
20 have been pruned by the host - and 33 of the 34 predate `8ca0dfdc`.

| | total | per dispatch (n=33) |
| --- | --- | --- |
| `cache_read_input_tokens` | 53,976,294 | 1,635,645 |
| `cache_creation_input_tokens` | 2,765,064 | 83,790 |

### After

PENDING the first post-phase-3 `cad-verifier` dispatches. The instrument this
needs is a live host firing `SubagentStop` after the change, which no fixture
can produce - which is why AC5 and AC6 are both human-verify. Run the after
command above once the role has been dispatched at least twice and record the
two figures, the dispatch count behind them and the delta against the before
side here.

WHICH STOPS THOSE BRACKETS WILL COME FROM. Not hook-written closes. On the
installed host version nearly every worker transcript ends on a `null`
`stop_reason`: re-measured 2026-08-26, 33 of the 34 subagent transcripts written
that day answer NOT-TERMINAL, against 1,071 terminal across a 1,310-file corpus.
The hook's termination gate therefore refuses the close on the ordinary path and
writes a `worker_cache` fact instead, which the renderer folds onto the bracket
the orchestrator's own `trace close --agent-id` opened. That is the gate behaving
as designed on correct evidence, and it is the path the after figures ride.

### What a zero would mean

Record the figure even when it is zero, and read it as an answer rather than a
failure. The host may key its prompt cache per agent DEFINITION, in which case a
byte-identical contract body sitting under two different rung files is still two
different cache entries, phase 2 recovered nothing, and RNG-03 closes on a
measured negative. That is a real result: it retires the C4 defect as
unrecoverable rather than latent, and it removes the reason to treat
`model.effort.*` as a cache lever at all. A positive delta closes RNG-03 the
other way and prices the two configuration changes the Verdict names.
