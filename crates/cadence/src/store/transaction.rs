use crate::process::Process;
use super::model::{self, DECISIONS, DecisionRecord, ITEMS, ItemRecord, STATE, Snapshot, VERSION};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use cadence::envelope::Envelope;
use cadence::execution::boundary::{BoundaryScope, Receipt, Success};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

pub const INTENT: &str = ".store-intent.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "operation", rename_all = "kebab-case", deny_unknown_fields)]
pub(crate) enum IntentKind {
    DebugReviewV1 { root_binding: String },
    DebugV1 { write: Box<crate::debug::model::Write> },
    SpikeV1 { write: Box<crate::spike::model::Write> },
    TaskV1 { write: Box<crate::task::model::Write>, root_binding: String },
    MilestoneReleaseV1 { write: Box<crate::milestone::release::WriteSeal> },
    UndoV1 { write: Box<crate::undo::model::Write> },
    MilestonePruneV1 {
        prune: Box<crate::milestone::prune::Prune>,
    },
    VerificationSubmitV1 {
        claim: Box<cadence::verification::verdicts::Claim>,
        root_binding: String,
    },
    VerificationWaiverV1 {
        claim: Box<cadence::verification::waivers::Claim>,
        root_binding: String,
    },
    VerificationHumanV1 {
        claim: Box<cadence::verification::human::Claim>,
        root_binding: String,
    },
    VerificationCompleteV1 {
        claim: Box<cadence::verification::completion::Claim>,
        root_binding: String,
    },
    VerificationRunV1 {
        record: Box<cadence::verification::runner::Record>,
        root_binding: String,
    },
    VerificationV1 {
        request: Box<cadence::verification::persistence::Request>,
        root_binding: String,
    },
    /// The owner's explicit adoption of one ticked phase (D-137): the one
    /// write outside the import that may touch the adoption namespace.
    AdoptionDeclareV1 {
        record: Box<cadence::adoption::Record>,
        request_id: String,
        root_binding: String,
    },
    NativeTaskV1 {
        request: Box<cadence::execution::history::Request>,
        root_binding: String,
    },
    NativePlanV1 {
        request: Box<cadence::execution::history::PlanRequest>,
        root_binding: String,
    },
    NativeExecutionDispatchV1 {
        phase: u32,
        decision_id: String,
        inventory: Observed,
    },
    NativeExecutionReissueV1 {
        phase: u32,
        decision_id: String,
        issue_dispatch_id: String,
    },
    NativeAdmissionV1 {
        request: Box<cadence::execution::admission::Request>,
        root_binding: String,
        inventory: Observed,
    },
    PlanPublication {
        phase: u32,
        inventory: Box<cadence::plan::inventory::Inventory>,
        /// The trace rows this publication seeds; absent for older intents
        /// and for publications that seed nothing (D-131).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        requirements: Option<Vec<String>>,
    },
    ContextPublication {
        phase: u32,
    },
    ExecutionFinalizeRiskV1 {
        phase: u32,
        decision_id: String,
        requirements: Vec<cadence::rail::receipts::Requirement>,
    },
    RailReceipt {
        record: Box<cadence::rail::receipts::RecordedFact>,
    },
    RailObservation {
        record: Box<cadence::rail::risk::Recorded>,
    },
    GuardAudit {
        audit: super::writer::audit::Audit,
    },
    /// GH-262: task and plan events the parse restored from the decisions
    /// log, by id. The only change is each named snapshot copy replaced by
    /// the log's text for it, and the operation that records the repair.
    SnapshotRepairV1 {
        repaired: Vec<String>,
    },
    Store,
    BoundaryObservationV1 {
        scope: BoundaryScope,
        decision_id: String,
    },
    ExecutionDispatchV1 {
        phase: u32,
        decision_id: String,
    },
    ExecutionPatchV1 {
        phase: u32,
        decision_id: String,
        render_version: u32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        risk_basis: Option<Box<cadence::rail::risk::ExecutionBasis>>,
    },
    ExecutionDispatch {
        phase: u32,
    },
    ExecutionPatch {
        phase: u32,
        render_version: u32,
        summary: bool,
    },
    ExecutionRefusal {
        phase: u32,
    },
}

impl IntentKind {
    fn validate_provenance(&self, previous: &Value, proposed: &Value) -> Result<()> {
        preserve_provenance(previous, proposed)
    }

    /// The versioned intents that alone may change the verification namespace.
    fn verification(&self) -> bool {
        matches!(self, IntentKind::VerificationV1 { .. } | IntentKind::VerificationRunV1 { .. }
            | IntentKind::VerificationSubmitV1 { .. } | IntentKind::VerificationWaiverV1 { .. }
            | IntentKind::VerificationHumanV1 { .. } | IntentKind::VerificationCompleteV1 { .. })
    }
}

// Test-only counts of intent digests and snapshot parses on this thread, so a
// test can pin the work a commit does (GH-261) without counting other tests.
#[cfg(test)]
thread_local! {
    pub static INTENT_DIGESTS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
    pub static PREVIOUS_PARSES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
    pub static NEW_STATE_PARSES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

/// The snapshot a transaction starts from, parsed from the state
/// participant's expected bytes.
fn parse_previous(bytes: &[u8]) -> Result<Snapshot> {
    #[cfg(test)]
    PREVIOUS_PARSES.with(|count| count.set(count.get() + 1));
    Ok(serde_json::from_slice(bytes)?)
}

/// The operation a snapshot repair records under, by the generation it made.
pub(crate) fn snapshot_repair_operation(generation: u64) -> String {
    format!("snapshot-repair:{generation}")
}

fn previous_snapshot(participants: &[Participant], what: &str) -> Result<Snapshot> {
    let state = participants.last().ok_or_else(|| Error::Invalid("snapshot absent".into()))?;
    Ok(serde_json::from_slice(state.expected.bytes.as_deref()
        .ok_or_else(|| Error::Invalid(format!("{what} requires prior snapshot")))?)?)
}

/// Every claim intent installs exactly the transition its claim module
/// derives from the previous snapshot: one appended decision, unchanged items,
/// the derived snapshot, the registered operation and the next generation.
fn validate_claim_transition(participants: &[Participant], snapshot: &Snapshot, rendered: (&[u8], &[u8]),
    root_binding: &str, transaction: Transaction, decision: DecisionRecord, what: &str) -> Result<()> {
    let (items, decisions) = rendered;
    let state = participants.last().expect("state participant");
    if state.expected.directory_identity != root_binding {
        return Err(Error::Invalid(format!("{what} root binding changed")));
    }
    let previous: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
        .ok_or_else(|| Error::Invalid(format!("{what} requires prior snapshot")))?)?;
    let old_items = participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
    let old_decisions = participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref()
        .ok_or_else(|| Error::Invalid(format!("{what} requires previous decisions")))?;
    let mut expected_decisions: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
    expected_decisions.push(decision);
    model::adopt_stamps(&mut expected_decisions, decisions)?;
    let mut operations = previous.operations.clone();
    if operations.insert(transaction.id.clone(), transaction.fingerprint()?).is_some()
        || Some(&snapshot.data) != transaction.snapshot.as_ref() || old_items != Some(items)
        || decisions != model::render_lines(&expected_decisions)? || snapshot.operations != operations
        || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))? {
        return Err(Error::Invalid(format!("{what} intent differs from immutable complete transition")));
    }
    Ok(())
}

