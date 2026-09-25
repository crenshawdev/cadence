// Zero-dep tests for lib/why-record.mjs - the record readers `/cad-why` joins
// a commit through (WHY-01, phase 1 plan 2). See that module's header for the
// design. The fixtures are excerpts of this project's own archived artifacts,
// copied verbatim from the history before `.planning` left the repository: the
// grammar facts these readers are built against were measured on them, so a
// fixture typed out by hand here would be a test of the transcript rather than
// of the corpus. Each excerpt keeps only the lines its reader reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contextDecisions, decisionsFor, MARKER_GAP, parseAdjudication, parseCommitRows,
  declaringTasks, parseDeviations, planTaskBodies, shaMatches, SURVIVED_RULING,
  taskDeclaredFiles,
} from './lib/why-record.mjs';
import { RULINGS } from './lib/adjudication-record.mjs';
import { parseContextDecisions, parseSummarySnippets } from './lib/planning-files.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** This repository's root: bin -> cadence-core -> root. */
const ROOT = join(HERE, '..', '..');

// --- Task 1: the SUMMARY commits-table reader ------------------------------

// `_archive-v3.4.0/1/SUMMARY.md`, its `## Commits` section.
const V340_1 = [
  '## Commits',
  '',
  '| Plan | Task | Commit | Description |',
  '|---|---|---|---|',
  '| 1 | 1 | 97cf861 | Register `git.issue_check` as a config key (schema, template, catalog row, reach row, three weight budgets re-pinned) |',
  '| 1 | 2 | 0053735 | The pure issue-decision core + 15 tests; `gh`/`tea` rows confirmed against installed `--help`, `glab` against published docs |',
  '| 1 | 3 | 51e1299 | The `issue-check` seam, bounded and PATH-resolved, + 7 tests over temp repos and stub binaries |',
  '| 1 | 4 | 22fc54b | Wire the tracker report into `/cad-land` step 1 |',
  '| 1 | 5 | 8f5251e | Fault-inject every degradation path: 11 cases, each reason unique across the matrix |',
  '| 1 | 6 | 9fec27f | Register the key and the check on the public surfaces (COMMANDS, README, 6 ledger rows) |',
  '| 1 | 6 | 149d807 | Move the two tree-wide count pins this phase moved (authorized out-of-lease edit) |',
  '| 1 | fix 1 | 64417f4 | `risk_surface` blocker: keep third-party stderr off the envelope entirely |',
  '| 1 | fix 2 | b9a1f26 | `risk_surface` blocker: the `issue_check` off switch prints nothing, as its own `off` action |',
  '| 1 | fix 3 | ada2659 | `risk_surface` blocker: reject a control character in the parsed origin hostname |',
].join('\n');

test('every row of a real archived ## Commits table returns with its four cells byte-exact', () => {
  const rows = parseCommitRows(V340_1);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], {
    plan: '1',
    task: '1',
    commit: '97cf861',
    description: 'Register `git.issue_check` as a config key (schema, template, catalog row, reach row, three weight budgets re-pinned)',
  });
  assert.deepEqual(rows[1], {
    plan: '1',
    task: '2',
    commit: '0053735',
    description: 'The pure issue-decision core + 15 tests; `gh`/`tea` rows confirmed against installed `--help`, `glab` against published docs',
  });
  assert.deepEqual(rows[9], {
    plan: '1',
    task: 'fix 3',
    commit: 'ada2659',
    description: '`risk_surface` blocker: reject a control character in the parsed origin hostname',
  });
});

test('the fix 1 / fix 2 / fix 3 task cells survive as the strings the record wrote', () => {
  const tasks = parseCommitRows(V340_1).map((r) => r.task);
  assert.deepEqual(tasks, ['1', '2', '3', '4', '5', '6', '6', 'fix 1', 'fix 2', 'fix 3']);
  // The point of the assertion above, stated as the thing that must not happen:
  // Number('fix 1') is NaN, so an integerizing reader attributes three review
  // fixes to no task at all.
  for (const t of tasks) assert.equal(typeof t, 'string');
});

test('the separator row yields no entry', () => {
  const rows = parseCommitRows(V340_1);
  assert.ok(rows.every((r) => !/^[\s|:-]*$/.test(r.commit)), 'no row may come from |---|---|---|---|');
  assert.ok(rows.every((r) => r.plan !== 'Plan'), 'the header row is not a data row either');
});

test('a 7-character abbreviation matches its own full sha by prefix and not a neighbour', () => {
  const full = '00537356bf14084f3676eeeca1c4747146979bc3';
  const neighbour = `0053736${full.slice(7)}`;
  assert.equal(shaMatches('0053735', full), true);
  assert.equal(shaMatches('0053735', neighbour), false);
  assert.equal(shaMatches(full, '0053735'), true, 'the prefix test runs in either direction');
  assert.equal(shaMatches(full.toUpperCase(), '0053735'), true, 'and is case-insensitive');
});

