PLAN COMPLETE
Plan: /code/cadence/.planning/phases/4/PLAN-1.md
Tasks: 5 of 5

| Task | Commit | Note |
|---|---|---|
| 1 — Captured lifecycle contract | f2ae1ffb | `derivation::tests::contract` 3 passed, 0 failed; exact status spellings, round trips, distinct observations, null-current cycles. Lease accepted. |
| 2 — Bounded ROADMAP and UAT readers | 11f26b73 | `derivation::tests::parsers` 4 passed, 0 failed; normalization, fences, classification, numeric aliases and ties, frozen UAT behavior. Contributes AC1, AC2. |
| 3 — Admitted artifact observations | 5cdb4689 | `--test derivation_inputs capture` 6 passed, 0 failed; directory existence semantics, dangling links, one capture per address, normalized listings, path-specific denials, untouched missing root. Contributes AC1, AC2, AC7. |
| 4 — Production truth table | 1a7ab6ee | `derivation::tests::ac1` 4 passed and `::ac2` 4 passed, 0 failed; both negative controls fired - skip-reason removal prevents completion, and the PLAN-prerequisite mutant is rejected. **Discharges AC1, AC2.** |
| 5 — Refuse on changed observations | 35042ba3 | `--test derivation_inputs ac7` 6 passed, 0 failed; changed-input and denial refusals preserve prior memo bytes with zero publications, and both mutants fail the shared guard. **Discharges AC7.** |

Deviations: one, execution-only. The first commit used a transient
`core.hooksPath=/dev/null` override. It did not persist (`git config --get
core.hooksPath` is unset) and the repository has no active hooks, so nothing
was skipped. No persistent git configuration was changed.

Open items: none.

## Run details

Executed through Codex rather than `/cad-execute`, on John's 2026-09-06 ruling,
continuing the vehicle used for phases 2 and 3. Starting HEAD `6f3d6e9d`. The
plans had already been through the adversarial falsification pass
(`.codex-analysis/plan-4-falsification.md`: TRUE 158 / FALSE 0 / IMPRECISE 8 /
NOISE 16), and its eight citation corrections were in the plan before execution
began, so no task ran against a stale anchor.

Every task's Verify gate was run with its negative controls, which is the bar
this phase's criteria were written to. The two that matter most:

- **AC1's mutant** - adding a PLAN prerequisite makes the no-PLAN-complete case
  fail. This is the credulity D-02 inherits deliberately: a phase carrying a
  SUMMARY and a qualifying UAT derives `complete` with no PLAN at all, matching
  frozen `derivePhases` (`cadence-core/bin/planning/core.mjs:192-205`).
- **AC7's mutants** - disabling reobservation, and converting a denial into an
  absence, each make the corresponding check fail. Refusal on changed inputs is
  therefore load-bearing rather than incidental.

No implementation deviation and no checkpoint. The lease held exactly: eight
files declared in PLAN-1's frontmatter, eight files changed, no others.

## Final suite and repository evidence

Independently re-run after the dispatch returned, not taken from its report:

- `cargo test --workspace` - **116 passed, 0 failed**, across library (20),
  binary (54), MCP (4), store (16), crash (10) and integration (12) targets.
  The 89 tests that existed before this plan all still pass; the 27 new ones
  are this plan's.
- `cargo clippy --workspace --all-targets -- -D warnings` - **exit 0**, no
  warnings.
- `rg -n 'Mutex|RwLock|OnceLock|LazyLock|flock|F_SETLK|\.lock\(' crates/cadence/src/store`
  - no matches, exit 1. The store honors the scoped no-lock decision.
- `git diff --exit-code v3.7.12 -- cadence-core/` - **exit 0**. The frozen tree
  is byte-identical.
- All five commits are GPG-signed `G` with key `693AB15F91734B0C`, authored
  `John Crenshaw <john@jcrenshaw.dev>`. No AI attribution in any commit
  message, code comment or file.
- Working tree clean.
