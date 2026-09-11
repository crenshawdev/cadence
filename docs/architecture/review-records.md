# Review records: review-1

The saved contract is `schema: review-1`, `interpretation: H1-H5`,
`validator: H4-1`. `review/model.rs` defines the shared serialized vocabulary.
Each record family carries its contract, either directly or through its owning
record. Read the saved contract; never reconstruct it from current settings.
`Contract::current()` identifies new records only. Unknown historical contracts
retain raw bytes as unverified originals with a reason, without conversion.

H1 is `Admission`: fire and replay key; project/root/cycle scope; home kind,
home ID and occurrence; caller, trigger/specialist, discriminator, plan, anchor,
round and artifact; admitted gate, selection, routing, roster and settlement.
Its field layout is exactly fixture H in the phase context. Optional fields
serialize as explicit nulls, without omitted fields or inferred defaults.
Null trigger/plan/anchor/gate/routing means not applicable; null observed facts
mean unknown. Empty arrays mean known empty collections. `Settlement` is
separate from `DeliveryState`; delivery cannot grant verified settlement.
`Selection` saves ordered choices and fallback, while `Roster` saves required
slots and the all-required-terminal rule. Policy is resolved before admission.

H2 is `Manifest`, joined to the fire. `Target` distinguishes committed ranges,
staged trees, named files, directories, phase ranges, selected decisions,
diagnosis and inline text. Directory membership is frozen; decision context
entries and diagnosis reported/cause text are retained. Staged and named-file
head fields are explicitly null. `MaterialEntry` identifies primary/supporting
role, path/label, side, availability, content ID and retained location. Old/new
paths preserve rename identity; absent sides have null content/location.
Unavailable material carries a reason rather than current-source substitution.
`LineMap` uses one-based source lines and zero-based half-open byte offsets.
`HunkMap` maps each diff line to its source entry/path/side/line; the source
entry itself must retain readable bytes. A diff alone is insufficient.
Acquisition ID/time, provenance, attempt and view distinguish original-view
material from later evidence. `MaterialView` freezes entries offered to an
attempt; appended evidence does not rewrite that view.

H3 is `Attempt` plus `Observation`. Attempt identity joins fire, occurrence,
round, slot, fallback origin and immutable view. Requested agent/model/effort,
routing and selection evidence are distinct from observed host/model and
launch/return bindings. Null observations and usage remain unknown; zero is
an actual measured value. Observation identity and timestamp support
idempotent appends, including late host facts and usage. The consumer owns
binding uniqueness and transactional closure, not these data definitions.
`AttemptState` distinguishes intended, observed-running, interrupted, uncertain,
accepted, failed and not-selected work. Failures and fallbacks remain records;
`DeliveryState` distinguishes incomplete, usable-complete and
complete-with-failure outcomes. A requested choice is not proof it ran.

H4 is `Original`: immutable raw bytes and content/record IDs, saved contract,
parsed findings, attempt/host-return and artifact/view bindings, acceptance,
closure and citation sidecars. `Finding` has exactly file, line, severity,
claim and failure_scenario. `FindingId` is original record plus zero-based
index (display identity `o1:0`); it never depends on finding text. `Citation`
keeps submitted entry/side/line outside the five fields; null submitted identity
has an unresolved reason. Citations are unverified inputs. `Closure` records
the durable terminal acknowledgment; neither parsing nor classification writes
it. Missing raw output has no original; historical raw bytes can have null
parsed findings and binding fields, with explicit unverified acceptance.

H4-1 admits only a findings envelope, at most 100 findings, severities
blocker/high/medium/low, nonblank text and integer lines 1..9007199254740991.
File is limited to 1024 Unicode scalar values; claim and failure_scenario to
2000 each. Accepted strings and order are never trimmed, normalized or changed.
Unknown envelope/finding fields refuse. Raw accumulation is limited to 4 MiB
before parsing; malformed and missing returns fail, while empty findings succeed.
`classify_return(Option<&[u8]>)` distinguishes missing, malformed and invalid
returns from usable findings. `validate_findings(&[u8])` returns typed findings
or a serializable diagnostic. It also rejects over-cap supplied slices. Raw
bytes remain with the caller, distinct from parsed values. `read_return`
will acquire a bounded stream without interpreting its content.

H5 is `RecoveredReview`, which carries all H1–H4 joins and delivery state.
`DeferredMember` records its all-home identity, references, enqueue time and
contract. Home kinds cover phase, task, root-inline, root-debug and
root-diagnosis. `ConsumerView` records raw/provisional-selected/settled kind,
revision, source fire/round/originals, finding IDs, optional fix/adjudication and
rendering address. A rendering is disposable, never the join key. Phase 9
originates only raw delivery views; supplied phase-10 selections and settlement
keep their own kind and revision. These slots transport evidence, not rulings.

The remaining delivery implementation consumes these types for admission,
material retention, dispatch/host observations, original acceptance, recovery,
consumer reads and deferred enumeration. It must compose admission and closure
through the existing `store::Storage` conditional transaction, not a second
store. `review/io.rs` defines only acquisition boundaries: `MaterialIo` reads
filesystem observations and frozen membership; `GitIo` supplies resolved Git
observations and object bytes; `Clock` supplies acquisition/observation time.
Production adapters belong with acquisition. No internal validator or Store
mock is introduced. This increment compiles the actual production files from
named integration targets; final module registration remains separate work.
