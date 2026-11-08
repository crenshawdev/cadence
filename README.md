# Cadence

[![Test](https://github.com/crenshawdev/cadence/actions/workflows/test.yml/badge.svg)](https://github.com/crenshawdev/cadence/actions/workflows/test.yml)
[![Latest release](https://img.shields.io/github/v/release/crenshawdev/cadence?label=release)](https://github.com/crenshawdev/cadence/releases/latest)
[![License: MIT](https://img.shields.io/github/license/crenshawdev/cadence)](LICENSE)

**Appearance is cheap. Verification is the work.**

Cadence is a Claude Code plugin that brings engineering practices to software you'll keep running after the session ends.

Getting an agent to write code is usually the easy part. Keeping it working toward the thing you actually asked for takes more attention. Decisions get lost between sessions. A small change grows an abstraction nobody needed. The tests pass, but you still have to work out what they established.

Cadence gives that work a structure. Requirements, decisions, plans and results stay in your repository under `.planning/`. Planning, implementation and review happen in separate contexts. A new session reads where the project stands and picks up from there.

You decide what you're building and the constraints it needs to respect. Cadence carries those decisions through the work.

## Testing needs a stopping point

An agent can find a reason to write another test almost indefinitely. Each suggestion may sound reasonable on its own. Taken together, they can cost more to build and maintain than the behavior they protect.

More testing has to earn its place.

Cadence's testing policy sets the scope before implementation. Planning checks what the existing tests cover, chooses the smallest set of additional checks needed, and states what evidence is enough to finish. Fixtures, mocks and test infrastructure count toward that effort too.

Under an accepted policy:

- Required tests run unattended in **GitHub Actions**, including setup, services and cleanup.
- Coverage starts at a recommended **85% for lines and branches**, preserving higher existing thresholds. Unsupported metrics are made explicit; Go has a separate statement threshold.
- Existing tests are reused when they adequately cover the behavior. Bug fixes need a reproducer that fails for the defect and passes after the fix.
- Testing stops when the agreed behavior is covered and the required checks pass. Expanding it needs a demonstrated defect, an uncovered acceptance requirement or a measured coverage shortfall.

A passing coverage percentage doesn't establish that the assertions mean anything. The policy requires both meaningful checks and the accepted thresholds. You shouldn't have to approve every test to keep testing under control.

Setup offers the policy, or you can accept one for an existing Cadence project with `/cadence:cad-config --testing`. It's opt-in per repository. CI-only checks stay pending until they run, and a phase is called CI-verified only for a commit whose required jobs passed.

Read the [testing chapter](https://crenshawdev.github.io/cadence/testing/policy.html) for the rules, supported coverage tools and enforcement limits.

## Get started

You'll need Claude Code with plugin support, Node.js, Git, and a signed-in forge CLI: `gh`, `glab` or `tea`. Testing-policy enforcement currently requires GitHub Actions. Cadence's own scripts have no runtime package dependencies.

```text
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

In an existing repository:

```text
/cadence:cad-adopt
```

For a new project:

```text
/cadence:cad-new-project
```

Already worked through the idea? Pass your brief with `/cadence:cad-new-project --brief <file>`. Cadence reads what's settled and asks about what's still open.

Update with `/plugin update cadence@cadence`.

## The working loop

Commands below use the short names. In Claude Code, use the `/cadence:` prefix, as above.

| Command | What it does |
|---|---|
| `/cad-context <phase>` | Settle the decisions and acceptance criteria. |
| `/cad-plan <phase>` | Turn them into a plan with a bounded testing scope when a policy is active. |
| `/cad-map` | Build or refresh the code map the planner reads. It runs only with `planning.code_map` on, after a typed yes. |
| `/cad-execute <phase>` | Build the plan and run its checks. |
| `/cad-verify <phase>` | Check whether the phase delivered what it promised. |
| `/cad-progress` | Read the project state and find the next step. |

Review findings come back for triage. You can use fresh-context Claude reviewers or explicitly enable other providers. Publishing for verification and unattended landing each need their own authorization.

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

Cadence adds no telemetry. Its records stay in your repository and go wherever you push them. It also reads the host's run file for a workflow under the session directory, read-only, to price each agent and take the result: for a review workflow when `workflow.use_workflows` is on in both config layers, and for `/cad-map` after its typed yes. It runs inside Claude Code, so your session is still subject to the host's data handling. Optional external reviewers receive project material only when enabled.

## Help and attribution

Questions go in **#cadence** on the [jcrenshaw.dev Discord](https://jcrenshaw.dev/discord). Bugs go to [GitHub issues](https://github.com/crenshawdev/cadence/issues). See [Contributing](./CONTRIBUTING.md) before proposing a change.

Cadence is maintained by John Crenshaw and derives from [GSD](https://github.com/open-gsd/gsd-core) by Open GSD. It's distributed under the [MIT License](./LICENSE), with the original attribution retained in [NOTICE](./NOTICE.md). [Lineage](./LINEAGE.md) records where it came from.

[Support Cadence on Ko-fi](https://ko-fi.com/R5Y823KUXE).
