use super::model::{Record, Status};
use std::fmt::Write;

pub fn render(record: &Record) -> String {
    let mut output = format!("# Spike: {}\n\nQuestion: {}\nDecision: {}\nStatus: {}\n\n## Criteria\n",
        record.slug, record.question, record.decision,
        if record.status == Status::Closed { "closed" } else { "open" });
    for (index, criterion) in record.criteria.iter().enumerate() {
        writeln!(output, "\n{}. {}\n   Given: {}\n   When: {}\n   Then: {}\n   Failure: {}",
            index + 1, criterion.id, criterion.given, criterion.when, criterion.then, criterion.failure).unwrap();
    }
    if !record.observations.is_empty() {
        output.push_str("\n## Results\n\nCaller-supplied observations; the binary does not adjudicate experimental truth.\n");
        for criterion in &record.criteria {
            if let Some(observation) = record.observations.iter().find(|o| o.criterion == criterion.id) {
                writeln!(output, "\n- {}: {}", observation.criterion, observation.result).unwrap();
            }
        }
    }
    if let Some(verdict) = &record.verdict { writeln!(output, "\nVerdict: {}", verdict.word()).unwrap(); }
    if let Some(location) = &record.throwaway_location { writeln!(output, "\nThrowaway location: {location}").unwrap(); }
    output
}
