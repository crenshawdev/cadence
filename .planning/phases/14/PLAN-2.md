---
phase: 14
plan: 2
requirements: ["T1","T5"]
files: ["crates/cadence/src/adoption_service.rs","crates/cadence/src/capture_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress_service.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","skills/cad-capture/SKILL.md"]
directories: ["crates/cadence/src/adoption","crates/cadence/src/capture","crates/cadence/src/store"]
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P14-2-T1","verify":["cargo test -p cadence --test phase14_receipts phase14_first_touch_declares_ticked_phases_it_cannot_derive -- --exact"]},{"id":"P14-2-T2","verify":["cargo test -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound -- --exact"]},{"id":"P14-2-T3","verify":["cargo test -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound -- --exact","cargo run -p cadence -- capture-instructions"]}]}
---
# Phase 14: Receipts and retune - Plan 2

## Goal

Declared completions rendered and writable by the owner's `adoption-declare`, never by a caller, with no
document byte changed (D-135, D-137, D-142); captures as typed items with kind and phase and a reported
bound (D-144).

## Must be true when done

- T1. When a tree whose roadmap ticks a phase the documents cannot derive complete is first touched, the owner sees that phase reported complete as declared at import with every document byte unchanged.
- T5. When the owner submits a capture, the owner sees it as a captured item with its kind and phase, with the queue's bound reported when exceeded.

## Context

