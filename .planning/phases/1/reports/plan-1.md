PLAN COMPLETE
Plan: .planning/phases/1/PLAN-1.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1. Export `bodyExcerpt` so its falsifier can run at unit level | 63fb7e7 | Export keyword plus the comment recording why; no other byte of `review-provider.mjs` touched, which is what makes task 4's re-watch copy honest. Import probe exits 0; `review-provider.test.mjs` 70/70 with no test changed. |
| 2. Close the unterminated URL-userinfo span in `redact-url.mjs` | 534a5b3 | Two end-of-input alternatives, `SCHEME_USERINFO_CUT` and `BARE_USERINFO_CUT`, applied AFTER the two terminated rules. Rule 1b needs no colon (a password-less PAT cut before its `@` is byte-for-byte a plain host); rule 2b keeps rule 2's colon. Both classes additionally exclude `"`/`'` so a JSON body's own `..."secret":"hunter2"}}` tail is not read as one userinfo span. `redactUrl('https://example.com:8080/path')` byte-identical whole-input and mid-body; `redact-url.test.mjs` 17/17 and `review-provider.test.mjs` 70/70 unchanged, both truncation fixtures still `=== MAX_HTTP_BODY_BYTES` and the proxy excerpt still carries `504 Gateway Time-out`. |
| 3. Unit cover for the new alternatives and their boundary | 79923e6 | Three cases added, `assertClean` reused, `git diff --numstat` 53/0 - additions only, every shipped negative fixture untouched. 20/20. |
| 4. The EXP-02 falsifier at both parametrizations | 5af7158 | Two tests under one `EXP-02` `--test-name-pattern` (two tests, not two halves: a single test stops at its first failed assertion and the second magnitude would never be observed at the watched sha). `bodyExcerpt` read off the existing namespace import so the older RVP-01/RVP-02 re-watch recipes, which copy only the test file, keep loading. Watched failing at `ae73dd6` in a `git worktree add --detach` checkout with `review-provider.test.mjs` and `review-provider.mjs` copied in: 73 bytes of the planted value on #215's shape, 985 on the high-magnitude one, both `!== 0`, exit 1. Green at HEAD. Suite 2169 pass / 0 fail / 1 skipped; `self-verify` `ok:true`; `tsc -p tsconfig.ci.json` exit 0. |

Deviations:
- [deviation] The plan and AC1 name "#215's own parametrization" as one of the two
  fixtures. #215's own body is not recoverable from this tree: the `v3.5.3`
  phase-3 artifacts were pruned at `bc04ef6` and what survives is the ROADMAP's
  magnitude alone ("measured at ~36 bytes of secret on the fire's own
  scenario"). What I did: built parametrization one as the URL-position twin of
  the fire's surviving quoted-value fixture (`review-provider.test.mjs`, the
  77x48-byte 4:1-compressible prefix), which is the same construction and the
  same order of magnitude, and recorded its MEASURED figure at `ae73dd6` - 73
  bytes - rather than restating the issue's ~36. The class, not the figure, is
  what D-08 sizes the fix to, and the high-magnitude case measured 985 bytes,
  clearing the >=900 bar the plan set.

Open items:
- Declined the fuller shape of an "only at a window edge" signal - a `windowed`
  flag, an options object or a second exported entry point that would apply the
  unterminated rules to `bodyExcerpt`'s cut prefix alone. The plan's Verify and
  D-01 are met by the plain end-of-input anchor on `redactUrl`'s single shape,
  and nothing in this plan sets such a flag. Its stated cost is written into the
  rules 1b/2b comment: a string that ENDS in a bare `scheme://authority` comes
  back `<redacted>` (`see https://docs.example.com` at the very end of a body),
  which is deliberate because a password-less `https://ghp_token@host` cut
  before its `@` is byte-for-byte a plain host. Build the flag when a task
  states a caller that needs the un-anchored behaviour.
- Mechanics, not a finding (D-13): these three code commits are exactly the
  shape the BLOCKING `risk_surface` detector matches - a credential sanitizer
  and credential-named literals - so the gate firing on this range is expected
  subject matter rather than new exposure.
