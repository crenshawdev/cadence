# Phase 9: Review delivery and identity - Context

Gathered: 2026-09-07
Feeds: /cad-plan 9

## Scope boundary

In: Deliver local reviewer findings through the binary before acknowledging
completion, with an immutable reviewed artifact, a durable occurrence and one
configured gate meaning. This is the current phase 9 at
`.planning/ROADMAP.md:728`; its goal is at `.planning/ROADMAP.md:730`.
Independent source and test-assertion inspection confirms ZERO already built,
THREE partial and TWO absent product capabilities, the five-capability scope
in `.codex-analysis/phase-9-decision-brief.md:5`. All five need work. The live
pilot is a separate acceptance obligation, not a sixth product capability
(`.planning/ROADMAP.md:789`). The seam revision retains the audited source
premises on `cadence/binary-owns-process`; no fresh passing test run is claimed.

Three partial capabilities, retained and extended:

- C01, trigger and gate orchestration: pause really reads the configured
  consequence, asks for unanswered surfaces, detects staged risk, requests a
  contracted result and acts on advisory/deferred/blocking/adjudicated outcomes.
  These are executable transitions, not only evidence readers
  (`crates/cadence/src/pause_service.rs:846`,
  `crates/cadence/src/pause_service.rs:868`,
  `crates/cadence/src/pause_service.rs:930`,
  `crates/cadence/src/pause_service.rs:949`). Existing assertions cover the
  saved surface answer and the adjudicated disposition wait
  (`crates/cadence/src/pause_service_tests.rs:454`,
  `crates/cadence/src/pause_service_tests.rs:801`). General plan/diff/risk
  orchestration across ordinary automatic and manual entry points is missing;
  native execution still sets `ReviewPolicy::Disabled`
  (`crates/cadence/src/execution/dispatch.rs:78`).
- C04, binary findings delivery: pause validates an `AcceptedResult` against
  its exact fire and serializes deferred REVIEW and DEFERRED artifacts itself
  (`crates/cadence/src/pause/risk.rs:121`,
  `crates/cadence/src/pause_service.rs:735`,
  `crates/cadence/src/pause_service.rs:751`). Its production queue visibility
  is asserted at `crates/cadence/src/pause_service_tests.rs:683`. General
  advisory handoff, the ordinary finding shape, consumer access and durable
  findings-plus-dispatch acknowledgment remain missing: public apply decodes
  only executor patches, and pause performs two separate `write_same` calls
  (`crates/cadence/src/server.rs:394`,
  `crates/cadence/src/pause_service.rs:758`).
- C06, artifact identity and home: pause hashes enclosing scope, commit kind,
  round, base, staged tree and path scope into its fire; accepts only an exact
  matching return; and uses `index:<id>` in an override receipt
  (`crates/cadence/src/pause/risk.rs:65`,
  `crates/cadence/src/pause/risk.rs:129`,
  `crates/cadence/src/pause_service.rs:797`). Scope already includes occurrence
  (`crates/cadence/src/evidence/mod.rs:17`), and existing assertions check the
  index receipt and round-two base across reopened state
  (`crates/cadence/src/pause_service_tests.rs:748`,
  `crates/cadence/src/pause_service_tests.rs:775`). General artifact kinds,
  retention and task/root occurrence homes remain to be supplied
  (`.planning/ROADMAP.md:775`,
  `crates/cadence/src/pause_service.rs:726`).

Two absent capabilities:

- C02, general local reviewer dispatch and ordered selection: pause returns
  `Response::Review` to request evidence; it does not launch a reviewer.
  Public query exposes only `execute-next`, while the native execute skill
  dispatches only its executor. The general reviewer loop is still frozen
  workflow prose (`crates/cadence/src/pause_service.rs:937`,
  `crates/cadence/src/server.rs:223`, `skills/cad-execute/SKILL.md:14`,
  `cadence-core/references/review-triggers.md:148`).
- C05, durable general review lifecycle/delivery: native execution dispatch
  and store transactions are useful infrastructure, but there is no review
  dispatch/result lifecycle on the public boundary. Build pending admission,
  return binding, idempotent acceptance and terminal failure/fallback closure
  (`crates/cadence/src/store/writer.rs:44`,
  `crates/cadence/src/server.rs:382`, `.planning/ROADMAP.md:783`). An accepted
  pause result does not establish that a reviewer was dispatched
  (`crates/cadence/src/pause_service.rs:654`).

In, specifically: preserve every verified findings-file consumer edge when
WAIT changes the writer. The binary must supply the saved originals, their
identity and delivery state through queries or recoverable renderings
(`.planning/ROADMAP.md:754`). The current edges are:

| Consumer | What it consumes today and what must remain reachable |
|---|---|
| Plan completion reporting | `done` reads `REVIEW-plan.md`; absence is reported in flight, not as a pass (`cadence-core/workflows/plan.md:462`). |
| Execute completion reporting | Summary folds `REVIEW-diff-plan-<k>.md` files and names any still in flight (`cadence-core/workflows/execute.md:418`). |
| Execute and planned-task fix continuations | Continuation executors receive the persisted risk findings path alongside their plan, without coordinator distillation (`cadence-core/workflows/execute.md:377`, `cadence-core/workflows/task.md:275`). |
| Reports | `/cad-report` opens REVIEW and ADJUDICATION separately; absent historical findings differ from an in-flight modern fire (`cadence-core/workflows/report.md:73`, `cadence-core/workflows/report.md:315`). |
| Deferred enqueue | Triage passes the REVIEW path to `deferred record`; that command requires and reads its payload file before building the queue. This edge belongs to a deferred gate, not every advisory fire (`cadence-core/references/triage-gate.md:19`, `cadence-core/bin/planning/deferred-record.mjs:47`, `cadence-core/bin/planning/deferred-record.mjs:54`). |
| Milestone preservation | Milestone calls risk carry before prune; the implementation copies every risk_surface REVIEW and ADJUDICATION round with filenames preserved (`cadence-core/workflows/milestone.md:103`, `cadence-core/workflows/milestone.md:114`, `cadence-core/bin/planning/risk-carry.mjs:65`, `cadence-core/bin/planning/risk-carry.mjs:220`). |
| Landing | `/cad-land` consumes adjudicated entries and enumerates unruled risk_surface REVIEW filenames. It explicitly does not use their raw findings arrays as settled survivors; its legacy root-aggregate remedy separately reads those findings by hand (`skills/cad-land/SKILL.md:122`, `skills/cad-land/SKILL.md:135`, `skills/cad-land/SKILL.md:151`). |