test('an 8-character abbreviation matches its own full sha and not a 7-character neighbour of it', () => {
  const summary = [
    '## Commits',
    '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 2 | 1 | 5bcf4a8c | an eight-character era row |',
    '',
  ].join('\n');
  const [row] = parseCommitRows(summary);
  assert.equal(row.commit, '5bcf4a8c');

  const own = '5bcf4a8c0000000000000000000000000000cafe';
  const neighbour = '5bcf4a8d0000000000000000000000000000cafe';
  assert.equal(shaMatches(row.commit, own), true);
  assert.equal(shaMatches(row.commit, neighbour), false);
  // The 7-character neighbour that a fixed-width slice would confuse it with:
  // `5bcf4a8` prefixes BOTH, which is exactly why an abbreviation is never
  // widened or truncated to a fixed length before it is compared.
  assert.equal(shaMatches('5bcf4a8', own), true);
  assert.equal(shaMatches('5bcf4a8', neighbour), true);
});

test('a blank or non-hexadecimal commit cell matches nothing and mints no row', () => {
  assert.equal(shaMatches('', '00537356bf14084f3676eeeca1c4747146979bc3'), false);
  assert.equal(shaMatches('   ', '00537356bf14084f3676eeeca1c4747146979bc3'), false);
  assert.equal(shaMatches('not-a-sha', '00537356bf14084f3676eeeca1c4747146979bc3'), false);

  const summary = [
    '## Commits',
    '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 1 | 1 | deadbee | a real row |',
    '| 1 | 2 | (reverted) | a note somebody typed into the table |',
    '',
  ].join('\n');
  assert.deepEqual(parseCommitRows(summary).map((r) => r.commit), ['deadbee']);
});

test('a fenced ## line inside the section does not end the table early', () => {
  const summary = [
    '# Phase 9 - Summary',
    '',
    '## Commits',
    '',
    '| Plan | Task | Commit | Description |',
    '|---|---|---|---|',
    '| 1 | 1 | aaaaaaa | before the fence |',
    '',
    'The task quoted the heading it rewrote:',
    '',
    '```markdown',
    '## Deviations',
    '```',
    '',
    '| 1 | 2 | bbbbbbb | after the fence |',
    '',
    '## Deviations',
    '',
    '- [deviation] not a commit row',
    '',
  ].join('\n');
  const rows = parseCommitRows(summary);
  assert.deepEqual(rows.map((r) => r.commit), ['aaaaaaa', 'bbbbbbb'],
    'a fence-blind section bound would drop every row after the fenced ## line');
});

// `_archive-v2.5.0/2/SUMMARY.md`, its `## Commits` section.
const V250_2 = [
  '## Commits',
  '',
  '| Task | Commit | Description |',
  '|---|---|---|',
  '| 1 | a2dfa78 | compose per-command and per-dispatch resident bytes behind `weight.mjs resident` |',
  '| 2 | 01d220a | contract `weight.mjs` in self-verify and give it a prose surface that invokes it |',
  '| 3 | 1489508 | record the pre-cut resident-bytes baseline |',
  '| 4 | 0d11825 | state the size term the break-even rule was missing |',
  "| 5 | 9521954 | defer review-triggers.md out of cad-land's eager load |",
  "| 6 | 48c6b64 | defer review-triggers.md out of cad-plan-review's eager load |",
  '| 7 | a3f6e1c | fail self-verify when a de-preloaded reference has no Read at its step |',
  '| 8 | 292b599 | record the after numbers and the scope corrections |',
  '',
  'Range `a2dfa78..292b599`, 8 commits. Gates at HEAD: **1341 tests pass, 0 fail**;',
  '`tsc -p tsconfig.ci.json` exits 0; `self-verify` `ok:true` across 18 checks with',
  'zero problems.',
].join('\n');

test('the three-column era table maps its cells by header name, never by position', () => {
  // `_archive-v2.5.0/2/SUMMARY.md` predates the Plan column. Read by position
  // its Task cell would be read as a plan and its Commit cell as a task - a
  // wrong join rather than a missing one.
  const rows = parseCommitRows(V250_2);
  assert.ok(rows.length > 0, 'the three-column table still yields rows');
  for (const r of rows) {
    assert.equal(r.plan, '', 'an absent Plan column reads empty rather than shifting the other cells');
    assert.match(r.commit, /^[0-9a-f]{7,40}$/, `the commit cell must hold a commit id, got ${JSON.stringify(r.commit)}`);
    assert.ok(r.description.length > 0);
  }
});

// `_archive-v2.2.0/1/SUMMARY.md`, its headings.
const V220_1 = [
  '# Phase 1: The read face under everything - Summary',
  '## What closed',
  '## The seven-item roster (AC6, D-03)',
  '### `:164` is PARTIALLY closed',
  '## Decisions changed during execution',
  '## PLAN-2 scope deviation',
  '## Open at close',
].join('\n');

