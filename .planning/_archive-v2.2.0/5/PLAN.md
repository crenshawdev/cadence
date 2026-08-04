---
phase: 5
plan: 1
requirements:
  - HST-02
files:
  - .planning/phases/5/install-walk.md
  - .planning/phases/5/UAT.md
  - README.md
---

# Phase 5: The install path is verified where it actually runs - Plan

## Goal

v2.0.0 moved the documented home to the self-hosted Forgejo remote and shipped
an install path nothing has exercised end to end. This phase proves that
published path live from a fully cold machine state - marketplace add, then
plugin install - and leaves the transcript in the phase record. No executor can
stand in for the interactive `/plugin` prompt, so the executable work is to make
that walk ask the right questions, record durably through the window where the
plugin is gone, and be honest about anything it needed that the docs do not say.

## Must be true when done

- On a machine with `cadence@cadence` uninstalled, the `cadence` marketplace
  removed and `~/.claude/plugins/cache/cadence/` deleted, running
  `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git`
  succeeds and `cadence` appears in `/plugin marketplace list`, with both
  commands and their verbatim output in the committed phase record.
- `/plugin install cadence@cadence` from that entry succeeds, and
  `~/.claude/plugins/installed_plugins.json`'s `cadence@cadence` entry carries a
  `version` equal to the walk-time `git show origin/main:.claude-plugin/plugin.json`
  version, a `gitCommitSha` equal to the walk-time `origin/main` tip, and an
  `installedAt` from this walk rather than the `2026-07-30T03:38:17.876Z` install
  already on disk.
- The phase-5 checklist asks for exactly that cold-state sequence, and each of
  its three items carries its `AC<N>` id, so
  `node cadence-core/bin/planning.mjs criteria-coverage` reports phase 5 with no
  uncovered criterion and no `untraced` item.
- Anything the walk needed beyond README's two documented commands is written
  into `README.md`'s install section with the doc commit in this phase's
  `git log`, or the record states in words that nothing extra was needed -
  silence is not the pass condition.
- The walk's evidence survives the purge window: transcripts are appended to a
  file under `.planning/phases/5/` and committed by the walk itself - not held in
  the conversation and not left to `/cad-verify`'s closed-list commit, which does
  not stage that file - so `git log --oneline -1 -- .planning/phases/5/install-walk.md`
  names a commit whose bytes hold the seven transcripts, and an uninstalled
  plugin or a Claude Code restart mid-walk loses nothing.

## Context

