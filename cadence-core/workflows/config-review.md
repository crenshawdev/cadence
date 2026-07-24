# cad-config review provider setup (cold branch)

Loaded from config.md when `--review` was passed or the user opts into
provider assignment from the interactive menu. Rejoin config.md at
**Wrap-up** when done.


Goal: fill `review.providers.<name>.tiers.{flagship,balanced,cheap}` with real
detected model ids, per DESIGN §6's three-layer detection (live list ->
classify known ids -> assign per position). Model ids are never hardcoded; they
come from the provider.

Detection is the slow part - each `detect-models` call can sit up to its full
timeout, and the calls are independent. So detect ALL providers first in one
concurrent batch, then walk the interactive Handle -> Assign -> Write per
provider over the gathered results.

### 1. Detect all providers (one concurrent batch)

Fire `detect-models` for every provider under `review.providers` (openai,
gemini, deepseek) in ONE message (conventions.md Parallel work; seams.md
concurrent dispatch) - not one provider at a time, or three full timeouts run
back to back. This is the only place a provider call happens:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" detect-models \
  --provider <name> [--key-file <review.key_file, only if set>]
```

Parse each provider's single JSON line. Steps 2-4 below then run per provider
over these already-gathered results - that part is interactive, so it stays
serial.

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

Write the chosen ids through the **Validation seam**, one `set` per provider so a
mid-flow stop still persists what was decided:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set \
  'review.providers.<name>.tiers.flagship=<id>' \
  'review.providers.<name>.tiers.balanced=<id>' \
  'review.providers.<name>.tiers.cheap=<id>'
```

A position with no suitable model stays `null` (omit that pair) - triggers that
map to that tier fall back to `claude-subagent` until it is assigned. Once a
provider has assigned tiers, add its name to `review.reviewers` (e.g.
`set 'review.reviewers=["claude-subagent","openai"]'`) so `fire()` actually
resolves it - assignment alone does not enroll a reviewer.

## Wrap-up

Rejoin config.md at its Wrap-up (the warm branch owns the summary, the
dangling-enrollment flag, and the degradation contract - one copy, there).