test('a summary with no ## Commits section returns no rows rather than throwing', () => {
  assert.deepEqual(parseCommitRows(V220_1), []);
  assert.deepEqual(parseCommitRows(''), []);
  assert.deepEqual(parseCommitRows(undefined), []);
});

// --- Task 4: the decision edge --------------------------------------------

// `_archive-v2.2.0/3/PLAN.md`: its title, its whole `## Context`, and each task's
// heading with the first line of its **Action:**, which carries every D-NN the
// task cites.
const V220_3_PLAN = [
  '# Phase 3: The release seam cannot lie about the release - Plan',
  '',
  '## Context',
  '',
  "CONTEXT.md's D-01 through D-16 are locked; each is either implemented by a",
  'task below or (D-12, D-13) is an explicit exclusion the tasks must not violate. D-01/D-05',
  'set the shape of the whole phase: refusals are verdicts in the pure lib and one',
  '`ok:false`/exit-1 envelope in the seam, following `git-publish.mjs:108,139`.',
  'D-09 keeps the split INTERNALS.md:61 states - the pure `lib/release-decision.mjs`',
  'decides and rewrites text, the seam only reads, calls, writes, emits. D-10 is a',
  'hard guardrail for every task: never run this seam against the repo root, because',
  'the live TOK-02 cost statement must stay under `## [Unreleased]` for',
  '`/cad-milestone` to promote at the close. Baseline at plan time: 1027/1027 tests',
  'pass, `tsc` exits 0, `self-verify` is `ok:true`, `milestone.md` is exactly',
  "7181/7181 bytes. Out of scope: branch naming's prose derivation (D-11), any",
  '`release.*` config key (D-12), a manifest-vs-changelog self-verify check (D-13),',
  'tag policy, and hand-promoting the live CHANGELOG.',
  '',
  '## Tasks',
  '',
  '### Task 1: one refusal envelope, `ok:false` and exit 1, end to end',
  '',
  '- **Action:** D-01, D-05. This is the spine every later task hangs a new refusal',
  '',
  '### Task 2: the shipping number is the explicit `--version`, not prose',
  '',
  "- **Action:** D-03, AC5. Delete `deriveTargetVersion`'s two prose arms and the",
  '',
  '### Task 3: a target that is not a strict upgrade refuses',
  '',
  '- **Action:** D-02, D-05, D-06, D-07, D-08, AC1, AC2. Write the tests FIRST, run',
  '',
  '### Task 4: staged `## [Unreleased]` content is promoted into the dated heading',
  '',
  '- **Action:** D-04, D-09, AC3, AC4. Add a second exported total function',
  '',
  '### Task 5: the close halts on a refusal, and says which number it ships',
  '',
  "- **Action:** D-14, D-15, D-10, AC6, and CONTEXT's recorded deferral.",
  '',
  '## Notes',
].join('\n');

// `_archive-v2.2.0/3/CONTEXT.md`: both decision sections, each bullet's first line.
const V220_3_CONTEXT = [
  '# Phase 3: The release seam cannot lie about the release - Context',
  '',
  '## Durable decisions',
  '',
  '- D-01 (refusal envelope): every refusal in `release-bump.mjs` - downgrade,',
  '- D-02 (compare scope): the version compare is hand-rolled in the pure lib to',
  "- D-03 (explicit target): `deriveTargetVersion`'s prose arms - PROJECT.md",
  '- D-04 (promotion semantics): promotion runs on EVERY run whose',
  '',
  '## Decisions',
  '',
  '- D-05 (refusal is a verdict, not a throw): `decideManifestBump` stays total -',
  '- D-06 (unparseable refuses): an unparseable version on either side (`"latest"`,',
  '- D-07 (no override): the refusal is absolute - no `--allow-downgrade` flag,',
  '- D-08 (siblings): the sibling-manifest loop inherits the guard through the',
  '- D-09 (promotion lives in the pure lib): the text rewrite is an exported',
  '- D-10 (no hand-promotion this phase): the live TOK-02 cost statement stays',
  '- D-11 (branch naming untouched): `activeVersion`, `titleVersion` and',
  '- D-12 (no `release.*` config family): the replacement derivation is',
  '- D-13 (no manifest↔changelog self-verify check): mid-cycle skew is the normal',
  "- D-14 (the workflow halts on refusal): `workflows/milestone.md` - the seam's",
  '- D-15 (budgets): `milestone.md` sits exactly at its byte budget (7181/7181),',
  '- D-16 (test shape): SC1/SC2 are proven by direct-import unit tests in',
  '',
  '## Acceptance criteria',
].join('\n');

test('planTaskBodies cuts a real plan on planTaskTitles own boundaries', () => {
  const bodies = planTaskBodies(V220_3_PLAN);
  assert.equal(bodies.length, 5);
  assert.deepEqual(bodies.map((b) => b.ordinal), [1, 2, 3, 4, 5]);
  assert.equal(bodies[2].title, 'a target that is not a strict upgrade refuses');
  assert.ok(bodies[2].body.startsWith('### Task 3: '));
  assert.ok(!bodies[2].body.includes('### Task 4:'), 'a body stops at the next task heading');
  assert.ok(!bodies[4].body.includes('## Notes'), 'the last body stops at the next ## section, not at end of file');
});

