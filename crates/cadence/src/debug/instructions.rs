//! Compiled debug role; the installed skill is only its rendering.
pub fn markdown() -> &'static str {
    static MARKDOWN: std::sync::LazyLock<String> = std::sync::LazyLock::new(|| {
        crate::help::table::render_description("cad-debug", r#"---
name: cad-debug
description: ""
argument-hint: "[list | status <slug> | continue <slug> | --diagnose] [symptom]"
allowed-tools:
  - Task
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<role>
Use the scientific method to investigate the symptom. The binary owns the
debug record and renders its protected Markdown projection. Every investigation
write uses a debug operation. Source edits are explicit owner-approved fix
steps. A resolved record records the caller's reproduction outcome; it does
not complete a phase or verify settlement.
</role>

<route>
Parse $ARGUMENTS:
- list: call cadence_query {"operation":"debug-list"}, show the open records
  with slug and symptom, then stop.
- status <slug>: call debug-status with slug, show the returned record, then stop.
- continue <slug>: call debug-continue with slug and resume from its record
  alone. Keep the recorded symptom, hypothesis identities, states, rank reasons,
  observations, attempt count and retained recall; do not ask the owner to repeat them.
- --diagnose: remove the flag and investigate the remaining symptom without
  applying a fix.
- Otherwise the remaining text is a new symptom.

Use cadence_query schema with tool apply or query and for set to the operation
name for its exact request shape. Debug mutations carry request field `request.request_id`, slug
and expected_version. Open uses expected_version 0; later steps copy the last
returned answer field `record.version`. Slugs contain 1..80 lowercase letters, digits or
hyphens, start with a letter and do not end with a hyphen. Supply no document
path. For new mutations choose distinct request IDs; retry an uncertain delivery
with the identical request_id and inputs. Changed-input replay is refused.

The Markdown at .planning/debug/<slug>.md is an output, never continuation
input. Never write or edit it, search it for status, or reconstruct a record
from it. Read project code with the host's own tools.
</route>

<method>
1. For a new session, capture the exact failing signal, reproduction and what
   success looks like. Ask only for missing information. Call debug-open with
   that symptom; it initializes status open and attempt_count 0.
   Show answer field `record.recall`'s backend, total and bounded results, with each snippet's
   source and phase when present. Preserve provenance and incomplete coverage;
   never invent a phase for a phaseless hit. Recall is candidate evidence,
   never a confirmed hypothesis. Under config key `memory.backend` none, the answer has no
   hits and reads no corpus; an unset key uses the schema default builtin.
   Continue presents the retained snapshot, even if the corpus or backend changed.
   For an explicit recall request, call cadence_query
   {"operation":"recall","query":"<words>","limit":5,"phase":1}, replacing
   the words and optional positive integer limit/phase with the owner's request.
   Omit phase for unfiltered recall. A phase filter excludes phaseless hits and
   applies before the result limit. A fresh query does not replace the snapshot.
2. Before the first hypothesis, consider the diagnostic patterns below.
   Record 2-5 plausible hypotheses through debug-hypothesis, each with a stable
   id, description, state and rank_reason. States are untested, testing,
   refuted and confirmed. Rank by likelihood and the cost of a discriminating
   check; prefer a cheap check that eliminates a whole class.
3. For the next hypothesis, predict what would be observed if it were true.
   Mark it testing with debug-hypothesis, retaining its identity and rank reason.
   Run the cheapest discriminating test, changing one variable at a time.
4. Call debug-observation immediately with the complete test and result and
   rules_in / rules_out hypothesis IDs (empty arrays when it decides neither).
   The binary records the observation and confirms/refutes those hypotheses in
   one transition. Distinguish a measured result from an inference.
5. A confirmed cause leads to the root cause report. Otherwise choose the next
   test from the evidence. When every hypothesis is refuted, form new hypotheses
   only from what the observations support. If no discriminating test remains,
   report the dead end and let the owner choose the next move.

Diagnostic patterns are a filter, not an assumed diagnosis:
- Stale or shadowed code: print the running path's filename/version and compare
  it to the code being inspected.
- Unexpected input: inspect raw boundary bytes, including whitespace, quotes
  and encoding.
- Swallowed errors: inspect catches, defaults and ignored return codes; expose
  the original failure once.
- Downstream overrides: inspect the effective value and its source at the
  consumer.
- Timing or initialization order: record sequence numbers around the suspect
  pair or serialize them once.
- Falsy valid values: try exactly zero, empty string and false.
- Boundary errors: try empty, one element and exactly the limit.
- Shared mutable state: isolate the case and vary the order of its neighbors.
- Environment differences: inspect cwd, interpreter and relevant environment
  values from inside the failing process without exposing secrets.
- Downstream symptoms: trace back to the first value already wrong.
- Recent changes: inspect the relevant history before expanding the theory.
A pattern without a matching signature and a cheap check does not earn the
top rank.
</method>

<consult>
After recording an attempt, hypothesis or observation, inspect answer field `record.consults`.
The binary records one offer per dead-end epoch when the attempt count reaches
config key `review.consult.attempt_threshold` or every member of a nonempty hypothesis list
is refuted. An empty hypothesis list is not a dead end. The effective merged
configuration must enable config key `review.consult.enabled` and assign a provider model at
config key `review.consult.tier`. Defaults are disabled, flagship tier, high effort and an
attempt threshold of 3. No configured provider model means no offer; there is
no claude-subagent consult. Reads and another failed attempt do not create a
second offer. A genuinely new recorded observation opens the next epoch;
repeating identical evidence does not.

For an offered entry whose epoch equals answer field `record.epoch`, show its recorded id,
provider/model and effort. Ask the owner to choose Consult or Keep going without
it. Wait for explicit owner acceptance or decline; an offer never spends tokens.
Read the debug-consult schema and call cadence_apply with operation debug-consult
and request {request_id, slug, expected_version, offer, epoch, decision}. Copy
answer field `record.version`, the offer id and its epoch; decision is accept or decline,
matching the owner's actual choice. Use a distinct request ID for each choice.
Decline is remembered for that epoch; do not repeatedly ask after a decline.

Acceptance journals its intent and the fenced, capped situation before the
native provider call. The situation comes from the recorded symptom, hypotheses,
observations and failed attempts. It is not a host-written prompt file. Report
success only from the persisted result: answer field `record.consults` contains the typed
angles, retained provider evidence or failure. Retry a lost acknowledgment with
the identical request ID and inputs. A debug-consult-pending refusal means the
accepted external spend has an uncertain result; show it unchanged and do not
send another request to repeat the spend. Status reads never retry the provider.

Returned angles are investigative suggestions, never automatic fixes, decisions
or resolutions. For each hypothesis, rationale and how_to_check, use the host's
own tools to ground it against the repository. Record which evidence supports
or refutes it, present the remaining options, and let the owner choose the next
check. A failed consult leaves the investigation open. New hypotheses and checks
still follow the scientific method above, and any fix still requires the owner's
explicit approval below.
</consult>

<resolve>
State the root cause with the confirming observation and the minimal proposed
fix. For diagnose-only, record the Root Cause Report using debug-observation,
leave the session open and stop without source edits or staging.

For a fix, show the exact source files and proposed edits. Obtain the owner's
explicit approval for those source edits and staging. Apply the owner-approved
fix, then have the host run git add -- with only those exact source paths.
Re-run the original reproduction and retain the actual test and result.
Call debug-resolve with resolution and reproduction {test, result, passed}.
Every fix attempt is a single deliberate step. Never loop fixes automatically.

Resolve risk-checks the actual index against HEAD under root-debug, with no
phase or plan. It retains Staged {base_id, index_id}: base_id is the actual
HEAD and index_id is git write-tree. The shared target is staged-tree with
the same base and index and head: null; never substitute a committed head.
A clean index or unstaged-only edit returns an empty index refusal. Show that
refusal, or any unanswered-surfaces, unavailable acquisition or changed-material
refusal, unchanged; none is a pass. Stage only the approved fix before retrying.

A confirmed checked match or checked inconclusive staged scan admits the shared
risk-surface reviewer. Inconclusive binary material dispatches; missing or
unchecked evidence does not. A conclusive nonmatch needs no fire and reaches
reproduction verification. Only after risk clearance does a successful
reproduction mark resolved; a failed reproduction records a failed attempt and
keeps the session open. debug-attempt separately records a failed attempt
{description, result}; do not count the same failure twice.

Read the retained answer field `record.review` join through debug-status or debug-continue:
it names the occurrence, exact material, observation, admission request and
issued fire. A same-fix retry resumes this coordination without a second scan
or fire. A blocking admitted fire keeps resolve pending; changed material
cannot inherit its clearance. Preserve the fire and refusal as pending.

For the issued fire, call cadence_query review-next with fire and follow
cad-review-delivery with caller debug and home reviews/<fire>. Preserve the
actual staged/null-head target. When review-next answers a host dispatch, run
that actual host Task once, wait, and forward the actual observations and
unchanged return through the shared delivery operations. There is no Rust
substitute reviewer and no host-written review records. Wait for the durable
return and satisfy its deferred obligations. Raw findings grant no permission
and do not settle the receipts rail. Preserve any refusal and its exact next
action; a pending blocking fire is not a resolved debug session.

Show every pending fire ID, returned original and finding identity, and the
actual findings from answer field `record.review.history`. review-original reads the retained
return by its original identity. Show accepted receipt IDs and consequences
beside the exact fire, base, index, surfaces and review_scope they name. Never
turn report prose into a review-return, adjudication or settlement record.

For a blocking fire, present the owner's choices: a real gate-pass supported by
its evidence_id, an explicit reasoned override, or one narrowed re-arm. Use the
risk-consequence schema: request_id and receipt {id, fire, consequence}, copying
the entire exact fire from answer field `record.review.history`. Gate-pass uses consequence
{kind:"gate-pass", evidence_id}; override uses {kind:"override", reason} with
the owner's actual nonblank reason. A blank override is refused. Neither raw
findings, an adjudication nor a deferral permission clears this debug gate.
Wait for durable acknowledgment, then read debug-status/continue to confirm the
accepted receipt. Retry an uncertain delivery with the identical inputs and ID.

For the one re-arm, obtain approval for the narrowed fix and stage only its
approved paths. Keep the same base, root-debug boundary and surfaces. Record a
new risk-check on the actual index, then read risk-status for its later confirmed
observation, requirement and actual nonempty review_scope. Admit the shared
review with caller debug, the same occurrence and home, round 2, that exact
staged-tree target and risk_observation request ID. Copy the issued child fire
ID into next_fire, binding it to that observation and requirement; retain the
actual narrowed paths and rearm_of naming the parent. Submit the parent's
risk-consequence {kind:"rearm", next_fire}, wait for acknowledgment, then submit
risk-fire for that exact child. Drive review-next and the actual child return
through the same delivery contract. A parent re-arm is not clearance: its child
still needs its own gate-pass or explicit reasoned override receipt.

After the narrowed round still fails, stop for the owner. Do not auto-loop or
re-arm the child. validate_rearm caps the child at one narrowed round; the
one-consequence rule separately refuses another consequence on the parent.
A newer clear scan does not erase an outstanding fire. Changed material cannot
reuse an earlier receipt. Only exact accepted settlement reaches reproduction
verification; preserve any pending findings and refusal until the owner acts.
Use no trace-count script. Shared triage-gate.md, review-triggers.md and the
historical re-arm cases remain for the workflows that still consume them.

@${CLAUDE_PLUGIN_ROOT}/skills/cad-review-delivery/SKILL.md
</resolve>

<recovery>
After /clear or a process restart, call debug-continue with the slug. Trust the
record even if its Markdown is absent or misleading. On a version refusal,
read debug-status and reconcile the new evidence before making a new request.
On an uncertain write, retry its identical request ID and inputs; never invent
a successful result. On a pending journal or unavailable record, report the
located refusal and preserve the stopped state for recovery.
</recovery>
"#).expect("compiled skill front matter")
    });
    &MARKDOWN
}
