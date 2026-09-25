---
phase: 17
plan: 5
requirements: ["T5"]
files: ["crates/cadence/src/acquisition.rs","crates/cadence/src/acquisition/tests.rs","crates/cadence/src/lib.rs","crates/cadence/src/read/source.rs","crates/cadence/src/read/slice.rs","crates/cadence/src/read/search.rs","crates/cadence/src/read/list.rs","crates/cadence/src/read/document.rs","crates/cadence/src/read/measurement.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/store/cache.rs","crates/cadence/src/recall/documents.rs","crates/cadence/src/recall/history.rs","docs/architecture/store.md","crates/cadence/src/import/mod.rs","crates/cadence/src/import/tests.rs","crates/cadence/src/config/reload.rs","crates/cadence/src/plan/map_view.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-5-T1","verify":["cargo nextest run -p cadence --lib acquisition::tests::acquisition_bounds_name_the_crossing","cargo nextest run -p cadence --lib acquisition::tests::changed_metadata_refuses_acquired_bytes","cargo nextest run -p cadence --lib read::slice::tests::an_issued_file_crossing_precedes_stale_revision","cargo nextest run -p cadence --lib read::search::tests::a_crossing_is_named_in_an_incomplete_search","cargo nextest run -p cadence --bin cadence import::tests::a_store_crossing_refuses_session_input","cargo nextest run -p cadence --lib plan::map_view::tests::oversized_input_refuses_even_with_cached_snapshot"]},{"id":"P17-5-T2","verify":["cargo nextest run -p cadence --bin cadence server::recall::history::tests::oversized_blob_metadata_refuses_content_acquisition"]}]}
---
## Goal

Refuse acquisition above the source/store limits before loading content and name every crossing to its caller.

## Must be true when done

- T5. When a file the resident acquires exceeds its acquisition bound, the caller sees the crossing named (file, size, bound) instead of the content, and the resident never loads the whole file.

## Context

HEAD 7d492bf3 read/source.rs::content checks metadata.is_file() and then reads the whole file without a size bound. read/search.rs::ReadDomain::search silently skips content errors and read/list.rs::ReadDomain::list filters them out. read/slice.rs acquires content before comparing its revision; its outline threshold is supplied by read/outline/mod.rs, whose parser already accepts a time callback. Store acquisition is independently unbounded in store/filesystem.rs::Storage::read and store/cache.rs::read; transaction recovery reads its intent through Storage::read. Recall Files::text reads whole text, the documents walk gathers metadata, history::read separately reads ARCHIVE.md, and history::Git::blob calls cat-file without a size preflight or output cap. Additional store-file reads occur in import/mod.rs: observe_config reads state at line 1045, guard_config at line 1112, and SessionFactory::first_touch reads intent/state at lines 1182-1183 and items/decisions at lines 1235-1236 before Store::open at line 1313. They use config/reload.rs::FileIo::read (lines 66-98), which reads to end without a size bound. plan/map_view.rs::observe (lines 27-39) independently reads intent/state/items/decisions; verification/verdicts.rs:76 and verification/audit.rs:138 call this map view. Direct read-layer source acquisition also includes document.rs::roadmap and measurement.rs::classify_read's project-confined source-file read at line 377. Measurement's main/subagent session JSONL, correlation metadata and transcript rechecks are host records, not source files under D-212. config/floor.rs supplies the existing named-bound pattern; its limits are separate and unchanged.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/acquisition_bounds_name_the_crossing",
      "spec": {
        "command": "cargo nextest run -p cadence --lib acquisition::tests::acquisition_bounds_name_the_crossing",
        "expected": {
          "kind": "property",
          "value": "Source metadata size 16777217 yields Refuse with file src/large.rs, size 16777217 and bound 16777216, and no Read request; sizes 16777215 and 16777216 yield permission to read within 16777216. Store metadata size 1073741825 yields Refuse with file .planning/state.json, size 1073741825 and bound 1073741824, and no Read request; size 1073741824 is permitted within 1073741824. These literal expectations detect a missing guard, an off-by-one comparison, swapped source/store bounds and a lost crossing field."
        },
        "test": {
          "file": "crates/cadence/src/acquisition/tests.rs",
          "function": "acquisition_bounds_name_the_crossing"
        },
        "setup": "Supply file labels, file class and metadata length as plain values. The production acquisition::decide unit selects the source/store constant and returns either a bounded read permission or a typed crossing. No file, allocation of file-sized content, process, filesystem observation or clock is needed.",
        "call": "Call acquisition::decide once for each independent source/store boundary case and compare the returned action and crossing fields with handwritten literals. A refusal carries no read permission. Do not call a read/search/recall handler or Store::open.",
        "boundary": "acquisition::decide, the metadata-size admission decision for one file",
        "fakes": []
      },
      "reason": "Unit check of acquisition::decide's own decision; the running-resident trigger and outcome are left to the phase 18 live gate.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Unit check of acquisition::decide's own decision; the running-resident trigger and outcome are left to the phase 18 live gate."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/acquisition-constants",
      "spec": {
        "locators": [
          "crates/cadence/src/acquisition.rs"
        ],
        "substance": "MAX_SOURCE_BYTES=16777216 and MAX_STORE_BYTES=1073741824 are enforced on metadata before every relevant acquisition, with bounded reads and revalidation for races."
      },
      "reason": "MAX_SOURCE_BYTES=16777216 and MAX_STORE_BYTES=1073741824 are enforced on metadata before every relevant acquisition, with bounded reads and revalidation for races.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "This artifact is required for T5's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/source-crossing-answers",
      "spec": {
        "locators": [
          "crates/cadence/src/read/source.rs",
          "crates/cadence/src/read/slice.rs",
          "crates/cadence/src/read/search.rs",
          "crates/cadence/src/read/list.rs",
          "crates/cadence/src/recall/documents.rs",
          "crates/cadence/src/recall/history.rs"
        ],
        "substance": "The actual {file,size,bound} crossing appears in incomplete read answers and skipped-file search/list/recall notes instead of file content."
      },
      "reason": "The actual {file,size,bound} crossing appears in incomplete read answers and skipped-file search/list/recall notes instead of file content.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "This artifact is required for T5's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/store-crossing-refusal",
      "spec": {
        "locators": [
          "crates/cadence/src/store/filesystem.rs",
          "crates/cadence/src/store/cache.rs",
          "crates/cadence/src/store/mod.rs",
          "crates/cadence/src/import/mod.rs",
          "crates/cadence/src/config/reload.rs",
          "crates/cadence/src/plan/map_view.rs"
        ],
        "substance": "Writer/open/recovery, independent cache, SessionFactory pre-open/config-observation and map-view acquisition reject oversized store files on metadata before reading/parsing, preserving file, size and bound in the refusal or map-view inconsistent-inputs answer."
      },
      "reason": "Writer/open/recovery, independent cache, SessionFactory pre-open/config-observation and map-view acquisition reject oversized store files on metadata before reading/parsing, preserving file, size and bound in the refusal or map-view inconsistent-inputs answer.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "This artifact is required for T5's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Bound every read-layer, recall and store acquisition and deliver its check

