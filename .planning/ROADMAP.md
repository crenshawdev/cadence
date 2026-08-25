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


## Phase Details
