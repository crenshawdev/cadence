use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde::{Deserialize, Serialize};
use serde_saphyr::{DuplicateKeyPolicy, MergeKeyPolicy, Spanned};
use sha2::{Digest, Sha256};

use super::model::{EXECUTION_SCHEMA, ExecutionPlan, TaskSpec};

pub const MAX_DOCUMENT_BYTES: usize = 1_048_576;
pub const MAX_FRONTMATTER_BYTES: usize = 262_144;
pub const MAX_FIELDS: usize = 256;
pub const MAX_FIELD_BYTES: usize = 8_192;
pub const MAX_TASKS: usize = 64;
pub const MAX_COMMANDS: usize = 256;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlanError {
    pub code: &'static str,
    pub detail: String,
}

impl PlanError {
    fn new(code: &'static str, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
        }
    }
}

impl fmt::Display for PlanError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.detail)
    }
}

impl std::error::Error for PlanError {}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Frontmatter {
    phase: Spanned<u32>,
    plan: Spanned<u32>,
    requirements: Vec<String>,
    files: Vec<String>,
    execution: ExecutionFields,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExecutionFields {
    schema: u32,
    suite: String,
    tasks: Vec<TaskSpec>,
}

#[derive(Serialize)]
struct FingerprintPlan<'a> {
    phase: u32,
    plan: u32,
    requirements: &'a [String],
    files: &'a [String],
    schema: u32,
    suite: &'a str,
    tasks: &'a [TaskSpec],
    body: &'a [u8],
}

impl<'a> From<&'a ExecutionPlan> for FingerprintPlan<'a> {
    fn from(plan: &'a ExecutionPlan) -> Self {
        Self {
            phase: plan.phase,
            plan: plan.plan,
            requirements: &plan.requirements,
            files: &plan.files,
            schema: plan.schema,
            suite: &plan.suite,
            tasks: &plan.tasks,
            body: plan.body.as_bytes(),
        }
    }
}

pub fn parse_plan(
    bytes: &[u8],
    expected_phase: u32,
    expected_plan: u32,
) -> Result<ExecutionPlan, PlanError> {
    if expected_phase == 0 || expected_plan == 0 {
        return Err(PlanError::new(
            "invalid-identity",
            "expected phase and plan must be positive integers",
        ));
    }
    if bytes.len() > MAX_DOCUMENT_BYTES {
        return Err(PlanError::new(
            "document-bound",
            format!("plan exceeds {MAX_DOCUMENT_BYTES} bytes"),
        ));
    }
    let source = std::str::from_utf8(bytes)
        .map_err(|_| PlanError::new("invalid-utf8", "plan is not valid UTF-8"))?;
    let (yaml, body) = split_frontmatter(source)?;
    if yaml.len() > MAX_FRONTMATTER_BYTES {
        return Err(PlanError::new(
            "frontmatter-bound",
            format!("frontmatter exceeds {MAX_FRONTMATTER_BYTES} bytes"),
        ));
    }
    reject_tag_syntax(yaml)?;

    let options = serde_saphyr::options! {
        budget: serde_saphyr::budget! {
            max_aliases: 0,
            max_anchors: 0,
            max_depth: 16,
            max_documents: 1,
            max_nodes: 2_048,
            max_total_scalar_bytes: MAX_FRONTMATTER_BYTES,
            max_merge_keys: 0,
        },
        duplicate_keys: DuplicateKeyPolicy::Error,
        merge_keys: MergeKeyPolicy::Error,
        strict_booleans: true,
        no_schema: true,
        reject_unsupported_tags: true,
        emit_comments: false,
    };
    let raw: Frontmatter = serde_saphyr::from_str_with_options(yaml, options)
        .map_err(|error| PlanError::new("invalid-frontmatter", error.to_string()))?;

    validate_canonical_number(yaml, &raw.phase, "phase")?;
    validate_canonical_number(yaml, &raw.plan, "plan")?;
    if raw.phase.value != expected_phase || raw.plan.value != expected_plan {
        return Err(PlanError::new(
            "identity-mismatch",
            format!(
                "frontmatter names phase {} plan {}, expected phase {expected_phase} plan {expected_plan}",
                raw.phase.value, raw.plan.value
            ),
        ));
    }
    if raw.execution.schema != EXECUTION_SCHEMA {
        return Err(PlanError::new(
            "unsupported-schema",
            format!("execution schema {} is not supported", raw.execution.schema),
        ));
    }
    validate_fields(&raw.requirements, "requirements")?;
    if raw.files.len() > MAX_FIELDS {
        return Err(PlanError::new(
            "field-bound",
            format!("files contains more than {MAX_FIELDS} entries"),
        ));
    }
    let files = raw
        .files
        .iter()
        .map(|path| normalize_lease_path(path))
        .collect::<Result<Vec<_>, _>>()?;
    let unique_files = files.iter().collect::<BTreeSet<_>>();
    if unique_files.len() != files.len() {
        return Err(PlanError::new(
            "duplicate-path",
            "files contains duplicate normalized paths",
        ));
    }
    validate_command(&raw.execution.suite, "suite")?;
    validate_tasks(&raw.execution.tasks)?;

    let mut plan = ExecutionPlan {
        phase: raw.phase.value,
        plan: raw.plan.value,
        requirements: raw.requirements,
        files,
        schema: raw.execution.schema,
        suite: raw.execution.suite,
        tasks: raw.execution.tasks,
        body: body.to_owned(),
        fingerprint: String::new(),
    };
    plan.fingerprint = fingerprint_bytes(&FingerprintPlan::from(&plan))?;
    Ok(plan)
}

