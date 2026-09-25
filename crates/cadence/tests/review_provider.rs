//! What the provider adapters decide over values: the request each builds, the
//! text each reads back, the usage accounting, the identity kept, and what an
//! answered call delivers.

use cadence::review::provider::{
    Provider, build_request, credentials, delivery, extract, records, transport, usage,
};
use serde_json::{Value, json};
use std::path::Path;

/// An environment holding a key for every provider and no files.
struct Keys;
impl credentials::Inputs for Keys {
    fn env(&self, name: &str) -> Option<String> {
        Some(format!("key-for-{name}"))
    }
    fn read(&self, _: &Path) -> Option<String> {
        None
    }
}

fn request(provider: Provider, model: &str) -> transport::Request {
    let key = credentials::resolve(&Keys, provider, None).unwrap();
    build_request(provider, model, Some("high"), "system", "user", &key).unwrap()
}

#[test]
fn an_openai_request_names_the_requested_model_and_effort() {
    let body = request(Provider::OpenAi, "gpt-5").body;
    assert_eq!((&body["model"], &body["reasoning"]["effort"]), (&json!("gpt-5"), &json!("high")));
}

#[test]
fn a_deepseek_request_names_the_requested_model_and_effort() {
    let body = request(Provider::DeepSeek, "deepseek-chat").body;
    assert_eq!((&body["model"], &body["reasoning_effort"]), (&json!("deepseek-chat"), &json!("high")));
}

#[test]
fn a_gemini_request_calls_generate_content_for_the_model_at_its_thinking_level() {
    let built = request(Provider::Gemini, "gemini-3-pro");
    assert_eq!(
        built.url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent"
    );
    assert_eq!(built.body["generationConfig"]["thinkingConfig"]["thinkingLevel"], "high");
}

#[test]
fn an_openai_answer_delivers_its_message_text() {
    let answer = json!({"output":[{"type":"message","content":[{"type":"output_text","text":"{\"findings\":[]}"}]}]});
    assert_eq!(extract(Provider::OpenAi, &answer).text.as_deref(), Some("{\"findings\":[]}"));
}

fn acquired(json: Value, header: Option<(&str, &str)>) -> transport::Acquired {
    transport::Acquired {
        status: 200,
        headers: header.map(|(name, value)| (name.to_string(), value.to_string())).into_iter().collect(),
        raw: json.to_string().into_bytes(),
        json: Some(json),
    }
}

fn identity(provider: Provider, response: &transport::Acquired) -> Value {
    records::identity(provider, response, &extract(provider, response.json.as_ref().unwrap()))
}

#[test]
fn the_identity_takes_the_served_model_response_id_and_request_id() {
    for (provider, answer, header, expected) in [
        (Provider::OpenAi, json!({"id":"resp-1","model":"gpt-5-served"}), ("x-request-id", "req-1"),
            json!({"provider":"openai","response_model":"gpt-5-served","response_id":"resp-1","request_id":"req-1"})),
        (Provider::Gemini, json!({"responseId":"resp-2","modelVersion":"gemini-3-served"}), ("request-id", "req-2"),
            json!({"provider":"gemini","response_model":"gemini-3-served","response_id":"resp-2","request_id":"req-2"})),
        (Provider::DeepSeek, json!({"id":"resp-3","model":"deepseek-served"}), ("x-request-id", "req-3"),
            json!({"provider":"deepseek","response_model":"deepseek-served","response_id":"resp-3","request_id":"req-3"})),
    ] {
        assert_eq!(identity(provider, &acquired(answer, Some(header))), expected, "{}", provider.name());
    }
}

#[test]
fn an_identity_the_response_does_not_carry_is_null() {
    assert_eq!(
        identity(Provider::OpenAi, &acquired(json!({}), None)),
        json!({"provider":"openai","response_model":null,"response_id":null,"request_id":null})
    );
}

fn state(count: &usage::Count) -> Value {
    serde_json::to_value(count).unwrap()
}

