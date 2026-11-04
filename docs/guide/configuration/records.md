# Project records

Cadence keeps project state on disk so another session can continue from it. These settings control roadmap granularity, whether planning documents are committed, capture-queue reporting and recall.

Committing planning documents makes that record available wherever the repository goes. Turning it off changes what Cadence commits; it doesn't erase existing history or make already tracked files private. Review what is tracked before publishing.

The testing policy's committed `.github/cadence/coverage-policy.json` is separate from `.planning/`. CI needs that policy even when planning documents aren't committed.

## Settings

### `granularity`

**Default:** `"standard"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"fine"`, `"standard"`, `"coarse"`.

Controls the number of phases proposed during new-project roadmap creation: `coarse` aims for 3–5, `standard` for 5–8 and `fine` for 8–12. It does not split a phase into tasks.

### `planning.commit_docs`

**Default:** `true` · **Type:** boolean · **Scope:** repository or user-global.

Commit planning documents alongside code. `false` tells Cadence not to commit them; it does not remove files from previous commits.

### `planning.max_capture_bullets`

**Default:** `40` · **Type:** integer · **Scope:** repository or user-global.

**Range:** 1 or greater.

Reporting threshold for substantive Todos, Seeds and Notes in `.planning/CAPTURE.md`, excluding the empty placeholder. A crossing is reported; capture writers continue accepting items.

### `memory.backend`

**Default:** `"builtin"` · **Type:** enum · **Scope:** repository or user-global.

**Allowed values:** `"none"`, `"builtin"`.

`builtin` uses the built-in BM25 recall over `.planning/`. `none` disables recall.
