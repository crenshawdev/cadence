---
phase: 3
status: complete
completed: 2026-07-26
---

# Phase 3: planning-files parser robustness - Summary

The shared `.planning` parsers stop minting phantom rows and phantom UAT items,
join unquoted multi-word recall queries, index closed captures with their phase,
and read block-YAML frontmatter lists and name-less phase headings.

## What shipped

- Bounded, de-phantomed Traceability parse - `parseRequirements` cuts at the next
  `## ` heading and skips GFM alignment cells (`cadence-core/bin/lib/planning-files.mjs`)
- First-line-anchored UAT item head plus verbatim round-trip of hand-added `### `
  sections via a new `extras[]` channel (`planning-files.mjs`, `templates/UAT.md`)
- Partial-success `uat merge` with scalar `skipped`/`rejected` counts and a
  usable-name guard on every appended item (`cadence-core/bin/planning.mjs`)
- Closed captures indexed with their phase and a literal `[closed] ` marker
  (`parseCaptureSnippets`)
- Unquoted multi-word `recall` joined through a widened 4-arg handler signature
  (`planning.mjs` dispatch)
- One bounded `readFrontmatterList(text, key)` serving both `requirements:` and
  `files:`, inline / block / scalar forms (`planning-files.mjs`)
- Name-less `### Phase N:` detail heading tolerated by `cutPhaseDetail`
- 12 new seam-level regression tests in `cadence-core/bin/planning.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 7824314 | bound the Traceability parse, stop minting separator rows (#41) |
| 1 | 2 | b09c3ab | anchor the UAT item head, preserve hand-added sections (#46.1) |
| 1 | 3 | 722c24b | uat merge partial-success with rejected/skipped counts (#46.2, #46.3) |
| 1 | 4 | 111b97b | carry the merge counts into verify-deep and its budget (D-13) |
| 1 | 5 | 96de435 | index completed captures with phase and a closed marker (#47.1) |
| 1 | 6 | efb0bdd | join an unquoted multi-word recall query (#47.2) |
| 1 | 7 | ef75864 | read block-YAML requirements/files through one bounded reader (#48.1) |
| 1 | 8 | 914ae6c | cut a name-less `### Phase N:` detail heading (#48.2) |

Range `4b9593b..914ae6c`, 8 commits, 7 files, +422/-41.

## Deviations

- [deviation] Task 7: an initial `assert.equal(byId['#41'].break, undefined)`
  over-asserted - a `Pending` row on an unchecked phase is correctly
  `not-verified`. Corrected to the plan's actual wording
  (`assert.notEqual(..., 'no-plan')`) and re-confirmed failing-capable against
  reverted pre-fix source (ef75864).
- [deviation] Task 1: a first REQUIREMENTS.md edit touched the wrong sentence
  (:22-23, still true, out of scope); reverted before staging, only the
  plan-named sentence at :72-73 changed (7824314).
- [deviation] Task 4: the plan's `grep -E 'auto_passed.*gaps.*added.*skipped.*rejected'`
  requires all five scalars on ONE line, so `verify-deep.md:41` runs to 91 chars
  rather than wrapping at 80 (111b97b).

## Open items

Five findings below are CONFIRMED regressions or defects in code this phase
introduced, each reproduced live. The `diff` trigger is advisory, so none halted
the phase; they are queued in `.planning/CAPTURE.md` for phase 4 or a follow-up
task rather than fixed here.

- **HIGH, regression** - `readFrontmatterList` (`planning-files.mjs:429`) can never
  strip a comment that is the whole remainder. `requirements:   # <comment>`
  followed by a block list reads as the scalar id `# <comment>` and silently
  discards the block items. Pre-fix returned `[]`; post-fix mints a fabricated
  id. Verified end to end: `audit` emits
  `orphans.plan_ids: [{ids:["# phase requirement IDs this plan covers - never empty"]}]`
  plus `break: "no-plan"` on both real ids. This is exactly the over-read D-06
  was written to bound against. Converged independently by `cad-reviewer` (high)
  and `deepseek-v4-flash` (high). Keeping the comment on the key line is the
  natural edit when converting the shipped `templates/PLAN.md` line to block form,
  and no test covers it.
- **MEDIUM, regression** - `usableName` trims on the WRITE path while `find`
  (`planning.mjs:379`) matches with untrimmed strict equality, so a gap named
  `"Login works "` appends a byte-identical duplicate instead of filling the
  pending item. Verified: the file ends with both `### 1. Login works` and
  `### 2. Login works`, envelope `{gaps:1, added:1, skipped:0, rejected:0}`. The
  duplicate is unreachable by name on every later merge, so it blocks phase
  completion - the same permanent phantom the new guard was added to prevent,
  reached by a different route.
