---
phase: 8
plan: 4
requirements:
  - AC6
  - AC9
files:
  - crates/cadence/src/config/mod.rs
  - crates/cadence/src/config/policy.rs
  - crates/cadence/src/config_service.rs
  - crates/cadence/src/recall/mod.rs
  - crates/cadence/src/server.rs
  - crates/cadence/tests/phase8_routing.rs
  - crates/cadence/src/config/floor.rs
  - crates/cadence/src/rail/risk_diff.rs
  - crates/cadence/src/pause/risk_diff.rs
  - crates/cadence/src/execution_service.rs
  - crates/cadence/tests/phase8_dispatch.rs
  - docs/architecture/config-routing.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy -p cadence --tests"
  tasks:
    - id: P8-4-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp"
    - id: P8-4-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces"
    - id: P8-4-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview"
---

# Phase 8: The surviving policy bundle and plan floor - Plan 4

## Goal

A route explains the surviving review policy and the risk in its declared plan scope without changing the selected model or rung. This plan alone proves named-plan versus phase-union floor behavior, conservative failed observations and the floor's two allowed effects.

## Must be true when done

- AC9/D-54: Every route returns the surviving gates, per-trigger reviewer sets/tiers/efforts, surface answer, reasons and diagnostics; phase_diff is absent.
- AC9/D-54: Reviewer filtering uses configured IDs at each selected tier, always permits claude-subagent and names empty-set fallback without invoking providers.
- AC9/D-55: Planner/analyzer bypass the floor; no phase means not computed; a clean named plan is independent of risky sibling scope.
- AC9/D-55: Missing/unreadable scope or unobserved existing bodies raise conservatively; genuinely new declared files still contribute their paths.
- AC6/D-47/D-55: Unwaived matches affect only deep verification and a non-explicit plan gate; an explicit stored gate wins even at the default value.
- D-49: Route consumers reuse the completed synchronous refresh and failed-reload contract.

## Context

D-47, D-49, D-54 and D-55 bind this plan. Plans 1-3 provide role choices, service wiring and explicit waivers. Use the phase 7 shared classifier and surface-answer rule, the native parse_plan lease grammar, and the read-only riskFloor/floorFor/scanDeclared reference. Do not port the refuted catch-all metadata-as-absence behavior.

## Tasks

### Task 1: Return the surviving review policy (P8-4-T1)

- **Files:** `crates/cadence/src/config/mod.rs` (schema / Effective), `crates/cadence/src/config/policy.rs` (new policy resolver), `crates/cadence/src/config_service.rs` (route answer from Plan 1), `crates/cadence/src/recall/mod.rs` (resident route request), `crates/cadence/src/server.rs` (inherited grouped route output schema), `crates/cadence/tests/phase8_routing.rs` (policy matrix)
- **Action:** Complete the public route bundle using one refreshed Generation shared with role resolution. Derive supported review triggers from surviving schema gate rows and their disposition; return exact valid gates, per-trigger reviewer sets, selected tier and reviewer request effort, answered surfaces, requested attempt/escalation/pin explanations, reasons and diagnostics. Exclude phase_diff entirely. Preserve stored presence as the evidence of an explicit gate, including a stored value equal to its default. Live invalid supported policy values refuse through existing validation; do not copy the frozen warning-and-default behavior over the native failed-reload contract.

  Filter the configured reviewer list separately for each trigger at that trigger's selected tier. claude-subagent always qualifies; other reviewers require a nonblank configured provider model ID at that tier. Name each dropped provider, missing setting and selected tier; if the remaining list is empty use claude-subagent with the fallback reason. This is configured eligibility, not availability, credential validation, endpoint discovery, review firing or review settlement. Reuse phase 7's surface-answer semantics for absence/null/empty/valid arrays so config facts, routing and the one-time choice agree. Until Task 2 computes the scope, report that fact explicitly rather than a clean scan. Register the completed response schema inside the existing grouped tool, without creating another public tool or changing phase 7's construction.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp` — policy::resolve over supplied Effective values returns literal diff/plan/risk_surface gates, reviewer arrays, tiers, efforts and explicit gate layers; phase_diff is absent. Independent fixtures return named dropped-provider diagnostics and claude-subagent fallback, and Unanswered, Invalid { reason: "Invalid(\"invalid risk surface answer\")" } or Answered { categories } surface facts. resolve_route over a supplied Generation returns that generation number, saved role choice and policy; invalid effective policy returns Policy("config unavailable: unusable review.triggers.plan.gate"). No repeated public-call sequence or provider boundary is required; the existing grouped output schema derives the completed bundle.

