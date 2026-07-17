---
phase: 4
plan: 1
requirements: [RDY-01, RDY-02, RDY-03]
files:
  - README.md
  - DESIGN.md
  - LINEAGE.md
  - NOTICE.md
  - CHANGELOG.md
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
---

# Phase 4: Release prep & docs - Plan

## Goal

Make the v1.1.0 release honest and store-ready: every public doc reconciled to
the shipped v1.1 code, README surfacing the new capabilities with settled
lineage/attribution positioning, DESIGN recording the design reversals, and the
plugin clearing the community plugin-store submission bar.

## Must be true when done

- Running the docs-verify checks over README, MANIFESTO, DESIGN, LINEAGE,
  NOTICE, and CHANGELOG surfaces no unresolved drift - every file path,
  command/skill name, config key, count, and feature claim is accurate or
  corrected in place.
- DESIGN.md carries no absolute "Never auto-push" claim; it documents R1
  (never-auto-push -> opt-in `git.auto_close` + the one sanctioned git-publish
  seam) and R2 (the isPlainPush whitelist deleted) with what-changed / when /
  why, and its git config list names `integration_branch`, `auto_branch`,
  `on_land_cleanup`, and `auto_close`.
- README names all five shipped v1.1 capabilities (integration-branch model,
  land cleanup, `auto_close`, the git-publish seam, builtin recall), carries no
  "ground-up rewrite" / "forked" wording and no RTK reference, and holds a
  marked hand-draft slot where John supplies the GSD lineage/distillation voice.
- Across README, LINEAGE, NOTICE, DESIGN, and CHANGELOG the "rewrite/forked"
  framing is replaced with lineage/distillation language (MANIFESTO untouched),
  and every "~3%" / word-count mass figure is labelled measured 2026-07-10 (GSD
  commit d010ea1).
- `.claude-plugin/plugin.json` carries `displayName` and
  `.claude-plugin/marketplace.json` carries a top-level `description`; `claude
  plugin validate --strict .` prints no warnings or errors in its output text.
- The community-store readiness bar is met: `plugin.json` `name` is kebab-case
  (`cadence`), README.md and CHANGELOG.md are present at repo root, and `version`
  is valid semver - the release-tag match is produced by the milestone-close
  bump, not hand-set here.

## Context

Locked decisions (CONTEXT.md, authoritative): D-01 (only README is CI-linted;
the other five prose docs need the human-run docs-verify pass), D-03 (DESIGN is
the reversal home + config-list drift site), D-05 (version bump + rc.2 CHANGELOG
entry are OWNED by the milestone-close `release-bump.mjs`, run AFTER this phase -
do NOT hand-set version, do NOT materialize the rc.2 CHANGELOG entry), D-06 (add
`plugin.json displayName` + `marketplace.json description`; the validator prints
"Validation failed" but exits 0, so read the OUTPUT TEXT not the exit code),
D-07 (soften GSD "rewrite/forked" to lineage/distillation across
README/LINEAGE/NOTICE/DESIGN/CHANGELOG; MANIFESTO's "I forked GSD" stays as
deliberate voice), D-08 (drop the lone RTK reference at DESIGN.md:10; no RTK
credit anywhere), D-09 (keep the mass figure, label every occurrence measured
2026-07-10 / commit d010ea1; do not recount - GSD tree absent), D-10 (executor
does the factual reconciliation, DESIGN reversal structure+facts, metadata, and
CHANGELOG facts; John drafts the GSD/RTK positioning voice in README/LINEAGE and
the R1 product "why" - those spots get a MARKED hand-draft placeholder, never
invented wording). Out of scope: any code change (R2's isPlainPush was already
deleted in Phase 2), editing `git.md`/`cad-land` prose (Phase 2 reconciled it,
commit e83a032), changing plugin keywords, recounting the GSD mass ratio, and
the actual store-form submission. MANIFESTO.md is read-only here (verified
unchanged). Hand-draft placeholder convention: an HTML comment
`<!-- HAND-DRAFT (John): ... -->` - unmistakable and greppable.

