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

These are specifications for unimplemented phase work, not pending checks for
code expected to exist already. Function names below name the proposed unit;
they do not require public test APIs or particular module placement. Test each
unit directly, including its stated durable output. Call deterministic internal
collaborators for real. Stub only the listed I/O boundaries, including setup;
filesystem images are stub inputs, not instructions to start a process. No
criterion calls a model. Fixed finding prose is authored input data.

Each result is a literal value or a named field of that unit's returned record.
JSON `null` denotes explicit absence. Scalar/byte-limit inputs use the stated
number of literal characters or bytes, not a production serializer. Boundary
caps and deadlines supplied in examples are test inputs, not new product
defaults. A forbidden boundary means the unit must not access it. References
marked "former AC" retain the old numbering; AC references in the unchanged
scope, decisions, HANDOFF and assumptions also retain their historical meaning.

Fixture F is the literal finding
`{"file":"a.rs","line":1,"severity":"high","claim":"C","failure_scenario":"S"}`.
Q is a hand-authored UTF-8 return: a findings envelope containing, in order, F
with claim `quote: \"\n雪` (a quotation mark, newline and Unicode scalar),
then unchanged F. Its original ID is `o1`, its validator is `H4-1`, and its
finding IDs are `o1:0` and `o1:1`. No serializer under test supplies expected
bytes. Other named variants state their changed fields in the criterion.

H is a hand-authored saved admission with these literal fields:

```json
{"fire":"f1","replay_key":"k1",
 "scope":{"project":"p1","root":"r1","cycle":"c1"},
 "home":{"kind":"task","id":"h1","occurrence":"occ1"},
 "caller":"task","trigger":"risk_surface","specialist":null,
 "discriminator":"d1","plan":null,"anchor":null,"round":1,
 "artifact":"m1","gate":"deferred",
 "selection":{"mode":"single","choices":["A","B"],"fallback":"local"},
 "routing":{"answer":"local","evidence":"route1"},
 "roster":{"required":["A"],"completion":"all-required-terminal"},
 "contract":{"schema":"review-1","interpretation":"H1-H5",
             "validator":"H4-1"},"settlement":"pending"}
```

Its material `m1` retains `e1`, path `a.rs`, snapshot bytes `old\n`, with
line 1 mapped to bytes 0..3. Its attempt `a1` requests `model-A`; observed model
is null, launch is `launch1`, return is `return1`, view is `v1`. Successful
variants bind original `o1` containing F to that attempt. Roster variants name
their additional attempts explicitly. A queued variant has member `f1`.

Phase 9 commits independently hand-authored H1-H5 compatibility fixtures,
including boundary returns, material sides, every home, specialists and panel
states. Phase 10 reads those committed bytes; no test runs a producer workflow
to create them. The producer episode retained in MANUAL (former AC15) remains
manual evidence. Its historical ban on seeded records does not govern these
unit inputs or phase 10's committed fixtures. This authoring pass specifies
those fixture obligations; it does not create implementation/test files.

- [ ] AC1: Given retained target `m1` and advisory mode, `advisory_contract`
      returns
      `"Review retained target m1. Return raw JSON findings. Do not write files or append lifecycle records."`.
      Boundaries: none. (D-57; former AC1; `.planning/ROADMAP.md:746`,
      `.planning/ROADMAP.md:754`, `skills/cad-reviewer-contract/SKILL.md:114`,
      `crates/cadence/src/guard/bash.rs:129`,
      `crates/cadence/src/guard/bash.rs:461`).

- [ ] AC2: Given raw bytes `{"findings":[]}`, `forward_return` returns
      `submitted_bytes = "{\"findings\":[]}"`. Boundaries: none. (D-57; former
      AC1).

- [ ] AC3: Given advisory fire `f1` with delivery `pending`,
      `delivery_permission` returns `"wait-for-delivery"`. Boundaries: none.
      (D-57; former AC1).

- [ ] AC4: Given advisory fire `f1`, durable delivery `accepted`, severity
      `blocker` and combination `adjudicated`, `delivery_permission` returns
      `"continue"`. Boundaries: none. (D-57, D-65; former AC1).

- [ ] AC5: Given bound attempt `a1` and raw return Q, `accept_return` returns
      `originals[0].claim = "quote: \"\n雪"`. Boundaries: filesystem: durable
      write/sync success; clock: `100`. (D-63; former AC1).

- [ ] AC6: Given ordinary review input with effective gate `deferred`, routing
      `local` and home `h1`, `manual_plan_request` returns
      `{"caller":"manual-plan", "gate":"deferred", "routing":"local",
      "home":"h1"}`. Boundaries: none. (D-58; former AC2;
      `.planning/ROADMAP.md:762`, `cadence-core/config.schema.json:95`,
      `cadence-core/config.schema.json:101`,
      `.planning/phases/8/CONTEXT.md:280`,
      `skills/cad-plan-review/SKILL.md:39`,
      `cadence-core/references/review-record.md:128`).

- [ ] AC7: Given ordinary review input with effective gate `deferred`, routing
      `local` and home `h1`, `automatic_plan_request` returns
      `{"caller":"automatic-plan", "gate":"deferred", "routing":"local",
      "home":"h1"}`. Boundaries: none. (D-58; former AC2).

- [ ] AC8: Given ordinary review input with effective gate `deferred`, routing
      `local` and home `h1`, `task_review_request` returns `{"caller":"task",
      "gate":"deferred", "routing":"local", "home":"h1"}`. Boundaries: none.
      (D-58; former AC2).

