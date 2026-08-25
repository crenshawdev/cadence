# Cadence conventions

The reference a skill or workflow reads when one of these rules applies to
what it is doing. Loaded on demand, not preloaded: cite it by path where a
rule is relevant, or `@`-include it where a workflow needs the whole set.
Nothing here reaches an agent that has not read it.

## Paths

- Engine: `${CLAUDE_PLUGIN_ROOT}/cadence-core/` - the single canonical engine root,
  resolved by the Claude Code plugin runtime. No host probing, no locator shim.
  Skills @-include workflows from here.
- Project state: `.planning/` in the repo root - the SAME git repo as the code
  it plans (see DESIGN.md canonical set: PROJECT.md, REQUIREMENTS.md,
  ROADMAP.md, STATE.md, phases/<N>/{PLAN,SUMMARY,UAT}.md). Cadence assumes one
  repo holds both plans and code: the protected-branch guard, diffs, and
  goal-check all run where `.planning/` is, so a phase whose code lives in a
  different repo is NOT a supported mode. Keep `.planning/` in the code repo;
  driving a separate code repo from here is the steerer's responsibility, not
  the tool's. (execute.md guards and warns if it detects the split, but does
  not make it work.)
- Phase directory: `.planning/phases/<N>/`, created lazily by the first skill
  that needs it (cad-context or cad-plan). The grammar for `<N>`, and the
  guarantee that no spelling is ever silently redirected to a DIFFERENT phase's
  directory, are stated in `references/roadmap-phases.md` and nowhere else.

## Deliberate shortcuts

A corner cut on purpose is marked at the line it was cut, in whatever comment
syntax the file already uses, on ONE line. The marker is the token
`CADENCE-DEBT` followed immediately by a colon, then three fields in order,
separated by ` | `:

1. the one-line description of what was cut;
2. `ceiling` and a colon, then what it does not handle;
3. `trigger` and a colon, then what should prompt revisiting it.

Both named fields are REQUIRED. A marker missing one is named by the harvest
rather than dropped, so an incomplete marker is visible instead of silent.

`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" debt-harvest --root .`
collects every marker in the tracked tree into `.planning/CAPTURE.md`'s own
`## Debt markers` section, rewritten wholesale on each run. The MARKER in
tracked code is the durable record; that section is a regenerable view of it, so
deleting a marker from source removes its bullet on the next run. The harvest
does not add its section to the recall walk, so a harvested marker reaches
`/cad-plan`'s recall only when it is promoted by hand.

The token is namespaced so it cannot collide with a marker another tool or
another contributor introduces, and it is not negotiable later: once markers are
planted across a tree, changing the token means editing every one of them.
Measured over this tree with `git grep -w` on 2026-08-09, `SHORTCUT`, `DEBT`,
`CORNER`, `TRIPWIRE`, `CADENCE-DEBT` and `CAD-DEBT` all returned zero, while
`CUT` returned 9 and `CEILING` 1 - so those two were never candidates.

Documentation ABOUT this convention describes the fields in prose, as this
section does, and never writes a literal marker line: the harvest scans tracked
source, so a documented example would be ingested as a real marker.

## Config resolution

