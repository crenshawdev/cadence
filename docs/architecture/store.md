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

The `import` snapshot field is the import's own history and never changes after
completion. The layer mapping as it stands now lives in the `layers` field: the
current `active` paths, the digest of the global layer's bytes as the store last
wrote them (the writer refreshes it on every `global-config` participant), and
each accepted relocation with the generation that recorded it. A global layer
that canonicalizes to a new path at open, as when a home moves between a symlink
and a real directory, is accepted only when the bytes at the new place equal that
record, or the import's shared-global guard for a store that predates the record;
the mapping is then recorded at its own generation and the next open is exact.
A repo move, an absent record, or different bytes are refused as a changed layer
mapping, and the refusal names both places.

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

## Acquisition bounds

`acquisition::MAX_SOURCE_BYTES` is 16 MiB (16777216 bytes) and
`acquisition::MAX_STORE_BYTES` is 1 GiB (1073741824 bytes). Both are `u64`
constants in `crates/cadence/src/acquisition.rs`, not configuration keys.
`acquisition::decide` admits sizes at the bound and refuses larger observations
with a typed `{file, size, bound}` crossing, before content reads or reservations
based on the observed length. These limits govern acquisition, independently of
answer sizes, grammar outline thresholds and parser budgets.

The read layer's source path, issued slices, search and list use the source
bound. An issued file that grows over it returns an incomplete answer with the
crossing and no body before revision comparison. Unissued references still
refuse. Search and list skip crossings, retain notes within an 8192-byte note
budget and remain incomplete even with no continuation cursor. Direct ROADMAP
document text and measurement's project-confined source classification also use
the source gate. A source that cannot be acquired for measurement stays
unclassified. Measurement's host session transcripts, subagent transcripts,
correlation metadata and transcript rechecks remain outside this source bound.

Recall gates authored document walk observations, `Files::text`, and ARCHIVE
at the source bound. Historical authored blobs use that bound; historical
items and decisions use the store bound. `ReadGit::blob_size` provides raw size
bytes; production Git uses `cat-file -s` with a 32-byte response cap instead of
reading the blob. The existing in-memory adapters inherit a default that reads
the blob to report its true length. The pure preflight parses size and selects
class before requesting content; `Process` caps retained blob output at the
selected bound. Truncated captures or lengths differing from the size
observation are incomplete coverage. Every historical path, including one that
reuses cached blob bytes, passes preflight for its own class.

The filesystem store adapter bounds its file participants, including recovery
intent, before loading. The independent cache gates state, items and decisions
on metadata before reuse and on cold reads before parse/hash/load. Import's
pre-open and config-observation store inputs use `ConfigIo::read_store`:
`FileIo` explicitly selects the store bound, while existing in-memory readers
inherit a default delegating to `read`. Ordinary configuration reads and their
existing limits are unchanged; the input's role selects the route, not its
basename. Map-view gates intent/state/items/decisions before both its cached
metadata branch and content branch; projection text uses the source bound.
Crossings become `store::Error::Invalid` with the actual file, size and bound,
or map-view's existing inconsistent-inputs answer, never an absent/default input.

Filesystem acquisition observes path and opened-handle metadata, retains
regular-file and caller confinement checks, and delegates capped requests to
`Read::take` without reserving the reported file size. Its pure revalidation
judge refuses changed identity, metadata or length and names any observed
growth over the bound. This detects observed races, not an atomic filesystem
snapshot. The store limit guards corrupt or hand-edited input; it does not
solve aggregate heap use or GH-264.

Unit evidence supplies metadata, crossings and raw Git size bytes directly.
It detects missing or off-by-one guards, swapped classes, lost crossing fields,
acceptance of changed observations, suppression by cached state or stale-revision
handling, and malformed or incomplete historical input. It does not measure
resident memory or prove every assembled read/search/recall/store route avoids
whole-file loading; that live acceptance remains phase 18's gate.

## Git subprocess deadlines

`git_process::Caller` registers all resident-owned git launch builders.
`GUARD_GIT_DEADLINE` is 10 seconds and `GUARD_REAP_RESERVE` is 1 second:
GuardBranch enforces 9 seconds of work within the hook's nominal 10-second
envelope. Its limit names 9 seconds. `OTHER_GIT_DEADLINE` is 60 seconds for
every other caller, including landing. These constants are not configuration
keys. Each registered launch owns its process group; argument, environment,
stdin, inheritance and capture policies stay with the caller. Recall retains
its acquisition caps, literal pathspecs and no-lazy-fetch environment.

