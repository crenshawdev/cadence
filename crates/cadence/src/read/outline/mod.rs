//! Grammar selection and bounded parsing for the unit outline.
//!
//! Folded in from excerpt's `outline.rs`. A grammar is chosen from a path's
//! extension and a parse runs under a wall-clock budget, so every extractor
//! can be unit tested against a string. Everything here is reached with
//! untrusted input: a path the walk produced and the bytes on disk behind it.
//! A grammar cannot be trusted to parse in bounded time (excerpt measured
//! 8,043 ms against 59 ms for two files of about 2 MB), so the budget is not
//! an optimization but the thing that keeps one call from holding the
//! resident's blocking thread for the rest of a session.
//!
//! A file with no grammar has no units here; `read::source::fallback` gives it
//! one unit spanning the whole file where a caller needs something to name.

use super::model::Unit;
use std::ffi::OsStr;
use std::ops::ControlFlow;
use std::path::Path;
use std::time::{Duration, Instant};
use tree_sitter::{ParseOptions, ParseState, Parser, Tree};

mod c;
mod javascript;
mod json;
mod markdown;
mod python;
mod rust;

/// Wall-clock ceiling on one outline parse.
///
/// Parsing needs its own bound rather than a byte ceiling, because size does
/// not predict parse cost: excerpt measured a clean 2.1 MB JavaScript file at
/// 59 ms and a 2 MB file of broken syntax at 8,043 ms, the difference paid
/// entirely in error recovery. Half a second sits an order of magnitude above
/// any clean parse measured there.
pub const PARSE_BUDGET: Duration = Duration::from_millis(500);

/// The size at which a file with a grammar is answered with its outline rather
/// than served whole. Measured in excerpt over this tree: 24 KB outlines 29%
/// of Rust files, 29% of JavaScript and 16% of Markdown while covering 70%,
/// 69% and 60% of their bytes. A file without a grammar has no outline to
/// offer, so this cutoff does not apply to it.
pub const OUTLINE_THRESHOLD: usize = 24 * 1024;

/// Ceiling on how deep the outline walk will descend.
///
/// The walk is iterative, so depth costs a `usize` and nothing on the stack.
/// The bound exists because the qualifier stacks the extractors keep are
/// per-level, and because a tree this deep is not source anyone wants an
/// outline of: a recursive walk of a 200,000-deep tree aborted excerpt at
/// depth 20,000 on a 2 MiB stack, reachable from a 40 KB file of `[`.
const MAX_TREE_DEPTH: usize = 1024;

/// Why an outline could not be produced. Neither variant is a refusal: a
/// caller falls back to one whole-file unit and says the outline was missing.
///
/// A clean parse that yields no units is `Ok(vec![])`, not an error. A file
/// with no named definitions is not a file the layer failed to understand.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutlineError {
    /// The parse failed outright or was cancelled by the budget.
    NotParsed,
    /// The tree is deeper than [`MAX_TREE_DEPTH`].
    TooDeep,
}

impl OutlineError {
    pub fn note(self) -> &'static str {
        match self {
            OutlineError::NotParsed => "no outline was available: the parse did not complete within the budget",
            OutlineError::TooDeep => "no outline was available: the syntax tree was too deep to walk",
        }
    }
}

/// A file's lines as `split_inclusive('\n')` segments, with the byte offset
/// each one starts at. A unit's byte span is derived from its line span here
/// so every extractor charges the same bytes a slice later serves.
pub struct Lines<'a> {
    segs: Vec<&'a str>,
    starts: Vec<usize>,
}

impl<'a> Lines<'a> {
    pub fn new(content: &'a str) -> Self {
        let segs: Vec<&str> = content.split_inclusive('\n').collect();
        let mut starts = Vec::with_capacity(segs.len() + 1);
        let mut offset = 0;
        for seg in &segs {
            starts.push(offset);
            offset += seg.len();
        }
        starts.push(offset);
        Self { segs, starts }
    }

    /// The file's line count.
    pub fn total(&self) -> usize {
        self.segs.len()
    }

    /// The text of 1-based line `line`, without its trailing newline. Out of
    /// range is the empty string rather than a panic: line numbers here come
    /// from a grammar's node positions, and a grammar is not this crate's code.
    pub fn text(&self, line: usize) -> &'a str {
        self.segs
            .get(line.wrapping_sub(1))
            .map(|seg| seg.strip_suffix('\n').unwrap_or(seg))
            .unwrap_or("")
    }

    /// A [`Unit`] spanning 1-based inclusive lines `first..=last`, clamped to
    /// the file, with its byte span derived from that line span.
    pub fn unit(&self, name: String, bare: String, kind: &'static str, first: usize, last: usize) -> Unit {
        let ceiling = self.total().max(1);
        let first = first.max(1).min(ceiling);
        let last = last.max(first).min(ceiling);
        let end = self.starts.len() - 1;
        Unit {
            name,
            bare,
            kind,
            first_line: first,
            last_line: last,
            first_byte: self.starts[(first - 1).min(end)],
            last_byte: self.starts[last.min(end)],
        }
    }
}

