# Cadence vs GSD-core — intersection comparison (2026-07-18)

A structured comparison of Cadence against the framework it descends from, GSD-core
(`open-gsd/gsd-core`), focused where the two intersect: the shared
`discuss → plan → execute → verify → ship` loop and its agents, gates, routing,
config, and state model. Read alongside `cadence-flows.md` (the process flows).

Method: three fresh-context readers each took one axis across both trees and
returned evidence-backed verdicts. Findings are consolidated here and filtered
through the standing design test — *just because we can, should we?*

## Verdict up front

At every shared concept, **Cadence is the better *implementation* of that concept** —
it keeps GSD's genuine inventions and sheds the accretion around them. GSD's breadth
is mostly multi-runtime tax and issue-driven scar tissue, not capability Cadence
lacks. The honest exceptions are small and named below.

---

## Where they intersect, and who does it better

| Shared concept | Better | Why (short) |
|---|---|---|
| **Planner** (goal-backward, verify-per-task) | Cadence | Same derivation quality; absorbed GSD's tracer-first idea as a plain default instead of a `type=tracer` schema + `--no-tracer` escape. GSD adds a 3-cycle convergence loop and mandatory STRIDE tables — ceremony a twice-failed plan should escalate to the human instead. |
| **Executor** (atomic commit per task) | Cadence | Identical guarantees (atomic commits, deviation buckets, slopsquat guard, `git add -A` ban). GSD makes parallel worktree *waves the default*, which forces a fleet of guards (protected-ref assert, cwd-drift sentinel, path containment) — Cadence's insight: the cost disappears if waves are opt-in, not default. |
| **Verifier** (goal-backward) | Near-tie, edge Cadence | Same four-level model and most-restrictive-first verdict, with field names that match `uat merge` (no translation layer). GSD's one real edge: an L4 data-flow trace that catches "wired but hollow." |
| **State / artifact model** | Cadence, clearest win | 4-line overwritten cursor + everything derived by `planning.mjs` vs GSD's ~100-line digest behind a `STATE.md.lock` lockfile and a 5-policy field-classification enum. GSD's machinery exists only to serve the wave concurrency it chose; Cadence's cursor has no RMW window worth locking. |
| **Adversarial review** (plan + diff) | Cadence, decisively | Claude subagent and external providers emit the *identical* finding schema so the adjudicator merges them blind; structure is enforced at the provider, never scraped. GSD reconciles free-text `REVIEWS.md` and carries a 12-dimension checker visibly grown from one project's bug numbers. |
| **Model routing** | Cadence (for one runtime) | Same idea (tier × profile, escalate-on-failure, difficulty bump) in ~180 lines of data+logic, provably-monotonic escalation, staleness-proof aliases. GSD's 165-line catalog is defensible only because it targets ~18 runtimes — 11 of which are dead all-`null` placeholder rows. |
| **Config surface** | Cadence, overwhelmingly | ~55 flat self-describing keys that *are* the source of truth (menu is derived from the schema) vs ~110 static keys + 16 regex patterns + ~90 nested defaults, with a `_comment` explaining the config's own naming drift. |

The pattern is consistent: GSD's extra machinery is almost always downstream of a
default it chose (waves, multi-runtime, free-text review) — not a capability
Cadence is missing. Cadence made the "should we?" call at the default, and the
machinery evaporated.

---

## What to improve on the better one (Cadence)

Small, high-confidence, all consistent with the manifesto. Ranked.

1. **Verifier L4 — the "hollow seam" check.** *(genuine capability gap)* Cadence's
   verifier stops at *Wired* + a behavioral spot-check, which can pass a seam that is
   wired but has no data flowing through it. Add a data-flow trace to level 4. Costs a
   few lines in `agents/cad-verifier.md`, no new machinery, and it directly serves
   Cadence's own line that "silent failures live in the seams."
2. **Honest-verifier discipline — abstain, don't guess.** *(cheap hardening)* Teach the
   verifier to return UNCERTAIN on any check whose answer isn't derivable from the spec,
   rather than emit a confident PASS/FAIL. Hardens the verify gate against the exact
   failure mode — false confidence — the gate exists to prevent. One paragraph in the
   agent contract.
