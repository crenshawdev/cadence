# Roadmap

## Overview

**`v3.5.1 - authorization the repo grants, not the user`, opened 2026-08-15.**
Scoped off the Forgejo milestone, which holds three issues: #131, #179 and #180.

**The theme is one sentence: a user-global setting can authorize an unattended
publish and merge that the stated policy says only the repository may
authorize.** `git.auto_close` is repo-local by design - D-08 - and
`cadence-core/bin/git-publish.mjs:68` (`repoAutoClose`) reads
`.planning/config.json` directly and never the merged value, exactly so a global
`true` cannot speak for a repository that never opted in. `skills/cad-land/SKILL.md`
reads the same key through `config.mjs get`, which returns the merged
global-plus-repo value, and a `true` there enters the no-prompt branch.

On GitHub and Forgejo the chain still dies at the repo-authorized publish seam.
On GitLab nothing gates it at all: `glab mr create` publishes the source branch
itself, so no seam call is made, and the workflow proceeds to `glab mr merge`.
`cadence-core/bin/land-cleanup.mjs:146` already records the discrepancy in its
own source, which makes this a known gap rather than a discovered one.

The constraint is sharper than "align the two reads", and it is why the prior
narrowing (`0b1c322`) was reverted. `config.schema.json:48` states the merged
read is deliberate: the land gate reads the merged value BECAUSE `/cad-land`
skips the publish ask on that same merged value, so the gate's blocker/high halt
is what replaces the human it switched off, and both must read one value.
Collapsing them to one repo-only value breaks that skipped-ask / halt pairing.
AUT-01 and AUT-02 therefore resolve TWO booleans rather than aligning one:
`autoCloseRequested` from the merged config, which stays what the gate and the
ask read, and `autoCloseAuthorized` from the repo layer alone, required before
any unattended external mutation on every host including GitLab.

Riding along are two seams that ship today and degrade silently, both hit live
during the `v3.5.0` close itself rather than found by a scan. PRN-01: `milestone-prune`
reads only the first physical line of a WRAPPED requirement bullet, so every
close orphans prose fragments under `## Active` and truncates rows mid-sentence
under `## Shipped` - hand-repaired at three consecutive closes, inside the seam
whose own header says it was made deterministic because the hand-performed
version kept leaving a tree that failed its own audit. TRK-01: `issue-check.mjs`
matches a `tea` login against the host parsed off the origin URL, so a Forgejo
remote with a separate SSH endpoint never resolves, and LND-01 - shipped in
`v3.4.0` - has never once produced a tracker report in the repository it was
built in.

## Phases

- [ ] **Phase 1: Authorization the repo grants, not the user** - `git.auto_close` resolves as two distinct booleans, and no unattended external mutation runs on any host, GitLab included, without the repo-layer one
- [ ] **Phase 2: The seams that fail quietly** - a wrapped requirement bullet survives the prune whole, and a Forgejo remote whose SSH endpoint differs from its web host gets a tracker report

## Phase Details

### Phase 1: Authorization the repo grants, not the user
**Goal:** An unattended publish or merge requires authorization the REPOSITORY
granted, on every host, while the close gate and the publish ask keep reading
the one merged value they must agree on.
**Depends on:** Nothing (first phase)
**Requirements:** AUT-01, AUT-02

`git.auto_close` is documented repo-local (D-08, `config.schema.json:48`) and
`git-publish.mjs:68`'s `repoAutoClose` enforces it by reading
`.planning/config.json` directly. `skills/cad-land/SKILL.md` reads the same key
through `config.mjs get` and enters its no-prompt branch on the MERGED value, so
a user-global `true` skips the ask for a repository that never opted in. GitHub
and Forgejo still stop at the publish seam's `ok:false`. GitLab never reaches
the seam - `glab mr create` publishes the source branch itself - and proceeds to
`glab mr merge` ungated. `land-cleanup.mjs:146` says so in its own comment.

The trap is the fix that looks obvious. `0b1c322` aligned the two seams' values
and was reverted, because the schema's stated contract is that the gate reads
the merged value ON PURPOSE: `/cad-land` skips the publish ask on that same
merged value, so the gate's blocker/high halt is what replaces the human it
switched off. One value, one halt. A repo-only collapse breaks that pairing and
leaves an unattended close with neither a human nor a gate.

Success criteria:
1. Two named booleans exist and are resolved separately: `autoCloseRequested`
   from the merged config, and `autoCloseAuthorized` from the repository layer
   alone. Every call site reads the one it means by name, and no site re-derives
   either from a bare `config.mjs get git.auto_close`. Proved by failing-capable
   tests over a config pair where the two values DIFFER (global true, repo
   unset), not by inspection.
