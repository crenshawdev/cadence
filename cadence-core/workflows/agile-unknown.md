# cad-agile unknown (cold branch)

Read from agile-refine.md when how an epic is cut depends on a fact nothing on
disk tells. `{id}` and `{name}` are the epic's. Ask about each unknown, through
the ask-user seam, with the one of the first two options that fits it recommended
and first:

- header: "Unknown"
- question: "{The unknown, as a question} How {id} is cut depends on it. How do you want to settle it?"
- options:
  - "Read the code - one agent reads the code it touches, and what it finds is kept. It costs extra time and tokens"
  - "Spike it - this stops here, /cad-spike answers it with a throwaway experiment, and /cad-agile picks up after it"
  - "Cut without it - the stories rest on a guess, and the list says what it is"

Every answer below is saved with agile-refine.md's `answer` call, the unknown as
the question, so a cleared session isn't offered it again.

## Read the code

One agent, for every unknown answered so. Resolve it, relay each `warnings[]`
entry to the user, then dispatch the `agent_type` and `model` it prints through
`references/seam-spawn-agent.md`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-assumptions-analyzer --phase 0 --bracket-read ".planning/agile/epics/{id}/epic.md" --bracket-plan {id}
```

```
Analyze the codebase for epic {id}: {name}. There is no roadmap here: .planning/agile/epics/{id}/epic.md takes the place of the phase's entry.

<phase_goal>{the epic's Outcome, Boundaries and Done when}</phase_goal>
<prior_decisions>{what agile-refine.md's section 1 says is settled, the spine decisions apart}</prior_decisions>
<spine_decisions>{the epic's Spine decisions, verbatim}</spine_decisions>
<search_terms>{key terms from the unknowns}</search_terms>
<unknowns>{each unknown, one to a line}</unknowns>

Settle the unknowns and nothing wider. Follow your output format exactly.
```

Close its bracket the moment it's back, with `--detail-file <path>` naming what
failed when it did:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace close --phase 0 --plan {id} --role cad-assumptions-analyzer --agent-id <the id on the subagent return> --tokens <the token count on it> --turns <the tool-call count on it> --duration-ms <the wall clock on it>
```

What it found is the answer, with the file it rests on. One it left Unclear, or
all of them when it failed, is asked again with the two options left.

## Spike it

Say "Run /cad-spike {the unknown}, then /cad-agile." and stop. Its verdict is
read by the next refinement, so nothing is saved for it here.

## Cut without it

The guess is the answer, and it's named as one under "Picked for you".
