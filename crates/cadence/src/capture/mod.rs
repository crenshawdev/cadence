//! The owner's capture (D-144): one typed item with its kind and its phase,
//! never a bullet of prose a later reader has to parse back out.
pub mod instructions;

use crate::store::model::{self, Disposition, Evidence, ItemRecord, Origin, VERSION};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub const RULE: &str = "capture";
/// Every captured item names this origin, so the journal says where it came
/// from without reading the text.
pub const SOURCE: &str = "capture";

/// The three kinds a capture may take. A todo is work the owner owes a phase;
/// a seed and a note belong to no phase at all.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Todo,
    Seed,
    Note,
}

impl Kind {
    pub fn word(self) -> &'static str {
        match self {
            Self::Todo => "todo",
            Self::Seed => "seed",
            Self::Note => "note",
        }
    }

    /// Only a todo is about a phase.
    pub fn takes_phase(self) -> bool {
        matches!(self, Self::Todo)
    }

    pub fn words() -> [&'static str; 3] {
        [Self::Todo.word(), Self::Seed.word(), Self::Note.word()]
    }
}

/// Why the text cannot be captured, or nothing. A newline and a tab are
/// ordinary prose; every other control byte is a caller's accident.
pub fn text_refusal(text: &str) -> Option<&'static str> {
    if text.trim().is_empty() {
        return Some("capture text is blank");
    }
    text.chars()
        .any(|c| c.is_control() && c != '\n' && c != '\t')
        .then_some("capture text carries a control byte")
}

/// The item's identity, digested from the request that asked for it, so the
/// same request twice is the same item and two different requests never are.
pub fn id(request_id: &str, kind: Kind, text: &str, phase: Option<u32>) -> String {
    let mut out = Vec::new();
    let mut field = |bytes: &[u8]| {
        out.extend((bytes.len() as u64).to_be_bytes());
        out.extend(bytes);
    };
    field(b"capture-item-1");
    field(request_id.as_bytes());
    field(kind.word().as_bytes());
    field(text.as_bytes());
    field(phase.map_or(String::new(), |phase| phase.to_string()).as_bytes());
    model::digest(&out)
}

/// The record one accepted capture becomes. The caller supplies the kind, the
/// text and the phase; the binary supplies everything else.
pub fn record(request_id: &str, kind: Kind, text: &str, phase: Option<u32>) -> ItemRecord {
    ItemRecord {
        version: VERSION,
        id: id(request_id, kind, text, phase),
        revision: 1,
        origin: Origin {
            source: SOURCE.into(),
            original: Evidence::Missing,
        },
        text: text.into(),
        kind: kind.word().into(),
        phase,
        disposition: Disposition::Captured,
        completed: false,
        filing_uncertain: false,
    }
}
