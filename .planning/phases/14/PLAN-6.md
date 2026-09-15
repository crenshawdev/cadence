---
phase: 14
plan: 6
requirements: ["T3"]
files: ["crates/cadence/src/why_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/recall/history.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/fixtures/phase14/why-expected.txt","crates/cadence/tests/fixtures/phase14/why-top-expected.txt","skills/cad-why/SKILL.md"]
directories: ["crates/cadence/src/why"]
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P14-6-T1","verify":["cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact"]},{"id":"P14-6-T2","verify":["cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact"]},{"id":"P14-6-T3","verify":["cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact","cargo run -p cadence -- why-instructions"]}]}
---
# Phase 14: Receipts and retune - Plan 6

## Goal

`why` answers with chain text byte-identical to the frozen 3.x renderer, joining commits to the record
from the tree and from git history for pruned phases (D-139).

## Must be true when done

- T3. When the owner asks why a file line is as it is, the owner gets the chain text byte-identical to the fixed expected text for that repository.

## Context

The promise is byte identity of `text` (`skills/cad-why/SKILL.md:23-27`). Frozen renderer
`lib/why-render.mjs` (`:131`, `:134`, `:138`, `:242-252`, `:480-505`, `:530-536`); seam `bin/why.mjs:370-371`
answers a never-seen path with a fixed sentence; the recovered tier finds prune commits with `git log
--full-history -M --diff-filter=D --name-only -- .planning/phases/*/SUMMARY.md` (`lib/why-corpus.mjs:558-569`),
reads the pruned tables from the prune's parent (`:753-766`, `:797-820`), renders `an unlabelled close
(<sha8>)` without a label (`:762`); table grammar `lib/why-record.mjs:130`, deviations `:405`. Common setup and the progress text grammar: PLAN-1.md, the two sections of those names.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T3-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact",
        "expected": {
          "kind": "literal",
          "value": "First `text` bytes equal `why-expected.txt` exactly: the pruned phase's commit renders `phase: an unlabelled close (<sha8>) phase 2 (recovered from <parent8>:.planning/phases/2/SUMMARY.md)` with the fixture's stable shas, the phase 1 commits render task 1, D-01 and the deviation text, the post-prune commit renders `not yet joined` on every join line; `shown` 4, `total` 4. The `top: 1` text equals `why-top-expected.txt`, last line `Showing 1 of 4 commit(s). Pass --top 4 to see the rest.`. The line query lists exactly the commits that touched line 1. The never-seen path answers `result: \"not-in-history\"`, `text` = `No commits: git has never seen \"never/here.py\" in this repository's history.`. The answer after restart is byte-identical. `cadence why-instructions` stdout equals `skills/cad-why/SKILL.md`, which contains the verbatim-print rule."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_why_text_is_byte_exact_including_pruned_phase"
        },
        "setup": "A git repository built in `support/phase14.rs` with fixed `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`: three commits touching `src/thing.py` (the third on line 1 only); ROADMAP declaring phases 1 and 2; `phases/1/CONTEXT.md` with `D-01`; `phases/1/PLAN-1.md` whose task 1 declares `src/thing.py`; `phases/1/SUMMARY.md` with a `## Commits` table naming commits one and two under task 1 and a `## Deviations` entry naming D-01; `phases/2/SUMMARY.md` naming commit three; a prune commit `git rm -r .planning/phases/2` with no tag; a fourth commit touching `src/thing.py` after the prune. Expected bytes: `tests/fixtures/phase14/why-expected.txt` and `why-top-expected.txt`.",
        "call": "`why {path:\"src/thing.py\"}`; the same with `top:1`; `why {path:\"src/thing.py\",line:1}`; `why {path:\"never/here.py\"}`; restart, repeat the first.",
        "boundary": "real git repository built by the test, real why query over stdio, checked-in expected bytes; the frozen JS is never run by the test",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "Drift in ordering, abbreviation, a join line, the recovered label, the truncation note or the not-in-history sentence changes the bytes the owner checks.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Drift in ordering, abbreviation, a join line, the recovered label, the truncation note or the not-in-history sentence changes the bytes the owner checks."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T3-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/why/corpus.rs",
          "crates/cadence/src/why/git.rs",
          "crates/cadence/src/why_service.rs"
        ],
        "substance": "The why query: the git chain for a path or line, the corpus join over the tree and over pruned phases from the prune commit's parent, the not-in-history answer."
      },
      "reason": "Without the join or the recovered tier the chain states absent what the record holds.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Without the join or the recovered tier the chain states absent what the record holds."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T3-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/why/render.rs",
          "crates/cadence/tests/fixtures/phase14/why-expected.txt",
          "crates/cadence/tests/fixtures/phase14/why-top-expected.txt"
        ],
        "substance": "The byte-identical renderer and the fixed expected bytes taken once from the frozen seam."
      },
      "reason": "A reformatted field or an expected file regenerated from the code under test makes the identity vacuous.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "A reformatted field or an expected file regenerated from the code under test makes the identity vacuous."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T3-A3",
      "spec": {
        "locators": [
          "crates/cadence/src/why/instructions.rs",
          "skills/cad-why/SKILL.md"
        ],
        "substance": "The compiled, query-only cad-why front door carrying the verbatim-print rule."
      },
      "reason": "A door that summarised or reformatted text would break the identity a reader checks.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "A door that summarised or reformatted text would break the identity a reader checks."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Join commits to the record, including pruned phases from git history

