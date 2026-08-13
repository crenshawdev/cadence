# Verbatim — Design Brief

Input for `/cad-new-project`. Every decision below is settled unless marked **OPEN**.

---

## 1. What it is

Persistent, cross-session memory for Claude Code, built on the premise that **the session transcript is the record**.

Claude Code already writes every prompt, tool call, tool result and assistant turn to `~/.claude/projects/**/*.jsonl`. Verbatim tails those files, stores each session unmodified and permanently, indexes it, and gives the model precise recall over its own history.

Nothing is summarized at write time. Nothing is lossy. No inference is on the hot path.

## 2. Why it exists

The incumbent, `claude-mem` (90k stars, 224 open issues), runs a **second Claude instance** that watches your first one, compresses every tool call into an LLM-authored "observation", and throws the raw turn away. Consequences, all documented in its tracker:

- Users burn their token budget on the memory system itself; one reported $90 in three hours.
- The LLM's guess is the only copy, so retrieval quality can never be audited or measured.
- Context injection is `ORDER BY created_at DESC LIMIT n` — recency, not relevance.
- 45 open Windows issues, 36 Chroma issues, orphaned processes reaching 157 GB and OOM.

Verbatim inverts all of it: keep the truth, derive everything else, make retrieval measurable.

## 3. Non-goals

- No multi-machine sync, teams, auth, or cloud.
- No harnesses other than Claude Code in 0.x (Codex, Cursor, OpenCode deferred — each is a parser, not an integration).
- No web viewer or HTTP server.
- No telemetry of any kind.
- No daemon, no port, no long-lived process.
- No encryption at rest.

## 4. Language and shape

Rust. Single static binary. No Node, Bun, Python, or native shared libraries at runtime.

Concurrency: no async runtime. Cold start is the metric that matters — the hook path must not pay for a runtime it doesn't use. `rayon` for backfill parse/compress fan-out; a single writer thread for SQLite; blocking HTTP scoped to the observation command only.

---

## 5. Storage

One mechanism: **SQLite** via `rusqlite` with the `bundled` feature (vendored C source, statically linked, no system dependency, no `dlopen`).

```
<data dir>/
  verbatim.db          everything
  verbatim.db-wal
  verbatim.db-shm
  LOCK                 ingest exclusivity
```

| Table | Role |
|---|---|
| `sessions` | session_id → compressed, block-framed blob + checksum |
| `session_meta` | project, cwd, branch, times, source, final?, evicted?, parent, continues-from |
| `turns` | turn_seq, kind, tool, ts, offset/len into the blob |
| `turns_fts` | FTS5 over expanded turn text. Contentless (`content=''`, `contentless_delete=1`). Derived, droppable |
| `entities` | (turn_id, kind, value_norm) — exact match for paths, symbols, commands, errors, tools |
| `paths` | turn → files touched |
| `watermarks` | transcript path → byte offset |
| `observations` | opt-in, derived |
| `decisions`, `labels` | injection decision log + replay outcomes |
| `runs` | last N ingest runs: timestamp, duration, counts, error |
| `meta` | store format version, compression flag |

Blob write, turn rows, FTS rows, entities and watermark **all commit in one transaction**. Nothing can be out of sync.

### Blob format

Header (format version, codec, block size, block offset table) followed by 64 KB zstd-compressed blocks. Reading one turn decompresses one block, not the whole session.

**Compression is on by default.** Measured corpus: 895 MB / 1,896 sessions / 25 days ≈ 13 GB/year uncompressed for very heavy use; ~2 GB/year compressed. A typical user is well under that.

No stored preview column — search results decompress the hit's block on demand (~60 µs per 64 KB block).

### Why not the alternatives

| Rejected | Reason |
|---|---|
| redb | Exclusive file lock blocks *all* other processes, including readers. Young library holding the only copy of user history |
| Tantivy | Second store, second commit, divergence handling. FTS5 is adequate at this corpus size and gives single-transaction consistency |
| Turso / limbo | Beta; maintainers explicitly advise against mission-critical use |
| Postgres | Requires a server. Windows is the larger user base |
| DuckDB / SurrealDB embedded | Single-process write access; forces a daemon |
| Flat files / one file per session | Rejected outright |

