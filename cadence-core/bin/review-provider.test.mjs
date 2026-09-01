// Zero-dep tests for review-provider.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Three layers: unit tests import the pure helpers (no network, no side
// effects - main() is guarded); CLI tests exercise the argument/key/payload
// paths that fail BEFORE any provider call; and fault-injection tests exercise
// the WIRE paths - every failure mode this seam degrades on - through a fake
// transport.
//
// POLICY REVERSED, dated 2026-08-07 (phase 1, QW-05, CONTEXT D-10). This header
// used to state that "the wire paths themselves are pinned in
// references/provider-api.md and deliberately untested here - no network in the
// suite". The first half no longer holds: the six failure modes below are
// exercised and asserted on what the CALLER sees. The second half holds harder
// than it did - the fake transport is a function replacing a module-private
// reference (`__setTransportForTests`), so these tests open no socket, resolve
// no hostname and speak no TLS. Nothing in this file reaches the network, and
// `references/provider-api.md` remains the pin for the wire FORMAT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, parseEnvFile, stripAdditionalProperties,
  validateFindings, validateConsult, classify, ADAPTERS,
  readModelHints, detectEnvelope, resolveTimeoutMs,
  resolveMaxPromptTokens, estimatePromptTokens,
  __setTransportForTests, __runCommandForTests,
} from './review-provider.mjs';
// FINDING_SCHEMA reaches these tests through a NAMESPACE import rather than the
// named list above, deliberately. A named import of a symbol the module does
// not export is a LINK error - the whole file fails to load before a single
// test runs - and the RVP-02 falsifier at the end of this file has to be
// runnable against the unpatched tree, where `FINDING_SCHEMA` was module-local.
// Through a namespace it is simply `undefined` there, so the falsifier fails on
// its assertions (what it is watching) instead of on module resolution.
import * as reviewProvider from './review-provider.mjs';
import { evaluateSchema } from './lib/schema-eval.mjs';
import { renderCursor } from './lib/planning-files.mjs';
import { appendEvent, renderTrace } from './lib/trace.mjs';

const FINDING_SCHEMA = reviewProvider.FINDING_SCHEMA;
// The bounds FINDING_SCHEMA states, read OUT of it rather than restated here -
// a copied number is the drift these tests exist to catch. Optional chaining
// throughout for the same reason the namespace import exists: against the
// unpatched tree these resolve to `undefined` instead of throwing at module
// load, which would take the falsifier down with them.
const F_PROPS = FINDING_SCHEMA?.properties?.findings?.items?.properties ?? {};
const MAX_FINDINGS = FINDING_SCHEMA?.properties?.findings?.maxItems;
const MAX_FILE_CHARS = F_PROPS.file?.maxLength;
const MAX_TEXT_CHARS = F_PROPS.claim?.maxLength;

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'review-provider.mjs');
const dir = mkdtempSync(join(tmpdir(), 'cad-provider-'));

/**
 * Run the CLI without provider keys in the environment; parse the JSON line.
 *
 * `cwd` is the temp dir, never the repo. review-provider.mjs resolves its trace
 * root as the cwd-relative `.planning` (correct in production, where cwd IS the
 * project), so inheriting the runner's cwd wrote every fixture call into
 * Cadence's own `.planning/trace.jsonl` - 1,443 `gpt-test` rows against 33 real
 * ones, which is what made that file useless for reading real latency out of.
 */
function run(args, { env = {}, stdin } = {}) {
  const cleanEnv = { ...process.env, ...env };
  delete cleanEnv.OPENAI_API_KEY;
  delete cleanEnv.GEMINI_API_KEY;
  delete cleanEnv.DEEPSEEK_API_KEY;
  Object.assign(cleanEnv, env);
  try {
    return JSON.parse(execFileSync('node', [SCRIPT, ...args],
      { encoding: 'utf8', cwd: dir, env: cleanEnv, ...(stdin !== undefined ? { input: stdin } : {}) }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

// --- unit: pure helpers --------------------------------------------------------

test('parseEnvFile: comments, quotes, export prefix, blank lines', () => {
  const parsed = parseEnvFile([
    '# comment', '', 'OPENAI_API_KEY=sk-plain',
    'export GEMINI_API_KEY="quoted-key"', "SINGLE='sq'", 'NOEQ', 'SPACED = padded ',
  ].join('\n'));
  assert.equal(parsed.OPENAI_API_KEY, 'sk-plain');
  assert.equal(parsed.GEMINI_API_KEY, 'quoted-key');
  assert.equal(parsed.SINGLE, 'sq');
  assert.equal(parsed.SPACED, 'padded');
  assert.equal('NOEQ' in parsed, false);
});

const DEFAULT_TIMEOUT = 540000;
const MAX_TIMEOUT = 600000;

test('resolveTimeoutMs: a usable configured value wins', () => {
  assert.equal(resolveTimeoutMs(3000), 3000);
  assert.equal(resolveTimeoutMs(1), 1);                 // schema min
  assert.equal(resolveTimeoutMs(MAX_TIMEOUT), MAX_TIMEOUT);
});

test('resolveTimeoutMs: anything unusable falls back to the default, never throws', () => {
  assert.equal(resolveTimeoutMs(undefined), DEFAULT_TIMEOUT);   // key absent
  assert.equal(resolveTimeoutMs(null), DEFAULT_TIMEOUT);        // layer skipped
  assert.equal(resolveTimeoutMs(0), DEFAULT_TIMEOUT);           // would abort instantly
  assert.equal(resolveTimeoutMs(-1), DEFAULT_TIMEOUT);
  assert.equal(resolveTimeoutMs(1.5), DEFAULT_TIMEOUT);         // non-integer
  assert.equal(resolveTimeoutMs(NaN), DEFAULT_TIMEOUT);
  assert.equal(resolveTimeoutMs(Infinity), DEFAULT_TIMEOUT);
  assert.equal(resolveTimeoutMs('3000'), DEFAULT_TIMEOUT);      // string, not coerced
  assert.equal(resolveTimeoutMs({}), DEFAULT_TIMEOUT);
  assert.equal(resolveTimeoutMs([3000]), DEFAULT_TIMEOUT);
});

test('resolveTimeoutMs: an oversized value is clamped, never left to overflow', () => {
  // node stores a socket timeout in a 32-bit signed int, so anything past
  // 2147483647 is truncated there and the timer effectively never fires - a
  // black-hole connection would hang ~24.8 days instead of rejecting, which is
  // the exact guarantee this timeout exists to provide. The schema enforces
  // only `min`, so these all validate clean and the bound must live in code.
  assert.equal(resolveTimeoutMs(999999999999), MAX_TIMEOUT);
  assert.equal(resolveTimeoutMs(2147483648), MAX_TIMEOUT);      // past node's int32
  assert.equal(resolveTimeoutMs(600000000), MAX_TIMEOUT);       // one extra zero group
  assert.equal(resolveTimeoutMs(MAX_TIMEOUT + 1), MAX_TIMEOUT);
  assert.ok(resolveTimeoutMs(999999999999) <= 2147483647, 'must stay inside node int32');
});

test('resolveTimeoutMs: the default fits between a real review and the host ceiling', () => {
  // Lower bound: a flagship model on a ~13KB diff measured 292s, and the old
  // hardcoded 120000 silently dropped reviewers from the BLOCKING gates.
  // Upper bound: the execution host caps a command at 600000 and a host kill
  // prints nothing at all, so the seam must abort first and own the output.
  assert.ok(DEFAULT_TIMEOUT > 292000, 'must clear a measured high-effort review');
  assert.ok(DEFAULT_TIMEOUT < MAX_TIMEOUT, 'seam must abort before the host kills it');
  assert.equal(resolveTimeoutMs(undefined), DEFAULT_TIMEOUT);
});

const DEFAULT_MAX_PROMPT_TOKENS = 120000;

test('resolveMaxPromptTokens: a usable configured value wins', () => {
  assert.equal(resolveMaxPromptTokens(3000), 3000);
  assert.equal(resolveMaxPromptTokens(1), 1);                   // schema min
});

test('resolveMaxPromptTokens: anything unusable falls back to the default, never throws', () => {
  for (const bad of [undefined, null, 0, -1, 1.5, NaN, Infinity, '3000', {}, [3000]]) {
    assert.equal(resolveMaxPromptTokens(/** @type {any} */ (bad)), DEFAULT_MAX_PROMPT_TOKENS);
  }
});

test('resolveMaxPromptTokens: a huge value is NOT clamped', () => {
  // Unlike the timeout there is no host ceiling to overflow: raising the cap
  // costs money, not correctness, and the user made that call in writing.
  assert.equal(resolveMaxPromptTokens(999999999), 999999999);
});

test('estimatePromptTokens: ceil of chars/4 over the string parts only', () => {
  assert.equal(estimatePromptTokens('abcd'), 1);
  assert.equal(estimatePromptTokens('abcde'), 2);               // ceil, not floor
  assert.equal(estimatePromptTokens('ab', 'cd'), 1);            // parts are joined
  assert.equal(estimatePromptTokens('abcd', /** @type {any} */ (null)), 1); // non-string ignored
  assert.equal(estimatePromptTokens(), 0);                      // no part at all
});

test('estimatePromptTokens: the cap boundary - at the cap is not over it', () => {
  const at = 'x'.repeat(4 * DEFAULT_MAX_PROMPT_TOKENS);
  assert.equal(estimatePromptTokens(at), DEFAULT_MAX_PROMPT_TOKENS);
  assert.ok(!(estimatePromptTokens(at) > DEFAULT_MAX_PROMPT_TOKENS), 'exactly at the cap passes');
  assert.ok(estimatePromptTokens(`${at}x`) > DEFAULT_MAX_PROMPT_TOKENS, 'one char past is over');
});

test('parseEnvFile quirks: = in values, asymmetric quotes, inline comments kept', () => {
  const parsed = parseEnvFile([
    'BASE64ISH=abc=def==',          // only the FIRST = splits
    'ASYM="half-quoted',            // asymmetric quotes are not stripped
    'TRAILING=value # not a comment', // inline # is part of the value
  ].join('\n'));
  assert.equal(parsed.BASE64ISH, 'abc=def==');
  assert.equal(parsed.ASYM, '"half-quoted');
  assert.equal(parsed.TRAILING, 'value # not a comment');
});

test('stripAdditionalProperties: removes the key at every depth, nothing else', () => {
  const schema = {
    type: 'object', additionalProperties: false,
    properties: { list: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['x'] } } },
  };
  const stripped = stripAdditionalProperties(schema);
  assert.equal('additionalProperties' in stripped, false);
  assert.equal('additionalProperties' in stripped.properties.list.items, false);
  assert.deepEqual(stripped.properties.list.items.required, ['x']);
  assert.equal('additionalProperties' in schema, true); // deep copy, input untouched
  // Array nodes (anyOf/oneOf lists) recurse element-wise, order preserved.
  const arr = stripAdditionalProperties([
    { type: 'object', additionalProperties: false, required: ['a'] },
    'scalar',
  ]);
  assert.deepEqual(arr, [{ type: 'object', required: ['a'] }, 'scalar']);
});

/** Every object key appearing anywhere in a JSON tree. */
function keysDeep(node, out = new Set()) {
  if (Array.isArray(node)) { for (const v of node) keysDeep(v, out); return out; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { out.add(k); keysDeep(v, out); }
  }
  return out;
}

test('FINDING_SCHEMA: the bounds are stated on the wire, in every dialect (RVP-02)', () => {
  // The settled numbers, pinned literally exactly once - everything else in
  // this file reads them back off the schema. Derived from what the tree has
  // produced (file 39, claim 159, failure_scenario 376 chars in the one
  // committed findings file; largest panel round 9 findings), not rounded.
  assert.equal(F_PROPS.line.minimum, 1);
  assert.equal(F_PROPS.file.minLength, 1);
  assert.equal(F_PROPS.claim.minLength, 1);
  assert.equal(F_PROPS.failure_scenario.minLength, 1);
  assert.equal(F_PROPS.file.maxLength, 1024);
  assert.equal(F_PROPS.claim.maxLength, 2000);
  assert.equal(F_PROPS.failure_scenario.maxLength, 2000);
  assert.equal(FINDING_SCHEMA.properties.findings.maxItems, 100);
  // NO minItems: a review that found nothing returns [], and refusing that
  // would turn a clean result into a bad-shape degradation.
  assert.equal('minItems' in FINDING_SCHEMA.properties.findings, false);
  // None of OpenAI's structured-output UNSUPPORTED set rode in with them
  // (provider-api.md, checked 2026-08-17).
  const present = keysDeep(FINDING_SCHEMA);
  for (const banned of ['unevaluatedProperties', 'propertyNames', 'minProperties',
    'maxProperties', 'unevaluatedItems', 'contains', 'minContains', 'maxContains',
    'uniqueItems']) {
    assert.equal(present.has(banned), false, `${banned} is unsupported on OpenAI strict mode`);
  }

  const args = {
    model: 'm', system: 's', user: 'u',
    schema: FINDING_SCHEMA, schemaName: 'cadence_review',
  };

  // OpenAI strict json_schema: the schema rides verbatim under text.format.
  const sent = ADAPTERS.openai.structuredRequest(args).body.text.format.schema;
  assert.equal(sent.properties.findings.maxItems, 100);
  assert.equal(sent.properties.findings.items.properties.line.minimum, 1);
  assert.equal(sent.properties.findings.items.properties.claim.minLength, 1);
  assert.equal(sent.properties.findings.items.properties.claim.maxLength, 2000);

  // Gemini responseSchema: the same four keywords, and additionalProperties
  // stripped at every depth - the ONLY thing that adapter removes.
  const gem = ADAPTERS.gemini.structuredRequest(args).body.generationConfig.responseSchema;
  assert.equal(gem.properties.findings.maxItems, 100);
  assert.equal(gem.properties.findings.items.properties.line.minimum, 1);
  assert.equal(gem.properties.findings.items.properties.file.minLength, 1);
  assert.equal(gem.properties.findings.items.properties.file.maxLength, 1024);
  assert.equal(keysDeep(gem).has('additionalProperties'), false);

  // DeepSeek has no server-side schema enforcement, so the schema is serialized
  // into the system prompt - the keywords have to survive that too.
  const sys = ADAPTERS.deepseek.structuredRequest(args).body.messages[0].content;
  for (const kw of ['"minimum":1', '"minLength":1', '"maxLength":2000', '"maxItems":100']) {
    assert.ok(sys.includes(kw), `${kw} must reach DeepSeek in-prompt`);
  }

  // The carve-out stays a carve-out: one key removed, the bounds untouched.
  const stripped = stripAdditionalProperties(FINDING_SCHEMA);
  assert.equal(keysDeep(stripped).has('additionalProperties'), false);
  for (const kw of ['minimum', 'minLength', 'maxLength', 'maxItems']) {
    assert.equal(keysDeep(stripped).has(kw), true, `${kw} must survive the strip`);
  }
});

test('validateFindings: accepts the exact shape, names the first defect', () => {
  const good = { findings: [{ file: 'a.ts', line: 3, severity: 'high', claim: 'c', failure_scenario: 'f' }] };
  assert.equal(validateFindings(good), null);
  assert.match(validateFindings({}), /missing findings/);
  assert.match(validateFindings({ findings: [{ ...good.findings[0], line: 'three' }] }), /line must be an integer/);
  assert.match(validateFindings({ findings: [{ ...good.findings[0], severity: 'catastrophic' }] }), /bad severity/);
});

test('validateFindings: every schema bound refuses by its own name (RVP-02)', () => {
  const good = () => ({ file: 'a.ts', line: 3, severity: 'high', claim: 'c', failure_scenario: 'f' });
  const one = (/** @type {any} */ patch) => validateFindings({ findings: [{ ...good(), ...patch }] });

  // The seven the requirement names. Seven calls, seven DIFFERENT strings, no
  // null - a shared "invalid finding" message would collapse the set and fail
  // the size assertion, which is the point of asserting on the set.
  const diagnostics = [
    one({ line: 0 }),
    one({ file: '' }),
    one({ claim: '' }),
    one({ failure_scenario: '' }),
    one({ note: 'an unknown key' }),
    validateFindings({ findings: Array.from({ length: MAX_FINDINGS + 1 }, good) }),
    one({ claim: 'x'.repeat(MAX_TEXT_CHARS + 1) }),
  ];
  for (const [i, d] of diagnostics.entries()) {
    assert.equal(typeof d, 'string', `diagnostic ${i} must be a named refusal, got ${d}`);
  }
  assert.equal(new Set(diagnostics).size, 7, `seven distinct diagnostics: ${JSON.stringify(diagnostics)}`);

  // Each names the offending field and the bound it crossed.
  assert.match(diagnostics[0], /finding\.line must be at least 1, got 0/);
  assert.match(diagnostics[1], /finding\.file must not be empty/);
  assert.match(diagnostics[2], /finding\.claim must not be empty/);
  assert.match(diagnostics[3], /finding\.failure_scenario must not be empty/);
  assert.match(diagnostics[4], /unknown key: note/);
  assert.match(diagnostics[5], new RegExp(`at most ${MAX_FINDINGS} entries, got ${MAX_FINDINGS + 1}`));
  assert.match(diagnostics[6], new RegExp(`claim is at most ${MAX_TEXT_CHARS} characters`));
  // `file` carries its OWN maximum, not the text one.
  assert.match(one({ file: 'p'.repeat(MAX_FILE_CHARS + 1) }),
    new RegExp(`file is at most ${MAX_FILE_CHARS} characters`));
  // `line: 0` is distinct from a non-integer line, and an empty string is
  // distinct from a non-string - the pre-existing diagnostics still stand.
  assert.match(one({ line: 'three' }), /line must be an integer/);
  assert.match(one({ claim: 7 }), /claim must be a string/);

  // additionalProperties:false sits at BOTH levels in the schema, so the
  // validator refuses at both, and the top-level diagnostic names the key.
  assert.match(validateFindings({ findings: [], scratch: 1 }), /unknown top-level key: scratch/);

  // An EMPTY findings array is what a review with nothing to report returns.
  assert.equal(validateFindings({ findings: [] }), null);
  assert.equal(validateFindings({ findings: [good()] }), null);

  // Lengths are CODE POINTS, as JSON Schema specifies. A `.length` reading
  // counts one emoji as 2 and would refuse the accepting case below.
  assert.equal(one({ claim: '\u{1F600}'.repeat(MAX_TEXT_CHARS) }), null);
  assert.match(one({ claim: '\u{1F600}'.repeat(MAX_TEXT_CHARS + 1) }),
    new RegExp(`got ${MAX_TEXT_CHARS + 1}`));
});

test('validateConsult: angles need all three string fields', () => {
  assert.equal(validateConsult({ angles: [{ hypothesis: 'h', rationale: 'r', how_to_check: 'c' }] }), null);
  assert.match(validateConsult({ angles: [{ hypothesis: 'h', rationale: 'r' }] }), /how_to_check/);
  assert.match(validateConsult({}), /missing angles/);
});

test('schema-eval: every implemented keyword, both directions (RVP-02)', () => {
  const s = (/** @type {any} */ schema) => (/** @type {any} */ v) => evaluateSchema(schema, v);

  const typed = s({ type: 'string' });
  assert.equal(typed('ok'), null);
  assert.match(String(typed(7)), /expected string/);
  assert.equal(evaluateSchema({ type: 'integer' }, 3), null);
  assert.match(String(evaluateSchema({ type: 'integer' }, 3.5)), /expected integer/);

  const req = s({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] });
  assert.equal(req({ a: 'x' }), null);
  assert.match(String(req({})), /missing required `a`/);

  const closed = s({ type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } });
  assert.equal(closed({ a: 'x' }), null);
  assert.match(String(closed({ a: 'x', b: 1 })), /unknown key `b`/);

  const enumd = s({ type: 'string', enum: ['low', 'high'] });
  assert.equal(enumd('high'), null);
  assert.match(String(enumd('catastrophic')), /is not one of/);

  const minimum = s({ type: 'integer', minimum: 1 });
  assert.equal(minimum(1), null);
  assert.match(String(minimum(0)), /below minimum 1/);

  const len = s({ type: 'string', minLength: 1, maxLength: 3 });
  assert.equal(len('ab'), null);
  assert.match(String(len('')), /shorter than minLength 1/);
  assert.match(String(len('abcd')), /longer than maxLength 3/);

  const items = s({ type: 'array', maxItems: 2, items: { type: 'integer' } });
  assert.equal(items([1, 2]), null);
  assert.match(String(items([1, 2, 3])), /more than maxItems 2/);

  // CODE POINTS, not UTF-16 units. Four astral characters are 8 `.length`
  // units, so a `.length` implementation would REJECT this accepting case -
  // the direction a shared bug between this evaluator and validateFindings
  // would hide, and the reason both are pinned on it.
  const astral = '\u{1F600}'.repeat(4);
  assert.equal(astral.length, 8);
  assert.equal(evaluateSchema({ type: 'string', minLength: 4, maxLength: 4 }, astral), null);
  assert.match(String(evaluateSchema({ type: 'string', minLength: 5 }, astral)), /shorter than minLength 5/);
  assert.match(String(evaluateSchema({ type: 'string', maxLength: 3 }, astral)), /longer than maxLength 3/);

  // Nesting: a violation inside findings[].claim is found and its path named.
  const nested = evaluateSchema(FINDING_SCHEMA, {
    findings: [{ file: 'a.ts', line: 1, severity: 'low', claim: '', failure_scenario: 'f' }],
  });
  assert.match(String(nested), /findings\[0\]\.claim/);
  assert.match(String(nested), /minLength/);

  // The load-bearing half: an unimplemented keyword THROWS rather than being
  // treated as satisfied. Ignoring it would make the agreement test below go
  // green on an agreement it never checked.
  assert.throws(() => evaluateSchema({ type: 'string', pattern: '^a' }, 'a'),
    /unimplemented keyword `pattern`/);
  // Including one buried in a branch no value ever reaches.
  assert.throws(() => evaluateSchema(
    { type: 'object', properties: { deep: { type: 'array', uniqueItems: true } } }, {}),
  /unimplemented keyword `uniqueItems` at \$\.deep/);
  // And an `additionalProperties` value other than `false`, the only form used.
  assert.throws(() => evaluateSchema({ type: 'object', additionalProperties: true }, {}),
    /unimplemented additionalProperties/);
  assert.throws(() => evaluateSchema({ type: 'object', properties: { a: { type: ['string', 'null'] } } }, {}),
    /unimplemented type/);
});

