use super::nonblank;
use crate::store::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Blocker,
    Warning,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finding {
    pub number: u32,
    pub severity: Severity,
    pub location: String,
    pub claim: String,
    pub fix: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CheckedMaterial {
    pub path: String,
    /// Content evidence captured when checked, independent of lifecycle's memo.
    pub content_digest: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Attempt {
    Initial,
    Revision {
        previous_check: String,
        previous_blockers: Vec<Finding>,
        diff: String,
    },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    Pass,
    Fail,
    Unusable,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Checker {
    pub id: String,
    pub raw_return: String,
    pub disposition: Disposition,
    pub findings: Vec<Finding>,
    pub checked_material: Vec<CheckedMaterial>,
    pub attempt: Attempt,
    pub revision_spent: bool,
}
impl Checker {
    pub fn disposition(raw: &str, findings: &[Finding]) -> Disposition {
        let passed = raw
            .lines()
            .any(|line| line.trim() == "## VERIFICATION PASSED");
        let issues = raw.lines().any(|line| line.trim() == "## ISSUES FOUND");
        if passed == issues || (issues && findings.is_empty()) {
            Disposition::Unusable
        } else if findings.iter().any(|f| f.severity == Severity::Blocker) {
            Disposition::Fail
        } else {
            Disposition::Pass
        }
    }
    pub fn blockers(&self) -> Vec<Finding> {
        self.findings
            .iter()
            .filter(|f| f.severity == Severity::Blocker)
            .cloned()
            .collect()
    }
    pub fn validate(&self) -> Result<()> {
        nonblank("check identity", &self.id)?;
        if self.disposition != Self::disposition(&self.raw_return, &self.findings) {
            return Err(Error::Invalid(
                "checker disposition does not match return/findings".into(),
            ));
        }
        validate_findings(&self.findings)?;
        if self.checked_material.is_empty() {
            return Err(Error::Invalid("checker lacks checked material".into()));
        }
        let mut paths = BTreeSet::new();
        for material in &self.checked_material {
            nonblank("checked path", &material.path)?;
            if material.content_digest.len() != 64
                || !material
                    .content_digest
                    .bytes()
                    .all(|b| b.is_ascii_hexdigit())
                || !paths.insert(&material.path)
            {
                return Err(Error::Invalid(
                    "invalid or duplicate checked material".into(),
                ));
            }
        }
        if let Attempt::Revision {
            previous_check,
            previous_blockers,
            diff,
        } = &self.attempt
        {
            nonblank("previous check", previous_check)?;
            nonblank("revision diff", diff)?;
            validate_findings(previous_blockers)?;
            if !self.revision_spent
                || previous_blockers.is_empty()
                || previous_blockers
                    .iter()
                    .any(|f| f.severity != Severity::Blocker)
            {
                return Err(Error::Invalid(
                    "revision needs its prior blockers and spent budget".into(),
                ));
            }
        }
        Ok(())
    }
}
fn validate_findings(findings: &[Finding]) -> Result<()> {
    let mut numbers = BTreeSet::new();
    for finding in findings {
        if finding.number == 0 || !numbers.insert(finding.number) {
            return Err(Error::Invalid("invalid finding number".into()));
        }
        nonblank("finding location", &finding.location)?;
        nonblank("finding claim", &finding.claim)?;
        nonblank("finding fix", &finding.fix)?;
    }
    Ok(())
}
