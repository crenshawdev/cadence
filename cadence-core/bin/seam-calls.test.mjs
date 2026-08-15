// The per-workflow seam-invocation census (ENF-01, AC4). ROADMAP criterion 4
// asks that the happy-path seam-call count per workflow DROPS and that the new
// count be stated; this file is where it is stated. A prose sentence or a
// DOCS-CLAIMS.md row would be a claim nothing re-measures (D-18), and phase 5's
// whole premise is that this repo treats a stale self-claim as a defect.
//
// Two files, not every workflow. These are the two the 2026-08-14 scan measured
// unbatched round-trips in, so these are the two whose numbers were paid for; a
// row for a file nobody measured would pin whatever it happens to hold today.
// A file added here later travels with the measurement that justified it.
//
// The numbers are DERIVED, never baselined. A census that pins whatever it
// finds records the bug as correct and can never show a drop, so each row
// carries the arithmetic that produced it from the plan-time measurement:
//
//   plan.md    11 -> 9   the four close lines at its two dispatch moments
//                        collapse to two `trace close` calls (-2). seed-reqs
//                        and `cursor set` move into ONE MESSAGE, which is a
//                        round-trip saving and not a call saving - both
//                        invocations stay, and this count is not where that
//                        saving shows.
//   context.md  6 -> 6   its one dispatch moment's two alternative close lines
//                        collapse to one `trace close` (-1); folding
//                        `planning.commit_docs` into the existing `config.mjs
//                        get` adds a KEY and no call (0); and the phase's own
//                        `criteria-size` call at the end of write_context is a
//                        NEW invocation (+1).
//
// PLAN-2 task 6 stated 5 for `context.md`. That figure omits the +1 its own
// task 3 mandates - the criteria-ceilings call - and 5 is unreachable while
// that call exists. 6 is not "whatever the tree says" either: skipping the
// close collapse, or reading `planning.commit_docs` in a second call, would
// each make it 7, so the row still reddens on every half-done version of this
// phase's work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The SHIPPED invocation spelling, and only it: a `${CLAUDE_PLUGIN_ROOT}`-rooted
// `node` call on a script under cadence-core/bin. Prose naming a subcommand in
// backticks is not a call, and counting one would make a row fail on
// documentation that is exactly right.
const INVOCATION_G = /node "\$\{CLAUDE_PLUGIN_ROOT\}\/cadence-core\/bin\/[a-z-]+\.mjs"/g;

/**
 * How many seam invocations `text` instructs.
 *
 * Shell line continuations are joined FIRST, the way trace.test.mjs's own
 * census does, so a wrapped multi-key `config.mjs get` counts as ONE call and
 * not as several - which matters here more than anywhere, because batching keys
 * onto one wrapped call is exactly the change this census measures.
 * @param {string} text @returns {number}
 */
function seamCalls(text) {
  return (text.replace(/\\\r?\n\s*/g, ' ').match(INVOCATION_G) || []).length;
}

/** Each row: the surface, its derived count, and what a failure means. */
const CENSUS = [
  {
    file: join('cadence-core', 'workflows', 'context.md'),
    calls: 6,
    note: 'cursor get, the batched config.mjs get, recall, trace close, '
      + 'criteria-size, cursor set. A seventh means a call came back - most '
      + 'likely a second config.mjs get at the commit step, which is the '
      + 'round-trip task 4 removed by folding planning.commit_docs into the '
      + 'spend_gate batch.',
  },
  {
    file: join('cadence-core', 'workflows', 'plan.md'),
    calls: 9,
    note: 'status, config.mjs get, plan-size x2, recall, trace close x2, '
      + 'seed-reqs, cursor set. A tenth means a call came back - most likely a '
      + 'restated `trace append --event return` beside a `trace close`, which '
      + 'is the pair one subcommand replaced.',
  },
];

test('the census counter is not dead: it joins continuations and ignores prose', () => {
  // Every row below is vacuous if this is wrong - a counter that matched
  // nothing would report 0 for a file with ten calls and only ever fail loud,
  // but one that matched a WRAPPED call twice would fail on correct prose.
  const wrapped = 'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \\\n'
    + '  memory.backend planning.commit_docs\n';
  assert.equal(seamCalls(wrapped), 1, 'a wrapped multi-key call is ONE invocation');
  assert.equal(seamCalls(wrapped + wrapped), 2);
  assert.equal(seamCalls('Run `planning.mjs criteria-size --phase 4` at that step.'), 0,
    'a backticked mention instructs nothing and is not a call');
});

for (const row of CENSUS) {
  test(`${row.file} instructs exactly ${row.calls} seam invocations`, () => {
    const text = readFileSync(join(REPO, row.file), 'utf8');
    assert.ok(text.length > 1000, `${row.file} read as ${text.length}B - the walk found the wrong file`);
    assert.equal(seamCalls(text), row.calls,
      `${row.file} must instruct exactly ${row.calls} seam invocations on its happy path. `
      + `Expected: ${row.note} A count that moved is a round-trip added or removed, not a `
      + 'number to re-pin: re-pin this row only with the measurement that justifies it, '
      + 'the way the header derives both figures.');
  });
}
