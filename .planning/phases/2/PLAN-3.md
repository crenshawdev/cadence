---
phase: 2
plan: 3
requirements:
  - HAR-05
  - HAR-06
  - HAR-07
files:
  - crates/cadence/Cargo.toml
  - Cargo.lock
  - crates/cadence/src/envelope.rs
  - crates/cadence/tests/golden.rs
---

# Phase 2: The golden harness - Plan 3 (the Rust comparison side)

## Goal

This plan must not be dispatched until plans 1 and 2 have landed: it reads the
recordings, the manifest and the `normalization.json` that plan 2 commits.

Parity against `v3.7.12` is a test that runs, not a claim. This plan builds the
Rust half of the instrument: the envelope gains the machine `code` the goldens
compare, and an integration test loads every recording plans 1 and 2 committed,
applies the committed normalization rules to an answer, compares it against a
recording field-by-field on decision-bearing keys, and accounts for every
recording by name as compared or pending. It runs after plans 1 and 2
(sequential: it reads what they wrote). The binary implements none of the
recorded operations yet, so this plan proves the comparison can FAIL - a
harness green while comparing nothing is the false green the phase exists to
prevent - and it must not be read as any parity claim.

## Must be true when done

- `cargo test --locked` at the repo root passes, and `cargo tree -e normal`
  for the `cadence` package lists neither `insta` nor `tempfile` while the dev
  edge lists both, plus `regex`, which the normal graph already carries through
  `tree-sitter`.
- A `refused`, `unknown` or `not-applicable` envelope serializes as
  `{"status":"<tag>","code":"<kebab-token>","reason":"<prose>"}`, and a
  `refused` envelope through rmcp's structured-output path is still a
  successful call whose structured content carries the `code`.
- `cargo test --locked --test golden -- --nocapture` prints the number of
  recordings loaded, and that number equals `ls crates/cadence/tests/golden/recordings/*.json | wc -l`;
  a corrupted copy of one recording makes the loader fail naming that file, and
  so does a copy of `normalization.json` with one rule's `target` misspelled.
- Comparing the `replay-check` recording against its own recorded answer
  passes, and comparing it against a copy with `replay` flipped fails with
  output that names `replay`; the failure path renders through insta.
- An answer that differs from the `trace append` recording only inside the
  field its rule names (a real instant where the recording carries `<NOW>`)
  passes; an answer that differs in one other byte of the same file fails
  naming `files[.planning/trace.jsonl]`; and an answer whose SEEDED trace line
  carries a different instant fails too, because a rule never touches a line
  the pre-run tree already had.
- The golden test prints `compared=0` and `pending=<N>` with N equal to the
  recording count, and a temp copy of the golden directory with one recording
  removed, or one extra recording added, fails naming the odd file; an
  activation for an unrecorded operation, or a projection entry that names no
  key, fails the walk by operation name.
- No test under `crates/cadence/tests/` spawns `node`.

## Context

- Locked: D-04 the three non-`ok` arms gain a MACHINE `code` beside `reason`
  and goldens compare the code, never the arm tag alone; D-05 the Rust test
  diffs COMMITTED recordings and never shells out to `node` (the `cargo-test`
  CI job has no Node setup step); D-06 parity is asserted field-by-field on the
  decision-bearing keys - AMENDED 2026-09-06 to the SEVEN that a committed
  recording actually carries: `replay`, `dispatch_set`, `overlaps`,
  `frontmatter_issues`, `parallelSafe`, derived phase `status` and
  `cursor.agrees`. `drift` was struck as never being an envelope field at all,
  and `undeclared` as real but unreached by any recorded invocation; see the
  amendment under D-06 in CONTEXT - never as a byte-diff of the JavaScript envelope,
  with write-side file bytes the exception that IS byte-diffed (D-08); D-15
  `insta` and `tempfile` are DEV-dependencies only, so the shipped binary and
  phase 19's checksum reproducibility are untouched.
