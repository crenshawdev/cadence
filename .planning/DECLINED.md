# Declined: findings and proposals this repository said no to

The decline record, kept HERE and not on the tracker. The tracker carries real
work only: an issue on it is something John intends to schedule.

Two sections, two jobs.

**Fingerprints** is the dedup key. `issue-filing.mjs unfixed` must never ask
about a finding already declined on a previous fire, and this is what it reads
to know. One `- ` row per declined gate finding: the date, the provider, the
repository slug, the finding's (file, claim) fingerprint and its title. No
finding body - a row is a pointer, not a copy. This mirrors `FILED.md`, which
does the same job for ACCEPTED findings.

**Decisions** holds the human declines, which carry reasoning worth keeping.
A gate finding is a machine's claim and its fingerprint is enough; a design
decline is a call John made and the why is the whole value.

Nothing here is a queue and nothing here is read by `planning.mjs recall`.
Query it, do not load it.

## Fingerprints

- 2026-08-25 github crenshawdev/cadence e7cfd661a15c38fa: [cadence e7cfd661a15c38fa] Task 6 classifies `risk-check.mjs:70` and `:326` as exempt and makes that exemption part of the new census, despite CONTEXT D-06 identifying the corresponding `risk-check.mj
- 2026-08-26 github crenshawdev/cadence 1bea2b1ed94422e4: [cadence 1bea2b1ed94422e4] The plan cannot satisfy HOK-01 or roadmap success criterion 2 because it registers and implements only `SubagentStop`; no task registers or writes a `SubagentStart` half.
- 2026-08-26 github crenshawdev/cadence 07f259d4cac7d9ba: [cadence 07f259d4cac7d9ba] TRC-02 says `/cad-report` and `/cad-suggest` can price a dispatch using the host wall clock, but the plan only adds `duration_ms` to `trace render`; it contains no task to u
- 2026-08-27 github crenshawdev/cadence faff601712195bec: [cadence faff601712195bec] The prescribed BEFORE measurement command trusts every nonblank `reads.jsonl` line as valid JSON, so a truncated or malformed recorder line aborts the entire measurement.
- 2026-08-27 github crenshawdev/cadence 7276fe182aa6762b: [cadence 7276fe182aa6762b] The BEFORE measurement command reads the complete recorder into one UTF-8 string with no size cap or streaming path.
- 2026-08-27 github crenshawdev/cadence d8313238e9c245fe: [cadence d8313238e9c245fe] The hostname grammar enforces only the total DNS-name length and accepts invalid overlong DNS labels.
- 2026-08-27 github crenshawdev/cadence a0ffff80279fa56f: [cadence a0ffff80279fa56f] AC2 requires the same destructive text to remain detectable from a `.mjs` file in the same range, but Task 2 deliberately puts `rm -rf` only in the withheld record and tests
- 2026-08-27 github crenshawdev/cadence b3e175b3af37ccb1: [cadence b3e175b3af37ccb1] Task 4 claims that deep-equal returned `results` arrays plus equal `total` values "settles the whole matched document set," but the seam returns only the default top-five wi
- 2026-08-27 github crenshawdev/cadence e3ca3e72c4dab44b: [cadence e3ca3e72c4dab44b] Task 2’s verification says a `git diff` of the query fixture "in this commit" proves fewer than half the entries changed, but it supplies no commit range or stable base.
- 2026-08-27 github crenshawdev/cadence eed220012e5eb575: [cadence eed220012e5eb575] The `y` consonant rule is inverted relative to Porter, so step-1b cleanup can produce a different fold for an inflected word than for its base form.
- 2026-08-28 github crenshawdev/cadence a32ed3a85b368dc6: [cadence a32ed3a85b368dc6] Task 6 does not reproduce the FAIL branch or a risk-surface fixture at all: it manually opens a second lifecycle dispatch, makes a commit, and closes the bracket through tra
- 2026-08-28 github crenshawdev/cadence 562c7b254f15fe63: [cadence 562c7b254f15fe63] The proposed authorship fixture expressly proves only that a worker commit occurred inside a bracket, while the phase success criterion also requires proving zero coordinato
- 2026-08-29 github crenshawdev/cadence 6cef9d3719cf28c1: [cadence 6cef9d3719cf28c1] After only 250 ms waiting on an in-flight claim, a losing writer returns success-path control to `appendRead` even if the winner still has not swapped the live path.
- 2026-08-29 github crenshawdev/cadence f81c079a6a8302b9: [cadence f81c079a6a8302b9] Any parseable record that satisfies `isReadsRotationMarker` is treated as authoritative rotation metadata and removed from the read records.
- 2026-08-29 github crenshawdev/cadence 782278b476cecc78: [cadence 782278b476cecc78] Malformed JSON is skipped indiscriminately, including a truncated rotation marker that is the only evidence that the live reads record was cut.
- 2026-08-29 github crenshawdev/cadence 083d5561171e3fff: [cadence 083d5561171e3fff] The plan splits the three old-route edits across Task 1 and Task 2 even though locked decision D-06 requires all three sites to move together; the tasks also require their p
- 2026-08-29 github crenshawdev/cadence 361fc197fad92f6d: [cadence 361fc197fad92f6d] Task 5's mutation verification is internally impossible: restoring the old too-big sentence removes not only the route required by assertion (1), but also the `planning.mjs 
- 2026-08-29 github crenshawdev/cadence d74c7a21ece03c0d: [cadence d74c7a21ece03c0d] The planned guardrail regression test checks only that the guardrails block names `/cad-phase add`; it does not check that `/cad-context` is absent or does not precede it, d
- 2026-08-29 github crenshawdev/cadence b4598fa253e25c38: [cadence b4598fa253e25c38] The workflow forwards the raw task text into a phase description without checking for secrets, causing sensitive task input to be persisted in the roadmap.
- 2026-08-29 github crenshawdev/cadence 835f1c1f7add3b73: [cadence 835f1c1f7add3b73] The phase number is computed before `/cad-phase add` runs, but the add command is not given that number, so the subsequent commands are not guaranteed to target the phase th
- 2026-08-29 github crenshawdev/cadence e945d78ea691fc2e: [cadence e945d78ea691fc2e] The new route assumes a feature-sized task is absent from the roadmap, but the scope step is explicitly performed before inspecting the roadmap and supplies no check for tha
- 2026-08-29 github crenshawdev/cadence 57b4c15e91ce7200: [cadence 57b4c15e91ce7200] `total + 1` is only a snapshot, not a phase number resolved for the subsequent add operation.
- 2026-08-30 github crenshawdev/cadence 67f2248e16e7d254: [cadence 67f2248e16e7d254] `usableFixCommit` treats a syntactically hex-shaped string as proof that a fix landed, although it never verifies that the referenced commit exists.
- 2026-08-30 github crenshawdev/cadence 17b59c7d2ec699f5: [cadence 17b59c7d2ec699f5] The blocker is not fully closed: usableFixCommit validates only hexadecimal shape, so an untrusted record can still claim a nonexistent or non-commit object as proof of a co
- 2026-08-30 github crenshawdev/cadence 8f983c5af5638e7a: [cadence 8f983c5af5638e7a] Malformed or legacy finding entries are treated as successfully adjudicated input and silently excluded from the halting set when they lack a recognized `ruling`, allowing t
- 2026-08-30 github crenshawdev/cadence 001fed06cadca13a: [cadence 001fed06cadca13a] The staged files are published with separate renames, so the claimed all-or-nothing carry is observable as a sequence of partial sets.
- 2026-08-30 github crenshawdev/cadence 57b4f1c0fb6de915: [cadence 57b4f1c0fb6de915] The earlier destination collision check is not enforced at commit time because `renameSync` replaces a target that appeared after preflight.
- 2026-08-30 github crenshawdev/cadence da121e79a5d29547: [cadence da121e79a5d29547] The destination symlink checks are subject to a check/use race because all subsequent staging, rename, and recursive cleanup operations resolve the parent paths again by nam
- 2026-08-30 github crenshawdev/cadence c5b53b4ca5759457: [cadence c5b53b4ca5759457] The carried-name symlink rejection is separated from the byte comparison, so a destination entry can still become a symlink after `lstatSync` and be followed by `readFileSyn
- 2026-08-30 github crenshawdev/cadence bba838d7ef33812e: [cadence bba838d7ef33812e] The source regular-file validation is not bound to the eventual copy, so `copyFileSync` can still follow a source entry changed to a symlink after validation.
- 2026-08-30 github crenshawdev/cadence 680167c668917e6b: [cadence 680167c668917e6b] `risk-carry` is only registered as an independently invoked command; this range does not invoke it from the milestone-close/prune path that deletes `phases/<N>`.
- 2026-08-30 github crenshawdev/cadence 7b5e528f17fad1c2: [cadence 7b5e528f17fad1c2] The new cleanup deletes the entire shared `.planning/risk-carry/` root without locking it or restricting deletion to records evaluated by this `/cad-land`, so it can erase a
- 2026-08-30 github crenshawdev/cadence b82dae213faac408: [cadence b82dae213faac408] The new remedy deletes the legacy aggregate while the current close is halted, without first replacing it with any durable adjudication or carry that survives until a succes
- 2026-08-30 github crenshawdev/cadence 8c4829882b6dbdcc: [cadence 8c4829882b6dbdcc] The prose assumes no adjudication can sit beside a legacy aggregate, but its filename is syntactically indistinguishable from an ordinary review and the preceding generic pa
- 2026-08-30 github crenshawdev/cadence 4b9f0fde9df33cb3: [cadence 4b9f0fde9df33cb3] Task 4's new regression row does not reproduce the live-claim interleaving that AC3 and the task's rationale require.
- 2026-08-30 github crenshawdev/cadence bb05bdb5426d0506: [cadence bb05bdb5426d0506] The leftover-generation rescue treats one finite read as completion even though a racing writer can still append to that inode after `statSync(leftover)` or after `readSync`
- 2026-08-30 github crenshawdev/cadence 95075f585bbc4096: [cadence 95075f585bbc4096] `carried_bytes` is computed from a UTF-8-decoded string rather than the generation's physical byte length, so it is not a valid byte offset for a generation containing malfo
- 2026-08-30 github crenshawdev/cadence 090149b88cb0c9df: [cadence 090149b88cb0c9df] Admission reserves a marker generated from a stale read, but `freshRecord` can generate a much larger marker from the later record and has no final bound check for marker-pl
- 2026-08-30 github crenshawdev/cadence f85fc34186a556a5: [cadence f85fc34186a556a5] A leftover generation whose governing marker has no usable `carried_bytes` is deleted while `rotateReads` reports a clean successful rotation, not even `shortfall: null`.
- 2026-08-30 github crenshawdev/cadence 10222de2dd3fd7d6: [cadence 10222de2dd3fd7d6] The rescue snapshots the evicted inode's size before reading it, but writers holding an old file descriptor can append after that snapshot and before the evicted inode is un
- 2026-08-30 github crenshawdev/cadence 0611babbe06f3704: [cadence 0611babbe06f3704] The marker reserve only budgets for the triggering record, not for rescued tail bytes; after rescue, the same `appendRead` call appends its pending record without rechecking

## Decisions

### /cad-stakes: a first-class command for the highest-leverage knob

Declined 2026-08-26. Was GH-97, deleted from the tracker 2026-08-30.

`stakes` is the highest-leverage knob in Cadence - one level picks the `route-table.json` row that sets model, effort, five review gates and the verifier at once - and it changes repeatedly over a project's life. A spike wants `solo`, a release run wants `shipped`, auth and migrations want `critical`.

Today it is buried in `/cad-config` beside set-once concerns (workflow toggles, provider setup), and the only direct route is `node cadence-core/bin/config.mjs set stakes=<level>`, which no user will discover or type.

## Shape

- **No argument: REPORT.** The current effective level, which config layer set it, and the row it buys phrased as consequences ("plan review adjudicated, diff review advisory, verifier on") rather than raw table cells.
- **With an argument: SET,** and show a before/after diff of what actually changed.

## The two things it must surface, or it lies by the same omission a raw `config set` does

1. An active `model.overrides.<role>` pin does NOT move with the level. `cad-executor: opus` stays opus at `solo`, so the switch looks broken.
2. A risk-surface floor can raise a phase ABOVE the reported level.

## Scope

Defaults to the repo layer, `--global` for the user layer, and the chosen scope is stated in the output rather than assumed.

---
*Migrated from the Forgejo archive: [#248](https://git.jcrenshaw.dev/crenshawdev/cadence/issues/248), opened 2026-08-23. A bare `#NNN` in this project's planning docs refers to that archive, not to GitHub.*

