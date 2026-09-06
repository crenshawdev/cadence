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
