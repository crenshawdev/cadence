---
status: testing
phase: 3
started: 2026-07-28
updated: 2026-07-28
---

## Items

### 1. Seven silent push shapes now ask
expected: Fed to git-guard.mjs on a protected branch, each of `git -C "my repo" push origin main`, `git add -A & git push origin main`, `$(git push origin main)`, backtick-wrapped `git push origin main`, `(git push origin main)`, `echo \" ; git push origin main; echo "done"`, and `bash -c "git push origin main"` (plus sh -c / zsh -c / eval) returns permissionDecision: ask. At c2265ca all seven returned empty stdout.
status: pass
first_pass: pass
source: verifier
evidence: Real hook over stdin vs throwaway fixture repo on main: ask for all 11 rows (seven shapes + sh -c/zsh -c/eval + bare control). Same list against the c2265ca guard: silent for all ten, ask only for the bare control. Parser rows shell-tokens.test.mjs:20-33; seam rows git-guard.test.mjs:243,284

### 2. Shipped silence and false-positive cases stay silent
expected: No decision (empty stdout) for `echo "git push"`, `git log --grep "push"`, `echo "foo \` + newline + ` git push bar"`, the `awk -F'"'` alternation, and both odd- and even-backslash continuation parity cases.
status: pass
first_pass: pass
source: verifier
evidence: Hook run: silent for `echo "git push"`, `git log --grep "push"`, `echo "foo \`+nl+` git push bar"`, `awk -F'"'` alternation, odd- and even-backslash parity, `git add . # git push`, `echo "it's just git push text"`, `git stash push -m wip`. Live direction still fires: `echo hi \\`+nl+`git push origin main` -> ask. 17 ordinary commands all silent

### 3. Unplaced git word asks; unresolvable without a git word stays silent
expected: An unterminated quote around `git push origin main` returns ask. `echo "unterminated` and `eval $CMD` return no decision.
status: pass
first_pass: pass
source: verifier
evidence: Hook run: `echo "git push origin main` -> ask; `echo $(git push origin main` -> ask; `echo "unterminated` -> silent; `eval $CMD` -> silent. git-guard.mjs:182-187 (ordered after the commit rail so it cannot mask a deny); signal shell-tokens.mjs:275-280,543

### 4. Wrapped commit matches the bare commit rail
expected: `bash -c "git commit -m x"` on a protected branch returns deny under git.on_protected: refuse and ask under ask - the same answers the bare `git commit -m x` gives for the same config.
status: pass
first_pass: pass
source: verifier
evidence: Hook run, default ask: bare `git commit -m x`, bash -c, sh -c, eval, `git -C "my repo" commit`, `(git commit -m x)`, `$(echo) git commit -m x` all ask. Under refuse: all seven deny. Under allow: all silent. Shared reader git-guard.mjs:156,171; canDeny gate :105-142

### 5. Grammar and out-of-grammar list written down and pinned by tests
expected: cadence-core/references/git.md states the tokenizer grammar and names heredocs, `<<<`, `$'...'` and `${var:-...}` nesting as out-of-grammar; every named out-of-grammar shape has a row in the parser-level test asserting its stated behavior.
status: pass
first_pass: pass
source: verifier
evidence: Grammar subsection references/git.md:120-238; 9-row out-of-grammar table :240-256 (heredoc, <<<, ${var:-...} in $(), $'...'). Matching test rows shell-tokens.test.mjs:359-397, each quoting the doc wording; wrapper set pinned against the prose at :507

### 6. Docs no longer claim the push guard parses nothing
expected: /cad-docs-verify reports no stale claim in README.md, INTERNALS.md or DESIGN.md that Cadence's push guard parses nothing; self-verify.mjs's "one idiom, shared with git-guard" comment and its test name reference a regex both files still carry.
status: pass
first_pass: pass

### 7. Full test, typecheck and self-verify gates pass
expected: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json` both pass, self-verify reports no budget-overrun, and the new grammar rows for criteria 1-4 are among the passing set.
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/*.test.mjs` -> tests 625 / pass 625 / fail 0; `npx tsc -p tsconfig.ci.json` exit 0; `self-verify.mjs` -> {"ok":true,...,"problems":[]} (no budget-overrun). Grammar table alone: shell-tokens.test.mjs 162/162

### 8. Review-found shapes beyond the seven also ask
expected: `cat <(git push ...)`, `git push>/tmp/out`, `echo $(echo ${x:-)}; git push)`, `git -C $(pwd) push ...`, `env -u HOME -S "git push ..."` and `env -iS "git push ..."` all return ask; a ~20KB wrapper-word input completes fast (no V8 OOM abort) and falls toward unplaced.
status: pass
first_pass: pass
source: verifier
evidence: Hook run, all ask: `cat <(git push ...)`, `git push>/tmp/out`, `git 2>out push origin main`, `echo $(echo ${x:-)}; git push)`, `git -C $(pwd) push ...`, ``git -C `pwd` push``, `env -u HOME -S`, `env -iS`, `env --split-string=`, `$"git" push`, `echo "git push ..." | bash`, `bash -c"git push ..."`. 'bash '.repeat(4000)+'git push origin main' (~20KB) -> ask in 20ms, no abort. Budgets shell-tokens.mjs:35,39,51; tests :551,568,590

### 9. Accepted narrowing of the deny rail is what you want
expected: Under git.on_protected: refuse, `sudo git commit -m x` and `sudo bash -c "git commit -m x"` ask rather than deny (refusal requires the git word at index 0 of its own simple command). Read-only `rg -t sh "git commit"` is not blocked. Confirm this fail-safe narrowing is acceptable.
status: pass
first_pass: pass

### 10. `git status; bash` prompt frequency is acceptable
expected: A bare wrapper word with no operand, in a source that mentions git elsewhere, asks - `git status; bash` returns ask. Stated at references/git.md:189-195 and in SUMMARY Open items; fail-toward-asking by design, frequency reasoned rather than measured. Confirm this does not feel like noise in real sessions.
status: pass
first_pass: pass

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
