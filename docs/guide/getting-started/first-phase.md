# Your first phase

Take one phase from the roadmap and work it through the loop. These examples use phase 1; substitute the phase you're working on.

## Settle the decisions

```text
/cadence:cad-context 1
```

This is where you settle choices that affect the implementation and define the acceptance criteria. Be specific about observable behavior. "Supports configuration" leaves plenty of room for a working implementation you didn't want. "Reads the project file and lets a command-line argument override it" gives the plan something to establish.

## Make the plan

```text
/cadence:cad-plan 1
```

Cadence turns the phase into tasks with actions and verification. Review the plan for what it will deliver and whether the work is proportionate.

Under an accepted testing policy, the plan checks existing coverage before adding tests. Its testing scope states the remaining outcomes to establish, the checks needed and where testing stops. Fixtures and mocks are part of the effort. If proving a small change requires a large testing apparatus, this is the time to question the approach.

## Build it

```text
/cadence:cad-execute 1
```

The executor works through the plan, runs checks and commits completed tasks. **This command makes commits.** Use it when you're ready for that workflow.

Some checks may need services available only in CI. Under the testing policy, those checks are written for CI and remain outstanding until they run there.

## Verify the result

```text
/cadence:cad-verify 1
```

Verification asks whether the phase delivered its acceptance criteria. A completed task list alone doesn't answer that.

With an accepted testing policy, required checks are automated. A check waiting on CI stays `pending_ci`, and the phase remains partial. Verification can publish the current non-protected branch when you've explicitly authorized it for this clone. Without that authorization, it leaves the work pending and explains how to proceed.

A phase is called **CI-verified** only when every required job passed for a recorded commit. A phase completed through local checks alone is reported as **complete locally, not CI-verified**. Projects without an accepted policy retain the conversational verification path.

Once the agreed behavior is covered and the required checks pass, finish. Another imaginable failure isn't enough to reopen testing. That needs a demonstrated defect, an uncovered acceptance requirement or a measured coverage shortfall.

## Come back to it

```text
/cadence:cad-progress
```

Use this after a break or in a fresh session. Cadence reads the project state, finds incomplete or paused work, and offers the next step.

For a deliberate pause mid-phase, use `/cadence:cad-pause`. It records where to resume and can make a work-in-progress commit. You can also capture an unrelated idea with `/cadence:cad-capture` without turning it into work for the current phase.

Continue through the remaining phases. When the milestone is ready, `/cadence:cad-milestone` audits and closes the cycle; `/cadence:cad-land` handles publishing. Under the testing policy, unattended landing requires the configured jobs to pass on the branch head.