### Docs-drift sweep at close and land

Declined 2026-08-26. Was GH-99, deleted from the tracker 2026-08-30.

`/cad-milestone` and `/cad-land` should check the shipped documentation against the code that changed this cycle. A milestone close is where a cycle's accumulated drift is cheapest to catch, and nothing checks it today.

## Surfaces a cycle can invalidate

- README, whose "what it costs to run" section is already stale
- the plugin manifest
- CHANGELOG
- any doc carrying a workflow description, a command list, or an image/diagram

## Shape

`/cad-land` ASKS whether to run the sweep rather than running it unasked. The milestone arm is where it earns its keep.

## Scope against the existing command, not over it

`/cad-docs-verify` already checks claims - paths, commands, symbols, config keys. What it does not do is report omissions well, or cover manifests, changelogs or images. Scope this as the gap around it rather than a second implementation of it.

---
*Migrated from the Forgejo archive: [#250](https://git.jcrenshaw.dev/crenshawdev/cadence/issues/250), opened 2026-08-23. A bare `#NNN` in this project's planning docs refers to that archive, not to GitHub.*

### skim.test.mjs does not walk cadence-core/bin/planning/, so 30 modules are uncovered

Declined 2026-08-26. Was GH-109, deleted from the tracker 2026-08-30.

`skim.test.mjs:99` ("every shipped .mjs skims without losing a line") walks `bin/` and `bin/lib/` only — `const dirs = [join(HERE), join(HERE, 'lib')]` — so the 30 modules under `cadence-core/bin/planning/` fall outside its coverage.

Nothing fails today; widening the walk is a one-line change.

Verified still live 2026-08-25.

---
*Triaged out of `.planning/CAPTURE.md` at the v3.7.1 close, 2026-08-25.*

### DISPATCH_WINDOW_DEFAULTS sits in planning/core.mjs but has one reader

Declined 2026-08-26. Was GH-111, deleted from the tracker 2026-08-30.

`DISPATCH_WINDOW_DEFAULTS` sits in `planning/core.mjs:375` because PLAN-1 task 1 named it in the core list, but its only reader is `planning/trace.mjs`. Moving it there would make the by-use rule uniform.

Verified still live 2026-08-25.

---
*Triaged out of `.planning/CAPTURE.md` at the v3.7.1 close, 2026-08-25.*

### Drain user-typed captures at phase close

Declined 2026-08-26. Was GH-122, deleted from the tracker 2026-08-30.

Turn `phase-done`'s `capture` field from a printed list into the same ask the review gates use — one AskUserQuestion for the batch, then `issue-filing.mjs file`, so named items become tracker issues and unnamed ones carry the decline label and stop resurfacing.

Phase close rather than milestone close because batch size grows with the gap, and rather than a reminder because that relies on the user remembering.

Changes `cadence-core/workflows/verify.md:318`, which today says the capture list is "a list for the user, not a gate".

This closes the one accumulation path v3.7.1 left open: review findings never reach CAPTURE.md now, but `/cad-capture` bullets have no drain. Demonstrated at the v3.7.1 close on 2026-08-25, where 32 substantive items (21 todos + 11 seeds) survived the milestone and had to be triaged by hand — the exact loop v3.7.1 set out to end.

Note for whoever picks this up: `issue-filing.mjs file` today reads an ADJUDICATION-shaped payload (`file`/`line`/`severity`/`claim`/`failure_scenario`/`ruling`). A hand-typed capture bullet has none of those, so this needs either a second payload shape or a capture-to-finding adapter. That mismatch is why the 2026-08-25 triage filed through `gh` directly and FILED.md did not grow.

---
*Triaged out of `.planning/CAPTURE.md` at the v3.7.1 close, 2026-08-25.*

### REJECTED: narrowing git-guard's hook with an if filter

Declined 2026-08-25. Was GH-123, deleted from the tracker 2026-08-30.

REJECTED 2026-08-25. Recorded so it is not re-examined.

The proposal: narrow `git-guard`'s hook with an `if` filter to save node startup.

Why it was rejected: the docs say the filter "fails open, running your hook regardless of pattern, when the Bash command can't be parsed", and say outright to use the permission system rather than a hook for a hard allow or deny. `git-guard` is a rail; that trade is the wrong side.

Closed as the decline record, not as work anyone should pick up.

---
*Triaged out of `.planning/CAPTURE.md` at the v3.7.1 close, 2026-08-25.*

### CONFIRMED NEGATIVE: no hook input carries token, cost or cache figures

Declined 2026-08-25. Was GH-124, deleted from the tracker 2026-08-30.

CONFIRMED NEGATIVE 2026-08-25. Recorded so it is not re-examined.

No hook input carries token, cost, or cache-token counts. The common fields are `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `effort`, `hook_event_name`, plus `agent_id`/`agent_type` inside a subagent.

Consequence: the Forgejo-archive issue #242 stays blocked, now from the schema rather than by inference.

One thing this measurement DID turn up and nothing exploits yet: every hook input carries `effort`, so what a rung actually RAN at is observable at runtime, not only at `route.mjs resolve` time.

Closed as the answer, not as work. Reopen only if the hook input schema gains cost fields.

---
*Triaged out of `.planning/CAPTURE.md` at the v3.7.1 close, 2026-08-25.*

### reference-router fence parsing ignores delimiter type and run length

Declined 2026-08-26. Was GH-139, deleted from the tracker 2026-08-30.

`outsideFences` toggles a boolean on any fence line without tracking the delimiter's type or run length, so nested or mismatched fences flip the parser.

## The code

`cadence-core/bin/lib/reference-routers.mjs:138-155`:

```js
const FENCE_RE = /^\s*(?:`{3,}|~{3,})/;

function outsideFences(text) {
  let inFence = false;
  return text.split('\n').map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : line;
  }).join('\n');
}
```

CommonMark closes a fence only on the same character at the same or greater run length. This closes on any of them, so:

- a ```` ```` ```` block containing a ``` line ends early, and its remaining content is read as prose
- a `~~~` line inside a ``` block ends that block
- an unclosed fence inverts every classification to end of file

## Consequence

Both directions are wrong and both matter, because the check reads the router's prose to decide branch membership:

- content inside a fence leaking into prose can make a cold path in a fenced EXAMPLE count as a declared branch
- prose falling inside a phantom fence can hide a real branch Read, so a router that lost one passes

The second is the failure mode this check was fixed for once already: commit `caa07bfb` in v3.7.2 narrowed arm 2 from raw router text to prose only, precisely because a cold path inside a fenced example satisfied the Read check. This is the same class, one level down in the parser.

## Severity

Low. Cadence's own reference files are hand-written and do not currently nest fences, so nothing is misclassified today. It is a latent correctness gap in a check whose whole job is to be trusted.

Raised in review of the v3.7.2 release, adjudicated against the code 2026-08-26.

- 2026-09-01 github crenshawdev/cadence 3ff2ae889690dc37: [cadence 3ff2ae889690dc37] `status` can advertise an outstanding dispatchable plan for a phase that `replay-check` refuses to dispatch, because it reads only `p.plans` and never applies replay-check's
- 2026-09-01 github crenshawdev/cadence 3482711731b8cf77: [cadence 3482711731b8cf77] The documented handling of an absent `outstanding` field is not implemented by the routing rules, so an older status seam is effectively treated as an empty outstanding set
- 2026-09-01 github crenshawdev/cadence dfc9960e87849ea7: [cadence dfc9960e87849ea7] Selecting the next free plan filename via `ls` before the planner writes it is a check-then-act race and does not ensure the promised no-overwrite behavior.
- 2026-09-01 github crenshawdev/cadence e491480d4992c7c0: [cadence e491480d4992c7c0] The workflow now offers to resume incomplete or paused work rather than automatically resuming it.
- 2026-09-01 github crenshawdev/cadence ff1ed54d21a7bdf0: [cadence ff1ed54d21a7bdf0] The accumulator accepts finite but unsafe token values and can overflow to `Infinity`.
- 2026-09-01 github crenshawdev/cadence 0022eba277dc9572: [cadence 0022eba277dc9572] A call with only one valid usage side is treated as fully priced, with no indication that the provider-reported input-plus-output total is incomplete.
- 2026-09-01 github crenshawdev/cadence 05c980787b4c6b88: [cadence 05c980787b4c6b88] Removing `cross-model provider calls` from `SPEND_EXCLUDES` makes the `/cad-suggest` spend receipt omit a source that is still outside its recorded-token numerator and denom
- 2026-09-01 github crenshawdev/cadence 2a392538c19c1099: [cadence 2a392538c19c1099] Task 1 does not cover AC4's required `outcome/adjudication` path.
- 2026-09-01 github crenshawdev/cadence eff9c7d883b229c6: [cadence eff9c7d883b229c6] The close-out task cannot perform the source repairs its action requires because it declares only `weight-budgets.json`.
- 2026-09-01 github crenshawdev/cadence 058802bb9f12a4dc: [cadence 058802bb9f12a4dc] Allowing Plan 3 to re-pin a budget left over from earlier plans contradicts D-13's same-commit rule and places the dependency too late.
- 2026-09-02 github crenshawdev/cadence 4dfc49a8ba41b061: [cadence 4dfc49a8ba41b061] `--anchor` is documented and relied on as a window anchor SHA, but its contract and implementation accept any nonblank string and turn it directly into a correlation id.
- 2026-09-02 github crenshawdev/cadence 268076ad1d854623: [cadence 268076ad1d854623] R9 treats every override event carrying the same authorization_id as a separate application of one decision without checking whether the receipts name distinct fired ranges.
- 2026-09-02 github crenshawdev/cadence b498024972a0db07: [cadence b498024972a0db07] No task can deliver AC6's required `TRC-13 | Phase 3` Traceability row: the supplied REQUIREMENTS artifact lacks it, and Task 4 explicitly says to report that state rather t
- 2026-09-02 github crenshawdev/cadence 7539c8b4ffaaf91b: [cadence 7539c8b4ffaaf91b] Task 4 invents an unsupported all-or-nothing pair rule that omits the dispatched `rung` whenever observed `effort` is absent. D-03 requires the resolvable agent-type rung to
- 2026-09-02 github crenshawdev/cadence 112e2c2d56f04b46: [cadence 112e2c2d56f04b46] The new test fixture is syntactically invalid: the first property in `cases` has neither a valid closing key nor a colon/value expression.
- 2026-09-02 github crenshawdev/cadence c4d403f3c2f3f4eb: [cadence c4d403f3c2f3f4eb] The `cases` object has a malformed first member: it has neither a property colon nor a valid value expression, and contains an unescaped nested quote before `end_turn`.
- 2026-09-02 github crenshawdev/cadence c319da81b62194a0: [cadence c319da81b62194a0] Task 2's all-surface verification is not failure-capable for multiline invocations: it considers only a physical line containing both `planning.mjs` and `risk-check run`, th
- 2026-09-02 github crenshawdev/cadence 512dac0bee96f151: [cadence 512dac0bee96f151] Task 3 adds two prose `trace append` producer sites but neither the task nor PLAN-2's frontmatter declares `cadence-core/bin/trace.test.mjs`, the stated holder of the affect
- 2026-09-03 github crenshawdev/cadence ad87cb9517255ab6: [cadence ad87cb9517255ab6] Task 5 has no failing-capable verification for the required disposition line: `sed -n` exits successfully even when the line is absent, and the plan explicitly adds no prose
- 2026-09-03 github crenshawdev/cadence 9999c6a7da601ff0: [cadence 9999c6a7da601ff0] No task performs the live treeless `/cad-task` run required by the Phase 2 success criteria; it is relegated to a note as human verification.
- 2026-09-03 github crenshawdev/cadence 96b51fade389b6bb: [cadence 96b51fade389b6bb] Task 3 adds a new exact-occurrence census to `prose-agreement.test.mjs` but neither the task nor plan frontmatter declares the census-registry file that shipped requirements
- 2026-09-03 github crenshawdev/cadence e81c85aea3469548: [cadence e81c85aea3469548] The plan promotes the flagged assumption that trace `ENOENT` uniquely proves a legitimately treeless run to “confirmed” using only an asserted description of `tracePath`; it
- 2026-09-03 github crenshawdev/cadence fa1967b1f535b3ce: [cadence fa1967b1f535b3ce] The completion rule equates every trace-side `reason: ENOENT` with an absent planning root, even though `ENOENT` can also result from a broken/dangling `.planning` symlink (
- 2026-09-03 github crenshawdev/cadence 89fd39d53be893a0: [cadence 89fd39d53be893a0] The claimed “nothing is created” seam test does not run `/cad-task` or observe filesystem operations; it manually invokes selected CLI commands and only asserts that the pla
- 2026-09-03 github crenshawdev/cadence c20ca3e2be721f45: [cadence c20ca3e2be721f45] The “in ONE place” prose pin is not global: it only rejects verdict-like wording in the `risk_check` skip paragraph and `record` step. A duplicate or contradictory completio
