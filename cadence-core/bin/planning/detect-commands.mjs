// @ts-check
// planning/detect-commands.mjs - `detect-commands`: the lint and typecheck
// commands a repo that configured NOTHING can still be told to run.
//
// `ESLINT_CONFIGS` is the flat-config probe order and nothing else reads it, so
// it travels with the handler (D-05). The `--root` default stays where it was -
// the declared argument row applies it at the dispatch door in planning.mjs, so
// a blank `--root` is refused there and not here.
'use strict';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { executableIn, onPath } from '../lib/on-path.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

// ---------------------------------------------------------------------------
// detect-commands - the static-analysis path for a repo that configured
// NOTHING. A seam and not executor judgment (D-04): the criterion asserts
// behaviour "in a repo that configured nothing", and nothing in CI can prove a
// judgment fired, where a seam is testable on fixture trees and carries a
// CONTRACTS row.
//
// `--root` is the PROJECT root, deliberately NOT `--dir`, which this script
// defines as the planning directory. The root is read ONE DIRECTORY DEEP: no
// recursive walk, no monorepo inference - a command guessed from a nested
// package is a command run in the wrong tree.
//
// Detecting nothing is ok:true with both null - a successful check with a
// negative answer, like plan-overlap. An unreadable or malformed manifest
// contributes nothing and is NAMED in warnings[] rather than throwing.
//
// A MANIFEST IS EVIDENCE OF INTENT, NOT OF A BINARY (RCH-01). A tree carrying
// `[tool.ruff]` says its maintainers chose ruff; it does not say ruff is
// installed on the machine reading it, and this seam's answer is handed to an
// executor that runs it before every commit. So a winning arm is offered only
// when its tool RESOLVES, and it is named by where it resolved: eslint and tsc
// out of `<root>/node_modules/.bin` as that relative path, otherwise off PATH
// as a bare name. An unreachable arm NULLS its slot and names the tool in
// warnings[]; it never falls through to a lower arm (D-05), because falling through tells a tree holding `[tool.ruff]`
// and a `go.mod` to run `go vet ./...` - a linter its maintainers did not
// choose, over a language the change may not touch, which is the exact ordering
// rule the ladder below states.
//
// NO ARM DELEGATES TO `npx` (audit W12). An `npx <tool>` that finds no local
// install fetches the package from the registry and runs it, and a command an
// executor runs before every commit must never download code to do it. Naming
// the tool's own path asks for exactly the binary the project installed, and
// nothing else.
// ---------------------------------------------------------------------------

// The flat-config spellings, in the order they are probed. A legacy `.eslintrc*`
// of any extension is matched after them, by prefix.
const ESLINT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs',
  'eslint.config.cjs', 'eslint.config.ts'];

// The tools a project installs as its own dependency, and so the only ones
// looked for in `<root>/node_modules/.bin`. Every other driver - npm, cargo,
// ruff, go, mypy - is the user's own install and resolves off PATH alone, so a
// cloned repo carrying a `node_modules/.bin/cargo` cannot stand in for it.
const PROJECT_TOOLS = new Set(['eslint', 'tsc']);

