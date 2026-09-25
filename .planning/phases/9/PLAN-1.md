---
phase: 9
plan: 1
requirements:
  - AC27
  - AC28
  - AC84
  - AC85
  - AC86
  - AC87
  - AC88
  - AC89
  - AC90
  - AC91
  - AC92
  - AC93
  - AC94
  - AC95
  - AC96
  - AC97
  - AC98
  - AC99
  - AC100
  - AC101
  - AC102
  - AC103
  - AC104
  - AC105
  - AC106
  - AC107
  - AC111
  - AC112
  - AC113
  - AC114
  - AC115
  - AC116
  - AC117
files:
  - crates/cadence/src/review/model.rs
  - crates/cadence/src/review/io.rs
  - crates/cadence/src/review/contract.rs
  - crates/cadence/tests/phase9_contract.rs
  - crates/cadence/tests/fixtures/phase9/h4-shapes.json
  - docs/architecture/review-records.md
  - crates/cadence/tests/fixtures/phase9/h4-scalars.json
  - crates/cadence/src/review/stream.rs
  - crates/cadence/tests/phase9_stream.rs
  - crates/cadence/tests/fixtures/phase9/h4-stream.json
---

# Phase 9: Bounded findings and shared record contracts - Plan 1

## Goal

Define the versioned H1–H5 data vocabulary and implement H4-1 admission without changing original strings or accepting an unbounded return.

## Must be true when done

- Define records and validate the findings envelope: the independent criteria mapped to P9-1-T1 return their literal specified values.
- Enforce scalar text and integer line limits: the independent criteria mapped to P9-1-T2 return their literal specified values.
- Bound raw input before parsing: the independent criteria mapped to P9-1-T3 return their literal specified values.

## Context

D-63 and HANDOFF H4 are the validator specification. F, Q and H in CONTEXT are independent input fixtures. All criteria remain pending until the named production functions exist and their direct tests pass.

## Tasks

### Task 1: Define records and validate the findings envelope (P9-1-T1)

- **Files:** `crates/cadence/src/review/model.rs`, `crates/cadence/src/review/io.rs`, `crates/cadence/src/review/contract.rs`, `crates/cadence/tests/phase9_contract.rs`, `crates/cadence/tests/fixtures/phase9/h4-shapes.json`, `docs/architecture/review-records.md`
- **Action:** Create the shared, versioned model and H4-1 validator. Define every H1–H5 field now: saved admission/replay identity and scope/home, policy/routing evidence, roster and completion rule, material entries/sides/line maps, attempt/view and host bindings, immutable original IDs and citation sidecars, observations/usage, deferred references, and typed consumer views/revisions. Explicit nulls distinguish unknown and not-applicable from empty values. Preserve the exact H admission and schema review-1 / interpretation H1-H5 / validator H4-1; do not infer fields from current settings. Model specialist targets and panel/fallback outcomes as well as ordinary reviews. Document the schemas and the interfaces consumed by Plans 2–6 in review-records.md.

  Implement classify_return and validate_findings over supplied bytes. Missing bytes and malformed JSON have distinct failure reasons; usable empty arrays succeed. Admit only the findings envelope and the five ordinary fields, at most 100 findings, the four stated severities and required failure_scenario. Reject unknown envelope/finding fields and preserve array order. Validate shape, never finding truth or settlement. Keep raw bytes separate from parsed values. Define filesystem/material acquisition, fixed Git-observation and clock seams in io.rs; use the existing store::Storage seam for transactional persistence rather than mocking Store or internal validators. Define only real I/O boundaries, with production adapters where the consuming plan implements acquisition. Hand-author h4-shapes.json with empty/full-count, missing/malformed, extra-field and severity cases, without using production serialization for expected values. Add direct tests with the envelope_ prefix in phase9_contract.rs. No new dependency is needed.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_contract envelope_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC27: Given missing bytes, `classify_return` returns `{"state":"failed", "reason":"missing-return"}`. Boundaries: none.

  AC28: Given bytes `{"findings":`, `classify_return` returns `{"state":"failed", "reason":"malformed-return"}`. Boundaries: none.

  AC84: Given bytes `{"findings":[]}`, `validate_findings` returns `{"findings":[]}`. Boundaries: none.

  AC85: Given 100 copies of F in a findings envelope, `validate_findings` returns `findings.length = 100`. Boundaries: none.

  AC103: Given 101 copies of F, `validate_findings` returns `{"code":"too-many-findings", "limit":100, "actual":101}`. Boundaries: none.

  AC104: Given an empty envelope with extra field `extra`, `validate_findings` returns `{"code":"unknown-field", "field":"extra"}`. Boundaries: none.

  AC105: Given F with extra field `fix`, `validate_findings` returns `{"code":"unknown-field", "index":0, "field":"fix"}`. Boundaries: none.

  AC112: Given F with severity `blocker`, `validate_findings` returns `findings[0].severity = "blocker"`. Boundaries: none.

  AC113: Given F with severity `high`, `validate_findings` returns `findings[0].severity = "high"`. Boundaries: none.

  AC114: Given F with severity `medium`, `validate_findings` returns `findings[0].severity = "medium"`. Boundaries: none.

  AC115: Given F with severity `low`, `validate_findings` returns `findings[0].severity = "low"`. Boundaries: none.

  AC116: Given F with severity `critical`, `validate_findings` returns `{"code":"invalid-severity", "index":0, "field":"severity", "actual":"critical"}`. Boundaries: none.

  AC117: Given F without failure_scenario, `validate_findings` returns `{"code":"missing-field", "index":0, "field":"failure_scenario"}`. Boundaries: none.

