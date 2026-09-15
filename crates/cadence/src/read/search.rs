use super::{ReadDomain, document, model::{SearchRequest, Scope}, source};
use globset::{GlobBuilder, GlobMatcher};
use ignore::WalkBuilder;
use serde_json::{Value, json};
use std::path::{Component, Path, PathBuf};

const ANSWER_BOUND: usize = 65_536;
const HIT_BODY_BOUND: usize = 60_000;

fn refusal(slot: &str, code: &str, reason: impl Into<String>) -> Value {
    json!({"status":"refused","code":code,"rule":"D-147","slot":slot,"reason":reason.into()})
}

fn selector(project: &Path, scope: &Scope) -> Result<(PathBuf, Option<GlobMatcher>), Value> {
    match scope {
        Scope::Project => Ok((project.to_path_buf(), None)),
        Scope::Directory { selector } => {
            let path = confined_selector(project, selector).ok_or_else(|| refusal("scope", "invalid-scope", "directory selector must be relative and confined"))?;
            if !path.is_dir() { return Err(refusal("scope", "invalid-scope", "directory selector does not name a directory")); }
            Ok((path, None))
        }
        Scope::Glob { selector } => {
            if absolute_or_escape(selector) { return Err(refusal("scope", "invalid-scope", "glob selector must be relative and confined")); }
            let glob = GlobBuilder::new(selector).literal_separator(true).build()
                .map_err(|error| refusal("scope", "invalid-scope", error.to_string()))?.compile_matcher();
            Ok((project.to_path_buf(), Some(glob)))
        }
        Scope::CurrentTaskLease { .. } | Scope::PhaseDocuments { .. } => {
            unreachable!("named scopes are resolved from retained authority")
        }
    }
}

fn absolute_or_escape(selector: &str) -> bool {
    Path::new(selector).is_absolute() || Path::new(selector).components().any(|part| matches!(part, Component::ParentDir))
}

fn confined_selector(project: &Path, selector: &str) -> Option<PathBuf> {
    (!absolute_or_escape(selector)).then(|| project.join(selector)).and_then(|path| source::confined(project, &path))
}

pub(super) fn files(root: &Path, project: &Path, glob: Option<&GlobMatcher>) -> Vec<PathBuf> {
    let mut paths: Vec<_> = WalkBuilder::new(root).hidden(false).require_git(false).follow_links(false)
        .filter_entry(|entry| entry.file_name() != ".git" && entry.file_name() != ".planning")
        .build().filter_map(Result::ok).filter(|entry| entry.file_type().is_some_and(|kind| kind.is_file()))
        .map(|entry| entry.into_path()).filter(|path| source::confined(project, path).is_some())
        .filter(|path| glob.is_none_or(|matcher| matcher.is_match(path.strip_prefix(project).unwrap_or(path)))).collect();
    paths.sort(); paths
}

fn bounded_body(body: &str) -> (String, bool) {
    if body.len() <= HIT_BODY_BOUND { return (body.to_owned(), false); }
    let mut end = HIT_BODY_BOUND;
    while end > 0 && !body.is_char_boundary(end) { end -= 1; }
    (body[..end].to_owned(), true)
}

impl ReadDomain {
    fn search_documents(&self, matcher: &regex::Regex, phase: u32) -> Value {
        let records = match document::catalog(&self.planning_root, phase) {
            Ok(records) => records,
            Err(answer) => return answer,
        };
        let mut hits = Vec::new();
        for record in records {
            for part in record.parts {
                let starts = source::line_starts(&part.body);
                let match_lines = matcher.find_iter(&part.body)
                    .map(|found| source::line_for(&starts, found.start())).collect::<Vec<_>>();
                if match_lines.is_empty() { continue; }
                let (body, body_truncated) = bounded_body(&part.body);
                hits.push(json!({"identity":record.identity,"part":part.selector,"name":part.title,
                    "kind":"process-part","match_lines":match_lines,"body":body,
                    "body_truncated":body_truncated,"classification":record.classification,
                    "revision":record.revision}));
            }
        }
        hits.sort_by(|left, right| left["identity"].to_string().cmp(&right["identity"].to_string())
            .then(left["part"].as_str().cmp(&right["part"].as_str())));
        bounded_answer(hits)
    }

