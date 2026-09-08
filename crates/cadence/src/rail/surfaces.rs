//! Structural evidence only: source bodies are never inputs to this scanner.
use super::risk::{CATEGORIES, validate_surfaces};
use crate::store::{Error, Result};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, fs, io, path::Path};

const SKIP: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    "target",
    "vendor",
    "coverage",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    ".cache",
];
const MANIFESTS: &[&str] = &[
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
    "requirements.txt",
];
const DIR: &[(&str, &[&str])] = &[
    ("auth", &["auth", "authn", "authz", "oauth", "identity"]),
    (
        "migrations",
        &[
            "migrations",
            "migrate",
            "db",
            "database",
            "prisma",
            "alembic",
        ],
    ),
    ("billing", &["billing", "payments", "payment", "checkout"]),
    ("concurrency", &["workers", "jobs", "queue", "queues"]),
    ("secrets", &["secrets", "vault", "crypto"]),
    (
        "api_contract",
        &["api", "openapi", "swagger", "graphql", "proto", "rpc"],
    ),
];
const FILE: &[(&str, &[&str])] = &[
    ("secrets", &[".env", ".env.local", ".env.production"]),
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
const EXT: &[(&str, &[&str])] = &[
    ("migrations", &[".sql"]),
    ("api_contract", &[".proto", ".graphql", ".gql"]),
];
const DEP: &[(&str, &[&str])] = &[
    (
        "auth",
        &[
            "passport",
            "next-auth",
            "jsonwebtoken",
            "bcrypt",
            "bcryptjs",
            "argon2",
            "authlib",
            "django-allauth",
            "devise",
            "omniauth",
            "keycloak",
            "jose",
        ],
    ),
    (
        "migrations",
        &[
            "prisma",
            "knex",
            "typeorm",
            "sequelize",
            "drizzle-orm",
            "alembic",
            "flyway",
            "liquibase",
            "diesel",
            "sqlx",
            "mongoose",
            "activerecord",
        ],
    ),
    (
        "billing",
        &[
            "stripe",
            "braintree",
            "paypal",
            "chargebee",
            "paddle",
            "recurly",
        ],
    ),
    (
        "concurrency",
        &[
            "bullmq",
            "bull",
            "celery",
            "sidekiq",
            "resque",
            "kafkajs",
            "amqplib",
            "tokio",
            "rayon",
            "crossbeam",
        ],
    ),
    (
        "secrets",
        &[
            "dotenv",
            "python-dotenv",
            "node-vault",
            "hvac",
            "sops",
            "keyring",
        ],
    ),
    (
        "api_contract",
        &[
            "graphql",
            "apollo-server",
            "openapi",
            "grpc-js",
            "protobufjs",
            "tsoa",
            "trpc",
            "swagger-ui-express",
        ],
    ),
    (
        "untrusted_input",
        &[
            "express",
            "fastify",
            "koa",
            "hapi",
            "flask",
            "django",
            "fastapi",
            "rails",
            "actix-web",
            "axum",
            "body-parser",
            "multer",
            "xml2js",
            "js-yaml",
            "marked",
        ],
    ),
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Signal {
    pub category: String,
    pub signal: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Choice {
    pub surfaces: Vec<String>,
    pub reason: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Report {
    pub root: String,
    pub manifests: Vec<String>,
    pub evidenced: Vec<Signal>,
    pub silent: Vec<String>,
    pub unspeakable: Vec<String>,
    pub inconclusive: bool,
    pub recommended: Vec<String>,
    pub options: Vec<Choice>,
    pub warnings: Vec<String>,
}
#[derive(Default)]
struct Tree {
    dirs: BTreeSet<String>,
    files: BTreeSet<String>,
    extensions: BTreeSet<String>,
    dependencies: BTreeSet<String>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    ListDirectory,
    ReadManifest,
}

pub fn detect(root: &Path, answered: Option<Vec<String>>) -> Result<Report> {
    detect_observed(root, answered, |_, _| Ok(()))
}

/// Observe each content/listing I/O before it occurs; metadata is never content.
/// Tests can deny reads regardless of the runner's filesystem privileges.
pub fn detect_observed(
    root: &Path,
    answered: Option<Vec<String>>,
    mut observe: impl FnMut(Access, &Path) -> io::Result<()>,
) -> Result<Report> {
    let answered = answered
        .map(validate_surfaces)
        .transpose()?
        .unwrap_or_default();
    let mut tree = Tree::default();
    let mut manifests = Vec::new();
    let mut warnings = Vec::new();
    let mut levels = vec![root.to_path_buf()];
    let mut at = 0;
    while at < levels.len() {
        let dir = levels[at].clone();
        let listing = observe(Access::ListDirectory, &dir).and_then(|()| fs::read_dir(&dir));
        let entries = match listing {
            Ok(entries) => entries,
            Err(error) if at == 0 => {
                return Err(Error::Invalid(format!(
                    "no-root: {} cannot be listed ({error})",
                    root.display()
                )));
            }
            Err(error) => {
                warnings.push(format!(
                    "{} could not be listed ({error})",
                    dir.strip_prefix(root).unwrap().display()
                ));
                at += 1;
                continue;
            }
        };
        let mut collected = Vec::new();
        for entry in entries {
            match entry {
                Ok(entry) => collected.push(entry),
                Err(error) if at == 0 => {
                    return Err(Error::Invalid(format!(
                        "no-root: {} cannot be listed ({error})",
                        root.display()
                    )));
                }
                Err(error) => warnings.push(format!(
                    "{} entry could not be listed ({error})",
                    dir.strip_prefix(root).unwrap().display()
                )),
            }
        }
        let mut entries = collected;
        entries.sort_by_key(|e| e.file_name());
        for entry in entries {
            let name = entry.file_name().to_string_lossy().into_owned();
            let path = entry.path();
            let label = path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .into_owned();
            let kind = match entry.file_type() {
                Ok(kind) => kind,
                Err(error) => {
                    warnings.push(format!("{label} metadata unavailable ({error})"));
                    continue;
                }
            };
            if kind.is_dir() {
                tree.dirs.insert(name.to_lowercase());
                if at == 0 && !SKIP.contains(&name.as_str()) {
                    levels.push(path);
                }
                continue;
            }
            tree.files.insert(name.to_lowercase());
            if let Some((prefix, extension)) = name.rsplit_once('.')
                && !prefix.is_empty()
            {
                tree.extensions
                    .insert(format!(".{}", extension.to_lowercase()));
            }
            if !MANIFESTS.contains(&name.as_str()) {
                continue;
            }
            manifests.push(label.clone());
            if !kind.is_file() {
                warnings.push(format!("{label} is not a regular manifest; skipped"));
                continue;
            }
            let text = match observe(Access::ReadManifest, &path)
                .and_then(|()| fs::read_to_string(&path))
            {
                Ok(text) => text,
                Err(error) => {
                    warnings.push(format!("{label} could not be read ({error})"));
                    continue;
                }
            };
            match manifest_dependencies(&name, &text) {
                Ok(deps) => {
                    for dep in deps {
                        let dep = dep.to_lowercase();
                        if let Some(last) = dep.rsplit('/').next() {
                            tree.dependencies.insert(last.into());
                        }
                        tree.dependencies.insert(dep);
                    }
                }
                Err(error) => warnings.push(format!("{label} failed to parse ({error})")),
            }
        }
        at += 1;
    }
    let mut report = Report {
        root: root.to_string_lossy().into_owned(),
        manifests,
        evidenced: vec![],
        silent: vec![],
        unspeakable: vec![],
        inconclusive: false,
        recommended: CATEGORIES.iter().map(|c| (*c).into()).collect(),
        options: vec![],
        warnings,
    };
    for category in CATEGORIES {
        let mut signal = None;
        for (table, values, kind) in [
            (DIR, &tree.dirs, 0),
            (FILE, &tree.files, 1),
            (EXT, &tree.extensions, 2),
            (DEP, &tree.dependencies, 3),
        ] {
            if let Some((_, names)) = table.iter().find(|(c, _)| *c == category)
                && let Some(name) = names.iter().find(|name| values.contains(**name))
            {
                signal = Some(match kind {
                    0 => format!("directory {name}/"),
                    1 => format!("file {name}"),
                    2 => format!("{name} files"),
                    _ => format!("dependency {name}"),
                });
                break;
            }
        }
        if let Some(signal) = signal {
            report.evidenced.push(Signal {
                category: category.into(),
                signal,
            });
        } else {
            report.silent.push(category.into());
        }
        if [DIR, FILE, EXT, DEP]
            .iter()
            .all(|table| !table.iter().any(|(c, _)| *c == category))
        {
            report.unspeakable.push(category.into());
        }
    }
    report.inconclusive = report.evidenced.is_empty();
    report.options = interview_options(&report, &answered);
    Ok(report)
}

fn ordered(values: &[String]) -> Vec<String> {
    CATEGORIES
        .iter()
        .filter(|c| values.iter().any(|v| v == **c))
        .map(|c| (*c).into())
        .collect()
}
fn interview_options(report: &Report, answered: &[String]) -> Vec<Choice> {
    let evidence = report
        .evidenced
        .iter()
        .map(|s| s.category.clone())
        .collect::<Vec<_>>();
    let naming = report
        .evidenced
        .iter()
        .map(|s| format!("{} ({})", s.category, s.signal))
        .collect::<Vec<_>>()
        .join(", ");
    let mut candidates = vec![Choice {
        surfaces: report.recommended.clone(),
        reason: if evidence.is_empty() {
            "The structure evidences nothing either way; silence is never absence, so every category stays in scope.".into()
        } else {
            format!(
                "The structure evidences {naming}; the rest are silent, so every category stays in scope."
            )
        },
    }];
    if !answered.is_empty() && evidence.iter().any(|c| !answered.contains(c)) {
        candidates.push(Choice {
            surfaces: ordered(&[answered, &evidence].concat()),
            reason: format!("The answered set plus the newly evidenced categories: {naming}"),
        });
    }
    candidates.push(Choice {
        surfaces: ordered(answered),
        reason: "The set already answered, left unchanged".into(),
    });
    candidates.push(Choice {
        surfaces: evidence,
        reason: format!("Only what the structure evidences: {naming}"),
    });
    let mut seen = BTreeSet::new();
    candidates
        .into_iter()
        .filter(|c| !c.surfaces.is_empty() && seen.insert(c.surfaces.clone()))
        .take(4)
        .collect()
}

fn dependency_name(value: &str) -> Option<String> {
    let value = value.trim();
    if !value.starts_with(|c: char| c.is_ascii_alphabetic()) {
        return None;
    }
    Some(
        value
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || "_.-".contains(*c))
            .collect(),
    )
}

/// A conservative manifest reader, not a general TOML interpreter. Unsupported
/// syntax contributes no dependency. Quoted metadata/versions are never names.
fn manifest_dependencies(name: &str, text: &str) -> std::result::Result<Vec<String>, String> {
    if name == "package.json" {
        let value: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
        return Ok(["dependencies", "devDependencies", "peerDependencies"]
            .iter()
            .flat_map(|key| {
                value
                    .get(key)
                    .and_then(|v| v.as_object())
                    .into_iter()
                    .flat_map(|o| o.keys().cloned())
            })
            .collect());
    }
    if name == "requirements.txt" {
        return Ok(text
            .lines()
            .filter_map(|l| dependency_name(l.split('#').next().unwrap_or_default()))
            .collect());
    }
    if name == "go.mod" {
        return Ok(text
            .lines()
            .filter_map(|line| {
                let line = line.split("//").next()?.trim();
                let mut words = line
                    .strip_prefix("require ")
                    .unwrap_or(line)
                    .split_whitespace();
                let dep = words.next()?;
                (dep.contains('/')
                    && dep.starts_with(|c: char| c.is_ascii_alphanumeric())
                    && words.next()?.starts_with('v'))
                .then(|| dep.into())
            })
            .collect());
    }
    let mut out = Vec::new();
    let mut section = Vec::<String>::new();
    let mut statement = String::new();
    let mut quote = None;
    let mut escaped = false;
    let mut depth = 0_i32;
    for line in text.lines() {
        for c in line.chars() {
            if let Some(q) = quote {
                statement.push(c);
                if escaped {
                    escaped = false;
                } else if c == '\\' && q == '"' {
                    escaped = true;
                } else if c == q {
                    quote = None;
                }
            } else {
                match c {
                    '#' => break,
                    '\'' | '"' => quote = Some(c),
                    '[' | '{' => depth += 1,
                    ']' | '}' => depth -= 1,
                    _ => {}
                }
                if depth < 0 {
                    return Err("unbalanced manifest delimiter".into());
                }
                statement.push(c);
            }
        }
        if quote.is_some() {
            return Err("unterminated manifest string".into());
        }
        if depth != 0 {
            statement.push(' ');
            continue;
        }
        let line = statement.trim();
        if line.starts_with('[') && line.ends_with(']') {
            section = line
                .trim_matches(['[', ']'])
                .split('.')
                .map(|s| s.trim().trim_matches(['\'', '"']).to_lowercase())
                .collect();
            if let Some(i) = section.iter().position(|s| {
                matches!(
                    s.as_str(),
                    "dependencies" | "dev-dependencies" | "build-dependencies"
                )
            }) && i + 1 < section.len()
            {
                out.push(section[i + 1].clone());
            }
        } else if !line.is_empty() {
            let Some((key, value)) = line.split_once('=') else {
                return Err("unsupported manifest statement".into());
            };
            let key = key.trim().trim_matches(['\'', '"']);
            let dep_table = section.last().is_some_and(|s| {
                matches!(
                    s.as_str(),
                    "dependencies" | "dev-dependencies" | "build-dependencies"
                )
            });
            let dep_group = section.last().is_some_and(|s| {
                matches!(s.as_str(), "optional-dependencies" | "dependency-groups")
            });
            if value.trim().starts_with('[') && (key == "dependencies" || dep_table || dep_group) {
                // Extras contain brackets inside the quoted PEP 508 string.
                let mut q = None;
                let mut item = String::new();
                for c in value.chars() {
                    if let Some(end) = q {
                        if c == end {
                            if let Some(dep) = dependency_name(&item) {
                                out.push(dep);
                            }
                            item.clear();
                            q = None;
                        } else {
                            item.push(c);
                        }
                    } else if c == '\'' || c == '"' {
                        q = Some(c);
                    }
                }
            } else if dep_table && let Some(dep) = dependency_name(key) {
                out.push(dep);
            }
        }
        statement.clear();
    }
    if depth != 0 || !statement.trim().is_empty() {
        return Err("unterminated manifest array or table".into());
    }
    Ok(out)
}