test('planTaskBodies attributes nothing rather than wrongly when the heading count disagrees', () => {
  // `### Task foo` is a heading line this cut would take and `planTaskTitles`
  // would not, because its anchored grammar requires a number. The two counts
  // disagree, so nothing is attributed.
  const mixed = ['### Task 1: real', 'body', '', '### Task foo', 'body'].join('\n');
  assert.deepEqual(planTaskBodies(mixed), []);
  assert.deepEqual(planTaskBodies('# a plan with no tasks'), []);
});

test('contextDecisions unions the durable and the phase-local sections, durable first', () => {
  const durable = parseContextDecisions(V220_3_CONTEXT);
  const all = contextDecisions(V220_3_CONTEXT);
  assert.equal(durable.length, 4, 'the recall surface returns the durable set alone');
  assert.equal(all.length, 16, 'this command needs the phase-local decisions too - they are the answer');
  assert.deepEqual(all.slice(0, 4), durable, 'durable first, verbatim');
  assert.ok(all.some((d) => d.startsWith('D-08 (siblings):')));

  const ids = all.map((d) => d.slice(0, d.indexOf(' ')));
  assert.equal(new Set(ids).size, ids.length, 'no decision is listed twice');
});

test('a legacy CONTEXT with only ## Decisions still yields each decision exactly once', () => {
  const legacy = ['## Decisions', '', '- D-01 (a): first', '- D-02 (b): second', ''].join('\n');
  assert.deepEqual(contextDecisions(legacy), ['D-01 (a): first', 'D-02 (b): second']);
});

test('a task body citing D-08 yields a task-level cite carrying that CONTEXT line verbatim', () => {
  const answer = decisionsFor({
    planText: V220_3_PLAN, contextText: V220_3_CONTEXT, taskCell: '3',
  });
  assert.equal(answer.scope, 'task');
  assert.deepEqual(answer.ids, ['D-02', 'D-05', 'D-06', 'D-07', 'D-08']);
  assert.ok(answer.lines.includes('D-08 (siblings): the sibling-manifest loop inherits the guard through the'),
    `expected the CONTEXT line's own text, got ${JSON.stringify(answer.lines)}`);
});

test("a task cell that names no task falls back to the plan's ## Context cites, labelled plan-scoped", () => {
  // `fix 1` is a real cell in shipped summaries and names a review-fix round,
  // not a task, so there is no body to read and the answer says so by scope.
  const answer = decisionsFor({
    planText: V220_3_PLAN, contextText: V220_3_CONTEXT, taskCell: 'fix 1',
  });
  assert.equal(answer.scope, 'plan');
  assert.ok(answer.ids.includes('D-01'));
  assert.ok(answer.ids.includes('D-05'));
  assert.ok(answer.lines.includes('D-01 (refusal envelope): every refusal in `release-bump.mjs` - downgrade,'));
  assert.ok(answer.lines.includes('D-05 (refusal is a verdict, not a throw): `decideManifestBump` stays total -'));
});

test('a plan naming no D-NN at all yields every decision the CONTEXT carries, phase-scoped', () => {
  const bare = ['# Phase 3 - Plan', '', '## Context', '', 'No decision is cited here.', '',
    '## Tasks', '', '### Task 1: something', '', '- **Action:** do it', ''].join('\n');
  const answer = decisionsFor({ planText: bare, contextText: V220_3_CONTEXT, taskCell: '1' });
  assert.equal(answer.scope, 'phase');
  assert.deepEqual(answer.ids, []);
  assert.deepEqual(answer.lines, contextDecisions(V220_3_CONTEXT));
  assert.equal(answer.lines.length, 16, 'a phase-scoped answer is the whole set, never an empty result');
});

test('a cited decision the CONTEXT does not carry is stated rather than dropped', () => {
  const plan = ['## Context', '', 'This plan turns on D-99.', ''].join('\n');
  const answer = decisionsFor({ planText: plan, contextText: V220_3_CONTEXT, taskCell: '' });
  assert.equal(answer.scope, 'plan');
  assert.deepEqual(answer.ids, ['D-99']);
  assert.deepEqual(answer.lines,
    ["D-99 - cited here, but the phase's CONTEXT.md carries no such decision"]);
});

test('a phase with no CONTEXT.md at all reports absent, not an invented decision', () => {
  const answer = decisionsFor({ planText: V220_3_PLAN, contextText: '', taskCell: '99' });
  assert.equal(answer.scope, 'plan', 'the cites are still real; only their text is missing');
  assert.ok(answer.lines.every((l) => l.includes('carries no such decision')));

  const nothing = decisionsFor({ planText: '# no cites', contextText: '', taskCell: '1' });
  assert.equal(nothing.scope, 'absent');
  assert.deepEqual(nothing.lines, []);
});

