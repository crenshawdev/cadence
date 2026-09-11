PLAN COMPLETE
Plan: /code/cadence/.planning/phases/4/PLAN-2.md
Tasks: 4 of 4

| Task | Commit | Note |
|---|---|---|
| 1 — Normalize compatibility cursor intake | 307031e0 | `derivation::tests::ac5_normalize` 3 passed, 0 failed. Both normalization paths handle aliases, held cursors and invalid statuses; malformed or inconsistent fields stay unavailable despite `available:true`; original JSON and the exact imported Next are preserved. Contributes AC5. |
| 2 — Refuse inconsistent declarations | e88315b0 | `derivation::tests::ac5_agreement` 3 passed and `::ac6_conflicts` 2 passed, 0 failed. The agreement table covers live, closed, all-complete and paused. Both negative controls fire: reinstating the frozen AGREE table fails the canonical-unplanned case, and returning the frozen success-with-drift envelope fails its assertion. Contributes AC5, AC6. |
| 3 — Retire adopted intake atomically | 91246ae1 | `--test derivation_consistency ac5` 2 passed and `intake_changed` 1 passed, 0 failed. Separate seed/reopen child processes preserve raw cursor, original fields, hold and Next. Memo and retirement persist together; retired assertions permit advancement, unretired stale ones conflict, changed cursors re-arm intake. Failed normalization produces zero adoption and zero writer calls. Contributes AC5. |
| 4 — Cold and warm consistency refusals | ee688c89 | `--test derivation_consistency ac6` 2 passed, 0 failed, covering **22 cold/warm conflict rows**. Every row preserves source bytes and all three stores, produces no candidate and no intent file, and succeeds after correction. A real-store cursor mutation during capture returns `inputs-changed` with zero publication calls. **Discharges AC6.** |

Deviations: none.
Open items: none. Production memo composition is PLAN-3's, by design.

## Run details

Executed through Codex rather than `/cad-execute`, continuing the phase 2 and 3
vehicle. Starting HEAD `39756eff`. No checkpoint was hit.

**The falsification pass earned its cost here.** PLAN-2 Task 1 requires blank
name and blank `Next:` to be REJECTED, while the frozen reader accepts both -
`\((.+)\)` matches a run of spaces (`cadence-core/bin/lib/planning-files.mjs:29`)
and `Next:\s*(.+?)\s*$` lets the leading `\s*` cross a newline, so an empty
`Next:` line consumes the following `Updated:` line as its value (`:31`). An
executor porting the frozen grammar builds the permissive behavior and then
fails this task's own Verify. The pass caught it, `6f3d6e9d` wrote it into the
plan as two NEW native constraints, and the dispatch was told about it up front.

Implemented as an explicit line-bounded nonblank predicate
(`crates/cadence/src/derivation/compatibility.rs:24`):

```rust
fn nonblank_line(text: &str) -> bool {
    !trim(text).is_empty() && !text.contains(['\n', '\r', '\u{2028}', '\u{2029}'])
}
```

Both halves are load-bearing - nonblank after trimming kills the spaces-only
name, and the separator exclusion is what stops Next borrowing Updated. It also
covers U+2028 and U+2029, which the plan did not require. The proving test is
`ac5_normalize_blank_name_and_next_are_line_bounded_native_constraints`
(`crates/cadence/src/derivation/tests.rs:725`), exercising `(   )`, an empty
`Next:` and a whitespace-only `Next: \t ` on BOTH the legacy-bytes and the
imported-JSON path.

## Final suite and repository evidence

Independently re-run after the dispatch returned, not taken from its report:

- `cargo test --workspace` - **132 passed, 0 failed**: library 30, binary 54,
  `derivation_consistency` 6, `derivation_inputs` 12, MCP 4, store 16, crash 10.
  All 116 that existed after PLAN-1 still pass; this plan added 16 (library
  20 -> 30, plus the new 6-test `derivation_consistency` target).
- `cargo clippy --workspace --all-targets -- -D warnings` - **exit 0**.
- `rg -n 'Mutex|RwLock|OnceLock|LazyLock|flock|F_SETLK|\.lock\(' crates/cadence/src/store`
  - no matches, exit 1.
- `git diff --exit-code v3.7.12 -- cadence-core/` - **exit 0**, byte-identical.
- Lease exact: 8 files declared in PLAN-2's frontmatter, the same 8 changed.
- All four commits GPG-signed `G` with key `693AB15F91734B0C`, authored
  `John Crenshaw <john@jcrenshaw.dev>`. No AI attribution anywhere.
- Working tree clean. `core.hooksPath` was not overridden this dispatch.