The only correct read is the seam - one call for every key the workflow uses:
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get <key> ...`.
It layers repo (.planning/config.json) over the user-global file over the
schema defaults, so a raw file read sees at most one layer and lies about the
rest. Read only the keys you need. Unknown keys are ignored, never fatal.

## Seam arguments

- A flag declares a DISPOSITION, not merely a type: what the seam does when the
  value is wrong, chosen from exactly three words - refuse, warn, fall back. All
  three are positions this tree already holds, so a contract that made every
  typed flag refuse would reverse two of them. `issue-check.mjs` falls back to a
  constant on a malformed `--timeout-ms`, because that seam's whole contract is
  that it never fails a land; `route.mjs` warns on a `--phase` outside the
  accepted shape and still resolves, because refusing there would route the
  phase LOWER than its own risk baseline; the `--dir` family refuses.
- Falling back means the flag reads as ABSENT and the caller's own default
  answers. The token after it is never consulted, which is what stopped a
  valueless `--branch` from reading the following `--dir` as a branch name.
- The BARE form's disposition is declared SEPARATELY from the value's, in its
  own field, because one function body in `planning.mjs` already runs both
  side by side. In the body shared by `trace append` and `trace close`, a bare
  `--step`, `--reviewer`, `--trigger` or `--role` refuses, while a bare
  `--plan`, `--sha` or `--base` is dropped. One word for both axes would
  either start refusing every shipped close that omits `--plan`, or extend the
  drop to the refusals written against exactly the complete-looking event that
  defeats attribution: a bare `--role` wrote a record with no role key, and the
  renderer then aggregated it under the empty string. The two axes differ on
  ordinary flags too - `release-bump.mjs`'s `--version` refuses a blank value
  and falls back on a bare one.
- A new seam DECLARES its flags in `cadence-core/bin/lib/arg-contract.mjs`, one
  row per flag carrying all four fields (`required`, `type`, `value`, `bare`),
  rather than restating the rules in a parser of its own. That same table is
  what self-verify checks documented invocations against, so a flag with no row
  is a flag no prose may spell.
- The contract CLASSIFIES and the CALLER owns its own `reason` string, which is
  why one `--dir` rule surfaces under two names: `planning.mjs` reads the
  classification back and refuses with `bad-args`, the single refusal vocabulary
  that file publishes, while the seams that end in an `e.seam` catch arm raise
  it and refuse with `missing-flag-value`. The module mints no reason code of
  its own, so adopting it adds nothing to a seam's published list.
- The DECLARATION is what refuses. An adopting bin runs its resolved row at the
  door of its dispatch rather than restating the rule at each handler, and
  `cadence-core/bin/arg-contract-adoption.test.mjs` walks the whole table
  against the shipped binaries, so a row declaring a refusal nothing carries out
  reddens there. That census is what the gap needed: 98 rows were declared for
  one script and two of them were read, so a valueless flag wrote the boolean
  `true` into a cursor, a checklist's front-matter and a recorded UAT result.
- PRESENCE is the stated exception. The shared door judges only the flags a
  caller actually PASSED, and a flag that is genuinely ABSENT is answered by the
  bin that owns the wording, because the diagnostic for a missing enum-valued
  flag - which of three kinds a capture is, which of two modes a prune takes -
  is not expressible in a declaration. So `required` records a fact for the bins
  that choose to read it, never a rule the door enforces.
- The contract governs VALUE grammar only, and never refuses an UNDECLARED flag
  at runtime. Membership is the prose-side lint's job, so a flag missing from
  the table is caught where prose spells it rather than at a caller's expense.

## Caller-derived text

- The derivation test, asked once per value: is it derived from agent output or
  repository content, rather than authored by the workflow itself? If yes, it
  reaches the seam as a PATH - write it to a scratch file and pass
  `--<field>-file <path>` (or `-F <path>` at the one `git tag` site). A
  double-quoted shell word carrying `$(...)` or a backtick executes before Node
  starts, and a path cannot.
- If no, it stays inline: a slash command, an enum word, a template the workflow
  composed itself. The inline form also stays for a human typing at a shell,
  where the text is the user's own to begin with.
- No site decides this for itself. Every one is classified in
  `cadence-core/bin/lib/text-transport.mjs`, and self-verify reports a site the
  register does not classify - so a NEW site is registered, not argued.

## Bulk tool output

- The size test, asked once per tool call a prose site PRESCRIBES: does that
  call's own measured response cross 10,000 bytes? That figure is the mean
  `Read` response on this repository - 10,323 B over 780 recorded calls,
  `.planning/reads.jsonl`, measured 2026-08-17. If yes, then its output
  rides a file, not the transcript: redirect the call into a scratch path
  inside THIS RUN's own directory (`> "$D/<name>"`, where `D` is a directory
  this run made with `mktemp -d`) and hand the transcript a DIGEST of what the
  step actually needs. A response sitting in the transcript is re-paid on every
  later turn at the cache-read rate; a digest is paid once.
- The directory is made for the run and never given a shared name:
  `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")"`, and everything the step
  writes goes inside it. A fixed scratch filename is ONE file that two runs
  started in two repositories both write and both read, so one run's blocking
  gate is answered by the other's bytes. Leave the directory for the operating
  system's tmp reaping: a step that `rm -rf`s a path it computed itself is a
  worse failure than a stale directory. The template is explicit because the
  argument-less spelling of that call is GNU-only.
- The conversion is a shell redirect plus a targeted read-back - never a new
  seam, flag or subcommand. Read back only the fields the step prints or
  branches on, one at a time; reading the scratch file WHOLE is the same bytes
  on the same turn and buys nothing. The file is the model's own scratch, never
  a phase artifact.
- When the write and the read-back share ONE Bash invocation, chain both to the
  directory-making call with `&&`: the read-back then cannot run on a write that
  failed, and what it reads is a directory this run just created empty.
- When they are SPLIT across two fenced blocks, a shell variable cannot carry
  it - the Bash tool persists the working directory and not shell state. So the
  writing block ECHOES the directory once, and beside it a run TOKEN it also
  wrote into that directory; the later block carries both as literals, a path
  and never a `$(...)`, which is the caller-derived-text rule above. A carried
  path is the one arm where an EARLIER run's well-formed file still resolves, so
  the later block compares the directory's token file against the token it was
  handed and refuses when the two differ. Compare against an id carried
  independently of the file: an id read out of the file itself is one that any
  stale file answers self-consistently.
- A read-back REFUSES rather than answering from a file it could not trust. It
  names `scratch-unreadable` on stderr and exits non-zero when the file cannot
  be read or parsed, `scratch-shape` when the field the step needs is absent,
  and `scratch-stale` when the token does not match. No default may stand in for
  a missing value: `(r.outcomes||[]).length` answers `0` and
  `JSON.stringify({a:r.a})` prints `{}`, and both of those read as a successful
  answer. At a blocking gate a refusal is NEITHER verdict - the gate could not
  be evaluated, so it goes to that gate's STOP-and-ask arm.
- If no, the call stays inline: a response under the threshold, a form its own
  flags already bound (`--stat`, `--name-only`), a call another agent runs in
  its own context.
- No site decides this for itself. Every one is classified in
  `cadence-core/bin/lib/bulk-output.mjs` with its measured figure, and the
  per-run path and the read-back's refusal are held at every site by
  `cadence-core/bin/lib/scratch-path.mjs`; self-verify reports a site that
  either one leaves unclassified or unguarded - so a NEW site is registered,
  not argued.

## Parallel work

The coordinator walks a workflow's steps in order, but ordering the STEPS does
not mean serializing the CALLS inside them. When a step's inputs are known-path,
read-only, and mutually independent - several file Reads, a `git` probe, a seam
`get` whose result nothing else in the batch consumes - issue them as parallel
tool calls in ONE message. Serialize only a call that consumes a prior call's
output (a `git diff <a>..<b>` that needs hashes a SUMMARY read just produced, a
follow-up read whose path a first call computed). A numbered list in a workflow
is evaluation order, not a one-call-per-turn mandate.

The same holds for the ask-user seam: independent questions over an independent
set batch into `ceil(N/4)` AskUserQuestion calls (up to 4 questions per call),
not one blocking turn per item. Only questions whose wording depends on an
earlier answer stay sequential.

## State

- `STATE.md` is a 4-line cursor. It is overwritten in place, never appended.
  The only correct writer is the seam (`planning.mjs cursor set` - it derives
  name/total from ROADMAP, validates the status, stamps the date, and writes
  atomically); read it with `cursor get`. Never hand-edit the file. NO audit
  logs, no activity tables, no session narratives - git history is the log.
  Derive views from `git log` on demand.
- Canonical cursor schema - every writer emits exactly these four lines under a
  `# State` heading, in this order:

  ```
  Phase: <N> of <total> (<phase name>)
  Status: <lifecycle value>
  Next: <the one command to run next>
  Updated: <YYYY-MM-DD>
  ```