ADOPT-1 landed the record, the import writer and the overlay (`adoption/mod.rs:52-164`,
`import/mod.rs:151-188`, `derivation/mod.rs:76-128`); the `adoption` namespace is written only by the
import-completing transaction (`store/transaction.rs:408-420`), keyed on the import, not an `IntentKind`.
Capture: `ItemRecord` `store/model.rs:45-55` (free `kind`, no phase), no MCP operation appends;
`capture_report` `config/mod.rs:78-91` cannot veto (`:77`). Common setup and the progress text grammar: PLAN-1.md, the two sections of those names.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T1-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_first_touch_declares_ticked_phases_it_cannot_derive -- --exact",
        "expected": {
          "kind": "literal",
          "value": "Rows: `phase 1: First - complete - UAT 1 pass, 0 fail`; `phase 2: Second - complete (declared at import, unverified) - UAT 2 pass, 1 fail`; `phase 3: Third - complete (declared at import, unverified)`; `phase 4: Fourth - planned - plans 1`; `Issues: 0`. `execute-next` 4 is not `state-conflict` (it reaches `missing-delimiter`, the legacy body wall). `d1` refused `rule: \"declaration-unneeded\"`, `id: \"complete\"`; `d4a` refused `rule: \"declaration-unticked\"`, `id: \"ROADMAP.md:5\"`; `d4` ok with `provenance` `declared-at-adoption`, `roadmap.line` 5, `roadmap.entry` 3, `derived.status` `planned`, `claims` `[]`; the replay equals it with `replayed: true`; progress then shows `phase 4: Fourth - complete (declared at adoption, unverified)` and `execute-next` 4 is not `state-conflict`. Second project: `rule: \"declaration-native\"`, `id` = the completion id. The hand-built record is refused `invalid-patch`. Reopened `adoption.declared_completions`: phases 2 and 3 `declared-at-import` (lines 3, 4; entries 1, 2; `roadmap.digest` = sha256 of the ROADMAP bytes read at import; phase 2 `human_results {present:true,pass:2,fail:1,skipped:0}`, phase 3 null) and phase 4 `declared-at-adoption`; none for phase 1. Every document byte identical except the test's tick; `phases/2/UAT.md` keeps its `status: fail` line."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_first_touch_declares_ticked_phases_it_cannot_derive"
        },
        "setup": "Legacy `.planning` built in `support/phase14.rs` (extend `tests/adoption_import.rs:41-59`): phases 1-4 declared, 1-3 ticked; phase 1 SUMMARY plus UAT all pass; phase 2 SUMMARY plus UAT with two pass, one `status: fail`; phase 3 PLAN-1 only; phase 4 unticked with PLAN-1; one commit; every document byte manifested. A second project `Completed::new()` verified and completed supplies a completion id.",
        "call": "First touch via `progress`; `execute-next` 4; `adoption-declare` 1 (`d1`) and 4 unticked (`d4a`); tick phase 4, `adoption-declare` 4 (`d4`), replay `d4`, `progress`, `execute-next` 4; second project `adoption-declare` 13; a hand-built record under `adoption-record`; restart; `reopened`.",
        "boundary": "real import at first touch, real derivation, real store transaction, real stdio refusals; records read from the reopened journal",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "A skipped ticked phase, a record for a derivable or unticked phase, a caller-written record, a hidden provenance word or an edited document byte would break honest adoption.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "A skipped ticked phase, a record for a derivable or unticked phase, a caller-written record, a hidden provenance word or an edited document byte would break honest adoption."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T1-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/adoption_service.rs",
          "crates/cadence/src/adoption/mod.rs AT_ADOPTION",
          "crates/cadence/src/store/transaction.rs adoption intent"
        ],
        "substance": "The owner-run adoption-declare operation: content computed from the documents, provenance declared-at-adoption, its own admitted intent, the three D-137 refusals, replay."
      },
      "reason": "Without it an early adopter or a post-import tick is walled by state-conflict forever.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Without it an early adopter or a post-import tick is walled by state-conflict forever."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T1-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/progress/render.rs declared completion row"
        ],
        "substance": "The row spelling a declared completion with its provenance word, unverified, and its UAT counts."
      },
      "reason": "Hiding the provenance word or the failed UAT count shows an adopted phase as verified.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "Hiding the provenance word or the failed UAT count shows an adopted phase as verified."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P14-T5-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound -- --exact",
        "expected": {
          "kind": "literal",
          "value": "`c1`-`c3` ok: `item.kind` and `item.text` as sent, `item.phase` 13 for `c1` and absent otherwise, `item.revision` 1, `item.disposition.status` `captured`, `replayed: false`; `captures` reads `{active:1,bound:2,exceeded:false}`, `{active:2,bound:2,exceeded:false}`, `{active:3,bound:2,exceeded:true}`. The replay equals the first answer with `replayed: true`; reopened `items` hold exactly three records equal to the handwritten ones. `c4` refused `rule: \"capture\"`, `slot: \"phase\"`; `c5` `slot: \"phase\"`, `id: \"99\"`; `c6` `slot: \"text\"`. Progress contains `Captures: 3 active of 2, over bound`. HEAD unchanged; no CAPTURE.md. `cadence capture-instructions` stdout equals `skills/cad-capture/SKILL.md`."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_capture_records_items_and_reports_the_bound"
        },
        "setup": "`Completed::published(false, prepare)` (`support/phase13.rs:503-561`); `prepare` adds `\"planning\":{\"max_capture_bullets\":2}` to `.planning/config.json` beside the review triggers, so the bound is 2 after import. Record `git rev-parse HEAD`; no `.planning/CAPTURE.md`.",
        "call": "`capture` `{kind:\"todo\",text:\"wire the bound\",phase:13,request_id:\"c1\"}`, `{kind:\"seed\",text:\"a global queue\",request_id:\"c2\"}`, `{kind:\"note\",text:\"read once\",request_id:\"c3\"}`; replay `c1`; `c4` seed with phase 13, `c5` todo with phase 99, `c6` note with empty text; `progress`; restart; `reopened`, read `items`.",
        "boundary": "real capture apply over stdio, real item journal reopened, real progress answer, real Git HEAD",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "Dropping kind or phase, changing identity on replay, accepting a bad phase, or hiding the exceeded bound would break what the owner sees after a capture.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Dropping kind or phase, changing identity on replay, accepting a bad phase, or hiding the exceeded bound would break what the owner sees after a capture."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T5-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/capture_service.rs",
          "crates/cadence/src/store/model.rs ItemRecord.phase"
        ],
        "substance": "The capture operation: a typed ItemRecord with kind and declared phase, slot-named refusals, replay, the capture report on every receipt."
      },
      "reason": "Without the typed phase a capture can only be listed by parsing prose.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Without the typed phase a capture can only be listed by parsing prose."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T5-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/capture/instructions.rs",
          "skills/cad-capture/SKILL.md"
        ],
        "substance": "The compiled cad-capture front door: one call, receipt shown, no CAPTURE.md, no commit."
      },
      "reason": "A door running planning.mjs would write prose the binary never reads.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "A door running planning.mjs would write prose the binary never reads."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Render declared completions; serve adoption-declare

