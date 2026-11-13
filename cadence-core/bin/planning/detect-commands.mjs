// @ts-check
// planning/detect-commands.mjs - `detect-commands`: the lint and typecheck commands to run when nothing is configured
// ESLINT_CONFIGS is the flat-config probe order; a blank --root is refused at planning.mjs's dispatch, not here
'use strict';

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { executableIn, onPath } from '../lib/on-path.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

// a seam, not executor judgment: CI can prove a seam on fixture trees, not a judgment
// --root is the project root, not --dir (the planning directory)
// a manifest shows intent, not an installed binary, so an arm is offered only when its tool resolves
// eslint and tsc from <root>/node_modules/.bin, everything else off PATH as a bare name
// an unreachable arm nulls its slot, never falls through: `[tool.ruff]` plus a go.mod would run `go vet ./...`
// no arm delegates to npx: with no local install it downloads and runs a package, and this runs before every commit

// the flat-config spellings in probe order; a legacy `.eslintrc*` of any extension is matched after them, by prefix
const ESLINT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs',
  'eslint.config.cjs', 'eslint.config.ts'];

// the tools a project installs itself, so the only ones looked for in node_modules/.bin
// every other driver (npm, cargo, ruff, go, mypy) resolves off PATH, or a cloned node_modules/.bin/cargo stands in
const PROJECT_TOOLS = new Set(['eslint', 'tsc']);

/** A regular file at `p`; anything unstattable is no. @param {string} p */
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

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

  // package.json is parsed once for both slots: two parses could disagree about one file and warn twice for one fault
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
  /** A script name when the manifest carries a usable one, else null. */
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

  // first match wins per slot, in declared order; a project's own script beats a tool config
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
  // two exact names, never a glob: `tsc --noEmit` ignores a tsconfig*.json it is not pointed at, so a match needs -p
  // every literal is a fixed string, so no repo content is ever interpolated into a command
  // tsconfig.json goes first as the project's own typecheck; the CI file is for a tree with only that, like this repo
  else if (has('tsconfig.json')) { typecheck = 'tsc --noEmit'; typecheckSource = 'tsconfig.json'; }
  else if (has('tsconfig.ci.json')) {
    // typescript installed with no .bin link would otherwise fall to whatever tsc is on PATH, not the pinned one
    const pinned = !executableIn(join(root, 'node_modules', '.bin'), 'tsc')
      && isFile(join(root, 'node_modules', 'typescript', 'bin', 'tsc'));
    typecheck = pinned ? 'node node_modules/typescript/bin/tsc -p tsconfig.ci.json' : 'tsc -p tsconfig.ci.json';
    typecheckSource = 'tsconfig.ci.json';
  }
  else if (has('Cargo.toml')) { typecheck = 'cargo check --all-targets'; typecheckSource = 'Cargo.toml'; }
  else if (pyTable('[tool.mypy')) { typecheck = 'mypy .'; typecheckSource = 'pyproject.toml'; }
  else if (has('go.mod')) { typecheck = 'go build ./...'; typecheckSource = 'go.mod'; }

  // the override is gated because an ungated test hook that changes an enforcement answer is what this project refused
  // read only when CADENCE_TEST_SEAM holds, by presence and not `||`: an empty value means "nothing on PATH"
  // present, it stands in for the whole answer; the node_modules/.bin arm is proven by the live probe with stubs
  // lib/on-path.mjs reads no Cadence variable of its own, so the hook lives here at the one call site that needs it
  const reachOverride = testSeamOpen() && 'CADENCE_DETECT_REACHABLE' in process.env
    ? new Set(String(process.env.CADENCE_DETECT_REACHABLE).split(',').map((t) => t.trim()).filter(Boolean))
    : null;
  const nodeBin = join(root, 'node_modules', '.bin');

  /**
   * The command to run for `cmd`, or null when its tool resolves nowhere. The tool is the first word.
   * For a PROJECT_TOOLS tool the project's own install wins over PATH: `tsc` is often absent from PATH but present in
   * `node_modules/.bin/tsc`, and that pinned copy is the one CI runs.
   * Every command in the ladder is a fixed literal, so the split is over text this file wrote.
   * @param {string} cmd @returns {string|null}
   */
  const resolve = (cmd) => {
    const tool = cmd.split(' ', 1)[0];
    if (reachOverride) return reachOverride.has(tool) ? cmd : null;
    if (PROJECT_TOOLS.has(tool) && executableIn(nodeBin, tool)) return `node_modules/.bin/${cmd}`;
    return onPath(tool) ? cmd : null;
  };

  /**
   * A slot's answer once reachability has been asked.
   * `source` follows the command: a manifest that named a command nobody can run didn't supply this run's command.
   * The warning names the tool and the manifest, so "found nothing" differs from "found something unreachable".
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
    // always present, both slots, even when both are null, so a caller can tell "found nothing" from "did not look"
    source: { lint: lintSource, typecheck: typecheckSource },
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdDetectCommands };
