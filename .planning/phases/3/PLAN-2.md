---
phase: 3
plan: 2
requirements:
  - RVP-02
files:
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/bin/lib/schema-eval.mjs
  - cadence-core/references/provider-api.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: Bounds the review path never stated - Plan 2 (RVP-02, the schema half)

## Goal

Local validation of a provider's findings refuses exactly what the canonical
schema refuses - `line <= 0`, an empty `file` / `claim` / `failure_scenario`, an
unknown key, and a finding count or field length past its bound - each with its
own named diagnostic, and the agreement between the two sides is machine-run
rather than asserted by reading.

## Must be true when done

- `FINDING_SCHEMA` itself carries the constraints: `line` has a minimum of 1,
  the three string fields have a minimum length, each has a maximum length, and
  the findings array has a maximum count - so the shape sent on the wire is the
  shape asserted on return.
- Those constraint keywords ride the wire on every shipped adapter - OpenAI's
  strict `json_schema`, Gemini's `responseSchema`, DeepSeek's in-prompt schema -
  and `stripAdditionalProperties` still removes `additionalProperties` and
  nothing else.
- `validateFindings` refuses each of the seven out-of-schema inputs with its own
  distinct non-null diagnostic naming the field and the bound, and still accepts
  a clean finding and an EMPTY findings array, which is what a review with
  nothing to report returns.
- A keyword-limited JSON-Schema evaluator lives in the repo, covers exactly the
  keywords `FINDING_SCHEMA` uses, and THROWS on any keyword it does not
  implement rather than treating it as satisfied.
- A test runs every fixture through both the evaluator and `validateFindings`
  and asserts the two verdicts agree, with at least one accept case in the
  table - so a fixture the schema rejects is rejected locally, one it accepts is
  accepted, and there is no third answer.
- `cadence-core/references/provider-api.md` records which constraint keywords
  each shipped provider supports, with the date the support was checked.
- A falsifier committed with a `WATCHED FAILING AT <sha>` header exits non-zero
  when run against that SHA and zero on this tree, and `node --test
  cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs` and
  `npx tsc -p tsconfig.ci.json` are all green.

## Context

CONTEXT D-06 moves BOTH sides: `FINDING_SCHEMA` gains the constraints and
`validateFindings` mirrors every one with its own named diagnostic, because the
criterion is that the refusals are "the canonical schema's own" - bounding only
locally leaves the schema decoration in the other direction. D-07 settles from
the provider docs (retrieved 2026-08-17) that the new keywords ride the wire
unchanged on every adapter and that `stripAdditionalProperties` stays the
Gemini-only carve-out it is today. D-08 proves the agreement with a
keyword-limited evaluator written in-repo, so both verdicts are machine-run;
the repo carries no runtime dependency and no `ajv`, and that zero-dep
constraint is not being spent here. D-09 keeps scope findings-only:
`CONSULT_SCHEMA` and `validateConsult` carry the identical gap in identical
code shape and are OUT - mirroring later is a mechanical copy of this plan's
shape and goes to the SUMMARY's open items.

Out of this plan: everything RVP-01 (PLAN-1) and everything WIR-01 (PLAN-3).

## Tasks

### Task 1: the canonical schema carries the bounds

- **Files:** `cadence-core/bin/review-provider.mjs` (`FINDING_SCHEMA` and the
  `SEVERITY` constant above it), `cadence-core/bin/review-provider.test.mjs`
