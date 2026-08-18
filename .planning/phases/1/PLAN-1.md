---
phase: 1
plan: 1
requirements: [EXP-02]
files:
  - cadence-core/bin/lib/redact-url.mjs
  - cadence-core/bin/redact-url.test.mjs
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
---

# Phase 1: What a wrong answer destroys - Plan 1 (EXP-02)

## Goal

`bodyExcerpt` cannot leave a window-edge-truncated credential in a provider
failure excerpt: a URL userinfo span whose `@` falls outside the 4096-byte
sanitize window is redacted at the sanitizer root, not survived into the
envelope.

## Must be true when done

- A provider response body carrying a URL userinfo span cut before its `@` by
  the sanitize window yields a failure excerpt containing no byte of the planted
  secret value, at #215's own parametrization and at a high-magnitude case that
  leaked at least 900 bytes of the planted value before the fix.
- `redactUrl` returns `https://example.com:8080/path` byte-identical both
  mid-body and at end-of-input: the new end-of-input anchor does not read a port
  as userinfo.
- Every shipped negative fixture in `cadence-core/bin/redact-url.test.mjs` still
  comes back byte-identical - the ordinary scp remote, the email-address trailer,
  the no-URL push failure, and the coverage-split case asserting `redactUrl`
  leaves a `name=value` pair to `redactCredentials`.
- An ordinary long body still returns EXACTLY `MAX_HTTP_BODY_BYTES`: both shipped
  truncation fixtures still assert `===`, and the proxy-page excerpt still
  contains `504 Gateway Time-out`.
- EXP-02 carries a check whose `WATCHED FAILING AT` header names `ae73dd6` or an
  earlier sha, and that check fails when re-run against that commit's tree.
- `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked by `phases/1/CONTEXT.md`: D-01 puts the repair in `lib/redact-url.mjs` as
an unterminated-userinfo alternative anchored to end-of-input with the terminated
forms tried first, leaving the `clean <= room` whitespace safeguard and
`SANITIZE_WINDOW_BYTES` untouched; D-02 keeps both truncation assertions `===`;
D-03 rejects re-sanitizing the cut head; D-04 keeps deletion of the sanitize
window (and `redactUrl`'s quadratic) out of this phase; D-08 sizes the fixture
family to the class rather than to #215's ~36-byte figure; D-09 exports
`bodyExcerpt`; D-10 pins the falsifier's watched sha.

The pattern to follow already exists in the same file: `CRED_VALUE`
(`redact-url.mjs`) closes the identical window-edge hole for QUOTED `name:value`
pairs with two unterminated alternatives placed AFTER the terminated ones, and
its shipped fixture is `redactCredentials: a quoted value cut before its closing
quote still goes` in `redact-url.test.mjs`. That closure landed at `6d0aab4`; the
class still live at HEAD is the URL userinfo span, which `SCHEME_USERINFO` and
`BARE_USERINFO` both miss because both are `@`-anchored.

Out of scope: the quadratic in `redactUrl`, the 4096-byte window itself, and any
change to `bodyExcerpt`'s truncation arithmetic.

## Tasks

### Task 1: Export `bodyExcerpt` so its falsifier can run at unit level

- **Files:** cadence-core/bin/review-provider.mjs
- **Action:** Make `bodyExcerpt` an export, matching the plain `export function`
  form the file's other pure helpers already use (`resolveTimeoutMs`,
  `validateFindings`, `estimatePromptTokens`) rather than the
  `__setTransportForTests` test-hook spelling, which is reserved for the
  transport seam. Per D-09 it is the only private pure helper with test value.
  This task changes NOTHING but the export keyword and the comment recording why
  it is exported. That constraint is load-bearing for Task 4: the EXP-02
  falsifier's re-watch recipe copies this file into the `ae73dd6` checkout, and
  that copy is only honest while this file carries no part of the repair. Do not
  touch the `windowed`, `room`, `lastSpace` or truncation arithmetic here or in
  any later task of this plan (D-01, D-02).
- **Verify:** `node --input-type=module -e "import('./cadence-core/bin/review-provider.mjs').then(m => { if (typeof m.bodyExcerpt !== 'function') process.exit(1); })"` exits 0 from the repo root, and `node --test cadence-core/bin/review-provider.test.mjs` still passes with no test changed.

### Task 2: Close the unterminated URL-userinfo span in `redact-url.mjs`

- **Files:** cadence-core/bin/lib/redact-url.mjs
- **Action:** Extend `redactUrl`'s two rules so a userinfo span whose `@` was cut
  off by a bounded window is redacted, by adding end-of-input-anchored
  alternatives for both the scheme-anchored form (rule 1, `SCHEME_USERINFO`) and
  the scheme-less form (rule 2, `BARE_USERINFO`). The terminated `@`-anchored
  forms are tried FIRST, exactly as `CRED_VALUE`'s four quoted alternatives in
  this same file order theirs, so a well-formed body is untouched and the worst
  an unterminated tail costs is over-redaction, never a leak. Keep the existing
  character classes' exclusions - the `/` exclusion is what stops
  `https://example.com:8080/path` from reading as userinfo, and the colon is
  still the discriminator that separates a credential from an address. Keep the
  linear-time property the file's own header pays for: one bounded quantifier per
  alternative, no nested quantifier that can backtrack quadratically, because
  this runs against a provider-controlled body up to the response ceiling.
  `redactUrl` stays URL POSITION ONLY - the statement at `issue-check.mjs:41-47`
  and the `redactCredentials and redactUrl each keep their own coverage` fixture
  both depend on it, so a `key=sk-live-abc123` pair must still pass through
  untouched. Record in the rule comments what the anchor is for and what it
  costs, in the voice the `CRED_VALUE` block already uses: these comments are the
  design record that stops the next reader re-breaking it. Do not touch
  `redactCredentials`, and do not re-sanitize anything in `review-provider.mjs`
  (D-03: the surviving fragment carries no `@`, so a second pass matches nothing).
