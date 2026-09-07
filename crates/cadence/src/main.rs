pub mod config;
mod envelope;
mod guard;
pub mod import;
mod server;

use clap::{Parser, Subcommand};
use rmcp::ServiceExt;
use rmcp::service::ServerInitializeError;

/// cadence: the plan/execute/verify loop, served over MCP stdio.
#[derive(Parser)]
#[command(name = "cadence", version)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run the MCP stdio server.
    Serve,
    /// Guard binary-owned planning outputs from direct Write/Edit calls.
    Guard,
}

fn main() -> std::process::ExitCode {
    let cli = Cli::parse();
    run_command(cli.command)
}

fn run_command(command: Command) -> std::process::ExitCode {
    match command {
        Command::Serve => run_serve(),
        Command::Guard => guard::run(),
    }
}

/// Serve MCP on stdio until the host closes stdin.
///
/// One process per session, shared by the main thread and every subagent, so
/// the runtime is multi-threaded rather than current-thread: two dispatches
/// can be in flight at once and neither may hold the other behind it.
fn run_serve() -> std::process::ExitCode {
    let runtime = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    runtime.block_on(async {
        let handler = server::CadenceServer::new();
        let service = match handler.serve(rmcp::transport::stdio()).await {
            Ok(service) => service,
            // The host closed the pipe before it ever initialized - it quit
            // during startup, or spawned us to look and went away. That is
            // the session ending, not a server that failed to start, and
            // panicking on it writes a stack-trace hint into the host's MCP
            // log for an ordinary shutdown. Exit quietly and let it be.
            Err(ServerInitializeError::ConnectionClosed(_) | ServerInitializeError::Cancelled) => {
                return std::process::ExitCode::SUCCESS;
            }
            // Everything else is a real failure to start and stays loud.
            Err(err) => panic!("failed to start MCP server on stdio: {err}"),
        };
        // Returns when the transport ends - which is what closing stdin does -
        // so the process exits with the session rather than outliving it.
        service.waiting().await.expect("MCP server task panicked");
        std::process::ExitCode::SUCCESS
    })
}