### Task 2: Read the declared floor scope conservatively (P8-4-T2)

- **Files:** `crates/cadence/src/config/mod.rs` (new floor module registration), `crates/cadence/src/config/floor.rs` (new bounded scope reader), `crates/cadence/src/config_service.rs` (phase/plan route input), `crates/cadence/src/rail/risk_diff.rs` (phase 7's shared classifier, originating at pause::risk_diff::signal / scan), `crates/cadence/src/pause/risk_diff.rs` (phase 7 compatibility adapter for the inspected classifier), `crates/cadence/tests/phase8_routing.rs` (declared scope and I/O fault fixtures)
- **Action:** Add a plan-time declared-material reader and classifier adapter. Consume the native parse_plan grammar and its exact files plus directories leases, not task-body prose or the frozen frontmatter parser. Resolve a supplied plan only within its named phase; otherwise take the deterministically ordered union of the phase's admitted native plans. A missing/unreadable/malformed plan, empty total declared scope or unreadable phase listing cannot produce a clean answer. Skip all plan/source I/O for planner and assumptions-analyzer; without a phase return not computed. Do not infer another phase from a cursor or scan a sibling when the caller named one plan.

  Read regular declared bodies within the project boundary with a 512 KiB per-body limit; retain path signals for new files. Distinguish genuine NotFound from metadata/traversal failures: EACCES, ELOOP, ENOTDIR, unreadable metadata and failed canonicalization are unobserved scope that raises conservatively. Verify parent containment even for a missing leaf; a symlinked parent cannot turn an outside missing/existing target into a clean new file. Reject final symlinks, devices, FIFOs and non-regular file bodies without opening them. Use opened-handle identity checks and bounded reads to catch replacement/growth, invalid UTF-8 and body failures. For declared directories, walk the covered scope deterministically, include the directory path and descendants, avoid following symlinks and deduplicate overlapping leases. Bound the walk to 4096 entries and 16 MiB of source body reads per answer; crossing either bound reports incomplete scope and raises rather than truncating silently. Do not let ignore rules hide leased material.

  Extend the phase 7 shared classifier's underlying signal logic with a declared-body adapter; do not create a second category/pattern table or pass a fabricated Git diff as source evidence. Preserve the read-only scanDeclared distinction between path signals and whole-body evidence, including documented body exclusions and withheld import/literal-constant lines with their reasons; executable calls in constant initializers still count. These exclusions never excuse a failed metadata/body observation and never apply to actual-diff classification. Consume the shared category selection from Task 1 and retain concrete category/signal/path evidence and read diagnostics. This is new declared-scope work; phase 7's diff extraction and structural detection remain their existing responsibilities.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_risk`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_surfaces` — floor::read_observed over literal native plans and filesystem observations returns Complete with exact paths/matches, Incomplete with named read diagnostics, Bypassed for planner/analyzer, or NotComputed without phase. Independent fixtures cover named plan versus union, missing/malformed/empty plans, metadata EACCES/ELOOP/ENOTDIR, read/canonicalization/listing failures, outside parents and final nonregular bodies, replacement/growth, UTF-8, 512 KiB bodies, 4096 entries and 16 MiB reads, directory traversal and overlap deduplication. risk_diff::scan_declared returns literal path/body matches and withheld document, signal-table or import/literal-constant reasons; executable initializer calls retain body matches. Filesystem is the only stubbed boundary. The two already-named phase 7 targets remain regression commands, not new criteria.

### Task 3: Apply only the two floor effects (P8-4-T3)

- **Files:** `crates/cadence/src/config/floor.rs` (scope result from Task 2), `crates/cadence/src/config/policy.rs` (stored gate provenance from Task 1), `crates/cadence/src/config_service.rs` (completed route bundle), `crates/cadence/src/execution_service.rs` (new-dispatch selection from Plan 1), `crates/cadence/tests/phase8_routing.rs` (floor effect matrix), `crates/cadence/tests/phase8_dispatch.rs` (saved spending selection regression), `docs/architecture/config-routing.md` (floor contract)
- **Action:** Compose the floor into the same public route used to prepare a new execution dispatch. An unwaived risk match or incomplete required scope recommends deep verification and can raise the default plan gate to blocking. A valid explicitly stored plan gate wins, whether inherited globally or stored in repo and whether equal to its schema default or different. Preserve a gate already at or above blocking. A category waiver removes only that category's floor contribution; a different unwaived hit still raises, and waiving categories cannot turn missing/unreadable required scope into read-clean evidence. Full-protection [] removes waiver contributions according to ordinary layer precedence.

  The floor changes neither role model nor starting/escalated rung, no other gate, and no actual-diff surface selection. Deep verification is a recommendation, not a verifier dispatch or proof of verification. Preserve the prior admitted model/rung on replay; fresh policy facts and later dispatches use current config. Show causes for bypass, not computed, waived matches, incomplete scope, raised deep recommendation and an explicit gate withholding a raise. Use the same resolver at config route and execution admission so the skill does not reconstruct any of these rules. Document the refuted frozen metadata behavior as the native correction and document directory-scope bounds as incomplete-read outcomes.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_routing`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_dispatch`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase8_interview` — A metamorphic matrix changes only plan risk or waiver values and asserts model, rung/agent, non-plan gates and actual-diff selected surfaces remain identical. It asserts the exact deep recommendation and plan gate for defaults, explicit-default-equal gates in both layers, explicit advisory/off/blocking, mixed waived/unwaived hits and unreadable scope. Repo [] clears inherited/existing waivers and permits the expected raise; global [] with a repo waiver reports the remaining winning waiver accurately. Public route and new dispatch use the same saved spending choice, and current config edits are observed by the resident.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-54 / AC9 | P8-4-T1 |
| D-55 / AC9 | P8-4-T2, P8-4-T3 |
| D-47 / AC6 | P8-4-T3 |
| D-49 (existing refresh dependency) | P8-4-T1, P8-4-T2, P8-4-T3 |

## Notes

Run after Plan 3 and before Plan 5. Overlap on config/mod.rs, config_service.rs, config-routing.md and phase8_dispatch.rs creates the real ordered edges. This plan is independently verifiable as the policy/floor increment on its predecessors.

Phase 7 is moving the existing pause::risk_diff classifier to rail/risk_diff.rs and retaining pause compatibility. Its completed shared category/selection/detection service is a prerequisite, not phase 8 work. The original classifier implementation was read under pause/risk_diff.rs during authoring. Before admission, resolve the delivered symbols and verify the two leased adapter paths against phase 7's finished tree; if a required implementation path differs, correct the exact lease before dispatch rather than relying on a stale line number or redoing the extraction. No frozen file is leased.

R2 is explicitly corrected: an unqualified metadata failure is not proof of absence. The new target must inject these failures at the production I/O seam, not rely only on chmod, which can behave differently under privileged tests. The floor's document/signal-table/line-kind rules apply only to declared body content; metadata failures remain conservative and actual-diff classification retains phase 7 behavior. All fixture source/plan bytes are embedded in leased tests and written only beneath their temporary roots.

