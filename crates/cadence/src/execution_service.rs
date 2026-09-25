//! Native plan dispatch and executor-patch application.
//!
//! The resident calls these functions directly. They never send another
//! resident request, so the single owner cannot deadlock itself.
use cadence::process::Process;
use super::derivation_service::{self, Driver};
use crate::{
    config::reload::ConfigIo,
    import::{Session, SessionFactory},
};
use cadence::{
    derivation::{Cycle, LifecycleStatus},
    evidence::Scope,
    execution::{
        dispatch::{admit_dispatch, build_routed_dispatch},
        model::{
            ActiveDispatch, BoundaryTool, ExecutionOccurrence, ExecutionPlan, ExecutionSnapshot,
            ExecutorPatch, PlanDisposition, TerminalOutcome,
        },
        patch::{ApplicationDisposition, apply_executor_patch, attach_commit_paths},
        plan::{PlanGraph, parse_plan, plan_set_fingerprint},
        render::SUMMARY_RENDER_VERSION,
    },
    next_action::continuation::Decision as ContinuationDecision,
    store::{
        Error,
        model::digest,
        writer::{
            BoundaryChange, Operation, View, confirmed_boundary, require_current_execution,
            terminal_v1,
        },
    },
};

use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    sync::Arc,
};

use cadence::envelope::{Envelope, Refusal};
pub use cadence::execution::boundary::{Answer, Failure, Response};
use cadence::execution::boundary::{
    BoundaryScope, BoundaryV1, ExecutionEnvelope, Located, PreparedAnswer, Receipt,
};

#[derive(Clone)]
struct Plans {
    values: Vec<ExecutionPlan>,
    fingerprint: String,
}

pub(super) fn native_error(error:Error) -> Value {
    if let Error::Invalid(message) = &error
        && let Some(encoded) = message.strip_prefix("native-task-refusal:")
        && let Ok(answer) = serde_json::from_str::<Value>(encoded)
    { return answer; }
    if let Error::Invalid(message)|Error::Conflict(message)=&error
        && let Some(encoded)=message.strip_prefix("plan-refusal:")
        && let Ok(diagnostic)=serde_json::from_str::<cadence::plan::model::Diagnostic>(encoded)
    {return serde_json::to_value(diagnostic.answer()).expect("diagnostic");}
    Refusal::new("invalid-request", error.to_string()).rule("native-admission").slot("request").value()
}

pub async fn native_apply<I:ConfigIo+Clone+Sync>(factory:&SessionFactory<I>,root:&Path,raw:Value, process: &mut (dyn Process + Send)) -> cadence::store::Result<Value> {
    native_answer(factory, root, raw, process).await
}



/// The phase a refused native request was about: the diagnostic's own phase
/// where it has one, otherwise the phase the request named.
fn refused_phase(raw: &Value, answer: &Value) -> Option<u32> {
    [
        answer["phase"].as_u64(),
        raw["request"]["task"]["phase"].as_u64(),
        raw["request"]["plan"]["phase"].as_u64(),
        raw["request"]["contract"]["phase"].as_u64(),
        raw["submission"]["phase"].as_u64(),
        raw["scope"]["phase"].as_u64(),
        raw["request"]["phase"].as_u64(),
        raw["phase"].as_u64(),
    ]
    .into_iter()
    .flatten()
    .find_map(|phase| u32::try_from(phase).ok().filter(|phase| *phase > 0))
}

/// Record a native refusal as a boundary decision the way the schema-1 patch
/// path records undeclared-files: the answered code, the diagnostic's rule,
/// slot and id in `located`, the bounded envelope, and the stamp the writer
/// adds. The operation id is the boundary's own identity, so a replayed
/// refusal returns its receipt instead of appending a second record.
pub async fn record_native_refusal<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    raw: &Value,
    answer: &Value,
) -> cadence::store::Result<()> {
    // A treeless task must remain treeless, including its refusal path.
    if !root.is_dir() {
        return Ok(());
    }
    let phase = refused_phase(raw, answer).unwrap_or(0);
    let code = answer["code"].as_str().unwrap_or("invalid-request");
    let located = Located {
        rule: answer["rule"].as_str().map(str::to_owned),
        slot: answer["slot"].as_str().map(str::to_owned),
        id: answer["id"].as_str().filter(|id| !id.is_empty()).map(str::to_owned),
        ..Located::default()
    };
    let response = Response::Refused {
        phase,
        code: code.to_owned(),
        reason: cadence::execution::boundary::native_refusal_reason(
            &stable_reason(code, answer["reason"].as_str().unwrap_or_default())),
    };
    let encoding = || Error::Invalid("native refusal has no recordable boundary".to_owned());
    let mut decision = boundary(
        phase,
        BoundaryTool::CadenceApply,
        "executor",
        &public_request_digest(BoundaryTool::CadenceApply, Some(raw)),
        &response,
        None,
        None,
    )
    .map_err(|_| encoding())?
    .with_located(Some(located));
    decision.operation = "native-refusal".into();
    let session = factory.first_touch(root).await?;
    let view = session.derivation_view().await?;
    session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-observation:{}", decision.identity().map_err(|_| encoding())?),
            decision,
            change: Box::new(BoundaryChange::Observe),
        })
        .await?;
    Ok(())
}

async fn native_answer<I:ConfigIo+Clone+Sync>(factory:&SessionFactory<I>,root:&Path,raw:Value, process: &mut (dyn Process + Send)) -> cadence::store::Result<Value> {
    if raw["operation"] == "execution-worker-exit" {
        let report = match serde_json::from_value(raw) {
            Ok(cadence::execution::runner::PlanApply::WorkerExit { report }) => report,
            Err(error) => return Ok(native_error(Error::Invalid(error.to_string()))),
            _ => unreachable!("worker exit operation"),
        };
        let session = factory.first_touch(root).await?;
        session.config()?;
        return Ok(cadence::execution::runner::worker_exit(session.review_store(), report).await.unwrap_or_else(native_error));
    }
    if matches!(raw["operation"].as_str(), Some("execution-task-progress" | "execution-task-checkpoint" | "execution-task-answer")) {
        return native_progress_apply(factory, root, raw, process).await;
    }
    if matches!(raw["operation"].as_str(), Some("execution-task-close" | "execution-classify-run")) {
        return native_close_apply(factory, root, raw, process).await;
    }
    if raw["operation"] == "execution-owner-attest" {
        use cadence::execution::{history, receipts::OwnerApply, runner};
        let input = match serde_json::from_value::<OwnerApply>(raw) {
            Ok(OwnerApply::Attest { request }) => request,
            Err(error) => return Ok(native_error(Error::Invalid(error.to_string()))),
        };
        let session = factory.first_touch(root).await?;
        session.config()?;
        let result = runner::append(session.review_store(), history::Request { request_id: input.request_id, task: input.task,
            attempt: input.attempt, expected_version: input.expected_version, event: history::Event::OwnerStatement(input.statement) }).await;
        return Ok(match result { Ok(receipt) => json!({"status":"ok","receipt":receipt}), Err(error) => native_error(error) });
    }
    if raw["operation"] == "execution-task-retire" {
        use cadence::execution::{history::{self, RetirementApply}, runner};
        let input = match serde_json::from_value::<RetirementApply>(raw) {
            Ok(RetirementApply::Retire { request }) => request,
            Err(error) => return Ok(native_error(Error::Invalid(error.to_string()))),
        };
        let session = factory.first_touch(root).await?;
        session.config()?;
        let phase = input.task.phase;
        let plan = input.task.plan;
        let result = runner::append(session.review_store(), history::Request {
            request_id: input.request_id,
            task: input.task,
            attempt: input.attempt,
            expected_version: input.expected_version,
            event: history::Event::Retirement { owner: input.owner, at: input.at, reason: input.reason },
        }).await;
        return Ok(match result {
            Ok(receipt) => {
                let view = session.derivation_view().await?;
                let outcome = view.snapshot.data["execution"]["occurrences"][phase.to_string()]["plans"]
                    .as_array().and_then(|plans| plans.iter().find(|outcome| {
                        outcome["plan"] == plan && outcome["transition_id"] == receipt.request_digest
                    })).cloned().ok_or_else(|| Error::Invalid("confirmed retirement outcome missing".into()))?;
                json!({"status":"ok","receipt":receipt,"outcome":outcome})
            }
            Err(error) => native_error(error),
        });
    }
    if matches!(raw["operation"].as_str(), Some("execution-task-start" | "execution-run")) {
        return super::execution_runner_service::apply(factory, root, raw, process).await;
    }
    if matches!(raw["operation"].as_str(), Some("execution-suite" | "execution-suite-repair-answer" |
        "execution-suite-repair" | "execution-suite-relaunch" | "execution-plan-complete" | "execution-round-record")) {
        return super::execution_runner_service::plan_apply(factory, root, raw, process).await;
    }
    use cadence::execution::{admission,boundary::NativeApply};
    if matches!(raw["operation"].as_str(),Some("execution-admit"|"execution-extend")) {
        for field in ["request_id","expected_set_version","contract"] {
            let valid=match field {
                "request_id"=>raw["request"][field].is_string(),
                "expected_set_version"=>raw["request"][field].as_u64().is_some(),
                _=>raw["request"][field].is_object(),
            };
            if !valid {return Ok(native_error(admission::refuse(0,"admission-shape",&format!("request.{field}"),"","missing or malformed typed request field")));}
        }
    }
    if matches!(raw["operation"].as_str(),Some("execution-admit"|"execution-extend"))
        && let Err(error)=admission::decode(raw["request"]["contract"].clone())
    {return Ok(native_error(error));}
    let command=match serde_json::from_value::<NativeApply>(raw.clone()) {
        Ok(command)=>command,
        Err(error)=>return Ok(native_error(admission::refuse(0,"admission-shape","request","",error.to_string()))),
    };
    let session=factory.first_touch(root).await?;
    let before=session.derivation_view().await?;
    match command {
        NativeApply::Admit {request}|NativeApply::Extend {request} => {
            if (raw["operation"]=="execution-admit") != (request.expected_set_version==0) {
                return Ok(native_error(admission::refuse(request.contract.phase,"admission-set-version","expected_set_version",&request.request_id,"initial admission requires zero; extension requires an explicit current set version")));
            }
            let phase=request.contract.phase;let request_id=request.request_id.clone();
            let replayed=admission::records(&before.snapshot.data,phase)?.iter().any(|r|r.request.request_id==request_id);
            let written=match session.request(Operation::NativeAdmissionV1 {expected_generation:before.snapshot.generation,
                expected_integrity:before.snapshot.integrity,request:Box::new(request)}).await {
                Ok(written)=>written,Err(error)=>return Ok(native_error(error)),
            };
            let receipt=admission::records(&written.snapshot.data,phase)?.into_iter().find(|r|r.request.request_id==request_id)
                .ok_or_else(||Error::Invalid("confirmed admission receipt missing".into()))?;
            Ok(json!({"status":"ok","receipt":receipt,"replayed":replayed}))
        }
        NativeApply::Authorize {phase,request_id,owner,at,response,checkpoint,dispatch,disposition} => {
            use cadence::evidence::{Record,Fact,gates::{Gate,State,Purpose,Answer,Disposition},persistence};
            if phase==0 || [&request_id,&owner,&at,&response].iter().any(|s|s.trim().is_empty()) {
                return Ok(native_error(admission::refuse(phase,"authorization-answer","response",&request_id,"actual owner, time and response required")));
            }
            if admission::records(&before.snapshot.data,phase)?.is_empty() {
                return Ok(native_error(admission::refuse(phase,"admission-required","phase","","admit the native contract before authorizing execution")));
            }
            let disposition=disposition.unwrap_or(Disposition::Approve);
            if disposition==Disposition::Adjust {
                return Ok(native_error(admission::refuse(phase,"authorization-answer","disposition",&request_id,"a continuation answer approves or stops; adjustments are task checkpoint answers")));
            }
            let scope=continuation_scope(root,phase);
            let mut need = raw.clone();
            if let Some(id) = &dispatch {
                if checkpoint.is_some() {
                    return Ok(native_error(admission::refuse(phase,"continuation-target","dispatch",id,"a continuation names either a dispatch or a checkpoint")));
                }
                // Replay the owner's exact answer before checking whether it
                // already settled this interruption.
                let saved = persistence::read(&before.snapshot.data)?;
                if let Some(record) = saved.values().find(|r| matches!(&r.fact, Fact::Gate(g)
                    if g.id == format!("execution-authorization:{request_id}") && matches!(g.state, State::Answered(_)))) {
                    let Fact::Gate(gate) = &record.fact else { unreachable!() };
                    let mut original: Value = serde_json::from_str(&gate.need)?;
                    original.as_object_mut().expect("authorization request").remove("exit_request_id");
                    if original == raw { return Ok(json!({"status":"ok","authorization":record})); }
                    return Ok(native_error(admission::refuse(phase,"authorization-answer","request_id",&request_id,"request already names another owner answer")));
                }
                let Some(exit) = cadence::execution::history::unanswered_worker_exit(&before.snapshot.data,phase,id)? else {
                    return Ok(native_error(admission::refuse(phase,"continuation-target","dispatch",id,"dispatch has no unanswered interruption")));
                };
                need["exit_request_id"] = json!(exit.request.request_id);
            }
            // A linked answer continues or declines exactly one retained Stop.
            if let Some(checkpoint)=&checkpoint {
                let records=persistence::read(&before.snapshot.data)?;
                let stopped=records.values().any(|r|r.scope==scope && matches!(&r.fact,Fact::Gate(gate)
                    if gate.checkpoint_id.as_deref()==Some(checkpoint.as_str())
                        && matches!(&gate.state,State::Answered(answer) if answer.disposition==Disposition::Stop)));
                if checkpoint.trim().is_empty() || !stopped {
                    return Ok(native_error(admission::refuse(phase,"continuation-target","checkpoint",checkpoint,"continuation must name a retained checkpoint whose answer stopped execution")));
                }
            }
            let id=format!("execution-authorization:{request_id}");
            let mut gate=Gate {id:id.clone(),purpose:Purpose::Progress,checkpoint_id:checkpoint,
                question:"Continue native execution?".into(),need:serde_json::to_string(&need)?,options:vec![],state:State::Unanswered};
            let record=Record {version:1,scope:scope.clone(),fact:Fact::Gate(gate.clone())};
            let pending=session.commit_evidence(&before,&format!("{id}:question"),&record).await?;
            gate.state=State::Answered(Answer {question_id:id.clone(),actual_response:response,selected_option:None,adjustment:None,
                disposition,authorization_id:Some(digest(&serde_json::to_vec(&raw)?))});
            let answered=Record {version:1,scope,fact:Fact::Gate(gate)};
            session.commit_evidence(&pending,&format!("{id}:answer"),&answered).await?;
            Ok(json!({"status":"ok","authorization":answered}))
        }
    }
}

async fn native_close_apply<I:ConfigIo+Clone+Sync>(factory:&SessionFactory<I>,root:&Path,raw:Value, process: &mut (dyn Process + Send)) -> cadence::store::Result<Value> {
    use cadence::execution::{history::{self,Event}, receipts::{self,CloseApply,CloseProof}, runner};
    let session=factory.first_touch(root).await?;
    let view=session.derivation_view().await?;
    let input=match serde_json::from_value::<CloseApply>(raw.clone()) {
        Ok(input)=>input,
        Err(error)=>{
            if raw["operation"]=="execution-task-close"
                && let Ok(task)=serde_json::from_value::<history::Task>(raw["request"]["task"].clone()) {
                let checks=receipts::allocated(&view.snapshot.data,&task).unwrap_or_default();
                return Ok(native_error(receipts::unsatisfied(&task,"red-green",checks,&format!("malformed close evidence: {error}"))));
            }
            return Ok(native_error(Error::Invalid(error.to_string())));
        }
    };
    let result=match input {
        CloseApply::Classify {request}=>runner::append(session.review_store(),history::Request {request_id:request.request_id,task:request.task,
            attempt:request.attempt,expected_version:request.expected_version,event:Event::OwnerClassification(request.statement)}).await,
        CloseApply::Close {request}=>{
            let records=history::records(&view.snapshot.data,request.task.phase)?;
            if let Some(prior)=records.iter().find(|r|r.request.request_id==request.request_id) {
                return Ok(match &prior.request.event {
                    Event::Close(proof) if proof.submission==request=>native_close_answer(&view.snapshot.data, prior),
                    _=>native_error(cadence::execution::admission::refuse(request.task.phase,"task-request-reuse","request_id",&request.request_id,"request already names another close payload")),
                });
            }
            if history::project(&records,&request.task).completed {
                return Ok(native_error(cadence::execution::admission::refuse(request.task.phase,"task-completed","task",&request.task.task,"task already completed")));
            }
            let project=root.parent().ok_or_else(||Error::Invalid("project root missing".into()))?;
            let facts=receipts::observe_pairs(project,&records,&request, process);
            if let Err(error)=receipts::validate_pairs(&view.snapshot.data,&records,&request,&facts) {return Ok(native_error(error));}
            let active:ActiveDispatch=match serde_json::from_value(view.snapshot.data["execution"]["occurrences"][request.task.phase.to_string()]["active"].clone()) {
                Ok(active)=>active,Err(error)=>return Ok(native_error(Error::Invalid(error.to_string()))),
            };
            if records.iter().any(|r|matches!(&r.request.event,Event::Close(proof) if proof.submission.completion==request.completion)) {
                return Ok(native_error(Error::Invalid("completion commit already closes another task".into())));
            }
            let mut evidence=Vec::new();
            for pair in &request.checks {for commit in [&pair.red_commit,&pair.green_commit] {if !evidence.contains(commit) {evidence.push(commit.clone());}}}
            let source=match receipts::observe_source(project,&active,&request.task.task,&request.completion,&evidence, process) {
                Ok(source)=>source,Err(error)=>return Ok(native_error(error)),
            };
            let event=Event::Close(Box::new(CloseProof {submission:request.clone(),project:project.to_path_buf(),planning_root:root.to_path_buf(),dispatch:active,source}));
            runner::append(session.review_store(),history::Request {request_id:request.request_id,task:request.task,attempt:request.attempt,
                expected_version:request.expected_version,event}).await
        }
    };
    Ok(match result {
        Ok(receipt) => native_close_answer(&session.derivation_view().await?.snapshot.data, &receipt),
        Err(error) => native_error(error),
    })
}

