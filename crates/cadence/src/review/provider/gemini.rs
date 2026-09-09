//! Google generateContent uses its own wire schema and observed metadata.
use super::{Extracted, credentials::Key, openai::finding_schema, transport::Request};
use serde_json::{Value, json};

fn strip_additional_properties(value: &mut Value) {
    match value {
        Value::Object(fields) => {
            fields.remove("additionalProperties");
            for value in fields.values_mut() { strip_additional_properties(value); }
        }
        Value::Array(values) => {
            for value in values { strip_additional_properties(value); }
        }
        _ => {}
    }
}

pub fn request(model: &str, effort: Option<&str>, system: &str, user: &str, key: &Key) -> Request {
    let mut schema = finding_schema();
    strip_additional_properties(&mut schema);
    let mut config = json!({"responseMimeType":"application/json","responseSchema":schema});
    if let Some(effort) = effort.filter(|effort| !effort.is_empty()) {
        config["thinkingConfig"] = json!({"thinkingLevel":effort});
    }
    let mut url = reqwest::Url::parse("https://generativelanguage.googleapis.com").expect("fixed Google endpoint");
    url.path_segments_mut().expect("HTTPS base").extend(["v1beta", "models", &format!("{model}:generateContent")]);
    Request {
        url: url.into(),
        headers: [("x-goog-api-key".into(), key.expose().into())].into(),
        body: json!({"systemInstruction":{"parts":[{"text":system}]},
            "contents":[{"role":"user","parts":[{"text":user}]}],"generationConfig":config}),
    }
}

pub fn extract(response: &Value) -> Extracted {
    Extracted {
        text: response["candidates"][0]["content"]["parts"].as_array()
            .and_then(|parts| parts.iter().find_map(|part| part["text"].as_str())).map(str::to_owned),
        model: response["modelVersion"].as_str().map(str::to_owned),
        // Preserve the wire object without the frozen invalid-as-zero sum.
        usage: response.get("usageMetadata").cloned(),
    }
}
