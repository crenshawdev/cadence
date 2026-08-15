# Phase 1: Authorization the repo grants, not the user - Context

Gathered: 2026-08-15
Feeds: /cad-plan 1

## Scope boundary

In: `git.auto_close` resolves as two distinct booleans - `autoCloseRequested`
from the merged config layer, `autoCloseAuthorized` from the repository layer
alone - and no unattended external mutation runs on ANY host, GitLab included,
without the authorized one. The refusal names which authorization was missing.
The schema purpose string and the reach cell describe the shipped two-boolean
behaviour. Serves AUT-01 and AUT-02.

Out: the skipped-ask / halt pairing itself. `/cad-land` skips the publish ask on
the merged value and the blocking `risk_surface` gate reads that SAME merged
value, deliberately (`config.schema.json:48`) - the gate's halt is what replaces
the human the skip switched off. `0b1c322` collapsed the two to one repo-only
value and was reverted for exactly that reason. This phase ADDS a second
resolution; it moves nothing on the requested side.

Also out: `lib/milestone-prune.mjs` and `issue-check.mjs` (phase 2, separate
files); the open `tornLayerDetail` defect where one corrupt global file refuses
publishing in every repo on the machine (CAPTURE, KEPT) - D-02 routes around it
rather than fixing it.

Deferred: set-time refusal of `--global` for repo-scoped config keys - see D-05.
Seeded to CAPTURE.md `## Seeds` on 2026-08-15 for a later milestone.

Plan shape: one plan.

## Durable decisions

- D-01 (Resolving the two booleans): `autoCloseRequested` keeps its exact
  present sources and NO existing read moves - the merged `config.mjs get
  git.auto_close` in `skills/cad-land/SKILL.md:26` and
  `cadence-core/workflows/milestone.md:10`, and `land-cleanup.mjs gate`'s own
  `mergeLayers` read. The phase adds a second resolution and renames nothing.
  Evidence: `cadence-core/bin/land-cleanup.mjs:127-156` (the merged read plus
  the comment naming `0b1c322` as reverted), `cadence-core/bin/land-cleanup.test.mjs:152-186`
  (four arms pinning the merged read in BOTH layer directions),
  `cadence-core/bin/config-seams.test.mjs:545-587`, `cadence-core/config.schema.json:48`.
  If wrong: re-runs `0b1c322` - the ask stays skipped on the merged value while
  the gate believes no chain is running.
- D-02 (Resolving the two booleans): `autoCloseAuthorized` comes from a repo-layer
  helper that keeps the RAW `JSON.parse` read of `.planning/config.json`,
  extracted from `git-publish.mjs`'s `repoAutoClose` into `lib/` as-is. It is
  NOT derived from `mergeLayers(...).layers.repo`. Two reasons, and the second
  is the load-bearing one: (a) `config.mjs get` cannot answer per-layer at all -
  it destructures `layers` and publishes only `values`, `source` and `warnings`;
  (b) a `mergeLayers`-derived answer inherits the open `tornLayerDetail` defect,
  in which ANY warning - including one from a torn GLOBAL file - refuses the
  operation, which would let a corrupt user-global file WITHDRAW a repository's
  authorization. The raw read fails closed: an unreadable repo layer means no
  opt-in, which is the correct direction for an authorization check. Side
  benefit: no new `mergeLayers(` callsite, so the count pins at
  `self-verify.test.mjs:1591-1592` do not move.
  Evidence: `cadence-core/bin/config.mjs:249-250`, `:287`,
  `cadence-core/bin/lib/config-merge.mjs:222-233`,
  `cadence-core/bin/git-publish.mjs:68-73` (the raw read) vs `:92-96` (the merged
  one), `:116-118` (`tornLayerDetail`).
  If wrong: a torn `.planning/config.json` reads as "not authorized" on one path
  and as `config-parse-failed` on another - two spellings of authorization, the
  same class of split this phase exists to close.
- D-03 (Resolving the two booleans): the phase adds NO new config key. The two
  booleans are two resolutions of the one existing `git.auto_close`.
  Evidence: `.planning/ROADMAP.md:77-82` (the criteria name resolutions, not
  keys), `cadence-core/bin/self-verify.mjs:800-806` (check 1b `inert-config-key`),
  `cadence-core/bin/self-verify.test.mjs:315` (the all-keys prose fixture a new
  key moves).
  If wrong: the v3.4.0 phase-1 deviation repeats exactly - schema, the reach
  table, the all-keys fixture and check 1b prose coverage all move under a lease
  that named none of them.
