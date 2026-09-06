// Frozen-tag fixture builder. Rebuilds never read live planning state or the clock.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const tag = 'v3.7.12';
const topFiles = ['config.json', 'PROJECT.md', 'ARCHIVE.md', 'DECLINED.md', 'FILED.md', 'DOCS-CLAIMS.md'];
// Captured from the live phase-1 records on 2026-09-05; pinned inputs thereafter.
const traceSeed = [
  {
    "corr": "1",
    "phase": 1,
    "ts": "2026-09-05T19:01:29.911Z",
    "family": "routing",
    "event": "resolve",
    "role": "cad-planner",
    "agent": "cad-planner",
    "model": "opus",
    "model_source": "roles.cad-planner.model",
    "effort": "high",
    "escalated": false,
    "pinned": false,
    "attempt": 1,
    "warning_count": 2
  },
  {
    "corr": "1",
    "phase": 1,
    "ts": "2026-09-05T19:01:29.936Z",
    "family": "routing",
    "event": "resolve",
    "role": "cad-executor",
    "agent": "cad-executor",
    "model": "opus",
    "model_source": "roles.cad-executor.model",
    "effort": "high",
    "escalated": false,
    "pinned": false,
    "attempt": 1,
    "warning_count": 1
  },
  {
    "corr": "1",
    "phase": 1,
    "ts": "2026-09-05T19:01:29.959Z",
    "family": "routing",
    "event": "resolve",
    "role": "cad-verifier",
    "agent": "cad-verifier",
    "model": "opus",
    "model_source": "roles.cad-verifier.model",
    "effort": "high",
    "escalated": false,
    "pinned": false,
    "attempt": 1,
    "warning_count": 1
  }
];
const readsSeed = [
  {
    "ts": "2026-09-05T20:15:36.830Z",
    "tool": "Bash",
    "agent": "coordinator",
    "tool_use_id": "toolu_012jut8PjMt5SbHYMi6Mk5q6",
    "target": "mkdir",
    "files": [
      ".planning/phases/1/CONTEXT.md"
    ],
    "bytes": 93
  },
  {
    "ts": "2026-09-05T20:15:51.891Z",
    "tool": "Bash",
    "agent": "coordinator",
    "tool_use_id": "toolu_013BkyV2oXAG7Xhy5PJ5tZzy",
    "target": "echo",
    "files": [
      ".planning/phases/1/CONTEXT.md",
      ".planning/STATE.md"
    ],
    "bytes": 267
  },
  {
    "ts": "2026-09-05T20:18:10.819Z",
    "tool": "Bash",
    "agent": "coordinator",
    "tool_use_id": "toolu_017kYPykZqHZGQejU9wj8YWD",
    "target": "grep",
    "files": [
      ".planning/phases/1/CONTEXT.md"
    ],
    "bytes": 1261
  }
];
const provenance = {};

