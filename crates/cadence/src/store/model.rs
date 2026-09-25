//! Synchronous record algebra. No runtime or ambient inputs are used here.
use super::{Error, Result};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub const VERSION: u32 = 1;
pub const ITEMS: &str = "items.jsonl";
pub const DECISIONS: &str = "decisions.jsonl";
pub const STATE: &str = "state.json";

/// Missing evidence, explicit null, and uninterpreted source text are distinct.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Evidence {
    #[default]
    Missing,
    Null,
    Text(String),
}

impl Evidence {
    pub fn is_missing(&self) -> bool {
        matches!(self, Self::Missing)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Origin {
    pub source: String,
    #[serde(default)]
    pub original: Evidence,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Disposition {
    Captured,
    Filed { pointer: String },
    Declined { reason: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemRecord {
    pub version: u32,
    pub id: String,
    pub revision: u64,
    pub origin: Origin,
    pub text: String,
    pub kind: String,
    /// The phase a capture is about (D-144), typed and never carried inside
    /// the text. Only a todo takes one, and a revision may not change it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase: Option<u32>,
    pub disposition: Disposition,
    pub completed: bool,
    pub filing_uncertain: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "class", rename_all = "snake_case")]
pub enum Decision {
    Routing {
        choice: String,
        config_provenance: BTreeMap<String, Evidence>,
        requested_effort: Evidence,
        #[serde(default, skip_serializing_if = "Evidence::is_missing")]
        observed_effort: Evidence,
        #[serde(default, skip_serializing_if = "Evidence::is_missing")]
        receipt: Evidence,
    },
    Gate {
        outcome: String,
        evidence: Evidence,
    },
    Refusal {
        reason: String,
        evidence: Evidence,
    },
    BoundaryV1(BoundaryRecordV1),
    Boundary {
        phase: u32,
        tool: String,
        operation: String,
        request_digest: String,
        outcome: String,
        subject_id: Option<String>,
        store_generation: u64,
        prompt_digest: Option<String>,
        response_digest: String,
        terminal: bool,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BoundaryRecordV1 {
    pub boundary: cadence::execution::boundary::BoundaryV1,
    pub store_generation: u64,
    pub terminal: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DecisionRecord {
    pub version: u32,
    pub id: String,
    pub revision: u64,
    pub origin: Origin,
    pub decision: Decision,
    /// Seconds since the epoch, observed when the binary wrote the record
    /// (D-143). Generation says in what order records arrived and never when;
    /// a row imported from a legacy source carries no time at all.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<u64>,
}

/// The second a record is being written, from the clock the review runners use.
pub fn stamped_at() -> Option<u64> {
    use crate::review::io::Clock;
    Some(crate::review::material_io::WallClock.now())
}

impl DecisionRecord {
    /// Whole-record equality apart from the write-time stamp. A caller that
    /// rebuilds a record from its own evidence never observes the instant the
    /// writer did, so every equality either side validates is taken over the
    /// content and leaves `at` to the observation it is.
    pub fn same_record(&self, other: &Self) -> bool {
        self.version == other.version
            && self.id == other.id
            && self.revision == other.revision
            && self.origin == other.origin
            && self.decision == other.decision
    }

    /// This record without its write-time stamp, for a preimage a rebuild has
    /// to reproduce byte for byte. A record that never carried one serializes
    /// exactly as it always did, so a digest already taken over it is
    /// unchanged.
    #[must_use]
    pub fn unstamped(&self) -> Self {
        Self { at: None, ..self.clone() }
    }
}

/// Whether the log already holds this record, ignoring its write-time stamp.
pub fn retained(records: &[DecisionRecord], record: &DecisionRecord) -> bool {
    records.iter().any(|saved| saved.same_record(record))
}

/// Take the write-time stamps of the rendered journal onto the records a
/// validator rebuilt, so the comparison that follows is over everything else.
/// Nothing else is copied: a length or content difference still fails it.
pub fn adopt_stamps(expected: &mut [DecisionRecord], rendered: &[u8]) -> Result<()> {
    for (record, observed) in expected.iter_mut().zip(parse_lines::<DecisionRecord>(rendered)?) {
        record.at = observed.at;
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: u32,
    pub generation: u64,
    pub items_digest: String,
    pub decisions_digest: String,
    pub data: Value,
    pub operations: BTreeMap<String, String>,
    pub integrity: String,
    /// Records restored from the decisions log at parse (GH-262); never
    /// written, so the integrity is the file's.
    #[serde(skip)]
    pub repaired: Vec<String>,
}

pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

impl Snapshot {
    pub fn new(generation: u64, items: &[u8], decisions: &[u8], data: Value) -> Result<Self> {
        let mut snapshot = Self {
            version: VERSION,
            generation,
            items_digest: digest(items),
            decisions_digest: digest(decisions),
            data,
            operations: BTreeMap::new(),
            integrity: String::new(),
            repaired: Vec::new(),
        };
        snapshot.integrity = snapshot.content_digest()?;
        Ok(snapshot)
    }

    pub fn with_operations(mut self, operations: BTreeMap<String, String>) -> Result<Self> {
        self.operations = operations;
        self.integrity = self.content_digest()?;
        Ok(self)
    }

    /// The snapshot a write installs, with its rendered bytes, from one walk:
    /// the content is serialized once with an empty integrity, digested, and
    /// the digest is written into that same rendering. `integrity` is the
    /// last field, so the rendering ends with it (GH-261).
    pub fn sealed(generation: u64, items: &[u8], decisions: &[u8], data: Value, operations: BTreeMap<String, String>) -> Result<(Self, Vec<u8>)> {
        let mut snapshot = Self {
            version: VERSION,
            generation,
            items_digest: digest(items),
            decisions_digest: digest(decisions),
            data,
            operations,
            integrity: String::new(),
            repaired: Vec::new(),
        };
        let mut rendered = snapshot.render()?;
        const TAIL: &[u8] = b",\"integrity\":\"\"}";
        if !rendered.ends_with(TAIL) {
            return Err(Error::Invalid("snapshot rendering does not end with its integrity".into()));
        }
        snapshot.integrity = digest(&rendered);
        rendered.truncate(rendered.len() - 2);
        rendered.extend_from_slice(snapshot.integrity.as_bytes());
        rendered.extend_from_slice(b"\"}");
        Ok((snapshot, rendered))
    }

    fn content_digest(&self) -> Result<String> {
        #[cfg(test)]
        SNAPSHOT_SERIALIZATIONS.with(|count| count.set(count.get() + 1));
        let mut content = self.clone();
        content.integrity.clear();
        Ok(digest(&serde_json::to_vec(&content)?))
    }

    pub fn validate(&self, items: &[u8], decisions: &[u8]) -> Result<()> {
        if self.version != VERSION
            || self.items_digest != digest(items)
            || self.decisions_digest != digest(decisions)
            || self.integrity != self.content_digest()?
        {
            return Err(Error::Conflict(
                "snapshot integrity or version mismatch".into(),
            ));
        }
        Ok(())
    }

    pub fn parse(bytes: &[u8], items: &[u8], decisions: &[u8]) -> Result<Self> {
        let mut snapshot: Self = serde_json::from_slice(bytes)?;
        snapshot.validate(items, decisions)?;
        snapshot.repaired = crate::execution::history::reconcile(&mut snapshot.data, decisions)?;
        Ok(snapshot)
    }

    pub fn render(&self) -> Result<Vec<u8>> {
        #[cfg(test)]
        SNAPSHOT_SERIALIZATIONS.with(|count| count.set(count.get() + 1));
        Ok(serde_json::to_vec(self)?)
    }
}

// Test-only count of whole-snapshot serializations on this thread, so a test
// can pin how many times a write walks the snapshot (GH-261).
#[cfg(test)]
thread_local! {
    pub static SNAPSHOT_SERIALIZATIONS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

pub fn parse_lines<T: DeserializeOwned>(bytes: &[u8]) -> Result<Vec<T>> {
    if !bytes.is_empty() && !bytes.ends_with(b"\n") {
        return Err(Error::Invalid("unterminated JSONL record".into()));
    }
    if bytes.is_empty() {
        return Ok(Vec::new());
    }
    bytes[..bytes.len() - 1]
        .split(|byte| *byte == b'\n')
        .map(|line| serde_json::from_slice(line).map_err(Error::from))
        .collect()
}

pub fn render_lines<T: Serialize>(records: &[T]) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    for record in records {
        serde_json::to_writer(&mut bytes, record)?;
        bytes.push(b'\n');
    }
    Ok(bytes)
}

pub fn validate_items(records: &[ItemRecord]) -> Result<()> {
    let mut latest: BTreeMap<&str, &ItemRecord> = BTreeMap::new();
    for record in records {
        let previous = latest.get(record.id.as_str());
        validate_revision(
            record.version,
            &record.id,
            record.revision,
            previous.map(|r| r.revision),
        )?;
        if previous.is_some_and(|old| {
            old.origin != record.origin
                || old.text != record.text
                || old.kind != record.kind
                || old.phase != record.phase
        }) {
            return Err(Error::Invalid("revision changed capture identity".into()));
        }
        latest.insert(&record.id, record);
    }
    Ok(())
}

pub fn validate_decisions(records: &[DecisionRecord]) -> Result<()> {
    let mut revisions = BTreeMap::new();
    let mut immutable = std::collections::BTreeSet::new();
    let mut scopes = BTreeMap::new();
    let mut generation = 0;
    for record in records {
        if immutable.contains(&record.id) {
            return Err(Error::Invalid(
                "immutable boundary identity repeated".into(),
            ));
        }
        if let Decision::BoundaryV1(value) = &record.decision {
            value
                .boundary
                .validate(value.terminal)
                .map_err(|error| Error::Invalid(error.to_string()))?;
            if record.revision != 1
                || revisions.contains_key(&record.id)
                || record.id
                    != value
                        .boundary
                        .identity()
                        .map_err(|error| Error::Invalid(error.to_string()))?
                || value.store_generation == 0
                || value.store_generation <= generation
                || record.origin
                    != (Origin {
                        source: "execution-boundary-v1".into(),
                        original: Evidence::Missing,
                    })
            {
                return Err(Error::Invalid("invalid immutable boundary record".into()));
            }
            let (count, terminal) = scopes.entry(&value.boundary.scope).or_insert((0, false));
            if !value.boundary.is_native_refusal()
                && (*terminal || (value.terminal && *count != 256) || (!value.terminal && *count >= 256))
            {
                return Err(Error::Invalid("invalid boundary budget history".into()));
            }
            if value.terminal {
                *terminal = true;
            } else if !value.boundary.is_native_refusal() {
                *count += 1;
            }
            generation = value.store_generation;
            immutable.insert(&record.id);
        }
        validate_revision(
            record.version,
            &record.id,
            record.revision,
            revisions.get(&record.id).copied(),
        )?;
        if let Decision::Boundary {
            phase,
            tool,
            operation,
            request_digest,
            outcome,
            subject_id,
            prompt_digest,
            response_digest,
            terminal,
            ..
        } = &record.decision
            && (*phase == 0
                || tool.trim().is_empty()
                || operation.trim().is_empty()
                || outcome.trim().is_empty()
                || !is_digest(request_digest)
                || !is_digest(response_digest)
                || subject_id
                    .as_ref()
                    .is_some_and(|value| value.trim().is_empty())
                || prompt_digest.as_ref().is_some_and(|value| !is_digest(value))
                || *terminal != (outcome == "log-bound"))
        {
            return Err(Error::Invalid("invalid boundary decision".into()));
        }
        revisions.insert(&record.id, record.revision);
    }
    Ok(())
}

fn is_digest(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_revision(version: u32, id: &str, revision: u64, previous: Option<u64>) -> Result<()> {
    if version != VERSION
        || id.trim().is_empty()
        || previous.unwrap_or(0).checked_add(1) != Some(revision)
    {
        return Err(Error::Invalid(
            "unsupported version, empty identity, or inconsistent revision".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item() -> ItemRecord {
        ItemRecord {
            version: VERSION,
            id: "capture-1".into(),
            revision: 1,
            origin: Origin {
                source: "capture".into(),
                original: Evidence::Missing,
            },
            text: "first".into(),
            kind: "todo".into(),
            phase: None,
            disposition: Disposition::Captured,
            completed: false,
            filing_uncertain: false,
        }
    }

    #[test]
    fn records_and_snapshot_round_trip() {
        let items = vec![item()];
        let bytes = render_lines(&items).unwrap();
        let parsed: Vec<ItemRecord> = parse_lines(&bytes).unwrap();
        validate_items(&parsed).unwrap();
        assert_eq!(parsed, items);
        let decisions = vec![DecisionRecord {
            version: VERSION,
            id: "gate-1".into(),
            revision: 1,
            origin: item().origin,
            decision: Decision::Gate {
                outcome: "pass".into(),
                evidence: Evidence::Null,
            },
            at: Some(1_700_000_000),
        }];
        let decision_bytes = render_lines(&decisions).unwrap();
        let parsed: Vec<DecisionRecord> = parse_lines(&decision_bytes).unwrap();
        validate_decisions(&parsed).unwrap();
        assert_eq!(parsed, decisions);
        let snapshot =
            Snapshot::new(1, &bytes, &decision_bytes, serde_json::json!({"phase":3})).unwrap();
        assert_eq!(
            Snapshot::parse(&snapshot.render().unwrap(), &bytes, &decision_bytes).unwrap(),
            snapshot
        );
    }

    // GH-261: the sealed rendering is byte for byte what new, with_operations
    // and render produce, and it parses back with its integrity intact.
    #[test]
    fn sealed_snapshot_matches_the_three_step_rendering() {
        let mut operations = BTreeMap::new();
        operations.insert("op".to_owned(), "f".repeat(64));
        let data = serde_json::json!({"phase": {"integrity": ""}, "text": "\"integrity\":\"\"}"});
        let (sealed, rendered) = Snapshot::sealed(7, b"items\n", b"decisions\n", data.clone(), operations.clone()).unwrap();
        let stepped = Snapshot::new(7, b"items\n", b"decisions\n", data).unwrap().with_operations(operations).unwrap();
        assert_eq!(sealed, stepped);
        assert_eq!(rendered, stepped.render().unwrap());
        assert_eq!(Snapshot::parse(&rendered, b"items\n", b"decisions\n").unwrap(), sealed);
    }

    #[test]
    fn validate_items_refuses_an_unsupported_version_or_a_skipped_revision() {
        let mut bad = item();
        bad.version = 99;
        assert!(validate_items(&[bad]).is_err());
        let mut skipped = item();
        skipped.revision = 3;
        assert!(validate_items(&[item(), skipped]).is_err());
    }

    #[test]
    fn parse_lines_refuses_an_empty_record_line() {
        assert!(parse_lines::<ItemRecord>(b"{}\n\n").is_err());
    }

    #[test]
    fn snapshot_validate_refuses_edited_data_a_wrong_version_or_mismatched_items() {
        let mut snapshot = Snapshot::new(0, b"", b"", Value::Null).unwrap();
        snapshot.data = serde_json::json!("edited");
        assert!(snapshot.validate(b"", b"").is_err());
        let mut snapshot = Snapshot::new(0, b"", b"", Value::Null).unwrap();
        snapshot.version = 99;
        assert!(snapshot.validate(b"", b"").is_err());
        let snapshot = Snapshot::new(0, b"", b"", Value::Null).unwrap();
        assert!(snapshot.validate(b"edited", b"").is_err());
    }

    #[test]
    fn evidence_keeps_absence_null_and_unknown_text_distinct() {
        let absent: Origin = serde_json::from_str(r#"{"source":"legacy"}"#).unwrap();
        assert_eq!(absent.original, Evidence::Missing);
        for original in [
            Evidence::Missing,
            Evidence::Null,
            Evidence::Text("  unfamiliar host text  ".into()),
        ] {
            let origin = Origin {
                source: "legacy".into(),
                original,
            };
            assert_eq!(
                serde_json::from_slice::<Origin>(&serde_json::to_vec(&origin).unwrap()).unwrap(),
                origin
            );
        }
        assert_ne!(Evidence::Missing, Evidence::Null);
    }
}
