# Phase 5: A README that asks for a decision - Context

Gathered: 2026-08-19
Feeds: /cad-plan 5

## Scope boundary

In: `README.md` becomes a decision document - plain-language through Install,
an audience/demand section above Install, and the seven staying sections
(opening, demand, Install, The loop, a compressed How it works, What a break
costs, Where it came from). The cost-to-run section and the worked example
relocate to two new `docs/` pages, re-wrapped and accuracy-checked rather than
moved byte-for-byte. The 21-bullet `## The commands` section is CUT, not
relocated - see D-03. `docs/` joins self-verify's markdown lint walk so the
relocated claims stay CI-enforced. The 23 `.planning/DOCS-CLAIMS.md` rows that
follow the moving sections are re-pointed or retired, and every `README-*` line
pin re-derived.

Out: writing any `docs/` command page; rewriting
`cadence-core/references/COMMANDS.md`; widening `/cad-docs-verify`'s default
sweep set (already `README.md` plus `docs/**`); adding a doc-size or
heading-structure check to CI; correcting `.planning/PROJECT.md:77`'s stale
"badge removed" line; the four network- or billing-bound claims listed under
Flagged assumptions.

Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (Register): Plain language runs from line 1 through the end of
  `## Install` - no gate, seam, rung, dispatch, adversarial, traceability or
  subagent vocabulary in that stretch. Cadence's own vocabulary starts at
  `## The loop`, on the reasoning that a reader who has installed it has
  bought in. Rejected: plain opening only (the demand section is the one that
  has to make a stranger do arithmetic about their own habits, so jargon there
  defeats it) and the whole page (What a break costs and Where it came from
  are sections whose specificity IS the argument). Evidence:
  `README.md:1-22`, `.planning/ROADMAP.md:137-145`.
- D-02 (Audience): The demand section names the moments the run stops - before
  it plans, at every check it runs, before it pushes anything - states NO
  count, and carries verbatim "if you want to describe a feature and come back
  to a merged PR, this is the wrong tool". It sits ABOVE `## Install`.
  Rejected: stating fifteen (`docs/WORKFLOW.md:32` counts decision points, of
  which most are system-answered, so fifteen overstates the felt interruption
  while omitting the unconditional push guard at `cadence-core/bin/git-guard.mjs:12-18`)
  and stating the count of unconditional stops (a figure that drifts as gates
  move). Evidence: `README.md:18-22` (687 B, currently BELOW Install),
  `docs/WORKFLOW.md:32-50`, `.planning/CAPTURE.md:241`.
- D-03 (Split): `## The commands` is CUT from `README.md` and no `docs/`
  command page is written. README keeps ONE line pointing at `/cad-help` and at
  `cadence-core/references/COMMANDS.md`; the two or three sharpest bullets fold
  into the compressed How it works. This REVISES the locked 2026-08-18 scope,
  which said the command table moves to `docs/`, on three findings measured
  2026-08-19. First, it is not a table: `README.md:103-133` is 21 bullets in
  argument voice ("It applies none of it", "this is where you read the bill"),
  and it deliberately omits six commands - `/cad-new-project`, `/cad-context`,
  `/cad-plan`, `/cad-execute`, `/cad-verify`, `/cad-progress` - because The loop
  covers the build spine narratively. Second,
  `cadence-core/references/COMMANDS.md` already publishes all 27 in reference
  voice and is readable in the repo by anyone with a browser, so the argument
  for a public copy (a reader without the plugin cannot run `/cad-help`) does
  not hold. Third, it fails the capture decision's own staying test - "the
  argument for why the gates exist rather than material you look things up in" -
  and a section that passes that test does not belong in `docs/` either way.
  Cutting removes 30 lines from a page whose job is to get shorter and creates
  no third surface. Rejected: keeping the 21 bullets on the landing page (costs
  the 30 lines) and moving them as originally scoped (a third wording of the
  same commands with no test joining any of the three). Evidence:
  `README.md:103-133,105`, `cadence-core/references/COMMANDS.md` (27 rows),
  `.planning/CAPTURE.md:241`.
