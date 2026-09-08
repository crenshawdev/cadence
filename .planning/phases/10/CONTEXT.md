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

- [ ] AC1: Begin with the unchanged restartable store and artifact inventory
      produced by phase 9 AC15's own native admission, observation, return and
      enqueue code paths. Record the producer revision/commands and compare
      inventory hashes before opening it with phase 10. No fixture-seeded
      records, caller reconstruction or backfill may supply required H1–H5
      fields. Change gate/routing/model settings and the active phase cursor,
      then reopen with phase 10 and inspect committed, staged, named diff/file
      and specialist artifacts in phase/task/root homes. Saved policy, roster,
      model requests/host observations, source mappings, originals and exact
      occurrence/round joins remain intact. Phase-9 accepted boundary originals
      retain their bytes, IDs and admission status under the recorded contract.
      Remove a required artifact from an isolated copy: settlement refuses and
      the obligation remains visible. Delivery alone leaves settlement pending
      (`.planning/ROADMAP.md:762`, `.planning/ROADMAP.md:775`,
      `.planning/ROADMAP.md:801`).

- [ ] AC2: Reuse phase 9 H4's validator and unchanged AC11 accepted store.
      Every phase-9 accepted boundary return remains shape-admissible without
      rewritten originals when read by phase 10; evidence refusal is reported
      separately. Run the same matrix through local/provider admission,
      settlement, deferred and minimalism paths: accept empty findings and
      boundary-length Unicode text; refuse whitespace-only fields, unknown
      fields, 101 findings, over-limit strings/bytes and invalid/unsafe lines;
      preserve accepted strings byte-for-byte without normalization.
      Oversized return and aggregate settlement streams stop at the documented
      byte budget before unbounded accumulation/parsing. An unknown historical
      contract stays readable as unverified with a diagnostic and an explicit
      linked-review recovery route, without a fabricated dispatch or clearance
      (`cadence-core/bin/review-provider.mjs:885`,
      `cadence-core/bin/review-provider.mjs:1261`,
      `cadence-core/bin/lib/adjudication-record.mjs:285`).

- [ ] AC3: Start a two-voice fire through phase 9's real dispatch path. After
      empty A returns with B pending, attempt settlement before and after
      restart: it refuses and B remains named in the saved required roster.
      Interrupted B and terminal failed B cannot be omitted for clean clearance.
      Complete the admitted participation, then require one ruling per original
      finding, separate convergent entries, derived counts and an empty-success
      roster.
      Invented participation, a one-character claim/scenario change, matching
      fabricated copies of both returned text and ruling, omitted findings,
      duplicate rulings and swapped same-artifact host returns all refuse
      against the binary originals; no refusal changes the originals or clears
      the gate
      (`cadence-core/bin/lib/adjudication-record.mjs:351`,
      `cadence-core/bin/lib/adjudication-record.mjs:413`,
      `.planning/ROADMAP.md:807`).

- [ ] AC4: In an isolated evidence fixture, settlement with an invented
      hex-shaped fix ID, a blob/tree ID, ambiguous ID, unreviewed citation,
      wrong material side/line identity or fabricated counter-evidence refuses.
      A real resolved fix and valid material references pass mechanical checks.
      Before/after and reopened state show no refused settlement cleared a gate
      or removed a queued finding; failed persistence cannot acknowledge a
      successful settlement. Inject failure within the successful settlement/
      gate/queue transaction and after commit before acknowledgment: reopened
      state is wholly pending or has the valid settlement and its consequences,
      never a cleared gate or suppressed queue without that settlement
      (`cadence-core/bin/lib/adjudication-record.mjs:438`,
      `cadence-core/bin/planning/adjudication.mjs:90`,
      `.planning/ROADMAP.md:814`, `.planning/ROADMAP.md:820`).

- [ ] AC5: Consume phase-9-produced range, saved diff-file, rename/deletion and
      never-committed snapshot manifests, then remove/change working files and
      reopen. Each finding remains visible with exact originals and an explicit
      base/head/snapshot
      side; valid retained base/snapshot lines remain inspectable and can be
      mechanically verified. Verify a valid retained supporting/counter-citation
      outside primary changed paths, including evidence acquired later through
      H2; original-view and later-evidence provenance stay distinct. A source
      line cannot be replaced by the diff file's line. Deliberately unavailable
      retained material leaves the finding visible as unverified and cannot
      silently clear settlement
      (`cadence-core/bin/planning/adjudication.mjs:63`,
      `.planning/ROADMAP.md:775`, `.planning/ROADMAP.md:814`).

