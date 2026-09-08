# Phase 10: Review evidence verification - Context

Gathered: 2026-09-07
Feeds: /cad-plan 10

## Scope boundary

In: Decide whether settlement evidence can be believed before clearing a gate
or deriving findings for filing. Phase 9 DELIVERS AND IDENTIFIES findings;
phase 10 VERIFIES SETTLEMENT against those saved findings and identities.
Receiving a review is not accepting its rulings, and a completed dispatch is
not a cleared settlement gate (`.planning/ROADMAP.md:730`,
`.planning/ROADMAP.md:762`, `.planning/ROADMAP.md:796`,
`.planning/ROADMAP.md:801`). VERIFIED, repair ownership and PILOT are settled
owner decisions, not questions for another interview
(`.codex-analysis/phase-9-decision-brief.md:85`,
`.codex-analysis/phase-9-decision-brief.md:97`,
`.codex-analysis/phase-9-decision-brief.md:109`, `.planning/ROADMAP.md:838`,
`.planning/ROADMAP.md:852`).

Independent inspection of source and existing test assertions confirms TWO
already built, TWO partial and NINE absent capabilities for THIS half: thirteen
of the brief's original eighteen units. Eleven still require work. The combined
2 built / 5 partial / 11 absent figure describes the unsplit subsystem, not this
phase. C01/C02/C04/C05/C06 belong to delivery and identity and are excluded
here; the live pilot is a separate, still-unverified acceptance obligation
(`.codex-analysis/phase-9-decision-brief.md:123`,
`.planning/ROADMAP.md:734`, `.planning/ROADMAP.md:852`). The classifications
below retain the audited source facts on `cadence/binary-owns-process`, without
claiming fresh test results.

Already built, retained as dependencies and regression coverage:

- C10, local filed/declined identity and uncertainty bookkeeping. Item revisions
  preserve identity, record filing and decline, and keep declined identities out
  of recall while retaining explicit lookup. Existing assertions cover restart
  and guarded uncertainty (`crates/cadence/src/store/items.rs:15`,
  `crates/cadence/src/store/items.rs:47`,
  `crates/cadence/src/store/items.rs:83`, `crates/cadence/tests/store.rs:170`,
  `crates/cadence/tests/store.rs:235`). This is not remote issue creation.
- C13, durable scoped review-override receipts. They retain range, trigger,
  plan, correlation, round, anchor, finding-record reference and counts;
  recovery filters enclosing scope and range. Existing assertions cover two
  ranges, one answer, restart and preserved legacy evidence
  (`crates/cadence/src/evidence/overrides.rs:35`,
  `crates/cadence/src/evidence_service.rs:47`,
  `crates/cadence/src/evidence_service_tests.rs:1381`). Their validation only
  requires a nonblank finding-record reference; it does not establish that the
  named record exists or is valid (`crates/cadence/src/evidence/overrides.rs:134`).

In, specifically: complete two partial capabilities:

- C09, deferred creation/observation/carry/settlement. Pause already writes
  REVIEW and DEFERRED artifacts; the production reader enumerates phase and
  deferred homes. Phase 9 owns initial creation and extension to all admitted
  homes; this phase consumes that producer/enumerator and adds general carry,
  retention and verified supersession. A regular sibling currently hides the
  member without reading settlement (`crates/cadence/src/pause_service.rs:711`,
  `crates/cadence/src/pause_service.rs:751`,
  `crates/cadence/src/next_action/observations.rs:124`,
  `crates/cadence/src/next_action/observations.rs:192`,
  `crates/cadence/src/pause_service_tests.rs:683`).
- C12, triage and a durable one-extra-round allowance. Pause implements a
  narrowed second round from a recorded fix answer and removes the fix option
  after that round. General fire/trigger scope, later-session deferred triage
  and verified settlement remain owed
  (`crates/cadence/src/pause_service.rs:890`,
  `crates/cadence/src/pause_service.rs:981`,
  `crates/cadence/src/pause_service_tests.rs:713`).

In, also: build nine absent capabilities, keeping the original counting units:

- C03, provider credential lookup, payload construction, bounded transport,
  validation and outer timeout; C07, verified per-voice adjudication; C08,
  minimalism result verification; C11, human filing choice, tracker lookup,
  creation and ambiguous-outcome reconciliation. Their implementations are
  frozen JavaScript or workflow instructions, while the inspected native
  public query/apply handles execution only and its module roots expose no
  provider, adjudication, minimalism or remote-filing service
  (`cadence-core/bin/review-provider.mjs:275`,
  `cadence-core/bin/review-provider.mjs:1055`,
  `cadence-core/bin/lib/adjudication-record.mjs:328`,
  `cadence-core/workflows/minimalism-review.md:102`,
  `cadence-core/bin/issue-filing.mjs:718`, `crates/cadence/src/lib.rs:3`,
  `crates/cadence/src/main.rs:1`, `crates/cadence/src/server.rs:223`,
  `crates/cadence/src/server.rs:394`).
- C14-C18, the five repairs GH-237, GH-239, GH-240, GH-250 and GH-251. They
  arrive with their native provider/filing code here, not as five additional
  subsystems or work charged to both halves. The exact defects are the invalid
  Gemini-component substitution, early HTTP refusal, insufficient integer
  bounds, local-mirror read preemption, and unmeasured GitLab search respectively
  (`cadence-core/bin/review-provider.mjs:1142`,
  `cadence-core/bin/review-provider.mjs:1335`,
  `cadence-core/bin/review-provider.mjs:988`,
  `cadence-core/bin/issue-filing.mjs:735`,
  `cadence-core/bin/lib/filing-decision.mjs:730`, `.planning/ROADMAP.md:838`).

Deliberately narrow: verification checks IDENTITIES AND AVAILABLE EVIDENCE. It
does not automate engineering judgment; whether a finding is true, a fix is
sufficient, or counter-evidence refutes an argument remains human or model
review. An existing commit or valid line reference is evidence that can be
inspected, not proof of correctness (`docs/rationale/architecture-v4.md:64`,
`docs/rationale/architecture-v4.md:67`, `.planning/ROADMAP.md:814`,
`.codex-analysis/phase-9-decision-brief.md:103`).

The prerequisite is phase 9's normative HANDOFF H1–H5 in
`.codex-analysis/phase-9-context-draft.md`. The following is a consumer summary,
not a second schema or implementation assignment. Phase 10 AC1 must reopen
unchanged artifacts produced by phase 9 AC15's native code path; fixtures may
not fabricate missing policy, model, manifest, roster or origin fields:

- A pending fire record with immutable identity: enclosing project/root/cycle
  and occurrence, admitted phase/task/root home, trigger, discriminator,
  applicable plan/anchor, round, artifact reference and admitted gate/selection
  policy. A repeated path or current phase cursor cannot stand in for occurrence
  (`.planning/ROADMAP.md:762`, `.planning/ROADMAP.md:775`,
  `.planning/ROADMAP.md:783`, `crates/cadence/src/evidence/mod.rs:17`). Consume
  H1's saved resolved policy, schema interpretation and required roster even
  after config or phase-cursor changes.
- A material manifest and recoverable reviewed material: resolved base/head
  objects for a committed range, base/index-tree identity for staged work, or
  retained bytes/content identities for named-file snapshots; reviewed scope,
  paths and material sides must allow the cited lines to be recovered after
  edits or deletion. A digest of lost bytes is insufficient
  (`.planning/ROADMAP.md:775`, `.planning/ROADMAP.md:814`,
  `.codex-analysis/phase-9-decision-brief.md:79`). H2 includes source-side/hunk
  mappings behind saved diff files, directory membership, inline targets and
  separately identified supporting/later evidence outside primary paths.
- A dispatch/attempt ledger bound to that fire and material: ordered attempt
  identities, reviewer voice and model selection, observed participation and
  result/failure state, actual fallback outcome, and any available usage.
  Requested settings and observed facts remain distinguishable; empty usable
  returns retain their voice (`.planning/ROADMAP.md:768`,
  `.planning/ROADMAP.md:783`, `.planning/ROADMAP.md:802`). Consume H3's bound
  host launch/return observations and completion status; unknown observed
  models are not inferred from requested settings or caller-supplied labels.
- Binary-persisted original returns bound to their dispatches, preserving every
  finding's order, file, line, raised severity, exact claim and exact
  `failure_scenario`, including a valid empty findings array. Stable record
  identity/version and durable acceptance/closure acknowledgment must make
  replay and comparison possible (`.planning/ROADMAP.md:746`,
  `.planning/ROADMAP.md:758`, `.planning/ROADMAP.md:783`). H4's complete bounded
  admission contract already applies to every phase-9 accepted original.
- Queries or recoverable renderings that enumerate unresolved/deferred fires
  in every admitted home and expose those originals, material and lifecycle
  states after restart. Raw originals and any compatibility survivor view are
  distinct; phase 10 supplies provisional triage selection and verified settlement
  (`.planning/ROADMAP.md:758`, `.planning/ROADMAP.md:779`,
  `cadence-core/references/risk-surface.md:180`, `.planning/ROADMAP.md:822`).

Allocation at the seam is explicit: phase 9 owns initial material retention,
home allocation, specialist/local dispatch, complete roster delivery, return
persistence, bounded return admission and exactly-once closure. Phase 9 alone
owns the initial deferred producer and all-home enumerator. Phase 10 reuses
that same findings validator across its consumers and owns comparison of rulings
to persisted origin, provisional triage, material/citation
verification, provider adapters using the same lifecycle, and deferred
carry/retention and supersession. Provider-specific redaction or payload
selection must record the actual reviewed view and its correspondence to the
admitted material here, rather than claiming the provider saw every original
byte (`.planning/ROADMAP.md:746`, `.planning/ROADMAP.md:775`,
`.planning/ROADMAP.md:807`, `.planning/ROADMAP.md:822`,
`.planning/ROADMAP.md:829`, `cadence-core/references/review-cross-model.md:114`).

Out: rebuilding phase 9's delivery/identity substrate, changing WAIT or FIRST,
forcing advisory findings through adjudication, or replacing the two completed
foundations. Out also: whole planning/execution/verification/landing workflows,
automatic deletion from minimalism, automatic issue creation without human
choice, and edits to frozen `cadence-core/`. This phase supplies their verified
review service and consumer contracts; its pilot must exercise those contracts
without claiming the later workflows are migrated (`.planning/ROADMAP.md:746`,
`.planning/ROADMAP.md:768`, `.planning/ROADMAP.md:801`,
`.planning/ROADMAP.md:829`, `cadence-core/workflows/minimalism-review.md:113`,
`.planning/REQUIREMENTS.md:11`).

## Durable decisions

- D-70 (VERIFIED consumes recorded origin): Settlement takes a fire identity
  and references the binary's accepted originals, dispatch records and retained
  material. Caller-supplied copies are claims to compare, never a replacement
  source of truth. Refuse missing prerequisites and leave settlement pending;
  delivery completion alone cannot clear it. Binary-persisted origin describes
  the delivered protocol and recorded host observations; phase 9 D-57 provides
  no shell-write prevention guarantee. Consume phase 9's five-artifact
  handoff above rather than quietly building another delivery system here
  (`.planning/ROADMAP.md:762`, `.planning/ROADMAP.md:801`,
  `cadence-core/bin/lib/adjudication-record.mjs:351`). VERIFIED establishes
  identity and available evidence only; the truth of findings stays with human
  or model review (`docs/rationale/architecture-v4.md:67`). If wrong: two
  mutually consistent fabricated payloads pass as an original and its ruling,
  or phase 10 absorbs the delivery half that the owner deliberately split out.

  This phase owns pause's mandatory settlement cutover. Route every modern
  pause blocking/adjudicated clearance, including low-only, empty and override
  cases, through this common verification authority over phase 9's delivered
  records. Remove alternate clearance from bare `AcceptedResult` or legacy
  shape/sibling checks. Preserve old records verbatim with historical/unverified
  provenance; do not manufacture dispatch or rename `fix` into a witnessed
  `failure_scenario`. An outstanding legacy obligation remains visible and
  blocked from evidentiary clearance until an explicitly linked new review
  supplies the required origin and verified disposition. A historical override
  alone cannot authenticate missing origin. Existing completed history is not
  rewritten. Phase 9 only supplies the common pause delivery/identity path;
  conversion of live clearance and its regression setup belongs here
  (`crates/cadence/src/pause_service.rs:654`,
  `crates/cadence/src/pause_service.rs:958`,
  `crates/cadence/src/pause_service.rs:961`,
  `crates/cadence/src/pause_service.rs:986`,
  `crates/cadence/src/pause/risk.rs:103`).

