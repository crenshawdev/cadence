// @ts-check
// model-id.mjs - the one answer to "is this string a model id". Pure and total: no imports, no I/O, never
// throws, and a non-string just isn't an id.
//
// One predicate because an id is typed by a user, cloned from a config or read off a provider's listing, then
// interpolated into a `config.mjs set 'key=<id>'` line, a request path and a command line. Four sites enforce it
// (`config.mjs set`, route.mjs's `providerModel`, review-provider's `--model` and its detect-models listing), and
// a second spelling at any of them is how one rule ends up enforced at two strengths.
//
// Shape: alphanumeric first, then letters, digits and `.` `_` `:` `-`, 128 at most. The `:` is for OpenAI
// fine-tune ids (`ft:gpt-4o:org:name:id`). Quotes, whitespace, `/`, `?`, `#`, `$` and the backtick are out because
// they break out of a single-quoted shell word or a URL path segment, and a leading `-` would read as a flag.
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** @param {unknown} v @returns {boolean} */
export function isModelId(v) {
  return typeof v === 'string' && MODEL_ID.test(v);
}
