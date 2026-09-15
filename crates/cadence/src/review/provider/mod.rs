//! Native cross-model review adapters on the existing delivery lifecycle.
pub mod credentials;
pub mod deepseek;
pub mod delivery;
pub mod diagnostics;
pub mod gemini;
pub mod openai;
pub mod payload;
pub mod records;
pub mod transport;
pub mod usage;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Settings {
    pub key_file: Option<String>,
    pub max_prompt_tokens: u64,
    pub request_timeout_ms: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self { key_file: None, max_prompt_tokens: 120_000, request_timeout_ms: transport::DEFAULT_TIMEOUT_MS }
    }
}

pub struct Extracted {
    pub text: Option<String>,
    pub model: Option<String>,
    pub usage: Option<serde_json::Value>,
}

pub fn build_request(provider: Provider, model: &str, effort: Option<&str>, system: &str, user: &str, key: &credentials::Key) -> Result<transport::Request, String> {
    match provider {
        Provider::OpenAi => Ok(openai::request(model, effort, system, user, key)),
        Provider::Gemini => Ok(gemini::request(model, effort, system, user, key)),
        Provider::DeepSeek => Ok(deepseek::request(model, effort, system, user, key)),
    }
}

pub fn extract(provider: Provider, response: &serde_json::Value) -> Extracted {
    match provider {
        Provider::OpenAi => openai::extract(response),
        Provider::Gemini => gemini::extract(response),
        Provider::DeepSeek => deepseek::extract(response),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Provider {
    OpenAi,
    Gemini,
    DeepSeek,
}

impl Provider {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "openai" => Some(Self::OpenAi),
            "gemini" => Some(Self::Gemini),
            "deepseek" => Some(Self::DeepSeek),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::Gemini => "gemini",
            Self::DeepSeek => "deepseek",
        }
    }
}
