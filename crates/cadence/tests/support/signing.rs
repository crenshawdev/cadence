use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

// Callers put the repository inside their TempDir. The keyring is its sibling,
// so it is private to that fixture, survives child restarts, and cannot be added
// to a fixture commit. Never change the test process's global environment.
pub fn home(repo: &Path) -> PathBuf {
    repo.parent().unwrap().join("gnupg")
}

pub fn generate(repo: &Path) -> String {
    let home = home(repo);
    fs::create_dir(&home).unwrap();
    fs::set_permissions(&home, fs::Permissions::from_mode(0o700)).unwrap();
    let gpg = |args: &[&str]| {
        let output = Command::new("gpg")
            .env("GNUPGHOME", &home)
            .args(args)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "gpg {args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap()
    };
    gpg(&[
        "--batch",
        "--pinentry-mode",
        "loopback",
        "--passphrase",
        "",
        "--quick-generate-key",
        "John Crenshaw <john@jcrenshaw.dev>",
        "ed25519",
        "sign",
        "0",
    ]);
    // A signing-only primary key has the same long ID that Git reports as %GK.
    let keys = gpg(&["--batch", "--with-colons", "--list-secret-keys"]);
    let key_id = keys
        .lines()
        .find(|line| line.starts_with("sec:"))
        .and_then(|line| line.split(':').nth(4))
        .expect("fixture signing key ID");
    assert_eq!(key_id.len(), 16);
    assert!(key_id.bytes().all(|byte| byte.is_ascii_hexdigit()));
    key_id.to_owned()
}
