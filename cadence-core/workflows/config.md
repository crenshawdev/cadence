# cad-config workflow

Configure `.planning/config.json`. Canonical shape and validation live in
`cadence-core/config.schema.json` (the source of truth), enforced by the
`bin/config.mjs` seam; `cadence-core/templates/config.json` is the scaffolded
default. One interactive skill; the substantive part is review-provider model
assignment, which is the only config knob that needs live detection rather than
a plain edit.

## 0. Locate config

Read `.planning/config.json`. If it is absent, this project has no config yet
(`cad-new-project` writes one for a blank page, `cad-adopt` for a repo that
already has code and history). Offer to copy the template into place; stop if
the user declines.

## 1. Route

Parse `$ARGUMENTS`:
- Starts with `--review`: go to **Review provider setup** (a trailing
  `redetect` just means re-run detection and reassign; same flow).
- Starts with `--surfaces`: go to **Risk surfaces** - re-open the one-time
  risk-surface question with the current answer and today's evidence beside it.
- Starts with `--testing`: go to **Testing policy** - accept or reopen the one
  project testing policy, then (only on this route) ask about verification
  publishing.
- Starts with `--roles`: go to **Roles interview** - the thirteen questions
  that say what each of the six roles costs. A trailing `--global` re-enters
  the full thirteen against the user-global layer instead of writing repo diffs.
- `--walk`: go to **Interactive menu (no args)** - the full walk of every knob.
- Starts with a `<key>=` token (a dotted key name, then `=`): go to **Direct set**.
  A value runs to the next `<key>=` token or the end, so it may hold spaces
  (`git.protected_branches=["main", "develop"]`). An `=` further into the text
  does not make it a setting.
- Any other text is a sentence: Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-menu.md`
  and follow its **A sentence**. A reply to the opening screen that is not a
  number from 1 to 6 goes the same way.
- Empty: Read the same file and follow its **Opening screen**. That file is also
  where the reply to the screen goes; Direct set never reads it.

The menu is opt-in. Before either of those last two arms, read the switch (a
repo value counts):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get workflow.config_menu
```

- `true`: the arms above work as written.
- Not `true` (the default is `false`): empty goes to **Interactive menu (no
  args)**, the walk, exactly as `/cad-config` did before the menu. A sentence, or
  a pick of a group, is not taken: say in one line that the menu is off, give
  `/cad-config workflow.config_menu=true` as the command that turns it on, read
  no menu file and write nothing.

A flag, `--walk` and `<key>=<value>` never read the switch.

## Interactive menu (no args)

Reached with `--walk`, or with no arguments while `workflow.config_menu` is off. Goal: let the user adjust every knob the walk carries, presented as
selectable lists, the twelve `roles.<role>.model` and `.effort` keys included. Two sets stay out:
`review.providers.*`, which needs live detection, so the menu routes it to
**Review provider setup** rather than free-typing model ids; and
`review.decision_review`'s two keys, which belong to an on-demand command
rather than the phase loop. The **Roles interview** below is the guided way
into the roles keys, one question per value with what it costs beside it; this
walk is the flat way.

### The walk

