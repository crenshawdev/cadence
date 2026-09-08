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

pub fn resolve(root: &Path, source: &Source) -> (Resolution, Vec<String>) {
    let Source::Committed { base, head } = source;
    let base = resolve_commit(root, base);
    let head = resolve_commit(root, head);
    let mut diagnostics = Vec::new();
    let mut resolved = |name: &str, value: Result<String>| match value {
        Ok(id) => Some(id),
        Err(error) => {
            diagnostics.push(format!("{name}: {error}"));
            None
        }
    };
    (
        Resolution {
            base_id: resolved("base", base),
            head_id: resolved("head", head),
            index_id: None,
        },
        diagnostics,
    )
}

pub fn scan(root: &Path, material: &MaterialIdentity, surfaces: &[String]) -> Result<Scan> {
    let paths = run(
        root,
        [
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-renames",
            "--name-only",
            "-z",
            material.base_id(),
            material.tip_id(),
            "--",
        ],
    )?;
    let paths = paths
        .split(|b| *b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| {
            #[cfg(unix)]
            {
                use std::os::unix::ffi::OsStrExt;
                PathBuf::from(OsStr::from_bytes(p))
            }
            #[cfg(not(unix))]
            {
                PathBuf::from(String::from_utf8_lossy(p).into_owned())
            }
        })
        .collect::<Vec<_>>();
    let body = run(
        root,
        [
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-renames",
            "--binary",
            "--unified=0",
            material.base_id(),
            material.tip_id(),
            "--",
        ],
    )?;
    risk_diff::scan(Some(&body), &paths, surfaces)
}
