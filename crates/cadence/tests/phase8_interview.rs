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
        if target == ".store-intent.json" {
            if let Some(shared) = &self.changed_global {
                *shared.lock().unwrap() = Some(b"{}".to_vec());
            }
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
struct Allow;
impl cadence::store::Policy for Allow {
    fn validate(&mut self, _: &cadence::store::MutationContext<'_>) -> cadence::store::Result<()> {
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
        Allow,
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
        Allow,
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