- [ ] AC6: Consume actual phase-9 specialist admission/dispatch/return records
      for file, frozen directory and resolved phase-range minimalism targets;
      do not fabricate the specialist ledger. Each episode names the actual
      retained target and membership, shows unchanged claim/scenario ranked by
      deletion value, distinguishes a usable empty
      list from failed review, and performs no deletion or PASS/FAIL transition.
      The dispatch record shows its single specialist reviewer; the user retains
      the deletion choice (`cadence-core/workflows/minimalism-review.md:98`,
      `cadence-core/workflows/minimalism-review.md:102`,
      `cadence-core/workflows/minimalism-review.md:126`).

- [ ] AC7: Provider integration observations show FIRST trying configured
      voices sequentially, stopping on a usable empty or nonempty return, and
      trying local fallback when all fail. No-key, transport, HTTP, malformed
      result and fallback failure each leave exactly one durable terminal
      attempt outcome; restart/replay neither duplicates closure nor converts
      failure into an empty clean review (`.planning/ROADMAP.md:768`,
      `.planning/ROADMAP.md:783`, `.planning/ROADMAP.md:829`).

- [ ] AC8: Controlled provider fixtures establish environment-before-file key
      resolution, credential-safe outbound payloads/diagnostics, no request
      on over-cap input, bounded response accumulation, and a bounded outer
      deadline that produces a saved failure. Compare the recorded transmitted
      view and line mapping with the actual payload; removed material cannot
      count as reviewed (`cadence-core/bin/review-provider.mjs:275`,
      `cadence-core/bin/review-provider.mjs:480`,
      `cadence-core/bin/review-provider.mjs:504`,
      `cadence-core/bin/review-provider.mjs:727`,
      `cadence-core/references/review-cross-model.md:120`).

- [ ] AC9: GH-237/GH-240 usage fixtures exercise invalid candidate plus valid
      thoughts and the reverse, absent components, valid zeros, fractions,
      negative/nonfinite/out-of-bound values and checked-sum overflow. Invalid
      or overflowed normalized output is unavailable, never a partial total or
      zero; valid independent input usage survives. Assert and document the
      provider-specific omission rule and bounded sanitized raw evidence
      (`cadence-core/bin/review-provider.mjs:988`,
      `cadence-core/bin/review-provider.mjs:1142`, `.planning/ROADMAP.md:847`).

- [ ] AC10: GH-239 fixtures return non-2xx responses with valid, partial,
      invalid and absent usage. The saved failed attempt retains exactly the
      available validated counts and sanitized bounded evidence before refusing
      the review; no findings-success or second closure is recorded
      (`cadence-core/bin/review-provider.mjs:1335`,
      `cadence-core/bin/review-provider.mjs:1350`).

- [ ] AC11: Consume phase 9's deferred producer and same all-home enumerator
      across later-session carry and restart. Empty/malformed/unreadable siblings,
      an unrelated fire/artifact/round and forged settlement keep the member
      visible with diagnostics. A linked round-two review over new fix material
      and old blockers does not automatically suppress round one, even if empty.
      Verify each linked parent disposition and commit D-79's explicit parent
      transition: the exact round-one member is now settled, both rounds'
      originals remain, and unresolved new child findings remain visible.
      Forged parent links and unaddressed blockers refuse parent clearance.
      Carry preserves originals, voices, material, selections, lineage,
      allowance and receipts; remove the source home before reopening solely
      from carried evidence. A conflicting destination refuses before
      evidence is lost (`crates/cadence/src/next_action/observations.rs:192`,
      `cadence-core/bin/planning/core.mjs:1042`, `.planning/ROADMAP.md:822`).

