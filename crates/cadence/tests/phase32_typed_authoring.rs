#[path = "support/phase31.rs"]
#[allow(dead_code)]
mod phase31;

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, fs};
use phase31::{Client, ProcessFixture, approve, tree};

const PHASE: u32 = 31;

#[test]
fn phase32_six_plan_publication_wire_bytes() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    let mut contents: Vec<Value> = serde_json::from_str(PHASE32_WIRE_PLANS).unwrap();
    let truths: Vec<Value> = serde_json::from_str(PHASE32_WIRE_TRUTHS).unwrap();

    // Plans 5 and 6 retain plans 1 and 3's size with distinct task/artifact IDs.
    // Identical shared check aliases keep one distinct check per truth in the union.
    for (source, plan) in [(0, 5), (2, 6)] {
        let mut content = contents[source].clone();
        content["plan"] = json!(plan);
        for task in content["tasks"].as_array_mut().unwrap() {
            task["id"] = json!(task["id"].as_str().unwrap().replace(
                &format!("P32-{}-", source + 1), &format!("P32-{plan}-"),
            ));
        }
        for item in content["evidence_map"]["items"].as_array_mut().unwrap() {
            if item["kind"] != "check" {
                item["id"] = json!(format!("{}-plan-{plan}", item["id"].as_str().unwrap()));
            }
        }
        contents.push(content);
    }
    let context = client.call(
        "cadence_apply",
        approve(json!({"operation":"context-submit","submission":{
            "phase":PHASE,"title":"Six-plan wire measurement",
            "scope":"Measure publication of the phase 32 plans through the real stdio pipe.",
            "durable_decisions":[],"decisions":[],"assumptions":[],"truths":truths
        }})),
    );
    assert_eq!(context["persisted"], true, "{context}");
    let allocation = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"count":6}),
    );
    assert_eq!(allocation["status"], "ok", "{allocation}");
    let plans: Vec<_> = contents.into_iter().zip(allocation["targets"].as_array().unwrap())
        .map(|(content, target)| json!({"target":target,"content":content})).collect();
    assert_eq!(plans.len(), 6);
    let submission = json!({
        "phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"phase32-six-plan-wire-bytes",
        "inventory_basis":allocation["inventory"]["basis"],"plans":plans
    });

    // Initialization, native context and allocation are outside the three exchanges.
    let sent_before = client.send_bytes;
    let received_before = client.recv_bytes;
    let preview = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"submission":submission.clone()}),
    );
    assert_eq!(preview["status"], "ok", "{preview}");
    assert_eq!(preview["documents"].as_array().unwrap().len(), 6);
    let draft = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":submission}),
    );
    assert_eq!(draft["status"], "ok", "{draft}");
    assert_eq!(draft["persisted"], false, "{draft}");
    assert_eq!(draft["documents"].as_array().unwrap().len(), 6);
    assert_eq!(draft["submission_digest"], preview["submission_digest"]);
    let published = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","phase":PHASE,"approval":{
            "approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
            "submission_digest":draft["submission_digest"]
        }}),
    );
    let sent = client.send_bytes - sent_before;
    let received = client.recv_bytes - received_before;
    assert_eq!(published["persisted"], true, "{published}");
    assert!(sent > 0 && received > 0, "both pipe directions must be measured");
    let total = sent + received;
    println!("phase 32 wire bytes: {total} against 231424");
    assert!(total < 231424, "publication used {sent} request bytes and {received} answer bytes");
    for document in draft["documents"].as_array().unwrap() {
        let plan = document["identity"]["plan"].as_u64().unwrap();
        let installed = fs::read(project.join(format!(".planning/phases/{PHASE}/PLAN-{plan}.md"))).unwrap();
        assert_eq!(format!("{:x}", Sha256::digest(&installed)), document["revision"]);
    }
    client.finish();
}

