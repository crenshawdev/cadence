---
status: testing
phase: 4
started: 2026-07-27
updated: 2026-07-27
---

## Items

### 1. Decimal cursor is warned about, never shifted
expected: On a tree whose STATE cursor reads `Phase: 2.1 of N`, `planning.mjs renumber remove --n 1` leaves the cursor's phase at 2.1, moves `total` by the delta, and returns a `warn` naming 2.1 and telling you to re-point it. ROADMAP still shows the `**Phase 2.1: ...**` token and phases/2.1/ is untouched. `insert --at 2` behaves the same, with total moving the other way.
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:775-781. Live: remove --n 1 on a 2.1 cursor -> warn:"cursor sits on decimal phase 2.1 ... re-point it", STATE keeps Phase 2.1, ROADMAP token intact, phases/2.1/PLAN.md intact; insert --at 2 identical with total moving the other way.

### 2. No warn when the shift point sits above the decimal cursor
expected: With the same 2.1 cursor, `renumber remove --n 3` emits NO warn and leaves the cursor untouched (nothing would have moved). An integer cursor at or above the shift point still shifts exactly as before.
status: pass
first_pass: pass
source: verifier
evidence: remove --n 3 with a 2.1 cursor -> no warn key, cursor untouched. Integer cursor 3 + remove --n 1 -> Phase: 2 of 4 (C), so integer shifting is unchanged.

### 3. A colliding renumber destination is refused before any write
expected: `renumber insert --at 3` on a tree that already has an out-of-roadmap phases/4/ exits ok:false naming phases/4 as the collision. No directory moved, ROADMAP byte-identical, no phases/4/3/ created. `--dry-run` refuses identically. A dangling symlink at phases/4 refuses the same way.
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:698-712, occupied() at :652. Stray phases/4/ and a dangling symlink phases/4 both -> {ok:false,reason:collision} on apply AND --dry-run; ROADMAP sha unchanged; no phases/4/3/; phases/4/PLAN.md still '# stray'.

### 4. A partial apply reports which ops completed
expected: A renumber apply that fails partway (read-only .planning) exits ok:false with reason `partial-apply`, a `completed` list naming the ops that ran in order, and a `failed` op - not a bare {ok:false,reason:"internal"}.
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:846-865. Read-only .planning/ -> reason:partial-apply, completed:[{git_mv 3->4},{git_mv 2->3}], failed:{edit:ROADMAP.md}, hint warns against re-running. Read-only phases/ -> completed:[] with the 'nothing was written' hint.

### 5. self-verify reports an unreadable surface and still finishes the lint
expected: `self-verify.mjs --root <fixture>` on a tree with a dangling agents/dangling.md symlink runs the FULL lint and exits ok:false with an `unreadable-surface` problem naming that file - no top-level `reason` field, other problems still present. A symlink cycle (a.md -> b.md -> a.md) behaves identically.
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs:205-221. Fixture with dangling symlink + cycle -> ok:false, NO top-level reason, three unreadable-surface problems naming agents/dangling.md, agents/a.md, agents/b.md, and the unrelated unknown-config-key + inert-config-key problems all still present.

### 6. weight.mjs skips the same unreadable entry silently
expected: `weight.mjs` on that same fixture exits ok:true with the broken entry simply absent from `surfaces`, the real surfaces still measured, and the envelope's key set unchanged (ok, checked, surfaces). No unbudgeted-surface problem is raised for it.
status: pass
first_pass: pass
source: verifier
evidence: surface-weight.mjs:27-42,104-116. Same fixture -> {ok:true,checked:surface-weight,surfaces:[...]}, envelope keys exactly ok/checked/surfaces, dangling+cycle entries absent, and with a budgets manifest present no unbudgeted-surface raised for them.

### 7. A wrapped git push reaches the push rail
expected: git-guard fed `git \`+newline+`  push origin main` produces the same ask decision as the unwrapped `git push origin main`. Same with \r\n line endings. A wrapped `git \`+newline+`commit` on a protected branch also asks.
status: pass
first_pass: pass
source: verifier
evidence: git-guard.mjs:82-93. `git \`+LF+`push origin main` and the \r\n spelling both -> ask with the identical push reason as unwrapped; `git \`+LF+`commit -m "x"` on main -> ask / protected branch.

### 8. A push buried in a quoted multi-line string produces no prompt
expected: `echo "foo \`+newline+` git push bar"` produces NO decision at all (it prompted before this phase - the join-before-strip ordering closes that false positive). `git stash \`+newline+`push -m wip` also stays silent.
status: pass
first_pass: pass
source: verifier
evidence: echo "foo \`+LF+` git push bar" -> SILENT; git stash \`+LF+`push -m wip -> SILENT.

