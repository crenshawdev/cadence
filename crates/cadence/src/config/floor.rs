use cadence::{
    execution::plan::{MAX_DOCUMENT_BYTES, parse_plan},
    rail::risk_diff::{self, DeclaredMatch, Withheld},
    store::Result,
};
use schemars::JsonSchema;
use serde::Serialize;
use std::{
    collections::BTreeSet,
    fs::{self, File, Metadata, OpenOptions},
    io::{self, Read},
    os::unix::fs::{MetadataExt, OpenOptionsExt},
    path::{Component, Path, PathBuf},
};

pub const MAX_BODY_BYTES: usize = 512 * 1024;
pub const MAX_ENTRIES: usize = 4096;
pub const MAX_READ_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Bypassed,
    NotComputed,
    Complete,
    Incomplete,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Diagnostic {
    pub path: String,
    pub reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Scope {
    pub state: State,
    pub paths: Vec<String>,
    pub matches: Vec<DeclaredMatch>,
    pub withheld: Vec<Withheld>,
    pub diagnostics: Vec<Diagnostic>,
    pub bytes: usize,
    pub reasons: Vec<String>,
}

impl Scope {
    pub fn pending(role: &str, phase: Option<u32>) -> Self {
        let (state, reason) = if matches!(role, "cad-planner" | "cad-assumptions-analyzer") {
            (State::Bypassed, "pre-plan role bypasses declared-scope I/O")
        } else if phase.is_none() {
            (
                State::NotComputed,
                "no phase supplied; no declared scope computed",
            )
        } else {
            (State::NotComputed, "declared scope has not been read")
        };
        Self {
            state,
            paths: vec![],
            matches: vec![],
            withheld: vec![],
            diagnostics: vec![],
            bytes: 0,
            reasons: vec![reason.into()],
        }
    }
    fn incomplete(&mut self, path: &Path, reason: impl Into<String>) {
        self.state = State::Incomplete;
        self.diagnostics.push(Diagnostic {
            path: path.to_string_lossy().into(),
            reason: reason.into(),
        });
    }
}

/// The kind of an entry as `lstat` reports it: a symbolic link is `Symlink`,
/// never what it points at.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Directory,
    File,
    Symlink,
    Other,
}

/// What the floor knows about one entry. The stamp is device, inode, mode and
/// both timestamps to the nanosecond, so two observations with the same length
/// and stamp saw the same entry, unchanged.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Meta {
    pub kind: Kind,
    pub len: u64,
    pub stamp: [i64; 7],
}

/// Everything the floor asks the filesystem. An implementation only answers;
/// what an answer means is decided by the reader below.
pub trait FloorIo {
    /// A body opened for reading.
    type Body;
    fn metadata(&mut self, path: &Path) -> io::Result<Meta>;
    fn canonicalize(&mut self, path: &Path) -> io::Result<PathBuf>;
    /// A directory's entries, stopping once there are more than `bound`.
    fn list(&mut self, path: &Path, bound: usize) -> io::Result<Vec<PathBuf>>;
    /// Open `real`, a path under `root`, without following any link.
    fn open(&mut self, root: &Path, real: &Path) -> io::Result<Self::Body>;
    /// The opened body's own stamp.
    fn stamp(&mut self, body: &Self::Body) -> io::Result<Meta>;
    /// Up to `limit` bytes of the opened body. What was read is kept even
    /// when the read fails part way, because it still counts against the
    /// total read budget.
    fn read(&mut self, body: &mut Self::Body, limit: usize) -> (Vec<u8>, io::Result<()>);
}

/// The host filesystem.
pub struct Host;

fn meta(metadata: &Metadata) -> Meta {
    let kind = metadata.file_type();
    Meta {
        kind: if kind.is_symlink() {
            Kind::Symlink
        } else if kind.is_dir() {
            Kind::Directory
        } else if kind.is_file() {
            Kind::File
        } else {
            Kind::Other
        },
        len: metadata.len(),
        stamp: [
            metadata.dev() as i64,
            metadata.ino() as i64,
            i64::from(metadata.mode()),
            metadata.mtime(),
            metadata.mtime_nsec(),
            metadata.ctime(),
            metadata.ctime_nsec(),
        ],
    }
}

impl FloorIo for Host {
    type Body = File;
    fn metadata(&mut self, path: &Path) -> io::Result<Meta> {
        fs::symlink_metadata(path).map(|metadata| meta(&metadata))
    }
    fn canonicalize(&mut self, path: &Path) -> io::Result<PathBuf> {
        fs::canonicalize(path)
    }
    fn list(&mut self, path: &Path, bound: usize) -> io::Result<Vec<PathBuf>> {
        let mut entries = vec![];
        for entry in fs::read_dir(path)? {
            entries.push(entry?.path());
            if entries.len() > bound {
                break;
            }
        }
        Ok(entries)
    }
    fn open(&mut self, root: &Path, real: &Path) -> io::Result<File> {
        let relative = real
            .strip_prefix(root)
            .map_err(|_| failure("outside project"))?;
        let mut handle = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW)
            .open(root)?;
        let parts: Vec<_> = relative.components().collect();
        for (i, part) in parts.iter().enumerate() {
            use std::{
                ffi::CString,
                os::{
                    fd::{AsRawFd, FromRawFd},
                    unix::ffi::OsStrExt,
                },
            };
            let Component::Normal(name) = part else {
                return Err(failure("non-normal path"));
            };
            let name = CString::new(name.as_bytes()).map_err(|_| failure("NUL path"))?;
            let flags = libc::O_RDONLY
                | libc::O_CLOEXEC
                | libc::O_NOFOLLOW
                | libc::O_NONBLOCK
                | if i + 1 < parts.len() {
                    libc::O_DIRECTORY
                } else {
                    0
                };
            let fd = unsafe { libc::openat(handle.as_raw_fd(), name.as_ptr(), flags) };
            if fd < 0 {
                return Err(io::Error::last_os_error());
            }
            handle = unsafe { File::from_raw_fd(fd) };
        }
        Ok(handle)
    }
    fn stamp(&mut self, body: &File) -> io::Result<Meta> {
        body.metadata().map(|metadata| meta(&metadata))
    }
    fn read(&mut self, body: &mut File, limit: usize) -> (Vec<u8>, io::Result<()>) {
        let mut bytes = Vec::new();
        let read = (&mut *body).take(limit as u64).read_to_end(&mut bytes).map(|_| ());
        (bytes, read)
    }
}

struct Reader<'a, I: FloorIo> {
    root: PathBuf,
    io: &'a mut I,
    bytes: usize,
}

fn same(a: &Meta, b: &Meta) -> bool {
    a.len == b.len && a.stamp == b.stamp
}
fn failure(reason: &str) -> io::Error {
    io::Error::other(reason)
}

impl<I: FloorIo> Reader<'_, I> {
    fn metadata(&mut self, path: &Path) -> io::Result<Meta> {
        self.io.metadata(path)
    }
    fn contained(&mut self, path: &Path) -> io::Result<PathBuf> {
        let real = self.io.canonicalize(path)?;
        if !real.starts_with(&self.root) {
            return Err(failure("path resolves outside the project"));
        }
        Ok(real)
    }
    fn check_parent(&mut self, path: &Path) -> io::Result<()> {
        let mut parent = path.parent().ok_or_else(|| failure("missing parent"))?;
        loop {
            match self.metadata(parent) {
                Ok(meta) => {
                    if meta.kind != Kind::Directory && meta.kind != Kind::Symlink {
                        return Err(failure("parent is not a directory"));
                    }
                    self.contained(parent)?;
                    return Ok(());
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    parent = parent
                        .parent()
                        .ok_or_else(|| failure("no observable parent"))?;
                }
                Err(error) => return Err(error),
            }
        }
    }
    fn inspect(&mut self, path: &Path) -> io::Result<Option<Meta>> {
        self.check_parent(path)?;
        match self.metadata(path) {
            Ok(meta) => {
                if meta.kind == Kind::Symlink {
                    return Err(failure("final symlink is not declared evidence"));
                }
                self.contained(path)?;
                Ok(Some(meta))
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error),
        }
    }
    fn body(&mut self, path: &Path, metadata: &Meta, limit: usize) -> io::Result<Vec<u8>> {
        if metadata.kind != Kind::File {
            return Err(failure("not a regular file"));
        }
        if metadata.len > limit as u64 {
            return Err(failure("body size or total read budget exceeded"));
        }
        let real = self.contained(path)?;
        let mut body = self.io.open(&self.root, &real)?;
        if !same(metadata, &self.io.stamp(&body)?) {
            return Err(failure("body replaced before open"));
        }
        let (bytes, read) = self.io.read(&mut body, limit);
        self.bytes += bytes.len();
        read?;
        if bytes.len() > limit
            || bytes.len() as u64 != metadata.len
            || !same(metadata, &self.io.stamp(&body)?)
            || !same(metadata, &self.metadata(path)?)
            || self.contained(path)? != real
        {
            return Err(failure("body replaced or grew during read"));
        }
        Ok(bytes)
    }
    fn list(&mut self, path: &Path) -> io::Result<Vec<PathBuf>> {
        let before = self
            .inspect(path)?
            .ok_or_else(|| failure("directory missing"))?;
        if before.kind != Kind::Directory {
            return Err(failure("not a directory"));
        }
        let real = self.contained(path)?;
        let mut entries = self.io.list(path, MAX_ENTRIES)?;
        if entries.len() > MAX_ENTRIES {
            return Err(failure("directory exceeds 4096 entry bound"));
        }
        if !same(&before, &self.metadata(path)?) || self.contained(path)? != real {
            return Err(failure("directory changed during enumeration"));
        }
        entries.sort();
        Ok(entries)
    }
}

