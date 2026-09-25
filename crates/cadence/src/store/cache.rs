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
                if !name.is_empty() {
                    crate::acquisition::permit(&path.to_string_lossy(), crate::acquisition::Class::Store, target.len())
                        .map_err(crate::acquisition::store_error)?;
                }
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

/// The views kept for recently read stores, least recently used first.
#[derive(Default)]
pub(crate) struct Views(VecDeque<Entry>);

impl Views {
    /// Bound retention when a resident visits many stores. Active readers own
    /// their handles independently of eviction.
    const KEPT: usize = 4;

    /// The kept view of `root` if its files still have `identity`; it becomes
    /// the most recently used. A kept view whose files changed is dropped.
    pub(crate) fn reuse(&mut self, root: &Path, identity: &Identity) -> Option<Arc<View>> {
        let index = self.0.iter().position(|entry| entry.root == root)?;
        let entry = self.0.remove(index)?;
        if entry.identity != *identity {
            return None;
        }
        let view = entry.view.clone();
        self.0.push_back(entry);
        Some(view)
    }

    /// Keep `view` as `root`'s, read while its files had `identity`, in place
    /// of any view kept before. A store with no state file keeps nothing, and
    /// the least recently used store goes when too many are kept.
    pub(crate) fn keep(&mut self, root: PathBuf, identity: Identity, view: Arc<View>) {
        self.forget(&root);
        if identity.0[1].is_none() {
            return;
        }
        while self.0.len() >= Self::KEPT { self.0.pop_front(); }
        self.0.push_back(Entry { root, identity, view });
    }

    pub(crate) fn forget(&mut self, root: &Path) {
        self.0.retain(|entry| entry.root != root);
    }
}

static VIEWS: OnceLock<Mutex<Views>> = OnceLock::new();
fn views() -> std::sync::MutexGuard<'static, Views> {
    VIEWS.get_or_init(Mutex::default).lock().unwrap_or_else(|e| e.into_inner())
}

/// A snapshot handle borrows the writer's view without copying its JSON tree.
#[derive(Clone)]
pub struct SharedSnapshot(pub Arc<View>);
impl std::ops::Deref for SharedSnapshot {
    type Target = Snapshot;
    fn deref(&self) -> &Snapshot { &self.0.snapshot }
}

pub fn invalidate(root: &Path) {
    if let Ok(root) = std::path::absolute(root) {
        views().forget(&root);
    }
}

pub fn publish(root: &Path, identity: Identity, view: Arc<View>) -> Result<()> {
    views().keep(std::path::absolute(root)?, identity, view);
    Ok(())
}

pub fn read(root: &Path) -> Result<Option<SharedSnapshot>> {
    let root = std::path::absolute(root)?;
    let before = identity(&root)?;
    if let Some(view) = views().reuse(&root, &before) {
        return Ok(Some(SharedSnapshot(view)));
    }
    let bytes = match crate::acquisition::read(&root.join(model::STATE), crate::acquisition::Class::Store) {
        Ok(bytes) => bytes,
        Err(crate::acquisition::Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(crate::acquisition::store_error(e)),
    };
    let items = crate::acquisition::read(&root.join(model::ITEMS), crate::acquisition::Class::Store)
        .map_err(crate::acquisition::store_error)?;
    let decisions = crate::acquisition::read(&root.join(model::DECISIONS), crate::acquisition::Class::Store)
        .map_err(crate::acquisition::store_error)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn file(inode: u64) -> Option<(FileIdentity, FileIdentity)> {
        let identity = FileIdentity { device: 1, inode, length: 10, modified: (1, 0), changed: (1, 0) };
        Some((identity.clone(), identity))
    }

    /// A store's files as `identity` lists them: the root directory, then the
    /// state, items and decisions files.
    fn store() -> Identity {
        Identity(vec![file(1), file(2), file(3), file(4)])
    }

    /// The same store with the file at `index` replaced.
    fn changed(index: usize) -> Identity {
        let mut identity = store();
        identity.0[index] = file(100 + index as u64);
        identity
    }

    fn view(generation: u64) -> Arc<View> {
        Arc::new(View {
            items: vec![],
            decisions: vec![],
            snapshot: Snapshot::new(generation, b"", b"", serde_json::Value::Null).unwrap(),
        })
    }

    fn root(name: &str) -> PathBuf {
        PathBuf::from("/stores").join(name)
    }

    #[test]
    fn a_kept_view_is_reused_while_its_files_are_unchanged() {
        let mut views = Views::default();
        let kept = view(1);
        views.keep(root("a"), store(), kept.clone());
        assert!(Arc::ptr_eq(&views.reuse(&root("a"), &store()).unwrap(), &kept));
    }

    #[test]
    fn a_change_to_the_root_or_any_store_file_drops_the_kept_view() {
        for index in 0..4 {
            let mut views = Views::default();
            views.keep(root("a"), store(), view(1));
            assert!(views.reuse(&root("a"), &changed(index)).is_none(), "file {index}");
            assert!(views.reuse(&root("a"), &store()).is_none(), "file {index} is dropped");
        }
    }

    #[test]
    fn a_later_view_of_the_same_store_replaces_the_earlier_one() {
        let mut views = Views::default();
        views.keep(root("a"), store(), view(1));
        let later = view(2);
        views.keep(root("a"), changed(1), later.clone());
        assert_eq!(views.0.len(), 1);
        assert!(Arc::ptr_eq(&views.reuse(&root("a"), &changed(1)).unwrap(), &later));
    }

    #[test]
    fn a_store_without_a_state_file_keeps_nothing_and_drops_its_earlier_view() {
        let mut views = Views::default();
        views.keep(root("a"), store(), view(1));
        let mut missing = store();
        missing.0[1] = None;
        views.keep(root("a"), missing.clone(), view(2));
        assert!(views.reuse(&root("a"), &missing).is_none());
        assert!(views.reuse(&root("a"), &store()).is_none());
    }

    #[test]
    fn keeping_a_fifth_store_drops_the_least_recently_used() {
        let mut views = Views::default();
        for name in ["a", "b", "c", "d"] {
            views.keep(root(name), store(), view(1));
        }
        views.reuse(&root("a"), &store()).unwrap();
        views.keep(root("e"), store(), view(1));
        assert!(views.reuse(&root("b"), &store()).is_none());
        for name in ["a", "c", "d", "e"] {
            assert!(views.reuse(&root(name), &store()).is_some(), "{name}");
        }
    }
}