pub fn preserve_provenance(previous: &Value, proposed: &Value) -> Result<()> {
    for field in ["import", "source_evidence"] {
        if let Some(value) = previous.get(field)
            && proposed.get(field) != Some(value)
        {
            return Err(Error::Invalid(format!(
                "snapshot replacement changed provenance: {field}"
            )));
        }
    }
    if let Some(current) = previous.get("current") {
        preserve_provenance(current, proposed.get("current").unwrap_or(&Value::Null))?;
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExternalChange {
    pub target: String,
    pub expected: Observed,
    pub bytes: Vec<u8>,
}

impl ExternalChange {
    fn installed(&self, actual: &Observed, replay: bool) -> bool {
        replay
            && actual.bytes.as_ref() == Some(&self.bytes)
            && actual.directory_identity == self.expected.directory_identity
    }

    pub fn validate(&self, actual: &Observed, replay: bool) -> Result<&[u8]> {
        if actual != &self.expected && !self.installed(actual, replay) {
            return Err(Error::Conflict(format!(
                "pending participant changed: {}",
                self.target
            )));
        }
        Ok(&self.bytes)
    }

    fn validate_digest(&self, actual: &Observed, replay: bool) -> Result<&[u8]> {
        let expected = self.expected.identity.strip_prefix(DIGEST_IDENTITY)
            .map(|digest| if digest.is_empty() { None } else { Some(digest.to_owned()) })
            .unwrap_or_else(|| self.expected.bytes.as_deref().map(model::digest));
        let matches = actual.bytes.as_deref().map(model::digest) == expected
            && actual.directory_identity == self.expected.directory_identity;
        if !matches && !self.installed(actual, replay)
        {
            return Err(Error::Conflict(format!("pending participant changed: {}", self.target)));
        }
        Ok(&self.bytes)
    }

    fn validate_encoded(&self, actual: &Observed, encoding: Encoding, replay: bool) -> Result<&[u8]> {
        match encoding {
            Encoding::Digest => self.validate_digest(actual, replay),
            Encoding::Array | Encoding::Text => self.validate(actual, replay),
        }
    }
}

/// The route `phase`'s active dispatch was admitted on, in the snapshot a
/// dispatch intent would install. The final preparation rechecks its inputs
/// against the current config.
pub fn active_route(
    prospective: &super::model::Snapshot,
    phase: u32,
) -> Result<Option<cadence::execution::model::DispatchRoute>> {
    Ok(execution_snapshot(prospective)?
        .occurrences
        .get(&phase.to_string())
        .and_then(|occurrence| occurrence.active.as_ref())
        .and_then(|dispatch| dispatch.route.as_deref().cloned()))
}

/// The route an intent admits: a dispatch intent's active route, and none for
/// any other intent.
fn admission_route(
    kind: &IntentKind,
    prospective: &super::model::Snapshot,
) -> Result<Option<cadence::execution::model::DispatchRoute>> {
    match kind {
        IntentKind::ExecutionDispatchV1 { phase, .. }
        | IntentKind::NativeExecutionDispatchV1 { phase, .. } => active_route(prospective, *phase),
        _ => Ok(None),
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    /// Stable caller identity, e.g. a digest of the frozen import source set.
    pub id: String,
    pub items: Vec<ItemRecord>,
    pub decisions: Vec<DecisionRecord>,
    pub snapshot: Option<Value>,
    pub external: Vec<ExternalChange>,
}

impl Transaction {
    pub fn fingerprint(&self) -> Result<String> {
        // Preconditions describe a particular attempt, not the logical import.
        // A retry after recovery has different installed identities.
        //
        // The write-time stamp is an observation and not part of what the
        // transaction installs (D-143). A validator, a replay or a recovery
        // rebuilding this transaction from the same evidence never observes
        // the second the writer did, so the operation fingerprint is taken
        // over the records without it and every other field still counts.
        let decisions: Vec<DecisionRecord> =
            self.decisions.iter().map(DecisionRecord::unstamped).collect();
        Ok(model::digest(&serde_json::to_vec(&(
            &self.items,
            &decisions,
            &self.snapshot,
            self.external
                .iter()
                .map(|p| (&p.target, &p.bytes))
                .collect::<Vec<_>>(),
        ))?))
    }
}

pub(crate) type Participant = ExternalChange;

/// How an intent writes its participants (GH-261). `Array` is every byte as a
/// JSON integer, the only form before this field existed and the form an
/// intent without it is read in. `Text` writes UTF-8 bytes as a JSON string.
/// `Digest` also replaces each observed preimage with its SHA-256 and bound
/// directory. An intent is written back in the encoding it was read in.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum Encoding {
    #[default]
    Array,
    Text,
    Digest,
}

/// A participant's bytes on the wire, in either encoding.
#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum BytesWire {
    Array(Vec<u8>),
    Text(String),
}

impl BytesWire {
    fn encode(bytes: &[u8], encoding: Encoding) -> Self {
        match encoding {
            Encoding::Text | Encoding::Digest => match std::str::from_utf8(bytes) {
                Ok(text) => Self::Text(text.to_owned()),
                Err(_) => Self::Array(bytes.to_vec()),
            },
            Encoding::Array => Self::Array(bytes.to_vec()),
        }
    }
    fn decode(self) -> Vec<u8> {
        match self {
            Self::Array(bytes) => bytes,
            Self::Text(text) => text.into_bytes(),
        }
    }
}

// Field order matches `Observed` and `ExternalChange`, so an `Array` intent
// serializes to the bytes the older binary wrote and digested.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ObservedWire {
    bytes: Option<BytesWire>,
    identity: String,
    directory_identity: String,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct DigestWire {
    digest: Option<String>,
    directory_identity: String,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum ExpectedWire {
    Digest(DigestWire),
    Observed(ObservedWire),
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ParticipantWire {
    target: String,
    expected: ExpectedWire,
    bytes: BytesWire,
}

const DIGEST_IDENTITY: &str = "sha256:";

impl ParticipantWire {
    fn encode(participant: &Participant, encoding: Encoding) -> Self {
        let expected = if encoding == Encoding::Digest {
            let digest = participant.expected.identity.strip_prefix(DIGEST_IDENTITY)
                .map(|digest| if digest.is_empty() { None } else { Some(digest.to_owned()) })
                .unwrap_or_else(|| participant.expected.bytes.as_deref().map(model::digest));
            ExpectedWire::Digest(DigestWire {
                digest, directory_identity: participant.expected.directory_identity.clone(),
            })
        } else {
            ExpectedWire::Observed(ObservedWire {
                bytes: participant.expected.bytes.as_deref().map(|bytes| BytesWire::encode(bytes, encoding)),
                identity: participant.expected.identity.clone(),
                directory_identity: participant.expected.directory_identity.clone(),
            })
        };
        Self {
            target: participant.target.clone(),
            expected,
            bytes: BytesWire::encode(&participant.bytes, encoding),
        }
    }
    fn decode(self) -> Participant {
        let expected = match self.expected {
            ExpectedWire::Observed(expected) => Observed {
                bytes: expected.bytes.map(BytesWire::decode),
                identity: expected.identity,
                directory_identity: expected.directory_identity,
            },
            ExpectedWire::Digest(expected) => Observed {
                bytes: None,
                identity: format!("{DIGEST_IDENTITY}{}", expected.digest.unwrap_or_default()),
                directory_identity: expected.directory_identity,
            },
        };
        Participant {
            target: self.target,
            expected,
            bytes: self.bytes.decode(),
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct IntentWire {
    version: u32,
    kind: IntentKind,
    participants: Vec<ParticipantWire>,
    integrity: String,
    #[serde(default, skip_serializing_if = "is_array")]
    encoding: Encoding,
}

fn is_array(encoding: &Encoding) -> bool {
    *encoding == Encoding::Array
}

/// A participant's bytes read from an intent as JSON, in either encoding.
pub fn intent_bytes(value: &Value) -> Result<Vec<u8>> {
    Ok(serde_json::from_value::<BytesWire>(value.clone())?.decode())
}

/// The same for a field that may be `null`, such as `expected.bytes`.
pub fn intent_bytes_option(value: &Value) -> Result<Option<Vec<u8>>> {
    Ok(serde_json::from_value::<Option<BytesWire>>(value.clone())?.map(BytesWire::decode))
}

/// Bytes written back into an intent read as JSON, in that intent's encoding,
/// so the intent's own digest still covers them.
pub fn encode_intent_bytes(intent: &Value, bytes: &[u8]) -> Result<Value> {
    let encoding: Encoding = match intent.get("encoding") {
        Some(value) => serde_json::from_value(value.clone())?,
        None => Encoding::Array,
    };
    Ok(serde_json::to_value(BytesWire::encode(bytes, encoding))?)
}

struct Intent {
    version: u32,
    kind: IntentKind,
    participants: Vec<Participant>,
    integrity: String,
    encoding: Encoding,
}

impl Serialize for Intent {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        IntentWire {
            version: self.version,
            kind: self.kind.clone(),
            participants: self.wire_participants(),
            integrity: self.integrity.clone(),
            encoding: self.encoding,
        }
        .serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for Intent {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        let wire = IntentWire::deserialize(deserializer)?;
        Ok(Self {
            version: wire.version,
            kind: wire.kind,
            participants: wire.participants.into_iter().map(ParticipantWire::decode).collect(),
            integrity: wire.integrity,
            encoding: wire.encoding,
        })
    }
}

impl Intent {
    fn validate_native_summary(&self, previous: &Snapshot, snapshot: &Snapshot, phase: u32) -> Result<()> {
        use cadence::execution::render::{NATIVE_SUMMARIES, render_native_phase_summary};
        let name = phase.to_string();
        let changed = previous.data[NATIVE_SUMMARIES]["phases"][&name] != snapshot.data[NATIVE_SUMMARIES]["phases"][&name];
        if self.participants.len() != 3 + usize::from(changed) {
            return Err(Error::Invalid("native event changes only its phase summary participant".into()));
        }
        if changed {
            let participant = self.participants.iter().find(|p| p.target == format!("phase-summary:{phase}"))
                .ok_or_else(|| Error::Invalid("native event lacks its phase summary".into()))?;
            let rendered = render_native_phase_summary(
                &cadence::execution::history::records(&snapshot.data, phase)?,
                &cadence::execution::history::plan_records(&snapshot.data, phase)?,
                &cadence::execution::admission::records(&snapshot.data, phase)?, phase)?;
            if participant.bytes != rendered || snapshot.data[NATIVE_SUMMARIES]["phases"][&name].as_str().map(str::as_bytes) != Some(rendered.as_slice()) {
                return Err(Error::Invalid("native phase summary differs from prospective record".into()));
            }
        }
        Ok(())
    }

    fn unfiltered(kind: IntentKind, participants: Vec<Participant>) -> Self {
        Self { version: VERSION, kind, participants, integrity: String::new(), encoding: Encoding::Digest }
    }

    #[cfg(test)]
    fn new(kind: IntentKind, participants: Vec<Participant>) -> Self {
        let mut intent = Self::unfiltered(kind, participants);
        intent.encoding = Encoding::Text;
        if intent.participants.iter().filter(|participant|
            participant.expected.bytes.as_ref() != Some(&participant.bytes)).count() == 1
        {
            intent.omit_unchanged();
        }
        intent
    }

    fn omit_unchanged(&mut self) {
        self.participants.retain(|participant|
            participant.expected.bytes.as_ref() != Some(&participant.bytes));
    }

    fn wire_participants(&self) -> Vec<ParticipantWire> {
        self.participants.iter().map(|p| ParticipantWire::encode(p, self.encoding)).collect()
    }

    fn digest(&self) -> Result<String> {
        #[cfg(test)]
        INTENT_DIGESTS.with(|count| count.set(count.get() + 1));
        Ok(model::digest(&serde_json::to_vec(&(
            self.version,
            &self.kind,
            self.wire_participants(),
        ))?))
    }

    /// An intent read back from the journal: its integrity first, then what
    /// it means.
    fn validate_integrity(&self) -> Result<()> {
        if self.version != VERSION || self.integrity != self.digest()? {
            return Err(Error::Conflict("invalid operation intent integrity".into()));
        }
        Ok(())
    }

    fn parse_contents(&self) -> Result<Snapshot> {
        let bytes = |name| {
            self.participants
                .iter()
                .find(|p| p.target == name)
                .map(|p| p.bytes.as_slice())
                .ok_or_else(|| Error::Invalid("intent lacks semantic target".into()))
        };
        let items = bytes(ITEMS)?;
        let decisions = bytes(DECISIONS)?;
        #[cfg(test)]
        NEW_STATE_PARSES.with(|count| count.set(count.get() + 1));
        Snapshot::parse(bytes(STATE)?, items, decisions)
    }

    fn validate_contents(&self, process: &mut dyn Process) -> Result<Snapshot> {
        let snapshot = self.parse_contents()?;
        self.validate_sealed(&snapshot, process)?;
        Ok(snapshot)
    }

    /// What the intent means, for an intent this process has just sealed and
    /// so need not digest a second time.
    fn validate_sealed(&self, snapshot: &Snapshot, process: &mut dyn Process) -> Result<()> {
        let mut names = BTreeSet::new();
        let mut summary_phase = None;
        let mut context_phase = None;
        let mut plan_targets = Vec::new();
        let mut uat_phase = None;
        let mut projections: Vec<&str> = Vec::new();
        let mut debug_targets = Vec::new();
        let mut spike_targets = Vec::new();
        let mut task_targets = Vec::new();
        for participant in &self.participants {
            let known = matches!(
                participant.target.as_str(),
                ITEMS | DECISIONS | STATE | "repo-config" | "global-config"
            );
            let phase = super::filesystem::phase_summary_target(&participant.target)?;
            let context = super::filesystem::phase_context_target(&participant.target)?;
            let plan = super::filesystem::phase_plan_target(&participant.target)?;
            let uat = super::filesystem::phase_uat_target(&participant.target)?;
            let projection = super::filesystem::projection_target(&participant.target);
            let debug = super::filesystem::debug_target(&participant.target)?;
            if let Some(slug) = debug { debug_targets.push(slug); }
            let spike = super::filesystem::spike_target(&participant.target)?;
            if let Some(slug) = spike { spike_targets.push(slug); }
            let task = super::filesystem::task_target(&participant.target)?;
            if let Some(slug) = task { task_targets.push(slug); }
            let task_plan = super::filesystem::task_plan_target(&participant.target)?;
            if let Some(slug) = task_plan { task_targets.push(slug); }
            if projection.is_some() {
                projections.push(participant.target.as_str());
            }
            if let Some(identity) = plan {
                plan_targets.push(identity);
            }
            if let Some(context) = context
                && context_phase.replace(context).is_some()
            {
                return Err(Error::Invalid("duplicate context participant".into()));
            }
            if let Some(uat) = uat
                && uat_phase.replace(uat).is_some()
            {
                return Err(Error::Invalid("duplicate UAT participant".into()));
            }
            if (!known && phase.is_none() && context.is_none() && plan.is_none() && uat.is_none() && projection.is_none() && debug.is_none() && spike.is_none() && task.is_none() && task_plan.is_none())
                || !names.insert(participant.target.as_str())
            {
                return Err(Error::Invalid(
                    "invalid or duplicate intent participant".into(),
                ));
            }
            if let Some(phase) = phase
                && summary_phase.replace(phase).is_some()
            {
                return Err(Error::Invalid(
                    "invalid or duplicate intent participant".into(),
                ));
            }
        }
        if !debug_targets.is_empty() && !matches!(self.kind, IntentKind::DebugV1 { .. } | IntentKind::DebugReviewV1 { .. }) {
            return Err(Error::Invalid("debug projection requires its owning intent".into()));
        }
        if !spike_targets.is_empty() && !matches!(self.kind, IntentKind::SpikeV1 { .. }) {
            return Err(Error::Invalid("spike projection requires its owning intent".into()));
        }
        if !task_targets.is_empty() && !matches!(self.kind, IntentKind::TaskV1 { .. }) {
            return Err(Error::Invalid("task projection requires its owning intent".into()));
        }
        match &self.kind {
            IntentKind::PlanPublication { phase, requirements, .. }
                if *phase > 0
                    && !plan_targets.is_empty()
                    && plan_targets.iter().all(|(p, _)| p == phase)
                    && context_phase.is_none()
                    && summary_phase.is_none()
                    && uat_phase.is_none()
                    && projections == if requirements.is_some() { vec!["requirements"] } else { vec![] }
                    && !names.contains("repo-config")
                    && !names.contains("global-config") => {}
            IntentKind::PlanPublication { .. } => {
                return Err(Error::Invalid(
                    "invalid plan publication participants".into(),
                ));
            }
            _ if !plan_targets.is_empty() => {
                return Err(Error::Invalid("PLAN needs its publication intent".into()));
            }
            IntentKind::VerificationCompleteV1 { claim, .. }
                if projections == cadence::verification::completion::installed(claim)?.iter().map(|(t, _)| t.as_str()).collect::<Vec<_>>()
                    && context_phase.is_none()
                    && summary_phase.is_none()
                    && uat_phase.is_none()
                    && !names.contains("repo-config")
                    && !names.contains("global-config") => {}
            IntentKind::VerificationCompleteV1 { .. } => {
                return Err(Error::Invalid("invalid completion participants".into()));
            }
            _ if !projections.is_empty() => {
                return Err(Error::Invalid("projection participant needs its owning intent".into()));
            }
            IntentKind::ContextPublication { phase }
                if *phase > 0
                    && context_phase == Some(*phase)
                    && summary_phase.is_none()
                    && !names.contains("repo-config")
                    && !names.contains("global-config") => {}
            IntentKind::ContextPublication { .. } => {
                return Err(Error::Invalid("invalid context intent participants".into()));
            }
            _ if context_phase.is_some() => {
                return Err(Error::Invalid(
                    "context requires its approved publication intent".into(),
                ));
            }
            IntentKind::VerificationHumanV1 { claim, .. }
                if uat_phase == Some(claim.request.submission.phase)
                    && summary_phase.is_none()
                    && !names.contains("repo-config")
                    && !names.contains("global-config") => {}
            IntentKind::VerificationHumanV1 { .. } => {
                return Err(Error::Invalid("invalid human result participants".into()));
            }
            _ if uat_phase.is_some() => {
                return Err(Error::Invalid("UAT.md needs its human result intent".into()));
            }
            _ => {}
        }
        if self.participants.last().map(|value| value.target.as_str()) != Some(STATE) {
            return Err(Error::Invalid(
                "snapshot must be the final intent participant".into(),
            ));
        }
        match self.kind.clone() {
            IntentKind::Store if summary_phase.is_some() => {
                return Err(Error::Invalid(
                    "store intent cannot render a phase summary".into(),
                ));
            }
            IntentKind::ExecutionDispatch { phase } | IntentKind::ExecutionRefusal { phase }
                if phase == 0 || summary_phase.is_some() =>
            {
                return Err(Error::Invalid(
                    "invalid execution intent participants".into(),
                ));
            }
            IntentKind::ExecutionPatch {
                phase,
                render_version,
                summary,
            } if phase == 0
                || render_version != cadence::execution::render::SUMMARY_RENDER_VERSION
                || summary != summary_phase.is_some()
                || summary_phase.is_some_and(|summary_phase| summary_phase != phase) =>
            {
                return Err(Error::Invalid("invalid execution render intent".into()));
            }
            _ => {}
        }
        let bytes = |name| {
            self.participants
                .iter()
                .find(|p| p.target == name)
                .map(|p| p.bytes.as_slice())
                .ok_or_else(|| Error::Invalid("intent lacks semantic target".into()))
        };
        let items = bytes(ITEMS)?;
        let decisions = bytes(DECISIONS)?;
        model::validate_items(&model::parse_lines(items)?)?;
        model::validate_decisions(&model::parse_lines(decisions)?)?;
        snapshot.validate(items, decisions)?;
        let verification_intent = self.kind.verification();
        if !verification_intent {
            let previous_decisions = self.participants.iter().find(|p| p.target == DECISIONS)
                .and_then(|p| p.expected.bytes.as_deref()).unwrap_or_default();
            let reserved = |bytes: &[u8]| -> Result<Vec<DecisionRecord>> {
                Ok(model::parse_lines::<DecisionRecord>(bytes)?.into_iter()
                    .filter(|r| r.origin.source.starts_with("verification-")).collect())
            };
            if reserved(previous_decisions)? != reserved(decisions)? {
                return Err(Error::Invalid("verification journal changes require their versioned intent".into()));
            }
            if self.participants.last().is_none_or(|p| p.expected.bytes.is_none())
                && snapshot.data.get(cadence::verification::persistence::NAMESPACE).is_some() {
                return Err(Error::Invalid("verification authority cannot be imported or seeded".into()));
            }
        }
        // A completion declared at import is written by the transaction that
        // completes the import, a completion declared at adoption by its own
        // intent, and by nothing else: the binary computed both from the
        // documents, and no other write may add, drop or edit one.
        let before = self.participants.last().and_then(|p| p.expected.bytes.as_deref())
            .map(parse_previous).transpose()?;
        if !matches!(self.kind, IntentKind::DebugV1 { .. } | IntentKind::DebugReviewV1 { .. })
            && before.as_ref().and_then(|p| p.data.get("debug")) != snapshot.data.get("debug") {
            return Err(Error::Invalid("debug namespace requires its owning intent".into()));
        }
        if !matches!(self.kind, IntentKind::SpikeV1 { .. })
            && before.as_ref().and_then(|p| p.data.get("spike")) != snapshot.data.get("spike") {
            return Err(Error::Invalid("spike namespace requires its owning intent".into()));
        }
        if !matches!(self.kind, IntentKind::TaskV1 { .. })
            && before.as_ref().and_then(|p| p.data.get(crate::task::model::NAMESPACE)) != snapshot.data.get(crate::task::model::NAMESPACE) {
            return Err(Error::Invalid("task namespace requires its owning intent".into()));
        }
        let completes_import = before.as_ref().is_none_or(|p| p.data.get("import").is_none())
            && snapshot.data.get("import").is_some();
        if !completes_import
            && !matches!(self.kind, IntentKind::AdoptionDeclareV1 { .. })
            && before.as_ref().and_then(|p| p.data.get(cadence::adoption::NAMESPACE))
                != snapshot.data.get(cadence::adoption::NAMESPACE) {
            return Err(Error::Invalid("declared completions are written only by the import".into()));
        }
        if let IntentKind::ExecutionPatch {phase,..}|IntentKind::ExecutionPatchV1 {phase,..}=&self.kind {
            cadence::plan::persistence::require_legacy_execution(&snapshot.data,*phase)?;
        }
        if let Some(previous) = before {
            if !matches!(self.kind, IntentKind::UndoV1 { .. }) {
                let markers = |data: &Value| -> std::collections::BTreeMap<String, Value> {
                    data["execution"]["occurrences"].as_object().into_iter().flatten()
                        .filter_map(|(key, value)| value.get("undone").filter(|v| !v.is_null()).map(|v| (key.clone(), v.clone()))).collect()
                };
                if previous.data.get("undos") != snapshot.data.get("undos") || markers(&previous.data) != markers(&snapshot.data) {
                    return Err(Error::Invalid("undo receipts and execution markers require their owning intent".into()));
                }
            }
            if !matches!(self.kind, IntentKind::NativeTaskV1 { .. } | IntentKind::NativePlanV1 { .. })
                && previous.data.get(cadence::execution::render::NATIVE_SUMMARIES) != snapshot.data.get(cadence::execution::render::NATIVE_SUMMARIES) {
                return Err(Error::Invalid("native summary changes require their owning intent".into()));
            }
            self.kind
                .validate_provenance(&previous.data, &snapshot.data)?;
            if !verification_intent
                && previous.data.get(cadence::verification::persistence::NAMESPACE) != snapshot.data.get(cadence::verification::persistence::NAMESPACE) {
                return Err(Error::Invalid("verification changes require their versioned intent".into()));
            }
            if !matches!(self.kind, IntentKind::NativeTaskV1 { .. } | IntentKind::SnapshotRepairV1 { .. })
                && previous.data.get(cadence::execution::history::NAMESPACE) != snapshot.data.get(cadence::execution::history::NAMESPACE)
            {
                return Err(Error::Invalid("native task changes require their versioned intent".into()));
            }
            if !matches!(self.kind,IntentKind::NativeAdmissionV1 {..})
                && previous.data.get(cadence::execution::admission::NAMESPACE)!=snapshot.data.get(cadence::execution::admission::NAMESPACE)
            {
                return Err(Error::Invalid("native admission changes require their versioned intent".into()));
            }
            if !matches!(self.kind, IntentKind::NativePlanV1 { .. } | IntentKind::SnapshotRepairV1 { .. })
                && previous.data.get(cadence::execution::history::PLAN_NAMESPACE) != snapshot.data.get(cadence::execution::history::PLAN_NAMESPACE)
            {
                return Err(Error::Invalid("native plan changes require their versioned intent".into()));
            }
        }
        match self.kind.clone() {
            IntentKind::UndoV1 { write } => {
                if names.len() != 3 { return Err(Error::Invalid("undo has only its sealed Git/projection participant and store record".into())); }
                let previous = previous_snapshot(&self.participants, "phase undo")?;
                if snapshot.data != crate::undo::model::contribute(&previous.data, &write)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target != STATE).any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("undo intent differs from its immutable transition".into()));
                }
            }
            IntentKind::DebugReviewV1 { root_binding } => {
                let previous = previous_snapshot(&self.participants, "debug review")?;
                let expected = crate::debug::review::contribute(&previous.data, &root_binding)?;
                let changed = crate::debug::review::changed(&previous.data, &expected)?;
                for slug in &changed {
                    let (target, projection) = crate::execution::render::project_debug(&expected, slug)?;
                    if self.participants.iter().find(|p| p.target == target).map(|p| &p.bytes) != Some(&projection) {
                        return Err(Error::Invalid("debug review projection differs from authority".into()));
                    }
                }
                if names.len() != 3 + changed.len()
                    || debug_targets != changed.iter().map(String::as_str).collect::<Vec<_>>()
                    || snapshot.data != expected || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target == ITEMS || p.target == DECISIONS)
                        .any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("debug review differs from its confirmed authority".into()));
                }
                let prior_decisions = model::parse_lines::<DecisionRecord>(decisions)?;
                crate::rail::receipts::confirmed_history(&super::writer::View {
                    snapshot: previous, decisions: prior_decisions, items: model::parse_lines(items)?,
                })?;
            }
            IntentKind::DebugV1 { write } => {
                let previous = previous_snapshot(&self.participants, "debug")?;
                let expected = crate::debug::model::contribute(&previous.data, &write)?;
                let projects = crate::debug::model::outcome(&previous.data, &write).is_ok();
                if projects {
                    let (target, projection) = crate::execution::render::project_debug(&expected, write.apply.identity().1)?;
                    if bytes(&target)? != projection { return Err(Error::Invalid("debug projection differs from its record".into())); }
                }
                if names.len() != 3 + usize::from(projects)
                    || debug_targets != if projects { vec![write.apply.identity().1] } else { vec![] }
                    || snapshot.data != expected
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target == ITEMS || p.target == DECISIONS)
                        .any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("debug intent differs from its recorded transition".into()));
                }
            }

            IntentKind::SpikeV1 { write } => {
                let previous = previous_snapshot(&self.participants, "spike")?;
                let expected = crate::spike::model::contribute(&previous.data, &write)?;
                let projects = crate::spike::model::outcome(&previous.data, &write).is_ok();
                if projects {
                    let (target, projection) = crate::execution::render::project_spike(&expected, write.apply.identity().1)?;
                    if bytes(&target)? != projection { return Err(Error::Invalid("spike projection differs from its record".into())); }
                }
                if names.len() != 3 + usize::from(projects)
                    || spike_targets != if projects { vec![write.apply.identity().1] } else { vec![] }
                    || snapshot.data != expected
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target == ITEMS || p.target == DECISIONS)
                        .any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("spike intent differs from its recorded transition".into()));
                }
            }
            IntentKind::TaskV1 { write, .. } => {
                let previous = previous_snapshot(&self.participants, "task")?;
                let expected = crate::task::model::store_contribute(&previous.data, &write)?;
                let record = crate::task::model::store_namespace(&expected)?.records
                    .get(write.apply.slug()).cloned()
                    .ok_or_else(|| Error::Invalid("task intent lacks its record".into()))?;
                let (target, projection) = crate::task::model::store_projection(&record)?;
                if bytes(&target)? != projection {
                    return Err(Error::Invalid("task projection differs from its record".into()));
                }
                if names.len() != 4
                    || task_targets != vec![write.apply.slug()]
                    || snapshot.data != expected
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target == ITEMS || p.target == DECISIONS)
                        .any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("task intent differs from its recorded transition".into()));
                }
            }
            IntentKind::VerificationSubmitV1 { claim, root_binding } => {
                use cadence::verification::verdicts;
                if names.len() != 3 { return Err(Error::Invalid("verification patch cannot change external participants".into())); }
                if claim.root_binding != root_binding { return Err(Error::Invalid("verification claim root binding changed".into())); }
                let previous = previous_snapshot(&self.participants, "verification claim")?;
                validate_claim_transition(&self.participants, snapshot, (items, decisions), &root_binding,
                    verdicts::transaction(&previous.data, &claim)?, verdicts::decision(&claim)?, "verification claim")?;
            }
            IntentKind::MilestonePruneV1 { prune } => {
                if names.len() != 3 { return Err(Error::Invalid("prune has only its sealed filesystem participant and store record".into())); }
                let previous = previous_snapshot(&self.participants, "milestone prune")?;
                if snapshot.data != crate::milestone::prune::contribute(&previous.data, &prune)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target != STATE).any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("prune intent differs from its immutable transition".into()));
                }
            }
            IntentKind::MilestoneReleaseV1 { write } => {
                if names.len() != 3 { return Err(Error::Invalid("release has only its sealed manifest and store record".into())); }
                let previous = previous_snapshot(&self.participants, "milestone release")?;
                if snapshot.data != crate::milestone::release::contribute(&previous.data, &write)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                    || self.participants.iter().filter(|p| p.target != STATE).any(|p| p.expected.bytes.as_deref() != Some(&p.bytes)) {
                    return Err(Error::Invalid("release intent differs from its immutable transition".into()));
                }
            }
            IntentKind::VerificationWaiverV1 { claim, root_binding } => {
                use cadence::verification::waivers;
                if names.len() != 3 { return Err(Error::Invalid("waiver cannot change external participants".into())); }
                if claim.root_binding != root_binding { return Err(Error::Invalid("waiver claim root binding changed".into())); }
                let previous = previous_snapshot(&self.participants, "waiver claim")?;
                validate_claim_transition(&self.participants, snapshot, (items, decisions), &root_binding,
                    waivers::transaction(&previous.data, &claim)?, waivers::decision(&claim)?, "waiver claim")?;
            }
            IntentKind::VerificationHumanV1 { claim, root_binding } => {
                use cadence::verification::{human, projections};
                let phase = claim.request.submission.phase;
                let uat = self.participants.iter().find(|p| p.target == format!("phase-uat:{phase}"))
                    .ok_or_else(|| Error::Invalid("human result lacks its UAT participant".into()))?;
                if names.len() != 4 { return Err(Error::Invalid("human result changes only its own UAT participant".into())); }
                if claim.root_binding != root_binding { return Err(Error::Invalid("human result root binding changed".into())); }
                if projections::uat(&snapshot.data, phase)?.map(String::into_bytes).as_ref() != Some(&uat.bytes) {
                    return Err(Error::Invalid("UAT participant differs from the native render".into()));
                }
                let previous = previous_snapshot(&self.participants, "human result")?;
                validate_claim_transition(&self.participants, snapshot, (items, decisions), &root_binding,
                    human::transaction(&previous.data, &claim, uat.expected.clone())?, human::decision(&claim)?, "human result")?;
            }
            IntentKind::VerificationCompleteV1 { claim, root_binding } => {
                use cadence::verification::completion;
                if claim.root_binding != root_binding { return Err(Error::Invalid("completion root binding changed".into())); }
                let installed = completion::installed(&claim)?;
                if names.len() != 3 + installed.len() { return Err(Error::Invalid("completion changes only its own projections".into())); }
                let mut expected = Vec::new();
                for (target, bytes) in &installed {
                    let participant = self.participants.iter().find(|p| p.target == *target)
                        .ok_or_else(|| Error::Invalid(format!("completion lacks its {target} participant")))?;
                    if participant.bytes != *bytes {
                        return Err(Error::Invalid(format!("{target} participant differs from the completion render")));
                    }
                    expected.push(participant.expected.clone());
                }
                let previous = previous_snapshot(&self.participants, "completion")?;
                validate_claim_transition(&self.participants, snapshot, (items, decisions), &root_binding,
                    completion::transaction(&previous.data, &claim, &expected)?, completion::decision(&claim)?, "completion")?;
            }
            IntentKind::VerificationRunV1 { record, root_binding } => {
                use cadence::verification::runner;
                if names.len() != 3 { return Err(Error::Invalid("verification run cannot change external participants".into())); }
                let state = self.participants.last().expect("state participant");
                if state.expected.directory_identity != root_binding { return Err(Error::Invalid("verification run root binding changed".into())); }
                let previous: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("verification run requires prior snapshot".into()))?)?;
                let expected = runner::contribute(&previous.data, &root_binding, &record)?;
                let old_items = self.participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions = self.participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("verification run requires previous decisions".into()))?;
                let mut expected_decisions: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
                expected_decisions.push(runner::decision(&record)?);
                model::adopt_stamps(&mut expected_decisions, decisions)?;
                if snapshot.data != expected || old_items != Some(items)
                    || decisions != model::render_lines(&expected_decisions)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))? {
                    return Err(Error::Invalid("verification run intent differs from immutable transition".into()));
                }
            }
            IntentKind::VerificationV1 { request, root_binding } => {
                use cadence::verification::persistence;
                if names.len() != 3 { return Err(Error::Invalid("verification cannot change external participants".into())); }
                let state = self.participants.last().expect("state participant");
                if state.expected.directory_identity != root_binding { return Err(Error::Invalid("verification root binding changed".into())); }
                let previous: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("verification requires prior snapshot".into()))?)?;
                let expected = persistence::contribute(&previous.data, &root_binding, &request)?;
                let old_items = self.participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions = self.participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("verification requires previous decisions".into()))?;
                let mut expected_decisions: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
                expected_decisions.push(persistence::decision(&request.attempt)?);
                model::adopt_stamps(&mut expected_decisions, decisions)?;
                if snapshot.data != expected || old_items != Some(items)
                    || decisions != model::render_lines(&expected_decisions)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))? {
                    return Err(Error::Invalid("verification intent differs from immutable transition".into()));
                }
            }
            IntentKind::AdoptionDeclareV1 { record, request_id, root_binding } => {
                if names.len() != 3 { return Err(Error::Invalid("adoption declaration cannot change external participants".into())); }
                let state = self.participants.last().expect("state participant");
                if state.expected.directory_identity != root_binding || record.root_binding != root_binding {
                    return Err(Error::Invalid("adoption declaration root binding changed".into()));
                }
                let previous = previous_snapshot(&self.participants, "adoption declaration")?;
                let expected = cadence::adoption::declare(&previous.data, &record, &request_id)?;
                let old_items = self.participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions = self.participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref();
                if snapshot.data != expected || old_items != Some(items) || old_decisions != Some(decisions)
                    || snapshot.operations != previous.operations
                    || record.import_generation != snapshot.generation
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))? {
                    return Err(Error::Invalid("adoption declaration intent differs from immutable transition".into()));
                }
            }
            IntentKind::NativePlanV1 { request, root_binding } => {
                use cadence::execution::history;
                let state = self.participants.last().expect("state participant");
                if state.expected.directory_identity != root_binding {
                    return Err(Error::Invalid("native plan root binding changed".into()));
                }
                let previous: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("native plan requires prior snapshot".into()))?)?;
                let (expected, record) = history::plan_contribute(&previous.data, &root_binding, &request)?;
                self.validate_native_summary(&previous, snapshot, request.plan.phase)?;
                let old_items = self.participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions = self.participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("native plan requires previous decisions".into()))?;
                let mut expected_decisions: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
                expected_decisions.push(history::plan_decision(&record)?);
                if let Some(outcome) = super::writer::plan_routing_outcome(&previous.data, &expected_decisions, &record) {
                    expected_decisions.push(outcome);
                }
                model::adopt_stamps(&mut expected_decisions, decisions)?;
                if snapshot.data != expected || old_items != Some(items)
                    || decisions != model::render_lines(&expected_decisions)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                { return Err(Error::Invalid("native plan intent differs from validated immutable transition".into())); }
            }
            IntentKind::NativeTaskV1 { request, root_binding } => {
                use cadence::execution::history;
                let state = self.participants.last().expect("state participant");
                if state.expected.directory_identity != root_binding {
                    return Err(Error::Invalid("native task root binding changed".into()));
                }
                let previous: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("native task requires prior snapshot".into()))?)?;
                let (expected, record) = history::contribute(&previous.data, &root_binding, &request, process)?;
                self.validate_native_summary(&previous, snapshot, request.task.phase)?;
                let old_items = self.participants.iter().find(|p| p.target == ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions = self.participants.iter().find(|p| p.target == DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(|| Error::Invalid("native task requires previous decisions".into()))?;
                let mut expected_decisions: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
                expected_decisions.extend(history::decisions(&record)?);
                model::adopt_stamps(&mut expected_decisions, decisions)?;
                if snapshot.data != expected || old_items != Some(items)
                    || decisions != model::render_lines(&expected_decisions)?
                    || snapshot.operations != previous.operations
                    || snapshot.generation != previous.generation.checked_add(1).ok_or_else(|| Error::Invalid("generation exhausted".into()))?
                { return Err(Error::Invalid("native task intent differs from validated immutable transition".into())); }
            }
            IntentKind::NativeAdmissionV1 {request,root_binding,inventory} => {
                use cadence::execution::admission;
                if names.len()!=3 {return Err(Error::Invalid("native admission cannot change external participants".into()));}
                let state=self.participants.last().expect("state participant");
                if state.expected.directory_identity!=root_binding {return Err(Error::Invalid("native admission root binding changed".into()));}
                let previous:Snapshot=serde_json::from_slice(state.expected.bytes.as_deref()
                    .ok_or_else(||Error::Invalid("native admission requires prior snapshot".into()))?)?;
                let inventory:cadence::plan::inventory::Inventory=serde_json::from_slice(inventory.bytes.as_deref()
                    .ok_or_else(||Error::Invalid("native admission requires installed inventory".into()))?)?;
                let (expected,record)=admission::contribute(&previous.data,&inventory.documents,&root_binding,&request)?;
                let old_items=self.participants.iter().find(|p|p.target==ITEMS).unwrap().expected.bytes.as_deref();
                let old_decisions=self.participants.iter().find(|p|p.target==DECISIONS).unwrap().expected.bytes.as_deref()
                    .ok_or_else(||Error::Invalid("native admission requires previous decisions".into()))?;
                let mut expected_decisions:Vec<DecisionRecord>=model::parse_lines(old_decisions)?;
                expected_decisions.push(admission::decision(&record)?);
                model::adopt_stamps(&mut expected_decisions,decisions)?;
                if snapshot.data!=expected || old_items!=Some(items)
                    || decisions!=model::render_lines(&expected_decisions)?
                    || snapshot.operations!=previous.operations
                    || snapshot.generation!=previous.generation.checked_add(1).ok_or_else(||Error::Invalid("generation exhausted".into()))?
                {return Err(Error::Invalid("native admission intent differs from validated immutable transition".into()));}
            }
            IntentKind::PlanPublication { phase, inventory, requirements } => {
                for target in [ITEMS, DECISIONS] {
                    let participant = self
                        .participants
                        .iter()
                        .find(|p| p.target == target)
                        .unwrap();
                    if participant.expected.bytes.as_deref() != Some(participant.bytes.as_slice()) {
                        return Err(Error::Invalid(
                            "plan publication cannot append unrelated records".into(),
                        ));
                    }
                }
                let previous: Snapshot = serde_json::from_slice(
                    self.participants
                        .last()
                        .and_then(|p| p.expected.bytes.as_deref())
                        .ok_or_else(|| {
                            Error::Invalid("plan publication requires prior snapshot".into())
                        })?,
                )?;
                let documents = plan_targets
                    .iter()
                    .map(|(phase, plan)| {
                        let participant = self
                            .participants
                            .iter()
                            .find(|p| p.target == format!("phase-plan:{phase}:{plan}"))
                            .unwrap();
                        cadence::plan::persistence::validate_old_document(&previous.data, *phase, *plan, participant.expected.bytes.as_deref())?;
                        Ok((*plan, participant.bytes.clone()))
                    })
                    .collect::<Result<Vec<_>>>()?;
                cadence::plan::persistence::validate_publication(
                    &previous.data,
                    &snapshot.data,
                    phase,
                    &inventory,
                    &documents,
                )
                .map_err(|e| cadence::plan::limits::disposition(e, Error::Invalid))?;
                // The seeded trace rows are exactly the preimage seeded by the
                // receipt's declared ids; recovery derives the same bytes.
                let participant = self.participants.iter().find(|p| p.target == "requirements");
                let seeded = participant.map(|p| cadence::plan::persistence::seeded_requirements(
                    &previous.data, &snapshot.data, phase, p.expected.bytes.as_deref())).transpose()?.flatten();
                if participant.map(|p| p.bytes.as_slice()) != seeded.as_ref().map(|(bytes, _)| bytes.as_slice())
                    || requirements.as_deref() != seeded.as_ref().map(|(_, ids)| ids.as_slice()) {
                    return Err(Error::Invalid("requirements participant differs from seeding its observed preimage".into()));
                }
            }
            IntentKind::ExecutionDispatch { phase } => {
                cadence::plan::persistence::require_legacy_execution(&snapshot.data, phase)?;
                let execution = execution_snapshot(snapshot)?;
                let occurrence =
                    execution
                        .occurrences
                        .get(&phase.to_string())
                        .ok_or_else(|| {
                            Error::Invalid("dispatch intent lacks its execution occurrence".into())
                        })?;
                if occurrence.phase != phase || occurrence.active.is_none() {
                    return Err(Error::Invalid("invalid dispatch intent projection".into()));
                }
                let active = occurrence.active.as_ref().unwrap();
                if active.route.is_some()
                    || active.policy.rung != cadence::execution::model::ExecutorRung::Fixed
                {
                    return Err(Error::Invalid(
                        "routed dispatch requires current boundary admission".into(),
                    ));
                }
            }
            IntentKind::ContextPublication { phase } => {
                let previous: Snapshot = serde_json::from_slice(
                    self.participants
                        .last()
                        .and_then(|p| p.expected.bytes.as_deref())
                        .ok_or_else(|| Error::Invalid("context requires prior snapshot".into()))?,
                )?;
                cadence::context::persistence::validate_publication(
                    &previous.data,
                    &snapshot.data,
                    phase,
                    bytes(&format!("phase-context:{phase}"))?,
                )
                .map_err(|error| Error::Invalid(error.to_string()))?;
            }
            IntentKind::ExecutionPatch {
                phase,
                summary: true,
                ..
            } => {
                let execution = execution_snapshot(snapshot)?;
                let rendered = cadence::execution::render::render_phase_summary(&execution, phase)
                    .map_err(|error| Error::Invalid(error.to_string()))?;
                let target = format!("phase-summary:{phase}");
                if bytes(&target)? != rendered {
                    return Err(Error::Invalid(
                        "phase summary differs from the execution projection".into(),
                    ));
                }
            }
            IntentKind::ExecutionFinalizeRiskV1 { .. }
            | IntentKind::RailReceipt { .. }
            | IntentKind::RailObservation { .. }
            | IntentKind::GuardAudit { .. }
            | IntentKind::SnapshotRepairV1 { .. }
            | IntentKind::BoundaryObservationV1 { .. }
            | IntentKind::ExecutionDispatchV1 { .. }
            | IntentKind::NativeExecutionDispatchV1 { .. }
            | IntentKind::NativeExecutionReissueV1 { .. }
            | IntentKind::ExecutionPatchV1 { .. }
            | IntentKind::Store
            | IntentKind::ExecutionRefusal { .. }
            | IntentKind::ExecutionPatch { summary: false, .. } => {}
        }
        if let IntentKind::ExecutionDispatch { phase }
        | IntentKind::ExecutionPatch { phase, .. }
        | IntentKind::ExecutionRefusal { phase } = self.kind.clone()
        {
            let decisions: Vec<DecisionRecord> = model::parse_lines(decisions)?;
            if !decisions.iter().any(|record| {
                matches!(
                    record.decision,
                    model::Decision::Boundary {
                        phase: decision_phase,
                        store_generation,
                        ..
                    } if decision_phase == phase && store_generation == snapshot.generation
                )
            }) {
                return Err(Error::Invalid(
                    "execution intent lacks its generation boundary decision".into(),
                ));
            }
        }
        self.validate_rail_receipt(snapshot)?;
        self.validate_risk_finalization(snapshot)?;
        self.validate_rail_observation(snapshot)?;
        self.validate_guard_audit(snapshot)?;
        self.validate_snapshot_repair(snapshot)?;
        self.validate_boundary_v1(snapshot, decisions, summary_phase)?;
        Ok(())
    }
    /// The repair is exactly what the parse restores from the previous log:
    /// same items, same decisions, the next generation, the repair operation
    /// added, and no other change to the data.
    fn validate_snapshot_repair(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::SnapshotRepairV1 { repaired } = &self.kind else {
            return Ok(());
        };
        if self.participants.len() != 3
            || self.participants.iter().any(|p| !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE))
        {
            return Err(Error::Invalid("snapshot repair cannot change external participants".into()));
        }
        let participant = |name| self.participants.iter().find(|p| p.target == name).unwrap();
        let (items, decisions, state) = (participant(ITEMS), participant(DECISIONS), participant(STATE));
        let old_decisions = decisions.expected.bytes.as_deref().unwrap_or_default();
        let mut old: Snapshot = serde_json::from_slice(state.expected.bytes.as_deref()
            .ok_or_else(|| Error::Invalid("snapshot repair requires prior snapshot".into()))?)?;
        let restored = cadence::execution::history::reconcile(&mut old.data, old_decisions)?;
        let mut operations = old.operations.clone();
        operations.insert(snapshot_repair_operation(snapshot.generation), model::digest(&serde_json::to_vec(repaired)?));
        if repaired.is_empty()
            || restored != *repaired
            || items.expected.bytes.as_deref().unwrap_or_default() != items.bytes.as_slice()
            || old_decisions != decisions.bytes.as_slice()
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || snapshot.operations != operations
            || snapshot.data != old.data
        {
            return Err(Error::Invalid("snapshot repair changed data outside the log's records".into()));
        }
        Ok(())
    }
    fn validate_risk_finalization(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::ExecutionFinalizeRiskV1 {
            phase,
            decision_id,
            requirements,
        } = &self.kind
        else {
            return Ok(());
        };
        if self.participants.len() != 4
            || self.participants.iter().any(|p| {
                !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE)
                    && p.target != format!("phase-summary:{phase}")
            })
        {
            return Err(Error::Invalid(
                "invalid risk finalization participants".into(),
            ));
        }
        let participant = |name| {
            self.participants
                .iter()
                .find(|p| p.target == name)
                .ok_or_else(|| Error::Invalid("finalization lacks participant".into()))
        };
        let state = participant(STATE)?;
        let items = participant(ITEMS)?;
        let decisions = participant(DECISIONS)?;
        let old = Snapshot::parse(
            state
                .expected
                .bytes
                .as_deref()
                .ok_or_else(|| Error::Invalid("finalization lacks prior state".into()))?,
            items.expected.bytes.as_deref().unwrap_or_default(),
            decisions.expected.bytes.as_deref().unwrap_or_default(),
        )?;
        let expected = cadence::rail::receipts::finalize_execution(&old.data, *phase, requirements)
            .map_err(super::writer::rail_error)?;
        let records: Vec<DecisionRecord> = model::parse_lines(&decisions.bytes)?;
        let mut old_records: Vec<DecisionRecord> =
            model::parse_lines(decisions.expected.bytes.as_deref().unwrap_or_default())?;
        let decision = records
            .iter()
            .find(|r| &r.id == decision_id)
            .ok_or_else(|| Error::Invalid("finalization lacks decision".into()))?;
        if !matches!(&decision.decision, model::Decision::BoundaryV1(value)
            if value.store_generation == snapshot.generation && !value.terminal
                && value.boundary.tool == cadence::execution::model::BoundaryTool::CadenceQuery
                && value.boundary.receipt == (Receipt::Compact { envelope:Envelope::Ok(Success::Complete {phase:*phase}) }))
        {
            return Err(Error::Invalid("invalid risk finalization decision".into()));
        }
        old_records.push(decision.clone());
        if snapshot.data != expected
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || items.bytes != items.expected.bytes.as_deref().unwrap_or_default()
            || decisions.bytes != model::render_lines(&old_records)?
        {
            return Err(Error::Invalid(
                "risk finalization changed data outside its projection".into(),
            ));
        }
        Ok(())
    }

    fn validate_rail_receipt(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::RailReceipt { record } = &self.kind else {
            return Ok(());
        };
        record.validate().map_err(super::writer::rail_error)?;
        if self.participants.len() != 3
            || self
                .participants
                .iter()
                .any(|p| !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE))
        {
            return Err(Error::Invalid(
                "rail receipt cannot change external participants".into(),
            ));
        }
        let participant = |name| self.participants.iter().find(|p| p.target == name).unwrap();
        let items = participant(ITEMS);
        let decisions = participant(DECISIONS);
        let state = participant(STATE);
        let old_items = items.expected.bytes.as_deref().unwrap_or_default();
        let old_decisions = decisions.expected.bytes.as_deref().unwrap_or_default();
        let old = match state.expected.bytes.as_deref() {
            Some(bytes) => Snapshot::parse(bytes, old_items, old_decisions)?,
            None if items.expected.bytes.is_none() && decisions.expected.bytes.is_none() => {
                Snapshot::new(0, b"", b"", Value::Null)?
            }
            _ => {
                return Err(Error::Invalid(
                    "rail receipt cannot adopt partial store".into(),
                ));
            }
        };
        let mut expected: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
        expected.push(super::writer::rail_fact_record(record)?);
        model::adopt_stamps(&mut expected, &decisions.bytes)?;
        if items.bytes != old_items
            || decisions.bytes != model::render_lines(&expected)?
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || record.confirmation.generation != snapshot.generation
            || snapshot.operations != old.operations
            || cadence::rail::receipts::read(&old.data)
                .map_err(super::writer::rail_error)?
                .contains_key(&record.fact.key().map_err(super::writer::rail_error)?)
            || snapshot.data
                != cadence::rail::receipts::project(&old.data, record)
                    .map_err(super::writer::rail_error)?
        {
            return Err(Error::Invalid(
                "rail receipt changed data outside its projection".into(),
            ));
        }
        Ok(())
    }

    fn validate_rail_observation(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::RailObservation { record } = &self.kind else {
            return Ok(());
        };
        record.validate().map_err(super::writer::rail_error)?;
        if self.participants.len() != 3
            || self
                .participants
                .iter()
                .any(|p| !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE))
        {
            return Err(Error::Invalid(
                "rail observation cannot change external participants".into(),
            ));
        }
        let participant = |name| self.participants.iter().find(|p| p.target == name).unwrap();
        let items = participant(ITEMS);
        let decisions = participant(DECISIONS);
        let state = participant(STATE);
        let old_items = items.expected.bytes.as_deref().unwrap_or_default();
        let old_decisions = decisions.expected.bytes.as_deref().unwrap_or_default();
        let old = match state.expected.bytes.as_deref() {
            Some(bytes) => Snapshot::parse(bytes, old_items, old_decisions)?,
            None if items.expected.bytes.is_none() && decisions.expected.bytes.is_none() => {
                Snapshot::new(0, b"", b"", Value::Null)?
            }
            _ => {
                return Err(Error::Invalid(
                    "rail observation cannot adopt partial store".into(),
                ));
            }
        };
        let mut expected: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
        expected.push(super::writer::rail_record(record)?);
        model::adopt_stamps(&mut expected, &decisions.bytes)?;
        if items.bytes != old_items
            || decisions.bytes != model::render_lines(&expected)?
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || record.confirmation.generation != snapshot.generation
            || snapshot.operations != old.operations
            || cadence::rail::risk::read(&old.data)
                .map_err(super::writer::rail_error)?
                .contains_key(
                    &record
                        .observation
                        .key()
                        .map_err(super::writer::rail_error)?,
                )
            || snapshot.data
                != cadence::rail::risk::project(&old.data, record)
                    .map_err(super::writer::rail_error)?
        {
            return Err(Error::Invalid(
                "rail observation changed data outside its projection".into(),
            ));
        }
        Ok(())
    }

    fn validate_guard_audit(&self, snapshot: &Snapshot) -> Result<()> {
        let IntentKind::GuardAudit { audit } = &self.kind else {
            return Ok(());
        };
        if self.participants.len() != 3
            || self
                .participants
                .iter()
                .any(|p| !matches!(p.target.as_str(), ITEMS | DECISIONS | STATE))
        {
            return Err(Error::Invalid(
                "guard audit cannot change external participants".into(),
            ));
        }
        let participant = |name| self.participants.iter().find(|p| p.target == name).unwrap();
        let items = participant(ITEMS);
        let decisions = participant(DECISIONS);
        let state = participant(STATE);
        let old_items = items.expected.bytes.as_deref().unwrap_or_default();
        let old_decisions = decisions.expected.bytes.as_deref().unwrap_or_default();
        let old = match state.expected.bytes.as_deref() {
            Some(bytes) => Snapshot::parse(bytes, old_items, old_decisions)?,
            None if items.expected.bytes.is_none() && decisions.expected.bytes.is_none() => {
                Snapshot::new(0, b"", b"", Value::Null)?
            }
            _ => {
                return Err(Error::Invalid(
                    "guard audit cannot adopt partial store".into(),
                ));
            }
        };
        let mut expected: Vec<DecisionRecord> = model::parse_lines(old_decisions)?;
        expected.push(audit.record()?);
        model::adopt_stamps(&mut expected, &decisions.bytes)?;
        if items.bytes != old_items
            || decisions.bytes != model::render_lines(&expected)?
            || old.generation.checked_add(1) != Some(snapshot.generation)
            || snapshot.operations != old.operations
            || snapshot.data != super::writer::audit::project(&old, audit)?
        {
            return Err(Error::Invalid(
                "guard audit changed data outside its projection".into(),
            ));
        }
        Ok(())
    }
    fn validate_boundary_v1(
        &self,
        snapshot: &Snapshot,
        decisions: &[u8],
        summary_phase: Option<u32>,
    ) -> Result<()> {
        let (scope, id, summary) = match &self.kind {
            IntentKind::BoundaryObservationV1 { scope, decision_id } => {
                (scope.clone(), decision_id, false)
            }
            IntentKind::ExecutionDispatchV1 { phase, decision_id }
            | IntentKind::NativeExecutionDispatchV1 { phase, decision_id, .. } => (
                BoundaryScope::Execution { phase: *phase },
                decision_id,
                false,
            ),
            IntentKind::NativeExecutionReissueV1 { phase, decision_id, .. } => (
                BoundaryScope::Execution { phase: *phase },
                decision_id,
                false,
            ),
            IntentKind::ExecutionFinalizeRiskV1 {
                phase, decision_id, ..
            } => (
                BoundaryScope::Execution { phase: *phase },
                decision_id,
                true,
            ),
            IntentKind::ExecutionPatchV1 {
                phase,
                decision_id,
                render_version,
                ..
            } => {
                if *render_version != cadence::execution::render::SUMMARY_RENDER_VERSION {
                    return Err(Error::Invalid("unsupported boundary render version".into()));
                }
                (
                    BoundaryScope::Execution { phase: *phase },
                    decision_id,
                    true,
                )
            }
            _ => return Ok(()),
        };
        if !scope.valid()
            || summary != summary_phase.is_some()
            || summary_phase.is_some_and(|phase| scope != (BoundaryScope::Execution { phase }))
            || self.participants.len() != if summary { 4 } else { 3 }
            || self
                .participants
                .iter()
                .any(|p| matches!(p.target.as_str(), "repo-config" | "global-config"))
        {
            return Err(Error::Invalid(
                "invalid boundary intent participants".into(),
            ));
        }
        let records: Vec<DecisionRecord> = model::parse_lines(decisions)?;
        model::validate_decisions(&records)?;
        let value = records
            .iter()
            .find_map(|record| match &record.decision {
                model::Decision::BoundaryV1(value)
                    if &record.id == id
                        && value.boundary.scope == scope
                        && value.store_generation == snapshot.generation =>
                {
                    Some(value)
                }
                _ => None,
            })
            .ok_or_else(|| Error::Invalid("intent lacks its exact boundary decision".into()))?;
        if records.iter().any(|record| {
            matches!(&record.decision,
            model::Decision::BoundaryV1(value) if value.store_generation > snapshot.generation)
        }) {
            return Err(Error::Invalid(
                "boundary generation exceeds snapshot".into(),
            ));
        }
        if value.boundary.is_native_refusal()
            && !matches!(self.kind, IntentKind::BoundaryObservationV1 { .. }) {
            return Err(Error::Invalid("native refusal intent must be an observation".into()));
        }
        if let Some(evidence) = &value.boundary.lease_refusal {
            if !matches!(self.kind, IntentKind::BoundaryObservationV1 { .. }) {
                return Err(Error::Invalid(
                    "lease refusal intent must be an observation".into(),
                ));
            }
            let execution = execution_snapshot(snapshot)?;
            let active = execution
                .occurrences
                .get(&evidence.paths.phase.to_string())
                .and_then(|o| o.active.as_ref())
                .ok_or_else(|| Error::Invalid("lease refusal intent lacks open dispatch".into()))?;
            evidence
                .validate_active(active)
                .map_err(|e| Error::Invalid(e.to_string()))?;
        }
        match &self.kind {
            IntentKind::ExecutionDispatchV1 { phase, .. }
            | IntentKind::NativeExecutionDispatchV1 { phase, .. } => {
                if let IntentKind::NativeExecutionDispatchV1 {inventory,..}=&self.kind {
                    let inventory:cadence::plan::inventory::Inventory=serde_json::from_slice(inventory.bytes.as_deref().ok_or_else(||Error::Invalid("missing native dispatch inventory".into()))?)?;
                    cadence::plan::persistence::require_execution_ready(&snapshot.data,*phase,&inventory.documents)?;
                } else {cadence::plan::persistence::require_legacy_execution(&snapshot.data,*phase)?;}
                let execution = execution_snapshot(snapshot)?;
                let active = execution
                    .occurrences
                    .get(&phase.to_string())
                    .and_then(|o| o.active.as_ref())
                    .ok_or_else(|| {
                        Error::Invalid("dispatch intent lacks active dispatch".into())
                    })?;
                super::writer::validate_routing(active, &records)?;
                if let Some(issue) = execution.occurrences[&phase.to_string()].issues.get(&active.id)
                    && (issue.binding != cadence::execution::dispatch::issue_binding(&snapshot.data, active)?
                        || issue.issue_digest != cadence::execution::dispatch::binding_digest(&issue.binding)?
                        || issue.issue_digest != active.issue_digest
                        || issue.operational["dispatch_id"] != active.id)
                { return Err(Error::Invalid("dispatch issue intent binding mismatch".into())); }
                if active.phase != *phase
                    || value.terminal
                    || value.boundary.receipt
                        != (Receipt::Dispatch {
                            dispatch_id: active.id.clone(),
                            prompt_bytes: None,
                            prompt_digest: active.prompt_digest.clone(),
                        })
                {
                    return Err(Error::Invalid("dispatch intent receipt mismatch".into()));
                }
            }
            IntentKind::NativeExecutionReissueV1 { phase, issue_dispatch_id, .. } => {
                let execution = execution_snapshot(snapshot)?;
                let active = execution
                    .occurrences
                    .get(&phase.to_string())
                    .and_then(|occurrence| occurrence.active.as_ref())
                    .ok_or_else(|| Error::Invalid("dispatch re-issue intent lacks active dispatch".into()))?;
                if active.phase != *phase
                    || active.issue_digest.len() != 64
                    || !active.issue_digest.bytes().all(|byte| byte.is_ascii_hexdigit())
                    || (!active.prompt_digest.is_empty() && crate::store::model::digest(active.prompt.as_bytes()) != active.prompt_digest)
                    || value.terminal
                    || value.boundary.receipt
                        != (Receipt::Dispatch {
                            dispatch_id: issue_dispatch_id.clone(),
                            prompt_bytes: None,
                            prompt_digest: if execution.occurrences[&phase.to_string()].issues.contains_key(issue_dispatch_id) {
                                String::new()
                            } else { active.prompt_digest.clone() },
                        })
                {
                    return Err(Error::Invalid("dispatch re-issue intent receipt mismatch".into()));
                }
                let previous: Snapshot = serde_json::from_slice(
                    self.participants
                        .last()
                        .and_then(|participant| participant.expected.bytes.as_deref())
                        .ok_or_else(|| Error::Invalid("dispatch re-issue requires prior snapshot".into()))?,
                )?;
                let mut expected_execution = execution_snapshot(&previous)?;
                let expected_active = expected_execution
                    .occurrences
                    .get_mut(&phase.to_string())
                    .and_then(|occurrence| occurrence.active.as_mut())
                    .ok_or_else(|| Error::Invalid("dispatch re-issue preimage lacks active dispatch".into()))?;
                expected_active.prompt = active.prompt.clone();
                expected_active.prompt_digest = active.prompt_digest.clone();
                expected_active.issue_digest = active.issue_digest.clone();
                if let Some(issue) = execution.occurrences[&phase.to_string()].issues.get(issue_dispatch_id) {
                    if issue.binding != cadence::execution::dispatch::issue_binding(&snapshot.data, active)?
                        || issue.issue_digest != cadence::execution::dispatch::binding_digest(&issue.binding)?
                        || issue.issue_digest != active.issue_digest
                        || issue.operational["dispatch_id"] != *issue_dispatch_id
                    { return Err(Error::Invalid("dispatch issue intent binding mismatch".into())); }
                    expected_execution.occurrences.get_mut(&phase.to_string()).unwrap()
                        .issues.insert(issue_dispatch_id.clone(), issue.clone());
                }
                let mut previous_data = previous.data;
                let mut current_data = snapshot.data.clone();
                previous_data.as_object_mut().unwrap().remove("execution");
                current_data.as_object_mut().unwrap().remove("execution");
                if expected_execution != execution || previous_data != current_data {
                    return Err(Error::Invalid("dispatch re-issue changed data outside retained prompt state".into()));
                }
            }
            IntentKind::ExecutionPatchV1 {
                phase, risk_basis, ..
            } => {
                let execution = execution_snapshot(snapshot)?;
                let occurrence =
                    execution
                        .occurrences
                        .get(&phase.to_string())
                        .ok_or_else(|| {
                            Error::Invalid("patch intent lacks execution occurrence".into())
                        })?;
                let subject =
                    value.boundary.subject_id.as_ref().ok_or_else(|| {
                        Error::Invalid("patch intent lacks receipt identity".into())
                    })?;
                let receipt = occurrence
                    .receipts
                    .get(subject)
                    .ok_or_else(|| Error::Invalid("patch intent lacks execution receipt".into()))?;
                if let Some(basis) = risk_basis {
                    let state = self
                        .participants
                        .iter()
                        .find(|p| p.target == STATE)
                        .unwrap();
                    let old: Snapshot =
                        serde_json::from_slice(state.expected.bytes.as_deref().ok_or_else(
                            || Error::Invalid("execution basis lacks prior snapshot".into()),
                        )?)?;
                    let active = execution_snapshot(&old)?
                        .occurrences
                        .get(&phase.to_string())
                        .and_then(|o| o.active.clone())
                        .ok_or_else(|| {
                            Error::Invalid("execution basis lacks prior dispatch".into())
                        })?;
                    let expected = cadence::rail::risk::ExecutionBasis::from_accepted(
                        &active,
                        &receipt.outcome,
                    )
                    .map_err(super::writer::rail_error)?;
                    let projected =
                        cadence::rail::risk::project_execution_basis(&old.data, &expected)
                            .map_err(super::writer::rail_error)?;
                    if **basis != expected
                        || snapshot.data.get(cadence::rail::risk::EXECUTION_MATERIAL)
                            != projected.get(cadence::rail::risk::EXECUTION_MATERIAL)
                    {
                        return Err(Error::Invalid(
                            "execution basis differs from accepted material".into(),
                        ));
                    }
                }
                let answer_matches = match &value.boundary.receipt {
                    Receipt::Compact {
                        envelope: Envelope::Refused { code, .. },
                    } => {
                        code == "risk-pending"
                            && risk_basis.is_some()
                            && occurrence.terminal.is_none()
                            && occurrence.active.is_none()
                            && receipt.outcome.disposition
                                == cadence::execution::model::PlanDisposition::Complete
                    }
                    Receipt::Compact {
                        envelope:
                            Envelope::Ok(Success::Complete {
                                phase: answer_phase,
                            }),
                    } => {
                        answer_phase == phase
                            && matches!(
                                occurrence.terminal,
                                Some(cadence::execution::model::TerminalOutcome::Complete { .. })
                            )
                    }
                    Receipt::Compact {
                        envelope:
                            Envelope::Ok(Success::NextPlan {
                                phase: answer_phase,
                                ..
                            }),
                    } => {
                        answer_phase == phase
                            && receipt.outcome.disposition
                                == cadence::execution::model::PlanDisposition::Complete
                    }
                    Receipt::Compact {
                        envelope:
                            Envelope::Ok(Success::JudgmentStop {
                                phase: answer_phase,
                                dispatch_id,
                                blocker_ids,
                            }),
                    } => {
                        answer_phase == phase
                            && dispatch_id == subject
                            && matches!(&occurrence.terminal,
                            Some(cadence::execution::model::TerminalOutcome::JudgmentStop { blocker_ids: stored, .. }) if stored == blocker_ids)
                    }
                    _ => false,
                };
                if !answer_matches || value.terminal {
                    return Err(Error::Invalid("patch intent answer mismatch".into()));
                }
                let rendered = cadence::execution::render::render_phase_summary(&execution, *phase)
                    .map_err(|error| Error::Invalid(error.to_string()))?;
                if !self
                    .participants
                    .iter()
                    .any(|p| p.target == format!("phase-summary:{phase}") && p.bytes == rendered)
                {
                    return Err(Error::Invalid(
                        "phase summary differs from execution projection".into(),
                    ));
                }
            }
            _ => {}
        }
        Ok(())
    }
}

