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
pub struct CadenceServer;

#[tool_router]
impl CadenceServer {
    pub fn new() -> Self {
        Self
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
