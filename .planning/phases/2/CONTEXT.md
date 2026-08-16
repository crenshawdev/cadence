# Phase 2: The seams that fail quietly - Context

Gathered: 2026-08-15
Feeds: /cad-plan 2

## Scope boundary

In: `lib/milestone-prune.mjs` reads a whole requirement-bullet SPAN in both the
`## Active` removal and `archiveRequirements`, so a wrapped bullet leaves no
orphaned continuation lines and its archived row's parenthetical is a complete
clause. `issue-check.mjs` resolves the tracker by shared registrable domain
rather than by origin-URL host equality, so a Forgejo remote whose SSH endpoint
differs from its web host reports instead of skipping. Serves PRN-01 and TRK-01.

Out: phase 1's `git.auto_close` two-boolean work (complete, separate files).
The `tea` 50-row page clamp is worked around, not fixed - see D-08. The write
face of `config.mjs set` (phase 1 D-05, still deferred). The two `## Shipped`
rows already broken by unescaped pipes (`CFG-01`, `RVW-01`) are NOT repaired
here; the phase stops the bleeding and leaves the existing scars.

Deferred: None.

Plan shape: one plan. The two requirements touch disjoint files
(`lib/milestone-prune.mjs` vs `issue-check.mjs` + `lib/issue-decision.mjs`) with
no shared surface.

## Durable decisions

- D-01 (Bullet span): the span is the lead `- **ID**:` line plus every
  following non-blank line beginning with whitespace; a blank line or a
  column-0 line ends it. Measured 2026-08-15 over the 4 bullets in
  `.planning/REQUIREMENTS.md` `## Active`: spans of 12, 9, 14 and 10 physical
  lines, zero blank lines inside a span, zero column-0 continuations. All four
  wrap, so the wrapped path is 100% of this corpus. The section's trailing
  paragraph (`.planning/REQUIREMENTS.md:64-65`) sits at column 0 after a blank
  line and must survive. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:519-521` (indented lines are "a
  sub-bullet or continuation", and an indented bullet marker is already reported
  as out-of-grammar, so nested sub-lists are not a shape this grammar preserves).
  If wrong: the prune eats the section's closing prose paragraph on the very
  next close, or stops one line short and leaves exactly the orphan fragments
  this phase exists to remove.
- D-02 (Bullet span): the span reader replaces milestone-prune's hand-rolled,
  fence-blind `## Active` bound with the exported fence-aware `sectionSpan`.
  Evidence: `cadence-core/bin/lib/milestone-prune.mjs:140-145` (fence-blind
  `findIndex` start and `/^## /` end), `cadence-core/bin/lib/planning-files.mjs:1323`
  (`sectionSpan` exported), `:557-563` (`classifyActiveSection` uses it because
  "a start found fence-blind cannot be repaired by a fence-aware end"; its
  header records D-12, where a fenced `## Active` in the shipped
  `templates/REQUIREMENTS.md` made the reader declare the template's own
  example ids).
  If wrong: two readers of the same section disagree about where it is - the
  audit classifier skips a fenced example the prune deletes from, so a
  template-shaped project has bullets removed out of a code fence.
- D-03 (Bullet span): the lead-line match stays milestone-prune's narrow
  `^- \*\*<ID>\*\*:\s*(.*)$`, NOT the checkbox-tolerant `ACTIVE_BULLET`.
  Evidence: `cadence-core/bin/lib/milestone-prune.mjs:148` vs
  `cadence-core/bin/lib/planning-files.mjs:291` (`ACTIVE_BULLET` reads any bold
  span as an id, so `- **Note**:` declares `Note`), and that file's header rule
  that the classifier "REPORTS lines outside this grammar, it never widens it
  (phase-5 D-05)".
  If wrong: the wide form deletes a `- **Note**: scope frozen` prose bullet
  whose id happens to be in `completed`. Keeping the narrow form leaves a
  `- [x] **ID**:` bullet untouched, which is today's behaviour and not a new
  regression.
