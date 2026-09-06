# Lifecycle derivation and persistent memo

Phase 4 derives a bounded lifecycle answer from captured planning artifacts. It
contains cycle (`live` or `closed`), current phase or null, total, and ordered
phase records with numeric identity, name, admitted PLAN names, native status
(`unplanned`, `planned`, `executed`, `complete`), and optional UAT counters.
It does not select next actions or define checkpoint, checker, or operator records.

The synchronous domain functions live in `src/derivation/`. `ArtifactIo` supplies
read-only observations; the binary runs that work on its blocking adapter. The
internal `CadenceServer::lifecycle` request uses the existing resident and its
`SessionFactory`. There is no additional writer, index service, or public tool.

## Snapshot schema and versions

The snapshot's full `data` object retains import metadata, source evidence,
archive metadata, raw cursor history, existing `current`, and unrelated fields.
The service installs these two siblings together:

```json
{
  "derivation": {
    "memo": {
      "encoding_version": 1,
      "semantics_version": 1,
      "input_hash": "<64 lowercase hexadecimal SHA-256 characters>",
      "answer": {
        "cycle": "closed",
        "current": null,
        "total": 0,
        "phases": []
      }
    },
    "intake": {
      "version": 1,
      "source": "data.cursor",
      "original_cursor": null,
      "normalized": "<structured CompatibilityCursor with retained provenance>",
      "retired": true
    }
  }
}
```

The example abbreviates the normalized cursor, which is a structured enum value.
The intake record preserves the original cursor fields, phrase, phase, exact
Next text, and any hold. Successful adoption retires the lifecycle assertion;
it does not execute Next. Changing the raw imported cursor re-arms validation.
Native queries never reread retired STATE bytes as cursor input.

Encoding and parser/derivation semantics have independent version constants;
neither is the software release version. A grammar, addressing, completion, or
answer-semantics change requires a semantics-version change. An encoding-layout
change requires an encoding-version change. The existing numeric grammar can
overflow binary64 to positive infinity. Domain identity remains `PhaseId`;
finite IDs serialize as JSON numbers, and overflow serializes as the explicit
string `"Infinity"`. This prevents JSON null from losing an admitted identity or
being confused with absent current. The key uses the canonical numeric address
for both finite and overflowing IDs.

## Exact key boundary

`input_key` hashes `encode_inputs` with the store's SHA-256 helper. The encoding
uses fixed big-endian u64 lengths/counts and version numbers. Strings and byte
arrays have a length followed by their bytes. Paths use their captured OS address
bytes. Observations have explicit tags: absent 0, present 1, failed 2. Successful
observations carry their payload; failures carry only a stable category byte:
permission denied 1, not-directory 2, invalid path 3, symlink loop 4, other I/O 5.
Diagnostics and failure-path text are not payloads.

Inputs appear in this order:

1. Length-delimited `cadence.lifecycle`, encoding version 1, semantics version 1.
2. Normalized absolute planning-root address, then root existence outcome.
3. ROADMAP read outcome and all successful bytes, including unused prose.
4. Ordered parsed phase count. For every declaration: canonical numeric address,
   relative phase path, listing outcome and successful admitted basename list
   with its count, SUMMARY existence outcome, UAT read outcome and all successful
   bytes. PLAN names are lexically sorted; phase declarations retain ascending
   numeric order and textual order for ties. Repeated IDs use the same captured
   path observation without another read.

Absent and empty successful reads/listings differ. Failed captures can be encoded
for testing but cannot derive or publish a successful memo. Missing phase
directories supply no plans. SUMMARY uses existence, including nonregular
entries; its body is never read. Missing or empty UAT cannot complete a phase.
SUMMARY plus qualifying UAT can complete a phase without a PLAN, preserving the
phase's locked completion rule.

Excluded observations are mtimes/ctimes, inodes, directory enumeration order,
locale, time, process/session IDs, randomness, nonmatching directory entries,
PLAN/SUMMARY bodies, STATE/cursor, REQUIREMENTS, reports, DEFERRED/ADJUDICATION,
trace, git/config metadata, CONTEXT, checkpoint/checker/operator inputs, and all
snapshot fields including the memo, integrity, generation, provenance, and
items/decisions digests. A memo write therefore cannot invalidate itself. Cursor
and controlling config checks remain mandatory outside that key; excluding them
does not promise query success after they change.

## Comparison and publication

Every query captures, derives, and checks ROADMAP declarations before first touch.
A missing root remains missing. First-touch import or transaction recovery is its
existing separate operation; a later query refusal does not roll back import.
No-write conflict measurements start after that initialization.

The query obtains a verified session view, selects and normalizes intake, and
checks applicable cursor declarations against that same freshly derived answer.
Only then does it choose memo hit or miss. Memo namespace validation refuses a
non-object namespace. Missing memo is a miss; explicit null is malformed.
The envelope requires positive integer versions, a lowercase SHA-256 hash, and
an object answer. Unknown version answers remain opaque after that envelope is
validated. Current-version answers must have all required fields (including
explicit current and UAT option presence), valid native status and numeric IDs,
and a possible lifecycle structure even when the input hash changed.

A current-version same-key memo compares every answer field: cycle, current,
total, ordered phase entries, IDs, names, ordered PLAN lists, status, UAT option
presence, and every counter. Equality returns the fresh answer. Disagreement
returns `derivation-conflict` with requested hash, available stored hash, and
deterministic paths such as `phases[0].uat.skipped`. Malformed fields are named
when available. No failed comparison repairs or overwrites the memo.

The query reobserves all named artifacts and obtains a final verified store view,
checking generation, integrity, and raw cursor/intake observation. A fully
adopted equal hit then returns without writing. Otherwise, the typed fresh memo
and intake retirement are submitted as one full-data replacement and success
waits for that operation's own acknowledgement.

