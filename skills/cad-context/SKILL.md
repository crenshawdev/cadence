---
name: cad-context
description: "Discuss a phase's scope, decisions and truths with its owner, then publish only the exact approved set through Cadence"
argument-hint: "[phase number]"
allowed-tools:
  - AskUserQuestion
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

You are the context author. Discuss the phase with the owner and submit their
approved context through the running Cadence binary. The binary owns publication.
Keep the draft in the conversation. Never write CONTEXT.md, STATE.md, native
store records, configuration, session tokens, or any other planning file directly.
Never invoke a legacy planning writer or a post-write acceptance gate.

## Read the phase and its priors

Use the requested positive integer phase number. If it is missing, resolve it
with the owner before authoring. Call `mcp__cadence__cadence_query` with:

```json
{"operation":"context-intake","phase":11}
```

The operation is bound to the project's running `cadence serve` session. Do not
send another root or filesystem destination. A successful intake has `status: ok`,
`operation: context-intake`, `phase`, bounded `context` and `roadmap` identity
references (or null), `contract` (the submission schema), and `persisted: false`.
Call `document` with each returned identity and no part to obtain its bounded part
index, then call it again with the selected part. Intake does not return document
bytes, initialize storage or recover pending work.

Read the phase scope and priors through `document`, and inspect relevant existing
project documentation or code through `search`, `read`, and `document` on the
same Cadence query surface when it helps clarify a decision. Never originate a
path or open a project file directly. Resolve missing scope with the owner. Discuss unresolved choices in
small, relevant questions. Distinguish decisions that should carry forward from
phase-local decisions. Retain the owner's authored prose, Markdown, evidence
citations, ordering and flagged assumptions. Do not replace them with a template.
Do not dispatch an analyzer, change the roadmap, allocate new phases, mutate a
cursor, or start planning/evidence-map work during this interview.

## Assemble the complete draft

The apply operation is `context-submit`. Its `submission` contains `phase`,
`title`, `scope`, `durable_decisions`, `decisions`, `assumptions`, and `truths`.
Each decision is `{id, text}`. Assumptions are authored strings. The two decision
sections share one phase identity scope with all the truths. Use distinct full
IDs throughout that phase; T1 and D-01 differ even though their suffixes match.
Another phase may reuse the same spellings. This operation publishes a phase's
first native-approved context; it does not revise an existing native approval.

Collect one through seven truths, each with `id`, `trigger`, `observer`, `verb`,
`outcome`, `kind`, `observable`, and `fixed_oracle`. The binary renders:

    When <trigger>, <observer> <verb> <outcome>.

Submit slots, never a separately supplied final sentence. Each sentence promises
one trigger, one observer and one outcome. All five sentence slots must be
nonblank strings. `verb` is exactly `sees`, `gets`, or `is refused`; `kind` is
`literal` or `property`. The trigger cannot contain the literal delimiter
` or `. The observer cannot contain ` and `, ` & `, a comma, or a semicolon:
these are mechanical conjunction/list rules, not natural-language understanding.
An outcome clause may only sharpen the same outcome, never add another promise.
Eight truths require the owner to split the phase; never truncate or split it
automatically. Do not quietly change the promise to fit the budget.

For EVERY truth ask the owner to attest separately:

- `observable: true`: the outcome is observable from outside, not merely an
  implementation internal.
- `fixed_oracle: true`: the expected answer is fixed independently of model
  prose; it does not come from a model call.

These are the owner's judgments. The binary cannot reliably infer them from
internal names or prose. Missing or false attestations are refusals; do not
infer either from the other, from approval, or from your own confidence. There
is no third attestation and no model or keyword classifier deciding the oracle.
Discuss a refusal with the owner and correct the promise or attestation honestly.

To validate a complete draft call `mcp__cadence__cadence_apply` with:

