//! Exact, bounded accounting. Missing or invalid counts never imply zero.
use super::{Provider, diagnostics};
use crate::review::model::Usage;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const MAX_COUNT: u64 = 9_007_199_254_740_991;
const MAX_RAW_UNITS: usize = 2048;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum Count {
    Absent,
    Invalid,
    Valid { value: u64 },
}

impl Count {
    fn value(&self) -> Option<u64> {
        match self { Self::Valid { value } => Some(*value), _ => None }
    }
}

// serde_json's arbitrary_precision keeps the response lexeme intact. Decimal
// scale is applied to digit strings, never via f64, even near the safe bound.
fn whole(value: &Value) -> Option<u64> {
    let Value::Number(number) = value else { return None };
    let lexeme = number.to_string();
    let (mantissa, exponent) = lexeme.split_once(['e', 'E']).unwrap_or((&lexeme, "0"));
    let negative = mantissa.starts_with('-');
    let mantissa = mantissa.strip_prefix('-').unwrap_or(mantissa);
    let (integer, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let digits = format!("{integer}{fraction}");
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() { return Some(0); }
    if negative { return None; }
    let scale = exponent.parse::<i64>().ok()?.checked_sub(i64::try_from(fraction.len()).ok()?)?;
    let count = if scale >= 0 {
        let zeros = usize::try_from(scale).ok()?;
        if digits.len().checked_add(zeros)? > 16 { return None; }
        digits.parse::<u64>().ok()?.checked_mul(10u64.checked_pow(u32::try_from(zeros).ok()?)?)?
    } else {
        let removed = usize::try_from(scale.checked_neg()?).ok()?;
        let split = digits.len().checked_sub(removed)?;
        if split == 0 || split > 16 || !digits[split..].bytes().all(|byte| byte == b'0') { return None; }
        digits[..split].parse::<u64>().ok()?
    };
    (count <= MAX_COUNT).then_some(count)
}

fn component(raw: Option<&Value>, field: &str) -> Count {
    match raw {
        None => Count::Absent,
        Some(Value::Object(fields)) => match fields.get(field) {
            None => Count::Absent,
            Some(value) => whole(value).map(|value| Count::Valid { value }).unwrap_or(Count::Invalid),
        },
        Some(_) => Count::Invalid,
    }
}

fn add(left: &Count, right: &Count) -> Count {
    match (left, right) {
        (Count::Invalid, _) | (_, Count::Invalid) => Count::Invalid,
        (Count::Absent, _) | (_, Count::Absent) => Count::Absent,
        (Count::Valid { value: left }, Count::Valid { value: right }) => left.checked_add(*right)
            .filter(|sum| *sum <= MAX_COUNT).map(|value| Count::Valid { value }).unwrap_or(Count::Invalid),
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Accounting {
    pub input: Count,
    pub output: Count,
    pub components: BTreeMap<String, Count>,
    pub raw_usage: Option<Value>,
    pub raw_retention: String,
}

impl Accounting {
    pub fn usage(&self) -> Usage {
        Usage { input: self.input.value(), output: self.output.value(), cost: None, currency: None }
    }
}

pub fn normalize(provider: Provider, raw: Option<&Value>) -> Accounting {
    let mut components = BTreeMap::new();
    let (input, output) = match provider {
        Provider::OpenAi => (component(raw, "input_tokens"), component(raw, "output_tokens")),
        Provider::DeepSeek => (component(raw, "prompt_tokens"), component(raw, "completion_tokens")),
        Provider::Gemini => {
            let candidate = component(raw, "candidatesTokenCount");
            let thoughts = component(raw, "thoughtsTokenCount");
            let output = add(&candidate, &thoughts);
            components.insert("candidatesTokenCount".into(), candidate);
            components.insert("thoughtsTokenCount".into(), thoughts);
            (component(raw, "promptTokenCount"), output)
        }
    };
    let retention = match raw {
        None => "absent",
        Some(value) if !value.is_object() => "invalid-shape",
        Some(value) => {
            let rendered = value.to_string();
            if rendered.encode_utf16().count() > MAX_RAW_UNITS { "oversized" }
            else if diagnostics::fence(&rendered) != rendered { "credential-bearing" }
            else { "retained" }
        }
    };
    Accounting { input, output, components,
        raw_usage: if retention == "retained" { raw.cloned() } else { None },
        raw_retention: retention.into() }
}
