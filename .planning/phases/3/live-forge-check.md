# Phase 3, task 8: the write proved against all three forges, live

**STATUS: PROCEDURE WRITTEN, RESULTS PENDING.** Nothing below the
`## Recorded` heading has been observed yet. This file is uncommitted until the
operator runs the three filings and the results are recorded; a transcript that
claims a run it did not make is the one failure this task exists to prevent.

Tasks 1-7 prove the argv against PATH-injected stubs, which proves the argv and
not the forge. This proves it against the real thing on all three providers.

## What is being settled here, and why a stub cannot settle it

| Question | Why no test in tasks 1-7 answers it |
|---|---|
| Does a forge CREATE `cadence-declined` on the create call, or refuse a label it does not already hold? | Unobtainable without a live create. `lib/filing-decision.mjs`'s `FILING_TABLE` header states it as open and points here. |
| Does a successful create really print nothing machine-readable? | Task 2 pinned that reading off each CLI's `--help`. Only a live create shows what the CLI actually writes to stdout. |
| Does a gate arm REACH the ask at all, inside the step that decided, before that step ends? | Tasks 1-5 prove the seam's argv and the reference's prose. Neither proves a firing site reaches either. A fire that never asks is invisible to every test in this plan. |
| Does five findings produce ONE ask step? | The stubs prove ONE list call per fire. They cannot prove the ask was not split into five prompts by the model driving it. |

## Preconditions the operator owns

- Three scratch repositories, one per provider, none of them this one, each
  owned by the operator.
- `tea`, `gh` and `glab` authenticated against their respective instances.
  Measured on this machine 2026-08-25: tea 0.15.1, gh 2.98.0, glab 1.114.0.
- For each run, `.claude/settings.json` (or the repo config layer) in the
  scratch repository carries `git.forge_provider`, `git.forge_repo` and
  `git.forge_host` for that provider - `issue-filing.mjs` reads exactly those
  three through `mergeLayers` and refuses `no-forge` without them.

## The five-finding fire

The same payload for all three runs, so the three transcripts are comparable.
Five findings, all ruled `downgraded`, so all five reach the ask; three accepted
and two declined.

Build both payload files:

```
node - <<'EOF'
import { writeFileSync } from 'node:fs';
const claims = [
  'the retry loop has no ceiling, so a flapping endpoint spins forever',
  'the temp file is created before the permission check, not after',
  'the parser accepts a duplicate key and keeps the last one silently',
  'the cache key omits the locale, so two locales share one entry',
  'the timeout is documented as seconds and passed as milliseconds',
];
const findings = claims.map((c, i) => ({
  file: `src/mod-${i + 1}.mjs`, line: 10 + i, severity: 'medium',
  claim: c, failure_scenario: `what breaks: ${c}`,
}));
const payload = { voices: [{ voice: 'sonnet', model: 'claude-sonnet-4-5',
  returned: { findings },
  rulings: findings.map((f, i) => ({ finding: i, ruling: 'downgraded',
    claim: f.claim, failure_scenario: f.failure_scenario })) }] };
writeFileSync('/tmp/live-payload.json', JSON.stringify(payload, null, 2));
const { unfixedFindings } = await import(
  '/code/cadence/cadence-core/bin/lib/filing-decision.mjs');
const sel = unfixedFindings(payload);
writeFileSync('/tmp/live-dispositions.json', JSON.stringify(
  { entries: sel.findings.map((f, i) => ({ finding: f,
    disposition: i < 3 ? 'accept' : 'decline' })) }, null, 2));
EOF
```

Verified 2026-08-25 against `lib/filing-decision.mjs`: `unfixedFindings` selects
all five, and the two declined findings fingerprint to `1e20a4c96da309d2` and
`de3dd594e6372bfc`. Those two tokens are what the second `unfixed` must NOT
return.

## The run, per provider

Two of the three are driven by the subcommands directly. ONE - the operator's
choice, recorded below - is driven by a REAL FIRE instead, because criterion 1
says "verified by running a gate that produces them".

### The two seam-driven runs