fn execution_snapshot(snapshot: &Snapshot) -> Result<cadence::execution::model::ExecutionSnapshot> {
    let value = snapshot
        .data
        .get("execution")
        .cloned()
        .ok_or_else(|| Error::Invalid("execution intent lacks its projection".into()))?;
    serde_json::from_value(value).map_err(Error::from)
}

fn previous_on_disk<S: Storage>(storage: &mut S, participants: &[Participant], replay: bool,
    root_binding: &str, binding_error: &str, preimage_error: &str) -> Result<Option<Snapshot>> {
    let state = participants.iter().find(|participant| participant.target == STATE)
        .ok_or_else(|| Error::Invalid("snapshot absent".into()))?;
    let actual = storage.read(STATE)?;
    if actual.directory_identity != root_binding {
        return Err(Error::Invalid(binding_error.into()));
    }
    if state.installed(&actual, replay) {
        return Ok(None);
    }
    let bytes = actual.bytes.as_deref().ok_or_else(|| Error::Invalid(preimage_error.into()))?;
    Ok(Some(serde_json::from_slice(bytes)?))
}

fn validate_all<S: Storage>(
    storage: &mut S,
    participants: &[Participant],
    replay: bool,
    kind: &IntentKind,
    encoding: Encoding,
    process: &mut dyn Process,
) -> Result<()> {
    if let IntentKind::DebugReviewV1 { root_binding } = kind
        && storage.root().map(crate::verification::inputs::root_binding).transpose()?.as_ref() != Some(root_binding) {
        return Err(Error::Invalid("debug review recovery root binding changed".into()));
    }
    if let IntentKind::UndoV1 { write } = kind { storage.validate_undo(write, replay)?; }
    if let IntentKind::DebugV1 { write } = kind
        && storage.root().map(crate::verification::inputs::root_binding).transpose()?.as_ref() != Some(&write.root_binding) {
        return Err(Error::Invalid("debug recovery root binding changed".into()));
    }
    if let IntentKind::SpikeV1 { write } = kind
        && (storage.root().map(crate::verification::inputs::root_binding).transpose()?.as_ref() != Some(&write.root_binding)
            || storage.root().and_then(std::path::Path::parent).map(std::path::Path::canonicalize).transpose()?.as_ref() != Some(&write.project)) {
        return Err(Error::Invalid("spike recovery root binding changed".into()));
    }
    if let IntentKind::TaskV1 { write, root_binding } = kind
        && (storage.root().map(crate::verification::inputs::root_binding).transpose()?.as_ref() != Some(root_binding)
            || storage.root().and_then(std::path::Path::parent).map(std::path::Path::canonicalize).transpose()?.as_ref() != Some(&write.project)) {
        return Err(Error::Invalid("task recovery root binding changed".into()));
    }
    if let IntentKind::MilestoneReleaseV1 { write } = kind { storage.validate_release(write, replay)?; }
    if let IntentKind::MilestonePruneV1 { prune } = kind {
        storage.validate_prune(prune, replay)?;
    }
    if let IntentKind::VerificationSubmitV1 { claim, root_binding } = kind
        && let Some(previous) = previous_on_disk(storage, participants, replay, root_binding,
            "verification claim store binding changed", "verification claim preimage absent")?
    {
        cadence::verification::verdicts::reobserve(&previous.data, claim, process)?;
    }
    if let IntentKind::VerificationWaiverV1 { claim, root_binding } = kind
        && let Some(previous) = previous_on_disk(storage, participants, replay, root_binding,
            "waiver claim store binding changed", "waiver claim preimage absent")?
    {
        cadence::verification::waivers::reobserve(&previous.data, claim, process)?;
    }
    if let IntentKind::VerificationHumanV1 { claim, root_binding } = kind
        && previous_on_disk(storage, participants, replay, root_binding,
            "human result store binding changed", "human result preimage absent")?.is_some()
    {
        cadence::verification::human::reobserve(claim)?;
    }
    if let IntentKind::VerificationCompleteV1 { claim, root_binding } = kind
        && let Some(previous) = previous_on_disk(storage, participants, replay, root_binding,
            "completion store binding changed", "completion preimage absent")?
    {
        cadence::verification::completion::reobserve(&previous.data, claim, process)?;
    }
    if let IntentKind::VerificationRunV1 { record, root_binding } = kind
        && let Some(previous) = previous_on_disk(storage, participants, replay, root_binding,
            "verification run store binding changed", "verification run preimage absent")?
    {
        cadence::verification::runner::reobserve_launch(&previous.data, record, process)?;
    }
    if let IntentKind::VerificationV1 { request, root_binding } = kind
        && let Some(previous) = previous_on_disk(storage, participants, replay, root_binding,
            "verification store binding changed", "verification preimage absent")?
    {
        cadence::verification::inputs::reobserve_external(&request.root, &previous.data, &request.attempt.inputs, &request.documents, process)?;
    }
    if let IntentKind::NativeTaskV1 {request,root_binding}=kind
        && let cadence::execution::history::Event::Checkpoint {records,..}=&request.event
    {
        for record in records {
            let mut filesystem=super::filesystem::Filesystem::new(&record.scope.planning_root)?;
            if filesystem.read(STATE)?.directory_identity!=*root_binding {
                return Err(Error::Invalid("native checkpoint differs from bound store".into()));
            }
        }
    }
    if let IntentKind::NativeTaskV1 {request,root_binding}=kind
        && let cadence::execution::history::Event::Close(proof)=&request.event
    {
        let mut filesystem=super::filesystem::Filesystem::new(&proof.planning_root)?;
        if filesystem.read(STATE)?.directory_identity!=*root_binding {
            return Err(Error::Invalid("native close project differs from bound store".into()));
        }
        cadence::execution::receipts::reobserve_source(&proof.project,&proof.dispatch,&request.task.task,&proof.source, process)?;
    }
    if let IntentKind::NativeAdmissionV1 {request,root_binding,inventory}=kind {
        let phase=request.contract.phase;
        let observed=storage.read(&format!("phase-plan-inventory:{phase}"))?;
        admission_inputs_hold(phase,inventory,root_binding,&observed,&storage.read(STATE)?)?;
    }
    if let IntentKind::NativeExecutionDispatchV1 {phase,inventory,..}=kind {
        dispatch_inputs_hold(*phase,inventory,&storage.read(&format!("phase-plan-inventory:{phase}"))?)?;
    }
    // This entire pass finishes before any participant can change.
    for participant in participants {
        let actual = storage.read(&participant.target)?;
        participant.validate_encoded(&actual, encoding, replay)?;
    }
    Ok(())
}

