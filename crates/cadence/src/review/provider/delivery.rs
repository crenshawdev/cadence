//! Provider work uses the issued phase-9 attempt as its durable job identity.
use super::{Provider, credentials, diagnostics, transport};
use crate::review::{attempts, binding::ReturnIdentity, io::Clock, material_io::WallClock, model::*, persistence, returns};
use cadence::store::{Error, Result, writer::Store};
use std::{sync::Arc, time::Duration};

pub struct Environment {
    pub credentials: Arc<dyn credentials::Inputs>,
    pub transport: Arc<dyn transport::Transport>,
    pub sleep: transport::Sleep,
}

impl Default for Environment {
    fn default() -> Self {
        Self { credentials: Arc::new(credentials::SystemInputs), transport: Arc::new(transport::Native),
            sleep: transport::native_sleep() }
    }
}

fn identity(admission: &Admission, attempt: &Attempt) -> ReturnIdentity {
    ReturnIdentity {
        fire: admission.fire.clone(), occurrence: admission.home.occurrence.clone(),
        artifact: admission.artifact.clone(), view: attempt.view.view.clone(),
        attempt: attempt.attempt.clone(), round: attempt.round,
    }
}

pub fn event(attempt: &Attempt, name: &str, kind: ObservationKind) -> Observation {
    Observation {
        observation: format!("native:{}:{name}", attempt.attempt),
        attempt: attempt.attempt.clone(), launch: None, host_return: None, kind,
        reference: format!("native:{}:{name}", attempt.attempt),
        observed_at: WallClock.now(), host: None, model: None,
        usage: Usage { input: None, output: None, cost: None, currency: None },
        contract: attempt.contract.clone(),
    }
}

async fn launch_failure(store: &Store, admission: &Admission, attempt: &Attempt, reason: String) -> Result<()> {
    returns::accept_launch_failure(store, returns::LaunchFailureSubmission {
        identity: identity(admission, attempt),
        event: event(attempt, "launch-failure", ObservationKind::LaunchFailure),
        reason: diagnostics::excerpt(&reason),
    }, &mut WallClock).await.map_err(|error| Error::Invalid(format!("provider failure acknowledgment: {error:?}")))?;
    Ok(())
}

pub async fn run(store: Store, attempt_id: String, environment: Environment) -> Result<()> {
    // Only work is canceled. This resident task keeps the store owner and the
    // entire 30-second reserve for acknowledgment after dropping the HTTP read.
    let outcome = tokio::select! {
        biased;
        _ = (environment.sleep)(Duration::from_millis(transport::PROVIDER_WORK_TIMEOUT_MS)) => {
            Some(Outcome { raw: None, failure: Some(format!("provider work timed out after {}ms", transport::PROVIDER_WORK_TIMEOUT_MS)) })
        }
        outcome = work(&store, &attempt_id, &environment) => outcome?,
    };
    let Some(outcome) = outcome else { return Ok(()); };
    // Re-read after cancellation: a store transaction already submitted to its
    // writer may have completed, including usage observed just before expiry.
    let records = persistence::records(&persistence::read(&store).await?.snapshot.data)?;
    if records["closures"].get(&attempt_id).is_some() { return Ok(()); }
    let attempt: Attempt = persistence::get(&records, "attempts", &attempt_id)?;
    let admission: Admission = persistence::get(&records, "admissions", &attempt.fire)?;
    if attempt.launch.is_none() {
        launch_failure(&store, &admission, &attempt,
            outcome.failure.ok_or_else(|| Error::Invalid("unobserved provider launch".into()))?).await
    } else {
        finish(&store, &admission, &attempt, outcome.raw, outcome.failure).await
    }
}

struct Outcome {
    raw: Option<Vec<u8>>,
    failure: Option<String>,
}

