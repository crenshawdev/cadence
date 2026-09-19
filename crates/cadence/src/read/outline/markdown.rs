//! Markdown heading units.
//!
//! The block grammar nests a `section` per heading, each opening with an
//! `atx_heading` or a `setext_heading`, so every heading in a file is
//! reachable from the root by the shared walk. Only the heading nodes are
//! taken from the tree; the line ranges are then derived by tiling, for the
//! reason given at the tiling step.

use super::{Lines, OutlineError, walk};
use crate::read::model::Unit;
use tree_sitter::{Node, Tree};

/// ` > ` and never `.`: heading text carries `.` freely (`## v3.7.1`), so a
/// dotted qualifier could not be read back apart.
const SEPARATOR: &str = " > ";

/// The unit covering the lines before the first heading.
///
/// Without it the tiling starts at the first heading and everything above it
/// (a `---`-delimited frontmatter block is exactly this shape) appears in no
/// row at all, and a search hit there would have no unit to land in.
const PREAMBLE: &str = "(preamble)";

struct Heading {
    level: usize,
    /// The 1-based line the heading's own source text sits on.
    line: usize,
}

fn atx_level(node: Node<'_>) -> Option<usize> {
    let mut cursor = node.walk();
    node.children(&mut cursor).find_map(|child| match child.kind() {
        "atx_h1_marker" => Some(1),
        "atx_h2_marker" => Some(2),
        "atx_h3_marker" => Some(3),
        "atx_h4_marker" => Some(4),
        "atx_h5_marker" => Some(5),
        "atx_h6_marker" => Some(6),
        _ => None,
    })
}

/// `===` is level 1, `---` is level 2.
fn setext_level(node: Node<'_>) -> Option<usize> {
    let mut cursor = node.walk();
    node.children(&mut cursor).find_map(|child| match child.kind() {
        "setext_h1_underline" => Some(1),
        "setext_h2_underline" => Some(2),
        _ => None,
    })
}

