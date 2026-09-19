//! Responses API; every returned finding still passes the existing H4-1 gate.
use super::{Extracted, credentials::Key, transport::Request};
use serde_json::{Value, json};

pub fn finding_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["findings"],
        "properties":{"findings":{"type":"array","maxItems":100,"items":{
            "type":"object","additionalProperties":false,
            "required":["file","line","severity","claim","failure_scenario"],
            "properties":{
                "file":{"type":"string","minLength":1,"maxLength":1024},
                "line":{"type":"integer","minimum":1,"maximum":9007199254740991u64},
                "severity":{"type":"string","enum":["blocker","high","medium","low"]},
                "claim":{"type":"string","minLength":1,"maxLength":2000},
                "failure_scenario":{"type":"string","minLength":1,"maxLength":2000}
            }
        }}}})
}

pub fn request(model: &str, effort: Option<&str>, system: &str, user: &str, key: &Key) -> Request {
    let mut body = json!({"model":model,
        "input":[{"role":"system","content":system},{"role":"user","content":user}],
        "text":{"format":{"type":"json_schema","name":"review_findings","strict":true,"schema":finding_schema()}}});
    if let Some(effort) = effort.filter(|value| !value.is_empty()) {
        body["reasoning"] = json!({"effort":effort});
    }
    Request {
        url: "https://api.openai.com/v1/responses".into(),
        headers: [("authorization".into(), format!("Bearer {}", key.expose()))].into(),
        body,
    }
}

pub fn extract(response: &Value) -> Extracted {
    let mut text = response["output_text"].as_str().filter(|text| !text.is_empty()).map(str::to_owned);
    if text.is_none() {
        for item in response["output"].as_array().into_iter().flatten() {
            if item["type"] != "message" { continue; }
            for content in item["content"].as_array().into_iter().flatten() {
                if content["type"] == "output_text" && let Some(value) = content["text"].as_str() {
                    text = Some(value.into());
                }
            }
        }
    }
    Extracted {
        text,
        model: response["model"].as_str().map(str::to_owned),
        usage: response.get("usage").cloned(),
    }
}
