# Cadence process flows

Code-accurate flowcharts for Cadence's runtime: the static architecture, the
lifecycle loop, the three decision cores that took more than one try to get
right, and one loop iteration drawn as swim lanes. Every node traces to a real
file. Render on GitHub or any Mermaid viewer.

Legend for the whole document:

- **Skill** = a `/cad-*` command (`skills/<name>/SKILL.md`) that runs a procedure in `cadence-core/workflows/<name>.md`.
- **Agent** = a fresh-context subagent (`agents/cad-*.md`), dispatched through the spawn-agent seam.
- **Seam/script** = a `cadence-core/bin/*.mjs` file; decision cores are the pure `lib/*-decision.mjs` functions.
- **State** = a file under `.planning/`.

---

## 1. System flowchart — static architecture

Who talks to whom. The main session stays lean; heavy reading happens in routed
subagents that hand back a short answer. State lives on disk, not in the chat.

```mermaid
flowchart TB
    U([User]) -->|/cad-* command| ORCH

    subgraph MAIN["Main session (your model, your effort — stays lean)"]
        ORCH["Orchestrator<br/>reads its own cached prefix"]
        SK["Skill layer<br/>skills/*/SKILL.md<br/>+ cadence-core/workflows/*.md"]
        SEAM["Spawn-agent seam<br/>references/seams.md"]
        ORCH --> SK --> SEAM
    end

    subgraph ROUTE["Routing (data + logic)"]
        RT["route.mjs<br/>resolve model + effort"]
        RTAB[("route-table.json<br/>roles · profiles · auto")]
        RT -.reads.-> RTAB
    end
    SEAM -->|role, profile, attempt| RT

    subgraph AGENTS["Fresh-context subagents (heavy reading, short answers)"]
        PL["cad-planner"]
        PC["cad-plan-checker<br/>(+ -high variant)"]
        EX["cad-executor"]
        VF["cad-verifier"]
        RV["cad-reviewer"]
        AA["cad-assumptions-analyzer"]
    end
    RT -->|dispatch on resolved alias| AGENTS

    subgraph CORE["cadence-core/bin — thin seams over pure cores"]
        PLAN["planning.mjs<br/>status · cursor · phase-done<br/>uat · audit · plan-overlap · recall · renumber"]
        CFG["config.mjs<br/>validate + read config"]
        RVP["review-provider.mjs<br/>the ONLY provider HTTPS call"]
        GP["git-publish.mjs<br/>sanctioned push seam (argv, no shell)"]
        LC["land-cleanup.mjs / release-bump.mjs"]
        DEC["lib/*-decision.mjs<br/>branch · publish · close · release<br/>(pure, unit-tested)"]
    end
    SK --> PLAN
    SK --> CFG
    SEAM --> RVP
    GP --> DEC
    LC --> DEC

    subgraph HOOK["Hook (PreToolUse: Bash)"]
        GG["git-guard.mjs<br/>every git push stops and asks"]
    end
    ORCH -.every Bash git push.-> GG

    subgraph DISK[".planning/ — state on disk (survives /clear)"]
        PROJ["PROJECT.md"]
        REQ["REQUIREMENTS.md"]
        ROAD["ROADMAP.md"]
        STATE["STATE.md<br/>(4-line cursor, overwritten)"]
        CAP["CAPTURE.md"]
        PH["phases/&lt;N&gt;/<br/>CONTEXT · PLAN · SUMMARY · UAT"]
    end
    AGENTS -->|read + write artifacts| DISK
    PLAN -->|derive status from files + git| DISK

    subgraph EXT["External review providers (optional)"]
        OAI["OpenAI"]
        GEM["Gemini"]
    end
    RVP -->|structured output enforced| EXT
    RVP -. no key: fall back to cad-reviewer .-> RV

    GIT[("git repo<br/>atomic conventional commits = the log")]
    EX --> GIT
    GP --> GIT
    GG -.gates.-> GIT
```

---

## 2. Program flowchart — the lifecycle loop

The spine: `discuss → plan → execute → verify → ship`, one phase at a time, plus
the off-ramps (`pause/resume`, `undo`, `spike`, `task`, `capture`). `/clear`
between any two steps loses nothing — the next command rebuilds from `.planning/`.

