# Cadence commands

Every Cadence skill, by cluster: the build loop plus the gates, lifecycle, and
support around it. Invoke as `/cad-<name>`.

## Build spine (the core loop)
The path a phase travels, new-project -> context -> plan -> execute -> verify,
with progress and task alongside.

| Command | What it does |
|---|---|
| `/cad-new-project` | Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, phased ROADMAP.md, `.planning/` state. |
| `/cad-context [N]` | Gather a phase's context before planning - assumptions, locked decisions, falsifiable acceptance criteria. Optional. |
| `/cad-plan [N]` | Create an executable PLAN.md (planner subagent, optional check gate, fires the plan review). |
| `/cad-execute [N]` | Execute a phase's plans - one executor per plan, atomic commit per task, slim SUMMARY. |
| `/cad-verify [N]` | Conversational UAT for a completed phase (persistent checklist; `--sweep` cross-phase, `--deep` goal-backward). |
| `/cad-progress` | Where the project stands and what is next - derived from files and git, auto-resumes paused work (`--stats`). |
| `/cad-task <desc>` | A small off-roadmap task with atomic commits (`--plan` for multi-step). |

## Review & quality gates
The adversarial-review subsystem (references/review-triggers.md) fires
automatically at the plan / diff / risk_surface / pre_ship triggers; these skills
are the on-demand and standalone gates.

| Command | What it does |
|---|---|
| `/cad-plan-review [N\|path]` | On-demand plan review through the `plan` trigger (for hand-written / imported / edited plans). |
| `/cad-debug <symptom>` | Scientific-method debugging with `/clear`-persistent state; user-gated consult at dead-ends (`list`/`status`/`continue`/`--diagnose`). |
| `/cad-coverage [N]` | Find requirements with zero failing-capable test coverage, then generate tests in the project's framework. |
| `/cad-docs-verify [path]` | Verify doc claims (paths, commands, symbols, config) against the live code. Reports; never rewrites. |
| `/cad-audit [milestone]` | Pre-ship requirement-traceability FAIL gate - catches silently-dropped requirements. |

## Lifecycle & git
| Command | What it does |
|---|---|
| `/cad-land [base]` | Publish - report git state, fire `pre_ship`, ask the mechanism with NO default (push / MR-PR / tag / leave local), do exactly that. |
| `/cad-milestone [ver]` | Version cut - audit-gate, tag, prune completed phases, evolve PROJECT.md, refresh REQUIREMENTS. Folds in cleanup. |
| `/cad-phase <op> [N]` | CRUD phases (`add`/`insert`/`remove`/`edit`) with consistent renumber + reference repair. |
| `/cad-undo <N>` | Roll back a phase's commits from the SUMMARY manifest - dirty guard, `--no-commit` squash, status reset. |

## Support
| Command | What it does |
|---|---|
| `/cad-capture [todo\|seed\|note] <text>` | Park a phase-linked todo, a backlog seed, or a note without derailing. |
| `/cad-config [--review \| key=value]` | Configure the ~22-key config; interactive cross-model review-provider setup + model detection. |
| `/cad-help [command]` | This reference (a command name shows just that entry). |
| `/cad-pause [note]` | Pause cleanly - WIP commit + cursor set to paused with a resume pointer. Resume via `/cad-progress`. |
| `/cad-spike <question>` | Time-boxed risk-first experiment with falsifiable criteria and a verdict. Throwaway code, one SPIKE.md. |
| `/cad-health` | Quick structural check that `.planning/` is present, parseable, and consistent. |

## Capabilities (not standalone skills)
- **Adversarial review** - references/review-triggers.md. Fires at plan / diff /
  risk_surface / pre_ship; claude-subagent by default, OpenAI/Gemini when
  configured (`/cad-config --review`).
- **Consult** - references/consult.md. User-gated second-model help at dead-ends,
  offered by cad-debug, cad-execute (structural stop), cad-plan (phase too big).