1. Read the current config. Show a one-screen summary (each knob = current value). Reached with no arguments, end it with this line: `A menu of six settings groups is off. /cad-config workflow.config_menu=true turns it on.`
2. Read the walk's rows with
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys --walk`
   (sections in walk order).
   Walk them **in order, 4 knobs per `AskUserQuestion` call** (the ask-user seam;
   its 4-option cap is why we page). For each knob:
   - one question; its text = the knob's `question`, options = the first item of
     each `explain` entry (`[value, text?]`),
   - **each option carries the entry's second item, `text`, as its
     `description`**,
   - **Label the value in force, and name the LAYER it comes from. Two labels,
     never zero.** Compare step 0's raw read of `.planning/config.json` against
     `config.mjs get`:
     - the knob IS in the repo file -> that option is `(current)`.
     - the knob is NOT in the repo file -> the effective value's option is
       `(in force)`, and its `description` opens by saying the value is active
       but INHERITED, and that picking it writes it into this repo.
     List the labelled option FIRST either way. An unlabelled option is the bug
     this replaces: `get` returns the effective value, so the old rule dropped
     the label to stop an inherited value being mislabelled `(current)` and
     pinned - but dropping it entirely left the user choosing with nothing on
     screen saying what is active. Name the layer; never hide what is set.
   - **A pick equal to the value already in force writes NOTHING**, on both
     arms: re-picking `(current)` and re-picking `(in force)` are each a no-op.
     This is what stops the walk pinning the whole global layer into the repo
     file page by page - a user who agrees with an inherited value is
     agreeing, not choosing to override it.
   - **A key with more than four options does not fit the seam.** The cap is 4
     options and `Other` is the free-type entry, so show the value in force plus
     the three the user is most likely to want, and name every omitted value in
     the last option's `description` with the words "reachable via `Other`".
     `review.triggers.<t>.gate` is the live case, at five.
   - A `hint` is shown as text, never offered as an option. A `null` entry on
     a list key explains the unset state and is not written, because `set`
     refuses it. A key with fewer than two options offers the value in force and
     a fixed `Leave unchanged`, both writing nothing; `Other` types a new value.
   - `type` says how a key is answered: `bool` and `enum` are picked;
     `int`, `string` and `string_or_null` are typed through `Other` (empty
     becomes `null`); `array_string` and `array_enum` are comma-typed and
     written as an array.
   - `src` and `repo_only` say which layer a key is written to: `global` is the
     user-global layer only (`set --global`), `repo` either layer, and
     `repo_only` is refused at the user-global layer.
   - The twelve `review.triggers.<t>.gate`, `.tier` and `.effort` keys are power
     knobs: give them their own page, or a "Review triggers?" opt-in step.
   - Picking `review.triggers.risk_surface.surfaces` opens **Risk surfaces**
     (`/cad-config --surfaces`), which scans the project first and offers
     answers from what it finds.
3. A page whose knobs the user leaves unchanged is a no-op, and so is a page
   where every pick matched the value already in force (step 2's no-op rule).
   Only a value that DIFFERS from what is in force is a diff, and only diffs are
   applied.
4. After the last page, show the changed keys as a diff. A value typed through
   `Other` can carry `$(...)`, which runs before Node starts, and the preview
   comes before the yes, so write each changed value as JSON to its own file in
   a directory this run made
   (`D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"`) and pass the
   preview and `set` each key as `<key>="$(cat <path>)"` (`references/conventions.md`,
   Caller-derived text). Run `config.mjs preview <key>="$(cat <path>)"…` once for
   the whole batch, show what it answers and ask for a yes in a turn of its own,
   then write via the
   **Validation seam** (`config.mjs set`) - one atomic, validated write per file.
   The preview's `files` says which file gets what; a batch for both layers is
   two `set` calls. The user may pick `Skip rest` on any page to stop and
   preview and write what changed so far.
5. `review.providers` is not in the page walk - offer it as a final step
   (`Configure review providers now?`) that enters **Review provider setup**.
6. Then run **Worktree base ref** below - a HOST setting, offered only when
   the config now in hand runs plans in parallel worktrees.

### Validation seam

