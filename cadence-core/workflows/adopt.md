<purpose>
The second front door, for a repo that already has code and history. Read both,
derive PROJECT.md, REQUIREMENTS.md and a REMAINING-work ROADMAP.md from them,
and write the same `.planning/` shape /cad-new-project writes.
</purpose>

<process>

<step name="setup">
These stops come first, before anything is written.

1. If `.planning/PROJECT.md` exists, stop: "Project already initialized.
   /cad-progress shows where you are." Then, when `.planning/agile/` exists or
   the call below, which writes nothing, answers reason `agile-path`, stop: "This
   project is on the agile path. /cad-agile shows what comes next."

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace ignore --check --root .
   ```
2. Run `git rev-parse --show-toplevel`. Adopt needs BOTH that it SUCCEEDS and
   that its output IS the current working directory:
   - It fails - no repo here at all -> stop. There is no history to adopt;
     "/cad-new-project starts a project from a blank page (it runs `git init`
     for you)."
   - It succeeds but names a DIFFERENT directory -> stop, naming that root:
     "This is a subdirectory of {root}. Run /cad-adopt in {root}."
   `git rev-parse --git-dir` is NOT this check and must never be substituted for
   it: it succeeds in any subdirectory of an enclosing repo. Adopt itself never
   runs `git init`.
3. Scaffold and read config as ONE Bash step, not four turns - `mkdir -p`, the
   ignore line, the config copy if absent, and the config read chained in a
   single script that echoes a marker when it wrote the config, so you
   know whether to print this item's one line:

   ```bash
   mkdir -p .planning
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace ignore --root .
   [ -f .planning/config.json ] || { cp "${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/config.json" .planning/config.json; echo CONFIG_WRITTEN; }
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
     planning.commit_docs granularity \
     git.protected_branches git.on_protected git.base_branch
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" detect --dir .
   ```

   The ignore rule sits in the records folder's own
   `.planning/records/.gitignore`, created only when absent: the project's own
   `.gitignore` is never edited and a re-run changes nothing.

   The config template is copied VERBATIM - ask no configuration questions,
   with THREE deliberate exceptions and no others. The first is item 4 below: the
   forge. It is asked once, and a repository that has answered is never asked
   again.

   The second is what each role costs. Read
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-roles.md` (one consult
   site - this step) and follow its **Roles interview** arm once this item's
   script has run: the full thirteen questions
   written to the user-global layer when that layer holds no `roles` key, and
   the shorter per-project confirmation written to this repository's own file
   when it already does.

   The third is the testing policy, asked once as the `testing_policy` step
   between `write_requirements` and `write_roadmap`.

   Every other config key comes only from the template and keeps its value: never
   invent one. Say in one line what was written and where: "Config written with
   defaults (standard granularity, research and plan check off, verifier on) in
   `.planning/config.json`, and the per-role models and start rungs you just
   chose in <the file the interview named>. /cad-config changes any of it, and
   /cad-config --roles re-opens those thirteen questions."

4. **Pick a forge**, from the `forge.mjs detect` line in that same script.
   Branch on `action` alone:

   - `configured` - this repository has already answered. Say NOTHING and ask
     nothing.
   - `refuse` - print the envelope's `reason` and its `hint`, one line each, and
     stop the forge step here. A forge is a precondition (FRG-02): do not invent
     a no-tracker mode, and do not fall through to the questions below.
   - `ask` - put the questions to the user through the ask-user seam
     (`references/seam-ask-user.md`), in this order:

     a. **Which forge**, as a structured choice over the envelope's `installed`
        entries - one option per entry, naming the provider and the binary that
        drives it. When `defaults.provider` names one of those providers, put
        that option FIRST and label it `(recommended)`; when it is null, offer
        them in the order the envelope lists and label NOTHING. Always offer one
        more option than there are providers - **None of these**, last in the
        list.

        - header: "Code host"
        - question: "Which service hosts this project's repository?"
        - options:
          - "{provider}" - uses the {binary} command, one option for each installed service
          - "None of these" - none of these is the service this project uses, so setup stops here
     b. **Which repository**, as `owner/name`. Pre-fill it from `defaults.repo`
        when the envelope offers one, so the user CONFIRMS rather than retypes;
        ask it outright when it does not. An adopted repository usually HAS an
        origin, so this is usually a confirmation.

        - header: "Repository"
        - question: "Which repository is this project on {provider}? Write it as owner/name."
        - options:
          - "{owner}/{name}" - the repository this project's remote already points to, shown only when setup found one, otherwise you type it

     c. **Which Forgejo instance** - asked ONLY when the chosen provider is
        `forgejo` and the envelope's `host` is null. Open-ended per the ask-user
        seam, with NO default offered. Ask for the instance the user reaches in
        a BROWSER - `forge.example.com` - and NOT the SSH endpoint the remote
        URL carries, which is often a different name (`ssh.example.com`). Say
        that the answer may carry a PORT when the instance is not on the default
        one, spelled `host:port` - `forge.example.com:3001` - and that it is the
        port the BROWSER reaches, never the SSH port. `github` and `gitlab` are
        never asked this; their hosts are fixed.

        - header: "Instance"
        - question: "What address do you use in a browser to reach your Forgejo instance? Type just the host name, with no https:// and no path, and add the port as host:port only if it isn't the default one. This is the address you browse to, not the one git uses over SSH."
        - options: none, you type the address

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
     provider is picked.

     Persist the answers in ONE call, against this repository's own
     `.planning/config.json` (the default target - no `--file`, no `--global`):

     ```
     node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set \
       git.forge_provider=<provider> git.forge_repo=<owner/name>
     ```

     On the forgejo arm that same call carries `git.forge_host=<host>` as a
     third pair. On `github` and `gitlab` the pair is OMITTED entirely rather
     than written empty: null there means "fixed host, nothing to name", and an
     empty string would read back as an answered question.
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
release state. This is the input to every step below, not a report: do not
narrate the reading.
</step>