- D-71 (One bounded findings validator): Reuse the native validator produced
  by phase 9 D-63/H4 for provider returns, settlement inputs, deferred findings
  and minimalism. Its five fields, severity set, 100-finding limit, 1024/2000
  Unicode-scalar bounds, nonblank strings, safe positive integer lines and
  4 MiB pre-parse response bound are already phase-9 admission requirements.
  Do not trim, normalize Unicode or truncate accepted originals
  (`cadence-core/bin/review-provider.mjs:885`,
  `cadence-core/bin/review-provider.mjs:1251`,
  `cadence-core/bin/lib/adjudication-record.mjs:285`). Unicode scalar counting
  replaces the frozen provider/code-unit mismatch in phase 9. Phase 10 adds
  bounded settlement envelopes, with aggregate limits derived from the saved
  roster and bounded findings/ruling fields, enforced before unbounded
  accumulation or parsing; the plan must record the numeric envelope budget
  (`cadence-core/bin/review-provider.mjs:335`,
  `cadence-core/bin/review-provider.mjs:1264`,
  `cadence-core/bin/lib/adjudication-record.mjs:292`). Material-side metadata
  sits beside the original finding, not inside a rewritten claim. Open phase-9
  accepted records under their recorded contract, preserving all original IDs
  and bytes: phase 10 may reject unsupported evidence, not newly reject their
  admitted shape. Unknown/older historical contracts remain unverified with
  diagnostics and a linked new-review recovery path under D-70; no silent
  rewrite, normalization or permanent unexplained gate dead end is permitted
  (`.planning/ROADMAP.md:807`). If wrong: delivery accepts findings that later
  cannot be settled, a whitespace response appears usable, or preservation
  changes the very strings settlement promises to compare.

- D-72 (Per-voice correspondence is complete): Consume phase 9 H3's frozen
  roster and delivery-completion barrier before evaluating settlement. Refuse
  while any required slot is pending/interrupted/uncertain; an unsuccessful
  terminal slot cannot become a successful empty voice or be omitted to obtain
  clean clearance. Require exactly one ruling
  per persisted finding per actual successful voice, joined by fire, dispatch
  and finding identity/order. Match the full original finding and compare claim
  and scenario exactly; refuse paraphrase, omissions, duplicates, invented
  voices/models and substitution of a failed attempt for a usable review. Keep
  the successful empty-return roster and the separate failed-attempt history
  (`.planning/ROADMAP.md:807`, `.planning/ROADMAP.md:831`,
  `cadence-core/bin/lib/adjudication-record.mjs:339`,
  `cadence-core/bin/lib/adjudication-record.mjs:391`,
  `cadence-core/bin/lib/adjudication-record.mjs:413`,
  `cadence-core/bin/lib/adjudication-record.mjs:483`). Preserve survived,
  downgraded and refuted meanings; retain convergent entries separately by
  raising voice and derive convergence/counts from accepted entries. Commit
  valid settlement and its gate/queue consequence durably before acknowledgment;
  a refusal may record its reason but changes neither originals nor clearance
  (`cadence-core/bin/lib/adjudication-record.mjs:88`,
  `cadence-core/bin/lib/adjudication-record.mjs:260`,
  `cadence-core/bin/lib/adjudication-record.mjs:526`,
  `.planning/ROADMAP.md:820`, `.planning/ROADMAP.md:822`). If wrong: a panel is
  fabricated, a troublesome finding disappears, or a crash leaves a cleared
  gate with no valid settlement behind it.

- D-73 (Resolve evidence and preserve missing source): Resolve every supplied
  fix ID as an unambiguous real commit, on every ruling where supplied, and
  retain its resolved identity and inspectable evidence. A hex-shaped blob,
  tree, nonexistent or ambiguous object cannot pass. Validate citation path,
  material side, reviewed membership and line identity against the retained
  artifact; do the same for relied-on counter-evidence. A path existing at
  current head or an in-range line number in different bytes is insufficient
  (`cadence-core/bin/lib/adjudication-record.mjs:438`,
  `cadence-core/bin/lib/adjudication-record.mjs:444`,
  `cadence-core/bin/planning/adjudication.mjs:90`, `.planning/ROADMAP.md:814`).
  Use H2's source-side mapping for named diff files and renames, not the diff's
  own line numbers. Supporting/counter-evidence outside primary changed paths
  is allowed when retained with its own immutable identity and acquisition/view
  provenance. Later evidence is checked as later evidence; it is not proof the
  original reviewer saw it. Acquire additional evidence through phase 9's
  material operation, then perform all citation/claim relation checks here.
  A deletion can legitimately cite the base side; a never-committed file can
  cite retained snapshot material. Preserve both findings, their exact strings
  and explicit base/head/material-side status in queries and derived records.
  If no valid material can be recovered, retain the finding visibly as
  unverified and refuse evidentiary clearance, rather than dropping it. Fix
  existence and citation identity do not prove that the fix repairs the claim
  or that counter-evidence wins the argument
  (`cadence-core/bin/planning/adjudication.mjs:63`,
  `.planning/ROADMAP.md:814`, `docs/rationale/architecture-v4.md:67`). If wrong:
  fabricated evidence clears a blocker, or stricter checks erase valid findings
  about deleted or uncommitted source.

- D-74 (Minimalism verifies its own result): Consume the shared delivery and
  identity record, validate the returned findings with D-71 and expose claim
  and scenario verbatim. Severity ranks deletion value; failure_scenario states
  the cost of keeping the surface. Preserve the named target, a usable empty
  result and failed-return distinction. This specialist pass has one base
  reviewer, no ordinary gate/config routing, no PASS/FAIL and no automatic
  deletion; the user chooses what to delete. Phase 9 supplies delivery, while
  this phase owns these result-verification and presentation semantics
  (`cadence-core/workflows/minimalism-review.md:98`,
  `cadence-core/workflows/minimalism-review.md:102`,
  `cadence-core/workflows/minimalism-review.md:126`,
  `cadence-core/workflows/minimalism-review.md:133`,
  `.planning/ROADMAP.md:810`). If wrong: a delete-list becomes a blocking
  verdict, a paraphrase replaces the original argument, or a failed pass looks
  like nothing was worth deleting.

- D-75 (Provider arms use the delivery lifecycle): Introduce the OpenAI,
  Gemini and DeepSeek review adapters with environment-first credential lookup,
  file fallback, credential fencing, bounded payload/response handling and
  sanitized diagnostics. Refuse over-cap payloads before spending rather than
  silently truncating what a voice reviewed; record the fenced view and its
  material mapping. The native request and outer operation deadlines must
  leave time for a durable failure acknowledgment in the actual host
  (`cadence-core/bin/review-provider.mjs:275`,
  `cadence-core/bin/review-provider.mjs:480`,
  `cadence-core/bin/review-provider.mjs:504`,
  `cadence-core/bin/review-provider.mjs:705`,
  `cadence-core/bin/review-provider.mjs:1055`,
  `cadence-core/references/review-cross-model.md:120`). FIRST is inherited:
  sequential configured attempts stop at the first usable review, including
  an empty array; all failures lead to the local fallback and its actual
  outcome. Reuse phase 9's pending/return/closure records for every attempt,
  including no-key, timeout, malformed response and failed fallback. No second
  trace lifecycle and no invented observed usage or participation
  (`.planning/ROADMAP.md:768`, `.planning/ROADMAP.md:783`,
  `.planning/ROADMAP.md:829`,
  `cadence-core/references/review-cross-model.md:131`). If wrong: one configured
  reviewer spends for a panel, a dead provider leaves an open dispatch, or a
  sanitized fragment is reported as a review of bytes it never received.

- D-76 (GH-237 and GH-240 preserve unavailable usage): The frozen defect is
  precise: tokenCount accepts any finite nonnegative number, including fractions
  and unsafe integers; Gemini converts an invalid component to undefined and
  then adds zero for it when the other component is usable, without a checked
  sum (`cadence-core/bin/review-provider.mjs:988`,
  `cadence-core/bin/review-provider.mjs:1142`). Require bounded nonnegative
  integers and checked addition. Track absent, invalid and valid zero
  separately; an invalid or overflowed candidate/thought count makes the
  normalized Gemini output unavailable, even if its sibling is valid. Omission
  is not evidence of zero unless the provider contract establishes that meaning;
  record the chosen omission rule and its evidence. Valid input usage can still
  survive unavailable output. Keep bounded, sanitized raw usage when available
  (`cadence-core/bin/review-provider.mjs:981`,
  `cadence-core/bin/review-provider.mjs:1005`, `.planning/ROADMAP.md:838`). These
  repairs belong here with the normalizer, under the settled NINE allocation
  now embodied in phase 10 (`.planning/ROADMAP.md:796`,
  `.planning/ROADMAP.md:838`). If wrong: malformed accounting becomes a plausible
  low bill or arithmetic overflow becomes a recorded token count.

- D-77 (GH-239 preserves usage before HTTP refusal): The frozen non-2xx branch
  exits before extractUsage, despite already having the response. Extract valid
  available response usage before status-dependent refusal and retain it on the
  same failed attempt. Still refuse the review; usage does not make error text
  into findings. A response with no usable usage and a pre-request failure both
  retain absence, never a fabricated zero; do not expose unbounded response or
  credential-bearing diagnostics (`cadence-core/bin/review-provider.mjs:1335`,
  `cadence-core/bin/review-provider.mjs:1350`,
  `cadence-core/bin/review-provider.mjs:981`, `.planning/ROADMAP.md:847`).
  If wrong: charged failed calls disappear from accounting or a failed provider
  acquires a false successful review.

- D-78 (Deferred supersession requires matching valid settlement): Reuse the
  initial deferred producer and unfiltered all-home enumerator delivered by
  phase 9 D-61/H5. This phase adds carry, retention and verified filtering,
  not a second home-discovery extension. Supersession joins the full occurrence,
  fire, artifact and round, recorded voices and exact originals to valid
  settlement, never just a regular
  sibling. Apply the same validity authority to next-action, carry and later
  consumers; malformed, unreadable, stale or forged settlements leave members
  visible with a diagnostic (`crates/cadence/src/pause_service.rs:711`,
  `crates/cadence/src/next_action/observations.rs:192`,
  `cadence-core/bin/planning/core.mjs:1042`, `.planning/ROADMAP.md:822`). Carry
  must preserve the complete evidence closure: originals, voices, material,
  identities, rulings/receipts, provisional selections, parent/child lineage and
  unspent/spent round state, with no conflicting overwrite or prune-before-
  preservation. A later round alone is not matching settlement: only D-79's
  verified parent transition produces a settlement for the parent's exact
  original identity/round. Initial enqueue, homes and retention are phase 9;
  this general carry/settlement service is phase 10
  (`.planning/ROADMAP.md:775`, `.planning/ROADMAP.md:822`,
  `cadence-core/workflows/milestone.md:103`,
  `cadence-core/workflows/milestone.md:128`). If wrong: an empty JSON file clears
  a queue, a different fire settles this one, or pruning removes the evidence
  needed for later review.

