---
phase: 31
plan: 1
requirements: ["T1","T2","T3","T5"]
files: ["crates/cadence/src/read/mod.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/location.rs","crates/cadence/src/read/source.rs","crates/cadence/src/read/search.rs","crates/cadence/src/read/slice.rs","crates/cadence/src/read/outline/mod.rs","crates/cadence/src/read/outline/rust.rs","crates/cadence/src/read/outline/javascript.rs","crates/cadence/src/read/outline/markdown.rs","crates/cadence/src/read/outline/json.rs","crates/cadence/src/read/outline/c.rs","crates/cadence/src/read/NOTICE","crates/cadence/src/read_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/Cargo.toml","Cargo.lock","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/support/phase31.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-1-T1","verify":["cargo test -p cadence --test phase31_read_layer phase31_search_returns_located_units -- --exact"]},{"id":"P31-1-T2","verify":["cargo test -p cadence --test phase31_read_layer phase31_unissued_location_is_refused -- --exact"]},{"id":"P31-1-T3","verify":["cargo test -p cadence --test phase31_read_layer phase31_read_returns_exact_slice_and_continuation -- --exact"]},{"id":"P31-1-T4","verify":["cargo test -p cadence --test phase31_read_layer phase31_large_file_returns_unit_outline -- --exact"]}]}
---
# Phase 31: The read layer - Plan 1

## Goal

Searching finds the smallest useful units; following an issued location returns only its slice, with a usable continuation or outline.

## Must be true when done

- T1. When the model searches a pattern in a scope, the model gets one unit per hit with its location.
- T2. When the model reads at a location the binary handed back, the model gets exactly that slice, with where to continue when it was cut.
- T3. When the model reads at a location the binary never handed back, the model is refused with the rule named.
- T5. When a file too big to serve whole is read, the model gets an outline of its units with their line ranges.

## Context

The approved origin, bound and grammar rules are docs/architecture/read-layer.md:43 and docs/architecture/read-layer.md:60, with D-147 and D-150 at .planning/phases/31/CONTEXT.md:11 and .planning/phases/31/CONTEXT.md:18. The working-tree public enum is crates/cadence/src/server.rs:242; the actual root binding is crates/cadence/src/server.rs:428 and the resident queue is crates/cadence/src/recall/mod.rs:414. crates/cadence/src/execution_service.rs:1043 already derives the source project from the planning root.

