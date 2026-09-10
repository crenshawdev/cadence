//! Identity disagreements remain visible; approval never authorizes retargeting.
use super::model::{Answer, Submission, refused};

pub fn identities(submission: &Submission) -> Option<Answer> {
    for entry in &submission.plans {
        if entry.content.phase != entry.target.phase
            || entry.content.plan != entry.target.plan
            || entry.target.phase != submission.phase
        {
            return Some(refused(
                "identity-mismatch",
                format!(
                    "submitted phase {} plan {}, target phase {} plan {}, bound phase {}",
                    entry.content.phase,
                    entry.content.plan,
                    entry.target.phase,
                    entry.target.plan,
                    submission.phase
                ),
            ));
        }
    }
    None
}