function cmdDetectCommands(root) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  let entries;
  try {
    entries = readdirSync(root, { encoding: 'utf8' });
  } catch (e) {
    return fail('no-root', `${root} cannot be listed (${e.code || e.message})`,
      'point --root at a directory this process can list - the lint and typecheck commands are read'
      + ' from the project manifests sitting at its top level');
  }
  const has = (/** @type {string} */ name) => entries.includes(name);

  // package.json, parsed ONCE for both slots: two parses could disagree about
  // one file, and the warning would then be filed twice for one fault.
  let scripts = {};
  if (has('package.json')) {
    const text = read(join(root, 'package.json'));
    if (text === null) {
      warnings.push('package.json could not be read; no command was taken from it');
    } else {
      try {
        const pkg = JSON.parse(text);
        const s = pkg && typeof pkg === 'object' && !Array.isArray(pkg) ? pkg.scripts : null;
        if (s && typeof s === 'object' && !Array.isArray(s)) scripts = s;
      } catch (e) {
        warnings.push(`package.json failed to parse and was skipped: ${e.message}`);
      }
    }
  }
  /** A script NAME when the manifest carries a usable one, else null. */
  const script = (/** @type {string} */ name) =>
    (typeof scripts[name] === 'string' && scripts[name].trim() ? name : null);

  let pyproject = null;
  if (has('pyproject.toml')) {
    pyproject = read(join(root, 'pyproject.toml'));
    if (pyproject === null) {
      warnings.push('pyproject.toml could not be read; no command was taken from it');
    }
  }
  const pyTable = (/** @type {string} */ t) => pyproject !== null && pyproject.includes(t);

  // First match wins per slot, in the declared order. A project's OWN script
  // beats a tool config in the same tree: the script is what its maintainers
  // run, and the tool config is only what a default would run.
  let lint = null;
  let lintSource = null;
  if (script('lint')) { lint = 'npm run lint'; lintSource = 'package.json'; }
  else if (has('Cargo.toml')) { lint = 'cargo clippy --all-targets -- -D warnings'; lintSource = 'Cargo.toml'; }
  else if (pyTable('[tool.ruff')) { lint = 'ruff check .'; lintSource = 'pyproject.toml'; }
  else if (has('go.mod')) { lint = 'go vet ./...'; lintSource = 'go.mod'; }
  else {
    const cfg = ESLINT_CONFIGS.find((f) => has(f))
      || entries.find((e) => e.startsWith('.eslintrc'));
    if (cfg) { lint = 'eslint .'; lintSource = cfg; }
  }

  let typecheck = null;
  let typecheckSource = null;
  const tsScript = script('typecheck') || script('type-check');
  if (tsScript) { typecheck = `npm run ${tsScript}`; typecheckSource = 'package.json'; }
  // TWO exact names, never a `tsconfig*.json` glob. `tsc --noEmit` ignores
  // a config it is not pointed at, so a matched name has to bring the `-p` form
  // that points at it - and guessing which of several candidates is THE
  // typecheck would name an editor-only or per-package project file as the
  // project's own. Both literals are fixed strings; no repo content is ever
  // interpolated into a command.
  //
  // Order is the whole reason there are two arms rather than one: a tree
  // carrying both keeps `tsc --noEmit` off `tsconfig.json`, because that is
  // the project's own typecheck and the CI file is the narrower one. The second
  // arm exists for the tree that has ONLY the CI file - this repository, which
  // the comment here used to name as the case it declined, and which is exactly
  // the repository whose `.planning/config.json` can no longer supply a lint
  // command from a repo layer (CFG-02).
  else if (has('tsconfig.json')) { typecheck = 'tsc --noEmit'; typecheckSource = 'tsconfig.json'; }
  else if (has('tsconfig.ci.json')) { typecheck = 'tsc -p tsconfig.ci.json'; typecheckSource = 'tsconfig.ci.json'; }
  else if (has('Cargo.toml')) { typecheck = 'cargo check --all-targets'; typecheckSource = 'Cargo.toml'; }
  else if (pyTable('[tool.mypy')) { typecheck = 'mypy .'; typecheckSource = 'pyproject.toml'; }
  else if (has('go.mod')) { typecheck = 'go build ./...'; typecheckSource = 'go.mod'; }

  // --- reachability (RCH-01) -------------------------------------------------
  //
  // THE OVERRIDE IS GATED, and gated for the reason EXP-01 states: this
  // variable decides which static-analysis command an executor is told to run,
  // and an ungated test hook that changes an enforcement answer is the shape
  // that milestone refused. It is read only when `CADENCE_TEST_SEAM` holds, and
  // read by PRESENCE rather than through `||`: an empty value means "nothing on
  // PATH", which is a set a `||` chain cannot express because it is falsy.
  //
  // Present, it stands in for the WHOLE answer - no filesystem is consulted at
  // all - and a name in it reads as ON PATH, so under the override every arm
  // comes back as its bare name. The `node_modules/.bin` arm is proven by the
  // live probe instead, out of stubs in the fixture's own tree, and an empty
  // override over that same fixture proves the variable had force, which a
  // half-replacement could never show. lib/on-path.mjs reads no Cadence
  // variable of its own (see its header); the hook lives here, at the one call
  // site that needs it.
  const reachOverride = testSeamOpen() && 'CADENCE_DETECT_REACHABLE' in process.env
    ? new Set(String(process.env.CADENCE_DETECT_REACHABLE).split(',').map((t) => t.trim()).filter(Boolean))
    : null;
  const nodeBin = join(root, 'node_modules', '.bin');

  /**
   * The command to run for `cmd`, or null when its tool resolves nowhere. The
   * tool is the first word. For a PROJECT_TOOLS tool the project's own install
   * wins over PATH: `tsc` is routinely absent from PATH while present at
   * `node_modules/.bin/tsc`, and the copy the project pinned is the one its CI
   * runs. Every command in the
   * ladder is a fixed literal, so the split is over text this file wrote - no
   * repo content is ever parsed into a binary name.
   * @param {string} cmd @returns {string|null}
   */
  const resolve = (cmd) => {
    const tool = cmd.split(' ', 1)[0];
    if (reachOverride) return reachOverride.has(tool) ? cmd : null;
    if (PROJECT_TOOLS.has(tool) && executableIn(nodeBin, tool)) return `node_modules/.bin/${cmd}`;
    return onPath(tool) ? cmd : null;
  };

  /**
   * A slot's answer once reachability has been asked. `source` follows the
   * command: a nulled slot claims no provenance, because a manifest that named
   * a command nobody can run did not supply this run's command. The WARNING
   * carries both the tool and the manifest, so the caller can still tell "found
   * nothing" from "found something unreachable" - which is the same distinction
   * the always-both-keys `source` block exists for.
   * @param {string} slot @param {string|null} cmd @param {string|null} src
   */
  const offer = (slot, cmd, src) => {
    if (cmd === null) return { command: null, source: null };
    const resolved = resolve(cmd);
    if (resolved !== null) return { command: resolved, source: src };
    const tool = cmd.split(' ', 1)[0];
    const looked = PROJECT_TOOLS.has(tool) ? 'in node_modules/.bin or on PATH' : 'on PATH';
    warnings.push(`${slot}: ${tool} is not ${looked}, so \`${cmd}\` `
      + `(from ${src}) was not offered; no lower arm was taken in its place`);
    return { command: null, source: null };
  };

  const lintOffer = offer('lint', lint, lintSource);
  lint = lintOffer.command;
  lintSource = lintOffer.source;
  const typecheckOffer = offer('typecheck', typecheck, typecheckSource);
  typecheck = typecheckOffer.command;
  typecheckSource = typecheckOffer.source;

  ok({
    root,
    lint,
    typecheck,
    // ALWAYS present, both slots, even when both are null - the same
    // always-report convention seed-reqs's counts follow. A caller has to be
    // able to tell "found nothing" from "did not look".
    source: { lint: lintSource, typecheck: typecheckSource },
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdDetectCommands };
