# Phase 4: Release prep & docs - Context

Gathered: 2026-07-17
Feeds: /cad-plan 4

## Scope boundary

In: Reconcile the six public docs (README, MANIFESTO, DESIGN, LINEAGE, NOTICE,
CHANGELOG) to the live v1.1 code, fixing drift in place; a DESIGN §6 reversal
narrative (R1 never-auto-push -> opt-in `auto_close` + the one sanctioned
git-publish seam; R2 isPlainPush deletion; R3 `git.auto_push` cut) plus adding
the four rc.2 git keys to DESIGN's git config list; README coverage of the five
shipped v1.1 capabilities with lineage/distillation framing; dropping RTK;
labelling the mass figure as a dated snapshot; adding `plugin.json` `displayName`
and `marketplace.json` `description`; verifying `claude plugin validate --strict`
is clean and the community-store readiness bar is met. Executor does the factual
reconciliation + structure; John drafts the positioning voice (D-10).
Out: The live `plugin.json` version bump and the rc.2 CHANGELOG entry (owned by
the milestone-close seam - Phase 3 mechanism, runs after Phase 4); the actual
community-store submission (web form - readiness only, not submit); any code
change (R2's isPlainPush was already deleted in Phase 2); editing
`git.md`/`cad-land` prose (Phase 2 reconciled it, commit e83a032, and it is
outside the six-doc set); changing plugin keywords (identity-first, GSD-excluded,
settled); recounting the GSD mass ratio (GSD tree absent from this repo).
Deferred:
- Recount of the GSD-vs-Cadence documentary-mass ratio against a current GSD tree
  (needs the GSD source, out of repo) - only if John later wants a fresh number.
- The live community-store submission itself (a post-v1.1.0-publish action via
  the form at clau.de/plugin-directory-submission).
Plan shape: one plan (executor does the facts + a marked hand-draft step for
John's README/LINEAGE positioning voice).

## Decisions

- D-01 (Docs-verify mechanism): Drift in the five prose docs (MANIFESTO, DESIGN,
  LINEAGE, NOTICE, CHANGELOG) is caught only by a human-run `/cad-docs-verify`
  plus manual in-place edits - CI self-verify lints only README, so it will not
  flag stale prose in the other five. Evidence: `cadence-core/bin/self-verify.mjs`
  (lines 6-8 and 118-121 exclude DESIGN/LINEAGE/CHANGELOG, add only `README.md`
  as a live surface); `cadence-core/workflows/docs-verify.md` (reports, never
  rewrites).
- D-02 (git.md / cad-land out of scope, not stale): The `git.md` and `cad-land`
  workflow prose were reconciled to the `auto_close` / git-publish reality in
  Phase 2 (commit e83a032) and are workflow prose outside the six-doc set; not
  edited unless drift resurfaces. The design-reversals brief's "live
  contradictions #1/#2" describe the pre-Phase-2 state and are themselves stale.
  Evidence: `cadence-core/references/git.md:83-108`; `skills/cad-land/SKILL.md:65-96`.
- D-03 (DESIGN is the primary drift site + reversal home): DESIGN.md §6 still
  asserts absolute "Never auto-push" (line 366) and its git config list omits all
  four rc.2 keys; the R1/R2/R3 reversal narrative lands in a new DESIGN §6
  subsection, and the config list gains `integration_branch`, `auto_branch`,
  `on_land_cleanup`, `auto_close`. Evidence: `DESIGN.md:359-373`;
  `cadence-core/config.schema.json:29-34`;
  `design-notes/design-reversals-2026-07-17.md` (R1/R2/R3 doc-home).
- D-04 (R2 is documentation-only): The isPlainPush whitelist was deleted in
  Phase 2 after 4 adversarial review rounds; Phase 4 records the R2 story and
  adds no code change. Evidence: `cadence-core/bin/git-guard.mjs` carries no push
  exemption; `references/git.md:98` ("git-guard now carries NO push exemption").
- D-05 (Version bump + rc.2 CHANGELOG ownership): The `plugin.json` version bump
  and the dated `## [version]` CHANGELOG heading are produced by
  `release-bump.mjs` / `release-decision.mjs` at the milestone close (after
  Phase 4); Phase 4 does not hand-set the version and does not materialize the
  rc.2 CHANGELOG entry. Evidence: `cadence-core/bin/release-bump.mjs:22-25,70-104`;
  `cadence-core/workflows/milestone.md:26-45`; Phase 3 D-08.
- D-06 (Store metadata gaps): Two fields are added - `plugin.json` `displayName`
  and `marketplace.json` `description` (the latter surfaced as the strict-mode
  warning when running `claude plugin validate --strict .`). Keywords stay
  identity-first with GSD excluded (unchanged, already satisfied). Validator
  quirk: it prints "Validation failed" but exits 0, so the check must read the
  output text, not the exit code. Evidence: live `validate --strict` run;
  `.claude-plugin/plugin.json:11-17`; `.claude-plugin/marketplace.json`.
- D-07 (Framing stance): Soften GSD "rewrite/forked" framing to
  lineage/influence/distillation across README/LINEAGE/NOTICE/DESIGN/CHANGELOG;
  keep MANIFESTO's "I forked GSD" as the deliberate rhetorical voice piece.
  Evidence: user decision; `README.md:7`, `LINEAGE.md:3,66,72`, `MANIFESTO.md:3`,
  `CHANGELOG.md:12`, `DESIGN.md:3,171`.
- D-08 (RTK dropped): Remove the lone DESIGN.md RTK reference; no RTK credit
  anywhere; LINEAGE stays GSD-only; attribution stands on Cadence's own merits.
  Evidence: user decision; grep found "rtk" only at `DESIGN.md:10`.
- D-09 (Mass figure = dated snapshot): Keep the "~3%" / word-count figure but
  label every occurrence as measured 2026-07-10 (GSD commit d010ea1); do not
  recount (the GSD tree is absent from this repo). Evidence: user decision;
  `LINEAGE.md:8-9,24`; `README.md:7`; `NOTICE.md:16-17`; `CHANGELOG.md:12`;
  `MANIFESTO.md:3`.
- D-10 (Draft ownership): The executor does the factual reconciliation, the
  DESIGN reversal structure + facts, the metadata, and the CHANGELOG facts; John
  drafts the GSD/RTK positioning voice in README/LINEAGE (crenshaw-voice) and
  supplies the R1 product "why" at draft time. Evidence: user decision;
  CAPTURE.md ("hold the LINEAGE/README wording until John shares more GSD
  impressions").

## Acceptance criteria

- [ ] `/cad-docs-verify` over README, MANIFESTO, DESIGN, LINEAGE, NOTICE, and
      CHANGELOG reports zero unresolved drift - every flagged file path,
      command/skill name, config key, count, and feature claim is accurate or
      corrected in place
- [ ] DESIGN.md contains no absolute "Never auto-push" claim; it documents R1
      (never-auto-push -> opt-in `auto_close` + the one sanctioned git-publish
      seam) and R2 (isPlainPush whitelist deleted) with what-changed / when / why,
      and its git config list names `integration_branch`, `auto_branch`,
      `on_land_cleanup`, and `auto_close`
- [ ] README names all five shipped v1.1 capabilities (integration-branch model,
      land cleanup, `auto_close`, git-publish seam, builtin recall) and frames the
      GSD relationship as lineage/distillation with no "ground-up rewrite" /
      "forked" wording and no RTK reference
- [ ] Across README, LINEAGE, NOTICE, DESIGN, and CHANGELOG, GSD "rewrite/forked"
      framing is replaced with lineage/distillation language (MANIFESTO
      unchanged), and every occurrence of the "~3%" / word-count mass figure is
      labelled as measured 2026-07-10 (commit d010ea1)
- [ ] `.claude-plugin/plugin.json` carries `displayName` and
      `.claude-plugin/marketplace.json` carries a `description`; `claude plugin
      validate --strict .` prints no warnings or errors in its output
- [ ] The community-store readiness bar is met: `plugin.json` `name` is
      kebab-case (`cadence`), README.md and CHANGELOG.md are present at repo root,
      and `version` is valid semver - the release-tag match is produced by the
      milestone-close bump (Phase 3 mechanism), not hand-set here

## Flagged assumptions

- The R1 product "why" (the deeper rationale beyond the UAT-item-9 functional
  trigger that `gh pr create` cannot push a local-only branch) is supplied by
  John at draft time; without it the DESIGN R1 narrative is incomplete - the
  executor leaves a marked placeholder rather than inventing a rationale.
- `claude plugin validate --strict`'s exact warning-vs-error conditions, and
  whether a `plugin.json` <-> `marketplace.json` version mismatch is a rejection,
  are unconfirmed in Anthropic's published docs (store-submission brief open
  questions); the validate-clean check is against this CLI's output here.
- The mass-figure label assumes the 2026-07-10 measurement is the figure of
  record; if John later recounts against a current GSD tree, the number and its
  date change together (see Deferred).
