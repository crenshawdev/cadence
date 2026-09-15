use crate::read::{model::Unit, source};

pub fn units(content: &str) -> Vec<Unit> {
    let starts = source::line_starts(content);
    let mut rows = Vec::new();
    let mut stack: Vec<(String, usize, usize)> = Vec::new();
    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix("fn ") {
            let bare: String = rest.chars().take_while(|character| character.is_ascii_alphanumeric() || *character == '_').collect();
            if bare.is_empty() { continue; }
            let depth = line.len() - trimmed.len();
            while stack.last().is_some_and(|(_, _, parent_depth)| *parent_depth >= depth) { stack.pop(); }
            let first = index + 1;
            let end = find_block_end(content, starts[first - 1]);
            let last = source::line_for(&starts, end.saturating_sub(1));
            let name = if stack.is_empty() { bare.clone() } else { format!("{}::{bare}", stack.iter().map(|(name, _, _)| name.as_str()).collect::<Vec<_>>().join("::")) };
            rows.push(Unit { name, bare:bare.clone(), kind:"function".into(), first_line:first, last_line:last, first_byte:starts[first - 1], last_byte:end });
            stack.push((bare, end, depth));
        }
    }
    rows
}

fn find_block_end(content: &str, start: usize) -> usize {
    let mut depth = 0usize;
    let mut opened = false;
    for (offset, character) in content[start..].char_indices() {
        match character { '{' => { depth += 1; opened = true; }, '}' if opened => { depth -= 1; if depth == 0 {
            let end = start + offset + 1;
            return if content[end..].starts_with("\\n") { end + 2 } else { end + usize::from(content.as_bytes().get(end) == Some(&b'\n')) };
        } }, _ => {} }
    }
    content.len()
}
