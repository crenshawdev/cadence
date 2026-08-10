# Cadence design-reversal inventory (2026-07-17)

Untracked working note. Read-only archaeology by a subagent over git history + DESIGN.md +
LINEAGE.md + .planning/. Drives the Phase 3 release-prep task "document reverted design
decisions in DESIGN.md honestly, with rationale." Record note: git history is thin before
2026-07-16 (v1.0.0 landed as squash 606e628; v1.1.0-rc.1 phases pruned in e941051), so early
reversals live in DESIGN.md's own SUPERSEDED prose, not the commit graph; recent (rc.2)
reversals are fully traceable in commits + .planning/.

## Ranked - most important to document for the Anthropic hand-review

1. **R1** auto-push founding principle -> opt-in auto_close. Highest stakes: it's the project's
   stated identity, it's a LIVE contradiction in shipped git.md/cad-land prose, and John already
   flagged it for honest write-up. Product "why" NEEDS JOHN.
2. **R2** isPlainPush exemption -> push seam (nested reversal-of-a-reversal; review subsystem
   caught its own author across 4 rounds). Code still carries the superseded exemption.
3. **R5** npm installer -> plugin. Large, clean, already documented; the model for telling the rest straight.
4. **R6** review CLI (review-cli) -> provider API (review-provider). Well-reasoned in DESIGN §6;
   the CLI-first origin deserves one honest line.
5. **R7** effort dispatch-override assumption reversed by verification. Good-faith "we checked and were wrong."
6. **R3** git.auto_push cut (tie to R1 so the sequence is honest).
7. **R4** the other nine pruned keys (lowest; spec-vs-reality cleanup, already in DESIGN §7).

## R1 - "workflows never auto-push" -> opt-in auto_close that publishes unattended (headline; nested)
- original: "Never auto-push", publish is always the user's no-default call. DESIGN.md:366-368;
  git.md:83-87 rail 3. Reinforced 2026-07-16 when git.auto_push switch was cut (DESIGN.md:372-373).
- reversal: git.auto_close (default off) runs the whole close unattended (audit->tag->PR->merge->reset).
  config.schema.json (3600de7); phase2 CONTEXT D-06/07/08:59-77; cad-land SKILL.md:49-105; git.md:89-102 (12e51b8).
- when: decided 2026-07-16 (CAPTURE.md:22-27), built 3600de7..12e51b8, UAT 2026-07-17.
- why (record): functional trigger = UAT item 9 falsified "no push, platform merge" (gh pr create can't
  push a local-only branch). DEEPER PRODUCT WHY NOT IN RECORD - needs John.
- current doc state: LIVE CONTRADICTION. git.md:91-96 still says "platform merge, not a git push, so
  never-auto-push holds". DESIGN §6 (366,372-373) still absolute "Never auto-push", no seam mention.
- do-not-over-claim: the NO-PRESELECTED-DEFAULT sub-principle was NOT reversed - auto_close skips the ask,
  it does not install a default (D-08). Only the "zero pushes ever" absolute was reversed.
- doc home: new DESIGN §6 subsection "Reversal: the no-auto-push principle and the sanctioned publish seam".

## R2 - isPlainPush command-string exemption -> DELETE it, publish via subprocess push seam (nested in R1)
- original (first fix): isPlainPush WHITELIST in git-guard.mjs exempting a plain publish under repo
  auto_close. PLAN-gaps.md Task 1 (69-112); WIP e194bb4 (git-guard.mjs:170, :256). Still in working tree.
- reversal: delete isPlainPush entirely; publish via a Cadence subprocess push seam the Bash hook can't see.
  STATE.md:5; commits 1b6db52, e194bb4 body.
- when: 2026-07-17 after 4 adversarial risk_surface rounds.
- why (record, fully evidenced): e194bb4 body enumerates bypass classes per round - blacklist gaps;
  -c config injection; GIT_SSH_COMMAND env-prefix RCE + compound smuggling; redirect-glue clobber +
  path-remote exfil + bare-push under push.default=matching. Command-string whitelist is unwinnable.
- current doc state: decision in STATE.md + commit msgs, but CODE STILL HAS the exemption (git-guard.mjs:170-297).
- doc home: same DESIGN §6 subsection, as the "second turn" - an honest illustration of review catching its author.

