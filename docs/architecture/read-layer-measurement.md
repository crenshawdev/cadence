# Read-layer planner measurement

The phase-close measurement is a read-only `document` identity for one actual
Claude Code planner round. Its caller supplies only the phase, Claude session
UUID, and the actual first and last turn UUIDs. Cadence derives Claude's
encoded project directory from the server's startup-bound project; it never
accepts or returns a host-record path, transcript bytes, or caller-calculated
metric.

The resolver follows the exact main-session parent chain between the two turn
boundaries and correlates the named planner worker through Claude's retained
agent metadata. It rejects absent, ambiguous, incomplete, cross-project, or
changing records. The source digest covers the exact immutable JSONL snapshots
used by the measurement.

Each unique actual tool-use id is classified once. Cadence query operations
that expose source or process content, built-in Read/Grep/Glob calls, and shell
or other tool calls that read project content all count as reads. A direct
Read without a bounded range, or whose requested range covers the served file,
counts as a whole-file read. An opaque shell or reader call whose extent cannot
be proved increments `unclassified_reads`; build and test process activity is
not mistaken for a planner-requested read. Missing tool results or usage make
the record incomplete rather than producing zero.

For tokens, the final complete usage row for each actual `(session id,
message.id)` contributes exactly four raw components: `input_tokens`,
`cache_creation_input_tokens`, `cache_read_input_tokens`, and `output_tokens`.
Streaming details, cache-duration subtotals, output-token details, and
iterations are not added again. Conflicting final rows are ambiguous.

The bounded report names its host/session/turn/worker boundaries and source
digest, the three read counters, all four token components and their total. It
also reports the owner-approved Cadence 3.7 planner median of 183000, the signed
difference and the exact ratio. The historical raw samples and aggregation
procedure were not supplied, so the comparison is numerical; a like-for-like
savings claim remains contingent on confirmation of that procedure.

## Phase-close handoff

The qualifying close round is a new real Claude Code planning episode after the
read layer and its shared instructions are installed. The planning dispatch that
installed them explicitly required direct project reads and cannot be relabeled
as the measurement. Codex is unsupported for the host integration, so this
measurement covers Claude only.

The handoff retains the actual `planner-round` document identity, selects its
real session and first/last turn UUIDs, and shows the owner the binary-rendered
`report` unchanged. The source digest, read count, whole-file and unclassified
counters, four raw token components, token total, and 183000 comparison remain
visible even when the result is nonzero or above the baseline. Missing,
incomplete, ambiguous and unknown results stay unavailable evidence; neither a
caller nor a model supplies a replacement value or pass judgment. The existing
item verdict and `verification-complete` rules refuse an unmet cycle-purpose
truth without a new completion operation, truth, observation, or read store.

Any later phase context that continues this cycle must carry the owner's
approved cycle-purpose truth in its allowed truth set. Its id and version come
from native truth authority; planning must not manufacture them or insert them
into an already approved set.