/// A native admission confirms only against the installed PLAN inventory it
/// was prepared from, in the store it was bound to.
pub(crate) fn admission_inputs_hold(phase: u32, prepared: &Observed, root_binding: &str, inventory: &Observed, state: &Observed) -> Result<()> {
    if inventory != prepared || state.directory_identity != root_binding {
        return Err(cadence::execution::admission::refuse(phase,"admission-inputs-changed","contract.plans","","installed PLAN inventory or root changed before confirmation"));
    }
    Ok(())
}

/// A native dispatch confirms only against the installed PLAN inventory it was
/// prepared from.
pub(crate) fn dispatch_inputs_hold(phase: u32, prepared: &Observed, inventory: &Observed) -> Result<()> {
    if inventory != prepared {
        return Err(cadence::execution::admission::refuse(phase,"admission-inputs-changed","contract.plans","","installed PLAN inventory changed before dispatch confirmation"));
    }
    Ok(())
}

struct Precondition {
    target: String,
    expected: Option<String>,
    installed: String,
    directory_identity: String,
}

impl Precondition {
    fn new(participant: &Participant) -> Self {
        Self {
            target: participant.target.clone(),
            expected: participant.expected.bytes.as_deref().map(model::digest),
            installed: model::digest(&participant.bytes),
            directory_identity: participant.expected.directory_identity.clone(),
        }
    }
}

