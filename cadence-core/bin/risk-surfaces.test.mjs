// Grammar tests for lib/risk-surfaces.mjs - the pure half of the computed risk
// floor. Run: node --test cadence-core/bin/risk-surfaces.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test() with
// a sequential loop reports the loop's count, not the rows', so a row that never
// ran still looks green (route-cells.test.mjs carries the same note).
//
// HAND-WRITTEN DATA. Nothing here is read, derived or spread from
// cadence-core/route-table.json: that file is the subject this lib runs on, and
// a fixture deriving its expectations from its subject cannot fail
// (route.test.mjs:72-79).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pathTokens, matchSurfaces, raiseTo, surfacesFromKeys, surfaceKeyError, OVERRIDE_PREFIX,
} from './lib/risk-surfaces.mjs';

const ORDER = ['solo', 'shipped', 'critical'];

/** A two-surface fixture table, hand-written and deliberately small. */
function surfaces() {
  return {
    auth: { patterns: ['auth', 'session', 'login'], floor: 'critical' },
    migrations: { patterns: ['migration', 'migrations'], floor: 'critical' },
  };
}

const SCHEMA_KEYS = [
  'stakes',
  'risk.override.auth',
  'risk.override.migrations',
  'risk.override.secrets',
  'model.overrides.cad-executor',
];

// --- pathTokens ---------------------------------------------------------------

test('pathTokens splits a camelCase segment at the boundary', () => {
  assert.deepEqual(pathTokens('src/authService.ts'), ['src', 'auth', 'service', 'ts']);
});

test('pathTokens drops the empty leading token of a dotfile', () => {
  assert.deepEqual(pathTokens('.env.example'), ['env', 'example']);
});

test('pathTokens keeps digit runs and splits at a digit-to-upper boundary', () => {
  assert.deepEqual(pathTokens('db/migrations/001_addUser.sql'),
    ['db', 'migrations', '001', 'add', 'user', 'sql']);
});

test('pathTokens separates on a Windows-style backslash path', () => {
  assert.deepEqual(pathTokens('src\\auth\\login.rs'), ['src', 'auth', 'login', 'rs']);
});

test('pathTokens on a non-string or empty path is empty, never a throw', () => {
  for (const bad of [null, undefined, 42, {}, [], '']) {
    assert.deepEqual(pathTokens(bad), [], JSON.stringify(bad));
  }
});

test('a pattern matches a whole token only, never a substring', () => {
  // `api` inside `rapid` must not floor a phase: a floor that fires on noise
  // trains the user to waive it by reflex.
  const t = { api: { patterns: ['api'], floor: 'critical' } };
  assert.deepEqual(matchSurfaces(['src/rapid/queue.rs'], t), []);
  assert.equal(matchSurfaces(['src/api/routes.rs'], t).length, 1);
});

// --- matchSurfaces ------------------------------------------------------------

test('a single-surface match names the surface, the path and the pattern', () => {
  const m = matchSurfaces(['README.md', 'src/auth/login.rs'], surfaces());
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], {
    surface: 'auth', floor: 'critical', path: 'src/auth/login.rs', pattern: 'auth',
  });
});

test('two surfaces both report, in the table declaration order', () => {
  const m = matchSurfaces(['db/migrations/001.sql', 'src/auth/login.rs'], surfaces());
  assert.deepEqual(m.map((x) => x.surface), ['auth', 'migrations']);
});

test('one path matching two patterns of the SAME surface reports once', () => {
  const m = matchSurfaces(['src/auth/session.rs'], surfaces());
  assert.equal(m.length, 1);
  assert.equal(m[0].pattern, 'auth'); // the first pattern in declaration order
});

test('two paths matching the same surface report once, naming the first path', () => {
  const m = matchSurfaces(['src/login.rs', 'src/auth/x.rs'], surfaces());
  assert.equal(m.length, 1);
  assert.equal(m[0].path, 'src/login.rs');
  assert.equal(m[0].pattern, 'login');
});

test('a file list matching nothing yields no matches', () => {
  assert.deepEqual(matchSurfaces(['README.md', 'src/main.rs'], surfaces()), []);
});

