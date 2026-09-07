use serde::{Deserialize, Serialize};

pub const EXECUTION_SCHEMA: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaskSpec {
    pub id: String,
    pub verify: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ExecutionPlan {
    pub phase: u32,
    pub plan: u32,
    pub requirements: Vec<String>,
    pub files: Vec<String>,
    pub schema: u32,
    pub suite: String,
    pub tasks: Vec<TaskSpec>,
    pub body: String,
    pub fingerprint: String,
}