<step name="questioning">
Adopt asks only what the repo cannot answer. Whatever the survey READ is
ANSWERED: the goal a README states, the stack and the build commands a manifest
states, the shape the tree states, the direction the log states.

A question is legitimate only when it names something the repo does not state,
and asking it that way out loud is the test: "the README says what this
does but never who it is for"; "the log stops at the parser - what comes after
it?" A question that cannot name its gap is one the survey already answered.

**Background checklist** (mental, never a conversation structure):

- [ ] What this is (concrete enough to explain to a stranger)
- [ ] Why it needs to exist (the problem or desire driving it)
- [ ] Who it is for (even if just themselves)
- [ ] What "done" looks like (observable outcomes)

Weave in what is left naturally; do not switch to checklist mode. The REMAINING
work - what the user wants next - is the one thing no repo states and what
ROADMAP.md will be made of, so the questioning belongs there.

**Structured questions** go through the ask-user seam
(references/seam-ask-user.md):
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
list of things a project ought to state - each of those is forbidden here. The
coverage figures and thresholds the `testing_policy` step reports decide no
question here either.
</step>

<step name="write_project">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/PROJECT.md` and write
`.planning/PROJECT.md` from the survey.

- `### Validated` carries the SHIPPED capability - what the existing code
  already does, one line each.
- `## Context` carries the current state of the code: stack, layout, known
  rough edges, anything a later phase has to work around.
- `### Active` is REMAINING work only, framed as hypotheses until shipped.
- `## Key Decisions` seeds from choices the repo has visibly ALREADY made (the
  stack, a storage choice, a public interface), each with the rationale you can
  actually see in the code or the history. Never invent one.
- `## Out of Scope` entries always carry the reason.

The `### Active` milestone version is a PROPOSED NEXT version, confirmed with
the user through the ask-user seam (references/seam-ask-user.md), and never the
repo's current tag: /cad-health rule 7 reports an Active version in
`git tag --list` as drift. Propose the next one from the tag list (`v1.4.0`
shipped -> `v1.5.0` proposed), and offer the alternatives rather than deciding
alone:

- header: "Next version"
- question: "Which version should the next release of this project be? The latest one already released is {latest tag}."
- options:
  - "{proposed version}" - the next version after {latest tag}
  - "{alternative version}" - another version after {latest tag}, such as a larger step
</step>

<step name="write_requirements">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/REQUIREMENTS.md` and write
`.planning/REQUIREMENTS.md`.

- `## Active` is what is LEFT to build. Bullets in the stated grammar,
  `- **[CAT]-01**: [requirement]`, with a 3-5 letter category code that starts
  with a letter. What the code already does is Validated in PROJECT.md, not a
  requirement to deliver a second time.
- Each one specific, testable, user-centric and atomic: "User can X", never
  "System does Y", never "Handle Z".
- `## v2 Requirements` and `## Out of Scope` take what the repo or the user
  deferred, exclusions carrying their reason.
- `## Traceability` is left as BARE HEADERS. `/cad-plan` seeds each row when its
  phase is planned (`references/req-traceability.md`), and no row can be seeded
  before a plan exists.
</step>

<step name="testing_policy">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-testing.md` (one
consult site - this step) and follow its **Testing policy** arm here, after
`survey`'s reading and before the roadmap: one recommendation, Accept or
Adjust, written, rendered and checked.

Skip that section's publishing question. Ask nothing about publishing; say in
one line that verification publishing is off and that `/cad-config --testing` is
where to authorize it.

This step is the only place `testing.*` is written. It leaves `testing.*` in
`.planning/config.json` and writes `.github/cadence/coverage-policy.json`. Both
are staged by the `commit` step when `planning.commit_docs` is true. When it is
false they stay uncommitted, and the first CI plan task commits the policy file,
since `/cad-plan` puts that task first when `check` finds no gate.
</step>

<step name="write_roadmap">
Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/ROADMAP.md` and write
`.planning/ROADMAP.md`: the overview, an empty `## Phases` heading and every
`### Phase N:` detail section. It covers REMAINING work only, derived here -
there is no roadmapper agent.

