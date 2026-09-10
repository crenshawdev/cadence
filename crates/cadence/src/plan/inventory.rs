//! Conservative input inventory. Reading a legacy document does not approve it.
use super::persistence;
use cadence::store::{Error, Result, model::digest};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Inventory {
    pub occupied: Vec<u32>,
    pub high_water: u32,
    pub basis: String,
    pub documents: BTreeMap<String, String>,
}

pub fn phase_address(phase: &str) -> bool {
    !phase.is_empty()
        && phase
            .split('.')
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
}

fn number(name: &str) -> Option<u32> {
    if name == "PLAN.md" {
        return Some(1);
    }
    ["PLAN-", "SUMMARY-", "UAT-", "plan-"]
        .iter()
        .find_map(|prefix| name.strip_prefix(prefix))?
        .split('.')
        .next()?
        .parse::<u32>()
        .ok()
        .filter(|n| *n > 0)
}

pub fn read(root: &Path, phase: &str, data: &Value) -> Result<Inventory> {
    if !phase_address(phase) {
        return Err(Error::Invalid("invalid plan phase address".into()));
    }
    let mut occupied = BTreeSet::new();
    let mut documents = BTreeMap::new();
    let mut aliases = BTreeMap::new();
    for suffix in ["", "/reports"] {
        let dir = root.join(format!("phases/{phase}{suffix}"));
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error.into()),
        };
        for entry in entries {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let Some(n) = number(&name) else {
                continue;
            };
            occupied.insert(n);
            if suffix.is_empty()
                && name.starts_with("PLAN")
                && aliases.insert(n, name.clone()).is_some()
            {
                return Err(Error::Conflict(format!(
                    "ambiguous plan aliases for phase {phase} plan {n}"
                )));
            }
            // Symlinks are occupied, but their outside contents are not inputs.
            if entry.file_type()?.is_file() {
                let text = std::fs::read_to_string(entry.path())?;
                if name.starts_with("PLAN") && text.starts_with("---\n") {
                    for line in text.lines().skip(1).take_while(|line| *line != "---") {
                        if let Some((field, value)) = line.split_once(':') {
                            let value = value.trim().trim_matches(['\'', '"']);
                            let mismatch = match field {
                                "phase" => value != phase,
                                "plan" => value.parse::<u32>().ok() != Some(n),
                                _ => false,
                            };
                            if mismatch {
                                return Err(Error::Conflict(format!(
                                    "conflicting frontmatter in phases/{phase}/{name}: {field}: {value}"
                                )));
                            }
                        }
                    }
                }
                documents.insert(format!("phases/{phase}{suffix}/{name}"), text);
            }
        }
    }
    let mut high_water = occupied.last().copied().unwrap_or(0);
    if let Ok(phase) = phase.parse::<u32>() {
        if let Some(saved) = persistence::saved(data, phase)? {
            high_water = high_water.max(saved.high_water);
            occupied.extend(saved.consumed);
            occupied.extend(saved.publications.keys());
        }
        if let Some(execution) = data.get("execution") {
            let execution: cadence::execution::model::ExecutionSnapshot =
                serde_json::from_value(execution.clone())?;
            for occurrence in execution.occurrences.values().filter(|o| o.phase == phase) {
                occupied.extend(occurrence.plans.iter().map(|p| p.plan));
                if let Some(active) = &occurrence.active {
                    occupied.insert(active.plan);
                }
            }
        }
    }
    high_water = high_water.max(occupied.last().copied().unwrap_or(0));
    let occupied: Vec<_> = occupied.into_iter().collect();
    let basis = digest(&serde_json::to_vec(&(&occupied, high_water, &documents))?);
    Ok(Inventory {
        occupied,
        high_water,
        basis,
        documents,
    })
}