- D-79 (Triage spends one extra round and retains overrides): Generalize
  pause's persisted allowance to the full trigger/occurrence/plan-or-root fire
  identity, including deferred triage in a later session. This phase owns the
  provisional triage view, verified parent-round transition and atomic re-arm
  operation detailed below. Review the fix material plus the original
  blocker list; an exhausted or unusable second review stops for human choice
  (`crates/cadence/src/pause_service.rs:890`,
  `cadence-core/references/triage-gate.md:138`,
  `cadence-core/references/triage-gate.md:192`, `.planning/ROADMAP.md:825`). Reuse
  the existing reasoned authorization and scoped receipt machinery, validating
  its finding reference and derived counts against D-72/D-73 before spending
  it as settlement. Overrides preserve the actual ruling and unresolved
  finding; an override is not a fix or a refutation and cannot authenticate
  invented evidence. Match occurrence and round as well as range when consuming
  the receipt (`crates/cadence/src/evidence/overrides.rs:35`,
  `crates/cadence/src/evidence/overrides.rs:55`,
  `crates/cadence/src/evidence/overrides.rs:158`,
  `cadence-core/bin/lib/adjudication-record.mjs:472`). If wrong: restarting buys
  another paid review, an answer spills into another fire, or a receipt with
  invented finding references launders invalid settlement.

  **Before a fix exists:** Persist a typed `provisional-selected` view with
  view ID/revision, occurrence/fire/round, material and original-record IDs,
  exact per-voice finding IDs, provisional dispositions, selected-to-fix IDs,
  selection actor and required saved human answer/choice references. Match
  every selection/ruling to immutable originals and available citation evidence
  using D-72/D-73, without demanding a nonexistent fix commit. Preserve raised
  text/severity and keep refuted, unselected and unanswered entries visible
  outside the fix list. Refuse invented IDs, stale choice revisions and any
  claim that this view is final settlement. Fix continuations query this exact
  revision and its original text; no coordinator distillation is needed.
  Selection does not clear a gate, supersede deferred work or supply filing
  candidates. Final rulings later reference the selection revision and verified
  fix/counter-evidence or scoped override; they do not rewrite originals.

  **Round lineage:** A narrowed repair has a new child fire/artifact and round
  two, but preserves the parent's occurrence and root obligation/allowance ID.
  Persist parent fire/round/artifact, original blocker finding IDs, selected
  view revision, child fire/round/new material and the exact relation to the
  fix being reviewed. New child findings retain their own voice/original IDs.
  A completed child, including a clean empty child, cannot by itself erase
  round-one blockers. Verify a disposition for each linked parent finding
  against its originals plus the retained fix and child evidence, then durably
  record an explicit parent settlement transition keyed to the parent's exact
  fire/artifact/round. This permits round two to settle round one while both
  original records remain unchanged. Unaddressed parent blockers and unresolved
  new child findings remain visible and retain their respective gate/queue
  consequences. Commit the parent transition and those consequences together
  before acknowledgment, under D-72's settlement transaction.

  Repair classification follows the persisted selected parent finding IDs,
  not a caller-provided new occurrence or moved home. Re-admitting that repair
  must resolve the same root obligation and spent allowance. An independent
  initial fire has no inherited parent obligation and cannot settle another
  fire merely because its range is later or its paths match. Carry preserves
  this distinction and all lineage. An unrelated later round or a forged parent
  link refuses; exact-round matching remains the default in D-78.

  **One atomic re-arm operation:** Phase 10 composes phase 9 D-62's reusable
  pending-admission primitive into one conditional store transaction. Compare
  the root obligation's allowance and selection revision, then commit its
  consumed allowance, stable re-arm replay key, parent/child relation, child
  pending record, retained material references, full roster and initial
  dispatch identities together. No independently committed spend or admission
  is permitted. Expose dispatch only after the combined commit. A crash between
  either order of the logical spend/admission mutations must recover neither;
  a crash after commit recovers both and replay returns the same child/attempt
  identities. An interrupted transaction cannot lose the allowance without a
  recoverable child or expose a child with an unspent allowance. Concurrent
  retries of one parent admit at most one child. Once dispatch may have occurred,
  recover H3's observation/uncertainty state before any further dispatch rather
  than buying another attempt. Phase 9 supplies transaction composition only;
  all allowance, lineage and recovery policy lives here
  (`crates/cadence/src/store/writer.rs:60`).

- D-80 (Filing consumes verified candidates and durable human choices): Derive
  filing candidates from verified settlement, preserving findings and their
  inspectable evidence, and bind each accept/decline to the exact candidate and
  human answer. Reuse local item revisions and uncertainty instead of new
  FILED/DECLINED authorities. Declines stay local and out of recall, with explicit
  evidence lookup retained; no remote create follows an unanswered or declined
  candidate (`.planning/ROADMAP.md:798`, `.planning/ROADMAP.md:833`,
  `crates/cadence/src/store/items.rs:15`,
  `crates/cadence/src/store/items.rs:47`,
  `cadence-core/bin/issue-filing.mjs:795`). Preserve the exact existing
  fingerprint over file and claim, deduplicate the input before lookup/create,
  distinguish hits, complete measured misses and unavailable/incomplete lookup,
  and bound lookup work and response size
  (`cadence-core/bin/lib/filing-decision.mjs:275`,
  `cadence-core/bin/lib/filing-decision.mjs:332`,
  `cadence-core/bin/issue-filing.mjs:644`,
  `cadence-core/bin/issue-filing.mjs:718`). Persist a recoverable filing intent
  before remote creation. After an ambiguous create or a crash before local
  confirmation, retain uncertainty and reconcile the fingerprint on the tracker
  before another create; an index miss alone cannot resolve a held uncertain
  outcome. Do not claim a local transaction makes remote creation atomic
  (`cadence-core/bin/issue-filing.mjs:802`,
  `crates/cadence/src/store/items.rs:83`, `.planning/ROADMAP.md:834`). If wrong:
  fabricated settlement reaches the tracker, a decline becomes a public issue,
  or a lost response creates duplicate issues on retry.

- D-81 (GH-250 separates mirror availability from authority): The frozen
  FILED read can refuse before forge resolution or tracker lookup. Fix that
  ordering in the new filing service: an unavailable legacy mirror does not
  prevent a bounded tracker lookup and a trustworthy dedup answer. Surface the
  missing mirror and preserve local confirmation/uncertainty truthfully; do not
  claim a local write succeeded when it did not. Corruption of the authoritative
  native store still refuses; this repair grants no permission to operate
  through corrupt state (`cadence-core/bin/issue-filing.mjs:727`,
  `cadence-core/bin/issue-filing.mjs:745`,
  `cadence-core/bin/issue-filing.mjs:763`, `.planning/ROADMAP.md:848`). If wrong:
  a missing optional mirror prevents valid tracker deduplication, or the repair
  bypasses the store's actual integrity boundary.

- D-82 (GH-251 requires forge-specific search evidence): GitLab's frozen row
  explicitly remains unmeasured and space-joins fingerprints in a title search;
  Forgejo's row already records historical single-token and multi-token live
  observations. The defect is unestablished GitLab search semantics, not a claim
  that every space-joined query fails or that Forgejo was never measured
  (`cadence-core/bin/lib/filing-decision.mjs:678`,
  `cadence-core/bin/lib/filing-decision.mjs:699`,
  `cadence-core/bin/lib/filing-decision.mjs:730`,
  `cadence-core/bin/lib/filing-decision.mjs:753`). Keep GitLab explicitly
  unmeasured until live known-hit single/multiple fingerprint and genuine-miss
  observations establish the actual lookup semantics, including exclusion of
  body-only matches. An unmeasured empty answer cannot overrule a confirmed
  local filing fact. Correct the query if measurements require it; neither an
  argv fixture nor another forge's successful search supplies that evidence
  (`cadence-core/bin/lib/filing-decision.mjs:737`,
  `cadence-core/bin/issue-filing.mjs:841`, `.planning/ROADMAP.md:849`). If wrong:
  a phrase search returns a false miss and re-files an issue already present,
  while green local tests falsely label the integration verified.

- D-83 (PILOT is an acceptance gate): Require owner inspection of live provider
  participation, failed-provider/local-fallback closure, per-voice rulings
  checked against actual source, fabricated-evidence refusal, deferred
  settlement and exhausted re-arm after restart, plus human-authorized filing,
  deduplication and ambiguous-create reconciliation on each claimed forge.
  Record what actually ran, what was returned, what the binary saved and what
  recovered after restart, with evidence references and explicit semantic
  limitations. Missing provider/forge observations remain unverified and cannot
  be covered by another backend's success (`.planning/ROADMAP.md:852`).
  Deterministic tests are necessary but insufficient: the earlier boundary did
  not load in a real host despite 347 passing tests
  (`.planning/phases/6/SUMMARY.md:16`). If wrong: fixtures certify a review that
  never ran, or passing identity checks are advertised as proof that every
  finding or refutation was correct.

## Acceptance criteria

These are specifications for unimplemented phase work, except the seven
criteria for the existing shared validator. Other function names below name
the proposed unit; they do not require
public test APIs or particular module placement. Test each unit directly,
including its stated durable output. Stub the listed I/O boundaries, including
setup; filesystem images are stub inputs, not instructions to start a process.
No criterion calls a model. Fixed finding prose is authored input data.

The shared validator is `review::contract::validate_findings` in
`crates/cadence/src/review/contract.rs`. Its finding variants below denote
hand-authored UTF-8 findings-envelope bytes; `accepted = true` denotes successful
validation. The four empty-envelope decoder criteria cover only recorded-contract
dispatch and the consumer's returned envelope, with the shared validator's
successful empty result supplied. They do not re-test empty-findings validation.
The pause refusal criterion supplies the common settlement refusal directly and
checks only pause's clearance response and forbidden writes. These thin consumer
checks stub the shared result; validation cases belong only to their owning unit.

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

Every phase-9 record input below is read from a COMMITTED FIXTURE owned and
committed by phase 9. Load its literal bytes through the filesystem stub when
the tested unit performs I/O; supply decoded fixture values directly to pure
units. Never invoke phase-9 admission, dispatch, return or enqueue to prepare a
test. The thin consumer checks above supply shared results; other criteria do
not mock those internal collaborators when phase-10 code calls them.
This inverts former AC1, AC2, AC3, AC5, AC6, AC11, AC18 and AC19. The preserved
scope's historical producer-run/fixture prohibition does not govern these
criteria. The unchanged producer-run evidence belongs to phase 9 MANUAL.

Fixture C is the committed carry closure with originals `["o1","o2"]`, voices
`["A","B"]`, retained entries `["e1","e2"]`, selection `["v1:2"]`, lineage
`{"parent":"f1","child":"f2","root":"root1"}`, allowance `"spent"` and
receipts `["s1","override1"]`. It includes each referenced record and its
retained bytes, not just this inventory. Original `o1` is F; `o2` is an empty
successful child return. Entry e2 retains fix bytes `new\n`.

A mechanically valid settlement input means an authored matching fire,
occurrence, round, attempt and original-finding ID, with F copied exactly and
one disposition per original. Its fixed Git observation resolves fix `abc123`
to commit `0123456789012345678901234567890123456789`; material references use
the fixture's retained side and line. Refuted variants supply retained counter
entry e3 containing `support\n`. Scoped overrides name o1:0, round 1 and reason
`Accepted risk`. Empty variants have a fully successful empty roster and no
rulings. These inputs establish mechanical identity only. Whether a fix works,
a refutation is persuasive or a deletion is desirable remains manual judgment.