// Frozen from phase 32 PLAN-1 through PLAN-4 via Cadence on 2026-09-17.
// Goal, context, notes and tasks preserve the rendered sections; evidence items
// preserve the four current plan-read map publications verbatim. The fixture
// phase is 31 because ProcessFixture owns that native roadmap row.
const PHASE32_WIRE_PLANS: &str = r###"[
  {
    "phase": 31,
    "plan": 1,
    "requirements": [
      "T1",
      "T5"
    ],
    "files": [
      "crates/cadence/src/plan/model.rs",
      "crates/cadence/src/plan/render.rs",
      "crates/cadence/src/plan/persistence.rs",
      "crates/cadence/src/plan/validation.rs",
      "crates/cadence/src/plan_service.rs",
      "crates/cadence/src/plan/instructions.rs",
      "crates/cadence/src/read/document.rs",
      "crates/cadence/tests/phase32_typed_authoring.rs",
      "crates/cadence/tests/support/phase13.rs",
      "crates/cadence/tests/support/phase31.rs",
      "crates/cadence/tests/phase27_plan.rs",
      "crates/cadence/tests/phase28_evidence.rs",
      "crates/cadence/tests/phase29_limits.rs",
      "crates/cadence/tests/phase31_read_layer.rs",
      "crates/cadence/tests/phase38_suite_gate.rs",
      "crates/cadence/tests/phase36_released_checks.rs",
      "crates/cadence/tests/phase34_blocked_path.rs",
      "crates/cadence/tests/phase12_execution.rs",
      "crates/cadence/tests/phase37_rejected_checks.rs",
      "crates/cadence/tests/execution_terminal_reopen.rs",
      "crates/cadence/tests/phase7_lease.rs",
      "crates/cadence/tests/phase8_dispatch.rs",
      "crates/cadence/tests/phase13_close.rs",
      "crates/cadence/tests/execution_boundary_compat.rs",
      "crates/cadence/tests/mcp.rs",
      "skills/cad-plan/SKILL.md"
    ],
    "directories": [],
    "goal": "Plan submissions become typed pieces and the binary renders PLAN.md; a body on the wire is refused; draft and preview answers carry a digest and identities and echo nothing.",
    "context": "D-178, D-180 and D-182 at .planning/phases/32/CONTEXT.md. Today Content.body (crates/cadence/src/plan/model.rs:34) is the whole PLAN.md after the frontmatter, render::document (crates/cadence/src/plan/render.rs:12) appends it unchanged, and complete_preview (crates/cadence/src/plan_service.rs:341) echoes document, old_section, section and the submission back. The context side already shows the target shape: context::render::document builds CONTEXT.md from scope, decisions and truth slots. The retained Publication keeps content with a filled body so phase 27 to 29 records, replay and map history read exactly as before; the fill follows persistence::bound (crates/cadence/src/plan/persistence.rs:77), which fills Approval.submission before recording. Nineteen test files build a body today (grep count 2026-09-17); the second task moves them and the planner skill in one pass so the suite is green at the plan's end.",
    "notes": "Task 1 lands the type, renderer and answer shape red then green; task 2 is the sweep of fixtures and the regenerated skill. The stale-digest refusal with a location and the held draft are plan 3; this plan's approval still carries the submission with the digest, as phase 29 left it.",
    "tasks": [
      {
        "id": "P32-1-T1",
        "title": "Typed plan content, rendered by the binary",
        "files": [
          "crates/cadence/src/plan/model.rs",
          "crates/cadence/src/plan/render.rs",
          "crates/cadence/src/plan/persistence.rs",
          "crates/cadence/src/plan/validation.rs",
          "crates/cadence/src/plan_service.rs",
          "crates/cadence/src/read/document.rs",
          "crates/cadence/tests/phase32_typed_authoring.rs"
        ],
        "action": "Red first: add phase32_typed_plan_answers_digest_and_no_document and phase32_plan_body_is_refused to the new test file and retain their red runs. Then replace Content.body on the wire with goal, context and notes (strings) and tasks as {id, title, files, action, verify} (D-178); derive execution {schema: 1, suite, tasks[{id, verify}]} from the typed tasks and the suite string; render::document builds the whole PLAN.md (frontmatter, Goal, Must be true when done from the associated truths' rendered sentences, Context, Evidence map, Tasks with the five bullets, Notes) from the pieces. The retained Publication.content keeps its shape: the binary fills body with the rendered Markdown before it records, exactly as plan Approval.submission is filled (D-182), and a historical record that already carries body reads as before. A wire request whose content carries body, or a path outside files, is refused typed-content with slot submission.plans[i].content.body. Draft and preview answers carry submission_digest and documents:[{identity, revision}] and nothing else that is a document: remove document, old_section, section and the submission echo (D-180). read/document.rs task parts come from the typed tasks, not from heading scans.",
        "verify": [
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_plan_answers_digest_and_no_document",
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_plan_body_is_refused"
        ]
      },
      {
        "id": "P32-1-T2",
        "title": "Move every fixture and the planner skill to typed pieces",
        "files": [
          "crates/cadence/src/plan/instructions.rs",
          "skills/cad-plan/SKILL.md",
          "crates/cadence/tests/support/phase13.rs",
          "crates/cadence/tests/support/phase31.rs",
          "crates/cadence/tests/phase27_plan.rs",
          "crates/cadence/tests/phase28_evidence.rs",
          "crates/cadence/tests/phase29_limits.rs",
          "crates/cadence/tests/phase31_read_layer.rs",
          "crates/cadence/tests/phase38_suite_gate.rs",
          "crates/cadence/tests/phase36_released_checks.rs",
          "crates/cadence/tests/phase34_blocked_path.rs",
          "crates/cadence/tests/phase12_execution.rs",
          "crates/cadence/tests/phase37_rejected_checks.rs",
          "crates/cadence/tests/execution_terminal_reopen.rs",
          "crates/cadence/tests/phase7_lease.rs",
          "crates/cadence/tests/phase8_dispatch.rs",
          "crates/cadence/tests/phase13_close.rs",
          "crates/cadence/tests/execution_boundary_compat.rs",
          "crates/cadence/tests/mcp.rs"
        ],
        "action": "Every test and support helper that builds a plan-submit with a body sends the typed pieces instead; sentinel text the read-layer tests look for moves into goal, context, notes and task action slots. Rewrite the Author, Preview and Refusal sections of plan::instructions to the typed shape and the digest-and-identities answer; the binary regenerates skills/cad-plan/SKILL.md (D-166) and tests/mcp.rs pins it. The suite is green at the end of this task.",
        "verify": [
          "cargo nextest run -p cadence --test mcp",
          "cargo nextest run -p cadence --test phase31_read_layer",
          "cargo nextest run -p cadence --test phase27_plan"
        ]
      }
    ],
    "suite": "cargo nextest run --workspace --no-fail-fast",
    "evidence_map": {
      "mode": "attached",
      "items": [
        {
          "kind": "check",
          "id": "P32-T1-C",
          "spec": {
            "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_plan_answers_digest_and_no_document",
            "expected": {
              "kind": "literal",
              "value": "The draft plan-submit answer is {status: ok, operation: plan-submit, persisted: false, validation: draft, submission_digest: <64 hex>, documents: [{identity: {phase, plan}, revision: <64 hex>}]} with no other key; after approval by that digest, the SHA-256 of the installed .planning/phases/<N>/PLAN-1.md equals documents[0].revision."
            },
            "test": {
              "file": "crates/cadence/tests/phase32_typed_authoring.rs",
              "function": "phase32_typed_plan_answers_digest_and_no_document"
            },
            "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
            "call": "Send plan-submit with one plan whose content is goal, context, notes, requirements, files, tasks [{id, title, files, action, verify}], suite and an attached evidence map, and no body; read the answer keys; approve by submission_digest; hash the installed file.",
            "boundary": "stdio JSON-RPC to the real binary bound to a fixture project, then the installed file on disk",
            "fakes": []
          },
          "reason": "Any echoed document, section or submission copy adds a key and fails the exact-keys assertion; a renderer that differs from the installed bytes fails the digest equality.",
          "associations": [
            {
              "truth_id": "T1",
              "truth_version": 1,
              "reason": "The planner's answer carries the rendered digest and nothing that is a document; this is T1's outcome word for word."
            }
          ]
        },
        {
          "kind": "check",
          "id": "P32-T5-C",
          "spec": {
            "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_plan_body_is_refused",
            "expected": {
              "kind": "literal",
              "value": "{status: refused, code: typed-content, slot: submission.plans[0].content.body, phase: <N>} and the fixture tree is byte-identical before and after."
            },
            "test": {
              "file": "crates/cadence/tests/phase32_typed_authoring.rs",
              "function": "phase32_plan_body_is_refused"
            },
            "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
            "call": "Send plan-submit whose first plan content carries a body string beside the typed pieces.",
            "boundary": "stdio JSON-RPC to the real binary; the tree snapshot helper in tests/support/phase31.rs",
            "fakes": []
          },
          "reason": "Accepting or silently dropping the body answers ok or a different code; a write on refusal changes the tree snapshot.",
          "associations": [
            {
              "truth_id": "T5",
              "truth_version": 1,
              "reason": "The refusal names the slot that carried the body; this is T5's outcome."
            }
          ]
        },
        {
          "kind": "artifact",
          "id": "P32-A-typed-content",
          "spec": {
            "locators": [
              "crates/cadence/src/plan/model.rs::Content",
              "crates/cadence/src/plan/model.rs::Task",
              "crates/cadence/src/plan/render.rs::document"
            ],
            "substance": "The wire Content type with goal, context, notes and typed tasks and no body; the renderer that produces every PLAN.md section from it; the retained record whose body the binary fills."
          },
          "reason": "Removing the typed fields or restoring body as a wire field undoes D-178.",
          "associations": [
            {
              "truth_id": "T1",
              "truth_version": 1,
              "reason": "The typed shape is what the planner submits."
            },
            {
              "truth_id": "T5",
              "truth_version": 1,
              "reason": "The type is what makes a body a refusable slot rather than a field."
            }
          ]
        }
      ]
    }
  },
  {
    "phase": 31,
    "plan": 2,
    "requirements": [
      "T2"
    ],
    "files": [
      "crates/cadence/src/context/model.rs",
      "crates/cadence/src/context/persistence.rs",
      "crates/cadence/src/context/validation.rs",
      "crates/cadence/src/context_service.rs",
      "crates/cadence/src/context/instructions.rs",
      "skills/cad-context/SKILL.md",
      "crates/cadence/tests/phase32_typed_authoring.rs",
      "crates/cadence/tests/phase11_context.rs",
      "crates/cadence/tests/mcp.rs"
    ],
    "directories": [],
    "goal": "context-submit answers a draft with the digest of the CONTEXT.md the binary rendered, and approval binds by that digest with the retained record unchanged.",
    "context": "D-179 and D-182 at .planning/phases/32/CONTEXT.md. context Approval (crates/cadence/src/context/model.rs:50) carries only an optional submission copy and context_service.rs:100 refuses an approval whose copy is not the exact submission; the draft answer (context_service.rs:177) reports no digest. plan::model::Approval (crates/cadence/src/plan/model.rs:72) and persistence::binds/bound (crates/cadence/src/plan/persistence.rs:69-83) are the pattern: either binding proves the same thing and the binary fills the copy before recording. The rendered document is context::render::document; its digest is the revision context-intake already reports.",
    "notes": "One check, because T2 is the only truth here; the artifact names the type and the two helpers. The held draft and the stale-digest location are plan 3.",
    "tasks": [
      {
        "id": "P32-2-T1",
        "title": "Context draft answers a digest and approval binds by it",
        "files": [
          "crates/cadence/src/context/model.rs",
          "crates/cadence/src/context/persistence.rs",
          "crates/cadence/src/context/validation.rs",
          "crates/cadence/src/context_service.rs",
          "crates/cadence/tests/phase32_typed_authoring.rs",
          "crates/cadence/tests/phase11_context.rs"
        ],
        "action": "Red first: add phase32_typed_context_answers_digest_and_no_document and retain its red run. Then give context Approval a submission_digest beside the optional submission copy (D-179), mirroring plan::model::Approval; the draft answer carries submission_digest and revision (the SHA-256 of the CONTEXT.md the binary rendered) and no document; binds/bound helpers in context::persistence accept either form and fill the copy before persistence::approved records it, so retained contexts keep their shape. phase11_context.rs keeps its copy-form cases and gains the digest form.",
        "verify": [
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_typed_context_answers_digest_and_no_document",
          "cargo nextest run -p cadence --test phase11_context"
        ]
      },
      {
        "id": "P32-2-T2",
        "title": "Context skill says digest, not copy",
        "files": [
          "crates/cadence/src/context/instructions.rs",
          "skills/cad-context/SKILL.md",
          "crates/cadence/tests/mcp.rs"
        ],
        "action": "Rewrite the approval paragraphs of context::instructions: approval carries owner, at and the submission_digest the draft answer reported; a full copy is accepted but costs the set twice. The binary regenerates skills/cad-context/SKILL.md (D-166) and tests/mcp.rs pins the bytes.",
        "verify": [
          "cargo nextest run -p cadence --test mcp"
        ]
      }
    ],
    "suite": "cargo nextest run --workspace --no-fail-fast",
    "evidence_map": {
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
  },
  {
    "phase": 31,
    "plan": 3,
    "requirements": [
      "T3",
      "T4"
    ],
    "files": [
      "crates/cadence/src/import/mod.rs",
      "crates/cadence/src/read/model.rs",
      "crates/cadence/src/read/document.rs",
      "crates/cadence/src/read/instructions.rs",
      "crates/cadence/src/plan_service.rs",
      "crates/cadence/src/plan/persistence.rs",
      "crates/cadence/src/context_service.rs",
      "crates/cadence/src/context/persistence.rs",
      "crates/cadence/src/plan/instructions.rs",
      "crates/cadence/src/context/instructions.rs",
      "skills/cad-plan/SKILL.md",
      "skills/cad-context/SKILL.md",
      "skills/cad-read-contract/SKILL.md",
      "crates/cadence/tests/phase32_typed_authoring.rs",
      "crates/cadence/tests/mcp.rs"
    ],
    "directories": [],
    "goal": "The resident holds the rendered draft, the owner reads it by identity, approval carries the digest and nothing else, and a stale digest is refused with the place that changed.",
    "context": "D-180, D-181 and assumption 1 at .planning/phases/32/CONTEXT.md. Today approval resends the whole submission (plan_service.rs:150-190 binds the copy or the digest against the submission in the same request), so the plan set crosses the wire twice and the owner never reads what the binary will install. The Session (crates/cadence/src/import/mod.rs:677) is the per-project object the resident keeps; a draft map on it costs a few tens of KB per draft and is gone on restart, which assumption 1 accepts. read::document::resolve (crates/cadence/src/read/document.rs:79) serves phase-plan and phase-context by rendering from the store; the draft arms render from the held bytes with the same part selectors. D-181's location is the first differing part selector, computed from the two held renderings, so the refusal names something the owner can read next through document.",
    "notes": "Three tasks: hold and serve, refuse with a place, then the skills. Plans 1 and 2 land the typed shapes first; this plan does not change the wire Content again.",
    "tasks": [
      {
        "id": "P32-3-T1",
        "title": "The resident holds the draft and serves it by identity",
        "files": [
          "crates/cadence/src/import/mod.rs",
          "crates/cadence/src/read/model.rs",
          "crates/cadence/src/read/document.rs",
          "crates/cadence/src/read/instructions.rs",
          "crates/cadence/src/plan_service.rs",
          "crates/cadence/src/context_service.rs",
          "crates/cadence/tests/phase32_typed_authoring.rs"
        ],
        "action": "Red first: add phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes and retain its red run. Then: a draft or preview answer stores the rendered documents on the bound Session keyed by phase and submission_digest (assumption 1: memory only, cleared by restart); document accepts {kind: plan-draft, phase, digest} and {kind: context-draft, phase, digest} and serves the held rendering with the same parts as the published identity; an approval request may carry only phase and approval {approved, owner, at, submission_digest} with no submission, and the binary publishes the held draft it names; the installed bytes are the held bytes.",
        "verify": [
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes"
        ]
      },
      {
        "id": "P32-3-T2",
        "title": "A stale digest is refused with the place that changed",
        "files": [
          "crates/cadence/src/plan_service.rs",
          "crates/cadence/src/plan/persistence.rs",
          "crates/cadence/src/context_service.rs",
          "crates/cadence/src/context/persistence.rs",
          "crates/cadence/tests/phase32_typed_authoring.rs"
        ],
        "action": "Red first: add phase32_stale_digest_is_refused_with_identity_and_part and retain its red run. Then: when the approval's digest names a held draft that is not the newest draft for the phase, refuse stale-draft with identity (the draft identity of the newest draft) and part (the first part selector whose rendered bytes differ between the named draft and the newest), and write nothing (D-181); a digest that names no held draft is refused unknown-draft with the phase identity.",
        "verify": [
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_stale_digest_is_refused_with_identity_and_part"
        ]
      },
      {
        "id": "P32-3-T3",
        "title": "Skills say read the draft, approve the digest",
        "files": [
          "crates/cadence/src/plan/instructions.rs",
          "crates/cadence/src/context/instructions.rs",
          "crates/cadence/src/read/instructions.rs",
          "skills/cad-plan/SKILL.md",
          "skills/cad-context/SKILL.md",
          "skills/cad-read-contract/SKILL.md",
          "crates/cadence/tests/mcp.rs"
        ],
        "action": "The planner and context skills tell the model to read the draft through document by its draft identity, show the owner what it read, and send the approval with the digest and no submission; the read contract lists the two draft identities. The binary regenerates the three skill files (D-166) and tests/mcp.rs pins them.",
        "verify": [
          "cargo nextest run -p cadence --test mcp"
        ]
      }
    ],
    "suite": "cargo nextest run --workspace --no-fail-fast",
    "evidence_map": {
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
  },
  {
    "phase": 31,
    "plan": 4,
    "requirements": [
      "T6",
      "T7"
    ],
    "files": [
      "crates/cadence/tests/phase32_typed_authoring.rs",
      "crates/cadence/tests/support/phase31_hosts.rs",
      "crates/cadence/tests/phase31_read_layer.rs",
      "crates/cadence/tests/support/phase31.rs"
    ],
    "directories": [],
    "goal": "Two callers on one resident read the same draft slice, the phase 31 host helper is clean, and the six-plan publication cost is measured on the wire against 113KB twice.",
    "context": "D-183 and D-184 at .planning/phases/32/CONTEXT.md. The phase 31 host helper (crates/cadence/tests/support/phase31_hosts.rs) proves T6 only by starting the installed claude, which D-172 ignores; its clippy findings were recorded at bootstrap-exception.md item 5. The mechanism T6 names is one resident shared by every caller (D-149), and that is checkable from two request streams on one stdio process. The 2026-09-12 figure is the 113KB plan set carried twice in docs/architecture/boundary-fix.md:16, so the bound is 231424 bytes.",
    "notes": "The observation is pending and caps T6 at concerns even when seen; the check is the non-host evidence D-183 asks for. Task 3 runs last because it needs plans 1 and 3 landed.",
    "tasks": [
      {
        "id": "P32-4-T1",
        "title": "Two callers on one resident get the same draft slice",
        "files": [
          "crates/cadence/tests/phase32_typed_authoring.rs",
          "crates/cadence/tests/support/phase31.rs"
        ],
        "action": "Red first: add phase32_two_callers_on_one_resident_read_the_same_draft_slice and retain its red run. The check opens one resident and drives it from two request streams that interleave (the main thread and a worker share one MCP connection in a Claude host; the support Client gains a way to send from a second caller identity on the same process), submits a draft from the first, reads each draft part from both, and asserts byte equality per part and exactly one cadence serve process. Then make it green if anything in plan 3's draft serving is caller-dependent.",
        "verify": [
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_two_callers_on_one_resident_read_the_same_draft_slice"
        ]
      },
      {
        "id": "P32-4-T2",
        "title": "Phase 31 host helper: lints clear, live probe stays ignored",
        "files": [
          "crates/cadence/tests/support/phase31_hosts.rs",
          "crates/cadence/tests/phase31_read_layer.rs"
        ],
        "action": "Run clippy on the phase31_read_layer target and clear any finding in support/phase31_hosts.rs (the four D-156 record item 5 names; 2026-09-17 clippy printed none, so record the run). The ignored phase31_worker_hosts_receive_main_thread_answers stays as the live probe under D-172 with its reason updated to name D-183 and this plan's check as the non-host evidence.",
        "verify": [
          "cargo clippy -p cadence --test phase31_read_layer -- -D warnings"
        ]
      },
      {
        "id": "P32-4-T3",
        "title": "Measure a six-plan publication on the wire",
        "files": [
          "crates/cadence/tests/phase32_typed_authoring.rs"
        ],
        "action": "Red first: add phase32_six_plan_publication_wire_bytes and retain its red run. The check publishes a six-plan phase through plan-read preview, plan-submit draft and plan-submit approval by digest on the real stdio server, sums the bytes of every request and answer line, asserts the total is below 231424 (113KB twice, D-184), and prints one line 'phase 32 wire bytes: <total> against 231424' that the phase SUMMARY carries at close.",
        "verify": [
          "cargo nextest run -p cadence --test phase32_typed_authoring phase32_six_plan_publication_wire_bytes --no-capture"
        ]
      }
    ],
    "suite": "cargo nextest run --workspace --no-fail-fast",
    "evidence_map": {
      "mode": "attached",
      "items": [
        {
          "kind": "check",
          "id": "P32-T6-C",
          "spec": {
            "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_two_callers_on_one_resident_read_the_same_draft_slice",
            "expected": {
              "kind": "property",
              "value": "For every part selector of a held draft, the bytes served to the second caller equal the bytes served to the first caller on the same resident, and exactly one cadence serve process exists."
            },
            "test": {
              "file": "crates/cadence/tests/phase32_typed_authoring.rs",
              "function": "phase32_two_callers_on_one_resident_read_the_same_draft_slice"
            },
            "setup": "One real stdio server on a ProcessFixture project; the support Client extended to send requests under a second caller identity on the same process.",
            "call": "Submit a draft from caller one; read every draft part from caller one and caller two; list cadence serve processes.",
            "boundary": "stdio JSON-RPC to one real binary from two callers; the process table",
            "fakes": []
          },
          "reason": "A per-caller cache or a second resident makes the two readings differ or the process count two.",
          "associations": [
            {
              "truth_id": "T6",
              "truth_version": 1,
              "reason": "A worker sharing the resident gets the main thread's slice; this is the mechanism T6 names, checked without a host."
            }
          ]
        },
        {
          "kind": "observation",
          "id": "P32-O1",
          "spec": {
            "episode": "The owner runs a real planning round for phase 33 in a Claude host, dispatches one named worker, and sees the worker read a phase 32 draft part through document and get the bytes the main thread read.",
            "specification": {
              "source": "D-183 in .planning/phases/32/CONTEXT.md",
              "document": ".planning/phases/32/CONTEXT.md",
              "approved_by": "John Crenshaw <john@jcrenshaw.dev>",
              "approved_at": "2026-09-17T11:56:07Z"
            },
            "status": "pending"
          },
          "reason": "A deterministic stdio check cannot establish what a Claude host does with a worker; the live probe phase31_worker_hosts_receive_main_thread_answers remains ignored under D-172.",
          "associations": [
            {
              "truth_id": "T6",
              "truth_version": 1,
              "reason": "T6 names a Claude host; only the owner in a host can see it."
            }
          ]
        },
        {
          "kind": "check",
          "id": "P32-T7-C",
          "spec": {
            "command": "cargo nextest run -p cadence --test phase32_typed_authoring phase32_six_plan_publication_wire_bytes",
            "expected": {
              "kind": "literal",
              "value": "The test prints exactly one line 'phase 32 wire bytes: <total> against 231424' where <total> is the sum of request and answer bytes for preview, draft and digest approval of six typed plans, and asserts total < 231424."
            },
            "test": {
              "file": "crates/cadence/tests/phase32_typed_authoring.rs",
              "function": "phase32_six_plan_publication_wire_bytes"
            },
            "setup": "Start the real env!(CARGO_BIN_EXE_cadence) stdio server through the Client in crates/cadence/tests/support/phase31.rs on a fresh ProcessFixture project whose phase has a native approved context.",
            "call": "Preview six plans with plan-read count 6 and the complete submission, send the draft, approve by digest; count bytes on both directions of the stdio pipe.",
            "boundary": "stdio JSON-RPC to the real binary, bytes counted at the pipe",
            "fakes": []
          },
          "reason": "Any echoed document puts six plans back on the wire and the total exceeds the bound.",
          "associations": [
            {
              "truth_id": "T7",
              "truth_version": 1,
              "reason": "The owner sees the number beside the 113KB-twice figure; the printed line is what the SUMMARY carries."
            }
          ]
        },
        {
          "kind": "artifact",
          "id": "P32-A-summary-line",
          "spec": {
            "locators": [
              ".planning/phases/32/SUMMARY.md"
            ],
            "substance": "The phase summary carries the measured wire bytes line from P32-T7-C."
          },
          "reason": "Without the line in the summary the number is only in a test log.",
          "associations": [
            {
              "truth_id": "T7",
              "truth_version": 1,
              "reason": "The owner sees the number at close in the summary."
            }
          ]
        }
      ]
    }
  }
]"###;

const PHASE32_WIRE_TRUTHS: &str = r###"[
  {
    "id": "T1",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When the planner submits a plan as typed pieces, the planner gets the digest of the PLAN.md the binary rendered and no document in the answer.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  },
  {
    "id": "T5",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When a plan-submit request carries a Markdown body, the planner is refused with the slot named.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  },
  {
    "id": "T2",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When the context author submits a context as typed pieces, the context author gets the digest of the CONTEXT.md the binary rendered and no document in the answer.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  },
  {
    "id": "T3",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When the owner approves a draft by its digest with owner and time, the owner sees the rendered document installed byte for byte equal to the draft read by identity.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  },
  {
    "id": "T4",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When the owner approves with the digest of a draft that has changed since, the owner is refused with the identity and part where the held draft differs.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  },
  {
    "id": "T6",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When a worker in a Claude host reads a draft by identity, the worker gets the same slice the main thread gets for that identity.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  },
  {
    "id": "T7",
    "trigger": "the six-plan fixture is published",
    "observer": "the owner",
    "verb": "sees",
    "outcome": "When phase 32 closes, the owner sees the wire bytes for publishing a six-plan phase beside the 113KB-twice figure of 2026-09-12.",
    "kind": "property",
    "observable": true,
    "fixed_oracle": true
  }
]"###;


