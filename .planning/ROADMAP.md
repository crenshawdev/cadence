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

- **OQ-1 - RESOLVED 2026-08-24: Cadence requires a forge.** A repository hosted
  on a platform with an issue tracker - Forgejo/Gitea, GitHub, GitLab - is a
  precondition, not an option. The tool already assumes one nearly everywhere:
  `/cad-land` offers MR and PR, two mechanisms that exist only on a forge;
  `git.integration_branch: milestone` creates a branch whose purpose is that
  parallel work merges back into it; `/cad-milestone` cuts and tags a version;
  the ROADMAP template says git is the archive; and this project's own planning
  docs cite `#238`, `#249`, `#69`, `#29`. A no-tracker mode would be a second
  disposition set, a second close path and a config nobody sets - what
  `/cad-minimalism-review` exists to delete. The fresh-directory gap at
  `/cad-new-project` is handled by phase 1's setup step, not by a permanent
  second mode.
  - Auth failure and offline are NOT "no forge": the item was filable and the
    write did not land. Those refuse the close rather than empty the file.

- **OQ-2 - RESOLVED 2026-08-24: one manual sweep.** This repository's existing
  276 walked items are cleaned up by hand, once, outside the phase work.

- **OQ-3 - RESOLVED 2026-08-24: a deferral ASKS, and a decline is final.**
  Nothing files automatically. When a gate defers findings the user is asked,
  and a finding the user declines is DROPPED - not parked, not annotated, not
  written to CAPTURE, not carried to the next phase. There is no long-living
  residue by construction, which is what makes "CAPTURE cannot accumulate" true
  rather than aspirational.
  - The ask is BATCHED per gate fire, not per finding: one prompt listing what
    the gate deferred, the user picks which become issues. A gate that defers
    fifteen findings must not produce fifteen prompts - that friction is what
    made the old silent-write path attractive in the first place.
  - Severity classes need no separate rule (the original sub-question 2): the
    user sees each finding before anything is written, so there is no automatic
    stream for a severity filter to hold back.
  - The target is simply the forge phase 1 resolved (sub-question 3); the user
    is deciding per fire, so no separate private staging tracker is needed.
  - A DECLINE IS RECORDED ON THE TRACKER, not locally. The finding is filed and
    immediately closed `wontfix`, so a closed issue is the decline record and no
    local file grows. Closed issues do not appear in the open count, so this
    costs nothing on the landing page. "Has this already been declined" is then
    ONE query per gate fire against closed issues - never a walk of N local
    entries, and never a call per finding. Without this the same finding is
    re-raised every cycle and the user is asked forever, which is the accumulation
    problem wearing a different coat.
  - The fingerprint is `(file path, symbol or anchor)`, not prose - prose will
    not match across two independent review runs. This is deliberately COARSE
    and its cost is stated: a genuinely new finding in an already-declined
    function can be suppressed. Preferred over asking the user the same question
    every cycle, and the failure is recoverable (reopen the closed issue).

## Phases

- [x] **Phase 1: Pick a forge** - detect the installed forge CLIs, let the user choose the provider and name the repository to create or link, and persist that choice
- [ ] **Phase 2: CAPTURE is transient** - CAPTURE holds only the phase in flight, phase close empties it, and anything worth keeping becomes an issue on the repository's own tracker
- [ ] **Phase 3: One spelling, one phase** - tighten the phase-directory grammar to reject a zero-padded fraction, and apply the existing spelling refusal at every command that resolves `--phase` to a path
- [ ] **Phase 4: Split planning.mjs by command** - the 32 `cmd*` handlers move to per-command modules, leaving a shared core, so a dispatch touching one command stops paying a whole-file read

## Phase Details

