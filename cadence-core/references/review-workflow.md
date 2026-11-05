# The review panel as a workflow

Step 4 of `references/review-triggers.md` sends a fire here when it takes the workflow path. This file is one procedure, in order. The record's mechanics are `references/review-record.md`'s and the triage is `references/triage-gate.md`'s, and neither is restated.

The reviewers and one checker per finding per raising voice run inside `workflows/review-panel.js`. Steps 1 to 3 of the fire stay with you, and so do the merge, the record and the triage. From the launch to the notice you dispatch nothing else: end the turn at the launch.

## 1. Compose `args`

Make this fire's scratch directory first and print it: `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "scratch dir: $D"`. Keep the printed path and write it as a literal into every later call, because each Bash call starts with `$D` empty. Every file of this fire lives in it, and no two fires share one.

One `args` object:

- `trigger`, `instruction`, `artifact`: step 2's.
- `reviewers`: step 3's set.
- `agent_type`, `model`: the step-1 resolve's, `model` null when it answered none.
- Each provider in the set, composed before you launch. Run `references/review-cross-model.md`'s composer as written, check the run token there, and take the model, tier and effort off the step-1 line. Then pass:
  - `wrapper_agent_type`: the `agent_type` that `route.mjs agent-type --stem cad-reviewer-low` prints.
  - `providers`: `{"<name>": {"line", "envelope", "timeout_ms", "model"}}`. `line` is that file's seam call whole, with `--trigger <trigger>` on it and every path absolute, `${CLAUDE_PLUGIN_ROOT}` written out, because the variable is unset in a workflow agent. `envelope` is a new path in the scratch directory, where the wrapper tees the provider's own output. `timeout_ms` covers `review.request_timeout_ms`, at most 600000. `model` is the provider's, for the record.
- `checker_artifact`: a checker holds no Bash, so it opens one file with Read. On a refs fire write the range's diff to a file in the printed directory, the way step 2's shape (c) does, and pass its path. On a staged scope write the staged diff the same way. On a path fire pass the same path as `artifact`.

## 2. Claim, then launch

Every workflow launch claims first. The label is `<trigger>-<discriminator>`, this fire's own:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-claim take --fire <trigger>-<discriminator>
```

The seam reads the multi-workflow setting from both config layers itself, so never answer for it from memory. `launch: true` means go on, and a win prints the claim's `id`: keep it as a literal, since the release runs in a later turn where nothing is remembered. `launch: false` names the `holder`, its `holder_id` and its `age_seconds`:

- This session holds it, because a fire of yours is awaiting its notice: queue this fire, launch nothing, and run this step again right after that notice's release below.
- Another session holds it, or this session holds nothing awaiting a notice, so the holder may be dead: name the holder and its age, and ask through the ask-user seam. The choices are to check again, or to take today's path for this fire. An old claim from a dead session is cleared through that same ask: release it with `workflow-claim release --fire <holder> --id <holder_id>`, the id the losing take printed, then take the claim again. A holder whose `holder_id` is null predates ids: clear it the same way with `--stale` in place of `--id`.

Launch the `Workflow` tool by its named entry `cadence:review-panel` with `args`. If the name does not resolve, launch it with `scriptPath` set to `${CLAUDE_PLUGIN_ROOT}/workflows/review-panel.js`. The result prints `Transcript dir` and `Run ID`, so keep both.

A launch the host refuses is named in one line, this fire's steps 4 and 5 run on today's path because no workflow ran, and its claim is released at once, since no notice will ever come:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-claim release --fire <trigger>-<discriminator> --id <the id take printed>
```

Otherwise end the turn.

## 3. On the notice

