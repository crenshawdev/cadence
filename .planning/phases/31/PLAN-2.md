---
phase: 31
plan: 2
requirements: ["T4"]
files: ["crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs","crates/cadence/src/read/scope.rs","crates/cadence/src/read/search.rs","crates/cadence/src/read/location.rs","crates/cadence/src/read/mod.rs","crates/cadence/src/read_service.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/context_service.rs","crates/cadence/src/context/render.rs","crates/cadence/src/plan_service.rs","crates/cadence/src/plan/render.rs","crates/cadence/src/plan/inventory.rs","crates/cadence/src/execution/dispatch.rs","crates/cadence/src/execution_service.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/context/instructions.rs","skills/cad-plan/SKILL.md","skills/cad-context/SKILL.md","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/support/phase31.rs","crates/cadence/tests/support/phase13.rs","crates/cadence/tests/phase11_context.rs","crates/cadence/tests/phase27_plan.rs","crates/cadence/tests/phase28_evidence.rs","crates/cadence/tests/phase29_limits.rs","crates/cadence/tests/phase12_execution.rs","crates/cadence/tests/phase13_verification.rs","crates/cadence/tests/phase13_support.rs","crates/cadence/tests/phase13_close.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-2-T1","verify":["cargo test -p cadence --test phase31_read_layer phase31_process_identity_returns_rendered_slice -- --exact"]},{"id":"P31-2-T2","verify":["cargo test -p cadence --test phase11_context phase11_unapproved_context_changes_nothing -- --exact"]}]}
---
# Phase 31: The read layer - Plan 2

## Goal

Context, plan tasks, roadmap rows and task summaries are read through identities the binary resolves and renders; named scopes require no caller file list.

## Must be true when done

- T4. When the model asks for a process record by identity, the model gets the slice the binary renders for it and never a path.

## Context

Execute after PLAN-1. D-148 is .planning/phases/31/CONTEXT.md:12. The current whole-roadmap leak is crates/cadence/src/context_service.rs:30; current plan readback exposes document bytes at crates/cadence/src/plan_service.rs:66. Use existing authority at crates/cadence/src/context/persistence.rs:38 and the existing renderers at crates/cadence/src/context/render.rs:20 and crates/cadence/src/plan/render.rs:5. Inventory already recognizes SUMMARY/UAT at crates/cadence/src/plan/inventory.rs:51. Task rows come from crates/cadence/src/execution/render.rs:67; roadmap phase rows are parsed at crates/cadence/src/derivation/parse.rs:150. Never infer a native context from its Markdown.

The real admitted lease is composed at crates/cadence/src/execution/dispatch.rs:145, especially its files/directories at crates/cadence/src/execution/dispatch.rs:164, and reaches the outgoing response through crates/cadence/src/execution_service.rs:1138. Keep those owners rather than taking a caller-supplied root or lease. The intake regression to adapt exists at crates/cadence/tests/phase11_context.rs:162. No link item is necessary for an internal renderer call: T4 promises an identity-addressed outcome, not an internal named value handoff.

### Scope and compatibility

