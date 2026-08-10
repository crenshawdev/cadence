# Cadence — improvement shortlist (2026-07-18)

Distilled from the GSD-core intersection comparison (`gsd-comparison-2026-07-18.md`).
Only the actionable items: what to sharpen on Cadence, and the three GSD ideas worth
adding. Each passes the "just because we can, should we?" test — single artifact, real
gap, no new surface to defend. Everything else GSD has stays cut.

---

## A. Improve the winner — 4 changes to Cadence

Ranked by value-per-effort. All are prose/template edits; none add a script, agent, or
config subsystem beyond one key.

### A1 — Verifier L4: the "hollow seam" / data-flow check  ·  *genuine capability gap*
- **Problem:** `cad-verifier` stops at *Wired* plus a behavioral spot-check. A seam that
  is wired but has no data flowing through it can pass — the exact "silent failures live
  in the seams" case Cadence exists to catch.
- **Change:** add a level-4 data-flow trace to `agents/cad-verifier.md` — follow a real
  value from entry to the observable effect, not just presence + connection. Behavior-
  hinged truths that can't be traced stay UNCERTAIN → human check (already the model).
- **Cost:** a few lines in the agent contract. No machinery.
- **Source:** GSD `gsd-verifier.md` L4 data-flow trace ("HOLLOW — wired but data disconnected").
- **Priority: highest. Smallest patch, closes the one real gap.**

### A2 — Honest-verifier: abstain, don't guess  ·  *cheap hardening*
- **Problem:** a verifier that emits a confident PASS/FAIL on a check the spec can't
  actually decide is false confidence — the failure mode the verify gate exists to prevent.
- **Change:** one paragraph in `agents/cad-verifier.md` / `skills/cad-verify`: return
  UNCERTAIN on any check whose answer isn't derivable from the spec alone, rather than a
  guessed verdict.
- **Cost:** one paragraph. (Pairs with B3 below — same reference.)
- **Source:** GSD `gsd-core/references/honest-verifier.md`.

### A3 — Per-reviewer prompt-token cap  ·  *small safety*
- **Problem:** Cadence sends artifacts to a paid provider (`review-provider.mjs`) with no
  size ceiling — a large diff/plan is an uncapped bill and a context risk.
- **Change:** add one key under `review.*` (e.g. `review.max_prompt_tokens_per_reviewer`),
  enforced in `review-provider.mjs` before dispatch; over-cap → truncate-with-notice or
  fall back to the Claude subagent.
- **Cost:** one config key + a guard.
- **Source:** GSD `review.max_prompt_tokens_per_reviewer.<slug>`.

### A4 — Per-task `<automated>` wording in the planner template  ·  *mild tightening*
- **Problem:** tasks name a Verify step but don't insist it be an automated check by default.
- **Change:** template wording in the planner (`agents/cad-planner.md` / PLAN template) to
  name an automated check per task by default; keep the existing human-verify escape hatch.
- **Cost:** template wording, not a schema.
- **Source:** GSD planner's `<automated>` sub-field (the "Nyquist" discipline), minus the
  frontmatter schema.

---

## B. Add from GSD — 3 ports

The only GSD surface that clears the bar. Two are things Cadence *almost already has*.

### B1 — Post-planning gap report  ·  *PORT*
- **What:** a read-only Source | Item | Status table that cross-references every REQ-ID /
  D-ID against the just-written PLAN bodies the moment `/cad-plan` finishes — catching a
  silently-dropped requirement at the cheapest possible moment (plan time), not pre-ship.
- **Why it fits:** `cad-audit` only catches drops pre-ship. Non-blocking, zero machinery,
  pure "gates are real gates."
- **Head start:** Cadence already ships a `cadence-core/workflows/plan-gaps.md` stub —
  this is the content for it.
- **Source:** GSD `capabilities/gap-analysis`.

### B2 — Common-bug-patterns checklist for `/cad-debug`  ·  *PORT*
- **What:** a frequency-ordered checklist (null access, off-by-one, async races, boundary
  conditions…) scanned *before* forming the first hypothesis in `cad-debug`.
- **Why it fits:** shortcuts the most common bugs before spending a hypothesis cycle — or a
  paid second-model consult. One reference file, no code.
- **Source:** GSD `gsd-core/references/common-bug-patterns.md`.

### B3 — Honest-verifier reference  ·  *PORT (= A2)*
- **What:** the drop-in reference behind A2 — verifier abstains on non-inferable checks in
  portable `spec → predicate → verifier` terms.
- **Why it fits:** hardens the verify gate against false confidence; one reference, drop-in.
- **Source:** GSD `gsd-core/references/honest-verifier.md`.

---

## Explicitly NOT doing (would re-import the elephant)

Wave-default execution + worktree-guard fleet · state lockfile + field-classification enum ·
`plan-review-convergence` · mandatory STRIDE tables · review depth-mode matrix ·
dated-model-id preset tables · the 18-runtime catalog · AI-integration track · UI auditors ·
mempalace / graphify / intel / pattern-mapper · behavioral profiling · external-job (HPC) ·
autonomous-smart-discuss · decimal phase math · thinking-partner.

The **MAYBE** pile (revisit only on a triggering need, not now): `edge-probe` taxonomy +
`research-philosophy` reference (cheap disciplines) · `assumption-delta` drift checkpoint ·
`schema-gate` pattern (only if a project runs a live-DB stack) · `claude-orchestration`
(the real engine behind Cadence's dormant `parallelization.*` path — heaviest lift, only if
the sequential default ever becomes the bottleneck).
