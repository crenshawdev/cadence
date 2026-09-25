---
phase: 14
plan: 6
requirements: ["T3"]
files: ["crates/cadence/src/why_service.rs","crates/cadence/src/why/mod.rs","crates/cadence/src/why/corpus.rs","crates/cadence/src/why/git.rs","crates/cadence/src/why/render.rs","crates/cadence/src/why/instructions.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/fixtures/phase14/why-expected.txt","crates/cadence/tests/fixtures/phase14/why-top-expected.txt","crates/cadence/tests/mcp.rs","skills/cad-why/SKILL.md"]
directories: ["crates/cadence/src/why","crates/cadence/tests/fixtures/phase14"]
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P14-6-T1","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase"]},{"id":"P14-6-T2","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase"]},{"id":"P14-6-T3","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase","cargo nextest run -p cadence --test mcp"]}]}
---
## Goal

`why` answers with chain text byte-identical to the frozen 3.x renderer, joining commits to the record from the tree and from git history for pruned phases (D-139).

## Must be true when done

- T3. When the owner asks why a file line is as it is, the owner gets the chain text byte-identical to the fixed expected text for that repository.

## Context

T3, D-139 and the roadmap's cad-why paragraph. The promise is byte identity of `text`: the frozen skill skills/cad-why/SKILL.md prints the seam's text field verbatim. The frozen renderer is cadence-core/bin/lib/why-render.mjs; the seam cadence-core/bin/why.mjs answers a never-seen path with the fixed sentence `No commits: git has never seen "<path>" in this repository's history.`; the recovered tier in cadence-core/bin/lib/why-corpus.mjs finds prune commits with `git log --full-history -M --diff-filter=D --name-only -- .planning/phases/*/SUMMARY.md`, reads the pruned tables from the prune's parent, labels a prune commit from the ONE heading it added to .planning/ARCHIVE.md and otherwise renders `an unlabelled close (<sha8>)` (pruneLabels), and names the recovered locator as `<parent8>:<directory>` without the file name (recoveredDir); an unresolved commit renders the gap block beginning `NOT RESOLVED` (gapLines in why-render.mjs); the table grammar is cadence-core/bin/lib/why-record.mjs and the line query is cadence-core/bin/lib/why-query.mjs. All five files are also at the v3.7.12 tag under the same paths. Progress grammar and common setup: phase 14 plan 1, context and notes parts.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T3-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase",
        "expected": {
          "kind": "literal",
          "value": "The first `text` bytes equal crates/cadence/tests/fixtures/phase14/why-expected.txt exactly: the pruned phase's commit renders `phase: an unlabelled close (<sha8>) phase 2 (recovered from <parent8>:.planning/phases/2)` with the fixture's stable shas, the phase 1 commits render task 1, D-01 and the deviation text, the post-prune commit renders the frozen unresolved gap block beginning `NOT RESOLVED`, with `not yet joined` only on the fields the renderer gives that fallback; shown 4, total 4. The `top: 1` text equals why-top-expected.txt, last line `Showing 1 of 4 commit(s). Pass --top 4 to see the rest.`. The line query lists exactly the commits that touched line 1. The never-seen path answers result `not-in-history` with text `No commits: git has never seen \"never/here.py\" in this repository's history.`. The answer after restart is byte-identical. `cadence why-instructions` stdout equals skills/cad-why/SKILL.md, which contains the verbatim-print rule."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_why_text_is_byte_exact_including_pruned_phase"
        },
        "setup": "A git repository built in crates/cadence/tests/support/phase14.rs with fixed GIT_AUTHOR_DATE and GIT_COMMITTER_DATE: three commits touching src/thing.py (the third on line 1 only); a ROADMAP.md declaring phases 1 and 2; phases/1/CONTEXT.md with D-01; phases/1/PLAN-1.md whose task 1 declares src/thing.py; phases/1/SUMMARY.md with a `## Commits` table naming commits one and two under task 1 and a `## Deviations` entry naming D-01; phases/2/SUMMARY.md naming commit three; a prune commit `git rm -r .planning/phases/2` that adds no .planning/ARCHIVE.md heading; a fourth commit touching src/thing.py after the prune. Expected bytes checked in at crates/cadence/tests/fixtures/phase14/why-expected.txt and why-top-expected.txt.",
        "call": "why {path src/thing.py}; the same with top 1; why {path src/thing.py, line 1}; why {path never/here.py}; restart; repeat the first.",
        "boundary": "real git repository built by the test, real why query over stdio, checked-in expected bytes; the frozen JavaScript is never run by the test",
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
          "reason": "The owner asks why a file line is as it is and gets the chain text byte-identical to the fixed expected text: T3 word for word."
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
          "reason": "It is the query that produces the chain text T3 names."
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
          "reason": "T3's oracle is the fixed expected text; this is that text and the renderer it binds."
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
      "reason": "A door that summarised or reformatted the text would break the identity a reader checks.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The door is where the owner reads the text; it must print it unchanged."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Join commits to the record, including pruned phases from git history