fn validate_preconditions<S: Storage>(storage: &mut S, preconditions: &[Precondition], replay: bool) -> Result<()> {
    for precondition in preconditions {
        let actual = storage.read(&precondition.target)?;
        let digest = actual.bytes.as_deref().map(model::digest);
        let installed = replay && digest.as_ref() == Some(&precondition.installed);
        if actual.directory_identity != precondition.directory_identity
            || (digest != precondition.expected && !installed)
        {
            return Err(Error::Conflict(format!("pending participant changed: {}", precondition.target)));
        }
    }
    Ok(())
}

fn dispose<S: Storage>(
    storage: &mut S,
    prepared: Vec<(String, Vec<u8>, S::Prepared)>,
) -> Result<()> {
    let mut first = None;
    for (_, _, file) in prepared {
        if let Err(error) = storage.discard(file) {
            first.get_or_insert(error);
        }
    }
    first.map_or(Ok(()), Err)
}

pub(crate) fn commit<S: Storage, P: Policy>(
    storage: &mut S,
    policy: &mut P,
    context: &MutationContext<'_>,
    snapshot: &Snapshot,
    kind: IntentKind,
    participants: Vec<Participant>,
    process: &mut dyn Process,
) -> Result<()> {
    if storage.read(INTENT)?.bytes.is_some() {
        return Err(Error::Conflict(
            "pending operation requires recovery".into(),
        ));
    }
    validate_all(storage, &participants, false, &kind, Encoding::Digest, process)?;
    let preconditions = participants.iter().map(Precondition::new).collect::<Vec<_>>();
    let mut prepared = Vec::new();
    for participant in &participants {
        if participant.expected.bytes.as_ref() == Some(&participant.bytes) {
            continue;
        }
        match storage.prepare(&participant.target, &participant.bytes) {
            Ok(file) => {
                prepared.push((participant.target.clone(), participant.bytes.clone(), file))
            }
            Err(error) => {
                dispose(storage, prepared)?;
                return Err(error);
            }
        }
    }
    let mut intent = Intent::unfiltered(kind, participants);
    intent.validate_sealed(snapshot, process)?;
    intent.omit_unchanged();
    intent.integrity = intent.digest()?;
    let prospective = snapshot;
    let route = admission_route(&intent.kind, prospective)?;
    let bytes = serde_json::to_vec(&intent)?;
    let intent_file = match storage.prepare(INTENT, &bytes) {
        Ok(file) => file,
        Err(error) => {
            dispose(storage, prepared)?;
            return Err(error);
        }
    };
    if let Err(error) =
        validate_all(storage, &intent.participants, false, &intent.kind, intent.encoding, process)
        .and_then(|()| validate_preconditions(storage, &preconditions, false))
        .and_then(|()| match &route {
            Some(route) => policy.validate_routing_admission(
                &MutationContext {
                    operation: context.operation,
                    snapshot: prospective,
                },
                &route.inputs,
            ),
            None => policy.validate(context),
        })
    {
        storage.discard(intent_file)?;
        dispose(storage, prepared)?;
        return Err(error);
    }
    prune_stop(&intent.kind, "intent:before")?;
    let installed = storage.install(&intent_file);
    storage.discard(intent_file)?;
    if let Err(error) = installed.and_then(|()| storage.confirm(INTENT, &bytes).map(|_| ())) {
        dispose(storage, prepared)?;
        return Err(error);
    }
    prune_stop(&intent.kind, "intent:after")?;
    if let IntentKind::MilestonePruneV1 { prune } = &intent.kind {
        storage.install_prune(prune)?;
    }
    if let IntentKind::UndoV1 { write } = &intent.kind { storage.install_undo(write)?; }
    if let IntentKind::MilestoneReleaseV1 { write } = &intent.kind { storage.install_release(write)?; }
    let mut remaining = prepared.into_iter();
    while let Some((target, bytes, file)) = remaining.next() {
        // Check all participants again immediately before each replacement.
        prune_stop(&intent.kind, "record:before")?;
        let result = validate_all(storage, &intent.participants, true, &intent.kind, intent.encoding, process)
            .and_then(|()| validate_preconditions(storage, &preconditions, true))
            .and_then(|()| storage.install(&file))
            .and_then(|()| storage.confirm(&target, &bytes).map(|_| ()));
        storage.discard(file)?;
        if let Err(error) = result {
            dispose(storage, remaining.collect())?;
            return Err(error);
        }
        prune_stop(&intent.kind, "record:after")?;
    }
    // Snapshot is the final semantic participant and holds completion receipts.
    // Removing the intent and syncing its directory is part of completion.
    validate_all(storage, &intent.participants, true, &intent.kind, intent.encoding, process)?;
    validate_preconditions(storage, &preconditions, true)?;
    prune_stop(&intent.kind, "clear:before")?;
    storage.remove(INTENT)?;
    prune_stop(&intent.kind, "clear:after")
}

