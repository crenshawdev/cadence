# Testing policy

Read once per dispatch, the way `lean-build.md` is, by every role that plans,
writes, reviews, debugs, measures or verifies tests in a project whose
`testing.scope` is set. A project that accepted no policy never reads it and
behaves as it did before the policy existed.

## This project's policy

Read the values this project accepted, once, along with this file:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get \
  testing.scope testing.coverage.lines testing.coverage.branches testing.coverage.statements \
  testing.coverage.include testing.coverage.exclude testing.coverage.commands \
  testing.strong_areas testing.required_jobs review.triggers.risk_surface.surfaces
```

The scope sets how deep the tests go:

- **`focused`:** Unit and component tests, with integration tests only where the interaction itself needs proving.
- **`integrated`:** `focused` plus integration tests across the main paths, with provisioned services where needed.
- **`thorough`:** Deeper failure and limit testing wherever a concrete requirement or plausible consequential defect calls for it.

`testing.strong_areas` names project paths with a concrete requirement or plausible consequential defect that justifies deeper tests, and answered risk surfaces count as well. A task that touches one states those deeper tests in its testing scope, whichever scope was accepted. The completion rule below still bounds them.

## The rules

- **Unattended:** Every required test runs in GitHub Actions, including dependency setup, fixtures, required services and cleanup. Automatically provisioned test services are fine.
- **Meaningful assertions:** Tests verify supported behavior against independently determined expectations. Test doubles may replace dependencies, but not the behavior being asserted.
- **Proportionate scope:** Tests cover supported behavior, relevant failures, documented limits and actual regressions. Deeper testing needs a concrete requirement or plausible consequential defect. Speculative extremes, redundant permutations and tests that exist only to satisfy ceremony are excluded.
- **Planning question:** "What plausible defect in supported behavior would this catch that existing tests would miss?" It guides planning and produces no table or report.
- **Behavior changes:** "A behavior change must have adequate automated coverage. Add or update tests only where existing tests are insufficient."
- **Bug fixes:** Reuse an existing reproducer when it provides adequate regression coverage. Confirm it fails for the defect and passes after the fix.
- **Stopping:** Stop adding tests once meaningful behavioral coverage and the accepted thresholds are satisfied, unless a concrete uncovered defect or requirement remains.
- **Acceptance criteria:** Required behavior stays required and needs an automated check. Cadence never makes a criterion optional on its own.
- **Policy changes:** A plan or executor never changes thresholds, exclusions, commands or required jobs. Only an explicit project-policy adjustment does.

## Bounded test planning

These are permanent rules for every project under the policy, and planning, execution, review, debugging, coverage and verification all follow them.

During planning:
- Identify the important observable outcomes and representative failures.
- Check which are already covered.
- Choose the smallest set of additional checks needed to establish the remaining outcomes.
- State what evidence is sufficient and where testing stops.
- Estimate the effort, including fixtures, mocks and test infrastructure. If setup becomes disproportionate to the change, simplify the approach before implementation.

This is a short testing scope inside the task's `Verify:` field, not a separate approval process or a table for every test. There is no new field, table, approval step or per-test justification, and no one-test-per-criterion rule.

## The completion rule

All roles share this rule:

> Implement the agreed checks and run the required suite and coverage gate. Expand testing only for a demonstrated defect, an uncovered acceptance requirement or a measured coverage shortfall. Identify the concrete gap and use the smallest check that closes it. Another imaginable failure or alternative implementation is not sufficient reason to expand scope.

**Coverage shortfalls:** Measure coverage before adding tests to close a shortfall. Keep the accepted thresholds, report the actual gap, and add meaningful coverage rather than tests that merely execute lines. If closing the gap materially exceeds the planned effort, report that tradeoff once instead of silently expanding the work or lowering the threshold.

**Finishing:** Once the agreed behavior is covered and the required checks pass, finish. Reviewers must not reopen completed testing without new evidence meeting the completion rule.

## Enforcing coverage in CI

The project's own tool enforces what it supports. The CI job is an ordinary plan task, and an existing workflow is extended through a plan, never overwritten. The task copies the accepted commands from `testing.coverage.commands` into the workflow with their thresholds filled in, and names its jobs from `testing.required_jobs`. It never changes those values. It also commits `.github/cadence/coverage-policy.json`, because CI and `check --base` read it from the repository and `check` fails until git tracks it. Cadence only matches the commands as text against the workflow files and never runs them.

### Accepted command shapes

Thresholds appear as `{lines}`, `{branches}` and `{statements}`, and no other token. The scope and the never-imported-files setting stay on the command line, so the command itself shows what is measured.

| Stack | Command shape |
|---|---|
| Node 26.7 or later | `node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-include='src/**' --test-coverage-lines={lines} --test-coverage-branches={branches}` |
| c8 | `c8 --all --src src --check-coverage --lines {lines} --branches {branches} npm test` |
| Jest | `jest --coverage --collectCoverageFrom='src/**' --coverageThreshold='{"global":{"lines":{lines},"branches":{branches}}}'` |
| Vitest | `vitest run --coverage.enabled --coverage.include='src/**' --coverage.thresholds.lines={lines} --coverage.thresholds.branches={branches}` |
| Python | `pytest --cov=src --cov-branch --cov-report=json`, then the report check on `coverage.json` |
| Rust | `cargo llvm-cov --workspace --fail-under-lines {lines}`; on nightly, with `--branch` and `--lcov --output-path lcov.info`, then the report check on `lcov.info` |
| Go | `go test -coverpkg=./... -coverprofile=cover.out ./...`, then the report check on `go tool cover -func=cover.out` |

Older Node needs c8, because `--test-coverage-include-all` arrived in v26.7.0.

### The report check

For Python, Go and Rust branches on nightly, copy `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/coverage-report-check.mjs` to `.github/cadence/coverage-report-check.mjs`. It imports `node:` builtins only, reads the thresholds, scope and accepted commands from `.github/cadence/coverage-policy.json`, and takes the format and report as arguments:

```
node .github/cadence/coverage-report-check.mjs --format python --report coverage.json
node .github/cadence/coverage-report-check.mjs --format go --report cover.txt
node .github/cadence/coverage-report-check.mjs --format lcov --report lcov.info
```

For Go, write `go tool cover -func=cover.out` to `cover.txt` first. Go's figure is the statement threshold, `testing.coverage.statements`, and is never read as a line threshold. It prints one line per metric and exits non-zero when any metric fails, naming each. A missing, empty or invalid report fails, a threshold above 0 with no data fails, and a threshold of 0 prints as disabled and is never reported as satisfied. A valid report with branch measurement on and zero branches reads "not applicable—zero branches" and passes. On Rust that needs `--branch` in an accepted command, because `BRF:0` alone cannot prove instrumentation.

### The two guards

Every JavaScript shape also writes LCOV, and the accepted commands add one-line guards after the tool runs:

| Guard | Command | Applies to | What it catches |
|---|---|---|---|
| Empty scope | `grep -q '^LF:[1-9]' coverage/lcov.info` | Node, c8, Jest, Vitest | All four exit 0 on a scope matching nothing. |
| Never-loaded file | `! grep -qx 'LH:0' coverage/lcov.info` | Node, c8 | Both report that file's branches wrongly, so its branch result can't be trusted. |

Every JavaScript shape carries the empty-scope guard, and Node and c8 also carry the never-loaded-file guard.

### Known limit

`check` doesn't read tool configuration files, so a setting like Jest's `coveragePathIgnorePatterns` could narrow the measurement unnoticed. The report check catches this on Python, but not on the JavaScript tools. `check` also confirms a command appears in a workflow file, not which job runs it. The CI task reads those files when it writes the commands into the workflow, so an existing narrowing is visible at that point.

### Packaging

Where packaging is relevant (a `bin` entry in `package.json`, `[project.scripts]` in `pyproject.toml`, a binary target in `Cargo.toml`, a `Dockerfile`, or a plugin manifest), a required job does the following:
- Builds the artifact.
- Installs it in its supported installation state.
- Launches it and exercises its entry point.
- Runs without undeclared development dependencies.

The clean-start job, which starts the service from clean state with provisioned dependencies, is separate from packaging.

## Waiting on CI

`/cad-verify` and `/cad-land` read the required jobs of one commit with `ci-status`, from the main session, and use the same bounded wait: they pass `--wait` a number of seconds (held to 540 per call), and a timeout leaves the answer pending, never a pass. A re-run resumes the wait. On a timeout nothing is recorded as passed and nothing lands.
