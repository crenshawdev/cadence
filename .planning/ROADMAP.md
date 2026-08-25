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
- [ ] **Phase 2: Census registry and plan-time lease check** - every hand-maintained census count is registered, and a plan that will change one is refused at plan time rather than halting an executor mid-task
- [x] **Phase 3: CAPTURE is transient** - CAPTURE holds only the phase in flight, the gate that declines a finding files it on the repository's own tracker at that moment, and phase close asserts the file is empty rather than emptying it
- [x] **Phase 4: One spelling, one phase** - tighten the phase-directory grammar to reject a zero-padded fraction, and apply the existing spelling refusal at every command that resolves `--phase` to a path
- [x] **Phase 5: Split planning.mjs by command** - the 32 `cmd*` handlers move to per-command modules, leaving a shared core, so a dispatch touching one command stops paying a whole-file read
- [ ] **Phase 6: Close the plan-time lease gate** - register the one census phase 2 left out, and make `lease-check --plan-time` fail closed on a lease it could not read, so the gate refuses the case it was built for

## Phase Details

### Phase 1: Pick a forge
**Goal:** Cadence resolves a forge and an issue tracker when it sets a project
up - new or adopted - by detecting which forge CLIs are installed, asking the
user which provider to use and what the repository is called, and persisting
that choice. This is the precondition phase 3's roll-out depends on.
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

### Phase 2: Census registry and plan-time lease check
**Goal:** A plan that will change a hand-maintained census count declares the
file holding it BEFORE an executor starts, not after the work is done.
`lease-check` only refuses at commit time, so today the cost of a missing
declaration is a full re-execution: 20 of 39 checkpoints in phase 5 (51%) and 7
of 15 on verbatim (47%) have this one cause, worth 14.8% and 17.4% of executor
spend respectively. Phase 5's own PLAN-1 halted at task 1 with 0 of 8 tasks for
151,683 tokens, then cost 242,318 more to redo the same work.
**Depends on:** Nothing. Ordered before phases 3 and 4 because both of them
change files carrying censuses, so they are the phases this check protects.
**Requirements:** CEN-01, CEN-02
**Success Criteria:**
1. A registry names every hand-maintained census in the repository: the file
   holding it, what it counts, and the test that asserts it. A census live in a
   test but absent from the registry fails the suite naming the file and the
   assertion, so the registry cannot silently fall behind the tree.
2. `lease-check` gains a plan-time arm: given a PLAN's `files:` lease and the
   registry, it names every registered census file the declared work would
   invalidate but the lease does not declare. It reads the lease and the
   registry only - it never runs the plan's work to find out.
3. Replayed against phase 5's PLAN-1 lease as that plan was written - the one
   that halted at 0 of 8 tasks - the plan-time arm names `trace.test.mjs` and
   `self-verify.test.mjs` before any execution. This is the phase's own
   regression fixture, not a live re-run.
4. `/cad-plan` fires the check after PLAN.md is written and before any executor
   is dispatched, and the refusal names each missing file beside the census it
   holds, so the fix is to amend the lease rather than to guess.
5. The three repeat offenders each carry a registry entry with their census
   assertions named: `self-verify.test.mjs` (8 halts), `arg-contract.test.mjs`
   (8) and `trace.test.mjs` (5).
6. A commit-time `lease-check` refusal on a registered census file is
   distinguishable in the run record from an ordinary `undeclared-files`
   refusal, so a plan-time arm that stopped firing surfaces as its own signal
   rather than as generic lease noise.
7. Full suite green.

### Phase 3: CAPTURE is transient
**Goal:** A finding leaves `.planning/CAPTURE.md` at the moment a gate declines
to fix it, not at phase close. The decision is what files the issue, so the user
sees the finding when it is raised rather than in a batch later. CAPTURE holds
only the phase in flight and cannot accumulate, because nothing durable is ever
routed into it.
**Depends on:** Phase 1 (the resolved forge is where the write lands)
**Requirements:** CAP-01, CAP-02, CAP-03
**Naming constraint:** `deferral` and `deferred` are already spoken for three
ways - `'deferral'` is a `FIRE_RECEIPTS` outcome event meaning a `deferred` gate
QUEUED what it found instead of halting (`bin/planning/risk-check.mjs:301-323`),
`deferred` is a `review.triggers.<t>.gate` value, and
`DEFERRED-<trigger>-<discriminator>.json` is the queue member
(`bin/lib/deferred-queue.mjs`). This phase's act is a different one: a finding
that will not be fixed now, filed or dropped. It takes its own word. Reusing
these is the `git.auto_close` collision the project already paid for once.
**Success Criteria:**
1. **The decision ASKS, in that same step, and never writes to CAPTURE.** When a
   gate produces findings it will not fix now - the blocking arm's
   below-blocker/high remainder, the adjudicated arm's non-survivors, any
   `recorded not fixed` disposition - the user is asked once for that fire with
   those findings listed. Accepted findings become issues immediately; a declined
   finding is filed too, carrying the decline label, because that labelled issue
   is the ONLY thing that stops a later fire asking about it again (criterion
   11). Verified by running a gate that produces them and asserting: an issue
   exists for each accepted finding before the phase closes, a declined one
   exists on the tracker carrying the decline label and is absent from
   `.planning/FILED.md`, and CAPTURE is byte-unchanged either way.
