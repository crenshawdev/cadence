# Controls and their limits

Some Cadence rules are executable checks. Others are instructions the model must follow. You should be able to tell which one you're relying on.

| Control | What it establishes | Limit |
|---|---|---|
| Configuration validation | A proposed write uses known keys and allowed values. | Valid settings can still be unsuitable for the project. |
| Plan and code review | A second reading can identify defects and unsupported assumptions. | Review is model judgment; findings need evidence and can be wrong. |
| Risk detection | A declared scope or diff matches the detector's watched surfaces. | Detection is heuristic. A clean result isn't a proof of safety. |
| Automated tests | The checked behavior met the assertions in that run. | Weak assertions can pass while the requirement is wrong. |
| Coverage gate | The measured scope meets enabled thresholds. | Percentages don't establish assertion quality or complete source selection. |
| CI status | Required matching jobs succeeded for a specific commit. | Success says nothing about required behavior the jobs never checked. |
| Traceability audit | Requirements connect to recorded plans and verification. | A valid chain doesn't independently prove the implementation works. |

## Git controls aren't a sandbox

Cadence's Git hook detects a limited set of command shapes and asks or refuses where its rules apply. It does not fully parse shell syntax. Wrapped commands, substitutions, aliases and other indirect invocations can be outside what it sees.

That limit matters. The hook is a workflow control, not an operating-system security boundary. Claude Code's own permissions and your environment remain part of what controls execution.

Authorized unattended publishing uses a separate script that validates its inputs and invokes Git with an argument array. Closing requires both configuration layers to opt in; verification publishing requires this clone's local Git authorization. Those are separate paths with separate permissions.

The [publishing reference](https://github.com/crenshawdev/cadence/blob/main/cadence-core/references/git-publish.md) lists the guard's known blind spots and the publishing rules.

## Documentation checks also have a boundary

Cadence's self-verification checks selected links between its runtime prose and code: keys, invocations, paths, role files and byte budgets. It can catch a reference to something that doesn't exist. It can't prove that a model obeyed an instruction or that a paragraph accurately explains every behavior.

The [testing policy](../testing/scope.md) has the same distinction. The suite and coverage gate can execute. Deciding that a test earns its maintenance cost is still an engineering judgment, made visible in the plan and bounded by the completion rule.

A check that couldn't run must remain unresolved. Describing that limitation is part of the result.