- [ ] AC1: Given committed H fixture and current gate `off`, model `model-B`,
      phase cursor `99`, `open_review` returns `{"gate":"deferred",
      "routing":{"answer":"local", "evidence":"route1"},
      "home":{"kind":"task", "id":"h1", "occurrence":"occ1"}, "round":1,
      "artifact":"m1", "required_roster":["A"], "requested_model":"model-A",
      "observed_model":null, "schema":"review-1", "validator":"H4-1"}`.
      Boundaries: filesystem: committed fixture bytes, forbid
      current-config/cursor reads. (D-70; H1-H5; former AC1;
      `.planning/ROADMAP.md:762`, `.planning/ROADMAP.md:775`,
      `.planning/ROADMAP.md:801`).

- [ ] AC2: Given committed `committed-range` fixture at `m1`, `open_review`
      returns `artifact_kind = "committed-range"`. Boundaries: filesystem:
      committed fixture. (D-70; H2; former AC1).

- [ ] AC3: Given committed `staged-tree` fixture at `m1`, `open_review`
      returns `artifact_kind = "staged-tree"`. Boundaries: filesystem:
      committed fixture. (D-70; H2; former AC1).

- [ ] AC4: Given committed `named-diff` fixture at `m1`, `open_review`
      returns `artifact_kind = "named-diff"`. Boundaries: filesystem:
      committed fixture. (D-70; H2; former AC1).

- [ ] AC5: Given committed `named-file` fixture at `m1`, `open_review`
      returns `artifact_kind = "named-file"`. Boundaries: filesystem:
      committed fixture. (D-70; H2; former AC1).

- [ ] AC6: Given committed `minimalism-file` fixture at `m1`, `open_review`
      returns `artifact_kind = "minimalism-file"`. Boundaries: filesystem:
      committed fixture. (D-70; H2; former AC1).

- [ ] AC7: Given committed `minimalism-directory` fixture at `m1`,
      `open_review` returns `artifact_kind = "minimalism-directory"`.
      Boundaries: filesystem: committed fixture. (D-70; H2; former AC1).

- [ ] AC8: Given committed `minimalism-phase-range` fixture at `m1`,
      `open_review` returns `artifact_kind = "minimalism-phase-range"`.
      Boundaries: filesystem: committed fixture. (D-70; H2; former AC1).

- [ ] AC9: Given committed `decision` fixture at `m1`, `open_review` returns
      `artifact_kind = "decision"`. Boundaries: filesystem: committed fixture.
      (D-70; H2; former AC1).

- [ ] AC10: Given committed `diagnosis` fixture at `m1`, `open_review` returns
      `artifact_kind = "diagnosis"`. Boundaries: filesystem: committed
      fixture. (D-70; H2; former AC1).

- [ ] AC11: Given committed `f1` in `phase` home with accepted delivery and no
      settlement, `review_obligation` returns `{"fire":"f1",
      "settlement":"pending", "visible":true}`. Boundaries: filesystem:
      committed fixture. (D-70; H5; former AC1).

- [ ] AC12: Given committed `f1` in `task` home with accepted delivery and no
      settlement, `review_obligation` returns `{"fire":"f1",
      "settlement":"pending", "visible":true}`. Boundaries: filesystem:
      committed fixture. (D-70; H5; former AC1).

- [ ] AC13: Given committed `f1` in `root` home with accepted delivery and no
      settlement, `review_obligation` returns `{"fire":"f1",
      "settlement":"pending", "visible":true}`. Boundaries: filesystem:
      committed fixture. (D-70; H5; former AC1).

- [ ] AC14: Given committed `f1` whose required material `e1` is unavailable,
      `verify_settlement` returns `{"code":"missing-material", "fire":"f1",
      "entry":"e1"}`. Boundaries: filesystem: fixture, fail retained e1 read;
      subprocess: forbid current-source substitution. (D-70; former AC1).

- [ ] AC15: Given committed `f1` plus a refused missing-material settlement,
      `review_obligation` returns `{"fire":"f1", "settlement":"pending",
      "visible":true}`. Boundaries: none. (D-70; former AC1).

- [ ] AC16: Given committed Q accepted under `H4-1`, `open_original` returns
      `{"identity":{"original":"o1", "validator":"H4-1",
      "admission":"accepted", "finding_ids":["o1:0", "o1:1"]},
      "findings":[{"file":"a.rs", "line":1, "severity":"high",
      "claim":"quote: \"\n雪", "failure_scenario":"S"}, {"file":"a.rs", "line":1,
      "severity":"high", "claim":"C", "failure_scenario":"S"}]}`.
      Boundaries: filesystem: committed Q. (D-71; H4; former AC2;
      `cadence-core/bin/review-provider.mjs:885`,
      `cadence-core/bin/review-provider.mjs:1261`,
      `cadence-core/bin/lib/adjudication-record.mjs:285`).

- [ ] AC17: Given committed accepted 100-finding Unicode boundary fixture,
      `open_original` returns `shape_status = "accepted"`. Boundaries:
      filesystem: committed boundary fixture. (D-71; H4; former AC2).

- [ ] AC18: Given committed old bytes with contract `unknown-0` and original
      `old1`, `open_original` returns `{"original":"old1", "verified":false,
      "diagnostic":"unknown-contract", "contract":"unknown-0",
      "recovery":"linked-new-review", "dispatch":null}`. Boundaries:
      filesystem: old bytes, forbid rewrite. (D-70, D-71; former AC2).

- [ ] AC19: Given literal empty findings envelope and recorded contract
      `H4-1`, `decode_provider_return` returns `{"findings":[]}`. Boundaries:
      none. (D-71; former AC2).

- [ ] AC20: Given literal empty findings envelope, `validate_findings` returns
      `{"findings":[]}`. Boundaries: none. (D-71; former AC2).

- [ ] AC21: Given F with 2000 Unicode scalars in claim,
      `validate_findings` returns `accepted = true`. Boundaries: none.
      (D-71; former AC2).

- [ ] AC22: Given F with whitespace-only claim, `validate_findings`
      returns `{"code":"blank-field", "index":0, "field":"claim"}`.
      Boundaries: none. (D-71; former AC2).

- [ ] AC23: Given F with unknown `fix` field, `validate_findings` returns
      `{"code":"unknown-field", "index":0, "field":"fix"}`. Boundaries: none.
      (D-71; former AC2).

- [ ] AC24: Given 101 copies of F, `validate_findings` returns
      `{"code":"too-many-findings", "limit":100, "actual":101}`. Boundaries:
      none. (D-71; former AC2).

- [ ] AC25: Given F with 2001-scalar claim, `validate_findings` returns
      `{"code":"field-too-long", "index":0, "field":"claim", "limit":2000}`.
      Boundaries: none. (D-71; former AC2).

- [ ] AC26: Given F with line 9007199254740992, `validate_findings`
      returns `{"code":"invalid-line", "index":0, "field":"line", "min":1,
      "max":9007199254740991}`. Boundaries: none. (D-71; former AC2).

- [ ] AC27: Given literal empty findings envelope and recorded contract
      `H4-1`, `decode_settlement_findings` returns `{"findings":[]}`.
      Boundaries: none. (D-71; former AC2).

- [ ] AC28: Given literal empty findings envelope and recorded contract
      `H4-1`, `decode_deferred_findings` returns `{"findings":[]}`.
      Boundaries: none. (D-71; former AC2).

- [ ] AC29: Given literal empty findings envelope and recorded contract
      `H4-1`, `decode_minimalism_findings` returns `{"findings":[]}`.
      Boundaries: none. (D-71; former AC2).

- [ ] AC30: Given byte budget `8192` supplied by admitted-roster limits and a
      stream of 8193 bytes, `read_settlement_envelope` returns
      `{"code":"settlement-too-large", "limit":8192}`. Boundaries: input
      stream: fixed chunks, stop at cap plus one. (D-71; former AC2).

- [ ] AC31: Given valid 8192-byte envelope and supplied byte budget `8192`,
      `read_settlement_envelope` returns `accepted_bytes = 8192`. Boundaries:
      input stream: fixed chunks. (D-71; former AC2).

- [ ] AC32: Given committed empty original raw bytes `{"findings":[]}` under
      H4-1, `open_original` returns `raw_bytes = "{\"findings\":[]}"`.
      Boundaries: filesystem: committed raw bytes. (D-71; H4; former AC2).

- [ ] AC33: Given committed roster `["A", "B"]`, empty successful A, B
      `pending`, `verify_participation` returns
      `{"code":"incomplete-participation", "voice":"B", "state":"pending"}`.
      Boundaries: none. (D-70, D-72; former AC3;
      `cadence-core/bin/lib/adjudication-record.mjs:351`,
      `cadence-core/bin/lib/adjudication-record.mjs:413`,
      `.planning/ROADMAP.md:807`).

- [ ] AC34: Given committed roster `["A", "B"]`, empty successful A, B
      `interrupted`, `verify_participation` returns
      `{"code":"incomplete-participation", "voice":"B",
      "state":"interrupted"}`. Boundaries: none. (D-70, D-72; former AC3).

- [ ] AC35: Given committed roster `["A", "B"]`, empty successful A, B
      `uncertain`, `verify_participation` returns
      `{"code":"incomplete-participation", "voice":"B", "state":"uncertain"}`.
      Boundaries: none. (D-70, D-72; former AC3).

- [ ] AC36: Given committed empty-success A and terminal failed B, submitted
      roster `["A"]`, `verify_participation` returns
      `{"code":"failed-required-voice", "voice":"B"}`. Boundaries: none.
      (D-72; former AC3).

- [ ] AC37: Given committed successful empty A and B, matching submitted
      roster, `verify_participation` returns `{"successful_empty":["A", "B"],
      "failed":[]}`. Boundaries: none. (D-72; former AC3).

- [ ] AC38: Given committed voice A and submitted invented voice C,
      `verify_participation` returns `{"code":"unknown-voice", "voice":"C"}`.
      Boundaries: none. (D-72; former AC3).

- [ ] AC39: Given committed A observed model unknown and submitted claimed
      model `model-A`, `verify_participation` returns
      `{"code":"unobserved-model", "voice":"A", "claimed":"model-A"}`.
      Boundaries: none. (D-72; former AC3).

- [ ] AC40: Given committed F at `o1:0` and submitted `claim` changed by one
      character, `match_original` returns `{"code":"original-mismatch",
      "finding":"o1:0", "field":"claim"}`. Boundaries: none. (D-72; former
      AC3).

- [ ] AC41: Given committed F at `o1:0` and submitted `failure_scenario`
      changed by one character, `match_original` returns
      `{"code":"original-mismatch", "finding":"o1:0",
      "field":"failure_scenario"}`. Boundaries: none. (D-72; former AC3).

- [ ] AC42: Given committed F at `o1:0`, caller copy and ruling both claim
      `Fabricated`, `match_original` returns `{"code":"original-mismatch",
      "finding":"o1:0", "field":"claim"}`. Boundaries: none. (D-70, D-72;
      former AC3).

- [ ] AC43: Given committed findings `["o1:0", "o1:1"]` and ruling only for
      `o1:0`, `ruling_coverage` returns `{"code":"missing-ruling",
      "finding":"o1:1"}`. Boundaries: none. (D-72; former AC3).

- [ ] AC44: Given committed `o1:0` and two rulings for `o1:0`,
      `ruling_coverage` returns `{"code":"duplicate-ruling",
      "finding":"o1:0"}`. Boundaries: none. (D-72; former AC3).

