//! C units: function definitions and prototypes, named struct, union and enum
//! definitions, typedefs, preprocessor macros and file-scope declarations.
//!
//! Excerpt had no C grammar; this extractor is Cadence's own, on the
//! `tree-sitter-c` grammar the manifest already declared. Names are flat: C
//! has no enclosing named scope a reader would write, and a `struct` defined
//! inside another is reached by its own tag.
//!
//! Local variables are not units. A `declaration` inside a function body is
//! skipped, because listing every local would turn an outline into the
//! function body it exists to summarize.

use super::{Lines, OutlineError, last_row, walk, widened_first_line};
use crate::read::model::Unit;
use tree_sitter::{Node, Tree};

/// The identifier at the bottom of a declarator chain: `*(*name)[3]` is
/// `name`, `int (*fn)(void)` is `fn`.
fn declared_name<'a>(node: Node<'_>, source: &'a [u8]) -> Option<&'a str> {
    let mut current = node;
    loop {
        match current.kind() {
            "identifier" | "type_identifier" | "field_identifier" => {
                return current.utf8_text(source).ok().map(str::trim).filter(|name| !name.is_empty());
            }
            "init_declarator" | "pointer_declarator" | "function_declarator" | "array_declarator" => {
                current = current.child_by_field_name("declarator")?;
            }
            "parenthesized_declarator" | "attributed_declarator" => {
                let mut cursor = current.walk();
                current = current.children(&mut cursor).find(|child| child.is_named() && child.kind() != "attribute_declaration")?;
            }
            _ => return None,
        }
    }
}

/// Whether the declarator chain under `node` declares a function rather than
/// a variable: `go(int)` and `*name(void)` do, `(*handler)(void)` is a
/// function pointer and does not, and anything with an initializer is a
/// variable.
fn declares_function(node: Node<'_>) -> bool {
    match node.kind() {
        "function_declarator" => node.child_by_field_name("declarator").is_some_and(|inner| inner.kind() == "identifier"),
        "pointer_declarator" => node.child_by_field_name("declarator").is_some_and(declares_function),
        "attributed_declarator" => {
            let mut cursor = node.walk();
            node.children(&mut cursor).find(|child| child.is_named()).is_some_and(declares_function)
        }
        _ => false,
    }
}

/// Whether `node` sits inside a function body, at any depth.
fn inside_a_body(node: Node<'_>) -> bool {
    let mut current = node.parent();
    while let Some(parent) = current {
        if parent.kind() == "compound_statement" {
            return true;
        }
        current = parent.parent();
    }
    false
}

/// The unit a node is, as (kind, bare name), if it is one at all.
fn unit_of<'a>(node: Node<'_>, source: &'a [u8]) -> Option<(&'static str, &'a str)> {
    match node.kind() {
        "function_definition" => Some(("function", declared_name(node.child_by_field_name("declarator")?, source)?)),
        "declaration" if !inside_a_body(node) => {
            let declarator = node.child_by_field_name("declarator")?;
            let kind = if declares_function(declarator) { "prototype" } else { "variable" };
            Some((kind, declared_name(declarator, source)?))
        }
        // A tag with a body is a definition; `struct foo;` or a use of the
        // type in a declaration is not a unit of its own.
        "struct_specifier" | "union_specifier" | "enum_specifier" if node.child_by_field_name("body").is_some() => {
            let kind = match node.kind() {
                "struct_specifier" => "struct",
                "union_specifier" => "union",
                _ => "enum",
            };
            Some((kind, node.child_by_field_name("name")?.utf8_text(source).ok()?.trim()))
        }
        "type_definition" => Some(("typedef", declared_name(node.child_by_field_name("declarator")?, source)?)),
        "preproc_def" | "preproc_function_def" => Some(("macro", node.child_by_field_name("name")?.utf8_text(source).ok()?.trim())),
        _ => None,
    }
}

/// One unit per definition, in document order, each widened up over the
/// comments directly above it.
pub fn units(content: &str, tree: &Tree) -> Result<Vec<Unit>, OutlineError> {
    let lines = Lines::new(content);
    let source = content.as_bytes();
    let mut units = Vec::new();
    walk(tree, |node, _depth| {
        let Some((kind, bare)) = unit_of(node, source) else { return };
        if bare.is_empty() {
            return;
        }
        let first = widened_first_line(node, |prev| prev.kind() == "comment");
        units.push(lines.unit(bare.to_string(), bare.to_string(), kind, first, last_row(node) + 1));
    })?;
    units.sort_by_key(|unit| unit.first_line);
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read::outline::{Grammar, PARSE_BUDGET, parse};

    fn outline(content: &str) -> Vec<Unit> {
        let tree = parse(content, Grammar::C, PARSE_BUDGET).expect("parse");
        units(content, &tree).expect("units")
    }

    fn names(units: &[Unit]) -> Vec<(&str, &str)> {
        units.iter().map(|unit| (unit.name.as_str(), unit.kind)).collect()
    }

    #[test]
    fn a_function_definition_is_named_through_its_declarator_chain() {
        let units = outline("int c_unit(void) {\n  int needle = 1;\n  return needle;\n}\n\nstatic char *name(int x) { return 0; }\n");
        assert_eq!(names(&units), vec![("c_unit", "function"), ("name", "function")]);
        assert_eq!((units[0].first_line, units[0].last_line), (1, 4));
    }

    #[test]
    fn a_local_variable_is_not_a_unit_but_a_file_scope_one_is() {
        let units = outline("static const int table[] = {1, 2};\nint go(void) {\n  int local = 1;\n  return local;\n}\n");
        assert_eq!(names(&units), vec![("table", "variable"), ("go", "function")]);
    }

    #[test]
    fn prototypes_typedefs_tags_and_macros_are_listed() {
        let source = "#define MAX 3\n#define SQUARE(x) ((x) * (x))\nint go(int x);\n\
                      struct point { int x; int y; };\ntypedef struct { int a; } pair_t;\n\
                      typedef struct point point_t;\nenum color { RED, BLUE };\nunion u { int i; float f; };\n";
        let units = outline(source);
        assert_eq!(
            names(&units),
            vec![
                ("MAX", "macro"),
                ("SQUARE", "macro"),
                ("go", "prototype"),
                ("point", "struct"),
                ("pair_t", "typedef"),
                ("point_t", "typedef"),
                ("color", "enum"),
                ("u", "union"),
            ]
        );
    }

    #[test]
    fn a_comment_directly_above_a_function_is_part_of_its_span() {
        let units = outline("/* Adds one. */\nint inc(int x) {\n  return x + 1;\n}\n\n// trailing\n\nint dec(int x) { return x - 1; }\n");
        assert_eq!((units[0].first_line, units[0].last_line), (1, 4));
        assert_eq!(units[1].first_line, 8);
    }

    #[test]
    fn a_function_pointer_variable_is_named_by_its_inner_identifier() {
        let units = outline("int (*handler)(void) = 0;\nint (*table[3])(void);\nchar *name(int x);\n");
        assert_eq!(names(&units), vec![("handler", "variable"), ("table", "variable"), ("name", "prototype")]);
    }

    #[test]
    fn a_header_of_includes_alone_yields_no_units() {
        assert!(outline("#include <stdio.h>\n#include \"x.h\"\n").is_empty());
    }
}
