---
status: testing
phase: 3
fields_version: 1
started: 2026-09-03
updated: 2026-09-03
---

## Items

### 1. One lookup per fire, before any create
expected: A `file` fire with at least one accepted finding issues exactly one tracker lookup before any create child, title-scoped on the fire's fingerprints and chunked at five boolean operators. filing-decision.test.mjs pins the lookup argv byte-exact for tea, gh and glab, and the walk asserting no row names a binary covers the new lookup row.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: LOOKUP_CHUNK=6 at filing-decision.mjs:332 and chunked spawning at issue-filing.mjs:647-651, all before the create loop. Byte-exact argv pinned for tea, gh and glab ('the forgejo/github/gitlab create and lookup vectors are exactly these'), the github chunk of six carries exactly five ' OR ' separators and opens with 'in:title', no lookup vector carries DECLINE_LABEL or a label flag, and 'no row names a binary' now walks row.lookup(...) too (filing-decision.test.mjs:479-489). Behaviour observed: 3 accepts -> exactly 1 list call, logged before the first create; declines alone -> no child at all; a 7-accept spot-check -> 2 list calls sized [6,1], both preceding every create.

### 2. A tracker hit reports the issue instead of filing again
expected: Given a complete lookup response carrying a payload finding's fingerprint, no create child is spawned for that finding and the fire's report names the existing issue number. Holds for a CLOSED issue exactly as for an open one.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: issue-filing.mjs:836-840 suppresses with authority 'tracker' and the number, and normalizeLookup never reads `state`. 'a fingerprint the tracker already holds gets no create and is reported by NUMBER' (3 accepts -> 2 creates, suppressed [[fp,7]], suppressed_count 1, no FILED.md row for it) and 'a CLOSED issue suppresses exactly as an open one does (D-05)' both pass; a spot-check traced number 42 from the stub's stdout onto envelope.suppressed[0].issue.

### 3. Filled page refuses; a lookup that could not run falls through
expected: A lookup response that filled its page refuses the fire before any create and names the incomplete cause. A lookup that could not run does NOT refuse: it falls through to .planning/FILED.md and suppresses on a fingerprint with a row there.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Two distinct arms at issue-filing.mjs:652-670. 'a lookup that FILLED ITS PAGE refuses the fire before any create' -> status 1, reason incomplete-lookup, detail names the repo and 'filled the 200-row page', 0 creates, FILED.md untouched. 'a lookup child that could NOT RUN does not refuse - the creates still run' and 'a lookup that could not run falls through to FILED.md, per fingerprint' -> ok:true, only the fingerprint with no row is created, envelope names FILED.md with the row's date and sets ledger_stood_in.

### 4. An ambiguous create writes an unconfirmed row the retry honours
expected: A create whose outcome could not be determined appends a FILED.md row marked unconfirmed, and re-running that same fire spawns no create and reports the issue that already exists.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: 'AC4 end to end: an ambiguous create is not re-filed on the next fire' passes - failAt:1 leaves `<fp> unconfirmed: `, and the same payload re-run on that directory against a fresh stub answering [] makes zero creates, names the row, and leaves exactly one row still marked. The reporting half was additionally observed by spot-check: with the same unconfirmed row and a completed lookup hit, the envelope names issue 42 alongside authority FILED.md.

### 5. One fingerprint twice in one payload is one create
expected: A fire payload carrying the same fingerprint twice spawns one create, not two.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Collapse by fingerprint at issue-filing.mjs:719-725, before the ledger read, the lookup and every count. 'a payload carrying the same fingerprint TWICE spawns one create' -> 1 create, 1 list, filed.length 1, accepted 1, one FILED.md row; 'an accept followed by a DECLINE of the same finding creates once and declines nothing' -> declined 0 and an empty DECLINED.md.

