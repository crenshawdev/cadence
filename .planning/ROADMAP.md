# Roadmap: v3.7.1 - the tracker is the record

## Overview

**`v3.7.1`, opened 2026-08-24.** Two phases. The first is the theme: **`.planning/CAPTURE.md` is a transient working buffer for the phase in flight, and the repository's own issue tracker is the record.** The second is a small identity fix carried over from the sub-phase cluster, kept separate because it shares no surface with the first.

**The measured state.** `planning.mjs capture-sections` reports this repository's CAPTURE.md at Todos 233, Seeds 36, Notes 7 inside the recall walk, plus Archive 185 and Debt markers 1 outside it - 584 lines, 251,968 bytes. The file is `/cad-plan`'s recall input, so every planning pass in this project reads a quarter of a megabyte of which the large majority is settled. Two items have become level-2 headings (`## [latent] (phase 2) ...`), which puts them outside `CAPTURE_WALK_SECTIONS` (`lib/planning-files.mjs:879`) and invisible to the recall they were filed for.

**This has happened before and was swept by hand.** The `## Archive` block states it: 185 open items archived as one block on 2026-08-08 by v2.6.0 phase 1, "every open item in the queue that this cycle did not capture", which had "accumulated across nine milestones and were carried unread through every one". The queue went to zero and regrew in sixteen days. A one-time sweep is not a fix, because nothing in any workflow drains this file: `cadence-core/workflows/milestone.md` never mentions CAPTURE, and the only two workflows that reference it - `plan.md` and `execute.md` - are readers.

**Why it accumulates, stated exactly.** The item grammar has two states, `- [ ]` and `- [x]`, and `[x]` means *done*. A decision **not** to do something has no representation, so it stays `[ ]` and is indistinguishable from live work. With no way to record a rejection, rejections were written INTO the bullets instead - the `KEPT 2026-08-08, re-verified against ...` and `recorded not fixed` annotations, 12 of them - so adjudicating an item made it longer rather than removing it. One bullet in the queue today says in its own text "It stands as a caution against the next pathspec-commit proposal, not as a live defect" and is still an open todo.

**The fix is not a bigger archive.** Moving settled items to a `## Archive` heading in the same file keeps the recall walk clean and changes nothing about the bytes; this repository already has 185 such bullets proving it. Durable records belong in the issue tracker, which is where this project's own history already points - CAPTURE bullets cite `#238`, `#249`, `#69`, `#29`. CAPTURE becomes scoped to one phase, empties at phase close, and carries no history section at all.

**Generic, not local.** Cadence ships to whoever installs it. The tracker is derived from the repository's own `origin` remote - Forgejo, GitHub, GitLab - and no host, org or user is hardcoded.

**What this cycle is not.** It is not a sweep of this repository's existing 276 walked items; that disposition is OQ-2 below and is decided before phase 1 plans, not during it. It does not change how findings are RAISED - the review triggers and their blocking/adjudicated arms are unchanged; only where a non-actioned finding LANDS changes. No reason token is renamed.

This cycle seeds ids up front - `CAP-01`, `CAP-02`, `CAP-03`, `SPL-01`, `SPL-02` - so every one is either traced to a phase or visibly `unpicked` in `/cad-audit`.

## Open Questions

- **OQ-1 (blocks phase 1 planning): a repo with no usable tracker.** A repository with no `origin`, an `origin` on a forge with issues disabled, or no credentials for it, has nowhere to roll an item out to. Phase 1 must not silently drop the item and must not silently retain it forever. Decide the behaviour before planning.
- **OQ-2 (blocks phase 1 planning): this repository's existing 276 walked items.** The mechanism fix does not disposition them. Decide whether they are filed as issues, dropped, or handled as a separate phase, and who adjudicates them - noting that two sampled today came back one dead, one live, so a blanket call in either direction is unevidenced.

## Phases

