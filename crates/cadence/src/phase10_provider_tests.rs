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

fn response(provider: &str, model: Option<&str>, usage: Option<&str>, findings: &str) -> Vec<u8> {
    let mut body = match provider {
        "openai" => json!({"id":"resp-fixture","output_text":findings}),
        "gemini" => json!({"responseId":"gemini-fixture","candidates":[{"content":{"parts":[{"text":findings}]}}]}),
        "deepseek" => json!({"id":"deepseek-fixture","choices":[{"message":{"content":findings}}]}),
        _ => panic!("unknown fixture provider"),
    };
    if let Some(model) = model {
        body[if provider == "gemini" { "modelVersion" } else { "model" }] = json!(model);
    }
    let mut wire = body.to_string();
    if let Some(usage) = usage {
        // Insert the hand-authored numeric lexeme without first parsing it.
        // The production response parser is the first JSON-number boundary.
        wire.pop();
        let field = if provider == "gemini" { "usageMetadata" } else { "usage" };
        wire.push_str(&format!(",\"{field}\":{usage}}}"));
    }
    wire.into_bytes()
}

struct UsageCase {
    provider: &'static str,
    raw: Option<String>,
    input: Option<u64>,
    output: Option<u64>,
    states: (&'static str, &'static str),
    retention: &'static str,
}

#[tokio::test]
async fn phase10_invalid_usage_is_unavailable() {
    let mut cases = vec![];
    for (provider, input, output) in [
        ("openai", "input_tokens", "output_tokens"),
        ("deepseek", "prompt_tokens", "completion_tokens"),
    ] {
        cases.push(UsageCase { provider, raw: Some(format!("{{\"{input}\":0,\"{output}\":0}}")),
            input: Some(0), output: Some(0), states: ("valid", "valid"), retention: "retained" });
        for invalid in ["1.5", "-1", "\"7\"", "null", "true", "9007199254740992", "18446744073709551616", "9007199254740990.5"] {
            cases.push(UsageCase { provider, raw: Some(format!("{{\"{input}\":{invalid},\"{output}\":{invalid}}}")),
                input: None, output: None, states: ("invalid", "invalid"), retention: "retained" });
        }
        cases.push(UsageCase { provider, raw: Some(format!("{{\"{input}\":11}}")),
            input: Some(11), output: None, states: ("valid", "absent"), retention: "retained" });
        cases.push(UsageCase { provider, raw: None, input: None, output: None,
            states: ("absent", "absent"), retention: "absent" });
    }
    for invalid in ["1.5", "-1", "\"7\"", "null", "false", "9007199254740992", "18446744073709551616", "9007199254740990.5"] {
        for (candidate, thoughts) in [(invalid, "2"), ("3", invalid)] {
            cases.push(UsageCase { provider: "gemini",
                raw: Some(format!("{{\"promptTokenCount\":11,\"candidatesTokenCount\":{candidate},\"thoughtsTokenCount\":{thoughts}}}")),
                input: Some(11), output: None, states: ("valid", "invalid"), retention: "retained" });
        }
    }
    for (raw, output, output_state) in [
        ("{\"promptTokenCount\":11,\"candidatesTokenCount\":9007199254740991,\"thoughtsTokenCount\":1}", None, "invalid"),
        ("{\"promptTokenCount\":11,\"candidatesTokenCount\":3}", None, "absent"),
        ("{\"promptTokenCount\":11,\"thoughtsTokenCount\":2}", None, "absent"),
        ("{\"promptTokenCount\":11,\"candidatesTokenCount\":0,\"thoughtsTokenCount\":0}", Some(0), "valid"),
        ("{\"promptTokenCount\":11,\"candidatesTokenCount\":3,\"thoughtsTokenCount\":2}", Some(5), "valid"),
    ] {
        cases.push(UsageCase { provider: "gemini", raw: Some(raw.into()), input: Some(11), output,
            states: ("valid", output_state), retention: "retained" });
    }
    cases.push(UsageCase { provider: "gemini", raw: None, input: None, output: None,
        states: ("absent", "absent"), retention: "absent" });
    cases.push(UsageCase { provider: "openai",
        raw: Some(format!("{{\"input_tokens\":11,\"output_tokens\":5,\"note\":\"{}\"}}", "x".repeat(2049))),
        input: Some(11), output: Some(5), states: ("valid", "valid"), retention: "oversized" });
    cases.push(UsageCase { provider: "openai",
        raw: Some("{\"input_tokens\":11,\"output_tokens\":5,\"apiSecret\":\"must-not-persist\"}".into()),
        input: Some(11), output: Some(5), states: ("valid", "valid"), retention: "credential-bearing" });

    for (index, case) in cases.into_iter().enumerate() {
        let (_tree, root, factory) = fixture(&[case.provider]);
        let wire = Wire::new(vec![response(case.provider, None, case.raw.as_deref(), "{\"findings\":[]}")]);
        BOUNDARIES.scope(wire.boundaries(), async {
            let (fire, attempt_id) = dispatch(&factory, &root, &format!("usage-{index}")).await;
            complete(&factory, &root, &fire).await;
            drop(factory);
            let store = reopen(&root).await;
            let attempt = result(query_saved(&store, &root, Query::Attempt { attempt: attempt_id.clone() }).await.unwrap());
            assert_eq!(attempt["usage"]["input"], json!(case.input), "input row {index}");
            assert_eq!(attempt["usage"]["output"], json!(case.output), "output row {index}");
            assert_eq!(attempt["usage"]["cost"], Value::Null);
            let original = result(query_saved(&store, &root, Query::Original { original: attempt["original"].as_str().unwrap().into() }).await.unwrap());
            assert_eq!(original["findings"], json!([]));
            let inventory = result(query_saved(&store, &root, Query::Inventory {}).await.unwrap());
            let evidence = &inventory["records"]["provider_evidence"][&attempt_id];
            let accounting = &evidence["accounting"];
            assert_eq!(accounting["input"]["state"], case.states.0, "input evidence row {index}");
            assert_eq!(accounting["output"]["state"], case.states.1, "output evidence row {index}");
            assert_eq!(accounting["raw_retention"], case.retention, "retention row {index}");
            assert_eq!(evidence["attempt"], attempt_id);
            let observation_id = evidence["observation"].as_str().expect("accounting must name an actual observation");
            assert_eq!(inventory["records"]["observations"][observation_id]["attempt"], attempt_id);
            if case.retention == "retained" {
                assert_eq!(accounting["raw_usage"], serde_json::from_str::<Value>(case.raw.as_deref().unwrap()).unwrap());
            } else {
                assert_eq!(accounting["raw_usage"], Value::Null);
            }
            assert!(!inventory.to_string().contains("must-not-persist"));
            assert_eq!(wire.requests.lock().unwrap().len(), 1);
        }).await;
    }
}
