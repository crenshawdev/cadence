use crate::read::{model::Unit, source};

pub fn units(content: &str) -> Vec<Unit> {
    let starts = source::line_starts(content);
    content.lines().enumerate().filter_map(|(index, line)| {
        let trimmed = line.trim_start();
        let rest = trimmed.strip_prefix("function ")?;
        let bare: String = rest.chars().take_while(|character| character.is_ascii_alphanumeric() || *character == '_').collect();
        (!bare.is_empty()).then(|| {
            let first = index + 1; let start = starts[first - 1]; let end = block_end(content, start);
            Unit { name:bare.clone(), bare, kind:"function".into(), first_line:first, last_line:source::line_for(&starts, end.saturating_sub(1)), first_byte:start, last_byte:end }
        })
    }).collect()
}
fn block_end(content: &str, start: usize) -> usize { let mut depth=0; let mut opened=false; for (offset, character) in content[start..].char_indices() { match character {'{'=>{depth+=1;opened=true},'}' if opened=>{depth-=1;if depth==0{let end=start+offset+1;return end+usize::from(content.as_bytes().get(end)==Some(&b'\n'));}},_=>{}} } content.len() }
