---
phase: 3
plan: 3
requirements:
  - AC7
files:
  - crates/cadence/src/server.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/recall/rank.rs
  - crates/cadence/src/recall/documents.rs
  - crates/cadence/src/recall/history.rs
  - crates/cadence/src/recall/tests.rs
  - docs/architecture/recall.md
---

# Phase 3: The store and its queries - Plan 3

## Goal

Recall is a binary-owned query over structured records, authored planning documents, and git history. One query brings back decisions and deviations from both records and prose while preserving the declined-item exclusion.

## Must be true when done

- AC7: One query returns both a structured-record hit and an authored-markdown hit, each with usable provenance.
- PROJECT, ROADMAP, CONTEXT, and SUMMARY prose remains searchable; removing operational markdown files does not remove the project's memory.
- Declining an item removes it and its older structured or legacy-ledger revisions from recall, including warm resident results.
- Archived or removed planning knowledge remains reachable through git with a commit/path citation, and missing history is reported as incomplete coverage.
- Repeating a query against the same inputs gives the same bounded result order; disabling recall returns an explicit disabled answer.
- The resident handler's clones share one owner and current config/store generations, rather than each building a writable store.

## Context

D-04 and AC7 bind this plan; the store projection from PLAN-1 enforces D-01/AC2 and PLAN-2 supplies current config plus automatic import.
Use an in-memory derived index; committed JSON/JSONL and authored markdown remain authoritative, with git supplying historical evidence.
All frozen citations mean `git show v3.7.12:<path>`; user-facing retrieval parity is owed, internal JavaScript data layouts are not.
The existing `CadenceServer` and `cadence_version` remain the host boundary; public tool selection and registration beyond that are phase 5, not this plan.

## Tasks

### Task 1: Build the deterministic recall query core

- **Files:** crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/recall/rank.rs, crates/cadence/src/recall/tests.rs
- **Action:** Mount the recall module from `server.rs` using an explicit source path so this plan owns its module declaration without editing another plan's root. Implement a pure query core over the store's recall-eligible projection and supplied document snippets. Exclude declined identities before index construction and apply current identity eligibility to historical item candidates too; never index raw item-event JSON. Preserve BM25 retrieval, shared tokenization for indexing/querying, deterministic ordering, positive result limits, result totals, snippets, and provenance. The frozen ranker lowercases alphanumeric terms, filters raw stopwords, then folds suffixes (`cadence-core/bin/lib/bm25.mjs:113-162`); it deduplicates query terms and orders positive scores by descending score then corpus position (`:198-221`). Preserve those useful query semantics without requiring byte-identical rankings against a newly expanded corpus. Preserve the default top five, invalid-limit refusal, explicit disabled backend, and empty-corpus success from `cadence-core/bin/planning/recall.mjs:40-60`, `:183-199`. Keep score computation and rendering free of I/O and runtime types.
- **Verify:** `cargo test -p cadence --bin cadence` exercises pure recall inputs with controlled ties, repeated terms, suffix pairs, zero hits, invalid limits, and disabled recall. Expected token relationships are grounded in frozen `cadence-core/bin/lib/bm25.mjs:113-162`; default limit and total behavior are grounded in `cadence-core/bin/planning/recall.mjs:40-60`, `:188-199`. A matching declined candidate never affects results or totals. Repeat identical inputs and assert identical results, without asserting an unchanged rank against the expanded 4.0 corpus.

### Task 2: Bring authored prose into the same corpus

- **Files:** crates/cadence/src/recall/mod.rs, crates/cadence/src/recall/documents.rs, crates/cadence/src/recall/tests.rs
- **Action:** Add the read-only document adapter for PROJECT, ROADMAP, CONTEXT, and SUMMARY, including live phase/task homes and retained archive directories. Retain UAT finding text and task RECORD evidence as compatibility sources while those artifacts stay in their current formats; the frozen recall path reads UAT names/expectations and task receipt snippets at `cadence-core/bin/planning/recall.mjs:93-100`, `:151-156`. Split prose into stable, citable heading/paragraph units with continuations intact; preserve phase directory spelling instead of treating a parsed number as identity. For CONTEXT's decision lists, preserve the durable-heading preference and fallback only when that heading is absent (`cadence-core/bin/lib/planning-files.mjs:1035-1043`), while indexing other authored context prose under D-04 without reintroducing excluded phase-local decision lists by a whole-file fallback. Do not scan all markdown indiscriminately: legacy DECLINED, raw config, credentials, source-evidence quarantine, and operational log files are not document sources. After import, CAPTURE and FILED contribute through the store rather than a duplicate legacy-file scan. Validate path containment and report unreadable permitted sources as incomplete corpus coverage. Combine real record and document reads with Task 1's query core by this task so the mixed-source spine is runnable.
- **Verify:** `cargo test -p cadence --bin cadence` queries one distinctive phrase shared by a real stored capture and a temporary CONTEXT paragraph and returns both with record identity or file/line provenance (AC7). Separate cases find PROJECT, ROADMAP, SUMMARY, UAT, and task RECORD text. An empty durable-decision section does not fall back to local decisions, as required by frozen `cadence-core/bin/lib/planning-files.mjs:1035-1043`. Symlinks escaping the planning root and a matching DECLINED/config file produce no hit. Removing the legacy capture file after import does not remove its structured hit.

### Task 3: Resolve retained memory through git

