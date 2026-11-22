# Cadence conventions

Loaded on demand, never preloaded: a skill or workflow cites it by path where a
rule applies. Nothing here reaches an agent that has not read it.

## Paths

- Engine: `${CLAUDE_PLUGIN_ROOT}/cadence-core/`, resolved by the Claude Code
  plugin runtime. No host probing, no locator shim. Skills @-include workflows
  from here.
- Project state: `.planning/` in the repo root, in the SAME git repo as the
  code it plans (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md,
  phases/<N>/{PLAN,SUMMARY,UAT}.md). A phase whose code lives in a different
  repo is NOT a supported mode; driving a separate code repo is the steerer's
  job, and execute.md only warns when it detects the split.
- Phase directory: `.planning/phases/<N>/`. The grammar for `<N>`, and the
  guarantee that no spelling is ever silently redirected to a DIFFERENT phase's
  directory, are stated in `references/roadmap-phases.md` and nowhere else.
- Records folder: `.planning/records/` and `.planning/phases/<N>/records/` hold
  what scripts and gates keep - the run and read records, the ledgers, the
  carried queues and the code map at the top; executor reports, review,
  adjudication and deferred files and findings in a phase. What a person reads
  stays at the top of `.planning/` and of each phase.
- State file: `.planning/records/state.json` holds phase, plan and requirement
  status, the cursor and whether a cycle is open, and only scripts write it.
  The ROADMAP `## Phases` list, the REQUIREMENTS `## Traceability` table and
  `STATE.md` are generated from it and never edited by hand. A seam refusing
  because the file does not parse is answered by running `/cad-progress`, never
  by repairing the file.

## Deliberate shortcuts

A corner cut on purpose is marked at the line it was cut, in the file's own
comment syntax, on ONE line. The marker is the token `CADENCE-DEBT` followed
immediately by a colon, then three fields in order, separated by ` | `:

1. the one-line description of what was cut;
2. `ceiling` and a colon, then what it does not handle;
3. `trigger` and a colon, then what should prompt revisiting it.

Both named fields are REQUIRED; the harvest names a marker missing one rather
than dropping it.

`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" debt-harvest --root .`
collects every marker in the tracked tree into `.planning/CAPTURE.md`'s own
`## Debt markers` section, rewritten wholesale on each run. The marker in
tracked code is the durable record, so deleting it from source removes its
bullet on the next run. That section is outside the recall walk: a harvested
marker reaches `/cad-plan`'s recall only when promoted by hand.

A hand-maintained CENSUS - a count a human wrote down that the code has to keep
true - is marked the same way, on ONE line at the site that asserts it. The
marker is the token `CADENCE-CENSUS` followed immediately by a colon, then the
id of its row in `cadence-core/bin/lib/census-registry.mjs`, then ` | `, then
`asserts` and a colon, then one line naming what the assertion pins. A marker
missing its id or its `asserts` clause is named as malformed rather than
dropped. A marked site whose id NO registry row names reddens the suite, so the
row is added in the commit that plants the marker. Everything else about
censuses is in `census-registry.mjs`.

Documentation about either token describes the fields in prose, as this section
does, and never writes a literal marker line: one would be a real marker.

## Config resolution

The only correct read is the seam - one call for every key the workflow uses:
`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get <key> ...`.
It layers repo (.planning/config.json) over the user-global file over the
schema defaults, so a raw file read sees at most one layer. Read only the keys
you need. Unknown keys are ignored, never fatal.

## Caller-derived text

- The derivation test, asked once per value: is it derived from agent output or
  repository content, rather than authored by the workflow itself? If yes, it
  reaches the seam as a PATH - write it to a scratch file and pass
  `--<field>-file <path>` (or `-F <path>` at the one `git tag` site). A
  double-quoted shell word carrying `$(...)` or a backtick executes before Node
  starts, and a path cannot.
- If no, it stays inline: a slash command, an enum word, a template the workflow
  composed itself, or a human typing at a shell.
- No site decides this for itself. Every one is classified in
  `cadence-core/bin/lib/text-transport.mjs`, and self-verify reports a site the
  register does not classify - so a NEW site is registered, not argued.

## Bulk tool output

- The size test, asked once per tool call a prose site PRESCRIBES: does that
  call's own measured response cross 10,000 bytes? If yes, then its output
  rides a file, not the transcript: redirect the call into a scratch path
  inside THIS RUN's own directory (`> "$D/<name>"`, where `D` is a directory
  this run made with `mktemp -d`) and hand the transcript a DIGEST of what the
  step actually needs.
- The directory is made for the run with this template, never a shared name:
  `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")"`, and everything the step
  writes goes inside it. The argument-less spelling is GNU-only. Leave the
  directory for the operating system's tmp reaping; never `rm -rf` a path the
  step computed.
