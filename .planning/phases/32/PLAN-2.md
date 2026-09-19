---
phase: 32
plan: 2
requirements: ["T2"]
files: ["crates/cadence/src/context/model.rs","crates/cadence/src/context/persistence.rs","crates/cadence/src/context/validation.rs","crates/cadence/src/context_service.rs","crates/cadence/src/context/instructions.rs","skills/cad-context/SKILL.md","crates/cadence/tests/phase32_typed_authoring.rs","crates/cadence/tests/phase11_context.rs","crates/cadence/tests/mcp.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P32-2-T1","verify":["cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_context_answers_digest_and_no_document","cargo nextest run -p cadence --test phase11_context"]},{"id":"P32-2-T2","verify":["cargo nextest run -p cadence --test mcp"]}]}
---
# Phase 32: Typed authoring and rendering - Plan 2

## Goal

context-submit answers a draft with the digest of the CONTEXT.md the binary rendered, and approval binds by that digest with the retained record unchanged.

## Must be true when done

- T2. When the context author submits a context as typed pieces, the context author gets the digest of the CONTEXT.md the binary rendered and no document in the answer.

## Context

D-179 and D-182 at .planning/phases/32/CONTEXT.md. context Approval (crates/cadence/src/context/model.rs:50) carries only an optional submission copy and context_service.rs:100 refuses an approval whose copy is not the exact submission; the draft answer (context_service.rs:177) reports no digest. plan::model::Approval (crates/cadence/src/plan/model.rs:72) and persistence::binds/bound (crates/cadence/src/plan/persistence.rs:69-83) are the pattern: either binding proves the same thing and the binary fills the copy before recording. The rendered document is context::render::document; its digest is the revision context-intake already reports.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P32-T2-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_context_answers_digest_and_no_document",
        "expected": {
          "kind": "literal",
          "value": "The draft context-submit answer is {status: ok, operation: context-submit, phase: <N>, persisted: false, validation: draft, submission_digest: <64 hex>, revision: <64 hex>} with no other key; approval by {approved: true, owner, at, submission_digest} persists, and the SHA-256 of the installed .planning/phases/<N>/CONTEXT.md equals revision."
        },
        "test": {
          "file": "crates/cadence/tests/phase32_typed_authoring.rs",
          "function": "phase32_typed_context_answers_digest_and_no_document"
        },
        "setup": "Start the real stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project with no native context for the phase.",
        "call": "Send context-submit with typed scope, decisions, assumptions and truth slots and no approval; read the answer keys; send the same submission with an approval carrying only owner, at and submission_digest; hash the installed file.",
        "boundary": "stdio JSON-RPC to the real binary, then the installed file on disk",
        "fakes": []
      },
      "reason": "An echoed submission or rendered text adds a key; an approval path that still demands the copy refuses the digest form; a renderer drift fails the digest equality.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The context author's answer carries the rendered digest and no document; this is T2's outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P32-A-context-digest",
      "spec": {
        "locators": [
          "crates/cadence/src/context/model.rs::Approval",
          "crates/cadence/src/context/persistence.rs::binds",
          "crates/cadence/src/context/persistence.rs::bound"
        ],
        "substance": "The context Approval with submission_digest, and the helpers that accept either binding and fill the retained copy."
      },
      "reason": "Removing the field or the fill breaks digest approval or changes the retained record shape.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The digest the author gets back is what the approval binds to."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Context draft answers a digest and approval binds by it

- **ID:** P32-2-T1
- **Files:** crates/cadence/src/context/model.rs, crates/cadence/src/context/persistence.rs, crates/cadence/src/context/validation.rs, crates/cadence/src/context_service.rs, crates/cadence/tests/phase32_typed_authoring.rs, crates/cadence/tests/phase11_context.rs
- **Action:** Red first: add phase32_typed_context_answers_digest_and_no_document and retain its red run. Then give context Approval a submission_digest beside the optional submission copy (D-179), mirroring plan::model::Approval; the draft answer carries submission_digest and revision (the SHA-256 of the CONTEXT.md the binary rendered) and no document; binds/bound helpers in context::persistence accept either form and fill the copy before persistence::approved records it, so retained contexts keep their shape. phase11_context.rs keeps its copy-form cases and gains the digest form.
- **Verify:**
  - cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_context_answers_digest_and_no_document
  - cargo nextest run -p cadence --test phase11_context

### Task 2: Context skill says digest, not copy

- **ID:** P32-2-T2
- **Files:** crates/cadence/src/context/instructions.rs, skills/cad-context/SKILL.md, crates/cadence/tests/mcp.rs
- **Action:** Rewrite the approval paragraphs of context::instructions: approval carries owner, at and the submission_digest the draft answer reported; a full copy is accepted but costs the set twice. The binary regenerates skills/cad-context/SKILL.md (D-166) and tests/mcp.rs pins the bytes.
- **Verify:**
  - cargo nextest run -p cadence --test mcp

## Notes

One check, because T2 is the only truth here; the artifact names the type and the two helpers. The held draft and the stale-digest location are plan 3.
