# Cadence

[![test](https://git.jcrenshaw.dev/crenshawdev/cadence/badges/workflows/test.yml/badge.svg)](https://git.jcrenshaw.dev/crenshawdev/cadence/actions?workflow=test.yml)

The failure that costs you is the one that looks like success: generated code that is present, plausible, and wired to nothing. Cadence is a planning and execution system for Claude Code built around refusing to let that pass. It runs one loop, plan then build then verify, and a check that did not run never reads as a check that passed.

## Install

Cadence is a Claude Code plugin. Add the marketplace, then install:

```
/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git
/plugin install cadence@cadence
```

Update with `/plugin update cadence@cadence`, remove with `/plugin uninstall cadence@cadence`. Requires Claude Code with plugin support, plus `node` and `git` on your PATH. The scripts inside are zero-dependency: there is no npm install, ever.

## What it costs you

Cadence is slower than not using Cadence. It makes you gather context before you plan and plan before you build, it stops you at gates you did not ask for, and it says no to things you did ask for. Most of it is not configurable, because most of it is not a preference.

That trade pays off when the code has to keep working. When somebody maintains it later, when it touches money or auth or user data, when a quiet failure costs you more than the extra twenty minutes cost you. If you are sketching something you will throw away Thursday, the ceremony is pure friction and you should skip it. Nobody needs a blocking review gate on a script that renames photos.

## How it works

Cadence assumes the model will fail. Not that it is bad at the job, that it will now and then hand you something that looks finished and is not, and that you will not always catch it by reading. Everything else follows from that assumption, the same way it would for anything you cannot fully trust. Keep the state somewhere durable. Make the workers disposable. Put the rails where the worker cannot argue with them. Never let a check that did not run look like one that passed.

Nothing important lives in the conversation. The roadmap, the per-phase plan, the summary, the verification checklist, the four-line state cursor, all of it sits in `.planning/` and in git history, and the working window carries almost nothing a file does not already hold. Clear at any phase boundary and the next command rebuilds what it needs from disk. The subagents are disposable on purpose. There is no resume and no continue-where-you-left-off, a continuation is a fresh spawn that reads the prior artifact off disk and picks up from the task table it finds there. That one decision is what everything else rests on.

A check that could not run never passes a gate. A reviewer that failed says why out loud instead of quietly dropping out of the set. The verifier scores every claim as verified, failed, or uncertain, and uncertain counts toward neither side, so ambiguity cannot launder itself into a pass. A test file that exists proves nothing and a named test that passes proves one thing, which is why the coverage audit reads the assertions instead of counting files. A test that would still pass if the behavior were wrong is not coverage.

The git rails are a PreToolUse hook, not a paragraph of instructions. A model will talk itself around a paragraph. It will not talk itself around a hook. Every push it tries to run stops and asks you first.

I learned the shape of that one the hard way. I wanted an opt-in autonomous close that could open a PR and merge it without me sitting there, and that needs exactly one push to publish the branch. I taught the guard to recognize a safe push and wave it through, a predicate called `isPlainPush`, very clever. Four rounds of adversarial review found four ways around it. A `-c core.sshCommand=` prefix turns a push into arbitrary command execution, an environment prefix does the same, and I was going to be patching that parser until one of us died. I deleted it instead. The one sanctioned push now runs through a separate subprocess the hook never sees, built from an argument vector instead of a shell string, and every push the hook can see still asks. Do not try to out-parse an attacker, delete the thing you would have had to parse.

That rule is about one direction of reading. Reading a command to decide whether to ALLOW it means being right, and one shape you did not think of is a bypass. Reading a command to decide whether to ASK about it is the opposite bet: the worst case is a prompt you did not need. I used that distinction to justify building a shell tokenizer, and then spent two milestones learning that a bet you are allowed to lose is not the same as a bet that is cheap to lose. Every review round found another way past it, every patch bought more grammar, and the finished thing could be switched off entirely by a long enough command line, in a hook that fails open. So v2.2.0 deleted 2,251 lines of it. What the guard reads now is eighty-five lines: a command counts if it starts with the word `git`. `bash -c "git push"` is invisible, and that is written down rather than discovered. It still refuses to decide that anything is safe.

Every gate hands the work to a reviewer whose job is to break it, not to bless it. The default is a fresh-context Claude subagent and needs no API key at all. Give it an OpenAI, Gemini, or DeepSeek key and the identical job runs as a direct API call. OpenAI and Gemini enforce the output schema themselves; DeepSeek has no server-side schema, so its adapter puts the schema in the prompt and asserts the shape of what comes back. Either way the answer arrives in the schema, which lets you put up to four independent voices on one plan and have your main session adjudicate, opening the cited code and killing the false positives. Every backend returns the same shape, and that part is deliberate. The adjudicator cannot tell which finding came from the free local reviewer and which came from the one you are paying for, and it cannot discount a finding for being cheap. The single signal treated as strong is convergence. Two reviewers landing on the same defect independently is the whole reason to pay for a second voice. What survives adjudication comes back as a numbered list you triage, not a queue the model starts working through, and the default is none of it. That triage is a multi-select prompt you tap. It used to be a paragraph asking you to answer in prose, which meant every review ended in a wall of findings to read and a sentence to compose, and the gate that exists to keep you in control was the most tiring part of using the thing.

[`METHOD.md`](./METHOD.md) is the full account of what the planner, executor, verifier, and reviewers actually do and where each rule is enforced. [`INTERNALS.md`](./INTERNALS.md) is the mechanism underneath: routing (one question about what a break costs, four knobs out - model, effort rung, review gates, deep verify), the publish seam, live provider detection, and why the decision cores are pure functions. [`docs/WORKFLOW.md`](./docs/WORKFLOW.md) is the same material as a diagram: five figures and the four tables behind them. [`docs/EVIDENCE.md`](./docs/EVIDENCE.md) defines the three weight terms — what a command loads in turn one, what it may reach at a step, what a dispatch carries into a fresh context — and gives the `weight.mjs` commands that print the current numbers for whatever tree you have checked out. [`docs/COST.md`](./docs/COST.md) is what a run costs on my own account, measured rather than estimated, and the structural work behind those numbers.

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

## A worked example

Say you're starting a small CLI tool. You run `/cad-new-project` and answer the questions, what it is, why it exists, who it's for, what done looks like. Cadence writes `PROJECT.md`, `REQUIREMENTS.md`, and a phased `ROADMAP.md` into `.planning/`, and sets a state cursor at phase 1. Nothing is in the conversation that isn't also on disk.

Then you work one phase at a time:

```
/cad-context 1     # lock the decisions and acceptance criteria for phase 1
/cad-plan 1        # turn phase 1 into a checkable PLAN.md; the plan review fires here
/cad-execute 1     # build it, one atomic commit per task
/cad-verify 1      # confirm phase 1 delivered what it promised, recorded in UAT.md
```

Between commands you `/clear`, every one, not just the phase boundaries. The window empties and you lose nothing, because each command reads `.planning/` and git back into context, and a window carried across commands is spend without information. Even a review still in flight survives the cut: an advisory reviewer writes its own findings file and its own trace line, so the session that fired it can end freely. The first external project run went through the whole cycle one command per session. Run `/cad-progress` after a clear and it tells you that phase 1 is verified and phase 2 is next, then you plan phase 2 the same way. When you hit a wall mid-build, `/cad-debug` runs the scientific method with hypotheses that survive a clear, and `/cad-capture` parks a stray todo or idea without derailing the phase you're in.

When the phases that make up a release are done, `/cad-milestone` audits that nothing was silently dropped, bumps the version, prunes the completed phases from the live roadmap, and evolves the docs for the next cycle. It also reads the run record back at you: `/cad-suggest` turns the milestone's own trace into evidence-backed retune suggestions, a gate whose fires kept coming back empty, a role that never needed its escalation, each named with its config key, the value in force, the direction to move it and the target value where the record can price one, and it ends by offering to route the tweaks you accept to `/cad-config` rather than writing any of them itself. To publish, `/cad-land` asks how you want to ship, push, MR or PR, tag, or leave it local, with no preselected default, and does exactly that. Before it asks, it names the issues this branch's commits reference and which of them are still open on the host your origin points at, so you decide to ship knowing what the work did and did not answer; it closes nothing, and `git.issue_check: false` turns the report off.

That's the whole shape of it: define once, then loop `context -> plan -> execute -> verify` per phase, clearing aggressively, until the milestone is ready to cut.

## The commands

Everything is a `/cad-*` command. `/cad-help` prints the full reference, `/cad-help <name>` shows one entry.

**Review & quality**
- **`/cad-plan-review`** — adversarial review of a plan before any code is written.
- **`/cad-decision-review`** — stress-test one load-bearing decision, grounded against live docs and the real repo.
- **`/cad-minimalism-review`** — a ranked delete-list over code that works and should not exist: reinvented stdlib, an abstraction with one implementation, flexibility nothing exercises, config nobody sets. It applies none of it.
- **`/cad-audit`** — pre-ship traceability: every requirement traced to a phase, a plan, a verification, and every acceptance criterion traced to the check that tested it. Catches silently-dropped work.
- **`/cad-coverage`** — find a phase's requirements that have zero failing-capable test coverage, then close the gaps.
- **`/cad-docs-verify`** — check factual claims in docs against the live codebase.
- **`/cad-debug`** — systematic debugging with hypotheses that survive `/clear`.

**Lifecycle & git**
- **`/cad-milestone`** — close a release: audit nothing was dropped, bump the version, prune completed phases, evolve the docs (the tag is cut by `/cad-land` after the merge).
- **`/cad-land`** — publish finished work, asking how (push / MR or PR / tag / leave local) with no preselected default, after naming the issues this branch's commits reference and which are still open (`git.issue_check: false` turns that off).
- **`/cad-phase`** — add, insert, remove, or renumber phases, fixing every reference in one pass.
- **`/cad-undo`** — safely roll back a phase's commits from its summary manifest.
- **`/cad-pause`** — stop cleanly with a WIP commit and a resume pointer.

**Support**
- **`/cad-adopt`** — bring a repo that already has code and history into Cadence, deriving `PROJECT.md`, `REQUIREMENTS.md` and a remaining-work `ROADMAP.md` from what is already there.
- **`/cad-config`** — the `stakes` level, workflow toggles, model routing, review gates and providers, parallelism, consult. `/cad-config` walks every switch; `key=value` sets one directly, as in `/cad-config stakes=shipped`.
- **`/cad-capture`** — a phase-linked todo or a seed idea, captured without losing your place. `--cadence` routes friction with Cadence itself to Cadence's own queue, so it leaves the project you noticed it in.
- **`/cad-spike`** — a time-boxed experiment to resolve one unknown before you bet on it.
- **`/cad-task`** — a small off-roadmap task with atomic commits.
- **`/cad-report`** — the run record as receipts: what each dispatch cost, what the gates caught, what got refuted. The trace prices every subagent Cadence runs; this is where you read the bill.
- **`/cad-suggest`** — the same record read as a retune: each tweak names its config key, the value in force, a direction and a target where the record can price one, and the run ends by offering to route the ones you accept to `/cad-config`.
- **`/cad-health`** — a quick planning-health check.
- **`/cad-help`** — the command reference.

## Where it came from

Cadence descends from [GSD](https://github.com/open-gsd/gsd-core), the discuss/plan/execute/verify loop, which is where I first ran into it. GSD gets the hard thing right and then buries it. Seventy-one skills, thirty-four agents, forty-six capabilities underneath those, and one-point-one million words of documentation wrapped around a four-step idea, which is an elephant being a mouse built to government standards. I kept the loop and threw out the standards. Cadence carries about 3% of GSD's documentary mass, measured 2026-07-10 against GSD commit d010ea1. Today it is 27 skills and 6 agent roles across 19 rung files.

Every one of those cuts was made by hand and written down. [`DESIGN.md`](./DESIGN.md) numbers the locked decisions and the reversals, [`INTERNALS.md`](./INTERNALS.md) walks the handful that took more than one try to get right, [`LINEAGE.md`](./LINEAGE.md) publishes the counts and tells you how to reproduce them, and [`MANIFESTO.md`](./MANIFESTO.md) is the why. CI fails the build when the prose drifts from the code, because every config key, script flag, and file path named in these docs has to actually exist. There is nothing in here that nobody read.

Cadence is a derivative work of GSD by Open GSD, used under the MIT License. The original copyright is retained in [`LICENSE`](./LICENSE) and the lineage is spelled out in [`NOTICE`](./NOTICE.md). Cadence is maintained by John Crenshaw and distributed under the MIT License.
