# Native risk evidence and settlement

Execution completion requires current risk evidence for every accepted completed
plan. A successful detector run is evidence about a diff; it is not permission
to continue. The public tools remain `cadence_version`, `cadence_query` and
`cadence_apply`.

`cadence_apply` accepts these separate operations:

- `risk-check`: record a deterministic observation for a committed range, staged
  tree, or accepted native execution dispatch. The request includes `request_id`,
  `scope`, `source`, and an optional explicit `surfaces` list.
- `risk-fire`: submit a contracted fire bound to an actual recorded observation
  and its exact review scope.
- `risk-consequence`: submit the exact fire and its contracted consequence.

`cadence_query` supports `risk-status`, `detect-surfaces`, and `execute-next`.
Strict per-operation validation runs inside the existing three-tool boundary.
Neither the schema adapter nor an executor's prose supplies risk authority.

## Material and scope

Committed material uses full resolved `base_id` and `head_id`. Staged material
uses full `base_id` and `index_id`, with no head. Exact equality also covers the
project, planning root, live cycle, occurrence, phase, plan/worker, dispatch run,
native dispatch admission generation, selected surfaces, scan confirmation and
review scope. SHA prefixes and a head-required staged join are not accepted.

An execution source names `kind: execution`, the plan number and dispatch ID;
its scope uses `phase-N-execution`. The binary obtains the retained dispatch
base and accepted completed-task commits from confirmed native patch evidence.
A generic occurrence, later HEAD, report prose, or a caller-invented range cannot
settle that execution. Evidence is rechecked on fresh queries, including an
already completed occurrence and prior successful patch replay.

A matched or inconclusive checked scan requires a fire and consequence. Checked
clear needs no invented review. `HEAD..HEAD` is explicitly `no-range` / `skipped`,
with no completed clean scan. A nonempty range whose files are all excluded is
checked-and-empty, which remains distinct. Missing, unchecked, stale, unfired
and pending states withhold continuation. Every relevant fire must be accounted
for; one older receipt cannot clear a later scan.

Adjudication, gate-pass, reasoned override, deferral and one narrowed re-arm are
separate consequences. An override needs a nonblank reason. A deferral retains
its pending-work identity and explicit continuation disposition. A re-arm
accounts for its original fire but does not pass the new review. The resident
checks submitted review paths against the immutable diff. Provider dispatch and
reviewer adjudication remain phase 9 work; a fixture gate-pass is not evidence
of model review quality.

Pause retains its established contracted review format and authored-material
exclusions. Its adapter uses the same full-material equality, consequence
permission and narrowed-scope predicates. Pause's staged review still compares
its entire fire, including surfaces and authored scope. It preserves its
questions, reasoned override and single re-arm over the staged fix.

## Execution refusal and recovery

The fixed executor still creates signed, conventional task commits. On a valid
completed patch, Cadence atomically retains the task evidence, accepted patch
receipt, dispatch base and SUMMARY while returning `risk-pending`. Its reason
states that task evidence was accepted and continuation was refused. No terminal
Complete is installed. This permits an execution-scoped risk scan without
rerunning the tasks. Other patch refusals retain their prior invariants.

The unchanged `/cad-execute` loop displays the code and reason and stops. After
an exact scan and any required fire/consequence settle, invoke `/cad-execute`
again. Its fresh `execute-next` reevaluates every completed plan and may dispatch
the next plan or finalize the phase. Finalization conditionally rechecks settled
evidence against the current store generation. Receipt submission itself never
completes execution. Immutable patch replay preserves its original refused
answer; it cannot serve as a new completion request.

Risk observations, receipt facts and pending acceptance use confirmed writer
transactions and validated recovery intents. A lost reply can replay the same
confirmed fact without log growth; changed content under the same request ID
conflicts. A persistence failure cannot claim settled success. Process loss
retains accepted task evidence without installing an unearned Complete.

## Structural choice

`detect-surfaces` is bound to the server's project root. It lists the root and
immediate non-skipped child directories, using names, extensions and dependency
names from the five supported manifest families. It never opens source bodies
or follows directory symlinks. Missing root refuses; unreadable child directories
or manifests warn while retaining other evidence. The operation needs neither
answered config nor a risk scan and writes no configuration or risk state.

The response contains evidenced signals, silent and unspeakable categories,
warnings, an all-eight recommendation and at most four deduplicated choices.
Unspeakable is a subset of silent; destructive is in both. Evidence does not
silently choose policy. Pause presents these options and writes surfaces only
after an explicit validated answer, then asks for a repeat against the new
configuration generation.