`bin/config.mjs` is the enforcement point - the schema, not this doc, decides what
is valid. Never write config JSON by hand; go through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" validate            # whole file ok?
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" check <key=value>…  # dry-run one or more pairs
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set   <key=value>…  # validate then write (atomic: all-or-nothing)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset <key>…        # remove keys from ONE layer; absent key = ok, no bytes changed
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get   [key …]       # EFFECTIVE values (repo > global > defaults)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys                # dump schema (types/enums/defaults/purpose)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys --walk         # the walk's rows only: question + value explanations
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" preview <key=value>…  # read-only: the file, before and after, what changes
```

`get` is how every workflow reads config - the only read that sees the global
layer. Never read a config file raw for a VALUE. There are exactly three
exceptions, and every one of them asks which LAYER holds a key rather than what
the key says, which is the one question a merged read cannot answer: the walk's
layer labels (step 2); the **Roles interview**'s first-run test, which reads the
user-global file for the PRESENCE of a `roles` key; and the **Stakes
migration**, which reads both files for a key it is about to remove from them.

Each prints one JSON line (`{ok, …}`); `--file <path>` overrides the default
`.planning/config.json`, and `--global` targets the user-global layer at
`~/.claude/cadence/config.json` (`CADENCE_GLOBAL_CONFIG` relocates it), which
`set` auto-creates. Collect the menu's diffs and apply them with one `set` call
per file, so each write is one atomic, validated operation.

**Config layering.** At read time `bin/route.mjs` deep-merges global under repo
(precedence **repo > global > built-in defaults**); nested objects merge, arrays
replace wholesale. Each file is still validated on its own - every layer must be
independently valid. Use `--global` for machine-wide defaults - the model and
the start rung each role runs at, which is exactly what the **Roles interview**
writes there on a first run - and the per-repo file to override per project.

## Direct set

A `worktree.baseRef=…` pair is not a Cadence key and the seam would reject it
as unknown: route it to **Worktree base ref** instead, and say it is a Claude
Code setting the user's own settings file owns.

For each `key=value` (dotted paths allowed, e.g. `workflow.plan_check=false`):
- Validate and write in one shot through the **Validation seam**:
  `config.mjs set <key=value>…`. It rejects an unknown key, a bad value, a
  target file whose top level is not a JSON object, or a dotted path running
  through a container that already holds a non-object (`{ok:false,
  reason:"invalid", detail:[…]}`) atomically - nothing is written unless every
  pair is valid - and echoes `{ok:true, changed:[…]}` on success.
- `check` dry-runs the same pairs and speaks the same contract - `{ok:true}`,
  or `{ok:false, reason:"invalid", detail:[…]}` - without writing anything, and
  a key retired by a release carries a `detail` naming the key that replaced it,
  so that remediation needs no `keys` lookup.
- On rejection, surface the seam's `detail` (the invalid keys and why). For a
  per-key detail, look up the allowed values via `config.mjs keys`; for a
  `(root)` detail, that lookup returns nothing - the remediation instead is
  that the target file's top level is not a JSON object (repair or replace the
  file). A `cannot set through "…"` detail carries its own remediation: that
  container holds an array or a scalar and must be removed or replaced first -
  the seam will not overwrite it, because doing so would discard its contents.
  Do not retry with a malformed config.

## Worktree base ref (a HOST setting - offered, never written silently)

`worktree.baseRef` is a Claude Code setting, not a Cadence key: it is absent
from `config.schema.json`, never goes through `config.mjs`, and lives in the
user's settings files. It decides where a subagent worktree forks from, so the
parallel `/cad-execute` path depends on it - under its `"fresh"` default a
worktree branches from the remote default branch and an executor arrives
without this phase's CONTEXT or its own PLAN file, which is why `choose_path`
refuses to parallelize there (`references/seam-spawn-agent.md`, Worktree
isolation; Claude Code >= 2.1.208). Inside a worktree, `"head"` means that
worktree's own `HEAD`.

Run this step whenever `parallelization.use_worktrees` is true in the config as
it now stands, WITHOUT also requiring `parallelization.enabled`. Gating it on
`enabled` was circular: the step is what makes `enabled` do anything, so a user
who turned parallelization on by editing config.json directly never reached it
and every run degraded to sequential in silence. Skip the step only when
`use_worktrees` is false, where worktrees genuinely cannot be used.

1. Read the effective value:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/worktree-base.mjs" resolve
   ```

2. `parallelSafe: true` -> say so in one line (the value and the file it came
   from) and stop. Nothing to change.
3. Otherwise ask through the ask-user seam, quoting the exact JSON
   (`"worktree": { "baseRef": "head" }`) and naming the file each option
   writes: the project's `.claude/settings.json` (recommended - it travels
   with the repo, so every clone's parallel runs behave the same) /
   `~/.claude/settings.json` (all projects) / leave it (parallel execution
   keeps falling back to sequential). Declining is a valid answer and ends the
   step - a plugin does not overrule a user's settings.