### Truth and derived data

`sessions` is truth. Everything else — FTS, entities, observations, decisions, labels — is derived and rebuildable by replaying blobs.

**The archive table never migrates.** A store format bump rebuilds derived tables only. This is the property that prevents claude-mem's 49-migration situation.

### Durability

- Per-blob checksums in `session_meta`, independent of SQLite's own integrity checks, so corruption localizes to named sessions rather than "the store is gone".
- `PRAGMA integrity_check` plus incremental blob verification during ingest.
- Online backup / `VACUUM INTO` for consistent snapshots without stopping ingest.
- Rolling snapshots on by default.
- Upstream transcripts are a second recovery path — hence the install-time offer to raise `cleanupPeriodDays` (Claude Code default is 30 days).

---

## 6. Ingest

### Trigger model

Four hooks, all spawning a **detached** ingest process and returning 0 immediately.

| Hook | Synchronous work | Purpose |
|---|---|---|
| `SessionStart` | read index, emit resume brief, spawn ingest | **Required.** Only injection point; catch-up path when other triggers didn't fire |
| `UserPromptSubmit` | one entity query, inject 0–3 turns or nothing | Relevance. Hard deadline, fail open |
| `SessionEnd` | none | Freshness — captures a finished session in seconds. Does not fire on crash/`kill -9` |
| `PostCompact` | none | Records the compaction boundary. Cannot inject (no `hookSpecificOutput`) |

Hook command is the **absolute path to the binary**. No shell, no `$SHELL -lc` PATH probe, no version resolution. This single choice retires most of claude-mem's Windows issue class.

Spawn is fully detached: stdio to null, no inherited handles, new process group, `DETACHED_PROCESS | CREATE_NO_WINDOW` on Windows.

No daemon, no systemd/launchd/Task Scheduler. The hook spawn is the scheduler.

### Ingest run

1. Try-lock (`LockFileEx` / `flock`). Held → exit 0 immediately. No waiting, no retry storms.
2. Read watermarks.
3. Tail each transcript to the last complete record; skip excluded projects.
4. Build session blob, compress.
5. Commit blob + turns + FTS + entities + watermark in one transaction.
6. Apply retention if configured; compact if needed.
7. Re-check for new work; loop. Else exit, bounded by a max wall clock.

Recovery lives entirely in the binary at the top of every run. There is no `repair` command and no external supervisor. OS locks are used precisely because they die with the process — no PID files, no stale-lock wedging.

### Transcript facts (verified against 1,896 real files)

- **Compaction is append-only.** Same file, same session id; two records appended (`system`/`compact_boundary`, then `user` with `isCompactSummary`). Nothing is deleted or rewritten. Byte-offset tailing is safe.
- `compact_boundary` carries `preTokens`, `postTokens`, `cumulativeDroppedTokens`, and `preservedMessages.uuids` / `allUuids` — **exactly which turns fell out of the model's context.**
- **Subagents live in a nested sidecar directory**: `<project>/<sessionId>/subagents/agent-*.jsonl` plus `.meta.json`, `isSidechain: true`. 214 dirs, 1,135 files, 84,825 records — invisible to a top-level glob. Discovery must recurse and set `dot: true`.
- 1 file = 1 session = filename. No file mixes session ids. 0 unparseable lines in 5,915 sampled.
- **1.2% of sessions continue across files** (resume/fork), linked by `parentUuid`. Needs a `continues_from` link.
- Every record carries `cwd` and `gitBranch` directly.

### Project identity

**Read the project from the record's `cwd`, never from the encoded directory name** (which is lossy — you cannot distinguish `-` from `/`) and never from `basename()`. Claude-mem's four separate identity bugs all trace to `basename()`.

