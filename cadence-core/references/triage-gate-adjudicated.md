# The consequence gate: the `adjudicated` arm

The `adjudicated` gate's own text, split out of `references/triage-gate.md`.
The `override` receipt and the rules it is written under, the "Two caps, two
different numbers" paragraph its asks present under, and the
contradictory-answer re-ask stay in that file.

- **adjudicated** - the survivors are already grounded, so what remains is the
  USER's choice, not the model's. Present them as a NUMBERED list with one entry
  per survivor: severity, `file:line`, then What breaks, Why I should care, What
  is still uncertain and Your recommendation, each from the review file
  `.planning/phases/<N>/records/REVIEW-<trigger>-<discriminator>[-rN].md`, whose path you
  print where the list prints. The recommendation is advice: nothing is
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

  If the user asks
  about a number instead of answering, read that survivor's What triggers it and
  What proves it from the review file, answer, and ask again. Nothing is
  applied, committed, published or re-planned against a survivor the user did
  not name. When nothing survives, say the review RAN and adjudication killed
  everything, not a bare "no findings". A return that is not the
  `{ "findings": [...] }` object `skills/cad-reviewer-contract/SKILL.md`'s
  `<returns>` block specifies is not that state at all: the gate
  could not be evaluated - say so and ask, the same arm the `blocking` bullet
  states, and never present it as adjudication having killed everything. A
  workflow run that ran no voice, which the seam refuses as `run-no-voice`, is
  that same gate. Here
  too the test is the return's SHAPE, never a host-side stop signal. The
  NON-SURVIVORS, and every survivor the user did not name, are settled in the
  same step, by "What happens to a finding this fire will not fix" in
  `references/triage-gate-unfixed.md`.

**A `blocker` or `high` survivor ends settled.** NONE is the default, but
`buildEntries` and `issue-filing unfixed` both refuse a survived `blocker` or
`high` with none of `fix_commit`, `fix_file` or `overridden: true`, so what follows the
multi-select is stated here. These asks come after it and leave it as it is.
They are the exception to NONE first: they carry no NONE, because NONE would
leave the high unsettled, so only the four-questions-per-call cap applies. An
answer that is neither option re-asks, and the record waits.
- **Suspected**, named or not: one ask with three options - run the named
  check, fix it, or override with a reason.

  - header: "Suspected"
  - question: "The reviewer suspects this problem but hasn't proved it: {finding title}. How do you want to settle it?"
  - options:
    - "Run the check - run the check the review names, and the finding is judged again from the result"
    - "Fix it - Cadence makes the fix, and the finding is recorded with the commit that fixes it"
    - "Override it - leave it unfixed and continue, and the finding is recorded as overridden with the reason you give"

  Running the check re-rules it, and
  `review-file --mark` marks the review file (`references/review-record.md`).
  Refuted is recorded `refuted` with its counter-evidence. Proved goes to the
  two-option ask, and so does a check that settles nothing, so this cannot
  loop. It is never downgraded.
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
- **Settling**: a fix names its commit in `fix_commit`. An override writes
  `overridden: true` and carries the user's words on the `override` receipt
  in `references/triage-gate.md`. A fix that leaves no commit, because the file is one git does not
  track (a plan under an uncommitted `.planning/`), holds `fix_file` with that
  file's repo-relative path: neither a downgrade nor `overridden: true`, which
  would say the finding stood.
- **Order**: the record, its receipts and `issue-filing unfixed` wait until
  every such survivor is settled (`references/review-triggers.md` step 5).

Adjudicated does not auto-halt like `blocking`, and it is not the auto-replan
convergence loop (cut in DESIGN §6) - it grounds once and asks. Use it for the
deep, rare gates - `plan` and `phase_diff`.
