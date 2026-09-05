// The refusal-VOCABULARY census (CAP-01/CAP-02, phase 3). One question, asked
// forward: is every refusal `reason` token this tree carried before this phase
// still spelled the same way?
// Run: node --test cadence-core/bin/reason-census.test.mjs
//
// WHY IT EXISTS. This phase adds refusal arms to `cadence-core/bin/`, and a
// phase that adds arms is a phase that can quietly rename or delete one on the
// way past. A renamed token is not a cosmetic change: a workflow branching on
// `reason === 'no-payload'` stops branching, silently, and the seam keeps
// answering `ok:false` with a word nobody reads.
//
// THE POPULATION IS DERIVED BY A STATED METHOD, NEVER BY A NUMBER. Two steps:
//
//   1. `refusalSites` from lib/refusal-hints.mjs supplies the sites. It is the
//      scanner self-verify's own check 22 already uses, so there is exactly ONE
//      definition of "this is a refusal" in the tree - a second one here would
//      disagree first about the sites that matter, the ones one reader rejects.
//   2. Of those sites, the ones whose token is a PLAIN STRING LITERAL are kept.
//      The sentinel (`(no reason key)`) and the interpolated ones - template
//      literals, member expressions like `e.seam` and `decision.reason`, and
//      ternaries - are dropped: they are EXPRESSIONS rather than tokens, and
//      pinning one would pin a SHAPE where this census means to pin a WORD.
//
// HOW LITERAL-NESS IS DECIDED, and why it is not the obvious test. `refusalSites`
// returns the token's TEXT and not whether it was quoted, so literal-ness is
// recovered by re-reading the site's own file - comments stripped through the
// same `skim` that scanner uses - and asking whether the token appears there in
// the ANCHORED position `reason: '<token>'` or `fail('<token>'`. The looser test
// (does `'<token>'` appear anywhere in the file) was measured on 2026-08-25 and
// is WRONG: it admits the bare shorthand property `reason` from
// `out({ ok: false, reason, detail })` at five sites, because the word also sits
// quoted somewhere else in those same files. The anchored test partitions the
// live tree cleanly - no token classifies both ways - which is what makes the
// list below re-derivable rather than hand-curated.
//
// MEASURED 2026-08-25 by exactly that method, on this phase's own tree: 266
// in-scope refusal sites under `cadence-core/bin/` across 46 files, 104 distinct
// tokens, of which 82 are plain string literals and 22 are expressions or the
// sentinel. 82 is the length of the list below. TEN of those sites and FIVE of
// those distinct tokens are this phase's own `bin/issue-filing.mjs`, and all
// five land in the expression class for the reason THE BOUND IT INHERITS states
// below - which is why the literal count is the same 82 it was before that seam
// existed, and why re-deriving it on a tree without `issue-filing.mjs` answers
// 256/99/17 instead. Re-derive before trusting any of these five numbers.
// The ROADMAP's figure of 112, measured 2026-08-24, was taken by a method that
// was not written down and cannot be re-derived; this file replaces it with one
// that can, which is the whole reason the method is stated above the number.
//
// ONE-DIRECTIONAL ON PURPOSE. Every token on the list must still be produced by
// the live tree; a token the live tree produces that the list does not carry
// PASSES. ROADMAP criterion 9 requires a refusal arm that necessarily ADDS
// tokens, so a two-directional empty-diff assertion would contradict the phase
// it was written for. A future reader who trips this row is being asked to
// confirm nothing was RENAMED, never to justify a new reason.
//
// WHY THIS IS NOT A REGISTERED CENSUS. Every other hand-maintained list in this
// tree carries a `CADENCE-CENSUS` marker and a `CENSUSES` row in
// lib/census-registry.mjs, so a plan touching its subjects is refused at plan
// time until it declares the holder. This one carries NEITHER, deliberately.
// That refusal exists to stop a plan INVALIDATING a hand-maintained claim, and
// no plan can invalidate this one: the assertion is ONE-DIRECTIONAL, so the only
// edit that can redden it is a rename or a removal, while every other edit under
// `cadence-core/bin/` - which is what a plan touching a seam does - passes
// untouched. A row would therefore fire on plans it has nothing to say about,
// and it would fire on nearly all of them. Measured 2026-08-25 by replaying
// `censusesAtRisk` over this repository's own record, the way
// planning-lease-check.test.mjs's own bound does: 45 plans declare a path under
// `cadence-core/bin/`, so that shipped rail's line is 22.5. Subjects
// `cadence-core/bin/` refuse 44 of the 45; the narrowest HONEST subject set -
// the 40 files carrying a literal refusal token today - still refuses 26. No
// honest subject set clears the bound, and that rail's own message says what
// becomes of a rail that fires wrong: it is deleted, not tuned. So the list is
// held forward by this test alone. The forward assertion was the thing wanted;
// the plan-time nag never was.
//
// THE BOUND IT INHERITS, stated rather than discovered later: a refusal whose
// token is set in a helper's RETURN and emitted through an interpolated
// `reason` is not in `refusalSites`'s population at all (that scanner's own
// D-02 defines a site as the EMITTING call), so its literal never reaches this
// list. Those sites are still watched by check 22 for their hints; they are not
// watched here for their spelling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refusalSites } from './lib/refusal-hints.mjs';
import { skim } from './lib/skim.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The refusal `reason` tokens the tree carried when this census was taken,
 * sorted, one entry per distinct token.
 *
 * This list is HAND-MAINTAINED: it is a claim about the tree, not a snapshot
 * the test recomputes and compares to itself. Removing an entry is legal and
 * means "that refusal is gone on purpose"; adding one is unnecessary, because
 * additions pass by construction.
 */