- D-04 (Archived parenthetical): a `|` inside the span is escaped as `\|` (GFM)
  before it is written into the table cell, so the row keeps exactly five pipes
  and the cell still renders the character. Evidence:
  `cadence-core/bin/planning.mjs:4053-4056` already refuses a `|` in `--label`
  for the stated reason that it "is written into a REQUIREMENTS.md table cell" -
  the identical hazard, one interpolation over, guarded on one side only. Two
  tracked rows are already broken by it (`CFG-01` carries
  `globalValue || {}`, `RVW-01` carries `review.mode: panel|single`, giving 7
  and 6 pipes against the table's 5), and the `PRN-01` bullet now in `## Active`
  itself contains 2 pipes, so the row archiving this very fix breaks the table
  on the close that ships it.
  If wrong: every wrapped bullet quoting a config union or a markdown row
  silently shifts the Shipped table's columns, and `Milestone` reads `Complete`.
- D-05 (Archived parenthetical): the seam does NOT lowercase the span's first
  letter - the archived text is byte-faithful to the bullet. Chosen against the
  hand-repair precedent: `2b512fa` changed `(An executable risk-check seam...`
  to `(an executable...`, and every existing fixture summary is lowercase
  (`cadence-core/bin/milestone-prune.test.mjs:45-47`). The heuristic that would
  match those repairs mangles a span whose first word is a proper noun or an
  identifier, and that is the worse failure.
  If wrong: AC3 is judged unmet on a capitalization the seam deliberately left
  alone - a one-line change to the assertion, not a redesign.
- D-06 (Tracker resolution): the ROADMAP's first named mechanism - "consulting
  `tea login list`'s `SSH HOST` column" - CANNOT satisfy the goal on this
  repository, because that column is already read and does not name the origin
  host. Measured 2026-08-15: `tea login list` reports `ssh_host`
  `git.jcrenshaw.dev` for login `git.jcrenshaw.dev`, while the origin is
  `ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git`. No field names
  `ssh.jcrenshaw.dev`. Evidence: `cadence-core/bin/issue-check.mjs:135` (the
  column is already collected). This corrects both `.planning/ROADMAP.md:148-150`
  and the phase-1 `.planning/CAPTURE.md` note, which each offer that column as a
  working option.
  If wrong: the phase implements the mechanism the roadmap names, the suite goes
  green on a stub whose `ssh_host` was authored to match, and this repository
  still skips - the exact invisible failure the phase exists to remove.
- D-07 (Tracker resolution): the seam calls `tea --repo <owner>/<name>` ONLY
  when the origin host and some login share a registrable domain; a remote
  sharing no registrable domain with any login keeps today's skip. Measured
  2026-08-15 with two logins configured (`git.jcrenshaw.dev`, `codeberg.org`,
  both `default: false`): `tea issues list --repo forgejo/forgejo` - a repo that
  exists on Codeberg and not on the Forgejo - still resolved to
  `git.jcrenshaw.dev`, the FIRST login in `~/.config/tea/config.yml`, and exited
  1 with empty stdout. tea's `--repo` fallback is config-FILE-ORDER, not
  repo-aware. The stderr `NOTE: no login matched this repository` cannot serve
  as the guard because it fires for this repository too. The registrable domain
  is what separates the two cases: `ssh.jcrenshaw.dev` and `git.jcrenshaw.dev`
  share `jcrenshaw.dev`; `bitbucket.org` and `git.jcrenshaw.dev` share nothing.
  A shared-public-suffix guard is required so `github.io` does not count as a
  match.
  If wrong: an unguarded fallthrough queries whichever login sits first in the
  user's config, and if that server has a repo at the same `owner/name` slug it
  returns exit 0 with real JSON - another project's issues reported as this
  one's, silently. That is the failure class this phase is named after, and
  `cadence-core/bin/issue-check.mjs:31-38` was written to prevent it.
- D-08 (Criterion 6): the tracker report is produced with `--state open` plus a
  per-issue `tea issue <index> --repo <slug>` resolve for referenced non-open
  numbers, NOT by paging the full list. Measured 2026-08-15: the full list
  clamps server-side at 50 rows (`--limit 50`, `--limit 100` and `--limit 200`
  each returned exactly 50; the tracker holds 180+), and Codeberg - a different
  instance under different administration - clamps identically at 50 for
  `--limit 200`. `--state open` returned 19 rows here, a complete read.
  `cadence-core/bin/lib/issue-decision.mjs:93` (`normalizeList`) turns
  `records.length >= limit` into an incomplete read by design, so the clamp is
  why classification alone still prints a skip line on this repository. Paging
  was rejected: it widens the seam past its stated ONE bounded call per land and
  puts more network latency on the land path.
  If wrong: the phase ships a green suite, a correct classification and a UAT
  step that still prints a skip line on the repository AC6 names.

## Decisions

- D-09 (Archived parenthetical): the parenthetical is the whole span joined on
  single spaces with no length cap. Evidence: the v3.5.0 prune commit `d6dfd2e`
  wrote the truncated `| RSK-01 (An executable risk-check seam under
  \`cadence-core/bin/\` answers a) |` and the repair `2b512fa` replaced it with
  the full 329-character joined span; across the 118 parenthesized rows in
  `.planning/REQUIREMENTS.md` the lengths run min 41, median 123, max 2165, so
  long rows are already the tracked convention.
- D-10 (Tracker resolution): `no-login` survives as the answer for an empty
  login list and `unrecognized` for `tea` absent. Both discriminations are
  structural rather than host-equality, so a registrable-domain gate leaves both
  matrix rows intact and reason-unique. Evidence:
  `cadence-core/bin/issue-check.test.mjs:252-255` (`bare: true`), `:258-261`
  (`login: '[]'`), `:305-307`.
- D-11 (Cost surfaces): neither requirement moves a config key, a CONTRACTS row
  or a flag list. Evidence: `cadence-core/bin/self-verify.mjs:342-345`
  (`issue-check` row is `{'*': ['--dir'], check: ['--base','--timeout-ms']}`),
  `:251` (`milestone-prune` is `['--label','--mode']`). Phase 1 D-15 fires only
  on a new script or subcommand, D-03 only on a new key. If the per-issue
  resolve of D-08 needs a bound, it is a named constant beside
  `DEFAULT_TIMEOUT_MS` (`cadence-core/bin/issue-check.mjs:77`), not a key.
- D-12 (Regression cover): the TRK case is a new case in the existing
  PATH-injected stub harness with the stub login's `ssh_host` deliberately
  DIFFERENT from the origin host, carrying the `$CAD_SPAWN_MARKER` assertion
  (phase 1 D-08). Evidence: `cadence-core/bin/issue-check.test.mjs:153-154` -
  the current forgejo happy path uses origin
  `ssh://git@forge.example.com:2222/org/repo.git` against logins whose `name`,
  `url` host and `ssh_host` are all `forge.example.com`, so the ported and
  scp-shaped URLs are covered and the differing-host shape is not. That is why
  the suite is green while this repository skips.
- D-13 (Prose surfaces): `skills/cad-land/SKILL.md` states host detection as
  login-name equality in two places and must change with the seam. Evidence:
  `skills/cad-land/SKILL.md:33` ("any other host where the `tea` CLI has a
  matching login ... (`tea login list` names the host)"), `:73` (the Open MR/PR
  option is absent for "an unrecognized host with no `tea` login", so today this
  repository also loses its publish option for the same reason),
  `.planning/DOCS-CLAIMS.md:979` (README-85 claims the report names issues "on
  the host the origin points at").

## Acceptance criteria

- [ ] AC1: Against a fixture whose `## Active` bullets wrap, `milestone-prune`
      removes each completed bullet's whole span - lead line plus indented
      continuations - leaving no orphaned prose lines, leaving the section's
      trailing column-0 paragraph intact, and treating a `## Active` heading
      inside a code fence as not the section. Failing-capable against the
      current implementation.
- [ ] AC2: An archived `## Shipped` row's parenthetical is the whole span joined
      on single spaces, byte-faithful with no lowercasing, and any `|` escaped
      as `\|` so the row keeps exactly five pipes. Proved on a fixture whose
      bullet contains a `|`.
- [ ] AC3: Running the prune against a copy of this repository's actual
      `REQUIREMENTS.md` produces a file needing no hand repair: zero orphaned
      continuation lines, every archived row five-piped, every parenthetical a
      complete clause.
- [ ] AC4: `issue-check.mjs` reports for a remote whose SSH host differs from
      its web host but shares a registrable domain with a login, and skips with
      the existing reason for a remote sharing no registrable domain with any
      login. Both failing-capable via the PATH-injected stub harness with the
      `$CAD_SPAWN_MARKER` assertion that no forge CLI ran.
- [ ] AC5: The five genuine degradations are unchanged and reason-unique: no
      remote, unrecognized host, missing CLI, no login, nonzero exit.
- [ ] AC6: On this repository, `/cad-land`'s tracker step reports the issues
      this branch references instead of printing a skip line.
      (human-verify: needs live git.jcrenshaw.dev tracker)
- [ ] AC7: `node --test 'cadence-core/bin/*.test.mjs'` and
      `node cadence-core/bin/self-verify.mjs` both run clean.

## Flagged assumptions

- tea's multi-login `--repo` resolution is config-FILE-ORDER on tea 0.15.1 with
  two logins, both `default: false` - measured 2026-08-15. Whether a login
  marked `default: true` wins over file order, and whether the order rule holds
  across tea versions, is unverified. Confident for the measured shape; if wrong
  the registrable-domain gate of D-07 still holds, because it refuses the call
  rather than trusting tea's pick.
- Whether the 50-row clamp is a Gitea/Forgejo server setting
  (`MAX_RESPONSE_ITEMS`) or a `tea` client cap is unresolved: two independent
  instances both cap at 50, which is consistent with either. Likely; if wrong,
  only the wording of the truncation diagnostic changes, not D-08's mechanism.
- The public-suffix guard D-07 requires has no chosen implementation - a
  vendored PSL is out of proportion for a zero-dep repo, so the planner picks
  between a small denylist of known hosting suffixes and a rule requiring the
  shared domain to be the last two labels with the login's host non-public.
  Unclear; if wrong, a `github.io`-shaped pair matches when it should not.
- `tea issues list` returns `index` as a STRING while `tea issue <index>`
  returns it as a NUMBER - measured 2026-08-15. The per-issue resolve of D-08
  must normalize before comparing against the `#N` references parsed from
  commits. Confident; if wrong, every referenced issue reads as not-found.
- Whether `glab` and `gh` have an equivalent host/endpoint split worth covering
  is unknown - `glab` is absent from this machine (phase 1 D-08), so its
  behaviour is knowable only from published docs. Unclear; if wrong, the same
  false skip survives on GitLab and is found by a future user rather than here.
