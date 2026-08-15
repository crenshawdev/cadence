# Roadmap

## Overview

**`v3.4.1 - what the config says is what routing does`, opened 2026-08-15.**
Scoped off the Forgejo milestone, which holds three issues: #129, #134 and
#135. No phases yet - `/cad-phase add` opens the first.

**The theme is one sentence: three surfaces describe the review gates and no
check makes them agree.** `config.mjs get` answers a gate from the schema
default when no layer set one, `config.schema.json`'s prose names a level's
gate, and `route-table.json` is what actually fires. `phase_diff` is the case
already on the floor: the schema calls it `advisory` at `shipped`, the route
table says `off`. The last cycle worked around the same defect rather than
fixing it, and `workflows/execute.md` still carries the paragraph explaining
why it must not pre-fetch a gate through `config.mjs get`.

`self-verify.mjs` is where it closes. It fails in both directions on rung files
and routing cells, and it has never compared a trigger's schema default or its
prose to `route-table.json`, so the drift was invisible to the one check whose
job is catching exactly this.

This cycle adds no key, no flag and no command. All three requirements are
corrections to surfaces that already ship.

## Phases


## Phase Details