fn prune_stop(kind: &IntentKind, point: &str) -> Result<()> {
    if matches!(kind, IntentKind::MilestonePruneV1 { .. }) { crate::milestone::prune::stop(point)?; }
    Ok(())
}

/// An intent read back from the journal: parsed, with no field this binary
/// does not know, and its integrity checked.
pub struct Pending(Intent);

impl Pending {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        let intent: Intent = serde_json::from_slice(bytes)?;
        if serde_json::from_slice::<Value>(bytes)? != serde_json::to_value(&intent)? {
            return Err(Error::Invalid("unknown operation intent fields".into()));
        }
        intent.validate_integrity()?;
        Ok(Self(intent))
    }

    /// The targets recovery observes: every participant, and the item and
    /// decision journals an intent leaves out when it does not change them.
    pub fn targets(&self) -> BTreeSet<String> {
        self.0.participants.iter().map(|participant| participant.target.clone())
            .chain([ITEMS.to_owned(), DECISIONS.to_owned()]).collect()
    }
}

/// The unit a pending intent installs, and the snapshot it seals.
pub struct Recovery {
    intent: Intent,
    snapshot: Snapshot,
}

impl Recovery {
    /// What recovery writes, in the order it writes it: the state last.
    pub fn participants(&self) -> &[ExternalChange] {
        &self.intent.participants
    }
}

/// Whether `pending` can still be installed over `current`, each target as it
/// is now, and what it installs. A participant may be as the intent found it
/// or already installed, since an interruption can fall between any two
/// renames; any other bytes are a conflict.
pub fn recovery(pending: Pending, current: &BTreeMap<String, Observed>, process: &mut dyn Process) -> Result<Recovery> {
    let Pending(mut intent) = pending;
    let observed = |target: &str| current.get(target).cloned()
        .ok_or_else(|| Error::Invalid(format!("recovery target not observed: {target}")));
    let mut installed = false;
    if intent.encoding == Encoding::Digest {
        for participant in &mut intent.participants {
            let actual = observed(&participant.target)?;
            participant.validate_digest(&actual, true)?;
            if participant.installed(&actual, true) {
                installed = true;
            } else {
                participant.expected = actual;
            }
        }
    }
    for target in [ITEMS, DECISIONS] {
        if !intent.participants.iter().any(|participant| participant.target == target) {
            let expected = observed(target)?;
            intent.participants.push(Participant {
                target: target.into(), bytes: expected.bytes.clone().unwrap_or_default(), expected,
            });
        }
    }
    intent.participants.sort_by_key(|participant| match participant.target.as_str() {
        ITEMS => 1, DECISIONS => 2, STATE => 3, _ => 0,
    });
    let snapshot = if installed { intent.parse_contents()? } else { intent.validate_contents(process)? };
    for participant in &intent.participants {
        participant.validate_encoded(&observed(&participant.target)?, intent.encoding, true)?;
    }
    Ok(Recovery { intent, snapshot })
}

