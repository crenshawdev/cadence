#[allow(dead_code)]
#[path = "../src/review/io.rs"]
mod io;
#[allow(dead_code)]
#[path = "../src/review/manifest.rs"]
mod manifest;
#[allow(dead_code)]
#[path = "../src/review/material.rs"]
mod material;
#[allow(dead_code)]
#[path = "../src/review/model.rs"]
mod model;
use cadence::store::{Error, Observed, Result, Storage};
use serde_json::{Value, json};
use std::collections::BTreeMap;

fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/phase9/material-context.json")).unwrap()
}

fn additional(input: &Value) -> material::AdditionalMaterial {
    material::AdditionalMaterial {
        entry: input["entry"].as_str().unwrap().into(),
        role: model::MaterialRole::Supporting,
        path: input["path"].as_str().map(str::to_owned),
        label: input["label"].as_str().map(str::to_owned),
        side: model::Side::Snapshot,
        acquisition: input["acquisition"].as_str().unwrap().into(),
        bytes: input["bytes"].as_str().unwrap().as_bytes().to_vec(),
    }
}

struct FixedClock;
impl io::Clock for FixedClock {
    fn now(&mut self) -> u64 {
        100
    }
}

#[derive(Default)]
struct Saved {
    files: BTreeMap<String, Vec<u8>>,
    fail_append_sync: bool,
}
impl Storage for Saved {
    type Prepared = (String, Vec<u8>);
    fn read(&mut self, key: &str) -> Result<Observed> {
        if !key.starts_with("material-") {
            panic!("forbidden mutable source read");
        }
        Ok(Observed {
            bytes: self.files.get(key).cloned(),
            identity: "saved1".into(),
            directory_identity: "store1".into(),
        })
    }
    fn prepare(&mut self, key: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        Ok((key.into(), bytes.into()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        if self.fail_append_sync && prepared.0.starts_with("material-append-") {
            return Err(Error::Io("append sync failed".into()));
        }
        if self.files.contains_key(&prepared.0) {
            panic!("forbidden retained-record replacement");
        }
        self.files.insert(prepared.0.clone(), prepared.1.clone());
        Ok(())
    }
    fn discard(&mut self, _: Self::Prepared) -> Result<()> {
        Ok(())
    }
    fn confirm(&mut self, key: &str, bytes: &[u8]) -> Result<Observed> {
        let observed = self.read(key)?;
        if observed.bytes.as_deref() != Some(bytes) {
            return Err(Error::Conflict("bytes differ".into()));
        }
        Ok(observed)
    }
    fn resync(&mut self, key: &str, bytes: &[u8]) -> Result<Observed> {
        self.confirm(key, bytes)
    }
    fn remove(&mut self, _: &str) -> Result<()> {
        panic!("forbidden retained deletion");
    }
}

#[test]
fn context_original_view_ac76() {
    let input = fixture();
    let saved = serde_json::from_value(input["manifest"].clone()).unwrap();
    let view = serde_json::from_value(input["original"]["view"].clone()).unwrap();
    let delivered = material::DeliveredMaterial {
        attempt: input["original"]["attempt"].as_str().unwrap(),
        view: &view,
    };
    let entry = material::append_material(
        &saved,
        additional(&input["original"]),
        Some(delivered),
        &mut Saved::default(),
        &mut FixedClock,
    )
    .unwrap();
    assert_eq!(
        json!({"entry":entry.entry,"acquired_at":entry.acquired_at,"provenance":entry.provenance,"attempt":entry.attempt,"view":entry.view}),
        json!({"entry":"e3","acquired_at":100,"provenance":"original-view","attempt":"a1","view":"v1"})
    );
}
#[test]
fn context_cannot_retrofit_earlier_view() {
    let input = fixture();
    let saved = serde_json::from_value(input["manifest"].clone()).unwrap();
    let view = serde_json::from_value(input["earlier_view"].clone()).unwrap();
    let delivered = material::DeliveredMaterial {
        attempt: "a1",
        view: &view,
    };
    assert_eq!(
        material::append_material(
            &saved,
            additional(&input["later"]),
            Some(delivered),
            &mut Saved::default(),
            &mut FixedClock
        ),
        Err(Error::Invalid(
            "material not in supplied attempt view".into()
        ))
    );
}
#[test]
fn context_failed_append_sync() {
    let input = fixture();
    let saved = serde_json::from_value(input["manifest"].clone()).unwrap();
    let mut store = Saved {
        fail_append_sync: true,
        ..Saved::default()
    };
    assert_eq!(
        material::append_material(
            &saved,
            additional(&input["later"]),
            None,
            &mut store,
            &mut FixedClock
        ),
        Err(Error::Io("append sync failed".into()))
    );
}
#[test]
fn context_append_preserves_saved_history() {
    let input = fixture();
    let saved = serde_json::from_value(input["manifest"].clone()).unwrap();
    let mut store = Saved {
        files: input["saved"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(key, bytes)| (key.clone(), bytes.as_str().unwrap().as_bytes().to_vec()))
            .collect(),
        fail_append_sync: false,
    };
    material::append_material(
        &saved,
        additional(&input["later"]),
        None,
        &mut store,
        &mut FixedClock,
    )
    .unwrap();
    assert_eq!(
        (
            &store.files["material-manifest-m1"][..],
            &store.files["material-previous-append"][..]
        ),
        (&b"original manifest"[..], &b"previous evidence"[..])
    );
}
#[test]
fn context_inline_decision_retains_exact_payload() {
    let input = fixture();
    let saved = serde_json::from_value(input["manifest"].clone()).unwrap();
    let mut store = Saved::default();
    let result = material::append_material(
        &saved,
        additional(&input["inline_decision"]),
        None,
        &mut store,
        &mut FixedClock,
    )
    .unwrap();
    assert_eq!(
        store.files[result.retained.as_ref().unwrap()],
        br#"{"decision":"D-1","text":"Decision","context":"Context"}"#
    );
}