fn native_close_answer(data: &Value, receipt: &cadence::execution::history::Record) -> Value {
    let mut answer = json!({"status":"ok","receipt":receipt});
    if let Some(summary) = data[cadence::execution::render::NATIVE_SUMMARIES]["receipts"].get(&receipt.request_digest) {
        answer["summary"] = summary.clone();
    }
    answer
}

async fn native_progress_apply<I:ConfigIo+Clone+Sync>(factory:&SessionFactory<I>,root:&Path,raw:Value, process: &mut (dyn Process + Send)) -> cadence::store::Result<Value> {
    use cadence::{execution::{history::{self,Event,ProgressApply,ProgressEvent},runner},evidence::{self,Fact,gates,checkpoint}};
    let input=match serde_json::from_value::<ProgressApply>(raw) {Ok(input)=>input,Err(error)=>return Ok(native_error(Error::Invalid(error.to_string())))};
    let session=factory.first_touch(root).await?;let view=session.derivation_view().await?;
    let project=root.parent().ok_or_else(||Error::Invalid("project root missing".into()))?;
    let request=match input {
        ProgressApply::Progress {request}=>{
            let event=match request.event {
                ProgressEvent::Progress {text,evidence}=>{
                    let prior=history::records(&view.snapshot.data,request.task.phase)?.into_iter().find(|r|r.request.request_id==request.request_id);
                    let commit=match prior.map(|r|r.request.event) {
                        Some(Event::AcknowledgedProgress {commit,..})=>commit,
                        _=>runner::git_text(project,&["rev-parse","HEAD"], process )?,
                    };
                    Event::AcknowledgedProgress {text,evidence,commit}
                }
                ProgressEvent::Deviation {text,evidence}=>Event::Deviation {text,evidence},
                ProgressEvent::FailedAttempt {text,evidence}=>Event::FailedAttempt {reason:text,evidence},
            };
            history::Request {request_id:request.request_id,task:request.task,attempt:request.attempt,expected_version:request.expected_version,event}
        }
        ProgressApply::Checkpoint {request}=>{
            if request.checkpoint.state!=checkpoint::State::Unresolved || request.checkpoint.task_name!=request.task.task {
                return Ok(native_error(Error::Invalid("checkpoint must identify the unfinished task and an unresolved decision".into())));
            }
            let scope=continuation_scope(root,request.task.phase);
            let purpose=match request.checkpoint.checkpoint_type {
                checkpoint::CheckpointType::Structural=>gates::Purpose::Structural,
                checkpoint::CheckpointType::HumanVerify=>gates::Purpose::HumanVerify,
                checkpoint::CheckpointType::Decision=>gates::Purpose::Decision,
                checkpoint::CheckpointType::Blocked=>gates::Purpose::Blocked,
                checkpoint::CheckpointType::SuiteRed=>return Ok(native_error(Error::Invalid("native suite checkpoint requires the plan-close lifecycle".into()))),
            };
            let gate=gates::Gate {id:request.question_id,purpose,checkpoint_id:Some(request.checkpoint.id.clone()),question:request.question,
                need:request.checkpoint.need.clone(),options:vec![],state:gates::State::Unanswered};
            let records=vec![evidence::Record {version:1,scope:scope.clone(),fact:Fact::Checkpoint(request.checkpoint)},
                evidence::Record {version:1,scope,fact:Fact::Gate(gate)}];
            history::Request {request_id:request.request_id,task:request.task,attempt:request.attempt,expected_version:request.expected_version,
                event:Event::Checkpoint {records,owner:None,at:None}}
        }
        ProgressApply::Answer {request}=>{
            if request.owner.trim().is_empty() || request.at.trim().is_empty() {return Ok(native_error(Error::Invalid("checkpoint answer requires actual owner attribution and time".into())));}
            let scope=continuation_scope(root,request.task.phase);
            let records=evidence::persistence::read(&view.snapshot.data)?;
            let Some(mut record)=records.values().find(|r|r.scope==scope && matches!(&r.fact,Fact::Gate(gate) if gate.id==request.answer.question_id)).cloned() else {
                return Ok(native_error(Error::Invalid("checkpoint answer lacks its retained question".into())));
            };
            let Fact::Gate(gate)=&mut record.fact else {unreachable!("selected gate")};
            gate.state=gates::State::Answered(request.answer);
            history::Request {request_id:request.request_id,task:request.task,attempt:request.attempt,expected_version:request.expected_version,
                event:Event::Checkpoint {records:vec![record],owner:Some(request.owner),at:Some(request.at)}}
        }
    };
    Ok(match runner::append(session.review_store(),request).await {Ok(receipt)=>json!({"status":"ok","receipt":receipt}),Err(error)=>native_error(error)})
}

fn execution_ready(root:&Path,data:&Value,phase:u32) -> cadence::store::Result<()> {
    let inventory=cadence::plan::inventory::read(root,&phase.to_string(),data)?;
    cadence::plan::persistence::require_execution_ready(data,phase,&inventory.documents)
}

pub fn continuation_scope(root: &Path, phase: u32) -> Scope {
    Scope {
        project: root.parent().unwrap_or(root).to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(),
        cycle: "live".into(),
        occurrence: format!("phase-{phase}-execution"),
        phase: phase.to_string(),
        plan: "native-execution".into(),
        report: format!("phases/{phase}/SUMMARY.md"),
    }
}

pub async fn query<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected_root: &Path,
    phase: u32,
    driver: &Driver,
    process: &mut (dyn Process + Send),
) -> Answer {
    query_selected(factory, selected_root, phase, None, driver, process).await
}

pub async fn query_selected<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected_root: &Path,
    phase: u32,
    selected_plan: Option<std::num::NonZeroU32>,
    driver: &Driver,
    process: &mut (dyn Process + Send),
) -> Answer {
    let request = match selected_plan {
        Some(plan) => json!({"operation":"execute-next","phase":phase,"plan":plan}),
        None => json!({"operation":"execute-next","phase":phase}),
    };
    let raw_request = public_request_digest(BoundaryTool::CadenceQuery, Some(&request));
    let (root, session, initial) = begin(factory, selected_root).await?;
    if let Some(answer) = terminal_answer(&session, &initial, &scope(phase)).await? {
        return Ok(answer);
    }
    if phase == 0 {
        return record_refusal(
            &session,
            &initial,
            phase,
            BoundaryTool::CadenceQuery,
            "execute-next",
            &raw_request,
            "invalid-phase",
            "phase must be a positive integer",
            None,
        )
        .await;
    }
    let (checked, mut view) = match checked_execution(&session, &root, driver).await {
        Ok(value) => value,
        Err(error) => {
            return derivation_refusal(
                &session,
                phase,
                BoundaryTool::CadenceQuery,
                &raw_request,
                error,
            )
            .await;
        }
    };
    let lifecycle = checked.answer();
    if let Some(interruption) = cadence::execution::history::interrupted_dispatch(
        &view.snapshot.data, phase, view.snapshot.generation).map_err(store_failure)? {
        let located = Located::rule("interrupted", "dispatch").id(&interruption.id);
        return record_located_refusal(&session, &view, phase, BoundaryTool::CadenceQuery,
            "execute-next", &raw_request, "continuation-refusal",
            format!("Continue dispatch {} with execution-authorize or retire it", interruption.id),
            Some(interruption.id), Some(located)).await;
    }
    let phase_record = match executable_phase(lifecycle, phase) {
        Ok(record) => record,
        Err((code, reason)) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                code,
                reason,
                None,
            )
            .await;
        }
    };
    if let Err(reason) =
        execution_ready(&root,&view.snapshot.data, phase)
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "execute-next",
            &raw_request,
            "provisional-authoring",
            reason.to_string(),
            None,
        )
        .await;
    }
    let mut plans = match observe_plans(&root, phase, &phase_record.plans).await {
        Ok(plans) => plans,
        Err((code, reason)) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                code,
                reason,
                None,
            )
            .await;
        }
    };
    // Execution's historical grouping fingerprint stays bound to the original
    // basis. Explicit native extensions have their own set version and retain
    // all current plan bytes, without rekeying prior dispatch/risk receipts.
    let admissions=cadence::execution::admission::records(&view.snapshot.data,phase).map_err(store_failure)?;
    if let Some(first)=admissions.first() {
        let original=plans.values.iter().filter(|p|first.request.contract.plans.iter().any(|b|b.plan==p.plan)).cloned().collect::<Vec<_>>();
        plans.fingerprint=plan_set_fingerprint(&original).map_err(|_|Failure::Encoding)?;
    }
    let native=!admissions.is_empty();
    let execution = match execution_snapshot(&view) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "invalid-execution-store",
                error,
                None,
            )
            .await;
        }
    };
    let occurrence = execution.occurrences.get(&phase.to_string()).cloned();
    if let Some(occurrence) = &occurrence {
        if occurrence.plan_set_fingerprint != plans.fingerprint {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "plan-set-changed",
                "native plan inputs differ from the admitted execution occurrence",
                occurrence.active.as_ref().map(|active| active.id.clone()),
            )
            .await;
        }
        if let Err(reason) = execution_risk(&session, &view, &root, phase) {
            return record_observation(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "execute-next",
                &raw_request,
                refused(phase, "risk-pending", reason),
                None,
                Some(Located::rule("risk-pending", "risk")),
            )
            .await;
        }
        // A stored Complete terminal is history once a later extension admits a
        // plan without an outcome: phase_complete, not the stored field, decides
        // whether the phase still answers complete (D-162).
        let current_terminal = match &occurrence.terminal {
            Some(TerminalOutcome::Complete { .. }) => {
                cadence::execution::history::phase_complete(&view.snapshot.data, phase)
                    .map_err(store_failure)?
            }
            Some(_) => true,
            None => false,
        };
        if let Some(terminal) = occurrence.terminal.as_ref().filter(|_| current_terminal) {
            let response = terminal_response(phase, terminal);
            return record_observation(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                response,
                occurrence.active.as_ref().map(|active| active.id.clone()),
                None,
            )
            .await;
        }
        // A native phase authorizes continuation before any replay; see below.
        if let Some(active) = occurrence.active.as_ref().filter(|_| !native) {
            let plan = match active_plan(active, &plans.values) {
                Ok(plan) => plan,
                Err((code, reason)) => {
                    return record_refusal(
                        &session,
                        &view,
                        phase,
                        BoundaryTool::CadenceQuery,
                        "query-next",
                        &raw_request,
                        code,
                        reason,
                        Some(active.id.clone()),
                    )
                    .await;
                }
            };
            let project = match root.parent() {
                Some(project) => project,
                None => {
                    return record_refusal(
                        &session,
                        &view,
                        phase,
                        BoundaryTool::CadenceQuery,
                        "query-next",
                        &raw_request,
                        "invalid-project-root",
                        "planning root has no project parent",
                        Some(active.id.clone()),
                    )
                    .await;
                }
            };
            let head = match git_head(project).await {
                Ok(head) => head,
                Err(reason) => {
                    return record_refusal(
                        &session,
                        &view,
                        phase,
                        BoundaryTool::CadenceQuery,
                        "query-next",
                        &raw_request,
                        "git-head",
                        reason,
                        Some(active.id.clone()),
                    )
                    .await;
                }
            };
            let response = dispatch_response(active, plan);
            if let Err(reason) = reobserve(
                &session,
                &view,
                &root,
                phase,
                &phase_record.plans,
                &plans,
                Some(&head)
            )
            .await
            {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    "inputs-changed",
                    reason,
                    Some(active.id.clone()),
                )
                .await;
            }
            let Response::Dispatch { .. } = &response else {
                return record_observation(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    response,
                    Some(active.id.clone()),
                    None,
                )
                .await;
            };
            if active.expected_execution_version != occurrence.version || occurrence.version == 0 {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "query-next",
                    &raw_request,
                    "invalid-active-dispatch",
                    "active dispatch execution version is inconsistent",
                    Some(active.id.clone()),
                )
                .await;
            }
            let decision = boundary(
                phase,
                BoundaryTool::CadenceQuery,
                "execute-next",
                &raw_request,
                &response,
                Some(active.id.clone()),
                Some(active.prompt_digest.clone()),
            )?;
            if let Ok(confirmed) = confirmed_boundary(&view, &decision) {
                return confirmed.envelope(Some(response.into_envelope()));
            }
            let Response::Dispatch { dispatch, prompt } = &response else { unreachable!() };
            let historical = view.decisions.iter().find_map(|record| match &record.decision {
                cadence::store::model::Decision::BoundaryV1(value)
                    if value.boundary.request_digest == raw_request
                        && value.boundary.subject_id.as_ref() == Some(&dispatch.id)
                        && value.boundary.outcome == "dispatch" => Some(&value.boundary),
                _ => None,
            }).ok_or(Failure::Confirmation)?;
            return confirmed_boundary(&view, historical)?.historical_dispatch(dispatch, prompt);
        }
    }

    let continuation = match checked_continuation(&session, &view, &checked, phase, driver).await {
        Ok(value) => value,
        Err(error) => {
            view = match session.derivation_view().await {
                Ok(latest) => latest,
                Err(store) => return store_refusal(phase, store),
            };
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code(),
                format!("{error:?}"),
                None,
            )
            .await;
        }
    };
    if !may_continue(&continuation.decision) {
        view = match session.derivation_view().await {
            Ok(latest) => latest,
            Err(error) => return store_refusal(phase, error),
        };
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "continuation-refusal",
            continuation_next_call(&continuation.decision),
            None,
        )
        .await;
    }
    view = match session.derivation_view().await {
        Ok(latest) => latest,
        Err(error) => return store_refusal(phase, error),
    };
    if native {
        let continuation_view = match &continuation.decision {
            ContinuationDecision::Continue { answer, rerun_plans, .. } => {
                if !rerun_plans.is_empty() {
                    return record_refusal(&session, &view, phase, BoundaryTool::CadenceQuery, "execute-next", &raw_request,
                        "native-rerun", "native execution never reruns an admitted plan; publish and admit a linked gap plan", None).await;
                }
                match answer {
                    Some(answer) => {
                        let checkpoint = cadence::evidence::persistence::read(&view.snapshot.data).map_err(store_failure)?.into_values()
                            .find_map(|r| match &r.fact {
                                cadence::evidence::Fact::Gate(gate) if gate.id == answer.question_id => Some(gate.checkpoint_id.clone()),
                                _ => None,
                            }).flatten();
                        json!({"question_id":answer.question_id,"authorization_id":answer.authorization_id,
                            "response":answer.actual_response,"checkpoint":checkpoint})
                    }
                    None => Value::Null,
                }
            }
            ContinuationDecision::RepairSuite { question_id, approved: true } => {
                json!({"suite_repair":{"question_id":question_id,"approved":true}})
            }
            _ => unreachable!("checked above"),
        };
        return native_query(&session, &view, &root, phase, selected_plan, &phase_record.plans, &plans, &admissions, continuation_view, &raw_request, driver, process).await;
    }
    let execution = match execution_snapshot(&view) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "invalid-execution-store",
                error,
                None,
            )
            .await;
        }
    };
    let occurrence = execution
        .occurrences
        .get(&phase.to_string())
        .cloned()
        .unwrap_or_else(|| ExecutionOccurrence {
            phase,
            undone: None,
            plan_set_fingerprint: plans.fingerprint.clone(),
            version: 0,
            active: None,
            plans: Vec::new(),
            terminal: None,
            receipts: BTreeMap::new(), issues: BTreeMap::new(),
        });
    if occurrence.plan_set_fingerprint != plans.fingerprint {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "plan-set-changed",
            "native plan inputs differ from the admitted execution occurrence",
            None,
        )
        .await;
    }
    let risk_config = session.config().map_err(store_failure)?;
    let requirements =
        match super::rail_service::execution_requirements(&view, &root, phase, &risk_config) {
            Ok(requirements) => requirements,
            Err(reason) => {
                return record_observation(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceQuery,
                    "execute-next",
                    &raw_request,
                    refused(phase, "risk-pending", reason),
                    None,
                    Some(Located::rule("risk-pending", "risk")),
                )
                .await;
            }
        };
    let graph = match PlanGraph::build(&plans.values) {
        Ok(graph) => graph,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code,
                error.detail,
                None,
            )
            .await;
        }
    };
    let completed = occurrence
        .plans
        .iter()
        .filter(|outcome| outcome.disposition == PlanDisposition::Complete)
        .map(|outcome| outcome.plan)
        .collect::<BTreeSet<_>>();
    let Some(next) = graph.next_ready(&completed) else {
        if let Err(reason) = reobserve(
            &session,
            &view,
            &root,
            phase,
            &phase_record.plans,
            &plans,
            None
        )
        .await
        {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "execute-next",
                &raw_request,
                "inputs-changed",
                reason,
                None,
            )
            .await;
        }
        if session.config().map_err(store_failure)? != risk_config {
            return Err(Failure::Store);
        }
        let response = Response::Complete { phase };
        let decision = boundary(
            phase,
            BoundaryTool::CadenceQuery,
            "execute-next",
            &raw_request,
            &response,
            None,
            None,
        )?;
        let written = session
            .request(Operation::BoundaryV1 {
                expected_generation: view.snapshot.generation,
                expected_integrity: view.snapshot.integrity.clone(),
                operation_id: format!("execution-finalize:{}", decision.identity()?),
                decision: decision.clone(),
                change: Box::new(BoundaryChange::FinalizeRisk {
                    phase,
                    requirements,
                }),
            })
            .await
            .map_err(store_failure)?;
        return confirmed_boundary(&written, &decision)?.envelope(None);
    };
    let plan = plans
        .values
        .iter()
        .find(|plan| plan.plan == next)
        .expect("graph plan came from observed set");
    let project = match root.parent() {
        Some(project) => project.to_path_buf(),
        None => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "invalid-project-root",
                "planning root has no project parent",
                None,
            )
            .await;
        }
    };
    let base_sha = match git_head(&project).await {
        Ok(sha) => sha,
        Err(reason) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "git-head",
                reason,
                None,
            )
            .await;
        }
    };
    let config = session.config().map_err(store_failure)?;
    let choice = match super::config_service::route_at(
        &config,
        &super::config_service::RouteRequest {
            role: "cad-executor".into(),
            phase: std::num::NonZeroU32::new(phase),
            plan: std::num::NonZeroU32::new(plan.plan),
            attempt: None,
        },
        &root,
    ) {
        Ok(route) => route.choice,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                "route-unavailable",
                error.to_string(),
                None,
            )
            .await;
        }
    };
    let route = cadence::execution::model::DispatchRoute {
        choice,
        inputs: super::config_service::routing_inputs(&config),
    };
    let mut candidate = match build_routed_dispatch(
        plan,
        &plans.fingerprint,
        occurrence.version,
        &base_sha,
        route,
    ) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code,
                error.detail,
                None,
            )
            .await;
        }
    };
    let (_, provisional) = match admit_dispatch(&occurrence, candidate.clone()) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceQuery,
                "query-next",
                &raw_request,
                error.code,
                error.detail,
                Some(candidate.id),
            )
            .await;
        }
    };
    let prompt = render_prompt(&provisional);
    candidate.prompt_digest = cadence::store::model::digest(prompt.as_bytes());
    candidate.prompt = prompt.clone();
    let (_, dispatch) = admit_dispatch(&occurrence, candidate.clone())
        .expect("retained prompt does not alter dispatch admission");
    let response = Response::Dispatch {
        dispatch: Box::new(dispatch.clone()),
        prompt,
    };

    #[cfg(test)]
    {
        let event = driver.event.clone();
        if tokio::task::spawn_blocking(move || event(derivation_service::Event::RoutingObserved))
            .await
            .is_err()
        {
            return store_refusal(phase, Error::Closed);
        }
    }
    if let Err(reason) = reobserve(
        &session,
        &view,
        &root,
        phase,
        &phase_record.plans,
        &plans,
        Some(&base_sha)
    )
    .await
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceQuery,
            "query-next",
            &raw_request,
            "inputs-changed",
            reason,
            Some(dispatch.id),
        )
        .await;
    }
    let decision = boundary(
        phase,
        BoundaryTool::CadenceQuery,
        "execute-next",
        &raw_request,
        &response,
        Some(dispatch.id.clone()),
        Some(dispatch.prompt_digest.clone()),
    )?;
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-dispatch:{}", dispatch.id),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Dispatch {
                plan_set_fingerprint: plans.fingerprint,
                dispatch: candidate,
            }),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(Some(response.into_envelope()))
}

