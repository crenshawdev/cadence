# Phase 3: Context weight - Context

Gathered: 2026-07-16
Feeds: /cad-plan 3

## Scope boundary

In: A deterministic context-weight measurement seam over the plugin's own prose surfaces, plus two blocking self-verify checks that share one measurement lib. Deliver a `cadence-core/bin/weight.mjs` sibling script reporting byte + estimated-token weight per surface as one-line JSON, a self-verify budget check (CWT-02), and a self-verify tools-declaration lint (CWT-03). Serves CWT-01, CWT-02, CWT-03.
Out: The recall feature (Phases 1-2, shipped and independent of this phase). Live/runtime token telemetry (PROJECT out-of-scope: Claude Code exposes no per-turn stats to a plugin script). Any real tokenizer beyond the chars/4 estimate. Budgets expressed as config keys or per-file frontmatter.
Deferred: None
Plan shape: one plan

## Decisions

- D-01 (weight seam): Weight measurement lands as a new standalone sibling seam script `cadence-core/bin/weight.mjs` with its own `weight.test.mjs`, not a `planning.mjs` subcommand - `planning.mjs` stays scoped to `.planning` state reads/writes while weight measures the plugin's own prose surfaces. Evidence: planning.mjs header (3-6), design-notes/planning-mjs-interface.md (4-6); self-verify.mjs mdFiles (79-99) already walks these surfaces.
- D-02 (surface set): The measured surfaces are exactly `agents/*.md`, `skills/*/SKILL.md`, and `cadence-core/workflows/*.md` - narrower than self-verify's mdFiles (which also covers references/, templates/, README.md). Evidence: REQUIREMENTS.md CWT-01 (line 20); contrast self-verify.mjs mdFiles (79-99).
- D-03 (determinism): Byte weight is UTF-8 byte length; the estimated-token count is a `ceil(chars/4)` proxy labeled "estimated"; output uses sorted traversal + fixed key order so two runs on the same tree are byte-identical. Evidence: PROJECT.md determinism constraint (70); recall's sorted-traversal + rounded-value precedent, planning.mjs (522-524, 558).
- D-04 (budget declaration): Per-surface size budgets live in a dedicated manifest beside the check, NOT as `config.schema.json` keys (would trip the inert-config-key reverse check) and NOT in per-file frontmatter. Evidence: self-verify.mjs inert-key check (188-195), CONTRACTS/TWO_WORD table precedent (32-72).
- D-05 (budget seed): Initial budgets are set at or above each surface's current measured weight so the "repo itself passes self-verify" gate stays green on the unmodified tree. Evidence: self-verify.test.mjs repo-passes gate (38-42); ROADMAP.md SC4 (52).
- D-06 (tools-lint detection): The CWT-03 lint counts only backtick-quoted tool mentions (or explicit "the X tool" phrasing) as tool references; bare English-word uses of tool names (e.g. "Write `None.`", a "| Task |" table header) are ignored, so no existing prose needs editing. Evidence: current collisions at agents/cad-assumptions-analyzer.md:71, agents/cad-executor.md:124, agents/cad-plan-checker.md:41, agents/cad-verifier.md:34; repo-passes gate self-verify.test.mjs (38-42).
- D-07 (tools-lint scope): CWT-03 lints `agents/*.md` only, against each agent's frontmatter `tools:` key; skills declare capabilities under `allowed-tools:` and are excluded. Evidence: REQUIREMENTS.md CWT-03 (line 22); skills/*/SKILL.md frontmatter uses allowed-tools.
- D-08 (self-verify integration): Both new checks run inside `self-verify.mjs run()` as additional problem kinds appended to the same `problems` array, extend the `checked` summary, and keep the single-JSON-line / exit-1 emit shape - no new CI job. Evidence: self-verify.mjs run() (119-198), emit (207); CI already runs `node cadence-core/bin/self-verify.mjs`.
- D-09 (shared measurement): The byte/token logic is factored into a `cadence-core/bin/lib/` module imported by both weight.mjs (CWT-01) and the CWT-02 budget check, so reported weight and enforced weight cannot diverge. Evidence: lib/ split precedent (planning.mjs imports lib/bm25.mjs, lib/planning-files.mjs, lib/config-merge.mjs); design-notes/planning-mjs-interface.md §9 (244-259).
- D-10 (drift contract): weight.mjs invocations named in linted prose get a CONTRACTS entry in self-verify.mjs per the standing new-subcommand rule, keeping the invocation check able to catch flag drift. Evidence: self-verify.mjs invocation check (`if (!contract) continue`, 164); recall's CONTRACTS-only drift precedent - phases/1/CONTEXT.md D-04 (phase 1) and phases/2/CONTEXT.md D-05 (phase 2), surfaced by recall.

## Acceptance criteria

- [ ] Running `node cadence-core/bin/weight.mjs` emits one-line JSON listing every surface in `agents/*.md`, `skills/*/SKILL.md`, and `cadence-core/workflows/*.md` with a byte count and an estimated-token count each; running it twice on the same tree produces byte-identical stdout
- [ ] Adding prose that pushes a surface past its declared budget makes `node cadence-core/bin/self-verify.mjs` exit 1 with output naming that surface and the overage amount
- [ ] Adding a backtick-quoted tool name to an agent's prose that is absent from that agent's frontmatter `tools:` list makes `node cadence-core/bin/self-verify.mjs` exit 1 with output naming the agent and the tool
- [ ] On the unmodified tree, `node --test cadence-core/bin/*.test.mjs` passes and `node cadence-core/bin/self-verify.mjs` exits 0 (current surfaces fit their initial budgets; no undeclared-tool false positives)

## Flagged assumptions

None - all assumptions confirmed
