# Cadence

[![test](https://git.jcrenshaw.dev/crenshawdev/cadence/badges/workflows/test.yml/badge.svg)](https://git.jcrenshaw.dev/crenshawdev/cadence/actions?workflow=test.yml)

The failure that costs you is the one that looks like success: generated code that is present, plausible, and wired to nothing. Cadence is a planning and execution system for Claude Code built around refusing to let that pass. It runs one loop, plan then build then verify, and a check that did not run never reads as a check that passed.

## What it asks of you

Cadence is slower than not using Cadence. It makes you gather context before you plan and plan before you build, and then it stops and waits for you: before it plans, at every check it runs, and before it pushes anything. Most of that is not configurable, because most of it is not a preference.

Every one of those stops is a question only you can answer, so the honest test is how often you actually want to be asked. Answering is the work rather than the overhead around it; if you want to describe a feature and come back to a merged PR, this is the wrong tool.

That trade pays off when the code has to keep working. When somebody maintains it later, when it touches money or auth or user data, when a quiet failure costs you more than the extra twenty minutes cost you. If you are sketching something you will throw away Thursday, the ceremony is pure friction and you should skip it. Nobody needs a blocking review on a script that renames photos.

## Install

Cadence is a Claude Code plugin. Add the marketplace, then install:

```
/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git
/plugin install cadence@cadence
```

Update with `/plugin update cadence@cadence`, remove with `/plugin uninstall cadence@cadence`. Requires Claude Code with plugin support, plus `node` and `git` on your PATH. The scripts inside are zero-dependency: there is no npm install, ever.

## The loop

Cadence runs as slash commands namespaced `/cadence:cad-*` (for example `/cadence:cad-new-project`). They are written below without the `cadence:` prefix for brevity. A project moves through five steps, each its own command:

1. **`/cad-new-project`** — define the project through deep questioning: what, why, who, done.
2. **`/cad-context <phase>`** — gather locked decisions and acceptance criteria before planning.
3. **`/cad-plan <phase>`** — turn a phase into an executable, checkable plan.
4. **`/cad-execute <phase>`** — build it, one atomic commit per task.
5. **`/cad-verify <phase>`** — confirm the phase delivered what it promised.

Step 1 has a second door. **`/cad-adopt`** is the entrance for a project that already exists: it reads the repo, the manifests and the git history, writes what the code already does into `PROJECT.md` as shipped work and what is left into a remaining-work `ROADMAP.md`, and asks only what the repo cannot answer. Same `.planning/` on disk either way, so step 2 onward is identical.

Step 1 also takes a shortcut when the questioning already happened somewhere else: **`/cad-new-project --brief <file>`** reads the design brief that conversation produced, treats what it settles as answered, and asks only about what it leaves open. [`docs/DISCOVERY.md`](./docs/DISCOVERY.md) is how you get there from a freeform conversation.

`/cad-progress` tells you where you stand and what's next at any point, and auto-resumes incomplete work.

[![The Cadence phase loop: new-project feeds context, plan, execute and verify in sequence; a decision gate sits under each command, and verify loops back to context for the next phase or exits to milestone.](./docs/figures/phase-loop.svg)](./docs/WORKFLOW.md)

Under each command is a gate, and every gate has a way through and a way out. That is one of five figures. [`docs/WORKFLOW.md`](./docs/WORKFLOW.md) carries the rest, the milestone and land exit, the effort ladder and how a retry climbs it, the command-to-agent map, and the review pipeline, plus the tables the pictures cannot hold: all fifteen decision points with what each branch does, the eighteen-cell stakes grid, and which review trigger fires at which stakes level.

That is five commands out of twenty-seven. `/cad-help` prints the full reference inside a session, and [`cadence-core/references/COMMANDS.md`](./cadence-core/references/COMMANDS.md) is that same reference in the repo, readable before you install anything.

## How it works

Cadence assumes the model will fail. Not that it is bad at the job, that it will now and then hand you something that looks finished and is not, and that you will not always catch it by reading. Everything else follows: keep the state durable, make the workers disposable, and put the rails where the worker cannot argue with them.

Nothing important lives in the conversation. The roadmap, the plans, the summaries, the verification checklist and the state cursor all sit in `.planning/` and in git history, and every command rebuilds what it needs from disk. Clear the window at any phase boundary and you lose nothing; there is no resume, and a continuation is a fresh spawn that reads the prior artifact off disk. Every one of those spawns lands in the run record, and `/cad-report` reads it back as receipts: what each dispatch cost, what the gates caught, what got refuted. The trace prices every subagent Cadence runs, and that is where you read the bill.

A check that could not run never passes a gate. A reviewer that failed says why out loud instead of quietly dropping out of the set. The verifier scores every claim as verified, failed, or uncertain, and uncertain counts toward neither side, so ambiguity cannot launder itself into a pass. A test that would still pass if the behavior were wrong is not coverage, which is why the coverage audit reads the assertions instead of counting files. `/cad-audit` points that refusal at a whole release before it ships: every requirement traced to a phase, a plan and a verification, every acceptance criterion to the check that tested it, which is how silently-dropped work gets caught while it can still be fixed.

The git rails are a PreToolUse hook, not a paragraph of instructions. A model will talk itself around a paragraph. It will not talk itself around a hook. Every push it tries to run stops and asks you first.

That shape was expensive to learn. Twice I tried to read a command well enough to wave a safe one through, first a predicate called `isPlainPush` and then a shell tokenizer that took two milestones and 2,251 deleted lines to give up on, and every round of adversarial review found another prefix past it, in a hook that fails open. Both are gone. The one sanctioned push runs through a subprocess the hook never sees, built from an argument vector rather than a shell string, and what the guard reads is eighty-five lines: a command counts if it starts with the word `git`. `bash -c "git push"` is invisible, and that is written down rather than discovered. Do not try to out-parse an attacker, delete the thing you would have had to parse.

Every gate hands the work to a reviewer whose job is to break it, not to bless it. The default is a fresh-context Claude subagent and needs no API key; an OpenAI, Gemini, or DeepSeek key runs the identical job as a direct API call, so you can put up to four independent voices on one plan and have your main session adjudicate against the cited code. That every backend returns the same shape is deliberate: the adjudicator cannot tell which finding came from the free local reviewer and which from the one you are paying for, so it cannot discount a finding for being cheap. The one signal treated as strong is convergence, because two reviewers landing on the same defect independently is the whole reason to pay for a second voice. What survives comes back as a numbered list you tap through, not a queue the model starts working through, and the default is none of it. `/cad-minimalism-review` turns the same posture on code that works and should not exist - an abstraction with one implementation, flexibility nothing exercises, config nobody sets - and hands back a ranked delete-list. It applies none of it.

[`METHOD.md`](./METHOD.md) is the full account of what the planner, executor, verifier and reviewers do and where each rule is enforced. [`INTERNALS.md`](./INTERNALS.md) is the mechanism underneath: routing, the publish seam, and why the decision cores are pure functions. [`docs/WORKFLOW.md`](./docs/WORKFLOW.md) is the same material as a diagram, five figures and the four tables behind them. [`docs/EVIDENCE.md`](./docs/EVIDENCE.md) defines the three weight terms and gives the `weight.mjs` commands that print the current numbers for any tree. [`docs/COST.md`](./docs/COST.md) is what a run costs on my own account. [`docs/EXAMPLE.md`](./docs/EXAMPLE.md) walks one small project through the whole cycle.

## What a break costs

Cadence used to ask how much you wanted a dispatch to cost. It now asks what happens if the work is wrong, which is a question you can actually answer about your own project, and that answer routes everything else. One key sets it:

```
/cad-config stakes=shipped
```

`solo` means nobody else runs this and a break costs you an afternoon. `shipped` means other people run it and a break comes back as a bug report. `critical` means a break is not a bug report.

That one word lands in a grid of 18 cells, one per level and role pair, and the cell is what hands a dispatch its model, the effort rung it starts on, and the rung a failed attempt climbs to. At `solo` the planner runs Sonnet at `high`. At `shipped` it runs Opus. At `critical` it runs Opus at `xhigh` and a retry goes to `max`. The whole thing is `cadence-core/route-table.json` and you can read it in one screen, which was the point of getting rid of the old indirection where a field named after what you wanted to spend quietly decided which model you got.

The rungs are `low`, `medium`, `high`, `xhigh`, `max`. Effort is not a per-dispatch parameter, it is fixed in an agent file's frontmatter, so a rung is a real file on disk and self-verify fails in both directions, on a cell naming a rung with no file and on a rung file no cell reaches.

Escalation is one key, `model.escalate_on_failure`, off by default: a retry holds the rung it started on, because a retry is usually a narrower job than the pass that failed it. Set it true and a failed attempt gets re-dispatched at the retry rung its own cell names.

Reviews resolve off the same level. Each trigger gets a gate, `off`, `advisory`, `blocking`, or `adjudicated`, so a plan review is advisory at `solo`, blocking at `shipped` because a plan is the cheapest artifact in the pipeline to halt on, and adjudicated at `critical`. The `risk_surface` trigger is blocking at every level including `solo`, on purpose, because the eight surfaces it watches are auth, billing, secrets, migrations, destructive operations, concurrency, API contracts, and untrusted input, and none of those care how casual your project is. That list is yours to narrow as of v3.2.0: `review.triggers.risk_surface.surfaces` names the subset your project actually contains, populated from a structural scan of manifests and directories rather than keyword greps, and leaving it unset keeps all eight so nobody's coverage shrinks on upgrade.

Cadence checks that list against the diff itself - once per plan, on the completed commit range - and fires a blocking review when the code actually touches one of them. As of v3.5.0 that check is a seam rather than an instruction: `planning.mjs risk-check run` answers a resolved commit range with what it checked, what it matched, and whether it could judge the range at all, and it writes that record to the run trace on every invocation, including the ones that match nothing. That last part is the whole point. A gate that only leaves bytes behind when it fires leaves a skipped check and a clean one looking identical, so a plan or task now cannot report done until the record exists, and `inconclusive` is a real third answer for a binary file or a submodule bump rather than something quietly folded into "clean". Detection itself is still heuristic and does not claim otherwise; what changed is that whether it ran is a fact you can read instead of an absence you have to trust. It used to also check it at dispatch time against the file NAMES a plan declared, and raise the whole phase on a match. A test file called `ingest_concurrency.rs` was enough to put six roles on their top rung for the rest of the phase, so that detector is gone as of v2.7.0. What the code does decides; what the file is called does not.

Deep verification follows the level too, off at `solo` and on at `shipped` and `critical`.

## Where it came from

Cadence descends from [GSD](https://github.com/open-gsd/gsd-core), the discuss/plan/execute/verify loop, which is where I first ran into it. GSD gets the hard thing right and then buries it. Seventy-one skills, thirty-four agents, forty-six capabilities underneath those, and one-point-one million words of documentation wrapped around a four-step idea, which is an elephant being a mouse built to government standards. I kept the loop and threw out the standards. Cadence carries about 3% of GSD's documentary mass, measured 2026-07-10 against GSD commit d010ea1. Today it is 27 skills and 6 agent roles across 19 rung files.

Every one of those cuts was made by hand and written down. [`DESIGN.md`](./DESIGN.md) numbers the locked decisions and the reversals, [`INTERNALS.md`](./INTERNALS.md) walks the handful that took more than one try to get right, [`LINEAGE.md`](./LINEAGE.md) publishes the counts and tells you how to reproduce them, and [`MANIFESTO.md`](./MANIFESTO.md) is the why. CI fails the build when the prose drifts from the code, because every config key, script flag, and file path named in these docs has to actually exist. There is nothing in here that nobody read.

Cadence is a derivative work of GSD by Open GSD, used under the MIT License. The original copyright is retained in [`LICENSE`](./LICENSE) and the lineage is spelled out in [`NOTICE`](./NOTICE.md). Cadence is maintained by John Crenshaw and distributed under the MIT License.
