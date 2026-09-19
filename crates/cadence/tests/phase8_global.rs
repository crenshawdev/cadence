use cadence::store::{
    Error, MutationContext, Observed, Policy, Result, Storage,
    filesystem::{Filesystem, Stage},
    transaction::{ExternalChange, Transaction},
    writer::{Operation, Store},
};
use std::{
    collections::BTreeMap,
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    path::Path,
    sync::{Arc, Mutex},
};

fn observed(bytes: Option<&[u8]>, identity: &str) -> Observed {
    Observed {
        bytes: bytes.map(Vec::from),
        identity: identity.into(),
        directory_identity: "global-parent".into(),
    }
}

fn change() -> ExternalChange {
    ExternalChange {
        target: "global-config".into(),
        expected: observed(Some(br#"{"workflow":{"verifier":false}}"#), "generation-2"),
        bytes: br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.to_vec(),
    }
}

#[test]
fn stale_global_generation_returns_the_exact_typed_refusal() {
    assert_eq!(
        change().validate(&observed(Some(b"{}"), "generation-3"), false),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn fresh_global_generation_returns_both_accepted_keys() {
    assert_eq!(
        change().validate(
            &observed(Some(br#"{"workflow":{"verifier":false}}"#), "generation-2"),
            false
        ),
        Ok(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.as_slice())
    );
}

#[test]
fn first_creation_refuses_an_already_accepted_global() {
    let mut supplied = change();
    supplied.expected = observed(None, "global-parent");
    assert_eq!(
        supplied.validate(&observed(Some(b"{}"), "generation-1"), false),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn first_creation_accepts_the_missing_destination_token() {
    let mut supplied = change();
    supplied.expected = observed(None, "global-parent");
    assert_eq!(
        supplied.validate(&observed(None, "global-parent"), false),
        Ok(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.as_slice())
    );
}

#[test]
fn recovery_accepts_exact_installed_bytes_in_the_bound_parent() {
    assert_eq!(
        change().validate(
            &observed(
                Some(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#),
                "installed-inode"
            ),
            true
        ),
        Ok(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.as_slice())
    );
}

#[test]
fn recovery_refuses_a_newer_foreign_global_value() {
    assert_eq!(
        change().validate(
            &observed(Some(br#"{"workflow":{"verifier":true}}"#), "foreign-inode"),
            true
        ),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn recovery_refuses_identical_bytes_in_a_replaced_parent() {
    let mut current = observed(
        Some(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#),
        "installed-inode",
    );
    current.directory_identity = "foreign-parent".into();
    assert_eq!(
        change().validate(&current, true),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

fn locked(path: &Path) -> bool {
    let file = File::open(path).unwrap();
    let result = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    result != 0 && std::io::Error::last_os_error().kind() == std::io::ErrorKind::WouldBlock
}

#[test]
fn acquire_holds_root_and_shared_parent_until_its_guard_drops() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().join("project/.planning");
    let global = fixture.path().join("global/config.v4.json");
    let mut storage = Filesystem::new(&root)
        .unwrap()
        .with_participant("global-config", &global)
        .unwrap();
    assert_eq!(
        storage.acquire().map(|guard| {
            let during = (locked(&root), locked(global.parent().unwrap()));
            drop(guard);
            (during, (locked(&root), locked(global.parent().unwrap())))
        }),
        Ok(((true, true), (false, false)))
    );
}

#[test]
fn acquire_deduplicates_aliases_and_orders_inodes_despite_reversed_registration() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().join("project/.planning");
    let other = fixture.path().join("shared/config.v4.json");
    let captured = Arc::new(Mutex::new(Vec::new()));
    let probe = captured.clone();
    let mut storage = Filesystem::new(&root)
        .unwrap()
        .with_participant("global-config", root.join("config.v4.json"))
        .unwrap()
        .with_participant("repo-config", other)
        .unwrap()
        .with_probe(move |stage, path| {
            if stage == Stage::OwnershipAcquired {
                let metadata = std::fs::metadata(path)?;
                probe.lock().unwrap().push((metadata.dev(), metadata.ino()));
            }
            Ok(())
        });
    assert_eq!(
        storage.acquire().map(|_guard| {
            let order = captured.lock().unwrap();
            (order.len(), order.windows(2).all(|pair| pair[0] < pair[1]))
        }),
        Ok((2, true))
    );
}

#[test]
fn acquire_refuses_replaced_registered_parent() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().join("project/.planning");
    let global = fixture.path().join("global/config.v4.json");
    let mut storage = Filesystem::new(&root)
        .unwrap()
        .with_participant("global-config", &global)
        .unwrap();
    std::fs::rename(global.parent().unwrap(), fixture.path().join("old-global")).unwrap();
    std::fs::create_dir(global.parent().unwrap()).unwrap();
    assert_eq!(
        storage.acquire().err(),
        Some(Error::Conflict(
            "registered directory identity changed".into()
        ))
    );
}

struct Allow;
impl Policy for Allow {
    fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> {
        Ok(())
    }
}

struct Memory(BTreeMap<String, Observed>);
impl Storage for Memory {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, target: &str) -> Result<Observed> {
        Ok(self
            .0
            .get(target)
            .cloned()
            .unwrap_or_else(|| observed(None, "missing")))
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        self.0
            .insert(prepared.0.clone(), observed(Some(&prepared.1), "installed"));
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, target: &str, _: &[u8]) -> Result<Observed> {
        self.read(target)
    }
    fn resync(&mut self, target: &str, _: &[u8]) -> Result<Observed> {
        self.read(target)
    }
    fn remove(&mut self, target: &str) -> Result<()> {
        self.0.remove(target);
        Ok(())
    }
}

#[tokio::test]
async fn writer_refuses_a_stale_global_before_installing_intent() {
    let storage = Memory(
        [(
            "global-config".into(),
            observed(Some(b"{}"), "generation-3"),
        )]
        .into(),
    );
    let store = Store::open(storage, Allow).await.unwrap();
    assert_eq!(
        store
            .request(Operation::Transact(Transaction {
                id: "stale-global".into(),
                items: vec![],
                decisions: vec![],
                snapshot: None,
                external: vec![change()],
            }))
            .await,
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[tokio::test]
async fn writer_accepts_a_fresh_global_transaction() {
    let storage = Memory(
        [(
            "global-config".into(),
            observed(Some(br#"{"workflow":{"verifier":false}}"#), "generation-2"),
        )]
        .into(),
    );
    let store = Store::open(storage, Allow).await.unwrap();
    assert_eq!(
        store
            .request(Operation::Transact(Transaction {
                id: "fresh-global".into(),
                items: vec![],
                decisions: vec![],
                snapshot: None,
                external: vec![change()],
            }))
            .await
            .map(|view| view.snapshot.generation),
        Ok(1)
    );
}