```
node cadence-core/bin/issue-filing.mjs file    --payload /tmp/live-dispositions.json --dir <scratch>/.planning
node cadence-core/bin/issue-filing.mjs unfixed --payload /tmp/live-payload.json      --dir <scratch>/.planning
```

The second call re-raises the SAME `(file, claim)` pairs. It must come back with
three findings, not five: the two declined ones are already on the tracker under
`cadence-declined` and the label-filtered lookup drops them.

### The gate-driven run

Fire a `blocking`-gated trigger over the same five findings in the scratch
repository, answer the ask it raises with the same three accepts and two
declines, and record WHERE in the fire the ask appeared relative to the end of
the step that produced the findings. The three accepted findings must be issues
on the tracker by the time that step returns.

## The argv each row will run

Taken from `FILING_TABLE` in `cadence-core/bin/lib/filing-decision.mjs` as it
stands at this commit. If a live run contradicts a row, fix the ROW - its argv
or its comment - never this transcript, and never by putting a host, org or
username into the implementation as a literal.

| Provider | CREATE (declined entries append the label flag) |
|---|---|
| forgejo | `tea issues create --repo <slug> --login <login> --title <t> --description <b>` + `--labels cadence-declined` |
| github  | `gh issue create --repo <slug> --title <t> --body <b>` + `--label cadence-declined` |
| gitlab  | `glab issue create --repo <slug> --title <t> --description <b> -y` + `--label cadence-declined` |

| Provider | DECLINE LOOKUP (one call per fire, whatever the finding count) |
|---|---|
| forgejo | `tea issues list --repo <slug> --login <login> --labels cadence-declined --state all --fields index,title --output json --limit 50` |
| github  | `gh issue list --repo <slug> --label cadence-declined --state all --json number,title --limit 200` |
| gitlab  | `glab issue list --repo <slug> --label cadence-declined --all --output json --per-page 100` |

`glab`'s `-y` is load-bearing: without it the child blocks on a confirmation
prompt inside a gate step. The page sizes are `HOST_TABLE`'s measured ones, and a
response that FILLS its page is INCOMPLETE and carries no records.

## Recorded

_Nothing below is observed yet._

### forgejo (tea 0.15.1)

- Scratch repository:
- Exact argv the seam ran:
- Exit status per call:
- Did `cadence-declined` have to exist beforehand, or did the create make it:
- What the CLI printed on a successful create:
- Second `unfixed` returned:
- Contradicts a row:

### github (gh 2.98.0)

- Scratch repository:
- Exact argv the seam ran:
- Exit status per call:
- Did `cadence-declined` have to exist beforehand, or did the create make it:
- What the CLI printed on a successful create:
- Second `unfixed` returned:
- Contradicts a row:

### gitlab (glab 1.114.0)

- Scratch repository:
- Exact argv the seam ran:
- Exit status per call:
- Did `cadence-declined` have to exist beforehand, or did the create make it:
- What the CLI printed on a successful create:
- Second `unfixed` returned:
- Contradicts a row:

### The gate-driven run

- Provider used:
- The trigger fired:
- Where the ask appeared relative to the end of the step that produced the findings:
- Were the three accepted findings issues on the tracker by the time that step returned:
- Was it ONE ask step for five findings, or more:

## The checks that close the task

- [ ] Three issues on each tracker WITHOUT the decline label, two WITH it.
- [ ] The second `unfixed` returns the three accepted findings' peers and
      neither declined one.
- [ ] Five findings produced ONE ask step, not five.
- [ ] `git status` shows `.planning/CAPTURE.md` unmodified after all three runs.
- [ ] `grep -rn "jcrenshaw" cadence-core/` returns nothing outside test
      fixtures. Measured 2026-08-25 BEFORE the live runs: six hits outside
      `*.test.mjs` and `bin/fixtures/`, all six comment lines predating this
      phase - `lib/redact-url.mjs:66`, `lib/forge-decision.mjs:139,140,227,228`,
      `self-verify.mjs:516`. None is a literal any code reads. Re-run after the
      live runs and confirm the count has not grown.
