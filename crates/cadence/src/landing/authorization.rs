//! An owner grant covers one immutable landing version and one external step.
use super::model::{Authorization, Authorize, ExternalInput, Landing, Publish, Step};
use crate::{envelope::Refusal, milestone::model, store::{Error, Result}};
use serde_json::{Value, json};

pub fn refuse(code: &str, reason: impl Into<String>, landing: &str, step: &Step) -> Value {
    Refusal::new(code, reason).slot("request")
        .details(json!({"landing":landing,"step":step.name()})).value()
}

pub fn validate(request: &Authorize, landing: &Landing) -> Result<()> {
    for name in [&request.owner, &request.at, &request.request_id] { model::name(name)?; }
    if request.landing != landing.id || request.expected_generation != landing.generation
        || request.source != landing.source || request.base != landing.base || request.remote != landing.remote {
        return Err(Error::Invalid("authorization must echo the current landing version, source, base and remote".into()));
    }
    match &request.inputs {
        ExternalInput::Push => {},
        ExternalInput::Open { forge, title, body } => {
            super::forge::validate(forge)?;
            model::name(title)?;
            if body.len() > 32_768 || body.contains('\0') { return Err(Error::Invalid("PR body must be bounded text without NUL".into())); }
        }
        ExternalInput::Merge { forge, pr } => {
            super::forge::validate(forge)?;
            if *pr == 0 { return Err(Error::Invalid("PR identity must be positive".into())); }
        }
        ExternalInput::TagPush { tag, head } => {
            model::name(tag)?;
            if !super::effects::valid_ref(&format!("refs/tags/{tag}")) || !matches!(head.len(), 40 | 64)
                || !head.bytes().all(|b| b.is_ascii_hexdigit()) { return Err(Error::Invalid("tag push needs an exact tag and object ID".into())); }
        }
    }
    Ok(())
}

pub fn matching<'a>(landing: &'a Landing, request: &Publish, step: &Step) -> Option<&'a Authorization> {
    landing.authorizations.iter().find(|auth| {
        request.authorization.as_ref() == Some(&auth.id)
            && auth.request.inputs.step() == *step
            && request.inputs.as_ref() == Some(&auth.request.inputs)
            && validate(&auth.request, landing).is_ok()
            && request.expected_generation == landing.generation
    })
}
