//! New 4.0 git dependency. Every failed read narrows explicit coverage; no
//! operation writes refs, the index, the worktree, or fetches missing objects.
use super::{Candidate, Provenance, current, documents};
use cadence::store::{
    model::{self, DecisionRecord, ItemRecord},
    writer::View,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
    process::{Command, Stdio},
};

pub trait ReadGit {
    fn run(&mut self, root: &Path, args: &[&str]) -> Result<Vec<u8>, String>;
}
pub struct Git;
impl ReadGit for Git {
    fn run(&mut self, root: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
        let output = Command::new("git")
            .current_dir(root)
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_NO_LAZY_FETCH", "1")
            .env("GIT_LITERAL_PATHSPECS", "1")
            .env("GIT_TERMINAL_PROMPT", "0")
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("git {} unavailable: {e}", args[0]))?;
        if !output.status.success() {
            return Err(format!("git {} failed ({})", args[0], output.status));
        }
        Ok(output.stdout)
    }
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

pub fn read(root: &Path, view: &View, live: &[Candidate], git: &mut impl ReadGit) -> History {
    let mut out = History::default();
    let excluded = super::declined(view);
    let mut seen: BTreeSet<_> = live.iter().map(evidence_key).collect();
    let mut admit = |candidates: Vec<Candidate>, out: &mut History| {
        for c in candidates {
            if c.item_id.as_ref().is_none_or(|id| !excluded.contains(id))
                && seen.insert(evidence_key(&c))
            {
                out.candidates.push(c);
            }
        }
    };
    // ARCHIVE is compatibility input only. It remains available even when git
    // itself is absent; no reconstructed full document or invented commit.
    let archive = root.join("ARCHIVE.md");
    if let Ok(metadata) = fs::symlink_metadata(&archive) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            out.incomplete
                .push("ARCHIVE.md: linked or non-file residue skipped".into());
        } else {
            match fs::read_to_string(&archive) {
                Ok(text) => {
                    out.identities
                        .insert(format!("ARCHIVE.md:{}", model::digest(text.as_bytes())));
                    admit(residue("ARCHIVE.md", &text, None), &mut out);
                }
                Err(e) => out.incomplete.push(format!("ARCHIVE.md unavailable: {e}")),
            }
        }
    }
    let traverse = |git: &mut dyn ReadGit,
                    out: &mut History,
                    admit: &mut dyn FnMut(Vec<Candidate>, &mut History)|
     -> Result<(), String> {
        let shallow = utf8(git.run(root, &["rev-parse", "--is-shallow-repository"])?)?;
        if shallow.trim() == "true" {
            out.incomplete.push(
                "shallow history: ancestors beyond the shallow boundary are unavailable".into(),
            );
        }
        let top = utf8(git.run(root, &["rev-parse", "--show-toplevel"])?)?;
        let root = root.canonicalize().map_err(|e| e.to_string())?;
        let relative = root
            .strip_prefix(Path::new(top.trim()))
            .map_err(|_| "planning root outside git worktree".to_string())?;
        let prefix = relative.to_str().ok_or("non-UTF8 planning root")?;
        let commits = utf8(git.run(&root, &["rev-list", "--topo-order", "HEAD"])?)?;
        if commits.trim().is_empty() {
            return Err("unborn repository: no reachable history".into());
        }
        let mut blobs = BTreeMap::<String, Vec<u8>>::new();
        let mut visited = BTreeSet::new();
        for commit in commits.lines() {
            out.identities.insert(format!("commit:{commit}"));
            let tree = git.run(
                &root,
                &["ls-tree", "--full-tree", "-r", "-z", commit, "--", prefix],
            )?;
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
                let bytes = if let Some(bytes) = blobs.get(blob) {
                    bytes.clone()
                } else {
                    match git.run(&root, &["cat-file", "blob", blob]) {
                        Ok(bytes) => {
                            blobs.insert(blob.into(), bytes.clone());
                            bytes
                        }
                        Err(e) => {
                            out.incomplete.push(format!("{commit}:{path}: {e}"));
                            continue;
                        }
                    }
                };
                match historical(path, &bytes, commit, view) {
                    Ok(candidates) => admit(candidates, out),
                    Err(e) => out
                        .incomplete
                        .push(format!("{commit}:{path}: unavailable source: {e}")),
                }
            }
        }
        Ok(())
    };
    if let Err(e) = traverse(git, &mut out, &mut admit) {
        out.incomplete.push(format!("history incomplete: {e}"));
    }
    out
}