### 9. An even backslash run does not hide a real push
expected: `git add -A \\`+newline+`git push origin main` (two backslashes = a literal argument, so bash runs TWO commands) still asks, matching the unwrapped push. Likewise a real push beside a quoted `"` inside a single-quoted word: awk -F'"' ... \ +newline+ ; git push origin main ; echo "done" asks.
status: pass
first_pass: pass
source: verifier
evidence: `git add -A \\`+LF+`git push origin main` -> ask; `awk -F'"' '{print $2}' f.txt \`+LF+`; git push origin main ; echo "done"` -> ask. Mirror case echo "it's just git push text" stays SILENT.

### 10. A remove whose phase dir git rm cannot free is refused
expected: In a real git repo, `renumber remove --n 1` where phases/1 holds ANY uncommitted state exits ok:false with reason `uncommitted-work`, naming the file, with the tree completely untouched (no nesting, ROADMAP unchanged). Both arms: an untracked or gitignored file (which `git rm` leaves behind, so the dir survives and the next move nests into it), AND a modified tracked file (which `git rm` refuses and the rmSync fallback would otherwise destroy unrecoverably). With the tree clean the same call succeeds and does not nest.
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:638-657,729-740 (widened at 9326660). Real git init repo: untracked NOTES.md -> reason:uncommitted-work naming it, tree byte-identical, no phases/1/2; gitignored debug.log (!! arm) same; MODIFIED tracked PLAN.md -> refused and the edit survives (before 9326660 this returned ok:true and destroyed it). Clean tree -> ok:true, no nesting, phases/1/PLAN.md is Plan 2.

### 11. Each issue has a failing-capable test and all three CI gates pass
expected: #37, #49 and #50 each have at least one test that fails on the pre-fix code and passes after it, and all three gates pass: `node --test cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.
status: pass
first_pass: pass
source: verifier
evidence: Verifier materialized 033c174 into a tmpdir and swapped sources back to c4ab89f: planning.mjs reverted -> 7/7 new planning tests fail; self-verify.mjs+surface-weight.mjs reverted -> 7/7 fail; git-guard.mjs reverted to c4ab89f -> 4/8 fail, to fb37a18^ -> the 2 review-driven tests fail, and mutating [ \t]* to \s* -> the separator test fails. 7 of 8 failing-capable; the 8th (wrapped stash push) is a labelled regression guard and no other test shares that property. Gates on the real tree: 336/336 tests, self-verify problems:[] exit 0, tsc exit 0.

### 12. weight.mjs under-reports an entire subtree when one descendant is unreadable
expected: entries() wraps the whole recursive readdirSync, so an unreadable descendant returns [] for the subtree and readable siblings vanish with ok:true - the module header promises 'one unreadable file just means one fewer surface'
status: skipped
first_pass: fail
source: verifier
evidence: lib/surface-weight.mjs:36-42; fixture with skills/good/SKILL.md + chmod 000 skills/bad/ -> weight.mjs returns surfaces:[]. self-verify still goes red, so CI does not pass silently.
reported: entries() wraps the whole recursive readdirSync, so an unreadable descendant returns [] for the subtree and readable siblings vanish with ok:true - the module header promises 'one unreadable file just means one fewer surface'
severity: minor
reason: Confirmed real (weight.mjs returns surfaces:[] when a sibling subdir is chmod 000). Minor: self-verify still exits ok:false, so CI does not pass silently. Deferred by explicit capture-only decision; tracked in .planning/CAPTURE.md and SUMMARY open items. Needs per-entry recursion, not a wider catch.

### 13. unreadable-surface detail leaks an absolute path, contradicting its own comment
expected: the comment says the detail stays free of machine-specific absolute paths; the code emits readlinkSync's raw target
status: skipped
first_pass: fail
source: verifier
evidence: self-verify.mjs:207-219; observed detail 'unreadable symlink -> /tmp/cadv-sv-0lKESr/agents/b.md (ELOOP)' on stdout.
reported: the comment says the detail stays free of machine-specific absolute paths; the code emits readlinkSync's raw target
severity: cosmetic
reason: Confirmed real (detail emits readlinkSync's raw absolute target, contradicting the comment two lines above). Cosmetic. Deferred by explicit capture-only decision; tracked in .planning/CAPTURE.md and SUMMARY open items.

### 14. Confirm whether the harness can deliver a CRLF command in a PreToolUse payload
expected: Either a recorded case of a CRLF payload reaching git-guard.mjs, or a written note that the harness normalizes to LF and the \r? arm is defensive only. CONTEXT flags this as unanswerable from the codebase; the \r? arm is harmless either way, but the CRLF test's acceptance value depends on the answer.
status: pass
first_pass: pass
reported: Tested live at John's request. A backslash continuation followed by an intended CRLF collapsed into one command ('A echo B'), and a byte probe of an embedded CR returned 'A \n B' - the shell received LF only, no CR. Caveat recorded honestly: a CR could not be authored through the tool interface at all, so harness-normalization cannot be distinguished from serialization never emitting one. Either way CRLF is not reachable through this client path, so the \r? arm is defensive only and the CRLF unit test validates the parser (fed directly on stdin), not the transport.

### 15. Run the suite on the Node 22 and 24 CI matrix
expected: All 336 tests pass on Node 22 and 24, in particular the ELOOP/EACCES symlink fixtures. CONTEXT flags that these were confirmed on Node 26 only; this machine has no other Node installed. Local runtime is green.
status: pending

## Summary

total: 15
passed: 12
failed: 0
pending: 1
skipped: 2
blocked: 0
reworked: 2
