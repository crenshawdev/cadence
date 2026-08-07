// Zero-dep tests for review-provider.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Two layers: unit tests import the pure helpers (no network, no side
// effects - main() is guarded); CLI tests exercise the argument/key/payload
// paths that fail BEFORE any provider call. The wire paths themselves are
// pinned in references/provider-api.md and deliberately untested here - no
// network in the suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, parseEnvFile, stripAdditionalProperties,
  validateFindings, validateConsult, classify, ADAPTERS,
  readModelHints, detectEnvelope, resolveTimeoutMs,
  resolveMaxPromptTokens, estimatePromptTokens,
} from './review-provider.mjs';
import { renderCursor } from './lib/planning-files.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'review-provider.mjs');
const dir = mkdtempSync(join(tmpdir(), 'cad-provider-'));

/** Run the CLI without provider keys in the environment; parse the JSON line. */
function run(args, { env = {}, stdin } = {}) {
  const cleanEnv = { ...process.env, ...env };
  delete cleanEnv.OPENAI_API_KEY;
  delete cleanEnv.GEMINI_API_KEY;
  delete cleanEnv.DEEPSEEK_API_KEY;
  Object.assign(cleanEnv, env);
  try {
    return JSON.parse(execFileSync('node', [SCRIPT, ...args],
      { encoding: 'utf8', env: cleanEnv, ...(stdin !== undefined ? { input: stdin } : {}) }));
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
      { encoding: 'utf8', env: cleanEnv });
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
// The event's CONTENT is asserted against the loopback stub in the fault-
// injection section (every failure mode names its reason). What is asserted
// here is the property that must hold whether or not a stub is in play: the
// record brackets a REQUEST, and a trace it cannot write moves no envelope.

/** A cwd holding a `.planning` the seam will look for, optionally unwritable. */
function providerCwd(name, breakTrace) {
  const cwd = mkdtempSync(join(tmpdir(), `cad-provider-${name}-`));
  const planning = join(cwd, '.planning');
  mkdirSync(planning);
  writeFileSync(join(planning, 'config.json'), '{}');
  writeFileSync(join(planning, 'STATE.md'), renderCursor({
    phase: 3, total: 5, name: 'Fixture', status: 'planned',
    next: '/cad-execute 3', updated: '2026-01-01',
  }));
  // A DIRECTORY at trace.jsonl fails EISDIR for any uid - deterministic where
  // a chmod is a no-op under a root test runner.
  if (breakTrace) mkdirSync(join(planning, 'trace.jsonl'));
  return cwd;
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

test('provider trace: a command that issues no request records nothing', () => {
  // `no-key` degrades before the transport is ever reached, so there is no
  // request to bracket - the record must not invent one.
  const cwd = providerCwd('nokey', false);
  const out = runRawIn(cwd, ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--key-file', join(cwd, 'absent.env')], '{}');
  assert.equal(JSON.parse(out).reason, 'no-key');
  assert.equal(existsSync(join(cwd, '.planning', 'trace.jsonl')), false);
});

test('provider trace: an unwritable trace changes the envelope by not one byte', () => {
  const good = providerCwd('trace-good', false);
  const bad = providerCwd('trace-bad', true);
  const args = ['review', '--provider', 'openai', '--model', 'gpt-5',
    '--key-file', '/nonexistent/providers.env'];
  assert.equal(runRawIn(bad, args, '{}'), runRawIn(good, args, '{}'));
});
