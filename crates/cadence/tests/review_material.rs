use cadence::review::{io, material, model};

use cadence::store::{Error, Observed, Result, Storage};
use io::GitObservation;
use serde_json::{Value, json};
use std::collections::BTreeMap;

fn snapshot(name: &str) -> Value {
    let fixtures: Value =
        serde_json::from_str(include_str!("fixtures/phase9/material-snapshots.json")).unwrap();
    fixtures[name].clone()
}

/// The Git observation a fixture describes, as a value.
fn observation(input: &Value) -> GitObservation {
    GitObservation {
        base: input["base"].as_str().unwrap().into(),
        head: input["head"].as_str().map(str::to_owned),
        index: input["index"].as_str().map(str::to_owned),
        paths: serde_json::from_value(input["paths"].clone()).unwrap(),
        diff: input["diff"].as_str().unwrap().as_bytes().to_vec(),
    }
}

#[derive(Default)]
struct Saved {
    files: BTreeMap<String, Vec<u8>>,
    fail_sync: bool,
}
impl Storage for Saved {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, target: &str) -> Result<Observed> {
        if !target.starts_with("material-") {
            panic!("forbidden mutable-source read: {target}");
        }
        Ok(Observed {
            bytes: self.files.get(target).cloned(),
            identity: "saved1".into(),
            directory_identity: "store1".into(),
        })
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        Ok((target.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        if self.fail_sync {
            return Err(Error::Io("sync failed".into()));
        }
        self.files.insert(prepared.0.clone(), prepared.1.clone());
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let observed = self.read(target)?;
        if observed.bytes.as_deref() != Some(bytes) {
            return Err(Error::Conflict("bytes differ".into()));
        }
        Ok(observed)
    }
    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        if self.fail_sync {
            return Err(Error::Io("sync failed".into()));
        }
        self.confirm(target, bytes)
    }
    fn remove(&mut self, _: &str) -> Result<()> {
        panic!("forbidden retained deletion")
    }
}

#[test]
fn retain_range_ac34() {
    let input = snapshot("range");
    let target = serde_json::from_value(input["target"].clone()).unwrap();
    let observed = observation(&input);
    let (resolved, tip, side) = material::resolve_git_target(&target, &observed).unwrap();
    assert_eq!(
        serde_json::to_value(&resolved).unwrap(),
        json!({"kind":"committed-range","base":"b1","head":"h1"})
    );
    assert_eq!(
        material::git_reads(&observed, &tip, &side),
        [("a.rs".into(), "b1".into(), model::Side::Base), ("a.rs".into(), "h1".into(), model::Side::Head)]
    );
}
#[test]
fn retain_staged_ac35() {
    let input = snapshot("staged");
    let target = serde_json::from_value(input["target"].clone()).unwrap();
    let observed = observation(&input);
    let (resolved, tip, side) = material::resolve_git_target(&target, &observed).unwrap();
    assert_eq!(
        serde_json::to_value(&resolved).unwrap(),
        json!({"kind":"staged-tree","base":"b1","index":"t1","head":null})
    );
    assert_eq!(
        material::git_reads(&observed, &tip, &side),
        [("a.rs".into(), "b1".into(), model::Side::Base), ("a.rs".into(), "t1".into(), model::Side::Snapshot)]
    );
}
#[test]
fn retain_content_old_ac41() {
    let input = snapshot("old");
    assert_eq!(
        material::artifact_content_id(input.as_str().unwrap().as_bytes()),
        "01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee"
    );
}
#[test]
fn retain_content_new_ac42() {
    let input = snapshot("new");
    assert_eq!(
        material::artifact_content_id(input.as_str().unwrap().as_bytes()),
        "7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c"
    );
}
/// One source read of `a.rs` as a fixture describes it, as a value.
fn read_of(input: &Value) -> Result<Observed> {
    match input["error"].as_str() {
        Some(error) => Err(Error::Io(error.into())),
        None => Ok(Observed {
            bytes: input["bytes"].as_str().map(|s| s.as_bytes().to_vec()),
            identity: input["identity"].as_str().unwrap().into(),
            directory_identity: "dir1".into(),
        }),
    }
}
#[test]
fn retain_missing_file() {
    let (entry, bytes) = material::observed_file("m1", "a.rs", read_of(&snapshot("missing")), 100);
    assert_eq!((entry.availability, bytes), (model::Availability::Absent, None));
}
#[test]
fn retain_unavailable_file() {
    let (entry, bytes) = material::observed_file("m1", "a.rs", read_of(&snapshot("unavailable")), 100);
    assert_eq!((entry.availability, bytes), (model::Availability::Unavailable, None));
    assert!(entry.unavailable_reason.unwrap().contains("permission denied"), "the read's reason is kept");
}
#[test]
fn retain_sync_failure() {
    let (mut entry, bytes) = material::observed_file("m1", "a.rs", read_of(&snapshot("file")), 100);
    let mut saved = Saved {
        fail_sync: true,
        ..Saved::default()
    };
    assert_eq!(
        material::retain_bytes(&mut saved, &mut entry, &bytes.unwrap()),
        Err(Error::Io("sync failed".into()))
    );
}