### 6. One fire twice leaves one FILED.md row per fingerprint
expected: Running one fire twice leaves one FILED.md row per fingerprint: the append path skips a row whose fingerprint is already present, and parseFiledRows reads an unconfirmed row without minting a second recall entry.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Presence is checked under the lock before the appender runs (issue-filing.mjs:532-546), and an unconfirmed write over a confirmed row is rewritten in place by markUnconfirmed rather than appended. Tests pass for the skip, the in-place rewrite and the second-fire append. FILED_ROW keeps the marker before the colon (planning-files.mjs:1250) so parseFiledRows returns text = the title alone; observed directly - one row in, one corpus entry out, no 'unconfirmed' anywhere in that text, and recall.mjs:179-180 pushes one entry per row.

### 7. Suite, types, self-verify and the budget row
expected: node cadence-core/bin/test.mjs, npx tsc -p tsconfig.ci.json and self-verify all pass, with weight-budgets.json's triage-gate.md row matching that file's measured size and its stale claims about spawning nothing and only accepts crossing the network rewritten.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3806 pass / 0 fail exit 0; npx tsc -p tsconfig.ci.json exit 0; self-verify.mjs exit 0, ok:true, 0 problems. weight.mjs measures triage-gate.md at 26804 bytes and weight-budgets.json's row is 26804. Both stale sentences are gone from triage-gate.md: the ask paragraph is scoped to the ASK FACE and defers to the file paragraph, and the file paragraph states the chunked title-scoped lookup, open-or-closed suppression, the unconfirmed row, the filled-page refusal and the could-not-run fallthrough.

### 8. Run the forgejo and gitlab lookup queries against a live instance that holds an issue whose title carries a known Cadence fingerprint: `tea issues list --repo <slug> --login <login> --keyword '<fp1> <fp2>' --state all --fields index,title --output json --limit 50` and `glab issue list --repo <slug> --search '<fp1> <fp2>' --in title --all --output json --per-page 100`. If the issue comes back, flip that row's `lookupMeasured` to true in cadence-core/bin/lib/filing-decision.mjs and replace its ASSUMED comment with the measurement; if it does not, the join spelling in that row's `lookup` builder is what has to change.
expected: Each query returns the issue whose title carries the fingerprint, and a two-token query returns both - which is what makes an empty answer on those forges real evidence of a miss rather than a query that matched nothing.
origin: verifier
why_human: Out-of-reach resource, not an unexercised path: settling it needs a live Forgejo and a live GitLab instance already holding an issue whose title carries a Cadence fingerprint. No such instance exists in this environment, the check is a network call this verification may not make, and no stub can answer it - a stub would only replay the assumption. The github arm was measured live on 2026-09-03 and is the reason that row alone carries lookupMeasured: true.
status: skipped
reported: do it
reason: Half measured, half unreachable. FORGEJO: settled live 2026-09-03 against the Forgejo mirror of crenshawdev/cadence. Two issues titled `[cadence aaaa0000bbbb1111] ...` and `[cadence cccc2222dddd3333] ...` were created (#1 and #2 at git.jcrenshaw.dev/crenshawdev/cadence), then the pinned argv was run: `tea issues list --repo crenshawdev/cadence --login git.jcrenshaw.dev --keyword 'aaaa0000bbbb1111' --state all --fields index,title --output json --limit 50` returned exactly #1; the same call with 'aaaa0000bbbb1111 cccc2222dddd3333' returned BOTH #2 and #1; a control token no title carried returned []. Both halves of D-12's assumption held, so the forgejo row is now lookupMeasured: true with its comment rewritten to the measurement, committed as 0e8ddd31. GITLAB: cannot be tested on this machine - `~/.config/glab-cli/config.yml` names no host, so `glab --search --in title` has no live instance to run against. That row stays lookupMeasured: false, its comment now says it is the only row still assuming, and the two unmeasured-row cases in issue-filing.test.mjs were re-pointed to it. Checks after the change: full suite 3806 pass / 0 fail, npx tsc -p tsconfig.ci.json exit 0, self-verify ok:true 0 problems.

## Summary

total: 8
passed: 7
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 0
