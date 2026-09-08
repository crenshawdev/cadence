# Native review operations

The existing `cadence_query` and `cadence_apply` tools carry review operations.
The session binds the project root. Review responses use the ordinary envelope:
`{"status":"ok","operation":"review-…","result":…}`. Malformed operation
arguments return `status:"refused"`, code `invalid-review-operation`; storage
failures remain errors. Review returns never decode as executor patches.

## Query arguments

Every request has the literal `operation` shown below. Extra outer fields are
rejected. IDs are the binary's saved IDs, not names reconstructed from paths.

| Operation | Other fields | Result |
|---|---|---|
| review-next | fire: string | A durable issued dispatch with saved attempt and admission, or delivery/completion/action/deferred state. |
| review-admission | fire: string | Saved H1 Admission. |
| review-material | attempt: string, entry: string | Retained MaterialEntry and exact bytes (integer array); unavailable material is an error. |
| review-original | original: string | OriginalRead: identity, raw_bytes, findings, original record and saved interpretation. |
| review-attempt | attempt: string | H3 Attempt, including requested and observed facts separately. |
| review-roster | fire: string | Required/pending roster and complete saved attempts. |
| review-inventory | none | Authoritative review record families and unfiltered all-home deferred inventory. |
| review-deferred | none | One joined row per saved member/attempt, with H1–H4 references. |
| review-consumer | consumer: string, attempt: string or null, supplied: object or null | Typed consumer input. |

Consumer names `plan-completion`, `execute-completion`, `report`,
`deferred-enqueue` and `specialist` take an attempt and no supplied view.
They return raw/pending/interrupted/failed/unverified identity, delivery,
findings, admission, manifest, attempt and original. `execute-fix`,
`planned-task-fix` and `view` take a supplied ConsumerView. Fix consumers require
`kind:"provisional-selected"`; raw, provisional-selected and settled remain
distinct. A supplied selection is transported, not produced or verified here.

`review-next`, like `execute-next`, can persist work despite being a query.
Its issued marker commits before a dispatch response. A missing reply leaves
that attempt outstanding; retrying the query does not manufacture another
launch. FIRST visits saved choices in order. Panel/adjudicated delivery uses
the complete saved roster and fallback rule. External provider transport is
phase 10 work; provider instructions must be reported unavailable by the host
adapter instead of silently impersonated by a local agent.

## Apply arguments

| Operation | Other fields | Result |
|---|---|---|
| review-admit | request: AdmissionRequest | fire, attempt, replayed; off returns no fire or dispatch. |
| review-observation | observation: Observation | Saved attempt and durable observation receipt, including replay status. |
| review-return | identity: ReturnIdentity, launch: string, host_return: string or null, raw: string or null, host_failure: string or null, citations: array | Durable ReturnReceipt or typed binding/conflict/delivery failure. |
| review-material-append | manifest: string, acquisition: string, path: string or null, label: string or null, bytes: integer array, delivered: [attempt, MaterialView] or null | Append-only retained MaterialEntry after its conditional commit. |
| review-enqueue | fire: string | Durable initial member/continuation receipt, absent obligation, or enqueue-write-failed with wait. |

AdmissionRequest fields:

- `replay_key`, `caller`, `project`, `cycle`, `discriminator`: nonempty strings.
- `trigger`: plan, diff, risk_surface, or null; `specialist`: minimalism,
  decision, diagnosis, or null. Exactly one must be supplied.
- `home`: `{kind,id}`. Kinds are phase, task, root-inline, root-debug,
  root-diagnosis. IDs contain ASCII letters, digits, hyphens or underscores.
  Phase/task homes use their existing addresses; root reviews get a binary
  occurrence address. Occurrence allocation and initial admission commit together.
- `phase` and `plan`: positive integers or null; plan requires phase.
- `anchor`: string or null; `round`: positive integer.
- `target`: tagged Target from H2. File/directory/diagnosis paths are relative
  to the bound project. Committed-range supplies base/head; staged-tree supplies
  base/index and null head; named-file supplies path and null head; directory
  supplies path/members (membership is acquired and retained); phase-range
  supplies phase/base/head. Decision supplies selected/context_entries and
  `decision:{decision,text,context}`. Diagnosis supplies paths/reported/cause.
- `decision`: the decision payload above or null.

Ordinary callers are manual-plan, automatic-plan, task, execute, debug, verify
and pause. They use the existing ordinary request constructors. Admission saves
current phase-8 gate, mode, ordered eligible choices and role resolution;
reads never replace these with today's config. The saved route record retains
selection evidence. `requested.model:null` means inherit the host session model,
not an observed model or a default pin. Minimalism retains its one base voice
and no ordinary gate/routing.

ReturnIdentity has fire, occurrence, artifact, view, attempt (strings) and round
(integer). Observation has observation, attempt, launch, host_return, kind,
reference, observed_at, host, model, usage and contract, using H3's existing
vocabulary. Kinds are launch, return, interrupted, usage and host-facts. Usage
has nullable input/output/cost/currency. Contract is
`{schema:"review-1",interpretation:"H1-H5",validator:"H4-1"}`.
Observations bind actual bridge events to issued attempts. Unknown facts stay
null; a voice label is not evidence that an agent ran.

`raw` contains the exact returned text, JSON-escaped only for transport. The
adapter passes the decoded bytes unchanged through forward_return into
ReturnSubmission. H4 accumulation is capped at 4 MiB. Missing raw text stays
missing. Each citations item is null or a SourceReference with entry/path/side/
line; it never changes the five finding fields. Acceptance and closure share
one conditional store transaction. A failure receipt is not acknowledgment.

Append acquisition identity deterministically names the additional entry. With
no delivered binding it is later evidence. Delivered context must identify an
observed attempt and supplied view; no append modifies the original manifest.
Material reads use retained bytes, never today's source or moved refs.

## Storage and consumers

H1–H5 occupy `Snapshot.data.review`, sharing the existing writer and conditional
transaction journal. Routes and issued markers are adapter records beside the
admissions, manifests, retained material, homes, attempts, observations,
originals, closures and deferred members. No producer transcript is implied.
Legacy DEFERRED filename filtering remains historical; the native next-action
acquisition path also mounts the modern unfiltered all-home enumerator and
keeps unreadable inputs visible. Renderings and ADJUDICATION siblings cannot
hide a modern saved member. Settlement verification belongs to phase 10.

## Compile and direct checks

From the project root, with `TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER=`:

| Owning plan | Named cargo check targets |
|---|---|
| 1 | `cargo check -p cadence --test phase9_contract --test phase9_stream` |
| 2 | `cargo check -p cadence --test phase9_material --test phase9_manifest --test phase9_context` |
| 3 | `cargo check -p cadence --test phase9_policy --test phase9_selection --test phase9_specialist` |
| 4 | `cargo check -p cadence --test phase9_admission --test phase9_binding --test phase9_observations --test phase9_returns --test phase9_recovery` |
| 5 | `cargo check -p cadence --test phase9_consumers --test phase9_views --test phase9_inventory --test phase9_deferred` |
| 6 T1 | `cargo test -p cadence --test phase9_forward forward_` |

These are local module checks. Installed tool loading, hook behavior and native
producer/restart episodes remain in the phase's manual checklist.
