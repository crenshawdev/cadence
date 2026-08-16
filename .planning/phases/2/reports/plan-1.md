PLAN COMPLETE
Plan: .planning/phases/2/PLAN.md
Tasks: 8 of 8 for the plan, plus 4 of 4 in the CUT ROUND below
| Task | Commit | Note |
|---|---|---|
| 1 Pin the wrapped-bullet prune, watched to FAIL | d54391f | 5 new arms red as predicted (orphan, parenthetical, pipe-escape, fenced `## Active`, corpus); all 22 pre-existing tests green |
| 2 Read the whole bullet span in both halves | 71ec570 | 27 tests, 3 red: the fenced arm (task 3) and the two pipe-escape arms (task 4). Corpus went green here, not at task 4 |
| 3 Bound `## Active` with the fence-aware sectionSpan | 73ec9cc | Fenced arm green; re-confirmed failing-capable against the task-2 lib before committing. Repaired one of my own task-1 assertions (substring -> line-wise) |
| 4 Escape a pipe before it reaches the Shipped cell | 6417a94 | milestone-prune 27/27; full suite 1938/1938 (baseline was 1932) |
| 5 Pin the differing-host tracker resolution, watched to FAIL | b6005f7 | issue-check 20 tests, 1 red exactly as predicted: differing-host answered `skip` / `tea holds no login for ssh.example.com`. The no-shared-domain case passed already |
| 6 Match a tea login by registrable domain | f2d4d31 | issue-decision 18/18, issue-check 20/20; task-5's differing-host case green, no-shared-domain still skipping on the existing line |
| 7 Forgejo open list + bounded per-issue resolve | c11cc8d | `MAX_RESOLVES = 5` beside `DEFAULT_TIMEOUT_MS`; `unresolved` is the new referenced-state; full suite 1946/1946, self-verify ok:true |
| 8 State the shipped host rule in cad-land's prose | 80e8c2b | self-verify ok:true with no budget-overrun, suite 1946/1946, no surviving "matching login" sentence. Budget row re-pinned 13145 -> 13179 (the plan's stated alternative arm) |

Deviations:
- [deviation] The plan's `## Must be true when done` (AC3) and task 4's Verify
  assert that over this repository's own `.planning/REQUIREMENTS.md` EVERY row
  under `## Shipped` carries exactly five unescaped pipes. Two rows already
  there carry 7 (`CFG-01`) and 6 (`RVW-01`), and the same plan and CONTEXT
  forbid repairing them ("this phase stops the bleeding and leaves the existing
  scars"), so the criterion as literally worded is unachievable in this phase.
  The corpus test asserts the five-pipe count over every row the run ADDED, and
  separately asserts that every pre-existing row survives byte-identical - so
  nothing is exempted silently and the two scars are pinned as scars.

Open items:
- AC6 (human-verify) is still owed to a human, but the seam half is now proved
  live: `issue-check.mjs check --dir /data/code/cadence --base main` against the
  real git.jcrenshaw.dev returns `action: report`, `host: ssh.jcrenshaw.dev`,
  `repo: crenshawdev/cadence`, 19 open issues on a complete read - where it
  printed `tea holds no login for ssh.jcrenshaw.dev` before. One thing the walk
  should expect: no commit on `cadence/v3.5.1` carries a `#N` reference, so
  `referenced` is legitimately empty and step 1 prints the open-list fallback
  rather than named issues. Citing #179/#180 in a commit on this branch is what
  would make the walk read the sentence AC6 describes.
- The corpus test's pipe-escape arm is vacuous on today's corpus: the only ids
  phase 1 completed (`AUT-01`, `AUT-02`) contain no `|`, so the five-pipe
  assertion over new rows passes without exercising the escape. The escape is
  proved by the WRAPPED fixture, which is where AC2 says to prove it; the corpus
  arm still bites the moment a wrapped bullet quoting a config union ships (the
  `PRN-01` bullet in `## Active` carries two pipes right now).
- Declined a configurable resolve cap and a resolve on the `github`/`gitlab`
  rows: the task's Verify turns on one constant's worth of calls on the forgejo
  row alone, D-11 forbids a config key here, and `glab` is absent from this
  machine so a gitlab resolver could not be tested. Make it settable, or widen
  it, when a task states a second value or a second host.
- The `skills/cad-land/SKILL.md` weight budget was re-pinned 13145 -> 13179
  rather than the edit being squeezed under it. The wording was tightened first
  (the `tea login list` parenthetical and "none of those" both came out, -31 B
  on that hunk); the residue is the shared-domain rule stated in two places by
  requirement plus the `unresolved` rendering in the same sentence.

---

RISK-FIX COMPLETE (blocking `risk_surface` gate on fc162e3..80e8c2b; two high
findings, both fixed; the plan report above is unchanged)

| Fix | Commit | Note |
|---|---|---|
| 1 Bind the `tea` call to the login that matched | 0d1c979 | `classifyOrigin` takes login RECORDS (`{name, hosts}`) and returns the matched login's `name` on the forgejo verdict, null elsewhere; `teaHosts` -> `teaLogins` in issue-check.mjs; the forgejo `argv`/`resolve.argv` spend it as `--login <name>`; `github`/`gitlab` unchanged and asserted to carry no `--login`. Multi-match rule: exact host before shared domain, first in reading order within each; a login with no readable name is dropped (unbindable). Cover: `classifyOrigin NAMES the matched login...` (first login unrelated -> second login's name) in issue-decision.test.mjs, and `forgejo: every call is bound with --login...` in issue-check.test.mjs, asserting all 3 argv-log lines carry `--login forge.example.com` and none mention `evil.example.net` |
| 2 Deny every ccTLD registry suffix | cfc41a6 | `PUBLIC_TWO_LABEL` grown from 9 to ~100: the `co.`/`com.`/`net.`/`org.` (and `ac.`/`ne.`/`or.`/... ) registries for za, in, kr, il, tr, mx, id, sg, th, tw, cn, nz, au, uk, jp, br, ru, ua, hk, my, ph, pl, ar, co, ng, vn, pk, plus hosting suffixes in the `github.io` class (codeberg.page, sourceforge.io, netlify.app, vercel.app, herokuapp.com, workers.dev, fly.dev, onrender.com, glitch.me). Still a frozen `Set`, no vendored PSL, denied pair still falls back to `no-login`. Cover: 12 new denied pairs incl. `git.acme.co.za` / `git.other.co.za` -> `no-login`, plus two arms proving the denial is of the SUFFIX (exact `git.acme.co.za` pair still `forgejo`, ordinary `acme.dev` pair still `forgejo`). Proved red against the pre-fix lib (1 fail, `git.acme.co.za`) |

