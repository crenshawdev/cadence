// Zero-dep tests that the per-run scratch READ-BACKS this repository's prose
// prescribes actually refuse. Run:
//   node --test cadence-core/bin/scratch-readback.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// WHY THIS EXISTS BESIDE scratch-path.test.mjs. That file proves a claim about
// TEXT: every read-back carries a `console.error` and a non-zero exit.
// `lib/scratch-path.mjs` cannot tell a guard that fires from a guard that is
// merely present, and a guard that never runs is exactly the shape SCR-01 was
// filed against - `(r.outcomes||[])` was "handling" a missing array by
// answering `0`. So this file EXTRACTS each `node -e` script out of the prose
// that ships it and EXECUTES it as a child process against a truncated file
// and a well-formed file of the wrong shape.
//
// The scripts are never copied in as literals. A fixture-only test is a green
// test that cannot go red: it would keep passing over prose that lost its
// guard, which is the defect class this repository has already named. What IS
// written down here is the fixture and the ARGUMENTS each script takes -
// facts about how the surrounding step calls it, not a copy of the script.
//
// TWO OF THE SIX READ-BACKS NEED NOTHING HERE, and this is why. The cross-model
// payload file is read by `review-provider.mjs --payload`, whose named
// `bad-payload` refusal before any network call is already proved by
// `cadence-core/bin/review-provider.test.mjs`'s malformed-payload row - and it
// answers in the stdout seam envelope by `lib/seam-io.mjs`'s convention rather
// than on stderr, so asserting stderr there would assert the wrong contract.
// The inline task diff is read by the same composer script this file already
// executes, as its artifact argument.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** A shell-single-quoted `node -e` script. A single quote cannot appear inside one. */
const NODE_E_RE = /node -e '([^']*)'/g;

/** Every `node -e` script one prose surface ships. */
const scriptsIn = (surface) =>
  [...readFileSync(join(ROOT, surface), 'utf8').matchAll(NODE_E_RE)].map((m) => m[1]);

/**
 * One row per prose read-back, with how its own step calls it and the two
 * fixtures it must refuse. `setup` writes into a fresh directory and returns
 * the argv the step would pass.
 */
const READBACKS = [
  {
    surface: 'cadence-core/references/triage-gate.md',
    cases: [
      {
        name: 'a render truncated mid-object', reason: 'scratch-unreadable',
        setup: (d) => {
          writeFileSync(join(d, 'render.json'), '{"corr":"c1","outcomes":[{"event":"rear');
          return [join(d, 'render.json'), 'risk_surface'];
        },
      },
      {
        name: 'a well-formed render with no outcomes array', reason: 'scratch-shape',
        setup: (d) => {
          writeFileSync(join(d, 'render.json'), '{"corr":"c1"}');
          return [join(d, 'render.json'), 'risk_surface'];
        },
      },
    ],
  },
  {
    surface: 'cadence-core/workflows/progress.md',
    cases: [
      {
        name: 'a render truncated mid-object', reason: 'scratch-unreadable',
        setup: (d) => {
          writeFileSync(join(d, 'render.json'), '{"counts":{"routing":1');
          return [join(d, 'render.json')];
        },
      },
      {
        name: 'a well-formed render missing the fields the step prints', reason: 'scratch-shape',
        setup: (d) => {
          writeFileSync(join(d, 'render.json'), '{"counts":{},"roles":{},"unpaired":[]}');
          return [join(d, 'render.json')];
        },
      },
    ],
  },
  {
    // The split site: argv is the DIRECTORY read_record echoed and the token it
    // echoed beside it, so every fixture must carry a matching run token or the
    // stale arm would answer before the arm under test.
    surface: 'cadence-core/workflows/report.md',
    cases: [
      {
        name: 'a record truncated mid-object', reason: 'scratch-unreadable',
        setup: (d) => {
          writeFileSync(join(d, 'run-token'), 'tok-1');
          writeFileSync(join(d, 'render.json'), '{"brackets":[{"role":"cad-exec');
          return [d, 'tok-1'];
        },
      },
      {
        name: 'a well-formed record with no brackets array', reason: 'scratch-shape',
        setup: (d) => {
          writeFileSync(join(d, 'run-token'), 'tok-1');
          writeFileSync(join(d, 'render.json'), '{}');
          return [d, 'tok-1'];
        },
      },
    ],
  },
  {
    // The composer reads TEXT, not JSON, so its two refusals are both
    // `scratch-unreadable`: a file it cannot open, and an artifact that is
    // EMPTY - which is what a failed or colliding redirect leaves behind, and
    // is this script's equivalent of a wrong-shaped file.
    surface: 'cadence-core/references/review-triggers.md',
    cases: [
      {
        name: 'a brief path that does not resolve', reason: 'scratch-unreadable',
        setup: (d) => {
          writeFileSync(join(d, 'artifact.txt'), 'diff --git a/x b/x\n');
          return [join(d, 'absent-brief.md'), 'review this range',
            join(d, 'artifact.txt'), join(d, 'payload.json')];
        },
      },
      {
        name: 'an artifact left empty by a failed redirect', reason: 'scratch-unreadable',
        setup: (d) => {
          writeFileSync(join(d, 'brief.md'), 'the reviewer brief\n');
          writeFileSync(join(d, 'artifact.txt'), '');
          return [join(d, 'brief.md'), 'review this range',
            join(d, 'artifact.txt'), join(d, 'payload.json')];
        },
      },
    ],
  },
];

