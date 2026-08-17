---
phase: 3
status: complete
completed: 2026-08-17
---

# Phase 3: Bounds the review path never stated - Summary

The review path's three unstated bounds are now stated in code: `request()`
enforces a 4 MiB response ceiling with its own `over-response` reason, the
canonical `FINDING_SCHEMA` carries the constraints `validateFindings` enforces
and a machine-run agreement table proves the two sides refuse the same things,
and `execute.md`'s recovery arm names the turn cap and an unusable return
instead of a timeout the dispatch path cannot produce.

## What shipped

- A response byte ceiling Cadence owns - `MAX_RESPONSE_BYTES` (4194304) counted
  per chunk in `request()`, `cadence-core/bin/review-provider.mjs`; crossing it
  destroys the request and answers `reason:"over-response"`, distinct from
  `transport`, on `review`, `consult` and `detect-models` alike.
- One failure-envelope shape - `bodyExcerpt()` in the same file: always a
  string, always <= 1024 bytes, sanitized through `redactUrl` then
  `redactCredentials` over a bounded 4096-byte window.
- A credential sanitizer beside the URL one - `redactCredentials` in
  `cadence-core/bin/lib/redact-url.mjs`: `Bearer` echoes, `name=value` pairs in
  four spellings, quoted multi-word values, and camelCase keys.
- Constraints on the wire and in the validator - `FINDING_SCHEMA` gains
  `minimum`, `minLength`, `maxLength` and `maxItems`; `validateFindings` gains
  seven named diagnostics; `cadence-core/bin/lib/schema-eval.mjs` is a
  keyword-limited, zero-dep evaluator, and an 18-fixture table runs both sides
  and compares verdicts.
- Wire facts on record - `cadence-core/references/provider-api.md` records which
  constraint keywords OpenAI, Gemini and DeepSeek each accept, dated 2026-08-17.
- The recovery arm renamed - `**turn cap or unusable return**` in
  `cadence-core/workflows/execute.md` and `cadence-core/references/seams.md`,
  in the same words, held there by a standing check in
  `cadence-core/bin/prose-agreement.test.mjs`.
- The default reviewer's bound stated where it claims exemption -
  `maxTurns: 200` named in `seams.md` and `references/review-triggers.md`,
  checked against the rung files' own frontmatter rather than a literal.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 76bcfd7 | the fake wire can flood, and can be destroyed |
| 1 | 2 | 99ef17e | a byte ceiling inside `request()`, with its own named reason |
| 1 | 3 | 995ad31 | the shared sanitizer gains credential-shaped spans |
| 1 | 4 | a42705a | one envelope shape - a capped, sanitized excerpt |
| 1 | 5 | c82d2ac | the seam vocabulary and the config arm name `over-response` |
| 1 | 6 | 7824688 | the watched FAIL for RVP-01 |
| 1 | gate | 15b5d4c | risk_surface fixes: the ceiling degrades, the sanitizer stops leaking tails |
| 2 | 1 | 174fd38 | the canonical schema carries the bounds it implied |
| 2 | 2 | 21f7844 | `validateFindings` refuses what the schema refuses, by name |
| 2 | 3 | 5f4b044 | a keyword-limited JSON Schema evaluator, in-repo and zero-dep |
| 2 | 4 | b212a8d | both sides of every fixture, machine-run, no third answer |
| 2 | 5 | d8bf428 | `provider-api.md` records which constraint keywords each provider takes |
| 2 | 6 | cdf8676 | the watched FAIL for RVP-02 |
| 3 | 1 | fb80272 | the recovery arm names its producers, not a timeout |
| 3 | 2 | 3af6561 | the default reviewer states its bound where it claims exemption |
| 3 | 3 | a4eff6e | the watched FAIL for WIR-01 |
| 3 | 4 | e58733b | AC7's watched-FAIL record reaches the SUMMARY |

Range `e1e6c0a..e58733b`, 17 commits.

## Review gates

`risk_surface` fired once on plan 1's range and matched `auth` and `secrets`.
Voices: `openai` and `deepseek`. The `diff` trigger fired on the SAME range
before the user set `review.triggers.diff.gate` to `off` mid-run; its three
findings duplicated two of the risk_surface survivors and are folded in.

4 survivors of 6 raised. Three are fixed at `15b5d4c` with regression tests:

- **blocker** - `req.destroy(err)` aborts an active response, but `res` carried
  no `'error'` listener, so the new byte ceiling could take the process down
  instead of answering `over-response`. Confirmed by removing the fix: the test
  runner hangs rather than reporting. The fake transport emitted on `req` alone,
  which is why plan 1's own tests passed; it now aborts the response the way a
  socket does, so the flood case is the regression test.
