// @ts-check
// resident-weight.mjs - what one command and one dispatch carry; surface-weight.mjs weighs files alone.
// Eager (per command): its SKILL.md plus every `@${CLAUDE_PLUGIN_ROOT}/<relpath>` include, one level only.
// Reachable: eager plus every references, templates or workflows file its text names, one hop; a closure is ~231 KB.
// Dispatch (per role): one `agents/<file>.md` plus the SKILL.md of each contract it preloads via `skills:`.
// Command and dispatch numbers are never summed: a total would grow with plan count.
// A command is a `skills/` directory without `user-invocable: false`, so contracts are out.
'use strict';

import { readFileSync, readdirSync, existsSync, realpathSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { FRONTMATTER_RE, parseSkillsField } from './frontmatter.mjs';
import { dirents, walk } from './surface-weight.mjs';

/** The three branches a reachable citation may name. */
const BRANCHES = ['references', 'templates', 'workflows'];

/** An `@`-include: the form the host expands, anchored to the line start. */
const INCLUDE_RE = /^@\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_\-./]+)/gm;

/** A named core surface, full or bare `<branch>/<file>`; the bare arm counts `(references/git-guard.md)`. */
const CITE_RE = /(?:\$\{CLAUDE_PLUGIN_ROOT\}\/)?(?:cadence-core\/)?\b(references|templates|workflows)\/([A-Za-z0-9_\-.]+)/g;

/** `user-invocable: false` in a leading frontmatter block. */
const NOT_INVOCABLE_RE = /^user-invocable:[ \t]*false[ \t]*$/m;

/**
 * The dedupe key for one path: its real path, or the joined path when that throws (a dangling link is still distinct
 * from every other).
 * @param {string} f
 * @returns {string}
 */
function identity(f) {
  try {
    return realpathSync(f);
  } catch {
    return f;
  }
}

/**
 * Read one measured file, or null when it's absent, not a file or unreadable, so a missing `@`-include contributes 0
 * and doesn't throw. `bytes` is the raw whole-file length, frontmatter included, because that's what the host injects.
 * @param {string} root
 * @param {string} file
 * @returns {{ key: string, surface: string, bytes: number, text: string } | null}
 */
function readSurface(root, file) {
  try {
    if (!statSync(file).isFile()) return null;
  } catch {
    return null;
  }
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }
  return {
    key: identity(file),
    surface: relative(root, file).split(sep).join('/'),
    bytes: buf.length,
    text: buf.toString('utf8'),
  };
}

/**
 * An accumulating, realpath-deduped set of measured surfaces.
 * @returns {{ add: (s: ReturnType<typeof readSurface>) => void,
 *            has: (k: string) => boolean,
 *            keys: () => IterableIterator<string>,
 *            texts: () => string[],
 *            files: () => Array<{surface: string, bytes: number}>,
 *            total: () => number }}
 */
function surfaceSet() {
  /** @type {Map<string, {surface: string, bytes: number, text: string}>} */
  const map = new Map();
  return {
    add(s) {
      if (!s || map.has(s.key)) return;
      map.set(s.key, { surface: s.surface, bytes: s.bytes, text: s.text });
    },
    has(k) {
      return map.has(k);
    },
    keys() {
      return map.keys();
    },
    texts() {
      return [...map.values()].map((v) => v.text);
    },
    files() {
      return [...map.values()]
        .map(({ surface, bytes }) => ({ surface, bytes }))
        .sort(bySurface);
    },
    total() {
      let n = 0;
      for (const v of map.values()) n += v.bytes;
      return n;
    },
  };
}

/** @param {{surface: string}} a @param {{surface: string}} b @returns {number} */
function bySurface(a, b) {
  return a.surface < b.surface ? -1 : a.surface > b.surface ? 1 : 0;
}

