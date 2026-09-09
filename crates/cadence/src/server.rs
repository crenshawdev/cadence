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
    num::NonZeroU32,
    path::{Path, PathBuf},
    sync::Arc,
};

use cadence::envelope::Envelope;

// Internal query surface; public MCP registration belongs to phase 5.
#[allow(dead_code)]
#[path = "recall/mod.rs"]
pub mod recall;

#[allow(dead_code)]
#[path = "derivation_service.rs"]
pub mod derivation_service;
#[cfg(test)]
#[path = "derivation_service_tests.rs"]
mod derivation_service_tests;

#[allow(dead_code)]
#[path = "evidence_service.rs"]
pub mod evidence_service;
#[cfg(test)]
#[path = "evidence_service_tests.rs"]
mod evidence_service_tests;

#[allow(dead_code)]
#[path = "next_action_service.rs"]
pub mod next_action_service;
#[cfg(test)]
#[path = "next_action_service_tests.rs"]
mod next_action_service_tests;

#[allow(dead_code)]
#[path = "pause_service.rs"]
pub mod pause_service;
#[cfg(test)]
#[path = "pause_service_tests.rs"]
mod pause_service_tests;

#[allow(dead_code)]
#[path = "execution_service.rs"]
pub mod execution_service;
#[cfg(test)]
#[path = "execution_service_tests.rs"]
mod execution_service_tests;

#[path = "rail_service.rs"]
pub mod rail_service;

#[path = "config_service_binary.rs"]
pub mod config_service;

#[path = "review_service.rs"]
pub mod review_service;

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

    #[cfg(test)]
    pub fn with_derivation_driver<I: crate::config::reload::ConfigIo + Clone + Sync>(
        factory: crate::import::SessionFactory<I>,
        driver: derivation_service::Driver,
    ) -> Self {
        Self {
            service: recall::Resident::spawn_with_driver(factory, driver),
        }
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
        // (D-07). Wrapping it here is also what gives the tool an
        // `outputSchema`, derived from the envelope's own `JsonSchema`.
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
    ExecuteNext { phase: NonZeroU32 },
    #[serde(rename = "risk-status")]
    RiskStatus {
        scope: cadence::rail::risk::ScopeSelection,
        source: cadence::rail::risk::Source,
        surfaces: Option<Vec<String>>,
    },
}

#[derive(Deserialize, JsonSchema)]
#[serde(untagged)]
enum ApplyArguments {
    Review(review_service::Apply),
    Config(config_service::Apply),
    Executor(ExecutorPatch),
    Rail(cadence::rail::risk::Apply),
    Receipt(cadence::rail::receipts::Apply),
}

#[derive(Serialize, JsonSchema)]
#[serde(untagged)]
enum ApplyOutput {
    Review(Box<Envelope<review_service::Output>>),
    Config(Box<Envelope<config_service::Output>>),
    Execution(ExecutionEnvelope),
    Rail(Box<Envelope<cadence::rail::risk::Recorded>>),
    Receipt(Box<Envelope<rail_service::ReceiptOutput>>),
}

#[derive(Serialize, JsonSchema)]
#[serde(untagged)]
enum QueryOutput {
    Review(Box<Envelope<review_service::Output>>),
    Config(Box<Envelope<config_service::Output>>),
    Surfaces(Box<Envelope<cadence::rail::surfaces::Report>>),
    Execution(ExecutionEnvelope),
    Receipt(Box<Envelope<rail_service::ReceiptOutput>>),
}

