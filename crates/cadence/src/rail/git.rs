//! Immutable Git object acquisition for the shared risk classifier.
use super::{
    risk::{MaterialIdentity, Resolution, Source},
    risk_diff::{self, Scan},
};
use crate::process::Process;
use crate::store::{Error, Result};
use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
};

pub fn run<I, S>(root: &Path, args: I, process: &mut dyn Process) -> Result<Vec<u8>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = crate::git_process::run(
        &crate::git_process::launch(crate::git_process::Caller::RailRead)
            .cwd(root)
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .unset("GIT_LITERAL_PATHSPECS")
            .unset("GIT_GLOB_PATHSPECS")
            .unset("GIT_NOGLOB_PATHSPECS")
            .unset("GIT_ICASE_PATHSPECS"), process,
    )?;
    if !output.success() {
        return Err(Error::Invalid(format!(
            "Git observation failed ({}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    Ok(output.stdout)
}

pub fn resolve_commit(root: &Path, reference: &str, process: &mut dyn Process) -> Result<String> {
    if reference.trim().is_empty() || reference.contains('\0') {
        return Err(Error::Invalid("invalid commit ref".into()));
    }
    let bytes = run(
        root,
        [
            "rev-parse",
            "--verify",
            "--end-of-options",
            &format!("{reference}^{{commit}}"),
        ],
        process,
    )?;
    object_id(bytes)
}

/// Pause may compare a narrowed re-arm against its previous authored tree.
/// Keep commit IDs as commits so existing pause fire preimages remain intact.
pub fn resolve_comparison(root: &Path, reference: &str, process: &mut dyn Process) -> Result<String> {
    let id = object_id(run(
        root,
        [
            "rev-parse",
            "--verify",
            "--end-of-options",
            &format!("{reference}^{{object}}"),
        ],
        process,
    )?)?;
    match run(root, ["cat-file", "-t", &id], process)?.as_slice() {
        b"commit\n" | b"tree\n" => Ok(id),
        _ => Err(Error::Invalid(
            "comparison base must be a commit or tree".into(),
        )),
    }
}

pub fn object_id(bytes: Vec<u8>) -> Result<String> {
    let value =
        String::from_utf8(bytes).map_err(|_| Error::Invalid("invalid Git object ID".into()))?;
    let id = value.trim();
    if !matches!(id.len(), 40 | 64) || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::Invalid("invalid Git object ID".into()));
    }
    Ok(id.into())
}

pub fn index_id(root: &Path, process: &mut dyn Process) -> Result<String> {
    object_id(run(root, ["write-tree"], process)?)
}

pub fn resolve(root: &Path, source: &Source, process: &mut dyn Process) -> (Resolution, Vec<String>) {
    // Resolve independently, preserving whichever immutable endpoint is available.
    let (base, head, index) = match source {
        Source::Committed { base, head } => (
            resolve_commit(root, base, process),
            Some(resolve_commit(root, head, process)),
            None,
        ),
        Source::Staged { base } => (resolve_commit(root, base, process), None, Some(index_id(root, process))),
        Source::Execution { .. } => {
            return (
                Resolution::Committed {
                    base_id: None,
                    head_id: None,
                },
                vec!["execution material requires the execution service".into()],
            );
        }
    };
    let mut diagnostics = Vec::new();
    let mut resolved = |name: &str, value: Result<String>| match value {
        Ok(id) => Some(id),
        Err(error) => {
            diagnostics.push(format!("{name}: {error}"));
            None
        }
    };
    let base_id = resolved("base", base);
    let resolution = match source {
        Source::Committed { .. } | Source::Execution { .. } => Resolution::Committed {
            base_id,
            head_id: head.and_then(|v| resolved("head", v)),
        },
        Source::Staged { .. } => Resolution::Staged {
            base_id,
            index_id: index.and_then(|v| resolved("index", v)),
        },
    };
    (resolution, diagnostics)
}

/// The four frozen reviewer-text shapes; these never change source lease coverage.
pub const REVIEWER_TEXT_PATHSPECS: [&str; 4] = [
    ":(top,exclude).planning/phases/*/ADJUDICATION-*.json",
    ":(top,exclude).planning/phases/*/REVIEW-*.md",
    ":(top,exclude).planning/phases/*/FINDINGS.json",
    ":(top,exclude).planning/phases/*/verifier-findings.json",
];

pub struct Diff {
    pub paths: Vec<PathBuf>,
    pub body: Vec<u8>,
}

pub fn diff(root: &Path, material: &MaterialIdentity, process: &mut dyn Process) -> Result<Diff> {
    diff_with_pathspecs(
        root,
        material,
        &REVIEWER_TEXT_PATHSPECS.map(std::ffi::OsString::from),
        process,
    )
}

/// Pause supplies its provenance-filtered selection. An empty selection means
/// no authored material, and never broadens to all paths in the tree.
pub fn diff_selected(root: &Path, material: &MaterialIdentity, paths: &[PathBuf], process: &mut dyn Process) -> Result<Diff> {
    material.validate()?;
    if paths.is_empty() {
        return Ok(Diff {
            paths: Vec::new(),
            body: Vec::new(),
        });
    }
    let pathspecs = paths
        .iter()
        .map(|path| {
            let mut spec = std::ffi::OsString::from(":(top,literal)");
            spec.push(path.as_os_str());
            spec
        })
        .collect::<Vec<_>>();
    diff_with_pathspecs(root, material, &pathspecs, process)
}

fn arguments(
    material: &MaterialIdentity,
    format: &[&str],
    pathspecs: &[std::ffi::OsString],
) -> Vec<std::ffi::OsString> {
    let mut args = [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-renames",
        "--color=never",
        "--ignore-submodules=none",
    ]
    .map(std::ffi::OsString::from)
    .to_vec();
    args.extend(format.iter().map(std::ffi::OsString::from));
    args.extend([material.base_id(), material.tip_id(), "--"].map(std::ffi::OsString::from));
    args.extend_from_slice(pathspecs);
    args
}

pub fn changed_paths(root: &Path, material: &MaterialIdentity, process: &mut dyn Process) -> Result<Vec<PathBuf>> {
    read_paths(root, material, &[], process)
}

fn read_paths(
    root: &Path,
    material: &MaterialIdentity,
    pathspecs: &[std::ffi::OsString],
    process: &mut dyn Process,
) -> Result<Vec<PathBuf>> {
    material.validate()?;
    // --no-renames reports a rename as a deletion plus an addition. Both ends
    // are classified, with NUL records avoiding Git's display quoting entirely.
    let names = run(root, arguments(material, &["--name-only", "-z"], pathspecs), process)?;
    if !names.is_empty() && names.last() != Some(&0) {
        return Err(Error::Invalid("unterminated Git pathname record".into()));
    }
    let paths = names
        .split(|b| *b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| {
            #[cfg(unix)]
            {
                use std::os::unix::ffi::OsStrExt;
                Ok(PathBuf::from(OsStr::from_bytes(p)))
            }
            #[cfg(not(unix))]
            {
                std::str::from_utf8(p)
                    .map(PathBuf::from)
                    .map_err(|_| Error::Invalid("Git path is undecodable".into()))
            }
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(paths)
}

fn diff_with_pathspecs(
    root: &Path,
    material: &MaterialIdentity,
    pathspecs: &[std::ffi::OsString],
    process: &mut dyn Process,
) -> Result<Diff> {
    let paths = read_paths(root, material, pathspecs, process)?;
    let body = run(
        root,
        arguments(
            material,
            &[
                "--binary",
                "--unified=0",
                "--src-prefix=a/",
                "--dst-prefix=b/",
                "--output-indicator-new=+",
                "--output-indicator-old=-",
                "--output-indicator-context= ",
            ],
            pathspecs,
        ),
        process,
    )?;
    Ok(Diff { paths, body })
}

pub fn scan(root: &Path, material: &MaterialIdentity, surfaces: &[String], process: &mut dyn Process) -> Result<Scan> {
    let diff = diff(root, material, process)?;
    risk_diff::scan(Some(&diff.body), &diff.paths, surfaces)
}
