//! Additive provider evidence in the existing review namespace, keyed by attempt.
use super::{Extracted, Provider, delivery, diagnostics, transport::Acquired, usage};
use crate::review::{attempts, material_io::WallClock, model::{Attempt, ObservationKind}, persistence};
use cadence::store::{Result, writer::Store};
use serde_json::json;

fn safe_identity(value: Option<&str>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty() && value.len() <= 1024 && diagnostics::fence(value) == *value)
        .map(str::to_owned)
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
    let response_id = safe_identity(response.json.as_ref()
        .and_then(|json| json[if provider == Provider::Gemini { "responseId" } else { "id" }].as_str()));
    let request_id = safe_identity(response.headers.get("x-request-id").or_else(|| response.headers.get("request-id")).map(String::as_str));
    let mut event = delivery::event(attempt, "usage", ObservationKind::Usage);
    event.usage = accounting.usage();
    event.host = Some(provider.name().into());
    event.model = model.clone();
    attempts::record_observation(store, event.clone(), &mut WallClock).await?;
    let view = persistence::read(store).await?;
    let mut records = persistence::records(&view.snapshot.data)?;
    persistence::insert(&mut records, "provider_evidence", &attempt.attempt,
        &json!({"attempt":attempt.attempt,"observation":event.observation,"accounting":accounting,
            "identity":{"provider":provider.name(),"response_model":model,
                "response_id":response_id,"request_id":request_id,
                "native_invocation":format!("native-invocation:{}", attempt.attempt),
                "native_return":format!("native-response:{}", attempt.attempt)}}))?;
    persistence::update(store, &view, &format!("provider-evidence:{}", attempt.attempt), records).await?;
    Ok(())
}
