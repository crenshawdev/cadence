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
