# Cadence commands

Invoke as `/cad-<name>`.

## Agile path
A project is on this path or on the phase path below, never on both.

| Command | What it does |
|---|---|
| `/cad-agile [--brief <design folder>]` | The path's one command. With no release open, `--brief` asks what the project's setup leaves open, turns a Seldon design into a release with its epics, and commits it. With one open, refines its next epic with you: what's hard to undo is asked, and the stories are written once you approve them. Otherwise names its next step. |

## Build spine (the core loop)
A phase travels new-project -> context -> plan -> execute -> verify.

| Command | What it does |
|---|---|
| `/cad-new-project` | Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, phased ROADMAP.md, `.planning/` state. `--brief <design folder>` starts the project from a Seldon design's requirements and epics and asks nothing the design answers. |
| `/cad-adopt` | Initialize `.planning/` from a repo that already exists - PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the code and the git history. |
| `/cad-context [N]` | Gather a phase's context before planning - assumptions, locked decisions, falsifiable acceptance criteria. Optional. |
| `/cad-plan [N]` | Create an executable PLAN.md (planner subagent, optional check gate, fires the plan review). |
| `/cad-map` | Build or refresh the code map the planner reads. Runs only with `planning.code_map` on, and starts nothing until a typed yes. |
| `/cad-execute [N]` | Execute a phase's plans - one executor per plan, atomic commit per task, slim SUMMARY. |
| `/cad-verify [N]` | Conversational UAT for a completed phase (persistent checklist; `--sweep` cross-phase, `--deep` goal-backward). |
| `/cad-progress` | Where the project stands and what is next - derived from files and git; offers to resume incomplete or paused work (`--stats`, `--trace`). |
| `/cad-report [N]` | A phase's run record as receipts - every dispatch priced, every gate's outcome, every refuted assumption (`--all` for the milestone view). |
| `/cad-task <desc>` | A small off-roadmap task with atomic commits (`--plan` for multi-step). |

## Review & quality gates
These run on demand; the automatic reviews are under Capabilities.

| Command | What it does |
|---|---|
| `/cad-plan-review [N\|path]` | On-demand plan review through the `plan` trigger (for hand-written / imported / edited plans). |
| `/cad-decision-review <path>` | On-demand refute-then-adjudicate pass over one load-bearing decision, grounded against the codebase, and against Context7 when its tools are available. |
| `/cad-minimalism-review [path\|dir\|N]` | On-demand ranked delete-list over code that works and should not exist - reinvented stdlib, one-implementation abstractions, dead flexibility, config nobody sets. Applies nothing. |
| `/cad-debug <symptom>` | Scientific-method debugging with `/clear`-persistent state; user-gated consult at dead-ends (`list`/`status`/`continue`/`--diagnose`). |
| `/cad-coverage [N]` | Find requirements with zero failing-capable test coverage, then generate tests in the project's framework. |
| `/cad-docs-verify [path]` | Verify doc claims (paths, commands, symbols, config) against the live code. Reports; never rewrites. |
| `/cad-audit [milestone]` | Pre-ship requirement-traceability FAIL gate - catches silently-dropped requirements. |

## Lifecycle & git
| Command | What it does |
|---|---|
| `/cad-land [base]` | Publish - report git state plus the tracker (which issues this branch's commits reference, which are still open; reads only, closes nothing; `git.issue_check: false` turns it off), ask the mechanism with NO default (push / MR-PR / tag / leave local), do exactly that. With `git.auto_close` true in both config layers it closes unattended instead (PR -> merge), asking once, before the tag push. Fires no review of its own. |
| `/cad-milestone [ver]` | Version cut - audit, bump, prune completed phases, evolve PROJECT.md, refresh REQUIREMENTS. Folds in cleanup. |
| `/cad-phase <op> [N]` | CRUD phases (`add`/`insert`/`remove`/`edit`) with consistent renumber + reference repair. `add --brief <design folder>` adds a Seldon design's requirements and phases to the project. |
| `/cad-undo <N>` | Roll back a phase's commits from the SUMMARY manifest - dirty guard, `--no-commit` squash, status reset. |

## Support
| Command | What it does |
|---|---|
| `/cad-capture [todo\|seed\|note] <text> [--cadence]` | Park a phase-linked todo, a backlog seed, or a note without derailing. `--cadence` sends it to Cadence's own queue instead, for friction with Cadence noticed on another project. |
| `/cad-config [--walk \| --review \| --surfaces \| --testing \| --roles [--global] \| key=value \| a sentence]` | Configure the config. The opt-in menu is off by default; `/cad-config workflow.config_menu=true` turns it on. With it on, no argument opens six groups with counts, and a sentence (`make reviews cheaper`) shows each matching setting's current value, new value and file and writes after a yes. With it off, no argument opens the walk. `--walk` walks the settings the walk carries. `--review` sets up review providers with model detection. `--surfaces` re-opens the risk-surface question. `--testing` accepts or reopens the testing policy, then asks whether verification may publish. `--roles` sets a model and a start rung per role, then the risk floor, writing repo diffs, or the user-global layer with `--global`. |
| `/cad-help [command]` | This reference (a command name shows just that entry). |
| `/cad-pause [note]` | Pause cleanly - WIP commit + cursor set to paused with a resume pointer. Resume via `/cad-progress`. |
| `/cad-spike <question>` | Time-boxed risk-first experiment with falsifiable criteria and a verdict. Throwaway code, one SPIKE.md. |
| `/cad-suggest [N]` | The retune the run record supports - each suggestion with its trace evidence and its config key. Applies nothing; no argument spans the whole record. |
| `/cad-health` | Quick structural check that `.planning/` is present, parseable, and consistent. |
| `/cad-why <path>[:<line>]` | Why is this code like this - a git-log chain over one file (or file and line), joined to the phase, task, decision, deviation and review record on disk. Read-only. |

## Capabilities (not standalone skills)
- **Adversarial review** - references/review-triggers.md. Fires at plan / diff /
  risk_surface / phase_diff; claude-subagent by default, OpenAI, Gemini or
  DeepSeek via `/cad-config --review`.
- **Consult** - references/consult.md. User-gated second-model help at dead-ends,
  offered by cad-debug, cad-execute (structural stop), cad-plan (phase too big).

## Help and bug reports
Questions: #cadence on the jcrenshaw.dev Discord, https://jcrenshaw.dev/discord.
Bugs: https://github.com/crenshawdev/cadence/issues.
