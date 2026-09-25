//! Compiled query-only help front door.
pub fn markdown() -> String {
    super::table::render_description("cad-help", r#"---
name: cad-help
description: ""
argument-hint: "[command name]"
allowed-tools:
  - mcp__cadence__cadence_query
---

Call `mcp__cadence__cadence_query` once with `{"operation":"help"}` when no
name is supplied. Present every returned cluster in order, with each command's
name and compiled description.

With a command name, call `{"operation":"help","name":"<command name>"}`.
One optional leading slash and one optional cad- prefix are accepted: debug,
cad-debug and /cad-debug select the same command. Present the single row.
If no row matches, show the returned closest names in their supplied order;
do not invent a command or treat the suggestions as an exact match.

Help reads only the compiled command table. Read nothing else: no project
files, command reference, search, or state. Help writes nothing.
"#).expect("compiled help front matter")
}

