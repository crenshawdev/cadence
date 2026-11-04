# Verify results

```text
/cadence:cad-verify 1
```

Verification asks whether the phase delivered its acceptance criteria. The implementation summary helps locate the work; its claim that something is finished isn't the evidence that it works.

Results are recorded in the phase's `UAT.md`, so a later session can see what passed, what failed and what remains unsettled.

## With an accepted testing policy

Required checks are automated. Verification runs the project's suite itself and checks that the accepted policy agrees with the committed policy file and workflow configuration.

A check that needs CI is recorded as `pending_ci`, naming its job and commit. It keeps the phase partial. A required criterion with no automated check is a test gap, not something handed to a person to certify.

| Result | What happens next |
|---|---|
| Pass | Record the evidence for that item. |
| Fail | Record the cause and route the failure for resolution. |
| Pending CI | Wait for the required job under the project's publishing authorization, or leave it pending with the next action explained. |

Optional visual observations can remain useful, but they aren't required test results and don't determine completion. Required behavior becomes optional only through your explicit decision.

The [CI chapter](../testing/ci.md) explains publishing authorization, bounded waits and the distinction between local completion and CI verification.

## Without an accepted policy

Projects without a policy keep the conversational verification path. Cadence first runs the checks it can perform, then walks the remaining human checks with you and records the results.

That is compatibility behavior. To move required verification to the unattended policy path, use `/cadence:cad-config --testing`.

## The deeper pass

```text
/cadence:cad-verify 1 --deep
```

The deeper pass starts from the goal and examines whether the necessary implementation exists, has substance, is connected to the rest of the product and behaves as required. It can also be requested by the plan-time risk floor.

`workflow.verifier=false` disables that deep pass, including an explicit `--deep` request. It does not disable the ordinary verification walk. Under the testing policy, uncertainty about required behavior becomes a test gap.

## Resolve failures deliberately

Verification diagnoses a failure and presents the next action. You can apply the proposed fix, re-plan the work or leave the failure open. Applying a fix can create a commit and returns the item to pending for a retest.

Leaving a failure open records the state; it doesn't make the phase pass. If the remedy needs planned work, `/cadence:cad-plan 1 --gaps` can plan the outstanding gaps before execution resumes.

After the required items are settled, `/cadence:cad-progress` derives the next step from the project record.
