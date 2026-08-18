# Phase 1: What a wrong answer destroys - Context

Gathered: 2026-08-18
Feeds: /cad-plan 1

## Scope boundary

In: EXP-02 - `bodyExcerpt` stops returning a window-edge-truncated credential
in a provider failure excerpt, closed at the sanitizer root in
`cadence-core/bin/lib/redact-url.mjs`. PHS-01 - `cad-phase remove` refuses a git
state it could not read instead of classifying it as clean, at both the
pre-flight read (`uncommittedUnder`) and the `rmSync` recursive fallback.

Out: `redactUrl`'s quadratic and the 4096-byte sanitize window it forces (the
"better repair" the capture queue names, measured 5.1 s for 80 KB) - it stays a
separately tracked open item. The `risk_surface` detector's inability to tell
"this diff touches secrets" from "this diff IS the secrets code" - a filed
proposal, not this phase. The other seven requirements of `v3.5.4`.

Deferred: None.

Plan shape: multiple plans, same phase - the two requirements share no code, no
file and no test file, so they are two independent fix sites with independent
falsifiers.

## Durable decisions

- D-01 (EXP-02): The repair lands in `lib/redact-url.mjs` as an
  unterminated-userinfo alternative ANCHORED TO END-OF-INPUT, with the
  terminated forms tried first - the same shape `CRED_VALUE` already uses. The
  `clean <= room` whitespace safeguard and `SANITIZE_WINDOW_BYTES` both stay
  untouched. The class still live at HEAD is a URL userinfo span cut before its
  `@`, not a quoted `name:value` pair; the quoted class was already closed at
  `6d0aab4`. Evidence: `cadence-core/bin/lib/redact-url.mjs:61,71` - both
  `SCHEME_USERINFO` and `BARE_USERINFO` are `@`-anchored, so a span whose `@`
  falls outside the window matches nothing; `v3.5.3 phases/3/SUMMARY.md:125` -
  both reverted attempts "targeted the whitespace safeguard, which is the
  symptom"; measured 2026-08-18, the gap-bound and last-whitespace-token bands
  both overlap ordinary long bodies, so no byte or whitespace rule discriminates.
- D-02 (EXP-02): An ordinary long body still returns EXACTLY
  `MAX_HTTP_BODY_BYTES`. Both shipped truncation assertions stay `===` and are
  never relaxed to `<=`. That equality is the tripwire both reverted attempts
  tripped. Evidence: `cadence-core/bin/review-provider.test.mjs:1444-1455`
  (proxy page) and `:1457-1470` (1 MiB flat body); measured 2026-08-18, the
  naive always-trim variant collapses them to 45 and 15 bytes respectively and
  loses `504 Gateway Time-out`.
- D-03 (EXP-02): Re-sanitizing the cut `head` after truncation is REJECTED as
  the repair. The surviving fragment carries no `@`, so a second `redactUrl`
  pass matches nothing. Evidence: `cadence-core/bin/review-provider.mjs:648-650`
  states sanitize-before-the-cut, never after; the fragment is present in
  `clean` itself, post-sanitization.
- D-04 (EXP-02): Deleting the sanitize window - the repair that would remove
  this hole and the quadratic together - is OUT of this phase and stays a
  separately tracked item. Evidence: `cadence-core/bin/review-provider.mjs:300-303,
  655-675`; `review-provider.test.mjs:1457-1470` reddens by TIMING OUT if the
  window is removed; `CAPTURE.md:291`.
- D-05 (PHS-01): "Not a git repository" stays a PERMISSIVE answer - empty array,
  delete proceeds. Only a failure that is not that case may refuse. Evidence:
  `cadence-core/bin/planning.mjs:4183-4185` states it; `renumberTree()` at
  `planning.test.mjs:3569` is a bare `mkdtemp` tree with no repo and backs
  eleven remove fixtures, only `:3839` builds a real one.
- D-06 (PHS-01): The classifier is a FILESYSTEM probe - walk up from `cwd` for a
  `.git` entry - not git's exit code and not its stderr text. `.git` present
  while git reports no repository means unreadable. Evidence: measured
  2026-08-18 on git 2.55.0, a `.git` at mode 000 makes both
  `git status --porcelain --ignored` and `git rev-parse --git-dir` exit 128 with
  `fatal: not a git repository`, byte-identical to a genuine non-repo, while
  `existsSync('.git')` is still true; in-tree precedent `gitIgnoreState` at
  `planning.mjs:2752-2762`; `review-provider.mjs:278-282` bans a diagnostic
  string deciding control flow. This also settles the analyzer's one research
  topic - git-version and platform behaviour cannot reach a probe that never
  reads git's answer.
