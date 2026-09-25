//! Native evidence is recorded separately from historical executor receipts.
use crate::process::Process;
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

/// One captured stream of a run: `bytes` is the record and `digest` is over
/// them. On the wire the bytes are a string under `text` when they are UTF-8
/// and a JSON integer array under `bytes` otherwise, and a capture is written
/// back in the form it was read in, so a retained record keeps the preimage
/// its digest was taken over (D-175; GH-263 part 2). Equality ignores the form.
#[derive(Clone, Debug)]
pub struct Capture {
    pub bytes: Vec<u8>,
    pub digest: String,
    pub complete: bool,
    pub result_lines: Vec<String>,
    form: Form,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Form { Bytes, Text }

impl Capture {
    pub fn new(bytes: Vec<u8>, complete: bool, result_lines: Vec<String>) -> Self {
        let form = if std::str::from_utf8(&bytes).is_ok() { Form::Text } else { Form::Bytes };
        Self { digest: crate::store::model::digest(&bytes), bytes, complete, result_lines, form }
    }
}

impl PartialEq for Capture {
    fn eq(&self, other: &Self) -> bool {
        self.bytes == other.bytes && self.digest == other.digest && self.complete == other.complete && self.result_lines == other.result_lines
    }
}
impl Eq for Capture {}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct CaptureWire {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    bytes: Option<Vec<u8>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    digest: String,
    complete: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    result_lines: Vec<String>,
}

impl Serialize for Capture {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let (bytes, text) = match self.form {
            Form::Text => (None, Some(String::from_utf8(self.bytes.clone()).map_err(serde::ser::Error::custom)?)),
            Form::Bytes => (Some(self.bytes.clone()), None),
        };
        CaptureWire { bytes, text, digest: self.digest.clone(), complete: self.complete, result_lines: self.result_lines.clone() }
            .serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for Capture {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let wire = CaptureWire::deserialize(deserializer)?;
        let (bytes, form) = match (wire.bytes, wire.text) {
            (Some(bytes), None) => (bytes, Form::Bytes),
            (None, Some(text)) => (text.into_bytes(), Form::Text),
            _ => return Err(serde::de::Error::custom("a capture carries exactly one of bytes or text")),
        };
        Ok(Self { bytes, digest: wire.digest, complete: wire.complete, result_lines: wire.result_lines, form })
    }
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
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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
    /// D-170: paths a commit touched outside the admitted lease, by commit. The
    /// lease is a planner's expectation, so the binary retains the difference
    /// and never refuses on it; the plan record names each path as a deviation.
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub out_of_lease: std::collections::BTreeMap<String, Vec<String>>,
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
    crate::store::Error::Invalid(format!("native-task-refusal:{}", crate::envelope::Refusal::new("task-unsatisfied", reason)
        .rule(rule).slot("checks").phase(task.phase).id(task.task.clone()).details(serde_json::json!({"unsatisfied":checks})).value()))
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
        Observation::Unknown=>records.iter().any(|r|r.request.task==*task && matches!(&r.request.event,
            super::history::Event::OwnerClassification(statement) if statement.submission.run_id==result.run_id
                && statement.submission.check==*check && statement.submission.output_identity==result.output_identity()
                && statement.submission.interpretation==if red {Interpretation::RedEligible}else{Interpretation::GreenEligible}
                && validate_classification(records,task,statement).is_ok())),
    }
}

/// The closing attempt and every predecessor it names, oldest last.
fn attempt_lineage(records: &[super::history::Record], task: &super::history::Task, attempt: &str) -> Vec<String> {
    let mut lineage=vec![attempt.to_owned()];
    let mut current=attempt.to_owned();
    while let Some(predecessor)=records.iter().find_map(|r|match &r.request.event {
        super::history::Event::Attempt {predecessor: Some(predecessor), ..} if r.request.task==*task && r.request.attempt==current=>Some(predecessor.clone()), _=>None,
    }) {
        if lineage.contains(&predecessor) {break}
        lineage.push(predecessor.clone());
        current=predecessor;
    }
    lineage
}

/// Everything `validate_pairs` needs to know about the repository, gathered
/// before it starts judging. An absent fact is a question Git could not
/// answer, and it invalidates the pair that asked it, which is what a failed
/// `git` call used to mean in the middle of the judgment.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RepositoryFacts {
    ancestry: std::collections::BTreeSet<(String, String)>,
    blobs: std::collections::BTreeMap<(String, String), String>,
    trees: std::collections::BTreeMap<String, String>,
}