pub fn read(
    planning_root: &Path,
    role: &str,
    phase: Option<u32>,
    plan: Option<u32>,
    categories: &[String],
) -> Result<Scope> {
    read_with(planning_root, role, phase, plan, categories, &mut Host)
}

/// The declared scope of `phase` (or of one `plan` in it), read through `io`.
/// Every observation failure makes the scope incomplete; none is skipped.
pub fn read_with(
    planning_root: &Path,
    role: &str,
    phase: Option<u32>,
    plan: Option<u32>,
    categories: &[String],
    io: &mut impl FloorIo,
) -> Result<Scope> {
    let mut scope = Scope::pending(role, phase);
    if scope.state == State::Bypassed || phase.is_none() {
        return Ok(scope);
    }
    scope.state = State::Complete;
    scope.reasons.clear();
    let phase = phase.unwrap();
    let project = planning_root.parent().unwrap_or(planning_root);
    let root = match io.canonicalize(project) {
        Ok(root) => root,
        Err(error) => {
            scope.incomplete(project, format!("project canonicalization: {error}"));
            return Ok(scope);
        }
    };
    let mut reader = Reader {
        root,
        io,
        bytes: 0,
    };
    let phase_root = planning_root.join(format!("phases/{phase}"));
    let plans = if let Some(plan) = plan {
        vec![(plan, phase_root.join(format!("PLAN-{plan}.md")))]
    } else {
        match reader.list(&phase_root) {
            Ok(entries) => {
                let mut plans = vec![];
                for path in entries {
                    let name = path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or_default();
                    if !name.starts_with("PLAN-") || !name.ends_with(".md") {
                        continue;
                    }
                    let number = &name[5..name.len() - 3];
                    match number.parse::<u32>() {
                        Ok(n) if n > 0 && number == n.to_string() => plans.push((n, path)),
                        _ => scope.incomplete(&path, "invalid native plan name"),
                    }
                }
                plans.sort_by_key(|(number, _)| *number);
                plans
            }
            Err(error) => {
                scope.incomplete(&phase_root, format!("phase listing: {error}"));
                vec![]
            }
        }
    };
    if plans.is_empty() {
        scope.incomplete(&phase_root, "no native plans observed");
    }
    let mut files = BTreeSet::new();
    let mut directories = BTreeSet::new();
    for (number, path) in plans {
        let bytes = reader.inspect(&path).and_then(|meta| {
            reader.body(
                &path,
                &meta.ok_or_else(|| failure("plan missing"))?,
                MAX_DOCUMENT_BYTES,
            )
        });
        match bytes {
            Ok(bytes) => match parse_plan(&bytes, phase, number) {
                Ok(plan) => {
                    files.extend(plan.files);
                    directories.extend(plan.directories);
                }
                Err(error) => scope.incomplete(&path, format!("plan parse: {}", error.code)),
            },
            Err(error) => scope.incomplete(&path, format!("plan read: {error}")),
        }
    }
    if files.is_empty() && directories.is_empty() {
        scope.incomplete(&phase_root, "empty total declared scope");
    }
    let mut pending: BTreeSet<(String, bool)> = files
        .into_iter()
        .map(|path| (path, false))
        .chain(directories.into_iter().map(|path| (path, true)))
        .collect();
    reader.bytes = 0;
    let mut visited = BTreeSet::new();
    let mut expanded = BTreeSet::new();
    while let Some((relative, directory)) = pending.pop_first() {
        let path = reader.root.join(&relative);
        let first = visited.insert(relative.clone());
        if first && visited.len() > MAX_ENTRIES {
            scope.incomplete(Path::new(&relative), "scope exceeds 4096 entry bound");
            break;
        }
        if !first && (!directory || expanded.contains(&relative)) {
            continue;
        }
        if first {
            scope.paths.push(relative.clone());
        }
        let metadata = match reader.inspect(&path) {
            Ok(value) => value,
            Err(error) => {
                scope.incomplete(
                    Path::new(&relative),
                    format!("metadata or containment: {error}"),
                );
                None
            }
        };
        let mut body = None;
        if let Some(metadata) = metadata {
            if directory && metadata.kind == Kind::Directory {
                expanded.insert(relative.clone());
                match reader.list(&path) {
                    Ok(entries) => {
                        for entry in entries {
                            let Some(rel) =
                                entry.strip_prefix(&reader.root).ok().and_then(Path::to_str)
                            else {
                                scope.incomplete(&entry, "non-UTF-8 path");
                                continue;
                            };
                            match reader.metadata(&entry) {
                                Ok(meta) => {
                                    pending.insert((rel.into(), meta.kind == Kind::Directory));
                                }
                                Err(error) => {
                                    scope.incomplete(
                                        Path::new(rel),
                                        format!("entry metadata: {error}"),
                                    );
                                    pending.insert((rel.into(), false));
                                }
                            }
                        }
                    }
                    Err(error) => scope.incomplete(
                        Path::new(&relative),
                        format!("directory enumeration: {error}"),
                    ),
                }
            } else if directory {
                scope.incomplete(
                    Path::new(&relative),
                    "declared directory is not a directory",
                );
            } else if first {
                let limit = MAX_BODY_BYTES.min(MAX_READ_BYTES.saturating_sub(reader.bytes));
                match reader.body(&path, &metadata, limit) {
                    Ok(bytes) => match String::from_utf8(bytes) {
                        Ok(text) => body = Some(text),
                        Err(_) => scope.incomplete(Path::new(&relative), "body is not UTF-8"),
                    },
                    Err(error) => {
                        scope.incomplete(Path::new(&relative), format!("body read: {error}"))
                    }
                }
            }
        } else if directory {
            scope.incomplete(Path::new(&relative), "declared directory is unobserved");
        }
        if first {
            let scan = risk_diff::scan_declared(&relative, body.as_deref(), categories)?;
            scope.matches.extend(scan.matches);
            scope.withheld.extend(scan.withheld);
        }
    }
    scope.bytes = reader.bytes;
    scope.paths.sort();
    scope.reasons.push(
        if scope.state == State::Incomplete {
            "required declared scope is incomplete"
        } else {
            "declared scope read completely"
        }
        .into(),
    );
    Ok(scope)
}

