use cadence::rail::surfaces::{self, Access, Report};
use std::{collections::BTreeSet, fs, io, path::Path};
fn put(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}
fn categories(report: &Report) -> Vec<&str> {
    report
        .evidenced
        .iter()
        .map(|s| s.category.as_str())
        .collect()
}
fn observed(root: &Path) -> Report {
    surfaces::detect_observed(root, None, |access, path| {
        if access == Access::ReadManifest {
            assert!(
                [
                    "package.json",
                    "Cargo.toml",
                    "pyproject.toml",
                    "go.mod",
                    "requirements.txt"
                ]
                .contains(&path.file_name().unwrap().to_str().unwrap()),
                "source body opened: {}",
                path.display()
            );
        }
        Ok(())
    })
    .unwrap()
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
        let temp = tempfile::tempdir().unwrap();
        put(temp.path(), name, text);
        let report = observed(temp.path());
        assert!(report.warnings.is_empty(), "{report:?}");
        assert_eq!(categories(&report), expected, "{name}");
    }
}
#[test]
fn two_level_walk_names_extensions_skips_and_symlinks_never_open_source_bodies() {
    let root = tempfile::tempdir().unwrap();
    let external = tempfile::tempdir().unwrap();
    put(
        root.path(),
        "source.rs",
        "auth stripe DELETE api_key JSON.parse",
    );
    put(
        root.path(),
        "packages/api/router.rs",
        "never read deep source",
    );
    put(
        root.path(),
        "packages/api/package.json",
        r#"{"dependencies":{"stripe":"1"}}"#,
    );
    put(root.path(), "db/schema.sql", "never read SQL");
    put(root.path(), "api.proto", "never read proto");
    put(root.path(), ".env", "never read credentials");
    for dir in [
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
    ] {
        put(
            root.path(),
            &format!("{dir}/package.json"),
            r#"{"dependencies":{"passport":"1","stripe":"1"}}"#,
        );
    }
    put(
        external.path(),
        "package.json",
        r#"{"dependencies":{"stripe":"1"}}"#,
    );
    std::os::unix::fs::symlink(external.path(), root.path().join("linked")).unwrap();
    std::os::unix::fs::symlink(
        external.path().join("package.json"),
        root.path().join("package.json"),
    )
    .unwrap();
    let before = observed(root.path());
    assert_eq!(
        categories(&before),
        ["migrations", "secrets", "api_contract"]
    );
    assert_eq!(before.manifests, ["package.json"]);
    assert_eq!(before.warnings.len(), 1);
    for path in [
        "source.rs",
        "packages/api/router.rs",
        "db/schema.sql",
        "api.proto",
        ".env",
    ] {
        put(root.path(), path, "totally different source bodies");
    }
    assert_eq!(observed(root.path()), before);
    put(root.path(), "requirements.txt", "stripe>=1");
    assert_eq!(
        categories(&observed(root.path())),
        ["migrations", "billing", "secrets", "api_contract"]
    );
}
#[test]
fn root_refuses_but_child_and_manifest_failures_warn_and_retain_evidence() {
    let root = tempfile::tempdir().unwrap();
    assert!(
        surfaces::detect(&root.path().join("missing"), None)
            .unwrap_err()
            .to_string()
            .contains("no-root")
    );
    put(root.path(), "auth/source.rs", "not input");
    put(root.path(), "package.json", "{");
    put(root.path(), "requirements.txt", "stripe");
    put(root.path(), "Cargo.toml", "[dependencies]\ntokio = [");
    assert!(
        surfaces::detect_observed(root.path(), None, |_, _| Err(
            io::ErrorKind::PermissionDenied.into()
        ))
        .is_err()
    );
    let report = surfaces::detect_observed(root.path(), None, |access, path| {
        if (access == Access::ListDirectory && path.ends_with("auth"))
            || (access == Access::ReadManifest && path.ends_with("requirements.txt"))
        {
            Err(io::ErrorKind::PermissionDenied.into())
        } else {
            Ok(())
        }
    })
    .unwrap();
    assert_eq!(categories(&report), ["auth"]);
    assert_eq!(report.warnings.len(), 4, "{report:?}");
    for name in ["auth", "package.json", "requirements.txt", "Cargo.toml"] {
        assert!(report.warnings.iter().any(|w| w.contains(name)));
    }
}
#[test]
fn recommendation_never_narrows_unspeakable_is_silent_and_choices_are_unique() {
    let root = tempfile::tempdir().unwrap();
    let empty = observed(root.path());
    assert!(empty.inconclusive);
    assert_eq!(empty.unspeakable, ["destructive"]);
    assert!(empty.silent.contains(&"destructive".into()));
    assert_eq!(empty.options.len(), 1);
    assert_eq!(empty.recommended.len(), 8);
    put(
        root.path(),
        "package.json",
        r#"{"dependencies":{"stripe":"1"}}"#,
    );
    for answered in [
        None,
        Some(vec!["auth".into()]),
        Some(vec!["billing".into()]),
        Some(empty.recommended.clone()),
    ] {
        let report = surfaces::detect(root.path(), answered).unwrap();
        assert_eq!(report.recommended, empty.recommended);
        assert_eq!(report.options[0].surfaces, empty.recommended);
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
    for invalid in [vec![], vec!["auth".into(), "typo".into()]] {
        assert!(surfaces::detect(root.path(), Some(invalid)).is_err());
    }
}