/// Visit every node of `tree` in document order, iteratively, passing each
/// node and its depth below the root.
///
/// Never recursive: the stack a blocking thread gets is not something this
/// crate can find out, and a recursive walk of a deep tree aborts the process
/// rather than returning an error. Hitting the depth cap abandons the whole
/// outline rather than returning a partial one, because a partial outline is
/// indistinguishable from a complete one to the model reading it.
pub fn walk<'t, F>(tree: &'t Tree, mut visit: F) -> Result<(), OutlineError>
where
    F: FnMut(tree_sitter::Node<'t>, usize),
{
    let mut cursor = tree.walk();
    let mut depth = 0usize;
    visit(cursor.node(), depth);
    loop {
        if depth < MAX_TREE_DEPTH {
            if cursor.goto_first_child() {
                depth += 1;
                visit(cursor.node(), depth);
                continue;
            }
        } else if cursor.goto_first_child() {
            return Err(OutlineError::TooDeep);
        }
        loop {
            if cursor.goto_next_sibling() {
                visit(cursor.node(), depth);
                break;
            }
            if !cursor.goto_parent() {
                return Ok(());
            }
            depth -= 1;
        }
    }
}

/// The 0-based row of `node`'s last character.
///
/// Not `end_position().row`: a node whose text ends in a newline (a
/// tree-sitter-rust `line_comment` is exactly that) reports the row after the
/// one a reader sees it on. Taken raw, a unit's last line is one past its own
/// text and an adjacency test against the line above rejects the very comment
/// it exists to take in.
pub fn last_row(node: tree_sitter::Node<'_>) -> usize {
    let end = node.end_position();
    if end.column == 0 && end.row > node.start_position().row { end.row - 1 } else { end.row }
}

/// The 1-based first line of `node`, widened up over the directly adjacent
/// sibling nodes above it that `attaches` accepts: attributes and comments
/// that document the item below them. A blank line ends the run.
pub fn widened_first_line(node: tree_sitter::Node<'_>, attaches: impl Fn(tree_sitter::Node<'_>) -> bool) -> usize {
    let mut first = node.start_position().row;
    let mut current = node;
    while let Some(prev) = current.prev_sibling() {
        if !attaches(prev) || last_row(prev) + 1 != first {
            break;
        }
        first = prev.start_position().row;
        current = prev;
    }
    first + 1
}

/// A grammar the layer can outline with. An extension with no entry here has
/// no grammar: its whole file is one unit to read, and its search hits are
/// line windows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Grammar {
    C,
    JavaScript,
    Json,
    Markdown,
    Python,
    Rust,
}

impl Grammar {
    /// Markdown takes the block grammar and never the inline one: outlining is
    /// a question about sections and their line spans, and a heading's name is
    /// its own source line rather than rendered inline text.
    fn language(self) -> tree_sitter::Language {
        match self {
            Grammar::C => tree_sitter_c::LANGUAGE.into(),
            Grammar::JavaScript => tree_sitter_javascript::LANGUAGE.into(),
            Grammar::Json => tree_sitter_json::LANGUAGE.into(),
            Grammar::Markdown => tree_sitter_md::LANGUAGE.into(),
            Grammar::Python => tree_sitter_python::LANGUAGE.into(),
            Grammar::Rust => tree_sitter_rust::LANGUAGE.into(),
        }
    }
}

/// The grammar for a file extension, compared lowercased.
pub fn grammar_for_path(path: &Path) -> Option<Grammar> {
    let extension = path.extension().and_then(OsStr::to_str)?.to_lowercase();
    match extension.as_str() {
        "c" | "h" => Some(Grammar::C),
        "js" | "mjs" | "cjs" | "jsx" => Some(Grammar::JavaScript),
        "json" => Some(Grammar::Json),
        "md" | "markdown" => Some(Grammar::Markdown),
        "py" => Some(Grammar::Python),
        "rs" => Some(Grammar::Rust),
        _ => None,
    }
}

/// Ceiling on the leading container-marker columns of any one markdown line.
///
/// A memory-safety guard. tree-sitter-md 0.5.3's external scanner writes five
/// header bytes plus one 4-byte block per open container block into
/// tree-sitter's fixed 1024-byte scanner state buffer, and neither side bounds
/// the write: tree-sitter asserts the length after the copy. A file nesting
/// more than 254 block quotes or list items, about 2 KB of `>`, writes past
/// that buffer. A debug build aborts on the assertion; a release build
/// overflows silently. Neither is catchable here, and an abort takes the
/// resident down. Every open container costs at least one column of the
/// leading marker run on the line that opens it, so a file whose deepest run
/// is under this bound cannot drive the scanner near its buffer.
const MAX_MARKDOWN_MARKER_COLUMNS: usize = 240;

