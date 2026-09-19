//! Historical reads preserve origin without rewriting or promoting old findings.
use serde::Serialize;
use serde_json::Value;
use std::{
    io,
    path::{Component, Path, PathBuf},
};

/// This filesystem boundary offers no mutation operation.
pub trait HistoricalIo {
    fn read(&mut self, key: &str) -> io::Result<Vec<u8>>;
}

pub struct HistoricalFiles {
    pub root: PathBuf,
}
impl HistoricalIo for HistoricalFiles {
    fn read(&mut self, key: &str) -> io::Result<Vec<u8>> {
        let path = Path::new(key);
        if path.as_os_str().is_empty()
            || path
                .components()
                .any(|c| !matches!(c, Component::Normal(_)))
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "historical path must be relative to the planning root",
            ));
        }
        let root = self.root.canonicalize()?;
        let path = root.join(path).canonicalize()?;
        if !path.starts_with(&root) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "historical path escaped planning root",
            ));
        }
        std::fs::read(path)
    }
}

#[derive(Debug, Serialize)]
pub struct PauseOrigin {
    pub provenance: &'static str,
    pub dispatch: Option<Value>,
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery: Option<&'static str>,
}

pub fn read_pause_origin(io: &mut impl HistoricalIo, key: &str) -> io::Result<PauseOrigin> {
    let bytes = io.read(key)?;
    let saved = serde_json::from_slice::<Value>(&bytes).ok();
    let dispatch = saved
        .as_ref()
        .and_then(|v| v.get("dispatch"))
        .filter(|v| !v.is_null())
        .cloned();
    let historical = saved
        .as_ref()
        .and_then(|v| v.get("findings"))
        .and_then(Value::as_array)
        .is_some_and(|findings| {
            !findings.is_empty()
                && findings
                    .iter()
                    .all(|f| f.get("fix").and_then(Value::as_str).is_some())
        })
        && dispatch.is_none();
    Ok(PauseOrigin {
        provenance: "historical",
        dispatch,
        verified: false,
        diagnostic: (!historical).then_some("unrecognized-historical-schema"),
        recovery: (!historical)
            .then_some("request-an-identified-new-review; phase-10-owns-recovery-and-settlement"),
    })
}
