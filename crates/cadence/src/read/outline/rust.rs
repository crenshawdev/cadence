//! Rust item units, qualified by their enclosing `impl` or `mod`.
//!
//! Every item the grammar gives a `name` field to becomes a unit, at any
//! depth, plus `impl_item`, which has no name of its own and is named from the
//! type it is written for. The qualifier joins with `::` because that is how
//! Rust itself reaches the same item.
//!
//! Names come from the grammar's own fields and the node's source text, never
//! from `tree-sitter-tags` or the bundled `tags.scm`: those queries carry
//! `#strip!` and `#select-adjacent!` directives a plain `QueryCursor` does not
//! apply, so using them would mean either an extra crate or names carrying
//! surrounding punctuation.

use super::{Lines, OutlineError, last_row, walk, widened_first_line};
use crate::read::model::Unit;
use tree_sitter::{Node, Tree};

const SEPARATOR: &str = "::";

/// The kind of unit an item node is, if it is one at all.
///
/// `impl_item` is here without a `name` field of its own: a reader asking for
/// `impl Default for Limits` wants the block, and it is the qualifier for
/// everything inside it.
fn item_kind(node: Node<'_>) -> Option<&'static str> {
    match node.kind() {
        "function_item" | "function_signature_item" => Some("function"),
        "struct_item" => Some("struct"),
        "enum_item" => Some("enum"),
        "union_item" => Some("union"),
        "trait_item" => Some("trait"),
        "mod_item" => Some("mod"),
        "type_item" => Some("type"),
        "const_item" => Some("const"),
        "static_item" => Some("static"),
        "macro_definition" => Some("macro"),
        "impl_item" => Some("impl"),
        _ => None,
    }
}

/// A type's own name without its generic arguments: `Lines<'a>` is `Lines`.
fn type_segment(text: &str) -> String {
    let head = text.split_once('<').map_or(text, |(head, _)| head).trim();
    if head.is_empty() { text.trim().to_string() } else { head.to_string() }
}

/// An `impl_item`'s display name and the qualifier it gives its contents.
///
/// The display name keeps the `impl` keyword and the trait, so
/// `impl Default for Limits` and `impl Limits` are two rows a caller can tell
/// apart. The qualifier is the type alone, so the methods inside read as
/// `Limits::default`, which is what the code itself calls them.
fn impl_names(node: Node<'_>, source: &[u8]) -> Option<(String, String)> {
    let type_text = node
        .child_by_field_name("type")
        .and_then(|ty| ty.utf8_text(source).ok())
        .map(type_segment)
        .filter(|text| !text.is_empty())?;
    let display = match node
        .child_by_field_name("trait")
        .and_then(|tr| tr.utf8_text(source).ok())
        .map(type_segment)
        .filter(|text| !text.is_empty())
    {
        Some(trait_text) => format!("impl {trait_text} for {type_text}"),
        None => format!("impl {type_text}"),
    };
    Some((display, type_text))
}

/// Whether a sibling above an item belongs to that item's span: an outer
/// attribute or a comment, but never an inner `//!` or `/*!` comment, which
/// documents the module it sits in rather than the item below it.
///
/// Attributes are required, not cosmetic: two definitions of one function
/// split by `#[cfg(...)]` are indistinguishable without the attribute line,
/// and an ambiguous answer would name two ranges a reader cannot tell apart.
fn attaches(node: Node<'_>, source: &[u8]) -> bool {
    match node.kind() {
        "attribute_item" => true,
        "line_comment" | "block_comment" => {
            !node.utf8_text(source).is_ok_and(|text| text.starts_with("//!") || text.starts_with("/*!"))
        }
        _ => false,
    }
}

/// One unit per named item, at any depth, qualified by the items it sits
/// inside.
pub fn units(content: &str, tree: &Tree) -> Result<Vec<Unit>, OutlineError> {
    let lines = Lines::new(content);
    let source = content.as_bytes();
    let mut units = Vec::new();
    // The enclosing items of the node being visited, as (walk depth,
    // qualifier). Pushed as the cursor descends and popped as it ascends.
    let mut enclosing: Vec<(usize, String)> = Vec::new();

    walk(tree, |node, depth| {
        while enclosing.last().is_some_and(|(at, _)| *at >= depth) {
            enclosing.pop();
        }
        let Some(kind) = item_kind(node) else { return };
        let Some((bare, qualifier)) = (if node.kind() == "impl_item" {
            impl_names(node, source)
        } else {
            node.child_by_field_name("name")
                .and_then(|name| name.utf8_text(source).ok())
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .map(|name| (name.to_string(), name.to_string()))
        }) else {
            // No name means nothing to pass back, so there is no row to write.
            return;
        };

        let mut name = String::new();
        for (_, ancestor) in &enclosing {
            name.push_str(ancestor);
            name.push_str(SEPARATOR);
        }
        name.push_str(&bare);
        enclosing.push((depth, qualifier));

        let first = widened_first_line(node, |prev| attaches(prev, source));
        units.push(lines.unit(name, bare, kind, first, last_row(node) + 1));
    })?;

    // Document order by line, not by discovery: widening a span up over its
    // attributes moves a start line earlier. Stable, so an item and something
    // declared inside it on the same line keep parent-before-child order.
    units.sort_by_key(|unit| unit.first_line);
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read::outline::{Grammar, PARSE_BUDGET, parse};

    fn outline(content: &str) -> Vec<Unit> {
        let tree = parse(content, Grammar::Rust, PARSE_BUDGET).expect("parse");
        units(content, &tree).expect("units")
    }

    fn names(units: &[Unit]) -> Vec<&str> {
        units.iter().map(|unit| unit.name.as_str()).collect()
    }

    #[test]
    fn a_method_is_qualified_by_the_type_its_impl_is_written_for() {
        let units = outline(
            "pub struct Limits {\n    pub bytes: usize,\n}\n\n\
             impl Default for Limits {\n    fn default() -> Self {\n        Self { bytes: 1 }\n    }\n}\n",
        );
        assert_eq!(names(&units), vec!["Limits", "impl Default for Limits", "Limits::default"]);
        assert_eq!(units[0].kind, "struct");
        assert_eq!(units[1].kind, "impl");
        assert_eq!(units[2].kind, "function");
        assert_eq!(units[2].bare, "default");
    }

    #[test]
    fn an_inherent_impl_names_itself_by_its_type_alone() {
        let units = outline("impl<'a> Lines<'a> {\n    pub fn new() {}\n}\n");
        assert_eq!(names(&units), vec!["impl Lines", "Lines::new"]);
    }

    #[test]
    fn a_module_qualifies_what_is_declared_inside_it() {
        let units = outline("mod inner {\n    struct S;\n    fn go() {}\n}\n");
        assert_eq!(names(&units), vec!["inner", "inner::S", "inner::go"]);
    }

    #[test]
    fn a_trait_and_a_function_nested_in_a_function_are_both_units() {
        let units = outline("trait Read {\n    fn read(&self);\n}\n\nfn outer() {\n    fn inner() {}\n}\n");
        assert_eq!(names(&units), vec!["Read", "Read::read", "outer", "outer::inner"]);
    }

    /// Two definitions of one name, told apart only by the `cfg` above them.
    #[test]
    fn a_span_takes_in_the_attributes_and_doc_comments_above_it() {
        let source = "/// This process and its ancestors.\n\
             #[cfg(target_os = \"linux\")]\n\
             fn process_ancestors() -> Vec<i64> {\n    vec![]\n}\n\n\
             #[cfg(not(target_os = \"linux\"))]\n\
             fn process_ancestors() -> Vec<i64> {\n    vec![]\n}\n";
        let units = outline(source);
        assert_eq!(units.len(), 2, "{units:#?}");
        assert_eq!((units[0].first_line, units[0].last_line), (1, 5));
        assert_eq!((units[1].first_line, units[1].last_line), (7, 10));
        assert_eq!(units[0].name, "process_ancestors");
        assert_eq!(units[1].name, "process_ancestors");
        assert_eq!(&source[units[0].first_byte..units[0].last_byte], &source[..source.find("\n\n").unwrap() + 1]);
    }

    /// A blank line ends the run, so a comment that trails the item above is
    /// not swallowed into the item below.
    #[test]
    fn a_comment_separated_by_a_blank_line_is_not_part_of_the_span() {
        let units = outline("// a note about nothing in particular\n\nfn alpha() {}\n");
        assert_eq!(units[0].first_line, 3);
    }

    #[test]
    fn an_inner_doc_comment_is_never_taken_into_the_item_below_it() {
        let units = outline("//! module docs\nfn alpha() {}\n");
        assert_eq!(units[0].first_line, 2);
    }

    #[test]
    fn types_consts_statics_and_macros_are_listed() {
        let units = outline("type Alias = u8;\nconst MAX: usize = 1;\nstatic NAME: &str = \"a\";\nmacro_rules! shout {\n    () => {};\n}\n");
        assert_eq!(names(&units), vec!["Alias", "MAX", "NAME", "shout"]);
        assert_eq!(units[3].kind, "macro");
    }

    #[test]
    fn a_file_with_no_items_yields_no_units() {
        assert!(outline("// just a comment\n").is_empty());
        assert!(outline("use std::collections::BTreeMap;\n").is_empty());
    }

    /// The reason the brace counters were replaced: `pub fn units` inside a
    /// `mod` and a struct's fields were unreachable.
    #[test]
    fn a_struct_field_and_an_enum_variant_sit_inside_a_named_unit() {
        let source = "pub struct Unit {\n    pub name: String,\n}\n\npub enum Kind {\n    Heading,\n}\n";
        let units = outline(source);
        assert_eq!(names(&units), vec!["Unit", "Kind"]);
        assert_eq!((units[0].first_line, units[0].last_line), (1, 3));
        assert_eq!((units[1].first_line, units[1].last_line), (5, 7));
    }
}