- **ID:** P17-5-T1
- **Files:** crates/cadence/src/acquisition.rs, crates/cadence/src/acquisition/tests.rs, crates/cadence/src/lib.rs, crates/cadence/src/read/source.rs, crates/cadence/src/read/slice.rs, crates/cadence/src/read/search.rs, crates/cadence/src/read/list.rs, crates/cadence/src/read/document.rs, crates/cadence/src/read/measurement.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/cache.rs, crates/cadence/src/recall/documents.rs, crates/cadence/src/recall/history.rs, crates/cadence/src/import/mod.rs, crates/cadence/src/import/tests.rs, crates/cadence/src/config/reload.rs, crates/cadence/src/plan/map_view.rs
- **Action:** Deliver acquisition_bounds_name_the_crossing red then green. Create acquisition.rs with the two named u64 constants, typed crossing {file,size,bound} and a pure metadata admission decision used by production. Keep acquisition::decide and the rest of the production unit in crates/cadence/src/acquisition.rs; declare #[cfg(test)] mod tests; there and put its tests in the tests-only crates/cadence/src/acquisition/tests.rs. T1 also writes, in acquisition/tests.rs, acquisition::tests::changed_metadata_refuses_acquired_bytes at the pure post-read identity/length judge, detecting acceptance of changed/grown files from supplied before/after values, and acquisition::tests::bounded_reader_never_requests_past_its_remaining_budget only if the capped reader owns capped-request logic: one minimal in-memory Read seam records requested lengths and returns bytes, with handwritten budget and error cases; no imitation filesystem or file-sized allocation. If the capped reader only gathers, it gets no test and T1 says so. The red commit holds lib.rs's acquisition declaration, an acquisition.rs whose decide has its final signature, compiles and does not yet meet the check, and acquisition_bounds_name_the_crossing with every other T1 test written into acquisition/tests.rs, so the red run ends in a failing test, not a build failure. Do not edit acquisition/tests.rs again before T1's completion commit. T2 may add its tests there only after T1 closes. Gather path/opened-handle metadata outside judging; preserve confinement and regular-file gates, reject oversized metadata before reading or reserving from length, cap reads at the chosen bound, and pass post-read identity/size observations to a pure revalidation decision. Route source::content and slice/current/acquire, search/list, document ROADMAP text and measurement::classify_read's project-confined source-file content through the bounded acquisition path. Leave measurement's main/subagent transcripts, correlation metadata and transcript rechecks outside MAX_SOURCE_BYTES; they are host records, not source files. An issued-reference crossing precedes stale-revision classification and returns incomplete with the triple and no body; unissued capabilities retain their refusal. Search/list retain bounded skipped-file notes and incomplete=true instead of silently discarding crossings. Apply the source bound to recall Files::text, walk observations and ARCHIVE; extend the existing ReadGit adapter with blob-size preflight and capped retained bytes, using the store bound for historical items/decisions and source bound for authored text. The blob-size query is a provided method on recall::history::ReadGit whose default body returns the length of self.blob(id), a true size at the cost of a read; the production Git adapter overrides it with a size query that loads no content, and the traversal applies the same bound decision to either answer. The test fake Answers in recall/tests.rs (:364-384) inherits the default and is neither edited nor leased; tree rows keep their three-field form (recall/history.rs:338-340). Keep Process as its program seam; do not introduce a second git launcher. Route filesystem store/recovery reads and cache state/items/decisions reads through the store gate before parse/hash/load; add the same MAX_STORE_BYTES metadata decision before every import store-input read in observe_config, guard_config and first_touch (intent, state, items and decisions), and before plan::map_view::observe reads intent/state/items/decisions. Separate store-input observation from config observation: add a provided store-input reader method to config::reload::ConfigIo whose default body delegates to self.read and keeps the existing read behavior. FileIo overrides that method with the bounded store read, preserving its absent-file, identity/stamp, regular-file and unreadable-input handling, but selecting the store class explicitly before read/reserve and using opened-handle metadata, capped acquisition and revalidation. The eight ConfigIo test implementations in config/tests.rs (two), import/tests.rs, import/routing_admission_tests.rs (two), tests/routing_records.rs, tests/config_interview.rs and tests/config_reload.rs inherit the default and are not edited for this. import/tests.rs is leased only for the new crossing-interpreter test. Keep ConfigIo's ordinary configuration reads and the existing config limits unchanged; do not apply a store cap merely because a config file has a similar basename. This reader change is why config/reload.rs is leased. import's store observation helper uses this bounded store-input route before Store::open; active.repo in the mixed partial-output loop remains config input. The map-view gate runs before its metadata-only cached branch as well as before content reads, so cached state cannot suppress a crossing; return its existing inconsistent-inputs disposition naming the actual file, size and bound rather than parsing or silently treating it as absent; preserve the crossing through the existing store::Error::Invalid string using a pure crossing formatter, without changing the error enum. Reuse existing recall incomplete aggregation and read_service forwarding; those already pass the answer through. Add independent Rust tests for each changed decision lacking adequate tests, moving I/O out first. read/slice.rs has no tests module at HEAD, so T1 creates its inline #[cfg(test)] tests module. In particular, read::slice::tests::an_issued_file_crossing_precedes_stale_revision supplies issued identity and crossing values to the production answer decision, expecting incomplete, the triple and no body. read::search::tests::a_crossing_is_named_in_an_incomplete_search tests only result assembly over supplied candidates/crossings. Neither test runs a handler or traversal. Test list, recall and store error interpretation similarly at their own units. In crates/cadence/src/import/tests.rs, owned by the binary through import/binary.rs, write import::tests::a_store_crossing_refuses_session_input against the production store-input error interpreter: a supplied acquisition crossing becomes store::Error::Invalid with the exact file/size/bound, never an absent/default input; it runs no SessionFactory workflow. Create an inline #[cfg(test)] tests module in plan/map_view.rs (none exists at HEAD) and write plan::map_view::tests::oversized_input_refuses_even_with_cached_snapshot against the extracted metadata-to-input-action decision with supplied path/class/size and cached flag: both cached and uncached observations above 1073741824 refuse with the crossing, while the exactly-at-bound observation is eligible for its appropriate metadata/content action. This detects skipping the bound on the cached branch; no file is read. Each changed parsing, validation or error decision without an adequate existing test gets a separate one-behavior test; the FileIo open/read adapter gets no unit test.
- **Verify:**
  - cargo nextest run -p cadence --lib acquisition::tests::acquisition_bounds_name_the_crossing
  - cargo nextest run -p cadence --lib acquisition::tests::changed_metadata_refuses_acquired_bytes
  - cargo nextest run -p cadence --lib read::slice::tests::an_issued_file_crossing_precedes_stale_revision
  - cargo nextest run -p cadence --lib read::search::tests::a_crossing_is_named_in_an_incomplete_search
  - cargo nextest run -p cadence --bin cadence import::tests::a_store_crossing_refuses_session_input
  - cargo nextest run -p cadence --lib plan::map_view::tests::oversized_input_refuses_even_with_cached_snapshot

