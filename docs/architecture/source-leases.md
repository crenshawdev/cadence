# Source leases

Native execution enforces the admitted source lease when applying an executor
patch. The binary observes the paths of every reported completed-task commit
and the whole staged set. It checks both rename endpoints and compares a merge
against every parent. Git paths are decoded strictly as UTF-8 without pathname
normalization. Unreadable, malformed or changed staged observations refuse.

The single production `covers()` predicate in `execution/lease.rs` serves
admission, dependency ordering and patch enforcement. Exact `files` cover only
themselves. Optional `directories` cover their roots and descendants at path
component boundaries: `src` covers `src/a.rs`, never `src-other/a.rs`.
There are zero exemptions, including new files, dependency lockfiles and legacy
reports. Declare every necessary path before dispatch.

## Native plan grammar and ordering

Frontmatter requires positive canonical `phase` and `plan`, `requirements`,
`files`, and `execution`; only `directories` is optional. `execution` contains
`schema: 1`, a nonempty `suite` command and ordered `tasks` with unique `id` and
nonempty `verify` command lists. The planner contract includes a parser-tested
complete example. Unknown keys, malformed fields and empty total leases refuse.

`files` is an exact-path list and rejects a trailing slash or backslash before
normalization, naming the `files` field. Directory roots may have a trailing
separator. Other existing declaration normalization is retained. Duplicate
normalized declarations within a field and more than 256 combined declarations
refuse. `files: []` is accepted only when directories supplies a nonempty lease.
Declaration admission does not check whether a path exists.

The graph applies `covers()` in both directions over exact files and directory
roots. Directory/file and nested-directory overlap create prerequisite edges
from the lower plan number to the higher number. Transitive readiness and the
deterministic lower-number selection remain; textual prefix collisions and
exact-file descendants do not create overlap. This ordering remains native
execution behavior without reviving a parallel-safety interview.

Historical phase-2 PLAN files remain unchanged. Their directory-shaped `files`
entries are historical records; deliberate replanning is required for future
native execution. Existing exact-file dispatch identities and accepted receipts
are preserved, without inserting directory defaults into historical hashes.

## Refusal and operator recovery

An `undeclared-files` answer refuses the entire patch, including any completed
prefix of a blocked patch. It preserves the execution namespace, dispatch ID,
execution version and SUMMARY bytes. The reported commits remain in Git and
Cadence leaves the index untouched. Automatic execution stops. Cadence makes no
task commits and performs no push, reset, amend, revert or force-push.

One confirmed boundary decision records the dispatch, phase, plan, reported task
SHAs, complete sorted undeclared paths separated into committed and staged
observations, recovery disposition and public response digest. The optional
versioned evidence extension preserves historical records' omitted-field bytes
and identity preimages. Recovery validates the evidence against the open lease.
Repeated identical refusals, including after restart, reuse that decision. A
large answer names its evidence digest and observation count while the full list
stays in the same durable decision; it is never silently truncated.

The operator chooses a repair appropriate to whether the history is shared.
For committed violations, repair or split offending history into signed task
commits entirely within the unchanged dispatch lease. For staged-only violations,
repair the index; in-lease commits do not need history replacement solely because
the index was refused. The binary prescribes no automatic history operation.

After operator repair, query the identical open dispatch and resubmit a corrected
full patch using the same dispatch ID and execution version. All signature,
strict ancestry/order, HEAD ancestry, distinct-SHA, conventional-subject/task-ID
and verification checks still apply. Reusing offending commits still refuses.
The earlier refusal remains durable; acceptance names only the corrected SHAs.

A needed undeclared file requires an operator planning correction. Changing the
lease or body changes the plan fingerprint and cannot silently expand an active
dispatch on retry. There is no occurrence reset or cancellation operation. Empty
or absent directory declarations preserve historical exact-file fingerprint
preimages. Already-confirmed completion receipts remain immutable on replay.
Known historical prompts retain their exact renderer and confirmed answer digest.

The `cad-execute` skill displays refused envelopes and stops. It does not inspect
paths, repair history or grant an MCP tool to the executor; it submits executor
patches field-for-field. The executor preserves rejected SHAs and requests
operator-controlled repair. Disposable unpublished integration fixtures exercise
operator replacement while retaining the original Git object for inspection;
those fixture commands are not a production recovery workflow.
