//! Pause-local risk fire and contracted result shapes.
use super::{risk_diff::Scan, validate_path};
use crate::{
    evidence::{
        Scope,
        gates::{Gate, OptionChoice, Purpose, State},
        results::AcceptedResult,
    },
    store::{Error, Result},
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, path::PathBuf};

pub const CONTRACT: &str = "cadence.pause.risk-surface.v1";
use crate::rail::risk::MaterialIdentity;
pub use crate::rail::risk::{CATEGORIES, validate_surfaces};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Consequence {
    Off,
    Advisory,
    Deferred,
    Blocking,
    Adjudicated,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommitKind {
    Wip,
    ResumeRecord,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fire {
    pub id: String,
    pub commit_kind: CommitKind,
    pub round: u32,
    pub base: String,
    pub staged: bool,
    pub head_id: Option<String>,
    pub index_id: String,
    pub scope: Vec<PathBuf>,
    pub authored: Vec<PathBuf>,
    pub scan: Scan,
}

impl Fire {
    /// Explicit adapter: historical fire serialization and its digest stay unchanged.
    pub fn material(&self) -> Result<MaterialIdentity> {
        if !self.staged || self.head_id.is_some() {
            return Err(Error::Invalid("pause fire is not staged material".into()));
        }
        Ok(MaterialIdentity::Staged {
            base_id: self.base.clone(),
            index_id: self.index_id.clone(),
        })
    }

    pub fn new(
        scope: &Scope,
        commit_kind: CommitKind,
        round: u32,
        staged: &super::git::Staged,
        scan: Scan,
    ) -> Result<Self> {
        let material = MaterialIdentity::Staged {
            base_id: staged.base.clone(),
            index_id: staged.index_id.clone(),
        };
        let input = (
            scope,
            commit_kind,
            round,
            &staged.base,
            &staged.index_id,
            &staged.scope,
            &staged.authored,
            &scan,
        );
        Ok(Self {
            id: format!(
                "pause-risk-{}",
                crate::store::model::digest(&serde_json::to_vec(&input)?)
            ),
            commit_kind,
            round,
            base: material.base_id().into(),
            staged: true,
            head_id: None,
            index_id: material.tip_id().into(),
            scope: staged.scope.clone(),
            authored: staged.authored.clone(),
            scan,
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Blocker,
    High,
    Medium,
    Low,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finding {
    pub number: u32,
    pub severity: Severity,
    pub file: String,
    pub line: u32,
    pub claim: String,
    pub fix: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Review {
    pub version: u32,
    pub fire: Fire,
    pub finding_record: String,
    pub findings: Vec<Finding>,
}

impl Review {
    pub fn parse(record: &AcceptedResult, fire: &Fire) -> Result<Self> {
        if record.id != fire.id || record.contract != CONTRACT || record.result != "reviewed" {
            return Err(Error::Invalid(
                "risk result does not identify this contracted fire".into(),
            ));
        }
        let review: Self = serde_json::from_str(&record.evidence_text)
            .map_err(|_| Error::Invalid("risk review return is unusable".into()))?;
        if review.version != 1 || review.fire != *fire || review.finding_record.trim().is_empty() {
            return Err(Error::Invalid("risk review return is unusable".into()));
        }
        let mut numbers = BTreeSet::new();
        for finding in &review.findings {
            if finding.number == 0
                || finding.line == 0
                || !numbers.insert(finding.number)
                || finding.file.trim().is_empty()
                || finding.claim.trim().is_empty()
                || finding.fix.trim().is_empty()
            {
                return Err(Error::Invalid("risk review return is unusable".into()));
            }
            validate_path(PathBuf::from(&finding.file).as_path())?;
        }
        Ok(review)
    }

    pub fn blocking(&self) -> bool {
        self.findings
            .iter()
            .any(|finding| matches!(finding.severity, Severity::Blocker | Severity::High))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    Off,
    Clear(Fire),
    Advisory(Review),
    Deferred { review: Review, queue: PathBuf },
    BlockingCleared(Review),
    Overridden { review: Review, override_id: String },
    Adjudicated(Review),
}

pub fn surfaces_question(
    scope: &Scope,
    structural: &crate::rail::surfaces::Report,
) -> Result<Gate> {
    let identity = crate::store::model::digest(&serde_json::to_vec(&(
        &scope.project,
        "review.triggers.risk_surface.surfaces",
    ))?);
    let mut options: Vec<_> = structural
        .options
        .iter()
        .enumerate()
        .map(|(index, choice)| OptionChoice {
            id: if index == 0 {
                "all".into()
            } else {
                format!("surfaces:{}", choice.surfaces.join(","))
            },
            text: format!("{}: {}", choice.surfaces.join(", "), choice.reason),
        })
        .collect();
    options.extend([
        OptionChoice {
            id: "choose".into(),
            text: "Use the supplied JSON category list".into(),
        },
        OptionChoice {
            id: "abort".into(),
            text: "Abort the pause".into(),
        },
    ]);
    Ok(Gate {
        id: format!("pause-risk-surfaces-{identity}"),
        purpose: Purpose::Decision,
        checkpoint_id: None,
        question: "Which risk surfaces should this project review?".into(),
        need: format!(
            "{} Silent: {}. Structurally unspeakable: {}. Warnings: {}. Choose an offered set, supply a JSON category list, or abort.",
            structural.options[0].reason,
            structural.silent.join(", "),
            structural.unspeakable.join(", "),
            structural.warnings.join("; ")
        ),
        options,
        state: State::Unanswered,
    })
}

pub fn review_question(fire: &Fire) -> Gate {
    Gate {
        id: fire.id.clone(),
        purpose: Purpose::HumanVerify,
        checkpoint_id: None,
        question: "The staged material requires a risk_surface review.".into(),
        need: format!(
            "Record a {CONTRACT} result for staged index {} (round {}).",
            fire.index_id, fire.round
        ),
        options: Vec::new(),
        state: State::Unanswered,
    }
}

pub fn disposition_question(review: &Review) -> Gate {
    let allow_fix = review.fire.round == 1;
    let mut options = Vec::new();
    if allow_fix {
        options.push(OptionChoice {
            id: "fix".into(),
            text: "Fix the surviving findings and re-arm once".into(),
        });
    }
    options.extend([
        OptionChoice {
            id: "override".into(),
            text: "Proceed with a reasoned occurrence-scoped override".into(),
        },
        OptionChoice {
            id: "abort".into(),
            text: "Abort the pause".into(),
        },
    ]);
    Gate {
        id: format!("{}-disposition", review.fire.id),
        purpose: Purpose::Decision,
        checkpoint_id: None,
        question: "The risk_surface review has surviving findings.".into(),
        need: if allow_fix {
            "Fix and re-arm once, record a reasoned override, or abort?".into()
        } else {
            "The one narrowed re-arm is spent. Record a reasoned override or abort?".into()
        },
        options,
        state: State::Unanswered,
    }
}