/// Native dispatch is composed from confirmed state after continuation
/// authority: the admitted plan's unfinished tasks are executable, completed
/// tasks are history, and the immutable admitted dispatch is never rewritten.
pub(crate) fn select_ready_plan(admitted: &[u32], outcomes: &[u32],
    selected: Option<std::num::NonZeroU32>) -> Result<u32, &'static str> {
    if let Some(selected) = selected {
        let selected = selected.get();
        if !admitted.contains(&selected) { return Err("plan-not-admitted") }
        if outcomes.contains(&selected) { return Err("plan-completed") }
        return Ok(selected);
    }
    admitted.iter().copied().find(|plan| !outcomes.contains(plan)).ok_or({
        if admitted.is_empty() { "empty-plan-set" } else { "suite-failed" }
    })
}

#[allow(clippy::too_many_arguments)]
async fn native_query<I: ConfigIo + Clone + Sync>(
    session: &Arc<Session<I>>,
    view: &View,
    root: &Path,
    phase: u32,
    selected_plan: Option<std::num::NonZeroU32>,
    names: &[String],
    plans: &Plans,
    admissions: &[cadence::execution::admission::Record],
    continuation: Value,
    raw_request: &str,
    driver: &Driver,
    process: &mut (dyn Process + Send),
) -> Answer {
    use cadence::execution::{
        dispatch::{NativeState, admitted_checks, native_dispatch, native_operational},
        history, instructions, model::TaskSpec, runner,
    };
    let refuse = |code: &'static str, reason: String, subject: Option<String>| {
        record_refusal(session, view, phase, BoundaryTool::CadenceQuery, "execute-next", raw_request, code, reason, subject)
    };
    let execution = match execution_snapshot(view) {
        Ok(value) => value,
        Err(error) => return refuse("invalid-execution-store", error, None).await,
    };
    let occurrence = execution.occurrences.get(&phase.to_string()).cloned().unwrap_or_else(|| ExecutionOccurrence {
        phase, undone: None, plan_set_fingerprint: plans.fingerprint.clone(), version: 0, active: None, plans: Vec::new(), terminal: None, receipts: BTreeMap::new(), issues: BTreeMap::new(),
    });
    if occurrence.plan_set_fingerprint != plans.fingerprint {
        return refuse("plan-set-changed", "native plan inputs differ from the admitted execution occurrence".into(), None).await;
    }
    let data = &view.snapshot.data;
    let records = history::records(data, phase).map_err(store_failure)?;
    let Some(project) = root.parent().map(Path::to_path_buf) else {
        return refuse("invalid-project-root", "planning root has no project parent".into(), None).await;
    };
    let head = match git_head(&project).await {
        Ok(head) => head,
        Err(reason) => return refuse("git-head", reason, None).await,
    };
    let latest = admissions.last().expect("native phase has an admission");
    let mut candidate = None;
    let (plan, admitted) = match &occurrence.active {
        Some(active) => {
            if selected_plan.is_some_and(|selected| selected.get() != active.plan) {
                return refuse("active-plan-conflict", format!(
                    "owner selected plan {} while plan {} has the active dispatch",
                    selected_plan.expect("selected plan").get(), active.plan), Some(active.id.clone())).await;
            }
            let plan = match active_plan(active, &plans.values) {
                Ok(plan) => plan,
                Err((code, reason)) => return refuse(code, reason, Some(active.id.clone())).await,
            };
            if active.expected_execution_version != occurrence.version || occurrence.version == 0 {
                return refuse("invalid-active-dispatch", "active dispatch execution version is inconsistent".into(), Some(active.id.clone())).await;
            }
            (plan, active.clone())
        }
        None => {
            // The next plan is the first admitted plan without a retained outcome;
            // a failed plan is never rerun, and its repair is a later gap plan.
            let admitted_plans = history::admitted_plans(data, phase).map_err(store_failure)?;
            let admitted_numbers = admitted_plans.iter().map(|(identity, _)| identity.plan).collect::<Vec<_>>();
            let outcome_numbers = occurrence.plans.iter().map(|outcome| outcome.plan).collect::<Vec<_>>();
            let next = match select_ready_plan(&admitted_numbers, &outcome_numbers, selected_plan) {
                Ok(next) => next,
                Err("plan-not-admitted") => return refuse("plan-not-admitted", format!(
                    "owner-selected plan {} is not admitted", selected_plan.expect("selected plan").get()), None).await,
                Err("plan-completed") => return refuse("plan-completed", format!(
                    "owner-selected plan {} already has an outcome", selected_plan.expect("selected plan").get()), None).await,
                Err("empty-plan-set") => return refuse("empty-plan-set", "the admitted set names no plan".into(), None).await,
                Err(_) => return refuse("suite-failed", "every admitted plan has an outcome and a failed suite has no completed repair; publish and admit an explicitly linked gap plan through a versioned set extension (D-120)".into(), None).await,
            };
            let plan = plans.values.iter().find(|plan| plan.plan == next).expect("admitted plans are observed");
            let config = session.config().map_err(store_failure)?;
            let choice = match super::config_service::route_at(&config, &super::config_service::RouteRequest {
                role: "cad-executor".into(), phase: std::num::NonZeroU32::new(phase), plan: std::num::NonZeroU32::new(plan.plan), attempt: None,
            }, root) {
                Ok(route) => route.choice,
                Err(error) => return refuse("route-unavailable", error.to_string(), None).await,
            };
            let route = cadence::execution::model::DispatchRoute { choice, inputs: super::config_service::routing_inputs(&config) };
            let mut built = match build_routed_dispatch(plan, &plans.fingerprint, occurrence.version, &head, route) {
                Ok(value) => value,
                Err(error) => return refuse(error.code, error.detail, None).await,
            };
            built.owner_selection = selected_plan.map(|plan| cadence::execution::model::OwnerSelection { plan });
            let (_, provisional) = match admit_dispatch(&occurrence, built.clone()) {
                Ok(value) => value,
                Err(error) => return refuse(error.code, error.detail, Some(built.id)).await,
            };
            candidate = Some(built);
            (plan, provisional)
        }
    };
    let basis = admissions.iter().find(|r| r.request.contract.plans.iter().any(|b| b.plan == plan.plan)).expect("admitted plan has a basis");
    let views = match history::plan_task_views(data, &records, phase, plan.plan) {
        Ok(views) => views,
        Err(error) => return refuse("invalid-execution-store", error.to_string(), Some(admitted.id.clone())).await,
    };
    let mut tasks = Vec::new();
    let mut completed = Vec::new();
    let mut executable = Vec::new();
    let mut unfinished = Vec::new();
    for task in views {
        if let Some(mut done) = history::completed_view(&records, &task) {
            done["document_identity"] = json!({"kind":"task-summary","phase":task.task.phase,
                "occurrence":task.task.occurrence,"plan":task.task.plan,"task":task.task.task});
            completed.push(done);
            continue;
        }
        let uncertainty = runner::uncertainty(&project, &records, &task, process).map_err(store_failure)?;
        if uncertainty["requires_reconciliation"] == true {
            return refuse("reconciliation-required", format!(
                "task {} has unacknowledged work (commits {}, dirty source {}); acknowledge it through execution-task-progress before continuing",
                task.task.task, uncertainty["commits"], uncertainty["dirty_source"] == true), Some(admitted.id.clone())).await;
        }
        tasks.push(json!({"id":task.task.task,"verify":task.verify,"checks":task.checks,"state":task.state,
            "uncertainty":uncertainty,"checkpoints":history::task_checkpoints(&records, &task.task)}));
        executable.push(TaskSpec { id: task.task.task.clone(), verify: task.verify.clone() });
        unfinished.push(task);
    }
    let checks = match admitted_checks(data, phase, basis, &unfinished) {
        Ok(checks) => checks,
        Err(error) => return refuse("invalid-execution-store", error.to_string(), Some(admitted.id.clone())).await,
    };
    // Configured commands are provenance for proposals; the admitted commands
    // govern, and a manifest supplies vocabulary only, never a guessed runner.
    let config = session.config().map_err(store_failure)?;
    let configured = ["workflow.test_command", "workflow.lint_command"].into_iter().map(|key| instructions::ConfiguredCommand {
        key: key.into(),
        value: crate::config::merge::get(&config.effective.values, key).and_then(Value::as_str).map(str::to_owned),
        layer: config.effective.sources.get(key).and_then(|layer| serde_json::to_value(layer).ok()?.as_str().map(str::to_owned)),
    }).collect::<Vec<_>>();
    let present = instructions::MANIFESTS.iter().map(|(name, _)| *name).filter(|name| project.join(name).exists()).collect::<Vec<_>>();
    let plan_events = history::plan_records(data, phase).map_err(store_failure)?;
    let suite_state = history::plan_project(&plan_events, &history::PlanIdentity { phase, occurrence: basis.request.contract.occurrence.clone(),
        admission_digest: basis.request_digest.clone(), plan: plan.plan });
    let state = NativeState { admitted: &admitted, occurrence: &basis.request.contract.occurrence, admission_digest: &basis.request_digest,
        set_version: latest.set_version, head: &head, tasks, checks, completed, continuation,
        suite: json!({"command": admitted.suite, "state": suite_state}), commands: instructions::command_policy(&configured, &present) };
    let operational = native_operational(&state);
    // Historical unchanged requests are confirmed over their original prompt
    // envelope. Projection never changes that receipt's digest or identity.
    if candidate.is_none() && occurrence.issues.is_empty() && !admitted.prompt.is_empty()
        && cadence::execution::boundary::canonical_bytes(&operational)
            .is_ok_and(|bytes| cadence::store::model::digest(&bytes) == admitted.issue_digest)
    {
        let mut historical = admitted.clone();
        historical.body = plan.body.clone();
        let decision = view.decisions.iter().find_map(|record| match &record.decision {
            cadence::store::model::Decision::BoundaryV1(value)
                if value.boundary.request_digest == raw_request
                    && value.boundary.subject_id.as_ref() == Some(&historical.id)
                    && value.boundary.outcome == "dispatch" => Some(&value.boundary),
            _ => None,
        }).ok_or(Failure::Confirmation)?;
        return confirmed_boundary(view, decision)?.historical_dispatch(&historical, &historical.prompt);
    }
    let binding = cadence::execution::dispatch::issue_binding(data, &admitted).map_err(store_failure)?;
    let issue_digest = cadence::execution::dispatch::binding_digest(&binding).map_err(store_failure)?;
    let previous_issue = occurrence.issues.iter().find(|(_, issue)| issue.binding == binding);
    let (mut dispatch, mut operational) = match native_dispatch(&admitted, operational, executable, candidate.is_some()) {
        Ok(value) => value,
        Err(error) => return refuse(error.code, error.detail, Some(admitted.id.clone())).await,
    };
    if let Some((id, _)) = previous_issue {
        dispatch.id = id.clone();
    } else if candidate.is_none() {
        dispatch.id = cadence::store::model::digest(format!("native-issued-dispatch-1:{}:{issue_digest}", admitted.id).as_bytes());
    }
    operational["dispatch_id"] = json!(dispatch.id);
    operational["issued_generation"] = previous_issue.map_or_else(
        || json!(view.snapshot.generation + 1), |(_, issue)| issue.operational["issued_generation"].clone());
    let issue = cadence::execution::model::DispatchIssue {
        issue_digest: issue_digest.clone(), binding, operational: operational.clone(),
    };
    let fresh = candidate.is_some();
    dispatch.prompt.clear();
    dispatch.prompt_digest.clear();
    dispatch.prompt_bytes = None;
    let (prompt, reissued) = match issue_prompt(&mut dispatch, &issue_digest, fresh, String::new) {
        Ok(value) => value,
        Err((code, reason)) => return refuse(code, reason, Some(dispatch.id.clone())).await,
    };
    let response = Response::Dispatch { dispatch: Box::new(dispatch.clone()), prompt };
    #[cfg(test)]
    {
        if candidate.is_some() {
            let event = driver.event.clone();
            if tokio::task::spawn_blocking(move || event(derivation_service::Event::RoutingObserved)).await.is_err() {
                return store_refusal(phase, Error::Closed);
            }
        }
    }
    #[cfg(not(test))]
    let _ = driver;
    if let Err(reason) = reobserve(session, view, root, phase, names, plans, Some(&head)).await {
        return refuse("inputs-changed", reason, Some(dispatch.id.clone())).await;
    }
    let decision = boundary(phase, BoundaryTool::CadenceQuery, "execute-next", raw_request, &response, Some(dispatch.id.clone()), Some(dispatch.prompt_digest.clone()))?;
    let (operation_id, change) = match candidate {
        Some(mut candidate) => {
            candidate.prompt = dispatch.prompt.clone();
            candidate.prompt_digest = dispatch.prompt_digest.clone();
            candidate.issue_digest = dispatch.issue_digest.clone();
            (format!("execution-dispatch:{}", dispatch.id), BoundaryChange::Dispatch { plan_set_fingerprint: plans.fingerprint.clone(), dispatch: candidate })
        }
        None if reissued => {
            let mut retained = admitted;
            retained.issue_digest = dispatch.issue_digest.clone();
            (format!("execution-reissue:{}", dispatch.id), BoundaryChange::Reissue {
                issue_dispatch_id: dispatch.id.clone(),
                dispatch: retained,
            })
        }
        None => (format!("execution-observation:{}", decision.identity()?), BoundaryChange::Observe),
    };
    let change = if previous_issue.is_none() {
        BoundaryChange::Issue { change: Box::new(change), id: dispatch.id.clone(), issue }
    } else { change };
    let written = session.request(Operation::BoundaryV1 {
        expected_generation: view.snapshot.generation, expected_integrity: view.snapshot.integrity.clone(),
        operation_id, decision: decision.clone(), change: Box::new(change),
    }).await.map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(Some(response.into_envelope()))
}

