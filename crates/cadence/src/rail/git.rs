//! Immutable Git object acquisition for the shared risk classifier.
use super::{
    risk::{MaterialIdentity, Resolution, Source},
    risk_diff::{self, Scan},
};
use crate::store::{Error, Result};
use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

pub fn run<I, S>(root: &Path, args: I) -> Result<Vec<u8>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env_remove("GIT_LITERAL_PATHSPECS")
        .env_remove("GIT_GLOB_PATHSPECS")
        .env_remove("GIT_NOGLOB_PATHSPECS")
        .env_remove("GIT_ICASE_PATHSPECS")
        .stdin(Stdio::null())
        .output()?;
    if !output.status.success() {
        return Err(Error::Invalid(format!(
            "Git observation failed ({}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    Ok(output.stdout)
}

pub fn resolve_commit(root: &Path, reference: &str) -> Result<String> {
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
    )?;
    object_id(bytes)
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

pub fn index_id(root: &Path) -> Result<String> {
    object_id(run(root, ["write-tree"])?)
}

pub fn resolve(root: &Path, source: &Source) -> (Resolution, Vec<String>) {
    // Resolve independently, preserving whichever immutable endpoint is available.
    let (base, head, index) = match source {
        Source::Committed { base, head } => (
            resolve_commit(root, base),
            Some(resolve_commit(root, head)),
            None,
        ),
        Source::Staged { base } => (resolve_commit(root, base), None, Some(index_id(root))),
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
        Source::Committed { .. } => Resolution::Committed {
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

pub fn diff(root: &Path, material: &MaterialIdentity) -> Result<Diff> {
    material.validate()?;
    let common = [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-renames",
        "--color=never",
        "--ignore-submodules=none",
    ];
    let arguments = |format: &[&str]| {
        let mut args = common.to_vec();
        args.extend_from_slice(format);
        args.extend([material.base_id(), material.tip_id(), "--"]);
        args.extend(REVIEWER_TEXT_PATHSPECS);
        args.into_iter()
            .map(std::ffi::OsString::from)
            .collect::<Vec<_>>()
    };
    // --no-renames reports a rename as a deletion plus an addition. Both ends
    // are classified, with NUL records avoiding Git's display quoting entirely.
    let names = run(root, arguments(&["--name-only", "-z"]))?;
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
    let body = run(
        root,
        arguments(&[
            "--binary",
            "--unified=0",
            "--src-prefix=a/",
            "--dst-prefix=b/",
            "--output-indicator-new=+",
            "--output-indicator-old=-",
            "--output-indicator-context= ",
        ]),
    )?;
    Ok(Diff { paths, body })
}

pub fn scan(root: &Path, material: &MaterialIdentity, surfaces: &[String]) -> Result<Scan> {
    let diff = diff(root, material)?;
    risk_diff::scan(Some(&diff.body), &diff.paths, surfaces)
}
