---
phase: 40
plan: 1
requirements: ["T1","T4"]
files: ["crates/cadence/src/read/bound.rs","crates/cadence/src/read/bound/tests.rs","crates/cadence/src/read/mod.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/location.rs","crates/cadence/src/read/search.rs","crates/cadence/src/read/search/row_tests.rs","crates/cadence/src/read/slice.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P40-1-T1","verify":["cargo nextest run -p cadence --lib read::bound::tests::answers_stay_under_the_serialized_bound","cargo nextest run -p cadence --lib read::bound::tests::room_charges_the_envelope_with_tokens_at_their_longest","cargo nextest run -p cadence --lib read::bound::tests::a_page_stops_at_the_limit_and_names_the_next_row","cargo nextest run -p cadence --lib read::bound::tests::a_row_no_page_can_hold_is_passed_and_named","cargo nextest run -p cadence --lib read::bound::tests::a_limit_over_the_maximum_is_refused_naming_it","cargo nextest run -p cadence --lib read::bound::tests::a_line_over_200_characters_is_cut_with_the_marker"]},{"id":"P40-1-T2","verify":["cargo nextest run -p cadence --lib read::search::row_tests::search_answers_rows_without_bodies"]},{"id":"P40-1-T3","verify":["cargo nextest run -p cadence --lib read::bound::tests::a_slice_body_is_cut_where_its_escaped_length_would_cross","cargo nextest run -p cadence --lib read::slice::tests::an_outline_page_resumes_at_its_first_unserved_unit"]}]}
---
## Goal

Search answers one row per matching line under a row limit, and every row page, slice and outline is admitted by its serialized bytes against the 65,536-byte answer bound, a bounded outline paging on with a cursor.

## Must be true when done

- T1. When a caller searches a pattern in a scope, the caller gets at most limit rows, one per matching line, each with its file, line number, the line's text cut at 200 characters, the enclosing unit's name and kind and an issued location for that unit (a window location where no unit encloses the line), a cursor when more remain, and no unit body.
- T4. When a read-layer answer is served, the caller gets an answer at or under 65,536 bytes as serialized, for search, symbol-search, call-search and read alike, with a row that would cross the bound moved to the next page and a slice that would cross it ended with a continuation.

## Context