2. The set that reaches the ask is read off the STRUCTURED adjudication payload -
   the `RULINGS` (`downgraded`/`refuted` are the non-survivors) and the raised
   severity - and never re-parsed out of `REVIEW-<trigger>-<discriminator>.md`
   prose. Asserted by a fixture whose prose and payload disagree: the ask follows
   the payload.
3. Phase close ASSERTS empty rather than performing a roll-out. Close is the
   check; the ask is the mechanism. The assertion counts SUBSTANTIVE bullets
   across `Todos`, `Seeds` and `Notes` and must not count the `- None.`
   placeholder: measured 2026-08-24, `capture-sections` returns `bullets: 1` for
   a section whose only line is `- None.`, and `EMPTY_CAPTURE`
   (`bin/lib/capture-file.mjs:99`) writes that placeholder under all three walked
   headings, so a count taken off `bullets` as it stands fails on a freshly
   created queue - the state this phase most wants to be legal. A non-empty
   walked section at close is a reported problem naming each item.
4. An item is RESOLVED by removal, never by annotation. The prose rule is stated
   in the triage reference, and a check FAILS when a walked bullet carries a
   re-verification annotation (the `KEPT <date>` / `recorded not fixed` shapes).
   The 2026-08-24 sweep already removed all 12 - `grep -c` over CAPTURE.md
   returns 0 and the surviving instances sit in `_archive-*/` outside the walk -
   so a FIXTURE is the only thing that can prove this check works. A check
   written against the live file passes vacuously forever.
5. The bound (criterion 8), the annotation check (criterion 4) and the `##
   Archive` report (criterion 7) are CODE reachable by fixture, not prose steps.
   `/cad-health` is a skill a model executes and its existing capture step is a
   printed note; a prose step cannot be verified "by a fixture over the bound
   failing and one under it passing". `/cad-health` prints the verdict these
   checks return.
6. The write targets the tracker phase 1 resolved, verified LIVE against
   Forgejo, GitHub and GitLab. `glab` IS present on this machine - measured
   2026-08-25, `/usr/bin/glab`, version 1.114.0 - which falsifies phase 1's
   standing "glab is absent" constraint and the comment carrying it at
   `bin/lib/issue-decision.mjs:38-41`; that comment is corrected as part of this
   phase. No host, org or username appears as a literal anywhere in the
   implementation: a grep for `jcrenshaw` over `cadence-core/` returns nothing
   outside test fixtures.
7. The write is a NEW writing face on the `CREATE_TABLE` pinned-vector pattern,
   not an extension of `bin/lib/issue-decision.mjs`, whose header states its own
   contract as read-only ("NOTHING HERE WRITES") and whose `HOST_TABLE` rows
   carry only `list` and `resolve` argv. That header's claim survives this phase
   intact. Separately, `## Archive` leaves the CAPTURE contract: absent from
   `EMPTY_CAPTURE` (already true by construction - there is no
   `templates/CAPTURE.md` to edit), struck from
   `references/capture-grammar.md:25`, and a CAPTURE.md still carrying one is
   reported rather than walked or ignored. `.planning/ARCHIVE.md` is a different
   thing and is UNTOUCHED: it is a live recall surface written by
   `milestone-prune` and read by `recall`, measured at 1-3 of the top 5 hits on
   representative queries.
8. A configured bound on the walked bullet count fails loud, so a filing path
   that silently stops surfaces at that bound instead of at 235. Verified by a
   fixture over the bound failing and one under it passing. The key owes a
   `references/config-reach.md` row and a catalog row or `self-verify` reddens,
   and its FAIL consequence is stated against the one int-bound precedent in the
   schema - `workflow.max_dispatch_tokens.*`, where "a crossing is REPORTED and
   nothing is refused".
9. A write that does not land - auth failure, offline, tracker unreachable -
   REFUSES rather than dropping the finding or silently parking it in CAPTURE,
   and reports what could not be filed and why. It never kills a finding because
   the network was down.
