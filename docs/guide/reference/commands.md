# Commands

Use the full `/cadence:cad-` name in Claude Code. Square brackets below mean an optional argument; angle brackets name a value you supply. `N` is a phase number. Commands that accept an optional phase use the current phase when they can resolve one, or ask when they can't.

The commands do different kinds of work. Execution, task work, fixes, pausing and rollback can make commits. Setup and planning can commit project records. Landing publishes only through its chosen or explicitly authorized path. A slash command isn't inherently read-only.

## The agile path

A project works in releases, epics and stories on this path, or in milestones and phases through the commands below it. It's on one or the other, and the commands that start a phase project stop on an agile one.

| Command | Arguments | What it does |
|---|---|---|
| `/cadence:cad-agile` | `[--brief <design folder>]` | Run the path. With no release open, `--brief` turns a Seldon design into a release and its epics under `.planning/agile/` and commits them. It asks for the forge, the risk surfaces and the testing policy first, and asks about a reviewer that can't run. Nothing is written until you've answered, and a project that has answers is asked for none of them again. With one open and an epic to refine, it asks about the choices that are hard to undo, shows the stories with their sizes and checks, and writes and commits them once you approve. Your answers are kept if you clear the session. When how to cut the epic depends on something nobody knows yet, it offers to read the code, which starts one agent, or to spike it. It starts no other. You can defer one of the epic's requirements or add one as part of the list, and an epic holding more than one outcome you'd accept on its own is split, the rest becoming the next epic. An epic holding a story sized L is cut again: its done stories stay, and the new ones take numbers never used before. With nothing to refine, it names the next step. |

## Start and build

| Command | Arguments | What it does |
|---|---|---|
| `/cadence:cad-new-project` | `[--research] [--brief <file or design folder>]` | Establish the project, requirements and roadmap. `--research` requests research; `--brief` starts from decisions already written down. A Seldon design folder after `--brief` starts the project from the design. |
| `/cadence:cad-adopt` | None | Read an existing repository and establish its project record and remaining-work roadmap. |
| `/cadence:cad-context` | `[N]` | Settle phase decisions and acceptance criteria. Writes `CONTEXT.md`; optional before planning. |
| `/cadence:cad-plan` | `[N] [--skip-check] [--inline] [--gaps]` | Create executable plans. `--skip-check` bypasses the optional checker, `--inline` requests the inline path, and `--gaps` plans outstanding verification gaps. Plan review is separate. |
| `/cadence:cad-map` | None | Build or refresh the code map: what the code is, what touches what and which tests pin it. Runs only with `planning.code_map` on, and starts nothing until you type a yes, on a refresh too. To cut the modules afresh, remove the stored list with `rm .planning/records/codemap/index.json`. |
| `/cadence:cad-execute` | `[N] [--rerun]` | Execute plans, run checks and commit tasks. Normally it checks for already completed work; `--rerun` explicitly requests replay. |
| `/cadence:cad-verify` | `[N] [--sweep] [--deep]` | Verify acceptance criteria and record results. With a testing policy, required checks are automated and CI-only work stays pending. `--deep` requests the goal-backward pass; `--sweep` checks across phases. |
| `/cadence:cad-task` | `<description> [--plan]` | Implement a small off-roadmap task with commits. `--plan` asks for a plan for multi-step work. |
| `/cadence:cad-spike` | `<question or hypothesis>` | Run a time-boxed experiment and record a verdict in `SPIKE.md`. Its throwaway code is exempt from the project testing policy. |

See [plan and execute](../working/plan-execute.md) and [verify results](../working/verify.md) for the normal sequence. A request for `--deep` still respects `workflow.verifier=false`.

## Review and investigate

