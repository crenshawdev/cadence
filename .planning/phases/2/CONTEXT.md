# Phase 2: The ship gate that FAILs correct docs - Context

Gathered: 2026-08-18
Feeds: /cad-plan 2

## Scope boundary

In: DRF-01 - the residue of the `version_drift` comparand in
`cadence-core/bin/lib/branch-decision.mjs`'s `activeVersion`, which is the
`loose` first-token-anywhere fallback plus the wrapped-continuation line that
anchors below an earlier correct mention. DRF-02 - the sanctioned rolled-over
half of the interrupted-close exemption in `cadence-core/bin/planning.mjs`'s
`settled` predicate and the `audit.md` prose that states it. TAG-01 - upward
repository discovery in `cadence-core/bin/lib/git-tags.mjs`'s `readTags`,
bounded at both callers.

Out: The two adjacent git callsites carrying the same cwd/discovery confusion
phase 1 found in `git rm` - `planning.mjs:2317` (the lease-check staged set)
and `:3540` (`resolveRange`), both calling `rev-parse --show-toplevel` with no
`-C` and no `cwd` and then using the answer as `top`. Recorded here only;
neither is named by DRF-01, DRF-02 or TAG-01, and fixing them widens the phase
into two unrelated seams and their gates. The other six requirements
of `v3.5.4`.

Deferred: None.

Plan shape: multiple plans, same phase - DRF-01 and TAG-01 sit in the
`branch-decision`/`git-tags` cluster `cmdAudit` consumes and share a lease;
DRF-02 is an independent fix site in `planning.mjs` plus workflow prose, with
its own falsifier.

## Durable decisions