### Phase 1: Pick a forge
**Goal:** Cadence resolves a forge and an issue tracker when it sets a project
up - new or adopted - by detecting which forge CLIs are installed, asking the
user which provider to use and what the repository is called, and persisting
that choice. This is the precondition phase 2's roll-out depends on.
**Depends on:** Nothing (first phase)
**Requirements:** FRG-01, FRG-02
**Success Criteria:**
1. Setup detects the installed forge CLIs by PATH resolution through the
   existing `lib/on-path.mjs` - `tea` (Forgejo/Gitea), `gh` (GitHub), `glab`
   (GitLab) - and reports which are present. All three are present on the
   development machine, so the multi-candidate case is the normal one, not the
   edge: detecting several offers a choice rather than silently taking the
   first.
2. Both entry points are covered: `/cad-new-project` on a fresh directory and
   `/cad-adopt` on an existing repository each reach this step, and an
   already-configured repository is not re-asked.
3. The user selects the provider and names the repository; nothing guesses.
   Where `origin` already resolves, the existing remote classifier in
   `issue-check.mjs` supplies the default and the user confirms rather than
   retypes.
4. The choice is persisted in Cadence config and every later forge call reads
   it, so a repository that temporarily loses its remote does not silently
   change behaviour.
5. No provider detected, or none selected, refuses with a reason naming what
   was looked for and a hint naming the install or the flag - the same
   discipline `issue-check.mjs` already holds: no third-party stdout or stderr
   reaches the envelope, and `redactUrl` covers credentials in URL position.
6. Repository creation is driven through the selected CLI and is never
   attempted without an explicit confirmation naming the provider, the owner
   and the repository name that will be created.
7. Full suite green; forge calls are tested against argv-recording stubs
   injected by prepending to the child's PATH, the pattern `issue-check.mjs`
   already uses, with no test-only override honoured in production (EXP-01).

### Phase 2: CAPTURE is transient
**Goal:** A finding leaves `.planning/CAPTURE.md` at the moment a gate DEFERS
it, not at phase close. The deferral is what files the issue, so the user sees
the finding when it is raised rather than in a batch later. CAPTURE holds only
the phase in flight and cannot accumulate, because nothing durable is ever
routed into it.
**Depends on:** Phase 1 (the resolved forge is where a deferral writes)
**Requirements:** CAP-01, CAP-02, CAP-03
**Success Criteria:**
1. **A deferral ASKS, in that same step, and never writes to CAPTURE.** When a
   gate defers findings - the blocking arm's below-blocker/high remainder, the
   adjudicated arm's non-survivors, any `recorded not fixed` disposition - the
   user is asked once for that fire, with the deferred findings listed. Accepted
   findings become issues immediately; declined findings are DROPPED. Verified
   by running a gate that defers and asserting: an issue exists for each
   accepted finding before the phase closes, no artifact anywhere holds a
   declined one, and CAPTURE is unchanged either way.
2. Phase close ASSERTS empty rather than performing the roll-out:
   `planning.mjs capture-sections` reports `0` bullets across `Todos`, `Seeds`
   and `Notes`, and a non-empty walked section at close is a reported problem
   naming each item. Close is the check; the deferral is the mechanism.
3. An item is RESOLVED by removal, never by annotation. The prose rule is
   stated in the triage reference, and a check fails when a walked bullet
   carries a re-verification annotation (the `KEPT <date>` / `recorded not
   fixed` shapes the 2026-08-24 sweep found 12 of).
4. The write targets the tracker phase 1 resolved, verified against Forgejo,
   GitHub and GitLab. No host, org or username appears as a literal anywhere in
   the implementation - a grep for `jcrenshaw` over `cadence-core/` returns
   nothing outside test fixtures.
5. A write that does not land - auth failure, offline, tracker unreachable -
   REFUSES the deferral rather than dropping the finding or silently parking it
   in CAPTURE, and reports what could not be filed and why. It never kills a
   finding because the network was down.
6. `## Archive` is no longer part of the CAPTURE contract: absent from the
   template, and a CAPTURE.md still carrying one is reported by `/cad-health`
   rather than walked or ignored.
7. `/cad-health` fails when the walked bullet count crosses a configured
   bound, so a deferral path that silently stops filing surfaces at that bound
   instead of at 235. Verified by a fixture over the bound failing and one
   under it passing.