The existing publication stores remain unchanged. This plan changes content readback and adds process-part rendering, not typed authoring, approval rules, allocation, task execution or phase completion. Tests that must inspect old full-submission publication proposals still exercise that existing authoring contract; caller instructions use document for project/process reads. Native evidence-map queries remain typed authority queries, not file read substitutes. Returning an index for an unsupported historical part is only valid when explicitly labelled; do not label unavailable content as an empty successful record.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P31-T4-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_process_identity_returns_rendered_slice -- --exact",
        "expected": {
          "kind": "property",
          "value": "The model receives only its requested rendered part: the handwritten native truth sentence, the task-1 text of plan 2 (not plan 1 or task 2), only phase 31's roadmap row, and the known completed task row with its actual acknowledged commit. Large parts page inside that identity, without neighboring sections. Answers and refusals contain no storage path, no raw CONTEXT/PLAN/ROADMAP document and no whole-file fallback; context-intake no longer returns the whole roadmap. Named scopes derive the actual admitted lease and the phase's process identities, never caller lists of lease files. Missing/ambiguous identities refuse explicitly; an invented path is refused; the misleading alias cannot replace native authority. Queries preserve before/after durable state."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_process_identity_returns_rendered_slice"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. Publicly author native phase 31 context with a uniquely worded truth, two plans each with two task headings and stable execution task ids, and a roadmap with phases 30, 31 and 32. Inflate an unrelated context section and plan task so the complete records exceed the answer bound. Publicly admit a fixture plan, obtain an actual dispatch lease and complete one tiny real task to supply a recorded summary row; take all identities from acknowledged public answers. Add a misleading raw PLAN alias as a caller-controlled file, without editing native records.",
        "call": "Call document for phase 31 context truth, phase 31 plan 2 task 1, roadmap row 31, and the completed task's summary identity. Page the large selected part using its returned identity-bound continuation. Query context-intake and plan-read readback for bounded identity references. Search the named phase-documents and current-task-lease scopes and follow the process results through document. Try an invented process path through document/read and a missing or ambiguous record identity.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. ",
        "fakes": []
      },
      "reason": "Resolving a supplied path, slicing the wrong plan/task or returning the roadmap wholesale breaks identity-owned rendering.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Resolving a supplied path, slicing the wrong plan/task or returning the roadmap wholesale breaks identity-owned rendering."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-DOCUMENT",
      "spec": {
        "locators": [
          "crates/cadence/src/read/model.rs::DocumentIdentity",
          "crates/cadence/src/read/model.rs::DocumentRequest",
          "crates/cadence/src/read/document.rs",
          "crates/cadence/src/read_service.rs",
          "crates/cadence/src/server.rs::QueryArguments"
        ],
        "substance": "A separate public document operation. Closed identities include phase-context, phase-plan, phase-roadmap-row and task-summary, with positive phase/plan numbers, retained task ids and explicit part selectors. Phase documents expose native truth/decision/task/section identity, source classification and content revision; continuations bind the same identity and part. An omitted part returns a bounded part index, not the record body. Other recognized process records such as UAT and retained reports get identity-indexed sections when discovered through existing inventory; unknown files never become an arbitrary path identity. Strict typed slice/index/refusal answers expose no storage path. Native rendering consumes existing context/plan/execution authority; historical inputs remain explicitly historical."
      },
      "reason": "A file locator or a second independent record parser would break the binary's ownership of process identity and rendering.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The third operation and its identity/answer vocabulary are the promised interface."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-RECORD-RENDERING",
      "spec": {
        "locators": [
          "crates/cadence/src/context/render.rs",
          "crates/cadence/src/context/persistence.rs::saved",
          "crates/cadence/src/plan/render.rs",
          "crates/cadence/src/plan/persistence.rs::saved",
          "crates/cadence/src/plan/inventory.rs",
          "crates/cadence/src/execution/render.rs",
          "crates/cadence/src/context_service.rs",
          "crates/cadence/src/plan_service.rs"
        ],
        "substance": "Shared pure part renderers over approved context, retained plan publication content and recorded task outcomes; reuse the existing source of truth and located inventory, not caller bytes. The phase's roadmap list row/detail entry is resolved internally by canonical phase identity with fence-aware boundaries and explicit ambiguity refusal. Readback/intake expose identities and small state/contract metadata so document owns process content reads. Rendering is read-only, without import, recovery, projection repair, approval reconstruction or a new store schema."
      },
      "reason": "Reading mutable projection bytes as native authority or returning neighboring records would give the caller the wrong process truth.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The binary must render the actual selected record through its existing owners."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-NAMED-SCOPES",
      "spec": {
        "locators": [
          "crates/cadence/src/read/model.rs::SearchScope",
          "crates/cadence/src/read/scope.rs",
          "crates/cadence/src/execution/dispatch.rs::native_operational",
          "crates/cadence/src/execution_service.rs"
        ],
        "substance": "Typed scopes for this task's lease and this phase's documents, alongside confined relative directory/glob search. A lease scope names the actual dispatch/task identity and resolves its admitted files/directories from retained execution state; it does not accept a replacement file list. Phase-document search enumerates recognized records by phase identity and searches the same internally rendered parts document serves. Source hits carry issued source locations; process hits carry document identities/part selectors, never process paths. Lease-issued source references and located read refusals use the shared resident issuer."
      },
      "reason": "Having the worker spell the lease or treating .planning as a source glob would reopen the origin/path boundary.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Named scopes are the binary-owned scopes of the approved search design."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "A lease location must be issued from real admitted state."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "Process matches remain identity-addressed through document."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Resolve and render process parts by identity

- **ID:** P31-2-T1
- **Files:** crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/read/scope.rs, crates/cadence/src/read/search.rs, crates/cadence/src/read/location.rs, crates/cadence/src/read/mod.rs, crates/cadence/src/read_service.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/context_service.rs, crates/cadence/src/context/render.rs, crates/cadence/src/plan_service.rs, crates/cadence/src/plan/render.rs, crates/cadence/src/plan/inventory.rs, crates/cadence/src/execution/dispatch.rs, crates/cadence/src/execution_service.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/context/instructions.rs, skills/cad-plan/SKILL.md, skills/cad-context/SKILL.md, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31.rs.
- **Action:** Deliver P31-T4-C and all three artifacts in this plan. Write the entire T4 function red first. Complete document dispatch on the existing cadence_query/resident path. Resolve phase occurrence/native authority using context::persistence::saved and plan::persistence::saved, and reuse context::render and plan::render for the requested part. Split pure part rendering from document assembly so source and disk projections cannot drift; do not introduce an independent Markdown truth parser or new authoring schema. Until phase 32, select a plan task from the retained content.body using fence-aware heading spans aligned with its existing execution task ids; ambiguous/missing mappings refuse and never pick another section. Task summary rendering selects the matching recorded task from execution/render.rs's actual source records. Resolve the roadmap phase row from the existing canonical phase-row parsing; expose only that row or the explicitly selected phase detail, never the surrounding roadmap.