- [ ] AC45: Given committed `a1/return1` and same-artifact `a2/return2`, with
      a1 ruling naming return2, `match_ruling_origin` returns
      `{"code":"host-return-mismatch", "attempt":"a1", "expected":"return1",
      "actual":"return2"}`. Boundaries: none. (D-72; former AC3).

- [ ] AC46: Given matching survived rulings from A/o1:0 and B/o2:0 for
      identical F, `derive_convergence` returns `{"entries":["o1:0", "o2:0"],
      "convergence":2}`. Boundaries: none. (D-72; former AC3).

- [ ] AC47: Given three verified entries: survived high, downgraded low and
      refuted high, `ruling_counts` returns `{"survived":1, "downgraded":1,
      "refuted":1}`. Boundaries: none. (D-72; former AC3).

- [ ] AC48: Given committed F, pending gate, queued f1 and a claim-mismatched
      ruling, `settle_review` returns `{"code":"original-mismatch",
      "finding":"o1:0", "field":"claim"}`. Boundaries: filesystem: committed
      fixture, forbid original/gate/queue writes. (D-70, D-72; former AC3).

- [ ] AC49: Given supplied fix ID `abc123` and Git observation `missing`,
      `resolve_fix` returns `{"code":"fix-not-found", "fix":"abc123"}`.
      Boundaries: subprocess: fixed Git resolution/type result; filesystem:
      retained-evidence writes stubbed. (D-73; former AC4;
      `cadence-core/bin/lib/adjudication-record.mjs:438`,
      `cadence-core/bin/planning/adjudication.mjs:90`,
      `.planning/ROADMAP.md:814`, `.planning/ROADMAP.md:820`).

- [ ] AC50: Given supplied fix ID `abc123` and Git observation `blob`,
      `resolve_fix` returns `{"code":"fix-not-commit", "fix":"abc123"}`.
      Boundaries: subprocess: fixed Git resolution/type result; filesystem:
      retained-evidence writes stubbed. (D-73; former AC4).

- [ ] AC51: Given supplied fix ID `abc123` and Git observation `tree`,
      `resolve_fix` returns `{"code":"fix-not-commit", "fix":"abc123"}`.
      Boundaries: subprocess: fixed Git resolution/type result; filesystem:
      retained-evidence writes stubbed. (D-73; former AC4).

- [ ] AC52: Given supplied fix ID `abc123` and Git observation `ambiguous`,
      `resolve_fix` returns `{"code":"fix-ambiguous", "fix":"abc123"}`.
      Boundaries: subprocess: fixed Git resolution/type result; filesystem:
      retained-evidence writes stubbed. (D-73; former AC4).

- [ ] AC53: Given fix ID `abc123` with unambiguous commit observation
      `0123456789012345678901234567890123456789`, `resolve_fix` returns
      `{"commit":"0123456789012345678901234567890123456789"}`. Boundaries:
      subprocess: fixed commit resolution and evidence bytes; filesystem:
      retained-evidence writes. (D-73; former AC4).

- [ ] AC54: Given committed source mapping `e1/base/2` and unreviewed entry
      e9, `verify_citation` returns `{"code":"unreviewed-citation",
      "finding":"o1:0", "field":"entry"}`. Boundaries: none. (D-73; former
      AC4).

- [ ] AC55: Given committed source mapping `e1/base/2` and e1 head instead of
      base, `verify_citation` returns `{"code":"citation-side-mismatch",
      "finding":"o1:0", "field":"side"}`. Boundaries: none. (D-73; former
      AC4).

- [ ] AC56: Given committed source mapping `e1/base/2` and e1 line 3 instead
      of mapped line 2, `verify_citation` returns
      `{"code":"citation-line-mismatch", "finding":"o1:0", "field":"line"}`.
      Boundaries: none. (D-73; former AC4).

- [ ] AC57: Given committed source mapping `e1/base/2` and counter-evidence
      entry e9 absent from retained manifest, `verify_citation` returns
      `{"code":"missing-counter-evidence", "finding":"o1:0",
      "field":"entry"}`. Boundaries: none. (D-73; former AC4).

- [ ] AC58: Given valid literal dispositions for `f1`, with transaction
      failure before commit, `settle_review` returns
      `{"code":"settlement-write-failed", "fire":"f1", "acknowledged":false}`.
      Boundaries: filesystem: fail conditional commit; clock: `100`. (D-72;
      former AC4).

- [ ] AC59: Given valid f1 settlement and pre-commit write failure,
      `settle_review` returns `durable_state = {"settlement":null,
      "gate":"pending", "queue":["f1"]}`. Boundaries: filesystem: failure and
      recovered durable image; clock: `100`. (D-72; former AC4).

- [ ] AC60: Given valid f1 settlement, committed image and lost acknowledgment
      replay, `settle_review` returns `{"settlement":"s1", "gate":"clear",
      "queue":[], "replayed":true}`. Boundaries: filesystem: committed image;
      clock: `100`. (D-72; former AC4).

- [ ] AC61: Given committed e1/base/2 retaining literal source line `old` and
      matching finding sidecar, `verify_citation` returns `{"finding":"o1:0",
      "entry":"e1", "side":"base", "line":2, "verified":true}`. Boundaries:
      filesystem: retained source bytes. (D-73; former AC4).

- [ ] AC62: Given committed committed-range fixture F with `e1/head/1` and
      current source absent, `finding_evidence` returns `{"finding":"o1:0",
      "claim":"C", "failure_scenario":"S", "side":"head", "line":1,
      "text":"old"}`. Boundaries: filesystem: retained `old\n`, deny
      live-source reads; subprocess: forbid current HEAD. (D-73; H2; former
      AC5; `cadence-core/bin/planning/adjudication.mjs:63`,
      `.planning/ROADMAP.md:775`, `.planning/ROADMAP.md:814`).

- [ ] AC63: Given committed saved-diff fixture F with `e1/base/1` and current
      source absent, `finding_evidence` returns `{"finding":"o1:0",
      "claim":"C", "failure_scenario":"S", "side":"base", "line":1,
      "text":"old"}`. Boundaries: filesystem: retained `old\n`, deny
      live-source reads; subprocess: forbid current HEAD. (D-73; H2; former
      AC5).

- [ ] AC64: Given committed rename fixture F with `e1/head/1` and current
      source absent, `finding_evidence` returns `{"finding":"o1:0",
      "claim":"C", "failure_scenario":"S", "side":"head", "line":1,
      "text":"old"}`. Boundaries: filesystem: retained `old\n`, deny
      live-source reads; subprocess: forbid current HEAD. (D-73; H2; former
      AC5).

- [ ] AC65: Given committed deletion fixture F with `e1/base/1` and current
      source absent, `finding_evidence` returns `{"finding":"o1:0",
      "claim":"C", "failure_scenario":"S", "side":"base", "line":1,
      "text":"old"}`. Boundaries: filesystem: retained `old\n`, deny
      live-source reads; subprocess: forbid current HEAD. (D-73; H2; former
      AC5).

- [ ] AC66: Given committed never-committed fixture F with `e1/snapshot/1` and
      current source absent, `finding_evidence` returns `{"finding":"o1:0",
      "claim":"C", "failure_scenario":"S", "side":"snapshot", "line":1,
      "text":"old"}`. Boundaries: filesystem: retained `old\n`, deny
      live-source reads; subprocess: forbid current HEAD. (D-73; H2; former
      AC5).

- [ ] AC67: Given committed supporting `e3` outside changed paths, retained
      line `support`, provenance `original-view`, `verify_counter_citation`
      returns `{"entry":"e3", "verified":true, "provenance":"original-view",
      "attempt":"a1"}`. Boundaries: filesystem: retained supporting bytes.
      (D-73; H2; former AC5).

- [ ] AC68: Given committed supporting `e3` outside changed paths, retained
      line `support`, provenance `later-evidence`, `verify_counter_citation`
      returns `{"entry":"e3", "verified":true, "provenance":"later-evidence",
      "attempt":null}`. Boundaries: filesystem: retained supporting bytes.
      (D-73; H2; former AC5).

- [ ] AC69: Given committed diff line 4 mapping to source base line 2,
      citation substitutes line 4, `verify_citation` returns
      `{"code":"citation-line-mismatch", "finding":"o1:0", "field":"line"}`.
      Boundaries: none. (D-73; H2; former AC5).

- [ ] AC70: Given committed F at e1/base/1 with retained e1 unreadable,
      `finding_evidence` returns `{"finding":"o1:0", "claim":"C",
      "failure_scenario":"S", "side":"base", "verified":false,
      "diagnostic":"material-unavailable"}`. Boundaries: filesystem: fail
      retained e1 read. (D-73; former AC5).

- [ ] AC71: Given committed minimalism-file fixture with one base reviewer and
      retained target m1, `verify_minimalism` returns `{"target":"m1",
      "reviewers":["base"], "gate":null, "delete":[]}`. Boundaries: none.
      (D-74; former AC6; `cadence-core/workflows/minimalism-review.md:98`,
      `cadence-core/workflows/minimalism-review.md:102`,
      `cadence-core/workflows/minimalism-review.md:126`).

- [ ] AC72: Given committed minimalism-directory fixture with one base
      reviewer and retained target m1, `verify_minimalism` returns
      `{"target":"m1", "reviewers":["base"], "gate":null, "delete":[]}`.
      Boundaries: none. (D-74; former AC6).

- [ ] AC73: Given committed minimalism-phase-range fixture with one base
      reviewer and retained target m1, `verify_minimalism` returns
      `{"target":"m1", "reviewers":["base"], "gate":null, "delete":[]}`.
      Boundaries: none. (D-74; former AC6).

- [ ] AC74: Given committed low `o1:0` claim `L`/scenario `Keep L` and high
      `o1:1` claim `H`/scenario `Keep H`, `minimalism_view` returns
      `[{"id":"o1:1", "claim":"H", "failure_scenario":"Keep H"}, {"id":"o1:0",
      "claim":"L", "failure_scenario":"Keep L"}]`. Boundaries: none. (D-74;
      former AC6).

- [ ] AC75: Given committed successful empty minimalism return,
      `minimalism_view` returns `{"state":"usable", "findings":[],
      "verdict":null, "deletion_choice":"human"}`. Boundaries: none. (D-74;
      former AC6).

- [ ] AC76: Given committed failed minimalism attempt, `minimalism_view`
      returns `{"state":"failed", "findings":null, "verdict":null,
      "deletion_choice":"human"}`. Boundaries: none. (D-74; former AC6).

- [ ] AC77: Given committed directory target m1 with retained members
      `["a.rs"]` and current membership `["b.rs"]`, `minimalism_target_view`
      returns `{"target":"m1", "members":["a.rs"]}`. Boundaries: filesystem:
      committed directory fixture, forbid current listing. (D-74; former AC6).

- [ ] AC78: Given admitted attempt `a1` and credential absent,
      `provider_attempt` returns `{"attempt":"a1", "state":"failed",
      "reason":"no-key", "findings":null}`. Boundaries:
      environment/filesystem: fixed credentials and lifecycle state; network:
      fixed response/error; subprocess: fixed fallback result; clock: `100`.
      (D-75; former AC7; `.planning/ROADMAP.md:768`,
      `.planning/ROADMAP.md:783`, `.planning/ROADMAP.md:829`).

- [ ] AC79: Given admitted attempt `a1` and transport connection failure,
      `provider_attempt` returns `{"attempt":"a1", "state":"failed",
      "reason":"transport", "findings":null}`. Boundaries:
      environment/filesystem: fixed credentials and lifecycle state; network:
      fixed response/error; subprocess: fixed fallback result; clock: `100`.
      (D-75; former AC7).