These filenames do not imply one content history: the advisory reviewer tail
writes raw originals, while frozen risk_surface persistence instructs a write
of the settled survivor list (`skills/cad-reviewer-contract/SKILL.md:114`,
`cadence-core/references/risk-surface.md:180`). Preserve those consumer views
separately from immutable originals; delivery must not reinterpret a raw
array as settled survivors. Phase 10 produces both the provisional selected
findings needed before a fix and the final verified settlement view. Phase 9
supplies their raw inputs and distinct typed consumer slots, not their rulings
(`.planning/ROADMAP.md:807`).

The adjacent native next-action reader enumerates DEFERRED JSON under phase
and deferred homes, not advisory REVIEW files. Its sibling-file suppression
is not verified settlement (`crates/cadence/src/next_action/observations.rs:124`,
`crates/cadence/src/next_action/observations.rs:167`,
`crates/cadence/src/next_action/observations.rs:192`). Likewise, `/cad-why`
reads adjudication records, and filing consumes a structured adjudication
payload; neither is another raw REVIEW-file reader
(`cadence-core/bin/lib/why-record.mjs:428`,
`cadence-core/bin/lib/filing-decision.mjs:14`).

Deliberately narrow: build the shared local delivery loop, its callable binary
operations and the thin invoking/consumer adapters needed to exercise it.
Generalize pause's gates, exact identity binding and binary writer pattern;
do not treat its contract as a general review transaction. Its commit kinds
are only `Wip` and `ResumeRecord`; its constructor sets `staged: true` and
`head_id: None`; its findings require `fix`, with no `failure_scenario`
(`crates/cadence/src/pause/risk.rs:38`,
`crates/cadence/src/pause/risk.rs:83`,
`crates/cadence/src/pause/risk.rs:103`). Phase 9 supplies the originals and
recorded origin that phase 10 will consume, including a pending settlement
state; it does not supply a ruling merely because delivery succeeded
(`.planning/ROADMAP.md:762`, `.planning/ROADMAP.md:801`). Full planning intake,
execution/task workflows and landing/milestone ordering retain their current
owners: phases 11, 12 and 15 respectively (`.planning/ROADMAP.md:861`,
`.planning/ROADMAP.md:910`, `.planning/ROADMAP.md:1016`). Consumer fixtures and
recoverable inputs here do not claim those whole workflows are migrated.

Out: phase 10's evidence verification: comparing rulings with persisted
originals and recorded voices, resolving fix commits, validating citations and
counter-evidence, minimalism result verification, matching settlement before
deferred supersession, general deferred carry/retention and triage re-arm.
Provider credential lookup, payload/transport/usage handling and remote filing
also belong there, together with GH-237, GH-239, GH-240, GH-250 and GH-251
(`.planning/ROADMAP.md:796`, `.planning/ROADMAP.md:807`,
`.planning/ROADMAP.md:814`, `.planning/ROADMAP.md:822`,
`.planning/ROADMAP.md:829`, `.planning/ROADMAP.md:838`). Phase 9 delivers and
identifies findings; phase 10 decides whether settlement evidence can be
believed. New pause deliveries use the shared identity and five-field return
contract here; old `fix`-shaped records remain explicitly historical. Existing
pause-specific clearance is a transitional dependency, not phase-9 evidence of
verified settlement. Phase 10 D-70 owns its mandatory cutover, including removal
of alternate raw-result clearance (`crates/cadence/src/pause_service.rs:958`).

Out, also: a new milestone reviewer trigger, revival of `phase_diff` or
`git.auto_close`, and edits to the frozen `cadence-core/` reference. Milestone
is an evidence consumer, those settings are already retired in Rust, and the
rewrite is specified against the frozen reference
(`.planning/ROADMAP.md:740`, `crates/cadence/src/config/mod.rs:11`,
`.planning/REQUIREMENTS.md:11`). Preserving landing's input edge does not
restore its historical unattended-merge policy; current landing requires
explicit authorization (`.planning/ROADMAP.md:1037`).

## Durable decisions

- D-57 (WAIT includes binary persistence): An advisory reviewer is read-only
  by the shipped contract; this is not a tool-enforced write barrier.
  The invoking skill waits for its raw return and forwards it unchanged to the
  binary result operation. The binary saves the findings and closes the
  dispatch before acknowledging completion. Neither participant is instructed
  or authorized by that contract to write findings or append a lifecycle close.
  Losing overlap with commit preparation and the next plan is an accepted cost.
  Advisory severity never
  halts work and its findings stay raw and unruled even when combination mode
  is adjudicated (`.planning/ROADMAP.md:746`). Replace the actual advisory
  persistence tail, including its Bash heredoc and trace append
  (`skills/cad-reviewer-contract/SKILL.md:109`,
  `cadence-core/references/review-triggers.md:165`). Denying Write/Edit never
  established prevention: the reviewer has Bash. The native Bash guard does
  NOT and CANNOT intercept a reviewer heredoc within its deliberate parser
  bound: redirection syntax makes the parser return `None` at line 129 and
  an unmatched command passes at line 461. The commit rail's own plan leaves
  unparsed input outside coverage; it is not a findings-write guard
  (`agents/cad-reviewer-medium.md:4`,
  `crates/cadence/src/guard/mod.rs:79`,
  `crates/cadence/src/guard/bash.rs:129`,
  `crates/cadence/src/guard/bash.rs:461`, `.planning/phases/7/PLAN-1.md:108`).
  Run the delivered loop with installed hooks, including SubagentStop: native
  attempts must not acquire a competing legacy close; any host observation
  goes through D-62's binary operation. What can be proved is removal of write
  instructions, persistence through the binary, and no reviewer-written
  artifacts in the observed pilot. Observation is not prevention. If wrong:
  acknowledgment precedes durable delivery, or cooperative behavior is
  advertised as a shell-write barrier.