## Tasks

### Task 1: README - cover the five shipped v1.1 capabilities and reconcile the git-model prose

- **Files:** README.md
- **Action:** Make README name all five shipped v1.1 capabilities. Builtin
  recall is already covered (the "Built-in minimal memory" bullet). Add the
  other four so each is named and tied to its real config key from
  `cadence-core/config.schema.json`: the integration-branch model (two-tier -
  a per-milestone integration branch that parallel worktrees fork from and merge
  into, `git.integration_branch` = `milestone` default | `trunk` escape hatch,
  created at cycle start per `git.auto_branch`); land cleanup
  (`git.on_land_cleanup`, default on - after a successful land/merge, return to
  base, pull, reap the merged integration branch); the opt-in end-to-end close
  (`git.auto_close`, default off - runs audit -> tag -> PR -> merge -> reset
  with no per-step prompts, halting on a blocking `pre_ship` FAIL); and the
  sanctioned git-publish seam (the one code-guarded push path Cadence uses to
  publish). Reconcile the now-stale absolute git-model prose to this reality:
  line 5's "a git model that never pushes" and the "Git model" bullet's "never
  auto-pushes" must become factually accurate - the protected-branch guard still
  blocks ad-hoc pushes and the default posture still asks how you publish with
  no preselected default, but a sanctioned git-publish seam exists and
  `auto_close` can publish unattended when explicitly opted in. State it as fact,
  not as positioning. Do NOT touch the GSD lineage sentence at line 7 (that is
  Task 3 / John's voice). Do NOT invent lineage language here.
- **Verify:** each of the five capability terms is individually present (a single combined `grep -c` is NOT falsifiable per-capability - four present terms mask one missing) - `for t in 'integration.branch' 'on_land_cleanup' 'auto_close' 'git-publish' 'builtin'; do grep -Eiq "$t" README.md || echo "MISSING: $t"; done` prints nothing; `grep -ni 'never pushes\|never auto-push' README.md` returns no surviving absolute claim; `node cadence-core/bin/self-verify.mjs` exits 0 (every config key newly named in README resolves against the schema).

### Task 2: DESIGN - reversal narrative, git config-list additions, RTK removal

- **Files:** DESIGN.md
- **Action:** In §6 (git model), delete the absolute "**Never auto-push.**"
  line. Add a new §6 subsection headed "Reversal: the no-auto-push principle and
  the sanctioned publish seam" that documents, with what-changed / when / why:
  R1 - the "workflows never auto-push" founding principle was reversed to an
  opt-in `git.auto_close` (default off) that runs the whole close unattended
  plus the one sanctioned git-publish subprocess seam; decided 2026-07-16, built
  through the rc.2 cycle, UAT 2026-07-17; functional trigger = UAT item 9
  falsified the "platform merge is never a push" assumption because `gh pr
  create` cannot push a local-only branch. State explicitly that the
  no-preselected-default sub-principle was NOT reversed - `auto_close` skips the
  ask, it installs no default. R2 - the `isPlainPush` command-string whitelist
  in git-guard was added then DELETED after four adversarial `risk_surface`
  review rounds (a command-string whitelist is unwinnable against `-c` config
  injection, env-prefix RCE, redirect-glue and bare-push classes); git-guard now
  carries no push exemption and publish flows through the git-publish seam the
  Bash hook cannot see. Cross-reference R3 (the `git.auto_push` switch cut
  2026-07-16, already in §7) so the sequence reads honestly - auto_push cut for
  contradicting "never push", then auto_close reintroduced a sanctioned push.
  Leave a MARKED placeholder `<!-- HAND-DRAFT (John): R1 product why - the deeper
  rationale beyond the item-9 functional trigger -->` for the product rationale
  John supplies at draft time; do not invent it. Update the §6 git config list
  (currently `git { protected_branches, on_protected, base_branch, create_tag }`)
  to also name `integration_branch`, `auto_branch`, `on_land_cleanup`, and
  `auto_close`. Delete the lone RTK reference at line 10 ("rtk for tests") so no
  RTK credit remains anywhere in the repo.
- **Verify:** `grep -ni 'never auto-push' DESIGN.md` returns no absolute claim; DESIGN §6 contains a reversal subsection naming R1 and R2 with what/when/why; `grep -c 'integration_branch\|auto_branch\|on_land_cleanup\|auto_close' DESIGN.md` shows all four keys in the config list; `grep -in rtk DESIGN.md` returns nothing; the `HAND-DRAFT (John): R1 product why` marker is present.

### Task 3: Soften GSD framing to lineage/distillation and date-label the mass figure

- **Files:** README.md, LINEAGE.md, NOTICE.md, DESIGN.md, CHANGELOG.md
- **Action:** Replace the "rewrite / forked / ground-up reimplementation"
  framing with lineage/distillation language in the factual docs the executor
  owns: CHANGELOG.md:12 ("ground-up rewrite" -> distillation phrasing),
  NOTICE.md:17 (keep it lineage-consistent), and DESIGN.md:3 and :171
  ("rewrite descended from GSD" -> lineage/distillation). Do NOT touch
  MANIFESTO.md (its "I forked GSD" is deliberate voice, D-07). For the two
  positioning-voice docs - README.md:7 and LINEAGE.md:3 plus the LINEAGE
  "Why this is a rewrite, not a patched derivative" section (lines ~66-72) - do
  NOT invent wording: strip the "ground-up rewrite" / "reimplementation, not a
  patched derivative" framing and drop in a MARKED placeholder
  `<!-- HAND-DRAFT (John): GSD lineage/distillation framing (crenshaw-voice); no "rewrite"/"forked" -->`
  with a minimal factual stand-in so each doc still reads and commits (the
  measured facts - ~3% retained mass, no patch surface to track - stay intact;
  only the framing verb is Johns to voice). Add the mass-figure date label
  "measured 2026-07-10 (GSD commit d010ea1)" to every "~3%" / word-count
  occurrence that lacks it: README.md:7, NOTICE.md:17, CHANGELOG.md:12 (LINEAGE
  already anchors the date in its line-7 provenance note - ensure its
  ~3% lines read as tied to that snapshot). Do not recount the figure (the GSD
  tree is absent from this repo).
- **Verify:** `grep -Ein 'ground-up rewrite|rewrite descended from GSD|forked|patched derivative|reimplementation' README.md LINEAGE.md NOTICE.md DESIGN.md CHANGELOG.md` returns only lines inside `HAND-DRAFT` markers (or nothing) - the `rewrite descended from GSD` alternative is required so the bare-"rewrite" framing at DESIGN.md:3 and :171 is actually caught, not just the "ground-up rewrite" occurrences; each "~3%"/word-count line in README, NOTICE, and CHANGELOG carries the `2026-07-10` / `d010ea1` label; `git diff --stat MANIFESTO.md` shows no change to MANIFESTO.

### Task 4: Add store-submission metadata to plugin.json and marketplace.json

- **Files:** .claude-plugin/plugin.json, .claude-plugin/marketplace.json
- **Action:** Add `"displayName": "Cadence"` to `.claude-plugin/plugin.json`
  alongside the existing name/description/version/author/homepage/repository/
  license/keywords fields. Add a top-level `"description"` to
  `.claude-plugin/marketplace.json` (the marketplace object currently has only
  name/owner/plugins[] and no top-level description - this is the strict-mode
  warning per D-06); reuse the existing one-line Cadence description string. Do
  NOT change the keywords array (identity-first, GSD-excluded, already settled).
  Do NOT hand-set or bump `version` - it is owned by the milestone-close bump
  (D-05). Keep both files valid JSON.
- **Verify:** `node -e "const p=require('./.claude-plugin/plugin.json'); if(p.displayName!=='Cadence')process.exit(1)"` succeeds; `node -e "const m=require('./.claude-plugin/marketplace.json'); if(typeof m.description!=='string')process.exit(1)"` succeeds.

### Task 5: Validate strict-clean and confirm the community-store readiness bar

- **Files:** .claude-plugin/plugin.json, .claude-plugin/marketplace.json
- **Action:** Run `claude plugin validate --strict .` and read the OUTPUT TEXT,
  not the exit code (D-06: the validator prints "Validation failed" but exits 0,
  so an exit-code check is meaningless here). Resolve every warning or error the
  output text reports - editing only plugin.json / marketplace.json metadata -
  until the output shows no warnings and no errors. Then confirm the
  community-store readiness bar by inspection: plugin.json `name` is kebab-case
  (`cadence`); README.md and CHANGELOG.md exist at repo root; plugin.json
  `version` is valid semver. Do NOT hand-set or bump the version and do NOT try
  to make it match a release tag - the tag-match is produced by the
  milestone-close bump (D-05); the readiness check here verifies valid semver
  only. Do NOT submit the web form.
- **Verify:** `claude plugin validate --strict .` output text contains no line matching `warning` or `error` (case-insensitive); `test -f README.md && test -f CHANGELOG.md`; `node -e "const v=require('./.claude-plugin/plugin.json').version; process.exit(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)?0:1)"` succeeds; `node -e "process.exit(require('./.claude-plugin/plugin.json').name==='cadence'?0:1)"` succeeds.

### Task 6: Final docs-verify sweep - reconcile any remaining drift across the six docs

- **Files:** README.md, MANIFESTO.md, DESIGN.md, LINEAGE.md, NOTICE.md, CHANGELOG.md
- **Action:** Run the docs-verify workflow (`cadence-core/workflows/docs-verify.md`)
  over the six public docs and correct any remaining factual drift in place -
  file paths, command/skill names, the `/cad-*` command inventory, the "22
  skills / 7 agents" counts (both currently accurate against the tree - confirm),
  config keys, other counts, and feature claims must all match live v1.1 code.
  Historical-record guard: the `## [1.0.0]` CHANGELOG entry is a published
  release record - its git-model prose ("never an automatic push":42, "no-push
  rail":86) was accurate for 1.0.0 and must NOT be rewritten to the v1.1
  git-publish/`auto_close` reality. The v1.1 git-model changes belong in the
  dated rc.2 CHANGELOG entry that `release-bump.mjs` writes at the milestone
  close (D-05), which does not exist yet - do not create or preempt it here.
  Task 3's lineage/framing softening inside the 1.0.0 entry (CHANGELOG.md:12) is
  the only sanctioned edit to that entry; leave its feature/git-model claims as
  the historical record they are.
  This is the catch-all for drift the earlier tasks did not touch: per D-01 the
  CI self-verify lints only README, so DESIGN/LINEAGE/NOTICE/CHANGELOG/MANIFESTO
  get their reconciliation only from this human-run pass. Correct facts only - do
  not restyle prose, and leave John's `HAND-DRAFT` positioning placeholders in
  place (they are intended, not drift).
- **Verify:** The docs-verify pass reports no unresolved drift across the six docs (every flagged path/name/key/count/claim is accurate or corrected in place); `node cadence-core/bin/self-verify.mjs` exits 0.

## Notes

- Human hand-off (John, after execution): fill the two/three `HAND-DRAFT (John)`
  markers - the GSD lineage/distillation positioning voice in README.md:7 and
  LINEAGE.md (crenshaw-voice skill), and the R1 product "why" in DESIGN §6. Until
  filled, the docs commit cleanly with factual stand-ins; the positioning voice
  is deliberately Johns and was not invented by the executor (D-10, flagged
  assumption in CONTEXT).
- The version bump and the dated rc.2 CHANGELOG heading are NOT part of this
  phase - `release-bump.mjs` produces them at the milestone close (D-05, Phase 3
  mechanism). Leaving `version` at its current value here is correct.
