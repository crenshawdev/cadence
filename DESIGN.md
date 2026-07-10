# Cadence — Design & Fork Plan

A single-developer fork of GSD, derived from a file-backed deep-dive of all 69 skills,
34 agents, and the `gsd-core` engine (110 workflows / 94 references / 143 node scripts /
~55K lines). Per-skill analyses live in `design-notes/dd-*.md` (gitignored, local only).

Audience assumptions (John): solo dev; Rust/CLI/backend + some COSMIC/iced UI + general
scripts; NOT building AI/LLM products; already runs mem-* (primary memory), claude-mem,
Obsidian vault, Codex as a genuine second model (panel-review / codex-rescue /
codex-risk-gate), Artifact + cosmic-design for UI, rtk for tests. Claude-Code-only runtime.

---

## 1. The four structural decisions (apply once, win everywhere)

These are worth more than any per-skill cut. Each removes weight from *many* skills at once.

1. **Hard git fork — the repo is the only source.** Cadence is a plain git repo; the installed
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
integration-checker, code-reviewer/code-fixer (→ panel-review). Effort-variant files
(`planner-high`/`planner-low` etc., §6) add ~4–8 files but are variants of kept roles, not new agents.

---

## 4. Rough magnitude
- Skills: 69 → ~22 (−68%)
- Agents: 34 → ~9 roles (−74%), plus ~4–8 effort-variant files of the same roles (§6)
- The spine alone: ~5,100 workflow lines → ~900, with no loss of solo-dev value.
- Whole subsystems deleted: update/patch/pristine, CLI shim, STATE audit logs, MemPalace,
  graphify, AI track, doc-ingest, UI track, workstreams/workspace.

## 5. Open questions for John (discussion)
1. Keep structured `.planning/` STATE at all, or go lighter (git + a thin ROADMAP/SUMMARY)?
   This decides whether `health`/`forensics`/`undo`-manifest survive.  → **DECIDED: slim-cursor.**
   Canonical `.planning/` file set: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
   (~4-line cursor: phase/status/next, no audit log), `phases/<N>/{PLAN,SUMMARY,UAT}.md`.
   Nothing else — cut all derived/analytics files. (PROJECT.md + REQUIREMENTS.md stay because
   `cad-new-project` writes them and `cad-milestone`/`cad-audit` consume them.)
   `health` → ~20-line "is ROADMAP/cursor parseable".
   `forensics` → cut (self-obsoletes once worktree-waves are opt-in), handle ad hoc via git + review.
3. pause/resume → **SETTLED:** `/cad-pause` = tiny skill (WIP commit + write cursor + one-line
   "where I was"). Resume is **folded into `/cad-progress`** (already reads the cursor). One skill,
   no Stop hook to install. Optional auto-pause Stop hook can come later.
4. Name → **SETTLED: Cadence, `/cad-*`.** Install to a distinct dir so it coexists with GSD during
   migration. **SETTLED at scaffold (2026-07-10):** engine dir `~/.claude/cadence-core/`; skills/agents
   install as `cad-*` into the shared flat `~/.claude/skills/` and `~/.claude/agents/` (all verified free).
5. Distribution → **SUPERSEDED:** repo is already public; model locked in §6 Distribution
   (npm `@vintagetechie/cadence` = user install, clone = dev flow).

**ALL DESIGN DECISIONS SETTLED (2026-07-10). Ready to scaffold.**

---

## 6. Locked decisions (2026-07-10)

- **Positioning:** public distribution eventually; a trimmed **single-developer** fork of GSD,
  properly licensed. Trim anything team/multi-author.
- **Distribution model:** distributable from the start. **User install = npm** (like GSD:
  `npx @vintagetechie/cadence install`) — the package carries the tree and runs the same
  idempotent **copy** into `~/.claude` (`skills/cad-*`, `agents/cad-*.md`, `cadence-core/`);
  update = rerun at the new version. **Dev/contributor flow = clone + `./install.sh`**
  (`--dev` = per-item symlinks, local-iteration convenience ONLY — the project and skills
  never lean on symlinks). Installed tree is disposable, never edited in place; that rule is
  what lets npm-copy work with zero reapply-patches machinery (GSD ships
  `verify-reapply-patches.cjs` because its users edit the installed copy).
- **Runtime:** **Claude Code only**, one clean path resolver, no multi-host shim. But the three
  host-touchpoints — **ask-user, spawn-agent, run-external-review-CLI** — go through thin internal
  seams so a future contributor could add a runtime without rewriting workflows
  ("portability-ready seams"). We don't pay portability tax now.
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
  Code installed. **Cross-model reviewers (Codex/Gemini/custom CLI) are a configured upgrade**, not
  a requirement. Reviewer plug-ability is about *reviewer models*, not host runtimes.
- Config drives: `backend`, `mode` (single|panel|adjudicated), `reviewers[]`, `models.<cli>`,
  and per-trigger gating (`plan`, `diff`, `risk_surface` auto-detected, `pre_ship`) at
  off|advisory|blocking|adjudicated.