- D-58 (SHARED gate meaning): Every ordinary manual or automatic plan/risk
  entry point, including small tasks, uses the same effective configured gate
  and routing answer. The defaults remain plan advisory, diff off and
  risk_surface blocking; all three gate keys admit deferred. Manual plan
  review's claimed adjudicated default and the task-record claim that
  risk_surface never resolves deferred are stale contracts to replace in the
  live path (`cadence-core/config.schema.json:95`,
  `cadence-core/config.schema.json:98`,
  `cadence-core/config.schema.json:101`,
  `skills/cad-plan-review/SKILL.md:39`,
  `cadence-core/references/review-record.md:128`). Decision review and
  minimalism keep their specialist contracts. Supply callable specialist
  admission and local delivery: minimalism accepts a file, a frozen directory
  listing with retained member bytes, or a resolved phase range, and dispatches
  one base reviewer without ordinary gate/routing selection. Decision review
  retains the selected decision plus inline context; diagnosis retains named
  source files plus reported/cause text. HANDOFF H2 binds all these shapes
  without implementing specialist judgment or whole workflows
  (`cadence-core/workflows/minimalism-review.md:23`,
  `cadence-core/workflows/minimalism-review.md:79`,
  `cadence-core/workflows/decision-review.md:34`,
  `cadence-core/workflows/verify.md:261`). A gate requiring settlement
  stays pending until phase 10 accepts it; a raw return cannot clear it
  (`.planning/ROADMAP.md:762`). If wrong: the same saved setting changes
  spending or stopping behavior depending on the caller, or a missing task
  home silently turns a deferred gate into blocking.

- D-59 (FIRST determines what runs): In single mode, attempt the configured
  order sequentially, stop at the first usable response and retain each
  failed attempt and its observed cost. A usable empty findings array is a
  successful review result; missing or malformed output is not. If every
  configured choice fails, run the local fallback and record its actual
  outcome (`.planning/ROADMAP.md:768`). This resolves the frozen contradiction
  between dispatching the whole set concurrently and using the first available
  reviewer (`cadence-core/references/review-triggers.md:118`,
  `cadence-core/references/review-triggers.md:229`). Failure-path latency is an
  accepted cost. Preserve available usage and mark unavailable observations
  as unavailable rather than inventing zero; the frozen local failure arm
  already owes its spent dispatch a record
  (`cadence-core/references/review-triggers.md:153`,
  `cadence-core/references/review-triggers.md:159`). External adapters arrive
  in phase 10 and must consume this selection contract
  (`.planning/ROADMAP.md:829`). For panel/adjudicated combination, freeze the
  complete selected roster and any fallback rules at admission, drive every
  required slot, and expose each slot's pending/interrupted/success/failure
  state. Fire completion requires every required slot to have a terminal
  outcome; a timeout or failed slot cannot disappear from the roster or become
  empty success. Distinguish complete-with-failure from a usable complete
  review. In FIRST, later unneeded choices are explicitly not selected after
  success, not unresolved panel members. This delivery-completion contract is
  the prerequisite phase 10 consumes before settlement. If wrong: single mode
  pays for a panel, a failed review masquerades as empty success, or fallback
  work disappears from the record.

- D-60 (SNAPSHOT identifies actual reviewed material): Use typed
  committed-range, staged-tree and named-file snapshots. Resolve and retain
  the reviewed bytes or accessible immutable objects, together with scope,
  occurrence and round, before dispatch. The payload must address that
  retained artifact; replay must not re-read today's index or a replaced file
  as yesterday's review. An uncommitted review never borrows an unrelated
  HEAD (`.planning/ROADMAP.md:775`). Pause's scope/base/tree/round digest and
  exact-return equality generalize, as does its index-specific receipt;
  its `Wip`/`ResumeRecord`, staged-only constructor and `fix` finding do not
  (`crates/cadence/src/pause/risk.rs:38`,
  `crates/cadence/src/pause/risk.rs:65`,
  `crates/cadence/src/pause/risk.rs:83`,
  `crates/cadence/src/pause/risk.rs:103`,
  `crates/cadence/src/pause/risk.rs:129`,
  `crates/cadence/src/pause_service.rs:799`). Debug/verify already review
  staged fixes, and plans and diagnosis already supply file artifacts
  (`cadence-core/workflows/debug.md:117`,
  `cadence-core/workflows/verify.md:284`,
  `cadence-core/references/review-triggers.md:318`,
  `cadence-core/workflows/verify.md:259`). If wrong: later edits change what
  a finding appears to concern, or a stored digest survives while its
  reviewed material is no longer recoverable.

  Produce HANDOFF H2's manifest before dispatch. Retaining a `.diff` alone is
  insufficient: preserve source paths, base/head/snapshot sides and line
  mappings behind it, including deleted and renamed sides. Pin immutable
  objects or retain bytes independently of ordinary ref reachability. Primary
  targets and supporting context have separate entries. Additional evidence
  is admitted through the binary as an append-only retained manifest entry
  with acquisition time and an attempt/view binding when actually delivered;
  later evidence never claims to have been in the original review. Phase 9
  acquires identity and bytes; phase 10 decides citation relevance and weight.

- D-61 (Every admitted fire has a home): Reuse phase and task homes and add
  binary-owned root occurrences for inline, debug and diagnosis reviews.
  Allocate the durable occurrence and artifact home before dispatch, and
  enumerate unsettled/deferred reviews from every admitted home
  (`.planning/ROADMAP.md:775`). Repeated filenames, unchanged HEAD and repeated
  task slugs cannot collapse independent initial fires; a retransmission of the same
  admitted fire remains the same occurrence (D-62). This replaces the frozen
  existing-directory requirement and inline absence of a record home
  (`cadence-core/bin/planning/core.mjs:915`,
  `cadence-core/workflows/task.md:263`). The existing native queue reader
  only scans phase/deferred homes, so storing a task/root occurrence without
  making it discoverable is incomplete
  (`crates/cadence/src/next_action/observations.rs:124`). Phase 9 alone owns
  initial deferred enqueue before continuation and extension of the producer
  and unfiltered enumerator to every admitted home. Phase 10 consumes this
  enumerator for carry and verified settlement filtering; it does not rebuild
  or extend home discovery. If wrong: an inline
  review is lost, a repeated fire overwrites another, or a saved deferred
  review never reaches a later consumer.

