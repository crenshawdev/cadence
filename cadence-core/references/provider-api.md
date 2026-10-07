# Provider API wire reference

The exact request/response shapes `bin/review-provider.mjs` depends on, verified
against the live provider docs (2026-07-10). This is the maintained artifact: if
a provider changes its API, update the adapter in the script AND this file
together. The script isolates every provider-specific byte in its `ADAPTERS`
object so a change touches one place.

One section is read at runtime: `## Codex executor mode`, which a `cad-executor`
dispatch reads when its prompt carries the Codex-mode line and holds for the
whole dispatch. Nothing else in this file is read by an agent, so an edit there
changes what every Codex-mode run does.

Model ID strings are deliberately NOT pinned here - they are discovered live via
`detect-models` (see `model-hints.json` for soft tier classification). Anything a
provider ships is selectable even if Cadence has never heard of it.

## OpenAI (Responses API)

- Host `https://api.openai.com`. Auth `Authorization: Bearer $OPENAI_API_KEY`.
- **Review:** `POST /v1/responses`.
  - `input`: array of `{role, content}` messages (system instruction + user artifact).
  - Structured output: `text.format = {type:"json_schema", name, strict:true, schema}`.
    NOTE: no nested `json_schema` object (that is the older Chat Completions shape).
    strict mode requires every object to carry `additionalProperties:false` and
    list all properties in `required`.
  - Effort: `reasoning.effort` in `none|minimal|low|medium|high|xhigh` (newest
    models also accept `max`; the supported set is model-dependent). Cadence's
    config enums cap at `high` - the levels above it are documented for
    completeness, not configurable.
  - Output text: `output_text`, or the `output[]` message item's
    `content[].text` where `type == "output_text"`. The adapter reads both.
  - Usage (checked 2026-09-01): `usage.input_tokens`, `usage.output_tokens`,
    `usage.total_tokens`, with `usage.input_tokens_details.cached_tokens` and
    `usage.output_tokens_details.reasoning_tokens` as BREAKDOWNS - `output_tokens`
    already includes the reasoning tokens. `extractUsage` reads `input_tokens`
    and `output_tokens`.
- **Detect:** `GET /v1/models` -> `{data:[{id, ...}]}`. IDs live in `data[].id`.

## OpenAI through `codex exec` (review only)

Used when `review.providers.openai.transport` is `codex`. Checked against
codex-cli 0.160.1 on a ChatGPT login, 2026-10-07. No key is read; `consult` and
`detect-models` stay on the Responses API above.

- **Argv:** `codex exec -C <empty temp dir> --skip-git-repo-check -s read-only
  --ephemeral`, `--disable <feature>` for every tool-giving feature in
  `CODEX_DISABLED_FEATURES`, `-c web_search=disabled`,
  `-c project_root_markers=[]`, `--output-schema <file>`, `-o <file>`,
  `--json`, `-m <model>`, and `-c model_reasoning_effort=<effort>` only when an
  effort was given (`minimal` sent as `low`). `--disable shell_tool` alone left
  `exec_command` and web search reachable; `unified_exec` and the `web_search`
  setting close them. An unknown feature name exits 1. Codex reads every
  AGENTS.md from its cwd up to the nearest `.git` marker, so a `.git` above the
  temp dir would load that tree's AGENTS.md into the prompt;
  `project_root_markers=[]` makes the work dir its own root. `codex debug
  prompt-input` (no model call) showed a planted ancestor AGENTS.md without it
  and not with it, while CODEX_HOME's AGENTS.md loaded both times.
- **Environment:** the parent's, minus `OPENAI_API_KEY`, `CODEX_API_KEY` and
  `CODEX_ACCESS_TOKEN`, the three auth variables codex-cli 0.160.1 reads. The
  last overrides the stored login, so all three go and the run uses whatever
  `codex login` stored.
- **Prompt:** on stdin, one prompt - the instruction, then the artifact between
  BEGIN and END marker lines carrying a random tag minted per call, so an
  artifact holding a plain END line cannot close its own block. Nothing from the payload is on argv (spawn fails
  with E2BIG past 131,072 argument bytes, and a `-c` value is parsed as TOML).
- **Schema:** `--output-schema` names a file holding `FINDING_SCHEMA` unchanged.
  Whether Codex enforces it or only requests it is unmeasured beyond one probe
  that returned the exact shape, so `validateFindings` is the guarantee.