test('the four prose surfaces ship exactly one read-back script each', () => {
  // Pinned the way bulk-output.test.mjs pins its row count: a site that loses
  // its read-back turns this file RED rather than quietly shrinking the set
  // the assertions below prove.
  const counts = READBACKS.map((r) => scriptsIn(r.surface).length);
  assert.deepEqual(counts, [1, 1, 1, 1], JSON.stringify(counts));
  assert.equal(counts.reduce((a, b) => a + b, 0), 4);
});

for (const { surface, cases } of READBACKS) {
  for (const c of cases) {
    test(`${surface} refuses ${c.name}`, () => {
      const [script] = scriptsIn(surface);
      const dir = mkdtempSync(join(tmpdir(), 'cad-readback-'));
      try {
        const argv = c.setup(dir);
        const run = spawnSync(process.execPath, ['-e', script, ...argv], { encoding: 'utf8' });
        assert.notEqual(run.status, 0, `exited 0: ${run.stdout}${run.stderr}`);
        assert.ok(run.stderr.includes(c.reason),
          `stderr must name ${c.reason}, got: ${run.stderr}`);
        // Not merely "no answer": the progress site PRINTED `{}` as a clean
        // successful answer, which is the shape this assertion exists for.
        assert.equal(run.stdout.trim(), '', `stdout must be empty, got: ${run.stdout}`);
        assert.doesNotMatch(run.stdout, /\{\}/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}

test('a read-back that lost its guard fails this file, naming its surface', () => {
  // The negative control: strip the guard out of the shipped script the way a
  // prose edit would, and the same fixture that refuses above now answers.
  const [script] = scriptsIn('cadence-core/workflows/progress.md');
  const unguarded = script.replace(
    /let r;try\{r=JSON\.parse\(([^)]*\))\)\}catch\(e\)\{[^}]*\}/,
    'const r=JSON.parse($1);',
  ).replace(/const miss=[^;]*;if\(miss\.length\)\{[^}]*\}/, '');
  assert.notEqual(unguarded, script, 'the strip must actually change the script');
  const dir = mkdtempSync(join(tmpdir(), 'cad-readback-control-'));
  try {
    writeFileSync(join(dir, 'render.json'), '{}');
    const run = spawnSync(process.execPath, ['-e', unguarded, join(dir, 'render.json')],
      { encoding: 'utf8' });
    assert.equal(run.status, 0, 'the unguarded form answers instead of refusing');
    // The exact defect: four `undefined` fields stringify to `{}`, which reads
    // as a clean, empty, SUCCESSFUL answer. The guarded form refuses this file.
    assert.equal(run.stdout.trim(), '{}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