- [ ] AC80: Given admitted attempt `a1` and HTTP 503 without usage,
      `provider_attempt` returns `{"attempt":"a1", "state":"failed",
      "reason":"http-503", "findings":null}`. Boundaries:
      environment/filesystem: fixed credentials and lifecycle state; network:
      fixed response/error; subprocess: fixed fallback result; clock: `100`.
      (D-75; former AC7).

- [ ] AC81: Given admitted attempt `a1` and HTTP 200 malformed JSON,
      `provider_attempt` returns `{"attempt":"a1", "state":"failed",
      "reason":"malformed-return", "findings":null}`. Boundaries:
      environment/filesystem: fixed credentials and lifecycle state; network:
      fixed response/error; subprocess: fixed fallback result; clock: `100`.
      (D-75; former AC7).

- [ ] AC82: Given admitted attempt `a1` and local fallback process failure,
      `provider_attempt` returns `{"attempt":"a1", "state":"failed",
      "reason":"fallback-failed", "findings":null}`. Boundaries:
      environment/filesystem: fixed credentials and lifecycle state; network:
      fixed response/error; subprocess: fixed fallback result; clock: `100`.
      (D-75; former AC7).

- [ ] AC83: Given committed terminal failed a1 and identical replay,
      `provider_attempt` returns `{"attempt":"a1", "state":"failed",
      "replayed":true}`. Boundaries: filesystem: committed lifecycle image,
      forbid new terminal write; network/subprocess: forbid dispatch; clock:
      `100`. (D-75; former AC7).

- [ ] AC84: Given a1 with HTTP 200 bytes `{"findings":[]}`,
      `provider_attempt` returns `{"attempt":"a1", "state":"accepted",
      "findings":[]}`. Boundaries: network: fixed bytes; filesystem: committed
      a1 and successful lifecycle writes; environment: fixed credential;
      clock: `100`. (D-75; former AC7).

- [ ] AC85: Given environment key `env-key` and credential file value
      `file-key`, `resolve_credential` returns `"env-key"`. Boundaries:
      environment: fixed key; filesystem: forbid file read. (D-75; former AC8;
      `cadence-core/bin/review-provider.mjs:275`,
      `cadence-core/bin/review-provider.mjs:480`,
      `cadence-core/bin/review-provider.mjs:504`,
      `cadence-core/bin/review-provider.mjs:727`,
      `cadence-core/references/review-cross-model.md:120`).

- [ ] AC86: Given absent environment key and credential file value
      `file-key`, `resolve_credential` returns `"file-key"`. Boundaries:
      environment: absent key; filesystem: fixed file bytes. (D-75; former
      AC8).

- [ ] AC87: Given entry e1 lines `["public", "token=secret"]` and credential
      `secret`, `fence_payload` returns `{"text":"public\n[REDACTED]",
      "mapping":[{"view_line":1, "entry":"e1", "source_line":1}],
      "removed":[{"entry":"e1", "source_line":2}]}`. Boundaries: none. (D-75;
      former AC8).

- [ ] AC88: Given text `Authorization: secret failed`, secret `secret` and
      byte budget 128, `sanitize_diagnostic` returns
      `"Authorization: [REDACTED] failed"`. Boundaries: none. (D-75; former
      AC8).

- [ ] AC89: Given payload of 1025 bytes and supplied cap 1024,
      `send_provider_request` returns `{"code":"payload-too-large",
      "limit":1024, "actual":1025}`. Boundaries: network: forbid requests;
      clock: `100`. (D-75; former AC8).

- [ ] AC90: Given 4,194,305 response bytes and cap 4,194,304,
      `read_provider_response` returns `{"code":"return-too-large",
      "limit":4194304}`. Boundaries: network: fixed response chunks, stop at
      cap plus one; clock: `100`. (D-75; former AC8).

- [ ] AC91: Given a1, start time 100, outer deadline 110, and response still
      unavailable at 110, `provider_attempt` returns `{"attempt":"a1",
      "state":"failed", "reason":"deadline", "findings":null}`. Boundaries:
      clock: advance 100 to 110; network: stalled response; filesystem:
      successful failure commit; environment: fixed credential. (D-75; former
      AC8).

- [ ] AC92: Given fenced view retains e1 line 1 but citation names removed
      line 2, `verify_provider_citation` returns
      `{"code":"unreviewed-citation", "finding":"o1:0", "field":"line"}`.
      Boundaries: none. (D-73, D-75; former AC8).

- [ ] AC93: Given value `0` and numeric bound 9007199254740991, `token_count`
      returns `{"state":"valid", "value":0}`. Boundaries: none. (D-76; GH-237,
      GH-240; former AC9; `cadence-core/bin/review-provider.mjs:988`,
      `cadence-core/bin/review-provider.mjs:1142`,
      `.planning/ROADMAP.md:847`).

- [ ] AC94: Given value `7` and numeric bound 9007199254740991, `token_count`
      returns `{"state":"valid", "value":7}`. Boundaries: none. (D-76; GH-237,
      GH-240; former AC9).

- [ ] AC95: Given value `absent` and numeric bound 9007199254740991,
      `token_count` returns `{"state":"absent"}`. Boundaries: none. (D-76;
      GH-237, GH-240; former AC9).

- [ ] AC96: Given value `1.5` and numeric bound 9007199254740991,
      `token_count` returns `{"state":"invalid"}`. Boundaries: none. (D-76;
      GH-237, GH-240; former AC9).

- [ ] AC97: Given value `-1` and numeric bound 9007199254740991,
      `token_count` returns `{"state":"invalid"}`. Boundaries: none. (D-76;
      GH-237, GH-240; former AC9).

- [ ] AC98: Given value `NaN` and numeric bound 9007199254740991,
      `token_count` returns `{"state":"invalid"}`. Boundaries: none. (D-76;
      GH-237, GH-240; former AC9).

- [ ] AC99: Given value `Infinity` and numeric bound 9007199254740991,
      `token_count` returns `{"state":"invalid"}`. Boundaries: none. (D-76;
      GH-237, GH-240; former AC9).

- [ ] AC100: Given value `9007199254740992` and numeric bound
      9007199254740991, `token_count` returns `{"state":"invalid"}`.
      Boundaries: none. (D-76; GH-237, GH-240; former AC9).

- [ ] AC101: Given input usage 7, candidate invalid, thoughts 3, bound
      9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":null,
      "reason":"invalid-component"}`. Boundaries: none. (D-76; GH-237, GH-240;
      former AC9).

- [ ] AC102: Given input usage 7, candidate 3, thoughts invalid, bound
      9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":null,
      "reason":"invalid-component"}`. Boundaries: none. (D-76; GH-237, GH-240;
      former AC9).

- [ ] AC103: Given input usage 7, candidate 0, thoughts 0, bound
      9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":0,
      "reason":null}`. Boundaries: none. (D-76; GH-237, GH-240; former AC9).

- [ ] AC104: Given input usage 7, candidate absent, thoughts absent, bound
      9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":null,
      "reason":"absent-components"}`. Boundaries: none. (D-76; GH-237, GH-240;
      former AC9).

- [ ] AC105: Given input usage 7, candidate 3, thoughts absent, bound
      9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":null,
      "reason":"absent-component"}`. Boundaries: none. (D-76; GH-237, GH-240;
      former AC9).

- [ ] AC106: Given input usage 7, candidate absent, thoughts 3, bound
      9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":null,
      "reason":"absent-component"}`. Boundaries: none. (D-76; GH-237, GH-240;
      former AC9).

- [ ] AC107: Given input usage 7, candidate 9007199254740991, thoughts 1,
      bound 9007199254740991 and omission policy `unavailable`,
      `normalize_gemini_usage` returns `{"input":7, "output":null,
      "reason":"overflow"}`. Boundaries: none. (D-76; GH-237, GH-240; former
      AC9).

- [ ] AC108: Given raw `secret abcdef`, secret `secret` and sanitized byte cap
      12, `sanitize_usage_evidence` returns `"[REDACTED] a"`. Boundaries:
      none. (D-76; former AC9).

- [ ] AC109: Given HTTP 429 with input 7/output 3,
      `classify_provider_response` returns `failure.usage = {"input":7,
      "output":3}`. Boundaries: none. (D-77; GH-239; former AC10;
      `cadence-core/bin/review-provider.mjs:1335`,
      `cadence-core/bin/review-provider.mjs:1350`).

- [ ] AC110: Given HTTP 429 with input 7/output absent,
      `classify_provider_response` returns `failure.usage = {"input":7,
      "output":null}`. Boundaries: none. (D-77; GH-239; former AC10).

- [ ] AC111: Given HTTP 429 with input invalid/output invalid,
      `classify_provider_response` returns `failure.usage = {"input":null,
      "output":null}`. Boundaries: none. (D-77; GH-239; former AC10).

- [ ] AC112: Given HTTP 429 with absent usage, `classify_provider_response`
      returns `failure.usage = {"input":null, "output":null}`. Boundaries:
      none. (D-77; GH-239; former AC10).

- [ ] AC113: Given HTTP 429, valid usage 7/3 and body findings `[F]`,
      `classify_provider_response` returns `outcome = {"state":"failed",
      "reason":"http-429", "findings":null}`. Boundaries: none. (D-77; GH-239;
      former AC10).

- [ ] AC114: Given HTTP 503 body `secret failure`, secret `secret` and
      evidence cap 64, `classify_provider_response` returns `failure.evidence
      = "[REDACTED] failure"`. Boundaries: none. (D-77; GH-239; former AC10).

- [ ] AC115: Given committed all-home member `f1` and sibling `empty`,
      `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["empty-settlement"]}`. Boundaries: filesystem: committed
      member/evidence and specified sibling observation. (D-78; former AC11;
      `crates/cadence/src/next_action/observations.rs:192`,
      `cadence-core/bin/planning/core.mjs:1042`, `.planning/ROADMAP.md:822`).

- [ ] AC116: Given committed all-home member `f1` and sibling `malformed`,
      `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["malformed-settlement"]}`. Boundaries: filesystem:
      committed member/evidence and specified sibling observation. (D-78;
      former AC11).

- [ ] AC117: Given committed all-home member `f1` and sibling `unreadable`,
      `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["unreadable-settlement"]}`. Boundaries: filesystem:
      committed member/evidence and specified sibling observation. (D-78;
      former AC11).

- [ ] AC118: Given committed all-home member `f1` and sibling `wrong-fire`,
      `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["settlement-identity-mismatch"]}`. Boundaries:
      filesystem: committed member/evidence and specified sibling observation.
      (D-78; former AC11).

- [ ] AC119: Given committed all-home member `f1` and sibling
      `wrong-artifact`, `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["settlement-identity-mismatch"]}`. Boundaries:
      filesystem: committed member/evidence and specified sibling observation.
      (D-78; former AC11).

- [ ] AC120: Given committed all-home member `f1` and sibling `wrong-round`,
      `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["settlement-identity-mismatch"]}`. Boundaries:
      filesystem: committed member/evidence and specified sibling observation.
      (D-78; former AC11).

- [ ] AC121: Given committed all-home member `f1` and sibling `forged`,
      `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["invalid-settlement"]}`. Boundaries: filesystem:
      committed member/evidence and specified sibling observation. (D-78;
      former AC11).

- [ ] AC122: Given committed parent f1 and linked empty round-two child f2
      without parent settlement, `filter_deferred` returns `{"visible":["f1"],
      "diagnostics":["parent-unsettled"]}`. Boundaries: none. (D-78, D-79;
      former AC11).

- [ ] AC123: Given committed f1 blockers and verified literal parent
      dispositions, with unresolved child f2, `settle_parent` returns
      `{"settled":["f1"], "visible":["f2"]}`. Boundaries: filesystem: atomic
      settlement/gate/queue commit; clock: `100`. (D-78, D-79; former AC11).

