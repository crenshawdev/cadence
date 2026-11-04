# Existing projects and migration

Updating Cadence doesn't silently accept a testing policy for every repository. With `testing.scope` unset, the project keeps its previous behavior.

To adopt the policy in a project already using Cadence:

```text
/cadence:cad-config --testing
```

Cadence reads the current settings, coverage configuration and workflows, then presents the recommendation alongside what it would change. For an existing codebase that hasn't used Cadence, `/cadence:cad-adopt` offers the same policy during setup.

## Keep useful tests and existing gates

Migration doesn't require rewriting the suite. Existing tests count wherever they adequately establish the required behavior. The work is to identify real gaps, agree on the measurement scope and connect the required checks to CI.

Higher existing thresholds are preserved. For an adopted project below its accepted thresholds, the first roadmap phase addresses the shortfall and installs the gate together. Unknown coverage needs measurement; it isn't evidence that the project meets or misses the threshold.

For an already managed project accepting a policy through `--testing`, `/cadence:cad-plan` puts the CI task first when the policy check finds no gate. Accepting the settings alone doesn't install a working CI job.

## The four retired switches

Cadence 3.11.1 retires `test_attack`, `test_evidence`, `check_inspection` and `independent_rerun` from the `workflow` settings, along with the evidence, inspection and re-run steps they turned on. Nothing reads them any more, with or without a policy.

A config that still holds one gets a warning on every read, and setting one is refused. The warning names the two commands that remove it, and Cadence doesn't edit your config files for you. Other settings in the same file keep working.

The policy keeps independent verification's purpose: verification runs the project's suite itself. Older plans carrying test tables stay readable as plain text, and nothing acts on those sections.

## Existing human-verification criteria

An old `human-verify` label doesn't make required behavior optional. Under the policy, that criterion needs an automated check. If CI can run it, it can wait there; if it has no automated check, verification records the gap as a failure.

Only your explicit decision makes a required criterion optional. Visual observations can remain useful, but they don't certify required behavior or hold up completion as optional observations.

## Reauthorize publishing in a new clone

The policy can travel with the project. Verification-publishing authorization doesn't. In a fresh clone, use `/cadence:cad-config --testing` if you want verification to push branches unattended.

These settings govern projects Cadence manages. They don't lower Cadence's own development coverage gates, which remain 95% lines and 88% branches in this release.