The template thresholds are /code/excerpt/src/read.rs:25 and /code/excerpt/src/read.rs:48; unit/continuation rendering is /code/excerpt/src/read.rs:943; search containment and notes are /code/excerpt/src/search.rs:451 and /code/excerpt/src/search.rs:329. The live template has Python rather than C at /code/excerpt/src/outline.rs:204 and /code/excerpt/README.md:376. D-150's required C is therefore implemented explicitly, not claimed to be an unchanged port. Existing dependencies are crates/cadence/Cargo.toml:39 and crates/cadence/Cargo.toml:52, with regex already at crates/cadence/Cargo.toml:25. C's new dependency and generated-parser build are verified in the official [Cargo manifest](https://raw.githubusercontent.com/tree-sitter/tree-sitter-c/master/Cargo.toml) and [Rust build script](https://raw.githubusercontent.com/tree-sitter/tree-sitter-c/master/bindings/rust/build.rs).

Use the real driver at crates/cadence/tests/support/phase13.rs:22 and its public response comparison at crates/cadence/tests/support/phase13.rs:65. The native fixture publication pattern is crates/cadence/tests/support/phase13.rs:131; the existing real-binary check shape is crates/cadence/tests/phase13_verification.rs:192. All citations refer to HEAD 27c3424c8386378505502581c4f8c270f33f4069 plus its current uncommitted edits.

### Public contract carried into the next plans

SearchRequest carries a pattern and a scope enum: project, relative-directory selector, relative-glob selector, task-lease identity, or phase-documents identity, plus case handling and an issued continuation. ReadRequest carries a Location or a binary-issued FileReference with a unit name. DocumentRequest reserves a separate process identity and part selector, never a filename. PLAN-2 completes the document and named-scope variants. Each successful answer is tagged search, slice or outline and says its bound and whether another page exists; refusals are typed and located. Internal paths do not become caller address fields. There is no whole-file mode, size override, standalone excerpt server, steering hook or duplicate read log.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P31-T1-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_search_returns_located_units -- --exact",
        "expected": {
          "kind": "property",
          "value": "For src/units.rs the answer has alpha at 1-4 with match lines [2,3] and beta at 6-8 with match line [7]; each enclosing unit appears once with its exact handwritten body and a nonblank binary-issued location. untouched and ignored/out-of-scope sentinels are absent. Nested hits select the innermost unit. Rust, JavaScript, Markdown, JSON and C fixtures return their handwritten unit names/ranges. The answer declares its bound and incomplete status/cursor when cut; invalid regex gets a located typed refusal."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_search_returns_located_units"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. Use src/units.rs with alpha on lines 1-4 (needle on lines 2 and 3), beta on lines 6-8 (needle on line 7), and untouched on line 10. Give the other grammars equally small explicitly numbered functions/sections/members and add src/nested plus ignored sentinels. Handwrite the expected unit names, match lines, enclosing ranges and numbered bodies for each case. The fixture also has process records, which cannot become source-file locations.",
        "call": "Call cadence_query search with pattern needle, first a relative directory selector and then a glob selector; call case-insensitive and malformed-pattern controls in the same function. Inspect the real tool schema and structured/text answer agreement. Do not call the search module directly.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. ",
        "fakes": []
      },
      "reason": "Returning grep windows for known units, choosing the outer container, losing scoped hits or failing to issue their locations breaks the search outcome.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Returning grep windows for known units, choosing the outer container, losing scoped hits or failing to issue their locations breaks the search outcome."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P31-T3-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_unissued_location_is_refused -- --exact",
        "expected": {
          "kind": "property",
          "value": "Unknown, altered, foreign-resident and previous-resident locations yield status refused, code location-not-issued, rule D-147, and slot location, with no source bytes. Caller path/range fields are refused by the read argument contract rather than interpreted as file addresses. A valid current issued unit succeeds with its handwritten short slice; a real escape is refused without exposing outside bytes. No durable read log, process record or source file is changed."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_unissued_location_is_refused"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. Keep a searched short-unit location as the positive control. Create an unknown opaque token, mutate that control token, and obtain a token from a second real disposable project's resident. Include attempted absolute/relative path-shaped locations and extra path/start/end fields, plus a real symlink escape. Never inject entries into the issuer registry.",
        "call": "Read each unissued token over the real stdio query handler, then read the unchanged valid search location in its issuing resident. Reopen a resident and try the old resident's token; reacquire through search for the positive control. Inspect refusals and before/after fixture files.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. ",
        "fakes": []
      },
      "reason": "Accepting a token from its shape, a reversible path encoding or a content hash without an actual issuance record would let the caller originate a location.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "Accepting a token from its shape, a reversible path encoding or a content hash without an actual issuance record would let the caller originate a location."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P31-T2-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_read_returns_exact_slice_and_continuation -- --exact",
        "expected": {
          "kind": "property",
          "value": "The short answer is exactly lines 6-8, with the known text and no neighboring unit. Every cut response declares truncated true and a nonblank issued continuation for the next unserved position inside the same unit and source revision; following them yields every requested byte in order, no gaps, duplicates or neighbor bytes, and terminates with truncated false and no continuation. Its declared 65,536-byte serialized-answer limit includes metadata and notes. UTF-8 truncation preserves character boundaries and a byte-within-line continuation, never silently discards the line tail. Repeated reads return the same requested content, independent of prior calls; changed content refuses stale locations until reacquired."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_read_returns_exact_slice_and_continuation"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. Search to obtain a short-unit location and a distinct oversized-unit location. The short unit occupies interior lines 6-8; the oversized interior unit contains 2,000 identical known ASCII comment lines plus explicit first/last markers and unrelated neighbors. Include one extremely long UTF-8 line. Expected text is handwritten from these fixture literals, never obtained by parsing the response or running a production renderer.",
        "call": "Read the issued short location; read the oversized location and follow only the returned continuation objects until that unit ends. Read a unit by name using the binary-issued file reference. Repeat the original short read after the other calls. Exercise a changed source file by an actual fixture edit and reacquire its location through search.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. ",
        "fakes": []
      },
      "reason": "Incorrect bounds, served-memory subtraction or a continuation that changes unit/revision would prevent the caller from receiving exactly the requested slice.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "Incorrect bounds, served-memory subtraction or a continuation that changes unit/revision would prevent the caller from receiving exactly the requested slice."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P31-T5-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_large_file_returns_unit_outline -- --exact",
        "expected": {
          "kind": "property",
          "value": "An unshaped read above 24,576 bytes returns kind outline, no source body, and the handwritten unit names, kinds and inclusive line ranges; each row contains an issued readable location. Bounded outline pages retain every row across continuation. A selected row returns only its named unit's handwritten lines. Ambiguous names return the actual matching rows, no arbitrary body; a missing name returns bounded available-unit rows. Unsupported/failed parses explicitly label their bounded fallback slice and continuation, never answer with the file. No whole-file default exists below the threshold either."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_large_file_returns_unit_outline"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. The fixture includes files larger than 24,576 source bytes for each of the five required grammars. Put two named small units at handwritten line ranges and enough comment/whitespace padding to exceed the threshold without moving those ranges. Include a JSON member large enough to require size-based descent, a Markdown preamble and nested headings, same-bare-name code units, and a file with enough units to page its outline. Also supply unsupported syntax and a too-deep Markdown prefix as real inputs.",
        "call": "Obtain a file reference from a search hit and issue read for that reference without a unit selector. Follow only returned outline paging pointers, then read one of the returned row locations. Ask for an ambiguous and a missing name inside that same binary-named file.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. ",
        "fakes": []
      },
      "reason": "Serving a large file, omitting line ranges or printing an outline row the caller cannot read would defeat the exact follow-up promised by T5.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Serving a large file, omitting line ranges or printing an outline row the caller cannot read would defeat the exact follow-up promised by T5."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-SEARCH",
      "spec": {
        "locators": [
          "crates/cadence/src/server.rs::QueryArguments",
          "crates/cadence/src/read/model.rs::SearchRequest",
          "crates/cadence/src/read/search.rs"
        ],
        "substance": "A public cadence_query search operation with pattern, optional case-insensitive flag, typed scope and binary-issued paging cursor. Each answer declares its bound and contains enclosing-unit hits with match lines, unit name/kind, issued unit location and issued file reference, with bounded notes and continuation. Directory/glob scope is a confined selector, never an absolute address. Source searches never grant process-file reads."
      },
      "reason": "An untyped path-bearing request or an unbounded grep-shaped answer would restore the old read boundary.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The model needs typed scoped search and located units."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-LOCATION",
      "spec": {
        "locators": [
          "crates/cadence/src/read/model.rs::Location",
          "crates/cadence/src/read/location.rs",
          "crates/cadence/src/read_service.rs"
        ],
        "substance": "An opaque location backed by the issuing resident's registry: canonical bound project, internal resource identity, content revision and permitted slice or outline action. Search, legitimate located refusals, leases and outline rows issue through this one owner. A registry miss returns code location-not-issued, rule D-147 and slot location. Source paths/ranges are never deserializable location authority. Registry lifetime is resident lifetime; no read log or new persistent store is added."
      },
      "reason": "A syntactically valid or caller-derived token must not authorize a read without issuance.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "This type and named refusal enforce the approved origin rule."
        },
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "A served location must resolve to the exact retained slice."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-READ-CONTINUATION",
      "spec": {
        "locators": [
          "crates/cadence/src/read/model.rs::ReadRequest",
          "crates/cadence/src/read/model.rs::SliceAnswer",
          "crates/cadence/src/read/slice.rs"
        ],
        "substance": "Public read takes only an issued location, or an issued file reference plus a unit name. Slice answers carry the requested and served range, source revision, declared bound, explicit truncated flag, and a typed issued continuation. The visible footer says continue from line N; for a split overlong line it also identifies the within-line byte position. Continuation preserves original unit end and revision. A file reference without a selector yields orientation metadata/outline, not file content. No caller-defined start/count can widen authority and no served-memory suppression can change an identical caller's answer."
      },
      "reason": "Losing the next unserved position or widening the slice makes bounded reads incomplete or overbroad.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The read operation and continuation deliver exactly the slice it promises."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-OUTLINE-GRAMMARS",
      "spec": {
        "locators": [
          "crates/cadence/src/read/outline/",
          "crates/cadence/src/read/model.rs::OutlineAnswer",
          "crates/cadence/Cargo.toml",
          "Cargo.lock",
          "crates/cadence/src/read/NOTICE"
        ],
        "substance": "Ported Rust items/attributes, JS named definitions/exports, Markdown section/preamble tiling and size-descended JSON members; add C named function, declaration, typedef and named struct/union/enum units. An outline answer at the unchanged 24*1024 source-byte cutoff contains bounded rows of names/kinds/1-based ranges/byte sizes and issued row locations. Parser cancellation/depth bounds and the Markdown scanner guard travel with the port. The required grammar crates bring their generated C parsers and build scripts; the new direct dependency is tree-sitter-c 0.24.2, whose cc 1.2 build compiles parser.c. Existing tree-sitter, JS/MD/Rust/JSON, regex, grep-regex/searcher/matcher, ignore and globset dependencies are retained. No excerpt server, hook, installer, Python grammar expansion or served-memory diff machinery is copied."
      },
      "reason": "Missing grammars, their native parser build or actionable outline rows would turn a large structured source into a blind file dump.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "These grammars and outline answer provide the promised large-file orientation."
        },
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Search needs the same enclosing-unit grammars."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P31-L-ISSUED-LOCATION",
      "spec": {
        "caller": "search/refusal/lease/outline answer",
        "callee": "read request",
        "value": "a location the binary handed back"
      },
      "reason": "Losing or rewriting the issued location between response and follow-up breaks the read capability handoff.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The trigger explicitly names a location the binary handed back; the same issued value crosses to read."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Find scoped matches as real located units