- **ID:** P14-6-T1
- **Files:** crates/cadence/src/why_service.rs, crates/cadence/src/why/mod.rs, crates/cadence/src/why/corpus.rs, crates/cadence/src/why/git.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs, crates/cadence/tests/fixtures/phase14/why-expected.txt, crates/cadence/tests/fixtures/phase14/why-top-expected.txt
- **Action:** Deliver P14-T3-C and P14-T3-A1. Add cadence_query {operation: why, path, line?, top?}: `git log --follow` for the path, `git log -L<line>,<line>:<path>` for a line, as why-query.mjs does; a never-seen path answers result `not-in-history` with the frozen sentence. The join builds the on-disk tier from every declared phase's SUMMARY.md `## Commits` table, PLAN task cells, CONTEXT decisions and SUMMARY deviations (the grammar of why-record.mjs), the task tier from .planning/tasks/<slug>/RECORD.md, and the recovered tier from prune commits found with the frozen --diff-filter=D query, reading the pruned documents from the prune's parent; the recovered label is the one heading the prune commit added to .planning/ARCHIVE.md, else `an unlabelled close (<sha8>)` (the frozen rule; D-139 corrected in this plan's notes). Answer {status ok, path, line, result `chain`, text, shown, total, entries, excluded, warnings}. The path is the owner's question, not a read location: the binary reads the repository itself.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase

### Task 2: Render byte-identically and fix the expected bytes

- **ID:** P14-6-T2
- **Files:** crates/cadence/src/why/render.rs, crates/cadence/tests/fixtures/phase14/why-expected.txt, crates/cadence/tests/fixtures/phase14/why-top-expected.txt, crates/cadence/tests/support/phase14.rs
- **Action:** Deliver P14-T3-A2. The renderer reproduces cadence-core/bin/lib/why-render.mjs exactly. The expected bytes are produced ONCE by the executor running the frozen cadence-core/bin/why.mjs against the check's fixture repository, reviewed line by line against why-render.mjs, and committed as crates/cadence/tests/fixtures/phase14/why-expected.txt; the prune commit adds no .planning/ARCHIVE.md heading so both renderers spell `an unlabelled close (<sha8>)`, stable because dates, author, messages and tree are fixed. The `top: 1` expectation is handwritten into why-top-expected.txt. The check compares bytes and never runs the JavaScript. P5: `top` mirrors --top; the exclusion block comes from the second comparand as why.mjs renders it.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase

### Task 3: Compile the cad-why front door

- **ID:** P14-6-T3
- **Files:** crates/cadence/src/why/instructions.rs, crates/cadence/src/main.rs, crates/cadence/tests/mcp.rs, skills/cad-why/SKILL.md
- **Action:** Deliver P14-T3-A3. Add `cadence why-instructions` rendering why::instructions::markdown(); regenerate skills/cad-why/SKILL.md from it: parse `<path>[:<line>]`, one why call, print `text` verbatim and nothing else, the verbatim-print rule of the frozen skill carried in substance; mcp__cadence__cadence_query only, no Bash, no why.mjs. Extend the skill pin in crates/cadence/tests/mcp.rs.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_why_text_is_byte_exact_including_pruned_phase
  - cargo nextest run -p cadence --test mcp

## Notes

Execution rules: phase 14 plan 1, notes part. D-139 corrected here, owner 2026-09-18, because the phase context is immutable: the frozen label rule reads the one heading the prune commit added to .planning/ARCHIVE.md, never a tag; the 4.0 renderer follows the frozen rule for parity (the heading arm is unit tested outside the byte comparison), and the fixture's prune commit adds no ARCHIVE.md heading, which is the unlabelled case. The expected bytes come from the frozen seam once, so the 4.0 renderer is not its own oracle; the frozen why.mjs stays in the tree as the reference until the phase that removes replaced JavaScript. Falsification findings 17 to 19 of .codex-analysis/phase14-falsification.md corrected this plan on 2026-09-18.
