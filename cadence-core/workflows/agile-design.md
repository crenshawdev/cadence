# cad-agile design (no design given)

Read from agile.md when no release is open and no `--brief` came. It asks what
the release is, writes the answers as a design in Seldon's four-file format,
and starts from that design as `--brief` does. Nothing is written until the
user says yes to the draft.

## 1. A design already there

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" design-folder
```

On `ok:false` print `detail` and `hint`, one line each, and stop. When
`waiting` lists a design no release has started from, ask, with one option per
waiting design and no option recommended:

- header: "Design"
- question: "A design no release has started from is already here. Start from it, or write a new one?"
- options:
  - "Start from {title} - in {folder}, and the start asks its setup next"
  - "Write a new one - the six questions follow, and that design stays where it is"

On a start, Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-start.md`
and follow it with that folder as the design. With none waiting, or on a new
one, go on.

## 2. Ask

One message, every question at once, numbered, in plain prose:

1. What is it, and what problem does it solve? Give it a short name.
2. Who is it for?
3. What makes it different from what they use now?
4. When is this release done? A few things you could check.
5. What's in this release, and what won't it do, and why?
6. What must it be built with, and where does it run? "Nothing decided yet" is an answer.

The turn ends there. Nothing is written.

## 3. Draft

Ask where the design goes, with the short name in single quotes, asked again
if it holds one; on `ok:false` print `detail` and `hint` and stop:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" design-folder --title '<the short name>'
```

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/design.md`, which holds
the four skeletons, one block per file. Fill them from the answers alone,
keeping every heading, bold label and line shape as the skeleton has it.

- An item the user said carries their own words on a `> ` line under it,
  indented under a bullet. A PRD or spine quote repeats a brief `> ` line, or
  an unbroken run of one, word for word. One you infer carries `[ASSUMPTION]`
  right after its text instead, and only in free text: never on a heading, a
  `Kind:` line, a bold label, an ID list or a refusal.
- A refusal is `- It won't <what>, because <why>.`, the same in the brief's
  `## What it refuses` and the PRD's `## Non-goals`, with the user's reason. A
  refusal they gave no reason for is asked about with the draft, never
  guessed. When they said it refuses nothing, both hold their words on one
  `> ` line and no bullet.
- A requirement ID is a prefix of 2 to 8 capitals, a dash and two or more
  digits. Each prefix starts past its ID in `earlier`, or at `01`. A
  requirement in `deferred` that this release takes back keeps its ID and
  says it's taken back in the draft; no other requirement uses a deferred ID.
- The spine holds the decisions two parts built apart would clash on, at
  least one, each with one of the skeleton's six kinds. Each `stack` or
  `hosting` answer is one, and "nothing decided" leaves those to a `design
  approach` decision you infer.
- Epics go in build order, those carrying the MVP scope first, each needing
  only earlier ones, with 1 to 5 requirement IDs, 2 to 5 Done when items, one
  of them the skeleton's last line word for word, and every requirement on
  exactly one epic.

Show in one message the folder, each epic with its requirements' IDs and
text, every requirement taken back, every `[ASSUMPTION]` and any refusal
missing its reason, then ask:

- header: "Design"
- question: "Write this design and start the release from it?"
- options:
  - "Write it - the four files go in {folder}, and the start asks its setup next"
  - "Change it - you say what, and the draft is shown again"
  - "Stop - nothing is written"

On "Change it", take what the user says, redraft, ask `design-folder` again
with the short name the draft now has, and show the draft and this question
again. On "Stop", the run ends with nothing written and no commit.

## 4. Write

On "Write it", run the last `design-folder` line again, since the folder can
be taken since; on `ok:false` stop as above. Write the four files there with
the Write tool, then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" check --design '<folder>'
```

On `design-refused`, fix each of `issues` in the files, and on
`requirement-ids-used` give each ID it names the next number past the ones its
hint lists, then check again, at most twice in all. Still refused, print the
problems and stop: the design stays, and the next `/cad-agile` offers it, or
`/cad-agile --brief '<folder>'` starts from it once they're fixed. Any other
`ok:false`: print `detail` and `hint` and stop.

On `ok:true`, Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-start.md`
and follow it with `<folder>` as the design.
The design isn't committed, as on `--brief`.
