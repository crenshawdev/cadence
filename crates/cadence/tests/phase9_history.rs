#[allow(dead_code)]
#[path = "../src/review/history.rs"]
mod history;

struct SavedBytes;
impl history::HistoricalIo for SavedBytes {
    fn read(&mut self, key: &str) -> std::io::Result<Vec<u8>> {
        match key {
            "old-pause" => Ok(include_bytes!("fixtures/phase9/historical-pause.json").to_vec()),
            _ => Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "unknown fixture",
            )),
        }
    }
}

#[test]
fn history_fix_without_dispatch_remains_historical() {
    // The supplied filesystem boundary exposes reads only; writes are forbidden.
    assert_eq!(
        serde_json::to_value(history::read_pause_origin(&mut SavedBytes, "old-pause").unwrap())
            .unwrap(),
        serde_json::json!({"provenance":"historical","dispatch":null,"verified":false})
    );
}
