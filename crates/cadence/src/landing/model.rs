use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Revision { pub branch: String, pub head: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Remote { pub name: String, pub url: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Start {
    pub request_id: String,
    pub occurrence: String,
    pub expected_generation: u64,
    pub source: Revision,
    pub base: Revision,
    pub remote: Remote,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Publish {
    pub request_id: String,
    pub landing: String,
    pub expected_generation: u64,
    #[serde(default)]
    pub authorization: Option<String>,
    #[serde(default)]
    pub inputs: Option<ExternalInput>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Forge { pub provider: String, pub repo: String, pub host: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "step", rename_all = "kebab-case", deny_unknown_fields)]
pub enum ExternalInput {
    Push,
    Open { forge: Forge, title: String, body: String },
    Merge { forge: Forge, pr: u64 },
    TagPush { tag: String, head: String },
}
impl ExternalInput {
    pub fn step(&self) -> Step {
        match self { Self::Push => Step::Publish, Self::Open { .. } => Step::Open,
            Self::Merge { .. } => Step::Merge, Self::TagPush { .. } => Step::TagPush }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Authorize {
    pub request_id: String,
    pub landing: String,
    pub expected_generation: u64,
    pub source: Revision,
    pub base: Revision,
    pub remote: Remote,
    pub inputs: ExternalInput,
    pub owner: String,
    pub at: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Authorization { pub id: String, #[serde(flatten)] pub request: Authorize }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Merged { pub forge: Forge, pub pr: u64, pub commit: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Tag { pub name: String, pub message: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ConfirmMerge {
    pub request_id: String,
    pub landing: String,
    pub expected_generation: u64,
    pub source: Revision,
    pub base: Revision,
    pub remote: Remote,
    pub merged: Merged,
    pub tag: Option<Tag>,
    pub reap: bool,
    pub owner: String,
    pub at: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Confirmation { pub id: String, #[serde(flatten)] pub request: ConfirmMerge }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct LocalRequest { pub request_id: String, pub landing: String, pub expected_generation: u64 }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocalIntent {
    pub request: LocalRequest,
    pub step: Step,
    pub confirmation: String,
    pub invocation: super::effects::Invocation,
    pub before: super::cleanup::State,
    pub intended: super::cleanup::State,
    pub actual: Option<super::cleanup::State>,
    pub failure: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Intent {
    pub request: Publish,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operation: Option<String>,
    pub authorization: Authorization,
    pub invocation: super::effects::Invocation,
    pub failure: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum Apply {
    #[serde(rename = "land-start")]
    Start { request: Start },
    #[serde(rename = "land-publish")]
    Publish { request: Publish },
    #[serde(rename = "land-authorize")]
    Authorize { request: Authorize },
    #[serde(rename = "land-open")]
    Open { request: Publish },
    #[serde(rename = "land-merge")]
    Merge { request: Publish },
    #[serde(rename = "land-tag-push")]
    TagPush { request: Publish },
    #[serde(rename = "land-resume")]
    Resume { request: Publish },
    #[serde(rename = "land-confirm-merge")]
    ConfirmMerge { request: ConfirmMerge },
    #[serde(rename = "land-checkout")]
    Checkout { request: LocalRequest },
    #[serde(rename = "land-pull")]
    Pull { request: LocalRequest },
    #[serde(rename = "land-tag")]
    Tag { request: LocalRequest },
    #[serde(rename = "land-reap")]
    Reap { request: LocalRequest },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Step { #[serde(rename = "push", alias = "publish")] Publish, Open, Merge, Checkout, Pull, Tag, TagPush, Reap }
impl Step {
    pub fn name(&self) -> &'static str {
        match self { Self::Publish => "push", Self::Open => "open", Self::Merge => "merge",
            Self::Checkout => "checkout", Self::Pull => "pull", Self::Tag => "tag", Self::TagPush => "tag-push", Self::Reap => "reap" }
    }
    pub fn operation(&self) -> &'static str {
        match self { Self::Publish => "land-publish", Self::Open => "land-open", Self::Merge => "land-merge",
            Self::TagPush => "land-tag-push", Self::Checkout => "land-checkout", Self::Pull => "land-pull",
            Self::Tag => "land-tag", Self::Reap => "land-reap" }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct StepSlot {
    pub step: Step,
    pub receipt: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intent: Option<Intent>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_intent: Option<LocalIntent>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Landing {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release: Option<crate::milestone::release::Intent>,
    pub id: String,
    pub root_binding: String,
    pub occurrence: String,
    pub generation: u64,
    pub source: Revision,
    pub base: Revision,
    pub remote: Remote,
    pub steps: Vec<StepSlot>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub authorizations: Vec<Authorization>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub merge_confirmation: Option<Confirmation>,
}
impl Landing {
    pub fn new(root: String, request: &Start) -> Self {
        Self { id: crate::milestone::model::identity("landing", &root, &request.occurrence), root_binding: root,
            occurrence: request.occurrence.clone(), generation: 1, source: request.source.clone(), base: request.base.clone(), remote: request.remote.clone(),
            steps: [Step::Publish, Step::Open, Step::Merge, Step::Checkout, Step::Pull, Step::Tag, Step::TagPush, Step::Reap]
                .into_iter().map(|step| StepSlot { step, receipt: None, intent: None, local_intent: None }).collect(),
            authorizations: vec![], merge_confirmation: None, release: None }
    }
}