- **Answer:** `-o` holds the final message. Success exits 0 with that file
  written; a failed turn exits 1 and writes no `-o` file, and under `--json` its
  error arrives on stdout as `turn.failed`. A model the login does not serve
  fails that way with a 400 that names it.
- **Usage:** the `usage` object of `turn.completed` on the `--json` stdout, with
  keys `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`,
  `output_tokens` and `reasoning_output_tokens`. The pair read is
  `input_tokens` and `output_tokens`; whether `output_tokens` includes
  `reasoning_output_tokens` is unmeasured, so the whole object rides as
  `usage_raw`. Codex's harness adds roughly 13,000 to 15,000 input tokens per
  call, mostly cached on repeat (14,708 cold, 12,881 with 10,752 cached). That
  is plan usage, not API spend.
- **Rate limits:** concurrent panel calls share one Codex plan and may hit its
  limits. A limited call exits non-zero and is recorded as a review that did not
  run (`codex-exit`).

## Codex executor mode

Read by the `cad-executor` wrapper when its dispatch prompt carries the
Codex-mode line, before task 1, and held for the whole dispatch the way
`<worktree_mode>` is. Every contract rule still binds except where this section
replaces one. `codex exec` builds each task; you check it, commit it and report.

**You never write or edit a source file yourself.** Your only writes are the
report file the contract names and scratch files in a directory you made with
`mktemp -d`, outside the repository. A Codex run replaces the contract's
`<process>` step 1 ("Implement the task's change"). Running the subcommand below
is this dispatch's own instruction, not an agent spawn or a review the
contract's `<never>` forbids. Never call `codex` any other way.

Make the scratch directory once per dispatch and carry the echoed path as a
literal into later commands; the guard refuses a path a literal cannot survive:

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-codex-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "scratch dir: $D"
```

### Before the first Codex run

A path the plan declares that already differs from HEAD (`git status
--porcelain=v1 --untracked-files=all` lists it) stops the plan `blocked`, naming
the path: Codex never builds on uncommitted work nobody can attribute. The one
exception is a continuation whose report names that task as this plan's own
unfinished one.

### Per task, in order

1. **Before-state.** Record `git status --porcelain=v1 -z --untracked-files=all`
   (tracked and untracked; ignored paths are not listed) and a `git hash-object`
   of every listed path that exists, into `$D`. Record the refs there too, before
   this and every other Codex run in the dispatch:
   `git rev-parse --symbolic-full-name HEAD; git rev-parse HEAD; git for-each-ref --format='%(objectname) %(refname)'`.
2. **Build prompt.** Write it to `$D/prompt-<k>.md`. Every path in it is
   absolute: whether `CLAUDE_PLUGIN_ROOT` and `PATH` reach Codex's commands is
   unmeasured. Its sections, in this order:
   - **Where you are.** The repository path, the current branch, and that this
     is task k of `<plan file>` in phase N. No other agent works in this tree
     during the run.
   - **The whole plan.** The plan's Goal, Must be true when done, Context and
     every task, verbatim, with task k marked as the one to build; the phase
     CONTEXT's decisions; and the project `CLAUDE.md` content your dispatch
     prompt names, since Codex loads `AGENTS.md` itself and never `CLAUDE.md`.
     For a `/cad-task` plan, its files, action and verification.
   - **Read before coding.** The project's rules file (`AGENTS.md` or
     `CLAUDE.md`) first; its rules bind everything Codex does. Then every
     document and source file the plan names for task k.
   - **Build exactly what the plan says.** Where it leaves a small choice open,
     make the simplest choice that fits and report it rather than stopping.
   - **Keep existing behaviour.** Existing tests change only where the plan says
     so, and then still assert what they asserted.
   - **Docs move with the code.** A doc task k touches matches the code when it
     finishes: line references re-derived, drift in the touched sections fixed
     and reported. Written for an engineer who has never seen the project, with
     no conversation quotes and no ruling or finding labels.
   - **No new dependency** unless the plan names it. A lockfile changing beyond
     what the plan names is a stop, reported.
   - **Test hygiene.** No test starts a real program it does not own, reads a
     real home directory, environment variable or config folder, reads a live
     clock, or uses the network, unless the plan says so.
   - **Scope.** Change only task k's declared Files. A change needed outside them
     is a stop: say so in the final message rather than making it.
   - **Git.** Read-only git only: `status`, `diff`, `log`, `show`. Never `add`,
     `commit`, `stash`, `branch`, `checkout`, `switch`, `reset`, `rebase`,
     `merge`, `tag` or `push`, and never git config or remotes. The executor
     checks the work, then stages and commits it. Under the default sandbox
     `.git` is read-only as well. Either way the executor compares every git
     ref before and after the run, and a moved ref stops the task.
   - **Checks.** Run task k's Verify commands that need no network. A failing
     check, a compile error or a quoting mistake is work to fix, not a reason to
     stop. Stop only when the task cannot be built as written without leaving
     its scope.
   - **Tests.** Only when your dispatch prompt carries the test-evidence block
     (`<test_evidence>`); without it the prompt says nothing here, so a Codex
     prompt with the switch off is what it was. With it, this section carries:
     the evidence-map checks whose Task cell is k, and task k's labelled
     `## Tests` tables, copied from the plan; that block's red-first,
     red-under-Break and negative-control instructions, verbatim; and a request
     to report, in the final message, each red run's failing line and whether
     it ran before the behaviour or under the Break, and each control's break,
     failing line and restore.
   - **What to return.** A final message listing each file changed and why;
     each Verify command run, with its exact last output line; each choice the
     task left open and what was chosen; each new test and the defect it
     catches, and any negative control run; hand checks run, with their output;
     anything that could not be tested, and why; doc drift fixed; anything that
     looks wrong in the plan or the design; anything that stopped the work.
