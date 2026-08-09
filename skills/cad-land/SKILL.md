---
name: cad-land
description: "Land finished work - report git state, fire the pre_ship review, then ask the mechanism (push / MR or PR / tag / leave local). Never decides how you publish"
argument-hint: "[base branch | defaults to git.base_branch]"
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Land the current branch's work. cad-land encodes "the git mechanism is the
user's call" by construction: it never has a preselected publish action and
never auto-pushes. It reports the state, runs the
final review gate, asks how to publish, and executes exactly that - nothing more.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
Read every config key this run needs in ONE `config.mjs get` up front
(conventions.md Parallel work) - `git.base_branch git.protected_branches
git.auto_close git.on_land_cleanup` - and reuse the values across the steps
below rather than re-reading per step. The `pre_ship` gate is not among them:
fire(trigger) takes it from the routing bundle, so the stakes level decides it
rather than a schema default no layer wrote.

1. **Report git state.** Current branch; the base = `$ARGUMENTS`, else
   `git.base_branch`, else the first `git.protected_branches` entry that
   exists here (references/git-guard.md's fallback); commits ahead of base; unpushed commits; uncommitted/untracked
   changes; and the remote host detected from the origin URL (gitlab -> MR,
   github -> PR, none -> local only). Show this plainly before doing anything.

2. **Uncommitted changes.** If the tree is dirty, do NOT auto-commit. Ask
   (ask-user seam): commit them first (then continue), leave them out of this
   land, or stop. If HEAD is a protected branch, the protected-branch guard
   (references/git-guard.md) applies to any commit here.

3. **Fire `pre_ship`.** Read
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md` at this
   step first - this skill no longer preloads it. The reference is 17,714 B,
   larger than this whole skill, and it is consulted at exactly ONE step (this
   one), so preloading it puts those bytes on every remaining turn of the land
   for a single use; the read folds into the turn that fires the trigger as one
   extra tool call rather than an extra turn (`references/seams.md`, File
   round-trip). Then run the `pre_ship` review trigger with the refs
   `{base_ref: <base>, head_ref: HEAD}` as the artifact - shape (a), so the
   branch diff is never inlined here - honoring `review.triggers.pre_ship`
   (default adjudicated). Report the outcome; a blocking FAIL halts the land
   until fixed or the user overrides.

   **Triage, then publish.** When the resolved gate is `adjudicated`, run the
   triage gate exactly as
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` defines it -
   Read it at this step rather than restating it here. Act
   ONLY on the survivors the user names, each as an atomic conventional commit
   (references/git-guard.md), then re-fire `pre_ship` ONCE - same `base`, the NEW
   HEAD - so the publish decision is
   made against the tree that actually ships: at most one re-fire per `/cad-land`
   run, and report that re-fire's survivors rather than triaging them again -
   iterating review->revise->review is the convergence loop review-triggers.md
   forbids. Name which ask is which as they run: this triage ask carries a
   default (NONE), and the step-4a publish ask carries none and never gets one.

   Under `git.auto_close: true` (autonomous close, step 4b) the triage gate does
   not prompt at all - the unattended close's triage is NONE by construction -
   and a surviving blocker/high finding is instead a HARD halt before
   any merge, regardless of the configured gate mode (even the default
   adjudicated, which normally asks rather than auto-halting) - pass the
   adjudicated survivors as `{findings}` on stdin to
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/land-cleanup.mjs" gate` and on
   `action:"halt"` stop the chain and surface the findings instead of merging
   over them.

4. **Publish - branch on `git.auto_close`.**

   **(a) `git.auto_close` false (default): ask the mechanism (ask-user seam, NO
   preselected default):**
   - **Direct push** - push the current branch to its remote.
   - **Open MR / PR** - the detected host's mechanism (`glab mr create` on
     GitLab, `gh pr create` on GitHub). If no remote, this option is absent.
   - **Tag** - create an annotated tag (ask the name); ask separately
     whether to push it.
   - **Leave local** - do nothing further.

   **Read the publish rails before a publishing answer.** When the answer is
   direct push, open MR/PR, or a tag the user chose to push, Read
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-publish.md` first: rail 3
   and the `git.auto_close` policy govern all three, and this skill no longer
   preloads them. The 4a ask ended the turn, so this is the first call of the
   turn that starts with the user's answer - one extra tool call, not an extra
   turn. Leave-local and a tag left unpushed never reach it, and that is what
   makes deferring it pay rather than eager (`references/seams.md`, File
   round-trip).

   Then **execute exactly that, raw.** Run only the chosen action. Never push
   unless push (or push-tag) was chosen. No PR-body templating beyond a
   title/summary the user confirms. Report precisely what was done (branch
   pushed, MR/PR URL, tag created) and nothing implied.

   **(b) `git.auto_close` true: land the integration branch on base via
   `PR -> merge`, no prompts.** Skip the 4a ask entirely (this is the single
   opt-in that lets the close run unattended; it never installs a default into
   the 4a ask). The integration branch is local-only
   (references/git-publish.md rail 3 never
   auto-pushes).
   - **Read the publish rails first.** Read
     `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-publish.md` before the
     first bullet below that publishes anything - the GitHub seam call and
     GitLab's `glab mr create`, which publishes the source branch itself, both
     count, so this read is NOT scoped to the GitHub arm. Rail 3 and the
     `git.auto_close` policy govern from here on and this skill no longer
     preloads them. This arm skips the 4a ask, so the read does not fold into a
     turn an ask already ended - it is the unattended chain's own first call,
     one extra tool call and no extra turn, on a path that always publishes.
   - **Publish the branch (GitHub arm).** On GitHub, `gh pr create --head
     <branch>` will NOT push a remoteless branch non-interactively, so publish
     it first through the git-publish seam. Run it on its own physical line:
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" publish --dir <root>`
     It does ONE sanctioned `git push` of the current non-protected branch as a
     subprocess (execFileSync argv) that git-guard's Bash push hook never sees,
     and refuses with `ok:false` unless repo `git.auto_close` is true and HEAD is
     a non-protected branch. On `ok:true` proceed to open the PR; on `ok:false`
     stop and surface the reason - do NOT fall back to a raw `git push`, which
     would hit the guard's unconditional ask. Relay the envelope's `warnings[]`
     to the user rather than dropping them: `reason:"config-parse-failed"` means
     a config layer that could carry `protected_branches` did not parse, so the
     branch was checked against the DEFAULT list - fix the file, never retry
     past it.
   - **Open (or reuse) the PR/MR.** Reuse an existing open one when
     `gh pr view <branch>` / `glab mr view <branch>` finds it, else create:
     GitHub `gh pr create --base <base> --head <branch> --fill`, GitLab
     `glab mr create --source-branch <branch> --target-branch <base> --fill`.
     On GitLab `glab mr create` publishes the source branch itself, so no seam
     call is needed there.
   - **Merge on the platform.** GitHub `gh pr merge <branch> --merge
     --delete-branch` (an explicit merge strategy is required or gh
     errors/prompts; `--delete-branch` removes the remote+local source). GitLab
     `glab mr merge <branch> --yes --remove-source-branch --auto-merge=false`
     (`--yes` skips the confirm prompt; `--auto-merge=false` merges immediately
     rather than deferring behind a running pipeline).
   - **Confirm it landed before any cleanup.** `gh pr view <branch> --json
     state,mergedAt` must show MERGED, or `glab mr view <branch>` must show
     merged. A non-zero exit (protected-branch / not-mergeable) or a still-open
     PR/MR (auto-merge only enabled, CI pending) means the merge did NOT land:
     stop, surface the reason, and do NOT reap.

