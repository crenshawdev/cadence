# Phase 10: manual checklist

Items routed here under the Overflow rule: they need a live host, a human eye or
a running system, so they cannot be expressed as input -> output and are not
acceptance criteria. A human drives these. They are NOT covered by any test, and
nothing in the suite should be written to approximate them.

- [ ] **Live pilot across the review path.** Inspect a pilot record showing real
      provider participation and failure/local-fallback closure, actual per-voice
      rulings and saved originals/material, refused fabricated settlement,
      visible deleted-source evidence, deferred settlement and exhausted re-arm
      after restart, plus explicitly authorized filing, deduplication and
      ambiguous-create reconciliation on every claimed forge. Each episode must
      identify actual return, durable save and recovered state. Unavailable cases
      stay unverified and their semantic limitations are stated explicitly.
      (Was AC17; `.planning/ROADMAP.md:852`, `.planning/phases/6/SUMMARY.md:16`.)

- [ ] **Observed two-voice participation and settlement episode** (Was AC3.)
      Start a two-voice fire through phase 9's real dispatch path. After
      empty A returns with B pending, attempt settlement before and after
      restart: it refuses and B remains named in the saved required roster.
      Interrupted B and terminal failed B cannot be omitted for clean clearance.
      Complete the admitted participation, then require one ruling per original
      finding, separate convergent entries, derived counts and an empty-success
      roster.
      Invented participation, a one-character claim/scenario change, matching
      fabricated copies of both returned text and ruling, omitted findings,
      duplicate rulings and swapped same-artifact host returns all refuse
      against the binary originals; no refusal changes the originals or clears
      the gate
      (`cadence-core/bin/lib/adjudication-record.mjs:351`,
      `cadence-core/bin/lib/adjudication-record.mjs:413`,
      `.planning/ROADMAP.md:807`).

- [ ] **Observed provider FIRST and local fallback episode** (Was AC7.)
      Provider integration observations show FIRST trying configured
      voices sequentially, stopping on a usable empty or nonempty return, and
      trying local fallback when all fail. No-key, transport, HTTP, malformed
      result and fallback failure each leave exactly one durable terminal
      attempt outcome; restart/replay neither duplicates closure nor converts
      failure into an empty clean review (`.planning/ROADMAP.md:768`,
      `.planning/ROADMAP.md:783`, `.planning/ROADMAP.md:829`).

- [ ] **Provider omission-contract evidence** (Was AC9.)
      Assert and document the
      provider-specific omission rule and bounded sanitized raw evidence
      (`cadence-core/bin/review-provider.mjs:988`,
      `cadence-core/bin/review-provider.mjs:1142`, `.planning/ROADMAP.md:847`).

      Inspect provider-specific evidence for omission semantics before claiming
      that absence means zero (D-76). Deterministic normalization criteria use
      the supplied `unavailable` policy until such evidence is recorded. The
      bounded sanitizer itself retains a separate unit criterion.

- [ ] **Live search semantics for every claimed forge** (Was AC15.)
      Live single-token, multiple-token, body-only and genuine
      miss cases establish its search semantics. GitLab remains explicitly
      unmeasured without its own observations, and an unmeasured miss cannot
      override a confirmed local filing fact (GH-251;
      `cadence-core/bin/lib/filing-decision.mjs:730`,
      `cadence-core/bin/lib/filing-decision.mjs:753`,
      `cadence-core/bin/issue-filing.mjs:659`, `.planning/ROADMAP.md:849`).
