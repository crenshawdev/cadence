//! Native HTTPS with a wire-only seam; acquisition bounds apply to both paths.
use super::diagnostics;
use serde_json::Value;
use std::{collections::BTreeMap, future::Future, pin::Pin, time::Duration};

pub const MAX_RESPONSE_BYTES: usize = 4_194_304;
pub const DEFAULT_TIMEOUT_MS: u64 = 540_000;
pub const PROVIDER_WORK_TIMEOUT_MS: u64 = 570_000;
pub const ACKNOWLEDGMENT_BUDGET_MS: u64 = 30_000;
pub const ATTEMPT_BUDGET_MS: u64 = 600_000;
pub type Pending<'a, T> = Pin<Box<dyn Future<Output = Result<T, String>> + Send + 'a>>;
pub type Sleep = std::sync::Arc<dyn Fn(Duration) -> Pending<'static, ()> + Send + Sync>;

pub fn effective_timeout(millis: u64) -> u64 {
    if millis == 0 { DEFAULT_TIMEOUT_MS } else { millis.min(DEFAULT_TIMEOUT_MS) }
}

pub fn native_sleep() -> Sleep {
    std::sync::Arc::new(|duration| Box::pin(async move {
        tokio::time::sleep(duration).await;
        Ok(())
    }))
}

// Neither request nor wire response implements Debug/Serialize: headers and
// unrestricted errors must never become review records.
pub struct Request {
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: Value,
}

pub trait Body: Send {
    fn chunk(&mut self) -> Pending<'_, Option<Vec<u8>>>;
}

pub struct Response {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub body: Box<dyn Body>,
}

pub trait Transport: Send + Sync {
    fn send(&self, request: Request, timeout: Duration) -> Pending<'_, Response>;
}

pub struct Native;

impl Body for reqwest::Response {
    fn chunk(&mut self) -> Pending<'_, Option<Vec<u8>>> {
        Box::pin(async move {
            reqwest::Response::chunk(self).await
                .map(|chunk| chunk.map(|bytes| bytes.to_vec()))
                .map_err(|error| diagnostics::excerpt(&error.without_url().to_string()))
        })
    }
}

impl Transport for Native {
    fn send(&self, request: Request, timeout: Duration) -> Pending<'_, Response> {
        Box::pin(async move {
            let client = reqwest::Client::builder()
                .https_only(true)
                .redirect(reqwest::redirect::Policy::none())
                .timeout(timeout)
                .build()
                .map_err(|error| diagnostics::excerpt(&error.without_url().to_string()))?;
            let mut outgoing = client.post(&request.url).timeout(timeout).json(&request.body);
            for (name, value) in request.headers {
                outgoing = outgoing.header(name, value);
            }
            let response = outgoing.send().await
                .map_err(|error| diagnostics::excerpt(&error.without_url().to_string()))?;
            // Only possible provider request identifiers cross acquisition;
            // authorization/cookies and arbitrary headers are never retained.
            let headers = ["x-request-id", "request-id"]
                .into_iter()
                .filter_map(|name| response.headers().get(name)
                    .and_then(|value| value.to_str().ok())
                    .map(|value| (name.to_owned(), value.to_owned())))
                .collect();
            Ok(Response { status: response.status().as_u16(), headers, body: Box::new(response) })
        })
    }
}

pub struct Acquired {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub raw: Vec<u8>,
    pub json: Option<Value>,
}

pub async fn request(transport: &dyn Transport, request: Request, timeout: Duration, sleep: &Sleep) -> Result<Acquired, String> {
    tokio::select! {
        biased;
        _ = sleep(timeout) => Err(format!("request timed out after {}ms", timeout.as_millis())),
        acquired = async {
            let mut response = transport.send(request, timeout).await?;
            let mut raw = Vec::new();
            while let Some(chunk) = response.body.chunk().await? {
                if chunk.len() > MAX_RESPONSE_BYTES - raw.len() {
                    // Dropping the body stops the wire; never append the chunk
                    // that would exceed the retained response budget.
                    return Err(format!("response body over {MAX_RESPONSE_BYTES} bytes"));
                }
                raw.extend_from_slice(&chunk);
            }
            // Parsing cannot block the resident executor or prevent its outer timer
            // from firing. A detached parser has no store or transport authority.
            tokio::task::spawn_blocking(move || {
                let json = serde_json::from_slice(&raw).ok();
                Acquired { status: response.status, headers: response.headers, raw, json }
            }).await.map_err(|_| "provider response parser failed".to_owned())
        } => acquired.map_err(|error| diagnostics::excerpt(&error)),
    }
}