- D-05 (Enforcement): `docs/` joins the `mdFiles` walk in
  `cadence-core/bin/self-verify.mjs:299-345` in THIS phase, and whatever check
  2 surfaces in the three existing pages gets fixed here. Without it, every
  config key, script invocation and repo path that leaves README stops being
  CI-enforced the moment it moves - `docs/EVIDENCE.md:52,59` already carries
  two unchecked `weight.mjs` invocations as the live precedent. Rejected:
  accepting the loss and softening README's claim, and moving narrative only
  (which contradicts the locked split, since the moving sections are exactly
  the key-and-path-dense material). Evidence:
  `cadence-core/bin/self-verify.mjs:299-345`, `docs/EVIDENCE.md:52,59`,
  `.planning/DOCS-CLAIMS.md:39`.
- D-07 (Ledger): The 23 `README-*` rows following the changed sections split
  two ways, and EVERY `README-*` line pin is re-derived from the post-change
  file. Fifteen rows RE-POINT: the six worked-example rows (README-35, -36,
  -37, -73, -74, -85) and the nine cost-to-run rows (README-41, -48, -49, -50,
  -51, -79, -80, -81, -82) get their `doc` cell changed to the new `docs/` path
  with claim text preserved. Six RETIRE under the ledger's existing
  `RETIRED - <reason>` convention, because D-03 cuts their sentence rather than
  moving it: the command-list rows README-39, -40, -76, -77, -78, -86.
  `README-38` and `README-75` each straddle - one cited line changes, one stays -
  and are judged individually. The ledger joins on `doc` plus claim text, so a
  bare move breaks the join and the next sweep reports vanished claims plus new
  extractions instead of a diff. Independently, every pin is already stale by
  exactly 2 (commit `c99b778`'s two-line badge insert), so re-pinning from the
  current numbers would carry that error forward. Evidence:
  `.planning/DOCS-CLAIMS.md:1-8,245-250,290-294,418,882`, commit `c99b778`.
- D-10 (Accuracy): `README.md:142`'s "went from 8,550 bytes to 5,397" is cut
  rather than re-measured; the `weight.mjs resident` pointer stays. It is the
  section's one measurably-false figure (6,034 B across 52 skill+agent
  frontmatter blocks, measured 2026-08-19) and the only one carrying no
  historical frame - `1154790`'s "measured at v2.3.0" is scoped to the
  preceding sentence. Cutting rather than re-measuring is deliberate: a
  re-measured byte count is stale again next cycle, and `docs/EVIDENCE.md:1-16`
  already argues for pointing at checked-in derived data. Evidence:
  `README.md:142`, `.planning/DOCS-CLAIMS.md:518`, `docs/EVIDENCE.md:1-16`.

## Decisions

- D-04 (docs/ conventions): New pages match their three siblings - `# Title`,
  a bold one-line subtitle, no front matter, no `../README.md` back-link (a
  link class no existing docs page has and no check validates), figures linked
  relatively. Relocated paragraphs are re-wrapped to ~80 columns; README wraps
  at up to 1,635 today, so a byte-for-byte move would hide which words the
  accuracy pass changed. Evidence: `docs/DISCOVERY.md:1-3`,
  `docs/WORKFLOW.md:1-3,19`, `docs/EVIDENCE.md:1-4`.
- D-06 (Enforcement): `README.md:150`'s claim - "CI fails the build when the
  prose drifts from the code, because every config key, script flag, and file
  path named in these docs has to actually exist" - stays true as written and
  is NOT softened. This is a consequence of D-05; without it, a claim in a
  STAYING section would be broken by the move. Evidence: `README.md:150`.
- D-08 (Accuracy): The command list was NOT stale, so D-03 cuts accurate
  prose rather than wrong prose. README's 27 named `/cad-*` commands match the
  27 user-invocable skills exactly, and all 21 in `## The commands` exist,
  measured 2026-08-19 by full-set comparison. This settles the phase-2 capture
  note that the range's edges were checked but not every command inside it, and
  it is why the six retiring ledger rows retire as `RETIRED` rather than as
  corrections. Evidence: `.planning/CAPTURE.md:76`,
  `.planning/DOCS-CLAIMS.md:507,1177`.
- D-09 (Accuracy): Phases 1-4 of this cycle invalidated no surviving README
  claim. The only seam README names is `planning.mjs risk-check run` at
  `README.md:60`, which still matches the live return type; the changed reason
  codes (`missing-flag-value`, `bad-date`), the `detect-commands` PATH check
  and `risk-check status`'s worker-key grammar appear nowhere in the file.
  Evidence: `README.md:60`, `cadence-core/bin/lib/risk-diff.mjs:295-296,307,348`,
  `.planning/phases/3/SUMMARY.md`.
