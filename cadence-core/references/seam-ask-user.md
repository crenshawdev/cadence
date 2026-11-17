# Portability seam: ask-user

## Seam: ask-user

How a workflow asks the human a question and blocks on the answer.

**Claude Code binding:**
- Push first: before either arm below blocks - the `AskUserQuestion` call or
  the open-ended question that ends the turn - send one `PushNotification`,
  loading it by name first when the host lists it as deferred. The message is
  one line under 200 characters, no markdown, naming the command, the phase (the
  position line where the workflow has one, as `/cad-execute` does) and what the
  user needs to answer. One push per question, sent by the session that asks.
  The host decides delivery, skipping it when the user is at the terminal, when
  notifications are off or when there is nowhere to send it. A host without the
  tool, or one that cannot load it, skips the push and asks as before: the
  question is never held back by it.
- Structured choice: the `AskUserQuestion` tool, at most four options per
  question, and `multiSelect: true` when more than one option may be picked. A
  set larger than the option cap splits across questions - minus any
  always-present option such as NONE, which consumes a slot - and the questions
  batch at most four per call. Two caps, not one: options per question, and
  questions per call. Independent questions batch the same way, never one
  blocking turn each; only a question whose wording depends on an earlier answer
  stays sequential.
- Open-ended question: end the turn with the question in plain prose.
- Never fabricate or default an answer the seam was supposed to collect.

**Recommended option.** For a structured choice, put the option the workflow
recommends FIRST and label it `(recommended)` - unless the choice is one of the
deliberate no-default decisions below. This is a display convention (a nudge),
never a pre-selection: the user still chooses and the seam still blocks.

No research tax: the recommendation must fall out of analysis the step ALREADY
does - the analyzer's ranked alternatives, the sweep's severity order, the
config value in hand. Never add a reasoning or research pass just to produce
one. When no best option is already evident - a plain confirm ("Yes" /
"Correct some"), or genuinely equal alternatives - order them naturally and
omit the label rather than inventing a recommendation.

**Deliberate no-default decisions (never mark a recommendation).** A few choices
are consequential either/ors the tool must not steer: present them plainly, no
recommended option, no reordering toward one -
- the publish mechanism in /cad-land (push / MR or PR / tag / leave local), and
- the protected-branch guard when work would land on a protected branch
  (references/git-guard.md rail 1).
These stay undefaulted by design; a nudge there is a bug, not a convenience.