- D-62 (Pending first and one terminal outcome): Persist a pending fire and
  its dispatch identity before returning a dispatch instruction. Bind each
  result to that occurrence, artifact, reviewer attempt and round. Durably
  accept originals and close the attempt before completion acknowledgment;
  duplicate acceptance is idempotent, while conflicting returns cannot
  overwrite the accepted originals. Failures and fallback attempts close once
  as their actual outcomes. A stop before submission leaves visibly pending
  or interrupted work, never a completed empty review
  (`.planning/ROADMAP.md:783`). Keep an intended dispatch distinct from observed
  participation: returning a dispatch instruction alone does not prove that
  the host launched the reviewer (`.planning/ROADMAP.md:789`). Persist H1's
  admitted policy and H3's requested model/agent/routing separately from host
  observations. Bind host launch and return identifiers to the binary-issued
  attempt before accepting that return; an arbitrary caller voice label is
  not origin evidence. Late observations enrich that same attempt once,
  without another terminal result or cost event. Missing observations remain
  explicitly unknown; conflicting or cross-attempt submissions refuse.
  Reuse the store's
  conditional transaction
  foundation (`crates/cadence/src/store/writer.rs:60`); pause's two file writes
  are not this transaction (`crates/cadence/src/pause_service.rs:758`). WAIT
  cannot recover raw text that never reached the binary, so recovery must
  preserve that absence rather than assert delivery. If wrong: a lost reply
  duplicates findings or cost, a partial write receives a completion
  acknowledgment, or restart silently turns interruption into success.

  Supply one reusable pending-admission primitive that can join a caller's
  conditional store transaction: identity, policy, manifest references, roster
  and initial dispatch identities commit together, with no dispatch instruction
  exposed before commit. Replay keys return the same admitted identity. Phase
  10 D-79 owns composing this primitive with parent allowance and child lineage;
  phase 9 implements no allowance spending or cross-round settlement.

- D-63 (Original findings remain original): Persist the raw return and the
  exact original finding strings and array order, associated with the actual
  dispatch voice and immutable artifact. The ordinary shape includes `file`,
  `line`, `severity`, `claim` and `failure_scenario`; do not silently adapt it
  into pause's `fix` field or preserve only survivor counts
  (`skills/cad-reviewer-contract/SKILL.md:86`,
  `crates/cadence/src/pause/risk.rs:103`, `.planning/ROADMAP.md:754`). Any
  combination view must leave per-attempt originals available, including
  under panel/adjudicated mode, because phase 10 checks rulings against those
  originals and recorded voices (`.planning/ROADMAP.md:801`,
  `.planning/ROADMAP.md:807`). Admission uses the complete bounded contract in
  HANDOFF H4 now, not a weaker validator to be tightened in phase 10. Record its
  schema interpretation and validator contract ID beside the immutable raw
  bytes. Phase 10 must read accepted phase-9 originals under that same contract
  without rewriting or newly rejecting their shape. Unrecognized historical
  records stay readable as unverified with diagnostics and an explicit new
  review/recovery path; they are never silently promoted. Admission rejects
  unusable shape and mismatched identity, not finding truth or settlement.
  If wrong: the next phase has only paraphrases or a merged list to verify,
  and cannot recover what each reviewer actually returned.

- D-64 (Delivery preserves its readers): Binary queries or recoverable
  renderings must supply the entire consumer inventory in Scope boundary:
  plan/execute completion, execute/planned-task fix continuations, reports,
  deferred enqueue, milestone preservation and landing's unruled inventory
  (`.planning/ROADMAP.md:754`, `cadence-core/workflows/plan.md:466`,
  `cadence-core/workflows/execute.md:377`,
  `cadence-core/workflows/execute.md:418`,
  `cadence-core/workflows/task.md:275`,
  `cadence-core/workflows/report.md:73`,
  `cadence-core/bin/planning/deferred-record.mjs:54`,
  `cadence-core/workflows/milestone.md:114`,
  `skills/cad-land/SKILL.md:135`). A compatibility filename is a rendering
  address, not the authoritative fire identity. Keep `raw`,
  `provisional-selected` and `settled` views distinct. A fix continuation takes
  the typed provisional selection supplied by phase 10 D-79; it cannot require
  a final fix commit before work begins. Phase 9 only transports that supplied
  selection and its original-finding identities, without producing rulings or
  granting clearance. Keep originals distinct from adjudicated entries, and
  preserve the risk_surface-only scope of the
  milestone/landing raw-file edge (`skills/cad-land/SKILL.md:122`). General
  carry/settlement and full landing ordering remain later work
  (`.planning/ROADMAP.md:822`, `.planning/ROADMAP.md:1021`). If wrong: WAIT
  successfully saves a review that its existing downstream readers can no
  longer find, or raw advisory findings become a false settlement verdict.

- D-65 (Delivery ends before evidence verification): Phase 9 records what
  ran, what returned and which artifact it reviewed. Phase 10 compares
  rulings with those originals, resolves fix commits, validates citations and
  decides whether settlement may clear the gate. Receiving findings alone
  never performs that transition (`.planning/ROADMAP.md:762`,
  `.planning/ROADMAP.md:798`, `.planning/ROADMAP.md:807`,
  `.planning/ROADMAP.md:814`). Provider/filing implementation and GH-237,
  GH-239, GH-240, GH-250 and GH-251 stay with phase 10
  (`.planning/ROADMAP.md:829`, `.planning/ROADMAP.md:838`). Its tests and live
  pilot cannot be counted as obligations completed by a local delivery test
  (`.planning/ROADMAP.md:852`). If wrong: the plan reconstructs the oversized
  unsplit subsystem or lets shape-correct delivery stand in for verified
  settlement.

