// @ts-check
// config-value.mjs - the one answer to "does this key accept this value".
// config.mjs runs its dispatch on import, so nothing else can import it, and self-verify's explanation check has
// to answer exactly as validate and set do. The rules live here so both read one copy, moved over unchanged.
// Pure: no fs, no emit, no process.
import { isForgeSlug, splitForgeHost } from './forge-decision.mjs';
import { isModelId } from './model-id.mjs';
import { SAFE_BRANCH } from './publish-decision.mjs';

// Checks one parsed value's type against a schema spec: null if ok, else an error string. Callers reach
// checkValue, which runs this first, so a wrong-typed value reports the type and not a grammar it could never meet.
/** @param {{type:string, min?:number, max?:number, values?:any[]}} spec @param {any} v */
export function checkType(spec, v) {
  switch (spec.type) {
    case 'bool':
      return typeof v === 'boolean' ? null : 'expected true or false';
    case 'int':
      if (!Number.isInteger(v)) return 'expected an integer';
      if (spec.min !== undefined && v < spec.min) return `must be >= ${spec.min}`;
      if (spec.max !== undefined && v > spec.max) return `must be <= ${spec.max}`;
      return null;
    case 'string':
      return typeof v === 'string' ? null : 'expected a string';
    case 'string_or_null':
      return v === null || typeof v === 'string' ? null : 'expected a string or null';
    case 'enum':
      // null prints as the literal: Array#join left a dangling ", " that read as a truncated message
      return spec.values.includes(v) ? null
        : `must be one of: ${spec.values.map((x) => (x === null ? 'null' : x)).join(', ')}`;
    case 'array_string':
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) return 'expected a list of strings';
      return null;
    case 'array_enum':
      if (!Array.isArray(v)) return 'expected a list';
      { const bad = v.filter((x) => !spec.values.includes(x));
        return bad.length ? `invalid entries [${bad.join(', ')}]; allowed: ${spec.values.join(', ')}` : null; }
    default:
      return `unknown schema type ${spec.type}`;
  }
}

// A whole branch name a shell can't act on. SAFE_BRANCH is the rule `git-publish.mjs reap` enforces, so an accepted
// name is never one reap then refuses; the extra ones are what `git checkout -b` refuses anyway: `..`, a trailing `/`
// or `.`, a `.lock` ending, and a path component that starts with a dot. Callers on read use this.
/** @param {unknown} v */
export function isBranchName(v) {
  return typeof v === 'string' && SAFE_BRANCH.test(v) && !v.includes('..') && !v.endsWith('/') && !v.endsWith('.')
    && !v.endsWith('.lock') && !v.split('/').some((c) => c.startsWith('.'));
}

// Named grammars a schema key may claim, one predicate each, so checkValue doesn't grow a branch per key.
// forge_repo and forge_host were string_or_null and let `forge example.com/../x` through onto a command line.
// The predicates come from forge-decision and model-id, never restated: a second spelling enforces at two strengths.
// Each entry carries its own sentence, so the user reads what's wrong with the value.
export const GRAMMARS = Object.freeze({
  forge_slug: Object.freeze({
    ok: (v) => isForgeSlug(v),
    error: 'expected an owner/name slug - two or more segments of letters, digits, '
      + '`.`, `_` or `-`, no segment starting with `-`, and no `.` or `..` segment',
  }),
  forge_host: Object.freeze({
    ok: (v) => splitForgeHost(v) !== null,
    error: 'expected a hostname, optionally followed by `:<port>` - dot-separated '
      + 'labels of letters, digits and `-` where no label starts or ends with `-`, '
      + 'and a port of 1-65535 in decimal with no leading zero',
  }),
  branch_name: Object.freeze({
    ok: (v) => isBranchName(v),
    error: 'expected a branch name - letters, digits, `.`, `_`, `-` and `/`, starting with a letter or digit, '
      + 'with no `..`, no trailing `/` or `.`, no `.lock` ending and no `/`-separated part starting with `.`',
  }),
  model_id: Object.freeze({
    ok: (v) => isModelId(v),
    error: 'expected a model id - 1 to 128 characters of letters, digits, `.`, `_`, `:` '
      + 'and `-`, starting with a letter or digit; no quotes, spaces, `/`, `?`, `#`, `$` or backticks',
  }),
});

// Runs a spec's optional `grammar` once its type has passed. A null skips it: null is the default on every key
// with a grammar and means the question was never asked, so failing it would refuse the scaffolded template.
// An unknown grammar name is an error, never a no-op, same as checkType's unknown type. A marker quietly treated
// as satisfied would let a key claim a grammar nothing enforces.
/** @param {{grammar?:string}} spec @param {any} v */
export function checkGrammar(spec, v) {
  const name = spec.grammar;
  if (name === undefined) return null;
  if (v === null) return null;
  const grammar = Object.hasOwn(GRAMMARS, name) ? GRAMMARS[name] : undefined;
  if (!grammar) return `unknown schema grammar ${name}`;
  return grammar.ok(v) ? null : grammar.error;
}

// A value against its spec: type first, then the per-key grammar. The one point set, check and validate all reach.
/** @param {{type:string, min?:number, max?:number, values?:any[], grammar?:string}} spec @param {any} v */
export function checkValue(spec, v) {
  const typeError = checkType(spec, v);
  if (typeError) return typeError;
  return checkGrammar(spec, v);
}
