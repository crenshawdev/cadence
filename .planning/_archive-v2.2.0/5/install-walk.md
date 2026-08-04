# Phase 5 install walk - record sheet

The live cold-state walk of the published install path (HST-02) writes into
this file. The baseline below is recorded evidence about the artifact under
test; the seven slots are filled only at walk time, during `/cad-verify 5`.

## Baseline (captured 2026-08-04 before the walk)

```
git -C /data/code/cadence remote -v
```
```
github	git@github.com:crenshawdev/cadence.git (fetch)
github	git@github.com:crenshawdev/cadence.git (push)
origin	ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git (fetch)
origin	ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git (push)
```

`origin` is `ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git`, so
every `origin/main` read below travels SSH and is NOT evidence about the
anonymous HTTPS path the install uses - only the `/plugin` walk tests that.

```
git -C /data/code/cadence fetch origin main
```
```
From ssh://ssh.jcrenshaw.dev:2222/crenshawdev/cadence
 * branch            main       -> FETCH_HEAD
```

```
git -C /data/code/cadence rev-parse origin/main
```
```
0bba96f4159f5570dee727e2fe416e51e3a3281a
```

```
git -C /data/code/cadence show origin/main:.claude-plugin/plugin.json
```
```
{
  "name": "cadence",
  "displayName": "Cadence",
  "description": "A plan/execute/verify loop for a single developer in Claude Code, with adversarial review at every gate: plans and diffs get refuted by a fresh Claude subagent or a panel of outside models (OpenAI, Gemini, DeepSeek), not just approved. State lives in files, not the conversation, so you clear aggressively and keep both your context and your token bill lean.",
  "version": "2.0.0",
  "author": {
    "name": "John Crenshaw"
  },
  "homepage": "https://git.jcrenshaw.dev/crenshawdev/cadence",
  "repository": "https://git.jcrenshaw.dev/crenshawdev/cadence.git",
  "license": "MIT",
  "keywords": [
    "planning",
    "workflow",
    "claude-code",
    "software-development",
    "git"
  ]
}
```

```
git -C /data/code/cadence log -1 --oneline origin/main
```
```
0bba96f Merge pull request 'v2.0.0 — Stakes, not spend' (#89) from cadence/v2.0.0 into main
```

```
git -C /data/code/cadence merge-base --is-ancestor 52f995a origin/main; echo $?
```
```
1
```

`1`: the unmerged `52f995a` repository-field repoint is not on `origin/main`;
the manifest above still points `repository` at Forgejo, so no D-02 mirror
note is owed.

If the walk refreshes the baseline sha (item 1 step 2), re-run
`git -C /data/code/cadence merge-base --is-ancestor 52f995a origin/main; echo $?`
and update this note if the result changed - a refreshed `origin/main` that
now contains `52f995a` owes D-02's mirror note (the repository field points at
the GitHub mirror because claudepluginhub.com indexes GitHub only, while
`homepage` stays Forgejo).

```
python3 -c "import json;print(json.dumps(json.load(open('/home/john/.claude/plugins/installed_plugins.json'))['plugins']['cadence@cadence'],indent=2))"
```
```
[
  {
    "scope": "user",
    "installPath": "/home/john/.claude/plugins/cache/cadence/cadence/2.0.0",
    "version": "2.0.0",
    "installedAt": "2026-07-30T03:38:17.876Z",
    "lastUpdated": "2026-07-30T04:13:00.560Z",
    "gitCommitSha": "0bba96f4159f5570dee727e2fe416e51e3a3281a"
  }
]
```

```
python3 -c "import json;print(json.dumps(json.load(open('/home/john/.claude/plugins/known_marketplaces.json'))['cadence'],indent=2))"
```
```
{
  "source": {
    "source": "git",
    "url": "https://git.jcrenshaw.dev/crenshawdev/cadence.git"
  },
  "installLocation": "/home/john/.claude/plugins/marketplaces/cadence",
  "lastUpdated": "2026-07-30T04:13:00.519Z"
}
```

```
ls ~/.claude/plugins/cache/cadence/cadence/
```
```
1.1.0
1.2.0
1.2.1
1.3.0
1.3.1
1.4.0
1.4.1
1.5.0
2.0.0
```

```
git -C ~/.claude/plugins/marketplaces/cadence log -1 --oneline
git -C ~/.claude/plugins/marketplaces/cadence remote -v
```
```
0bba96f Merge pull request 'v2.0.0 — Stakes, not spend' (#89) from cadence/v2.0.0 into main
origin	https://git.jcrenshaw.dev/crenshawdev/cadence.git (fetch)
origin	https://git.jcrenshaw.dev/crenshawdev/cadence.git (push)
```

```
git config --list --show-origin | grep -c credential
```
```
0
```

```
[ -n "$GIT_ASKPASS" ] && echo SET || echo unset
```
```
unset
```