#[derive(Debug, PartialEq, Eq)]
pub struct Recommendation {
    pub deep_verification: bool,
    pub reasons: Vec<String>,
}

pub fn recommend(scope: &Scope, waived: &[String]) -> Recommendation {
    let mut result = Recommendation {
        deep_verification: false,
        reasons: scope.reasons.clone(),
    };
    if matches!(scope.state, State::Bypassed | State::NotComputed) {
        return result;
    }
    if scope.state == State::Incomplete {
        result.deep_verification = true;
        result.reasons.push("Incomplete required scope recommends deep verification; category waivers cannot waive failed observations.".into());
    }
    for hit in &scope.matches {
        if waived.contains(&hit.category) {
            result.reasons.push(format!(
                "{}: {} ({}) is waived for the plan-time floor",
                hit.path, hit.category, hit.signal
            ));
        } else {
            result.deep_verification = true;
            result.reasons.push(format!(
                "{}: unwaived {} ({}) recommends deep verification",
                hit.path, hit.category, hit.signal
            ));
        }
    }
    if !result.deep_verification {
        result.reasons.push(
            if scope.matches.is_empty() {
                "Complete scope has no selected risk match; no floor raise."
            } else {
                "Every matched category is waived; no floor raise."
            }
            .into(),
        );
    }
    result
}
