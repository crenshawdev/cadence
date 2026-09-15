//! Bound stream acquisition before any parser sees the return.
use serde::Serialize;
use std::io::Read;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum ReadReturnError {
    ReturnTooLarge { limit: usize },
    ReadFailed { message: String },
}

/// Retain exact bytes through the supplied cap (H4 production cap: 4 MiB).
/// The extra byte proves excess; it is never truncated into an accepted return.
/// `Take` prevents even a subsequent EOF probe from touching the input beyond
/// cap plus one. Neither content nor JSON whitespace is interpreted here.
pub fn read_return(input: impl Read, cap: usize) -> Result<Vec<u8>, ReadReturnError> {
    let mut bytes = Vec::new();
    input
        .take((cap as u64).saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|error| ReadReturnError::ReadFailed {
            message: error.to_string(),
        })?;
    if bytes.len() > cap {
        return Err(ReadReturnError::ReturnTooLarge { limit: cap });
    }
    Ok(bytes)
}
