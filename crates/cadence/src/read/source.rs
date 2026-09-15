use super::model::Unit;
use sha2::{Digest, Sha256};
use std::{fs, path::{Path, PathBuf}};

pub fn revision(content: &str) -> String { format!("{:x}", Sha256::digest(content.as_bytes())) }

pub fn confined(project: &Path, path: &Path) -> Option<PathBuf> {
    let canonical = fs::canonicalize(path).ok()?;
    if canonical.strip_prefix(project).is_ok() { Some(canonical) } else { None }
}

pub fn content(project: &Path, path: &Path) -> Result<(PathBuf, String, String), String> {
    let path = confined(project, path).ok_or_else(|| "source target escapes the bound project".to_string())?;
    let metadata = fs::metadata(&path).map_err(|_| "source target is unavailable".to_string())?;
    if !metadata.is_file() { return Err("source target is not a regular file".into()); }
    let bytes = fs::read(&path).map_err(|_| "source target cannot be read".to_string())?;
    let text = String::from_utf8(bytes).map_err(|_| "source target is not UTF-8 text".to_string())?;
    Ok((path, revision(&text), text))
}

pub fn line_starts(content: &str) -> Vec<usize> {
    let mut starts = vec![0];
    starts.extend(content.match_indices('\n').map(|(index, _)| index + 1));
    starts
}

pub fn line_for(starts: &[usize], byte: usize) -> usize {
    starts.partition_point(|start| *start <= byte).max(1)
}

pub fn bytes_for_lines(content: &str, first: usize, last: usize) -> (usize, usize) {
    let starts = line_starts(content);
    let start = starts.get(first.saturating_sub(1)).copied().unwrap_or(content.len());
    let end = starts.get(last).copied().unwrap_or(content.len());
    (start, end)
}

pub fn simple_markdown(content: &str) -> Vec<Unit> {
    let starts = line_starts(content);
    let headings: Vec<(usize, usize, String)> = content.lines().enumerate().filter_map(|(index, line)| {
        let trimmed = line.trim_start();
        let hashes = trimmed.chars().take_while(|character| *character == '#').count();
        (hashes > 0 && trimmed.as_bytes().get(hashes) == Some(&b' ')).then(|| (index + 1, hashes, line.trim().to_owned()))
    }).collect();
    if headings.is_empty() { return Vec::new(); }
    let total = starts.len();
    headings.iter().enumerate().map(|(index, (line, level, bare))| {
        let last = headings[index + 1..].iter().find(|(_, next_level, _)| next_level <= level).map_or(total, |(next, _, _)| next - 1);
        let (first_byte, last_byte) = bytes_for_lines(content, *line, last);
        Unit { name: bare.clone(), bare: bare.clone(), kind: "heading".into(), first_line:*line, last_line:last, first_byte, last_byte }
    }).collect()
}

pub fn fallback(path: &Path, content: &str) -> Vec<Unit> {
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("source").to_owned();
    let last_line = line_starts(content).len();
    vec![Unit { name: name.clone(), bare:name, kind:"source".into(), first_line:1, last_line, first_byte:0, last_byte:content.len() }]
}