```json
{
  "operation": "context-submit",
  "submission": {
    "phase": 11,
    "title": "First approved context",
    "scope": "The owner's agreed scope.",
    "durable_decisions": [{"id":"D-01","text":"The owner's durable decision."}],
    "decisions": [{"id":"D-02","text":"The owner's phase-local decision."}],
    "assumptions": [],
    "truths": [{
      "id":"T1", "trigger":"the owner opens the context", "observer":"the owner",
      "verb":"sees", "outcome":"the approved decisions", "kind":"literal",
      "observable":true, "fixed_oracle":true
    }]
  }
}
```

The values above illustrate the wire shape; obtain the actual values and both
attestations from the owner. An `ok` draft response has `operation: context-submit`,
`phase`, `persisted: false`, `validation: draft`, `submission_digest`, and
`revision`. The submission digest binds approval to the exact typed set; revision
is the SHA-256 of the CONTEXT.md the binary rendered. The response contains no
document. Keep the reported submission digest with the draft. Draft success is
not publication.

## Present the exact set and obtain approval

Compose `{kind: "context-draft", phase: <the draft's phase>,
digest: <submission_digest>}` from the draft response. Call `document` with that
identity and no `part`, then read every returned part in index order. The parts
partition the complete rendered context; concatenating them gives exactly the
bytes publication installs. Show the owner those rendered parts, along with
every truth's kind, full ID and both attestations from the final submission.
Ask for explicit approval of this exact complete set. Record the
approving owner's identity and the observed approval time (an ISO 8601 timestamp);
do not invent either. Any content change needs renewed approval of the changed set.

Only after that approval, send:

```json
{"operation":"context-submit","phase":11,"approval":{"approved":true,"owner":"<owner>","at":"<approval time>","submission_digest":"<the digest the draft reported>"}}
```

Omit `submission` both at the top level and inside `approval`: the resident
publishes the held submission bound to that digest. Any content change needs a
fresh draft, reading and showing its parts, and renewed owner approval before
using its digest. The digest binds the set; it does not supply the owner's approval.
Approval of a subset, a mismatched binding, an empty owner or a missing time is
insufficient.

If approval is missing, stop without submitting an approved request. An explicit
decline can be represented by `approval: {"approved": false}` and also ends
without writing. Never publish to preserve interview progress. The prior files
must remain unchanged when the interview ends without approval.

Wait for `status: ok`, `operation: context-submit`, `persisted: true` before
telling the owner the context landed. This acknowledges the confirmed transaction
of CONTEXT.md and its native truth/approval records. A pending or failed write is
not success. On an uncertain response, retry only the exact original approved
request; do not invent a new approval identity or time. Exact durable retries do
not create another approval. Version 1 and pending truth status are assigned by
the binary; do not submit truth-status changes.

## Handle typed refusals

A refusal is a successful MCP response with `status: refused`, `code`, `reason`,
`rule`, `slot`, `phase`, `entry` (zero-based within the named section), and `id`.
The compact draft refusals below carry `identity` instead of those location slots.
Set-level refusals have no affected entry. Explain the named fault and ask for the
owner's correction; keep their unaffected promises intact. Resubmit through the
same binary operation. Never work around a refusal by editing a file directly.

- `stale-draft`: read the returned newest draft `identity` and changed `part`,
  then read and show the complete newest draft and obtain fresh owner approval
  of its digest. Never silently substitute the newer digest.
- `unknown-draft`: the returned identity is `phase-context`. Drafts are held only
  in memory and restart loses them. Create a fresh draft, read its parts and
  obtain approval again before publishing.
- `required-slot`, `one-trigger`, `one-observer`, `allowed-verb`, `allowed-kind`:
  correct the named sentence slot or identity.
- `unobservable` / `observable` and `prose-oracle` / `fixed_oracle`: revisit the
  named truth and its distinct owner attestation.
- `seven-truths` / `truths`: explain "split the phase" and end this publication
  attempt until the owner resolves the phase boundary.
- `identity-collision`: identify the full ID, phase and `truths.id`,
  `durable_decisions.id`, or `decisions.id` slot. Do not renumber silently.
- `exact-set-approval` / `approval`: present the actual full set again and obtain
  the missing or corrected approval evidence.
- `native-context-exists`: a first approval already exists; revision is outside
  this operation. Do not overwrite it.
- `submission` or `phase`: correct the request against the intake's contract.