const REASON_TOKENS = Object.freeze([
  'archive-root-unusable', 'auto-close-off', 'bad-args', 'bad-command', 'bad-date',
  'bad-json', 'bad-payload', 'bad-provider', 'bad-query', 'bad-result', 'bad-schema',
  'bad-shape', 'bad-status', 'cannot-derive', 'carry-dest-unusable',
  'carry-exists', 'census-at-risk', 'collision', 'config-parse-failed', 'create-failed',
  'git-failed', 'http', 'invalid', 'line-count-drift', 'missing-file', 'no-cursor', 'no-diff',
  'no-git', 'no-key', 'no-output', 'no-payload', 'no-phase-dir', 'no-plan', 'no-planning-dir',
  'no-plans', 'no-range', 'no-record', 'no-requirements', 'no-roadmap', 'no-root',
  'no-staged-set', 'no-traceability-table', 'no-uat', 'no-version-field', 'out-of-range',
  'over-cap', 'partial-apply', 'partial-bump', 'partial-flip', 'partial-prune', 'push-failed',
  'read', 'read-failed', 'reap-failed', 'record-exists', 'surfaces-unanswered',
  'the repository selector is not an owner/name a forge serves',
  'this create was not confirmed: no repository is created without the user answering the question first',
  'uat-exists', 'uncommitted-work', 'undeclared-census-files', 'undeclared-files',
  'unknown-item', 'unknown-key', 'unknown-phase', 'unknown-role', 'unparseable-cursor',
  'unparseable-roadmap', 'unprovable-queue', 'unreadable-capture', 'unreadable-changelog',
  'unreadable-git-state', 'unreadable-manifest', 'unreadable-requirements',
  'unreadable-sibling-manifest', 'unrepresentable-paths', 'unresolved', 'unresolved-range',
  'unsupported-extension', 'would-overwrite', 'write-failed',
]);

/** Comment-stripped source per file, read once. `skim` replaces a comment with
 *  its own newlines, so design prose can never contribute a token. */
const sources = new Map();
const sourceOf = (rel) => {
  if (!sources.has(rel)) sources.set(rel, skim(readFileSync(join(REPO, rel), 'utf8')));
  return sources.get(rel);
};

/** Every character a regex would otherwise read as syntax - the tokens include
 *  two full sentences, which carry a `/` and a `(`. */
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is this site's token spelled as a plain string literal in its own file? */
function isLiteral(site) {
  const re = new RegExp(`(?:reason\\s*:|fail\\s*\\()\\s*(['"])${escape(site.token)}\\1`);
  return re.test(sourceOf(site.file));
}

/** The live tree's literal refusal tokens, by the method the header states. */
function liveTokens() {
  const out = new Set();
  for (const site of refusalSites(REPO)) if (isLiteral(site)) out.add(site.token);
  return out;
}

test('every committed refusal token is still produced by the live tree', () => {
  const live = liveTokens();
  const missing = REASON_TOKENS.filter((t) => !live.has(t));
  // Named, never counted: "a token vanished" is only actionable if you know
  // which one, and the fix is a rename to undo or a list entry to delete.
  assert.deepEqual(missing, [],
    `${missing.length} refusal token(s) the tree no longer produces. Either a refusal was `
    + 'RENAMED - in which case every caller branching on the old word is now branching on '
    + 'nothing - or it was deliberately removed, in which case delete its entry here in the '
    + `same commit:\n${missing.map((t) => `  ${t}`).join('\n')}`);
});

test('the census is ONE-DIRECTIONAL: a token the list does not carry passes', () => {
  // The arm above with an entry removed. Criterion 9 requires a refusal arm
  // that necessarily adds tokens, so this direction has to stay legal - and it
  // has to be PROVED legal, or the next phase discovers it by going red.
  const live = liveTokens();
  const shortened = REASON_TOKENS.slice(1);
  assert.deepEqual(shortened.filter((t) => !live.has(t)), []);
  assert.ok(live.size >= REASON_TOKENS.length,
    'the live tree carries at least what the list does');
});

test('the list is sorted, distinct and non-empty, so a paste-back is visible', () => {
  assert.ok(REASON_TOKENS.length > 0);
  assert.deepEqual([...REASON_TOKENS], [...new Set(REASON_TOKENS)].sort(),
    'the list is a sorted set - a duplicate or an out-of-order entry is a bad merge');
});

test('the method reads LITERALS only: no sentinel and no expression is on the list', () => {
  // The half of the derivation that is not visible in the list itself. If
  // `isLiteral` ever admitted an expression, the census would start pinning a
  // variable NAME - a shape - and would redden on a rename that changed no
  // refusal at all.
  for (const t of REASON_TOKENS) {
    assert.ok(!t.startsWith('`'), `${t} is a template literal`);
    assert.ok(!/^[A-Za-z_$][\w$]*\.[\w$.]+$/.test(t), `${t} is a member expression`);
    assert.notEqual(t, '(no reason key)');
  }
});

test('the derivation reaches the whole bin tree, so no arm above is vacuous', () => {
  const sites = refusalSites(REPO);
  assert.ok(sites.length > 200, `only ${sites.length} refusal sites - the scan has gone quiet`);
  const files = new Set(sites.map((s) => s.file));
  assert.ok(files.size > 10, `only ${files.size} files carry a refusal`);
  const literals = sites.filter(isLiteral);
  assert.ok(literals.length > 0 && literals.length < sites.length,
    'both classes are non-empty, so the literal test is not answering the same way twice');
});
