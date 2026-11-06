# Permissions and data

Cadence sends no telemetry and keeps its record in your repository. Optional cross-model reviews use provider APIs; forge operations and publishing use your own forge CLI and git. Everything else it touches outside the project is listed here, so you don't have to find it by reading the scripts.

## Cross-model reviewers

They're off by default. The shipped reviewer is the Claude subagent, which needs no key and sends nothing your session isn't already sending. A provider runs only when your user-global config's `review.reviewers` names it as well as the project's, so a repository's committed `review.reviewers` can't send your code to a provider on your key by itself, and cloning a repo that lists `openai` changes nothing until you've named `openai` yourself. Naming a provider there authorizes it for every repository whose own config names it too, and `/cadence:cad-config --review` asks before it writes that.

| Provider | Host | Key |
|---|---|---|
| OpenAI | `https://api.openai.com` | `OPENAI_API_KEY` |
| Gemini | `https://generativelanguage.googleapis.com` | `GEMINI_API_KEY` |
| DeepSeek | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |

The key comes from the environment first. When the variable isn't set, `cadence-core/bin/review-provider.mjs` reads it from `~/.config/cadence/providers.env` (under `$XDG_CONFIG_HOME` when that's set), or from the file `review.key_file` names in your user-global config. That's a script reading a credential off your machine, which is what the plugin directory flags, and it stays that way on purpose: a plugin `userConfig` secret only reaches hooks and MCP servers, and the review calls run through Bash. The key is never written to a config file or printed, and each key goes only to its own provider's host.

`review-provider.mjs` makes three calls, each to that host with that key:

- `review` sends the review instruction and the artifact under review, a plan or a diff, after credential redaction. It runs when a review gate fires with that provider in the reviewer set, and at `/cadence:cad-decision-review`.
- `consult` sends a short description of a dead end, the goal, what was tried and the exact failing signal, after the same redaction. It runs only with `review.consult.enabled` true, and only after you say yes to an offer that names the provider and model. `/cadence:cad-debug`, `/cadence:cad-execute` and `/cadence:cad-plan` make that offer.
- `detect-models` sends no project content, only the key as the request's credential, to list the provider's models when you run `/cadence:cad-config --review`.

Redaction catches a credential by its shape, a credential-shaped name beside its value, a URL's userinfo, an `Authorization` header, and not by a list of known prefixes. A bare key sitting in a diff with nothing naming it goes out as written, so don't point a reviewer at a secrets file.

## Your forge

Every forge write goes through your own `tea`, `gh` or `glab`, signed in as you:

- `repo create --private`, once, at `/cadence:cad-new-project`, after you confirm the owner and name;
- `issue create`, with an `issue list` first to find a duplicate, when you send a review finding to the tracker instead of fixing it now;
- PR or MR create and merge at `/cadence:cad-land`, when you pick that arm, or unattended when `git.auto_close` is true in both the repository's config and your user-global config.
- under an accepted testing policy, `gh api` reads the check runs of one commit, and `/cadence:cad-verify` pushes a non-protected branch so those jobs can run, only when `cadence.publishForVerification` is true in the repository's `.git/config`.

## Optional MCP tool

Context7 is used when it's installed and skipped when it's not, and Cadence doesn't install it. Without Context7, `/cadence:cad-decision-review` checks library and API claims against the installed package source, the lockfile or vendored docs, and lists every claim it couldn't check.

## The two hooks that watch

- `subagent-trace` reads the stopped subagent's own transcript, the file the host keeps for that agent, to price the dispatch in `.planning/trace.jsonl`.
- `read-trace` logs the path of each project file a tool call opens to `.planning/reads.jsonl`. Paths only, never contents. A file inside the plugin is recorded relative to the plugin, and any other path outside the project is recorded only as `outside`.

## The Workflow tool

`/cadence:cad-plan`, `/cadence:cad-plan-review`, `/cadence:cad-execute`, `/cadence:cad-verify`, `/cadence:cad-task`, `/cadence:cad-debug` list `Workflow` in `allowed-tools`. It runs the review panel as a workflow, and only when `workflow.use_workflows` is true in both your repository's config and your user-global config, which is off by default. When it runs, Cadence reads the host's run file for that workflow, `workflows/<run id>.json` under the session directory, read-only, to price each agent and to take the result.

`/cadence:cad-map` also lists `Workflow`, to run the code map's readers. It doesn't read `workflow.use_workflows`: it runs only with `planning.code_map` on and only after you type a yes to a prompt that names the readers it would start, so a repository's committed setting alone can't start one.

## Outside the project

What Cadence writes outside your repository:

- `~/.claude/cadence/config.json`, or the file `CADENCE_GLOBAL_CONFIG` names, when a setup interview or `/cadence:cad-config` saves a machine-wide answer;
- `CAPTURE.md` beside that config, from `/cadence:cad-capture --cadence`;
- the `worktree.baseRef` key, merged into `.claude/settings.json` or `~/.claude/settings.json`, only after you pick the file at `/cadence:cad-config`;
- scratch directories from `mktemp` under `TMPDIR`, or `/tmp` when it's unset.

What it reads outside it: your user-global config, the host's workflow run file under the session directory, `providers.env` or the `review.key_file` file during a provider call, and `~/.claude/settings.json` and the platform's `managed-settings.json` to learn `worktree.baseRef` before running plans in parallel worktrees.

## Shell commands

No Cadence command lists `Bash` in `allowed-tools`, so every shell command a workflow runs goes through Claude Code's own permission check, and your permission mode and your `permissions.allow` rules decide whether it asks first. What the workflows run:

- Cadence's own scripts, as `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/<script>.mjs"`;
- `git`, and in `/cadence:cad-land` the forge CLI, `gh`, `glab` or `tea`;
- scratch lines that make a directory with `mktemp -d` and read it back with `node -e`;
- `workflow.test_command` or a detected test runner during execution, task work, coverage and verification, experiment code in `/cadence:cad-spike`, and reproductions in `/cadence:cad-debug`.

To stop the prompts, add rules for the commands you trust with `/permissions`. The unattended `/cadence:cad-milestone` into `/cadence:cad-land` chain stops at the first command your settings don't approve, so set those rules before you turn on `git.auto_close`.

Pushes are still guarded by git-guard, a hook that only asks or refuses and never approves, and the pushes it never sees are the unattended close above and the verification publish, which a repository authorizes for itself in `.git/config`.

## Privacy

No telemetry, no analytics, no phoning home. Provider calls use the APIs described above. Forge and push traffic goes through your own `tea`, `gh`, `glab` and `git`. Commands that build, test or install project dependencies can also use the network under the host's permissions. The planning record, the run trace and the reads log stay in `.planning/` in your repository and go wherever you push it. Cadence runs inside Claude Code, so what your session sees goes wherever Claude Code sends it, which is the host's policy and not this plugin's.

[Back to the guide](../index.md)
