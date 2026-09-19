# Phase 4: Derivation and the internal spine - Context

Gathered: 2026-09-06
Feeds: /cad-plan 4

## Scope boundary

In: Derived phase status, an internal vocabulary for that status, and a memo
keyed by the inputs actually consumed. The phase 4 / phase 5 division survives
contact with the code: lifecycle needs E01-E04 and E07-E11; cursor comparison
needs E12-E15, not checkpoint payloads or checker answers. These E-number
citations name rows in `.codex-analysis/phase-4-evidence-set.md`, the grounding
audit; its findings are carried forward, not reopened. The narrowed ruling at
`.planning/ROADMAP.md:508-525` governs the earlier, broader goal and tuple at
`:456-492`.

Out: Phase 5 owns next-action selection; durable checkpoint Current task/Need
records (E24), checker verdicts and revision outcomes (E37-E38), operator
answers (E65), the unified operator override contract, evidence refs on
contracted results, and the `cad-pause` collapse, including its preservation
and resume obligations (`.planning/ROADMAP.md:527-580`; E30). Phase 6 owns the
public tool boundary (`.planning/ROADMAP.md:582-605`). Do not build the larger
task/gate/continuation tuple here. Do not port the whole frozen `status`
envelope under the name of phase derivation: directory diagnostics,
requirements reconciliation, deferred membership and outstanding report sets
are separate observations (E05-E06, E16-E20). No change to frozen
`cadence-core/`; the audit's Scope and verification boundary records its
`v3.7.12` baseline.

Deferred: The above phase 5 work, explicitly. Existing durable review override
receipts are already accounted for by E41-E42; they do not supply a universal
answer record or a checker verdict (E37-E38, E65). No newly discovered durable
source overturns the split. Full-envelope memoization would need the larger
input set in the audit's answer B; this phase must not claim to provide it.

Plan shape: three plans, same phase. Three seams: the captured inputs and
pure lifecycle derivation (AC1-AC2, AC7), vocabulary and consistency checking
(AC5-AC6), then the persistent memo through the existing store (AC3-AC4).
The first lands before the second, and both before the memo: otherwise the
hash can freeze an unsettled answer or a second cursor vocabulary. This keeps
the source contract separate from its persistence without pulling in phase 5's
records. The store already exposes a snapshot rewrite and an awaited writer
request (`crates/cadence/src/store/writer.rs:14-20`, `:111-122`). This is a
recommendation for `/cad-plan 4`, not a PLAN or an execution-vehicle ruling.

## Durable decisions

- D-01 (Derived lifecycle, bounded answer): Use a synchronous pure derivation
  over captured observations, with I/O at the edge. Its answer contains cycle
  (`live` or `closed`), current phase or null, total, and ordered phase records
  containing numeric id, name, admitted PLAN names, one of `unplanned | planned
  | executed | complete`, and optional UAT counters. Keep cycle and phase
  status separate; an empty closed cycle and an all-complete live cycle both
  have null current. No next-action field, task position or invented gate
  outcome belongs to this answer. ROADMAP declarations and cursor assertions
  are compared separately and cannot set lifecycle status. Evidence: E02-E04,
  E07-E11; `cadence-core/bin/planning/status.mjs:156-170`, `:315-332`;
  `.planning/ROADMAP.md:411-417`, `:508-518`. If wrong: a passing lifecycle
  test can be mistaken for proof of continuation or gate settlement that the
  inputs never established.
- D-02 (Completion credulity, inherited deliberately): Preserve the audited
  rule: matching PLAN names alone yield planned; SUMMARY existence overrides
  the PLAN check and yields executed, or complete when UAT has a nonempty
  parsed item set whose every item passes or is skipped with a truthy reason.
  Therefore SUMMARY plus qualifying UAT completes a phase with NO PLAN. PLAN
  and SUMMARY bodies are not validated, and a directory at a matching PLAN
  name or at SUMMARY can count. UAT frontmatter claiming complete cannot
  substitute for qualifying items. **The rejected option is to require a
  readable, valid PLAN/SUMMARY or a PLAN before completion:** that would make
  some currently complete trees refuse or become incomplete. Requiring valid
  bodies would also need content-validation rules and body hash inputs;
  requiring PLAN presence alone would change only the completion predicate.
  Inheritance retains the false-positive risk; it is compatibility, not proof
  that work shipped.
  Evidence: E07-E11; `cadence-core/bin/planning/core.mjs:192-205`;
  `cadence-core/bin/lib/planning-files.mjs:1834-1875`, `:1916-1919`;
  `.planning/ROADMAP.md:520-525`. If wrong: an empty or nonregular SUMMARY and
  an asserted passing checklist still produce complete despite absent work.
