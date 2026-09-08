#[path = "../src/review/stream.rs"]
mod stream;

use serde_json::{Value, json};
use std::io::{self, Read};
use stream::read_return;

/// The input-stream boundary serves fixed chunks and refuses any acquisition
/// after the fixture's limit. It does not replace a parser or internal unit.
struct FixedChunks {
    bytes: Vec<u8>,
    position: usize,
    chunk: usize,
    forbid_read_after: Option<usize>,
}
impl Read for FixedChunks {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if self
            .forbid_read_after
            .is_some_and(|limit| self.position >= limit)
        {
            return Err(io::Error::other("forbidden read after cap plus one"));
        }
        let count = buffer
            .len()
            .min(self.chunk)
            .min(self.bytes.len() - self.position);
        buffer[..count].copy_from_slice(&self.bytes[self.position..self.position + count]);
        self.position += count;
        Ok(count)
    }
}
fn input(name: &str) -> (FixedChunks, usize) {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/phase9/h4-stream.json")).unwrap();
    let case = &fixture[name];
    let mut bytes = case["envelope"].as_str().unwrap().as_bytes().to_vec();
    let total = case["bytes"].as_u64().unwrap() as usize;
    let padding = case["padding"].as_str().unwrap().as_bytes();
    bytes.extend(padding.iter().copied().cycle().take(total - bytes.len()));
    (
        FixedChunks {
            bytes,
            position: 0,
            chunk: case["chunk"].as_u64().unwrap() as usize,
            forbid_read_after: case["forbid_read_after"].as_u64().map(|n| n as usize),
        },
        case["cap"].as_u64().unwrap() as usize,
    )
}
#[test]
fn stream_excess_ac107() {
    let (excess, cap) = input("excess");
    assert_eq!(
        serde_json::to_value(read_return(excess, cap).unwrap_err()).unwrap(),
        json!({"code":"return-too-large","limit":4194304})
    );
}
#[test]
fn stream_exact_cap_ac111() {
    let (exact, cap) = input("exact");
    assert_eq!(read_return(exact, cap).unwrap().len(), 4194304);
}
