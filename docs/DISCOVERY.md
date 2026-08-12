# Arriving with a brief

**How a project that already had the conversation enters Cadence.**

`/cad-new-project` opens with a blank page and questions its way to a
PROJECT.md. That is right when the idea is still fuzzy, and wrong when you have
already spent an evening arguing the thing out with a model and have the
argument written down. Re-asking settled questions is not rigour; it is the
second interview, and people answer it faster and worse than the first.

So there is a second way in:

1. **A freeform conversation**, with any model, in any tool. No structure, no
   template, no Cadence. Argue about what the thing is, who breaks if it does
   not exist, and what you refuse to build.
2. **A design brief** that conversation produces. Ask the model to write down
   what you settled and, separately, what you did not.
3. **`/cad-new-project --brief <file>`**. Cadence reads the brief whole, reads
   back what it understands you to have settled, invites you to correct it, and
   then asks only about what the brief leaves open.

A repo that already has code takes the other door: `/cad-adopt` derives
`.planning/` from the code and the git history instead of from a brief.

## What a good brief answers

Four things, in whatever order and whatever prose the conversation produced:

- **The problem.** What is broken or missing, concretely enough that someone
  outside the conversation can restate it.
- **The user.** Who this is for, even if that is only you. "Developers" is not
  an answer; "me, on three machines, when the session resets" is.
- **The non-goals.** What it deliberately will not do, and why. This is the
  section that earns its keep later, because it is the one the next idea argues
  with.
- **The real constraints.** The stack, the platforms, the data boundary, the
  budget, the deadline. Constraints you already accepted, not ones you would
  like.

And one thing more, which matters as much: **what is still open.** A brief that
sounds decided everywhere is a brief Cadence has nothing left to ask about, and
the questions you skipped are the ones that come back as rework in phase 3.
Write the parked hypotheses, the measurements you have not taken and the
deferrals down as what they are.

## This is guidance, not a form

There is no template here, no required headings, no schema, and no seam that
parses a brief. That is deliberate. The discovery works BECAUSE it is freeform:
the value of the conversation is in the threads you followed because they were
live, and a page that turned into a question script would destroy the thing it
is trying to document. `--brief` reads prose the way you would read it. A
section that decides something has decided it; a question it poses and does not
answer has not.

For the same reason, suppression does not key off a marker. Writing `**OPEN**`
next to a loose end helps a human reader and costs nothing, but a brief that
never writes it is not therefore settled, and Cadence does not treat it that
way.

## A worked example

`cadence-core/bin/fixtures/verbatim.design-brief.md` is a real one, committed
whole: the brief that a Rust project called verbatim arrived with, and the
measurement the rule above rests on. It is worth reading for three habits.

It **separates decided from undecided**, and says so in its second line, so a
reader knows which mode each section is in. It **states non-goals as a numbered
section of their own** rather than leaving them implied by what is absent. And
it **ends with an open-items table**: five rows, each with a status in plain
prose (a hypothesis to be gated behind evidence, a cost to be measured, two
things out of scope for 0.x, one deferred import). Those five rows are what a
`--brief` run has left to talk about, and they are also why the suppression rule
reads content rather than markers, since only one of that brief's loose ends
carries the marker its own convention describes.

It is long, at about 29 KB, and that is fine. Length is not the point; deciding
is.

## After the brief

Nothing else changes. `--brief` alters the questioning, not the artifacts: the
run still writes PROJECT.md, REQUIREMENTS.md, a phased ROADMAP.md and the
`.planning/` state, and still ends at the same approval gate. From there you are
in the ordinary loop, which `docs/WORKFLOW.md` describes.
