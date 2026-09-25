---
phase: 32
plan: 3
requirements: ["T3","T4"]
files: ["crates/cadence/src/import/mod.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs","crates/cadence/src/read/instructions.rs","crates/cadence/src/plan_service.rs","crates/cadence/src/plan/persistence.rs","crates/cadence/src/context_service.rs","crates/cadence/src/context/persistence.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/context/instructions.rs","skills/cad-plan/SKILL.md","skills/cad-context/SKILL.md","skills/cad-read-contract/SKILL.md","crates/cadence/tests/phase32_typed_authoring.rs","crates/cadence/tests/mcp.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P32-3-T1","verify":["cargo nextest run -p cadence --test phase32_typed_authoring phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes"]},{"id":"P32-3-T2","verify":["cargo nextest run -p cadence --test phase32_typed_authoring phase32_stale_digest_is_refused_with_identity_and_part"]},{"id":"P32-3-T3","verify":["cargo nextest run -p cadence --test mcp"]}]}
---
# Phase 32: Typed authoring and rendering - Plan 3

## Goal

The resident holds the rendered draft, the owner reads it by identity, approval carries the digest and nothing else, and a stale digest is refused with the place that changed.

## Must be true when done

- T3. When the owner approves a draft by its digest with owner and time, the owner sees the rendered document installed byte for byte equal to the draft read by identity.
- T4. When the owner approves with the digest of a draft that has changed since, the owner is refused with the identity and part where the held draft differs.

## Context

D-180, D-181 and assumption 1 at .planning/phases/32/CONTEXT.md. Today approval resends the whole submission (plan_service.rs:150-190 binds the copy or the digest against the submission in the same request), so the plan set crosses the wire twice and the owner never reads what the binary will install. The Session (crates/cadence/src/import/mod.rs:677) is the per-project object the resident keeps; a draft map on it costs a few tens of KB per draft and is gone on restart, which assumption 1 accepts. read::document::resolve (crates/cadence/src/read/document.rs:79) serves phase-plan and phase-context by rendering from the store; the draft arms render from the held bytes with the same part selectors. D-181's location is the first differing part selector, computed from the two held renderings, so the refusal names something the owner can read next through document.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P32-T3-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes",
        "expected": {
          "kind": "literal",
          "value": "document {kind: plan-draft, phase, digest} answers status ok with the draft's parts; a plan-submit carrying only phase and approval {approved: true, owner, at, submission_digest} answers persisted: true; the installed PLAN-1.md bytes equal the concatenation the draft identity served and their SHA-256 equals the draft answer's documents[0].revision."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
        "call": "Send a typed draft; read it back through document by the draft identity the answer names; approve by digest alone; read the installed file.",
        "boundary": "stdio JSON-RPC to the real binary; the file on disk after approval",
        "fakes": []
      },
      "reason": "Publishing from the request instead of the held draft, or re-rendering at approval, can install different bytes; dropping the draft identity refuses the read.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The owner reads the draft by identity and the installed bytes equal it; this is T3's outcome."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P32-T4-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_stale_digest_is_refused_with_identity_and_part",
        "expected": {
          "kind": "literal",
          "value": "After two drafts for the same phase that differ only in plan 1's notes, approving with the first draft's digest answers {status: refused, code: stale-draft, identity: {kind: plan-draft, phase, digest: <second digest>}, part: notes}, and the fixture tree is byte-identical before and after."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_stale_digest_is_refused_with_identity_and_part"
        },
        "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
        "call": "Send draft A; send draft B with a changed notes slot; approve with A's digest.",
        "boundary": "stdio JSON-RPC to the real binary; the tree snapshot helper in tests/support/phase31.rs",
        "fakes": []
      },
      "reason": "Approving A anyway installs bytes the owner did not read; a refusal without identity and part fails the exact assertion.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The refusal names the identity and the part that differs; this is T4's outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P32-A-held-draft",
      "spec": {
        "locators": [
          "crates/cadence/src/import/mod.rs::Session",
          "crates/cadence/src/read/model.rs::DocumentIdentity::PlanDraft",
          "crates/cadence/src/read/model.rs::DocumentIdentity::ContextDraft"
        ],
        "substance": "The per-session draft store and the two draft identities the read layer serves."
      },
      "reason": "Without a held draft the binary can only publish what the request carries, which is the document on the wire again.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The held draft is what approval by digest publishes."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Two held drafts are what a stale digest is compared against."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: The resident holds the draft and serves it by identity

- **ID:** P32-3-T1
- **Files:** crates/cadence/src/import/mod.rs, crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/read/instructions.rs, crates/cadence/src/plan_service.rs, crates/cadence/src/context_service.rs, crates/cadence/tests/phase32_typed_authoring.rs
- **Action:** Red first: add phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes and retain its red run. Then: a draft or preview answer stores the rendered documents on the bound Session keyed by phase and submission_digest (assumption 1: memory only, cleared by restart); document accepts {kind: plan-draft, phase, digest} and {kind: context-draft, phase, digest} and serves the held rendering with the same parts as the published identity; an approval request may carry only phase and approval {approved, owner, at, submission_digest} with no submission, and the binary publishes the held draft it names; the installed bytes are the held bytes.
- **Verify:**
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes

### Task 2: A stale digest is refused with the place that changed

- **ID:** P32-3-T2
- **Files:** crates/cadence/src/plan_service.rs, crates/cadence/src/plan/persistence.rs, crates/cadence/src/context_service.rs, crates/cadence/src/context/persistence.rs, crates/cadence/tests/phase32_typed_authoring.rs
- **Action:** Red first: add phase32_stale_digest_is_refused_with_identity_and_part and retain its red run. Then: when the approval's digest names a held draft that is not the newest draft for the phase, refuse stale-draft with identity (the draft identity of the newest draft) and part (the first part selector whose rendered bytes differ between the named draft and the newest), and write nothing (D-181); a digest that names no held draft is refused unknown-draft with the phase identity.
- **Verify:**
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_stale_digest_is_refused_with_identity_and_part

### Task 3: Skills say read the draft, approve the digest

- **ID:** P32-3-T3
- **Files:** crates/cadence/src/plan/instructions.rs, crates/cadence/src/context/instructions.rs, crates/cadence/src/read/instructions.rs, skills/cad-plan/SKILL.md, skills/cad-context/SKILL.md, skills/cad-read-contract/SKILL.md, crates/cadence/tests/mcp.rs
- **Action:** The planner and context skills tell the model to read the draft through document by its draft identity, show the owner what it read, and send the approval with the digest and no submission; the read contract lists the two draft identities. The binary regenerates the three skill files (D-166) and tests/mcp.rs pins them.
- **Verify:**
  - cargo nextest run -p cadence --test mcp

## Notes

Three tasks: hold and serve, refuse with a place, then the skills. Plans 1 and 2 land the typed shapes first; this plan does not change the wire Content again.
