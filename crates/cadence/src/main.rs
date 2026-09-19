#[path = "config/binary.rs"]
pub mod config;
mod guard;
#[path = "import/binary.rs"]
pub mod import;
mod review_hook;
mod review_ingress;
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
    /// Bind public execution calls to this project directory.
    #[arg(long, global = true)]
    project_root: Option<std::path::PathBuf>,
}

#[derive(Subcommand)]
enum Command {
    /// Render the query-only progress front door without opening a project.
    ProgressInstructions,
    /// Render the retune front door without opening a project.
    SuggestInstructions,
    /// Render the query-only why front door without opening a project.
    WhyInstructions,
    /// Render the capture front door without opening a project.
    CaptureInstructions,
    /// Run the MCP stdio server.
    Serve,
    /// Guard Bash Git commands and binary-owned Write/Edit outputs.
    Guard,
    /// Observe an attributed reviewer stop without closing missing delivery.
    ReviewStop,
    /// Render the compiled context-role skill without opening a project.
    ContextInstructions,
    /// Render the shared read-contract skill without opening a project.
    ReadInstructions,
    /// Render the compiled authoring-only planner skill without opening a project.
    PlanInstructions,
    /// Render the compiled executor contract without opening a project.
    ExecutorInstructions {
        /// Render the cad-execute front door from the same compiled source.
        #[arg(long)]
        frontdoor: bool,
    },
    /// Render the compiled verifier contract without opening a project.
    VerifierInstructions {
        /// Render the cad-verify front door from the same compiled source.
        #[arg(long)]
        frontdoor: bool,
    },
    /// Render the merged cad-review front door, or one alias, without opening a project.
    ReviewInstructions {
        /// cad-decision-review, cad-minimalism-review or cad-plan-review.
        #[arg(long)]
        alias: Option<String>,
    },
    /// Render the read-only cad-audit front door without opening a project.
    AuditInstructions {
        /// Render the cad-coverage alias of the same read-only view.
        #[arg(long)]
        coverage: bool,
    },
}

fn main() -> std::process::ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Serve => run_serve(cli.project_root),
        other => run_command(other),
    }
}

fn run_command(command: Command) -> std::process::ExitCode {
    match command {
        Command::SuggestInstructions => {
            use std::io::Write;
            match std::io::stdout().lock().write_all(cadence::suggest::instructions::markdown().as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::WhyInstructions => {
            use std::io::Write;
            match std::io::stdout().lock().write_all(cadence::why::instructions::markdown().as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::ProgressInstructions => {
            use std::io::Write;
            match std::io::stdout().lock().write_all(cadence::progress::instructions::markdown().as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::CaptureInstructions => {
            use std::io::Write;
            match std::io::stdout().lock().write_all(cadence::capture::instructions::markdown().as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::AuditInstructions { coverage } => {
            use std::io::Write;
            let rendered = cadence::verification::instructions::audit_frontdoor_markdown(coverage);
            match std::io::stdout().lock().write_all(rendered.as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::ReviewInstructions { alias } => {
            use std::io::Write;
            let command = alias.as_deref().unwrap_or(cadence::review::selection::CANONICAL);
            let Some(rendered) = cadence::review::instructions::frontdoor_markdown(command) else {
                eprintln!("cadence: {command} is not a review command");
                return std::process::ExitCode::FAILURE;
            };
            match std::io::stdout().lock().write_all(rendered.as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::VerifierInstructions { frontdoor } => {
            use std::io::Write;
            let rendered = if frontdoor {
                cadence::verification::instructions::frontdoor_markdown()
            } else {
                cadence::verification::instructions::contract_markdown()
            };
            match std::io::stdout().lock().write_all(rendered.as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::Serve => run_serve(None),
        Command::Guard => guard::run(),
        Command::ReviewStop => review_hook::run(),
        Command::PlanInstructions => {
            use std::io::Write;
            match std::io::stdout()
                .lock()
                .write_all(cadence::plan::instructions::markdown().as_bytes())
            {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::ContextInstructions => {
            use std::io::Write;
            match std::io::stdout()
                .lock()
                .write_all(cadence::context::instructions::markdown().as_bytes())
            {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::ReadInstructions => {
            use std::io::Write;
            match std::io::stdout()
                .lock()
                .write_all(cadence::read::instructions::markdown().as_bytes())
            {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
        Command::ExecutorInstructions { frontdoor } => {
            use std::io::Write;
            let rendered = if frontdoor {
                cadence::execution::instructions::frontdoor_markdown()
            } else {
                cadence::execution::instructions::contract_markdown()
            };
            match std::io::stdout().lock().write_all(rendered.as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            }
        }
    }
}

/// Serve MCP on stdio until the host closes stdin.
///
/// One process per session, shared by the main thread and every subagent, so
/// the runtime is multi-threaded rather than current-thread: two dispatches
/// can be in flight at once and neither may hold the other behind it.
fn run_serve(project_root: Option<std::path::PathBuf>) -> std::process::ExitCode {
    let project = match project_root.map(Ok).unwrap_or_else(std::env::current_dir) {
        Ok(project) => project,
        Err(_) => return std::process::ExitCode::FAILURE,
    };
    let runtime = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    runtime.block_on(async {
        let handler = match server::CadenceServer::new().bind_project(&project) {
            Ok(handler) => handler,
            Err(_) => {
                eprintln!("cadence: project root is unavailable");
                return std::process::ExitCode::FAILURE;
            }
        };
        let (transport, input_failed) =
            review_ingress::InputTransport::new(tokio::io::stdin(), tokio::io::stdout());
        let service = match handler.serve(transport).await {
            Ok(service) => service,
            // The host closed the pipe before it ever initialized - it quit
            // during startup, or spawned us to look and went away. That is
            // the session ending, not a server that failed to start, and
            // panicking on it writes a stack-trace hint into the host's MCP
            // log for an ordinary shutdown. Exit quietly and let it be.
            Err(ServerInitializeError::ConnectionClosed(_) | ServerInitializeError::Cancelled) => {
                return if input_failed.load(std::sync::atomic::Ordering::Acquire) {
                    std::process::ExitCode::FAILURE
                } else {
                    std::process::ExitCode::SUCCESS
                };
            }
            // Everything else is a real failure to start and stays loud.
            Err(err) => panic!("failed to start MCP server on stdio: {err}"),
        };
        // Returns when the transport ends - which is what closing stdin does -
        // so the process exits with the session rather than outliving it.
        service.waiting().await.expect("MCP server task panicked");
        if input_failed.load(std::sync::atomic::Ordering::Acquire) {
            std::process::ExitCode::FAILURE
        } else {
            std::process::ExitCode::SUCCESS
        }
    })
}