test('agreement: the schema and validateFindings give the same verdict, every fixture (RVP-02)', () => {
  // The pairing, machine-run on BOTH sides. Every fixture goes through the
  // keyword-limited evaluator against the LIVE FINDING_SCHEMA (never a copy - a
  // copied schema is exactly the drift this exists to kill) and through
  // validateFindings, and the two must agree on accept-vs-reject. Deliberately
  // NOT a hand-paired (fixture, expected verdict) table: the schema column
  // would then be asserted by human reading, which is the shape D-08 rejects.
  const ok = () => ({
    file: 'cadence-core/bin/review-provider.mjs', line: 526, severity: 'low',
    claim: 'the response is unbounded', failure_scenario: 'a proxy error page arrives whole',
  });
  const withFinding = (/** @type {any} */ patch) => ({ findings: [{ ...ok(), ...patch }] });
  const emoji = (/** @type {number} */ n) => '\u{1F600}'.repeat(n);

  /** @type {{name: string, value: any}[]} */
  const fixtures = [
    { name: 'a clean single finding', value: withFinding({}) },
    { name: 'an empty findings array', value: { findings: [] } },
    { name: 'line: 0', value: withFinding({ line: 0 }) },
    { name: 'a negative line', value: withFinding({ line: -1 }) },
    { name: 'a non-integer line', value: withFinding({ line: 1.5 }) },
    { name: 'an empty file', value: withFinding({ file: '' }) },
    { name: 'an empty claim', value: withFinding({ claim: '' }) },
    { name: 'an empty failure_scenario', value: withFinding({ failure_scenario: '' }) },
    { name: 'a claim one past maxLength', value: withFinding({ claim: 'x'.repeat(MAX_TEXT_CHARS + 1) }) },
    { name: 'a file one past maxLength', value: withFinding({ file: 'p'.repeat(MAX_FILE_CHARS + 1) }) },
    { name: 'a findings array one past maxItems', value: { findings: Array.from({ length: MAX_FINDINGS + 1 }, ok) } },
    { name: 'an unknown key on a finding', value: withFinding({ note: 'extra' }) },
    { name: 'an unknown key at the top level', value: { findings: [ok()], scratch: 1 } },
    { name: 'a missing required field', value: (() => {
      // Actually ABSENT, not present-and-undefined: `required` is a
      // hasOwnProperty question and the two are different fixtures.
      const f = ok(); delete (/** @type {any} */ (f)).failure_scenario; return { findings: [f] };
    })() },
    { name: 'a bad severity', value: withFinding({ severity: 'catastrophic' }) },
    { name: 'a findings that is not an array', value: { findings: 'one finding, honest' } },
    // The two rows that stop the AGREEMENT from being the bug. Both sides were
    // written in this phase, so a shared UTF-16 `.length` reading of
    // minLength/maxLength agrees perfectly while both disagree with the schema -
    // and every BMP-only row above is blind to it.
    { name: `a claim of exactly ${MAX_TEXT_CHARS} astral characters`, value: withFinding({ claim: emoji(MAX_TEXT_CHARS) }) },
    { name: `a claim of ${MAX_TEXT_CHARS + 1} astral characters`, value: withFinding({ claim: emoji(MAX_TEXT_CHARS + 1) }) },
  ];

  let accepts = 0;
  let rejects = 0;
  for (const { name, value } of fixtures) {
    const bySchema = evaluateSchema(FINDING_SCHEMA, value);
    const byValidator = validateFindings(value);
    const schemaAccepts = bySchema === null;
    const validatorAccepts = byValidator === null;
    assert.equal(schemaAccepts, validatorAccepts,
      `${name}: FINDING_SCHEMA says ${schemaAccepts ? 'ACCEPT' : `REJECT (${bySchema})`}` +
      ` but validateFindings says ${validatorAccepts ? 'ACCEPT' : `REJECT (${byValidator})`}`);
    if (schemaAccepts) accepts += 1; else rejects += 1;
  }
  // A table whose every row rejects would pass a validator that rejects
  // everything, and one whose every row accepts would pass one that accepts
  // everything. Both kinds have to have reached both sides.
  assert.ok(accepts >= 1, 'the table must hold at least one ACCEPT case');
  assert.ok(rejects >= 1, 'the table must hold at least one REJECT case');
  assert.equal(accepts + rejects, fixtures.length);
  // Named, so a future edit that drops the astral rows is visible: the exactly-
  // at-maxLength emoji row is the one that must land in the accept column.
  assert.equal(evaluateSchema(FINDING_SCHEMA, withFinding({ claim: emoji(MAX_TEXT_CHARS) })), null);
  assert.equal(validateFindings(withFinding({ claim: emoji(MAX_TEXT_CHARS) })), null);
});

test('classify: tier hints applied, non-text modalities excluded, unknowns kept', () => {
  const out = classify('openai', ['text-embedding-3-large', 'brand-new-model', 'gpt-5.2', 'o4-nano']);
  assert.equal(out.some((m) => m.id.includes('embedding')), false); // excluded modality
  const unknown = out.find((m) => m.id === 'brand-new-model');
  assert.deepEqual(unknown, { id: 'brand-new-model', tier: null, high_effort: null });
  // Known ids get a REAL tier + effort hint, not just a pass-through.
  assert.deepEqual(out.find((m) => m.id === 'gpt-5.2'),
    { id: 'gpt-5.2', tier: 'flagship', high_effort: true });
  assert.deepEqual(out.find((m) => m.id === 'o4-nano'),
    { id: 'o4-nano', tier: 'cheap', high_effort: false });
});

test('classify: shipped rule ordering - specific families beat generic substrings', () => {
  // gpt-4o-mini contains both "gpt-4" and "mini"; the gpt-4 rule MUST win
  // (reasoning.effort on the 4o family is an HTTP 400 at review time).
  const [mini] = classify('openai', ['gpt-4o-mini']);
  assert.deepEqual(mini, { id: 'gpt-4o-mini', tier: 'cheap', high_effort: false });
  // flash-lite contains "flash"; the flash-lite rule must win. And 2.5-pro
  // must beat "pro" (Gemini 2.x rejects thinkingLevel - no high_effort).
  const gem = classify('gemini', ['gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-4-pro']);
  assert.deepEqual(gem[0], { id: 'gemini-2.5-flash-lite', tier: 'cheap', high_effort: false });
  assert.deepEqual(gem[1], { id: 'gemini-2.5-pro', tier: 'flagship', high_effort: false });
  assert.deepEqual(gem[2], { id: 'gemini-4-pro', tier: 'flagship', high_effort: true });
});

test('classify: injected hints prove first-match-wins mechanics', () => {
  const hints = join(dir, 'hints-order.json');
  writeFileSync(hints, JSON.stringify({
    exclude: ['embed'],
    rules: { openai: [
      { match: 'special-mini', tier: 'flagship', high_effort: true },
      { match: 'mini', tier: 'cheap', high_effort: false },
    ] },
  }));
  const out = classify('openai', ['special-mini-1', 'plain-mini', 'embed-x'], hints);
  assert.deepEqual(out, [
    { id: 'special-mini-1', tier: 'flagship', high_effort: true },
    { id: 'plain-mini', tier: 'cheap', high_effort: false },
  ]);
});