4. On accept: READ the target file first and show the user its current
   `worktree` block (or that there is none), then merge the one key in,
   preserving every other setting byte-for-byte, and write it back. Never
   replace a settings file wholesale, never write one whose contents you did
   not read, and never touch a managed-policy file - a higher layer keeps
   winning, so the write would be a lie. Re-run the seam and report the value
   it now resolves to and the file it came from.

## Risk surfaces (`--surfaces`)

The one configuration question Cadence asks on its own - which of the eight risk
surfaces the blocking `risk_surface` trigger fires on - reached deliberately,
with the evidence beside it, and answerable again after the repository has
changed shape. The first fire asks it once
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md`); this arm
is the way back to it, and re-entering it must never cost the user the answer
they already gave.

1. Read the effective answer through the **Validation seam** (below):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get review.triggers.risk_surface.surfaces
   ```

   Never a raw read of `.planning/config.json` for a workflow value - the lone
   exception is the interactive menu's `(current)` label, and this is not it. A
   `null` value means nobody has answered and all eight stand.

2. Scan the structure for what it evidences NOW:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" detect-surfaces --root . --answered <a,b,c>
   ```

   `--answered` carries step 1's answered set, comma-separated. DROP the flag
   entirely when step 1 returned `null`: the flag's absence is what says nobody
   has answered, and a `--answered` with nothing usable after it is refused.

3. Show the two SIDE BY SIDE before asking anything - the answered set, and each
   category the envelope's `evidenced` names with its `signal` string - and call
   out every evidenced category the answered set does not contain. That gap is
   the whole reason this arm exists: a project that added Stripe six months
   after answering has no other way to see it. When the scan reports
   `inconclusive: true`, say plainly that the structure evidences nothing either
   way rather than reporting it as a clean bill - silence is never absence
   (D-14), and the recommendation stays all eight.

4. Ask through the ask-user seam
   (`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`),
   rendering the envelope's `options` array in the order it arrives: at most
   four options per
   question, the first labelled `(recommended)`, and that label is a display
   convention and never a pre-selection - the user still chooses and the seam
   still blocks. Each option's own `reason` is what it states beside it, and
   this step composes no options of its own. Carry the LEGEND with the question:
   read the eight one-line category definitions from
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` and present
   them verbatim as the question's context. This arm is the one a user reaches
   deliberately, so it is the one most likely to be read by someone who does not
   already know what `api_contract` means, and it is the path that passes the
   legend nowhere else. Say plainly that keeping the
   current answer and declining are both valid answers.

5. Write ONLY on an explicit pick, through the **Validation seam**, at the repo
   layer:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set 'review.triggers.risk_surface.surfaces=["secrets","destructive"]'
   ```

   A decline calls no `set` and edits no file, so `.planning/config.json` stays
   byte-identical and the existing answer survives. Nothing on this arm writes a
   default and nothing re-asks on its own.

## Testing policy (`--testing`)

Accepts one project testing policy, once, from one recommendation. This is the
one statement `/cad-new-project` (before its roadmap) and `/cad-adopt` (after
the survey, before the roadmap) follow, the way they follow the **Roles
interview** arm; `--testing` reopens it with the answer in force beside what
the project shows today. The rules and command shapes it recommends from are in
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/test-policy.md` (one consult
site - this section). This section points at them and restates none.