- D-07 (PHS-01): The same classifier gates the `rmSync` recursive fallback, not
  only the pre-flight read. It is a second, independent fail-open on a git
  failure and it is the actual destructive act the phase goal names. Evidence:
  `cadence-core/bin/planning.mjs:4398-4402` -
  `try { git rm -r -q } catch { rmSync(..., { recursive: true }) }`; the guard
  at `:4290-4297` is the only current caller of `uncommittedUnder`.

## Decisions

- D-08 (EXP-02): The fix is sized to the CLASS, not to the ~36-byte figure in
  #215. The fixture family carries a high-magnitude case alongside the issue's
  own. Evidence: measured 2026-08-18, a single crafted body puts 978 bytes of
  the planted secret inside the returned excerpt at gap 2684; a 10,201-case
  sweep leaks on 21 bodies.
- D-09 (EXP-02): `bodyExcerpt` gains an export so its falsifier is a unit-level
  check. Evidence: it is private at `review-provider.mjs:682` while every other
  pure helper with test value is exported (`resolveTimeoutMs:317`,
  `validateFindings:959`, `estimatePromptTokens:374`); the existing window-edge
  fixture at `review-provider.test.mjs:1627-1647` reaches the arm only through
  `runFaked` with a 4 KB body tuned to a ~4:1 compression ratio.
- D-10 (EXP-02): The falsifier's `WATCHED FAILING AT` header names `ae73dd6` or
  an earlier sha - the leak reproduces against the working tree unmodified.
  Evidence: reproduction ran against `lib/redact-url.mjs` as committed at
  `ae73dd6`; convention and re-watch recipe at `v3.5.3 phases/3/SUMMARY.md:189-208`.
- D-11 (PHS-01): The refusal is a NEW named reason distinct from
  `uncommitted-work`, carrying its own hint, and fires on `--dry-run` as well as
  apply. `uncommitted-work`'s detail promises "commit or discard them first",
  which is the wrong remedy for a git that could not answer. Evidence: the guard
  at `planning.mjs:4290-4297` already sits above the dry-run return at `:4383`;
  the workflow shows the dry-run at its confirmation gate,
  `cadence-core/workflows/phase.md:45-57`.
- D-12 (PHS-01): The falsifier builds a real repo and makes its git state
  unreadable via mode bits, carrying the established root skip. Evidence:
  real-repo fixture at `planning.test.mjs:3839-3855` with
  `GIT_CONFIG_GLOBAL=/dev/null` isolation; skip guard at `:3890-3892`,
  `process.getuid() === 0 ? 'root bypasses mode bits' : false`.
- D-13 (mechanics): Both halves edit code the BLOCKING `risk_surface` detector
  matches, so this phase's own gate fires on its fix commits. Budget the round
  and record the outcome/override rather than treating the fire as a surprise.
  Evidence: `cadence-core/bin/lib/risk-diff.mjs:106` (`Authorization: Bearer`
  content signal) and `:133-137` (`rmSync|unlinkSync|rimraf` recursive-delete
  signal); `route-table.json:52` has `risk_surface: "blocking"` at `shipped`;
  precedent at `v3.5.3 phases/3/SUMMARY.md:127-129`.

## Acceptance criteria

- [ ] AC1: A response body carrying a URL userinfo span whose `@` falls outside
      the 4096-byte sanitize window yields an excerpt containing no byte of the
      planted secret value, checked at both #215's own parametrization and a
      high-magnitude case that leaked at least 900 bytes before the fix.
- [ ] AC2: `node --test cadence-core/bin/review-provider.test.mjs` passes with
      both truncation fixtures still asserting `=== MAX_HTTP_BODY_BYTES`, and
      the proxy-page excerpt still contains `504 Gateway Time-out`.
- [ ] AC3: `redactUrl` returns `https://example.com:8080/path` unchanged both
      mid-body and at end-of-input - the end-of-input anchor does not turn a
      port into userinfo.
- [ ] AC4: `phase remove` run against a phase directory whose `.git` is
      unreadable returns a failure whose reason is not `uncommitted-work`, on
      both `--dry-run` and apply, and `phases/<N>/` still exists afterwards.
- [ ] AC5: `phase remove` run in a directory that is not a git repository at all
      still succeeds and removes `phases/<N>/`; the existing renumber fixtures
      pass unchanged.
- [ ] AC6: EXP-02 and PHS-01 each carry a check with a `WATCHED FAILING AT <sha>`
      header whose sha resolves to a real commit preceding the fix, and that
      check fails when re-run against that commit's tree.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and
      `node cadence-core/bin/self-verify.mjs` both exit 0.

## Flagged assumptions

None - all assumptions confirmed.