### Task 2: Enforce scalar text and integer line limits (P9-1-T2)

- **Files:** `crates/cadence/src/review/contract.rs`, `crates/cadence/tests/phase9_contract.rs`, `crates/cadence/tests/fixtures/phase9/h4-scalars.json`
- **Action:** Complete validate_findings text and line checks in the same production validator. Count Unicode scalar values, not UTF-8 bytes; accept the boundary lengths and reject the first excess scalar. Reject empty and whitespace-only file, claim and failure_scenario without trimming accepted strings. Require integer line 1..9007199254740991, preserving the maximum exactly and rejecting fractional numbers.

  Preserve enough JSON token/field location information to report the lone escaped surrogate in claim as invalid-unicode-scalar at index 0, field claim; do not let a generic JSON parser error erase this required diagnostic or replace invalid scalars. Use a bounded field-aware lexical check with the real JSON parser, not a replacement parser for the whole format. Hand-author h4-scalars.json with literal escaped invalid input and scalar/line cases. Repeated-character fixture inputs may be constructed from the literal character and count in the criterion; expected results remain literal. Add direct scalars_ tests after implementation.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_contract scalars_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC86: Given F with `file` containing exactly 1024 copies of `雪`, `validate_findings` returns `accepted = true`. Boundaries: none.

  AC87: Given F with `file` containing 1025 copies of `雪`, `validate_findings` returns `{"code":"field-too-long", "index":0, "field":"file", "limit":1024}`. Boundaries: none.

  AC88: Given F with `file` equal to empty string, `validate_findings` returns `{"code":"blank-field", "index":0, "field":"file"}`. Boundaries: none.

  AC89: Given F with `file` equal to string ` \t\n`, `validate_findings` returns `{"code":"blank-field", "index":0, "field":"file"}`. Boundaries: none.

  AC90: Given F with `claim` containing exactly 2000 copies of `雪`, `validate_findings` returns `accepted = true`. Boundaries: none.

  AC91: Given F with `claim` containing 2001 copies of `雪`, `validate_findings` returns `{"code":"field-too-long", "index":0, "field":"claim", "limit":2000}`. Boundaries: none.

  AC92: Given F with `claim` equal to empty string, `validate_findings` returns `{"code":"blank-field", "index":0, "field":"claim"}`. Boundaries: none.

  AC93: Given F with `claim` equal to string ` \t\n`, `validate_findings` returns `{"code":"blank-field", "index":0, "field":"claim"}`. Boundaries: none.

  AC94: Given F with `failure_scenario` containing exactly 2000 copies of `雪`, `validate_findings` returns `accepted = true`. Boundaries: none.

  AC95: Given F with `failure_scenario` containing 2001 copies of `雪`, `validate_findings` returns `{"code":"field-too-long", "index":0, "field":"failure_scenario", "limit":2000}`. Boundaries: none.

  AC96: Given F with `failure_scenario` equal to empty string, `validate_findings` returns `{"code":"blank-field", "index":0, "field":"failure_scenario"}`. Boundaries: none.

  AC97: Given F with `failure_scenario` equal to string ` \t\n`, `validate_findings` returns `{"code":"blank-field", "index":0, "field":"failure_scenario"}`. Boundaries: none.

  AC98: Given F with line `1`, `validate_findings` returns `findings[0].line = 1`. Boundaries: none.

  AC99: Given F with line `9007199254740991`, `validate_findings` returns `findings[0].line = 9007199254740991`. Boundaries: none.

  AC100: Given F with line `0`, `validate_findings` returns `{"code":"invalid-line", "index":0, "field":"line", "min":1, "max":9007199254740991}`. Boundaries: none.

  AC101: Given F with line `1.5`, `validate_findings` returns `{"code":"invalid-line", "index":0, "field":"line", "min":1, "max":9007199254740991}`. Boundaries: none.

  AC102: Given F with line `9007199254740992`, `validate_findings` returns `{"code":"invalid-line", "index":0, "field":"line", "min":1, "max":9007199254740991}`. Boundaries: none.

  AC106: Given JSON claim containing lone escaped surrogate `\uD800`, `validate_findings` returns `{"code":"invalid-unicode-scalar", "index":0, "field":"claim"}`. Boundaries: none.

