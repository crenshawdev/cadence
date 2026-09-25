---
phase: 17
plan: 4
requirements: ["T4"]
files: ["crates/cadence/src/main.rs","crates/cadence/src/review_ingress.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/import/mod.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/writer_tests.rs","crates/cadence/Cargo.toml","Cargo.lock","docs/architecture/store.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-4-T1","verify":["cargo nextest run -p cadence --lib store::writer_tests::serve_drains_admitted_writes_on_transport_end","cargo nextest run -p cadence --lib store::writer_tests::requests_after_transport_end_are_refused","cargo nextest run -p cadence --lib store::writer_tests::next_write_is_earliest_pending_admission","cargo nextest run -p cadence --lib store::writer_tests::nothing_pending_requests_normal_join"]},{"id":"P17-4-T2","verify":["cargo nextest run -p cadence --lib store::writer_tests::drain_limit_diagnostic_names_the_open_write_and_bound"]}]}
---
## Goal

Stop admission, drain accepted work and join the store writer within a named ten-second shutdown bound.

## Must be true when done

- T4. When the transport ends while admitted writes are queued, the restarting owner sees every admitted write acknowledged in the journal within the drain bound, nothing admitted after the close, and a write still open at the bound left to journal recovery.

## Context

At HEAD 7d492bf3, main.rs::run_serve returns after service.waiting(); review_ingress.rs::InputTransport reports EOF with in-flight answers but has no shutdown coordinator. store/writer.rs::Store::open_inner creates a 32-entry channel, starts cadence-store, discards its JoinHandle and receives until the senders close. recall/mod.rs::Resident::spawn_with_driver has another 32-entry queue and owns the SessionFactory; import/mod.rs::SessionFactory keeps sessions by root. Shutdown must cover work admitted before either queue. docs/architecture/store.md retains the cancellation and validated-intent recovery contracts, but its child-process crash-test and strace instructions are obsolete. The surviving store/writer_tests.rs tests judge values; the former store integration and crash drivers are absent.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/serve_drains_admitted_writes_on_transport_end",
      "spec": {
        "command": "cargo nextest run -p cadence --lib store::writer_tests::serve_drains_admitted_writes_on_transport_end",
        "expected": {
          "kind": "property",
          "value": "With transport ended and admitted write drain-02 still open, elapsed 9.999 seconds requests Wait. At elapsed exactly 10 seconds and at 11 seconds, the step stops waiting and returns DrainLimit naming drain-02 as left to journal recovery, without acknowledging it or requesting intent deletion. These three literal elapsed cases isolate the ten-second drain-limit decision; expected actions are handwritten from D-211."
        },
        "test": {
          "file": "crates/cadence/src/store/writer_tests.rs",
          "function": "serve_drains_admitted_writes_on_transport_end"
        },
        "setup": "Supply three independent states with transport ended, drain-01 already acknowledged, drain-02 admitted and still open, and elapsed Duration values 9.999, 10 and 11 seconds since cutoff. The production Drain::step transition is called by the real shutdown coordinator. Time and storage completion are input values; there is no clock read, store request, thread, journal or filesystem in this test.",
        "call": "Call production store::writer::Drain::step once for each independent elapsed-time case and compare only its Wait or DrainLimit result, open-write identity and absence of acknowledgement or intent-deletion requests to handwritten expectations. Do not run ingress, a service handler, Store::open/request, transaction commit/recovery or a full drain workflow.",
        "boundary": "store::writer::Drain::step, the drain-limit decision for an admitted write still open after transport end",
        "fakes": []
      },
      "reason": "Unit check of store::writer::Drain::step's own decision; the running-resident trigger and outcome are left to the phase 18 live gate.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Unit check of store::writer::Drain::step's own decision; the running-resident trigger and outcome are left to the phase 18 live gate."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/serve-drain",
      "spec": {
        "locators": [
          "crates/cadence/src/main.rs",
          "crates/cadence/src/review_ingress.rs",
          "crates/cadence/src/recall/mod.rs",
          "crates/cadence/src/import/mod.rs",
          "crates/cadence/src/store/writer.rs"
        ],
        "substance": "An admission cutoff, ordered drain and owned thread join share SERVER_DRAIN_BOUND=10s; timeout preserves the open intent for validated recovery."
      },
      "reason": "An admission cutoff, ordered drain and owned thread join share SERVER_DRAIN_BOUND=10s; timeout preserves the open intent for validated recovery.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "This artifact is required for T4's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/serve-sigterm",
      "spec": {
        "locators": [
          "crates/cadence/src/main.rs",
          "crates/cadence/Cargo.toml"
        ],
        "substance": "SIGTERM enters the same bounded shutdown path using tokio signal support; it does not bypass the drain."
      },
      "reason": "SIGTERM enters the same bounded shutdown path using tokio signal support; it does not bypass the drain.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "This artifact is required for T4's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Implement admission shutdown and the one drain-decision check