- **Verify:** From the repo root, a node one-liner importing `redactUrl` and
  `bodyExcerpt` shows a 4096-plus-byte body whose URL userinfo span straddles the
  window edge returning an excerpt containing no byte of the planted secret,
  while `redactUrl('https://example.com:8080/path')` and
  `redactUrl('see https://example.com:8080/path for more')` both come back
  byte-identical. `node --test cadence-core/bin/redact-url.test.mjs` and
  `node --test cadence-core/bin/review-provider.test.mjs` both pass unchanged -
  including the two truncation fixtures still asserting `=== MAX_HTTP_BODY_BYTES`
  and the proxy-page excerpt still matching `504 Gateway Time-out`.

### Task 3: Unit cover for the new alternatives and their boundary

- **Files:** cadence-core/bin/redact-url.test.mjs
- **Action:** Add `redactUrl` cases beside the existing ones, in the same
  commented style: the positive class - a scheme-anchored and a scheme-less
  userinfo span cut before its `@` at end-of-input, each asserting the secret
  value is gone and `<redacted>` is present - and the boundary the phase's AC3
  names, `https://example.com:8080/path` byte-identical both mid-body and as the
  whole input. Add the negative that keeps the export split honest: a
  `name=value` credential pair is still `redactCredentials`' job and comes back
  untouched from `redactUrl`. Reuse the file's existing `assertClean` helper
  rather than writing a second leak assertion. Do not weaken or delete any
  shipped negative fixture to make a new alternative fit - the scp remote, the
  email trailer and the no-URL push failure are the counter-rail this rule is
  paid for, and if one of them reddens the regex is wrong, not the fixture.
- **Verify:** `node --test cadence-core/bin/redact-url.test.mjs` passes with
  every pre-existing test present and unmodified, and `git diff` on that file
  shows additions only.

### Task 4: The EXP-02 falsifier at both parametrizations

- **Files:** cadence-core/bin/review-provider.test.mjs
- **Action:** Add the EXP-02 falsifier beside the existing
  `bound: a credential straddling the sanitize window does not reach the
  envelope` fixture, driven through the now-exported `bodyExcerpt` so the check
  is unit-level (D-09). Two parametrizations in one family (D-08): #215's own,
  and a high-magnitude body that put at least 900 bytes of the planted value into
  the returned excerpt before the fix - both built so the userinfo span's `@`
  falls outside the 4096-byte window and so sanitizing the prefix compresses it
  to just past the cap, which is the arithmetic that skips the `clean <= room`
  whitespace safeguard. Assert the returned excerpt contains no byte of the
  planted value and is still within the cap. Head the family with a
  `WATCHED FAILING AT ae73dd6` block in the form the `RVP-02 falsifier` block
  lower in this same file already uses: the observed failure output, what it
  proves, and a re-watch recipe naming `git worktree add --detach`, the files to
  copy into that checkout (this test file AND `cadence-core/bin/review-provider.mjs`,
  whose only change in this plan is Task 1's export), and a `--test-name-pattern`
  scope so the other cases that redden there are not mistaken for the watched
  failure. Record the measured pre-fix leak magnitude from that run rather than
  restating the figure from #215. Do not relax either truncation fixture to `<=`
  (D-02) and do not touch the window (D-04).
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` passes at
  HEAD. Re-run in a detached worktree at `ae73dd6` with only the two named files
  copied in and the family's `--test-name-pattern` applied: it FAILS there on its
  own assertions, naming the planted value in the excerpt. Then
  `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Notes

- D-13 (mechanics): this plan edits code the BLOCKING `risk_surface` detector
  matches - `lib/risk-diff.mjs`'s `secrets` category fires on a credential-named
  assignment, and its `auth` category on an `Authorization: Bearer` literal, both
  of which are this plan's subject matter rather than a new exposure. Budget the
  blocking round and record the outcome or the override; the fire is expected,
  not a surprise.
- The falsifier's re-watch is the only place the pre-fix leak magnitude is
  measured. If it comes back under 900 bytes, that is a finding about the fixture
  construction, not licence to lower the acceptance criterion.