Implement the two named scopes. A task-lease selector consumes retained dispatch/task authority; refresh its issued source locations from the same resident registry when the host asks for the lease scope. Emit lease/reference identities from execution_service's outgoing operational material without changing admission or the retained dispatch identity. Phase-documents search uses the same process-part resolver, can reach .planning even when the generic ignore file excludes it, and returns document identities rather than source-file locations. Block source reads/search aliases of process records, including symlink/canonical aliases. Missing records and stale or expired continuations get bounded identity-based refusals.

Every record read defaults to a bounded part index; actual slices require a part or issued continuation. Big truths or tasks are subdivided under the same identity. Retire context-intake's context/roadmap document fields and the content-bearing plan-read readback fields in favor of bounded identities/classification/revisions; do not echo raw inventory documents or retained publication bodies through that readback. Keep allocation identity/basis and the publication contract intact. The separate full-submission authoring contract is phase 32's work, not a second source-read route to teach callers. Update compiled context/planner intake instructions and regenerate their two skills in this task so callers actually use document. Preserve all current uncommitted source changes and historical publication/approval bytes. Finish T4 green with a real binary-rendered context, plan, task summary and roadmap row.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_process_identity_returns_rendered_slice -- --exact.

### Task 2: Migrate existing readback consumers without changing their authority assertions

- **ID:** P31-2-T2
- **Files:** crates/cadence/tests/support/phase13.rs, crates/cadence/tests/phase11_context.rs, crates/cadence/tests/phase27_plan.rs, crates/cadence/tests/phase28_evidence.rs, crates/cadence/tests/phase29_limits.rs, crates/cadence/tests/phase12_execution.rs, crates/cadence/tests/phase13_verification.rs, crates/cadence/tests/phase13_support.rs, crates/cadence/tests/phase13_close.rs.
- **Action:** Adapt only existing fixture/readback consumers that depended on context-intake or plan-read returning projection documents. Fetch identity-addressed parts when their subject is public readback; retain direct fixture filesystem comparison when their subject is installed projection durability. Preserve the original opaque ids, versions, approval/replay, inventory, red/green and refusal assertions. Do not replace a public readback assertion with a call to a reducer or renderer, loosen schema equality or manufacture native approval to make an old fixture pass. The support Client's real binary/stdio behavior remains the shared transport. No additional phase-31 test or evidence check is created. The single existing phase11_unapproved_context_changes_nothing function is the narrow regression for changed intake: assert identity/index output and unchanged durable bytes for native, historical, missing and pending inputs. All broader existing regressions remain covered by the plan-close suite, run once.
- **Verify:** cargo test -p cadence --test phase11_context phase11_unapproved_context_changes_nothing -- --exact.

## Notes

Run these plans strictly in returned target order, one executor dispatch at a time. A later plan extends the committed result of its predecessor. Shared integration files are declared sequential extension leases, not competing implementations: PLAN-1 owns source operations and location issuance; PLAN-2 owns document resolution and named-scope integration; PLAN-3 owns instruction/host exposure; PLAN-4 owns measurement. In the shared test file each plan owns only its named functions; do not rewrite an earlier check's oracle or recorded red/green material. New module and test names are creation specifications, not assertions that those files/functions exist today.

Each task delivering a check writes that complete function first, runs its exact command, records the actual failing-test commit, implements, reruns the same command with unchanged test material, and records its passing commit under that task id. Inspect the red cause: missing credentials, missing host executables, transport setup failure or a skipped test is not a behavioral red. One check per truth, no observation items and no extra acceptance regressions. Existing regressions may be adapted to intentional public-shape changes without replacing the seven truth checks. Run only task verify commands while working; the executor runs the frontmatter suite once at plan close. Planning neither runs nor certifies any command.

All reads stay inside the bound project or a specifically resolved host record; no caller path field, no caller-created source range, no whole-file response or generic process-file fallback. A relative directory/glob in search is only the scoped filter explicitly retained by read-layer.md, never a read address. Process identities must never reveal storage paths in metadata, cursors, errors or wrapper output. The executor may write source and tests with edit tools. Existing native approvals, publication records, occurrence rules, admission, check history and verification stay authoritative. Typed authoring and digest-only publication changes belong to phase 32; dispatch-payload replacement and execution reporting belong to phase 33.
