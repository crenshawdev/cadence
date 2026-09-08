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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    Metadata,
    Canonicalize,
    ListDirectory,
    OpenBody,
    ReadBody,
    AfterRead,
}

struct Reader<F> {
    root: PathBuf,
    observe: F,
    bytes: usize,
}

fn same(a: &Metadata, b: &Metadata) -> bool {
    (
        a.dev(),
        a.ino(),
        a.mode(),
        a.len(),
        a.mtime(),
        a.mtime_nsec(),
        a.ctime(),
        a.ctime_nsec(),
    ) == (
        b.dev(),
        b.ino(),
        b.mode(),
        b.len(),
        b.mtime(),
        b.mtime_nsec(),
        b.ctime(),
        b.ctime_nsec(),
    )
}
fn failure(reason: &str) -> io::Error {
    io::Error::other(reason)
}

impl<F: FnMut(Access, &Path) -> io::Result<()>> Reader<F> {
    fn metadata(&mut self, path: &Path) -> io::Result<Metadata> {
        (self.observe)(Access::Metadata, path)?;
        fs::symlink_metadata(path)
    }
    fn canonicalize(&mut self, path: &Path) -> io::Result<PathBuf> {
        (self.observe)(Access::Canonicalize, path)?;
        fs::canonicalize(path)
    }
    fn contained(&mut self, path: &Path) -> io::Result<PathBuf> {
        let real = self.canonicalize(path)?;
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
                    if !meta.is_dir() && !meta.file_type().is_symlink() {
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
    fn inspect(&mut self, path: &Path) -> io::Result<Option<Metadata>> {
        self.check_parent(path)?;
        match self.metadata(path) {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    return Err(failure("final symlink is not declared evidence"));
                }
                self.contained(path)?;
                Ok(Some(meta))
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error),
        }
    }
    fn open_contained(&mut self, real: &Path) -> io::Result<File> {
        let relative = real
            .strip_prefix(&self.root)
            .map_err(|_| failure("outside project"))?;
        let mut handle = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW)
            .open(&self.root)?;
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
    fn body(&mut self, path: &Path, metadata: &Metadata, limit: usize) -> io::Result<Vec<u8>> {
        if !metadata.is_file() {
            return Err(failure("not a regular file"));
        }
        if metadata.len() > limit as u64 {
            return Err(failure("body size or total read budget exceeded"));
        }
        let real = self.contained(path)?;
        (self.observe)(Access::OpenBody, path)?;
        let mut file = self.open_contained(&real)?;
        if !same(metadata, &file.metadata()?) {
            return Err(failure("body replaced before open"));
        }
        (self.observe)(Access::ReadBody, path)?;
        let mut bytes = Vec::new();
        let read = (&mut file).take(limit as u64).read_to_end(&mut bytes);
        self.bytes += bytes.len();
        read?;
        (self.observe)(Access::AfterRead, path)?;
        if bytes.len() > limit
            || bytes.len() as u64 != metadata.len()
            || !same(metadata, &file.metadata()?)
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
        if !before.is_dir() {
            return Err(failure("not a directory"));
        }
        let real = self.contained(path)?;
        (self.observe)(Access::ListDirectory, path)?;
        let mut entries = vec![];
        for entry in fs::read_dir(path)? {
            entries.push(entry?.path());
            if entries.len() > MAX_ENTRIES {
                return Err(failure("directory exceeds 4096 entry bound"));
            }
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
    read_observed(planning_root, role, phase, plan, categories, |_, _| Ok(()))
}

pub fn read_observed(
    planning_root: &Path,
    role: &str,
    phase: Option<u32>,
    plan: Option<u32>,
    categories: &[String],
    mut observe: impl FnMut(Access, &Path) -> io::Result<()>,
) -> Result<Scope> {
    let mut scope = Scope::pending(role, phase);
    if scope.state == State::Bypassed || phase.is_none() {
        return Ok(scope);
    }
    scope.state = State::Complete;
    scope.reasons.clear();
    let phase = phase.unwrap();
    let project = planning_root.parent().unwrap_or(planning_root);
    let root = match observe(Access::Canonicalize, project).and_then(|()| fs::canonicalize(project))
    {
        Ok(root) => root,
        Err(error) => {
            scope.incomplete(project, format!("project canonicalization: {error}"));
            return Ok(scope);
        }
    };
    let mut reader = Reader {
        root,
        observe,
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
            if directory && metadata.is_dir() {
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
                                    pending.insert((rel.into(), meta.is_dir()));
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
