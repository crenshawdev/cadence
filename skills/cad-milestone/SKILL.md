---
name: cad-milestone
description: "Close and prune a milestone, or confirm an explicit release manifest bump before landing."
argument-hint: "<phase ids> <display label>"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

<process>
1. Select the owner's explicit nonempty set of positive integer phase ids,
   sorted without duplicates, a display label and a stable occurrence name.
   Ask for missing selection inputs. A milestone label is display text, never
   cad-audit's phase argument; never parse a label into phases. Call cadence_query
   `{"operation":"milestone-read","occurrence":"<occurrence>","selection":{"phases":[15,16],"label":"<display label>"}}`.
2. Show the returned close identity, generation (record version), immutable
   selection and label. Present every existing audit outcome with its integer
   phase identity, and every unsettled record by kind, phase and exact identity.
   milestone-read invokes verification-audit for each selected phase. Preserve
   those outcomes; invent no audit verdict or bypass. A refusal stops the action.
3. Obtain the owner's explicit choice to close only, close and prune, or leave
   the selection open. To close, send only the returned answer field `actions.close` typed payload
   unchanged to cadence_apply. Display the returned close record or exact refusal.
   Reuse the same request for a retry; changed inputs require a fresh read and
   owner choice. A ready close records readiness only; it changes no documents.
   Read milestone-read again with the same occurrence and selection. After the
   owner's choice to prune, send its returned answer field `actions.prune` typed payload
   unchanged to cadence_apply. This is milestone-prune: it names the ready close
   id, expected generation, exact phase selection and request_id. The binary
   owns every removal, document replacement and single-parent commit.
   A deferred member stays unruled: no ruling operation
   exists here. A later clear scan cannot erase an earlier risk obligation.
4. Close-only stops at the local milestone close. Landing is a separate explicit
   action with its own owner choice and returned operations; a close never grants
   external authorization. Do not perform landing as part of this door. If the
   owner requests retuning, cadence_query `{"operation":"suggest"}` is advisory:
   its output grants no permission to apply a proposal or to land.
5. Show the prune's exact selected phase set, durable id, state, commit, single
   parent and next action. After interruption, retry the identical milestone-prune
   request; the binary recovers its frozen journal before answering. Never replace
   the request_id, recompute the selection or perform a removal or commit yourself.
   A committed result replays its receipt. A located interference refusal stops
   the action. Prune writes no ARCHIVE.md and grants no landing authorization.
6. For an owner-requested release, obtain the explicit JSON manifest path and
   format, semantic version, exact v-prefixed tag and pending landing id. No
   default manifest is selected; ask for missing inputs. Read land-read for its
   current generation. If a landing has not been recorded, obtain land-start's
   schema and record the owner's exact source/base/remote selection first.
   Obtain the milestone-release schema with cadence_query
   `{"operation":"schema","tool":"apply","for":"milestone-release"}`.
   Send milestone-release through cadence_apply with a stable request_id,
   landing, expected_generation, version, tag and manifest {path, format:"json"}.
   This records a release read; it does not bump or tag. Show the named manifest,
   requested version/tag and any collision's exact tag and peeled commit. Show
   both drift values: manifest_version and answer field `newest.tag`/version/commit. A missing
   or unreadable input is a refusal, never evidence of an empty tag inventory.
7. Present the complete immutable release report, including id, digest, observed
   manifest bytes, tag inventory and HEAD. Ask the owner to confirm this exact
   report before bumping. Declining leaves the manifest unchanged. Only after
   that confirmation, obtain the milestone-release-confirm schema and send a
   fresh request_id, release (report id), digest, owner's actual name and at
   (confirmation time). Never invent attribution. Changed manifest, tags or
   HEAD require a fresh release report and a new owner confirmation.
8. Show the actual bump commit from the writer receipt and the bound release
   intent. After interruption, retry the identical request_id and inputs;
   re-reading the original milestone-release request returns its retained
   report. The bump updates only the explicitly named manifest and creates no
   tag. Version confirmation grants no publish permission. Leave the tag for
   cad-land's separately confirmed merge and ordered land-checkout, land-pull,
   land-tag step, which rechecks the release manifest and version collisions
   on the pulled base. Never invoke release-bump.mjs or create a tag yourself.
</process>
