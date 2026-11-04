// @ts-check
// config-value.mjs - the one answer to "does this key accept this value".
//
// `config.mjs` runs its dispatch on import, so nothing else can import it, and
// self-verify's explanation check has to answer exactly as `validate` and `set`
// do. These rules live here so both read one copy; a second one would be a
// second opinion about what a key accepts. Moved from config.mjs unchanged.
//
// Pure: no fs, no emit, no process.
import { isForgeSlug, splitForgeHost } from './forge-decision.mjs';
import { isModelId } from './model-id.mjs';

// Validate a single already-parsed value's TYPE against a schema spec.
// Returns null if ok, else an error string. checkValue below is what callers
// reach: it runs this first and only then the optional per-key grammar, so a
// value of the wrong type reports the type rather than a grammar it could never
// have satisfied.
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
      // `null` is rendered as the literal, not left to Array#join's empty
      // string: every `default: null` enum ends its accepted set with null, and
      // joining it produced a dangling `", "` that reads as a truncated message
      // rather than as the settable value it is ("must be one of: high, xhigh, ").
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

// The named grammars a schema key may claim, as a FROZEN registry of one
// predicate each rather than a branch per key inside checkValue.
//
// WHY A NARROWING AT ALL, and why here. `git.forge_repo` and `git.forge_host`
// are typed `string_or_null`, which admitted `forge example.com/../x` and every
// other shape no forge serves - and both values are TYPED BY A USER at setup
// and then interpolated onto a command line, first into the `config.mjs set`
// line the workflow prints and then into a `tea`/`gh`/`glab` argument vector.
// The write face is where a typed answer can still be refused with the user
// still there to retype it, which is why the check lives at `checkValue` (the
// one point `set`, `check` and `validate` all reach) and not at each reader.
//
// The predicates are IMPORTED, never restated: from lib/forge-decision.mjs,
// `isForgeSlug` is already the one answer to "what may a repository selector
// be" and `splitForgeHost` the one answer for an instance address; from
// lib/model-id.mjs, `isModelId` is the one answer to "what may a provider
// model id be", shared with route.mjs and review-provider.mjs. A second
// spelling here is how a rule comes to be enforced in two strengths.
//
// Each entry carries its own sentence because the two keys refuse for different
// reasons, and what a user reads has to say what is WRONG with the value rather
// than that it failed.
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
  model_id: Object.freeze({
    ok: (v) => isModelId(v),
    error: 'expected a model id - 1 to 128 characters of letters, digits, `.`, `_`, `:` '
      + 'and `-`, starting with a letter or digit; no quotes, spaces, `/`, `?`, `#`, `$` or backticks',
  }),
});

// Evaluate a spec's optional `grammar` marker, AFTER its type has passed.
//
// A `null` value skips the grammar: null is the schema default on every key
// that carries one and means the question was never asked, so failing it would
// refuse the scaffolded templates/config.json.
//
// A marker naming a predicate the registry does not hold is an ERROR, in the
// same shape checkType's `default:` arm answers an unknown `spec.type`, and
// NEVER a no-op. A marker silently treated as satisfied would let a future key
// claim a grammar nothing enforces - the silent pass lib/schema-eval.mjs's
// header refuses at length, for this reason.
/** @param {{grammar?:string}} spec @param {any} v */
export function checkGrammar(spec, v) {
  const name = spec.grammar;
  if (name === undefined) return null;
  if (v === null) return null;
  const grammar = Object.hasOwn(GRAMMARS, name) ? GRAMMARS[name] : undefined;
  if (!grammar) return `unknown schema grammar ${name}`;
  return grammar.ok(v) ? null : grammar.error;
}

// Validate a single already-parsed value against a schema spec: its type, then
// the per-key grammar when the spec claims one. The one point `set`, `check`
// and `validate` all reach.
/** @param {{type:string, min?:number, max?:number, values?:any[], grammar?:string}} spec @param {any} v */
export function checkValue(spec, v) {
  const typeError = checkType(spec, v);
  if (typeError) return typeError;
  return checkGrammar(spec, v);
}
