# Roadmap

## Overview

**`v3.5.2 - one reader, one transport`, opened 2026-08-16.** Scoped off the
Forgejo milestone, which holds two issues: #133 and #132.

**The theme is one sentence: two places that must agree about the same thing
were written twice, and the copies drifted.** Both issues came out of an
external deep dive against `v3.3.0`, both were adjudicated AGREE-high, and
neither is a bug a user has hit yet - they are surfaces where the tree already
concedes the correct rule in one place and prescribes the wrong one elsewhere.
That makes both cheap to fix and easy to reintroduce, which is why each phase
ships a check rather than only a correction.

`#133` is the shell transport. `planning.mjs:3815` already states why
caller-derived prose cannot ride in a double-quoted shell word: an item carrying
`$(...)` or a backtick executes before Node starts, and a path cannot. That
reasoning is conceded for `capture` alone, and roughly sixteen other workflow
sites still prescribe the unsafe form for values derived from agent output or
repository content. The fix is the transport stated once and applied everywhere
it governs, not sixteen local escapes.

`#132` is the lease. `plan-overlap` intersects declared `files:` by exact string
equality (`planning.mjs:1788`) while `lease-check` reads a trailing slash as a
directory prefix (`planning.mjs:2217-2218`), so a phase declaring `src/` in one
plan and `src/auth.js` in another produces an empty `overlaps`, passes the
parallel-safety gate, and then authorizes both plans to stage the same file.
`references/plan-frontmatter.md` documents no trailing-slash form, which bounds
the likelihood and not the validity: `lease-check` honours it, so it is live.
The fix shape is one shared lease-normalization module both readers call.

The two phases are independent - disjoint files, disjoint seams - and neither
depends on the other's outcome.

## Phases


## Phase Details