- **Trigger wiring (which skill fires what):** `plan` → `cad-plan`, after PLAN.md is written;
  `diff` → `cad-execute`, at plan completion (advisory by default — low-ceremony solo flow);
  `risk_surface` → `cad-execute`, at commit time when the diff matches a risk surface;
  `pre_ship` → `cad-land`, before executing the chosen publish mechanism. `cad-verify` routes
  fix requests through the subsystem rather than spawning its own fixer loop.
- **`risk_surface` detection — shipped defaults** (path/diff heuristics, configurable list):
  auth/authz/sessions · DB schema/migrations · money/billing/pricing · concurrency/async/locking ·
  destructive ops (deletes, bulk updates, drops) · secrets/crypto/keys · public API/wire
  contracts · untrusted-input parsing.
- The spine is built before the review subsystem, so the **trigger interface (a stub seam) is a
  Foundation deliverable** — spine skills call the seam from day one; the subsystem fills it in later.
- The auto-replan *convergence loop* is cut (auto-decides; against verify-before-done discipline).

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
  *escalation* uses a small set of **variant agent files** (`planner-high`/`planner-low`, etc.) for
  the ~4 heavy reasoners only — not every agent. Auto escalates model freely + swaps effort-variant
  when needed, bounded by guardrails.

### Name: Cadence (prefix `/cad-*`) — own identity, GSD lineage explicit
- Standalone brand; NOT `gsd-*`. Attribution unmistakable: retain GSD LICENSE + copyright + fork
  notice, README lead line crediting GSD, NOTICE/CREDITS + lineage note.
- **SETTLED:** display/brand name = **Cadence**; skill prefix `/cad-*` (collision-free). npm `cadence`
  is taken → publish as **`@vintagetechie/cadence`** (scoped) if/when distributed. Uber Cadence /
  Cadence Design Systems overlap is an accepted brand footnote for a personal-brand OSS tool.
- **SETTLED: GSD license = MIT** [npm @opengsd/gsd-core, repo github.com/open-gsd/gsd-core]. Cadence
  ships under MIT, retaining GSD's copyright + license text + a fork notice. Attribution obligation
  is minimal (keep the notice).

### Git model — "commit on your branch, guard protected, never decide how you publish"
GSD's git handling is the part that most fights John's rules; Cadence rebuilds it:
- KEEP atomic conventional commits during execution (GSD's one good git part).
- CUT: auto-branching, `branching_strategy` presets, phase/milestone/quick branch templates, the
  ship→PR funnel, the complete-milestone branch-merge matrix.
- **Protected-branch guard:** if HEAD ∈ protected branches, STOP before committing and ask
  (branch first? / proceed here?). Encodes "never auto-commit on main" as a rail, not a mandate.
- **Never auto-push.**
- **`/cad-land`** (replaces ship): report git state, ask the publish mechanism with NO preselected
  default (direct push / open MR/PR [detect GitLab vs GitHub] / tag / leave local), execute exactly that.
- Risk-surface commits trip the review subsystem `risk_surface` trigger before landing.
- Config: `git { protected_branches, on_protected: ask|refuse|allow, base_branch, auto_push:false,
  create_tag }`. No templates, no strategy presets, no PR body sections.

## 7. Final Cadence config.json (~110 GSD keys → ~22)

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "context_window": 1000000,
  "model": {
    "profile": "balanced",
    "auto": { "ceiling": "quality", "escalate_on_failure": true, "max_escalations": 1 }
  },
  "workflow": {
    "research": false, "plan_check": true, "verifier": true, "auto_advance": false,
    "discuss_mode": "discuss", "skip_discuss": false, "human_verify_mode": "end-of-phase",
    "subagent_timeout": 300000, "inline_plan_threshold": 3,
    "test_command": null, "build_command": null
  },
  "parallelization": {
    "enabled": false, "max_concurrent_agents": 3, "min_plans_for_parallel": 2,
    "use_worktrees": true
  },
  "git": {
    "protected_branches": ["main", "master"],
    "on_protected": "ask",
    "base_branch": null,
    "auto_push": false,
    "create_tag": true
  },
  "planning": { "commit_docs": true },
  "search": { "brave_search": false, "firecrawl": false, "exa_search": false },
  "memory": { "backend": "none" },
  "review": {
    "backend": "claude-subagent",
    "mode": "adjudicated",
    "reviewers": ["claude-subagent"],
    "models": { "codex": "codex exec {prompt}", "gemini": "gemini -p {prompt}" },
    "triggers": {
      "plan": "adjudicated", "diff": "advisory",
      "risk_surface": "blocking", "pre_ship": "adjudicated"
    }
  }
}
```

**Config decisions:** model routing → minimal (3 profiles + auto); search APIs → kept optional
(off by default); granularity → kept; response_language/i18n → **cut (English v1)**. Everything in
§3's DELETE buckets (model-ID routing, multi-runtime, multi-team, cut-feature toggles, state/guard
cruft, local-server review hosts) is gone.