// --- Task 5: the deviation edge, and the gap it has to name ----------------

// `_archive-v2.2.0/3/SUMMARY.md`, its `## Deviations` and `## Open items` sections.
const V220_3_SUMMARY = [
  '## Deviations',
  '',
  "- [deviation] Task 2's verify grep hit my own JSDoc naming the removed sources",
  '  in a negative sentence; reworded to carry the meaning without the literal',
  '  tokens so the drift guard stays clean (1dd5ad5).',
  "- [deviation] The sibling loop shares `readManifest`, so a sibling's",
  '  unparseable state needed a call the plan did not make: recorded as',
  "  `{action:'refuse', reason:'unreadable-manifest'}` in `siblings[]`, matching",
  '  D-08 record-without-abort and the task-5 sibling halt (2c3c2cb).',
  '- [deviation] Inline correctness fix: a JSON.parse returning a non-object',
  '  (`null`, number, array) previously reached `manifest.version` and surfaced',
  "  as `reason:'internal'`; now `unreadable-manifest` (2c3c2cb).",
  '- [deviation] `section_empty` is computed in the lib (returned as',
  '  `sectionEmpty`, the seam maps it) rather than in the seam - computing it',
  '  there would duplicate the heading/bounding grammar, the two-homes mistake',
  '  task 3 avoids; D-09 preserved (67f0379).',
  '- [deviation] Task 1 test-count prediction was 19, observed 22 - a miscount of',
  '  the pre-existing baseline, pass/fail exactly as predicted.',
  '- [deviation] The §11 chain is seven per-pair `test()` calls rather than one',
  "  test of pairwise asserts, honoring `retired-keys.test.mjs:4-6`'s",
  '  count-equals-rows convention (86929d4).',
  '',
  '## Open items',
  '',
  'Diff-review survivors (adjudicated, three-voice panel - gemini dropped on a',
  'provider 503; user triaged all six to record-only):',
  '',
  '- HIGH (convergent, live-verified): `plugin.json` present but missing its',
  '  `version` field + valid `--version` -> `skip/no-version-field`, exit 0, no',
  "  changelog write, and `milestone.md`'s halts do not cover that skip reason -",
  '  a close could tag with no bump and no notes.',
  '- HIGH: a `## ` line inside a fenced code block in the Unreleased body',
  '  truncates promotion mid-body (`sectionEnd` is fence-blind).',
  '- MEDIUM (convergent): an Unreleased body of empty scaffold headings',
  '  (`### Added`, no bullets) promotes and reports `section_empty:false` -',
  '  empty-in-substance notes ship and the scaffold is consumed.',
  '- MEDIUM: absent `CHANGELOG.md` -> `changelog:{changed:false}` with no',
  '  distinct signal; the milestone cannot tell "no changelog surface" from a',
  '  clean run.',
  '- LOW (verified): an in-body link-ref definition contiguous with the trailing',
  '  ref block stays under the stub after promotion; refs resolve file-wide, so',
  '  cosmetic.',
  "- LOW: the seam header's verdict-code list names 4 of the 7 lib codes;",
  '  `--version v` refuses with `target:""` under `no-target-version` rather',
  '  than a cleaner shape.',
  '',
  'Other:',
  '',
  '- `review.triggers.diff.gate="adjudicated"` is back in a config layer despite',
  '  the 2026-08-01 CAPTURE decision that the gate stays `blocking`',
  '  (`route.mjs resolve` warns the config wins) - find the layer, remove or',
  '  re-decide.',
  '- `milestone.md` sits at exactly its budget again (8002/8002); the next prose',
  '  edit there must move `weight-budgets.json` in the same commit.',
  '- The sibling-refusal arm remains fixture-exercised only (`marketplace.json`',
  "  carries no `version` field); if one appears, D-08's record-without-abort",
  '  choice needs revisiting.',
  '- Accepted cost (recorded in PLAN Notes, reconfirmed by two diff reviewers):',
  '  a `--version` naming an already-published release is indistinguishable',
  '  inside the seam from a legitimate re-run and will promote into the published',
  '  section; the guard is the milestone workflow confirming the version with',
  '  the user (D-13 declines the cross-check).',
  '',
  '## Goal check',
].join('\n');