- [ ] **Phase 1: CAPTURE is transient** - CAPTURE holds only the phase in flight, phase close empties it, and anything worth keeping becomes an issue on the repository's own tracker
- [ ] **Phase 2: One spelling, one phase** - tighten the phase-directory grammar to reject a zero-padded fraction, and apply the existing spelling refusal at every command that resolves `--phase` to a path

## Phase Details

### Phase 1: CAPTURE is transient
**Goal:** `.planning/CAPTURE.md` is a working buffer for the current phase and nothing else. Every item leaves it at phase close - resolved and closed, or written out to the repository's issue tracker. The file cannot accumulate, because its scope is one phase rather than the project.
**Depends on:** Nothing (first phase). OQ-1 and OQ-2 are answered before this phase is planned.
**Requirements:** CAP-01, CAP-02, CAP-03
**Success Criteria:**
1. Phase close empties the walked sections: after the close step runs on a phase whose CAPTURE held items, `planning.mjs capture-sections` reports `0` bullets across `Todos`, `Seeds` and `Notes` for that phase, and every item that was there is accounted for as either closed or filed - none silently dropped.
2. An item is RESOLVED by removal, never by annotation. The prose rule is stated in the triage reference, and a check fails when a walked bullet carries a re-verification annotation (the `KEPT <date>` / `recorded not fixed` shapes this repository already holds 12 of).
3. Roll-out targets the tracker derived from the repository's own `origin` remote, verified against a Forgejo, a GitHub and a GitLab remote URL each resolving to their own API host. No host, org or username appears as a literal anywhere in the implementation - a grep for `jcrenshaw` and for `git.jcrenshaw.dev` over `cadence-core/` returns nothing outside test fixtures.
4. The behaviour decided for OQ-1 is implemented and observable: on a repository with no usable tracker, phase close reports what it could not file, by name, with a next step - and does not silently drop the item or silently leave it in the file.
5. `## Archive` is no longer part of the CAPTURE contract: it is absent from the template, and a CAPTURE.md still carrying one is reported by `/cad-health` rather than walked or ignored.
6. `/cad-health` fails when the walked bullet count crosses a configured bound, so a roll-out that silently stops working surfaces at that bound instead of at 276. Verified by a fixture over the bound failing and one under it passing.
7. Full suite green, and no `reason` token renamed: a diff of the literal `reason` strings in `cadence-core/bin/` before and after the phase is empty.

### Phase 2: One spelling, one phase
**Goal:** A phase spelling that would be silently normalized is refused where it is written, and a phase directory whose name would collide with another phase is reported as drift.
**Depends on:** Nothing (independent of phase 1; ordered second because it is the smaller change)
**Requirements:** SPL-01, SPL-02
**Success Criteria:**
1. `PHASE_DIR_NAME` rejects a zero-padded fraction: with `phases/1.01`, `phases/1.00` and `phases/2.0` on disk, `planning.mjs status` reports a `phase-dir-grammar` drift entry naming each, and names the legal directory it collides with when one is present. `phases/1.1`, `phases/1.10` and `phases/8` stay legal and produce no entry.
2. Whether `2.0` is a legal spelling of phase 2 is decided and stated once in `cadence-core/references/roadmap-phases.md`, and `PHASE_DIR_NAME`, `phaseDirGrammarDrift`'s printed detail and the two `phases/` listing filters each match that statement or carry a comment naming why they deliberately differ (D-09 is the standing example).
3. Every `planning.mjs` command that resolves `--phase` to a `phases/<N>/` path refuses a lossy spelling through `phaseSpellingRefusal`: for each such command, `--phase 1.10` against a tree holding `phases/1.1/` returns `ok:false` with a `bad-args` reason naming both fixes, rather than acting on phase 1.1.
4. A census test pins the guarded-callsite count against the `requirePhaseArg` callsite count in `planning.mjs`, so an unguarded path-resolving callsite fails the suite with a message naming it.
