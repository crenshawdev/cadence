---
phase: {N}
plan: 1              # only meaningful when the phase splits (PLAN-1.md, PLAN-2.md)
requirements:        # phase requirement IDs this plan covers - never empty; quote a #-shaped id ("#41"); see references/plan-frontmatter.md
files:               # files this plan touches; quote a #-shaped id ("#41"); see references/plan-frontmatter.md
---

# Phase {N}: {phase name} - Plan {K}: {plan name}

{K is the file number (PLAN.md is 1, PLAN-<k>.md is k), with no "of J". Every
plan, a single PLAN.md and a gaps plan too, names itself here, and progress
messages print the name.}

## Goal

{The phase goal from ROADMAP.md, outcome-shaped, 1-2 sentences.}

## Must be true when done

{3-7 observable truths derived goal-backward, each one a human can observe.
cad-execute's goal check and cad-verify's UAT read this list.}

- {truth}
- {truth}

## Context

{2-6 lines: locked CONTEXT.md decisions that bind this plan, files and
patterns to follow, anything out of scope.}

## Tasks

{Numbered, one concern each, independently verifiable, repo committable
after each.}

### Task 1: {action-oriented name}

- **Files:** {exact/paths, comma-separated}
- **Action:** {directive prose: what must become true, its constraints, what
  to avoid and why. Name symbols that ALREADY EXIST; never invent an
  identifier, signature, field name or call path for code not yet written. No
  fenced code blocks.}
- **Verify:** {falsifiable check - "running X shows Y", a test command, an
  observable behavior, never "it works". This is the task's AUTHORITY: any
  implementation satisfying it is authorized.}

### Task 2: {name}

- **Files:** {...}
- **Action:** {...}
- **Verify:** {...}

## Notes

{Optional: human-required setup (accounts, env vars Claude cannot obtain),
assumptions surfaced during planning. Delete the section if empty.}