1. Read the answer in force. `testing.scope` `null` means nothing was accepted:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
     testing.scope testing.coverage.lines testing.coverage.branches testing.coverage.statements \
     testing.coverage.include testing.coverage.exclude testing.coverage.commands \
     testing.strong_areas testing.required_jobs
   ```

2. Read the project yourself: the workflow files under `.github/workflows/`, the
   coverage settings in the manifests and tool configs, and any coverage report
   it already has. No detector seam and no per-tool parser. Quote each existing
   threshold and exclusion with its file and line. Look for the packaging signals
   `test-policy.md` lists; where one is present, packaging is relevant and its
   job is named in `testing.required_jobs`, because the nine keys are fixed. A
   blank-page project has no code to inspect: it accepts from the stated stack
   and every coverage figure reads `unknown`.

   On the `--testing` route only, resolve the forge too, because enforcement
   reads it and setup has not run here. Run
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" detect --dir .` and
   follow the **Pick a forge** item of
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/adopt.md`. A refusal or a declined
   answer leaves it unset: say so and carry on, because `check` in step 4 names it.

3. Present ONE recommendation through the ask-user seam
   (`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`) with two
   options, Accept and Adjust, and no third. It carries:
   - the testing scope (`focused`, `integrated` or `thorough`) and why it fits
     this project;
   - line and branch thresholds, starting at 85 each or at any higher existing
     value;
   - the production scope, its exclusions and the CI commands, from the shapes
     in `test-policy.md`;
   - strong areas, each with the requirement or plausible consequential defect
     that justifies deeper tests, the answered risk surfaces counting as well;
   - the required jobs, and whether packaging applies;
   - how this differs from the existing setup;
   - any metric this stack cannot measure.

   Label each coverage figure measured, estimated or unknown. An estimate never
   reaches a threshold or a command. A threshold is never lowered because
   coverage is lower: a project below its thresholds keeps them, and the
   recommendation reports the shortfall and names the work. A lower threshold, a
   disabled metric or a wider exclusion is made only by an explicit adjustment,
   and is shown as one.
   - **Go:** `statements: 85`, `lines: 0`, `branches: 0`. Say plainly that 85 is
     a separate statement threshold, not an equivalent of the line threshold,
     and that Go measures neither lines nor branches.
   - **Rust on stable:** say branches cannot be measured there. The user chooses
     nightly branch measurement or an explicit `branches: 0`.

   Accepting either is the explicit adjustment, and later reports show those
   metrics as disabled. On Adjust, take the changes in prose, re-present, and
   loop until Accept.

4. On Accept, write the policy in ONE `config.mjs set`. The list values hold
   text derived from the repository, so each is written as JSON to a scratch
   file with the Write tool inside a directory this run made, and passed as
   `<key>="$(cat <path>)"` (`references/conventions.md`, Caller-derived text):

   ```
   D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"
   ```

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set \
     testing.scope=<scope> testing.coverage.lines=<n> testing.coverage.branches=<n> testing.coverage.statements=<n> \
     testing.coverage.include="$(cat <D>/include.json)" testing.coverage.exclude="$(cat <D>/exclude.json)" \
     testing.coverage.commands="$(cat <D>/commands.json)" testing.strong_areas="$(cat <D>/strong.json)" \
     testing.required_jobs="$(cat <D>/jobs.json)"
   ```

   Commands keep their `{lines}`, `{branches}` and `{statements}` tokens
   unfilled. Then render the policy file and check it, and report the answer:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" test-policy render --root .
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" test-policy check --root .
   ```

   A project with no gate yet reports its accepted commands and required jobs
   missing from the workflow files, and the policy file untracked. That is
   expected: `/cad-plan` puts the CI task first when `check` finds no gate, and
   that task commits the file.

5. Publishing is a separate question, asked ONLY when this arm was reached by
   `--testing`. Setup never asks it: it says verification publishing is off and
   that `/cad-config --testing` is where to authorize it. Read the state from
   `check`'s `publish_authorized`, and say what it authorizes: `/cad-verify`
   pushes the current non-protected branch to its configured remote with nobody
   present, so CI can run on the commit it records as pending. Ask through the
   ask-user seam, the current state first. On an explicit yes, write it into this
   repository's own `.git/config` and nowhere else:

   ```
   env -u GIT_DIR -u GIT_COMMON_DIR git config --local cadence.publishForVerification true
   ```

   When it is on, the same question can turn it off with `false`. A decline or
   no answer writes nothing. It is never stored in `.planning/config.json` or a
   global file.

## Roles interview (`--roles`)

Thirteen questions that decide what each of the six roles costs: a model and a
start rung for each, then one question about the risk floor. There is no level
and no grid behind them - `roles.<role>.model` and `roles.<role>.effort` are the
whole answer - so the questions themselves are the documentation. Each one says
what the role does in the phase loop and what the choice costs there.

Reached four ways: `/cad-config --roles` on demand; `/cad-config --roles
--global` to re-enter the full thirteen against the user-global layer; the
first-run pass `/cad-new-project` and `/cad-adopt` run after the template copy;
and the **Stakes migration** arm below, which runs the same questions over an
expanded level.

### 1. Which layer this run writes

Read the user-global file (`~/.claude/cadence/config.json`, or wherever
`CADENCE_GLOBAL_CONFIG` points) raw, and for the PRESENCE of a `roles` key only.
This is one of the three raw-read exceptions the **Validation seam** lists, for
the reason it states: `config.mjs get` merges the layers, so it cannot say which
one HOLDS a key.

- **First run** - that file has no `roles` key, or does not exist. Ask all
  thirteen. Write all twelve values plus the floor answer in ONE
  `config.mjs set --global`, whatever the user picked. This is the one place the
  walk's "a pick equal to the value in force writes nothing" rule is
  deliberately suspended: a first run where the user accepted every default
  would otherwise leave no `roles` key on disk, which is the exact state this
  step reads as a first run, and the interview would re-ask forever.
- **Any later run** - `/cad-config --roles` in a repository, or the confirmation
  the two init workflows run once the global layer is populated. Show the twelve
  values in force with their layer labels (the walk's two-label rule) and write
  ONLY the diffs, through a plain `config.mjs set`, into `.planning/config.json`.
  A pick equal to the value in force writes nothing here.
- **`--roles --global`** - the full thirteen again, against the user-global
  layer, with `config.mjs set --global`. This is the way back into machine-wide
  defaults; without it they could only be revised one key at a time.

Name the file the write landed in, by path, before the run ends.

### 2. The four calls

Thirteen questions do not fit one call. The ask-user seam
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`) takes at most
four questions per call and at most four options per question - two caps, not
one. Ask them in rung-map order, four calls:

