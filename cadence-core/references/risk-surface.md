# risk_surface: the trigger contract

The `risk_surface` trigger's own contract, cold-split out of
`references/review-triggers.md` so a site that runs detection and matches
nothing reads this and not the whole review subsystem. The gate arms, the
record obligations and the discriminator grammar every path below writes on
stay in the router; this file holds what only this trigger needs.

## risk_surface detection (shipped defaults, configurable)

Detection is a SEAM's answer, never a model's reading of this list:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase <N> --base <ref> --head <ref>
```

maps the range's changed PATHS and its ADDED and REMOVED lines to
`{checked, categories, matches, inconclusive}` and appends that answer to
`.planning/trace.jsonl` whatever it is - so a range that matched nothing leaves
the same record a matching one does, and "the detection step was skipped" stops
reading like "it ran and matched nothing".

Two files carry the word surface and they answer different questions.
`cadence-core/bin/lib/surface-scan.mjs` answers which categories a project
SCOPES - once, from its structure, feeding the one-time ask below, and returning
all eight unconditionally because the narrowing is the user's.
`cadence-core/bin/lib/risk-diff.mjs` answers whether a given RANGE touched one,
every time a plan or a task completes, and it can and does return nothing.

A match in one of eight categories fires the `risk_surface` trigger, and so does
an `inconclusive: true` the seam could not judge: an unjudged range is not a
cleared one. The token beside each is the name that category carries
everywhere it is named by machine - in `review.triggers.risk_surface.surfaces`
and in route-table.json's `risk_surface_categories`:

- `auth` - auth/authz/sessions
- `migrations` - DB schema/migrations
- `billing` - money/billing/pricing
- `concurrency` - concurrency/async/locking
- `destructive` - destructive ops (deletes, bulk updates, drops)
- `secrets` - secrets/crypto/keys
- `api_contract` - public API/wire contracts
- `untrusted_input` - untrusted-input parsing

This list is also the operative definition of the `critical` stakes value: a
diff touching one of these surfaces is a break that does not come back as a bug
report.

**The set is chosen ONCE, at the first fire that needs it.** A `risk_surface`
fire whose step-1 resolve reports `surfaces_answered: false` does not proceed to
detection until the project has answered, and the SEAM enforces that, not this
sentence: `risk-check run` reads the config itself and returns
`{"ok":false,"reason":"surfaces-unanswered"}` when no layer answered and the
caller named no `--surfaces`. Until it did, this paragraph was the whole gate,
and an unanswered project was byte-identical to an answered one at every point
after the resolve - measured on a sibling project 2026-08-19, seven blocking
fires across three phases with the question never put to the user. A caller
naming `--surfaces` has already resolved the scope and is not refused. Run the
structural scan FIRST, so the question arrives carrying evidence instead of
asking the user to supply it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" detect-surfaces --root .
```

Then ask through the ask-user seam (seam-ask-user.md), whose conventions bind
here: at most four options per question, the recommended one FIRST and labelled
`(recommended)`, and that label is a display convention and never a
pre-selection - the user still chooses and the seam still blocks.