Key on the **canonical git toplevel path**, falling back to canonical cwd. Store basename only as a display label. Map worktrees to the parent repo via the git common dir and store both keys.

Canonicalize everything before comparing — resolve symlinks, normalize separators, case-fold on Windows and macOS.

### Byte distribution (measured)

| Share | Record |
|---|---|
| 41.0% | tool results |
| 35.8% | assistant turns |
| 16.4% | attachments |
| **2.6%** | **user prompts** |

Capture modes: `full` (default), `lean` (elide large tool-result and attachment bodies, ~50%), `minimal` (prompts, assistant text, tool names and args, ~10–15%). Elision is marked in the record.

---

## 7. Search and retrieval

Index at **turn** granularity; store at **session** granularity.

Three MCP tools. Not twenty. Every tool description sits in every session's context forever.

| Tool | Params | Returns |
|---|---|---|
| `recall_search` | query, project?, paths?, tool?, kind?, since?, until?, limit?, offset? | ranked turns: id, session, ts, project, excerpt |
| `recall_context` | id, before?, after? | chronological turns around a hit |
| `recall_get` | ids[] | full verbatim text, plus `body_evicted` flag |

- `readOnlyHint: true` on all three, so plan mode stops re-prompting each session.
- One-line descriptions. The workflow is implied by the return shapes; no meta-tool explaining the other tools.
- Auto-scoped to the current project; `project: "*"` opts into cross-project.
- Hard result budget enforced server-side.
- Errors return empty results with a reason. Never throw, never block.
- Observations are a `kind` filter, not a separate tool.
- Transport: short-lived stdio server, WAL reads. No worker, no port, no HTTP, no SSE.

`stats`, `usage`, `verify`, `reindex`, `export` are CLI only — never MCP.

### Tokenizer

Do not fight FTS5's tokenizer and do not write a custom one. **Normalize in Rust at ingest** and feed FTS5 expanded text: the original plus camel/snake/kebab components and path components.

```
SearchManager      → SearchManager, search, manager
--setting-sources  → --setting-sources, setting, sources
src/worker/S.ts    → src/worker/S.ts, src, worker, S, ts
```

Plain `unicode61` then works for both query shapes, and every expansion rule is a unit-testable Rust function. Index grows ~1.3–1.6×.

`trigram` FTS deferred until substring search proves necessary.

### Entities

Extract from **structured tool records**, not prose.

| Kind | Source | Normalization |
|---|---|---|
| `path` | Read/Edit/Write inputs, Glob/Grep paths, Bash argv | canonical absolute + repo-relative, case-folded on Win/mac |
| `command` | Bash tool input | `argv[0]` + significant subcommand; flags/args to a separate raw field |
| `error` | non-zero exits, stderr, panics | **strip variable parts** (line numbers, addresses, timestamps, UUIDs); keep the stable core |
| `symbol` | Edit/Write content, Grep patterns, code fences | whole identifier plus components; ≥4 chars with a case transition or underscore |
| `tool` | record field | none |

Two rules:

1. **Never reject at index time — weight by IDF at query time.** "Too common" changes as the corpus grows, and the decision would be irreversible.
2. **Cap entities per turn**, so one huge tool result can't emit thousands.

---

## 8. Context injection

### SessionStart — the resume brief

Budget: single-digit milliseconds. mmap, one query, write stdout, spawn ingest, exit 0. Any error → emit nothing, exit 0.

No query exists yet, so the signal is **continuity**, not a memory dump:

| Block | Source |
|---|---|
| Last session in this project | verbatim last prompt + last assistant turn, truncated |
| Summary / open threads | observations, if enabled |
| Working-state delta | git HEAD then vs now, branch, dirty files — no LLM |
| Index pointer | "N sessions, M turns indexed here; search tools available" |

That last row does disproportionate work: ~30 tokens telling the model searchable memory exists, versus claude-mem pre-loading everything.