- [ ] AC12: For a blocking and a later-session deferred parent, invoke D-79's
      combined re-arm operation. Inject crashes between the logical allowance
      consumption and child admission mutations, exercising both mutation
      orders before transaction commit, and after combined commit before
      dispatch/acknowledgment. Restart and inspect allowance, replay key, parent
      lineage, child pending record and dispatch IDs: pre-commit failure exposes
      neither change; committed recovery exposes spent allowance plus exactly
      one recoverable child. No dispatch is exposed by a failed transaction.
      Replay and race requests: all committed retries return the same child and
      attempt IDs, never a second spend or fire. Restarting only after both
      writes is insufficient evidence for this criterion. Restart before return
      and carry do not restore the allowance; recover uncertain sent work before
      redispatch. Re-admitting the same parent findings under a new occurrence
      label/home resolves the same spent root obligation or refuses.
      Round-two failure/unusable return stops for human choice, a third automatic
      fire refuses, and an independent fire retains its own allowance. A scoped
      reasoned override survives restart without becoming a fix or refutation;
      mismatched round, finding reference or fabricated evidence cannot use it
      (`crates/cadence/src/pause_service_tests.rs:713`,
      `cadence-core/references/triage-gate.md:138`,
      `crates/cadence/src/evidence/overrides.rs:35`, `.planning/ROADMAP.md:825`).

- [ ] AC13: Filing fixtures bind human accept/decline to verified candidates,
      create nothing for unanswered/declined candidates, deduplicate repeated
      exact fingerprints and suppress tracker hits. Timeout after remote create
      and crash before local confirmation recover an uncertain intent; a retry
      reconciles instead of duplicating, including an initially stale index
      miss. Declines remain absent from recall and available to explicit lookup
      (`crates/cadence/src/store/items.rs:15`,
      `cadence-core/bin/issue-filing.mjs:718`,
      `cadence-core/bin/issue-filing.mjs:802`, `.planning/ROADMAP.md:833`).

- [ ] AC14: GH-250 fixtures make the legacy FILED mirror unavailable while
      native state is valid: tracker lookup still runs and a confirmed hit
      suppresses create, with the mirror problem visible. A corrupt authoritative
      native store refuses the filing operation; a failed local confirmation
      never reports a fully recorded successful filing
      (`cadence-core/bin/issue-filing.mjs:735`,
      `cadence-core/bin/issue-filing.mjs:763`, `.planning/ROADMAP.md:848`).

- [ ] AC15: For each claimed forge, bounded lookup tests distinguish exact
      title hits, complete misses, unavailable lookup, malformed responses and
      page saturation. Live single-token, multiple-token, body-only and genuine
      miss cases establish its search semantics. GitLab remains explicitly
      unmeasured without its own observations, and an unmeasured miss cannot
      override a confirmed local filing fact (GH-251;
      `cadence-core/bin/lib/filing-decision.mjs:730`,
      `cadence-core/bin/lib/filing-decision.mjs:753`,
      `cadence-core/bin/issue-filing.mjs:659`, `.planning/ROADMAP.md:849`).

- [ ] AC18: Drive the actual pause blocking/adjudicated continuation paths with
      phase-9-produced dispatch/original records and phase-10 verification.
      Low-only, empty and scoped-override cases clear only after the common
      service accepts matching origin, full participation and disposition.
      Try a bare legacy `AcceptedResult`, invented dispatch, changed claim,
      invalid fix/counter-evidence and wrong-round override through pause itself:
      each refuses clearance and survives reopen as visible unresolved evidence.
      Reopen an outstanding old `fix`-shaped result: it remains historical and
      unverified; inspect a linked new-review recovery without altering its
      original bytes. Trace successful pause clearance to the same settlement
      authority/transaction as AC4, not an alternate legacy branch.

- [ ] AC19: Before any fix commit exists, triage an actual phase-9-produced
      multi-finding fire with one selected-to-fix, one refuted and one unanswered
      finding. Persist/query D-79's provisional view and required human choices,
      restart, then drive the concrete fix-continuation adapter: it receives
      only the selected IDs and their unchanged originals. Refuse invented
      finding IDs and stale selection/answer revisions. This view cannot clear
      the gate, suppress deferred work or create filing candidates. Record a
      real fix and final verified dispositions against the same original IDs
      and selection revision; only that later settlement may change those
      consequences. No final fix ID is required to obtain the pre-fix list.

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