3. **Run Codex**, with an explicit Bash timeout of 600000:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" codex-exec < "$D/prompt-<k>.md"`.
   The host's 120000 default would kill it first and print nothing. It runs in
   the repository root, in the sandbox `roles.cad-executor.codex.sandbox`
   names: `workspace-write`, unless the user-global config says
   `danger-full-access`, which runs Codex unsandboxed. It prints one JSON line;
   `ok:true` carries Codex's final message as `message`.
4. **Refs and changed paths.** Take the refs again as in step 1; any line that
   differs is a stop. Take the after-state as in step 1. The changed paths are
   every porcelain path whose entry or content hash differs between the two,
   including one already dirty before the run that Codex edited again. Never
   count your own report and scratch files, or the files Cadence's hooks write
   (`.planning/reads.jsonl`, `.planning/trace.jsonl`, `.planning/reads.1.jsonl`,
   `.planning/trace.1.jsonl`), even where a project does not ignore them.
   Ignored paths are not policed, by design: the hooks and every build and test
   run write there. Under `workspace-write` the sandbox keeps every write
   inside the repository and temp folders, with `.git` read-only; under
   `danger-full-access` nothing outside the repository is checked. A changed path under `.planning/` that is
   not in the task's Files does not block, because Cadence and other sessions
   write there while Codex runs (an advisory diff review's findings file, a
   planner's PLAN); list each in the task's Note and never stage it. Every
   other changed path must equal a path in the task's Files or lie under one
   that names a directory.
5. **Verify**, per the contract's step 2, prediction first, in your own shell
   outside the sandbox. A check needing the network runs here.
6. **Static analysis**, per the contract's step 3.
7. **Commit.** After Verify passes, stage one by one every declared path of the
   task that differs from HEAD, whether or not this run's diff saw it, so a
   re-edited dirty file is committed rather than left behind. Run
   `lease-check` per the commit protocol (skipped for a `/cad-task` plandir, as
   the contract says), commit with the dispatch's scope, and do the post-commit
   glance. A task with no declared path differing from HEAD and a passing
   Verify commits nothing, and its row says so; HEAD not moving is never read as
   done for a task whose Verify depends on uncommitted bytes.
8. **Report.** Rewrite the report per `<report_file>`, copying the relevant
   lines of Codex's final message into the task's Note. With the test-evidence
   block present, also write task k's `Test evidence:` rows, the rows copied
   forward kept:
   - **Red by** is `before` or `break`, as Codex's final message reports the
     red run.
   - **Red at** is `git rev-parse --short HEAD` as it stood when step 1's
     before-state was taken: Codex commits nothing, so its red run ran on that
     HEAD.
   - The failing lines, breaks and restores are copied from Codex's final
     message, the control rows of task k's checks that have a test file
     included.
   - Each **Passing line** comes from your own step-5 run of the check's
     Command.
   - A run Codex did not report gets no row, and the gap reaches the report
     check as missing evidence. You still write no source file and run no
     control yourself.

### Suite, continuations and trace

After the last task, run the suite once as the contract states; green writes
`PLAN COMPLETE`. A continuation skips the tasks its report names as committed.

A continuation whose prompt carries a `test-evidence` rejection as its
checkpoint outcome also runs one evidence-only `codex exec` for each committed
task with missing rows, as that outcome's detail names them (each entry carries
`(Task <n>)`), and for no other task:
- Its prompt keeps step 2's sections up to **Scope**. Its **Tests** section asks
  only for the missing runs: for each, apply the Break, run, keep the failing
  line, and restore. It asks for no other change.