Do NOT compose the options at this site. The `detect-surfaces` envelope returns
them as `options`, already ordered and already de-duplicated: each entry's
`surfaces` is the set that picking it writes, and each entry's `reason` is what
the option states beside it, built from the scan's own `evidenced` signals and
its `unspeakable` categories - which costs no research pass, because the scan
already ran. Render that array in the order it arrives and add nothing to it.
Composing the list from prose here is what put the same categories in the first
slot and again in the last one (#206): a list a model assembles per run is a
list no check can read.

The first entry is always the scan's `recommended` array, which is all eight
categories, and it is the same set on both scan arms. An `inconclusive: true`
scan changes only the REASON that entry states - no dependency manifest and no
category directory matched, so the structure evidences nothing either way.
Never present a narrower set as the recommendation on evidence that does not
exist (D-14) - the scan reports what it can SEE, and silence is never absence.

Persist the answer at the repo layer, which is what makes it a one-time ask:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set 'review.triggers.risk_surface.surfaces=["secrets","destructive"]'
```

The choice cannot be skipped and cannot be defaulted: the seam forbids
fabricating an answer it was supposed to collect, so an unanswered project does
not fire and does not proceed past the question. The answer then SCOPES
detection - `risk-check run` checks the categories the project chose, not the
eight it did not. It is asked HERE and not in
`/cad-new-project` or `/cad-adopt` because both front doors forbid configuration
questions in their own prose AND in their own success criteria (D-15), and it
costs nothing on a project that never trips this trigger.

**The resolved set scopes the fire.** A heuristic match in a category OUTSIDE
the resolved `surfaces` set does NOT fire the trigger. That set comes from the
step-1 resolve, never from a config read at this site (D-13): a cost key whose
enforcement is a model remembering to read a value is the same substitution
shape `references/review-triggers.md` step 3 closed for `review.reviewers`. With the key unset the resolve
returns all eight, so every category fires exactly as today and no existing
project's coverage shrinks on upgrade.

This is the ONE detector, and it reads the diff - through `lib/risk-diff.mjs`,
so an answer exists whether or not it matched. A path match against a
phase's declared `files:` list was the other one until v2.7.0; it judged a file
by its NAME, floored a whole phase on one token, and is gone. `tests/ingest_concurrency.rs`
raising six roles to their top rung is what it cost.

**Pre-filter before escalating (avoid a blocking panel on a non-risk).**
These two drops are judgments about diff CONTENT.
A heuristic match is dropped - it does NOT fire the trigger - when the match
is provably harmless:

- **Ephemeral / gitignored target.** A destructive op (`rm -rf`, drop, bulk
  delete) whose only target is a gitignored or build-output path
  (`git check-ignore <path>` matches). For a directory target, also require
  `git ls-files -- <path>` to be empty - an ignored `dist/` that still holds
  a force-added tracked file is not safe to drop. Deleting a truly ignored
  `dist/` is a build clean, not data loss.
- **Placeholder-shaped secret.** A secrets/keys match drops ONLY when BOTH
  hold: the file is a template/sample/example (`*.env.example`, `*.sample`,
  `*.template`, or an obvious example fixture) AND the value is a stub
  (`<...>`, `changeme`, `your-...-here`, `xxx`, `example`, empty after `=`).
  Either alone still fires - a real key in a `.env.example`, or a
  placeholder-shaped value like `changeme` sitting in a runtime `.env` or
  deploy config as an actual weak secret, both stay worth the panel.

Drop only when the WHOLE match is harmless; a diff that also touches a real
risk surface still fires. When unsure, do not drop - fire the trigger. Note
each drop and why, so a mis-filter is visible rather than silent.

## Persisting the settled survivors

`references/review-triggers.md` step 5 states WHY this write happens at every
gate and who consumes it. This is WHERE. Write the settled survivor list as the
same JSON object every reviewer returns, to
`.planning/phases/<N>/REVIEW-risk_surface-<discriminator>.md`.
`/cad-land`'s unattended close unions those files and pipes them to
`land-cleanup.mjs gate`, and it fires no review of its own, so this write is the
ONLY producer that halt has: skip it and an autonomous close merges over a
blocker nobody halted on.

Two properties keep the union honest, and both are failure modes that report
CLEAN rather than erroring:

- **Every write is discriminated - there is no unsuffixed path.** The
  discriminator is the grammar `references/review-triggers.md` step 5 states
  once, and nothing here restates it. What it buys: two fires sharing a
  filename do not merge, they overwrite - a later empty settle erases an
  earlier survivor the user had overridden.
- **The producer set outlives the phase dirs.** `/cad-milestone` step 3 prunes
  `.planning/phases/<N>/` and only then chains `/cad-land`, so it carries the
  survivors to `.planning/REVIEW-risk_surface-<label>.md` first. The consumer
  glob is BOTH that path and `.planning/phases/*/REVIEW-risk_surface*.md`. That
  carried file is TRANSIENT and never staged (milestone.md step 7 deletes it):
  committed, it would hard-halt every later land on an answered finding.
