//! The undo front door presents the binary's exact manifest and receipts.
pub fn markdown() -> &'static str {
    static MARKDOWN: std::sync::LazyLock<String> = std::sync::LazyLock::new(|| {
        crate::help::table::render_description("cad-undo", r#"---
name: cad-undo
description: ""
argument-hint: "<phase> [--no-commit]"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

<process>
1. Require a positive integer phase. Preserve its value; reject missing,
   decimal, signed or fractional input. Call cadence_query
   `{"operation":"undo-read","phase":<integer>}`.
   Show the returned manifest id, source, occurrence and provenance, and every
   full hash in the exact ordered hash manifest, oldest to newest. The binary
   selects accepted native task-close completions, including the docs task.
   Only absent native execution permits the explicit SUMMARY manifest.
   An unreadable, malformed, ambiguous or unsupported manifest stops here.
2. Show the selected mode before asking for confirmation: committed by default,
   or --no-commit when the owner requested staged reversal. Committed mode
   creates one revert commit per hash in reverse manifest order and, after
   complete success, marks the execution undone and repairs its phase mirrors.
   --no-commit stages the exact reverse reverts, creates no commit, marks
   nothing undone and leaves phase documents and the cursor unchanged.
   Obtain the owner's explicit confirmation of this exact manifest and mode.
   A decline stops without an undo request.
3. Read the request schema through cadence_query
   `{"operation":"schema","tool":"apply","for":"undo-phase"}`.
   Send cadence_apply an identified request with a fresh request_id, the same
   integer phase, manifest set to the returned manifest id, and mode set to
   "committed" or "no-commit" according to the confirmed choice:
   `{"operation":"undo-phase","request":{"request_id":"<unique id>","phase":<integer>,"manifest":"<manifest id>","mode":"<confirmed mode>"}}`.
   The binary owns every effect and enforces its clean-tree and branch rails.
4. Report the actual undo id, manifest, mode, state and completed set. For each
   completed hash show its resulting commit or index identity. On conflict show
   the exact stopped hash, conflict paths and completed set, then stop. Preserve
   the real conflict state; run no later hash, reset, abort or forced continuation.
   On interruption retry the identical request_id and inputs. A retry recognizes
   persisted successful work; an uncertain invocation requires reconciliation
   and never authorizes a blind repeat. Do not replace the request id to bypass
   a refusal. A changed manifest or mode is not an identical retry.
5. After committed success, call cadence_query `{"operation":"progress"}`
   and show the binary's derived lifecycle and next action. Native history and
   evidence remain retained. Staged or conflicted undo performs no lifecycle
   reset. All commit selection, reversal and mirror repair belong to the binary:
   do no shell Git, scope-message fallback, raw phase-done --undo or cursor set.
   Local cleanup, tracker writes and publishing are separate operations.
</process>
"#).expect("compiled skill front matter")
    });
    &MARKDOWN
}
