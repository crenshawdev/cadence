# Retained review material

H2 uses the versioned `Manifest`, `MaterialEntry`, `MaterialView` and `Target`
records defined in `review/model.rs`. The original target, retained bytes and
view membership identify the material offered for review. Source acquisition
does not decide whether a finding's citation is relevant or convincing.

`retain_range`, `retain_staged`, `retain_file` and `retain_directory` return
the acquired manifest and exact byte observations after the supplied
`cadence::store::Storage` implementation confirms retention. That boundary
owns write/sync behavior. The production transaction-backed adapter is supplied
by the persistence owner; these modules do not create a second material
directory or journal.

Logical retained locations are `material-content-<sha256>` for exact bytes and
`material-manifest-<manifest-id>` for the original manifest. Content identity is
SHA-256 of the bytes without normalization. Source paths and resolved Git
objects are provenance, not fallback read locations. Existing retained records
can be confirmed again with identical bytes; different bytes at the same key
refuse. Physical locations are the durable adapter's responsibility.

Committed and phase ranges resolve their base/head once, then acquire source
blobs and the diff at those identities. Staged targets consume the explicitly
supplied authored tree and retain base/index identities with no invented HEAD.
They never substitute the current full index. Named files do not consult Git.
Directories retain their sorted observed membership and each member's exact
bytes or explicit availability. `read_directory_target` uses that saved list;
it never enumerates today's directory. Ordinary ref movement, source deletion
or rendering removal does not change `read_material`: it reads the saved
location and verifies the content identity. Missing or mismatched retained
bytes return unavailable material, with no current-source fallback.

Before persisting an acquired manifest, mapping construction records one-based
source lines as half-open byte intervals, including any line terminator.
Offsets count bytes, including UTF-8 and CRLF bytes. Diff body lines have
separate mappings to retained entry IDs, source paths, sides and source line
numbers. Context lines can map to both sides. Staged new sides are `snapshot`;
committed new sides are `head`. Rename headers preserve distinct old/new paths.
Deletion metadata marks the missing side `absent`; failed reads of existing
sides remain `unavailable`. Binary diffs retain their source entries and path
associations without inventing textual line references.

`source_reference` selects a saved mapping by diff entry, diff line and side.
`material_side` reports saved availability. `validate_manifest` refuses required
references without readable source-entry metadata or a mapped source line;
an object ID alone is not retained material. It checks the supplied manifest,
while `read_material` checks actual retained bytes. Neither operation assigns
citation relevance or evidence weight.

Primary and supporting entries remain separate. `append_material` retains
new bytes and an immutable `MaterialAppend` record containing the original
manifest ID, its contract and the new entry. Its logical address is
`material-append-<sha256(JSON([manifest-id, entry-id]))>`. This per-entry record
is append history in the same supplied store, not a replacement manifest.
It preserves earlier entry records and never edits an existing `MaterialView`.
The persistence adapter includes these logical records in its recoverable
inventory; discovery and physical transaction composition belong to that adapter.

Every append carries the caller-allocated entry ID, acquisition identity, clock
observation, content ID, retained location and primary/supporting role. An
actual supplied-to-attempt observation may bind the entry to an immutable view
that already names that entry and the same manifest. An entry cannot be added
retroactively to a previous view. Without a delivery binding the entry is
explicitly `later-evidence` and has no attempt/view claim. This unit checks
membership; it does not manufacture or authenticate a host-delivery observation.
A failed append sync returns an error rather than acknowledging an append.

`decision_review_target` owns the selected decision ID, exact text and inline
context. `diagnosis_target` owns named source-entry IDs plus exact reported and
cause text. These pure constructors produce serializable inline payloads to
retain through the material operation alongside the canonical Plan-1 target
and source entries. They do not read mutable documents or implement specialist
judgment. Their payload types do not replace the H1–H5 saved vocabulary.

H2 direct checks, from the repository root:

```sh
TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_material retain_
TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_material read_
TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --lib review::manifest
TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase9_context context_
```

Fixtures are independently authored compatibility inputs. These commands do
not discharge any item in phase 9's manual checklist or establish a live
producer/restart episode. Public module registration, native transaction
composition and consumer enumeration remain with their declared owners.
