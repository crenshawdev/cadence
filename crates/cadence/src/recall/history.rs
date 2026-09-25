//! New 4.0 git dependency. Every failed read narrows explicit coverage; no
//! operation writes refs, the index, the worktree, or fetches missing objects.
use super::{Candidate, Provenance, current, documents};
use cadence::store::{
    model::{self, DecisionRecord, ItemRecord},
    writer::View,
};
use cadence::process::Process;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};

/// Read-only git: optional locks off, no lazy fetch, literal pathspecs and no
/// terminal prompt, so a traversal can never write or reach the network.
fn read_git(process: &mut dyn Process, root: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    read_git_capped(process, root, args, usize::MAX)
}

fn read_git_capped(process: &mut dyn Process, root: &Path, args: &[&str], bound: usize) -> Result<Vec<u8>, String> {
    let output = cadence::git_process::run(
            &cadence::git_process::launch(cadence::git_process::Caller::RecallHistory)
                .cwd(root)
                .args(args)
                .limit(bound)
                .env("GIT_OPTIONAL_LOCKS", "0")
                .env("GIT_NO_LAZY_FETCH", "1")
                .env("GIT_LITERAL_PATHSPECS", "1")
                .env("GIT_TERMINAL_PROMPT", "0"), process,
        )
        .map_err(|e| format!("git {} unavailable: {e}", args[0]))?;
    git_output(args[0], bound, output)
}

fn git_output(command: &str, bound: usize, output: cadence::process::Output) -> Result<Vec<u8>, String> {
    if !output.success() {
        return Err(format!("git {command} failed ({})", output.status));
    }
    if !output.stdout_complete || output.stdout.len() > bound {
        return Err(format!("git {command} output exceeds retained-byte bound {bound}"));
    }
    Ok(output.stdout)
}

#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct History {
    pub candidates: Vec<Candidate>,
    pub identities: BTreeSet<String>,
    pub incomplete: Vec<String>,
}

/// Provenance defines equivalence: two independent documents with the same
/// sentence remain distinct. Repeated revisions of one immutable item do not.
pub fn evidence_key(c: &Candidate) -> String {
    let key = match &c.provenance {
        Provenance::Record { id, revision, .. } => {
            if c.item_id.is_some() {
                format!("item:{id}")
            } else {
                format!("decision:{id}:{revision}")
            }
        }
        Provenance::Document {
            path,
            line,
            heading,
            ..
        } => format!("document:{path}:{line}:{heading}"),
        Provenance::Residue {
            path,
            line,
            label,
            origin,
            phase,
            ..
        } => format!("residue:{path}:{line}:{label}:{origin}:{phase}"),
    };
    format!("{key}:{}", model::digest(c.text.as_bytes()))
}

pub fn residue(path: &str, text: &str, commit: Option<&str>) -> Vec<Candidate> {
    let mut label = None;
    let mut result = Vec::new();
    for (i, line) in text.trim_start_matches('\u{feff}').lines().enumerate() {
        let line = line.trim_end_matches('\r');
        if let Some(name) = line.strip_prefix("## ") {
            label = Some(name.trim());
            continue;
        }
        let Some(label) = label else {
            continue;
        };
        let Some((origin, text)) = line.strip_prefix("- `").and_then(|s| s.split_once("`: "))
        else {
            continue;
        };
        let parts: Vec<_> = origin.split('/').collect();
        let ["phases", phase, file] = parts.as_slice() else {
            continue;
        };
        if !matches!(*file, "SUMMARY.md" | "UAT.md" | "CONTEXT.md") || !documents::eligible(origin)
        {
            continue;
        }
        result.push(Candidate {
            text: text.into(),
            item_id: None,
            provenance: Provenance::Residue {
                path: path.into(),
                line: i + 1,
                label: label.into(),
                origin: origin.into(),
                phase: (*phase).into(),
                commit: commit.map(str::to_string),
            },
        });
    }
    result
}

fn utf8(bytes: Vec<u8>) -> Result<String, String> {
    String::from_utf8(bytes).map_err(|_| "git returned non-UTF8 path or metadata".into())
}