### Task 3: Bound raw input before parsing (P9-1-T3)

- **Files:** `crates/cadence/src/review/stream.rs`, `crates/cadence/tests/phase9_stream.rs`, `crates/cadence/tests/fixtures/phase9/h4-stream.json`
- **Action:** Implement read_return over an input stream with an explicit byte cap. Stop accumulation at cap plus one and refuse excess before parsing, without truncating a return into apparent success. At the exact cap, retain all bytes including JSON whitespace. The production cap is 4 MiB under H4; tests supply it explicitly. Hand-author the stream fixture description (literal empty envelope, whitespace padding and fixed chunk sizes), construct only these literal bytes in the test and compare the stated accepted count/error. The stream stub is the only boundary for these tests. Add stream_ tests that call read_return directly; never launch or call a reviewer.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_stream stream_` — Each assertion below calls its named unit directly on an independent input. All must hold:

  AC107: Given 4,194,305 input bytes with a 4,194,304-byte cap, `read_return` returns `{"code":"return-too-large", "limit":4194304}`. Boundaries: input stream: fixed chunks, stop at cap plus one; no model call.

  AC111: Given a valid JSON findings envelope padded with JSON whitespace to 4,194,304 bytes and cap 4,194,304, `read_return` returns `accepted_bytes = 4194304`. Boundaries: input stream: fixed chunks.

## Requirements mapping

| Requirement | Implementing task |
|---|---|
| AC27 | P9-1-T1 |
| AC28 | P9-1-T1 |
| AC84 | P9-1-T1 |
| AC85 | P9-1-T1 |
| AC103 | P9-1-T1 |
| AC104 | P9-1-T1 |
| AC105 | P9-1-T1 |
| AC112 | P9-1-T1 |
| AC113 | P9-1-T1 |
| AC114 | P9-1-T1 |
| AC115 | P9-1-T1 |
| AC116 | P9-1-T1 |
| AC117 | P9-1-T1 |
| AC86 | P9-1-T2 |
| AC87 | P9-1-T2 |
| AC88 | P9-1-T2 |
| AC89 | P9-1-T2 |
| AC90 | P9-1-T2 |
| AC91 | P9-1-T2 |
| AC92 | P9-1-T2 |
| AC93 | P9-1-T2 |
| AC94 | P9-1-T2 |
| AC95 | P9-1-T2 |
| AC96 | P9-1-T2 |
| AC97 | P9-1-T2 |
| AC98 | P9-1-T2 |
| AC99 | P9-1-T2 |
| AC100 | P9-1-T2 |
| AC101 | P9-1-T2 |
| AC102 | P9-1-T2 |
| AC106 | P9-1-T2 |
| AC107 | P9-1-T3 |
| AC111 | P9-1-T3 |

## Notes

Run first. This plan supplies the complete shared model and boundary vocabulary; later plans consume these files read-only. It does not register a partial review subsystem in lib.rs. The exact source compilation arrangement described below lets this increment build and run its own targets before final production registration. No Cargo.toml or Cargo.lock edit is planned.

All paths in each task's Files line are exact write leases; their union is the frontmatter files list. Read-only prerequisites and references are not leased. Keep fixture helpers embedded in the owning test target; no shared test helper, generated snapshot, source re-export or fixture path is implicitly writable. No manifest/lockfile or frozen cadence-core edit is planned.

Compilation without overlapping leases: Plans 1–5 implement source files under src/review and compile those actual files using explicit #[path = "../src/review/<module>.rs"] declarations at the root of their own integration-test targets. Declare only existing prerequisite sibling modules there, with sibling imports through super::<module> and existing library imports through cadence::<module>. For private units, put assertions in a child test module of the owning source and select its named test prefix through the same target. Do not create public APIs solely for tests or replace missing production code with test implementations. Plan 6 alone creates src/review/mod.rs and registers the identical module graph in lib.rs; earlier targets remain valid without edits. This is direct compilation of production code, not a suite-inventory or workflow harness. New public visibility is for production sibling/service consumers only.

Each Verify command is an instruction for later implementation execution, from the repository root; none is run during plan authoring. Prefix each direct test name with the listed selector. Each criterion below is a separate invocation on its own hand-authored input; do not chain the assertions into a scenario. Use only its named boundary stubs, call deterministic internals for real, and keep literal expected values independent of production serializers. No model call, live host, cargo regression sweep, concurrency scheduling exercise or manual-checklist substitute belongs to these verifies. AC50, AC51 and AC83 use deterministic filesystem commit schedules, not live races. Keep unimplemented criteria pending until their production unit and direct test exist.

Numeric order is mandatory even though the exact file leases do not overlap. Dependencies live only in these Notes. The rewritten AC1–AC150 numbering is authoritative; former AC numbers in CONTEXT/HANDOFF are historical. MANUAL.md is read-only and none of its items is implemented or discharged by a plan verify. Independently authored fixture files are implementation deliverables for phase 10, not proof of the manual native producer episode.