- **high** - the credential value class stopped at the first space, so
  `"password":"correct horse battery staple"` kept all but its first word. A
  quoted value now runs to its closing quote.
- **high** - `CRED_NAME` could not match a camelCase key, so `"apiSecret"` and
  `"clientSecret"` went through byte-identical. A case-sensitive second pattern
  covers them without letting `monkey` or `turkey` match.

The fourth is an open item below. Plans 2 and 3 matched no risk surface and
fired no review. The gate's capped re-arm round on the fix commit was declined
by the user and recorded as an explicit override
(`.planning/phases/3/REVIEW-risk_surface-plan-1.md` carries the settled list).

## Deviations

- [deviation] plan 1, task 4 (`a42705a`) - the Action said to sanitize the whole
  raw body. `redactUrl` measured QUADRATIC on this box (78ms at 10KB, 5.1s at
  80KB) because its scheme-less rule scans from every offset; against task 2's
  own new 4 MiB ceiling that extrapolates to roughly four hours of CPU for one
  failure envelope, so the new bound would have created a worse one.
  `bodyExcerpt` sanitizes a bounded 4096-byte window instead, pinned by a
  wall-clock test that times out rather than passes if the window is removed.
- [deviation] plan 2, task 2 (`21f7844`) - the Verify assumed the existing suite
  was unaffected by the new bounds. Plan 1's `bodyOfBytes` fixture padded the
  finding's `claim`, which the new `maxLength: 2000` refuses, so the 4 MiB
  fixture silently degraded to `bad-shape` and stopped exercising the response
  ceiling at all. The filler moved to a sibling key `extractText` ignores; the
  wire byte count is identical and the ceiling test asserts what it meant to.
- [deviation] plan 3, task 4 (`e58733b`) - the Verify's
  `grep -c "WATCHED FAILING AT"` expected 3 and returns 4: RVP-01 and RVP-02
  share one test file, and `prose-agreement.test.mjs` already carried an MSR-01
  header from a prior milestone. The count was a proxy; the criterion AC7 states
  was verified instead by extraction, each SUMMARY line's SHA against the header
  in the file that line names (3/3).

## Open items

- ~~The window-edge ordering in `bodyExcerpt`~~ - CLOSED at `6d0aab4` during
  phase-3 UAT, after the deep verify pass reproduced it at 73 bytes of exposed
  value. The repair was NOT in `bodyExcerpt`: the root cause was `CRED_VALUE` in
  `lib/redact-url.mjs`, whose two quoted alternatives both require a closing
  quote while the bare class excludes quotes, so a credential straddling the
  window matched nothing and survived byte-identical. It now also matches an
  unterminated quoted value to end-of-input, terminated forms tried first. Both
  earlier repair attempts failed because they targeted the whitespace safeguard,
  which is the symptom. Regression fixtures at both levels, each watched failing
  against the unpatched helper. This commit did NOT re-fire the blocking
  `risk_surface` gate: recorded as an explicit user override in the trace
  (`outcome/override`, base `5fac300`, sha `6d0aab4`).
- The quadratic in `redactUrl` itself is unfixed and is the better repair -
  its scheme-less rule `[^\s/:@]+:[^\s/@]+@` rescans from every offset. Its four
  other callers hand it a git error message, so the cost was unreachable until
  this phase pointed it at a provider-controlled body. Fixing the helper would
  let the 4096-byte window go.
- D-09 - `CONSULT_SCHEMA` and `validateConsult` carry the IDENTICAL gap in
  identical code shape, deliberately out of scope here. Mirroring plan 2's shape
  is mechanical: four constraint keywords, four named diagnostics, fixtures into
  the same agreement table (`evaluateSchema` needs no change).
- `lib/schema-eval.mjs` is test-only but sits under `bin/lib/` so
  `tsconfig.ci.json` checks it. It carries no CONTRACTS row and no weight budget:
  self-verify's `uncontracted-script` check skips directories, and the weight
  budgets cover only `agents/`, `references/`, `templates/` and `workflows/`.
- `README.md` carries a re-added self-hosted test badge, unstaged and outside
  every plan's lease. It is the orchestrator's edit, not an executor's, made on
  user request mid-phase. HST-01 (v2.0.0) deliberately REMOVED this badge as
  unbacked; the endpoint is backed now (it 303s to a live
  `test.yml-success-brightgreen`), so the removal's reason no longer holds - but
  reversing a completed requirement is the user's call, not this phase's.
