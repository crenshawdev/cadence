---
phase: 3
plan: 1
requirements:
  - TRK-02
files:
  - cadence-core/bin/lib/filing-decision.mjs
  - cadence-core/bin/filing-decision.test.mjs
  - cadence-core/bin/issue-filing.mjs
  - cadence-core/bin/issue-filing.test.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 3: A create states what it did - Plan

## Goal

`GH-244`. An ambiguous create is resolved against the tracker before it is
retried, never re-filed blind: `issue-filing.mjs file` asks the forge once,
title-scoped on the fire's fingerprints, before any create; an issue already
carrying a fingerprint (open or closed) is reported by number and not filed
again; a create whose outcome could not be determined leaves a local pointer
the retry honours; and one fingerprint is never created twice from one payload.

## Must be true when done

- A `file` fire holding at least one accept spawns one title-scoped lookup
  child per chunk of six fingerprints BEFORE its first create, and a fire of
  declines alone spawns nothing. The lookup argv is pinned byte-exact for tea,
  gh and glab, and no lookup vector carries `DECLINE_LABEL`.
- Given a complete lookup response whose title carries a payload finding's
  fingerprint, that finding gets no create child and the envelope names the
  issue number the forge returned, whether the row was open or closed.
- A lookup response that filled its page refuses the fire with reason
  `incomplete-lookup` before any create. A lookup child that exits nonzero
  does NOT refuse: a fingerprint with a `.planning/FILED.md` row is suppressed
  and the envelope says the ledger answered; a fingerprint with no row is
  created.
- A create that returns nonzero leaves a `.planning/FILED.md` row carrying the
  literal word `unconfirmed` before the colon, and re-running the same fire on
  that directory spawns no create for it and reports the row, whatever the
  tracker answered.
