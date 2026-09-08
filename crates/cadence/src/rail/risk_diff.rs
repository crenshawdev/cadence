//! Pure classification of the paths and changed lines in a Git diff.
use crate::store::{Error, Result};
use grep_matcher::Matcher;
use grep_regex::RegexMatcher;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct Match {
    pub category: String,
    pub signal: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct Scan {
    pub checked: bool,
    pub categories: Vec<String>,
    pub matches: Vec<Match>,
    pub inconclusive: bool,
    pub empty: bool,
}

const SEGMENTS: &[(&str, &[&str])] = &[
    (
        "auth",
        &[
            "auth", "authn", "authz", "oauth", "identity", "login", "session",
        ],
    ),
    (
        "migrations",
        &["migrations", "migrate", "migration", "alembic", "prisma"],
    ),
    (
        "billing",
        &[
            "billing", "payments", "payment", "checkout", "pricing", "invoices",
        ],
    ),
    (
        "concurrency",
        &[
            "workers",
            "worker",
            "jobs",
            "queue",
            "queues",
            "concurrency",
        ],
    ),
    ("secrets", &["secrets", "vault", "crypto", "keystore"]),
    (
        "api_contract",
        &["openapi", "swagger", "graphql", "proto", "rpc"],
    ),
];
const FILES: &[(&str, &[&str])] = &[
    (
        "secrets",
        &[
            ".env",
            ".env.local",
            ".env.production",
            "id_rsa",
            "id_ed25519",
        ],
    ),
    (
        "api_contract",
        &[
            "openapi.yaml",
            "openapi.yml",
            "openapi.json",
            "swagger.yaml",
            "swagger.json",
            "schema.graphql",
        ],
    ),
];
const EXTENSIONS: &[(&str, &[&str])] = &[
    ("migrations", &[".sql"]),
    ("api_contract", &[".proto", ".graphql", ".gql"]),
    ("secrets", &[".pem", ".key", ".p12", ".pfx"]),
];
const CONTENT: &[(&str, &[(&str, &str)])] = &[
    (
        "auth",
        &[
            (
                r"(?i)\bjsonwebtoken\b|\bjwt\.(sign|verify|decode)\s*\(",
                "a JWT sign/verify call",
            ),
            (
                r"(?i)\bbcrypt|\bargon2|\bscrypt\s*\(",
                "a password-hashing call",
            ),
            (
                r#"(?i)\bAuthorization\s*:\s*["'`]?\s*Bearer\b"#,
                concat!("an Authorization", ": Bearer header"),
            ),
            (
                r"(?i)\b(is_?authenticated|require_?(auth|login)|check_?permission)\b",
                "an authentication guard",
            ),
        ],
    ),
    (
        "migrations",
        &[
            (
                r"(?i)\bALTER\s+TABLE\b",
                concat!("an ALTER", " TABLE statement"),
            ),
            (
                r"(?i)\bCREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\b",
                concat!("a CREATE", " TABLE/INDEX statement"),
            ),
            (r"(?i)\b(ADD|DROP|RENAME)\s+COLUMN\b", "a column change"),
            (
                r"(?i)\b(add_?column|create_?table|remove_?column|add_?index)\s*\(",
                "a migration DSL call",
            ),
        ],
    ),
    (
        "billing",
        &[
            (r"(?i)\b[s]tripe\b", concat!("a Str", "ipe reference")),
            (
                r"(?i)\b([b]raintree|[c]hargebee|[r]ecurly|[p]addle|[p]aypal)\b",
                "a payment-provider reference",
            ),
            (
                r"(?i)\b([p]rice_id|[a]mount_cents|[u]nit_amount|[s]ubscription_id)\b",
                "a pricing field",
            ),
        ],
    ),
    (
        "concurrency",
        &[
            (
                r"\bPromise\.(all|allSettled|race)\s*\(",
                "a concurrent Promise combinator",
            ),
            (
                r"\bnew\s+(Worker|Thread)\s*\(",
                "a worker/thread construction",
            ),
            (
                r"\b([M]utex|[R]wLock|[S]emaphore|threading\.Lock)\b",
                "a lock primitive",
            ),
            (
                r"\bgo\s+func\s*\(|\bgoroutine\b|\btokio::spawn\b",
                "a spawned task",
            ),
        ],
    ),
    (
        "destructive",
        &[
            (r"(?i)\brm\s+-[a-z]*[rf]", concat!("an `rm", " -rf`")),
            (
                r"(?i)\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\b",
                "a DROP statement",
            ),
            (r"(?i)\b(TRUNCATE\s+TABLE|DELETE\s+FROM)\b", "a bulk delete"),
            (
                r"\b([r]mSync|[u]nlinkSync|[r]imraf|shutil\.rmtree)\b",
                "a recursive delete call",
            ),
            (
                r"\bgit\s+(push[^\n]*--force|reset\s+--hard|clean\s+-[a-z]*f)",
                "a destructive git command",
            ),
        ],
    ),
    (
        "secrets",
        &[
            (
                r"\b[A-Z][A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY)[A-Z0-9_]*\s*[=:]",
                "a credential-named assignment",
            ),
            (
                r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
                "an inline private key",
            ),
            (
                r"\b(createCipheriv|createDecipheriv|createHmac|randomBytes)\s*\(",
                "a crypto primitive call",
            ),
        ],
    ),
    (
        "api_contract",
        &[
            (
                r#"\b(app|router|api)\.(get|post|put|patch|delete)\s*\(\s*["'`]"#,
                "an HTTP route declaration",
            ),
            (
                r"@(Get|Post|Put|Patch|Delete|Request)Mapping\b|@(app\.)?(route|get|post)\s*\(",
                "a route annotation",
            ),
            (
                r#"(?i)^\s*(openapi|swagger)\s*:\s*["']?\d"#,
                "an OpenAPI version header",
            ),
        ],
    ),
    (
        "untrusted_input",
        &[
            (r"\bJSON\.parse\s*\(", "a JSON.parse call"),
            (
                r"\b(req|request|ctx)\.(body|query|params|headers)\b",
                "a request-input read",
            ),
            (
                r"\b(yaml|YAML)\.(load|parse)\s*\(|\bparseXml\b|\bxml2js\b",
                "a markup parse call",
            ),
            (
                r"\b([b]odyParser|[b]ody-parser|[m]ulter|[f]ormidable)\b",
                "a request-body parser",
            ),
        ],
    ),
];

#[derive(Default)]
struct PathSets {
    segments: BTreeSet<String>,
    bases: BTreeSet<String>,
    extensions: BTreeSet<String>,
}

fn path_sets(paths: &[PathBuf]) -> (PathSets, bool) {
    let mut sets = PathSets::default();
    let mut unreadable = false;
    for path in paths {
        let Some(path) = path.to_str() else {
            unreadable = true;
            continue;
        };
        let parts: Vec<_> = path
            .split('/')
            .filter(|part| !part.is_empty())
            .map(str::to_lowercase)
            .collect();
        sets.segments.extend(parts.iter().cloned());
        if let Some(base) = parts.last() {
            sets.bases.insert(base.clone());
            if let Some(dot) = base.rfind('.')
                && dot > 0
            {
                sets.segments.insert(base[..dot].into());
                sets.extensions.insert(base[dot..].into());
            }
        }
    }
    (sets, unreadable)
}

fn values<'a>(table: &'a [(&str, &[&'a str])], category: &str) -> &'a [&'a str] {
    table
        .iter()
        .find_map(|(name, values)| (*name == category).then_some(*values))
        .unwrap_or_default()
}

fn signal(category: &str, sets: &PathSets, lines: &[&str]) -> Result<Option<String>> {
    for name in values(SEGMENTS, category) {
        if sets.segments.contains(*name) {
            return Ok(Some(format!("path segment {name}")));
        }
    }
    for name in values(FILES, category) {
        if sets.bases.contains(*name) {
            return Ok(Some(format!("file {name}")));
        }
    }
    for extension in values(EXTENSIONS, category) {
        if sets.extensions.contains(*extension) {
            return Ok(Some(format!("{extension} file")));
        }
    }
    if let Some((_, patterns)) = CONTENT.iter().find(|(name, _)| *name == category) {
        for (pattern, label) in *patterns {
            let matcher = RegexMatcher::new(pattern)
                .map_err(|e| Error::Invalid(format!("invalid risk detector: {e}")))?;
            for line in lines {
                if matcher
                    .is_match(line.as_bytes())
                    .map_err(|e| Error::Invalid(format!("risk detector failed: {e}")))?
                {
                    return Ok(Some(format!("changed line: {label}")));
                }
            }
        }
    }
    Ok(None)
}

fn changed_lines(body: &str) -> (Vec<&str>, bool) {
    let mut changed = Vec::new();
    let mut hunks = 0_u64;
    let mut unreadable = false;
    let mut in_section = false;
    let mut section_read = true;
    let mut in_hunk = false;
    for raw in body.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        if line.starts_with("diff --git ") {
            if in_section && !section_read {
                unreadable = true;
            }
            in_section = true;
            section_read = false;
            in_hunk = false;
        } else if line.starts_with("@@") {
            hunks += 1;
            section_read = true;
            in_hunk = true;
        } else if line.starts_with("Binary files ") || line.starts_with("GIT binary patch") {
            unreadable = true;
            section_read = true;
        } else if !in_hunk
            && (line.ends_with(" mode 160000")
                || (line.starts_with("index ") && line.ends_with(" 160000")))
        {
            unreadable = true;
        } else if line.starts_with('+') || line.starts_with('-') {
            let content = &line[1..];
            let gitlink = content.starts_with("Subproject commit ")
                && content
                    .split_whitespace()
                    .nth(2)
                    .is_some_and(|id| (7..=70).contains(&id.len()));
            if gitlink {
                unreadable = true;
            } else if in_hunk {
                changed.push(content);
            }
        }
    }
    if in_section && !section_read {
        unreadable = true;
    }
    if hunks == 0 && !body.trim().is_empty() {
        unreadable = true;
    }
    (changed, unreadable)
}

pub fn scan(body: Option<&[u8]>, paths: &[PathBuf], categories: &[String]) -> Result<Scan> {
    let categories: Vec<_> = categories
        .iter()
        .filter(|value| !value.is_empty())
        .cloned()
        .collect();
    let Some(body) = body else {
        return Ok(Scan {
            checked: false,
            categories,
            matches: Vec::new(),
            inconclusive: true,
            empty: false,
        });
    };
    if body.is_empty() && paths.is_empty() {
        return Ok(Scan {
            checked: true,
            categories,
            matches: Vec::new(),
            inconclusive: false,
            empty: true,
        });
    }
    let (sets, mut inconclusive) = path_sets(paths);
    let (lines, diff_unreadable) = match std::str::from_utf8(body) {
        Ok(body) => changed_lines(body),
        Err(_) => (Vec::new(), true),
    };
    inconclusive |= diff_unreadable;
    let mut matches = Vec::new();
    for category in &categories {
        if let Some(signal) = signal(category, &sets, &lines)? {
            matches.push(Match {
                category: category.clone(),
                signal,
            });
        }
    }
    Ok(Scan {
        checked: true,
        categories,
        matches,
        inconclusive,
        empty: false,
    })
}
