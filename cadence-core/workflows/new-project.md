<purpose>
Initialize a project: deep questioning until the idea is concrete, then
PROJECT.md, REQUIREMENTS.md, a phased ROADMAP.md with falsifiable success
criteria, and the .planning/ state every other Cadence skill reads.

This is the entry point, and the questioning is the point. An hour of
following threads here buys weeks of downstream clarity; a vague PROJECT.md
forces every later phase to guess, and the cost compounds.

Replaces GSD's new-project: same questioning spine, minus the 4-researcher
fan-out (one optional research pass instead), minus the interactive config
questionnaire (defaults copied silently), minus roadmapper/synthesizer
agents (the roadmap is derived inline).
</purpose>

<process>

<step name="setup">
Parse `$ARGUMENTS`: optional `--research` flag, which forces the research
pass on for this run regardless of config.

In order:

1. If `.planning/PROJECT.md` exists, stop: "Project already initialized.
   /cad-progress shows where you are."
2. If not in a git repo (`git rev-parse --git-dir` fails), run `git init`.
3. `mkdir -p .planning`
4. If `.planning/config.json` does not exist, copy the engine template
   verbatim:

   ```bash
   cp "$HOME/.claude/cadence-core/templates/config.json" .planning/config.json
   ```

   Ask no configuration questions. Tell the user in one line:
   "Config written with defaults (interactive, research off, plan check and
   verifier on). /cad-config changes any of it."
5. Read the keys this workflow needs from `.planning/config.json`:
   `workflow.research`, `workflow.subagent_timeout`, `planning.commit_docs`,
   `granularity`, and the `git` block.
