// @ts-check
// resident-weight.mjs - what one COMMAND and one DISPATCH actually carry,
// composed from the tree. lib/surface-weight.mjs weighs each prose file on its
// own; this module answers the question a budget cannot: which of those files
// ride together into one context, and whose.
//
// Three quantities, and the definitions are the whole contract:
//
//   EAGER (per command)     `skills/<name>/SKILL.md` plus every path on an
//                           `@${CLAUDE_PLUGIN_ROOT}/<relpath>` line at the
//                           START of a line in that SKILL.md. These are the
//                           bytes the host injects before the command's first
//                           turn, so they ride every remaining turn of the run.
//                           Includes resolve ONE LEVEL ONLY, deliberately: a
//                           grep of cadence-core/workflows/*.md,
//                           cadence-core/references/*.md, cadence-core/templates/**
//                           and agents/*.md returns zero `@`-include lines, so
//                           an include cannot itself include (D-04). A recursive
//                           resolver would be machinery for a graph that does
//                           not exist.
//   REACHABLE (per command) the eager set plus every
//                           `cadence-core/{references,templates,workflows}/<file>`
//                           that the TEXT OF THE EAGER FILES names and that
//                           exists on disk - matched both in the
//                           `${CLAUDE_PLUGIN_ROOT}/cadence-core/<branch>/<file>`
//                           form and in the bare `<branch>/<file>` citation form.
//                           ONE HOP FROM THE EAGER SET, never a transitive
//                           closure: a closure over named surfaces collapses to
//                           ~231 KB for every command and destroys the ranking
//                           this measurement exists to show.
//   DISPATCH (per role)     one `agents/<file>.md` plus the SKILL.md of every
//                           contract it preloads via `skills:` frontmatter -
//                           the bytes that land in a FRESH subagent context.
//
// One hop cuts BOTH ways, and a reader of the numbers has to know it:
// de-preloading a file moves that file's OWN citations out of the reachable set
// even though the model still Reads it at the step and can still follow them
// from there. A reachable DROP under this definition is therefore not by itself
// a saving anyone stopped paying - whoever reports a delta must say which part
// of it is this artifact.
//
// Command and dispatch numbers are reported SIDE BY SIDE and never summed
// (D-05): a dispatch's bytes land in a fresh subagent context, not in the
// orchestrator's, so a total would grow with plan count and stop being
// reproducible from the tree.
//
// A COMMAND is a `skills/` directory whose SKILL.md frontmatter does NOT carry
// `user-invocable: false`. That excludes exactly the `*-contract` skills, which
// are dispatch prose and are accounted on the roles side instead.
//
// `commandEagerSets` is that EAGER definition as a shared builder, exported so
// lib/include-consumers.mjs can ask whether a command's own eager prose ever
// NAMES the surface it `@`-includes without re-walking the tree. It hands back
// the raw include PATHS as well as the resolved surfaces, because that rule has
// to judge an include line whose target is absent from the root it was given -
// a fixture holding only a SKILL.md and its workflow - where the weighing side
// here correctly drops it as zero bytes and it appears in no surface at all.
//
// Pure lib: no emit, no process.exit, no Date, no randomness, node builtins
// only, reading nothing but the surface files it measures. Every read and stat
// is guarded per ENTRY rather than per branch, so one unreadable or dangling
// descendant hides only itself and can never empty a whole subtree (BUD-02,
// the shape lib/surface-weight.mjs already carries). Every accumulated set is
// deduped by `realpathSync` where it resolves, falling back to the joined path
// when it throws: a symlinked directory otherwise lets one physical file be
// summed twice under two logical paths. Every array is sorted, so two runs on
// one tree are byte-identical.
'use strict';

import { readFileSync, readdirSync, existsSync, realpathSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { parseSkillsField } from './frontmatter.mjs';

/** The three branches a reachable citation may name. */
const BRANCHES = ['references', 'templates', 'workflows'];

/** An `@`-include: the form the host expands, anchored to the line start. */
const INCLUDE_RE = /^@\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_\-./]+)/gm;

/**
 * A named core surface, in either the full `${CLAUDE_PLUGIN_ROOT}/cadence-core/`
 * form or the bare `<branch>/<file>` citation form the prose also uses. The
 * bare arm is what makes `(references/git-guard.md)` count as a reach.
 */