- [ ] AC124: Given committed f1/f2 lineage and forged parent link,
      `verify_parent_transition` returns `{"code":"invalid-parent-link",
      "parent":"f1", "child":"f2"}`. Boundaries: none. (D-79; former AC11).

- [ ] AC125: Given committed f1/f2 lineage and unaddressed blocker o1:0,
      `verify_parent_transition` returns
      `{"code":"missing-parent-disposition", "parent":"f1", "child":"f2"}`.
      Boundaries: none. (D-79; former AC11).

- [ ] AC126: Given committed complete evidence closure C and empty
      destination, `carry_evidence` returns `{"originals":["o1", "o2"],
      "voices":["A", "B"], "material":["e1", "e2"], "selections":["v1:2"],
      "lineage":{"parent":"f1", "child":"f2", "root":"root1"},
      "allowance":"spent", "receipts":["s1", "override1"]}`.
      Boundaries: filesystem: source fixture and successful destination
      durable writes. (D-78, D-79; former AC11).

- [ ] AC127: Given committed carried closure C and deleted original home,
      `read_carried_evidence` returns `{"originals":["o1", "o2"],
      "material":["e1", "e2"], "root":"root1", "allowance":"spent"}`.
      Boundaries: filesystem: carried fixture only, original home absent.
      (D-78; former AC11).

- [ ] AC128: Given committed C and destination o1 with conflicting bytes,
      `carry_evidence` returns `{"code":"carry-conflict", "record":"o1"}`.
      Boundaries: filesystem: conflicting destination, forbid overwrite/source
      removal. (D-78; former AC11).

- [ ] AC129: Given committed parent f1 and child f2, literal valid parent
      dispositions and failed combined commit, `settle_parent` returns
      `durable_state = {"parent":"f1", "settlement":null, "visible":["f1",
      "f2"]}`. Boundaries: filesystem: fail atomic parent transition; clock:
      `100`. (D-78, D-79; former AC11).

- [ ] AC130: Given committed blocking root1 with allowance 1 and selection
      v1:2; failure between logical mutations in order `spend-then-admit`,
      `rearm_review` returns `durable_state = {"allowance":1, "child":null,
      "dispatch":null}`. Boundaries: filesystem: fail before combined commit
      and expose durable image; clock: `100`. (D-79; former AC12;
      `crates/cadence/src/pause_service_tests.rs:713`,
      `cadence-core/references/triage-gate.md:138`,
      `crates/cadence/src/evidence/overrides.rs:35`,
      `.planning/ROADMAP.md:825`).

- [ ] AC131: Given committed blocking root1 with allowance 1 and selection
      v1:2; failure between logical mutations in order `admit-then-spend`,
      `rearm_review` returns `durable_state = {"allowance":1, "child":null,
      "dispatch":null}`. Boundaries: filesystem: fail before combined commit
      and expose durable image; clock: `100`. (D-79; former AC12).

- [ ] AC132: Given committed deferred root1 with allowance 1 and selection
      v1:2; failure between logical mutations in order `spend-then-admit`,
      `rearm_review` returns `durable_state = {"allowance":1, "child":null,
      "dispatch":null}`. Boundaries: filesystem: fail before combined commit
      and expose durable image; clock: `100`. (D-79; former AC12).

- [ ] AC133: Given committed deferred root1 with allowance 1 and selection
      v1:2; failure between logical mutations in order `admit-then-spend`,
      `rearm_review` returns `durable_state = {"allowance":1, "child":null,
      "dispatch":null}`. Boundaries: filesystem: fail before combined commit
      and expose durable image; clock: `100`. (D-79; former AC12).

- [ ] AC134: Given committed root1 and successful combined transaction with
      acknowledgment lost, `rearm_review` returns `{"allowance":0,
      "replay_key":"r1", "parent":"f1", "child":"f2", "round":2,
      "state":"pending", "attempt":"a2"}`. Boundaries: filesystem: committed
      image and replay; clock: `100`. (D-79; former AC12).

- [ ] AC135: Given two identical requests r1 racing on root1 with allowance 1,
      `rearm_review` returns `durable_state = {"allowance":0,
      "children":["f2"], "attempts":["a2"]}`. Boundaries: filesystem:
      conditional-write barrier; clock: `100`. (D-79; former AC12).

- [ ] AC136: Given committed r1/f2/a2 and replay before the child return,
      `rearm_review` returns `{"child":"f2", "attempt":"a2",
      "replayed":true}`. Boundaries: filesystem: committed image; clock:
      `100`. (D-79; former AC12).

- [ ] AC137: Given carried committed root1 with spent allowance and a new
      automatic request, `rearm_review` returns
      `{"code":"allowance-exhausted", "root":"root1", "remaining":0}`.
      Boundaries: filesystem: carried fixture; clock: `100`. (D-79; former
      AC12).

- [ ] AC138: Given committed f2/a2 whose host send is uncertain,
      `recover_rearm_action` returns `{"action":"recover-observation",
      "attempt":"a2", "dispatch":null}`. Boundaries: none. (D-79; former
      AC12).

- [ ] AC139: Given committed parent selection o1:0 under root1, resubmitted
      with new occurrence and moved home, `repair_root` returns
      `{"root":"root1", "allowance":"spent"}`. Boundaries: none. (D-79; former
      AC12).

- [ ] AC140: Given committed round-two child f2 with result `failed`,
      `triage_next_action` returns `{"action":"human-choice",
      "automatic_dispatch":null}`. Boundaries: none. (D-79; former AC12).

- [ ] AC141: Given committed round-two child f2 with result `unusable`,
      `triage_next_action` returns `{"action":"human-choice",
      "automatic_dispatch":null}`. Boundaries: none. (D-79; former AC12).

- [ ] AC142: Given committed root1 spent after round two and requested round
      three, `rearm_review` returns `{"code":"allowance-exhausted",
      "root":"root1", "remaining":0}`. Boundaries: filesystem: committed
      fixture; clock: `100`. (D-79; former AC12).

- [ ] AC143: Given independent initial fire f3 with no selected-parent
      references, `repair_root` returns `{"root":"root3",
      "allowance":"unspent"}`. Boundaries: none. (D-79; former AC12).

- [ ] AC144: Given committed matching scoped receipt for o1:0 with reason
      `Accepted risk`, round 1 and unresolved survived F, `verify_override`
      returns `{"finding":"o1:0", "disposition":"survived",
      "override":"Accepted risk", "fixed":false, "refuted":false}`.
      Boundaries: none. (D-79; former AC12).

- [ ] AC145: Given committed f1 and round 2 receipt for round 1,
      `verify_override` returns `{"code":"override-round-mismatch",
      "fire":"f1"}`. Boundaries: none. (D-79; former AC12).

- [ ] AC146: Given committed f1 and receipt finding o9:0 absent from
      originals, `verify_override` returns
      `{"code":"override-finding-mismatch", "fire":"f1"}`. Boundaries: none.
      (D-79; former AC12).

- [ ] AC147: Given committed root1 with allowance 1 and stale selection
      revision 1 against saved revision 2, `rearm_review` returns
      `{"code":"stale-selection-revision", "expected":2, "actual":1}`.
      Boundaries: filesystem: committed fixture, forbid writes; clock: `100`.
      (D-79; former AC12).

- [ ] AC148: Given verified candidate c1 and exact saved human choice
      `unanswered`, `filing_action` returns `{"action":"wait-for-human",
      "create":false}`. Boundaries: none. (D-80; former AC13;
      `crates/cadence/src/store/items.rs:15`,
      `cadence-core/bin/issue-filing.mjs:718`,
      `cadence-core/bin/issue-filing.mjs:802`, `.planning/ROADMAP.md:833`).

- [ ] AC149: Given verified candidate c1 and exact saved human choice
      `declined`, `filing_action` returns `{"action":"declined",
      "create":false}`. Boundaries: none. (D-80; former AC13).

- [ ] AC150: Given verified candidate c1 and exact saved human choice
      `accepted`, `filing_action` returns `{"action":"lookup",
      "create":false}`. Boundaries: none. (D-80; former AC13).

- [ ] AC151: Given verified candidate c1 revision 2 and accepted answer for c1
      revision 1, `bind_filing_choice` returns `{"code":"stale-filing-choice",
      "candidate":"c1", "expected_revision":2, "actual_revision":1}`.
      Boundaries: none. (D-80; former AC13).

- [ ] AC152: Given two candidates with exact same file `a.rs` and claim `C`,
      `deduplicate_candidates` returns `candidate_ids = ["c1"]`. Boundaries:
      none. (D-80; former AC13).

- [ ] AC153: Given accepted verified c1 and confirmed exact tracker hit issue
      42, `filing_action` returns `{"action":"already-filed", "issue":42,
      "create":false}`. Boundaries: none. (D-80; former AC13).

- [ ] AC154: Given durable accepted intent i1/c1 and timeout after request
      transmission, `create_filing` returns `{"intent":"i1",
      "state":"uncertain", "issue":null}`. Boundaries: filesystem: durable
      intent and uncertainty writes; network: timeout after send; clock:
      `100`. (D-80; former AC13).

- [ ] AC155: Given durable intent i1 with create sent and no local
      confirmation, `recover_filing_action` returns `{"intent":"i1",
      "action":"reconcile", "create":false}`. Boundaries: filesystem:
      committed intent fixture. (D-80; former AC13).

- [ ] AC156: Given uncertain intent i1 and initially stale tracker index miss,
      `reconcile_filing` returns `{"intent":"i1", "state":"uncertain",
      "create":false}`. Boundaries: network: fixed stale miss; filesystem:
      uncertainty state; clock: `100`. (D-80; former AC13).

- [ ] AC157: Given uncertain i1 with exact remote issue 42 found,
      `reconcile_filing` returns `{"intent":"i1", "state":"confirmed",
      "issue":42, "create":false}`. Boundaries: network: fixed exact hit;
      filesystem: confirmation write; clock: `100`. (D-80; former AC13).

- [ ] AC158: Given saved declined c1 and query mode `recall`,
      `filing_evidence_view` returns `[]`. Boundaries: none. (D-80; former
      AC13).

- [ ] AC159: Given saved declined c1 and explicit lookup c1,
      `filing_evidence_view` returns `{"candidate":"c1",
      "choice":"declined"}`. Boundaries: none. (D-80; former AC13).

- [ ] AC160: Given valid native c1, unavailable FILED mirror and remote exact
      issue 42, `lookup_filing` returns `{"candidate":"c1", "issue":42,
      "create":false, "diagnostics":["filed-mirror-unavailable"]}`.
      Boundaries: filesystem: valid native fixture and denied mirror read;
      network: fixed tracker hit. (D-81; GH-250; former AC14;
      `cadence-core/bin/issue-filing.mjs:735`,
      `cadence-core/bin/issue-filing.mjs:763`, `.planning/ROADMAP.md:848`).

- [ ] AC161: Given corrupt authoritative native store, `lookup_filing` returns
      `{"code":"native-store-corrupt", "operation":"filing"}`. Boundaries:
      filesystem: corrupt native image; network: forbid lookup/create. (D-81;
      GH-250; former AC14).

- [ ] AC162: Given remote issue 42 for durable intent i1 and local sync
      failure, `confirm_filing` returns `{"code":"filing-confirmation-failed",
      "intent":"i1", "issue":42, "state":"uncertain"}`. Boundaries:
      filesystem: failed confirmation sync; clock: `100`. (D-81; GH-250;
      former AC14).

- [ ] AC163: Given a supplied forge search contract and bounded lookup
      observation `exact title hit 42`, `classify_forge_lookup` returns
      `{"state":"hit", "issue":42}`. Boundaries: none. (D-82; GH-251; former
      AC15; `cadence-core/bin/lib/filing-decision.mjs:730`,
      `cadence-core/bin/lib/filing-decision.mjs:753`,
      `cadence-core/bin/issue-filing.mjs:659`, `.planning/ROADMAP.md:849`).