6. Brownfield check: if the repo already contains source code (anything
   beyond dotfiles and `.planning/`), note it briefly ("Existing [language]
   code detected: [one-line shape]"). During questioning, treat existing
   behavior as given; existing capabilities become Validated requirements
   in PROJECT.md and the current state goes in its Context section.
</step>

<step name="questioning">
This is dream extraction, not requirements gathering. You are a thinking
partner helping the user sharpen a fuzzy idea, not an interviewer filling
out a form. Don't follow a script; follow the thread.

**Open freeform** (plain prose, NOT AskUserQuestion):

"What do you want to build?"

Wait for the response. It gives you the material for every question after.

**Follow the thread.** Each answer opens new threads; pick the live one.
Techniques:

- Follow energy: whatever they emphasized or seemed excited about, dig there.
- Challenge vagueness: "good" means what? "users" means who? "simple" means
  how? Never accept a fuzzy answer you would have to interpret later.
- Make the abstract concrete: "Walk me through using this." "What does that
  actually look like?" "Give me an example."
- Clarify ambiguity: "When you say X, do you mean A or B?"
- Reveal motivation: "What prompted this?" "What are you doing today that
  this replaces?"
- Find done: "How will you know this is working?"

**Structured questions** go through the ask-user seam (references/seams.md):
2-4 options that are interpretations, concrete examples, or choices that
reveal priorities - never generic categories or leading options. Headers max
12 characters. Include a "Let me explain" style escape when the space of
answers is open.

**Freeform rule:** the moment the user signals they want to explain in their
own words ("let me describe it", an open-ended reply, picking the escape
option), STOP structured questions. Ask the follow-up as plain text, let
them type, and only resume structured questions after processing what they
said.

**Background checklist** (mental, never a conversation structure):

- [ ] What they're building (concrete enough to explain to a stranger)
- [ ] Why it needs to exist (the problem or desire driving it)
- [ ] Who it's for (even if just themselves)
- [ ] What "done" looks like (observable outcomes)

If gaps remain, weave questions in naturally; don't switch to checklist mode.

**Anti-patterns:** checklist walking, canned questions ("what's your core
value?"), corporate speak ("stakeholders", "success criteria" as a question),
firing questions without building on answers, rushing to the artifacts,
accepting vague answers, asking about tech stack before understanding the
idea, and asking about the user's skill level (never do this - Claude builds).

**Decision gate.** When you could write a clear PROJECT.md, ask (ask-user
seam):

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create
  PROJECT.md?"
- options:
  - "Create PROJECT.md" - move forward
  - "Keep exploring" - share more / ask me more

On "Keep exploring", ask what they want to add or probe the remaining gaps.
Loop until "Create PROJECT.md".
</step>

<step name="write_project">
Read `$HOME/.claude/cadence-core/templates/PROJECT.md` and synthesize
everything gathered into `.planning/PROJECT.md`. Do not compress; capture
all of it.

- Active requirements are hypotheses until shipped - frame them that way.
- Brownfield: existing capabilities go under Validated; current code state
  goes in Context.
- Seed Key Decisions with any decisions made during questioning.
- Out of Scope entries always carry the reason.

**First-commit guard.** If `planning.commit_docs` is false, skip this commit
and every later commit in this workflow. Otherwise apply the
protected-branch guard from references/git.md now, before the first commit.
Exception: a repo with no commits yet (`git rev-parse HEAD` fails) has
nothing to branch from - skip the guard and let the initial docs commit
create the root commit on the current branch.

Commit: `docs: initialize project` with `.planning/PROJECT.md` and
`.planning/config.json`.
</step>

<step name="research">
Run this step only when `workflow.research` is true in config OR `--research`
was passed. Otherwise skip silently - research is off by default, and a solo
dev who knows the domain loses nothing by skipping a generic ecosystem survey.

One pass, one agent, one file. Dispatch a single fresh-context agent via the
spawn-agent seam (references/seams.md), timeout `workflow.subagent_timeout`:

```text
Read .planning/PROJECT.md for project context.

Research the domain ecosystem for this project:
1. Stack: standard libraries and tools with versions verified against
   current docs (not training data), rationale for each, what to avoid.
2. Features: table stakes vs differentiators vs anti-features, with
   complexity notes.
3. Pitfalls: what projects in this domain commonly get wrong, warning
   signs, prevention strategies.

Write ONE file: .planning/research/RESEARCH.md with those three sections
plus Sources and a confidence level per recommendation. Write the file
first, then return a one-paragraph summary.
```

On return, verify `.planning/research/RESEARCH.md` exists and is non-empty.
If the agent returned the document inline without writing it, write the file
yourself from the returned content. If the pass failed outright, say so in
one line and continue - research is advisory, never a gate on initialization.

Commit: `docs: project research` with `.planning/research/`.
</step>

<step name="requirements">
Read PROJECT.md and extract the Core Value, constraints, and any explicit
scope boundaries.

**Gather candidate features:**

- If research ran: present its feature findings grouped by category
  (table stakes vs differentiators per category, briefly).
- If not: gather through conversation. Ask: "What are the main things
  users need to be able to do?" For each capability mentioned, clarify
  until specific, probe for related capabilities, and group into
  categories.

**Scope each category** (ask-user seam, multiSelect):

- header: "[Category]" (max 12 chars)
- question: "Which [category] features are in v1?"
- options: the category's features, plus "None for v1"

Track the outcome: selected features are v1; unselected table stakes go to
v2; unselected differentiators go to Out of Scope.

**Catch gaps** (ask-user seam):

- header: "Additions"
- question: "Anything missed? Features specific to your vision?"
- options: "No, that covers it" / "Yes, let me add some"

**Cross-check the Core Value:** if no v1 requirement delivers the Core
Value, say so and resolve it with the user before writing anything.

**Quality bar.** Each requirement must be specific and testable,
user-centric, and atomic. Push vague ones until they pass:

- "Handle authentication" becomes "User can log in with email/password and
  stay logged in across sessions"
- "Support sharing" becomes "User can share a post via a link that opens in
  the recipient's browser"

Read `$HOME/.claude/cadence-core/templates/REQUIREMENTS.md` and write
`.planning/REQUIREMENTS.md`: v1 by category with REQ-IDs, v2 deferred, Out
of Scope with reasons, Traceability table left as headers (filled by the
roadmap step).

**Present the full v1 list** (every requirement, not counts) and confirm:
"Does this capture what you're building?" If adjustments are needed, return
to scoping.

Commit: `docs: define requirements` with `.planning/REQUIREMENTS.md`.
</step>

<step name="roadmap">
Build the roadmap inline in this context - there is no roadmapper agent.

Derivation rules:

1. Derive phases from the requirements; don't impose a canned structure.
2. Phase count follows config `granularity`: coarse 3-5, standard 5-8,
   fine 8-12. When in doubt, fewer.
3. Prefer vertical slices: each phase delivers something a user can
   exercise end to end, not a horizontal layer assembled at the end.
4. Map every v1 requirement to exactly one phase. 100% coverage, no
   orphans, no double-mapping.
5. Give each phase 2-5 falsifiable success criteria: observable statements
   that could be shown false ("running X shows Y", "user can Z"). Never
   "X works" or "X is improved".
6. Order by dependency; state each phase's `Depends on` explicitly.

Read `$HOME/.claude/cadence-core/templates/ROADMAP.md` and write
`.planning/ROADMAP.md`. Then update the Traceability table in
REQUIREMENTS.md: every REQ-ID mapped to its phase, coverage counts filled.

**Present the roadmap** inline: a table (phase, goal, REQ-IDs, criteria
count), then per-phase details with their success criteria.

**Approval gate** (ask-user seam):

- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" - write state and finish
  - "Adjust phases" - tell me what to change
  - "Review full file" - show raw ROADMAP.md

On "Adjust phases": take the feedback, revise ROADMAP.md and the
traceability mapping inline, re-present, loop until approved. On "Review
full file": show the file, then re-ask.
</step>

<step name="state">
Read `$HOME/.claude/cadence-core/templates/STATE.md` and write
`.planning/STATE.md` as the 4-line cursor, nothing else:

```markdown
# State

Phase: 1 of [N] ([Phase 1 name])
Status: ready to plan
Next: /cad-context 1
```

Do NOT create `.planning/phases/` directories - they are created lazily by
/cad-plan when a phase actually starts.

Commit: `docs: create roadmap ([N] phases)` with `.planning/ROADMAP.md`,
`.planning/STATE.md`, `.planning/REQUIREMENTS.md`.
</step>

<step name="done">
Report tersely:

```
Initialized: {project name}
.planning/: PROJECT.md, REQUIREMENTS.md, ROADMAP.md ({N} phases),
            STATE.md, config.json{, research/RESEARCH.md}
Commit(s): {hashes, or "none - commit_docs is false"}

Next: /cad-context 1
```

One suggestion, no menu.
</step>

</process>

<guardrails>
- Never spawn more than one research agent, and none at all unless
  configured or `--research` was passed. The 4-researcher fan-out and
  synthesizer are gone; do not reintroduce them.
- Never push (references/git.md rail 3).
- STATE.md is a ~4-line overwritten cursor: no audit logs, no session
  narratives, no progress bars, no metrics.
- Config keys come from the engine config template only; never invent keys,
  never ask config questions this workflow doesn't need answered.
- Never fabricate an answer the ask-user seam was supposed to collect; when
  the user wants to talk freeform, drop structured questions until they're
  done.
- Create nothing outside the canonical .planning/ set (PROJECT.md,
  REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, research/ if the pass
  ran). No phases/ dirs, no CLAUDE.md generation, no extra scaffolding.
- A failed research pass is reported and skipped, never a blocker.
- Don't rush the questioning to get to the artifacts. The artifacts are
  only as good as the questioning that fed them.
</guardrails>

<success_criteria>
- [ ] Questioning followed threads until what / why / who / done were all
      concrete (not rushed, not checklist-walked)
- [ ] .planning/config.json copied verbatim from the engine template, no
      config interrogation
- [ ] PROJECT.md captures the full gathered context; Active requirements
      framed as hypotheses
- [ ] REQUIREMENTS.md: user scoped every category; REQ-IDs assigned;
      v1 / v2 / Out of Scope explicit, exclusions carry reasons
- [ ] ROADMAP.md: every v1 requirement mapped to exactly one phase; 2-5
      falsifiable success criteria per phase; user approved it
- [ ] Traceability table shows 100% v1 coverage
- [ ] STATE.md is a 4-line cursor pointing at phase 1
- [ ] Commits follow references/git.md (guard before first commit, docs:
      prefix, specific files, no push) and respect planning.commit_docs
- [ ] At most one research agent spawned, only when enabled
</success_criteria>
