# Cadence

The failure that costs you is the one that looks like success: generated code that is present, plausible, and wired to nothing. Cadence is a planning and execution system for Claude Code built around refusing to let that pass. It runs one loop, plan then build then verify, and a check that did not run never reads as a check that passed.

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

Every gate hands the work to a reviewer whose job is to break it, not to bless it. The default is a fresh-context Claude subagent and needs no API key at all. Give it an OpenAI, Gemini, or DeepSeek key and the identical job runs as a direct API call with the provider enforcing the output schema, which lets you put up to four independent voices on one plan and have your main session adjudicate, opening the cited code and killing the false positives. Every backend returns the same shape, and that part is deliberate. The adjudicator cannot tell which finding came from the free local reviewer and which came from the one you are paying for, and it cannot discount a finding for being cheap. The single signal treated as strong is convergence. Two reviewers landing on the same defect independently is the whole reason to pay for a second voice. What survives adjudication comes back as a numbered list you triage, not a queue the model starts working through, and the default is none of it. That triage is a multi-select prompt you tap. It used to be a paragraph asking you to answer in prose, which meant every review ended in a wall of findings to read and a sentence to compose, and the gate that exists to keep you in control was the most tiring part of using the thing.

[`METHOD.md`](./METHOD.md) is the full account of what the planner, executor, verifier, and reviewers actually do and where each rule is enforced. [`INTERNALS.md`](./INTERNALS.md) is the mechanism underneath: routing (one question about what a break costs, four knobs out - model, effort rung, review gates, deep verify), the publish seam, live provider detection, and why the decision cores are pure functions.

## What a break costs

Cadence used to ask how much you wanted a dispatch to cost. It now asks what happens if the work is wrong, which is a question you can actually answer about your own project, and that answer routes everything else. One key sets it:

```
/cad-config stakes=shipped
```

`solo` means nobody else runs this and a break costs you an afternoon. `shipped` means other people run it and a break comes back as a bug report. `critical` means a break is not a bug report.

That one word lands in a grid of 18 cells, one per level and role pair, and the cell is what hands a dispatch its model, the effort rung it starts on, and the rung a failed attempt climbs to. At `solo` the planner runs Sonnet at `high`. At `shipped` it runs Opus. At `critical` it runs Opus at `xhigh` and a retry goes to `max`. The whole thing is `cadence-core/route-table.json` and you can read it in one screen, which was the point of getting rid of the old indirection where a field named after what you wanted to spend quietly decided which model you got.

The rungs are `low`, `medium`, `high`, `xhigh`, `max`. Effort is not a per-dispatch parameter, it is fixed in an agent file's frontmatter, so a rung is a real file on disk and self-verify fails in both directions, on a cell naming a rung with no file and on a rung file no cell reaches.

Escalation is one key, `model.escalate_on_failure`, on by default. A failed attempt gets re-dispatched at the retry rung its own cell names rather than retried at the rung that just failed it. Set it false and the retry holds where it started.

Reviews resolve off the same level. Each trigger gets a gate, `off`, `advisory`, `blocking`, or `adjudicated`, so a plan review is advisory at `solo` and adjudicated at `shipped` and `critical`. The `risk_surface` trigger is blocking at every level including `solo`, on purpose, because the eight surfaces it watches are auth, billing, secrets, migrations, destructive operations, concurrency, API contracts, and untrusted input, and none of those care how casual your project is.

Which is also the floor. Cadence reads the paths a phase's plan declares, and a match on one of those surfaces raises that phase's level by itself, you do not have to remember to do it. You can waive one surface at a time with `risk.override.<surface>`, and only in the repo's own config, because a single line in a global config should not be able to disable the floor in every project on the machine. A waiver sitting in the global layer is ignored and says so in the warnings.

Deep verification follows the level too, off at `solo` and on at `shipped` and `critical`.

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

`/cad-progress` tells you where you stand and what's next at any point, and auto-resumes incomplete work.

## A worked example

Say you're starting a small CLI tool. You run `/cad-new-project` and answer the questions, what it is, why it exists, who it's for, what done looks like. Cadence writes `PROJECT.md`, `REQUIREMENTS.md`, and a phased `ROADMAP.md` into `.planning/`, and sets a state cursor at phase 1. Nothing is in the conversation that isn't also on disk.

Then you work one phase at a time:

```
/cad-context 1     # lock the decisions and acceptance criteria for phase 1
/cad-plan 1        # turn phase 1 into a checkable PLAN.md; the plan review fires here
/cad-execute 1     # build it, one atomic commit per task
/cad-verify 1      # confirm phase 1 delivered what it promised, recorded in UAT.md
```

Between phases you `/clear`. The window empties and you lose nothing, because the next command reads `.planning/` and git back into context. Run `/cad-progress` after a clear and it tells you that phase 1 is verified and phase 2 is next, then you plan phase 2 the same way. When you hit a wall mid-build, `/cad-debug` runs the scientific method with hypotheses that survive a clear, and `/cad-capture` parks a stray todo or idea without derailing the phase you're in.

When the phases that make up a release are done, `/cad-milestone` audits that nothing was silently dropped, tags the release, prunes the completed phases from the live roadmap, and evolves the docs for the next cycle. To publish, `/cad-land` asks how you want to ship, push, MR or PR, tag, or leave it local, with no preselected default, and does exactly that.

That's the whole shape of it: define once, then loop `context -> plan -> execute -> verify` per phase, clearing aggressively, until the milestone is ready to cut.

## The commands

Everything is a `/cad-*` command. `/cad-help` prints the full reference, `/cad-help <name>` shows one entry.