- D-66 (PILOT is required for acceptance): The owner reviews live evidence
  of a local advisory return, unchanged forwarding, binary persistence before
  completion, failed-attempt closure and uncommitted identity surviving later
  edits. Record the actual host calls, returns and saved observations, with
  the owner's acceptance of the stated semantic limitations
  (`.planning/ROADMAP.md:789`). Deterministic fixtures cannot discharge this:
  phase 6 recorded 347 passing tests while the boundary would not load in a
  real host (`.planning/phases/6/SUMMARY.md:16`). The pilot establishes the
  observed episodes, not a guarantee that a reviewer finds every defect.
  Provider/forge episodes have their own later acceptance
  (`.planning/ROADMAP.md:852`). If wrong: test-shaped JSON is reported as a
  real review, or a working serializer masks an unusable host boundary.

## HANDOFF — phase 9 must produce these artifacts for phase 10

H1–H5 are the normative producer contract, refining D-58–D-64. They are logical
records, not mandated filenames or a second store. The phase-9 plan must name
the native admission, observation, return, material-read and enumeration
operations and their check commands. Persist a documented schema/contract ID
and interpretation for every record family; restart must not reinterpret a
record using today's settings. Every join below must be queryable without
caller reconstruction. Phase 10 consumes this contract; it does not fill in
missing phase-9 fields.

1. **H1 — Pending fire and saved admission.** Before dispatch, persist the
   binary-issued fire ID and replay key; enclosing project/root/cycle scope;
   durable occurrence ID and phase/task/root home; caller kind, trigger or
   specialist kind, discriminator, applicable plan and anchor (explicit
   not-applicable values where appropriate); round; artifact/manifest ID;
   effective admitted gate; selection mode, ordered configured choices,
   fallback rule, routing answer and its saved evidence/reference. Include the
   complete required roster and its completion rule. Save the resolved values,
   not only a pointer to mutable config. Policy or phase-cursor changes after
   admission cannot change these fields. Separate settlement-pending from
   delivery state. The same admission primitive must compose into the caller's
   conditional transaction described in D-62, without emitting dispatch work
   before that transaction commits. Parent lineage/allowance semantics belong
   exclusively to phase 10 D-79.

2. **H2 — Retained material manifest and read operation.** Bind the manifest
   to H1, recording artifact kind, primary target description and immutable
   content identities. Committed ranges retain resolved base/head objects;
   staged work retains base and authored index-tree identity; named files,
   directories and inline text retain exact bytes. For each entry record its
   stable entry ID, primary/supporting role, source path or inline label,
   base/head/snapshot side, content ID, retained location and line-to-byte
   mapping. Record old/new paths and absent sides for deletes/renames. A saved
   diff file retains its own bytes AND a hunk-to-source mapping with readable
   source bytes on each existing side; its line numbers cannot stand in for
   source lines. Directory targets retain the enumerated membership and each
   member's bytes; phase targets retain the resolved range; selected decisions
   and diagnosis retain inline context, not only mutable document pointers.
   Payload/view references identify which retained entries were actually
   offered to each attempt, and the reviewer reads those entries.

   Supporting context outside primary paths uses the same retention operation.
   Additional context or counter-evidence gets an append-only entry with
   acquisition identity/time and its supplied-to-attempt observation, or an
   explicit later-evidence designation when acquired after review. It never
   changes the original manifest/view or retroactively claims participation.
   Phase 10 may use this operation to acquire later counter/fix evidence and
   then verify its relation to the claim. A missing source remains explicitly
   unavailable, not replaced by current HEAD; retaining only a diff/digest
   cannot satisfy delivery of a required source side. The read operation must
   recover retained bytes after edits, deletion, restart and loss of ordinary
   refs. Identity acquisition here is not citation verification.

3. **H3 — Dispatch roster, attempts and host observations.** Each admitted
   voice/slot and each attempted fallback has a binary-issued attempt ID joined
   to fire, occurrence, round and immutable view. Persist requested agent,
   model, effort/routing settings and selection evidence separately from
   observed host identity/model (explicit unknown when not reported). The host
   bridge submits attempt ID plus host launch ID, host-return ID, observation
   kind, bounded observation reference and available usage; launch/return
   bindings are established from that bridge's actual events, not accepted as
   a caller-chosen voice name. One host return cannot serve two attempts, even
   for the same artifact. Preserve intended, observed-running, interrupted or
   uncertain, and terminal outcome distinctions. Expose requested-but-never-run
   choices, failed attempts and usable empty voices separately. Uncertain work
   is not automatically redispatched as new work after restart.

   Replaying an observation is idempotent; late usage/host facts append to the
   same attempt without reopening it, changing originals, duplicating cost or
   creating another terminal event. Conflicting host/attempt bindings refuse.
   Unknown observed model/usage cannot become the requested value or zero.
   A fire is incomplete while any required slot is pending/interrupted; every
   slot must terminate under the admitted fallback rule. Complete-with-failure
   is distinct from usable complete delivery and cannot imply a clean review.

4. **H4 — Immutable originals and compatible bounded admission.** Store the
   exact raw return, its record/content ID, schema and validator contract ID,
   attempt/host-return binding, artifact/view reference, acceptance result and
   durable closure acknowledgment. Findings keep array order and stable
   per-attempt finding identity (original record ID plus index), with exactly
   `file`, `line`, `severity`, `claim`, `failure_scenario`. The common response
   is a `findings` array with no unknown envelope/finding fields, at most 100
   findings per voice, nonblank file/claim/scenario, file length at most 1024
   and claim/scenario at most 2000 Unicode scalar values, severity one of
   blocker/high/medium/low, and integer line in 1..9007199254740991. Reject
   whitespace-only text and invalid scalar strings; do not trim, normalize,
   paraphrase or truncate accepted strings. Bound raw return accumulation to
   4 MiB before parsing. Empty findings are usable; missing/malformed output
   is failure. A sidecar binds finding IDs to submitted manifest-entry, side
   and line references, or explicit unresolved identity when not supplied;
   these remain unverified inputs for phase 10. Never alter the five original
   fields to attach citation-side or evidence metadata.

   This is the bounded finding contract previously stated in phase 10 D-71;
   phase 9 now owns producing it and phase 10 reuses it. A phase-9 accepted
   original must remain admissible when opened by phase 10 without changing
   bytes, field interpretation or finding IDs. Older/unknown contracts retain
   their bytes and explicit unverified reason; an identified new review can
   provide missing evidence, but cannot rewrite the old origin or silently
   clear its obligation. Phase 10 owns the recovery/settlement decision.