10. The ask is BATCHED per gate fire: fifteen findings produce ONE ask STEP, not
   fifteen. "One step", not one tool call - the ask-user seam caps options at
   four per question minus a NONE slot and questions at four per call, so fifteen
   findings as individual options cannot fit one call, and `triage-gate.md`
   already batches `ceil(N/3)` questions per fire on the adjudicated arm. The
   falsifiable form: the ask count for a fire is bounded by the seam's caps and
   does not scale one-per-finding. Verified against a multi-finding fire.
11. A declined finding is filed and immediately marked, and a later fire carrying
   the same fingerprint does NOT ask again. The fingerprint is `(file, claim)`.
   There is NO `symbol` field on a finding: `FINDING_KEYS` is
   `{file, line, severity, claim, failure_scenario}` and `findingIssue`
   (`bin/lib/adjudication-record.mjs:208-227`) REFUSES any key outside it, so a
   `(file, symbol)` fingerprint would force a new field that every existing
   adjudication payload and queue member then fails. `line` is excluded
   deliberately - including it, as `convergenceKey` does, makes a decline forget
   itself the moment the file shifts by one line. The decline marker is a LABEL
   applied at CREATE time, the only spelling all three CLIs share on the create
   call: `tea issues create --labels`, `gh issue create --label`,
   `glab issue create --label` all exist, while `gh issue close --reason` is
   gh-only and `tea issues close` takes no reason flag at all. The decline lookup
   is ONE query per fire regardless of finding count, asserted by counting forge
   calls on a multi-finding fire.
12. An INCOMPLETE decline lookup refuses the fire rather than silently re-asking.
   Forgejo/Gitea clamps `tea issues list` at 50 rows server-side whatever
   `--limit` asks, and this repository filed 163 issues in a single 2026-08-24
   sweep, so a decline set larger than the page is reachable today. The existing
   `normalizeList` truncation arm (`bin/lib/issue-decision.mjs:228-243`) is what
   this reads.
13. The recall consequence is not silently regressed. `recall` builds its corpus
   from `phases/*/{SUMMARY,UAT,CONTEXT}.md`, `CAPTURE.md`, `ARCHIVE.md` and
   `tasks/*/RECORD.md` and reads no forge, so a finding routed to the tracker
   leaves the corpus entirely - and "a bullet `/cad-capture` writes is reachable
   by `/cad-plan`'s recall" is the SHIPPED `CAP-01` guarantee at
   `REQUIREMENTS.md`. The filed issue's title is mirrored as one low-scoring
   recall row at file time so the guarantee holds. Verified by filing a finding
   and asserting `recall` still surfaces it.
14. Full suite green, and no `reason` token REMOVED or RENAMED - additions pass.
   Read one-directionally on purpose: criterion 9 requires a refusal arm that
   necessarily ADDS one, so a two-directional empty-diff contradicts it. Baseline
   measured 2026-08-24: 112 distinct `reason` literals across `cadence-core/bin/`.
   Pinned as a committed sorted list asserted forward by set-containment.

**Open question for planning, not settled here:** whether `gh issue create` and
`glab issue create` emit anything machine-readable on success (their `--help`
was read on gh 2.98.0 and glab 1.114.0; no live create was run, since a create
mutates a tracker), whether Forgejo auto-creates a label named in
`--labels` that does not yet exist on the repository or errors, and whether
`glab issue create` blocks on a confirmation prompt in a spawned non-TTY child
without `-y`. The third is the dangerous one: a create that hangs inside a gate
step is the failure mode this seam has no timeout story for.

### Phase 4: One spelling, one phase
**Goal:** A phase spelling that would be silently normalized is refused where it is written, and a phase directory whose name would collide with another phase is reported as drift.
**Depends on:** Nothing (independent of phases 1 and 2; ordered last because it is the smallest change)
**Requirements:** SPL-01, SPL-02
**Success Criteria:**
1. `PHASE_DIR_NAME` rejects a zero-padded fraction: with `phases/1.01`, `phases/1.00` and `phases/2.0` on disk, `planning.mjs status` reports a `phase-dir-grammar` drift entry naming each, and names the legal directory it collides with when one is present. `phases/1.1`, `phases/1.10` and `phases/8` stay legal and produce no entry.
2. Whether `2.0` is a legal spelling of phase 2 is decided and stated once in `cadence-core/references/roadmap-phases.md`, and `PHASE_DIR_NAME`, `phaseDirGrammarDrift`'s printed detail and the two `phases/` listing filters each match that statement or carry a comment naming why they deliberately differ (D-09 is the standing example).
3. Every `planning.mjs` command that resolves `--phase` to a `phases/<N>/` path refuses a lossy spelling through `phaseSpellingRefusal`: for each such command, `--phase 1.10` against a tree holding `phases/1.1/` returns `ok:false` with a `bad-args` reason naming both fixes, rather than acting on phase 1.1.
4. A census test pins the guarded-callsite count against the `requirePhaseArg` callsite count in `planning.mjs`, so an unguarded path-resolving callsite fails the suite with a message naming it.

