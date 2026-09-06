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
function tagBytes(path) { return git('show', `${tag}:${path}`); }
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
      write(join(here, 'fixtures', name, path), text);
      provenance[name][seeded ? 'seeded' : 'synthesized'].push(path);
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
}

live('slice', '_archive-v3.7.3', 1);
live('multi', '_archive-v3.3.0', 5);
live('incomplete', '_archive-v3.7.3', 1, true);
const closed = bundle('closed');
for (const path of tagPaths('.planning').filter(p => p.split('/').length === 2)) closed.copy(path);
write(join(here, 'fixtures.json'), JSON.stringify(provenance, null, 2) + '\n');
