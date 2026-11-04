# Agree on a policy

The testing policy answers two questions before implementation: what needs proving, and what evidence is enough to finish?

You accept it for the project. Planning, implementation, review, debugging, coverage and verification then work from that same agreement. Required tests run unattended in GitHub Actions, including their setup, services and cleanup.

## Set it up

New-project setup and adoption offer a recommendation before the roadmap. For a project already using Cadence, run:

```text
/cadence:cad-config --testing
```

Cadence reads the existing tests, coverage settings and workflows. The recommendation names the testing scope, thresholds, production files, exclusions, coverage commands and required CI jobs. It also identifies areas that warrant deeper testing and whether the packaged product needs verification.

Accept it or adjust it. A project with `testing.scope` unset has no accepted policy and keeps its existing behavior.

## Choose the depth

| Scope | What it calls for |
|---|---|
| `focused` | Unit and component tests, with integration tests where the interaction itself needs proving. |
| `integrated` | The focused scope plus integration tests across the main paths. |
| `thorough` | Deeper failure and limit testing where a concrete requirement or plausible consequential defect calls for it. |

The scope is a starting point. A focused project may still need careful tests around billing or destructive operations. Those areas belong in `testing.strong_areas` or the project's identified risk surfaces, with a reason for the additional work. The [stopping rule](scope.md) applies at every depth.

Coverage recommendations start at 85% for lines and branches, preserving higher existing thresholds. Unsupported metrics are explained before acceptance. A percentage marked estimated or unknown is never used as a measured result.

## Keep policy changes deliberate

The planner and executor don't change thresholds, exclusions, accepted commands or required jobs to get their work through. Reopen the policy with `/cadence:cad-config --testing` when the project's requirements change.

A lower threshold, disabled metric or wider exclusion is an explicit adjustment. It should be visible as one.

Required acceptance criteria stay required. Cadence can't make one optional because it is difficult to test. Optional visual observations can be recorded separately, but they don't substitute for required automated checks.

## Publishing is a separate choice

Accepting the policy doesn't authorize a push. The `--testing` command asks separately whether verification may publish the current non-protected branch so GitHub Actions can run. Setup leaves that authorization off.

See [required CI jobs](ci.md) for what happens when a check needs CI and the branch hasn't been published.
