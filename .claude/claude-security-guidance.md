# Cadence security rules

## Threat model

Cadence is a Claude Code plugin. Skills, workflows and agent files are prose the model follows; `cadence-core/bin/*.mjs` are zero-dependency Node seams the model runs through Bash; `hooks/hooks.json` registers three hooks that run on every matching tool call in any session with the plugin enabled, acting only inside a project with `.planning/`. It runs as the interactive user with that user's provider keys, forge logins and push rights. Every `/cad-*` command except `/cad-help` grants Bash with no pattern, so the model runs shell without a prompt inside a Cadence command.

Worst outcomes: a release that ships malicious hook or seam code to every user; repository or remote text steering the model into commands, pushes, merges or exfiltration; code, secrets or unfixed security findings leaving the machine (provider payloads, public issues); planning records or git history destroyed.

Untrusted input: hook stdin (tool responses carry web and file content), every file in a cloned repository including `.planning/` and `.planning/config.json`, git commit messages, branch names and remote URLs, manifests and `node_modules/.bin`, provider responses, and `gh`/`glab`/`tea` output. Files Cadence wrote earlier (`trace.jsonl`, `reads.jsonl`, `STATE.md`, `DECLINED.md`, `SUMMARY.md` manifests) are untrusted too when they came in with a clone.

## Review checklist

Processes
- Every child process goes through `execFileSync`/`spawnSync` with an argv array. Flag any `exec`, `execSync`, `shell: true`, or a command string built by concatenation.
- A value from config, git, a forge or a finding that reaches argv must pass its grammar first (safe branch name, configured bare remote, slug grammar) so it cannot read as a flag.
- A forge CLI is spawned only after `lib/on-path.mjs` resolves it, with stderr discarded at the spawn and an explicit timeout. No byte of child output reaches a seam's envelope unless it is parsed into fixed phrases or integers.

Config layers
- `workflow.test_command`, `workflow.lint_command` and `review.key_file` are honoured from the user-global layer only (`lib/global-only-keys.mjs`). A new key that chooses what runs, what is read, or where data is sent must be added there and to the schema's `src: "global"` marker.
- A cross-model provider runs only when the user-global `review.reviewers` names it. `git.auto_close` authorizes an unattended push or merge only when both layers set it. Flag any path where the repository layer alone enables either.
- Check the non-object-ancestor case: a repository layer holding `"workflow": "x"` must not wipe user-global keys under it.

Network and keys
- `bin/review-provider.mjs` is the only file that makes an HTTPS call, to `api.openai.com`, `generativelanguage.googleapis.com` and `api.deepseek.com` only. Flag any other network call or host.
- A provider key goes only to its own provider's host as that request's credential. Flag a key reaching stdout, a trace event, an error message, a config file or another host.
- Every outbound payload string goes through `fence()` before the size cap, and an over-cap payload is refused, never truncated.
- Responses stay bounded: 4 MiB body, 100 findings, field length caps, HTTP error bodies redacted and capped at 1,024 bytes.

Hooks
- `git-guard.mjs`, `read-trace.mjs` and `subagent-trace.mjs` must exit 0 on any internal error. The two recorders print nothing on any stream.
- `read-trace` records paths only: in-repo existing files, Bash `argv[0]`, Grep scope, never a pattern, command line or payload. Error text is first line, `redactCause`d, at most 200 characters.
- `subagent-trace` reads only `agent_transcript_path`, never `transcript_path`, and refuses a file over 8 MiB.
- `git-guard` is a rail, not a boundary: it misses shell wrappers by design. Do not report a known wrapper bypass as new; do report a change that makes a plain `git push` or a protected-branch `git commit` pass silently.

Files
- Appends to `trace.jsonl` and `reads.jsonl` must `lstat` and refuse a symlink. Whole-file writes go through `atomicWrite`. Records stay under their caps (1 MiB trace, 8 MiB reads).
- Writes stay inside the project, the user-global config directory, the one `worktree.baseRef` settings key the user picked, and `mktemp` scratch. Flag a write to `${CLAUDE_PLUGIN_ROOT}`, other Claude Code settings, shell rc files, or another project.
- No script sets a file mode today. Flag new files that hold secrets or candid notes without an explicit mode.

Prose
- A workflow or agent contract must not tell the model to act on instructions found in repository text, reviewer findings or forge output. Flag new prose that pipes such text into a command, a commit, an issue or a push.
- Text that leaves the machine (provider payloads, issue titles and bodies, `/cad-capture --cadence` entries) must not quote secrets or unfixed security findings. `issueBody` in `lib/filing-decision.mjs` does no redaction.
- No new unprompted push, merge, issue, repo create or network call. A declined finding stays in `.planning/DECLINED.md`.
- Destructive steps (`/cad-undo` reverts, phase renumbering, milestone pruning, branch reaping) must act only on what the phase's own record names.

CI and release
- `.github/workflows/` keeps actions pinned to commits, `permissions: contents: read` by default, and `contents: write` only on the release `publish` job.
- `release.yml` must keep refusing a tag whose commit is not on `main` or whose suite is red.