- Plans 1 and 2's recording contract, binding here: `crates/cadence/tests/golden/operations.json`
  is an array of 156 invocations. **Read the committed file for its schema
  before writing the struct** - it carries ELEVEN distinct keys, not the seven
  an earlier draft of this plan listed: `invocation`, `operation`, `bundle`,
  `script`, `argv`, `git`, and the optional `stdin`, `setup`, `offline`,
  `global_config` and `refusal_source`. With `deny_unknown_fields` (Task 3) the
  four that draft omitted would fail the loader on the FIRST entry, so the typed
  struct must model every key present, marking absent-on-some-entries ones
  optional. Verify the list against the file rather than trusting this sentence;
  each
  `crates/cadence/tests/golden/recordings/<invocation>.json` has exactly the
  thirteen top-level keys `invocation`, `operation`, `bundle`, `script`, `argv`,
  `stdin`, `env`, `node` (the interpreter major that recorded it, a decimal
  string), `exit`, `stdout` (parsed envelope object or null), `stderr`, `files`
  (relative path to post-run text, already normalized), `deleted`; bundles live
  under `crates/cadence/tests/golden/fixtures/<bundle>/`. A JavaScript refusal
  is USUALLY `stdout.ok == false` with `stdout.reason` the machine code - but
  NOT always, and Task 5 carries the fourth comparison branch this needs: the
  hook family answers with no `ok` key at all. `git-guard-refused.json` is
  `exit: 0` with `stdout.hookSpecificOutput.permissionDecision` equal to
  `deny`, while `git-guard-ok.json` is `stdout: null`. Check the shape rather
  than assuming `ok` is present.
- The normalization contract, fixed by plan 2 Task 3 and binding here:
  `crates/cadence/tests/golden/normalization.json` is
  `{"mechanism":"named-fields","rules":[...]}`; each rule carries `id`,
  `target` (`file` or `stdout`), `path_suffix` (a `file` rule: matched against
  the END of the fixture-relative path) or `key` (a `stdout` rule: a dotted path
  into the parsed envelope), `pattern` (a regular expression written in the
  dialect subset JavaScript's `RegExp` and the `regex` crate share - literals,
  `\.`, `[...]`, `^`, `$` and the quantifiers `+`, `*`, `?`, `{n}` and
  `{n,m}`; `\d` is BANNED in favour of `[0-9]`, because this crate reads `\d`
  as Unicode `Nd` while JavaScript reads it as ASCII; no lookaround, no backreferences, and no inline flags - the pattern
  string carries no flags and each side supplies globality itself, the recorder
  with `new RegExp(pattern, 'g')` and this side with `Regex::replace_all`, so
  the two never disagree on whether a second match on a line is normalized),
  `replace` (literal text with no group references and never containing `$`,
  carrying `<NOW>` for an ISO-8601 instant or `<TODAY>` for a day stamp; this
  side applies it through `regex::NoExpand`, because `replace_all` would
  otherwise EXPAND a `$name` that JavaScript's `replace` leaves alone) and `site` (the frozen
  source line that writes the value). Semantics: a `stdout` rule replaces every
  match in the string at `key` and is a no-op when the key is absent or not a
  string; a `file` rule applies to every `files` entry whose path ends with
  `path_suffix`, line by line after splitting on `\n`, SKIPPING each line that
  appears verbatim ANYWHERE in the pre-run copy of the TREE (the union across
  every path, never the same path alone), replacing every match in
  the remaining lines, and rejoining with `\n`. The recorder applied these to
  the recordings; this plan applies the same rules to the ANSWER so the two
  sides meet on the token.
- The path contract, the OTHER half of the same agreement (plan 1 Task 2, plan 2
  Task 3): before any rule runs, the recorder substituted `<FIXTURE>` for the
  scratch root and `<REPO>` for the repository root throughout the envelope,
  stderr, refusal `detail` strings and the captured file bytes. This side must
  do the same to the ANSWER, IN THE SAME ORDER - substitute the two roots FIRST,
  then apply the rules - because a real answer comes back carrying the live
  `TempDir` path where the recording carries `<FIXTURE>`, and no comparison can
  match until it does. This is not covered by `normalization.json`: the roots
  are runtime values only the caller knows.
