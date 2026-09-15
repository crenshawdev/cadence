# Phase 9: manual checklist

Items routed here under the Overflow rule: they need a live host, a human eye or
a running system, so they cannot be expressed as input -> output and are not
acceptance criteria. A human drives these. They are NOT covered by any test, and
nothing in the suite should be written to approximate them.

- [ ] **Advisory review loop, driven live.** Load the actual grouped tools and
      dispatch a real local reviewer through the invoking skill. Confirm the
      retained record identifies what actually ran and was saved, shows the
      unchanged advisory handoff and write ordering, closes an actual failed
      attempt, and reopens an uncommitted review after later edits with its
      original material intact. Missing episodes stay unverified rather than
      assumed. (Was AC7; `.planning/ROADMAP.md:789`,
      `.planning/phases/6/SUMMARY.md:16`.)

- [ ] **Observed advisory handoff and installed hooks** (Was AC1.)
      In an observed local advisory loop, the dispatched contract/prompt
      contains no findings-write or trace-append tail. The reviewer reads the
      artifact and returns raw JSON; the invoking skill forwards it unchanged.
      Tool events and filesystem observations, including the Bash channel,
      show no reviewer-written artifacts and persistence/closure through the
      binary for this episode. Run with installed hooks, including SubagentStop,
      and inspect that it creates no competing native-attempt lifecycle close.
      Record that Bash heredocs pass the bounded guard: absence of observed
      reviewer writes is not prevention. No completion
      or next-plan dispatch appears before the durable result acknowledgment;
      blocker/high advisory findings still allow continuation and remain
      unruled even under adjudicated combination mode. Include quotation,
      newline and Unicode strings and compare returned, submitted and stored
      originals exactly (
      `.planning/ROADMAP.md:746`, `.planning/ROADMAP.md:754`,
      `skills/cad-reviewer-contract/SKILL.md:114`,
      `crates/cadence/src/guard/bash.rs:129`,
      `crates/cadence/src/guard/bash.rs:461`).

- [ ] **Historical regression-run instruction** (Was AC5.)
      Retained pause gate, deferred visibility and index-identity assertions
      still pass when running
      `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence pause_service_tests`
      (`.planning/ROADMAP.md:783`,
      `crates/cadence/src/pause_service.rs:758`,
      `crates/cadence/src/pause_service_tests.rs:454`,
      `crates/cadence/src/pause_service_tests.rs:683`,
      `crates/cadence/src/pause_service_tests.rs:713`).

      This is an operator-run regression instruction, not a unit criterion or
      evidence of live reviewer behavior. No command was run in this rewrite.

- [ ] **Native producer transcript and restartable handoff episode** (Was AC15.)
      Produce the HANDOFF acceptance store using only phase 9's native
      producer operations and scripted or observed host inputs. Retain the
      command transcript, producer revision, contract IDs, artifact inventory
      and hashes, then reopen and enumerate H1–H5 without internal record seeding
      or backfill. Include AC8–AC14 cases and retain the accepted boundary store
      unchanged for phase 10 AC1. Record the actual operation/test selectors so
      the producer run can be repeated; a fixture authored directly to phase
      10's desired schema cannot satisfy this criterion.

      The original text above is retained verbatim as episode provenance. Its
      old AC references use the former numbering. Phase 9 now also commits
      independently authored compatibility fixtures. The producer-run and
      no-seeding requirement applies only to this manual episode; phase 10's
      unit criteria read committed fixtures and never require this run.