/// Hosts require object properties at the root. Keep the strict derived variants
/// in definitions; advertise their field union and common required fields here.
/// Deserialization still validates the complete selected variant on every call.
fn host_schema(mut schema: Value) -> Value {
    fn objects(root: &Value, node: &Value, out: &mut Vec<Value>) {
        if let Some(reference) = node.get("$ref").and_then(Value::as_str) {
            objects(
                root,
                root.pointer(reference.strip_prefix('#').expect("local schema ref"))
                    .expect("schema definition"),
                out,
            );
        } else if let Some(variants) = node.get("oneOf").or_else(|| node.get("anyOf")) {
            for variant in variants.as_array().expect("derived variants") {
                objects(root, variant, out);
            }
        } else {
            out.push(node.clone());
        }
    }
    let mut variants = Vec::new();
    objects(&schema, &schema, &mut variants);
    let mut properties = serde_json::Map::new();
    let mut required: Option<std::collections::BTreeSet<String>> = None;
    for variant in &variants {
        for (name, field) in variant["properties"].as_object().expect("object variant") {
            match properties.get_mut(name) {
                Some(old) if old != field => {
                    *old = serde_json::json!({"anyOf":[old.clone(), field]})
                }
                Some(_) => {}
                None => {
                    properties.insert(name.clone(), field.clone());
                }
            }
        }
        let fields = variant
            .get("required")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .map(|v| v.as_str().expect("required name").to_owned())
            .collect::<std::collections::BTreeSet<_>>();
        required = Some(match required {
            None => fields,
            Some(old) => old.intersection(&fields).cloned().collect(),
        });
    }
    let root = schema.as_object_mut().expect("schema object");
    for keyword in ["oneOf", "anyOf", "allOf", "$ref"] {
        root.remove(keyword);
    }
    root.insert("type".into(), Value::String("object".into()));
    root.insert("properties".into(), Value::Object(properties));
    root.insert(
        "required".into(),
        serde_json::to_value(required.unwrap_or_default()).expect("required fields"),
    );
    root.insert("additionalProperties".into(), Value::Bool(false));
    schema
}

fn query_schema() -> Value {
    let mut schema =
        serde_json::to_value(schemars::schema_for!(QueryArguments)).expect("query schema");
    let mut strict = schema.clone();
    strict.as_object_mut().unwrap().remove("$defs");
    schema["$defs"]["QueryArguments"] = strict;
    let review =
        serde_json::to_value(schemars::schema_for!(review_service::Query)).expect("review schema");
    for (name, value) in review
        .get("$defs")
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
    {
        schema["$defs"][name] = value.clone();
    }
    let mut variant = review;
    variant.as_object_mut().unwrap().remove("$defs");
    schema["oneOf"]
        .as_array_mut()
        .expect("query variants")
        .push(variant);
    host_schema(schema)
}

fn apply_schema() -> Value {
    host_schema(serde_json::to_value(schemars::schema_for!(ApplyArguments)).expect("apply schema"))
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

fn tool<Output: JsonSchema + 'static>(
    name: &'static str,
    description: &'static str,
    input: Value,
) -> Tool {
    let mut tool = Tool::new(
        name,
        description,
        input.as_object().expect("derived object schema").clone(),
    )
    .with_output_schema::<Output>();
    // MCP hosts require an explicit object root. Tagged enums derive a root
    // oneOf; keep its variants and constraints intact alongside the root type.
    for schema in [
        &mut tool.input_schema,
        tool.output_schema.as_mut().expect("derived output schema"),
    ] {
        Arc::make_mut(schema).insert("type".into(), Value::String("object".into()));
    }
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
    structured_result(Ok(QueryOutput::Execution(envelope)))
}