- Read 2026-09-05: `crates/cadence/src/envelope.rs` (the `Envelope<T>` enum,
  internally tagged `status`, three non-`ok` arms each with `reason: String`,
  six unit tests including `refused_is_a_successful_call_carrying_its_refusal`),
  `crates/cadence/src/server.rs` (`cadence_version` constructs only
  `Envelope::Ok`, so it needs no change), `crates/cadence/tests/mcp.rs` (the
  spawned-binary `Client`), `crates/cadence/Cargo.toml` (no
  `[dev-dependencies]`; serde_json has `preserve_order`), `Cargo.lock` (`regex`
  1.13.1 is already a normal transitive dependency through `tree-sitter`), insta
  1.48.0 source in the local registry (`Settings::set_snapshot_path`,
  `Settings::bind`, `assert_snapshot!`; `Snapshot::from_file` reads a `---`
  metadata block then content; content match normalizes trailing whitespace and
  CRLF and ignores metadata; a mismatch does NOT fail in every `INSTA_UPDATE` mode - the
  in-place update modes skip the panic with no `INSTA_FORCE_PASS` set
  (`insta-1.48.0/src/runtime.rs:685`), so the harness must not rely on ambient
  environment to make a mismatch fatal; pin the setting the test needs).
- Out of scope: any driver that runs the binary against a fixture (phases 3
  through 16 add those as they port operations); any change under
  `cadence-core/` or `crates/cadence/tests/golden/` (plans 1 and 2's lease); the
  `hint` and `detail` fields the JavaScript envelope carries.

## Tasks

### Task 1: `insta`, `tempfile` and `regex` enter the dev-dependency graph only

- **Files:** crates/cadence/Cargo.toml, Cargo.lock
- **Action:** Add a `[dev-dependencies]` section to `crates/cadence/Cargo.toml`
  with `insta` at major version 1, `tempfile` at major version 3 and `regex` at
  major version 1 (the local registry holds insta 1.48.0 and tempfile 3.27.0;
  `regex` 1.13.1 is already in `Cargo.lock` as `tree-sitter`'s dependency, so
  the resolver reuses it and no new `regex` package enters the lock; let the
  resolver pick within each major and commit what it picks). Enable no insta
  features beyond the default: the harness asserts TEXT snapshots it serializes
  itself (Task 5), so neither `json` nor `redactions` is needed, and an unused
  feature is compile time on every cold build. Write a comment in the style of
  the existing dependency comments saying why these are dev-only (D-15: they
  never reach the shipped binary, so the `rust-toolchain.toml` pin and phase
  19's archive checksums are untouched) and what each is for (insta renders the
  comparison failure; tempfile holds scratch copies of fixtures and mutated
  goldens for the negative controls; regex applies the `normalization.json`
  rules to an answer, which is why it must be the same dialect subset the
  recorder used). Regenerate `Cargo.lock` with a plain `cargo build` once, then
  confirm `--locked` accepts it. Do not touch the `[dependencies]` block.
- **Verify:** `cargo tree -e normal -p cadence | grep -c 'insta\|tempfile'`
  prints 0; `cargo tree -e dev --depth 1 -p cadence` lists `insta`, `tempfile`
  and `regex`; `git diff Cargo.lock | grep -c '^+name = "regex'` prints 0 (no
  new regex package, only a new edge); `cargo build --locked` and
  `cargo test --locked` exit 0; `git diff --stat Cargo.lock` shows additions and
  `git diff crates/cadence/Cargo.toml` touches no line inside `[dependencies]`.

### Task 2: The non-`ok` arms carry a machine `code` beside `reason`

- **Files:** crates/cadence/src/envelope.rs
- **Action:** Add a `code` field to the `Refused`, `Unknown` and
  `NotApplicable` arms of `Envelope<T>`: a machine token in the JavaScript
  seam's spelling - the single-quoted literals at its `fail('<code>', ...)`
  sites, kebab-case, such as `no-phase-dir`, `bad-args`, `usage`,
  `unknown-key` and `no-roadmap` (`unresolved-range` was listed here in an
  earlier draft as a `fail()` literal and is not one - it comes from a direct
  emit object, so do not use it as the shape to copy) - serialized under the key
  `code` and placed before `reason` in the struct so it serializes first.
  Whether `code` is a plain `String` or a thin newtype is the executor's call;
  it must not be a closed enum over a list this phase invents, because the
  vocabulary belongs to the operations later phases port and at least 54
  distinct literal tokens exist in production `fail()` calls in the frozen tree
  today (counted 2026-09-06; "40-odd" in an earlier draft was low). Keep `reason` as prose for a person. Rewrite
  the type's doc paragraph that says the non-`ok` arms carry "a `reason` and
  nothing else" to state the two fields and why the code exists (D-04: a
  golden comparing `refused{reason:"the phase has no CONTEXT.md"}` against a
  recorded `{"reason":"no-phase-dir"}` is a diff with no verdict). Update the
  existing tests so each non-`ok` test asserts the exact JSON with both fields,
  and extend `refused_is_a_successful_call_carrying_its_refusal` to assert the
  structured content carries the `code`; keep the `is_error` assertion (D-07).
  Keep the `JsonSchema` derive so `cadence_version`'s `outputSchema` picks up
  the field without a `server.rs` edit. Do not add `hint` or `detail`, and do
  not change the `Ok` arm or the `status` tag spellings.
