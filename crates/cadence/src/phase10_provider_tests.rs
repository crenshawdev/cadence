//! Truth checks exercise admission, dispatch, closure and filesystem recovery.
use super::*;
use cadence::review::provider::{credentials, transport};
use cadence::store::{filesystem::Filesystem, writer::PlanningPolicy};
use std::{collections::VecDeque, fs, path::PathBuf, sync::{Arc, Mutex}, time::Duration};

tokio::task_local! {
    pub(super) static BOUNDARIES: Arc<Boundaries>;
}

pub(super) struct Boundaries {
    pub credentials: Arc<dyn credentials::Inputs>,
    pub transport: Arc<dyn transport::Transport>,
}

struct Credentials;
impl credentials::Inputs for Credentials {
    fn env(&self, name: &str) -> Option<String> {
        matches!(name, "OPENAI_API_KEY" | "GEMINI_API_KEY" | "DEEPSEEK_API_KEY")
            .then(|| "fixture-key".into())
    }
    fn read(&self, _: &Path) -> Option<String> { None }
}

struct Chunks(VecDeque<Vec<u8>>);
impl transport::Body for Chunks {
    fn chunk(&mut self) -> transport::Pending<'_, Option<Vec<u8>>> {
        Box::pin(async move { Ok(self.0.pop_front()) })
    }
}

struct Wire {
    responses: Mutex<VecDeque<Vec<u8>>>,
    requests: Mutex<Vec<(String, Value)>>,
}
impl Wire {
    fn new(responses: Vec<Vec<u8>>) -> Arc<Self> {
        Arc::new(Self { responses: Mutex::new(responses.into()), requests: Mutex::new(vec![]) })
    }
    fn boundaries(self: &Arc<Self>) -> Arc<Boundaries> {
        Arc::new(Boundaries { credentials: Arc::new(Credentials), transport: self.clone() })
    }
}
impl transport::Transport for Wire {
    fn send(&self, request: transport::Request, _: Duration) -> transport::Pending<'_, transport::Response> {
        Box::pin(async move {
            self.requests.lock().unwrap().push((request.url, request.body));
            let bytes = self.responses.lock().unwrap().pop_front().expect("unexpected HTTP spend");
            Ok(transport::Response {
                status: 200,
                headers: BTreeMap::from([("x-request-id".into(), "wire-request-1".into())]),
                body: Box::new(Chunks(bytes.chunks(31).map(<[u8]>::to_vec).collect())),
            })
        })
    }
}

fn fixture(reviewers: &[&str]) -> (tempfile::TempDir, PathBuf, SessionFactory) {
    let tree = tempfile::tempdir().unwrap();
    let root = tree.path().join(".planning");
    fs::create_dir_all(&root).unwrap();
    let config = json!({"review":{"mode":"single","reviewers":reviewers,
        "triggers":{"diff":{"gate":"advisory","tier":"balanced","effort":"high"}},
        "providers":{
            "openai":{"tiers":{"balanced":"requested-alias"}},
            "gemini":{"tiers":{"balanced":"requested-alias"}},
            "deepseek":{"tiers":{"balanced":"requested-alias"}}
        }}});
    fs::write(root.join("config.v4.json"), serde_json::to_vec(&config).unwrap()).unwrap();
    let data = json!({"import":{"format":1,"complete":true,"source_generation":"fixture",
        "sources":[],"active":{"global":null,"repo":root.join("config.v4.json")},
        "created":[],"warnings":[]}});
    let snapshot = cadence::store::model::Snapshot::new(1, b"", b"", data).unwrap();
    fs::write(root.join("state.json"), snapshot.render().unwrap()).unwrap();
    fs::write(root.join("items.jsonl"), b"").unwrap();
    fs::write(root.join("decisions.jsonl"), b"").unwrap();
    fs::write(tree.path().join("subject.rs"), "pub fn answer() -> u8 { 42 }\n").unwrap();
    (tree, root, SessionFactory::new(None, Arc::new(|_, _| Ok(()))))
}

