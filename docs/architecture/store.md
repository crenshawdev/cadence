# Store ownership and durability

The synchronous domain model owns versioned JSONL item revisions and decisions,
and a JSON state snapshot. The permanent semantic paths are `.planning/items.jsonl`,
`.planning/decisions.jsonl`, and `.planning/state.json`. Configuration retains its
repository and user-global layers. Snapshot integrity covers the two JSONL byte
strings and the snapshot's own serialized content with its integrity field empty.
Stable caller identities distinguish equal prose. Revisions start at one and must
advance by one. `Evidence` distinguishes missing, explicit null, and source text.
Only routing, gate, and refusal records enter the decisions log. Observed effort
normalization treats whitespace-only text as missing and preserves other host
spellings without comparing them to requested effort.

`Store::open` starts one dedicated blocking OS thread. A bounded Tokio request
queue feeds it; each request carries a separate oneshot reply. Tokio and file I/O
are outside the synchronous record algebra. Admitted work continues when a caller
cancels. A dropped reply is never evidence of success. Reads queue behind admitted
mutations, and startup recovery completes before a handle is returned.

`Policy::validate` is mandatory and has no default allow implementation. The
writer calls it at admission and after preparation, immediately before persisting
intent; recovery also validates policy before replay. PLAN-2 supplies a validator
that reloads both effective configuration layers and refuses a failed reload.
Store-integrity and policy failures return directly: they do not append a refusal
into a store they cannot safely mutate.

## Replacement and operation format

Every replacement exclusively creates a sibling temporary file, writes complete
bytes, calls `sync_all` on the temporary file, renames within that directory, calls
`sync_all` on the containing directory, and confirms installed bytes. Any failed
step prevents a success reply. File and ancestor device/inode identities, mode,
and complete bytes are compared at admission and after preparation. Symlinks and
unreadable existing files are refused. A known missing file is a conflict, not
initialization. Initialization requires all three stores to be absent.

All mutations use version-1 `.store-intent.json`, a temporary transaction artifact
containing the complete intended values and expected bytes/identities for every
participant, with its own digest. Participant names are the three semantic files
or `repo-config`/`global-config`. External names must be registered by the factory
with `Filesystem::with_participant`; journal text cannot choose arbitrary paths.
External config paths are absolute and their parents must already exist. Each
participant uses a sibling rename on its own filesystem; there is no claim that
renames across filesystems form an atomic operation.

The writer prepares disposable files and validates all participants before
installing intent. Intent itself uses the full file-sync/rename/directory-sync
protocol and must be confirmed before the first semantic replacement. Config
participants precede JSONL participants; the snapshot is last and holds operation
completion receipts. Intent removal and directory synchronization precede success.
The writer refuses further requests after a failed persistence operation.

Restart validates the entire intent and every participant before changing any
participant. An expected old target can advance. A target at the intended new
bytes is accepted only with the expected containing-directory identity, then both
its installed file and directory are synchronized again: interruption may have
happened after rename and before directory sync. Foreign bytes cause conflict
without partial replay. Every replay replacement follows the production durability
protocol. The intent is removed and its directory synchronized only after every
participant is complete. A second restart finds no intent and makes no update.
Disposable temporary files orphaned before an intent was installed are not semantic
records; they cannot authorize replay and are never adopted as a generation.

`Transaction::id` is a caller-supplied deterministic identity. Its logical content
digest excludes attempt-specific file identities, and completed identity/digest
pairs persist in `Snapshot::operations`, outside the user snapshot payload. Retrying
the same operation returns its confirmed view without duplicating records; reusing
an identity for different content is a conflict. Imports can use a frozen-source
set digest as the operation identity. Git and remote forge operations are outside
this local transaction protocol.

## Callable seams

PLAN-2 constructs `Filesystem`, registers config participant paths, supplies
`Policy`, and sends `Operation::Transact` with items, decisions, optional snapshot,
and `ExternalChange` entries carrying expected observations and complete new bytes.
`decisions::normalize` and `historical_observed_effort` share import/live evidence
rules. Missing historical receipts stay missing; worker observations without an
agent identity do not manufacture decisions.

PLAN-3 consumes `View::recall_items()` as its only structured item input. The
projection excludes every declined identity before exposing any revisions, then
returns the latest eligible revisions. `View::lookup_item` is the explicit evidence
and dedup lookup, not a recall source. Decision reads preserve append order.

## Limits

Filesystem validation is best effort at each check point. An uncooperative writer
can change a target after the last check and before replacement. Independent
session processes share this race. There is no OS compare-and-swap or cross-process
lock guarantee, and digests do not defend against a hostile rewrite of both data
and integrity metadata. Renames provide process-kill old-or-new atomicity; they do
not prove durability against power loss. AC8 requires syscall-order verification
of successful file and directory synchronization before acknowledgement.

## Process-kill regression guard (AC4)

`cargo test -p cadence --lib store::crash_tests` drives the production writer in child
processes. Test-driver callbacks park at partial temporary writing, completed
file synchronization, rename before directory synchronization, and completed
directory synchronization before reply. The parent observes a barrier and sends
SIGKILL, then compares every semantic target with independently recorded complete
old/new byte strings. Initial creation uses absence as the old candidate. Replay
is also killed at deterministic production stages. Acknowledged operations
survive a normal child restart; stable operation retries do not duplicate records.
The callbacks that block or kill are confined to the library test driver;
normal filesystem construction has a no-op observer and no process barriers.

This guards the old-or-new property already provided by frozen `atomicWrite`'s
write-then-rename implementation (`v3.7.12`, planning-files.mjs:2787-2788), whose
comment explicitly declines fsync while promising no torn file. Process kill
leaves the kernel and its caches alive. Power loss can persist a rename without
its file data and is a different failure model. These tests do not simulate power
failure and do not prove AC8's successful-fsync-before-acknowledgement ordering.

## Synchronization ordering fixture (AC8)

Run `cargo test -p cadence --lib store::crash_tests::ac8_syscall_order` on Linux with
`strace` installed and permission to trace a spawned child. The fixture runs
`strace -f -yy -o <trace>` without status filtering, so all threads share one
ordered output. Missing strace, denied tracing, or missing request markers is
reported as **BLOCKED AC8**, via a failing test, never as a skipped/pass result.
This machine does not have strace; AC8 remains unverified here.

The driver initializes the store before a synchronous request-specific START
pipe marker, then admits exactly one measured snapshot write. The writer's common
`finish_reply` operation writes a synchronous, unbuffered PRESEND pipe marker
immediately before its actual success send. The caller must receive that exact
request's success reply and writes a separate REPLY marker. The receiver marker
is only receipt evidence; PRESEND is the acknowledgement-order evidence.

The checker joins unfinished/resumed calls by TID, tracking entry and completion
separately. It binds the measured rename to its exact sibling temporary filename
and matches fsync descriptors by decoded paths. The temporary fsync must complete
successfully before rename starts; rename must complete before a successful
containing-directory fsync; that sync must complete before the writer's PRESEND
marker. Failed, missing, or reordered calls fail the check. Initialization and
other request intervals cannot supply this proof.

Two separate negative controls omit only temporary-file synchronization or only
directory synchronization at the real adapter's sync sites. They preserve the
same replacement and reply path, must receive a success reply, and must each be
rejected by the same checker. All omission settings and pre-send callbacks are
`cfg(test)` only. The integration driver compiles the exact production store
source with that configuration rather than maintaining another implementation.
Production builds have no omission controls or marker callbacks. No synthetic
trace or process-kill result is accepted as evidence for AC8.
