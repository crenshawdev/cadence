# Cadence security rules

## Threat model

Cadence is a Claude Code plugin. Skills, workflows, references and agent files are prose the model follows, and what that prose tells the model to run, edit, send or grant is Cadence's behaviour. `cadence-core/bin/**/*.mjs` are zero-dependency Node seams the model runs through Bash. `hooks/hooks.json` registers three hooks (PreToolUse `git-guard.mjs` on Bash, PostToolUse `read-trace.mjs`, SubagentStop `subagent-trace.mjs`) that start on every matching tool call in every session with the plugin enabled and act only inside a project with `.planning/`. Everything runs as the interactive user, with that user's provider keys, forge CLI logins and push rights. 27 of the 28 user-invocable skills grant `Bash` with no pattern, so inside a Cadence command the model runs shell without a prompt, and subagents hold unrestricted Bash, including the read-only roles.

Worst outcomes: a release that ships malicious hook or seam code to every user; repository, web, provider or forge text steering the model into commands, pushes, merges or exfiltration; code, secrets or unfixed security findings leaving the machine (provider payloads, issues, PR bodies, pushed planning records); planning records, branches or history destroyed.

Untrusted input: hook stdin (tool responses carry web and file content); every file in a cloned repository, including `.planning/config.json`, PLAN files and their `Verify:` commands, `CLAUDE.md`, manifests, `node_modules/.bin` and `.gitattributes`; commit messages, branch names, remote URLs and git remote messages; provider responses, including findings, consult angles and model ids from `/models`; `gh`/`glab`/`tea` output; subagent transcripts under `~/.claude/projects`. Files Cadence wrote earlier (`trace.jsonl`, `reads.jsonl`, `STATE.md`, `DECLINED.md`, `FILED.md`, `ADJUDICATION-*.json`, SUMMARY manifests) are untrusted when they came in with a clone.

## Review checklist

Processes and argv
- Every child process goes through `execFileSync`/`spawnSync` with an argv array. Flag any `exec`, `execSync`, `shell: true`, or a command string built by concatenation.
- Any value from config, git, a forge, a provider or a finding that reaches argv must be checked against its grammar where it is read, not only where `config.mjs set` writes it, and must not be able to read as an option: refuse a leading `-`, or place it after `--`. This applies to refs and branch names in every `git` call.
- A value interpolated into a URL path must be encoded.
- A forge CLI is spawned only after `lib/on-path.mjs` resolves it, with stderr discarded at the spawn and an explicit timeout. Child output reaches an envelope only after it is parsed into fixed phrases or integers.

Config layers
- `workflow.test_command`, `workflow.lint_command` and `review.key_file` are honoured from the user-global layer only (`lib/global-only-keys.mjs`). A new key that chooses what runs, what is read, or where data is sent must be added there and to the schema's `src: "global"` marker.
- A cross-model provider runs only when the user-global `review.reviewers` names it. `git.auto_close` authorizes an unattended push or merge only when both layers set it. Flag any path where the repository layer alone enables either.
- A repository layer can weaken gates (`git.on_protected`, `git.protected_branches`, `review.triggers.*.gate`, `waive_routing_floor`). Flag a new repo-settable key that removes a prompt or a gate without the user seeing it.
- Keep the non-object-ancestor case covered: a repository layer holding `"workflow": "x"` must not wipe user-global keys under it.

Network and keys
- `bin/review-provider.mjs` is the only file that makes an HTTPS call, to the hardcoded `api.openai.com`, `generativelanguage.googleapis.com` and `api.deepseek.com`. Flag any other network call, host, redirect or destination override.
- A provider key goes only to its own provider's host as that request's credential. Flag a key reaching stdout, a trace event, an error message, a config file, argv or another host.
- Every outbound payload string goes through `fence()` before the size cap, and an over-cap payload is refused, never truncated.
- Every provider response is bounded and validated locally, whatever the provider's schema enforces: 4 MiB body, `validateFindings` (100 findings, field lengths, severity enum) for all three providers, error bodies redacted and capped at 1,024 bytes. New response shapes need the same count and length bounds.

Hooks
- `git-guard.mjs`, `read-trace.mjs` and `subagent-trace.mjs` exit 0 on any internal error. The two recorders print nothing on any stream.
- `read-trace` records paths and program names, never a Grep pattern, a command line or a payload. Error text is the first line, `redactCause`d, at most 200 characters.
- `subagent-trace` acts only for Cadence's own roles, reads only `agent_transcript_path`, never `transcript_path`, and refuses a file over 8 MiB.
- `git-guard` is a rail, not a boundary: it misses shell wrappers by design. Do not report a known wrapper as new. Do report a change that lets a plain `git push`, or a `git commit` on a protected branch, pass without a decision in any directory a Cadence session works in, Claude Code's worktrees included.

Files
- Appends to `trace.jsonl` and `reads.jsonl` `lstat` first and refuse a symlink. Whole-file writes go through `atomicWrite`. Records stay under their caps (1 MiB trace, 8 MiB reads), and `trace ignore` keeps both out of git.
- Writes stay inside the project, the user-global config directory, the one `worktree.baseRef` settings key the user picked, and `mktemp` scratch. Flag a write to `${CLAUDE_PLUGIN_ROOT}`, other Claude Code settings, shell rc files, or another project.
- No script sets a file mode today. Flag new files that hold secrets or candid notes without an explicit mode.

Prose
- A workflow or agent contract must not tell the model to act on instructions found in repository text, reviewer findings, provider output or forge output. Flag new prose that pipes such text into a command, a commit, an issue or a push.
- Text that leaves the machine (provider payloads, issue titles and bodies, PR bodies, pushed planning records, `/cad-capture --cadence` entries) must not carry secrets, credentials in URLs, or unfixed security findings. An ask that publishes must name where it goes and whether that place is public.
- No new unprompted push, merge, issue, repo create or network call. A declined finding stays in `.planning/DECLINED.md`.
- Destructive steps (`/cad-undo` reverts, renumbering, milestone pruning, branch reaping and deletion) act only on what the phase's own record names, after the user confirms it.

CI and release
- `.github/workflows/` keeps actions pinned to commits and installed tools pinned to versions, `permissions: contents: read` by default, and `contents: write` only on the release `publish` job.
- `release.yml` keeps refusing a tag whose commit is not on `main`, whose suite is red, or that the last audit's `SENTINEL.md` does not cover.
- `fast.yml` stays a byte-identical copy of `.sentinel/ci/fast.yml`.