- Status lifecycle (the only permitted values, one per spine step):
  `ready to plan` (new-project) -> `context gathered` (context) -> `planned`
  (plan) -> `executed` (execute) -> `phase complete` (verify). `paused`
  (cad-pause) is allowed at any point. Do not invent other values.
- `paused` adds no extra lines: `Status: paused` with the `Next:` line holding
  cad-pause's one-line resume pointer. The cursor is always exactly these
  four lines - there is no fifth.
- `cad-progress` treats the cursor as a hint: if it disagrees with the derived
  state it rewrites it in this schema. Any skill that changes phase state
  overwrites the cursor and commits it with that step's docs commit - never
  leave it dirty.

## Subagents and reviews

- Spawn agents only through the spawn-agent seam (references/seams.md).
- Every second opinion goes through the review trigger interface
  (references/review-triggers.md). No skill embeds its own reviewer loop.

## Reporting style

- The "safe to /clear first" closer: when a command's durable output is on
  disk (and committed where config says so), its done-report says so in one
  line naming WHAT survives the clear. One line, per-command specifics, no
  ceremony.

- Terse completion reports: what changed, commit hash(es), files touched.
- No next-step menus unless the workflow genuinely forks. One suggestion max.

## Authoring style (for new workflows)

- Structure: `<purpose>`, `<process>` with named `<step>`s, `<guardrails>`,
  `<success_criteria>`. Match the tone and density of workflows/task.md.
- No multi-runtime branches, no CC-bug-number workaround prose, no ASCII
  banner variants. Plain instructions.