test('the floor is carried VERBATIM off the row, whatever it says', () => {
  // This lib has no opinion about level names - the caller supplies the order.
  const t = { auth: { patterns: ['auth'], floor: 'shipped' } };
  assert.equal(matchSurfaces(['src/auth/x.rs'], t)[0].floor, 'shipped');
});

// --- matchSurfaces: malformed input -------------------------------------------

test('a surfaces block that is null, a string or an array yields no matches', () => {
  for (const bad of [null, undefined, 'nope', [1, 2], 42]) {
    assert.deepEqual(matchSurfaces(['src/auth/x.rs'], bad), [], JSON.stringify(bad));
  }
});

test('a non-object surface row contributes no match rather than throwing', () => {
  const t = { auth: 'nope', migrations: { patterns: ['migrations'], floor: 'critical' } };
  const m = matchSurfaces(['src/auth/x.rs', 'db/migrations/1.sql'], t);
  assert.deepEqual(m.map((x) => x.surface), ['migrations']);
});

test('a non-array or empty patterns list contributes no match', () => {
  for (const patterns of [undefined, null, 'auth', {}, []]) {
    const t = { auth: { patterns, floor: 'critical' } };
    assert.deepEqual(matchSurfaces(['src/auth/x.rs'], t), [], JSON.stringify(patterns));
  }
});

test('a non-string pattern is skipped and the row still matches on a good one', () => {
  const t = { auth: { patterns: [7, null, {}, 'auth'], floor: 'critical' } };
  const m = matchSurfaces(['src/auth/x.rs'], t);
  assert.equal(m.length, 1);
  assert.equal(m[0].pattern, 'auth');
});

test('a non-string path is skipped and the list still matches on a good one', () => {
  const m = matchSurfaces([null, 7, {}, 'src/auth/x.rs'], surfaces());
  assert.equal(m.length, 1);
  assert.equal(m[0].path, 'src/auth/x.rs');
});

test('a files value that is not an array yields no matches', () => {
  for (const bad of [null, undefined, 'src/auth/x.rs', 42, {}]) {
    assert.deepEqual(matchSurfaces(bad, surfaces()), [], JSON.stringify(bad));
  }
});

// --- matchSurfaces: the dependency-lockfile exclusion (D-05) ------------------

/** A hand-written concurrency row, same patterns route-table.json declares for
 *  the tokens this exclusion is about. Nothing is read from that file. */
function conc() {
  return { concurrency: { patterns: ['lock', 'locks', 'locking', 'mutex'], floor: 'critical' } };
}

for (const lockfile of ['package-lock.json', 'Cargo.lock', 'yarn.lock', 'poetry.lock',
  'Gemfile.lock', 'composer.lock']) {
  test(`a lockfile basename matches nothing: ${lockfile}`, () => {
    assert.deepEqual(matchSurfaces([lockfile], conc()), []);
  });
}

test('the exclusion is by BASENAME, so a nested lockfile is excluded too', () => {
  assert.deepEqual(matchSurfaces(['frontend/app/package-lock.json'], conc()), []);
  assert.deepEqual(matchSurfaces(['crates/core/Cargo.lock'], conc()), []);
});

test('the exclusion is case-insensitive on the suffix', () => {
  assert.deepEqual(matchSurfaces(['Gemfile.LOCK'], conc()), []);
});

for (const path of ['src/lock.rs', 'internal/lock/manager.go', 'db/locks.sql', 'src/locking.rs']) {
  test(`a real concurrency path still floors: ${path}`, () => {
    const m = matchSurfaces([path], conc());
    assert.equal(m.length, 1, path);
    assert.equal(m[0].surface, 'concurrency');
    assert.equal(m[0].path, path);
  });
}

test('a lockfile beside a real concurrency path does not hide it', () => {
  // The exclusion drops the PATH, never the surface: the plan still floors, and
  // the match names the file that earned it rather than the generated one.
  const m = matchSurfaces(['package-lock.json', 'src/lock.rs'], conc());
  assert.equal(m.length, 1);
  assert.equal(m[0].path, 'src/lock.rs');
});

