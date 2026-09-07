# Cadence 4.0 — the whole system on one page

The living picture of how Cadence is put together. When the design changes, this
changes with it. Module-level and workflow diagrams live beside this file, and
only for components that are actually built.

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "background": "#0a0a0a",
    "fontFamily": "ui-sans-serif, system-ui, sans-serif",
    "fontSize": "14px",
    "primaryColor": "#1b1b1b",
    "primaryTextColor": "#e2e2e2",
    "primaryBorderColor": "#474747",
    "lineColor": "#7c94aa",
    "textColor": "#e2e2e2",
    "clusterBkg": "#141414",
    "clusterBorder": "#303030",
    "edgeLabelBackground": "#0a0a0a",
    "titleColor": "#7c94aa"
  }
}}%%
flowchart TB
    Human([Human])

    subgraph session["Claude Code session"]
        skills["21 cad- command skills<br/>markdown"]
        agents["6 subagent roles<br/>planner · executor · verifier<br/>reviewer · checker · analyst"]
        guard["git-guard hook"]
    end

    subgraph binary["cadence binary — one resident process per session"]
        tools["MCP tool surface<br/>typed calls, typed refusals"]
        domain["derivation · evidence · next action<br/>pause · recall · config · review"]
        store["store<br/>single writer, transactional"]
    end

    subgraph repo["the repository"]
        planning[".planning/<br/>items · decisions · state · phase docs"]
        source["project source"]
        history[("git history")]
    end

    forge["forge<br/>GitHub · Forgejo"]
    models["review models"]

    Human -->|"a cad- command"| skills
    skills -->|"ask, then submit"| tools
    tools --> domain
    domain --> store
    store -->|"the only writer"| planning
    domain -->|"reads"| planning
    domain -->|"reads"| history

    skills -->|"dispatch the binary's prompt"| agents
    agents -->|"engineering work"| source
    agents -->|"one commit per task"| history
    guard -.->|"allow or deny"| agents

    domain --> forge
    domain --> models

    classDef person fill:#1b1b1b,stroke:#7c94aa,stroke-width:1.5px,color:#e2e2e2
    classDef host fill:#1b1b1b,stroke:#474747,color:#e2e2e2
    classDef core fill:#10222e,stroke:#1793d1,stroke-width:1.5px,color:#a1c0eb
    classDef writer fill:#122c3a,stroke:#4aa5cd,stroke-width:2px,color:#cfe6f2
    classDef disk fill:#1b1b1b,stroke:#5e5e5e,color:#c6c6c6
    classDef outside fill:#141414,stroke:#474747,color:#919191

    class Human person
    class skills,agents,guard host
    class tools,domain core
    class store writer
    class planning,source,history disk
    class forge,models outside

    style session fill:#141414,stroke:#303030,color:#7c94aa
    style binary fill:#0d1a22,stroke:#1793d1,color:#4aa5cd
    style repo fill:#141414,stroke:#303030,color:#7c94aa

    linkStyle 4 stroke:#4aa5cd,stroke-width:2px,color:#a1c0eb
    linkStyle 10 stroke:#7c94aa,color:#c6c6c6
```

## What the picture says

**A human talks to skills. Skills talk to the binary. Only the binary writes.**

The skills are markdown and hold no logic worth the name: they ask the binary
what is next, hand that answer to a subagent, and give the subagent's result
back. Every decision that is a function of disk, git and config is the binary's.
Every decision that needs reading code or prose for meaning is the model's.

The subagents do the engineering. They read and change the project's source and
they make the commits, because that is judgment work and always was. What they
cannot do is write Cadence's own state: that goes back through the tool surface
as a typed patch the binary validates.

`.planning/` is the store and the store has one writer. `git history` is not a
side effect, it is where truth about what happened lives, which is why the
binary reads it rather than trusting anyone's report.

The dotted line is the one piece that decides without being asked: `git-guard`
sits in front of a subagent's own git commands and answers allow or deny.
