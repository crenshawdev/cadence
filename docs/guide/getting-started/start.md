# Start or adopt a project

Open Claude Code in the project's directory. The starting command depends on what's already there.

## Existing code

```text
/cadence:cad-adopt
```

Cadence reads the repository, manifests and Git history to establish what the project already does. It records shipped work and proposes a roadmap for what remains. You answer the questions the repository can't settle.

Review that distinction carefully. Working code belongs in the project's current state; it shouldn't become a new implementation task just because Cadence has only now encountered it.

## A new project

```text
/cadence:cad-new-project
```

Cadence asks what you're building, who it's for, the constraints and what counts as done. It turns those answers into requirements and a phased roadmap.

If you've already had that conversation, [bring a design brief](brief.md). There's no value in answering the same questions again.

## The setup decisions

Setup establishes the forge and asks about role models and reasoning effort when those choices haven't already been made. It also offers a testing policy before the roadmap, because the tests and any missing CI work affect the plan.

The testing recommendation covers:

- How deeply to test, based on the project and its consequential failure modes.
- Coverage thresholds, the production files measured and any exclusions.
- The required GitHub Actions jobs and whether the packaged product needs a check.
- Anything the chosen tools cannot measure.

The recommendation starts at 85% line and branch coverage, preserving higher existing thresholds. Go uses a separate statement threshold. Unsupported metrics are explained explicitly.

Accept the recommendation or adjust it. If an adopted project is below its accepted thresholds, the first phase addresses the shortfall and installs the CI gate together. Cadence doesn't lower the threshold to make the first run green.

Verification publishing starts off. If you want `/cadence:cad-verify` to publish a branch so its CI checks can run, authorize that separately with `/cadence:cad-config --testing`. The authorization belongs to this clone and doesn't travel in committed project configuration.

## What setup leaves behind

The project record lives under `.planning/`:

| File | What it records |
|---|---|
| `PROJECT.md` | What the project is and the constraints it works within. |
| `REQUIREMENTS.md` | What it needs to deliver. |
| `ROADMAP.md` | How the remaining work is divided into phases. |
| `STATE.md` | Where work currently stands. |

Read the proposed roadmap before moving on. Correcting a mistaken goal here is cheaper than correcting several plans built from it.

When the roadmap is settled, move into [your first phase](first-phase.md).
