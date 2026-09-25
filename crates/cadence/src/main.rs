#[path = "config/binary.rs"]
pub mod config;
mod guard;
#[path = "import/binary.rs"]
pub mod import;
#[cfg(test)]
mod instruction_lint;
mod instruction_surfaces;
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
    /// Render the query-only help front door without opening a project.
    HelpInstructions,
    /// Regenerate only a skill's description from the compiled table on stdin.
    SkillDescription { name: String },
    /// Render the debug front door without opening a project.
    DebugInstructions,
    /// Render the spike front door without opening a project.
    SpikeInstructions,
    /// Render the undo front door without opening a project.
    UndoInstructions,
    /// Render the landing front door without opening a project.
    LandInstructions,
    /// Render the milestone front door without opening a project.
    MilestoneInstructions,
    /// Render the query-only progress front door without opening a project.
    ProgressInstructions,
    /// Render the retune front door without opening a project.
    SuggestInstructions,
    /// Render the query-only why front door without opening a project.
    WhyInstructions,
    /// Render the capture front door without opening a project.
    CaptureInstructions,
    /// Render the cad-task front door and task executor contract without opening a project.
    TaskInstructions,
    /// Run the MCP stdio server.
    Serve,
    /// Guard Bash Git commands and binary-owned Write/Edit outputs.
    Guard,
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
    use std::io::{Read, Write};
    let arguments: Vec<&str> = match &command {
        Command::Serve => return run_serve(None),
        Command::Guard => return guard::run(),
        Command::SkillDescription { name } => {
            let mut markdown = String::new();
            if std::io::stdin().read_to_string(&mut markdown).is_err() {
                return std::process::ExitCode::FAILURE;
            }
            let Some(rendered) = cadence::help::table::render_description(name, &markdown) else {
                eprintln!("cadence: unknown user skill or missing description front matter");
                return std::process::ExitCode::FAILURE;
            };
            return match std::io::stdout().lock().write_all(rendered.as_bytes()) {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(_) => std::process::ExitCode::FAILURE,
            };
        }
        Command::HelpInstructions => vec!["help-instructions"],
        Command::SpikeInstructions => vec!["spike-instructions"],
        Command::DebugInstructions => vec!["debug-instructions"],
        Command::UndoInstructions => vec!["undo-instructions"],
        Command::LandInstructions => vec!["land-instructions"],
        Command::MilestoneInstructions => vec!["milestone-instructions"],
        Command::SuggestInstructions => vec!["suggest-instructions"],
        Command::WhyInstructions => vec!["why-instructions"],
        Command::ProgressInstructions => vec!["progress-instructions"],
        Command::CaptureInstructions => vec!["capture-instructions"],
        Command::ContextInstructions => vec!["context-instructions"],
        Command::PlanInstructions => vec!["plan-instructions"],
        Command::ReadInstructions => vec!["read-instructions"],
        Command::TaskInstructions => vec!["task-instructions"],
        Command::ExecutorInstructions { frontdoor: false } => vec!["executor-instructions"],
        Command::ExecutorInstructions { frontdoor: true } => vec!["executor-instructions", "--frontdoor"],
        Command::VerifierInstructions { frontdoor: false } => vec!["verifier-instructions"],
        Command::VerifierInstructions { frontdoor: true } => vec!["verifier-instructions", "--frontdoor"],
        Command::ReviewInstructions { alias: None } => vec!["review-instructions"],
        Command::ReviewInstructions { alias: Some(alias) } => vec!["review-instructions", "--alias", alias],
        Command::AuditInstructions { coverage: false } => vec!["audit-instructions"],
        Command::AuditInstructions { coverage: true } => vec!["audit-instructions", "--coverage"],
    };
    let Some(rendered) = instruction_surfaces::render(&arguments) else {
        eprintln!("cadence: {} is not a review command", arguments[2]);
        return std::process::ExitCode::FAILURE;
    };
    match std::io::stdout().lock().write_all(rendered.as_bytes()) {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(_) => std::process::ExitCode::FAILURE,
    }
}

/// Serve MCP until EOF or SIGTERM, then drain under one shared deadline.
fn run_serve(project_root: Option<std::path::PathBuf>) -> std::process::ExitCode {
    let project = match project_root.map(Ok).unwrap_or_else(std::env::current_dir) {
        Ok(project) => project,
        Err(_) => return std::process::ExitCode::FAILURE,
    };
    let runtime = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    let outcome = runtime.block_on(async {
        let handler = match server::CadenceServer::new().bind_project(&project) {
            Ok(handler) => handler,
            Err(_) => {
                eprintln!("cadence: project root is unavailable");
                return std::process::ExitCode::FAILURE;
            }
        };
        let admission = review_ingress::AdmissionQueue::new(handler.clone());
        #[cfg(unix)]
        let mut terminate = match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(signal) => signal,
            Err(error) => {
                eprintln!("cadence: cannot listen for SIGTERM: {error}");
                return std::process::ExitCode::FAILURE;
            }
        };
        #[cfg(unix)]
        {
            let admission = admission.clone();
            tokio::spawn(async move {
                terminate.recv().await;
                admission.close();
            });
        }
        let (transport, input_failed) = review_ingress::InputTransport::new(
            tokio::io::stdin(), tokio::io::stdout(), admission.clone());
        let service_handler = handler.clone();
        let mut service = tokio::spawn(async move {
            match service_handler.serve(transport).await {
                Ok(service) => service.waiting().await.map(|_| ()),
                Err(ServerInitializeError::ConnectionClosed(_) | ServerInitializeError::Cancelled) => Ok(()),
                Err(error) => {
                    eprintln!("cadence: failed to start MCP server: {error}");
                    return false;
                }
            }.is_ok()
        });
        let service_ok = tokio::select! {
            _ = admission.closed() => true,
            result = &mut service => {
                admission.close();
                result.unwrap_or(false)
            }
        };
        let drained = match admission.drain(&handler).await {
            Ok(()) => true,
            Err(review_ingress::ShutdownError::Limit(limit)) => {
                eprintln!("{}", cadence::store::writer::drain_limit_diagnostic(&limit));
                false
            }
            Err(review_ingress::ShutdownError::Worker) => {
                eprintln!("cadence: shutdown worker failed");
                false
            }
        };
        if service_ok && drained && !input_failed.load(std::sync::atomic::Ordering::Acquire) {
            std::process::ExitCode::SUCCESS
        } else {
            std::process::ExitCode::FAILURE
        }
    });
    // stdin and storage can be in blocking syscalls. Never add an unbounded
    // runtime destructor wait to the coordinator's ten-second deadline.
    runtime.shutdown_timeout(std::time::Duration::ZERO);
    outcome
}
