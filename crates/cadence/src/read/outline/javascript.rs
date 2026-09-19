//! JavaScript named-definition units.
//!
//! Named definitions only, at any nesting depth. An anonymous inline callback
//! has no name to pass back, so listing it gives a model a row it cannot act
//! on: one measured test file had 28 named definitions against 391 `=>`
//! occurrences. Anonymous functions stay reachable as search windows.
//!
//! Names come from the grammar's own `name` field and the node's source text,
//! not from `tree-sitter-tags` or the bundled `tags.scm`, whose `#strip!` and
//! `#select-adjacent!` directives a plain `QueryCursor` does not apply.

use super::{Lines, OutlineError, walk};
use crate::read::model::Unit;
use tree_sitter::{Node, Tree};

/// An arrow function bound to `m` inside `parseCursor` is `parseCursor.m`,
/// which is how the source itself would reach it.
const SEPARATOR: char = '.';

/// The kind of unit a node is, if it is a named definition at all.
///
/// A `variable_declarator` counts only when its `value` is a function or a
/// class (`const x = 1` is not a definition an outline is about) and only
/// when its `name` is a plain identifier, since a destructuring pattern has
/// no single name to pass back.
fn definition_kind(node: Node<'_>) -> Option<&'static str> {
    match node.kind() {
        "function_declaration" => Some("function"),
        "generator_function_declaration" => Some("generator"),
        "class_declaration" => Some("class"),
        "method_definition" => Some("method"),
        "variable_declarator" => {
            if node.child_by_field_name("name")?.kind() != "identifier" {
                return None;
            }
            match node.child_by_field_name("value")?.kind() {
                "arrow_function" | "function_expression" => Some("function"),
                "generator_function" => Some("generator"),
                "class" => Some("class"),
                _ => None,
            }
        }
        _ => None,
    }
}

/// The node whose span the unit takes: widened past the definition node to
/// the statement that introduces it, so a fetched unit reads as the
/// definition it names. `export` belongs to `export function parseCursor`,
/// and `const` belongs to `const m = ...`, but the grammar puts the
/// definition node inside both.
fn span_node(node: Node<'_>) -> Node<'_> {
    let mut current = node;
    while let Some(parent) = current.parent() {
        match parent.kind() {
            "lexical_declaration" | "variable_declaration" if current.kind() == "variable_declarator" => {}
            "export_statement" => {}
            _ => break,
        }
        current = parent;
    }
    current
}

/// One unit per named definition, at any depth, qualified by the named
/// definitions it sits inside.
pub fn units(content: &str, tree: &Tree) -> Result<Vec<Unit>, OutlineError> {
    let lines = Lines::new(content);
    let source = content.as_bytes();
    let mut units = Vec::new();
    let mut enclosing: Vec<(usize, String)> = Vec::new();

    walk(tree, |node, depth| {
        while enclosing.last().is_some_and(|(at, _)| *at >= depth) {
            enclosing.pop();
        }
        let Some(kind) = definition_kind(node) else { return };
        let Some(bare) = node
            .child_by_field_name("name")
            .and_then(|name| name.utf8_text(source).ok())
            .map(str::trim)
            .filter(|name| !name.is_empty())
        else {
            return;
        };

        let mut name = String::new();
        for (_, ancestor) in &enclosing {
            name.push_str(ancestor);
            name.push(SEPARATOR);
        }
        name.push_str(bare);
        enclosing.push((depth, bare.to_string()));

        let span = span_node(node);
        units.push(lines.unit(name, bare.to_string(), kind, span.start_position().row + 1, span.end_position().row + 1));
    })?;

    // Document order by position, not by discovery: widening a span to its
    // `export` or `const` statement can move a start line earlier.
    units.sort_by_key(|unit| (unit.first_line, unit.last_line));
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read::outline::{Grammar, PARSE_BUDGET, parse};

    fn outline(content: &str) -> Vec<Unit> {
        let tree = parse(content, Grammar::JavaScript, PARSE_BUDGET).expect("parse");
        units(content, &tree).expect("units")
    }

    fn names(units: &[Unit]) -> Vec<&str> {
        units.iter().map(|unit| unit.name.as_str()).collect()
    }

    #[test]
    fn a_function_defined_inside_another_is_listed_and_qualified() {
        let units = outline("export function parseCursor(text) {\n  const m = (re) => text.match(re);\n  return m;\n}\n");
        assert_eq!(names(&units), vec!["parseCursor", "parseCursor.m"]);
        assert_eq!((units[0].first_line, units[0].last_line), (1, 4));
        assert_eq!((units[1].first_line, units[1].last_line), (2, 2));
    }

    #[test]
    fn a_file_of_anonymous_callbacks_yields_no_units() {
        let units = outline("run(() => {\n  go(function () {\n    items.map((x) => x + 1);\n  });\n});\n");
        assert!(units.is_empty(), "{units:#?}");
    }

    #[test]
    fn classes_methods_and_generators_are_listed_and_qualified() {
        let units = outline("class Parser {\n  read() {\n    return 1;\n  }\n  *walk() {}\n}\nconst Other = class {};\nfunction* gen() {}\n");
        assert_eq!(names(&units), vec!["Parser", "Parser.read", "Parser.walk", "Other", "gen"]);
        assert_eq!(units[0].kind, "class");
        assert_eq!(units[1].kind, "method");
        assert_eq!(units[2].kind, "method");
        assert_eq!(units[3].kind, "class");
        assert_eq!(units[4].kind, "generator");
    }

    #[test]
    fn a_span_takes_in_the_export_and_const_keywords_around_it() {
        let source = "export const build = (a) => a;\n";
        let units = outline(source);
        assert_eq!(units[0].first_line, 1);
        assert_eq!((units[0].first_byte, units[0].last_byte), (0, source.len()));
    }

    #[test]
    fn a_declarator_bound_to_something_that_is_not_a_function_is_not_a_unit() {
        let units = outline("const total = 1;\nconst { a, b } = require('x');\n");
        assert!(units.is_empty(), "{units:#?}");
    }
}
