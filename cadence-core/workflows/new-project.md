<purpose>
Initialize a project: deep questioning until the idea is concrete, then
PROJECT.md, REQUIREMENTS.md, a phased ROADMAP.md with falsifiable success
criteria, and the .planning/ state every other Cadence skill reads.

This is the entry point, and the questioning is the point. An hour of
following threads here buys weeks of downstream clarity; a vague PROJECT.md
forces every later phase to guess, and the cost compounds.

One questioning spine, not a fan-out: one optional research pass (not four
researchers), config defaults copied silently (no questionnaire), and the
roadmap derived inline (no roadmapper/synthesizer agents).
</purpose>

<process>

<step name="setup">
Parse `$ARGUMENTS`: optional `--research` flag, which forces the research
pass on for this run regardless of config, and optional `--brief <file>`, a
design brief some earlier freeform conversation already produced
(`docs/DISCOVERY.md` describes how a user arrives with one).

With `--brief`, `Read` that file WHOLE before questioning starts - no parser,
no schema, no seam subcommand. A brief's whole value is that it is freeform,
and a schema would impose exactly the structure the discovery deliberately
lacks. If the path does not resolve, stop with one line naming it ("No brief
at `<path>`.") and write nothing: falling through into the blank-page
interview would silently discard the input the flag exists to carry.

In order (items 2-5 are one Bash step, not four separate turns - git-init if
needed, `mkdir -p .planning`, the config copy if absent, and the `config.mjs
get` chained in a single script that echoes a marker when it wrote the config,
so the coordinator knows whether to print the "Config written with defaults"
line):

1. If `.planning/PROJECT.md` exists, stop: "Project already initialized.
   /cad-progress shows where you are."
2. If not in a git repo (`git rev-parse --git-dir` fails), run `git init`.
3. `mkdir -p .planning`, then keep the run record out of git:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace ignore --root .
   ```

   Append-if-absent: it creates `.gitignore` when there is none, and a
   brownfield `.gitignore` keeps every line it had. A re-run adds no second
   line (`written:false`, `reason:"already-ignored"`), and a project that
   ignores `.planning/` wholesale is already correct and is left alone.
   `.planning/trace.jsonl` is ONE MACHINE's routing/provider/worker record, so a
   project must not commit it - and this seam is the only thing in Cadence that
   writes that line.
4. If `.planning/config.json` does not exist, copy the engine template
   verbatim:

   ```bash
   cp "${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/config.json" .planning/config.json
   ```

   Ask no configuration questions - with TWO deliberate exceptions, and no
   others. The first is item 6 below: the forge. A forge is a PRECONDITION
   rather than an option (FRG-02), and no template can carry a default for it,
   because which forge hosts a repository is a fact about that repository and
   not about Cadence. So it is asked, once, and a repository that has answered
   is never asked again.

   The second is what each role costs. Follow the **Roles interview** arm of
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config.md` (one consult site -
   this step) right here, after the template copy: the full thirteen questions
   written to the user-global layer when that layer holds no `roles` key, and
   the shorter per-project confirmation written to this repository's own file
   when it already does. It is an exception for the same shape of reason the
   forge is - a template cannot carry a default for what a model costs the
   person paying for it, and the six roles' models are the largest single
   decision about what running Cadence costs. A user who accepts every default
   answers thirteen questions once per machine and none of them again.

   Every other key keeps the template's value. Tell the user in one line what
   was written and where: "Config written with defaults (standard granularity,
   research and plan check off, verifier on) in `.planning/config.json`, and
   the per-role models and start rungs you just chose in <the file the
   interview named>. /cad-config changes any of it, and /cad-config --roles
   re-opens those thirteen questions."
