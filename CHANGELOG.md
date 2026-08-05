# Changelog

All notable changes to Cadence are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Cadence follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **A subagent's full output no longer stays resident in the context that
  dispatched it.** The content is identical; only where the bytes live and when
  they load changed.

  `cad-executor` now writes its report to `<plandir>/reports/plan-<k>.md` after
  every task commit and returns a five-field digest - status, task count, commit
  range, deviation count, open-item count. No task table, no deviation text and
  no open-item text rides any return, checkpoints included. The path is derived
  from the plan file's own directory, so `/cad-execute` writes under
  `.planning/phases/<N>/` and `/cad-task` beside its own plan. A `PLAN PARTIAL`,
  timeout or checkpoint continuation is built from that file, so a re-run cannot
  re-execute a task the file already lists complete. In worktree mode the
  executor commits the report itself, by pathspec, which is what carries it
  across the merge without sweeping in a `risk_surface` checkpoint's
  deliberately-uncommitted staged files.

  `cad-verifier` writes exactly one file, `.planning/phases/<N>/verifier-findings.json`,
  in the `uat merge` payload shape, and returns a digest plus that path. It is
  deliberately NOT named `FINDINGS.json`: the seam owns that name and overwrites
  it on every successful merge, so a verifier writing it would destroy its own
  input. `/cad-verify --deep` pipes the file straight in, and the
  hand-transcription step between the two is gone.

  Reviewers receive a reference, never artifact bytes: a `{base_ref, head_ref}`
  pair, a staged-diff scope to re-run in the cwd it inherits, or a path. Every
  fire site - `diff`, `risk_surface`, `phase_diff`, `pre_ship`, `plan` - names
  the shape it uses. Cross-model reviewers, which can run nothing themselves,
  get a composed `--payload <file>`.

  `cadence-core/references/seams.md` now states the break-even rule the pattern
  rests on, so the judgment is written down rather than re-derived per site: a
  file round-trip costs one extra turn and pays only when the read-back folds
  into a turn the parent was taking anyway AND the artifact lands late enough
  that the bytes would otherwise ride every remaining turn.

- **`cad-verifier` gains `Write`, narrowly, and self-verify asserts the
  boundary.** `Write` is on all four rungs; `Edit` and `MultiEdit` stay in
  `disallowedTools`. Agent frontmatter exposes no path-scoped tool permission,
  so a blocking self-verify check (`verifier-write-grant`) asserts the grant and
  both denials on every rung, in both directions. Without it the milestone's one
  deliberate exception could widen silently in a later edit.

- **`planning.mjs uat merge` takes `--payload <file>` and refuses a bad
  envelope.** Two live holes are closed. A literal `null` payload used to exit 0
  printing nothing at all, from a seam whose entire contract is one JSON line;
  and any parseable non-payload JSON, `"hello"` or `{}` included, used to merge
  as an all-zero `ok:true` success, so a truncated findings file reported a
  clean deep pass instead of falling through to the human walk. Both now refuse
  with a named reason (`no-payload` / `bad-payload`) and exit 1, before
  `loadUat` and before any write, leaving UAT.md and FINDINGS.json
  byte-identical. `uat init` and `uat refresh` share the reader and gain the
  same refusal. Stdin still works unchanged when the flag is absent.

  `assertUnderCap` is deliberately UNCHANGED. It still measures the parsed
  string fields, which under `--payload <file>` already ARE the file's
  contents, so a payload's contents are bounded exactly as before. Measuring
  raw bytes instead would count JSON escaping and the `{instruction, artifact}`
  envelope, and a payload that passes today would newly refuse `over-cap` at
  the same `review.max_prompt_tokens` - a behaviour change inside a
  transport-only cycle.

- **`/cad-config`'s catalog stays transcribed rather than derived, and
  `config.md` now says so.** The candidate change was to generate the catalog
  table from `config.mjs keys` instead of maintaining the copy by hand. Two
  independent grounds refuse it.

  The measurement: parsing every slash-command invocation across the local
  transcript corpus yields 5 `/cad-config` runs in total, none carrying
  `--review` or a `<key>=<value>` token, so by `config.md`'s Route rule all
  five reached the interactive menu. Non-menu runs are not a minority here,
  they are zero of five - for scale, `cad-verify` 46, `cad-plan` 44,
  `cad-execute` 39.

  The arithmetic: `node cadence-core/bin/config.mjs keys` emits 20,769 B on one
  JSON line against a 6,827 B catalog table, and the schema's field union
  (`type`, `values`, `default`, `src`, `purpose`, `min`, `max`) carries no
  per-value explanation field, while the walk requires each option to carry its
  Explanation as the option `description`. Deriving would cost three times the
  bytes AND drop required copy, or force re-authoring that copy into the schema
  - a schema change, not a transport change.

  The stated limit: n=5 is thin enough that the smallness is itself the
  finding, which is why the decision rests primarily on the arithmetic. That
  half is independent of run mix, so a wider window showing non-menu runs
  dominating still refuses the derivation.

## [2.2.0] - 2026-08-04

The six requirements v2.1.0 opened with and never picked up, carried forward
whole and closed. The cycle also produced the first end-to-end proof of the
documented install path: from a fully cold state - plugin uninstalled,
marketplace removed, cache deleted - `/plugin marketplace add
https://git.jcrenshaw.dev/crenshawdev/cadence.git` and
`/plugin install cadence@cadence` were walked live against the Forgejo remote,
and the fresh install matched the published manifest exactly (version, commit
sha, install timestamp). Nothing beyond the two documented commands was
needed; the transcripts are committed in the phase record.

### Changed

- **Two routing cells now START where they used to climb.**
  `critical`/`cad-plan-checker` and `shipped`/`cad-reviewer` move their `effort`
  to `xhigh`, which each cell's `retry` already was. Nothing else in
  `cadence-core/route-table.json` moves.

  The measurement behind it: a retry rewrites the whole subagent prompt at the
  2x cache-write tier and re-runs every turn of the work, while effort costs
  output tokens alone - so winning on attempt one is cheaper than climbing to
  it. The plan checker is the case that matters most, because it is one gate
  turn, and a plan waved through costs dozens of executor turns plus a revert.

  This is a forward correction to `[2.0.0]`'s "Escalate-on-failure is
  unconditional, and the rung ladder is reachable" entry: where that entry says
  "the two cells whose retry deliberately equals their starting rung", it now
  reads four. A live resolve over all 18 cells returns 14 that escalate and 4
  that hold. Every rung file stays cell-reachable -
  `agents/cad-plan-checker-high.md` through solo's and shipped's retry, and the
  unsuffixed `agents/cad-reviewer.md` (its `high` rung) through solo's.

- **The release seam can no longer ship a number, or notes, it never got from
  the close.** Three changes to `release-bump.mjs` and its pure core, all
  breaking for anyone scripting the seam directly:

  `bump` now REQUIRES `--version`. The shipping number is the one
  `/cad-milestone` already confirmed with the user; the seam reads no planning
  prose at all, where it used to fall back to `PROJECT.md`'s `### Active`
  section and then the roadmap title - prose no path keeps current between
  cycles, and which the shipped project template carries no version token for.

  Every refusal emits `ok:false` and exits 1 with a named `reason`
  (`no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade`, `not-an-upgrade`), replacing the `ok:true, action:"error"` shape
  a scripted caller could read as success. A target that is not a strict semver
  upgrade over the manifest's current version is now one of those refusals: a
  downgrade used to pass, because any `from !== to` counted as a bump.

  Content staged under `## [Unreleased]` is PROMOTED into the dated
  `## [<version>]` section rather than left above it, so a release stops
  shipping a dated heading over an empty section while its notes sit in
  Unreleased. `## [Unreleased]` survives as an empty stub, and a run whose
  dated section ends up with no body reports `changelog.section_empty` so the
  close authors the notes before the bump commit.

### Removed

