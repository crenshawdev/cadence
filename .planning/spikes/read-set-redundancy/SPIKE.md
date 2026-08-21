---
slug: read-set-redundancy
requirement: RDX-01
issue: 167
opened: 2026-08-21
status: validated
---

# Spike: is read-set redundancy still worth a lever?

## The question

Is in-dispatch file re-reading on the CURRENT corpus repetitive enough to be
worth acting on, or was the 7.0x figure a property of the old declared
read-sets that current contracts already fixed?

## The decision that hinges on it

- **validated** -> `RDX-01` becomes a phase: wire the figure into `trace suggest`
  so `/cad-suggest` can propose a retune with a config key behind it.
- **invalidated** -> `RDX-01` closes with a note, #167 closes with that note, and
  the id moves to Deferred carrying it. No lever is built for a problem the
  contracts already solved. ROADMAP.md's Overview commits to exactly this exit:
  a spike that comes back invalidated "closes its issue with a note and its id
  moves to Deferred carrying that note - it does not quietly vanish."

## What the 7.0x figure actually was

`lib/read-trace.mjs:305-317` states it in the source, and the distinction is the
whole spike. There are TWO redundancy figures and only one of them answers this:

- `redundancy` = calls / distinct TARGETS. For Bash a "target" is the PROGRAM,
  so on a Bash-heavy corpus it reports how often a shell verb was typed. The
  source records it measured 12.96 on 2026-08-14 over 25 "targets" that were 14
  shell verbs and a couple of files. **This figure cannot answer the question**
  and a spike that reads it would validate on noise.
- `fileRedundancy` = path-touches / distinct FILES, from the `files` array. The
  source names this the one to read: "whether in-dispatch reading repeats the
  way `trace.jsonl`'s declared read-sets did at 7.0x".

So 7.0x came from `trace.jsonl`'s DECLARED read-sets, not from observed reads.
The spike measures the observed figure against it.

#167's own instruction is per-ROLE: "Record `redundancy` per role across a few
real phases before changing anything... If the recorded per-role redundancy
turns out to be near 1.0 on current contracts, the 7.0x figure is historical and
this closes with a note rather than a change."

## Criteria (written before the experiment, risk-ordered)

### C1 - precondition: the file half covers enough of the corpus to be read

Given `.planning/reads.jsonl` restricted to records carrying a `files` array,
When `fileCalls / calls` is computed over that window,
Then coverage >= 0.5 -> the figure is readable, continue to C2;
coverage < 0.2 -> **inconclusive** on data (not invalidated): the recorder was
not capturing files over this corpus and nothing here can decide the question.

This runs first because it is the cheapest, and because a low-coverage corpus
would make C2's number unreadable rather than false.

### C2 - the kill shot: per-role file redundancy on current contracts

Given the covered window scoped per dispatch role (`agent`, joined to the
dispatch bracket where one exists),
When `fileTouches / distinctFiles` is computed PER ROLE across phases 1-3,
Then at least one role that does substantial reading (>= 50 file-touches) shows
`fileRedundancy >= 2.0` -> **validated**: real repetition survives current
contracts and a lever has something to act on;
every such role lands below 1.5 -> **invalidated**: near 1.0 is #167's own
stated close condition, the 7.0x figure is historical, and no lever is built.

The band between 1.5 and 2.0 is deliberately left undecided here rather than
pre-assigned to a verdict - if the measurement lands there, the honest answer is
inconclusive with the figure stated, and step 5 says what would decide it.

### C3 - only if C2 validates: a concrete cut exists

Given the same window,
When the most re-read files within a SINGLE dispatch bracket are ranked,
Then some file is re-read >= 3 times inside one bracket -> the lever has a named
target and the phase can state what its suggestion would say;
no file exceeds 2 within any single bracket -> the redundancy is spread across
dispatches rather than inside them, which no per-dispatch lever can cut - report
that as a narrowed scope for the phase, not as a second kill.

## Observed results

### C1 - coverage: PASSES

19,328 records on disk, 11,742 carrying a `files` array. All-time coverage
0.608; scoped to the window from the first file-carrying record
(2026-08-14T13:55Z, 18,983 records) it is 0.619. Above the 0.5 bar, so C2's
figure is readable rather than an artifact of a partly-instrumented corpus.

