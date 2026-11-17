# cad-config testing policy (cold branch)

Loaded from config.md's **Testing policy** arm, and opened directly by
`/cad-new-project` and `/cad-adopt` at their `testing_policy` step.

## Testing policy (`--testing`)

Accepts one project testing policy, once, from one recommendation. This is the
one statement `/cad-new-project` (before its roadmap) and `/cad-adopt` (after
the survey, before the roadmap) follow, the way they follow `workflows/config.md`'s
**Roles interview** arm; `--testing` reopens it with the answer in force beside what
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

2. Read the project yourself. The policy works with GitHub Actions only, so read
   the workflow files under `.github/workflows/`, the coverage settings in the
   manifests and tool configs, and any coverage report it already has. No
   detector seam and no per-tool parser. Quote each existing
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