fn split_frontmatter(source: &str) -> Result<(&str, &str), PlanError> {
    let opening_end = if source.starts_with("---\n") {
        4
    } else if source.starts_with("---\r\n") {
        5
    } else {
        return Err(PlanError::new(
            "missing-delimiter",
            "plan must begin with a frontmatter delimiter",
        ));
    };

    let mut cursor = opening_end;
    while cursor <= source.len() {
        let remaining = &source[cursor..];
        let line_end = remaining.find('\n').map_or(source.len(), |at| cursor + at);
        let line = source[cursor..line_end]
            .strip_suffix('\r')
            .unwrap_or(&source[cursor..line_end]);
        if line == "---" {
            let body_start = if line_end < source.len() {
                line_end + 1
            } else {
                line_end
            };
            return Ok((&source[opening_end..cursor], &source[body_start..]));
        }
        if line_end == source.len() {
            break;
        }
        cursor = line_end + 1;
    }
    Err(PlanError::new(
        "missing-delimiter",
        "frontmatter has no closing delimiter",
    ))
}

fn reject_tag_syntax(yaml: &str) -> Result<(), PlanError> {
    for line in yaml.lines() {
        if line.trim_start().starts_with("%TAG") {
            return Err(PlanError::new("yaml-tag", "YAML tags are not allowed"));
        }
    }
    let mut single = false;
    let mut double = false;
    let mut comment = false;
    let chars = yaml.char_indices().collect::<Vec<_>>();
    let mut index = 0;
    while index < chars.len() {
        let (offset, ch) = chars[index];
        if comment {
            if ch == '\n' {
                comment = false;
            }
            index += 1;
            continue;
        }
        if double {
            if ch == '\\' {
                index = (index + 2).min(chars.len());
                continue;
            }
            if ch == '"' {
                double = false;
            }
            index += 1;
            continue;
        }
        if single {
            if ch == '\'' {
                if chars.get(index + 1).is_some_and(|(_, next)| *next == '\'') {
                    index += 2;
                    continue;
                }
                single = false;
            }
            index += 1;
            continue;
        }
        match ch {
            '#' => comment = true,
            '"' => double = true,
            '\'' => single = true,
            '!' if is_token_boundary(yaml[..offset].chars().next_back()) => {
                return Err(PlanError::new("yaml-tag", "YAML tags are not allowed"));
            }
            _ => {}
        }
        index += 1;
    }
    Ok(())
}

fn is_token_boundary(previous: Option<char>) -> bool {
    previous.is_none_or(|ch| ch.is_whitespace() || "[{,:?-".contains(ch))
}

