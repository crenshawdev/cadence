# Phase 32: Typed authoring and rendering

## Scope boundary

Boundary-fix rules 1 to 4, 6 and 7 (docs/architecture/boundary-fix.md) applied to the two authoring operations. context-submit and plan-submit take typed pieces only. A plan submission carries goal, context and notes as prose slots, tasks as id, title, files, action and verify, the evidence map, requirements, files, directories and the suite; the Markdown body (crates/cadence/src/plan/model.rs Content.body) is removed. The binary renders CONTEXT.md and PLAN.md, frontmatter and every section, from the pieces, exactly as it renders CONTEXT.md today (crates/cadence/src/context/render.rs), and is their only writer. A submission answer carries the digest of the rendered draft and identities the owner can read through document (phase 31, D-148); it never carries the document, old_section or section that plan-read returns today (crates/cadence/src/plan_service.rs:342). Approval carries owner, time and digest for both operations; plan approval already does (crates/cadence/src/plan/model.rs:72), context approval echoes the whole submission (crates/cadence/src/context/model.rs:50). A digest of a draft that has changed since is refused with the location of the change. Records from phases 27 to 29 are unchanged underneath: the binary fills the retained submission copy before it records, as plan-submit does today. Phase 31's T6 is re-specified here for a worker in a Claude host, without the Codex worker leg, and the ignored test and four clippy lints in crates/cadence/tests/support/phase31_hosts.rs are resolved. Closes with the wire bytes for publishing a six-plan phase against the 113KB sent twice on 2026-09-12. Lease: crates/cadence/src/plan/, crates/cadence/src/plan_service.rs, crates/cadence/src/context/, crates/cadence/src/context_service.rs, crates/cadence/src/server.rs, the skills the binary renders, and their tests.

## Durable decisions

- D-178. A plan submission is typed pieces only: goal, context and notes as prose slots; tasks as {id, title, files, action, verify}; the evidence map as phases 28 and 29 defined it; requirements, files, directories and suite as today. There is no body and no path. The binary renders PLAN.md from the pieces and is its only writer. If wrong: the model authors Markdown again and a document crosses the wire.
- D-179. Approval binds by digest for context-submit as it does for plan-submit: the draft answer carries the digest of the rendered draft, the approval carries owner, time and submission_digest, and the binary fills the retained submission copy before it records so retained records keep their shape. If wrong: the approval costs the whole submission a second time, or a retained record loses its copy.
- D-180. A submission answer echoes nothing. A draft or preview answer carries the digest, the target identities and the digest of each rendered document; the owner reads a rendered draft through document by identity before approving. The rendered document, old_section and section fields are removed from the wire. If wrong: the answer is the document again and 4.0 costs more tokens than 3.7.
- D-181. A stale approval is refused with a location. When the approval's digest does not match the draft the binary now holds, the refusal names the identity and part where the held draft differs from the digested one, and nothing is written. If wrong: the owner approves a draft they did not read, or learns only that something changed.
- D-182. Retained publications, approvals, map history and receipts from phases 27 to 29 are unchanged in shape and bytes. Replay of a historical request under the same id answers as it did before this phase. If wrong: a store written before phase 32 reads differently after it.

## Decisions

- D-183. Phase-local. Phase 31's T6 (a worker reads through the binary from its own host and gets the main thread's answer) is re-specified here as T6 for a worker in a Claude host only; the Codex worker leg is dropped, since a Codex worker launches its own resident and cannot share the main thread's session. The test ignored under D-172 and the four clippy lints in crates/cadence/tests/support/phase31_hosts.rs are resolved in this phase, by a check that does not start an installed claude.
- D-184. Phase-local. The close measurement is the bytes on the wire, requests and answers, for publishing a six-plan phase through plan-read preview, plan-submit draft and plan-submit approval, compared with the 113KB plan set sent twice on 2026-09-12 (docs/architecture/boundary-fix.md:16). Bytes, not tokens, because that is what the 2026-09-12 figure measured.

## Truths

- T1. When the planner submits a plan as typed pieces, the planner gets the digest of the PLAN.md the binary rendered and no document in the answer.
- T2. When the context author submits a context as typed pieces, the context author gets the digest of the CONTEXT.md the binary rendered and no document in the answer.
- T3. When the owner approves a draft by its digest with owner and time, the owner sees the rendered document installed byte for byte equal to the draft read by identity.
- T4. When the owner approves with the digest of a draft that has changed since, the owner is refused with the identity and part where the held draft differs.
- T5. When a plan-submit request carries a Markdown body, the planner is refused with the slot named.
- T6. When a worker in a Claude host reads a draft by identity, the worker gets the same slice the main thread gets for that identity.
- T7. When phase 32 closes, the owner sees the wire bytes for publishing a six-plan phase beside the 113KB-twice figure of 2026-09-12.

## Flagged assumptions

- A rendered draft is held by the resident between the draft answer and the approval; a resident restart between the two requires a fresh draft, and that cost is accepted rather than persisting unapproved drafts to the store.
- The seven PLAN.md sections rendered today (frontmatter, Goal, Must be true when done, Context, Evidence map, Tasks, Notes) are the complete set; a plan that needs another section changes the renderer, never the wire.
- Wire bytes are a fair proxy for the token cost the roadmap names; the 2026-09-12 figure is bytes.
