//! List: the files a scope holds, each with a reference to read it.
//!
//! The one read-layer call that takes no pattern. Without it a caller that
//! wants to know what is under a directory has nothing but a host glob, which
//! the planner-round measurement records as a read outside the layer.

use super::{ReadDomain, location::Resumes, model::ListRequest, source};
use serde_json::{Value, json};

const ANSWER_BOUND: usize = super::slice::ANSWER_BOUND;

/// Ceiling on the entries one answer carries.
///
/// Every entry issues a file reference, and the registry expires its oldest
/// tokens past 1024. A page of this size leaves the references of the pages
/// before it alive long enough to be followed.
const PAGE: usize = 256;

const BOUNDED_NOTE: &str = "list answer was bounded; repeat the same list with this cursor to continue";
const EXHAUSTED_NOTE: &str = "the cursor is at or past this scope's last file; nothing follows";

impl ReadDomain {
    pub(super) fn list(&mut self, request: ListRequest) -> Value {
        let resumes = Resumes::List { scope: request.scope.clone() };
        let resume = match self.resume(request.cursor.as_deref(), &resumes) { Ok(resume) => resume, Err(answer) => return answer };
        let candidates = match self.candidates(&request.scope) { Ok(paths) => paths, Err(answer) => return answer };
        // Every entry is a file the layer will serve: the same gates as a read,
        // so a listed file is never one a later read refuses.
        let mut files: Vec<_> = candidates.iter()
            .filter_map(|candidate| source::content(&self.project, candidate).ok())
            .map(|(path, revision, content)| (path, revision, content.len()))
            .collect();
        files.sort_by(|left, right| left.0.cmp(&right.0));
        let start = match &resume {
            None => 0,
            Some((path, _)) => files.iter().position(|(candidate, _, _)| candidate >= path).unwrap_or(files.len()),
        };
        let placeholder = format!("cur-{}-{}", "0".repeat(16), u64::MAX);
        let envelope = json!({"status":"ok","kind":"list","bound":ANSWER_BOUND,"incomplete":true,"cursor":placeholder,
            "files":[],"notes":[BOUNDED_NOTE, EXHAUSTED_NOTE],"total":files.len(),"served":files.len()});
        let budget = ANSWER_BOUND.saturating_sub(serde_json::to_vec(&envelope).map_or(0, |bytes| bytes.len()));
        let mut used = 0usize;
        let mut entries = Vec::new();
        let mut next = None;
        for (path, revision, bytes) in &files[start..] {
            let relative = path.strip_prefix(&self.project).unwrap_or(path).to_string_lossy().into_owned();
            let mut entry = json!({"file":relative,"bytes":bytes,"file_reference":format!("file-{}-{}", "0".repeat(16), u64::MAX)});
            let cost = serde_json::to_vec(&entry).map_or(0, |bytes| bytes.len()) + 1;
            if !entries.is_empty() && (entries.len() >= PAGE || used + cost > budget) {
                next = Some(self.registry.cursor(resumes.clone(), path.clone(), 0));
                break;
            }
            used += cost;
            entry["file_reference"] = json!(self.registry.file(path.clone(), revision.clone()));
            entries.push(entry);
        }
        let mut notes = Vec::new();
        if next.is_some() { notes.push(BOUNDED_NOTE); }
        if resume.is_some() && entries.is_empty() { notes.push(EXHAUSTED_NOTE); }
        json!({"status":"ok","kind":"list","bound":ANSWER_BOUND,"incomplete":next.is_some(),"cursor":next,
            "files":entries,"notes":notes,"total":files.len(),"served":entries.len()})
    }
}