```mermaid
flowchart TD
    START([New or existing project]) --> NP["/cad-new-project<br/>PROJECT · REQUIREMENTS · ROADMAP · STATE"]
    NP --> PROG

    PROG{"/cad-progress<br/>where do we stand?"}
    PROG -->|incomplete work found| RESUME[auto-resume]
    PROG -->|next phase| CTX

    CTX["/cad-context &lt;phase&gt;<br/>locked decisions + acceptance criteria<br/>(spawns cad-assumptions-analyzer)"]
    CTX --> PLAN

    PLAN["/cad-plan &lt;phase&gt;<br/>spawn cad-planner → PLAN.md"]
    PLAN --> PCHECK{"plan_check gate?<br/>cad-plan-checker"}
    PCHECK -->|BLOCKER| PLANREV["revise once<br/>(fresh cad-planner)"]
    PLANREV --> PCHECK
    PCHECK -->|too big| SPLIT["PHASE TOO BIG<br/>→ /cad-phase split"]
    PCHECK -->|pass| PREVIEW{"plan trigger:<br/>cad-plan-review"}
    PREVIEW -->|findings block| PLANREV
    PREVIEW -->|clear| EXEC

    EXEC["/cad-execute &lt;phase&gt;<br/>cad-executor: atomic commit per task<br/>(diff / risk_surface review triggers fire)"]
    EXEC --> VERIFY

    VERIFY["/cad-verify &lt;phase&gt;<br/>cad-verifier: Exists→Substantive→Wired→Behaves"]
    VERIFY --> VVERDICT{verdict}
    VVERDICT -->|gaps| PLAN
    VVERDICT -->|needs_human| UAT["conversational UAT<br/>checklist survives /clear"]
    UAT --> VVERDICT
    VVERDICT -->|delivered| MORE{more phases?}

    MORE -->|yes| PROG
    MORE -->|milestone done| MILE["/cad-milestone<br/>audit → tag → prune roadmap → evolve docs"]
    MILE --> LAND["/cad-land<br/>publish: push / PR·MR / tag / leave local<br/>(no preselected default)"]
    LAND --> DONE([Shipped])

    %% off-ramps
    subgraph OFF["Off-ramps (any time)"]
        PAUSE["/cad-pause → WIP commit + resume pointer"]
        UNDO["/cad-undo → revert a phase's commits"]
        SPIKE["/cad-spike → time-boxed throwaway experiment"]
        TASK["/cad-task → small off-roadmap change"]
        CAPTURE["/cad-capture → phase-linked todo / idea"]
    end
    PROG -.-> OFF
    PAUSE -.resume.-> PROG
    UNDO -.-> PLAN
```

---

## 3. Decision flowcharts — the three cores

### 3a. Model routing + escalation (`route.mjs` over `route-table.json`)

Model is a live lever; effort is frozen in agent frontmatter. `auto` bumps tier
at most one step on difficulty, and escalates the *profile* only upward on a
failed attempt, bounded by a ceiling. Your explicit pick always wins.

```mermaid
flowchart TD
    IN([Seam needs an agent:<br/>role, attempt, phase signals]) --> EXPL{explicit model<br/>override?}
    EXPL -->|yes| WIN["use it — user pick wins"] --> OUT
    EXPL -->|no| PROF{profile}

    PROF -->|fast/balanced/quality| FIXED["resolve tier from role<br/>(role tier = floor)"]
    PROF -->|auto| AUTO["base_profile = balanced<br/>resolve tier from role"]

    AUTO --> BUMP{"difficulty signals?<br/>files ≥ 15  OR  ambiguity ≥ 0.6"}
    BUMP -->|yes| B1["+1 tier (capped at +1)"]
    BUMP -->|no| B0["no bump"]
    B1 --> ESC
    B0 --> ESC

    ESC{"prior attempt failed<br/>AND escalate_on_failure?"}
    ESC -->|yes| E1["raise profile toward ceiling<br/>(only ever raises;<br/>bounded by max_escalations)"]
    ESC -->|no| E0["keep profile"]
    E1 --> EFF
    E0 --> EFF

    FIXED --> EFF
    EFF{"low-effort role failed?<br/>(cad-plan-checker)"}
    EFF -->|yes| SWAP["swap to escalate_effort_variant<br/>cad-plan-checker-high<br/>(same model, harder reasoning)"]
    EFF -->|no| KEEP["keep base agent file"]
    SWAP --> RESOLVE
    KEEP --> RESOLVE

    RESOLVE["resolve alias from profiles matrix<br/>haiku / sonnet / opus / fable<br/>(aliases, never dated ids)"] --> OUT([dispatch])
```

### 3b. Review gate (per trigger, adjudicated)

Review is a pure function: artifact in, structured findings out. Cadence subagent
and external providers emit the *same* schema so the adjudicator merges them
blind. The main model kills false positives.