- **Files:** the lease; new `adoption_service.rs`.
- **Action:** Deliver P14-T1-C, P14-T1-A1, P14-T1-A2. Progress renders a declared phase
  from the overlay label (`derivation/mod.rs:86-88`) with its UAT counts. Add `cadence_apply
  {"operation":"adoption-declare","phase":N,"request_id":..}`: read ROADMAP.md and the phase documents
  through the import's guarded reader, run the legacy table (`derivation/mod.rs:141-143`), build the
  record with `adoption::record` under a new `adoption::AT_ADOPTION = "declared-at-adoption"`, commit
  through `adoption::contribute` in a `CompareTransact` whose new `IntentKind` is the only non-import
  intent the gate admits; the caller supplies phase and request id only. Refuse in the typed shape: derivable phase `declaration-unneeded` (`id` = derived status), unticked
  `declaration-unticked` (`id` = `ROADMAP.md:<line>`), native completion `declaration-native` (`id` =
  completion id, `verification/completion.rs:99-106`). Replay returns the original receipt; a changed
  payload is `request-id-reuse`; a caller-supplied record stays an unknown operation.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_first_touch_declares_ticked_phases_it_cannot_derive -- --exact`.

### Task 2: Capture items with kind and phase; report the bound

- **Files:** the lease; new `capture/`, `capture_service.rs`.
- **Action:** Deliver P14-T5-C, P14-T5-A1. Add `phase: Option<u32>` to `ItemRecord`
  (`#[serde(default, skip_serializing_if = "Option::is_none")]`), part of the identity `validate_items`
  refuses to change; recall filters by it (D-144). Add `cadence_apply {"operation":"capture",
  "request_id":..,"kind":"todo"|"seed"|"note","text":..,"phase":N?}` appending `ItemRecord {version 1,
  revision 1, origin {source "capture"}, kind, text, phase, Captured, completed false, filing_uncertain
  false}` with an id digested from the request. Refuse `rule: "capture"` with the slot: blank or
  control-byte `text`; `kind` outside the three; `phase` on seed or note; `phase` ROADMAP does not declare.
  The receipt carries the item, `replayed` and `captures {active,bound,exceeded}`; replay appends
  nothing; over the bound lands with `exceeded: true`. No commit, no CAPTURE.md.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound -- --exact`.

### Task 3: Compile the cad-capture front door

- **Files:** `capture/instructions.rs`, `main.rs`, `skills/cad-capture/SKILL.md`.
- **Action:** Deliver P14-T5-A2. `cadence capture-instructions` renders `capture::instructions::markdown()`;
  regenerate `skills/cad-capture/SKILL.md`: one `capture` call with a fresh request id, show the item and
  bound, never edit CAPTURE.md, never commit, never a phase with seed or note, `--cadence` parked;
  `mcp__cadence__cadence_apply` and `cadence_query` only.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound -- --exact`.

## Notes

Execution rules: PLAN-1.md Notes. `declaration-native` uses a second project, `Completed::new()` verified and completed
(`tests/phase13_verification.rs:729-734`); P4 stays untested without an older binary, the same code path
is exercised on a row ticked after import.
