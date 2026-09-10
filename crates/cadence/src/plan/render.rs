//! Only strict frontmatter is rendered; the authored body is appended unchanged.
use super::model::Content;
use cadence::store::{Error, Result};

pub fn document(content: &Content) -> Result<Vec<u8>> {
    // JSON field values are also YAML values. Block keys preserve the native
    // reader's canonical-number span checks without a second schema dialect.
    let mut text = format!("---\nphase: {}\nplan: {}\n", content.phase, content.plan);
    for (key, value) in [
        ("requirements", serde_json::to_value(&content.requirements)?),
        ("files", serde_json::to_value(&content.files)?),
        ("directories", serde_json::to_value(&content.directories)?),
        ("execution", serde_json::to_value(&content.execution)?),
    ] {
        text.push_str(&format!("{key}: {}\n", serde_json::to_string(&value)?));
    }
    text.push_str("---\n");
    text.push_str(&content.body);
    let bytes = text.into_bytes();
    cadence::execution::plan::parse_plan(&bytes, content.phase.get(), content.plan.get())
        .map_err(|error| Error::Invalid(error.to_string()))?;
    Ok(bytes)
}