fn read_fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/material-read.json")).unwrap()
}
fn saved_image(input: &Value) -> Saved {
    Saved {
        files: input["retained"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(key, value)| (key.clone(), value.as_str().unwrap().as_bytes().to_vec()))
            .collect(),
        fail_sync: false,
    }
}
#[test]
fn read_original_ac37() {
    let input = read_fixture();
    let entry = serde_json::from_value(input["e1"].clone()).unwrap();
    assert_eq!(
        material::read_material(&mut saved_image(&input), &entry).unwrap(),
        b"old\n"
    );
}
#[test]
fn read_supporting_ac74() {
    let input = read_fixture();
    let entry = serde_json::from_value(input["e3"].clone()).unwrap();
    assert_eq!(
        material::read_material(&mut saved_image(&input), &entry).unwrap(),
        b"support\n"
    );
}
#[test]
fn read_directory_ac133() {
    let input = read_fixture();
    let manifest = model::Manifest {
        manifest: "m1".into(),
        fire: "f1".into(),
        contract: model::Contract::current(),
        target: serde_json::from_value(input["directory"].clone()).unwrap(),
        entries: vec![serde_json::from_value(input["e1"].clone()).unwrap()],
    };
    let result = material::read_directory_target(&mut saved_image(&input), &manifest).unwrap();
    assert_eq!(
        json!({"members":result.members,"contents":result.contents.into_iter()
        .map(|(key, bytes)| (key, String::from_utf8(bytes).unwrap())).collect::<BTreeMap<_,_>>()}),
        json!({"members":["a.rs"],"contents":{"a.rs":"old\n"}})
    );
}
#[test]
fn read_missing_retained_bytes() {
    let input = read_fixture();
    let entry = serde_json::from_value(input["e1"].clone()).unwrap();
    assert_eq!(
        material::read_material(&mut Saved::default(), &entry),
        Err(Error::Io("material unavailable: e1".into()))
    );
}
#[test]
fn read_changed_retained_bytes() {
    let input = read_fixture();
    let entry = serde_json::from_value(input["e1"].clone()).unwrap();
    let mut saved = Saved {
        files: [("material-e1".into(), b"new\n".to_vec())].into(),
        fail_sync: false,
    };
    assert_eq!(
        material::read_material(&mut saved, &entry),
        Err(Error::Io("material unavailable: e1".into()))
    );
}

#[test]
fn read_directory_acquisition_freezes_members() {
    let input = read_fixture()["acquire_directory"].clone();
    let listed: Vec<String> = serde_json::from_value(input["members"].clone()).unwrap();
    let tree = material::directory_files("dir", &mut |path| {
        assert_eq!(path, "dir", "only the root was listed");
        Ok(io::DirectoryMembers {
            identity: "directory1".into(),
            members: listed
                .iter()
                .map(|name| io::DirectoryNode { name: name.clone(), kind: io::NodeKind::File })
                .collect(),
        })
    })
    .unwrap();
    assert_eq!(tree.files, ["a.rs", "b.rs"]);
}

#[test]
fn a_named_file_is_retained_as_a_named_file_target_without_a_head() {
    let retained =
        material::retain_file("m1", "f1", "a.rs", read_of(&snapshot("file")), &mut Saved::default(), 100)
            .unwrap();
    assert_eq!(
        retained.manifest.target,
        model::Target::NamedFile {
            path: "a.rs".into(),
            head: None,
        }
    );
}
#[test]
fn a_named_file_retains_exactly_the_bytes_observed() {
    let mut saved = Saved::default();
    let retained =
        material::retain_file("m1", "f1", "a.rs", read_of(&snapshot("file")), &mut saved, 100).unwrap();
    let key = retained.manifest.entries[0].retained.clone().unwrap();
    assert_eq!(saved.files[&key], b"old\n");
}