Rules: hard token budget (~1–2k, configurable); **no volatile text** — stable ordering, no clocks, dates rounded to the day (claude-mem busts the Anthropic prefix cache every 60 seconds with minute-granularity timestamps); scoped by canonical project path; excluded projects emit nothing; no subagent turns; settings must actually reach the query.

### UserPromptSubmit — relevance

Affordable because a local FTS query is sub-millisecond — claude-mem blocks for 60 s because it does an HTTP round trip to a daemon that may not exist.

**Precision, not recall. Inject 0–3 turns; inject nothing most of the time.** Three near-misses are worse than silence.

Signal hierarchy, ranked by precision:

1. Error strings / stack frames — near-zero false positives
2. File paths mentioned or recently edited
3. Symbols / identifiers / config keys
4. Command invocations
5. Free-text BM25 — weakest, fires the most false positives

1–4 are exact matches on rare tokens, which is where BM25 beats embeddings outright.

Thresholding is structural, not a score cutoff (BM25 scores aren't comparable across queries):

- Fire on an exact rank 1–3 entity match, project-scoped.
- Fire when ≥2 independent entities co-occur in one turn.
- Otherwise stay silent. Free-text-only matches never inject.
- Cap at 3 turns and a hard token budget.
- Never inject the same turn twice in a session.
- Suppress anything already visible in this session or in the SessionStart brief.

### After a compaction

`PostCompact` can't inject, so it fires ingest only. The `compact_boundary` record identifies the dropped turns; the **next** `UserPromptSubmit` uses that set as a scoped, high-signal candidate pool with the prompt as the query. Not a bulk re-injection — a small corpus of "things this session knew ten minutes ago and no longer does".

### The feedback loop

Log every injection decision, **including non-fires** — non-fires are where miss data lives.

```
ts, session_id, turn_seq, project
entities_extracted[]   by type
candidates[]           turn_id, score, matched_on
injected[]             turn_ids
suppressed[]           turn_id + reason
thresholds_used, tokens_spent
```

Outcome extraction runs in ingest over finalized sessions, joining decisions against the transcript that followed:

| Label | Detection |
|---|---|
| hit | injected turn's path/symbol/session referenced downstream |
| false positive | injected, never referenced |
| **miss** | model called `search` for an entity that was indexed and not injected |
| wasted budget | tokens injected vs. tokens referenced |

Because the archive is verbatim and complete, **retrieval changes can be replayed against history offline** — change the extractor, re-run every logged prompt against the index as it was, diff the labels. Relevance becomes regression-testable rather than tuned by feel.

`recall stats` surfaces precision, misses, and tokens injected vs. referenced. A memory product that can prove whether it helps.

Claude-mem cannot do any of this: it discards the turns and keeps only the model's summary of them.

**OPEN — the auto-tuner.** Adjusting thresholds automatically from these labels is a *hypothesis*, not a plan. Per-user volume may be too low, "referenced downstream" is a weak proxy, and the `miss` label depends on the model choosing to search. Ship logging and replay (cheap, high value); gate the tuner behind evidence it converges.

---

## 9. Observations

**Opt-in, off by default.** The product is complete without them.

**Principle: only ask the model for what a parser cannot do.** Claude-mem asks the LLM for `files_read`/`files_edited` and has 0 of 5,059 rows populated.

**Mechanical** (always on, exact, free): files read/modified, tools used, commands run, errors seen, branch, commits, turn count, duration, compactions.

**Judgment** (LLM, one call per finalized session):

```
session_id
model, prompt_version, generated_at, status
topic            one line
outcome          completed | partial | abandoned | exploratory
decisions[]      { what, why, turn_id }   0–5
learned[]        { claim, turn_id }       0–5
unresolved[]     { what, turn_id }        0–5
```

**Every claim carries a `turn_id` anchoring it to a verbatim turn.** Auditable, anti-hallucination, and a jump target for retrieval. No other memory product can do this because none keep the turn.

Output is **JSON against a strict schema** — structured output or tool-calling where available. Not XML; claude-mem's XML protocol causes permanent silent loss on schema drift. Parse failure → retry once → store raw with `status = parse_failed`. Never silently drop, never block ingest. The session is still in the archive, so regeneration is always available.

Cost control: skip sessions under N turns, truncate input with explicit elision markers, daily token budget, one call per session — never per turn.

### Providers

One config block — **base URL, model, API key** — collapsing local (Ollama/llama.cpp), OpenRouter, and any self-hosted OpenAI-compatible endpoint into a single code path. Anthropic subscription auth is a separate branch (OAuth, not a key).

Base URL is a first-class setting, not a hidden env var. It was among the highest-voted unaddressed requests on claude-mem for a year.

### Shared credentials

```
~/.config/jcrenshaw/credentials.toml        Linux/macOS
%APPDATA%\jcrenshaw\credentials.toml        Windows
```

Namespaced by **provider**, not product, so every jcrenshawdev product reads the same keys. `0600`, refuse to load if group/world-readable, ACL check on Windows. Precedence: process env → product config → shared file. Values never reach logs, errors, or output — redaction at the boundary, not per call site. Migration reads a legacy `.env` once, writes the shared file, and tells the user; never deletes it.

This is cross-product infrastructure and needs its own small library rather than reimplementation per repo.

---

## 10. Privacy and the data boundary

Front and centre in README and docs, as a contract:

> Verbatim stores your sessions unmodified on your machine. Securing your machine is your responsibility. Ours begins the moment data leaves it — anything sent to a remote model is filtered; a local model receives nothing over the wire at all.

**Redact at egress, never at ingest.** Ingest-time redaction makes the store lossy, defeats "verbatim", and destroys what it strips. The bytes already sit in plaintext in `~/.claude/projects`, so at-rest scrubbing buys little.

**Key redaction on destination, not operation.** `resolve()`, injection, and observation generation are egress when the provider is remote and not egress at all when it's local. `export` writes to a path the user chose but should still state what it contains.

No encryption at rest. No telemetry. No network connections except to the model provider the user configured.

---

## 11. Retention and exclusion

Both off by default. Keep everything.

```toml
[retention]
action      = "evict"   # keep | evict | delete
age_days    = 0         # 0 = off
max_size_gb = 0         # 0 = off

[retention.project.scratch]
age_days = 7
action   = "delete"
```

| Action | Blob | Index | Result |
|---|---|---|---|
| `keep` | kept | kept | default |
| `evict` | dropped | kept, `body_evicted` | still searchable and listed, not readable |
| `delete` | dropped | removed | gone |

Enforced at the end of every ingest pass under the lock already held: exclusions, then age, then size cap oldest-first. Bounded work per pass. Compaction reclaims space — without it the file never shrinks and retention looks broken. `--dry-run` first; `usage` reports bytes per project and month.

### Project exclusion

```toml
[projects]
exclude      = ["/data/clients", "~/work/nda"]
include_only = []          # non-empty = allowlist mode
```

Prefix match on canonicalized paths, case-insensitive on Windows/macOS. A repo-local marker file excludes a repo so client work carries its own policy. **Excluded means never read** — not ingest-then-filter. **Enforced on both ingest and injection**; claude-mem honors it on write and ignores it on read.

---

## 12. Paths and configuration

| Purpose | Linux | macOS | Windows |
|---|---|---|---|
| Binary (canonical) | `~/.local/bin/verbatim` | same | `%LOCALAPPDATA%\Programs\Verbatim\verbatim.exe` |
| Data | `$XDG_DATA_HOME/verbatim` | `~/Library/Application Support/verbatim` | `%LOCALAPPDATA%\verbatim` |
| Config | `$XDG_CONFIG_HOME/verbatim` | same convention | `%APPDATA%\verbatim` |

- `VERBATIM_DATA_DIR` overrides. Resolved **once** at startup and passed down explicitly — never re-derived in a child.
- A `location` pointer file in the config dir means nothing hardcodes the store path; `verbatim data move <path>` relocates safely.
- Transcript roots: `$CLAUDE_CONFIG_DIR` → `~/.claude`, accepting a **list**. Canonicalize — symlinked config dirs are real and would otherwise ingest twice.
- Free-space guard before writing; refuse network mounts by default.
- Config written atomically, temp + rename.

**Windows specifics:** `LockFileEx` not `flock`; `DETACHED_PROCESS | CREATE_NO_WINDOW`; rename-then-replace for a running exe; `\\?\` prefix for long paths; case-folded comparison; UNC paths.

---

## 13. Install and packaging

**npm is the primary channel.** Every Claude Code user has Node, and `npx verbatim install` is the pattern this audience already knows.

esbuild-style: a thin `verbatim` package with `optionalDependencies` on per-platform packages (`@verbatim/linux-x64`, `@verbatim/darwin-arm64`, `@verbatim/win32-x64`, …) each shipping the prebuilt binary. **No postinstall script** — that sidesteps the blocked-postinstall failure class entirely. Node is install-time only; nothing at runtime touches it.

Secondary: GitHub releases, Homebrew, Scoop/WinGet, deb/rpm.

**No Claude Code plugin in 0.x.** The plugin system installs into versioned directories, which is the root cause of claude-mem's inline path-resolution script and its version-check hook. Revisit at 1.0; if it ships, it stays a thin bootstrap.

### Binary layout

`verbatim install` copies the platform binary out of the npm package to the stable path. **That copy is canonical** — hooks and MCP registration point at it, and the npm shim execs it, so there's one binary and no version skew. No PATH modification.

### `verbatim install`

1. Detect and canonicalize config roots; report if more than one resolves.
2. Ask for the data directory (default shown).
3. Show the exact `settings.json` diff, back up the file, confirm once. Merge into the existing `hooks` object, atomic temp + rename, idempotent.
4. Register the MCP server (stdio, same binary path, same merge rules).
5. If `cleanupPeriodDays` is low, explain that transcripts are the recovery path and **offer** to raise it.
6. Estimate the backfill (sessions, size, time), then run it detached, chunked, resumable, with bounded parallelism. Install returns immediately.
7. Print what changed, where data lives, how to undo it — plus the auto-compact recommendation.

`--yes` accepts defaults for scripted installs.

Hooks go in **user scope** — verbatim is global, one store across all projects.

### Upgrade

Package manager replaces the binary; `verbatim install` re-copies to the stable path. **Hooks are never rewritten** — the path doesn't change, so there is no version-check hook and nothing to repair. Store format bumps rebuild derived tables only. Config is additive.

### Uninstall

Removes only what it added, restores the settings backup if otherwise unchanged, **leaves the data** and prints where it is. `--purge` deletes it after showing size and confirming. Works even if the config is partly broken.

### `verbatim doctor`

Read-only. Never repairs. Every problem it names carries the exact command that fixes it.

Checks: binary at the stable path and version; hook entries present and pointing there; MCP registered; config roots resolved; data dir writable, free space; store openable, format version, integrity; last ingest run and error; effective `cleanupPeriodDays`; effective `autoCompactEnabled` across env and all three settings scopes.

### Auto-compact

Recommend disabling; never change it. With verbatim, compaction burns tokens to produce a lossy summary of context already stored losslessly — a fresh session plus targeted recall beats a self-summarized one. Surfaced in README, in `doctor`, and as one line in the install summary. Key is `autoCompactEnabled` (default `true`, any settings scope); also `DISABLE_AUTO_COMPACT=1` and `autoCompactWindow`.

---

## 14. CLI

| Command | Does |
|---|---|
| `verbatim status` | sizes, counts, watermarks, last ingest run and error |
| `verbatim search` / `show` / `sessions` | terminal recall |
| `verbatim ingest` | manual catch-up |
| `verbatim reindex` | rebuild derived tables from blobs |
| `verbatim verify` | walk blobs, check checksums, report bad session ids |
| `verbatim compact` | reclaim freed space |
| `verbatim usage` | bytes per project and month |
| `verbatim data move <path>` | relocate the store safely |
| `verbatim export` | portable output for backup or migration |
| `verbatim doctor` | read-only health report |
| `verbatim install` / `uninstall` | wiring |
| `verbatim observations regenerate [--since] [--prompt-version]` | rebuild derived observations |
| `verbatim mcp` | stdio MCP server |

Contract: human-readable by default, `--json` on every data command with a stable shape. Errors to stderr, data to stdout. Exit `0` success, `1` operational failure, `2` misuse — never non-zero for "no results". No colour when stdout isn't a TTY; honour `NO_COLOR`. Quiet unless attached to a TTY.

**No log file.** Ingest is detached, so its failures would otherwise be invisible — solved with the `runs` table, surfaced by `status`. A log file is debug-only, off by default, enabled with `--verbose`.

---

## 15. Testing

| Layer | What |
|---|---|
| Unit | tokenizer expansions, entity extraction, path canonicalization, block framing, watermark math, retention evaluation, egress redaction |
| Real-corpus parse | all 1,896 transcripts: zero panics, zero unparseable lines, snapshot extracted structure. Catches Anthropic format drift the day it ships |
| Property | round-trip compress/decompress, block reads at arbitrary offsets, watermark resume from arbitrary truncation, supersede ordering |
| Crash / durability | kill ingest at random points; assert consistency and convergence on rerun; truncate transcripts mid-line |
| Concurrency | N processes race the lock — exactly one works, the rest exit 0 in ms; readers during writes |
| Hook contract | feed the exact JSON Claude Code sends; assert exit 0, bounded wall time, clean stdout, fail-open when the DB is missing |
| Retrieval eval | labeled (query → expected turn) set; precision@k as a regression suite via the replay harness |
| Platform CI | Linux / macOS / Windows matrix actually exercising hooks and locking |
| Startup benchmark | assert hook cold start under budget. Startup time *is* the product |

Fixture data can't be committed — transcripts are private. Small synthetic/redacted set in-repo for CI, plus a local-only corpus test pointed at the real tree via env var.

**Claude-mem's issue tracker is a free test plan.** One regression test per failure class designed out: no shell spawn in the hook, no inherited handles on the detached child, exclusions honored on the read path, settings reaching the query, path canonicalization across symlinks.

No mocking SQLite — real temp databases throughout.

---

## 16. Versioning, licensing, repo

- **0.0.1 onward. 1.0 only when the full feature set has landed.** Agile increments.
- **Store format version is a separate integer** in `meta`. The binary refuses a newer format than it knows; an older one rebuilds derived tables. A product bump never implies a store rebuild.
- **Apache-2.0.** Source must be public — nobody installs a closed binary that reads every keystroke of their work. Apache over MIT for the explicit patent grant. AGPL is a documented negative signal in this category and its network clause protects nothing here. All dependencies are permissive (SQLite public domain, rusqlite MIT, zstd BSD, rayon MIT/Apache).
- **Public OSS** — an explicit override of the private-by-default rule, scoped to this project.
- `origin` is the self-hosted repo and the only remote. Publishing elsewhere is handled outside this project.
- crates.io `verbatim` is taken (a verbatim-paths helper). Publish as `verbatim-cli` with `[[bin]] name = "verbatim"`, or skip crates.io — real channels are npm and releases.

---

## 17. Open items

| Item | Status |
|---|---|
| Auto-tuner for injection thresholds | Hypothesis. Ship logging + replay; gate the tuner behind evidence it converges |
| `UserPromptSubmit` cost on Windows | Measure. The query is microseconds; **process spawn is 10–30 ms** and that's the real budget |
| Import of `/data/verbatim-legacy` (801 MB) | Deferred |
| Other harnesses — Codex, Cursor, OpenCode | Out of scope for 0.x |
| Multi-machine sync | Out of scope, stated so it doesn't creep in |
