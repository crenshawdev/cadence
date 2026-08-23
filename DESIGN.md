# Cadence - Design Plan

A single-developer distillation descended from GSD, derived from a file-backed deep-dive of all 69 skills,
34 agents, and the `gsd-core` engine (110 workflows / 94 references / 143 node scripts /
~55K lines). Per-skill analyses live in `design-notes/dd-*.md` (gitignored, local only).

Audience assumptions (John): solo dev; Rust/CLI/backend + some COSMIC/iced UI + general
scripts; NOT building AI/LLM products; already runs mem-* (primary memory), claude-mem,
Obsidian vault, Codex as a genuine second model (panel-review / codex-rescue /
codex-risk-gate), Artifact + cosmic-design for UI. Claude-Code-only runtime.

---

## 1. The four structural decisions (apply once, win everywhere)

These are worth more than any per-skill cut. Each removes weight from *many* skills at once.

1. **Standalone repo - the repo is the only source.** Cadence is a plain git repo; the installed
   tree under `~/.claude` is disposable output, NEVER edited in place. Install = idempotent
   copy script, re-run after any repo edit or `git pull` (+ occasional manual `git merge`/
   cherry-pick from upstream that you adjudicate). An `install.sh --dev` flag may symlink
   instead for fast local iteration, but no skill/agent/workflow may depend on the install
   mechanism — distributable (copy-based, Windows-safe) from day one.
   → Evaporates the entire `update` / `sync-skills` / `reapply-patches` / `gsd-pristine` /
   three-way-merge / `installer-migrations` subsystem. GSD's own patch machinery proves the
   tolerable-divergence ceiling is too low to track upstream as patches; Cadence diverges
   *structurally*, so it must own its source.

2. **Delete the 16–18-host CLI locator shim everywhere.** It is pasted (~40 lines) into nearly
   every workflow to probe `.cursor/.gemini/.hermes/…`. You run only Claude Code. Hardcode one
   `~/.claude` path. → Removes dead weight from ~50 files.

3. **Delete `.planning/STATE.md` audit logs.** Roadmap-evolution logs, decision logs, session
   narratives, "Quick Tasks Completed" tables, "Last Activity" bumps — all triplicate git
   history (and your mem-*/vault). git is the log. → Simplifies `.planning/`, which in turn
   shrinks `health`, `forensics`, `cleanup` by design.

4. **Route every second opinion through the review subsystem (§6).** Kill all ad-hoc internal
   "Claude-reviews/researches/fixes/converges-Claude" loops scattered across skills; one
   configurable subsystem replaces them. Default backend is a fresh-context, refute-prompted
   claude-subagent (zero-dep); cross-model reviewers (Codex/Gemini/custom CLI) are a configured
   upgrade for users who run a second model.
   → Removes the verify-loop, fix-loop, advisor fan-out, convergence loop, secure-phase
   auditor, code-reviewer, and most web-research fan-outs as separate machinery.

**Emergent property — context is disposable.** These four decisions share a
consequence worth naming: durable state lives in files (`.planning/` docs, git
history) and every plan, review, and execution runs in a fresh-context
subagent, so the working conversation carries almost nothing a file doesn't
already hold. Cadence is meant to be `/clear`-ed aggressively mid-project —
clear at any phase boundary and the next command reconstructs what it needs
from disk. This is a deliberate *attempt* at context frugality — it keeps
prompt-cache reuse high and the orchestrator context lean — not a guarantee.

---

## 2. Cadence skill set (~22 skills replacing 69)