- **Verify:** `cargo test --locked envelope` passes and lists at least six
  tests; a test asserts
  `{"status":"refused","code":"no-phase-dir","reason":"the phase has no CONTEXT.md"}`
  exactly (or the same shape with the executor's chosen strings) and the
  `unknown` and `not-applicable` tests assert `code` likewise;
  `grep -c '"code"' crates/cadence/src/envelope.rs` prints 3 or more;
  `grep -c 'structured_error\|CallToolResult::error' crates/cadence/src/envelope.rs`
  prints 0; `cargo test --locked --test mcp` still passes with four tests.

### Task 3: The loader reads every recording, the manifest and the rules, and refuses a malformed one

- **Files:** crates/cadence/tests/golden.rs
- **Action:** Create the integration test `crates/cadence/tests/golden.rs`
  (cargo target `golden`; the sibling data directory
  `crates/cadence/tests/golden/` has no `main.rs`, so cargo does not treat it
  as a target). Write a loader that takes the golden ROOT as a path argument -
  defaulting to `env!("CARGO_MANIFEST_DIR")` joined with `tests/golden` - and
  reads `operations.json` into a typed invocation list, every
  `recordings/*.json` into a typed recording struct mirroring the thirteen
  contract keys, and `normalization.json` into a typed rule list mirroring the
  normalization contract in Context, all with `deny_unknown_fields` so a
  contract drift on either side fails loudly rather than being ignored. Parse
  `stdout` as an optional `serde_json::Value` (null for the hooks), `files` as
  an ordered map of relative path to string, `deleted` as a list, `node` as a
  string. For the rules, reject a `target` other than `file` or `stdout`, a
  `file` rule without `path_suffix`, a `stdout` rule without `key`, and a
  `pattern` that `regex::Regex::new` refuses, and a `replace` containing `$`
  (which `replace_all` would expand), each with an error naming the file and the
  rule `id`. Return an error naming the offending file for a
  recording that does not parse or that violates the contract. Tests: loading
  the committed root succeeds and prints the recording count, the invocation
  count and the rule count; a negative control copies the golden root into a
  `tempfile::TempDir`, truncates one recording to half its bytes, points the
  loader at the copy, and asserts the error names that file; a second copies
  the root, rewrites one rule's `target` to a misspelling, and asserts the
  error names `normalization.json` and the rule `id`. Nothing in this file may
  construct a `std::process::Command` for `node` (D-05).
- **Verify:** `cargo test --locked --test golden -- --nocapture` passes and its
  output contains a line with the recording count equal to
  `ls crates/cadence/tests/golden/recordings/*.json | wc -l` and a line with the
  rule count equal to `node -p 'require("./crates/cadence/tests/golden/normalization.json").rules.length'`;
  a test whose name contains `malformed` or `corrupt` passes for the recording
  case and another for the rules case; `grep -c '"node"' crates/cadence/tests/golden.rs`
  prints 0; `grep -c 'deny_unknown_fields' crates/cadence/tests/golden.rs`
  prints 1 or more; `grep -c 'normalization.json' crates/cadence/tests/golden.rs`
  prints 1 or more.

### Task 4: A fixture bundle materializes into a scratch directory intact

- **Files:** crates/cadence/tests/golden.rs
- **Action:** Add a materializer that copies
  `crates/cadence/tests/golden/fixtures/<bundle>/` recursively into a fresh
  `tempfile::TempDir`, preserving relative paths and bytes, and returns the
  directory (the caller keeps it alive; dropping it removes the copy). This is
  the path every later port phase's driver will use to give the binary a
  writable tree, so the write operations never touch the committed fixtures.
  A bundle name with no directory on disk is an error naming the bundle, not
  an empty copy. Tests: for every bundle named by at least one invocation in
  the manifest, the set of relative paths in the copy equals the set in the
  committed bundle and each file's bytes are equal; a nonexistent bundle name
  returns an error that names it.
- **Verify:** `cargo test --locked --test golden -- --nocapture` passes and
  prints the number of bundles materialized, equal to the number of distinct
  `bundle` values in `operations.json` (`node -e` or `jq` over the file for the
  reference count); the nonexistent-bundle test passes.

### Task 5: The comparison normalizes the answer, fails on a wrong one and names the field

- **Files:** crates/cadence/tests/golden.rs
- **Action:** Add the projection table, the normalizer and the comparison. The
  projection table maps an operation id to its decision-bearing keys as dotted
  paths into the envelope; seed it from D-06's AMENDED list - `replay`, `dispatch_set`,
  `overlaps`, `frontmatter_issues`, the derived per-phase `status`,
  `cursor.agrees`, `parallelSafe` - SEVEN keys, assigning each to the operation
  whose COMMITTED recording actually carries it (open the recordings and look;
  `parallelSafe` is `worktree-base resolve`'s, and `frontmatter_issues` is
  carried in STDOUT by `plan-overlap-malformed` only). A correction to this line
  itself, worth keeping because it is the trap plan 2 Task 4 already documents:
  an earlier draft also credited `milestone-prune-ok`, which was wrong - that
  recording's stdout is `ok, action, label, mode, phases, roadmap, requirements,
  dirs, residue_rows`, and the token appears only inside its captured `files`
  bytes. A `grep -l` over a recording FILE matches the captured file contents as
  well as the envelope; PARSE the recording and read `stdout` when the question
  is what an envelope carries. D-06 originally
  named nine; `drift` and `undeclared` were struck 2026-09-06 because no
  recording carries either - see the amendment in CONTEXT. Do NOT hunt for them
  and do NOT invent an operation to hold them. Every
  entry must name at least one key: an empty entry is refused when the table is
  built, with an error naming the operation, because an empty projection
  compares nothing and would report green (Task 6 tests this). An operation
  with no table entry has no projection yet and cannot be activated (Task 6).
  The hooks are the stated EXCEPTION and the table must carry them as one: a
  recording whose `stdout` is `null` (the hook operations plan 2 records, whose
  whole observable answer is the files they wrote) gets the reserved entry
  `files-only` rather than a key list, which the non-empty rule accepts and the
  comparison reads as its third branch. Without it those recordings are
  unusable: they can satisfy neither `stdout.ok` arm below, and a later phase
  activating one would have to change this contract instead of filling a table
  row.
  The normalizer applies the loaded rules with exactly the semantics in
  Context: a `stdout` rule rewrites the string at `key` in the answer's
  envelope; a `file` rule rewrites each matching `files` entry line by line,
  skipping every line present verbatim ANYWHERE in the pre-run copy of the TREE
  - the UNION across every path, never the same path alone. This sentence said
  "the pre-run text of that path" in an earlier draft and that was WRONG: it
  contradicted this plan's own Context paragraph and, worse, it contradicted the
  recorder plan 2 actually shipped, whose `record.mjs:132` states "The union is
  tree-wide: moved UAT lines remain fixture inputs too." A path-local skip would
  read a `renumber` or `milestone-prune` moved file's `started`/`updated` lines
  as newly written and normalize them, and a Rust side that wrongly RE-STAMPED
  them would then produce matching tokens and PASS. Implement the union. The
  caller supplies the map (the driver has it: it materialized the tree; the
  self-tests below read it from the committed bundle). The comparison takes a
  recording, an ANSWER - the `serde_json::Value` a Rust envelope serializes to,
  plus the answer's post-run files map and deleted list, in the same shape the
  recording uses - the pre-run text map, and the two ROOTS the answer was
  produced under (the scratch root and the repository root); it substitutes
  `<FIXTURE>` and `<REPO>` for those roots throughout the answer's `stdout`,
  `files` and `deleted` FIRST, then applies the rules, and only then decides: for a recording whose `stdout.ok` is `true`, the answer's
  `status` must be `ok` and every projected key must be equal on both sides;
  for a recording whose `stdout.ok` is `false`, the answer's `status` must be
  one of the three non-`ok` tags and its `code` must equal the recording's
  `stdout.reason` (D-04); for a recording whose `stdout` is `null` - the
  `files-only` entry above - no envelope is compared at all and the files decide
  alone; and a FOURTH branch for a recording whose `stdout` is an object with no
  `ok` key at all, which the earlier three do not cover and which really exists:
  `git-guard-refused.json` carries `exit: 0` and a Claude Code hook payload,
  `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",...}}`.
  A refusal there is `permissionDecision` equal to `deny`, NOT `ok == false`, so
  the blanket premise "a JavaScript refusal is `stdout.ok == false`" in Context
  is false for the hook family. Give that family its own reserved projection
  entry naming the decision key, so it is compared rather than falling through;
  note that `git-guard` is split - the `ok` arm records `stdout: null` and lands
  in `files-only`, the refused arm lands here. In every branch, and regardless of
  what the projection names, `files` and `deleted` must be byte-equal after
  normalization (D-08).
  The result on mismatch carries the differing key paths by name (`replay`,
  `code`, `files[.planning/STATE.md]`), which is what the self-tests below
  assert on. For the RENDERING, use insta as D-15 intends: serialize the
  expected and actual projections to text with ONE serializer on both sides
  (`serde_json::to_string_pretty`). One serializer is NOT sufficient on its own:
  `preserve_order` makes a map an `IndexMap` that keeps INSERTION order, so two
  objects that are equal by value can serialize to different text if their keys
  were inserted in different orders - which would render a diff where there is
  no disagreement. So BUILD both sides through the same construction path,
  inserting the projected keys in table order into a fresh map on each side
  rather than carrying a nested object across unchanged; only then does equal
  value give equal text and formatting can never be the diff, write the expected text as a snapshot file into a
  `tempfile::TempDir` in the file form insta's `Snapshot::from_file` reads (a
  `---` line, a metadata line or two, a `---` line, then the content), bind
  `insta::Settings` with `set_snapshot_path` at that directory, and call
  `insta::assert_snapshot!` on the actual text under a name that is the
  invocation id - a mismatch panics with insta's line diff, whose `-`/`+` lines
  name the field, and whatever `.snap.new` insta writes lands in the temp
  directory, never in the tree. Every self-test below that uses a recording's own `stdout` as the ANSWER must
  ADAPT it into the Rust shape first, success as explicitly as refusal: the
  recording carries the JavaScript envelope `{"ok":true, ...}`, the comparison
  requires `status: "ok"`, and a `stdout` passed through unchanged fails on the
  status check before a projected key is ever read. Write ONE adapter used by
  every positive control - `ok:true` becomes `status:"ok"` with the remaining
  keys carried across unchanged at the same paths, so the projection's dotted
  paths resolve identically on both sides - and state it here rather than
  leaving each test to invent one, since an executor that instead WEAKENS the
  status check to make the control pass has removed the assertion the control
  exists to prove. Self-tests, using committed recordings: the `replay-check`
  recording's own `stdout` through that adapter, with its `files`, as the
  answer passes; the
  same answer with `replay` flipped fails with `replay` among the named keys; a
  refusal recording's own `stdout` rewritten into the Rust shape (`status` one
  of the non-`ok` tags, `code` equal to `reason`) passes, and with `code`
  changed to another token fails naming `code`; the `trace append` recording's
  own `files` with the `<NOW>` token in its appended line replaced by a real
  ISO-8601 instant passes (the rule maps it back); the same file with one byte
  changed outside the normalized field fails naming
  `files[.planning/trace.jsonl]`; the same file with a SEEDED line's `ts`
  changed to another valid instant fails naming that path - and NOT because the
  rule leaves seeded lines alone: the timestamp rule matches by field, so the
  changed seeded `ts` is normalized to `<NOW>` too, and `<NOW>` differs from the
  literal instant the recording committed for that pre-run line. The rejection
  is expected; the reason is the substitution, not an exemption; a `cursor set` answer whose
  `stdout.cursor.updated` is a real day stamp passes; an answer whose `stdout`
  STRINGS carry a live `tempfile::TempDir` absolute path where the recording
  carries `<FIXTURE>` passes once the root substitution runs (build it by
  rewriting a committed recording's `<FIXTURE>` occurrences to that TempDir's
  path and feeding it back as the answer), and the same answer with the
  substitution SKIPPED fails. Build this from `stdout`, NOT from `files` keys:
  measured over the committed set, all 50 captured file keys are relative and
  ZERO contain `<FIXTURE>`, while 50 recordings' `stdout` does carry it - a
  control keyed on the file paths would be unconstructible. And claim only what
  it proves: this pair proves the substitution is PRESENT, not that it runs
  FIRST. The two passes touch disjoint content on every committed recording -
  the roots are paths, the six rules are timestamps - so reversing them changes
  no byte anywhere in the set, and no control built from a committed recording
  can fail on order alone. If the order is to be proven rather than asserted,
  it needs a CONSTRUCTED case where a root path contains a rule-matching
  substring; write that or drop the order claim, but do not present the
  presence control as an order control; and a `#[should_panic]`
  test drives the insta rendering path with the flipped `replay`.