- One payload carrying the same fingerprint twice spawns one create, and two
  fires of one fingerprint leave one `FILED.md` row: the FILED.md append path
  skips a fingerprint already present. `parseFiledRows` reads an unconfirmed
  row as one row whose `text` is the title alone.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` pass; `weight-budgets.json`'s
  `triage-gate.md` row is at or above the file's measured bytes; and
  `triage-gate.md` no longer says the seam "spawns nothing, and has no page to
  fill" nor that "Only the accepts cross the network".

## Context

- D-01 adds a forge lookup to `cmdFile` and leaves `run`'s collapse of every
  `execFileSync` throw untouched. D-07/D-09: one title-scoped search per fire,
  chunked at GitHub's documented five boolean operators (six fingerprints per
  query), never a bare search (bare matches bodies). D-10: a new normalizer
  beside `normalizeDeclines`, carrying the issue number. D-11: "incomplete" and
  "unavailable" are two arms. D-04/D-06: the tracker decides on a complete
  answer; `FILED.md` is the fallback when the lookup could not run; an
  unconfirmed row is the pointer for the case the search index has not caught
  up on; `DECLINED.md` gates the ask and never the create.
- Existing patterns to follow: `readDeclines` in `issue-filing.mjs` for a local
  ledger read's absent/unreadable/conflicted posture; `HOST_TABLE` in
  `lib/issue-decision.mjs` for a per-row number key (`number`/`iid`/`index`);
  the byte-exact vector tests in `filing-decision.test.mjs`; the `stubBin` +
  `$CAD_ARGV_LOG` harness in `issue-filing.test.mjs`.
- Out of scope: any `execFileSync`-layer fix; reconciling `e7cfd661a15c38fa`'s
  double ledger entry; the 9 orphaned `FILED.md` fingerprints; a
  `cadence-filed` label; `normalizeDeclines` and `DECLINE_LABEL` stay as they
  are (dead outside tests, per D-01).
- Censuses this plan's files sit under, each holder declared in `files:` so
  `lease-check --plan-time` passes: `self-verify-merge-layers` (holder
  `cadence-core/bin/self-verify.test.mjs`; `issue-filing.mjs` is a subject and
  its one `mergeLayers` callsite inside `resolveForge` does not move, so the
  count stays eighteen over fourteen) and `weight-budgets` (holder
  `cadence-core/bin/weight-budgets.json`; `triage-gate.md` sits exactly at its
  ceiling today, task 8 re-pins). The reason census in
  `reason-census.test.mjs` is one-directional, so the tokens tasks 3 and 6 add
  pass without an owed update.

## Tasks

### Task 1: FILING_TABLE's lookup rows ask for titles carrying the fire's fingerprints

- **Files:** cadence-core/bin/lib/filing-decision.mjs (`FILING_TABLE`, the
  `DECLINE_LABEL` doc comment, the "THE FLAGS ARE MEASURED" and "THE DECLINE
  LOOKUP IS ONE LIST CALL" paragraphs), cadence-core/bin/filing-decision.test.mjs
- **Action:** Replace each row's dead label-filtered `lookup` builder (every
  one hardcodes `DECLINE_LABEL`, so an accepted issue is invisible to it - D-07)
  with a builder that takes the chunk of fingerprints the fire is asking about
  and lists issues in any state whose TITLE carries one of them, in JSON, with
  the row's own `limit` as page size and the number-plus-title fields the
  existing vectors already name. The argv per provider, read 2026-09-03 from
  the installed CLIs' own help (gh 2.99.0 `-S/--search query`; tea 0.15.1
  `--keyword/-k string`; glab 1.116.0 `--search` with `--in title`): github
  is `issue list --repo <slug> --search <q> --state all --json number,title
  --limit 200` where `<q>` is `in:title` followed by the fingerprints joined
  with ` OR ` (measured: `in:title 084c9ce03c072e0b` returned exactly the two
  duplicates, a bare token also matched GH-244's body); forgejo is
  `issues list --repo <slug> --login <login> --keyword <q> --state all --fields
  index,title --output json --limit 50` with `<q>` the fingerprints
  space-joined; gitlab is `issue list --repo <slug> --search <q> --in title
  --all --output json --per-page 100` with `<q>` space-joined. Whether tea and
  glab match a bracketed hex token or honour more than one term is CONTEXT's
  flagged assumption: write it into each of those two rows' comments rather
  than into a transcript. Export one constant stating the chunk size, six
  fingerprints per query - five OR operators, GitHub's documented ceiling, not
  the seven measured working (D-09) - beside `TITLE_MAX`, so `cmdFile` and the
  test read one number. Re-measure the "THE FLAGS ARE MEASURED" block for the
  three installed versions and the date, adding the search flags; rewrite the
  "THE DECLINE LOOKUP IS ONE LIST CALL FILTERED BY `DECLINE_LABEL`" paragraph to
  state the title-scoped search, the one-query-per-fire rail it keeps, and why
  bare is refused; rewrite the `DECLINE_LABEL` comment's claim that `LOOKUP`
  reads it back, which is now false - the label remains a fact of the create
  rows only. Leave `normalizeDeclines` and the create builders byte-identical.
  In the test file, rewrite the three pinned lookup assertions to the new
  vectors byte-exact with a two-fingerprint chunk, make the "no row names a
  binary" walk call the new builder, and add: a github chunk of six carries
  exactly five ` OR ` separators and opens with `in:title`; no provider's
  lookup vector includes `DECLINE_LABEL`; the exported chunk constant equals 6.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs` passes
  with the three rewritten vector tests and the three new assertions;
  `grep -c "'--label', DECLINE_LABEL, '--state'\|'--labels', DECLINE_LABEL, '--state'" cadence-core/bin/lib/filing-decision.mjs`
  prints 0; `grep -n "2026-08-25" cadence-core/bin/lib/filing-decision.mjs`
  prints nothing; `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: A normalizer beside normalizeDeclines returns fingerprint and issue number

- **Files:** cadence-core/bin/lib/filing-decision.mjs (beside
  `normalizeDeclines`, and one stated fact per `FILING_TABLE` row),
  cadence-core/bin/filing-decision.test.mjs
- **Action:** Add an exported normalizer written BESIDE `normalizeDeclines`,
  not by widening it (D-10: the file states its two readers stay two on
  purpose, and `normalizeDeclines` drops `number`). It takes the CLI's stdout,
  the page size, and the name of the row's number key, and answers with the
  same three-way shape as `normalizeDeclines` - a complete flag, a fixed-phrase
  detail never sliced from the response (D-13, D-16), and instead of bare
  fingerprints a list of pairs, each a fingerprint recovered through
  `fingerprintInTitle` and the positive integer found under the key. Rules:
  a response that fills its page is incomplete and carries nothing, the rule
  `normalizeDeclines` states and `normalizeList` in `lib/issue-decision.mjs`
  shares; not-text, not-JSON, not-an-array fail whole; a row that is not an
  object or whose `title` is not a string fails the whole read; a row whose
  title carries a Cadence token but whose number key is absent or not a
  positive safe integer fails the whole read (the output shape moved); a row
  whose title carries no token is skipped, a human can title an issue anything;
  `state` is never read, so a closed issue answers exactly as an open one
  (D-05). Give each `FILING_TABLE` row a frozen fact naming its number key -
  `number` for github, `iid` for gitlab, `index` for forgejo, the keys
  `HOST_TABLE` already reads - so the seam never spells a provider's key.
  Tests, after the existing normalizer block: a page of exactly `limit` rows is
  incomplete with no pairs; one under is complete with every pair's number
  read; the junk table answers incomplete without throwing; a token-carrying
  row missing its number fails whole naming the shape; a row without a token
  is skipped; each of the three keys is read through its row's stated fact; a
  row carrying `state: "closed"` is returned like any other.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs` passes
  with the seven new cases and every existing `normalizeDeclines` case
  unmodified - `git diff -U0 -- cadence-core/bin/filing-decision.test.mjs |
  grep '^-[^-]'` prints nothing, which `--stat`'s per-file aggregate cannot
  establish while the same task adds seven cases to that file;
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 3: cmdFile looks the fire up before any create, refuses a filled page, suppresses a hit

