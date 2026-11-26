# cad-agile design (no design given)

Read from agile.md when no release is open and no `--brief` came. It asks what
the release is, writes the answers as a design in Seldon's four-file format,
and starts from that design as `--brief` does. Nothing is written until the
user says yes to the draft.

## 1. Ask

One message, every question at once, numbered, in plain prose:

1. What is it, and what problem does it solve? Give it a short name.
2. Who is it for?
3. What makes it different from what they use now?
4. When is this release done? A few things you could check.
5. What's in this release, and what won't it do, and why?
6. What must it be built with, and where does it run? "Nothing decided yet" is an answer.

The turn ends there. Nothing is written.

## 2. Draft

Read the four skeletons in one turn:
`${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/design/brief.md`, `prd.md`,
`spine.md` and `epics.md`. Fill them from the answers alone, keeping every
heading, bold label and line shape as the skeleton has it.

- An item the user said carries their own words on a `> ` line under it,
  indented under a bullet. One you infer carries `[ASSUMPTION]` right after
  its text instead, and only in free text: never on a heading, a `Kind:` line,
  a bold label, an ID list or a refusal.
- A refusal is `- It won't <what>, because <why>.`, the same in the brief's
  `## What it refuses` and the PRD's `## Non-goals`. When the user said it
  refuses nothing, both hold their words on one `> ` line and no bullet.
- A requirement ID is a prefix of 2 to 8 capitals, a dash and two digits,
  from `01`. After a closed release, number each prefix past the highest it
  used; the check below names any reused one.
- The spine holds the decisions two parts built apart would clash on, at
  least one. Each `stack` or `hosting` answer is one, and "nothing decided"
  leaves those to a `design approach` decision you infer.
- Epics go in build order, each needing only earlier ones, with 1 to 5
  requirement IDs, 2 to 5 Done when items, one of them the skeleton's last
  line word for word, and every requirement on exactly one epic.

Then ask where it goes, with the short name in single quotes, asked again if
it holds one:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" design-folder --title '<the short name>'
```

On `ok:false` print `detail` and `hint`, one line each, and stop.

Show in one message the folder, each epic with its requirements' IDs and
text, and every `[ASSUMPTION]`, then ask:

- header: "Design"
- question: "Write this design and start the release from it?"
- options:
  - "Write it - the four files go in {folder}, and the start asks its setup next"
  - "Change it - you say what, and the draft is shown again"
  - "Stop - nothing is written"

## 3. Write

On "Write it", run the same `design-folder` line again, since the folder can
be taken since; on `ok:false` stop as above. Write the four files there with
the Write tool, then:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/agile.mjs" check --design '<folder>'
```

On `design-refused`, fix each of `issues` in the files and check again, at
most twice. Still refused, print each issue and stop: the design stays, and
`/cad-agile --brief '<folder>'` starts from it once they're fixed. Any other
`ok:false`: print `detail` and `hint` and stop.

On `ok:true`, Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/agile-start.md`
and follow it with `<folder>` as the design, then go to agile.md's `commit`.
The design isn't committed, as on `--brief`.
