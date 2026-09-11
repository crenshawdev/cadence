//! Explicit authored sources, with no operational-file or quarantine fallback.
use super::{Candidate, Provenance};
use cadence::store::model::digest;
use std::{
    collections::BTreeMap,
    fs, io,
    path::{Path, PathBuf},
};

#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct Documents {
    pub candidates: Vec<Candidate>,
    pub identities: BTreeMap<String, String>,
    pub incomplete: Vec<String>,
}

fn phase(name: &str) -> bool {
    let parts: Vec<_> = name.split('.').collect();
    parts.len() <= 2
        && parts.iter().all(|p| {
            !p.is_empty()
                && (p.len() == 1 || !p.starts_with('0'))
                && p.bytes().all(|b| b.is_ascii_digit())
        })
}
fn slug(name: &str) -> bool {
    !name.is_empty()
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn relative_parts(path: &str) -> Vec<&str> {
    path.split('/').collect()
}
fn unarchive<'a>(parts: &'a [&'a str]) -> &'a [&'a str] {
    match parts {
        [first, rest @ ..] if first.starts_with("_archive-") => rest,
        ["archive" | "archives", _, rest @ ..] => rest,
        _ => parts,
    }
}

pub fn eligible(path: &str) -> bool {
    let parts = relative_parts(path);
    if parts.iter().any(|p| matches!(*p, "" | "." | "..")) {
        return false;
    }
    let archived = unarchive(&parts);
    let (home, file) = match archived.split_last() {
        Some((f, h)) => (h, *f),
        None => return false,
    };
    let ordinary = matches!(
        file,
        "PROJECT.md" | "ROADMAP.md" | "CONTEXT.md" | "SUMMARY.md"
    );
    match home {
        [] => ordinary,
        ["phases", n] | [n] if phase(n) => ordinary || file == "UAT.md",
        ["tasks", name] if slug(name) => ordinary || matches!(file, "UAT.md" | "RECORD.md"),
        _ => false,
    }
}

fn directory(path: &str) -> bool {
    let parts = relative_parts(path);
    if matches!(parts.as_slice(), ["archive" | "archives"]) {
        return true;
    }
    let home = unarchive(&parts);
    match home {
        [] | ["phases" | "tasks"] => true,
        ["phases", n] | [n] => phase(n),
        ["tasks", name] => slug(name),
        _ => false,
    }
}

pub trait ReadDocuments {
    fn list(&mut self, path: &Path) -> io::Result<Vec<PathBuf>>;
    fn text(&mut self, path: &Path) -> io::Result<String>;
}
pub struct Files;
impl ReadDocuments for Files {
    fn list(&mut self, path: &Path) -> io::Result<Vec<PathBuf>> {
        fs::read_dir(path)?
            .map(|entry| entry.map(|e| e.path()))
            .collect()
    }
    fn text(&mut self, path: &Path) -> io::Result<String> {
        fs::read_to_string(path)
    }
}

pub fn read(root: &Path, io: &mut impl ReadDocuments) -> Documents {
    let mut result = Documents::default();
    let root = match root.canonicalize() {
        Ok(root) => root,
        Err(e) if e.kind() == io::ErrorKind::NotFound && fs::symlink_metadata(root).is_err() => {
            return result;
        }
        Err(e) => {
            result
                .incomplete
                .push(format!("planning root unavailable: {e}"));
            return result;
        }
    };
    fn walk(root: &Path, dir: &Path, io: &mut impl ReadDocuments, out: &mut Documents) {
        let mut entries = match io.list(dir) {
            Ok(entries) => entries,
            Err(e) => {
                out.incomplete
                    .push(format!("{}: directory unavailable: {e}", dir.display()));
                return;
            }
        };
        entries.sort();
        for path in entries {
            let Ok(relative) = path.strip_prefix(root) else {
                continue;
            };
            let Some(name) = relative.to_str() else {
                out.incomplete.push("non-UTF8 planning path skipped".into());
                continue;
            };
            if !eligible(name) && !directory(name) {
                continue;
            }
            let metadata = match fs::symlink_metadata(&path) {
                Ok(m) => m,
                Err(e) => {
                    out.incomplete
                        .push(format!("{name}: metadata unavailable: {e}"));
                    continue;
                }
            };
            // Refusing links also prevents cycles and alias duplication. Check
            // canonical containment again at the read boundary.
            if metadata.file_type().is_symlink()
                || !path.canonicalize().is_ok_and(|p| p.starts_with(root))
            {
                out.incomplete
                    .push(format!("{name}: linked or escaping source skipped"));
                continue;
            }
            if metadata.is_dir() && directory(name) {
                walk(root, &path, io, out);
            } else if metadata.is_file() && eligible(name) {
                match io.text(&path) {
                    Ok(text) => {
                        out.identities.insert(name.into(), digest(text.as_bytes()));
                        out.candidates.extend(snippets(name, &text, None));
                    }
                    Err(e) => out
                        .incomplete
                        .push(format!("{name}: source unavailable: {e}")),
                }
            }
        }
    }
    walk(&root, &root, io, &mut result);
    result
}

fn heading(line: &str) -> Option<(usize, &str)> {
    let n = line.bytes().take_while(|b| *b == b'#').count();
    (n > 0 && n <= 6 && line.as_bytes().get(n) == Some(&b' '))
        .then(|| (n, line[n + 1..].trim().trim_end_matches('#').trim()))
}

fn fence(line: &str, state: &mut Option<(u8, usize)>) -> bool {
    let text = line.trim_start();
    let first = text.bytes().next().unwrap_or(0);
    let n = text.bytes().take_while(|b| *b == first).count();
    let inside = state.is_some();
    if matches!(first, b'`' | b'~') && n >= 3 {
        match *state {
            Some((kind, size)) if first == kind && n >= size && text[n..].trim().is_empty() => {
                *state = None
            }
            None => *state = Some((first, n)),
            _ => {}
        }
        return true;
    }
    inside
}

/// Stable paragraph starts and verbatim continuations provide usable line
/// citations. A fenced heading cannot change durable/local decision scope.
pub fn snippets(path: &str, text: &str, commit: Option<&str>) -> Vec<Candidate> {
    let normalized = text
        .trim_start_matches('\u{feff}')
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    let mut state = None;
    let durable = normalized
        .lines()
        .any(|line| !fence(line, &mut state) && heading(line) == Some((2, "Durable decisions")));
    let context = path.ends_with("/CONTEXT.md") || path == "CONTEXT.md";
    let mut result = Vec::new();
    let mut title = String::new();
    let mut excluded = false;
    let mut body = String::new();
    let mut start = 1;
    state = None;
    let flush = |body: &mut String, start: usize, title: &str, result: &mut Vec<Candidate>| {
        if !body.trim().is_empty() {
            result.push(Candidate {
                text: body.trim_end().into(),
                item_id: None,
                provenance: Provenance::Document {
                    path: path.into(),
                    line: start,
                    heading: title.into(),
                    commit: commit.map(str::to_string),
                },
            });
        }
        body.clear();
    };
    for (i, line) in normalized.lines().enumerate() {
        let fenced = fence(line, &mut state);
        if !fenced && let Some((depth, name)) = heading(line) {
            flush(&mut body, start, &title, &mut result);
            if depth <= 2 {
                excluded = context && durable && depth == 2 && name == "Decisions";
            }
            if !excluded {
                title = name.into();
                result.push(Candidate {
                    text: name.into(),
                    item_id: None,
                    provenance: Provenance::Document {
                        path: path.into(),
                        line: i + 1,
                        heading: name.into(),
                        commit: commit.map(str::to_string),
                    },
                });
            }
            continue;
        }
        if excluded {
            continue;
        }
        if !fenced && line.trim().is_empty() {
            flush(&mut body, start, &title, &mut result);
        } else {
            if body.is_empty() {
                start = i + 1;
            }
            body.push_str(line);
            body.push('\n');
        }
    }
    flush(&mut body, start, &title, &mut result);
    result
}
