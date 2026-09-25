//! The landing front door delegates permission and effects to the binary.
pub fn markdown() -> &'static str {
    static MARKDOWN: std::sync::LazyLock<String> = std::sync::LazyLock::new(|| {
        crate::help::table::render_description("cad-land", r#"---
name: cad-land
description: ""
argument-hint: "<landing id>"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

<process>
1. Require the identified landing id, then call cadence_query
   `{"operation":"land-read","landing":"<landing id>"}`. Show its exact id,
   generation, frozen source branch and commit, remote name and URL, and base
   branch and commit. Present the actual branch, ahead, dirty and remote state,
   the read-only tracker report, every deferred member and all retained step
   intents, authorizations and receipts. Report unavailable observations as such.
   Show `done`, including each receipt's observed remote ref/object or exact PR
   identity/state and reconciliation provenance, and the single `next_step`.
   If `resume` is present, send that typed land-resume payload unchanged to
   cadence_apply. It reads the actual remote before any unfinished step, records
   an existing effect once, and runs an absent effect only under the retained
   exact authorization. It grants no new permission. Show its receipt or exact
   discrepancy, then land-read again. A failed or ambiguous read stops without
   a success receipt or a repeated mutation. Reuse the same request on transport
   interruption; after resolving a retained discrepancy, read a fresh `resume`.
   If answer field `landing.release` is present, display its release id/digest, named manifest,
   version, exact tag and bump commit. Release confirmation grants no external
   authorization and creates no tag; use the updated source commit from this read.
2. For an external step, show the proposed exact step: push, open, merge or tag-push. Obtain its request
   schema through cadence_query `{"operation":"schema","tool":"apply","for":"land-authorize"}`.
   Show every input before asking: source and destination refs; for open, configured
   forge provider, repository, host and the complete proposed title/body; for merge,
   that same forge and the recorded PR identity; for tag-push, the exact tag and
   object id. Missing inputs require an owner answer. Configuration grants no
   permission. A different landing, version, step or changed head needs a fresh choice.
3. Only after the owner's explicit choice, record land-authorize through
   cadence_apply with a fresh request_id, the landing id and expected_generation,
   exact source/base/remote copied from land-read, that one step's inputs, and
   the actual owner's name and authorization time. Ask for missing attribution;
   never invent it. Declining stops without writing an authorization or running a step.
4. Send the returned `action` typed payload unchanged to cadence_apply. It invokes
   land-publish, land-open, land-merge or land-tag-push. Print the exact refusal or
   durable receipt, including landing, step and authorization identity, and read
   land-read again. A refusal stops. An uncertain intent requires reconciliation;
   return to step 1 for land-resume. Never invent success, replace a request_id
   to retry an effect, or retry blind. Repeated resume keeps the same step receipt.
   A reconciled MERGED state is not the owner's merge confirmation: show
   `confirm-merge` as the next step and obtain that record before any cleanup.
5. When `next_step` is `confirm-merge`, display the merged landing identity:
   landing id and generation, exact source/base/remote, the merge receipt's forge
   and PR number, and the observed merged commit at answer field `git.remote.base_head`.
   If an observation is unavailable, stop and show it; never guess a commit.
   Obtain the land-confirm-merge schema through cadence_query
   `{"operation":"schema","tool":"apply","for":"land-confirm-merge"}`.
   Ask the owner to explicitly confirm this merged PR/commit identity and the
   local cleanup choices: an annotated tag's exact name/message or no tag, and
   whether to reap the source branch. Show that checkout and pull precede those
   choices. Record only the owner's actual name and confirmation time; obtain
   missing attribution. A merge receipt or forge MERGED result grants no local
   cleanup permission. Declining leaves the confirmation absent.
   A bound release requires its exact release tag; show that name with the
   owner's annotation message. Its version confirmation does not confirm this
   merge or authorize cleanup. The binary refuses a changed or omitted release tag.
6. After explicit owner confirmation, call land-confirm-merge with a fresh
   request_id, landing id and expected_generation, copied source/base/remote,
   the exact `merged` forge/PR/commit identity, `tag` (name/message or null),
   `reap` (the owner's boolean choice), owner and at. Show the durable
   `confirmation` id and binding, then land-read again. A refusal stops.
7. With the confirmation recorded, send the returned `cleanup` typed payload
   unchanged to cadence_apply, one operation at a time: land-checkout,
   land-pull, land-tag, land-reap. Show each receipt's confirmation id,
   predecessor receipts, intended and actual ref identities, and done or
   explicit skipped state; then land-read and follow the returned next step.
   A declined tag or reap still needs its explicit skipped receipt. On transport
   interruption retry the identical local request; the binary inspects local
   refs, index and branch before repeating an uncertain effect. Print an exact
   refusal naming the uncontained source branch and base, including both tips;
   stop without suggesting forced deletion. Local cleanup preserves risk and
   deferred records and never files or changes tracker issues.
   For a bound release, land-tag rechecks the named manifest bytes/version and
   normalized version aliases on the pulled base before creating its tag.
   Report a collision or changed release basis exactly and stop. Never invoke
   release-bump.mjs or a raw tag command to bypass this refusal.
8. Tag push remains a separate external step. Show the exact annotated tag object
   from its receipt and obtain its own land-authorize grant through steps 2-4;
   the deferred-member gate still applies. A local tag or merge confirmation is
   not tag-push authorization. The binary owns every subprocess: do no raw push,
   PR creation, merge, checkout, pull, tag, shell branching or branch reap, and
   no tracker mutation or FILED write.
</process>
"#).expect("compiled skill front matter")
    });
    &MARKDOWN
}
