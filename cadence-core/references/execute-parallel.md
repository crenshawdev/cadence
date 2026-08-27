# The parallel execution path

Read at `<step name="execute_parallel">` in `cadence-core/workflows/execute.md`,
which is the only step that reaches it. All worktree ceremony lives here and
nowhere else, and `choose_path` has already proven `worktree.baseRef` is `head`
before anything below runs - so an executor halting `blocked` on a missing PLAN
on this path is a real defect to report, not the fork-point default.

1. In batches of `parallelization.max_concurrent_agents`: dispatch one
   cad-executor per plan IN THE DISPATCH SET `locate` defined, each in its own
   git worktree on branch `cadence/phase-<N>-plan-<k>` (spawn-agent seam,
   worktree isolation), the whole batch issued in ONE message. Resolve the route
   ONCE for (cad-executor, attempt 1) and reuse it for every executor in the
   batch - identical role and attempt, so re-resolving per dispatch is wasted
   (seam-spawn-agent.md concurrent dispatch). Same prompt as sequential except
   the mode line:
   "Worktree executor on branch {branch} - worktree rules apply."
2. Wait for every executor in the batch (same timeout).
3. Merge each worktree branch back sequentially: record each branch's pre-merge
   HEAD first, then `git merge {branch}`, then record the HEAD it produced; on
   conflict, stop and ask the user - never force, never auto-resolve. The merge
   is also what carries that executor's own report commit into phase history.
   BOTH ends are recorded here because step 5 runs after every branch has
   merged, when the tree holds only the final HEAD: a plan's post-merge HEAD is
   not recoverable then, and pairing its pre-merge HEAD with the current HEAD
   would hand that plan's reviewer every later plan's work as well.
4. Remove each merged worktree and delete its branch.
5. After all batches: read the key HERE, at its only consumer -
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get workflow.test_command` -
   and run it once if set.

   Then the risk sequence, per plan, in the main tree the merges landed in - a
   fire issued before them asks git for a commit this tree does not hold:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase <N> --plan <k> --base {that plan's pre-merge HEAD from step 3} --head {that plan's post-merge HEAD from step 3}`
   That pair and never the pre-plan HEAD, for the reason step 3 records both
   ends. What that answer means, when the trigger fires, the range-diff file it
   fires with and its rails, and the blocking gate with its capped re-arm are
   stated ONCE, at `workflows/execute.md`'s `execute_sequential` step - the file
   this reference is read from, so it is already resident: follow it there and
   restate none of it here. The fire is PER PLAN, so each plan's survivors
   persist under their own `plan-<k>` discriminator and a later plan's empty
   settle cannot overwrite an earlier plan's file. Then, before that plan is
   reported done:
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check status --phase <N> --plan <k> --base {that plan's pre-merge HEAD from step 3} --head {that plan's post-merge HEAD from step 3}`
   The same triple and never the phase-wide arm, which compares no range and
   would clear this plan on a record an earlier and narrower one left. The plan
   is NOT reported done while that call refuses.

   Then fire the
   `diff` trigger for every plan CONCURRENTLY in one message (artifact: shape
   (a), the refs `{base_ref: that plan's pre-merge HEAD from step 3, head_ref:
   that plan's post-merge HEAD from step 3}`) - the ranges are static and
   independent, so the per-plan reviews need not serialize
   (seam-spawn-agent.md concurrent dispatch). This step runs AFTER step 3
   merged every branch, so a per-plan `diff` review never
   fires before the merge and its refs always resolve in THIS tree, which is the
   tree a dispatched subagent inherits. The
   `diff` gate reports and continues as today at `advisory`; at `adjudicated`
   each plan's survivors go through the triage gate, NONE the default: RE-READ
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before
   presenting, since `/cad-execute` does not preload it, and act only on what
   the user names.
6. Fire the `phase_diff` trigger (references/review-triggers.md) with the refs
   `{base_ref: PHASE_START, head_ref: HEAD}` - shape (a). It is `off` at `solo`
   and at the default `shipped`, `adjudicated` at `critical` -
   it exists because the per-plan reviews above each see one plan's diff in
   isolation, so a bug in the INTERACTION of two merged plans is invisible
   to them. Off at `shipped`, nothing else catches that bug: `risk_surface`
   fires per plan on its own range, and no gate reviews the branch again at
   land. A project that runs this path and wants the cover sets
   `review.triggers.phase_diff.gate`, which beats the level. Parallel path
   only: on the sequential path each diff review already sees a tree containing
   all prior plans' work. Where it adjudicates, its survivors go through the
   same triage gate, NONE the default:
   RE-READ `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
   before presenting, since `/cad-execute` does not preload it, and act only on
   what the user names.

The lifecycle bracket `execute.md` states applies here too, per worker: one
`dispatch` event before a batch member gets its plan and one `return`,
`checkpoint` or `escalation` after it comes back, each carrying that plan's own
`--plan <k>`. The worktree executor writes none of them itself.

Checkpoints on this path route exactly as in `handle_checkpoint`; the
continuation executor is dispatched back into the same worktree.