- **ID:** P31-1-T1
- **Files:** crates/cadence/src/read/mod.rs, crates/cadence/src/read/model.rs, crates/cadence/src/read/location.rs, crates/cadence/src/read/source.rs, crates/cadence/src/read/search.rs, crates/cadence/src/read/slice.rs, crates/cadence/src/read/outline/mod.rs, crates/cadence/src/read/outline/rust.rs, crates/cadence/src/read/outline/javascript.rs, crates/cadence/src/read/outline/markdown.rs, crates/cadence/src/read/outline/json.rs, crates/cadence/src/read/outline/c.rs, crates/cadence/src/read/NOTICE, crates/cadence/src/read_service.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/Cargo.toml, Cargo.lock, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31.rs.
- **Action:** Deliver P31-T1-C and P31-A-SEARCH, with the shared source/grammar/issuer foundations of P31-A-OUTLINE-GRAMMARS and P31-A-LOCATION. Write the complete T1 function first and record red, then port only the production behavior needed from excerpt. Place the module tree under src/read/ because all three queries will share one read domain while transport stays in read_service.rs and the existing server/resident. Register the strict search/read/document argument variants and answer types on cadence_query; a not-yet-delivered arm must refuse explicitly rather than fabricate success. Wire search through the resident to blocking filesystem/parser work, rooted at the bound project's parent of .planning. Keep the domain independent of MCP and tokio.

