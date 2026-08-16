# Spike: does the GitLab arm authorize an unattended merge the repository never granted?

**Status:** closed 2026-08-15. Run made against `24411e5` (`cadence/v3.5.1`),
BEFORE any phase-1 fix landed. Verdict below.

## Question

With a user-global `git.auto_close: true` and a repository whose
`.planning/config.json` never sets the key, does `/cad-land` step 3(b)'s GitLab
arm reach `glab mr merge` with nothing refusing on the way - no seam call, no
halt - so that a value the repository never set authorizes an unattended
external mutation?

## Decision that hinges on it

Phase 1's AC6: the gap has to be watched FAILING against the unfixed tree before
the fix lands, or "the GitLab arm was ungated" is an assertion about prose
rather than a run. If the walk stops somewhere - a seam refusal, a halt, an
absent CLI - then the fix shape in AUT-02 is aimed at a gap that does not exist
and the phase would be closing a hole it never saw open.

## Why the question exists

The three hosts do not share an enforcement point.
`cadence-core/bin/git-publish.mjs` reads `git.auto_close` from the REPO layer
only (`repoAutoClose`, a raw `JSON.parse` of `<dir>/.planning/config.json`), so
the GitHub and Forgejo arms - which must publish the local-only integration
branch through that seam before `gh pr create` / `tea pr create` - die there
under a global-only value.

`skills/cad-land/SKILL.md` step 3(b) scopes the seam call to those two hosts by
name ("**Publish the branch (GitHub and Forgejo arms).**") and then states the
GitLab exemption as correct:

> On GitLab `glab mr create` publishes the source branch itself, so no seam
> call is needed there.

`cadence-core/references/git-publish.md:24` carries the same claim in rail 3
("On GitLab `glab mr create` publishes the source branch itself."). Meanwhile
`cadence-core/bin/land-cleanup.mjs:145-147` already records the discrepancy in
its own source - "on GitLab nothing gates it at all" - which makes this a known
gap rather than a discovered one, and exactly the kind of known gap that is
worth watching run.

## The rig

A throwaway fixture outside the repository, under the session scratchpad, with
the two layers DIFFERING - the pair the phase exists for:

| Layer | File | Content |
|---|---|---|
| repository | `<fx>/repo/.planning/config.json` | `{"git":{"base_branch":"main"}}` - `auto_close` never set |
| user-global | `<fx>/global/global.json` | `{"git":{"auto_close":true}}` |

The global layer is supplied through `CADENCE_GLOBAL_CONFIG`, the way
`cadence-core/bin/config-seams.test.mjs`'s `seam` helper does, so no run below
can read the developer's real `~/.claude/cadence/config.json`.
`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` are `/dev/null` for the same reason.
The repo is a real `git init` on branch `cadence/v3.5.1` (non-protected) with a
configured bare `origin`, so no refusal below can be about a missing remote.

`gh`, `glab` and `tea` stubs are written into a directory prepended to the
walk's `PATH` (the `cadence-core/bin/issue-check.test.mjs` convention). Every
stub appends its own name AND argv to `$CAD_SPAWN_MARKER`, so what ran is a
fact about the filesystem rather than a claim. `glab` is absent on this machine,
so the stub is also the only way this arm is walkable at all.

## What was run, verbatim

### 1. The value `/cad-land` step 3 branches on

```
$ node cadence-core/bin/config.mjs get --file <fx>/repo/.planning/config.json git.auto_close
{"ok":true,"values":{"git.auto_close":true},"source":"global+repo"}
exit=0
```

`true`, from `global+repo`. `skills/cad-land/SKILL.md:24` reads this exact
merged value up front and step 3 branches on it, so the run enters arm **3(b)**
and the publish ask of 3(a) is skipped entirely.

### 2. The gate that replaces the human the skip switched off - PASSING

```
$ printf '{"findings":[]}' | node cadence-core/bin/land-cleanup.mjs gate --dir <fx>/repo
{"ok":true,"action":"proceed","findings":[],"reason":"auto_close on, no surviving blocker/high finding: proceed to merge","warnings":[]}
exit=0
```

`action:"proceed"`. This is the state an ordinary unattended close is in - no
surviving blocker - and it is the state that matters here, because it leaves
NOTHING standing between the skipped ask and the merge.