1. `cad-planner` model, `cad-planner` effort, `cad-assumptions-analyzer` model,
   `cad-assumptions-analyzer` effort.
2. `cad-verifier` model, `cad-verifier` effort, `cad-reviewer` model,
   `cad-reviewer` effort.
3. `cad-executor` model, `cad-executor` effort, `cad-plan-checker` model,
   `cad-plan-checker` effort.
4. The risk floor.

Every question carries a default: the value in force, listed FIRST and labelled
by the walk's two-label rule - `(current)` when the layer being written already
holds it, `(in force)` when it is inherited, and an inherited option's
`description` opens by saying so.

### 3. The model question, per role

Ask the role's question, word for word:

- `cad-planner`: "Which model writes your plans? Everything built later follows them, so a stronger model costs more here and saves rework later."
- `cad-assumptions-analyzer`: "Which model lists what a phase assumes, before any plan exists? It runs once a phase, so a stronger model costs little and catches a wrong premise early."
- `cad-verifier`: "Which model checks whether a phase met its goal, not just whether its tasks ran? It runs only when the deeper check is on, and a stronger one misses less."
- `cad-reviewer`: "Which model runs the Claude reviewer? It runs on every review, so a cheaper model saves the most here and a stronger one catches more."
- `cad-executor`: "Which model writes the code, one run per plan? It is the largest cost in a phase, so a cheaper model saves the most and a stronger one makes fewer mistakes."
- `cad-plan-checker`: "Which model checks each plan before any code is written? It runs only when plan checking is on, and the work is short, so a cheaper model often does."

Options, in this order, up to the cap of four:

1. **The value in force**, labelled `(current)` or `(in force)`. When no layer
   sets it, that value is `null` and its description is "use your session's
   model".
