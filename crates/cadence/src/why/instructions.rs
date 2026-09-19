pub fn markdown() -> &'static str {
    r#"---
name: cad-why
description: Why is this code like this - the git chain over one file[:line], joined to the phase, task, decision, deviation and review record, printed verbatim.
argument-hint: "<path>[:<line>]"
allowed-tools:
  - mcp__cadence__cadence_query
---

Read the argument as `<path>[:<line>]`. The text after the LAST colon is a
line only when it is all digits; a colon followed by anything else stays part
of the path. Refuse a blank path, a trailing colon, a zero line and a
non-integer line, saying which, and never substitute a default.

Call `mcp__cadence__cadence_query` once with `{"operation":"why","path":"<path>"}`,
adding `"line":<n>` as a JSON integer when a line was given. Make no other
call, run no command and open no file: the binary reads the repository and
the record itself, including the phases a milestone close pruned.

If the answer is refused, show its exact code and reason and stop.

Print the returned `text` verbatim and nothing else: no summary before it, no
commentary after it, no reformatting. `text` is already the whole answer,
quoted from the record in its own words; a reader checks it byte for byte
against the binary's own output, and any change here makes that identity
false.
"#
}
