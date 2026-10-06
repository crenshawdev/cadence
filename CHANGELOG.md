# Changelog

All notable changes to Cadence are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Cadence follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases 1.0.0 through 2.7.0 are in [CHANGELOG-v1-v2.md](./CHANGELOG-v1-v2.md).

## [Unreleased]

## [3.8.3] - 2026-10-06

The band and the pane, and the README section that shows them.

### Fixed

- **A phase being executed no longer reads `planned`.** Nothing sets an
  `executing` status, so through a whole `/cad-execute` run the band and the
  pane's status chip said `planned`, beside a running `cad-executor` and a plans
  bar already partway done. Both now draw `executing` while the phase is
  `planned` and a `cad-executor` is running. It is display only: the cursor and
  the derived status keep their values. An executor that `/cad-task --plan`
  dispatches on a `planned` phase shows the same way, because the running list
  cannot tell the two apart.

### Changed

- **The README shows the pane.** The section is now The pane, with a
  screenshot of it mid-execute, and it says that `n` puts the next command in
  the prompt. Its paragraph on what the module does besides drawing moved into
  The module's list.

## [3.8.2] - 2026-10-06

Test fixtures only. Nothing a user runs changed.

### Changed

- **No test source carries a token-shaped literal.** The directory's scan of
  v3.8.0 held `review-provider.test.mjs` for what read as a credential. The
  last `sk-` prefixed value and the three `Bearer` tokens the redaction tests
  plant are now assembled when the test runs, so the bytes under test are the
  same and no file ships them whole. The `read-trace` test's leftover check for
  an `sk-live` token, which could no longer fail after v3.8.1 renamed the
  planted value, now checks the value that is planted.

## [3.8.1] - 2026-10-05

Fixes for what v3.8.0's reviews and UAT left open (GH-301, GH-302, GH-303), and
the changes the Claude plugin directory's pre-submission checks asked for. Two of
those change behavior on upgrade, both in the same direction: a repository's
committed config can no longer turn on something that acts with your
credentials. Read Changed before you upgrade if you use `git.auto_close` or a
cross-model reviewer.

### Changed

- **`git.auto_close` needs both layers.** An unattended close now runs only when
  the repository's `.planning/config.json` AND your user-global
  `~/.claude/cadence/config.json` both set it true. A cloned repo can no longer
  authorize an unattended push and merge on its own. If you relied on the repo
  setting alone, run `config.mjs set --global git.auto_close=true` once. The
  refusal names the missing half, and says so when both paths are the same file.
- **Cross-model reviewers need your user-global config to name them.** A
  provider in `review.reviewers` (`openai`, `gemini`, `deepseek`) runs only when
  your user-global `review.reviewers` names it too, so a repo's config cannot
  send your code to a provider with your key. An enrollment written before this
  release sits in the repo layer only and goes inert until the provider is also
  named globally. `/cad-config --review` now asks before writing that global
  half, and its wrap-up flags a repo-only enrollment.
- **Context7 is optional in `/cad-decision-review`.** It grounds library and API
  claims against Context7 when its tools are available, and otherwise against
  the installed source, lockfile or vendored docs, naming any claim it could not
  check.
- **Generated lint and typecheck commands no longer go through `npx`.** A tool
  in `node_modules/.bin` is named by that path, one only on `PATH` by its bare
  name, and anything else leaves the slot empty, so no detected command can
  fetch a package.
- **The CHANGELOG is split.** Releases 1.0.0 through 2.7.0 moved to
  `CHANGELOG-v1-v2.md`, which keeps every file under the directory's 256 KiB
  limit. Release tooling is unchanged.

### Added

- **`agent_type` on every `route.mjs resolve`.** The resolved agent with the
  plugin's own prefix from `plugin.json` (`cadence:cad-reviewer-xhigh`), which
  Cadence's dispatches now name directly. `route.mjs agent-type --stem <name>`
  answers the same for the reviews that dispatch without routing. `resolve` also
  returns `reviewers_global`, the providers your user-global config names.
- **Self-verify check 27.** Fails on any tracked file over 256 KiB that is not an
  image or font, and on more than 512 tracked files and folders: the plugin
  directory's two file limits, held in CI.
- **"What Cadence sends, writes and reads" in the README.** Every external host
  and what goes to it, the provider key read, every forge write, the optional
  MCP tools, what the mods module does, the transcript and read logging, every
  write outside the project, why the skills keep `Bash` pre-approved, and a
  privacy note.
- **Contract skill descriptions name the agents that preload them**, and say they
  are not for direct use.

### Fixed

- **A user's own agent keeps its name (GH-303).** On a mods host the module no
  longer rewrites a bare `cad-*` call to Cadence's agent when a project or user
  agent owns that exact name. It still prefixes a bare rung stem nobody else
  owns, as a safety net.
- **`renumber` leaves shipped history alone (GH-301, GH-303).** `renumber remove`
  shifts or blanks only Pending Traceability rows, leaves Complete and Deferred
  rows and `## Shipped` byte-identical, names any Complete row citing a removed
  or moved phase in `warn`, and lists every changed line in `req_row_changes`.
  Both `insert` and `remove` re-point the phase number in the cursor's `Next:`.
- **`risk-carry` refuses by name (GH-302).** An unsearchable or unwritable
  `.planning/risk-carry/`, an unreadable source ruling and an unreadable carried
  copy each get their own reason, the path and a hint, never `internal` and never
  `carry-exists` for a copy it could not read. Every source is read before any
  directory is made.
- **Check 26 reads descriptions the way YAML does (GH-303).** `\x0a`, `\u000a` and
  `\U0000000a` in a double-quoted description now fail as a line break, and a
  one-line description followed by a comment line passes.
- **Held step windows are bounded (GH-303).** The mod holds at most 64 stopped
  subagent windows waiting for a close and evicts the oldest, so stops no close
  ever names cannot pile up for the life of a session.
- **No test fixture looks like a real credential.** Every key-shaped test value
  was replaced with one that matches no real key pattern.

## [3.8.0] - 2026-10-04

Cadence can now show you where the loop stands without a command. On a Claude
Code version with mods support it loads a small module that draws a band above
the prompt and a pane on demand, and keeps its own agent listing out of every
session's prompt. On an older version the module never loads and nothing else
changes.

### Added

- **The band.** One line above the prompt in any repo with `.planning/`: the
  phase, its status, any Cadence agent running right now with its rung, and the
  next command. It redraws when an agent starts or returns and after every tool
  call, and it composes with other mods that pass their neighbour's drawing
  through.
- **`/cad-panel`, and `p` on the band.** A pane with the current phase's plans
  and which are done, each running agent with the role, rung and model it was
  routed, the UAT counts with bars, the open captures, the phase's token spend
  as `/cad-report` totals it, and the next command. Cursor drift is named, not
  hidden.
- **Host-priced token figures.** A subagent dispatch whose return carried no
  token count is priced from the host's own usage for that agent, filed under
  the phase of the close that names it, and a return's own figure always wins.
- **A `plugin-validate` CI job.** `claude plugin validate --strict` runs on both
  manifests and fails if the validator stops reporting the module.
- **Self-verify checks.** Check 25 resolves every `modules` entry the way the
  host does, and check 26 keeps every Cadence agent and contract-skill
  description on one line, so the listing filter can always find the entry's
  end.

### Changed

- **Cadence's agent listing leaves the prompt on hosts with mods.** The 30 rung
  agents' entries and the six contract skills' entries are filtered out of the
  listings the model reads, in every session and every repo, about 8,000
  characters. The agents still dispatch: the module restores the plugin prefix
  on the bare name `route.mjs` returns.
- **The `.planning/` walk is defined once** and the three command hooks share
  it. git-guard otherwise behaves exactly as before; it stays a command hook.

### Fixed

- **`/cad-phase insert` rewrote shipped history.** It now shifts phase
  references only on Pending `## Traceability` rows, leaves Complete and
  Deferred rows byte-identical, lists every REQUIREMENTS line it will change at
  the confirmation gate, and names a Complete row left citing a moved phase.
- **Risk carry crashed on an unreadable phase directory.** A non-searchable
  `phases/`, or a phase directory that is readable but not searchable, now
  refuses as `unlistable-phase` with a hint to make the path readable and
  searchable, instead of `internal` with a raw `EACCES`.
- **Stale docs.** Every claim the docs-verify pass found stale in the README,
  the docs, INTERNALS, METHOD, MANIFESTO, LINEAGE, DESIGN and the figures now
  says what the code does.

## [3.7.13] - 2026-09-25

The planning records are out of the repository. Nothing a user installs ever
read them, and the only things that did were tests.

### Removed

- **`.planning/` from the repository.** The 269 tracked planning files are gone
  and `/.planning/` is ignored, so a working planning directory stays local.

### Changed

- **Tests that read those records now build their own.** The `/cad-why` tier
  and join tests make their close in a temp repository, the record parsers take
  verbatim excerpts inline, and the PHS-02 status check runs against a roadmap
  in its own directory. Thirteen tests that checked only this repository's
  records, or repeated a case a built fixture already covers, are deleted.

## [3.7.12] - 2026-09-05

One word used to decide what all six roles ran at. It is gone, and thirteen
questions that say what each role costs are what a project meets instead.

### Removed

- **`stakes`, and every table keyed on it.** The single level that set six roles'
  models and rungs at once is deleted, along with the 18-cell routing grid, the
  `review` / `verify` / `tiers` / `efforts` grids beside it, and
  `cadence-core/route-table.json` itself. **Breaking, and there is no alias.** A
  config still carrying the key meets the migration below on its next command; a
  config that skips the migration gets the retirement message naming its
  replacement rather than an `unknown key` refusal.

- **`model_aliases`, and the enum on the six `model.overrides.*` keys.** A model
  is now a string the user typed. Nothing in this repository holds a list of
  model names to check it against, because nothing in this repository could keep
  such a list current: naming a new model used to be seven edits, and the model
  was unroutable until every one of them landed.

- **`route.mjs replay`.** No workflow or skill invoked it, and it orphaned no
  shared helper on the way out.

### Added

- **`/cad-config --roles` asks thirteen questions in four prompts.** Six name a
  role and ask which model it runs on, six ask which effort rung it starts at,
  and the last asks what a detected risk surface may do. Every question states
  what that role does in the phase loop and what a stronger or weaker answer buys
  there, so the interview is the documentation rather than a pointer at one.
  `/cad-new-project` and `/cad-adopt` run it in full against the user-global
  layer on a first run; `/cad-config --roles` re-asks it for one project into the
  repo layer, and `--roles --global` re-opens the machine-wide answers.

- **A migration for a config that still carries `stakes`.** The level is expanded
  into twelve explicit per-role values, shown with what each one will become,
  confirmed, written in one validated call, and then the key is taken off disk. A
  config with no `stakes` key never sees it.

- **`config.mjs unset <key>... [--global]`.** The write face had no way to REMOVE
  a key, and `validate` refuses a file carrying an unknown one, so retiring
  `stakes` alone could not make "the key is gone from the file afterwards" true.
  `unset` on a key the file does not hold returns `ok:true` and changes no bytes.

- **Catalog rows for the twelve `roles.*` keys**, so `/cad-config`'s plain walk
  reaches them like any other key. The exclusion that kept per-role model and
  effort keys out of the catalog existed because the routing cells decided them,
  and the cells are gone.

- **Every role offers every rung.** Eleven new agent files take `agents/` from 19
  to 30, six per rung, which is what lets the interview ask one uniform question
  per role instead of six different ones.

### Changed

- **A role's model and rung are its own two keys.** `roles.<role>.model` and
  `roles.<role>.effort`, with nothing deriving one role's answer from another's.
  An unset model key sends NO model parameter, so that dispatch runs at the
  session's own model - which is not the same as naming a default. A name this
  host does not accept resolves anyway: it is reported in `warnings[]` and the
  parameter is dropped, so a typo can never redirect spend.

- **The review gates and the reviewer tiers take real schema defaults** instead
  of a `null` sentinel meaning "the level decides": `plan` advisory, `diff` off,
  `phase_diff` off, `risk_surface` blocking, and `cheap` for all four reviewer
  tiers. The start rungs default to `high` for the planner, the assumptions
  analyzer, the executor and the verifier, `medium` for the reviewer, and `low`
  for the plan checker.

- **The plan-time risk floor moves two things and nothing else.** A phase whose
  declared `files:` touch an answered surface gets a blocking `plan` review and
  the deep-verify pass turned on, and every role's model and every role's rung
  stay exactly where the user set them.
  `review.triggers.risk_surface.waive_routing_floor` keeps its name with its
  meaning re-pointed at those two effects, and it still cannot reach the
  `risk_surface` review itself. The deep pass has no config key of its own: it is
  `on` when the floor raised and `off` otherwise, with `--deep` the manual
  switch.

- **Escalation climbs exactly one rung.** `model.escalate_on_failure` re-dispatches
  a failed attempt one rung above where it started and holds at the top rung,
  rather than jumping to a retry rung some cell named.

- **The run record says what decided a dispatch.** `model_source` - a dotted
  config key, or `session` when no key set one - replaces `stakes` on the
  `routing.resolve` trace event and on the spawn envelope, which is what keeps
  the record able to answer why a dispatch cost what it did.

## [3.7.11] - 2026-09-03

A gate ran, the input it ran on could not be resolved, and the code treated
"could not resolve" as an ordinary value. Three phases, one claim. An empty diff
because a ref did not exist looks exactly like an empty diff because nothing
changed. A record that could not be written looks exactly like a record that had
nothing to say. A tracker search that never ran looks exactly like a tracker
holding nothing. In each case the caller read the second meaning and carried on.

Risk checks now refuse the range they could not resolve. `risk-check run` and
`status` resolve each end of a range on its own and name the end that failed, so
a `no-diff` refusal keeps the id of the end that DID resolve and states its cause
on the appended row instead of reporting a clean check. The staged scope has one
machine spelling - `--base <ref> --staged`, with `--head` beside it refused - and
a staged record binds to the index it actually read through an `index_id` from
`git write-tree`, the body diffed `<base> <tree>` so the id and the bytes are one
object rather than two reads with a window between them. `verify.md` and
`debug.md` stage the fix before they ask, and read `empty: true` as not-checked.
Every spine caller that would have handed a blocking check a range whose two ends
are the same commit now appends a `risk_check_skipped` event instead - that range
can never match, and a check that cannot match is not a check that passed.

A task on a repository with no `.planning/` can finish honestly. `task.md` states
one completion rule for a record that could not land, in one place, and the skip
arm, the record step and the done step point at it rather than restating it: an
absent planning root reports done and calls the record unrecorded, while a
symlinked trace, a failed stat, `EACCES`, `ENOSPC`, an oversized event or a
failed rotation withholds it. The difference is whether the write failed or was
never owed. The `surfaces-unanswered` refusal is answered in the run - scan with
`detect-surfaces`, ask once, re-run with `--surfaces` - because a bare refusal is
neither a verdict nor a skip, and the answer rides the flag per run rather than
persisting, since persisting it would create the `.planning/` the run is meant
not to create. The done block now names the verdict the seam returned, or the
skip event that stood in for it, and says recorded or unrecorded in words.

Issue filing asks the tracker before its first create. `issue-filing.mjs file`
runs one title-scoped lookup per fire on all three forges, chunked at six
fingerprints, and an issue already carrying a fingerprint is reported by number
instead of filed again - open or closed alike, since a closed duplicate is still
a duplicate. A page that came back filled refuses as `incomplete-lookup` rather
than concluding a miss from a truncated answer; a lookup that could not run at
all falls through to the `FILED.md` ledger; and one payload carrying the same
fingerprint twice spawns one create, collapsed before the ledger is read. An
ambiguous create - the request went out, the answer did not come back - writes an
unconfirmed row that the retry honours, so the second attempt knows something may
already exist. The guarantee is stated at the strength it was measured at, not
at the strength it was hoped for: `lookupMeasured` scopes a complete tracker miss
to the forge whose query was actually measured. GitHub and Forgejo are measured -
the Forgejo half against a live instance on 2026-09-03 - and GitLab's
space-joined query is still an assumption, written into that row in code rather
than into a transcript. Flipping it is one boolean once a GitLab host is there to
measure against.

## [3.7.10] - 2026-09-02

A review ran, and the run record said things about it that were not true. Not
wrong in the sense of a crash, wrong in the sense of a receipt that does not
add up: a fallback reviewer nothing closed, a provider bill dropped on the
floor, a settlement with no home the seam would accept, one human answer
written down as two, and a declared effort nothing ever checked against what
the host actually served.

Cross-model reviews are now priced in their own denomination. The review seam
records the usage the provider reported on its own `provider/request` event,
behind the same credential fence the outbound payload crosses, with the raw
object dropped whole if the fence alters it or it runs past 2048 serialized
characters. `trace render` folds those figures into a `provider_spend`
projection scoped to calls that actually reached a review on the wire, so the
16 `detect-models` and 3 `consult` calls in a typical record no longer get
billed to a line labelled `Cross-model reviews`. That line is what `/cad-report`
prints, and it is never summed into the host's token count, because they are
not the same currency. A scope with no provider review call prints no line at
all; a scope whose events carry no usage key prints `unrecorded`, never `0`.
The three adapters' usage field names are pinned against live provider
documentation (OpenAI `ResponseUsage`, Gemini v1beta `UsageMetadata`, DeepSeek
chat completion), read 2026-09-01. And the empty-set review fallback routes to
the `claude-subagent` arm that brackets and closes it, instead of falling
through to the selection rule and leaving the fire open: one `routing/resolve`
is owed per review FIRE now, before any backend is chosen, including a fire no
claude-subagent serves.

Settlement receipts learned to name their home and their authorization.
`trace append --anchor` takes the earlier window's own SHA, derived through
`correlationId` so a receipt can only name a window of the phase it declares,
which is what a settlement written after a phase re-anchored needs.
`--authorization-id` carries the coordinator-minted id of the human answer, and
an id shared across two disjoint ranges labels the pair rather than settling the
second one: `risk-check status` still answers `unfired` on the range with no
receipt of its own. On the record side, `planning.mjs adjudication --task
<slug>` writes a task's record beside its own artifacts instead of into a
`phases/0/` that does not exist, `--task` is required at `--phase 0` and refused
beside a real phase, and the counts are recounted from the record rather than
taken from the caller. The one hand-written settlement in the tree
(`.planning/tasks/declines-off-the-tracker/`) is now a record the seam produced.
`/cad-suggest` rule R9 counts decisions grouped on the structured trigger field,
not override writes, so one answer over two ranges stops reading as two
overrides.

