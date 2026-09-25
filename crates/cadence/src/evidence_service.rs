//! Internal evidence adapter. The resident invokes this directly, never itself.
use crate::{
    config::reload::{self, ConfigIo},
    import::SessionFactory,
};
use cadence::{
    evidence::{Record, persistence},
    store::{Error, Result, writer::View},
};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug)]
pub enum Command {
    Read,
    Permission {
        scope: cadence::evidence::Scope,
        override_id: String,
    },
    CheckerApplicability {
        scope: cadence::evidence::Scope,
        checker_id: String,
    },
    Submit {
        operation_id: String,
        record: Box<Record>,
    },
    /// An absent invocation flag is a read, never an inferred operator answer.
    InvokeOverride {
        requested: bool,
        operation_id: String,
        record: Box<Record>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Recovery {
    pub current: Vec<Record>,
    pub history: Vec<Record>,
    pub permission: Option<cadence::evidence::authority::Permission>,
    pub checker_applicability: Option<cadence::evidence::authority::CheckerApplicability>,
    pub material_observations: cadence::evidence::material::Observations,
}

impl Recovery {
    /// A historical settlement answers only its recorded work and range.
    pub fn review_settlements(
        &self,
        scope: &cadence::evidence::Scope,
        base: &str,
        head: &str,
        trigger: &str,
        plan: Option<&str>,
    ) -> Vec<&Record> {
        self.history.iter().filter(|r| r.scope == *scope && matches!(&r.fact,
            cadence::evidence::Fact::Override(value) if matches!(&value.meaning,
                cadence::evidence::overrides::Meaning::Review(receipt) if receipt.settles(base, head, trigger, plan)))).collect()
    }
}

pub(crate) fn recover(view: &View) -> Result<Recovery> {
    Ok(Recovery {
        current: persistence::read(&view.snapshot.data)?
            .into_values()
            .collect(),
        history: view
            .decisions
            .iter()
            .filter_map(|decision| persistence::decode_history(decision).transpose())
            .collect::<Result<_>>()?,
        permission: None,
        checker_applicability: None,
        material_observations: Default::default(),
    })
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Result<Recovery> {
    let command = normalize(command)?;
    let selected = root.to_path_buf();
    let root = tokio::task::spawn_blocking(move || reload::identity(&selected))
        .await
        .map_err(|_| Error::Closed)??;
    if let Command::Submit { record, .. } = &command {
        record.validate()?;
        if !names_root(&record.scope, &root) {
            return Err(Error::Invalid(
                "evidence scope does not name the selected project/planning root".into(),
            ));
        }
    }
    if let Command::Permission { scope, .. } | Command::CheckerApplicability { scope, .. } =
        &command
    {
        scope.validate()?;
        if !names_root(scope, &root) {
            return Err(Error::Invalid(
                "permission scope differs from selected root".into(),
            ));
        }
        lifecycle_holds(super::derivation_service::query(factory, &root, &Default::default()).await)?;
    }
    let session = factory.first_touch(&root).await?;
    let before = session.derivation_view().await?;
    match command {
        Command::Read => recover(&before),
        Command::Permission { scope, override_id } => {
            let mut recovered = recover(&before)?;
            recovered.permission = Some(cadence::evidence::authority::permission(
                &recovered.current,
                &scope,
                &override_id,
            ));
            Ok(recovered)
        }
        Command::CheckerApplicability { scope, checker_id } => {
            let mut recovered = recover(&before)?;
            let materials =
                cadence::evidence::material::basis(&recovered.current, &scope, &checker_id)?;
            let observations = tokio::task::spawn_blocking(move || {
                observe_material(&root, &materials, &mut |p| std::fs::read(p))
            })
            .await
            .map_err(|_| Error::Closed)?;
            recovered.checker_applicability =
                Some(cadence::evidence::authority::checker_applicability(
                    &recovered.current,
                    &scope,
                    &checker_id,
                    &observations,
                )?);
            recovered.material_observations = observations;
            Ok(recovered)
        }
        Command::Submit {
            operation_id,
            record,
        } => {
            // Replay keeps the original admitted set even if the files later change.
            let receipt = persistence::history(&operation_id, &record, cadence::store::model::stamped_at())?;
            if !before.decisions.iter().any(|d| d.id == receipt.id)
                && let cadence::evidence::Fact::Override(value) = &record.fact
                && let cadence::evidence::overrides::Meaning::Rerun { admitted_plans } =
                    &value.meaning
            {
                let path = root.clone();
                let phase = record.scope.phase.clone();
                let plans = tokio::task::spawn_blocking(move || {
                    let prepared = cadence::derivation::prepare_query(
                        &path,
                        &mut cadence::derivation::ArtifactFiles,
                    )
                    .map_err(|e| Error::Invalid(format!("rerun observation: {e:?}")))?;
                    prepared
                        .answer()
                        .phases
                        .iter()
                        .find(|p| p.id.number().to_string() == phase)
                        .map(|p| p.plans.clone())
                        .ok_or_else(|| Error::Invalid("rerun phase not admitted".into()))
                })
                .await
                .map_err(|_| Error::Closed)??;
                rerun_names_admitted(&plans, admitted_plans)?;
            }
            let written = session
                .commit_evidence(&before, &operation_id, &record)
                .await?;
            recover(&written)
        }
        Command::InvokeOverride { .. } => unreachable!("normalized invocation"),
    }
}

/// An override invocation as the command it is: without the request flag it
/// is a read, never an inferred operator answer; with it, a submission that
/// must carry invocation authority.
pub fn normalize(command: Command) -> Result<Command> {
    match command {
        Command::InvokeOverride { requested: false, .. } => Ok(Command::Read),
        Command::InvokeOverride { operation_id, record, .. } => {
            if !matches!(&record.fact, cadence::evidence::Fact::Override(value)
                if matches!(value.authorization, cadence::evidence::overrides::Authorization::Invocation { .. }))
            {
                return Err(Error::Invalid("explicit override invocation required".into()));
            }
            Ok(Command::Submit { operation_id, record })
        }
        other => Ok(other),
    }
}

/// Whether evidence scoped to `scope` belongs to the selected planning root:
/// the scope names that root and the project that holds it.
pub fn names_root(scope: &cadence::evidence::Scope, root: &Path) -> bool {
    Path::new(&scope.planning_root) == root && root.parent() == Some(Path::new(&scope.project))
}

/// Permission never masks the independent lifecycle state: a query whose
/// lifecycle derivation fails is a conflict, whatever overrides are active.
pub fn lifecycle_holds<T>(derived: std::result::Result<T, cadence::derivation::DerivationError>) -> Result<T> {
    derived.map_err(|e| Error::Conflict(format!("lifecycle: {e:?}")))
}

/// A rerun names exactly the plans derivation admits for its phase.
pub fn rerun_names_admitted(admitted: &[String], named: &[String]) -> Result<()> {
    if admitted.iter().collect::<std::collections::BTreeSet<_>>() != named.iter().collect() {
        return Err(Error::Invalid("rerun must name all admitted plans".into()));
    }
    Ok(())
}

/// A failed read remains a failed observation, including when an older pass exists.
pub fn observe_material(
    root: &Path,
    materials: &[cadence::evidence::checker::CheckedMaterial],
    read: &mut impl FnMut(&Path) -> std::io::Result<Vec<u8>>,
) -> cadence::evidence::material::Observations {
    use cadence::evidence::material::Observation;
    materials
        .iter()
        .map(|material| {
            let path = Path::new(&material.path);
            let observation = if path.is_absolute()
                || path
                    .components()
                    .any(|part| !matches!(part, std::path::Component::Normal(_)))
            {
                Observation::Failed("invalid relative material path".into())
            } else {
                match read(&root.join(path)) {
                    Ok(bytes) => Observation::Read(cadence::store::model::digest(&bytes)),
                    Err(error) => Observation::Failed(format!("{:?}: {error}", error.kind())),
                }
            };
            (material.path.clone(), observation)
        })
        .collect()
}

#[cfg(test)]
mod decision_tests {
    use super::*;
    use crate::import::{evidence_write, replays_evidence};
    use cadence::evidence::{
        Fact, Scope, VERSION,
        checker::CheckedMaterial,
        overrides::{Authorization, Meaning, Override, ReviewReceipt, SettledCounts},
    };
    use cadence::store::{model::Snapshot, writer::Operation};
    use serde_json::json;

    fn scope(occurrence: &str) -> Scope {
        Scope {
            project: "/project".into(),
            planning_root: "/project/.planning".into(),
            cycle: "v4".into(),
            occurrence: occurrence.into(),
            phase: "5".into(),
            plan: "phases/5/PLAN-1.md".into(),
            report: "phases/5/reports/plan-1.md".into(),
        }
    }

    fn grant(authorization: Authorization) -> Record {
        Record {
            version: VERSION,
            scope: scope("dispatch-1"),
            fact: Fact::Override(Override {
                id: "pause".into(),
                reason: "continue later".into(),
                authorization,
                meaning: Meaning::PausedNext { sentence: "resume exact instruction".into() },
            }),
        }
    }

    fn invoked() -> Record {
        grant(Authorization::Invocation { id: "invoke".into(), invocation: "pause here".into() })
    }

    fn invoke(requested: bool, record: Record) -> Command {
        Command::InvokeOverride { requested, operation_id: "op-1".into(), record: Box::new(record) }
    }

    #[test]
    fn an_override_invocation_without_the_request_flag_is_a_read() {
        assert!(matches!(normalize(invoke(false, invoked())), Ok(Command::Read)));
    }

    #[test]
    fn a_requested_override_invocation_is_submitted_as_it_came() {
        let Ok(Command::Submit { operation_id, record }) = normalize(invoke(true, invoked())) else { panic!("not submitted") };
        assert_eq!((operation_id.as_str(), *record), ("op-1", invoked()));
    }

    #[test]
    fn a_requested_invocation_without_invocation_authority_is_refused() {
        let answered = grant(Authorization::Answer { id: "auth-1".into(), question_id: "q1".into() });
        assert!(matches!(
            normalize(invoke(true, answered)),
            Err(Error::Invalid(reason)) if reason == "explicit override invocation required"
        ));
    }

    #[test]
    fn a_scope_belongs_to_the_root_it_names_inside_the_project_it_names() {
        assert!(names_root(&scope("d"), Path::new("/project/.planning")));
        assert!(!names_root(&scope("d"), Path::new("/other/.planning")));
        let mut moved = scope("d");
        moved.project = "/elsewhere".into();
        assert!(!names_root(&moved, Path::new("/project/.planning")));
    }

    #[test]
    fn a_failed_lifecycle_derivation_is_a_conflict_whatever_is_asked() {
        assert_eq!(
            lifecycle_holds::<()>(Err(cadence::derivation::DerivationError::InputsChanged)),
            Err(Error::Conflict("lifecycle: InputsChanged".into()))
        );
        assert_eq!(lifecycle_holds::<u32>(Ok(4)), Ok(4));
    }

    #[test]
    fn a_rerun_names_exactly_the_admitted_plans_in_any_order() {
        let admitted = ["PLAN-1.md".to_string(), "PLAN-2.md".to_string()];
        assert_eq!(rerun_names_admitted(&admitted, &["PLAN-2.md".into(), "PLAN-1.md".into()]), Ok(()));
        for named in [
            vec!["PLAN-1.md".to_string()],
            vec!["PLAN-1.md".into(), "PLAN-3.md".into()],
            vec!["PLAN-1.md".into(), "PLAN-2.md".into(), "PLAN-3.md".into()],
        ] {
            assert_eq!(
                rerun_names_admitted(&admitted, &named),
                Err(Error::Invalid("rerun must name all admitted plans".into()))
            );
        }
    }

    fn checked(path: &str) -> CheckedMaterial {
        CheckedMaterial { path: path.into(), content_digest: "0".repeat(64) }
    }

    #[test]
    fn material_is_read_by_digest_and_a_read_error_is_a_failure_carrying_its_kind() {
        let observed = observe_material(Path::new("/project"), &[checked("a.rs"), checked("b.rs")], &mut |path| {
            if path.ends_with("a.rs") {
                Ok(b"bytes".to_vec())
            } else {
                Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied))
            }
        });
        assert_eq!(observed["a.rs"], cadence::evidence::material::Observation::Read(cadence::store::model::digest(b"bytes")));
        let cadence::evidence::material::Observation::Failed(reason) = &observed["b.rs"] else { panic!("b.rs read") };
        assert!(reason.starts_with("PermissionDenied: "), "{reason}");
    }

    #[test]
    fn a_material_path_outside_the_project_is_a_failure_and_is_never_read() {
        let mut reads = Vec::new();
        let observed = observe_material(Path::new("/project"), &[checked("/etc/passwd"), checked("../x.rs")], &mut |path| {
            reads.push(path.to_path_buf());
            Ok(Vec::new())
        });
        for path in ["/etc/passwd", "../x.rs"] {
            assert_eq!(observed[path], cadence::evidence::material::Observation::Failed("invalid relative material path".into()));
        }
        assert_eq!(reads, Vec::<std::path::PathBuf>::new());
    }

    fn receipt(occurrence: &str, head: &str, plan: Option<&str>) -> Record {
        let mut record = invoked();
        record.scope = scope(occurrence);
        let Fact::Override(value) = &mut record.fact else { unreachable!() };
        value.meaning = Meaning::Review(ReviewReceipt {
            base: "B".into(),
            head: head.into(),
            trigger: "execute".into(),
            plan: plan.map(Into::into),
            correlation: "run".into(),
            round: Some(1),
            anchor: None,
            finding_record: "ADJUDICATION.md:17".into(),
            settled: SettledCounts { survivors: 0, downgraded: 0, refuted: 0 },
        });
        record
    }

    #[test]
    fn a_review_settlement_answers_only_its_own_work_range_trigger_and_plan() {
        let exact = receipt("dispatch-1", "C", Some("phases/5/PLAN-1.md"));
        let recovery = Recovery {
            current: vec![],
            history: vec![exact.clone(), receipt("dispatch-1", "D", Some("phases/5/PLAN-1.md")), receipt("dispatch-2", "C", Some("phases/5/PLAN-1.md")), receipt("dispatch-1", "C", None)],
            permission: None,
            checker_applicability: None,
            material_observations: Default::default(),
        };
        assert_eq!(recovery.review_settlements(&scope("dispatch-1"), "B", "C", "execute", Some("phases/5/PLAN-1.md")), vec![&exact]);
        assert!(recovery.review_settlements(&scope("dispatch-1"), "B", "C", "verify", Some("phases/5/PLAN-1.md")).is_empty());
    }

    fn view(data: serde_json::Value, decisions: Vec<cadence::store::model::DecisionRecord>) -> View {
        View { items: vec![], decisions, snapshot: Snapshot::new(3, b"", b"", data).unwrap() }
    }

    #[test]
    fn recovery_reads_current_records_from_the_snapshot_and_native_history_from_the_log() {
        let record = invoked();
        let data = persistence::project(&json!({}), &record).unwrap();
        let mut legacy = persistence::history("op-0", &record, Some(1)).unwrap();
        legacy.origin.source = "legacy-gate".into();
        let recovered = recover(&view(data, vec![persistence::history("op-1", &record, Some(1)).unwrap(), legacy])).unwrap();
        assert_eq!((recovered.current, recovered.history), (vec![record.clone()], vec![record]));
    }

    #[test]
    fn an_evidence_decision_already_logged_with_the_same_content_is_a_replay_whatever_its_time() {
        let logged = persistence::history("op-1", &invoked(), Some(1)).unwrap();
        let retried = persistence::history("op-1", &invoked(), Some(99)).unwrap();
        assert_eq!(replays_evidence(std::slice::from_ref(&logged), &retried), Ok(true));
        assert_eq!(replays_evidence(&[], &retried), Ok(false));
    }

    #[test]
    fn an_evidence_operation_identity_reused_for_other_content_is_refused() {
        let logged = persistence::history("op-1", &invoked(), Some(1)).unwrap();
        let other = persistence::history("op-1", &receipt("dispatch-1", "C", None), Some(1)).unwrap();
        assert_eq!(
            replays_evidence(&[logged], &other),
            Err(Error::Conflict("operation identity reused for different content".into()))
        );
    }

    #[test]
    fn an_evidence_write_is_refused_once_the_snapshot_lost_the_import_manifest() {
        let manifest = json!({"sources": []});
        let decision = persistence::history("op-1", &invoked(), Some(1)).unwrap();
        assert!(matches!(
            evidence_write(&view(json!({"import": {"sources": ["changed"]}}), vec![]), &manifest, decision, &invoked()),
            Err(Error::Invalid(reason)) if reason == "evidence proposal must preserve import manifest"
        ));
    }

    #[test]
    fn an_evidence_write_appends_its_decision_and_projects_its_record_under_the_views_precondition() {
        let manifest = json!({"sources": []});
        let expected = view(json!({"import": manifest.clone()}), vec![]);
        let decision = persistence::history("op-1", &invoked(), Some(1)).unwrap();
        let Operation::CompareTransact { expected_generation, expected_integrity, transaction } =
            evidence_write(&expected, &manifest, decision.clone(), &invoked()).unwrap()
        else {
            panic!("not a guarded transaction")
        };
        assert_eq!((expected_generation, expected_integrity), (3, expected.snapshot.integrity.clone()));
        assert_eq!((transaction.id, transaction.decisions), (decision.id.clone(), vec![decision]));
        assert_eq!(transaction.snapshot, Some(persistence::project(&expected.snapshot.data, &invoked()).unwrap()));
    }
}