fn historical(
    path: &str,
    bytes: &[u8],
    commit: &str,
    view: &View,
) -> Result<Vec<Candidate>, String> {
    let mut candidates = match path {
        "items.jsonl" => {
            let items: Vec<ItemRecord> = model::parse_lines(bytes).map_err(|e| e.to_string())?;
            model::validate_items(&items).map_err(|e| e.to_string())?;
            let historical = View {
                items,
                decisions: vec![],
                snapshot: view.snapshot.clone(),
            };
            current(&historical)
        }
        "decisions.jsonl" => {
            let decisions: Vec<DecisionRecord> =
                model::parse_lines(bytes).map_err(|e| e.to_string())?;
            model::validate_decisions(&decisions).map_err(|e| e.to_string())?;
            current(&View {
                items: vec![],
                decisions,
                snapshot: view.snapshot.clone(),
            })
        }
        "FILED.md" => {
            let source = crate::import::Source {
                path: path.into(),
                bytes: bytes.into(),
            };
            let imported = crate::import::items::translate(None, Some(&source), None)
                .map_err(|e| e.to_string())?;
            current(&View {
                items: imported.records,
                decisions: vec![],
                snapshot: view.snapshot.clone(),
            })
        }
        _ => {
            let text =
                std::str::from_utf8(bytes).map_err(|_| "non-UTF8 historical source".to_string())?;
            return Ok(if path == "ARCHIVE.md" {
                residue(path, text, Some(commit))
            } else {
                documents::snippets(path, text, Some(commit))
            });
        }
    };
    for candidate in &mut candidates {
        if let Provenance::Record {
            commit: citation,
            source,
            ..
        } = &mut candidate.provenance
        {
            *citation = Some(commit.into());
            *source = path.into();
        }
    }
    Ok(candidates)
}

/// What the traversal asks git. Each answer is git's raw output; reading it is
/// the traversal's work, so a test can hand it the answers.
pub trait ReadGit {
    /// `rev-parse --is-shallow-repository`
    fn shallow(&mut self) -> Result<Vec<u8>, String>;
    /// `rev-parse --show-toplevel`
    fn toplevel(&mut self) -> Result<Vec<u8>, String>;
    /// `rev-list --topo-order HEAD`, newest first.
    fn commits(&mut self) -> Result<Vec<u8>, String>;
    /// The `ls-tree -z` rows of `commit` under `prefix`.
    fn tree(&mut self, commit: &str, prefix: &str) -> Result<Vec<u8>, String>;
    /// `cat-file blob`
    fn blob(&mut self, id: &str) -> Result<Vec<u8>, String>;
    /// Provided for existing in-memory readers; production queries size without content.
    fn blob_size(&mut self, id: &str) -> Result<Vec<u8>, String> {
        self.blob(id).map(|bytes| bytes.len().to_string().into_bytes())
    }
    fn blob_bounded(&mut self, id: &str, _bound: u64) -> Result<Vec<u8>, String> {
        self.blob(id)
    }
}

/// Git run in the planning root through the read-only launch above.
struct Git<'a> {
    process: &'a mut dyn Process,
    root: &'a Path,
}

impl ReadGit for Git<'_> {
    fn shallow(&mut self) -> Result<Vec<u8>, String> {
        read_git(self.process, self.root, &["rev-parse", "--is-shallow-repository"])
    }
    fn toplevel(&mut self) -> Result<Vec<u8>, String> {
        read_git(self.process, self.root, &["rev-parse", "--show-toplevel"])
    }
    fn commits(&mut self) -> Result<Vec<u8>, String> {
        read_git(self.process, self.root, &["rev-list", "--topo-order", "HEAD"])
    }
    fn tree(&mut self, commit: &str, prefix: &str) -> Result<Vec<u8>, String> {
        read_git(
            self.process,
            self.root,
            &["ls-tree", "--full-tree", "-r", "-z", commit, "--", prefix],
        )
    }
    fn blob(&mut self, id: &str) -> Result<Vec<u8>, String> {
        self.blob_bounded(id, cadence::acquisition::MAX_SOURCE_BYTES)
    }
    fn blob_size(&mut self, id: &str) -> Result<Vec<u8>, String> {
        read_git_capped(self.process, self.root, &["cat-file", "-s", id], 32)
    }
    fn blob_bounded(&mut self, id: &str, bound: u64) -> Result<Vec<u8>, String> {
        read_git_capped(self.process, self.root, &["cat-file", "blob", id], bound as usize)
    }
}

/// Keeps each candidate once, and none that a declined item owns.
fn admit(
    candidates: Vec<Candidate>,
    excluded: &BTreeSet<String>,
    seen: &mut BTreeSet<String>,
    out: &mut History,
) {
    for c in candidates {
        if c.item_id.as_ref().is_none_or(|id| !excluded.contains(id)) && seen.insert(evidence_key(&c))
        {
            out.candidates.push(c);
        }
    }
}

