# Task: a secret fence on the outbound review payload

Closes GH-167. `cadence-core/bin/review-provider.mjs:62-64` sends
`{instruction, artifact}` - raw file contents and diffs - to a third-party
provider with `max_prompt_tokens` as the only bound applied before the write.
`.planning/config.json` pins `openai` as the reviewer for every trigger, so
every plan, diff and `risk_surface` review currently sends repository contents
off the machine unfiltered.

The redaction machinery already exists and runs the WRONG WAY: `bodyExcerpt`
(`:757-773`) sanitizes INBOUND response bodies through
`lib/redact-url.mjs`'s two exports. This task points the same shared helper at
the outbound path, on the read-then-send rule the inbound path already has. No
new regex enters the tree - D-14 says a security-relevant pattern duplicated
across sites is how the copies drift.

## Task 1 - fence both paid commands before the request is built

**Files:** `cadence-core/bin/lib/redact-url.mjs`,
`cadence-core/bin/review-provider.mjs`,
`cadence-core/bin/review-provider.test.mjs`

**Action:**

- `redact-url.mjs` exports its `MARK` as `REDACTION_MARK`. The header already
  says the mark is "Fixed, so a caller can grep for it"; a caller that COUNTS
  redactions needs the same constant rather than a copy of the literal. Amend
  the "TWO exports" note so it stays true: two redactors plus the mark they
  both write.
- `review-provider.mjs` gains one `fence(s)` helper composing
  `redactCredentials(redactUrl(s))` - the header of `redact-url.mjs` states
  neither export is a superset of the other and that a caller wanting both
  composes them - returning the fenced string and how many marks it added.
- `cmdReview` fences `instruction` and `artifact`; `cmdConsult` fences
  `situation`. Both AFTER the `bad-payload` string gate and BEFORE
  `assertUnderCap`, so the cap measures what is actually sent, and the request
  is built from the fenced strings only. `detect-models` carries no payload and
  is untouched.
- The count is reported, not swallowed: `redactions: <n>` on the `ok` envelope
  and on the `provider/request` trace event, in both cases only when non-zero -
  the same shape `config_warnings` already uses on that event. A reviewer that
  saw `<redacted>` where a value was is a reviewer working from less than the
  artifact, and the record has to be able to say so.

**Verification (falsifiable):** a new `runFaked` arm plants
`OPENAI_API_KEY=sk-ant-not-a-real-key` inside the `artifact` and asserts three
things about the REQUEST the fake transport was handed: the body contains
`<redacted>`, the body does not contain `sk-ant-not-a-real-key`, and the
envelope reports `redactions: 1`. The fake's `write` currently discards the
body (`write: () => true`), so it must first record what it was handed -
without that the arm cannot fail for the right reason. A second arm sends a
credential-free artifact and asserts the wire body is byte-identical to the
input and no `redactions` field appears.

Run: `node cadence-core/bin/test.mjs review git`

## Task 2 - the seam docs say what the seam now does

**Files:** `cadence-core/references/seam-review-provider.md`,
`cadence-core/references/review-cross-model.md`

**Action:** `seam-review-provider.md:29-30` states the prompt bound as the
whole of what happens to a payload before it is sent; add the fence beside it.
`review-cross-model.md` composes the payload and tells the caller what the
seam does with it, and it currently promises nothing about secrets - it gains
the one line saying the fence is applied seam-side, so a caller does not
hand-roll a second filter.

Both files state the fence's LIMIT in the same breath, because an overstated
guarantee is worse than none: redaction is by SHAPE, never by a known-prefix
list, so a bare token carrying no credential-shaped name beside it survives -
the property `redact-url.mjs`'s own header already argues for and this task
does not reopen.

**Verification (falsifiable):** `node cadence-core/bin/test.mjs prose` green
(`prose-agreement` and `self-verify` read this tree), and
`grep -n 'fence\|redact' cadence-core/references/seam-review-provider.md`
returns the new lines.

## Outcome

Both tasks shipped, plus two the gate forced. `46022937` made the shared
redactors survive a whole artifact - they were quadratic, which never showed
while `bodyExcerpt` was the only caller handing them 4096 bytes. `94c73e8a` is
the fence itself, on both paid commands, with the `redactions` count on the
envelope and the `provider/request` event. `364be4dc` is the seam contract and
its stated limit.

Then the `risk_surface` gate fired on the range and cost two more commits.
`2499e211` closed a hang - one segment holding both a literal and a long run
still walked quadratically, 84 seconds measured - and a false zero in the
redaction count. `4a2ce02f` closed what the narrowed round found in that fix: a
scheme continues with digits, so pinning at "not preceded by a letter" left
every letter in an alternating run a legal start, 99.6 seconds measured. That
one was settled at John's direction, the gate's one round already spent.

**Deviation, authorized mid-run:** the settle could not be written at all -
`adjudication --phase 0` refused `no-phase-dir`, which is GH-227 case B, and
every remaining strike would have hit it. `f860560e` gives a task's record the
home the seam will accept, and `2d81c61e` closes the three findings the fire on
THAT range raised: a symlinked parent home followed out of the tree, `--phase 0`
falling through to a phase branch without its slug, and a `deferred record`
widening whose member the queue enumeration could never find.

One medium survives, captured as a todo: `--task` has no converse guard, so
`--phase 2 --task a-slug` still routes into the task home.

Two fires, two narrowed rounds, four `gate_pass` receipts. `risk-check status`
reports the range clear.