impl ServerHandler for PublicServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("cadence", env!("CARGO_PKG_VERSION")))
    }

    async fn list_tools(
        &self,
        _: Option<PaginatedRequestParams>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        Ok(ListToolsResult {
            tools: vec![
                tool::<Envelope<VersionReport>>(
                    "cadence_version",
                    "Report this binary's version, OS and architecture without changing state.",
                    serde_json::to_value(schemars::schema_for!(VersionArguments))
                        .expect("version schema"),
                ),
                tool::<QueryOutput>(
                    "cadence_query",
                    "Read supported configuration, role routing, native execution, exact material risk status or structural surface evidence in the bound project.",
                    query_schema(),
                ),
                tool::<ApplyOutput>(
                    "cadence_apply",
                    "Apply an atomic config batch, executor patch, risk-check, contracted risk fire or consequence.",
                    apply_schema(),
                ),
            ],
            ..Default::default()
        })
    }

    // Do not implement get_tool or use Parameters<T>: schema listing is descriptive;
    // every declared tool's arguments must reach this handler before validation.
    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        let raw = request.arguments.map(Value::Object);
        match request.name.as_ref() {
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
                    Some(QueryArguments::ExecuteNext { phase }) => {
                        return execute_next_handler(
                            || self.review_handoff(Some(phase.get()), None),
                            || self.server.query_execution(&self.root, phase.get()),
                        )
                        .await;
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
                    None => self.refuse_raw(BoundaryTool::CadenceQuery, raw).await,
                };
                let envelope = answer
                    .map_err(|failure| ErrorData::internal_error(failure.to_string(), None))?;
                structured_result(Ok(QueryOutput::Execution(envelope)))
            }
            "cadence_apply" => {
                if raw
                    .as_ref()
                    .and_then(|v| v["operation"].as_str())
                    .is_some_and(|op| op.starts_with("review-"))
                {
                    let answer = match serde_json::from_value::<review_service::Apply>(raw.unwrap())
                    {
                        Ok(review_service::Apply::Admit { request })
                            if request["caller"] == "pause" =>
                        {
                            pause_service::modern_admission(
                                &self.server.service,
                                &self.root,
                                request,
                            )
                            .await
                        }
                        Ok(apply) => {
                            self.server
                                .service
                                .review(&self.root, review_service::Command::Apply(apply))
                                .await
                        }
                        Err(error) => Ok(review_service::refused(error.to_string())),
                    };
                    return structured_result(
                        answer.map(|answer| ApplyOutput::Review(Box::new(answer))),
                    );
                }
                let answer = match raw
                    .clone()
                    .and_then(|value| serde_json::from_value::<ApplyArguments>(value).ok())
                {
                    Some(ApplyArguments::Review(request)) => {
                        return structured_result(
                            self.server
                                .service
                                .review(&self.root, review_service::Command::Apply(request))
                                .await
                                .map(|answer| ApplyOutput::Review(Box::new(answer))),
                        );
                    }
                    Some(ApplyArguments::Config(request)) => {
                        return structured_result(
                            self.server
                                .service
                                .config(&self.root, config_service::Command::Apply(request))
                                .await
                                .map(|answer| ApplyOutput::Config(Box::new(answer))),
                        );
                    }
                    None if raw
                        .as_ref()
                        .and_then(|v| v["operation"].as_str())
                        .is_some_and(|operation| {
                            matches!(operation, "config-apply" | "config-interview-apply")
                        }) =>
                    {
                        return structured_result(Ok(ApplyOutput::Config(Box::new(
                            config_service::refused(
                                "invalid-arguments",
                                format!(
                                    "{} arguments do not match the strict operation schema",
                                    raw.as_ref().unwrap()["operation"].as_str().unwrap()
                                ),
                            ),
                        ))));
                    }
                    Some(ApplyArguments::Executor(patch)) => {
                        let dispatch = patch.dispatch_id.clone();
                        if let Some(review) =
                            self.review_handoff(None, Some(dispatch.clone())).await?
                        {
                            return structured_result(Ok(ApplyOutput::Review(Box::new(review))));
                        }
                        let answer = self.server.apply_executor_patch(&self.root, patch).await;
                        if let Some(review) = self.review_handoff(None, Some(dispatch)).await? {
                            return structured_result(Ok(ApplyOutput::Review(Box::new(review))));
                        }
                        answer
                    }
                    Some(ApplyArguments::Rail(request)) => {
                        return rail_result(
                            self.server.service.apply_rail(&self.root, request).await,
                        );
                    }
                    Some(ApplyArguments::Receipt(request)) => {
                        return receipt_result(
                            self.server
                                .service
                                .rail_receipt(
                                    &self.root,
                                    rail_service::ReceiptCommand::Submit(request),
                                )
                                .await,
                        );
                    }
                    None if matches!(
                        raw.as_ref().and_then(|v| v["operation"].as_str()),
                        Some("risk-fire" | "risk-consequence")
                    ) =>
                    {
                        return receipt_result(Ok(rail_service::refused(
                            "invalid-arguments",
                            "risk receipt arguments do not match the strict operation schema",
                        )));
                    }
                    None if raw
                        .as_ref()
                        .and_then(|v| v.get("operation"))
                        .and_then(Value::as_str)
                        == Some("risk-check") =>
                    {
                        return rail_result(Ok(rail_service::refused(
                            "invalid-arguments",
                            "risk-check arguments do not match the strict operation schema",
                        )));
                    }
                    None => self.refuse_raw(BoundaryTool::CadenceApply, raw).await,
                };
                execution_result(answer)
            }
            _ => Err(ErrorData::invalid_params("unknown tool", None)),
        }
    }
}