/** @param {string} a @param {string} b @returns {number} */
function byString(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Every core surface named by `text`, as root-relative paths that exist on disk. Trailing sentence punctuation is
 * stripped the way self-verify's plugin-root path check does, so `references/seams.md.` still resolves.
 * @param {string} root
 * @param {string} text
 * @returns {string[]}
 */
function citedSurfaces(root, text) {
  const out = [];
  for (const m of text.matchAll(CITE_RE)) {
    const branch = m[1];
    const name = m[2].replace(/[.,;:]+$/, '');
    if (!name || !BRANCHES.includes(branch)) continue;
    out.push(join(root, 'cadence-core', branch, name));
  }
  return out;
}

/**
 * Every user-invocable command's eager set, shared with lib/include-consumers.mjs so the two agree on "eager".
 * Compare on `surface`, the root-relative POSIX path, not `key`: that is a realpath dedupe key, so a self-citation
 * exclusion keyed on it never matches and the include-consumer check passes forever.
 * `includes` keeps the raw paths off the `@${CLAUDE_PLUGIN_ROOT}/...` lines, in order with duplicates, because that
 * rule must judge an include whose target is absent, which the weighing side drops as zero bytes.
 * @param {string} root
 * @returns {Array<{ command: string, skillFile: string, includes: string[],
 *   surfaces: Array<{ key: string, surface: string, bytes: number, text: string }> }>}
 */
export function commandEagerSets(root) {
  const out = [];
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return out;
  for (const d of dirents(skillsDir)) {
    if (!d.isDirectory()) continue;
    const skillFile = join(skillsDir, d.name, 'SKILL.md');
    const skill = readSurface(root, skillFile);
    if (!skill) continue;
    const fm = FRONTMATTER_RE.exec(skill.text);
    // A dispatch contract isn't a command: its bytes are accounted under `roles`, and the two are never summed.
    if (fm && NOT_INVOCABLE_RE.test(fm[1])) continue;

    const includes = [];
    const surfaces = [skill];
    for (const m of skill.text.matchAll(INCLUDE_RE)) {
      includes.push(m[1]);
      const s = readSurface(root, join(root, m[1]));
      if (s) surfaces.push(s);
    }
    out.push({
      command: d.name,
      skillFile: relative(root, skillFile).split(sep).join('/'),
      includes,
      surfaces,
    });
  }
  return out;
}

/**
 * Weigh every command and every dispatch role under `root`. `zeroResident` is derived, never hardcoded: every file
 * under `cadence-core/references/` in no command's reachable set. Those bytes are budgeted but enter no model context,
 * so a cut there moves the main thread by zero and no delta may claim them.
 * @param {string} root
 * @returns {{
 *   commands: Array<{ command: string, eagerBytes: number,
 *     eagerFiles: Array<{surface: string, bytes: number}>, reachableBytes: number,
 *     reachableFiles: Array<{surface: string, bytes: number}> }>,
 *   roles: Array<{ role: string, agent: string, agentBytes: number,
 *     contracts: Array<{surface: string, bytes: number}>, dispatchBytes: number }>,
 *   zeroResident: Array<{surface: string, bytes: number}>,
 *   zeroResidentBytes: number
 * }}
 */
export function residentWeight(root) {
  const commands = [];
  /** every realpath key any command can reach, for the zero-resident derivation */
  const reached = new Set();

  // Surfaces keep the order they were added in (SKILL.md first, then each include that resolved), so the realpath
  // dedupe, byte totals and ordering hold.
  for (const entry of commandEagerSets(root)) {
    const eager = surfaceSet();
    for (const s of entry.surfaces) eager.add(s);

    const reachable = surfaceSet();
    for (const s of eager.files()) {
      reachable.add(readSurface(root, join(root, s.surface)));
    }
    // One hop: citations are read out of the eager texts only, never out of what those citations name.
    for (const text of eager.texts()) {
      for (const f of citedSurfaces(root, text)) reachable.add(readSurface(root, f));
    }
    for (const k of reachable.keys()) reached.add(k);

    commands.push({
      command: entry.command,
      eagerBytes: eager.total(),
      eagerFiles: eager.files(),
      reachableBytes: reachable.total(),
      reachableFiles: reachable.files(),
    });
  }
  commands.sort((a, b) => byString(a.command, b.command));

  const roles = [];
  const agentsDir = join(root, 'agents');
  if (existsSync(agentsDir)) {
    for (const d of dirents(agentsDir)) {
      if (!d.name.endsWith('.md')) continue;
      const agent = readSurface(root, join(agentsDir, d.name));
      if (!agent) continue;
      const fm = FRONTMATTER_RE.exec(agent.text);
      const names = fm ? parseSkillsField(fm[1]) : [];
      const contracts = surfaceSet();
      for (const name of names) {
        contracts.add(readSurface(root, join(root, 'skills', name, 'SKILL.md')));
      }
      // The role is the first preloaded contract's name minus `-contract`, so every rung file groups under the role it
      // serves without suffix surgery. An agent that preloads none is its own role.
      const first = names.find((n) => n.endsWith('-contract'));
      const role = first ? first.slice(0, -'-contract'.length) : basename(d.name, '.md');
      roles.push({
        role,
        agent: agent.surface,
        agentBytes: agent.bytes,
        contracts: contracts.files(),
        dispatchBytes: agent.bytes + contracts.total(),
      });
    }
  }
  roles.sort((a, b) => byString(a.agent, b.agent));

  const zeroResident = [];
  const refsDir = join(root, 'cadence-core', 'references');
  if (existsSync(refsDir)) {
    for (const f of walk(refsDir)) {
      const s = readSurface(root, f);
      if (!s || reached.has(s.key)) continue;
      zeroResident.push({ surface: s.surface, bytes: s.bytes });
    }
  }
  zeroResident.sort(bySurface);

  return {
    commands,
    roles,
    zeroResident,
    zeroResidentBytes: zeroResident.reduce((n, s) => n + s.bytes, 0),
  };
}
