//! The shipped user commands and their shared front matter descriptions.
use serde::Serialize;
use serde_json::{Value, json};

#[derive(Serialize)]
pub struct Command {
    pub name: &'static str,
    pub cluster: &'static str,
    pub description: &'static str,
}

pub const CLUSTERS: &[&str] = &[
    "Build spine", "Review & quality gates", "Lifecycle & git", "Support",
];

pub const COMMANDS: &[Command] = &[
    Command { name: "cad-new-project", cluster: "Build spine", description: "Initialize a project through deep questioning - PROJECT.md, REQUIREMENTS.md, a phased ROADMAP.md and .planning/ state" },
    Command { name: "cad-adopt", cluster: "Build spine", description: "Initialize .planning/ from a repo that already exists - PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the code and the git history" },
    Command { name: "cad-context", cluster: "Build spine", description: "Discuss a phase's scope, decisions and truths with its owner, then publish only the exact approved set through Cadence" },
    Command { name: "cad-plan", cluster: "Build spine", description: "Author a phase's plans and publish the exact owner-approved content through Cadence" },
    Command { name: "cad-execute", cluster: "Build spine", description: "Execute a native phase: the binary composes each executor dispatch from state and owns every task, run and suite receipt." },
    Command { name: "cad-verify", cluster: "Build spine", description: "Inspect a phase through the retained native verifier dispatch." },
    Command { name: "cad-progress", cluster: "Build spine", description: "Show derived phase status, located issues, records, captures and the next action." },
    Command { name: "cad-task", cluster: "Build spine", description: "Execute a small off-roadmap task with atomic commits - inline by default, --plan for multi-step work" },
    Command { name: "cad-review", cluster: "Review & quality gates", description: "Review one explicitly selected target - a decision, a minimalism delete-list over code, or a plan - through the native review subsystem." },
    Command { name: "cad-plan-review", cluster: "Review & quality gates", description: "Alias of /cad-review plan: review a phase's native plan slices with its locked context, or one plan document." },
    Command { name: "cad-decision-review", cluster: "Review & quality gates", description: "Alias of /cad-review decision: refute one named decision in one named document." },
    Command { name: "cad-minimalism-review", cluster: "Review & quality gates", description: "Alias of /cad-review minimalism: a ranked delete-list over one file, one frozen directory or one native phase range." },
    Command { name: "cad-debug", cluster: "Review & quality gates", description: "Resume a recorded debug session, review its staged fix, and offer a configured consult at dead ends." },
    Command { name: "cad-coverage", cluster: "Review & quality gates", description: "Read-only alias of /cad-audit: the phase-scoped requirement-to-evidence trace over the retained map and current verdicts; the test-generation arm is removed." },
    Command { name: "cad-docs-verify", cluster: "Review & quality gates", description: "Verify docs claims against the live codebase - paths, commands, symbols, config keys - each reported accurate, stale or unverifiable. Reports; it does not rewrite docs" },
    Command { name: "cad-audit", cluster: "Review & quality gates", description: "Read-only verification audit: every requirement's phase-scoped trace to its plans, truths, evidence and current verdicts, with each broken edge named." },
    Command { name: "cad-land", cluster: "Lifecycle & git", description: "Authorize landing steps, confirm the merge and follow ordered local cleanup." },
    Command { name: "cad-milestone", cluster: "Lifecycle & git", description: "Close and prune a milestone, or confirm an explicit release manifest bump before landing." },
    Command { name: "cad-phase", cluster: "Lifecycle & git", description: "CRUD phases in ROADMAP - add, insert, remove, edit, with remove/insert renumbering the following phases, their .planning dirs and every phase reference" },
    Command { name: "cad-undo", cluster: "Lifecycle & git", description: "Undo a phase's exact recorded commits and report retained progress." },
    Command { name: "cad-capture", cluster: "Support", description: "Park a phase-linked todo, a seed for a later milestone, or a note, as one typed item." },
    Command { name: "cad-config", cluster: "Support", description: "Configure supported settings through the native roles, cost and risk-floor interview." },
    Command { name: "cad-help", cluster: "Support", description: "List Cadence commands shipped under skills/ by cluster, or show one command and its compiled description." },
    Command { name: "cad-pause", cluster: "Support", description: "Pause work cleanly - a WIP commit of in-flight changes plus a STATE cursor set to paused with a one-line resume pointer (/cad-progress offers to resume it)" },
    Command { name: "cad-spike", cluster: "Support", description: "Record risk-ordered spike criteria before experimenting, then retain observations and a bounded verdict." },
    Command { name: "cad-suggest", cluster: "Support", description: "Show retune suggestions from retained decisions and apply only an accepted payload." },
    Command { name: "cad-why", cluster: "Support", description: "Explain file[:line] through its git and planning history, or list a phase's journal refusals with <phase> refusals." },
];

pub fn description(name: &str) -> &'static str {
    COMMANDS.iter().find(|row| row.name == name).expect("compiled user skill").description
}

/// Replace only a description value, preserving its quoted/plain form and all
/// other bytes. Also used to regenerate the seven authored skill bodies.
pub fn render_description(name: &str, markdown: &str) -> Option<String> {
    let row = COMMANDS.iter().find(|row| row.name == name)?;
    let (frontmatter, _) = markdown.strip_prefix("---\n")?.split_once("\n---\n")?;
    let marker = "\ndescription: ";
    let start = 4 + frontmatter.find(marker)? + marker.len();
    let end = start + markdown[start..].find('\n')?;
    let description = if markdown[start..end].starts_with('"') {
        serde_json::to_string(row.description).expect("description string")
    } else {
        row.description.to_owned()
    };
    Some(format!("{}{description}{}", &markdown[..start], &markdown[end..]))
}

pub fn answer(name: Option<&str>) -> Value {
    let Some(name) = name else {
        let clusters: Vec<_> = CLUSTERS.iter().map(|cluster| json!({
            "name": cluster,
            "commands": COMMANDS.iter().filter(|row| row.cluster == *cluster).collect::<Vec<_>>(),
        })).collect();
        return json!({"status":"ok", "clusters":clusters});
    };
    let name = name.strip_prefix('/').unwrap_or(name);
    let name = name.strip_prefix("cad-").unwrap_or(name);
    let rows: Vec<_> = COMMANDS.iter().filter(|row| row.name.strip_prefix("cad-") == Some(name)).collect();
    let mut closest = Vec::new();
    if rows.is_empty() {
        let mut ranked: Vec<_> = COMMANDS.iter().map(|row|
            (edit_distance(name, row.name.strip_prefix("cad-").unwrap()), row.name)).collect();
        ranked.sort_unstable();
        closest.extend(ranked.into_iter().take(3).map(|(_, name)| name));
    }
    json!({"status":"ok", "rows":rows, "closest":closest})
}

fn edit_distance(left: &str, right: &str) -> usize {
    let right: Vec<_> = right.chars().collect();
    let mut previous: Vec<_> = (0..=right.len()).collect();
    for (i, a) in left.chars().enumerate() {
        let mut current = vec![i + 1];
        for (j, b) in right.iter().enumerate() {
            current.push((current[j] + 1).min(previous[j + 1] + 1)
                .min(previous[j] + usize::from(a != *b)));
        }
        previous = current;
    }
    previous[right.len()]
}
