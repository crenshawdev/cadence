# PLAN.md frontmatter grammar

The stated grammar for the `requirements:` and `files:` lists in a plan
file's leading `---`-fenced block (`templates/PLAN.md`). Read every shipped
form to exactly the ids/files declared, and report anything outside this
grammar rather than silently over- or under-reading it. The single
implementation is `readFrontmatterList` in
`cadence-core/bin/lib/planning-files.mjs` (a thin selector over
`parseFrontmatter`, which walks the block once and classifies every line).

## Normalization

Before anything else, the text is normalized: one leading `U+FEFF` byte-order
mark is stripped, and every `\r\n` and lone `\r` becomes `\n`. This runs on
the PARSE path only - never on text a caller writes back verbatim (see
`normalize`'s own doc comment) - so a CRLF checkout or a BOM-prefixed file
reads identically to its plain-LF twin.

## The fence

Leading blank lines before the opening fence are tolerated. Both fences are a
bare `---` line (`/^---\s*$/`) - nothing else on the line. The first
non-blank line that is not a bare `---` means the file has no frontmatter at
all: this degrades to empty items with NO issue, since the callers'
`no-plan` (audit) and `undeclared` (plan-overlap) breaks already make an
absent declaration loud on their own.

An opening fence with no matching closing fence reports `unterminated-frontmatter`
at the opening fence's line, with empty items for every key.

## The key line

A key line is an EXACT column-0 match: `/^([A-Za-z_][A-Za-z0-9_.-]*):(\s|$)/`,
never an interpolated per-key regex. The first occurrence of a given key
wins; a later line with the same key name is ignored for VALUE purposes (but
still ends whatever block was in progress, since a key line is always a
terminator - see below).

## The comment rule (D-01: quoting decides)

An UNQUOTED `#` always starts a comment, anywhere in a value - there is no
"needs a following space" rule and no digit-vs-non-digit distinction.
`requirements: #41` is therefore a COMMENT (empty value), while
`requirements: "#41"` is DATA (the id `#41`). This matches real YAML's own
comment rule. The practical consequence: **quote every `#`-shaped id.**
`#TODO`, `# TODO`, and `#41` unquoted are all comments; `"#41"` and `'#41'`
are both the id `#41`.

## The three value forms

The remainder after `key:` (trimmed, then scanned left to right tracking
quote state so an unquoted `#` ends the value there) resolves to exactly one
of:

- **Inline flow list** - the value starts with `[`. The closing `]` is found
  at quote depth 0 (a quoted `]` is literal, never the closer), the payload
  between the brackets is split on commas at quote depth 0 (a comma inside a
  quoted span is literal), and each trimmed, non-empty element is resolved at
  its own boundary (see Value resolution below). Never a `\[(.*)\]` regex
  capture, greedy or not - neither can see quoting, and the greedy form is
  the defect three independent reviewers found (a bracket in a trailing
  comment used to inject a bogus entry).
- **Block list** - the remainder is empty, INCLUDING a remainder that is
  entirely a comment (`requirements:   # ids` and `requirements: #TODO fill
  this in` are both empty values). The following lines are read as the block
  - see below.
- **Scalar** - anything else non-empty: a single-element list, resolved at
  its own boundary. Never a fall-through to the block reader, which would
  both discard the scalar's own value and swallow whatever `- ` lines follow
  it.

## The block list: skip rules and the terminator set

From the line after a block-eligible key line, every following line is
classified:

- **Blank** (whitespace-only) - skipped, never a terminator.
- **Comment-only** (`/^\s*#/`) - skipped, never a terminator; if the body
  left after stripping the leading `#` run is itself key-shaped, this also
  records `commented-key-line` (see the table below) without changing the
  skip.
- **Item** (`/^\s*-\s+(.*)$/`, any indent - the grammar has no nesting
  concept) - the payload is resolved the same way a key line's value is (see
  Value resolution below). A payload that is itself entirely a comment
  (`- # stray`, and under the comment rule also an unquoted `- #41`) or an
  EMPTY payload (`- ` - a dash, whitespace, nothing else) contributes
  NOTHING and is NOT an issue - the accepted cost of the comment rule, not a
  defect. A BARE `-` with no trailing whitespace is different: the item
  pattern requires the whitespace, so that line is not an item at all and
  falls through to `unknown-line`. The distinction is the WHITESPACE, and
  any whitespace serves - `-` followed by a tab is an empty item exactly as
  `- ` is. Every other dash spelling reports `unknown-line`: a dash with
  nothing after it, and equally a dash followed directly by non-whitespace
  (`-src/a.rs`, `--`), since neither matches the item pattern either.