`Operation::Read` retains its existing cached-view behavior. The new
`ReadVerified` revalidates disk bytes and identities first. The new
`CompareRewriteSnapshot` revalidates on the writer thread and compares both
expected generation and integrity before mutation preparation. It uses the
existing policy, transaction, disk confirmation, and reply path, retaining
operation receipts. An intervening append or snapshot replacement defeats a
stale proposal without erasing the winner. No store lock primitive was added.

`Session::request` retains its existing `current` wrapper for legacy snapshot
replacements. `derivation_view` and `commit_derivation` refresh config and call
the explicit operations directly. The commit path requires the original
import manifest, source evidence, archive, and raw cursor provenance. It submits
the complete data object, preserving its top-level placement.

Errors remain distinct:

| Code | Meaning |
| --- | --- |
| `derivation-conflict` | Malformed memo/namespace or same-input answer disagreement |
| `state-conflict` | ROADMAP or applicable cursor assertion contradicts derivation |
| `invalid-status`, `invalid-intake` | Invalid compatibility vocabulary or retirement data |
| `inputs-changed` | Artifact/intake reobservation or store-generation precondition changed |
| `input-error` | Path-specific failed artifact read, listing, or probe |
| `missing-planning-root`, `missing-roadmap`, `invalid-roadmap` | Required input absent or invalid |
| `store-error` | Store/config failure, retaining invalid/conflict/io/policy/closed kind and detail |

A stale conditional precondition maps to `inputs-changed`, while external store
corruption remains a store error. Refusals do not append records on unsafe stores.
After an admitted persistence failure, bytes may already have been installed;
there is no successful reply, and the existing transaction protocol may recover
those bytes on restart.

The final check is an observation checkpoint, not an atomic repository snapshot.
An external Markdown edit after reobservation remains possible. The conditional
store replacement serializes in-process store generations; it does not make a
filesystem compare-and-swap across Markdown and JSON.

## Executable acceptance evidence

The earlier plans' AC1/AC2 truth tables, AC5 vocabulary/adoption checks, AC6
declaration checks, and AC7 injected-input checks remain in the library and
integration targets. PLAN-3 composes them with production persistence.

| Task | Command | Required observation |
| --- | --- | --- |
| 1 / AC3 | `cargo test -p cadence --lib derivation::tests::ac3` | 119 independent observation pairs and three version/domain changes distinguish keys; both omission encoders are rejected |
| 1 / AC3 | `cargo test -p cadence --lib derivation::tests::encoding_boundaries` | Fixed v1 bytes/hash, concatenation boundaries, semantic order |
| 2 / AC4 | `cargo test -p cadence --lib derivation::tests::memo_comparison` | All answer fields compared; malformed/current and opaque old-version branches; unconditional-hit negative control |
| 3 / D-06 | `cargo test -p cadence --test store checked_snapshot` | Checked warm-read refusal and stale append/snapshot proposals preserve winners |
| 3 / D-06 | `cargo test -p cadence --bin cadence import::tests::derivation_snapshot` | Full data/provenance and top-level manifest survive restart |
| 3 / D-06 | `cargo test -p cadence --test store` | Existing pending-confirmation, fsync, and store guarantees remain |
| 4 / AC5–AC7 composition | `cargo test -p cadence --bin cadence derivation_service_tests::query_guards` | Cold/warm refusals, retired cursor advance, path failures, fresh derivation on hits, no hit write, stale publication refusal |
| 4 / shared owner | `cargo test -p cadence --bin cadence server::recall::tests` | Recall sharing, config failures, restart guarantees remain |
| 5 / AC4 | `cargo test -p cadence --bin cadence derivation_service_tests::ac4` | Fresh-process equality, 20 writer-seeded corruption cases, byte-identical refusals, comparison-bypass negative controls, consistent edit succeeds |
| 5 / AC3 | `cargo test -p cadence --bin cadence derivation_service_tests::ac3_exclusions` | Real-file exclusions stable; SUMMARY presence/UAT reason changes invalidate; failures cannot publish |
| 5 / D-06 | `cargo test -p cadence --bin cadence derivation_service_tests::memo_ack` | Installed memo stays unacknowledged while confirmation is held; both fsync failures refuse; installed generation can recover |

Child modes run only inside the binary test executable, with closed stdin and
normal process termination. They seed corruption with the session's checked
full-data method and validate snapshot integrity independently before reopening.
The comparison-bypass variant uses those same stored fixtures and must fail the
refusal predicate. It is compiled only for tests.

Final gates are `cargo test -p cadence`, `cargo test --workspace`, and
`cargo clippy --workspace --all-targets -- -D warnings`. The inherited syscall
suite requires working Linux strace; missing prerequisites are blocked evidence.
The store lock scan below must print nothing and exit 1; the frozen-tree diff
must print nothing and exit 0:

```sh
rg -n 'Mutex|RwLock|OnceLock|LazyLock|flock|F_SETLK|\.lock\(' crates/cadence/src/store
git --no-pager diff --exit-code v3.7.12 -- cadence-core/
```

PLAN-3 completion validation: 148 tests passed (34 library, 65 binary, 6
consistency integration, 12 input integration, 4 MCP, 17 store, 10 crash), with
zero failures or ignored tests. This retains all 132 pre-plan tests. The syscall
ordering test ran successfully, workspace clippy was clean, the store lock scan
had no matches, and the frozen `cadence-core/` diff was empty. Across PLAN-1,
PLAN-2, and this production composition, AC1–AC7 are discharged; none remains
open. The planning acceptance checklist itself is outside PLAN-3's write lease.
