# Portability seam: call-review-provider

## Seam: call-review-provider

How the review subsystem reaches a cross-model reviewer. Review is a pure
function (artifact in -> structured findings out). By default a cross-model
review is a direct provider HTTPS call, and the provider API enforces the
finding schema. For openai, when `review.providers.openai.transport` is `codex`,
it is a `codex exec` run inside the same script instead: the same envelope, the
same findings shape, and no key. All provider specifics live in one bundled
script; workflows invoke the script and never inline HTTP or provider bytes.

**Claude Code binding:**
- Run `cadence-core/bin/review-provider.mjs` via the shell (installed at
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs`):
  - Review: `review --provider <openai|gemini> --model <id> [--effort <level>]`,
    the `{instruction, artifact}` payload on stdin. Stdout is one JSON object:
    `{ok:true, findings:[...]}` or `{ok:false, reason, detail}`.
  - Consult: `consult --provider <name> --model <id> [--effort <level>]`, the
    `{situation}` payload on stdin -> `{ok:true, angles:[...]}` (dead-end help;
    see references/consult.md). Same key resolution and degradation as review.
  - Model detection: `detect-models --provider <name>` -> `{ok:true, models:[...]}`.
  - Pass `--key-file <path>` from config `review.key_file` when set (else omit;
    the script uses the XDG default). Never pass a key itself.
- The script resolves the key itself (env first, then the shared providers.env)
  and NEVER logs it; the workflow passes no key.
- Degradation is structured, not exceptional: `ok:false` with `reason` one of
  `no-key | no-codex | codex-exit | transport | http | over-response | no-output
  | bad-json | bad-shape` (call-shape problems surface as `over-cap | bad-payload | bad-provider |
  bad-args | bad-command`, and an unforeseen bug as `internal`). `over-cap` is
  the prompt bound: `review` and `consult` both refuse a payload over
  `review.max_prompt_tokens` estimated tokens (chars/4, default 120000) BEFORE
  any request is issued; `claude-subagent` never runs this script and is exempt
  from it, bounded instead by the spawn-agent turn cap, `maxTurns: 200`.
  `over-response` is the same bound the other way round, on the response:
  every command destroys the request once the body passes 4 MiB, so a flooding
  provider meets a refusal Cadence owns rather than the execution host's wrapping
  command timeout, and an `http` failure carries `detail.body` as a sanitized
  1024-byte excerpt, always a string, never the body. On `no-key`
  the review subsystem falls back to `claude-subagent` and does not offer a
  consult; a `blocking` trigger reports the failure rather than silently pass.
  `no-codex` drops the reviewer the same way.
- Under the Codex transport (openai `review` only; `consult` and
  `detect-models` stay on the API): `no-codex` means `codex` is not on PATH, so
  nothing was sent; `codex-exit` means `codex exec` exited non-zero or died by a
  signal Cadence did not send, the detail carrying the code and a sanitized
  excerpt that names a model the login does not serve. There is no API fallback,
  even with a key set: a failed run is a review that did not run. The run is
  bounded like a request - `review.max_prompt_tokens` before anything is
  spawned, and `review.request_timeout_ms` as a wall-clock SIGKILL of the run and
  what it started (`transport`), not as socket inactivity - and its output past
  4 MiB is `over-response`. Its event carries `transport: "codex"`, and its
  `usage` and `usage_raw` come from the `turn.completed` event.
- The payload is FENCED before the cap: every string field crosses one filter -
  URL userinfo, an `authorization` echo, a credential-shaped `name=value` - so
  `over-cap` measures what actually leaves the machine. `redactions: <n>` on the
  envelope and on the `provider/request` event says how many spans went, written
  only when non-zero; relay it, because that reviewer read less than the caller
  composed. By SHAPE, never a known-token prefix list, so a bare token with no
  credential-shaped name beside it crosses - do not send an artifact you know
  holds one.
- What the call COST rides the `provider/request` event as two keys, written
  only when real on the same rule as `redactions: <n>`: `usage`, the normalized
  `{input, output}` pair, and `usage_raw`, the provider's own usage object.
  `usage_raw` crosses the same fence the payload does and is dropped WHOLE - the
  pair still rides - when the provider's object carries a credential-shaped span
  or overruns its size bound. A response that carried no usage writes NEITHER key - never a zero, so an event
  from before this existed reads as a cost nobody knows rather than a call that
  was free. A call that burned its budget and came back unusable records what it
  burned (`no-output`, `bad-json`, `bad-shape`); a call that reached no response
  has nothing to read. The figure is a provider-reported input+output count off
  the wire, NOT the host's final-window token figure, so it is a different
  denomination: it stops at this event, never sums into a `roles` total, and no
  reader may add the two together.
- The default backend `claude-subagent` does NOT use this seam - it goes
  through spawn-agent with a fresh-context, refute-prompted reviewer, and takes
  that seam's turn cap as its bound in place of anything stated here.
- Model, effort, and per-provider endpoint/key-file path come from config
  (`review.providers.<name>`; per-trigger `review.triggers.<t>.tier` resolves
  the model id, `.effort` the reasoning level).
  A non-HTTP backend lives inside this script, as the Codex transport does,
  never in the workflows.
