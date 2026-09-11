//! Credentials are runtime inputs, never serializable review evidence.
use super::Provider;
use std::{collections::BTreeMap, fmt, path::{Path, PathBuf}};

pub trait Inputs: Send + Sync {
    fn env(&self, name: &str) -> Option<String>;
    fn read(&self, path: &Path) -> Option<String>;
}

pub struct SystemInputs;

impl Inputs for SystemInputs {
    fn env(&self, name: &str) -> Option<String> {
        std::env::var(name).ok()
    }

    fn read(&self, path: &Path) -> Option<String> {
        std::fs::read_to_string(path).ok()
    }
}

pub struct Key(String);

impl Key {
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for Key {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Key([REDACTED])")
    }
}

pub fn variable(provider: Provider) -> &'static str {
    match provider {
        Provider::OpenAi => "OPENAI_API_KEY",
        Provider::Gemini => "GEMINI_API_KEY",
        Provider::DeepSeek => "DEEPSEEK_API_KEY",
    }
}

fn nonempty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.is_empty())
}

pub fn providers_env_path(inputs: &dyn Inputs, explicit: Option<&str>) -> PathBuf {
    let home = inputs.env("HOME").unwrap_or_default();
    if let Some(path) = explicit.filter(|path| !path.is_empty()) {
        return if path == "~" {
            PathBuf::from(home)
        } else if let Some(suffix) = path.strip_prefix("~/") {
            PathBuf::from(home).join(suffix)
        } else {
            PathBuf::from(path)
        };
    }
    let base = nonempty(inputs.env("XDG_CONFIG_HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(home).join(".config"));
    base.join("cadence/providers.env")
}

pub fn parse_env_file(text: &str) -> BTreeMap<String, String> {
    let mut values = BTreeMap::new();
    for line in text.lines().map(str::trim) {
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((name, value)) = line.split_once('=') else { continue };
        let name = name.trim();
        let name = name.strip_prefix("export ").unwrap_or(name).trim();
        let value = value.trim();
        let value = value.strip_prefix('"').and_then(|s| s.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')))
            .unwrap_or(value);
        values.insert(name.to_owned(), value.to_owned());
    }
    values
}

pub fn resolve(inputs: &dyn Inputs, provider: Provider, explicit: Option<&str>) -> Result<Key, String> {
    let name = variable(provider);
    if let Some(key) = nonempty(inputs.env(name)) {
        return Ok(Key(key));
    }
    let path = providers_env_path(inputs, explicit);
    if let Some(key) = inputs.read(&path)
        .and_then(|text| parse_env_file(&text).remove(name))
        .filter(|value| !value.is_empty())
    {
        return Ok(Key(key));
    }
    Err(format!("missing credential: env ${name} or {}", path.display()))
}
