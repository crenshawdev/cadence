<purpose>
The second front door. A repo that already exists - code, history, usually a
README that already says what it is - enters Cadence without being interviewed
as though it were nothing yet. Read the code and the history, derive PROJECT.md,
REQUIREMENTS.md and a REMAINING-work ROADMAP.md from them, and write the same
`.planning/` shape /cad-new-project writes: same files, same STATE cursor, same
config, so every downstream command works unchanged.

Everything is derived INLINE in this context. No subagent is dispatched, no
detector seam is added, and no scoring mechanism decides what the repo said -
the brownfield read is a reading, paid here, and judged here.
</purpose>

<process>

<step name="setup">
Two stops first, before anything is written.

1. If `.planning/PROJECT.md` exists, stop: "Project already initialized.
   /cad-progress shows where you are."
2. Run `git rev-parse --show-toplevel`. Adopt needs BOTH that it SUCCEEDS and
   that its output IS the current working directory:
   - It fails - no repo here at all -> stop. There is no history to adopt;
     "/cad-new-project starts a project from a blank page (it runs `git init`
     for you)."
   - It succeeds but names a DIFFERENT directory -> stop, naming that root:
     "This is a subdirectory of {root}. Run /cad-adopt in {root}."
   `git rev-parse --git-dir` is NOT this check and must never be substituted for
   it: it succeeds in any subdirectory of an enclosing repo. Adopt's inputs are
   the code AND the history, and git discovers a repo UPWARD from the working
   directory, so from `/repo/sub` that check would answer this whole workflow
   out of `/repo`'s log and tags while writing `.planning/` into `sub`.
3. Scaffold and read config as ONE Bash step, not four turns - `mkdir -p`, the
   ignore line, the config copy if absent, and the config read chained in a
   single script that echoes a marker when it wrote the config, so this
   coordinator knows whether to print the "Config written with defaults" line:

   ```bash
   mkdir -p .planning
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace ignore --root .
   [ -f .planning/config.json ] || { cp "${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/config.json" .planning/config.json; echo CONFIG_WRITTEN; }
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
     planning.commit_docs granularity \
     git.protected_branches git.on_protected git.base_branch
   ```

   The ignore line is not optional: `.planning/trace.jsonl` is ONE MACHINE's
   run record, this seam is the only thing in Cadence that writes the rule, and
   /cad-health reports `ignored:false` and `tracked:true` as separate issues
   with different remedies. Append-if-absent, so a brownfield `.gitignore` keeps
   every line it had and a re-run adds no second line.

   The config template is copied VERBATIM - ask no configuration questions. When
   it was written, say so in one line: "Config written with defaults (standard
   granularity, shipped stakes, research off, plan check and verifier on).
   /cad-config changes any of it."
</step>

<step name="survey">
Read the repo yourself, here. No subagent, and no new detector:
`planning.mjs detect-commands` is neither required nor extended for this - what
the code can answer is what this reading answers.

What to read:

- `README.md`, plus any root `docs/`, `SPEC.md`, `DESIGN.md`, `CONTRIBUTING.md`:
  what the project says it is, who it is for, how it is run.
- The manifests - `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`,
  `tsconfig.json` and the like: the stack, the entry points, the build, test and
  lint commands.
- The tree shape: top-level directories, where the source lives, what is
  generated, what is vendored.
- `git log --oneline -40` and `git tag --list`: what has shipped, what the
  recent work has been about, and whether the project is released and at what
  version.

Then state what you found in a few lines - shape, stack, apparent purpose,
release state. This is the input to every step below; it is not a report, so do
not narrate the reading.
</step>

<step name="questioning">
Adopt asks only what the repo cannot answer. Whatever the survey READ is
ANSWERED: the goal a README states, the stack and the build commands a manifest
states, the shape the tree states, the direction the log states. Re-asking any
of it is the blank-page interview this door exists to avoid, and it tells the
user their project was not read.

So a question is legitimate only when it names something the repo does not
state, and asking it that way out loud is the test: "the README says what this
does but never who it is for"; "the log stops at the parser - what comes after
it?" A question that cannot name its gap is one the survey already answered.

**Background checklist** (mental, never a conversation structure), the same four
items /cad-new-project carries:

- [ ] What this is (concrete enough to explain to a stranger)
- [ ] Why it needs to exist (the problem or desire driving it)
- [ ] Who it is for (even if just themselves)
- [ ] What "done" looks like (observable outcomes)