- **Files:** crates/cadence/src/recall/mod.rs, crates/cadence/src/recall/history.rs, crates/cadence/src/recall/tests.rs, docs/architecture/recall.md
- **Action:** Add a read-only git adapter behind the I/O boundary. Query planning-document and store history reachable from the current checkout's history; deduplicate unchanged blobs and equivalent live/historical evidence by explicit provenance, not equal sentences. Index retained archive documents directly and use git blobs for documents removed from the working tree. Support legacy ARCHIVE residue as historical compatibility evidence without maintaining or rewriting ARCHIVE: frozen recall includes parsed residue at `cadence-core/bin/planning/recall.mjs:124-125`, and its parser carries source, phase, milestone label, and origin separately at `cadence-core/bin/lib/planning-files.mjs:1124-1146`. Keep those origins separate instead of splitting an ambiguous rendered path. Apply the current store's declined-identity exclusion when considering earlier structured records or legacy FILED candidates; never index historical DECLINED bytes. Never manufacture a phase, commit, or full source document from a residue snippet. A shallow checkout, unborn repository, or failed git read must produce explicit coverage information alongside any available live hits. Use git as an argument-vector subprocess, with no writes to refs, index, worktree, or object database. Do not implement the later why/attribution surface or scan every unrelated branch.
- **Verify:** `cargo test -p cadence --bin cadence` creates a throwaway git repository containing an authored decision, commits its later removal, and recalls the earlier evidence with the exact commit and path. Test a legacy residue-only source, retained archive document, shallow/unavailable history, and duplicate blobs. A current decline suppresses its matching historical FILED/store identity; unrelated prose is not suppressed merely for sharing words. No test asserts that the frozen recall command queried git: its named live corpus is at `cadence-core/bin/planning/recall.mjs:67-181`, and this adapter is new 4.0 behavior.

### Task 4: Attach queries to the resident owner

- **Files:** crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/recall/tests.rs
- **Action:** Compose the completed PLAN-2 session-service factory into `CadenceServer::new`, retaining cloneable handles to the single owner instead of cloning writable state. Keep first touch lazy and preserve the existing `cadence_version` behavior without initializing planning storage for a version request. Add internal callable service operations for store queries and recall that use the same owner and import/config path tested by the earlier plans; public MCP tool expansion remains phase 5. Connect recall to confirmed store generations and current config, document identities/content, and git HEAD/blob identities. Cache the derived index only while those inputs match; a decline, append, document edit, checkout, or config change must invalidate affected results before the next query answers. Keep index ownership in one task with message passing, not a shared mutable lock. Feed only the store's filtered projection into ranking and recheck eligibility before rendering if query preparation crossed a generation change. A failed controlling-config reload yields an unavailable answer rather than using a stale enabled/disabled value. Shut down the owner with the session and resolve or fail outstanding reply channels predictably.
- **Verify:** `cargo test -p cadence --bin cadence` invokes the production handler's internal service through two cloned handles, appends through one, and recalls through the other without a second writer or import. Warm an index, decline the item, and repeat the query: no old hit or total survives. Edit a markdown document and change `memory.backend` between queries; the next result reflects both. `cargo test -p cadence --test mcp` preserves the existing version-only public tool catalog, version response, and clean stdin-close behavior. The internal query path is wired production code, not a test-only copy of recall.

### Task 5: Prove mixed-source recall after import and restart

- **Files:** crates/cadence/src/recall/tests.rs, docs/architecture/recall.md
- **Action:** Add a child-process scenario around the production resident service that automatically imports frozen planning inputs, appends a structured item through the binary owner, reads an authored document containing the same distinctive query terms, and performs one mixed-source query. Reopen in a fresh process and repeat after warming and invalidating the index. Add a declined item with a unique matching term, including an earlier filed revision in git, and make its exclusion visible in snippets and totals. Document source eligibility, provenance, cache invalidation, default limits, disabled/unknown behavior, archive compatibility, and the boundary between current item state and historical prose. State the corpus expansion as D-04 implementation rather than attributing PROJECT/ROADMAP or git indexing to frozen recall.
- **Verify:** `cargo test -p cadence --bin cadence` demonstrates AC7 in one response before and after restart, with at least one structured hit and one authored-markdown hit and correct citations. Its supporting AC2 regression returns no declined identity from current records, warm cache, legacy FILED, or git revisions. The same corpus/query gives the same order and total. Inspect the test's actual result collection, not just document discovery or index size; a hit that never reaches the response does not satisfy AC7.

## Notes

- Requirements use acceptance criterion IDs because phase 3 has no seeded requirement IDs. AC7 maps to Tasks 1-2 and 4-5; Task 3 supplies the roadmap's store-plus-git scope. Tasks 1, 3-5 reinforce AC2, whose primary ownership stays in PLAN-1.
- Execute after PLAN-1 and PLAN-2. The three plans have disjoint file leases; the extra config-before-handler composition order is deliberate and is not a claim of independent parallel execution. No skeleton file is created by one plan for another to overwrite, and no future function or field name is prescribed.
- Planner choices: an in-memory index; stable paragraph/heading snippets; current-HEAD-reachable history with explicit shallow-history coverage; compatibility sources for UAT, task receipts, and legacy residue; current decline state suppresses historical item identities; source-content and generation checks govern invalidation. PROJECT/ROADMAP and git expand the corpus, so internal rank equality with v3.7.12 is not an acceptance condition.
- D-04 does not silently change the durable-decision selection rule. Frozen `cadence-core/bin/lib/planning-files.mjs:1035-1043` intentionally distinguishes an absent durable heading from an empty one. Other authored context prose is searchable, but an excluded local decision list is not smuggled back in through generic document indexing.
- No additional locked-decision impossibility was found for recall. The absolute external-write race and literal checkout-cleanup limitations are recorded in PLAN-1 and PLAN-2. Verify commands are for later execution; this planning run does not run tests, build, commit, or write `cadence-core/`.