5. **H5 — Recovered queries, enqueue and consumer views.** Native queries
   enumerate every admitted phase/task/root home and return all H1–H4 joins,
   including unknowns, failures, complete rosters and delivery-versus-settlement
   state. Phase 9 produces the initial deferred member before continuation and
   supplies an unfiltered all-home enumerator; phase 10 adds verified filtering
   and carry using it. A disposable REVIEW/ADJUDICATION filename is not a join
   key. Regenerable consumer views identify their kind (`raw`,
   `provisional-selected`, `settled`), source fire/round/original IDs and view
   revision. Only raw/delivery views originate here; typed selections and
   settlement supplied by phase 10 remain separate. Deleting a rendering must
   not lose originals, discovery or the inputs needed by the seven consumers.

Acceptance must retain a restartable store produced by phase 9's own native
admit/dispatch-observation/return/enqueue paths, with operation transcript,
producer revision, contract IDs and record/content-ID inventory. Include the
boundary accepted returns and specialist/panel/material cases below. Scripted
host returns may supply inputs; tests may not seed internal handoff records or
backfill required fields. Phase 10 AC1 reopens these unchanged artifacts with
its implementation. No verified settlement or re-arm implementation is required
to produce this handoff.

## Acceptance criteria

- [ ] AC1: In an observed local advisory loop, the dispatched contract/prompt
      contains no findings-write or trace-append tail. The reviewer reads the
      artifact and returns raw JSON; the invoking skill forwards it unchanged.
      Tool events and filesystem observations, including the Bash channel,
      show no reviewer-written artifacts and persistence/closure through the
      binary for this episode. Run with installed hooks, including SubagentStop,
      and inspect that it creates no competing native-attempt lifecycle close.
      Record that Bash heredocs pass the bounded guard: absence of observed
      reviewer writes is not prevention. No completion
      or next-plan dispatch appears before the durable result acknowledgment;
      blocker/high advisory findings still allow continuation and remain
      unruled even under adjudicated combination mode. Include quotation,
      newline and Unicode strings and compare returned, submitted and stored
      originals exactly (
      `.planning/ROADMAP.md:746`, `.planning/ROADMAP.md:754`,
      `skills/cad-reviewer-contract/SKILL.md:114`,
      `crates/cadence/src/guard/bash.rs:129`,
      `crates/cadence/src/guard/bash.rs:461`).

- [ ] AC2: Drive the concrete native invoking adapters for manual plan,
      automatic plan, task, execute, debug and verify, including ordinary diff
      as well as plan/risk requests under equivalent effective settings.
      Inspect actual dispatch instructions, not synthetic caller labels.
      Each returns the same
      gate meaning: off dispatches nothing; advisory has AC1's delivery wait;
      deferred saves a discoverable unruled obligation and permits the run;
      gates requiring settlement remain pending after raw delivery. Without
      plan-floor elevation, unset plan/risk gates resolve advisory/blocking
      respectively, and unset diff is off; explicit task deferred is honored.
      Exercise actual-diff detector match, nonmatch, inconclusive and unanswered
      surface cases and inspect the saved routing/gate answer and resulting
      dispatch or wait. Specialist delivery is checked separately in AC13
      (`.planning/ROADMAP.md:762`,
      `cadence-core/config.schema.json:95`,
      `cadence-core/config.schema.json:101`,
      `.planning/phases/8/CONTEXT.md:280`,
      `skills/cad-plan-review/SKILL.md:39`,
      `cadence-core/references/review-record.md:128`).

- [ ] AC3: Scripted reviewer outcomes prove single mode issues requests in
      configured order: fail A, accept usable B, never invoke C; usable empty
      findings at A invokes neither B nor C. Malformed or missing output is a
      failed attempt, never empty success. Exhausting the configured choices
      invokes the local fallback; both its success and failure terminate with
      one recorded outcome per attempt. Failed-attempt usage remains visible
      when observed, and absent observations stay unavailable. These are
      selection tests, not claims of live external-provider support
      (`.planning/ROADMAP.md:768`,
      `cadence-core/references/review-triggers.md:159`,
      `cadence-core/references/review-triggers.md:217`).

- [ ] AC4: Snapshot fixtures admit committed-range, staged-tree and named-file
      reviews, then move the original refs, change the index, and overwrite or
      delete the named files between admission and the reviewer's read.
      Observe the dispatch reading retained bytes, not the mutable originals.
      Reopening and querying the admitted
      fire returns the original identity AND readable original material and
      finding strings, never substituted HEAD or current bytes. A new fire
      against changed material has a different artifact identity; an independent
      initial fire against identical material has a distinct occurrence, while replay
      preserves the old one. Cross-artifact and cross-round submissions
      refuse without changing accepted originals. Home allocation/enumeration
      is checked independently in AC14 (`.planning/ROADMAP.md:775`,
      `crates/cadence/src/pause/risk.rs:129`,
      `crates/cadence/src/pause_service.rs:799`,
      `crates/cadence/src/next_action/observations.rs:124`).

- [ ] AC5: Failure-injection and reopen observations cover interruption after
      pending admission, after host return but before submission, during result
      persistence, and after durable acceptance but before acknowledgment.
      No interrupted/failed fire reports an empty successful review; accepted
      originals remain recoverable. Replaying the same accepted result creates
      neither another finding set nor another terminal/cost record; a
      conflicting duplicate refuses. Race identical and conflicting submissions
      and assert the same single accepted original/terminal fact after reopen.
      Exercise pending admission inside a caller's conditional transaction:
      failed comparison exposes neither partial admission nor dispatch, and
      replay after a committed-but-unacknowledged admission returns the same
      fire/attempt IDs. Every completed or failed attempt has
      exactly one terminal outcome and unresolved attempts remain visible.
      Retained pause gate, deferred visibility and index-identity assertions
      still pass when running
      `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence pause_service_tests`
      (`.planning/ROADMAP.md:783`,
      `crates/cadence/src/pause_service.rs:758`,
      `crates/cadence/src/pause_service_tests.rs:454`,
      `crates/cadence/src/pause_service_tests.rs:683`,
      `crates/cadence/src/pause_service_tests.rs:713`).

