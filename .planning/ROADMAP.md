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


## Phase Details
