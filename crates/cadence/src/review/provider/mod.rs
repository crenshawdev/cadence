//! Native cross-model review adapters on the existing delivery lifecycle.
pub mod credentials;
pub mod delivery;
pub mod diagnostics;
pub mod openai;
pub mod transport;

pub struct Extracted {
    pub text: Option<String>,
    pub model: Option<String>,
    pub usage: Option<serde_json::Value>,
}

pub fn build_request(provider: Provider, model: &str, effort: Option<&str>, system: &str, user: &str, key: &credentials::Key) -> Result<transport::Request, String> {
    match provider {
        Provider::OpenAi => Ok(openai::request(model, effort, system, user, key)),
        _ => Err("provider adapter unavailable".into()),
    }
}

pub fn extract(provider: Provider, response: &serde_json::Value) -> Extracted {
    match provider {
        Provider::OpenAi => openai::extract(response),
        _ => Extracted { text: None, model: None, usage: None },
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