The last one needed a spike before any code, because the answer was not knowable
from the hook payload. Claude Code 2.1.258 downgrades a dispatched effort
silently, the `SubagentStop` payload cannot see it, and the worker's own
transcript can. So the hook reads the effort the worker ACTUALLY ran at off
`agent_transcript_path` (top-level key only, verbatim, unambiguous-or-nothing)
and carries it on both of its writes beside the rung the dispatch was routed
under. Both land on the bracket row by two routes, the close and the post-pass
`worker_cache` fold, omitted independently when absent. `/cad-report`'s
Dispatches table gains a `ran` column beside `rung` and states a disagreement on
the row it happened on rather than smoothing it into a summary: a dispatch that
reported nothing reads `unrecorded` and is never shown as agreeing. What to DO
about a mismatch, warn or refuse or re-dispatch, is deliberately not in this
release.

Five requirement ids, three phases, 48 commits. `/cad-audit` passed 5/5 with
20/20 acceptance criteria covered and nothing deferred.

## [3.7.9] - 2026-09-01

Three places where Cadence printed a next step you could not take. The command
was reachable, the sentence naming it was not wrong about the work, and the
action itself went nowhere: a question asked before the answer that made it
moot, a door into a project that does not exist yet, and a route computed off
the end of a run rather than the end of the work.

`/cad-task` asked the protected-branch and integration-branch questions before
it classified the description, so a task that turned out to be phase-sized paid
for two prompts and then stopped without ever reaching a commit. The guard runs
after `scope` now and is scoped to the arms that actually commit. The same arm
used to hand a phase-sized task to `/cad-phase add` in a repository with no
`.planning/` directory at all, where there is no roadmap for a phase to be
added to; it branches on what `planning.mjs status` answers and names
`/cad-adopt` and `/cad-new-project` on a treeless tree, which are the two
doors that exist there.

`/cad-progress` read a SUMMARY as the end of the work. It is the end of a RUN.
A `/cad-plan --gaps` plan written after one sat beside it undispatched, and the
route table sent you to `/cad-verify` over plans nothing had executed.
`planning.mjs status` now carries an `outstanding` field, deep-equal to
`replay-check`'s `dispatch_set` off one shared reader, and the route row
consumes it: an executed phase that still owes dispatches goes to
`/cad-execute`. It narrows the executed row rather than inverting it, so a
phase with nothing outstanding still routes to `/cad-verify` exactly as before.
The reason the field lives on `status` and not in a second `replay-check` call
is call count, not bytes: the route table scans every phase lowest-first, and
the alternative was one process spawn per executed phase on every run.

The gap plan the routing fix depends on was writing over `PLAN.md`. Measured on
a fixture: with the gap plan written there, the prior run's
`reports/plan-1.md` still read `PLAN COMPLETE` and `replay-check` answered
`dispatch_set: []`, so nothing routing off the seam could see the new plan at
all. `--gaps` takes the next free plan number now, counting a bare `PLAN.md`
as plan 1.

And the five shipped places that claimed `/cad-progress` resumes paused work
automatically. It offers, and it has always offered; the ask-user gate predates
every one of those sentences. `README.md`, both skill descriptions, the
workflow purpose and what `/cad-help` prints all say offer now, and the
`DOCS-CLAIMS.md` row that had blessed the old wording as accurate carries the
correction, so the next docs sweep does not re-bless it.

## [3.7.8] - 2026-08-30

Five bugs, one shape. In every one of these Cadence already held the answer on
disk and the code standing next to it declined to read it. None of them is a
missing capability, which is what made them worth a cycle: the fact was there,
the next step just never asked.

The adjudication record validated a `fix_commit` value only inside the
`survived` branch, so a blank or junk commit on a `downgraded` or `refuted`
ruling walked straight through the guard the field exists for. That check is
hoisted out now and fires wherever the key is set, and the refusal names both
the field and the ruling it was on. The other half of the same phase: an
`overridden: true` marker used to discharge `trace append`'s strongest refusal,
so a settle receipt carrying no reason at all could close a record still holding
a cleared halt. It cannot. An unreadable record refuses as `bad-record` rather
than passing, while an absent one still passes, which is the distinction that
was missing.

`route.mjs` keeps `stakesSet` for the sole purpose of telling an unset `stakes`
from a configured one, and the project template wrote `stakes` into every new
config before the resolver was ever asked, so the adaptive floor the schema
documents was unreachable on any project Cadence initialised. That is my own
scaffolding defeating my own resolver. The template stops writing the key, and
both faces that report the level now say which of the two states they are in
instead of reporting a schema default as a user's answer. `stakes_set` rides the
`resolve` and `replay` envelopes off `readConfig`'s own flag, with no second
derivation to drift.

`/cad-task` recognises when a task has grown phase-sized and then handed you to
`/cad-context`, which refuses without a phase. It names `/cad-phase add` first
now, and it prints the number the phase will land on, resolved from
`planning.mjs status` rather than guessed. The three other places that stated
the old route, the mid-task guardrail, the skill objective that rides every
session's prompt, and `/cad-context`'s own off-roadmap stop, all name the same
door.

The autonomous close read raw review findings while the rulings sat beside them
unread, so a finding I had already adjudicated and fixed still halted the merge,
and the filing path and the close path each carried their own idea of what
"unfixed" meant. There is one predicate now, `unfixedFromEntries` in
`lib/filing-decision.mjs`, and both read it. `close-decision.mjs` states no
severity of its own and carries a fifth `unruled-review` state for a fire
nothing ruled at all. The wrinkle that made this more than a rewire: the close
prunes the phase directories those rulings live in, so `planning.mjs risk-carry`
copies every `REVIEW-risk_surface*.md` and its `ADJUDICATION-risk_surface*.json`
sibling to `.planning/risk-carry/<N>/` before the prune, and the land that
actually merges is the only thing that clears it. Carry it after the prune and
the gate globs an empty directory, reads that as nothing survived, and merges
over the blocker.

Both append-only records, `.planning/trace.jsonl` and `.planning/reads.jsonl`,
lost events on a contended second rotation. The rotation marker seals its
generation with `carried_bytes` now. A writer that finds a leftover generation
finishes the previous cut's carry-back before destroying it, whole lines only,
skipping what already reached the live record, and a rescue that cannot finish
says `shortfall` beside `rotated: true` instead of returning clean. The
admission check reserves the marker the rotation is about to write, so a line
that fits alone but not beside the marker is refused as `oversized-event` or
`oversized-record` rather than rotating into a record still over its bound. Both
eviction arms confirm the claim they published before they destroy anything, and
restore the sibling when the mtime is not the one they wrote.

`/cad-audit` passed 5 of 5 with 33 of 33 acceptance criteria covered and nothing
deferred. 86 commits off `main`: 36 docs, 22 fix, 14 test, 10 feat, 2 refactor,
2 chore.

## [3.7.7] - 2026-08-29

Two bugs, same shape. Both turned up on real runs rather than on a read, and in
both cases a record Cadence keeps could not represent a state that actually
occurs, so it went quiet instead of refusing.

`.planning/reads.jsonl` had an 8 MiB write-time bound and no rotation at all.
Once you hit it the writer answered `{written:false}` to every append for the
rest of the project's life and nothing told you. It rotates now, into exactly one
prior generation, with a `linkSync` claim so two processes cannot both cut at
once, a 250ms ceiling to wait out an in-flight rotation, and a dated claim
sidecar so a rotation killed halfway does not disable rotation forever. A single
line large enough to reach the bound on its own is still refused, as
`oversized-record`. And the cut is reported: `planning.mjs reads` and
`trace suggest` both carry `reads: {file, rotated?}` now, so a reader can tell
whether the history it is looking at was shortened. Three shipped documents
promised that record is never shortened, which was my own sentence and no longer
true. They say what shortens it and where you find out instead.

The second one bit me reviewing my own work. A blocking `risk_surface` gate
raises findings at every severity but only blocker and high halt it, so the
mediums below the line are confirmed and deliberately not fixed. The adjudication
record refused to store exactly that: a `survived` ruling had to name a fix
commit at any severity, so there was no way to write down "I read this, it is
real, I am shipping anyway" without inventing a SHA. The requirement is gated on
the raised severity now and `survived` means "stood, fixed or not." The same
refusal blocked the override case, where you overrule a FAIL on a blocker, and
that one settles on an explicit `overridden: true` marker rather than a commit
the override cannot produce. The typo guard the requirement existed for is
untouched: `fix_comit` and `overriden` are both still refused as unknown keys,
and the SHA format check still fires unconditionally wherever the key is set.

Downstream of that widening, `issue-filing unfixed` stops offering to open a
tracker issue for work whose fix is already committed, an overridden blocker
reaches the filing set instead of being dropped in silence, and `why record`
prints `fix: 3341ffb0` or `fix: none - confirmed and left standing` on every
survivor, so a fixed survivor and a confirmed-unfixed one no longer render
identically.

Closes GH-145 and GH-159.

## [3.7.6] - 2026-08-28

This was the first time Cadence executed another project of mine end to end
rather than running on itself, and reading that run record back turned up the
same shape twice. The executor's own contract was already lean. The waste was
in what the coordinator did around it.

The first one is the fix pass. When a blocking `risk_surface` gate failed, the
coordinator would go edit the source itself, which meant the fix never went
through a reviewer and the plan's lease never covered it. I was reviewing my
own work by writing it and then filing the paperwork. A FAIL now names a
`cad-executor` continuation under the failing plan's own worker key, at every
FAIL site that has one: `execute.md`'s `risk_surface` arm and its
`diff`-at-`adjudicated` arm, `execute-parallel.md`'s per-plan risk sequence,
and `task.md`'s `--plan` path. `task.md`'s inline path mints no worker key, so
its FAIL still stays with you. `execute.md` also grew a guardrail forbidding
the coordinator any `Edit` or `Write` outside `.planning/`, and a finding that
lands outside the plan's `files:` is cleared by amending `PLAN-<k>.md`, never
by exempting `lease-check`. The re-arm cap is keyed per plan now instead of
per run, so a second plan's fix still gets its one narrowed round rather than
finding the budget already spent by the first.

Second, the executor was running the whole test suite on nearly every turn. It
now verifies a task with the task's own `Verify:` command, falls back to the
test file the task's `files:` map to and runs that by name, and runs the
project's full suite at exactly one site, after the last task's commit and
immediately before the digest. Measured on that same run, bare full-suite
invocations went from 4, 6, 2, 1, 2, 6 per dispatch to 1, 0, 0, 0, and
test-running tool calls per dispatch went from 6.9 to 2.6. A failing targeted
run is re-run targeted until it is green, inside the three-attempts-per-task
budget that already existed, so no second budget was opened.

Both halves are pinned by `prose-agreement.test.mjs`, which reddens if either
sentence is deleted from the contract, and by a paired assertion against the
verifier contract so the two cannot drift apart.

One thing worth knowing if you go looking for the same measurement in your own
`reads.jsonl`: it records the program a Bash call ran and the files it named,
never the command text, so `python3 -m pytest` and `python3 -c` are the same
record. Count on the program your project actually runs tests with, or the
number will be noise.


## [3.7.5] - 2026-08-27

This cycle had no subject, it had a standard. Every open issue got re-triaged
against one question, would a user running Cadence on their own project ever
feel this, or does it only bite while Cadence is being developed on Cadence.
Eight answered the first way and those eight are the release.

The hard block was the forge. `git.forge_host` only ever accepted a bare
hostname, so anyone whose Forgejo lives on `forge.example:3001` could not state
that at all, and Cadence would happily wire an origin at the default port and
then fail to talk to it. The key now takes `host[:port]`, the grammar is
enforced at the config write face rather than at the first call that trips over
it, and the port is carried whole into the `tea` login match and into
`forge.mjs create`. `create` also refuses a `--remote-url` whose port the
configured instance does not serve, instead of wiring a wrong-port origin
silently, and it refuses a `--remote-url` on a row whose create wires `origin`
itself rather than letting the two fight.

`/cad-execute` could pay for the same work twice. If a session died between the
last task's commit and the SUMMARY write, the phase derived as `planned` again
and the next run re-dispatched every plan on top of committed work.
`/cad-execute` now reads each plan's `reports/plan-<k>.md` first line before it
spends anything, refuses a phase whose every plan already reports
`PLAN COMPLETE`, and dispatches only the plans that do not.

The risk gate was tripping on its own paperwork. A `risk_surface` finding that
quoted a destructive command got stored verbatim in the adjudication record, and
committing that record re-tripped the very gate that produced it, so reviewing
your own work meant overriding a blocking gate to file what the gate had told
you. `risk-check run` now withholds the four stored-reviewer-text artifacts
under `.planning/phases/` from the range it reads. The withholding is by path,
so every category and every signal still fires exactly as before.

A killed rotation used to disable rotation forever. `trace.jsonl` claims a
rotation with a lock, and a SIGKILL or a host timeout mid-rotation left that
claim behind with nobody to release it, so the record stopped rotating and every
later append paid about 266 ms for the privilege. The claim now dates itself
with a sidecar, a claim older than 30 s is evicted and rotated by the next
append, and the stamp is written private and published only by an arm that owns
the claim so a losing append never restarts the clock. One rotation lost instead
of all of them.

Last, `recall` did not fold suffixes, so a query for `seam` missed every
document that said `seams` and `close` missed `closes`. Porter steps 1a and 1b
now run inside `tokenize`, which is the one site both indexing and querying
already pass through, so index time and query time are identical because there
is one code path rather than two that agree. A 30 document fixture corpus and a
16 query named-hits baseline are committed under `cadence-core/bin/fixtures/`
and run in the suite, and 14 of the 16 queries return the same top hits they did
before the fold. The fold is steps 1a and 1b only: `verifies` and `verify` are
still two terms, and nothing here claims otherwise.

Five phases, 53 commits off `main`, 8 feat against 7 fix. Eight requirement ids,
all traced to a verified phase: `FRG-03`, `FRG-04`, `FRG-05`, `FRG-06`,
`EXP-03`, `RSK-06`, `TRC-09`, `RCL-08`. `/cad-audit` PASS on both arms, 8 of 8
requirements traced with 0 broken, 23 of 23 acceptance criteria covered with 0
breaks. UAT 38 passed, 0 failed.

Two items from the recall issue did not ship and are recorded rather than
dropped: the multi-query union, which changes the `recall` seam signature three
callers pin, and the failure records sitting outside the corpus, which needs a
scope decision this cycle did not take.

## [3.7.4] - 2026-08-27

`v3.7.3` fixed the instruments. This cycle spent what they measure, and the
honest result is that the one number it existed to take came back inconclusive.

A dispatch is priced by what it is handed, so the cycle started there. A plan's
declared read set is now a measured number with a reported ceiling
(`workflow.max_plan_bytes`, default 675,000), and the plan-time risk floor stops
reading an import statement or a constant declaration as evidence that a file
touches a risk surface, which is what was quietly escalating plans into
expensive routing cells. Then the rung sentence came out of all 19 agent bodies
so a role's rung files share one byte-identical prefix, and the record grew the
prompt-cache figures that would show what that recovers.

It does not show it yet. The after side is two `cad-verifier` dispatches at
1,952,026 cache reads and 89,744 cache creations each, against a before side of
33 dispatches averaging 1,635,645 and 83,790. Both moved UP, +19.3% and +7.1%,
which is not the shape of a prefix-reuse win. The two populations are not
comparable: the after side ran back to back in one session against a byte
identical prompt and the before side is spread across many sessions with
different prompts and different lengths. The figures now accumulate
automatically on every dispatch, so the real comparison costs nothing to take
later, and this release does not claim a win it has not measured.

The cycle also closed a defect that would have taken the record with it.
`.planning/trace.jsonl` was 604,183 bytes, 57.6% of a 1,048,576 byte cap that
refused every append past it, forever, with no rotation. At the recent rate that
was about eleven days out.

Four phases, five requirement ids all traced to a verified phase: `BUD-03`,
`RSK-05`, `RNG-03`, `TRC-07`, `TRC-08`. UAT 29 passed, 0 failed, 1 skipped.
16 feat against 6 fix, where `v3.7.3` ran 7 against 7.

### Added

- **A plan's read set is a measured number** (`BUD-03`). `workflow.max_plan_bytes`
  (int, default 675,000) and `plan-size --max-bytes` report what a plan's `files:`
  declares, with an `absent` count beside the total, at `/cad-plan`'s size check.
  A crossing is reported as `plan-too-many-bytes`, never a refusal.

- **Every routing replay row carries the bytes it read.** 29 rows,
  `regressions: []`, and a row whose evidence changed says so in the floor's own
  words rather than silently scoring differently.

- **CI refuses a rung file that drifts from its siblings.** A new self-verify
  check, `rung-prefix`, fails the build when a role's rung bodies stop being
  byte-identical, so the shared prefix cannot be foreclosed again by an edit
  nobody noticed.

- **The record carries prompt-cache traffic for every worker that stopped**
  (`TRC-07`). A `worker_cache` fact is written on all three of the
  `SubagentStop` hook's withholding gates and folded onto its bracket at render
  time by `corr` plus `agent_id`. A gate that refuses to close a bracket can now
  still state a fact, which is what made the figures unreachable before.

- **The run record rotates instead of dying** (`TRC-08`). At the size bound
  `.planning/trace.jsonl` rotates and the append lands, carrying the in-flight
  run's tail from the newest phase anchor so a run keeps its correlation id and
  its brackets across the cut. One generation is kept, the rotated sibling is
  gitignored, and `trace render` and `trace suggest` both name the record they
  read and report that a rotation happened.

### Fixed

- **The risk floor stops counting an import as a risk surface** (`RSK-05`).
  Import statements and literal-bound constant declarations no longer evidence a
  surface at plan time, and a file whose only evidence sat on a withheld line is
  named in `withheld` rather than dropped without a word.

- **The hook reads the stopped worker's own transcript.** It was reading
  `transcript_path`, which names the orchestrator's session and is a different
  actor's traffic entirely. It now reads `agent_transcript_path` with no
  fallback, so a payload naming no worker file supplies no evidence instead of
  the wrong one's.

- **A stop arriving after its own bracket closed stops adopting a dead run.**
  It states its figures against the bracket it belongs to rather than claiming a
  stranded dispatch from a run that ended days ago.

- **The larger cache read wins at all three folding sites**, replacing a
  first-wins rule and a last-wins rule that disagreed with each other.

### Changed

- **Six roles, one body each.** The rung sentence is gone from all 19 agent
  files (`RNG-03`), so each of the six roles carries exactly one distinct body
  across its rung files and they can share a cached prefix. The plan checker's
  rung arrives in its dispatch prompt instead. Routing is unmoved: all 18
  (level, role) cells still pinned, 160 of 160 route tests green.