- **Files:** the lease; new `why/`, `why_service.rs`, the two fixture files.
- **Action:** Deliver P14-T3-C, P14-T3-A1. Add `cadence_query {"operation":"why",
  "path":..,"line":N?,"top":N?}`: `git log --follow` for the path, `git log -L<line>,<line>:<path>` for a
  line (`lib/why-query.mjs:169`); a never-seen path answers `result: "not-in-history"` with the frozen
  sentence. The join builds the on-disk tier from every declared phase's SUMMARY `## Commits` table, PLAN
  task cells, CONTEXT decisions and SUMMARY deviations (grammar of `why-record.mjs`), the task tier from
  `.planning/tasks/<slug>/RECORD.md`, and the recovered tier from prune commits found with the frozen
  `--diff-filter=D` query, reading the pruned documents from the prune's parent; the recovered label is
  the newest tag pointing at the prune commit, else `an unlabelled close (<sha8>)` (D-139, recorded here).
  Answer `{status:"ok", path, line,
  result:"chain", text, shown, total, entries, excluded, warnings}`.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact`.

### Task 2: Render byte-identically and fix the expected bytes

- **Files:** `why/render.rs`, the two fixture files, `support/phase14.rs`.
- **Action:** Deliver P14-T3-A2. The renderer reproduces `why-render.mjs` exactly. The expected bytes are
  produced ONCE by the executor running the frozen tree copy of `bin/why.mjs` against the check's fixture
  repository, reviewed line by line against `why-render.mjs`, and committed as
  `tests/fixtures/phase14/why-expected.txt`; the prune commit carries no tag so both renderers spell `an
  unlabelled close (<sha8>)`, stable because dates, author, messages and tree are fixed. The `top: 1`
  expectation is handwritten into `why-top-expected.txt`. The check compares bytes and never runs the JS.
  P5: `top` mirrors `--top`; the exclusion block comes from the second comparand (`why.mjs:152-156`).
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact`.

### Task 3: Compile the cad-why front door

- **Files:** `why/instructions.rs`, `main.rs`, `skills/cad-why/SKILL.md`.
- **Action:** Deliver P14-T3-A3. `cadence why-instructions` renders `why::instructions::markdown()`;
  regenerate `skills/cad-why/SKILL.md`: parse `<path>[:<line>]`, one `why` call, print `text` verbatim and
  nothing else, the rule paragraph of the frozen `SKILL.md:23-27` carried byte for byte;
  `mcp__cadence__cadence_query` only, no Bash, no `why.mjs`.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase -- --exact`.

## Notes

Execution rules: PLAN-1.md Notes. D-139's label is the tag pointing at the prune commit, else the unlabelled spelling (the tag
arm unit tested outside the byte comparison); the expected bytes come from the frozen seam once, so the
4.0 renderer is not its own oracle; the frozen `why.mjs` stays as the reference.