- [ ] AC164: Given a supplied forge search contract and bounded lookup
      observation `complete measured miss`, `classify_forge_lookup` returns
      `{"state":"miss", "complete":true}`. Boundaries: none. (D-82; GH-251;
      former AC15).

- [ ] AC165: Given a supplied forge search contract and bounded lookup
      observation `unavailable`, `classify_forge_lookup` returns
      `{"state":"unavailable", "reason":"lookup-failed"}`. Boundaries: none.
      (D-82; GH-251; former AC15).

- [ ] AC166: Given a supplied forge search contract and bounded lookup
      observation `malformed`, `classify_forge_lookup` returns
      `{"state":"unavailable", "reason":"malformed-response"}`. Boundaries:
      none. (D-82; GH-251; former AC15).

- [ ] AC167: Given a supplied forge search contract and bounded lookup
      observation `page limit saturated`, `classify_forge_lookup` returns
      `{"state":"incomplete", "reason":"page-saturated"}`. Boundaries: none.
      (D-82; GH-251; former AC15).

- [ ] AC168: Given GitLab unmeasured empty lookup and confirmed local issue
      42, `filing_action` returns `{"action":"already-filed", "issue":42,
      "create":false}`. Boundaries: none. (D-82; GH-251; former AC15).

- [ ] AC169: Given committed matching full-participation `low-only` fixture
      and mechanically valid literal dispositions, `pause_settlement` returns
      `{"fire":"f1", "clearance":"accepted", "settlement":"s1"}`. Boundaries:
      filesystem: fixture and common atomic settlement writes; subprocess:
      fixed evidence observations; clock: `100`. (D-70; former AC18).

- [ ] AC170: Given committed matching full-participation `empty` fixture and
      mechanically valid literal dispositions, `pause_settlement` returns
      `{"fire":"f1", "clearance":"accepted", "settlement":"s1"}`. Boundaries:
      filesystem: fixture and common atomic settlement writes; subprocess:
      fixed evidence observations; clock: `100`. (D-70; former AC18).

- [ ] AC171: Given committed matching full-participation `scoped-override`
      fixture and mechanically valid literal dispositions, `pause_settlement`
      returns `{"fire":"f1", "clearance":"accepted", "settlement":"s1"}`.
      Boundaries: filesystem: fixture and common atomic settlement writes;
      subprocess: fixed evidence observations; clock: `100`. (D-70; former
      AC18).

- [ ] AC172: Given committed unresolved f1 and bare legacy AcceptedResult,
      `pause_settlement` returns `{"code":"missing-dispatch-origin",
      "fire":"f1", "clearance":"refused"}`. Boundaries: filesystem: fixture,
      forbid clearance/original writes; subprocess: fixed missing-fix
      observation; clock: `100`. (D-70; former AC18).

- [ ] AC173: Given committed unresolved f1 and invented dispatch a9,
      `pause_settlement` returns `{"code":"unknown-attempt", "fire":"f1",
      "clearance":"refused"}`. Boundaries: filesystem: fixture, forbid
      clearance/original writes; subprocess: fixed missing-fix observation;
      clock: `100`. (D-70; former AC18).

- [ ] AC174: Given committed unresolved f1 and supplied common settlement
      refusal `{"code":"original-mismatch", "finding":"o1:0", "field":"claim"}`,
      `pause_settlement` returns `{"code":"original-mismatch", "fire":"f1",
      "clearance":"refused"}`. Boundaries: filesystem: fixture, forbid
      clearance/original writes; clock: `100`. (D-70; former AC18).

- [ ] AC175: Given committed outstanding old `fix` result old1 without
      witnessed origin, `pause_obligation` returns `{"original":"old1",
      "provenance":"historical", "verified":false, "visible":true,
      "recovery":"linked-new-review"}`. Boundaries: filesystem: historical
      bytes, forbid rewrite. (D-70; former AC18).

- [ ] AC176: Given committed historical old1 and new delivered f2 with
      explicit recovery request, `link_historical_review` returns
      `{"historical":"old1", "new_review":"f2", "historical_verified":false}`.
      Boundaries: filesystem: append recovery link, forbid old1 rewrite;
      clock: `100`. (D-70; former AC18).

- [ ] AC177: Given valid matching f1 dispositions with common settlement
      transaction failure, `pause_settlement` returns `durable_state =
      {"fire":"f1", "settlement":null, "clearance":"pending"}`. Boundaries:
      filesystem: fail common commit and expose durable image; subprocess:
      fixed evidence; clock: `100`. (D-70, D-72; former AC18).

- [ ] AC178: Given committed findings o1:0 selected, o1:1 refuted, o1:2
      unanswered; saved human answers at revision 2; no fix, `select_findings`
      returns `{"kind":"provisional-selected", "revision":2,
      "selected":["o1:0"], "refuted":["o1:1"], "unanswered":["o1:2"],
      "fix":null}`. Boundaries: filesystem: fixture and provisional-view
      write; clock: `100`. (D-79; former AC19).

- [ ] AC179: Given committed provisional v1:2 selecting F at o1:0 without a
      fix commit, `read_selection` returns `{"view":"v1", "revision":2,
      "selected":["o1:0"], "fix":null}`. Boundaries: filesystem: committed
      view fixture. (D-79; former AC19).

- [ ] AC180: Given committed v1:2 selecting o1:0=F, refuting o1:1 and leaving
      o1:2 unanswered, `fix_continuation_view` returns `[{"id":"o1:0",
      "file":"a.rs", "line":1, "severity":"high", "claim":"C",
      "failure_scenario":"S"}]`. Boundaries: filesystem: committed view and
      originals. (D-79; former AC19).

- [ ] AC181: Given committed o1:0 and invented selection o9:0,
      `select_findings` returns `{"code":"unknown-finding",
      "finding":"o9:0"}`. Boundaries: filesystem: fixture, forbid selection
      write; clock: `100`. (D-79; former AC19).

- [ ] AC182: Given committed selection revision 2 and submitted revision 1,
      `select_findings` returns `{"code":"stale-selection-revision",
      "expected":2, "actual":1}`. Boundaries: filesystem: fixture, forbid
      selection write; clock: `100`. (D-79; former AC19).

- [ ] AC183: Given committed answer revision 2 and submitted revision 1,
      `select_findings` returns `{"code":"stale-answer-revision",
      "expected":2, "actual":1}`. Boundaries: filesystem: fixture, forbid
      selection write; clock: `100`. (D-79; former AC19).

- [ ] AC184: Given committed provisional-selected v1:2 without final
      settlement, `selection_consequences` returns `{"gate":"pending",
      "deferred":["f1"], "filing_candidates":[]}`.
      Boundaries: none. (D-79; former AC19).

- [ ] AC185: Given committed v1:2, same original o1:0 and mechanically valid
      final fix/counter-evidence, `bind_final_selection` returns
      `{"view":"v1", "revision":2, "original":"o1", "finding":"o1:0"}`.
      Boundaries: none. (D-79; former AC19).

- [ ] AC186: Given committed v1:2 and final ruling naming v1:1,
      `bind_final_selection` returns `{"code":"stale-selection-revision",
      "expected":2, "actual":1}`. Boundaries: none. (D-79; former AC19).

- [ ] AC187: Given committed v1:2 and exact f1 originals with final verified
      fix disposition, `settle_review` returns `{"settlement":"s1",
      "selection_revision":2, "gate":"clear", "deferred":[]}`. Boundaries:
      filesystem: common atomic settlement writes; subprocess: fixed commit
      evidence; clock: `100`. (D-79; former AC19).

## Flagged assumptions

- **The produced handoff remains a prerequisite.** No successful build or live
  episode is claimed here. The task supplied a stable-tree premise, but final
  read-only status showed unrelated branch/crates changes during this pass;
  `.codex-analysis/phase-9-10-seam-repairs.md` records that discrepancy. Those
  changes were left untouched and the audited premises retained. The current
  roadmap places phase 9 at line 728 and phase 10 at line 796; brief citations
  to older roadmap offsets must be relocated by section text. The public
  native boundary still exposes execution-only query/apply at inspection, so
  planning must verify the actual phase-9 artifacts before relying on them
  (`.planning/ROADMAP.md:728`, `.planning/ROADMAP.md:796`,
  `.codex-analysis/phase-9-decision-brief.md:99`,
  `crates/cadence/src/server.rs:223`, `crates/cadence/src/server.rs:394`).

- **Built receipts do not mean built verification.** Receipt validation checks
  a nonblank finding reference and the convenience matcher checks range,
  trigger and plan; neither verifies original findings, material or the round
  by itself. Retain this completed storage foundation while strengthening its
  consumer in D-79. Likewise, pause queue serialization omits resolved range
  IDs and uses `fix` instead of `failure_scenario`; it does not already satisfy
  the general deferred contract (`crates/cadence/src/evidence/overrides.rs:55`,
  `crates/cadence/src/evidence/overrides.rs:134`,
  `crates/cadence/src/pause/risk.rs:103`,
  `crates/cadence/src/pause_service.rs:740`).

- **The stronger contract cannot manufacture historical origin.** Imported
  REVIEW/ADJUDICATION files or a named receipt are not binary-persisted dispatch
  evidence merely because they parse. Preserve legacy evidence with explicit
  provenance and unavailable checks; do not silently promote it to verified
  participation. Missing/deleted/uncommitted source stays visible. A new review
  can establish new evidence, without rewriting the old fire
  (`cadence-core/bin/lib/adjudication-record.mjs:351`,
  `crates/cadence/src/evidence_service_tests.rs:1383`,
  `.planning/ROADMAP.md:802`, `.planning/ROADMAP.md:814`).

- **Provider compatibility and omission semantics need current evidence.**
  Frozen adapters and their comments establish reference behavior, not today's
  model IDs, effort support, response fields or host deadlines. The native plan
  must document numeric/aggregate bounds and distinguish an omitted usage
  component from an invalid one, using current provider evidence; D-76 already
  settles that invalid/overflowed usage is unavailable. Credential fencing can
  change what a provider saw, so its view mapping is necessary evidence, not a
  cosmetic redaction count (`cadence-core/bin/review-provider.mjs:1055`,
  `cadence-core/bin/review-provider.mjs:1142`,
  `cadence-core/references/review-cross-model.md:114`,
  `cadence-core/references/review-cross-model.md:120`,
  `.planning/ROADMAP.md:847`).

- **Historical forge measurements do not establish the native adapter.**
  Forgejo's measured flag is real frozen evidence, while nearby old prose still
  calls both Forgejo and GitLab assumed. Use the actual table and defect site;
  GitLab alone retains `lookupMeasured: false`. Current native lookup and create
  still need their own live observations, with deliberate authorized disruption
  for ambiguous-create reconciliation. This context performs no provider or
  forge operation and grants no remote-write authorization
  (`cadence-core/bin/lib/filing-decision.mjs:678`,
  `cadence-core/bin/lib/filing-decision.mjs:730`,
  `cadence-core/bin/issue-filing.mjs:816`, `.planning/ROADMAP.md:852`).

- **PILOT has not been satisfied by this draft.** Source and test-assertion
  inspection establishes the gaps and the existing foundations; no test suite,
  host, provider or forge pilot was run here. Every acceptance box remains open.
  An owner-reviewed pilot can establish actual episodes and saved evidence,
  not a guarantee of engineering truth or absence of missed findings
  (`.planning/phases/6/SUMMARY.md:16`, `.planning/ROADMAP.md:852`,
  `docs/rationale/architecture-v4.md:67`).
