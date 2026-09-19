use super::{Capability, ReadDomain, model::{ReadRequest, Unit}, outline, source};
use serde_json::{Value, json};

use crate::envelope::Refusal;
use std::path::{Path, PathBuf};

pub(super) const ANSWER_BOUND: usize = 65_536;

fn refusal(slot: &str, code: &str, reason: impl Into<String>) -> Value {
    Refusal::new(code, reason).rule("D-147").slot(slot).value()
}

/// The units a caller can name in `path`, and a note when the outline that
/// should have produced them was unavailable.
///
/// A file with no grammar, and a file whose grammar found nothing to name, is
/// one unit spanning the whole file, so every file stays readable by name.
pub(super) fn nameable_units(path: &Path, content: &str) -> (Vec<Unit>, Vec<&'static str>) {
    let outline = outline::outline(path, content, ANSWER_BOUND);
    let notes = outline.error.map(outline::OutlineError::note).into_iter().collect();
    if outline.units.is_empty() { (source::fallback(path, content), notes) } else { (outline.units, notes) }
}

impl ReadDomain {
    /// Resolve only resident-issued capabilities, retaining their exact span.
    pub fn acquire(&self, token: &str) -> Result<(String, Vec<u8>), Value> {
        let (path, revision, span) = match self.registry.get(token) {
            Some(Capability::Unit { path, revision, unit, .. }) => (path, revision, Some(unit.first_byte..unit.last_byte)),
            Some(Capability::File { path, revision }) => (path, revision, None),
            _ => return Err(refusal("location", "location-not-issued", "location was not issued by this resident")),
        };
        let content = self.current(&path, &revision)?;
        let bytes = match span {
            Some(span) => content.get(span).ok_or_else(|| refusal("location", "stale-location", "issued span no longer exists"))?.as_bytes().to_vec(),
            None => content.into_bytes(),
        };
        Ok((path.to_string_lossy().into_owned(), bytes))
    }
    pub(super) fn read(&mut self, request: ReadRequest) -> Value {
        match (request.location, request.file, request.unit) {
            (Some(location), None, None) => self.read_location(&location),
            (None, Some(file), Some(name)) => self.read_named(&file, &name),
            (None, Some(file), None) => self.read_file(&file),
            _ => refusal("location", "read-contract", "read accepts exactly an issued location, or an issued file reference and unit name"),
        }
    }

    fn current(&self, path: &Path, expected: &str) -> Result<String, Value> {
        let (_, revision, content) = source::content(&self.project, path).map_err(|reason| refusal("location", "location-not-issued", reason))?;
        if revision != expected { return Err(refusal("location", "stale-location", "source changed; reacquire through search")); }
        Ok(content)
    }

    fn read_location(&mut self, token: &str) -> Value {
        let Some(Capability::Unit { path, revision, unit, offset }) = self.registry.get(token) else {
            return refusal("location", "location-not-issued", "location was not issued by this resident");
        };
        let content = match self.current(&path, &revision) { Ok(content) => content, Err(answer) => return answer };
        if offset < unit.first_byte || offset > unit.last_byte { return refusal("location", "location-not-issued", "location is outside its issued unit"); }
        self.slice(path, revision, unit, offset, &content)
    }

    fn read_named(&mut self, token: &str, name: &str) -> Value {
        let Some(Capability::File { path, revision }) = self.registry.get(token) else { return refusal("file", "location-not-issued", "file reference was not issued by this resident"); };
        let content = match self.current(&path, &revision) { Ok(content) => content, Err(answer) => return answer };
        let (units, notes) = nameable_units(&path, &content);
        // An exact qualified name wins outright; otherwise every unit whose
        // bare name matches is a candidate, and two candidates are ambiguous
        // rather than a silent pick.
        let exact: Vec<_> = units.iter().filter(|unit| unit.name == name).cloned().collect();
        let matches = if exact.is_empty() { units.iter().filter(|unit| unit.bare == name).cloned().collect() } else { exact };
        if matches.len() != 1 {
            let missing = matches.is_empty();
            let selected = if missing { units } else { matches };
            let reason = if missing { "missing-unit" } else { "ambiguous-unit" };
            return self.outline(path, revision, selected, notes, Some(reason));
        }
        let unit = matches.into_iter().next().unwrap();
        self.slice(path, revision, unit.clone(), unit.first_byte, &content)
    }

    /// A file reference answers with the whole file when it is small enough to
    /// read at once, and with its outline when it is not.
    ///
    /// The cutoff is grammar-aware: a file with a grammar is outlined from
    /// 24 KB, because an outline is a map of the file and a better answer than
    /// the whole of anything large. A file without a grammar has no map to
    /// offer, so it is served as one slice with a continuation.
    fn read_file(&mut self, token: &str) -> Value {
        let Some(Capability::File { path, revision }) = self.registry.get(token) else { return refusal("file", "location-not-issued", "file reference was not issued by this resident"); };
        let content = match self.current(&path, &revision) { Ok(content) => content, Err(answer) => return answer };
        if outline::grammar_for_path(&path).is_none() || content.len() <= outline::OUTLINE_THRESHOLD {
            let whole = source::fallback(&path, &content).remove(0);
            return self.slice(path, revision, whole, 0, &content);
        }
        let (units, notes) = nameable_units(&path, &content);
        self.outline(path, revision, units, notes, None)
    }

    fn slice(&mut self, path: PathBuf, revision: String, unit: Unit, offset: usize, content: &str) -> Value {
        let tail = content.get(offset..unit.last_byte).unwrap_or("");
        let mut end = unit.last_byte;
        let fixed = 512usize;
        if tail.len() + fixed > ANSWER_BOUND {
            let cap = ANSWER_BOUND - fixed;
            let mut count = cap.min(tail.len());
            while count > 0 && !tail.is_char_boundary(count) { count -= 1; }
            end = offset + count;
        }
        let truncated = end < unit.last_byte;
        let continuation = truncated.then(|| self.registry.unit(path.clone(), revision.clone(), unit.clone(), end));
        let starts = source::line_starts(content);
        let served_first = source::line_for(&starts, offset);
        let served_last = source::line_for(&starts, end.saturating_sub(1));
        let continue_from_line = truncated.then(|| source::line_for(&starts, end));
        let continue_from_byte = continue_from_line.map(|line| end.saturating_sub(starts[line - 1]));
        json!({"status":"ok","kind":"slice","bound":ANSWER_BOUND,"source_revision":revision,"name":unit.name,"unit_kind":unit.kind,"requested_range":unit.range(),"served_range":[served_first,served_last],"body":content.get(offset..end).unwrap_or(""),"truncated":truncated,"continuation":continuation,"continue_from_line":continue_from_line,"continue_from_byte":continue_from_byte})
    }

    fn outline(&mut self, path: PathBuf, revision: String, units: Vec<Unit>, notes: Vec<&'static str>, reason: Option<&str>) -> Value {
        let rows: Vec<_> = units.into_iter().map(|unit| {
            let location = self.registry.unit(path.clone(), revision.clone(), unit.clone(), unit.first_byte);
            json!({"name":unit.name,"kind":unit.kind,"range":unit.range(),"location":location})
        }).collect();
        let mut answer = json!({"status":"ok","kind":"outline","bound":ANSWER_BOUND,"source_revision":revision,"rows":rows,"notes":notes,"incomplete":false,"continuation":Value::Null});
        if let Some(reason) = reason { answer["reason"] = json!(reason); }
        answer
    }
}