pub async fn apply<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected_root: &Path,
    patch: ExecutorPatch,
    driver: &Driver,
) -> Answer {
    let raw = serde_json::to_value(&patch).map_err(|_| Failure::Encoding)?;
    let request = public_request_digest(BoundaryTool::CadenceApply, Some(&raw));
    let (root, session, initial) = begin(factory, selected_root).await?;
    let phase = dispatch_phase(&initial, &patch.dispatch_id)?.unwrap_or(0);
    if !cadence::execution::admission::records(&initial.snapshot.data,phase).map_err(store_failure)?.is_empty() {
        return record_refusal(&session,&initial,phase,BoundaryTool::CadenceApply,"executor",&request,
            "native-task-close-unavailable","native tasks cannot close through a schema-1 executor patch",Some(patch.dispatch_id.clone())).await;
    }
    if let Some(answer) = terminal_answer(&session, &initial, &scope(phase)).await? {
        return Ok(answer);
    }
    if phase == 0 {
        return record_refusal(
            &session,
            &initial,
            0,
            BoundaryTool::CadenceApply,
            "executor",
            &request,
            "foreign-dispatch",
            "the patch does not identify a dispatch in this store",
            None,
        )
        .await;
    }
    let (checked, view) = match checked_execution(&session, &root, driver).await {
        Ok(value) => value,
        Err(error) => {
            return derivation_refusal(
                &session,
                phase,
                BoundaryTool::CadenceApply,
                &request,
                error,
            )
            .await;
        }
    };
    let Some(phase_record) = checked
        .answer()
        .phases
        .iter()
        .find(|record| record.id.number() == f64::from(phase))
        .cloned()
    else {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "unknown-phase",
            "the lifecycle does not contain the requested phase",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    };
    let plans = match observe_plans(&root, phase, &phase_record.plans).await {
        Ok(plans) => plans,
        Err((code, reason)) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                code,
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let execution = match execution_snapshot(&view) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                "invalid-execution-store",
                error,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let Some(occurrence) = execution.occurrences.get(&phase.to_string()) else {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "missing-execution",
            "the phase has no execution occurrence",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    };
    if occurrence.plan_set_fingerprint != plans.fingerprint {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "plan-set-changed",
            "native plan inputs differ from the admitted execution occurrence",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    let application = match apply_executor_patch(&view.snapshot.data, &patch) {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                error.code,
                error.detail,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    if application.disposition == ApplicationDisposition::Replay {
        let prior = view
            .decisions
            .iter()
            .find_map(|record| match &record.decision {
                cadence::store::model::Decision::BoundaryV1(value)
                    if value.boundary.scope == scope(phase)
                        && value.boundary.tool == BoundaryTool::CadenceApply
                        && value.boundary.request_digest == request
                        && value.boundary.subject_id.as_ref() == Some(&patch.dispatch_id)
                        && (matches!(value.boundary.receipt, Receipt::Compact { envelope: Envelope::Ok(_) })
                            || matches!(&value.boundary.receipt, Receipt::Compact { envelope: Envelope::Refused { code, .. } } if code == "risk-pending")) =>
                {
                    Some(&value.boundary)
                }
                _ => None,
            })
            .ok_or(Failure::Confirmation)?;
        if matches!(
            prior.receipt,
            Receipt::Compact {
                envelope: Envelope::Ok(_)
            }
        ) && let Err(reason) = execution_risk(&session, &view, &root, phase)
        {
            return record_observation(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                refused(phase, "risk-pending", reason),
                Some(patch.dispatch_id.clone()),
                Some(Located::rule("risk-pending", "risk").id(patch.dispatch_id.clone())),
            )
            .await;
        }
        if let Err(reason) = reobserve(
            &session,
            &view,
            &root,
            phase,
            &phase_record.plans,
            &plans,
            None
        )
        .await
        {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                "inputs-changed",
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
        return confirmed_boundary(&view, prior)?.envelope(None);
    }
    if application.disposition == ApplicationDisposition::Applied
        && (checked.answer().cycle != Cycle::Live
            || checked
                .answer()
                .current
                .is_none_or(|current| current.number() != f64::from(phase))
            || !matches!(
                phase_record.status,
                LifecycleStatus::Planned | LifecycleStatus::Executed
            ))
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "lifecycle-refusal",
            "the active phase no longer has executable lifecycle authority",
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    let (commit_paths, base_sha) = {
        let Some(active) = occurrence.active.as_ref() else {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                "foreign-dispatch",
                "the patch does not name the active dispatch",
                Some(patch.dispatch_id.clone()),
            )
            .await;
        };
        if let Err((code, reason)) = active_plan(active, &plans.values) {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                code,
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
        let project = match root.parent() {
            Some(project) => project.to_path_buf(),
            None => {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceApply,
                    "executor",
                    &request,
                    "invalid-project-root",
                    "planning root has no parent",
                    Some(patch.dispatch_id.clone()),
                )
                .await;
            }
        };
        let head = match git_head(&project).await {
            Ok(head) => head,
            Err(reason) => {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceApply,
                    "apply-executor-patch",
                    &request,
                    "git-head",
                    reason,
                    Some(patch.dispatch_id.clone()),
                )
                .await;
            }
        };
        let paths = match validate_commits(&project, active, &patch, &head).await {
            Ok(paths) => paths,
            Err((code, reason)) => {
                return record_refusal(
                    &session,
                    &view,
                    phase,
                    BoundaryTool::CadenceApply,
                    "apply-executor-patch",
                    &request,
                    code,
                    reason,
                    Some(patch.dispatch_id.clone()),
                )
                .await;
            }
        };
        (paths, head)
    };
    let project = root.parent().ok_or(Failure::Encoding)?;
    let staged = match observe_staged(project).await {
        Ok(value) => value,
        Err(reason) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                "staged-paths",
                reason,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let application = match attach_commit_paths(application, &commit_paths, &staged.paths) {
        Ok(value) => value,
        Err(error) => {
            if let Some(paths) = error.undeclared {
                return record_lease_refusal(&session, &view, &request, *paths).await;
            }
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "apply-executor-patch",
                &request,
                error.code,
                error.detail,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    if application.disposition == ApplicationDisposition::Applied
        && let Err(reason) = reobserve(
            &session,
            &view,
            &root,
            phase,
            &phase_record.plans,
            &plans,
            Some(&base_sha)
        )
        .await
    {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "apply-executor-patch",
            &request,
            "inputs-changed",
            reason,
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    if let Err(reason) = reobserve_staged(project, &staged).await {
        return record_refusal(
            &session,
            &view,
            phase,
            BoundaryTool::CadenceApply,
            "executor",
            &request,
            "inputs-changed",
            reason,
            Some(patch.dispatch_id.clone()),
        )
        .await;
    }
    let next_execution = match application
        .data
        .get("execution")
        .ok_or_else(|| "snapshot has no execution namespace".to_owned())
        .and_then(execution_value)
    {
        Ok(value) => value,
        Err(error) => {
            return record_refusal(
                &session,
                &view,
                phase,
                BoundaryTool::CadenceApply,
                "executor",
                &request,
                "invalid-execution-store",
                error,
                Some(patch.dispatch_id.clone()),
            )
            .await;
        }
    };
    let next_occurrence = &next_execution.occurrences[&phase.to_string()];
    let response = if application.outcome.disposition == PlanDisposition::Blocked {
        terminal_response(
            phase,
            next_occurrence
                .terminal
                .as_ref()
                .expect("blocked patch installs a terminal outcome"),
        )
    } else {
        // The accepted dispatch basis becomes available atomically with this patch.
        // No prior execution scan can cover material which has not been accepted.
        refused(
            phase,
            "risk-pending",
            format!(
                "Task evidence accepted for phase-{phase}-execution, plan {}, dispatch {}; continuation refused: risk evidence is Missing. Record an exact execution risk-check and any required fire/consequence, then invoke execute-next again. No terminal completion was installed; tasks must not be rerun.",
                application.outcome.plan, patch.dispatch_id
            ),
        )
    };
    let answer = PreparedAnswer::new(response.into_envelope())?;
    let decision = BoundaryV1::new(
        scope(phase),
        BoundaryTool::CadenceApply,
        "executor".into(),
        request,
        Some(patch.dispatch_id.clone()),
        &answer,
    );
    let complete_phase = matches!(
        answer.envelope,
        Envelope::Ok(cadence::execution::boundary::Success::Complete { .. })
    );
    let (operation_id, change) = if answer.too_large() {
        (
            format!("execution-observation:{}", decision.identity()?),
            BoundaryChange::Observe,
        )
    } else {
        (
            format!("execution-patch:{}", patch.dispatch_id),
            BoundaryChange::Patch {
                patch,
                commit_paths,
                staged_paths: staged.paths,
                render_version: SUMMARY_RENDER_VERSION,
                complete_phase,
            },
        )
    };
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id,
            decision: decision.clone(),
            change: Box::new(change),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(None)
}

fn execution_risk<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    root: &Path,
    phase: u32,
) -> Result<Vec<cadence::rail::receipts::Requirement>, String> {
    let config = session.config().map_err(|e| e.to_string())?;
    super::rail_service::execution_requirements(view, root, phase, &config)
}

/// The exact phase-7 settlement a native plan's completion requires: the
/// plan's dispatch material, its confirmed dispatch boundary and the
/// configured surfaces, assessed against the retained risk history.
pub(super) fn native_settlement<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    root: &Path,
    phase: u32,
    plan: u32,
    dispatch_id: &str,
) -> Result<cadence::rail::receipts::Requirement, String> {
    use cadence::rail::{receipts, risk};
    let config = session.config().map_err(|e| e.to_string())?;
    let pending = format!("phase-{phase}-execution");
    let surfaces = crate::config::merge::get(&config.effective.values, "review.triggers.risk_surface.surfaces")
        .ok_or_else(|| format!("{pending}: missing risk surface selection"))
        .and_then(|v| risk::configured_surfaces(v).map_err(|e| format!("{pending}: {e}")))?
        .ok_or_else(|| format!("{pending}: risk surfaces are unanswered"))?;
    receipts::confirmed_history(view).map_err(|e| format!("{pending}: {e}"))?;
    let (Some(phase_id), Some(plan_id)) = (std::num::NonZeroU32::new(phase), std::num::NonZeroU32::new(plan)) else {
        return Err("settlement needs a positive phase and plan".into());
    };
    let scope = risk::Scope::Phase {
        project: root.parent().ok_or("planning root lacks project")?.to_string_lossy().into_owned(),
        planning_root: root.to_string_lossy().into_owned(), cycle: "live".into(), occurrence: pending.clone(),
        phase: phase_id, worker: Some(plan.to_string()), plan: Some(plan_id),
    };
    let source = risk::Source::Execution { plan: plan_id, dispatch_id: dispatch_id.to_owned() };
    let material = risk_material(view, root, phase, &pending, plan, dispatch_id)?;
    let wanted = receipts::Requirement {
        boundary: super::rail_service::receipt_boundary(view, scope, &source).map_err(|e| e.to_string())?, material, surfaces,
    };
    let status = receipts::assess(&wanted, &view.snapshot.data).map_err(|e| e.to_string())?;
    if !status.permits_continuation {
        return Err(format!("{pending}, plan {plan}, dispatch {dispatch_id}: risk evidence is {:?}; pending fires: {}. Record an exact execution risk-check and any required fire/consequence, then request completion again.",
            status.state, status.pending_fires.join(", ")));
    }
    Ok(wanted)
}

fn execution_snapshot(view: &View) -> Result<ExecutionSnapshot, String> {
    match view.snapshot.data.get("execution") {
        Some(value) => execution_value(value),
        None => Ok(ExecutionSnapshot::default()),
    }
}

fn execution_value(value: &Value) -> Result<ExecutionSnapshot, String> {
    let execution: ExecutionSnapshot = serde_json::from_value(value.clone())
        .map_err(|error| format!("invalid execution namespace: {error}"))?;
    if execution.schema != cadence::execution::model::EXECUTION_SCHEMA {
        return Err(format!("unsupported execution schema {}", execution.schema));
    }
    Ok(execution)
}

fn terminal_response(phase: u32, terminal: &TerminalOutcome) -> Response {
    match terminal {
        TerminalOutcome::Complete { phase } => Response::Complete { phase: *phase },
        TerminalOutcome::JudgmentStop {
            dispatch_id,
            blocker_ids,
        } => Response::JudgmentStop {
            phase,
            dispatch_id: dispatch_id.clone(),
            blocker_ids: blocker_ids.clone(),
        },
    }
}

fn dispatch_response(active: &ActiveDispatch, plan: &ExecutionPlan) -> Response {
    let mut dispatch = active.clone();
    dispatch.body = plan.body.clone();
    match retained_prompt(&dispatch) {
        Ok(prompt) => Response::Dispatch { dispatch: Box::new(dispatch), prompt },
        Err((code, reason)) => refused(dispatch.phase, code, reason),
    }
}

fn retained_prompt(dispatch: &ActiveDispatch) -> Result<String, (&'static str, String)> {
    if dispatch.prompt.is_empty() && dispatch.prompt_digest.is_empty() && dispatch.prompt_bytes.is_none() {
        return Ok(String::new());
    }
    if dispatch.prompt.is_empty() {
        return Err((
            "prompt-not-retained",
            "the admitted dispatch predates retained prompts and cannot be read back".into(),
        ));
    }
    if cadence::store::model::digest(dispatch.prompt.as_bytes()) != dispatch.prompt_digest {
        return Err((
            "prompt-integrity",
            "the retained prompt does not match its admitted digest".into(),
        ));
    }
    Ok(dispatch.prompt.clone())
}

fn issue_prompt(
    dispatch: &mut ActiveDispatch,
    current_issue_digest: &str,
    fresh: bool,
    render: impl FnOnce() -> String,
) -> Result<(String, bool), (&'static str, String)> {
    if !fresh && dispatch.issue_digest == current_issue_digest {
        return retained_prompt(dispatch).map(|prompt| (prompt, false));
    }
    let prompt = render();
    dispatch.prompt_digest = if prompt.is_empty() { String::new() } else { cadence::store::model::digest(prompt.as_bytes()) };
    dispatch.prompt = prompt.clone();
    dispatch.issue_digest = current_issue_digest.to_owned();
    Ok((prompt, !fresh))
}

#[cfg(test)]
mod issue_prompt_tests {
    use super::issue_prompt;
    use cadence::execution::model::ActiveDispatch;
    use serde_json::json;

    #[test]
    fn unchanged_dispatch_state_returns_retained_bytes_without_rendering() {
        let mut dispatch: ActiveDispatch = serde_json::from_value(json!({
            "schema":1,"id":"d","expected_execution_version":1,"phase":1,"plan":1,
            "plan_fingerprint":"f","plan_set_fingerprint":"s","requirements":[],"tasks":[],
            "suite":"suite","files":[],"policy":{"rung":"fixed","branch":"current","reviews":"disabled"},
            "base_sha":"base","prompt":"retained bytes","prompt_digest":cadence::store::model::digest(b"retained bytes"),
            "issue_digest":"state","body":""
        })).unwrap();
        let (prompt, reissued) = issue_prompt(&mut dispatch, "state", false, || {
            panic!("an unchanged issue must not invoke the renderer")
        }).unwrap();
        assert_eq!(prompt.as_bytes(), b"retained bytes");
        assert!(!reissued);
    }
}

fn render_prompt(dispatch: &ActiveDispatch) -> String {
    cadence::execution::render::render_dispatch_prompt(
        dispatch,
        &patch_schema(),
        true,
    )
}

pub use cadence::execution::model::patch_schema;

async fn observe_plans(
    root: &Path,
    phase: u32,
    names: &[String],
) -> Result<Plans, (&'static str, String)> {
    let root = root.to_path_buf();
    let names = names.to_vec();
    tokio::task::spawn_blocking(move || {
        if names.is_empty() {
            return Err(("empty-plan-set", "the phase admits no native plans".into()));
        }
        let phase_root = root.join(format!("phases/{phase}"));
        let mut listed = std::fs::read_dir(&phase_root)
            .map_err(|error| ("plan-read", format!("{}: {error}", phase_root.display())))?
            .map(|entry| {
                entry
                    .map(|entry| entry.file_name().to_string_lossy().into_owned())
                    .map_err(|error| ("plan-read", error.to_string()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        listed.retain(|name| admitted_plan_name(name));
        listed.sort();
        let mut expected = names.clone();
        expected.sort();
        if listed != expected {
            return Err((
                "plan-set-changed",
                "the real phase-directory plan names differ from checked derivation".into(),
            ));
        }
        let mut values = Vec::with_capacity(names.len());
        let mut numbers = BTreeSet::new();
        for name in names {
            let Some(number) = plan_number(&name) else {
                return Err((
                    "invalid-plan-name",
                    format!("native plan name is not PLAN-N.md: {name}"),
                ));
            };
            if !numbers.insert(number) {
                return Err((
                    "duplicate-plan",
                    format!("plan number {number} is duplicated"),
                ));
            }
            let path = root.join(format!("phases/{phase}/{name}"));
            let bytes = std::fs::read(&path)
                .map_err(|error| ("plan-read", format!("{}: {error}", path.display())))?;
            values.push(
                parse_plan(&bytes, phase, number).map_err(|error| (error.code, error.detail))?,
            );
        }
        values.sort_by_key(|plan| plan.plan);
        let fingerprint =
            plan_set_fingerprint(&values).map_err(|error| (error.code, error.detail))?;
        Ok(Plans {
            values,
            fingerprint,
        })
    })
    .await
    .map_err(|_| ("plan-read", "plan observation task closed".into()))?
}

fn plan_number(name: &str) -> Option<u32> {
    let number = name.strip_prefix("PLAN-")?.strip_suffix(".md")?;
    if number.is_empty()
        || number.starts_with('0')
        || !number.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    number.parse().ok().filter(|number| *number > 0)
}

fn admitted_plan_name(name: &str) -> bool {
    name == "PLAN.md"
        || name
            .strip_prefix("PLAN-")
            .and_then(|number| number.strip_suffix(".md"))
            .is_some_and(|number| {
                !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit())
            })
}

async fn reobserve<I: ConfigIo>(
    session: &Session<I>,
    expected: &View,
    root: &Path,
    phase: u32,
    names: &[String],
    plans: &Plans,
    expected_head: Option<&str>,
) -> Result<(), String> {
    let latest_plans = observe_plans(root, phase, names)
        .await
        .map_err(|(code, reason)| format!("{code}: {reason}"))?;
    if latest_plans.values != plans.values {
        return Err("native plan bytes changed during the request".into());
    }
    if let Some(expected_head) = expected_head {
        let project = root
            .parent()
            .ok_or_else(|| "planning root has no parent".to_owned())?;
        if git_head(project).await? != expected_head {
            return Err("Git HEAD changed during the request".into());
        }
    }
    let latest = session
        .derivation_view()
        .await
        .map_err(|error| error.to_string())?;
    execution_ready(root,&latest.snapshot.data, phase)
        .map_err(|error| error.to_string())?;
    if latest.snapshot.generation != expected.snapshot.generation
        || latest.snapshot.integrity != expected.snapshot.integrity
    {
        return Err("effective store generation changed during the request".into());
    }
    Ok(())
}

async fn git_head(project: &Path) -> Result<String, String> {
    let project = project.to_path_buf();
    tokio::task::spawn_blocking(move || {
        head_sha(&git_output(
            &project,
            &["rev-parse", "--verify", "HEAD"],
            &mut cadence::process::System,
        )?)
    })
    .await
    .map_err(|_| "Git observation task closed".to_owned())?
}

/// The commit `git rev-parse --verify HEAD` printed, when it is a full
/// 40-digit hexadecimal SHA.
fn head_sha(output: &str) -> Result<String, String> {
    let sha = output.trim();
    if sha.len() != 40 || !sha.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Git HEAD is not a full commit SHA".into());
    }
    Ok(sha.to_owned())
}

async fn validate_commits(
    project: &Path,
    active: &ActiveDispatch,
    patch: &ExecutorPatch,
    head: &str,
) -> Result<BTreeMap<String, Vec<String>>, (&'static str, String)> {
    let project = project.to_path_buf();
    let active = active.clone();
    let patch = patch.clone();
    let head = head.to_owned();
    tokio::task::spawn_blocking(move || {
        validate_commits_blocking(
            &project,
            &active,
            &patch,
            &head,
            &mut cadence::process::System,
        )
    })
        .await
        .map_err(|_| ("git-validation", "Git validation task closed".into()))?
}

fn validate_commits_blocking(
    project: &Path,
    active: &ActiveDispatch,
    patch: &ExecutorPatch,
    head: &str,
    process: &mut (dyn Process + Send),
) -> Result<BTreeMap<String, Vec<String>>, (&'static str, String)> {
    judge_commits(&active.base_sha, &observe_commits(project, active, patch, head, process))
}

/// What Git reports about one completed task's commit, each answer as it
/// came back.
#[derive(Clone, Debug)]
pub(crate) struct CommitFacts {
    pub(crate) task_id: String,
    pub(crate) commit: String,
    pub(crate) exists: Result<(), String>,
    /// Whether the commit before it in task order, the dispatch base for the
    /// first, is an ancestor of it.
    pub(crate) follows_prior: Result<bool, String>,
    /// Whether the commit is an ancestor of the current HEAD.
    pub(crate) under_head: Result<bool, String>,
    pub(crate) signature: Result<(), String>,
    pub(crate) subject: Result<String, String>,
    pub(crate) paths: Result<Vec<String>, String>,
}

/// Ask Git about every completed task's commit, in task order. Nothing is
/// judged here, and every answer is kept, failures included.
fn observe_commits(
    project: &Path,
    active: &ActiveDispatch,
    patch: &ExecutorPatch,
    head: &str,
    process: &mut (dyn Process + Send),
) -> Vec<CommitFacts> {
    let mut prior = active.base_sha.clone();
    let mut facts = Vec::new();
    for task in &patch.tasks {
        let cadence::execution::model::TaskOutcome::Completed { task_id, commit, .. } = task else {
            continue;
        };
        facts.push(CommitFacts {
            task_id: task_id.clone(),
            commit: commit.clone(),
            exists: git_success(project, &["cat-file", "-e", &format!("{commit}^{{commit}}")], process),
            follows_prior: git_status(project, &["merge-base", "--is-ancestor", &prior, commit], process),
            under_head: git_status(project, &["merge-base", "--is-ancestor", commit, head], process),
            signature: git_success(project, &["verify-commit", commit], process),
            subject: git_output(project, &["show", "-s", "--format=%s", commit], process),
            paths: observe_commit_paths(project, commit, process),
        });
        prior = commit.clone();
    }
    facts
}

/// Every path a commit changes against each of its parents. A combined merge
/// diff omits paths changed against only one parent and is insufficient
/// lease evidence, so every parent is compared explicitly.
fn observe_commit_paths(project: &Path, commit: &str, process: &mut (dyn Process + Send)) -> Result<Vec<String>, String> {
    let parents = git_output(project, &["show", "-s", "--format=%P", commit], process)?;
    let parents = parents.split_whitespace().collect::<Vec<_>>();
    let mut observed = BTreeSet::new();
    for parent in parents.iter().copied().map(Some).chain(parents.is_empty().then_some(None)) {
        let mut args = vec![
            "diff-tree",
            "--root",
            "--no-commit-id",
            "--name-status",
            "-r",
            "-z",
            "-M",
            "--no-ext-diff",
            "--no-textconv",
        ];
        if let Some(parent) = parent {
            args.push(parent);
        }
        args.extend([commit, "--"]);
        observed.extend(read_name_status(&git_output_bytes(project, &args, process)?)?);
    }
    Ok(observed.into_iter().collect())
}

/// Whether the completed tasks' commits hold up, in task order, and each
/// one's changed paths. The first failure is the answer: a commit completing
/// two tasks, one Git cannot read, one not strictly after the commit before it
/// or not under HEAD, an unsigned one, or one whose subject is not
/// conventional or does not name its task.
pub(crate) fn judge_commits(
    base: &str,
    commits: &[CommitFacts],
) -> Result<BTreeMap<String, Vec<String>>, (&'static str, String)> {
    let mut prior = base;
    let mut seen = BTreeSet::new();
    let mut paths = BTreeMap::new();
    for facts in commits {
        let commit = &facts.commit;
        if !seen.insert(commit) {
            return Err(("reused-commit", "one commit cannot complete two tasks".into()));
        }
        facts.exists.clone().map_err(|reason| ("missing-commit", reason))?;
        if commit == prior || !facts.follows_prior.clone().map_err(|reason| ("git-order", reason))? {
            return Err(("git-order", format!("commit {commit} is not strictly after {prior}")));
        }
        if !facts.under_head.clone().map_err(|reason| ("git-order", reason))? {
            return Err(("git-order", format!("commit {commit} is not an ancestor of current HEAD")));
        }
        facts.signature.clone().map_err(|reason| ("bad-signature", reason))?;
        let subject = facts.subject.clone().map_err(|reason| ("commit-subject", reason))?;
        if !conventional_subject(subject.trim(), &facts.task_id) {
            return Err((
                "commit-subject",
                format!("commit {commit} subject is not conventional or does not name {}", facts.task_id),
            ));
        }
        paths.insert(commit.clone(), facts.paths.clone().map_err(|reason| ("commit-paths", reason))?);
        prior = commit;
    }
    Ok(paths)
}

/// Read Git's unquoted NUL records without normalizing or losing pathname bytes.
pub(super) fn read_name_status(bytes: &[u8]) -> Result<Vec<String>, String> {
    cadence::execution::receipts::read_name_status(bytes)
}

#[derive(Debug, PartialEq, Eq)]
struct StagedObservation {
    paths: Vec<String>,
    objects: Vec<u8>,
}

async fn observe_staged(project: &Path) -> Result<StagedObservation, String> {
    let project = project.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let objects = || {
            git_output_bytes(
                &project,
                &[
                    "diff",
                    "--cached",
                    "--raw",
                    "-z",
                    "-M",
                    "--no-abbrev",
                    "--no-ext-diff",
                    "--no-textconv",
                    "--",
                ],
                &mut cadence::process::System,
            )
        };
        let before = objects()?;
        let bytes = git_output_bytes(
            &project,
            &[
                "diff",
                "--cached",
                "--name-status",
                "-z",
                "-M",
                "--no-ext-diff",
                "--no-textconv",
                "--",
            ],
            &mut cadence::process::System,
        )?;
        let paths = read_name_status(&bytes)?;
        if objects()? != before {
            return Err("staged inputs changed during observation".into());
        }
        Ok(StagedObservation {
            paths,
            objects: before,
        })
    })
    .await
    .map_err(|_| "staged observation task closed".to_owned())?
}

async fn reobserve_staged(project: &Path, expected: &StagedObservation) -> Result<(), String> {
    if &observe_staged(project).await? != expected {
        return Err("staged inputs changed during the request".into());
    }
    Ok(())
}

fn conventional_subject(subject: &str, task_id: &str) -> bool {
    cadence::execution::receipts::conventional_subject(subject, task_id)
}

fn git_output(project: &Path, args: &[&str], process: &mut (dyn Process + Send)) -> Result<String, String> {
    String::from_utf8(git_output_bytes(project, args, process)?)
        .map_err(|_| "Git output is not valid UTF-8".into())
}

fn git_output_bytes(
    project: &Path,
    args: &[&str],
    process: &mut dyn Process,
) -> Result<Vec<u8>, String> {
    let output = cadence::git_process::run(
        &cadence::git_process::launch(cadence::git_process::Caller::ExecutionOutput).arg("-C").arg(project).args(args), process)
        .map_err(|error| format!("cannot run git: {error}"))?;
    if output.success() {
        Ok(output.stdout)
    } else {
        Err(format!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn git_success(project: &Path, args: &[&str], process: &mut (dyn Process + Send)) -> Result<(), String> {
    git_output_bytes(project, args, process).map(|_| ())
}

/// This one inherits the server's own stdin, stdout and stderr, as it always
/// has; nothing here reads the child's output.
fn git_status(project: &Path, args: &[&str], process: &mut dyn Process) -> Result<bool, String> {
    let output = cadence::git_process::run(
        &cadence::git_process::launch(cadence::git_process::Caller::ExecutionStatus).arg("-C").arg(project).args(args).inherit(), process)
        .map_err(|error| format!("cannot run git: {error}"))?;
    match output.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(format!("git {} failed with {}", args.join(" "), output.status)),
    }
}

fn scope(phase: u32) -> BoundaryScope {
    if phase == 0 {
        BoundaryScope::RootRefusal
    } else {
        BoundaryScope::Execution { phase }
    }
}

fn boundary(
    phase: u32,
    tool: BoundaryTool,
    _operation: &str,
    request: &str,
    response: &Response,
    subject_id: Option<String>,
    _prompt_digest: Option<String>,
) -> Result<BoundaryV1, Failure> {
    let answer = PreparedAnswer::new(response.clone().into_envelope())?;
    Ok(BoundaryV1::new(
        scope(phase),
        tool,
        tool_operation(tool).into(),
        request.into(),
        subject_id,
        &answer,
    ))
}

async fn record_lease_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    request: &str,
    paths: cadence::execution::patch::UndeclaredPaths,
) -> Answer {
    let decision = BoundaryV1::lease_refusal(request.into(), paths)?;
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-observation:{}", decision.identity()?),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Observe),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(None)
}

#[allow(clippy::too_many_arguments)]
async fn record_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    phase: u32,
    tool: BoundaryTool,
    operation: &str,
    request: &str,
    code: impl Into<String>,
    reason: impl Into<String>,
    subject_id: Option<String>,
) -> Answer {
    let code = code.into();
    // Every refusal names at least the rule that refused and the operation it
    // refused in; a caller with a document line or an input path to name uses
    // record_located_refusal instead.
    let located = Located::rule(code.clone(), operation).id(subject_id.clone().unwrap_or_default());
    record_located_refusal(
        session, view, phase, tool, operation, request, code, reason, subject_id, Some(located),
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn record_located_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    phase: u32,
    tool: BoundaryTool,
    operation: &str,
    request: &str,
    code: impl Into<String>,
    reason: impl Into<String>,
    subject_id: Option<String>,
    located: Option<Located>,
) -> Answer {
    let code = code.into();
    let response = Response::Refused {
        phase,
        reason: stable_reason(&code, &reason.into()),
        code,
    };
    record_observation(
        session, view, phase, tool, operation, request, response, subject_id, located,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn record_observation<I: ConfigIo>(
    session: &Arc<Session<I>>,
    view: &View,
    phase: u32,
    tool: BoundaryTool,
    operation: &str,
    request: &str,
    response: Response,
    subject_id: Option<String>,
    located: Option<Located>,
) -> Answer {
    let decision =
        boundary(phase, tool, operation, request, &response, subject_id, None)?.with_located(located);
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: format!("execution-observation:{}", decision.identity()?),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Observe),
        })
        .await
        .map_err(store_failure)?;
    confirmed_boundary(&written, &decision)?.envelope(Some(response.into_envelope()))
}

fn refused(phase: u32, code: impl Into<String>, reason: impl Into<String>) -> Response {
    Response::Refused {
        phase,
        code: code.into(),
        reason: reason.into(),
    }
}

fn store_failure(error: Error) -> Failure {
    if error == Error::Closed {
        Failure::Closed
    } else if error == Error::Conflict("routing inputs changed before admission".into()) {
        Failure::RoutingInputsChanged
    } else {
        Failure::Store
    }
}

fn store_refusal(_phase: u32, error: Error) -> Answer {
    Err(store_failure(error))
}

#[derive(Clone, Copy, Debug)]
pub enum ValidationFailure {
    MissingArguments,
    MissingField,
    ExtraField,
    WrongType,
    UnknownTag,
    InvalidPatch,
}

impl ValidationFailure {
    fn code(self) -> &'static str {
        match self {
            Self::MissingArguments => "missing-arguments",
            Self::MissingField => "missing-field",
            Self::ExtraField => "extra-field",
            Self::WrongType => "wrong-type",
            Self::UnknownTag => "unknown-tag",
            Self::InvalidPatch => "invalid-patch",
        }
    }
}

fn tool_operation(tool: BoundaryTool) -> &'static str {
    match tool {
        BoundaryTool::CadenceQuery => "execute-next",
        BoundaryTool::CadenceApply => "executor",
    }
}

fn public_request_digest(tool: BoundaryTool, raw: Option<&Value>) -> String {
    // Option encodes absence as null, distinct from an empty arguments object.
    digest(
        &serde_json::to_vec(&("execution-request-v1", tool, tool_operation(tool), raw))
            .expect("JSON request identity serializes"),
    )
}

/// Whether the derived lifecycle lets `phase` execute: a live cycle, a phase it
/// knows, the current one, and planned or executed. Answers the phase's record,
/// or the refusal's code and reason.
pub(crate) fn executable_phase(
    lifecycle: &cadence::derivation::Lifecycle,
    phase: u32,
) -> Result<cadence::derivation::PhaseRecord, (&'static str, String)> {
    if lifecycle.cycle != Cycle::Live {
        return Err(("closed-cycle", "execution requires the live planning cycle".into()));
    }
    let Some(record) = lifecycle.phases.iter().find(|record| record.id.number() == f64::from(phase)) else {
        return Err(("unknown-phase", "the lifecycle does not contain the requested phase".into()));
    };
    if lifecycle.current.is_none_or(|current| current.number() != f64::from(phase)) {
        return Err(("phase-not-current", "the requested phase is not the derived current phase".into()));
    }
    if !matches!(record.status, LifecycleStatus::Planned | LifecycleStatus::Executed) {
        return Err(("lifecycle-refusal", format!("phase status {:?} cannot execute", record.status)));
    }
    Ok(record.clone())
}

/// The plan a retained active dispatch is re-issued from: still admitted, and
/// with the bytes the dispatch was admitted on.
pub(crate) fn active_plan<'a>(
    active: &ActiveDispatch,
    plans: &'a [ExecutionPlan],
) -> Result<&'a ExecutionPlan, (&'static str, String)> {
    let Some(plan) = plans.iter().find(|plan| plan.plan == active.plan) else {
        return Err(("active-plan-missing", "the active dispatch plan is no longer admitted".into()));
    };
    if active.plan_fingerprint != plan.fingerprint {
        return Err(("plan-changed", "the active plan bytes differ from the admitted fingerprint".into()));
    }
    Ok(plan)
}