A `0`/`unset` pair is supporting evidence for an anonymous add, not proof -
an OS credential manager or the plugin host's own HTTP client could still
supply auth invisibly, so the `/plugin` transcript itself stays the primary
evidence (D-05).

## Window rule

Between the uninstall (slot 1) and the reinstall (slot 6) the plugin is gone
and `${CLAUDE_PLUGIN_ROOT}` resolves nowhere. In that window:

- Record UAT results with
  `node /data/code/cadence/cadence-core/bin/planning.mjs uat record --phase 5 ...`
  run from `/data/code/cadence`. The repo copy and the cache copy are
  interchangeable for this file: both define `UAT_FIELDS_VERSION = '1'` and
  the same `UAT_FIELDS` list.
- Expect the `git-guard` PreToolUse hook to error on Bash calls while its
  script is missing (`hooks/hooks.json` invokes
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-guard.mjs`). Note whether it
  blocked or only warned.
- In-window, Write/Edit still work, so pastes always land. If a Bash call is
  blocked or the hook errors, run it in an external terminal and record that
  under Deviations.
- Do NOT restart Claude Code before the install completes: `/cad-verify` is
  uninstalled and cannot be resumed. If a restart is unavoidable, finish
  `/plugin marketplace add` and `/plugin install` (both quoted verbatim in
  `## Documented path` below) from the fresh session first, then resume with
  `/cad-verify 5`.
- Any `${CLAUDE_PLUGIN_ROOT}` file a workflow re-reads in the window comes
  from `/data/code/cadence/cadence-core/` instead.
- If seam calls still fail after the install, restart Claude Code and resume
  with `/cad-verify 5`.
- After each slot paste, run `git add .planning/phases/5/install-walk.md`
  then `git commit -m "docs(5): install walk transcripts"` from
  `/data/code/cadence`. `/cad-verify`'s own commit step stages a closed list -
  UAT.md, `phases/<N>/FINDINGS.json`, and whichever of STATE.md, ROADMAP.md
  and REQUIREMENTS.md changed (`cadence-core/workflows/verify.md:234-237`) -
  and never this sheet, so an uncommitted sheet leaves the committed record at
  seven empty placeholders while the walk reads as done. Repeat commits across
  slots are fine; a `git-guard` block inside the window only defers the commit
  (the pasted bytes are already on disk and survive a restart). Item 3 makes
  that commit its pass condition, so run it before stopping if the walk ends
  early.
- If the walk ends early with slots legitimately unreached (e.g. the install
  itself failed), overwrite each unreached slot's placeholder line with
  `not reached: <reason>` before the final transcripts commit, so item 3 step
  7's zero-placeholder check on the committed bytes stays honest without
  fabricating content.

## Slot 1 - uninstall

```
/plugin uninstall cadence@cadence
(no content)

/plugin uninstall cadence@cadence
Plugin "cadence@cadence" is not installed in this project
```

Walker note (2026-08-04): the first run printed nothing and uninstalled the
plugin (the session's `cadence:*` skills disappeared); the run was repeated to
confirm, and the second run's "not installed" message is the confirmation. The
walker reported verbatim: "it uninstalled but then gave me the plugin mirror".

## Slot 2 - marketplace remove

```
/plugin marketplace remove cadence
✔ Removed 1 marketplace
```

## Slot 3 - cache purge and absence checks

```
rm -rf ~/.claude/plugins/cache/cadence
(no output)

ls ~/.claude/plugins/cache/cadence
ls: cannot access '/home/john/.claude/plugins/cache/cadence': No such file or directory

ls ~/.claude/plugins/marketplaces/cadence
ls: cannot access '/home/john/.claude/plugins/marketplaces/cadence': No such file or directory

python3 -c "import json;print('cadence@cadence' in json.load(open('/home/john/.claude/plugins/installed_plugins.json'))['plugins'])"
False

python3 -c "import json;print('cadence' in json.load(open('/home/john/.claude/plugins/known_marketplaces.json')))"
False
```

Walker note (2026-08-04): `~/.claude/plugins/marketplaces/cadence` was already
gone after `/plugin marketplace remove` - the remove deleted its own clone, so
the sheet's surviving-clone contingency was not needed.

## Slot 4 - marketplace add

```
/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git
Successfully added marketplace: cadence
```

Walker note (2026-08-04): first attempt, no credential prompt, no retry - the
anonymous HTTPS path fetched Forgejo from the proven-cold state in slot 3.

## Slot 5 - marketplace list

```
/plugin marketplace list
Configured marketplaces:
  • claude-plugins-official
  • claude-hud
  • openai-codex
  • brand-toolkit
  • obsidian-skills
  • lodev09
  • claude-community
  • burnrate
  • cadence
```

## Slot 6 - plugin install

```
/plugin install cadence@cadence
(no content)

/plugin install cadence@cadence
✓ Installed Cadence. Plugin is now active.
```

Walker note (2026-08-04): the walker reported "installed usual path asked
scope" - the install ran the standard interactive flow, which asked the
install scope before completing; no restart was required and `/cad-*`
resolved again immediately.

## Slot 7 - version proof

```
git -C /data/code/cadence fetch origin main
From ssh://ssh.jcrenshaw.dev:2222/crenshawdev/cadence
 * branch            main       -> FETCH_HEAD

git -C /data/code/cadence rev-parse origin/main
0bba96f4159f5570dee727e2fe416e51e3a3281a

git -C /data/code/cadence show origin/main:.claude-plugin/plugin.json
{
  "name": "cadence",
  "displayName": "Cadence",
  "description": "A plan/execute/verify loop for a single developer in Claude Code, with adversarial review at every gate: plans and diffs get refuted by a fresh Claude subagent or a panel of outside models (OpenAI, Gemini, DeepSeek), not just approved. State lives in files, not the conversation, so you clear aggressively and keep both your context and your token bill lean.",
  "version": "2.0.0",
  "author": {
    "name": "John Crenshaw"
  },
  "homepage": "https://git.jcrenshaw.dev/crenshawdev/cadence",
  "repository": "https://git.jcrenshaw.dev/crenshawdev/cadence.git",
  "license": "MIT",
  "keywords": [
    "planning",
    "workflow",
    "claude-code",
    "software-development",
    "git"
  ]
}

python3 -c "import json;print(json.dumps(json.load(open('/home/john/.claude/plugins/installed_plugins.json'))['plugins']['cadence@cadence'],indent=2))"
[
  {
    "scope": "user",
    "installPath": "/home/john/.claude/plugins/cache/cadence/cadence/2.0.0",
    "version": "2.0.0",
    "installedAt": "2026-08-04T17:18:57.044Z",
    "lastUpdated": "2026-08-04T17:18:57.044Z",
    "gitCommitSha": "0bba96f4159f5570dee727e2fe416e51e3a3281a"
  }
]

ls ~/.claude/plugins/cache/cadence/cadence/
2.0.0
```

Walker note (2026-08-04): `version` 2.0.0 = walk-time manifest version;
`gitCommitSha` = walk-time `origin/main` tip; `installedAt` is from this walk
(not `2026-07-30T03:38:17.876Z`); the cache holds exactly one directory named
`2.0.0` - the purge held and only this install repopulated it. No race arm
needed: `origin/main` did not move during the walk.

## Deviations

Filled 2026-08-04, end of walk. No line below is doc-owed: a first-time user
needs exactly the two documented commands, and no README edit is owed.

- Uninstall was invoked twice: the first run printed nothing (it performed the
  uninstall - the session's plugin skills disappeared), the second confirmed
  with "not installed". After the uninstall the standard `/plugin` UI panel
  was shown (the walker's "gave me the plugin mirror" remark in slot 1, later
  clarified as just the plugin UI). Harness - not doc-owed.
- `/plugin marketplace remove cadence` deleted its own clone under
  `~/.claude/plugins/marketplaces/`; the sheet's surviving-clone contingency
  and manual delete were not needed. Harness - not doc-owed.
- The window rule anticipated `git-guard` PreToolUse errors on Bash while the
  plugin was gone; in practice no Bash call was blocked and every in-window
  transcript commit landed directly. Harness - not doc-owed.
- Install was invoked twice: the first run opened the standard interactive
  flow (scope prompt; user scope chosen), the second run reported
  "✓ Installed Cadence. Plugin is now active." Standard `/plugin` UX, no
  extra command, no credential prompt, no restart needed - not doc-owed.

## Documented path (README.md lines 51-60 at 2884e9e)

````
## Install

Cadence is a Claude Code plugin. Add the marketplace, then install:

```
/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git
/plugin install cadence@cadence
```

Update with `/plugin update cadence@cadence`, remove with `/plugin uninstall cadence@cadence`. Requires Claude Code with plugin support, plus `node` and `git` on your PATH. The scripts inside are zero-dependency: there is no npm install, ever.
````

That is the whole documented surface: the two `/plugin` commands, the
update/uninstall line, and the three prerequisites README claims (Claude Code
with plugin support, `node` and `git` on PATH, no npm install ever). AC3 is
judged against these recorded bytes, not memory - "did the walk deviate?" is
a comparison with this section.

## AC3 discharge

The rule the walk applies at item 3: a doc-owed deviation - something a
first-time user would need beyond the two documented commands, never the
walk's own cold-state harness steps - is written into `README.md`'s install
section within this phase. Any URL written there keeps the `https://`
spelling: self-verify masks `https?://` only
(`cadence-core/bin/self-verify.mjs:339`), and an `ssh://` or `git@host:`
spelling makes `git.jcrenshaw.dev` tokenize as a `git.*` config key and fail
check 1 on a linted surface (recalled: `.planning/CAPTURE.md`, phase 6). The
edit is committed as `docs(5): <what the install path actually needs>`
staging only `README.md`, and only after
`node cadence-core/bin/self-verify.mjs` prints `ok:true`.
