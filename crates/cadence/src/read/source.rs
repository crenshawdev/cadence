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

/// The whole file as one unit, for a file with no grammar or no units.
pub fn fallback(path: &Path, content: &str) -> Vec<Unit> {
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("source").to_owned();
    let last_line = content.split_inclusive('\n').count().max(1);
    vec![Unit { name: name.clone(), bare: name, kind: "source", first_line: 1, last_line, first_byte: 0, last_byte: content.len() }]
}