test('a lockfile is excluded from EVERY surface, not from concurrency alone', () => {
  // `sessions.lock` tokenizes to [sessions, lock] and would otherwise floor on
  // the auth surface's `session`... it is a generated manifest either way.
  const t = { ...conc(), auth: { patterns: ['auth', 'session', 'sessions'], floor: 'critical' } };
  assert.deepEqual(matchSurfaces(['sessions.lock'], t), []);
});

test('a name that merely CONTAINS lock is not a lockfile', () => {
  // `.lock` / `-lock.json` are suffixes of the BASENAME, not substrings of the
  // path: `unlock.rs` and `locked.json` are ordinary source files.
  const t = { ...conc(), misc: { patterns: ['unlock', 'locked'], floor: 'critical' } };
  assert.equal(matchSurfaces(['src/unlock.rs'], t).length, 1);
  assert.equal(matchSurfaces(['src/locked.json'], t).length, 1);
});

// --- raiseTo ------------------------------------------------------------------

test('raiseTo raises a lower baseline to the floor', () => {
  assert.equal(raiseTo('solo', 'critical', ORDER), 'critical');
  assert.equal(raiseTo('solo', 'shipped', ORDER), 'shipped');
});

test('raiseTo HOLDS when the floor sits below the baseline - it never caps', () => {
  assert.equal(raiseTo('critical', 'shipped', ORDER), 'critical');
  assert.equal(raiseTo('shipped', 'solo', ORDER), 'shipped');
});

test('raiseTo holds on an equal floor', () => {
  assert.equal(raiseTo('shipped', 'shipped', ORDER), 'shipped');
});

test('raiseTo returns the baseline UNCHANGED when either level is unknown', () => {
  // -1 must never read as a position: an unknown floor lowering the level is
  // the exact inversion the floor exists to prevent.
  assert.equal(raiseTo('shipped', 'ludicrous', ORDER), 'shipped');
  assert.equal(raiseTo('ludicrous', 'critical', ORDER), 'ludicrous');
  assert.equal(raiseTo('shipped', undefined, ORDER), 'shipped');
  assert.equal(raiseTo('shipped', 'critical', null), 'shipped');
  assert.equal(raiseTo('shipped', 'critical', []), 'shipped');
});

// --- the override key vocabulary ----------------------------------------------

test('OVERRIDE_PREFIX is the dotted prefix the schema keys are spelled under', () => {
  assert.equal(OVERRIDE_PREFIX, 'risk.override.');
});

test('surfacesFromKeys returns the declared surface names, sorted', () => {
  assert.deepEqual(surfacesFromKeys(SCHEMA_KEYS), ['auth', 'migrations', 'secrets']);
});

test('surfacesFromKeys on a non-array or empty list is empty, never a throw', () => {
  assert.deepEqual(surfacesFromKeys(null), []);
  assert.deepEqual(surfacesFromKeys([]), []);
  assert.deepEqual(surfacesFromKeys(['stakes', 7, null]), []);
});

test('surfaceKeyError returns null for a real waiver key', () => {
  assert.equal(surfaceKeyError('risk.override.auth', SCHEMA_KEYS), null);
});

test('surfaceKeyError returns null for a key outside the prefix', () => {
  for (const key of ['stakes', 'model.overrides.cad-executor', 'risk', 'riskoverride.auth']) {
    assert.equal(surfaceKeyError(key, SCHEMA_KEYS), null, key);
  }
});

test('surfaceKeyError lists every accepted name for a misspelled surface', () => {
  const msg = surfaceKeyError('risk.override.nope', SCHEMA_KEYS);
  assert.match(msg, /"nope" is not a risk surface/);
  for (const name of ['auth', 'migrations', 'secrets']) {
    assert.match(msg, new RegExp(`\\b${name}\\b`), name);
  }
});

test('surfaceKeyError on a non-string key is null, never a throw', () => {
  for (const bad of [null, undefined, 7, {}]) {
    assert.equal(surfaceKeyError(bad, SCHEMA_KEYS), null, JSON.stringify(bad));
  }
});
