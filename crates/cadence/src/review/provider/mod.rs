//! Native cross-model review adapters on the existing delivery lifecycle.
pub mod credentials;
pub mod diagnostics;
pub mod transport;

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