/// Whether a continuation decision lets new work be dispatched: an accepted
/// continuation, or an approved plan suite repair.
pub(crate) fn may_continue(decision: &ContinuationDecision) -> bool {
    matches!(decision, ContinuationDecision::Continue { .. } | ContinuationDecision::RepairSuite { approved: true, .. })
}

/// A continuation refusal names the answer that is missing and the call that
/// supplies it. Without this the caller learns only that something is pending
/// and has to read `next_action::continuation` to find out what.
fn continuation_next_call(decision: &ContinuationDecision) -> String {
    use ContinuationDecision as D;
    use cadence::evidence::gates::Purpose;
    match decision {
        D::AwaitAcceptance => "no owner answer is on record for this phase: submit cadence_apply execution-authorize with the phase, a fresh request_id, the owner, the time and the owner's actual response, naming no checkpoint".into(),
        D::Stop(answer) => format!(
            "the Stop answered on question {} is still in force: continue or decline it with cadence_apply execution-authorize carrying the owner's actual response and naming the same checkpoint that Stop named",
            answer.question_id
        ),
        D::NeedQuestion(gate) => format!(
            "task checkpoint {} has no question on record: answer it with cadence_apply execution-task-answer",
            gate.checkpoint_id.as_deref().unwrap_or(&gate.id)
        ),
        D::Wait(gate) if gate.purpose == Purpose::Progress => format!(
            "question {} is unanswered: submit cadence_apply execution-authorize with the owner's actual response",
            gate.id
        ),
        D::Wait(gate) => format!(
            "question {} is unanswered: record the owner's actual answer to it before retrying",
            gate.id
        ),
        D::RepairSuite { question_id, approved: false } => format!(
            "plan suite repair question {question_id} is unanswered: submit cadence_apply execution-suite-repair-answer with the owner's actual answer, attribution and time"
        ),
        D::RepairSuite { approved: true, .. } => "the approved plan suite repair is ready to dispatch".into(),
        D::Ended(_) => "this execution occurrence has ended; no further dispatch is issued for it".into(),
        D::Revise => "the controlling check failed and its revision is unspent: publish the revised plan before retrying".into(),
        D::FreshCheck => "the controlling check is missing or stale: a current check is required before execution continues".into(),
        D::OverrideRequired => "continuation needs an active override that is not on record".into(),
        D::Continue { .. } => "continuation authority is current".into(),
    }
}

