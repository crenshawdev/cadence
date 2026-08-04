# Roadmap

## Overview

`v2.3.0 — where the bytes live`. Cadence measured its own cost and found it is
not thinking too hard, it is carrying too much: 108.5k resident context per
assistant turn against 565 output tokens, cache reads alone 62.7% of spend. The
ordering below is by WHERE the bytes live, not how many there are — a 30KB file
read once near the end of a run is cheaper than 3KB that lands in turn one. So
phase 1 takes the most expensive class, bytes a child returned that the
orchestrator then carries for every remaining turn; phase 2 takes bytes that
land in turn one regardless of which branch a command takes; phase 3 takes the
bytes that ride every session in every project, and closes by putting the
unbudgeted surfaces under the ratchet that already watches the rest — last,
because budgeting them first would mean regenerating the manifest on every
preceding commit.

Shipped lineage: `v1.0.0` baseline, `v1.1.0` file-based memory and BM25
recall, `v1.2.0` cross-model review seam and durable-decision recall, `v1.2.1`
sweep-highs patch, `v1.3.0` liteSpeed flow pass, `v1.3.1` tech-debt cycle,
`v1.4.0` four stated grammars, `v1.4.1` two self-contradicting contracts,
`v1.5.0` the self-description corrections that staged the stakes cycle,
`v2.0.0` the stakes axis itself - the rung ladder, the bundle cell, the
computed risk floor, acceptance-criteria ids, and the last resolved-then-
dropped config keys, `v2.1.0` the coverage and triage gates, and `v2.2.0` the
rest of the residue - the config read face, the parser subtraction, the honest
release seam, the true rung-ladder claims, and the install path proven live.
Git history and each release tag are their archive.

## Phases

- [ ] **Phase 1: The orchestrator stops holding what its children returned** - executor reports, verifier findings and review artifacts move to files or references; the seam states the break-even rule that justifies it
- [ ] **Phase 2: References load where they are used** - split `git.md`, extract the triage gate and restate it as a multi-select, resolve the `conventions.md` phantoms, and judge every remaining eager include per skill
- [ ] **Phase 3: The surfaces that are always on, and the ratchet that watches them** - trim the descriptions riding every session everywhere, then put `references/` and `templates/` under the weight budget

## Phase Details

### Phase 1: The orchestrator stops holding what its children returned
**Goal:** No subagent's full output is resident in a parent context after the turn it arrived on. The four sites are the same defect in the same seam, which is why they share a phase and a review surface.
**Depends on:** Nothing (first phase)
**Requirements:** RES-01, RES-02, RES-03, RES-04
**Success Criteria:**
1. `cad-executor`'s final message carries no task table — only status, task count, commit range, deviation count and open-item count — while `.planning/phases/<N>/reports/plan-<k>.md` exists for every plan and appears in the phase's docs commit (`git show <commit> --stat`), so a worktree executor's report is tracked rather than lost.
2. A `PLAN PARTIAL` return produces a continuation prompt built from the report FILE: re-running executes no task the file already lists complete.
3. `cad-verifier` writes exactly one file under `.planning/phases/<N>/`; `Write` is allowed on all four rungs while `Edit` and `MultiEdit` remain in `disallowedTools`; and `planning.mjs uat merge --phase <N> < <file>` merges it with no hand-transcription step left in `verify-deep.md`.
4. A missing, empty or unparseable findings file leaves `/cad-verify --deep` falling through to the walk with the checklist as-is, on the same path as any other failed dispatch — never a new error path, since the deep pass is an accelerator and never a gate.
5. No reviewer receives an inlined diff: `claude-subagent` gets refs valid in ITS working tree, cross-model gets `--payload <file>`, `assertUnderCap` bounds the file's contents against `review.max_prompt_tokens`, and a non-string artifact is refused as `bad-payload` before the cap is consulted.

### Phase 2: References load where they are used
**Goal:** A command stops paying, in turn one, for prose that only one of its branches reads. Judged per site against the break-even test, not blanket-converted.
**Depends on:** Phase 1
**Requirements:** LOD-01, LOD-02, LOD-03, LOD-04, LOD-05
**Success Criteria:**
1. `references/git.md` is gone, `git-guard.md` and `git-publish.md` exist, and `grep -rn "references/git.md"` over `cadence-core/workflows/`, `skills/` and `references/seams.md` returns nothing; every surviving "rail N" citation names the file that now holds that rail.
2. `/cad-phase`, `/cad-pause`, `/cad-undo` and `/cad-milestone` eager-load the guard file only; `/cad-land` reaches the publish rails at the step that acts on them.
3. The triage gate lives in its own reference, `execute.md`, `plan.md` and `verify.md` RE-READ that file instead of the 13KB one, `review-triggers.md` keeps a pointer, and the adjudicated arm specifies a structured multi-select over the surviving findings with NONE still the default.
4. No bare `conventions.md` parenthetical remains anywhere in `cadence-core/workflows/*.md`: each cited rule is either inlined at its use site or backed by an `@`-include.
5. The `/cad-config` catalog decision is recorded with the run-count measurement that drove it, and the catalog is either derived from `config.mjs keys` or deliberately left transcribed — not left ambiguous.

### Phase 3: The surfaces that are always on, and the ratchet that watches them
**Goal:** Cut the bytes that ride every session in every project, then close the structural hole that let unbudgeted references grow in the first place.
**Depends on:** Phase 2
**Requirements:** BUD-01, BUD-02
**Success Criteria:**
1. Every `cad-*` skill description is a single routing line that still contains its discoverability trigger words, and the 29-description total drops measurably below the 5,078-byte baseline captured at the start of this cycle.
2. Each routed rung-agent description is one clause naming its rung and that it is routed rather than user-selected, while the rung files themselves, their `effort:` frontmatter and the rung map are untouched.
3. `surface-weight.mjs` walks `cadence-core/references/*.md` and `cadence-core/templates/*`, and `weight-budgets.json` carries an entry for each, regenerated in the same commit as the edits that moved them.
4. `entries()` no longer returns `[]` for an entire subtree when one descendant is unreadable — with `skills/private/` at mode 000, a readable `skills/good/SKILL.md` still appears in `surfaces` — or the decision to leave it stands recorded with its reason.
5. `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both pass, and `node cadence-core/bin/weight.mjs` reports the closing measurement against the baseline captured before phase 1.