## R3 - git.auto_push config switch: shipped in schema -> cut (2026-07-16)
- original: git.auto_push bool in config.schema.json.
- reversal: deleted as a dead key whose honored value could only be false (contradicts rail 3).
  DESIGN.md:372-373, §7:380-382; sweep-2026-07-16.md:67-73 (P0 #10). Residue: negative test config.test.mjs:124.
- why: fully evidenced. IRONY TO TELL STRAIGHT: auto_push cut for contradicting "never push", days later
  auto_close reintroduced a sanctioned push (R1). Don't pretend they're unrelated.
- current doc state: accurate in DESIGN §7. doc home: DESIGN §7 + cross-ref from R1.

## R4 - ten designed config keys shipped -> pruned as never-wired (2026-07-16 sweep)
- keys: mode, context_window, workflow.{auto_advance,discuss_mode,human_verify_mode,build_command},
  search.{brave_search,firecrawl,exa_search}, git.auto_push. DESIGN §7:380-382; sweep P1 #10.
- why: dead keys, "built to say no" ethos. git.auto_push is load-bearing (->R3); rest is ordinary cleanup.
- doc home: already in DESIGN §7; likely no own narrative except git.auto_push (R3).

## R5 - distribution: npm copy-installer -> Claude Code plugin
- original (2026-07-10): npx @crenshawdev/cadence install copy into ~/.claude; install.sh --dev symlink.
  DESIGN §1 dec 1 (14-27), §6:173-181; RESUME.md:20-24,46-50.
- reversal: shipped as a Claude Code plugin; npm copy-installer "never built" as the user path.
  DESIGN §5:162-164, §6:173-181 (SUPERSEDED); README.md:19-26.
- why: DESIGN:162 (repo already public; plugin runtime carries the tree, installer redundant).
  Disposable-tree invariant survived. Deeper "why plugin over npm" thinly evidenced - confirm w/ John.
- current doc state: documented honestly with explicit SUPERSEDED annotations. THE EXEMPLAR to imitate.

## R6 - cross-model review seam: CLI subprocess (review-cli) -> provider API (review-provider)
- original: review-cli CLI-subprocess seam + review.backend key. commit 31d55a8 body; RESUME.md:59-60; DESIGN §7:394.
- reversal: direct provider HTTPS call (review-provider.mjs); review.backend -> review.reviewers[]+review.mode
  (config.schema.json:40-41). GSD code_review_command removed (LINEAGE.md:49-51).
- when: 2026-07-10 (31d55a8), same build day. why: DESIGN §6:201-223 (API not CLI: structured output,
  deterministic/testable, trivial panels, clean failure modes).
- current doc state: well documented. minor residue: DESIGN §1 dec4 (40-42) + §6:198 say "Default backend
  claude-subagent" using "backend" after the review.backend KEY was removed - conceptually fine, could confuse.
- doc home: already in DESIGN §6; optional one line that the seam was CLI-first before the API rewrite.

## R7 - model-routing: effort assumed dispatch-overridable -> verified NOT, redesigned to effort-variant files
- original: auto-routing escalates model AND effort per dispatch.
- reversal: verification (claude-code-guide 2026-07-10) found effort is definition-time frontmatter only;
  MODEL is the routing lever, EFFORT fixed per role with *-high/*-low variant agent files (~4 heavy reasoners).
  DESIGN §6:333-347; realized as cad-plan-checker-high (LINEAGE.md:45).
- why: fully evidenced - external capability check reversed a design assumption. Clean "assumed X, verified
  not-X, redesigned" story. doc home: fine where it is; belongs in a consolidated "Decisions that changed".

## Live contradictions to fix (drift from an un-applied reversal)
1. git.md:91-96 - still "platform merge, not a git push, so never-auto-push holds" (falsified by item 9). PLAN-gaps Task 3 (paused).
2. cad-land SKILL.md:65-75 step 4b - still "gh/glab are not git push, hook never prompts". False for GitHub. PLAN-gaps Task 2 (unapplied).
3. git-guard.mjs:170-297 (working tree) - still contains isPlainPush (WIP e194bb4); locked decision says DELETE.
4. DESIGN.md §6 (366,372-373) - "Never auto-push" absolute, no auto_close seam mention; DESIGN hasn't caught up to R1/R2.
5. .planning/phases/2/PLAN-gaps.md (whole file) - documents the abandoned char-class approach; superseded, re-plan pending.

Minor (do not over-fix): DESIGN §1 dec4 + §6:198 "Default backend claude-subagent" wording after review.backend key removal (R6).
