# Roadmap

## Overview

**`v3.5.8 - the transition that claims to be one`, opened 2026-08-22.** Scoped
from the tracker milestone `v3.5.8`, which holds three issues: #145, #139 and
#140.

**The theme is one sentence: four operations write several files and report the
result as if they wrote one.** Phase completion writes ROADMAP.md and
REQUIREMENTS.md. The release bump writes the primary manifest, a sibling and the
changelog. The milestone prune writes phase directories and both documents.
Renumbering writes deletions, moves and three documents. An atomic rename
protects one file from torn bytes and cannot create a transaction across files,
so any of these can leave a half-applied tree inside an `ok:true` envelope, and
the caller has no way to tell.

#140 names the gap at `cmdPhaseDone`, whose own comment reads "all-or-nothing"
directly above two separate renames. #139 names it at `release-bump.mjs:138-141`,
which writes the primary manifest before the sibling has been read or validated,
so a malformed sibling ships a partially bumped release tree and reports success.
#145 is the primitive both want: a journal or recovery step that makes a
multi-file transition either complete or recoverable.

**The existing behaviour to generalize, not replace.** Renumbering already
reports partial application honestly at `planning.mjs:3227-3273`. That is one
operation of four doing the right thing because someone remembered to, which is
exactly the shape a shared primitive exists to fix - and it is the working
reference the primitive should be measured against rather than a gap to close.

`v3.5.6` was scoped as four issues, shipped one, and left these three never
planned into a phase and never recorded as dropped, so nothing re-asked them.
They were re-milestoned here on 2026-08-20 rather than left floating. This cycle
seeds ids up front - `JRN-01`, `JRN-02`, `JRN-03` - so every one is either traced
to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.

## Phases

- [x] **Phase 1: The transaction that was never there** - one journal primitive that makes a multi-file write either complete or resumable, built against the two operations that already refuse honestly
- [ ] **Phase 2: Both callers on the journal** - `phase-done` and `release-bump` stop claiming an atomicity they do not have, each through the primitive rather than its own approximation of one

## Phase Details

### Phase 1: The transaction that was never there
**Goal:** One shared primitive that makes a multi-file state transition either
complete or resumable, so an operation writing several files stops reporting
success it cannot guarantee. The primitive is built against the behaviour that
already exists rather than invented from scratch: `renumber` refuses with
`partial-apply` and a `completed` list at `planning.mjs:5964-6035`, and
`milestone-prune` refuses with `partial-prune` and a `failed` list at
`planning.mjs:6530-6535`. Two of the four operations #145 names already do the
right thing by hand. Generalizing what they do is the work; the other two are
phase 2.
**Depends on:** None
**Requirements:** JRN-01

#145's citation is stale and should not be carried forward: it points at
`planning.mjs:3227-3273`, which is now `SUGGEST_KEY_DEFAULTS` and the route-table
ladder readers. The file grew past it. Re-derive the reference sites before
planning rather than trusting the issue text.

The open question a plan has to answer is whether this is a JOURNAL (write intent
first, replay or roll back on resume) or a REFUSAL PROTOCOL (validate every write
before the first, refuse whole, report what completed). The two existing
implementations are the second kind, and the second kind needs no on-disk state,
no resume path and no reader in `/cad-health`. #145 asks for the first and says a
journal "lets /cad-health and /cad-progress report them deterministically". Decide
it on the evidence in the plan and do not carry both.

**Success Criteria:**

1. One exported primitive expresses the multi-file transition, and both
   `renumber` and `milestone-prune` route their existing partial-state refusals
   through it rather than keeping their own.
2. Neither operation's observable envelope changes: `partial-apply` and
   `partial-prune` keep their reason strings, their `completed`/`failed` lists
   and their hint text, pinned by a test that reddens on a paraphrase.
3. A test proves the primitive refuses whole when any planned write would fail,
   and that no file was written when it refuses.
4. Whichever of journal-or-refusal the plan chose, the decision is recorded with
   the evidence behind it and a test pins the arm that shipped, the same way
   phase 4 of `v3.5.7` pinned its no-config-key arm.
5. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.

### Phase 2: Both callers on the journal
**Goal:** The two operations that claim atomicity and do not have it stop
claiming it. `cmdPhaseDone` carries the comment "Both edits validated before
either write - all-or-nothing" directly above two separate renames of ROADMAP.md
and REQUIREMENTS.md; an atomic rename protects one file from torn bytes and
cannot make a transaction across two. `release-bump` writes the primary manifest
before it has read or validated the sibling, so a malformed sibling leaves a
partially bumped release tree inside an `ok:true` envelope.
**Depends on:** Phase 1
**Requirements:** JRN-02, JRN-03

Both are scoped here rather than one each because they are the same fix twice:
route the write set through phase 1's primitive, and report what is actually
guaranteed. They fail differently, which is what the acceptance below separates -
#140 is a reporting-honesty defect where the writes are already validated, and
#139 is a write-ordering defect where they are not.

**Success Criteria:**

1. `phase-done` performs no write until every edit it will make is validated,
   and its envelope reports whether both documents moved or neither did. The
   "all-or-nothing" comment is either true or gone.
2. A test drives `phase-done` with the second write forced to fail and proves
   ROADMAP.md is unchanged on disk afterwards, not merely that an error was
   returned.
3. `release-bump` reads and validates the primary manifest, every versioned
   sibling and the changelog before it writes the first of them.
4. A test drives `release-bump` with a malformed sibling and proves the primary
   manifest still carries the OLD version afterwards, and that the envelope is
   `ok:false` rather than an `ok:true` carrying a `refuse` sibling row.
5. The existing `siblings[]` refusal arm keeps working for a sibling that is
   readable but not upgradeable, so this does not collapse two different
   outcomes into one refusal.
6. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array.
