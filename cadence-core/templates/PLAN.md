---
phase: {N}
plan: 1              # only meaningful when the phase splits (PLAN-1.md, PLAN-2.md)
requirements: []     # phase requirement IDs this plan covers - never empty
files: []            # files this plan touches; split plans must not overlap
---

# Phase {N}: {name} - Plan

## Goal

{The phase goal from ROADMAP.md, outcome-shaped, 1-2 sentences.}

## Must be true when done

{3-7 observable truths derived goal-backward. cad-execute's goal check and
cad-verify's UAT read this list - phrase each so a human can observe it.}

- {truth}
- {truth}

## Context

{2-6 lines only: locked decisions from CONTEXT.md that bind this plan, the
existing files and patterns to follow, anything explicitly out of scope.}

## Tasks

{Numbered, atomic: one concern each, independently verifiable, repo
committable after each. Typical phase: 3-10 tasks.}

### Task 1: {action-oriented name}

- **Files:** {exact/paths, comma-separated}
- **Action:** {directive prose - identifiers, signatures, behavior, what to
  avoid and why. No fenced code blocks.}
- **Verify:** {falsifiable check - "running X shows Y", a test command, an
  observable behavior. Never "it works".}

### Task 2: {name}

- **Files:** {...}
- **Action:** {...}
- **Verify:** {...}

## Notes

{Optional. Human-required setup (accounts, env vars Claude cannot obtain),
assumptions surfaced during planning. Delete the section if empty.}