- **Files:** cadence-core/bin/issue-filing.mjs (`cmdFile`, the constants beside
  `CREATE_TIMEOUT_MS`, the header's "No forge CLI's stdout is read here at all
  any more" and "SO THE ONLY REMOTE WRITE LEFT" paragraphs),
  cadence-core/bin/issue-filing.test.mjs
- **Action:** This is the tracer bullet: after this task a fire reaches the
  forge for a lookup and back, and every later task adds depth. Restore a
  lookup bound of 30000 ms beside `CREATE_TIMEOUT_MS` (the value `5f4bcb97`
  deleted, with a comment stating why a read is bounded shorter than a write).
  In `cmdFile`, after `resolveForge` succeeds and before the create loop, when
  at least one entry is an accept: take the distinct accept fingerprints, chunk
  them at task 1's constant, and for every chunk spawn `forge.row`'s lookup
  through `run` with the lookup bound, then read it with task 2's normalizer and
  the row's number key. Three outcomes over the chunks, decided before the
  first create: every chunk complete gives a map from fingerprint to issue
  number; any chunk that RAN but came back incomplete emits `ok: false` with
  reason `incomplete-lookup` (the name the removal took away), a detail naming
  the repo and the normalizer's fixed phrase, and a hint saying nothing has
  been filed and that a page-filling answer to a title-scoped search means
  either truncation or a forge that did not apply the search - run the CLI
  yourself to see which; any chunk whose child `run` reports not ok marks the
  fingerprints IN THAT CHUNK unanswered and does NOT refuse (D-11) - in this
  task that arm falls through to the create loop unchanged, task 6 gives it the
  ledger. Availability is PER FINGERPRINT, never one flag for the fire: a chunk
  that completed keeps its answer for the fingerprints it covered even when a
  sibling chunk's child failed, so the seam carries a per-fingerprint state of
  answered-hit, answered-miss or unanswered rather than a map plus a boolean.
  A fire-wide flag would discard an answer the forge actually gave and re-file
  an issue the lookup had just found - the same defect phase 1 fixed in
  `resolveRange`, where one unresolvable end threw away the end that resolved.
  The `incomplete-lookup` refusal stays fire-wide because it refuses before any
  create and no per-fingerprint state survives it. In the loop
  an accept whose fingerprint is answered-hit spawns no create; it is reported on
  the envelope in a list beside `filed` carrying its fingerprint, disposition,
  title and the issue number, with its own count beside `accepted`, and it is
  not mirrored into `FILED.md`. A fire with no accept spawns no child at all.
  Never read `DECLINED.md` on this face (D-04). Rewrite the header: exactly one
  child's stdout is read now, the title-scoped lookup, through a normalizer that
  returns fixed phrases and integers, and no byte of it reaches an envelope
  (D-13); the "no round trip per finding" claim now holds by construction of
  one query per chunk of six rather than "trivially". Extend `stubBin` so a
  case can make the `list` branch exit nonzero. Tests: three accepts log exactly
  one list call and it precedes the first create in the argv log; the logged
  gh list call carries `--search`, `in:title` and every accept's fingerprint;
  a `listBody` holding FIVE[1]'s `issueTitle` under number 7 yields two
  creates, an envelope naming 7 against FIVE[1]'s fingerprint, and no FILED.md
  row for FIVE[1]; the same with `state: "closed"` on that row behaves
  identically; a `listBody` of 200 token-carrying rows refuses
  `incomplete-lookup` with zero creates; a list exiting nonzero leaves `ok`
  true and the creates running; a declines-only fire logs no list call and no
  create; the forgejo arm's list call carries `--login`. Rewrite the assertion
  in "the create-failed hint is honest that the failed create may have LANDED"
  that `listCalls` is empty into one list call.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes with
  the eight new cases; `grep -c "incomplete-lookup" cadence-core/bin/issue-filing.mjs`
  prints at least 1; `grep -n "No forge CLI's stdout is read here at all" cadence-core/bin/issue-filing.mjs`
  prints nothing; `node --test cadence-core/bin/self-verify.test.mjs` passes
  (check 12's count unchanged); `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: The FILED.md grammar learns an unconfirmed row

- **Files:** cadence-core/bin/lib/planning-files.mjs (`FILED_ROW`, `appendRow`,
  `parseRows`, `FILED_PREAMBLE`), cadence-core/bin/planning-files.test.mjs
- **Action:** Extend `FILED_ROW` so a row may carry the literal word
  `unconfirmed` between the fingerprint and the colon - the shape is
  `- <date> <provider> <slug> <fingerprint> unconfirmed: <title>` - keeping
  everything before `: ` fully constrained so the title keeps the colon,
  backtick and pipe freedom the comment above `FILED_ROW` earns. `appendRow`
  writes the word when the row object asks for it through one added boolean
  field whose absence means confirmed, so every existing caller and fixture is
  untouched; `parseRows` answers each row with its state so a reader can tell
  the two apart, and `text` stays the title alone with no marker leaking into
  the recall corpus. `appendDeclinedRow` shares `appendRow`: the decline
  appender never sets the flag because no create precedes a decline, and say so
  in its comment; the parser accepts the word on either file since it is one
  grammar. Add one sentence to `FILED_PREAMBLE` naming the unconfirmed state:
  a create the seam could not confirm landed, kept so a retry does not file it
  twice. Do NOT put the fingerprint-dedup here: `appendRow` returning its input
  unchanged already means "refused by grammar" to `mirrorFiled`, and a second
  unchanged-return meaning would be indistinguishable from it - the skip is
  task 5's, in the seam. Tests in the FILED block: an unconfirmed row written by
  the appender reads back as ONE row with the title as `text`, the fingerprint
  read and the state readable; a confirmed row reads back byte-identically to
  before (the existing round-trip case is not edited); a title that itself
  contains the word `unconfirmed` is not misread; a hand-written unconfirmed
  row using the grammar line above parses.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes
  with the four new cases and no existing FILED or DECLINED case edited;
  `node --test cadence-core/bin/planning-recall.test.mjs` passes unchanged;
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 5: An ambiguous create writes an unconfirmed row, and the FILED.md append path skips a fingerprint already present

- **Files:** cadence-core/bin/issue-filing.mjs (`cmdFile`'s create-failed arm
  and its "A NONZERO CREATE IS AMBIGUOUS" comment, `mirrorFiled`),
  cadence-core/bin/issue-filing.test.mjs
- **Action:** At the create-failed site, pass the entry whose create returned
  not ok to `mirrorFiled` flagged unconfirmed, so it lands as an unconfirmed
  `FILED.md` row beside the confirmed ones (D-06: the local pointer that does
  not depend on a search index); the entries after it, never attempted, get no
  row, and `unfiled` keeps listing all of them. Rewrite the hint: the create is
  still AMBIGUOUS rather than known-failed, but the operator is no longer told
  to search by hand - re-run this step with the unfiled entries and the seam's
  own lookup plus the unconfirmed row suppress the duplicate. Rewrite the
  comment that says nothing cheap could tell the cases apart, which task 3 made
  false (D-13). In `mirrorFiled`'s FILED.md arm, inside the lock and after the
  read, parse the text with `parseFiledRows` and decide on the fingerprint AND
  the state, checking presence BEFORE calling the appender so a skip never
  trips the `text === before` grammar refusal: a CONFIRMED write whose
  fingerprint is already present in either state is skipped; an UNCONFIRMED
  write whose fingerprint is already present as UNCONFIRMED is skipped; an
  UNCONFIRMED write whose fingerprint is present only as CONFIRMED REWRITES
  that one row's state in place - the matched row's `<fingerprint>:` becomes
  `<fingerprint> unconfirmed:` in the text already held under the lock, no
  second row appended. Skipping that last case is what would swallow the marker
  D-06 exists for: over one of D-04's 9 orphaned confirmed rows, a complete
  tracker miss creates, the create returns nonzero, and with the row left
  confirmed the retry reads another complete miss and files the same issue
  again. Rewriting in place rather than appending is what keeps AC6's one row
  per fingerprint true. Leave
  the DECLINED.md arm alone: a declined fingerprint never reaches a second fire
  because `cmdUnfixed` filters on `readDeclines`, and an in-payload duplicate is
  task 7's. Tests: three accepts with `failAt: 3` leave three FILED.md rows and
  only the third carries `unconfirmed`; the rewritten hint case pins the new
  instruction and drops the `/SEARCH .../` and `/BEFORE re-filing it/`
  assertions; a `prepare` hook planting a confirmed FILED.md row for FIVE[0]
  with the stub's list answering `[]` yields one create (a complete miss is the
  tracker's answer, D-04's accepted cost for the 9 orphans) and FILED.md still
  holds exactly one row for that fingerprint.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes with
  the three cases; `grep -c "unconfirmed" cadence-core/bin/issue-filing.mjs`
  prints at least 1; `grep -n "nothing cheap could" cadence-core/bin/issue-filing.mjs`
  prints nothing; `npx tsc -p tsconfig.ci.json` exits 0.

### Task 6: A lookup that could not run falls through to FILED.md, and an unconfirmed row suppresses on its own

- **Files:** cadence-core/bin/issue-filing.mjs (`cmdFile`, a reader beside
  `readDeclines`), cadence-core/bin/issue-filing.test.mjs
- **Action:** Add a reader of `.planning/FILED.md` beside `readDeclines` with
  its exact posture: ENOENT with no entry is an empty ledger; any other read
  error, a dangling symlink and git conflict markers refuse with their own
  reason token and a hint in `declines-unreadable`'s register, because a fire
  that cannot tell what it already filed must not guess. It answers the parsed
  rows keyed by fingerprint with each row's state. `cmdFile` reads it for
  every fire holding an accept, before the lookup and before any create, so
  its refusal precedes the first child. Then the precedence, per accept, in
  this order: an UNCONFIRMED row for the fingerprint suppresses whatever the
  tracker answered - the row exists precisely because the tracker's index could
  not be trusted for it (D-06's 4-second case) - and the report names the row's
  date and `FILED.md`, PLUS the issue number when the lookup also completed with
  a hit for that fingerprint. Suppression is the row's; the number is reported
  whenever one is in hand, because AC4 asks the retry to report the issue that
  already exists and withholding a number the forge just returned answers it
  with a date instead. With no completed hit the report names the row alone,
  since no number exists to name; otherwise if the lookup COMPLETED
  its answer is final - a hit suppresses naming the number (task 3), a miss
  creates even over a confirmed row (D-04); otherwise, the lookup could not
  run, a confirmed row suppresses naming the row and an absent row creates.
  The envelope states, for each suppressed entry, which authority answered,
  and when the ledger stood in for an unavailable lookup it says so on the
  envelope. Tests: list exiting nonzero plus a planted confirmed row for
  FIVE[0] and accepts of FIVE[0] and FIVE[2] yields one create (FIVE[2]) and an
  envelope whose JSON names `FILED.md` against FIVE[0]; list exiting nonzero
  with no ledger yields every create; AC4 end to end - one accept with
  `failAt: 1` leaves an unconfirmed row, then the same payload re-run on that
  directory (the two-run pattern of "a second fire appends") with a fresh stub
  answering `[]` spawns zero creates and the envelope names the row; an
  unreadable FILED.md (mode 000, the `chmodSync` pattern of the DECLINED
  case) refuses before any create; a DECLINED.md row for FIVE[0] does not stop
  `file` creating FIVE[0] when the user accepted it.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes with
  the five cases; `grep -c "= readDeclines(" cadence-core/bin/issue-filing.mjs`
  prints 1 (the ask face's call, none added on the file face);
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 7: One payload carrying a fingerprint twice spawns one create

- **Files:** cadence-core/bin/issue-filing.mjs (`cmdFile`, between
  `readDispositions` and `resolveForge`), cadence-core/bin/issue-filing.test.mjs
- **Action:** Collapse `read.entries` by `fingerprint(finding)` before the
  forge is resolved, first occurrence wins, so the lookup, the loop, `filed`,
  `unfiled` and every count ("N of M were filed", `accepted`, `declined`) run
  over the collapsed set and a duplicate appears nowhere twice. Not in
  `readDispositions`, which validates shape and is not a dedup site (D-03), and
  not in the tracker path, which cannot see this shape at all (D-08: the four
  seconds between `#241` and `#242` fit an in-payload duplicate as well as a
  retry) - state both in the comment. Tests: two identical accept entries log
  one create, leave one FILED.md row and one `filed` entry; an accept followed
  by a decline of the same finding creates once and writes no DECLINED.md row.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes with
  the two cases; `node cadence-core/bin/test.mjs` passes;
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 8: triage-gate.md states the lookup and its budget row rises in the same commit

- **Files:** cadence-core/references/triage-gate.md (the `unfixed` paragraph
  under "The set is READ, never judged" and the `file` paragraph after "Then
  make ONE call with the dispositions"), cadence-core/bin/weight-budgets.json
- **Action:** Rewrite the sentence claiming the seam "reads
  `.planning/DECLINED.md`, spawns nothing, and has no page to fill" so it is
  scoped to the ASK face alone and points at the `file` paragraph for the one
  lookup. Rewrite "Only the accepts cross the network" into what `file` now
  does: for a fire with accepts, one title-scoped lookup for the fire's
  fingerprints (chunked at six) before any create, then one create per accept
  the tracker does not already hold; a fingerprint already on the tracker, open
  or closed, or carrying an unconfirmed `FILED.md` row, is reported with the
  issue it already has and is not filed again; a lookup that filled its page
  refuses before any create; a lookup that could not run falls through to
  `FILED.md`; and a create the seam could not confirm leaves an unconfirmed
  `FILED.md` row so the retry cannot duplicate it. Keep the surrounding rails
  (one ask step, add no receipt) untouched. Then run
  `node cadence-core/bin/weight.mjs --root .` and write its `surfaces[].bytes`
  figure for `cadence-core/references/triage-gate.md` into that file's row in
  `weight-budgets.json` (today 25593 against a 25593 ceiling, so any growth
  reds self-verify until the row moves - D-14).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun` problem; `grep -n "spawns nothing, and has no page to fill\|Only the accepts cross the network" cadence-core/references/triage-gate.md`
  prints nothing; `grep -c "unconfirmed" cadence-core/references/triage-gate.md`
  prints at least 1; `node cadence-core/bin/test.mjs` passes.

## Notes

- Precedence reading, recorded because D-04 and D-06 meet at one edge: D-04
  says the tracker decides on a complete answer, and D-06 says the unconfirmed
  row closes the 4-second case "which a search-based lookup alone may not". A
  complete miss on a fingerprint that has an unconfirmed row is exactly that
  case, so task 6 lets the unconfirmed row suppress over a complete miss, while
  a CONFIRMED row defers to a complete miss (D-04's stated cost for the 9
  orphans). Suppression and REPORTING are separate: an unconfirmed row
  suppresses whatever the tracker said, and the number is still named when a
  completed lookup returned one (AC4). Cost: an unconfirmed row for a create that truly never landed holds
  that finding until a human deletes the row; the row's marker is what tells
  them which rows are unverified.
- Query join spelling for tea and glab is space-joined tokens (the CLIs offer
  one search string and no OR); this is CONTEXT's flagged assumption, written
  into the two rows' comments by task 1. If wrong, those arms return nothing,
  the page-fill rail still holds, and the pinned vector test still passes.
- Not in any task, for the human: a fingerprint the tracker already holds but
  `FILED.md` does not (the pre-phase `#241`/`#242` shape) is suppressed and
  reported but gets no `FILED.md` row minted, so recall keeps no pointer to it;
  the live `.planning/FILED.md` preamble still says a decline's "only record is
  the decline label on the forge", a stale hand-written line outside the
  seam's grammar; `normalizeDeclines` and `DECLINE_LABEL`'s lookup use remain
  dead code kept by tests, per D-01.
- Recalled `v3.7.10/phases/3/SUMMARY.md` (idempotent on the tracker, not the
  ledger) was measured false by D-02 and is not carried; tasks 5 and 7 address
  the actual duplicate paths D-02 and D-08 name.
- Plan shape: one plan, as CONTEXT directs; every task shares
  `issue-filing.mjs` or `filing-decision.mjs`, so no independent slice exists.
- Plan review (`openai`, adjudicated): 6 raised, 6 confirmed, 4 applied above -
  per-fingerprint lookup state in task 3, the unconfirmed-over-confirmed rewrite
  in task 5, the number reported beside an unconfirmed row in task 6, and a
  falsifiable preservation check in task 2. Two stand unfixed and are recorded
  rather than applied: an empty tea/glab response is still treated as a complete
  miss, so duplicate protection on those two forges rides D-12's flagged
  assumption (raised `high`, overridden); and an unreadable `FILED.md` still
  refuses before the lookup runs rather than only on the path that needs the
  ledger (raised `medium`, ruled `low`).
