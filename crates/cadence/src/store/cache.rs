//! Shared verified store views. Metadata checks never acquire ownership or recover
//! an intent; a cold read verifies the exact bytes before publishing its view.
use super::{Error, Result, model::{self, Snapshot}, writer::View};
use std::{collections::VecDeque, path::{Path, PathBuf}, sync::{Arc, Mutex, OnceLock}};
use std::os::unix::fs::MetadataExt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identity(Vec<Option<(FileIdentity, FileIdentity)>>);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct FileIdentity {
    device: u64, inode: u64, length: u64,
    modified: (i64, i64), changed: (i64, i64),
}
impl FileIdentity {
    pub(crate) fn new(m: &std::fs::Metadata) -> Self {
        Self { device: m.dev(), inode: m.ino(), length: m.len(),
            modified: (m.mtime(), m.mtime_nsec()), changed: (m.ctime(), m.ctime_nsec()) }
    }
}

pub fn identity(root: &Path) -> Result<Identity> {
    let mut files = Vec::new();
    for name in ["", model::STATE, model::ITEMS, model::DECISIONS] {
        let path = root.join(name);
        files.push(match std::fs::symlink_metadata(&path) {
            Ok(link) => {
                let target = std::fs::metadata(&path)?;
                let normalize = |m: &std::fs::Metadata| {
                    let mut identity = FileIdentity::new(m);
                    if name.is_empty() { identity.length = 0; identity.modified = (0, 0); identity.changed = (0, 0); }
                    identity
                };
                Some((normalize(&link), normalize(&target)))
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(e.into()),
        });
    }
    Ok(Identity(files))
}

struct Entry { root: PathBuf, identity: Identity, view: Arc<View> }
static VIEWS: OnceLock<Mutex<VecDeque<Entry>>> = OnceLock::new();
fn views() -> &'static Mutex<VecDeque<Entry>> { VIEWS.get_or_init(Mutex::default) }

/// A snapshot handle borrows the writer's view without copying its JSON tree.
#[derive(Clone)]
pub struct SharedSnapshot(pub Arc<View>);
impl std::ops::Deref for SharedSnapshot {
    type Target = Snapshot;
    fn deref(&self) -> &Snapshot { &self.0.snapshot }
}

pub fn invalidate(root: &Path) {
    if let Ok(root) = std::path::absolute(root) {
        views().lock().unwrap_or_else(|e| e.into_inner()).retain(|entry| entry.root != root);
    }
}

pub fn publish(root: &Path, identity: Identity, view: Arc<View>) -> Result<()> {
    if identity.0[1].is_none() { invalidate(root); return Ok(()); }
    let root = std::path::absolute(root)?;
    let mut entries = views().lock().unwrap_or_else(|e| e.into_inner());
    entries.retain(|entry| entry.root != root);
    // Bound retention when a resident visits many stores. Active readers own
    // their handles independently of eviction.
    while entries.len() >= 4 { entries.pop_front(); }
    entries.push_back(Entry { root, identity, view });
    Ok(())
}

pub fn read(root: &Path) -> Result<Option<SharedSnapshot>> {
    let root = std::path::absolute(root)?;
    let before = identity(&root)?;
    {
        let mut entries = views().lock().unwrap_or_else(|e| e.into_inner());
        if let Some(index) = entries.iter().position(|entry| entry.root == root) {
            let entry = entries.remove(index).unwrap();
            if entry.identity == before {
                let view = entry.view.clone();
                entries.push_back(entry);
                return Ok(Some(SharedSnapshot(view)));
            }
        }
    }
    let bytes = match std::fs::read(root.join(model::STATE)) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let items = std::fs::read(root.join(model::ITEMS))?;
    let decisions = std::fs::read(root.join(model::DECISIONS))?;
    #[cfg(test)]
    crate::context::persistence::READ_PARSES.with(|count| count.set(count.get() + 1));
    let snapshot = Snapshot::parse(&bytes, &items, &decisions)?;
    let items = model::parse_lines(&items)?;
    let decisions = model::parse_lines(&decisions)?;
    model::validate_items(&items)?;
    model::validate_decisions(&decisions)?;
    if identity(&root)? != before {
        return Err(Error::Conflict("store changed while reading snapshot".into()));
    }
    let view = Arc::new(View { snapshot, items, decisions });
    publish(&root, before, view.clone())?;
    Ok(Some(SharedSnapshot(view)))
}
