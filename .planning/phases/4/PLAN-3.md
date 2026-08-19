---
phase: 4
plan: 3
requirements: [ARG-06]
files:
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/worktree-base.mjs
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/weight.mjs
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/lib/seam-input.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/seam-input.test.mjs
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/bin/git-publish.test.mjs
---

# Phase 4: One argument contract instead of nine - Plan 3

## Goal

The seven bins already on `lib/seam-input.mjs` re-express their flags as
declarations rather than hand-written reader calls, and with the last caller
gone `optionalFlag` collapses into the contract - so the two-reader divergence
this tree has carried since phase 3 becomes one declared disposition.

## Must be true when done

- Each of the seven bins reads its flags through its declared row, and every one
  behaves exactly as it does today: `--dir` still refuses the empty, valueless
  and flag-shaped spellings as `missing-flag-value` on one stdout line with exit
  1, an absent `--dir` still falls through to `process.cwd()`, and no
  subcommand's output changes.
- `issue-check.mjs check` with a malformed `--timeout-ms` still returns
  `ok:true` on its constant, and `release-bump.mjs bump` with a bare or empty
  `--date` still refuses `bad-date` with its existing detail.
- `cadence-core/bin/lib/seam-input.mjs` no longer exports `optionalFlag`, and
  still exports `flagValue` and `readText`.
- `seam-input.test.mjs` carries no surviving divergence arm.
- `helper-census.test.mjs` still asserts exactly one home for every reader it
  censuses, with the fallback reader's row pointing at its new home.
- `node cadence-core/bin/test.mjs` reports 0 failures and `node
  cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`.

## Context

D-01 binds the reach: the eight bins already on `lib/seam-input.mjs` re-declare
rather than keep hand-written `flagValue` calls, because a contract only the
four parsers adopt leaves eight seams still restating the rules (the eighth,
`self-verify.mjs`, adopts in plan 1). D-08 keeps the THROWING mechanism for
these seams - each holds an `e.seam` catch arm, and without one a valueless
`--dir` surfaces as `{"ok":false,"reason":"internal","detail":"[object
Object]"}`. D-12 keeps `--branch`, `--base`, `--remote`, `--merged` and
`--version` on today's behavior through the `fallback` disposition, which is
what makes the collapse safe. D-09 binds the collapse: `optionalFlag` collapses
INTO the contract, and the census rows plus the divergence arm are rewritten in
the SAME commit - the second reversal of this file's two-contract guarantee,
after phase 2's D-01 made the first.

## Tasks

### Task 1: The four `--dir`-only seams re-declare their flags

- **Files:** cadence-core/bin/git-branch.mjs (the dispatch block and its `flag`
  binding), cadence-core/bin/git-publish.mjs, cadence-core/bin/land-cleanup.mjs,
  cadence-core/bin/worktree-base.mjs
- **Action:** Each of the four reads its flags through its declared row instead
  of the hand-written `flagValue(argv, '--dir') || process.cwd()` call and the
  `const flag = (name) => optionalFlag(argv, name)` adapter binding beside it.
  Behavior is unchanged in both directions and that is the point of the task:
  `--dir` keeps refusing the empty, valueless and flag-shaped spellings through
  the throwing mechanism and each file's existing `e.seam` catch arm, a
  genuinely ABSENT `--dir` still falls through to `process.cwd()`, and
  `--branch`, `--base`, `--remote` and `--merged` keep answering as they do now
  by declaring the `fallback` disposition, so a valueless spelling their `||
  fallback` currently absorbs is still absorbed (D-12). Do not touch the usage
  strings, the subcommand names, or `git-publish.mjs`'s `redactUrl` on the
  internal arm. Four files, one edit repeated - they land together because they
  are one change, not four decisions.
