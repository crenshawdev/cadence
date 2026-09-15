# Recovered review consumer inputs

H5 preserves seven consumer edges through native Rust query operations. These
are module operations; this document does not claim public tool registration or
migration of the surrounding workflows. Records use schema `review-1`,
interpretation `H1-H5`, and saved original validator `H4-1`.

| Consumer edge | Native query operations | Input and rendering address |
|---|---|---|
| Plan completion | `plan_completion_input`, `completion_review_state` | Saved attempt ID; `REVIEW-plan.md` in the admitted home |
| Execute completion | `execute_completion_input`, `completion_review_state` | Saved attempt ID; `REVIEW-diff-plan-<k>.md` in the admitted home |
| Execute and planned-task fixes | `execute_fix_input`, `planned_task_fix_input`, `consumer_view` | Supplied provisional selection with original-finding IDs; optional risk REVIEW rendering |
| Reports | `report_review_input`, `consumer_view` | Original input and separately supplied adjudicated view; REVIEW and ADJUDICATION remain separate addresses |
| Deferred enqueue | `deferred_enqueue_input`, `deferred_members` | Saved raw attempt input and explicit obligations; REVIEW presence alone is insufficient |
| Milestone preservation | `milestone_review_inputs` | Supplied risk_surface REVIEW/ADJUDICATION filenames, all rounds, in supplied order |
| Landing inventory | `landing_inventory` | Separate unruled and supplied adjudicated risk_surface fire/round identities |

`read_specialist_result` reads minimalism, decision and diagnosis results through
the same saved joins and immutable original identity. It returns delivery and
raw findings, including accepted empty results and failures, without a ruling.

## Authoritative identity

Raw readers take an attempt ID and recover one verified store snapshot through
`persistence.rs`. H3 attempt fire, round, occurrence and manifest must match H1
admission and H2 manifest. H4 original attempt, manifest, view and host-return
must match H3. Original finding identity is original record ID plus zero-based
array position (`o1:0`); a filename or finding text is never a join key. Readers
return the admission, manifest, attempt and original records as well as findings
and their identity, so consumers need not reconstruct those joins.

Originals retain bytes, their saved contract and acceptance interpretation.
Unknown original contracts remain unverified with their bytes available through
the existing original reader. Completion state preserves pending, interrupted,
failed, accepted-empty and accepted delivery; missing findings are never inferred
to be an empty successful result. Each raw attempt input remains separate, so a
panel consumer can retain every voice without turning one accepted voice into
completion of the roster. `read_roster` supplies the saved roster separately.

The all-home index records phase, task, root-inline, root-debug and
root-diagnosis occurrences. Its saved `path` is a rendering location; occurrence
and fire are durable identities. A consumer can regenerate a rendering from the
saved originals and view even when that path contains no REVIEW file. Rendering
files are disposable, never authoritative storage or evidence of settlement.

## View transport and inventories

A raw input has revision 1 for its immutable original. Supplied `ConsumerView`
values retain their own revision, kind, fire/round, originals, finding IDs, fix,
adjudication and rendering references unchanged. At revision 2 a provisional
selection can include `o1:0` and exclude refuted `o1:1` with `fix: null`. Both fix
adapters require `provisional-selected`; they do not derive a selection from raw
findings. `consumer_view` also transports `raw` and `settled` slots. Transporting
a supplied settled slot neither verifies it nor grants clearance.

Inventory entries carry distinct adjudication identity and adjudication rendering
address. Landing divides supplied risk_surface records by the former; it does
not inspect sibling files or treat raw findings as settled survivors. Milestone
preserves both supplied filenames, including `REVIEW-risk_surface-1.md` and
`ADJUDICATION-risk_surface-1.md`, without renaming or dropping rounds. Plan
reviews do not enter either risk-only edge. `deferred_members` returns only
explicit supplied members, so an advisory REVIEW with no obligation returns an
empty list. These operations enumerate inputs; pruning, carry, merging,
settlement verification and landing authorization retain their respective owners.

The hand-authored H5 fixtures are compatibility assets for phase 10. They do not
establish any of the live/manual episodes in the phase's manual checklist.
