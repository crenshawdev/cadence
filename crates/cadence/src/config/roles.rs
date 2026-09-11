pub use cadence::execution::model::{
    RoleResolution as Resolution, RoleSelection as Selection, RoleStored as Stored,
};
use cadence::store::{Error, Result};
use serde_json::Value;

pub const ROLES: [&str; 6] = [
    "cad-planner",
    "cad-assumptions-analyzer",
    "cad-verifier",
    "cad-reviewer",
    "cad-executor",
    "cad-plan-checker",
];
pub const RUNGS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];
pub const HOST_MODELS: [&str; 4] = ["opus", "sonnet", "haiku", "fable"];
const AGENTS: [[&str; 5]; 6] = [
    [
        "cad-planner-low",
        "cad-planner-medium",
        "cad-planner",
        "cad-planner-xhigh",
        "cad-planner-max",
    ],
    [
        "cad-assumptions-analyzer-low",
        "cad-assumptions-analyzer-medium",
        "cad-assumptions-analyzer-high",
        "cad-assumptions-analyzer",
        "cad-assumptions-analyzer-max",
    ],
    [
        "cad-verifier-low",
        "cad-verifier-medium",
        "cad-verifier",
        "cad-verifier-xhigh",
        "cad-verifier-max",
    ],
    [
        "cad-reviewer-low",
        "cad-reviewer-medium",
        "cad-reviewer",
        "cad-reviewer-xhigh",
        "cad-reviewer-max",
    ],
    [
        "cad-executor-low",
        "cad-executor-medium",
        "cad-executor",
        "cad-executor-xhigh",
        "cad-executor-max",
    ],
    [
        "cad-plan-checker",
        "cad-plan-checker-medium",
        "cad-plan-checker-high",
        "cad-plan-checker-xhigh",
        "cad-plan-checker-max",
    ],
];

#[derive(Clone, Debug)]
pub struct Input {
    pub role: String,
    pub phase: Option<u32>,
    pub plan: Option<u32>,
    pub attempt: u32,
    pub default_effort: String,
    pub role_effort: Option<Stored>,
    pub legacy_effort: Option<Stored>,
    pub role_model: Option<Stored>,
    pub legacy_model: Option<Stored>,
    pub escalate_on_failure: bool,
}

fn selection(
    role: &str,
    leaf: &str,
    primary: &Option<Stored>,
    legacy: &Option<Stored>,
) -> Selection {
    if let Some(stored) = primary {
        Selection {
            kind: if stored.value.is_null() {
                "reset"
            } else {
                "role"
            }
            .into(),
            key: stored.key.clone(),
            layer: stored.layer.clone(),
            stored: Some(stored.value.clone()),
            ignored_legacy: legacy.clone(),
        }
    } else if let Some(stored) = legacy.as_ref().filter(|stored| !stored.value.is_null()) {
        Selection {
            kind: "legacy".into(),
            key: stored.key.clone(),
            layer: stored.layer.clone(),
            stored: Some(stored.value.clone()),
            ignored_legacy: None,
        }
    } else {
        Selection {
            kind: "absent".into(),
            key: format!("roles.{role}.{leaf}"),
            layer: if leaf == "model" {
                "session"
            } else {
                "defaults"
            }
            .into(),
            stored: None,
            ignored_legacy: None,
        }
    }
}

pub fn resolve(input: &Input) -> Result<Resolution> {
    let role = ROLES
        .iter()
        .position(|role| *role == input.role)
        .ok_or_else(|| Error::Invalid("unknown routing role".into()))?;
    if input.attempt == 0
        || input.phase == Some(0)
        || input.plan == Some(0)
        || input.plan.is_some() && input.phase.is_none()
    {
        return Err(Error::Invalid(
            "route requires a positive attempt and positive phase/plan; a plan requires a phase"
                .into(),
        ));
    }
    let effort_source = selection(
        &input.role,
        "effort",
        &input.role_effort,
        &input.legacy_effort,
    );
    let mut model_source = selection(&input.role, "model", &input.role_model, &input.legacy_model);
    let starting_rung = effort_source
        .stored
        .as_ref()
        .and_then(Value::as_str)
        .unwrap_or(&input.default_effort);
    let start = RUNGS
        .iter()
        .position(|rung| *rung == starting_rung)
        .ok_or_else(|| Error::Invalid("selected effort has no installed rung".into()))?;
    let rung = if input.escalate_on_failure && input.attempt > 1 {
        (start + 1).min(RUNGS.len() - 1)
    } else {
        start
    };
    let mut warnings = Vec::new();
    let requested_model = model_source.stored.as_ref().and_then(Value::as_str);
    let model = match requested_model {
        Some(model) if HOST_MODELS.contains(&model) => Some(model.to_owned()),
        Some(model) => {
            warnings.push(format!("{}={} is unsupported; supported host aliases are opus/sonnet/haiku/fable; omit model without legacy fallback", model_source.key, serde_json::to_string(model)?));
            model_source.kind = "unsupported".into();
            None
        }
        None => None,
    };
    let pinned = model.is_some() && model_source.kind == "legacy";
    let mut reasons = vec![
        format!(
            "{}: {} from {}; starting rung {}",
            effort_source.key, effort_source.kind, effort_source.layer, starting_rung
        ),
        format!(
            "{}: {} from {}; {}",
            model_source.key,
            model_source.kind,
            model_source.layer,
            model.as_deref().unwrap_or("omit model; inherit session")
        ),
    ];
    for source in [&effort_source, &model_source] {
        if let Some(ignored) = &source.ignored_legacy {
            reasons.push(format!(
                "{} from {} is ignored by {}",
                ignored.key, ignored.layer, source.key
            ));
        }
    }
    if input.attempt > 1 {
        reasons.push(if rung != start {
            format!(
                "retry advances once from {} to {}",
                starting_rung, RUNGS[rung]
            )
        } else if input.escalate_on_failure {
            format!("retry holds at top rung {}", RUNGS[rung])
        } else {
            format!("retry escalation disabled; hold {}", RUNGS[rung])
        });
    }
    Ok(Resolution {
        role: input.role.clone(),
        agent: AGENTS[role][rung].into(),
        rung: RUNGS[rung].into(),
        starting_rung: starting_rung.into(),
        model,
        effort_source,
        model_source,
        attempt: input.attempt,
        escalated: rung != start,
        pinned,
        reasons,
        warnings,
    })
}

pub fn agent_for(role: &str, rung: &str) -> Option<&'static str> {
    let role = ROLES.iter().position(|candidate| *candidate == role)?;
    let rung = RUNGS.iter().position(|candidate| *candidate == rung)?;
    Some(AGENTS[role][rung])
}