async fn work(store: &Store, attempt_id: &str, environment: &Environment) -> Result<Option<Outcome>> {
    let records = persistence::records(&persistence::read(store).await?.snapshot.data)?;
    let attempt: Attempt = persistence::get(&records, "attempts", attempt_id)?;
    let admission: Admission = persistence::get(&records, "admissions", &attempt.fire)?;
    // A callback after acknowledgment (including a lost acknowledgment) reads
    // the saved terminal result. It never authorizes another paid request.
    if records["closures"].get(attempt_id).is_some() {
        return Ok(None);
    }
    if records["issued"].get(attempt_id).is_none() || attempt.launch.is_some() {
        return Err(Error::Invalid("provider attempt is not newly issued".into()));
    }
    let provider = Provider::parse(&attempt.requested.agent).ok_or_else(|| Error::Invalid("not a provider voice".into()))?;
    let settings: super::Settings = records["provider_settings"].get(&attempt.fire).cloned()
        .map(serde_json::from_value).transpose()?.unwrap_or_default();
    let request_timeout = transport::effective_timeout(settings.request_timeout_ms);
    let inputs = environment.credentials.clone();
    let preparing = attempt.clone();
    // Credential files and payload composition may block. Their isolated job
    // can only produce request bytes; after expiry it cannot spend or persist.
    let prepared = tokio::task::spawn_blocking(move || {
        let key = credentials::resolve(inputs.as_ref(), provider, settings.key_file.as_deref())?;
        let payload = super::payload::prepare(&records, &admission, &preparing, &settings).map_err(|error| error.to_string())?;
        let model = preparing.requested.model.as_deref().ok_or("missing requested provider model")?;
        let request = super::build_request(provider, model, preparing.requested.effort.as_deref(),
            &payload.instruction, &payload.artifact, &key)?;
        Ok::<_, String>((request, payload))
    }).await.map_err(|_| Error::Invalid("provider preparation task failed".into()))?;
    let (request, payload) = match prepared {
        Ok(prepared) => prepared,
        Err(reason) => return Ok(Some(Outcome { raw: None, failure: Some(reason) })),
    };
    let (attempt, delivery) = super::payload::retain(store, &attempt, payload).await?;
    let launch_id = format!("native-invocation:{attempt_id}");
    let mut launch = event(&attempt, "launch", ObservationKind::Launch);
    launch.launch = Some(launch_id.clone());
    launch.host = Some(provider.name().into());
    attempts::record_observation(store, launch, &mut WallClock).await?;
    attempts::record_observation(store, event(&attempt, "material", ObservationKind::MaterialDelivery(delivery)), &mut WallClock).await?;
    let response = transport::request(environment.transport.as_ref(), request, Duration::from_millis(request_timeout), &environment.sleep).await;
    let (raw, failure) = match response {
        Err(reason) => (None, Some(reason)),
        Ok(response) => {
            // Accounting describes the call, including charged HTTP failures.
            // Persist it before refusing status; error text is never findings.
            let extracted = match response.json.as_ref() {
                Some(json) => {
                    let extracted = super::extract(provider, json);
                    super::records::save_response(store, &attempt, provider, &response, &extracted).await?;
                    Some(extracted)
                }
                None => None,
            };
            if !(200..300).contains(&response.status) {
                (None, Some(diagnostics::excerpt(&format!("HTTP {}: {}", response.status, String::from_utf8_lossy(&response.raw)))))
            } else if let Some(extracted) = extracted {
                match extracted.text {
                    Some(text) => (Some(text.into_bytes()), None),
                    None => (None, Some("missing provider response text".into())),
                }
            } else {
                (None, Some("malformed provider response".into()))
            }
        }
    };
    Ok(Some(Outcome { raw, failure }))
}

async fn finish(store: &Store, admission: &Admission, attempt: &Attempt, raw: Option<Vec<u8>>, failure: Option<String>) -> Result<()> {
    let attempt_id = &attempt.attempt;
    let launch_id = attempt.launch.clone().ok_or_else(|| Error::Invalid("unobserved provider launch".into()))?;
    // These are native host event references, not IDs supplied by a provider.
    let return_id = format!("native-response:{attempt_id}");
    let mut returned = event(attempt, "return", ObservationKind::Return);
    returned.launch = Some(launch_id.clone());
    returned.host_return = Some(return_id.clone());
    attempts::record_observation(store, returned, &mut WallClock).await?;
    returns::accept_return(store, returns::ReturnSubmission {
        identity: identity(admission, attempt), launch: launch_id,
        host_return: Some(return_id), raw, host_failure: failure, citations: vec![],
    }, &mut WallClock).await.map_err(|error| Error::Invalid(format!("provider return acknowledgment: {error:?}")))?;
    Ok(())
}