- After it, confirm no ref moved, as in step 4, and every declared path of
  that task is back at HEAD: `git status --porcelain=v1 --untracked-files=all`
  lists none of them.
- Then run each check's Command, or the test's command, yourself for the passing
  line, and write the rows, a check's with `Red by: break` and **Red at** the
  HEAD the run started on.
- This is the one Codex run that task gets in this dispatch, so `### Failures`'
  rule against re-running Codex on a task within a dispatch still holds.
You write no trace event: the bracket around this dispatch is the
orchestrator's.

### The fix pass

A `risk_surface` fix pass is one Codex run. Its Files are the plan's declared
`files:` lease, which the orchestrator amends before dispatch; its Action is the
dispatch's fix instruction with the blocker and high findings from the findings
file it names; its Verify is the suite run. Its row is appended to the existing
report, as that dispatch says.

### Failures

Each of these returns the contract's existing `CHECKPOINT: blocked`, and nothing
else does: the subcommand's `no-codex`, `codex-exit`, `codex-timeout` or
`no-output`; a changed path outside the task's files; a dirty declared path
before the first run; a failing Verify; failing static analysis; a `lease-check`
refusal; a red suite after the last task; a declared path not back at HEAD
after an evidence-only run, named in `Need`; a git ref that moved across any
Codex run, named in `Need` with its before and after lines. There is no other return arm, and
none labelled timeout. On each:

- Write the report first, its first line `PLAN CHECKPOINT: blocked`, with the
  rows completed so far.
- Return the five-field digest plus `CHECKPOINT: blocked`, `Current task` and
  `Need`.
- `Need` names the cause: the subcommand's `reason` and `detail`, the offending
  paths, or the failing command and where its output was written. For
  `codex-timeout` it says the remedy is a smaller task. It lists the
  uncommitted changes Codex left, which stay as Codex left them: you never
  revert or edit them, so `git status` shows no source change of yours.

There is no repair attempt in Codex mode. The contract's three-attempt loop and
the suite's one repair round both need an edit you may not make, and a second
`codex exec` for a task that gets one. The first failure stops the dispatch, and
the human decides. Never implement the task yourself, retry with another sandbox,
another flag or a direct `codex` call, re-run Codex on the same task within the
dispatch, report success, or ask for a Claude rung in Codex's place.

## Gemini (Generative Language API, generateContent)

- Host `https://generativelanguage.googleapis.com`. Auth header
  `x-goog-api-key: $GEMINI_API_KEY` (preferred over the `?key=` query param so the
  key stays out of URLs/logs).
- **Review:** `POST /v1beta/models/{model}:generateContent` (model id is in the path).
  - `systemInstruction.parts[].text` + `contents[].parts[].text`.
  - Structured output: `generationConfig.responseMimeType = "application/json"` +
    `generationConfig.responseSchema` (an OpenAPI-3.0 subset - it REJECTS
    `additionalProperties`, which the script strips for Gemini only).
  - Effort (Gemini 3.x): `generationConfig.thinkingConfig.thinkingLevel` in
    `minimal|low|medium|high`. (Gemini 2.5 uses a numeric `thinkingBudget` instead;
    the effort dial targets current 3.x reviewers.)
  - Output text: `candidates[0].content.parts[].text`.
  - Usage (checked 2026-09-01): `usageMetadata`, NOT `usage` - fields
    `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`,
    `totalTokenCount`, `cachedContentTokenCount`. `candidatesTokenCount`
    EXCLUDES thinking tokens where OpenAI and DeepSeek fold theirs in, so
    `extractUsage` reads `promptTokenCount` and
    `candidatesTokenCount + thoughtsTokenCount` to keep the pair comparable.