Treat `unknown`, `not-applicable`, transport errors, and storage errors as an
unsettled operation; report what happened without claiming publication. If any
owner decision is needed, keep the draft in the conversation while discussing it.

## Live-host evidence

The interview's quality, host loading and the quality of owner attestations are
knowingly untested. O1 is the owner's real-host observation: the interview reaches
the binary, a deliberately malformed truth produces a typed refusal in the
conversation, and the approved set lands with nothing written before approval.
Preserve an actual observer/date/seen record when supplied; never invent one or
substitute a test of this Markdown. O1 remains an observation and caps the related
truths at concerns even when seen.

## Compiled submission schema

The schema below and the intake's `contract` come from the same compiled types.
The role has no disk instruction loader or user override.


## Shared read contract

Cadence is the only project read surface. Use `cadence_query` with `search` to find source, `read` only with a location or file reference Cadence issued (or a named unit under that reference), and `document` with a process identity to inspect contexts, plans, roadmap rows and task summaries. Never open a project file with a host file tool, shell command, standalone excerpt server, or a path/range invented by the caller.

`search` accepts `{"operation":"search","pattern":"needle","scope":{"kind":"project"}}`; directory and glob scopes use `{"kind":"directory","selector":"src"}` and `{"kind":"glob","selector":"**/*.rs"}`. A named scope supplied by Cadence, such as `{"kind":"current-task-lease",...}`, must be copied unchanged. `list` takes the same `scope` and no pattern, and returns the files in it, each with a `file_reference`. Follow a hit with `{"operation":"read","location":"<issued location>"}`. For a large file, read its issued `file_reference` to receive an outline, then pass that same `file` with one returned unit name; a file at or under 24KB, or one with no grammar, comes back whole from its `file_reference`. A bounded search answer carries a `cursor`; repeat the identical search with that cursor to continue. Follow `continuation` locations exactly; never guess a range or request a whole file by path.

Process records never use file paths. Call `document` with an identity such as `{"kind":"phase-context","phase":31}`, `{"kind":"phase-plan","phase":31,"plan":2}` or `{"kind":"dispatch","id":"<issued id>"}` and no `part` to get its bounded index, then repeat the identity with a returned part such as `truth:T1`, `task:P31-2-T1`, or `row`. Dispatches serve identity, goal, context, notes, tasks, allocated checks, completed history, continuation, suite, lease, commands, policy and route. Phase plans also serve their typed goal, context, notes and `evidence:<item id>` parts. When native execution records exist, their `execution` part serves the same plan state as `execution-history`, including `round` (dispatch_id, host, tokens, wire_bytes, owner, at and request_id) and `completion` (suite_run, request_id and the settlement material base/head). The `round` and `completion` fields are omitted until their events are recorded. Follow numbered continuation parts such as `notes:2` in index order; each is at most 24,576 bytes. A `dispatch-superseded` refusal identifies the changed slot and current issued id. `document-search` takes a `phase` and a `pattern` and returns which parts of that phase's records match, as identities and parts for `document`, without bodies. A refusal's issued location or identity is the only address for inspecting the named fault. Main threads and workers use this same contract on the already configured Cadence MCP connection; a worker must not define or launch another server.

Drafts use `{"kind":"plan-draft","phase":N,"plan":k,"digest":"<submission_digest>"}` or `{"kind":"context-draft","phase":N,"digest":"<submission_digest>"}`. Compose each plan identity from the draft answer's `documents[i].identity.phase`, `documents[i].identity.plan` and `submission_digest`; compose a context identity from its phase and `submission_digest`. No extra draft-identity field is returned. Call `document` without `part`, then read every returned part in index order and show those rendered parts to the owner before approval. Draft parts concatenate byte for byte to the rendered document. After explicit approval, send `plan-submit` or `context-submit` with `phase` and `approval: {approved: true, owner, at, submission_digest}`, with no `submission`. Drafts live only in the resident's memory and are lost on restart. A `stale-draft` refusal names the newest draft `identity` and changed `part`; read that location and obtain fresh approval of the complete newest draft. An `unknown-draft` refusal names the phase identity; create and read a fresh draft before requesting approval again.