- `risk_surface` cannot distinguish "this diff touches auth/secrets" from "this
  diff IS the auth/secrets code". Plan 1 hardened a credential sanitizer and the
  detector matched on the literal word `Bearer`, fired a blocking cross-model
  review, then re-matched on its own fix commit and demanded the capped re-arm.
  Filed to CAPTURE with a proposed shape (a plan-declared frontmatter key naming
  the categories a plan is ABOUT, distinct from the ones it could regress).

## Goal check

The phase goal named three places the review path asserts a control it does not
hold, and all three are now stated in code rather than prose. (1) The response
bound: `MAX_RESPONSE_BYTES` is counted per chunk at the single `data += c` site
in `request()` and crossing it destroys the request (`99ef17e`), with
`over-response` distinct from `transport` through one shared `failRequest`; the
falsifier at `7824688` was watched failing at `e1e6c0a`, where the unpatched
seam concatenated 8 MiB whole and returned
`{"ok":false,"reason":"internal","detail":"Cannot read properties of null"}`.
(2) The schema agreement: `FINDING_SCHEMA` carries `minimum`/`minLength`/
`maxLength`/`maxItems` (`174fd38`), `validateFindings` names seven diagnostics
(`21f7844`), and the 18-fixture table at `b212a8d` runs both sides and compares
verdicts, watched failing in BOTH directions - deleting `minimum` from the
schema and deleting the validator's mirror each redden it. (3) The wiring:
`**timeout or no report**` is gone from `execute.md:245` and `seams.md:64`,
replaced by one identical producer phrase, held by the WIR-01 check at
`prose-agreement.test.mjs:615` which was watched failing at `cdf8676` and
reddens if either document is reworded alone. Suite-wide `node --test
cadence-core/bin/*.test.mjs` reports 2107 pass / 0 fail and
`tsc -p tsconfig.ci.json` is clean at `e58733b`.

Two honest gaps. The blocker the gate caught is the one that matters for the
goal's own claim: the byte ceiling shipped at `99ef17e` could crash the process
rather than degrade, so between `99ef17e` and `15b5d4c` the phase asserted a
bound it did not hold - exactly the failure mode the phase exists to remove. It
is fixed and regression-tested, and the fake transport that hid it is now
faithful. Second, the `bodyExcerpt` window-edge item WAS a narrow input class
where a credential fragment reached the envelope - carried as an open item here
rather than claimed clean, then found by the deep verify pass and fixed at
`6d0aab4` before the phase was marked complete. The remaining `redactUrl`
quadratic below is a cost bound, not a leak.

## AC7: watched failures

Each requirement's falsifier was watched failing against the tree that preceded
its own first implementation commit. The SHA on each line is quoted from that
test's `WATCHED FAILING AT` header, which also carries the observed unpatched
output verbatim.

- **RVP-01** - `cadence-core/bin/review-provider.test.mjs`, watched failing at
  `e1e6c0a`. Re-watch: `git worktree add --detach <tmp> e1e6c0a`, copy
  `cadence-core/bin/review-provider.test.mjs` into that checkout's
  `cadence-core/bin/`, run
  `node --test --test-name-pattern='RVP-01' cadence-core/bin/review-provider.test.mjs`
  there, then remove the worktree.
- **RVP-02** - `cadence-core/bin/review-provider.test.mjs`, watched failing at
  `15b5d4c`. Re-watch: `git worktree add --detach <tmp> 15b5d4c`, copy
  `cadence-core/bin/review-provider.test.mjs` into that checkout's
  `cadence-core/bin/` AND `cadence-core/bin/lib/schema-eval.mjs` into that
  checkout's `cadence-core/bin/lib/`, run
  `node --test --test-name-pattern='RVP-02' cadence-core/bin/review-provider.test.mjs`
  there, then remove the worktree. The second copy is not optional - the
  evaluator cases import that module, so a checkout carrying only the test file
  fails at module resolution before any assertion runs.
- **WIR-01** - `cadence-core/bin/prose-agreement.test.mjs`, watched failing at
  `cdf8676`. Re-watch: `git worktree add --detach <tmp> cdf8676`, copy
  `cadence-core/bin/prose-agreement.test.mjs` into that checkout's
  `cadence-core/bin/`, run
  `node --test --test-name-pattern='WIR-01' cadence-core/bin/prose-agreement.test.mjs`
  there, then remove the worktree.