3. **Per-reviewer prompt-token cap.** *(small safety)* Cadence sends artifacts to a paid
   provider with no size ceiling. GSD's `max_prompt_tokens_per_reviewer` is a one-key
   guard worth adopting in `review.*`.
4. **Per-task `<automated>` field wording.** *(mild tightening)* Name an automated check
   per task by default in the planner template; keep the existing `human-verify` escape.
   Template wording, not a new schema.

Deliberately **not** recommended (would re-import the elephant): wave-default execution
and its worktree-guard fleet, the state lockfile + field-classification enum,
`plan-review-convergence`, mandatory STRIDE tables, depth-mode review matrices, dated
model-id preset tables, the 18-runtime catalog.

---

## What exists in GSD that Cadence should consider adding

Grouped by verdict. Only the genuine, cheap, single-artifact items clear the "should
we?" bar.

### PORT — genuine gaps, each a single small artifact

- **Post-planning gap report** (GSD `gap-analysis`). Cadence's `cad-audit` catches
  dropped requirements only *pre-ship*. A read-only Source|Item|Status table run the
  moment `/cad-plan` finishes catches a silently-dropped requirement at the cheapest
  possible moment. Zero machinery, pure "gates are real gates." *(Cadence already has a
  `plan-gaps.md` workflow stub — this is the content for it.)*
- **Common-bug-patterns checklist** (GSD reference). A frequency-ordered scan (null
  access, off-by-one, async races…) run *before* forming a hypothesis in `/cad-debug`,
  shortcutting the most common bugs before spending a hypothesis cycle or a paid consult.
  One reference file.
- **Honest-verifier reference** — see improvement #2 above; it's both an improvement to
  the verifier and a portable GSD artifact.

### MAYBE — useful, decide deliberately

- **research-philosophy** discipline ("training data is stale; treat prior knowledge as
  hypothesis, verify against current docs, date your confidence"). Mirrors John's own
  Context7 rule; governs the *main* model's assertions during planning. One cheap
  reference.
- **edge-probe taxonomy** (the *checklist*, not GSD's engine — DESIGN already cut the
  engine). A closed set of boundary/adjacency/encoding/ordering edges to sharpen
  falsifiable acceptance criteria in `cad-context`.
- **assumption-delta** — a rarely-firing, non-blocking checkpoint that surfaces one
  identity-model question when a phase turns something singular/required into
  plural/optional, so primary-key drift doesn't accumulate. Clever and cheap; niche
  firing rate is the only knock.
- **schema-gate pattern** (generalized) — "detect a change class that makes verification
  lie, then force a task." Excellent idea; GSD's concrete version is ORM/DB-web specific.
  Port the *pattern* only if a project runs a live-DB stack (John's work is Rust/CLI, so:
  probably not yet).
- **claude-orchestration** — the Workflow-tool engine that would make Cadence's
  *already-kept-but-dormant* parallel path real (`parallelization.*` config exists; the
  default is sequential). The one MAYBE that's real engineering, not a doc. Heaviest lift;
  only if the sequential default ever becomes the bottleneck.

### SKIP — complexity for its own sake / wrong domain / already covered

AI-integration track, UI/UI-audit agents (COSMIC is covered by `cosmic-design`),
mempalace/graphify/intel/pattern-mapper (John's `mem-*`/`claude-mem`/`learn-codebase`
are stronger), profile-pipeline behavioral profiling, external-job (HPC/team scale),
autonomous-smart-discuss (violates verify-before-done), the 18 host adapters, decimal
phase calculation (`cad-phase` already inserts+renumbers), thinking-partner (effort is
frontmatter-frozen anyway). GSD's `security`, `nyquist`, and doc-verification are
already covered by Cadence's `risk_surface` trigger, `cad-coverage`, and
`cad-docs-verify` respectively.

---

## The through-line

Cadence didn't win by being smaller. It won by making the "should we?" call at each
*default* — sequential over waves, cursor over digest, one schema over free text, one
runtime over eighteen — and watching whole categories of machinery become unnecessary.
The four improvements above are the same move applied once more: each closes a real gap
with a single artifact and adds no new surface to defend. Everything larger stays cut.