For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed. The dispatch that installed the layer required direct project reads and is not the qualifying round; Codex is not a supported measurement host. Select the actual round boundaries from the host episode, then call `document` with `{"kind":"planner-round","phase":31,"session_id":"<Claude session UUID>","first_turn":"<actual first-turn UUID>","last_turn":"<actual last-turn UUID>"}` and part `report`. Show the owner that binary report unchanged, including its host/session/turn/worker boundaries, source digest, `read_count`, `whole_file_reads`, `unclassified_reads`, the four raw token components and `token_total`, and the numerical difference and ratio against `baseline_planner_median: 183000`. Missing, incomplete, ambiguous, nonzero whole-file or nonzero unclassified results are evidence to retain, never values to replace or a model-authored pass. The historical median's raw samples and aggregation procedure were not supplied, so claim like-for-like savings only after that procedure is confirmed.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Apply",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "phase": {
          "type": [
            "integer",
            "null"
          ],
          "format": "uint32",
          "minimum": 1
        },
        "submission": {
          "anyOf": [
            {
              "$ref": "#/$defs/Submission"
            },
            {
              "type": "null"
            }
          ]
        },
        "approval": {
          "anyOf": [
            {
              "$ref": "#/$defs/Approval"
            },
            {
              "type": "null"
            }
          ]
        },
        "operation": {
          "type": "string",
          "const": "context-submit"
        }
      },
      "additionalProperties": false,
      "required": [
        "operation"
      ]
    }
  ],
  "$defs": {
    "Submission": {
      "type": "object",
      "properties": {
        "phase": {
          "type": "integer",
          "format": "uint32",
          "minimum": 1
        },
        "title": {
          "type": "string"
        },
        "scope": {
          "type": "string"
        },
        "durable_decisions": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Decision"
          }
        },
        "decisions": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Decision"
          }
        },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "truths": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TruthSlots"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "phase",
        "title",
        "scope",
        "durable_decisions",
        "decisions",
        "assumptions",
        "truths"
      ]
    },
    "Decision": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "id",
        "text"
      ]
    },
    "TruthSlots": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "trigger": {
          "type": "string"
        },
        "observer": {
          "description": "One party: the literal separators \" and \", \" & \", comma and semicolon are refused.",
          "type": "string"
        },
        "verb": {
          "$ref": "#/$defs/Verb"
        },
        "outcome": {
          "type": "string"
        },
        "kind": {
          "$ref": "#/$defs/Kind"
        },
        "observable": {
          "description": "Owner attestation, never an internal-name classifier.",
          "type": "boolean"
        },
        "fixed_oracle": {
          "description": "Separate owner attestation; approval or observability cannot imply it.",
          "type": "boolean"
        }
      },
      "additionalProperties": false,
      "required": [
        "id",
        "trigger",
        "observer",
        "verb",
        "outcome",
        "kind",
        "observable",
        "fixed_oracle"
      ]
    },
    "Verb": {
      "type": "string",
      "enum": [
        "sees",
        "gets",
        "is refused"
      ]
    },
    "Kind": {
      "type": "string",
      "enum": [
        "literal",
        "property"
      ]
    },
    "Approval": {
      "type": "object",
      "properties": {
        "approved": {
          "type": "boolean"
        },
        "owner": {
          "type": [
            "string",
            "null"
          ]
        },
        "at": {
          "type": [
            "string",
            "null"
          ]
        },
        "submission": {
          "description": "The approved submission. On the wire the owner may bind by\n`submission_digest` instead; the binary fills this copy before it\nrecords the context, so retained records always carry it.",
          "anyOf": [
            {
              "$ref": "#/$defs/Submission"
            },
            {
              "type": "null"
            }
          ]
        },
        "submission_digest": {
          "description": "The digest of the exact submission, as `context-submit` reports it on\na draft answer. Either binding proves the same thing; the digest spares\nthe caller a second copy of the whole context set.",
          "type": [
            "string",
            "null"
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "approved"
      ]
    }
  }
}
```
