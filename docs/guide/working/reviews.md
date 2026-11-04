# Review findings

A review is a second opinion about a particular plan, change or decision. Its value depends on the finding surviving contact with the code.

Cadence can use a fresh-context Claude reviewer and explicitly enabled external providers. Under the default adjudicated mode, the main session checks each finding against its cited code before combining the survivors. Agreement between reviewers helps prioritize a finding; it doesn't replace that check.

## When reviews run

| Trigger | What it reviews | Default gate |
|---|---|---|
| Plan | A written plan before implementation. | Advisory |
| Diff | A per-task diff. | Off |
| Risk surface | A change matching one of the project's watched risk surfaces. | Blocking |
| Phase diff | The merged phase diff after parallel execution. | Off |

Risk can also raise the default plan-review gate. Explicit settings and waivers affect that behavior; see [review configuration](../configuration/reviews.md).

An advisory review reports and continues. A blocking review stops on surviving blocker or high findings. A deferred review lets the work continue but leaves a queue that must be settled before landing. An adjudicated gate presents the surviving findings for your triage.

## Decide what earns work

Look for the supported behavior affected, the evidence for the defect and the consequence of leaving it. A finding that sounds plausible still needs that connection.

In an adjudicated triage, nothing is selected by default. You choose what to act on. Findings that won't be fixed in the current work need an explicit disposition through the applicable review flow; they shouldn't quietly become extra implementation tasks.

Testing findings follow the [same completion rule](../testing/scope.md#know-when-to-finish) as implementation. Once the agreed checks pass, another imaginable failure isn't enough to restart test development.

## Ask for a review directly

| Command | Use it when |
|---|---|
| `/cadence:cad-plan-review 1` | You want to review an existing or edited plan. |
| `/cadence:cad-decision-review docs/design.md` | One consequential design decision needs examination against the code and available evidence. |
| `/cadence:cad-minimalism-review src/` | You want a ranked list of unnecessary code or abstractions. It applies none of its suggestions. |

A consult is different. It asks another model for help with a dead end and is offered only when configured. You still accept the named provider and model before the call.

If a reviewer fails to run, Cadence must report that. An unavailable review is not a clean review.