1. Every `## Phases` entry is `- [ ]`. Never reconstruct shipped work as an
   `- [x]` phase: seeded rows are `Pending`, which /cad-health rule 5 flags under
   an `- [x]` phase. Shipped work is PROJECT.md's Validated section.
2. Phase count follows the `granularity` read in setup: coarse 3-5, standard
   5-8, fine 8-12. When in doubt, fewer.
3. Prefer vertical slices - each phase delivers something the user can exercise
   end to end - and order by dependency, stating each phase's `Depends on`.
4. 2-5 falsifiable success criteria per phase: observable statements that could
   be shown false. Never "X works".
5. Map every `## Active` id to exactly one phase - full coverage, no orphans,
   no double-mapping.
6. Only when a policy was accepted in `testing_policy`: a project below its
   accepted thresholds keeps them, and the first phase closes the shortfall and
   installs the gate together, completing when the required jobs pass. This
   holds when coverage reads `unknown` too, because the gate's first run gives
   the real figure. It is one of rule 2's counted phases, it maps no `## Active`
   id unless one is about this work, and its criteria are the thresholds met and
   the required jobs passing. It never lowers a threshold to make that easier.

Then enter each phase, in order, one add each and no hand-written line:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry add --phase <N> --name <name> --description <one line>
```

Then count what you just wrote:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" criteria-size --roadmap-min 2 --roadmap-max 5
```

No `--phase`: one call walks every phase the roadmap declares. Each `over` entry
names the phase, its measured count and the bound it broke. `roadmap_found:
false` is not zero criteria - that phase's block declares none at all, so write
them rather than report it as under the floor. A REPORT, not a gate: present it
and let the approval gate decide.

Present the roadmap inline (a table of phase, goal, REQ-IDs and the criteria
count the seam just reported, then the per-phase criteria, naming every `over`
phase and its numbers) and take it through the approval gate (ask-user seam):

- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" - save the roadmap and finish setup
  - "Change phases" - you tell me what to change, and I update the roadmap
  - "Show the whole file" - I print the roadmap file as written, then ask again

On "Change phases", take the feedback. Every change to the phase list goes
through a seam - a name or description, a new phase, a dropped one, an inserted
one whose slot `phase-entry add` fills:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry edit --phase <N> [--name <name>] [--description <one line>]
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry add --phase <N> --name <name> --description <one line>
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" renumber remove --n <N>
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" renumber insert --at <N>
```

The seam runs before the `### Phase N:` sections are hand-edited: a renumber
shifts every `Phase K` heading, so a section edited first is moved or removed
under the edit. Run `renumber insert` or `renumber remove` first, then
`phase-entry add` into the slot an insert freed, and only then edit the
overview, the `### Phase N:` sections and their criteria inline.

Run `criteria-size` again, re-present, and loop until approved. On "Show the
whole file", show the file and re-ask.
</step>

<step name="state">
Write the initial cursor through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
  --phase 1 --status "ready to plan" --next "/cad-context 1"
```

Create no `.planning/phases/` directory. A phase directory is
`.planning/phases/<N>/`, created lazily by the first skill that needs it; the
grammar for `<N>` is stated in `references/roadmap-phases.md`.
</step>

<step name="commit">
If `planning.commit_docs` is false, skip this step entirely and report the
commit line as "none - commit_docs is false".

Otherwise apply the protected-branch guard from references/git-guard.md now,
before this commit - it is the first commit of the cycle. (A repo with no
commits at all has nothing to branch from: skip the guard and let this commit
create the root commit on the current branch.)

Then ONE commit, `docs: adopt existing project into Cadence`, pushing nothing
and staging exactly the eight files written: `.planning/PROJECT.md`,
`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`,
`.planning/records/state.json`, `.planning/records/.gitignore`,
`.planning/config.json` and `.github/cadence/coverage-policy.json`.
</step>

<step name="done">
Report tersely:

```
Adopted: {project name}
Found: {one line - stack, size, release state}
.planning/: PROJECT.md, REQUIREMENTS.md, ROADMAP.md ({N} phases),
            STATE.md, config.json
Testing policy: {scope}, {lines}/{branches}; publishing off
Commit: {hash, or "none - commit_docs is false"}

Next: /cad-context 1
```

One suggestion, no menu. A `/clear` before it is safe - everything is on disk
in `.planning/`.
</step>

</process>

<guardrails>
- No subagent, ever. This workflow dispatches nothing.
- Never fabricate an answer the ask-user seam was supposed to collect.
- Nothing outside the canonical `.planning/` set is created: PROJECT.md,
  REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, records/state.json,
  records/.gitignore - and
  `.github/cadence/coverage-policy.json`, which the `testing_policy` step
  renders. No `phases/` dirs, no
  CLAUDE.md generation, no extra scaffolding.
</guardrails>
