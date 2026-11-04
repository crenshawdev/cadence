// @ts-check
// planning/detect-commands.mjs - `detect-commands`: the lint and typecheck commands a repo that configured nothing can still be told to run
// ESLINT_CONFIGS is the flat-config probe order and nothing else reads it. The --root default is applied at the dispatch door in planning.mjs, so a blank --root is refused there and not here
'use strict';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { executableIn, onPath } from '../lib/on-path.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

// this is a seam and not executor judgment: the criterion is about "a repo that configured nothing", and CI can't prove a judgment fired where a seam is testable on fixture trees
// --root is the project root and not --dir, which this script defines as the planning directory. It's read one directory deep with no recursive walk and no monorepo inference, since a command guessed from a nested package is run in the wrong tree
// detecting nothing is ok:true with both null, a successful check with a negative answer. An unreadable or malformed manifest contributes nothing and is named in warnings[] and never thrown
// a manifest is evidence of intent and not of a binary: `[tool.ruff]` says the maintainers chose ruff and not that it's installed here, and an executor runs this answer before every commit
// so a winning arm is offered only when its tool resolves, named by where it resolved: eslint and tsc out of <root>/node_modules/.bin as that relative path, everything else off PATH as a bare name
// an unreachable arm nulls its slot and names the tool in warnings[], and never falls through to a lower arm, because that would tell a tree with `[tool.ruff]` and a go.mod to run `go vet ./...`: a linter its maintainers didn't choose, over a language the change may not touch
// no arm delegates to npx: with no local install it fetches the package from the registry and runs it, and a command run before every commit must never download code to do it

// the flat-config spellings in probe order; a legacy `.eslintrc*` of any extension is matched after them, by prefix
const ESLINT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs',
  'eslint.config.cjs', 'eslint.config.ts'];

// the tools a project installs itself, so the only ones looked for in node_modules/.bin
// every other driver (npm, cargo, ruff, go, mypy) is the user's own install and resolves off PATH alone, so a cloned repo carrying a node_modules/.bin/cargo can't stand in for it
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

  // package.json is parsed once for both slots: two parses could disagree about one file and file the warning twice for one fault
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

  // first match wins per slot, in declared order; a project's own script beats a tool config in the same tree, since the script is what its maintainers run
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
  // two exact names and never a tsconfig*.json glob: `tsc --noEmit` ignores a config it isn't pointed at, so a match has to bring the -p form, and guessing which of several candidates is the typecheck would name an editor-only or per-package file
  // both literals are fixed strings, so no repo content is ever interpolated into a command
  // the order is why there are two arms: a tree with both keeps `tsc --noEmit` off tsconfig.json, the project's own typecheck, and the second arm is for a tree with only the CI file, like this repo
  else if (has('tsconfig.json')) { typecheck = 'tsc --noEmit'; typecheckSource = 'tsconfig.json'; }
  else if (has('tsconfig.ci.json')) { typecheck = 'tsc -p tsconfig.ci.json'; typecheckSource = 'tsconfig.ci.json'; }
  else if (has('Cargo.toml')) { typecheck = 'cargo check --all-targets'; typecheckSource = 'Cargo.toml'; }
  else if (pyTable('[tool.mypy')) { typecheck = 'mypy .'; typecheckSource = 'pyproject.toml'; }
  else if (has('go.mod')) { typecheck = 'go build ./...'; typecheckSource = 'go.mod'; }

  // the override is gated because an ungated test hook that changes an enforcement answer is the shape this project refused: this variable decides which static-analysis command an executor runs
  // it's read only when CADENCE_TEST_SEAM holds, and by presence and not through `||`, because an empty value means "nothing on PATH" and a `||` chain can't express a falsy set
  // present, it stands in for the whole answer and a name in it reads as on PATH, so every arm comes back as its bare name; the node_modules/.bin arm is proven by the live probe instead, with stubs in the fixture's own tree
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
   * The warning carries both the tool and the manifest, so a caller can still tell "found nothing" from "found something unreachable".
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