fn result(answer: Envelope<Output>) -> Value {
    match answer {
        Envelope::Ok(output) => output.result,
        other => panic!("review operation refused: {other:?}"),
    }
}

async fn dispatch(factory: &SessionFactory, root: &Path, key: &str) -> (String, String) {
    let admitted = result(execute(factory, root, Command::Apply(Apply::Admit {
        request: json!({"replay_key":key,"caller":"task","trigger":"diff","specialist":null,
            "project":"p10","cycle":"c1","home":{"kind":"phase","id":"10"},
            "discriminator":key,"phase":10,"plan":1,"anchor":key,"round":1,
            "target":{"kind":"named-file","path":"subject.rs","head":null}}),
    })).await.unwrap());
    let fire = admitted["fire"].as_str().unwrap().to_owned();
    let attempt = admitted["attempt"].as_str().unwrap().to_owned();
    let issued = result(execute(factory, root, Command::Query(Query::Next { fire: fire.clone() })).await.unwrap());
    assert_eq!(issued["state"], "pending", "provider dispatch must be owned background work");
    (fire, attempt)
}

async fn complete(factory: &SessionFactory, root: &Path, fire: &str) -> Value {
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let next = result(execute(factory, root, Command::Query(Query::Next { fire: fire.into() })).await.unwrap());
            if next["delivery"] == "usable-complete" { return next; }
            assert_ne!(next["state"], "dispatch", "provider unexpectedly fell back: {next}");
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }).await.expect("provider did not durably complete")
}

async fn reopen(root: &Path) -> Store {
    Store::open(Filesystem::new(root).unwrap(), PlanningPolicy).await.unwrap()
}

#[tokio::test]
async fn phase10_empty_provider_result_is_usable() {
    let (_tree, root, factory) = fixture(&["openai", "gemini"]);
    let wire = Wire::new(vec![serde_json::to_vec(&json!({"id":"resp-empty","model":"served-openai",
        "output":[{"type":"message","content":[{"type":"output_text","text":"{\"findings\":[]}"}]}]})).unwrap()]);
    BOUNDARIES.scope(wire.boundaries(), async {
        let (fire, attempt_id) = dispatch(&factory, &root, "empty").await;
        assert_eq!(complete(&factory, &root, &fire).await["delivery"], "usable-complete");
        assert_eq!(complete(&factory, &root, &fire).await["delivery"], "usable-complete");
        let queried = result(execute(&factory, &root, Command::Query(Query::Attempt { attempt: attempt_id.clone() })).await.unwrap());
        assert_eq!(queried["state"], "accepted");
        drop(factory);
        let store = reopen(&root).await;
        let attempt = result(query_saved(&store, &root, Query::Attempt { attempt: attempt_id.clone() }).await.unwrap());
        assert_eq!(attempt["state"], "accepted");
        assert_eq!(attempt["observed_host"], "openai");
        assert_eq!(attempt["failure"], Value::Null);
        let original = result(query_saved(&store, &root, Query::Original { original: attempt["original"].as_str().unwrap().into() }).await.unwrap());
        assert_eq!(original["raw_bytes"], json!(b"{\"findings\":[]}".to_vec()));
        assert_eq!(original["findings"], json!([]));
        let inventory = result(query_saved(&store, &root, Query::Inventory {}).await.unwrap());
        let records = &inventory["records"];
        assert_eq!(persistence::terminal_count(records, &attempt_id), 1);
        assert_eq!(records["closures"][&attempt_id]["terminal"], "accepted");
        assert_eq!(records["issued"].as_object().unwrap().len(), 1);
        assert!(records["attempts"].as_object().unwrap().values()
            .all(|a| a["slot"] != "claude-subagent"));
        assert!(records["attempts"].as_object().unwrap().values()
            .filter(|a| a["slot"] == "gemini").all(|a| a["state"] == "not-selected"));
        assert_eq!(wire.requests.lock().unwrap().len(), 1);
        assert_eq!(wire.requests.lock().unwrap()[0].0, "https://api.openai.com/v1/responses");
    }).await;
}