pub fn read(root: &Path, view: &View, live: &[Candidate], process: &mut dyn Process) -> History {
    let mut out = History::default();
    let mut seen: BTreeSet<_> = live.iter().map(evidence_key).collect();
    // ARCHIVE is compatibility input only. It remains available even when git
    // itself is absent; no reconstructed full document or invented commit.
    let archive = root.join("ARCHIVE.md");
    if let Ok(metadata) = fs::symlink_metadata(&archive) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            out.incomplete
                .push("ARCHIVE.md: linked or non-file residue skipped".into());
        } else {
            match cadence::acquisition::text(&archive, cadence::acquisition::Class::Source) {
                Ok(text) => {
                    out.identities
                        .insert(format!("ARCHIVE.md:{}", model::digest(text.as_bytes())));
                    let excluded = super::declined(view);
                    admit(residue("ARCHIVE.md", &text, None), &excluded, &mut seen, &mut out);
                }
                Err(e) => out.incomplete.push(format!("ARCHIVE.md unavailable: {e}")),
            }
        }
    }
    let history = match root.canonicalize() {
        Ok(root) => traverse(&root, view, seen, &mut Git { process, root: &root }),
        Err(e) => History {
            incomplete: vec![format!("history incomplete: {e}")],
            ..History::default()
        },
    };
    out.candidates.extend(history.candidates);
    out.identities.extend(history.identities);
    out.incomplete.extend(history.incomplete);
    out
}

/// History as git answers it for the canonical planning `root`: newest commit
/// first, each path's blob read once, nothing a declined item owns and nothing
/// already in `seen`. Every answer git could not give is named as incomplete
/// coverage instead of failing the read.
pub fn traverse(
    root: &Path,
    view: &View,
    mut seen: BTreeSet<String>,
    git: &mut dyn ReadGit,
) -> History {
    let mut out = History::default();
    let excluded = super::declined(view);
    if let Err(e) = walk(root, view, &excluded, &mut seen, git, &mut out) {
        out.incomplete.push(format!("history incomplete: {e}"));
    }
    out
}

fn walk(
    root: &Path,
    view: &View,
    excluded: &BTreeSet<String>,
    seen: &mut BTreeSet<String>,
    git: &mut dyn ReadGit,
    out: &mut History,
) -> Result<(), String> {
    let shallow = utf8(git.shallow()?)?;
    if shallow.trim() == "true" {
        out.incomplete.push(
            "shallow history: ancestors beyond the shallow boundary are unavailable".into(),
        );
    }
    let top = utf8(git.toplevel()?)?;
    let relative = root
        .strip_prefix(Path::new(top.trim()))
        .map_err(|_| "planning root outside git worktree".to_string())?;
    let prefix = relative.to_str().ok_or("non-UTF8 planning root")?;
    let commits = utf8(git.commits()?)?;
    if commits.trim().is_empty() {
        return Err("unborn repository: no reachable history".into());
    }
    let mut blobs = BTreeMap::<String, Vec<u8>>::new();
    let mut visited = BTreeSet::new();
    for commit in commits.lines() {
        out.identities.insert(format!("commit:{commit}"));
        let tree = git.tree(commit, prefix)?;
        for row in tree.split(|b| *b == 0).filter(|row| !row.is_empty()) {
            let row = std::str::from_utf8(row).map_err(|_| "non-UTF8 tree path")?;
            let (meta, full_path) = row.split_once('\t').ok_or("invalid git tree record")?;
            let path = if prefix.is_empty() {
                full_path
            } else {
                full_path
                    .strip_prefix(prefix)
                    .and_then(|s| s.strip_prefix('/'))
                    .ok_or("git path outside planning root")?
            };
            if !documents::eligible(path)
                && !matches!(
                    path,
                    "items.jsonl" | "decisions.jsonl" | "FILED.md" | "ARCHIVE.md"
                )
            {
                continue;
            }
            let meta: Vec<_> = meta.split_whitespace().collect();
            if meta.len() != 3 {
                return Err("invalid git tree metadata".into());
            }
            if !matches!(meta[0], "100644" | "100755") || meta[1] != "blob" {
                out.incomplete
                    .push(format!("{commit}:{path}: non-file source skipped"));
                continue;
            }
            let blob = meta[2];
            out.identities.insert(format!("{path}:{blob}"));
            if !visited.insert((path.to_string(), blob.to_string())) {
                continue;
            }
            let permit = match git.blob_size(blob).and_then(|size| blob_preflight(path, &size)) {
                Ok(permit) => permit,
                Err(error) => { out.incomplete.push(format!("{commit}:{path}: {error}")); continue; }
            };
            let bytes = if let Some(bytes) = blobs.get(blob) {
                bytes.clone()
            } else {
                match git.blob_bounded(blob, permit.bound) {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        out.incomplete.push(format!("{commit}:{path}: {e}"));
                        continue;
                    }
                }
            };
            if let Err(error) = blob_length(path, &permit, bytes.len() as u64) {
                out.incomplete.push(format!("{commit}:{path}: {error}"));
                continue;
            }
            blobs.entry(blob.into()).or_insert_with(|| bytes.clone());
            match historical(path, &bytes, commit, view) {
                Ok(candidates) => admit(candidates, excluded, seen, out),
                Err(e) => out
                    .incomplete
                    .push(format!("{commit}:{path}: unavailable source: {e}")),
            }
        }
    }
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
struct BlobPermit { size: u64, bound: u64 }

