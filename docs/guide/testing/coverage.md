# Coverage and supported tools

Coverage tells you which measured code the tests exercised. The assertions determine what those tests established. A project needs both useful checks and its accepted coverage thresholds.

Cadence starts its recommendation at 85% line and branch coverage and preserves higher existing thresholds. These are aggregate thresholds over the accepted production scope, not a requirement for every file to reach 85%.

## Decide what is measured

`testing.coverage.include` names the production files. `testing.coverage.exclude` records the accepted exclusions, such as generated code, bundled output and test code.

Production files that tests never import still belong in the measurement. An empty scope or a missing measurement must not become a passing result. The CI task configures the coverage tool and the applicable report checks or guards for that purpose.

A wider exclusion changes the policy. It isn't a routine fix for a coverage failure.

## How Cadence 3.11.0 sets up enforcement

The project's coverage tool does the measurement. Cadence uses the tool's own thresholds where available and adds a small report check where needed.

| Project tooling | Enforcement used by the policy |
|---|---|
| Node's built-in runner, c8, Jest or Vitest | Native line and branch thresholds, with coverage scope configured and additional report guards. |
| coverage.py / pytest-cov | A JSON report check for separate line and branch thresholds. |
| cargo-llvm-cov | Native line threshold; the policy's nightly branch path adds an LCOV report check. |
| Go | A report check against the statement percentage from `go tool cover -func`. |

The [implementation reference](https://github.com/crenshawdev/cadence/blob/main/cadence-core/references/test-policy.md#accepted-command-shapes) contains the command shapes and tool-version requirements used by this release. They need adapting to the project's source layout and report paths.

For Go, the recommendation uses `statements: 85`, `lines: 0` and `branches: 0`. The statement percentage is a separate metric, not an equivalent line-coverage figure. For Rust on stable, the policy asks you to choose the nightly branch-measurement path or explicitly disable branch enforcement.

## Read the result accurately

| Result | Meaning |
|---|---|
| Threshold met | The enabled metric has data and meets its accepted threshold. |
| Below threshold | The measured result falls short. |
| Disabled | Its threshold is explicitly 0. It wasn't satisfied or measured by implication. |
| Not applicable—zero branches | Branch measurement is enabled and a valid measurement contains zero branches. |
| Missing measurement | An enabled metric has no usable data. It cannot pass. |

The report helper rejects missing, empty or invalid reports. Its Python path also checks for tracked Python files in the accepted scope that are absent from the report. Zero branch records alone don't establish that branch instrumentation was enabled.

The JavaScript command shapes include an empty-scope guard. The Node and c8 shapes also reject a report containing a file with zero covered lines, addressing the branch-reporting problem recorded in the implementation reference. This is an additional restriction beyond the aggregate percentage.

## What the policy check can establish

Cadence compares the project settings with the committed `.github/cadence/coverage-policy.json` and looks for the accepted commands and required job names in workflow files. It treats those commands as text; this comparison doesn't execute them on your machine.

It doesn't parse every coverage tool's configuration, and finding a command in a workflow doesn't establish which job runs it. A tool-specific ignore setting can narrow coverage without that comparison noticing. The CI setup task must inspect those settings and connect the accepted commands to the required jobs.

When coverage falls short, measure the gap first. Apply the [testing scope rule](scope.md#know-when-to-finish) to the work needed to close it.