- **`/cad-progress`, `/cad-report` and `/cad-suggest` state the retention rule**
  beside `capped`, and say where the dropped events went, so a reader of a
  rotated record is not left to infer it.

### Known issues

- **An abandoned rotation claim disables rotation permanently**
  ([GH-146](https://github.com/crenshawdev/cadence/issues/146)). The claim is a
  hard link released only by its own `finally`, so a kill between the link and
  the swap leaves the sibling as a second name for the live record. Every later
  writer then reads a rotation as in flight forever: appends still land and
  nothing write-deads, but the record never rotates again and each append pays
  about 266 ms. Clearing it means deleting the sibling by hand.

- **`.planning/reads.jsonl` still write-deads exactly as the trace did.** It
  refuses at its own 8 MiB bound with no rotation and shares none of this code.
  Measured 2026-08-26 on this repository: 7,293,864 bytes, 86.9% of the bound,
  where the trace was at 58.1% when this cycle opened it. It is the same defect,
  closer to firing.


## [3.7.3] - 2026-08-26

The figures this repository argues about its own cost with were wrong, and the
cycle opened to fix the instruments before spending anything on the cost. Three
of them could not be trusted. `renderTrace`'s close dedup paired a delayed
repeat close with the NEXT dispatch of the same worker key, so on a retry the
bracket carried the wrong figures and the role was billed for all three
terminals. `duration_ms` was written onto every bracket and read by nothing. No
cache figures were recorded at all.

The cycle closed at phase 1 rather than running the three phases planned after
it. Half its code commits were fixing the other half, 7 fix against 7 feat where
`v3.7.1` ran 27% and `v3.7.2` 22%, four of those seven were four passes at one
question - which in-flight dispatch an async `SubagentStop` callback belongs to
- and one real defect landed after the phase's UAT reported 8 passed and 0
failed. All three remaining phases sat on that same subsystem. Their five ids
are deferred intact with their promote conditions, and phase 2's gathered
context is recoverable from git rather than re-gathered.

One phase, four requirement ids all traced to a verified phase: `TRC-04`,
`TRC-06`, `MSR-05`, `TRC-05`. UAT 8 passed, 0 failed, 2 skipped.

### Added

- **A bracket records cache traffic** (`TRC-05`). The prompt-cache read and
  creation figures land on the bracket row and not on the roles bill, so a
  caching claim can be measured before and after a change. A close carrying no
  figures omits the keys rather than writing zeros, and `roles.tokens` is
  byte-identical whether they are present or not.

- **The worker's own wall clock has a reader** (`MSR-05`). `/cad-report` and
  `/cad-suggest` price a dispatch with `duration_ms`, printed beside the step's
  own elapsed time so the orchestrator's share is visible rather than folded in.

### Fixed

- **A delayed repeat close stops stealing the next dispatch** (`TRC-04`).
  `renderTrace`'s dedup now pairs a repeat close with the dispatch it belongs
  to. Reproduced before the fix on a six-line fixture: brackets `[1000, 9999]`
  where the second should have been 2222, and `roles.tokens` 13221 for two
  dispatches.

- **The stop close lands on the worker that actually stopped** (`TRC-06`), bound
  by `agent_id` rather than inferred from clocks, and it writes nothing at all
  for a worker whose own transcript says it has not terminated. Refusing is a
  delivered outcome and not a shortfall: the `dispatch` event is written before
  the subagent exists, so it carries no id to match against, and no ordering of
  dispatch instants separates two workers dispatched in one message.

- **A bracket spans to the later close, not the first.** Found after the phase's
  UAT passed clean, which is why the remaining phases on this subsystem were
  deferred rather than planned.

### Changed

- **Workflow prose keeps the instruction; the rationale moves out of the runtime
  path.** The four most-read workflows were carrying two jobs, telling the model
  what to do and defending each step to a reader who is not there at runtime.
  The defence now lives in `docs/rationale/`, which nothing loads:
  `plan.md` 33,848 to 28,764 B, `execute.md` 33,385 to 29,001 B, `context.md`
  20,196 to 19,378 B, `verify.md` 18,292 to 17,626 B. No step was removed and no
  gate weakened. Justification that is load-bearing on the model stayed inline,
  and `prose-agreement.test.mjs` is what decides which that is: it caught a
  sentence moved out of `execute.md`'s `state` step that had to stay.

- **The weight manifest says what it enforces.** `weight-budgets.json` has been
  a CEILING since exactness was abandoned for taxing shrinking at the same rate
  as growth, but the census marker, the registry row and the manifest comment
  all still described it as an exact byte size. The comment now also states the
  convention the ceiling cannot enforce on its own: lower the entry in the same
  commit as a deliberate cut, or the surface grows back into headroom it no
  longer needs.

## [3.7.2] - 2026-08-26

Two reference files were loaded on every run whether or not the branch they
held was the one in play. `references/seams.md` was 25,068 B and
`references/review-triggers.md` was 40,413 B, and between them they carried
nine seams and triggers of which a given command needs one. This cycle splits
both behind a router and pins every branch with a check, so a router that loses
a cold file or stops Reading one reddens instead of quietly serving a stale
index.

The other half is the trace record. A lifecycle bracket was opened by the
orchestrator and closed by the orchestrator, so a session that died between the
two halves left the dispatch open forever, and an open bracket read the same
whether the worker was still running or the session had gone. `SubagentStop`
now writes the close. The hand-written one is kept rather than replaced,
because it is the only writer that carries the figures, and whichever close
arrives second folds into the first's row.

Three phases, 40 commits off `v3.7.1`, seven requirement ids all traced to a
verified phase: `LOD-06`, `HOK-01`, `HOK-02`, `TRC-02`, `TRC-03`, `CEN-03`,
`DOC-04`. `/cad-audit` PASS on both arms, 14 of 14 acceptance criteria covered.

### Added

- **A reference router, so a run loads the branch it selected.**
  `references/seams.md` is now 2,323 B over `seam-ask-user.md`,
  `seam-spawn-agent.md` and `seam-review-provider.md`;
  `references/review-triggers.md` is 20,153 B over `risk-surface.md`,
  `review-cross-model.md` and `review-record.md`. Down from 25,068 and 40,413.
  `cadence-core/bin/lib/reference-routers.mjs` registers all seven branches and
  self-verify check `reference-routers` fails when a branch loses its cold file
  or the router stops Reading it. 42 citations across 18 surfaces were
  re-pointed at the file that holds the rule, so no prose surface cites the seam
  family where it means one seam.

- **The host closes the bracket.** A `SubagentStop` hook runs
  `cadence-core/bin/subagent-trace.mjs` and writes the lifecycle close for a
  dispatch that returned, so a bracket survives the session that opened it. The
  hand-written `trace close` is kept, not replaced: it is the only writer that
  carries the token, turn and duration figures, because the stop payload holds
  none. Two closes of one dispatch render as one bracket, deduped on
  `(corr, phase, plan)`, with no second `unpaired` row and no double coordinator
  span.

- **`--duration-ms` on `trace append` and `trace close`.** It takes the host's
  own spelling (`1m 23s`, `450ms`) or a plain millisecond count, so the figure
  is copied rather than converted, and a mistyped spelling is refused with
  nothing appended. Every bracket whose close reported one now carries
  `duration_ms`, which is the only figure for how long the WORKER ran; the `ms`
  on a bracket row is dispatch-to-close wall clock and includes the
  orchestrator's own time between the two writes.

- **self-verify pins the hook event names Cadence registers.** Check 25 reads a
  hand-maintained `HOOK_EVENTS` register, so a host that renames `SubagentStop`
  fails a check instead of going silently quiet.

- **A census over the `planning` test group.**
  `cadence-core/bin/test-groups.test.mjs` compares `GROUPS.planning` against the
  `planning-*.test.mjs` files on disk in both directions: a file no entry names
  fails, and an entry with no file fails. No stem count is written down, so a
  new planning test costs one list edit rather than two. It found its first
  drift immediately, `planning-capture-check` was on disk and running under
  `other`.

### Changed

- **The plugin's home is GitHub again.**
  `https://github.com/crenshawdev/cadence.git` is the published source and the
  install URL. This reverses the move recorded in v2.0.0, which made the
  self-hosted Forgejo remote the only published source; Forgejo is now the
  mirror. The README badge, the README and DESIGN install commands, and the
  plugin manifest's `homepage` all follow it, and the release link references
  below resolve to GitHub releases, which exist for every tag from v1.1.0-rc.1
  forward. An existing Forgejo-installed user follows it with three commands:

  ```
  /plugin uninstall cadence@cadence
  /plugin marketplace add https://github.com/crenshawdev/cadence.git
  /plugin install cadence@cadence
  ```

  Nothing about the plugin itself changes with the move.

- **The host-return dependency is stated where a reader finds it.**
  `references/seam-spawn-agent.md` now says which three figures Cadence reads
  off a subagent return, that every one of them is copied by hand out of the
  host's own rendering of `Done (N tool uses - X tokens - Ys)`, what each funds,
  and that the rendering can change in any release with no deprecation window.
  Nothing in Cadence can fix that. The mitigation already in force is that a
  return carrying no figure omits the flag rather than sending `0`, so the
  record degrades to "this run was not measured" instead of a fabricated zero
  that reads as a measurement.

- **`role` on every `unpaired[]` row**, so an open dispatch names the role it
  was opened under instead of leaving you to guess from the worker key.

- **`CADENCE-CENSUS` has a prose home.** `references/conventions.md`'s
  `## Deliberate shortcuts` describes the marker grammar, the token, the
  immediate colon, the id, the ` | ` separator and the `asserts:` clause, states
  the one rule that a marked site with no registry row fails the suite, and
  points at `cadence-core/bin/lib/census-registry.mjs` for the rest.
  `CADENCE-DEBT` already had one.

### Fixed

- **Two headers argued against the check sitting beside them.**
  `cadence-core/bin/test.mjs:11-15` said there was deliberately no coverage
  check over the test manifest, and `census-registry.test.mjs:19-21` cited that
  as settled rationale. The check exists now, so both headers describe what is
  on disk.

- **The seam-call header named a plan no reader can locate.**
  `cadence-core/bin/seam-calls.test.mjs` cited a phase 5 plan as the source of
  the 5-for-`context.md` figure it argues against. It came from v3.3.0 phase 4's
  `PLAN-2` task 6. The header names the archive path now, so the claim is
  checkable rather than taken on trust.

- **The router's own Read check had a hole in it.**
  `lib/reference-routers.mjs` tested the raw router text where the neighbouring
  arm read prose only, so a cold path appearing solely inside a fenced example
  satisfied the check. This cycle's own blocking `risk_surface` gate found it,
  and the narrowed re-arm round came back clean (`caa07bfb`).

### Known gaps

- Nine literal `trace close` command lines under `cadence-core/workflows/` and
  `cadence-core/references/` still spell `--tokens ... --turns ...` with no
  `--duration-ms`, so an orchestrator copying one verbatim records no wall clock
  for that role. Deliberately out of scope this cycle.

## [3.7.1] - 2026-08-25

`.planning/CAPTURE.md` was a queue nothing drained. Measured at the open: 276
walked bullets across 584 lines and 251,968 bytes, read by `/cad-plan` on every
planning pass, most of it long settled. It had been swept by hand once already,
185 open items archived as a single block on 2026-08-08 after accumulating
across nine milestones, and it regrew to 276 in sixteen days. The cause was the
item grammar. It had two states, `- [ ]` and `- [x]`, and `[x]` meant done, so a
decision NOT to do something had no representation and stayed indistinguishable
from live work. Rejections got written into the bullets instead, so adjudicating
an item made it longer rather than making it go away.

This cycle makes the repository's own issue tracker the record. A gate that
declines to fix a finding asks once, in the step that made the decision, and
files the result on the tracker at that moment. CAPTURE holds the phase in
flight and nothing else, and phase close now ASSERTS it is empty rather than
performing a roll-out. Three more phases rode along: the census registry and the
plan-time lease check that were costing half of all executor checkpoints, the
`planning.mjs` split, and the phase-directory spelling fix.

Six phases, 135 commits off `v3.7.0`, ten requirement ids all traced to a
verified phase: `FRG-01`, `FRG-02`, `CEN-01`, `CEN-02`, `CAP-01`, `CAP-02`,
`CAP-03`, `SPL-01`, `SPL-02`, `LOD-02`. `/cad-audit` PASS on both arms, 33 of 33
acceptance criteria covered across five phases.

### Added

- **A finding this run will not fix goes to the tracker, not to a file.** When a
  gate produces findings it declines to act on, the blocking arm's
  below-blocker remainder, the adjudicated arm's non-survivors, any
  `recorded not fixed` disposition, you are asked ONCE for that fire with the
  whole set listed, and nothing is written to CAPTURE either way. Accepted
  findings become issues immediately. A declined one is filed too, carrying the
  `cadence-declined` label, because that labelled issue is the only thing that
  stops a later fire asking about the same finding again. The set that reaches
  the ask is read off the structured adjudication payload rather than re-parsed
  out of review prose. `cadence-core/bin/issue-filing.mjs` over the pure
  `lib/filing-decision.mjs`, with one pinned create and lookup argv per forge
  (`CAP-01`, `CAP-02`).
- **`.planning/FILED.md` keeps a filed finding reachable by recall.** An issue
  number on a tracker is not searchable from inside the planning corpus, so each
  filed finding leaves a row that `recall` walks last, ranked below live
  material rather than absent from it (`CAP-02`).
- **Phase close asserts the queue is empty.** `phase-done` now returns a
  `capture` field counting SUBSTANTIVE bullets across `Todos`, `Seeds` and
  `Notes`, and names each survivor with its section, line and text. It does not
  count the `- None.` placeholder, so a freshly created queue reads as empty
  rather than as three items. `/cad-health` prints the same verdict, both faces
  reading one command (`planning.mjs capture-check`), and
  `planning.max_capture_bullets` (default 40) is a bound that reports loudly and
  refuses nothing (`CAP-03`).
- **An item is resolved by REMOVAL, never by annotation.** The rule is stated in
  the triage reference and enforced by a check that fails when a walked bullet
  carries a re-verification annotation. Self-verify check 23
  (`capture-writers`) is the other half: it names every code path permitted to
  write the file, so a future workflow cannot quietly start routing durable
  records back into it (`CAP-03`).
- **Cadence resolves a forge when it sets a project up.** `/cad-new-project` and
  `/cad-adopt` both detect which forge CLIs are installed, `tea`, `gh`, `glab`,
  through the existing `lib/on-path.mjs`, ask which provider to use and what the
  repository is called, and persist the answer in `git.forge_provider`,
  `git.forge_repo` and `git.forge_host`. An already-configured repository is not
  re-asked. Where `origin` resolves, it supplies the default and you confirm
  rather than retype, and it guesses a provider only for hostnames the existing
  classifier recognizes. Repository creation runs through the selected CLI
  behind an explicit confirmation naming the provider, the owner and the name,
  private on all three arms. No provider detected, or none selected, refuses
  with a reason naming what was looked for and a hint naming the install. No
  third-party stdout or stderr reaches the envelope (`FRG-01`, `FRG-02`).
- **Every hand-maintained census in the repository is registered.** A census is
  a count a human wrote down that the code must keep true, and nothing knew they
  existed as a class, which is why a plan could omit one without noticing.
  `lib/census-registry.mjs` carries twelve deeply frozen rows naming the file
  holding each count, what it counts, the site that asserts it and its narrow
  subject paths. A site carrying the `CADENCE-CENSUS` marker with no registry
  row reddens the suite naming the file and the assertion, proved by a fixture
  pair differing only in the id, so the registry cannot silently fall behind the
  tree (`CEN-01`).
- **A plan that will invalidate a census is refused BEFORE an executor starts.**
  `lease-check --plan-time` reads a PLAN's `files:` lease against the registry
  and names every registered census file the declared work would invalidate but
  the lease does not declare. It reads the lease and the registry only. It
  spawns no `git` and executes nothing from the plan. `/cad-plan` fires it after
  PLAN.md is written and before any dispatch, so the fix is to amend the lease
  rather than to discover the problem 150,000 tokens into a halted execution.
  This was the single largest source of wasted executor spend on this project:
  20 of 39 checkpoints in one phase (51%), 7 of 15 on a second repository (47%),
  worth 14.8% and 17.4% of executor tokens respectively. Replayed against the
  lease that halted at 0 of 8 tasks, the arm names both missing files before any
  execution (`CEN-02`).
- **A census refusal is distinguishable from ordinary lease noise.** The
  commit-time arm now returns `undeclared-census-files`, carrying the
  `census_files` list and its own trace event, beside the byte-identical
  `undeclared-files`, so a plan-time arm that stopped firing surfaces as its own
  signal (`CEN-02`).

### Changed

- **`planning.mjs` is 30 per-command modules behind a 360-line entry file.** The
  32 `cmd*` handlers moved to `cadence-core/bin/planning/`, leaving dispatch and
  the `COMMANDS` table, with 28 shared symbols in `planning/core.mjs`. A
  dispatch touching one command stops paying a whole-file read. The test file
  split the same way into 21 per-command stems, all named in the runner's
  `GROUPS.planning`, and a new `citation-census.test.mjs` fails by name when one
  of the seven pinned citations goes stale rather than pointing at moved code
  (`LOD-02`).
- **One spelling per phase, enforced at every face that resolves `--phase`.**
  `PHASE_DIR_NAME` tightened to `/^[1-9]\d*(?:\.[1-9]\d*)?$/` and moved to one
  home, so `1.00`, `1.01` and `2.0` are drift while `1.1`, `1.10` and `8` stay
  legal. `phaseSpellingCollision` is wired into `fireIdentity` ahead of the
  token rails, which reaches all 21 census-pinned callsites instead of each one
  wiring the check by hand, and `phase-spelling.test.mjs` registers those
  callsites as a census so an unguarded path-resolving callsite fails the suite
  naming itself (`SPL-01`).
- **Two legal names that parse to one number are reported rather than
  resolved.** `phase-dir-collision` is its own drift kind in `planning/status.mjs`:
  picking a winner silently is what makes the second directory invisible
  (`SPL-02`).
- **`## Archive` left the capture contract.** Moving settled items to a heading
  in the same file keeps the recall walk clean and changes nothing about the
  bytes, which this repository's own 185 archived bullets had already proved.
  The phase close also stops filing open items into the transient queue.

### Fixed

- **`lease-check --plan-time` failed OPEN on a lease it could not read.** An
  empty or unparsed declared set produced an empty at-risk list, which was
  indistinguishable from a lease that genuinely puts nothing at risk, so the
  gate passed exactly the case it was built to catch. The commit-time arm on the
  same file failed CLOSED on the same signal. Two fail-closed arms now sit above
  `censusesAtRisk`, `unparsed-lease` and `empty-lease`, each carrying its own
  hint. Two signals rather than one because a misspelled key such as `filez:` is
  a structurally valid key line producing zero `frontmatter_issues`. A lease
  declaring one real path still passes, so this is fail-closed and not a blanket
  refusal.
- **The census registry left out the one file that had already stopped a
  phase.** `seam-calls.test.mjs` was excluded as "derived, never baselined",
  which is true of its header arithmetic and false of its assertion. Its
  `seam-call-counts` row and marker are in, and the pre-correction worked
  example is out of the registry header so it cannot be read as guidance.

## [3.7.0] - 2026-08-24

Cadence stated its failures in its own vocabulary and never stated the remedy.
A seam that refused handed you a kebab-case token, so the token WAS the error
message. At the open this was measured across `cadence-core/bin/` with tests
excluded: 186 sites set a literal `reason` and 13 set a literal `hint`, and all
13 of those lived in two files. The ratio had also been getting worse rather
than better, 130 against 10 when the issue was filed, which is why this cycle
ships a check and not only a sweep.

Two phases, 34 commits off `v3.6.1`, three requirement ids seeded at the open
and all three traced to a verified phase: `HNT-01`, `HNT-02` and `SCP-01`.
`/cad-audit` PASS on both arms, 13 of 13 acceptance criteria covered.

### Added

- **A hintless refusal is now a build failure.** `self-verify.mjs` check 22
  (`refusal-hints`) walks every refusal site under `cadence-core/bin/` and
  reports any in-scope one carrying no `hint`, naming the file and the reason
  token. The rule and its exclusion register live in
  `cadence-core/bin/lib/refusal-hints.mjs`, and the register is a PARAMETER
  rather than a constant, so a test hands the check a substitute register and
  the reported set changes with it. A sweep fixes a count once; this is what
  stops the 187th refusal shipping without a next step (`HNT-02`).
- **A repo-scoped config key refuses at the layer that cannot honour it.**
  `config.mjs set git.auto_close=true --global` now returns `ok:false` at WRITE
  time, naming the key's scope and telling you to use `--file <repo config>`
  instead. Previously it applied silently and the repository, which never opted
  in, only complained when the close refused at land time. The rule reads a new
  `repo_only` schema marker rather than a list of key names, proved by a test
  that substitutes a schema fixture marking a different key and shows it refused
  with no line of the rule changed. It resolves the layer from the target FILE
  rather than the flag, so `--file $CADENCE_GLOBAL_CONFIG` and the same path
  spelled with `/./` refuse identically, and it runs inside `checkPairs` ahead
  of every read and write, so a multi-pair set carrying one marked key leaves
  the target byte-identical (`SCP-01`).
- **`config.mjs check --global`** reports the same per-pair scope error the
  write face refuses on, so the inspect face can answer what `set` will do
  before you run it (`SCP-01`).

### Fixed

- **Every in-scope refusal names its next step.** 243 in-scope refusal sites
  under `cadence-core/bin/` now carry a plain-language hint, down from 215
  hintless when check 22 first went in. `planning.mjs` alone accounts for 154 of
  them, the largest user-facing refusal surface in the plugin. The `fail`
  wrappers in `config.mjs`, `route.mjs` and `review-provider.mjs` widened from
  `(reason, detail)` to `(reason, detail, hint)` to carry them. No reason token
  string changed: they are matched by tests and by callers, and renaming one is
  a breaking change dressed as a wording fix (`HNT-01`).

### Known

- **The new scope check is not bound to the file it clears.** `config.mjs`
  resolves the layer identity from a pathname, then re-resolves that same
  pathname for the read and again for the atomic write, so a directory or
  symlink swap landing in that window writes through a path the check already
  cleared. This is not a regression, since before this release `set` applied the
  pair with no layer check at all, but it does mean the refusal is defeatable by
  a local attacker who can win the race. It was raised by the blocking
  risk-surface gate, confirmed against the code by the phase verifier, and
  accepted deliberately rather than missed. Binding the check to an opened
  descriptor through a temp-and-rename write is its own piece of work.

## [3.6.1] - 2026-08-23

`v3.6.0` shipped `/cad-why` and then wrote down three things wrong with it. This
patch cycle closes those three and nothing else: no new command, no new surface.
All three were measured before the fix and re-measured after, which is the only
reason the third one changed the number it was supposed to defend.

One phase, 19 commits off `v3.6.0`, three requirement ids seeded at the open and
all three traced to a verified phase: `WHY-02`, `WHY-03` and `WHY-04`.
`/cad-audit` PASS on both arms, 6 of 6 acceptance criteria covered.

### Fixed

- **The chain says what its own history simplification dropped.** The bare-path
  arm inherits git's default simplification, so `/cad-why` was returning 7 of the
  10 commits `--full-history` reports for `lib/release-decision.mjs` and saying
  nothing about the other three. It now measures the excluded set and states it
  in the rendered text: the count, how many are merges, the shas, and the
  `git log --full-history` invocation that shows them. A path with nothing
  excluded renders no block at all, so the statement is about a real gap rather
  than a line every chain carries. `--follow` and `--full-history` do not
  compose, so the simplification is kept and named instead of dropped
  (`cadence-core/bin/lib/why-corpus.mjs`, `lib/why-render.mjs`, `WHY-02`).
- **The entry cap carries a claim measurement supports.** `DEFAULT_TOP` was 10
  with a comment asserting ten entries stayed under the 10,000-byte line in
  `references/conventions.md`. Measured, it did not: `planning.mjs` rendered
  15,637 B. The cap is now 6, re-measured after the exclusion block landed rather
  than inherited from the plan, and `why-render.test.mjs` reads a parseable
  `// MEASURED CAP:` line out of the module source and asserts it equals
  `DEFAULT_TOP`, so the number and its stated reason cannot drift apart again
  without a red test (`lib/why-render.mjs`, `WHY-03`).
- **`closeOver` orders by instant, not by string.** It compared `%cI` timestamps
  as strings, and ISO-8601 values under different UTC offsets do not string-sort
  chronologically, so a mixed-offset pair straddling a prune could attach to the
  wrong close. It now parses both sides and guards an unparseable date by
  returning null rather than throwing. The pinning test was proved to fail
  against the string-compare implementation (`lib/why-corpus.mjs`, `WHY-04`).

### Changed

- **The cap's header no longer claims to bound bytes.** It opened with "the
  response is bounded by truncating the entry count" and supported that with a
  three-path table. The phase's own verify pass swept every tracked path: 63 of
  548 render at or over the 10,000-byte line at the shipped cap, worst 30,825 B.
  The cap bounds entry COUNT; per-entry join bytes are unbounded, and no cap that
  still shows useful history changes that. The header says so, names the measured
  range instead of three samples, and points at relocating the bytes the way
  `lib/bulk-output.mjs` does as the fix that would actually bound it
  (`lib/why-render.mjs`).
- **The `WHY-02` account is corrected at all three sites it was stated.**
  `ROADMAP.md` and `PROJECT.md` recorded the three missing commits as
  `_archive-v2.2.0/3` phase commits collapsed into merge `0bf62847`. Measured
  three times independently, that is false in both halves: `0bf62847` is
  single-parent and is already one of the reachable 7, and the three
  `--full-history` adds are the merges `b86fc25c`, `051f0df1` and `9237a539`.
  The five `_archive-v2.2.0/3` commits are not ancestors of `HEAD`, so no
  `git log` flag reaches them.

## [3.6.0] - 2026-08-23

The Core Value at the top of `PROJECT.md` claims that what Cadence writes down
comes back on its own at the moment it matters, and until this cycle that was
the one claim in this project with no evidence behind it. Everything the gates
write was written by a gate and read by nobody. Recall shipped as a BM25
subcommand injected into `cad-context`, `cad-planner` and `cad-debug`, and
nothing anywhere checked that it landed (#190). The `.planning/` corpus could
already answer "why is this code like this" and there was no command that walked
the join (#192). And the path most real work actually takes left the corpus a
hole exactly where the work went: `/cad-task` produced commits recall could not
find, ran no risk check on its committed range, and opened no trace bracket, so
per-role accounting missed the path most runs use (#191).

Three phases, 66 commits off `v3.5.9`, five requirement ids seeded at the open
and all five traced to a verified phase: `WHY-01`, `RBK-01`, `FST-01`, `FST-02`
and `FST-03`. `/cad-audit` PASS on both arms, 21 of 21 acceptance criteria
covered.

### Added

- **`/cad-why <path>[:<line>]` walks the record join.** It takes a path, or a
  path narrowed to a line, and joins the commits that touched it to six record
  edges: the phase, the plan task, the numbered decision, the deviation, the
  surviving review finding and the declaring task. It reads four tiers, the live
  `phases/<N>/` directories, the `_archive-v<ver>/` directories, task records,
  and milestones already pruned out of the live tree and recovered from git
  history, and where no tier answers it names the gap in words rather than
  returning an empty chain (`cadence-core/bin/why.mjs`, WHY-01).
- **`planning.mjs cite-count` measures whether recall was read.** Per item it
  counts what the recall pass surfaced against what the produced plan actually
  cites. `/cad-plan` runs it at both of its points, `count_planned` and
  `count_committed`, including the under-threshold inline arm, and the `done`
  report carries a `Citations:` line that names a plan citing none of a
  non-empty surfaced set. It reports and does nothing about it, by design
  (RBK-01).
- **The three readings a bare count cannot separate are distinct on the
  record.** Backend off, surfaced nothing, and cited nothing were one number
  before; `cite-count` now tells them apart on the envelope and in its own
  `outcome`-family `cite_count` trace event, which carries `{written, reason}`
  (RBK-01).
- **`/cad-task` leaves a record.** The fast path now writes
  `.planning/tasks/<slug>/RECORD.md` through a `task-record` seam that derives
  every figure from the committed range. The recall corpus reads it as a tier,
  `/cad-why` merges it as a commit tier and renders a resolved task as a task
  rather than as a phase, and the run brackets itself under a per-run phase-0
  correlation anchor so `cad-task` finally appears in per-role accounting
  (FST-01, FST-02, FST-03).

### Fixed

- **A symlinked planning artifact could put bytes from outside the tree onto a
  seam's stdout.** `readArtifact` in `lib/why-corpus.mjs` followed a joined
  name's own symlink, which put the escape that `phaseDirsIn` guards per
  directory back one level down: a `SUMMARY.md` symlinked out of the tree passed
  `isFile()` and was read. The resolved path must now stay inside the resolved
  directory it was joined onto, which closes the check-to-use race on the same
  line (`b5f49bad`).
- **The task-record writer is now contained the way the reader is.** The reader
  checked containment and the writer did not, so the two disagreed about what
  counted as inside `.planning/tasks/` (`71234385`).
- **An echoed `mktemp` scratch directory was pasted into later shell commands as
  a literal.** Injectable through `$TMPDIR`, at three prose sites, two of which
  predate this cycle. Raised `high` by the phase-2 `risk_surface` gate, ruled
  survived rather than downgraded, and fixed across all three
  (`cadence-core/workflows/plan.md`,
  `cadence-core/references/review-triggers.md`,
  `cadence-core/references/triage-gate.md`, `054fa9a0`).

### Known gaps

- **`/cad-why`'s bare-path arm inherits git's default history simplification.**
  Measured on `lib/release-decision.mjs`: 7 commits reachable against 10 with
  `--full-history`, the three missing being `_archive-v2.2.0/3` phase commits
  collapsed into a merge. The join is correct, the history it reaches is short.
  The prune search already passes `--full-history`, which is why it recovers 25
  closes instead of 4.
- **The renderer's entry cap of 10 has a stated reason that is measured false.**
  It claims ten entries stays under the 10,000-byte line in
  `references/conventions.md`; with all edges filled, `planning.mjs` renders
  15,637 B. The measurement is in the comment. The number was not lowered
  because the test that pins it sat outside the touching plans' leases.
- **`closeOver` compares `%cI` timestamps as strings**, and ISO-8601 values
  under different UTC offsets do not string-sort chronologically, so an
  unresolved commit can attach to the wrong close. Ruled low on reachability: it
  needs mixed-offset commits, a `--mode delete` close, and a pair straddling a
  prune.

## [3.5.9] - 2026-08-23

Ten defects sat in `.planning/CAPTURE.md` between 2026-08-05 and 2026-08-08 and
nobody read them. The archive triage on 2026-08-22 reproduced every one against
the current tree and filed them as #231 and #232, and the theme turned out to be
one sentence: the release seam and the frontmatter reader both return a clean
answer over a case they did not actually handle. Two phases, 38 commits off
`v3.5.8`, five requirement ids seeded at the open and all five traced to a
verified phase: `REL-01`, `REL-02`, `REL-03`, `FRM-01` and `FRM-02`.
`/cad-audit` PASS on both arms, fourteen of fourteen acceptance criteria
covered.

Six of the ten were in the release/changelog seam, the seam `v3.5.8` rewrote.
Item 6 of #231 and the open item `v3.5.8`'s own phase 2 filed against
`release-decision.mjs` were the same defect class in the same subsystem, filed
two weeks apart, neither aware of the other. That is the argument for reading
the capture queue, and it is why this cycle led with it.

### Fixed

- **A `## ` inside a fenced code block no longer ends a changelog section.**
  `sectionEnd`, all four `prependChangelogEntry` anchors, `promoteUnreleased`'s
  locators and `releaseSectionEmpty` now scan headings fence-aware, so a
  release section whose body quotes markdown keeps its real bounds
  (`cadence-core/bin/lib/release-decision.mjs`, REL-01).
- **A heading-only release section reports empty.** `releaseSectionEmpty` was
  counting a bare `### Added` as content, so a scaffolded section with no
  bullets under it passed the close's own emptiness halt. A prose-only body is
  still not empty, which is the distinction that check exists to make
  (REL-01).
- **The trailing link-reference block is bounded by what its keys name.** A key
  that names no `## [key]` heading is not part of the block, rather than the
  block running to whatever the previous heuristic happened to stop on
  (REL-01).
- **A primary manifest carrying no `version` field halts the close.**
  `release-bump.mjs` returned a benign `skip` over it, so a close continued and
  shipped a manifest still at the previous number. It now returns `ok:false`,
  `action:"refuse"`, `reason:"no-version-field"` at exit 1 (REL-02).
- **An unparseable `--version` refuses by naming the raw argument.** Passing
  `--version v` reported `no-target-version` over an empty target, which reads
  as "you forgot the flag" when the flag was right there. It now reports
  `reason:"unparseable-version"` with `target:"v"` (REL-03).
- **Value-level frontmatter issues stop leaking across keys.**
  `readFrontmatterList` returned the whole document's issues array whatever key
  the caller asked for, so a backtick in `goal:` surfaced on a `files:` read and
  the risk floor bailed on a plan's entire declared file list over a defect in a
  scalar nothing reads as a list. The four value-level codes are now scoped to
  `requirements:` and `files:`, the two keys the seams read as lists. The five
  structural codes still cross keys on purpose: a `requirements:` block
  truncated by a stray line has to reach a `files:` read too, or `plan-overlap`
  clears a half-parsed plan as proved independence
  (`cadence-core/bin/lib/planning-files.mjs`, FRM-01).
- **A markdown-decorated path in a plan's `files:` list no longer parses
  clean.** `plan-overlap` compares exact strings, so `**src/shared.rs**` in one
  plan did not match `src/shared.rs` in another and two plans that genuinely
  collide were cleared into separate parallel worktrees on the same file. This
  is the failure that decides whether parallel dispatch is safe, and the safety
  check for this cycle's own parallelism was the thing under repair (FRM-02).
- **`item-without-key` fires on the early-continue path.** Scoping the
  value-level codes exposed a line that then reported nothing at all: a block
  item under no open key returned early on a `scanValue` failure, before the
  no-block-key diagnosis, so `goal: something` followed by `- "unbalanced` went
  fully silent. A frontmatter line that reports nothing is the one outcome that
  gate exists to prevent.
- **The live-corpus prune test no longer depends on how a bullet was typed.**
  Pre-existing, found blocking a phase's own acceptance criterion rather than by
  the suite (`cadence-core/bin/milestone-prune.test.mjs`).

### Added

- **`markdown-decorated-path`, a new grammar code.** Raised in `parsePlanFiles`'
  frontmatter loop for a matched wrap on `*`, `_`, `<>` or a bare `[]`, the link
  form `[path](path)`, and a matched interior backtick pair. It reports and
  never repairs: the declaration comes back in `files` with its bytes untouched,
  so `overlaps` keeps meaning "these two declarations intersect" and never
  "intersect after repair". A non-empty `frontmatter_issues` is what routes the
  phase sequential, which is the refusal to trust the comparison rather than a
  corrected comparison.

  A wrap is matched or it is nothing, because `_`, `[` and `*` are legal path
  bytes: `_private/a.rs`, `src/a_`, `src/__init__.py` and `[src/a.rs` stay
  diagnostic-free. All 597 frontmatter `files:` entries under `.planning` were
  measured before the rule widened and none opens or closes on any wrap byte.
- **`changelog.state` on every emitting envelope.** `not-examined`, `absent`,
  `unreadable` or `ok`, so an absent `CHANGELOG.md` is named rather than read as
  a clean run. `workflows/milestone.md` step 2 halts on it beside
  `section_empty: true` (REL-02).
- **`decideManifestBump`'s JSDoc names all nine codes the seam owns**, pinned by
  a test that derives the verdict-code set from executable source and reddens
  when a code misses either document (REL-01).
- **A code-set guard for the frontmatter grammar.** A grammar code literal added
  to `planning-files.mjs` without its row in
  `references/plan-frontmatter.md`'s code table reddens
  `prose-agreement.test.mjs`, derived from the source rather than from a
  prose-to-prose comparison that passes when both lists are stale together.

### Known gaps

- `plan-overlap` still reports `overlaps: []` for two plans declaring the same
  file when one declaration is decorated. The strings genuinely compare unequal,
  and `frontmatter_issues` is what routes the phase sequential. Worth revisiting
  if a caller ever wants the intersection itself rather than a refusal to trust
  it.
- The residual over-fire on the decoration rule is a path that legitimately
  opens and closes on the same emphasis byte, `__main__`. It reports and is
  still returned byte-exact. A phantom diagnostic costs a sequential dispatch;
  a missed shape costs two plans writing one file.
- `.planning/DOCS-CLAIMS.md` rows `MILESTONE-04` and `MILESTONE-05` cite stale
  line ranges against `milestone.md`. Pre-existing, and no mechanical check
  enforces those ranges.

## [3.5.8] - 2026-08-22

Four operations in this codebase wrote several files and reported the result as
if they had written one. An atomic rename protects a single file from torn bytes
and cannot make a transaction across two, so each of them could leave a
half-applied tree inside an `ok:true` envelope with nothing saying so. Two phases,
33 commits off `v3.5.7`, three requirement ids seeded at the open and all three
traced to a verified phase: `JRN-01`, `JRN-02` and `JRN-03`. `/cad-audit` PASS on
both arms, thirteen of thirteen acceptance criteria covered.

The shape of the fix was decided on evidence rather than on the issue text.
`renumber` and `milestone-prune` already refused whole and reported what had
completed, by hand, because someone remembered to. That is a refusal protocol,
not a journal: it needs no on-disk state, no resume path and no reader in
`/cad-health`. Generalizing the two implementations that already worked was the
work, and the two operations that claimed atomicity without having it were moved
onto the result.

### Added

- **`cadence-core/bin/lib/file-transition.mjs`, one home for an ordered
  multi-file write.** `runTransition({steps, discipline, preflight})` returns
  `{ok, refused, completed, failures}` and owns the idiom four call sites were
  each spelling for themselves. Two disciplines, both drawn from behaviour that
  already shipped: `stop-at-first-failure` for `renumber` and
  `continue-past-failure` for `milestone-prune`. A lazy pre-flight stage returns
  on its first unsatisfied condition before any thunk runs, so a refusal writes
  nothing.

  A ninth `HELPERS` census row reddens if the module's body is copied under any
  name, which is what makes "one, not four" mechanical instead of asserted. The
  probe run confirming it exits 1 naming both copies.

- **`phase-done`'s success envelope names which documents it wrote.** A `wrote`
  field beside the unchanged `roadmap.{line,now}` and `reqs[]`, so a caller can
  tell a two-document flip from the roadmap-only write that an absent
  REQUIREMENTS.md still produces.

- **Three refusal codes with their own identities**, where the failure used to
  arrive as an undifferentiated `internal`: `unreadable-sibling-manifest`,
  `unreadable-changelog` and `unreadable-requirements`, plus `partial-bump` and
  `partial-flip` for a write that fails past the pre-flight and needs to report
  what landed.

### Changed

- **`cmdPhaseDone` is one ordered transition, and its comment is gone rather than
  qualified.** It carried "Both edits validated before either write -
  all-or-nothing" directly above two separate renames of ROADMAP.md and
  REQUIREMENTS.md. Every edit is now validated before the first write, and
  REQUIREMENTS.md is read as a three-state fact: absent keeps the roadmap-only
  `ok:true` write, present-but-unreadable refuses before ROADMAP.md is touched.
  `grep -c "all-or-nothing"` inside the function prints `0`.

- **`release-bump` reads and decides its whole write set before the first write.**
  It used to write the primary manifest before the sibling had been read or
  validated, so a malformed sibling shipped a partially bumped release tree under
  a success envelope. The first `atomicWrite(` now sits at line 361 against the
  last `readManifest(` at 280 and the changelog read at 329, which makes the
  ordering structural rather than conventional. The existing `siblings[]` refusal
  arm still works for a sibling that is readable but not upgradeable, so two
  different outcomes are not collapsed into one refusal.

- **`renumber` and `milestone-prune` run their partial-state refusals through the
  primitive** instead of each keeping its own try/catch loop. Neither observable
  envelope moved: `partial-apply` and `partial-prune` keep their reason strings,
  their `completed`/`failed` lists and their hint text, pinned by tests that
  redden on a paraphrase.

### Fixed

- **A non-regular `CHANGELOG.md` refuses instead of hanging or scaffolding over
  history.** `readChangelog` promised a readable regular file and checked only
  that reading did not throw. A FIFO there would block the CLI forever, and
  `/dev/null` would read as an empty changelog and scaffold a release heading over
  the file's entire history. Now a `statSync().isFile()` check routes both to
  `unreadable-changelog`, with a symlink-to-`/dev/null` regression test. Raised by
  the blocking `risk_surface` review on the phase-2 range and fixed before the
  phase closed.

### Known gaps

- The `partial-flip` and `partial-bump` arms ship probe-proven only, with no
  committed regression test. Every uid-independent way to force a write to fail
  past the pre-flight was converted into a pre-write refusal by the work above,
  and the phase's own decisions forbid `chmodSync`. Both executors recorded the
  exact envelopes they observed; treat those two arms as untested in CI rather
  than as verified behaviour.

- `planning.mjs`'s `read(reqFile)` still accepts any existing filesystem object,
  so a FIFO at `.planning/REQUIREMENTS.md` hangs `phase-done` before its refusal
  can run. Same class as the `CHANGELOG.md` blocker above, one seam over, raised
  medium and downgraded at adjudication.

## [3.5.7] - 2026-08-22

Cadence has been measuring its own cost for several releases and then handing you
nothing to spend the measurement with. That is the whole theme here. Four phases,
83 commits off `v3.5.6`, four requirement ids seeded at the open and all four
traced to a verified phase: `RDX-01`, `CER-01`, `IVW-01` and `HLT-01`. A fifth,
`BCH-01`, was killed by its own spike before a line of it was written.

Two spikes ran before any phase was planned, which is why this cycle is one phase
shorter than it was scoped to be.

### Added

- **`stakes` is now the minimum a project accepts, not the level every phase
  pays.** `route.mjs resolve` reads the phase's own declared `files:` at plan
  time, scans them against the surfaces the project answered, and raises from the
  configured floor: per plan for an executor, per phase for everyone else. A
  phase touching nothing on an answered surface routes BELOW the old project
  default. Every move is stated in `reason` (the phase, the surface, the file
  that evidenced it) and every unreadable input lands in `warnings`.

  `node cadence-core/bin/route.mjs replay` shows what it does to this repository's
  own history: 30 phases, 27 of them raise back to `shipped` on real evidence, 2
  take the discount to `solo`, and 1 has its discount withheld because a declared
  path was not a readable file. It fails closed, so one unreadable plan holds the
  whole scope at the configured level rather than quietly discounting it.

  `review.triggers.risk_surface.waive_routing_floor` is the one way to route below
  the computed floor. It waives the LEVEL for the surfaces you name in it and
  never the blocking review, and every waiver applied is named in `reason`.

- **A fifth gate mode, `deferred`, one ladder position between `advisory` and
  `blocking`.** It runs its reviewer, stores what it found VERBATIM as a
  committed `DEFERRED-*.json`, and lets the phase finish. Blocking used to block
  the RUN, which is the thing that stops Cadence working while nobody is watching.
  Now the guarantee moves to the land: `/cad-land` refuses on BOTH publish arms
  while any queue member is unadjudicated, at the top of step 3, ahead of both
  arms and independent of `git.auto_close`.

  `planning.mjs deferred record` writes the queue and `deferred list` reads it as
  one derivation over two homes, so a queue carried out of a pruned phase is still
  one list. An unreadable directory is reported rather than counted as empty. The
  count rides the `planning.mjs status` envelope always, so a caller can tell
  "nothing deferred" from "this seam does not know about deferrals". `deferred
  carry` moves the queue out of `.planning/phases/<N>/` before `/cad-milestone`
  prunes the directory, and it stays adjudicable and re-armable from its carried
  home.

- **`/cad-config --surfaces`, a way back to the one question Cadence asks on its
  own.** The risk-surface interview had exactly one entry point, at first fire,
  and no way to reach it again after the repository changed shape. It now opens on
  demand against a fresh scan and shows the answered set beside what the scan
  evidences today, writing only on an explicit pick.

- **`trace suggest` reads `.planning/reads.jsonl`.** It never opened the reads
  record at all, so the one seam that turns the record into a retune could not see
  the read redundancy the record was measuring. A role over its floor now produces
  an entry naming the worst single file inside one dispatch, in the form "read
  `<path>` N times". On this repository that is `cad-executor` at 3.64 opens per
  distinct file inside one dispatch, worst case `cadence-core/bin/planning.mjs`
  read 29 times inside one bracket.

  The floors are per role and the MAP is the gate, not the number:
  `IN_DISPATCH_FLOORS` names `cad-executor` at 3.00 and `cad-verifier` at 2.00,
  and a role the map does not name stays silent at any ratio. `cad-planner` at
  1.88, `cad-assumptions-analyzer` at 1.78 and `cad-reviewer` at 1.74 sit in a
  band where a suggestion would be noise, and a single global ratio would have
  fired on all five to save nothing.

  The entry states what it does not cover, in its own evidence string rather than
  only in workflow prose: the file-carrying share of the joined reads it was
  computed over, the fact that nothing prunes `reads.jsonl` at a milestone close
  so an unscoped run spans every milestone in the file, and the count of
  `coordinator` reads it excluded because the main thread has no dispatch bracket
  by construction and its re-reading cannot be attributed to one.

  It names NO config key, and a test fails if it ever points at one. No key in
  `config.schema.json` expresses the remedy, so the entry says so and names the
  discipline instead: symbol or line anchors on a plan's `files:` entries, and
  targeted reads over whole-file ones.

- **`route.mjs replay`** reports what the computed floor does to every phase this
  project has ever run, live and archived, off `levelFor`, the single
  scope-to-level implementation `resolve` shares. `.planning/phases/3/MEASUREMENT.md`
  carries the run, the before/after distribution, the token baseline and a
  falsifiable prediction.

### Changed

- **The risk-surface interview's options come out of `lib/surface-scan.mjs`
  now, not out of model-composed prose.** `interviewOptions()` builds the ordered
  choices and the ask RENDERS them. On the demo tree from #206 the old menu put
  all eight categories in two slots and offered the same set twice; the two
  recommendation arms are collapsed into one and it renders two distinct sets.
  Pinned by two `prose-agreement.test.mjs` arms, both falsified live in both
  directions.

- **A declared DOCUMENT contributes its path and not its prose to the risk
  scan.** Documentation that merely MENTIONS a construct stopped raising the
  phase that declared it. Plan-time reasons read `body line:` where no diff
  exists; `scanDiff` keeps `changed line:`.

- **`/cad-report` and `trace suggest` read the same fold.** The per-role
  in-dispatch figure lives on the `reads --join` envelope as `inDispatch` and
  neither prose surface recomputes it.

### Fixed

- **A scope that declared NO files is no longer discounted.** "Nothing was
  declared" and "nothing touches a surface" were the same sentence and are now
  two, so an empty scope cannot buy a level discount it never evidenced.

- **A malformed `--phase` is refused, not answered about another phase.** It used
  to fall back to the cursor's phase, which means the answer was about a phase you
  did not ask about.

- **Declared bodies and the phase locator stay inside the repository.** Both are
  contained by `realpathSync`, and a PLAN file is bounded before it is opened.

- **`deferred carry` checks the parent it creates, not only the leaf**, and a
  carried queue member stays adjudicable and re-armable from its new home.

- **The evidenced choice states its evidence when nothing was answered.**

### Deferred

- **`BCH-01` (#174) left this cycle on an invalidating spike**, before the
  fidelity question it was really about was ever tested. Batching N security
  reviews into one process saves **1.91%** of reviewer spend: a 1,676-token fixed
  prefix against six observed dispatches totalling 438,080 tokens. It does not
  flip at the 61 invocations the issue cites, because both sides of the ratio
  scale with N, and 61 gets you 2.09%. The bill is PAYLOAD, and those six
  dispatches span 25,753 to 125,100 tokens, a 4.9x spread around a fixed cost of
  1,676. Two limits are recorded rather than assumed: the 61 figure is not
  reproducible from `trace.jsonl`, and the verdict excludes the host harness
  prefix, which batching would also collapse. It flips only if that prefix exceeds
  roughly 7,100 tokens, and the spike names the one measurement that would settle
  it. `.planning/spikes/batched-review-fidelity/SPIKE.md`

- The **7.0x** read redundancy #167 carries is historical. It was measured over
  DECLARED read-sets in `trace.jsonl`; the observed in-dispatch figure for the
  heaviest role is 3.64, about half it, and nowhere near the 1.0 that would have
  closed the issue with a note. `.planning/spikes/read-set-redundancy/SPIKE.md`

## [3.5.6] - 2026-08-20

Last release fixed readers that accepted input they had a rule against. This one
fixes the machinery that recorded what happened afterward, because a run that
destroys the record of the run before it has no evidence to audit. Three phases,
45 commits off `v3.5.5`, no requirement ids seeded: this cycle was planned
against acceptance criteria alone, 20 of them, all 20 traced to a UAT item.

### Added

- **Executor reports rotate instead of overwriting.** A re-run used to write
  `reports/plan-<k>.md` over the previous run's copy on its first task commit, so
  the most detailed per-task record in the tree was the only one that was not
  run-scoped. `cadence-core/bin/lib/report-rotation.mjs` answers a free suffix
  from the directory listing, the executor rotates `plan-<k>.md` aside to
  `plan-<k>.<n>.md` before its first write, and two runs now leave two readable
  records. 7 tests in `report-rotation.test.mjs`.

- **A gate fire writes an adjudication record you can recount.**
  `ADJUDICATION-<trigger>-<discriminator>.json` lands beside the REVIEW file with
  one entry per finding raised, per raising voice: the model, the severity as
  raised, `file` and `line`, the claim and the failure scenario stored
  byte-for-byte, and `base_id`/`head_id` as full 40-character SHAs. The ruling is
  `survived`, `downgraded` or `refuted`, a refutation carries the code that
  contradicts the claim, and a survivor carries its fix commit. Every citation is
  grounded with `git cat-file -e <head_id>:<file>` before the record is accepted.
  The seam refuses to overwrite an existing record and refuses a paraphrased
  ruling.

  The point is the auditor walk: `git checkout <head_id>`, open the cited
  `file:line`, read the verbatim claim, decide for yourself whether the
  adjudication was right. Before this, the outcome survived as one sentence on a
  trace event.

- **`trace append` takes `--survivors`, `--downgraded` and `--refuted`**, and
  `recountReceipt` re-derives all three from the stored rulings before it lets
  the receipt onto the trace. A count that disagrees with the record is refused
  as `count-disagreement` and nothing is appended. The survivor count is now
  derived, not asserted.

### Changed

- **`/cad-report` renders the Gates line from the record** rather than narrating
  a figure out of a `detail` string, names a disagreement when it finds one, and
  reads a fire with no record as `unrecorded`. Nothing is synthesized for phases
  that predate the format.

### Fixed

- **`/cad-execute` refuses a phase that already executed.** The locate step
  stopped on unplanned and on missing plan files and nothing else, so a phase
  whose derived status was `executed` was dispatched again from task 1 against a
  plan whose tasks were already committed. It now refuses on derived status
  `executed` or `complete`, names `/cad-undo <N>` then `/cad-execute <N>` as the
  supported path, and `--rerun` is the deliberate override.

- **The risk gate no longer deadlocks on an empty range.** A range with zero
  commits answered `checked:false, inconclusive:true`, `execute.md` reads
  inconclusive as a fire, and `risk-check status` then refuses
  `risk-record-missing`, so a blocking cross-model review was demanded of a diff
  with nothing in it and the run needed a user override to finish. An empty range
  is now `checked:true, inconclusive:false, empty:true` and `status` admits it
  through the existing `recorded` arm. A range that contains commits but cannot
  be judged still fires, unchanged. Emptiness is decided from the diff body, not
  from `base_id === head_id`, so a revert pair with a zero net diff takes the
  empty arm too.

- **The risk range is read with `--no-ext-diff --no-textconv`.** The gate's own
  review caught this one and it was real: a `diff=<driver>` attribute in a
  checked-in `.gitattributes` binds to a `diff.<driver>.command` or `.textconv`
  in the reader's own git config, so `git diff <base> <head>` can emit zero bytes
  for a range that changed a file. No attacker needed, a `textconv` for pdf or
  docx in your own `~/.gitconfig` does it. Confirmed in a scratch repo before it
  was ruled: the driver emitted 0 bytes across a commit whose changed line was a
  recursive delete, `--no-ext-diff` emitted 109. Without this the new empty arm
  would have been a silent clear on the one trigger that blocks at every stakes
  level.

- **`lease-check` exempts a rotated report.** The exemption was byte equality
  against `<pdir>/reports/plan-<k>.md`, which was correct while a plan had
  exactly one report and wrong the moment rotation shipped, so an executor
  staging `plan-<k>.<n>.md` during a task commit was blocked with
  `undeclared-files` for obeying its own contract. `isReportName(k, name)` states
  the grammar once in the rotation module and `lease-check` imports it. The
  exemption stays bounded: `plan-<k>-risk.diff`, `plan-<k>-risk-task-<n>.diff`,
  another plan's report, a case variant and a nested path are all still refused,
  so a blocking gate's flagged evidence cannot ride into a task commit.

### Known issues

- `cadence-core/bin/milestone-prune.test.mjs:557` fails against this repository's
  own `.planning/`, because the corpus row expects `## Active` to carry the
  current cycle's requirement rows and this cycle seeded none. Full suite is
  2464/2465 with that as the only failure. It is a fixture-state mismatch, not a
  defect in `milestone-prune`.

- `lib/trace-suggest.mjs` still parses survivor counts out of the `--detail`
  string and ignores the three structured flags, so one reader in the tree
  continues to trust the prose this cycle set out to replace.

## [3.5.5] - 2026-08-19

Last release closed controls that ran and answered wrong. This one closes
readers that accept input they have a rule against, and it does it by giving
every seam CLI one argument table instead of nine hand-rolled parsers. Five
phases, thirteen requirements, 121 commits off `v3.5.4`. The landing page got
rewritten in the same cycle, because a tool about evidence should not ask you to
take its README on faith.

### Added

- **One declarative argument contract for every seam CLI.**
  `cadence-core/bin/lib/arg-contract.mjs` carries 16 scripts, 77 subcommand rows
  and 145 flag entries, each declaring `required`, `type`, `value` and `bare`,
  and `self-verify` now checks documented invocations against that same table. A
  flag with no row is a flag no prose may spell. `optionalFlag` is gone from
  source.

- **A census that proves the table is read, not just written.**
  `arg-contract-adoption.test.mjs` spawns the owning script for all 231 declared
  refusals across 145 entries, twice: the flag alone, and the same refusal
  preceded by a well-formed occurrence of itself. The phase's own UAT caught why
  this was needed. The table stated 145 rules and `planning.mjs` read two of
  them, so `cursor set --name` with no value answered `ok:true` and wrote
  `Phase: 1 of 5 (true)` into STATE.md.

- **`docs/` joins self-verify's markdown walk**, so a config key or repo path
  named on a `docs/` page has to exist, the same as on the README. Two pages
  moved there: `docs/COST.md` and `docs/EXAMPLE.md`.

### Changed

- **The README is a landing page now, not a reference manual.** 24,850 bytes
  down to 14,433. The cost-to-run section and the worked example moved to
  `docs/`, the 21-bullet command list is one line pointing at `/cad-help` and
  `cadence-core/references/COMMANDS.md`, and the page states what it asks of you
  before it asks you to install it. `LINEAGE.md`'s counts were re-measured
  against the tree: 19 rung files across 6 roles, 33 skills of which 27 are
  user-invocable.

- **Every bulk-output scratch file is written inside a `mktemp -d` made for that
  run**, at all six sites, and each read-back refuses a truncated or
  wrong-shaped file by name rather than parsing `{}` and calling it success.
  This is now check 21 (`scratch-path`) in self-verify. The blocking re-arm cap
  in `triage-gate.md` read a shared path before, which meant a render taken in
  another repository on the same machine could spend or refund the one round
  that gate has.

### Fixed

- **A string `""` in `git.protected_branches` protected nothing.** It coerced to
  an empty list, so `main` was unprotected and the commit guard said nothing.
  One non-empty resolver now sits behind all five readers, and the tests reach
  the guard DECISION rather than the helper: `git-guard` returns a
  protected-branch decision naming `main` under a string `""`, and
  `land-cleanup` reports `base: "main"` where it reported `''`.

- **`--dir ''` was read as "use the current directory" at six seams.**
  `git-branch.mjs tags --dir ''` printed this repository's 33 tags when it was
  asked about a project that does not exist. It answers
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` now. An absent
  `--dir` still resolves to the cwd, which is the behaviour that was actually
  intended.

- **A bare trailing `--date` on `release-bump` dated the release today.**
  `bump --version 1.1.0 --date` wrote the manifest and a `## [1.1.0] - <today>`
  heading at `ok:true`. Validated at the dispatch now, newline arm first,
  because a `--date` can carry a forged release section.

- **Numeric flags accepted values outside the safe-integer range**, so a
  400-digit argument or `9007199254740993` was rounded or yielded `Infinity`
  instead of refused. And a phase spelling that cannot round-trip is refused at
  the two write faces that would otherwise merge it into another phase.

- **`config.mjs` reported `__proto__` as a retirement that never happened.**
  `check '__proto__=1'` answered `retired in v2.0.0: undefined`. Every bare
  index read goes through `Object.hasOwn` now, and prototype members report as
  the unknown keys they are.

- **`detect-commands` named binaries that are not on PATH.** It now probes
  reachability before naming a command, nulls an unreachable winning arm and
  says so in `warnings[]`, with no fall-through to a lower arm. 402 planning
  rows pass both with `ruff`/`mypy`/`eslint`/`tsc`/`go` absent and with all five
  stubbed on, so the answer is pinned by fixtures and not by whichever machine
  ran it.

- **`risk-check status` could not be satisfied for a non-numeric worker key.**
  Both `risk-check` faces read one 16-row grammar now, and a refused bracket key
  lands in `malformed[]` instead of being dropped into `missing[]`.

- **The `risk_surface` detector matched its own source and fixtures.** 29
  literal sites split, reach proven unchanged, pinned by a census row watched
  failing against the old blob.

- **`## Shipped` and `## Traceability` lookups read inside fenced code blocks.**
  All four locators plus `## Shipped`'s start and end route through
  `sectionSpan`. The falsifier was observed by hand: the pre-change libraries
  wrote a real traceability row inside a fenced example table.

- **The argument door judged only a flag's first occurrence** while
  `planning.mjs` keeps the last, so `--name valid --name` passed on `valid`.
  Found by the blocking review on the very plan that existed to close this
  class, at a spelling the census had never typed.


## [3.5.4] - 2026-08-18

Every check in here already ran and already answered, and answered wrong in a
way its own output could not show. `v3.5.3` closed the shape for controls that
never reached their path; this one closes it for controls that reach the path
and mis-answer once they are there. Three phases, eight requirements, each fix
backed by a check watched failing against the unpatched tree first.

### Added

- **The stakes level moves both halves of a cross-model review panel.**
  `route-table.json` now carries level-keyed `tiers` and a new `efforts` grid
  beside it, and `route.mjs resolve` returns `reviewer_tiers` and
  `reviewer_efforts` per trigger alongside `reviewers`. At `solo` / `shipped` /
  `critical` the `plan` trigger resolves `cheap/low`, `balanced/medium`,
  `flagship/high`. Both grids are dense and self-verify walks each one per level
  in both directions, so a level silently inheriting another level's tier is a
  `missing-cell` failure rather than a surprise at review time.

- **A read-only `tags` arm on the git-branch seam.** `git-branch.mjs tags --dir
  <root>` exposes phase 2's bounded tag read to prose, so a workflow asking what
  a project has published gets an answer bounded to that project root instead of
  a bare `git tag`.

### Changed

- **All eight per-trigger `.tier` and `.effort` schema defaults sit on the
  `null` unset sentinel**, the shape `.gate` has carried since GAT-02. An unset
  key now answers `null` plus a warning naming `route.mjs resolve` as the seam
  that answers it for a level, rather than a hard `flagship` or `balanced` that
  nothing resolved. Upgrade note: if your provider config only defines a
  `flagship` model, a `shipped` project now resolves `balanced` for most
  triggers and loses its cross-model reviewer until you add that tier. Each
  resolve warns when it happens.

- **`git.create_tag` governs the land-time tag cut and nothing else.**
  `grep -rn create_tag` over `cadence-core/` and `skills/` now finds exactly one
  reader, `/cad-land`'s tag step. The milestone close decides release mode from
  a confirmed version plus the bounded tags probe, which means a project that
  turns tagging off still gets its manifest bumped instead of a close that skips
  the bump for a reason nobody wrote down.

### Fixed

- **A credential at the sanitize window's edge reached the review provider in
  clear text.** `redactUrl`'s userinfo rules both required a terminating `@`, so
  a URL whose userinfo span was cut by the 4096-byte `bodyExcerpt` window passed
  through unredacted. Two end-of-input alternatives now run after the terminated
  rules. Measured against the unpatched tree at `ae73dd6`: 73 bytes of planted
  secret surviving the excerpt on the reported shape and 985 bytes on the
  high-magnitude case, both zero now. `redactUrl('https://example.com:8080/path')`
  is byte-identical mid-body and at end-of-input, so a port is still not read as
  userinfo.

- **`cad-phase remove` deleted a phase directory it could not prove was clean.**
  `uncommittedUnder` collapsed "no uncommitted paths" and "I could not read the
  git state" into the same answer, and the caller deleted recursively on both.
  It now returns three states and refuses the third with `unreadable-git-state`.
  The blocking review found three more fail-open paths in the delete guard, all
  closed with their own falsifiers, plus a case-sensitive name comparison where
  the `.git` probe belonged.

- **The ship gate FAILed a healthy repository on three separate counts.**
  `activeVersion` was a first-token line scan, so a `### Active` section
  mentioning the predecessor on a wrapped continuation line reported the
  predecessor and hard-FAILed `/cad-audit`; it now scans the whole body twice and
  admits a line-anchored token only on agreement or a sentence opening.
  `version_drift` fired on the rolled-forward phase the workflow already declared
  exempt. And `readTags` let `git -C` discover upward from `.planning`, so a
  project that is not itself a repository inherited an enclosing repository's
  tags and could be failed by a version an unrelated umbrella repo published.

- **`issue-check`'s resolve loop could multiply its own bound by the call cap.**
  The loop's only exit was a SIGKILL timeout, so five issue lookups each
  answering at 9.9 seconds with exit 1 cost fifty seconds and never tripped it.
  The loop now takes one `Date.now()` deadline at start and derives each call's
  timeout from what is left. Against a stubbed `tea` that sleeps and exits
  non-zero: 5 resolves in 5.07s before, 2 in 2.06s after. Budget exhaustion still
  exits 0 with `action: "report"` and reports the unreached numbers `unresolved`,
  and a fast non-zero resolve still does not stop the loop, because an absent
  issue is a legitimate answer.

## [3.5.3] - 2026-08-18

Cadence asserted controls it did not hold. The review path stated bounds it
never enforced, the run record claimed to price a run it could not see, and
three controls that already existed and were already correct never reached the
path that needed them. Five phases, thirteen requirements, all of it argued off
this repo's own trace rather than off a guess.

### Added

- **Turns on the record, and a spend figure that names what it excludes.**
  `trace close` now persists the tool-call count its return already carried, and
  `trace render` reports turns per dispatch and per role beside a
  `turns_unrecorded` counter of their own, so a dispatch that reported tokens but
  no turns stays distinguishable from one that reported the reverse. The three
  surfaces that priced a run from worker-return tokens (`/cad-report`,
  `trace suggest`, `/cad-progress --trace`) now name the three sources that
  figure leaves out - the orchestrator's own turns, cross-model provider calls,
  and figureless returns - instead of presenting it as the run's cost.
  `SPEND_EXCLUDES` is a frozen export, so the list cannot drift into three
  versions of itself.

- **A dispatch window budgeted off the run record.** Six
  `workflow.max_dispatch_tokens.<role>` ceilings, each defaulted to that role's
  75th-percentile terminal window on this repo's own record rounded up to the
  next 25,000, plus `planning.mjs trace window [--phase <N>]` to apply them. The
  ceiling is READ after the fact and never enforced at dispatch time, because
  nothing can resize or cancel a dispatch already running, and the report says so
  rather than implying a bound that does not exist.

- **A direction and a target on every retune suggestion.** `trace suggest` used
  to return a bare config key, so `/cad-suggest` could print
  `workflow.max_plan_tasks` and no more. Each keyed suggestion now carries the
  direction to move it, the value it holds now, and a target where one can be
  READ - stepped down the gate ladder `route-table.json` states, or taken off the
  rung the record shows a role's escalated resolves landing on. A rule that
  cannot price a target omits it rather than guessing, and a target that would
  name no actual change is omitted too. `/cad-suggest` presents the tweaks in a
  heading of their own with the receipts below, and ends by offering to route the
  change to `/cad-config` rather than by declining to have an apply arm.

- **A bulk-output transport, and a register that holds it.** Bulk tool output
  rides a scratch file at the five sites that prescribed it inline, the rule is
  stated once in `references/conventions.md`, and a 17-row register plus
  self-verify check 20 refuses an eighteenth inline site.

### Fixed

- **The coordinator figure counted hours that were not the coordinator's.** The
  residue accumulators were keyed on phase number, so one run's last marker
  closed at a different run's last event whenever a phase number spanned several
  runs. Keyed on `corr` instead, phase 2's reported residue over the live record
  falls from 366,716,303 ms to 3,508,747 ms, and the largest single window from
  280,613,472 ms to 1,081,370 ms. The name stays: a corr-scoped gap between
  worker brackets is time this coordinator held the run.

- **The provider response had no ceiling Cadence owned.** `request()` now
  enforces a 4 MiB response limit with its own `over-response` reason, distinct
  from `transport`, on `review`, `consult` and `detect-models` alike; the failure
  envelope carries a sanitized 1024-byte excerpt rather than the whole body. A
  credential sanitizer sits beside the URL one, covering `Bearer` echoes,
  `name=value` pairs in four spellings, quoted multi-word values and camelCase
  keys.

- **Local validation admitted findings the canonical schema refuses.**
  `FINDING_SCHEMA` now carries the constraints `validateFindings` enforces -
  `minimum`, `minLength`, `maxLength`, `maxItems` - and an 18-fixture agreement
  table runs both sides and compares verdicts, so the schema and the validator
  cannot disagree silently. `cadence-core/bin/lib/schema-eval.mjs` is a
  keyword-limited, zero-dep evaluator.

- **The recovery arm named a timeout the dispatch path cannot produce.**
  `execute.md` now says `turn cap or unusable return`, in those words, held
  there by a standing prose-agreement check. `maxTurns: 200` is named where the
  default reviewer claims exemption, checked against the rung files' own
  frontmatter rather than a literal.

- **Three controls that existed, were correct, and never reached their path.**
  A milestone close now distills its pruned phases into `.planning/ARCHIVE.md`
  before the directories go, so the recall corpus survives the close.
  `risk-check status` gains an `unfired` row state and refuses a fired range
  carrying no receipt for that range, and every blocking fire writes
  `--plan --base --sha` so a receipt names the range it settles rather than
  clearing every later one. `references/execute-parallel.md` reaches the
  sequential branch's detector, fire and status sequence by pointing at it
  instead of copying it.

- **The plan-task ceiling re-decided, and left where it was.**
  `workflow.max_plan_tasks` was argued against both of its forces - cold-prefix
  cost and context risk - and lands on 8 unchanged, with the arithmetic written
  down in `design-notes/dd-plan-task-ceiling.md` where a milestone close cannot
  prune it.


## [3.5.2] - 2026-08-16

Two surfaces where the tree already conceded the correct rule in one place and
prescribed the wrong one somewhere else. Neither is a bug anyone hit yet. Both
came out of an external deep dive against `v3.3.0`.

### Fixed

- **The pre-flight overlap gate could admit a plan pair the commit-time
  enforcement would then refuse to separate.** `plan-overlap` and `lease-check`
  each carried their own comparison over declared paths, so they disagreed about
  what a directory lease covers. Plan 1 declaring `files: [src/]` beside plan 2
  declaring `files: [src/auth.js]` passed the parallel-safety check, and then the
  executor's own lease gate refused the commit. Same for `src/` against
  `src/auth/`.

  Containment now has exactly one definition. `cadence-core/bin/lib/lease-grammar.mjs`
  exports `covers`, `intersects` and `isRefusedSpelling`, and both readers ask it.
  A census test in `helper-census.test.mjs` goes red if the comparison is pasted
  back anywhere under `cadence-core/bin/`, test files included, which is the live
  failure mode in this tree rather than a hypothetical one.

  `cadence-core/references/plan-frontmatter.md` now states the trailing-slash
  directory-prefix form and says outright that `src/auth` does not license
  `src/authority.js`.

### Added

- **A file-path transport for every seam flag that carries caller-derived free
  text.** A capture item, a UAT reply or a milestone label holding `$(...)` or a
  backtick could not ride safely in a double-quoted shell word. `planning.mjs`
  already said so in one place and eleven other sites did it anyway.

  Five new flags, one reader behind all of them
  (`cadence-core/bin/lib/text-flag-file.mjs`, four refusals: valueless flag,
  unreadable path, empty file, both forms given):

  - `trace append|close --detail-file`
  - `trace append --read-file`
  - `uat record --fields-file`
  - `milestone-prune --label-file`
  - `cursor set --next-file`

  The rule is stated once, in `cadence-core/references/conventions.md` under
  `## Caller-derived text`, and a committed 36-row register
  (`cadence-core/bin/lib/text-transport.mjs`) records every site with its verdict,
  20 caller-derived and 16 out of scope with a reason each. `self-verify` check 19
  `text-transport` reads that register, so a seventeenth inline site is refused
  rather than noticed later. 13 prose surfaces across `workflows/`, `references/`
  and `skills/` moved onto the transport, and the tag site now uses
  `git tag -a <version> -F <path>`.

- **`./a.txt` and `src//a.txt` are refused with a named `redundant-path-segment`
  diagnostic at both declaration doors**, the frontmatter `files:` list and a
  `- **Files:**` task line. The diagnostic reaches `plan-overlap`'s
  `frontmatter_issues` and the spelling reaches neither reader. Note that a
  refused declaration drops out of the set, so `lease-check`'s `declared` count
  falls by one for each, with the diagnostic beside it naming why.

## [3.5.1] - 2026-08-16

### Fixed

- **A `git.auto_close` set once in your global config authorized an unattended
  merge in every repository you own.** The key is documented repo-local, and the
  close gate enforced it by reading the repository layer, but the GitLab arm of
  `/cad-land` read the merged value instead. Set it globally and any repo with a
  GitLab remote would open an MR and merge it with nothing asked. It now resolves
  as two separate answers, `autoCloseRequested` from the merged config and
  `autoCloseAuthorized` from the repository layer alone, and the new
  `git-publish.mjs authorized` subcommand is what every host consults before it
  touches a remote. Requesting it globally and never authorizing it here now
  refuses in wording that says which of the two is missing.

  The GitLab consult also moved ahead of the reuse probe rather than sitting
  beside the create. `glab mr create` publishes the source branch itself, and the
  reuse arm hands an already-open MR straight to the merge with no create at all,
  so a check placed at the create left that path ungated.

- **`milestone-prune` read only the first physical line of a requirement
  bullet, and both halves of the transform were wrong for it.** A bullet that
  wrapped lost its lead line and left every continuation behind as orphaned
  prose, and the archived `## Shipped` row got a parenthetical truncated at the
  first newline. Three consecutive milestone closes were repaired by hand. It now
  reads the whole span, takes both ends of `## Active` from the fence-aware
  `sectionSpan` so a fenced example in a template is not mistaken for the
  section, and escapes any `|` in the summary before it reaches the table cell,
  so the row keeps its five columns.

- **`/cad-land` never once reported the tracker on the repository it was built
  in.** Host detection compared the origin URL's hostname against the `tea` login
  list, and a forge whose SSH endpoint is a different name from its web host
  matched nothing, which is an ordinary deployment shape rather than a
  misconfiguration. The seam now hands the binding to `tea` itself with
  `--remote origin`, and guards the call rather than the pick: unless some login
  NAMES the origin host through its name, API url or `ssh_host`, it declines to
  ask and prints the `no-login` line it always printed. `tea` does not refuse an
  unmatched remote, it falls back to config order and answers exit 0, so an
  unguarded call would report another server's issues as yours.

  If your forge has a split endpoint, put the SSH host in the login's `ssh_host`
  and the report will bind to it.

### Changed

- The Forgejo tracker read asks for `--state open` instead of `--state all`. The
  server clamps a page at 50 rows whatever `--limit` requests, so on any real
  tracker the read was honestly incomplete and the whole report degraded to a
  skip line. What that costs is that a referenced number missing from the list is
  closed or absent rather than absent, so each unanswered number gets one bounded
  `tea issues <index>` resolve, capped at five per land. A number that neither
  the list nor a resolve answered is reported as `unresolved`, never as closed
  and never as not found: `tea` exits nonzero both for an absent issue and for a
  failed read, and this seam discards child stderr, so naming it would be an
  affirmative answer about input it could not read.

## [3.5.0] - 2026-08-15

### Added

- **The only gate live on a default install fired on a model reading a prose
  list, and left no record either way.** `risk_surface` is `blocking` at every
  stakes level and, at the shipped default, it is the sole review trigger that
  fires at all. Its entire firing condition was prose: `workflows/execute.md`
  told the orchestrator to check a diff range against the eight categories in
  `references/review-triggers.md`, and `workflows/task.md` said the same thing a
  second time for the task path. A match fired the trigger and wrote a lifecycle
  event. A non-match wrote nothing at all. Those two states left identical bytes,
  so the run record could not tell "the detection step was skipped" from "it ran
  and matched nothing", and an omitted check was indistinguishable from a clean
  one.

  `planning.mjs risk-check` is the seam that closes it. `risk-check run` answers
  a resolved commit range with `{checked, categories, matches, inconclusive}` and
  appends one `{"family":"outcome","event":"risk_check"}` line to `trace.jsonl`
  on EVERY invocation, the clean range included, so silence stops being evidence
  of anything. `matches` names the category and the signal that found it.
  `categories` uses exactly the eight tokens `route-table.json` and
  `config.schema.json` already carry - no new vocabulary was introduced, and the
  detector takes the list from its caller rather than restating one.

  `inconclusive` is the honest third answer and is not collapsed into
  `matches: []`. A binary file, a body with no readable hunk and a
  gitlink/submodule bump all read `inconclusive: true`, distinguishable by the
  caller from a range judged clean.

- **Completion now requires the record.** `risk-check status` is the enforcement
  half, and it is the load-bearing one: a seam that plan completion never
  consults leaves the gate exactly as skippable as it was, just with a script
  beside it. Both `workflows/execute.md`'s post-plan step and
  `workflows/task.md`'s `risk_check` step call the seam instead of instructing a
  model to read a list, and neither reports done while the record is absent -
  including a run that answered `ok:true` while its append came back
  `written:false`. Range identity is the RESOLVED commit pair, so a record left
  by an earlier or narrower range of the same plan reports `stale` rather than
  satisfying a later one.

  The enforcement was watched to fail before the wiring landed: run against the
  unpatched tree, it exited 1 and named plans 1 and 2 by number.

  `lib/surface-scan.mjs` did not become a detector and keeps its scoping role -
  it still answers "which categories does this project SCOPE" and still returns
  all eight unconditionally. `lib/risk-diff.mjs` answers "did this RANGE touch
  one". The header of each names the other.

  Detection stays heuristic on purpose. This release does not claim to find risky
  diffs more accurately. It claims that whether the finding step ran is now a
  fact in the record rather than an inference from silence.

### Known issues

- **The detector matches its own test fixtures.** `cadence-core/bin/risk-diff.test.mjs`
  necessarily holds, as literal fixture text, the very signals the detector hunts -
  a fixture proving the `auth` signal fires has to contain something that fires it.
  So `risk-check run` over any range touching that file self-matches on six of the
  eight categories: `auth`, `migrations`, `billing`, `concurrency`, `destructive`
  and `untrusted_input`. The gate's first live firing on this repository was a
  false positive on itself. It breaches no criterion this release set, since
  detection is heuristic by design, but `risk_surface` is blocking at every stakes
  level, so the false positive lands on the one gate that always fires. Prose that
  QUOTES a signal trips it the same way, which is why this note names categories
  instead.

- `inconclusive` is a bare boolean and does not say WHICH half made it true: a
  binary file, an unreadable hunk, or a gitlink.

- A risk record written before this release carries no `base_id`/`head_id` and can
  never satisfy a NAMED range, reporting `stale`. A phase holding one needs a
  single `risk-check run` to re-record before its status call passes.

- `risk-check status`'s range arm resolves the refs it is given, so it must run
  inside the repository that carries them. A caller elsewhere gets
  `unresolved-range` rather than a wrong answer.

## [3.4.1] - 2026-08-15

### Fixed

- **The schema said one gate, the route table fired another.** Three surfaces
  described the review gates and nothing had ever compared them.
  `config.schema.json:81` gave `review.triggers.phase_diff.gate` a default of
  `advisory` and its purpose string said "advisory at shipped", while
  `route-table.json`'s `review.shipped.phase_diff` fired `off`. That one cell
  was the visible half. The invisible half is that a `config.mjs get` of any
  gate no layer had set answered with the SCHEMA DEFAULT rather than with what
  the stakes level actually fires, so all four triggers could disagree and
  nothing said so.

  All four `review.triggers.*.gate` defaults are now the `null` sentinel, and
  each purpose string names the gate for `solo`, `shipped` and `critical` read
  straight off `route-table.json`. `risk_surface` moved with them even though
  its three cells agree today: a scalar default that is legal only while every
  level's cell equals it passes quietly right up to the first cell that moves.
  The `review` grid did not move at all - it is the authority, and this release
  is the other two surfaces catching up to it.

  The workaround came out with the defect. `workflows/execute.md` carried a
  paragraph telling a caller not to pre-fetch a gate through `config.mjs get`
  because the answer would be the schema default rather than the level's;
  `workflows/plan.md` carried the same one. Both now state the shipped
  behaviour, and `references/config-catalog.md`'s gate row stops publishing a
  per-key scalar default that routing never fires.

### Added

- **`self-verify.mjs` check 18, `gate-agreement`.** The check that makes the
  fix above stay fixed, and the reason one visible cell was worth a release.
  `self-verify.mjs` already failed in both directions on rung files and on the
  three routing grids, and it already read `config.schema.json` for the gate and
  stakes vocabularies - it had both files open and had never compared a trigger's
  gate across them, so the drift was invisible to the one check whose job is
  catching exactly this.

  It compares every `review.triggers.<t>.gate` schema default AND its `purpose`
  prose against `route-table.json`'s `review[level][trigger]`, over six codes
  (`gate-default-drift`, `gate-default-invalid`, `gate-prose-missing`,
  `gate-prose-drift`, `gate-grid-missing`, `gate-row-malformed`). The rule is a
  pure lib at `cadence-core/bin/lib/gate-agreement.mjs`, unit-tested from frozen
  fixtures rather than from the live files, so the tests do not move when the
  grid does.

  It was watched to FAIL before the fix landed, not inspected: run against the
  unpatched tree it reported `plan`, `diff` and `phase_diff`, naming
  `phase_diff` together with `shipped` by name.

### Changed

- **`config.mjs get` reports an unset gate as unset.** A gate no layer pinned
  now answers `null` with one `warnings[]` entry naming `route.mjs resolve` as
  what decides it for a level, so a reader can tell "no layer set this, the
  stakes level decides" from "this project pinned it". A pinned gate still reads
  back byte-identical with no warning, a keyless `get` carries no gate warning at
  all, and `config.mjs check review.triggers.diff.gate=null` still refuses with
  `must be one of: off, advisory, blocking, adjudicated` - the `values` arrays
  stayed four-membered, so `set` and `check` behave exactly as before.

  Known gap, filed rather than papered over: `gate-agreement` compares the
  default against the cells, not against the `null` sentinel, so a gate whose
  three cells happen to be identical could regress its default and stay green.
  `risk_surface` is that case today.

## [3.4.0] - 2026-08-15

### Added

- **`/cad-land` step 1 reads the issue tracker.** Cadence audited its own
  requirements, its own plans and its own run record, then landed work without
  ever asking whether that work answered something the tracker had open. Step 1
  now scans `git log <base>..HEAD` for `#N`, `closes #N` and `fixes #N` and
  names each referenced issue with its state ("your branch references #42 and
  #47; #42 is still open"). Reference nothing and it lists the open issues
  instead, as the fallback rather than the headline.

  It reads, it never writes. Landing closes no issue, and closing one stays an
  explicit ask you make at publish time.

  The host comes off the origin URL the same way step 1 already picked the PR
  mechanism: `gh` for github, `glab` for gitlab, `tea` for a host your
  `tea login list` names. Every path that cannot answer prints exactly ONE line
  saying why and the land carries on: no remote, an unrecognized host, no
  login, the CLI missing from `PATH`, a nonzero exit, a response that came back
  truncated or unreadable. A forge CLI that never returns is killed at 10
  seconds, so it cannot stall a land. The call is bound to the repository
  `--dir` names by an explicit `owner/name` selector, not by the process cwd,
  and a referenced issue is never reported as closed when what actually
  happened is that the fetch could not be read.

  `git.issue_check` (bool, default `true`) turns it off. False and step 1 says
  nothing about the tracker and spawns no forge CLI at all.

  Known limits, both one-line degradations rather than wrong answers: `tea`
  clamps a page at 50 server-side, so a Gitea or Forgejo repo with 50 or more
  issues reports the truncation line instead of a list, and a self-hosted
  GitLab or GitHub Enterprise host with no matching `tea` login reads as
  unrecognized.

### Changed

- **The `plan` review is `blocking` at `shipped`, where it was `off`.** At the
  default stakes level a plan had no second opinion of any kind, and the two
  decisions that produced that each named the other as the remaining net:
  `e0b5448` cut the gate to advisory because "a plan at `shipped` has already
  passed cad-plan-checker, a blocking gate ... on by default", `b20fd14` took
  it to `off`, and `70007f7` - one day later, same cycle - flipped
  `workflow.plan_check` to `default: false` because "the plan review trigger
  remains the default second opinion". Both cuts shipped, and neither re-read
  the other's justification.

  `blocking` rather than a return to `advisory`, because the measurement behind
  the original cut (CST-01: findings files referenced by no SUMMARY and no
  CONTEXT) condemned the advisory GATE and not the review. A plan is the
  cheapest artifact in the pipeline to halt on - no code exists yet, the
  payload is one file, and the fix is an edit - and `blocking` adds no
  user-triage turn, which is what `adjudicated` costs at `critical`.
  `workflow.plan_check` stays `default: false`: one net, on, before code.

  `config.schema.json`'s purpose string for `workflow.plan_check` stops
  claiming a second opinion that was not running. `solo` (advisory) and
  `critical` (adjudicated) are unchanged.

## [3.3.1] - 2026-08-15

### Fixed

- **`milestone-prune` stops reporting a half-finished close as a finished one.**
  A phase whose directory could not be moved or deleted was collected as a
  warning, after which ROADMAP.md and REQUIREMENTS.md were pruned for every
  completed phase anyway and the envelope answered `ok:true, action:"pruned"` -
  contradicting the comment above it, which promised a failed rename left both
  documents untouched. The directory pass now runs first and only the phases it
  actually cleared reach the documents, so the tree and the docs still agree; a
  partial application returns `ok:false, reason:"partial-prune"` naming the
  phases that did not clear, and `/cad-milestone` halts on it instead of
  committing the disagreement. Re-running picks up only what is left.

- **An `_archive-<label>` that is a symlink can no longer redirect the archive
  out of the planning root.** The containment check was lexical, so a
  pre-existing link resolved inside the tree, `mkdirSync` succeeded against it
  and `renameSync` followed it. The path is now classified with `lstat` before
  anything moves, and a per-phase destination left by an interrupted close is
  refused rather than clobbered.

## [3.3.0] - 2026-08-15

The evidence Cadence plans and reports from is itself checked this cycle: the
capture queue that silently dropped filed work, the run record that could not
join a provider call to the fire that made it, and the claims the docs make
about the code.

### Fixed

- **`/cad-capture` no longer writes where recall cannot see it.** Five items
  filed after the 2026-08-08 archive block landed below a heading the corpus
  walk does not visit and were invisible to `/cad-plan`'s recall until they
  were lifted by hand, one of them a `[high]` finding that a tuning rule can
  never fire. The writer lands inside the walk, the tag reader admits every
  shape the writer emits, `/cad-health` reports any bullet outside the walk,
  and a concurrent append can no longer lose an update.

- **The run record joins.** `corr` is fire-scoped rather than phase-scoped, so
  a provider call attributes to the fire that made it; a terminal event's
  `--role` is validated against its paired dispatch, so a role with zero
  dispatches can no longer render carrying a token total; and `recorded` counts
  matched dispatches rather than token-bearing events, so a replayed terminal
  stops hiding a missing report.

- **String-form `protected_branches` is honored by all four readers**, the
  fence-blind `## Phases` and `## Active` scanners are guarded, and a blank
  `--root` is refused consistently rather than linting the cwd and returning
  `ok:true`.

- **Fourteen stale claims are corrected at their source.** `README.md`,
  `METHOD.md` and `cadence-core/workflows/plan.md` stated a `plan` review as
  advisory at `shipped` where `route-table.json` resolves `off`;
  `/cad-new-project` and `/cad-adopt` reported the config they had just copied
  as turning plan check on when the template ships it off;
  `config-catalog.md` published a `Risk` knob category with zero rows behind
  it; `recall.md` named two callers where the code makes three; and
  `METHOD.md` and `INTERNALS.md` still described the dispatch-time risk floor
  and its per-surface waivers, both retired in v2.7.0.

### Added

- **A second `/cad-docs-verify` sweep, transcribed and dated.**
  `.planning/DOCS-CLAIMS.md` now carries 933 rows over 32 files, each with a
  generated `run` column and a live line cite, 373 line re-pins, and the seven
  rows phase 4's `trace close` invalidated rewritten to the live call rather
  than silently re-pinned.

- **Two prose assertions that derive both sides from the tree**, in
  `cadence-core/bin/prose-agreement.test.mjs`: README's skill, role and
  rung-file counts measured against `skills/` and `agents/`, and a check that
  `PROJECT.md`'s `### Active` declares its milestone before naming any other
  version. Both were shown to redden on a pre-fix input.

- **`planning.mjs criteria-size`**, so the 3-7 acceptance-criteria ceiling
  `/cad-context` states is counted rather than merely written down.

### Changed

- **One `trace close` subcommand replaces eight workflow files' restated close
  prose**, `trace render` is bounded by default, and the round-trips measured
  as unbatched now issue as one call.

- **The `REQ_ID` documentation states the asymmetry that is live** rather than
  the head-anchored limit `PRS-02` removed: `REQ_ID_EXACT` admits a
  digit-leading category while `REQ_ID_TOKEN` keeps its letter head, so an
  unbolded `2FA-01` remains invisible to the prose scan.


## [3.2.0] - 2026-08-14

### Fixed

- **A `.planning/config.json` arriving with a clone can no longer reparent the
  merged config.** `deepMerge` assigned instead of defining, so `__proto__`,
  `constructor` and `prototype` in a repo layer reached every enforcement
  surface that reads the merge. The hostile fixture that allowed a commit on
  `main` with no output at all from `git-guard.mjs` now produces
  `permissionDecision: "ask"`, identical to the benign control. Those keys
  store inertly.

- **Inspection and enforcement can no longer disagree about the same file.**
  `config.mjs validate` returned `{"ok":true,"checked":0,"errors":[]}` on that
  same hostile fixture, so the tool you would reach for to check a config was
  the one thing that could not see the attack. `flatten`'s `_`-prefix skip is
  narrowed to exactly `_meta`, the `SCHEMA[path]` lookup is `Object.hasOwn`
  guarded, and a test pins the two surfaces together.

- **`workflow.test_command`, `workflow.lint_command` and `review.key_file` are
  global-layer only.** A repo layer that sets one is ignored AND warns, naming
  the key and the file it came from, because silence there hides an honest
  mistake as readily as an attack. A repo layer holding `{"workflow": "x"}`
  replaced the whole user-global section without setting a key at all; that
  ancestor is stripped and warned too.

- **`atomicWrite` refuses a symlinked temp path instead of writing through
  it.** The proof case wrote `PWNED CONTENT` to a file outside the repo and
  left `ROADMAP.md` as a symlink. Temp paths are now per-writer
  (`<file>.<pid>.<n>.tmp`), so two concurrent writers under
  `parallelization.enabled` cannot share one, and `appendEvent` returns
  `{written:false, reason:'symlinked-trace'}` rather than following.

- **No git failure detail can carry credentials.** A remote with userinfo in
  its URL used to land in the envelope verbatim. `redactUrl()` strips it at all
  four emit sites, each with its own test.

- **The unattended-close gate tells "no findings" apart from "could not read
  the findings".** Unreadable stdin, malformed JSON and a valid non-findings
  envelope each halt under `git.auto_close` with a reason naming the failure,
  where all three previously returned `proceed` claiming no surviving finding.

- **A valueless flag can no longer become the integer 1.** `phase-done`,
  `uat record` and `renumber` each validate through `requireInt`, and each
  carries the valueless-form test it lacked.

- **An unreadable CONTEXT.md is a break, not an exemption.** `criteria-coverage`
  under `chmod 000` returned `{"ok":true,"phases":[]}` over two uncovered
  criteria: the exemption was written for an ABSENT context and was silently
  granting itself to an unreadable one.

- **`milestone-prune` never ships a `Deferred` requirement as `Complete`,** and
  never deletes a `## Deferred` bullet while pruning.

- **A `--label` that escapes the tree is refused before any mkdir or rename.**

### Added

- **`review.triggers.risk_surface.surfaces` - the surfaces your project
  actually has.** `risk_surface` is blocking at every stakes level and fires
  once per plan on a detection match, so on a security-shaped phase it is the
  dominant review cost. Naming the subset of the eight categories your project
  contains cuts the fires that were never going to find anything. Absent means
  all eight, so nobody's coverage shrinks on upgrade. Populated by a structural
  scan (`planning.mjs detect-surfaces`) over manifests, directories and file
  types, never keyword greps: the grep approach false-positived `auth` on 16
  matches of `session` meaning Claude sessions, and `money/billing` on prose
  about token cost.

- **`cadence-core/references/reviewer-brief.md`, composed into the cross-model
  payload.** An external reviewer was handed a one-line model-authored
  `instruction` as its entire system prompt, so it never saw the stance, the
  severity definitions, "approach differences are NOT findings", or that an
  empty `findings: []` is valid. At a blocking gate that uncalibrated output
  could FAIL the gate. The brief costs about 670 tokens, 0.56% of the default
  cap.

- **Reviewer identity on the lifecycle event.** The seam resolved the gate but
  not the reviewer SET, so a cross-model review that never happened was
  indistinguishable afterwards from one that did. Observed on 2026-08-13:
  `review.reviewers` was `["openai"]`, the fire went to the Claude subagent,
  and nothing in the record could have caught it. The seam now returns the
  reviewer set beside the gate with its fallback and cause stated, and a
  cross-model fire leaves an event of its own.

- **Adjudication records what it killed.** `<n> of <m> raised` replaces
  `<n> survivors`, so `/cad-suggest` can tell 0-of-0 (the gate is unnecessary)
  from 0-of-9 (the reviewer is miscalibrated and the gate is doing real work).
  It proposed turning the gate off in both cases.

### Changed

- **`plan` and `phase_diff` resolve `off` at `shipped`, and `pre_ship` is
  deleted outright.** An advisory gate blocks nothing by definition: it writes
  a findings file and execution continues. On a reporting user's 3.1.0 run
  `cad-reviewer` was 711,636 of 3,450,628 processed tokens, about 20.6%, while
  the trace recorded it as 0. In this repo's own history two advisory review
  files sat untracked and referenced by nothing. The `adjudicated` arm at
  `critical` is untouched, and a user who does read those files can turn them
  back on.

- **Every dispatch is bounded at `maxTurns: 200` rather than a nominal 400.**
  Measured billed tool calls on single dispatches ran 55, 81 and 106, each a
  lower bound since Edit, Write and Task turns are not billed. One uniform
  value across all 19 rung files, and `references/seams.md` states the bound
  instead of claiming there is none. A test holds the two against each other in
  both directions.

- **A truncated reviewer return stops reading as "nothing survived".** Both
  triage-gate arms gained a third reading keyed on the return's contract SHAPE,
  not on a host stop signal: a return that is not the expected payload reads as
  "the gate could not be evaluated" and asks, and neither arm can reach resume
  from it.

- **`/cad-report` no longer labels an unmeasured figure `Spend:`.** The heading
  names it as the host's own per-dispatch return figure, and the report states
  what it cannot see: advisory fires and cross-model provider calls both record
  none. No new field is captured.

- **Environment overrides commented "test injection only" are gated behind
  `CADENCE_TEST_SEAM=1`.** `CADENCE_ROUTE_TABLE`, `CADENCE_CONFIG_SCHEMA` and
  `CADENCE_PLUGIN_MANIFEST` each did what the comment said they should not.

### Removed

- **The `pre_ship` review trigger, in every direction at once.** By the time a
  land runs, every phase has already been through `plan`, `diff` and the
  `/cad-verify` walk, so it reviewed work that had already been reviewed. Its
  config key, its wiring-table row, `/cad-land` step 3 and its deferred-reads
  register row are gone, and so is the gate it drew in
  `docs/figures/milestone-land.svg`: the milestone exit has one gate now rather
  than two. `README.md`, `docs/WORKFLOW.md` and `METHOD.md` no longer describe
  it as a live gate, and the unattended close is documented as what it actually
  reads, the `risk_surface` findings this branch already settled.

## [3.1.0] - 2026-08-13

### Added

- **`/cad-adopt` - an entrance for a repo that already exists.** Cadence's
  front door assumed a blank page: a brownfield project had no way in short of
  answering `/cad-new-project`'s interview about code already written. Adopt
  derives PROJECT.md, REQUIREMENTS.md and a REMAINING-work ROADMAP.md from the
  code, the manifest and the git history, seeds Traceability through the
  existing seams, and asks only what the repo cannot answer. It refuses a
  subdirectory of a repo - git discovers upward, so `/repo/subdir` would
  otherwise answer from `/repo`'s log while writing `.planning/` into the
  subdirectory. No subagent: the brownfield read is paid in the coordinator's
  own context.

- **`/cad-new-project --brief <file>`.** A design brief settles most of what
  the interview asks. The brief is read whole - no parser, no schema, no marker
  convention - and suppression keys off what it SAYS. Replayed against
  verbatim's own `DESIGN-BRIEF.md`, the settled decisions are not re-asked.
  `docs/DISCOVERY.md` documents the sequence (freeform conversation, then
  brief, then `--brief`) and what a good brief answers; it stays guidance, never
  a scripted interview, because the discovery works BECAUSE it is freeform.

- **The coordinator's own spend reaches the run record.** Every subagent was
  priced and the orchestrating session - half the original cost spiral - was
  invisible. A `--step` marker on `trace append` carries only what the
  coordinator can actually know and never a fabricated token figure;
  `renderTrace` grows a `coordinator` block (`wall_ms`, `bracket_ms`,
  `residue_ms`, time-ordered `steps[]`, overlaps unioned before subtraction,
  residue floored at zero) that is absent entirely on a trace written before
  this release. `trace suggest` reads those figures rather than recomputing
  them, and `/cad-report`'s record-health line reports the residue and its
  heaviest step. Verbatim's phase-1 record ships as a byte-for-byte fixture
  with both readers pinned against it.

- **A spend gate in `/cad-context`.** The assumptions analyzer is the spine's
  most expensive dispatch (75k on verbatim phase 1, 132k on phase 2), and
  nothing asked whether a given phase was worth buying it for. A gate between
  `load_priors` and `analyze` settles phase scope cheaply first and falls back
  to a conversational pass when the phase is small or its ground was already
  settled by a prior phase's deviations - which `load_priors` now reads from
  those phases' SUMMARY `## Deviations`. The size question and the spend
  question are stated as two distinct questions, pinned by a prose-agreement
  test.

- **`/cad-minimalism-review` - a ranked delete-list.** An adversarial
  CORRECTNESS review structurally cannot catch over-building: a hand-rolled
  helper the stdlib already ships, a base class with one subclass, a hook
  nothing calls and a key nothing reads all pass it, because nothing they do is
  wrong. This pass hunts those four species and returns the list in the review
  subsystem's shared findings schema with `severity` carrying the rank. It
  dispatches the existing `cad-reviewer` with a retargeting instruction - no
  seventh role, no sixth trigger, no gate - and it applies NOTHING: the skill
  grants neither `Write` nor `Edit`, so that is structural rather than a
  promise.

- **`/cad-suggest` - the tuner gets a front door.** The retune the run record
  supports was reachable only as a footnote at the end of `/cad-report`. It is
  now a command: every suggestion carries the trace figures behind it and names
  the `/cad-config` key it concerns, and it writes no config itself. A trace
  too thin to clear the evidence floors gets a one-line refusal rather than an
  invented suggestion, discriminated on `events_read` alone - "no record" and
  "below the floors" are different sentences.

- **`/cad-capture --cadence`.** Friction with Cadence noticed while using
  Cadence on somebody else's project had nowhere to go: the note either became
  noise the host project's triage archived as out of scope, or was never
  written. Ten projects of field use produced five lines of Cadence feedback
  total. `--cadence` writes to Cadence's own queue beside the global config
  layer - `~/.claude/cadence/CAPTURE.md`, or `CADENCE_GLOBAL_CONFIG`'s
  directory - carrying the host project and the command that provoked it, and
  never `${CLAUDE_PLUGIN_ROOT}`, which the next upgrade orphans. It makes no
  commit in the host repo, transmits nothing, and has no `.planning/` fallback:
  a note landing in the host repo is the failure the arm exists to close.

### Changed

- **`cad-executor` ships the lean shape and says so once.** Where a task's
  `Verify:` admits two shapes, the executor builds the leaner one and records
  the declined fuller option as an `Open items:` line in its report - not as a
  deviation, whose narrowness is the signal, and not as a sixth field on the
  return digest. The posture rides behind a `Read` at the step that needs it,
  anchored by a `lib/deferred-reads.mjs` register row, so it costs the dispatch
  path nothing until it is wanted and CI fails if the read is dropped.

- **Two surfaces state their mechanic once.** `skills/cad-land/SKILL.md`'s
  guardrails stopped re-deriving the `git.auto_close` mechanic and
  `cad-executor-contract`'s static-analysis carve-out is stated once with a
  pointer, each surface re-pinned in `weight-budgets.json` in the same commit -
  both sat exactly at their pins, so the cut was invisible to CI and the re-pin
  is the only thing stopping the bytes coming back. The named keeps stand: the
  no-preselected-default block and the not-scoped-to-GitHub clause.

- **The suggest presentation rules live in one place.** `workflows/suggest.md`
  is now their only statement; `/cad-milestone`'s retune step and
  `/cad-report`'s closing pointer route there instead of restating them.


## [3.0.0] - 2026-08-12

### Added

- **`/cad-report` - the run record as receipts.** Renders a phase's
  trace.jsonl and artifacts as the story of what the tokens bought: every
  dispatch priced from its own bracket (role, rung, tokens, minutes), every
  gate's outcome named, every deviation that refuted a D-NN cited, plus
  record health (unpaired brackets, malformed lines). Read-only, no subagent,
  and a number absent from the record is reported absent, never estimated.
  `--all` gives the milestone view.

- **Self-tuning suggestions at the milestone close.** `planning.mjs trace
  suggest` reads the joined run record and returns evidence-backed config
  suggestions - a review trigger whose adjudicated fires kept coming back
  empty names its gate key, escalation pressure on a role names its effort
  key, repeated executor checkpoints name `workflow.max_plan_tasks`, a
  re-armed gate becomes a keep-it receipt, and the top spend gets a one-line
  receipt. Every rule has an evidence floor below which it stays silent, and
  `/cad-milestone`'s new retune check presents the list and applies nothing -
  the user names what changes, same discipline as review triage.

### Changed

- **The execute report leads with its verdict.** The done step ordered its
  report by production sequence with the goal-check verdict last - the one
  line the reader came for. Verdict first now. Taken from declined issue #69,
  whose second observation this was.

- **`/cad-decision-review` joins the run record.** Its `cad-reviewer` dispatch
  was the one paid worker in the spine with no lifecycle bracket - the cost
  never reached the trace. It now brackets like every other site (dispatch /
  return / checkpoint), keyed to the decision's phase, or the STATE cursor's
  phase for a PROJECT.md row. The reviewer contract also now admits this
  caller's inlined artifact: decision text arrives in the prompt, and the
  resolve-or-blocker rule binds only when the artifact is a reference - a
  literal reading could previously bail with a bogus "reference does not
  resolve" blocker instead of reviewing.

- **An advisory review persists its own findings.** The advisory arms fire
  overlapped - the `plan` trigger beside the docs commit, per-plan `diff`
  beside the next dispatch - and nothing waits for the return, so a session
  that ends first lost the findings and the trace return entirely: a full
  reviewer dispatch reporting to nobody (the first external dogfood run
  recorded exactly that). On an advisory gate the dispatch prompt now carries
  a persistence tail: the reviewer writes its findings JSON to
  `.planning/phases/<N>/REVIEW-<trigger>.md` and appends its own figureless
  return before returning, and the fire site stops closing that bracket. The
  reporting step reads the file; not-yet-on-disk is reported as in flight,
  never as a clean pass. The trade is explicit: advisory reviewer returns
  carry no token figure - findings durability over pricing fidelity.

- **A deviation that refutes a D-NN corrects the CONTEXT record.** An executor
  deviation can prove a numbered context decision's claim false against ground
  truth, but the correction lived only in the plan report while later phases
  inherit prior decisions summarized from CONTEXT.md - the falsified claim
  propagated to every planner after it. The execute summary step now appends a
  one-line `[corrected by plan-<k> deviation: <the true fact>]` annotation to
  the refuted decision's line, and the docs commit stages CONTEXT.md when it
  does.

- **The release tag moves to `/cad-land`, after the merge.** `/cad-milestone`
  cut the annotated tag at HEAD on the integration branch, before any merge -
  so a non-fast-forward land left the milestone tag naming a commit base does
  not contain, which is why this repo ran `create_tag: false` and tagged by
  hand. The close now ends at the bump commit; land cuts the tag in its
  cleanup step, on the pulled base, after the merge confirms, and still asks
  before pushing it.

- **`/cad-land` learns Forgejo/Gitea.** Host detection knew gitlab and github;
  any other remote silently lost the PR option and the unattended close.
  A remote where the `tea` CLI has a matching login now gets the full arm:
  create (via the git-publish seam first - `tea pr create` never pushes),
  merge by index, confirm merged before any cleanup.

- **The mechanical half of a milestone close is a seam.** Pruning completed
  phases from ROADMAP.md, archiving their directories, and moving shipped
  requirements into `## Shipped` rows were three orchestrator hand-surgeries
  with a recorded failure (a close that left the tree failing its own audit).
  `planning.mjs milestone-prune --label <l> --mode <delete|archive>` now does
  all three deterministically, tested, leaving PROJECT.md evolution and
  next-milestone seeding - the judgment - as prose.

- **`workflow.plan_check` defaults to false.** The checker loop and the `plan`
  review trigger are the same question asked twice - this repo's own measured
  run said so when it turned the key off for itself (~25 minutes across two
  review pipelines for one `/cad-plan`), and the shipped default never
  followed. The checker remains one key away; the `plan` trigger stays the
  standing second opinion.

- **The assumptions analyzer stops re-reading every prior phase.** Its contract
  sent it to "any context files left by prior phases", which is N-1 files by
  phase N, on the most expensive dispatch in the spine (~150k tokens each,
  measured). Prior decisions now reach it as the `<prior_decisions>` summary
  the coordinator already builds from the 3 most recent CONTEXT files; it opens
  a prior file itself only when the code contradicts a cited decision.

- **The advisory plan review overlaps the docs commit.** `/cad-plan` fired the
  `plan` trigger and waited before committing; at `advisory` the findings gate
  nothing and the commit alters no PLAN file, so the fire now rides the same
  message as the commit step and folds into the final report - the same
  overlap the per-plan `diff` review already runs. Blocking and adjudicated
  still fire-and-wait, because applied survivors edit the files the commit
  stages.

- **The dispatch bracket rides `route.mjs resolve`.** Every dispatch site paid
  a separate `trace append` Bash call to open its worker's lifecycle bracket,
  plus a copy of the omit-tokens rule; `resolve --bracket-read <csv>
  [--bracket-plan <key>]` now writes the dispatch event itself - before
  resolution, so a degraded resolve's base-agent fallback is still billed -
  and the rule is stated once in seams.md. Five sites fold; the reviewer's
  stays a standalone append because its resolve fires for backends that
  dispatch no subagent. The census counts both spellings, so a folded site
  cannot read as an unbracketed worker.

- **The shipped reviewer starts at `high`, not `xhigh`.** Four days of trace on
  this repo show 14 reviewer dispatches, every one at the top opus rung, on a
  role that fires more often than any other; several of those fires adjudicated
  to zero survivors. The top rung is what a RETRY climbs to now, which is what
  a retry rung is for. `critical` still starts at `xhigh` and retries at `max`.

- **`pre_ship` is advisory at `shipped`.** Adjudicated pre-ship at flagship
  tier was the most expensive gate in the table, firing on every land, and this
  repo had already switched it off by hand to stay usable. A break at `shipped`
  is a bug report; the branch-wide adversarial adjudication belongs at
  `critical`, where it remains.

- **`model.escalate_on_failure` defaults to false.** Both retries a measured
  `/cad-plan` run paid for were narrower jobs than the pass they followed - a
  minimal-edit revision (opus/high -> opus/xhigh) and a diff-only re-check
  (sonnet/medium -> sonnet/high). Escalation is for a dispatch that failed, not
  a scoped follow-up with less to do; it is one key away for projects that want
  it back.

- **The blocking re-arm count survives a `/clear`.** The one-round cap was
  orchestrator-context state, so a compaction between rounds handed the next
  fix a fresh re-arm - the unbounded loop, back through the window it was
  capped to close. The round is now recorded as a `rearm` outcome in the trace
  and checked against the current correlation id before the narrowed round
  fires; a genuine re-run derives a new id and gets a fresh round, and an
  unwritable trace falls back to in-context counting rather than blocking.

- **A plan no longer asserts what it cannot know.** A task's `Action` stated
  "identifiers, signatures, config keys, behavior" for code that did not exist
  yet. The planner cannot know those, so each guess reached the executor as an
  instruction that reality then contradicted. Measured on this repo's own
  history: one archived plan report carries 36 deviations, another 19, and a
  downstream project's 9 - a guessed field name (`warnings`, really
  `warning_count`), a construction that cannot work (`ENOTDIR` is not
  `ENOENT`), a call path that is not reachable, line numbers moved by earlier
  tasks in the same plan. `Action` now states what must become true and its
  constraints, names symbols that ALREADY EXIST, and never invents an
  identifier, signature, field name or call path for code the task has yet to
  write. `Verify` carries the task's authority: any implementation that
  satisfies it is authorized.
- **A deviation is one thing, not two buckets.** Departures were sorted by how
  architectural they looked - "trivial" fixed inline, "structural" stopped -
  and the trivial bucket explicitly licensed "input validation, error handling,
  security pieces". That is the clause an invented pre-parse repair pass was
  written under, in a phase where the executor's own report said no task
  described it. A deviation is now exactly one thing: an acceptance criterion
  or a locked decision turned out wrong or unachievable. Choosing a shape the
  `Action` did not picture is ordinary engineering, and is not recorded.
- **`risk_surface` fires once per plan, on the committed range.** It fired per
  risky commit, mid-plan, against a staged index. Every match halted the
  executor and cost a fresh-context continuation whose only job was writing
  code no task authorized - itself new risk surface, and the next halt. One
  measured phase spent three executor dispatches (198K, 492K, 337K tokens) on
  a single plan that way. The gate is unchanged and still blocking at every
  level; only its timing moved, so the reviewer now judges a complete change
  instead of a half-built index. `/cad-debug` and `/cad-verify` keep shape (b)
  for their single staged fix.
- The executor's `<commit_protocol>` drops its per-commit risk gate, and
  `risk_surface` is no longer one of its checkpoint types. It stops for a
  structural reason only: a `Verify` that cannot be met, a contradicted locked
  decision, or a fix needing a file outside the plan's lease.
- `cad-plan-checker` weighs `Verify` hardest, since it is now the task's whole
  authority, and treats an invented identifier in `Action` as a BLOCKER.
- `cad-assumptions-analyzer` measures an out-of-repo assumption with the
  operation the code will actually perform, and records the command, date and
  sample size beside the claim. Counting a field across a corpus is not parsing
  it, and the parse is what fails.

[3.8.3]: https://github.com/crenshawdev/cadence/releases/tag/v3.8.3
[3.8.2]: https://github.com/crenshawdev/cadence/releases/tag/v3.8.2
[3.8.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.8.1
[3.8.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.8.0
[3.7.13]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.13
[3.7.12]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.12
[3.7.11]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.11
[3.7.10]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.10
[3.7.9]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.9
[3.7.8]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.8
[3.7.7]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.7
[3.7.6]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.6
[3.7.5]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.5
[3.7.4]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.4
[3.7.3]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.3
[3.7.2]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.2
[3.7.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.1
[3.7.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.0
[3.6.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.6.1
[3.6.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.6.0
[3.5.9]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.9
[3.5.8]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.8
[3.5.7]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.7
[3.5.6]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.6
[3.5.5]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.5
[3.5.4]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.4
[3.5.3]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.3
[3.5.2]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.2
[3.5.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.1
[3.5.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.0
[3.4.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.4.1
[3.4.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.4.0
[3.3.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.3.1
[3.3.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.3.0
[3.2.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.2.0
[3.1.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.1.0
[3.0.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.0.0