- **MEDIUM** - the extras collector (`planning-files.mjs:313`) bounds a preserved
  section at the first `## ` line, which is correct for a real heading but not
  inside a fenced code block. Verified: a `### Repro notes` section whose
  ```` ```sh ```` block contains a `## build output` line is truncated mid-fence,
  destroying the closing fence and the trailing prose, leaving an odd fence count
  so the regenerated `## Summary` renders as code. `templates/UAT.md` now promises
  such a section is "preserved verbatim across seam rewrites", so doc and behavior
  disagree.
- **LOW, regression** - the frontmatter fence is anchored at byte 0 with no `m`
  flag and no tolerance for a leading blank line or BOM, so a PLAN.md beginning
  with one newline loses BOTH lists. Verified side by side: pre-fix
  `["REQ-1","REQ-2"]`, post-fix `[]`, which surfaces as false `no-plan` breaks and
  an `undeclared` plan in `plan-overlap`.
- **LOW** - a `human_checks` entry matching an existing item is dropped with a bare
  `continue` (`planning.mjs:422`) and counted in neither `skipped` nor `rejected`.
  Verified: two entries in, `{added:1, skipped:0, rejected:0}`. This contradicts
  the `verify-deep.md` line Task 4 wrote in this same phase ("a conflicting
  finding is skipped and counted"); `passes`/`gaps` do count that case.

Confirmed but PRE-EXISTING (byte-identical pre- and post-fix, not caused here):

- The inline branch's greedy `\[(.*)\]` mis-parses a comment containing `]`
  (`requirements: ["#41"]  # see [notes]` yields a bogus second entry). The
  shipped template's comment has no brackets, so nothing live trips it.
- An empty `- [x]` capture bullet passes the `if (!raw)` guard before the checkbox
  strip and becomes a content-free `[closed] ` corpus document. New this phase is
  the ranking consequence: BM25 short-doc normalization makes it outrank real
  snippets for a query containing "closed".

Documented-limit consequence worth pricing (within the plan's stated grammar, so
not a defect against the plan):

- A comment line inside a block `files:` list truncates it silently. Verified:
  `files:\n  - src/a.rs\n  # shared with plan 2\n  - src/shared.rs` parses to
  `["src/a.rs"]`, so `plan-overlap` reports `overlaps: []` and would green-light
  two parallel plans that both write `src/shared.rs`. The plan's grammar excludes
  comment-only lines by design and D-14 leaves nothing to report it, but the
  failure mode is a parallel-safety gate passing on an under-read.

Carried from the plan, unchanged:

- The v1.3.1 `## Traceability` table in `.planning/REQUIREMENTS.md` is still empty,
  so `audit` reports this plan's `#41`/`#46`/`#47`/`#48` as `orphans.plan_ids` with
  `counts.total: 0`. Task 1 edited only the stale prose note, never the rows. Needs
  the seeding step at `/cad-verify` - the same step that did not fire at the v1.2.0
  close.
- `readFrontmatterList`'s block grammar is settled only for contiguous `- item`
  lines with an optional trailing ` #` comment, plus a bare scalar. Other
  spellings read as zero or one junk scalar, and D-14 means nothing says so.
- UAT preservation covers hand-added `### ` sections only; a `## `-level section
  added after the items is not preserved and never was.

## Goal check

The eight commits deliver the phase goal for every named issue, with one
qualification that matters. Each of #41, #46, #47, #48 has seam-level regression
tests that the executor confirmed failing-capable against reverted pre-fix source,
and all three CI gates are green on the final tree, which I ran myself rather than
taking on report: `node --test cadence-core/bin/*.test.mjs` gives 312/312 pass,
`node cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`,
and `npx tsc -p tsconfig.ci.json` exits 0. I verified three of the done-truths
independently of the executor: `planning.mjs recall decimal phases` is byte-identical
to the quoted form on the live repo corpus; `parseUat`/`renderUat` on a document
carrying `### Manual notes` is idempotent across two cycles with the section
occurring exactly once and exactly one `### 1. ` heading; and
`cadence-core/workflows/verify-deep.md` is exactly 2083 bytes, matching its bumped
budget entry, with the old "conflicting verifier findings are dropped" wording
absent (`verify-deep.md:41` names all five scalars). The qualification is #48.1:
the new `readFrontmatterList` closes the filed under-read for the block form but
opens a narrower over-read of its own at `planning-files.mjs:429`, where a key line
carrying only a comment is read as a scalar id and its block items discarded. That
is the fabricated-`orphans.plan_ids` failure D-06 explicitly bounds against,
reproduced end to end and converged on by two independent reviewers, so #48.1
should be treated as delivered-with-a-known-hole rather than closed. Nothing looks
missing against the plan's task list; the gaps are in new code, not in unbuilt
scope.