- [ ] AC6: Concrete thin consumer adapters retrieve the same saved occurrence
      and exact originals for plan/execute completion, execute/planned-task fix
      continuations, reports and deferred enqueue, keeping originals distinct
      from supplied typed provisional selections and final settlement views.
      A fix-continuation fixture supplies phase 10 D-79's selected-finding view
      without a fix commit; refuted, selected-to-fix and finally settled cases
      remain distinct, and no raw high finding becomes a settled survivor.
      Milestone-preservation and
      landing-input fixtures retain every relevant risk_surface round and
      identify unruled reviews separately from adjudicated entries. Reopening
      after deleting disposable renderings recovers the same inputs from
      binary state. Pending/failed results remain distinguishable from usable
      empty findings, and advisory files alone never become deferred queue
      members. These checks exercise delivery inputs, not settlement validation
      or full prune/landing behavior (`cadence-core/workflows/plan.md:466`,
      `cadence-core/workflows/execute.md:377`,
      `cadence-core/workflows/execute.md:418`,
      `cadence-core/workflows/task.md:275`,
      `cadence-core/workflows/report.md:73`,
      `cadence-core/bin/planning/deferred-record.mjs:26`,
      `cadence-core/bin/planning/deferred-record.mjs:54`,
      `cadence-core/workflows/milestone.md:114`,
      `skills/cad-land/SKILL.md:122`).

- [ ] AC8: Admit through native operations, inspect every H1 field, then change
      the effective gate, routing/model settings and active phase cursor and
      restart. Query returns the saved admission values, explicit applicability
      fields, schema interpretation and original home/occurrence/round. Replay
      returns that fire; a separately admitted initial fire gets a new occurrence.
      No required join is reconstructed from current config or cursor.

- [ ] AC9: Admit a saved diff file with deletion and rename hunks plus supporting
      context outside the changed paths. Inspect H2's hunk/source mappings and
      read exact base/head/snapshot lines by entry ID. Change the supporting
      file, delete working sources and remove ordinary reference reachability
      in the isolated fixture; retained bytes still read after reopen. Admit
      additional counter-evidence outside primary paths through the material
      operation, and inspect its immutable ID and original-view versus
      later-evidence designation. A diff-only record fails this check; no
      citation-truth verdict is expected from phase 9.

- [ ] AC10: Two same-artifact attempts use different requested models and host
      launch/return IDs. Inspect H3 after restart: requested settings and observed
      identities/unknowns remain separate. Swapping returns or reusing a host
      return across attempts refuses. Replay and race duplicate observations,
      then submit late usage/model observations: exactly one terminal outcome
      remains, with no duplicate cost and no rewritten original. A missing
      observation stays unknown instead of acquiring the requested model.

- [ ] AC11: Run H4's matrix through native local admission: accept empty and
      100-finding returns, maximum-length scalar strings and valid boundary
      lines; refuse 101 findings, unknown fields, blank/whitespace-only text,
      over-limit fields, invalid scalars, fractional/zero/unsafe lines and a
      return exceeding 4 MiB before parsing/over-accumulation. Compare accepted
      raw bytes, strings, order, IDs and contract IDs after restart. Retain this
      phase-9-produced boundary store for phase 10 AC1/AC2 compatibility checks.

- [ ] AC12: Native panel and adjudicated-combination dispatch each freeze a
      two-voice roster and actually request both voices. Return empty A while B
      remains pending, then interrupt/restart: the query still names B and marks
      the fire incomplete. Deliver B with findings, then repeat with B failing
      and its admitted fallback succeeding or failing. Every required slot has
      an explicit terminal outcome; incomplete, complete-with-failure and
      usable-complete states cannot collapse into one clean result. Per-voice
      originals remain distinct; raw delivery does not settle the gate.

- [ ] AC13: Through callable native specialist adapters, admit/deliver minimalism
      for a file, a directory and a phase range; inspect one base reviewer and
      no ordinary routing in each ledger. Mutate directory membership and member
      bytes before read; the dispatched retained listing/content remains exact.
      Decision review delivers the selected decision plus inline context;
      diagnosis delivers named files plus reported/cause text. Query each target,
      raw/empty/failure result and immutable material after restart. No deletion,
      specialist ruling or final settlement is required here.

- [ ] AC14: Native deferred operations create members in phase, task and root
      homes, including inline/debug/diagnosis occurrences. Observe enqueue before
      continuation, then query the same unfiltered enumerator after restart and
      removal of disposable renderings: every member and H1–H4 reference remains.
      Advisory-only and off requests create no deferred member. New pause delivery
      uses the same fire/dispatch and ordinary five-field originals; old `fix`
      records are labeled historical instead of gaining invented dispatch origin.
      Phase 10 will test settlement filtering on this enumerator.

- [ ] AC15: Produce the HANDOFF acceptance store using only phase 9's native
      producer operations and scripted or observed host inputs. Retain the
      command transcript, producer revision, contract IDs, artifact inventory
      and hashes, then reopen and enumerate H1–H5 without internal record seeding
      or backfill. Include AC8–AC14 cases and retain the accepted boundary store
      unchanged for phase 10 AC1. Record the actual operation/test selectors so
      the producer run can be repeated; a fixture authored directly to phase
      10's desired schema cannot satisfy this criterion.

## Flagged assumptions

- **The unsplit count is historical; the brief's roadmap coordinates have
  drifted.** The live heading is at `.planning/ROADMAP.md:728`, WAIT at
  `.planning/ROADMAP.md:746`, SHARED at `.planning/ROADMAP.md:762`, FIRST at
  `.planning/ROADMAP.md:768`, snapshots at `.planning/ROADMAP.md:775`, and the
  pilot at `.planning/ROADMAP.md:789`. The roadmap's 2 built / 5 partial /
  11 absent at
  `.planning/ROADMAP.md:734` describes the unsplit subsystem. It is not the
  current five-capability count. The current wording correctly identifies
  milestone as a consumer (`.planning/ROADMAP.md:740`); do not revive the
  removed five-review-firing-skills premise. Use the audited coordinates
  during planning rather than copying the brief's old citations
  (`.codex-analysis/phase-9-decision-brief.md:9`).