#[test]
fn a_count_that_is_not_a_whole_number_from_0_to_2_53_minus_1_is_invalid() {
    for value in [json!(-1), json!(1.5), json!(9_007_199_254_740_992u64), json!("7")] {
        let counted = usage::normalize(Provider::OpenAi, Some(&json!({"input_tokens":value})));
        assert_eq!(state(&counted.input), json!({"state":"invalid"}), "{value}");
    }
    for value in [0u64, 9_007_199_254_740_991] {
        let counted = usage::normalize(Provider::OpenAi, Some(&json!({"input_tokens":value})));
        assert_eq!(state(&counted.input), json!({"state":"valid","value":value}));
    }
}

#[test]
fn a_count_the_response_does_not_carry_is_absent() {
    for raw in [None, Some(json!({}))] {
        let counted = usage::normalize(Provider::OpenAi, raw.as_ref());
        assert_eq!((state(&counted.input), state(&counted.output)), (json!({"state":"absent"}), json!({"state":"absent"})));
    }
}

#[test]
fn each_provider_reads_its_own_input_and_output_counts() {
    for (provider, raw) in [
        (Provider::OpenAi, json!({"input_tokens":11,"output_tokens":22})),
        (Provider::DeepSeek, json!({"prompt_tokens":11,"completion_tokens":22})),
        (Provider::Gemini, json!({"promptTokenCount":11,"candidatesTokenCount":20,"thoughtsTokenCount":2})),
    ] {
        let counted = usage::normalize(provider, Some(&raw));
        assert_eq!((counted.usage().input, counted.usage().output), (Some(11), Some(22)), "{}", provider.name());
    }
}

#[test]
fn gemini_output_is_candidates_plus_thoughts_only_when_both_are_valid() {
    let output = |raw: Value| state(&usage::normalize(Provider::Gemini, Some(&raw)).output);
    assert_eq!(output(json!({"candidatesTokenCount":3,"thoughtsTokenCount":4})), json!({"state":"valid","value":7}));
    assert_eq!(output(json!({"candidatesTokenCount":3,"thoughtsTokenCount":-1})), json!({"state":"invalid"}));
    assert_eq!(output(json!({"candidatesTokenCount":3})), json!({"state":"absent"}));
}

#[test]
fn raw_usage_is_kept_unless_it_is_oversized_or_carries_a_credential() {
    for (raw, retention, kept) in [
        (json!({"input_tokens":1}), "retained", true),
        (json!({"input_tokens":1,"note":"x".repeat(3000)}), "oversized", false),
        (json!({"input_tokens":1,"api_key":"sk-live-secret"}), "credential-bearing", false),
    ] {
        let counted = usage::normalize(Provider::OpenAi, Some(&raw));
        assert_eq!((counted.raw_retention.as_str(), counted.raw_usage.is_some()), (retention, kept), "{retention}");
    }
}

#[test]
fn a_2xx_answer_with_text_delivers_that_text_as_the_return() {
    let text = "{\"findings\":[]}".to_string();
    assert_eq!(
        delivery::classify(200, b"{}", Some(Some(text.clone()))),
        (Some(text.into_bytes()), None)
    );
}

#[test]
fn a_status_outside_2xx_fails_naming_it_with_credentials_redacted_within_1024_bytes() {
    let body = format!("Authorization: Bearer sk-live-secret {}", "x".repeat(5000));
    let (raw, failure) = delivery::classify(401, body.as_bytes(), Some(Some("{\"findings\":[]}".into())));
    let failure = failure.unwrap();
    assert_eq!(raw, None);
    assert!(failure.starts_with("HTTP 401: "), "{failure}");
    assert!(!failure.contains("sk-live-secret") && failure.contains("<redacted>"), "{failure}");
    assert!(failure.len() <= 1024, "{}", failure.len());
}

#[test]
fn a_2xx_body_that_is_not_json_is_a_malformed_response() {
    assert_eq!(
        delivery::classify(200, b"<html>", None),
        (None, Some("malformed provider response".into()))
    );
}

#[test]
fn a_2xx_json_body_without_text_is_missing_its_text() {
    assert_eq!(
        delivery::classify(200, b"{}", Some(None)),
        (None, Some("missing provider response text".into()))
    );
}

#[test]
fn the_request_timeout_is_the_configured_one_capped_at_540000() {
    for (configured, effective) in [(0, 540_000), (1_000, 1_000), (999_999, 540_000)] {
        assert_eq!(transport::effective_timeout(configured), effective, "{configured}");
    }
}