- D-11 (Accuracy): `LINEAGE.md`'s published counts are in scope. `README.md:150`
  points at it as the file that publishes the counts while `LINEAGE.md:14-15`
  still reads `| Agents | 34 | 7 |` and `| Skills | 71 | 22 |`; the sentence
  naming it is being rewritten anyway, so shipping a landing page pointing at a
  file that contradicts the sentence above the pointer is not acceptable.
  Evidence: `README.md:150`, `LINEAGE.md:14-15`, `.planning/CAPTURE.md:371`.
- D-12 (Scope): The test badge at `README.md:3` stays as it is.
  `.planning/PROJECT.md:77` records "the README test badge removed rather than
  repointed (HST-01)" while the badge is present again, committed as `c99b778`
  and reconciled at `.planning/CAPTURE.md:616` - the PROJECT.md line is the
  stale half, and correcting it is not this phase. Evidence: `README.md:3`,
  `.planning/PROJECT.md:77`, `.planning/CAPTURE.md:616`.

## Acceptance criteria

- [ ] AC1: `README.md` has no `## The commands`, `## What it costs to run` or
      `## A worked example` heading; two new files under `docs/` carry the
      cost-to-run and worked-example material; no file under `docs/` lists the
      `/cad-*` commands; and `README.md` contains a line naming both
      `/cad-help` and `cadence-core/references/COMMANDS.md`.
- [ ] AC2: The audience/demand section appears above `## Install` in
      `README.md`, contains "if you want to describe a feature and come back to
      a merged PR, this is the wrong tool" verbatim, and states no count of
      decision points or gates.
- [ ] AC3: From line 1 through the end of `## Install`, `README.md` contains
      none of: gate, seam, rung, dispatch, adversarial, traceability, subagent.
- [ ] AC4: `node cadence-core/bin/self-verify.mjs` returns `ok:true` with an
      empty `problems` array, and `grep 'docs/' cadence-core/bin/self-verify.mjs`
      shows `docs/` on the `mdFiles` walk.
- [ ] AC5: `node cadence-core/bin/test.mjs` passes, including
      `prose-agreement.test.mjs:700`'s "27 skills and 6 agent roles across 19
      rung files" match.
- [ ] AC6: No `.planning/DOCS-CLAIMS.md` row has `doc` = `README.md` while its
      claim text lives in a `docs/` file; the six command-list rows (README-39,
      -40, -76, -77, -78, -86) each carry a `RETIRED` verdict; and every
      surviving `README-*` row's cited line number resolves to that claim in the
      current `README.md`.
- [ ] AC7: The string `5,397` appears in neither `README.md` nor any `docs/`
      file, and `LINEAGE.md`'s Agents and Skills counts match the live repo
      counts.

## Flagged assumptions

- The marketplace URL at `README.md:12` serves a plugin marketplace, and
  `/plugin update|uninstall cadence@cadence` are current host spellings -
  Unclear; resolves only over the network, already recorded permanently
  unverifiable at `.planning/DOCS-CLAIMS.md:515,1159`. If wrong: the landing
  page's Install block names a spelling the host rejects.
- The Forgejo Actions badge at `README.md:3` renders - Unclear; the repo has no
  `.forgejo/` directory and the workflow lives at
  `.github/workflows/test.yml`, so whether the self-hosted origin runs it and
  serves a badge cannot be settled in-tree. If wrong: the first thing on the
  page is a broken image.
- The account usage figures at `README.md:138` (7,548 requests, ~92k vs ~133k
  context, ~28c vs ~36c, 27% vs 8%) and the GSD measurements at `:148` -
  Unclear; personal billing data and an external tree, recorded unverifiable at
  `.planning/DOCS-CLAIMS.md:510,516,1179`. If wrong: figures move to `docs/`
  unverified, which is the failure `RME-01` names - but nothing in-tree can
  check them.
- Which two `docs/` filenames carry the cost-to-run section and the worked
  example - left to the planner; D-03 fixes no filename, since no command page
  is written.
- Which two or three `## The commands` bullets are sharp enough to survive into
  the compressed How it works - Unclear, left to the planner. If wrong: the cut
  takes an argument the page needed with it.