2. `opus` - "strongest, costs the most".
3. `sonnet` - "in the middle; most work fits here".
4. `haiku` - "cheapest, least capable".

Never list the value in force twice: whichever of those it already is, the
remaining options fill the slots. `fable` is a fifth name the host accepts and
is deliberately NOT offered outright - name it in the last option's
`description` as reachable via `Other`, with the reason: choosing it is an
assertion about your own organisation (it needs 30-day data retention, and it
refuses some security review work), not a rung on a ladder.

`Other` is free-typed and goes into config exactly as typed - the key is a
string, not an enum, so nothing rejects a name this host has never heard of.
Echo `config.mjs set`'s `changed` array back to the user, so the exact string
that landed is on screen at the moment it lands rather than at the first
dispatch. A model the host does not accept still resolves `ok:true` and
dispatches with NO model parameter, naming the string in the resolve's
`warnings[]`.

### 4. The effort question, per role

Ask the role's question, word for word:

- `cad-planner`: "How hard should the planner work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-assumptions-analyzer`: "How hard should the assumptions analyzer work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-verifier`: "How hard should the verifier work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-reviewer`: "How hard should the Claude reviewer work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-executor`: "How hard should the executor work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-plan-checker`: "How hard should the plan checker work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."

The rung is where the role STARTS; `model.escalate_on_failure` re-dispatches a
failed attempt one rung higher, holding at the top.

Six values - `low`, `medium`, `high`, `xhigh`, `max` and `null` - do not fit the
four-option cap, so this takes exactly the rule the walk already states for
`review.triggers.<t>.gate`: show the rung in force plus the three the user is
most likely to want, and name every omitted rung in the last option's
`description` with the words "reachable via `Other`". A rung silently absent
reads as a rung that does not exist. The descriptions are: `low` "light
thinking, fastest", `medium` "moderate thinking", `high` "deep thinking",
`xhigh` "very deep thinking, slower", `max` "the deepest thinking, slowest and
costliest", and `null` "use the default for this role".

`null` is a real answer and means "this key does not pin the rung, so the
schema default decides" - which is how a repo layer un-pins a global one.

### 5. The floor question

One question, and the only one that is not per role. Ask it word for word:

"Which risky areas should not make a phase's plan review blocking or turn on the deeper check? The review of the actual changes still runs."

A plan Cadence could not read raises the bar too, on purpose, because a scope
nobody read has proved nothing. No role's model or rung moves; what you just set
is what dispatches.

Carry the eight category definitions from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` as the
question's context, exactly as **Risk surfaces** does - this is the other arm
where a user meets the category names.

Options:

1. **Keep it for every area** `(recommended)` - "Every risky area keeps the
   blocking plan review and the deeper check." Writes nothing, because a config
   with no waiver key is already in that state.
2. **Choose areas to skip** - "The areas you pick no longer make the plan review
   blocking or turn on the deeper check. The review of the actual changes still
   runs." Writes `review.triggers.risk_surface.waive_routing_floor` with the
   picked categories, for those categories only. It does NOT turn off the
   `risk_surface` review itself, which still fires on the actual diff and which
   this key cannot reach.

Two of the six roles are unaffected by this answer whatever it is: `cad-planner`
and `cad-assumptions-analyzer` are dispatched before a plan exists, so there is
no plan for the floor to read.

### 6. Writing

Collect every diff and apply it in ONE `config.mjs set` (or `set --global`)
through the **Validation seam** - one atomic, validated write, the same rule the
menu walk follows. Then show the seam's `changed` array back and name the file
it wrote to.

## Stakes migration (a retired routing key is still on disk)

The single level that decided every role's model and effort is retired, nothing
routes from it, and `config.mjs validate` refuses a file that still carries it.
Open this arm whenever a `config.mjs get` or a `route.mjs resolve` envelope
comes back carrying the retired-key warning that names it. That warning is the
only trigger, so a config which never held the key never reaches this arm and
nothing re-asks on its own. Do not relay the warning and carry on: run the
migration, then re-issue the command that produced it.