const CITE_RE = /(?:\$\{CLAUDE_PLUGIN_ROOT\}\/)?(?:cadence-core\/)?\b(references|templates|workflows)\/([A-Za-z0-9_\-.]+)/g;

/** `user-invocable: false` in a leading frontmatter block. */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
const NOT_INVOCABLE_RE = /^user-invocable:[ \t]*false[ \t]*$/m;

/**
 * One directory's own children as dirents. A directory this process cannot
 * read is empty data, never a throw - and hides only its OWN children.
 * @param {string} dir
 * @returns {import('node:fs').Dirent[]}
 */
function dirents(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Yield every descendant file path under `dir`, one directory at a time.
 * Descent is decided on the DIRENT, so a symlinked directory met during the
 * walk is yielded as a path rather than descended.
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
  for (const d of dirents(dir)) {
    const f = join(dir, d.name);
    if (d.isDirectory()) yield* walk(f);
    else yield f;
  }
}

/**
 * The dedupe key for one path: its real path when that resolves, the joined
 * path itself when it does not (a dangling link is still distinct from every
 * other dangling link).
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
 * Read one measured file. Returns null when the path is absent, is not a file,
 * or cannot be read - a missing `@`-include contributes 0 rather than throwing.
 * `bytes` is the raw whole-file length, frontmatter included, because that is
 * what the host injects.
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
 * Every core surface named by `text`, as root-relative paths that exist on
 * disk. Trailing sentence punctuation is stripped the way self-verify's
 * plugin-root path check strips it, so `references/seams.md.` still resolves.
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
 * Every user-invocable command's EAGER set, assembled once and shared.
 *
 * `residentWeight` consumes this, and so does lib/include-consumers.mjs - the
 * rule that asks whether a command's own eager prose ever NAMES the surface it
 * `@`-includes. That rule reuses the split rather than re-walking the tree, so
 * the two can never disagree about what "eager" means.
 *
 * Which field is the ROOT-RELATIVE POSIX path matters at the callsite and is
 * stated here rather than inferred: it is `surface`. `key` is a realpath dedupe
 * key and is NOT root-relative - comparing against it would silently never
 * match, and a self-citation exclusion that never matches is an
 * include-consumer check that passes forever (D-10).
 *
 * `includes` carries the RAW relative paths off the `@${CLAUDE_PLUGIN_ROOT}/...`
 * lines, in line order with duplicates preserved, alongside the resolved
 * `surfaces`. The consumer rule must be able to judge an include line whose
 * target is ABSENT from the root it is handed - a fixture copying only a
 * SKILL.md and its workflow - where the weighing side correctly drops it as
 * zero bytes and `surfaces` therefore never mentions it.
 *
 * The `user-invocable: false` filter is the same one `residentWeight` applies,
 * which is what keeps contract skills accounted under `roles` (D-12).
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
    // A dispatch contract is not a command: its bytes are accounted under
    // `roles`, and the two are never summed (D-05).
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
 * Weigh every command and every dispatch role under `root`.
 *
 * `zeroResident` is derived, never hardcoded (D-09): every file under
 * `cadence-core/references/` that appears in NO command's reachable set. Those
 * bytes are budgeted but enter no model context, so a cut there would move the
 * main thread by zero and no delta may claim them.
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

  // The eager assembly itself lives in `commandEagerSets`, shared with
  // lib/include-consumers.mjs. Surfaces arrive in the same order they were
  // added here before (SKILL.md first, then each include that resolved), so the
  // realpath dedupe, the byte totals and the ordering are unchanged.
  for (const entry of commandEagerSets(root)) {
    const eager = surfaceSet();
    for (const s of entry.surfaces) eager.add(s);

    const reachable = surfaceSet();
    for (const s of eager.files()) {
      reachable.add(readSurface(root, join(root, s.surface)));
    }
    // ONE hop: citations are read out of the EAGER texts only, never out of
    // what those citations themselves name.
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
      // The role is the first preloaded contract's name with `-contract`
      // stripped, so every rung file groups under the role it serves without
      // string surgery on filename suffixes. An agent that preloads no
      // contract is its own role.
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