### Task 2: State bounds at their acquisition boundary and audit bypasses

- **ID:** P17-5-T2
- **Files:** docs/architecture/store.md, crates/cadence/src/acquisition.rs, crates/cadence/src/acquisition/tests.rs, crates/cadence/src/read/source.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/store/cache.rs, crates/cadence/src/recall/documents.rs, crates/cadence/src/recall/history.rs, crates/cadence/src/read/document.rs, crates/cadence/src/read/measurement.rs
- **Action:** Document the two constants, crossing notes and store-open refusal separately from answer bounds and heap work. Trace every content acquisition in the leased modules, including cache hits after metadata changes, direct document reads, measurement classification of project source files (not host transcripts), historical blobs and recovery intent; the audit is executor/verifier tracing, never a source-text-scanning unit test. Preserve the exactly-at-bound source admission and existing grammar-aware outline behavior without changing parser budgets. Any acquisition test this task adds goes in crates/cadence/src/acquisition/tests.rs, after T1 closes. recall/history.rs has no tests module at HEAD, so T2 creates its inline #[cfg(test)] tests module and adds recall::history::tests::oversized_blob_metadata_refuses_content_acquisition at the production preflight judge, using supplied git size bytes so wrong size parsing or class selection cannot hide in a gatherer. If this task edits any other untested decision, write its separate one-behavior Rust test. No test starts a program or uses live clocks or existing filesystem state; a filesystem test, if needed for actual filesystem-specific owned logic, confines all access to its own fresh temporary directory and makes no sparse-file or durability assertion.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence server::recall::history::tests::oversized_blob_metadata_refuses_content_acquisition

