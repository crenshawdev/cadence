//! What a config reload keeps between reads, and what the config policy hands
//! its evaluator. The layers are held in memory behind the file seam; nothing
//! here reads a file.

use cadence::{
    config::{
        merge,
        reload::{ConfigIo, ConfigPolicy, Generation, Input, Paths, Reload},
    },
    store::{Error, MutationContext, Policy, Result, model::Snapshot},
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// The config files as the seam reads them: each path's bytes, and whether
/// every read fails.
type Files = Arc<Mutex<Vec<(PathBuf, Vec<u8>)>>>;

/// What an evaluator was handed: the verifier value and the generation number.
type Seen = Arc<Mutex<Vec<(Option<Value>, u64)>>>;

type Evaluate = Box<dyn FnMut(&MutationContext<'_>, &Generation) -> Result<()> + Send>;

#[derive(Clone, Default)]
struct Layers {
    files: Files,
    failing: Arc<Mutex<bool>>,
}

impl Layers {
    fn write(&self, path: &str, value: Value) {
        self.write_bytes(path, &serde_json::to_vec(&value).unwrap());
    }

    fn write_bytes(&self, path: &str, bytes: &[u8]) {
        let mut files = self.files.lock().unwrap();
        files.retain(|(held, _)| held != Path::new(path));
        files.push((path.into(), bytes.to_vec()));
    }

    fn fail(&self, failing: bool) {
        *self.failing.lock().unwrap() = failing;
    }
}

impl ConfigIo for Layers {
    fn identity(&mut self, path: &Path) -> Result<PathBuf> {
        Ok(path.into())
    }
    fn read(&mut self, path: &Path) -> Result<Input> {
        if *self.failing.lock().unwrap() {
            return Err(Error::Io(format!("config {} is unreadable", path.display())));
        }
        let bytes = self.files.lock().unwrap().iter().find(|(held, _)| held == path).map(|(_, bytes)| bytes.clone());
        Ok(Input { identity: path.into(), bytes, stamp: None })
    }
}

const REPO: &str = "/project/.planning/config.v4.json";

fn paths() -> Paths {
    Paths { repo: REPO.into(), global: Some("/global/config.v4.json".into()) }
}

fn verifier(generation: &Generation) -> Option<Value> {
    merge::get(&generation.effective.values, "workflow.verifier").cloned()
}

#[test]
fn unchanged_layers_return_the_same_generation() {
    let layers = Layers::default();
    layers.write(REPO, json!({"workflow":{"verifier":true}}));
    let mut reload = Reload::new(paths(), layers);
    let first = reload.refresh().unwrap();
    assert_eq!(reload.refresh().unwrap().number, first.number);
}

#[test]
fn a_changed_layer_makes_a_new_generation_with_its_values() {
    let layers = Layers::default();
    layers.write(REPO, json!({"workflow":{"verifier":true}}));
    let mut reload = Reload::new(paths(), layers.clone());
    let first = reload.refresh().unwrap();
    layers.write(REPO, json!({"workflow":{"verifier":false}}));
    let changed = reload.refresh().unwrap();
    assert!(changed.number > first.number);
    assert_eq!(verifier(&changed), Some(json!(false)));
}

#[test]
fn a_failed_read_discards_the_cached_generation_so_the_next_read_is_a_new_one() {
    let layers = Layers::default();
    layers.write(REPO, json!({"workflow":{"verifier":true}}));
    let mut reload = Reload::new(paths(), layers.clone());
    let first = reload.refresh().unwrap();
    layers.fail(true);
    assert!(matches!(reload.refresh(), Err(Error::Io(_))));
    layers.fail(false);
    let next = reload.refresh().unwrap();
    assert!(next.number > first.number, "{} after {}", next.number, first.number);
}

#[test]
fn an_invalid_layer_is_refused_rather_than_answered_from_the_cached_generation() {
    let layers = Layers::default();
    layers.write(REPO, json!({"workflow":{"verifier":true}}));
    let mut reload = Reload::new(paths(), layers.clone());
    reload.refresh().unwrap();
    layers.write_bytes(REPO, b"{");
    assert!(matches!(reload.refresh(), Err(Error::Invalid(_))));
}

fn snapshot() -> Snapshot {
    Snapshot::new(1, b"", b"", Value::Null).unwrap()
}

/// A policy over `layers` whose evaluator records the verifier value and
/// generation number it was handed, and allows everything.
fn policy(
    layers: Layers,
) -> (ConfigPolicy<Layers, Evaluate>, Seen) {
    let seen = Seen::default();
    let record = seen.clone();
    let evaluate: Evaluate = Box::new(move |_: &MutationContext<'_>, generation: &Generation| {
        record.lock().unwrap().push((verifier(generation), generation.number));
        Ok(())
    });
    (ConfigPolicy { config: Arc::new(Mutex::new(Reload::new(paths(), layers))), evaluate }, seen)
}

#[test]
fn each_policy_check_hands_the_evaluator_the_config_as_it_is_now() {
    let layers = Layers::default();
    layers.write(REPO, json!({"workflow":{"verifier":true}}));
    let (mut policy, seen) = policy(layers.clone());
    let snapshot = snapshot();
    let context = MutationContext { operation: "store", snapshot: &snapshot };
    policy.validate(&context).unwrap();
    layers.write(REPO, json!({"workflow":{"verifier":false}}));
    policy.validate(&context).unwrap();
    let seen = seen.lock().unwrap();
    assert_eq!(seen.iter().map(|(value, _)| value.clone()).collect::<Vec<_>>(), [Some(json!(true)), Some(json!(false))]);
    assert!(seen[1].1 > seen[0].1);
}

#[test]
fn a_policy_check_whose_config_cannot_be_read_fails_without_evaluating() {
    let layers = Layers::default();
    layers.write(REPO, json!({"workflow":{"verifier":true}}));
    layers.fail(true);
    let (mut policy, seen) = policy(layers);
    let snapshot = snapshot();
    assert!(matches!(
        policy.validate(&MutationContext { operation: "store", snapshot: &snapshot }),
        Err(Error::Io(_))
    ));
    assert!(seen.lock().unwrap().is_empty());
}
