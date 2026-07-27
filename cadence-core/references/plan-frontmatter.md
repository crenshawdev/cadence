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
  quoted span is literal), and each element is trimmed and unwrapped. Never a
  `\[(.*)\]` regex capture, greedy or not - neither can see quoting, and the
  greedy form is the defect three independent reviewers found (a bracket in a
  trailing comment used to inject a bogus entry).
- **Block list** - the remainder is empty, INCLUDING a remainder that is
  entirely a comment (`requirements:   # ids` and `requirements: #TODO fill
  this in` are both empty values). The following lines are read as the block
  - see below.
- **Scalar** - anything else non-empty: a single-element list, unwrapped.
  Never a fall-through to the block reader, which would both discard the
  scalar's own value and swallow whatever `- ` lines follow it.

## The block list: skip rules and the terminator set

From the line after a block-eligible key line, every following line is
classified:

- **Blank** (whitespace-only) - skipped, never a terminator.
- **Comment-only** (`/^\s*#/`) - skipped, never a terminator.
- **Item** (`/^\s*-\s+(.*)$/`, any indent - the grammar has no nesting
  concept) - the payload is scanned and unwrapped the same way a key line's
  value is. A payload that is itself entirely a comment (`- # stray`, and
  under the comment rule also an unquoted `- #41`) or a bare `-` with no
  payload contributes NOTHING and is NOT an issue - the accepted cost of the
  comment rule, not a defect.
- **Terminator** - exactly three things end the block: another key line at
  column 0, the closing fence, or the end of the frontmatter block. Nothing
  else stops it.
- **Anything else** - recorded as an `unknown-line` issue (see below) and
  SKIPPED, exactly like a blank or comment line. An unknown line is never a
  de-facto fourth terminator: treating it as one would drop every item below
  it, which is precisely the failure this grammar exists to close (a
  comment-headed or comment-split `files:` list used to truncate silently,
  handing the parallel-safety gate a false `overlaps: []`).

## The wrapping-quote strip

A value is unwrapped by stripping exactly the FIRST and LAST character when
the trimmed string is at least 2 characters and starts and ends with the
SAME quote character (`"` or `'`). This is never a global `["']` replace -
that both mangles a real path (`src/it's-a-file.md` would lose its
apostrophe) and destroys the quoting signal the comment rule depends on.

An unterminated quote (a quote character that opens a span and never closes
it, anywhere in the scanned value - inline, scalar, or block item) yields NO
items for that value and the `unterminated-quote` code. This is a deliberate
fail-loud: `files: [src/it's-a-file.md]` has no honest item boundary once
the apostrophe opens an unclosed span, so returning nothing (with the
diagnostic naming the real reason) beats a silent half-read.

## Diagnostic codes

Every code below is appended to the pass's `frontmatter_issues` (via the
`audit` and `plan-overlap` seam envelopes) as `{line, code, text}` - `line`
is 1-indexed into the normalized text, `text` is the offending line trimmed
and truncated to 120 characters with a trailing `...`. A diagnostic is
ADDITIVE and orthogonal to the verdict: it never flips `ok`, never changes
`counts`, and never adds or clears an audit `break`.

| Code | Means | Cleared by |
|---|---|---|
| `unterminated-frontmatter` | The opening `---` fence has no matching closing `---`. | Add the closing fence. |
| `unterminated-inline-list` | An inline `[...]` value has no closing `]` (searched at quote depth 0). | Close the bracket. |
| `trailing-inline-content` | Non-whitespace follows an inline list's closing `]` (the payload before it is still parsed). | Remove the trailing content, or move it into a comment. |
| `unterminated-quote` | A quote (`"` or `'`) opens a span that never closes, in a key value, a scalar, or a block item. | Close the quote, or remove the stray quote character. |
| `unknown-line` | A frontmatter-block line is neither a key line, a block item, a comment, blank, nor a terminator. | Turn it into a `- item`, a `# comment`, or remove it. |

## What is out of scope

The task-line arm (`- **Files:** a, b`, `parsePlanFiles`' second source) is a
separate, already CRLF-tolerant regex and is not part of this grammar. The
roadmap's `## Phases` list (`PHASE_LINE` / `parseRoadmapPhases`) and the
snippet/UAT-fence parsers have their own, unrelated grammars.