A repo with history usually answers the first two by itself and rarely answers
the last two. Weave in what is left naturally; do not switch to checklist mode.
And the REMAINING work - what the user wants next - is the one thing no repo
states, so it is where the questioning belongs: it is what ROADMAP.md is about
to be made of.

**Structured questions** go through the ask-user seam (references/seams.md):
2-4 options that are interpretations, concrete examples, or choices that reveal
priorities - never generic categories or leading options. Headers max 12
characters. Include a "Let me explain" style escape when the space of answers is
open.

**Freeform rule:** the moment the user signals they want to explain in their own
words ("let me describe it", an open-ended reply, picking the escape option),
STOP structured questions. Ask the follow-up as plain text, let them type, and
resume structured questions only after processing what they said.

**Anti-patterns:** checklist walking, canned questions ("what's your core
value?"), corporate speak ("stakeholders"), firing questions without building on
answers, accepting a vague answer you would have to interpret later, asking
about the tech stack the manifest already states, and asking about the user's
skill level (never do this - Claude builds).

**No mechanism decides any of this.** No score, no coverage percentage, no
threshold, no rubric, and no per-item walk of the repo's own documents against a
list of things a project ought to state - each of those is forbidden here, and
the reason is measured rather than stylistic: the first computed discriminator
this tree tried ordered its fixture's phases backwards, and the standing
requirement on this door is that it never become a scripted interview.
Suppression is judgment. You read the repo, so you already know what it said.
</step>

<step name="write_project">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/PROJECT.md` and write
`.planning/PROJECT.md` from the survey.

- `### Validated` carries the SHIPPED capability - what the existing code
  already does, one line each. This is the brownfield rule the template itself
  states, and it is where reconstructed history belongs.
- `## Context` carries the current state of the code: stack, layout, known
  rough edges, anything a later phase has to work around.
- `### Active` is REMAINING work only, framed as hypotheses until shipped.
- `## Key Decisions` seeds from choices the repo has visibly ALREADY made (the
  stack, a storage choice, a public interface), each with the rationale you can
  actually see in the code or the history. Never invent one.
- `## Out of Scope` entries always carry the reason.

The `### Active` milestone version is a PROPOSED NEXT version, confirmed with
the user through the ask-user seam (references/seams.md), and never the repo's
current tag: /cad-health rule 7 reports drift when the Active version is a
member of `git tag --list`, so naming the version already shipped fails the
first health check the user runs. Propose the next one from the tag list
(`v1.4.0` shipped -> `v1.5.0` proposed), and offer the alternatives rather than
deciding alone.
</step>

<step name="write_requirements">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/REQUIREMENTS.md` and write
`.planning/REQUIREMENTS.md`.

- `## Active` is what is LEFT to build. Bullets in the stated grammar,
  `- **[CAT]-01**: [requirement]`, with a 3-5 letter category code that starts
  with a letter. What the code already does is Validated in PROJECT.md, not a
  requirement to deliver a second time.
- Each one specific, testable, user-centric and atomic - the same bar
  /cad-new-project holds: "User can X", never "System does Y", never "Handle Z".
- `## v2 Requirements` and `## Out of Scope` take what the repo or the user
  deferred, exclusions carrying their reason.
- `## Traceability` is left as BARE HEADERS. `/cad-plan` seeds each row when its
  phase is planned (`references/req-traceability.md`); `planning.mjs seed-reqs`
  reads `.planning/phases/<N>/PLAN*.md` and returns `no-phase-dir` / `no-plans`
  before any plan exists, so adopt structurally cannot seed a row, and a
  hand-authored one would make the mismatched arm the normal case on every
  adopted repo.
</step>

<step name="write_roadmap">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/ROADMAP.md` and write
`.planning/ROADMAP.md`. It covers REMAINING work only, derived here - there is
no roadmapper agent.

1. Every `## Phases` entry is `- [ ]`. Never reconstruct shipped work as an
   `- [x]` phase: /cad-health rule 5 flags an `- [x]` phase whose mapped
   REQUIREMENTS rows are not all `Complete`, and seeded rows are always
   `Pending`, so a reconstructed history becomes a status-drift issue on the
   first /cad-plan. Shipped work is PROJECT.md's Validated section.
2. Phase count follows the `granularity` read in setup: coarse 3-5, standard
   5-8, fine 8-12. When in doubt, fewer.
3. Prefer vertical slices - each phase delivers something the user can exercise
   end to end - and order by dependency, stating each phase's `Depends on`.
4. 2-5 falsifiable success criteria per phase: observable statements that could
   be shown false. Never "X works".
5. Map every `## Active` id to exactly one phase - full coverage, no orphans,
   no double-mapping.

Then count what you just wrote - rule 4 above is prose until a seam counts it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" criteria-size --roadmap-min 2 --roadmap-max 5
```

No `--phase`: one call walks every phase the roadmap declares. Each `over` entry
names the phase, its measured count and the bound it broke. `roadmap_found:
false` is not zero criteria - that phase's block declares none at all, so write
them rather than report it as under the floor. A REPORT, not a gate, exactly as
`plan-size`'s `phase-too-big` is: present it and let the approval gate decide.

Present the roadmap inline (a table of phase, goal, REQ-IDs and the criteria
count the seam just reported, then the per-phase criteria, naming every `over`
phase and its numbers) and take it through the approval gate (ask-user seam):

- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" - write state and finish
  - "Adjust phases" - tell me what to change
  - "Review full file" - show raw ROADMAP.md

On "Adjust phases", take the feedback, revise ROADMAP.md inline, re-present, and
loop until approved. On "Review full file", show the file and re-ask.
</step>

<step name="state">
Write the initial cursor through the seam - ROADMAP.md exists now, so name and
total derive automatically:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
  --phase 1 --status "ready to plan" --next "/cad-context 1"
```

Create no `.planning/phases/` directory. A phase directory is
`.planning/phases/<N>/` with a bare integer for `<N>`, created lazily by the
first skill that needs it.
</step>

<step name="commit">
If `planning.commit_docs` is false, skip this step entirely and report the
commit line as "none - commit_docs is false".

Otherwise apply the protected-branch guard from references/git-guard.md now,
before this commit - it is the first commit of the cycle. (A repo with no
commits at all has nothing to branch from: skip the guard and let this commit
create the root commit on the current branch.)

Then ONE commit, `docs: adopt existing project into Cadence`, staging exactly
the five files written: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`,
`.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`. One
commit, not three - all three documents were derived in a single pass, so there
is no intermediate state worth a separate commit.
</step>

<step name="done">
Report tersely:

```
Adopted: {project name}
Found: {one line - stack, size, release state}
.planning/: PROJECT.md, REQUIREMENTS.md, ROADMAP.md ({N} phases),
            STATE.md, config.json
Commit: {hash, or "none - commit_docs is false"}

Next: /cad-context 1
```

One suggestion, no menu. A `/clear` before it is safe - everything gathered is
on disk in `.planning/`.
</step>

</process>

<guardrails>
- No subagent, ever. This workflow dispatches nothing: the brownfield read is
  paid in this context, which is what keeps the front door's most expensive step
  visible instead of hidden behind an unpriced dispatch.
- Adopt REFUSES a directory that is not a git repo root; it never runs
  `git init`. Its inputs are code and history, and git's upward discovery would
  otherwise let a subdirectory answer from the repo above it.
- Nothing outside the canonical `.planning/` set is created: PROJECT.md,
  REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json. No `phases/` dirs, no
  CLAUDE.md generation, no extra scaffolding.
- Config keys come from the engine config template only; never invent keys and
  never ask config questions.
- Never fabricate an answer the ask-user seam was supposed to collect.
- STATE.md is a ~4-line overwritten cursor: no audit log, no narrative.
- Nothing already shipped is written as an open requirement or an `- [x]` phase.
</guardrails>

<success_criteria>
- [ ] Refused unless `git rev-parse --show-toplevel` succeeded AND equalled the
      working directory; refused if `.planning/PROJECT.md` already existed
- [ ] `.planning/` holds PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and
      config.json, with config.json copied verbatim from the engine template
- [ ] The trace ignore line is present and `.planning/trace.jsonl` is untracked
- [ ] Nothing the README, the manifests, the tree or the log already answered
      was re-asked, and every question asked named the gap it was filling
- [ ] PROJECT.md's Validated section carries what the code already does; its
      `### Active` milestone version is not a member of `git tag --list`
- [ ] REQUIREMENTS.md `## Active` uses the `- **[CAT]-01**:` grammar and
      `## Traceability` is bare headers with zero rows
- [ ] ROADMAP.md is remaining work: no `- [x]` entry, phase count follows
      `granularity`, 2-5 falsifiable criteria per phase, every `## Active` id
      mapped to exactly one phase, user approved it
- [ ] STATE.md is a 4-line cursor pointing at phase 1, and no `phases/` dir
      was created
- [ ] One `docs:` commit under references/git-guard.md, respecting
      `planning.commit_docs`, staging the five files by name and pushing nothing
- [ ] No subagent was dispatched
</success_criteria>
