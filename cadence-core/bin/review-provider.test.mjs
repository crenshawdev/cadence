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
import { renderCursor } from './lib/planning-files.mjs';

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

test('validateFindings: accepts the exact shape, names the first defect', () => {
  const good = { findings: [{ file: 'a.ts', line: 3, severity: 'high', claim: 'c', failure_scenario: 'f' }] };
  assert.equal(validateFindings(good), null);
  assert.match(validateFindings({}), /missing findings/);
  assert.match(validateFindings({ findings: [{ ...good.findings[0], line: 'three' }] }), /line must be an integer/);
  assert.match(validateFindings({ findings: [{ ...good.findings[0], severity: 'catastrophic' }] }), /bad severity/);
});

test('validateConsult: angles need all three string fields', () => {
  assert.equal(validateConsult({ angles: [{ hypothesis: 'h', rationale: 'r', how_to_check: 'c' }] }), null);
  assert.match(validateConsult({ angles: [{ hypothesis: 'h', rationale: 'r' }] }), /how_to_check/);
  assert.match(validateConsult({}), /missing angles/);
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
 * The wire, faked. `wire` is `{timeout:true}` or `{status, body}`; `seen`
 * collects what the seam handed the transport, so a test can assert the
 * destination and the options as well as the outcome.
 */
function fakeTransport(wire, seen) {
  return (/** @type {URL} */ url, /** @type {any} */ options, /** @type {any} */ cb) => {
    seen.push({ url: String(url), options });
    const req = Object.assign(new EventEmitter(), {
      write: () => true,
      destroy: (/** @type {any} */ err) => {
        req.emit('error', err || new Error('socket destroyed'));
      },
      end: () => {
        // Deferred one microtask so the seam's own 'error'/'timeout' listeners
        // are attached first, exactly as they are against a real socket.
        queueMicrotask(() => {
          if (wire.timeout) { req.emit('timeout'); return; }
          const res = Object.assign(new EventEmitter(), { statusCode: wire.status });
          cb(res);
          if (wire.body !== undefined) res.emit('data', wire.body);
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
  /** @type {{url: string, options: any}[]} */
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
  process.stdout.write = (/** @type {any} */ chunk) => { out += chunk; return true; };
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
  assert.equal(r.envelope.detail.body.error.code, 'invalid_api_key');
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
  // The body is passed through, so the user reads WHICH model was refused
  // rather than a bare 404.
  assert.equal(r.envelope.detail.body.error.code, 'model_not_found');
  assert.match(r.envelope.detail.body.error.message, /gpt-fault-fixture/);
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
