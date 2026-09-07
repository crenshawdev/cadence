//! Root-bound MCP adapter. Raw tool arguments are validated inside Cadence.

use cadence::execution::{
    boundary::ExecutionEnvelope,
    model::{BoundaryTool, ExecutorPatch, patch_schema},
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
            std::sync::Arc::new(|_, _| Ok(())),
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
    #[serde(rename = "execute-next")]
    ExecuteNext { phase: NonZeroU32 },
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

fn tool(name: &'static str, description: &'static str, input: Value) -> Tool {
    Tool::new(
        name,
        description,
        input.as_object().expect("derived object schema").clone(),
    )
}

fn execution_result(answer: execution_service::Answer) -> Result<CallToolResponse, ErrorData> {
    let envelope = answer.map_err(|failure| {
        ErrorData::internal_error(
            failure.to_string(),
            Some(serde_json::json!({"failure": failure})),
        )
    })?;
    let value = serde_json::to_value(envelope)
        .map_err(|_| ErrorData::internal_error("execution envelope encoding is invalid", None))?;
    Ok(CallToolResult::structured(value).into())
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
                tool(
                    "cadence_version",
                    "Report this binary's version, OS and architecture without changing state.",
                    serde_json::to_value(schemars::schema_for!(VersionArguments))
                        .expect("version schema"),
                )
                .with_output_schema::<Envelope<VersionReport>>(),
                tool(
                    "cadence_query",
                    "Ask for the next native execution dispatch in the bound project.",
                    serde_json::to_value(schemars::schema_for!(QueryArguments))
                        .expect("query schema"),
                )
                .with_output_schema::<ExecutionEnvelope>(),
                tool(
                    "cadence_apply",
                    "Submit the executor patch for the bound project's active dispatch.",
                    patch_schema(),
                )
                .with_output_schema::<ExecutionEnvelope>(),
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
                let answer = match raw
                    .clone()
                    .and_then(|value| serde_json::from_value::<QueryArguments>(value).ok())
                {
                    Some(QueryArguments::ExecuteNext { phase }) => {
                        self.server.query_execution(&self.root, phase.get()).await
                    }
                    None => self.refuse_raw(BoundaryTool::CadenceQuery, raw).await,
                };
                execution_result(answer)
            }
            "cadence_apply" => {
                let answer = match raw
                    .clone()
                    .and_then(|value| serde_json::from_value::<ExecutorPatch>(value).ok())
                {
                    Some(patch) => self.server.apply_executor_patch(&self.root, patch).await,
                    None => self.refuse_raw(BoundaryTool::CadenceApply, raw).await,
                };
                execution_result(answer)
            }
            _ => Err(ErrorData::invalid_params("unknown tool", None)),
        }
    }
}
