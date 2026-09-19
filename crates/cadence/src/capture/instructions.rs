pub fn markdown() -> &'static str {
    r#"---
name: cad-capture
description: Park a phase-linked todo, a seed for a later milestone, or a note, as one typed item.
allowed-tools:
  - mcp__cadence__cadence_apply
  - mcp__cadence__cadence_query
---

Call `mcp__cadence__cadence_apply` once with
`{"operation":"capture","request_id":"<fresh id>","kind":"<todo|seed|note>","text":"<the owner's own sentence>"}`,
adding `"phase":<N>` only for a todo. A seed and a note belong to no phase, and
sending one is refused on the `phase` slot. Use a fresh `request_id` per
capture; repeating one answers from the item it already wrote.

Report the returned `item` and the returned `captures` line, active of bound,
and say so when `exceeded` is true. The bound reports, it never refuses: an
item over it still lands.

The item is the record. Do not compose a bullet, do not open or change
`.planning/CAPTURE.md`, and do not make a commit. Capture is parking, not
doing: a captured todo is queued, never acted on now. If the call is refused,
show its exact rule, slot and reason so the owner can send it again.

Capturing friction with Cadence itself is parked for a later phase; this door
records items about the project you are in.
"#
}