### The first pass was wrong, and how

The first measurement grouped reads per role across the WHOLE corpus and per
agent-DAY, and returned `cad-executor` 21.46, `coordinator` 19.26. Those numbers
are not in-dispatch redundancy and must not be quoted as such: they cannot
distinguish "re-read 20 times inside one dispatch" from "read once in each of 20
dispatches", which is the only distinction that decides whether a per-dispatch
lever can cut anything. This is the same category error the source warns about
for `redundancy`-over-targets, arrived at from the other direction.

The corrected pass joins every read to a real dispatch bracket via `joinReads`
and sums `distinct` PER dispatch, so the ratio is in-dispatch by construction.
Join: 10,114 joined, 7,440 coordinator, 1,434 floor, 256 ambiguous, 87 unjoined,
0 unresolved. 6,423 joined reads carried files, across 180 dispatch brackets.

### C2 - in-dispatch per-role redundancy: VALIDATED

| role | dispatches | touches | distinct | in-dispatch redundancy | max single-file repeat |
|---|---|---|---|---|---|
| `cad-executor` | 78 | 4985 | 1371 | **3.64** | 29 |
| `cad-verifier` | 31 | 983 | 480 | **2.05** | 16 |
| `cad-planner` | 35 | 1659 | 884 | 1.88 | 17 |
| `cad-assumptions-analyzer` | 32 | 1473 | 829 | 1.78 | 16 |
| `cad-reviewer` | 4 | 82 | 47 | 1.74 | 6 |

C2's validated arm needed one substantial role at >= 2.0: `cad-executor` clears
it at 3.64 over 4,985 touches, and `cad-verifier` clears it at 2.05. The
invalidated arm needed EVERY substantial role below 1.5; nothing is below 1.74.
Nothing is near 1.0, so #167's stated close condition is not met.

### C3 - a concrete cut exists: MET

1,073 of 3,611 file/dispatch pairs are re-read >= 3 times INSIDE one dispatch.
The worst single case is `cadence-core/bin/planning.mjs` read 29 times within one
`cad-executor` bracket, and it dominates the top of the list -
`trace.test.mjs` at 27, `review-provider.test.mjs` at 27, `README.md` at 22,
`.planning/DOCS-CLAIMS.md` at 19.

## Verdict

**validated** - but at 3.64, not 7.0x, and only for two of five roles.

Read-set redundancy survives current contracts at a level worth acting on. The
7.0x figure over declared read-sets is indeed historical; the observed
in-dispatch figure for the heaviest role is about half it. It is not near 1.0,
which was the specific condition #167 named for closing this with a note.

## Recommendation for the plan

Plan `RDX-01`, scoped NARROWER than the original requirement wording:

1. **Target `cad-executor` first.** At 3.64 over 78 dispatches it is the whole
   signal. `cad-planner` (1.88), `cad-assumptions-analyzer` (1.78) and
   `cad-reviewer` (1.74) sit in a band where a suggestion would be noise, and a
   lever that fires on them would spend the user's attention to save nothing.
   A per-role threshold, not one global ratio.
2. **The suggestion has a named target already**: a single file re-read 29 times
   inside one dispatch. The cheapest honest suggestion is per-file, not per-role
   - "this dispatch read `planning.mjs` 29 times" is actionable where "your
   redundancy is 3.64" is not.
3. **Scope limit to state in the phase, not discover in it**: `coordinator`
   holds 7,440 of the joined reads and has NO dispatch bracket by construction,
   so the main thread's re-reading is outside anything this lever can measure or
   cut. The phase should say so rather than implying whole-session coverage.
4. **The `null` arms already work** and C1 is why they matter - a corpus at 0.62
   coverage is normal, not broken, so the suggestion must state its coverage
   alongside its figure or it will read as a total.

## Throwaway code

`.planning/spikes/read-set-redundancy/measure.mjs` (first pass, superseded - kept
only because the verdict cites how it was wrong) and `measure2.mjs` (the
bracket-joined pass the verdict rests on). Not project source; delete when
`RDX-01` ships.