### Build spine (the core loop)
| Cadence skill | Derived from | Change |
|---|---|---|
| `cad-new-project` | new-project (1629L) | Keep questioning spine; research off-by-default → optional Codex pass. ~55% smaller |
| `cad-context` | **discuss + spec + mvp** | Collapse 3 pre-plan gates into 1. Keep assumptions-analyzer + falsifiable acceptance + one "too big?" question. Cut ambiguity scoring, edge-probe engine, SPIDR, interview modes |
| `cad-plan` | plan-phase (1770L) | Planner-only (+ optional checker); ~4 flags not ~20; plan-review → Codex. ~250L |
| `cad-execute` | execute-phase (1707L) | **Sequential inline**, no worktree waves. Keep atomic commits + deviation rules + SUMMARY + light goal check. ~200L |
| `cad-verify` | verify-work (877L) | Keep conversational persistent UAT; fixes → Codex; `--sweep` folds audit-uat. ~1/4 size |
| `cad-progress` | progress (1250L) | Count-based truth + auto-resume incomplete phase. Fold `stats` as `--stats`. Cut `--do`/`--forensic`/`--converge`. ~100L |
| `cad-task` | **fast + quick** | Merge. Inline-first (fast's clean body); `--plan` opt-in; worktree off. Replaces ~1100L with a few hundred |

### Quality gates (all defer to Codex)
| Cadence skill | Derived from | Change |
|---|---|---|
| `cad-plan-review` | **gsd-review** (the one cross-AI keeper) | Codex-only, ~50L. Reviews the PLAN *before* code — a real gap /panel-review doesn't fill (it reviews diffs). Cut convergence loop + all non-Codex hosts |
| `cad-debug` | debug | Persistent hypothesis-state across `/clear` + scientific method, single-pass. Deep cases → codex-rescue. Cut session-manager layer + specialist dispatch |
| `cad-coverage` | **validate-phase + add-tests** | Merge. "Which requirements have zero failing-test coverage → generate tests." Model-agnostic, un-duplicated. Drop Nyquist branding, Playwright default |
| `cad-docs-verify` | docs-update verifier (~220L of 1168) | Keep the verify-claims-against-live-code engine (real value for OSS distribution). Collapse the writer |
| `cad-audit` | audit-milestone | Pre-ship requirement-traceability cross-ref + orphan detection + FAIL gate. Catches silently-dropped requirements |

### Lifecycle & git
| Cadence skill | Derived from | Change |
|---|---|---|
| `cad-milestone` | **new + complete-milestone** | Collapse to a thin version-cut: `git tag`, prune completed phases from live roadmap (git is the archive), evolve PROJECT.md, refresh REQUIREMENTS. Fold `cleanup` in |
| `cad-phase` | phase CRUD | Keep the `remove` renumbering + dependency-ref repair (the op humans botch). add/insert/edit ≈ direct markdown edits |
| `cad-undo` | undo | Keep manifest→hashes discovery + dirty guard + `--no-commit` squash. Drop heuristic dependency-check |
| `cad-land` | **replaces ship** | ⚠️ ~30L, reports git state, asks the mechanism with NO pre-selected default, executes it raw. Honors your "git mechanism is my call" rule by construction |

### Support
| Cadence skill | Derived from | Change |
|---|---|---|
| `cad-capture` | capture | todos (the one thing mem-* lacks: actionable phase-linked queue) + optional seed. Notes → route to `/mem-note` |
| `cad-config` | **config + settings** | One skill managing the ~22-key config in §7 |
| `cad-help` | help + 6 ns-routers | Static COMMANDS.md; fold the 6 namespace tables in as headings |
| `cad-spike` | spike | Keep falsifiable Given/When/Then + verdict + risk-first ordering (counters declare-success-on-assumption). Slim the 5-artifact wrap-up |
| `cad-pause` | pause + resume | Tiny skill (§5.3): WIP commit + STATE.md cursor + one-line "where I was". Resume folded into `cad-progress`. No Stop hook |
| `cad-health` | health | Keep stripped: ~20-line "is ROADMAP/STATE cursor parseable" (§5.1; the cursor IS retained) |

### UI: no skills — one hook
Phase tagged UI + COSMIC → auto-load `cosmic-design`. Web mockups → Artifact + artifact-design.

---

## 3. Cut wholesale (~45 skills + ~24 agents)

**Dead code on your machine (off, uninstalled, never fires):**
- `mempalace-capture`, `mempalace-recall`, `mempalace-curator` — 4th/5th memory system; inverts
  your mem-*-first rule. `graphify` — wraps an uninstalled Python pkg; mem-* graph is stronger.

**Redundant with your existing stack:**
- `profile-user` (you authored your own CLAUDE.md), `extract-learnings` (→ /mem-lesson),
  `thread` (claude-mem), `explore` (just "be Socratic + capture"), `sketch` + `ui-phase` +
  `ui-review` (web/Tailwind/shadcn — false signal on iced), `map-codebase`/intel (learn-codebase
  + smart-explore + pathfinder are deeper), `milestone-summary` (team onboarding).

**Team / multi-author / concurrency machinery you don't have:**
- `import`, `ingest-docs` (+ doc-conflict-engine), `workstreams`, `workspace`, `inbox` (GitHub
  maintainer triage), `manager` (multi-phase dashboard), `pr-branch` (assumes PR flow), `surface`
  (catalog-scaling for 69 skills).

**Against your verify-before-done discipline:**
- `autonomous` (trust-the-machine), `audit-fix` (fix→commit with no verify),
  `plan-review-convergence` (auto-replan until pass).

**Wrong domain / experimental:**
- `ai-integration-phase` + `eval-review` (+ 5 AI agents + 2 refs) — you don't build LLM products.
- `ultraplan-phase` (BETA cloud, GitHub-gated), `secure-phase` (→ your codex-risk-gate),
  `review-backlog` (+ the 999.x mechanism), `audit-uat` (→ cad-verify --sweep), `stats` (→
  cad-progress --stats), `add-tests`/`validate-phase` (→ cad-coverage).

**Agents:** 34 → ~8–10 keep (executor, planner, plan-checker[opt], assumptions-analyzer,
verifier, debugger, doc-verifier, nyquist/coverage). Cut all ai-*, ui-*, doc-classifier/
synthesizer, mempalace-curator, user-profiler, codebase-mapper, intel-updater,
framework-selector, domain-researcher, eval-*, advisor-researcher, research-synthesizer,
pattern-mapper (→ mem-*), project-researcher (→ Codex), security-auditor (→ Codex),
integration-checker, code-reviewer/code-fixer (→ panel-review). Rung files
(`cad-planner-xhigh` etc., §6) add ~4–8 files but are rungs of kept roles, not new agents.

---

## 4. Rough magnitude
- Skills: 69 → ~22 (−68%)
- Agents: 34 → ~9 roles (−74%), plus ~4–8 rung files of the same roles (§6)
- The spine alone: ~5,100 workflow lines → ~900, with no loss of solo-dev value.
- Whole subsystems deleted: update/patch/pristine, CLI shim, STATE audit logs, MemPalace,
  graphify, AI track, doc-ingest, UI track, workstreams/workspace.

## 5. Open questions for John (discussion)
1. Keep structured `.planning/` STATE at all, or go lighter (git + a thin ROADMAP/SUMMARY)?
   This decides whether `health`/`forensics`/`undo`-manifest survive.  → **DECIDED: slim-cursor.**
   Canonical `.planning/` file set: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
   (~4-line cursor: phase/status/next, no audit log), `phases/<N>/{CONTEXT?,PLAN,SUMMARY,UAT}.md`
   (CONTEXT.md optional, written by cad-context when a discussion ran; cad-plan reads it if present).
   Nothing else — cut all derived/analytics files. (PROJECT.md + REQUIREMENTS.md stay because
   `cad-new-project` writes them and `cad-milestone`/`cad-audit` consume them.)
   **The shipped set has grown past this, each addition its own decision, none of them an
   analytics file:** `trace.jsonl` (the run record), `CAPTURE.md` (gitignored),
   `phases/<N>/{REVIEW-*.md,ADJUDICATION-*.json,FINDINGS.json,verifier-findings.json}`
   and `phases/<N>/reports/` (the review and verify record), and — v3.6.0, phase 3 —
   `tasks/<slug>/RECORD.md`, an off-roadmap `/cad-task` run's own record.
   `health` → ~20-line "is ROADMAP/cursor parseable".
   `forensics` → cut (self-obsoletes once worktree-waves are opt-in), handle ad hoc via git + review.
3. pause/resume → **SETTLED:** `/cad-pause` = tiny skill (WIP commit + write cursor + one-line
   "where I was"). Resume is **folded into `/cad-progress`** (already reads the cursor). One skill,
   no Stop hook to install. Optional auto-pause Stop hook can come later.
4. Name → **SETTLED: Cadence, `/cad-*`.** Install to a distinct dir so it coexists with GSD during
   migration. **SETTLED at scaffold (2026-07-10):** engine dir `~/.claude/cadence-core/`; skills/agents
   install as `cad-*` into the shared flat `~/.claude/skills/` and `~/.claude/agents/` (all verified free).
5. Distribution → **SUPERSEDED:** repo is already public; shipped as a Claude Code plugin
   (`/plugin marketplace add`, clone = dev flow — see §6).

**ALL DESIGN DECISIONS SETTLED (2026-07-10). Ready to scaffold.**

---

## 6. Locked decisions (2026-07-10)

- **Positioning:** public distribution eventually; a trimmed **single-developer** distillation descended from GSD,
  properly licensed. Trim anything team/multi-author.
- **Distribution model:** **SUPERSEDED (shipped as a Claude Code plugin).** User install =
  `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git` then
  `/plugin install cadence@cadence`; update/uninstall are the matching `/plugin` commands.
  The plugin runtime carries the tree, so the npm copy-installer described below was never
  built. Dev/contributor flow = clone the repo. *(Original 2026-07-10 decision, kept for
  the record: user install = npm `npx @crenshawdev/cadence install` running an idempotent
  copy into `~/.claude`; dev flow = clone + `./install.sh`. The disposable-installed-tree
  rule that decision leaned on still holds — the plugin copy is likewise never edited in
  place, so there is zero reapply-patches machinery.)*
- **Runtime:** **Claude Code only**, one clean path resolver, no multi-host shim. But the three
  host-touchpoints — **ask-user, spawn-agent, call-review-provider** (a provider API call, not a
  CLI) — go through thin internal seams so a future contributor could add a runtime without
  rewriting workflows ("portability-ready seams"). We don't pay portability tax now.
- **Generic-user reframe:** cuts that were "John already has mem-*/claude-mem/Codex" become
  **built-in minimal + optional hook**, NOT deletions — a generic installer has none of that.
  Cadence ships self-contained; power users plug in richer backends.
- **Agent fan-out: KEPT** as a first-class configurable capability (not amputated). Sequential is
  the low-ceremony default; parallel waves are opt-in. The ~60% of execute-phase we cut was the
  always-on worktree *safety scaffolding*, not the fan-out — safety applies only when parallel is on.
- **Memory/continuity:** built-in tiny file-based continuity (cursor + SUMMARY + optional
  LEARNINGS→git) with an optional `memory.backend` hook (none | mcp) for mem-*/vault.
- **Milestone layer:** thin version-cut ritual (tag + prune roadmap + refresh requirements). Kept.

### Adversarial review = first-class configurable subsystem (absorbs gsd-review, code-review,
### plan-review-convergence, secure-phase)
- Default backend `claude-subagent` (fresh-context, refute-prompted) so it works with only Claude
  Code installed and no API keys. **Cross-model reviewers are a configured upgrade**, not a
  requirement. Reviewer plug-ability is about *reviewer models*, not host runtimes.
- **Cross-model reviewers are direct provider API calls, NOT CLI subprocesses (DECIDED 2026-07-10).**
  Supported providers: **OpenAI (Codex/GPT) and Google Gemini.** Rationale: in Cadence, review is a
  pure function (artifact in → structured findings out); the API is built for exactly that, while a
  CLI is an agent harness whose self-directed investigation is dead weight here because the
  *adjudicator is the main model* and already owns repo grounding. The API wins on the axes that
  make review seamless:
  - **Enforced structured output** — OpenAI `response_format` JSON-schema / Gemini `responseSchema`
    return the exact finding shape (file, line, severity, claim, failure-scenario). No telemetry
    stripping, no sentinel scraping, no `jq` fallbacks — the whole class of "hacked" parsing that
    plagued GSD's `code_review_command` and the CLI path is gone.
  - **Deterministic control** (model, temperature, system prompt, token budget per trigger tier) →
    reproducible and unit-testable (mock the HTTP, assert the schema); CLI review is not.
  - **Trivial panels** — adjudicated/panel mode is N parallel HTTP calls, no subprocess/worktree
    orchestration. **Clean failure modes** — HTTP status, not parsed stderr.
  - The CLI's one real edge (agentic self-investigation) is redundant: reviewers critique the
    presented artifact; the main-model adjudicator investigates and grounds. If a reviewer needs
    more than the diff, put the relevant files in the request payload.
  - Trade-off on record: API means the subsystem carries provider clients + key management as a
    real dependency, pushing on "zero-dep/distributable." The `claude-subagent` default is the
    no-key fallback; the API path is the cross-model *upgrade* a user opts into.
- **Division of labor:** API reviewers (Codex/GPT + Gemini) = structured single-shot independent
  critique. Main model = agentic grounding, false-positive kill, dedupe of convergent findings,
  final verdict. Same as `/panel-review`, which is the proven pattern.
- Config drives: `backend`, `mode` (single|panel|adjudicated), `reviewers[]`, provider config
  (`providers.<name>`: model id, endpoint, key reference — key storage TBD), and per-trigger gating
  (`plan`, `diff`, `risk_surface` auto-detected, `phase_diff`) at off|advisory|blocking|adjudicated.
  No global master switch - per-trigger `off` disables any gate, and consult is always-ask, so a
  separate on/off is redundant.
- **Trigger wiring (which skill fires what):** `plan` → `cad-plan`, after PLAN.md is written;
  `diff` → `cad-execute`, at plan completion (advisory by default — low-ceremony solo flow);
  `risk_surface` → `cad-execute`, once per plan on the committed range when it matches a risk surface;
  `phase_diff` → `cad-execute`, once the parallel path's worktree batches merge. `cad-verify` routes
  fix requests through the subsystem rather than spawning its own fixer loop. `/cad-land` fires
  nothing: the land-time gate it once had was deleted in v3.2.0 as a fourth pass over work three
  passes had already cleared.
- **`risk_surface` detection — shipped defaults** (path/diff heuristics, configurable list):
  auth/authz/sessions · DB schema/migrations · money/billing/pricing · concurrency/async/locking ·
  destructive ops (deletes, bulk updates, drops) · secrets/crypto/keys · public API/wire
  contracts · untrusted-input parsing.
- The spine is built before the review subsystem, so the **trigger interface (a stub seam) is a
  Foundation deliverable** — spine skills call the seam from day one; the subsystem fills it in later.
- The auto-replan *convergence loop* is cut (auto-decides; against verify-before-done discipline).

### Cross-model consult = on-demand second-model help at dead-ends (DECIDED 2026-07-10)
A capability distinct from adversarial review, reusing the same provider connections (OpenAI/Codex
+ Gemini) but for a different job. Review is *scheduled critique* of an artifact; consult is
*reactive help* when the primary model is stuck. Codifies John's manual "Codex reflex" (Lane R /
codex-rescue) as a first-class feature — GSD rails you through steps but has no "phone a friend" at
the dead-ends between them.
- **Decision-support, never delegation.** The consult returns angles/hypotheses to try; the main
  model grounds each against the real code and the *user* decides. It never takes the wheel or
  auto-picks a process fork (that is the autonomous pattern already cut).
