// Zero-dep tests for review-provider.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Two layers: unit tests import the pure helpers (no network, no side
// effects - main() is guarded); CLI tests exercise the argument/key/payload
// paths that fail BEFORE any provider call. The wire paths themselves are
// pinned in references/provider-api.md and deliberately untested here - no
// network in the suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  const out = classify('openai', ['text-embedding-3-large', 'brand-new-model']);
  assert.equal(out.some((m) => m.id.includes('embedding')), false); // excluded modality
  const unknown = out.find((m) => m.id === 'brand-new-model');
  assert.deepEqual(unknown, { id: 'brand-new-model', tier: null, high_effort: null });
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

test('cli: missing key degrades to no-key naming where to set it', () => {
  const r = run(['detect-models', '--provider', 'openai',
    '--key-file', join(dir, 'absent-providers.env')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-key');
  assert.match(r.detail, /OPENAI_API_KEY/);
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