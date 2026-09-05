# Cadence commands

Every Cadence skill, by cluster: the build loop plus the gates, lifecycle, and
support around it. Invoke as `/cad-<name>`.

## Build spine (the core loop)
The path a phase travels, new-project -> context -> plan -> execute -> verify,
with progress and task alongside.

| Command | What it does |
|---|---|
| `/cad-new-project` | Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, phased ROADMAP.md, `.planning/` state. |
| `/cad-adopt` | Initialize `.planning/` from a repo that already exists - PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the code and the git history. |
| `/cad-context [N]` | Gather a phase's context before planning - assumptions, locked decisions, falsifiable acceptance criteria. Optional. |
| `/cad-plan [N]` | Create an executable PLAN.md (planner subagent, optional check gate, fires the plan review). |
| `/cad-execute [N]` | Execute a phase's plans - one executor per plan, atomic commit per task, slim SUMMARY. |
| `/cad-verify [N]` | Conversational UAT for a completed phase (persistent checklist; `--sweep` cross-phase, `--deep` goal-backward). |
| `/cad-progress` | Where the project stands and what is next - derived from files and git; finds incomplete or paused work and offers to resume it (`--stats`). |
| `/cad-report [N]` | A phase's run record as receipts - every dispatch priced, every gate's outcome, every refuted assumption (`--all` for the milestone view). |
| `/cad-task <desc>` | A small off-roadmap task with atomic commits (`--plan` for multi-step). |

## Review & quality gates
The adversarial-review subsystem (references/review-triggers.md) fires
automatically at the plan / diff / risk_surface / phase_diff triggers; these skills
are the on-demand and standalone gates.

| Command | What it does |
|---|---|
| `/cad-plan-review [N\|path]` | On-demand plan review through the `plan` trigger (for hand-written / imported / edited plans). |
| `/cad-decision-review <path>` | On-demand refute-then-adjudicate pass over one load-bearing decision, grounded against Context7 and the codebase. |
| `/cad-minimalism-review [path\|dir\|N]` | On-demand ranked delete-list over code that works and should not exist - reinvented stdlib, one-implementation abstractions, dead flexibility, config nobody sets. Applies nothing. |
| `/cad-debug <symptom>` | Scientific-method debugging with `/clear`-persistent state; user-gated consult at dead-ends (`list`/`status`/`continue`/`--diagnose`). |
| `/cad-coverage [N]` | Find requirements with zero failing-capable test coverage, then generate tests in the project's framework. |
| `/cad-docs-verify [path]` | Verify doc claims (paths, commands, symbols, config) against the live code. Reports; never rewrites. |
| `/cad-audit [milestone]` | Pre-ship requirement-traceability FAIL gate - catches silently-dropped requirements. |

## Lifecycle & git
| Command | What it does |
|---|---|
| `/cad-land [base]` | Publish - report git state plus the tracker (which issues this branch's commits reference, which are still open; reads only, closes nothing; `git.issue_check: false` turns it off), ask the mechanism with NO default (push / MR-PR / tag / leave local), do exactly that. Fires no review of its own. |
| `/cad-milestone [ver]` | Version cut - audit-gate, tag, prune completed phases, evolve PROJECT.md, refresh REQUIREMENTS. Folds in cleanup. |
| `/cad-phase <op> [N]` | CRUD phases (`add`/`insert`/`remove`/`edit`) with consistent renumber + reference repair. |
| `/cad-undo <N>` | Roll back a phase's commits from the SUMMARY manifest - dirty guard, `--no-commit` squash, status reset. |

## Support
| Command | What it does |
|---|---|
| `/cad-capture [todo\|seed\|note] <text> [--cadence]` | Park a phase-linked todo, a backlog seed, or a note without derailing. `--cadence` sends it to Cadence's own queue instead, for friction with Cadence noticed on another project. |
| `/cad-config [--review \| --surfaces \| --roles [--global] \| key=value]` | Configure the config; interactive cross-model review-provider setup + model detection. `--surfaces` re-opens the one-time risk-surface question with the current answer beside what the structure evidences today. `--roles` asks the thirteen questions that say what each role costs - a model and a start rung per role, then the risk floor - writing repo diffs, or the user-global layer with `--global`. |
| `/cad-help [command]` | This reference (a command name shows just that entry). |
| `/cad-pause [note]` | Pause cleanly - WIP commit + cursor set to paused with a resume pointer. Resume via `/cad-progress`. |
| `/cad-spike <question>` | Time-boxed risk-first experiment with falsifiable criteria and a verdict. Throwaway code, one SPIKE.md. |
| `/cad-suggest [N]` | The retune the run record supports - each suggestion with its trace evidence and its config key. Applies nothing; no argument spans the whole record. |
| `/cad-health` | Quick structural check that `.planning/` is present, parseable, and consistent. |
| `/cad-why <path>[:<line>]` | Why is this code like this - a git-log chain over one file (or file and line), joined to the phase, task, decision, deviation and review record on disk. Read-only. |

## Capabilities (not standalone skills)
- **Adversarial review** - references/review-triggers.md. Fires at plan / diff /
  risk_surface / phase_diff; claude-subagent by default, OpenAI/Gemini when
  configured (`/cad-config --review`).
- **Consult** - references/consult.md. User-gated second-model help at dead-ends,
  offered by cad-debug, cad-execute (structural stop), cad-plan (phase too big).
