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
    pub sleep: Arc<dyn Fn(Duration) -> transport::Pending<'static, ()> + Send + Sync>,
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
    status: u16,
    responses: Mutex<VecDeque<Vec<u8>>>,
    requests: Mutex<Vec<(String, Value)>>,
}
impl Wire {
    fn new(responses: Vec<Vec<u8>>) -> Arc<Self> {
        Self::with_status(200, responses)
    }
    fn with_status(status: u16, responses: Vec<Vec<u8>>) -> Arc<Self> {
        Arc::new(Self { status, responses: Mutex::new(responses.into()), requests: Mutex::new(vec![]) })
    }
    fn boundaries(self: &Arc<Self>) -> Arc<Boundaries> {
        Arc::new(Boundaries { credentials: Arc::new(Credentials), transport: self.clone(),
            sleep: Arc::new(|duration| Box::pin(async move { tokio::time::sleep(duration).await; Ok(()) })) })
    }
}
impl transport::Transport for Wire {
    fn send(&self, request: transport::Request, _: Duration) -> transport::Pending<'_, transport::Response> {
        Box::pin(async move {
            self.requests.lock().unwrap().push((request.url, request.body));
            let bytes = self.responses.lock().unwrap().pop_front().expect("unexpected HTTP spend");
            Ok(transport::Response {
                status: self.status,
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

async fn failed_attempt(factory: &SessionFactory, root: &Path, attempt: &str) -> Value {
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let saved = result(execute(factory, root, Command::Query(Query::Attempt { attempt: attempt.into() })).await.unwrap());
            if saved["state"] == "failed" { return saved; }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }).await.expect("provider did not durably fail")
}

#[tokio::test]
async fn phase10_error_status_retains_usage() {
    for (provider, usage) in [
        ("openai", Some(r#"{"input_tokens":23,"output_tokens":9}"#)),
        ("gemini", Some(r#"{"promptTokenCount":23,"candidatesTokenCount":4,"thoughtsTokenCount":5}"#)),
        ("deepseek", Some(r#"{"prompt_tokens":23,"completion_tokens":9}"#)),
        ("openai", None),
    ] {
        let (_tree, root, factory) = fixture(&[provider]);
        let mut body: Value = serde_json::from_slice(&response(provider, Some("served-error-model"), usage, r#"{"findings":[]}"#)).unwrap();
        body["error"] = json!({"message":format!("Authorization: Bearer must-not-persist {}", "x".repeat(5000))});
        let wire = Wire::with_status(503, vec![serde_json::to_vec(&body).unwrap()]);
        BOUNDARIES.scope(wire.boundaries(), async {
            let (_fire, attempt_id) = dispatch(&factory, &root, "http-error").await;
            let before = failed_attempt(&factory, &root, &attempt_id).await;
            let inventory = result(execute(&factory, &root, Command::Query(Query::Inventory {})).await.unwrap());
            drop(factory);
            let store = reopen(&root).await;
            let saved = result(query_saved(&store, &root, Query::Attempt { attempt: attempt_id.clone() }).await.unwrap());
            assert_eq!(saved, before);
            let recovered = result(query_saved(&store, &root, Query::Inventory {}).await.unwrap());
            assert_eq!(recovered, inventory);
            assert_eq!(saved["usage"]["input"], json!(usage.map(|_| 23)), "HTTP 503 input accounting for {provider}");
            assert_eq!(saved["usage"]["output"], json!(usage.map(|_| 9)));
            assert_eq!(saved["observed_model"], "served-error-model");
            assert_eq!(saved["state"], "failed");
            assert_eq!(saved["original"], Value::Null);
            let failure = saved["failure"].as_str().unwrap();
            assert!(failure.contains("HTTP 503"), "{failure}");
            assert!(failure.contains("<redacted>"));
            assert!(failure.len() <= 1024);
            assert!(!recovered.to_string().contains("must-not-persist"));
            let records = &recovered["records"];
            assert_eq!(persistence::terminal_count(records, &attempt_id), 1);
            assert_eq!(records["closures"][&attempt_id]["terminal"], "failed");
            assert!(records["originals"].as_object().is_none_or(|items| items.is_empty()));
            let evidence = &records["provider_evidence"][&attempt_id];
            assert_eq!(evidence["accounting"]["raw_usage"], usage.map(|raw| serde_json::from_str::<Value>(raw).unwrap()).unwrap_or(Value::Null));
            let observation = &records["observations"][evidence["observation"].as_str().unwrap()];
            assert_eq!(observation["usage"], saved["usage"]);
            assert_eq!(wire.requests.lock().unwrap().len(), 1);
        }).await;
    }
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

#[tokio::test]
async fn phase10_provider_records_observed_identity() {
    let findings = "{\"findings\":[{\"file\":\"subject.rs\",\"line\":1,\"severity\":\"medium\",\"claim\":\"The return value discards the configured answer.\",\"failure_scenario\":\"A caller requiring the configured answer always receives 42.\"}]}";
    for (provider, model, usage, expected_input, expected_output, provider_id) in [
        ("openai", Some("served-openai"), Some("{\"input_tokens\":11,\"output_tokens\":5,\"output_tokens_details\":{\"reasoning_tokens\":2}}"), Some(11), Some(5), "resp-fixture"),
        ("gemini", Some("served-gemini"), Some("{\"promptTokenCount\":13,\"candidatesTokenCount\":3,\"thoughtsTokenCount\":2}"), Some(13), Some(5), "gemini-fixture"),
        ("deepseek", Some("served-deepseek"), Some("{\"prompt_tokens\":17,\"completion_tokens\":7,\"completion_tokens_details\":{\"reasoning_tokens\":4}}"), Some(17), Some(7), "deepseek-fixture"),
        ("openai", None, None, None, None, "resp-fixture"),
        ("gemini", None, None, None, None, "gemini-fixture"),
        ("deepseek", None, None, None, None, "deepseek-fixture"),
    ] {
        let (_tree, root, factory) = fixture(&[provider]);
        let wire = Wire::new(vec![response(provider, model, usage, findings)]);
        BOUNDARIES.scope(wire.boundaries(), async {
            let (fire, attempt_id) = dispatch(&factory, &root, "identity").await;
            complete(&factory, &root, &fire).await;
            drop(factory);
            let store = reopen(&root).await;
            let attempt = result(query_saved(&store, &root, Query::Attempt { attempt: attempt_id.clone() }).await.unwrap());
            assert_eq!(attempt["observed_host"], provider);
            assert_eq!(attempt["observed_model"], json!(model), "served identity for {provider}");
            assert_eq!(attempt["usage"], json!({"input":expected_input,"output":expected_output,"cost":null,"currency":null}));
            assert_eq!(attempt["requested"]["model"], "requested-alias");
            assert_eq!(attempt["requested"]["effort"], "high");
            let original = result(query_saved(&store, &root, Query::Original { original: attempt["original"].as_str().unwrap().into() }).await.unwrap());
            assert_eq!(original["raw_bytes"], json!(findings.as_bytes()));
            let inventory = result(query_saved(&store, &root, Query::Inventory {}).await.unwrap());
            let evidence = &inventory["records"]["provider_evidence"][&attempt_id];
            assert_eq!(attempt["provider_evidence"], *evidence);
            assert_eq!(evidence["identity"]["provider"], provider);
            assert_eq!(evidence["identity"]["response_model"], json!(model));
            assert_eq!(evidence["identity"]["response_id"], provider_id);
            assert_eq!(evidence["identity"]["request_id"], "wire-request-1");
            assert_eq!(evidence["identity"]["native_invocation"], format!("native-invocation:{attempt_id}"));
            assert_eq!(evidence["identity"]["native_return"], format!("native-response:{attempt_id}"));
            let observation = &inventory["records"]["observations"][evidence["observation"].as_str().unwrap()];
            assert_eq!(observation["model"], json!(model));
            assert_eq!(observation["usage"], attempt["usage"]);
            assert_eq!(observation["host"], provider);
            assert_ne!(attempt["host_return"], provider_id);
            let requests = wire.requests.lock().unwrap();
            assert_eq!(requests.len(), 1);
            match provider {
                "gemini" => {
                    assert_eq!(requests[0].0, "https://generativelanguage.googleapis.com/v1beta/models/requested-alias:generateContent");
                    assert_eq!(requests[0].1["generationConfig"]["thinkingConfig"]["thinkingLevel"], "high");
                }
                _ => assert_eq!(requests[0].1["model"], "requested-alias"),
            }
        }).await;
    }
}

#[derive(Default)]
struct ManualTime {
    state: Mutex<(u64, Vec<std::task::Waker>)>,
}
impl ManualTime {
    fn advance(&self, millis: u64) {
        let wake = {
            let mut state = self.state.lock().unwrap();
            state.0 += millis;
            std::mem::take(&mut state.1)
        };
        for waker in wake { waker.wake(); }
    }
    fn sleep(self: &Arc<Self>, duration: Duration) -> transport::Pending<'static, ()> {
        let clock = self.clone();
        let deadline = self.state.lock().unwrap().0 + duration.as_millis() as u64;
        Box::pin(std::future::poll_fn(move |cx| {
            let mut state = clock.state.lock().unwrap();
            if state.0 >= deadline { std::task::Poll::Ready(Ok(())) }
            else {
                state.1.push(cx.waker().clone());
                std::task::Poll::Pending
            }
        }))
    }
}

struct FailureCredentials {
    row: &'static str,
    clock: Arc<ManualTime>,
}
impl credentials::Inputs for FailureCredentials {
    fn env(&self, name: &str) -> Option<String> {
        if !matches!(name, "OPENAI_API_KEY" | "GEMINI_API_KEY") { return None; }
        if self.row == "no-key" { return None; }
        // Preparation consumes 31 seconds before the HTTP deadline begins.
        if self.row == "outer-expiry/canceled-poll" { self.clock.advance(31_000); }
        Some("fixture-key".into())
    }
    fn read(&self, _: &Path) -> Option<String> { None }
}

#[derive(Default)]
struct ReadControl {
    reading: std::sync::atomic::AtomicUsize,
    dropped: std::sync::atomic::AtomicUsize,
    released: std::sync::atomic::AtomicBool,
    release: tokio::sync::Notify,
}
struct DelayedBody {
    control: Arc<ReadControl>,
    bytes: Option<Vec<u8>>,
}
impl Drop for DelayedBody {
    fn drop(&mut self) { self.control.dropped.fetch_add(1, std::sync::atomic::Ordering::SeqCst); }
}
impl transport::Body for DelayedBody {
    fn chunk(&mut self) -> transport::Pending<'_, Option<Vec<u8>>> {
        Box::pin(async move {
            self.control.reading.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            while !self.control.released.load(std::sync::atomic::Ordering::SeqCst) {
                self.control.release.notified().await;
            }
            Ok(self.bytes.take())
        })
    }
}
struct FailureWire {
    row: &'static str,
    requests: Mutex<Vec<(String, Duration)>>,
    control: Arc<ReadControl>,
}
impl transport::Transport for FailureWire {
    fn send(&self, request: transport::Request, timeout: Duration) -> transport::Pending<'_, transport::Response> {
        Box::pin(async move {
            self.requests.lock().unwrap().push((request.url.clone(), timeout));
            if self.row == "transport" { return Err("connection refused".into()); }
            let provider = if request.url.contains("openai.com") { "openai" } else { "gemini" };
            let bytes = match self.row {
                "malformed-response" => b"not-json".to_vec(),
                "missing-text" => b"{}".to_vec(),
                "oversized-response" => vec![b'x'; 4_194_305],
                _ => response(provider, None, None, r#"{"findings":[]}"#),
            };
            let body: Box<dyn transport::Body> = if matches!(self.row, "native-timeout" | "outer-expiry/canceled-poll") {
                Box::new(DelayedBody { control: self.control.clone(), bytes: Some(bytes) })
            } else { Box::new(Chunks(VecDeque::from([bytes]))) };
            Ok(transport::Response { status: if self.row == "http-error" { 503 } else { 200 },
                headers: BTreeMap::new(), body })
        })
    }
}

// The external host supplies only its actual launch/return (or launch failure).
// Selection, local dispatch construction, material reads and acceptance run real.
async fn local_host(factory: &SessionFactory, root: &Path, dispatch: &Value, outcome: &str) -> (Apply, Value) {
    assert_eq!(dispatch["dispatch"]["local"], true);
    assert!(dispatch["guidance"].as_str().unwrap().contains("WAIT"));
    let attempt: Attempt = serde_json::from_value(dispatch["attempt"].clone()).unwrap();
    let admission: Admission = serde_json::from_value(dispatch["admission"].clone()).unwrap();
    let identity = json!({"fire":admission.fire,"occurrence":admission.home.occurrence,
        "artifact":admission.artifact,"view":attempt.view.view,"attempt":attempt.attempt,"round":attempt.round});
    let event = |name: &str, kind: &str, launch: Option<&str>, returned: Option<&str>| json!({
        "observation":format!("local:{}:{name}", attempt.attempt), "attempt":attempt.attempt,
        "launch":launch,"host_return":returned,"kind":kind,"reference":format!("local-event:{name}"),
        "observed_at":100,"host":if launch.is_some() {Some("claude-subagent")} else {None},
        "model":if launch.is_some() {Some("served-local")} else {None},
        "usage":{"input":null,"output":null,"cost":null,"currency":null},"contract":attempt.contract});
    let launch = format!("local-launch:{}", attempt.attempt);
    let returned = format!("local-return:{}", attempt.attempt);
    let raw = match outcome {
        "success" => Some(r#"{"findings":[{"file":"subject.rs","line":1,"severity":"medium","claim":"The fixed answer discards configuration.","failure_scenario":"A caller requiring a configured answer receives 42."}]}"#.to_owned()),
        "malformed" => Some("not-json".into()),
        _ => None,
    };
    let apply = if outcome == "launch-failure" {
        Apply::Return { identity, launch: None, host_return: None, raw: None, citations: vec![],
            failure_event: Some(event("launch-failure", "launch-failure", None, None)),
            host_failure: Some("external host refused launch".into()) }
    } else {
        result(execute(factory, root, Command::Apply(Apply::Observation {
            observation: event("launch", "launch", Some(&launch), None),
        })).await.unwrap());
        for entry in &attempt.view.entries {
            result(execute(factory, root, Command::Query(Query::Material {
                attempt: attempt.attempt.clone(), entry: entry.clone(),
            })).await.unwrap());
        }
        if raw.is_some() {
            result(execute(factory, root, Command::Apply(Apply::Observation {
                observation: event("return", "return", Some(&launch), Some(&returned)),
            })).await.unwrap());
        }
        Apply::Return { identity, launch: Some(launch), host_return: raw.as_ref().map(|_| returned),
            raw, citations: vec![], failure_event: None, host_failure: None }
    };
    let receipt = result(execute(factory, root, Command::Apply(apply.clone())).await.unwrap());
    assert_eq!(receipt["terminal"], if outcome == "success" { "accepted" } else { "failed" }, "{receipt}");
    assert_eq!(receipt["durable_terminal_count"], 1);
    (apply, receipt)
}

#[tokio::test]
async fn phase10_fallback_closes_once() {
    use std::sync::atomic::Ordering::SeqCst;
    for (row, local) in [
        ("outer-expiry/canceled-poll", "success"),
        ("no-key", "success"), ("over-cap", "success"), ("transport", "success"),
        ("http-error", "success"), ("malformed-response", "success"),
        ("missing-text", "success"), ("oversized-response", "success"), ("native-timeout", "success"),
        ("transport", "launch-failure"), ("transport", "missing"), ("transport", "malformed"),
    ] {
        let (_tree, root, factory) = fixture(&["openai", "gemini"]);
        let mut config: Value = serde_json::from_slice(&fs::read(root.join("config.v4.json")).unwrap()).unwrap();
        if row == "over-cap" { config["review"]["max_prompt_tokens"] = json!(1); }
        config["review"]["request_timeout_ms"] = json!(if row == "native-timeout" { 100 } else { 600000 });
        fs::write(root.join("config.v4.json"), serde_json::to_vec(&config).unwrap()).unwrap();
        let clock = Arc::new(ManualTime::default());
        let control = Arc::new(ReadControl::default());
        let wire = Arc::new(FailureWire { row, requests: Mutex::new(vec![]), control: control.clone() });
        let sleeper = clock.clone();
        let boundaries = Arc::new(Boundaries {
            credentials: Arc::new(FailureCredentials { row, clock: clock.clone() }),
            transport: wire.clone(), sleep: Arc::new(move |duration| sleeper.sleep(duration)),
        });
        BOUNDARIES.scope(boundaries.clone(), async {
            let (fire, first) = dispatch(&factory, &root, row).await;
            // The admitted order remains authoritative even if config changes.
            config["review"]["reviewers"] = json!(["deepseek"]);
            fs::write(root.join("config.v4.json"), serde_json::to_vec(&config).unwrap()).unwrap();
            let timed = matches!(row, "native-timeout" | "outer-expiry/canceled-poll");
            let mut attempt_id = first;
            for ordinal in 1..=2 {
                if timed {
                    tokio::time::timeout(Duration::from_secs(2), async {
                        while control.reading.load(SeqCst) < ordinal { tokio::task::yield_now().await; }
                    }).await.expect("HTTP read never started");
                    // Poll once to Pending then drop the request. The provider
                    // operation must remain resident, independent of that poll.
                    {
                        let mut poll = Box::pin(execute(&factory, &root, Command::Query(Query::Next { fire: fire.clone() })));
                        std::future::poll_fn(|cx| {
                            assert!(std::future::Future::poll(poll.as_mut(), cx).is_pending());
                            std::task::Poll::Ready(())
                        }).await;
                    }
                    clock.advance(if row == "native-timeout" { 100 } else { 539_000 });
                }
                let failed = tokio::time::timeout(Duration::from_secs(2), failed_attempt(&factory, &root, &attempt_id))
                    .await.unwrap_or_else(|_| panic!("{row}: expired operation did not durably close after canceled poll within acknowledgment budget"));
                assert_eq!(failed["state"], "failed", "{row}");
                if timed {
                    assert_eq!(control.dropped.load(SeqCst), ordinal, "{row}: actual HTTP body must be canceled");
                    assert!(failed["failure"].as_str().unwrap().contains(if row == "native-timeout" { "request timed out after 100ms" } else { "provider work timed out after 570000ms" }));
                }
                if matches!(row, "no-key" | "over-cap") {
                    assert_eq!(failed["launch"], Value::Null);
                    assert_eq!(failed["observed_host"], Value::Null);
                    assert_eq!(failed["observed_model"], Value::Null);
                    assert_eq!(failed["usage"], json!({"input":null,"output":null,"cost":null,"currency":null}));
                }
                let next = result(execute(&factory, &root, Command::Query(Query::Next { fire: fire.clone() })).await.unwrap());
                if ordinal == 1 {
                    assert_eq!(next["state"], "pending");
                    assert_eq!(next["attempt"]["slot"], "gemini");
                    attempt_id = next["attempt"]["attempt"].as_str().unwrap().into();
                } else {
                    assert_eq!(next["state"], "dispatch", "{row}");
                    assert_eq!(next["attempt"]["slot"], "claude-subagent");
                    let (apply, _) = local_host(&factory, &root, &next, local).await;
                    let replay = result(execute(&factory, &root, Command::Apply(apply)).await.unwrap());
                    assert_eq!(replay["replayed"], true);
                    assert_eq!(replay["durable_terminal_count"], 1);
                }
            }
            control.released.store(true, SeqCst);
            control.release.notify_waiters();
            clock.advance(30_000);
            for _ in 0..2 {
                let terminal = result(execute(&factory, &root, Command::Query(Query::Next { fire: fire.clone() })).await.unwrap());
                assert_eq!(terminal["delivery"], if local == "success" { "usable-complete" } else { "complete-with-failure" });
            }
            let inventory = result(execute(&factory, &root, Command::Query(Query::Inventory {})).await.unwrap());
            let records = &inventory["records"];
            assert_eq!(records["issued"].as_object().unwrap().len(), 3);
            assert_eq!(records["closures"].as_object().unwrap().len(), 3);
            for id in records["issued"].as_object().unwrap().keys() {
                assert_eq!(persistence::terminal_count(records, id), 1, "{row} {id}");
            }
            let fallback = records["attempts"].as_object().unwrap().values().find(|a| a["slot"] == "claude-subagent").unwrap();
            if local == "success" {
                assert_eq!(fallback["observed_host"], "claude-subagent");
                assert_eq!(fallback["observed_model"], "served-local");
                let original = result(execute(&factory, &root, Command::Query(Query::Original {
                    original: fallback["original"].as_str().unwrap().into(),
                })).await.unwrap());
                assert_eq!(original["findings"], json!([{"file":"subject.rs","line":1,"severity":"medium",
                    "claim":"The fixed answer discards configuration.","failure_scenario":"A caller requiring a configured answer receives 42."}]));
                assert_eq!(records["originals"].as_object().unwrap().len(), 1);
            } else {
                assert_eq!(fallback["original"], Value::Null);
                assert!(records["originals"].as_object().is_none_or(|o| o.is_empty()));
            }
            assert_eq!(records["provider_settings"][&fire]["request_timeout_ms"], if row == "native-timeout" {100} else {540000});
            assert_eq!(records["provider_settings"][&fire]["provider_work_timeout_ms"], 570000);
            assert_eq!(records["provider_settings"][&fire]["acknowledgment_budget_ms"], 30000);
            assert_eq!(records["provider_settings"][&fire]["attempt_budget_ms"], 600000);
            let requests = wire.requests.lock().unwrap();
            assert_eq!(requests.len(), if matches!(row, "no-key" | "over-cap") {0} else {2});
            if !requests.is_empty() {
                assert!(requests[0].0.contains("api.openai.com"));
                assert!(requests[1].0.contains("generativelanguage.googleapis.com"));
            }
            drop(requests);
            drop(factory);
            let store = reopen(&root).await;
            let recovered = result(query_saved(&store, &root, Query::Inventory {}).await.unwrap());
            assert_eq!(recovered, inventory, "{row}: filesystem recovery");
            assert_eq!(result(query_saved(&store, &root, Query::Next { fire }).await.unwrap())["delivery"],
                if local == "success" { "usable-complete" } else { "complete-with-failure" });
        }).await;
    }
}