- **Verify:** `cargo test --locked --test golden` passes; running only the
  `#[should_panic]` rendering test with `-- --nocapture` and capturing both
  streams shows insta's diff with a line containing `replay`;
  `grep -c 'insta::' crates/cadence/tests/golden.rs` prints 1 or more;
  `grep -c 'set_snapshot_path' crates/cadence/tests/golden.rs` prints 1 or
  more; `grep -c 'Regex' crates/cadence/tests/golden.rs` prints 1 or more; a
  test drives the `files-only` branch with a `stdout: null` recording and passes,
  and the same answer with one byte changed in a captured file fails naming that
  path; the
  positive-control tests (recording against its own answer; normalized `ts`
  and `updated` against real values) and the negative-control tests (`replay`,
  `code`, a non-normalized `files` byte, a re-stamped seeded line, a skipped
  root substitution) all pass; a
  unit test that builds the projection table with one entry emptied asserts
  the build fails naming that operation.

### Task 6: Every recording is compared or pending, never silently passed

- **Files:** crates/cadence/tests/golden.rs
- **Action:** Add the activation table: operation id to a driver that,
  given a materialized bundle and an invocation, obtains the binary's answer in
  the shape Task 5 compares. It is EMPTY in this phase - the binary implements
  no recorded operation until phase 3 - and phases 3 through 16 add one entry
  per operation they port. Write the main golden test to walk the manifest:
  for an invocation whose operation is in the table, materialize its bundle
  (Task 4), obtain the answer, and compare (Task 5), failing on any mismatch;
  for every other invocation, count it pending. Print one summary line of the
  form `compared=<n> pending=<m>` plus the pending operation ids, so the number
  never has to be inferred. Assert, failing by name: every manifest invocation
  has a recording file and every recording file has a manifest entry; every
  activation-table key names an operation that appears in the manifest AND has
  a projection entry that names at least one key, so a typo, a premature
  activation or an empty projection fails instead of skipping. The walk and its
  load-time checks take the projection table and the activation table as
  inputs rather than reading globals, so the negative controls can hand in
  modified copies. Name the test for what its pass means -
  `every_recording_is_compared_or_pending` or similar - and never a name a
  reader could take as parity. Negative controls in `tempfile::TempDir` copies
  of the golden root: one recording deleted fails naming its invocation; one
  extra recording (a copy under a new name) fails naming the new file; a unit
  test that inserts a fake activation for an operation id that is not in the
  manifest asserts the walk fails naming it; and a unit test that hands the
  walk a projection table whose entry for a recorded operation is empty, with
  that operation activated through a stub driver returning the recording's own
  answer, asserts the walk fails naming that operation rather than reporting
  `compared=1`.