pub(crate) fn recover<S: Storage, P: Policy>(storage: &mut S, policy: &mut P, process: &mut dyn Process) -> Result<()> {
    let Some(bytes) = storage.read(INTENT)?.bytes else {
        return Ok(());
    };
    let pending = Pending::parse(&bytes)?;
    let mut current = BTreeMap::new();
    for target in pending.targets() {
        let observed = storage.read(&target)?;
        current.insert(target, observed);
    }
    let Recovery { intent, snapshot } = recovery(pending, &current, process)?;
    validate_all(storage, &intent.participants, true, &intent.kind, intent.encoding, process)?;
    policy.validate(&MutationContext {
        operation: if matches!(intent.kind, IntentKind::GuardAudit { .. }) {
            "guard_audit_recovery"
        } else {
            "recovery"
        },
        snapshot: &snapshot,
    })?;
    if let IntentKind::MilestonePruneV1 { prune } = &intent.kind {
        storage.install_prune(prune)?;
    }
    if let IntentKind::UndoV1 { write } = &intent.kind { storage.install_undo(write)?; }
    if let IntentKind::MilestoneReleaseV1 { write } = &intent.kind { storage.install_release(write)?; }
    for participant in &intent.participants {
        validate_all(storage, &intent.participants, true, &intent.kind, intent.encoding, process)?;
        let current = storage.read(&participant.target)?;
        if current.bytes.as_ref() == Some(&participant.bytes) {
            // Rename may have completed before its directory sync. Reconfirm
            // both file and directory even when no semantic update is needed.
            storage.resync(&participant.target, &participant.bytes)?;
        } else {
            let file = storage.prepare(&participant.target, &participant.bytes)?;
            let result = validate_all(storage, &intent.participants, true, &intent.kind, intent.encoding, process)
                .and_then(|()| storage.install(&file))
                .and_then(|()| {
                    storage
                        .confirm(&participant.target, &participant.bytes)
                        .map(|_| ())
                });
            storage.discard(file)?;
            result?;
        }
    }
    validate_all(storage, &intent.participants, true, &intent.kind, intent.encoding, process)?;
    storage.remove(INTENT)
}

#[cfg(test)]
mod provenance_tests {
    use super::*;
    use serde_json::json;

    fn kind(operation: &str) -> IntentKind {
        let scope = json!({"project":"/project","planning_root":"/project/.planning","cycle":"live",
            "occurrence":"one","phase":8,"worker":null,"plan":null});
        let mut value = json!({"operation":operation});
        match operation {
            "store" => {}
            "execution-dispatch" | "execution-refusal" => value["phase"] = json!(8),
            "execution-dispatch-v1" => {
                value["phase"] = json!(8);
                value["decision_id"] = json!("dispatch");
            }
            "execution-patch" => {
                value["phase"] = json!(8);
                value["render_version"] = json!(1);
                value["summary"] = json!(false);
            }
            "execution-patch-v1" => {
                value["phase"] = json!(8);
                value["decision_id"] = json!("patch");
                value["render_version"] = json!(1);
            }
            "boundary-observation-v1" => {
                value["scope"] = json!({"scope":"execution","phase":8});
                value["decision_id"] = json!("observation");
            }
            "execution-finalize-risk-v1" => {
                value["phase"] = json!(8);
                value["decision_id"] = json!("finalization");
                value["requirements"] = json!([]);
            }
            "guard-audit" => {
                value["audit"] = json!({
                    "event_id":"audit","command_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "cwd":"/project","project":"/project","verb":"commit","branch":null,"policy":null,
                    "outcome":"ask","unavailable":[],"reason":"fixture"
                })
            }
            "rail-observation" => {
                value["record"] = json!({
                    "observation":{"version":1,"request_id":"scan","request_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        "scope":scope,"source":{"kind":"committed","base":"HEAD~1","head":"HEAD"},
                        "resolution":{"kind":"committed","base_id":null,"head_id":null},
                        "outcome":"no-range","surfaces":[],"scan":null,"diagnostics":[]},
                    "confirmation":{"generation":1,"decision_id":"scan","observation_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
                })
            }
            "rail-receipt" => {
                value["record"] = json!({
                    "version":1,"fact":{"operation":"risk-fire","request_id":"fire","fire":{
                        "id":"fire","binding":{"boundary":{"scope":scope,"run_id":"one","after_generation":0},
                            "observation":{"generation":1,"decision_id":"scan","observation_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
                            "material":{"kind":"committed","base_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","head_id":"cccccccccccccccccccccccccccccccccccccccc"},"surfaces":[]},
                        "review_scope":[],"rearm_of":null}},
                    "confirmation":{"generation":2,"decision_id":"fire","fact_digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
                })
            }
            _ => unreachable!(),
        }
        serde_json::from_value(value).unwrap()
    }

    fn previous() -> Value {
        json!({"import":{"complete":true},"source_evidence":[{"source":{"path":"/old/config.json","bytes":[123,125]}}],
            "archive":{"available":true},"cursor":{"phase":8},"execution":{"old":true}})
    }

    macro_rules! variant {
        ($good:ident, $bad:ident, $name:literal) => {
            #[test]
            fn $good() {
                let proposed = json!({"import":{"complete":true},"source_evidence":[{"source":{"path":"/old/config.json","bytes":[123,125]}}],
                    "archive":{"available":true},"cursor":{"phase":8},"execution":{"new":true}});
                assert_eq!(kind($name).validate_provenance(&previous(), &proposed), Ok(()));
            }
            #[test]
            fn $bad() {
                let proposed = json!({"import":{"complete":true},"archive":{"available":true},"cursor":{"phase":8}});
                assert_eq!(kind($name).validate_provenance(&previous(), &proposed),
                    Err(Error::Invalid("snapshot replacement changed provenance: source_evidence".into())));
            }
        };
    }
    variant!(store_retains, store_refuses_loss, "store");
    variant!(
        dispatch_retains,
        dispatch_refuses_loss,
        "execution-dispatch"
    );
    variant!(patch_retains, patch_refuses_loss, "execution-patch");
    variant!(refusal_retains, refusal_refuses_loss, "execution-refusal");
    variant!(
        dispatch_v1_retains,
        dispatch_v1_refuses_loss,
        "execution-dispatch-v1"
    );
    variant!(
        patch_v1_retains,
        patch_v1_refuses_loss,
        "execution-patch-v1"
    );
    variant!(
        observation_retains,
        observation_refuses_loss,
        "boundary-observation-v1"
    );
    variant!(
        finalization_retains,
        finalization_refuses_loss,
        "execution-finalize-risk-v1"
    );
    variant!(audit_retains, audit_refuses_loss, "guard-audit");
    variant!(
        rail_observation_retains,
        rail_observation_refuses_loss,
        "rail-observation"
    );
    variant!(
        rail_receipt_retains,
        rail_receipt_refuses_loss,
        "rail-receipt"
    );

    #[test]
    fn wrapped_evidence_cannot_be_dropped_by_a_flattened_replacement() {
        assert_eq!(
            preserve_provenance(
                &json!({"import":{"complete":true},"current":{"source_evidence":[{"exact":[1,null]}]}}),
                &json!({"import":{"complete":true},"source_evidence":[{"exact":[1,null]}]})
            ),
            Err(Error::Invalid(
                "snapshot replacement changed provenance: source_evidence".into()
            ))
        );
    }
}

#[cfg(test)]
mod intent_encoding_tests {
    use super::*;
    use std::collections::BTreeMap;

    // An intent as the binary wrote it before GH-261: every participant's
    // bytes, old and new, as JSON integer arrays, and no encoding field.
    pub(super) const LEGACY: &str = r#"{"version":1,"kind":{"operation":"store"},"participants":[{"target":"items.jsonl","expected":{"bytes":[],"identity":"1:2:420","directory_identity":"1:1;"},"bytes":[]},{"target":"decisions.jsonl","expected":{"bytes":[],"identity":"1:2:420","directory_identity":"1:1;"},"bytes":[123,34,118,101,114,115,105,111,110,34,58,49,44,34,105,100,34,58,34,100,34,44,34,114,101,118,105,115,105,111,110,34,58,49,44,34,111,114,105,103,105,110,34,58,123,34,115,111,117,114,99,101,34,58,34,116,34,44,34,111,114,105,103,105,110,97,108,34,58,34,109,105,115,115,105,110,103,34,125,44,34,100,101,99,105,115,105,111,110,34,58,123,34,99,108,97,115,115,34,58,34,103,97,116,101,34,44,34,111,117,116,99,111,109,101,34,58,34,100,34,44,34,101,118,105,100,101,110,99,101,34,58,110,117,108,108,125,125,10]},{"target":"state.json","expected":{"bytes":[123,34,111,108,100,34,58,116,114,117,101,125],"identity":"1:2:420","directory_identity":"1:1;"},"bytes":[123,34,110,101,119,34,58,116,114,117,101,125]}],"integrity":"815a063018f8b7b1abb8ec163a37fc705e60463b24d0aee3700a0577827b0b9f"}"#;

    fn participants() -> Vec<Participant> {
        let expected = |bytes: &[u8]| Observed { bytes: Some(bytes.to_vec()), identity: "1:2:420".into(), directory_identity: "1:1;".into() };
        vec![
            Participant { target: ITEMS.into(), expected: expected(b""), bytes: b"".to_vec() },
            Participant { target: DECISIONS.into(), expected: expected(b""),
                bytes: b"{\"version\":1,\"id\":\"d\",\"revision\":1,\"origin\":{\"source\":\"t\",\"original\":\"missing\"},\"decision\":{\"class\":\"gate\",\"outcome\":\"d\",\"evidence\":null}}\n".to_vec() },
            Participant { target: STATE.into(), expected: expected(b"{\"old\":true}"), bytes: b"{\"new\":true}".to_vec() },
        ]
    }

    struct Memory(BTreeMap<String, Observed>);
    impl Storage for Memory {
        type Prepared = (String, Vec<u8>);
        fn read(&mut self, target: &str) -> Result<Observed> {
            Ok(self.0.get(target).cloned().unwrap_or(Observed {
                bytes: None, identity: "missing".into(), directory_identity: "1:1;".into(),
            }))
        }
        fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
            Ok((target.into(), bytes.to_vec()))
        }
        fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
            let observed = self.0.entry(prepared.0.clone()).or_insert(Observed {
                bytes: None, identity: "missing".into(), directory_identity: "1:1;".into(),
            });
            observed.bytes = Some(prepared.1.clone());
            Ok(())
        }
        fn discard(&mut self, _: Self::Prepared) -> Result<()> { Ok(()) }
        fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
            let observed = self.read(target)?;
            if observed.bytes.as_deref() != Some(bytes) { return Err(Error::Io("not installed".into())); }
            Ok(observed)
        }
        fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
            self.confirm(target, bytes)
        }
        fn remove(&mut self, target: &str) -> Result<()> {
            self.0.remove(target);
            Ok(())
        }
    }
    struct Allow;
    impl Policy for Allow {
        fn validate(&mut self, _: &MutationContext<'_>) -> Result<()> { Ok(()) }
    }

    fn state_only_participants() -> Vec<Participant> {
        let old_state = Snapshot::new(1, b"", b"", serde_json::json!({"value": 1})).unwrap().render().unwrap();
        let new_state = Snapshot::new(2, b"", b"", serde_json::json!({"value": 2})).unwrap().render().unwrap();
        let expected = |bytes: Vec<u8>| Observed {
            bytes: Some(bytes), identity: "1:2:420".into(), directory_identity: "1:1;".into(),
        };
        vec![
            Participant { target: ITEMS.into(), expected: expected(Vec::new()), bytes: Vec::new() },
            Participant { target: DECISIONS.into(), expected: expected(Vec::new()), bytes: Vec::new() },
            Participant { target: STATE.into(), expected: expected(old_state), bytes: new_state },
        ]
    }

    // GH-261: the intent journal carried every participant's bytes as integer
    // arrays, 766MB per write on this project. A new intent writes UTF-8
    // bytes as strings and says so; an intent written before that is read,
    // checked and written back exactly as it was.
    #[test]
    fn a_legacy_array_intent_keeps_its_integrity_and_is_written_back_as_read() {
        let legacy: Intent = serde_json::from_str(LEGACY).unwrap();
        assert_eq!(legacy.integrity, legacy.digest().unwrap(), "a legacy intent keeps its integrity");
        assert_eq!(serde_json::to_value(&legacy).unwrap(), serde_json::from_str::<Value>(LEGACY).unwrap(), "written back as read");
        assert_eq!(legacy.participants.len(), 3);
        assert_eq!(legacy.participants[2].expected.bytes.as_deref(), Some(&b"{\"old\":true}"[..]));
        assert_eq!(legacy.participants[2].bytes, b"{\"new\":true}");
    }

    #[test]
    fn a_fresh_intent_writes_utf8_participant_bytes_as_text() {
        let mut fresh = Intent::new(IntentKind::Store, participants());
        fresh.integrity = fresh.digest().unwrap();
        let written = serde_json::to_string(&fresh).unwrap();
        let value: Value = serde_json::from_str(&written).unwrap();
        assert_eq!(value["encoding"], "text", "{written}");
        assert_eq!(value["participants"][2]["expected"]["bytes"], "{\"old\":true}");
        assert_eq!(value["participants"][2]["bytes"], "{\"new\":true}");
        assert!(!written.contains("[123,"), "integer arrays in a text intent: {written}");
        let read: Intent = serde_json::from_str(&written).unwrap();
        assert_eq!(read.integrity, read.digest().unwrap());
        assert_eq!(read.participants.iter().map(|p| (&p.target, &p.expected, &p.bytes)).collect::<Vec<_>>(),
            fresh.participants.iter().map(|p| (&p.target, &p.expected, &p.bytes)).collect::<Vec<_>>());
        assert_eq!(serde_json::to_value(&read).unwrap(), value, "written back as read");
    }

    #[test]
    fn non_utf8_participant_bytes_stay_an_integer_array_inside_a_text_intent() {
        let mut binary = participants();
        binary[2].bytes = vec![0xff, 0xfe, b'{'];
        let mut intent = Intent::new(IntentKind::Store, binary);
        intent.integrity = intent.digest().unwrap();
        let value: Value = serde_json::from_str(&serde_json::to_string(&intent).unwrap()).unwrap();
        assert_eq!(value["participants"][2]["bytes"], serde_json::json!([255, 254, 123]));
        assert_eq!(value["participants"][2]["expected"]["bytes"], "{\"old\":true}");
        let read: Intent = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(read.participants[2].bytes, vec![0xff, 0xfe, b'{']);
        assert_eq!(read.integrity, read.digest().unwrap());
    }

    // GH-261: a write that changes only the snapshot journals only that
    // participant.
    #[test]
    fn a_state_only_intent_carries_only_the_state_participant() {
        let fresh = Intent::new(IntentKind::Store, state_only_participants());
        assert_eq!(fresh.participants.len(), 1);
        assert_eq!(fresh.participants[0].target, STATE);
    }

    // GH-261: an older journal, three participants each carrying its full
    // prior bytes as integer arrays, still replays to the new state.
    #[test]
    fn a_legacy_three_participant_full_byte_intent_recovers_to_the_new_state() {
        let participants = state_only_participants();
        let mut legacy = Intent {
            version: VERSION, kind: IntentKind::Store, participants: participants.clone(),
            integrity: String::new(), encoding: Encoding::Array,
        };
        legacy.integrity = legacy.digest().unwrap();
        let legacy_bytes = serde_json::to_vec(&legacy).unwrap();
        let mut files = participants.iter().map(|participant|
            (participant.target.clone(), participant.expected.clone())).collect::<BTreeMap<_, _>>();
        files.insert(INTENT.into(), Observed {
            bytes: Some(legacy_bytes), identity: "1:3:420".into(), directory_identity: "1:1;".into(),
        });
        let mut storage = Memory(files);
        recover(&mut storage, &mut Allow, &mut crate::process::Recorded::new()).unwrap();
        assert_eq!(storage.0[STATE].bytes.as_ref(), Some(&participants[2].bytes));
        assert!(!storage.0.contains_key(INTENT));
    }

    // GH-261: a new journal identifies the prior file by digest rather than
    // carrying its bytes.
    #[test]
    fn a_fresh_intent_identifies_the_prior_file_by_digest_without_its_bytes() {
        let participants = state_only_participants();
        let old_state = participants[2].expected.bytes.as_deref().unwrap();
        let mut fresh = Intent::unfiltered(IntentKind::Store, participants.clone());
        fresh.omit_unchanged();
        fresh.integrity = fresh.digest().unwrap();
        let value = serde_json::to_value(&fresh).unwrap();
        let expected = value["participants"][0]["expected"].as_object().unwrap();
        assert!(!expected.contains_key("bytes"), "fresh intent retained its preimage: {value}");
        assert_eq!(expected["digest"], model::digest(old_state));
    }
}

