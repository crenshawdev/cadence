// @ts-check
// model-id.mjs - the one answer to "is this string a model id". Pure and total: no imports, no I/O, never throws.
// One predicate on purpose: four sites enforce it (`config.mjs set`, route.mjs's `providerModel`, review-provider's
// `--model` and its detect-models listing), and a second spelling is how a rule ends up enforced at two strengths.
// Shape: alphanumeric first, then letters, digits and `.` `_` `:` `-`, 128 at most; `:` is for OpenAI fine-tune ids.
// Quotes, whitespace, `/`, `?`, `#`, `$` and the backtick break a single-quoted shell word or a URL path, and a
// leading `-` would read as a flag.
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** @param {unknown} v @returns {boolean} */
export function isModelId(v) {
  return typeof v === 'string' && MODEL_ID.test(v);
}