/// D-140: the envelope keeps each code's own detail. A sentence that fits every
/// code cannot be joined to anything, and cad-suggest and cad-why read these.
/// Only a refusal that arrived with nothing to say falls back, and then it says
/// which code refused and no more.
fn stable_reason(code: &str, detail: &str) -> String {
    if detail.trim().is_empty() {
        return format!("execution refused ({code})");
    }
    detail.to_owned()
}

async fn begin<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    selected: &Path,
) -> Result<(std::path::PathBuf, Arc<Session<I>>, View), Failure> {
    let root = crate::config::reload::identity(selected).map_err(store_failure)?;
    let session = factory.first_touch(&root).await.map_err(store_failure)?;
    let view = session.derivation_view().await.map_err(store_failure)?;
    require_current_execution(&view)?;
    Ok((root, session, view))
}

/// The phase whose scope records a malformed request: an apply naming a
/// dispatch the store knows goes under that dispatch's phase, and anything
/// else under the root refusal scope, phase 0.
pub(crate) fn refusal_phase(view: &View, tool: BoundaryTool, raw: Option<&Value>) -> Result<u32, Failure> {
    if tool != BoundaryTool::CadenceApply {
        return Ok(0);
    }
    match raw.and_then(|value| value.get("dispatch_id")).and_then(Value::as_str) {
        Some(id) => Ok(dispatch_phase(view, id)?.unwrap_or(0)),
        None => Ok(0),
    }
}

/// The phase whose occurrence holds dispatch `id`, active or received. A
/// dispatch held by two occurrences means the store is unsound.
pub(crate) fn dispatch_phase(view: &View, id: &str) -> Result<Option<u32>, Failure> {
    let execution = execution_snapshot(view).map_err(|_| Failure::Store)?;
    let matches = execution
        .occurrences
        .values()
        .filter(|occurrence| {
            occurrence
                .active
                .as_ref()
                .is_some_and(|active| active.id == id)
                || occurrence.receipts.contains_key(id)
        })
        .map(|occurrence| occurrence.phase)
        .collect::<Vec<_>>();
    match matches.as_slice() {
        [] => Ok(None),
        [phase] if *phase > 0 => Ok(Some(*phase)),
        _ => Err(Failure::Store),
    }
}

async fn terminal_answer<I: ConfigIo>(
    session: &Session<I>,
    view: &View,
    scope: &BoundaryScope,
) -> Result<Option<ExecutionEnvelope>, Failure> {
    let Some(terminal) = terminal_v1(view, scope) else {
        return Ok(None);
    };
    let decision = terminal.value.boundary.clone();
    let written = session
        .request(Operation::BoundaryV1 {
            expected_generation: view.snapshot.generation,
            expected_integrity: view.snapshot.integrity.clone(),
            operation_id: terminal.id.into(),
            decision: decision.clone(),
            change: Box::new(BoundaryChange::Observe),
        })
        .await
        .map_err(store_failure)?;
    Ok(Some(
        confirmed_boundary(&written, &decision)?.envelope(None)?,
    ))
}

pub async fn refuse_arguments<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    tool: BoundaryTool,
    raw: Option<Value>,
    failure: ValidationFailure,
) -> Answer {
    let (_, session, view) = begin(factory, root).await?;
    let phase = refusal_phase(&view, tool, raw.as_ref())?;
    if let Some(answer) = terminal_answer(&session, &view, &scope(phase)).await? {
        return Ok(answer);
    }
    record_refusal(
        &session,
        &view,
        phase,
        tool,
        tool_operation(tool),
        &public_request_digest(tool, raw.as_ref()),
        failure.code(),
        cadence::execution::boundary::argument_detail(raw.as_ref()),
        None,
    )
    .await
}

async fn derivation_refusal<I: ConfigIo>(
    session: &Arc<Session<I>>,
    phase: u32,
    tool: BoundaryTool,
    request: &str,
    error: cadence::derivation::DerivationError,
) -> Answer {
    if matches!(error, cadence::derivation::DerivationError::Store { .. }) {
        return Err(Failure::Store);
    }
    let view = session.derivation_view().await.map_err(store_failure)?;
    let code = error.code();
    // Each variant's own fields, both as the reason a person reads and as the
    // typed object a later query joins to the line it names (D-140).
    let (detail, located) = match &error {
        cadence::derivation::DerivationError::StateConflict { source, field, declared, derived, entry } => (
            json!({"source":source,"field":field,"declared":declared,"derived":derived}).to_string(),
            match entry {
                Some(entry) => Located::conflict(&entry.source, entry.line, entry.entry,
                    &entry.phase, field, declared, &entry.status),
                None => Located::rule(code, field).id(source),
            },
        ),
        cadence::derivation::DerivationError::MissingPlanningRoot { path } => (
            format!("{code}: {} is absent", planning_path(path)),
            Located::input(code, "planning-root", planning_path(path)),
        ),
        cadence::derivation::DerivationError::MissingRoadmap { path } => (
            format!("{code}: {} is absent", planning_path(path)),
            Located::input(code, "roadmap", planning_path(path)),
        ),
        cadence::derivation::DerivationError::InputFailure(failure) => (
            format!("{code}: {} is unreadable ({:?})", planning_path(&failure.path), failure.category),
            Located::input(code, "input", planning_path(&failure.path)),
        ),
        cadence::derivation::DerivationError::InvalidRoadmap { detail } => (
            format!("{code}: {detail}"),
            Located::rule(code, "roadmap"),
        ),
        cadence::derivation::DerivationError::InvalidIntake { source, detail } => (
            format!("{code}: {detail}"),
            Located::rule(code, "intake").id(source),
        ),
        cadence::derivation::DerivationError::InvalidStatus { source, original_status } => (
            format!("{code}: {source} carries the unusable status {original_status}"),
            Located::rule(code, "status").id(source),
        ),
        cadence::derivation::DerivationError::DerivationConflict { requested_hash, stored_hash, fields } => (
            format!("{code}: the memo for {requested_hash} (stored {}) disagrees at {}",
                stored_hash.as_deref().unwrap_or("none"), fields.join(", ")),
            Located::rule(code, "memo").id(requested_hash),
        ),
        _ => (
            format!("{code}: the controlling lifecycle inputs changed while the answer was prepared"),
            Located::rule(code, "inputs"),
        ),
    };
    record_located_refusal(
        session,
        &view,
        phase,
        tool,
        tool_operation(tool),
        request,
        code,
        detail,
        None,
        Some(located),
    )
    .await
}

/// A planning input said the way the owner reads it, rooted at the directory
/// the project keeps its planning in rather than at whatever absolute path the
/// server happened to open.
fn planning_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    match text.rfind(".planning") {
        Some(start) => text[start..].to_owned(),
        None => text.into_owned(),
    }
}

// Execution observes lifecycle authority without publishing a memo on a later refusal.
async fn checked_execution<I: ConfigIo + Clone + Sync>(
    session: &Session<I>,
    root: &Path,
    driver: &Driver,
) -> Result<(cadence::derivation::RecheckedLifecycle, View), cadence::derivation::DerivationError> {
    use cadence::derivation::*;
    struct Intake(IntakeObservation);
    impl IntakeIo for Intake {
        fn observe_intake(&mut self) -> Result<IntakeObservation, DerivationError> {
            Ok(self.0.clone())
        }
    }
    let root = root.to_path_buf();
    let driver = driver.clone();
    let view = session
        .derivation_view()
        .await
        .map_err(derivation_service::store_error)?;
    let data = view.snapshot.data.clone();
    let checked = tokio::task::spawn_blocking(move || {
        let mut io = (driver.artifacts)();
        let prepared = prepare_query(&root, io.as_mut())?;
        #[cfg(test)]
        (driver.event)(derivation_service::Event::Derived);
        // The same native authority the owned view holds, or nothing.
        if acceptance_overlay(&data)? != *prepared.overlay() {
            return Err(DerivationError::InputsChanged);
        }
        let key = prepared.input_key()?;
        let raw = memo_from_data(&data, &key)?;
        let selected = select_intake(&data)?;
        let prepared = prepared.with_intake(&selected)?;
        #[cfg(test)]
        (driver.compare)(raw, &key, prepared.answer())?;
        #[cfg(not(test))]
        check_memo(raw, &key, prepared.answer())?;
        recheck_query_with_intake(&prepared, io.as_mut(), &mut Intake(selected.observation))
    })
    .await
    .map_err(|_| derivation_service::store_error(Error::Closed))??;
    let latest = session
        .derivation_view()
        .await
        .map_err(derivation_service::store_error)?;
    if latest.snapshot != view.snapshot {
        return Err(DerivationError::InputsChanged);
    }
    Ok((checked, latest))
}

async fn checked_continuation<I: ConfigIo + Clone + Sync>(
    session: &Session<I>,
    view: &View,
    checked: &cadence::derivation::RecheckedLifecycle,
    phase: u32,
    driver: &Driver,
) -> Result<cadence::next_action::continuation::Continuation, cadence::derivation::DerivationError>
{
    use cadence::{
        derivation::*,
        evidence::{authority, material, persistence},
        next_action::continuation,
    };
    let fail = derivation_service::store_error;
    let scope = continuation_scope(&checked.capture().root, phase);
    scope.validate().map_err(fail)?;
    let config = session.config().map_err(fail)?;
    let mut current = persistence::read(&view.snapshot.data).map_err(fail)?;
    let mut records = Vec::new();
    for decision in view.decisions.iter().rev() {
        if let Some(historical) = persistence::decode_history(decision).map_err(fail)?
            && let Some(record) = current.remove(&historical.key().map_err(fail)?)
        {
            records.push(record);
        }
    }
    if !current.is_empty() {
        return Err(fail(Error::Invalid(
            "native continuation records lack history".into(),
        )));
    }
    records.reverse();
    let checker = continuation::latest_checker(&records, &scope);
    let materials = checker
        .map(|c| material::basis(&records, &scope, &c.id))
        .transpose()
        .map_err(fail)?
        .unwrap_or_default();
    let capture = checked.capture().clone();
    let driver = driver.clone();
    let observed_materials = materials.clone();
    let observed = tokio::task::spawn_blocking(move || {
        let observe = || {
            super::evidence_service::observe_material(
                &capture.root,
                &observed_materials,
                &mut |path| match ArtifactFiles.read(path) {
                    Observation::Present(bytes) => Ok(bytes),
                    Observation::Absent => Err(std::io::ErrorKind::NotFound.into()),
                    Observation::Failed(_) => {
                        Err(std::io::Error::other("checked material is unreadable"))
                    }
                },
            )
        };
        let observed = observe();
        #[cfg(test)]
        (driver.event)(derivation_service::Event::RoutingObserved);
        if capture_inputs(&capture.root, (driver.artifacts)().as_mut())? != capture
            || observe() != observed
        {
            return Err(DerivationError::InputsChanged);
        }
        Ok(observed)
    })
    .await
    .map_err(|_| fail(Error::Closed))??;
    let applicability = checker
        .map(|c| authority::checker_applicability(&records, &scope, &c.id, &observed))
        .transpose()
        .map_err(fail)?;
    let plans = checked
        .answer()
        .phases
        .iter()
        .find(|p| p.id.number() == f64::from(phase))
        .map(|p| p.plans.as_slice())
        .unwrap_or_default();
    let mut selected = continuation::select(&records, &scope, applicability, plans);
    if let Some(active) = view.snapshot.data["execution"]["occurrences"][phase.to_string()]["active"].as_object()
        && let Some(plan) = active.get("plan").and_then(Value::as_u64).and_then(|plan| u32::try_from(plan).ok()) {
        let plan_events = cadence::execution::history::plan_records(&view.snapshot.data, phase).map_err(fail)?;
        let admitted = cadence::execution::history::admitted_plans(&view.snapshot.data, phase).map_err(fail)?;
        if let Some((identity, _)) = admitted.iter().find(|(identity, _)| identity.plan == plan)
            && let Some(decision) = continuation::plan_repair_decision(
                &cadence::execution::history::plan_project(&plan_events, identity)) {
            selected.checkpoint = None;
            selected.decision = decision;
        }
    }
    if session.derivation_view().await.map_err(fail)?.snapshot != view.snapshot
        || session.config().map_err(fail)? != config
    {
        return Err(DerivationError::InputsChanged);
    }
    Ok(selected)
}

/// An explicit assessment consumes accepted execution evidence, never report prose
/// or a fresh HEAD. The base was retained atomically before completion cleared active.
/// The last commit of the plan's confirmed suite repair, when it has one.
fn confirmed_repair_head(view: &View, phase: u32, plan: u32) -> Result<Option<String>, String> {
    let plan_records = cadence::execution::history::plan_records(&view.snapshot.data, phase).map_err(|error| error.to_string())?;
    let Some((identity, _)) = cadence::execution::history::admitted_plans(&view.snapshot.data, phase).map_err(|error| error.to_string())?
        .into_iter().find(|(identity, _)| identity.plan == plan) else { return Ok(None) };
    let projection = cadence::execution::history::plan_project(&plan_records, &identity);
    let Some(repair) = projection.repair.as_ref() else { return Ok(None) };
    let confirmed = plan_records.iter().any(|record| record.request.plan == identity
        && matches!(&record.request.event, cadence::execution::history::PlanEvent::SuiteRepair(_))
        && cadence::execution::history::plan_decision(record).is_ok_and(|decision| cadence::store::model::retained(&view.decisions, &decision)));
    if !confirmed {
        return Err("native risk source lacks a confirmed suite repair receipt".into());
    }
    Ok(repair.commits.last().cloned())
}

