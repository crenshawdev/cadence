//! Remote observations resolve uncertainty; they never supply owner permission.
use crate::process::Process;
use super::{effects, forge, model::{ExternalInput, Landing, Step}};
use crate::store::{Error, Result};
use serde_json::{Value, json};
use std::path::Path;

pub enum Observation {
    Present { result: Value, proof: Value },
    Absent { proof: Value },
}

fn require_ref(root: &Path, landing: &Landing, branch: &str, head: &str, process: &mut dyn Process) -> Result<()> {
    let observed = effects::remote_head(root, landing, &format!("refs/heads/{branch}"), process)?;
    if observed.as_deref() != Some(head) {
        return Err(Error::Invalid(format!("remote branch {branch} moved or is missing; expected {head}, observed {observed:?}")));
    }
    Ok(())
}

pub fn read(root: &Path, landing: &Landing, inputs: &ExternalInput, config: &Value, process: &mut dyn Process) -> Result<Observation> {
    match inputs {
        ExternalInput::Push | ExternalInput::TagPush { .. } => {
            let (reference, expected) = match inputs {
                ExternalInput::TagPush { tag, head } => (format!("refs/tags/{tag}"), head),
                _ => (format!("refs/heads/{}", landing.source.branch), &landing.source.head),
            };
            let observed = effects::remote_head(root, landing, &reference, process)?;
            let proof = json!({"kind":"git-ref","remote":landing.remote,"reference":reference,"object":observed});
            match observed {
                Some(head) if head == *expected => Ok(Observation::Present { result: proof.clone(), proof }),
                None => Ok(Observation::Absent { proof }),
                Some(head) => Err(Error::Invalid(format!("remote ref {reference} moved; expected {expected}, observed {head}"))),
            }
        }
        ExternalInput::Open { forge: target, .. } | ExternalInput::Merge { forge: target, .. } => {
            forge::configured(target, config)?;
            if !landing.steps.iter().any(|s| s.step == Step::Publish && s.receipt.is_some()) {
                return Err(Error::Invalid("remote PR reconciliation requires the recorded push".into()));
            }
            require_ref(root, landing, &landing.source.branch, &landing.source.head, process)?;
            let identity = if let ExternalInput::Merge { pr, .. } = inputs {
                let open = landing.steps.iter().find(|s| s.step == Step::Open).and_then(|s| s.receipt.as_ref())
                    .ok_or_else(|| Error::Invalid("merge reconciliation requires the recorded PR identity".into()))?;
                if forge::number(target, &open["result"])? != *pr || open["inputs"]["forge"] != serde_json::to_value(target)? {
                    return Err(Error::Invalid("merge identity differs from the recorded PR".into()));
                }
                Some(*pr)
            } else { None };
            let Some(result) = forge::read_pull(root, landing, target, identity, process)? else {
                require_ref(root, landing, &landing.base.branch, &landing.base.head, process)?;
                return Ok(Observation::Absent { proof: json!({"kind":"pull-request","forge":target,
                    "source":landing.source,"base":landing.base,"state":"ABSENT"}) });
            };
            let state = forge::pull_state(root, landing, target, &result, process)?;
            let proof = json!({"kind":"pull-request","forge":target,"number":forge::number(target, &result)?,
                "source":landing.source,"base":landing.base,"state":state,"observed":result});
            if state == "OPEN" {
                require_ref(root, landing, &landing.base.branch, &landing.base.head, process)?;
                if identity.is_some() { return Ok(Observation::Absent { proof }); }
            }
            Ok(Observation::Present { result, proof })
        }
    }
}

pub fn next_step(landing: &Landing) -> &'static str {
    if let Some(slot) = landing.steps.iter().find(|slot| slot.intent.is_some() && slot.receipt.is_none()) {
        return slot.step.name();
    }
    for step in [Step::Publish, Step::Open, Step::Merge] {
        if landing.steps.iter().any(|slot| slot.step == step && slot.receipt.is_none()) { return step.name(); }
    }
    // Observing MERGED is not the owner's merge-confirmation record.
    if landing.merge_confirmation.is_none() { return "confirm-merge"; }
    for step in super::cleanup::ORDER {
        if super::cleanup::receipt(landing, &step).is_none() { return step.name(); }
    }
    "complete"
}