- D-04 (The GitLab arm): the GitLab gate is an authorization ANSWER the skill
  prose consults before `glab mr create`, never a seam that spawns `glab`. No
  seam in `cadence-core/bin/` runs a forge CLI today: `gh pr create|merge`,
  `glab mr create|merge` and `tea pr create|merge` are all Bash prose the model
  executes from the skill, and the only mutating seam, `git-publish.mjs`, runs
  `git` and nothing else. AUT-02's "resolved-CLI seam the other hosts use"
  therefore means the read-only PATH-resolution pattern in `issue-check.mjs`,
  not an existing publish-CLI seam.
  Evidence: `skills/cad-land/SKILL.md:138-160` (create / merge / confirm, all
  three hosts, all prose), `cadence-core/bin/git-publish.mjs:3-37` and `:14-22`
  (the advisory/acting boundary - why a live push may not live beside advice),
  `cadence-core/bin/issue-check.mjs:16-22` ("Folding them into a seam whose other
  subcommand gates an unattended merge would put a network timeout on the same
  envelope as a merge decision"), `:110-118` (`onPath`, "the one resolution
  site"), `cadence-core/bin/lib/issue-decision.mjs:106-134` (`HOST_TABLE`).
  If wrong: a seam that runs `glab mr create` puts a third-party network CLI's
  failure modes on the same envelope as the merge authorization, and
  `git-publish.mjs`'s header claim about what it is stops being true.
- D-05 (Scope): the WRITE face stays out. `config.mjs set --global
  git.auto_close=true` is accepted today with no scope error and this phase does
  not change that - the user learns at LAND time, from the named refusal (AC4).
  Chosen over refusing `--global` for every repo-scoped key, because 32 keys
  carry the schema `"src": "repo"` marker and that rule changes write behaviour
  for 31 keys this milestone never examined.
  Evidence: `cadence-core/bin/config.mjs:151-172` (`checkPairs` validates
  retired / unknown / type and nothing about layer scope), `:216-234` (`set`
  applies them), no `repoScoped*` symbol anywhere under `cadence-core/bin/`,
  `.planning/CAPTURE.md:503` (the same gap recorded 2026-08-04).
  If wrong: the phase closes AUT-01/02 while a set-time affordance still invites
  the mistake - accepted, and seeded rather than silently dropped.

## Decisions

- D-06 (Resolving the two booleans): `git.auto_close` is untouched by
  `stripGlobalOnly`, so `layers.repo.git.auto_close` carries what the file
  literally said. Evidence: `cadence-core/bin/lib/global-only-keys.mjs:36-40`
  (the set is the three `workflow.test_command` / `workflow.lint_command` /
  `review.key_file` keys), `cadence-core/bin/global-only-keys.test.mjs:82-86`.
- D-07 (The GitLab arm): proving the GitLab refusal takes TWO pins, not one - a
  seam test over `global true / repo unset`, AND a prose pin that the GitLab
  bullet actually calls the seam, because on GitLab the enforcement lands in
  prose and the current prose says the opposite. Evidence:
  `skills/cad-land/SKILL.md:145-146` ("On GitLab `glab mr create` publishes the
  source branch itself, so no seam call is needed there"),
  `cadence-core/references/git-publish.md:24` (same claim in the rails),
  `cadence-core/bin/prose-agreement.test.mjs:727` (the existing precedent for
  this pin shape).
- D-08 (The GitLab arm): the proof mechanism is the PATH-injected stub harness
  already in the suite, with the `$CAD_SPAWN_MARKER` filesystem assertion that
  no forge CLI ran. Measured on this machine 2026-08-15 via `command -v`: `glab`
  ABSENT, `gh` PRESENT, `tea` PRESENT. Evidence:
  `cadence-core/bin/issue-check.test.mjs:1-90` (stub writer, marker assertion,
  and the `GIT_ONLY` bare-PATH construct that exists precisely because `gh` and
  `tea` ARE installed here), `.planning/REQUIREMENTS.md:206`.
- D-09 (The GitLab arm): `land-cleanup.mjs:146` is a COMMENT only - nothing in
  `land-cleanup.mjs` or `close-decision.mjs` reaches the GitLab arm. The fix site
  is `git-publish.mjs` (or a new seam) plus the skill, not the gate file that
  documents the gap. Evidence: `cadence-core/bin/land-cleanup.mjs:142-147`,
  `:154-159` (the whole of `gate()`: config + stdin, then emit),
  `cadence-core/bin/lib/close-decision.mjs:112-127` (`decideGateHalt` takes
  `autoClose` and knows no host).
- D-10 (Where the refusal is worded): the "which authorization was missing" line
  comes from ONE pure core that receives BOTH booleans. Today's single refusal
  site returns `auto-close-off` from `autoClose !== true` alone, which cannot
  tell "off everywhere" from "on globally, repository never opted in" - the exact
  sentence AC4 asks for. Evidence:
  `cadence-core/bin/lib/publish-decision.mjs:35-41` (the refuse ladder), `:64-66`,
  `cadence-core/bin/git-publish.mjs:114`, `:119` (the only emit of it),
  `cadence-core/bin/lib/issue-decision.mjs:315-353` (the sentence-reason
  precedent in this codebase).
- D-11 (Where the refusal is worded): the naming rides `detail` (or a new field);
  `reason` stays the hyphenated token `auto-close-off`, which is asserted by
  equality in at least three places, so changing its text is a test change with
  no behavioural gain. Evidence: `cadence-core/bin/git-publish.test.mjs:91-92`,
  `:134-139`, `cadence-core/bin/config-seams.test.mjs:568-570`,
  `cadence-core/bin/git-publish.mjs:131-132` (the existing `detail` precedent on
  `config-parse-failed`).
- D-12 (Pins and doc surfaces): AC5's schema rewrite is COUPLED to
  `cadence-core/references/config-reach.md:139` by a literal-substring rule -
  check 9's `unstated-reach` requires the reach cell's narrow phrase to appear
  verbatim in the schema purpose, so both files change in one commit or
  self-verify fails. Evidence: `cadence-core/config.schema.json:48` ("Honoured
  repo config layer only for the unattended publish"),
  `cadence-core/references/config-reach.md:139`,
  `cadence-core/bin/self-verify.test.mjs:1122-1139`.
- D-13 (Pins and doc surfaces): exactly two doc surfaces state the GitLab
  non-gating as CORRECT and must change - `skills/cad-land/SKILL.md:145-146` and
  `cadence-core/references/git-publish.md:24`. The rest describe `auto_close`
  generically and are NOT touched: `cadence-core/references/config-catalog.md:47`,
  `docs/WORKFLOW.md:52`, `INTERNALS.md:27`, `METHOD.md:579`, `DESIGN.md:528-546`,
  `skills/cad-milestone/SKILL.md:34`, `cadence-core/workflows/milestone.md:159-162`.
- D-14 (Pins and doc surfaces): step 3's arm numbering (`3(a)` / `3(b)`) stays,
  so check 13's deferred-read anchors do not move even though a new publishing
  bullet lands inside `3(b)`. Evidence:
  `cadence-core/bin/lib/deferred-reads.mjs:169-172` (`anchors: ['3(a)','3(b)']`,
  `read_paragraphs: 2`), `:43-55`,
  `cadence-core/bin/prose-agreement.test.mjs:306-311`.
- D-15 (Pins and doc surfaces): a new bin script needs a CONTRACTS row or check
  14 reports `uncontracted-script`; a new SUBCOMMAND on an existing script needs
  its flag list added to that script's row. Evidence:
  `cadence-core/bin/self-verify.mjs:226`, `:331-343`,
  `cadence-core/bin/self-verify.test.mjs:2085-2106`.

## Acceptance criteria

- [ ] AC1: A config pair where the two values DIFFER (global `true`, repo unset)
      resolves `autoCloseRequested: true` and `autoCloseAuthorized: false`, from
      separate sources, in a failing-capable test. No site produces the
      AUTHORIZED value from a bare `config.mjs get git.auto_close` - the merged
      `get` stays the requested value's source at the sites D-01 locks
      (`skills/cad-land/SKILL.md`, `cadence-core/workflows/milestone.md`).
      (Narrowed 2026-08-15 at the `plan` review gate: as first written this
      sentence barred EITHER value from that bare `get` and so contradicted
      D-01, which locks exactly that read.)
- [ ] AC2: `/cad-land` skips the publish ask on `autoCloseRequested`, and the
      blocking `risk_surface` gate reads that same value. A test fails if the two
      ever read different sources.
- [ ] AC3: Under global-true/repo-unset the GitLab arm refuses, with the
      `$CAD_SPAWN_MARKER` assertion showing no forge CLI ran; and neither
      `skills/cad-land/SKILL.md` nor `cadence-core/references/git-publish.md`
      still states that no seam call is needed on GitLab.
- [ ] AC4: The refusal envelope distinguishes "off everywhere" from "requested
      globally, repository never authorized", emitted from one core, with
      `reason` unchanged as `auto-close-off`.
- [ ] AC5: `config.schema.json`'s `git.auto_close` purpose and
      `cadence-core/references/config-reach.md`'s reach cell both describe the
      two-boolean behaviour including which arm reads which, and `self-verify`
      check 9 reports no `unstated-reach`.
- [ ] AC6: Watched to FAIL first - against the tree as it stands, the GitLab path
      is demonstrated authorizing an unattended merge under global-true/repo-unset,
      before the fix lands.
- [ ] AC7: `node --test 'cadence-core/bin/*.test.mjs'` and
      `node cadence-core/bin/self-verify.mjs` both run clean.

## Flagged assumptions

- Whether the GitLab authorization answer ships as a new `git-publish.mjs`
  subcommand (reusing the existing CONTRACTS row, per D-15) or as a new top-level
  bin seam (a new CONTRACTS row plus a check-14 entry, keeping `git-publish.mjs`
  purely git) is the planner's call - Likely either satisfies D-04; if wrong the
  cost is one CONTRACTS-row edit, not a redesign.
- `cadence-core/references/config-reach.md`'s CONSUMER cell may need a third
  mandatory edit beyond the reach phrase D-12 pins, since it names which seams
  read which value and would otherwise describe a one-consumer world - Likely;
  if wrong, `/cad-docs-verify` finds a stale cell after the phase closes.
- D-14's anchor neutrality assumes the new GitLab bullet lands INSIDE the
  existing `3(b)` region rather than as a new arm - Likely; if wrong, check 13's
  `cad-land` row reports against regions that no longer exist.