#[test]
fn phase32_two_callers_on_one_resident_read_the_same_draft_slice() {
    let fixture = ProcessFixture::new();
    let mut client = Client::open(fixture.project());
    let mut caller_a = phase31::Caller::new(0);
    let mut caller_b = phase31::Caller::new(1);
    native_context(&mut client);
    let allocation = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"count":1}),
    );
    let request = client.send_call(
        &mut caller_a, "cadence_apply",
        json!({"operation":"plan-submit","submission":typed_submission(&allocation)}),
    );
    let draft = client.receive_call(request);
    assert_eq!(draft["status"], "ok", "{draft}");
    let identity = json!({
        "kind":"plan-draft","phase":draft["documents"][0]["identity"]["phase"],
        "plan":draft["documents"][0]["identity"]["plan"],"digest":draft["submission_digest"]
    });
    let request = client.send_call(
        &mut caller_a, "cadence_query",
        json!({"operation":"document","identity":identity}),
    );
    let index = client.receive_call(request);
    assert_eq!(index["status"], "ok", "{index}");
    let parts = index["parts"].as_array().unwrap();
    assert_eq!(parts.iter().map(|part| part["part"].as_str().unwrap()).collect::<Vec<_>>(),
        vec!["frontmatter", "goal", "truths", "context", "evidence-map",
            "tasks-heading", "task:typed-plan", "notes"]);
    let resident = client.serve_processes();
    assert_eq!(resident.len(), 1);
    let mut rendered = Vec::new();
    for part in parts {
        let arguments = json!({"operation":"document","identity":identity,"part":part["part"]});
        let request_a = client.send_call(&mut caller_a, "cadence_query", arguments.clone());
        let request_b = client.send_call(&mut caller_b, "cadence_query", arguments);
        assert_ne!(request_a, request_b);
        // Receive B first so correlation cannot rely on the order of reads.
        let slice_b = client.receive_call(request_b);
        let slice_a = client.receive_call(request_a);
        assert_eq!(slice_a["status"], "ok", "{slice_a}");
        assert_eq!(slice_b["status"], "ok", "{slice_b}");
        assert_eq!(slice_a["revision"], draft["documents"][0]["revision"]);
        assert_eq!(slice_b["revision"], draft["documents"][0]["revision"]);
        let bytes_a = slice_a["body"].as_str().unwrap().as_bytes();
        let bytes_b = slice_b["body"].as_str().unwrap().as_bytes();
        assert_eq!(bytes_a, bytes_b, "part {}", part["part"]);
        rendered.extend_from_slice(bytes_a);
        assert_eq!(client.serve_processes(), resident);
    }
    assert_eq!(format!("{:x}", Sha256::digest(&rendered)), draft["documents"][0]["revision"]);
    client.finish();
}