- **ALWAYS user-approval-gated.** Even when a trigger condition is met, the process OFFERS a
  consult and waits for explicit yes — it never auto-consults. (Asymmetry with review, which CAN
  fire automatically per its config gating; a consult spends a second model's tokens on a judgment
  call, so it asks every time.)
- **Triggered by observable state, not self-assessment.** Bind to counters/checkpoints the system
  can see — N failed fix attempts on one bug, a test still red after K iterations, cad-execute's
  structural-deviation stop, cad-plan's PHASE TOO BIG, cad-debug's exhausted-hypotheses state.
  Never "the model feels stuck" (least reliable signal; the capability meant to fight thrashing
  would otherwise cause it).
- **Bounded** — one consult per dead-end unless genuinely new information appears. **Advisory
  only.** **Home:** cad-debug plus the existing decision-point checkpoints, not an always-on
  behavior. **Opportunistic:** available only if providers are wired; claude-subagent is the
  zero-dep fallback.
- Config gates it like review (a switch, plus which providers). Open: exact trigger thresholds,
  how the offer is presented, output-handling specifics.

### Provider API key storage (DECIDED 2026-07-10)
Keys are user credentials (billing), never project data - user-global, set once per machine, shared
across all Cadence projects. Never in the repo, `config.json` (it is committed), or `.planning/`.
- **Resolution order:** environment variable first (`OPENAI_API_KEY`, `GEMINI_API_KEY` - both
  providers' SDK convention; an env-set key always wins), then a single shared env file at
  `${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env` (holds both keys). Config stores only the
  *path*, never the value. Matches the prompter pattern (env file + env-takes-precedence).
- **Graceful degradation:** a missing key never blocks the spine. The `call-review-provider` seam
  reports where to set it and marks that provider unavailable - review falls back to
  `claude-subagent`, consult is simply not offered. Zero-dep promise intact.
- **Lazy** (key looked up only when a provider is actually invoked), never logged/echoed/committed.
- **No convenience setter** (edit the file), **no keychain** - a 600-perm env file is the standard
  local-dev posture, and a keychain needs an unlocked keyring that John's headless/scheduled runs
  will not have. The seam abstracts "get key for provider", so a keychain backend could slot in
  later without touching workflows, but it is not a plan item.

### Provider model selection + live detection (DECIDED 2026-07-10)
Best-fit per situation: model AND reasoning effort are configurable per trigger, per provider - not
one fixed model per provider. Review/consult want a *strong independent* reviewer, so the cost
lever is trigger frequency (gating), never a weak reviewer.
- **Per-trigger cognitive fit.** `plan` = abstract forward-reasoning (rare) -> flagship reasoner,
  high effort. `diff` = concrete detail-scan (frequent) -> cost-balanced tier, medium effort.
  `risk_surface` = security-critical (rare, blocking) -> flagship, high/xhigh. `consult` =
  generative "what would you try" (rare) -> flagship, high.
- **Within a family the lever is the reasoning-effort dial + a cost tier, NOT a code-specialized
  model** - neither OpenAI nor Gemini ships a distinct code model (verified 2026-07: Codex is a
  harness over the general flagship; coding strength lives in the flagship). So "different model
  for plan vs code" resolves to different *effort* on the flagship, optionally a cheaper tier for
  the frequent concrete work.
- **Effort is a per-call API parameter** (`reasoning.effort` none/low/medium/high/xhigh on OpenAI;
  `thinking_level` minimal/low/medium/high on Gemini) - so the external review path gets free
  per-trigger effort control that Cadence's internal SKILL.md agents cannot have (their effort is
  frontmatter-frozen). An argument the CLI path could not match.