CONTRAST, for the record only: fed a surviving blocker the same gate halts.

```
$ printf '{"findings":[{"severity":"blocker","summary":"x"}]}' | node cadence-core/bin/land-cleanup.mjs gate --dir <fx>/repo
{"ok":true,"action":"halt","findings":[{"severity":"blocker","summary":"x"}],"reason":"auto_close on with a surviving blocker/high risk_surface finding: halt before merge, surface the findings","warnings":[]}
exit=0
```

That halt is the opposite outcome and is NOT the pre-fix failure AC6 asks to
watch. It is transcribed so the skipped-ask / halt pairing this phase must not
touch is on record beside the gap.

### 3. The refusal the GitHub and Forgejo arms die on

```
$ node cadence-core/bin/git-publish.mjs publish --dir <fx>/repo
{"ok":false,"reason":"auto-close-off","branch":"cadence/v3.5.1","remote":"origin","warnings":[]}
exit=1
```

`auto-close-off`, from the repo-layer-only read. On GitHub and Forgejo step
3(b) stops here and surfaces the reason. Note also what the envelope does NOT
say: nothing in it distinguishes "off in both layers" from "requested globally,
this repository never opted in" - it is the same six-token line either way.

### 4. The GitLab arm, walked

Step 3(b)'s GitLab bullets, run in order against the same fixture with the three
stubs on `PATH`:

```
$ glab mr view cadence/v3.5.1            # reuse probe
no open merge request                     (exit 1 -> create)
$ glab mr create --source-branch cadence/v3.5.1 --target-branch main --fill
https://gitlab.example.com/x/y/-/merge_requests/1
$ glab mr merge cadence/v3.5.1 --yes --remove-source-branch --auto-merge=false
merged !1
$ glab mr view cadence/v3.5.1            # confirm it landed
state: merged
```

`$CAD_SPAWN_MARKER` afterwards, verbatim:

```
glab mr view cadence/v3.5.1
glab mr create --source-branch cadence/v3.5.1 --target-branch main --fill
glab mr merge cadence/v3.5.1 --yes --remove-source-branch --auto-merge=false
glab mr view cadence/v3.5.1
```

`glab mr create` then `glab mr merge`, with NOTHING between them. No seam
invocation, no refusal, no halt. `mr create` publishes the source branch to the
remote, which is the first unattended external mutation, and `mr merge` lands it
on `main`.

The reason no seam call intervened is written into the two surfaces being
walked. `skills/cad-land/SKILL.md:122-123`:

> **Publish the branch (GitHub and Forgejo arms).** On GitHub, `gh pr create
> --head <branch>` will NOT push a remoteless branch non-interactively, and
> `tea pr create` never pushes at all, so on either host publish the branch
> first through the git-publish seam.

and `skills/cad-land/SKILL.md:145-146`:

> On GitLab `glab mr create` publishes the source branch itself, so no seam
> call is needed there.

The first bullet is scoped to two hosts by name; the second states the third
host's exemption as correct. Between them there is no arm on which a GitLab run
consults anything.

## Verdict

**Confirmed, as a run.** Under user-global `git.auto_close: true` with the
repository silent, `/cad-land`'s GitLab arm skips the publish ask, passes the
one gate that could have stopped it, and reaches `glab mr merge` having consulted
no authorization at all. The branch is published and merged on the strength of a
value the repository never set.

Three facts this run pins for the fix that follows:

1. The gap is in the ARM, not in the gate. `land-cleanup.mjs gate` behaved
   correctly on both inputs; it simply has no host to be wrong about
   (`lib/close-decision.mjs`'s `decideGateHalt` takes `autoClose` and knows no
   host). Its `:145-147` comment is documentation of this gap, not a fix site.
2. `git-publish.mjs publish`'s refusal is already the right ANSWER on the wrong
   number of hosts - it is reached on two of three. What GitLab needs is that
   same answer available without a mutation attached to it.
3. The refusal envelope cannot say WHICH authorization was missing. Run 3's
   line is byte-identical to what a repository with `auto_close` off everywhere
   would produce, so a user who set the key globally and expected it to work
   learns nothing from it.

The fixture, the stubs and the marker file are throwaway and live under the
session scratchpad, outside the repository. Nothing in this spike changed a
source file: `git status --porcelain` at the end of the run showed this SPIKE.md
as the only change.
