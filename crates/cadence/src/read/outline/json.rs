//! JSON member units, descended into by size.
//!
//! The root value's direct members are listed, and any member that is itself
//! over the response threshold has its members listed in turn, recursively,
//! by size alone. Excerpt measured the 12 JSON files above 64 KB under
//! `/code`: six object roots with 2 to 12 top-level keys (a lockfile whose
//! content all sits under `packages`), six array roots with 1523, 309 and 169
//! unnamed members. A fixed top-level outline is useless for the first shape
//! and a fixed deep outline is unbounded for the second; size-driven descent
//! answers both.
//!
//! The descent is bounded twice over: by size, since a member at or under the
//! threshold is never expanded, and by the shared walk's depth cap.

use super::{Lines, OutlineError, last_row, walk};
use crate::read::model::Unit;
use tree_sitter::{Node, Tree};

/// Array members carry `[i]` and take no separator.
const SEPARATOR: char = '.';

/// Ceiling on the characters one name segment contributes to a row.
///
/// A key is untrusted input read off disk, and a JSON file may legally be one
/// key of many megabytes. Without this the first row of an outline could carry
/// the whole file into the response. A truncated segment is marked, so a
/// caller can see the name is not one to pass back and reaches that member by
/// the line range in its row instead.
const MAX_SEGMENT_CHARS: usize = 120;

