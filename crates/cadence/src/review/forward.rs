//! Transport the return without interpretation or reserialization.
pub struct RawReturn {
    pub submitted_bytes: Vec<u8>,
}

pub fn forward_return(raw: &[u8]) -> RawReturn {
    RawReturn {
        submitted_bytes: raw.to_vec(),
    }
}
