// Zero-dep tests for review-provider.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Two layers: unit tests import the pure helpers (no network, no side
// effects - main() is guarded); CLI tests exercise the argument/key/payload
// paths that fail BEFORE any provider call. The wire paths themselves are
// pinned in references/provider-api.md and deliberately untested here - no
// network in the suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, parseEnvFile, stripAdditionalProperties,
  validateFindings, validateConsult, classify, ADAPTERS,
} from './review-provider.mjs';

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

test('classify: broken or missing hints degrade to all-unknown, nothing excluded', () => {
  const broken = join(dir, 'hints-broken.json');
  writeFileSync(broken, '{ not json');
  for (const hintsFile of [broken, join(dir, 'hints-absent.json')]) {
    const out = classify('openai', ['gpt-5.2', 'text-embedding-3-large'], hintsFile);
    assert.deepEqual(out, [
      { id: 'gpt-5.2', tier: null, high_effort: null },
      { id: 'text-embedding-3-large', tier: null, high_effort: null }, // exclude list gone too
    ]);
  }
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

test('adapters: deepseek structuredRequest is chat/completions json_object with in-prompt schema', () => {
  const req = ADAPTERS.deepseek.structuredRequest({
    model: 'deepseek-v4-pro', effort: 'high', system: 'Refute this.', user: 'the artifact',
    schema: { type: 'object' }, schemaName: 'cadence_review',
  });
  assert.equal(req.path, '/chat/completions');
  assert.equal(req.method, 'POST');
  assert.equal(req.body.model, 'deepseek-v4-pro');
  assert.equal(req.body.response_format.type, 'json_object');
  assert.equal(req.body.reasoning_effort, 'high');
  assert.equal(req.body.messages[0].role, 'system');
  assert.equal(req.body.messages[1].content, 'the artifact');
  // The schema is injected into the system prompt (no server-side json_schema),
  // and the literal word "json" is present (json_object mode requires it).
  assert.match(req.body.messages[0].content, /Refute this\./);
  assert.match(req.body.messages[0].content, /cadence_review/);
  assert.match(req.body.messages[0].content, /json/i);
  // Effort is omitted entirely when not requested.
  const noEffort = ADAPTERS.deepseek.structuredRequest({
    model: 'deepseek-chat', system: 's', user: 'u', schema: {}, schemaName: 'x',
  });
  assert.equal('reasoning_effort' in noEffort.body, false);
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