test('the deviation reader returns the ## Deviations bullets and none of the ## Open items bullets', () => {
  const bullets = parseDeviations(V220_3_SUMMARY);
  // Six, not the three the plan predicted - counted off the file on 2026-08-23.
  assert.equal(bullets.length, 6);
  assert.equal(bullets[0], "Task 2's verify grep hit my own JSDoc naming the removed sources",
    'the [deviation] tag is stripped and the rest is byte-exact');
  assert.equal(bullets[5], 'The §11 chain is seven per-pair `test()` calls rather than one');
  assert.ok(bullets.every((b) => !b.startsWith('[deviation]')));

  // The `## Open items` section of the same file, which must not leak in: ten
  // bullets, six of them severity-led adjudicated survivors.
  assert.ok(!bullets.some((b) => b.startsWith('HIGH')), 'no severity-led open item');
  assert.ok(!bullets.some((b) => b.startsWith('MEDIUM')));
  assert.ok(!bullets.some((b) => b.startsWith('LOW')));
  assert.ok(!bullets.some((b) => b.includes('Accepted cost')));
  assert.ok(!bullets.some((b) => b.includes('review.triggers.diff.gate')));

  // And the merged reader really does carry both, so the negative above is a
  // separation this reader performs rather than an accident of the fixture.
  const merged = parseSummarySnippets(V220_3_SUMMARY);
  assert.equal(merged.length, 16, 'six deviations plus ten open items, indistinguishable afterwards');
  assert.ok(merged.some((b) => b.startsWith('HIGH (convergent, live-verified):')));
});

test('a fenced ## line inside ## Deviations does not truncate the bullet list', () => {
  const summary = [
    '## Deviations', '',
    '- [deviation] before the fence', '',
    '```markdown', '## Open items', '```', '',
    '- [deviation] after the fence', '',
    '## Open items', '', '- an open item, not a deviation', '',
  ].join('\n');
  assert.deepEqual(parseDeviations(summary), ['before the fence', 'after the fence']);
});

test("the template's own placeholder prose is not a deviation", () => {
  const summary = ['## Deviations', '', '- None.', '- <what went differently>', '', '## Open items', ''].join('\n');
  assert.deepEqual(parseDeviations(summary), []);
  assert.deepEqual(parseDeviations('# a summary with no deviations section'), []);
});

test('MARKER_GAP names the marker the write side prescribes and never says "none"', () => {
  assert.ok(MARKER_GAP.includes('corrected by plan-<k> deviation:'),
    'the marker is named by its literal spelling so a reader can grep for it');
  assert.ok(MARKER_GAP.includes('workflows/execute.md'), 'and so is the workflow that prescribes it');
  assert.ok(/write side/i.test(MARKER_GAP), 'the gap is located on the write side, not reported as an empty result');
});

// --- Task 6: the surviving review finding edge ----------------------------

/** The verbatim bytes of a real adjudication record, recovered from history.
 * No `_archive-*` tree in this repository holds one - they postdate the last
 * archive-mode close - so the on-disk arm is proved on a built fixture and this
 * is the only REAL record of its kind reachable from here. */
const RECOVERED = execFileSync('git',
  ['-C', ROOT, 'show', 'a34b0c8a^:.planning/phases/2/ADJUDICATION-risk_surface-plan-2.json'],
  { encoding: 'utf8' });

test('SURVIVED_RULING is the vocabulary the record module defines, pinned to its literal', () => {
  assert.equal(SURVIVED_RULING, 'survived');
  assert.ok(RULINGS.includes(SURVIVED_RULING));
  assert.equal(RULINGS.length, 3, 'a fourth ruling would need a decision here, not a silent pass');
});

test("a real record's survived entry returns with the reviewer's own words byte-exact", () => {
  const parsed = parseAdjudication(RECOVERED);
  const raw = JSON.parse(RECOVERED);

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.baseId, raw.base_id);
  assert.equal(parsed.headId, raw.head_id);
  assert.equal(parsed.survivors.length, 1);

  const [s] = parsed.survivors;
  const [e] = raw.entries;
  assert.equal(s.claim, e.claim, 'the claim is the reviewer returned bytes, not a paraphrase');
  assert.equal(s.failure_scenario, e.failure_scenario);
  assert.equal(s.file, e.file);
  assert.equal(s.line, e.line);
  assert.equal(s.severity, e.severity);
  assert.equal(s.baseId, e.base_id);
  assert.equal(s.headId, e.head_id);
  // This record carries no `counter_evidence` - an optional field on the entry
  // shape - and an absent one reads null rather than an empty string.
  assert.equal(s.counter_evidence, null);
  assert.ok(s.claim.includes('regular-file shape'));
});

test('two survivors on one record differ on fix_commit and on nothing else', () => {
  // The widened `survived` grammar, read back: one entry names the commit that
  // fixed it and the other was confirmed and left standing. The reader gained a
  // FIELD and no rule (CONTEXT D-08), so both parse and every field they
  // already carried is untouched.
  const raw = JSON.parse(RECOVERED);
  const [e] = raw.entries;
  const fixed = { ...e, severity: 'high', fix_commit: '4a1af326' };
  const unfixed = { ...e, severity: 'medium', line: e.line + 1 };
  delete unfixed.fix_commit;
  const parsed = parseAdjudication(JSON.stringify({ ...raw, entries: [fixed, unfixed] }));

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.survivors.length, 2);
  const [a, b] = parsed.survivors;
  assert.equal(a.fix_commit, '4a1af326');
  assert.equal(b.fix_commit, null, 'no commit is null, the same answer a blank one gives');
  // Everything else the two carry is identical, so the new field is the only
  // difference the caller sees.
  for (const k of ['claim', 'failure_scenario', 'counter_evidence', 'file', 'baseId', 'headId']) {
    assert.deepEqual(a[k], b[k], `${k} must not move when fix_commit does`);
  }
  assert.equal(a.severity, 'high');
  assert.equal(b.severity, 'medium');
});

