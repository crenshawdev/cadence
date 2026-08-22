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


## Phase Details
