//! Assertions over real compiled products, with no checkout or process seam.
//!
//! Candidate grammar (before any authority lookup): a config name is a complete
//! backticked dotted identifier, a dotted JSON object key, or a code span directly
//! introduced by `config key`. Segments contain letters, digits, `_` and `-`, with
//! optional bracketed indices. Only explicit `<role>`, `<provider>` and `<trigger>`
//! segments expand over compiled vocabularies. Relative `.field` and embedded
//! `<attempt.field>` placeholders are field syntax, not complete identifiers.
//! `answer field`, `request field` and `dispatch field` must directly introduce
//! each excluded code span. Literal `file`/`path` and caller `code`/`language API`
//! markers likewise classify their next span before lookup; slash paths and
//! language examples inside prose strings are not dotted identifiers or JSON keys.
//! Operations are JSON operation string values/consts, `operation: name` spans,
//! and explicit cadence_query/apply invocations (including slash-separated names).
//! The grammatical connectors `with`, `operation`, `permission` and `an` after a
//! bare tool name introduce prose, not an invocation. Skill candidates use
//! `/cad-*` syntax, including `skills/cad-*/SKILL.md`; bare agent names do not.
//! Hook candidates are code spans directly introduced by `hook event`.

use std::collections::BTreeSet;

use cadence::execution::{instructions, render::RENDERED_PROJECT_FILES};
use regex::Regex;

fn corpus() -> Vec<(String, String)> {
    let mut surfaces: Vec<_> = RENDERED_PROJECT_FILES.iter().map(|file| {
        (file.path.to_owned(), super::instruction_surfaces::render(file.command)
            .unwrap_or_else(|| panic!("{}: no renderer for {:?}", file.path, file.command)))
    }).collect();
    // An explicit canonical alias is also accepted by main.rs.
    surfaces.push(("review-instructions --alias cad-review".into(),
        super::instruction_surfaces::render(&["review-instructions", "--alias", "cad-review"])
            .expect("canonical review alias")));
    surfaces.push(("executor dispatch_text".into(), instructions::dispatch_text()));
    for present in instructions::MANIFESTS.iter().map(|(name, _)| vec![*name])
        .chain(std::iter::once(Vec::new()))
    {
        surfaces.push((format!("executor command_policy {present:?}"),
            instructions::command_policy(&[], &present).to_string()));
    }
    surfaces.extend(cadence::help::table::COMMANDS.iter()
        .map(|command| (format!("help description {}", command.name), command.description.to_owned())));
    surfaces.push(("reviewer brief".into(), cadence::review::provider::payload::brief().to_owned()));
    surfaces
}

fn config_expansions(token: &str) -> Vec<String> {
    let schema = super::config::schema();
    let family = |prefix: &str| -> BTreeSet<&str> {
        schema.keys().filter_map(|key| key.strip_prefix(prefix)?.split('.').next()).collect()
    };
    let roles: BTreeSet<_> = super::config::roles::ROLES.into_iter().collect();
    let mut expanded = vec![token.to_owned()];
    for (marker, vocabulary) in [
        ("<role>", roles),
        ("<provider>", family("review.providers.")),
        ("<trigger>", family("review.triggers.")),
    ] {
        expanded = expanded.into_iter().flat_map(|name| {
            if name.contains(marker) {
                vocabulary.iter().map(|value| name.replace(marker, value)).collect()
            } else {
                vec![name]
            }
        }).collect();
    }
    expanded
}

