use crate::read::{model::Unit, source};
pub fn units(content: &str) -> Vec<Unit> {
    let starts = source::line_starts(content);
    content.lines().enumerate().filter_map(|(index, line)| {
        let trimmed = line.trim_start();
        let rest = trimmed.strip_prefix('"')?;
        let (bare, _) = rest.split_once('"')?;
        let first=index+1; let start=starts[first-1]; let end=starts.get(first).copied().unwrap_or(content.len());
        Some(Unit { name:bare.into(), bare:bare.into(), kind:"member".into(), first_line:first,last_line:first,first_byte:start,last_byte:end })
    }).collect()
}
