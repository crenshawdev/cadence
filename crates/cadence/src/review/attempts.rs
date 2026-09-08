//! Saved H3 attempts, including requested identity and explicit unknown facts.
use super::model::Attempt;
use super::persistence;
use cadence::store::Result;
use cadence::store::writer::Store;

pub async fn read_attempt(store: &Store, attempt: &str) -> Result<Attempt> {
    persistence::get(
        &persistence::records(&persistence::read(store).await?.snapshot.data)?,
        "attempts",
        attempt,
    )
}