- **Verify:** `cargo test --locked --test golden -- --nocapture` prints
  `compared=0` and `pending=<N>` where N equals
  `ls crates/cadence/tests/golden/recordings/*.json | wc -l`; the four
  negative-control tests pass; `cargo test --locked` at the repo root passes
  with every test in `envelope`, `mcp` and `golden` green (AC1);
  `grep -c 'parity' crates/cadence/tests/golden.rs` counts only comments that
  say the test is NOT a parity claim, and no test function name contains the
  word.

## Notes

- **Sequential after plans 1 and 2.** No file is shared (plans 1 and 2 lease
  the directory `crates/cadence/tests/golden/`, this plan leases the file
  `crates/cadence/tests/golden.rs` beside it, plus the crate manifest, the
  lockfile and `envelope.rs`), but Tasks 3 through 6 read the committed
  recordings, manifest and `normalization.json`, so this plan cannot be
  verified before plan 2 lands. The dependency is stated in each plan's Goal
  where the dispatcher reads before deciding; `execute.md` runs plan files in
  numeric order and `parallelization.enabled` is false (measured 2026-09-05).
  This is the deviation from CONTEXT's parallel-sounding `Plan shape`; the
  seam it names is honored.
- **`compared=0` is the honest number for phase 2.** The CONTEXT's first
  flagged assumption says it outright: the binary implements none of the
  recorded operations, so the harness is proven by its negative controls, not
  by agreement. A reviewer who reads the golden test's pass as parity has
  misread it, and the test name and summary line exist to make that misreading
  hard.
