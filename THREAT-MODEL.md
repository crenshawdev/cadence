# Threat model: Cadence

Version or commit this describes: v3.9.0, commit `f50587ba`
Last reviewed: 2026-10-17

Cadence is a Claude Code plugin with two halves. The first is prose: the skills in `skills/`, the workflows and references in `cadence-core/`, and the agent definitions in `agents/`, which the model follows. The second is code: zero-dependency Node scripts in `cadence-core/bin/` that the model runs through its Bash tool (the seams), plus three hooks registered in `hooks/hooks.json`. The scripts do the deterministic parts and the model does the rest, with whatever tools the skill grants it. So most of what Cadence does is the model acting on its prose, and this file covers both what the code does and what the prose tells the model to do.

## What this tool reads

Files and directories:

- The project tree the session runs in: source, tests and manifests. `detect-commands` reads manifests one directory deep only (`package.json`, `pyproject.toml`, ESLint flat configs, `go.mod` and the like) and never walks into nested packages.
- `<project>/.planning/`: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `CAPTURE.md`, `DECLINED.md`, `phases/<N>/` (`PLAN.md`, `CONTEXT.md`, `SUMMARY.md`, `UAT.md`), `trace.jsonl` and `reads.jsonl` with their rotated `.1` generations.
- The project's git data, through `git log`, `rev-list`, `cat-file --batch-check`, `diff`, `ls-files`, `status`, `merge-base` and `remote get-url`.
- The user-global config: `~/.claude/cadence/config.json`, or the file `$CADENCE_GLOBAL_CONFIG` names.
- The provider key file, only during a provider call: `${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env`, or the file `review.key_file` names in the user-global layer.
- Claude Code settings, to learn `worktree.baseRef` before parallel worktree runs (`bin/worktree-base.mjs`): `<root>/.claude/settings.local.json`, `<root>/.claude/settings.json`, `~/.claude/settings.json` (or `$CADENCE_USER_SETTINGS`) and the platform's `managed-settings.json` (or `$CADENCE_MANAGED_SETTINGS`).
- A stopped subagent's own transcript, `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`, at the path the SubagentStop payload gives in `agent_transcript_path`. `subagent-trace.mjs` never falls back to `transcript_path` and refuses a file over 8 MiB.
- The plugin's own files under `${CLAUDE_PLUGIN_ROOT}`: `cadence-core/config.schema.json`, `.claude-plugin/plugin.json`, references and templates.

Environment variables: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `XDG_CONFIG_HOME`, `PATH`, `PATHEXT`, `GIT_DIR`, `GIT_WORK_TREE`, and the overrides `CADENCE_GLOBAL_CONFIG`, `CADENCE_USER_SETTINGS`, `CADENCE_MANAGED_SETTINGS`, `CADENCE_CONFIG_SCHEMA`, `CADENCE_PLUGIN_MANIFEST`, `CADENCE_TEST_SEAM`, `CADENCE_DETECT_REACHABLE` and `CADENCE_DEFERRED_READS`.

Streams and arguments:

- Each hook reads the hook JSON on stdin: `cwd`, `tool_input.command`, the tool response, and for SubagentStop `agent_transcript_path`.
- Each seam reads its CLI arguments, checked against its row in `lib/arg-contract.mjs`. Free text goes in a payload file, or stdin for `review-provider.mjs --payload -`, and never in an inline flag.

Network reads:

- Responses from `https://api.openai.com`, `https://generativelanguage.googleapis.com` and `https://api.deepseek.com`, in `bin/review-provider.mjs` only.
- Output from the user's own `gh`, `glab` and `tea`: the title-scoped issue lookup before filing, issue state at land time, and `tea login list` on the Forgejo arm.

Other users, projects and tools: nothing owned by another user. Transcripts under `~/.claude/projects` belong to the same user but are Claude Code's files, and only the stopped worker's own file is read. The user-global config applies to every repository on the machine.

## What it writes

Inside the project:

- `.planning/`: every planning document, `config.json`, `CAPTURE.md`, `DECLINED.md`, `trace.jsonl` (1 MiB cap, rotated to `trace.1.jsonl`), `reads.jsonl` (8 MiB cap, rotated to `reads.1.jsonl`) and the claim and temp files their rotations use. Whole-file writes go through `atomicWrite` (temp file plus rename) and records through `appendFileSync`. The trace and reads writers `lstat` first and refuse a symlinked target.
- Source and tests, edited by executor agents with one commit per task.
- `.gitignore`: `/cad-new-project` and `/cad-adopt` append `.planning/trace.jsonl` if it is absent. [VERIFY whether `reads.jsonl` is also kept out of git in a user's repository.]
- Git: commits, branches, `git mv` and `git rm` during phase renumbering, reverts from `/cad-undo`, deletion of merged local branches (`git-publish.mjs reap`, `land-cleanup`), and a tag at `/cad-land` when the user picks that arm.

Outside the project:

- `~/.claude/cadence/config.json` (or `$CADENCE_GLOBAL_CONFIG`), written by `config.mjs set --global` and the setup interviews.
- `CAPTURE.md` beside that config, from `/cad-capture --cadence`.
- The `worktree.baseRef` key, merged into `.claude/settings.json` or `~/.claude/settings.json`, only after the user picks the file at `/cad-config`.
- Scratch directories from `mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX"`.
- Git worktrees for parallel executors, through Claude Code's worktree isolation. [VERIFY where they are created.]

On the forge, through the user's own CLI: `repo create --private` once at `/cad-new-project`, `issue create` for a review finding the user accepted, and PR or MR create and merge at `/cad-land`.

File modes: no script sets one. Every file Cadence creates gets the process umask, which is `0644` under the usual `022`, and that includes the user-global config and everything under `.planning/`. Cadence never creates `providers.env`, and it never checks that file's mode, even though the header of `review-provider.mjs` calls it a 600-perm file.

Output:

- Every seam prints exactly one JSON line on stdout (`lib/seam-io.mjs`), and the model reads it, so it lands in Claude Code's context and goes wherever the session goes.
- `forge.mjs`, `issue-filing.mjs` and `issue-check.mjs` discard their children's stderr at the spawn and never put a byte of a child's output on their envelope.
- `git-guard.mjs` prints one permission-decision object, which Claude Code reads.
- `read-trace.mjs` and `subagent-trace.mjs` print nothing on any stream and always exit 0.

## What it executes

Programs started by the scripts. Every one goes through `execFileSync` or `spawnSync` with an argv array and is found on `PATH`. No script uses `shell: true` or `execSync`.

- `git`, from many seams.
- `gh`, `glab` and `tea`, from `forge.mjs`, `issue-filing.mjs` and `issue-check.mjs`, after `lib/on-path.mjs` confirms the name resolves.
- `node` (`process.execPath`), from `test.mjs`.

Programs the prose tells the model to run through Bash:

- The seams themselves, as `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/<seam>.mjs" ...`.
- `workflow.test_command` and `workflow.lint_command`, honoured from the user-global layer only.
- Detected lint and typecheck commands. `eslint` and `tsc` run from `<root>/node_modules/.bin`, which is repository-controlled code; others resolve off `PATH`; no arm runs `npx`.
- The project's test runner at `/cad-execute`, `/cad-task` and `/cad-coverage`, experiment code at `/cad-spike`, and reproductions at `/cad-debug`.
- Forge merge commands at `/cad-land`: `gh pr merge <branch> --merge --delete-branch`, `glab mr merge <branch> --yes --remove-source-branch --auto-merge=false`, and `tea pr merge --style merge <index>`.

Every `/cad-*` command except `/cad-help` lists `Bash` in `allowed-tools` with no command pattern, so inside a Cadence command the model runs shell commands without a permission prompt. The README's "Why every command keeps Bash open" section gives the reasons.

Hooks:

- PreToolUse on `Bash` runs `git-guard.mjs`. It asks on every `git push`. For `git commit` on a protected branch it asks, refuses or allows according to `git.on_protected` (default `ask`).
- PostToolUse on `Read|Grep|Glob|Bash|NotebookRead|mcp__excerpt__excerpt_read|mcp__excerpt__excerpt_search` runs `read-trace.mjs`.
- SubagentStop, with no matcher, runs `subagent-trace.mjs`.
- All three fire in every session where the plugin is enabled. They act only when a `.planning/` directory exists between the hook's `cwd` and the repository root, and they exit 0 on any internal error.

`git-guard.mjs` is a rail, not a security boundary. It sees only segments whose command word is `git`, so `bash -c "git push"`, `sh -c`, `eval`, `$(...)` and other wrappers pass it unseen; `cadence-core/references/git-publish.md` rail 3 lists what it misses. `git-publish.mjs publish` pushes as a subprocess, which the hook never sees, and that is deliberate.

Commands and prompts built from data:

- Argv built from data: branch names, which are checked for a safe name and a non-protected branch before a push; remote names, which must be a configured bare name; and the repository slug, which must pass the slug grammar. Issue titles and bodies are built from finding text and passed to the CLI by file.
- Prompts built from data: every agent dispatch carries planning documents, source and diffs; the cross-model `review` payload is the instruction plus the plan or diff; the `consult` payload is a description of the dead end.
- No SQL and no FTS. `/cad-why` ranks with an in-process BM25 (`lib/bm25.mjs`).

## What it must never touch

- A provider key goes only to its own provider's host, as that request's credential. It never goes into a config file, `trace.jsonl`, `reads.jsonl`, stdout, an error message or an issue.
- A repository's committed `.planning/config.json` must never, on its own:
  - set `workflow.test_command`, `workflow.lint_command` or `review.key_file`;
  - enable a cross-model provider;
  - authorize the unattended `git.auto_close` push and merge.
- No push without the user's answer at the prompt. The one exception is the `git.auto_close` arm, which both config layers must authorize.
- No unattended merge while a blocker or high finding is still unfixed.
- A declined finding is never filed remotely. It goes to `.planning/DECLINED.md` only.
- `/cad-capture --cadence` never commits, and never quotes a diff, file contents or a path from the user's tree.
- Never write into `${CLAUDE_PLUGIN_ROOT}`, or anywhere outside the places listed under "What it writes".
- No telemetry, and no network traffic Cadence starts itself apart from the three provider hosts. Forge and push traffic goes through the user's own `git`, `gh`, `glab` and `tea`.
- Never read `~/.ssh`, credential stores, other users' files, or another project's `.planning/`.
- Never approve a permission prompt on the user's behalf, and never weaken Claude Code's permission settings. The one settings write is `worktree.baseRef`, after the user picks the file.

## Who runs it and with what privileges

- The interactive user, inside their own Claude Code session. There is no service user, no root, no daemon and no timer.
- Seams run when the model calls them, and hooks run when Claude Code fires the event.
- Commands start when the user types a `/cad-*` command. `/cad-milestone` into `/cad-land` can chain unattended.
- That user can already do everything Claude Code can do as them, and Cadence adds no privilege. What it changes is how much happens without a prompt: the open Bash grant, the unattended merge chain, and hooks that run on every matching tool call.
- So a finding is a real escalation when repository content, a forge response or a provider response can cause an action the user did not authorize, or when it slips data past one of the rules above. The actions that count are a push, a merge, an issue, a network call, a key read and a command run.

## What the worst outcome looks like

The worst case is a malicious change shipped in a Cadence release. Every user who updates then runs that code as themselves:

- on every Bash, Read, Grep and Glob call and every subagent stop, in every Cadence project;
- with their provider keys, their `gh`, `glab` and `tea` logins, and their push rights.

`release.yml` publishes only a tag whose commit is on `main` and passes the suite. [VERIFY who can push to `main` on `crenshawdev/cadence`, and what branch protection requires.]

Next is prompt injection. Text that steers the model can arrive in a cloned repository's files, its `.planning/` documents, commit messages, issue titles, or a cross-model reviewer's findings. Inside a Cadence command, Bash is granted without a prompt, so that text could get the model to:

- run any command, including `curl` out with data;
- edit files outside the task;
- push through a shell wrapper the guard cannot see;
- reach the unattended merge.

No agent contract or workflow tells the model to treat repository text, reviewer findings or forge output as data rather than instructions.

The leaks that would hurt most:

- Code or a secret in a diff going to OpenAI, Gemini or DeepSeek. Redaction works by shape, so a bare key with nothing naming it goes out as written.
- A security finding filed as an issue on a public tracker before it is fixed. `issueBody` in `lib/filing-decision.mjs` puts the finding's claim and failure scenario in the body with whitespace collapsed and no redaction.
- A provider key appearing in an error, the trace or a transcript.

Data loss can come from `/cad-phase` renumbering, milestone pruning and `/cad-undo`, which move, delete or revert planning directories and commits, and from `reap` and `land-cleanup`, which delete local branches.

What the user would not notice:

- The hooks writing, which is silent by design.
- An unattended merge chain running.
- A reviewer finding carrying injected instructions.
- Planning records created world-readable under the default umask.
- A repository's config setting `git.on_protected` to `allow`, which silences the protected-branch guard for that repository.

## Trust boundaries (where untrusted data enters)

Hook stdin. Claude Code itself is trusted, but the tool response carries whatever the tool returned, including web pages and file contents. The hooks guard it like this:

- `read-trace.mjs` records paths only: in-repo files that exist, at most 12 per Bash call. For Bash it keeps `argv[0]` and nothing else, and for Grep its scope, never its pattern. Error text is cut to the first line, credential-shaped spans are redacted (`redactCause`), and the result is capped at 200 characters.
- `subagent-trace.mjs` reads only `agent_transcript_path`, refuses a file over 8 MiB, and answers `unknown` on any shape it does not recognize.

Project files and `.planning/` from a clone. They are read by the model and by the seams.

- `lib/global-only-keys.mjs` strips the three global-only keys from the repository layer, including the case where a non-object ancestor would replace them.
- `route.mjs` drops a cross-model reviewer the user-global `review.reviewers` does not name.
- `git-publish.mjs` requires `git.auto_close` in both layers.
- [VERIFY what size bounds the planning-file parsers in `lib/planning-files.mjs` put on what they read.]

Manifests read by `detect-commands`. They are read one directory deep, an arm is offered only when its tool resolves, and `npx` is never used. A repository's `node_modules/.bin` is still that repository's code.

Git data: commit messages, branch names and remote URLs. `lib/redact-url.mjs` redacts credentials in URLs before they reach any output. Branch and remote names are validated before a push, and the origin slug goes through the slug grammar before it is offered as a default.

Provider responses. Output is schema-enforced (OpenAI `json_schema`, Gemini `responseSchema`; DeepSeek uses `json_object` with the schema in the prompt) and checked for shape on return. Size limits:

| Limit | Value |
|---|---|
| Response | 4 MiB |
| Findings | 100 |
| File field | 1,024 characters |
| Text field | 2,000 characters |
| HTTP error body | 1,024 bytes, redacted |

The finding text then enters the main model's context with no fence around it.

Forge responses. Only the lookup's stdout is parsed, and only into fixed phrases and integers. Stderr is discarded at the spawn. `tea login list` is parsed into a decision and never echoed.

Seam payloads. Free text arrives in a file, and flags are checked against `lib/arg-contract.mjs`. Outbound provider payloads pass `fence()` (`redactUrl` plus `redactCredentials`) and are refused, not truncated, over `review.max_prompt_tokens` (default 120000, estimated as chars/4).

Environment. The `CADENCE_*` overrides redirect config, settings and schema reads, but whoever sets the environment already acts as the user.

Data trusted because it is Cadence's own earlier output:

- `trace.jsonl` and `reads.jsonl`, read back by `/cad-report`, `/cad-suggest` and routing.
- The `STATE.md` cursor.
- `DECLINED.md`, the decline set.
- The `SUMMARY.md` commit manifest that `/cad-undo` reverts from.

In a cloned repository these files arrive from someone else. [VERIFY whether `/cad-undo` checks the manifest's commits against the phase's own history before reverting.]

## Secrets that may pass through

Secrets that can appear in the data:

- API keys pasted into a chat.
- Credentials in source files and diffs.
- Tokens in git remote URLs.
- Tokens in `gh`, `glab` or `tea` output.
- Keys in the environment.

Where they can end up:

- The provider payload, after shape-based redaction.
- Issue bodies, with no redaction.
- Planning documents and commits the model writes.
- Seam stdout, and so Claude Code's context and transcripts.
- Not `reads.jsonl`, which holds paths and redacted error causes only.
- Not `trace.jsonl` for provider keys: `review-provider.mjs` resolves a key lazily, never logs it, and redacts HTTP error bodies before they reach the envelope.

What Cadence holds itself:

- Nothing at rest. A provider key is read per call, from the environment first and `providers.env` second, and is not stored.
- `providers.env` is created and owned by the user; Cadence never checks its mode.
- Forge credentials stay inside the user's `gh`, `glab` and `tea`.