- [ ] AC9: Given ordinary review input with effective gate `deferred`, routing
      `local` and home `h1`, `execute_review_request` returns
      `{"caller":"execute", "gate":"deferred", "routing":"local",
      "home":"h1"}`. Boundaries: none. (D-58; former AC2).

- [ ] AC10: Given ordinary review input with effective gate `deferred`,
      routing `local` and home `h1`, `debug_review_request` returns
      `{"caller":"debug", "gate":"deferred", "routing":"local", "home":"h1"}`.
      Boundaries: none. (D-58; former AC2).

- [ ] AC11: Given ordinary review input with effective gate `deferred`,
      routing `local` and home `h1`, `verify_review_request` returns
      `{"caller":"verify", "gate":"deferred", "routing":"local",
      "home":"h1"}`. Boundaries: none. (D-58; former AC2).

- [ ] AC12: Given gate `off` and delivery `accepted` without settlement,
      `ordinary_gate_action` returns `"off"`. Boundaries: none. (D-58, D-65;
      former AC2).

- [ ] AC13: Given gate `advisory` and delivery `accepted` without settlement,
      `ordinary_gate_action` returns `"continue"`. Boundaries: none. (D-58,
      D-65; former AC2).

- [ ] AC14: Given gate `deferred` and delivery `accepted` without settlement,
      `ordinary_gate_action` returns `"enqueue-before-continuation"`.
      Boundaries: none. (D-58, D-65; former AC2).

- [ ] AC15: Given gate `blocking` and delivery `accepted` without settlement,
      `ordinary_gate_action` returns `"wait-for-settlement"`. Boundaries:
      none. (D-58, D-65; former AC2).

- [ ] AC16: Given gate `adjudicated` and delivery `accepted` without
      settlement, `ordinary_gate_action` returns `"wait-for-settlement"`.
      Boundaries: none. (D-58, D-65; former AC2).

- [ ] AC17: Given trigger `plan`, phase-8 resolved gate `advisory` and no
      plan-floor elevation, `ordinary_request` returns `gate = "advisory"`.
      Boundaries: none. (D-58; former AC2).

- [ ] AC18: Given trigger `risk_surface`, phase-8 resolved gate `blocking` and
      no plan-floor elevation, `ordinary_request` returns `gate = "blocking"`.
      Boundaries: none. (D-58; former AC2).

- [ ] AC19: Given trigger `diff`, phase-8 resolved gate `off` and no
      plan-floor elevation, `ordinary_request` returns `gate = "off"`.
      Boundaries: none. (D-58; former AC2).

- [ ] AC20: Given supplied detector observation `match` with blocking risk
      gate, `risk_review_action` returns `"dispatch"`. Boundaries: none.
      (D-58; former AC2).

- [ ] AC21: Given supplied detector observation `nonmatch` with blocking risk
      gate, `risk_review_action` returns `"no-review"`. Boundaries: none.
      (D-58; former AC2).

- [ ] AC22: Given supplied detector observation `inconclusive` with blocking
      risk gate, `risk_review_action` returns `"wait-for-evidence"`.
      Boundaries: none. (D-58; former AC2).

- [ ] AC23: Given supplied detector observation `unanswered` with blocking
      risk gate, `risk_review_action` returns `"ask-surfaces"`. Boundaries:
      none. (D-58; former AC2).

- [ ] AC24: Given FIRST choices `["A", "B", "C"]` and terminal failure for A,
      `select_next` returns `{"request":"B"}`. Boundaries: none. (D-59; former
      AC3; `.planning/ROADMAP.md:768`,
      `cadence-core/references/review-triggers.md:159`,
      `cadence-core/references/review-triggers.md:217`).

- [ ] AC25: Given FIRST choices `["A", "B", "C"]`, failed A and usable B with
      finding F, `select_next` returns `{"request":null,
      "not_selected":["C"]}`. Boundaries: none. (D-59; former AC3).

- [ ] AC26: Given FIRST choices `["A", "B", "C"]` and usable empty A,
      `select_next` returns `{"request":null, "not_selected":["B", "C"]}`.
      Boundaries: none. (D-59; former AC3).

- [ ] AC27: Given missing bytes, `classify_return` returns `{"state":"failed",
      "reason":"missing-return"}`. Boundaries: none. (D-59; former AC3).

- [ ] AC28: Given bytes `{"findings":`, `classify_return` returns
      `{"state":"failed", "reason":"malformed-return"}`. Boundaries: none.
      (D-59; former AC3).

- [ ] AC29: Given FIRST choices `["A", "B"]`, both failed, and fallback
      `local`, `select_next` returns `{"request":"local"}`. Boundaries: none.
      (D-59; former AC3).

- [ ] AC30: Given exhausted FIRST choices and `usable empty` local fallback,
      `select_next` returns `{"state":"usable-complete", "request":null}`.
      Boundaries: none. (D-59; former AC3).

- [ ] AC31: Given exhausted FIRST choices and `failed` local fallback,
      `select_next` returns `{"state":"complete-with-failure",
      "request":null}`. Boundaries: none. (D-59; former AC3).

- [ ] AC32: Given failed attempt `a1` with `{"input":7, "output":3}` usage,
      `attempt_usage` returns `{"input":7, "output":3}`. Boundaries: none.
      (D-59; former AC3).

- [ ] AC33: Given failed attempt `a1` with absent usage, `attempt_usage`
      returns `{"input":null, "output":null}`. Boundaries: none. (D-59; former
      AC3).