    pub(super) fn search(&mut self, request: SearchRequest) -> Value {
        if request.cursor.is_some() { return refusal("cursor", "location-not-issued", "search cursor was not issued for this resident"); }
        let matcher = match regex::RegexBuilder::new(&request.pattern).case_insensitive(request.case_insensitive.unwrap_or(false)).build() {
            Ok(matcher) => matcher,
            Err(error) => return refusal("pattern", "invalid-pattern", error.to_string()),
        };
        if let Scope::PhaseDocuments { phase } = &request.scope {
            return self.search_documents(&matcher, phase.get());
        }
        let lease_scope = matches!(&request.scope, Scope::CurrentTaskLease { .. });
        let candidates = match &request.scope {
            Scope::CurrentTaskLease { phase, occurrence, plan, task } => {
                match super::scope::task_lease_files(self, phase.get(), occurrence, plan.get(), task) {
                    Ok(paths) => paths,
                    Err(answer) => return answer,
                }
            }
            _ => {
                let (root, glob) = match selector(&self.project, &request.scope) {
                    Ok(scope) => scope,
                    Err(answer) => return answer,
                };
                files(&root, &self.project, glob.as_ref())
            }
        };
        let mut hits = Vec::new();
        for candidate in candidates {
            let Ok((path, revision, content)) = source::content(&self.project, &candidate) else { continue };
            let mut units = self.units(&path, &content);
            if lease_scope && units.is_empty() {
                units = source::fallback(&path, &content);
            }
            let starts = source::line_starts(&content);
            let mut selected: Vec<(super::model::Unit, Vec<usize>)> = Vec::new();
            for found in matcher.find_iter(&content) {
                let Some(unit) = units.iter().filter(|unit| found.start() >= unit.first_byte && found.end() <= unit.last_byte)
                    .min_by_key(|unit| unit.last_byte - unit.first_byte).cloned() else { continue };
                let line = source::line_for(&starts, found.start());
                if let Some((_, lines)) = selected.iter_mut().find(|(candidate, _)| candidate.name == unit.name && candidate.first_byte == unit.first_byte && candidate.last_byte == unit.last_byte) {
                    lines.push(line);
                } else { selected.push((unit, vec![line])); }
            }
            for (unit, match_lines) in selected {
                let location = self.registry.unit(path.clone(), revision.clone(), unit.clone(), unit.first_byte);
                let file = self.registry.file(path.clone(), revision.clone());
                let (body, body_truncated) = bounded_body(content.get(unit.first_byte..unit.last_byte).unwrap_or(""));
                hits.push(json!({"file":path.strip_prefix(&self.project).unwrap().to_string_lossy(),"name":unit.name,"kind":unit.kind,"range":unit.range(),"match_lines":match_lines,"body":body,"body_truncated":body_truncated,"location":location,"file_reference":file}));
            }
        }
        hits.sort_by(|left, right| left["file"].as_str().cmp(&right["file"].as_str()).then(left["range"].to_string().cmp(&right["range"].to_string())));
        bounded_answer(hits)
    }
}

fn bounded_answer(hits: Vec<Value>) -> Value {
    let mut answer = json!({"status":"ok","kind":"search","bound":ANSWER_BOUND,"incomplete":false,
        "cursor":Value::Null,"hits":hits,"notes":[]});
    while serde_json::to_vec(&answer).is_ok_and(|bytes| bytes.len() > ANSWER_BOUND) {
        answer["hits"].as_array_mut().unwrap().pop();
        answer["incomplete"] = json!(true);
        answer["notes"] = json!(["search answer was bounded; reacquire with a narrower scope"]);
    }
    answer
}
