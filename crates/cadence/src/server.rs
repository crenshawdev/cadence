//! Root-bound MCP adapter. Raw tool arguments are validated inside Cadence.

use cadence::execution::{
    boundary::ExecutionEnvelope,
    model::{BoundaryTool, ExecutorPatch},
};
use rmcp::handler::server::wrapper::Json;
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerInfo, Tool,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData, RoleServer, ServerHandler};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    borrow::Cow,
    collections::{BTreeMap, BTreeSet},
    num::NonZeroU32,
    path::{Path, PathBuf},
    sync::{Arc, LazyLock},
};

use cadence::envelope::{Envelope, Refusal};

// Internal query surface; public MCP registration belongs to phase 5.
#[allow(dead_code)]
#[path = "recall/mod.rs"]
pub mod recall;

#[allow(dead_code)]
#[path = "derivation_service.rs"]
pub mod derivation_service;

#[allow(dead_code)]
#[path = "evidence_service.rs"]
pub mod evidence_service;
#[cfg(test)]
#[path = "evidence_service_tests.rs"]
mod evidence_service_tests;

#[allow(dead_code)]
#[path = "next_action_service.rs"]
pub mod next_action_service;

#[path = "progress_service.rs"]
pub mod progress_service;
#[path = "suggest_service.rs"]
pub mod suggest_service;
#[path = "why_service.rs"]
pub mod why_service;
#[path = "milestone_service.rs"]
pub mod milestone_service;
#[path = "landing_service.rs"]
pub mod landing_service;
#[path = "undo_service.rs"]
pub mod undo_service;
#[path = "debug_service.rs"]
pub mod debug_service;
#[path = "spike_service.rs"]
pub mod spike_service;
#[path = "task_service.rs"]
pub mod task_service;
#[cfg(test)]
#[path = "next_action_service_tests.rs"]
mod next_action_service_tests;

#[allow(dead_code)]
#[path = "pause_service.rs"]
pub mod pause_service;

#[allow(dead_code)]
#[path = "execution_service.rs"]
pub mod execution_service;
#[path = "execution_runner_service.rs"]
pub mod execution_runner_service;
#[cfg(test)]
#[path = "execution_service_tests.rs"]
mod execution_service_tests;

#[path = "rail_service.rs"]
pub mod rail_service;

#[path = "config_service_binary.rs"]
pub mod config_service;

#[path = "review_service.rs"]
pub mod review_service;

#[path = "context_service.rs"]
pub mod context_service;

#[path = "plan_service.rs"]
pub mod plan_service;
#[path = "verification_service.rs"]
pub mod verification_service;
#[path = "adoption_service.rs"]
pub mod adoption_service;
#[path = "capture_service.rs"]
pub mod capture_service;
#[path = "read_service.rs"]
pub mod read_service;

/// What `cadence_version` reports on success.
///
/// A struct rather than a bare string because an `ok` envelope's payload sits
/// beside the `status` tag at the top level, so it has to have named fields
/// (see `envelope::Envelope`). Three of them, and each answers a different
/// question a user actually asks when a session behaves unexpectedly: which
/// release, and which of the four release archives.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct VersionReport {
    /// The crate version of the running binary, matching the release tag it
    /// was cut from.
    pub version: String,
    /// The operating system this binary was built for: `linux` or `macos`.
    pub os: String,
    /// The CPU architecture this binary was built for: `x86_64` or `aarch64`.
    pub arch: String,
}

/// One resident and one startup-bound planning root per public session.
#[derive(Clone)]
pub struct CadenceServer {
    service: recall::Resident,
}

#[allow(dead_code)]
impl CadenceServer {
    pub async fn pause(
        &self,
        input: cadence::pause::Input,
    ) -> cadence::store::Result<pause_service::Response> {
        self.service.pause(input).await
    }
    pub async fn next_action(
        &self,
        root: &std::path::Path,
    ) -> Result<Option<cadence::next_action::Action>, cadence::derivation::DerivationError> {
        self.service.next_action(root).await
    }

    pub fn with_factory<I: crate::config::reload::ConfigIo + Clone + Sync>(
        factory: crate::import::SessionFactory<I>,
    ) -> Self {
        Self {
            service: recall::Resident::spawn(factory),
        }
    }

    pub async fn evidence(
        &self,
        root: &std::path::Path,
        command: evidence_service::Command,
    ) -> cadence::store::Result<evidence_service::Recovery> {
        self.service.evidence(root, command).await
    }

    pub async fn lifecycle(
        &self,
        root: &std::path::Path,
    ) -> Result<cadence::derivation::Lifecycle, cadence::derivation::DerivationError> {
        self.service.lifecycle(root).await
    }

    pub async fn store(
        &self,
        root: &std::path::Path,
        operation: cadence::store::writer::Operation,
    ) -> cadence::store::Result<cadence::store::writer::View> {
        self.service.store(root, operation).await
    }

    pub async fn recall(
        &self,
        root: &std::path::Path,
        query: &str,
        limit: Option<i64>,
    ) -> cadence::store::Result<recall::Answer> {
        self.service.recall(root, query, limit).await
    }

    pub async fn refuse_execution_arguments(
        &self,
        root: &std::path::Path,
        tool: cadence::execution::model::BoundaryTool,
        raw: Option<serde_json::Value>,
        failure: execution_service::ValidationFailure,
    ) -> execution_service::Answer {
        self.service
            .refuse_execution_arguments(root, tool, raw, failure)
            .await
    }

    pub async fn query_execution(
        &self,
        root: &std::path::Path,
        phase: u32,
    ) -> execution_service::Answer {
        self.service.query_execution(root, phase).await
    }

    pub async fn query_selected_execution(
        &self,
        root: &std::path::Path,
        phase: u32,
        plan: Option<NonZeroU32>,
    ) -> execution_service::Answer {
        self.service.query_selected_execution(root, phase, plan).await
    }

    pub async fn apply_executor_patch(
        &self,
        root: &std::path::Path,
        patch: cadence::execution::model::ExecutorPatch,
    ) -> execution_service::Answer {
        self.service.apply_executor_patch(root, patch).await
    }
}

impl CadenceServer {
    pub fn new() -> Self {
        let global = std::env::var_os("CADENCE_GLOBAL_CONFIG")
            .map(std::path::PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME")
                    .map(|home| std::path::PathBuf::from(home).join(".claude/cadence/config.json"))
            })
            .filter(|path| !path.as_os_str().is_empty());
        // These internal operations only own planning storage. Forge and
        // dispatch policy are evaluated by their later operation surfaces.
        Self::with_factory(crate::import::SessionFactory::new(
            global,
            std::sync::Arc::new(crate::config::planning_policy),
        ))
    }

    async fn cadence_version(&self) -> Result<Json<Envelope<VersionReport>>, ErrorData> {
        // `Json` rather than a text block: the envelope is the answer, so it
        // rides `structuredContent` where a caller can branch on `status`
        // (D-07). The tool returns `structuredContent` without declaring an
        // `outputSchema`.
        //
        // Read from this binary's own compile-time constants, never from a
        // manifest on disk: the question is which binary is serving, and a
        // file beside it can be from a different install.
        Ok(Json(Envelope::Ok(VersionReport {
            version: env!("CARGO_PKG_VERSION").to_string(),
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
        })))
    }
}

#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct VersionArguments {}