- ⚠️ **SCOPED (2026-07-28, #64):** the corollary of that last bullet was never written down where
  the key lives, so `review.triggers.<t>.effort` read as a universal per-trigger dial while
  `fire()` delivered it on the cross-model arm only - and the shipped default
  (`reviewers: ["claude-subagent"]`, `diff.effort: medium`) put every stock install on the arm that
  drops it. Re-verified against the host docs 2026-07-28: on the Agent/Task dispatch path Cadence
  uses, `effort` is subagent-definition-only - no tool parameter, env var, or setting varies it per
  dispatch - so this is not wirable, it is scopable. It is a **cross-model key**: `claude-subagent`
  runs `cad-reviewer` at the `high` its frontmatter pins, and `fire()` now names the mismatch in one
  line rather than discarding the value silently (references/review-triggers.md steps 1 and 4;
  config.schema.json purposes say so at the point of setting). Turning it into a real per-trigger
  dial needs per-rung reviewer agent files, which is #63's proposal to land or reject - deliberately
  not half-built here.
- ⚠️ **SCOPED (2026-07-29, CFG-01):** the same treatment for the key beside it. Six `tier` keys
  survived the routing reframe untouched - `review.triggers.{plan,diff,risk_surface,phase_diff}.tier`,
  the land-time trigger's own (deleted with that trigger in v3.2.0) and
  `review.decision_review.tier` - and they read as a universal per-trigger
  model dial while only the cross-model arm can honour them: `review.providers.<name>.tiers[
  trigger.tier]` is the ONLY bridge from a trigger to a provider model id, and the
  `claude-subagent` reviewer's model comes from the routing cell instead (for
  `/cad-decision-review`, from nothing at all - that workflow never calls `route.mjs`, so its
  `cad-reviewer` arm runs at the session default at every stakes level). Deletion was REJECTED:
  it removes six keys out from under the only backend that reads them, and #75 - the issue that
  raised it - is closed not-planned. Wiring `flagship|balanced|cheap` through as
  `opus|sonnet|haiku` was REJECTED too: the cell grid owns model resolution one phase after it
  shipped, and a second model axis beside it is the indirection that grid removed. So they are
  scoped, in #64's shape - schema `purpose`, a degradation line where the value fires, a catalog
  row - and the sweep is now re-runnable rather than a one-time pass:
  `cadence-core/references/config-reach.md` carries a reach row for every schema key and
  self-verify check 9 fails a key with no row, a row naming no key, and a reach narrower than
  `universal` that the key's own `purpose` never states. Note the `SUPERSEDED (2026-07-29)` bullet
  under Model routing says "the whole `tier` vocabulary is deleted with the matrix" - that is true
  of the MODEL matrix only, and is left standing as the record it is.