- **An item with no open key** - an item line (resolved to a non-empty
  value) arriving while no block key is open - before any key line at all,
  or under a key that took the inline or scalar arm - records
  `item-without-key` and its payload is DROPPED. It never back-attaches to
  the most recent key line whatever arm that key took: merging an inline
  value with a following block would fuse two separate statements under a
  merge rule this grammar does not state. A repeated key line does not
  reopen a block either (the first occurrence wins), so items under a second
  `files:` line report the same code.
- **Terminator** - exactly three things end the block: another key line at
  column 0, the closing fence, or the end of the frontmatter block. Nothing
  else stops it.
- **Anything else** - recorded as an `unknown-line` issue (see below) and
  SKIPPED, exactly like a blank or comment line. An unknown line is never a
  de-facto fourth terminator: treating it as one would drop every item below
  it, which is precisely the failure this grammar exists to close (a
  comment-headed or comment-split `files:` list used to truncate silently,
  handing the parallel-safety gate a false `overlaps: []`).

A column-0 line that is key-shaped (`/^[A-Za-z_][A-Za-z0-9_.-]*:/`) but
fails the key line's own whitespace-or-EOL requirement after the colon
records `malformed-key-line` instead of falling through to `unknown-line` -
see the table below.

## Value resolution

A value is resolved at its own boundary. When it starts with a quote
character (`"` or `'`), the value is the payload up to the NEXT occurrence
of that SAME character - never a global `["']` replace, which both mangles
a real path (`src/it's-a-file.md` would lose its apostrophe) and destroys
the quoting signal the comment rule depends on. Otherwise the value ends at
its first whitespace character - the accepted cost, stated plainly: an
unquoted value can no longer contain a space, so quote a value that does.

Whatever follows the value - after the closing quote, or after the first
whitespace - is diagnosed `trailing-value-content` and dropped, while the
value resolved before it stands (parse-then-diagnose, never a fall-through
that discards a value the author plainly declared).

An unterminated quote (a quote character that opens a span and never closes
it, anywhere in the scanned value - inline, scalar, or block item) yields NO
items for that value and the `unterminated-quote` code. This is a deliberate
fail-loud: `files: [src/it's-a-file.md]` has no honest item boundary once
the apostrophe opens an unclosed span, so returning nothing (with the
diagnostic naming the real reason) beats a silent half-read.

Finally, a resolved value that still contains a backslash, or the SAME quote
character that wrapped it (either quote character when the value was
unquoted), could only have been written with an escape rule this grammar
does not have (D-20). It is reported as `residual-quote` and KEPT - the
grammar detects an escape shape without implementing one. A `'` inside a
`"`-wrapped value needs no escape and is in the grammar (`"src/it's-a-file.md"`
is the correct spelling of that path, and must NOT trigger this code); a `"`
inside one could only have been escaped and is not.

## Diagnostic codes

Every code below is appended to the pass's `frontmatter_issues` (via the
`audit` and `plan-overlap` seam envelopes) as `{line, code, text}` - `line`
is 1-indexed into the normalized text, `text` is the offending line trimmed
and truncated to 120 characters with a trailing `...`, and a line reports at
most one issue per code.

A diagnostic is ADDITIVE: it never flips `ok` and is never ITSELF an audit
`break`. It is NOT verdict-neutral in general, though (D-15) - where a code
DROPS the payload it read, the ids or files that line would have
contributed are simply absent, so `audit` can report `no-plan` and
`counts.broken` can move for that reason, with the diagnostic beside it
naming why. The Payload column states exactly what each code keeps or
drops; a code marked "drops" can move `counts` - through the ordinary
absence of what it dropped, not because the diagnostic itself flipped
anything.