- **Detect:** `GET /v1beta/models` -> `{models:[{name:"models/<id>", supportedGenerationMethods:[...]}]}`.
  The adapter keeps entries whose `supportedGenerationMethods` include
  `generateContent` OR that omit the field entirely (absence is not evidence
  of inability), and strips the `models/` prefix.

## DeepSeek (Chat Completions API)

- Host `https://api.deepseek.com`. Auth `Authorization: Bearer $DEEPSEEK_API_KEY`.
- OpenAI-compatible, but the **Chat Completions** shape (`choices[].message`), NOT
  the Responses API the openai adapter uses - so it is its own adapter, not a
  base-URL swap.
- **Review:** `POST /chat/completions`.
  - `messages`: array of `{role, content}` (system instruction + user artifact).
  - Structured output: `response_format = {type:"json_object"}` (JSON mode).
    DeepSeek has NO server-side `json_schema` enforcement, so the adapter injects
    the BARE finding schema (the object to produce, not a `{name, schema}`
    wrapper) into the system prompt, and the shape is asserted on return by
    `validateFindings`/`validateConsult` (the same guard every adapter passes).
    json_object mode also requires the word "json" in the prompt, which the
    injected schema instruction supplies.
  - Effort: `reasoning_effort` (`low|medium|high`) - a first-class Chat
    Completions param, honored by thinking models (`deepseek-v4-pro`, the
    `deepseek-v4-flash` thinking mode) and ignored by non-thinking ones. The
    shared config effort enum also allows `minimal`, which DeepSeek rejects, so
    the adapter clamps `minimal` up to `low`.
  - Output text: `choices[0].message.content`.
  - Usage (checked 2026-09-01): `usage.prompt_tokens`, `usage.completion_tokens`,
    `usage.total_tokens`, plus `prompt_cache_hit_tokens`,
    `prompt_cache_miss_tokens` and `completion_tokens_details.reasoning_tokens`;
    `completion_tokens` already includes the reasoning tokens. `extractUsage`
    reads `prompt_tokens` and `completion_tokens`.
- **Detect:** `GET /models` -> `{data:[{id, ...}]}`. IDs live in `data[].id`.
- Model ids as of 2026-07: `deepseek-v4-pro`, `deepseek-v4-flash` (the legacy
  `deepseek-chat`/`deepseek-reasoner` names retire 2026-07-24). Discovered live
  via `detect-models`; `model-hints.json` soft-classifies them.

## Notes on record

- Both providers now promote newer wrapper APIs (OpenAI has always-Responses;
  Gemini tags generateContent "Legacy" and promotes an Interactions API). The
  paths above are current and fully supported; revisit if a provider deprecates them.
- The finding schema (`file, line, severity, claim, failure_scenario`) is defined
  once in the script (`FINDING_SCHEMA`) and sent to every provider in its own
  dialect - OpenAI strict `json_schema`, Gemini `responseSchema`, DeepSeek as an
  in-prompt schema under json_object mode. Keep the shape we assert on return in
  sync with the shape we send.
- **Constraint keywords that ride the wire** (checked 2026-08-17). The schema
  carries `minimum`, `minLength`, `maxLength` and `maxItems`; all four are
  supported on every shipped provider and are sent unchanged.
  - OpenAI structured outputs: supported on BASE models, which are the only
    models Cadence dispatches (fine-tuned models carry extra restrictions). The
    UNSUPPORTED set is the composition keywords plus, for objects,
    `unevaluatedProperties` / `propertyNames` / `minProperties` /
    `maxProperties`, and for arrays `unevaluatedItems` / `contains` /
    `minContains` / `maxContains` / `uniqueItems`. Do not add one of those to
    `FINDING_SCHEMA` - strict mode 400s on it.
  - Gemini `responseSchema` documents `minimum` / `maximum` and `minItems` /
    `maxItems` explicitly for its OpenAPI subset. `additionalProperties` remains
    the one key the adapter strips, and only for Gemini.
  - DeepSeek enforces NOTHING server-side (json_object mode has no schema), so
    the keywords are advisory prose in the system prompt there. That is what
    makes LOCAL validation the guarantee everywhere regardless: `validateFindings`
    mirrors every constraint in this schema, and a test runs both sides against
    the same fixtures.
