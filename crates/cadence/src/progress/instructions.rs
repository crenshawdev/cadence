pub fn markdown() -> &'static str {
    r#"---
name: cad-progress
description: Show derived phase status, located issues, records, captures and the next action.
allowed-tools:
  - mcp__cadence__cadence_query
---

Call `mcp__cadence__cadence_query` once with `{"operation":"progress"}`.
Print the returned `text` unchanged. If the query is refused, show its exact
code and located reason. The binary derives the answer; do not reconstruct it.
"#
}