fn native_context(client: &mut Client) {
    let answer = client.call(
        "cadence_apply",
        approve(json!({"operation":"context-submit","submission":{
            "phase":PHASE,"title":"Typed plan authoring",
            "scope":"The binary owns plan rendering.",
            "durable_decisions":[],"decisions":[],"assumptions":[],
            "truths":[
                {"id":"T1","trigger":"the planner submits typed plan content",
                    "observer":"the planner","verb":"gets",
                    "outcome":"the rendered digest and no document",
                    "kind":"property","observable":true,"fixed_oracle":true},
                {"id":"T5","trigger":"the planner submits a Markdown body",
                    "observer":"the planner","verb":"gets",
                    "outcome":"a refusal naming the body slot",
                    "kind":"property","observable":true,"fixed_oracle":true}
            ]
        }})),
    );
    assert_eq!(answer["persisted"], true, "{answer}");
}

fn check(id: &str, truth: &str) -> Value {
    json!({
        "kind":"check","id":id,"reason":"The authoring boundary must retain its contract.",
        "spec":{"command":"python3 -B tests/tiny.py",
            "expected":{"kind":"property","value":"the authoring contract is observed"},
            "test":{"file":"tests/tiny.py","function":"Tiny.test_ok"},
            "setup":"A real fixture project.","call":"Call the real stdio server.",
            "boundary":"stdio JSON-RPC and the fixture filesystem","fakes":[]},
        "associations":[{"truth_id":truth,"truth_version":1,
            "reason":"This check observes the truth at the public authoring boundary."}]
    })
}