impl RepositoryFacts {
    pub fn new() -> Self {
        Self::default()
    }

    /// `ancestor` is reachable from `descendant`.
    pub fn ancestor(mut self, ancestor: &str, descendant: &str) -> Self {
        self.ancestry.insert((ancestor.to_owned(), descendant.to_owned()));
        self
    }

    /// The digest of `path` as committed at `commit`.
    pub fn blob(mut self, commit: &str, path: &str, digest: &str) -> Self {
        self.blobs.insert((commit.to_owned(), path.to_owned()), digest.to_owned());
        self
    }

    /// The tree `commit` names.
    pub fn tree(mut self, commit: &str, tree: &str) -> Self {
        self.trees.insert(commit.to_owned(), tree.to_owned());
        self
    }

    fn is_ancestor(&self, ancestor: &str, descendant: &str) -> bool {
        self.ancestry.contains(&(ancestor.to_owned(), descendant.to_owned()))
    }

    fn blob_digest(&self, commit: &str, path: &str) -> Option<&str> {
        self.blobs.get(&(commit.to_owned(), path.to_owned())).map(String::as_str)
    }

    fn tree_of(&self, commit: &str) -> Option<&str> {
        self.trees.get(commit).map(String::as_str)
    }
}

/// Ask Git every question `validate_pairs` will ask, and keep the answers as
/// values. This is the boundary: it decides nothing, and a question Git
/// refuses is simply left unanswered. It has no unit test, because a test of
/// it could only hand it the answers it is here to fetch.
pub fn observe_pairs(project: &std::path::Path, records: &[super::history::Record], input: &Close, process: &mut dyn Process) -> RepositoryFacts {
    use super::{history::Event, runner::{git,git_text}};
    let mut facts=RepositoryFacts::new();
    let test_file=|run: &str| records.iter().find_map(|r|match &r.request.event {
        Event::Launch(launch) if r.request.task==input.task && launch.run_id==run=>Some(launch.material.test_file.clone()), _=>None,
    });
    let mut ask_ancestor=|facts: &mut RepositoryFacts, ancestor: &str, descendant: &str| {
        if git(project,&["merge-base","--is-ancestor",ancestor,descendant], process).is_ok() {
            *facts=std::mem::take(facts).ancestor(ancestor,descendant);
        }
    };
    for pair in &input.checks {
        ask_ancestor(&mut facts,&pair.red_commit,&pair.green_commit);
        ask_ancestor(&mut facts,&pair.green_commit,&input.completion);
    }
    for pair in &input.checks {
        for (commit,run) in [(&pair.red_commit,&pair.red_run),(&pair.green_commit,&pair.green_run),(&input.completion,&pair.green_run)] {
            let Some(path)=test_file(run) else { continue };
            if let Ok(bytes)=git(project,&["show",&format!("{commit}:{path}")], process) {
                facts=facts.blob(commit,&path,&crate::store::model::digest(&bytes));
            }
        }
        for commit in [&pair.red_commit,&pair.green_commit] {
            if let Ok(tree)=git_text(project,&["rev-parse",&format!("{commit}^{{tree}}")], process) {
                facts=facts.tree(commit,&tree);
            }
        }
    }
    facts
}