#[derive(Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
enum QueryArguments {
    #[serde(rename = "help")]
    Help { name: Option<String> },
    #[serde(rename = "recall")]
    Recall { query: String, limit: Option<std::num::NonZeroU32>, phase: Option<NonZeroU32> },
    #[serde(rename = "debug-list")]
    DebugList {},
    #[serde(rename = "debug-status")]
    DebugStatus { slug: String },
    #[serde(rename = "debug-continue")]
    DebugContinue { slug: String },
    #[serde(rename = "undo-read")]
    UndoRead { phase: NonZeroU32 },
    #[serde(rename = "milestone-read")]
    MilestoneRead { occurrence: String, selection: cadence::milestone::model::Selection },
    #[serde(rename = "land-read")]
    LandRead { landing: String },
    #[serde(rename = "progress")]
    Progress {},
    #[serde(rename = "suggest")]
    Suggest { phase: Option<NonZeroU32> },
    #[serde(rename = "why")]
    Why {
        /// A repository-relative path: the owner's question, never a read location.
        path: Option<String>,
        /// A 1-based line; omit for every commit that touched the path.
        line: Option<NonZeroU32>,
        /// The entry cap; omit for the default of 6.
        top: Option<NonZeroU32>,
        phase: Option<NonZeroU32>,
        part: Option<String>,
    },
    #[serde(rename = "document")]
    Document(cadence::read::model::DocumentRequest),
    #[serde(rename = "document-search")]
    DocumentSearch(cadence::read::model::DocumentSearchRequest),
    #[serde(rename = "verify-next")]
    VerifyNext { phase: NonZeroU32, request_id: Option<String> },
    #[serde(rename = "verification-read")]
    VerificationRead { phase: NonZeroU32, attempt: Option<String> },
    #[serde(rename = "verification-audit")]
    VerificationAudit { phase: NonZeroU32, command: Option<String> },
    #[serde(rename = "execution-history")]
    ExecutionHistory {
        phase: NonZeroU32,
        /// One retained run by its id; omit for the bounded phase index.
        run: Option<String>,
        plan: Option<NonZeroU32>,
        task: Option<String>,
    },
    #[serde(rename = "evidence-read")]
    EvidenceRead { phase: NonZeroU32 },
    #[serde(rename = "plan-read")]
    PlanRead {
        /// The integer every operation takes, or a decimal legacy address such
        /// as "27.1"; a legacy address reads and never publishes natively.
        phase: cadence::plan::inventory::PhaseAddress,
        /// Optional non-reserving preview count (1 through 64); omit for readback.
        count: Option<u32>,
        /// Complete read-only draft preview; mutually exclusive with count.
        submission: Option<Box<cadence::plan::model::Submission>>,
    },
    #[serde(rename = "context-intake")]
    ContextIntake { phase: NonZeroU32 },
    #[serde(rename = "route")]
    Route {
        role: String,
        phase: Option<NonZeroU32>,
        plan: Option<NonZeroU32>,
        attempt: Option<NonZeroU32>,
    },
    #[serde(rename = "config-entry")]
    ConfigEntry { tokens: Vec<String> },
    #[serde(rename = "config-facts")]
    ConfigFacts {},
    #[serde(rename = "config-interview")]
    ConfigInterview {
        mode: crate::config::interview::Mode,
    },
    #[serde(rename = "detect-surfaces")]
    DetectSurfaces { answered: Option<Vec<String>> },
    #[serde(rename = "execute-next")]
    ExecuteNext { phase: NonZeroU32, plan: Option<NonZeroU32> },
    #[serde(rename = "risk-status")]
    RiskStatus {
        scope: cadence::rail::risk::ScopeSelection,
        source: cadence::rail::risk::Source,
        surfaces: Option<Vec<String>>,
    },
    #[serde(rename = "schema")]
    Schema {
        /// The tool whose operation is requested: apply or query.
        tool: String,
        #[serde(rename = "for")]
        operation: String,
        /// One-based part for schemas over 24,576 bytes; defaults to 1.
        /// Concatenate the returned bodies in order, then parse the JSON.
        part: Option<usize>,
    },
}

/// Every request `cadence_apply` accepts, for on-demand request schemas.
/// Routing never parses this enum: it reads the operation name,
/// finds the group in [`APPLY_OPERATIONS`], and parses with that group's own
/// `#[serde(tag = "operation")]` type, so a miss names the field that was
/// wrong instead of reporting that fifteen shapes all failed.
///
/// The variant order is the order of [`APPLY_GROUPS`]; the table is built
/// from this schema, so the two cannot name different groups for a name.
#[derive(JsonSchema)]
#[serde(untagged)]
#[allow(dead_code)]
enum ApplyArguments {
    Verification(cadence::verification::model::Apply),
    NativeRetirement(cadence::execution::history::RetirementApply),
    NativeProgress(cadence::execution::history::ProgressApply),
    NativeClose(cadence::execution::receipts::CloseApply),
    NativeOwner(cadence::execution::receipts::OwnerApply),
    NativeRunner(cadence::execution::runner::Apply),
    NativePlan(cadence::execution::runner::PlanApply),
    NativeExecution(cadence::execution::boundary::NativeApply),
    Plan(cadence::plan::model::Apply),
    Context(cadence::context::model::Apply),
    Review(review_service::Apply),
    Config(config_service::Apply),
    Executor(ExecutorPatch),
    Rail(cadence::rail::risk::Apply),
    Receipt(cadence::rail::receipts::Apply),
    Adoption(adoption_service::Apply),
    Capture(capture_service::Apply),
    Milestone(cadence::milestone::model::Apply),
    Landing(cadence::landing::model::Apply),
    Undo(cadence::undo::model::Apply),
    Debug(cadence::debug::model::Apply),
    Spike(cadence::spike::model::Apply),
    Task(cadence::task::model::Apply),
}

/// Who parses and answers an apply request. `Executor` is the one group with
/// no operation name: an executor patch is the request with no `operation`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ApplyGroup {
    Verification,
    Execution,
    Plan,
    Context,
    Review,
    Config,
    Executor,
    Rail,
    Receipt,
    Adoption,
    Capture,
    Milestone,
    Landing,
    Undo,
    Debug,
    Spike,
    Task,
}

/// One group per [`ApplyArguments`] variant, in variant order.
const APPLY_GROUPS: [ApplyGroup; 23] = [
    ApplyGroup::Verification,
    ApplyGroup::Execution,
    ApplyGroup::Execution,
    ApplyGroup::Execution,
    ApplyGroup::Execution,
    ApplyGroup::Execution,
    ApplyGroup::Execution,
    ApplyGroup::Execution,
    ApplyGroup::Plan,
    ApplyGroup::Context,
    ApplyGroup::Review,
    ApplyGroup::Config,
    ApplyGroup::Executor,
    ApplyGroup::Rail,
    ApplyGroup::Receipt,
    ApplyGroup::Adoption,
    ApplyGroup::Capture,
    ApplyGroup::Milestone,
    ApplyGroup::Landing,
    ApplyGroup::Undo,
    ApplyGroup::Debug,
    ApplyGroup::Spike,
    ApplyGroup::Task,
];

/// The operation names `cadence_apply` accepts, each with its routing group
/// and its derived request schema. Both come from one walk of
/// the derived [`ApplyArguments`] schema.
struct ApplyOperations {
    names: Vec<(String, ApplyGroup)>,
    schemas: Vec<Value>,
}

static APPLY_OPERATIONS: LazyLock<ApplyOperations> = LazyLock::new(|| {
    let schema =
        serde_json::to_value(schemars::schema_for!(ApplyArguments)).expect("apply schema");
    let groups = schema["anyOf"].as_array().expect("untagged variants").clone();
    assert_eq!(groups.len(), APPLY_GROUPS.len(), "one group per apply variant");
    let mut names = Vec::new();
    let mut schemas = Vec::new();
    for (entry, group) in groups.iter().zip(APPLY_GROUPS) {
        let resolved = match entry.get("$ref").and_then(Value::as_str) {
            Some(reference) => schema
                .pointer(reference.strip_prefix('#').expect("local schema ref"))
                .expect("schema definition")
                .clone(),
            None => entry.clone(),
        };
        let shapes = match resolved.get("oneOf").and_then(Value::as_array) {
            Some(shapes) => shapes.clone(),
            None => vec![resolved],
        };
        for shape in shapes {
            if let Some(name) = shape["properties"]["operation"]["const"].as_str() {
                assert!(
                    !names.iter().any(|(known, _)| known == name),
                    "apply operation {name} is claimed twice"
                );
                names.push((name.to_owned(), group));
                schemas.push(operation_schema(&schema, shape));
            }
        }
    }
    ApplyOperations { names, schemas }
});

fn apply_group(operation: &str) -> Option<ApplyGroup> {
    APPLY_OPERATIONS
        .names
        .iter()
        .find(|(name, _)| name == operation)
        .map(|(_, group)| *group)
}