test('broken or missing hints: classify STILL degrades to all-unknown (fail-safe), but the envelope now distinguishes them via warnings[] (#43)', () => {
  const broken = join(dir, 'hints-broken.json');
  writeFileSync(broken, '{ not json');
  const absent = join(dir, 'hints-absent.json');

  // classify()'s array return is byte-identical for broken vs. absent -
  // D-04's fail-safe: a bad hints file never disables the exclude filter or
  // blocks candidate classification, only visibility (below) changes.
  for (const hintsFile of [broken, absent]) {
    const out = classify('openai', ['gpt-5.2', 'text-embedding-3-large'], hintsFile);
    assert.deepEqual(out, [
      { id: 'gpt-5.2', tier: null, high_effort: null },
      { id: 'text-embedding-3-large', tier: null, high_effort: null }, // exclude list gone too
    ]);
  }

  // readModelHints distinguishes WHY: a parse failure warns naming the file
  // (D-01); legitimate absence (ENOENT) stays silent.
  const bad = readModelHints(broken);
  assert.deepEqual(bad.hints, {});
  assert.match(bad.warning, new RegExp(broken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const missing = readModelHints(absent);
  assert.deepEqual(missing.hints, {});
  assert.equal(missing.warning, null);

  // detectEnvelope (the exact shape cmdDetect emits) carries warnings[] only
  // for the malformed file - not for absence, and not for a successfully-
  // parsed but empty (valid-ruleless) file, which is the case a future
  // over-eager readModelHints edit could wrongly flag.
  const brokenEnv = detectEnvelope('openai', ['gpt-5.2'], broken);
  assert.ok(Array.isArray(brokenEnv.warnings) && brokenEnv.warnings.length === 1);
  assert.match(brokenEnv.warnings[0], /hints-broken\.json/);
  assert.deepEqual(brokenEnv.models, [{ id: 'gpt-5.2', tier: null, high_effort: null }]);

  const ruleless = join(dir, 'hints-ruleless.json');
  writeFileSync(ruleless, JSON.stringify({ rules: {} }));
  const rulelessEnv = detectEnvelope('openai', ['gpt-5.2'], ruleless);
  assert.equal('warnings' in rulelessEnv, false);
  assert.deepEqual(rulelessEnv.models, [{ id: 'gpt-5.2', tier: null, high_effort: null }]);

  const absentEnv = detectEnvelope('openai', ['gpt-5.2'], absent);
  assert.equal('warnings' in absentEnv, false);
});

test('adapters: extractText handles both OpenAI response shapes and Gemini parts', () => {
  assert.equal(ADAPTERS.openai.extractText({ output_text: 'direct' }), 'direct');
  assert.equal(ADAPTERS.openai.extractText({
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'nested' }] }],
  }), 'nested');
  assert.equal(ADAPTERS.gemini.extractText({
    candidates: [{ content: { parts: [{ text: 'gem' }] } }],
  }), 'gem');
  assert.equal(ADAPTERS.gemini.extractText({}), undefined);
});