- D-03 (The memo's exact input boundary): Memoize only D-01's lifecycle
  answer. Hash a versioned, unambiguous, length-delimited encoding in the
  following order; all observations come from the same captured value the
  pure function receives. The chosen hash is SHA-256, already used by the
  store (`crates/cadence/src/store/model.rs:99-101`). The input sequence is:

  1. Domain tag, encoding version, and parser/derivation version. Changing
     parsing, numeric addressing, completion or output semantics changes the
     version; a software release string alone is not the contract.
  2. Selected planning root P's normalized absolute address and its existence
     observation. Resolve the root once per capture; keep different roots
     separate. Address each phase as `P/phases/String(n)` using the frozen
     numeric addressing rule, not the ROADMAP number's original spelling.
  3. `P/ROADMAP.md`: read outcome, then all bytes on success. These cover the
     section/fence grammar, phase number/name/description/checkbox fields and
     textual order. Parse into ascending numeric phase order, preserving
     textual order for equal numeric ids. Hashing the whole document is
     conservative: prose-only changes may invalidate the memo.
  4. For EACH parsed phase in that order: numeric id and addressed relative
     path; phase-directory listing outcome; the admitted raw basename list
     matching exactly `PLAN.md` or `PLAN-<digits>.md`, sorted lexically and
     encoded with its count; `SUMMARY.md` existence observation; then
     `UAT.md` read outcome and all bytes on success. Repeated numeric ids
     reference the same captured path observations; do not reread that path
     for the second entry. UAT bytes cover item recognition/order, every
     parsed status/reason, and the counters, including malformed and unknown
     fields. They also conservatively cover unused frontmatter and prose.

  Outcome tags distinguish present/success, absent and failed observation;
  failed observations carry a stable error category, not localized OS text.
  Empty bytes and absent files are different inputs. SUMMARY's observation
  retains existence semantics, including a dangling link being absent; it
  does not grow a body read or regular-file requirement. D-07 governs refusal
  on read errors; such captures cannot produce a successful memo.

  Excluded as unstable: mtimes/ctimes, inode numbers, incidental directory
  enumeration order, locale ordering, current time, process/session ids and
  random values. Preserve semantic ROADMAP/UAT file order; only the PLAN
  basename set is sorted. Excluded as outside this answer: PLAN/SUMMARY
  contents, nonmatching phase-directory entries, STATE/cursor fields,
  REQUIREMENTS, reports, DEFERRED/ADJUDICATION records, trace, git, config,
  CONTEXT, checkpoint/checker/operator inputs, and the memo itself. These
  exclusions must not be read as inputs to a full status or routing answer.
  In particular, cursor comparison is freshly evaluated outside the memo.
  Evidence: E01-E04, E07-E15, E16-E20; the audit's answer B and stability
  limits 1-4; `cadence-core/bin/planning/core.mjs:192-205`;
  `cadence-core/bin/lib/planning-files.mjs:85-101`. If wrong: changing an
  omitted lifecycle input returns a stale answer under an unchanged key, or
  an unstable input prevents identical captured evidence from sharing a key.
- D-04 (Disagreement and changed inputs): On every query, including the first
  after restart, capture inputs and freshly derive D-01's complete answer.
  If a stored memo has the same version and input hash, compare every answer
  field, including ordered names/plans and UAT counters, with the fresh answer.
  A difference is a typed `derivation-conflict`: return an error naming the
  hash and differing fields, return no successful answer, and leave the memo
  and source bytes unchanged. Never repair that memo in the failed request.
  A different hash/version is an ordinary miss: validate the fresh result and
  replace the memo through the store. It is not disagreement merely because
  a human changed markdown. Missing memo is also a miss; malformed memo is a
  conflict, not permission to overwrite it.

  Separately, a ROADMAP checkbox inconsistent with derived completion or an
  applicable normalized cursor assertion inconsistent with derivation is a
  typed `state-conflict`, even on a cache miss. Name the source and the actual
  two values; return no successful answer and perform no memo/source write.
  This deliberately strengthens the frozen successful-with-drift policy.
  An internally consistent human edit succeeds under a new key; conflicting
  declarations require correction, not a phase 5 override. An internal
  request error is the binary behavior here; public envelope/CLI exit mapping
  belongs to phase 6. Evidence: E04, E12-E15;
  `cadence-core/bin/planning/status.mjs:164-170`, `:227-262`, `:315-332`;
  `.planning/ROADMAP.md:494-518`; the audit's answer B, final paragraph.
  If wrong: either a legitimate edit is rejected merely for invalidating the
  cache, or a same-input contradiction is silently overwritten and lost.
- D-05 (One lifecycle vocabulary, compatibility at intake): The four D-01
  values are the only native lifecycle spellings. At legacy cursor intake,
  map `ready to plan` and `context gathered` to unplanned, `phase complete`
  to complete, and planned/executed to themselves; accept the canonical four
  words directly. Preserve the original phrase as provenance. Treat paused
  as a separate hold with phase and exact Next text, never as a fifth
  lifecycle value and never as authorization to invoke Next in this phase.
  Unknown nonblank statuses return a named invalid-status error rather than
  guessing a phase state.

  For a live current phase, a nonpaused assertion agrees only when BOTH phase
  id and canonical status agree. For all-complete live phases, accept complete;
  for a closed cycle, accept complete or unplanned and require cursor total
  zero independently. A paused hold bypasses lifecycle comparison, as before,
  but cannot suppress the closed-cycle nonzero-total conflict. Normalizing
  aliases first deliberately also makes `context gathered` agree with a closed
  cycle as unplanned; of those two unplanned aliases, frozen code accepted
  only `ready to plan` there. The consequence of one vocabulary is that aliases
  cannot secretly retain
  different lifecycle agreement rules. Missing/unparseable legacy cursor
  remains unavailable, not a guessed phase.

  Apply this check at compatibility intake, then retire the imported lifecycle
  assertion after successful adoption of the derived memo. Retain its original
  fields, phase, hold and Next as historical/resume data for phase 5; do not
  repeatedly compare that historical phase/status on later native queries.
  Native queries compare their memo with derivation, not an independently
  writable cursor. This retirement is normalization of an existing record,
  not creation or acceptance of a new operator decision. Evidence: E12-E15;
  `cadence-core/bin/planning/status.mjs:121-125`, `:227-262`;
  `cadence-core/bin/lib/planning-files.mjs:13-36`;
  `cadence-core/bin/planning/cursor-set.mjs:81-84`;
  `.planning/ROADMAP.md:133-135`, `:498-518`. If wrong: the identical-word
  diagnostic survives, or a retained historical cursor prevents every later
  legitimate phase advance; erasing Next instead would break phase 5's resume
  input.

## Decisions

- D-06 (Use the store without hashing the memo into itself): Put the versioned
  input hash and D-01 answer in a namespaced part of `state.json`'s `data`,
  through the existing writer. Preserve unrelated snapshot data and imported
  provenance; record D-05's completed intake with the successful memo write,
  so a failed intake is never marked accepted. Imported cursor input is
  `data.cursor`, not a new live read of retired `STATE.md`; an explicit legacy
  compatibility adapter can consume STATE bytes before import. The current
  import already retains available/phase/total/name/status/next/updated and
  original fields there. It does not implement the canonical vocabulary, so
  `available:true` alone is not validation of a frozen cursor's grammar.
  Validate compatibility inputs before comparison; keep unavailable inputs
  unavailable. Do not hash the whole state.json, its generation/integrity,
  source evidence or decisions/items digests as lifecycle inputs: a memo write
  must not invalidate its own key. Store integrity remains independently
  checked, and a failed store write cannot be acknowledged as a successful
  memo update. Evidence: `crates/cadence/src/import/decisions.rs:26-54`;
  `crates/cadence/src/import/mod.rs:338-339`;
  `crates/cadence/src/store/model.rs:88-97`, `:124-146`;
  `crates/cadence/src/store/writer.rs:14-20`, `:111-122`, `:157-178`.
  If wrong: memo writes cause perpetual misses, an import silently reactivates
  retired STATE bytes, or snapshot replacement destroys the pause provenance
  phase 5 still needs.
- D-07 (Observed inputs, not an atomic repository snapshot): Capture once,
  derive and hash that immutable capture, and reobserve the named inputs
  before returning success or committing a new memo. If the two captures
  differ, return `inputs-changed` without publishing the candidate; the caller
  can retry. Recheck compatibility cursor input as well when consuming it,
  although it is outside the lifecycle key. Missing phase directory means no
  plans; missing SUMMARY means absent; missing/empty UAT cannot qualify
  completion. A failed read/list/probe other than absence returns a named
  input error with the path, never an empty successful observation. This is
  deliberately stricter than frozen read-error swallowing, not a new claim
  about the frozen four-state rule. Use injected I/O failures to test it,
  without relying on chmod being effective for the test user. No claim of an
  atomic multi-file snapshot or exclusion of an edit after the final check is
  made. Evidence: E01, E07-E09; `cadence-core/bin/planning/core.mjs:51-52`,
  `:192-205`; the audit's answer B, stability limit 4;
  `.planning/ROADMAP.md:445-452`. If wrong: the key hashes newer bytes than
  those that produced the answer, or a permission failure is cached as proof
  that no work exists.

## Acceptance criteria

- [ ] AC1: An executable truth-table test of the production pure derivation
      covers no artifacts -> unplanned, admitted PLAN only -> planned,
      SUMMARY without qualifying UAT -> executed, and SUMMARY plus qualifying
      UAT -> complete both WITH and WITHOUT PLAN. Include empty/nonregular
      PLAN/SUMMARY, malformed/empty UAT, frontmatter-only complete, unknown
      item status, pass, and skipped with/without reason. Negative controls:
      deleting the last skip reason prevents completion; adding a PLAN
      prerequisite makes the no-PLAN complete case fail. Expectations come
      from D-02 and the opened `derivePhases`/`uatComplete` functions
      (`cadence-core/bin/planning/core.mjs:192-205`;
      `cadence-core/bin/lib/planning-files.mjs:1916-1919`; E07-E11).
- [ ] AC2: Tests calling the production parser and derivation obtain current
      from the first non-complete phase in ascending numeric ROADMAP order,
      preserve textual order for numeric ties and address their shared
      `String(n)` directory, and distinguish closed/null/zero from live/null
      with all phases complete. A missing section or zero-entry out-of-grammar
      section refuses; a live list with malformed neighbors retains E02's
      parsed canonical entries.
      Negative controls: permuting unequal phase entries cannot change
      current; changing the first complete phase's qualifying UAT to pending
      makes that phase current; checking a box cannot make it complete.
      Check the pure answer before D-04's consistency refusal in the last
      case. Evidence: E01-E04; `cadence-core/bin/planning/status.mjs:137-170`;
      `cadence-core/bin/lib/planning-files.mjs:85-101`, `:153-188`.
- [ ] AC3: A table-driven test of the production capture encoder mutates EACH
      D-03 input component independently and observes a changed key, including
      root/version, ROADMAP bytes, admitted PLAN names, SUMMARY existence,
      UAT bytes, and present/absent/error tags. Reordering directory returns,
      touching mtimes, editing PLAN/SUMMARY bodies while preserving existence,
      or editing excluded files leaves the key unchanged. An encoder that
      omits SUMMARY existence or UAT reason bytes fails the table. Failed
      captures exercise key encoding only and must not create success memos.
      This tests the bounded lifecycle key, not the audit B full envelope
      (D-03; E01-E04, E07-E11).
- [ ] AC4: An integration test through the real store derives, persists and
      reloads the same lifecycle memo after reopening the service. Seed a
      validly stored memo with the same key but a changed answer field: the
      next query returns `derivation-conflict`, names the differing field,
      and leaves persisted bytes unchanged. Repeat with malformed memo data.
      As the control, a consistent artifact edit changes the key and succeeds
      with the newly derived answer; a memo write alone leaves the key stable.
      Bypassing fresh comparison makes the corrupt-answer case fail. Use the
      store writer to seed semantic corruption so its integrity check cannot
      mask a missing derivation comparison (D-03-D-04, D-06; E07-E11;
      `crates/cadence/src/store/model.rs:130-146`).
- [ ] AC5: Compatibility tests pass phase 3/current unplanned with each of
      `unplanned`, `ready to plan`, and `context gathered` through the actual
      normalization/comparison path and get canonical unplanned without
      cursor conflict. Cover the closed/all-complete and paused/total rules
      in D-05, unknown-status refusal, and preservation of exact Next and
      original fields after intake and restart. A subsequent legitimate
      phase advance uses derivation, not the retired imported assertion.
      Negative controls: a different nonpaused phase or planned assertion
      against current unplanned conflicts; reinstating the frozen AGREE table
      fails the canonical-unplanned case. Evidence: E12-E15;
      `cadence-core/bin/planning/status.mjs:121-125`, `:227-262`;
      `crates/cadence/src/import/decisions.rs:26-54`.
- [ ] AC6: With a cold memo AND with a warm memo, integration tests introduce
      each applicable declaration conflict from D-04-D-05 (checked/incomplete,
      unchecked/complete, incompatible intake cursor, closed nonzero total).
      For cursor cases, seed an unconsumed compatibility intake beside the
      memo; the retired historical cursor is AC5's nonblocking control.
      Each returns `state-conflict` naming source and compared values, no
      successful answer and no source/memo write. Correcting the assertion
      permits success. Negative control: returning the frozen successful
      envelope with drift makes the test fail. The status expectations must
      call the production derivation, not copy the checkbox into an expected
      status (E04, E12-E15; `cadence-core/bin/planning/status.mjs:164-170`,
      `:227-262`, `:315-332`; D-04).
- [ ] AC7: Inject a UAT or SUMMARY change between capture and final recheck:
      the production query returns `inputs-changed`, publishes no candidate
      memo, and preserves the prior one. Inject a read/list/probe denial:
      it returns a path-specific input error, not an unplanned/executed
      success. Ordinary absence still follows AC1. Negative controls:
      disabling reobservation or converting denial to absence makes the
      corresponding check fail. This is a check-point guarantee, not a claim
      about edits after that check (D-07; E01, E07-E09;
      `cadence-core/bin/planning/core.mjs:51-52`, `:192-205`).

## Flagged assumptions

- **UNVERIFIED historical provenance:** E13 and the audit's claim 6 establish
  the identical-word drift mechanism, not the actual phase-2 incident's
  cause. The contemporaneous STATE bytes and status output would settle it.
  AC5 tests the mechanism without depending on that history.
- **UNVERIFIED recovery outside this phase:** checkpoint Current task/Need,
  checker result and every operator answer after conversation loss remain
  the audit's gaps (E24, E37-E38, E65). Phase 5 must supply and test their
  durable contracts. Generic imported Gate records do not establish those
  contracts (`crates/cadence/src/import/decisions.rs:57-79`). The audit also
  leaves progress's acquisition of skip_discuss and a complete deterministic
  environment evidence set unverified (E56, E25/E50/E52/E58/E64); explicit
  acquisition/recording and restart tests would settle those routing inputs.
- The memo is a checked assertion, not a promise to avoid derivation work on
  a cache hit. D-04 deliberately recomputes to detect same-input disagreement;
  no performance claim is made (`.planning/ROADMAP.md:494-496`; audit answer B).
- D-02's credulity, D-04's hard conflicts, D-05's alias normalization and
  retirement of the imported assertion, and D-07's refusal on I/O errors are
  explicit port decisions. Frozen goldens are evidence for the baseline,
  not an instruction to undo those choices (E04, E07-E15). Completion still
  does not prove reports complete or work committed (E20, E26).
- The seven AC ids are the UAT contract: preserve AC1-AC7 and require at least
  one UAT item naming each id; do not turn the negative controls into extra
  unnumbered acceptance criteria (E49). All checks above use executable tests
  and injected observations; none requires a human-only tool or a
  human-verify availability claim.