- [ ] AC34: Given resolved base `b1`, head `h1` and retained bytes `old\n`,
      `retain_range` returns `{"kind":"committed-range", "base":"b1",
      "head":"h1", "bytes":"old\n"}`. Boundaries: filesystem: reads and
      durable writes; subprocess: fixed Git observations for range/staged,
      forbidden for named-file; clock: `100`. (D-60; former AC4;
      `.planning/ROADMAP.md:775`, `crates/cadence/src/pause/risk.rs:129`,
      `crates/cadence/src/pause_service.rs:799`,
      `crates/cadence/src/next_action/observations.rs:124`).

- [ ] AC35: Given base `b1`, authored index `t1` and bytes `old\n`,
      `retain_staged` returns `{"kind":"staged-tree", "base":"b1",
      "index":"t1", "head":null, "bytes":"old\n"}`. Boundaries: filesystem:
      reads and durable writes; subprocess: fixed Git observations for
      range/staged, forbidden for named-file; clock: `100`. (D-60; former
      AC4).

- [ ] AC36: Given named file `a.rs` with bytes `old\n`, `retain_file` returns
      `{"kind":"named-file", "path":"a.rs", "head":null, "bytes":"old\n"}`.
      Boundaries: filesystem: reads and durable writes; subprocess: fixed Git
      observations for range/staged, forbidden for named-file; clock: `100`.
      (D-60; former AC4).

- [ ] AC37: Given retained entry `e1` containing `old\n`, mutable source
      containing `new\n` and moved refs, `read_material` returns `"old\n"`.
      Boundaries: filesystem: retained bytes, forbid mutable-source reads;
      subprocess: forbid Git. (D-60; former AC4).

- [ ] AC38: Given saved bytes `old\n` and proposed bytes `new\n`,
      `material_matches` returns `false`. Boundaries: none. (D-60; former
      AC4).

- [ ] AC39: Given fire `f1/m1/round1` and return whose `artifact` is `m2`,
      `bind_return` returns `{"code":"artifact-mismatch", "fire":"f1",
      "field":"artifact"}`. Boundaries: none. (D-60, D-62; former AC4).

- [ ] AC40: Given fire `f1/m1/round1` and return whose `round` is `2`,
      `bind_return` returns `{"code":"round-mismatch", "fire":"f1",
      "field":"round"}`. Boundaries: none. (D-60, D-62; former AC4).

- [ ] AC41: Given named-file bytes `old\n`, `artifact_content_id` returns
      `"01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee"`.
      Boundaries: none. (D-60; former AC4).

- [ ] AC42: Given named-file bytes `new\n`, `artifact_content_id` returns
      `"7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c"`.
      Boundaries: none. (D-60; former AC4).

- [ ] AC43: Given durable attempt `a1` in state `pending-admission` without
      accepted originals, `recover_attempt` returns `{"attempt":"a1",
      "delivery":"interrupted", "original":null}`. Boundaries: filesystem:
      supplied durable image; clock: `100`. (D-62; former AC5;
      `.planning/ROADMAP.md:783`, `crates/cadence/src/pause_service.rs:758`,
      `crates/cadence/src/pause_service_tests.rs:454`,
      `crates/cadence/src/pause_service_tests.rs:683`,
      `crates/cadence/src/pause_service_tests.rs:713`).

- [ ] AC44: Given durable attempt `a1` in state
      `host-return-before-submission` without accepted originals,
      `recover_attempt` returns `{"attempt":"a1", "delivery":"interrupted",
      "original":null}`. Boundaries: filesystem: supplied durable image;
      clock: `100`. (D-62; former AC5).

- [ ] AC45: Given pending `a1`, F and a result-store sync failure,
      `accept_return` returns `{"code":"delivery-write-failed",
      "attempt":"a1", "acknowledged":false}`. Boundaries: filesystem: fail
      result sync; clock: `100`. (D-62; former AC5).

- [ ] AC46: Given accepted `a1/o1`, identical F and lost prior acknowledgment,
      `accept_return` returns `{"attempt":"a1", "original":"o1",
      "terminal":"accepted", "replayed":true}`. Boundaries: filesystem:
      accepted image and conditional writes; clock: `100`. (D-62; former AC5).

- [ ] AC47: Given accepted `a1/o1` and conflicting claim `Changed`,
      `accept_return` returns `{"code":"conflicting-return", "attempt":"a1",
      "original":"o1"}`. Boundaries: filesystem: accepted image, forbid
      original overwrite; clock: `100`. (D-62; former AC5).

- [ ] AC48: Given replay key `k1` inside a caller transaction with failed
      revision comparison, `admit_pending` returns
      `{"code":"revision-conflict", "replay_key":"k1", "dispatch":null}`.
      Boundaries: filesystem: reject conditional commit; clock: `100`. (D-62;
      former AC5).

- [ ] AC49: Given committed admission `k1/f1/a1` with acknowledgment lost,
      `admit_pending` returns `{"fire":"f1", "attempt":"a1",
      "replayed":true}`. Boundaries: filesystem: committed image; clock:
      `100`. (D-62; former AC5).

- [ ] AC50: Given two identical submissions for pending `a1`, with a barrier
      at conditional commit, `accept_return` returns `durable_terminal_count =
      1`. Boundaries: filesystem: conditional-write barrier and durable image;
      clock: `100`. (D-62; former AC5).

- [ ] AC51: Given F and conflicting claim `Changed` for `a1`, with F committed
      first at a boundary barrier, `accept_return` returns
      `{"code":"conflicting-return", "attempt":"a1", "original":"o1"}`.
      Boundaries: filesystem: conditional-write barrier; clock: `100`. (D-62;
      former AC5).

- [ ] AC52: Given durable accepted `o1` and missing disposable rendering,
      `recover_original` returns `{"file":"a.rs", "line":1, "severity":"high",
      "claim":"C", "failure_scenario":"S"}`. Boundaries: filesystem: durable
      F, rendering absent. (D-62; former AC5).

