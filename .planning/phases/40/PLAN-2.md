---
phase: 40
plan: 2
requirements: ["T2","T3","T4"]
files: ["crates/cadence/src/read/symbols.rs","crates/cadence/src/read/symbols/tests.rs","crates/cadence/src/read/calls.rs","crates/cadence/src/read/calls/tests.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/mod.rs","crates/cadence/src/read/location.rs","crates/cadence/src/server.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P40-2-T1","verify":["cargo nextest run -p cadence --lib read::symbols::tests::symbol_search_matches_qualified_names","cargo nextest run -p cadence --lib read::symbols::tests::files_past_a_spent_budget_are_named_not_searched","cargo nextest run -p cadence --lib read::symbols::tests::a_scan_resumes_at_its_cursor_ordinal"]},{"id":"P40-2-T2","verify":["cargo nextest run -p cadence --lib read::calls::tests::call_search_finds_syntactic_calls","cargo nextest run -p cadence --lib read::calls::tests::python_and_c_calls_match_by_last_identifier","cargo nextest run -p cadence --lib read::calls::tests::only_rust_javascript_python_and_c_files_have_a_call_grammar"]}]}
---
## Goal

symbol-search answers the outline units whose qualified name contains a fragment and call-search the syntactic calls to a name, both registered on cadence_query and paged through the shared serialized bound.

## Must be true when done

- T2. When a caller looks up a name fragment in a scope, the caller gets each outline unit whose qualified name contains the fragment, with its file, kind, line range and an issued location, at most limit rows with a cursor, and the files the outline budget did not reach named as not searched.
- T3. When a caller asks for the calls to a name in a scope, the caller gets each syntactic call whose callee's last identifier is that name, with its file, line, the line's text, the enclosing unit and an issued location, the answer stating it is syntactic and not type-resolved, and files with no call grammar counted as not searched.
- T4. When a read-layer answer is served, the caller gets an answer at or under 65,536 bytes as serialized, for search, symbol-search, call-search and read alike, with a row that would cross the bound moved to the next page and a slice that would cross it ended with a continuation.

## Context

