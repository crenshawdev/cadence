use super::*;
use crate::store::model::digest;

pub const DOMAIN: &str = "cadence.lifecycle";
pub const ENCODING_VERSION: u64 = 1;
pub const SEMANTICS_VERSION: u64 = 1;

fn number(out: &mut Vec<u8>, n: u64) {
    out.extend(n.to_be_bytes());
}
fn bytes(out: &mut Vec<u8>, value: &[u8]) {
    number(out, value.len() as u64);
    out.extend(value);
}
fn observation<T>(
    out: &mut Vec<u8>,
    value: &Observation<T>,
    present: impl FnOnce(&mut Vec<u8>, &T),
) {
    match value {
        Observation::Absent => out.push(0),
        Observation::Present(value) => {
            out.push(1);
            present(out, value);
        }
        Observation::Failed(error) => {
            out.push(2);
            out.push(match error.category {
                InputFailureCategory::PermissionDenied => 1,
                InputFailureCategory::NotDirectory => 2,
                InputFailureCategory::InvalidPath => 3,
                InputFailureCategory::SymlinkLoop => 4,
                InputFailureCategory::OtherIo => 5,
            });
        }
    }
}

pub fn encode_inputs(capture: &CapturedInputs) -> Result<Vec<u8>, DerivationError> {
    encode_versioned(capture, DOMAIN, ENCODING_VERSION, SEMANTICS_VERSION)
}

pub(crate) fn encode_versioned(
    capture: &CapturedInputs,
    domain: &str,
    encoding: u64,
    semantics: u64,
) -> Result<Vec<u8>, DerivationError> {
    let mut out = Vec::new();
    bytes(&mut out, domain.as_bytes());
    number(&mut out, encoding);
    number(&mut out, semantics);
    bytes(&mut out, capture.root.as_os_str().as_encoded_bytes());
    observation(&mut out, &capture.root_probe, |_, _| {});
    observation(&mut out, &capture.roadmap, |out, value| bytes(out, value));
    let phases = capture
        .declarations
        .as_ref()
        .and_then(|d| d.as_ref().ok())
        .map(|d| d.phases.as_slice())
        .unwrap_or_default();
    number(&mut out, phases.len() as u64);
    for phase in phases {
        bytes(&mut out, phase.id.address().as_bytes());
        bytes(&mut out, phase.relative_path.as_os_str().as_encoded_bytes());
        let observed = capture
            .phases
            .iter()
            .find(|p| p.relative_path == phase.relative_path)
            .ok_or_else(|| {
                DerivationError::InputFailure(InputFailure {
                    path: capture.root.join(&phase.relative_path),
                    category: InputFailureCategory::InvalidPath,
                    diagnostic: Some("missing addressed phase observation".into()),
                })
            })?;
        observation(&mut out, &observed.plans, |out, names| {
            let mut names = names.iter().collect::<Vec<_>>();
            names.sort();
            number(out, names.len() as u64);
            for name in names {
                bytes(out, name.as_bytes());
            }
        });
        observation(&mut out, &observed.summary, |_, _| {});
        observation(&mut out, &observed.uat, |out, value| bytes(out, value));
    }
    Ok(out)
}

pub fn input_key(capture: &CapturedInputs) -> Result<String, DerivationError> {
    Ok(digest(&encode_inputs(capture)?))
}

use serde_json::Value;

fn conflict(key: &str, raw: Option<&Value>, fields: Vec<String>) -> DerivationError {
    DerivationError::DerivationConflict {
        requested_hash: key.into(),
        stored_hash: raw
            .and_then(|r| r.get("input_hash"))
            .and_then(Value::as_str)
            .map(str::to_owned),
        fields,
    }
}

pub fn memo_from_data<'a>(
    data: &'a Value,
    key: &str,
) -> Result<Option<&'a Value>, DerivationError> {
    if !data.is_object() && !data.is_null() {
        return Err(conflict(key, None, vec!["data".into()]));
    }
    match data.get("derivation") {
        None => Ok(None),
        Some(Value::Object(namespace)) => Ok(namespace.get("memo")),
        Some(_) => Err(conflict(key, None, vec!["data.derivation".into()])),
    }
}

fn malformed_answer(raw: &Value) -> Result<Lifecycle, String> {
    fn field<'a>(value: &'a Value, name: &str, prefix: &str) -> Result<&'a Value, String> {
        value.get(name).ok_or_else(|| format!("{prefix}{name}"))
    }
    fn typed<T: serde::de::DeserializeOwned>(value: &Value, path: &str) -> Result<T, String> {
        serde_json::from_value(value.clone()).map_err(|_| path.into())
    }
    let cycle: Cycle = typed(field(raw, "cycle", "")?, "cycle")?;
    let current: Option<PhaseId> = typed(field(raw, "current", "")?, "current")?;
    let total: usize = typed(field(raw, "total", "")?, "total")?;
    let entries = field(raw, "phases", "")?.as_array().ok_or("phases")?;
    let mut phases = Vec::new();
    for (i, entry) in entries.iter().enumerate() {
        let prefix = format!("phases[{i}].");
        let get = |name: &str| field(entry, name, &prefix);
        let id: PhaseId = typed(get("id")?, &format!("{prefix}id"))?;
        if id.number().is_nan() || id.number() < 0.0 {
            return Err(format!("{prefix}id"));
        }
        let name: String = typed(get("name")?, &format!("{prefix}name"))?;
        if name.is_empty() {
            return Err(format!("{prefix}name"));
        }
        let plans: Vec<String> = typed(get("plans")?, &format!("{prefix}plans"))?;
        let status = typed(get("status")?, &format!("{prefix}status"))?;
        let raw_uat = get("uat")?;
        let uat = if raw_uat.is_null() {
            None
        } else {
            let mut counts = UatCounts::default();
            for (name, dest) in [
                ("pass", &mut counts.pass),
                ("fail", &mut counts.fail),
                ("pending", &mut counts.pending),
                ("skipped", &mut counts.skipped),
                ("blocked", &mut counts.blocked),
            ] {
                let path = format!("{prefix}uat.{name}");
                *dest = typed(raw_uat.get(name).ok_or(path.clone())?, &path)?;
            }
            Some(counts)
        };
        phases.push(PhaseRecord {
            id,
            name,
            plans,
            status,
            uat,
        });
    }

    Ok(Lifecycle {
        cycle,
        current,
        total,
        phases,
    })
}

