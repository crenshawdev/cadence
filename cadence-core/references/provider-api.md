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
- **Detect:** `GET /v1/models` -> `{data:[{id, ...}]}`. IDs live in `data[].id`.

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
- **Detect:** `GET /v1beta/models` -> `{models:[{name:"models/<id>", supportedGenerationMethods:[...]}]}`.
  The adapter keeps entries whose `supportedGenerationMethods` include
  `generateContent` OR that omit the field entirely (absence is not evidence
  of inability), and strips the `models/` prefix.

## Notes on record

- Both providers now promote newer wrapper APIs (OpenAI has always-Responses;
  Gemini tags generateContent "Legacy" and promotes an Interactions API). The
  paths above are current and fully supported; revisit if a provider deprecates them.
- The finding schema (`file, line, severity, claim, failure_scenario`) is defined
  once in the script (`FINDING_SCHEMA`) and sent to both providers, in each one's
  dialect. Keep the shape we assert on return in sync with the shape we send.