/// The refusal for an operation name no group claims. It lists the names so
/// the caller corrects the spelling instead of guessing a shape.
fn unknown_apply_operation(operation: &str) -> Value {
    let known = APPLY_OPERATIONS
        .names
        .iter()
        .map(|(name, _)| name.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    Refusal::new(
        "unknown-operation",
        format!("no cadence_apply operation is named `{operation}`; the operations are {known}"),
    )
    .slot("operation")
    .value()
}

#[derive(Serialize, JsonSchema)]
#[serde(untagged)]
enum ApplyOutput {
    NativeExecution(Value),
    Plan(Box<cadence::plan::model::Answer>),
    Context(Box<cadence::context::model::Answer>),
    Review(Box<Envelope<review_service::Output>>),
    Config(Box<Envelope<config_service::Output>>),
    Execution(ExecutionEnvelope),
    Rail(Box<Envelope<cadence::rail::risk::Recorded>>),
    Receipt(Box<Envelope<rail_service::ReceiptOutput>>),
}

#[derive(Serialize, JsonSchema)]
#[serde(untagged)]
enum QueryOutput {
    Read(Value),
    NativeExecution(Value),
    Plan(Box<cadence::plan::model::Answer>),
    Context(Box<cadence::context::model::Answer>),
    Review(Box<Envelope<review_service::Output>>),
    Config(Box<Envelope<config_service::Output>>),
    Surfaces(Box<Envelope<cadence::rail::surfaces::Report>>),
    Execution(ExecutionEnvelope),
    Receipt(Box<Envelope<rail_service::ReceiptOutput>>),
}

/// Keep the derived variant unchanged and attach only its reachable definitions.
fn operation_schema(root: &Value, mut variant: Value) -> Value {
    if let Some(definitions) = root.get("$defs") {
        variant["$defs"] = definitions.clone();
        prune_definitions(&mut variant);
        if variant["$defs"].as_object().is_some_and(|defs| defs.is_empty()) {
            variant.as_object_mut().expect("operation schema").remove("$defs");
        }
    }
    variant
}

/// Collect only the property's own types, following references and schema
/// alternatives without descending into object properties or array items.
fn plain_types(root: &Value, property: &Value) -> BTreeSet<String> {
    let mut types = BTreeSet::new();
    let mut references = BTreeSet::new();
    let mut pending = vec![property];
    while let Some(node) = pending.pop() {
        match &node["type"] {
            Value::String(kind) => { types.insert(kind.clone()); }
            Value::Array(kinds) => {
                types.extend(kinds.iter().filter_map(Value::as_str).map(str::to_owned));
            }
            _ => {}
        }
        if let Some(reference) = node.get("$ref").and_then(Value::as_str)
            && references.insert(reference)
            && let Some(definition) = reference.strip_prefix('#').and_then(|path| root.pointer(path))
        {
            pending.push(definition);
        }
        for keyword in ["oneOf", "anyOf", "allOf"] {
            if let Some(variants) = node[keyword].as_array() { pending.extend(variants); }
        }
    }
    types.remove("null");
    types
}

fn minimal_schema<'a>(
    tool: &str,
    names: impl Iterator<Item = &'a str>,
    schemas: impl Iterator<Item = &'a Value>,
) -> Value {
    let mut schema = serde_json::json!({
        "type":"object", "required":["operation"],
        "properties":{"operation":{
            "type":"string", "enum":names.collect::<Vec<_>>(),
            "description":format!("Full request shapes: cadence_query {{\"operation\":\"schema\",\"tool\":\"{tool}\",\"for\":\"<operation>\"}} or the compiled contracts.")
        }},
        "additionalProperties":true
    });
    let mut types_by_name = BTreeMap::<String, BTreeSet<String>>::new();
    for operation in schemas {
        for (name, property) in operation["properties"].as_object().expect("operation properties") {
            if name == "operation" { continue; }
            types_by_name.entry(name.clone()).or_default().extend(plain_types(operation, property));
        }
    }
    let mut properties = BTreeMap::new();
    for (name, types) in types_by_name {
        let mut property = serde_json::json!({});
        if types.len() == 1 {
            property["type"] = serde_json::json!(types.first().expect("one type"));
        } else if !types.is_empty() {
            property["type"] = serde_json::json!(types);
        }
        if types.contains("object") { property["additionalProperties"] = Value::Bool(true); }
        properties.insert(name, property);
    }
    properties.insert("operation".to_owned(), schema["properties"]["operation"].take());
    schema["properties"] = serde_json::to_value(properties).expect("plain properties");
    schema
}

/// Drop every `$defs` entry no `$ref` reaches from the root. A definition
/// nothing points at is bytes every host receives and none can use.
fn prune_definitions(schema: &mut Value) {
    fn refs(node: &Value, out: &mut Vec<String>) {
        match node {
            Value::Object(map) => {
                if let Some(reference) = map.get("$ref").and_then(Value::as_str) {
                    out.push(reference.rsplit('/').next().expect("ref name").to_owned());
                }
                map.values().for_each(|v| refs(v, out));
            }
            Value::Array(items) => items.iter().for_each(|v| refs(v, out)),
            _ => {}
        }
    }
    let Some(defs) = schema.get("$defs").and_then(Value::as_object).cloned() else { return };
    let mut reached = std::collections::BTreeSet::new();
    let mut todo = Vec::new();
    for (key, value) in schema.as_object().expect("schema object") {
        if key != "$defs" {
            refs(value, &mut todo);
        }
    }
    while let Some(name) = todo.pop() {
        if reached.insert(name.clone()) && let Some(def) = defs.get(&name) {
            refs(def, &mut todo);
        }
    }
    let kept: serde_json::Map<String, Value> =
        defs.into_iter().filter(|(name, _)| reached.contains(name)).collect();
    schema["$defs"] = Value::Object(kept);
}

static QUERY_OPERATIONS: LazyLock<Vec<(String, Value)>> = LazyLock::new(|| {
    let mut operations = Vec::new();
    for root in [
        serde_json::to_value(schemars::schema_for!(QueryArguments)).expect("query schema"),
        serde_json::to_value(schemars::schema_for!(review_service::Query)).expect("review schema"),
    ] {
        for variant in root["oneOf"].as_array().expect("query variants") {
            let name = variant["properties"]["operation"]["const"].as_str().expect("query name");
            assert!(!operations.iter().any(|(known, _)| known == name),
                "query operation {name} is claimed twice");
            operations.push((name.to_owned(), operation_schema(&root, variant.clone())));
        }
    }
    operations
});

#[cfg(test)]
pub(crate) fn query_operation_names() -> impl Iterator<Item = &'static str> {
    QUERY_OPERATIONS.iter().map(|(name, _)| name.as_str())
}

#[cfg(test)]
pub(crate) fn apply_operation_names() -> impl Iterator<Item = &'static str> {
    APPLY_OPERATIONS.names.iter().map(|(name, _)| name.as_str())
}

fn query_schema() -> Value {
    minimal_schema(
        "query",
        QUERY_OPERATIONS.iter().map(|(name, _)| name.as_str()),
        QUERY_OPERATIONS.iter().map(|(_, schema)| schema),
    )
}

fn apply_schema() -> Value {
    minimal_schema(
        "apply",
        APPLY_OPERATIONS.names.iter().map(|(name, _)| name.as_str()),
        APPLY_OPERATIONS.schemas.iter(),
    )
}

const SCHEMA_PART_BOUND: usize = 24_576;

fn schema_answer(tool: &str, operation: &str, part: Option<usize>) -> Value {
    let schema = match tool {
        "apply" => APPLY_OPERATIONS.names.iter().position(|(name, _)| name == operation)
            .map(|index| &APPLY_OPERATIONS.schemas[index]),
        "query" => QUERY_OPERATIONS.iter().find(|(name, _)| name == operation)
            .map(|(_, schema)| schema),
        _ => return Refusal::new("unknown-tool", "schema tool must be apply or query")
            .slot("tool").value(),
    };
    let Some(schema) = schema else {
        return Refusal::new("unknown-operation", format!("no cadence_{tool} operation is named `{operation}`"))
            .slot("for").value();
    };
    schema_part(tool, operation, schema, part)
}