- **Action:** Add to `FINDING_SCHEMA` the constraints the shape has always
  implied and never stated: `minimum: 1` on `line`, `minLength: 1` on `file`,
  `claim` and `failure_scenario`, a `maxLength` on each of those three, and a
  `maxItems` on the `findings` array. The numbers are settled here and derived
  from what the tree has actually produced rather than picked round: the longest
  real values in this repo's one committed findings file
  (`.planning/phases/1/REVIEW-risk_surface-plan-1.md`) are `file` 39 chars,
  `claim` 159 and `failure_scenario` 376, and across the 19 adjudication events
  in `.planning/trace.jsonl` the largest `raised` count is 9 - from a PANEL, the
  union of every reviewer. So: `file` 1024 (any repo path, ~26x the observed
  longest), `claim` 2000 and `failure_scenario` 2000 (~12x and ~5x), and
  `maxItems` 100 (~11x the largest panel round). Add NO `minItems`: an empty
  findings array is what a reviewer that found nothing returns, and refusing it
  would turn a clean review into a `bad-shape` degradation. Do not touch
  `CONSULT_SCHEMA` (D-09). Do not add `unevaluatedProperties`, `propertyNames`,
  `minProperties`, `maxProperties`, `contains`, `minContains`, `maxContains` or
  `uniqueItems`: D-07's research names those as OpenAI's unsupported set for
  structured outputs, and the four keywords above are the ones verified
  supported on base models everywhere. Leave `stripAdditionalProperties` alone -
  it stays the Gemini-only `additionalProperties` carve-out it is today, and
  growing it a second stripped set is exactly what D-07 refuses.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with new cases showing: the OpenAI adapter's `structuredRequest` body carries
  the four new keywords with the stated values somewhere under
  `text.format.schema`; the Gemini adapter's `generationConfig.responseSchema`
  carries them too, with no `additionalProperties` key anywhere in it; the
  DeepSeek adapter's system message contains the serialized schema including
  those keywords; and `stripAdditionalProperties(FINDING_SCHEMA)` removes only
  `additionalProperties`, leaving `minimum`, `minLength`, `maxLength` and
  `maxItems` intact. `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: `validateFindings` refuses what the schema refuses, by name

- **Files:** `cadence-core/bin/review-provider.mjs` (`validateFindings` and its
  doc comment), `cadence-core/bin/review-provider.test.mjs` (the
  `validateFindings: accepts the exact shape, names the first defect` test)
- **Action:** Mirror every constraint task 1 put in `FINDING_SCHEMA`, each with
  its own diagnostic string naming the offending field and the bound it crossed -
  never a shared "invalid finding" message, because this string is what reaches
  the user as `{ok:false, reason:"bad-shape", detail}` and a degradation the user
  cannot act on is the silent drop this requirement exists to end. Cover: `line`
  below 1 (distinct from the existing non-integer diagnostic), an empty `file` /
  `claim` / `failure_scenario` (distinct from the existing non-string
  diagnostic), a field past its maximum length, a findings array past the count
  bound, and an unknown key - at BOTH levels, on the top-level object and on each
  finding, since `additionalProperties: false` sits at both in the schema. The
  unknown-key diagnostic names the offending key. Keep the existing five
  diagnostics and the existing first-defect-wins order intact - `fault: a 200 the
  schema does not match is bad-shape` asserts on `finding.claim must be a
  string`, and the field order this function checks is what that test pins.
  `validateFindings` stays pure and total: it returns `null` or a string, never
  throws, on the degrade-never-crash contract this whole module states. Do not
  touch `validateConsult` (D-09). Update the doc comment to say the function
  mirrors `FINDING_SCHEMA`'s constraints and that the two are checked against
  each other by test, so the next reader knows the pairing is enforced rather
  than remembered.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with a case that calls `validateFindings` on each of `line: 0`, `file: ""`,
  `claim: ""`, `failure_scenario: ""`, a finding carrying an unknown key, a
  findings array one past the count bound, and a `claim` one past its length
  bound, collects the seven return values, and asserts every one is a non-null
  string and that the set of seven has size 7 - seven different strings, no
  `null`. The same case asserts `validateFindings({findings: []})` returns
  `null`, and that a top-level unknown key beside `findings` returns a non-null
  diagnostic naming that key.

### Task 3: a keyword-limited JSON-Schema evaluator, in-repo and zero-dep

- **Files:** `cadence-core/bin/lib/schema-eval.mjs` (new),
  `cadence-core/bin/review-provider.test.mjs`
- **Action:** Write a pure, total, zero-dependency evaluator that takes a schema
  and a value and returns `null` when the value conforms or a string naming the
  first violation, following the `lib/*-decision.mjs` house shape: `// @ts-check`
  at the top (48 of the 49 non-test files under `cadence-core/bin` carry it, and
  `tsconfig.ci.json` checks every `.mjs` under `bin` while excluding the test
  suite, so a helper used only by tests is still typechecked when it lives here),
  node builtins only, no I/O, no `emit`. It implements EXACTLY the keywords
  `FINDING_SCHEMA` uses after task 1 - `type`, `properties`, `required`,
  `additionalProperties`, `items`, `enum`, `minimum`, `minLength`, `maxLength`,
  `maxItems` - and THROWS on any schema keyword outside that set rather than
  ignoring it. `minLength` and `maxLength` are measured in Unicode CODE POINTS,
  as JSON Schema specifies, never in JavaScript's UTF-16 code units: use
  `[...str].length` or an equivalent code-point count, and say so in the module
  header. A `.length` implementation is wrong for any string outside the BMP -
  one emoji counts 2 - and the danger is specific to this design: task 4 proves
  agreement by comparing this evaluator against `validateFindings`, so if BOTH
  sides reach for `.length` they agree with each other while both disagreeing
  with the schema, and the agreement test goes green on the shared error. The throw is the load-bearing half and answers CONTEXT's second
  flagged assumption directly: an ignored keyword evaluates as "accept", so a
  future `FINDING_SCHEMA` keyword this evaluator does not implement would make
  the agreement test in task 4 go green on an agreement it never checked. It also
  throws on an `additionalProperties` value other than `false`, which is the only
  form this schema uses. Its verdict is a boolean fact about conformance and is
  deliberately NOT string-compatible with `validateFindings`' diagnostics: task 4
  compares accept/reject, not wording, because the two sides are allowed to
  phrase a refusal differently and required to agree on whether it IS one. This
  is a test-only helper by design; state that in the module header along with the
  reason it lives under `lib/` rather than inside the test file. Do not reach for
  `ajv` or any dependency: the repo's `node_modules` holds `typescript`,
  `@types`, `@typescript` and `undici-types` only, and the zero-dep constraint is
  not being spent here.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with unit cases for the evaluator showing: each implemented keyword accepts a
  conforming value and rejects a violating one (a wrong `type`, a missing
  `required` key, an extra key under `additionalProperties: false`, a value
  outside `enum`, an integer below `minimum`, a string below `minLength`, a
  string above `maxLength`, an array above `maxItems`); a non-BMP fixture pins
  the code-point rule, with a string of N astral characters (e.g. `"\u{1F600}"`
  repeated) accepted at `minLength: N` and rejected at `minLength: N + 1`, which
  a UTF-16 `.length` implementation fails in the accepting direction; nesting
  works, so a
  violation inside `findings[].claim` is reported; and evaluating a schema
  carrying a keyword the evaluator does not implement THROWS rather than
  returning `null`. `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: both sides of every fixture, machine-run, no third answer

- **Files:** `cadence-core/bin/review-provider.test.mjs`
- **Action:** Add one test that holds a fixture table and runs each fixture
  through BOTH the evaluator from task 3 (against the live `FINDING_SCHEMA`, not
  a copy - a copied schema is the drift this exists to kill) and
  `validateFindings`, asserting that the two verdicts agree on accept-vs-reject
  for every row. The table covers at minimum: a clean single finding (ACCEPT), an
  empty findings array (ACCEPT), `line: 0`, a negative `line`, a non-integer
  `line`, an empty `file`, an empty `claim`, an empty `failure_scenario`, a
  `claim` one past its maximum length, a `file` one past its maximum length, a
  findings array one past the count bound, an unknown key on a finding, an
  unknown key at the top level, a missing required field, a bad `severity`, a
  `findings` that is not an array, and TWO non-BMP rows: a `claim` of exactly
  `maxLength` astral characters (ACCEPT) and one of `maxLength + 1` (REJECT).
  Those two are what stop the agreement itself from being the bug - both sides
  are being written in this phase, so a shared UTF-16 `.length` reading of
  `minLength`/`maxLength` agrees perfectly while both disagree with the schema,
  and every BMP-only fixture in the table above is blind to it. Assert the table contains at least one accept
  case and that at least one row of each kind actually reached both sides - a
  table whose every row rejects would pass a validator that rejects everything.
  When the two disagree, the failure message names the fixture and both verdicts,
  because "which side is wrong" is the only question a reader of that failure
  has. Do not hand-pair each fixture with an EXPECTED verdict written by a human:
  D-08 rejects that shape explicitly, since the schema column would then be
  asserted by reading and the drift returns unnoticed.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with this test present and green. Temporarily deleting the `minimum` keyword
  from `FINDING_SCHEMA` makes it FAIL naming the `line: 0` fixture and the two
  disagreeing verdicts, and temporarily deleting the corresponding check from
  `validateFindings` makes it fail naming the same fixture from the other side
  (restore both afterwards).

### Task 5: `provider-api.md` records which constraint keywords each provider takes

- **Files:** `cadence-core/references/provider-api.md` (the `## Notes on record`
  section, whose last bullet already says "Keep the shape we assert on return in
  sync with the shape we send"), `cadence-core/bin/weight-budgets.json`
- **Action:** Record D-07's research where the wire facts live, so the next
  person to touch `FINDING_SCHEMA` does not have to re-derive it: which
  constraint keywords ride the wire on each shipped provider, and the date it was
  checked. State that OpenAI's structured-output unsupported list is the
  composition keywords plus, for objects, `unevaluatedProperties` /
  `propertyNames` / `minProperties` / `maxProperties` and, for arrays,
  `unevaluatedItems` / `contains` / `minContains` / `maxContains` /
  `uniqueItems` - while `minimum`, `minLength`, `maxLength` and `maxItems` are
  supported on base models, which are the only models Cadence dispatches; that
  Gemini documents `minimum` / `maximum` and `minItems` / `maxItems` explicitly
  for its OpenAPI-subset `responseSchema`; and that DeepSeek enforces nothing
  server-side and is asserted on return, which is what makes LOCAL validation
  the guarantee everywhere regardless. Carry the retrieval date (2026-08-17)
  the way the rest of this file carries its verification dates. Keep it to the
  existing bullet register - this file is the wire pin, not a design record, so
  do not restate D-06's argument here. `provider-api.md` sits at exactly its
  5048-byte pin with zero headroom, so re-pin `weight-budgets.json` in this same
  commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and
  no `budget-overrun` problem - the falsifiable half, since an unre-pinned
  surface fails it - and `node cadence-core/bin/weight.mjs --root .` reports
  `cadence-core/references/provider-api.md` at a byte count equal to its new
  `weight-budgets.json` entry. `grep -c "maxItems"
  cadence-core/references/provider-api.md` returns at least 1.

### Task 6: the watched FAIL for RVP-02

- **Files:** `cadence-core/bin/review-provider.test.mjs` (the RVP-02 falsifier,
  appended at the end of the file)
- **Action:** Add one falsifier test exercising RVP-02 end to end: feed the seam
  a 200 whose extracted text is a findings object carrying `line: 0`, then one
  carrying an empty `claim`, then one carrying an unknown key, and assert each
  degrades to `{ok:false, reason:"bad-shape"}` with a `detail` naming the field
  - three states that resolve `ok:true` on the unpatched tree. Reach the seam
  through `__runCommandForTests` and the existing fault fixture and import
  nothing this plan added, so against the unpatched tree it fails on its
  ASSERTIONS rather than on a missing export. Carry the header comment in the
  shape `cadence-core/bin/milestone-prune.test.mjs`'s RCL-07 falsifier already
  uses: `WATCHED FAILING AT <sha>` naming the tip of the unpatched tree
  (`c4522c3` is the tip as this plan is written; use the commit immediately
  preceding this plan's first implementation commit if it has moved), the
  observed unpatched output quoted verbatim, and the re-watch recipe (`git
  worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/` AND `cadence-core/bin/lib/schema-eval.mjs` into that
  checkout's `cadence-core/bin/lib/`, `node --test` it there, remove the
  worktree). The second copy is not optional and is the reason this recipe is
  stated differently from PLAN-1's and PLAN-3's: tasks 3 and 4 add evaluator
  cases to THIS SAME test file that `import` the new `lib/schema-eval.mjs`, so a
  checkout carrying only the test file fails at module resolution before any
  assertion runs - a green-to-red transition that proves nothing about RVP-02.
  If the watched FAIL is re-run any other way, scope it to this falsifier by
  name (`--test-name-pattern`) so the missing-module error cannot be mistaken
  for the watched assertion failure.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA the
  header names, the same command exits NON-ZERO with this test failing on an
  assertion, and the header quotes that observed output.

## Notes

- The bounds settled here, with their grounding: `line` minimum 1; `file`,
  `claim` and `failure_scenario` minimum length 1; `file` maximum 1024, `claim`
  and `failure_scenario` maximum 2000; `findings` maximum 100. Measured against
  `.planning/phases/1/REVIEW-risk_surface-plan-1.md` (file 39, claim 159,
  failure_scenario 376) and the 19 `raised` figures in `.planning/trace.jsonl`
  (maximum 9). Their product also sets the largest response local validation can
  accept at roughly 0.5 MB, which is what PLAN-1's 4 MiB response ceiling is
  sized against.
- The evaluator's home is planner discretion under D-08 and is settled as
  `cadence-core/bin/lib/schema-eval.mjs`: `tsconfig.ci.json` excludes
  `*.test.mjs` and includes everything else under `cadence-core/bin`, so a helper
  that lives in the test file is unchecked and one that lives here is checked -
  and this helper's correctness is what task 4's whole verdict rests on.
- D-09 sends the `CONSULT_SCHEMA` / `validateConsult` mirror to the SUMMARY's
  open items rather than into a task. It is the identical gap in identical code
  shape, and every stated criterion for RVP-02 names findings.
- This plan shares `cadence-core/bin/review-provider.mjs`,
  `cadence-core/bin/review-provider.test.mjs` and
  `cadence-core/bin/weight-budgets.json` with PLAN-1, and
  `cadence-core/bin/weight-budgets.json` with PLAN-3. That is the CONTEXT `Plan
  shape` directive's explicit instruction, so `plan-overlap` will report an
  overlap and `/cad-execute` runs the three plans SEQUENTIALLY in number order.
  No plan reads another's output.
</content>
