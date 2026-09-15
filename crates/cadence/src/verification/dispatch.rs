use super::{inputs::Inputs, instructions};

pub fn prompt(inputs: &Inputs, documents: &std::collections::BTreeMap<String, String>) -> crate::store::Result<String> {
    let authored: std::collections::BTreeMap<_, _> = inputs.basis.publications.iter().filter_map(|p| {
        let path = format!("phases/{}/PLAN-{}.md", inputs.basis.phase, p.plan);
        documents.get(&path).map(|body| (path, body))
    }).collect();
    Ok(format!("{}\n<operational-input>\n{}\n</operational-input>\n<authored-material>\n{}\n</authored-material>\n",
        instructions::contract_markdown(), serde_json::to_string_pretty(inputs)?, serde_json::to_string_pretty(&authored)?))
}