The notice holds run totals and cuts a long result short, so the seam reads the run file whole: `workflows/<Run ID>.json` under the session directory `Transcript dir` names.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-run --phase <N> --run-file <run file> --out-dir <the scratch directory printed in step 1> --payload-ref <the payload reference step 2 assembled> [--answers-file <path>] [--notice-tokens <n> --notice-turns <n> --notice-duration-ms <n>]
```

Release the claim right after this call returns, whether it succeeded or refused, with the `workflow-claim release` line from step 2, carrying the same `id` literal. The run is over either way, and a queued fire starts on it.

The same call bills the run, before it judges anything, so a killed or refused run still pays for its agents: one bracket per agent in the run file, each with its own tokens, turns and duration. Reviewers bill under `cad-reviewer`, checkers under `review-checker` and a provider wrapper under `review-provider-wrapper`, so `cad-reviewer`'s total still means the reviewers. An agent that did not finish closes as a checkpoint. Write no bracket by hand, and calling it again is safe: a run is billed once. When the run file cannot be read or holds no agent rows, pass the notice's totals (its tokens, tool uses and duration in ms, as plain whole numbers) and it bills them as one `review-workflow` bracket.

A provider voice runs through a wrapper agent that only runs its line and retypes the envelope, and a retyping can change a byte. So the seam judges the voice on the envelope file, which wins. A finding whose copy its checker read differs from the file, or that the agent left out, keeps no ruling and lands in `unruled` with the nulls, and a retyped finding the file does not hold is dropped. With no readable envelope the seam uses the agent's own return. `notes` names each of these, `providers` says which source each voice came from, and a provider that reports `ok:false` is in `dropped` with its reason.

It writes `payload.json` (the record's payload), `survivors.json` (the review file's input) and `answers.json` (what you have answered so far) into the scratch directory, and prints one envelope: `counts`, the `voices` that ran, the voices `dropped` with their reasons, `unruled`, `needs_answer`, `ready` and, when it is not, `not_ready`. It adds no ruling of its own.

- **`providers` and `notes`**: print each `notes` line as it stands. Say in one line how many credential-shaped spans a voice's `redactions` replaced before sending, and relay its `warnings`, as `references/review-cross-model.md` states.
- **`unruled`** lists findings with no usable ruling: a checker returned nothing, a provider finding's checked copy differs from the envelope, or its ruling the record cannot store (a refutation with no counter-evidence file, a finding ruled neither with no next check, a blank heading). Open the cited code and rule each one yourself.
- **`needs_answer`** lists survivors raised at `blocker` or `high`, which the record takes only with a fix commit or an override. A survivor ruled neither is marked `suspected`.
- **Answers** are a file, `{"answers": [{"voice": ..., "index": ..., ...}]}`, with the voice and index the envelope names. A ruling is `ruling` (`survived`, `downgraded` or `refuted`) with `counter_evidence` for a refutation, a `severity` below the raised one for a downgrade, and any of the six texts the finding lacks. A settlement is `fix_commit` or `overridden: true`. Run the same call again with `--answers-file`: earlier answers are kept, and a later answer replaces only its own group on its own finding.

Repeat until `unruled` is empty and `ready` is true.

A reviewer that returned nothing never reads as a verdict. Name each voice in `dropped` in one visible line with its reason before you go on. When none were left, the script already ran the `claude-subagent` fallback once (that voice is in `voices`). Rule each `unruled` finding by opening the code it cites, as today's path does, and answer with its ruling and all six headings, so its survivor's section is not missing from the review file.

A call the seam refuses has already run and spent its agents, so today's path is not run as well. Name the reason in one line, treat the gate as one that could not be evaluated, the arm `references/triage-gate.md` states, and ask whether to run this fire once more on today's path or move on. That includes `run-no-voice`, where even the fallback returned nothing: never say adjudication killed everything.

## 4. Merge, then the file, the record and the triage

Merge duplicates and group shared root causes by editing `survivors.json`: join the `voices` of survivors that are one finding and set a one-line `root_cause` on those that share one. The rulings are already in `payload.json` per voice, so the merge costs the record nothing.

Then run the review file seam on `survivors.json`, write the record and the receipts from `payload.json`, and triage, as `references/review-record.md` and `references/triage-gate.md` state.

## Where each site resumes

The launch ends the turn at every site, and the notice resumes the site's own step 4. Triage and applying what the user named then continue there:

- `plan` (`/cad-plan`, `/cad-plan-review`): the triage, then the named survivors into the plan files, then the commit step.
- `diff` and `phase_diff` (`/cad-execute`): the triage, then the named survivors through the executor continuation, then the next plan's dispatch.
- `/cad-verify`'s fix diagnosis: the triage, then step 2's proposal for only what the user named.
- `risk_surface` from `/cad-debug` and `/cad-task` at `adjudicated`: the triage, then their own step that fired it.

## Two notices close together

With multi-workflow on, two fires can be running. Each keeps its own scratch directory and its own run file, and a notice is handled only against its own fire: its `Run ID`, its directory, its label. Run step 3's call as each notice arrives, since that bills the run and frees its claim. A triage question ends the turn, so a second notice that arrives meanwhile waits its turn: its survivors are presented after the first's answer is applied, one question at a time, each naming its trigger and discriminator so the user can tell the fires apart. Nothing is merged across fires.