test('adapters: extractModels strips the Gemini models/ prefix and filters methods', () => {
  const ids = ADAPTERS.gemini.extractModels({
    models: [
      { name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embed-only', supportedGenerationMethods: ['embedContent'] },
    ],
  });
  assert.deepEqual(ids, ['gemini-pro']);
  assert.deepEqual(ADAPTERS.openai.extractModels({ data: [{ id: 'gpt-x' }] }), ['gpt-x']);
});

test('classify: deepseek families map to tiers, non-thinking gets no high_effort', () => {
  const ds = classify('deepseek', ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner']);
  assert.deepEqual(ds[0], { id: 'deepseek-v4-pro', tier: 'flagship', high_effort: true });
  assert.deepEqual(ds[1], { id: 'deepseek-v4-flash', tier: 'balanced', high_effort: true });
  assert.deepEqual(ds[2], { id: 'deepseek-chat', tier: 'cheap', high_effort: false });
  assert.deepEqual(ds[3], { id: 'deepseek-reasoner', tier: 'flagship', high_effort: true });
});

test('adapters: deepseek extractText reads choices[].message.content, extractModels reads data[].id', () => {
  assert.equal(ADAPTERS.deepseek.extractText({
    choices: [{ message: { role: 'assistant', content: '{"findings":[]}' } }],
  }), '{"findings":[]}');
  assert.equal(ADAPTERS.deepseek.extractText({ choices: [{ message: {} }] }), undefined);
  assert.equal(ADAPTERS.deepseek.extractText({}), undefined);
  assert.deepEqual(ADAPTERS.deepseek.extractModels({ data: [{ id: 'deepseek-v4-pro' }] }), ['deepseek-v4-pro']);
});

test('adapters: deepseek structuredRequest is chat/completions json_object with the bare schema in-prompt', () => {
  const schema = { type: 'object', required: ['findings'], properties: { findings: { type: 'array' } } };
  const req = ADAPTERS.deepseek.structuredRequest({
    model: 'deepseek-v4-pro', effort: 'high', system: 'Refute this.', user: 'the artifact',
    schema, schemaName: 'cadence_review',
  });
  assert.equal(req.path, '/chat/completions');
  assert.equal(req.method, 'POST');
  assert.equal(req.body.model, 'deepseek-v4-pro');
  assert.equal(req.body.response_format.type, 'json_object');
  assert.equal(req.body.reasoning_effort, 'high');
  assert.equal(req.body.messages[0].role, 'system');
  assert.equal(req.body.messages[1].content, 'the artifact');
  assert.match(req.body.messages[0].content, /Refute this\./);
  assert.match(req.body.messages[0].content, /json/i);
  // The BARE finding schema is injected (its required `findings` key is present),
  // NOT a {name, schema} wrapper the model could echo back verbatim.
  assert.match(req.body.messages[0].content, /findings/);
  assert.doesNotMatch(req.body.messages[0].content, /"name"\s*:\s*"cadence_review"/);
  // Effort is omitted when not requested; `minimal` clamps to `low` (DeepSeek's
  // reasoning_effort rejects minimal, which the shared config enum allows).
  const noEffort = ADAPTERS.deepseek.structuredRequest({
    model: 'deepseek-chat', system: 's', user: 'u', schema: {}, schemaName: 'x',
  });
  assert.equal('reasoning_effort' in noEffort.body, false);
  const minimal = ADAPTERS.deepseek.structuredRequest({
    model: 'deepseek-chat', effort: 'minimal', system: 's', user: 'u', schema: {}, schemaName: 'x',
  });
  assert.equal(minimal.body.reasoning_effort, 'low');
});

test('parseArgs: subcommand plus --flag value pairs', () => {
  const { cmd, opts } = parseArgs(['review', '--provider', 'openai', '--model', 'm']);
  assert.equal(cmd, 'review');
  assert.deepEqual(opts, { provider: 'openai', model: 'm' });
});

test('ARG-06: a flag-shaped value is bad-args by NAME, never a domain refusal', () => {
  // The defect the declared rows in lib/arg-contract.mjs end. `parseArgs` did
  // `opts[a.slice(2)] = rest[i + 1]` with no flag-shape test, so a valueless
  // flag ate the flag after it and the value after THAT was skipped: measured
  // 2026-08-19, `consult --payload --provider openai` returned
  // `{"ok":false,"reason":"bad-provider","detail":"unknown provider: undefined"}`
  // - a refusal about a flag the caller DID pass, naming the wrong problem.
  /** @type {[string[], string][]} the call, and the flag its refusal must name */
  const cases = [
    [['consult', '--payload', '--provider', 'openai'], '--payload'],
    [['detect-models', '--provider'], '--provider'],
    [['review', '--provider', 'openai', '--model', ''], '--model'],
    [['review', '--provider', 'openai', '--model', 'm', '--key-file'], '--key-file'],
  ];
  for (const [args, flag] of cases) {
    const where = args.join(' ');
    const r = run(args);
    assert.equal(r.ok, false, where);
    // `bad-args` is already in this bin's published degradation list
    // (references/seams.md); the contract mints no reason code of its own.
    assert.equal(r.reason, 'bad-args', `${where}: ${JSON.stringify(r)}`);
    assert.match(r.detail, new RegExp(flag), where);
  }
  // The control on the other side of the door: an ABSENT flag is not this
  // door's business. Presence stays with the handlers that own the wording, so
  // an unknown provider is still `bad-provider` and not a shape refusal.
  assert.equal(run(['detect-models', '--provider', 'skynet']).reason, 'bad-provider');
  assert.equal(run(['review', '--provider', 'openai']).reason, 'bad-args');

  // ...and `parseArgs` stays PURE: it names the refusal, it never emits one,
  // and the `{cmd, opts}` shape its callers destructure is untouched.
  const { cmd, opts, badArg } = parseArgs(['consult', '--payload', '--provider', 'openai']);
  assert.equal(cmd, 'consult');
  assert.deepEqual(opts, { provider: 'openai' });
  assert.match(badArg, /--payload/);
});

// --- CLI: pre-network failure paths ---------------------------------------------

test('cli: unknown command degrades to bad-command', () => {
  const r = run(['nonsense']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-command');
});

test('cli: unknown provider degrades to bad-provider', () => {
  const r = run(['detect-models', '--provider', 'skynet']);
  assert.equal(r.reason, 'bad-provider');
});

test('cli: invoked through a symlink still runs (argv[1] vs import.meta.url divergence)', () => {
  const linkPath = join(dir, 'review-provider-link.mjs');
  symlinkSync(SCRIPT, linkPath);
  const cleanEnv = { ...process.env };
  delete cleanEnv.OPENAI_API_KEY;
  delete cleanEnv.GEMINI_API_KEY;
  delete cleanEnv.DEEPSEEK_API_KEY;
  let stdout;
  try {
    stdout = execFileSync('node', [linkPath, 'detect-models', '--provider', 'skynet'],
      { encoding: 'utf8', cwd: dir, env: cleanEnv });
  } catch (e) {
    stdout = e.stdout;
  }
  const lines = stdout.split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const r = JSON.parse(lines[0]);
  assert.ok(r);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-provider');
});

test('cli: missing key degrades to no-key naming where to set it', () => {
  const r = run(['detect-models', '--provider', 'openai',
    '--key-file', join(dir, 'absent-providers.env')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-key');
  assert.match(r.detail, /OPENAI_API_KEY/);
});

test('cli: deepseek missing key names DEEPSEEK_API_KEY', () => {
  const r = run(['detect-models', '--provider', 'deepseek',
    '--key-file', join(dir, 'absent-providers.env')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-key');
  assert.match(r.detail, /DEEPSEEK_API_KEY/);
});

test('cli: malformed payload degrades to bad-payload before any network call', () => {
  const r = run(['review', '--provider', 'openai', '--model', 'gpt-test'],
    { env: { OPENAI_API_KEY: 'test-not-a-real-key' }, stdin: 'not json {' });
  assert.equal(r.reason, 'bad-payload');
  const missing = run(['review', '--provider', 'openai', '--model', 'gpt-test'],
    { env: { OPENAI_API_KEY: 'test-not-a-real-key' }, stdin: '{"instruction":"only"}' });
  assert.equal(missing.reason, 'bad-payload');
  assert.match(missing.detail, /instruction, artifact/);
});

test('cli: key file is actually parsed (env absent, file supplies the key, flow reaches payload)', () => {
  const keyFile = join(dir, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="from-file"\n');
  const r = run(['review', '--provider', 'openai', '--model', 'gpt-test',
    '--key-file', keyFile], { stdin: 'not json {' });
  // Getting bad-payload (not no-key) proves resolveKey read the file.
  assert.equal(r.reason, 'bad-payload');
});

test('cli: an over-cap review payload is refused before any request', () => {
  // These two rows also prove no request was issued: the key is a stub, so a
  // payload that got PAST the cap would come back http 401 (or transport) -
  // and the suite forbids network. Getting over-cap is the proof it stopped
  // at the cap check.
  const keyFile = join(dir, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="from-file"\n');
  const artifact = 'x'.repeat(4 * 120000 + 8);
  const r = run(['review', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { stdin: JSON.stringify({ instruction: 'refute this', artifact }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'over-cap');
  assert.match(r.detail, /review\.max_prompt_tokens/);
});

test('cli: an over-cap consult payload is refused the same way', () => {
  // consult is the same script hitting the same paid provider; bounding review
  // alone would leave the identical defect one function away (#16, D-07).
  const keyFile = join(dir, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="from-file"\n');
  const situation = 'x'.repeat(4 * 120000 + 8);
  const r = run(['consult', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { stdin: JSON.stringify({ situation }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'over-cap');
  assert.match(r.detail, /review\.max_prompt_tokens/);
});

test('cli: a non-string payload field is refused, so the cap cannot be walked past', () => {
  // The bypass this pins: a non-string field measures as ~0 estimated tokens,
  // so with a truthiness-only shape check a 480KB object cleared the cap and
  // was serialized into the request. Same suite rule as the over-cap rows -
  // the key is a stub and the suite forbids network, so anything other than
  // bad-payload here means the payload reached the transport.
  const keyFile = join(dir, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="from-file"\n');
  const blob = { blob: 'x'.repeat(4 * 120000 + 8) };
  const rev = run(['review', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { stdin: JSON.stringify({ instruction: 'refute this', artifact: blob }) });
  assert.equal(rev.ok, false);
  assert.equal(rev.reason, 'bad-payload');
  const con = run(['consult', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { stdin: JSON.stringify({ situation: blob }) });
  assert.equal(con.ok, false);
  assert.equal(con.reason, 'bad-payload');
  // A number is the same case: truthy, unmeasurable, and not a prompt.
  const num = run(['review', '--provider', 'openai', '--model', 'gpt-test', '--key-file', keyFile],
    { stdin: JSON.stringify({ instruction: 'refute this', artifact: 42 }) });
  assert.equal(num.reason, 'bad-payload');
});

test('cli: review and consult without --model degrade to bad-args before key lookup', () => {
  const rev = run(['review', '--provider', 'openai']);
  assert.equal(rev.ok, false);
  assert.equal(rev.reason, 'bad-args');
  assert.match(rev.detail, /--model/);
  const con = run(['consult', '--provider', 'gemini']);
  assert.equal(con.reason, 'bad-args');
  assert.match(con.detail, /consult/);
});

test('cli: consult payload must carry {situation}', () => {
  const r = run(['consult', '--provider', 'openai', '--model', 'gpt-test'],
    { env: { OPENAI_API_KEY: 'test-not-a-real-key' }, stdin: '{"instruction":"wrong shape"}' });
  assert.equal(r.reason, 'bad-payload');
  assert.match(r.detail, /situation/);
});

test('cli: an env-set key wins - flow proceeds even when the key file is absent', () => {
  const r = run(['review', '--provider', 'openai', '--model', 'gpt-test',
    '--key-file', join(dir, 'nowhere.env')],
  { env: { OPENAI_API_KEY: 'test-not-a-real-key' }, stdin: 'not json {' });
  assert.equal(r.reason, 'bad-payload'); // not no-key: env satisfied resolveKey
});

test('cli: key-file paths expand ~ and default to XDG_CONFIG_HOME', () => {
  const tilde = run(['detect-models', '--provider', 'openai',
    '--key-file', '~/cad-test-absent-providers.env']);
  assert.equal(tilde.reason, 'no-key');
  assert.match(tilde.detail, new RegExp(join(homedir(), 'cad-test-absent-providers.env')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(tilde.detail, /~\//); // really expanded, not literal
  const xdgDir = join(dir, 'xdg');
  const xdg = run(['detect-models', '--provider', 'gemini'],
    { env: { XDG_CONFIG_HOME: xdgDir } });
  assert.equal(xdg.reason, 'no-key');
  assert.match(xdg.detail, new RegExp(join(xdgDir, 'cadence', 'providers.env')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
// --- the provider family of the joined run record (QW-02) --------------------
// The event's CONTENT is asserted against the faked wire in the fault-injection
// section (every failure mode names its reason). What is asserted here is the
// property that must hold whether or not a stub is in play: the record brackets
// a CALL, and a trace it cannot write moves no envelope.
//
// A CALL, not a REQUEST - corrected here, dated 2026-08-08 (phase 1, QW-05).
// This section used to assert that a command issuing no request records
// nothing, which left the five drop-outs that fire MOST in practice - `no-key`,
// `bad-provider`, `bad-args`, `bad-payload`, `over-cap` - writing no record at
// all, since every one of them degrades before the transport is reached. The
// criterion the record exists for is that a reviewer dropping out of a fired
// trigger is NAMED, and a reviewer with no key drops out exactly as hard as one
// the wire refused.

/**
 * A cwd holding a `.planning` the seam will look for, optionally unwritable.
 * `config` is the repo config layer, so a fixture can lower a bound (the prompt
 * cap) that is memoized per process and cannot be moved in the shared one.
 */
function providerCwd(name, breakTrace, config = {}) {
  const cwd = mkdtempSync(join(tmpdir(), `cad-provider-${name}-`));
  const planning = join(cwd, '.planning');
  mkdirSync(planning);
  writeFileSync(join(planning, 'config.json'), JSON.stringify(config));
  writeFileSync(join(planning, 'STATE.md'), renderCursor({
    phase: 3, total: 5, name: 'Fixture', status: 'planned',
    next: '/cad-execute 3', updated: '2026-01-01',
  }));
  // A DIRECTORY at trace.jsonl fails EISDIR for any uid - deterministic where
  // a chmod is a no-op under a root test runner.
  if (breakTrace) mkdirSync(join(planning, 'trace.jsonl'));
  return cwd;
}

/** Every `provider` event in one trace file, oldest first. */
function providerEventsIn(traceFile) {
  if (!existsSync(traceFile)) return [];
  return readFileSync(traceFile, 'utf8').split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((e) => e.family === 'provider');
}

/** Raw stdout bytes from the seam, run inside `cwd`, with no provider keys. */
function runRawIn(cwd, args, stdin) {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.GEMINI_API_KEY;
  delete env.DEEPSEEK_API_KEY;
  try {
    return execFileSync('node', [SCRIPT, ...args],
      { encoding: 'utf8', cwd, env, ...(stdin !== undefined ? { input: stdin } : {}) });
  } catch (e) {
    return e.stdout;
  }
}

test('provider trace: a command that issues no request is STILL recorded, naming its reason', () => {
  // The reversal stated in this section's header: `no-key` degrades before the
  // transport is ever reached, and it is the drop-out a real panel hits most -
  // a configured reviewer whose key is missing on this machine. The record
  // brackets the CALL, so the panel's actual composition is readable whether or
  // not a request was issued.
  const cwd = providerCwd('nokey', false);
  const out = runRawIn(cwd, ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--key-file', join(cwd, 'absent.env')], '{}');
  assert.equal(JSON.parse(out).reason, 'no-key');
  const ev = providerEventsIn(join(cwd, '.planning', 'trace.jsonl'));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].outcome, 'no-key');
  assert.equal(ev[0].degraded, true);
  assert.equal(ev[0].command, 'review');
  assert.equal(ev[0].provider, 'openai');
  assert.equal(ev[0].model, 'gpt-5');
  // No request reached the wire. This is a SUBPROCESS run, where the in-process
  // transport observer (`seen[]`) does not exist, so the assertion is the
  // observable proxy: the event carries no HTTP status, in the detail or as a
  // field. The in-process census below asserts `seen.length === 0` outright,
  // on this same `no-key` drop-out among the others.
  assert.equal('status' in ev[0], false);
  assert.doesNotMatch(String(ev[0].detail), /HTTP/);
});

test('provider trace: --trigger rides the event, joining the call to its fire', () => {
  // RVW-02/D-06: the event already carried provider, model, effort, tier,
  // duration and outcome, and already derived the same phase-scoped `corr` the
  // fire's own events derive - what it could not say is WHICH trigger it was
  // fired for, so a cross-model review and a subagent review of the same phase
  // were indistinguishable. The join is this field on the EXISTING event, never
  // a second one: a duplicate would double-count every cross-model review in
  // renderTrace's `counts.provider`.
  const cwd = providerCwd('trigger', false);
  runRawIn(cwd, ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--trigger', 'risk_surface', '--key-file', join(cwd, 'absent.env')], '{}');
  const ev = providerEventsIn(join(cwd, '.planning', 'trace.jsonl'));
  assert.equal(ev.length, 1, JSON.stringify(ev));   // ONE event, not two
  assert.equal(ev[0].trigger, 'risk_surface');
  assert.ok(ev[0].corr, 'the correlation id the fire joins on');
});

test('provider trace: a call without --trigger writes an event with no trigger key', () => {
  // Absent, never null or empty: the flag is optional, so a caller that names
  // no trigger writes exactly the shape this seam wrote before it existed.
  const cwd = providerCwd('no-trigger', false);
  runRawIn(cwd, ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--key-file', join(cwd, 'absent.env')], '{}');
  const ev = providerEventsIn(join(cwd, '.planning', 'trace.jsonl'));
  assert.equal(ev.length, 1);
  assert.equal('trigger' in ev[0], false, JSON.stringify(ev[0]));
});

test('provider trace: an over-cap refusal records itself, from its own process', () => {
  // A SUBPROCESS with its own cwd, because `maxPromptTokens()` memoizes per
  // process: lowering the cap in the shared in-process fault fixture would push
  // every other case there over it. `over-cap` is the one drop-out that fires
  // AFTER the payload is read and still before any request.
  const cwd = providerCwd('overcap', false, { review: { max_prompt_tokens: 1 } });
  const keyFile = join(cwd, 'providers.env');
  writeFileSync(keyFile, 'OPENAI_API_KEY="test-not-a-real-key"\n');
  const out = runRawIn(cwd, ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--key-file', keyFile],
  JSON.stringify({ instruction: 'refute this', artifact: 'x'.repeat(400) }));
  assert.equal(JSON.parse(out).reason, 'over-cap');
  const ev = providerEventsIn(join(cwd, '.planning', 'trace.jsonl'));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].outcome, 'over-cap');
  assert.equal(ev[0].degraded, true);
  assert.match(ev[0].detail, /review\.max_prompt_tokens/);
  assert.equal(ev[0].command, 'review');
});

test('provider trace: an unwritable trace changes the envelope by not one byte', () => {
  const good = providerCwd('trace-good', false);
  const bad = providerCwd('trace-bad', true);
  const args = ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--key-file', '/nonexistent/providers.env'];
  assert.equal(runRawIn(bad, args, '{}'), runRawIn(good, args, '{}'));
});

// --- fault injection: the six failure modes past the request (QW-05, AC7) -----
//
// Every one of these lives past the transport call, so reaching them needs a
// stand-in for the wire. The stand-in is a FUNCTION replacing a module-private
// reference (`__setTransportForTests`), reachable only from inside this process:
// there is no environment variable, no flag and no config key that moves it,
// because the request it carries holds a resolved provider key in an
// `authorization` header and an out-of-process switch on its destination would
// be a way to make an ordinary run hand that key to a listener the user never
// chose. See the transport comment in review-provider.mjs.
//
// The fake opens no socket, so all six modes are deterministic and the suite
// still makes no network call of any kind - not even to 127.0.0.1. The commands
// run IN PROCESS through the same entry unwind the CLI uses, so every assertion
// below is on the one JSON line and the exit code a caller actually sees.

const faultCwd = mkdtempSync(join(tmpdir(), 'cad-provider-fault-'));
mkdirSync(join(faultCwd, '.planning'));
// A small configured timeout, so the timeout mode can prove the CONFIGURED
// value reached the transport rather than a default nobody set.
writeFileSync(join(faultCwd, '.planning', 'config.json'),
  JSON.stringify({ review: { request_timeout_ms: 25 } }));
writeFileSync(join(faultCwd, '.planning', 'STATE.md'), renderCursor({
  phase: 7, total: 9, name: 'Fault fixture', status: 'executing',
  next: '/cad-execute 7', updated: '2026-01-01',
}));
const FAULT_TRACE = join(faultCwd, '.planning', 'trace.jsonl');
const FAULT_PAYLOAD = join(faultCwd, 'payload.json');
writeFileSync(FAULT_PAYLOAD, JSON.stringify({
  instruction: 'refute this', artifact: 'the artifact under review',
}));
// Always a --payload FILE, never stdin: in process, `readPayload`'s stdin arm
// would read the test runner's own fd 0 and block.
const FAULT_PAYLOAD_CONSULT = join(faultCwd, 'consult.json');
writeFileSync(FAULT_PAYLOAD_CONSULT, JSON.stringify({ situation: 'stuck at a dead end' }));
const REVIEW_ARGS = ['review', '--provider', 'openai', '--model', 'gpt-fault-fixture',
  '--payload', FAULT_PAYLOAD];

/** Every `provider` event recorded in the fault fixture so far, oldest first. */
function providerEvents() {
  return providerEventsIn(FAULT_TRACE);
}

/**
 * The wire, faked. `wire` is one of:
 *   `{timeout:true}`                 - the socket goes quiet and 'timeout' fires
 *   `{status, body}`                 - one chunk, the whole body at once
 *   `{status, chunks:[...]}`         - the body arriving in order, chunk by chunk
 * `body` and `chunks` are the same thing at different granularities: a real
 * response arrives in as many pieces as the network chose, and a bound counted
 * PER CHUNK cannot be exercised by a fake that only ever emits one.
 *
 * `seen` collects what the seam handed the transport, so a test can assert the
 * destination and the options as well as the outcome. Each entry also carries
 * `chunksEmitted` - how many of the list actually reached the seam - which is
 * how a test tells a stream that was CUT from one that was drained.
 *
 * Destroying either half stops the emit loop before the next chunk: `req.destroy`
 * (the seam's own abort mechanism, which also emits 'error' so the promise
 * rejects) and `res.destroy`. A fake that kept emitting after a destroy could not
 * distinguish a seam that aborted the request from one that merely stopped
 * appending, which is the whole distinction the response bound turns on. A cut
 * stream never emits 'end' either - a destroyed socket does not finish.
 */
function fakeTransport(wire, seen) {
  return (/** @type {URL} */ url, /** @type {any} */ options, /** @type {any} */ cb) => {
    const record = { url: String(url), options, chunksEmitted: 0, body: '' };
    seen.push(record);
    let destroyed = false;
    /** @type {any} */
    let live = null;
    const req = Object.assign(new EventEmitter(), {
      // The REQUEST body, kept rather than dropped. It used to be discarded
      // (`write: () => true`), which meant no arm could assert what the seam
      // actually put on the wire - and the outbound fence (#167) is precisely a
      // claim about those bytes. Concatenated the way a socket receives it, so a
      // seam that wrote in pieces reads back whole.
      write: (/** @type {any} */ chunk) => { record.body += String(chunk); return true; },
      destroy: (/** @type {any} */ err) => {
        destroyed = true;
        // A real `ClientRequest.destroy()` during an ACTIVE response aborts the
        // IncomingMessage too, and that emits its OWN 'error' - unhandled, it
        // takes the process down rather than rejecting the promise. The fake
        // emitted on `req` alone, so the response ceiling's abort looked clean
        // here while it could crash in production. Emit on both, res first, and
        // let the first rejection win.
        if (live) live.emit('error', err || new Error('aborted'));
        req.emit('error', err || new Error('socket destroyed'));
      },
      end: () => {
        // Deferred one microtask so the seam's own 'error'/'timeout' listeners
        // are attached first, exactly as they are against a real socket.
        queueMicrotask(() => {
          if (wire.timeout) { req.emit('timeout'); return; }
          const res = Object.assign(new EventEmitter(), {
            statusCode: wire.status,
            destroy: () => { destroyed = true; },
          });
          live = res;
          cb(res);
          const chunks = wire.chunks !== undefined ? wire.chunks
            : wire.body !== undefined ? [wire.body] : [];
          for (const c of chunks) {
            if (destroyed) return;
            res.emit('data', c);
            record.chunksEmitted += 1;
          }
          if (destroyed) return;
          res.emit('end');
        });
      },
    });
    return req;
  };
}

/**
 * Drive one command in process against a faked wire and return exactly what the
 * caller sees: the one JSON line, its parse, the exit code, and the requests the
 * transport was handed.
 * @param {string[]} argv @param {any} wire @param {Record<string,string>} [env]
 */
async function runFaked(argv, wire, env = {}) {
  /** @type {{url: string, options: any, chunksEmitted: number, body: string}[]} */
  const seen = [];
  const restore = __setTransportForTests(fakeTransport(wire, seen));
  const prevCwd = process.cwd();
  const prevExit = process.exitCode;
  const prevEnv = /** @type {Record<string, string|undefined>} */ ({});
  const realWrite = process.stdout.write;
  let out = '';
  for (const [k, v] of Object.entries({ OPENAI_API_KEY: 'test-not-a-real-key', ...env })) {
    prevEnv[k] = process.env[k];
    process.env[k] = v;
  }
  process.chdir(faultCwd);
  process.exitCode = 0;
  // Capture the SEAM's writes only. `emit` writes a string; the test runner
  // writes its own `test:complete` events to this same stdout as v8-serialized
  // BUFFERS, and those flush on whatever tick the runtime picks - observed
  // landing inside this window and turning the one JSON line into unparseable
  // bytes. Forwarding a non-string through keeps the runner's protocol intact
  // and keeps `out` the seam's own output whatever the tick alignment is.
  process.stdout.write = (/** @type {any} */ chunk, /** @type {any[]} */ ...rest) => {
    if (typeof chunk !== 'string') return realWrite.call(process.stdout, chunk, ...rest);
    out += chunk;
    return true;
  };
  try {
    await __runCommandForTests(argv);
  } finally {
    process.stdout.write = realWrite;
    process.chdir(prevCwd);
    restore();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
  const code = process.exitCode;
  process.exitCode = prevExit;
  return { line: out, envelope: JSON.parse(out), code, seen };
}

test('harness: a body split across chunks reaches the seam as the same body', async () => {
  // The equivalence the chunk list has to hold before anything can be counted
  // per chunk: three pieces of one JSON document, split mid-token so no piece
  // parses alone, must produce byte-for-byte the envelope the whole body does.
  const body = JSON.stringify({
    output_text: JSON.stringify({
      findings: [{
        file: 'cadence-core/bin/review-provider.mjs', line: 526, severity: 'low',
        claim: 'the response body is concatenated without a ceiling',
        failure_scenario: 'a proxy error page is held whole in memory',
      }],
    }),
  });
  const whole = await runFaked(REVIEW_ARGS, { status: 200, body });
  const split = await runFaked(REVIEW_ARGS, {
    status: 200, chunks: [body.slice(0, 17), body.slice(17, 90), body.slice(90)],
  });
  assert.equal(whole.envelope.ok, true, whole.line);
  assert.deepEqual(split.envelope, whole.envelope);
  assert.equal(split.envelope.findings.length, 1);
  assert.equal(whole.seen[0].chunksEmitted, 1);
  assert.equal(split.seen[0].chunksEmitted, 3);
});

test('harness: a destroyed response stops the emit loop mid-list', () => {
  // The load-bearing half of the fake. Driven directly rather than through
  // runFaked because the seam does not destroy a response of its own accord -
  // this pins the MECHANISM the byte ceiling will reach for, so a later test
  // asserting "fewer chunks emitted than the list holds" is asserting something
  // the harness can actually report.
  /** @type {any[]} */
  const seen = [];
  const wire = { status: 200, chunks: ['one', 'two', 'three'] };
  let ended = false;
  const req = fakeTransport(wire, seen)(
    new URL('https://api.openai.com/v1/responses'), {},
    (/** @type {any} */ res) => {
      res.on('end', () => { ended = true; });
      res.on('data', () => res.destroy());
    },
  );
  req.on('error', () => {});
  req.end();
  return new Promise((resolve) => setImmediate(() => {
    assert.equal(seen[0].chunksEmitted, 1, 'the stream was cut, not drained');
    assert.equal(ended, false);
    resolve(undefined);
  }));
});

test('fault: the destination is the adapter base, and no environment variable moves it', async () => {
  // The reason the transport seam is a module-private reference and not an env
  // override: this request carries `authorization: Bearer <the user's real key>`,
  // so a variable that redirects it is a credential-read primitive - a `.envrc`
  // in a cloned repo is enough to deliver it, and loopback is not a privilege
  // boundary. Both halves are asserted: the names below are set to a listener an
  // attacker would control and change nothing, and the module reads no
  // destination from the environment AT ALL.
  const hostile = {
    OPENAI_BASE_URL: 'http://127.0.0.1:9/steal',
    OPENAI_API_BASE: 'http://127.0.0.1:9/steal',
    CADENCE_REVIEW_BASE: 'http://127.0.0.1:9/steal',
  };
  const r = await runFaked(REVIEW_ARGS, { status: 401, body: '{}' }, hostile);
  assert.equal(r.seen.length, 1);
  assert.match(r.seen[0].url, /^https:\/\/api\.openai\.com\/v1\/responses$/);
  assert.equal(ADAPTERS.openai.base, 'https://api.openai.com');
  assert.equal(ADAPTERS.gemini.base, 'https://generativelanguage.googleapis.com');
  assert.equal(ADAPTERS.deepseek.base, 'https://api.deepseek.com');
  // The structural half, which a name list alone cannot give. What is asserted:
  // the source mentions the BARE token `process.env` exactly three times, and
  // erasing the two known reads - `process.env.XDG_CONFIG_HOME` (where the key
  // file lives) and the `process.env[name]` key lookup driven by ENV_VAR -
  // leaves none behind.
  //
  // The bare token is the subject deliberately. An earlier form of this test
  // extracted NAMES from `process.env.NAME` and `process.env[NAME]` and compared
  // the sets, which let the exact primitive this file exists to keep out walk
  // straight through it: `const { CADENCE_PROVIDER_BASE } = process.env;` and
  // `const E = process.env; E.CADENCE_PROVIDER_BASE` both matched nothing and
  // both passed. Erase-then-require-nothing-left has no such shape hole -
  // destructured, aliased, computed or merely mentioned in a comment, a new
  // `process.env` fails here. If a legitimate read trips it: a DESTINATION read
  // from the environment is what this guard exists to stop (see the test name and
  // the module header); anything else updates the count and the erase list
  // together, in the same commit, on purpose.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'review-provider.mjs'), 'utf8');
  const count = (s) => (s.match(/process\.env\b/g) || []).length;
  assert.equal(count(src), 3);
  const residue = src
    .replace(/process\.env\.XDG_CONFIG_HOME\b/g, '')
    .replace(/process\.env\[name\]/g, '');
  assert.equal(count(residue), 0);
});

// --- the outbound secret fence (#167) -------------------------------------------
//
// The claim under test is about BYTES ON THE WIRE, not about an envelope field,
// so every arm reads `seen[0].body` - what the transport was actually handed.
// An arm that only checked the envelope would pass against a seam that reported
// a redaction count and sent the raw artifact anyway, which is the exact bug
// shape a fence can have.

/** A well-formed review response, so the fence arms reach `ok` rather than a fault. */
const FENCE_OK_BODY = JSON.stringify({
  output_text: JSON.stringify({
    findings: [{
      file: 'a.mjs', line: 1, severity: 'low',
      claim: 'a finding, so the arm reaches the ok path',
      failure_scenario: 'none - the response half is fixture, the request half is the subject',
    }],
  }),
});

/** @param {string} name @param {any} payload @returns {string[]} argv for runFaked */
function fencePayloadArgs(name, payload) {
  const file = join(faultCwd, name);
  writeFileSync(file, JSON.stringify(payload));
  return ['review', '--provider', 'openai', '--model', 'gpt-fault-fixture', '--payload', file];
}

test('fence: a credential in the artifact does not reach the wire (#167)', async () => {
  // Two shapes in one artifact, one per redactor, because the two exports are a
  // deliberate split and neither is a superset of the other: a `name=value`
  // pair (redactCredentials) and a URL userinfo (redactUrl). An arm carrying
  // only one would pass against a fence that composed only half.
  const SECRET = 'sk-ant-not-a-real-key-0123456789';
  const artifact = [
    'diff --git a/.env b/.env',
    '+OPENAI_API_KEY=' + SECRET,
    '+remote = https://cad:s3cr3t-tok@host.invalid/r.git',
    'the surrounding prose a reviewer needs to act on the diff',
  ].join('\n');
  const before = providerEvents().length;
  const r = await runFaked(
    fencePayloadArgs('fence-payload.json', { instruction: 'refute this', artifact }),
    { status: 200, body: FENCE_OK_BODY });

  const wire = r.seen[0].body;
  assert.ok(wire.length > 0, 'the fake recorded no request body - the arm cannot fail correctly');
  assert.equal(wire.includes(SECRET), false, 'the api key reached the wire');
  assert.equal(wire.includes('s3cr3t-tok'), false, 'the url userinfo reached the wire');
  assert.ok(wire.includes('<redacted>'), 'nothing was redacted');
  // The other half, the one a redactor returning the empty string would fail:
  // what a reviewer needs in order to review still arrives.
  assert.ok(wire.includes('the surrounding prose a reviewer needs'), 'the artifact was eaten');
  assert.ok(wire.includes('diff --git'), 'the diff header was eaten');

  // Two spans removed, and the count is reported in both places rather than
  // swallowed - a reviewer that read `<redacted>` saw less than was composed.
  assert.equal(r.envelope.ok, true);
  assert.equal(r.envelope.redactions, 2);
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].redactions, 2);
});

test('fence: a clean artifact crosses byte-identical and adds no field (#167)', async () => {
  // The cost side. A fence that fired on ordinary code would silently degrade
  // every review in the repository, so the no-op case is asserted as hard as
  // the catching one: same bytes, and no `redactions` key at all - the same
  // non-zero-only shape `config_warnings` uses, so a call over a clean artifact
  // writes the event it wrote before this existed.
  const artifact = 'export function add(a, b) { return a + b; }\n// john@jcrenshaw.dev owns this\n';
  const before = providerEvents().length;
  const r = await runFaked(
    fencePayloadArgs('fence-clean.json', { instruction: 'refute this', artifact }),
    { status: 200, body: FENCE_OK_BODY });

  const sent = JSON.parse(r.seen[0].body);
  assert.equal(sent.input[1].content, artifact, 'a clean artifact was altered');
  assert.equal(sent.input[0].content, 'refute this', 'a clean instruction was altered');
  assert.equal(r.envelope.ok, true);
  assert.equal('redactions' in r.envelope, false);
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1);
  assert.equal('redactions' in ev[0], false);
});

test('fence: consult fences its situation too (#167)', async () => {
  // consult is the second PAID command and carries repository text under a
  // different key. It shares the header's design contract, so it shares the arm.
  const SECRET = 'hunter2-not-a-real-password';
  const file = join(faultCwd, 'fence-consult.json');
  writeFileSync(file, JSON.stringify({
    situation: 'the deploy fails and password=' + SECRET + ' is in the log',
  }));
  const body = JSON.stringify({
    output_text: JSON.stringify({
      angles: [{ hypothesis: 'a', rationale: 'b', how_to_check: 'c' }],
    }),
  });
  const r = await runFaked(
    ['consult', '--provider', 'openai', '--model', 'gpt-fault-fixture', '--payload', file],
    { status: 200, body });
  assert.equal(r.seen[0].body.includes(SECRET), false, 'the password reached the wire');
  assert.ok(r.seen[0].body.includes('the deploy fails'), 'the situation was eaten');
  assert.equal(r.envelope.ok, true);
  assert.equal(r.envelope.redactions, 1);
});

test('fence: an artifact that already holds the mark still reports a redaction (#167)', async () => {
  // Net marks added is not spans removed. Here a credential pair COLLAPSES onto
  // a mark the artifact already carried - one mark in, one mark out - so the
  // arithmetic alone comes back 0 and both the envelope and the trace would say
  // the reviewer got the whole artifact. It did not.
  const SECRET = 's3cr3t-value-that-must-not-ship';
  const artifact = 'password="already <redacted> and then ' + SECRET + '"';
  const before = providerEvents().length;
  const r = await runFaked(
    fencePayloadArgs('fence-premarked.json', { instruction: 'refute this', artifact }),
    { status: 200, body: FENCE_OK_BODY });
  assert.equal(r.seen[0].body.includes(SECRET), false, 'the secret reached the wire');
  assert.equal(r.envelope.ok, true);
  assert.ok(r.envelope.redactions >= 1,
    `the payload was altered but reported ${r.envelope.redactions} redactions`);
  const ev = providerEvents().slice(before);
  assert.ok(ev[0].redactions >= 1, 'the trace reported no redaction on an altered payload');
});

test('fence: the cap measures the FENCED text, not the raw payload (#167)', async () => {
  // Ordering, asserted rather than assumed. The fence runs after the string
  // gate and before `assertUnderCap`, so what the cap counts is what leaves the
  // process. Redaction changes the length, and a cap applied to the raw text
  // would be bounding something the provider never sees.
  //
  // The fixture config pins a small cap, so an artifact whose RAW form is over
  // it and whose FENCED form is under it separates the two orderings by outcome
  // rather than by inspection.
  const raw = 'api_key=' + 'A'.repeat(400);
  const fenced = raw.replace(/api_key=A+/, '<redacted>');
  assert.ok(raw.length > fenced.length + 300, 'the fixture does not separate the two lengths');
  const r = await runFaked(
    fencePayloadArgs('fence-cap.json', { instruction: 'x', artifact: raw }),
    { status: 200, body: FENCE_OK_BODY });
  // Whatever the configured cap is, the two orderings cannot both be true: the
  // wire body is the fenced text, and it is the fenced text the cap admitted.
  assert.equal(r.envelope.ok, true, `the fenced payload was refused: ${r.line}`);
  assert.equal(r.seen[0].body.includes('A'.repeat(400)), false);
});

test('fault mode 1/6 - request timeout: the caller sees transport, and the trace names it', async () => {
  const before = providerEvents().length;
  const r = await runFaked(REVIEW_ARGS, { timeout: true });
  assert.equal(r.envelope.ok, false);
  assert.equal(r.envelope.reason, 'transport');
  // The configured 25ms from the fixture config reached the transport AND the
  // message, so this is the seam's own timeout wiring, not a canned string.
  assert.equal(r.seen[0].options.timeout, 25);
  assert.match(r.envelope.detail, /timed out after 25ms/);
  assert.equal(r.code, 1);
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].outcome, 'transport');
  assert.equal(ev[0].degraded, true);
  assert.match(ev[0].detail, /timed out/);
  assert.equal(ev[0].command, 'review');
  assert.equal(ev[0].provider, 'openai');
});

test('fault mode 2/6 - HTTP 4xx: the caller sees http with the status, and the trace names it', async () => {
  const before = providerEvents().length;
  const body = JSON.stringify({
    error: { message: 'Incorrect API key provided', type: 'invalid_request_error', code: 'invalid_api_key' },
  });
  const r = await runFaked(REVIEW_ARGS, { status: 401, body });
  assert.equal(r.envelope.ok, false);
  assert.equal(r.envelope.reason, 'http');
  assert.equal(r.envelope.detail.status, 401);
  // ONE envelope shape: `body` is always a sanitized string excerpt, never a
  // parsed object for a small body and a string for a large one (D-04). What the
  // tests here have always protected - that the user reads WHICH refusal it was
  // rather than a bare status - is matched as TEXT inside that excerpt.
  assert.equal(typeof r.envelope.detail.body, 'string');
  assert.match(r.envelope.detail.body, /invalid_api_key/);
  assert.equal(r.code, 1);
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].outcome, 'http');
  assert.equal(ev[0].degraded, true);
  assert.match(ev[0].detail, /HTTP 401/);
});

test('fault mode 3/6 - HTTP 5xx: the caller sees http with the status, not a retry', async () => {
  const before = providerEvents().length;
  const body = JSON.stringify({ error: { message: 'The service is temporarily unavailable' } });
  const r = await runFaked(REVIEW_ARGS, { status: 503, body });
  assert.equal(r.envelope.reason, 'http');
  assert.equal(r.envelope.detail.status, 503);
  assert.equal(typeof r.envelope.detail.body, 'string');
  assert.match(r.envelope.detail.body, /temporarily unavailable/);
  assert.equal(r.code, 1);
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1);          // one call, one event: no hidden retry
  assert.match(ev[0].detail, /HTTP 503/);
});

test('fault mode 4/6 - a dead or unknown model id: the provider 404 reaches the caller intact', async () => {
  const before = providerEvents().length;
  const body = JSON.stringify({
    error: {
      message: "The model 'gpt-fault-fixture' does not exist or you do not have access to it.",
      type: 'invalid_request_error', code: 'model_not_found',
    },
  });
  const r = await runFaked(REVIEW_ARGS, { status: 404, body });
  assert.equal(r.envelope.reason, 'http');
  assert.equal(r.envelope.detail.status, 404);
  // The one thing /cad-config's review arm reads this envelope FOR: WHICH model
  // was refused, rather than a bare 404. It survives as text inside the excerpt -
  // the whole 155-byte body fits under the 1024-byte cap with room to spare,
  // which is why the cap is that number and not a round one.
  assert.equal(typeof r.envelope.detail.body, 'string');
  assert.match(r.envelope.detail.body, /model_not_found/);
  assert.match(r.envelope.detail.body, /gpt-fault-fixture/);
  assert.equal(r.envelope.detail.body.includes('...[truncated]'), false);
  const ev = providerEvents().slice(before);
  assert.equal(ev[0].outcome, 'http');
  assert.equal(ev[0].model, 'gpt-fault-fixture');
});

test('fault mode 5/6 - a malformed or truncated body: bad-json, and no text at all: no-output', async () => {
  const before = providerEvents().length;
  // A 200 whose extracted text is truncated JSON - the shape a stream cut short
  // produces. The transport parsed fine; the MODEL output did not.
  const truncated = await runFaked(REVIEW_ARGS, {
    status: 200, body: JSON.stringify({ output_text: '{"findings":[{"file":"a.mjs","line":1,' }),
  });
  assert.equal(truncated.envelope.ok, false);
  assert.equal(truncated.envelope.reason, 'bad-json');
  assert.equal(truncated.code, 1);
  // A 200 with no extractable text at all is the other half of D-22's mapping.
  const empty = await runFaked(REVIEW_ARGS, { status: 200, body: JSON.stringify({}) });
  assert.equal(empty.envelope.reason, 'no-output');
  assert.equal(empty.code, 1);
  const ev = providerEvents().slice(before);
  assert.deepEqual(ev.map((e) => e.outcome), ['bad-json', 'no-output']);
  assert.equal(ev[0].degraded, true);
  assert.equal(ev[1].degraded, true);
});

test('fault mode 6/6 - an EMPTY findings set is ok:true and is NOT a drop-out (D-22)', async () => {
  const before = providerEvents().length;
  const r = await runFaked(REVIEW_ARGS, {
    status: 200, body: JSON.stringify({ output_text: '{"findings":[]}' }),
  });
  assert.equal(r.envelope.ok, true);
  assert.deepEqual(r.envelope.findings, []);
  assert.equal(r.envelope.provider, 'openai');
  assert.equal(r.code, 0);
  // The half that matters: a reviewer that legitimately found nothing must not
  // be recorded as a degradation, or every clean review disarms the gate it
  // passed by looking like a dropped panel member.
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].outcome, 'ok');
  assert.equal('degraded' in ev[0], false);
  assert.equal('detail' in ev[0], false);
});

test('fault: consult and detect-models degrade through the same six-mode mapping', async () => {
  // The modes are properties of the shared transport path, not of `review`:
  // bounding one command would leave the identical defect one function away.
  const consult = await runFaked(['consult', '--provider', 'openai', '--model', 'gpt-fault-fixture',
    '--payload', FAULT_PAYLOAD_CONSULT], { status: 500, body: '{}' });
  assert.equal(consult.envelope.reason, 'http');
  assert.equal(consult.envelope.detail.status, 500);
  const dead = await runFaked(['detect-models', '--provider', 'openai'], { timeout: true });
  assert.equal(dead.envelope.reason, 'transport');
  // detect-models carries no model, so its tier is null by construction.
  const ev = providerEvents().slice(-1)[0];
  assert.equal(ev.command, 'detect-models');
  assert.equal(ev.model, null);
  assert.equal(ev.tier, null);
});

// --- the RESPONSE bound (RVP-01, AC1) -----------------------------------------
//
// The bound the seam did not own. Everything above degrades on what the provider
// SAID; this degrades on how much of it there was, which until now was bounded
// only by the execution host's wrapping command timeout.

/** Kept in step with `MAX_RESPONSE_BYTES` in review-provider.mjs, by hand and
 * on purpose: a test that imported the constant would pass against any value,
 * including a wrong one. */
const MAX_RESPONSE_BYTES = 4194304;

/**
 * An openai-shaped 200 body of EXACTLY `total` ASCII bytes carrying one valid
 * finding, so a size test is a size test and not a shape test in disguise.
 *
 * The filler rides a SIBLING key of `output_text`, not the finding's `claim`.
 * It used to pad the claim, which stopped being a valid finding the moment
 * RVP-02 gave `claim` a 2000-character maximum - and a fixture that degrades
 * to `bad-shape` proves nothing about the response ceiling. `extractText`
 * reads `output_text` and ignores everything beside it, so the bytes on the
 * wire are unchanged and the finding stays inside every schema bound.
 * @param {number} total
 */
function bodyOfBytes(total) {
  const make = (/** @type {number} */ pad) => JSON.stringify({
    output_text: JSON.stringify({
      findings: [{
        file: 'cadence-core/bin/review-provider.mjs', line: 526, severity: 'low',
        claim: 'the body is held whole in memory',
        failure_scenario: 'a proxy error page arrives unbounded',
      }],
    }),
    _filler: 'x'.repeat(pad),
  });
  const base = make(0).length;
  const out = make(total - base);
  assert.equal(Buffer.byteLength(out), total, 'the filler must not be escaped');
  return out;
}

test('bound: a response past the ceiling is over-response, and the stream is CUT', async () => {
  const before = providerEvents().length;
  // Eight 1 MiB chunks. The running total crosses on the fifth (4 MiB exactly is
  // AT the ceiling, not over it), so a seam that destroys the request stops
  // three chunks short of the list - and a seam that merely stopped appending
  // would drain all eight.
  const chunks = Array.from({ length: 8 }, () => 'A'.repeat(1048576));
  const r = await runFaked(REVIEW_ARGS, { status: 200, chunks });
  assert.equal(r.envelope.ok, false, r.line);
  assert.equal(r.envelope.reason, 'over-response');
  assert.equal(r.code, 1);
  assert.match(r.envelope.detail, new RegExp(`over ${MAX_RESPONSE_BYTES} bytes`));
  assert.equal(r.seen[0].chunksEmitted, 5, 'the stream was cut on the crossing chunk');
  const ev = providerEvents().slice(before);
  assert.equal(ev.length, 1, JSON.stringify(ev));
  assert.equal(ev[0].outcome, 'over-response');
  assert.equal(ev[0].degraded, true);
  assert.equal(ev[0].command, 'review');
});

test('bound: one read path, so consult and detect-models are bounded by the same change', async () => {
  const chunks = Array.from({ length: 8 }, () => 'A'.repeat(1048576));
  const consult = await runFaked(['consult', '--provider', 'openai', '--model', 'gpt-fault-fixture',
    '--payload', FAULT_PAYLOAD_CONSULT], { status: 200, chunks });
  assert.equal(consult.envelope.reason, 'over-response');
  assert.equal(consult.seen[0].chunksEmitted, 5);
  const detect = await runFaked(['detect-models', '--provider', 'openai'], { status: 200, chunks });
  assert.equal(detect.envelope.reason, 'over-response');
  assert.equal(detect.seen[0].chunksEmitted, 5);
  const ev = providerEvents().slice(-2);
  assert.deepEqual(ev.map((e) => e.command), ['consult', 'detect-models']);
  assert.deepEqual(ev.map((e) => e.outcome), ['over-response', 'over-response']);
});

test('bound: a body one byte under the ceiling still resolves exactly as before', async () => {
  // The half a ceiling makes easy to break. Under the bound nothing changes:
  // same envelope, same parse, same findings.
  const r = await runFaked(REVIEW_ARGS, { status: 200, body: bodyOfBytes(MAX_RESPONSE_BYTES - 1) });
  assert.equal(r.envelope.ok, true, r.line.slice(0, 300));
  assert.equal(r.envelope.findings.length, 1);
  assert.equal(r.envelope.findings[0].severity, 'low');
  assert.equal(r.code, 0);
});

test('bound: an ordinary socket error is still transport, not over-response', async () => {
  // The discrimination the tag exists for. Both paths reject out of the same
  // `request()` promise, so a seam that matched on the message text - or that
  // mapped every rejection to one word - would be indistinguishable here.
  const r = await runFaked(REVIEW_ARGS, { timeout: true });
  assert.equal(r.envelope.reason, 'transport');
  assert.equal(providerEvents().slice(-1)[0].outcome, 'transport');
});

/** Kept in step with `MAX_HTTP_BODY_BYTES` by hand, for the same reason. */
const MAX_HTTP_BODY_BYTES = 1024;

test('bound: the http envelope carries a capped, sanitized excerpt - one shape always', async () => {
  // The body a misconfigured gateway actually returns: the upstream error PLUS
  // an echo of the request it could not forward, headers and query string
  // included. None of it is in URL userinfo position, so this is exactly what
  // `redactUrl` alone could not see.
  const body = JSON.stringify({
    error: { message: 'upstream rejected the request', code: 'bad_gateway' },
    request: {
      authorization: 'Bearer sk-live-abc123',
      url: 'https://api.example/v1/responses?key=sk-live-abc123&x=1',
      api_token: 'glpat-xyz',
      secret: 'hunter2',
    },
  });
  const r = await runFaked(REVIEW_ARGS, { status: 502, body });
  assert.equal(r.envelope.reason, 'http');
  assert.equal(typeof r.envelope.detail.body, 'string');
  assert.ok(Buffer.byteLength(r.envelope.detail.body) <= MAX_HTTP_BODY_BYTES, r.envelope.detail.body);
  for (const planted of ['key=', 'token', 'secret', 'Bearer',
    'sk-live-abc123', 'glpat-xyz', 'hunter2']) {
    assert.equal(r.envelope.detail.body.includes(planted), false,
      `${planted} survived: ${r.envelope.detail.body}`);
  }
  // The other half: an excerpt that redacted everything would be worthless, so
  // the diagnostic a reader acts on must still be there.
  assert.match(r.envelope.detail.body, /upstream rejected the request/);
  assert.match(r.envelope.detail.body, /bad_gateway/);
});

test('bound: a body over the excerpt cap is cut, and says so', async () => {
  // The proxy HTML error page - the case the cap exists for. `detail.body` is a
  // string here and a string in the 155-byte model_not_found case above: ONE
  // shape, so no consumer branches on `typeof detail.body`.
  const page = `<html><head><title>504 Gateway Time-out</title></head><body>${'p'.repeat(20000)}</body></html>`;
  const r = await runFaked(REVIEW_ARGS, { status: 504, body: page });
  assert.equal(typeof r.envelope.detail.body, 'string');
  assert.equal(Buffer.byteLength(r.envelope.detail.body), MAX_HTTP_BODY_BYTES);
  assert.ok(r.envelope.detail.body.endsWith('...[truncated]'), r.envelope.detail.body);
  assert.match(r.envelope.detail.body, /504 Gateway Time-out/);
  assert.equal(r.envelope.detail.status, 504);
});

test('bound: a body near the RESPONSE ceiling is excerpted in bounded time', async () => {
  // The two bounds meet here. `MAX_RESPONSE_BYTES` lets a non-2xx body reach
  // 4 MiB, and `redactUrl` is quadratic in its input - measured 78ms at 10KB,
  // 5.1s at 80KB - so sanitizing the whole body would cost hours for one failure
  // envelope. The generous wall-clock bound is deliberate: it is not a benchmark,
  // it is the difference between milliseconds and geological time, and it
  // reddens by TIMING OUT if the sanitize window is ever removed.
  const body = 'p'.repeat(1048576);
  const started = Date.now();
  const r = await runFaked(REVIEW_ARGS, { status: 502, body });
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started}ms`);
  assert.equal(typeof r.envelope.detail.body, 'string');
  assert.equal(Buffer.byteLength(r.envelope.detail.body), MAX_HTTP_BODY_BYTES);
});

// --- the drop-outs BEFORE the wire (QW-05, AC7) -------------------------------
//
// Everything above this line degrades past the transport. These degrade before
// it - and they are the ones that fire in practice, since a missing key, a
// misconfigured provider name and a malformed payload need no network to
// happen. Each must leave exactly one `provider` event naming its reason, or a
// panel that silently shrank to one reviewer reads as a panel of one.

const ABSENT_KEY_FILE = join(faultCwd, 'absent-providers.env');
const BAD_PAYLOAD_FILE = join(faultCwd, 'bad-payload.json');
writeFileSync(BAD_PAYLOAD_FILE, 'not json {');

test('drop-out: every refusal before the wire writes ONE provider event naming its reason', async () => {
  // `OPENAI_API_KEY: ''` is falsy for resolveKey, so the no-key rows fall
  // through to the key FILE - and that file is named absent rather than left to
  // the XDG default, so the run can never read a real key off this machine.
  const nokeyEnv = { OPENAI_API_KEY: '' };
  /** @type {[string, string[], Record<string,string>, string][]} */
  const cases = [
    ['review/bad-provider',
      ['review', '--provider', 'skynet', '--model', 'm', '--payload', FAULT_PAYLOAD], {}, 'bad-provider'],
    ['review/bad-args',
      ['review', '--provider', 'openai', '--payload', FAULT_PAYLOAD], {}, 'bad-args'],
    ['review/no-key',
      ['review', '--provider', 'openai', '--model', 'gpt-fault-fixture',
        '--key-file', ABSENT_KEY_FILE, '--payload', FAULT_PAYLOAD], nokeyEnv, 'no-key'],
    ['review/bad-payload',
      ['review', '--provider', 'openai', '--model', 'gpt-fault-fixture',
        '--payload', BAD_PAYLOAD_FILE], {}, 'bad-payload'],
    ['consult/bad-provider',
      ['consult', '--provider', 'skynet', '--model', 'm', '--payload', FAULT_PAYLOAD_CONSULT], {}, 'bad-provider'],
    ['consult/bad-args',
      ['consult', '--provider', 'openai', '--payload', FAULT_PAYLOAD_CONSULT], {}, 'bad-args'],
    ['consult/no-key',
      ['consult', '--provider', 'openai', '--model', 'gpt-fault-fixture',
        '--key-file', ABSENT_KEY_FILE, '--payload', FAULT_PAYLOAD_CONSULT], nokeyEnv, 'no-key'],
    ['consult/bad-payload',
      // A payload that parses but carries {instruction, artifact} instead of
      // {situation} - the wrong-shape half, which the review rows cover with a
      // file that does not parse at all.
      ['consult', '--provider', 'openai', '--model', 'gpt-fault-fixture',
        '--payload', FAULT_PAYLOAD], {}, 'bad-payload'],
    ['detect-models/bad-provider',
      ['detect-models', '--provider', 'skynet'], {}, 'bad-provider'],
    ['detect-models/no-key',
      ['detect-models', '--provider', 'openai', '--key-file', ABSENT_KEY_FILE], nokeyEnv, 'no-key'],
  ];
  for (const [name, argv, env, outcome] of cases) {
    const before = providerEvents().length;
    // A wire that would answer 200 if it were reached, so a case that fails to
    // stop early fails LOUDLY here (`seen.length === 0`) rather than passing on
    // an outcome the transport happened to produce.
    const r = await runFaked(argv, { status: 200, body: JSON.stringify({ output_text: '{"findings":[]}' }) }, env);
    assert.equal(r.envelope.ok, false, name);
    assert.equal(r.envelope.reason, outcome, name);
    assert.equal(r.code, 1, name);
    assert.equal(r.seen.length, 0, `${name}: nothing may reach the wire`);
    const ev = providerEvents().slice(before);
    assert.equal(ev.length, 1, `${name}: exactly one event, got ${JSON.stringify(ev)}`);
    assert.equal(ev[0].outcome, outcome, name);
    assert.equal(ev[0].degraded, true, name);
    assert.equal(ev[0].command, argv[0], name);
    assert.equal(ev[0].provider, argv[2], name);
    assert.ok(typeof ev[0].detail === 'string' && ev[0].detail.length > 0, `${name}: detail is a string`);
  }
});

test('drop-out: `bad-command` records nothing - no command ever began', async () => {
  // The one refusal with no call to bracket. It is reached from main() before
  // any command runs, so there is no provider, no model and no subject; an
  // event here would be an invented one. In process, so this also pins that the
  // bracket does not survive from the previous command in the same process.
  const before = providerEvents().length;
  const r = await runFaked(['nonsense', '--provider', 'openai'], { status: 200, body: '{}' });
  assert.equal(r.envelope.reason, 'bad-command');
  assert.equal(r.seen.length, 0);
  assert.deepEqual(providerEvents().slice(before), []);
});

test('fault: a 200 the schema does not match is bad-shape, distinct from bad-json', async () => {
  // The seventh outcome the mapping already had, kept adjacent so the six modes
  // above cannot be read as the whole set: valid JSON, wrong shape.
  const r = await runFaked(REVIEW_ARGS, {
    status: 200, body: JSON.stringify({ output_text: '{"findings":[{"file":"a.mjs"}]}' }),
  });
  assert.equal(r.envelope.ok, false);
  assert.equal(r.envelope.reason, 'bad-shape');
  // `validateFindings` names the FIRST defect, which for a `{file}`-only
  // finding is `claim` - the field order it checks, not the schema's order.
  assert.match(r.envelope.detail, /finding\.claim must be a string/);
});

// --- what the provider says the call cost (CST-04) ----------------------------
//
// Every fixture below is shaped like the response of the provider it is fed to,
// verified against that provider's own live documentation on 2026-09-01: the
// OpenAI Responses openapi spec (`ResponseUsage`), the Gemini v1beta discovery
// document (`UsageMetadata`), and the DeepSeek create-chat-completion page. One
// fixture PER ADAPTER and not one shared shape, because the defect this guards
// against is a reader spelling one provider's field wrong - which a shared
// fixture would hide, and which `references/provider-api.md` cannot catch on its
// own if the doc repeats the same mistake the reader made.

/** OpenAI Responses. `output_tokens` already includes `reasoning_tokens`. */
const OPENAI_USAGE = {
  input_tokens: 1837,
  input_tokens_details: { cached_tokens: 512, cache_write_tokens: 0 },
  output_tokens: 402,
  output_tokens_details: { reasoning_tokens: 320 },
  total_tokens: 2239,
};
/** Gemini. `candidatesTokenCount` EXCLUDES `thoughtsTokenCount`. */
const GEMINI_USAGE = {
  promptTokenCount: 1204,
  candidatesTokenCount: 96,
  thoughtsTokenCount: 250,
  totalTokenCount: 1550,
};
/** DeepSeek Chat Completions. `completion_tokens` already includes reasoning. */
const DEEPSEEK_USAGE = {
  prompt_tokens: 980,
  completion_tokens: 311,
  total_tokens: 1291,
  prompt_cache_hit_tokens: 640,
  prompt_cache_miss_tokens: 340,
  completion_tokens_details: { reasoning_tokens: 208 },
};
const CLEAN_FINDINGS = '{"findings":[]}';

/** One 200 body in each provider's own response shape. */
const openaiBody = (usage) => JSON.stringify({
  output_text: CLEAN_FINDINGS, ...(usage ? { usage } : {}),
});
const geminiBody = (usage) => JSON.stringify({
  candidates: [{ content: { parts: [{ text: CLEAN_FINDINGS }] } }],
  ...(usage ? { usageMetadata: usage } : {}),
});
const deepseekBody = (usage) => JSON.stringify({
  choices: [{ message: { content: CLEAN_FINDINGS } }], ...(usage ? { usage } : {}),
});

/** The newest provider event, which is the one the call just made wrote. */
function lastProviderEvent() {
  const ev = providerEvents();
  return ev[ev.length - 1];
}

test('CST-04: every adapter records the usage ITS provider reported, in its own spelling', async () => {
  const cases = [
    ['openai', ['review', '--provider', 'openai', '--model', 'gpt-fault-fixture',
      '--payload', FAULT_PAYLOAD], openaiBody(OPENAI_USAGE), OPENAI_USAGE,
    { input: 1837, output: 402 }, {}],
    // `output` is 96 + 250: Gemini reports thinking tokens beside the answer
    // tokens where the other two fold them in, so a normalized pair that took
    // `candidatesTokenCount` alone would price a thinking reviewer at a quarter
    // of what it burned.
    ['gemini', ['review', '--provider', 'gemini', '--model', 'gemini-fault-fixture',
      '--payload', FAULT_PAYLOAD], geminiBody(GEMINI_USAGE), GEMINI_USAGE,
    { input: 1204, output: 346 }, { GEMINI_API_KEY: 'test-not-a-real-key' }],
    ['deepseek', ['review', '--provider', 'deepseek', '--model', 'deepseek-fault-fixture',
      '--payload', FAULT_PAYLOAD], deepseekBody(DEEPSEEK_USAGE), DEEPSEEK_USAGE,
    { input: 980, output: 311 }, { DEEPSEEK_API_KEY: 'test-not-a-real-key' }],
  ];
  for (const [provider, argv, body, raw, normalized, env] of cases) {
    const before = providerEvents().length;
    const r = await runFaked(argv, { status: 200, body }, env);
    assert.equal(r.envelope.ok, true, `${provider}: ${r.line}`);
    const ev = providerEvents().slice(before);
    assert.equal(ev.length, 1, `${provider} writes ONE event: ${JSON.stringify(ev)}`);
    assert.equal(ev[0].outcome, 'ok');
    assert.equal(ev[0].provider, provider);
    // BOTH keys: the normalized pair a reader sums across a mixed panel, and
    // the provider's own object an auditor joins back to the wire (D-02).
    assert.deepEqual(ev[0].usage, normalized, `${provider} normalized pair`);
    assert.deepEqual(ev[0].usage_raw, raw, `${provider} raw usage object`);
  }
});

test('CST-04: a response carrying no usage writes NEITHER key - absent, never zero', async () => {
  // D-11. Asserted as absence with `in`, the shape the no-`--trigger` test
  // already uses: a zero here would make every provider event written before
  // this change read as a call that cost nothing.
  for (const [argv, body, env] of [
    [['review', '--provider', 'openai', '--model', 'gpt-fault-fixture',
      '--payload', FAULT_PAYLOAD], openaiBody(null), {}],
    [['review', '--provider', 'gemini', '--model', 'gemini-fault-fixture',
      '--payload', FAULT_PAYLOAD], geminiBody(null), { GEMINI_API_KEY: 'test-not-a-real-key' }],
    [['review', '--provider', 'deepseek', '--model', 'deepseek-fault-fixture',
      '--payload', FAULT_PAYLOAD], deepseekBody(null), { DEEPSEEK_API_KEY: 'test-not-a-real-key' }],
  ]) {
    const r = await runFaked(argv, { status: 200, body }, env);
    assert.equal(r.envelope.ok, true, r.line);
    const ev = lastProviderEvent();
    assert.equal('usage' in ev, false, JSON.stringify(ev));
    assert.equal('usage_raw' in ev, false, JSON.stringify(ev));
  }
});

test('CST-04: a credential-shaped span in the provider usage object never reaches the trace', async () => {
  // The usage object is bytes a PROVIDER chose, and the event carrying it
  // persists in `.planning/trace.jsonl` - so a hostile or compromised
  // OpenAI-compatible gateway can answer 200 with a well-formed usage object
  // carrying one extra field and, unfenced, that field is copied verbatim into
  // the run record for good. The outbound fence cannot catch it: it runs on the
  // instruction and the artifact, which are what leaves the machine.
  //
  // One case per rule the shared fence owns, because a fix that reached only
  // the `name: value` spelling would leave the other three: a snake_case pair,
  // an `authorization` echo, a URL carrying userinfo, and a camelCase name
  // (which rule 4 structurally cannot see - it crosses `_`, `-` and `.` only).
  const hostile = [
    ['a credential-shaped name/value pair', { api_key: 'sk-live-AAAA1111BBBB2222' }],
    ['an authorization echo', { authorization: 'Bearer sk-live-CCCC3333DDDD4444' }],
    ['a URL carrying userinfo', { gateway: 'https://cad:s3cr3t-tok@gw.example.invalid/v1' }],
    ['a camelCase credential name', { apiSecret: 'hunter2-not-a-real-secret' }],
  ];
  for (const [name, extra] of hostile) {
    const before = providerEvents().length;
    const r = await runFaked(REVIEW_ARGS,
      { status: 200, body: openaiBody({ ...OPENAI_USAGE, ...extra }) });
    assert.equal(r.envelope.ok, true, `${name}: ${r.line}`);
    const ev = providerEvents().slice(before);
    assert.equal(ev.length, 1, `${name} writes ONE event: ${JSON.stringify(ev)}`);
    // The raw object is dropped WHOLE - asserted as absence, the same shape
    // D-11 is asserted in, since a fenced-but-present object would still be a
    // provider-shaped blob nobody vetted.
    assert.equal('usage_raw' in ev[0], false, `${name}: ${JSON.stringify(ev[0])}`);
    // And the PAIR still rides: a hostile extra field must not cost the event
    // the figure it exists to carry, or the fence would be a denial-of-pricing.
    assert.deepEqual(ev[0].usage, { input: 1837, output: 402 }, name);
  }
  // Not merely off that one key: none of the four planted values is anywhere in
  // the record, which is the property the trace file actually has to have.
  const written = readFileSync(FAULT_TRACE, 'utf8');
  for (const needle of ['sk-live-', 's3cr3t-tok', 'hunter2']) {
    assert.equal(written.includes(needle), false, `${needle} reached the trace`);
  }
  // The negative control, so none of the above can pass by dropping `usage_raw`
  // always: a clean usage object from the same adapter still writes it.
  const before = providerEvents().length;
  await runFaked(REVIEW_ARGS, { status: 200, body: openaiBody(OPENAI_USAGE) });
  assert.deepEqual(providerEvents().slice(before)[0].usage_raw, OPENAI_USAGE);
});

test('CST-04: a call that burned its budget and came back unusable still records what it burned', async () => {
  // D-04, one case per degraded terminal outcome. Three cases and not one,
  // because the usage read happens on the way to `extractText` and each of
  // these leaves that frame at a different line - a `bad-shape` case alone
  // would pass with the read sitting anywhere after the two earlier exits, and
  // those two would then record nothing.
  const cases = [
    // No output text at all: the response body carries usage and nothing else.
    ['no-output', JSON.stringify({ usage: OPENAI_USAGE })],
    // Output that is not JSON.
    ['bad-json', JSON.stringify({ output_text: '{"findings":[{"file":"a.mjs",',
      usage: OPENAI_USAGE })],
    // Parsed, but not a findings list.
    ['bad-shape', JSON.stringify({ output_text: '{"findings":[{"file":"a.mjs"}]}',
      usage: OPENAI_USAGE })],
  ];
  for (const [outcome, body] of cases) {
    const before = providerEvents().length;
    const r = await runFaked(REVIEW_ARGS, { status: 200, body });
    assert.equal(r.envelope.reason, outcome, r.line);
    const ev = providerEvents().slice(before);
    assert.equal(ev.length, 1, `${outcome} writes ONE event: ${JSON.stringify(ev)}`);
    assert.equal(ev[0].outcome, outcome);
    assert.deepEqual(ev[0].usage, { input: 1837, output: 402 }, outcome);
    assert.deepEqual(ev[0].usage_raw, OPENAI_USAGE, outcome);
  }
  // The other side of D-04: a call that reached no response has nothing to
  // read, so `http` records the drop-out and no usage at all.
  const before = providerEvents().length;
  const http = await runFaked(REVIEW_ARGS, { status: 429, body: '{"error":"rate limited"}' });
  assert.equal(http.envelope.reason, 'http');
  const ev = providerEvents().slice(before);
  assert.equal(ev[0].outcome, 'http');
  assert.equal('usage' in ev[0], false, JSON.stringify(ev[0]));
});

test('CST-04: provider usage is its OWN denomination and reaches no role total (D-01)', async () => {
  // AC4, stated positively. `cad-reviewer` has to be PRESENT under `roles` with
  // no token figure: an assertion that merely finds no number under that role
  // passes vacuously when the role is missing from the block altogether, which
  // is exactly what a provider-only phase renders today.
  const planning = join(faultCwd, '.planning');
  appendEvent(planning, { phase: 7, family: 'lifecycle', event: 'dispatch', plan: '7', role: 'cad-reviewer' });
  appendEvent(planning, { phase: 7, family: 'lifecycle', event: 'return', plan: '7', role: 'cad-reviewer' });
  await runFaked(REVIEW_ARGS, { status: 200, body: openaiBody(OPENAI_USAGE) });

  const r = renderTrace(planning, 7);
  // Not vacuous: the usage this render must NOT fold is really in the record.
  const priced = r.events.filter((e) => e.family === 'provider' && e.usage);
  assert.ok(priced.length > 0, 'the render has to see a priced provider call at all');
  assert.deepEqual(priced[priced.length - 1].usage, { input: 1837, output: 402 });

  assert.ok('cad-reviewer' in r.roles, `cad-reviewer under roles: ${JSON.stringify(r.roles)}`);
  assert.equal(r.roles['cad-reviewer'].dispatches, 1);
  assert.equal('tokens' in r.roles['cad-reviewer'], false,
    `no host figure was recorded, so no total: ${JSON.stringify(r.roles['cad-reviewer'])}`);
  assert.equal(r.roles['cad-reviewer'].unrecorded, 1);
  // And no provider figure anywhere else in the block either - the numbers off
  // the wire must not appear under ANY role, whatever the row is called.
  const rolesJson = JSON.stringify(r.roles);
  for (const n of [1837, 402, 2239, 512, 320]) {
    assert.doesNotMatch(rolesJson, new RegExp(`\\b${n}\\b`),
      `${n} came off the wire and must not be billed to a role: ${rolesJson}`);
  }
});

// --- the RVP-01 falsifier -----------------------------------------------------
//
// WATCHED FAILING AT e1e6c0a, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout:
//
//   $ node --test --test-name-pattern='RVP-01' cadence-core/bin/review-provider.test.mjs
//   AssertionError [ERR_ASSERTION]: a flooding provider must meet a bound
//   Cadence owns, got: {"ok":false,"reason":"internal","detail":"Cannot read
//   properties of null (reading 'output_text')"}
//     + actual - expected
//     + 'internal'
//     - 'over-response'
//
// Which is the defect exactly: 8 MiB was concatenated whole into one string, the
// parse of it failed, and what the caller got back for a flooding provider was
// `internal` with a TypeError in it. Nothing named the bound because nothing
// held one.
//
// Both halves of RVP-01 in one test, driven through the seam's own entry unwind
// and the existing fault fixture, importing nothing this plan added - so against
// the unpatched tree it fails on an ASSERTION rather than on a missing export,
// which is the difference between proving the behaviour changed and proving the
// module did. To re-watch it: `git worktree add --detach <tmp> e1e6c0a`, copy
// this file into that checkout's `cadence-core/bin/`, `node --test` it there,
// then remove the worktree.

test('RVP-01: the response is bounded by bytes Cadence owns, and the failure envelope is capped', async () => {
  // Half one. 8 MiB arriving in 1 MiB chunks. Unbounded, the seam concatenates
  // all of it and reports on whatever the string turned out to be; bounded, it
  // destroys the request on the crossing chunk and names its own refusal.
  const flood = await runFaked(REVIEW_ARGS, {
    status: 200, chunks: Array.from({ length: 8 }, () => 'A'.repeat(1048576)),
  });
  assert.equal(flood.envelope.reason, 'over-response',
    `a flooding provider must meet a bound Cadence owns, got: ${flood.line}`);
  assert.ok(flood.seen[0].chunksEmitted < 8,
    'the request must be destroyed, not drained to the end of the body');

  // Half two. A gateway that echoes the request it could not forward - the key
  // in the query string, the authorization header, and two credential-shaped
  // fields - inside a body far past the excerpt cap.
  const echo = JSON.stringify({
    error: { message: 'upstream rejected the request', code: 'bad_gateway' },
    request: {
      authorization: 'Bearer sk-live-abc123',
      url: 'https://api.example/v1/responses?key=sk-live-abc123',
      api_token: 'glpat-xyz',
      secret: 'hunter2',
    },
    padding: 'q'.repeat(4096),
  });
  const failure = await runFaked(REVIEW_ARGS, { status: 502, body: echo });
  assert.equal(typeof failure.envelope.detail.body, 'string',
    `the envelope must carry ONE shape, got: ${typeof failure.envelope.detail.body}`);
  assert.ok(Buffer.byteLength(failure.envelope.detail.body) <= 1024,
    `the excerpt must be capped, got ${Buffer.byteLength(failure.envelope.detail.body)} bytes`);
  for (const planted of ['Bearer', 'key=', 'token', 'secret', 'sk-live-abc123', 'glpat-xyz', 'hunter2']) {
    assert.equal(failure.envelope.detail.body.includes(planted), false,
      `${planted} rode the failure envelope`);
  }
  assert.match(failure.envelope.detail.body, /upstream rejected the request/);
});

test('bound: a credential straddling the sanitize window does not reach the envelope', async () => {
  // The window-edge case the phase-3 deep pass found and this fixes at the
  // root. `bodyExcerpt` sanitizes a bounded 4096-byte window, so a credential
  // whose closing quote falls OUTSIDE that window arrives at `redactCredentials`
  // unterminated. The trailing-token safeguard cannot catch it either: that arm
  // is gated on `clean <= room`, and this body is built so redaction shrinks the
  // window to JUST PAST the cap - 73 bytes of the value rode the envelope.
  //
  // The prefix must be COMPRESSIBLE for that to happen: 77 credential pairs of
  // 48 bytes each collapse to 12, which is the ~4:1 ratio that puts the
  // straddling value inside the first `room` bytes of the sanitized result.
  const filler = '"token":"' + 'A'.repeat(36) + '", ';
  const body = filler.repeat(77)
    + '"password":"SUPERSECRET_' + 'S'.repeat(400) + '"'
    + 'x'.repeat(8000);
  const failure = await runFaked(REVIEW_ARGS, { status: 502, body });
  assert.equal(failure.envelope.detail.body.includes('SUPERSECRET'), false,
    `a window-straddling credential rode the envelope: ${failure.envelope.detail.body}`);
  assert.ok(Buffer.byteLength(failure.envelope.detail.body) <= 1024,
    'the excerpt is still capped');
});

// --- the EXP-02 falsifier -----------------------------------------------------
//
// WATCHED FAILING AT ae73dd6, the tip of the tree this plan opened against -
// the leak reproduces there with `lib/redact-url.mjs` exactly as committed.
// Observed there, with this file AND cadence-core/bin/review-provider.mjs
// copied into that checkout (that module's only change in this plan is the
// `export` keyword on `bodyExcerpt`, so the copy carries no part of the repair):
//
//   $ node --test --test-name-pattern='EXP-02' \
//       cadence-core/bin/review-provider.test.mjs
//   AssertionError [ERR_ASSERTION]: 73 bytes of the planted value rode the
//   failure envelope: "d>, <redacted>, <redacted>, <redacted>, <redacted>,
//   <redacted>, <redacted>, <redacted>, <redacted>, https://cad:SUPERSECRET_
//   SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS
//   ...[truncated]"
//   73 !== 0
//   AssertionError [ERR_ASSERTION]: 985 bytes of the planted value rode the
//   failure envelope: "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS
//   [...] ...[truncated]"
//   985 !== 0
//   (2 failing, exit 1)
//
// Which is the defect exactly: `SCHEME_USERINFO` and `BARE_USERINFO` are both
// `@`-anchored, so a userinfo span whose `@` fell outside the 4096-byte
// sanitize window matched nothing, survived byte-identical into `clean`, and
// rode the capped excerpt into the failure envelope a human reads. The two
// figures are MEASURED at that commit rather than restated from #215: 73 bytes
// of the planted value on the issue's own 4:1-compressible shape, and 985 on
// the high-magnitude one - the class is worth two orders of magnitude more than
// the figure the issue happened to observe (D-08).
//
// To re-watch it: `git worktree add --detach <tmp> ae73dd6`, copy BOTH
// `cadence-core/bin/review-provider.test.mjs` AND
// `cadence-core/bin/review-provider.mjs` into that checkout's
// `cadence-core/bin/`, run
// `node --test --test-name-pattern='EXP-02' cadence-core/bin/review-provider.test.mjs`
// there, then remove the worktree. The SECOND copy is not optional and is also
// the reason task 1 of this plan changed nothing but an export keyword: without
// it `bodyExcerpt` is module-private at ae73dd6 and the family fails on an
// undefined function rather than on the leak. The `--test-name-pattern` scope
// is what keeps the other cases in this file that also redden there - the
// redact-url window-edge fixtures - from being mistaken for the watched
// failure.

// Driven straight through `bodyExcerpt`, which is exported for this family and
// nothing else (D-09): the window edge is reachable with one string here, while
// reaching it through `runFaked` costs a fake transport plus a body tuned to a
// compression ratio. Read off the NAMESPACE import for the reason stated at the
// top of this file - the RVP-01 and RVP-02 re-watch recipes copy only this file
// into their own, older checkouts, and a named import of a symbol those trees
// do not export would take the whole file down at load instead of failing the
// one family that is watching something.
const bodyExcerpt = reviewProvider.bodyExcerpt;

/**
 * How many bytes of the planted value came back. The two cases below report a
 * FIGURE rather than `true !== false` because the defect is a magnitude: the
 * excerpt is capped either way, and what changes is how much of the secret fits
 * inside the cap.
 * @param {string} out
 */
const leaked = (out) => (out.match(/SUPERSECRET_S*/) || [''])[0].length;

/** The tail of an excerpt, which is where a cut span lands. @param {string} out */
const tail = (out) => JSON.stringify(out.slice(-200));

// TWO parametrizations, deliberately two TESTS rather than two halves of one
// (D-08): a single test stops at its first failed assertion, and the whole
// point of the second case is that its measured magnitude is read off the
// watched run too. Both carry the `EXP-02` prefix, so one
// `--test-name-pattern` still scopes the family.

test('EXP-02: a userinfo span the window cut before its `@` never reaches the excerpt', () => {
  // #215's own shape: a prefix of credential pairs that compresses about 4:1
  // (77 pairs of 48 bytes collapsing to 12 each), then a credentialed URL whose
  // `@` falls outside the 4096-byte window. Sanitizing shrinks the window to
  // JUST PAST the 1024-byte cap, which is what skips the `clean <= room`
  // whitespace safeguard - the same arithmetic as the quoted-value fixture
  // above, pointed at the span `redactCredentials` structurally cannot see.
  const filler = '"token":"' + 'A'.repeat(36) + '", ';
  const body = filler.repeat(77)
    + 'https://cad:SUPERSECRET_' + 'S'.repeat(400) + '@host.invalid/r.git'
    + 'x'.repeat(8000);
  const out = bodyExcerpt(body);
  assert.equal(leaked(out), 0,
    `${leaked(out)} bytes of the planted value rode the failure envelope: ${tail(out)}`);
  assert.equal(out.includes('cad:'), false, `the userinfo survived: ${tail(out)}`);
  assert.ok(Buffer.byteLength(out) <= MAX_HTTP_BODY_BYTES, 'the excerpt is still capped');
});

test('EXP-02: the same cut span at high magnitude - the class, not the issue figure', () => {
  // The fix is sized to the CLASS (D-08). One 3 KB credential pair compresses
  // to 12 bytes, so nearly the whole 1009-byte excerpt is left for the cut
  // span: the identical defect, two orders of magnitude more of the secret.
  const body = '"token":"' + 'A'.repeat(3000) + '", '
    + 'https://cad:SUPERSECRET_' + 'S'.repeat(2000) + '@host.invalid/r.git'
    + 'x'.repeat(8000);
  const out = bodyExcerpt(body);
  assert.equal(leaked(out), 0,
    `${leaked(out)} bytes of the planted value rode the failure envelope: ${tail(out)}`);
  assert.equal(out.includes('cad:'), false, `the userinfo survived: ${tail(out)}`);
  assert.ok(Buffer.byteLength(out) <= MAX_HTTP_BODY_BYTES, 'the excerpt is still capped');
});

// --- the RVP-02 falsifier -----------------------------------------------------
//
// WATCHED FAILING AT 15b5d4c, the tip of this plan's unpatched tree. Observed
// there, with this file AND cadence-core/bin/lib/schema-eval.mjs copied into
// that checkout:
//
//   $ node --test --test-name-pattern='RVP-02: local validation' \
//       cadence-core/bin/review-provider.test.mjs
//   AssertionError [ERR_ASSERTION]: a zero line number must not reach the
//   caller as a finding, got: {"ok":true,"provider":"openai","model":
//   "gpt-fault-fixture","findings":[{"file":"cadence-core/bin/
//   review-provider.mjs","line":0,"severity":"low","claim":"the shape came
//   back unchecked","failure_scenario":"it reaches a human for triage as if
//   it were a finding"}]}
//     + actual - expected
//     + true
//     - false
//   (exit 1)
//
// Which is the defect exactly: local validation checked an integer `line` and
// three string fields and nothing else, so a provider answer the canonical
// schema refuses - a zero line number, an empty claim, a key nobody declared -
// came back `ok:true` and went to a human for triage as if it were a finding.
//
// Driven through the seam's own entry unwind and the existing fault fixture,
// importing nothing this plan added, so against the unpatched tree it fails on
// its ASSERTIONS rather than on a missing export. That is also why
// FINDING_SCHEMA reaches this file through a namespace import (see the top): a
// named import of a symbol the unpatched module does not export is a LINK
// error, and the file would never load.
//
// To re-watch it: `git worktree add --detach <tmp> <SHA>`, copy this file into
// that checkout's `cadence-core/bin/` AND `cadence-core/bin/lib/schema-eval.mjs`
// into that checkout's `cadence-core/bin/lib/`, run
// `node --test --test-name-pattern='RVP-02' cadence-core/bin/review-provider.test.mjs`
// there, then remove the worktree. The SECOND copy is not optional: the
// evaluator cases earlier in this file `import` that module, so a checkout
// carrying only the test file fails at module resolution before any assertion
// runs - a green-to-red transition that proves nothing about RVP-02. The
// `--test-name-pattern` scope is what keeps the other new cases in this file,
// which also redden there, from being mistaken for the watched failure.

test('RVP-02: local validation refuses exactly what the canonical schema refuses', async () => {
  const finding = (/** @type {any} */ patch) => JSON.stringify({
    output_text: JSON.stringify({
      findings: [{
        file: 'cadence-core/bin/review-provider.mjs', line: 526, severity: 'low',
        claim: 'the shape came back unchecked',
        failure_scenario: 'it reaches a human for triage as if it were a finding',
        ...patch,
      }],
    }),
  });

  // Three answers the schema refuses and the unpatched validator admitted.
  const cases = [
    { name: 'a zero line number', body: finding({ line: 0 }), names: /line/ },
    { name: 'an empty claim', body: finding({ claim: '' }), names: /claim/ },
    { name: 'a key nobody declared', body: finding({ confidence: 0.4 }), names: /confidence/ },
  ];
  for (const c of cases) {
    const r = await runFaked(REVIEW_ARGS, { status: 200, body: c.body });
    assert.equal(r.envelope.ok, false,
      `${c.name} must not reach the caller as a finding, got: ${r.line}`);
    assert.equal(r.envelope.reason, 'bad-shape',
      `${c.name} must degrade as bad-shape, got: ${r.line}`);
    assert.match(r.envelope.detail, c.names,
      `${c.name}: the diagnostic must name the offending field, got: ${r.envelope.detail}`);
  }
});
