//! Conservative input inventory. Reading a legacy document does not approve it.
use super::persistence;
use cadence::store::{Error, Result, model::digest};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Inventory {
    pub occupied: Vec<u32>,
    pub high_water: u32,
    pub basis: String,
    pub documents: BTreeMap<String, String>,
    #[serde(default)]
    pub provenance: BTreeMap<u32, BTreeSet<String>>,
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
    let mut provenance: BTreeMap<u32, BTreeSet<String>> = BTreeMap::new();
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
            let path = format!("phases/{phase}{suffix}/{name}");
            if matches!(name.as_str(), "SUMMARY.md" | "UAT.md") && entry.file_type()?.is_file() {
                documents.insert(path.clone(), std::fs::read_to_string(entry.path())?);
            }
            let Some(n) = number(&name) else {
                continue;
            };
            occupied.insert(n);
            provenance.entry(n).or_default().insert(path.clone());
            if name.starts_with("PLAN-") && name != format!("PLAN-{n}.md") {
                return Err(Error::Conflict(format!(
                    "ambiguous plan alias {path} for phase {phase} plan {n}; explicit resolution required"
                )));
            }
            if suffix.is_empty()
                && name.starts_with("PLAN")
                && aliases.insert(n, name.clone()).is_some()
            {
                return Err(Error::Conflict(format!(
                    "ambiguous plan aliases at {path} for phase {phase} plan {n}; explicit resolution required"
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
                                    "conflicting frontmatter in phases/{phase}/{name}: {field}: {value}; explicit resolution required"
                                )));
                            }
                        }
                    }
                }
                documents.insert(format!("phases/{phase}{suffix}/{name}"), text);
            }
        }
    }
    let high_water = occupied.last().copied().unwrap_or(0);
    with_records(
        Inventory {
            occupied: occupied.into_iter().collect(),
            high_water,
            basis: String::new(),
            documents,
            provenance,
        },
        phase,
        data,
    )
}

pub fn with_records(input: Inventory, phase: &str, data: &Value) -> Result<Inventory> {
    let mut occupied: BTreeSet<_> = input.occupied.into_iter().collect();
    let mut high_water = input.high_water;
    let documents = input.documents;
    let mut provenance = input.provenance;
    if let Ok(number) = phase.parse::<u32>() && number.to_string() == phase {
        let phase = number;
        if let Some(saved) = persistence::saved(data, phase)? {
            high_water = high_water.max(saved.high_water);
            occupied.extend(saved.consumed);
            occupied.extend(saved.publications.keys());
            for (number, sources) in saved.provenance {
                provenance.entry(number).or_default().extend(sources);
            }
        }
        if let Some(execution) = data.get("execution") {
            let execution: cadence::execution::model::ExecutionSnapshot =
                serde_json::from_value(execution.clone())?;
            for (id, occurrence) in execution.occurrences.iter().filter(|(_, o)| o.phase == phase) {
                let mut numbers: BTreeSet<_> = occurrence.plans.iter().map(|p| p.plan).collect();
                numbers.extend(occurrence.receipts.values().map(|r| r.outcome.plan));
                if let Some(active) = &occurrence.active {
                    numbers.insert(active.plan);
                }
                for number in numbers {
                    occupied.insert(number);
                    provenance.entry(number).or_default().insert(format!("execution:{id}:plan:{number}"));
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
        provenance,
    })
}