Port the enclosing-smallest-span selection, one body per matched unit with all hit lines retained, sorted stable traversal, relative directory/glob filtering with literal_separator(true), ignore rules, no followed symlink loops, and at most three detailed notes plus an omitted count. Constrain the complete serialized answer, hit metadata, names and notes as well as bodies; page remaining hits with an issued query-bound cursor rather than excerpt's path:line offset. Do not spawn rg or any second server. Confine candidates after canonicalization and refuse absolute/parent-escaping selectors. Reserve the process tree for PLAN-2's identity resolver; never expose a raw process-file location. Unknown grammars use explicitly labelled bounded windows.

Port the four matching grammar extractors unchanged in their unit rules, iterative depth ceiling, 500ms per-parse cancellation, five-second aggregate search budget and Markdown scanner guard. Add C extraction using the official C grammar's named nodes and declarators. Add tree-sitter-c = 0.24.2 to Cargo.toml and update the workspace Cargo.lock without disturbing its existing edits; all other needed parser, regex, ignore and globset crates already exist in the live manifest. Preserve upstream MIT attribution in read/NOTICE. Grammar crates include generated parser C and their cc builds, so the narrow integration test must link and exercise them; no generated parser or runtime tool is assumed to exist outside the dependency. Complete green for the same T1 function before task 2.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_search_returns_located_units -- --exact.

### Task 2: Accept only locations the resident actually issued

- **ID:** P31-1-T2
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/location.rs, crates/cadence/src/read/source.rs, crates/cadence/src/read/slice.rs, crates/cadence/src/read_service.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31.rs.
- **Action:** Deliver P31-T3-C and the completed P31-A-LOCATION. Write the entire T3 function red first; then implement registry membership before any source read, the exact D-147 refusal, and the short-slice valid control. Derive the internal resource and range only from an issuance record, never by decoding a path-shaped token or accepting a deterministic digest as proof of issuance. Reject malformed extra address/range fields at the typed boundary. Share issuance state across handler clones; partition by resident and bound canonical project, and fail old tokens after restart. Bind tokens to observed source revision; reject stale or escaped targets on reobservation. Add the reusable issuer entrypoints for real located refusals and leases; only an internally resolved in-project target can mint one. A malformed invented path must not be rewarded with a valid capability. Keep registry size bounded with explicit expiration/reacquisition, without storing reads on disk. Finish with the same test green and a valid issued read succeeding.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_unissued_location_is_refused -- --exact.

