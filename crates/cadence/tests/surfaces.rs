use cadence::rail::surfaces::{self, Kind, Report, Seen, Walk};
use std::collections::BTreeSet;
/// The directories the walk lists at the root but never enters.
const SKIPPED: [&str; 13] = [
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
fn categories(report: &Report) -> Vec<&str> {
    report
        .evidenced
        .iter()
        .map(|s| s.category.as_str())
        .collect()
}
/// A walk that saw exactly `seen` under a root.
fn walked(seen: Vec<Seen>) -> Walk {
    Walk { root: "/project".into(), seen: Ok(seen) }
}
fn file(name: &str) -> Seen {
    Seen::Entry { name: name.into(), label: name.into(), kind: Kind::File }
}
fn manifest(name: &str, text: Result<&str, &str>) -> Seen {
    Seen::Manifest {
        name: name.into(),
        label: name.into(),
        text: text.map(String::from).map_err(String::from),
    }
}
/// An entry named by the last part of its path relative to the root.
fn entry(label: &str, kind: Kind) -> Seen {
    let name = label.rsplit('/').next().unwrap();
    Seen::Entry { name: name.into(), label: label.into(), kind }
}
/// What a walk lists for a project with source, credentials and a proto at
/// the root, a database directory, a nested package, every skipped tree, and
/// a symbolic link to a manifest and to a directory: names and kinds only.
fn project() -> Vec<Seen> {
    let mut seen = vec![
        entry(".env", Kind::File),
        entry("api.proto", Kind::File),
        entry("db", Kind::Directory),
        entry("linked", Kind::Other),
        entry("package.json", Kind::Other),
        entry("packages", Kind::Directory),
        entry("source.rs", Kind::File),
    ];
    seen.extend(SKIPPED.iter().map(|dir| entry(dir, Kind::Directory)));
    seen.extend([
        entry("db/schema.sql", Kind::File),
        entry("packages/api", Kind::Directory),
    ]);
    seen
}
#[test]
fn each_manifest_family_extracts_dependency_names_without_metadata_or_substrings() {
    for (name, text, expected) in [
        (
            "package.json",
            r#"{"name":"stripe","description":"passport","dependencies":{"@grpc/grpc-js":"1","authoring":"1"},"devDependencies":{"argon2":"1"},"peerDependencies":{"axum":"1"}}"#,
            vec!["auth", "api_contract", "untrusted_input"],
        ),
        (
            "Cargo.toml",
            "[package]\nname = 'stripe'\ndescription = 'passport'\n[dependencies]\ntokio = { version = '1', features = ['stripe'] }\n[target.'cfg(unix)'.dependencies]\naxum = '1'\n[dependencies.sqlx]\nversion = '1'\n",
            vec!["migrations", "concurrency", "untrusted_input"],
        ),
        (
            "pyproject.toml",
            "[project]\nname = 'stripe'\nignored-dependencies = ['passport']\ndependencies = [\n 'requests[socks]>=2',\n 'fastapi>=1',\n 'python-dotenv>=1'\n]\n[project.optional-dependencies]\ndev = ['celery>=1']\n[tool.poetry.dependencies]\nauthlib = '^1'\n",
            vec!["auth", "concurrency", "secrets", "untrusted_input"],
        ),
        (
            "go.mod",
            "module company/stripe\ngo 1.24\nrequire (\n example.com/axum v1.0.0\n)\nrequire example.com/grpc-js v1.0.0 // comment\n",
            vec!["api_contract", "untrusted_input"],
        ),
        (
            "requirements.txt",
            "# stripe\n-r stripe.txt\nflask[async]>=3\npython-dotenv==1\n",
            vec!["secrets", "untrusted_input"],
        ),
    ] {
        let report = surfaces::judge(&walked(vec![file(name), manifest(name, Ok(text))]), &[]).unwrap();
        assert!(report.warnings.is_empty(), "{report:?}");
        assert_eq!(categories(&report), expected, "{name}");
    }
}
#[test]
fn the_walk_descends_only_into_the_roots_own_children() {
    assert!(surfaces::descends(0, "packages"));
    assert!(!surfaces::descends(1, "api"));
}
#[test]
fn the_walk_never_descends_a_build_cache_or_vendor_tree() {
    for dir in SKIPPED {
        assert!(!surfaces::descends(0, dir), "{dir}");
    }
}
#[test]
fn the_walk_opens_each_regular_file_named_as_a_manifest() {
    for name in [
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "go.mod",
        "requirements.txt",
    ] {
        assert!(surfaces::opens(name, &Kind::File), "{name}");
    }
}
#[test]
fn the_walk_never_opens_a_source_body() {
    for name in ["source.rs", "router.rs", "schema.sql", "api.proto", ".env"] {
        assert!(!surfaces::opens(name, &Kind::File), "{name}");
    }
}
#[test]
fn the_walk_never_opens_a_manifest_that_is_not_a_regular_file() {
    assert!(!surfaces::opens("package.json", &Kind::Other));
}
#[test]
fn directory_file_and_extension_names_are_the_evidence() {
    let report = surfaces::judge(&walked(project()), &[]).unwrap();
    assert_eq!(
        categories(&report),
        ["migrations", "secrets", "api_contract"]
    );
}
#[test]
fn a_manifest_that_is_not_a_regular_file_is_listed_with_a_warning() {
    let report = surfaces::judge(&walked(vec![entry("package.json", Kind::Other)]), &[]).unwrap();
    assert_eq!(report.manifests, ["package.json"]);
    assert_eq!(report.warnings.len(), 1);
}
#[test]
fn a_manifest_dependency_adds_its_category() {
    let mut seen = project();
    seen.extend([
        file("requirements.txt"),
        manifest("requirements.txt", Ok("stripe>=1")),
    ]);
    assert_eq!(
        categories(&surfaces::judge(&walked(seen), &[]).unwrap()),
        ["migrations", "billing", "secrets", "api_contract"]
    );
}
#[test]
fn root_refuses_but_child_and_manifest_failures_warn_and_retain_evidence() {
    let refused = Walk { root: "/project".into(), seen: Err("permission denied".into()) };
    assert!(surfaces::judge(&refused, &[]).unwrap_err().to_string().contains("no-root"));
    let report = surfaces::judge(
        &walked(vec![
            Seen::Entry { name: "auth".into(), label: "auth".into(), kind: Kind::Directory },
            Seen::Unlisted { dir: "auth".into(), error: "permission denied".into() },
            file("package.json"),
            manifest("package.json", Ok("{")),
            file("requirements.txt"),
            manifest("requirements.txt", Err("permission denied")),
            file("Cargo.toml"),
            manifest("Cargo.toml", Ok("[dependencies]\ntokio = [")),
        ]),
        &[],
    )
    .unwrap();
    assert_eq!(categories(&report), ["auth"]);
    assert_eq!(report.warnings.len(), 4, "{report:?}");
    for name in ["auth", "package.json", "requirements.txt", "Cargo.toml"] {
        assert!(report.warnings.iter().any(|w| w.contains(name)), "{name}");
    }
}
/// The report for a structure whose only signal is a stripe dependency.
fn billing_only(answered: &[String]) -> Report {
    surfaces::judge(
        &walked(vec![
            file("package.json"),
            manifest("package.json", Ok(r#"{"dependencies":{"stripe":"1"}}"#)),
        ]),
        answered,
    )
    .unwrap()
}
/// No answer, a narrower answer, a different answer, and every category.
fn answered_sets(every: &[String]) -> [Vec<String>; 4] {
    [
        vec![],
        vec!["auth".into()],
        vec!["billing".into()],
        every.to_vec(),
    ]
}
#[test]
fn an_empty_structure_is_inconclusive_and_recommends_every_category() {
    let empty = surfaces::judge(&walked(vec![]), &[]).unwrap();
    assert!(empty.inconclusive);
    assert_eq!(empty.options.len(), 1);
    assert_eq!(empty.recommended.len(), 8);
}
#[test]
fn destructive_is_unspeakable_and_silent() {
    let empty = surfaces::judge(&walked(vec![]), &[]).unwrap();
    assert_eq!(empty.unspeakable, ["destructive"]);
    assert!(empty.silent.contains(&"destructive".into()));
}
#[test]
fn the_recommendation_never_narrows_whatever_was_answered() {
    let every = surfaces::judge(&walked(vec![]), &[]).unwrap().recommended;
    for answered in answered_sets(&every) {
        let report = billing_only(&answered);
        assert_eq!(report.recommended, every);
        assert_eq!(report.options[0].surfaces, every);
    }
}
#[test]
fn at_most_four_choices_are_offered_and_none_repeats() {
    let every = surfaces::judge(&walked(vec![]), &[]).unwrap().recommended;
    for answered in answered_sets(&every) {
        let report = billing_only(&answered);
        assert!(report.options.len() <= 4);
        assert_eq!(
            report
                .options
                .iter()
                .map(|o| &o.surfaces)
                .collect::<BTreeSet<_>>()
                .len(),
            report.options.len()
        );
    }
}