- **Live detection makes model IDs non-fatal (the key robustness win).** Three layers:
  1. Live detection - after the key is set, call the provider models endpoint (OpenAI
     `GET /v1/models`, Gemini `ListModels`) to enumerate what THAT key can access. This is truth;
     anything Cadence ships is a hint, never a hard dependency. New models show up and are
     selectable even if Cadence has never heard of them.
  2. Shipped hint table - tags KNOWN model IDs with tier (flagship / balanced / cheap) and high-
     effort support. Detection intersects live list with the table: known -> auto-classified,
     unknown -> "you place it". The table is the one maintained artifact, but staleness is soft
     (unknowns fall through to manual, never error).
  3. Assignment via the ask-user seam (the "TUI decision tree"): per position, present detected +
     classified candidates with a recommended default. Two modes: "you decide" (auto-map via the
     best-fit logic, then accept-all or drill in - the low-friction default) and full manual.
- **Runs** at provider setup (`cad-config`), re-runnable on demand, and trouble-triggered (a
  model-not-found/deprecated review failure offers re-detect-and-reassign). Degrades: if detection
  fails (offline/bad key/rate limit), fall back to shipped default IDs or manual entry - never
  block setup on a network call.
- Snapshot of current lineups (2026-07, superseded by detection at runtime): OpenAI GPT-5.6 family
  (Sol flagship / Terra balanced / Luna cheap) + GPT-5.5; Gemini 3.1 Pro / 3.1 Flash / 3.5 Flash.
  Exact API id strings are never hardcoded - detection provides them.
- **Step-5 build items:** models-endpoint detection per provider, the classification hint table,
  and the per-position assignment flow in cad-config.

### Model routing = minimal canned profiles + optional auto (the standout feature)
- Whole GSD model-routing family (`model_profile`, `model_policy.*`, per-agent overrides,
  `models.*`, `granularities.*`) → collapsed to **three canned profiles + an `auto` mode**.
- Profiles map each agent **tier** (light/standard/heavy, keyed off known agent role) → (model, effort):
  low / balanced / quality.
- **`auto`**: orchestrator reads the agent's role (reliable) + difficulty signals (heuristic:
  phase size, file count, ambiguity, prior failure) → picks tier, bumps ≤1 tier, capped at
  `auto.ceiling`. Adapts GSD's existing `dynamic_routing` (escalate_on_failure, max_escalations).
- **Guardrails:** role floors/ceilings (formatters stay cheap), hard ceiling, fan-out effort cap,
  escalate-only-on-failure bounded by max_escalations, explicit user pick always wins, auto logs
  *why* it escalated.
- ✅ **VERIFIED (claude-code-guide, 2026-07-10):** **Model IS dispatch-overridable** per subagent
  invocation (resolution: env → per-invocation param → frontmatter → session). **Effort is NOT**
  dispatch-overridable in a SKILL.md system — it is definition-time frontmatter only. (The
  Agent-SDK/Workflow harness *does* expose per-call effort, but Cadence is SKILL.md-based.)
  → **Design:** MODEL is the primary auto-routing lever (native per-dispatch). EFFORT is fixed per
  agent *role* (planner=high, formatter=low; role is known so this is fine). Runtime effort
  *escalation* uses a small set of **variant agent files** for the heavy reasoners only — not
  every agent. Auto escalates model freely + swaps the rung file when needed, bounded by
  guardrails. *(As shipped, the illustrative `planner-high`/`planner-low` names here were never
  the real ones: `cad-planner`'s ladder is high/xhigh/max over `cad-planner.md`,
  `cad-planner-xhigh.md` and `cad-planner-max.md`, and six roles carry rung files rather than
  four — see `RUNG_FILES` in `cadence-core/bin/lib/rung-agent.mjs`, which is the frozen statement
  of what is on disk. Only `cad-plan-checker` has a `low` rung, as the next bullet says.)*
- ✅ **IMPLEMENTED (2026-07-10):** resolver `bin/route.mjs` + editable data `route-table.json`
  (role→tier, profile→model matrix over Claude aliases, auto signals). The spawn-agent seam
  (`references/seams.md`) resolves every dispatch through it; re-dispatch sites pass `--attempt N`
  so `auto` escalates on failure. `model.profile` gains `auto`; the one low-effort role
  (`cad-plan-checker`) escalates via variant file `cad-plan-checker-high`. Tests: `bin/route.test.mjs`
  (10, zero-dep `node:test`). Role tiers + matrix are data — edit `route-table.json`, not code.