fn typed_submission(allocation: &Value) -> Value {
    let target = allocation["targets"][0].clone();
    json!({
        "phase":PHASE,"occurrence":allocation["occurrence"],
        "request_id":"phase32-typed-plan",
        "inventory_basis":allocation["inventory"]["basis"],
        "plans":[{"target":target,"content":{
            "phase":PHASE,"plan":target["plan"],
            "goal":"Render the complete plan from typed content.",
            "context":"The stdio authoring boundary is the observed surface.",
            "notes":"The installed bytes must match the reported revision.",
            "requirements":["T1","T5"],
            "files":["src/lease.rs","tests/tiny.py"],
            "tasks":[{"id":"typed-plan","title":"Exercise typed plan authoring",
                "files":["src/lease.rs","tests/tiny.py"],
                "action":"Submit typed pieces through the real binary.",
                "verify":["python3 -B tests/tiny.py"]}],
            "suite":"python3 -B tests/tiny.py",
            "evidence_map":{"mode":"attached","items":[
                check("fixture/T1", "T1"), check("fixture/T5", "T5")
            ]}
        }}]
    })
}

fn keys(value: &Value) -> BTreeSet<&str> {
    value.as_object().unwrap().keys().map(String::as_str).collect()
}

fn is_digest(value: &Value) -> bool {
    value.as_str().is_some_and(|value| {
        value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
    })
}

