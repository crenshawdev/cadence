#[allow(dead_code)]
#[path = "../src/review/manifest.rs"]
mod manifest;
#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
#[allow(dead_code)]
#[path = "../src/review/material.rs"]
mod material;
#[allow(dead_code)]
#[path = "../src/review/material_io.rs"]
mod material_io;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;

use cadence::store::{Error, Observed, Result, Storage};
use io::{Clock, DirectoryObservation, GitIo, GitObservation, MaterialIo};
use serde_json::{Value, json};
use std::collections::BTreeMap;

fn snapshot(name: &str) -> Value {
    let fixtures: Value =
        serde_json::from_str(include_str!("fixtures/phase9/material-snapshots.json")).unwrap();
    fixtures[name].clone()
}

struct FixedClock;
impl Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}

struct Source(Value);
impl MaterialIo for Source {
    fn read(&mut self, path: &str) -> Result<Observed> {
        if self.0["path"] != path {
            panic!("forbidden source read: {path}");
        }
        if let Some(error) = self.0["error"].as_str() {
            return Err(Error::Io(error.into()));
        }
        Ok(Observed {
            bytes: self.0["bytes"].as_str().map(|s| s.as_bytes().to_vec()),
            identity: self.0["identity"].as_str().unwrap().into(),
            directory_identity: "dir1".into(),
        })
    }
    fn list(&mut self, _: &str) -> Result<DirectoryObservation> {
        panic!("forbidden directory read")
    }
}

struct Git {
    input: Value,
    resolved: bool,
}
impl GitIo for Git {
    fn resolve(&mut self, _: &model::Target) -> Result<GitObservation> {
        if self.resolved {
            panic!("forbidden repeated mutable Git resolution");
        }
        self.resolved = true;
        Ok(GitObservation {
            base: self.input["base"].as_str().unwrap().into(),
            head: self.input["head"].as_str().map(str::to_owned),
            index: self.input["index"].as_str().map(str::to_owned),
            paths: serde_json::from_value(self.input["paths"].clone()).unwrap(),
            diff: self.input["diff"].as_str().unwrap().as_bytes().to_vec(),
        })
    }
    fn read_object(&mut self, object: &str, path: &str) -> Result<Vec<u8>> {
        Ok(self.input["objects"][format!("{object}:{path}")]
            .as_str()
            .expect("forbidden Git object read")
            .as_bytes()
            .to_vec())
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

/// Project the specified target and first retained source observation. Extra
/// H2 metadata remains on the production result; this is not a second read unit.
fn acquired(result: material::RetainedMaterial) -> Value {
    let mut value = serde_json::to_value(&result.manifest.target).unwrap();
    value["bytes"] = json!(
        String::from_utf8(result.contents[&result.manifest.entries[0].entry].clone()).unwrap()
    );
    value
}

#[test]
fn retain_range_ac34() {
    let input = snapshot("range");
    let target = serde_json::from_value(input["target"].clone()).unwrap();
    let mut git = Git {
        input,
        resolved: false,
    };
    assert_eq!(
        acquired(
            material::retain_range(
                "m1",
                "f1",
                &target,
                &mut git,
                &mut Saved::default(),
                &mut FixedClock
            )
            .unwrap()
        ),
        json!({"kind":"committed-range","base":"b1","head":"h1","bytes":"old\n"})
    );
}
#[test]
fn retain_staged_ac35() {
    let input = snapshot("staged");
    let target = serde_json::from_value(input["target"].clone()).unwrap();
    let mut git = Git {
        input,
        resolved: false,
    };
    assert_eq!(
        acquired(
            material::retain_staged(
                "m1",
                "f1",
                &target,
                &mut git,
                &mut Saved::default(),
                &mut FixedClock
            )
            .unwrap()
        ),
        json!({"kind":"staged-tree","base":"b1","index":"t1","head":null,"bytes":"old\n"})
    );
}
#[test]
fn retain_file_ac36() {
    let mut input = Source(snapshot("file"));
    assert_eq!(
        acquired(
            material::retain_file(
                "m1",
                "f1",
                "a.rs",
                &mut input,
                &mut Saved::default(),
                &mut FixedClock
            )
            .unwrap()
        ),
        json!({"kind":"named-file","path":"a.rs","head":null,"bytes":"old\n"})
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
#[test]
fn retain_missing_file() {
    let mut input = Source(snapshot("missing"));
    assert_eq!(
        material::retain_file(
            "m1",
            "f1",
            "a.rs",
            &mut input,
            &mut Saved::default(),
            &mut FixedClock
        )
        .unwrap()
        .manifest
        .entries[0]
            .availability,
        model::Availability::Absent
    );
}
#[test]
fn retain_unavailable_file() {
    let mut input = Source(snapshot("unavailable"));
    assert_eq!(
        material::retain_file(
            "m1",
            "f1",
            "a.rs",
            &mut input,
            &mut Saved::default(),
            &mut FixedClock
        )
        .unwrap()
        .manifest
        .entries[0]
            .availability,
        model::Availability::Unavailable
    );
}
#[test]
fn retain_sync_failure() {
    let mut input = Source(snapshot("file"));
    let mut saved = Saved {
        fail_sync: true,
        ..Saved::default()
    };
    assert_eq!(
        material::retain_file("m1", "f1", "a.rs", &mut input, &mut saved, &mut FixedClock)
            .unwrap_err(),
        Error::Io("sync failed".into())
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

struct DirectorySource(Value);
impl MaterialIo for DirectorySource {
    fn list(&mut self, path: &str) -> Result<DirectoryObservation> {
        if path != "dir" {
            panic!("forbidden directory read");
        }
        Ok(DirectoryObservation {
            identity: "directory1".into(),
            members: serde_json::from_value(self.0["members"].clone()).unwrap(),
        })
    }
    fn read(&mut self, path: &str) -> Result<Observed> {
        let bytes = self.0["contents"][path]
            .as_str()
            .expect("forbidden member read");
        Ok(Observed {
            bytes: Some(bytes.as_bytes().to_vec()),
            identity: "member1".into(),
            directory_identity: "directory1".into(),
        })
    }
}
#[test]
fn read_directory_acquisition_freezes_members() {
    let mut input = DirectorySource(read_fixture()["acquire_directory"].clone());
    assert_eq!(
        material::retain_directory(
            "m1",
            "f1",
            "dir",
            &mut input,
            &mut Saved::default(),
            &mut FixedClock
        )
        .unwrap()
        .manifest
        .target,
        model::Target::Directory {
            path: "dir".into(),
            members: vec!["a.rs".into(), "b.rs".into()]
        }
    );
}
