---
phase: 3
plan: 1
requirements:
  - RVP-01
files:
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/bin/lib/redact-url.mjs
  - cadence-core/bin/redact-url.test.mjs
  - cadence-core/references/seams.md
  - cadence-core/workflows/config-review.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: Bounds the review path never stated - Plan 1 (RVP-01, the runtime half)

## Goal

A provider response is bounded by BYTES that Cadence owns rather than by the
host's wrapping command timeout: crossing the ceiling destroys the request and
surfaces as its own named reason, and an HTTP failure envelope carries a capped
sanitized excerpt instead of the whole body.

## Must be true when done

- A response whose bytes cross the stated ceiling ends as `{ok:false,
  reason:"over-response"}` with the request destroyed and no further chunks
  concatenated - on `review`, `consult` and `detect-models` alike, because one
  read path serves all three.
- A response under the ceiling behaves exactly as it does today: same envelope,
  same parse, same trace event.
- Every non-2xx failure envelope carries `detail.body` as a STRING no longer
  than the stated excerpt cap, whatever the provider returned - one shape
  always, never a parsed object for a small body and a string for a large one.
- That excerpt carries no credential-shaped span: a planted `key=` query
  parameter, an `authorization: Bearer ...` echo, and a `token`- or
  `secret`-named pair are each replaced whole, name and value together.
- The model-not-found diagnostic still names the refused model inside the cap,
  so the one thing `/cad-config`'s review arm reads that envelope for survives.
- `cadence-core/references/seams.md`'s degradation vocabulary names the new
  reason and `cadence-core/workflows/config-review.md`'s arm recognises it, so
  the trace, the caller and the config workflow all distinguish "the provider
  flooded us" from "the socket died".
- A falsifier committed with a `WATCHED FAILING AT <sha>` header exits non-zero
  when run against that SHA and zero on this tree, and `node --test
  cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs` and
  `npx tsc -p tsconfig.ci.json` are all green.

## Context

CONTEXT D-01 binds the ceiling to the single `request()` helper, counted per
chunk at the one `data += c` site with `req.destroy()` on the crossing, so no
second read path can be left half-fixed. D-02 makes the crossing a NEW named
reason in the seam's degradation vocabulary rather than a ride on `transport`,
with `seams.md` gaining the word in the same edit. D-03 makes both numbers named
module constants beside `DEFAULT_MAX_PROMPT_TOKENS` - no config key, no
`config-catalog.md` row, no `config.mjs` write face, no `config-reach` move.
D-04 fixes ONE envelope shape: a capped string excerpt sanitized through the
shared `lib/redact-url.mjs` helper, never cap-then-parse. D-05 drives the proof
through the existing `fakeTransport` harness.

Out of this plan: everything RVP-02 (PLAN-2) and everything WIR-01 (PLAN-3).
Out of the phase: the non-streamed-request design this seam has carried since
the `review.request_timeout_ms` fix, and the still-open "a reviewer lost to
`transport` on a blocking gate is one dropped line" item beside it in
`CAPTURE.md` - both are loudness and transport shape, not a bound the prose
claims.

## Tasks

### Task 1: the fake wire can flood, and can be destroyed

- **Files:** `cadence-core/bin/review-provider.test.mjs` (the `fakeTransport`
  helper and its doc comment, and the `runFaked` driver beside it)