2. The skipped-ask / halt pairing is intact and pinned: `/cad-land` skips the
   publish ask on `autoCloseRequested`, and the surviving blocker/high
   `risk_surface` gate reads that SAME value, so the arm that switched off the
   human is the arm the gate covers. A test fails if the two ever read different
   sources. This is what `0b1c322` broke and is the criterion that makes this
   fix different from that one.
3. No unattended external mutation runs without `autoCloseAuthorized` on ANY
   host. The GitLab arm - `glab mr create` followed by `glab mr merge` - is
   gated to the same standard as the GitHub and Forgejo arms that reach the
   publish seam. Proved by a test showing the GitLab path refusing under
   global-true/repo-unset, since `glab` is absent on this machine and the arm
   ships behind the same resolved-CLI seam the other hosts use rather than a
   live call.
4. The refusal names which authorization was missing rather than reporting a
   generic failure, so a user who set the key globally and expected it to work
   is told the repository never opted in.
5. `config.schema.json`'s `git.auto_close` purpose string describes the shipped
   two-boolean behaviour, including which arm reads which. It currently
   describes the one-value contract and would otherwise become the fourth
   surface stating something enforcement does not do.
6. Watched to FAIL first: the ungated GitLab path is demonstrated authorizing an
   unattended merge under global-true/repo-unset against the tree as it stands,
   before the fix lands.
7. `node --test 'cadence-core/bin/*.test.mjs'` and
   `node cadence-core/bin/self-verify.mjs` both run clean.

### Phase 2: The seams that fail quietly
**Goal:** Two shipped seams stop degrading silently on the repository they were
built in - a wrapped requirement bullet survives the prune whole, and a Forgejo
remote whose SSH endpoint differs from its web host produces a tracker report.
**Depends on:** Nothing (independent of phase 1; separate files)
**Requirements:** PRN-01, TRK-01

Neither was found by a scan. Both fired during the `v3.5.0` close itself.

`lib/milestone-prune.mjs` reads only the FIRST PHYSICAL LINE of a requirement
bullet, and both halves of its transform are wrong for that one reason. The
`## Active` removal strips the `- **ID**:` lead line and leaves every
continuation line behind as orphaned prose; `archiveRequirements` builds each
archived row's parenthetical from that same lead line, so rows land truncated
mid-sentence (`| RSK-01 (An executable risk-check seam under \`cadence-core/bin/\` answers a) |`).
Requirement bullets in this repo wrap by default, so this is the common path.
It has been hand-repaired at the v3.3.0, v3.4.1 and v3.5.0 closes - inside the
seam whose own header says these surgeries were made deterministic because every
hand-performed version had a recorded failure.

`issue-check.mjs` matches a `tea` login against the host parsed off the origin
URL. This repo's origin is `ssh://git@ssh.jcrenshaw.dev:2222/...` while the
login is keyed on `git.jcrenshaw.dev`, so nothing matches and the seam takes its
skip arm - correctly, by its own contract, which is why the failure is invisible
rather than loud. A separate SSH endpoint on a non-standard port is a normal
Forgejo deployment shape, and `tea --repo <owner>/<name>` already works against
the same login.

Success criteria:
1. `milestone-prune` reads a whole bullet SPAN - lead line plus its indented
   continuation lines - in both the `## Active` removal and
   `archiveRequirements`. A wrapped bullet leaves no orphaned continuation lines
   behind, and its archived row's parenthetical is a complete clause rather than
   a cut at the first newline.
2. A fixture whose requirement bullets WRAP is in the suite, and it fails
   against the current implementation before the fix. The existing fixtures pass
   today, which is why three closes shipped the bug.
3. `issue-check.mjs` resolves the tracker by repository rather than by
   origin-URL host equality: a remote whose SSH host differs from its web host
   reports instead of skipping. Consulting `tea login list`'s `SSH HOST` column
   or falling through to the explicit `--repo <owner>/<name>` form both satisfy
   this; the criterion is the outcome, not the mechanism.
4. Regression cover includes a remote whose SSH host differs from its web host,
   failing-capable against the current implementation.
5. The one-line read-only degradation is unchanged for the cases that genuinely
   cannot answer - no remote, unrecognized host, missing CLI, no login, nonzero
   exit. This phase removes a false skip; it does not remove the skip arm, and
   `/cad-land` still never blocks on the tracker.
6. Proved end to end on THIS repository: a `/cad-land` dry read reports the
   issues a branch references, and a close leaves REQUIREMENTS.md needing no
   hand repair.
7. `node --test 'cadence-core/bin/*.test.mjs'` and
   `node cadence-core/bin/self-verify.mjs` both run clean.