/// Whether every line's leading container-marker run is within
/// [`MAX_MARKDOWN_MARKER_COLUMNS`]. Measured in columns with a tab as four.
/// It stops at the first character that cannot be part of a container prefix,
/// so prose and long lines cost nothing.
fn markdown_marker_columns_are_bounded(content: &str) -> bool {
    content.split('\n').all(|line| {
        let mut columns = 0usize;
        for byte in line.bytes() {
            columns += match byte {
                b'\t' => 4,
                b' ' | b'>' | b'-' | b'*' | b'+' | b'.' | b')' | b'0'..=b'9' => 1,
                _ => return true,
            };
            if columns > MAX_MARKDOWN_MARKER_COLUMNS {
                return false;
            }
        }
        true
    })
}

/// Parse `content` with `grammar`, giving up once `budget` of wall-clock time
/// has elapsed. A cancelled parse is `None`, exactly like a failed one, so no
/// caller can treat a half-built tree as an outline.
pub fn parse(content: &str, grammar: Grammar, budget: Duration) -> Option<Tree> {
    if grammar == Grammar::Markdown && !markdown_marker_columns_are_bounded(content) {
        return None;
    }
    let mut parser = Parser::new();
    parser.set_language(&grammar.language()).ok()?;

    let deadline = Instant::now().checked_add(budget)?;
    // Checked before the first step as well as inside the callback: tree-sitter
    // runs the progress callback every few hundred parse operations, so an
    // input small enough to finish inside one batch would never consult the
    // budget and a zero budget would not bind.
    if Instant::now() >= deadline {
        return None;
    }
    let mut cancel = |_: &ParseState| {
        if Instant::now() >= deadline { ControlFlow::Break(()) } else { ControlFlow::Continue(()) }
    };

    let bytes = content.as_bytes();
    let len = bytes.len();
    parser.parse_with_options(
        &mut |offset, _| if offset < len { &bytes[offset..] } else { &[][..] },
        None,
        Some(ParseOptions::new().progress_callback(&mut cancel)),
    )
}

/// The units of `content` under `grammar`, or why there are none.
///
/// `threshold` is the response bound the outline is served against. Only the
/// JSON extractor consults it, to decide which members are large enough to
/// descend into; the others take their shape from the grammar alone.
pub fn units(content: &str, grammar: Grammar, budget: Duration, threshold: usize) -> Result<Vec<Unit>, OutlineError> {
    let tree = parse(content, grammar, budget).ok_or(OutlineError::NotParsed)?;
    match grammar {
        Grammar::C => c::units(content, &tree),
        Grammar::JavaScript => javascript::units(content, &tree),
        Grammar::Json => json::units(content, &tree, threshold),
        Grammar::Markdown => markdown::units(content, &tree),
        Grammar::Python => python::units(content, &tree),
        Grammar::Rust => rust::units(content, &tree),
    }
}

/// What the outline of one file came to.
pub struct Outline {
    pub grammar: Option<Grammar>,
    /// Empty when there is no grammar, when the parse failed, or when a clean
    /// parse found nothing to name.
    pub units: Vec<Unit>,
    /// Set only when a grammar exists and its parse did not produce a tree the
    /// walk could finish.
    pub error: Option<OutlineError>,
}

