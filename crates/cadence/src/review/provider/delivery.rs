//! Provider work uses the issued phase-9 attempt as its durable job identity.
use super::{Provider, credentials, diagnostics, transport};
use crate::review::{attempts, binding::ReturnIdentity, io::Clock, material_io::WallClock, model::*, persistence, returns};
use cadence::store::{Error, Result, writer::Store};
use std::{sync::Arc, time::Duration};

pub struct Environment {
    pub credentials: Arc<dyn credentials::Inputs>,
    pub transport: Arc<dyn transport::Transport>,
}

impl Default for Environment {
    fn default() -> Self {
        Self { credentials: Arc::new(credentials::SystemInputs), transport: Arc::new(transport::Native) }
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
    let records = persistence::records(&persistence::read(&store).await?.snapshot.data)?;
    let admission: Admission = persistence::get(&records, "admissions", &persistence::get::<Attempt>(&records, "attempts", &attempt_id)?.fire)?;
    let attempt: Attempt = persistence::get(&records, "attempts", &attempt_id)?;
    if records["issued"].get(&attempt_id).is_none() || attempt.launch.is_some() || records["closures"].get(&attempt_id).is_some() {
        return Err(Error::Invalid("provider attempt is not newly issued".into()));
    }
    let provider = Provider::parse(&attempt.requested.agent).ok_or_else(|| Error::Invalid("not a provider voice".into()))?;
    let settings: super::Settings = records["provider_settings"].get(&attempt.fire).cloned()
        .map(serde_json::from_value).transpose()?.unwrap_or_default();
    let prepared = (|| {
        let key = credentials::resolve(environment.credentials.as_ref(), provider, settings.key_file.as_deref())?;
        let payload = super::payload::prepare(&records, &admission, &attempt, &settings).map_err(|error| error.to_string())?;
        let model = attempt.requested.model.as_deref().ok_or("missing requested provider model")?;
        let request = super::build_request(provider, model, attempt.requested.effort.as_deref(),
            &payload.instruction, &payload.artifact, &key)?;
        Ok::<_, String>((request, payload))
    })();
    let (request, payload) = match prepared {
        Ok(prepared) => prepared,
        Err(reason) => return launch_failure(&store, &admission, &attempt, reason).await,
    };
    let (attempt, delivery) = super::payload::retain(&store, &attempt, payload).await?;
    let launch_id = format!("native-invocation:{attempt_id}");
    let mut launch = event(&attempt, "launch", ObservationKind::Launch);
    launch.launch = Some(launch_id.clone());
    launch.host = Some(provider.name().into());
    attempts::record_observation(&store, launch, &mut WallClock).await?;
    attempts::record_observation(&store, event(&attempt, "material", ObservationKind::MaterialDelivery(delivery)), &mut WallClock).await?;
    let response = transport::request(environment.transport.as_ref(), request, Duration::from_millis(settings.request_timeout_ms)).await;
    let (raw, failure) = match response {
        Err(reason) => (None, Some(reason)),
        Ok(response) if !(200..300).contains(&response.status) => (None, Some(diagnostics::excerpt(&format!("HTTP {}: {}", response.status, String::from_utf8_lossy(&response.raw))))),
        Ok(response) => match response.json {
            None => (None, Some("malformed provider response".into())),
            Some(json) => match super::extract(provider, &json).text {
                Some(text) => (Some(text.into_bytes()), None),
                None => (None, Some("missing provider response text".into())),
            },
        },
    };
    // These are native host event references, not IDs supplied by a provider.
    let return_id = format!("native-response:{attempt_id}");
    let mut returned = event(&attempt, "return", ObservationKind::Return);
    returned.launch = Some(launch_id.clone());
    returned.host_return = Some(return_id.clone());
    attempts::record_observation(&store, returned, &mut WallClock).await?;
    returns::accept_return(&store, returns::ReturnSubmission {
        identity: identity(&admission, &attempt), launch: launch_id,
        host_return: Some(return_id), raw, host_failure: failure, citations: vec![],
    }, &mut WallClock).await.map_err(|error| Error::Invalid(format!("provider return acknowledgment: {error:?}")))?;
    Ok(())
}