8. The ask is BATCHED per gate fire: a gate deferring fifteen findings
   produces ONE prompt, not fifteen. Verified against a multi-finding fire.
9. A declined finding is filed and immediately closed `wontfix`, and a later
   fire carrying the same `(file, symbol)` fingerprint does NOT ask again.
   Verified by declining a finding, re-running the gate on the same code, and
   asserting no second prompt and no second open issue. The decline lookup is
   ONE query per fire regardless of how many findings it carries - asserted by
   counting forge calls on a multi-finding fire.
10. Full suite green, and no `reason` token renamed: a diff of the literal
   `reason` strings in `cadence-core/bin/` before and after the phase is empty.

### Phase 3: One spelling, one phase
**Goal:** A phase spelling that would be silently normalized is refused where it is written, and a phase directory whose name would collide with another phase is reported as drift.
**Depends on:** Nothing (independent of phases 1 and 2; ordered last because it is the smallest change)
**Requirements:** SPL-01, SPL-02
**Success Criteria:**
1. `PHASE_DIR_NAME` rejects a zero-padded fraction: with `phases/1.01`, `phases/1.00` and `phases/2.0` on disk, `planning.mjs status` reports a `phase-dir-grammar` drift entry naming each, and names the legal directory it collides with when one is present. `phases/1.1`, `phases/1.10` and `phases/8` stay legal and produce no entry.
2. Whether `2.0` is a legal spelling of phase 2 is decided and stated once in `cadence-core/references/roadmap-phases.md`, and `PHASE_DIR_NAME`, `phaseDirGrammarDrift`'s printed detail and the two `phases/` listing filters each match that statement or carry a comment naming why they deliberately differ (D-09 is the standing example).
3. Every `planning.mjs` command that resolves `--phase` to a `phases/<N>/` path refuses a lossy spelling through `phaseSpellingRefusal`: for each such command, `--phase 1.10` against a tree holding `phases/1.1/` returns `ok:false` with a `bad-args` reason naming both fixes, rather than acting on phase 1.1.
4. A census test pins the guarded-callsite count against the `requirePhaseArg` callsite count in `planning.mjs`, so an unguarded path-resolving callsite fails the suite with a message naming it.

### Phase 4: Split planning.mjs by command
**Goal:** No dispatch pays a whole-file read to reach one command. The 32 `cmd*` handlers move out of `planning.mjs` into per-command modules, leaving a shared core of roughly 1,600 lines, so an agent touching one command reads about 2,400 tokens instead of paying the read cap twice on a 104k-token file and still not holding it.
**Depends on:** Nothing, and it should run BEFORE phases 2 and 3 rather than after. Both of those write into `planning.mjs`: phase 3 wires `phaseSpellingRefusal` at roughly 28 `requirePhaseArg` callsites there and its criteria cite `planning.mjs:278`, `:612` and `:2586` by line. Splitting afterwards would move every one of them, so the split goes first and the later phases land in the new layout.
**Requirements:** LOD-02
**Success Criteria:**
1. `planning.mjs` retains dispatch and the shared top-level helpers and nothing else: every `cmd*` handler lives in its own module, and the entry file measures under 2,000 lines.
2. No command's behaviour changes. The full suite is green, `self-verify.mjs` reports zero problems across all 26 checks, and `npx tsc -p tsconfig.ci.json` still exits 0.
3. Every citation moves with the code it names. A `planning.mjs:<line>` reference anywhere under `skills/`, `cadence-core/workflows/`, `cadence-core/references/` or `.planning/` either points at the new module or is rewritten, and a census test pins the count so a stale citation fails the suite naming it. This is the LOD-01 discipline applied to code.
4. The test file is addressed rather than left behind: `planning.test.mjs` (418,298 chars) is either split alongside the handlers or the phase records why it was not, since a 105k-token test file reproduces the same read cost it set out to remove.
5. The saving is measured, not asserted. The phase records the before and after token cost of reaching one representative handler, using the same `wc -c` method the requirement was measured with.