5. Read the keys this workflow needs through the seam (effective values,
   global layer included):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
     workflow.research planning.commit_docs \
     granularity git.protected_branches git.on_protected git.base_branch
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" detect --dir .
   ```

   The `forge.mjs detect` line rides this same script rather than taking a turn
   of its own: it reads a config and PATH, and item 6 is prose over what it
   already printed.
6. **Pick a forge**, from the `forge.mjs detect` line in that same script.
   Branch on `action` alone, the way /cad-land step 1 branches on
   `issue-check`'s:

   - `configured` - this repository has already answered. Say NOTHING and ask
     nothing. This is what makes a second run of /cad-new-project silent on the
     subject.
   - `refuse` - print the envelope's `reason` and its `hint`, one line each, and
     stop the forge step here. A forge is a precondition (FRG-02): do not invent
     a no-tracker mode, and do not fall through to the questions below.
   - `ask` - put the questions to the user through the ask-user seam
     (`references/seam-ask-user.md`), in this order:

     a. **Which forge**, as a structured choice over the envelope's `installed`
        entries - one option per entry, naming the provider and the binary that
        drives it. When `defaults.provider` names one of those providers, put
        that option FIRST and label it `(recommended)`; when it is null, offer
        them in the order the envelope lists and label NOTHING. That is the
        seam's own rule that a recommendation must fall out of analysis the step
        already did, and no analysis here recommends a forge for a host the
        origin URL cannot classify. Always offer one more option than there are
        providers - **None of these**, last in the list. The ask-user seam
        states that an always-present option consumes one of the four slots a
        question has, and three providers plus NONE is exactly four, so this
        question never splits however many resolved.
     b. **Which repository**, as `owner/name`. Pre-fill it from `defaults.repo`
        when the envelope offers one, so the user CONFIRMS rather than retypes;
        ask it outright when it does not.
     c. **Which Forgejo instance** - asked ONLY when the chosen provider is
        `forgejo` and the envelope's `host` is null. Open-ended per the ask-user
        seam, because the value is typed rather than picked from a set, and with
        NO default offered. Ask for the instance the user reaches in a BROWSER -
        `forge.example.com` - and NOT the SSH endpoint the remote URL carries,
        which is often a different name (`ssh.example.com`); that split is a
        normal deployment rather than a misconfiguration, this repository is one,
        and only the browser host resolves a `tea` login. Say that the answer may
        carry a PORT when the instance is not on the default one, spelled
        `host:port` - `forge.example.com:3001` - and that it is the port the
        BROWSER reaches, never the SSH port. `github` and `gitlab`
        are never asked this; their hosts are fixed.

     **On "None of these" the step REFUSES and stops** - it does not fall
     through. Say it in the same shape the `refuse` action uses, two lines: a
     REASON naming what was looked for, reading the binaries off the envelope's
     `installed` ("tea and gh are installed; no provider was picked"), and a
     HINT naming how to set one later - `config.mjs set
     git.forge_provider=<provider>` against this repository's own
     `.planning/config.json`. Then stop the forge step: do not ask questions b
     and c, and run NO `config.mjs set` on this arm, so nothing is half
     persisted for the next run to read back as an answered question.

     Do not re-ask inside this run and do not invent a no-forge mode: a forge is
     a precondition (FRG-02), and the fix is to re-run this entry point once a
     provider is picked. This arm has to be written down because a declined
     question has no answer at all - `references/seam-ask-user.md` forbids
     fabricating or defaulting an answer the seam was supposed to collect - so
     prose that does not say what happens next lets setup run on past a
     question it never got.

     Persist the answers in ONE call, against this repository's own
     `.planning/config.json` (the default target - no `--file`, no `--global`):

     ```
     node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set \
       git.forge_provider=<provider> git.forge_repo=<owner/name>
     ```

     On the forgejo arm that same call carries `git.forge_host=<host>` as a
     third pair. On `github` and `gitlab` the pair is OMITTED entirely rather
     than written empty: null there means "fixed host, nothing to name", and an
     empty string would read back as an answered question. There is no new
     writer here on purpose, so `checkPairs`, `retiredKeyError` and the
     repo-layer-only refusal on `git.forge_repo` all still apply to this write.

     **Then offer to CREATE it, when there is nothing to create it beside.**
     Only on the arm where `git remote get-url origin` names nothing - a
     directory just `git init`ed has no origin, and a repository that already
     has one already exists on a forge. Ask through the ask-user seam as a plain
     confirm, so no option carries `(recommended)`, and put all four facts in
     the question itself:

       "Create <owner>/<name> on <provider> now? It will be created PRIVATE."

     Those four - the provider, the owner, the repository name and the
     visibility - are the confirmation, and nothing else in this run states them
     together. Visibility is not a question and is never asked: every repository
     Cadence creates is private, because `gh` with no visibility flag drops to
     an interactive prompt that would hang, `glab` silently defaults to
     `internal`, and three different defaults are not a choice worth putting to
     a user.

     Only on a yes, and never ahead of one:

     ```
     node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" create \
       --provider <provider> --repo <owner/name> --confirmed \
       --remote-url <url> --dir .
     ```

     `--confirmed` is what the user's answer buys. The seam cannot ask - it
     would hang blocking on stdin inside a Bash call - so the flag is this
     step's assertion that the question was put and answered, and passing it
     ahead of the answer is the one thing that would make the whole gate a
     formality.

     `--remote-url` is passed on `forgejo` and `github` and OMITTED on `gitlab`.
     Those two providers' create commands wire no git remote, so the seam adds
     `origin` itself and needs the URL to point it at; `glab` wires its own. It
     is not a fourth question and neither host is guessed: on `forgejo` build it
     from the `git.forge_host` just confirmed above - WHOLE, port and all, since
     the seam refuses a URL whose port the configured instance does not serve -
     and on `github` from the fixed `github.com`, each with the answered slug -
     `https://<host>/<owner>/<name>.git`.

     On an `ok:false`, print the envelope's `reason` and `hint`, one line each,
     and stop the forge step. Do not continue as though a repository exists, and
     do not re-run the create: a `created:true` on that envelope means the
     repository IS there and only the remote is missing.