fn schema_part(tool: &str, operation: &str, schema: &Value, part: Option<usize>) -> Value {
    let serialized = serde_json::to_string(schema).expect("operation schema JSON");
    let mut remaining = serialized.as_str();
    let mut parts = Vec::new();
    while !remaining.is_empty() {
        let mut end = remaining.len().min(SCHEMA_PART_BOUND);
        while !remaining.is_char_boundary(end) { end -= 1; }
        parts.push(&remaining[..end]);
        remaining = &remaining[end..];
    }
    let part = part.unwrap_or(1);
    let Some(body) = part.checked_sub(1).and_then(|index| parts.get(index)) else {
        return Refusal::new("schema-part-not-found", "the requested schema part is absent")
            .slot("part").value();
    };
    if serialized.len() <= SCHEMA_PART_BOUND {
        return serde_json::json!({"status":"ok","tool":tool,"operation":operation,"schema":schema});
    }
    let next = (part < parts.len()).then_some(part + 1);
    serde_json::json!({"status":"ok","tool":tool,"operation":operation,
        "bound":SCHEMA_PART_BOUND,"part":part,"body":body,"next":next})
}

impl CadenceServer {
    pub fn bind_project(self, project: &Path) -> Result<PublicServer, std::io::Error> {
        Ok(PublicServer {
            server: self,
            root: std::fs::canonicalize(project)?.join(".planning"),
        })
    }
}

/// Startup configuration belongs to the public adapter, not internal resident clients.
#[derive(Clone)]
pub struct PublicServer {
    server: CadenceServer,
    root: PathBuf,
}

impl PublicServer {
    pub async fn shutdown(&self) -> cadence::store::Result<()> {
        self.server.service.shutdown().await
    }

    // Public calls await resident mailbox replies, not native provider work.
    // Dropping a tool's reply receiver leaves accepted mailbox work and the
    // separately owned provider task alive; review-next reconnects by fire.
    async fn review_handoff(
        &self,
        phase: Option<u32>,
        dispatch: Option<String>,
    ) -> Result<Option<Envelope<review_service::Output>>, ErrorData> {
        let answer = self
            .server
            .service
            .review(
                &self.root,
                review_service::Command::ExecutionHandoff { phase, dispatch },
            )
            .await
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        if matches!(&answer, Envelope::Ok(output) if output.operation=="review-handoff" && output.result["pending"]==false)
        {
            Ok(None)
        } else {
            Ok(Some(answer))
        }
    }

    async fn refuse_raw(
        &self,
        tool: BoundaryTool,
        raw: Option<Value>,
    ) -> execution_service::Answer {
        let failure = if raw.is_none() {
            execution_service::ValidationFailure::MissingArguments
        } else {
            execution_service::ValidationFailure::InvalidPatch
        };
        self.server
            .refuse_execution_arguments(&self.root, tool, raw, failure)
            .await
    }
}

fn tool(
    name: &'static str,
    description: impl Into<Cow<'static, str>>,
    input: Value,
) -> Tool {
    let mut tool = Tool::new(
        name,
        description,
        input.as_object().expect("derived object schema").clone(),
    );
    // MCP hosts require an explicit object root. Tagged enums derive a root
    // oneOf; keep its variants and constraints intact alongside the root type.
    Arc::make_mut(&mut tool.input_schema)
        .insert("type".into(), Value::String("object".into()));
    // Empty structs omit properties in schemars; hosts still need the field.
    Arc::make_mut(&mut tool.input_schema)
        .entry("properties")
        .or_insert_with(|| Value::Object(Default::default()));
    tool
}

fn execution_result(answer: execution_service::Answer) -> Result<CallToolResponse, ErrorData> {
    let envelope = answer.map_err(|failure| {
        ErrorData::internal_error(
            failure.to_string(),
            Some(serde_json::json!({"failure": failure})),
        )
    })?;
    let value = serde_json::to_value(ApplyOutput::Execution(envelope))
        .map_err(|_| ErrorData::internal_error("execution envelope encoding is invalid", None))?;
    Ok(CallToolResult::structured(value).into())
}

fn rail_result(answer: rail_service::Answer) -> Result<CallToolResponse, ErrorData> {
    let envelope = answer.map_err(|error| ErrorData::internal_error(error.to_string(), None))?;
    Ok(CallToolResult::structured(
        serde_json::to_value(ApplyOutput::Rail(Box::new(envelope)))
            .map_err(|_| ErrorData::internal_error("rail answer encoding is invalid", None))?,
    )
    .into())
}

fn receipt_result(answer: rail_service::ReceiptAnswer) -> Result<CallToolResponse, ErrorData> {
    structured_result(answer.map(|envelope| ApplyOutput::Receipt(Box::new(envelope))))
}

fn query_receipt_result(
    answer: rail_service::ReceiptAnswer,
) -> Result<CallToolResponse, ErrorData> {
    structured_result(answer.map(|envelope| QueryOutput::Receipt(Box::new(envelope))))
}

fn structured_result<T: Serialize>(
    answer: cadence::store::Result<T>,
) -> Result<CallToolResponse, ErrorData> {
    let envelope = answer.map_err(|error| ErrorData::internal_error(error.to_string(), None))?;
    let value = serde_json::to_value(envelope)
        .map_err(|_| ErrorData::internal_error("rail answer encoding is invalid", None))?;
    Ok(CallToolResult::structured(value).into())
}

pub async fn execute_next_handler<R, E>(
    mut review: impl FnMut() -> R,
    execution: impl FnOnce() -> E,
) -> Result<CallToolResponse, ErrorData>
where
    R: std::future::Future<Output = Result<Option<Envelope<review_service::Output>>, ErrorData>>,
    E: std::future::Future<Output = execution_service::Answer>,
{
    if let Some(review) = review().await? {
        return structured_result(Ok(QueryOutput::Review(Box::new(review))));
    }
    let answer = execution().await;
    if let Some(review) = review().await? {
        return structured_result(Ok(QueryOutput::Review(Box::new(review))));
    }
    let envelope = answer.map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
    let mut value = serde_json::to_value(QueryOutput::Execution(envelope))
        .map_err(|_| ErrorData::internal_error("execution answer encoding is invalid", None))?;
    if value["status"] == "ok" && value["outcome"] == "dispatch"
        && let Some(prompt) = value["prompt"].as_str()
        && let Some(start) = prompt.find("Operational input:\n").map(|at| at + "Operational input:\n".len())
        && let Some(end) = prompt[start..].find("\n\nInstructions:").map(|at| start + at)
        && let Ok(operational) = serde_json::from_str::<Value>(&prompt[start..end])
    {
        value["dispatch"]["operational"] = operational;
    }
    Ok(CallToolResult::structured(value).into())
}

/// The server's answer to the host's initialize request.
pub(crate) fn info() -> ServerInfo {
    let mut info = ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
        .with_server_info(Implementation::new("cadence", env!("CARGO_PKG_VERSION")));
    info.instructions = Some(cadence::read::instructions::CONTRACT.to_owned());
    info
}

pub(crate) fn tools() -> Vec<Tool> {
    vec![
        tool(
            "cadence_version",
            "Report this binary's version, OS and architecture without changing state.",
            serde_json::to_value(schemars::schema_for!(VersionArguments))
                .expect("version schema"),
        ),
        tool(
            "cadence_query",
            "Read the bound project's records, configuration, routing and evidence without changing state; request shapes come from cadence_query {\"operation\":\"schema\",\"tool\":\"query\",\"for\":\"<operation>\"} and the compiled contracts. Read process records through document and document-search; read project source with the host's own tools.",
            query_schema(),
        ),
        tool(
            "cadence_apply",
            "Change the bound project through one replay-safe operation that is refused with a located rule when it cannot apply; request shapes come from cadence_query {\"operation\":\"schema\",\"tool\":\"apply\",\"for\":\"<operation>\"} and the compiled contracts.",
            apply_schema(),
        ),
    ]
}

impl ServerHandler for PublicServer {
    fn get_info(&self) -> ServerInfo {
        info()
    }

    async fn list_tools(
        &self,
        _: Option<PaginatedRequestParams>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        Ok(ListToolsResult {
            tools: tools(),
            ..Default::default()
        })
    }

