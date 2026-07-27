# Phase 1: The plan-file frontmatter grammar - Context

Gathered: 2026-07-27 (second pass - re-gathered after UAT)
Feeds: /cad-plan 1

The first pass shipped `7b58a80..766c307` (5 commits, +846/-96) and was UAT'd at
10 pass / 5 fail. The grammar spine landed and is sound; the open half of the
goal - "reports anything outside the grammar instead of silently over- or
under-reading it" - is what this pass closes. D-01 through D-12 are the first
pass's decisions, carried forward and still binding except where noted.
D-13 onward are new.

## Scope boundary

In: the five failing UAT items (8-12), closed in one `PLAN-2.md`. A block item
arriving with no open block key is diagnosed and dropped rather than silently
discarded (`planning-files.mjs:650`); text following a closing quote yields the
quoted span plus a diagnostic rather than a quote-bearing fabricated value
(`:477-483`); a commented-out key line earns its own diagnostic
(`:640`); a key-shaped line rejected for the missing space after its colon gets
a code that names the actual repair (`:534`); backslash escapes are declared out
of the grammar and made detectable (`:456-467`); `add()`'s post-grammar path
rewriting comes off the frontmatter arm (`:707-715`, superseding D-09); and the
diagnostic-versus-verdict invariant in `references/plan-frontmatter.md` and
`workflows/audit.md` is amended to match what the four data-dropping codes
actually do. `templates/PLAN.md` moves its two `[]` lines to bare block keys.

Out: the `- **Files:**` task-line arm keeps its `add()` normalization (D-19
narrows the reach, it does not delete the helper). Escapes are not implemented,
only detected (D-20). The sibling parsers' CRLF/BOM exposure stays unfixed:
`PHASE_LINE` and `parseRoadmapPhases` belong to phase 4 (D-10). Any new feature.

Deferred: None
Plan shape: one plan - `PLAN-2.md`, alongside the executed `PLAN.md` (D-21)

## Durable decisions

