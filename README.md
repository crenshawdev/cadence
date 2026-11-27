# Cadence

[![Test](https://github.com/crenshawdev/cadence/actions/workflows/test.yml/badge.svg)](https://github.com/crenshawdev/cadence/actions/workflows/test.yml)
[![Latest release](https://img.shields.io/github/v/release/crenshawdev/cadence?label=release)](https://github.com/crenshawdev/cadence/releases/latest)
[![License: MIT](https://img.shields.io/github/license/crenshawdev/cadence)](LICENSE)

**Appearance is cheap. Verification is the work.**

Cadence is a Claude Code plugin that brings engineering practices to software you'll keep running after the session ends.

Getting an agent to write code is usually the easy part. Keeping it working toward the thing you actually asked for takes more attention. Decisions get lost between sessions. A small change grows an abstraction nobody needed. The tests pass, but you still have to work out what they established.

Cadence gives that work a structure. Requirements, decisions, plans and results stay in your repository under `.planning/`. Reviews run in a fresh context, apart from the work they check. A new session reads where the project stands and picks up from there.

You decide what you're building and the constraints it needs to respect. Cadence carries those decisions through the work.

## Get started

You'll need Claude Code with plugin support, Node.js, Git, and a signed-in forge CLI: `gh`, `glab` or `tea`. Testing-policy enforcement currently requires GitHub Actions. Cadence's own scripts have no runtime package dependencies.

```text
/plugin marketplace add https://github.com/crenshawdev/foundation.git
/plugin install cadence@foundation
```

Then, in a new or existing repository:

```text
/cadence:cad-agile
```

That one command runs the whole release. Each time you run it, it reads `.planning/agile/` and does the next step: start a release, refine an epic, build a story, accept an epic or close the release. Each step's record is on disk, so you can clear the session between any two runs.

A project on the old path, started with `/cadence:cad-new-project` or `/cadence:cad-adopt` and worked a phase at a time, keeps working as it did, and the [guide](https://crenshawdev.github.io/cadence/) covers it. Once its release has landed, `/cadence:cad-agile --brief <design folder>` moves it to the new path: the old files go to `.planning/_archive-old-path/`, and the old commands stop working there.

Update with `/plugin update cadence@foundation`.

## How a release runs

A release is a set of epics, built in order, and each epic is a set of stories.

### Design the release

A release starts from a design: the problem, the requirements, the architecture decisions and the epics in build order. [Seldon](https://github.com/crenshawdev/seldon) writes one with you and hands you the command that starts it. Without a design, `/cadence:cad-agile` asks six questions and writes a short one in the same format. Nothing is written until you say yes to the draft.

### Start it

`/cadence:cad-agile --brief <design folder>` turns the design into `.planning/agile/`: the project, its requirements, the release and one file per epic. Everything that could stop the release later is settled first, before anything is written. You're asked about the forge, the testing policy, the parts of the code risky enough for a blocking review, any outside reviewer that can't run, and a branch if you're on a protected one, and the start stops if git has no name and email to commit with. The release is committed unless `planning.commit_docs` is off.

### Refine an epic

Before an epic is built, Cadence reads it and the code it changes, then cuts it into stories. A story is one change or a short plan of two or three tasks, and anything bigger is split. Each says what it delivers and how it's accepted, and every acceptance line is a check Cadence can run, never one left for you. You're asked only about choices that would be costly to undo. The rest are picked and shown with the list, and the stories are saved when you say to build them.

### Build a story

Each run builds the next story: its short plan when it has one, the change, and a commit per task. Then every reviewer `review.reviewers` names reviews the story's diff, and a diff that touches one of your risk surfaces goes to the risk-surface review instead, which blocks by default (`review.triggers.risk_surface.gate`). Reviewers are Claude agents with a fresh context, plus any outside model you've set up with `/cadence:cad-config`. An outside reviewer isn't required. How findings are handled is asked once per epic: fix everything at medium and up and bring you the lows, or bring you each one. Then the story's checks run, and it's done when they pass. A failing check gets one fix round.

An agent can find a reason to write another test almost indefinitely. Cadence's testing policy, opt-in per repository, sets the scope before implementation: reuse existing tests that cover the behavior, add the fewest checks that prove the rest, and stop when the agreed behavior is covered and the required checks pass in GitHub Actions. Going past that needs a demonstrated defect, an uncovered acceptance requirement or a measured coverage shortfall. The [testing chapter](https://crenshawdev.github.io/cadence/testing/policy.html) has the rules, thresholds and supported tools.

### Accept the epic

When an epic's last story is done, Cadence shows what it took, from the stories, commits and review findings to the recorded agent tokens, with a drafted retrospective: what went well, what could be better, and what to change next. Accept it, change the retrospective, or say what's missing and the epic is cut again for it. Each thing to change next is applied, made a standing rule or dropped when the next epic is refined.

### Close the release

When every epic is done, you pick the version, and a requirement still open is either deferred or the close stops. Cadence moves the release into `.planning/agile/releases/<version>/` and commits it. On a Claude Code plugin it also sets the version in `.claude-plugin/plugin.json` and turns the CHANGELOG's Unreleased section into the release's entry. With `git.auto_close` set in both config layers, the close then lands the release as below; otherwise it pushes nothing.

### Land it

`/cadence:cad-land` reports the git state and asks how to publish: push, open a pull or merge request, tag, or leave it local. With `git.auto_close` set in both config layers, it opens the request, merges it and tags without stopping, and asks once, before the tag push.

The record stays with the project, so you can end a session without making the next one reconstruct your decisions from chat.

## Documentation

[Read the Cadence guide](https://crenshawdev.github.io/cadence/), or [browse the Markdown on GitHub](./docs/guide/SUMMARY.md).

| Start here | What you'll find |
|---|---|
| [Getting started](https://crenshawdev.github.io/cadence/getting-started/install.html) · [Working with Cadence](https://crenshawdev.github.io/cadence/working/plan-execute.html) | Installation, the project cycle and your first phase. |
| [Commands](https://crenshawdev.github.io/cadence/reference/commands.html) | The full command reference; also available through `/cadence:cad-help`. |
| [Configuration](https://crenshawdev.github.io/cadence/configuration/index.html) | Options, defaults, types and configuration scopes. Use `/cadence:cad-config` to change them. |
| [Testing policy](https://crenshawdev.github.io/cadence/testing/policy.html) | Test scope, stopping rules, coverage and required CI jobs. |
| [Permissions and data](https://crenshawdev.github.io/cadence/reference/permissions.html) | Provider calls, credentials, local records, shell permissions and publishing. |
| [How it works](https://crenshawdev.github.io/cadence/how-it-works/roles.html) · [Controls and limits](https://crenshawdev.github.io/cadence/how-it-works/controls.html) | What the roles do and how the controls work. |
| [Cost](https://crenshawdev.github.io/cadence/how-it-works/cost.html) | Measured runs and where the spend goes. |

Cadence adds no telemetry. Its records stay in your repository and go wherever you push them. It also reads the host's run file for a workflow under the session directory, read-only, to price each agent and take the result: for a review workflow, for each `/cad-execute` wave, and for `/cad-map` after its typed yes. For a review workflow, the findings and rulings come from the run's journal beside that file, also read-only. The journal holds what each reviewer and checker returned, and it stays on your machine. It runs inside Claude Code, so your session is still subject to the host's data handling. Optional external reviewers receive project material only when enabled.

## Help and attribution

Questions go in **#cadence** on the [jcrenshaw.dev Discord](https://jcrenshaw.dev/discord). Bugs go to [GitHub issues](https://github.com/crenshawdev/cadence/issues). See [Contributing](./.github/CONTRIBUTING.md) before proposing a change.

Cadence is maintained by John Crenshaw and derives from [GSD](https://github.com/open-gsd/gsd-core) by Open GSD. It's distributed under the [MIT License](./LICENSE), with the original attribution retained in [NOTICE](./NOTICE.md). [Lineage](./docs/LINEAGE.md) records where it came from.

## Supporting Cadence

Cadence is free under the MIT License. If it's useful to you and you'd like to support the work, you can do that through [GitHub Sponsors](https://github.com/sponsors/crenshawdev) or [Ko-fi](https://ko-fi.com/jcrenshawdev).
