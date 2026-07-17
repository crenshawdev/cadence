# Cadence internals

The README tells you what Cadence does. This tells you how the parts worth knowing about actually work, the handful of decisions that took more than one try to get right. You don't need to read the source to follow any of it. Every section ends with where the code lives, for when you do.

## Model routing

Cadence hands the heavy work to fresh-context subagents. Which model each one runs on, and how hard it thinks, is the routing problem, and it has a catch worth explaining.

In a plugin built on SKILL.md agents you can override a subagent's model at dispatch time. The resolution order is environment, then the per-invocation parameter, then frontmatter, then the session. You cannot override its reasoning effort. Effort is frozen in the agent's frontmatter when the file is written. I verified that in July 2026 before betting the design on it, because the whole routing story turns on it.

So model is a live lever and effort is not. Cadence sets effort per role, where it belongs. The planner, verifier, reviewer, and assumptions-analyzer run high or xhigh because that is what those jobs need, and the plan-checker runs low because it is a cheap gate. When `auto` decides that cheap gate needs to think harder, it does the one thing SKILL.md actually allows, it swaps to a sibling agent file that carries the higher effort in its own frontmatter, `cad-plan-checker-high`. One variant file, for the one role that needs it, instead of pretending effort is a dial when it isn't.

If you don't want to think about any of that, there are three canned profiles, fast, balanced, and quality, each mapping an agent's tier (light, standard, heavy) to a Claude alias (haiku, sonnet, opus, fable). Aliases, not dated model ids, so the table never rots. `auto` reads the agent's role, which is known and reliable, plus cheap difficulty signals off the phase, how many files it touches and an ambiguity score, bumps the tier by at most one, and on a failed attempt escalates and re-dispatches. The guardrails keep it honest: the bump is capped at one tier, role tiers act as floors so a formatter never gets promoted to opus, your explicit pick always wins, and it records why it escalated instead of doing it behind your back.

One thing people miss: routing governs the subagents Cadence dispatches, not your main session. Cadence cannot set your orchestrator's model or effort, that stays yours to set in Claude Code. Run it on the strongest model at high effort. The context discipline is what makes that affordable, the orchestrator stays lean and reads its own prefix from cache while the expensive file reading happens out in the routed subagents.

Read the code: `cadence-core/bin/route.mjs` (the resolver), `cadence-core/route-table.json` (roles, profiles, and auto signals, all editable data, no code change to retune), `cadence-core/bin/route.test.mjs`. Design record: `DESIGN.md`, "Model routing."

## The push guard, and the parser I didn't write

Cadence guards git with a PreToolUse hook. Every `git push` the model tries to run through Bash stops and asks you first. No exceptions, which is the entire point of it.

Then I wanted an opt-in autonomous close, `auto_close`, that could open a PR and merge it without me sitting there, and on GitHub that needs exactly one push to publish the branch. The obvious move is to teach the guard to recognize a safe push and let that one through. I built it. A predicate called `isPlainPush` that parsed the git command and waved a plain push past the gate.

It does not hold, and it can't. A command-string whitelist is a parser, and a parser standing between an attacker and a shell is a game you lose. `git -c core.sshCommand=...` turns a push into arbitrary command execution. An environment prefix does the same. Redirects, aliases, a bare push with the remote set elsewhere, every round of review turned up another shape that strolled through the gate. Four adversarial risk-surface review rounds, four bypasses.

So I deleted it. The whole predicate, gone, and git-guard went back to asking on every push, unconditionally, with no clever exception to defend. The one sanctioned push now happens somewhere the Bash hook cannot see it, a separate subprocess seam (`git-publish.mjs`) that runs git with an argument vector and never a shell string, with a `--` end-of-options separator and strict validation on the branch and remote names, and it refuses unless the repo opted into `auto_close` and HEAD is a non-protected branch. Every push the hook can see still asks. The only push that skips the ask is the one that never touches the surface the hook watches.

The rule I took out of it: don't try to out-parse an attacker, delete the thing you would have had to parse.

Read the code: `cadence-core/bin/git-guard.mjs` (the hook, now with no push exemption), `cadence-core/bin/git-publish.mjs` (the sanctioned seam), `cadence-core/bin/lib/publish-decision.mjs` (the pure refuse-gate logic), tests in `cadence-core/bin/git-guard.test.mjs` and `cadence-core/bin/git-publish.test.mjs`. Design record: `DESIGN.md`, reversal R2.

## Live model detection

Cross-model review can call OpenAI or Gemini for a second opinion. The naive way to wire that is to hardcode the model ids, which go stale the week a provider ships a new one, and a wrong id is a hard error thrown in your face mid-review.

Cadence does it the other way around. After you set a key, it asks the provider what that key can actually reach, OpenAI's models endpoint, Gemini's ListModels. That list is the truth. It intersects the list with a small shipped hint table that tags known ids with a tier and whether they support high effort. Known models get classified for you, unknown ones fall through to "you place this one," and nothing errors. A model the provider shipped yesterday, that Cadence has never heard of, still shows up in the list and you can pick it.

Assignment runs through the same ask-user seam as everything else: let it auto-map by best fit and accept, or drill in and place each one by hand. It re-runs on demand, and a model-not-found failure during a review offers to re-detect and reassign right there. If the network is down or the key is bad, it falls back to shipped defaults or manual entry, it never blocks setup on a call that might fail. The hint table is the one artifact that can age, and its aging is soft, an unknown id is a manual placement, never a crash.

Read the code: `cadence-core/bin/review-provider.mjs`, `cadence-core/references/model-hints.json` (the soft hint table), `cadence-core/references/provider-api.md` (the wire shapes). Design record: `DESIGN.md`, "Provider model selection + live detection."

## Review is a pure function

Adversarial review is a pure function, an artifact goes in and structured findings come out, file, line, severity, claim, failure scenario. Nothing about that job wants an agent harness driving it.

That is why the cross-model reviewers are direct API calls and not a CLI subprocess. The API enforces the output shape (OpenAI `response_format`, Gemini `responseSchema`), so findings come back in the exact schema every time, no scraping stdout, no `jq` fallback, no stripping telemetry out of the answer, the whole class of fragile parsing that comes with shelling out to a coding CLI is simply not there. The main model is the adjudicator, it does the grounding and kills the false positives, so a reviewer's ability to wander off and investigate on its own is dead weight here anyway.

Read the code: `cadence-core/bin/review-provider.mjs`, `cadence-core/references/provider-api.md`. Design record: `DESIGN.md`, "Adversarial review."

## Pure core, thin seam

Every seam that makes a decision splits in two. The decision is a pure function with no I/O, `close-decision`, `publish-decision`, `branch-decision`, `release-decision`, it takes the state and returns a verdict, and it carries a unit test for every branch it can take. The seam wrapped around it is thin, read the files, call the pure core, print one line of JSON, exit.

That split is why the invariants hold. The judgment that is easy to get wrong is the part that never touches the disk and is tested to death, and the part that touches the disk is too small to hide a bug in. Prose keeps the judgment, the scripts keep the invariants, and the scripts are boring on purpose.

Read the code: the `*-decision.mjs` cores under `cadence-core/bin/lib` and their tests (`cadence-core/bin/close-decision.test.mjs`, `cadence-core/bin/publish-decision.test.mjs`, `cadence-core/bin/branch-decision.test.mjs`, `cadence-core/bin/release-decision.test.mjs`).
