//! Typed guard receipts; the writer admits only this projection without policy.
use super::super::model::{self, Decision, DecisionRecord, Evidence, Origin, Snapshot, VERSION};
use super::super::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::path::PathBuf;

pub fn event_identity(session: Option<&str>, tool_use: Option<&str>) -> String {
    if let Some(id) = tool_use.filter(|id| !id.is_empty()) {
        return model::digest(&serde_json::to_vec(&(session, id)).expect("event identity"));
    }
    static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let sequence = SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("invocation:{}:{time}:{sequence}", std::process::id())
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verb {
    Commit,
    Push,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Ask,
    Deny,
    Pass,
    FailurePass,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Unavailable {
    pub input: String,
    pub reason: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PolicyEvidence {
    pub complete: bool,
    pub provenance: BTreeMap<String, String>,
    pub protected: Vec<String>,
    pub on_protected: String,
    pub hard_fail: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Audit {
    pub event_id: String,
    pub command_digest: String,
    pub cwd: PathBuf,
    pub project: PathBuf,
    pub verb: Verb,
    pub branch: Option<String>,
    pub policy: Option<Box<PolicyEvidence>>,
    pub outcome: Outcome,
    pub unavailable: Vec<Unavailable>,
    pub reason: String,
}
impl Audit {
    pub fn validate(&self) -> Result<()> {
        if self.event_id.trim().is_empty()
            || self.command_digest.len() != 64
            || !self.command_digest.bytes().all(|b| b.is_ascii_hexdigit())
            || !self.cwd.is_absolute()
            || !self.project.is_absolute()
            || self.reason.trim().is_empty()
            || self
                .unavailable
                .iter()
                .any(|u| u.input.is_empty() || u.reason.is_empty())
            || self
                .policy
                .as_ref()
                .is_some_and(|p| !matches!(p.on_protected.as_str(), "ask" | "refuse" | "allow"))
            || serde_json::to_vec(self)?.len() > 65_536
        {
            return Err(Error::Invalid("invalid guard audit payload".into()));
        }
        Ok(())
    }
    pub fn id(&self) -> Result<String> {
        Ok(format!(
            "guard:{}",
            model::digest(&serde_json::to_vec(&(&self.project, &self.event_id))?)
        ))
    }
    pub fn record(&self) -> Result<DecisionRecord> {
        self.validate()?;
        let evidence = Evidence::Text(serde_json::to_string(self)?);
        Ok(DecisionRecord {
            version: VERSION,
            id: self.id()?,
            revision: 1,
            origin: Origin {
                source: "bash-guard".into(),
                original: Evidence::Missing,
            },
            decision: if self.outcome == Outcome::Deny {
                Decision::Refusal {
                    reason: self.reason.clone(),
                    evidence,
                }
            } else {
                Decision::Gate {
                    outcome: match self.outcome {
                        Outcome::Ask => "ask",
                        Outcome::Pass => "pass",
                        Outcome::FailurePass => "guard-failure",
                        Outcome::Deny => unreachable!(),
                    }
                    .into(),
                    evidence,
                }
            },
        })
    }
    pub fn same_event(&self, other: &Self) -> bool {
        self.event_id == other.event_id
            && self.command_digest == other.command_digest
            && self.cwd == other.cwd
            && self.project == other.project
            && self.verb == other.verb
    }
}
pub fn from_record(record: &DecisionRecord) -> Result<Audit> {
    let evidence = match &record.decision {
        Decision::Gate { evidence, .. } | Decision::Refusal { evidence, .. } => evidence,
        _ => return Err(Error::Invalid("not a guard decision".into())),
    };
    let Evidence::Text(text) = evidence else {
        return Err(Error::Invalid("guard receipt lacks evidence".into()));
    };
    let audit: Audit = serde_json::from_str(text)?;
    if audit.record()? != *record {
        return Err(Error::Invalid(
            "guard receipt differs from its evidence".into(),
        ));
    }
    Ok(audit)
}
pub fn audit_only(snapshot: &Snapshot) -> bool {
    snapshot.data.get("import").is_none()
        && snapshot.data["guard_audit"]["initialization"] == "audit-only"
}
pub fn project(snapshot: &Snapshot, audit: &Audit) -> Result<Value> {
    let mut data = if snapshot.data.is_null() && snapshot.generation == 0 {
        json!({"guard_audit":{"initialization":"audit-only"}})
    } else {
        snapshot.data.clone()
    };
    let object = data
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("guard audit needs an owned object snapshot".into()))?;
    let guard = object.entry("guard_audit").or_insert_with(|| json!({}));
    let guard = guard
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("invalid guard audit namespace".into()))?;
    if let Some(policy) = &audit.policy
        && policy.complete
    {
        // Permission to allow is never cached. This snapshot serves only denials.
        guard.insert("denial_policy".into(), serde_json::to_value(policy)?);
    }
    Ok(data)
}

/// Read only confirmed state. This reader cannot recover policy-dependent work.
pub async fn confirmed(root: &std::path::Path) -> Result<super::View> {
    struct ReadOnly;
    impl super::super::Policy for ReadOnly {
        fn validate(&mut self, _: &super::super::MutationContext<'_>) -> Result<()> {
            Err(Error::Policy(
                "guard observation cannot authorize recovery".into(),
            ))
        }
    }
    let store =
        super::Store::open(super::super::filesystem::Filesystem::new(root)?, ReadOnly).await?;
    store.request(super::Operation::ReadVerified).await
}

pub fn denial_policy(view: &super::View) -> Option<PolicyEvidence> {
    serde_json::from_value::<PolicyEvidence>(
        view.snapshot.data["guard_audit"]["denial_policy"].clone(),
    )
    .ok()
    .filter(|policy| policy.complete)
}
