# Design skeletons

The four files of a Seldon design, one block each. Fill each block and write it as its own file in the design's folder, keeping every heading, bold label and line shape.

## brief.md

```markdown
# <Title>

## Problem
<what goes wrong today>
> <the user's own words this came from>

## Solution
<what the release builds to fix it>
> <the user's own words>

## Who it serves
<who uses it>
> <the user's own words>

## What's different
<what it does that what they use now doesn't>
> <the user's own words>

## Success criteria
- <one thing you could check when the release is done>
  > <the user's own words>
- <another, or an inferred one> [ASSUMPTION]

## Scope
<what this release holds>
> <the user's own words>

## What it refuses
- It won't <what it won't do>, because <why>.
  > <the user's own words>

## Vision
<where it goes after this release> [ASSUMPTION]
```

## prd.md

```markdown
# <Title> - PRD

## Requirements

### <Category>
- **<PREFIX>-01**: <one thing it does, on one line>
  > <the user's own words>
- **<PREFIX>-02**: <one more> [ASSUMPTION]

## Non-functional requirements
- **<NFR>-01**: <how well it does it, on one line> [ASSUMPTION]

## User journeys
<one person going through the release from start to end>

## Non-goals
- It won't <what it won't do>, because <why>.
  > <the user's own words>

## MVP scope
<the requirement IDs the release needs first>
```

## spine.md

```markdown
# <Title> - architecture spine

## S-01: <a decision two parts built apart would clash on>
Kind: <stack | hosting | design approach | boundaries | how state changes | who owns shared data>
<the decision>
> <the user's own words>
```

## epics.md

```markdown
# <Title> - epics

## E-01: <name>
**Outcome:** <what a user has when the epic is done>
**Boundaries:** <what it holds and what it leaves to other epics>
**Done when:**
- <one thing you could check>
- Everything built so far, this epic included, works end to end, with every test passing and nothing half-built showing.
**Depends on:** None
**Requirements:** <PREFIX>-01, <PREFIX>-02
**Spine decisions:** S-01
```