- **Action:** Grow `fakeTransport` so a test can express the two things the
  ceiling needs and today's harness cannot: a body arriving as MANY chunks, and
  a response stream that stops when the seam destroys it. Today `wire` is
  `{timeout:true}` or `{status, body}` emitted as a single `res.emit('data',
  wire.body)`, and `res` is a bare `EventEmitter` whose only sibling is
  `statusCode` - `destroy` exists on `req` alone. Accept a chunk LIST beside the
  existing single `body` (keep `body` working unchanged: every existing case in
  this file passes `body`, and rewriting them is not this plan's job), emit the
  chunks in order, give `res` a `destroy` of its own, and have BOTH `req.destroy`
  and `res.destroy` set a flag the emit loop checks BEFORE each remaining chunk
  so a destroyed stream stops mid-list. The flag is the load-bearing half: a fake
  that keeps emitting after destroy cannot tell a seam that destroyed the request
  from one that only stopped appending, which is exactly the distinction the next
  task exists to prove. Record on the object `seen` already collects - or
  alongside it - how many chunks were actually emitted, so a test can assert the
  stream was cut rather than drained. Do not change `req.destroy`'s existing
  behaviour of emitting `error`: the timeout mode depends on it, and the ceiling
  path will reach the same rejection route. Extend the helper's doc comment to
  state the new `wire` shapes, since that comment is the harness's contract for
  every test below it.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with every existing test unchanged, plus a new case showing that a 200 whose
  body arrives as three chunks resolves to the same envelope as the identical
  body sent as one chunk (`ok:true`, same findings), and a case showing that a
  chunk list emitted against a `res` destroyed after the first chunk reports
  fewer chunks emitted than the list holds.

### Task 2: a byte ceiling inside `request()`, with its own named reason

- **Files:** `cadence-core/bin/review-provider.mjs` (the `request()` helper's
  `res.on('data', ...)` handler; the constant block around
  `DEFAULT_REQUEST_TIMEOUT_MS` / `DEFAULT_MAX_PROMPT_TOKENS`; the two catch
  arms that call `fail('transport', ...)` - one in `callStructured`, one in
  `cmdDetect`), `cadence-core/bin/review-provider.test.mjs`
- **Action:** Count bytes at the ONE `data += c` site inside `request()` and
  destroy the request once the running total crosses a named module constant
  placed beside `DEFAULT_MAX_PROMPT_TOKENS`, with a comment above it stating the
  derivation rather than a round number: the shipped request-side bound is
  `review.max_prompt_tokens` at 120000 estimated tokens, which is 480000 chars
  under the `chars/4` proxy this file already uses, and a structured-output
  response is smaller than the artifact that produced it in every observed run -
  so 4 MiB (4194304 bytes) sits at roughly 8.7x the largest payload this seam
  will ever SEND, and PLAN-2's finding bounds put the largest response local
  validation can ever ACCEPT near 0.5 MB, about 8x under it. Count real bytes,
  not string length: no encoding is set on `res`, so a chunk is a Buffer in
  production and a string in the fake, and `Buffer.byteLength` is correct for
  both while `.length` is correct for neither. On the crossing call
  `req.destroy(...)` - the mechanism the `timeout` handler at the same site
  already uses - and make the rejection DISTINGUISHABLE from an ordinary socket
  error by tagging the error object with a module-private marker the catch arms
  test for; do not match on the message text, which is what makes a diagnostic a
  parser. Both catch arms - `callStructured` and `cmdDetect` - map a marked
  rejection to `traceProvider(meta, 'over-response', ...)` followed by
  `fail('over-response', ...)`, and an unmarked one to `transport` exactly as
  today. `over-response` is the reason word; it is a wire-visible contract, so do
  not rename it. Riding `transport` instead would leave the trace, the caller and
  `config-review.md` unable to tell a flooding provider from a dead socket, which
  is D-02's whole argument. The detail string names the ceiling and the bytes
  seen, on the `over-cap` refusal's precedent one screen up. Nothing about the
  under-ceiling path changes - same resolve, same `{status, json, raw}`.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with new cases showing: a `review` against chunks totalling more than the
  ceiling returns `{ok:false, reason:"over-response"}` with exit code 1, the
  request destroyed and fewer chunks emitted than the list holds (so the seam cut
  the stream rather than draining it), and exactly one provider event whose
  `outcome` is `over-response` and `degraded` is `true`; the same wire against
  `detect-models` and `consult` returns the same reason, proving one read path
  bounds all three; a body one byte under the ceiling still resolves normally to
  `ok:true`; and an ordinary socket error still returns `transport`. `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 3: the shared sanitizer gains credential-shaped spans

- **Files:** `cadence-core/bin/lib/redact-url.mjs` (the module header and the
  `SCHEME_USERINFO` / `BARE_USERINFO` / `redactUrl` block),
  `cadence-core/bin/redact-url.test.mjs`
- **Action:** Add a SECOND exported total function to this module that replaces
  credential-shaped spans a URL-position redaction cannot see: an
  `authorization: Bearer <value>` echo, and a `<name>=<value>` or `"<name>":
  "<value>"` pair whose NAME is credential-shaped (key, api_key, api-key, token,
  access_token, secret, password, passwd, and the same names inside a query
  string). Replace the WHOLE span - name, separator and value together - with the
  existing `MARK`, not the value alone: an excerpt still reading `key=<redacted>`
  reports which credential class was present, and the criterion this exists to
  meet requires the lead-in gone too. Same charter as the file it joins: node
  builtins only, no I/O, never throws, coerces a non-string input rather than
  passing it through. Leave `redactUrl` itself byte-identical in behaviour and do
  not fold the new patterns into it - `cadence-core/bin/issue-check.mjs:41-47`
  states in writing that `redactUrl` "covers credentials in URL POSITION and
  nothing else", and that statement stays true of `redactUrl` when the new
  coverage is a sibling export rather than a widened one. Redact by SHAPE, never
  by a list of known token prefixes, for the reason the header already gives. A
  bare word carrying no separator and no value (an error message reading "invalid
  token") is NOT a credential shape and comes back unchanged; say so in the doc
  comment, because that boundary is what keeps this from eating provider
  diagnostics. Extend the module header to name the second export, what it covers
  and why the split exists.
- **Verify:** `node --test cadence-core/bin/redact-url.test.mjs` exits 0 with
  every existing `redactUrl` case unchanged and new cases showing: `authorization:
  Bearer sk-live-abc123` comes back with neither `Bearer` nor the value present;
  `https://api.example/v1?key=sk-live-abc123&x=1` comes back with neither `key=`
  nor the value; `{"api_token": "glpat-xyz"}` comes back with neither `token` nor
  the value; `secret=hunter2` comes back with neither `secret` nor the value; the
  sentence `the request carried an invalid token` comes back byte-identical; and
  a non-string input is coerced rather than returned as-is. `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 4: one envelope shape - a capped, sanitized excerpt

- **Files:** `cadence-core/bin/review-provider.mjs` (the `fail('http', {status,
  body: res.json || res.raw})` site in `callStructured` and the identical one in
  `cmdDetect`; the constant block beside `DEFAULT_MAX_PROMPT_TOKENS`),
  `cadence-core/bin/review-provider.test.mjs` (fault modes 2/6, 3/6 and 4/6,
  which assert `detail.body.error.code`)
- **Action:** Replace `res.json || res.raw` at BOTH `http` failure sites with one
  shared helper in this file that turns the raw body into a string excerpt:
  sanitize first through `redactUrl` and the new sibling export from task 3, THEN
  truncate to a named module constant beside the ceiling from task 2. Sanitize
  before truncating, never after - truncating first can cut a credential in half
  and leave the prefix in the envelope. The cap is 1024 bytes, and the number is
  measured rather than round: the largest real OpenAI error body in this file's
  own fixtures is 155 bytes (`model_not_found`) and a documented
  invalid-schema rejection runs about 226, so 1024 holds the whole diagnostic
  with more than 4x headroom while still bounding a proxy HTML error page to a
  readable head. ONE shape always - never a parsed object when the body is small
  and a string when it is large, which is the cap-then-parse alternative D-04
  rejects because it makes every consumer branch on `typeof detail.body`.
  `detail` stays the `{status, body}` object it is today; only `body`'s type is
  pinned to string. Mark the truncation visibly so a reader can tell a cut
  excerpt from a whole body. `cadence-core/workflows/config-review.md:36-41`
  reports `detail` and nothing else, so a string still serves its only consumer.
  Then rewrite the three fault-mode tests that assert `detail.body.error.code` to
  match on excerpt TEXT instead: the point those tests protect - that the user
  reads WHICH model was refused rather than a bare 404 - is preserved by matching
  the model id inside the excerpt, and their comments should say so.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with the three rewritten fault modes asserting `typeof envelope.detail.body ===
  'string'` and matching the model id and the error code as text, plus a new case
  showing that a fault-injected non-2xx body carrying an `authorization: Bearer
  <value>` echo, a `?key=<value>` query parameter, an `"api_token"` field and a
  `secret=<value>` pair returns `detail.body` whose byte length is <= 1024 and
  which contains none of `key=`, `token`, `secret` or `Bearer`, while a 404
  carrying the `model_not_found` message still returns an excerpt matching the
  refused model id. `npx tsc -p tsconfig.ci.json` exits 0.

### Task 5: the seam's vocabulary and the config workflow's arm name the new reason

- **Files:** `cadence-core/references/seams.md` (the call-review-provider seam's
  "Degradation is structured, not exceptional" bullet, which enumerates `no-key |
  transport | http | no-output | bad-json | bad-shape` and the `over-cap` bound
  beside it), `cadence-core/workflows/config-review.md` (the "2. Handle the
  result" step's `reason:"transport"|"http"` arm),
  `cadence-core/bin/weight-budgets.json`
- **Action:** Add the new reason to the enumerated wire-time list in `seams.md` -
  it belongs with `no-key | transport | http | no-output | bad-json | bad-shape`
  and NOT with the call-shape group, because it is a failure of a request already
  in flight rather than a refusal before one is issued. State in one sentence
  what it means and what bounds it, in the same place and register `over-cap`'s
  own sentence already states the prompt bound, so the reference carries the
  response bound and the request bound side by side rather than one of each in
  two documents. Then extend `config-review.md`'s degradation arm so the new
  reason is handled beside `transport` and `http`: the recovery is identical -
  report `detail`, offer retry / manual entry / skip, never block setup - and an
  unhandled reason in the one workflow that consumes `detect-models` output is a
  reason the user meets with no arm, which is the condition D-02 says riding
  `transport` would have hidden. Do not add a config key, a `config-catalog.md`
  row or a `config-reach` entry (D-03): both numbers are named constants.
  `seams.md` sits at exactly its 19726-byte pin and `config-review.md` at exactly
  its 3859-byte pin, both with zero headroom, so re-pin `weight-budgets.json`
  for each in this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `ok:true` and
  no `budget-overrun` or `unbudgeted-surface` problem, which is the falsifiable
  half - an unre-pinned surface fails it. `grep -c "over-response"
  cadence-core/references/seams.md` returns at least 1 and `grep -c
  "over-response" cadence-core/workflows/config-review.md` returns at least 1.
  `node cadence-core/bin/weight.mjs --root .` reports both files at byte counts
  equal to their new `weight-budgets.json` entries.

### Task 6: the watched FAIL for RVP-01

- **Files:** `cadence-core/bin/review-provider.test.mjs` (the RVP-01 falsifier,
  appended at the end of the file)
- **Action:** Add one falsifier test exercising RVP-01's two halves end to end
  through the seam's own entry unwind: a flooding wire returns the named reason
  with the request destroyed rather than a resolved full body, and a non-2xx wire
  returns a capped sanitized string excerpt rather than the whole body. Reach the
  seam through `__runCommandForTests` and the existing fault fixture only, and
  import nothing this plan added, so against the unpatched tree it fails on its
  ASSERTIONS rather than on a missing export - a falsifier that fails to import
  proves the module changed, not that the behaviour did. Carry the header comment
  in the shape `cadence-core/bin/milestone-prune.test.mjs`'s RCL-07 falsifier
  already uses: `WATCHED FAILING AT <sha>` naming the tip of the unpatched tree
  (`c4522c3` is the tip as this plan is written; use the commit immediately
  preceding this plan's first implementation commit if it has moved), the
  observed unpatched output quoted verbatim, and the re-watch recipe (`git
  worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/`, `node --test` it there, remove the worktree).
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA the
  header names, the same command exits NON-ZERO with this test failing on an
  assertion, and the header quotes that observed output.

## Notes

- Numbers settled here, both as named constants per D-03: the response byte
  ceiling is 4 MiB (4194304) and the failure-envelope excerpt cap is 1024 bytes.
  The excerpt cap answers CONTEXT's first flagged assumption with a measurement
  rather than a round number - 155 bytes for the `model_not_found` body already
  in this file's fixtures, 226 for a documented invalid-schema rejection - so the
  diagnostic `/cad-config`'s review arm reads that envelope for fits whole.
- The new reason word is `over-response`, chosen against `over-cap` as the
  in-tree precedent for a named bound refusal: `over-cap` bounds what we SEND,
  `over-response` bounds what we RECEIVE, and the pair reads as one family in the
  seam's vocabulary.
- Task 3 extends `cadence-core/bin/lib/redact-url.mjs` beyond URL position.
  D-04 names that file as the sanitizer and its evidence line gives the reason
  ("one shared sanitizer, never a per-site regex"), and AC2 requires coverage
  `redactUrl` does not have - `issue-check.mjs:41-47` says so in writing. The
  reconciliation is a SIBLING export: `redactUrl`'s own behaviour and
  `issue-check.mjs`'s statement about it both stay true, and the review path gets
  the coverage its criterion requires without a per-site regex. Flagged for the
  human in the return marker.
- Task 5 touches `cadence-core/workflows/config-review.md`, which CONTEXT's
  file-lease directive does not name. It is D-02's own argument made good: the
  decision's stated reason for a new word is that riding `transport` would make
  this workflow's arm report the wrong condition, and an arm that does not
  recognise the word reports no condition at all.
- This plan shares `cadence-core/bin/review-provider.mjs`,
  `cadence-core/bin/review-provider.test.mjs`,
  `cadence-core/references/seams.md` and `cadence-core/bin/weight-budgets.json`
  with PLAN-2 and PLAN-3. That is the CONTEXT `Plan shape` directive's explicit
  instruction, so `plan-overlap` will report an overlap and `/cad-execute` runs
  the three plans SEQUENTIALLY in number order. No plan reads another's output.
</content>
</invoke>
