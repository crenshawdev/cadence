// @ts-check
// model-id.mjs - the one answer to "is this string a model id".
//
// Pure and TOTAL on the forge-decision.mjs / redact-url.mjs pattern: no
// imports, no I/O, never throws, and a non-string is simply not an id.
//
// WHY ONE PREDICATE. A tier id is typed by a user, cloned in from a config,
// or read off a provider's /models listing, and from there it is interpolated
// into a `config.mjs set 'key=<id>'` line, a request path and a command line.
// Four sites enforce it - `config.mjs set`, route.mjs's `providerModel`,
// review-provider's `--model` and its detect-models listing - and a second
// spelling at any of them is how a rule comes to be enforced in two strengths.
//
// THE SHAPE: a letter or digit first, then letters, digits and `.` `_` `:` `-`,
// 128 characters at most. `:` admits OpenAI fine-tune ids
// (`ft:gpt-4o:org:name:id`); the set excludes quotes, whitespace, `/`, `?`,
// `#`, `$` and the backtick, the characters that break out of a single-quoted
// shell word or a URL path segment, and a leading `-` that reads as a flag.
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** @param {unknown} v @returns {boolean} */
export function isModelId(v) {
  return typeof v === 'string' && MODEL_ID.test(v);
}