test('a record an earlier writer produced parses to the same survivors, commit carried', () => {
  // Every `survived` entry in the pre-widening corpus named a commit, because
  // the writer refused any that did not. Such a record must read exactly as it
  // read before, with the new field simply carrying that commit.
  const raw = JSON.parse(RECOVERED);
  const old = { ...raw, entries: [{ ...raw.entries[0], fix_commit: '4a1af326' }] };
  const parsed = parseAdjudication(JSON.stringify(old));
  const before = parseAdjudication(RECOVERED);
  assert.deepEqual(parsed.issues, before.issues);
  assert.equal(parsed.survivors.length, before.survivors.length);
  assert.equal(parsed.survivors[0].fix_commit, '4a1af326');
  const { fix_commit: _drop, ...rest } = parsed.survivors[0];
  const { fix_commit: _drop2, ...restBefore } = before.survivors[0];
  assert.deepEqual(rest, restBefore, 'the field is additive: nothing else moved');
});

test('a non-survived entry does not return', () => {
  // A real record whose two entries were both DOWNGRADED, so the filter is
  // proved against the corpus and not only against a hand-built copy. It read
  // `.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json` in place until
  // the v3.6.0 close (`d8173830`) deleted that directory; the bytes are the
  // same bytes, committed here so a LATER close cannot delete them out from
  // under this case (D-05). Copying a real record is still reading a real
  // record - `fixtures/verbatim.trace.jsonl` is the same move.
  const onDisk = readFileSync(join(HERE, 'fixtures', 'why.adjudication-v3.6.0-1-1.json'), 'utf8');
  const live = parseAdjudication(onDisk);
  assert.equal(live.ok, true);
  assert.equal(JSON.parse(onDisk).entries.length, 2);
  assert.deepEqual(JSON.parse(onDisk).entries.map((e) => e.ruling), ['downgraded', 'downgraded'],
    'the fixture is the both-downgraded record this case is about, not merely a record');
  assert.deepEqual(live.survivors, [], 'two downgraded entries yield no surviving finding');

  // And the third ruling, on a copy of the recovered record.
  const raw = JSON.parse(RECOVERED);
  const refuted = { ...raw, entries: [{ ...raw.entries[0], ruling: 'refuted' }] };
  assert.deepEqual(parseAdjudication(JSON.stringify(refuted)).survivors, []);
});

test('a survivor with no base_id states an unresolvable join and an issue, never a throw', () => {
  const raw = JSON.parse(RECOVERED);
  delete raw.base_id;
  delete raw.entries[0].base_id;

  let parsed;
  assert.doesNotThrow(() => { parsed = parseAdjudication(JSON.stringify(raw)); });
  assert.equal(parsed.survivors.length, 1, 'the finding is not dropped for want of a range');
  assert.equal(parsed.survivors[0].baseId, null);
  assert.equal(parsed.survivors[0].headId, raw.entries[0].head_id);
  assert.deepEqual(parsed.issues, ['survivor-without-a-range']);
});

test('a record-level range covers an entry that does not carry its own', () => {
  const raw = JSON.parse(RECOVERED);
  delete raw.entries[0].base_id;
  delete raw.entries[0].head_id;
  const parsed = parseAdjudication(JSON.stringify(raw));
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.survivors[0].baseId, raw.base_id);
  assert.equal(parsed.survivors[0].headId, raw.head_id);
});

test('a record that will not parse yields one issue and no findings, never a throw', () => {
  for (const [text, issue] of [['{not json', 'unparseable-json'], ['[]', 'not-a-record-object'], ['null', 'not-a-record-object']]) {
    let parsed;
    assert.doesNotThrow(() => { parsed = parseAdjudication(text); });
    assert.equal(parsed.ok, false);
    assert.deepEqual(parsed.survivors, []);
    assert.deepEqual(parsed.issues, [issue]);
  }
  const noEntries = parseAdjudication('{"base_id":"aaaa","head_id":"bbbb"}');
  assert.deepEqual(noEntries.issues, ['no-entries-array']);
  assert.deepEqual(noEntries.survivors, []);
});

// --- Task 7: the task-attributed declared-files edge ----------------------

