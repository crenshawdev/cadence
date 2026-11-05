# The review panel as a workflow

Step 4 of `references/review-triggers.md` sends a fire here when it takes the workflow path. This file is one procedure, in order. The record's mechanics are `references/review-record.md`'s and the triage is `references/triage-gate.md`'s, and neither is restated.

The reviewers and one checker per finding per raising voice run inside `workflows/review-panel.js`. Steps 1 to 3 of the fire stay with you, and so do the merge, the record and the triage. From the launch to the notice you dispatch nothing else: end the turn at the launch.

## 1. Compose `args`

One object:

- `trigger`, `instruction`, `artifact`: step 2's.
- `reviewers`: step 3's set. A name other than `claude-subagent` comes back as a voice that did not run, and the seam lists it as dropped.
- `agent_type`, `model`: the step-1 resolve's, `model` null when it answered none.
- `checker_artifact`: a checker holds no Bash, so it opens one file with Read. Make this run's scratch directory first, `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")"`, and keep every file of this run in it. On a refs fire write the range's diff to a file there, the way step 2's shape (c) does, and pass its path. On a staged scope write the staged diff the same way. On a path fire pass the same path as `artifact`.

## 2. Launch

Launch the `Workflow` tool by its named entry `cadence:review-panel` with `args`. If the name does not resolve, launch it with `scriptPath` set to `${CLAUDE_PLUGIN_ROOT}/workflows/review-panel.js`. The result prints `Transcript dir` and `Run ID`, so keep both.

A launch the host refuses is named in one line, and this fire's steps 4 and 5 run on today's path, because no workflow ran. Otherwise end the turn.

## 3. On the notice

The notice holds run totals and cuts a long result short, so the seam reads the run file whole: `workflows/<Run ID>.json` under the session directory `Transcript dir` names.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-run --phase <N> --run-file <run file> --out-dir <scratch directory> [--answers-file <path>]
```

It writes `payload.json` (the record's payload), `survivors.json` (the review file's input) and `answers.json` (what you have answered so far) into the scratch directory, and prints one envelope: `counts`, the `voices` that ran, the voices `dropped` with their reasons, `unruled`, `needs_answer`, `ready` and, when it is not, `not_ready`. It adds no ruling of its own.

- **`unruled`** lists findings with no usable ruling: a checker returned nothing, or its ruling the record cannot store (a refutation with no counter-evidence file, a finding ruled neither with no next check, a blank heading). Open the cited code and rule each one yourself.
- **`needs_answer`** lists survivors raised at `blocker` or `high`, which the record takes only with a fix commit or an override. A survivor ruled neither is marked `suspected`.
- **Answers** are a file, `{"answers": [{"voice": ..., "index": ..., ...}]}`, with the voice and index the envelope names. A ruling is `ruling` (`survived`, `downgraded` or `refuted`) with `counter_evidence` for a refutation, a `severity` below the raised one for a downgrade, and any of the six texts the finding lacks. A settlement is `fix_commit` or `overridden: true`. Run the same call again with `--answers-file`: earlier answers are kept, and a later answer replaces only its own group on its own finding.

Repeat until `unruled` is empty and `ready` is true.

A call the seam refuses has already run and spent its agents, so today's path is not run as well. Name the reason in one line, treat the gate as one that could not be evaluated, the arm `references/triage-gate.md` states, and ask whether to run this fire once more on today's path or move on.

## 4. Merge, then the file, the record and the triage

Merge duplicates and group shared root causes by editing `survivors.json`: join the `voices` of survivors that are one finding and set a one-line `root_cause` on those that share one. The rulings are already in `payload.json` per voice, so the merge costs the record nothing.

Then run the review file seam on `survivors.json`, write the record and the receipts from `payload.json`, and triage, as `references/review-record.md` and `references/triage-gate.md` state.
