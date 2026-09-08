# Durable review lifecycle (H1–H4)

Review state lives in `Snapshot.data.review`, with namespace schema `review-1`.
It uses the existing store writer, ownership, recovery journal and
`Operation::CompareTransact`. There is no review journal or external material
transaction participant. A logical artifact home is discoverable through the
`homes` collection even when no disposable rendering exists.

## Transaction collections

| Collection | Key | Saved value |
|---|---|---|
| `admissions` | fire ID | Complete immutable H1 Admission |
| `replays` | admission replay key | Fire, first attempt, initial attempt IDs, occurrence and admission time |
| `occurrences` | replay key | Independent occurrence ID; `occurrence_sequence` allocates the next ID |
| `homes` | occurrence ID | Home kind/ID/occurrence, enclosing scope, logical path and fire |
| `manifests` | manifest ID | H2 Manifest with retained content references and source mappings |
| `retained` | logical material key | Exact content, manifest or appended material record bytes |
| `attempts` | attempt ID | H3 Attempt, requested identity, observed facts, usage, state and original ID |
| `host_launches`, `host_returns` | actual host ID | Binary-issued attempt ID; bindings survive closure |
| `observations` | observation ID | Exact bounded H3 Observation |
| `observation_recorded_at` | observation ID | Binary recording time, separate from the supplied observation time |
| `originals` | original ID | H4 Original, raw bytes, content digest, parsed findings, contract, citations and closure |
| `closures` | attempt ID | One terminal Closure; no second close for a replay or late observation |
| `failed_returns` | attempt ID | Exact failed submission, including missing bytes and actual failure when supplied |
| `recovered_at` | attempt ID | Recovery time for interrupted work |

`original_sequence` allocates original IDs. Finding identity is the original ID
plus zero-based index; citation sidecars retain these identities and supplied
source references separately from the five finding fields. A missing citation
is explicitly unresolved. No citation is verified by delivery.

`persistence::records`, `get`, `insert`, `put`, `contribute` and `update` are the
shared namespace adapter. `insert` permits an identical immutable replay and
refuses replacement; `put` updates mutable records. Callers retain unrelated
namespace members when adding collections. `contribute` starts with the
caller's proposed snapshot, preserves import/source provenance and every other
snapshot member, and leaves item, decision and external participants intact.
`commit` compares the supplied View generation and integrity. `read` performs a
verified store read, including the store's existing recovery protocol.

## Admission and retained material

`admission::acquire_material` calls the real Plan 2 named-file, directory,
range/staged acquisition and mapping operations with `MaterialStorage`.
This adapter implements the existing Storage interface over transaction-local
logical records. Its install/confirm operations stage and check bytes; the
outer store transaction provides durability. It does not open source paths or
create a project. Other retained target forms can supply their manifest and
material participant directly. Later material acquisition can load
`MaterialStorage::from_records`, use Plan 2 append operations and contribute
the resulting retained records through the same conditional transaction.

`contribute_admission(view, transaction, input, clock)` allocates the occurrence
and inserts H1, retained material/manifest references, the all-home inventory,
required roster and initial intended attempts into the caller's transaction.
It returns an opaque AdmissionContribution, with no dispatch instruction.
After the caller commits through CompareTransact,
`acknowledge_admission(committed_view, contribution)` verifies the exact saved
replay binding and returns admitted fire/attempt identity. The caller must
supply the successfully committed View to this step.

`admit_pending` uses that contribution and acknowledgment path. Revision
conflict exposes no dispatch. A committed replay key returns its saved identity.
`allocate_occurrence` supports separate durable allocation: an independent key
advances the sequence even when material, filenames or task slugs repeat;
a replay returns the existing occurrence. All five HomeKind variants retain
their scope and logical home address. A null/unavailable store snapshot refuses
admission rather than treating unrecorded work as durable success.

## Observations and returns

`binding::bind_return` checks fire, occurrence, artifact, view, attempt and round.
`bind_host_return` checks the global return-to-attempt binding independently of
whether the previous attempt is terminal. Caller voice labels do not establish
participation. The host observation input is the saved `Observation` vocabulary:
binary attempt, actual launch/return IDs when available, observation kind,
reference, observed host/model and usage. Missing facts stay null.

`attempts::record_observation` commits the exact observation and updated attempt
together. References are nonempty and bounded to 4096 Unicode scalar values.
It binds actual host launch/return IDs, refuses conflicting known facts, and
recognizes identical observation IDs before writing. Late facts can fill unknown
usage/model values on terminal attempts. They do not reopen an attempt, alter
an original or insert another closure. Usage is saved as observed values, not
summed again for a duplicate event. After a conditional conflict, the operation
reads the saved winner and recognizes the identical event there.

`returns::accept_return` requires previously observed launch/return bindings for
raw results and validates the exact identity. It uses the saved H4-1 contract
and the real bounded validator from `contract.rs`. A successful result stores
raw bytes, SHA-256 content identity, exact finding strings/order, stable finding
identities and unverified citation sidecars together with the attempt and its
single closure. The successful store reply follows file/directory sync and
confirmation. A failed sync returns `delivery-write-failed`, unacknowledged;
the store's journal may subsequently recover that intent.

Identical accepted bytes and citation inputs return the saved closure.
Conflicting submissions cannot overwrite the original. Missing, malformed or
explicitly host-failed returns save their failure submission and close as
failed, preserving already observed usage. Plan 3's FIRST selection supplies
the subsequent selection result; it does not erase failed attempts. A
conditional loser reads the winner to recognize replay or report conflict.
Delivery never changes H1's settlement-pending state.

## Recovery and compatibility entry points

The following reads are phase 10 compatibility entry points. They read saved
records under the saved H4-1 interpretation; they do not re-admit originals
through today's validator or reread current configuration, cursors, sources or
renderings.

- `read_admission`: complete saved H1 values.
- `read_attempt`: requested voice and separately observed facts from H3.
- `read_original`: original record, exact raw bytes, saved parsed findings,
  contract and stable finding identities. Unknown validator contracts retain
  their raw record with an explicit unverified reason and no trusted parsed
  finding view; this read does not rewrite stored bytes.
- `recover_original`: saved original findings, independent of a missing rendering.
- `read_roster`: frozen required slots and their pending/interrupted membership.
- `read_voice_originals`: separate slot-to-original and slot-to-finding-array
  maps, preserving accepted-empty arrays and refusing duplicate accepted voices.

`recover_attempt` marks intended/pending-admission or observed host-return work
without accepted originals interrupted in a conditional transaction. It creates
no empty review, terminal close or redispatch. A terminal winner encountered
during recovery remains terminal. The supplied fixture case names describe the
interruption point; their stored states use Plan 1's `intended` and
`observed-running` vocabulary.

The named targets `phase9_admission`, `phase9_binding`, `phase9_observations`,
`phase9_returns` and `phase9_recovery` compile these actual source files directly.
Their hand-authored input tables include literal originals and raw UTF-8 Q;
outer Snapshot framing and filesystem schedules supply deterministic boundaries.
They do not establish a live host episode, installed-hook behavior, or the
manual native-producer handoff. All four phase-9 manual checks remain separate.