7. Brownfield check: if the repo already contains source code (anything
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

**With `--brief`, that opening question is already answered.** Everything the
brief SETTLES is answered material, not a topic to re-open. Replace the opening
question with a short read-back - what you understand the project to be, who it
is for, what it refuses to do, and the stack and constraints it commits to, as
the brief states them - plus an invitation to correct anything you read wrong.
Then question only what the brief leaves OPEN.

What is open is what the brief SAYS, read the way you read any prose: a section
that decides something has decided it, a question it poses and does not answer
has not, and an item it parks as pending, deferred or a hypothesis is still
live. Never key this off a marker convention. A brief that happens not to write
`**OPEN**` anywhere would then read as settled throughout and the run would skip
the questioning entirely - the exact failure this flag exists to prevent, turned
inside out. No score, no coverage gate, no walking the brief section by section.

The background checklist below is where a brief lands: the items it settles are
ticked already, and the ones it leaves open are the thread to follow.

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

**Structured questions** go through the ask-user seam
(references/seam-ask-user.md):
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
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/PROJECT.md` and synthesize
everything gathered into `.planning/PROJECT.md`. Do not compress; capture
all of it.

- Active requirements are hypotheses until shipped - frame them that way.
- Brownfield: existing capabilities go under Validated; current code state
  goes in Context.
- Seed Key Decisions with any decisions made during questioning.
- Out of Scope entries always carry the reason.

**First-commit guard.** If `planning.commit_docs` is false, skip this commit
and every later commit in this workflow. Otherwise apply the
protected-branch guard from references/git-guard.md now, before the first commit.
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
spawn-agent seam (references/seam-spawn-agent.md):

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

This agent is the one Cadence dispatch path with NO `maxTurns` runaway bound,
and it is excluded deliberately rather than overlooked: `maxTurns` is per-FILE
frontmatter, this pass dispatches a generic host agent Cadence owns no file for,
and minting a 20th rung file to bound one optional research pass would cost a
`lib/rung-agent.mjs` map row plus both directions of self-verify's rung checks.
It therefore has NO runaway bound at all. A wall-clock config key was named
here as its bound until v2.7.0, when it was deleted for claiming a control
nothing could apply. This pass is opt-in (`workflow.research`, default false)
and advisory, never a gate, so an unbounded optional pass was judged the
smaller cost against minting a 20th rung file to bound it.

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

Batch the category questions ceil(N/4) per AskUserQuestion call (up to 4
categories at once), not one blocking turn per category; only a question whose
wording depends on an earlier answer stays sequential.

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

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/REQUIREMENTS.md` and write
`.planning/REQUIREMENTS.md`: v1 requirements as `## Active` bullets by
category with REQ-IDs, v2 deferred, Out of Scope with reasons, Traceability
table left as bare headers (seeded per phase by `/cad-plan`, never here).

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

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/ROADMAP.md` and write
`.planning/ROADMAP.md`. Leave REQUIREMENTS.md's Traceability table as bare
headers - `/cad-plan` seeds each row when its phase is planned
(`references/req-traceability.md`); do not hand-author a row here.

Then count what you just wrote - rule 5 above is prose until a seam counts it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" criteria-size --roadmap-min 2 --roadmap-max 5
```

No `--phase`: one call walks every phase the roadmap declares. Each `over` entry
names the phase, its measured count and the bound it broke. `roadmap_found:
false` is not zero criteria - that phase's block declares none at all, so write
them rather than report it as under the floor. A REPORT, not a gate, exactly as
`plan-size`'s `phase-too-big` is: present it and let the approval gate decide.

**Present the roadmap** inline: a table (phase, goal, REQ-IDs, and the criteria
count the seam just reported), then per-phase details with their success
criteria. Name every `over` phase and its numbers in that same presentation.

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
Write the initial cursor through the seam (ROADMAP.md exists now, so
name/total derive automatically):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
  --phase 1 --status "ready to plan" --next "/cad-context 1"
```

Do NOT create `.planning/phases/` directories. A phase directory is
`.planning/phases/<N>/`, created lazily by the first skill that needs it
(cad-context or cad-plan) and matched to an existing directory's name if one is
already present; the grammar for `<N>` is stated in
`references/roadmap-phases.md`.

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

One suggestion, no menu. A `/clear` before it is safe - everything is on disk
in `.planning/` and `/cad-context` runs a fresh analyzer, so the interview
transcript need not be carried forward.
</step>

</process>

<guardrails>
- Never spawn more than one research agent, and none at all unless
  configured or `--research` was passed. The 4-researcher fan-out and
  synthesizer are gone; do not reintroduce them.
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
- [ ] Every `## Active` id appears in a ROADMAP phase (100% coverage);
      Traceability table left as bare headers for `/cad-plan` to seed
- [ ] STATE.md is a 4-line cursor pointing at phase 1
- [ ] Commits follow references/git-guard.md (guard before first commit, docs:
      prefix, specific files, no push) and respect planning.commit_docs
- [ ] At most one research agent spawned, only when enabled
</success_criteria>