- **Binary writing is a contract, not enforced shell exclusion.** The inspected
  guard delegates Bash but deliberately declines redirection syntax and passes
  unmatched commands (`crates/cadence/src/guard/mod.rs:79`,
  `crates/cadence/src/guard/bash.rs:129`,
  `crates/cadence/src/guard/bash.rs:461`). This is the commit rail's stated
  bounded coverage (`.planning/phases/7/PLAN-1.md:108`). D-57/AC1 require a
  shipped no-write reviewer contract and observed binary persistence with
  installed hooks. They do not claim that reviewer heredocs are intercepted
  or that the observed absence of reviewer-written artifacts prevents writes.

- **Pause identity is real, but identity is not general snapshot retention.**
  Its staged observation builds an authored tree excluding supplied binary
  receipts and narrow review artifacts, checks for concurrent index/HEAD
  change, and returns that tree ID (`crates/cadence/src/pause/git.rs:325`,
  `crates/cadence/src/pause/git.rs:364`,
  `crates/cadence/src/pause/git.rs:371`). Thus `index_id` is not always the
  entire live index. `Fire` retains identity, paths and scan rather than the
  diff bytes (`crates/cadence/src/pause/risk.rs:44`). General retention must
  keep original objects/material readable after edits and restart; merely
  copying this struct does not prove AC4. Its pause-specific kinds,
  `head_id: None` construction and `fix` shape are independently confirmed,
  including the staged/head assertion
  (`crates/cadence/src/pause/risk.rs:38`,
  `crates/cadence/src/pause/risk.rs:83`,
  `crates/cadence/src/pause/risk.rs:103`,
  `crates/cadence/src/pause_service_tests.rs:411`).

- **Pause artifacts do not already round-trip through the frozen deferred
  API.** Pause writes findings with `fix` and a queue without the frozen
  resolved base/head fields, in two separate filesystem writes
  (`crates/cadence/src/pause_service.rs:735`,
  `crates/cadence/src/pause_service.rs:740`,
  `crates/cadence/src/pause_service.rs:758`). The frozen queue resolves and
  stores a committed range (`cadence-core/bin/planning/deferred-record.mjs:67`,
  `cadence-core/bin/planning/deferred-record.mjs:102`). The native visibility
  test counts one queue member; it does not establish general schema
  compatibility or verified settlement
  (`crates/cadence/src/pause_service_tests.rs:705`). In particular, regular
  ADJUDICATION sibling existence still hides a native queue member; phase 10
  owns replacing that rule with matching accepted settlement
  (`crates/cadence/src/next_action/observations.rs:192`,
  `.planning/ROADMAP.md:822`).

- **The treeless task promise conflicts with an unconditional durable-home
  promise.** Phase 9 requires a home for every fire, while phase 12 still says
  its treeless task arm creates no `.planning/` and reports its receipt
  unrecorded (`.planning/ROADMAP.md:775`, `.planning/ROADMAP.md:934`). The
  frozen inline path also has no review-record home
  (`cadence-core/workflows/task.md:263`). D-60/D-61 remain settled: every
  admitted phase-9 review needs retained identity and storage. The later
  task composition must expose an unavailable home honestly; an unrecorded
  task completion cannot serve as proof of durable review delivery. This
  context does not silently turn a review into full project scaffolding.

- **Inline-task artifact timing has two different frozen descriptions.**
  Debug and verify explicitly review staged fixes
  (`cadence-core/workflows/debug.md:117`,
  `cadence-core/workflows/verify.md:284`). Inline task's commit rail supplies
  the existing before-commit risk review obligation
  (`cadence-core/workflows/task.md:124`,
  `cadence-core/references/git-guard.md:121`), but its explicit later risk step
  reviews a completed range and says there is no staged diff left
  (`cadence-core/workflows/task.md:197`). These are workflow contracts, not
  evidence of a native local reviewer dispatch. Preserve uncommitted support
  without relabeling every task fire as staged or adding a duplicate fire.

- **Diagnosis is not an ordinary configured trigger in the frozen wiring.**
  Verify's second opinion supplies named file paths plus reported/cause text,
  expressly names no wiring-table trigger and always triages its fix list
  (`cadence-core/workflows/verify.md:259`). It needs snapshot identity and a
  durable home under D-60/D-61, but its existence does not authorize inventing
  a plan/risk default or dropping the user's fix selection. SHARED governs
  ordinary configured triggers (`.planning/ROADMAP.md:762`).

- **Public and routing prerequisites must be observed when this phase is
  planned.** Current query construction asserts exactly one operation and
  apply directly decodes `ExecutorPatch`; the execute skill admits only its
  executor (`crates/cadence/src/server.rs:241`,
  `crates/cadence/src/server.rs:397`, `skills/cad-execute/SKILL.md:14`). Phase
  7's grouped construction adaptation and phase 8's policy/routing answers
  are declared prerequisites, not proof of a callable review operation
  (`.planning/phases/7/CONTEXT.md:277`,
  `.planning/phases/8/CONTEXT.md:119`,
  `.planning/phases/8/CONTEXT.md:267`). Consume what has actually landed and
  verify tool loading in AC7. These prerequisite statements do not claim a
  successful live tool load. The task supplied a stable-tree premise; a final
  read-only status showed unrelated branch/crates changes during this pass,
  recorded in `.codex-analysis/phase-9-10-seam-repairs.md`. They were left
  untouched, and the audited source premises were not re-litigated.

- **Provider selection tests are not provider participation, and no live
  pilot is established by this inspection.** Local selection/lifecycle tests
  may script unavailable choices and fallback outcomes; actual provider
  transport and its repairs remain phase 10
  (`.planning/ROADMAP.md:768`, `.planning/ROADMAP.md:829`). This source audit
  observed no live review. Its test reads establish existing assertions only;
  AC7 stays unchecked until the owner reviews actual delivery episodes
  (`.planning/ROADMAP.md:789`, `.planning/phases/6/SUMMARY.md:16`).
