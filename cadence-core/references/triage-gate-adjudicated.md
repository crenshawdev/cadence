# The consequence gate: the `adjudicated` arm

The `adjudicated` gate's own text. The `override` receipt and its rules, the
"Two caps, two different numbers" paragraph its asks present under, and the
contradictory-answer re-ask are in `references/triage-gate.md`.

- **adjudicated** - the survivors are already grounded, so what remains is the
  USER's choice, not the model's. Present them as a NUMBERED list with one entry
  per survivor: severity, `file:line`, then What breaks, Why I should care, What
  is still uncertain and Your recommendation, each from the review file
  `.planning/phases/<N>/records/REVIEW-<trigger>-<discriminator>[-rN].md`, whose
  path you print where the list prints. The recommendation is advice: nothing is
  preselected and no answer word is added. Then ask which to act on through
  `AskUserQuestion` with `multiSelect: true`, and END THE TURN on that question.
  NONE is the first option in every question and the default; its label reads
  "None of them". Each survivor option carries its number, severity and
  `file:line`.

  - header: "Findings"
  - question: "Which of these findings do you want to act on? Nothing is changed for a finding you don't pick."
  - options:
    - "None of them - act on none of these findings"
    - "Finding {number} - {severity}, {file and line}" - one option for each finding in this question, up to three

  If the user asks about a number instead of answering, read that survivor's
  What triggers it and What proves it from the review file, answer, and ask
  again. Nothing is applied, committed, published or re-planned against a
  survivor the user did not name. When nothing survives, say the review RAN and
  adjudication killed everything, not a bare "no findings". A return that is
  not the findings object is not that state, by the SHAPE rule in
  `references/triage-gate.md`. The NON-SURVIVORS, and every survivor the user
  did not name, are settled in the same step, by "What happens to a finding this
  fire will not fix" in `references/triage-gate-unfixed.md`.

**A `blocker` or `high` survivor ends settled.** NONE is the default, but
`buildEntries` and `issue-filing unfixed` both refuse a survived `blocker` or
`high` with none of `fix_commit`, `fix_file` or `overridden: true`, so these
asks follow the multi-select and leave its answer as it is. They carry no NONE,
because NONE would leave the high unsettled, so only the
four-questions-per-call cap applies. An answer that is neither option re-asks,
and the record waits.
- **Suspected**, named or not: one ask with three options - run the named
  check, fix it, or override with a reason.

  - header: "Suspected"
  - question: "The reviewer suspects this problem but hasn't proved it: {finding title}. How do you want to settle it?"
  - options:
    - "Run the check - run the check the review names, and the finding is judged again from the result"
    - "Fix it - Cadence makes the fix, and the finding is recorded with the commit that fixes it"
    - "Override it - leave it unfixed and continue, and the finding is recorded as overridden with the reason you give"

  Running the check re-rules it, and `review-file --mark` marks the review file
  (`references/review-record.md`). Refuted is recorded `refuted` with its
  counter-evidence. Proved goes to the two-option ask, and so does a check that
  settles nothing, so this cannot loop. It is never downgraded.
- **Proved and unnamed**: its own ask with two options - fix it, or override
  with a reason. Its question says only that the finding is open, because a
  suspected one the check settled nothing on, and a named one whose fix is not
  made, reach it too.

  - header: "Still open"
  - question: "This problem is still open: {finding title}. It has to be fixed or overridden before the review is recorded. What do you want to do?"
  - options:
    - "Fix it - Cadence makes the fix, and the finding is recorded with the commit that fixes it"
    - "Override it - leave it unfixed and continue, and the finding is recorded as overridden with the reason you give"

- **Proved and named**: no second question, since naming it is the answer, and
  the answer is to fix. One whose fix is not then made, such as `/cad-verify`'s
  Leave open or Re-plan, goes to the two-option ask.
- **Settling**: each settled survivor is recorded as `references/review-record.md`
  states.
- **Order**: the record, its receipts and `issue-filing unfixed` wait until
  every such survivor is settled (`references/review-triggers.md` step 5).

Adjudicated does not auto-halt like `blocking`, and it is not an auto-replan
convergence loop - it grounds once and asks. As a configured gate, use it for
the deep, rare triggers - `plan` and `phase_diff`. `/cad-verify`'s fire takes
this arm whatever the setting.
