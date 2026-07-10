# cad-config workflow

Configure `.planning/config.json` (the ~22-key file; template and canonical
shape in `cadence-core/templates/config.json` and DESIGN §7). One interactive
skill; the substantive part is review-provider model assignment, which is the
only config knob that needs live detection rather than a plain edit.

## 0. Locate config

Read `.planning/config.json`. If it is absent, this project has no config yet
(`cad-new-project` writes one). Offer to copy the template into place; stop if
the user declines.

## 1. Route

Parse `$ARGUMENTS`:
- Starts with `--review`: go to **Review provider setup** (a trailing
  `redetect` just means re-run detection and reassign; same flow).
- Contains `<key>=<value>` tokens: go to **Direct set**.
- Empty: show a compact summary of the current config, then ask (ask-user seam)
  what to configure - `[Review providers | A setting | Nothing]` - and route.

## Direct set

For each `key=value` (dotted paths allowed, e.g. `workflow.plan_check=false`):
- Confirm the key exists in the §7 schema and the value fits its type/enum.
- Reject an unknown key or bad value (list the valid keys/values); do not write
  a malformed config.
- Apply all valid pairs, write the file, and echo the changed keys.

## Review provider setup (the assignment flow)

Goal: fill `review.providers.<name>.tiers.{flagship,balanced,cheap}` with real
detected model ids, per DESIGN §6's three-layer detection (live list ->
classify known ids -> assign per position). Model ids are never hardcoded; they
come from the provider.

Run this for each provider under `review.providers` (openai, gemini):

### 1. Detect

Invoke the call-review-provider seam (this is the only place a provider call
happens):

```
node "$HOME/.claude/cadence-core/bin/review-provider.mjs" detect-models \
  --provider <name> [--key-file <review.key_file, only if set>]
```

Parse the single JSON line on stdout.

### 2. Handle the result

- `ok:false, reason:"no-key"`: report where to set the key (the `detail` field
  names `env $OPENAI_API_KEY` / `$GEMINI_API_KEY` or the providers.env path).
  Mark this provider unconfigured and move to the next - never block, since
  `claude-subagent` is the always-available fallback.
- `ok:false, reason:"transport"|"http"`: report `detail`. Offer (ask-user seam)
  `[Retry detection | Enter model ids manually | Skip this provider]`. Degrade,
  do not block setup on a network failure.
- `ok:true`: continue with `models[]` - each entry is `{id, tier, high_effort}`
  where `tier` is `flagship|balanced|cheap` for known ids or `null` for unknown
  ones (unknowns are still selectable; the user places them).

### 3. Assign

Ask the user (ask-user seam) which mode:

- **"You decide"** (default, low friction): auto-map each position to the best
  classified candidate -
  - `flagship` <- a `tier:"flagship"` id, preferring `high_effort:true`
  - `balanced` <- a `tier:"balanced"` id
  - `cheap` <- a `tier:"cheap"` id

  If a position has no classified candidate, leave it `null` and flag it. Show
  the proposed three-line mapping and offer `[Accept all | Adjust a position]`.
  On adjust, drill into that one position using the manual picker below.

- **"Manual"**: for each of the three positions, present the detected
  candidates (`id` + tier hint, most-relevant first) as choices, plus an
  `Other` option for a free-typed id. Unknown-tier ids may be assigned to any
  position.

### 4. Write

Set `review.providers.<name>.tiers` to the chosen ids. A position with no
suitable model stays `null` - triggers that map to that tier fall back to
`claude-subagent` until it is assigned. Write the config after each provider so
a mid-flow stop still persists what was decided.

## Wrap-up

Summarize the final tier map per provider and note which triggers now have a
cross-model reviewer (a trigger whose `tier` resolves to a non-null id on a
configured reviewer). Remind the user this is re-runnable (`/cad-config
--review`) and is auto-offered when a review fails with a model-not-found /
deprecated error (trouble-triggered redetect, wired in the review dispatch).

## Degradation contract

If detection fails for everything (offline, no keys, rate limited), the review
subsystem still works via `claude-subagent`; consult is simply not offered.
cad-config only ever writes validated ids and never blocks the spine on a
network call.