/// The outline of `path`'s `content` under the default parse budget.
pub fn outline(path: &Path, content: &str, threshold: usize) -> Outline {
    let Some(grammar) = grammar_for_path(path) else {
        return Outline { grammar: None, units: Vec::new(), error: None };
    };
    match units(content, grammar, PARSE_BUDGET, threshold) {
        Ok(units) => Outline { grammar: Some(grammar), units, error: None },
        Err(error) => Outline { grammar: Some(grammar), units: Vec::new(), error: Some(error) },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_grammar_extensions_select_a_grammar_case_insensitively() {
        for (name, expected) in [
            ("a.c", Grammar::C),
            ("a.h", Grammar::C),
            ("a.js", Grammar::JavaScript),
            ("a.mjs", Grammar::JavaScript),
            ("a.cjs", Grammar::JavaScript),
            ("a.jsx", Grammar::JavaScript),
            ("a.json", Grammar::Json),
            ("a.md", Grammar::Markdown),
            ("a.MD", Grammar::Markdown),
            ("a.markdown", Grammar::Markdown),
            ("a.py", Grammar::Python),
            ("a.rs", Grammar::Rust),
        ] {
            assert_eq!(grammar_for_path(Path::new(name)), Some(expected), "{name} should select {expected:?}");
        }
    }

    #[test]
    fn every_other_extension_has_no_grammar() {
        for name in ["Cargo.toml", "notes.txt", "compose.yaml", "a.ts", "/code/x/Makefile", "/code/x/README"] {
            assert!(grammar_for_path(Path::new(name)).is_none(), "{name} should have no grammar");
        }
    }

    const SOURCE: &str = "function alpha() {\n  return 1;\n}\n";

    #[test]
    fn a_parse_within_the_default_budget_returns_a_tree() {
        let tree = parse(SOURCE, Grammar::JavaScript, PARSE_BUDGET).expect("a three-line file parses inside the budget");
        assert_eq!(tree.root_node().kind(), "program");
    }

    /// The budget has to bind on the very first step, not only after
    /// tree-sitter happens to run its progress callback.
    #[test]
    fn a_zero_budget_returns_no_tree_for_the_same_input() {
        assert!(parse(SOURCE, Grammar::JavaScript, Duration::ZERO).is_none());
    }

    /// 2000 balanced brackets nest past the 1024 cap; the walk abandons the
    /// whole outline rather than returning a partial one.
    #[test]
    fn a_tree_deeper_than_the_cap_is_abandoned_rather_than_walked() {
        let content = format!("{}{}", "[".repeat(2000), "]".repeat(2000));
        let tree = parse(&content, Grammar::JavaScript, PARSE_BUDGET).expect("parse");
        assert_eq!(walk(&tree, |_, _| {}), Err(OutlineError::TooDeep));
    }

    /// 40 KB of unbalanced `[`: error recovery flattens it, so it is neither
    /// deep nor slow, but it is the shape the depth cap exists for.
    #[test]
    fn forty_kilobytes_of_open_brackets_parses_and_walks_within_the_budget() {
        let content = "[".repeat(40_000);
        let started = Instant::now();
        if let Some(tree) = parse(&content, Grammar::Json, PARSE_BUDGET) {
            walk(&tree, |_, _| {}).ok();
        }
        assert!(started.elapsed() < Duration::from_secs(1), "took {:?}", started.elapsed());
    }

    /// A markdown file nesting more than 254 containers overflows
    /// tree-sitter-md's scanner-state buffer and aborts the process. Refusing
    /// to parse it is the only place that can be stopped.
    #[test]
    fn a_markdown_file_nesting_containers_past_the_scanner_buffer_is_not_parsed() {
        let content = format!("{}# buried\n", ">".repeat(2000));
        assert!(parse(&content, Grammar::Markdown, PARSE_BUDGET).is_none());
    }

    #[test]
    fn ordinary_markdown_is_still_parsed() {
        for content in [
            "# Title\n\nA line of ordinary prose, and a long one at that.\n",
            &format!("# Title\n\n{}\n", "word ".repeat(2000)),
            "- a\n  - b\n    - c\n",
            "> quoted\n>> deeper\n",
            "\t- tab indented\n",
        ] {
            assert!(parse(content, Grammar::Markdown, PARSE_BUDGET).is_some(), "refused ordinary markdown: {content:?}");
        }
    }

    #[test]
    fn every_grammar_parses_its_own_shape() {
        for (grammar, source) in [
            (Grammar::C, "int main(void) { return 0; }\n"),
            (Grammar::JavaScript, "const a = 1;\n"),
            (Grammar::Json, "{\"a\": 1}\n"),
            (Grammar::Markdown, "# title\n\nbody\n"),
            (Grammar::Python, "def alpha():\n    pass\n"),
            (Grammar::Rust, "fn alpha() {}\n"),
        ] {
            assert!(parse(source, grammar, PARSE_BUDGET).is_some(), "{grammar:?} failed to parse its own source");
        }
    }

    /// The byte span of a unit is the same bytes a slice of those lines serves.
    #[test]
    fn a_units_byte_span_covers_exactly_its_lines_including_the_final_newline() {
        let lines = Lines::new("ab\ncd\nef\n");
        let unit = lines.unit("x".into(), "x".into(), "test", 2, 3);
        assert_eq!((unit.first_byte, unit.last_byte), (3, 9));
        assert_eq!(unit.range(), [2, 3]);
        let tail = Lines::new("ab\ncd").unit("x".into(), "x".into(), "test", 2, 9);
        assert_eq!((tail.first_line, tail.last_line, tail.first_byte, tail.last_byte), (2, 2, 3, 5));
        let empty = Lines::new("").unit("x".into(), "x".into(), "test", 1, 1);
        assert_eq!((empty.first_line, empty.last_line, empty.first_byte, empty.last_byte), (1, 1, 0, 0));
    }

    #[test]
    fn a_file_with_no_grammar_has_no_units_and_no_error() {
        let outline = outline(Path::new("Cargo.toml"), "[package]\nname = \"x\"\n", 65_536);
        assert!(outline.grammar.is_none());
        assert!(outline.units.is_empty());
        assert!(outline.error.is_none());
    }
}
