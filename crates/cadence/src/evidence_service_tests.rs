use super::{
    CadenceServer,
    evidence_service::Command,
};
use crate::import::SessionFactory;
use cadence::store::Error;
use std::sync::Arc;

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().unwrap()
}
fn factory() -> SessionFactory {
    SessionFactory::new(None, Arc::new(|_, _| Ok(())))
}
fn fixture() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(
        root.path().join("STATE.md"),
        "Phase: 5 of 5 (Evidence)\nStatus: planned\nNext:  exact imported next\n",
    )
    .unwrap();
    root
}

#[test]
fn closed_resident_returns_closed() {
    let root = fixture();
    let rt = runtime();
    let server = rt.block_on(async { CadenceServer::with_factory(factory()) });
    drop(rt);
    assert_eq!(
        runtime().block_on(server.evidence(root.path(), Command::Read)),
        Err(Error::Closed)
    );
}