At HEAD a57528fd, read at that commit. No symbol or call operation exists: read::Query is Search, List, Read, Document and DocumentSearch (read/mod.rs:21-28), dispatched in ReadDomain::query (read/mod.rs:45-53); cadence_query parses QueryArguments (server.rs:262; Search at :294-295) and routes the five read operations at server.rs:1061-1072. QUERY_OPERATIONS (server.rs:658-672) derives operation names and schemas from QueryArguments, and query_schema (server.rs:684) feeds the tools/list operation enum and the schema answer, so a new QueryArguments variant is the registration. help/table.rs:16-44 (COMMANDS) lists user skills, and the help operation answers from it; no help table of query operations exists at HEAD, so D-224's help-table registration has nothing to extend here and help/table.rs is not edited. Resumes has Search and List (location.rs:16-19); a cursor names (file, line) with no revision (location.rs:27). Outlines come from outline::outline (outline/mod.rs:345) per call, parse by parse (:287) under PARSE_BUDGET 500 ms (:36) and depth cap MAX_TREE_DEPTH 1024 (:52), walked by walk (:139); grammar_for_path (:227) maps c/h, js/mjs/cjs/jsx, json, md/markdown, py and rs. Rust qualifies names with `::` and names impls `impl Trait for Type` (outline/rust.rs:18, :54), JavaScript and Python with `.`, Markdown with ` > ` and keeps heading markers (outline/markdown.rs:15). Nothing caches an outline, tree or file list; the read domain keeps only the capability registry (read/mod.rs:30-43, location.rs:11). No extractor queries calls. Callee fields, read in the installed grammars' node-types.json: Rust call_expression.function (identifier, scoped_identifier with field name, field_expression with field field, generic_function with field function) and macro_invocation.macro (identifier or scoped_identifier); JavaScript call_expression.function and new_expression.constructor, member_expression.property; Python call.function, attribute.attribute; C call_expression.function, field_expression.field. Plan 1 supplies read::bound (limit, room, longest_token, fit, page, line_text) and makes search's rows, Row, FileHits with its fields, Answer, plan_answer and AGGREGATE_PARSE_BUDGET (5 s) pub(super).

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/symbol_search_matches_qualified_names",
      "spec": {
        "command": "cargo nextest run -p cadence --lib read::symbols::tests::symbol_search_matches_qualified_names",
        "expected": {
          "kind": "literal",
          "value": "Rows as (file, qualified name, kind, lines). `default`, case-sensitive: (src/limits.rs, Limits::default, function, 3-3), (src/limits.rs, defaults_off, function, 5-5), (web/app.js, Config.defaultValue, method, 2-2). `default` with case_insensitive: (docs/guide.md, `# Guide > ## Default settings`, heading, 2-3), (src/limits.rs, `impl Default for Limits`, impl, 2-4), (src/limits.rs, Limits::default, function, 3-3), (src/limits.rs, defaults_off, function, 5-5), (web/app.js, Config.defaultValue, method, 2-2). `Limits::def`, case-sensitive: (src/limits.rs, Limits::default, function, 3-3). No file unreached in any of the three."
        },
        "test": {
          "file": "crates/cadence/src/read/symbols/tests.rs",
          "function": "symbol_search_matches_qualified_names"
        },
        "setup": "Three supplied (path, content) pairs in path order, each line newline-terminated: /x/docs/guide.md `# Guide`, `## Default settings`, `text`; /x/src/limits.rs `struct Limits;`, `impl Default for Limits {`, `    fn default() -> Self { Limits }`, `}`, `fn defaults_off() {}`, `fn other() {}`; /x/web/app.js `class Config {`, `  defaultValue() { return 1; }`, `}`, `function other() {}`. start (0, 0), want 50, aggregate 5 s, clock || Duration::ZERO. Expected rows handwritten from D-219 and ruling 4: the units of Markdown, Rust and JavaScript alike whose qualified name contains the fragment, in path then outline order, case-sensitive unless the flag is set; `Limits::def` matches only through the `::` qualifier.",
        "call": "Call read::symbols::scan over the three supplied files three times (`default` case-sensitive, `default` case_insensitive, `Limits::def` case-sensitive) and compare each row's file, qualified name, kind and line range, and the unreached list, to the handwritten values. No registry, scope walk, acquisition or renderer runs.",
        "boundary": "read::symbols::scan, the per-call outline scan and qualified-name substring match behind symbol-search",
        "fakes": [
          "clock: the supplied reader || Duration::ZERO in place of outline::monotonic(), read by the parser and the budget"
        ]
      },
      "reason": "Catches bare-name-only matching (`Limits::def` finds nothing), case ignored without the flag (`impl Default for Limits` or the Default heading returned case-sensitively), a grammar's units left out (the heading or the JavaScript method missing), and units whose name lacks the fragment (other, Limits, Config) returned.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "scan decides which outline units a name fragment finds: their qualified names, case-sensitivity, all grammars, and the file, kind and line range of each; the limit, cursor, issued location and named not-searched files are traced in artifact/symbol-search-operation, the budget naming also tested by files_past_a_spent_budget_are_named_not_searched."
        }
      ]
    },
    {
      "kind": "check",
      "id": "check/call_search_finds_syntactic_calls",
      "spec": {
        "command": "cargo nextest run -p cadence --lib read::calls::tests::call_search_finds_syntactic_calls",
        "expected": {
          "kind": "literal",
          "value": "Rust with name foo: Some([3, 4, 5, 6, 7]). JavaScript with name Foo: Some([1])."
        },
        "test": {
          "file": "crates/cadence/src/read/calls/tests.rs",
          "function": "call_search_finds_syntactic_calls"
        },
        "setup": "Rust source, one line each, newline-terminated: 1 `fn foo() {}`, 2 `fn run(x: X) {`, 3 `    foo();`, 4 `    x.foo();`, 5 `    a::foo();`, 6 `    foo::<u8>();`, 7 `    foo!();`, 8 `    // foo()`, 9 `    let s = \"foo()\";`, 10 `    foobar();`, 11 `}`. JavaScript source: 1 `new Foo();`, 2 `Foo.bar();`. Expected lines handwritten from D-220 and ruling 5: the plain, method, path, generic and macro calls of foo (lines 3 to 7), and not the definition (1), the comment (8), the string (9) or foobar (10, another identifier); `new Foo()` (1) and not `Foo.bar()` (2, whose last identifier is bar).",
        "call": "Call read::calls::sites(rust, Grammar::Rust, \"foo\", &mut || Duration::ZERO) and sites(js, Grammar::JavaScript, \"Foo\", &mut || Duration::ZERO), and compare each to the handwritten lines. No registry, scope walk or renderer runs.",
        "boundary": "read::calls::sites, the syntactic callee-name match over one parsed file",
        "fakes": [
          "clock: the supplied reader || Duration::ZERO in place of outline::monotonic()"
        ]
      },
      "reason": "Catches text matching in place of syntax (the definition, comment or string line returned), a missed call form (method, path, generic, macro or new), fragment matching (foobar returned) and first-identifier matching (Foo.bar returned).",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "sites decides which syntactic calls a name finds by the callee's last identifier; each row's file, line, text, enclosing unit and location, the syntactic statement and the not-searched count are traced in artifact/call-search-operation, the call-grammar selection also tested by only_rust_javascript_python_and_c_files_have_a_call_grammar."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/symbol-search-operation",
      "spec": {
        "locators": [
          "crates/cadence/src/read/symbols.rs",
          "crates/cadence/src/read/model.rs",
          "crates/cadence/src/read/mod.rs",
          "crates/cadence/src/read/location.rs",
          "crates/cadence/src/server.rs"
        ],
        "substance": "symbol-search is a QueryArguments variant (so in QUERY_OPERATIONS, the tools/list operation enum and the schema answer) routed with the read operations; SymbolSearchRequest {name, scope, case_insensitive, limit, cursor}; the answer is status, kind symbol-search, bound, limit, incomplete, cursor, rows [{file, name, kind, range, location}], not_searched (within NOT_SEARCHED_BOUND 8,192 bytes), not_searched_total and notes; rows go through read::bound::page; the cursor resumes at (file, ordinal); outlines are built per call under AGGREGATE_PARSE_BUDGET and nothing but issued tokens is retained."
      },
      "reason": "The operation must be reachable on the wire, paged and bounded; a missing variant, route, page or not-searched list breaks this artifact.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "T2's at most limit rows with a cursor, issued locations and named not-searched files live in this wiring, which the scan check does not run."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "symbol-search answers are held to 65,536 serialized bytes only because their rows and not-searched list go through bound::page and fit."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/call-search-operation",
      "spec": {
        "locators": [
          "crates/cadence/src/read/calls.rs",
          "crates/cadence/src/read/model.rs",
          "crates/cadence/src/read/mod.rs",
          "crates/cadence/src/read/location.rs",
          "crates/cadence/src/server.rs"
        ],
        "substance": "call-search is a QueryArguments variant routed with the read operations; CallSearchRequest {name, scope, limit, cursor}; the answer is status, kind call-search, bound, limit, matching = CALL_MATCHING, incomplete, cursor, rows [{file, line, text, name, kind, location}] built by search::rows, not_searched (files with no call grammar, a failed parse or past the spent budget) and notes; rows go through read::bound::page; the cursor resumes at (file, ordinal)."
      },
      "reason": "The operation must be reachable on the wire, state it is syntactic, count what it did not search, and page through the bound; losing any of these breaks this artifact.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "T3's row fields, the answer stating it is syntactic and not type-resolved, and files with no call grammar counted as not searched live in this wiring, which the sites check does not run."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "call-search answers are held to 65,536 serialized bytes only because their rows go through bound::page and fit."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Add symbol-search, delivering symbol_search_matches_qualified_names red then green

- **ID:** P40-2-T1
- **Files:** crates/cadence/src/read/symbols.rs, crates/cadence/src/read/symbols/tests.rs, crates/cadence/src/read/model.rs, crates/cadence/src/read/mod.rs, crates/cadence/src/read/location.rs, crates/cadence/src/server.rs
- **Action:** Create crates/cadence/src/read/symbols.rs, declared `mod symbols;` in read/mod.rs, with the judging unit scan(files: &[(PathBuf, String)], name: &str, case_insensitive: bool, start: (usize, usize), want: usize, aggregate: Duration, now: &mut dyn FnMut() -> Duration) -> Scan over supplied paths and contents: it acquires nothing, and its one seam is the clock the parser and the budget read. From file index start.0 on: before each file, when the aggregate allowance is spent on now, that file and every later one are unreached; a file with no grammar has no units and is passed; otherwise its outline::outline units are matched in outline order (a failed or abandoned parse makes the file unreached), a unit matching when its qualified name contains name, compared after Unicode lowercasing of both only when case_insensitive; the first start.1 matching units of the first file are skipped; the scan stops once want rows are collected. Scan holds rows as (file index, ordinal among that file's matching units, Unit) and the unreached file indices.

Declare `#[cfg(test)] mod tests;` in symbols.rs so crates/cadence/src/read/symbols/tests.rs is a tests-only file, and commit all three of this task's tests before the red run, with scan at its final signature returning an empty Scan: the check symbol_search_matches_qualified_names; files_past_a_spent_budget_are_named_not_searched (the check's three supplied files with aggregate Duration::ZERO: no rows, file indices 0, 1 and 2 unreached; catches silent truncation); a_scan_resumes_at_its_cursor_ordinal (the check's supplied Rust file alone, name `default`, start (0, 1): the one row defaults_off at ordinal 1; catches a cursor that repeats or skips a row). Do not edit symbols/tests.rs again before this task's completion commit.

Wire the operation: SymbolSearchRequest {name, scope, case_insensitive, limit, cursor} with deny_unknown_fields in read/model.rs; Query::SymbolSearch and its arm in ReadDomain::query (read/mod.rs:45-53); Resumes::SymbolSearch {name, scope, case_insensitive} in read/location.rs, whose cursor is the kind search issues, an issued token bound to its request with no revision and resumed by the server, storing the first unserved row's file and, in Capability::Cursor's line slot, its ordinal among that file's matching units (the owner's ruling of 2026-09-23, `position cursor`); ReadDomain::symbol_search in symbols.rs: bound::limit, candidates through ReadDomain::candidates (search.rs:315-325), then, one candidate at a time from the cursor, a file with no grammar passed unread, acquisition through source::content (crossings recorded in source::Skipped) and scan over that one file with want = limit + 1 less the rows already found and the part of AGGREGATE_PARSE_BUDGET still left on outline::monotonic(), so acquisition stays outside scan and a file past the spent budget is named without being read; rows {file, name, kind, range, location} with placeholder tokens taken through bound::page, a Unit location issued per served row, and the cursor at the next unserved row or, when the budget stopped the scan, at the first unreached file with ordinal 0. The answer is status ok, kind symbol-search, bound 65536, limit, incomplete, cursor, rows, not_searched, not_searched_total and notes: not_searched lists the unreached files' project-relative paths in order, admitted through bound::fit within NOT_SEARCHED_BOUND = 8,192 bytes reserved before the rows, and not_searched_total counts them all. In server.rs add `#[serde(rename = "symbol-search")] SymbolSearch(cadence::read::model::SymbolSearchRequest)` to QueryArguments (:262) and route it with the read operations at :1061-1068. Nothing but issued tokens outlives the call (D-219).
- **Verify:**
  - cargo nextest run -p cadence --lib read::symbols::tests::symbol_search_matches_qualified_names
  - cargo nextest run -p cadence --lib read::symbols::tests::files_past_a_spent_budget_are_named_not_searched
  - cargo nextest run -p cadence --lib read::symbols::tests::a_scan_resumes_at_its_cursor_ordinal

### Task 2: Add call-search, delivering call_search_finds_syntactic_calls red then green

- **ID:** P40-2-T2
- **Files:** crates/cadence/src/read/calls.rs, crates/cadence/src/read/calls/tests.rs, crates/cadence/src/read/model.rs, crates/cadence/src/read/mod.rs, crates/cadence/src/read/location.rs, crates/cadence/src/server.rs
- **Action:** Create crates/cadence/src/read/calls.rs, declared `mod calls;` in read/mod.rs, with call_grammar(path: &Path) -> Option<Grammar> (Rust, JavaScript, Python and C through outline::grammar_for_path; Markdown, JSON and every file with no grammar have none) and the judging unit sites(content: &str, grammar: Grammar, name: &str, now: &mut dyn FnMut() -> Duration) -> Option<Vec<usize>>: parse with outline::parse under PARSE_BUDGET on now (None when the parse fails), walk the tree with outline::walk, and return the 1-based line of every call node whose callee's last identifier equals name exactly, one entry per call, in document order. The callee's last identifier: Rust call_expression.function is an identifier itself, a scoped_identifier's name, a field_expression's field, or a generic_function's function resolved again; Rust macro_invocation.macro is an identifier or a scoped_identifier's name; JavaScript call_expression.function and new_expression.constructor are an identifier or a member_expression's property; Python call.function is an identifier or an attribute's attribute; C call_expression.function is an identifier or a field_expression's field. Any other callee shape has no last identifier and never matches; definitions, comments and strings are never call nodes.

Declare `#[cfg(test)] mod tests;` in calls.rs so crates/cadence/src/read/calls/tests.rs is a tests-only file, and commit all three of this task's tests before the red run, with sites at its final signature returning Some(Vec::new()): the check call_search_finds_syntactic_calls; python_and_c_calls_match_by_last_identifier (Python lines `obj.foo()`, `foo()`, `foo_x()` for name foo give Some([1, 2]); C lines `void run(struct s *p) {`, `  foo();`, `  p->foo();`, `}` give Some([2, 3]); catches the rule applied to Rust and JavaScript only); only_rust_javascript_python_and_c_files_have_a_call_grammar (a.rs, a.js, a.py and a.c give Some; a.md, a.json and a.txt give None; catches Markdown or JSON searched for calls). Do not edit calls/tests.rs again before this task's completion commit.

Wire the operation: CallSearchRequest {name, scope, limit, cursor} with deny_unknown_fields in read/model.rs; Query::CallSearch and its arm in ReadDomain::query; Resumes::CallSearch {name, scope} in read/location.rs, its cursor the same kind storing the first unserved call's file and ordinal, under the same ruling; ReadDomain::call_search in calls.rs: bound::limit, candidates and source::content as search does; a file with no call_grammar counted in not_searched; a file whose text does not contain name passed as searched with no calls; sites under AGGREGATE_PARSE_BUDGET on outline::monotonic(), where a spent budget or a failed parse counts that file and every later file in not_searched and adds a note; rows built with search::rows over FileHits whose lines are the call lines (one entry per call), so each call row carries the file, the line, the line text cut at 200 characters with the marker, the enclosing unit's name and kind or the window, and its location target; then bound::page, a Unit location per served row and the cursor. The answer is status ok, kind call-search, bound 65536, limit, matching, incomplete, cursor, rows, not_searched (a count) and notes, with matching = CALL_MATCHING = `syntactic: calls are matched by the callee's last identifier in the syntax tree, not type-resolved`. In server.rs add `#[serde(rename = "call-search")] CallSearch(cadence::read::model::CallSearchRequest)` to QueryArguments and route it with the read operations at :1061.
- **Verify:**
  - cargo nextest run -p cadence --lib read::calls::tests::call_search_finds_syntactic_calls
  - cargo nextest run -p cadence --lib read::calls::tests::python_and_c_calls_match_by_last_identifier
  - cargo nextest run -p cadence --lib read::calls::tests::only_rust_javascript_python_and_c_files_have_a_call_grammar

## Notes

D-219, D-220, D-221, D-224. Both new operations are in one plan because they share its four wiring files (read/model.rs, read/mod.rs, read/location.rs, server.rs) in sequence and plan 1's page; each task owns its check and its tests-only file.

Constants (D-224): NOT_SEARCHED_BOUND 8,192 bytes for symbol-search's named not-searched list; CALL_MATCHING = `syntactic: calls are matched by the callee's last identifier in the syntax tree, not type-resolved`. Unchanged and shared: DEFAULT_LIMIT 50, MAX_LIMIT 200, LINE_TEXT_CHARS 200 and the marker from plan 1, AGGREGATE_PARSE_BUDGET 5 s, PARSE_BUDGET 500 ms, MAX_TREE_DEPTH 1024, ANSWER_BOUND 65,536.

Registration: HEAD has no help table of query operations (help/table.rs lists user skills), so each operation is registered as a QueryArguments variant, which puts it in QUERY_OPERATIONS, the tools/list operation enum and the schema answer; nothing is added to help/table.rs. Cursor: by the owner's ruling of 2026-09-23 (`position cursor`), D-219 and D-220's "the same limit and cursor as search" means the same kind of cursor: an issued token held in the server's registry, bound to its request, with no revision, resumed by the server. The position symbol-search and call-search store is the row's ordinal among that file's rows, since two units or two calls can share a line; search's own cursor stays (file, line). Acquisition stays outside scan: the resident reads one candidate at a time and hands scan supplied contents. Call-search skips a file whose text does not contain the name, exactly, since a call to the name must spell it; symbol-search has no such filter, because a qualified name joins segments that need not be adjacent in the source (`impl Default for Limits` from `impl<T> Default for Limits<T>`), so a project-wide symbol-search parses grammar files in path order until the page fills or the 5 s budget stops it and names the rest (the flagged assumption). A file whose parse fails is counted with the unreached files, since it was not searched.

Checks. symbol_search_matches_qualified_names exercises read::symbols::scan over supplied contents, its one seam the parser's clock, and catches bare-name-only matching, case ignored without the flag, a grammar's units left out, and non-matching units returned. call_search_finds_syntactic_calls exercises read::calls::sites and catches text matching, a missed call form, fragment matching and first-identifier matching. Constituent tests: files past a spent budget named, the cursor ordinal resume, Python and C callees, and the call-grammar selection.

Unverified or undelivered. The server routing at :1061, the schema registration, the answer assembly (limit, page, issued tokens, not_searched lists and counts, notes) are wiring with no unit test; the live answers and an agent following a row into read are phase 18's. Calls inside Rust macro arguments (assert_eq!(foo(), 1), format!, vec!) are token trees in tree-sitter-rust, not call nodes, so call-search does not find them; CALL_MATCHING says the matching is syntactic and no macro-argument reader is delivered. Call-search parses a matching file twice, once for its calls and once in plan_answer for the enclosing units, under the one aggregate budget.
