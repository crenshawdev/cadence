---
name: cad-land
description: "Land finished work - report git state, then ask the mechanism (push / MR or PR / tag / leave local). Never decides how you publish"
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
never auto-pushes. It reports the state, asks how to publish, and executes
exactly that - nothing more.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-guard.md
</execution_context>

<process>
Read every config key this run needs in ONE `config.mjs get` up front
(conventions.md Parallel work) - `git.base_branch git.protected_branches
git.auto_close git.on_land_cleanup git.create_tag` - and reuse the values
across the steps below rather than re-reading per step.

1. **Report git state.** Current branch; the base = `$ARGUMENTS`, else
   `git.base_branch`, else the first `git.protected_branches` entry that
   exists here (references/git-guard.md's fallback); commits ahead of base; unpushed commits; uncommitted/untracked
   changes; and the remote host detected from the origin URL (gitlab -> MR,
   github -> PR, any other host where `tea` holds a login -> Forgejo/Gitea PR
   via `tea`, else local only). Show this plainly before doing anything.

   **Then the tracker, in the same report.** Run it here, before any publish
   ask, on both step-3 arms:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/issue-check.mjs" check --dir <root> --base <base>
```

   Branch on `action` alone. On `report`: say in ONE sentence which issues this
   branch's commits reference and which of them are still open ("your branch
   references #42 and #47; #42 is still open"), naming a `not-found` number as
   not found and an `unresolved` one unresolved, never closed or not found.
   Print the `open` list ONLY when
   `referenced` is empty - it is the fallback, never the headline, because a
   bare list is what a reader skims past. On `skip`: print `reason` verbatim as
   ONE line and carry on - never block, never retry, never ask, and never list
   an issue the seam did not read. On `off` - `git.issue_check: false`, decided
   before any forge CLI runs - say NOTHING about the tracker: not the reason,
   not that it was skipped. The off switch is off, so this paragraph produces
   no output at all.

   This report never writes: landing closes no issue, and closing one stays an
   explicit ask you make at publish time.

2. **Uncommitted changes.** If the tree is dirty, do NOT auto-commit. Ask
   (ask-user seam): commit them first (then continue), leave them out of this
   land, or stop. If HEAD is a protected branch, the protected-branch guard
   (references/git-guard.md) applies to any commit here.

3. **Publish - branch on `git.auto_close`.**

   **(a) `git.auto_close` false (default): ask the mechanism (ask-user seam, NO
   preselected default):**
   - **Direct push** - push the current branch to its remote.
   - **Open MR / PR** - the detected host's mechanism (`glab mr create` on
     GitLab, `gh pr create` on GitHub, `tea pr create --base <base> --head
     <branch>` on a Forgejo/Gitea remote - `tea` does not push the source
     branch itself, so push it first as part of this same chosen action). If
     no remote, or `tea` holds no login at all, this option is absent.
   - **Tag** - create an annotated tag (ask the name); ask separately
     whether to push it.
   - **Leave local** - do nothing further.

   **Read the publish rails before a publishing answer.** When the answer is
   direct push, open MR/PR, or a tag the user chose to push, Read
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-publish.md` (one
   consult site - step 3a or 3b, never both) first: rail 3 and the
   `git.auto_close` policy govern all three, and this skill no longer preloads
   them.

   Then **execute exactly that, raw.** Run only the chosen action. Never push
   unless push (or push-tag) was chosen. No PR-body templating beyond a
   title/summary the user confirms. Report precisely what was done (branch
   pushed, MR/PR URL, tag created) and nothing implied.

   **(b) `git.auto_close` true: land the integration branch on base via
   `PR -> merge`, no prompts.** Skip the 3a ask entirely (this is the single
   opt-in that lets the close run unattended; it never installs a default into
   the 3a ask). The integration branch is local-only
   (references/git-publish.md rail 3 never
   auto-pushes).
   - **Gate the unattended merge on surviving findings.** Nobody is watching
     this arm, so a surviving blocker/high finding is a HARD halt before any
     merge rather than an ask. This skill fires no review of its own: the
     findings are the ones this branch's `risk_surface` fires already settled
     and persisted, in TWO places: `.planning/phases/*/REVIEW-risk_surface*.md`,
     and `.planning/REVIEW-risk_surface-*.md`. Read every such file in the tree,
     union their `findings` arrays, and pipe
     `{"findings": [...]}` on stdin to
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/land-cleanup.mjs" gate`; on
     `action:"halt"` stop the chain and surface the findings instead of merging
     over them. BOTH globs, always: `/cad-milestone` prunes the phase dirs
     before it chains this command, so there the second is the only producer
     left. When no such file exists, pipe an explicit `{"findings":[]}` -
     that is the only spelling of "nothing survived", and `action:"halt"` also
     fires when the payload could not be read at all (empty stdin, malformed
     JSON, or a valid envelope carrying no findings list), since the gate never
     reports "no surviving finding" about input it never parsed.
   - **Read the publish rails first.** Read
     `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-publish.md` (one
     consult site - step 3a or 3b, never both) before the
     first bullet below that publishes anything - the GitHub seam call and
     GitLab's `glab mr create`, which publishes the source branch itself, both
     count, so this read is NOT scoped to the GitHub arm. Rail 3 and the
     `git.auto_close` policy govern from here on and this skill no longer
     preloads them.
   - **Publish the branch (GitHub and Forgejo arms).** On GitHub, `gh pr
     create --head <branch>` will NOT push a remoteless branch
     non-interactively, and `tea pr create` never pushes at all, so on either
     host publish the branch first through the git-publish seam. Run it on its
     own physical line:
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
   - **Open (or reuse) the PR/MR.**
     On GitLab EVERY arm of this bullet mutates the remote: `glab mr create`
     pushes the source branch itself, and the reuse arm hands an already-open
     MR straight to the merge below with no create at all. So the GitLab arm
     asks BEFORE it probes, on its own physical line:
     `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" authorized --dir <root>`
     On `ok:false` do not touch the remote at all - no view, no create, no merge -
     stop and surface the `detail`, which says which authorization was missing
     (a `git.auto_close` the user set globally does not authorize a repository
     that never set it in its own `.planning/config.json`). That is the same
     stop the GitHub/Forgejo arm makes on the publish seam's `ok:false`. ONE
     consult, ahead of the whole bullet and not beside the create: the reuse
     arm is what would otherwise reach `glab mr merge` unasked, so placed here
     no second check is needed there.
     Then reuse an existing open one when
     `gh pr view <branch>` / `glab mr view <branch>` / `tea pr list --state
     open` (filtered by head branch) finds it, else create: GitHub
     `gh pr create --base <base> --head <branch> --fill`,
     GitLab
     `glab mr create --source-branch <branch> --target-branch <base> --fill`,
     Forgejo `tea pr create --base <base> --head <branch>` (record the index
     it prints - tea addresses PRs by index, not branch).
   - **Merge on the platform.** GitHub `gh pr merge <branch> --merge
     --delete-branch` (an explicit merge strategy is required or gh
     errors/prompts; `--delete-branch` removes the remote+local source). GitLab
     `glab mr merge <branch> --yes --remove-source-branch --auto-merge=false`
     (`--yes` skips the confirm prompt; `--auto-merge=false` merges immediately
     rather than deferring behind a running pipeline). Forgejo
     `tea pr merge --style merge <index>` (tea deletes no local branch; the
     reap in step 4 owns that).
   - **Confirm it landed before any cleanup.** `gh pr view <branch> --json
     state,mergedAt` must show MERGED, `glab mr view <branch>` must show
     merged, or `tea pr <index>` must show state merged. A non-zero exit
     (protected-branch / not-mergeable) or a still-open
     PR/MR (auto-merge only enabled, CI pending) means the merge did NOT land:
     stop, surface the reason, and do NOT reap.

4. **Terminal cleanup - return to base + pull + reap (`git.on_land_cleanup`,
   default on).** Run this ONLY when a merge actually landed on this machine
   (skip it after an open-PR-only or leave-local land; when that PR merges
   later outside this session, this cleanup - pull, tag, reap - is the piece
   to come back for). The auto_close merge
   lands on the platform, so the LOCAL base is stale - pull FIRST:
   `git checkout <base>` then `git pull`.

   **Release tag on the pulled base (tag-after-merge), before the reap.** When
   `git.create_tag` is true and the shipped version - the manifest's `version`
   (`.claude-plugin/plugin.json` or the project's own manifest), else the
   version PROJECT.md says just shipped - has no tag yet (`git tag`
   membership), cut it HERE: write the milestone label to a scratch file and run
   `git tag -a <version> -F <path>` on the now-current base - the label is a
   PROJECT.md milestone name, so it reaches git as a PATH (caller-derived text
   - references/conventions.md). Then ask separately whether to push it
   (references/git-publish.md rails; never auto-push a tag). This is
   deliberately NOT done at /cad-milestone: a tag cut at close names a
   pre-merge commit on the integration branch, and a non-fast-forward merge
   leaves that commit off base entirely. Skip silently when `git.create_tag`
   is false or the tag already exists.

   Then compute the reap decision against the now-current base:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/land-cleanup.mjs" cleanup`.
   In the auto_close path append `--merged true` (step 3b confirmed the PR/MR
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
  close unattended; its mechanic is stated once, at step 3(b), beside the
  code that runs it.
- With `git.auto_close` off, execute only the single chosen mechanism; do not
  chain (e.g. push AND tag) unless the user chose both.
- `/cad-land` fires no review of its own and commits no fix: it publishes what
  was already reviewed and already triaged upstream. The unattended arm acts on
  no survivor either - it reads them only to halt or proceed.
</guardrails>
