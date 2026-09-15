# Phase 35: The moved home

## Scope boundary

The session's import manifest carries one field for two jobs. At open, active is rewritten to where the config layers stand now (import/mod.rs:1292) so config writers see current paths, while the stored manifest keeps where they were at import as history (import/mod.rs:1268). The evidence guard (import/mod.rs:793) compares the two byte for byte, so after any accepted relocation every gate answer, checkpoint and authorization is refused; nothing recorded the store's own relocation as a state a write must survive. The session keeps the stored manifest untouched and carries the current layer paths as a separate field; the guard compares against the stored manifest; writers read the current paths. Lease: crates/cadence/src/import/mod.rs, crates/cadence/src/import/tests.rs, and the callers of import_manifest().active (crates/cadence/src/pause_service.rs, crates/cadence/src/derivation_service_tests.rs). No new records. Runs after 34 and before 31 resumes, so the temporary binary is retired the moment 31 plan 5 lands.

## Durable decisions

- D-155. The stored import manifest is history and is never rewritten in memory; where the layers stand now is a separate fact the session carries beside it, and a guard that protects the manifest compares against the manifest.

## Decisions


## Truths

- T1. When the global config layer has moved and the store reopened, the owner sees a gate answer recorded.

## Flagged assumptions

