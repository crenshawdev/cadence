mod server;

use clap::{Parser, Subcommand};
use rmcp::ServiceExt;

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
}

fn main() -> std::process::ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Serve => run_serve(),
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
        let service = handler
            .serve(rmcp::transport::stdio())
            .await
            .expect("failed to start MCP server on stdio");
        // Returns when the transport ends - which is what closing stdin does -
        // so the process exits with the session rather than outliving it.
        service.waiting().await.expect("MCP server task panicked");
    });
    std::process::ExitCode::SUCCESS
}