| Command | Arguments | What it does |
|---|---|---|
| `/cadence:cad-plan-review` | `[N or path to PLAN.md]` | Review an existing, edited or imported plan through the plan-review trigger. |
| `/cadence:cad-decision-review` | `[path to decision document]` | Examine a consequential decision against the code and available evidence. |
| `/cadence:cad-minimalism-review` | `[path, directory or N]` | Produce a ranked list of unnecessary code and abstractions. Applies none of its suggestions. |
| `/cadence:cad-debug` | `[symptom]`, `list`, `status <slug>`, `continue <slug>`, or `--diagnose` | Investigate a defect with persistent hypotheses and reproduction evidence. `--diagnose` stops at diagnosis; the fixing path can change code and commit. |
| `/cadence:cad-coverage` | `[N]` | Find requirements without meaningful regression coverage and address the gaps. Under a policy, it follows the agreed scope and stopping rule and includes the required coverage job's result. |
| `/cadence:cad-docs-verify` | `[path or glob]` | Check documentation claims against code. Defaults to the README and `docs/`. Reports findings without rewriting the docs. |
| `/cadence:cad-audit` | `[milestone]` | Trace active requirements through phases, plans and verification. Broken traces or coverage breaks fail the audit. |
| `/cadence:cad-why` | `<path>[:<line>]` | Read the Git and planning history behind a file or line. Read-only. |

[Review findings](../working/reviews.md) explains the difference between a report, a blocking gate and work you choose to accept.

## Manage the cycle

| Command | Arguments | What it does |
|---|---|---|
| `/cadence:cad-phase` | `add [description]`, `add --brief <design folder>`, `insert <N>`, `remove <N>`, or `edit <N>` | Change the roadmap, maintaining phase numbering and references. `add --brief` adds a Seldon design's requirements and phases to a project that already exists. |
| `/cadence:cad-milestone` | `[version or next-milestone name]` | Audit and close a cycle, update the live project record and handle applicable release preparation. With unattended closing authorized, it can continue into landing. |
| `/cadence:cad-land` | `[base branch]` | Report Git state and publish through your selected mechanism or the authorized unattended path. It can push, create a PR/MR, merge, tag and clean up, depending on that path. |
| `/cadence:cad-undo` | `<N> [--no-commit]` | Revert the phase commits identified from its summary, after showing the scope and checking for dirty state. `--no-commit` leaves the combined revert uncommitted. |
| `/cadence:cad-pause` | `[resume note]` | Preserve work with a WIP commit when needed and commit a paused state cursor. Resume through progress. |

See [finish and publish](../working/publish.md) before using the closing commands. Pausing and undoing also change repository state; they aren't status queries.

## Find your place and configure

| Command | Arguments | What it does |
|---|---|---|
| `/cadence:cad-progress` | `[--stats or --trace]` | Derive the project state and offer the next action. The normal path can reconcile the cursor; `--stats` and `--trace` are read-only views. |
| `/cadence:cad-report` | `[N] [--all]` | Read a phase's run record, including dispatch costs and review outcomes. `--all` gives the milestone view. |
| `/cadence:cad-suggest` | `[N]` | Propose configuration changes supported by the run record. With no phase, read the whole record. Applies no changes itself. |
| `/cadence:cad-capture` | `[todo, seed or note] <text> [--phase N] [--cadence]` | Save an idea without changing the current task's scope. `--cadence` writes to the Cadence-wide queue beside your global configuration. |
| `/cadence:cad-config` | `[key=value ...]`, `<a sentence>`, `--walk`, `--review [redetect]`, `--surfaces`, `--testing`, or `--roles [--global]` | Configure the project through the full `--walk`, a direct setting or a guided setup. With the menu on (`workflow.config_menu=true`, off by default), no arguments opens six groups of settings and a sentence says what to change; with it off, no arguments opens the walk. See the [configuration reference](../configuration/index.md). |
| `/cadence:cad-health` | None | Report structural problems in `.planning/`, configuration and the active testing-policy setup. |
| `/cadence:cad-help` | `[command name]` | Show the command reference inside a session, or help for one command. |

Provider consultation and automatic review triggers are capabilities used by these commands, not additional standalone commands.
