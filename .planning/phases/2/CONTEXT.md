# Phase 2: The adjudication record nobody can recount - Context

Gathered: 2026-08-19
Feeds: /cad-plan 2

## Scope boundary

In: A gate fire's per-finding rulings become a committed, recomputable record.
Concretely: a new validating `planning.mjs` subcommand taking a payload file and
its `arg-contract.mjs` `CONTRACTS` row; the record file
`.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`; three new
structured count flags on `trace append --family outcome`; the merge-step change
in `cadence-core/references/review-triggers.md` that preserves per-voice
attribution through adjudication; the Gates-line rendering change at
`cadence-core/workflows/report.md:100`; and the `weight-budgets.json` re-pin the
prose edits force.

Out: Backfilling. Earlier phases kept counters rather than bodies and the
structured data was never written for the rest, so there is nothing faithful to
reconstruct. The format takes effect from the next gate fire forward, and a
phase with no record READS as unrecorded rather than being synthesized into one.

Out: The advisory arm. `review-triggers.md:150-170` has the REVIEWER write the
findings file and close its own bracket, and the orchestrator's session may end
before the return lands - nothing is positioned to rule, so no record is written
and an advisory fire reads as unrecorded (which AC6 permits).

Out: Tightening `parseAdjudication` (`cadence-core/bin/lib/trace-suggest.mjs:231-248`).
Its own D-03 at `:214-216` forbids it - a tighter regex drops the historical
fires already on disk and takes R1's evidence floor with them. This phase routes
around the detail string rather than repairing it, so the 25 distinct detail
spellings and the 5-of-8 parse failure on the Verbatim record stay live.

Out: Both phase 3 surfaces. `cmdLeaseCheck`'s byte-equality exemption
(`cadence-core/bin/planning.mjs:2449`, `:2463`) and the empty-range risk-check
deadlock belong to phase 3; D-06 below is chosen specifically so this phase
never touches them.

Deferred: None.