- The conversion is a shell redirect plus a targeted read-back - never a new
  seam, flag or subcommand. Read back only the fields the step prints or
  branches on, one at a time, never the scratch file WHOLE. The file is the
  model's own scratch, never a phase artifact.
- When the write and the read-back share ONE Bash invocation, chain both to the
  directory-making call with `&&`, so the read-back never runs on a failed
  write.
- When they are SPLIT across two fenced blocks, a shell variable cannot carry
  it - the Bash tool persists the working directory and not shell state. So the
  writing block ECHOES the directory once, and beside it a run TOKEN it also
  wrote into that directory; the later block carries both as literals, a path
  and never a `$(...)`, per Caller-derived text above. The later block compares
  the directory's token file against the token it was handed and refuses when
  they differ, since an earlier run's well-formed file still resolves. Compare
  against an id carried independently of the file, never one read out of it.
- A read-back REFUSES rather than answering from a file it could not trust. It
  names `scratch-unreadable` on stderr and exits non-zero when the file cannot
  be read or parsed, `scratch-shape` when the field the step needs is absent,
  and `scratch-stale` when the token does not match. No default may stand in for
  a missing value: `(r.outcomes||[]).length` answers `0` and
  `JSON.stringify({a:r.a})` prints `{}`, and both read as an answer. At a
  blocking gate a refusal is NEITHER verdict: it goes to that gate's
  STOP-and-ask arm.
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

Ordering a workflow's STEPS does not serialize the CALLS inside them. When a
step's inputs are known-path, read-only, and mutually independent - several
file Reads, a `git` probe, a seam `get` whose result nothing else in the batch
consumes - issue them as parallel tool calls in ONE message. Serialize only a
call that consumes a prior call's output (a `git diff <a>..<b>` that needs
hashes a SUMMARY read just produced, a follow-up read whose path a first call
computed). A numbered list in a workflow is evaluation order, not a
one-call-per-turn mandate.

## State

- `STATE.md` is a cursor of four required lines plus an optional `Plan:` line,
  overwritten in place, never appended. The only writer is the seam
  (`planning.mjs cursor set` - it derives name/total from the state file,
  validates the status, stamps the date, and writes atomically); read it with
  `cursor get`. Never hand-edit the file. No audit logs, activity tables or
  session narratives - git history is the log.
- Canonical cursor schema - every writer emits these four required lines and
  the optional `Plan:` line under a `# State` heading, in this order:

  ```
  Phase: <N> of <total> (<phase name>)
  Plan: <K> of <J> (<plan name>)      (optional)
  Status: <lifecycle value>
  Next: <the one command to run next>
  Updated: <YYYY-MM-DD>
  ```

  With no cycle open there is no `Phase:` or `Status:` line: under `# State`, a
  sentence saying no cycle is open, then `Next:` and `Updated:`.

- The `Plan:` line: `cursor set` writes it from disk on every write, with no
  flag. K is the lowest-numbered plan whose report is not `PLAN COMPLETE`, by its
  file number (PLAN-<k>.md is k, a bare PLAN.md is 1). J is the phase's
  plan-file count, and the name comes from the plan's heading; the line reads
  `Plan: K of J` when the heading has no name. It is absent when the phase has no
  plan files or every plan is complete, so `executed` and `phase complete`
  cursors are four lines. It is never folded into `Phase:`, `Status:` or `Next:`.
- Status lifecycle (the only permitted values, one per spine step):
  `ready to plan` (new-project) -> `context gathered` (context) -> `planned`
  (plan) -> `executed` (execute) -> `phase complete` (verify). `paused`
  (cad-pause) is allowed at any point. Do not invent other values.
- `paused` adds no line: `Status: paused`, with `Next:` holding cad-pause's
  one-line resume pointer.
- `cad-progress` treats the cursor as a hint: if it disagrees with the derived
  state it rewrites it in this schema. Any skill that changes phase state
  overwrites the cursor and commits it, with `.planning/records/state.json`, in
  that step's docs commit - never leave either dirty. /cad-execute's per-plan and
  per-batch rewrites ride its `state` step's docs commit.

## Subagents and reviews

- Host-runtime specifics live in the three portability seams and nowhere else:
  `references/seams.md` is the router that names them and the one file each
  call Reads. No workflow or skill inlines a host-specific alternative beside
  a seam's binding.
- Spawn agents only through the spawn-agent seam
  (references/seam-spawn-agent.md).
- Every second opinion goes through the review trigger interface
  (references/review-triggers.md). No skill embeds its own reviewer loop.

## Reporting style

- The "safe to /clear first" closer: when a command's durable output is on
  disk (and committed where config says so), its done-report says so in one
  line naming WHAT survives the clear.
- Terse completion reports: what changed, commit hash(es), files touched.
- No next-step menus unless the workflow genuinely forks. One suggestion max.
