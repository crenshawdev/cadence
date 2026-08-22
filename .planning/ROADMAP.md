# Roadmap: v3.5.9 - the defects that were filed and never read

## Overview

**`v3.5.9`, opened 2026-08-22.** Scoped from the tracker, which holds #231 and
#232: ten defects, every one reproduced by execution against the current tree,
filed between 2026-08-05 and 2026-08-08, archived unread in
`.planning/CAPTURE.md`, and re-verified live on 2026-08-22 by the archive triage.

**The theme is one sentence: the release seam and the frontmatter reader both
return a clean answer over a case they did not actually handle.** Every defect
here is a false green, not a crash. A close continues over a manifest that was
never bumped. A changelog promotion truncates at a `## ` inside a fenced block.
A heading with nothing under it passes the empty-section halt. An absent
`CHANGELOG.md` is reported as a clean run. And two plans that write the same file
are cleared to run in parallel worktrees because one of them decorated the path.

The two phases split on subsystem, not on severity, because the two subsystems
fail for different reasons and their tests have nothing in common. Phase 1 is
the release/changelog seam - the seam `v3.5.8` rewrote, where item 6 of #231 and
the open item `v3.5.8` phase 2 filed against `release-decision.mjs`'s JSDoc code
set are the same defect class filed two weeks apart, neither aware of the other.
Phase 2 is the frontmatter reader underneath `plan-overlap`.

**The citations are fresh and should be checked anyway.** Both issues were
re-verified on 2026-08-22 against the current tree, so their line numbers are
days old rather than weeks. `v3.5.8` phase 1 still had to re-derive a stale #145
citation that the file had grown past. Re-run each reproduction before planning
rather than trusting the issue text.

This cycle seeds ids up front - `REL-01`, `REL-02`, `REL-03`, `FRM-01`, `FRM-02` -
so every one is either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.

## Phases

- [ ] **Phase 1: The close that continues over a manifest nobody bumped** - the six release/changelog defects, every one a clean envelope over a case the seam did not handle
- [ ] **Phase 2: The collision plan-overlap was built to catch** - frontmatter issues stop leaking across keys, and a decorated path stops parsing clean

## Phase Details

### Phase 1: The close that continues over a manifest nobody bumped
**Goal:** The release/changelog seam stops returning success, or a benign
`skip`, over inputs it did not actually handle. Six defects, all in
`lib/release-decision.mjs` and `release-bump.mjs`, all reproduced by execution
on 2026-08-22. They share one shape - the seam has an answer for the case it
recognizes and a clean-looking answer for the case it does not - and they are
scoped together because `workflows/milestone.md`'s halt list is the single
caller that has to change to see any of them.
**Depends on:** None
**Requirements:** REL-01, REL-02, REL-03

This is the seam `v3.5.8` rewrote, which is the reason to take it first rather
than last. Item 6 below and the open item `v3.5.8` phase 2 filed against
`release-decision.mjs`'s JSDoc code set are the same defect class in the same
subsystem, filed two weeks apart with neither aware of the other. Closing them
in one pass is also the test of whether the tracker actually surfaces what
`CAPTURE.md` buried.

The open question a plan has to answer is whether `no-version-field` becomes a
REFUSAL (`ok:false`) or stays an `ok:true` action that `workflows/milestone.md`
grows a fifth halt for. The two are not equivalent: a refusal changes the
envelope every caller reads, and a fifth halt leaves the envelope alone and
moves the burden to the one caller that matters today. Decide it on which other
callers exist, and do not carry both.

**Success Criteria:**

1. `release-bump.mjs bump` against a manifest with no `version` field no longer
   lets a close continue: whichever arm the plan chose, a test drives the case
   end to end and proves the close halts rather than proceeding over an
   unbumped manifest.
2. `sectionEnd` tracks fenced code blocks, so a `## ` line inside a fence is not
   a section boundary. A test promotes an `## [Unreleased]` section containing a
   fenced block with a `## ` line in it and proves the fence-close and the
   trailing bullet move with it.
3. `releaseSectionEmpty` reports a section carrying only `### Added` / `### Fixed`
   headings with no bullets as EMPTY, and the close's empty-section halt fires
   on it.
4. An absent `CHANGELOG.md` is distinguishable from a clean run in the envelope,
   and `workflows/milestone.md` names the state. A test asserts the two cases
   return different envelopes.
5. A body-final `[#NN]: url` link-ref definition promotes with its section
   rather than stranding under the `## [Unreleased]` stub, pinned by a test.
6. `release-bump.mjs`'s header documents all seven verdict codes, and
   `--version v` returns a refusal naming the unparseable target rather than
   `no-target-version` with an empty `target`. A test reddens if a code is added
   to the set without reaching the header.
7. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.

### Phase 2: The collision plan-overlap was built to catch
**Goal:** `plan-overlap` can prove file-list independence before a parallel
dispatch. Today it cannot: the frontmatter reader under it attributes issues to
the wrong key and accepts decorated paths as clean, so two plans that write the
same file compare unequal and are cleared into separate worktrees. Both defects
are in `lib/planning-files.mjs`, both reproduced on 2026-08-22.
**Depends on:** None
**Requirements:** FRM-01, FRM-02

Independent of phase 1 by design - different file, different callers, no shared
test surface - so this phase can run in parallel with it if the executor takes
that route. That is worth noting precisely because the defect being fixed here
is the one that decides whether parallel dispatch is safe, and the safety check
for this cycle's own parallelism is the thing under repair. Plan it as if
`plan-overlap` cannot be trusted, because until this phase verifies it cannot.

The narrow existing `backtick-wrapped-value` check is the trap: it fires only on
a boundary backtick, catches the narrowest case, and its presence is why the
gap reads as covered. Widening it is the work; deleting it and starting from
what a path may legally contain is the alternative the plan should weigh.

**Success Criteria:**

1. `readFrontmatterList` returns only the issues belonging to the key the caller
   asked for. A test parses a document whose `goal:` scalar is backtick-wrapped
   and proves the `files:` read comes back with an empty issues array.
2. `parsePlanFiles` flags markdown decoration on a path - at minimum bold
   (`**path**`), the link form `[path](path)`, and non-boundary backticks -
   rather than returning it as a clean file entry.
3. A test proves the flagged cases are reported as issues rather than silently
   normalized, so a decorated path fails loudly instead of being repaired into
   agreement.
4. A test drives `plan-overlap` over two plans that write the same file, one
   plain and one decorated, and proves the collision is DETECTED rather than
   cleared for parallel dispatch. This is the criterion the phase exists for; the
   three above are the parts.
5. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.
