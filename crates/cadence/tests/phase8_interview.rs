use cadence::{
    config::{
        Layer,
        interview::{self, Captured, Mode},
        merge,
        reload::{Generation, Input},
        write::Update,
    },
    store::Error,
};
use serde_json::{Value, json};

fn generation(global: Option<Value>, repo: Option<Value>, alias: bool) -> Generation {
    Generation {
        number: 1,
        global: (!alias).then(|| Input {
            identity: "/global/config.v4.json".into(),
            bytes: global.as_ref().map(|v| serde_json::to_vec(v).unwrap()),
            stamp: None,
        }),
        repo: Input {
            identity: "/project/.planning/config.v4.json".into(),
            bytes: repo.as_ref().map(|v| serde_json::to_vec(v).unwrap()),
            stamp: None,
        },
        effective: merge::merge(global, repo, alias),
    }
}
fn defaults() -> Vec<Update> {
    serde_json::from_value(json!([
        {"key":"roles.cad-planner.model","value":null}, {"key":"roles.cad-planner.effort","value":"high"},
        {"key":"roles.cad-assumptions-analyzer.model","value":null}, {"key":"roles.cad-assumptions-analyzer.effort","value":"high"},
        {"key":"roles.cad-verifier.model","value":null}, {"key":"roles.cad-verifier.effort","value":"high"},
        {"key":"roles.cad-reviewer.model","value":null}, {"key":"roles.cad-reviewer.effort","value":"medium"},
        {"key":"roles.cad-executor.model","value":null}, {"key":"roles.cad-executor.effort","value":"high"},
        {"key":"roles.cad-plan-checker.model","value":null}, {"key":"roles.cad-plan-checker.effort","value":"low"},
        {"key":"review.triggers.risk_surface.waive_routing_floor","value":[]}
    ])).unwrap()
}
#[test]
fn prepare_returns_thirteen_ordered_current_defaults_and_sources() {
    let output = interview::prepare(&generation(None, None, false), Mode::Roles);
    assert_eq!(
        output
            .subjects
            .into_iter()
            .map(|s| (s.key, s.current, s.source))
            .collect::<Vec<_>>(),
        vec![
            (
                "roles.cad-planner.model".into(),
                Value::Null,
                "defaults".into()
            ),
            (
                "roles.cad-planner.effort".into(),
                json!("high"),
                "defaults".into()
            ),
            (
                "roles.cad-assumptions-analyzer.model".into(),
                Value::Null,
                "defaults".into()
            ),
            (
                "roles.cad-assumptions-analyzer.effort".into(),
                json!("high"),
                "defaults".into()
            ),
            (
                "roles.cad-verifier.model".into(),
                Value::Null,
                "defaults".into()
            ),
            (
                "roles.cad-verifier.effort".into(),
                json!("high"),
                "defaults".into()
            ),
            (
                "roles.cad-reviewer.model".into(),
                Value::Null,
                "defaults".into()
            ),
            (
                "roles.cad-reviewer.effort".into(),
                json!("medium"),
                "defaults".into()
            ),
            (
                "roles.cad-executor.model".into(),
                Value::Null,
                "defaults".into()
            ),
            (
                "roles.cad-executor.effort".into(),
                json!("high"),
                "defaults".into()
            ),
            (
                "roles.cad-plan-checker.model".into(),
                Value::Null,
                "defaults".into()
            ),
            (
                "roles.cad-plan-checker.effort".into(),
                json!("low"),
                "defaults".into()
            ),
            (
                "review.triggers.risk_surface.waive_routing_floor".into(),
                Value::Null,
                "defaults".into()
            )
        ]
    );
}
#[test]
fn first_acceptance_returns_all_literal_updates() {
    let input = generation(None, None, false);
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&defaults())
        )
        .unwrap(),
        (Layer::Global, defaults())
    );
}
#[test]
fn raw_presence_classifies_independently_of_coverage() {
    let output = [
        None,
        Some(json!({"roles":{}})),
        Some(json!({"roles":{"cad-executor":{"model":null}}})),
    ]
    .into_iter()
    .map(|raw| {
        let result = interview::prepare(&generation(raw, None, false), Mode::Roles);
        (
            result.first_run,
            result.target,
            result.stored_role_leaves,
            result.subjects.len(),
        )
    })
    .collect::<Vec<_>>();
    assert_eq!(
        output,
        vec![
            (true, Layer::Global, vec![], 13),
            (false, Layer::Repo, vec![], 13),
            (
                false,
                Layer::Repo,
                vec!["roles.cad-executor.model".into()],
                13
            )
        ]
    );
}
#[test]
fn aliased_global_presence_retains_repo_provenance() {
    let output = interview::prepare(
        &generation(
            None,
            Some(json!({"roles":{"cad-executor":{"model":null}}})),
            true,
        ),
        Mode::Roles,
    );
    let subject = &output.subjects[8];
    assert_eq!(
        (
            output.first_run,
            output.target,
            output.captured.global_alias,
            subject.present_global,
            subject.present_repo,
            subject.source.as_str()
        ),
        (false, Layer::Repo, true, false, true, "repo")
    );
}
#[test]
fn unchanged_default_roles_only_pin_explicit_empty_floor() {
    let input = generation(Some(json!({"roles":{}})), None, false);
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&defaults())
        )
        .unwrap(),
        (
            Layer::Repo,
            vec![Update {
                key: "review.triggers.risk_surface.waive_routing_floor".into(),
                value: json!([])
            }]
        )
    );
}
#[test]
fn identical_repo_empty_pin_is_noop() {
    let input = generation(
        Some(json!({"roles":{}})),
        Some(json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}})),
        false,
    );
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&defaults())
        )
        .unwrap(),
        (Layer::Repo, vec![])
    );
}
#[test]
fn one_changed_role_returns_only_diff_and_empty_pin() {
    let input = generation(Some(json!({"roles":{}})), None, false);
    let mut answers = defaults();
    answers[8].value = json!("  custom \"model\" = 雪  ");
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&answers)
        )
        .unwrap(),
        (
            Layer::Repo,
            vec![
                Update {
                    key: "roles.cad-executor.model".into(),
                    value: json!("  custom \"model\" = 雪  ")
                },
                Update {
                    key: "review.triggers.risk_surface.waive_routing_floor".into(),
                    value: json!([])
                }
            ]
        )
    );
}
#[test]
fn explicit_global_questions_show_global_instead_of_repo() {
    let output = interview::prepare(
        &generation(
            Some(json!({"roles":{"cad-executor":{"model":"sonnet"}}})),
            Some(json!({"roles":{"cad-executor":{"model":"opus"}}})),
            false,
        ),
        Mode::Global,
    );
    assert_eq!(
        (
            output.target,
            output.subjects[8].current.clone(),
            output.subjects[8].source.as_str()
        ),
        (Layer::Global, json!("sonnet"), "global")
    );
}
#[test]
fn stale_captured_inputs_return_exact_conflict() {
    let input = generation(None, None, false);
    let mut captured = Captured::from_generation(&input);
    captured.repo.content = Some("old".into());
    assert_eq!(
        interview::answers(&input, Mode::Roles, &captured, true, Some(&defaults())),
        Err(Error::Conflict("interview config inputs changed".into()))
    );
}
#[test]
fn incomplete_answers_return_exact_invalid() {
    let input = generation(None, None, false);
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&defaults()[..12])
        ),
        Err(Error::Invalid(
            "interview requires exactly thirteen ordered answers".into()
        ))
    );
}
#[test]
fn declined_and_unanswered_suggestions_return_no_updates() {
    let input = generation(None, None, false);
    assert_eq!(
        [(false, Some(defaults())), (true, None)]
            .into_iter()
            .map(|(accepted, values)| interview::answers(
                &input,
                Mode::Suggestion,
                &Captured::from_generation(&input),
                accepted,
                values.as_deref()
            )
            .unwrap())
            .collect::<Vec<_>>(),
        vec![(Layer::Global, vec![]), (Layer::Global, vec![])]
    );
}
#[test]
fn both_intake_entries_and_suggestion_use_the_shared_answers() {
    let input = generation(None, None, false);
    assert_eq!(
        [Mode::NewProject, Mode::Adopt, Mode::Suggestion]
            .into_iter()
            .map(|mode| interview::answers(
                &input,
                mode,
                &Captured::from_generation(&input),
                true,
                Some(&defaults())
            )
            .unwrap())
            .collect::<Vec<_>>(),
        vec![
            (Layer::Global, defaults()),
            (Layer::Global, defaults()),
            (Layer::Global, defaults())
        ]
    );
}
#[test]
fn global_empty_does_not_hide_stronger_repo_waiver() {
    let facts = cadence::config_service::facts(&generation(
        Some(json!({"roles":{},"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}})),
        Some(json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":["auth"]}}}})),
        false,
    ));
    assert_eq!(
        facts
            .keys
            .into_iter()
            .filter(|f| f.key == "review.triggers.risk_surface.waive_routing_floor")
            .map(|f| (f.effective, f.source))
            .collect::<Vec<_>>(),
        vec![(json!(["auth"]), "repo".into())]
    );
}

#[test]
fn first_batch_prepares_exact_thirteen_stored_leaves() {
    assert_eq!(
        cadence::config::write::prepare_batch(Layer::Global, &json!({}), &defaults())
            .unwrap()
            .0,
        json!({
            "roles": {"cad-planner":{"model":null,"effort":"high"},"cad-assumptions-analyzer":{"model":null,"effort":"high"},"cad-verifier":{"model":null,"effort":"high"},"cad-reviewer":{"model":null,"effort":"medium"},"cad-executor":{"model":null,"effort":"high"},"cad-plan-checker":{"model":null,"effort":"low"}},
            "review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}
        })
    );
}

#[test]
fn invalid_floor_null_returns_literal_validation_failure() {
    let input = generation(None, None, false);
    let mut answers = defaults();
    answers[12].value = Value::Null;
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&answers)
        ),
        Err(Error::Invalid(
            "invalid value for review.triggers.risk_surface.waive_routing_floor".into()
        ))
    );
}

#[derive(Clone)]
struct ConfigMemory(std::sync::Arc<std::sync::Mutex<Option<Vec<u8>>>>);
impl cadence::config::reload::ConfigIo for ConfigMemory {
    fn read(&mut self, path: &std::path::Path) -> cadence::store::Result<Input> {
        Ok(Input {
            identity: path.into(),
            bytes: if path == std::path::Path::new("/global/config.v4.json") {
                self.0.lock().unwrap().clone()
            } else {
                None
            },
            stamp: None,
        })
    }
}
struct Memory {
    files: std::collections::BTreeMap<String, cadence::store::Observed>,
    changed_global: Option<std::sync::Arc<std::sync::Mutex<Option<Vec<u8>>>>>,
}
fn observed(bytes: Option<&[u8]>) -> cadence::store::Observed {
    cadence::store::Observed {
        bytes: bytes.map(Vec::from),
        identity: "fixture".into(),
        directory_identity: "fixture-parent".into(),
    }
}
impl cadence::store::Storage for Memory {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, target: &str) -> cadence::store::Result<cadence::store::Observed> {
        Ok(self
            .files
            .get(target)
            .cloned()
            .unwrap_or_else(|| observed(None)))
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> cadence::store::Result<Self::Prepared> {
        if target == ".store-intent.json"
            && let Some(shared) = &self.changed_global
        {
            *shared.lock().unwrap() = Some(b"{}".to_vec());
        }
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, file: &Self::Prepared) -> cadence::store::Result<()> {
        self.files.insert(file.0.clone(), observed(Some(&file.1)));
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> cadence::store::Result<()> {
        Ok(())
    }
    fn confirm(
        &mut self,
        target: &str,
        _: &[u8],
    ) -> cadence::store::Result<cadence::store::Observed> {
        self.read(target)
    }
    fn resync(
        &mut self,
        target: &str,
        _: &[u8],
    ) -> cadence::store::Result<cadence::store::Observed> {
        self.read(target)
    }
    fn remove(&mut self, target: &str) -> cadence::store::Result<()> {
        self.files.remove(target);
        Ok(())
    }
}
fn captured_check(
    shared: std::sync::Arc<std::sync::Mutex<Option<Vec<u8>>>>,
) -> cadence::store::writer::InputCheck {
    use cadence::config::reload::{Paths, Reload};
    cadence::config::write::input_check(
        std::sync::Arc::new(std::sync::Mutex::new(Reload::new(
            Paths {
                global: Some("/global/config.v4.json".into()),
                repo: "/project/.planning/config.v4.json".into(),
            },
            ConfigMemory(shared),
        ))),
        Captured::from_generation(&generation(None, None, false)),
    )
}
fn transaction() -> cadence::store::transaction::Transaction {
    cadence::store::transaction::Transaction {
        id: "interview-fixture".into(),
        items: vec![],
        decisions: vec![],
        snapshot: None,
        external: vec![cadence::store::transaction::ExternalChange {
            target: "repo-config".into(),
            expected: observed(None),
            bytes: r#"{"roles":{"cad-executor":{"model":" literal = 雪 "}}}"#
                .as_bytes()
                .to_vec(),
        }],
    }
}
#[tokio::test]
async fn owned_writer_refuses_changed_non_destination_input() {
    let shared = std::sync::Arc::new(std::sync::Mutex::new(Some(b"{}".to_vec())));
    let store = cadence::store::writer::Store::open(
        Memory {
            files: Default::default(),
            changed_global: None,
        },
        cadence::store::writer::PlanningPolicy,
    )
    .await
    .unwrap();
    assert_eq!(
        store
            .request(cadence::store::writer::Operation::CheckedTransact {
                check: captured_check(shared),
                transaction: Some(transaction())
            })
            .await,
        Err(Error::Conflict("interview config inputs changed".into()))
    );
}
#[tokio::test]
async fn final_owned_validation_refuses_change_during_preparation() {
    let shared = std::sync::Arc::new(std::sync::Mutex::new(None));
    let store = cadence::store::writer::Store::open(
        Memory {
            files: Default::default(),
            changed_global: Some(shared.clone()),
        },
        cadence::store::writer::PlanningPolicy,
    )
    .await
    .unwrap();
    assert_eq!(
        store
            .request(cadence::store::writer::Operation::CheckedTransact {
                check: captured_check(shared),
                transaction: Some(transaction())
            })
            .await,
        Err(Error::Conflict("interview config inputs changed".into()))
    );
}

#[test]
fn entry_preparation_retains_every_named_mode() {
    use interview::Entry;
    assert_eq!(
        [
            vec![],
            vec!["--roles"],
            vec!["--roles", "--global"],
            vec!["--surfaces"],
            vec!["--review"],
            vec!["--review", "redetect"]
        ]
        .into_iter()
        .map(
            |tokens| interview::entry(&tokens.into_iter().map(str::to_string).collect::<Vec<_>>())
                .unwrap()
        )
        .collect::<Vec<_>>(),
        vec![
            Entry::Knobs,
            Entry::Roles { mode: Mode::Roles },
            Entry::Roles { mode: Mode::Global },
            Entry::Surfaces,
            Entry::ReviewUnavailable {
                reason:
                    "Native live-provider setup is unavailable until the review-delivery phase."
                        .into()
            },
            Entry::ReviewUnavailable {
                reason:
                    "Native live-provider setup is unavailable until the review-delivery phase."
                        .into()
            }
        ]
    );
}
#[test]
fn token_parser_preserves_literal_model_text_null_effort_and_empty_array() {
    assert_eq!(
        interview::entry(&[
            "roles.cad-executor.model=  \"vendor model\" = 雪  ".into(),
            "roles.cad-executor.effort=null".into(),
            "review.triggers.risk_surface.waive_routing_floor=[]".into(),
        ])
        .unwrap(),
        interview::Entry::Values {
            layer: Layer::Repo,
            updates: vec![
                Update {
                    key: "roles.cad-executor.model".into(),
                    value: json!("  \"vendor model\" = 雪  ")
                },
                Update {
                    key: "roles.cad-executor.effort".into(),
                    value: Value::Null
                },
                Update {
                    key: "review.triggers.risk_surface.waive_routing_floor".into(),
                    value: json!([])
                }
            ]
        }
    );
}
#[test]
fn token_parser_accepts_unquoted_named_rung() {
    assert_eq!(
        interview::entry(&["roles.cad-executor.effort=xhigh".into()]).unwrap(),
        interview::Entry::Values {
            layer: Layer::Repo,
            updates: vec![Update {
                key: "roles.cad-executor.effort".into(),
                value: json!("xhigh")
            }]
        }
    );
}
#[test]
fn token_parser_rejects_unknown_flag() {
    assert_eq!(
        interview::entry(&["--unknown".into()]),
        Err(Error::Invalid(
            "config entry requires key=value tokens".into()
        ))
    );
}
#[test]
fn grouped_apply_decodes_exact_literal_answer_fields() {
    let output:cadence::config_service::Apply=serde_json::from_value(json!({
        "operation":"config-interview-apply","mode":"global","accepted":true,
        "captured":{"repo":{"identity":"/repo/config.v4.json","content":null,"stamp":null},"global":null,"global_alias":true},
        "answers":[{"key":"roles.cad-executor.model","value":"  \"model\" = 雪  "},{"key":"roles.cad-executor.effort","value":null},{"key":"review.triggers.risk_surface.waive_routing_floor","value":[]}]
    })).unwrap();
    assert_eq!(
        match output {
            cadence::config_service::Apply::Interview {
                mode,
                captured,
                accepted,
                answers,
            } => (mode, captured, accepted, answers),
            _ => panic!("interview expected"),
        },
        (
            Mode::Global,
            interview::Captured {
                repo: interview::Input {
                    identity: "/repo/config.v4.json".into(),
                    content: None,
                    stamp: None
                },
                global: None,
                global_alias: true
            },
            true,
            Some(vec![
                Update {
                    key: "roles.cad-executor.model".into(),
                    value: json!("  \"model\" = 雪  ")
                },
                Update {
                    key: "roles.cad-executor.effort".into(),
                    value: Value::Null
                },
                Update {
                    key: "review.triggers.risk_surface.waive_routing_floor".into(),
                    value: json!([])
                }
            ])
        )
    );
}
#[test]
fn literal_relay_updates_prepare_identical_native_stored_values() {
    assert_eq!(
        cadence::config::write::prepare_batch(
            Layer::Repo,
            &json!({}),
            &[
                Update {
                    key: "roles.cad-executor.model".into(),
                    value: json!("  \"model\" = 雪  ")
                },
                Update {
                    key: "roles.cad-executor.effort".into(),
                    value: Value::Null
                },
                Update {
                    key: "review.triggers.risk_surface.waive_routing_floor".into(),
                    value: json!([])
                }
            ]
        )
        .unwrap()
        .0,
        json!({"roles":{"cad-executor":{"model":"  \"model\" = 雪  ","effort":null}},"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}})
    );
}
#[derive(Clone)]
struct NoReads;
impl cadence::config::reload::ConfigIo for NoReads {
    fn read(&mut self, _: &std::path::Path) -> cadence::store::Result<Input> {
        panic!("review preparation must not open settings")
    }
}
#[tokio::test]
async fn review_entry_returns_native_unavailable_before_session_acquisition() {
    let factory = cadence::import::SessionFactory::with_io(
        None,
        NoReads,
        std::sync::Arc::new(cadence::config::planning_policy),
    );
    assert_eq!(
        serde_json::to_value(
            cadence::config_service::execute(
                &factory,
                std::path::Path::new("/project/.planning"),
                cadence::config_service::Command::Entry(vec!["--review".into(), "redetect".into()])
            )
            .await
            .unwrap()
        )
        .unwrap(),
        json!({"status":"refused","code":"review-setup-unavailable","reason":"Native live-provider setup is unavailable until the review-delivery phase."})
    );
}
#[test]
fn invalid_live_input_check_returns_named_error_without_write() {
    let shared = std::sync::Arc::new(std::sync::Mutex::new(Some(
        br#"{"roles":{"cad-executor":{"effort":"invalid"}}}"#.to_vec(),
    )));
    assert_eq!(
        captured_check(shared)(),
        Err(Error::Policy(
            "config unavailable: unusable roles.cad-executor.effort".into()
        ))
    );
}
#[test]
fn shipped_skill_allows_only_grouped_tools_and_host_questions() {
    assert_eq!(
        include_str!("../../../skills/cad-config/SKILL.md")
            .lines()
            .filter_map(|line| line.strip_prefix("  - "))
            .collect::<Vec<_>>(),
        vec![
            "mcp__cadence__cadence_query",
            "mcp__cadence__cadence_apply",
            "AskUserQuestion"
        ]
    );
}
#[test]
fn shipped_skill_has_no_frozen_execution_or_individual_setter_path() {
    let skill = include_str!("../../../skills/cad-config/SKILL.md");
    assert_eq!(
        [
            "cadence-core/",
            "route.mjs",
            "config.json",
            "set_config",
            "  - Bash",
            "  - Write",
            "  - Edit"
        ]
        .into_iter()
        .filter(|token| skill.contains(token))
        .collect::<Vec<_>>(),
        Vec::<&str>::new()
    );
}
#[test]
fn surfaces_entry_is_separate_from_the_floor_interview() {
    assert_eq!(
        interview::entry(&["--surfaces".into()]),
        Ok(interview::Entry::Surfaces)
    );
}

const STORED_DEFAULTS: &str = r#"{
  "roles": {
    "cad-planner": {
      "model": null,
      "effort": "high"
    },
    "cad-assumptions-analyzer": {
      "model": null,
      "effort": "high"
    },
    "cad-verifier": {
      "model": null,
      "effort": "high"
    },
    "cad-reviewer": {
      "model": null,
      "effort": "medium"
    },
    "cad-executor": {
      "model": null,
      "effort": "high"
    },
    "cad-plan-checker": {
      "model": null,
      "effort": "low"
    }
  },
  "review": {
    "triggers": {
      "risk_surface": {
        "waive_routing_floor": []
      }
    }
  }
}"#;

type FileState =
    std::sync::Arc<std::sync::Mutex<std::collections::BTreeMap<String, cadence::store::Observed>>>;
#[derive(Clone)]
struct Files(FileState);
impl cadence::config::reload::ConfigIo for Files {
    fn read(&mut self, path: &std::path::Path) -> cadence::store::Result<Input> {
        let target = if path == std::path::Path::new("/global/config.v4.json") {
            "global-config"
        } else {
            "repo-config"
        };
        Ok(Input {
            identity: path.into(),
            bytes: self
                .0
                .lock()
                .unwrap()
                .get(target)
                .and_then(|file| file.bytes.clone()),
            stamp: None,
        })
    }
}
type Replacements = std::sync::Arc<std::sync::Mutex<Vec<(String, Vec<u8>)>>>;

struct WritableFiles {
    files: FileState,
    replacements: Replacements,
}
impl cadence::store::Storage for WritableFiles {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, target: &str) -> cadence::store::Result<cadence::store::Observed> {
        Ok(self
            .files
            .lock()
            .unwrap()
            .get(target)
            .cloned()
            .unwrap_or_else(|| observed(None)))
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> cadence::store::Result<Self::Prepared> {
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, file: &Self::Prepared) -> cadence::store::Result<()> {
        self.files
            .lock()
            .unwrap()
            .insert(file.0.clone(), observed(Some(&file.1)));
        if matches!(file.0.as_str(), "global-config" | "repo-config") {
            self.replacements.lock().unwrap().push(file.clone());
        }
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> cadence::store::Result<()> {
        Ok(())
    }
    fn confirm(
        &mut self,
        target: &str,
        _: &[u8],
    ) -> cadence::store::Result<cadence::store::Observed> {
        self.read(target)
    }
    fn resync(
        &mut self,
        target: &str,
        _: &[u8],
    ) -> cadence::store::Result<cadence::store::Observed> {
        self.read(target)
    }
    fn remove(&mut self, target: &str) -> cadence::store::Result<()> {
        self.files.lock().unwrap().remove(target);
        Ok(())
    }
}
struct BatchFixture {
    writer: cadence::config::write::ConfigWriter<Files>,
    files: FileState,
    replacements: Replacements,
}
async fn batch_fixture(global: Option<&str>, repo: Option<&str>) -> BatchFixture {
    use cadence::config::reload::{ConfigPolicy, Paths, Reload};
    let files: FileState = std::sync::Arc::new(std::sync::Mutex::new(
        [
            ("global-config".into(), observed(global.map(str::as_bytes))),
            ("repo-config".into(), observed(repo.map(str::as_bytes))),
        ]
        .into(),
    ));
    let replacements = std::sync::Arc::new(std::sync::Mutex::new(vec![]));
    let active = Paths {
        global: Some("/global/config.v4.json".into()),
        repo: "/project/.planning/config.v4.json".into(),
    };
    let config = std::sync::Arc::new(std::sync::Mutex::new(Reload::new(
        active.clone(),
        Files(files.clone()),
    )));
    let store = cadence::store::writer::Store::open(
        WritableFiles {
            files: files.clone(),
            replacements: replacements.clone(),
        },
        ConfigPolicy {
            config: config.clone(),
            evaluate: cadence::config::planning_policy,
        },
    )
    .await
    .unwrap();
    BatchFixture {
        writer: cadence::config::write::ConfigWriter {
            root: "/project/.planning".into(),
            active,
            store,
            config,
        },
        files,
        replacements,
    }
}

#[tokio::test]
async fn native_first_global_batch_returns_thirteen_keys_and_one_exact_replacement() {
    let fixture = batch_fixture(None, None).await;
    let output = fixture
        .writer
        .batch_observed(
            Layer::Global,
            &defaults(),
            Some(Captured::from_generation(&generation(None, None, false))),
            |target| Ok(fixture.files.lock().unwrap()[target].clone()),
        )
        .await
        .unwrap();
    assert_eq!(
        (
            output.changed_keys,
            output.destination,
            output.requested_layer,
            output.view.snapshot.generation,
            fixture.replacements.lock().unwrap().clone()
        ),
        (
            vec![
                "review.triggers.risk_surface.waive_routing_floor".into(),
                "roles.cad-assumptions-analyzer.effort".into(),
                "roles.cad-assumptions-analyzer.model".into(),
                "roles.cad-executor.effort".into(),
                "roles.cad-executor.model".into(),
                "roles.cad-plan-checker.effort".into(),
                "roles.cad-plan-checker.model".into(),
                "roles.cad-planner.effort".into(),
                "roles.cad-planner.model".into(),
                "roles.cad-reviewer.effort".into(),
                "roles.cad-reviewer.model".into(),
                "roles.cad-verifier.effort".into(),
                "roles.cad-verifier.model".into(),
            ],
            "/global/config.v4.json".into(),
            Layer::Global,
            1,
            vec![("global-config".into(), STORED_DEFAULTS.as_bytes().to_vec())]
        )
    );
}
#[test]
fn native_reopened_facts_return_all_thirteen_global_values_and_later_classification() {
    let output = cadence::config_service::observed_facts(
        &generation(
            Some(serde_json::from_str(STORED_DEFAULTS).unwrap()),
            None,
            false,
        ),
        None,
        Mode::Roles,
    );
    assert_eq!(
        (
            output.interview.first_run,
            output.interview.target,
            output
                .interview
                .subjects
                .into_iter()
                .map(|s| (s.key, s.current, s.source, s.present_global, s.present_repo))
                .collect::<Vec<_>>()
        ),
        (
            false,
            Layer::Repo,
            vec![
                (
                    "roles.cad-planner.model".into(),
                    Value::Null,
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-planner.effort".into(),
                    json!("high"),
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-assumptions-analyzer.model".into(),
                    Value::Null,
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-assumptions-analyzer.effort".into(),
                    json!("high"),
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-verifier.model".into(),
                    Value::Null,
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-verifier.effort".into(),
                    json!("high"),
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-reviewer.model".into(),
                    Value::Null,
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-reviewer.effort".into(),
                    json!("medium"),
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-executor.model".into(),
                    Value::Null,
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-executor.effort".into(),
                    json!("high"),
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-plan-checker.model".into(),
                    Value::Null,
                    "global".into(),
                    true,
                    false
                ),
                (
                    "roles.cad-plan-checker.effort".into(),
                    json!("low"),
                    "global".into(),
                    true,
                    false
                ),
                (
                    "review.triggers.risk_surface.waive_routing_floor".into(),
                    json!([]),
                    "global".into(),
                    true,
                    false
                )
            ]
        )
    );
}
#[test]
fn native_later_answers_return_exactly_one_role_diff_with_existing_floor_pin() {
    let input = generation(
        Some(json!({"roles":{}})),
        Some(json!({"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}})),
        false,
    );
    let mut answers = defaults();
    answers[9].value = json!("xhigh");
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&answers)
        ),
        Ok((
            Layer::Repo,
            vec![Update {
                key: "roles.cad-executor.effort".into(),
                value: json!("xhigh")
            }]
        ))
    );
}
#[tokio::test]
async fn native_global_batch_keeps_repo_bytes_and_reports_literal_model_bytes() {
    let fixture = batch_fixture(
        None,
        Some(r#"{ "roles": {"cad-executor": {"model": "repo-pin"}} }"#),
    )
    .await;
    let output = fixture
        .writer
        .batch_observed(
            Layer::Global,
            &[Update {
                key: "roles.cad-executor.model".into(),
                value: json!("  \"model\" = 雪  "),
            }],
            None,
            |target| Ok(fixture.files.lock().unwrap()[target].clone()),
        )
        .await
        .unwrap();
    assert_eq!(
        (
            output.requested_layer,
            output.changed_keys,
            fixture.files.lock().unwrap()["repo-config"].bytes.clone(),
            fixture.replacements.lock().unwrap().clone()
        ),
        (
            Layer::Global,
            vec!["roles.cad-executor.model".into()],
            Some(br#"{ "roles": {"cad-executor": {"model": "repo-pin"}} }"#.to_vec()),
            vec![(
                "global-config".into(),
                r#"{
  "roles": {
    "cad-executor": {
      "model": "  \"model\" = 雪  "
    }
  }
}"#
                .as_bytes()
                .to_vec()
            )]
        )
    );
}
#[tokio::test]
async fn native_empty_protection_replaces_repo_waiver_and_preserves_diff_surfaces() {
    let fixture=batch_fixture(Some(r#"{"review":{"triggers":{"risk_surface":{"waive_routing_floor":["secrets"]}}}}"#),Some(r#"{"review":{"triggers":{"risk_surface":{"waive_routing_floor":["auth"],"surfaces":["billing"]}}}}"#)).await;
    let output = fixture
        .writer
        .batch_observed(
            Layer::Repo,
            &[Update {
                key: "review.triggers.risk_surface.waive_routing_floor".into(),
                value: json!([]),
            }],
            None,
            |target| Ok(fixture.files.lock().unwrap()[target].clone()),
        )
        .await
        .unwrap();
    assert_eq!(
        (
            output.changed_keys,
            fixture.replacements.lock().unwrap().clone()
        ),
        (
            vec!["review.triggers.risk_surface.waive_routing_floor".into()],
            vec![(
                "repo-config".into(),
                br#"{
  "review": {
    "triggers": {
      "risk_surface": {
        "waive_routing_floor": [],
        "surfaces": [
          "billing"
        ]
      }
    }
  }
}"#
                .to_vec()
            )]
        )
    );
}
#[tokio::test]
async fn native_identical_empty_pin_returns_no_replacement_or_generation_increment() {
    let fixture = batch_fixture(
        None,
        Some(r#"{"review":{"triggers":{"risk_surface":{"waive_routing_floor":[]}}}}"#),
    )
    .await;
    let output = fixture
        .writer
        .batch_observed(
            Layer::Repo,
            &[Update {
                key: "review.triggers.risk_surface.waive_routing_floor".into(),
                value: json!([]),
            }],
            None,
            |_| panic!("no replacement observation for no-op"),
        )
        .await
        .unwrap();
    assert_eq!(
        (
            output.changed_keys,
            output.view.snapshot.generation,
            fixture.replacements.lock().unwrap().clone()
        ),
        (vec![], 0, vec![])
    );
}

#[test]
fn native_preserved_stakes_facts_return_originals_then_current_ordinary_subjects() {
    let snapshot = json!({"import":{"sources":[]},"source_evidence":[
        {"source":{"path":"/legacy/global/config.json","bytes":br#"{"stakes":"high"}"#.as_slice()},"generation":"ab5784f98d095e4860a25db0f7f9ff01b8c972d5861e2d3ecad63cd9eff8e0f4","label":"non_effective_original_source","layer":"global"},
        {"source":{"path":"/legacy/repo/config.json","bytes":br#"{"stakes":{"unrecognized":["legacy",null]}}"#.as_slice()},"generation":"5fd3278951af4d3398df702908e3f21246a002e61cc56189fae95713dd66e391","label":"non_effective_original_source","layer":"repo"}
    ]});
    let output = cadence::config_service::observed_facts(
        &generation(
            None,
            Some(json!({"roles":{"cad-executor":{"model":"current"}}})),
            false,
        ),
        Some(&snapshot),
        Mode::Roles,
    );
    assert_eq!(
        (
            serde_json::to_value(output.retirement).unwrap(),
            output
                .interview
                .subjects
                .into_iter()
                .map(|s| (s.key, s.current, s.source))
                .collect::<Vec<_>>()
        ),
        (
            json!({"message":"The stakes level is retired. Ordinary role questions use current settings; no equivalent spending profile is inferred.","evidence":"available","originals":[
                {"value":"high","layer":"global","path":"/legacy/global/config.json","global_alias":null,"origin":"preserved"},
                {"value":{"unrecognized":["legacy",null]},"layer":"repo","path":"/legacy/repo/config.json","global_alias":null,"origin":"preserved"}
            ]}),
            vec![
                (
                    "roles.cad-planner.model".into(),
                    Value::Null,
                    "defaults".into()
                ),
                (
                    "roles.cad-planner.effort".into(),
                    json!("high"),
                    "defaults".into()
                ),
                (
                    "roles.cad-assumptions-analyzer.model".into(),
                    Value::Null,
                    "defaults".into()
                ),
                (
                    "roles.cad-assumptions-analyzer.effort".into(),
                    json!("high"),
                    "defaults".into()
                ),
                (
                    "roles.cad-verifier.model".into(),
                    Value::Null,
                    "defaults".into()
                ),
                (
                    "roles.cad-verifier.effort".into(),
                    json!("high"),
                    "defaults".into()
                ),
                (
                    "roles.cad-reviewer.model".into(),
                    Value::Null,
                    "defaults".into()
                ),
                (
                    "roles.cad-reviewer.effort".into(),
                    json!("medium"),
                    "defaults".into()
                ),
                (
                    "roles.cad-executor.model".into(),
                    json!("current"),
                    "repo".into()
                ),
                (
                    "roles.cad-executor.effort".into(),
                    json!("high"),
                    "defaults".into()
                ),
                (
                    "roles.cad-plan-checker.model".into(),
                    Value::Null,
                    "defaults".into()
                ),
                (
                    "roles.cad-plan-checker.effort".into(),
                    json!("low"),
                    "defaults".into()
                ),
                (
                    "review.triggers.risk_surface.waive_routing_floor".into(),
                    Value::Null,
                    "defaults".into()
                )
            ]
        )
    );
}
#[test]
fn native_subjects_explain_all_six_role_purposes() {
    assert_eq!(
        interview::prepare(&generation(None, None, false), Mode::Roles)
            .subjects
            .into_iter()
            .step_by(2)
            .map(|s| s.purpose)
            .collect::<Vec<_>>(),
        vec![
            "Plan implementation tasks",
            "Analyze assumptions before planning",
            "Verify completed work",
            "Review changes",
            "Implement planned tasks",
            "Check plans before execution",
            "Choose plan-time risk-floor protection"
        ]
    );
}
#[test]
fn native_effort_subject_returns_default_and_literal_constraints() {
    let output = interview::prepare(&generation(None, None, false), Mode::Roles);
    assert_eq!(
        (&output.subjects[1].default, &output.subjects[1].constraints),
        (
            &json!("high"),
            &json!({"type":"enum","values":["low","medium","high","xhigh","max",null],"default":"high","disposition":"keep-resemantic"})
        )
    );
}
#[test]
fn reordered_answers_return_exact_invalid() {
    let input = generation(None, None, false);
    let mut values = defaults();
    values.swap(0, 1);
    assert_eq!(
        interview::answers(
            &input,
            Mode::Roles,
            &Captured::from_generation(&input),
            true,
            Some(&values)
        ),
        Err(Error::Invalid(
            "interview requires exactly thirteen ordered answers".into()
        ))
    );
}
#[test]
fn explicit_global_acceptance_returns_all_thirteen_even_when_unchanged() {
    let input = generation(
        Some(serde_json::from_str(STORED_DEFAULTS).unwrap()),
        None,
        false,
    );
    assert_eq!(
        interview::answers(
            &input,
            Mode::Global,
            &Captured::from_generation(&input),
            true,
            Some(&defaults())
        ),
        Ok((Layer::Global, defaults()))
    );
}
#[test]
fn native_reopened_custom_model_has_exact_text_and_repo_source() {
    let output = cadence::config_service::observed_facts(
        &generation(
            Some(json!({"roles":{}})),
            Some(json!({"roles":{"cad-executor":{"model":"  \"model\" = 雪  "}}})),
            false,
        ),
        None,
        Mode::Roles,
    );
    assert_eq!(
        (
            output.interview.subjects[8].current.clone(),
            output.interview.subjects[8].source.as_str(),
            output.interview.subjects[8].stored_repo.clone()
        ),
        (
            json!("  \"model\" = 雪  "),
            "repo",
            Some(json!("  \"model\" = 雪  "))
        )
    );
}
