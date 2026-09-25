//! Explicit release observations and a confirmed participant of the sole journal.
use crate::process::Process;
use super::model::{self, Receipt};
use crate::{landing::model::Landing, rail::{branch, commit, git}, store::{Error, Result, model::digest}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{cmp::Ordering, collections::BTreeMap, fs, io::{Read, Write}, os::unix::fs::{OpenOptionsExt, PermissionsExt}, path::{Component, Path, PathBuf}};

pub const NAMESPACE: &str = "milestone_releases";
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Manifest { pub path: String, pub format: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub request_id: String, pub landing: String, pub expected_generation: u64,
    pub version: String, pub tag: String, pub manifest: Manifest,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Confirm { pub request_id: String, pub release: String, pub digest: String, pub owner: String, pub at: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Tag { pub tag: String, pub object: String, pub commit: String, pub version: Option<String> }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Report {
    pub id: String, pub digest: String, pub root_binding: String, pub request: Request,
    pub state: String, pub manifest_bytes: Vec<u8>, pub manifest_version: String,
    pub head: String, pub tags: Vec<Tag>, pub newest: Option<Tag>, pub drift: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Intent {
    pub release: String, pub digest: String, pub version: String, pub tag: String,
    pub manifest: Manifest, pub manifest_bytes: Vec<u8>, pub commit: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WriteSeal {
    pub report: Report, pub confirmation: Confirm, pub after: Vec<u8>, pub mode: u32,
    pub git: commit::Seal, pub guards: BTreeMap<PathBuf, Option<Vec<u8>>>,
    pub protected: Vec<String>, pub on_protected: String,
}

// Decimal components compare by length then bytes, with no machine integer limit.
#[derive(Clone, Debug, PartialEq, Eq)]
struct Version { core: Vec<String>, pre: Vec<String> }
fn numeric(s: &str) -> bool { !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()) }
fn decimal(s: &str) -> bool { numeric(s) && (s == "0" || !s.starts_with('0')) }
fn identifiers(s: &str) -> bool {
    s.split('.').all(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'))
}
fn version(s: &str) -> Option<Version> {
    let (s, build) = s.split_once('+').map_or((s, None), |(s,b)| (s,Some(b)));
    if build.is_some_and(|b| !identifiers(b)) { return None; }
    let (core, pre) = s.split_once('-').map_or((s, None), |(s,p)| (s,Some(p)));
    let core: Vec<_> = core.split('.').map(str::to_owned).collect();
    if core.len() != 3 || !core.iter().all(|s| decimal(s)) { return None; }
    if pre.is_some_and(|p| !identifiers(p) || p.split('.').any(|s| numeric(s) && !decimal(s))) { return None; }
    Some(Version { core, pre: pre.map_or_else(Vec::new, |p| p.split('.').map(str::to_owned).collect()) })
}
fn number_cmp(a: &str, b: &str) -> Ordering { a.len().cmp(&b.len()).then_with(|| a.cmp(b)) }
impl Ord for Version {
    fn cmp(&self, other: &Self) -> Ordering {
        for (a,b) in self.core.iter().zip(&other.core) { let order = number_cmp(a,b); if order != Ordering::Equal { return order; } }
        match (self.pre.is_empty(), other.pre.is_empty()) {
            (true,false) => return Ordering::Greater, (false,true) => return Ordering::Less, _ => {},
        }
        for (a,b) in self.pre.iter().zip(&other.pre) {
            let order = match (numeric(a), numeric(b)) { (true,true)=>number_cmp(a,b), (true,false)=>Ordering::Less,
                (false,true)=>Ordering::Greater, _=>a.cmp(b) };
            if order != Ordering::Equal { return order; }
        }
        self.pre.len().cmp(&other.pre.len())
    }
}
impl PartialOrd for Version { fn partial_cmp(&self, other: &Self) -> Option<Ordering> { Some(self.cmp(other)) } }

pub fn tags(project: &Path, process: &mut dyn Process) -> Result<Vec<Tag>> {
    let bytes = git::run(project, ["for-each-ref", "--format=%(refname) %(objectname)", "refs/tags/"], process)?;
    let text = String::from_utf8(bytes).map_err(|e| Error::Invalid(e.to_string()))?;
    text.lines().map(|row| {
        let (name, object) = row.split_once(' ').ok_or_else(|| Error::Invalid("invalid tag inventory".into()))?;
        let tag = name.strip_prefix("refs/tags/").ok_or_else(|| Error::Invalid("invalid tag ref".into()))?;
        let normalized = tag.strip_prefix('v').unwrap_or(tag);
        let release = version(normalized).map(|_| normalized.to_owned());
        // A ref that cannot peel is a failed read, never an empty inventory.
        Ok(Tag { tag:tag.into(), object:object.into(), commit:git::resolve_commit(project,name, process)?, version:release })
    }).collect()
}
pub fn collision<'a>(tags: &'a [Tag], proposed: &str, tag: &str) -> Option<&'a Tag> {
    let proposed = version(proposed);
    tags.iter().find(|t| t.tag == tag || t.version.as_deref().and_then(version).is_some_and(|v| Some(v) == proposed))
}
fn path(project: &Path, manifest: &Manifest) -> Result<PathBuf> {
    if manifest.format != "json" { return Err(Error::Invalid(format!("{}: unsupported manifest format {}",manifest.path,manifest.format))); }
    let relative = Path::new(&manifest.path);
    if manifest.path.is_empty() || relative.components().any(|c| !matches!(c,Component::Normal(_)))
        || relative.starts_with(".git") || relative.starts_with(".planning") {
        return Err(Error::Invalid(format!("{}: manifest must be a contained project file",manifest.path)));
    }
    let full = project.join(relative);
    for ancestor in full.ancestors().take_while(|p| *p != project) {
        let metadata = fs::symlink_metadata(ancestor).map_err(|e| Error::Io(format!("{}: {e}", manifest.path)))?;
        if metadata.file_type().is_symlink() { return Err(Error::Invalid(format!("{}: symlink manifest path",manifest.path))); }
    }
    Ok(full)
}
fn manifest(project: &Path, input: &Manifest) -> Result<(Vec<u8>, String)> {
    let full = path(project,input)?;
    let mut file = fs::OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW).open(full)
        .map_err(|e| Error::Io(format!("{}: {e}",input.path)))?;
    if !file.metadata()?.is_file() { return Err(Error::Invalid(format!("{}: not a regular manifest",input.path))); }
    let mut bytes = Vec::new(); file.read_to_end(&mut bytes)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|e| Error::Invalid(format!("{}: {e}",input.path)))?;
    let v = value.get("version").and_then(Value::as_str).filter(|v| version(v).is_some())
        .ok_or_else(|| Error::Invalid(format!("{}: JSON manifest needs an existing semantic version string",input.path)))?;
    Ok((bytes.clone(),v.into()))
}
pub fn landing(data: &Value, binding: &str, request: &Request, head: &str) -> Result<Landing> {
    let records = model::records::<Landing>(data,"landings")?;
    let landing = records.records.get(&request.landing).ok_or_else(|| Error::Invalid("release landing missing".into()))?;
    if landing.root_binding != binding || landing.generation != request.expected_generation || landing.source.head != head
        || landing.release.is_some() || !landing.authorizations.is_empty() || landing.merge_confirmation.is_some()
        || landing.steps.iter().any(|s| s.receipt.is_some() || s.intent.is_some() || s.local_intent.is_some()) {
        return Err(Error::Conflict("release needs the exact unstarted landing and source HEAD".into()));
    }
    Ok(landing.clone())
}
pub fn observe(project: &Path, binding: &str, request: Request, process: &mut dyn Process) -> Result<Report> {
    for s in [&request.request_id,&request.landing,&request.version,&request.tag] { model::name(s)?; }
    if version(&request.version).is_none() || request.tag != format!("v{}",request.version) {
        return Err(Error::Invalid("release requires a semantic version and its exact v-prefixed tag".into()));
    }
    git::run(project,["check-ref-format",&format!("refs/tags/{}",request.tag)], process)?;
    let tags = tags(project, process)?;
    let (manifest_bytes,manifest_version) = manifest(project,&request.manifest)?;
    let newest = tags.iter().filter_map(|t| Some((version(t.version.as_deref()?)?,t)))
        .max_by(|(a,ta),(b,tb)| a.cmp(b).then_with(|| ta.tag.cmp(&tb.tag))).map(|(_,t)| t.clone());
    let drift = newest.as_ref().is_some_and(|t| version(t.version.as_deref().unwrap()) != version(&manifest_version));
    let mut report = Report { id:model::identity("release",binding,&request.request_id), digest:String::new(), root_binding:binding.into(),
        request,state:"awaiting-confirmation".into(),manifest_bytes,manifest_version,head:git::resolve_commit(project,"HEAD", process)?,tags,newest,drift };
    report.digest = report_digest(&report)?;
    Ok(report)
}
fn report_digest(report: &Report) -> Result<String> {
    let mut copy = report.clone(); copy.digest.clear(); Ok(digest(&serde_json::to_vec(&copy)?))
}
pub fn reobserve(project: &Path, report: &Report, process: &mut dyn Process) -> Result<()> {
    if observe(project,&report.root_binding,report.request.clone(), process)? != *report {
        return Err(Error::Conflict("observed manifest bytes, tag inventory or HEAD changed".into()));
    }
    Ok(())
}
fn guard_bytes(path: &Path) -> Result<Option<Vec<u8>>> {
    match fs::read(path) { Ok(b)=>Ok(Some(b)),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(None),Err(e)=>Err(e.into()) }
}
pub fn freeze(root: &Path, report: Report, confirmation: Confirm, protected: Vec<String>, on_protected: String, process: &mut dyn Process) -> Result<WriteSeal> {
    let project = root.parent().ok_or_else(|| Error::Invalid("missing release project".into()))?;
    reobserve(project,&report, process)?;
    let reference = String::from_utf8(git::run(project,["symbolic-ref","--short","HEAD"], process)?).map_err(|e| Error::Invalid(e.to_string()))?;
    if branch::permission(&protected,&on_protected,reference.trim())? != branch::Permission::Pass { return Err(Error::Policy("release bump requires branch permission".into())); }
    let mut document: Value = serde_json::from_slice(&report.manifest_bytes)?;
    document["version"] = json!(report.request.version);
    let mut after = serde_json::to_vec_pretty(&document)?; after.push(b'\n');
    let changes = BTreeMap::from([(report.request.manifest.path.clone(),Some(after.clone()))]);
    let git = commit::freeze_message(project,&changes,&[],&format!("chore(release): bump version to {}\n\nRecord the owner-confirmed release version before landing.\n",report.request.version), process)?;
    let mode = fs::metadata(path(project,&report.request.manifest)?)?.permissions().mode();
    let mut guards = BTreeMap::new();
    for path in [root.join("config.json"),root.join("config.v4.json")].into_iter().chain(std::env::var_os("CADENCE_GLOBAL_CONFIG").filter(|v| !v.is_empty()).map(PathBuf::from)) {
        guards.insert(path.clone(),guard_bytes(&path)?);
    }
    Ok(WriteSeal {report,confirmation,after,mode,git,guards,protected,on_protected})
}
pub fn intent(write: &WriteSeal) -> Intent {
    Intent {release:write.report.id.clone(),digest:write.report.digest.clone(),version:write.report.request.version.clone(),
        tag:write.report.request.tag.clone(),manifest:write.report.request.manifest.clone(),manifest_bytes:write.after.clone(),commit:write.git.commit.id.clone()}
}
pub fn answer(write: &WriteSeal) -> Value {
    json!({"status":"ok","release":intent(write),"commit":write.git.commit.id,"confirmation":write.confirmation,"next":"land-read; tagging requires separate merge confirmation and ordered cleanup"})
}
pub fn contribute(data: &Value, write: &WriteSeal) -> Result<Value> {
    let report = &write.report;
    let mut records = model::records::<Report>(data,NAMESPACE)?;
    if records.records.get(&report.id) != Some(report) || report.digest != report_digest(report)?
        || write.confirmation.release != report.id || write.confirmation.digest != report.digest
        || write.git.parent != report.head || model::reused(&records,&report.root_binding,&write.confirmation.request_id) {
        return Err(Error::Conflict("release seal differs from its retained report".into()));
    }
    for s in [&write.confirmation.request_id,&write.confirmation.owner,&write.confirmation.at] { model::name(s)?; }
    let mut document: Value = serde_json::from_slice(&report.manifest_bytes)?;
    document["version"] = json!(report.request.version);
    if serde_json::from_slice::<Value>(&write.after)? != document || collision(&report.tags,&report.request.version,&report.request.tag).is_some() {
        return Err(Error::Invalid("release write differs from confirmed version".into()));
    }
    let mut bound = landing(data,&report.root_binding,&report.request,&report.head)?;
    if write.git.reference != format!("refs/heads/{}", bound.source.branch) {
        return Err(Error::Conflict("release branch differs from the pending landing source".into()));
    }
    bound.source.head = write.git.commit.id.clone(); bound.generation += 1; bound.release = Some(intent(write));
    let mut landings = model::records::<Landing>(data,"landings")?;
    landings.records.insert(bound.id.clone(),bound);
    let raw = serde_json::to_value(&write.confirmation)?;
    records.receipts.insert(model::request_key(&report.root_binding,&raw)?,Receipt {root_binding:report.root_binding.clone(),
        request_id:write.confirmation.request_id.clone(),request:raw,answer:answer(write)});
    let mut next = data.clone();
    next[NAMESPACE] = serde_json::to_value(records)?; next["landings"] = serde_json::to_value(landings)?;
    Ok(next)
}
pub fn validate(root: &Path, write: &WriteSeal, replay: bool, process: &mut dyn Process) -> Result<()> {
    if crate::verification::inputs::root_binding(root)? != write.report.root_binding { return Err(Error::Conflict("release root changed".into())); }
    let project = root.parent().ok_or_else(|| Error::Invalid("missing release project".into()))?;
    for (path,bytes) in &write.guards { if guard_bytes(path)? != *bytes { return Err(Error::Conflict("release branch policy changed".into())); } }
    commit::validate(project,&write.git,replay, process)?;
    if tags(project, process)? != write.report.tags { return Err(Error::Conflict("release tag inventory changed".into())); }
    let (bytes,_) = manifest(project,&write.report.request.manifest)?;
    if bytes != write.report.manifest_bytes && !(replay && bytes == write.after) { return Err(Error::Conflict("release manifest bytes changed".into())); }
    if branch::permission(&write.protected,&write.on_protected,write.git.reference.trim_start_matches("refs/heads/"))? != branch::Permission::Pass {
        return Err(Error::Policy("release branch permission required".into()));
    }
    Ok(())
}
pub fn install(root: &Path, write: &WriteSeal, process: &mut dyn Process) -> Result<()> {
    validate(root,write,true, process)?;
    let project = root.parent().unwrap();
    let target = path(project,&write.report.request.manifest)?;
    if fs::read(&target)? != write.after {
        let temporary = target.with_file_name(format!(".cadence-release-{}",write.report.digest));
        // A retained journal may recover an interrupted temporary write.
        if temporary.exists() { fs::remove_file(&temporary)?; }
        let mut file = fs::OpenOptions::new().write(true).create_new(true).mode(write.mode).open(&temporary)?;
        file.write_all(&write.after)?; file.sync_all()?;
        validate(root,write,true, process)?;
        fs::rename(&temporary,&target)?; fs::File::open(target.parent().unwrap())?.sync_all()?;
    }
    commit::install(project,&write.git,&mut |process: &mut dyn Process| validate(root,write,true,process), process)?;
    validate(root,write,true, process)
}
pub fn validate_tag(project: &Path, intent: &Intent, tag: &str, process: &mut dyn Process) -> Result<()> {
    if tag != intent.tag { return Err(Error::Conflict("landing tag differs from confirmed release intent".into())); }
    let (bytes,v) = manifest(project,&intent.manifest)?;
    if bytes != intent.manifest_bytes || v != intent.version { return Err(Error::Conflict("pulled release manifest differs from confirmed bump".into())); }
    git::run(project,["merge-base","--is-ancestor",&intent.commit,"HEAD"], process)?;
    if let Some(existing) = collision(&tags(project, process)?,&intent.version,tag) {
        return Err(Error::Conflict(format!("release tag collision: {}",existing.tag)));
    }
    Ok(())
}