- **ID:** P17-4-T1
- **Files:** crates/cadence/src/main.rs, crates/cadence/src/review_ingress.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/import/mod.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/writer_tests.rs, crates/cadence/Cargo.toml, Cargo.lock
- **Action:** Deliver serve_drains_admitted_writes_on_transport_end red then green. Write all four T1 tests (serve_drains_admitted_writes_on_transport_end, requests_after_transport_end_are_refused, next_write_is_earliest_pending_admission and nothing_pending_requests_normal_join) in the tests-only crates/cadence/src/store/writer_tests.rs and commit them before T1's red run. Every other T1 test written into that file must also be committed before the red run. The red commit also holds a production Drain::step with its final signature that compiles but does not yet meet the check, so the red run ends in a failing test, not a build failure. Do not edit writer_tests.rs again before T1's completion commit; T2 may add its diagnostic test only after T1 closes. Extract the smallest production Drain::step transition over values for admission closed/open state, admission sequence, completed prefix, pending/open write and elapsed time. It decides refuse, next admitted work, wait, normal join or drain-limit leaving recovery in charge; it neither reads a clock nor writes storage. The coordinator gathers EOF/SIGTERM, monotonic elapsed time and worker completion and applies these decisions. Admit complete decoded requests in transport order before handing them to handlers, retain admitted work independently of caller-future cancellation, and atomically close admission on EOF or SIGTERM. Drain handlers into the resident queue in order, await all SessionFactory-owned writers, explicitly close receivers and retain/join their thread handles on successful completion. Preserve awaited 32-entry backpressure. Use one total ten-second deadline, and at expiry return the typed drain-limit for task 2's diagnostic emission and exit without deleting or adopting an open intent or waiting indefinitely for blocking teardown. Add tokio signal support. For changed code lacking adequate tests, separate any parsing or transition decision from I/O and write independent Rust tests of that decision using supplied values or at most one minimal memory seam per test. No signal delivery, live clock, process launch, complete store transaction or external fsync fixture belongs in a test. Write the sole check only for Wait at 9.999 seconds versus DrainLimit at 10 and 11 seconds with one open admitted write. In store::writer_tests also write three separate one-behavior tests of Drain::step: requests_after_transport_end_are_refused supplies a closed transport and a late request and expects refusal, detecting post-cutoff admission; next_write_is_earliest_pending_admission supplies an acknowledged prefix and multiple remaining admissions and expects the earliest pending id, detecting out-of-order selection; nothing_pending_requests_normal_join supplies a closed, empty drain and expects Join, detecting needless waiting or a limit on a complete drain. Each calls one step over supplied values, with no full drain sequence. Caller-cancellation retention remains structural; do not invent a cancellation predicate or write a cancellation test.
- **Verify:**
  - cargo nextest run -p cadence --lib store::writer_tests::serve_drains_admitted_writes_on_transport_end
  - cargo nextest run -p cadence --lib store::writer_tests::requests_after_transport_end_are_refused
  - cargo nextest run -p cadence --lib store::writer_tests::next_write_is_earliest_pending_admission
  - cargo nextest run -p cadence --lib store::writer_tests::nothing_pending_requests_normal_join

### Task 2: Render the drain-limit diagnostic and document the cutoff

- **ID:** P17-4-T2
- **Files:** docs/architecture/store.md, crates/cadence/src/store/writer.rs, crates/cadence/src/store/writer_tests.rs, crates/cadence/src/main.rs
- **Action:** Implement the production drain-limit diagnostic formatter in store::writer and wire its stderr emission at the shutdown limit in main.rs::run_serve. It names the ten-second bound and the open admitted write left to journal recovery; formatting and interpretation take the typed limit as a value, while stderr writing remains gathering. Write store::writer_tests::drain_limit_diagnostic_names_the_open_write_and_bound against that formatter with a supplied drain-02 limit and handwritten required diagnostic fields (10 seconds, drain-02, left to journal recovery), detecting an omitted or wrong bound, lost id or a claim that the open write was acknowledged. This task owns the diagnostic portion previously bundled into task 1, so its verify settles a production decision this task changes. Document the exact cutoff, shared ten-second bound, successful join and expiry leaving an open intent for the existing validated recovery contract. Replace this touched document's obsolete process-kill/strace test instructions with the limited claim supported by in-process decisions; preserve the durability contract and say real crash survival is not proved. Caller cancellation is structural and stays unverified until phase 18; write no cancellation test. If either task changes previously untested policy, add the smallest one-behavior Rust test for it; gatherers get none. Reuse adequate value tests already present and leave the existing recovery implementation outside this task.
- **Verify:**
  - cargo nextest run -p cadence --lib store::writer_tests::drain_limit_diagnostic_names_the_open_write_and_bound

## Notes

D-211, after plan 3 so refused applies use the same drain. Add tokio's signal feature (absent at this HEAD), updating Cargo.lock only if resolution requires it. SERVER_DRAIN_BOUND is exactly Duration::from_secs(10), with one deadline across ingress, resident and writer shutdown and no config key. Normal shutdown joins completed writers; expiry cannot join a blocked syscall or wait for blocking-pool teardown, and leaves an open intent for validated recovery. Signal receipt, transport I/O, waiting, actual persistence and exit are gatherers; the production drain transition owns the cutoff and next-action policy over their observations. Deleted drivers, process restarts, fsync stalls and their verify commands are removed, with no retrofit of plans 1–3. Shared leases are sequential and disjoint: this plan owns main.rs::run_serve, server.rs shutdown forwarding, recall resident queue shutdown, SessionFactory writer ownership, and store.md's cancellation/recovery/shutdown sections; plan 7 owns instruction arms and test access to the existing wire registries, plan 5 acquisition sections, and plan 6 deadline sections. Replaced on 2026-09-23 so its check follows the owner's 2026-09-22 test rules in place of the context's starting check. The check proves only the drain-limit decision; separate constituent tests exercise cutoff, pending-write selection, normal join and limit diagnostics. Caller-cancellation retention, actual EOF/SIGTERM delivery, exit timing, thread joining, journal acknowledgments after restart, crash survival and physical durability remain unverified until the phase 18 live acceptance gate. Plan 4's import/mod.rs writer-ownership edit lands first; plan 5's store-path gate lands after it in different functions (store-input observation helpers versus writer shutdown ownership). Task 2 owns the limit formatter and its main.rs emission, after task 1's drain transition; this reassignment gives task 2 a narrow behavior test for its own code work.