Plan shape: multiple plans, same phase. The natural seam is the write path
(AC1-AC3 and AC5's flagging) against the read/render path (AC4's trace flags and
AC6's report change) - different files, independently verifiable. /cad-plan
decides the actual split.

## Durable decisions

- D-01 (The recount authority): Survivor, downgrade and refutation counts are
  DERIVED by counting rulings and written to the trace event through new
  structured `--survivors`/`--downgraded`/`--refuted` flags mirroring the
  existing `--raised`. The recount then compares two independent artifacts, so a
  tampered record disagrees with the trace. Rejected: making the record the sole
  authority and treating the trace `detail` as decorative, which satisfies the
  criterion but leaves nothing to cross-check it against. The roadmap's original
  criterion 4 - recompute to "the number in the gate's trace `detail`" - is
  unsatisfiable as written: running the shipped `parseAdjudication` over both
  records parses 40 of 44 adjudication events here but only 3 of 8 in
  `/code/verbatim`, and the exact string the roadmap quotes
  (`risk_surface plan-2: 6 survivors of 10 ...`) is one of the failures, because
  `plan-2` is not `re-?arm`. `--raised` is already stored structurally with a
  header stating exactly why a figure is never parsed back out of `--detail`.
  Evidence: `cadence-core/bin/lib/trace-suggest.mjs:214-216`, `:231-248`;
  `cadence-core/bin/planning.mjs:3403-3423`, `:3555`.

- D-02 (Arm scope): A record is written on the BLOCKING arm as well as the
  adjudicated one; the advisory arm is excluded. Confining it to the adjudicated
  arm would record nothing at all on this repo - `route.mjs resolve` returns
  `plan: blocking` and `risk_surface: blocking` at `shipped` stakes - and would
  exclude the roadmap's own sharpest case, which is a `gate_pass`. This
  contradicts the existing scoping sentence, which must be widened rather than
  read around. The ruling enum stays at exactly three values; no
  `unadjudicated` fourth value is admitted.
  Evidence: `cadence-core/references/review-triggers.md:316-320` (the
  adjudicated-only scoping), `:363-371` (risk_surface already persists at every
  gate), `:150-170` (why advisory cannot rule);
  `cadence-core/references/triage-gate.md:32-37` (`gate_pass` carries no
  `--raised` and no finding body).

- D-03 (The write path): The record is written by a validating seam taking a
  payload FILE, following `uat merge --payload`, and the seam DERIVES the counts
  rather than accepting them. Rejected: prose instructing a plain `Write` of
  hand-assembled JSON - `review-triggers.md:247-253` already forbids that for
  review JSON because one unescaped quote or backslash makes the payload
  unparseable, and the record's whole point is verbatim reviewer text with
  arbitrary quoting. `FINDING_SCHEMA` already exists to validate against.
  Evidence: `cadence-core/bin/review-provider.mjs:777-799`;
  `cadence-core/bin/lib/arg-contract.mjs:528-531`;
  `cadence-core/bin/planning.mjs:1143-1146`;
  `cadence-core/references/review-triggers.md:247-253`.

- D-04 (Per-voice attribution): Under a panel, one entry per finding per RAISING
  VOICE, with convergence recorded on the entry rather than collapsing two
  voices into one. Step 5 currently dedupes exact `file+line+claim` repeats and
  merges convergent findings BEFORE any ruling exists, so today's pipeline
  destroys per-voice attribution; that merge has to move. This is what makes a
  reviewer's individual hit rate countable, which is the measurable form of
  Cadence's "controls are fallible machinery" claim. Rejected: one entry per
  merged finding with a `voices[]` array - no pipeline change, but "the raising
  voice" becomes a list and per-model calibration is only derivable. Unexercised
  on this repo (single-voice reviewer set, measured) and live on any two-provider
  project.
  Evidence: `cadence-core/references/review-triggers.md:305`, `:309`.

- D-05 (A fourth file): The record subsumes neither `FINDINGS.json` nor
  `verifier-findings.json`. `FINDINGS.json` is written only by `uat merge` and
  holds counters plus the entries the merge DISCARDED, so it carries no bodies
  for findings that were kept; `verifier-findings.json` is `cad-verifier`'s
  single write and is per-TRUTH, not per-finding. Folding the record into
  `FINDINGS.json` would put it under `uat merge`'s atomic overwrite - the exact
  clobber the verifier's separate filename exists to avoid. The surface it
  genuinely overlaps is `REVIEW-<trigger>-<discriminator>.md`, which is spec'd as
  the reviewer's JSON object but is measured to be free prose in 5 of the 9
  REVIEW files across both repos.
  Evidence: `cadence-core/bin/planning.mjs:1143-1146`;
  `skills/cad-verifier-contract/SKILL.md:158-162`;
  `cadence-core/references/review-triggers.md:367`.

- D-06 (Location and identity): One record per FIRE at
  `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`, beside its
  sibling REVIEW file, using the discriminator rule that file already has
  (`plan-<k>` for a per-plan fire, `<command>-<short head sha>` otherwise) -
  never one `adjudication.json` per phase. Measured, 43 distinct `(corr, phase)`
  groups on this repo hold 77 adjudication/gate_pass events with up to 8 fires in
  a single group, so a phase-scoped filename makes the last fire erase the seven
  before it, which is exactly the destruction phase 1 fixed for reports. It does
  NOT go inside `<plandir>/reports/`: phase 1's D-03 stages that directory
  wholesale, and `cmdLeaseCheck` exempts exactly one path by byte equality, so
  anything else staged from there returns `undeclared-files`. That alternative
  collides head-on with phase 3's stated work. The `.planning/phases/*/REVIEW-*`
  location also already has carriage past the milestone prune.
  Evidence: `cadence-core/references/review-triggers.md:376-382`, `:385-388`;
  `cadence-core/bin/planning.mjs:2449`, `:2463`;
  `cadence-core/workflows/milestone.md:95-96`.

## Decisions

- D-07 (Who composes it): The ORCHESTRATOR composes the payload, not
  `review-provider.mjs` and not the `cad-reviewer` contract. It is the only actor
  holding both the raised finding bodies and the ruling: the provider returns
  `findings` on stdout and never persists them, and its only write records
  `provider/model/effort/tier/duration_ms/outcome` with no finding field -
  measured across 153 `provider/request` events on this repo, zero carry a
  finding body or count. The reviewer contract specifies a return shape only.
  Evidence: `cadence-core/references/review-triggers.md:303-314`;
  `cadence-core/bin/review-provider.mjs:512-548`, `:1134`;
  `skills/cad-reviewer-contract/SKILL.md:80-101`.

- D-08 (SHA resolution): The record resolves and stores full 40-character
  `base_id`/`head_id` itself rather than trusting the receipt. The receipt stores
  the caller's SPELLING unmodified: measured across 104 outcome receipts here, 52
  carry a `base` and only 8 are 40 characters, the other 44 being 7-char, and
  `execute.md:310` documents `--head HEAD`, which is not a SHA at all.
  `cmdRiskCheckRun` already resolves both ids on its record and its envelope and
  runs at the same site immediately before the fire, so the resolved pair is in
  hand. A planner assuming the receipt already holds full SHAs would write a
  validator that refuses every existing spelling.
  Evidence: `cadence-core/bin/planning.mjs:3543-3546`, `:3921-3924`, `:3939-3940`,
  `:4326-4330`; `cadence-core/workflows/execute.md:289`, `:310`.

- D-09 (Citation resolution): The writing seam resolves each entry's `file`
  against `head_id` with `git cat-file -e <head_id>:<file>` and FLAGS an entry
  whose citation does not exist there; a flagged entry is still stored, never
  dropped. This buys the mechanical auditor path instead of demonstrating it,
  and it is needed because `line` is explicitly best-effort and `file` is bounded
  only as a non-empty string of at most 1024 chars with nothing else checked.
  Evidence: `cadence-core/bin/review-provider.mjs:790-791`;
  `skills/cad-reviewer-contract/SKILL.md:97-98`.

- D-10 (Which report line changes): The `/cad-report` edit lands on the Gates
  line, NOT the Refuted line. "Refuted:" consumes SUMMARY deviations that
  corrected a D-NN and is unrelated to gate findings; the gate outcome line is
  sourced from `outcomes` and REVIEW files. The `outcomes` array already carries
  `raised`, `trigger`, `plan`, `base`, `sha` and `detail` whole, so only the
  finding BODIES need the new file - and the existing `.md` glob will not match a
  `.json` sibling.
  Evidence: `cadence-core/workflows/report.md:65`, `:100`, `:101`;
  `cadence-core/bin/planning.mjs:3635`.

- D-11 (Guard obligations the prose edits force): The prose edits to
  `review-triggers.md` and `triage-gate.md` force a same-commit
  `weight-budgets.json` re-pin, and no FIFTH fenced `trace append --family
  outcome` event name may be introduced. GAT-04 scans both files for such lines,
  requires each to carry `--trigger --plan --base --sha`, and asserts the
  collected event list deep-equals exactly
  `['adjudication','gate_pass','override','rearm']`.
  Evidence: `cadence-core/bin/prose-agreement.test.mjs:1173-1204`;
  `cadence-core/bin/self-verify.mjs:719-742`; `cadence-core/bin/weight-budgets.json`
  (`review-triggers.md` 34459 B, `triage-gate.md` 11037 B).

- D-12 (The contract row): The new `planning.mjs` subcommand needs a declared
  `CONTRACTS` row before any prose may invoke it; self-verify reports
  `unknown-flag` against prose whose subcommand has no row, and the trace census
  walks every `trace append`/`trace close` in every prose surface.
  Evidence: `cadence-core/bin/lib/arg-contract.mjs:612-628`;
  `cadence-core/bin/self-verify.mjs:564`, `:1199`;
  `cadence-core/bin/trace.test.mjs:1586-1655`.

## Acceptance criteria

- [ ] AC1: A `blocking` or `adjudicated` gate fire writes
      `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`,
      discriminated exactly as its sibling `REVIEW-<trigger>-<discriminator>.md`;
      it holds one entry per finding RAISED per raising voice, and each entry
      carries `voice`, `model` and the severity as raised. A fixture with two
      voices raising one convergent finding produces two entries, not one.
- [ ] AC2: Each entry's `claim` and `failure_scenario` are byte-identical to the
      payload the reviewer returned, and a fixture payload whose claim is
      paraphrased before storage fails the seam's comparison. Each entry carries
      `file`, `line`, and `base_id`/`head_id` as full 40-character SHAs even when
      the caller's receipt spelled them 7-char or as the literal `HEAD`.
- [ ] AC3: The seam refuses a `ruling` outside `survived` | `downgraded` |
      `refuted`, refuses a `refuted` entry carrying no counter-evidence that
      names contradicting code, and refuses a `survived` entry carrying no fix
      commit SHA - three fixtures, one per refusal.
- [ ] AC4: Survivor, downgrade and refutation counts are DERIVED by counting
      rulings, written to the trace event through structured `--survivors`,
      `--downgraded` and `--refuted` flags, and never parsed back out of
      `--detail`. Flipping one entry's ruling in a fixture changes the recomputed
      count, and a record whose counts disagree with its trace event is
      detectable. Restated 2026-08-19 from the roadmap's original wording, which
      pinned the recount to the trace `detail` STRING and is unsatisfiable as
      written (D-01); the intent is unchanged - the count is recomputable rather
      than asserted.
- [ ] AC5: An entry whose `file` does not resolve at `head_id` via
      `git cat-file -e <head_id>:<file>` is stored with a flag and never dropped.
      On one real fire, `git checkout <head_id>` then opening the cited
      `file:line` reaches the code the verbatim claim describes.
      (human-verify: needs a live cross-model gate fire)
- [ ] AC6: `/cad-report <N>` renders its Gates line from the record when one
      exists, prints a fire with no record as unrecorded, and synthesizes no
      entry for a phase predating the format. Its Refuted line still reads
      SUMMARY deviations, unchanged.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with an empty `problems` array, with `weight-budgets.json` re-pinned in the
      same commit as the prose edits; `prose-agreement.test.mjs` GAT-04 stays
      green with its outcome-event list still exactly four names; and the new
      subcommand carries an `arg-contract.mjs` `CONTRACTS` row.

## Flagged assumptions

- The VERBATIM guarantee is machine-backed on the cross-model arm and
  prose-only on the claude-subagent arm - Likely; if wrong: the guarantee reads
  as general when it holds only where a schema validates the return. On this repo
  every reviewer set is `openai` (measured via `route.mjs resolve --role
  cad-reviewer`), so it holds here; a project configured with `claude-subagent`
  has its reviewer return parsed by the model per
  `review-triggers.md:133-137`, with nothing enforcing that the stored claim
  matches what the reviewer said.

- `.planning/trace.jsonl` is gitignored (`.gitignore:29`, confirmed by
  `git check-ignore -v`), so the TRACE is not the tamper-evident artifact -
  Confident; if wrong: the roadmap's "chain of custody is already free" sentence
  is right about `.planning/phases/` and wrong about the trace, and any
  acceptance step proving non-backdating by pointing at `trace.jsonl` proves
  nothing. Custody rests entirely on the committed record file. This also bounds
  D-01's cross-check: the trace half of the comparison is local-only evidence.

- 47 of 104 outcome receipts on this repo carry NO `trigger` field, and
  `planning.mjs:4293` drops every one of them as a receipt - including the two
  `gate_pass` events written for the empty-range deadlock phase 3 owns -
  Confident; if wrong: a record format keying on the receipt event's `trigger`
  inherits that join hole, and the omission reads as "unrecorded" rather than as
  the known defect it is. Planner's call whether to key on something else or to
  accept and document the hole; repairing the join is not this phase.

- `.planning/REQUIREMENTS.md` `## Active` still reads "No cycle open" and lists
  `v3.5.6` as scoped on the tracker but not opened, while three phases exist and
  phase 1 has shipped - Confident; if wrong: nothing, but this phase carries no
  seeded requirement id, so `/cad-audit` will find it orphaned in the
  requirement-to-phase direction. Left uncorrected here because this phase serves
  no row, and the workflow permits correcting only a row the phase serves.