`process::validate_launch` is mandatory before System run/start constructs
a Command and before Recorded records a request or consumes an observation.
A literal or path-form git executable, including a variable program, requires
the private registration issued by git_process and its exact work deadline.
Clearing the timeout or owned group, changing the deadline, or changing a
registered descriptor to another executable class refuses before spawn.
The validated descriptor borrows immutable material for its consumer.
Recorded supplies neither registration nor deadline policy.

System starts the elapsed deadline immediately before spawning, before stdin
delivery. Stdin delivery and output drainage run concurrently with the wait,
so a blocked pipe cannot prevent observing expiry. Expiry requests group and
child termination, waits for the child, and joins the pipe workers before
returning an explicit `ErrorKind::TimedOut` observation. Cleanup failures are
errors, never successful completion. An unrelated signal, including SIGKILL,
is not evidence of a deadline. `git_process::finish` converts only the timeout
observation into a typed limit naming argv and the enforced bound; store
errors retain that type. Guard diagnostics, rail diagnostics, pause/task
errors, recall coverage, read refusals and why answers retain the named limit.
Why's optional corpus reads and comparand report incomplete coverage.

The configured sh command in execution and gpg.program signing remain outside
the git registry; landing gh keeps its 60-second timeout. A configured direct
git executable still passes the same gate. This does not inspect commands
inside shell scripts. A direct std::process::Command or tokio::process spawn
elsewhere would bypass the gate; the manual construction trace, not a source
scan test, checks for that bypass.

Value tests check completion interpretation, caller deadline selection,
launch admission, diagnostic preservation and the cleanup request at expiry.
They start no program and use no live clock. They do not establish real
elapsed deadlines, guard delivery before the hook cutoff, termination,
reaping, pipe completion or assembled caller propagation. Those remain at
phase 18's live acceptance gate. A caller driven through Recorded gets the
same admission check in tests; callers without such a test are checked only
when they run live.

## Shutdown cutoff and bound

The stdio ingress reserves capacity before decoding a tool request, then admits
the complete decoded request under the same lock that closes admission. Its
sequence number records transport order. An observed stdin EOF or received
SIGTERM closes admission atomically; a request that reaches admission after that
cutoff is refused. Bytes still buffered or partially decoded are not admitted.
Capacity is awaited: ingress retains at most 32 queued calls beside the active
call, and the resident and writer queues retain their 32-entry bounds.

The retained ingress worker owns each admitted call independently of the MCP
handler's reply future. It selects the earliest pending admission, runs handlers
in that order into the resident, and retains work when the caller cancels.
Caller cancellation is a structural contract here; live acceptance of it remains
unverified until phase 18.

`SERVER_DRAIN_BOUND` in `store::writer` is exactly
`Duration::from_secs(10)`, with no configuration key. EOF and SIGTERM record one
monotonic cutoff, and all handler draining, resident draining and writer joins
share its deadline. Successful shutdown explicitly closes the resident and
writer receivers, drains queued work, and joins the resident task and every
SessionFactory-owned writer thread, including writers opened before a later
initialization failure.

With work still open, `Drain::step` requests Wait at 9.999 seconds and returns a
typed DrainLimit at exactly 10 seconds or later. The stderr diagnostic names the
bound and open admitted request identity (admission sequence plus JSON-RPC id).
If only a writer join remains, it says so without inventing an open request.
An empty, completed drain requests normal join even when observed after the
bound. Shutdown neither acknowledges an unfinished write nor removes or adopts
its intent. Expiry exits without waiting indefinitely for a blocked syscall or
runtime blocking-pool teardown. Any open intent is left to the existing restart
contract above: validate the entire intent and all participants before replay.

## In-process evidence and its limits

The writer tests call production `Drain::step` with supplied admission state,
completion prefix, open-write identity and elapsed durations. The sole shutdown
check distinguishes Wait at 9.999 seconds from DrainLimit at 10 and 11 seconds.
Separate tests detect post-cutoff admission, selection out of admission order,
and needless waiting or a limit when nothing remains. Formatter tests detect a
wrong or omitted bound, a lost open-write identity, an invented identity during
join, or wording that claims shutdown acknowledged the open write.

These are constituent decisions, with no clock reads, signals, child processes,
store transaction or filesystem in the shutdown tests. They do not exercise the
assembled serve workflow. Actual EOF/SIGTERM delivery, caller cancellation,
elapsed exit timing, thread joins, journal acknowledgements after restart, real
crash survival and physical durability remain unverified until the phase 18
live acceptance gate. The former process-kill and strace test drivers are gone;
they are not runnable evidence. The file-sync, rename, directory-sync and
validated-recovery requirements above remain the durability contract.
