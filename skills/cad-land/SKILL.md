---
name: cad-land
description: "Publish finished work - report git state, fire the pre_ship review, then ask the publish mechanism with NO preselected default (push / MR or PR / tag / leave local) and do exactly that. Never decides how you publish"
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
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md
@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git.md
</execution_context>

<process>
1. **Report git state.** Current branch; `git.base_branch` (or `$ARGUMENTS`) as
   the base; commits ahead of base; unpushed commits; uncommitted/untracked
   changes; and the remote host detected from the origin URL (gitlab -> MR,
   github -> PR, none -> local only). Show this plainly before doing anything.

2. **Uncommitted changes.** If the tree is dirty, do NOT auto-commit. Ask
   (ask-user seam): commit them first (then continue), leave them out of this
   land, or stop. If HEAD is a protected branch, the protected-branch guard
   (git.md) applies to any commit here.

3. **Fire `pre_ship`.** Run the `pre_ship` review trigger
   (references/review-triggers.md) with the full branch diff
   `git diff <base>..HEAD` as the artifact, honoring `review.triggers.pre_ship`
   (default adjudicated). Report the outcome; a blocking FAIL halts the land
   until fixed or the user overrides.

4. **Ask the mechanism (ask-user seam, NO preselected default):**
   - **Direct push** - push the current branch to its remote.
   - **Open MR / PR** - the detected host's mechanism (`glab mr create` on
     GitLab, `gh pr create` on GitHub). If no remote, this option is absent.
   - **Tag** - create `git.create_tag` a tag (ask the name); ask separately
     whether to push it.
   - **Leave local** - do nothing further.

5. **Execute exactly that, raw.** Run only the chosen action. Never push unless
   push (or push-tag) was chosen. No PR-body templating beyond a title/summary
   the user confirms. Report precisely what was done (branch pushed, MR/PR URL,
   tag created) and nothing implied.
</process>

<guardrails>
- No preselected publish default, ever. No auto-push. No auto-commit.
- Execute only the single chosen mechanism; do not chain (e.g. push AND tag)
  unless the user chose both.
</guardrails>