Verify (both commits): `node --test 'cadence-core/bin/*.test.mjs'` 1948/1948 pass
(was 1946 before this fix pair), `node cadence-core/bin/self-verify.mjs`
`ok:true` with no problems, `npx tsc -p tsconfig.ci.json` clean. `stub`'s
exported signature in issue-check.test.mjs is untouched, so
`git-publish.test.mjs`'s import still binds.

Risk-fix deviations: none.
Risk-fix open items:
- `skills/cad-land/SKILL.md` and `.planning/DOCS-CLAIMS.md` were re-read and
  need no edit: both state the match rule ("names the origin host or shares its
  registrable domain"), which is still exactly true, and neither claims anything
  about how the resulting call is bound. If a future prose pass wants the
  binding stated, it is one sentence in step 1 and a budget row away.
- The denylist is curated, not exhaustive: a second-level registry outside the
  27 ccTLDs listed still reads as a registrable domain. The failure mode is
  bounded by the `--login` binding of fix 1 (the query goes to the login that
  matched, never to config order), so a miss now costs a report about a stranger
  forge rather than a silent answer from an unchecked login. A vendored PSL is
  still refused by D-07.

---

CUT ROUND (delete `classifyOrigin`'s login inference, bind by `--remote origin`)

STATUS: **COMPLETE, 4 of 4** (`20b6bd5..ce58695`). The checkpoint below was
ruled A+D, and the stop condition it names is CLEARED: the `git.jcrenshaw.dev`
login's `ssh_host` in `~/.config/tea/config.yml` now reads `ssh.jcrenshaw.dev`,
so `--remote origin` binds on this machine for the right reason - the fallback
NOTE the checkpoint measured on stderr is gone.

| Task | Commit | Note |
|---|---|---|
| 1 Delete registrableDomain / PUBLIC_TWO_LABEL / the precedence rule | 20b6bd5 | `classifyOrigin` reads the login list's LENGTH; return drops `login`; both forgejo argv drop `--login`; issue-check's login-record parsing deleted. Red exactly as predicted: issue-decision 14 pass / 7 fail, issue-check 20 pass / 3 fail, all 10 arms naming the deleted rule. tsc clean |
| 2 Bind the forgejo row with `--remote origin` | fd42f87 | Both forgejo argv (list + resolve) carry `--remote origin`; `github`/`gitlab` byte-identical. Live proof: the seam returns report / ssh.jcrenshaw.dev / crenshawdev/cadence / 26 open, and a live `tea issues 179 ... --remote origin` exits 0 with EMPTY stderr - the fallback NOTE is gone. tea's fallback limit stated in HOST_TABLE's header, not guarded. tsc clean |
| 3 Rewrite the pinned tests | c5a2f57 | 2 tests deleted (the precedence/matched-name arm, the 17-pair denylist arm), 4 rewritten to the count rule, argv assertions moved to `--remote origin` with a no-`--login` sweep over every row. New: `the github and gitlab argv are byte-identical to what they were` (whole recorded command line, both hosts). Suite 1948/1948, self-verify ok:true, tsc clean. One DEVIATION, below |
| 4 cad-land prose + weight budget | ce58695 | Both shared-domain sentences (step 1's detected host, step 3a's Open MR/PR bullet) now read "where `tea` holds a login"; the `unresolved` rendering sentence untouched; no "registrable"/"matching login" survives. The edit only removes bytes, so the budget row is re-pinned at the new exact size 13179 -> 13106, and DOCS-CLAIMS' two cad-land citations shift by the one line that came out (32-55 -> 32-54, 56-57 -> 55-56). self-verify ok:true, suite 1948/1948 incl. prose-agreement |

Deviations:
- [deviation] PLAN AC4 and CONTEXT D-07 assert that `issue-check.mjs` "still
  skips - with the existing no-login line, and with no forge CLI call beyond the
  login probe - for a remote sharing no registrable domain with any login", and
  the test `an origin sharing no registrable domain with any login skips, and
  queries nothing` pinned exactly that. The user's A+D ruling deletes the
  registrable-domain rule as unfixable without a vendored public suffix list, so
  the criterion is no longer true and the test could not be kept. Replaced by the
  two properties that ARE true: an EMPTY `tea login list` reading skips on the
  same line and queries nothing (marker + argv log), and an origin no login names
  is handed to tea bound with `--remote origin` and no login this seam picked.
  The `no-login` verdict and its reason line survive unchanged, so the five
  reason-unique verdicts (LND-01, AC5) are intact.
Open items:
- The residual risk of delegating to tea is ACCEPTED and WRITTEN DOWN, not
  guarded, per the ruling: for a user whose remote's host names no login, tea
  falls back to config order, answers exit 0 with a stranger's tracker, and says
  so only on stderr - which this seam discards by contract. The statement lives
  in `lib/issue-decision.mjs`'s `HOST_TABLE` header, where the binding happens,
  and it names the fix (a login whose `ssh_host` names the remote's host). No
  guard, denylist or host comparison was added to compensate.
- `tea issues <index> --fields index,state` does NOT filter on the single-issue
  form: measured live, it prints the whole issue including the body. Nothing of
  it reaches the envelope (`readOneIssue` reads `index` and `state` and the seam
  emits neither the text nor a `detail`), so this is a wire-size and
  third-party-bytes-in-memory observation, not a leak. Worth knowing if a future
  resolve is ever asked to report anything the CLI printed.
- The `no-login` reason line is now reachable only when `tea login list` reads
  as an EMPTY array. A tea that holds logins but serves none of this remote's
  hosts reports instead of skipping - by design after this round, and the reason
  it can be honest about that is tea's `--remote` discovery, not a rule here.
- `.planning/STATE.md` is modified in the tree and was NOT staged by me: it
  carries the orchestrator's own `/cad-plan` write (`context gathered` ->
  `planned`). Left for the orchestrator.

### Verify (this round)

- `node --test 'cadence-core/bin/*.test.mjs'`: 1948 tests, 1948 pass, 0 fail
  (same total as before the round: 2 arms deleted, 2 added).
- `node cadence-core/bin/self-verify.mjs`: `ok: true`, `problems: []`.
- `npx tsc -p tsconfig.ci.json`: clean (run after every task).
- `node cadence-core/bin/issue-check.mjs check --dir /data/code/cadence --base
  main`: `action: report`, `host: ssh.jcrenshaw.dev`, `repo:
  crenshawdev/cadence`, `ok: true`, no warnings, `detail: null`, `referenced: []`
  (no commit on this branch cites a `#N`), and a COMPLETE open read of 26 - the
  same 26 rows `tea issues list --repo crenshawdev/cadence --remote origin
  --state open ...` returns by hand.
- `stub`'s exported signature in `issue-check.test.mjs` is untouched, so
  `git-publish.test.mjs`'s import still binds (proved by the whole-suite run).

### The checkpoint this round continues from (record kept intact)

STATUS: **CHECKPOINT: structural - stopped BEFORE any edit, 0 commits.**

| Task | Commit | Note |
|---|---|---|
| 1 Delete registrableDomain / PUBLIC_TWO_LABEL / the precedence rule | none | not started |
| 2 Bind the forgejo row with `--remote origin` | none | BLOCKED - see finding |
| 3 Rewrite the pinned tests | none | not started |
| 4 cad-land prose + weight budget | none | not started |

## Why it stopped

The dispatch names this exact stop: "If `--remote origin` does not in fact bind
the login on the installed tea, STOP and report that rather than reintroducing a
host-matching rule - that is a checkpoint, not something to work around."

It does not bind on this repository. Measured 2026-08-15 against the installed
`tea 0.15.1` and the live `git.jcrenshaw.dev`, before writing any code:

1. **The flag works when the remote host matches a login.** In a scratch repo
   with `origin = ssh://git@codeberg.org/forgejo/forgejo.git`,
   `tea issues list --remote origin ...` answered from the `codeberg.org`
   login - the SECOND login in the config file - with no note and exit 0. So
   `--remote` genuinely overrides config order in the matching case, and it
   composes with `--repo <slug>`: adding `--repo forgejo/forgejo` still bound to
   codeberg. The proposed argv shape is coherent.

2. **It is a silent no-op when the remote host matches no login, which is what
   THIS repository is.** From `/data/code/cadence`
   (`origin = ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git`, and no
   login field names `ssh.jcrenshaw.dev` - D-06 measured that):

   ```
   tea issues list --repo crenshawdev/cadence --remote origin --state open \
     --fields index,state --output json --limit 50
   ```

   prints to STDERR `NOTE: no login matched this repository, falling back to
   login 'git.jcrenshaw.dev' in non-interactive mode.`, exits 0, and writes 26
   clean JSON rows to stdout. The login that answered was picked by CONFIG FILE
   ORDER, not by the remote. It is the right forge here only because the right
   login happens to be first in the user's `~/.config/tea/config.yml`.

3. **The fallback answers with a stranger's tracker, exit 0.** Scratch repo,
   `origin = ssh://git@forge.nowhere.invalid:2222/crenshawdev/cadence.git` - a
   host that does not resolve and matches no login. `--remote origin --repo
   crenshawdev/cadence` returned this repository's real open issues from
   `git.jcrenshaw.dev`, exit 0, same NOTE on stderr. That is verbatim the
   failure D-07 names ("another project's issues reported as this one's,
   silently") and the one risk-fix commit `0d1c979` was written to stop.

4. **The seam cannot see the fallback happen.** The NOTE is on stderr, and
   `run()` discards child stderr by contract, so nothing distinguishes a bound
   answer from a fallback answer inside the envelope. There is no global
   strict/no-fallback flag on tea 0.15.1 (`tea --help` lists only `--debug`,
   `--help`, `--version`), and no subcommand reports which login resolved.

So the dispatch's premise - "`tea` already answers this question itself" - holds
only for remotes whose host a login already names. For the split-endpoint shape
this whole requirement exists for, tea declines to answer and guesses. Swapping
`--login <matched>` for `--remote origin` would not delegate the binding; it
would delete it.

## What the cut still buys, and what it costs

The deletion half is sound and I have no objection to it: `registrableDomain`,
`PUBLIC_TWO_LABEL` and the precedence rule are three rounds of guessing and the
reviewer is right that a curated suffix list cannot be made correct.

The question is only what replaces the `--login` binding. Note that shipping the
cut as written does NOT break this repository today - the live check would still
return `action: report`, `host: ssh.jcrenshaw.dev`, `repo: crenshawdev/cadence`,
26 open issues - because tea's fallback lands on the correct login by config
order. It trades a curated-denylist false MATCH (the `co.ke` finding) for a
config-order false ANSWER (finding 3 above). The second is the one the blocking
gate already FAILed on once.

## Options (need a ruling)

- **A. Ship the cut exactly as specified.** Delete all three mechanisms, bind
  with `--remote origin`, accept tea's documented fallback as tea's problem. The
  seam gets much smaller and stops claiming knowledge it does not have. Cost:
  finding 3 is live for any user whose first-configured login serves the same
  `owner/name` slug. Works on this repo today, for a reason config order could
  take away.
- **A+D. Ship A, and make the binding real on this machine.** `--remote origin`
  binds correctly the moment the `git.jcrenshaw.dev` login also names
  `ssh.jcrenshaw.dev`. That is a user-side edit to `~/.config/tea/config.yml`
  (or `tea logins edit`); `tea logins add` has no `--ssh-host` flag, and that
  file holds tokens, so it is not mine to touch. This is the only shape where
  the delegation is honest AND this repository binds for the right reason.
- **B. Cut the domain math but keep a STRUCTURAL guard**, e.g. call only when
  the reading names exactly one login (then config order is unambiguous and a
  wrong forge exits nonzero). Zero host comparison. Cost: this repository has
  two logins, so it would go back to skipping - it fails the requirement.
- **C. Keep `--login`, delete only the domain/denylist machinery**, and let the
  match be exact-host-equality again (v3.4.0's rule) with `no-login` otherwise.
  Safe and honest, but it is the shipped behaviour that never once matched this
  repository - i.e. it un-does the phase.

Recommendation: **A+D** if the user will make the one-line tea config edit,
otherwise **A** with finding 3 recorded as a known limit of delegating to tea.
No option other than A/A+D leaves the requirement met without a host rule.

Nothing was edited or committed in this round. The tree is at `cfc41a6`.
