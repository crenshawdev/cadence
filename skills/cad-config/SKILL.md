---
name: cad-config
description: "Configure supported settings through the native roles, cost and risk-floor interview."
argument-hint: "[--review [redetect] | --surfaces | --roles [--global] | <key>=<value> ...]"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - AskUserQuestion
---

<objective>
Relay native configuration facts and explicit user answers. The binary owns
first-touch initialization, supported keys, current values, presence, source
layers, target selection, validation and atomic persistence. The conversation
collects choices; it does not calculate configuration policy.
</objective>

<execution_context>
Use the installed grouped tools and their advertised schemas. Read structured
response fields directly. No project-file inspection is needed.
</execution_context>

<process>
1. Call `mcp__cadence__cadence_query` with
   `{"operation":"config-entry","tokens":[...]}`. Supply each original argument
   token as one string. With no arguments send `tokens: []`. Keep the exact
   characters in key/value tokens, including embedded spaces, quotes, equals
   signs and Unicode. Do not evaluate a shell expression, trim a value or
   rebuild a custom model name. The binary parses and validates the tokens.
2. On `status: "refused"`, `"unknown"` or `"not-applicable"`, display `code` and
   `reason` and stop. A transport failure also stops. For `config-unavailable`,
   display the named key, layer/path and repair-required diagnostic. Active
   invalid JSON requires external operator repair; this skill cannot repair
   it or retry a setter against invalid controlling config.
3. For `status: "ok"`, use `entry` and `facts` from the envelope. Display each
   `facts.retirement.originals` value exactly with its layer/path and alias,
   and the binary's plain retirement message. Disclose unavailable historical
   evidence when reported. Enter the ordinary questions using current settings;
   infer no equivalent spending profile and keep no retirement decision state.
4. Follow the returned entry:
   - `roles` (`--roles` or `--roles --global`): use `facts.interview` unchanged.
     Show all thirteen ordered subjects: six model choices, six effort choices
     and the floor. Include each purpose, cost explanation, current/default
     value, presence, source layer and validation constraints. Every invocation
     obtains all thirteen answers, including empty or partial stored roles.
     Host question batching changes neither order nor meaning. A role's null
     model answer inherits the session and cancels its older model pin; null
     effort selects its schema default and cancels its older effort pin.
     Missing stored leaves still permit legacy fallback during resolution.
     Higher starting effort can cost more; requested effort is not evidence
     of observed effort. Custom model compatibility belongs to dispatch.
     The floor answer "Keep it for every surface" is the literal JSON array
     `[]`, including when the current unanswered default is null. Never submit
     absence or null for this answer. After explicit acceptance of all answers,
     make one `mcp__cadence__cadence_apply` call with
     `{"operation":"config-interview-apply","mode":<returned mode>,
     "captured":<returned captured object>,"accepted":true,
     "answers":[{"key":<subject key>,"value":<literal answer>},...]}`.
     Copy keys in subject order and values field-for-field; do not calculate
     diffs or select a layer. On decline or an unanswered question, stop without
     applying. A stale-input refusal requires a fresh invocation and new answers.
   - `knobs` (no arguments): present `facts.keys` as selectable pages, showing
     current values, source layers and writable layers. Collect only explicitly
     accepted changes and their supported destination. For the roles group,
     continue with the ordinary interview above. For other selected knobs,
     make one atomic `config-apply` call with the selected `layer` and literal
     `updates: [{"key":...,"value":...},...]` after explicit acceptance.
   - `values` (key/value tokens, including an accepted suggestion): display
     the binary-prepared `entry.updates` and `entry.layer`. An explicit setter
     request is acceptance; a suggested value needs the user's explicit yes.
     For a declined or unanswered suggestion make no apply call. For acceptance,
     copy the prepared layer and updates into one `config-apply` call. Do not
     reinterpret token text or issue individual setters.
   - `surfaces` (`--surfaces`): query `detect-surfaces`, passing the current
     `review.triggers.risk_surface.surfaces` array from facts as `answered`
     (omit it when there is no answered array). Display the returned structural
     evidence and prepared top-level `options`; ask the user to choose or decline.
     On explicit acceptance, make one repo `config-apply` call updating only
     `review.triggers.risk_surface.surfaces` to the chosen literal array.
     Decline preserves the prior setting. This actual-diff selection is separate
     from the roles interview's plan-time floor waiver.
5. After an apply, display the returned changed keys, destination, requested
   layer and actual effective values with their source information. First run
   writes all twelve explicit role leaves and the floor globally. Later ordinary
   runs write repo role diffs, plus the deliberate empty-floor pin when needed.
   Explicit global editing reopens all thirteen against global settings. A
   global `[]` can be shadowed by a repo waiver: report the effective repo waiver
   and its source; never claim full protection or silently change the repo.
</process>

`--review [redetect]` remains recognizable. Its native entry returns
`review-setup-unavailable`: live-provider setup belongs to the later
review-delivery phase. Display that diagnostic and stop. Do not discover models,
invoke providers or claim provider readiness.

Intake callers reuse `config-interview` with mode `new-project` or `adopt`;
ordinary role suggestions can use mode `suggestion`. These modes use the same
thirteen-subject service and accepted batch. Their wider workflows are separate.
Only grouped native apply operations persist settings. Do not edit configuration
files, run a terminal interview over MCP stdio, or create another write path.
Live question delivery and host behavior remain manual observations.
