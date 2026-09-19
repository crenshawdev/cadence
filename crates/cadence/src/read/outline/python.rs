//! Python function and class units, at any depth.
//!
//! Every `function_definition` and `class_definition` the walk reaches becomes
//! a unit, so methods and closures defined inside another function are listed
//! and not only the module's top level. The qualifier joins with `.` because
//! that is how the code itself reaches a method: `Parser.read`.

use super::{Lines, OutlineError, last_row, walk};
use crate::read::model::Unit;
use tree_sitter::{Node, Tree};

const SEPARATOR: char = '.';

fn definition_kind(node: Node<'_>) -> Option<&'static str> {
    match node.kind() {
        "function_definition" => Some("function"),
        "class_definition" => Some("class"),
        _ => None,
    }
}

/// The node whose span the unit takes: the `decorated_definition` a
/// definition sits inside, so a fetched unit carries its decorators. A
/// `@property` served without its decorator reads as a method where the
/// source has an attribute, and a caller cannot see the decorator is missing
/// because the unit's first line is the `def` either way.
fn span_node(node: Node<'_>) -> Node<'_> {
    match node.parent() {
        Some(parent)
            if parent.kind() == "decorated_definition"
                && parent.child_by_field_name("definition").is_some_and(|inner| inner == node) =>
        {
            parent
        }
        _ => node,
    }
}

/// One unit per function or class, at any depth, qualified by the definitions
/// it sits inside.
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
        units.push(lines.unit(name, bare.to_string(), kind, span.start_position().row + 1, last_row(span) + 1));
    })?;

    // Document order by line: widening a span to its decorators moves a start
    // line earlier. Stable, so a definition still precedes what is nested
    // inside it when both open on the same line.
    units.sort_by_key(|unit| unit.first_line);
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read::outline::{Grammar, PARSE_BUDGET, parse};

    fn outline(content: &str) -> Vec<Unit> {
        let tree = parse(content, Grammar::Python, PARSE_BUDGET).expect("parse");
        units(content, &tree).expect("units")
    }

    fn names(units: &[Unit]) -> Vec<&str> {
        units.iter().map(|unit| unit.name.as_str()).collect()
    }

    #[test]
    fn methods_are_qualified_by_their_class() {
        let units = outline("class Parser:\n    def read(self):\n        return 1\n\n    def write(self):\n        return 2\n");
        assert_eq!(names(&units), vec!["Parser", "Parser.read", "Parser.write"]);
        assert_eq!(units[0].kind, "class");
        assert_eq!(units[1].kind, "function");
        assert_eq!(units[1].bare, "read");
    }

    #[test]
    fn a_function_defined_inside_another_is_listed_and_qualified() {
        let units = outline("def outer():\n    def inner():\n        pass\n    return inner\n");
        assert_eq!(names(&units), vec!["outer", "outer.inner"]);
        assert_eq!((units[1].first_line, units[1].last_line), (2, 3));
    }

    #[test]
    fn a_decorated_definition_starts_on_its_first_decorator_line() {
        let units = outline("class C:\n    @property\n    @cached\n    def value(self):\n        return 1\n");
        assert_eq!(units[1].name, "C.value");
        assert_eq!((units[1].first_line, units[1].last_line), (2, 5));
    }

    #[test]
    fn a_class_nested_in_a_function_carries_both_ancestors() {
        let units = outline("def build():\n    class Inner:\n        def go(self):\n            pass\n");
        assert_eq!(names(&units), vec!["build", "build.Inner", "build.Inner.go"]);
    }

    #[test]
    fn a_module_of_statements_alone_yields_no_units() {
        assert!(outline("import os\n\nvalue = os.getcwd()\n").is_empty());
    }
}