fn validate_canonical_number(
    yaml: &str,
    value: &Spanned<u32>,
    name: &str,
) -> Result<(), PlanError> {
    if value.value == 0 {
        return Err(PlanError::new(
            "invalid-integer",
            format!("{name} must be greater than zero"),
        ));
    }
    let span = value.referenced.span();
    let start = span
        .byte_offset()
        .and_then(|offset| usize::try_from(offset).ok());
    let len = span
        .byte_len()
        .and_then(|length| usize::try_from(length).ok());
    let raw = start
        .zip(len)
        .and_then(|(start, len)| yaml.get(start..start.saturating_add(len)))
        .ok_or_else(|| PlanError::new("invalid-integer", format!("cannot locate {name}")))?;
    if raw.is_empty() || raw.starts_with('0') || !raw.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(PlanError::new(
            "invalid-integer",
            format!("{name} must use canonical positive-integer spelling"),
        ));
    }
    Ok(())
}

fn validate_fields(values: &[String], name: &str) -> Result<(), PlanError> {
    if values.len() > MAX_FIELDS {
        return Err(PlanError::new(
            "field-bound",
            format!("{name} contains more than {MAX_FIELDS} entries"),
        ));
    }
    if values.iter().any(|value| value.len() > MAX_FIELD_BYTES) {
        return Err(PlanError::new(
            "field-bound",
            format!("{name} contains a field over {MAX_FIELD_BYTES} bytes"),
        ));
    }
    Ok(())
}

fn validate_tasks(tasks: &[TaskSpec]) -> Result<(), PlanError> {
    if tasks.is_empty() || tasks.len() > MAX_TASKS {
        return Err(PlanError::new(
            "task-bound",
            format!("execution tasks must contain 1 through {MAX_TASKS} entries"),
        ));
    }
    let mut ids = BTreeSet::new();
    let mut commands = 0usize;
    for task in tasks {
        if !valid_task_id(&task.id) {
            return Err(PlanError::new(
                "invalid-task-id",
                "task IDs must be nonblank ASCII identifiers",
            ));
        }
        if task.id.len() > MAX_FIELD_BYTES {
            return Err(PlanError::new(
                "field-bound",
                format!("task ID exceeds {MAX_FIELD_BYTES} bytes"),
            ));
        }
        if !ids.insert(&task.id) {
            return Err(PlanError::new("duplicate-task", "task IDs must be unique"));
        }
        if task.verify.is_empty() {
            return Err(PlanError::new(
                "missing-command",
                format!("task {} has no verify commands", task.id),
            ));
        }
        commands = commands.saturating_add(task.verify.len());
        for command in &task.verify {
            validate_command(command, "task verify")?;
        }
    }
    if commands > MAX_COMMANDS {
        return Err(PlanError::new(
            "command-bound",
            format!("execution contains more than {MAX_COMMANDS} verify commands"),
        ));
    }
    Ok(())
}