5. **Terminal cleanup - return to base + pull + reap (`git.on_land_cleanup`,
   default on).** Run this ONLY when a merge actually landed on this machine
   (skip it after an open-PR-only or leave-local land). The auto_close merge
   lands on the platform, so the LOCAL base is stale - pull FIRST:
   `git checkout <base>` then `git pull`, then compute the reap decision
   against the now-current base:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/land-cleanup.mjs" cleanup`.
   In the auto_close path append `--merged true` (step 4b confirmed the PR/MR
   MERGED) so the reap never hinges on local-base freshness; a manual land
   omits it and the seam falls back to `git branch --merged <base>`. Relay its
   `warnings[]`: a layer that did not parse means `on_land_cleanup` and `base`
   came from DEFAULTS, so `base` may name a branch this repo does not have. When the
   seam returns `reap:true`, reap through the git-publish seam - never a Bash
   git call, never a remote-tracking delete (that trips the push guard):
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" reap --dir <root> --branch <decision.branch>`.
   It deletes by subprocess argv and refuses an unsafe, protected or
   checked-out branch. Relay its `warnings[]` too, and treat
   `reason:"config-parse-failed"` as a stop and not a retry: the seam refuses to
   delete anything while the protected list is unprovable. When either seam returns `action:"skip"` - the branch
   was already removed, or `git.on_land_cleanup` is off - leave HEAD and the
   branch in place. Report the final state: HEAD on `<base>`, pulled, branch
   reaped (or left).
</process>

<guardrails>
- No preselected publish default, ever. No auto-push. No auto-commit. The one
  exception is `git.auto_close` (default off), the explicit opt-in that runs the
  close unattended: on the GitHub arm it makes ONE sanctioned publish of the
  local-only integration branch through the git-publish seam (a subprocess push
  git-guard does not intercept, code-guarded to the current non-protected branch
  under repo `git.auto_close`) BEFORE opening the PR, then PR -> merge -> reset.
  Every Bash `git push` still asks unconditionally; the seam is the only
  code-guarded unattended publish. It skips the 4a ask rather than preselecting a
  default in it, and it still halts on a blocking `pre_ship` finding.
- With `git.auto_close` off, execute only the single chosen mechanism; do not
  chain (e.g. push AND tag) unless the user chose both.
- No survivor is acted on that the user did not pick: adjudicated `pre_ship`
  survivors are triaged (default NONE) before anything is committed, and the
  unattended arm acts on none.
</guardrails>