- **The git guard's shell parser, 2,251 lines of it.**
  `cadence-core/bin/lib/shell-tokens.mjs` (the quote-state tokenizer),
  `cadence-core/bin/lib/destructive-git.mjs` (a model of git's option grammar)
  and both their test files are deleted, along with `references/git.md`'s
  rail-3 evasion grammar and out-of-grammar table. This supersedes **TOK-01**
  on both halves: the six push-hole closures v1.4.0 shipped, and the
  command-position deny gate that v2.0.0 added on top of them.

  Both rails now read `cadence-core/bin/lib/git-segments.mjs`, about thirty
  lines: a segment counts only when its command word is `git`, and the verb is
  its first non-flag word. `git.on_protected` keeps its `refuse` hard block on
  `git commit`, which remains the guard's only deny surface.

  Why, since the tokenizer was closing real holes. A detection widener is safe
  to get wrong (being wrong costs a prompt, not a bypass), which turned out not
  to mean cheap to get wrong. The escape surface behind `bash -c`, `$(...)`,
  `${...}`, aliases and `ssh` is unbounded, so it billed as an open-ended review
  debt: three consecutive blocking `risk_surface` panels in a single phase, each
  finding new holes, each answered with more grammar, and `git switch -f main`
  still silent at the end of it. Then the measurement that settled it - the scan
  was O(K x N) in memory (3.1GB at 224KB of input, a V8 abort at 280KB) inside a
  hook that runs on every Bash call and **fails open**, so a long enough command
  line switched the guard off and let the push inside it run unprompted. The
  replacement is total and linear; a test pins the same input deciding in
  milliseconds, above the measured abort point.

  Deleting the wide reader also retired a second rule. Detection had been
  any-position, so `rg -t sh "git commit"` was read as a commit, so refusal had
  to be narrowed back to command position by an enumerated prefix set that three
  review rounds kept finding new members of. Anchoring detection to the command
  word makes those silent up front, so `denyable` and `unplaced` are gone with
  nothing replacing them.

  **The accepted cost.** These shapes can really run git and are now silent, by
  construction rather than by oversight. Each is a pinned test row in
  `git-segments.test.mjs` and `git-guard.test.mjs`, and `references/git.md`
  rail 3 carries the same list: `bash -c` / `sh -c` / `zsh` / `dash` / `eval`
  wrappers; `$(...)`, backticks and subshells; transparent prefixes (`sudo`,
  `timeout`, `nice`, `xargs`, `VAR=x`); `env -S`; a quoted path with a space
  (`git -C "my repo" push`); line continuation; and `ssh host "git push"`.
  Heredocs, `${...}`, brace expansion, `$'...'` escapes, aliases and variable
  indirection were out of grammar before and remain so.

- **`git.on_destructive`**, removed outright. The key shipped across the schema,
  the template, `references/config-reach.md` and `workflows/config.md` on the
  premise that a destructive rail would follow it. That rail was the parser's
  reason to exist, so it does not follow. The key reached no hook on any commit,
  which made its reach row a claim nothing honoured: `ask` and `off` did the
  same nothing. Git's own reflog and `ORIG_HEAD` remain the recovery path for
  `reset --hard` and friends, as they were before the key existed.

### Fixed

- **The config read face merges a layer once, whatever its spelling.**
  `mergeLayers` computes file identity before either read
  (`cadence-core/bin/lib/config-merge.mjs`), so a symlinked or
  relative-vs-absolute spelling of one file reports a single layer instead of
  `global+repo`, and a broken such file earns one parse warning instead of
  two. Six of the seven config-reach and risk-waiver defects deferred from the
  v2.0.0 cycle closed in the same pass, each pinned by its own test; the
  seventh (`validate --global` blessing a file `set --global` refuses) is
  named open rather than silently dropped.

- **`route.mjs`'s warnings reach the caller on every shape.** `warnings[]` now
  rides the `unknown-role` and `unresolved` `ok:false` shapes too, and a held
  risk floor is audible in both `reason` and `warnings` - a workflow relaying
  the bundle relays the disagreement instead of swallowing it with the error.

## [2.1.0] - 2026-07-30

Two gates that were meant to protect the work after them, and did not. An
adjudicated review used to hand its survivor list back as something that read
like a work order, so the model went straight to fixing all of it; and the
coverage gate exempted the exact checklists it existed to check. Both close
here, along with the paid seam's missing payload bound.

Backfilled 2026-08-03: this milestone closed in the planning docs at `e457e47`
but its release section was never written, so the notes below are reconstructed
from the phase summaries at `643663e~1` and the commit range
`fe2310f..e457e47`. The gap is itself an instance of what REL-03 exists to fix.

### Added

- **`review.max_prompt_tokens`** (default 120000 estimated tokens), refusing an
  over-cap payload on both paid commands BEFORE any request is made
  (`review-provider.mjs`: `resolveMaxPromptTokens`, `estimatePromptTokens`,
  `assertUnderCap`). Present on all four config surfaces (REV-03).
- **self-verify check 10, `dispatch-phrasing`** - a new pure lib
  (`bin/lib/dispatch-phrasing.mjs`) that FAILS a concurrent dispatch whose prose
  does not say ONE message, run over `workflows/` and `references/` (REV-03).
- **A persisted findings envelope** at `phases/<N>/FINDINGS.json`, carrying
  `rejected_entries` and `skipped_entries`, so a discarded verifier entry
  outlives the dispatch that produced it (COV-01).
- **`uat record --criterion`**, which repairs a dropped criterion link after the
  fact rather than requiring the checklist be rebuilt (COV-01).
- **Provenance in the coverage envelope** - `version: {plugin, uat_fields}`, so a
  coverage result states which seam version produced it (COV-01).

### Changed

- **An adjudicated review ends at a triage gate, not a queue.** Survivors are
  presented as a numbered list with severity and `file:line`, NONE listed first
  and taken as the default, and the turn ends on that question. Authored once in
  `references/review-triggers.md` § 6 and reached from five firing sites by
  pointer rather than by copy: `cad-land` step 3, `workflows/plan.md`,
  `workflows/verify.md` `route_failures`, and `workflows/execute.md`'s
  sequential-diff and parallel fires (TRI-02).
- **A trigger's reviewers dispatch concurrently in one message**, stated as an
  instruction with the hedge removed, and one route resolve per set rather than
  per reviewer (REV-03).

### Removed

- **The reviewer contract's anti-padding clause**
  (`skills/cad-reviewer-contract/SKILL.md`). Anti-inflation is kept. The clause
  was pre-filtering findings the user never got to see, which is the same defect
  the triage gate closes from the other end (TRI-02).

### Fixed

- **The coverage gate exempted the checklists it existed to check.**
  `criteria-coverage` treated a fieldless checklist as legacy and passed it
  silently; it now reports a `fieldless-checklist` break. The legacy exemption is
  decided on ids DECLARED (a `declaresIds: none | some | unknown` signal computed
  from raw source lines) rather than on ids successfully parsed, so an unreadable
  criteria section can no longer buy an exemption (COV-01).

## [2.0.0] - 2026-07-30

The routing question changes. Cadence used to ask how much a dispatch should
cost; it now asks what it costs if the work is wrong. The config key carrying
that question is renamed rather than revalued, with no back-compat alias, and
that is the one reason this release is major: a config you already wrote stops
validating.

### Removed

- **`model.profile`**, replaced by the top-level **`stakes`** key. Its values
  go with it: `fast`, `balanced`, `quality` and `auto` are gone, and `stakes`
  takes `solo`, `shipped` or `critical`.
- **`model.auto.escalate_on_failure`**, replaced by
  **`model.escalate_on_failure`**, which is honoured at every stakes level
  rather than only inside the retired `auto` mode.
- **`model.auto.ceiling`**, removed outright. Escalation no longer steps a
  spend ladder, so there is no ceiling left for it to stop at.
- **`model.auto.max_escalations`**, removed outright. A role escalates to
  exactly one rung, the retry rung its own routing cell names, so there is no
  second step to cap.
- The `auto` mode's difficulty signals go with it, so `route.mjs resolve` no
  longer accepts `--files` or `--ambiguity`. No workflow or skill ever passed
  them.

None of these has a back-compat alias, and the break is on the KEY, not merely
on the value it holds. `model.profile: "solo"` is exactly as invalid as
`model.profile: "balanced"`. `/cad-config` refuses to write the retired name
and names `stakes` in the refusal; `config.mjs validate` reports it as an
unknown key; and both live read faces, `config.mjs get` and
`route.mjs resolve`, emit a warning saying the key is present and ignored
instead of resolving silently at the default and reporting that result as
configured.

### Changed

- **The routing axis asks what a break costs, not what a dispatch costs.**
  `stakes: solo` means nobody else runs this and a break costs only your own
  time. `stakes: shipped` means other people run this and a break comes back
  as a bug report. `stakes: critical` means a break is not a bug report. The
  default is `shipped`. "How much should this dispatch cost" was answerable but
  useless, and on a flat-rate plan it is not a question you have at all, while
  "what happens if this is wrong" is answerable in about a second and is the
  only form of the question a risk signal can ever set on your behalf.
- **Escalate-on-failure is unconditional, and the rung ladder is reachable.**
  It used to be gated behind `model.profile: "auto"`, a mode the shipped
  default never selected, so a failed attempt was re-dispatched at the rung it
  had just failed at. A retry now climbs to the retry rung its own routing cell
  names, at every stakes level, and `model.escalate_on_failure` set to `false`
  is how you turn that off. Every role climbs: the fixed per-role escalation
  target that made five of six retries a no-op is gone, and the two cells whose
  retry deliberately equals their starting rung report the rung as held rather
  than claiming an escalation.
- **A routing cell yields four knobs, not a model.** One question in - what
  does a break cost - and out comes the model, the effort rung to start at, the
  rung a failed attempt climbs to, the gate each review trigger fires at, and
  whether the deep verify pass runs. Quality is not one dial, and no amount of
  effort expresses "fire a blocking cross-model review before this ships".
- **Review gates come from the stakes level.** `plan` is advisory on a solo
  project and adjudicated once other people run it; `diff` is off, then
  advisory, then blocking; `phase_diff` is opt-in until critical; `pre_ship`
  is advisory, then adjudicated. `risk_surface` is blocking at every level,
  because it fires only on a detection match. A
  `review.triggers.<t>.gate` you set still WINS over the level's, and the
  disagreement is reported rather than resolved silently - a key you set must
  not quietly stop doing anything.
- **The deep verify pass is level-driven.** It is off at `solo` and on above,
  still once per phase, and `--deep` forces it at any level.
  `workflow.verifier: false` remains the off switch.
- **Models come from the cell, not from a role's tier.** The `(stakes, tier)`
  matrix and the whole `tier` vocabulary are gone: a role's model was being
  decided by a field named after something else. The routed vocabulary is
  `sonnet` and `opus`; `haiku` and `fable` are reachable only by an explicit
  `model.overrides.<role>` pin.
- **`/cad-audit` proves criterion coverage in both directions, and FAILs on a
  criterion that reached no UAT item**, naming the id and the phase with a
  concrete next action. Requirement tracing already caught work nobody committed
  to deliver; this catches a criterion that never reached the checklist, which
  is a weaker claim than proof of delivery and the honest one: an item counts as
  coverage once it exists, whatever its result. Nothing structural connected the
  two before - the checklist was worded from the criteria by hand, so the link
  was model judgment and no later pass could recover it. Upgrading costs
  nothing: a checklist written before the field existed is read as pre-field
  legacy, reported and never broken, and new checklists carry the link from the
  next `/cad-verify` onward.

### Added

- **Six more rung agent files, 19 in total**: `cad-planner-max`,
  `cad-verifier-medium`, `cad-verifier-max`, `cad-reviewer-max`,
  `cad-plan-checker-medium` and `cad-plan-checker-xhigh`. Each is the same
  contract at a different depth, and CI fails a rung file that carries any
  instruction of its own.
- **Cell validation in `self-verify`**, every problem naming the offending cell:
  a (level, role) pair with no cell, a rung with no agent file, a rung file no
  cell reaches, a model outside `model_aliases`, a rung outside `rung_order`, a
  gate outside the four gate values, a trigger name the schema does not define,
  and a retry rung that sits BELOW the rung it started on - which no membership
  check can see and which would otherwise let a retry think less while
  reporting that it thought more.
- **A computed risk floor: detection raises the stakes level by itself.** The
  eight risk surfaces Cadence already recognized in prose are now declared data
  - a `surfaces` block in `cadence-core/route-table.json`, each row a list of
  path tokens and the level it floors to. `route.mjs resolve` reads the phase's
  declared PLAN `files:` list, matches it against those rows, and raises the
  level to the highest floor it hits, so all four knobs come from the raised
  row through the one cell grid. It only ever raises: a baseline already at or
  above the floor changes nothing and says so in `reason`.
- **`route.mjs resolve --phase <N>`, with a cursor fallback.** The phase comes
  from the flag, or from `.planning/STATE.md` when the flag is absent, so an
  existing call site keeps working. Every unresolvable input - no phase, no
  PLAN, an unreadable PLAN, a `--phase` that is not a phase number - resolves at
  the baseline with `ok:true` and a warning where there is something to say. A
  refusal would route a possibly-risky phase LOWER than its own baseline, so
  there is none. `cad-planner` and `cad-assumptions-analyzer` are never floored:
  they run before the phase they are about has a plan.
- **`risk.override.<surface>`, the per-surface waiver.** One boolean per surface,
  DECLARED repo-scoped (`src: repo`). The level drops back to the baseline only
  when EVERY detected surface is named, the waived names stay in `reason`, and a
  value that is not strictly `true` waives nothing and says so. A misspelled
  surface is refused at the write face with the accepted names listed, and
  `--global` is refused there too. That refusal is airtight in both directions:
  the resolver reads waivers from the REPO layer alone and names an ignored
  global one in `warnings`, with the repo-scope rule and the file it belongs in,
  and the write face compares paths by filesystem identity rather than as
  strings, so an alias for the global file (`<dir>/./config.json`, a symlink, a
  relative path) is refused like the plain spelling.
- **A `surfaces` walk in `self-verify`, both directions**, every problem naming
  the offending row: a floor that is not a stakes level, a floor below the level
  every shipped row is required to carry, a pattern list that is empty or holds
  a token no path can ever produce, a surface with no `risk.override` key to
  waive it, a `risk.override` key naming no surface row, and drift in either the
  `stakes_order` or `gates` vocabulary the resolver reads by index.
- **Every config key's reach is stated where the key is set, and the sweep that
  proves it is re-runnable.** Six `tier` keys - the five
  `review.triggers.<t>.tier` and `review.decision_review.tier` - resolved as a
  universal per-trigger model dial while only a cross-model reviewer can honour
  one: `review.providers.<name>.tiers[trigger.tier]` is the only bridge from a
  trigger to a provider model id, and the `claude-subagent` reviewer's model
  comes from the routing cell instead. They now say `cross-model reviewers only`
  in their own `purpose`, the same phrase per-trigger `effort` already carried.
  Three more purposes stopped overstating what reads them: `granularity` sets a
  roadmap phase count and splits no phase into tasks, `workflow.research` is
  read by the new-project research step alone, and `workflow.skip_discuss`
  selects which command `/cad-progress` suggests for an unplanned phase rather
  than skipping any step. `cadence-core/references/config-reach.md` now carries
  a reach row for every schema key, with the human test for a new one stated,
  and `self-verify` check 9 fails a key with no row, a row naming no key, and a
  reach narrower than `universal` that the key's own `purpose` never states -
  so a key added later cannot arrive with its reach unanswered.
- **The plugin's home moved to
  `https://git.jcrenshaw.dev/crenshawdev/cadence.git`.** The GitHub repository
  stops moving; the self-hosted Forgejo remote is the only published source
  from this release on. An existing GitHub-installed user follows it with three
  commands:

  ```
  /plugin uninstall cadence@cadence
  /plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git
  /plugin install cadence@cadence
  ```

  Nothing about the plugin changes with the move. `/plugin update
  cadence@cadence` follows the manifest's `repository` field, so an install
  that predates this release keeps pointing at a repository that no longer
  receives commits until those three commands are run.
- **Acceptance criteria carry ids.** Every criterion in a phase's CONTEXT.md now
  starts with a phase-local `AC<N>` token (`- [ ] AC1: ...`), which `/cad-context`
  writes from now on. The grammar is stated in full at
  `cadence-core/references/acceptance-criteria.md` and read by one function, with
  a named diagnostic for each of eleven shapes outside it - the central one being
  a bullet carrying no id at all, and the section-level one a near-miss
  `## Acceptance criteria` heading, which used to drop a whole phase's criteria
  out of the coverage domain in silence. A fenced code block declares nothing, so
  a documentation example cannot mint a phantom id. The id never renumbers:
  `/cad-phase` insert and remove move a phase directory whole and rewrite
  nothing inside it, which is why the id is not phase-prefixed and not a path.
- **`planning.mjs criteria-coverage`**, a new seam subcommand that traces every
  criterion to the UAT item that tested it, in both directions. A criterion that
  reached no item is verdict-breaking and named by its id; an item that traces to
  no criterion is reported and moves nothing. A checked phase that declared
  criteria and has no UAT.md at all breaks the same way, as `missing-uat` - the
  total drop is the case the gate most has to see.
- **Two UAT item fields, `criterion` and `origin`.** `criterion` names the
  `AC<N>` an item was built from, written by `/cad-verify` and carried through
  every later rewrite of the file. `origin` (`criterion | verifier | smoke`)
  declares an item that legitimately has no criterion - a gap the deep verifier
  appended, or the cold-start smoke check - so it is exempt rather than merely
  unlinked, and `uat record --origin` can set it after the fact. Every new
  checklist also carries a `fields_version` frontmatter marker, which is what
  the legacy exemption reads: a file the seam wrote is never mistaken for a
  pre-field one, however few links its items hold.

### Fixed

- **A `review.triggers.<t>.gate` outside `off|advisory|blocking|adjudicated` no
  longer reaches the bundle.** A value a config layer set used to win over the
  level's gate without ever being checked, so `"blockign"` silently replaced
  `critical`'s deliberately-blocking `risk_surface` gate - a one-character typo
  disabling a review, on the axis the new risk floor rides on. An invalid or
  non-string gate now loses to the level's gate and is named in `warnings`, the
  same treatment an unknown model alias already got. A VALID gate that disagrees
  still wins and still reports the disagreement: this is a validity check in
  front of that precedence, not a change to it.

### Closed on the way past

The last sweep for keys that are resolved and then thrown away found most of
them already closed by the work above, each carrying its own dated marker in
`DESIGN.md` section 6 - recorded here rather than fixed a second time:

- the `(stakes, tier)` model matrix, deleted with the routing cells;
- per-trigger `review.triggers.<t>.effort`, scoped to the cross-model arm by
  `#64` in `v1.5.0`;
- the `escalate_effort_variant` shim, retired with the rung ladder;
- `model.profile` and the `model.auto.*` keys, retired with the axis.

### Upgrading

`config.mjs set` writes keys and never removes them, and the seam refuses the
retired names outright, so the stale block has to come out of the file by hand:

1. Open `.planning/config.json`, and `~/.claude/cadence/config.json` as well if
   you set a global layer.
2. Delete `profile` and the whole `auto` block from the `model` object. If
   `auto.escalate_on_failure` was set, keep that value as
   `"escalate_on_failure"` directly under `model`; it defaults to `true`.
3. Run `/cad-config stakes=shipped`, or `solo`, or `critical`, to set the new
   key.

### Known issues, deferred to 2.0.1

Found by this cycle's own goal-backward verification and recorded rather than
quietly shipped. Full evidence per item is in `.planning/phases/6/UAT.md`.

- `config.mjs get` still returns a `risk.override.<surface>` set in the
  user-global layer as an effective value, with no warning, while `route.mjs`
  correctly ignores it. `/cad-config`'s menu reads `get`, so it shows `true`
  for a waiver that waives nothing.
- A duplicate row in `references/config-reach.md` is dropped without an issue,
  so a stale row can mask a corrected one inside the check whose purpose is
  that no key's reach is skipped silently.
- Five smaller ones: the `https?://` URL mask does not cover SSH clone forms,
  `fsIdentity` throws outside its guard on a non-string path, the reach-cell
  parser does not case-fold, and the global-waiver warning misfires when both
  config layers resolve to one file or the surface name is misspelled.

## [1.5.0] - 2026-07-28

Four corrections to things Cadence said about itself, and one structural
change so there are fewer places left to say them.

### Added

- **Self-verify asserts every preloaded agent contract resolves.** A `skills:`
  entry naming a skill that does not exist is skipped by the host *silently*,
  with only a debug-log warning, which leaves an agent running with no contract
  at all - a failure that reads as an agent ignoring its instructions rather
  than as a typo. The new `agent-skills` check fails loudly instead, and also
  flags a resolved skill that sets `disable-model-invocation: true`, which
  cannot be preloaded and produces the same end state by a different route.
  The tools lint now scans preloaded contracts as agent prose, so moving the
  contracts out of the agent bodies did not silently empty its input.

### Changed

- **Each agent's contract is stored once, as a skill preloaded through the
  `skills:` frontmatter field.** The seven files in `agents/` are now
  frontmatter plus a pointer, between 464 and 592 bytes each, down from as
  much as 8786. Six contract skills hold the prose, one per role rather than
  per file: `cad-plan-checker` and `cad-plan-checker-high` share one, which is
  what that pair always claimed to be. They carry `user-invocable: false`, so
  they never appear in the slash-command menu. Behaviour is unchanged; five of
  the six moved byte-identical. The exception is the plan-checker pair, whose
  high variant carried real behaviour of its own - shipping behaviour in a file
  whose only job is to name a rung is the failure this design exists to
  prevent, so it moved into the shared contract as a `<rung>` section and both
  files now state only which rung they are.
- **`cad-plan-checker-high` no longer reads another agent file at runtime.**
  The `@`-include workaround is retired. The file itself stays, because it
  exists to carry `effort: high` - frozen in frontmatter, and named by string
  in `route-table.json`'s `escalate_effort_variant` - and retiring it needs a
  rung ladder that does not exist yet.

### Fixed

- **The worktree fork point is selectable, and v1.4.0 said it was not.**
  `seams.md` called it host-owned and NOT caller-controllable, and five other
  surfaces restated that binding on the strength of it. The host's
  `worktree.baseRef` setting decides it: `fresh` (the default) forks from the
  remote default branch, `head` forks from the local HEAD and carries the
  integration branch's unpushed work - which is the documented use case for
  isolating subagents on in-progress work. The `fresh` default is the whole
  cause of the phase-4 failure the false claim was written to explain. Every
  surface now states the setting, the version it holds for (Claude Code
  >= 2.1.208), and the nuance that inside a worktree `head` is that
  worktree's own HEAD.
- **/cad-execute no longer parallelizes into worktrees that lack its plans.**
  `choose_path` runs a new read-only seam, `cadence-core/bin/worktree-base.mjs`,
  which resolves the effective `worktree.baseRef` through the Claude Code
  settings cascade; under `fresh`, unset, or an unreadable answer the phase
  runs sequentially and names the fix. `/cad-config` offers to set `"head"` in
  the project's or the user's settings file - offers, and never writes a
  user's settings without being told to. The executor's `<worktree_mode>`
  assertion stays either way: a setting the user can change back, and a
  session CLI override no script can see, are not guarantees.
- **Per-trigger `effort` no longer claims to apply where it cannot reach.**
  `fire(trigger)` resolved `{gate, tier, effort}` and consumed `effort` on the
  cross-model arm only. The `claude-subagent` arm dispatches through a seam
  whose surface is `(agent_name, prompt, model?)`, so on a stock install the
  configured value was read, resolved, and dropped with nothing said - every
  trigger, every fire. Wiring it through is not available: `effort` is a
  subagent definition field with no per-dispatch override on the Agent/Task
  path, so varying it needs per-rung agent files. The key is scoped instead.
  `review-triggers.md` states which fields reach which backend,
  `config.schema.json` says it at the point of setting, and a fire whose
  configured effort differs from `cad-reviewer`'s frontmatter-pinned `high`
  now names the difference in one line rather than silently ignoring it.

## [1.4.1] - 2026-07-28

Two internally-inconsistent contracts, both closed by subtraction.

### Fixed

- `cad-executor`'s `<process>` ended by requiring a success-criteria check
  whose output the same contract gave nowhere to put: the `<report>` block has
  no field for it and `execute.md` never mentions it. The next orchestrator
  step, `goal_check`, already redoes that assessment with the full phase diff
  in view and an articulated purpose. The instruction is deleted rather than
  wired, because the consumer that would have justified it already exists one
  step later. The per-task predict-then-verify at process step 2 is untouched:
  that one has a consumer, a contract, and it is what makes a SUMMARY's claims
  trustworthy. (#65)
- `cadence-core/references/conventions.md` opened with "Shared rules every
  skill and workflow follows. Referenced, not repeated." It is `@`-included by
  exactly one skill and named in prose by 18 other files, so its rules reached
  a model only when something happened to read the file. The header now states
  the reach the file actually has, an on-demand reference cited by path where a
  rule is relevant or `@`-included where a workflow needs the whole set, and
  says plainly that nothing in it reaches an agent that has not read it. The
  alternative, including it everywhere, was rejected: it would spend resident
  context in every session on rules most invocations never need. (#67)

## [1.4.0] - 2026-07-28

Stated grammars. Cadence parsed four formats it owns with accreted heuristic
regexes, and each one failed silently in both directions: an over-read
fabricated a requirement id that surfaced as an `/cad-audit` orphan, an
under-read dropped a real path and handed the parallel-safety gate a false
`overlaps: []`. Both look like success. Each of those readers is now a stated
grammar with a written-down reference, an out-of-grammar table, and a
parser-level test per row - plan-file frontmatter, the shell text both git
rails read, the roadmap phase list, and the `## Active` requirement section -
and every input outside a grammar is reported rather than silently reread. The
spine's own bookkeeping moved with them: `/cad-plan` now seeds the traceability
rows a milestone close used to need by hand.

### Added

**`/cad-plan` seeds its own traceability rows**

- A new `planning.mjs seed-reqs` subcommand, called by `/cad-plan` at the point
  the plan is written, inserts a `Pending` REQUIREMENTS `## Traceability` row
  for every `## Active` requirement the phase covers. A milestone close no
  longer needs a hand-populated table before `/cad-audit` passes - which it did
  need at the v1.2.0 and v1.3.1 closes, and which is why neither close's audit
  fired. Seeding is idempotent: a second run returns `{"seeded":[],
  "skipped":[...]}` and leaves the file byte-unchanged.
- The `## Active` section it reads has a stated grammar (`parseActiveIds`) with
  its own reference, `cadence-core/references/req-traceability.md`. The
  single-writer invariant is restated across five prose surfaces as a
  Status-TRANSITION rule rather than a row-existence one: `/cad-plan` may create
  a row, but only `cad-verify` moves a Status beyond `Pending`.
- A worktree-mode executor asserts its own `PLAN-<k>.md` exists before task 1
  and halts `blocked` naming the missing path and the worktree HEAD, instead of
  planning against a stale merge point - the phase-4 fork bug three executors
  caught only by noticing. It repairs nothing: merge, rebase and fetch are
  banned inside the worktree. The honest worktree binding is now stated across
  six surfaces; Cadence issues no `git worktree add` anywhere, so it cannot
  guarantee a fork point and no longer claims to.

### Fixed

**The plan-file frontmatter grammar**

- `readFrontmatterList` is one normalized classifying pass over a stated
  grammar - a `normalize` step (BOM, CRLF, lone CR, leading blank lines), a
  quote-state value scanner, and a block reader with an explicit terminator
  set - replacing the accreted regexes. The greedy `\[(.*)\]` that three
  reviewers found independently is gone: `files: [a.md, b.md]   # [see notes]`
  reads two files rather than swallowing the comment's bracket, and
  `requirements:   # TODO fill this in` above a block list reads the block
  instead of the comment. That last one was a HIGH regression introduced by the
  v1.3.1 cycle.
- Every input outside the grammar now carries a named diagnostic on the `audit`
  and `plan-overlap` envelopes as `frontmatter_issues`, where it previously
  changed what was read with `issues: []`. The shipped template's own former
  shape was one of them: a `files: []  # comment` key line followed by indented
  paths took the inline arm, so `currentKey` was never set and every path
  beneath it vanished - two plans in that shape handed `plan-overlap` a false
  `overlaps: []` and the parallel gate would dispatch both onto the same file.
  Also diagnosed: a quoted value with trailing text (`- "src/shared.rs" (new)`,
  which used to mint a value carrying its own quotes and match nothing), a
  commented-out key line inside an open block (an over-read of one key and an
  under-read of the other in one pass), `requirements:["#41"]` with no space
  after the colon, a backslash escape inside an inline list, and a
  backtick-wrapped value tested on the value's BOUNDARY - which catches a half
  wrap, a wrap plus punctuation, and a backticked id that `#`-comment handling
  would otherwise reduce to a one-character phantom.
- Frontmatter paths reach `plan-overlap` byte-exact as the plan wrote them:
  `resolveValue` replaced the old global rewriting, so `src/x(1)` and
  `` lib/a`b.mjs `` survive unrewritten while a `- **Files:** src/a.rs (edit)`
  task line still normalizes. A path declared in one plan's frontmatter and the
  other's task line now reports as an overlap where it was a silent miss.
- The grammar, every diagnostic code, and a per-code table stating whether that
  code DROPS what it read are written down in
  `cadence-core/references/plan-frontmatter.md`, the payload column proved at
  the audit seam rather than asserted in prose. 33+ parser-level grammar rows,
  each reported as its own test.

**One quote-state tokenizer for the git-guard rails**

- The seven shapes that reached the network with no prompt now all ask: a
  quoted `-C` path with a space (`git -C "my repo" push origin main`), `&` as a
  separator, `$(git push)`, backticks, a subshell, an escaped `\"` before a
  real push, and the shell-wrapper set `bash` / `sh` / `zsh` / `dash` / `eval`
  with `-c`. This closes the "Six pre-existing `git-guard` rail-3 holes"
  known gap recorded under [1.3.1]; `eval` was the seventh, found while
  gathering context for the fix.
- The strip-and-split arms and the parity-aware continuation pre-pass are
  DELETED, not extended: one left-to-right pass in
  `cadence-core/bin/lib/shell-tokens.mjs` carries a single quote/escape state,
  preserves word boundaries, descends into `$(...)`, backticks and subshells,
  and re-tokenizes a shell wrapper's operands. Six regex arms would have been
  the alternative; regex accretion is what produced the two push-rail
  regressions this repo already paid for. The module is pure and total (no
  I/O, never throws, bounded descent and expansion), so the grammar is tested
  as a table with no subprocess per row.
- Both rails read that one output, so they agree on what a wrapped command IS:
  a wrapped `git commit` on a protected branch now follows the same
  `git.on_protected` path as the bare form. Detection is any-position, so
  `sudo bash -c "git push"` is seen; hard refusal is command-position only at
  BOTH levels - the wrapper's position and the git word's own - so a read-only
  `rg -t sh "git commit"`, a bare mention like `grep git commit` and a lookup
  like `command -v git commit` can never be blocked by a rail meant for real
  commits.
- Command position is one rule with nothing to enumerate: word 0 of the simple
  command, after leading `VAR=value` assignments and empty placeholder words,
  and past an `env` word with its option region. The consequence to know is a
  deliberate regression: under `git.on_protected: refuse` a transparent prefix
  now ASKS rather than denying, so `sudo git commit`, `timeout 60 git commit`
  and `find . -exec git commit \;` all prompt instead of hard-blocking. The
  enumerated prefix-command and shell-keyword sets that used to keep those
  denies are gone, because every prefix carries its own option grammar
  (`sudo -u john`, `timeout --signal KILL 60`) and the tail proved open-ended
  across three review rounds - while producing a false deny on
  `command -v git commit`, which runs nothing.
- A substitution used as a global option's argument
  (`git -C $(pwd) push origin main`, `` git -C `pwd` push ``) keeps its word
  slot, so `-C` can no longer eat the real subcommand, and a `#` glued onto a
  substitution (`echo hi $(echo)#x; git push`) is mid-word content rather than
  a comment. Both ran a real push with no prompt.
- GNU `env -S` / `--split-string` is read as the command line env really splits
  and executes. Finding it means walking env's whole option region: the options
  that take a separate argument (`-a`/`--argv0`, `-u`/`--unset`, `-C`/`--chdir`)
  are skipped WITH that argument instead of ending the scan, and `-S` is
  matched anywhere in a short cluster rather than only at its head, so
  `env -S "git push origin main"`, `env -u HOME -S "..."`, `env -C /tmp -S
  "..."` and `env -iS "..."` all reach a decision - each was a real push with
  no prompt. An env option the guard does not know no longer ends the scan
  quietly: the command text is read for a `git` token and the guard asks, so
  the next unanticipated option cannot become the next silent bypass.
- A command carrying a `git` word the tokenizer cannot place - an unterminated
  quote, a heredoc-fed or pipe-fed wrapper - now asks instead of going silent,
  and never denies. A shape with no `git` word in it (`echo "unterminated`,
  `eval $CMD`) stays silent.
- The grammar and the shapes deliberately left out of it (heredocs, `<<<`,
  `${...}` expansion, brace expansion, ANSI-C escape sequences, aliases and
  functions, variable indirection, `ssh host "git push"`) are written down in
  `cadence-core/references/git.md` rail 3, each out-of-grammar row stating the
  behavior it actually has and pinned by a test.

**A stated grammar for the roadmap phase list**

- An empty `## Phases` is now a derived closed-milestone state instead of
  `unparseable-roadmap`: `planning.mjs status` returns `ok:true` carrying an
  additive `cycle:"none"` field, with `current` and `total` unchanged (`null`
  and `0`). `/cad-progress` therefore works in the window between a milestone
  close and the next cycle, where it used to report the roadmap as broken.
  `cycle` is present only in that state, so a caller cannot read a closed
  milestone as "all phases complete" from `current === null` alone.
- A phase-shaped line that is NOT a canonical entry - a plain bullet, a
  heading, an ordered item, a table row, a prose mention - is reported per line
  with its own diagnostic code and the offending line named in `detail`, rather
  than one blanket string, and never classifies as a closed milestone. That
  includes the case which reverted the attempt made during the [1.3.1] close: a
  wiped checkbox list whose `### Phase N:` detail sections survive, which a
  heuristic reported as a cleanly closed milestone. The classification scan
  deliberately reads past the `## `-bounded extent the canonical parse uses.
- `PHASE_LINE` is unchanged - nothing new counts as a phase. This is a
  classifier OVER the `## Phases` section, not a wider phase parser: what
  counts as a phase for `status`, `audit`, `phase-done` and the cursor's
  `total` is exactly what it was.
- Drift detection stays live against a closed milestone, which is the one state
  where the cursor is the only surviving evidence: `phase complete` and
  `ready to plan` agree, `planned`, `executed` and `context gathered` are
  drift, `paused` keeps its any-point carve-out. A surviving `phases/N/`
  directory reports as a new `phase-dir` drift kind, and a stale `of <M>`
  cursor against a zero-phase roadmap reports cursor drift on its own - after a
  tagged close deleted the phase dirs, that total is all that is left to see.
- `cursor set` derives `of 0 (no active cycle)` from a pruned roadmap, so
  `/cad-milestone` step 6 runs with no extra flags on the tree its own step 3
  produces; that step now also prunes each completed phase's `### Phase N:`
  detail section, without which a template-conformant close never reaches the
  closed state. `/cad-progress` and `/cad-milestone` route between milestones
  to `/cad-phase add`, the only workflow that appends a phase line to an
  existing roadmap.
- The grammar, its four states and its out-of-grammar table are written down in
  `cadence-core/references/roadmap-phases.md`, each row pinned by a
  parser-level test.

**An audit armed in the partially-planned state**

- An `## Active` requirement no phase has picked up now breaks `/cad-audit` as
  `unpicked` and moves `counts.broken`, so the traceability gate holds while a
  milestone is only partly planned - rows for some ids and not others, the
  state a milestone spends most of its life in - and not only against a
  zero-row table. That blind spot is the residue of what let the v1.2.0 and
  v1.3.1 closes through.
- `counts.total` now counts Traceability ROWS PLUS unpicked ids, so
  `total = traced + broken + deferred` still holds once a break can exist with
  no row. This is a real change for any caller written against
  `total === rows.length`.
- `unseeded` is row-count-independent: it names the `## Active` ids with no
  Traceability row at ANY row count, not only when the table is empty. It is
  also no longer verdict-neutral, which deliberately reverses the additive
  shape shipped one milestone earlier - a diagnostic that never moves the
  verdict leaves the ship gate exactly as permeable as it was. The two zero-row
  reports are unchanged: `{active_ids: []}` for a present-but-empty section,
  plus `no_active_section: true` when the heading is absent.
- A line inside `## Active` that the bold-bullet grammar does not read - a
  v1.3.1-style table row, an indented sub-bullet, a `*`/`+` bullet, an unbolded
  bullet, an ordered item, a `###` heading, or a prose line in a section that
  declares no ids and names an id recorded nowhere else in the file - is
  reported in `active_issues` with its line, a code and the offending text
  instead of vanishing. The grammar itself is byte-identical: these are
  diagnostics, not a wider parser, and each code names why THAT line is unread
  so the fix it implies changes something.
- The grammar reads any bold span as an id, which is what `seed-reqs` treats as
  declared and does not change. `/cad-audit` narrows on its own side instead:
  only an id that is exactly `PREFIX-N` or `#N` may break the verdict or enter
  `counts`, so `- **Note**: scope frozen` is reported as
  `active-non-id-bullet` rather than failing a gate under a name that is not a
  requirement, and `- **AUD-01:**` can never be counted twice.
- A bullet carrying a SECOND id-shaped bold span
  (`- **AUTH-01** and **AUTH-02**: both sides`) reports
  `active-multi-id-bullet`. The grammar reads the first span only, so without
  this the rest vanished with `issues: []` and a committed requirement could
  drop out of scope while the ship gate reported clean. The grammar is
  deliberately NOT widened to read every span: taking them all would mint an id
  out of ordinary emphasis (`- **GRM-01**: the **core** path` would declare
  `core`), the same silent failure reversed. Emphasis that is not id-shaped
  reports nothing, because nothing is lost.
- The two exits for a broken id: plan it into a phase (`/cad-plan` seeds the
  row), or move the bullet out of `## Active` into the deferred section below
  it (`## v2 Requirements` in the shipped template). A row with an em-dash
  Phase cell is `no-phase`, not an exit.
- A project with no `## Active` heading gains no break from this rule at any
  row count, so a pre-v1.4.0 tree audits exactly as it did before, until the
  heading is renamed. The grammar and its out-of-grammar table are written down
  in `cadence-core/references/req-traceability.md`, each row pinned by a
  parser-level test.

### Breaking

- `/cad-audit`'s `counts.total` is Traceability ROWS PLUS unpicked `## Active`
  ids, not `rows.length`. A caller written against `total === rows.length`
  reads a different number now that a break can exist with no row.
- `unseeded` is no longer verdict-neutral. This reverses the additive shape
  shipped one milestone earlier, deliberately: a diagnostic that never moves
  the verdict leaves the ship gate exactly as permeable as it was. A tree with
  an `## Active` id no phase has picked up now FAILs an audit that passed
  before.
- Under `git.on_protected: refuse`, a transparent prefix before a real commit
  (`sudo git commit`, `timeout 60 git commit`, `find . -exec git commit \;`)
  now ASKS rather than hard-denying. The enumerated prefix-command and
  shell-keyword sets that produced those denies are gone; each prefix carries
  its own option grammar, the tail proved open-ended across three review
  rounds, and the enumeration produced a false deny on `command -v git commit`,
  which runs nothing. A missing deny costs a prompt on a real commit; a wrong
  deny hard-blocks read-only work.

### Known gaps

- **Markdown decoration inside a frontmatter value that touches neither
  boundary.** `` - **`src/shared.rs`** `` still resolves to a value that
  matches no sibling's plain spelling, with no diagnostic. The boundary rule
  catches every wrap that reaches an edge; an interior backtick cannot be
  flagged without also flagging `` lib/a`b.mjs ``, which must stay clean -
  structurally identical inputs. Closing it means stating one rule about
  markdown in values, not adding a sixth arm.
- **`backtick-wrapped-value` fires on any key's scalar**, including prose keys
  no seam reads. Two plans with disjoint file lists can still get a
  `frontmatter_issues` entry and lose their parallel dispatch. Fails safe
  (throughput, not correctness); the shipped template has no prose scalar keys.
- **`seed-reqs`' `mismatched` result is computed but surfaced by no caller**,
  so a moved or renumbered requirement reports as a clean skip in the
  user-visible report.
- **A `blocked` worktree halt has no described remedy.** The no-self-repair
  halt is by design; what is missing is the orchestrator-side refresh path in
  `execute.md`.

## [1.3.1] - 2026-07-27

A tech-debt cycle. Every open bug filed by the post-v1.2.0 review sweep was
triaged, all thirteen were accepted, and all thirteen are fixed here. No new
features, no config keys, no workflow changes. The theme running through them is
that a seam which used to fail quietly now says so: a malformed shipped data
file, a bad flag value, an unreadable symlink and a backslash-wrapped
`git push` each used to degrade into something that looked like success.

### Fixed

**Silent data-file failures** (#39, #40, #43, #44)

- A malformed global or repo config layer is now skipped and named in a new
  `warnings[]` field rather than silently reverting every setting to its
  default, which was indistinguishable from the file being absent. `values` and
  `source` stay byte-identical to the absent case, and a merely-absent layer
  stays silent (`lib/config-merge.mjs`, `config.mjs get`).
- `route.mjs` and `config.mjs` read their shipped `route-table.json` /
  `config.schema.json` inside the dispatch guard, so a corrupt or missing one
  degrades to `{ok:false, reason:"bad-table"|"bad-schema"}` on one JSON line
  instead of throwing at module load. `CADENCE_ROUTE_TABLE` and
  `CADENCE_CONFIG_SCHEMA` inject fixtures hermetically.
- A corrupt `model-hints.json` surfaces a warning in the detect envelope instead
  of silently disabling `classify()`'s non-text-model exclude filter, which had
  been failing open (`review-provider.mjs`).
- `self-verify` treats an absent core surface dir, `weight-budgets.json` or
  `INTERNALS.md` as a failure on a full tree rather than skipping it and
  reporting green with zero coverage. Keyed on `.claude-plugin/plugin.json`, so
  minimal `--root` fixtures are unaffected.

**Seam input validation** (#42, #45)

- A shared `requireInt` guard (`lib/require-int.mjs`) rejects bad numeric flags
  before any write. `cursor set --total` no longer writes an unparseable
  STATE.md while reporting `ok:true`; `route.mjs resolve --attempt` no longer
  coerces NaN to `attempt:1`.
- `phase-done --reqs` keys off flag presence rather than truthiness, so the
  valueless form and an empty interpolated `--reqs ""` are both refused instead
  of bulk-closing the entire phase.
- A scalar or array top-level config is rejected on all three faces: `validate`
  errors at `(root)`, the read path skips it with a warning rather than
  returning the scalar at `source:"repo"`, and `config.mjs set` refuses to write
  over it.

**planning-files parser robustness** (#41, #46, #47, #48)

- `parseRequirements` bounds the Traceability section at the next `## ` heading
  and skips GFM alignment cells, so colon-aligned separators stop minting
  phantom requirement rows and failing `/cad-audit` for no reason.
- UAT items anchor on the first line and hand-added `### ` sections round-trip
  verbatim through a new `extras[]` channel; `uat merge` reports partial success
  with `skipped`/`rejected` counts instead of dropping appended items silently.
- `recall` joins an unquoted multi-word query instead of searching only its
  first word, and indexes completed captures with their phase and a `[closed] `
  marker instead of as junk.
- One `readFrontmatterList` serves both `requirements:` and `files:` in inline,
  block and scalar YAML forms, and a name-less `### Phase N:` heading parses.

**renumber and git-guard hardening** (#37, #49, #50)

- `renumber` leaves a decimal-phase STATE cursor where it is and emits a `warn`
  naming it, instead of silently shifting it onto a phase that does not exist.
- A colliding renumber destination is refused before any write, including the
  case where `git rm -r -q` exits 0 while leaving untracked or modified tracked
  files behind, which had let the next phase nest inside the removed one.
- A renumber apply that dies partway reports the ops that completed and the one
  that failed, rather than a bare `{ok:false, reason:"internal"}`. This is a
  report, not a rollback: the remove destroys a directory first, so a rollback
  would promise a guarantee the code does not have.
- One dangling or unreadable `.md` symlink no longer collapses a whole
  `self-verify` or `weigh` run. The walker skips it, and `self-verify` reports
  it as an `unreadable-surface` problem while finishing the rest of the lint.
- `git-guard` joins backslash line-continuations before parsing subcommands, so
  a wrapped `git \` + newline + `push` reaches the push rail. A single-pass
  alternating quote strip stops a real push beside a quote character from going
  silent, and a push inside a quoted multi-line string still produces no prompt.

### Known gaps

Recorded rather than hidden, both confirmed during phase-4 verification and
deferred by explicit decision:

- `weight.mjs` under-reports an entire subtree when one descendant is
  unreadable. `self-verify` still goes red, so CI does not pass silently. The
  fix wants per-entry recursion, not a wider catch.
- An `unreadable-surface` detail emits `readlinkSync`'s raw absolute target,
  contradicting the comment two lines above it. Cosmetic.
- Six pre-existing `git-guard` rail-3 holes (`git -C "my repo" push`, `&` as a
  separator, `$(git push)`, subshells, escaped quotes, `bash -c`) are silent
  both before and after this cycle and stay out of scope. They want one
  quote-state tokenizer, not more regex arms.

## [1.3.0] - 2026-07-24

"liteSpeed": a flow pass over the whole `/cad-*` surface that cuts coordinator
round-trips without changing what the workflows produce. Two shared conventions
let the spine batch independent known-path reads into one message and fan
independent subagent dispatches out concurrently, instead of walking them one
turn at a time. Three correctness bugs the audit surfaced ship alongside.

### Added

- Parallel-work and concurrent-dispatch conventions (`references/conventions.md`,
  `references/seams.md`), wired into ~18 workflows and skills: independent
  known-path reads batch into one message; independent agent dispatches fire
  concurrently, reusing one route resolution.
- `/cad-config` detects all review providers in one concurrent batch instead of
  serial per-provider timeouts.

### Fixed

- `/cad-progress --stats` no longer writes STATE.md in its documented read-only
  mode (it walked the cursor-reconcile step before the stats stop).
- `/cad-undo` applies the protected-branch guard before a committing revert, like
  every other commit-producing step.
- `/cad-config`'s interactive menu labels `(current)` from the repo file's own
  value, not the effective (possibly global-inherited) value, so an inherited
  global is no longer silently pinned into the repo file.

## [1.2.1] - 2026-07-23

Three high-severity fixes from a post-1.2.0 cross-model review sweep over the
executable seams. All three corrupted state or weakened protection while
reporting success - the silent class the sweep was hunting. Each ships with a
regression test written failing-first.

### Fixed

- **A newline in verifier-authored UAT text can no longer flip a verdict.**
  `renderUat` flattens every field value to one line on write, so an evidence
  string containing `"\nstatus: pass"` stays inert instead of reparsing as a
  second status line where last-assignment-wins silently turned a failed item
  into a pass and opened the phase gate. (#35)
- **`renumber insert` no longer corrupts the phase directories when the
  highest phase is a decimal insertion.** The dir-move ceiling is computed
  over integer phases only, so with a `2.1` present the countdown visits the
  integer dirs it must shift and leaves the decimal dir untouched - previously
  it did the exact opposite and still reported ok. (#36)
- **`git-guard` honors the config it documents.** `on_protected: "deny"` now
  hard-blocks as an alias of `refuse` (it previously fell through to a soft
  ask), and a lone-string `protected_branches` guards the named branch instead
  of silently reverting to `['main','master']` - in `git-publish` too. (#38)

## [1.2.0] - 2026-07-22

The judgment-sharpening cycle, dogfooded on Cadence itself. It repairs the
cross-model review seam so a second opinion actually fires instead of silently
no-opping, sharpens how the planner splits work and how context decides which
decisions are worth remembering, adds an on-demand way to stress-test one
load-bearing decision, and grows the cross-model roster with DeepSeek.

### Cross-model review, repaired

- **The run-as-script guard now compares realpaths on both sides**, so
  `review-provider.mjs` no longer no-ops when the plugin is installed through a
  symlink - cross-model `review` / `consult` / `detect-models` reach the real
  provider instead of degrading to the subagent unnoticed. A symlink regression
  test invokes the script through a link and asserts a non-empty JSON line.
- **An empty or unusable provider result surfaces one line** in the caller
  before falling back to `claude-subagent`, rather than degrading silently.

### Sharper planning and context

- **`cad-planner` carries a standing separation-of-concerns nudge** - a
  heuristic, not a hard rule - that prefers small single-purpose tasks over a
  shared core and splits responsibilities that differ on trigger, size,
  lifecycle, failure-resume, freshness, or ownership. It applies to every plan
  with no per-phase restatement and never forces a split that does not earn
  itself.
- **`cad-context` marks a decision durable only when it passes a three-part
  filter** (hard-to-reverse, surprising-without-context, and the result of a
  real trade-off). Durable decisions are written under a `## Durable decisions`
  heading and resurface via recall; the phase-local rest stay under
  `## Decisions`. Legacy `CONTEXT.md` files with only `## Decisions` still
  resurface unchanged - no retrofitting.

### Decision review

- **`/cad-decision-review <path>`** runs an on-demand refute-then-adjudicate
  pass over one load-bearing decision (a `CONTEXT.md` line or a `PROJECT.md` Key
  Decisions row) through the existing review subsystem. `cad-reviewer` - and a
  cross-model provider when one is configured - refutes the decision; the main
  model grounds each objection against Context7 (library/API claims) and the
  real codebase, then rules it `survives | partial | refuted` with a concrete
  amendment list. It never auto-fires and reports its cost qualitatively. New
  `review.decision_review.{tier,effort}` config governs the model.

### DeepSeek cross-model provider

- **DeepSeek is a third cross-model review provider**, via its own Chat
  Completions adapter (not an OpenAI Responses base-URL swap). Because DeepSeek
  has no server-side `json_schema`, the adapter uses `json_object` mode with the
  finding schema injected into the prompt and the shared validate-on-return
  guard, so a schema-ignoring response degrades to a structured `bad-shape`
  rather than bad data. `reasoning_effort` maps the effort dial and keys resolve
  via `DEEPSEEK_API_KEY`, never logged. Selectable through `review.reviewers`
  and `review.providers.deepseek.tiers.*`.

## [1.1.0] - 2026-07-17

The stable `1.1.0`, promoting the `rc.1` and `rc.2` line to a public release. The
full feature detail lives in those two entries below - recall, measured context,
the two-tier git model, and the release lifecycle all shipped there and carry
forward unchanged.

This final round closed the one acceptance the candidates could not: the
autonomous close (`git.auto_close`) was exercised live end-to-end against the
real remote - audit, tag, PR, merge, then reset to a pulled base with the merged
integration branch reaped - confirming the close chain the `rc.2` tests proved in
isolation also holds in a real publish. The never-auto-push rail via the
git-publish seam stays intact; `auto_close` remains opt-in and off by default.

## [1.1.0-rc.2] - 2026-07-17

Second release candidate toward `1.1.0`, built by dogfooding Cadence on itself.
This line closes Cadence's biggest self-admitted gap - its write-only memory -
turns the context-engineering claims into measured, CI-enforced facts, and gives
the plugin an explicit git branching model plus a release lifecycle that keeps
its own version honest. It accumulates the `rc.1` recall work and adds this
round's git model and release mechanics. The final `1.1.0` tag is cut only at
publish.

### Recall - the write-only memory gap, closed

- **`memory.backend` now defaults to `builtin`** (was the reserved, wired-to-`none`
  socket in `1.0.0`). `none` remains the off switch. The feature's value is being
  there without setup.
- **Deterministic BM25 recall over `.planning/`** as a zero-dep `planning.mjs
  recall` subcommand - same corpus and query always rank the same, no timestamps
  and no embeddings. An empty corpus returns `{ok:true, results:[]}`, never an
  error.
- **Recall is injected where past knowledge changes a decision:** `/cad-context`
  (assumptions), `/cad-plan` (task breakdown), and `/cad-debug` (hypotheses) each
  pull cited snippets at the moment they start reasoning.

### Measured context, enforced in CI

- **Per-surface context-weight measurement** (byte and estimated-token weight of
  agent and skill prose) via a deterministic seam subcommand.
- **A blocking self-verify budget check** names the surface and its overage, so
  prose bloat is caught mechanically, the same way drift is.
- **A blocking tools-declaration lint:** agent prose may reference only the tools
  declared in that agent's frontmatter.

### Two-tier git model

- **`git.integration_branch`** (`milestone` default, `trunk` escape hatch) plus
  **`git.auto_branch`** (`ask` | `auto` | `off`). In `milestone` mode a
  per-milestone integration branch is created at cycle start as the reconciliation
  point parallel worktrees fork from and merge into, keeping merge churn off
  `main`. `trunk` composes with the existing protected-branch guard and creates
  nothing.

### Land cleanup and opt-in autonomous close

- **`git.on_land_cleanup`** (default on): after a land or merge actually lands,
  return to base, pull, and reap the merged integration branch - never via a
  remote-tracking delete.
- **`git.auto_close`** (opt-in, default off): lets `/cad-milestone` and `/cad-land`
  run the whole close - audit, tag, PR or MR, merge, reset - with no per-step
  prompts. A blocking `pre_ship` finding still halts the chain before merge. With
  it off (the default), `/cad-land` still asks the publish mechanism with no
  preselected default: the opt-in never changes the default posture. The decision
  core, gate-halt, publish seam, and guard behavior are covered by tests; the full
  unattended chain has not yet been exercised end-to-end against a live remote, and
  that run is the gate for the final `1.1.0`.
- **The never-auto-push rail holds.** The GitHub arm's one sanctioned push runs
  through a code-guarded `git-publish` subprocess seam invoked only by `/cad-land`;
  every Bash `git push` the guard sees still asks unconditionally (the old
  `isPlainPush` command-string exemption was deleted).

### Release mechanics folded into the close

- **`release-bump.mjs`** bumps a distributed plugin's own `.claude-plugin/plugin.json`
  version and scaffolds the dated CHANGELOG heading and link reference as part of
  the milestone close, idempotently. Non-plugin projects are unaffected (it skips
  when no manifest is present). A plugin release stops shipping with a stale
  version.

### Release prep and store readiness

- **Public docs reconciled** to the shipped code (README, MANIFESTO, DESIGN,
  LINEAGE, NOTICE, CHANGELOG), verified by `/cad-docs-verify`.
- **DESIGN.md records the reversed decisions** with what changed and why - the
  never-auto-push reversal (opt-in `auto_close` plus the one sanctioned push seam)
  and the deleted `isPlainPush` whitelist.
- **GSD lineage framing settled** to independent distillation, with the ~3%
  documentary-mass figure date-labelled (measured 2026-07-10, GSD commit d010ea1).
- **Plugin-store metadata** added (`displayName`, marketplace description);
  `claude plugin validate --strict` exits clean.

## [1.0.0] - 2026-07-16

First public release. Cadence is a standalone planning-and-execution system for
Claude Code, installed as a plugin. Its methodology descends from
[GSD](https://github.com/open-gsd/gsd-core) (MIT) - the discuss/plan/execute/verify
loop - but the codebase is an independent distillation carrying roughly 3% of GSD's
documentary mass (measured 2026-07-10, GSD commit d010ea1). See
[`LINEAGE.md`](./LINEAGE.md) for the measured distance and
[`NOTICE.md`](./NOTICE.md) for the attribution.

### The loop

- One disciplined cycle: `/cad-new-project` then `/cad-context`, `/cad-plan`,
  `/cad-execute`, `/cad-verify`, per phase, with `/cad-progress` reporting where
  you stand and auto-resuming incomplete work.
- One atomic conventional commit per task.
- Durable state lives in `.planning/` files and git, never in the conversation,
  so you can `/clear` at any phase boundary and the next command rebuilds from
  disk.
- 22 skills and 7 agents, and nothing beyond them: no team or multi-author
  tooling, no feature catalog.

### Determinism ladder

- **Deterministic seams.** Every read and write of `.planning/` state, model
  routing, and config validation runs through small zero-dependency Node scripts
  (`planning.mjs`, `route.mjs`, `config.mjs`, `review-provider.mjs`) that emit one
  JSON line and never block the loop. Prose keeps the judgment; the scripts keep
  the invariants.
- **Harness-enforced git rails.** The protected-branch guard is a `PreToolUse`
  hook (`git-guard.mjs`), enforced by the harness rather than by prose the model
  can talk itself out of. It acts only inside a Cadence project and never touches
  unrelated repositories.

### Git model

- Atomic commits, never an automatic push, and a `/cad-land` step that asks how
  you want to publish (push, MR or PR, tag, or leave local) with no preselected
  default.

### Review and routing

- Adversarial review is a first-class, configurable subsystem: a fresh-context
  Claude reviewer by default, with pluggable cross-model reviewers (OpenAI and
  Gemini, direct API calls with provider-enforced structured output). A
  user-gated consult can bring a second model's angles to a debugging dead-end.
- Model routing ships three profiles (fast, balanced, quality) plus an optional
  `auto` mode that picks model (and effort, via role variants) per task, with
  guardrails. Failure escalation only ever raises; a retry is never demoted.

### Memory

- A built-in minimal memory (`.planning/CAPTURE.md`). `memory.backend` reserves
  the seam for a richer backend; only `none` is wired today.

### Hardening pass (2026-07-16, before tagging)

The entry above was drafted 2026-07-15; before cutting the tag, the whole
codebase went through a claims audit and a four-pass sweep, and everything
found was fixed in this release rather than deferred.

- **Parallel safety is arithmetic now.** `planning.mjs plan-overlap` intersects
  the declared file lists of a phase's plans; `/cad-execute` refuses to
  parallelize on any overlap or any plan with no declarations.
- **New review trigger `phase_diff`** (opt-in, off by default): one aggregate
  review of the merged phase diff after parallel execution, because per-plan
  reviews cannot see cross-plan interactions.
- **Configurable consult cadence:** `review.consult.attempt_threshold`
  (default 3) sets how many failed fixes count as a dead-end in `/cad-debug`.
- **Working-method discipline** (after Karpathy's "Recipe" generalized):
  planners order tasks skeleton-first (a wired tracer bullet by commit 2-3),
  executors state the expected output before running each verification and
  record surprises as deviations, and every goal-check claim carries file:line
  or command-output evidence.
- **Guard hardening:** the push rail matches the actual git subcommand
  (`git stash push` and quoted arguments no longer trip it), the project check
  walks up from subdirectories, and the hook is time-bounded.
- **Model detection fixes:** legacy non-reasoning families and Gemini 2.x are
  no longer steered into effort parameters their APIs reject.
- **Ten config keys with no reader were pruned** rather than documented,
  including a `git.auto_push` switch that contradicted the no-push rail.
- **Self-verification in CI:** a drift linter proves every config key, script
  invocation, and path named in the prose exists in the code, on every push.
  Plus typechecking of the `@ts-check` pragmas and a Node 22/24 matrix.
- **Tests: 84 to 132**, covering the previously untested invariants, with
  hermetic fixtures and midnight-robust assertions. The pass surfaced and
  fixed two latent bugs in decimal-phase renumbering.

### Install

```
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

[2.2.0]: https://git.jcrenshaw.dev/crenshawdev/cadence/releases/tag/v2.2.0
[2.1.0]: https://git.jcrenshaw.dev/crenshawdev/cadence/commit/e457e47
[2.0.0]: https://git.jcrenshaw.dev/crenshawdev/cadence/releases/tag/v2.0.0
[1.5.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.5.0
[1.4.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.4.1
[1.4.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.4.0
[1.3.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.3.1
[1.3.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.3.0
[1.2.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.2.1
[1.2.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.2.0
[1.1.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.1.0
[1.1.0-rc.2]: https://github.com/crenshawdev/cadence/releases/tag/v1.1.0-rc.2
[1.0.0]: https://github.com/crenshawdev/cadence/releases