1. Read `.planning/config.json` and the user-global file RAW, each on its own,
   for a top-level `stakes` key. This arm is about to remove that key from those
   files, so the raw read is the job rather than an exception to it.

2. Expand EACH layer that holds the key independently, against its OWN value.
   The global file's level becomes the global roles block; the repository file's
   level becomes the repository roles block. Never write one expansion to both
   layers: a machine sitting at `solo` beside this repository at `critical`
   would otherwise hand every other project on it critical's models and rungs.
   A layer that does not hold the key is not written at all.

   | Was | Model, per role | Start rung, per role |
   |---|---|---|
   | `solo` | `sonnet` for all six | planner `high`, analyzer `high`, verifier `high`, reviewer `medium`, executor `high`, plan checker `low` |
   | `shipped` | `opus` for all six except the plan checker, which is `sonnet` | planner `high`, analyzer `high`, verifier `medium`, reviewer `high`, executor `high`, plan checker `medium` |
   | `critical` | `opus` for all six | `xhigh` for all six |

   That table is the last copy of the retired routing grid anywhere in this
   repository, and it is prose this arm reads - no code reads it, and nothing
   else in the tree hand-copies a model name.

3. Show the twelve values PER LAYER before writing anything - "your machine-wide
   `solo` becomes these twelve; this repository's `critical` becomes these
   twelve" - then run them through the **Roles interview**'s questions so the
   user confirms or adjusts each one. Same thirteen questions; the only
   difference is that the value in force starts at the expanded row rather than
   at the schema default.

4. Write each layer's own answers through the **Validation seam** -
   `config.mjs set --global …` for the user file, plain `config.mjs set …` for
   the repository file - and then remove the key from every layer that held it:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset stakes
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset stakes --global
   ```

   Run only the line for a layer step 1 found the key in. `unset` on a layer
   that does not hold it is `ok:true` and changes no bytes, but what you report
   back has to name the files that were actually edited.

5. Say in ONE line what did NOT come across. The level also decided the review
   gates, the cross-model reviewer tiers and efforts, and whether the deep
   verify pass ran; none of those is migrated. They now come from
   `cadence-core/config.schema.json`'s own defaults, so a project that leaned on
   a `critical` row's gates has to state them itself - `review.triggers.<t>.gate`,
   `review.triggers.<t>.tier` and `review.triggers.<t>.effort` are in the
   walk, and the deep pass now runs when the risk floor raises rather than
   when a level said so, with `workflow.verifier` still its off switch.

## Review provider setup (cold branch)

The assignment flow (detect -> classify -> assign -> write) lives in
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-review.md` - Read it and
follow it when `--review` was passed or the user opts in from the menu. It
rejoins here at **Wrap-up**.

## Wrap-up

Summarize the final tier map per provider and note which triggers now have a
cross-model reviewer (a trigger whose `tier` resolves to a non-null id on a
reviewer that both this repository's and the user-global `review.reviewers`
name). Remind the user this is re-runnable (`/cad-config
--review`) and is auto-offered when a review fails with a model-not-found /
deprecated error (trouble-triggered redetect, wired in the review dispatch).

**Flag dangling enrollment, user-global half included.** If `review.reviewers`
names a cross-model provider (`openai`/`gemini`) but one or more `review.triggers.<t>.tier`
values resolve to `null` for it (that provider's tier is unassigned), say so
explicitly: the trigger silently falls back to `claude-subagent`, so the
cross-model setup is inert for it. Name the trigger and the empty tier and
offer to assign it or drop the provider from `reviewers`. Flag too a provider
this repository's `review.reviewers` names but the user-global config's does
not: the user-global config must name it too, or every trigger drops it. A
config that enrolls a reviewer it cannot actually reach should never look
configured.

## Degradation contract

If detection fails for everything (offline, no keys, rate limited), the review
subsystem still works via `claude-subagent`; consult is simply not offered.
cad-config only ever writes validated ids and never blocks the spine on a
network call.
