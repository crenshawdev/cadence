//! Specialist selection over already-retained targets. No live target reads.
use super::model::{Manifest, Routing, Specialist, Target};
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct MinimalismRequest {
    pub specialist: Specialist,
    pub target: String,
    pub reviewers: Vec<String>,
    pub ordinary_routing: Option<Routing>,
}

/// The caller supplies a retained manifest, including the frozen membership or
/// resolved range. Ordinary routing cannot change this specialist's one voice.
/// Decision/diagnosis targets retain their own specialist/context contract.
pub fn minimalism_request(
    retained: &Manifest,
    _ordinary_routing: &Routing,
) -> Result<MinimalismRequest, &'static str> {
    match retained.target {
        Target::NamedFile { .. } | Target::Directory { .. } | Target::PhaseRange { .. } => {
            Ok(MinimalismRequest {
                specialist: Specialist::Minimalism,
                target: retained.manifest.clone(),
                reviewers: vec!["base".into()],
                ordinary_routing: None,
            })
        }
        _ => Err("unsupported-minimalism-target"),
    }
}
