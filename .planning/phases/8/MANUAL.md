# Phase 8: manual checklist

Items routed here under the Overflow rule (`docs/rationale/acceptance-criteria.md`):
they need a live host, a human eye or a running system, so they cannot be
expressed as input -> output and are not acceptance criteria. A human drives
these. They are NOT covered by any test, and no ignored or live test is written
to stand in for them.

- [ ] **Roles interview, observed live.** Run the interview through a real host
      with real credentials and confirm question delivery, installed schemas and
      the stored answers. Authoring established only that cargo, node and the
      host executables are on PATH — not that authentication, dispatch or effort
      observation works. (Routed from PLAN-3; relates to AC4.)

- [ ] **A saved routing choice consumed by a real host.** Confirm the shipped
      `cad-execute` skill loads the three tools, consumes the saved model/agent
      choice and relays the exact prompt and patch bytes through real host calls.
      The binary side — schemas returned, dispatch admitted, prompt emitted
      byte-exact — is asserted by tests; only the host's honouring of it is here.
      (Routed from PLAN-5; relates to AC10.)

- [ ] **Config refusal: known TOCTOU limit.** Acknowledge that AC16 is
      best-effort at the PreToolUse hook boundary: `guard::run` resolves the
      target and exits SUCCESS before the host writes
      (`crates/cadence/src/guard/mod.rs:99`). A symlink retargeted in that
      interval can evade refusal. Closing this window is out of scope; this
      entry records the limit and requires no test or attempt to close it.
      (Routed from PLAN-6; relates to AC16 and D-84.)
