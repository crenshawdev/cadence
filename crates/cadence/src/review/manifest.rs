//! H2 source locations describe retained bytes, not citation relevance.
use super::model::{
    Availability, HunkMap, LineMap, Manifest, MaterialEntry, Side, SourceReference, Target,
};
use cadence::store::{Error, Result};
use serde::Serialize;
use std::collections::BTreeMap;

pub fn source_reference(
    manifest: &Manifest,
    diff: &str,
    line: u64,
    side: &Side,
) -> Option<SourceReference> {
    manifest
        .entries
        .iter()
        .find(|entry| entry.entry == diff)?
        .hunks
        .iter()
        .find(|mapping| mapping.diff_line == line && &mapping.source.side == side)
        .map(|mapping| mapping.source.clone())
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct MaterialSide {
    pub path: String,
    pub side: Side,
    pub availability: Availability,
}

pub fn material_side(manifest: &Manifest, path: &str, side: Side) -> MaterialSide {
    let availability = manifest
        .entries
        .iter()
        .find(|entry| entry.path.as_deref() == Some(path) && entry.side == side)
        .map(|entry| entry.availability.clone())
        .unwrap_or_else(|| {
            let absent = manifest.entries.iter().any(|entry| {
                (entry.old_path.as_deref() == Some(path) || entry.new_path.as_deref() == Some(path))
                    && match side {
                        Side::Base => entry.old_path.as_deref() != Some(path),
                        Side::Head | Side::Snapshot => entry.new_path.as_deref() != Some(path),
                    }
            });
            if absent {
                Availability::Absent
            } else {
                Availability::Unavailable
            }
        });
    MaterialSide {
        path: path.into(),
        side,
        availability,
    }
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct ManifestError {
    pub code: &'static str,
    pub entry: String,
    pub side: Side,
}

fn missing(entry: &str, side: &Side) -> ManifestError {
    ManifestError {
        code: "missing-source-material",
        entry: entry.into(),
        side: side.clone(),
    }
}

fn readable(entry: &MaterialEntry) -> bool {
    entry.availability == Availability::Available
        && entry.content.is_some()
        && entry.retained.is_some()
}

pub fn validate_manifest(manifest: &Manifest) -> std::result::Result<(), ManifestError> {
    for entry in &manifest.entries {
        for mapping in &entry.hunks {
            let reference = &mapping.source;
            let source = manifest
                .entries
                .iter()
                .find(|source| {
                    source.entry == reference.entry
                        && source.side == reference.side
                        && source.path.as_deref() == Some(&reference.path)
                })
                .ok_or_else(|| missing(&reference.entry, &reference.side))?;
            if !readable(source) || !source.lines.iter().any(|line| line.line == reference.line) {
                return Err(missing(&reference.entry, &reference.side));
            }
        }
        if entry.path.is_some() && entry.availability != Availability::Absent && !readable(entry) {
            return Err(missing(&entry.entry, &entry.side));
        }
    }
    Ok(())
}

/// One-based lines, half-open byte offsets including the line terminator.
pub(crate) fn line_map(bytes: &[u8]) -> Vec<LineMap> {
    let mut start = 0;
    bytes
        .split_inclusive(|byte| *byte == b'\n')
        .enumerate()
        .map(|(index, line)| {
            let end = start + line.len() as u64;
            let mapping = LineMap {
                line: index as u64 + 1,
                start,
                end,
            };
            start = end;
            mapping
        })
        .collect()
}

#[derive(Default)]
struct Change {
    old: Option<String>,
    new: Option<String>,
    mappings: Vec<(u64, Side, u64)>,
}

/// Record mappings before the caller persists the acquired manifest. A saved
/// deletion is absent only on its missing side; read errors stay unavailable.
pub(crate) fn record_mappings(
    manifest: &mut Manifest,
    contents: &BTreeMap<String, Vec<u8>>,
) -> Result<()> {
    for entry in &mut manifest.entries {
        if let Some(bytes) = contents.get(&entry.entry) {
            entry.lines = line_map(bytes);
        }
    }
    let tip = if matches!(manifest.target, Target::StagedTree { .. }) {
        Side::Snapshot
    } else {
        Side::Head
    };
    let diffs: Vec<_> = manifest
        .entries
        .iter()
        .filter(|entry| entry.label.as_deref() == Some("diff"))
        .map(|entry| entry.entry.clone())
        .collect();
    for diff in diffs {
        let Some(bytes) = contents.get(&diff) else {
            continue;
        };
        let changes = diff_changes(bytes, &tip)?;
        let mut hunks = Vec::new();
        for change in changes {
            for entry in manifest
                .entries
                .iter_mut()
                .filter(|entry| entry.path.is_some())
            {
                if entry.path != change.old && entry.path != change.new {
                    continue;
                }
                entry.old_path = change.old.clone();
                entry.new_path = change.new.clone();
                let expected = if entry.side == Side::Base {
                    &change.old
                } else {
                    &change.new
                };
                if &entry.path != expected {
                    entry.availability = Availability::Absent;
                    entry.unavailable_reason = None;
                    entry.content = None;
                    entry.retained = None;
                    entry.lines.clear();
                }
            }
            for (diff_line, side, line) in change.mappings {
                let path = if side == Side::Base {
                    &change.old
                } else {
                    &change.new
                };
                let Some(path) = path else { continue };
                let source = manifest
                    .entries
                    .iter()
                    .find(|entry| entry.path.as_ref() == Some(path) && entry.side == side)
                    .ok_or_else(|| Error::Invalid(format!("missing acquired source: {path}")))?;
                hunks.push(HunkMap {
                    diff_line,
                    source: SourceReference {
                        entry: source.entry.clone(),
                        path: path.clone(),
                        side,
                        line,
                    },
                });
            }
        }
        manifest
            .entries
            .iter_mut()
            .find(|entry| entry.entry == diff)
            .expect("saved diff")
            .hunks = hunks;
    }
    Ok(())
}

// Git quotes path bytes with C escapes, including octal UTF-8 bytes. Source
// text need not be UTF-8: only path and numeric header fields are decoded.
fn path_bytes(value: &[u8]) -> Result<String> {
    let mut bytes = Vec::new();
    if value.first() != Some(&b'"') {
        bytes.extend_from_slice(value);
    } else {
        if value.last() != Some(&b'"') {
            return Err(Error::Invalid("unterminated Git path".into()));
        }
        let mut index = 1;
        while index + 1 < value.len() {
            let byte = value[index];
            index += 1;
            if byte != b'\\' {
                bytes.push(byte);
                continue;
            }
            let escaped = *value
                .get(index)
                .ok_or_else(|| Error::Invalid("invalid Git path escape".into()))?;
            index += 1;
            bytes.push(match escaped {
                b'0'..=b'3' => {
                    let tail = value
                        .get(index..index + 2)
                        .filter(|tail| tail.iter().all(|byte| matches!(byte, b'0'..=b'7')))
                        .ok_or_else(|| Error::Invalid("invalid Git path octal".into()))?;
                    index += 2;
                    (escaped - b'0') * 64 + (tail[0] - b'0') * 8 + (tail[1] - b'0')
                }
                b'n' => b'\n',
                b't' => b'\t',
                b'r' => b'\r',
                b'b' => 8,
                b'f' => 12,
                b'v' => 11,
                b'a' => 7,
                b'\\' => b'\\',
                b'"' => b'"',
                _ => return Err(Error::Invalid("invalid Git path escape".into())),
            });
        }
    }
    String::from_utf8(bytes).map_err(|_| Error::Invalid("non-UTF-8 Git path".into()))
}

fn source_path(value: &[u8]) -> Result<Option<String>> {
    let decoded = path_bytes(value.strip_suffix(b"\t").unwrap_or(value))?;
    if decoded == "/dev/null" {
        return Ok(None);
    }
    decoded
        .strip_prefix("a/")
        .or_else(|| decoded.strip_prefix("b/"))
        .map(|path| Some(path.into()))
        .ok_or_else(|| Error::Invalid("invalid diff source path".into()))
}

fn diff_changes(bytes: &[u8], tip: &Side) -> Result<Vec<Change>> {
    let mut changes = Vec::new();
    let mut current: Option<Change> = None;
    let (mut old_line, mut new_line) = (0, 0);
    let (mut old_left, mut new_left) = (0, 0);
    for (index, line) in bytes.split(|byte| *byte == b'\n').enumerate() {
        let diff_line = index as u64 + 1;
        if let Some(header) = line.strip_prefix(b"diff --git ") {
            if old_left != 0 || new_left != 0 {
                return Err(Error::Invalid("incomplete diff hunk".into()));
            }
            if let Some(change) = current.take() {
                changes.push(change)
            }
            let split = if header.first() == Some(&b'"') {
                let mut end = 1;
                while end < header.len() {
                    if header[end] == b'\\' {
                        end += 2;
                        continue;
                    }
                    if header[end] == b'"' {
                        break;
                    }
                    end += 1;
                }
                end + 1
            } else {
                // Unquoted paths may contain spaces and even " b/". A
                // non-rename header repeats the same path on both sides.
                header
                    .windows(3)
                    .enumerate()
                    .find_map(|(index, window)| {
                        (window == b" b/" && header.get(2..index) == header.get(index + 3..))
                            .then_some(index)
                    })
                    .or_else(|| header.windows(3).position(|window| window == b" b/"))
                    .or_else(|| header.windows(4).position(|window| window == b" \"b/"))
                    .ok_or_else(|| Error::Invalid("invalid diff header".into()))?
            };
            let old = source_path(
                header
                    .get(..split)
                    .ok_or_else(|| Error::Invalid("invalid diff header".into()))?,
            )?;
            let new = source_path(
                header
                    .get(split + 1..)
                    .ok_or_else(|| Error::Invalid("invalid diff header".into()))?,
            )?;
            current = Some(Change {
                old,
                new,
                mappings: Vec::new(),
            });
            (old_left, new_left) = (0, 0);
            continue;
        }
        let Some(change) = current.as_mut() else {
            continue;
        };
        if old_left > 0 || new_left > 0 {
            match line.first() {
                Some(b'-') if old_left > 0 => {
                    change.mappings.push((diff_line, Side::Base, old_line));
                    old_line += 1;
                    old_left -= 1;
                }
                Some(b'+') if new_left > 0 => {
                    change.mappings.push((diff_line, tip.clone(), new_line));
                    new_line += 1;
                    new_left -= 1;
                }
                Some(b' ') if old_left > 0 && new_left > 0 => {
                    change.mappings.push((diff_line, Side::Base, old_line));
                    change.mappings.push((diff_line, tip.clone(), new_line));
                    old_line += 1;
                    new_line += 1;
                    old_left -= 1;
                    new_left -= 1;
                }
                Some(b'\\') => {}
                _ => return Err(Error::Invalid("invalid diff hunk body".into())),
            }
        } else if let Some(path) = line.strip_prefix(b"--- ") {
            change.old = source_path(path)?;
        } else if let Some(path) = line.strip_prefix(b"+++ ") {
            change.new = source_path(path)?;
        } else if line.starts_with(b"deleted file mode ") {
            change.new = None;
        } else if line.starts_with(b"new file mode ") {
            change.old = None;
        } else if let Some(path) = line.strip_prefix(b"rename from ") {
            change.old = Some(path_bytes(path)?);
        } else if let Some(path) = line.strip_prefix(b"rename to ") {
            change.new = Some(path_bytes(path)?);
        } else if line.starts_with(b"@@ ") {
            let header = std::str::from_utf8(line)
                .map_err(|_| Error::Invalid("invalid hunk header".into()))?;
            let mut fields = header.split_whitespace().skip(1);
            (old_line, old_left) = hunk_range(fields.next(), '-')?;
            (new_line, new_left) = hunk_range(fields.next(), '+')?;
        }
    }
    if old_left != 0 || new_left != 0 {
        return Err(Error::Invalid("incomplete diff hunk".into()));
    }
    if let Some(change) = current {
        changes.push(change)
    }
    Ok(changes)
}

fn hunk_range(field: Option<&str>, prefix: char) -> Result<(u64, u64)> {
    let range = field
        .and_then(|field| field.strip_prefix(prefix))
        .ok_or_else(|| Error::Invalid("invalid hunk range".into()))?;
    let (start, count) = range.split_once(',').unwrap_or((range, "1"));
    let parse = |value: &str| {
        value
            .parse()
            .map_err(|_| Error::Invalid("invalid hunk number".into()))
    };
    let start: u64 = parse(start)?;
    let count: u64 = parse(count)?;
    start
        .checked_add(count)
        .ok_or_else(|| Error::Invalid("invalid hunk extent".into()))?;
    Ok((start, count))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn source_line_map_uses_bytes_and_keeps_terminators() {
        let source = "雪\r\nx".as_bytes();
        assert_eq!(
            serde_json::to_value(line_map(source)).unwrap(),
            json!([
                {"line":1,"start":0,"end":5},{"line":2,"start":5,"end":6}
            ])
        );
    }

    #[test]
    fn source_quoted_git_path_decodes_octal_bytes() {
        let quoted = br#""a/\351\233\252\t.rs""#;
        assert_eq!(path_bytes(quoted).unwrap(), "a/雪\t.rs");
    }

    #[test]
    fn source_context_line_has_both_source_sides() {
        let patch = b"diff --git a/a.rs b/a.rs\n--- a/a.rs\n+++ b/a.rs\n@@ -2 +3 @@\n same\n";
        assert_eq!(
            diff_changes(patch, &Side::Snapshot).unwrap()[0].mappings,
            vec![(5, Side::Base, 2), (5, Side::Snapshot, 3)]
        );
    }

    #[test]
    fn source_truncated_hunk_refuses() {
        let patch = b"diff --git a/a.rs b/a.rs\n@@ -2 +3 @@\n-old\n";
        assert_eq!(
            diff_changes(patch, &Side::Head).err(),
            Some(Error::Invalid("invalid diff hunk body".into()))
        );
    }

    #[test]
    fn source_binary_header_preserves_spaces_in_path() {
        let patch = b"diff --git a/a b/c b/a b/c\ndeleted file mode 100644\nBinary files a/a b/c and /dev/null differ\n";
        let changes = diff_changes(patch, &Side::Head).unwrap();
        assert_eq!(
            (&changes[0].old, &changes[0].new),
            (&Some("a b/c".into()), &None)
        );
    }
}