**Review & quality**
- **`/cad-plan-review`** — adversarial review of a plan before any code is written.
- **`/cad-decision-review`** — stress-test one load-bearing decision, grounded against live docs and the real repo.
- **`/cad-audit`** — pre-ship traceability: every requirement traced to a phase, a plan, a verification, and every acceptance criterion traced to the check that tested it. Catches silently-dropped work.
- **`/cad-coverage`** — find a phase's requirements that have zero failing-capable test coverage, then close the gaps.
- **`/cad-docs-verify`** — check factual claims in docs against the live codebase.
- **`/cad-debug`** — systematic debugging with hypotheses that survive `/clear`.

**Lifecycle & git**
- **`/cad-milestone`** — cut a release: audit nothing was dropped, tag, prune completed phases, evolve the docs.
- **`/cad-land`** — publish finished work, asking how (push / MR or PR / tag / leave local) with no preselected default.
- **`/cad-phase`** — add, insert, remove, or renumber phases, fixing every reference in one pass.
- **`/cad-undo`** — safely roll back a phase's commits from its summary manifest.
- **`/cad-pause`** — stop cleanly with a WIP commit and a resume pointer.

**Support**
- **`/cad-config`** — the `stakes` level, workflow toggles, model routing, review gates and providers, parallelism, consult. `/cad-config` walks every switch; `key=value` sets one directly, as in `/cad-config stakes=shipped`.
- **`/cad-capture`** — a phase-linked todo or a seed idea, captured without losing your place.
- **`/cad-spike`** — a time-boxed experiment to resolve one unknown before you bet on it.
- **`/cad-task`** — a small off-roadmap task with atomic commits.
- **`/cad-health`** — a quick planning-health check.
- **`/cad-help`** — the command reference.

## What it costs to run

Most of what makes AI-assisted development expensive is not the model, it is the mess. Context piles up, the same files get read again and again, the conversation drags a week of history into every single turn, and the bill follows the clutter. Keeping durable state on disk and doing the heavy reading in a fresh subagent that hands back an answer instead of a file is the fix for that, and it shows up in what a unit of work costs rather than in a cache statistic.

These are measurements of my own real usage, taken from my account's usage data, not telemetry the tool collects. Cadence ships no instrumentation and phones nothing home. Measured 2026-07-26 across 7,548 requests, 2,845 of them Cadence. A request on the main thread inside a Cadence project carries about 92k of context and costs about 28 cents. The main thread on my freeform work, same machine, same models, same me, carries about 133k and costs about 36 cents. Cadence also routes about 27% of its subagent work to Sonnet and Haiku where the job does not need Opus, against about 8% on my freeform work.

Read that carefully, because it is a comparison between two piles of my own sessions and not a controlled experiment. I reach for Cadence on the big multi-phase jobs, so a Cadence session is usually a heavier session overall. The claim is not that your bill goes down. It is that each turn drags less history behind it, and you stop paying full freight to re-read your own conversation.

v2.3.0 went at that structurally instead of by measurement, after a month of usage data showed the ratio the numbers above only imply: about 108k of resident context per assistant turn against 565 tokens of output, with cache reads alone at 62.7% of the bill. When cost is context multiplied by turns, thinking harder is nearly free and carrying less is where the money is. Three things decide what a turn carries, and all three moved. What the twelve main commands load in turn one, before they do anything, went from 231,422 bytes to 199,687, and the two carrying the most dropped hardest: `/cad-pause` from 18,523 to 8,197, `/cad-land` from 36,235 to 31,016. A subagent's full output no longer stays resident in the context that dispatched it, it writes a file and the parent keeps a five-field digest. And the skill and agent descriptions, which ride the system prompt of every session in every project whether or not you ever run a Cadence command, went from 8,550 bytes to 5,397.

Two honest notes on that. The plugin's own weighed total went up over the same stretch, because moving a rule out of a shared reference and into the workflow that actually uses it puts those bytes on a measured surface for the first time. The win is in what a turn loads, not in what the repository weighs, and reporting the second number as the headline would have hidden the first. And five of the twelve commands ended up slightly heavier, because their workflow files grew when guidance moved inline, which a forty-byte description cut was never going to pay for. Both are recorded in the phase record rather than netted away.

## Where it came from

Cadence descends from [GSD](https://github.com/open-gsd/gsd-core), the discuss/plan/execute/verify loop, which is where I first ran into it. GSD gets the hard thing right and then buries it. Seventy-one skills, thirty-four agents, forty-six capabilities underneath those, and one-point-one million words of documentation wrapped around a four-step idea, which is an elephant being a mouse built to government standards. I kept the loop and threw out the standards. Cadence carries about 3% of GSD's documentary mass, measured 2026-07-10 against GSD commit d010ea1. Today it is 23 skills and 6 agent roles across 19 rung files.

Every one of those cuts was made by hand and written down. [`DESIGN.md`](./DESIGN.md) numbers the locked decisions and the reversals, [`INTERNALS.md`](./INTERNALS.md) walks the handful that took more than one try to get right, [`LINEAGE.md`](./LINEAGE.md) publishes the counts and tells you how to reproduce them, and [`MANIFESTO.md`](./MANIFESTO.md) is the why. CI fails the build when the prose drifts from the code, because every config key, script flag, and file path named in these docs has to actually exist. There is nothing in here that nobody read.

Cadence is a derivative work of GSD by Open GSD, used under the MIT License. The original copyright is retained in [`LICENSE`](./LICENSE) and the lineage is spelled out in [`NOTICE`](./NOTICE.md). Cadence is maintained by John Crenshaw and distributed under the MIT License.
