pub fn markdown() -> &'static str {
    r#"---
name: cad-suggest
description: Show retune suggestions from retained decisions and apply only an accepted payload.
argument-hint: "[phase]"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
---

Call `mcp__cadence__cadence_query` once with `{"operation":"suggest"}`.
If a phase is supplied, require canonical positive digits and add `phase` as a
JSON integer. Refuse malformed input without rounding or selecting a default.
If the query is refused, show its exact code and located reason and stop.

Print every returned key, current value, proposed value and counted decisions
unchanged, including the decision ids and all evidence figures. For an unpriced
entry, print `priced: false` and its returned count and information; do not
invent a current or proposed value that the answer omits.

Show each priced entry's exact `apply` payload and ask the owner whether to
accept it. Send only the accepted `apply` payload unchanged through
`mcp__cadence__cadence_apply`, then show the returned result. Send nothing on
decline and nothing before asking. Never re-derive a value, alter a payload,
combine proposals, or write configuration directly.
"#
}