/// One unit per heading, plus a `(preamble)` unit when the file does not open
/// with one. A file with no heading at all yields no units.
pub fn units(content: &str, tree: &Tree) -> Result<Vec<Unit>, OutlineError> {
    let lines = Lines::new(content);
    let mut headings: Vec<Heading> = Vec::new();
    walk(tree, |node, _depth| {
        let level = match node.kind() {
            "atx_heading" => atx_level(node),
            "setext_heading" => setext_level(node),
            _ => None,
        };
        if let Some(level) = level {
            // A setext heading's node spans its title line and its underline;
            // the title line is the one a caller reads and passes back, and
            // it is the node's first line either way.
            headings.push(Heading { level, line: node.start_position().row + 1 });
        }
    })?;

    if headings.is_empty() {
        return Ok(Vec::new());
    }

    let total = lines.total();
    let mut units = Vec::new();
    if headings[0].line > 1 {
        units.push(lines.unit(PREAMBLE.to_string(), PREAMBLE.to_string(), "preamble", 1, headings[0].line - 1));
    }

    // Every ancestor heading of the one being emitted, as (level, bare name).
    let mut ancestors: Vec<(usize, String)> = Vec::new();
    for (index, heading) in headings.iter().enumerate() {
        // Tiling, not the node's own end: the block grammar's `section` ends
        // where the next same-or-higher-level heading begins, but taking the
        // range this way is what makes the sections cover the file with no
        // gaps and gives a fetched section its trailing blank line. Sections
        // nest, so this is coverage and not a partition: a `#` unit running
        // to the last line and the `##` units inside it overlap deliberately.
        let last_line = headings[index + 1..]
            .iter()
            .find(|next| next.level <= heading.level)
            .map_or(total, |next| next.line - 1);

        // The bare name is the heading's own source line, trimmed, markers
        // included: `## v3.7.1`. The string a model reads in the outline is
        // then exactly the string it passes back, so backticks or links
        // inside a heading cost nothing here.
        let bare = lines.text(heading.line).trim().to_string();

        while ancestors.last().is_some_and(|(level, _)| *level >= heading.level) {
            ancestors.pop();
        }
        let mut name = String::new();
        for (_, ancestor) in &ancestors {
            name.push_str(ancestor);
            name.push_str(SEPARATOR);
        }
        name.push_str(&bare);
        ancestors.push((heading.level, bare.clone()));

        units.push(lines.unit(name, bare, "heading", heading.line, last_line));
    }
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read::outline::{Grammar, PARSE_BUDGET, parse};

    fn outline(content: &str) -> Vec<Unit> {
        let tree = parse(content, Grammar::Markdown, PARSE_BUDGET).expect("parse");
        units(content, &tree).expect("units")
    }

    const NESTED: &str = "# Top\n\nintro\n\n## First\n\nalpha\n\n## Second\n\nomega\n";

    #[test]
    fn one_h1_over_two_h2s_yields_three_units() {
        let units = outline(NESTED);
        assert_eq!(units.len(), 3, "{units:#?}");
        assert_eq!(units[0].name, "# Top");
        assert_eq!(units[1].name, "# Top > ## First");
        assert_eq!(units[2].name, "# Top > ## Second");
    }

    #[test]
    fn the_h1_unit_spans_to_the_last_line_and_the_h2s_nest_inside_it() {
        let units = outline(NESTED);
        assert_eq!((units[0].first_line, units[0].last_line), (1, 11));
        assert_eq!((units[1].first_line, units[1].last_line), (5, 8));
        assert_eq!((units[2].first_line, units[2].last_line), (9, 11));
    }

    #[test]
    fn a_section_ends_on_the_line_before_the_next_same_level_heading() {
        let units = outline(NESTED);
        let first = &units[1];
        assert_eq!(first.last_line, 8);
        assert_eq!(&NESTED[first.first_byte..first.last_byte], "## First\n\nalpha\n\n");
    }

    #[test]
    fn a_units_bare_name_is_its_trimmed_source_line_with_its_markers() {
        let units = outline("## v3.7.1\n\nbody\n");
        assert_eq!(units[0].bare, "## v3.7.1");
        assert_eq!(units[0].name, "## v3.7.1");
        assert_eq!(units[0].kind, "heading");
    }

    #[test]
    fn a_file_with_no_heading_yields_no_units() {
        assert!(outline("just prose\n\nand more prose\n").is_empty());
    }

    #[test]
    fn lines_before_the_first_heading_become_a_preamble_unit() {
        let units = outline("---\nphase: 2\n---\n\n# Goal\n\nbody\n");
        assert_eq!(units[0].name, "(preamble)");
        assert_eq!((units[0].first_line, units[0].last_line), (1, 4));
        assert_eq!(units[1].name, "# Goal");
        assert_eq!(units[1].first_line, 5);
    }

    #[test]
    fn a_file_opening_on_a_heading_has_no_preamble_unit() {
        let units = outline(NESTED);
        assert!(units.iter().all(|unit| unit.name != "(preamble)"));
    }

    #[test]
    fn a_repeated_title_is_qualified_by_its_parent_heading() {
        let units = outline("## v2\n\n### Added\n\na\n\n## v1\n\n### Added\n\nb\n");
        let added: Vec<&str> = units.iter().filter(|unit| unit.bare == "### Added").map(|unit| unit.name.as_str()).collect();
        assert_eq!(added, vec!["## v2 > ### Added", "## v1 > ### Added"]);
    }

    #[test]
    fn a_setext_heading_is_named_by_its_title_line() {
        let units = outline("Title\n=====\n\nbody\n");
        assert_eq!(units[0].bare, "Title");
        assert_eq!(units[0].first_line, 1);
    }

    #[test]
    fn a_deep_heading_carries_every_ancestor_in_its_qualified_name() {
        let units = outline("# a\n\n## b\n\n### c\n\nbody\n");
        assert_eq!(units[2].name, "# a > ## b > ### c");
        assert_eq!(units[2].bare, "### c");
    }
}