pub fn risk_material(
    view: &View,
    root: &Path,
    phase: u32,
    occurrence_id: &str,
    plan: u32,
    dispatch_id: &str,
) -> Result<cadence::rail::risk::MaterialIdentity, String> {
    use cadence::rail::risk;
    require_current_execution(view).map_err(|error| error.to_string())?;
    if occurrence_id != continuation_scope(root, phase).occurrence {
        return Err("risk source names a foreign execution occurrence".into());
    }
    let native = risk::native_execution_bases(&view.snapshot.data).map_err(|e| e.to_string())?;
    if let Some(basis) = native.iter().rev().find(|b| b.execution.dispatch_id == dispatch_id) {
        let records = cadence::execution::history::records(&view.snapshot.data, phase).map_err(|e| e.to_string())?;
        let confirmed = records.iter().any(|record| record.request.task == basis.task
            && record.request_digest == basis.execution.transition_id
            && cadence::execution::history::decision(record).is_ok_and(|decision| cadence::store::model::retained(&view.decisions, &decision)));
        if basis.task.phase != phase || basis.task.plan != plan || !confirmed {
            return Err("native risk source lacks a confirmed task receipt".into());
        }
        // A plan that used its one repair (D-163) ends at the repair commit,
        // not at the last task's completion; completion demands that head.
        let material = match confirmed_repair_head(view, phase, plan)? {
            Some(head_id) => cadence::rail::risk::MaterialIdentity::Committed { base_id: basis.execution.base_id.clone(), head_id },
            None => basis.material(),
        };
        return Ok(material);
    }
    let execution = execution_snapshot(view)?;
    let active = execution.occurrences.get(&phase.to_string()).and_then(|occurrence| occurrence.active.as_ref());
    let plan_bases = native.iter().filter(|basis| basis.task.phase == phase && basis.task.plan == plan).collect::<Vec<_>>();
    if active.is_some_and(|active| active.id == dispatch_id && active.plan == plan) && !plan_bases.is_empty() {
        let task_records = cadence::execution::history::records(&view.snapshot.data, phase).map_err(|error| error.to_string())?;
        if plan_bases.iter().any(|basis| !task_records.iter().any(|record| record.request.task == basis.task
            && record.request_digest == basis.execution.transition_id
            && cadence::execution::history::decision(record).is_ok_and(|decision| cadence::store::model::retained(&view.decisions, &decision)))) {
            return Err("native risk source lacks a confirmed task receipt".into());
        }
        let plan_records = cadence::execution::history::plan_records(&view.snapshot.data, phase).map_err(|error| error.to_string())?;
        let identity = cadence::execution::history::admitted_plans(&view.snapshot.data, phase).map_err(|error| error.to_string())?
            .into_iter().find(|(identity, _)| identity.plan == plan).map(|(identity, _)| identity)
            .ok_or("native risk source lacks an admitted plan")?;
        let projection = cadence::execution::history::plan_project(&plan_records, &identity);
        if projection.repair.is_some() && !plan_records.iter().any(|record| record.request.plan == identity
            && matches!(&record.request.event, cadence::execution::history::PlanEvent::SuiteRepair(_))
            && cadence::execution::history::plan_decision(record).is_ok_and(|decision| cadence::store::model::retained(&view.decisions, &decision))) {
            return Err("native risk source lacks a confirmed suite repair receipt".into());
        }
        let head_id = projection.repair.as_ref().and_then(|repair| repair.commits.last()).cloned()
            .or_else(|| plan_bases.last().map(|basis| basis.source.completion.clone()))
            .ok_or("native risk source lacks committed material")?;
        return Ok(risk::MaterialIdentity::Committed {
            base_id: plan_bases[0].execution.base_id.clone(), head_id,
        });
    }
    let occurrence = execution
        .occurrences
        .get(&phase.to_string())
        .ok_or("risk source lacks accepted execution material")?;
    let receipt = occurrence
        .receipts
        .get(dispatch_id)
        .ok_or("risk source lacks an accepted dispatch receipt")?;
    let basis = risk::execution_bases(&view.snapshot.data)
        .map_err(|error| error.to_string())?
        .remove(dispatch_id)
        .ok_or("risk source lacks a retained dispatch base")?;
    if basis.phase != phase
        || basis.plan != plan
        || receipt.outcome.phase != phase
        || receipt.outcome.plan != plan
        || basis.plan_set_fingerprint != occurrence.plan_set_fingerprint
        || basis.transition_id != receipt.transition_id
        || receipt.outcome.transition_id != receipt.transition_id
        || basis.commits != risk::completed_commits(&receipt.outcome)
    {
        return Err("risk source differs from accepted execution material".into());
    }
    let confirmed = view.decisions.iter().any(|record| match &record.decision {
        cadence::store::model::Decision::BoundaryV1(value) => {
            value.store_generation <= view.snapshot.generation
                && value.boundary.tool == BoundaryTool::CadenceApply
                && value.boundary.scope == (BoundaryScope::Execution { phase })
                && value.boundary.subject_id.as_deref() == Some(dispatch_id)
                && (matches!(&value.boundary.receipt, Receipt::Compact { envelope: Envelope::Ok(_) })
                    || matches!(&value.boundary.receipt, Receipt::Compact { envelope: Envelope::Refused { code, .. } } if code == "risk-pending"))
                && confirmed_boundary(view, &value.boundary).is_ok()
        }
        _ => false,
    });
    if !confirmed {
        return Err("risk source lacks confirmed patch acceptance".into());
    }
    let head_id = basis
        .commits
        .last()
        .cloned()
        .unwrap_or_else(|| basis.base_id.clone());
    Ok(risk::MaterialIdentity::Committed {
        base_id: basis.base_id,
        head_id,
    })
}

#[cfg(test)]
mod schema_tests {
    use super::*;

    const OPAQUE_BODY: &str = "opaque 日本語\n# unparsed heading\n";

    /// A dispatch whose plan body is opaque UTF-8, before its prompt is stored.
    fn opaque_body_dispatch() -> cadence::execution::model::ActiveDispatch {
        let source = b"---\nphase: 6\nplan: 1\nrequirements: [AC1]\nfiles: [src/a.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n---\n";
        let mut bytes = source.to_vec();
        bytes.extend_from_slice(OPAQUE_BODY.as_bytes());
        let plan = parse_plan(&bytes, 6, 1).unwrap();
        cadence::execution::dispatch::build_dispatch(
            &plan,
            &"a".repeat(64),
            0,
            &"b".repeat(40),
        )
        .unwrap()
    }

    #[test]
    fn rerendering_a_dispatch_after_storing_its_prompt_yields_the_same_digest() {
        let mut dispatch = opaque_body_dispatch();
        let prompt = render_prompt(&dispatch);
        dispatch.prompt_digest = cadence::store::model::digest(prompt.as_bytes());
        dispatch.prompt = prompt;
        assert_eq!(cadence::store::model::digest(render_prompt(&dispatch).as_bytes()), dispatch.prompt_digest);
    }

    #[test]
    fn the_prompt_ends_with_the_opaque_body_and_states_its_utf8_byte_count() {
        let prompt = render_prompt(&opaque_body_dispatch());
        assert!(prompt.ends_with(OPAQUE_BODY));
        assert!(prompt.contains(&format!("Opaque plan body ({} UTF-8 bytes):", OPAQUE_BODY.len())));
    }

    #[test]
    fn the_prompt_embeds_the_patch_schema_between_its_headings() {
        let prompt = render_prompt(&opaque_body_dispatch());
        let schema = prompt
            .split("Executor patch schema:\n")
            .nth(1)
            .unwrap()
            .split("\n\nInstructions:")
            .next()
            .unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(schema).unwrap(),
            patch_schema()
        );
    }
}

/// What the review handoff does with one completed receipt.
#[derive(Debug, PartialEq)]
pub(crate) enum ExecutionReviewDecision {
    /// Nothing: the diff gate is off, so no material is gathered.
    Skip,
    /// Answer from the replay saved for this receipt.
    Replay {
        fire: String,
        attempt: String,
    },
    /// Gather the receipt's material and ask review to admit it at this gate.
    Admit {
        gate: cadence::review::model::Gate,
    },
}

/// A saved replay answers first. Otherwise the resolved diff gate decides:
/// off skips the receipt before any material is gathered, anything else is
/// admitted.
pub(crate) fn execution_review_decision(
    gate: Option<cadence::review::model::Gate>,
    saved: Option<&Value>,
) -> cadence::store::Result<ExecutionReviewDecision> {
    if let Some(saved) = saved {
        return Ok(ExecutionReviewDecision::Replay {
            fire: saved["fire"]
                .as_str()
                .ok_or_else(|| Error::Invalid("invalid boundary fire".into()))?
                .into(),
            attempt: saved["attempt"]
                .as_str()
                .ok_or_else(|| Error::Invalid("invalid boundary attempt".into()))?
                .into(),
        });
    }
    match gate {
        Some(gate) if gate != cadence::review::model::Gate::Off => Ok(ExecutionReviewDecision::Admit { gate }),
        _ => Ok(ExecutionReviewDecision::Skip),
    }
}

/// Grouped-tool handoff guard; execution envelopes and canonical receipts are
/// unchanged. Reads include replayed terminal dispatches before exposing them.
pub async fn review_handoff<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    phase: Option<u32>,
    dispatch: Option<&str>,
) -> super::review_service::Answer {
    let session = factory.first_touch(root).await?;
    let phase = match phase {
        Some(phase) => Some(phase),
        None => match dispatch {
            Some(id) => {
                let view = session.derivation_view().await?;
                dispatch_phase(&view, id).map_err(|e| Error::Invalid(e.to_string()))?
            }
            None => None,
        },
    };
    let Some(phase) = phase else {
        return Ok(Envelope::Ok(super::review_service::Output {
            operation: "review-handoff".into(),
            result: json!({"pending":false}),
        }));
    };
    let view = session.derivation_view().await?;
    let execution = execution_snapshot(&view).map_err(Error::Invalid)?;
    if let Some(occurrence) = execution.occurrences.get(&phase.to_string()) {
        for receipt in occurrence
            .receipts
            .values()
            .filter(|r| r.outcome.disposition == PlanDisposition::Complete)
        {
            let scope = continuation_scope(root, phase);
            let key = format!(
                "execution-review:{}",
                digest(&serde_json::to_vec(&json!({
                    "scope":scope,"occurrence":occurrence.plan_set_fingerprint,
                    "dispatch":receipt.dispatch_id,"transition":receipt.transition_id,"trigger":"diff","round":1
                }))?)
            );
            let records = cadence::review::persistence::records(
                &session.derivation_view().await?.snapshot.data,
            )?;
            let saved = records.get("replays").and_then(|r| r.get(&key));
            // A saved replay needs no configuration; otherwise the diff gate is
            // resolved first, so a gate that is off gathers no material.
            let resolved = match saved {
                Some(_) => None,
                None => {
                    let generation = session.config()?;
                    let route = super::config_service::route_at(
                        &generation,
                        &super::config_service::RouteRequest {
                            role: "cad-reviewer".into(),
                            phase: std::num::NonZeroU32::new(phase),
                            plan: std::num::NonZeroU32::new(receipt.outcome.plan),
                            attempt: None,
                        },
                        root,
                    )?;
                    let policy = route
                        .policy
                        .triggers
                        .get("diff")
                        .ok_or_else(|| Error::Policy("missing diff policy".into()))?;
                    let gate: cadence::review::model::Gate = serde_json::from_value(json!(policy.gate))?;
                    Some((gate, generation, route))
                }
            };
            let fire = match execution_review_decision(resolved.as_ref().map(|(gate, ..)| gate.clone()), saved)? {
                ExecutionReviewDecision::Skip => continue,
                ExecutionReviewDecision::Replay { fire, .. } => fire,
                ExecutionReviewDecision::Admit { gate } => {
                    let (_, generation, route) = resolved.ok_or_else(|| {
                        Error::Invalid("missing execution review resolution".into())
                    })?;
                    let material = risk_material(
                        &view,
                        root,
                        phase,
                        &scope.occurrence,
                        receipt.outcome.plan,
                        &receipt.dispatch_id,
                    )
                    .map_err(Error::Invalid)?;
                    let cadence::rail::risk::MaterialIdentity::Committed { base_id, head_id } = material else {
                        return Err(Error::Invalid(
                            "completed execution requires a committed range".into(),
                        ));
                    };
                    let request = json!({"replay_key":key,"caller":"execute","trigger":"diff","specialist":null,
                        "project":scope.project,"cycle":scope.cycle,"home":{"kind":"phase","id":phase.to_string()},
                        "discriminator":scope.occurrence,"phase":phase,"plan":receipt.outcome.plan,
                        "anchor":receipt.transition_id,"round":1,"target":{"kind":"committed-range","base":base_id,"head":head_id}});
                    let answer = super::review_service::admit(
                        factory,
                        root,
                        request,
                        super::review_service::AdmissionResolution::Supplied {
                            generation: Box::new(generation),
                            route: Box::new(route),
                            gate,
                        },
                    )
                    .await?;
                    match answer {
                        Envelope::Ok(output) if output.result["fire"].is_string() => {
                            output.result["fire"].as_str().unwrap().to_owned()
                        }
                        Envelope::Ok(output) if output.result["gate"] == "off" => continue,
                        answer => return Ok(answer),
                    }
                }
            };
            let answer = super::review_service::next(session.review_store(), &fire).await?;
            if !matches!(&answer, Envelope::Ok(output) if super::review_service::execution_continuation(&output.result) == "continue")
            {
                return Ok(answer);
            }
        }
    }
    super::review_service::pending_execution(session.review_store(), phase).await
}

#[cfg(test)]
mod routing_prompt_tests {
    use super::*;
    use cadence::execution::render::prompt_operational;

    #[test]
    fn prompt_operational_returns_the_admitted_choice_verbatim() {
        let route = json!({"choice":{"role":"cad-executor","agent":"cad-executor-xhigh","rung":"xhigh","starting_rung":"xhigh","model":"opus",
            "effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"xhigh"},
            "model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"opus"},
            "attempt":1,"escalated":false,"pinned":false,"reasons":["fixture selection"],"warnings":[]},
            "inputs":{"repo":{"identity":"/project/.planning/config.v4.json","content":null,"stamp":null},"global":null,"global_alias":false}});
        let supplied: ActiveDispatch = serde_json::from_value(json!({"schema":1,"id":"dispatch-fixture","expected_execution_version":1,
            "phase":8,"plan":1,"plan_fingerprint":"plan","plan_set_fingerprint":"plans","requirements":["AC10"],"tasks":[{"id":"T1","verify":["verify"]}],
            "suite":"verify","files":["src/a.rs"],"policy":{"rung":"xhigh","branch":"current","reviews":"disabled"},
            "route":route,"base_sha":"base","prompt":"x",
            "prompt_digest":"2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881",
            "body":"opaque fixture body"})).unwrap();
        assert_eq!(
            prompt_operational(&supplied),
            json!({"schema":1,"dispatch_id":"dispatch-fixture","expected_execution_version":1,
            "phase":8,"plan":1,"requirements":["AC10"],"files":["src/a.rs"],"suite":"verify","tasks":[{"id":"T1","verify":["verify"]}],
            "policy":{"rung":"xhigh","branch":"current","reviews":"disabled"},"base_sha":"base","route":route})
        );
    }
}

#[cfg(test)]
mod gap151_boundary_tests {
    use super::*;
    use cadence::review::model::Gate;

    #[test]
    fn gap151_a_completed_receipt_under_a_live_gate_is_admitted_at_that_gate() {
        assert_eq!(
            execution_review_decision(Some(Gate::Advisory), None).unwrap(),
            ExecutionReviewDecision::Admit { gate: Gate::Advisory }
        );
    }

    #[test]
    fn gap151_replay_precedes_changed_policy_and_material() {
        let saved = json!({"replay_key":"k1","fire":"f1","attempt":"a1"});
        assert_eq!(
            execution_review_decision(Some(Gate::Off), Some(&saved)).unwrap(),
            ExecutionReviewDecision::Replay {
                fire: "f1".into(),
                attempt: "a1".into()
            }
        );
    }

    #[test]
    fn gap151_an_off_or_unresolved_gate_skips_the_receipt_before_any_material() {
        assert_eq!(execution_review_decision(Some(Gate::Off), None).unwrap(), ExecutionReviewDecision::Skip);
        assert_eq!(execution_review_decision(None, None).unwrap(), ExecutionReviewDecision::Skip);
    }

    #[test]
    fn a_saved_replay_without_its_fire_or_attempt_is_refused() {
        for saved in [json!({"attempt":"a1"}), json!({"fire":"f1"})] {
            assert!(matches!(execution_review_decision(Some(Gate::Advisory), Some(&saved)), Err(Error::Invalid(_))), "{saved}");
        }
    }
}

#[cfg(test)]
mod commit_tests {
    use super::*;

    const BASE: &str = "0000000000000000000000000000000000000000";

    /// A commit Git reports as present, after the one before it, under HEAD,
    /// signed, with a conventional subject naming its task, changing `paths`.
    fn good(task: &str, commit: &str, paths: &[&str]) -> CommitFacts {
        CommitFacts {
            task_id: task.into(),
            commit: commit.into(),
            exists: Ok(()),
            follows_prior: Ok(true),
            under_head: Ok(true),
            signature: Ok(()),
            subject: Ok(format!("feat(exec): do the work for {task}")),
            paths: Ok(paths.iter().map(|path| path.to_string()).collect()),
        }
    }

    fn commit(n: char) -> String {
        n.to_string().repeat(40)
    }

    fn refused(commits: &[CommitFacts]) -> (&'static str, String) {
        judge_commits(BASE, commits).unwrap_err()
    }

    #[test]
    fn commits_that_hold_up_answer_each_ones_changed_paths() {
        let (a, b) = (commit('a'), commit('b'));
        assert_eq!(
            judge_commits(BASE, &[good("P1-T1", &a, &["src/a.rs"]), good("P1-T2", &b, &["src/b.rs", "src/c.rs"])]),
            Ok(BTreeMap::from([
                (a, vec!["src/a.rs".to_string()]),
                (b, vec!["src/b.rs".to_string(), "src/c.rs".to_string()]),
            ]))
        );
    }

    #[test]
    fn one_commit_completing_two_tasks_is_refused() {
        let a = commit('a');
        assert_eq!(
            refused(&[good("P1-T1", &a, &[]), good("P1-T2", &a, &[])]),
            ("reused-commit", "one commit cannot complete two tasks".to_string())
        );
    }

