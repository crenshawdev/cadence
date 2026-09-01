# Portability seam: call-review-provider

## Seam: call-review-provider

How the review subsystem reaches a cross-model reviewer. A cross-model review
is a direct provider HTTPS call (OpenAI / Gemini), NOT a CLI subprocess: review
is a pure function (artifact in -> structured findings out), and the provider
API enforces the finding schema. All provider specifics live in one bundled
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
  `no-key | transport | http | over-response | no-output | bad-json | bad-shape`
  (call-shape problems surface as `over-cap | bad-payload | bad-provider |
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
  `{input, output}` pair, and `usage_raw`, the provider's own usage object. A
  response that carried no usage writes NEITHER key - never a zero, so an event
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
  A future non-HTTP reviewer backend replaces this script, not the workflows.