fn validate_structure(answer: &Lifecycle) -> Result<(), String> {
    let Lifecycle {
        cycle,
        current,
        total,
        phases,
    } = answer;
    if *total != phases.len() {
        return Err("total".into());
    }
    if (*cycle == Cycle::Closed) != phases.is_empty() {
        return Err("cycle".into());
    }
    if *current
        != phases
            .iter()
            .find(|p| p.status != LifecycleStatus::Complete)
            .map(|p| p.id)
    {
        return Err("current".into());
    }
    if phases.windows(2).any(|p| p[0].id > p[1].id) {
        return Err("phases".into());
    }
    for (i, phase) in phases.iter().enumerate() {
        if phase.plans.windows(2).any(|p| p[0] >= p[1])
            || phase.plans.iter().any(|name| {
                name != "PLAN.md"
                    && !name
                        .strip_prefix("PLAN-")
                        .and_then(|n| n.strip_suffix(".md"))
                        .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
            })
        {
            return Err(format!("phases[{i}].plans"));
        }
        if (phase.status == LifecycleStatus::Unplanned && !phase.plans.is_empty())
            || (phase.status == LifecycleStatus::Planned && phase.plans.is_empty())
        {
            return Err(format!("phases[{i}].status"));
        }
        if phase.status == LifecycleStatus::Complete
            && phase.uat.as_ref().is_none_or(|u| {
                (u.pass == 0 && u.skipped == 0) || u.fail != 0 || u.pending != 0 || u.blocked != 0
            })
        {
            return Err(format!("phases[{i}].uat"));
        }
    }
    Ok(())
}

fn differences(stored: &Lifecycle, fresh: &Lifecycle) -> Vec<String> {
    let mut fields = Vec::new();
    if stored.cycle != fresh.cycle {
        fields.push("cycle".into());
    }
    if stored.current != fresh.current {
        fields.push("current".into());
    }
    if stored.total != fresh.total {
        fields.push("total".into());
    }
    if stored.phases.len() != fresh.phases.len() {
        fields.push("phases".into());
    }
    for (i, (a, b)) in stored.phases.iter().zip(&fresh.phases).enumerate() {
        let prefix = format!("phases[{i}]");
        if a.id != b.id {
            fields.push(format!("{prefix}.id"));
        }
        if a.name != b.name {
            fields.push(format!("{prefix}.name"));
        }
        if a.plans != b.plans {
            fields.push(format!("{prefix}.plans"));
        }
        if a.status != b.status {
            fields.push(format!("{prefix}.status"));
        }
        match (&a.uat, &b.uat) {
            (Some(a), Some(b)) => {
                for (name, a, b) in [
                    ("pass", a.pass, b.pass),
                    ("fail", a.fail, b.fail),
                    ("pending", a.pending, b.pending),
                    ("skipped", a.skipped, b.skipped),
                    ("blocked", a.blocked, b.blocked),
                ] {
                    if a != b {
                        fields.push(format!("{prefix}.uat.{name}"));
                    }
                }
            }
            (a, b) if a != b => fields.push(format!("{prefix}.uat")),
            _ => {}
        }
    }
    fields
}

pub fn check_memo(
    raw: Option<&Value>,
    key: &str,
    fresh: &Lifecycle,
) -> Result<MemoDisposition, DerivationError> {
    let Some(raw) = raw else {
        return Ok(MemoDisposition::Miss);
    };
    let bad = |field: &str| conflict(key, Some(raw), vec![field.into()]);
    let encoding = raw
        .get("encoding_version")
        .and_then(Value::as_u64)
        .filter(|v| *v > 0)
        .ok_or_else(|| bad("encoding_version"))?;
    let semantics = raw
        .get("semantics_version")
        .and_then(Value::as_u64)
        .filter(|v| *v > 0)
        .ok_or_else(|| bad("semantics_version"))?;
    let hash = raw
        .get("input_hash")
        .and_then(Value::as_str)
        .filter(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
        .ok_or_else(|| bad("input_hash"))?;
    let answer = raw
        .get("answer")
        .filter(|a| a.is_object())
        .ok_or_else(|| bad("answer"))?;
    if encoding != ENCODING_VERSION || semantics != SEMANTICS_VERSION {
        return Ok(MemoDisposition::Miss);
    }
    let stored = malformed_answer(answer).map_err(|field| bad(&field))?;
    if hash != key {
        validate_structure(&stored).map_err(|field| bad(&field))?;
        return Ok(MemoDisposition::Miss);
    }
    let fields = differences(&stored, fresh);
    if fields.is_empty() {
        validate_structure(&stored).map_err(|field| bad(&field))?;
        Ok(MemoDisposition::Hit)
    } else {
        Err(conflict(key, Some(raw), fields))
    }
}

impl LifecycleMemo {
    pub fn fresh(key: String, answer: Lifecycle) -> Self {
        Self {
            encoding_version: ENCODING_VERSION,
            semantics_version: SEMANTICS_VERSION,
            input_hash: key,
            answer,
        }
    }
}
