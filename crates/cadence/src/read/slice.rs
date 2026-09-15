use super::{Capability, ReadDomain, model::ReadRequest, source};
use serde_json::{Value, json};

const ANSWER_BOUND: usize = 65_536;

fn refusal(slot: &str, code: &str, reason: impl Into<String>) -> Value {
    json!({"status":"refused","code":code,"rule":"D-147","slot":slot,"reason":reason.into()})
}

impl ReadDomain {
    pub(super) fn read(&mut self, request: ReadRequest) -> Value {
        match (request.location, request.file, request.unit) {
            (Some(location), None, None) => self.read_location(&location),
            (None, Some(file), Some(name)) => self.read_named(&file, &name),
            (None, Some(file), None) => self.read_file(&file),
            _ => refusal("location", "read-contract", "read accepts exactly an issued location, or an issued file reference and unit name"),
        }
    }

    fn current(&self, path: &std::path::Path, expected: &str) -> Result<String, Value> {
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
        let units = self.units(&path, &content);
        let matches: Vec<_> = units.iter().filter(|unit| unit.name == name || unit.bare == name).cloned().collect();
        if matches.len() != 1 {
            let missing = matches.is_empty();
            let selected = if missing { units } else { matches };
            let rows: Vec<_> = selected.into_iter().map(|unit| {
                let location = self.registry.unit(path.clone(), revision.clone(), unit.clone(), unit.first_byte);
                json!({"name":unit.name,"kind":unit.kind,"range":unit.range(),"location":location})
            }).collect();
            return json!({"status":"ok","kind":"outline","bound":ANSWER_BOUND,"source_revision":revision,"rows":rows,"reason":if missing{"missing-unit"}else{"ambiguous-unit"},"incomplete":false,"continuation":Value::Null});
        }
        let unit = matches.into_iter().next().unwrap();
        self.slice(path, revision, unit.clone(), unit.first_byte, &content)
    }

    fn read_file(&mut self, token: &str) -> Value {
        let Some(Capability::File { path, revision }) = self.registry.get(token) else { return refusal("file", "location-not-issued", "file reference was not issued by this resident"); };
        let content = match self.current(&path, &revision) { Ok(content) => content, Err(answer) => return answer };
        self.outline(path, revision, &content)
    }

    fn slice(&mut self, path: std::path::PathBuf, revision: String, unit: super::model::Unit, offset: usize, content: &str) -> Value {
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
        json!({"status":"ok","kind":"slice","bound":ANSWER_BOUND,"source_revision":revision,"name":unit.name,"requested_range":unit.range(),"served_range":[served_first,served_last],"body":content.get(offset..end).unwrap_or(""),"truncated":truncated,"continuation":continuation,"continue_from_line":continue_from_line,"continue_from_byte":continue_from_byte})
    }

    fn outline(&mut self, path: std::path::PathBuf, revision: String, content: &str) -> Value {
        let rows: Vec<_> = self.units(&path, content).into_iter().map(|unit| {
            let location=self.registry.unit(path.clone(), revision.clone(), unit.clone(), unit.first_byte);
            json!({"name":unit.name,"kind":unit.kind,"range":unit.range(),"location":location})
        }).collect();
        json!({"status":"ok","kind":"outline","bound":ANSWER_BOUND,"source_revision":revision,"rows":rows,"incomplete":false,"continuation":Value::Null})
    }
}