- **The normalizer lives on both sides of the seam on purpose.** D-05 forbids
  the Rust side from running `node`, so the only way the write-side byte-diff
  can ever match a binary that writes a real `ts` is for the rule that turned
  the JavaScript's `ts` into `<NOW>` to be DATA both sides read. That is what
  `normalization.json` is; the line-scoped skip is D-12 applied - a rule
  touches only what the operation wrote, so a binary that re-stamps a line it
  should have left alone is caught rather than normalized away.
- **`regex` is a third dev-dependency beside D-15's two.** D-15's point is that
  nothing reaches the shipped binary, and that holds: `regex` is dev-only here
  and already in the normal graph through `tree-sitter`, so `Cargo.lock` gains
  an edge and no package. It exists because the rules are regular expressions
  the recorder applied with JavaScript's `RegExp`; hand-matching them would be
  a second dialect to keep in step.
- **insta's role.** insta compares snapshot FILES it owns, and the recordings
  are Node-authored JSON, so Task 5 materializes the expected projection as a
  snapshot in a temp directory and lets insta compare and render there. Both
  sides go through one serializer, so a formatting difference can never be the
  diff. If the executor finds insta's file-format expectations harder to meet
  than the source read on 2026-09-05 suggested, the fallback is `similar`
  (already in insta's dependency graph, so no new package enters
  `Cargo.lock`) as the renderer - a deviation to record, since D-15 names two
  crates.
- **`code`'s type is left open on purpose.** D-04 fixes the field and its
  spelling; the vocabulary is the operations' and arrives phase by phase. A
  later phase may tighten it to a newtype with validation; nothing here should
  make that harder.
- **Retired operations.** `worktree-base resolve` and `plan-overlap` are
  recorded by plans 1 and 2 and will sit in the pending list until phase 18
  decides how a retired operation is marked; this plan does not invent that
  marker.
- **Local toolchain**: cargo 1.98.1 without rustup, so `rust-toolchain.toml`
  is inert here and binding on CI; the CI `cargo-test` job has no Node, which
  is exactly why D-05 forbids shelling out.