// `_archive-v2.1.0/1/PLAN.md`: each task's heading and its **Files:** declaration.
const V210_1_PLAN = [
  '# Phase 1: The gate that proved nothing - Plan',
  '',
  '## Tasks',
  '',
  '### Task 1: Repair the red baseline - freeze the phases-1-4 criteria fixture',
  '',
  '- **Files:** cadence-core/bin/planning-files.test.mjs',
  '',
  '### Task 2: The seam - legacy gains its fifth term; a fieldless checklist becomes a named break',
  '',
  '- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/lib/planning-files.mjs',
  '',
  '### Task 3: The fieldless fixtures and the rows that pin every arm',
  '',
  '- **Files:** cadence-core/bin/planning.test.mjs',
  '',
  '### Task 4: `criteria-coverage` states the plugin and fields versions it ran as',
  '',
  '- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs',
  '',
  "### Task 5: `uat merge` persists its findings envelope beside the phase's artifacts",
  '',
  '- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs',
  '',
  '### Task 6: `uat record --criterion` repairs a dropped link, and the contract table admits it',
  '',
  '- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs,',
  '  cadence-core/bin/self-verify.mjs',
  '',
  '### Task 7: State the new rule where the gate is documented',
  '',
  '- **Files:** cadence-core/references/acceptance-criteria.md,',
  '  cadence-core/workflows/audit.md, cadence-core/bin/weight-budgets.json',
  '',
  '### Task 8: State the repair and the persisted envelope where /cad-verify writes',
  '',
  '- **Files:** cadence-core/workflows/verify.md,',
  '  cadence-core/workflows/verify-deep.md, cadence-core/templates/UAT.md,',
  '  cadence-core/bin/weight-budgets.json',
  '',
  '## Notes',
].join('\n');

test("a wrapped Files: line yields both the first line's paths and the continuation's", () => {
  const tasks = taskDeclaredFiles(V210_1_PLAN);
  assert.equal(tasks.length, 8);

  const six = tasks.find((t) => t.ordinal === 6);
  assert.deepEqual(six.files, [
    'cadence-core/bin/planning.mjs',
    'cadence-core/bin/planning.test.mjs',
    'cadence-core/bin/self-verify.mjs',
  ], 'planning.test.mjs comes off the first line and self-verify.mjs off the indented continuation');

  // The single-line arm this reader exists to widen would stop at the newline.
  const singleLine = [...V210_1_PLAN.matchAll(/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm)]
    .map((m) => m[1]).join(' ');
  assert.ok(!singleLine.includes('cadence-core/bin/self-verify.mjs'),
    'a single-line reader really does miss it - the negative that makes this reader necessary');
});

test('every task is attributed to its own heading rather than merged into one set', () => {
  const tasks = taskDeclaredFiles(V210_1_PLAN);
  assert.deepEqual(tasks.find((t) => t.ordinal === 1).files, ['cadence-core/bin/planning-files.test.mjs']);
  assert.deepEqual(tasks.find((t) => t.ordinal === 3).files, ['cadence-core/bin/planning.test.mjs']);
  assert.deepEqual(tasks.find((t) => t.ordinal === 7).files, [
    'cadence-core/references/acceptance-criteria.md',
    'cadence-core/workflows/audit.md',
    'cadence-core/bin/weight-budgets.json',
  ]);
  assert.ok(!tasks.find((t) => t.ordinal === 1).files.includes('cadence-core/bin/self-verify.mjs'),
    'task 6 declaration does not leak into task 1');
});

test('declaringTasks names the task that claimed the queried path, and its declaration', () => {
  const claims = declaringTasks(V210_1_PLAN, 'cadence-core/bin/self-verify.mjs');
  assert.equal(claims.length, 1);
  assert.equal(claims[0].ordinal, 6);
  assert.equal(claims[0].declaration, 'cadence-core/bin/self-verify.mjs');
  assert.ok(claims[0].title.includes('uat record --criterion'));
});

test('containment runs through covers, so a directory lease claims a file it does not name', () => {
  const plan = [
    '### Task 1: the directory lease', '',
    '- **Files:** src/', '- **Action:** everything under it', '',
    '### Task 2: the single file', '',
    '- **Files:** src/auth.js', '- **Action:** just that one', '',
  ].join('\n');

  assert.deepEqual(declaringTasks(plan, 'src/auth.js').map((t) => t.ordinal), [1, 2],
    'the directory lease and the exact declaration both claim it');
  assert.deepEqual(declaringTasks(plan, 'src/other.js').map((t) => t.ordinal), [1],
    'the sibling declaring src/auth.js alone does not claim src/other.js');
  assert.deepEqual(declaringTasks(plan, 'lib/other.js'), []);
});

test('the task-line normalization matches parsePlanFiles: backticks and one trailing parenthetical', () => {
  const plan = [
    '### Task 1: decorated declarations', '',
    '- **Files:** `src/a.js`, src/b.js (the seam), {placeholder}',
    '- **Action:** x', '',
  ].join('\n');
  assert.deepEqual(taskDeclaredFiles(plan)[0].files, ['src/a.js', 'src/b.js']);
});

test('a plan whose task headings do not parse declares nothing rather than something wrong', () => {
  assert.deepEqual(taskDeclaredFiles('# a plan with no tasks'), []);
  assert.deepEqual(declaringTasks('', 'src/a.js'), []);
});