- [ ] AC53: Given saved `f1/round1/o1` containing F, with disposable rendering
      absent, `plan_completion_input` returns `{"kind":"raw", "fire":"f1",
      "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries:
      filesystem: saved record, rendering absent. (D-64; former AC6;
      `cadence-core/workflows/plan.md:466`,
      `cadence-core/workflows/execute.md:377`,
      `cadence-core/workflows/execute.md:418`,
      `cadence-core/workflows/task.md:275`,
      `cadence-core/workflows/report.md:73`,
      `cadence-core/bin/planning/deferred-record.mjs:26`,
      `cadence-core/bin/planning/deferred-record.mjs:54`,
      `cadence-core/workflows/milestone.md:114`,
      `skills/cad-land/SKILL.md:122`).

- [ ] AC54: Given saved `f1/round1/o1` containing F, with disposable rendering
      absent, `execute_completion_input` returns `{"kind":"raw", "fire":"f1",
      "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries:
      filesystem: saved record, rendering absent. (D-64; former AC6).

- [ ] AC55: Given saved `f1/round1/o1` containing F, with disposable rendering
      absent, `report_review_input` returns `{"kind":"raw", "fire":"f1",
      "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries:
      filesystem: saved record, rendering absent. (D-64; former AC6).

- [ ] AC56: Given saved `f1/round1/o1` containing F, with disposable rendering
      absent, `deferred_enqueue_input` returns `{"kind":"raw", "fire":"f1",
      "round":1, "original":"o1", "finding_ids":["o1:0"]}`. Boundaries:
      filesystem: saved record, rendering absent. (D-64; former AC6).

- [ ] AC57: Given supplied provisional revision 2 selecting `o1:0`, refuting
      `o1:1`, and no fix commit, `execute_fix_input` returns
      `{"kind":"provisional-selected", "revision":2, "finding_ids":["o1:0"],
      "fix":null}`. Boundaries: none. (D-64; phase 10 D-79; former AC6).

- [ ] AC58: Given supplied provisional revision 2 selecting `o1:0`, refuting
      `o1:1`, and no fix commit, `planned_task_fix_input` returns
      `{"kind":"provisional-selected", "revision":2, "finding_ids":["o1:0"],
      "fix":null}`. Boundaries: none. (D-64; phase 10 D-79; former AC6).

- [ ] AC59: Given supplied typed view `raw` at revision 2, `consumer_view`
      returns `kind = "raw"`. Boundaries: none. (D-64; former AC6).

- [ ] AC60: Given supplied typed view `provisional-selected` at revision 2,
      `consumer_view` returns `kind = "provisional-selected"`. Boundaries:
      none. (D-64; former AC6).

- [ ] AC61: Given supplied typed view `settled` at revision 2, `consumer_view`
      returns `kind = "settled"`. Boundaries: none. (D-64; former AC6).

- [ ] AC62: Given risk_surface rounds `f1/1` unruled and `f2/2` adjudicated,
      plus plan review `f3`, `landing_inventory` returns `{"unruled":["f1/1"],
      "adjudicated":["f2/2"]}`. Boundaries: none. (D-64; former AC6).

- [ ] AC63: Given risk_surface REVIEW/ADJUDICATION rounds 1 and 2, plus plan
      review, `milestone_review_inputs` returns `["REVIEW-risk_surface-1.md",
      "ADJUDICATION-risk_surface-1.md", "REVIEW-risk_surface-2.md",
      "ADJUDICATION-risk_surface-2.md"]`. Boundaries: none. (D-64; former
      AC6).

- [ ] AC64: Given saved delivery state `pending`, `completion_review_state`
      returns `{"state":"pending", "findings":null}`. Boundaries: none. (D-64;
      former AC6).

- [ ] AC65: Given saved delivery state `failed`, `completion_review_state`
      returns `{"state":"failed", "findings":null}`. Boundaries: none. (D-64;
      former AC6).

- [ ] AC66: Given saved delivery state `accepted-empty`,
      `completion_review_state` returns `{"state":"accepted", "findings":[]}`.
      Boundaries: none. (D-64; former AC6).

- [ ] AC67: Given an advisory REVIEW record with no deferred obligation,
      `deferred_members` returns `[]`. Boundaries: none. (D-61, D-64; former
      AC6).

- [ ] AC68: Given saved admission H, current gate `off`, routing `remote` and
      phase cursor `99`, `read_admission` returns `{"fire":"f1",
      "replay_key":"k1", "scope":{"project":"p1", "root":"r1", "cycle":"c1"},
      "home":{"kind":"task", "id":"h1", "occurrence":"occ1"}, "caller":"task",
      "trigger":"risk_surface", "specialist":null, "discriminator":"d1",
      "plan":null, "anchor":null, "round":1, "artifact":"m1",
      "gate":"deferred", "selection":{"mode":"single", "choices":["A", "B"],
      "fallback":"local"}, "routing":{"answer":"local", "evidence":"route1"},
      "roster":{"required":["A"], "completion":"all-required-terminal"},
      "contract":{"schema":"review-1", "interpretation":"H1-H5",
      "validator":"H4-1"}, "settlement":"pending"}`.
      Boundaries: filesystem: H, forbid current-config/cursor reads. (D-58,
      D-61, D-62; H1; former AC8).

- [ ] AC69: Given independent admission, saved sequence `1`, and material
      already used by `occ1`, `allocate_occurrence` returns `"occ2"`.
      Boundaries: filesystem: sequence read/write; clock: `100`. (D-61, D-62;
      former AC8).

- [ ] AC70: Given replay key `k1` already bound to `occ1`,
      `allocate_occurrence` returns `"occ1"`. Boundaries: filesystem: saved
      replay binding. (D-61, D-62; former AC8).

- [ ] AC71: Given saved diff hunk line 4 mapped to deleted `old.rs`, entry
      `e1`, base line 2, `source_reference` returns `{"entry":"e1",
      "path":"old.rs", "side":"base", "line":2}`. Boundaries: none. (D-60; H2;
      former AC9).

- [ ] AC72: Given rename `old.rs` to `new.rs`, hunk line 5 mapped to head
      entry `e2`, line 3, `source_reference` returns `{"entry":"e2",
      "path":"new.rs", "side":"head", "line":3}`. Boundaries: none. (D-60; H2;
      former AC9).

- [ ] AC73: Given deleted `old.rs` with base entry `e1` and no head entry,
      `material_side` returns `{"path":"old.rs", "side":"head",
      "availability":"absent"}`. Boundaries: none. (D-60; H2; former AC9).

- [ ] AC74: Given retained supporting `e3` outside primary paths, bytes
      `support\n`, deleted sources and unreachable ordinary refs,
      `read_material` returns `"support\n"`. Boundaries: filesystem: retained
      e3; subprocess: forbid mutable Git resolution. (D-60; H2; former AC9).

- [ ] AC75: Given manifest `m1`, later counter-evidence bytes `counter\n`,
      next entry `e4`, time `100`, no delivered attempt, `append_material`
      returns `{"entry":"e4", "acquired_at":100,
      "provenance":"later-evidence", "attempt":null}`. Boundaries: filesystem:
      append/sync; clock: `100`. (D-60; H2; former AC9).

- [ ] AC76: Given supporting bytes `support\n` delivered to `a1/v1`, next
      entry `e3`, time `100`, `append_material` returns `{"entry":"e3",
      "acquired_at":100, "provenance":"original-view", "attempt":"a1",
      "view":"v1"}`. Boundaries: filesystem: append/sync; clock: `100`. (D-60;
      H2; former AC9).

- [ ] AC77: Given saved diff bytes without required source entry `e1`,
      `validate_manifest` returns `{"code":"missing-source-material",
      "entry":"e1", "side":"base"}`. Boundaries: none. (D-60; H2; former AC9).

- [ ] AC78: Given saved `a1` requested `model-A`, observed model unknown,
      launch `launch1`, return `return1`; `a2` requests `model-B`,
      `read_attempt` returns `{"requested_model":"model-A",
      "observed_model":null, "launch":"launch1", "host_return":"return1"}`.
      Boundaries: filesystem: saved attempts. (D-62; H3; former AC10).

- [ ] AC79: Given return1 submitted for a2 instead of bound a1,
      `bind_host_return` returns `{"code":"host-return-conflict",
      "return":"return1", "bound_attempt":"a1", "submitted_attempt":"a2"}`.
      Boundaries: none. (D-62; H3; former AC10).

- [ ] AC80: Given return1 reused after acceptance for a1, now submitted for
      a2, `bind_host_return` returns `{"code":"host-return-conflict",
      "return":"return1", "bound_attempt":"a1", "submitted_attempt":"a2"}`.
      Boundaries: none. (D-62; H3; former AC10).

- [ ] AC81: Given accepted `a1` and duplicate observation `obs1`,
      `record_observation` returns `{"attempt":"a1", "observation":"obs1",
      "replayed":true}`. Boundaries: filesystem: saved observation and
      conditional write; clock: `100`. (D-62; H3; former AC10).

- [ ] AC82: Given late `obs2` with model `observed-A`, input usage 7, on
      terminal `a1/o1`, `record_observation` returns `{"attempt":"a1",
      "terminal_count":1, "original":"o1", "observed_model":"observed-A",
      "input_usage":7}`. Boundaries: filesystem: append/sync; clock: `100`.
      (D-62; H3; former AC10).

- [ ] AC83: Given two identical `obs2` usage observations racing at
      conditional commit, `record_observation` returns
      `durable_usage_observation_count = 1`. Boundaries: filesystem:
      conditional-write barrier; clock: `100`. (D-62; H3; former AC10).

- [ ] AC84: Given bytes `{"findings":[]}`, `validate_findings` returns
      `{"findings":[]}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC85: Given 100 copies of F in a findings envelope, `validate_findings`
      returns `findings.length = 100`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC86: Given F with `file` containing exactly 1024 copies of `雪`,
      `validate_findings` returns `accepted = true`. Boundaries: none. (D-63;
      H4; former AC11).

- [ ] AC87: Given F with `file` containing 1025 copies of `雪`,
      `validate_findings` returns `{"code":"field-too-long", "index":0,
      "field":"file", "limit":1024}`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC88: Given F with `file` equal to empty string, `validate_findings`
      returns `{"code":"blank-field", "index":0, "field":"file"}`. Boundaries:
      none. (D-63; H4; former AC11).

- [ ] AC89: Given F with `file` equal to string ` \t\n`, `validate_findings`
      returns `{"code":"blank-field", "index":0, "field":"file"}`. Boundaries:
      none. (D-63; H4; former AC11).

- [ ] AC90: Given F with `claim` containing exactly 2000 copies of `雪`,
      `validate_findings` returns `accepted = true`. Boundaries: none. (D-63;
      H4; former AC11).

- [ ] AC91: Given F with `claim` containing 2001 copies of `雪`,
      `validate_findings` returns `{"code":"field-too-long", "index":0,
      "field":"claim", "limit":2000}`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC92: Given F with `claim` equal to empty string, `validate_findings`
      returns `{"code":"blank-field", "index":0, "field":"claim"}`.
      Boundaries: none. (D-63; H4; former AC11).

- [ ] AC93: Given F with `claim` equal to string ` \t\n`, `validate_findings`
      returns `{"code":"blank-field", "index":0, "field":"claim"}`.
      Boundaries: none. (D-63; H4; former AC11).

- [ ] AC94: Given F with `failure_scenario` containing exactly 2000 copies of
      `雪`, `validate_findings` returns `accepted = true`. Boundaries: none.
      (D-63; H4; former AC11).

- [ ] AC95: Given F with `failure_scenario` containing 2001 copies of `雪`,
      `validate_findings` returns `{"code":"field-too-long", "index":0,
      "field":"failure_scenario", "limit":2000}`. Boundaries: none. (D-63; H4;
      former AC11).

- [ ] AC96: Given F with `failure_scenario` equal to empty string,
      `validate_findings` returns `{"code":"blank-field", "index":0,
      "field":"failure_scenario"}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC97: Given F with `failure_scenario` equal to string ` \t\n`,
      `validate_findings` returns `{"code":"blank-field", "index":0,
      "field":"failure_scenario"}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC98: Given F with line `1`, `validate_findings` returns
      `findings[0].line = 1`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC99: Given F with line `9007199254740991`, `validate_findings` returns
      `findings[0].line = 9007199254740991`. Boundaries: none. (D-63; H4;
      former AC11).

- [ ] AC100: Given F with line `0`, `validate_findings` returns
      `{"code":"invalid-line", "index":0, "field":"line", "min":1,
      "max":9007199254740991}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC101: Given F with line `1.5`, `validate_findings` returns
      `{"code":"invalid-line", "index":0, "field":"line", "min":1,
      "max":9007199254740991}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC102: Given F with line `9007199254740992`, `validate_findings` returns
      `{"code":"invalid-line", "index":0, "field":"line", "min":1,
      "max":9007199254740991}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC103: Given 101 copies of F, `validate_findings` returns
      `{"code":"too-many-findings", "limit":100, "actual":101}`. Boundaries:
      none. (D-63; H4; former AC11).

- [ ] AC104: Given an empty envelope with extra field `extra`,
      `validate_findings` returns `{"code":"unknown-field", "field":"extra"}`.
      Boundaries: none. (D-63; H4; former AC11).

- [ ] AC105: Given F with extra field `fix`, `validate_findings` returns
      `{"code":"unknown-field", "index":0, "field":"fix"}`. Boundaries: none.
      (D-63; H4; former AC11).

- [ ] AC106: Given JSON claim containing lone escaped surrogate `\uD800`,
      `validate_findings` returns `{"code":"invalid-unicode-scalar",
      "index":0, "field":"claim"}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC107: Given 4,194,305 input bytes with a 4,194,304-byte cap,
      `read_return` returns `{"code":"return-too-large", "limit":4194304}`.
      Boundaries: input stream: fixed chunks, stop at cap plus one; no model
      call. (D-63; H4; former AC11).

- [ ] AC108: Given saved Q under `o1/H4-1` with IDs `o1:0` and `o1:1`,
      `read_original` returns `identity = {"original":"o1", "contract":"H4-1",
      "finding_ids":["o1:0", "o1:1"]}`. Boundaries: filesystem: saved Q.
      (D-63; H4; former AC11).

- [ ] AC109: Given saved raw Q, `read_original` returns `findings[0].claim =
      "quote: \"\n雪"`. Boundaries: filesystem: saved Q. (D-63; H4; former
      AC11).

- [ ] AC110: Given saved literal return bytes `{"findings":[]}` under o1,
      `read_original` returns `raw_bytes = "{\"findings\":[]}"`. Boundaries:
      filesystem: saved original bytes. (D-63; H4; former AC11).

- [ ] AC111: Given a valid JSON findings envelope padded with JSON whitespace
      to 4,194,304 bytes and cap 4,194,304, `read_return` returns
      `accepted_bytes = 4194304`. Boundaries: input stream: fixed chunks.
      (D-63; H4; former AC11).

- [ ] AC112: Given F with severity `blocker`, `validate_findings` returns
      `findings[0].severity = "blocker"`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC113: Given F with severity `high`, `validate_findings` returns
      `findings[0].severity = "high"`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC114: Given F with severity `medium`, `validate_findings` returns
      `findings[0].severity = "medium"`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC115: Given F with severity `low`, `validate_findings` returns
      `findings[0].severity = "low"`. Boundaries: none. (D-63; H4; former
      AC11).

- [ ] AC116: Given F with severity `critical`, `validate_findings` returns
      `{"code":"invalid-severity", "index":0, "field":"severity",
      "actual":"critical"}`. Boundaries: none. (D-63; H4; former AC11).

- [ ] AC117: Given F without failure_scenario, `validate_findings` returns
      `{"code":"missing-field", "index":0, "field":"failure_scenario"}`.
      Boundaries: none. (D-63; H4; former AC11).

- [ ] AC118: Given panel admission with required voices A and B,
      `dispatch_roster` returns `required_requests = ["A", "B"]`. Boundaries:
      none. (D-59; H3; former AC12).

- [ ] AC119: Given adjudicated admission with required voices A and B,
      `dispatch_roster` returns `required_requests = ["A", "B"]`. Boundaries:
      none. (D-59; H3; former AC12).

- [ ] AC120: Given roster `["A", "B"]`, usable empty A and B state `pending`,
      `delivery_completion` returns `"incomplete"`. Boundaries: none. (D-59;
      H3; former AC12).

- [ ] AC121: Given roster `["A", "B"]`, usable empty A and B state
      `interrupted`, `delivery_completion` returns `"incomplete"`. Boundaries:
      none. (D-59; H3; former AC12).

- [ ] AC122: Given roster `["A", "B"]`, usable empty A and B state `success`,
      `delivery_completion` returns `"usable-complete"`. Boundaries: none.
      (D-59; H3; former AC12).

- [ ] AC123: Given roster `["A", "B"]`, usable empty A and B state
      `failed-no-fallback`, `delivery_completion` returns
      `"complete-with-failure"`. Boundaries: none. (D-59; H3; former AC12).

- [ ] AC124: Given roster `["A", "B"]`, usable empty A and B state
      `failed-fallback-success`, `delivery_completion` returns
      `"usable-complete"`. Boundaries: none. (D-59; H3; former AC12).

- [ ] AC125: Given roster `["A", "B"]`, usable empty A and B state
      `failed-fallback-failed`, `delivery_completion` returns
      `"complete-with-failure"`. Boundaries: none. (D-59; H3; former AC12).

- [ ] AC126: Given saved empty A and pending B after a lost process,
      `read_roster` returns `{"required":["A", "B"], "pending":["B"]}`.
      Boundaries: filesystem: saved roster. (D-59, D-63; H3; former AC12).

- [ ] AC127: Given A has `o1:[]`, B has `o2:[F]`, `read_voice_originals`
      returns `{"A":"o1", "B":"o2"}`. Boundaries: filesystem: saved originals.
      (D-63, D-65; former AC12).

- [ ] AC128: Given usable-complete adjudicated delivery without settlement,
      `settlement_state` returns `"pending"`. Boundaries: none. (D-65; former
      AC12).

- [ ] AC129: Given committed A/o1 with F and B/o2 with empty findings,
      `read_voice_originals` returns `findings = {"A":[{"file":"a.rs",
      "line":1, "severity":"high", "claim":"C", "failure_scenario":"S"}],
      "B":[]}`. Boundaries: filesystem: saved per-voice originals. (D-59; H3;
      former AC12).

- [ ] AC130: Given retained `file` target `m1` and ordinary routing `panel`,
      `minimalism_request` returns `{"specialist":"minimalism", "target":"m1",
      "reviewers":["base"], "ordinary_routing":null}`. Boundaries: none.
      (D-58; former AC13).

- [ ] AC131: Given retained `directory` target `m1` and ordinary routing
      `panel`, `minimalism_request` returns `{"specialist":"minimalism",
      "target":"m1", "reviewers":["base"], "ordinary_routing":null}`.
      Boundaries: none. (D-58; former AC13).

- [ ] AC132: Given retained `phase-range` target `m1` and ordinary routing
      `panel`, `minimalism_request` returns `{"specialist":"minimalism",
      "target":"m1", "reviewers":["base"], "ordinary_routing":null}`.
      Boundaries: none. (D-58; former AC13).

- [ ] AC133: Given retained listing `["a.rs"]` with bytes `old\n`, live
      listing `["b.rs"]`, `read_directory_target` returns
      `{"members":["a.rs"], "contents":{"a.rs":"old\n"}}`. Boundaries:
      filesystem: retained listing/bytes, forbid live directory reads. (D-60;
      H2; former AC13).

- [ ] AC134: Given selected decision `D-1` text `Decision` and inline context
      `Context`, `decision_review_target` returns `{"decision":"D-1",
      "text":"Decision", "context":"Context"}`. Boundaries: none. (D-58, D-60;
      former AC13).

- [ ] AC135: Given named entry `e1`, reported text `Reported` and cause text
      `Cause`, `diagnosis_target` returns `{"entries":["e1"],
      "reported":"Reported", "cause":"Cause"}`. Boundaries: none. (D-58, D-60;
      former AC13).

- [ ] AC136: Given saved specialist result `raw`, `read_specialist_result`
      returns `{"kind":"raw", "original":"o1"}`. Boundaries: filesystem: saved
      specialist record. (D-58, D-63; former AC13).

- [ ] AC137: Given saved specialist result `empty`, `read_specialist_result`
      returns `{"kind":"raw", "findings":[]}`. Boundaries: filesystem: saved
      specialist record. (D-58, D-63; former AC13).

- [ ] AC138: Given saved specialist result `failed`, `read_specialist_result`
      returns `{"kind":"failed", "findings":null}`. Boundaries: filesystem:
      saved specialist record. (D-58, D-63; former AC13).

- [ ] AC139: Given deferred fire `f1` in `phase` home with H1-H4 references,
      `enqueue_deferred` returns `{"member":"f1", "state":"unruled",
      "continuation":"allowed"}`. Boundaries: filesystem: atomic member
      commit; clock: `100`. (D-61; H5; former AC14).

- [ ] AC140: Given deferred fire `f1` in `task` home with H1-H4 references,
      `enqueue_deferred` returns `{"member":"f1", "state":"unruled",
      "continuation":"allowed"}`. Boundaries: filesystem: atomic member
      commit; clock: `100`. (D-61; H5; former AC14).

- [ ] AC141: Given deferred fire `f1` in `root-inline` home with H1-H4
      references, `enqueue_deferred` returns `{"member":"f1",
      "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem:
      atomic member commit; clock: `100`. (D-61; H5; former AC14).

- [ ] AC142: Given deferred fire `f1` in `root-debug` home with H1-H4
      references, `enqueue_deferred` returns `{"member":"f1",
      "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem:
      atomic member commit; clock: `100`. (D-61; H5; former AC14).

- [ ] AC143: Given deferred fire `f1` in `root-diagnosis` home with H1-H4
      references, `enqueue_deferred` returns `{"member":"f1",
      "state":"unruled", "continuation":"allowed"}`. Boundaries: filesystem:
      atomic member commit; clock: `100`. (D-61; H5; former AC14).

- [ ] AC144: Given deferred fire `f1` with failed queue sync,
      `enqueue_deferred` returns `{"code":"enqueue-write-failed", "fire":"f1",
      "continuation":"wait"}`. Boundaries: filesystem: fail queue sync; clock:
      `100`. (D-61; H5; former AC14).

- [ ] AC145: Given saved phase `f1`, task `f2`, root `f3` members, all
      disposable renderings absent, `enumerate_deferred` returns `["f1", "f2",
      "f3"]`. Boundaries: filesystem: all-home saved inventory. (D-61; H5;
      former AC14).

- [ ] AC146: Given gate `advisory` and no deferred obligation,
      `enqueue_deferred` returns `{"member":null}`. Boundaries: filesystem:
      forbid member writes. (D-61; H5; former AC14).

- [ ] AC147: Given gate `off` and no deferred obligation, `enqueue_deferred`
      returns `{"member":null}`. Boundaries: filesystem: forbid member writes.
      (D-61; H5; former AC14).

- [ ] AC148: Given modern pause `f1/a1`, ordinary finding F,
      `pause_delivery_request` returns `{"fire":"f1", "attempt":"a1",
      "fields":["file", "line", "severity", "claim", "failure_scenario"]}`.
      Boundaries: none. (D-62, D-63; former AC14).

- [ ] AC149: Given saved old finding with `fix:"S"` and no dispatch,
      `read_pause_origin` returns `{"provenance":"historical",
      "dispatch":null, "verified":false}`. Boundaries: filesystem: old bytes,
      forbid rewrite. (D-63; former AC14).

- [ ] AC150: Given saved f1 with H1 f1, H2 m1, H3 a1 and H4 o1 references,
      `enumerate_deferred` returns `members[0].references = {"fire":"f1",
      "manifest":"m1", "attempt":"a1", "original":"o1"}`. Boundaries:
      filesystem: saved all-home inventory. (D-61; H5; former AC14).

- [ ] AC151: Given completed receipt `d1`, no saved review binding, resolved
      diff gate `off` and absent review-only material, `review_handoff` returns
      `{"status":"ok","operation":"review-handoff","result":{"pending":false}}`.
      Boundaries: filesystem: stub accepted execution and empty review records;
      config/routing: stub gate `off`; forbid material and admission calls.
      (C01, D-58; truth 158).

- [ ] AC152: Given execute/diff request `k1`, supplied gate `advisory` and
      supplied routing answer `cad-reviewer-xhigh`, `admit` returns
      `{"status":"ok","operation":"review-admit","result":{"fire":"f1",
      "attempt":"f1-a1","replayed":false}}` and the durable contribution is
      `{"gate":"advisory","routing":{"answer":"cad-reviewer-xhigh",
      "evidence":"route:f1"}}`. Boundaries: filesystem: stub empty records,
      acquired material and successful contribution/commit; config/routing:
      forbidden current read; clock: `100`. (C01, D-58; H1; truth 158).

- [ ] AC153: Given public `Apply::Admit` input with caller `manual-plan` and
      the admission boundary returning `{"status":"ok",
      "operation":"review-admit","result":"ordinary"}`, `execute_inner`
      returns exactly that value without opening a session first. Boundaries:
      admission: stub ordinary refresh arm; filesystem/config: forbidden before
      the stub. (D-58; truth 158).


- [ ] AC154: Given saved replay `k1/f1/a1` and no usable current resolution,
      `admit` returns `{"status":"ok","operation":"review-admit","result":{
      "fire":"f1","attempt":"a1","replayed":true}}`. Boundaries:
      filesystem: stub saved replay; config/routing/material: forbidden.
      (D-58, D-61; H1; truth 158).

- [ ] AC155: Given public admission input with `caller = "task"`, `execute`
      calls the stubbed `execute_inner` once and passes `caller = "task"`;
      `execute` returns `{"status":"ok","operation":"review-admit",
      "result":"inner"}`. Boundaries: `execute_inner` stub returns the literal
      result; filesystem, config and clock: forbidden. (D-58; truth 158).

- [ ] AC156: Given handoff input with `dispatch = "d1"`, `execute_inner`
      calls the stubbed `review_handoff` once and passes `dispatch = "d1"`;
      `execute_inner` returns `{"status":"ok","operation":"review-handoff",
      "result":"outer"}`. Boundaries: `review_handoff` stub returns the literal
      result; filesystem, config and clock: forbidden. (C01, D-58; truth 158).

- [ ] AC157: Given public admission input with `caller = "manual-plan"`,
      `execute_inner` calls the stubbed `admit` once and passes
      `resolution = "refresh"`; `execute_inner` returns
      `{"status":"ok","operation":"review-admit","result":"ordinary"}`.
      Boundaries: `admit` stub returns the literal result; filesystem, config
      and clock: forbidden. (D-58; truth 158).

- [ ] AC158: Given completed `dispatch = "d1"` and the captured execution
      resolution, `review_handoff` calls the stubbed `admit` once and passes
      `gate = "advisory"` and `routing.answer = "cad-reviewer-xhigh"`;
      `review_handoff` returns `{"status":"ok","operation":"review-admit",
      "result":"resolution-sentinel"}`. Boundaries: filesystem: stub accepted
      execution and empty review records; config/routing: stub the one outer
      answer; `admit` stub records the supplied resolution and returns the
      literal result; clock: `100`. (C01, D-58; H1; truth 158).

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
