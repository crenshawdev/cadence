---
phase: 3
status: complete
completed: 2026-07-16
---

# Phase 3: Context weight - Summary

A deterministic prose-surface weight seam (`weight.mjs`) plus two blocking `self-verify.mjs` checks - per-surface byte budgets and an agents-only undeclared-tool lint - both drawing measured weight from one shared `lib/surface-weight.mjs` so reported and enforced weight cannot diverge.

## What shipped

- Shared measurement lib - `cadence-core/bin/lib/surface-weight.mjs`: pure, zero-dep. `weighAll(root)` returns `{surface,bytes,estTokens}[]` for exactly `agents/*.md`, `skills/**/SKILL.md`, `cadence-core/workflows/*.md` (49 surfaces), sorted ascending by `surface`, forward-slash relative paths, absent dirs = empty data. `measure(text)` = `{bytes: Buffer.byteLength(text,'utf8'), estTokens: Math.ceil(text.length/4)}`.
- Weight seam CLI (CWT-01) - `cadence-core/bin/weight.mjs`: emits one JSON line `{ok:true,checked:'surface-weight',surfaces:...}`, `--root` flag, try/catch → `{ok:false,reason:'internal'}`. Two runs are byte-identical (verified).
- Budget manifest (D-04/D-05) - `cadence-core/bin/weight-budgets.json`: all 49 surfaces seeded at current measured bytes (tightest honest bloat gate).
- Budget check (CWT-02) - in `self-verify.mjs run()`: `budget-overrun` when `bytes>budget`, `unbudgeted-surface` when a measured surface has no manifest entry; manifest read root-relative, `existsSync`-guarded (absent → skip).
- Tools lint (CWT-03) - in `self-verify.mjs run()`: agents-only, fixed `KNOWN_TOOLS`, matches only backtick-quoted `` `Tool` `` or "the Tool tool" phrasing against frontmatter `tools:`, ignores bare-word uses.
- Tests - `weight.test.mjs` (5 cases) and extended `self-verify.test.mjs` (6 new cases: budget-overrun, budget-ok, undeclared-tool, declared-tool-ok, no-false-positive, unbudgeted-surface).

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 5d3d203 | feat(3-1): shared surface-weight lib |
| 1 | 2 | 44916de | feat(3-1): weight.mjs seam CLI (CWT-01) |
| 1 | 3 | 719c28e | test(3-1): weight.mjs seam coverage |
| 1 | 4 | d1bf9e4 | feat(3-1): seed per-surface byte budget manifest |
| 1 | 5 | 148d8af | feat(3-1): self-verify context-weight budget check (CWT-02) |
| 1 | 6 | 6a91b1f | feat(3-1): self-verify undeclared-tool lint for agents (CWT-03) |
| 1 | 7 | 7605e1c | test(3-1): cover budget and undeclared-tool checks |

Range: `24efa32..7605e1c` (7 commits).

## Deviations

None - plan executed as written.

## Open items

- (Robustness, advisory diff review) `self-verify.mjs` tools-lint `tools:` parser handles only the inline comma-separated frontmatter form (`tools: Read, Bash`). A YAML block-sequence form (`tools:\n  - Read\n  - Bash`) or a CRLF-saved agent file would mis-parse and could false-positive as `undeclared-tool`. Latent only: all 7 current `agents/*.md` are inline + LF (verified), so the repo-passes gate is unaffected. Worth hardening if a future agent uses block-sequence declarations.

## Goal check

The phase goal - "context claims are measured and enforced: prose-surface weight is a deterministic seam output, and CI blocks both budget overruns and undeclared-tool references" - is delivered by the 7 commits above. Criterion 1 (deterministic weight): `node cadence-core/bin/weight.mjs` lists all 49 surfaces with byte + estimated-token counts and two consecutive runs are byte-identical (`diff` empty, first-hand). Criteria 2 and 3 (enforcement): both new checks live inside one `self-verify.mjs run()` appending to the same `problems` array, and `node cadence-core/bin/self-verify.mjs` on the real tree emits `ok:true` with `checked: config-keys, invocations, paths, budgets, tools` and 0 problems (first-hand) - the `budgets` and `tools` tokens prove both checks execute, and the budget-overrun/undeclared-tool paths are proven by the 6 new fixture tests. Reported vs enforced weight cannot diverge because both import the same `lib/surface-weight.mjs` (D-09). Criterion 4 (clean tree): `node --test cadence-core/bin/*.test.mjs` reports 153 pass / 0 fail (first-hand) and `tsc` is clean. Nothing in the goal is unmet; the only gap is the latent inline-only `tools:` parser noted as an open item, which does not affect any current surface.