- ⚠️ **PARTIALLY REOPENED (2026-07-19):** per-agent overrides were cut above, and this restores a
  narrow slice of them: `model.overrides.<role>` pins ONE role to ONE alias. The cut still stands
  in substance — what GSD had was a knob *family* (`model_policy.*`, `models.*`, per-agent
  granularities) that made routing unpredictable; this is a single escape hatch with the profile
  matrix still the default path and every pin reported in `reason`. Motivation was concrete: a new
  alias (`fable`) had no route to it at all, since the profiles are a capability ladder and putting
  an unranked model on a rung would assert a comparison we cannot support. A pin is the user
  asserting it instead. Guardrail: unknown alias → warning + routed model stands, never a silent
  redirect of spend. If this grows a second knob, re-read the cut before adding it.
- ⚠️ **SUPERSEDED (2026-07-28):** the single `escalate_effort_variant` key is gone, replaced by a
  declared rung ladder: `route-table.json` states `rung_order` and gives every role its own `rungs`
  array plus a key naming its escalation target, and all 13 reachable rungs exist as agent files
  (6 base at `agents/<role>.md`, 7 suffixed at `agents/<role>-<rung>.md`). The
  VERIFIED finding above is untouched — effort is still definition-time frontmatter, which is
  exactly why a rung needs a file. What changed is that the rung set is data rather than one
  hardcoded variant, so the routing layer can vary effort per role. The rungs are declared PER ROLE
  rather than as a cross product because each one costs standing context in every main-session
  prompt. Two self-verify checks bound the cost: a routable rung with no file (and a rung file no
  role declares) fails CI, and a rung file that carries behaviour of its own fails CI — the
  contract lives once, in the preloaded contract skill (#74), and a rung file may only point at it.
- ⚠️ **AXIS REPLACED (2026-07-28):** the spend axis this whole record describes is replaced by a
  stakes axis. `model.profile` over `fast`/`balanced`/`quality` becomes a bare top-level `stakes`
  key over `solo`/`shipped`/`critical` (nobody else runs this / other people run this and a break
  comes back as a bug report / a break is not a bug report), with no back-compat alias: a config
  written against the old name stops validating on the KEY and not merely on its value, which is
  the whole reason v2.0.0 is major. The `auto` mode is deleted rather than kept as a fourth value,
  because three values answer what a break costs while the fourth answered how the resolver should
  behave - the same category error one level up from the one this change exists to fix - and its
  difficulty signals go with it (`--files`, `--ambiguity`, and the table's `auto` block), having
  never been passed by a live workflow or skill. `escalate_on_failure` is promoted to
  `model.escalate_on_failure` and honoured at every stakes level, so the rung ladder above is
  reached by the shipped default rather than only under a mode nobody selected - though what each
  role escalates TO is still its own table row, and only `cad-plan-checker` names a rung above its
  base today, so the other five roles' retries hold their rung until those rows change;
  `auto.ceiling` and `max_escalations` are dropped outright, since the surviving escalation is a
  single swap to the role's escalation rung and has no second step to cap. One correction to the
  PARTIALLY REOPENED bullet: its stated reason for keeping `fable` pin-only is now stale, because
  the ranking IS established and `fable` ranks above `opus`. That decision still stands, on three
  operational facts instead. A zero-data-retention org gets a hard `400 invalid_request_error` on
  every request to it, and Cadence is a public plugin, so those are other people's orgs. Its safety
  classifiers refuse cyber-adjacent content, and Cadence reviews its own git rails, secrets
  handling and shell tokenizer. And its multi-minute turns press against the configured provider
  request timeout inside the host's Bash ceiling.
- ⚠️ **SUPERSEDED (2026-07-29):** the per-role start-rung/escalation-rung ladder and the
  `(stakes, tier)` model matrix are both replaced by three grids in `route-table.json`. A routing
  cell keys on `(stakes level, role)` and yields the whole quality bundle - `model`, the `effort`
  rung to start at, and the `retry` rung a failed attempt climbs to - while `review` keys on
  `(level, trigger)` and yields a gate, and `verify` keys on the level alone. The whole `tier`
  vocabulary is deleted with the matrix: a role's model came from a column named after
  something else, which is the indirection this removes. 18 cells read in one screen, so nothing
  is enumerated in code. Two claims above are now false and left standing as the record they are:
  the SUPERSEDED bullet's "13 reachable rungs" is 19, and its per-role rung-list shape is gone;
  the AXIS REPLACED bullet's "only `cad-plan-checker` names a rung above its base" was the defect,
  not the design - an escalation target equal to the starting rung for five of six roles meant six
  of the 13 rung files were reachable by no config and no attempt count, and the retry ladder the
  previous entry claimed to ship did not exist. Reversing that earlier decision is safe for a reason
  that did not exist when it was made: a FIXED escalation target can point BELOW what a cell set,
  which makes a retry think less while reporting an escalation, and a per-cell retry cannot. The
  direction guard moves with it - self-verify now fails a cell whose `retry` sits below its
  `effort`, cell-named, and the same walk checks every gate and every trigger name against the
  vocabulary `config.schema.json` defines, and the model and both rungs against the table's own
  `model_aliases` and `rung_order`. A config `review.triggers.<t>.gate` still WINS over the level's
  gate, with the disagreement in `warnings`: the level must not make a key the user explicitly set
  stop doing anything.
- ⚠️ **REPO SCOPE CLOSED (2026-07-29, CFG-01):** `risk.override.<surface>` shipped one phase ago
  with a documented hole in both directions, and both are closed. The resolver read the waiver off
  the MERGED config while the schema marks all eight keys `src: repo`, so one line in one
  user-global file disabled the risk floor in every repository on the machine; `mergeLayers` now
  returns the two validated layers beside the merge, `route.mjs` reads waivers from the REPO layer
  alone, and a truthy global one is IGNORED and named in `warnings` with the rule and the place it
  belongs - warned whether or not the repo layer also names that surface, because a waiver that
  vanishes without a trace is the shape this milestone closes, and NOT warned for a global
  `false`, which waives nothing and would otherwise put a line on every dispatch in every repo.
  The write face compared `file === GLOBAL_CONFIG` as strings, so
  `set --file <global-dir>/./config.json` wrote straight through the refusal; it compares by
  filesystem identity now, which closes the symlink, relative-path and trailing-slash spellings
  with it.
- ⚠️ **READ FACE CLOSED (2026-07-30, CFG-02):** the marker above left `config.mjs get` reporting a
  global-layer waiver as an effective value with nothing said, so the two read faces described one
  situation differently. `get` still returns the MERGED value - the alternative, answering
  repo-scoped keys from the repo layer alone, would make a workflow batching keys through `get`
  read a differently-scoped answer per key with no way to tell which - and it now NAMES a truthy
  global-layer `risk.override.*` in `warnings`, so the divergence closed by becoming audible rather
  than by changing what `get` returns. `mergeLayers` gained the identity check the write face got
  first: it collapses two layer paths that resolve to ONE file, reading it once, into the REPO layer
  (`layers.repo` populated, `layers.global` null), which is what keeps such a file's waiver honoured
  while ending the spurious "IGNORED ... waives nothing here", the duplicate parse warning, and a
  `source` naming a repo layer the user does not have. A collapsed file is labelled by what the
  caller addressed - `--global` says so and reads `global`; everything else reads `repo` - because
  on a collapse both paths ARE the file and deciding by spelling would restore the string compare
  this removed. `route.mjs`'s global-layer diagnostics now come from the same helpers the repo layer
  uses, so a misspelled surface or a non-boolean value is no longer told to move into a repo config
  that would refuse it too, and the eight `risk.override.*` reach rows read `repo config layer only`
  with the phrase in all eight schema `purpose` strings, which is what makes check 9 able to see the
  narrowing at all.

- ⚠️ **DISPATCH-TIME FLOOR DELETED (2026-08-11):** the two markers above record two rounds of
  closing holes in `risk.override.<surface>`, a key family whose only job was to switch OFF a
  detector. The detector itself is what was wrong. It matched ~100 common lowercase tokens against
  the paths a phase's PLAN declared and raised the WHOLE phase to `critical` on one hit, which put
  all six roles on opus at `xhigh` and turned `plan`, `phase_diff` and the land-time gate
  adjudicated at once. Measured on a transcript-recall project: `src/store/session.rs` floored phase 1 on `auth`,
  `src/store/lock.rs` and `src/ingest/mod.rs` floored phase 2 on `concurrency` and
  `untrusted_input`, and no phase of that project could ever route below `critical` - 15 of 16
  resolves ran opus, 9 of 16 at `xhigh`, against a README claim of ~27% routed down. The floor also
  clamped `model.effort.<role>`, so the user's own dial lost to a filename. Cadence already had a
  better detector for the same question: the `risk_surface` check reads the actual
  diff. Deleted: the `surfaces` block, `lib/risk-surfaces.mjs`, `riskFloor()`, the
  `floor_surfaces` trace field, the eight `risk.override.*` keys (now in `retired-keys.mjs`, so an
  existing config warns rather than breaks), and the `floor-below-required` CI arm. Kept: the
  commit-time trigger, its `blocking` gate at every level, `stakes`, the cells grid, escalation.
  `lib/route-cells.mjs`'s `surfaceIssues` narrowed to `vocabularyIssues` - the two drift checks it
  carried are about `stakes_order` and `gates`, which outlive the surfaces block.

### Name: Cadence (prefix `/cad-*`) — own identity, GSD lineage explicit
- Standalone brand; NOT `gsd-*`. Attribution unmistakable: retain GSD LICENSE + copyright + lineage
  notice, README lead line crediting GSD, NOTICE/CREDITS + lineage note.
- **SETTLED:** display/brand name = **Cadence**; skill prefix `/cad-*` (collision-free). npm `cadence`
  is taken → the scoped name is **`@crenshawdev/cadence`** if/when an npm package ships. Uber Cadence /
  Cadence Design Systems overlap is an accepted brand footnote for a personal-brand OSS tool.
- **SETTLED: GSD license = MIT** [npm @opengsd/gsd-core, repo github.com/open-gsd/gsd-core]. Cadence
  ships under MIT, retaining GSD's copyright + license text + a lineage notice. Attribution obligation
  is minimal (keep the notice).

### Git model — "commit on your branch, guard protected, never decide how you publish"
GSD's git handling is the part that most fights John's rules; Cadence rebuilds it:
- KEEP atomic conventional commits during execution (GSD's one good git part).
- CUT: auto-branching, `branching_strategy` presets, phase/milestone/quick branch templates, the
  ship→PR funnel, the complete-milestone branch-merge matrix.
- **Protected-branch guard:** if HEAD ∈ protected branches, STOP before committing and ask
  (branch first? / proceed here?). Encodes "never auto-commit on main" as a rail, not a mandate.
- **`/cad-land`** (replaces ship): report git state, ask the publish mechanism with NO preselected
  default (direct push / open MR/PR [detect GitLab vs GitHub] / tag / leave local), execute exactly that.
- Risk-surface commits trip the review subsystem `risk_surface` trigger before landing.
- Config: `git { protected_branches, on_protected: ask|refuse|allow, integration_branch,
  auto_branch, base_branch, create_tag, on_land_cleanup, auto_close }`. No templates, no
  strategy presets, no PR body sections. (An `auto_push` switch was cut 2026-07-16 for
  contradicting the then-absolute no-push rail; a *sanctioned* push later returned as the
  opt-in `auto_close` + git-publish seam — see the reversal subsection below and §7.)

### Reversal: the no-auto-push principle and the sanctioned publish seam

Two founding git principles were reversed during the v1.1.0-rc.2 cycle. Recorded here
with what changed / when / why so the design history stays honest rather than quietly
rewritten.

**R1 — "workflows never push" → opt-in `git.auto_close` + one sanctioned publish seam.**
- *What changed:* the absolute "no workflow ever pushes" founding principle was reversed.
  An opt-in `git.auto_close` (default off) now runs the whole close unattended (audit →
  tag → PR → merge → reset), and publishing flows through a single sanctioned git-publish
  subprocess seam — the one code-guarded push path Cadence uses.
- *When:* decided 2026-07-16, built through the rc.2 cycle, UAT 2026-07-17.
- *Why:* UAT item 9 falsified the "a platform merge is never a push" assumption — `gh pr
  create` cannot open a PR from a local-only branch, so an honest end-to-end close
  necessarily pushes. The absolute never-push rule made the sanctioned close mechanically
  impossible. The deeper reason is that Cadence is built for one developer working
  alone, and a solo dev is the entire review board. Every cycle I was typing the same
  manual tail by hand, open the PR, merge it, switch back to main, pull, delete the
  branch, and none of that was a decision, it was just keystrokes. `auto_close` stays
  off by default because publishing should be a choice. But once I have made that
  choice, being asked to re-make it at four separate prompts is not safety, it is
  friction wearing safety's coat. The one gate that actually matters, a surviving
  blocker or high `risk_surface` finding from this branch's own fires, still stops
  the chain cold.
- *Not reversed:* the no-preselected-default sub-principle stands. `auto_close` skips the
  publish ask entirely; it installs no default mechanism. `/cad-land`'s interactive path
  still asks with no preselected default (above). The reversal removed the *absolute*, not
  the deliberate-choice posture.

**R2 — the `isPlainPush` git-guard whitelist was added, then deleted.**
- *What changed:* a command-string whitelist (`isPlainPush`) was added to git-guard to let
  a "plain" push through, then DELETED. git-guard now carries no push exemption at all;
  publishing instead flows through the git-publish seam, which the Bash `PreToolUse` hook
  cannot see.
- *When:* added and removed during the rc.2 cycle, after four adversarial `risk_surface`
  review rounds.
- *Why:* a command-string whitelist is unwinnable — it cannot be made safe against `-c`
  config-injection, env-prefix RCE, redirect-glue, and bare-push command classes. Routing
  publish through a seam the hook never inspects retires the whole parsing-arms-race
  surface instead of trying to out-parse an attacker.
- *Note, 2026-07-27 (v1.4.0):* R2 governs the ALLOW-LIST PREDICATE only. v1.4.0 added a
  detection-side tokenizer (`cadence-core/bin/lib/shell-tokens.mjs`) that both git rails
  read, because six real push shapes — a quoted `-C` path, an `&` separator, `$(...)`,
  backticks, a subshell, an escaped `\"` — plus `bash -c "..."` were silent under the
  strip-and-split reader. This does not reverse R2: the tokenizer never lets a command
  through. It only widens what the guard NOTICES, it fails toward asking (an unresolvable
  shape carrying a `git` word asks), and the sanctioned publish still bypasses the hook
  entirely through the git-publish seam. Being wrong in a predicate is a bypass; being
  wrong here is a prompt. R2 is not an argument for deleting it.
- *Note, 2026-08-03 (v2.2.0):* the tokenizer is deleted anyway, and the note above is
  why it took a milestone longer than it should have. "Being wrong here is a prompt" is
  true and it is not the whole cost. The escape surface behind `bash -c`, `$(...)`,
  `${...}`, aliases and `ssh` is unbounded, so it billed as an open-ended review debt:
  three consecutive blocking `risk_surface` panels in one phase, each finding new holes,
  each answered with more grammar, and `git switch -f main` still silent at the end of
  it. What settled it was a measurement rather than an argument. The scan was O(K x N)
  in memory, 3.1GB at 224KB of input and a V8 abort at 280KB, inside a hook that runs on
  every Bash call and fails OPEN, so a sufficiently long command line turned the guard
  off and let the push inside it run unprompted. A widener that can be switched off by
  its own input is not widening anything. `cadence-core/bin/lib/git-segments.mjs`
  replaces 2,251 lines with eighty-five: a segment counts only when its command word is
  `git`. R2's rule finally applied to R2's own successor.

**Sequence (with R3, §7).** These reconcile with R3 — the `git.auto_push` config switch cut
2026-07-16 (§7) — as one honest sequence, not a contradiction: `auto_push` was cut for
contradicting the then-absolute "never push" rail; `auto_close` then reintroduced a
*sanctioned* push, gated behind an explicit opt-in and routed through the guarded
git-publish seam, not a free-standing config flag.

## 7. Final Cadence config.json (~110 GSD keys → 78 leaves)

The shipped default IS the spec: `cadence-core/templates/config.json`,
validated against `cadence-core/config.schema.json` (the source of truth for
keys, types, enums, defaults). A second copy here only ever drifted - the
2026-07-16 sweep found ten keys no workflow read (`mode`, `context_window`,
`workflow.{auto_advance, discuss_mode, human_verify_mode, build_command}`,
`search.*`, `git.auto_push`); they were pruned rather than wired.


**Config decisions:** model routing → minimal (3 profiles + auto); search APIs → kept optional
(off by default); granularity → kept; response_language/i18n → **cut (English v1)**. Everything in
§3's DELETE buckets (model-ID routing, multi-runtime, multi-team, cut-feature toggles, state/guard
cruft, local-server review hosts) is gone.

**Canonical shape + validation:** the block above is illustrative; the source of truth for keys,
types, enums, and defaults is `cadence-core/config.schema.json`, enforced by the `bin/config.mjs`
seam (`validate | check | set | get | keys`). `cad-config` writes only through it.
`review.reviewers[]` is the live
reviewer selector (`review.backend` was removed as dead); `review.mode` is `single|panel|adjudicated`.

**Review block shape (step 5):** each trigger picks a *gate* + a cognitive *tier*
(flagship/balanced/cheap) + *effort*, all provider-agnostic; `providers.<name>.tiers`
maps tier → a concrete detected model id, `null` until `cad-config` runs live detection and
assignment. Model IDs are never hardcoded. `key_file` stores only a path override (default:
`${XDG_CONFIG_HOME:-~/.config}/cadence/providers.env`), never a key. The provider seam is
`bin/review-provider.mjs` (zero-dep); wire shapes are pinned in `references/provider-api.md`,
soft tier hints in `references/model-hints.json`.