    #[test]
    fn a_commit_git_cannot_read_is_missing() {
        let mut missing = good("P1-T1", &commit('a'), &[]);
        missing.exists = Err("git cat-file failed".into());
        assert_eq!(refused(&[missing]), ("missing-commit", "git cat-file failed".to_string()));
    }

    #[test]
    fn a_commit_that_is_the_base_or_not_after_the_one_before_it_is_out_of_order() {
        let a = commit('a');
        let mut late = good("P1-T2", &commit('b'), &[]);
        late.follows_prior = Ok(false);
        assert_eq!(refused(&[good("P1-T1", BASE, &[])]), ("git-order", format!("commit {BASE} is not strictly after {BASE}")));
        assert_eq!(
            refused(&[good("P1-T1", &a, &[]), late]),
            ("git-order", format!("commit {} is not strictly after {a}", commit('b')))
        );
    }

    #[test]
    fn a_commit_not_under_the_current_head_is_out_of_order() {
        let mut detached = good("P1-T1", &commit('a'), &[]);
        detached.under_head = Ok(false);
        assert_eq!(refused(&[detached]), ("git-order", format!("commit {} is not an ancestor of current HEAD", commit('a'))));
    }

    #[test]
    fn an_unsigned_commit_is_refused_with_gits_reason() {
        let mut unsigned = good("P1-T1", &commit('a'), &[]);
        unsigned.signature = Err("no signature found".into());
        assert_eq!(refused(&[unsigned]), ("bad-signature", "no signature found".to_string()));
    }

    #[test]
    fn a_subject_that_is_not_conventional_or_names_another_task_is_refused() {
        for subject in ["did the work for P1-T1", "feat(exec): do the work for P1-T9"] {
            let mut wrong = good("P1-T1", &commit('a'), &[]);
            wrong.subject = Ok(subject.into());
            assert_eq!(
                refused(&[wrong]),
                ("commit-subject", format!("commit {} subject is not conventional or does not name P1-T1", commit('a'))),
                "{subject}"
            );
        }
    }

    #[test]
    fn paths_git_cannot_list_refuse_the_patch() {
        let mut unlisted = good("P1-T1", &commit('a'), &[]);
        unlisted.paths = Err("git diff-tree failed".into());
        assert_eq!(refused(&[unlisted]), ("commit-paths", "git diff-tree failed".to_string()));
    }

    #[test]
    fn the_first_failure_in_task_order_is_the_answer() {
        let mut unsigned = good("P1-T2", &commit('b'), &[]);
        unsigned.signature = Err("no signature found".into());
        let mut missing = good("P1-T3", &commit('c'), &[]);
        missing.exists = Err("missing".into());
        assert_eq!(
            refused(&[good("P1-T1", &commit('a'), &[]), unsigned, missing]),
            ("bad-signature", "no signature found".to_string())
        );
    }
}

#[cfg(test)]
mod selection_tests {
    use super::*;
    use cadence::derivation::{CapturedInputs, Observation, PhaseObservation, derive, parse_roadmap};

    /// The lifecycle of a roadmap whose phases hold `plans` plan files each.
    fn lifecycle(roadmap: &str, plans: &[&[&str]]) -> cadence::derivation::Lifecycle {
        let parsed = parse_roadmap(roadmap).unwrap();
        let phases = parsed
            .phases
            .iter()
            .zip(plans)
            .map(|(phase, names)| PhaseObservation {
                relative_path: phase.relative_path.clone(),
                plans: Observation::Present(names.iter().map(|name| name.to_string()).collect()),
                summary: Observation::Absent,
                uat: Observation::Absent,
            })
            .collect();
        derive(&CapturedInputs {
            root: "/project/.planning".into(),
            root_probe: Observation::Present(()),
            roadmap: Observation::Present(roadmap.as_bytes().to_vec()),
            declarations: Some(Ok(parsed)),
            phases,
        })
        .unwrap()
    }

    const TWO: &str = "## Phases\n- [ ] **Phase 3: Three**\n- [ ] **Phase 4: Four**";

    fn refusal(result: Result<cadence::derivation::PhaseRecord, (&'static str, String)>) -> (&'static str, String) {
        result.unwrap_err()
    }

    #[test]
    fn the_current_planned_phase_executes() {
        let record = executable_phase(&lifecycle(TWO, &[&["PLAN.md"], &[]]), 3).unwrap();
        assert_eq!((record.id.address(), record.status), ("3".to_string(), LifecycleStatus::Planned));
    }

    #[test]
    fn a_closed_cycle_executes_nothing() {
        assert_eq!(
            refusal(executable_phase(&lifecycle("## Phases\nNo active phases.", &[]), 3)),
            ("closed-cycle", "execution requires the live planning cycle".to_string())
        );
    }

    #[test]
    fn a_phase_the_lifecycle_does_not_hold_is_unknown() {
        assert_eq!(
            refusal(executable_phase(&lifecycle(TWO, &[&["PLAN.md"], &[]]), 9)),
            ("unknown-phase", "the lifecycle does not contain the requested phase".to_string())
        );
    }

    #[test]
    fn a_phase_after_the_current_one_is_not_current() {
        assert_eq!(
            refusal(executable_phase(&lifecycle(TWO, &[&["PLAN.md"], &["PLAN.md"]]), 4)),
            ("phase-not-current", "the requested phase is not the derived current phase".to_string())
        );
    }

    #[test]
    fn an_unplanned_current_phase_cannot_execute() {
        assert_eq!(
            refusal(executable_phase(&lifecycle(TWO, &[&[], &[]]), 3)),
            ("lifecycle-refusal", "phase status Unplanned cannot execute".to_string())
        );
    }

    fn plan(number: u32, suite: &str) -> ExecutionPlan {
        let source = format!(
            "---\nphase: 6\nplan: {number}\nrequirements: [AC1]\nfiles: [src/a.rs]\nexecution:\n  schema: 1\n  suite: {suite}\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n---\nbody\n"
        );
        parse_plan(source.as_bytes(), 6, number).unwrap()
    }

    fn active(on: &ExecutionPlan) -> ActiveDispatch {
        cadence::execution::dispatch::build_dispatch(on, &"a".repeat(64), 0, &"b".repeat(40)).unwrap()
    }

    #[test]
    fn a_retained_dispatch_is_reissued_from_its_unchanged_admitted_plan() {
        let plans = [plan(1, "cargo test"), plan(2, "cargo test")];
        assert_eq!(active_plan(&active(&plans[1]), &plans).unwrap(), &plans[1]);
    }

    #[test]
    fn a_retained_dispatch_whose_plan_is_no_longer_admitted_is_refused() {
        let dispatched = plan(2, "cargo test");
        assert_eq!(
            active_plan(&active(&dispatched), &[plan(1, "cargo test")]).map(|_| ()),
            Err(("active-plan-missing", "the active dispatch plan is no longer admitted".to_string()))
        );
    }

    #[test]
    fn a_retained_dispatch_whose_plan_bytes_changed_is_refused() {
        let dispatched = plan(1, "cargo test");
        assert_eq!(
            active_plan(&active(&dispatched), &[plan(1, "cargo nextest run")]).map(|_| ()),
            Err(("plan-changed", "the active plan bytes differ from the admitted fingerprint".to_string()))
        );
    }

    #[test]
    fn only_an_accepted_continuation_or_an_approved_suite_repair_dispatches_work() {
        use ContinuationDecision as D;
        assert!(may_continue(&D::Continue { answer: None, override_id: None, rerun_plans: vec![] }));
        assert!(may_continue(&D::RepairSuite { question_id: "q1".into(), approved: true }));
        for decision in [
            D::AwaitAcceptance,
            D::RepairSuite { question_id: "q1".into(), approved: false },
            D::Revise,
            D::FreshCheck,
            D::OverrideRequired,
        ] {
            assert!(!may_continue(&decision), "{decision:?}");
        }
    }
}

#[cfg(test)]
mod refusal_scope_tests {
    use super::*;
    use cadence::execution::model::ExecutionOccurrence;

    fn dispatch(phase: u32, plan: u32) -> ActiveDispatch {
        let source = format!(
            "---\nphase: {phase}\nplan: {plan}\nrequirements: [AC1]\nfiles: [src/a.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n---\nbody\n"
        );
        let plan = parse_plan(source.as_bytes(), phase, plan).unwrap();
        cadence::execution::dispatch::build_dispatch(&plan, &"a".repeat(64), 0, &"b".repeat(40)).unwrap()
    }

    fn occurrence(phase: u32, active: Option<ActiveDispatch>) -> ExecutionOccurrence {
        ExecutionOccurrence {
            phase,
            undone: None,
            plan_set_fingerprint: "plans".into(),
            version: 1,
            active,
            plans: vec![],
            terminal: None,
            receipts: BTreeMap::new(),
            issues: BTreeMap::new(),
        }
    }

    /// A store view whose execution namespace holds `occurrences`.
    fn view(occurrences: Vec<ExecutionOccurrence>) -> View {
        let execution = ExecutionSnapshot {
            schema: cadence::execution::model::EXECUTION_SCHEMA,
            occurrences: occurrences.into_iter().map(|o| (o.phase.to_string(), o)).collect(),
        };
        let data = json!({"execution": serde_json::to_value(execution).unwrap()});
        View { items: vec![], decisions: vec![], snapshot: cadence::store::model::Snapshot::new(1, b"", b"", data).unwrap() }
    }

    #[test]
    fn a_malformed_apply_naming_an_active_dispatch_is_refused_under_its_phase() {
        let active = dispatch(5, 1);
        let store = view(vec![occurrence(5, Some(active.clone())), occurrence(6, None)]);
        assert_eq!(refusal_phase(&store, BoundaryTool::CadenceApply, Some(&json!({"dispatch_id": active.id}))), Ok(5));
    }

    #[test]
    fn a_malformed_apply_naming_no_known_dispatch_is_refused_under_the_root_scope() {
        let store = view(vec![occurrence(5, Some(dispatch(5, 1)))]);
        for raw in [Some(json!({"dispatch_id": "foreign"})), Some(json!({"phase": 5})), Some(json!({"dispatch_id": 7})), None] {
            assert_eq!(refusal_phase(&store, BoundaryTool::CadenceApply, raw.as_ref()), Ok(0), "{raw:?}");
        }
    }

    /// An occurrence with no active dispatch whose applied receipts hold
    /// `dispatch`: its patch has landed.
    fn received(phase: u32, dispatch: &str) -> ExecutionOccurrence {
        let outcome = cadence::execution::model::PlanOutcome {
            dispatch_id: dispatch.into(),
            phase,
            plan: 1,
            disposition: PlanDisposition::Complete,
            tasks: vec![],
            deviations: vec![],
            blockers: vec![],
            commit_paths: BTreeMap::new(),
            transition_id: "t1".into(),
        };
        let receipt = cadence::execution::model::AppliedReceipt {
            dispatch_id: dispatch.into(),
            request_digest: "r".repeat(64),
            transition_id: "t1".into(),
            outcome,
        };
        ExecutionOccurrence { receipts: BTreeMap::from([(dispatch.into(), receipt)]), ..occurrence(phase, None) }
    }

    #[test]
    fn a_malformed_apply_naming_a_dispatch_whose_patch_landed_is_refused_under_its_phase() {
        let store = view(vec![occurrence(5, Some(dispatch(5, 1))), received(6, "d1")]);
        assert_eq!(refusal_phase(&store, BoundaryTool::CadenceApply, Some(&json!({"dispatch_id": "d1"}))), Ok(6));
    }

    #[test]
    fn a_request_is_identified_by_its_tool_operation_and_raw_arguments() {
        let digest = |bytes: &str| cadence::store::model::digest(bytes.as_bytes());
        assert_eq!(
            public_request_digest(BoundaryTool::CadenceApply, Some(&json!({"phase": 3}))),
            digest(r#"["execution-request-v1","cadence-apply","executor",{"phase":3}]"#)
        );
        assert_eq!(
            public_request_digest(BoundaryTool::CadenceQuery, None),
            digest(r#"["execution-request-v1","cadence-query","execute-next",null]"#)
        );
    }

    #[test]
    fn a_closed_resident_and_changed_routing_inputs_keep_their_own_failure_and_the_rest_are_store_failures() {
        assert_eq!(store_failure(Error::Closed), Failure::Closed);
        assert_eq!(store_failure(Error::Conflict("routing inputs changed before admission".into())), Failure::RoutingInputsChanged);
        for other in [Error::Conflict("stale snapshot".into()), Error::Invalid("unreadable configuration".into())] {
            assert_eq!(store_failure(other.clone()), Failure::Store, "{other:?}");
        }
    }

    #[test]
    fn a_malformed_query_is_refused_under_the_root_scope_whatever_it_names() {
        let active = dispatch(5, 1);
        let store = view(vec![occurrence(5, Some(active.clone()))]);
        assert_eq!(refusal_phase(&store, BoundaryTool::CadenceQuery, Some(&json!({"dispatch_id": active.id}))), Ok(0));
    }

    #[test]
    fn a_dispatch_held_by_two_occurrences_is_an_unsound_store() {
        let active = dispatch(5, 1);
        let store = view(vec![occurrence(5, Some(active.clone())), occurrence(6, Some(active.clone()))]);
        assert!(matches!(dispatch_phase(&store, &active.id), Err(Failure::Store)));
    }
}

#[cfg(test)]
mod reissue_tests {
    use super::*;

    /// A dispatch admitted on executor `agent` with `prompt` retained.
    fn admitted(agent: &str, prompt: &str) -> ActiveDispatch {
        serde_json::from_value(json!({
            "schema":1,"id":"d","expected_execution_version":1,"phase":6,"plan":1,
            "plan_fingerprint":"f","plan_set_fingerprint":"s","requirements":[],"tasks":[],
            "suite":"cargo test","files":[],"policy":{"rung":"fixed","branch":"current","reviews":"disabled"},
            "route":{"choice":{"role":"cad-executor","agent":agent,"rung":"xhigh","starting_rung":"xhigh","model":"opus",
                "effort_source":{"kind":"role","key":"roles.cad-executor.effort","layer":"repo","stored":"xhigh"},
                "model_source":{"kind":"role","key":"roles.cad-executor.model","layer":"repo","stored":"opus"},
                "attempt":1,"escalated":false,"pinned":false,"reasons":[],"warnings":[]},
                "inputs":{"repo":{"identity":"/project/.planning/config.json","content":"0".repeat(64),"stamp":null},
                "global":null,"global_alias":false}},
            "base_sha":"b".repeat(40),"prompt":prompt,
            "prompt_digest":cadence::store::model::digest(prompt.as_bytes()),"body":""
        }))
        .unwrap()
    }

    fn plan() -> ExecutionPlan {
        let source = "---\nphase: 6\nplan: 1\nrequirements: [AC1]\nfiles: [src/a.rs]\nexecution:\n  schema: 1\n  suite: cargo test\n  tasks:\n    - id: T1\n      verify: [cargo test one]\n---\nthe plan body\n";
        parse_plan(source.as_bytes(), 6, 1).unwrap()
    }

    #[test]
    fn a_reissued_dispatch_keeps_its_admitted_executor_and_prompt_and_takes_the_plan_body() {
        let active = admitted("cad-executor-xhigh", "the admitted prompt");
        let Response::Dispatch { dispatch, prompt } = dispatch_response(&active, &plan()) else {
            panic!("a retained prompt re-issues the dispatch");
        };
        assert_eq!(dispatch.route.as_ref().unwrap().choice.agent, "cad-executor-xhigh");
        assert_eq!(prompt, "the admitted prompt");
        assert_eq!(*dispatch, ActiveDispatch { body: "the plan body\n".into(), ..active });
    }

    #[test]
    fn a_prompt_that_no_longer_matches_its_digest_refuses_the_reissue() {
        let mut active = admitted("cad-executor", "the admitted prompt");
        active.prompt = "edited".into();
        assert!(matches!(
            dispatch_response(&active, &plan()),
            Response::Refused { phase: 6, code, .. } if code == "prompt-integrity"
        ));
    }

    #[test]
    fn a_dispatch_whose_prompt_was_not_retained_cannot_be_read_back() {
        let mut digested = admitted("cad-executor", "the admitted prompt");
        digested.prompt.clear();
        let mut counted = admitted("cad-executor", "");
        counted.prompt_digest.clear();
        counted.prompt_bytes = Some(12);
        for active in [digested, counted] {
            assert_eq!(retained_prompt(&active).unwrap_err().0, "prompt-not-retained", "{active:?}");
        }
    }

    #[test]
    fn a_dispatch_admitted_without_a_prompt_reissues_an_empty_one() {
        let mut active = admitted("cad-executor", "");
        active.prompt_digest.clear();
        assert_eq!(retained_prompt(&active), Ok(String::new()));
    }

    #[test]
    fn a_full_hexadecimal_sha_is_the_head_without_its_line_end() {
        assert_eq!(head_sha(&format!("{}\n", "0a".repeat(20))), Ok("0a".repeat(20)));
    }

    #[test]
    fn a_short_long_or_non_hexadecimal_answer_is_not_a_head() {
        for output in ["a".repeat(39), "a".repeat(41), "g".repeat(40), String::new()] {
            assert_eq!(head_sha(&output), Err("Git HEAD is not a full commit SHA".to_string()), "{output}");
        }
    }
}
