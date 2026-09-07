//! The MCP server handler.
//!
//! `#[tool_handler(name = "cadence")]` is what makes the initialize response
//! name the server `cadence` (D-09), which is the first half of every wire
//! name a later subagent definition, `allowed-tools` block or hook matcher
//! will hard-code as `mcp__cadence__<tool>`.

use rmcp::handler::server::wrapper::Json;
use rmcp::{ErrorData, ServerHandler, tool, tool_handler, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::envelope::Envelope;

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

/// The Cadence MCP server handler.
///
/// `Clone` because `#[tool_handler]` builds the tool router fresh from
/// `Self::tool_router()` on each dispatch; any per-session state added later
/// has to be a handle onto one shared thing rather than a copy of it, or a
/// clone would answer from its own.
#[derive(Clone)]
pub struct CadenceServer {
    #[allow(dead_code)] // Called by internal clients until phase 5 registers tools.
    service: recall::Resident,
}

#[allow(dead_code)]
impl CadenceServer {
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
}

#[tool_router]
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

    #[tool(
        name = "cadence_version",
        description = "Report which cadence binary is serving this session: \
            the version it was built at, and the operating system and CPU \
            architecture it was built for. Answers `which release am I \
            actually running` without leaving the session - the plugin's own \
            version and the binary's are two separate things and can disagree."
    )]
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

#[tool_handler(name = "cadence")]
impl ServerHandler for CadenceServer {}
