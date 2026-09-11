//! DeepSeek Chat Completions; JSON mode is not a substitute for H4-1 validation.
use super::{Extracted, credentials::Key, openai::finding_schema, transport::Request};
use serde_json::{Value, json};

pub fn request(model: &str, effort: Option<&str>, system: &str, user: &str, key: &Key) -> Request {
    let system = format!("{system}\n\nRespond with ONLY a single JSON object that conforms to this JSON schema - the object itself is the result, not the schema; no prose, no markdown fences:\n{}", finding_schema());
    let mut body = json!({"model":model,
        "messages":[{"role":"system","content":system},{"role":"user","content":user}],
        "response_format":{"type":"json_object"}});
    if let Some(effort) = effort.filter(|effort| !effort.is_empty()) {
        body["reasoning_effort"] = json!(if effort == "minimal" { "low" } else { effort });
    }
    Request {
        url: "https://api.deepseek.com/chat/completions".into(),
        headers: [("authorization".into(), format!("Bearer {}", key.expose()))].into(),
        body,
    }
}

pub fn extract(response: &Value) -> Extracted {
    Extracted {
        text: response["choices"][0]["message"]["content"].as_str().map(str::to_owned),
        model: response["model"].as_str().map(str::to_owned),
        // completion_tokens already includes its reasoning-token breakdown.
        usage: response.get("usage").cloned(),
    }
}