    // Do not implement get_tool or use Parameters<T>: schema listing is descriptive;
    // every declared tool's arguments must reach this handler before validation.
    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        if let Some(reply) = context.extensions.get::<crate::review_ingress::AdmittedReply>() {
            return reply.receive().await;
        }
        self.call(request.name.as_ref(), request.arguments.map(Value::Object)).await
    }
}

impl PublicServer {
    /// One tool call with no transport around it: a name and its arguments
    /// in, the tool's answer out. `call_tool` is this plus the request
    /// context, so a check can exercise the wire without starting a child.
    pub async fn call(
        &self,
        name: &str,
        raw: Option<Value>,
    ) -> Result<CallToolResponse, ErrorData> {
        let _in_flight = crate::review_ingress::InFlight::enter();
        match name {
            "cadence_version" => {
                let envelope = match raw
                    .and_then(|value| serde_json::from_value::<VersionArguments>(value).ok())
                {
                    Some(_) => self.server.cadence_version().await?.0,
                    None => Envelope::Refused {
                        code: "invalid-arguments".into(),
                        reason: "cadence_version requires an empty arguments object".into(),
                    },
                };
                Ok(CallToolResult::structured(
                    serde_json::to_value(envelope).expect("version envelope"),
                )
                .into())
            }
            "cadence_query" => {
                if raw.as_ref().is_some_and(|value| value["operation"] == "help") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Help { name }) => cadence::help::table::answer(name.as_deref()),
                        Err(error) => Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value(),
                        Ok(_) => unreachable!("help operation selected"),
                    };
                    return structured_result(Ok(QueryOutput::Read(answer)));
                }
                if raw.as_ref().is_some_and(|value| value["operation"] == "recall") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Recall { query, limit, phase }) => match self.server.service.recall_phase(
                            &self.root, &query, limit.map(|value| i64::from(value.get())), phase.map(NonZeroU32::get)).await {
                            Ok(answer) => serde_json::to_value(answer).expect("recall answer"),
                            Err(error) => Refusal::new("recall-unavailable", error.to_string()).slot("recall").value(),
                        },
                        Err(error) => Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value(),
                        Ok(_) => unreachable!("recall operation selected"),
                    };
                    return structured_result(Ok(QueryOutput::Read(answer)));
                }
                if raw.as_ref().and_then(|v| v["operation"].as_str()).is_some_and(|op| matches!(op, "debug-list" | "debug-status" | "debug-continue")) {
                    let command = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::DebugList {}) => debug_service::Command::List,
                        Ok(QueryArguments::DebugStatus { slug } | QueryArguments::DebugContinue { slug }) => debug_service::Command::Read { slug },
                        Err(error) => return structured_result(Ok(QueryOutput::Read(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()))),
                        Ok(_) => unreachable!("selected debug query"),
                    };
                    return structured_result(self.server.service.debug(&self.root, command).await.map(QueryOutput::Read));
                }
                if raw.as_ref().and_then(|v| v["operation"].as_str()).is_some_and(|op| matches!(op, "milestone-read" | "land-read" | "undo-read")) {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::UndoRead { phase }) => self.server.service.undo(&self.root,
                            undo_service::Command::Read { phase: phase.get() }).await,
                        Ok(QueryArguments::MilestoneRead { occurrence, selection }) => self.server.service.milestone(&self.root,
                            milestone_service::Command::Read { occurrence, selection }).await,
                        Ok(QueryArguments::LandRead { landing }) => self.server.service.landing(&self.root,
                            landing_service::Command::Read { landing }).await,
                        Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        Ok(_) => unreachable!("selected milestone/landing query"),
                    };
                    return structured_result(answer.map(QueryOutput::Read));
                }
                if raw.as_ref().is_some_and(|value| value["operation"] == "suggest") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Suggest { phase }) => match self.server.service.suggest(&self.root, phase.map(NonZeroU32::get)).await {
                            Ok(answer) => answer,
                            Err(error) => Refusal::new("suggest-unavailable", error.to_string()).slot("suggest").value(),
                        },
                        Err(error) => Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value(),
                        Ok(_) => unreachable!("suggest operation selected"),
                    };
                    return structured_result(Ok(QueryOutput::Read(answer)));
                }
                if raw.as_ref().is_some_and(|value| value["operation"] == "why") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Why { path, line, top, phase, part }) => match self.server.service.why(&self.root,
                            why_service::Request { path, line: line.map(NonZeroU32::get), top: top.map(NonZeroU32::get),
                                phase: phase.map(NonZeroU32::get), part }).await {
                            Ok(answer) => answer,
                            Err(error) => Refusal::new("why-unavailable", error.to_string()).slot("why").value(),
                        },
                        Err(error) => Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value(),
                        Ok(_) => unreachable!("why operation selected"),
                    };
                    return structured_result(Ok(QueryOutput::Read(answer)));
                }
                if raw.as_ref().is_some_and(|value| value["operation"] == "progress") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Progress {}) => match self.server.service.progress(&self.root).await {
                            Ok(answer) => answer,
                            Err(error) => Refusal::new(error.code(), error.to_string())
                                .details(serde_json::json!(error)).value(),
                        },
                        Err(error) => Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value(),
                        Ok(_) => unreachable!("progress operation selected"),
                    };
                    return structured_result(Ok(QueryOutput::Read(answer)));
                }
                if raw.as_ref().is_some_and(|value| value["operation"] == "schema") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Schema { tool, operation, part }) => schema_answer(&tool, &operation, part),
                        Err(error) => Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value(),
                        Ok(_) => unreachable!("schema operation selected"),
                    };
                    return structured_result(Ok(QueryOutput::Read(answer)));
                }
                if raw.as_ref().and_then(|value| value["operation"].as_str()).is_some_and(|operation| matches!(operation, "document" | "document-search")) {
                    let query = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::Document(request)) => cadence::read::Query::Document(request),
                        Ok(QueryArguments::DocumentSearch(request)) => cadence::read::Query::DocumentSearch(request),
                        // D-148: process records are reached by identity, never by path.
                        Err(error) => return structured_result(Ok(QueryOutput::Read(Refusal::new("read-contract", error.to_string()).rule("record-identity").slot("arguments").value()))),
                        Ok(_) => unreachable!("read operation selected before generic query"),
                    };
                    return structured_result(Ok(QueryOutput::Read(self.server.service.read(&self.root, query).await)));
                }
                if raw.as_ref().and_then(|v| v["operation"].as_str()).is_some_and(|op| matches!(op, "verify-next" | "verification-read" | "verification-audit")) {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::VerifyNext { phase, request_id }) => self.server.service.verification(&self.root,
                            cadence::verification::model::Query::Next { phase: phase.get(), request_id }).await,
                        Ok(QueryArguments::VerificationRead { phase, attempt }) => self.server.service.verification(&self.root,
                            cadence::verification::model::Query::Read { phase: phase.get(), attempt }).await,
                        Ok(QueryArguments::VerificationAudit { phase, command }) => self.server.service.verification(&self.root,
                            cadence::verification::model::Query::Audit { phase: phase.get(), command }).await,
                        Ok(_) => unreachable!("selected verification operation"),
                        Err(error) => Ok(Refusal::new("invalid-verification", error.to_string()).rule("verification-shape").slot("arguments").value()),
                    };
                    return structured_result(answer.map(QueryOutput::NativeExecution));
                }
                if raw.as_ref().is_some_and(|v| v["operation"] == "execution-history") {
                    let answer = match serde_json::from_value::<QueryArguments>(raw.unwrap()) {
                        Ok(QueryArguments::ExecutionHistory { phase, run, plan, task }) => {
                            let phase = phase.get();
                            let one_run = run.is_some();
                            let mut history = self.server.service
                                .native_execution_history(&self.root, phase, run, plan.map(NonZeroU32::get), task).await
                                .map_err(|error| ErrorData::internal_error(error.to_string(), None))?;
                            if one_run {
                                return structured_result(Ok(QueryOutput::NativeExecution(history)));
                            }
                            let root = self.root.clone();
                            let lifecycle = tokio::task::spawn_blocking(move || {
                                let mut io = cadence::derivation::ArtifactFiles;
                                cadence::derivation::query(&root, &mut io)
                                    .map(|checked| checked.answer().clone())
                            }).await.map_err(|error| ErrorData::internal_error(error.to_string(), None))?
                                .map_err(|error| ErrorData::internal_error(error.to_string(), None))?;
                            let status = lifecycle.phases.iter()
                                .find(|record| record.id.number() == f64::from(phase))
                                .ok_or_else(|| ErrorData::internal_error(
                                    "lifecycle does not contain requested phase", None))?.status;
                            history["phase_status"] = serde_json::to_value(status)
                                .expect("lifecycle status is serializable");
                            Ok(history)
                        }
                        _ => Ok(Refusal::new("invalid-phase", "positive phase required").rule("task-history-shape").slot("phase").value()),
                    };
                    return structured_result(answer.map(QueryOutput::NativeExecution));
                }
                if raw.as_ref().and_then(|v| v["operation"].as_str()) == Some("context-intake") {
                    let answer =
                        match serde_json::from_value::<QueryArguments>(raw.clone().unwrap()) {
                            Ok(QueryArguments::ContextIntake { phase }) => {
                                self.server
                                    .service
                                    .context(
                                        &self.root,
                                        context_service::Command::Intake(phase.get()),
                                    )
                                    .await
                            }
                            _ => Ok(cadence::context::model::refused(
                                "phase",
                                "phase",
                                "context intake needs a positive phase number",
                                None,
                                None,
                                None,
                            )),
                        };
                    return structured_result(
                        answer.map(|answer| QueryOutput::Context(Box::new(answer))),
                    );
                }
                if raw.as_ref().and_then(|v| v["operation"].as_str()).is_some_and(|op| matches!(op, "plan-read" | "evidence-read")) {
                    let raw = raw.unwrap();
                    if let Some(diagnostic) = cadence::plan::associations::malformed_version(&raw)
                        .or_else(|| cadence::plan::limits::malformed(&raw))
                    {
                        return structured_result(Ok(QueryOutput::Plan(Box::new(diagnostic.answer()))));
                    }
                    let answer = match serde_json::from_value::<QueryArguments>(raw) {
                        Ok(QueryArguments::EvidenceRead { phase }) => self.server.service
                            .plan(&self.root, plan_service::Command::EvidenceRead { phase: phase.get() }).await,
                        Ok(QueryArguments::PlanRead {
                            phase,
                            count,
                            submission,
                        }) => {
                            self.server
                                .service
                                .plan(
                                    &self.root,
                                    plan_service::Command::Read {
                                        phase: phase.to_string(),
                                        count,
                                        submission,
                                    },
                                )
                                .await
                        }
                        Err(error) => Ok(cadence::plan::model::refused("arguments", error.to_string())),
                        _ => Ok(cadence::plan::model::refused(
                            "arguments",
                            "plan-read needs a phase address and optional plan count or submission; evidence-read needs a canonical positive integer phase",
                        )),
                    };
                    return structured_result(answer.map(|a| QueryOutput::Plan(Box::new(a))));
                }
                if raw
                    .as_ref()
                    .and_then(|v| v["operation"].as_str())
                    .is_some_and(|op| op.starts_with("review-"))
                {
                    let answer =
                        match serde_json::from_value::<review_service::Query>(raw.clone().unwrap())
                        {
                            Ok(query) => {
                                self.server
                                    .service
                                    .review(&self.root, review_service::Command::Query(query))
                                    .await
                            }
                            Err(error) => Ok(review_service::refused(error.to_string())),
                        };
                    return structured_result(
                        answer.map(|answer| QueryOutput::Review(Box::new(answer))),
                    );
                }
                let answer = match raw
                    .clone()
                    .and_then(|value| serde_json::from_value::<QueryArguments>(value).ok())
                {
                    Some(QueryArguments::Route {
                        role,
                        phase,
                        plan,
                        attempt,
                    }) => {
                        return structured_result(
                            self.server
                                .service
                                .config(
                                    &self.root,
                                    config_service::Command::Route(config_service::RouteRequest {
                                        role,
                                        phase,
                                        plan,
                                        attempt,
                                    }),
                                )
                                .await
                                .map(|answer| QueryOutput::Config(Box::new(answer))),
                        );
                    }
                    Some(QueryArguments::ContextIntake { .. }) => {
                        unreachable!("context intake is decoded before execution fallback")
                    }
                    Some(QueryArguments::Document(_) | QueryArguments::DocumentSearch(_)) => unreachable!("read operation routed before generic query"),
                    Some(QueryArguments::Schema { .. }) => unreachable!("schema routed before generic query"),
                    Some(QueryArguments::Help { .. }) => unreachable!("help routed before generic query"),
                    Some(QueryArguments::Progress {}) => unreachable!("progress routed before generic query"),
                    Some(QueryArguments::MilestoneRead { .. } | QueryArguments::LandRead { .. } | QueryArguments::UndoRead { .. }) => unreachable!("milestone/landing/undo routed before generic query"),
                    Some(QueryArguments::Suggest { .. }) => unreachable!("suggest routed before generic query"),
                    Some(QueryArguments::DebugList {} | QueryArguments::DebugStatus { .. } | QueryArguments::DebugContinue { .. }) => unreachable!("debug routed before generic query"),
                    Some(QueryArguments::Why { .. }) => unreachable!("why routed before generic query"),
                    Some(QueryArguments::ExecutionHistory { .. }) => unreachable!("native history decoded before execution fallback"),
                    Some(QueryArguments::PlanRead { .. } | QueryArguments::EvidenceRead { .. }) => {
                        unreachable!("plan read decoded before execution")
                    }
                    None if raw.as_ref().and_then(|value| value["operation"].as_str())
                        == Some("route") =>
                    {
                        return structured_result(Ok(QueryOutput::Config(Box::new(
                            config_service::refused(
                                "invalid-arguments",
                                "route arguments do not match the strict operation schema",
                            ),
                        ))));
                    }
                    Some(QueryArguments::ConfigInterview { mode }) => {
                        return structured_result(
                            self.server
                                .service
                                .config_interview(&self.root, mode)
                                .await
                                .map(|answer| QueryOutput::Config(Box::new(answer))),
                        );
                    }
                    None if raw.as_ref().and_then(|v| v["operation"].as_str())
                        == Some("config-interview") =>
                    {
                        return structured_result(Ok(QueryOutput::Config(Box::new(
                            config_service::refused(
                                "invalid-arguments",
                                "config-interview arguments do not match the strict operation schema",
                            ),
                        ))));
                    }
                    Some(QueryArguments::ConfigEntry { tokens }) => {
                        return structured_result(
                            self.server
                                .service
                                .config(&self.root, config_service::Command::Entry(tokens))
                                .await
                                .map(|answer| QueryOutput::Config(Box::new(answer))),
                        );
                    }
                    None if raw.as_ref().and_then(|v| v["operation"].as_str())
                        == Some("config-entry") =>
                    {
                        return structured_result(Ok(QueryOutput::Config(Box::new(
                            config_service::refused(
                                "invalid-arguments",
                                "config-entry arguments do not match the strict operation schema",
                            ),
                        ))));
                    }
                    Some(QueryArguments::ConfigFacts {}) => {
                        return structured_result(
                            self.server
                                .service
                                .config(&self.root, config_service::Command::Facts)
                                .await
                                .map(|answer| QueryOutput::Config(Box::new(answer))),
                        );
                    }
                    None if raw.as_ref().and_then(|v| v["operation"].as_str())
                        == Some("config-facts") =>
                    {
                        return structured_result(Ok(QueryOutput::Config(Box::new(
                            config_service::refused(
                                "invalid-arguments",
                                "config-facts arguments do not match the strict operation schema",
                            ),
                        ))));
                    }
                    Some(QueryArguments::ExecuteNext { phase, plan }) => {
                        let response = execute_next_handler(
                            || self.review_handoff(Some(phase.get()), None),
                            || self.server.query_selected_execution(&self.root, phase.get(), plan),
                        )
                        .await?;
                        // The historical execution envelope stays byte-exact.
                        // Expose the interruption's separately retained typed
                        // location beside that envelope at the wire boundary.
                        if let CallToolResponse::Complete(result) = &response
                            && let Some(value) = &result.structured_content
                            && value["code"] == "continuation-refusal" {
                            let view = self.server.service.store(&self.root, cadence::store::writer::Operation::ReadVerified)
                                .await.map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
                            for record in view.decisions.iter().rev() {
                                if let cadence::store::model::Decision::BoundaryV1(saved) = &record.decision
                                    && saved.boundary.scope == (cadence::execution::boundary::BoundaryScope::Execution { phase: phase.get() })
                                    && let cadence::execution::boundary::Receipt::Compact { envelope } = &saved.boundary.receipt
                                    && serde_json::to_value(envelope).ok().as_ref() == Some(value)
                                    && let Some(located) = &saved.boundary.located
                                    && located.rule.as_deref() == Some("interrupted") {
                                    let mut value = value.clone();
                                    value["located"] = serde_json::json!(located);
                                    return Ok(CallToolResult::structured(value).into());
                                }
                            }
                        }
                        return Ok(response);
                    }
                    Some(QueryArguments::DetectSurfaces { answered }) => {
                        return structured_result(Ok(QueryOutput::Surfaces(Box::new(
                            rail_service::detect_surfaces(&self.root, answered),
                        ))));
                    }
                    Some(QueryArguments::RiskStatus {
                        scope,
                        source,
                        surfaces,
                    }) => {
                        return query_receipt_result(
                            self.server
                                .service
                                .rail_receipt(
                                    &self.root,
                                    rail_service::ReceiptCommand::Status(
                                        cadence::rail::receipts::Query {
                                            scope,
                                            source,
                                            surfaces,
                                        },
                                    ),
                                )
                                .await,
                        );
                    }
                    None if raw.as_ref().and_then(|v| v["operation"].as_str())
                        == Some("risk-status") =>
                    {
                        return query_receipt_result(Ok(rail_service::refused(
                            "invalid-arguments",
                            "risk-status arguments do not match the strict operation schema",
                        )));
                    }
                    Some(QueryArguments::Recall { .. } | QueryArguments::VerifyNext { .. } | QueryArguments::VerificationRead { .. } | QueryArguments::VerificationAudit { .. }) => unreachable!("recall and verification routed before generic query"),
                    None => self.refuse_raw(BoundaryTool::CadenceQuery, raw).await,
                };
                let envelope = answer
                    .map_err(|failure| ErrorData::internal_error(failure.to_string(), None))?;
                structured_result(Ok(QueryOutput::Execution(envelope)))
            }
            "cadence_apply" => {
                let observation = raw.clone().unwrap_or(Value::Null);
                // Legacy executor patches retain their existing boundary contract.
                // The shared native wrapper also sees early decode/shape returns.
                let historical = raw.as_ref().is_some_and(|value|
                    value["operation"].as_str().is_none() && value.get("dispatch_id").is_some());
                let response = async {
                let operation = raw.as_ref().and_then(|v| v["operation"].as_str()).map(str::to_owned);
                let group = match operation.as_deref() {
                    None if historical => ApplyGroup::Executor,
                    None => return structured_result(Ok(ApplyOutput::NativeExecution(
                        Refusal::new("invalid-arguments", "cadence_apply requires an operation").slot("operation").value()
                    ))),
                    Some(operation) => match apply_group(operation) {
                        Some(group) => group,
                        None => {
                            return structured_result(Ok(ApplyOutput::NativeExecution(
                                unknown_apply_operation(operation),
                            )));
                        }
                    },
                };
                let operation = operation.unwrap_or_default();
                let refused = |error: serde_json::Error| format!("{operation}: {error}");
                match group {
                    ApplyGroup::Debug => {
                        let answer = match serde_json::from_value::<cadence::debug::model::Apply>(raw.unwrap()) {
                            Ok(apply) => self.server.service.debug(&self.root, debug_service::Command::Apply(apply)).await,
                            Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Spike => {
                        let answer = match serde_json::from_value::<cadence::spike::model::Apply>(raw.unwrap()) {
                            Ok(apply) => self.server.service.spike(&self.root, spike_service::Command::Apply(apply)).await,
                            Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Task => {
                        let answer = match serde_json::from_value::<cadence::task::model::Apply>(raw.unwrap()) {
                            Ok(apply) => self.server.service.task(&self.root, task_service::Command::Apply(apply)).await,
                            Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Milestone => {
                        let answer = match serde_json::from_value::<cadence::milestone::model::Apply>(raw.unwrap()) {
                            Ok(apply) => self.server.service.milestone(&self.root, milestone_service::Command::Apply(apply)).await,
                            Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Landing => {
                        let answer = match serde_json::from_value::<cadence::landing::model::Apply>(raw.unwrap()) {
                            Ok(apply) => self.server.service.landing(&self.root, landing_service::Command::Apply(Box::new(apply))).await,
                            Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Undo => {
                        let answer = match serde_json::from_value::<cadence::undo::model::Apply>(raw.unwrap()) {
                            Ok(apply) => self.server.service.undo(&self.root, undo_service::Command::Apply(apply)).await,
                            Err(error) => Ok(Refusal::new("invalid-arguments", error.to_string()).slot("arguments").value()),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Executor => {
                        let patch = raw.clone().and_then(|value| serde_json::from_value::<ExecutorPatch>(value).ok());
                        let Some(patch) = patch else {
                            return execution_result(self.refuse_raw(BoundaryTool::CadenceApply, raw).await);
                        };
                        let dispatch = patch.dispatch_id.clone();
                        if let Some(review) = self.review_handoff(None, Some(dispatch.clone())).await? {
                            return structured_result(Ok(ApplyOutput::Review(Box::new(review))));
                        }
                        let answer = self.server.apply_executor_patch(&self.root, patch).await;
                        if let Some(review) = self.review_handoff(None, Some(dispatch)).await? {
                            return structured_result(Ok(ApplyOutput::Review(Box::new(review))));
                        }
                        execution_result(answer)
                    }
                    ApplyGroup::Verification => {
                        let raw = raw.expect("an operation name came from the arguments");
                        if raw["operation"] == "verification-submit"
                            && let Some(fields) = raw["patch"].as_object()
                            && let Some(field) = fields.keys().find(|field| !["request_id", "attempt", "items", "basis"].contains(&field.as_str())) {
                            return structured_result(Ok(ApplyOutput::NativeExecution(Refusal::new("invalid-verification",
                                format!("unknown field `{}` in patch", field.chars().take(256).collect::<String>()))
                                .rule("verification-shape").slot("patch").value())));
                        }
                        if raw.to_string().len() > 262144 {
                            return structured_result(Ok(ApplyOutput::NativeExecution(Refusal::new("invalid-verification", "verification input exceeds 262144 bytes")
                                .rule("verification-shape").slot("patch").value())));
                        }
                        let answer = match serde_json::from_value::<cadence::verification::model::Apply>(raw) {
                            Ok(operation) => {
                                return structured_result(self.server.service.verification_apply(&self.root, operation).await.map(ApplyOutput::NativeExecution));
                            }
                            Err(error) => Refusal::new("invalid-verification", error.to_string().chars().take(2048).collect::<String>()).rule("verification-shape").slot("patch").value(),
                        };
                        structured_result(Ok(ApplyOutput::NativeExecution(answer)))
                    }
                    ApplyGroup::Execution => {
                        structured_result(self.server.service.native_execution_apply(&self.root, raw.unwrap()).await.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Plan => structured_result(
                        self.server
                            .service
                            .plan(&self.root, plan_service::Command::Apply(raw.unwrap()))
                            .await
                            .map(|a| ApplyOutput::Plan(Box::new(a))),
                    ),
                    ApplyGroup::Context => structured_result(
                        self.server
                            .service
                            .context(&self.root, context_service::Command::Apply(raw.unwrap()))
                            .await
                            .map(|answer| ApplyOutput::Context(Box::new(answer))),
                    ),
                    ApplyGroup::Review => {
                        if raw.as_ref().is_some_and(|v| v["operation"] == "review-material-append" && v.get("bytes").is_some()) {
                            return structured_result(Ok(ApplyOutput::NativeExecution(
                                Refusal::new("typed-content", "review-material-append reads the named path")
                                    .rule("typed-content").slot("bytes").value())));
                        }
                        if let Some(refusal) = raw.as_ref().and_then(review_service::typed_return_refusal) {
                            return structured_result(Ok(ApplyOutput::NativeExecution(refusal)));
                        }
                        let answer = match serde_json::from_value::<review_service::Apply>(raw.unwrap()) {
                            Ok(review_service::Apply::Admit { request }) if request["caller"] == "pause" => {
                                pause_service::modern_admission(&self.server.service, &self.root, request).await
                            }
                            Ok(apply) => {
                                self.server
                                    .service
                                    .review(&self.root, review_service::Command::Apply(apply))
                                    .await
                            }
                            Err(error) => Ok(review_service::refused(refused(error))),
                        };
                        if let Ok(Envelope::Refused { code, reason }) = &answer
                            && code == "typed-content" {
                            return structured_result(Ok(ApplyOutput::NativeExecution(
                                Refusal::new(code.clone(), reason.clone()).rule("typed-content").slot("raw").value())));
                        }
                        structured_result(answer.map(|answer| ApplyOutput::Review(Box::new(answer))))
                    }
                    ApplyGroup::Config => {
                        let answer = match serde_json::from_value::<config_service::Apply>(raw.unwrap()) {
                            Ok(request) => {
                                self.server
                                    .service
                                    .config(&self.root, config_service::Command::Apply(request))
                                    .await
                            }
                            Err(error) => Ok(config_service::refused("invalid-arguments", refused(error))),
                        };
                        structured_result(answer.map(|answer| ApplyOutput::Config(Box::new(answer))))
                    }
                    ApplyGroup::Rail => match serde_json::from_value::<cadence::rail::risk::Apply>(raw.unwrap()) {
                        Ok(request) => rail_result(self.server.service.apply_rail(&self.root, request).await),
                        Err(error) => rail_result(Ok(rail_service::refused("invalid-arguments", &refused(error)))),
                    },
                    ApplyGroup::Receipt => match serde_json::from_value::<cadence::rail::receipts::Apply>(raw.unwrap()) {
                        Ok(request) => receipt_result(
                            self.server
                                .service
                                .rail_receipt(&self.root, rail_service::ReceiptCommand::Submit(request))
                                .await,
                        ),
                        Err(error) => receipt_result(Ok(rail_service::refused("invalid-arguments", &refused(error)))),
                    },
                    ApplyGroup::Adoption => {
                        let raw = raw.expect("an operation name came from the arguments");
                        let answer = match serde_json::from_value::<adoption_service::Apply>(raw.clone()) {
                            Ok(apply) => self.server.service.adoption(&self.root, apply).await,
                            Err(error) => Ok(adoption_service::malformed(&raw, error)),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                    ApplyGroup::Capture => {
                        let raw = raw.expect("an operation name came from the arguments");
                        let answer = match serde_json::from_value::<capture_service::Apply>(raw.clone()) {
                            Ok(apply) => self.server.service.capture(&self.root, apply).await,
                            Err(error) => Ok(capture_service::malformed(&raw, error)),
                        };
                        structured_result(answer.map(ApplyOutput::NativeExecution))
                    }
                }
                }.await;
                if !historical
                    && let Ok(CallToolResponse::Complete(result)) = &response
                    && let Some(answer) = &result.structured_content
                    && answer["status"] == "refused" {
                    // The answer is already decided; observation is best effort.
                    let _ = self.server.service.record_native_refusal(&self.root, observation, answer.clone()).await;
                }
                response
            }
            _ => Err(ErrorData::invalid_params("unknown tool", None)),
        }
    }
}

#[cfg(test)]
mod schema_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn schema_parts_round_trip_utf8_and_escaped_json() {
        let schema = json!({"description":"é🦀\"\\".repeat(SCHEMA_PART_BOUND)});
        let mut combined = String::new();
        let mut part = None;
        let mut number = 1;
        loop {
            let answer = schema_part("apply", "synthetic", &schema, part);
            assert_eq!(answer["status"], "ok");
            assert_eq!(answer["tool"], "apply");
            assert_eq!(answer["operation"], "synthetic");
            assert_eq!(answer["part"], number);
            assert_eq!(answer["bound"], SCHEMA_PART_BOUND);
            assert!(answer.get("schema").is_none());
            let body = answer["body"].as_str().unwrap();
            assert!(!body.is_empty() && body.len() <= SCHEMA_PART_BOUND);
            combined.push_str(body);
            if answer["next"].is_null() { break; }
            number += 1;
            assert_eq!(answer["next"], number);
            part = Some(number);
        }
        assert!(number > 1);
        assert_eq!(combined, serde_json::to_string(&schema).unwrap());
        assert_eq!(serde_json::from_str::<Value>(&combined).unwrap(), schema);
    }

    #[test]
    fn a_schema_at_the_bound_is_served_whole_and_one_byte_over_is_paged() {
        let schema = json!("x".repeat(SCHEMA_PART_BOUND - 2));
        assert_eq!(serde_json::to_vec(&schema).unwrap().len(), SCHEMA_PART_BOUND);
        assert_eq!(schema_part("query", "synthetic", &schema, None),
            json!({"status":"ok","tool":"query","operation":"synthetic","schema":schema}));
        let oversized = json!("x".repeat(SCHEMA_PART_BOUND - 1));
        let first = schema_part("query", "synthetic", &oversized, None);
        assert_eq!(first["part"], 1);
        assert_eq!(first["next"], 2);
        assert_eq!(first["body"].as_str().unwrap().len(), SCHEMA_PART_BOUND);
        let last = schema_part("query", "synthetic", &oversized, Some(2));
        assert_eq!(last["body"].as_str().unwrap().len(), 1);
        assert!(last["next"].is_null());
    }

    #[test]
    fn a_schema_part_of_0_past_the_end_or_usize_max_is_refused_as_not_found() {
        let schema = json!("x".repeat(SCHEMA_PART_BOUND - 2));
        for part in [0, 2, usize::MAX] {
            let refused = schema_part("query", "synthetic", &schema, Some(part));
            assert_eq!(refused["status"], "refused");
            assert_eq!(refused["slot"], "part");
            assert_eq!(refused["code"], "schema-part-not-found");
        }
    }
}

#[cfg(test)]
mod wire_tests {
    use super::*;
    use serde_json::json;

    fn answer(tool: &str) -> Result<CallToolResponse, ErrorData> {
        let project = tempfile::tempdir().unwrap();
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                // No global config: the server must not read HOME or the
                // environment to find one.
                let factory = crate::import::SessionFactory::new(
                    None,
                    std::sync::Arc::new(crate::config::planning_policy),
                );
                let server = CadenceServer::with_factory(factory).bind_project(project.path()).unwrap();
                server.call(tool, Some(json!({}))).await
            })
    }

    // The tool call is reachable without a transport: no child, no stdio and
    // no MCP request context, so a check can exercise the wire in process.
    #[test]
    fn a_tool_call_answers_in_process() {
        let CallToolResponse::Complete(result) = answer("cadence_version").unwrap() else {
            panic!("a complete answer")
        };
        let structured = result.structured_content.expect("a structured answer");
        assert_eq!(structured["status"], "ok", "{structured}");
    }

    #[test]
    fn an_unknown_tool_is_invalid_params() {
        assert_eq!(answer("cadence_unknown").unwrap_err().message, "unknown tool");
    }

    #[test]
    fn the_initialize_answer_names_the_server_cadence() {
        assert_eq!(info().server_info.name, "cadence");
    }

    #[test]
    fn a_refusal_is_answered_as_a_successful_call_carrying_it() {
        let refusal: cadence::store::Result<Envelope<Value>> = Ok(Envelope::Refused {
            code: "invalid-request".into(),
            reason: "the request is incomplete".into(),
        });
        let CallToolResponse::Complete(result) = structured_result(refusal).unwrap() else {
            panic!("a complete answer")
        };
        assert_ne!(result.is_error, Some(true));
        let structured = result.structured_content.expect("a structured answer");
        assert_eq!((&structured["status"], &structured["code"]), (&json!("refused"), &json!("invalid-request")));
    }
}