```mermaid
flowchart TD
    TRIG([Trigger fires:<br/>plan · diff · risk_surface · phase_diff]) --> GATE{gate on<br/>for this trigger?}
    GATE -->|off| SKIP([skip — proceed])
    GATE -->|on| WHO["select reviewers:<br/>claude-subagent · openai · gemini"]

    WHO --> KEY{provider key<br/>present?}
    KEY -->|no| FALL["fall back to cad-reviewer<br/>(never crashes the spine)"]
    KEY -->|yes| MODE{review.mode}
    FALL --> MODE

    MODE -->|single| ONE["one reviewer REFUTES"]
    MODE -->|panel| MANY["N reviewers REFUTE in parallel"]
    MODE -->|adjudicated| MANY

    ONE --> FIND["findings in shared schema:<br/>file · line · severity · claim · failure_scenario"]
    MANY --> FIND

    FIND --> ADJ["adjudicator = main model:<br/>ground each finding, kill false positives"]
    ADJ --> SEV{surviving<br/>BLOCKER?}
    SEV -->|yes| STOP([stop — fix before proceeding])
    SEV -->|no| GO([proceed])
```

### 3c. Git publish / close (`git-guard` hook + `*-decision` cores)

Two paths to git. Everything the Bash hook can see stops and asks. The one
sanctioned auto-close push happens in a subprocess seam the hook cannot see,
gated by a pure refuse-function — never by out-parsing a shell string.

```mermaid
flowchart TD
    subgraph P1["Path A — any model-issued git push"]
        A1([model runs `git push` via Bash]) --> A2["PreToolUse hook<br/>git-guard.mjs"]
        A2 --> A3{unconditional}
        A3 --> A4([STOP — ask the user<br/>no parser, no exception])
    end

    subgraph P2["Path B — sanctioned auto-close publish"]
        B1([/cad-land with auto_close]) --> B2["git-publish.mjs<br/>(argv vector, no shell string, -- separator)"]
        B2 --> B3{"publish-decision (pure):<br/>auto_close enabled<br/>AND HEAD non-protected?"}
        B3 -->|no| B4([refuse])
        B3 -->|yes| B5["single push — the only one<br/>the Bash hook never sees"]
    end

    subgraph DEC["Supporting pure decisions (lib/*-decision.mjs)"]
        D1["branch-decision<br/>auto_branch · on_protected"]
        D2["close-decision<br/>how to publish finished work"]
        D3["release-decision<br/>tag / bump when the project tags"]
    end
    B1 -.-> DEC
```

---

## 4. Swim lanes — one loop iteration (plan → execute → verify)

Where control and token cost actually move across a single phase. Note the
pattern: the orchestrator dispatches and adjudicates but never does the heavy
reading; subagents burn tokens in fresh contexts and hand back short answers;
`.planning/` is the hand-off medium, so a `/clear` between lanes is free.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Orch as Orchestrator<br/>(main session)
    participant Core as cadence-core<br/>(scripts + hook)
    participant Sub as Subagents<br/>(fresh context)
    participant Disk as .planning/<br/>(disk)
    participant Prov as Review<br/>providers

    User->>Orch: /cad-plan <phase>
    Orch->>Core: route.mjs — resolve model+effort for cad-planner
    Core-->>Orch: alias + agent file
    Orch->>Sub: dispatch cad-planner (goal-backward)
    Sub->>Disk: read CONTEXT/REQUIREMENTS/ROADMAP
    Sub-->>Orch: short answer
    Sub->>Disk: write PLAN.md
    Orch->>Sub: dispatch cad-plan-checker (cheap gate)
    Sub-->>Orch: pass / BLOCKER
    opt plan trigger on
        Orch->>Prov: cad-plan-review (REFUTE, shared schema)
        Prov-->>Orch: findings
        Orch->>Orch: adjudicate, kill false positives
    end
    Note over User,Disk: /clear here loses nothing — PLAN.md is on disk

    User->>Orch: /cad-execute <phase>
    Orch->>Sub: dispatch cad-executor
    loop each task
        Sub->>Sub: implement → predict Verify output → run it
        Sub->>Core: git commit (atomic, conventional)
        Core-->>Sub: committed
    end
    Sub->>Disk: write SUMMARY.md (commit manifest)
    Sub-->>Orch: report + deviations

    User->>Orch: /cad-verify <phase>
    Orch->>Sub: dispatch cad-verifier (read-only)
    Sub->>Disk: check Exists→Substantive→Wired→Behaves
    Sub-->>Orch: gaps | needs_human | delivered
    alt needs_human
        Orch->>User: UAT checklist (survives /clear)
        User-->>Orch: confirmations
    end
    Orch->>Disk: write UAT.md, advance STATE cursor
    Orch-->>User: phase delivered
```

---

*Traceability: routing → `cadence-core/bin/route.mjs` + `route-table.json`;
review → `review-provider.mjs` + `agents/cad-reviewer.md` + `config.schema.json`
`review.*`; git → `bin/git-guard.mjs`, `bin/git-publish.mjs`, `bin/lib/*-decision.mjs`;
state → `bin/planning.mjs` + `templates/`; hook → `hooks/hooks.json`.*
