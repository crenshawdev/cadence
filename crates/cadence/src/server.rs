//! The MCP server handler.
//!
//! `#[tool_handler(name = "cadence")]` is what makes the initialize response
//! name the server `cadence` (D-09), which is the first half of every wire
//! name a later subagent definition, `allowed-tools` block or hook matcher
//! will hard-code as `mcp__cadence__<tool>`.

use rmcp::{ServerHandler, tool_handler, tool_router};

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
}

#[tool_handler(name = "cadence")]
impl ServerHandler for CadenceServer {}
