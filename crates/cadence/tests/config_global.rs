use cadence::store::{
    Error, Observed, Storage,
    filesystem::Filesystem,
    transaction::ExternalChange,
};

fn observed(bytes: Option<&[u8]>, identity: &str) -> Observed {
    Observed {
        bytes: bytes.map(Vec::from),
        identity: identity.into(),
        directory_identity: "global-parent".into(),
    }
}

fn change() -> ExternalChange {
    ExternalChange {
        target: "global-config".into(),
        expected: observed(Some(br#"{"workflow":{"verifier":false}}"#), "generation-2"),
        bytes: br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.to_vec(),
    }
}

#[test]
fn stale_global_generation_returns_the_exact_typed_refusal() {
    assert_eq!(
        change().validate(&observed(Some(b"{}"), "generation-3"), false),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn fresh_global_generation_returns_both_accepted_keys() {
    assert_eq!(
        change().validate(
            &observed(Some(br#"{"workflow":{"verifier":false}}"#), "generation-2"),
            false
        ),
        Ok(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.as_slice())
    );
}

#[test]
fn first_creation_refuses_an_already_accepted_global() {
    let mut supplied = change();
    supplied.expected = observed(None, "global-parent");
    assert_eq!(
        supplied.validate(&observed(Some(b"{}"), "generation-1"), false),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn first_creation_accepts_the_missing_destination_token() {
    let mut supplied = change();
    supplied.expected = observed(None, "global-parent");
    assert_eq!(
        supplied.validate(&observed(None, "global-parent"), false),
        Ok(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.as_slice())
    );
}

#[test]
fn recovery_accepts_exact_installed_bytes_in_the_bound_parent() {
    assert_eq!(
        change().validate(
            &observed(
                Some(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#),
                "installed-inode"
            ),
            true
        ),
        Ok(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#.as_slice())
    );
}

#[test]
fn recovery_refuses_a_newer_foreign_global_value() {
    assert_eq!(
        change().validate(
            &observed(Some(br#"{"workflow":{"verifier":true}}"#), "foreign-inode"),
            true
        ),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn recovery_refuses_identical_bytes_in_a_replaced_parent() {
    let mut current = observed(
        Some(br#"{"workflow":{"verifier":false,"plan_checker":false}}"#),
        "installed-inode",
    );
    current.directory_identity = "foreign-parent".into();
    assert_eq!(
        change().validate(&current, true),
        Err(Error::Conflict(
            "pending participant changed: global-config".into()
        ))
    );
}

#[test]
fn acquire_refuses_replaced_registered_parent() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().join("project/.planning");
    let global = fixture.path().join("global/config.v4.json");
    let mut storage = Filesystem::new(&root)
        .unwrap()
        .with_participant("global-config", &global)
        .unwrap();
    std::fs::rename(global.parent().unwrap(), fixture.path().join("old-global")).unwrap();
    std::fs::create_dir(global.parent().unwrap()).unwrap();
    assert_eq!(
        storage.acquire().err(),
        Some(Error::Conflict(
            "registered directory identity changed".into()
        ))
    );
}
