---
phase: 14
plan: 2
requirements: ["T1","T5"]
files: ["crates/cadence/src/adoption_service.rs","crates/cadence/src/adoption/mod.rs","crates/cadence/src/capture_service.rs","crates/cadence/src/capture/mod.rs","crates/cadence/src/capture/instructions.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/src/store/model.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/import/mod.rs","crates/cadence/src/progress/render.rs","crates/cadence/src/progress_service.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/mcp.rs","skills/cad-capture/SKILL.md"]
directories: ["crates/cadence/src/adoption","crates/cadence/src/capture","crates/cadence/src/store"]
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P14-2-T1","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_first_touch_declares_ticked_phases_it_cannot_derive"]},{"id":"P14-2-T2","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound"]},{"id":"P14-2-T3","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound","cargo nextest run -p cadence --test mcp"]}]}
---
## Goal

Declared completions rendered by progress and writable by the owner's adoption-declare, never by a caller, with no document byte changed (D-135, D-137, D-142); captures as typed items with kind and phase and a reported bound (D-144).

## Must be true when done

- T1. When a tree whose roadmap ticks a phase the documents cannot derive complete is first touched, the owner sees that phase reported complete as declared at import with every document byte unchanged.
- T5. When the owner submits a capture, the owner sees it as a captured item with its kind and phase, with the queue's bound reported when exceeded.

## Context

D-135, D-137, D-142 and D-144 at the phase 14 context. ADOPT-1 landed the declared-completion record, the import writer and the derivation overlay: crates/cadence/src/adoption/mod.rs carries AT_IMPORT (`declared-at-import`), records() and contribute(); crates/cadence/src/import/mod.rs collects `declared: Vec<adoption::Declaration>` at first touch; crates/cadence/src/store/transaction.rs guards the adoption namespace so only the import-completing transaction writes it. There is no `declared-at-adoption` provenance and no caller operation. Capture: ItemRecord in crates/cadence/src/store/model.rs has a free `kind` and no phase; the writer appends through Operation::AppendItem in crates/cadence/src/store/writer.rs; no stdio operation appends an item; config::capture_report in crates/cadence/src/config/mod.rs reports active against a bound and cannot veto, and Session::capture_report in crates/cadence/src/import/mod.rs reads the bound from the config key planning.max_capture_bullets. The progress grammar and the common setup are in phase 14 plan 1 (context and notes parts). The 3.x cad-capture skill runs planning.mjs and writes CAPTURE.md; the 4.0 door calls one apply operation.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T1-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_first_touch_declares_ticked_phases_it_cannot_derive",
        "expected": {
          "kind": "literal",
          "value": "Progress rows after first touch: `phase 1: First - complete - UAT 1 pass, 0 fail`; `phase 2: Second - complete (declared at import, unverified) - UAT 2 pass, 1 fail`; `phase 3: Third - complete (declared at import, unverified)`; `phase 4: Fourth - planned - plans 1`; `Issues: 0`. execute-next 4 is not refused state-conflict (it reaches the legacy body wall). d1 is refused rule `declaration-unneeded`, id `complete`; d4a is refused rule `declaration-unticked`, id `ROADMAP.md:5`; d4 answers ok with provenance `declared-at-adoption`, roadmap line 5, roadmap entry 3, derived status `planned`, claims []; its replay equals it with replayed true; progress then shows `phase 4: Fourth - complete (declared at adoption, unverified)` and execute-next 4 is still not state-conflict. The second project answers rule `declaration-native` with id equal to its completion id. The hand-built record is refused as an unknown operation. Reopened adoption.declared_completions after restart: phases 2 and 3 declared-at-import (lines 3 and 4, entries 1 and 2, roadmap digest equal to the sha256 of the ROADMAP.md bytes read at import; phase 2 human_results {present true, pass 2, fail 1, skipped 0}, phase 3 null) and phase 4 declared-at-adoption; none for phase 1. Every document byte is identical except the test's own tick of phase 4; phases/2/UAT.md keeps its `status: fail` line."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_first_touch_declares_ticked_phases_it_cannot_derive"
        },
        "setup": "A legacy .planning tree built in crates/cadence/tests/support/phase14.rs, extending the document builder in crates/cadence/tests/adoption_import.rs: phases 1 to 4 declared, 1 to 3 ticked; phase 1 SUMMARY.md plus UAT.md all pass; phase 2 SUMMARY.md plus UAT.md with two pass and one `status: fail`; phase 3 PLAN-1.md only; phase 4 unticked with PLAN-1.md; one commit; every document byte manifested. A second project, Completed::new() verified and natively completed, supplies a completion id.",
        "call": "First touch through progress; execute-next 4; adoption-declare 1 (d1) and 4 while unticked (d4a); tick phase 4 on disk; adoption-declare 4 (d4); replay d4; progress; execute-next 4; on the second project adoption-declare its completed phase; a hand-built record under an operation named adoption-record; restart; reopened.",
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
          "reason": "A ticked phase the documents cannot derive complete is first touched and the owner sees it reported complete as declared at import with every byte unchanged: T1's trigger and outcome."
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
          "reason": "It is the explicit path D-137 gives the owner when first touch has already passed."
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
        "substance": "The progress row spelling a declared completion with its provenance word, unverified, and its UAT counts."
      },
      "reason": "Hiding the provenance word or the failed UAT count shows an adopted phase as verified.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The row is what the owner sees; T1 names the provenance word."
        }
      ]
    },
    {
      "kind": "check",
      "id": "P14-T5-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound",
        "expected": {
          "kind": "literal",
          "value": "c1 to c3 answer ok: item.kind and item.text as sent, item.phase 13 for c1 and absent otherwise, item.revision 1, item.disposition.status `captured`, replayed false; captures reads {active 1, bound 2, exceeded false}, {active 2, bound 2, exceeded false}, {active 3, bound 2, exceeded true}. The replay of c1 equals the first answer with replayed true; the reopened items hold exactly three records equal to the handwritten ones. c4 is refused rule `capture`, slot `phase`; c5 rule `capture`, slot `phase`, id `99`; c6 rule `capture`, slot `text`. Progress contains `Captures: 3 active of 2, over bound`. Git HEAD is unchanged; no .planning/CAPTURE.md exists. `cadence capture-instructions` stdout equals skills/cad-capture/SKILL.md."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_capture_records_items_and_reports_the_bound"
        },
        "setup": "Completed::published(false, prepare) from crates/cadence/tests/support/phase13.rs; prepare adds planning.max_capture_bullets 2 to .planning/config.json beside the review triggers, so the bound is 2 after import. Record git rev-parse HEAD; no .planning/CAPTURE.md.",
        "call": "capture {kind todo, text `wire the bound`, phase 13, request_id c1}; {kind seed, text `a global queue`, request_id c2}; {kind note, text `read once`, request_id c3}; replay c1; c4 seed with phase 13; c5 todo with phase 99; c6 note with empty text; progress; restart; reopened, read items.",
        "boundary": "real capture apply over stdio, real item journal reopened, real progress answer, real git HEAD",
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
          "reason": "The owner submits a capture and sees it as a captured item with kind and phase, with the bound reported when exceeded: T5 word for word."
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
          "reason": "It is the operation that records the item T5 names."
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
        "substance": "The compiled cad-capture front door: one call, the receipt shown, no CAPTURE.md, no commit."
      },
      "reason": "A door running planning.mjs would write prose the binary never reads.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The door is how the owner submits the capture."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Render declared completions; serve adoption-declare

