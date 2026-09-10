//! Native evidence is recorded separately from historical executor receipts.
use super::allocation::Check;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Material {
    pub commit: String,
    pub tree: String,
    pub test_file: String,
    pub test_digest: String,
    pub command: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Stage { Red, Green, Verify }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Launch {
    pub run_id: String,
    pub check: Option<Check>,
    pub stage: Stage,
    pub material: Material,
    pub launched_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Disposition { Exited { code: i32 }, Signaled { signal: i32 }, LaunchFailed { reason: String } }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Capture {
    pub bytes: Vec<u8>,
    pub digest: String,
    pub complete: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "class", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Observation {
    Unknown,
    ResultsObserved { summary: Summary },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "runner", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Summary {
    Cargo { failed: bool },
    Unittest { failed: bool, failures: u64, errors: u64 },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RunResult {
    pub run_id: String,
    pub disposition: Disposition,
    pub stdout: Capture,
    pub stderr: Capture,
    pub observed_at: u64,
    pub observation: Observation,
    pub material_unchanged: bool,
}

impl RunResult {
    /// Both streams belong to the output identity; neither can be substituted.
    pub fn output_identity(&self) -> String {
        crate::store::model::digest(format!("{}\n{}", self.stdout.digest, self.stderr.digest).as_bytes())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Inspection {
    pub check: Check,
    pub test_digest: String,
    pub evidence: Vec<String>,
    pub no_subject_stub: bool,
}

/// Approval echoes the exact payload, following native context/plan approval.
/// A caller's role label alone is never an approval.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerApproval<T> {
    pub approved: bool,
    pub owner: String,
    pub at: String,
    pub submission: T,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerStatement {
    pub submission: Inspection,
    pub approval: OwnerApproval<Inspection>,
    pub supersedes: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Interpretation { RedEligible, GreenEligible }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Classification {
    pub run_id: String,
    pub output_identity: String,
    pub check: Check,
    pub interpretation: Interpretation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerClassification {
    pub submission: Classification,
    pub approval: OwnerApproval<Classification>,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct OwnerInput {
    pub request_id: String,
    pub task: super::history::Task,
    pub attempt: String,
    pub expected_version: u64,
    pub statement: OwnerStatement,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum OwnerApply {
    /// Records the owner's inspection; validates its binding, not its truth.
    #[serde(rename = "execution-owner-attest")]
    Attest { request: OwnerInput },
}

pub fn validate_approval<T: PartialEq>(submission: &T, approval: &OwnerApproval<T>) -> bool {
    approval.approved && !approval.owner.trim().is_empty() && !approval.at.trim().is_empty() && approval.submission == *submission
}

pub fn validate_inspection(records: &[super::history::Record], task: &super::history::Task, statement: &OwnerStatement) -> crate::store::Result<()> {
    use super::history::Event;
    let inspection = &statement.submission;
    let refuse = |reason: &str| super::admission::refuse(task.phase, "owner-inspection", "statement", &inspection.check.id, reason);
    if !validate_approval(inspection, &statement.approval) {
        return Err(refuse("actual attributed/timed owner approval must echo the exact inspection payload"));
    }
    if inspection.evidence.is_empty() || inspection.test_digest.is_empty() {
        return Err(refuse("inspection requires exact test material and inspected run evidence"));
    }
    let mut seen = std::collections::BTreeSet::new();
    for reference in &inspection.evidence {
        if !seen.insert(reference) { return Err(refuse("ambiguous repeated inspection reference")); }
        let launch = records.iter().find_map(|r| match &r.request.event {
            Event::Launch(launch) if r.request.task == *task && &launch.run_id == reference => Some(launch), _ => None,
        }).ok_or_else(|| refuse("inspection reference has no retained launch for this task"))?;
        if launch.check.as_ref() != Some(&inspection.check) || launch.material.test_digest != inspection.test_digest
            || !records.iter().any(|r| r.request.task == *task && matches!(&r.request.event, Event::Result(result) if &result.run_id == reference)) {
            return Err(refuse("inspection revision, test material or observed evidence is stale"));
        }
    }
    if let Some(supersedes) = &statement.supersedes
        && !records.iter().any(|r| r.request.task == *task && r.request.request_id == *supersedes
            && matches!(&r.request.event, Event::OwnerStatement(prior) if prior.submission.check == inspection.check)) {
        return Err(refuse("superseding statement must link its prior statement"));
    }
    Ok(())
}

pub fn owner_eligible(statement: &OwnerStatement, check: &Check, test_digest: &str, evidence: &[String]) -> bool {
    validate_approval(&statement.submission, &statement.approval) && statement.submission.no_subject_stub
        && statement.submission.check == *check && statement.submission.test_digest == test_digest
        && statement.submission.evidence == evidence
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SourceMaterial {
    pub completion: String,
    pub evidence_commits: Vec<String>,
    pub commit_paths: std::collections::BTreeMap<String, Vec<String>>,
    pub staged_objects: Vec<u8>,
    pub staged_paths: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Pair {
    pub check: Check,
    pub red_commit: String,
    pub green_commit: String,
    pub red_run: String,
    pub green_run: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Close {
    pub request_id: String,
    pub task: super::history::Task,
    pub attempt: String,
    pub expected_version: u64,
    pub completion: String,
    pub checks: Vec<Pair>,
    pub verification: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum CloseApply {
    #[serde(rename = "execution-task-close")]
    Close { request: Close },
    #[serde(rename = "execution-classify-run")]
    Classify { request: ClassificationInput },
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ClassificationInput {
    pub request_id: String,
    pub task: super::history::Task,
    pub attempt: String,
    pub expected_version: u64,
    pub statement: OwnerClassification,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CloseProof {
    pub submission: Close,
    pub project: std::path::PathBuf,
    pub planning_root: std::path::PathBuf,
    pub dispatch: super::model::ActiveDispatch,
    pub source: SourceMaterial,
}

pub fn unsatisfied(task: &super::history::Task, rule: &str, checks: Vec<Check>, reason: &str) -> crate::store::Error {
    crate::store::Error::Invalid(format!("native-task-refusal:{}", serde_json::json!({"status":"refused","rule":rule,"slot":"checks",
        "phase":task.phase,"id":task.task,"reason":reason,"details":{"unsatisfied":checks}})))
}

pub fn allocated(data: &serde_json::Value, task: &super::history::Task) -> crate::store::Result<Vec<Check>> {
    super::admission::records(data,task.phase)?.iter().find(|r| r.request_digest == task.admission_digest)
        .and_then(|r|r.request.contract.allocation.iter().find(|a|a.plan==task.plan && a.task==task.task))
        .map(|a|a.checks.clone()).ok_or_else(|| super::admission::refuse(task.phase,"task-admission","task",&task.task,"admitted task allocation required"))
}

pub fn validate_classification(records: &[super::history::Record], task: &super::history::Task, statement: &OwnerClassification) -> crate::store::Result<()> {
    use super::history::Event;
    let input=&statement.submission;
    let pair=records.iter().find_map(|r|match &r.request.event {
        Event::Result(result) if r.request.task==*task && result.run_id==input.run_id => Some(result), _=>None,
    });
    let launch=records.iter().find_map(|r|match &r.request.event {
        Event::Launch(launch) if r.request.task==*task && launch.run_id==input.run_id => Some(launch), _=>None,
    });
    let eligible=pair.zip(launch).is_some_and(|(result,launch)| result.observation==Observation::Unknown
        && result.output_identity()==input.output_identity && launch.check.as_ref()==Some(&input.check)
        && match (&input.interpretation,&result.disposition) {
            (Interpretation::RedEligible,Disposition::Exited {code})=>*code!=0,
            (Interpretation::GreenEligible,Disposition::Exited {code:0})=>true,
            _=>false,
        });
    if !validate_approval(input,&statement.approval) || !eligible {
        return Err(super::admission::refuse(task.phase,"owner-classification","statement",&input.check.id,
            "exact owner approval for this Unknown run, output, revision and observed disposition required"));
    }
    Ok(())
}

fn run_eligible(records: &[super::history::Record], task: &super::history::Task, result: &RunResult, check: &Check, red: bool) -> bool {
    let disposition=matches!(&result.disposition,Disposition::Exited {code} if if red {*code!=0}else{*code==0});
    if !disposition || !result.material_unchanged {return false}
    match &result.observation {
        Observation::ResultsObserved {summary:Summary::Cargo {failed}}=>if red {*failed}else{!*failed},
        Observation::ResultsObserved {summary:Summary::Unittest {failed,failures,errors}}=>if red {*failed && *failures>0 && *errors==0}else{!*failed && *failures==0 && *errors==0},
        Observation::Unknown=>records.iter().any(|r|r.request.task==*task && matches!(&r.request.event,
            super::history::Event::OwnerClassification(statement) if statement.submission.run_id==result.run_id
                && statement.submission.check==*check && statement.submission.output_identity==result.output_identity()
                && statement.submission.interpretation==if red {Interpretation::RedEligible}else{Interpretation::GreenEligible}
                && validate_classification(records,task,statement).is_ok())),
    }
}

pub fn validate_pairs(data: &serde_json::Value, records: &[super::history::Record], input: &Close, project: &std::path::Path) -> crate::store::Result<()> {
    use super::{history::Event, runner::{git,git_text}};
    let checks=allocated(data,&input.task)?;
    let mut invalid=Vec::new();
    for check in &checks {
        let matching:Vec<_>=input.checks.iter().filter(|p|p.check==*check).collect();
        let valid=matching.len()==1 && (|| -> Option<()> {
            let pair=matching[0];
            if pair.red_commit==pair.green_commit || !crate::rail::risk::valid_object_id(&pair.red_commit)
                || !crate::rail::risk::valid_object_id(&pair.green_commit) {return None}
            let get=|id:&str,red:bool| {
                let (position,record)=records.iter().enumerate().find(|(_,r)|r.request.task==input.task && r.request.attempt==input.attempt
                    && matches!(&r.request.event,Event::Launch(l) if l.run_id==id))?;
                let Event::Launch(launch)=&record.request.event else {return None};
                let result=records.iter().find_map(|r|match &r.request.event {
                    Event::Result(result) if r.request.task==input.task && r.request.attempt==input.attempt && result.run_id==id=>Some(result), _=>None,
                })?;
                if launch.check.as_ref()!=Some(check) || launch.stage!=if red {Stage::Red}else{Stage::Green}
                    || !run_eligible(records,&input.task,result,check,red) {return None}
                Some((position,launch,result))
            };
            let (ri,red,red_result)=get(&pair.red_run,true)?;
            let (gi,green,_)=get(&pair.green_run,false)?;
            if ri>=gi || red_result.observed_at>green.launched_at || red.material.commit!=pair.red_commit || green.material.commit!=pair.green_commit
                || red.material.test_file!=green.material.test_file || red.material.test_digest!=green.material.test_digest || red.material.command!=green.material.command {return None}
            git(project,&["merge-base","--is-ancestor",&pair.red_commit,&pair.green_commit]).ok()?;
            git(project,&["merge-base","--is-ancestor",&pair.green_commit,&input.completion]).ok()?;
            for (commit,material) in [(&pair.red_commit,&red.material),(&pair.green_commit,&green.material)] {
                let bytes=git(project,&["show",&format!("{commit}:{}",material.test_file)]).ok()?;
                if crate::store::model::digest(&bytes)!=material.test_digest
                    || git_text(project,&["rev-parse",&format!("{commit}^{{tree}}")]).ok()?!=material.tree {return None}
            }
            let completion_test=git(project,&["show",&format!("{}:{}",input.completion,green.material.test_file)]).ok()?;
            if crate::store::model::digest(&completion_test)!=green.material.test_digest {return None}
            Some(())
        })().is_some();
        if !valid {invalid.push(check.clone());}
    }
    if input.checks.iter().any(|p|!checks.contains(&p.check)) && invalid.is_empty() {
        invalid=if checks.is_empty() {input.checks.iter().map(|p|p.check.clone()).collect()}else{checks};
    }
    if !invalid.is_empty() {return Err(unsatisfied(&input.task,"red-green",invalid,"each admitted check requires an observed eligible red followed by green at unchanged committed test material"));}
    Ok(())
}

pub fn validate_close(data: &serde_json::Value, records: &[super::history::Record], proof: &CloseProof) -> crate::store::Result<()> {
    let input=&proof.submission;
    validate_pairs(data,records,input,&proof.project)?;
    let active=&data["execution"]["occurrences"][input.task.phase.to_string()]["active"];
    if serde_json::from_value::<super::model::ActiveDispatch>(active.clone())?!=proof.dispatch || proof.dispatch.plan!=input.task.plan {
        return Err(super::admission::refuse(input.task.phase,"task-dispatch","task",&input.task.task,"task close requires its exact active dispatch"));
    }
    let expected=proof.dispatch.tasks.iter().find(|t|t.id==input.task.task)
        .ok_or_else(||crate::store::Error::Invalid("closing task not in dispatch".into()))?;
    for command in &expected.verify {
        let verified=input.verification.iter().any(|id| {
            let launch=records.iter().find_map(|r|match &r.request.event {
                super::history::Event::Launch(launch) if r.request.task==input.task && r.request.attempt==input.attempt && launch.run_id==*id=>Some(launch),_=>None,
            });
            launch.is_some_and(|launch|launch.material.command==*command && launch.material.commit==input.completion
                && records.iter().any(|r|r.request.task==input.task && matches!(&r.request.event,super::history::Event::Result(result)
                    if result.run_id==*id && result.material_unchanged && result.disposition==(Disposition::Exited {code:0}))))
        });
        if !verified {return Err(super::admission::refuse(input.task.phase,"named-verification","verification",&input.task.task,"every named task command needs an observed passing receipt at completion"));}
    }
    reobserve_source(&proof.project,&proof.dispatch,&input.task.task,&proof.source)
}

/// Git's NUL protocol preserves both rename endpoints and rejects lossy paths.
pub fn read_name_status(bytes: &[u8]) -> Result<Vec<String>, String> {
    if bytes.is_empty() { return Ok(Vec::new()) }
    if bytes.last() != Some(&0) { return Err("unterminated Git name-status record".into()) }
    let mut fields = bytes[..bytes.len() - 1].split(|byte| *byte == 0);
    let mut paths = std::collections::BTreeSet::new();
    while let Some(status) = fields.next() {
        let status = std::str::from_utf8(status).map_err(|_| "invalid Git status")?;
        let endpoints = match status.as_bytes() {
            [b'A' | b'D' | b'M' | b'T'] => 1,
            [b'R' | b'C', score @ ..] if !score.is_empty() && score.iter().all(u8::is_ascii_digit)
                && std::str::from_utf8(score).ok().and_then(|s| s.parse::<u32>().ok()).is_some_and(|n| n <= 100) => 2,
            [b'M', score @ ..] if !score.is_empty() && score.iter().all(u8::is_ascii_digit)
                && std::str::from_utf8(score).ok().and_then(|s| s.parse::<u32>().ok()).is_some_and(|n| n <= 100) => 1,
            _ => return Err("invalid or unresolved Git name-status record".into()),
        };
        for _ in 0..endpoints {
            let path = fields.next().ok_or("missing Git rename/path endpoint")?;
            let path = std::str::from_utf8(path).map_err(|_| "Git path is not valid UTF-8")?;
            if !super::patch::safe_relative_path(path) { return Err("Git path is not a safe relative path".into()) }
            paths.insert(path.to_owned());
        }
    }
    Ok(paths.into_iter().collect())
}

pub fn conventional_subject(subject: &str, task_id: &str) -> bool {
    let Some((prefix, description)) = subject.split_once(": ") else { return false };
    if description.trim().is_empty() { return false }
    let prefix = prefix.strip_suffix('!').unwrap_or(prefix);
    let valid_type = if let Some((kind, scope)) = prefix.split_once('(') {
        kind.bytes().all(|byte| byte.is_ascii_lowercase()) && !kind.is_empty() && scope.ends_with(')') && scope.len() > 1
            && !scope[..scope.len() - 1].chars().any(char::is_whitespace)
    } else { !prefix.is_empty() && prefix.bytes().all(|byte| byte.is_ascii_lowercase()) };
    valid_type && description.split(|ch: char| !(ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))).any(|word| word == task_id)
}

pub fn commit_paths(project: &std::path::Path, commit: &str) -> crate::store::Result<Vec<String>> {
    use super::runner::{git, git_text};
    use crate::store::Error;
    let parents = git_text(project, &["show", "-s", "--format=%P", commit])?;
    let parents: Vec<_> = parents.split_whitespace().collect();
    let mut paths = std::collections::BTreeSet::new();
    for parent in parents.iter().copied().map(Some).chain(parents.is_empty().then_some(None)) {
        let mut args = vec!["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-z", "-M", "--no-ext-diff", "--no-textconv"];
        if let Some(parent) = parent { args.push(parent); }
        args.extend([commit, "--"]);
        paths.extend(read_name_status(&git(project, &args)?).map_err(Error::Invalid)?);
    }
    Ok(paths.into_iter().collect())
}

pub fn staged(project: &std::path::Path) -> crate::store::Result<(Vec<u8>, Vec<String>)> {
    use super::runner::git;
    let args = ["diff", "--cached", "--raw", "-z", "-M", "--no-abbrev", "--no-ext-diff", "--no-textconv", "--"];
    let objects = git(project, &args)?;
    let paths = read_name_status(&git(project, &["diff", "--cached", "--name-status", "-z", "-M", "--no-ext-diff", "--no-textconv", "--"])? )
        .map_err(crate::store::Error::Invalid)?;
    if git(project, &args)? != objects { return Err(crate::store::Error::Conflict("staged inputs changed during observation".into())); }
    Ok((objects, paths))
}

pub fn observe_source(project: &std::path::Path, active: &super::model::ActiveDispatch, task_id: &str,
    completion: &str, evidence: &[String]) -> crate::store::Result<SourceMaterial> {
    use super::runner::{git, git_text};
    use crate::{rail::risk::valid_object_id, store::Error};
    let head = git_text(project, &["rev-parse", "HEAD"])?;
    let mut observed = std::collections::BTreeMap::new();
    for commit in evidence.iter().map(String::as_str).chain(std::iter::once(completion)) {
        if !valid_object_id(commit) || commit == active.base_sha {
            return Err(Error::Invalid("evidence commit requires a full object id strictly after the dispatch base".into()));
        }
        git(project, &["cat-file", "-e", &format!("{commit}^{{commit}}")])?;
        git(project, &["merge-base", "--is-ancestor", &active.base_sha, commit])?;
        git(project, &["merge-base", "--is-ancestor", commit, &head])?;
        let paths = commit_paths(project, commit)?;
        for path in &paths {
            if !super::lease::covers(&active.files, &active.directories, path) {
                return Err(super::admission::refuse(active.phase, "lease", "evidence_commits", commit, format!("out-of-lease path: {path}")));
            }
        }
        observed.insert(commit.to_owned(), paths);
    }
    git(project, &["verify-commit", completion])?;
    let subject = git_text(project, &["show", "-s", "--format=%s", completion])?;
    if !conventional_subject(&subject, task_id) { return Err(Error::Invalid("completion subject must name its task conventionally".into())); }
    let (staged_objects, staged_paths) = staged(project)?;
    for path in &staged_paths {
        if !super::lease::covers(&active.files, &active.directories, path) {
            return Err(super::admission::refuse(active.phase, "lease", "staged", path, "out-of-lease staged path"));
        }
    }
    Ok(SourceMaterial { completion: completion.into(), evidence_commits: evidence.to_vec(), commit_paths: observed, staged_objects, staged_paths })
}

pub fn reobserve_source(project: &std::path::Path, active: &super::model::ActiveDispatch, task_id: &str, expected: &SourceMaterial) -> crate::store::Result<()> {
    if observe_source(project, active, task_id, &expected.completion, &expected.evidence_commits)? != *expected {
        return Err(crate::store::Error::Conflict("native source or staged inputs changed".into()));
    }
    Ok(())
}