Locked by CONTEXT.md: D-03 (fully cold state, in order - uninstall, marketplace
remove, delete `~/.claude/plugins/cache/cadence/`), D-01 and D-08 (the version
proof is read at walk time from `origin/main` and matched against
`installed_plugins.json`'s `version` and `gitCommitSha`, never a hard-coded
number), D-06 (the walk runs through `.planning/phases/5/UAT.md` via
`/cad-verify 5`; no machine check stands in for it), D-07 (the only install
documentation is `README.md`'s install section, lines 51-60).

Out: everything under `cadence-core/`, `.claude-plugin/marketplace.json`, the
unmerged `52f995a` repository repoint, and the v2.2.0 manifest bump.

Patterns: UAT.md is written only through `planning.mjs uat` - `init` refuses an
existing file with `uat-exists` and names "remove the file deliberately" as the
sanctioned path. A phase-local record file beside SUMMARY.md follows phase 4's
`.planning/phases/4/ladder-claims.md`.

## Tasks

### Task 1: Build the walk record sheet and capture the pre-walk baseline

- **Files:** .planning/phases/5/install-walk.md
- **Action:** Create the sheet the walk writes into. It exists because D-03's
  purge deletes the plugin driving the session, so the evidence cannot live in
  the conversation, and because `parseUat` reads one-line `field: value` only, so
  a multi-line transcript can never be a `--reported` value. Write these `## `
  sections in order. `## Baseline (captured <today> before the walk)`: each
  command in a fenced block above its verbatim output, for
  `git -C /data/code/cadence remote -v` - followed by one line stating that
  `origin` is `ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git`, so
  every `origin/main` read below travels SSH and is NOT evidence about the
  anonymous HTTPS path the install uses, which only the `/plugin` walk tests -
  then `git -C /data/code/cadence fetch origin main` followed by
  `git -C /data/code/cadence rev-parse origin/main`,
  `git -C /data/code/cadence show origin/main:.claude-plugin/plugin.json` (the
  whole manifest verbatim, per D-01),
  `git -C /data/code/cadence log -1 --oneline origin/main`,
  `git -C /data/code/cadence merge-base --is-ancestor 52f995a origin/main; echo $?`
  (on `0`, add D-02's one-line note that the repository field points at the
  GitHub mirror because claudepluginhub.com indexes GitHub only while `homepage`
  stays Forgejo, so the manifest does not read as contradicting HST-01),
  `python3 -c "import json;print(json.dumps(json.load(open('/home/john/.claude/plugins/installed_plugins.json'))['plugins']['cadence@cadence'],indent=2))"`,
  `python3 -c "import json;print(json.dumps(json.load(open('/home/john/.claude/plugins/known_marketplaces.json'))['cadence'],indent=2))"`,
  `ls ~/.claude/plugins/cache/cadence/cadence/`,
  `git -C ~/.claude/plugins/marketplaces/cadence log -1 --oneline` with
  `git -C ~/.claude/plugins/marketplaces/cadence remote -v`, and
  `git config --list --show-origin | grep -c credential` (D-05 - print the COUNT
  only, never a config dump) plus `[ -n "$GIT_ASKPASS" ] && echo SET || echo unset`,
  and state that a `0`/`unset` pair is supporting evidence for an anonymous add,
  not proof - an OS credential manager or the plugin host's own HTTP client could
  still supply auth invisibly, so the `/plugin` transcript itself stays the
  primary evidence. Then `## Window rule`: between
  the uninstall and the reinstall the plugin is gone and `${CLAUDE_PLUGIN_ROOT}`
  resolves nowhere, so record results with
  `node /data/code/cadence/cadence-core/bin/planning.mjs uat record --phase 5 ...`
  run from `/data/code/cadence` - the two copies are interchangeable for this
  file (both define `UAT_FIELDS_VERSION = '1'` and the same `UAT_FIELDS` list);
  expect the `git-guard` PreToolUse hook to error on Bash calls while its script
  is missing (`hooks/hooks.json` invokes
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-guard.mjs`) and note whether it
  blocked or only warned; in-window, Write/Edit still work, so pastes always
  land - if a Bash call is blocked or the hook errors, run it in an external
  terminal and record that under Deviations; do NOT restart Claude Code before
  the install completes: `/cad-verify` is uninstalled and cannot be resumed,
  and if a restart is unavoidable, finish `/plugin marketplace add` and
  `/plugin install` (both quoted verbatim in this sheet's `## Documented path`)
  from the fresh session first, then resume with `/cad-verify 5`; any
  `${CLAUDE_PLUGIN_ROOT}` file a workflow re-reads in the window comes from
  `/data/code/cadence/cadence-core/` instead; if seam calls still fail after
  the install, restart Claude Code and resume with `/cad-verify 5`; and after
  each slot paste run
  `git add .planning/phases/5/install-walk.md` then
  `git commit -m "docs(5): install walk transcripts"` from `/data/code/cadence`,
  because `/cad-verify`'s own commit step stages a closed list - UAT.md,
  `phases/<N>/FINDINGS.json`, and whichever of STATE.md, ROADMAP.md and
  REQUIREMENTS.md changed (`cadence-core/workflows/verify.md:234-237`) - and
  never this sheet, so an uncommitted sheet leaves the committed record at seven
  empty placeholders while the walk reads as done; repeat commits across slots
  are fine, a `git-guard` block inside the window only defers the commit (the
  pasted bytes are already on disk and survive a restart), and item 3 makes that
  commit its pass condition, so run it before stopping if the walk ends early.
  Then seven empty slots, each a
  `## Slot <n> - <name>` heading over a fenced block holding exactly the line
  `(paste the exact command and its verbatim output here at walk time)`, named in
  this order: `1 - uninstall`, `2 - marketplace remove`, `3 - cache purge and
  absence checks`, `4 - marketplace add`, `5 - marketplace list`,
  `6 - plugin install`, `7 - version proof`. Then `## Deviations` holding exactly
  the line `(fill at walk time - write "none" only if a first-time user needs
  nothing beyond the two documented commands; a restart, a credential prompt, an
  extra command a user would need, a retry, or a manual clone delete each get
  their own line; the cold-state harness steps themselves - uninstall,
  marketplace remove, cache purge, window-rule commits, external-terminal
  reruns - are recorded here when they misbehave but marked "harness - not
  doc-owed": they reset the test bed, they are not part of installing)`. Do not
  pre-fill any slot and do not predict an outcome anywhere in the sheet: a slot
  carrying a guess is indistinguishable from a slot carrying evidence.
- **Verify:** `grep -c "^## Slot" .planning/phases/5/install-walk.md` prints 7
  and `grep -c "paste the exact command" .planning/phases/5/install-walk.md`
  prints 7; the sha recorded under `rev-parse origin/main` equals the output of
  re-running `git -C /data/code/cadence rev-parse origin/main`;
  `grep -c "ssh.jcrenshaw.dev" .planning/phases/5/install-walk.md` prints at
  least 1 (the SSH-vs-HTTPS caveat is present, not assumed);
  `grep -c "install walk transcripts" .planning/phases/5/install-walk.md` prints
  at least 1, so the commit command lives in the sheet a restart can re-read
  rather than only in a conversation the purge ends;
  `grep -c "^## Deviations" .planning/phases/5/install-walk.md` prints 1 and
  `grep -c "^## Window rule" .planning/phases/5/install-walk.md` prints 1 (item
  3 reads `## Deviations` as the sole input to the AC3 decision, so its absence
  must fail this task rather than silently read as "no deviations"); and
  `grep -c '"version"' .planning/phases/5/install-walk.md` prints at least 1,
  proving the baseline holds the manifest bytes per D-01, not just the sha line.

### Task 2: Pin the documented install path and the AC3 discharge rule

- **Files:** .planning/phases/5/install-walk.md, README.md
- **Action:** Append two sections to the sheet. `## Documented path (README.md
  lines 51-60 at <short HEAD sha>)` quotes those ten lines verbatim inside a
  fence of FOUR backticks so the section's own triple-backtick fence survives
  intact - the two `/plugin` commands, the update/uninstall line, and the three
  prerequisites README claims (Claude Code with plugin support, `node` and `git`
  on PATH, no npm install ever). This is what makes AC3 falsifiable: "did the
  walk deviate?" becomes a comparison against recorded bytes instead of memory.
  Then `## AC3 discharge`, stating the rule the walk applies: a doc-owed
  deviation - something a first-time user would need beyond the two documented
  commands, never the walk's own cold-state harness steps - is written into
  README's install section within this phase; any URL written there
  keeps the `https://` spelling, because self-verify masks `https?://` only
  (`cadence-core/bin/self-verify.mjs:339`) and an `ssh://` or `git@host:` spelling
  makes `git.jcrenshaw.dev` tokenize as a `git.*` config key and fails check 1 on
  a linted surface (recalled: `.planning/CAPTURE.md`, phase 6); the edit is
  committed as `docs(5): <what the install path actually needs>` staging only
  `README.md`, and only after `node cadence-core/bin/self-verify.mjs` prints
  `ok:true`. Do NOT edit `README.md` in this task - at execute time no deviation
  exists yet, and pre-writing a workaround into the install docs would fabricate
  the finding the walk exists to produce. `README.md` is declared in this plan's
  files because the walk may edit it under AC3, not because this task does.
- **Verify:** every line of `sed -n '51,60p' README.md` appears verbatim in the
  sheet - `while IFS= read -r l; do grep -qxF -- "$l" .planning/phases/5/install-walk.md || echo "MISSING: $l"; done < <(sed -n '51,60p' README.md)`
  prints no `MISSING:` line (a missing line prints itself, so this check can
  fail, unlike a bare `grep -q`), and
  `grep -c "^## Documented path" .planning/phases/5/install-walk.md` prints 1;
  `grep -c "^## AC3 discharge" .planning/phases/5/install-walk.md` prints 1; and
  `git status --porcelain README.md` prints nothing, proving README is untouched
  at execute time.

### Task 3: Re-key the phase-5 checklist to the locked cold-state criteria

- **Files:** .planning/phases/5/UAT.md
- **Action:** The pre-built checklist (2026-08-03) predates D-03: its items carry
  the narrower marketplace-only clean steps and no `criterion` id at all, so
  `node cadence-core/bin/planning.mjs criteria-coverage` counts phase 5 as 3
  criteria with 3 uncovered and 3 untraced items today, and those become three
  `uncovered` breaks against `/cad-audit` the moment `/cad-verify` checks the
  phase's ROADMAP box. The ids do double duty: they also stop `/cad-verify`'s
  refresh step from appending duplicate items, since it pipes only criteria not
  already covered. Precondition: run
  `node cadence-core/bin/planning.mjs uat status --phase 5` and confirm its
  `counts` object shows `pass`, `fail`, `skipped` and `blocked` all 0 - those
  are the seam's actual key names; it emits no `total`, `passed` or `failed`
  key, which exist only in UAT.md's own `## Summary` block - and confirm
  `grep -c "^first_pass" .planning/phases/5/UAT.md` prints 0, since `status`
  does not report `first_pass` at all (it is a per-item field);
  if any result is recorded, STOP and checkpoint rather than
  deleting a recorded walk (the in-place repair is
  `uat record --result pending --criterion AC<N>`, which cannot fix the stale
  `expected` text). Otherwise remove `.planning/phases/5/UAT.md` deliberately -
  the path `uat-exists` itself names - and re-create it in one call:
  `node cadence-core/bin/planning.mjs uat init --phase 5 --sources .planning/phases/5/CONTEXT.md`
  with a three-element JSON array on stdin, each element carrying the item's
  `name`, its full `expected` step line as written below, and its `criterion`
  (`AC1`, `AC2`, `AC3` in order) - the ids alone are not the items. The reset `started` date is expected and harmless.
  Items 1 and 2 open with the `human-verify` marker below because
  `/cad-verify 5` runs the deep cad-verifier pass BEFORE the walk here -
  `route.mjs resolve --role cad-verifier` returns `verify: on` at
  `stakes: critical` - and `uat merge` fills any `pending` item from a verifier
  `pass`, so a verifier reading the 2026-07-30 install state off disk could
  stamp both items passed before a single `/plugin` command runs, which is the
  prior state D-04 rules inadmissible. The marker is the prevention: `first_pass`
  is set once and can never be unset, so an auto-pass is only ever damage-
  controlled, by re-recording the item `--result pending` and writing the
  auto-pass under the sheet's `## Deviations`. Verifier-appended human checks
  need no such handling: `uat merge` writes them with `origin: verifier`, which
  `criteria-coverage`'s exempt-origin set excludes from `untraced`.
  Item 1, name "Cold-state marketplace add against git.jcrenshaw.dev succeeds",
  `expected` a single line of numbered steps: (0) human-verify: only this walk's
  fresh transcripts count - the install state already on disk
  (`installed_plugins.json` at `0bba96f`, `installedAt`
  `2026-07-30T03:38:17.876Z`) is inadmissible evidence under D-04, so a machine
  or cad-verifier pass on this item is rejected: re-record it
  `uat record --phase 5 --item 1 --result pending`, note it under Deviations,
  and walk the steps below for real; (1) read
  `.planning/phases/5/install-walk.md` end to end first - it carries the window
  rule, the fallback record command and the slots you paste into; (2) refresh the
  baseline with `git -C /data/code/cadence fetch origin main` then
  `git -C /data/code/cadence rev-parse origin/main`, and if the sha differs from
  the sheet's, update the sheet's baseline block before going on; (2.5) the next
  step opens the window: Bash calls may be blocked by the stale `git-guard` hook
  while the plugin is gone, but Write/Edit still work so pastes always land -
  run any blocked command in an external terminal and record it under
  Deviations, and do NOT restart Claude Code before the install completes
  (`/cad-verify` is uninstalled and cannot resume); if a restart is unavoidable,
  run `/plugin marketplace add` and `/plugin install` from the sheet's
  `## Documented path` in the fresh session first, then resume with
  `/cad-verify 5`; (3) run
  `/plugin uninstall cadence@cadence` and paste command plus output into slot 1;
  (4) run `/plugin marketplace remove cadence` and paste into slot 2; (5) run
  `rm -rf ~/.claude/plugins/cache/cadence`, then `ls ~/.claude/plugins/cache/cadence`
  and `ls ~/.claude/plugins/marketplaces/cadence` - if `marketplaces/cadence`
  survived the remove, delete it (`rm -rf ~/.claude/plugins/marketplaces/cadence`),
  write that under Deviations as harness cleanup, and re-run both `ls`; proceed
  only when both print `No such file or directory`, because a surviving clone
  lets the add serve stale local bytes rather than fetching Forgejo; (6) confirm
  both registries are clean -
  `python3 -c "import json;print('cadence@cadence' in json.load(open('/home/john/.claude/plugins/installed_plugins.json'))['plugins'])"`
  prints `False` and
  `python3 -c "import json;print('cadence' in json.load(open('/home/john/.claude/plugins/known_marketplaces.json')))"`
  prints `False` - paste both into slot 3; (7) run
  `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git` and
  paste into slot 4; (8) run `/plugin marketplace list`, expect a `cadence` entry,
  paste into slot 5; (9) pass only if steps 5-6 ended with both absences and
  both `False` (the cold state held before the add), step 7 completed with no
  error, step 8 lists `cadence`, and slots 1-5 hold real transcripts with no
  placeholder line left.
  Item 2, name "Fresh install matches the published manifest", `expected` a single
  line of numbered steps: (0) human-verify: the version/sha match only counts
  against an `installedAt` produced by THIS walk - the `cadence@cadence` entry
  sitting at `version 2.0.0` / `gitCommitSha 0bba96f` from 2026-07-30 already
  satisfies this item's shape and is inadmissible under D-04, so a machine or
  cad-verifier pass here is rejected: re-record it
  `uat record --phase 5 --item 2 --result pending`, note it under Deviations, and
  walk the steps below for real; (1) run `/plugin install cadence@cadence` and
  paste into slot 6; (2) if Claude Code asks for a restart or `/cad-*` stops resolving,
  restart, resume with `/cad-verify 5` (UAT.md holds the results so far), continue
  here, and record the restart under Deviations; (3) run
  `git -C /data/code/cadence fetch origin main`, then
  `git -C /data/code/cadence rev-parse origin/main` and
  `git -C /data/code/cadence show origin/main:.claude-plugin/plugin.json` - read
  the tip and the version at WALK time, never against a number written earlier;
  (4) run
  `python3 -c "import json;print(json.dumps(json.load(open('/home/john/.claude/plugins/installed_plugins.json'))['plugins']['cadence@cadence'],indent=2))"`;
  (5) expect `version` to equal the manifest version from step 3, `gitCommitSha`
  to equal the sha from step 3, and `installedAt` to be a timestamp from this walk
  rather than `2026-07-30T03:38:17.876Z` - if the values differ only because
  `origin/main` advanced after the install, write that under Deviations and
  re-run `/plugin uninstall cadence@cadence` then `/plugin install cadence@cadence`
  rather than failing the item on the race; (6) run
  `ls ~/.claude/plugins/cache/cadence/cadence/` and expect exactly one directory,
  named that same version - proof the purge held and only this install
  repopulated the cache; (7) paste steps 3-6 verbatim into slot 7 and pass only
  if 5 and 6 both hold and slots 6-7 hold real transcripts with no placeholder
  line left - a pass reported off machine state alone, with the slots still
  holding placeholders, is the auto-pass step 0 rejects.
  Item 3, name "Nothing the walk needed is left unwritten", `expected` a single
  line of numbered steps: (1) read the sheet's `## Deviations` section, filled
  during items 1-2; (2) if it reads `none`, that written statement is this item's
  evidence and no README edit is owed - silence is not the pass condition, and
  the pass condition is step 8, not this step; (3) if it names anything,
  write it into `README.md`'s install section now, as instructions to a
  first-time user, keeping any URL in the `https://` spelling per the sheet's
  `## AC3 discharge` section; (4) run `node cadence-core/bin/self-verify.mjs` and
  require `ok:true`, then commit as `docs(5): <what the install path actually
  needs>` staging only `README.md`; (5) run
  `git log --oneline -- README.md | head -1` and expect that commit; (6) commit
  the transcripts themselves, in their own commit, separate from any README one:
  `git add .planning/phases/5/install-walk.md` then
  `git commit -m "docs(5): install walk transcripts"` - `/cad-verify`'s commit
  step stages a closed list that does not include this sheet
  (`cadence-core/workflows/verify.md:234-237`), so without this step the only
  evidence artifact for AC1/AC2 stays an uncommitted working-tree diff over
  committed bytes that assert nothing was walked, and D-06's "committed per
  `planning.commit_docs`" goes unmet - if the window-rule commits already
  captured every paste, `git status --porcelain .planning/phases/5/install-walk.md`
  prints nothing and no new commit is needed; (7) run
  `git log --oneline -1 -- .planning/phases/5/install-walk.md` and expect a
  transcripts commit, then take that commit's hash
  (`C=$(git log -1 --format=%H -- .planning/phases/5/install-walk.md)`) and
  require `git show "$C":.planning/phases/5/install-walk.md | grep -c "paste the exact command"`
  to print 0 - the COMMITTED bytes hold no placeholder slot; a `--stat` or a
  HEAD-anchored `git show` cannot check this, since HEAD may be the README
  commit and a diffstat never shows bytes; (8) pass only when the sheet reads `none` or the README commit from
  step 5 exists, AND step 7 shows the transcripts commit with the sheet clean in
  `git status`.
- **Verify:** `node cadence-core/bin/planning.mjs uat status --phase 5` prints
  `counts` with `pending: 3`, `pass: 0`, `fail: 0`, `skipped: 0`, `blocked: 0`
  and `result: partial`;
  `grep -c "^criterion: AC" .planning/phases/5/UAT.md` prints 3; and
  `node cadence-core/bin/planning.mjs criteria-coverage` prints
  `counts.uncovered: 0` (it prints 3 before this task) with no phase-5 entry left
  in `untraced`.

## Notes

- **The walk itself is human-only and runs at `/cad-verify 5`.** No task here
  attempts a `/plugin` command; per D-06 the plan adds no machine check that
  stands in for the interactive prompt. AC1 and AC2 are tagged `human-verify` in
  CONTEXT and reach the user through the checklist task 3 writes. The `git`
  commands in the baseline are recorded evidence about the artifact under test,
  explicitly labelled in the sheet as not evidence about the HTTPS install path.
- **Reading of D-06 on where transcripts land.** D-06 names the phase-5 record
  (SUMMARY.md). The transcripts land in `.planning/phases/5/install-walk.md`,
  which sits in that record beside SUMMARY.md, for three mechanical reasons:
  SUMMARY.md is written by `/cad-execute` before the walk exists, `execute.md`
  forbids an executor from writing it at all, and UAT item fields are single-line
  so a multi-line transcript cannot be a `--reported` value. Per-item pass/fail
  still lands in UAT.md through the seam, and UAT.md rides `/cad-verify`'s own
  commit under `planning.commit_docs: true`. The sheet does NOT: that commit
  stages a closed list - UAT.md, `phases/<N>/FINDINGS.json`, and whichever of
  STATE.md, ROADMAP.md and REQUIREMENTS.md changed
  (`cadence-core/workflows/verify.md:234-237`) - so the walk commits the sheet
  itself, per task 1's window rule and item 3's step 6.
- **Addition to D-01's read.** The walk-time read is preceded by
  `git fetch origin main`, because `origin/main` is a local ref that moves only on
  fetch and this repo's `main` is currently 5 commits ahead of it; comparing the
  install against a stale ref would prove nothing about what the remote publishes.
- **D-03 extended by one observation, not a new decision.**
  `~/.claude/plugins/marketplaces/cadence` is a full clone of the marketplace repo
  at `0bba96f`; D-03's purge list does not name it. The walk checks it is gone
  after `/plugin marketplace remove`, because a surviving clone lets the add
  succeed from local bytes and makes AC1 unfalsifiable.
- **Prior art cited.** The recalled phase-6 CAPTURE item ("AC7, human-verify" -
  `/plugin marketplace add` then `/plugin install` must both succeed, unverified
  when task 8 shipped the hosting move) is the gap this phase closes. The recalled
  self-verify finding (the URL mask covers `https?://` only,
  `cadence-core/bin/self-verify.mjs:339`) is why task 2 constrains the conditional
  README edit to the `https://` spelling. The recalled UAT-step feedback (every
  walk item ends in numbered steps with exact commands and exact expected output)
  is why task 3's `expected` values are step lists rather than prose.
- **Observed, deliberately out of scope.** `DESIGN.md:174` still spells the user
  install with the retired `https://github.com/crenshawdev/cadence.git` URL inside
  its dated "Locked decisions (2026-07-10)" record. D-07 fixes SC3's doc target as
  README's install section and nothing else, so this plan does not touch it -
  worth a `/cad-capture` note instead.
- **Human-required setup:** none beyond the walk. The purge removes the plugin
  mid-session by design (D-03), which is why the sheet's window rule and the
  repo-checkout fallback are written down before the first item is presented.
