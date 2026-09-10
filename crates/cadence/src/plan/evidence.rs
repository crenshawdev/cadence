//! Caller-owned specifications, published only within the exact plan approval.
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "mode", rename_all = "lowercase", deny_unknown_fields)]
pub enum Map {
    Attached { items: Vec<Item> },
    Provisional,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Association {
    pub truth_id: String,
    pub truth_version: u32,
    pub reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Item {
    Check {
        id: String,
        spec: Check,
        reason: String,
        associations: Vec<Association>,
    },
    Artifact {
        id: String,
        spec: Artifact,
        reason: String,
        associations: Vec<Association>,
    },
    Link {
        id: String,
        spec: Link,
        reason: String,
        associations: Vec<Association>,
    },
    Observation {
        id: String,
        spec: Observation,
        reason: String,
        associations: Vec<Association>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Check {
    pub command: String,
    pub expected: Expected,
    pub test: Test,
    pub setup: String,
    pub call: String,
    pub boundary: String,
    pub fakes: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase", deny_unknown_fields)]
pub enum Expected {
    Literal(String),
    Property(String),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Test {
    pub file: String,
    pub function: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Artifact {
    pub locators: Vec<String>,
    pub substance: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Link {
    pub caller: String,
    pub callee: String,
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    pub episode: String,
    pub specification: Specification,
    pub status: Pending,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Specification {
    pub source: String,
    pub document: String,
    pub approved_by: String,
    pub approved_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Pending {
    Pending,
}