fn valid_task_id(id: &str) -> bool {
    let mut chars = id.chars();
    chars.next().is_some_and(|ch| ch.is_ascii_alphanumeric())
        && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

fn validate_command(command: &str, name: &str) -> Result<(), PlanError> {
    if command.trim().is_empty() {
        return Err(PlanError::new(
            "blank-command",
            format!("{name} command must not be blank"),
        ));
    }
    if command.len() > MAX_FIELD_BYTES {
        return Err(PlanError::new(
            "field-bound",
            format!("{name} command exceeds {MAX_FIELD_BYTES} bytes"),
        ));
    }
    Ok(())
}

fn normalize_lease_path(input: &str) -> Result<String, PlanError> {
    if input.is_empty() || input.len() > MAX_FIELD_BYTES || input.contains('\0') {
        return Err(PlanError::new(
            "invalid-path",
            "lease path is blank or over bound",
        ));
    }
    let portable = input.replace('\\', "/");
    if portable.starts_with('/')
        || portable.starts_with("//")
        || portable.as_bytes().get(1).is_some_and(|byte| *byte == b':')
    {
        return Err(PlanError::new(
            "invalid-path",
            "lease path must be relative",
        ));
    }
    let mut normalized = Vec::new();
    for component in portable.split('/') {
        match component {
            "" | "." => {}
            ".." => {
                return Err(PlanError::new(
                    "invalid-path",
                    "lease path must not traverse upward",
                ));
            }
            value if value.chars().any(char::is_control) => {
                return Err(PlanError::new(
                    "invalid-path",
                    "lease path contains a control character",
                ));
            }
            value => normalized.push(value),
        }
    }
    if normalized.is_empty() {
        return Err(PlanError::new(
            "invalid-path",
            "lease path has no file component",
        ));
    }
    Ok(normalized.join("/"))
}

fn fingerprint_bytes<T: Serialize>(value: &T) -> Result<String, PlanError> {
    let bytes = serde_json::to_vec(value)
        .map_err(|error| PlanError::new("fingerprint", error.to_string()))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

pub fn plan_set_fingerprint(plans: &[ExecutionPlan]) -> Result<String, PlanError> {
    let mut ordered = plans.iter().collect::<Vec<_>>();
    ordered.sort_by_key(|plan| plan.plan);
    validate_plan_set(&ordered)?;
    let values = ordered
        .into_iter()
        .map(FingerprintPlan::from)
        .collect::<Vec<_>>();
    fingerprint_bytes(&values)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlanGraph {
    plans: BTreeSet<u32>,
    prerequisites: BTreeMap<u32, BTreeSet<u32>>,
}

impl PlanGraph {
    pub fn build(plans: &[ExecutionPlan]) -> Result<Self, PlanError> {
        let ordered = plans.iter().collect::<Vec<_>>();
        validate_plan_set(&ordered)?;
        let plan_numbers = plans.iter().map(|plan| plan.plan).collect::<BTreeSet<_>>();
        let mut prerequisites = plan_numbers
            .iter()
            .map(|plan| (*plan, BTreeSet::new()))
            .collect::<BTreeMap<_, _>>();
        for (index, left) in plans.iter().enumerate() {
            for right in &plans[index + 1..] {
                if left.files.iter().any(|path| right.files.contains(path)) {
                    let (before, after) = if left.plan < right.plan {
                        (left.plan, right.plan)
                    } else {
                        (right.plan, left.plan)
                    };
                    prerequisites.entry(after).or_default().insert(before);
                }
            }
        }
        Ok(Self {
            plans: plan_numbers,
            prerequisites,
        })
    }

    pub fn prerequisites(&self, plan: u32) -> Option<&BTreeSet<u32>> {
        self.prerequisites.get(&plan)
    }

    pub fn ready(&self, completed: &BTreeSet<u32>) -> Vec<u32> {
        self.plans
            .iter()
            .filter(|plan| {
                !completed.contains(plan)
                    && self
                        .prerequisites
                        .get(plan)
                        .is_some_and(|required| required.is_subset(completed))
            })
            .copied()
            .collect()
    }

    pub fn next_ready(&self, completed: &BTreeSet<u32>) -> Option<u32> {
        self.ready(completed).into_iter().next()
    }
}

fn validate_plan_set(plans: &[&ExecutionPlan]) -> Result<(), PlanError> {
    let Some(first) = plans.first() else {
        return Err(PlanError::new(
            "empty-plan-set",
            "plan set must not be empty",
        ));
    };
    let mut numbers = BTreeSet::new();
    for plan in plans {
        if plan.phase != first.phase {
            return Err(PlanError::new(
                "phase-mismatch",
                "all plans in a set must name the same phase",
            ));
        }
        if !numbers.insert(plan.plan) {
            return Err(PlanError::new(
                "duplicate-plan",
                "plan numbers in a set must be unique",
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(frontmatter: &str, body: &str) -> Vec<u8> {
        format!("---\n{frontmatter}---\n{body}").into_bytes()
    }

    fn valid_frontmatter() -> String {
        "phase: 6\nplan: 1\nrequirements: [AC2]\nfiles: [src/lib.rs]\nexecution:\n  schema: 1\n  suite: cargo test --workspace\n  tasks:\n    - id: T1\n      verify: [cargo test parser]\n".into()
    }

    fn parse(frontmatter: &str) -> Result<ExecutionPlan, PlanError> {
        parse_plan(&source(frontmatter, "# assignment\n"), 6, 1)
    }

    fn replace_valid(old: &str, new: &str) -> String {
        valid_frontmatter().replacen(old, new, 1)
    }

    #[test]
    fn unicode_body_is_preserved_without_interpretation() {
        let body = "# 任務 🚀\r\n\nVerify: do not run me\n";
        let plan = parse_plan(&source(&valid_frontmatter(), body), 6, 1).unwrap();
        assert_eq!(plan.body.as_bytes(), body.as_bytes());
        assert_eq!(plan.tasks[0].id, "T1");
        assert_eq!(plan.tasks[0].verify, ["cargo test parser"]);
    }

    #[test]
    fn missing_delimiters_are_rejected() {
        let missing_open = valid_frontmatter().into_bytes();
        assert_eq!(
            parse_plan(&missing_open, 6, 1).unwrap_err().code,
            "missing-delimiter"
        );
        let missing_close = format!("---\n{}", valid_frontmatter()).into_bytes();
        assert_eq!(
            parse_plan(&missing_close, 6, 1).unwrap_err().code,
            "missing-delimiter"
        );
    }

    #[test]
    fn invalid_utf8_is_rejected() {
        let mut bytes = source(&valid_frontmatter(), "body");
        bytes.push(0xff);
        assert_eq!(parse_plan(&bytes, 6, 1).unwrap_err().code, "invalid-utf8");
    }

    #[test]
    fn duplicate_and_unknown_keys_are_rejected() {
        let duplicate = replace_valid("plan: 1\n", "plan: 1\nplan: 1\n");
        assert_eq!(parse(&duplicate).unwrap_err().code, "invalid-frontmatter");
        let unknown = replace_valid("phase: 6\n", "phase: 6\nsurprise: true\n");
        assert_eq!(parse(&unknown).unwrap_err().code, "invalid-frontmatter");
        let nested = replace_valid("  schema: 1\n", "  schema: 1\n  depends_on: []\n");
        assert_eq!(parse(&nested).unwrap_err().code, "invalid-frontmatter");
        let task = replace_valid("      verify:", "      title: prose\n      verify:");
        assert_eq!(parse(&task).unwrap_err().code, "invalid-frontmatter");
    }

    #[test]
    fn aliases_anchors_tags_and_merge_keys_are_rejected() {
        let anchor = replace_valid("requirements: [AC2]", "requirements: &r [AC2]");
        assert_eq!(parse(&anchor).unwrap_err().code, "invalid-frontmatter");
        let alias = replace_valid(
            "requirements: [AC2]\nfiles: [src/lib.rs]",
            "requirements: &r [AC2]\nfiles: *r",
        );
        assert_eq!(parse(&alias).unwrap_err().code, "invalid-frontmatter");
        let tag = replace_valid("requirements: [AC2]", "requirements: !mine [AC2]");
        assert_eq!(parse(&tag).unwrap_err().code, "yaml-tag");
        let core_tag = replace_valid("phase: 6", "phase: !!int 6");
        assert_eq!(parse(&core_tag).unwrap_err().code, "yaml-tag");
        let merge = replace_valid("  schema: 1", "  <<: {schema: 1}");
        assert_eq!(parse(&merge).unwrap_err().code, "invalid-frontmatter");
    }

    #[test]
    fn multiple_yaml_documents_are_rejected() {
        let frontmatter = replace_valid("execution:\n", "...\nsecond: document\nexecution:\n");
        assert_eq!(parse(&frontmatter).unwrap_err().code, "invalid-frontmatter");
    }

    #[test]
    fn phase_and_plan_identity_must_match() {
        let bytes = source(&valid_frontmatter(), "body");
        assert_eq!(
            parse_plan(&bytes, 7, 1).unwrap_err().code,
            "identity-mismatch"
        );
        assert_eq!(
            parse_plan(&bytes, 6, 2).unwrap_err().code,
            "identity-mismatch"
        );
    }

    #[test]
    fn only_canonical_positive_integer_identities_are_accepted() {
        for spelling in ["0", "-1", "1.0", "1e0", "01", "+1", "'1'"] {
            let frontmatter = replace_valid("plan: 1", &format!("plan: {spelling}"));
            assert!(parse(&frontmatter).is_err(), "accepted {spelling}");
        }
    }

    #[test]
    fn task_ids_are_nonblank_unique_and_stable() {
        let blank = replace_valid("id: T1", "id: ' '");
        assert_eq!(parse(&blank).unwrap_err().code, "invalid-task-id");
        let duplicate = replace_valid(
            "    - id: T1\n      verify: [cargo test parser]",
            "    - id: T1\n      verify: [cargo test parser]\n    - id: T1\n      verify: [cargo test other]",
        );
        assert_eq!(parse(&duplicate).unwrap_err().code, "duplicate-task");
        let unstable = replace_valid("id: T1", "id: 'task one'");
        assert_eq!(parse(&unstable).unwrap_err().code, "invalid-task-id");
    }

    #[test]
    fn suite_and_verify_commands_must_be_nonblank_and_present() {
        let suite = replace_valid("suite: cargo test --workspace", "suite: ' '");
        assert_eq!(parse(&suite).unwrap_err().code, "blank-command");
        let empty = replace_valid("verify: [cargo test parser]", "verify: []");
        assert_eq!(parse(&empty).unwrap_err().code, "missing-command");
        let blank = replace_valid("verify: [cargo test parser]", "verify: ['  ']");
        assert_eq!(parse(&blank).unwrap_err().code, "blank-command");
    }

    #[test]
    fn unsafe_lease_paths_are_rejected() {
        for path in ["/tmp/file", "../file", "src/../../file", "C:\\\\file", "."] {
            let frontmatter = replace_valid("src/lib.rs", &format!("'{path}'"));
            assert!(parse(&frontmatter).is_err(), "accepted {path}");
        }
    }

    #[test]
    fn duplicate_normalized_paths_are_rejected() {
        for files in [
            "[src/lib.rs, src//lib.rs]",
            "[src/lib.rs, src/./lib.rs]",
            "[src/lib.rs, 'src\\lib.rs']",
        ] {
            let frontmatter = replace_valid("[src/lib.rs]", files);
            assert_eq!(parse(&frontmatter).unwrap_err().code, "duplicate-path");
        }
    }

    #[test]
    fn document_frontmatter_fields_tasks_and_commands_are_bounded() {
        let huge_document = vec![b'x'; MAX_DOCUMENT_BYTES + 1];
        assert_eq!(
            parse_plan(&huge_document, 6, 1).unwrap_err().code,
            "document-bound"
        );

        let large_body = "x".repeat(MAX_FRONTMATTER_BYTES);
        let frontmatter = replace_valid(
            "requirements: [AC2]",
            &format!("requirements: ['{large_body}']"),
        );
        assert_eq!(parse(&frontmatter).unwrap_err().code, "frontmatter-bound");

        let fields = (0..=MAX_FIELDS)
            .map(|n| format!("R{n}"))
            .collect::<Vec<_>>()
            .join(", ");
        let frontmatter = replace_valid("[AC2]", &format!("[{fields}]"));
        assert_eq!(parse(&frontmatter).unwrap_err().code, "field-bound");

        let long_field = "x".repeat(MAX_FIELD_BYTES + 1);
        let frontmatter = replace_valid("cargo test --workspace", &format!("'{long_field}'"));
        assert_eq!(parse(&frontmatter).unwrap_err().code, "field-bound");

        let tasks = (0..=MAX_TASKS)
            .map(|n| format!("    - id: T{n}\n      verify: [cargo test t{n}]\n"))
            .collect::<String>();
        let frontmatter =
            replace_valid("    - id: T1\n      verify: [cargo test parser]\n", &tasks);
        assert_eq!(parse(&frontmatter).unwrap_err().code, "task-bound");

        let commands = (0..=MAX_COMMANDS)
            .map(|n| format!("cargo test t{n}"))
            .collect::<Vec<_>>()
            .join(", ");
        let frontmatter = replace_valid("[cargo test parser]", &format!("[{commands}]"));
        assert_eq!(parse(&frontmatter).unwrap_err().code, "command-bound");
    }

    #[test]
    fn unsupported_schema_is_rejected() {
        let frontmatter = replace_valid("schema: 1", "schema: 2");
        assert_eq!(parse(&frontmatter).unwrap_err().code, "unsupported-schema");
    }

    fn fixture(plan: u32, files: &[&str], body: &str) -> ExecutionPlan {
        let frontmatter = format!(
            "phase: 6\nplan: {plan}\nrequirements: [AC2]\nfiles: [{}]\nexecution:\n  schema: 1\n  suite: cargo test --workspace\n  tasks:\n    - id: T{plan}\n      verify: [cargo test task{plan}]\n",
            files.join(", ")
        );
        parse_plan(&source(&frontmatter, body), 6, plan).unwrap()
    }

    #[test]
    fn three_plan_overlap_graph_orders_shared_and_transitive_leases() {
        let plans = [
            fixture(1, &["src/a.rs"], "one"),
            fixture(2, &["src/a.rs", "src/b.rs"], "two"),
            fixture(3, &["src/b.rs"], "three"),
        ];
        let graph = PlanGraph::build(&plans).unwrap();
        assert_eq!(graph.prerequisites(1).unwrap(), &BTreeSet::new());
        assert_eq!(graph.prerequisites(2).unwrap(), &BTreeSet::from([1]));
        assert_eq!(graph.prerequisites(3).unwrap(), &BTreeSet::from([2]));
        assert_eq!(graph.ready(&BTreeSet::new()), [1]);
        assert_eq!(graph.ready(&BTreeSet::from([1])), [2]);
        assert_eq!(graph.ready(&BTreeSet::from([1, 2])), [3]);
    }

    #[test]
    fn disjoint_leases_are_independent_with_plan_number_tie_break() {
        let plans = [
            fixture(3, &["src/c.rs"], "three"),
            fixture(1, &["src/a.rs"], "one"),
            fixture(2, &["src/b.rs"], "two"),
        ];
        let graph = PlanGraph::build(&plans).unwrap();
        assert_eq!(graph.ready(&BTreeSet::new()), [1, 2, 3]);
        assert_eq!(graph.next_ready(&BTreeSet::new()), Some(1));
    }

    #[test]
    fn prose_renames_never_create_overlap_edges() {
        let plans = [
            fixture(1, &["src/old.rs"], "Rename src/old.rs to src/new.rs"),
            fixture(2, &["src/new.rs"], "Depends on the rename above"),
            fixture(3, &["src/other.rs"], "Files: src/old.rs"),
        ];
        let graph = PlanGraph::build(&plans).unwrap();
        assert_eq!(graph.ready(&BTreeSet::new()), [1, 2, 3]);
    }

    #[test]
    fn changing_only_body_changes_fingerprints_not_operational_fields() {
        let left = fixture(1, &["src/a.rs"], "body one\n");
        let right = fixture(1, &["src/a.rs"], "body two\n");
        assert_ne!(left.fingerprint, right.fingerprint);
        assert_ne!(
            plan_set_fingerprint(std::slice::from_ref(&left)).unwrap(),
            plan_set_fingerprint(std::slice::from_ref(&right)).unwrap()
        );
        assert_eq!(left.phase, right.phase);
        assert_eq!(left.plan, right.plan);
        assert_eq!(left.requirements, right.requirements);
        assert_eq!(left.files, right.files);
        assert_eq!(left.suite, right.suite);
        assert_eq!(left.tasks, right.tasks);
    }

    #[test]
    fn body_headings_never_define_tasks_or_commands() {
        let body = "### Task 99: invented\n- Verify: cargo test invented\nfull suite: false\n";
        let plan = fixture(1, &["src/a.rs"], body);
        assert_eq!(plan.tasks.len(), 1);
        assert_eq!(plan.tasks[0].id, "T1");
        assert_eq!(plan.tasks[0].verify, ["cargo test task1"]);
        assert_eq!(plan.suite, "cargo test --workspace");
    }

    #[test]
    fn quoted_exclamation_marks_are_not_tags() {
        let frontmatter = replace_valid("cargo test --workspace", "'cargo test !important'");
        assert_eq!(parse(&frontmatter).unwrap().suite, "cargo test !important");
    }
}