pub fn validate_pairs(data: &serde_json::Value, records: &[super::history::Record], input: &Close, facts: &RepositoryFacts) -> crate::store::Result<()> {
    use super::history::Event;
    let checks=allocated(data,&input.task)?;
    // A task that stopped at a checkpoint resumes in a successor attempt that
    // names its predecessor. Its red runs stay where they were recorded, so a
    // pair may take its red from any attempt in the closing attempt's lineage.
    let lineage=attempt_lineage(records,&input.task,&input.attempt);
    let mut invalid=Vec::new();
    for check in &checks {
        let matching:Vec<_>=input.checks.iter().filter(|p|p.check==*check).collect();
        let valid=matching.len()==1 && (|| -> Option<()> {
            let pair=matching[0];
            if pair.red_commit==pair.green_commit || !crate::rail::risk::valid_object_id(&pair.red_commit)
                || !crate::rail::risk::valid_object_id(&pair.green_commit) {return None}
            let get=|id:&str,red:bool| {
                let (position,record)=records.iter().enumerate().find(|(_,r)|r.request.task==input.task && lineage.contains(&r.request.attempt)
                    && matches!(&r.request.event,Event::Launch(l) if l.run_id==id))?;
                let Event::Launch(launch)=&record.request.event else {return None};
                let result=records.iter().find_map(|r|match &r.request.event {
                    Event::Result(result) if r.request.task==input.task && r.request.attempt==record.request.attempt && result.run_id==id=>Some(result), _=>None,
                })?;
                if launch.check.as_ref()!=Some(check) || launch.stage!=if red {Stage::Red}else{Stage::Green}
                    || !run_eligible(records,&input.task,result,check,red) {return None}
                Some((position,launch,result))
            };
            let (ri,red,red_result)=get(&pair.red_run,true)?;
            let (gi,green,_)=get(&pair.green_run,false)?;
            if ri>=gi || red_result.observed_at>green.launched_at || red.material.commit!=pair.red_commit || green.material.commit!=pair.green_commit
                || red.material.test_file!=green.material.test_file || red.material.test_digest!=green.material.test_digest || red.material.command!=green.material.command {return None}
            if !facts.is_ancestor(&pair.red_commit,&pair.green_commit) || !facts.is_ancestor(&pair.green_commit,&input.completion) {return None}
            for (commit,material) in [(&pair.red_commit,&red.material),(&pair.green_commit,&green.material)] {
                if facts.blob_digest(commit,&material.test_file)?!=material.test_digest
                    || facts.tree_of(commit)?!=material.tree {return None}
            }
            if facts.blob_digest(&input.completion,&green.material.test_file)?!=green.material.test_digest {return None}
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

pub fn validate_close(data: &serde_json::Value, records: &[super::history::Record], proof: &CloseProof, process: &mut dyn Process) -> crate::store::Result<()> {
    let input=&proof.submission;
    let facts=observe_pairs(&proof.project,records,input, process);
    validate_pairs(data,records,input,&facts)?;
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
    reobserve_source(&proof.project,&proof.dispatch,&input.task.task,&proof.source, process)
}

pub fn validate_close_owner(data: &serde_json::Value, records: &[super::history::Record], input: &Close) -> crate::store::Result<()> {
    let missing=missing_owner_inspections(data,records,input)?;
    if !missing.is_empty() {return Err(unsatisfied(&input.task,"owner-attestation",missing,"each admitted check requires an affirmative exact owner inspection; executor assertions do not satisfy this record gate"));}
    Ok(())
}

/// Shared by plan completion and the retained per-task verification gate.
/// Match the latest inspection against the exact pair named by the close.
pub(super) fn missing_owner_inspections(data: &serde_json::Value, records: &[super::history::Record], input: &Close) -> crate::store::Result<Vec<Check>> {
    use super::history::Event;
    let mut missing=Vec::new();
    for check in allocated(data,&input.task)? {
        let pair=input.checks.iter().find(|p|p.check==check);
        let statement=records.iter().rev().find_map(|r|match &r.request.event {
            Event::OwnerStatement(statement) if r.request.task==input.task && statement.submission.check.id==check.id=>Some(statement), _=>None,
        });
        let exact=pair.zip(statement).is_some_and(|(pair,statement)| {
            let material=records.iter().find_map(|r|match &r.request.event {
                Event::Launch(launch) if r.request.task==input.task && launch.run_id==pair.green_run=>Some(&launch.material), _=>None,
            });
            material.is_some_and(|material|owner_eligible(statement,&check,&material.test_digest,&[pair.red_run.clone(),pair.green_run.clone()])
                && validate_inspection(records,&input.task,statement).is_ok())
        });
        if !exact {missing.push(check);}
    }
    Ok(missing)
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

pub fn commit_paths(project: &std::path::Path, commit: &str, process: &mut dyn Process) -> crate::store::Result<Vec<String>> {
    use super::runner::{git, git_text};
    use crate::store::Error;
    let parents = git_text(project, &["show", "-s", "--format=%P", commit], process)?;
    let parents: Vec<_> = parents.split_whitespace().collect();
    let mut paths = std::collections::BTreeSet::new();
    for parent in parents.iter().copied().map(Some).chain(parents.is_empty().then_some(None)) {
        let mut args = vec!["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-z", "-M", "--no-ext-diff", "--no-textconv"];
        if let Some(parent) = parent { args.push(parent); }
        args.extend([commit, "--"]);
        paths.extend(read_name_status(&git(project, &args, process)?).map_err(Error::Invalid)?);
    }
    Ok(paths.into_iter().collect())
}

pub fn staged(project: &std::path::Path, process: &mut dyn Process) -> crate::store::Result<(Vec<u8>, Vec<String>)> {
    use super::runner::git;
    let args = ["diff", "--cached", "--raw", "-z", "-M", "--no-abbrev", "--no-ext-diff", "--no-textconv", "--"];
    let objects = git(project, &args, process)?;
    let paths = read_name_status(&git(project, &["diff", "--cached", "--name-status", "-z", "-M", "--no-ext-diff", "--no-textconv", "--"], process)? )
        .map_err(crate::store::Error::Invalid)?;
    if git(project, &args, process)? != objects { return Err(crate::store::Error::Conflict("staged inputs changed during observation".into())); }
    Ok((objects, paths))
}

/// What Git says about the commits a close offers, gathered before anything is
/// judged about them. Absence is an answer: a commit missing from `present` is
/// one Git would not read as a commit, and one missing from `after_base` is one
/// Git would not place after the dispatch base.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SourceObservation {
    present: std::collections::BTreeSet<String>,
    after_base: std::collections::BTreeSet<String>,
    reachable_from_head: std::collections::BTreeSet<String>,
    paths: std::collections::BTreeMap<String, Vec<String>>,
    signed_completion: bool,
    completion_subject: String,
    staged_objects: Vec<u8>,
    staged_paths: Vec<String>,
}

impl SourceObservation {
    pub fn new() -> Self {
        Self::default()
    }

    /// Git read this commit, placed it after the dispatch base, reached it from
    /// HEAD, and reported these paths for it.
    pub fn commit(mut self, commit: &str, paths: &[&str]) -> Self {
        self.present.insert(commit.to_owned());
        self.after_base.insert(commit.to_owned());
        self.reachable_from_head.insert(commit.to_owned());
        self.paths.insert(commit.to_owned(), paths.iter().map(|path| (*path).to_owned()).collect());
        self
    }

    /// Git could not read this commit at all.
    pub fn absent(mut self, commit: &str) -> Self {
        self.present.remove(commit);
        self
    }

    /// Git read this commit but would not place it after the dispatch base.
    pub fn before_the_base(mut self, commit: &str) -> Self {
        self.after_base.remove(commit);
        self
    }

    /// Git read this commit but could not reach it from HEAD.
    pub fn unreachable(mut self, commit: &str) -> Self {
        self.reachable_from_head.remove(commit);
        self
    }

    pub fn completion_subject(mut self, subject: &str) -> Self {
        self.completion_subject = subject.to_owned();
        self
    }

    pub fn signed(mut self, signed: bool) -> Self {
        self.signed_completion = signed;
        self
    }

    pub fn staged(mut self, objects: &[u8], paths: &[&str]) -> Self {
        self.staged_objects = objects.to_vec();
        self.staged_paths = paths.iter().map(|path| (*path).to_owned()).collect();
        self
    }
}

/// Ask Git about the commits this close offers. This is the boundary: it makes
/// no judgment, a question Git refuses is recorded as an unanswered one, and it
/// has no unit test, because a test of it could only hand it the answers it
/// exists to fetch. A malformed identifier is never handed to Git at all, since
/// `judge_source` refuses it on its shape.
pub fn observe_repository_source(project: &std::path::Path, active: &super::model::ActiveDispatch,
    completion: &str, evidence: &[String], process: &mut dyn Process,) -> crate::store::Result<SourceObservation> {
    use super::runner::{git, git_text};
    use crate::rail::risk::valid_object_id;
    let mut observation = SourceObservation::new();
    let head = git_text(project, &["rev-parse", "HEAD"], process)?;
    for commit in evidence.iter().map(String::as_str).chain(std::iter::once(completion)) {
        if !valid_object_id(commit) { continue }
        if git(project, &["cat-file", "-e", &format!("{commit}^{{commit}}")], process).is_ok() {
            observation.present.insert(commit.to_owned());
        }
        if git(project, &["merge-base", "--is-ancestor", &active.base_sha, commit], process).is_ok() {
            observation.after_base.insert(commit.to_owned());
        }
        if git(project, &["merge-base", "--is-ancestor", commit, &head], process).is_ok() {
            observation.reachable_from_head.insert(commit.to_owned());
        }
        if let Ok(paths) = commit_paths(project, commit, process) {
            observation.paths.insert(commit.to_owned(), paths);
        }
    }
    observation.signed_completion = git(project, &["verify-commit", completion], process).is_ok();
    observation.completion_subject = git_text(project, &["show", "-s", "--format=%s", completion], process).unwrap_or_default();
    let (objects, paths) = staged(project, process)?;
    observation.staged_objects = objects;
    observation.staged_paths = paths;
    Ok(observation)
}

/// Judge what Git said. Every refusal here is a rule of ours over values.
pub fn judge_source(active: &super::model::ActiveDispatch, task_id: &str, completion: &str,
    evidence: &[String], observation: &SourceObservation,) -> crate::store::Result<SourceMaterial> {
    use crate::{rail::risk::valid_object_id, store::Error};
    let mut observed = std::collections::BTreeMap::new();
    let mut out_of_lease = std::collections::BTreeMap::new();
    for commit in evidence.iter().map(String::as_str).chain(std::iter::once(completion)) {
        if !valid_object_id(commit) || commit == active.base_sha {
            return Err(Error::Invalid("evidence commit requires a full object id strictly after the dispatch base".into()));
        }
        if !observation.present.contains(commit) || !observation.after_base.contains(commit)
            || !observation.reachable_from_head.contains(commit) {
            return Err(Error::Invalid("evidence commit must be a commit after the dispatch base and reachable from HEAD".into()));
        }
        let paths = observation.paths.get(commit)
            .ok_or_else(|| Error::Invalid("evidence commit reported no paths".to_owned()))?.clone();
        let outside: Vec<String> = paths.iter()
            .filter(|path| !super::lease::covers(&active.files, &active.directories, path)).cloned().collect();
        if !outside.is_empty() { out_of_lease.insert(commit.to_owned(), outside); }
        observed.insert(commit.to_owned(), paths);
    }
    if !observation.signed_completion {
        return Err(Error::Invalid("completion commit requires a valid signature".into()));
    }
    if !conventional_subject(&observation.completion_subject, task_id) {
        return Err(Error::Invalid("completion subject must name its task conventionally".into()));
    }
    for path in &observation.staged_paths {
        if !super::lease::covers(&active.files, &active.directories, path) {
            return Err(super::admission::refuse(active.phase, "lease", "staged", path, "out-of-lease staged path"));
        }
    }
    Ok(SourceMaterial { completion: completion.into(), evidence_commits: evidence.to_vec(), commit_paths: observed,
        out_of_lease, staged_objects: observation.staged_objects.clone(), staged_paths: observation.staged_paths.clone() })
}

pub fn observe_source(project: &std::path::Path, active: &super::model::ActiveDispatch, task_id: &str,
    completion: &str, evidence: &[String],
    process: &mut dyn Process,) -> crate::store::Result<SourceMaterial> {
    let observation = observe_repository_source(project, active, completion, evidence, process)?;
    judge_source(active, task_id, completion, evidence, &observation)
}

pub fn reobserve_source(project: &std::path::Path, active: &super::model::ActiveDispatch, task_id: &str, expected: &SourceMaterial, process: &mut dyn Process) -> crate::store::Result<()> {
    source_unchanged(&observe_source(project, active, task_id, &expected.completion, &expected.evidence_commits, process)?, expected)
}

/// A retained close's source still stands only when a fresh observation finds
/// exactly the material it retained.
pub fn source_unchanged(fresh: &SourceMaterial, retained: &SourceMaterial) -> crate::store::Result<()> {
    if fresh != retained {
        return Err(crate::store::Error::Conflict("native source or staged inputs changed".into()));
    }
    Ok(())
}

#[cfg(test)]
mod capture_tests {
    use super::*;
    use crate::{execution::history::{Event, Record, request_digest}, store::model::digest};
    use serde_json::json;

    // A run result retained on this project on 2026-09-15, from
    // `.planning/decisions.jsonl`, verbatim: its captures are integer arrays.
    const RETAINED: &str = r#"{"schema":"native-task-event-1","root_binding":"36:603670;36:396349;36:220748;36:256;","version":3,"request_digest":"f6bc8aa6eaa107484b737076907f3c715229ae5723e66ee6684147e9491f444c","request":{"request_id":"p31-10-t1-verify-1:result","task":{"phase":31,"occurrence":"active-cycle:phase:31","admission_digest":"7be8edb5505ea7f40c044cf6c8f9e4575abd1ae777b40d8b81a815cce02d3deb","plan":10,"task":"P31-10-T1"},"attempt":"p31-10-t1-a1","expected_version":2,"event":{"kind":"result","run_id":"p31-10-t1-verify-1","disposition":{"kind":"exited","code":0},"stdout":{"bytes":[],"digest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","complete":true},"stderr":{"bytes":[32,32,32,32,70,105,110,105,115,104,101,100,32,96,100,101,118,96,32,112,114,111,102,105,108,101,32,91,117,110,111,112,116,105,109,105,122,101,100,32,43,32,100,101,98,117,103,105,110,102,111,93,32,116,97,114,103,101,116,40,115,41,32,105,110,32,48,46,48,53,115,10],"digest":"ee1d3fffa2022e962e63e0dbe4d35c9c198450a20c29fc09030f635dbb38bfcd","complete":true},"observed_at":1789509454823,"observation":{"class":"unknown"},"material_unchanged":true}}}"#;

    // GH-263 part 2 under D-175's rule. A capture read as `bytes` is written
    // back as `bytes`, so a retained record keeps its digest preimage. A new
    // capture is `text` when its bytes are UTF-8 and `bytes` otherwise, and a
    // capture read as `text` is written back as `text`. Both forms at once,
    // neither, or an unknown field is refused.
    #[test]
    fn a_retained_bytes_record_reserializes_identically_and_keeps_its_request_digest() {
        let record: Record = serde_json::from_str(RETAINED).unwrap();
        assert_eq!(request_digest(&record.request).unwrap(), record.request_digest);
        assert_eq!(serde_json::to_value(&record).unwrap(), serde_json::from_str::<serde_json::Value>(RETAINED).unwrap());
        let Event::Result(result) = &record.request.event else { panic!("{RETAINED}") };
        assert_eq!(result.stderr.bytes, b"    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.05s\n");
    }

    #[test]
    fn a_new_capture_is_text_with_its_result_lines_when_utf8_and_bytes_otherwise() {
        let fresh = super::super::runner::capture(&b"test result: ok. 1 passed; 0 failed\n"[..]);
        assert_eq!(serde_json::to_value(&fresh).unwrap(), json!({"text":"test result: ok. 1 passed; 0 failed\n","digest":digest(b"test result: ok. 1 passed; 0 failed\n"),
            "complete":true,"result_lines":["test result: ok. 1 passed; 0 failed"]}));
        let binary = super::super::runner::capture(&[0xff, 0xfe, b'\n'][..]);
        assert_eq!(serde_json::to_value(&binary).unwrap(), json!({"bytes":[255,254,10],"digest":digest(&[0xff,0xfe,10]),"complete":true}));
    }

    #[test]
    fn a_capture_read_as_text_is_written_back_as_text() {
        let written = json!({"text":"test result: ok. 1 passed; 0 failed\n","digest":digest(b"test result: ok. 1 passed; 0 failed\n"),
            "complete":true,"result_lines":["test result: ok. 1 passed; 0 failed"]});
        let read: Capture = serde_json::from_value(written.clone()).unwrap();
        assert_eq!(read.bytes, b"test result: ok. 1 passed; 0 failed\n");
        assert_eq!(serde_json::to_value(&read).unwrap(), written, "a capture read as text is written as text");
    }

    #[test]
    fn a_capture_with_both_forms_neither_or_an_unknown_field_does_not_parse() {
        for bad in [json!({"bytes":[],"text":"","digest":digest(b""),"complete":true}),
                    json!({"digest":digest(b""),"complete":true}),
                    json!({"text":"x","digest":digest(b"x"),"complete":true,"extra":1})] {
            assert!(serde_json::from_value::<Capture>(bad.clone()).is_err(), "{bad}");
        }
    }
}
