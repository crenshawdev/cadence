use crate::read::{model::Unit, source};
pub fn units(content: &str) -> Vec<Unit> { source::simple_markdown(content) }
