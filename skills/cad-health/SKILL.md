---
name: cad-health
description: "Planning-health check - .planning's core docs present, the STATE cursor, ROADMAP and REQUIREMENTS parseable and consistent. Not a traceability audit (that is /cad-audit)"
argument-hint: ""
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - PushNotification
---

<objective>
A fast structural pulse on `.planning/`: presence, parseability and internal
consistency, nothing deeper. It does NOT judge whether requirements were
delivered (that is /cad-audit's job); it judges whether the files are
well-formed enough for the other skills to trust.
</objective>

<process>
Check, then report.

1. **Presence.** `.planning/` exists with PROJECT.md, REQUIREMENTS.md,
   ROADMAP.md, STATE.md. A missing core doc is an issue (if the dir itself is
   absent, point at /cad-new-project for a blank page and /cad-adopt for a repo
   that already has code and history).
   - The run record stays out of git. Run
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace ignore --root . --check`
     and report an issue when `ignored` is false or `tracked` is true. Silent when
     the record is ignored and untracked.
     `--check` writes nothing and this step never edits the records folder's
     `.gitignore`.
     The two flags are separate facts and take DIFFERENT remedies, so name the one
     that applies rather than one command for both: `ignored:false` is a missing
     rule, fixed by the same command without `--check`; `tracked:true` means the
     record is in the index ALREADY, where no ignore rule reaches it, and the fix
     is `git rm --cached .planning/records/trace.jsonl`. Both can be true at once, and
     then both steps are needed.
   - The capture queue, in two calls - a census of the file's sections, and a
     verdict on the walked queue itself:
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture-sections`
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture-check`
     From `capture-sections`, print one line per section whose `in_walk` is
     false, naming its heading and its bullet count, then what the number MEANS
     in one clause: those bullets are invisible to /cad-plan's recall. Silent
     when `exists` is false or every section is in the walk. It is a NAMED NOTE,
     not an issue.
     From `capture-check`, print three things, and these ARE issues.
     `.planning/CAPTURE.md` holds the phase in flight and nothing else, so each
     one says that stopped being true:
     - `substantive` against `bound`, naming the crossing when `over_bound` is
       true.
     - every `annotations[]` entry with its section, line and text.
     - `archive.heading` with `archive.bullets` when `archive.present` is true.
     Print both readings EVERY run, never filtered against a list of sections or
     items you expect.

2. **STATE cursor.** The four required lines (Phase / Status / Next / Updated -
   references/conventions.md) plus the optional `Plan:` line after `Phase:`.
   When ROADMAP has no phases, the no cycle form passes instead: it says in
   words that no cycle is open, carries `Next:` and `Updated:`, and has no
   `Phase:` line.
   `Status` is one of the lifecycle values
   (`ready to plan | context gathered | planned | executed | phase complete |
   paused`). `Phase: N of M` parses with N <= M (except in the closed-milestone
   case rule 5 states). `Updated` is a date. Flag any other fifth line, an unknown status,
   an unparseable phase, or a `Plan:` line not shaped `Plan: K of J` or
   `Plan: K of J (<name>)` (whole numbers, J >= 1, K <= J). Check `Plan:` for
   shape only, never against the phase's plans or reports.

3. **ROADMAP.** `## Phases` entries are `- [ ]` / `- [x]` **Phase N: Name**,
   numbered 1..M with no gaps or dupes. An EMPTY `## Phases` is a legitimately
   closed milestone, not a numbering gap - do not flag it.

4. **REQUIREMENTS.** The traceability table parses; every `Status` is `Pending`,
   `Complete` or `Deferred`; every `Phase` value on a row that isn't `Deferred`
   names a phase that exists in ROADMAP.

5. **Consistency.** Cursor `M` == ROADMAP phase count; cursor `N` is within
   range. When ROADMAP has zero phases, the no cycle form of rule 2 passes
   both clauses, and a surviving `phases/<N>/` dir there means the prune
   was interrupted (/cad-milestone finishes it).
   `.planning/phases/<N>/` dirs correspond to real phases (a planned
   phase with no dir yet is fine; a dir with no phase is an issue). The
   directory grammar is stated in references/roadmap-phases.md: report every
   `phase-dir-grammar` entry
   `planning.mjs status` returns as an issue naming the entries it lists -
   Cadence resolves no other spelling, so those directories are unsupported, and
   renaming them is the user's call and never an auto-fix. Report a
   `phase-dir-collision` entry too, but say the other thing: both names are
   LEGAL and parse to one number, so no spelling is wrong - only ambiguous. A phase
   marked `- [x]` in ROADMAP with a mapped REQUIREMENTS row that isn't
   `Deferred` and isn't `Complete` (or a `Complete` requirement whose phase is
   still `- [ ]`) is a status-drift issue - flag it. `Deferred` rows are exempt.

6. **Inert config.** A setting that is ON and cannot take effect. Check the
   known cases and report each as an issue naming the fix.
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
   - **The testing policy.** Run
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" test-policy check --root .`
     and report its answer, on a failing answer too. `accepted:false` -> the
     one line "No testing policy accepted - `/cad-config --testing` sets one
     up", no issue. Otherwise -> each entry in `problems` is an issue naming its
     fix (the `hint`), and `enforcement:"unavailable"` is a note quoting the
     answer's `note`, not an issue. Always print whether verification
     publishing is authorized here, read off the same answer's
     `publish_authorized` and never off `.git/config` a second way. `false` is a
     state - "publishing for verification not authorized; `/cad-config
     --testing` can authorize it" - and never an issue.

7. **Version drift.** The `PROJECT.md ### Active` milestone version must not be
   one the project has ALREADY SHIPPED. Membership, not sort order: the issue is
   an Active version that equals an existing release TAG (`git tag --list`).
   Report it naming both numbers. No tags, or a version that parses as neither
   semver, is clean: an unprovable comparison is not drift.

   Tags are the publication evidence; a manifest in the checkout is NOT: it
   bumps before the tag. When the manifest equals the Active version and no tag
   does, report it as a distinct, lower note - "the manifest already names the
   active milestone; expected mid-close, stale otherwise" - never as drift.

Report: **healthy** with a one-line all-clear, or a short list of issues, each
with the file and what is wrong. For a trivial, unambiguous fix (cursor `of M`
count off, a stale `Updated`), offer to correct it via the ask-user seam with
`cursor set`, never by editing STATE.md - never auto-edit. Anything structural (missing doc, phase-number gaps) is reported for
the user to resolve, possibly via /cad-phase.

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