/// Parse Git's observation and select the acquisition class before asking for content.
fn blob_preflight(path: &str, size: &[u8]) -> Result<BlobPermit, String> {
    let raw = std::str::from_utf8(size).map_err(|_| format!("{path}: invalid git blob size"))?.trim();
    if raw.is_empty() || !raw.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(format!("{path}: invalid git blob size"));
    }
    let size = raw.parse::<u64>().map_err(|_| format!("{path}: invalid git blob size"))?;
    let class = if matches!(path, "items.jsonl" | "decisions.jsonl") {
        cadence::acquisition::Class::Store
    } else { cadence::acquisition::Class::Source };
    let bound = cadence::acquisition::permit(path, class, size).map_err(|error| error.to_string())?;
    Ok(BlobPermit { size, bound })
}

fn blob_length(path: &str, permit: &BlobPermit, acquired: u64) -> Result<(), String> {
    if acquired > permit.bound {
        return Err(cadence::acquisition::Crossing { file: path.into(), size: acquired, bound: permit.bound }.to_string());
    }
    if acquired != permit.size { return Err(format!("{path}: git blob length differs from size observation")); }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn oversized_blob_metadata_refuses_content_acquisition() {
        for path in ["PROJECT.md", "ARCHIVE.md", "FILED.md", "phases/17/CONTEXT.md"] {
            assert_eq!(super::blob_preflight(path, b"16777217\n"),
                Err(format!("{path}: size 16777217 exceeds acquisition bound 16777216")));
            assert_eq!(super::blob_preflight(path, b"16777216\n"),
                Ok(super::BlobPermit { size: 16_777_216, bound: 16_777_216 }));
        }
        for path in ["items.jsonl", "decisions.jsonl"] {
            assert_eq!(super::blob_preflight(path, b"1073741825\n"),
                Err(format!("{path}: size 1073741825 exceeds acquisition bound 1073741824")));
            assert_eq!(super::blob_preflight(path, b"1073741824\n"),
                Ok(super::BlobPermit { size: 1_073_741_824, bound: 1_073_741_824 }));
        }
    }

    #[test]
    fn invalid_blob_size_refuses_content_acquisition() {
        for size in [b"".as_slice(), b"-1", b"+1", b"1.5", b"blob 3", b"18446744073709551616", b"\xff"] {
            assert_eq!(super::blob_preflight("PROJECT.md", size),
                Err("PROJECT.md: invalid git blob size".into()));
        }
    }

    #[test]
    fn a_truncated_git_capture_is_not_a_complete_blob() {
        let mut output = cadence::process::Output::exited(0, b"abcd", b"");
        assert_eq!(super::git_output("cat-file", 4, output.clone()), Ok(b"abcd".to_vec()));
        output.stdout_complete = false;
        assert_eq!(super::git_output("cat-file", 4, output),
            Err("git cat-file output exceeds retained-byte bound 4".into()));
    }

    #[test]
    fn a_blob_length_mismatch_refuses_the_bytes() {
        let permit = super::BlobPermit { size: 3, bound: 16_777_216 };
        assert_eq!(super::blob_length("PROJECT.md", &permit, 3), Ok(()));
        for size in [2, 4] {
            assert_eq!(super::blob_length("PROJECT.md", &permit, size),
                Err("PROJECT.md: git blob length differs from size observation".into()));
        }
        assert_eq!(super::blob_length("PROJECT.md", &permit, 16_777_217),
            Err("PROJECT.md: size 16777217 exceeds acquisition bound 16777216".into()));
    }
}