- D-01 (DRF-01): The tightening moves the SHARED reader, so
  `git-branch.mjs decide`'s integration-branch refusal changes with it, and
  that behaviour change is recorded rather than avoided. A strictness option
  only the audit passes, and an audit-only second comparand, are both rejected.
  Evidence: `cadence-core/bin/lib/branch-decision.mjs:11-18` states the module
  exports these readers "for exactly ONE other consumer, `planning.mjs
  cmdAudit`'s `version_drift`" and calls a second reader beside this one "the
  drift this module's single-reader discipline exists to prevent";
  `cadence-core/bin/git-branch.mjs:54-63` feeds `integrationBranchName` and
  `readTags` into `decideBranch`; `cadence-core/references/git-guard.md:64,72`
  describes the same derivation in prose.
- D-02 (DRF-01): The `loose` fallback STAYS, gated on agreement - the
  line-anchored token must also be the body's first version token, and a
  disagreement reports nothing rather than the wrong version. Deleting the
  fallback outright, and replacing it with a named diagnostic, are both
  rejected. Evidence: `cadence-core/templates/PROJECT.md`'s `### Active` is a
  requirement bullet list naming no version token at all;
  `cadence-core/bin/branch-decision.test.mjs:255-261` pins the fallback
  deliberately ("a strict anchor would go silent on every pre-existing
  PROJECT.md"); the ROADMAP fallback is not a safety net here -
  `.planning/ROADMAP.md:1` is `# Roadmap` with no version, so `titleVersion`
  returns null on this repository.
- D-03 (DRF-01): This phase REVERSES the DOC-02 prose-agreement pin's D-07
  policy. That test already asserts the two-scan agreement property but
  prescribes fixing the FILE and states the reader is not changed; moving the
  property into `activeVersion` makes its remedy prose wrong, so the pin's
  comment and failure message are rewritten with the fix rather than left
  contradicting it. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:758-812` - "activeVersion() and
  DECLARED_VERSION_RE are NOT changed and get no fallback (D-07)... the file is
  what moves when this goes red", and the failure message "Fix the section -
  declare the milestone on its own line above every mention - rather than the
  anchor".
- D-04 (DRF-02): The rolled-over exemption cannot be derived from the phase
  artifacts or from a close marker, so it is keyed on the requirement rows:
  exempt only when EVERY unsettled phase's requirement rows are `Deferred`. A
  rolled-over phase whose rows are still `Pending` keeps the gate armed.
  Evidence: `cadence-core/references/req-traceability.md:81` makes `Deferred`
  one of three legal Status values; `cadence-core/bin/planning.mjs:1199-1200`
  already collects it and excludes it from breaks;
  `cadence-core/workflows/audit.md:39,120` calls it "the one pinned marker" and
  allows deferred rows; `cadence-core/workflows/milestone.md:121-122` names the
  sanctioned state with the same word ("deferred work that rolls to the next").
- D-05 (DRF-02): A sanctioned rolled-over phase is byte-identical on disk to a
  cycle still being worked, and the two "the close already ran" signals are too
  sparse to key on - so neither a status derivation nor an archive probe is the
  mechanism. Evidence: `derivePhases` at
  `cadence-core/bin/planning.mjs:222-237` gives such a phase
  `unplanned`/`planned`/`executed` with `uat` possibly null; `classifyRoadmap`
  at `cadence-core/bin/lib/planning-files.mjs:151-188` calls a roadmap `closed`
  only at ZERO phases; measured 2026-08-18 against `.planning/`, `ARCHIVE.md`
  holds exactly ONE `## <label>` heading and `_archive-<label>/` exists for 9
  labels, against 20+ closed milestones in `PROJECT.md ### Validated`, with the
  ARCHIVE write conditional at `planning.mjs:4972-4974`.
- D-06 (TAG-01): The containment probe is `git -C <dir> rev-parse` toplevel
  compared against the caller's derived project root - a structured answer, not
  a diagnostic string, so phase 1's D-06 holds. One-level
  `existsSync(join(root, '.git'))` and `GIT_CEILING_DIRECTORIES` are rejected.
  Evidence: precedent `repoRoot` at
  `cadence-core/bin/worktree-base.mjs:79-85`, which resolves via
  `rev-parse --git-common-dir` and degrades to `dir`; measured 2026-08-18 on a
  linked worktree of a tagged fixture repo, the worktree root's `.git` is a
  regular FILE (125 bytes), `rev-parse --show-toplevel` returns the worktree
  root and `git tag --list` returns the shared tag - and this repository does
  run executors in worktrees (`cd5aed6`).
- D-07 (TAG-01): Containment is expressed against a project root derived PER
  CALLER, never against the argument as given, because the two callers pass
  different directories. Evidence: `cmdAudit` receives
  `dir = opts.dir || '.planning'` (`cadence-core/bin/planning.mjs:5158`) and
  `cadence-core/workflows/audit.md:19` invokes the seam with no `--dir`, so the
  live call asks the tag question from `.planning`, which never holds `.git`;
  `cadence-core/bin/git-branch.mjs:63` passes the PROJECT root, joining
  `.planning` itself at `:44` and `:54-57`.
- D-08 (TAG-01): The refusal answers `[]` - permissive, no drift, no new named
  failure reason - rather than a distinguishable "not a repository" signal.
  Evidence: `cadence-core/bin/lib/git-tags.mjs:19-26` already collapses "no
  tags" and "cannot tell" and states why; phase 1's D-05 keeps "not a git
  repository" permissive where the operation is otherwise safe, and reading tags
  is read-only; `cadence-core/bin/planning.test.mjs:2600-2612` already pins
  "no git repo at all leaves the envelope unchanged".

## Decisions

- D-09 (DRF-01): The line-anchor half of DRF-01 ALREADY SHIPPED and is in this
  branch's history; the phase builds only the residue named in the scope
  boundary. Evidence: commit `af370e4` ("fix(2): read the Active milestone
  declaration, not the first token in its prose",
  `git describe --contains` -> `v2.6.0~47`) introduced `DECLARED_VERSION_RE` at
  `cadence-core/bin/lib/branch-decision.mjs:62-69`, with four fixtures at
  `cadence-core/bin/branch-decision.test.mjs:237-266`; the capture item behind
  the requirement (`.planning/CAPTURE.md:26`) describes the pre-`af370e4` reader
  and cites `planning.mjs:998`, which today is inside `cmdUat` - the cite is
  stale and the item was never ticked.
- D-10 (DRF-02): The `blocked` half of DRF-02 ALREADY SHIPPED; only the
  sanctioned rolled-over half is open. Evidence: commit `b3a9346` ("fix(2): stop
  version_drift pinning a repo whose only open item is blocked") introduced the
  `settled` predicate now at `cadence-core/bin/planning.mjs:1300-1318`, which
  accepts `pass`, `blocked` and `skipped`-with-reason, with two fixtures at
  `cadence-core/bin/planning.test.mjs:2552-2586`, and
  `cadence-core/workflows/audit.md:105-113` already lists the always-reachable
  exit first.
- D-11 (mechanics): Any prose change to `audit.md`, `milestone.md` or
  `verify.md` carries a `weight-budgets.json` update in the SAME commit.
  Evidence: `cadence-core/bin/weight-budgets.json:57,66,79` pin `audit.md` at
  12912, `milestone.md` at 11413 and `verify.md` at 17388; `b3a9346`, the
  closest prior fix in this area, touched `weight-budgets.json` alongside
  `audit.md`.
- D-12 (mechanics): The two adjacent no-`-C` git callsites are RECORDED here,
  not fixed and not filed. Evidence: `cadence-core/bin/planning.mjs:2317` and
  `:3540` both call `execFileSync('git', ['rev-parse', '--show-toplevel'], ...)`
  with no `-C` and no `cwd` and then use the answer as `top` for a subsequent
  `-C top` call, the shape recorded in `.planning/phases/1/SUMMARY.md`
  deviations; every other git callsite in the tree passes `-C`
  (`git-tags.mjs:32`, `git-head.mjs:35`, `git-publish.mjs:78,123,165,218`,
  `land-cleanup.mjs:58`, `worktree-base.mjs:81`,
  `planning.mjs:2754,2778,3622`).

## Acceptance criteria

- [ ] AC1: `activeVersion` returns the milestone, never the predecessor, on
      both residue shapes - a body whose first version token is the milestone
      with a later line-anchored predecessor token (the wrapped-continuation
      shape measured at `81bdb5d`), and a body naming the predecessor in prose
      before the milestone.
- [ ] AC2: `activeVersion` still returns the version on a body whose only
      version token appears mid-prose with no line anchor, and the four
      existing `DECLARED_VERSION_RE` fixtures at
      `branch-decision.test.mjs:237-266` pass unchanged.
- [ ] AC3: `prose-agreement.test.mjs`'s DOC-02 test passes and its remedy text
      names changing the reader rather than the file; no occurrence of "Fix the
      section - declare the milestone on its own line above every mention -
      rather than the anchor" survives in the tree.
- [ ] AC4: `audit` run against a project whose sole unsettled phase carries
      requirement rows all marked `Deferred` returns no `version_drift` break,
      and the identical project with those rows `Pending` still returns one.
- [ ] AC5: `audit --dir sub/.planning`, where `sub/` is a non-repository
      project inside a repository tagged `v9.9.0`, returns a `version_drift`
      envelope reporting no published version; the same audit run inside a
      linked worktree of a real tagged repository still reads that
      repository's tags.
- [ ] AC6: DRF-01, DRF-02 and TAG-01 each carry a check with a
      `WATCHED FAILING AT <sha>` header whose sha resolves to a real commit
      preceding the fix, and that check fails when re-run against that commit's
      tree.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and
      `node cadence-core/bin/self-verify.mjs` both exit 0.

## Flagged assumptions

None - all assumptions confirmed.