### Task 3: Return the exact bounded slice and its next position

- **ID:** P31-1-T3
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/slice.rs, crates/cadence/src/read/location.rs, crates/cadence/src/read/source.rs, crates/cadence/src/read_service.rs, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31.rs.
- **Action:** Deliver P31-T2-C, P31-A-READ-CONTINUATION and P31-L-ISSUED-LOCATION. Write the full T2 check red before adding continued reads. Budget numbered text, the full serialized envelope, metadata and footer together at 65,536 bytes; never rely on a body-only budget. Preserve CRLF/source line numbering and UTF-8 boundaries. A cut slice mints the next cursor for the first unsent position, keeping its original resource revision and upper bound; split exceptionally long lines with an explicit within-line byte continuation. The last page cannot continue into an adjacent unit. Copy the footer's continue-from-line meaning into typed data so no caller computes a path, start or end. Drop excerpt's session-memory subtraction and diff rekey machinery: read means exactly this slice, and main/worker equality cannot depend on who read it first. Repeated identical requests give identical content; source changes produce a located stale refusal and a route to reacquire. Whole-resource references give orientation metadata until task 4's outline, never a whole-file response. Finish the unchanged test green.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_read_returns_exact_slice_and_continuation -- --exact.

### Task 4: Make oversized files navigable through outline rows

- **ID:** P31-1-T4
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/outline/mod.rs, crates/cadence/src/read/outline/rust.rs, crates/cadence/src/read/outline/javascript.rs, crates/cadence/src/read/outline/markdown.rs, crates/cadence/src/read/outline/json.rs, crates/cadence/src/read/outline/c.rs, crates/cadence/src/read/slice.rs, crates/cadence/src/read/location.rs, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31.rs.
- **Action:** Deliver P31-T5-C and finish P31-A-OUTLINE-GRAMMARS. Write T5 red before implementing public outline replies. Preserve the exact >24*1024 source-byte trigger and the ported unit naming/range rules. Return actionable rows and no source body for a large parsed file. Bound and page the row list itself, issuing a continuation for omitted rows; every listed unit gets a registry-backed location. Resolve exact qualified names first, then unambiguous bare names; ambiguity yields matching rows, a missing name yields available rows. A name cannot authorize a file that the resident has not already named. Unknown extension, canceled/deep parse or no units has an explicitly labelled bounded partial fallback and issued continuation, never excerpt's whole-file fallback. A root-spanning unit/reference is subdivided or outlined so it cannot smuggle the complete file as a unit. Retain parser limits without making elapsed time an expected-value oracle. Run the exact T5 function to green and then close this plan with the declared suite once.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_large_file_returns_unit_outline -- --exact.

## Notes

Run these plans strictly in returned target order, one executor dispatch at a time. A later plan extends the committed result of its predecessor. Shared integration files are declared sequential extension leases, not competing implementations: PLAN-1 owns source operations and location issuance; PLAN-2 owns document resolution and named-scope integration; PLAN-3 owns instruction/host exposure; PLAN-4 owns measurement. In the shared test file each plan owns only its named functions; do not rewrite an earlier check's oracle or recorded red/green material. New module and test names are creation specifications, not assertions that those files/functions exist today.

Each task delivering a check writes that complete function first, runs its exact command, records the actual failing-test commit, implements, reruns the same command with unchanged test material, and records its passing commit under that task id. Inspect the red cause: missing credentials, missing host executables, transport setup failure or a skipped test is not a behavioral red. One check per truth, no observation items and no extra acceptance regressions. Existing regressions may be adapted to intentional public-shape changes without replacing the seven truth checks. Run only task verify commands while working; the executor runs the frontmatter suite once at plan close. Planning neither runs nor certifies any command.

All reads stay inside the bound project or a specifically resolved host record; no caller path field, no caller-created source range, no whole-file response or generic process-file fallback. A relative directory/glob in search is only the scoped filter explicitly retained by read-layer.md, never a read address. Process identities must never reveal storage paths in metadata, cursors, errors or wrapper output. The executor may write source and tests with edit tools. Existing native approvals, publication records, occurrence rules, admission, check history and verification stay authoritative. Typed authoring and digest-only publication changes belong to phase 32; dispatch-payload replacement and execution reporting belong to phase 33.