"Preserves" is a statement about what the code ITSELF discards, not a
promise that the value still matches anything. A preserving code adds no
truncation of its own, but the value it hands on may already be a fragment
that an earlier rule cut, and a fragment matches no id: a backticked `#41`
arrives as a lone `` ` ``, so on `requirements:` the requirement goes
untraced and `counts.broken` moves anyway. The codes where that applies say
so in their own row and are marked CONDITIONAL. Read the row, not the class.

`files:` is never read by `audit`, so NO code moves `counts` through a
`files:` value. A counts claim is only meaningful about `requirements:`.

| Code | Means | Payload | Cleared by |
|---|---|---|---|
| `unterminated-frontmatter` | The opening `---` fence has no matching closing `---`. | Drops the WHOLE block - every key reads empty. | Add the closing fence. |
| `unterminated-inline-list` | An inline `[...]` value has no closing `]` (searched at quote depth 0). | Drops that key's list. | Close the bracket. |
| `trailing-inline-content` | Non-whitespace follows an inline list's closing `]`. | Preserves the payload parsed before it. | Remove the trailing content, or move it into a comment. |
| `unterminated-quote` | A quote (`"` or `'`) opens a span that never closes, in a key value, a scalar, or a block item. | Drops that value. | Close the quote, or remove the stray quote character. |
| `malformed-key-line` | A column-0 line is key-shaped but missing the whitespace-or-EOL after its colon (`requirements:["#41"]`). | Drops that line's key and value entirely. | Add a space after the colon. |
| `item-without-key` | A block item arrived while no block key was open. | Drops that item. | Give the key a bare block form (`key:` with nothing after it), or delete the stray item. |
| `commented-key-line` | A comment-only line's body, once the `#` run is stripped, is itself key-shaped. | Drops NOTHING itself, but does not terminate the open block, so items below it fold into the PREVIOUS key - the stated, accepted over-read (D-14). | Uncomment the line, or leave it if it is deliberately a heading/splitting comment. |
| `unknown-line` | A frontmatter-block line is neither a key line, a block item, a comment, blank, nor a terminator. | CONDITIONAL - the one code whose payload behavior depends on the line: drops nothing when the line was never data (a stray prose line between items leaves the items above and below intact), but drops a whole key's worth of ids when the line WAS malformed data that fell through here, e.g. `1requirements: ["#41"]` (fails `malformed-key-line`'s own `/^[A-Za-z_]/` start) or a block-item line missing its `- ` under an open key. | Turn it into a `- item`, a `# comment`, or a valid key line. |
| `trailing-value-content` | Non-whitespace follows a resolved scalar or block-item value. | Preserves the value resolved before it. | Remove the trailing content, quote the whole value, or move the extra text into a comment. |
| `residual-quote` | The resolved value still contains a backslash, or the same quote character that wrapped it. | Preserves the payload (D-20: escapes are detected, never implemented). | Remove the stray quote/backslash, or rewrite the value without needing one. |
| `backtick-wrapped-value` | The resolved value STARTS or ENDS with a backtick - markdown formatting that leaked into data. Boundary, not containment and not a matched pair: a backtick INSIDE a value (`` lib/a`b.mjs ``) is a legal path character and is NOT reported, while every near-miss wrap is (`` `src/a.rs `` half-wrapped, `` `src/a.rs`, `` wrap-plus-punctuation, and a lone `` ` `` left when the `#` rule cut `` `#41` `` down to it). | CONDITIONAL, and this code never REPAIRS what it reports. It adds no truncation of its own, but it frequently fires on a value an EARLIER rule already cut: the `#` rule reduces `` `#41` `` to a lone `` ` `` and the whitespace rule reduces `` `src/my file.rs` `` to `` `src/my `` before this test runs, so the delivered payload is that fragment, not the bytes the author wrote. Whatever survives is passed on unrewritten (D-19). Counts follow from that: a fragment is not a real id, so on `requirements:` the requirement goes untraced and `counts.broken` moves. `files:` never feeds `counts` for ANY code, so read the `requirements:` behavior as the code's real signature. | Remove the backticks. |

## What is out of scope

The task-line arm (`- **Files:** a, b`, `parsePlanFiles`' second source) is a
separate, already CRLF-tolerant regex and is not part of this grammar. The
roadmap's `## Phases` list (`PHASE_LINE` / `parseRoadmapPhases` /
`classifyPhaseList`) has its own grammar, stated at
`cadence-core/references/roadmap-phases.md` - same `{line, code, text}` issue
shape, different states and codes. The snippet/UAT-fence parsers have their
own, unrelated grammars.