#[test]
fn phase32_stale_digest_is_refused_with_identity_and_part() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    native_context(&mut client);
    let allocation = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"count":1}),
    );
    let mut submission = typed_submission(&allocation);
    let first = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":submission}),
    );
    assert_eq!(first["status"], "ok", "{first}");
    submission["plans"][0]["content"]["notes"] = json!("The owner must inspect these revised notes.");
    let newest = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":submission}),
    );
    assert_eq!(newest["status"], "ok", "{newest}");
    assert_ne!(first["submission_digest"], newest["submission_digest"]);
    let before = tree(project);
    let answer = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","phase":PHASE,"approval":{
            "approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
            "submission_digest":first["submission_digest"]
        }}),
    );
    assert_eq!(answer, json!({
        "status":"refused","code":"stale-draft",
        "identity":{"kind":"plan-draft","phase":PHASE,"plan":1,
            "digest":newest["submission_digest"]},
        "part":"notes"
    }));
    assert_eq!(tree(project), before);
    let changed = client.call(
        "cadence_query",
        json!({"operation":"document","identity":answer["identity"],"part":answer["part"]}),
    );
    assert_eq!(changed["status"], "ok", "{changed}");
    assert_eq!(changed["body"], "## Notes\n\nThe owner must inspect these revised notes.\n");
    client.finish();
}

