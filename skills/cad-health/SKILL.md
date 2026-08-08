---
name: cad-health
description: "Planning-health check - .planning's core docs present, the STATE cursor, ROADMAP and REQUIREMENTS parseable and consistent. Not a traceability audit (that is /cad-audit)"
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
A fast structural pulse on `.planning/` - can the spine even read its own state?
It checks presence, parseability, and internal consistency, nothing deeper. It
does NOT judge whether requirements were delivered (that is /cad-audit's job);
it judges whether the files are well-formed enough for the other skills to trust.
</objective>

<process>
Check, then report - do not fix without asking.

1. **Presence.** `.planning/` exists with PROJECT.md, REQUIREMENTS.md,
   ROADMAP.md, STATE.md. A missing core doc is an issue (point at
   /cad-new-project if the dir itself is absent).

2. **STATE cursor.** Exactly the 4-line schema (Phase / Status / Next / Updated -
   references/conventions.md). `Status` is one of the lifecycle values
   (`ready to plan | context gathered | planned | executed | phase complete |
   paused`). `Phase: N of M` parses with N <= M (except in the closed-milestone
   case rule 5 states). `Updated` is a date. Flag a 5th line, an unknown status,
   or an unparseable phase.

3. **ROADMAP.** `## Phases` entries are `- [ ]` / `- [x]` **Phase N: Name**,
   numbered 1..M with no gaps or dupes. An EMPTY `## Phases` is a legitimately
   closed milestone, not a numbering gap - do not flag it.

4. **REQUIREMENTS.** The traceability table parses; every `Status` is `Pending`
   or `Complete`; every `Phase` value names a phase that exists in ROADMAP.

5. **Consistency.** Cursor `M` == ROADMAP phase count; cursor `N` is within
   range. When ROADMAP has zero phases the cursor reads `of 0`, and
   `Phase: 1 of 0 (no active cycle)` is the expected closed-milestone shape -
   both clauses pass, and a surviving `phases/<N>/` dir there means the prune
   was interrupted (/cad-milestone finishes it).
   `.planning/phases/<N>/` dirs correspond to real phases (a planned
   phase with no dir yet is fine; a dir with no phase is an issue). A phase
   marked `- [x]` in ROADMAP whose mapped REQUIREMENTS rows are not all
   `Complete` (or a `Complete` requirement whose phase is still `- [ ]`) is a
   status-drift issue - flag it. This is the cheap structural check that a
   phase closed clean; whether the requirement was actually *delivered* is
   /cad-audit's job, not this one.

6. **Inert config.** A setting that is ON and cannot take effect is worse than
   one that is off: the user believes they have the behaviour and never sees it
   missing. Check the known cases and report each as an issue naming the fix.
   - `parallelization.enabled` true while
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/worktree-base.mjs" resolve`
     returns `parallelSafe: false` -> every /cad-execute run has been sequential
     and always will be. Report the resolver's own `reason` and the fix it names
     (`worktree.baseRef` set to `"head"`; /cad-config offers it).
   - `parallelization.enabled` true with `use_worktrees` false -> parallel
     dispatch without isolation is unsupported and falls back to sequential.
   - `review.reviewers` naming a provider with no resolvable credential -> the
     cross-model panel silently degrades to the in-process reviewer. Check
     presence only, NEVER read or print a key's value.
   - `parallelization` present but not an object (e.g. `"parallelization": true`)
     -> the whole block is malformed, every key inside it reads as its schema
     default, and nothing warned. Same for any config block the schema declares
     as an object.

7. **Version drift.** The `PROJECT.md ### Active` milestone version must not be
   one the project has ALREADY SHIPPED. Membership, not sort order: the issue is
   an Active version that equals an existing release TAG (`git tag --list`).
   Report it naming both numbers. No tags, or a version that parses as neither
   semver, is clean: an unprovable comparison is not drift.

   Tags are the publication evidence; a manifest in the checkout is NOT. The
   manifest bumps during the close, before the merge and before the tag, so
   between those points the manifest legitimately names the version still being
   shipped. Reading it as proof would fire on every close in progress. When the
   manifest equals the Active version and no tag does, report it as a
   distinct, lower note - "the manifest already names the active milestone;
   expected mid-close, stale otherwise" - never as drift.
   This is the failure that let a `v2.4.0` ship while this same section still
   described `v2.4.0` as the open, unstarted milestone - nothing read the two
   numbers together.

   Membership is deliberate and must not drift back to "sorts above the newest
   tag". `lib/branch-decision.mjs` refuses an integration branch on exactly this
   test, and the two surfaces have to answer the same question about the same
   repo. Sort order refuses strictly more: an untagged maintenance milestone
   like `v1.9.1` in a repo tagged `v1.9.0` and `v2.0.0` is a legitimate open
   version the guard allows, and a health check calling it drift would push the
   user to renumber or abandon a valid patch release.

Report: **healthy** with a one-line all-clear, or a short list of issues, each
with the file and what is wrong. For a trivial, unambiguous fix (cursor `of M`
count off, a stale `Updated`), offer to correct it via the ask-user seam - never
auto-edit. Anything structural (missing doc, phase-number gaps) is reported for
the user to resolve, possibly via /cad-phase.
</process>