#[test]
fn compiled_instructions_name_only_what_exists() {
    let schema = super::config::schema();
    let operations: BTreeSet<_> = super::server::query_operation_names()
        .chain(super::server::apply_operation_names()).collect();
    // Hand-authored skills, traced against skills/ independently of this assertion.
    let mut skills: BTreeSet<_> = [
        "cad-assumptions-analyzer-contract", "cad-plan-checker-contract",
        "cad-planner-contract", "cad-review-delivery", "cad-reviewer-contract",
    ].into_iter().collect();
    skills.extend(cadence::help::table::COMMANDS.iter().map(|command| command.name));
    skills.extend(RENDERED_PROJECT_FILES.iter().map(|file| {
        file.path.strip_prefix("skills/").unwrap().strip_suffix("/SKILL.md").unwrap()
    }));
    // guard::input and guard::bash accept this named event. The hook manifest is
    // a separate artifact, never a member of this instruction corpus.
    let hook_events = ["PreToolUse"];
    let segment = r"(?:[A-Za-z_][A-Za-z0-9_-]*(?:\[[A-Za-z0-9_]+\])?|<(?:role|provider|trigger)>)";
    let dotted = Regex::new(&format!(r"^{segment}(?:\.{segment})+$")).unwrap();
    let identifier = Regex::new(&format!(r"^{segment}(?:\.{segment})*$")).unwrap();
    let spans = Regex::new(r"`([^`\n]+)`").unwrap();
    let keys = Regex::new(r#""([^"\n]+)"\s*:"#).unwrap();
    let json_operations = Regex::new(r#""operation"\s*:\s*"([^"]+)""#).unwrap();
    let operation_consts = Regex::new(r#""operation"\s*:\s*\{[^{}]*"const"\s*:\s*"([^"]+)""#).unwrap();
    let operation_fields = Regex::new(r#"\boperation:\s*"?([a-z][a-z0-9_-]*)"#).unwrap();
    let invocations = Regex::new(r"\bcadence_(?:query|apply)(?:`\s+with\s+`|\s+(?:with\s+operation\s+)?)([a-z][a-z0-9_/-]*)").unwrap();
    let skill_names = Regex::new(r"/(cad-[a-z0-9-]+)").unwrap();
    let mut unresolved = BTreeSet::new();
    for (surface, text) in corpus() {
        let mut candidates = BTreeSet::new();
        for capture in spans.captures_iter(&text) {
            let whole = capture.get(0).unwrap();
            let token = &capture[1];
            let prefix = text[..whole.start()].trim_end();
            if prefix.ends_with("hook event") {
                candidates.insert(("hook event", token.to_owned()));
                continue;
            }
            if ["answer field", "request field", "dispatch field", "file", "path", "code", "language API"]
                .iter().any(|marker| prefix.ends_with(marker))
            {
                continue;
            }
            if dotted.is_match(token) || (prefix.ends_with("config key") && identifier.is_match(token)) {
                candidates.insert(("config key", token.to_owned()));
            }
        }
        for capture in keys.captures_iter(&text) {
            if dotted.is_match(&capture[1]) {
                candidates.insert(("config key", capture[1].to_owned()));
            }
        }
        for pattern in [&json_operations, &operation_consts, &operation_fields] {
            for capture in pattern.captures_iter(&text) {
                candidates.insert(("wire operation", capture[1].to_owned()));
            }
        }
        for capture in invocations.captures_iter(&text) {
            if !["with", "operation", "permission", "an"].contains(&&capture[1]) {
                candidates.extend(capture[1].split('/').map(|name| ("wire operation", name.to_owned())));
            }
        }
        for capture in skill_names.captures_iter(&text) {
            candidates.insert(("skill", capture[1].to_owned()));
        }
        // No candidate is filtered by membership before this point.
        for (kind, token) in candidates {
            let known = match kind {
                "config key" => config_expansions(&token).iter().all(|name| schema.contains_key(name)),
                "wire operation" => operations.contains(token.as_str()),
                "skill" => skills.contains(token.as_str()),
                "hook event" => hook_events.contains(&token.as_str()),
                _ => unreachable!(),
            };
            if !known {
                unresolved.insert(format!("{surface}: {kind} `{token}`"));
            }
        }
    }
    assert!(unresolved.is_empty(), "unresolved compiled instruction names:\n{}",
        unresolved.into_iter().collect::<Vec<_>>().join("\n"));
}

#[test]
fn schema_defaults_match_their_declared_domain() {
    for (key, spec) in super::config::schema() {
        // Retired entries are migration evidence, with no live default required.
        if spec["disposition"] == "dead" {
            continue;
        }
        let default = spec.get("default").unwrap_or_else(|| panic!("{key}: missing default"));
        // Import semantics admit explicit null array defaults as unanswered;
        // missing defaults must not be silently substituted with null.
        assert!(super::config::reload::valid_type(spec, default, true)
            && super::config::write::valid_grammar(spec, default),
            "{key}: default {default} is outside its declared domain {spec}");
    }
}

#[test]
fn rendered_files_obey_named_byte_ceilings() {
    let ceilings = [
        ("skills/cad-help/SKILL.md", 1024),
        ("skills/cad-spike/SKILL.md", 6144),
        ("skills/cad-debug/SKILL.md", 15360),
        ("skills/cad-undo/SKILL.md", 4096),
        ("skills/cad-land/SKILL.md", 8192),
        ("skills/cad-milestone/SKILL.md", 6144),
        ("skills/cad-suggest/SKILL.md", 1536),
        ("skills/cad-why/SKILL.md", 4096),
        ("skills/cad-progress/SKILL.md", 1024),
        ("skills/cad-capture/SKILL.md", 1536),
        ("skills/cad-context/SKILL.md", 24576),
        ("skills/cad-plan/SKILL.md", 57344),
        ("skills/cad-executor-contract/SKILL.md", 28672),
        ("skills/cad-execute/SKILL.md", 20480),
        ("skills/cad-verifier-contract/SKILL.md", 18432),
        ("skills/cad-verify/SKILL.md", 18432),
        ("skills/cad-review/SKILL.md", 12288),
        ("skills/cad-decision-review/SKILL.md", 12288),
        ("skills/cad-minimalism-review/SKILL.md", 12288),
        ("skills/cad-plan-review/SKILL.md", 12288),
        ("skills/cad-audit/SKILL.md", 9216),
        ("skills/cad-coverage/SKILL.md", 9216),
        ("skills/cad-read-contract/SKILL.md", 6144),
        ("skills/cad-task/SKILL.md", 32768),
    ];
    for file in RENDERED_PROJECT_FILES {
        let ceiling = ceilings.iter().find(|(path, _)| *path == file.path)
            .unwrap_or_else(|| panic!("{}: missing named byte ceiling", file.path)).1;
        let rendered = super::instruction_surfaces::render(file.command)
            .unwrap_or_else(|| panic!("{}: missing renderer", file.path));
        assert!(rendered.len() <= ceiling,
            "{}: {} UTF-8 bytes exceed the {ceiling}-byte ceiling", file.path, rendered.len());
    }
}

#[test]
fn compiled_contracts_send_source_reads_to_host_tools() {
    let expected = "Search and read code with the host's file, search and shell tools: locate first, then read only the lines the work needs rather than whole files.";
    let carriers = [
        "skills/cad-context/SKILL.md",
        "skills/cad-plan/SKILL.md",
        "skills/cad-executor-contract/SKILL.md",
        "skills/cad-execute/SKILL.md",
        "skills/cad-task/SKILL.md",
        "skills/cad-verifier-contract/SKILL.md",
        "skills/cad-verify/SKILL.md",
        "skills/cad-review/SKILL.md",
        "skills/cad-decision-review/SKILL.md",
        "skills/cad-minimalism-review/SKILL.md",
        "skills/cad-plan-review/SKILL.md",
        "skills/cad-audit/SKILL.md",
        "skills/cad-coverage/SKILL.md",
        "skills/cad-read-contract/SKILL.md",
        "executor dispatch_text",
        "server initialize instructions",
    ];
    let surfaces = compiled_read_surfaces();
    for carrier in carriers {
        let (_, text) = surfaces
            .iter()
            .find(|(name, _)| *name == carrier)
            .unwrap_or_else(|| panic!("{carrier}: missing compiled surface"));
        assert!(text.contains(expected), "{carrier}: missing host-tools sentence");
    }
}

#[test]
fn no_compiled_surface_carries_a_phase_31_measurement_paragraph() {
    let retired_openings = [
        "For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed.",
        "For the read-layer cycle-purpose close, schedule a new real Claude-host planning",
        "For a read-layer cycle-purpose truth, inspect a new real Claude-host planning",
    ];
    for (surface, text) in compiled_read_surfaces() {
        for opening in retired_openings {
            assert!(
                !text.contains(opening),
                "{surface}: retains phase 31 measurement paragraph starting {opening:?}"
            );
        }
    }
}

#[test]
fn the_query_tool_description_sends_source_reads_to_host_tools() {
    let expected = "Read process records through document and document-search; read project source with the host's own tools.";
    let tools = super::server::tools();
    let query = tools
        .iter()
        .find(|tool| tool.name == "cadence_query")
        .expect("cadence_query tool");
    let description = query.description.as_deref().expect("cadence_query description");
    assert!(
        description.contains(expected),
        "cadence_query description: missing host-tools sentence"
    );
}

#[test]
fn plan_instructions_derive_tests_from_behavior() {
    let text = cadence::plan::instructions::markdown();
    let derivation = "Start from the approved behavior and the changes needed to deliver it. Treat a
plan step as a container for work; separate its independently testable
responsibilities instead of testing the whole step. For each responsibility,
choose input classes, decision edges and failure responses justified by the
requirement. Take expected values from that requirement; never invent behavior
to make an answer available. Flag ambiguity for the owner to clarify.";
    let bounded_cases = "A generated unit test exercises one responsibility and one behavior, using at
most one simulated external seam; split a unit that touches two. Run the real
logic that owns the decision with supplied observations and independently
justified expectations. In the one check's existing fields, connect the
approved truth, production responsibility, inputs or seam, expected observable
result and test. Name every other test in the task action with the meaningful
defect it would catch. Stop when another case would distinguish no new required
behavior or meaningful failure. Reuse adequate existing tests and relevant
regressions; do not pursue test counts, a test per function, blanket
permutations or coverage percentages. Use the managed project's approved
language and test framework; Cadence being written in Rust does not choose the
project's language.";
    let gathering = "Classify an adapter as pure gathering only after separating its owned parsing,
validation, error interpretation and decisions; test those responsibilities,
and give the pure gatherer no unit test. Use plain values when they suffice.
Judge a fake against the responsibility being exercised: it must not provide
that decision. A domain value can be a supplied observation for a different,
downstream decision; its type alone does not disqualify it.";
    for (name, expected) in [
        ("behavior derivation", derivation),
        ("bounded cases", bounded_cases),
        ("gathering and responsibility-relative fakes", gathering),
    ] {
        assert!(text.contains(expected), "plan markdown: missing {name} block");
    }
}

#[test]
fn plan_instructions_bound_test_dependencies() {
    let text = cadence::plan::instructions::markdown();
    let expected = "A generated test may rely only on the project's language toolchain and test
libraries, including mocking libraries, from that language's package ecosystem.
It must need no other language runtime, host-installed program, particular
hardware or pre-existing machine state, and give the same result wherever the
project builds. Test code starts no program. Cadence may launch the approved
test runner; that permission does not let test code launch a program.

A test may create a fresh temporary directory as its one filesystem seam. Keep
its reads and writes inside that directory and start no program there. Make no
assertion depend on filesystem permissions, case sensitivity, symlink support
or crash durability. Preserve the current runner boundaries; propose a needed
runner change separately rather than adding an unsupported integration.";
    assert!(
        text.contains(expected),
        "plan markdown: missing dependency and temporary-directory block"
    );
}

#[test]
fn plan_instructions_state_the_close_rule() {
    let planner = "Keep one check per truth. Its test file holds only tests, with one test per
responsibility; never place it beside production code that the task changes in
the same file. The check names the test that causes the truth's trigger. Name
the task's other tests in its action, with the defect each catches, rather than
adding checks for them. Commit every test of the task before its red run, with
production code that compiles so red is an assertion failure. The whole check
test file must have identical bytes at the red commit, green commit and task
completion commit, and the red and green commands must match, or the task
cannot close. Freeze that file through the owning task's completion; a later
task may add tests only after that close.";
    let executor = "   green run at a later green commit, using the same command; and a passing
   observed run of every named task command at the completion commit. Each
   check's file contains only tests. Commit all tests owned by this task before
   red, while production code still compiles. Keep the whole test file byte for
   byte identical at red, green and the task's completion commit; changing it
   prevents task close. Hold it fixed until this task closes. A refusal names
   each unsatisfied check; nothing is manufactured after the fact.";
    for (carrier, text, expected) in [
        ("plan markdown", cadence::plan::instructions::markdown(), planner),
        ("executor contract", instructions::contract_markdown(), executor),
    ] {
        assert!(text.contains(expected), "{carrier}: missing complete close-rule block");
    }
}

#[test]
fn plan_instructions_keep_live_verification_open() {
    let text = cadence::plan::instructions::markdown();
    let expected = "When this phase first makes a running-program obligation from the context's
Live verification list runnable, add it to this map as a pending observation.
Constituent unit tests cannot establish integration, GUI interaction, real
persistence, performance or an assembled workflow, and passing them does not
close that obligation. Do not waive it, rename it a unit test or weaken the
promise. State what remains unverified.";
    assert!(text.contains(expected), "plan markdown: missing live-verification block");
}

#[test]
fn context_instructions_separate_the_live_part() {
    let text = cadence::context::instructions::markdown();
    let expected = "## Owned decisions and live verification

Name the decision the project owns in each truth, while keeping its trigger and
outcome observable to the named party. List the part that requires a running
program separately under a Live verification heading in the context scope.
That part becomes an observation in the evidence map of the phase that first
makes it runnable; do not add a field to the truth. Passing unit tests do not
close this live obligation.";
    assert!(text.contains(expected), "context markdown: missing owned-decision and live-verification section");
}

#[test]
fn plan_review_asks_the_test_questions() {
    let expected = "For each proposed test, ask: does it serve the approved requirement, can its assertion catch the defect it names, and does a fake provide the very decision being tested? Judge the fake relative to the responsibility the test exercises, using plain inputs where they suffice.";
    for carrier in [
        "cad-review",
        "cad-decision-review",
        "cad-minimalism-review",
        "cad-plan-review",
    ] {
        let text = cadence::review::instructions::frontdoor_markdown(carrier)
            .unwrap_or_else(|| panic!("{carrier}: missing review front door"));
        assert!(text.contains(expected), "{carrier}: missing plan-review question block");
    }
    let intent = cadence::review::instructions::intent_for(cadence::review::selection::Kind::Plan);
    assert!(intent.contains(expected), "plan intent: missing plan-review question block");
    let brief = cadence::review::provider::payload::brief();
    let expected_brief = "  For its tests, ask whether each serves the approved requirement, whether the
  assertion can expose the stated defect, and whether a fake supplies the
  decision the test is meant to exercise. Assess the fake relative to the
  responsibility that test exercises, not merely the type of value it returns.";
    assert!(brief.contains(expected_brief), "provider brief: missing plan-review question block");
}

#[test]
fn plan_review_keeps_existing_completion_judgments() {
    let text = cadence::review::instructions::frontdoor_markdown("cad-plan-review")
        .expect("cad-plan-review front door");
    let expected = "These questions are advisory to plan submission and add no plan-submit gate. The owner's exact check inspection at execution-plan-complete and the verifier's item verdicts at verification-complete remain required completion judgments.";
    assert!(text.contains(expected), "cad-plan-review: missing advisory and completion-judgment block");
}

#[test]
fn verifier_contract_states_what_is_not_evidence() {
    let expected = "Keep the stages of evidence distinct: planned, written, reviewed, executed and
passed. A test name, declaration, comment or model assertion is not evidence
that a test executed. A passing run alone does not establish that its assertion
examines the required behavior. Inspect the actual assertion against its
requirement and named defect, including whether a fake supplies the decision.

Names, type labels, declared boundaries, source patterns and a passing runner
do not prove semantic correctness or the absence of indirect dependencies.
Report an unsupported or inconclusive check with that limitation; never turn
incomplete analysis into a compliance claim. Record rejected
when a check ran but does not establish the behavior, and not_seen only when
the evidence was unavailable, stating what was observed; never invent a new
status or accept unsupported evidence.";
    for (carrier, text) in [
        ("cad-verifier-contract", cadence::verification::instructions::contract_markdown()),
        ("cad-verify", cadence::verification::instructions::frontdoor_markdown()),
    ] {
        assert!(text.contains(expected), "{carrier}: missing evidence-limits block");
    }
}

fn compiled_read_surfaces() -> Vec<(&'static str, String)> {
    let mut surfaces: Vec<_> = RENDERED_PROJECT_FILES
        .iter()
        .map(|file| {
            let rendered = super::instruction_surfaces::render(file.command)
                .unwrap_or_else(|| panic!("{}: missing renderer", file.path));
            (file.path, rendered)
        })
        .collect();
    surfaces.push(("executor dispatch_text", instructions::dispatch_text()));
    surfaces.push((
        "server initialize instructions",
        super::server::info().instructions.expect("initialize instructions"),
    ));
    surfaces
}
