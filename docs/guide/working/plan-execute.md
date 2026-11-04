# Plan and execute

A phase starts with a goal from the roadmap. The work before implementation is to make that goal specific enough to build and verify without reopening every decision along the way.

## Settle the context

```text
/cadence:cad-context 1
```

Cadence reads the project's requirements and relevant earlier decisions before asking about this phase. It offers an assumptions-analyzer pass when you want a deeper reading of the code, or you can go straight to the unresolved choices.

The result is `CONTEXT.md`: the decisions and acceptance criteria the plan needs. Context is an optional artifact; planning can proceed without it. Use it when the phase has choices worth settling before someone starts implementing them.

You don't have to explain an earlier decision again just because the session changed. If the current requirements contradict an older decision, resolve that contradiction explicitly.

## Read the plan for outcomes

```text
/cadence:cad-plan 1
```

The planner divides the phase into executable tasks. Each task names its files, actions and verification. A phase can have several plans; reaching a plan-size limit should split the work, not remove requirements.

When you read the result, check that it delivers the intended behavior and respects the decisions already made. Under an accepted testing policy, its `Verify:` fields also define a [bounded testing scope](../testing/scope.md): what existing checks cover, what must be added and what will be enough to finish.

Plan review provides a second opinion. The optional plan checker is separate and is off by default. Its presence isn't a reason to turn a small change into a longer process.

## Execute when you're ready for commits

```text
/cadence:cad-execute 1
```

Execution implements the plans and makes task commits. Start from a branch and working-tree state you're comfortable building on. If you already have staged work, Cadence asks how to handle it before dispatching an executor.

Independent plans may run in parallel worktrees. Shared files, dependencies or an unsuitable worktree setup keep them sequential. The [execution settings](../configuration/execution.md) explain those conditions.

The executor runs the required checks and records its work. A successful execution produces the phase summary, but implementation being complete doesn't establish that the phase passed verification.

## When execution stops

A checkpoint names the decision, missing prerequisite or structural problem preventing the plan from continuing. Resolve that item before continuing. A resumed executor starts fresh and reads the record of what already happened.

If a run ends partway through, Cadence compares the executor's report with Git history and offers to continue the remaining tasks or stop. It should not replay completed tasks over their existing commits.

When the implementation is ready, [verify the result](verify.md).
