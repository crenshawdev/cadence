# Phase 13 close-only readiness procedure (P13-CLOSE-READINESS)

Mandatory close work under D-130 and D-134; not an acceptance-map item and
not an observation. The executor owns this procedure and the disposable
rehearsal records in `../reports/adoption-readiness.md`. The orchestrator
owns installation, the installed-state inspection, the rewrite checks' outer
red/green and rerun records, and the final go/no-go. The verifier inspects
the actual artifacts and records and authors none of them.

Three subjects are kept apart throughout, and evidence is filed under the
subject that produced it:

1. **The rewrite** (`/code/cadence`, branch `cadence/binary-owns-process`):
   its seven outer `phase13_verification` functions, their implementation
   red/green commits and the orchestrator's independent reruns. The rewrite
   tree has no native store and gets none from this close.
2. **The disposable native demonstration**: a separately authored fixture
   project driven through the real `cadence serve` binary over stdio - context
   approval, publication with typed maps, admission, red/green execution,
   independent verification runs, one complete patch, the derived report, the
   read-only audit and native completion. It proves the path exists; it says
   nothing about the rewrite's own history.
3. **The copied historical tree**: an isolated copy of the rewrite's
   `.planning` directory, classified by the binary's own read-only answers,
   backed up, first-touched, written through by two live servers,
   interrupted, recovered and restored. Copied history is never a native
   approval, map or red record and none is invented for it.

## Rehearsal (executor; disposable roots only)

```sh
cargo test -p cadence --test phase13_close phase13_adoption_copy_preserves_history_and_recovers -- --exact
```

The regression does, in order, on roots it creates and removes:

- hashes every file of the live `.planning` tree (`source_identity`), copies
  it into a disposable project, hashes the copy, and takes an explicit backup
  whose identity must equal the source's;
- reads the copied ROADMAP by hand and classifies all 30 declared phases as
  `native` (a native approved context or publication exists in the copy's
  store - none does), `imported` (a phase directory with documents) or
  `unavailable` (no directory), asking the real binary `plan-read` for each
  phase and requiring `legacy-input` for every plan and
  `native_truths_approved: false` for every phase;
- lists per phase the historical inputs the binary does not retain
  (FINDINGS/verifier-findings JSON, MANUAL, PRUNE, FALSIFICATION,
  live-record and verify-plan files) and whether a UAT document exists;
- calls `verify-next 13` (must refuse `native-approved-truths`),
  `execute-next 13` (must refuse; the answer is recorded as observed) and
  `verification-audit 13` (must answer read-only with no met trace) on the copy;
- checks that first touch created only `state.json`, `items.jsonl`,
  `decisions.jsonl` and `config.v4.json`, that every copied byte is intact,
  and that the imported snapshot holds no `context`, `plan_publications`,
  `acceptance_maps` or `verification` namespace;
- opens two servers on the same copy, writes one config key through each,
  and requires both writes durable and the reopened generation advanced
  (the store's exclusive directory lock serializes writers);
- sends a write and kills the server immediately, three times; after each,
  reopens the store as a fresh server would, requires no `.store-intent.json`
  left behind, an effective value that is either the prior or the requested
  one and never anything else, and every copied byte intact;
- deletes the copy, restores it from the backup, requires the restored
  identity to equal the backup identity, and reads it through a fresh server;
- requires the live source tree's identity unchanged at the end;
- runs the full native path on the separately authored fixture and records
  its identities.

The regression prints two uncaptured records, `ADOPTION_COPY` and
`ADOPTION_NATIVE`, each naming its own subject and roots. They are copied
verbatim into the readiness report.

## Installed close (orchestrator; after the rehearsal)

Follow `.planning/phases/13/PLAN-4.md`, "Mandatory close sequence". In order:

1. Install the current built binary and the generated native front doors
   (`skills/cad-verify`, `cad-verifier-contract`, `cad-execute`,
   `cad-executor-contract`, `cad-review` and its three aliases, `cad-audit`,
   `cad-coverage`) and the directly edited agent metadata adapters through
   the owner's actual integration. Record the installed binary path and
   SHA-256, every installed skill path and SHA-256, and confirm on a fresh
   disposable native project that planner, executor and verifier dispatches
   come from that binary. Do not infer installation from this tree.
2. Inspect the owner's actual `rules-gate.mjs` and every matching
   registration at the explicitly selected settings root, then run
   `close/retire-rules-gate.py` exactly as `close/rules-gate.md` prescribes,
   with recoverable originals. Refuse ambiguity or a stale preimage.
3. Record the installed outcome in `../reports/hook-retirement.md`,
   "Installed result", separately from the PLAN-1 rehearsal.
4. Supply, for each of the seven outer `phase13_verification` functions, the
   implementation red and green commit SHAs with their P13 task subjects and
   one independent rerun of the exact saved command at the final reviewed
   revision, retaining command, test file/function and digest, checkout root,
   HEAD/tree, index and material identity, binary identity, exit disposition,
   bounded stdout/stderr with digests, observed selection/count, observer and
   time. Label them orchestrator-observed records, never native receipts.
5. Complete `../reports/adoption-readiness.md`: the installed identities, the
   retirement outcome, the outer reruns, and the go/no-go. Leave phase 13
   incomplete while any of these is unfinished. Never initialize the live
   rewrite's native state, retroactively approve its history, or deliver any
   phase-14, 18 or 30 promise.
