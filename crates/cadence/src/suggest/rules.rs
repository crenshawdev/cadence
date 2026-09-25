use crate::config::roles::RUNGS;
use serde_json::{Value, json};

const ESCALATIONS: usize = 2;
const HELD_DECISIONS: usize = 4;
const FAILED_FIRES: usize = 2;

pub struct RoutingDecision {
    pub id: String,
    pub escalated: bool,
    pub rung: Option<String>,
}

pub struct GateFire {
    pub id: String,
    pub failed: bool,
}

fn unpriced(key: &str, counted: usize) -> Value {
    json!({"key":key,"priced":false,"counted":counted})
}

fn priced(key: &str, layer: &str, current: &str, proposed: &str, mut evidence: Value) -> Value {
    // Journal order selects the landed rung; identity order makes evidence
    // stable across native revisions and reopening the store.
    evidence["decisions"].as_array_mut().expect("decision ids")
        .sort_by(|a, b| a.as_str().cmp(&b.as_str()));
    json!({"key":key,"layer":layer,"current":current,"proposed":proposed,"evidence":evidence,
        "apply":{"operation":"config-apply","layer":layer,"updates":[{"key":key,"value":proposed}]}})
}

pub fn role(key: &str, layer: &str, current: &str, decisions: &[RoutingDecision]) -> Value {
    let escalated = decisions.iter().filter(|d| d.escalated).count();
    let evidence = json!({"counted":decisions.len(),"escalated":escalated,
        "decisions":decisions.iter().map(|d| &d.id).collect::<Vec<_>>()});
    if escalated >= ESCALATIONS {
        let landed = decisions.iter().rev().filter(|d| d.escalated).find_map(|d| d.rung.as_deref());
        if let Some(proposed) = landed
            && let (Some(start), Some(end)) = (
                RUNGS.iter().position(|r| *r == current), RUNGS.iter().position(|r| *r == proposed),
            )
            && end > start
        {
            return priced(key, layer, current, proposed, evidence);
        }
    } else if escalated == 0 && decisions.len() >= HELD_DECISIONS {
        return json!({"key":key,"priced":false,"counted":decisions.len(),"current":current,
            "information":"starting-rung-held","evidence":evidence});
    }
    unpriced(key, decisions.len())
}

pub fn gate(key: &str, layer: &str, current: &str, fires: &[GateFire]) -> Value {
    let failed = fires.iter().filter(|fire| fire.failed).count();
    if failed >= FAILED_FIRES {
        let proposed = match current {
            "off" | "advisory" | "deferred" => Some("blocking"),
            "blocking" => Some("adjudicated"),
            _ => None,
        };
        if let Some(proposed) = proposed {
            return priced(key, layer, current, proposed, json!({"counted":fires.len(),
                "escalated":0,"failed":failed,"decisions":fires.iter().map(|f| &f.id).collect::<Vec<_>>()}));
        }
    }
    unpriced(key, fires.len())
}
