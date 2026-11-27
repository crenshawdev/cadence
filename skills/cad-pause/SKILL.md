---
name: cad-pause
description: "Pause work cleanly - a WIP commit of in-flight changes plus a STATE cursor set to paused with a one-line resume pointer (/cad-progress offers to resume it)"
argument-hint: "[one-line note about where you are]"
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - PushNotification
---

<objective>
Commit the in-flight changes as WIP and write the STATE cursor, which
/cad-progress finds and offers to resume.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
On an agile project (`.planning/agile/` exists and `.planning/PROJECT.md`
doesn't), stop before anything else, with this line and nothing after it: "This
project is on the agile path. /cad-agile shows what comes next."

1. **WIP commit.** If the tree has changes, stage exactly what the user was
   working on and commit `wip: <short description>` (protected-branch guard
   applies - references/git-guard.md). If the tree is clean, skip this.

2. **Set the cursor** through the seam (never hand-edit STATE.md):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
     --phase <current> --status paused --next-file <path>
   ```

   The resume pointer is a one-line "where I was" naming the next concrete
   action (from `$ARGUMENTS`, or ask via the ask-user seam if not given) -
   the user's own sentence: write it to a scratch file and pass the PATH
   (caller-derived text - references/conventions.md).
   This line IS the pause note /cad-progress surfaces. `--phase <current>` is
   required - the seam does NOT preserve a prior `Phase:` (it fails `bad-args`
   without it); supply the current phase from `cursor get`, which goes in one
   message with step 1's protected-branch git probes. The seam derives
   name/total from ROADMAP and stamps `Updated:` itself; hold its envelope for
   the report.
   Commit the cursor and `.planning/records/state.json` (`docs:`), or fold them
   into the WIP commit if one was made.
   Never leave the tree dirty. Write no handoff document and no activity log.

3. **Report.** One line: "Paused at {position}, resume with /cad-progress".
   The position comes from step 2's envelope `cursor`: "Phase {phase} of
   {total}: {name}" when it has no `plan` field, "Phase {phase} of {total},
   plan {K} of {J}: {plan name}" when it does, ending at "plan {K} of {J}" when
   that has no `name`. Never "plan 0 of 0".

Before any question to the user, send one `PushNotification` naming the
command, the phase or position line and what is needed, in one line under 200
characters, and skip it when the host has no such tool
(`references/seam-ask-user.md` has the full rule).
</process>