## Notes

D-212 and D-216: MAX_SOURCE_BYTES=16*1024*1024 (16777216), MAX_STORE_BYTES=1024*1024*1024 (1073741824), checked before allocation/read and unchanged here. The store cap guards corrupt input; GH-264 remains outside this plan. Cover state.json, items.jsonl, decisions.jsonl and recovery-intent input in writer, cold-cache, SessionFactory pre-open/config-observation and map-view routes. Source acquisition includes read-layer files, recall documents, ARCHIVE, historical source blobs, document::roadmap's ROADMAP.md and measurement::classify_read's project-confined source files. Host session transcripts (~/.claude/projects/<project>/<session>.jsonl and subagent transcripts), correlation .meta.json and transcript rechecks remain outside MAX_SOURCE_BYTES. Historical items/decisions blobs use the store bound. This HEAD already supplies outline time, so no outline-module refactor is required; ReadGit is now in recall/history.rs and process acquisition uses Process, replacing the older adapter description. Drop sparse-file, /proc, resident-memory and deleted-driver assertions. Shared leases are sequential and disjoint: acquisition.rs and its lib.rs declaration belong here; existing store::Error::Invalid carries the formatted acquisition crossing without editing store/mod.rs; read/document.rs changes only document acquisition, recall/history.rs changes acquisition preflight/capping while plan 6 changes deadline registration/interpretation, existing recall/mod.rs aggregation already carries document/history incomplete notes and is left to plan 4, and store.md changes only the acquisition section. No wire names, rendered-file count or tools/list ceiling change. Replaced on 2026-09-23 so its check follows the owner's 2026-09-22 test rules in place of the context's starting check. The check proves metadata-to-read/refuse policy and the named crossing, not actual memory allocation or every assembled acquisition route; the resident's whole-file nonloading and end-to-end read/search/recall/store behavior remain unverified until the phase 18 live acceptance gate. Plan 4's import/mod.rs writer-ownership edit lands first; plan 5's store-path gate lands after it in different functions (store-input observation helpers versus writer shutdown ownership). config/reload.rs is leased only to add the provided ConfigIo store-input reader with its default body preserving existing read behavior and FileIo's bounded override, leaving configuration reads unchanged; all eight ConfigIo test implementations inherit the default without edits, and import/tests.rs is leased only for the new crossing-interpreter test. The same holds for recall::history::ReadGit's blob-size query: its default body is taken only by test implementations (recall/tests.rs's Answers), and production Git overrides it. T5 holds for the read layer, the recall corpus and store files as D-212 names them; other whole-file reads, among them those listed in GH-283, have no bound and are outside this plan.
