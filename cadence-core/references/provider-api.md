# Provider API wire reference

The exact request/response shapes `bin/review-provider.mjs` depends on, verified
against the live provider docs (2026-07-10). This is the maintained artifact: if
a provider changes its API, update the adapter in the script AND this file
together. The script isolates every provider-specific byte in its `ADAPTERS`
object so a change touches one place.

Model ID strings are deliberately NOT pinned here - they are discovered live via
`detect-models` (see `model-hints.json` for soft tier classification). Anything a
provider ships is selectable even if Cadence has never heard of it.

## OpenAI (Responses API)

- Host `https://api.openai.com`. Auth `Authorization: Bearer $OPENAI_API_KEY`.
- **Review:** `POST /v1/responses`.
  - `input`: array of `{role, content}` messages (system instruction + user artifact).
  - Structured output: `text.format = {type:"json_schema", name, strict:true, schema}`.
    NOTE: no nested `json_schema` object (that is the older Chat Completions shape).
    strict mode requires every object to carry `additionalProperties:false` and
    list all properties in `required`.
  - Effort: `reasoning.effort` in `none|minimal|low|medium|high|xhigh` (newest
    models also accept `max`; the supported set is model-dependent). Cadence's
    config enums cap at `high` - the levels above it are documented for
    completeness, not configurable.
  - Output text: `output_text`, or the `output[]` message item's
    `content[].text` where `type == "output_text"`. The adapter reads both.
  - Usage (checked 2026-09-01): `usage.input_tokens`, `usage.output_tokens`,
    `usage.total_tokens`, with `usage.input_tokens_details.cached_tokens` and
    `usage.output_tokens_details.reasoning_tokens` as BREAKDOWNS - `output_tokens`
    already includes the reasoning tokens. `extractUsage` reads `input_tokens`
    and `output_tokens`.
- **Detect:** `GET /v1/models` -> `{data:[{id, ...}]}`. IDs live in `data[].id`.

## OpenAI through `codex exec` (review only)

Used when `review.providers.openai.transport` is `codex`. Checked against
codex-cli 0.160.1 on a ChatGPT login, 2026-10-07. No key is read; `consult` and
`detect-models` stay on the Responses API above.

- **Argv:** `codex exec -C <empty temp dir> --skip-git-repo-check -s read-only
  --ephemeral`, `--disable <feature>` for every tool-giving feature in
  `CODEX_DISABLED_FEATURES`, `-c web_search=disabled`, `--output-schema <file>`,
  `-o <file>`, `--json`, `-m <model>`, and `-c model_reasoning_effort=<effort>`
  only when an effort was given (`minimal` sent as `low`). `--disable
  shell_tool` alone left `exec_command` and web search reachable; `unified_exec`
  and the `web_search` setting close them. An unknown feature name exits 1.
- **Prompt:** on stdin, one prompt - the instruction, then the artifact between
  BEGIN and END marker lines. Nothing from the payload is on argv (spawn fails
  with E2BIG past 131,072 argument bytes, and a `-c` value is parsed as TOML).
- **Schema:** `--output-schema` names a file holding `FINDING_SCHEMA` unchanged.
  Whether Codex enforces it or only requests it is unmeasured beyond one probe
  that returned the exact shape, so `validateFindings` is the guarantee.
- **Answer:** `-o` holds the final message. Success exits 0 with that file
  written; a failed turn exits 1 and writes no `-o` file, and under `--json` its
  error arrives on stdout as `turn.failed`. A model the login does not serve
  fails that way with a 400 that names it.
- **Usage:** the `usage` object of `turn.completed` on the `--json` stdout, with
  keys `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`,
  `output_tokens` and `reasoning_output_tokens`. The pair read is
  `input_tokens` and `output_tokens`; whether `output_tokens` includes
  `reasoning_output_tokens` is unmeasured, so the whole object rides as
  `usage_raw`. Codex's harness adds roughly 13,000 to 15,000 input tokens per
  call, mostly cached on repeat (14,708 cold, 12,881 with 10,752 cached). That
  is plan usage, not API spend.
- **Rate limits:** concurrent panel calls share one Codex plan and may hit its
  limits. A limited call exits non-zero and is recorded as a review that did not
  run (`codex-exit`).

## Gemini (Generative Language API, generateContent)

- Host `https://generativelanguage.googleapis.com`. Auth header
  `x-goog-api-key: $GEMINI_API_KEY` (preferred over the `?key=` query param so the
  key stays out of URLs/logs).