function git(...args) {
  return execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
}
// Neutralize the authoring repository path in frozen tag content. A fixture
// carrying a live machine's repo root makes recordings that echo it machine-
// specific: <REPO> substitution fires there, so drift passes only there.
// Keep every other absolute path, including /tmp prose, intact (D-12 / M02):
// faithfully echoing fixture input must still pass, not be scrubbed away.
function sanitizeTagContent(bytes) {
  return Buffer.from(bytes.toString().replaceAll('/code/cadence', '/srv/example-project'));
}
function tagBytes(path) { return sanitizeTagContent(git('show', `${tag}:${path}`)); }
function tagPaths(prefix) {
  return git('ls-tree', '-r', '--name-only', '-z', tag, '--', prefix)
    .toString().split('\0').filter(Boolean).sort();
}
// Refuse symlinks in the output chain: rebuilding a fixture must not write outside it.
function write(path, bytes) {
  const rel = relative(here, path);
  if (rel.startsWith(`..${sep}`) || rel === '..') throw new Error('fixture output escapes golden directory');
  let parent = here;
  if (lstatSync(parent).isSymbolicLink()) throw new Error('symlinked golden directory');
  for (const part of relative(here, dirname(path)).split(sep).filter(Boolean)) {
    parent = join(parent, part);
    if (existsSync(parent)) {
      if (!lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink()) throw new Error(`unsafe fixture directory: ${parent}`);
    } else mkdirSync(parent);
  }
  if (existsSync(path) && !lstatSync(path).isFile()) throw new Error(`unsafe fixture file: ${path}`);
  // lstat also rejects a dangling symlink rather than following it on the write.
  try { if (lstatSync(path).isSymbolicLink()) throw new Error(`symlinked fixture file: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!existsSync(path) || !readFileSync(path).equals(Buffer.from(bytes))) writeFileSync(path, bytes);
}
function bundle(name) {
  provenance[name] = { tag, tag_paths: [], synthesized: [], seeded: [] };
  return {
    copy(from, to = from) {
      write(join(here, 'fixtures', name, to), tagBytes(from));
      provenance[name].tag_paths.push({ from, to });
    },
    text(path, text, seeded = false) {
      const copied = provenance[name].tag_paths.find(p => p.to === path);
      if (copied) {
        // A derived file is more than a path-sanitized tag copy. Keep its origin
        // beside the synthesis record instead of making that claim twice.
        provenance[name].tag_paths = provenance[name].tag_paths.filter(p => p !== copied);
        (provenance[name].derived_from ??= []).push(copied);
      }
      write(join(here, 'fixtures', name, path), text);
      const list = provenance[name][seeded ? 'seeded' : 'synthesized'];
      if (!list.includes(path)) list.push(path);
    },
  };
}
function live(name, archive, phase, incomplete = false) {
  const b = bundle(name);
  const prefix = `.planning/${archive}/${phase}/`;
  const paths = tagPaths(prefix);
  if (!paths.length) throw new Error(`missing frozen archive: ${prefix}`);
  for (const path of paths) {
    const suffix = path.slice(prefix.length);
    if (incomplete && suffix.startsWith('reports/')) continue;
    b.copy(path, `.planning/phases/${phase}/${suffix}`);
  }
  if (incomplete) provenance[name].omitted = paths.filter(p => p.slice(prefix.length).startsWith('reports/'));
  for (const name of topFiles) b.copy(`.planning/${name}`);
  const ids = new Set();
  for (const path of paths.filter(p => /\/PLAN-\d+\.md$/.test(p))) {
    const text = tagBytes(path).toString();
    const inline = text.match(/^requirements: \[([^\]\n]*)\]$/m);
    const block = text.match(/^requirements:\n((?:  - [^\n]+\n)+)/m);
    if (!inline && !block) throw new Error(`missing requirements in ${path}`);
    const values = inline ? inline[1].split(',').map(s => s.trim())
      : block[1].trim().split('\n').map(s => s.trim().slice(2));
    for (const id of values) if (id) ids.add(id);
  }
  const next = phase + 1;
  b.text('.planning/ROADMAP.md', `# Roadmap: Golden ${name}\n\n## Phases\n\n- [x] **Phase ${phase}: Archived phase** - Complete archive\n- [ ] **Phase ${next}: Next phase** - Unplanned continuation\n\n## Phase Details\n\n### Phase ${phase}: Archived phase\n**Goal:** Preserve the archived phase\n**Depends on:** Nothing\n\n### Phase ${next}: Next phase\n**Goal:** Continue the live cycle\n**Depends on:** Phase ${phase}\n`);
  b.text('.planning/STATE.md', `# State\n\nPhase: ${next} of 2\nStatus: ready to plan\nNext: /cad-context ${next}\nUpdated: 2026-09-05\n`);
  b.text('.planning/REQUIREMENTS.md', '# Requirements: Golden fixture\n\n## Active\n\n' + [...ids].sort().map(id => `- **${id}**: Archived phase ${phase} requirement\n`).join('') + '\n## Traceability\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n');
  b.text('.planning/trace.jsonl', traceSeed.map(row => JSON.stringify({ ...row, corr: String(phase), phase })).join('\n') + '\n', true);
  b.text('.planning/reads.jsonl', readsSeed.map(row => JSON.stringify(row).replaceAll('.planning/phases/1/', `.planning/phases/${phase}/`)).join('\n') + '\n', true);
  b.text('.planning/CAPTURE.md', '# Capture\n\n## Todos\n\n## Seeds\n\n## Notes\n', true);
  return b;
}

live('slice', '_archive-v3.7.3', 1);
live('multi', '_archive-v3.3.0', 5);
live('incomplete', '_archive-v3.7.3', 1, true);
const closed = bundle('closed');
for (const path of tagPaths('.planning').filter(p => p.split('/').length === 2)) closed.copy(path);

const json = (b, path, value, seeded = false) => b.text(path, JSON.stringify(value, null, 2) + '\n', seeded);
const frozenConfig = JSON.parse(tagBytes('.planning/config.json').toString());
const frozenId = git('rev-parse', `${tag}^{commit}`).toString().trim();
const sourceText = '// CADENCE-DEBT: literal policy fixture | ceiling: one local policy | trigger: a second policy\n'
  + 'export const authorized = true;\n';
const finding = { file: 'src/auth.mjs', line: 2, severity: 'low',
  claim: 'The policy is a literal.', failure_scenario: 'A second policy would need a separate decision.' };

const malformed = live('malformed', '_archive-v3.7.3', 1);
const planSource = '.planning/_archive-v3.7.3/1/PLAN-1.md';
malformed.text('.planning/phases/1/PLAN-1.md', tagBytes(planSource).toString()
  .replace(/^(files:\n  - )([^\n]+)/m, '$1`$2`'));

const project = live('project', '_archive-v3.7.3', 1);
json(project, 'package.json', { name: 'golden-project', private: true, type: 'module',
  scripts: { lint: 'eslint .', typecheck: 'tsc --noEmit' }, dependencies: { passport: '0.7.0' } });
project.text('src/auth.mjs', sourceText);
project.text('.planning/phases/1/PLAN-1.md', '---\nphase: 1\nplan: 1\nrequirements: [TRC-04]\nfiles:\n'
  + '  - src/auth.mjs\n---\n\n# Source policy\n\n## Tasks\n\n### Task 1: Update the policy\n\n'
  + '- **Files:** src/auth.mjs\n- **Action:** Extend the literal policy.\n- **Verify:** Inspect the changed policy.\n');
json(project, '.planning/config.json', { review: frozenConfig.review });

const inputs = live('planning-inputs', '_archive-v3.7.3', 1);
inputs.text('.planning/phases/2/CONTEXT.md', '# Phase 2\n\n## Acceptance criteria\n\n- AC1: A result is recorded.\n');
inputs.text('src/auth.mjs', sourceText);
json(inputs, 'invalid.json', {});
json(inputs, 'uat-merge.json', { human_checks: [{ name: 'Golden merge item', expected: 'A result is recorded.' }] });
json(inputs, 'recall.json', { ok: true, results: [{ source: 'phases/1/CONTEXT.md', score: 1, snippet: 'Trace coverage' }] });
json(inputs, 'findings.json', { findings: [finding] });
json(inputs, 'adjudication.json', { voices: [{ voice: 'reviewer', model: 'fixture-model',
  returned: { findings: [finding] }, rulings: [{ finding: 0, ruling: 'survived',
    claim: finding.claim, failure_scenario: finding.failure_scenario }] }] });

const deferred = live('deferred', '_archive-v3.7.3', 1);
json(deferred, '.planning/phases/1/DEFERRED-diff-golden.json', { phase: '1', trigger: 'diff',
  discriminator: 'golden', round: 1, base: tag, head: tag, base_id: frozenId, head_id: frozenId,
  findings: [finding] }, true);
deferred.text('.planning/phases/1/REVIEW-diff-golden.md', '# Deferred review\n\nThe literal policy needs a later decision.\n', true);

const unreadable = bundle('unreadable-reads');
unreadable.text('.planning/reads.jsonl/entry.txt', 'A directory is not a JSONL record.\n');

// Each settings variant states its complete repository layer. No secret,
// ambient authorization or real remote is inherited by these fixtures.
function configBundle(name, extra = {}) {
  const b = bundle(name);
  provenance[name].derived_from = [{ from: '.planning/config.json', to: '.planning/config.json' },
    { from: '.planning/config.json', to: 'global-config.json' }];
  json(b, '.planning/config.json', { memory: { backend: 'builtin' }, review: frozenConfig.review, ...extra });
  json(b, 'global-config.json', { roles: frozenConfig.roles, review: frozenConfig.review });
  json(b, 'invalid.json', {});
  b.text('broken.json', '{\n');
  return b;
}
configBundle('config');
configBundle('config-unknown', { unknown: { golden: true } });
configBundle('forge-configured', { git: { forge_provider: 'github', forge_repo: 'golden/fixture', forge_host: null } });
configBundle('protected', { git: { on_protected: 'refuse', protected_branches: ['main'] } });
configBundle('publish-authorized', { git: { auto_close: true, protected_branches: [], base_branch: 'main' } });

const hookEvents = [
  { corr: '1', phase: 1, ts: '2026-09-05T12:00:00.000Z', family: 'lifecycle', event: 'phase_start' },
  { corr: '1', phase: 1, ts: '2026-09-05T12:00:01.000Z', family: 'lifecycle', event: 'dispatch', role: 'cad-executor', plan: '1' },
];
const hooks = bundle('hooks');
json(hooks, '.planning/config.json', {});
hooks.text('src/auth.mjs', sourceText);
hooks.text('.planning/trace.jsonl', hookEvents.map(r => JSON.stringify(r)).join('\n') + '\n', true);
hooks.text('.planning/reads.jsonl', readsSeed.map(r => JSON.stringify(r)).join('\n') + '\n', true);

const recorded = bundle('risk-recorded');
json(recorded, '.planning/config.json', { review: frozenConfig.review });
recorded.text('.planning/trace.jsonl', [...hookEvents,
  { corr: '1', phase: 1, ts: '2026-09-05T12:00:02.000Z', family: 'lifecycle', event: 'return', role: 'cad-executor', plan: '1' },
  { corr: '1', phase: 1, ts: '2026-09-05T12:00:03.000Z', family: 'outcome', event: 'risk_check', plan: '1',
    base: tag, head: tag, base_id: frozenId, head_id: frozenId, checked: true, inconclusive: false, empty: false, matches: [] },
].map(r => JSON.stringify(r)).join('\n') + '\n', true);

const plugin = bundle('plugin');
for (const path of ['.claude-plugin/plugin.json', 'agents/cad-executor.md', 'skills/cad-progress/SKILL.md',
  'cadence-core/workflows/progress.md', 'cadence-core/references/conventions.md', 'cadence-core/templates/STATE.md']) {
  plugin.copy(path);
}
write(join(here, 'fixtures.json'), JSON.stringify(provenance, null, 2) + '\n');