- **Verify:** For each of `git-branch.mjs decide`, `git-publish.mjs authorized`,
  `land-cleanup.mjs gate` and `worktree-base.mjs resolve`, both `--dir ''` and a
  trailing bare `--dir` print exactly one JSON line
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` and exit 1;
  `git-branch.mjs tags` with no `--dir` still answers about the current tree;
  `land-cleanup.mjs cleanup --branch` (bare) behaves as it does today; `node
  cadence-core/bin/test.mjs git` reports 0 failures.

### Task 2: `issue-check.mjs` and `weight.mjs` re-declare, keeping their own refusals

- **Files:** cadence-core/bin/issue-check.mjs (the dispatch block),
  cadence-core/bin/weight.mjs
- **Action:** Both read their flags through their declared rows.
  `issue-check.mjs`'s `--timeout-ms` declares the FALLBACK disposition and keeps
  falling back to `DEFAULT_TIMEOUT_MS` on a malformed or non-positive value:
  this seam's whole contract is that it never fails a land, and a contract that
  made every typed flag refuse would hand it the power to fail one (D-04). Its
  own extra term - the value must be greater than zero - stays, since the shared
  integer type does not carry positivity. `--base` keeps `fallback`.
  `weight.mjs` keeps the throwing form and its `e.seam` arm for `--root`,
  `--command` and `--role`; its `unknown-command` and `unknown-role` throws are
  weight.mjs's own domain refusals about a filter that matched nothing, not
  argument-shape refusals, and must not move into the contract.
- **Verify:** `node cadence-core/bin/issue-check.mjs check --timeout-ms abc
  --dir <a scratch dir>` returns `ok:true` (the constant applied), and the same
  with `--timeout-ms ''`; `node cadence-core/bin/issue-check.mjs check --dir ''`
  returns `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}`; `node
  cadence-core/bin/weight.mjs --root ''` returns the same `missing-flag-value`
  shape naming `--root`; `node cadence-core/bin/weight.mjs resident --command
  nosuch` still returns `{"ok":false,"reason":"unknown-command","detail":"nosuch"}`;
  `node cadence-core/bin/test.mjs git prose` reports 0 failures.

### Task 3: `release-bump.mjs` re-declares and its hand-written presence probe goes

- **Files:** cadence-core/bin/release-bump.mjs (the dispatch block's `dateArg` /
  `datePresent` pair)
- **Action:** `--date` is the flag that made the bare-versus-empty split visible
  in this tree: the file reads the value with the non-throwing reader and then
  tests the flag's OWN appearance in argv beside it, because `''` is falsy and a
  truthiness test would BE the absent-versus-empty collapse, while the
  non-throwing reader answers `undefined` for a TRAILING valueless `--date`
  exactly as it does for an absent one. Declare `--date` with the refuse
  bare-flag disposition so that rule comes from the declaration and the second
  probe goes. Everything the refusal says stays: `badDateDetail`, the `bad-date`
  reason, and the envelope carrying no `manifest`, `siblings` or `changelog`
  fields, because those are filled from a manifest this path never reads and
  filling them here would fabricate them. `--version` keeps `fallback` (D-12)
  and `--dir` keeps the throwing form and the `e.seam` arm.
- **Verify:** `node cadence-core/bin/release-bump.mjs bump --dir <scratch>
  --date` (trailing, bare) returns
  `{"ok":false,"action":"refuse","reason":"bad-date",...}` with its existing
  detail sentence; the same with `--date ''`; `node
  cadence-core/bin/release-bump.mjs bump --dir <scratch> --date 2026-08-19`
  behaves as it does today; `node --test cadence-core/bin/release-bump.test.mjs`
  passes.

### Task 4: `optionalFlag` collapses into the contract

- **Files:** cadence-core/bin/lib/seam-input.mjs,
  cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/seam-input.test.mjs,
  cadence-core/bin/helper-census.test.mjs
- **Action:** With the last bin caller gone, `optionalFlag` collapses INTO the
  contract (D-09): `lib/seam-input.mjs` stops exporting it and its body moves to
  the contract module's fallback arm. `flagValue` STAYS in `lib/seam-input.mjs`
  and stays exported, and so does `readText` - D-08 keeps the throwing mechanism
  alive for these seams, and only `optionalFlag` collapses. Four surfaces move
  in the SAME commit, the discipline phase 2's D-01 set when it edited the
  header and the divergence arm rather than leaving them to go red: (i)
  `lib/seam-input.mjs`'s header, which still opens "THE TWO FLAG READERS ARE TWO
  CONTRACTS, AND BOTH ARE LIVE" and enumerates the defaulting flags as the
  reason there are two; (ii) `seam-input.test.mjs`'s divergence arm - the test
  named "the two readers DISAGREE on a present-but-valueless flag,
  deliberately" - plus its four `optionalFlag` rows and the header paragraph
  explaining why they are spelled on `--branch`; (iii)
  `helper-census.test.mjs`'s row for the non-throwing positional flag reader,
  whose `home` and body-idiom pattern move to the contract module so a
  paste-back under a new name still reddens, and whose `note` must tell a
  contributor where to import from now; (iv) the contract module itself, which
  stops importing the reader it now owns. Keep `helper-census.test.mjs`'s own
  discipline intact: every pattern is built from an escaped string so the text a
  rule matches never appears verbatim in that file and it is censused by the
  same walk with no exemption, and the walk's file-count floor and its
  named-file list stay honest.
- **Verify:** `grep -c "export function optionalFlag"
  cadence-core/bin/lib/seam-input.mjs` returns 0 while `grep -c "export function
  flagValue" cadence-core/bin/lib/seam-input.mjs` returns 1; `grep -c "DISAGREE"
  cadence-core/bin/seam-input.test.mjs` returns 0; `node
  cadence-core/bin/test.mjs` reports 0 failures with the census still asserting
  exactly one home per reader; `node cadence-core/bin/self-verify.mjs` returns
  `{"ok":true,...,"problems":[]}`.

## Notes

Depends on plan 1 (the module must exist) and shares
`cadence-core/bin/lib/arg-contract.mjs` with it for task 4's collapse, so plans
1 and 3 are SEQUENTIAL and must not run on the parallel path. Task 4 must be
last within this plan: removing the export before tasks 1-3 land breaks six
callers at once and leaves the repo red mid-plan.

The "one JSON line on stdout, exit 1, nothing on stderr" shape every Verify
above asserts is phase 2's D-02 (`.planning/phases/2/CONTEXT.md`): the refusal
is the SEAM ENVELOPE, because stderr is a channel no workflow reading these
seams parses. It is restated here as a check, not re-decided.

Flagged assumption carried forward: the seven bins can re-declare with no
behavior change beyond D-12's fallback disposition. Every Verify above is
written as a before/after equality against today's output for exactly that
reason. If a seam whose `|| fallback` absorbed something D-12 does not name
starts refusing an input it used to accept, that is a deviation to record, not a
cost to absorb quietly.