### Phase 5: Split planning.mjs by command
**Goal:** No dispatch pays a whole-file read to reach one command. The 32 `cmd*` handlers move out of `planning.mjs` into per-command modules, leaving a shared core of roughly 1,600 lines, so an agent touching one command reads about 2,400 tokens instead of paying the read cap twice on a 104k-token file and still not holding it.
**Depends on:** Nothing, and it should run BEFORE the CAPTURE and spelling phases rather than after. Both of those write into `planning.mjs`: the spelling phase wires `phaseSpellingRefusal` at roughly 28 `requirePhaseArg` callsites there and its criteria cite `planning.mjs:278`, `:612` and `:2586` by line. Splitting afterwards would move every one of them, so the split goes first and the later phases land in the new layout.
**Requirements:** LOD-02
**Success Criteria:**
1. `planning.mjs` retains dispatch and the shared top-level helpers and nothing else: every `cmd*` handler lives in its own module, and the entry file measures under 2,000 lines.
2. No command's behaviour changes. The full suite is green, `self-verify.mjs` reports zero problems across all 26 checks, and `npx tsc -p tsconfig.ci.json` still exits 0.
3. Every citation moves with the code it names. A `planning.mjs:<line>` reference on a surface that INSTRUCTS - `skills/`, `cadence-core/workflows/`, `cadence-core/references/`, and `.planning/REQUIREMENTS.md`'s `## Active` section plus `.planning/DOCS-CLAIMS.md` - either points at the new module or is rewritten, and a census test pins the count so a stale citation fails the suite naming it. This is the LOD-01 discipline applied to code. Amended 2026-08-24 after the plan review: the original wording said "anywhere under `.planning/`", which the executor cannot satisfy - `ROADMAP.md` is a surface its own contract forbids writing, and `ARCHIVE.md`, `REQUIREMENTS.md`'s `## Shipped` rows and the `phases/*/` records are records of what was true when written, not instructions to follow. `ROADMAP.md`'s phase 4 entry (the spelling phase, phase 3 before the 2026-08-25 insert) cites `planning.mjs:278`, `:612` and `:2586`; those are a HAND edit after the split, tracked as an open item rather than a task.
4. The test file is addressed rather than left behind: `planning.test.mjs` (418,298 chars) is either split alongside the handlers or the phase records why it was not, since a 105k-token test file reproduces the same read cost it set out to remove.
5. The saving is measured, not asserted. The phase records the before and after token cost of reaching one representative handler, using the same `wc -c` method the requirement was measured with.

### Phase 6: Close the plan-time lease gate
**Goal:** The plan-time lease gate refuses the two cases phase 2's UAT found it passing: a hand-maintained census that is not in the registry, and a PLAN whose `files:` list could not be read at all.
**Depends on:** Phase 2 (this completes its two open UAT failures, items 9 and 10). Independent of phases 1, 3, 4 and 5, all closed.
**Requirements:** CEN-01, CEN-02
**Success Criteria:**
1. `cadence-core/bin/seam-calls.test.mjs` has a registry row in `lib/census-registry.mjs` and carries a `CADENCE-CENSUS` marker, so `grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs` returns at least 1 and the discovery arm finds it. Its row names the holder, the per-workflow seam-invocation counts, the generated "instructs exactly N seam invocations" assertions, and subjects `cadence-core/workflows/plan.md` and `context.md`. Row, marker and header are ONE commit.
2. `lib/census-registry.mjs`'s header no longer carries the pre-correction D-05 text naming `seam-calls.test.mjs` as the worked example of what is NOT a census. A grep for "deliberately absent from this table" returns zero hits in that file.
3. `lease-check --plan-time` fails CLOSED on a lease it could not read. Against a PLAN whose frontmatter holds a garbage line, and against a PLAN whose key is misspelled `filez:`, it returns `ok:false` naming the unread lease rather than the `{"ok":true,"declared":0}` phase 2's UAT recorded. A plan that legitimately declares files and puts no census at risk still passes, so the change is not a blanket refusal.
4. The two gates read one signal the same way: `workflows/execute.md`'s `choose_path` already treats a `frontmatter_issues` entry as grounds to refuse, and the plan-time arm now does too. A test pins both readings against the same fixture.
5. Phase 2's UAT items 9 and 10 re-test green, and `planning.mjs uat status --phase 2` reports `result: complete`.
6. `node cadence-core/bin/test.mjs` runs green, `npx tsc -p tsconfig.ci.json` exits 0, and `self-verify.mjs --root .` reports `problems []`.
