# Portability seam: ask-user

## Seam: ask-user

How a workflow asks the human a question and blocks on the answer.

**Claude Code binding:**
- Push first: before either arm below blocks - the `AskUserQuestion` call or
  the open-ended question that ends the turn - send one `PushNotification`,
  loading it by name first when the host lists it as deferred. The message is
  one line under 200 characters, no markdown, naming the command, the phase (the
  position line where the workflow has one) and what the user needs to answer.
  One push per question, sent by the session that asks. A host without the
  tool, or one that cannot load it, skips the push and still asks.
- Structured choice: the `AskUserQuestion` tool, at most four options per
  question and at most four questions per call, with `multiSelect: true` when
  more than one option may be picked. A larger set splits across questions,
  counting any always-present option such as NONE against the cap. Independent
  questions batch into one call; only a question whose wording depends on an
  earlier answer waits for it.
- Open-ended question: end the turn with the question in plain prose.
- Never fabricate or default an answer the seam was supposed to collect.

**Recommended option.** In a structured choice, put the option the workflow
recommends first and label it `(recommended)`, except in the no-default
decisions below. The label is a display convention, never a pre-selection: the
user still chooses and the seam still blocks. Take the recommendation from
analysis the step already does - the analyzer's ranked alternatives, the
sweep's severity order, the config value in hand - and never add a pass to
produce one. With no evident best option, such as a plain confirm or equal
alternatives, keep the natural order and omit the label.

**Deliberate no-default decisions.** Present these plainly, with no recommended
option and no reordering toward one; a nudge here is a bug:
- the publish mechanism in /cad-land (push / MR or PR / tag / leave local), and
- the protected-branch guard when work would land on a protected branch
  (references/git-guard.md rail 1).
