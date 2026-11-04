# Finish and publish

Closing a milestone updates the project record. Landing publishes the work. They are separate steps, with an explicitly authorized unattended path when you want them connected.

## Close the milestone

```text
/cadence:cad-milestone
```

The close begins with a traceability audit: requirements must connect to planned and verified work. An audit failure stops the close unless you explicitly override it.

For a release milestone, Cadence confirms the version before doing the applicable version and changelog work. A milestone can also close without a release version. Completed phases leave the live roadmap, while Git history retains the earlier record.

The release tag is not cut at this step. In the landing flow, it is cut on the pulled base after the merge is confirmed, when `git.create_tag` is enabled.

## Choose how to publish

```text
/cadence:cad-land
```

Landing first reports the branch, commits ahead, unpushed work and working-tree changes. When enabled, the issue report shows which referenced issues remain open; that report doesn't modify them.

If there are uncommitted changes, Cadence asks whether to commit them first, leave them out or stop. It doesn't silently bundle them into the land.

The default publishing choices have no preselected answer:

| Choice | Action |
|---|---|
| Direct push | Publish the current branch to its remote. |
| Open MR / PR | Publish the branch as needed and open the forge's review request. |
| Tag | Create an annotated tag, then ask separately whether to push it. |
| Leave local | Do no further publishing. |

Available choices depend on the remote and forge setup. Under an accepted testing policy, direct push onto the base branch isn't offered: that would land the work before its required jobs could pass. Use a separate branch and PR.

## What can stop landing

Deferred reviews must be settled before publishing. A queue that can't be read doesn't count as an empty queue.

With a testing policy, landing compares the policy with the base and reports weakening. The unattended path stops on policy disagreement or reported weakening. On GitHub, its merge requires the configured jobs to succeed for the branch head; an earlier commit's green checks aren't enough. A timeout leaves the work unmerged.

Opening a PR and merging it are different outcomes. Cadence shouldn't report a completed merge when it has only opened the request or enabled an auto-merge that is still waiting.

## Unattended closing

`git.auto_close` must be explicitly true in both your user-global configuration and this repository's configuration. When both authorize it, milestone closing can continue into landing without the per-step publishing questions. Required gates and host permissions still apply, and surviving blocker or high risk-surface findings stop the path.

Verification publishing has its own per-clone authorization. It doesn't authorize a merge, and `git.auto_close` doesn't authorize verification pushes. See [Git and publishing settings](../configuration/git.md) for both.

After a confirmed merge, the configured cleanup can return to the base branch, pull and remove the merged integration branch. The next cycle starts with `/cadence:cad-phase add` when you're ready to plan more work.
