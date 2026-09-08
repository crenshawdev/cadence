//! Saved H1–H5 vocabulary. These records describe observations, never clearance.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Contract {
    pub schema: String,
    pub interpretation: String,
    pub validator: String,
}
impl Contract {
    pub fn current() -> Self {
        Self {
            schema: "review-1".into(),
            interpretation: "H1-H5".into(),
            validator: "H4-1".into(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scope {
    pub project: String,
    pub root: String,
    pub cycle: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HomeKind {
    Phase,
    Task,
    RootInline,
    RootDebug,
    RootDiagnosis,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Home {
    pub kind: HomeKind,
    pub id: String,
    pub occurrence: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Gate {
    Off,
    Advisory,
    Deferred,
    Blocking,
    Adjudicated,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SelectionMode {
    Single,
    Panel,
    Adjudicated,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Selection {
    pub mode: SelectionMode,
    pub choices: Vec<String>,
    pub fallback: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Routing {
    pub answer: String,
    pub evidence: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CompletionRule {
    AllRequiredTerminal,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Roster {
    pub required: Vec<String>,
    pub completion: CompletionRule,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Settlement {
    Pending,
    NotApplicable,
    Verified,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Specialist {
    Minimalism,
    Decision,
    Diagnosis,
}
/// The exact H admission. Delivery lives separately so replay does not rewrite H.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Admission {
    pub fire: String,
    pub replay_key: String,
    pub scope: Scope,
    pub home: Home,
    pub caller: String,
    pub trigger: Option<String>,
    pub specialist: Option<Specialist>,
    pub discriminator: String,
    pub plan: Option<String>,
    pub anchor: Option<String>,
    pub round: u64,
    pub artifact: String,
    pub gate: Option<Gate>,
    pub selection: Selection,
    pub routing: Option<Routing>,
    pub roster: Roster,
    pub contract: Contract,
    pub settlement: Settlement,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Target {
    CommittedRange {
        base: String,
        head: String,
    },
    StagedTree {
        base: String,
        index: String,
        head: Option<String>,
    },
    NamedFile {
        path: String,
        head: Option<String>,
    },
    Directory {
        path: String,
        members: Vec<String>,
    },
    PhaseRange {
        phase: String,
        base: String,
        head: String,
    },
    Decision {
        selected: String,
        context_entries: Vec<String>,
    },
    Diagnosis {
        paths: Vec<String>,
        reported: String,
        cause: String,
    },
    InlineText {
        label: String,
    },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MaterialRole {
    Primary,
    Supporting,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Side {
    Base,
    Head,
    Snapshot,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Availability {
    Available,
    Absent,
    Unavailable,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineMap {
    pub line: u64,
    pub start: u64,
    pub end: u64,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceReference {
    pub entry: String,
    pub path: String,
    pub side: Side,
    pub line: u64,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct HunkMap {
    pub diff_line: u64,
    pub source: SourceReference,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MaterialProvenance {
    OriginalView,
    LaterEvidence,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MaterialEntry {
    pub entry: String,
    pub role: MaterialRole,
    pub path: Option<String>,
    pub label: Option<String>,
    pub side: Side,
    pub availability: Availability,
    pub unavailable_reason: Option<String>,
    pub content: Option<String>,
    pub retained: Option<String>,
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub lines: Vec<LineMap>,
    pub hunks: Vec<HunkMap>,
    pub acquisition: String,
    pub acquired_at: u64,
    pub provenance: MaterialProvenance,
    pub attempt: Option<String>,
    pub view: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifest {
    pub manifest: String,
    pub fire: String,
    pub contract: Contract,
    pub target: Target,
    pub entries: Vec<MaterialEntry>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MaterialView {
    pub view: String,
    pub manifest: String,
    pub entries: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AttemptState {
    Intended,
    ObservedRunning,
    Interrupted,
    Uncertain,
    Accepted,
    Failed,
    NotSelected,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeliveryState {
    Pending,
    Interrupted,
    Failed,
    Accepted,
    AcceptedEmpty,
    UsableComplete,
    CompleteWithFailure,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RequestedVoice {
    pub agent: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub routing: Option<Routing>,
    pub selection_evidence: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Usage {
    pub input: Option<u64>,
    pub output: Option<u64>,
    pub cost: Option<String>,
    pub currency: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Attempt {
    pub attempt: String,
    pub fire: String,
    pub occurrence: String,
    pub round: u64,
    pub slot: String,
    pub fallback_for: Option<String>,
    pub view: MaterialView,
    pub requested: RequestedVoice,
    pub observed_host: Option<String>,
    pub observed_model: Option<String>,
    pub launch: Option<String>,
    pub host_return: Option<String>,
    pub state: AttemptState,
    pub failure: Option<String>,
    pub original: Option<String>,
    pub observations: Vec<String>,
    pub usage: Usage,
    pub contract: Contract,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ObservationKind {
    LaunchFailure,
    Launch,
    Return,
    Interrupted,
    Usage,
    HostFacts,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Observation {
    pub observation: String,
    pub attempt: String,
    pub launch: Option<String>,
    pub host_return: Option<String>,
    pub kind: ObservationKind,
    pub reference: String,
    pub observed_at: u64,
    pub host: Option<String>,
    pub model: Option<String>,
    pub usage: Usage,
    pub contract: Contract,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Blocker,
    High,
    Medium,
    Low,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Finding {
    pub file: String,
    pub line: u64,
    pub severity: Severity,
    pub claim: String,
    pub failure_scenario: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Findings {
    pub findings: Vec<Finding>,
}
/// Identity is the original record plus zero-based position; never a text hash.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FindingId {
    pub original: String,
    pub index: usize,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Citation {
    pub finding: FindingId,
    pub submitted: Option<SourceReference>,
    pub unresolved_reason: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Closure {
    pub attempt: String,
    pub original: Option<String>,
    pub terminal: AttemptState,
    pub acknowledged_at: u64,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum Acceptance {
    Accepted,
    Rejected { reason: String },
    Unverified { reason: String },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Original {
    pub original: String,
    pub content: String,
    pub contract: Contract,
    pub raw: Vec<u8>,
    pub parsed: Option<Findings>,
    pub attempt: Option<String>,
    pub host_return: Option<String>,
    pub artifact: Option<String>,
    pub view: Option<String>,
    pub acceptance: Acceptance,
    pub closure: Option<Closure>,
    pub citations: Vec<Citation>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct References {
    pub fire: String,
    pub manifest: String,
    pub attempt: String,
    pub original: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeferredMember {
    pub member: String,
    pub home: Home,
    pub references: Vec<References>,
    pub enqueued_at: u64,
    pub contract: Contract,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ViewKind {
    Raw,
    ProvisionalSelected,
    Settled,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsumerView {
    pub kind: ViewKind,
    pub revision: u64,
    pub fire: String,
    pub round: u64,
    pub originals: Vec<String>,
    pub finding_ids: Vec<FindingId>,
    pub fix: Option<String>,
    pub adjudication: Option<String>,
    pub rendering: Option<String>,
    pub contract: Contract,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecoveredReview {
    pub admission: Admission,
    pub manifest: Manifest,
    pub attempts: Vec<Attempt>,
    pub originals: Vec<Original>,
    pub observations: Vec<Observation>,
    pub delivery: DeliveryState,
    pub deferred: Option<DeferredMember>,
    pub views: Vec<ConsumerView>,
}