#[test]
fn phase32_draft_read_by_identity_and_approved_by_digest_installs_same_bytes() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    native_context(&mut client);
    let allocation = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"count":1}),
    );
    let draft = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":typed_submission(&allocation)}),
    );
    assert_eq!(draft["status"], "ok", "{draft}");
    let identity = json!({
        "kind":"plan-draft","phase":PHASE,"plan":draft["documents"][0]["identity"]["plan"],
        "digest":draft["submission_digest"]
    });
    let index = client.call(
        "cadence_query",
        json!({"operation":"document","identity":identity}),
    );
    assert_eq!(index["status"], "ok", "{index}");
    let parts = index["parts"].as_array().unwrap();
    assert_eq!(parts.iter().map(|part| part["part"].as_str().unwrap()).collect::<Vec<_>>(),
        vec!["frontmatter", "goal", "truths", "context", "evidence-map",
            "tasks-heading", "task:typed-plan", "notes"]);
    let mut rendered = String::new();
    for part in parts {
        let slice = client.call(
            "cadence_query",
            json!({"operation":"document","identity":identity,"part":part["part"]}),
        );
        assert_eq!(slice["status"], "ok", "{slice}");
        assert_eq!(slice["revision"], draft["documents"][0]["revision"]);
        rendered.push_str(slice["body"].as_str().unwrap());
    }
    let published = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","phase":PHASE,"approval":{
            "approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
            "submission_digest":draft["submission_digest"]
        }}),
    );
    assert_eq!(published["persisted"], true, "{published}");
    let installed = fs::read(project.join(".planning/phases/31/PLAN-1.md")).unwrap();
    assert_eq!(installed, rendered.as_bytes());
    assert_eq!(format!("{:x}", Sha256::digest(&installed)), draft["documents"][0]["revision"]);
    client.finish();
}