- **ID:** P14-2-T1
- **Files:** crates/cadence/src/adoption_service.rs, crates/cadence/src/adoption/mod.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/import/mod.rs, crates/cadence/src/progress/render.rs, crates/cadence/src/progress_service.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs
- **Action:** Deliver P14-T1-C, P14-T1-A1, P14-T1-A2. Progress renders a declared phase from the derivation overlay label with its provenance word and UAT counts. Add cadence_apply {operation: adoption-declare, phase: N, request_id}: read ROADMAP.md and the phase documents through the import's guarded reader, run the legacy completion table, build the record with adoption::record under a new adoption::AT_ADOPTION (`declared-at-adoption`), and commit through adoption::contribute in a compare-and-transact whose new intent kind is the only non-import intent the namespace guard admits; the caller supplies phase and request id only, the content is always computed from the documents. Refuse in the typed shape: a derivable phase `declaration-unneeded` (id = the derived status), an unticked phase `declaration-unticked` (id = `ROADMAP.md:<line>`), a natively completed phase `declaration-native` (id = the completion id from crates/cadence/src/verification/completion.rs records). Replay returns the original receipt; a changed payload under the same request id is `request-id-reuse`; a caller-supplied record is an unknown operation.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_first_touch_declares_ticked_phases_it_cannot_derive

### Task 2: Capture items with kind and phase; report the bound

- **ID:** P14-2-T2
- **Files:** crates/cadence/src/capture_service.rs, crates/cadence/src/capture/mod.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/src/store/model.rs, crates/cadence/src/store/writer.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs
- **Action:** Deliver P14-T5-C and P14-T5-A1. Add `phase: Option<u32>` to ItemRecord (serde default, skipped when none), part of the identity the writer's item validation refuses to change; recall filters by it (D-144). Add cadence_apply {operation: capture, request_id, kind: todo|seed|note, text, phase?} appending an ItemRecord {version 1, revision 1, origin source `capture`, kind, text, phase, disposition captured, completed false, filing_uncertain false} with an id digested from the request. Refuse rule `capture` with the slot named: blank or control-byte text; a kind outside the three; a phase on seed or note; a phase ROADMAP.md does not declare. The receipt carries the item, `replayed` and `captures {active, bound, exceeded}`; replay appends nothing; over the bound the capture lands with exceeded true. No commit, no CAPTURE.md.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound

### Task 3: Compile the cad-capture front door

- **ID:** P14-2-T3
- **Files:** crates/cadence/src/capture/instructions.rs, crates/cadence/src/main.rs, crates/cadence/tests/mcp.rs, skills/cad-capture/SKILL.md
- **Action:** Deliver P14-T5-A2. Add `cadence capture-instructions` rendering capture::instructions::markdown(); regenerate skills/cad-capture/SKILL.md from it: one capture call with a fresh request id, show the item and the bound, never edit CAPTURE.md, never commit, never a phase with seed or note, `--cadence` parked to a later phase; tools mcp__cadence__cadence_apply and mcp__cadence__cadence_query only. Extend the skill pin in crates/cadence/tests/mcp.rs.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_capture_records_items_and_reports_the_bound
  - cargo nextest run -p cadence --test mcp

## Notes

Execution rules: phase 14 plan 1, notes part. `declaration-native` uses a second project, Completed::new() verified and completed as crates/cadence/tests/phase13_verification.rs builds one, to supply a completion id. P4 (a store imported before ADOPT-1 existed) stays untested without an older binary; the same code path is exercised on a row ticked after import.