fn value_kind(node: Node<'_>) -> &'static str {
    match node.kind() {
        "object" => "object",
        "array" => "array",
        "string" => "string",
        "number" => "number",
        "true" | "false" => "boolean",
        "null" => "null",
        _ => "value",
    }
}

/// A name segment made safe to print in a row: control characters flattened,
/// and the whole thing cut on a character boundary at [`MAX_SEGMENT_CHARS`].
fn sanitize(segment: &str) -> String {
    let flattened: String = segment.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    if flattened.chars().count() <= MAX_SEGMENT_CHARS {
        return flattened;
    }
    let kept: String = flattened.chars().take(MAX_SEGMENT_CHARS).collect();
    format!("{kept}...")
}

/// The name segment for an object member, quoted when it has to be.
///
/// A key that is empty or that carries `.`, `[`, a double quote or a
/// backslash is written as the JSON-quoted string the source itself holds:
/// `""` for the root package entry every npm lockfile carries as its first
/// `packages` key, `"jquery.min.js"` for a dotted one. Unquoted, `packages.`
/// has an empty final segment nothing can resolve and `a.jquery.min.js` is
/// indistinguishable from four levels of nesting.
fn key_segment(pair: Node<'_>, source: &[u8]) -> Option<String> {
    let raw = pair.child_by_field_name("key")?.utf8_text(source).ok()?.trim();
    let content = raw.strip_prefix('"').and_then(|rest| rest.strip_suffix('"')).unwrap_or(raw);
    if content.is_empty() || content.contains(['.', '[', '"', '\\']) {
        Some(sanitize(raw))
    } else {
        Some(sanitize(content))
    }
}

fn join(prefix: &str, segment: &str, is_index: bool) -> String {
    if prefix.is_empty() {
        segment.to_string()
    } else if is_index {
        format!("{prefix}{segment}")
    } else {
        format!("{prefix}{SEPARATOR}{segment}")
    }
}

/// A container being walked through, and whether its members are being listed.
struct Frame {
    /// Walk depth of the container node itself.
    depth: usize,
    /// The container's own qualified name, empty for the root value.
    prefix: String,
    /// Whether this container's direct members become rows. True for the root,
    /// and for a listed member over the threshold.
    expanded: bool,
    is_array: bool,
    /// The 0-based index of the next element, for an array.
    next_index: usize,
}

/// One unit per listed member, named by its path from the root. `threshold`
/// is the response bound the outline is served against: it decides which
/// members are expanded.
pub fn units(content: &str, tree: &Tree, threshold: usize) -> Result<Vec<Unit>, OutlineError> {
    let lines = Lines::new(content);
    let source = content.as_bytes();
    let mut units = Vec::new();
    let mut frames: Vec<Frame> = Vec::new();
    // The qualified name of the pair whose value is about to be visited, as
    // (walk depth of the pair, name). A pair's value is its child, so the name
    // has to survive one level of descent to reach the container it belongs to.
    let mut pending: Vec<(usize, String)> = Vec::new();

    walk(tree, |node, depth| {
        while frames.last().is_some_and(|frame| frame.depth >= depth) {
            frames.pop();
        }
        while pending.last().is_some_and(|(at, _)| *at >= depth) {
            pending.pop();
        }

        // The name this node carries as a member of the container above it,
        // when that container is one whose members are being listed.
        let mut member_name: Option<String> = None;
        if let Some(frame) = frames.last_mut()
            && frame.expanded
            && depth == frame.depth + 1
        {
            if frame.is_array {
                if node.is_named() && node.kind() != "comment" {
                    let segment = format!("[{}]", frame.next_index);
                    frame.next_index += 1;
                    let name = join(&frame.prefix, &segment, true);
                    units.push(lines.unit(name.clone(), segment, value_kind(node), node.start_position().row + 1, last_row(node) + 1));
                    member_name = Some(name);
                }
            } else if node.kind() == "pair"
                && let Some(segment) = key_segment(node, source)
            {
                let name = join(&frame.prefix, &segment, false);
                let kind = node.child_by_field_name("value").map_or("value", value_kind);
                units.push(lines.unit(name.clone(), segment, kind, node.start_position().row + 1, last_row(node) + 1));
                pending.push((depth, name));
            }
        }

        if matches!(node.kind(), "object" | "array") {
            // The root value is always expanded; a member is expanded only if
            // it was listed at all and its own bytes are over the threshold.
            let (prefix, expanded) = if frames.is_empty() {
                (String::new(), true)
            } else {
                let name = member_name.or_else(|| {
                    pending.last().filter(|(at, _)| *at + 1 == depth).map(|(_, name)| name.clone())
                });
                match name {
                    Some(name) => {
                        let expanded = node.byte_range().len() > threshold;
                        (name, expanded)
                    }
                    // A value inside a container nobody is listing: walked
                    // through, never named, never expanded.
                    None => (String::new(), false),
                }
            };
            frames.push(Frame { depth, prefix, expanded, is_array: node.kind() == "array", next_index: 0 });
        }
    })?;

    // No sort: the walk emits in document order already, and a member's own
    // expansion follows it. Sorting by line would push a container's first
    // member above the container when both open on the same line.
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read::outline::{Grammar, PARSE_BUDGET, parse};

    fn outline(content: &str, threshold: usize) -> Vec<Unit> {
        let tree = parse(content, Grammar::Json, PARSE_BUDGET).expect("parse");
        units(content, &tree, threshold).expect("units")
    }

    fn names(units: &[Unit]) -> Vec<&str> {
        units.iter().map(|unit| unit.name.as_str()).collect()
    }

    #[test]
    fn an_object_root_lists_its_direct_members_only() {
        let units = outline("{\n  \"name\": \"site\",\n  \"deps\": {\n    \"a\": 1,\n    \"b\": 2\n  }\n}\n", usize::MAX);
        assert_eq!(names(&units), vec!["name", "deps"]);
        assert_eq!(units[0].kind, "string");
        assert_eq!(units[1].kind, "object");
        assert_eq!((units[1].first_line, units[1].last_line), (3, 6));
    }

    #[test]
    fn a_member_over_the_threshold_is_expanded_and_a_small_one_is_not() {
        let big: String = std::iter::repeat_n("      \"padding value here\",\n", 40).collect();
        let source = format!("{{\n  \"big\": [\n{big}      0\n  ],\n  \"small\": {{\n    \"c\": 1\n  }}\n}}\n");
        let units = outline(&source, 200);
        assert_eq!(units[0].name, "big");
        assert_eq!(units[1].name, "big[0]");
        assert!(names(&units).contains(&"small"), "the small member is still listed: {units:#?}");
        assert!(!names(&units).contains(&"small.c"), "a member under the threshold is not expanded: {units:#?}");
    }

    #[test]
    fn an_array_root_names_its_members_by_index() {
        let units = outline("[\n  {\"a\": 1},\n  2,\n  \"three\"\n]\n", usize::MAX);
        assert_eq!(names(&units), vec!["[0]", "[1]", "[2]"]);
        assert_eq!(units[0].kind, "object");
        assert_eq!(units[1].kind, "number");
        assert_eq!(units[2].kind, "string");
    }

    #[test]
    fn an_empty_key_and_a_dotted_key_are_printed_quoted() {
        let source = "{\n  \"packages\": {\n    \"\": {\"x\": 1},\n    \"jquery.min.js\": 2\n  }\n}\n";
        let units = outline(source, 10);
        assert!(names(&units).contains(&"packages.\"\""), "expected a quoted empty key: {units:#?}");
        assert!(names(&units).contains(&"packages.\"jquery.min.js\""), "expected a quoted dotted key: {units:#?}");
    }

    #[test]
    fn a_nested_path_carries_both_object_keys_and_array_indices() {
        let source = "{\n  \"a\": {\n    \"b\": [\n      {\n        \"c\": 1\n      }\n    ]\n  }\n}\n";
        let units = outline(source, 10);
        assert_eq!(names(&units), vec!["a", "a.b", "a.b[0]", "a.b[0].c"]);
    }

    #[test]
    fn an_enormous_key_is_truncated_rather_than_carried_into_the_row() {
        let key = "k".repeat(5_000);
        let units = outline(&format!("{{\"{key}\": 1}}\n"), usize::MAX);
        assert_eq!(units.len(), 1);
        assert!(units[0].name.len() < 200, "name was {} bytes", units[0].name.len());
        assert!(units[0].name.ends_with("..."), "{}", units[0].name);
    }

    #[test]
    fn a_scalar_root_yields_no_units() {
        assert!(outline("42\n", usize::MAX).is_empty());
    }
}
