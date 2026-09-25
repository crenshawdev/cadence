//! One credential fence for outbound material, raw accounting and diagnostics.
use regex::Regex;
use std::sync::LazyLock;

pub const REDACTION: &str = "<redacted>";
const WINDOW: usize = 4096;
const CAP: usize = 1024;
const TRUNCATED: &str = " [truncated]";

static URL: LazyLock<Regex> = LazyLock::new(|| Regex::new(
    r"([A-Za-z][A-Za-z0-9+.-]*://)[^\s/?#@]+@"
).unwrap());
static BARE: LazyLock<Regex> = LazyLock::new(|| Regex::new(
    r"[^\s/:@]+:[^\s/@]+@"
).unwrap());
static URL_CUT: LazyLock<Regex> = LazyLock::new(|| Regex::new(
    r#"([A-Za-z][A-Za-z0-9+.-]*://)[^\s/?#@"']+$"#
).unwrap());
static BARE_CUT: LazyLock<Regex> = LazyLock::new(|| Regex::new(
    r#"[^\s/:@"']+:[^\s/@"']+$"#
).unwrap());
static AUTH: LazyLock<Regex> = LazyLock::new(|| Regex::new(
    r"(?i)(?:authorization\s*[:=]\s*)?(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+"
).unwrap());
static PAIR: LazyLock<Regex> = LazyLock::new(|| Regex::new(concat!(
    r#"(?i)(^|[^A-Za-z0-9_.-])["']?(?:[A-Za-z0-9]+[_.-]){0,4}"#,
    r#"(?:api[_.-]?key|access[_.-]?token|refresh[_.-]?token|passwd|password|secret|token|key)["']?\s*[:=]\s*"#,
    r#"(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|[^\s&"',;)\]}>]+)"#
)).unwrap());
static CAMEL: LazyLock<Regex> = LazyLock::new(|| Regex::new(concat!(
    r#"(^|[^A-Za-z0-9_.-])["']?[a-z][A-Za-z0-9]{0,30}(?:Key|Token|Secret|Passwd|Password)["']?\s*[:=]\s*"#,
    r#"(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|[^\s&"',;)\]}>]+)"#
)).unwrap());

pub fn fence(text: &str) -> String {
    let clean = URL.replace_all(text, "${1}<redacted>@");
    let clean = BARE.replace_all(&clean, "<redacted>@");
    let clean = URL_CUT.replace_all(&clean, "${1}<redacted>");
    let clean = BARE_CUT.replace_all(&clean, REDACTION);
    let clean = AUTH.replace_all(&clean, REDACTION);
    let clean = PAIR.replace_all(&clean, "${1}<redacted>");
    CAMEL.replace_all(&clean, "${1}<redacted>").into_owned()
}

fn prefix(text: &str, cap: usize) -> &str {
    let mut end = text.len().min(cap);
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

pub fn excerpt(text: &str) -> String {
    let windowed = text.len() > WINDOW;
    let mut clean = fence(prefix(text, WINDOW));
    let room = CAP - TRUNCATED.len();
    // A cut tail may have shrunk during redaction. Drop the last word just as
    // the frozen excerpt does: it could be a partial, unrecognizable span.
    if windowed && clean.len() <= room {
        clean.truncate(clean.rfind(char::is_whitespace).unwrap_or(0));
    }
    if !windowed && clean.len() <= CAP {
        return clean;
    }
    format!("{}{TRUNCATED}", prefix(&clean, room))
}
