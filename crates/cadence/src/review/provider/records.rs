//! Additive provider evidence in the existing review namespace, keyed by attempt.
use super::{Provider, delivery, usage};
use crate::review::{attempts, material_io::WallClock, model::{Attempt, ObservationKind}, persistence};
use cadence::store::{Result, writer::Store};
use serde_json::{Value, json};

pub async fn save_accounting(store: &Store, attempt: &Attempt, provider: Provider, raw: Option<&Value>) -> Result<()> {
    let accounting = usage::normalize(provider, raw);
    let mut event = delivery::event(attempt, "usage", ObservationKind::Usage);
    event.usage = accounting.usage();
    attempts::record_observation(store, event.clone(), &mut WallClock).await?;
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    persistence::insert(&mut records, "provider_evidence", &attempt.attempt,
        &json!({"attempt":attempt.attempt,"observation":event.observation,"accounting":accounting}))?;
    persistence::update(store, &view, &format!("provider-evidence:{}", attempt.attempt), records).await?;
    Ok(())
}