#[test]
fn phase32_typed_context_answers_digest_and_no_document() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    let submission = json!({
        "phase": PHASE,
        "title": "Typed context authoring",
        "scope": "The binary owns context rendering.",
        "durable_decisions": [{"id":"D-179","text":"Approval binds to the draft digest."}],
        "decisions": [{"id":"D-182","text":"The draft answer omits document bytes."}],
        "assumptions": ["The installed document is UTF-8 Markdown."],
        "truths": [{
            "id":"T2","trigger":"the context author submits typed context content",
            "observer":"the context author","verb":"gets",
            "outcome":"the rendered digest and no document",
            "kind":"literal","observable":true,"fixed_oracle":true
        }]
    });

    let draft = client.call(
        "cadence_apply",
        json!({"operation":"context-submit","submission":submission.clone()}),
    );
    assert_eq!(
        keys(&draft),
        BTreeSet::from([
            "status", "operation", "phase", "persisted", "validation", "submission_digest",
            "revision"
        ]),
        "{draft}",
    );
    assert_eq!(draft["status"], "ok", "{draft}");
    assert_eq!(draft["operation"], "context-submit", "{draft}");
    assert_eq!(draft["phase"], PHASE, "{draft}");
    assert_eq!(draft["persisted"], false, "{draft}");
    assert_eq!(draft["validation"], "draft", "{draft}");
    assert!(is_digest(&draft["submission_digest"]), "{draft}");
    assert!(is_digest(&draft["revision"]), "{draft}");

    let published = client.call(
        "cadence_apply",
        json!({"operation":"context-submit","submission":submission,"approval":{
            "approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
            "submission_digest":draft["submission_digest"]
        }}),
    );
    assert_eq!(published["persisted"], true, "{published}");
    let installed = fs::read(project.join(".planning/phases/31/CONTEXT.md")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(&installed)),
        draft["revision"],
    );
    client.finish();
}

#[test]
fn phase32_typed_plan_answers_digest_and_no_document() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    native_context(&mut client);
    let allocation = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"count":1}),
    );
    let submission = typed_submission(&allocation);

    let draft = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":submission.clone()}),
    );
    assert_eq!(
        keys(&draft),
        BTreeSet::from([
            "status", "operation", "persisted", "validation", "submission_digest", "documents"
        ]),
        "{draft}",
    );
    assert_eq!(draft["status"], "ok", "{draft}");
    assert_eq!(draft["operation"], "plan-submit", "{draft}");
    assert_eq!(draft["persisted"], false, "{draft}");
    assert_eq!(draft["validation"], "draft", "{draft}");
    assert!(is_digest(&draft["submission_digest"]), "{draft}");
    assert_eq!(draft["documents"].as_array().unwrap().len(), 1, "{draft}");
    assert_eq!(draft["documents"][0]["identity"], allocation["targets"][0]);
    assert!(is_digest(&draft["documents"][0]["revision"]), "{draft}");

    let published = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":submission,"approval":{
            "approved":true,"owner":"Fixture Owner","at":"2026-09-17T12:00:00Z",
            "submission_digest":draft["submission_digest"]
        }}),
    );
    assert_eq!(published["persisted"], true, "{published}");
    let installed = fs::read(project.join(".planning/phases/31/PLAN-1.md")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(&installed)),
        draft["documents"][0]["revision"],
    );
    client.finish();
}

#[test]
fn phase32_plan_body_is_refused() {
    let fixture = ProcessFixture::new();
    let project = fixture.project();
    let mut client = Client::open(project);
    native_context(&mut client);
    let allocation = client.call(
        "cadence_query",
        json!({"operation":"plan-read","phase":PHASE,"count":1}),
    );
    let mut submission = typed_submission(&allocation);
    submission["plans"][0]["content"]["body"] = json!("# Caller-owned Markdown\n");
    let before = tree(project);

    let answer = client.call(
        "cadence_apply",
        json!({"operation":"plan-submit","submission":submission}),
    );
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "typed-content", "{answer}");
    assert_eq!(answer["slot"], "submission.plans[0].content.body", "{answer}");
    assert_eq!(answer["phase"], PHASE, "{answer}");
    assert_eq!(tree(project), before);
    client.finish();
}
