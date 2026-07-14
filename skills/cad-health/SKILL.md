---
name: cad-health
description: "Quick planning-health check - are .planning's core docs present, and is the STATE cursor / ROADMAP / REQUIREMENTS parseable and mutually consistent? Reports issues and offers to fix trivial ones. Not a traceability audit (that is /cad-audit)"
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
A fast structural pulse on `.planning/` - can the spine even read its own state?
It checks presence, parseability, and internal consistency, nothing deeper. It
does NOT judge whether requirements were delivered (that is /cad-audit's job);
it judges whether the files are well-formed enough for the other skills to trust.
</objective>

<process>
Check, then report - do not fix without asking.

1. **Presence.** `.planning/` exists with PROJECT.md, REQUIREMENTS.md,
   ROADMAP.md, STATE.md. A missing core doc is an issue (point at
   /cad-new-project if the dir itself is absent).

2. **STATE cursor.** Exactly the 4-line schema (Phase / Status / Next / Updated -
   references/conventions.md). `Status` is one of the lifecycle values
   (`ready to plan | context gathered | planned | executed | phase complete |
   paused`). `Phase: N of M` parses with N <= M. `Updated` is a date. Flag a 5th
   line, an unknown status, or an unparseable phase.

3. **ROADMAP.** `## Phases` entries are `- [ ]` / `- [x]` **Phase N: Name**,
   numbered 1..M with no gaps or dupes.

4. **REQUIREMENTS.** The traceability table parses; every `Status` is `Pending`
   or `Complete`; every `Phase` value names a phase that exists in ROADMAP.

5. **Consistency.** Cursor `M` == ROADMAP phase count; cursor `N` is within
   range. `.planning/phases/<N>/` dirs correspond to real phases (a planned
   phase with no dir yet is fine; a dir with no phase is an issue). A phase
   marked `- [x]` in ROADMAP whose mapped REQUIREMENTS rows are not all
   `Complete` (or a `Complete` requirement whose phase is still `- [ ]`) is a
   status-drift issue - flag it. This is the cheap structural check that a
   phase closed clean; whether the requirement was actually *delivered* is
   /cad-audit's job, not this one.

Report: **healthy** with a one-line all-clear, or a short list of issues, each
with the file and what is wrong. For a trivial, unambiguous fix (cursor `of M`
count off, a stale `Updated`), offer to correct it via the ask-user seam - never
auto-edit. Anything structural (missing doc, phase-number gaps) is reported for
the user to resolve, possibly via /cad-phase.
</process>
