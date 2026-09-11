use super::*;

// ECMAScript \s, rather than Rust's broader Unicode White_Space property.
fn space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

fn dot(c: char) -> bool {
    !matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

#[derive(Default)]
struct Fence(Option<(u8, usize)>);

impl Fence {
    fn scan(&mut self, line: &str) -> bool {
        let indent = line.bytes().take_while(|&b| b == b' ').count();
        if indent > 3 {
            return self.0.is_some();
        }
        let rest = &line[indent..];
        let Some(ch @ (b'`' | b'~')) = rest.bytes().next() else {
            return self.0.is_some();
        };
        let len = rest.bytes().take_while(|&b| b == ch).count();
        let info = rest[len..].trim_start_matches(space);
        if len < 3 || !info.chars().all(dot) {
            return self.0.is_some();
        }
        match self.0 {
            None => self.0 = Some((ch, len)),
            Some((opening, length))
                if opening == ch && len >= length && info.trim_matches(space).is_empty() =>
            {
                self.0 = None
            }
            _ => {}
        }
        true
    }
}

impl PhaseId {
    /// Frozen String(Number(spelling)), including decimal/exponent thresholds.
    pub fn address(self) -> String {
        if self.0.is_infinite() {
            return "Infinity".into();
        }
        if self.0 == 0.0 {
            return "0".into();
        }
        let decimal = self.0.to_string();
        if (1e-6..1e21).contains(&self.0) {
            return decimal;
        }
        let (whole, fraction) = decimal.split_once('.').unwrap_or((&decimal, ""));
        let digits = format!("{whole}{fraction}");
        let first = digits.bytes().position(|b| b != b'0').unwrap();
        let significant = digits[first..].trim_end_matches('0');
        let exponent = whole.len() as isize - first as isize - 1;
        let tail = if significant.len() > 1 {
            format!(".{}", &significant[1..])
        } else {
            String::new()
        };
        format!("{}{tail}e{exponent:+}", &significant[..1])
    }
}

fn canonical(line: &str, source_line: usize, ordinal: usize) -> Option<RoadmapPhase> {
    let (checked, rest) = if let Some(rest) = line.strip_prefix("- [ ] **Phase ") {
        (false, rest)
    } else {
        (true, line.strip_prefix("- [x] **Phase ")?)
    };
    let (number, body) = rest.split_once(": ")?;
    let mut parts = number.split('.');
    let integer = parts.next()?;
    if integer.is_empty() || !integer.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if let Some(fraction) = parts.next()
        && (fraction.is_empty() || !fraction.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    if parts.next().is_some() {
        return None;
    }
    for (end, _) in body
        .char_indices()
        .filter(|(i, _)| body[*i..].starts_with("**"))
    {
        let name = &body[..end];
        if name.is_empty() || !name.chars().all(dot) {
            continue;
        }
        let tail = &body[end + 2..];
        let description = if tail.is_empty() {
            ""
        } else if let Some(desc) = tail.trim_start_matches(space).strip_prefix('-') {
            let desc = desc.trim_start_matches(space);
            if !desc.chars().all(dot) {
                continue;
            }
            desc
        } else {
            continue;
        };
        let id = PhaseId(number.parse().ok()?);
        return Some(RoadmapPhase {
            id,
            name: name.into(),
            description: description.into(),
            checked,
            source_line,
            ordinal,
            relative_path: format!("phases/{}", id.address()).into(),
        });
    }
    None
}

fn phase_token(line: &str) -> bool {
    line.match_indices("Phase ").any(|(i, _)| {
        let word = |c: char| c.is_ascii_alphanumeric() || c == '_';
        if line[..i].chars().next_back().is_some_and(word) {
            return false;
        }
        let rest = &line[i + 6..];
        let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
        if digits == 0 {
            return false;
        }
        // The optional decimal can backtrack to the integer at its word boundary.
        !rest[digits..].chars().next().is_some_and(word)
    })
}

pub fn parse_roadmap(text: &str) -> Result<ParsedRoadmap, DerivationError> {
    let normalized = text
        .strip_prefix('\u{feff}')
        .unwrap_or(text)
        .replace("\r\n", "\n");
    let lines: Vec<_> = normalized.split('\n').collect();
    let mut fence = Fence::default();
    let mut start = None;
    let mut end = lines.len();
    for (i, line) in lines.iter().enumerate() {
        if fence.scan(line) {
            continue;
        }
        if start.is_none() {
            if line.trim_matches(space) == "## Phases" {
                start = Some(i);
            }
        } else if line.starts_with("## ") {
            end = i;
            break;
        }
    }
    let start = start.ok_or_else(|| DerivationError::InvalidRoadmap {
        detail: "no-section: no unfenced ## Phases heading".into(),
    })?;
    let mut phases = Vec::new();
    let mut fence = Fence::default();
    for (i, line) in lines.iter().enumerate().take(end).skip(start + 1) {
        if !fence.scan(line)
            && let Some(phase) = canonical(line, i + 1, phases.len())
        {
            phases.push(phase);
        }
    }
    if !phases.is_empty() {
        phases.sort_by(|a, b| a.id.number().total_cmp(&b.id.number()));
        return Ok(ParsedRoadmap {
            cycle: Cycle::Live,
            phases,
        });
    }
    let mut fence = Fence::default();
    for (i, line) in lines.iter().enumerate().skip(start + 1) {
        if !fence.scan(line) && phase_token(line) {
            return Err(DerivationError::InvalidRoadmap {
                detail: format!(
                    "out-of-grammar at line {}: {}",
                    i + 1,
                    line.trim_matches(space)
                ),
            });
        }
    }
    Ok(ParsedRoadmap {
        cycle: Cycle::Closed,
        phases,
    })
}

/// Match the nonempty, lazy value in the frozen field/head regex. A line
/// containing only spaces after the delimiter still captures one space.
fn value(text: &str) -> Option<&str> {
    let trimmed = text.trim_start_matches(space);
    let start = if trimmed.is_empty() {
        text.char_indices()
            .rev()
            .find(|(_, c)| dot(*c))
            .map(|(i, _)| &text[i..])?
    } else {
        trimmed
    };
    let end = start.trim_end_matches(space);
    let value = if end.is_empty() {
        &start[..start.chars().next()?.len_utf8()]
    } else {
        end
    };
    value.chars().all(dot).then_some(value)
}

fn field(line: &str) -> Option<(&str, &str)> {
    let (key, text) = line.split_once(':')?;
    if key.is_empty() || !key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
        return None;
    }
    Some((key, value(text)?))
}

pub fn parse_uat(text: &str) -> ParsedUat {
    // Splitting precedes fence scanning: even a fenced ### chunk can be an item.
    let starts: Vec<_> = text
        .match_indices("### ")
        .filter_map(|(i, _)| {
            (i == 0 || text[..i].chars().next_back().is_some_and(|c| !dot(c))).then_some(i)
        })
        .collect();
    let chunks = starts.iter().enumerate().map(|(n, start)| {
        text[start + 4..starts.get(n + 1).copied().unwrap_or(text.len())]
            .split('\n')
            .collect::<Vec<_>>()
    });
    let mut items = Vec::new();
    let mut counts = UatCounts::default();
    for lines in chunks {
        let head = lines[0];
        let digits = head.bytes().take_while(u8::is_ascii_digit).count();
        if digits == 0 {
            continue;
        }
        let Some(rest) = head[digits..].strip_prefix('.') else {
            continue;
        };
        let Some(first) = rest.chars().next().filter(|c| space(*c)) else {
            continue;
        };
        if value(&rest[first.len_utf8()..]).is_none() {
            continue;
        }
        let mut item = UatItem {
            status: None,
            reason: None,
        };
        let mut fence = Fence::default();
        for (i, line) in lines.iter().enumerate() {
            let fenced = fence.scan(line);
            if !fenced && line.starts_with("## ") {
                break;
            }
            if i > 0
                && let Some((key, value)) = field(line)
            {
                match key {
                    "status" => item.status = Some(value.into()),
                    "reason" => item.reason = Some(value.into()),
                    _ => {}
                }
            }
        }
        match item.status.as_deref() {
            Some("pass") => counts.pass += 1,
            Some("fail") => counts.fail += 1,
            Some("pending") => counts.pending += 1,
            Some("skipped") => counts.skipped += 1,
            Some("blocked") => counts.blocked += 1,
            _ => {}
        }
        items.push(item);
    }
    ParsedUat { items, counts }
}
