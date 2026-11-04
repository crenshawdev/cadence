# Required CI jobs

Under an accepted testing policy, every required test runs in GitHub Actions without someone preparing data, starting a service or certifying the result. Automatically provisioned services are fine; their setup and cleanup belong in the job.

`testing.required_jobs` names the jobs Cadence checks. Installing or extending the workflow is a plan task because the dependencies, fixtures and services are specific to the project. Existing workflows are extended rather than overwritten.

## Check the product as it will be used

Where packaging is relevant, a required job builds the artifact, installs it in its supported installation state, launches it and exercises its entry point without undeclared development dependencies.

A fresh runner by itself doesn't establish that the package works. A service's clean-start check is also a separate concern: it starts the service from clean state with its provisioned dependencies.

## When a test can't run locally

`/cadence:cad-verify` runs what it can locally. A required check that needs CI is recorded as `pending_ci`, with its job and commit. The phase stays partial until that item is settled.

Only phases with pending CI checks enter the CI wait. Locally completed phases aren't described as CI-verified merely because their local checks passed.

To authorize verification publishing for this clone:

```text
/cadence:cad-config --testing
```

The command asks separately about publishing and stores your answer in the repository's own `.git/config` as `cadence.publishForVerification`. A global setting, committed project configuration or `git.auto_close` doesn't supply that authorization. Protected branches are refused.

With authorization, verification can publish the current branch and wait for its jobs. Without it, nothing is pushed. Cadence can read results if the commit is already on GitHub; otherwise the checks stay pending until you authorize verification publishing or publish through `/cadence:cad-land`.

## What counts as a pass

Cadence reads GitHub check runs for a specific commit. Every configured required job must succeed. Matrix runs match the configured job name followed by ` (`; all matching runs must succeed.

A completed check with a skipped, cancelled or other non-success conclusion doesn't pass. A missing run, unavailable GitHub CLI or failed API request leaves the result pending.

The wait is bounded to at most nine minutes per call. A timeout leaves the checks pending and lands nothing. Run verification again to resume. If the branch head changed, pending checks move to that commit.

| Phase description | What it establishes |
|---|---|
| CI-verified at a recorded commit | Every required job passed for that commit. |
| Complete locally, not CI-verified | Local verification completed without that CI record. |
| Partial, with pending CI | Required checks still await their CI result. |

On GitHub, the policy's landing path checks the required jobs at the branch head before merging. A green result for an earlier commit doesn't satisfy that requirement. Policy mismatches or reported weakening stop the unattended landing path too.

## Other forges

Cadence 3.11.0 enforces this policy through GitHub Actions. On Forgejo or GitLab, it reports enforcement as unavailable. A required pending check doesn't become optional because that integration is unavailable; it remains required until settled by an automated check or explicitly made optional by you.
