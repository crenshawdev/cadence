//! Transport supplied views without producing rulings, settlement or clearance.
use super::model::{ConsumerView, ViewKind};
use cadence::store::{Error, Result};

pub fn consumer_view(supplied: &ConsumerView) -> ConsumerView {
    supplied.clone()
}

fn fix_input(supplied: &ConsumerView) -> Result<ConsumerView> {
    if supplied.kind != ViewKind::ProvisionalSelected {
        return Err(Error::Invalid(
            "fix input requires a supplied provisional selection".into(),
        ));
    }
    Ok(supplied.clone())
}

pub fn execute_fix_input(supplied: &ConsumerView) -> Result<ConsumerView> {
    fix_input(supplied)
}

pub fn planned_task_fix_input(supplied: &ConsumerView) -> Result<ConsumerView> {
    fix_input(supplied)
}