- D-01 (`#` discrimination, quoting decides): an unquoted `#` after `key:`
  always starts a comment; `"#41"` is data. Real YAML's own rule, and the only
  candidate that is a stated rule rather than a heuristic, which is the
  milestone's whole premise. Matches 100% of live plan files. Chosen over "`#`
  followed by a digit is an id" (silently loses a non-numeric `#auth-1`) and
  over `#` + non-space = id with an added id-shape test (no test inverts, but
  the grammar stays two rules instead of one). Accepted cost: a hand-written
  unquoted `- #41` block item reads as a comment. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:472`,
  `cadence-core/templates/REQUIREMENTS.md:59`. SHIPPED first pass.
- D-02 (the reporting channel): the reader reports what falls outside the
  grammar through an additive, omitted-when-empty `frontmatter_issues` field on
  both the `audit` and `plan-overlap` envelopes, following the existing
  `orphans` / `undeclared` shape. Never `{ok:false}`: one odd frontmatter line
  must not become a total audit failure across every phase. The gap being closed
  is the PARTIAL read - a total under-read is already loud, but a
  truncated-but-nonempty `files:` list leaves a plan neither `undeclared` nor
  overlapping, so the parallel gate greenlights two plans writing one path.
  Evidence: `cadence-core/bin/planning.mjs:9-14,512-517,545-553,832`,
  `cadence-core/workflows/execute.md:73`. SHIPPED first pass.
- D-03 (rewrite, not a tenth arm): the reader is an explicit line classifier
  against a written-down grammar, not accreted regex arms. The accretion pattern
  is what produced the nine-defect list and phase 4's two push-rail regressions.
  This binds the SECOND pass too: the five remaining defects are closed by
  extending the stated grammar and its code table, not by special-casing inputs.
  Evidence: commits `ef75864`, `2470e95`. SHIPPED first pass.
- D-04 (block termination): a block list SKIPS blank and comment-only lines and
  terminates on a stated three-member terminator set - the closing `---` fence,
  a following `key:` line at column 0, or EOF. Every live block list terminates
  at the fence or a following key line, so the set covers every shipped case
  with no widening risk. D-14 confirms the set stays at three members.
  Evidence: `cadence-core/bin/lib/planning-files.mjs:476-480`;
  `cadence-core/references/plan-frontmatter.md:70-91`. SHIPPED first pass.
- D-05 (where normalization lives): a shared `normalize(text)` in
  `planning-files.mjs` runs on the PARSE path only. Explicitly NOT in
  `planning.mjs`'s `read()`, whose text is written back verbatim by `phase-done`
  and `renumber`, so normalizing there would silently convert a user's CRLF
  `ROADMAP.md` wholesale to LF - a byte-level rewrite of files Cadence promises
  to touch surgically. Evidence:
  `cadence-core/bin/planning.mjs:52,240,246,259-260,676,762`. SHIPPED first pass.
- D-06 (parser-level tests): `cadence-core/bin/planning-files.test.mjs` carries
  the grammar table ALONGSIDE - not instead of - the seam-level `audit` and
  `plan-overlap` tests that prove a defect reaches an observable. Every seam case
  costs a `mkdtempSync` tree plus an `execFileSync` spawn; the table is where
  breadth is affordable. CI globs `cadence-core/bin/*.test.mjs`, so the file is
  picked up with no config change. Evidence: `.github/workflows/test.yml:27`.
  SHIPPED first pass (33 rows; the one-test-per-row fix landed at `afccec8`).
- D-13 (an orphan block item is diagnosed and dropped, never back-attached): a
  block item arriving while no block key is open records a diagnostic and drops
  its payload; it never attaches to the most recent key line whatever arm that
  key took. `templates/PLAN.md` moves its `requirements: []` / `files: []` lines
  to bare block keys to match. UAT-8 overstates its own severity - the
  template's exact `files: []` plus items shape already yields
  `undeclared:["PLAN-1.md","PLAN-2.md"]` and `execute.md:73` routes `undeclared`
  to sequential - but the genuinely unguarded case is a NON-EMPTY inline list
  plus items: `files: [src/a.rs]  # comment` / `  - src/shared.rs` in two plans
  returns `overlaps:[]` with no `undeclared` and no diagnostic while both plans
  write `src/shared.rs`. Diagnose-and-drop closes both shapes; adopting only
  when the inline value was `[]` closes the harmless one and leaves the
  dangerous one open. Chosen over that, and over adopting into the most recent
  key whatever arm it took (which merges an inline list with a block, turning
  the plan's two separate statements into one under a merge rule D-04 does not
  state). Evidence: `cadence-core/bin/lib/planning-files.mjs:650,625-634`;
  `cadence-core/references/plan-frontmatter.md:49-68`; 20 plans in git history
  write the bare block key, zero use `[]` plus items.
- D-14 (a commented-out key line is diagnosed, not promoted to a terminator):
  the terminator set stays at three members; a comment-only line whose body is
  key-shaped earns a `commented-key-line` diagnostic and is otherwise skipped.
  The decisive hazard is that once the `#` is stripped, an ordinary prose
  comment like `# TODO: fill this in` also satisfies
  `/^([A-Za-z_][A-Za-z0-9_.-]*):(\s|$)/`, so promoting commented key lines to
  terminators makes prose truncate a block - the exact silent under-read D-04
  exists to close. Both branches fire a diagnostic on both inputs; the choice is
  only which input reads correctly, and truncating a real list is worse than
  folding one. Accepted cost, stated plainly: `requirements:` / `- "#41"` /
  `# files:` / `  - src/shared.rs` still folds `src/shared.rs` into
  `requirements` and audit still mints it as an orphan - but with a diagnostic
  beside it and `choose_path` routing sequential, so it is no longer silent.
  Chosen over a fourth terminator member, and over restricting the promotion to
  comments naming a KNOWN key, which teaches two key names to a
  `parseFrontmatter` that is deliberately key-agnostic (`:543-556`). Evidence:
  `cadence-core/bin/lib/planning-files.mjs:640,534`;
  `cadence-core/references/plan-frontmatter.md:70-91`; `.planning/CAPTURE.md:29`.
- D-15 (the stated invariant moves, not the classification): the claim at
  `references/plan-frontmatter.md:113-115` that a diagnostic "never changes
  `counts`, and never adds or clears an audit `break`", duplicated at
  `workflows/audit.md:52-55`, is amended to state per-code whether the code
  drops its payload. It is falsified by FOUR of the five shipped codes, not only
  by the no-space key form UAT-11 names: `unterminated-inline-list`,
  `unterminated-quote`, `unterminated-frontmatter` and `unknown-line` each
  return `counts:{total:1,traced:0,broken:1}` with `break:"no-plan"` alongside
  their diagnostic; only `trailing-inline-content` preserves its payload.
  Widening `KEY_LINE` would therefore close one of four paths and leave the
  reference asserting something three other codes still falsify. Evidence:
  verified at the audit seam against a one-requirement tree;
  `cadence-core/bin/planning.mjs:479-482,499,513-519`;
  `cadence-core/bin/lib/planning-files.mjs:596,617-621,624-628`.
- D-16 (`KEY_LINE` stays strict; the rejection gets a name): `key:value` with no
  space after the colon is not a legal key line, and a column-0 line that is
  key-shaped but fails only that test gets a new `malformed-key-line` code
  instead of the generic `unknown-line`. Strictness matches real YAML, which is
  D-01's whole premise, and keeps a column-0 bare URL (`http://example.com`)
  reported rather than parsed as key `http` with value `//example.com`. The data
  is still dropped and audit still reports `no-plan` - D-15 is what makes that
  honest rather than contradictory. Chosen over dropping the `(\s|$)` group,
  which reads a hand-written `requirements:["#41"]` correctly at the cost of
  turning every stray colon-bearing line at column 0 into a silently accepted
  key/value pair. Evidence: `cadence-core/bin/lib/planning-files.mjs:534`;
  `cadence-core/references/plan-frontmatter.md:33-37`.
- D-17 (trailing content after a closing quote is parse-then-diagnose): the
  quoted span becomes the value and a trailing-content code is recorded, so
  `- "src/shared.rs" (new)` yields `src/shared.rs` and `- "#41" stray` yields
  `#41`, each with a diagnostic. Mirrors the established precedent at
  `references/plan-frontmatter.md:121` ("the payload before it is still
  parsed"), and completes D-08's wrapping-quote strip, which UAT-9 shows is
  currently half-applied. Chosen over yielding no value plus the diagnostic
  (matching `unterminated-quote`'s fail-loud shape, but discarding a path the
  author plainly declared) and over keeping the raw quote-bearing string and
  merely diagnosing (reports the problem while leaving the false `overlaps:[]`
  intact). Evidence: `cadence-core/bin/lib/planning-files.mjs:477-483,526-528`.
- D-19 (`add()` narrows off the frontmatter arm; D-09 SUPERSEDED): a
  grammar-exact frontmatter read is no longer post-processed by `add()`'s
  parenthetical and backtick strips; the `- **Files:**` task-line arm keeps its
  normalization. D-09 deferred this as file-not-fix, and that deferral does not
  survive: it leaves a second silent route to a wrong `overlaps` on the very arm
  this phase claims to have closed, and it is why UAT-12 stays false, since the
  reference documents no post-grammar path rewriting at all. Correcting the
  filed CAPTURE evidence: `src/a (new).mjs` is NOT mangled, because
  `/\s*\(.*\)\s*$/` is end-anchored. The real mangles are paths ending in `)` or
  containing a backtick - `src/x(1)` -> `src/x`, `lib/(x)/y)` -> `lib/`,
  `docs/notes (draft)` -> `docs/notes`, `` a`b.mjs `` -> `ab.mjs` - and zero
  paths of any of those shapes appear in 21 commits of plan frontmatter. Chosen
  over fixing `add()`'s regex while keeping it on both arms (anchoring the strip
  to a whitespace-preceded group, dropping the unconditional backtick strip) and
  over holding D-09 and closing UAT-12 by documenting the post-processing as a
  stated limit. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:698-702,707-715`;
  `cadence-core/bin/planning.test.mjs:1508-1514`; `.planning/CAPTURE.md:53`.
- D-20 (backslash escapes are OUT of the grammar AND detectable): the grammar
  states no escape rule and the three scanners gain no escape state, but a
  resolved value that still contains a `"` or `'` after unwrapping is outside
  the grammar and gets a diagnostic. Declaring escapes out of scope WITHOUT a
  diagnostic would leave exactly the silent misread the open half of the goal
  names: `files: ["a\"b.md", "c\"d.md"]` currently returns one fabricated path
  with `issues:[]` and loses both real ones, so `plan-overlap` returns
  `overlaps:[]` on two plans that both write the two real paths. Chosen over
  implementing YAML's double-quoted escape rule in all three scanners, which
  drags YAML's single-versus-double asymmetry into a grammar deliberately
  smaller than YAML. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:456-467,490-501,516-529`;
  `.planning/CAPTURE.md:59`.

## Decisions

- D-07 (the accepted set is fixed by what Cadence writes): the grammar accepts
  inline quoted, inline unquoted, two-space-indented block lists, and a key line
  carrying a trailing `#` comment. Evidence: `cadence-core/templates/PLAN.md:1-6`
  and twenty PLAN files across history. SHIPPED first pass.
- D-08 (`clean()`'s quote strip narrows, forced by D-01): the global `["']`
  strip is a WRAPPING-quote strip, because under D-01 quotes carry meaning and a
  strip firing anywhere in the value destroys the signal the grammar reads.
  D-17 completes the half of this that UAT-9 found missing. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:456`. SHIPPED first pass.
- D-09 (SUPERSEDED by D-19): held the task-line arm and `add()` entirely out of
  scope, filing `add()`'s mangling as a capture item rather than fixing it. The
  frontmatter half of that deferral is reversed; the task-line half stands.
- D-10 (sibling parsers stay out; phase 4 adopts `normalize`): `PHASE_LINE`
  (`:52`) and the snippet parsers (`:192,227`) fail on a CRLF line, and
  `parseUat`'s fence (`:325`) fails on both CRLF and BOM. None is repaired here;
  `PHASE_LINE` / `parseRoadmapPhases` are phase 4's by roadmap, and phase-3 D-08
  bars unifying matchers "for consistency" as a state-machine change smuggled
  into a parser fix.
- D-11 (RESTATED by D-22): budgets move with the prose. The original figures
  (audit.md 2599, execute.md 12140) are pre-first-pass; see D-22.
- D-12 (the return shape is enforced by the typecheck): `readFrontmatterList`
  does not return a bare `string[]`; the diagnostic must survive
  `parsePlanFiles`' `Set` merge with its second source, under
  `// @ts-check` and the required CI typecheck. New codes added this pass are
  unconstrained by the type contract - `Issue` is
  `{line:number, code:string, text:string}` at `:417` - so only the reference's
  code table and the two workflow surfaces must move with them. Evidence:
  `cadence-core/bin/planning.mjs:517,553,571`; `tsconfig.ci.json`.
- D-18 (an unquoted item's trailing annotation is treated symmetrically with
  D-17's quoted case): this falls out of D-19 rather than standing on its own.
  With `add()` off the frontmatter arm, `- src/a.rs (new)` would otherwise yield
  the literal `src/a.rs (new)` while the quoted form yields a clean
  `src/a.rs` - so the asymmetry the annotation already has gets worse, not
  better. Treating trailing content the same way on both forms closes it, and
  tells authors to stop writing the annotation in frontmatter. Nothing in
  `agents/`, `cadence-core/` or `skills/` prose ever teaches it: grepping for
  `(new)` across all three returns nothing.
- D-21 (the second plan lands as `PLAN-2.md`): it matches
  `/^PLAN(-\d+)?\.md$/`, so `audit`, `plan-overlap` and `status` all see it and
  the requirements it covers trace. `PLAN-gaps.md` - the phase-2 precedent at
  `eb6db8f` - does NOT match that pattern, so a gaps plan is invisible to all
  three seams, which is the bookkeeping failure phase 2 of this very cycle
  exists to fix. Overwriting `PLAN.md` was rejected: it destroys the executed
  plan that the SUMMARY commit table and `workflows/verify.md:59`'s
  UAT-regeneration fallback both point at. Known consequence, accepted:
  `plan-overlap --phase 1` will report a real and correct overlap with
  `PLAN.md` on `planning-files.mjs`, and `status` reads phase 1 as a split
  phase. Evidence: `cadence-core/bin/planning.mjs:66,476,535`.
- D-22 (budgets move in the same commit; current figures): `workflows/audit.md`
  is 3002 bytes against budget 3002 and `workflows/execute.md` is 12292 against
  12292 - zero headroom on both, so any byte added to either requires
  `weight-budgets.json` in the same change or CI fails `budget-overrun`.
  Shrinking is free (`self-verify.mjs:341-351` flags only `bytes > budget`).
  `references/` and `templates/` are not walked by
  `lib/surface-weight.mjs:53-78`, so stating the grammar there costs nothing.
  Evidence: `cadence-core/bin/weight-budgets.json:11,19`; `self-verify` is
  currently `{"ok":true,"problems":[]}`.

## Acceptance criteria

- [ ] `plan-overlap` against two plans each shaped `files: [src/a.rs]  # comment`
      followed by `  - src/shared.rs` reports a `frontmatter_issues` entry for
      both plans, and neither plan's files list contains `src/shared.rs`.
- [ ] A block item `- "src/shared.rs" (new)` returns the path `src/shared.rs`
      with a trailing-content diagnostic, and `- src/a.rs (new)` returns
      `src/a.rs` with the same code; no value returned from either contains a
      `"` character.
- [ ] `requirements:["#41"]` produces a `malformed-key-line` diagnostic naming
      that line, and `requirements:` / `- "#41"` / `# files:` /
      `  - src/shared.rs` produces a `commented-key-line` diagnostic.
- [ ] `files: ["a\"b.md", "c\"d.md"]` produces a diagnostic rather than
      `issues: []`.
- [ ] `plan-overlap` reports a path `src/x(1)` and a backtick-bearing path, each
      declared in two plans' `files:` frontmatter, as overlapping byte-exact as
      written - while a `- **Files:** src/a.rs (edit)` task line still
      normalizes to `src/a.rs`.
- [ ] `references/plan-frontmatter.md` and `workflows/audit.md` state for every
      diagnostic code whether it changes `counts` or adds a break, and each
      code's stated behavior matches what the audit seam actually returns for
      that code.
- [ ] `node --test cadence-core/bin/*.test.mjs` and
      `npx tsc -p tsconfig.ci.json` both pass, `self-verify` reports no
      `budget-overrun`, and the new grammar rows for criteria 1-5 are among the
      passing set.

## Flagged assumptions

- Downstream frontmatter-consumer behavior on the shapes this decision set
  touches (`key:value` with no space, `[]` followed by block items, a
  `#`-commented key line inside a block) is untested - Likely harmless; D-01 and
  D-16 both align the grammar WITH real YAML rather than away from it, so the
  risk is reduced rather than measured. No `gray-matter`/`js-yaml` consumer,
  editor highlighter, or static-site parser was tried, and the repo has no YAML
  dependency to inspect. Carried forward from the first pass, unchanged.
- YAML 1.2's exact escape semantics for double- versus single-quoted scalars
  were not verified against the spec - Confident this does not block: D-20 puts
  escapes explicitly OUT of the grammar, so no escape rule is being asserted,
  only detected. Would matter only if a later cycle takes escapes in.
- Whether CRLF or BOM bytes ever really reach a `.planning` file remains
  unrecorded - Unclear, and now resolved as defensive-only by UAT item 15. The
  normalization is not dead code by test, but it has no confirmed live producer.
- A hand-written unquoted `- #41` block item reads as a comment under D-01 and
  is silently dropped - Confident, an accepted cost rather than a defect.
  Nothing in the shipped templates or the repo's own history writes that form.
- D-14 leaves a known over-read in place: a commented-out key line still folds
  the next key's items into the previous key, and audit still mints the
  fabricated orphan - Confident, and deliberate, because the alternative lets a
  prose `# TODO:` comment truncate a real list. It is diagnosed rather than
  silent, which is what the goal requires; it is not correct, which the goal
  does not promise for input outside the grammar.
