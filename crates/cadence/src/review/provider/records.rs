//! Additive provider evidence in the existing review namespace, keyed by attempt.
use super::{Extracted, Provider, delivery, diagnostics, transport::Acquired, usage};
use crate::review::{attempts, material_io::WallClock, model::{Attempt, ObservationKind}, persistence};
use cadence::store::{Result, writer::Store};
use serde_json::json;

fn safe_identity(value: Option<&str>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty() && value.len() <= 1024 && diagnostics::fence(value) == *value)
        .map(str::to_owned)
}

/// The provider's own account of a call: the served model, its response id
/// (Gemini's responseId, every other provider's id) and its request id
/// (x-request-id, else request-id), each null when absent or unsafe to keep.
pub fn identity(provider: Provider, response: &Acquired, extracted: &Extracted) -> serde_json::Value {
    json!({"provider":provider.name(),"response_model":safe_identity(extracted.model.as_deref()),
        "response_id":safe_identity(response.json.as_ref()
            .and_then(|json| json[if provider == Provider::Gemini { "responseId" } else { "id" }].as_str())),
        "request_id":safe_identity(response.headers.get("x-request-id").or_else(|| response.headers.get("request-id")).map(String::as_str))})
}

pub async fn save_response(store: &Store, attempt: &Attempt, provider: Provider, response: &Acquired, extracted: &Extracted) -> Result<()> {
    // An acknowledgment retry must retain the first saved accounting, even if
    // the caller no longer has usable response bytes.
    let saved = persistence::read(store).await?;
    if persistence::records(&saved.snapshot.data)?["provider_evidence"].get(&attempt.attempt).is_some() {
        return Ok(());
    }
    let accounting = usage::normalize(provider, extracted.usage.as_ref());
    let model = safe_identity(extracted.model.as_deref());
    let mut identity = identity(provider, response, extracted);
    identity["native_invocation"] = json!(format!("native-invocation:{}", attempt.attempt));
    identity["native_return"] = json!(format!("native-response:{}", attempt.attempt));
    let mut event = delivery::event(attempt, "usage", ObservationKind::Usage);
    event.usage = accounting.usage();
    event.host = Some(provider.name().into());
    event.model = model.clone();
    attempts::record_observation(store, event.clone(), &mut WallClock).await?;
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    persistence::insert(&mut records, "provider_evidence", &attempt.attempt,
        &json!({"attempt":attempt.attempt,"observation":event.observation,"accounting":accounting,
            "identity":identity}))?;
    persistence::update(store, &view, &format!("provider-evidence:{}", attempt.attempt), records).await?;
    Ok(())
}

/// Consult retains the same sanitized observed identity and normalized accounting
/// under its debug offer, without creating a review finding or receipt.
pub fn consult_response(provider: Provider, response: &Acquired, extracted: &Extracted) -> serde_json::Value {
    json!({"accounting":usage::normalize(provider, extracted.usage.as_ref()),
        "status":response.status,
        "identity":identity(provider, response, extracted)})
}
