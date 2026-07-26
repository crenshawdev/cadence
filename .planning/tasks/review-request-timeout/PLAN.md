# Task: configurable review-provider request timeout

Off-roadmap task (`/cad-task`). Branch `cadence/v1.3.1`.

## Problem

`review-provider.mjs:147` hardcodes `REQUEST_TIMEOUT_MS = 120000` with no flag
and no config key. It is passed as `https.request`'s `timeout`, which is a
socket *inactivity* timeout; the provider response is not streamed, so no bytes
arrive until the model finishes thinking and inactivity therefore caps total
thinking time.

Measured during the phase-2 `risk_surface` fire, one 12.7KB diff payload:

| model | effort | result |
|---|---|---|
| `gpt-5.3-codex` | high | timeout at 120s (x2) |
| `gpt-5.4-mini` | high | timeout at 120s |
| `gpt-5.3-codex` | low | returned |
| `gpt-5.3-codex` | high, cap lifted to 900s | **returned at 292s** |

So the variable is effort, not model tier, and the real cost of a high-effort
review is ~2.4x the cap. Shipped defaults put `effort: high` on `plan`
(adjudicated), `risk_surface` (**blocking**) and `pre_ship` (adjudicated) - the
three gates that actually gate. `fire()` step 4 drops a timed-out reviewer and
continues by design, so a blocking gate can pass having silently degraded to
`claude-subagent` alone.

Note `workflow.subagent_timeout` already defaults to 300000: Cadence gives a
subagent 5 minutes and a cross-model reviewer doing comparable work 2. Even 300s
would have cleared the measured call by only 8s, so matching it is not enough.

## Decisions

- **D-01**: new schema key `review.request_timeout_ms` (`int`, `min 1`,
  default `600000`), beside `review.key_file`. 600s is ~2x the measured 292s.
  Chosen over an effort-scaled hardcoded ladder (still hardcoded, no escape
  hatch when a payload grows) and over lowering the shipped `effort` defaults
  (works around the defect by degrading the most important gates).
- **D-02**: the seam reads the key itself via `mergeLayers`, rather than the
  caller passing `--timeout`. `fire()` already has four flags to thread and a
  workflow that forgets one reintroduces the same silent degradation. Keeps
  zero-dep: `lib/config-merge.mjs` imports only node builtins.
- **D-03**: the config read is LAZY and memoized, not module-level.
  `review-provider.test.mjs` imports pure helpers directly from the module, so
  import-time I/O would fire inside unit tests.
- **D-04**: a missing, malformed, or non-positive configured value falls back to
  the default rather than failing. A bad timeout must never sink a review - same
  degrade-never-crash contract as the rest of this seam.

## Tasks

### 1. Schema key + seam reads it
Files: `cadence-core/config.schema.json`, `cadence-core/bin/review-provider.mjs`
Action: add the key per D-01. In the seam, replace the const with a pure
exported `resolveTimeoutMs(configured)` (validates, falls back per D-04) plus a
memoized `requestTimeoutMs()` that reads `.planning/config.json` through
`mergeLayers` and is called from inside `request()` (D-02, D-03).
Verify: `config.mjs keys` lists `review.request_timeout_ms` with default
`600000`; `config.mjs get review.request_timeout_ms` returns `600000`; with a
repo config setting it to `3000`, a review call against an unroutable host
aborts in ~3s instead of 120s, still as `{ok:false,reason:"transport"}`.

### 2. Regression tests
Files: `cadence-core/bin/review-provider.test.mjs`
Action: unit-test `resolveTimeoutMs` across configured / absent / zero /
negative / non-integer / non-numeric, asserting the default fallback each time.
Verify: `node --test cadence-core/bin/review-provider.test.mjs` passes, and the
new tests fail against pre-fix source (helper absent) in a HEAD worktree.

### 3. Docs
Files: `cadence-core/workflows/config.md`, `cadence-core/references/review-triggers.md`
Action: add the key to config.md's key table; in review-triggers.md note that a
provider call is bounded by `review.request_timeout_ms` and that a high-effort
review can legitimately take minutes.
Verify: `node cadence-core/bin/self-verify.mjs` reports `ok:true, problems:[]`
with no `inert-config-key` for the new key and no budget overrun.

## Outcome

Shipped as planned: `review.request_timeout_ms` (int, min 1, default 600000),
read lazily and memoized by the seam, with every unusable value falling back to
the default. `node --test cadence-core/bin/*.test.mjs` 297 pass / 0 fail,
`tsc -p tsconfig.ci.json` clean, `self-verify.mjs` `ok:true, problems:[]`.

| Commit | Scope |
|---|---|
| `141cce9` | schema key + seam + docs (plan tasks 1 and 3, merged) |
| `6779fb1` | `resolveTimeoutMs` fallback tests (plan task 2) |

Deviations:

- **Tasks 1 and 3 merged into one commit.** Adding a schema key without
  documenting it trips self-verify's `inert-config-key` check, which fails two
  tests, so committing the schema change alone would have left a broken
  intermediate commit. The check exists precisely to make key and prose
  inseparable; splitting them was the plan's mistake, not the check's.
- **`self-verify.test.mjs` also needed the key.** Its `placeholder keys expand`
  fixture hardcodes every schema key to prove `<t>` expansion, so a new key must
  be listed there too. Not anticipated in the plan; folded into `141cce9`.
- **`workflows/config.md` went over its weight budget again** (14073B vs
  13920B). Rebudgeted to the measured size, same precedent as phase 2.
- **Failing-capability is coarser than usual.** The new tests target a new
  export, so against pre-fix source the whole test file fails to load rather
  than failing two assertions. It still cannot pass without the change.
- **`review.request_timeout_ms` bounds one request, not a whole panel.** Three
  reviewers firing in parallel each get the full budget, so a `blocking` gate's
  worst case is now ~10 min rather than ~2. Not a regression (the old cap had
  the same shape), but worth knowing before lowering it.
