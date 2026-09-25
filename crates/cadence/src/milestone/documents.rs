//! Surgical removal of selected rows. All other bytes retain their boundaries.
use crate::store::{Error, Result};
use regex::Regex;
use std::collections::BTreeSet;

fn regex(pattern: &str) -> Regex { Regex::new(pattern).expect("constant expression") }

fn visible(lines: &[&str]) -> Vec<bool> {
    let mut fence: Option<(char, usize)> = None;
    lines.iter().map(|line| {
        let t = line.trim_start();
        let ch = t.chars().next().unwrap_or(' ');
        let count = t.chars().take_while(|c| *c == ch).count();
        if matches!(ch, '`' | '~') && count >= 3 {
            if fence.is_none() { fence = Some((ch, count)); }
            else if fence.is_some_and(|(c,n)| ch == c && count >= n) { fence = None; }
            return false;
        }
        fence.is_none()
    }).collect()
}

fn heading(line: &str) -> Option<(usize, &str)> {
    let line = line.trim_end();
    let n = line.chars().take_while(|c| *c == '#').count();
    (n > 0 && line.as_bytes().get(n) == Some(&b' ')).then(|| (n, line[n+1..].trim()))
}

fn remove_bullet(lines: &[&str], visible: &[bool], remove: &mut [bool], i: usize) {
    remove[i] = true;
    for j in i+1..lines.len() {
        // A blank line belongs to the enclosing section. Wrapped and nested
        // material belongs to the selected bullet, including fenced examples.
        if lines[j].trim().is_empty() { break; }
        if visible[j] && !lines[j].starts_with([' ', '\t']) { break; }
        remove[j] = true;
    }
}

pub fn roadmap(input: &str, phases: &BTreeSet<u32>) -> Result<String> {
    let lines: Vec<_> = input.split_inclusive('\n').collect();
    let visible = visible(&lines);
    let mut remove = vec![false; lines.len()];
    let row = regex(r"^- \[[xX ]\] \*\*Phase ([1-9][0-9]*):");
    let detail = regex(r"^Phase ([1-9][0-9]*):");
    let mut found = BTreeSet::new();
    let mut deferred = None;
    for (i, line) in lines.iter().enumerate() {
        if !visible[i] { continue; }
        if let Some((level, title)) = heading(line) {
            if deferred.is_some_and(|n| level <= n) { deferred = None; }
            if title.eq_ignore_ascii_case("Deferred") { deferred = Some(level); }
            if deferred.is_none() && let Some(c) = detail.captures(title)
                && c[1].parse::<u32>().ok().is_some_and(|p| phases.contains(&p)) {
                remove[i] = true;
                for j in i+1..lines.len() {
                    if visible[j] && heading(lines[j]).is_some_and(|(n,_)| n <= level) { break; }
                    remove[j] = true;
                }
            }
        }
        if deferred.is_none() && let Some(c) = row.captures(line)
            && let Ok(p) = c[1].parse::<u32>() && phases.contains(&p) {
            found.insert(p);
            remove_bullet(&lines, &visible, &mut remove, i);
        }
    }
    if &found != phases { return Err(Error::Invalid(".planning/ROADMAP.md lacks selected integer phase rows".into())); }
    Ok(lines.iter().zip(remove).filter_map(|(line, remove)| (!remove).then_some(*line)).collect())
}

pub fn requirements(input: &str, phases: &BTreeSet<u32>) -> Result<String> {
    let lines: Vec<_> = input.split_inclusive('\n').collect();
    let visible = visible(&lines);
    let mut remove = vec![false; lines.len()];
    let mut selected = BTreeSet::new();
    let mut found = BTreeSet::new();
    let mut section = String::new();
    let mut columns = None;
    for (i, line) in lines.iter().enumerate() {
        if !visible[i] { continue; }
        if let Some((n,title)) = heading(line) && n <= 2 { section = title.to_ascii_lowercase(); columns = None; }
        if section != "traceability" || !line.trim_start().starts_with('|') { continue; }
        let cells: Vec<_> = line.trim().trim_matches('|').split('|').map(str::trim).collect();
        if columns.is_none() {
            let req = cells.iter().position(|s| s.eq_ignore_ascii_case("requirement"));
            let phase = cells.iter().position(|s| s.eq_ignore_ascii_case("phase"));
            if let (Some(r),Some(p)) = (req,phase) { columns = Some((r,p)); }
            continue;
        }
        let (r,p) = columns.unwrap();
        let Some(phase) = cells.get(p).and_then(|s| s.strip_prefix("Phase ").unwrap_or(s).parse::<u32>().ok()) else { continue; };
        if phases.contains(&phase) {
            let id = cells.get(r).ok_or_else(|| Error::Invalid(".planning/REQUIREMENTS.md malformed traceability row".into()))?;
            selected.insert(id.trim_matches(['*','`']).to_owned());
            found.insert(phase);
            remove[i] = true;
        }
    }
    if &found != phases { return Err(Error::Invalid(".planning/REQUIREMENTS.md lacks selected traceability rows".into())); }
    let bullet = regex(r"^- \[[xX ]\] \*\*([^*]+)\*\*:");
    section.clear();
    let mut active = BTreeSet::new();
    for (i,line) in lines.iter().enumerate() {
        if !visible[i] { continue; }
        if let Some((n,title)) = heading(line) && n <= 2 { section = title.to_ascii_lowercase(); }
        if matches!(section.as_str(), "active" | "requirements" | "v1 requirements" | "v2 requirements")
            && let Some(c) = bullet.captures(line) && selected.contains(&c[1]) {
            active.insert(c[1].to_owned());
            remove_bullet(&lines, &visible, &mut remove, i);
        }
    }
    if active != selected { return Err(Error::Invalid(".planning/REQUIREMENTS.md lacks selected active requirement rows".into())); }
    Ok(lines.iter().zip(remove).filter_map(|(line, remove)| (!remove).then_some(*line)).collect())
}