- **Review:** `POST /v1beta/models/{model}:generateContent` (model id is in the path).
  - `systemInstruction.parts[].text` + `contents[].parts[].text`.
  - Structured output: `generationConfig.responseMimeType = "application/json"` +
    `generationConfig.responseSchema` (an OpenAPI-3.0 subset - it REJECTS
    `additionalProperties`, which the script strips for Gemini only).
  - Effort (Gemini 3.x): `generationConfig.thinkingConfig.thinkingLevel` in
    `minimal|low|medium|high`. (Gemini 2.5 uses a numeric `thinkingBudget` instead;
    the effort dial targets current 3.x reviewers.)
  - Output text: `candidates[0].content.parts[].text`.
  - Usage (checked 2026-09-01): `usageMetadata`, NOT `usage` - fields
    `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`,
    `totalTokenCount`, `cachedContentTokenCount`. `candidatesTokenCount`
    EXCLUDES thinking tokens where OpenAI and DeepSeek fold theirs in, so
    `extractUsage` reads `promptTokenCount` and
    `candidatesTokenCount + thoughtsTokenCount` to keep the pair comparable.
- **Detect:** `GET /v1beta/models` -> `{models:[{name:"models/<id>", supportedGenerationMethods:[...]}]}`.
  The adapter keeps entries whose `supportedGenerationMethods` include
  `generateContent` OR that omit the field entirely (absence is not evidence
  of inability), and strips the `models/` prefix.

## DeepSeek (Chat Completions API)

- Host `https://api.deepseek.com`. Auth `Authorization: Bearer $DEEPSEEK_API_KEY`.
- OpenAI-compatible, but the **Chat Completions** shape (`choices[].message`), NOT
  the Responses API the openai adapter uses - so it is its own adapter, not a
  base-URL swap.
- **Review:** `POST /chat/completions`.
  - `messages`: array of `{role, content}` (system instruction + user artifact).
  - Structured output: `response_format = {type:"json_object"}` (JSON mode).
    DeepSeek has NO server-side `json_schema` enforcement, so the adapter injects
    the BARE finding schema (the object to produce, not a `{name, schema}`
    wrapper) into the system prompt, and the shape is asserted on return by
    `validateFindings`/`validateConsult` (the same guard every adapter passes).
    json_object mode also requires the word "json" in the prompt, which the
    injected schema instruction supplies.
  - Effort: `reasoning_effort` (`low|medium|high`) - a first-class Chat
    Completions param, honored by thinking models (`deepseek-v4-pro`, the
    `deepseek-v4-flash` thinking mode) and ignored by non-thinking ones. The
    shared config effort enum also allows `minimal`, which DeepSeek rejects, so
    the adapter clamps `minimal` up to `low`.
  - Output text: `choices[0].message.content`.
  - Usage (checked 2026-09-01): `usage.prompt_tokens`, `usage.completion_tokens`,
    `usage.total_tokens`, plus `prompt_cache_hit_tokens`,
    `prompt_cache_miss_tokens` and `completion_tokens_details.reasoning_tokens`;
    `completion_tokens` already includes the reasoning tokens. `extractUsage`
    reads `prompt_tokens` and `completion_tokens`.
- **Detect:** `GET /models` -> `{data:[{id, ...}]}`. IDs live in `data[].id`.
- Model ids as of 2026-07: `deepseek-v4-pro`, `deepseek-v4-flash` (the legacy
  `deepseek-chat`/`deepseek-reasoner` names retire 2026-07-24). Discovered live
  via `detect-models`; `model-hints.json` soft-classifies them.

## Notes on record

- Both providers now promote newer wrapper APIs (OpenAI has always-Responses;
  Gemini tags generateContent "Legacy" and promotes an Interactions API). The
  paths above are current and fully supported; revisit if a provider deprecates them.
- The finding schema (`file, line, severity, claim, failure_scenario`) is defined
  once in the script (`FINDING_SCHEMA`) and sent to every provider in its own
  dialect - OpenAI strict `json_schema`, Gemini `responseSchema`, DeepSeek as an
  in-prompt schema under json_object mode. Keep the shape we assert on return in
  sync with the shape we send.
- **Constraint keywords that ride the wire** (checked 2026-08-17). The schema
  carries `minimum`, `minLength`, `maxLength` and `maxItems`; all four are
  supported on every shipped provider and are sent unchanged.
  - OpenAI structured outputs: supported on BASE models, which are the only
    models Cadence dispatches (fine-tuned models carry extra restrictions). The
    UNSUPPORTED set is the composition keywords plus, for objects,
    `unevaluatedProperties` / `propertyNames` / `minProperties` /
    `maxProperties`, and for arrays `unevaluatedItems` / `contains` /
    `minContains` / `maxContains` / `uniqueItems`. Do not add one of those to
    `FINDING_SCHEMA` - strict mode 400s on it.
  - Gemini `responseSchema` documents `minimum` / `maximum` and `minItems` /
    `maxItems` explicitly for its OpenAPI subset. `additionalProperties` remains
    the one key the adapter strips, and only for Gemini.
  - DeepSeek enforces NOTHING server-side (json_object mode has no schema), so
    the keywords are advisory prose in the system prompt there. That is what
    makes LOCAL validation the guarantee everywhere regardless: `validateFindings`
    mirrors every constraint in this schema, and a test runs both sides against
    the same fixtures.