#[cfg(test)]
mod recovery_rule_tests {
    //! What recovery accepts or refuses in a pending intent, over intents
    //! sealed by hand: nothing here reads a file.
    use super::*;
    use crate::process::Recorded;
    use cadence::envelope::Envelope;
    use cadence::execution::boundary::{BoundaryScope, BoundaryV1, PreparedAnswer};
    use cadence::execution::model::{BoundaryTool, EXECUTION_SCHEMA, ExecutionOccurrence, ExecutionSnapshot};
    use serde_json::json;
    use std::collections::BTreeMap;

    fn participant(target: &str, bytes: &[u8]) -> Participant {
        Participant {
            target: target.into(),
            expected: Observed { bytes: None, identity: "1:2:420".into(), directory_identity: "1:1;".into() },
            bytes: bytes.to_vec(),
        }
    }

    fn sealed(kind: IntentKind, participants: Vec<Participant>) -> Intent {
        let mut intent = Intent::new(kind, participants);
        intent.integrity = intent.digest().unwrap();
        intent
    }

    fn journals(decisions: &[u8]) -> Vec<Participant> {
        vec![participant(ITEMS, b""), participant(DECISIONS, decisions), participant(STATE, b"{}")]
    }

    /// One way to alter an intent as the journal holds it.
    type Alteration = Box<dyn Fn(&mut Value)>;

    /// `intent` as the journal holds it, altered each way in turn: every one refuses.
    fn assert_each_alteration_refused(intent: &Value, bytes_of_state: Value) {
        let alterations: Vec<Alteration> = vec![
            Box::new(|intent| intent["version"] = json!(99)),
            Box::new(|intent| intent["kind"] = json!({"operation": "execution-refusal", "phase": 3})),
            Box::new(|intent| intent["unknown"] = json!(true)),
            Box::new(|intent| intent["kind"]["unknown"] = json!(true)),
            Box::new(move |intent| intent["participants"][2]["bytes"] = bytes_of_state.clone()),
        ];
        for alter in alterations {
            let mut altered = intent.clone();
            alter(&mut altered);
            assert!(Pending::parse(&serde_json::to_vec(&altered).unwrap()).is_err(), "{altered}");
        }
    }

    #[test]
    fn a_sealed_intent_altered_in_its_version_kind_fields_or_participants_is_refused() {
        let good = serde_json::to_value(sealed(IntentKind::Store, journals(b""))).unwrap();
        assert!(Pending::parse(&serde_json::to_vec(&good).unwrap()).is_ok());
        assert_each_alteration_refused(&good, json!("{\"changed\":true}"));
    }

    #[test]
    fn a_legacy_intent_altered_in_its_version_kind_fields_or_participants_is_refused() {
        let legacy = super::intent_encoding_tests::LEGACY;
        assert!(Pending::parse(legacy.as_bytes()).is_ok());
        assert_each_alteration_refused(&serde_json::from_str(legacy).unwrap(), json!([123, 125]));
    }

    fn refusal(scope: BoundaryScope, name: &str) -> BoundaryV1 {
        let answer = PreparedAnswer::new(Envelope::Refused { code: "refused".into(), reason: name.into() }).unwrap();
        BoundaryV1::new(scope, BoundaryTool::CadenceApply, "executor".into(), model::digest(name.as_bytes()), None, &answer)
    }

    fn record(boundary: BoundaryV1, store_generation: u64, terminal: bool) -> DecisionRecord {
        DecisionRecord {
            version: model::VERSION,
            id: boundary.identity().unwrap(),
            revision: 1,
            origin: model::Origin { source: "execution-boundary-v1".into(), original: model::Evidence::Missing },
            decision: model::Decision::BoundaryV1(model::BoundaryRecordV1 { boundary, store_generation, terminal }),
            at: Some(1),
        }
    }

    fn log(records: &[DecisionRecord]) -> Vec<u8> {
        records.iter().map(|record| serde_json::to_string(record).unwrap() + "\n").collect::<String>().into_bytes()
    }

    fn observation(scope: BoundaryScope, id: &str, participants: Vec<Participant>) -> Intent {
        sealed(IntentKind::BoundaryObservationV1 { scope, decision_id: id.into() }, participants)
    }

    fn at(generation: u64) -> Snapshot {
        Snapshot::new(generation, b"", b"", json!({})).unwrap()
    }

    #[test]
    fn a_refusal_observation_intent_with_its_logged_decision_is_accepted() {
        let decision = record(refusal(BoundaryScope::RootRefusal, "r"), 5, false);
        let intent = observation(BoundaryScope::RootRefusal, &decision.id, journals(b""));
        assert_eq!(intent.validate_boundary_v1(&at(5), &log(&[decision]), None), Ok(()));
    }

    #[test]
    fn a_terminal_observation_intent_is_accepted() {
        let scope = BoundaryScope::Execution { phase: 3 };
        let mut records: Vec<DecisionRecord> = (0..256)
            .map(|index| record(refusal(scope.clone(), &format!("r{index}")), index as u64 + 1, false))
            .collect();
        records.push(record(BoundaryV1::terminal(scope.clone()).unwrap(), 257, true));
        let intent = observation(scope, &records[256].id, journals(b""));
        assert_eq!(intent.validate_boundary_v1(&at(257), &log(&records), None), Ok(()));
    }

    #[test]
    fn an_intent_naming_another_decision_scope_or_generation_is_refused() {
        let decision = record(refusal(BoundaryScope::RootRefusal, "r"), 5, false);
        let decisions = log(std::slice::from_ref(&decision));
        for (intent, generation) in [
            (observation(BoundaryScope::RootRefusal, "another", journals(b"")), 5),
            (observation(BoundaryScope::Execution { phase: 3 }, &decision.id, journals(b"")), 5),
            (observation(BoundaryScope::RootRefusal, &decision.id, journals(b"")), 6),
        ] {
            assert!(intent.validate_boundary_v1(&at(generation), &decisions, None).is_err());
        }
    }

    #[test]
    fn an_observation_intent_with_a_config_summary_or_extra_participant_is_refused() {
        let decision = record(refusal(BoundaryScope::RootRefusal, "r"), 5, false);
        let decisions = log(std::slice::from_ref(&decision));
        let mut extra = journals(b"");
        extra.insert(0, participant("phase-summary:3", b"# Summary"));
        for (participants, summary) in [
            (vec![participant("repo-config", b"{}"), participant(DECISIONS, b""), participant(STATE, b"{}")], None),
            (journals(b""), Some(3)),
            (extra, None),
        ] {
            let intent = observation(BoundaryScope::RootRefusal, &decision.id, participants);
            assert!(intent.validate_boundary_v1(&at(5), &decisions, summary).is_err());
        }
    }

    #[test]
    fn an_intent_participant_outside_the_store_files_is_refused() {
        let mut participants = journals(b"");
        participants.insert(0, participant("../escape", b"x"));
        let intent = sealed(IntentKind::Store, participants);
        assert!(intent.validate_sealed(&at(1), &mut Recorded::new()).is_err());
    }

    #[test]
    fn a_store_intent_carrying_a_phase_summary_is_refused() {
        let mut participants = journals(b"");
        participants.insert(0, participant("phase-summary:3", b"# Summary"));
        let intent = sealed(IntentKind::Store, participants);
        assert!(intent.validate_sealed(&at(1), &mut Recorded::new()).is_err());
    }

    #[test]
    fn a_rail_receipt_intent_adding_only_its_projection_is_accepted() {
        use cadence::rail::receipts::{Apply, Binding, Boundary, Fire, RecordedFact};
        use cadence::rail::risk::{self, Recorded as Scan};
        let scan = Scan::new(serde_json::from_value(json!({
            "version":1, "request_id":"scan-2", "request_digest":"a".repeat(64),
            "scope":{"project":"/tmp/project","planning_root":"/tmp/project/.planning",
                "cycle":"live","occurrence":"run-one","phase":7,"worker":"4","plan":null},
            "source":{"kind":"committed","base":"HEAD~1","head":"HEAD"},
            "resolution":{"kind":"committed","base_id":"b".repeat(40),"head_id":"c".repeat(40)},
            "outcome":"checked", "surfaces":["auth"],
            "scan":{"checked":true,"categories":["auth"],"matches":[{"category":"auth","signal":"path segment auth"}],
                "inconclusive":false,"empty":false}, "diagnostics":[]
        })).unwrap(), 2).unwrap();
        let boundary = Boundary { scope: scan.observation.scope.clone(), run_id: "run-one".into(), after_generation: 1 };
        let fire = Fire { id: "fire-2".into(), binding: Binding::new(boundary, &scan).unwrap(), review_scope: vec!["auth/login.rs".into()], rearm_of: None };
        let record = RecordedFact::new(Apply::Fire { request_id: "fire-request".into(), fire: Box::new(fire) }, 3).unwrap();
        let old_data = risk::project(&json!({}), &scan).unwrap();
        let (_, old_state) = Snapshot::sealed(2, b"", b"", old_data.clone(), BTreeMap::new()).unwrap();
        let decisions = model::render_lines(&[super::super::writer::rail_fact_record(&record).unwrap()]).unwrap();
        let new_data = cadence::rail::receipts::project(&old_data, &record).unwrap();
        let (snapshot, new_state) = Snapshot::sealed(3, b"", &decisions, new_data, BTreeMap::new()).unwrap();
        let before = |bytes: &[u8]| Observed { bytes: Some(bytes.to_vec()), identity: "1:2:420".into(), directory_identity: "1:1;".into() };
        let participants = vec![
            Participant { target: ITEMS.into(), expected: before(b""), bytes: b"".to_vec() },
            Participant { target: DECISIONS.into(), expected: before(b""), bytes: decisions },
            Participant { target: STATE.into(), expected: before(&old_state), bytes: new_state },
        ];
        let intent = sealed(IntentKind::RailReceipt { record: Box::new(record) }, participants);
        assert_eq!(intent.validate_rail_receipt(&snapshot), Ok(()));
    }

    /// A legacy boundary decision for phase 3 written at generation 1.
    fn legacy_decision() -> Vec<u8> {
        let digest = "a".repeat(64);
        let record = DecisionRecord {
            version: model::VERSION,
            id: digest.clone(),
            revision: 1,
            origin: model::Origin { source: "execution-boundary".into(), original: model::Evidence::Missing },
            decision: model::Decision::Boundary {
                phase: 3, tool: "cadence-apply".into(), operation: "execution-refusal".into(),
                request_digest: digest.clone(), outcome: "refused".into(), subject_id: None,
                store_generation: 1, prompt_digest: None, response_digest: digest, terminal: false,
            },
            at: Some(1),
        };
        log(&[record])
    }

    /// The store at generation 1 holding `data` and the legacy decision, and
    /// its journal participants.
    fn legacy_store(data: Value) -> (Snapshot, Vec<Participant>) {
        let decisions = legacy_decision();
        let (snapshot, state) = Snapshot::sealed(1, b"", &decisions, data, BTreeMap::new()).unwrap();
        let participants = vec![participant(ITEMS, b""), participant(DECISIONS, &decisions), participant(STATE, &state)];
        (snapshot, participants)
    }

    #[test]
    fn a_legacy_refusal_intent_with_its_generation_boundary_decision_is_accepted() {
        let (snapshot, participants) = legacy_store(json!({}));
        let intent = sealed(IntentKind::ExecutionRefusal { phase: 3 }, participants);
        assert_eq!(intent.validate_sealed(&snapshot, &mut Recorded::new()), Ok(()));
    }

    #[test]
    fn a_legacy_execution_intent_without_its_generation_boundary_decision_is_refused() {
        let intent = sealed(IntentKind::ExecutionRefusal { phase: 3 }, journals(b""));
        assert!(intent.validate_sealed(&at(1), &mut Recorded::new()).is_err());
    }

    #[test]
    fn a_legacy_patch_intent_with_its_rendered_summary_is_accepted() {
        let execution = ExecutionSnapshot {
            schema: EXECUTION_SCHEMA,
            occurrences: BTreeMap::from([("3".into(), ExecutionOccurrence {
                phase: 3, undone: None, plan_set_fingerprint: "f".repeat(64), version: 1, active: None,
                plans: vec![], terminal: None, receipts: BTreeMap::new(), issues: BTreeMap::new(),
            })]),
        };
        let summary = cadence::execution::render::render_phase_summary(&execution, 3).unwrap();
        let (snapshot, mut participants) = legacy_store(json!({"execution": execution}));
        participants.insert(0, participant("phase-summary:3", &summary));
        let kind = IntentKind::ExecutionPatch {
            phase: 3,
            render_version: cadence::execution::render::SUMMARY_RENDER_VERSION,
            summary: true,
        };
        assert_eq!(sealed(kind, participants).validate_sealed(&snapshot, &mut Recorded::new()), Ok(()));
    }
}