At HEAD a57528fd, read at that commit. read/model.rs:19-26: SearchRequest is pattern, scope, case_insensitive and cursor with deny_unknown_fields, so a limit field is refused as read-contract by the read dispatch at server.rs:1061-1071. read/search.rs:373-391 answers each hit with a whole enclosing unit or window: file, name, kind, range, match_lines, body, body_truncated, location and file_reference, under HIT_BODY_BOUND 60,000 (:25). The renderer charges body.len(), the raw length (:383-388), serves a page's first block for whatever fits (:380-385) and never measures the serialized answer (:405-406); list.rs:54 already charges each entry's serialized length. read/slice.rs:7 holds ANSWER_BOUND 65,536; a slice reserves a fixed 512 bytes over its raw body (slice.rs:99-117) and an outline returns every row with incomplete false and continuation null (slice.rs:119-127). Helpers this plan keeps: enclosing (search.rs:188-199), file_blocks (:208-249; windows of WINDOW_CONTEXT 2 lines each side, :33, named WINDOW_NAME `(no enclosing unit)`, :37, adjacent windows merged), plan_answer (:253-275; AGGREGATE_PARSE_BUDGET 5 s, :48, timed on a supplied clock reader) and block_unit (:279-284), with their inline tests (:410-484). bounded_body (:104-109) and its test (:485-490) exist only for bodies. The cursor names the first unserved (file, line) with no revision (location.rs:16-19, :27); the registry keeps 1,024 tokens (location.rs:11). outline::Lines::text (outline/mod.rs:105) gives a line without its newline. read accepts a location alone, a file reference with a unit name, or a file reference alone (read/model.rs:46-52, slice.rs:40-47). An issued token is `<prefix>-<nonce>-<counter>` (location.rs:49) with a 16-character nonce (location.rs:42), so its widest form ends in the 20 digits of u64::MAX, which search's placeholders already assume (search.rs:357). Nothing at HEAD pins the search answer end to end; the phase 31 integration tests went with d5c13667.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/answers_stay_under_the_serialized_bound",
      "spec": {
        "command": "cargo nextest run -p cadence --lib read::bound::tests::answers_stay_under_the_serialized_bound",
        "expected": {
          "kind": "literal",
          "value": "fit(65_534, the 100 supplied rows) returns 80; fit(811, the first row alone) returns 0; fit(812, the first row alone) returns 1."
        },
        "test": {
          "file": "crates/cadence/src/read/bound/tests.rs",
          "function": "answers_stay_under_the_serialized_bound"
        },
        "setup": "One hundred identical rows, each the JSON object {text: t} where t is 50 double quotes, 50 backslashes and 100 U+0001 characters: 200 raw text bytes that escape to 800 (2, 2 and 6 bytes each), so each row serializes to 811 bytes and is charged 812 with its separator. Room 65,534 is the bound less a two-byte empty array. Derivation, by hand from D-221: 80 rows are charged 64,960 bytes and fit; 81 are charged 65,772 and do not, so the 81st row opens the next page (80 rows serialize as an array of 64,961 bytes, 81 as 65,773, past 65,536). Charged by raw length (212 per row) all 100 would be admitted. A first row is charged like any other: 812 bytes fit in 812 and not in 811. No filesystem, process or clock.",
        "call": "Call read::bound::fit(65_534, &rows), then fit(811, &rows[..1]) and fit(812, &rows[..1]), and compare each count to the handwritten value. No search, registry, walk or answer assembly runs.",
        "boundary": "read::bound::fit, the serialized-length admission every search, symbol-search and call-search page takes its rows through",
        "fakes": []
      },
      "reason": "Catches a page that charges a row's raw text length in place of its escaped serialized length (100 admitted instead of 80) and a first row served over the bound (fit(811) returning 1).",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "fit is the one admission decision behind every row page of search, symbol-search and call-search, so a row that would cross 65,536 serialized bytes goes to the next page; the served answers and the slice clause are traced through artifact/row-page-bound and artifact/slice-and-outline-bound."
        }
      ]
    },
    {
      "kind": "check",
      "id": "check/search_answers_rows_without_bodies",
      "spec": {
        "command": "cargo nextest run -p cadence --lib read::search::row_tests::search_answers_rows_without_bodies",
        "expected": {
          "kind": "literal",
          "value": "Rows in order as (file, line, text, name, kind, location target lines): (notes.txt, 1, `needle here`, `(no enclosing unit)`, window, 1-2); (notes.txt, 2, `needle` then 194 `x` then `…`, `(no enclosing unit)`, window, 1-2); (src/a.rs, 2, `    let needle = 1;`, alpha, function, 1-4); (src/a.rs, 3, `    needle`, alpha, function, 1-4); (src/a.rs, 6, `// needle outside`, `(no enclosing unit)`, window, 4-6). Each row serializes to exactly the keys file, line, text, name and kind: no body, body_truncated, range or match_lines."
        },
        "test": {
          "file": "crates/cadence/src/read/search/row_tests.rs",
          "function": "search_answers_rows_without_bodies"
        },
        "setup": "Project /x. FileHits for /x/notes.txt (no grammar), content `needle here` newline then `needle` followed by 294 `x` (a 300-character line) newline, matching lines [1, 2]; and for /x/src/a.rs, content `fn alpha() {`, `    let needle = 1;`, `    needle`, `}`, an empty line and `// needle outside`, each newline-terminated, matching lines [2, 3, 6]. The answer comes from plan_answer(&files, Duration::from_secs(5), &mut || Duration::ZERO), the existing tested helper, as supplied input: it parses a.rs with the real Rust grammar on a clock that never advances. Expected rows handwritten from D-217 and D-218: one row per matching line; the enclosing unit alpha (lines 1-4) for lines 2 and 3; a two-line window clamped to the file for line 6 (lines 4-6) and for the no-grammar file (lines 1-2, its two windows merged); line text cut at 200 characters with the marker.",
        "call": "Call read::search::rows(&files, &answer, Path::new(\"/x\")) and compare each row's file, line, text, name, kind and location target range, and serde_json::to_value of each row, to the handwritten values. No registry, walk, matcher or renderer runs.",
        "boundary": "read::search::rows, the one-row-per-matching-line construction of the search answer",
        "fakes": [
          "clock: the supplied reader || Duration::ZERO passed to plan_answer in place of outline::monotonic()"
        ]
      },
      "reason": "Catches bodies still served (a body key in a row), rows merged per unit (one row for lines 2 and 3), a stray or no-grammar line without its window location, and line text left uncut or cut without the marker.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "rows owns the shape T1 names: one row per matching line with its file, line number, text cut at 200 characters, enclosing unit name and kind, the unit or window its location is issued for, and no body; the limit and cursor clauses are the tested bound::page and bound::limit traced in artifact/search-row-answer."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/search-row-answer",
      "spec": {
        "locators": [
          "crates/cadence/src/read/search.rs",
          "crates/cadence/src/read/model.rs",
          "crates/cadence/src/read/bound.rs"
        ],
        "substance": "SearchRequest takes limit (read/model.rs). search answers status, kind search, bound 65536, limit, incomplete, cursor, rows [{file, line, text, name, kind, location}], files [{file, file_reference}] once per file, notes, matches and served; no row carries a body, HIT_BODY_BOUND and bounded_body are gone. read/bound.rs holds DEFAULT_LIMIT 50, MAX_LIMIT 200 with the invalid-limit refusal naming 200, LINE_TEXT_CHARS 200 and LINE_CUT_MARKER U+2026, tested by a_limit_over_the_maximum_is_refused_naming_it, a_line_over_200_characters_is_cut_with_the_marker and a_page_stops_at_the_limit_and_names_the_next_row. The cursor is issued at the next unserved row's (file, line) with no revision."
      },
      "reason": "The limit, the constants and the answer's wire shape are the parts of T1 the rows check does not exercise; removing the limit field, a constant or the files list breaks this artifact.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "T1 names at most limit rows and a cursor when more remain; this artifact is where the limit, its default and maximum, and the cursor issuance live."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/row-page-bound",
      "spec": {
        "locators": [
          "crates/cadence/src/read/bound.rs",
          "crates/cadence/src/read/search.rs"
        ],
        "substance": "read::bound::room, fit and page decide every search page on serialized bytes; a row that fits no empty page is passed over and named in a note, so no page is served over 65,536 serialized bytes and the cursor always advances. Placeholder tokens come from bound::longest_token and the envelope is charged through bound::room before real tokens are issued, both tested by room_charges_the_envelope_with_tokens_at_their_longest. Plan 2's symbol-search and call-search take the same page."
      },
      "reason": "Search's render must apply fit and page to every row it serves; a page assembled around them, or charged on raw length, breaks this artifact.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "T4's search clause holds only if search's served page is the one bound::page admitted; the check proves fit, this artifact traces its use."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/slice-and-outline-bound",
      "spec": {
        "locators": [
          "crates/cadence/src/read/slice.rs",
          "crates/cadence/src/read/bound.rs",
          "crates/cadence/src/read/location.rs",
          "crates/cadence/src/read/model.rs"
        ],
        "substance": "A slice ends at offset plus fit_text of its room, with its continuation, continue_from_line and continue_from_byte; the fixed 512-byte allowance is gone. An outline serves the rows outline_page admits and, when rows remain, is incomplete with a cursor at the first unserved unit (Resumes::Outline {path, unit}, the unit's ordinal stored), which the identical read with that cursor resumes; ReadRequest takes cursor. fit_text is tested by a_slice_body_is_cut_where_its_escaped_length_would_cross and outline_page by an_outline_page_resumes_at_its_first_unserved_unit."
      },
      "reason": "T4's read clause: a slice of quotes, backslashes or newlines must end before its escaped body crosses 65,536, and an outline row that would cross it must go to the next page; restoring the raw allowance or dropping the outline cursor breaks this artifact.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "T4 names read alike, a row that would cross the bound moved to the next page and a slice that would cross it ended with a continuation; this is where slice.rs applies fit_text and pages the outline with a cursor."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Add the shared row page and serialized bound, delivering answers_stay_under_the_serialized_bound red then green

- **ID:** P40-1-T1
- **Files:** crates/cadence/src/read/bound.rs, crates/cadence/src/read/bound/tests.rs, crates/cadence/src/read/mod.rs
- **Action:** Create crates/cadence/src/read/bound.rs, declared `mod bound;` in read/mod.rs: the page rules every row answer shares, with these named constants (D-224): DEFAULT_LIMIT = 50, MAX_LIMIT = 200, LINE_TEXT_CHARS = 200 and LINE_CUT_MARKER = `…` (U+2026). ANSWER_BOUND stays 65,536 at read/slice.rs:7 and bound.rs reads it there. Every function takes values and touches no filesystem, process or clock: room(envelope: &Value) -> usize, ANSWER_BOUND less the serialized length of an answer whose row slots are empty and whose tokens are at their longest; longest_token(prefix: &str) -> String, the placeholder no issued token of that prefix can exceed: the prefix, a dash, sixteen zeros, a dash and the twenty digits of u64::MAX, the widest form of location.rs:49 with its 16-character nonce (:42), used by every renderer for every placeholder token; fit(room: usize, rows: &[Value]) -> usize, how many rows from the front fit when each row, the first included, is charged its serialized JSON length plus one separator byte; page(rows: &[Value], room: usize, limit: usize) -> Page, the indices served (at most limit, admitted through fit), the indices passed over and the next unserved index, where a row that fit refuses on an empty page is passed over, never served, and the page goes on after it so the caller can name it and the cursor still advances; limit(requested: Option<NonZeroU32>) -> Result<usize, Value>, absent is DEFAULT_LIMIT, 1 through MAX_LIMIT is itself, above is refused with code `invalid-limit`, slot `limit` and a reason naming the maximum 200; line_text(line: &str) -> String, the line whole at 200 characters or fewer, otherwise its first 200 characters followed by the marker.

Declare `#[cfg(test)] mod tests;` in bound.rs so crates/cadence/src/read/bound/tests.rs is a tests-only file. Write all six of this task's tests into it and commit them before the red run: the check answers_stay_under_the_serialized_bound; room_charges_the_envelope_with_tokens_at_their_longest (longest_token("cur") is exactly `cur-0000000000000000-18446744073709551615`, 41 bytes; room over the envelope {cursor: longest_token("cur"), rows: []}, which serializes to 64 bytes, is 65,472; catches the envelope not charged (65,536 returned) and a placeholder shorter than a token the registry can issue); a_page_stops_at_the_limit_and_names_the_next_row (three rows of a few bytes, room 65,534, limit 2: indices 0 and 1 served, next 2; catches the limit ignored or a cursor at a served row); a_row_no_page_can_hold_is_passed_and_named (a row whose serialized length alone exceeds room 1,000, then a row of a few bytes: the first passed over, the second served, no next; catches a row served over the bound or a page stuck on it forever); a_limit_over_the_maximum_is_refused_naming_it (absent gives 50, 200 gives 200, 201 is refused with code invalid-limit and 200 in its reason; catches a missing default or an unbounded limit); a_line_over_200_characters_is_cut_with_the_marker (a 200-character line comes back whole; a 300-character line of `needle` then 294 `x` comes back as its first 200 characters then `…`; 201 `é` come back as 200 `é` then `…`, counted in characters, not bytes; catches a missing marker or a byte cut). The red commit also holds bound.rs with every function at its final signature, compiling, and fit returning rows.len(), so the red run ends in the check's assertion failure, not a build error. Do not edit bound/tests.rs again before this task's completion commit; P40-1-T3 adds its test only after this task closes. Then implement fit and record green.
- **Verify:**
  - cargo nextest run -p cadence --lib read::bound::tests::answers_stay_under_the_serialized_bound
  - cargo nextest run -p cadence --lib read::bound::tests::room_charges_the_envelope_with_tokens_at_their_longest
  - cargo nextest run -p cadence --lib read::bound::tests::a_page_stops_at_the_limit_and_names_the_next_row
  - cargo nextest run -p cadence --lib read::bound::tests::a_row_no_page_can_hold_is_passed_and_named
  - cargo nextest run -p cadence --lib read::bound::tests::a_limit_over_the_maximum_is_refused_naming_it
  - cargo nextest run -p cadence --lib read::bound::tests::a_line_over_200_characters_is_cut_with_the_marker

### Task 2: Answer search with rows under the limit, delivering search_answers_rows_without_bodies red then green

- **ID:** P40-1-T2
- **Files:** crates/cadence/src/read/search.rs, crates/cadence/src/read/search/row_tests.rs, crates/cadence/src/read/model.rs
- **Action:** Add limit: Option<NonZeroU32> to SearchRequest (read/model.rs:19-26), keeping deny_unknown_fields; Resumes::Search keeps pattern, scope and case_insensitive only, so a caller may change the page size and keep its cursor. In read/search.rs add Row and rows(files: &[FileHits], answer: &Answer, project: &Path) -> Vec<Row>: one row per site of the answer, in site order (path, then line), carrying the project-relative file, the 1-based line, bound::line_text of that line (outline::Lines::text), the name and kind of the site's block unit, or WINDOW_NAME and kind `window` for a window block, and as its location target the unit block_unit gives. A Row serializes to exactly file, line, text, name and kind; the renderer adds location. Make FileHits and its fields, Answer, plan_answer, rows, Row and AGGREGATE_PARSE_BUDGET pub(super) so P40-2-T2's call-search builds its rows with this same code.

Rewrite ReadDomain::render (search.rs:344-407): resolve bound::limit first, so a refused limit returns before any walk; start at the first site at or after the cursor as today (:348-353); build each row's JSON with its placeholder location from bound::longest_token and the envelope with placeholder tokens from it, charged through bound::room as :357-362 charges today's; take bound::page over them; issue a Unit location for each served row's target, a file reference once per served file, and a cursor at the next unserved row's (file, line); name each passed-over row in a note `<file>:<line>: row exceeds the answer bound`. The answer is status ok, kind search, bound 65536, limit, incomplete, cursor, rows, files (one {file, file_reference} per file, in first-row order), notes, matches (all matching lines) and served (rows served); STOPPED_NOTE, BOUNDED_NOTE, EXHAUSTED_NOTE and source::with_skipped keep their meaning. Delete HIT_BODY_BOUND (:25; 60,000 retired), bounded_body (:104-109) with its test a_body_is_cut_on_a_character_boundary (:485-490), and Block::contains if nothing else uses it; keep enclosing, file_blocks, plan_answer, block_unit and their inline tests unchanged (D-224).

Declare `#[cfg(test)] mod row_tests;` in search.rs so crates/cadence/src/read/search/row_tests.rs is a tests-only file; write the check search_answers_rows_without_bodies into it and commit it before the red run, with rows at its final signature returning an empty Vec, so the red run ends in the check's assertion failure, not a build error. Do not edit row_tests.rs again before this task's completion commit. The limit, the page, the passed-over row and the text cut are P40-1-T1's tested decisions; the renderer only applies them.
- **Verify:**
  - cargo nextest run -p cadence --lib read::search::row_tests::search_answers_rows_without_bodies

### Task 3: Hold read slices to the serialized bound and page outlines with a cursor

- **ID:** P40-1-T3
- **Files:** crates/cadence/src/read/slice.rs, crates/cadence/src/read/bound.rs, crates/cadence/src/read/bound/tests.rs, crates/cadence/src/read/location.rs, crates/cadence/src/read/model.rs
- **Action:** Add fit_text(room: usize, text: &str) -> usize to read/bound.rs: the byte length of the longest prefix of text that ends on a character boundary and whose JSON string escaping (serde_json's, without the two quotes) is at most room. In ReadDomain::slice (read/slice.rs:99-117) replace the fixed 512-byte allowance (:102-108) with bound::room over the slice answer serialized with an empty body, the continuation at bound::longest_token("loc") and continue_from_line and continue_from_byte at their largest values, then end = offset + fit_text(room, tail); a cut slice keeps its continuation location, continue_from_line and continue_from_byte exactly as today.

Outlines page, on the owner's ruling of 2026-09-23 (`outline paging`). Add outline_page(units: &[Unit], start: usize, room: usize) -> Page to read/slice.rs: it builds each unit's row {name, kind, range, location} with location at bound::longest_token("loc"), takes bound::page over the units from ordinal start with no row limit, and reports the served, passed-over and next positions as ordinals among all of the outline's units. ReadDomain::outline (:119-127) serves the rows outline_page admits within bound::room of its envelope (cursor at bound::longest_token("cur")); when a row remains, the answer is incomplete and carries a cursor at the first unserved unit and the note `outline answer was bounded; repeat the same read with this cursor to continue`, and its continuation field stays null as today. The cursor is the kind search issues: add Resumes::Outline {path, unit} to read/location.rs, bound to the file reference's path and the unit name the read named (None for a file reference alone), with no revision (the file reference already binds one), and store the first unserved unit's ordinal in Capability::Cursor's line slot, the position chosen as the owner's ruling of 2026-09-23 (`position cursor`) chooses it for symbol-search and call-search. Add cursor: Option<String> to ReadRequest (read/model.rs:46-52) and accept it in read() (slice.rs:40-47) with a file reference alone or a file reference and a unit name; ReadDomain::resume (search.rs:330-339) checks it against Resumes::Outline and refuses a mismatch as it does for search; a cursor sent with a location, or where the answer is not an outline, is refused as read-contract.

In the inline tests module of read/slice.rs add an_outline_page_resumes_at_its_first_unserved_unit: six supplied units u0 to u5, kind function, ranges [1,1] to [6,6], so each row serializes to 100 bytes and is charged 101; with room 202 and start 2, outline_page serves ordinals 2 and 3 and names next 4; with start 4 it serves 4 and 5 and names no next. It catches a cursor at a page-relative index (2 in place of 4) and a cursor issued after the last unit. After P40-1-T1 has closed, add a_slice_body_is_cut_where_its_escaped_length_would_cross to crates/cadence/src/read/bound/tests.rs: fit_text(65_000, 40,000 double quotes) is 32,500 (each quote escapes to two bytes); fit_text(13, three U+0001 characters) is 2 (each escapes to six bytes); fit_text(5, `éééé`) is 4 (two whole two-byte characters, never a split one); fit_text(10, `abc`) is 3. It catches the raw length charged in place of the escaped length and a cut inside a character. The slice and outline assembly, the outline cursor's issue and resume and token issuance run through the registry and get no further unit test; they apply fit_text, page and outline_page.
- **Verify:**
  - cargo nextest run -p cadence --lib read::bound::tests::a_slice_body_is_cut_where_its_escaped_length_would_cross
  - cargo nextest run -p cadence --lib read::slice::tests::an_outline_page_resumes_at_its_first_unserved_unit

## Notes

D-217, D-218, D-221, D-224. Order changed from the suggested one, with this reason: a row page must be bounded by some measure from its first commit. Building search's rows on raw length and replacing that three plans later would ship the known defect into symbol-search and call-search and leave T4's check nothing to turn red. So read::bound is built once here, search uses it here, and plan 2's two operations take the same page; T4's check sits on the one unit that owns the admission decision for all three row answers, and T4's slice and outline clauses land in P40-1-T3.

Owner rulings of 2026-09-23 applied here. `outline paging`: a bounded outline serves the rows that fit and issues a cursor that resumes at the first unserved unit, the way search pages, so T4's read alike is delivered as the context words it. `position cursor`: that cursor is the kind search issues, an issued token bound to its request with no revision and resumed by the server, and its stored position is the unit's ordinal among the outline's units. Search's own cursor stays (file, line).

Constants (D-224): DEFAULT_LIMIT 50, MAX_LIMIT 200 (201 and above refused with code invalid-limit naming 200), LINE_TEXT_CHARS 200 and LINE_CUT_MARKER `…` (U+2026) in read/bound.rs. Unchanged: ANSWER_BOUND 65,536 (slice.rs:7), AGGREGATE_PARSE_BUDGET 5 s, WINDOW_CONTEXT 2. Retired: HIT_BODY_BOUND 60,000 with the bodies, and the slice's fixed 512-byte allowance. Each row is charged its serialized length plus one separator byte, the first row included: a deliberately conservative rule, one byte per row. Search's cursor stays (file, line) with no revision (D-218); limit is not part of its request, so a caller may change page size between pages.

Checks. answers_stay_under_the_serialized_bound exercises read::bound::fit and catches raw-length charging (100 rows admitted instead of 80) and a first row admitted over the bound. search_answers_rows_without_bodies exercises read::search::rows and catches bodies still served, rows merged per unit, a stray line without its window, and uncut line text. Constituent tests, each one behavior on supplied values: in read/bound/tests.rs the envelope charge with tokens at their longest, the limit stop and next row, a row too large for any page, the limit refusal, the text cut and the slice's escaped cut; in read/slice.rs's inline tests the outline page resuming at its first unserved unit.

Unverified or undelivered. The renderers' token issuance, the files list once per file, the note for a passed-over row, the slice and outline assembly and the outline cursor's issue and resume are applied code with no unit test: they run through the registry, whose nonce reads the wall clock, so the verifier traces them; the envelope charge and placeholder width they use are tested. An agent following a row into read and live answers staying under the bound are phase 18's live gate. A unit whose name alone approaches 65,536 bytes can leave a slice no room for any body; not handled. docs/architecture/read-layer.md:31-33 still describes the enclosing-unit answer (P3, the owner's cleanup phase), and CONTRACT still describes hits with bodies until plan 4 rewrites it.
