//! Phase 11 checks exercise the real binary, journal and filesystem.
use cadence::store::model::{self, Snapshot};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};

struct Client {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
}

impl Client {
    fn open(project: &Path) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_cadence"))
            .args(["serve", "--project-root", project.to_str().unwrap()])
            .env("CADENCE_GLOBAL_CONFIG", "")
            .current_dir(project)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn().unwrap();
        let mut client = Self {
            stdin: child.stdin.take().unwrap(),
            stdout: BufReader::new(child.stdout.take().unwrap()),
            child,
        };
        client.send(json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"phase11-check","version":"1"}}}));
        assert!(client.recv()["result"]["serverInfo"].is_object());
        client.send(json!({"jsonrpc":"2.0","method":"notifications/initialized"}));
        client
    }

    fn send(&mut self, value: Value) {
        writeln!(self.stdin, "{value}").unwrap();
        self.stdin.flush().unwrap();
    }

    fn recv(&mut self) -> Value {
        let mut line = String::new();
        assert!(self.stdout.read_line(&mut line).unwrap() > 0);
        serde_json::from_str(&line).unwrap()
    }

    fn call(&mut self, tool: &str, arguments: Value) -> Value {
        self.send(json!({"jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":tool,"arguments":arguments}}));
        let response = self.recv();
        assert!(response.get("error").is_none(), "{response}");
        assert_ne!(response["result"]["isError"], true, "{response}");
        let result = response["result"]["structuredContent"].clone();
        let text: String = response["result"]["content"].as_array().unwrap().iter()
            .filter(|block| block["type"] == "text")
            .map(|block| block["text"].as_str().unwrap()).collect();
        assert_eq!(result, serde_json::from_str::<Value>(&text).unwrap());
        result
    }

    fn finish(mut self) {
        drop(self.stdin);
        assert!(self.child.wait().unwrap().success());
    }
}

fn submission() -> Value {
    json!({"operation":"context-submit","submission":{
        "phase":11,"title":"First approved context","scope":"Only the approved phase.",
        "durable_decisions":[{"id":"D-01","text":"Keep **authored** café prose (`docs/design.md:7`)."}],
        "decisions":[{"id":"D-02","text":"Use the owner's chosen order."}],
        "assumptions":["The reader understands 日本語."],
        "truths":[{"id":"T1","trigger":"the owner opens the context",
            "observer":"the owner","verb":"sees","outcome":"the approved decisions",
            "kind":"literal","observable":true,"fixed_oracle":true}]
    }})
}

fn fixture(native: bool, phase: bool, pending: bool) -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join(".planning");
    fs::create_dir(&root).unwrap();
    fs::write(root.join("ROADMAP.md"), "# Roadmap\n\n### Phase 11: First approved context\n\nGoal: approved context.\n\n### Phase 12: Next context\n\nGoal: next context.\n").unwrap();
    if phase {
        fs::create_dir_all(root.join("phases/11")).unwrap();
        fs::write(root.join("phases/11/CONTEXT.md"), "# Prior context\n\nOwner prose: déjà vu.\n").unwrap();
    }
    if native {
        let items = b"";
        let decisions = b"";
        let snapshot = Snapshot::new(1, items, decisions, json!({"unrelated":{"keep":"unchanged"}})).unwrap();
        fs::write(root.join(model::ITEMS), items).unwrap();
        fs::write(root.join(model::DECISIONS), decisions).unwrap();
        fs::write(root.join(model::STATE), snapshot.render().unwrap()).unwrap();
        if pending {
            // A retained journal is an input file. Draft authoring must not even
            // inspect/recover it; preserve its exact bytes, including whitespace.
            fs::write(root.join(".store-intent.json"), b"{\"retained\":\"pending owner work\"}\n").unwrap();
        }
    }
    temp
}

fn tree(project: &Path) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
    fn visit(base: &Path, path: &Path, found: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
        if !path.exists() { return; }
        let relative = path.strip_prefix(base).unwrap().to_path_buf();
        if path.is_dir() {
            found.insert(relative, None);
            for entry in fs::read_dir(path).unwrap() {
                visit(base, &entry.unwrap().path(), found);
            }
        } else {
            found.insert(relative, Some(fs::read(path).unwrap()));
        }
    }
    let mut found = BTreeMap::new();
    visit(project, &project.join(".planning"), &mut found);
    let root = project.join(".planning");
    if root.join(model::STATE).exists() {
        let items = fs::read(root.join(model::ITEMS)).unwrap();
        let decisions = fs::read(root.join(model::DECISIONS)).unwrap();
        Snapshot::parse(&fs::read(root.join(model::STATE)).unwrap(), &items, &decisions).unwrap();
        model::validate_items(&model::parse_lines(&items).unwrap()).unwrap();
        model::validate_decisions(&model::parse_lines(&decisions).unwrap()).unwrap();
    }
    found
}

#[test]
fn phase11_unapproved_context_changes_nothing() {
    for (native, phase, pending) in [(true,true,false),(true,false,false),(false,true,false),(false,false,false),(true,true,true)] {
        for intake_only in [true, false] {
            let temp = fixture(native, phase, pending);
            let before = tree(temp.path());
            let mut client = Client::open(temp.path());
            let intake = client.call("cadence_query", json!({"operation":"context-intake","phase":11}));
            assert_eq!(intake["status"], "ok", "context intake must be supported: {intake}");
            assert_eq!(intake["operation"], "context-intake");
            assert!(intake["contract"].is_object(), "{intake}");
            assert_eq!(intake["context"], if phase { json!("# Prior context\n\nOwner prose: déjà vu.\n") } else { Value::Null });
            assert_eq!(tree(temp.path()), before);
            if !intake_only {
                for approval in [Value::Null, json!({"approved":false}), json!({"approved":true,"owner":""})] {
                    let mut draft = submission();
                    if !approval.is_null() { draft["approval"] = approval.clone(); }
                    let answer = client.call("cadence_apply", draft);
                    if approval["approved"] == true {
                        assert_eq!(answer["status"], "refused", "{answer}");
                        assert_eq!(answer["slot"], "approval", "{answer}");
                    } else {
                        assert_eq!(answer["status"], "ok", "valid draft must reach context authoring: {answer}");
                        assert_eq!(answer["operation"], "context-submit");
                        assert_eq!(answer["persisted"], false);
                    }
                    assert_eq!(tree(temp.path()), before);
                }
            }
            client.finish();
            assert_eq!(tree(temp.path()), before, "read-only reopen after server exit");
        }
    }
}

fn approve(mut request: Value) -> Value {
    request["approval"] = json!({"approved":true,"owner":"John Crenshaw",
        "at":"2026-09-10T14:00:00Z","submission":request["submission"].clone()});
    request
}

fn initialized_fixture(phase_directory: bool) -> tempfile::TempDir {
    let temp = fixture(false, false, false);
    let root = temp.path().join(".planning");
    if phase_directory { fs::create_dir_all(root.join("phases/11")).unwrap(); }
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let factory = cadence::import::SessionFactory::new(None, std::sync::Arc::new(cadence::config::planning_policy));
        let session = factory.first_touch(&root).await.unwrap();
        let store = session.review_store();
        let view = store.request(cadence::store::writer::Operation::ReadVerified).await.unwrap();
        let mut data = view.snapshot.data;
        data["unrelated"] = json!({"keep":"unchanged"});
        store.request(cadence::store::writer::Operation::Transact(cadence::store::transaction::Transaction {
            id: "fixture-priors".into(),
            items: vec![model::ItemRecord {
                version:1,id:"prior-item".into(),revision:1,
                origin:model::Origin {source:"owner".into(),original:model::Evidence::Missing},
                text:"Retain the prior item".into(),kind:"todo".into(),
                disposition:model::Disposition::Captured,completed:false,filing_uncertain:false,
            }],
            decisions: vec![model::DecisionRecord {
                version:1,id:"prior-decision".into(),revision:1,
                origin:model::Origin {source:"owner".into(),original:model::Evidence::Missing},
                decision:model::Decision::Gate {outcome:"proceed".into(),evidence:model::Evidence::Text("Prior approval".into())},
            }],
            snapshot:Some(data),external:vec![],
        })).await.unwrap();
    });
    temp
}

#[test]
fn phase11_approved_context_persists_truths_and_decisions() {
    let examples = [
        ("the owner opens the context", "sees", "the approved decisions", "literal", "When the owner opens the context, the owner sees the approved decisions."),
        ("the owner requests a receipt", "gets", "receipt 42", "property", "When the owner requests a receipt, the owner gets receipt 42."),
        ("the owner changes an approved set", "is refused", "a revision", "literal", "When the owner changes an approved set, the owner is refused a revision."),
        ("the owner reads café notes", "sees", "日本語 prose", "property", "When the owner reads café notes, the owner sees 日本語 prose."),
        ("the owner requests a list", "gets", "three entries", "literal", "When the owner requests a list, the owner gets three entries."),
        ("the owner submits an empty name", "is refused", "approval", "property", "When the owner submits an empty name, the owner is refused approval."),
        ("the owner opens the final page", "sees", "the last decision", "literal", "When the owner opens the final page, the owner sees the last decision."),
    ];
    for phase_directory in [false, true] {
        for count in 1..=7 {
            let temp = initialized_fixture(phase_directory);
            let root = temp.path().join(".planning");
            let before = tree(temp.path());
            let mut request = submission();
            request["submission"]["truths"] = Value::Array(examples[..count].iter().enumerate().map(|(i,(trigger,verb,outcome,kind,_))| {
                json!({"id":format!("T{}",i+1),"trigger":trigger,"observer":"the owner","verb":verb,
                    "outcome":outcome,"kind":kind,"observable":true,"fixed_oracle":true})
            }).collect());
            let request = approve(request);
            let mut client = Client::open(temp.path());
            let answer = client.call("cadence_apply", request.clone());
            assert_eq!(answer["status"], "ok", "approved context must publish: {answer}");
            assert_eq!(answer["persisted"], true, "{answer}");
            client.finish();
            let after = tree(temp.path());
            let markdown = fs::read_to_string(root.join("phases/11/CONTEXT.md")).unwrap();
            assert!(markdown.starts_with("# Phase 11: First approved context\n"));
            assert!(markdown.contains("## Scope boundary\n\nOnly the approved phase.\n"));
            assert!(markdown.contains("## Durable decisions\n\n- D-01. Keep **authored** café prose (`docs/design.md:7`).\n"));
            assert!(markdown.contains("## Decisions\n\n- D-02. Use the owner's chosen order.\n"));
            assert!(markdown.contains("## Flagged assumptions\n\n- The reader understands 日本語.\n"));
            let truth_section = markdown.split("## Truths\n\n").nth(1).unwrap().split("\n## ").next().unwrap().trim_end();
            let expected_lines = examples[..count].iter().enumerate().map(|(i, example)| format!("- T{}. {}", i+1, example.4)).collect::<Vec<_>>().join("\n");
            assert_eq!(truth_section, expected_lines);
            let reopened = tokio::runtime::Runtime::new().unwrap().block_on(async {
                let store = cadence::store::writer::Store::open(
                    cadence::store::filesystem::Filesystem::new(&root).unwrap(),
                    cadence::store::writer::PlanningPolicy,
                ).await.unwrap();
                store.request(cadence::store::writer::Operation::ReadVerified).await.unwrap()
            });
            assert_eq!(reopened.snapshot.data["unrelated"], json!({"keep":"unchanged"}));
            let saved = &reopened.snapshot.data["context"]["phases"]["11"];
            assert_eq!(saved["submission"], request["submission"]);
            assert_eq!(saved["approval"], request["approval"]);
            assert_eq!(saved["truths"].as_array().unwrap().len(), count);
            for (i, example) in examples[..count].iter().enumerate() {
                assert_eq!(saved["truths"][i], json!({"id":format!("T{}",i+1),"phase":11,"version":1,
                    "pattern":"when","text":example.4,"kind":example.3,"status":"pending"}));
            }
            let prior_snapshot = Snapshot::parse(
                before[Path::new(".planning/state.json")].as_ref().unwrap(),
                before[Path::new(".planning/items.jsonl")].as_ref().unwrap(),
                before[Path::new(".planning/decisions.jsonl")].as_ref().unwrap(),
            ).unwrap();
            for (key, value) in prior_snapshot.data.as_object().unwrap() {
                assert_eq!(&reopened.snapshot.data[key], value, "unrelated snapshot field {key}");
            }
            for name in [".planning/items.jsonl", ".planning/decisions.jsonl"] {
                assert_eq!(after[Path::new(name)], before[Path::new(name)]);
            }
            let mut expected_tree = before.clone();
            expected_tree.insert(PathBuf::from(".planning/phases"), None);
            expected_tree.insert(PathBuf::from(".planning/phases/11"), None);
            expected_tree.insert(PathBuf::from(".planning/phases/11/CONTEXT.md"), Some(markdown.into_bytes()));
            expected_tree.insert(PathBuf::from(".planning/state.json"), after[Path::new(".planning/state.json")].clone());
            assert_eq!(after, expected_tree, "no pending intent or temporary files after acknowledgment");
        }
    }
}

fn expect_refusal(answer: &Value, rule: &str, slot: &str, entry: usize, id: &str) {
    assert_eq!(answer["status"], "refused", "{answer}");
    assert_eq!(answer["code"], "invalid-context", "{answer}");
    assert_eq!(answer["rule"], rule, "{answer}");
    assert_eq!(answer["slot"], slot, "{answer}");
    assert_eq!(answer["phase"], 11, "{answer}");
    assert_eq!(answer["entry"], entry, "{answer}");
    assert_eq!(answer["id"], id, "{answer}");
    assert!(!answer["reason"].as_str().unwrap().is_empty());
}

#[test]
fn phase11_sentence_fault_names_rule_and_slot() {
    let mut faults = vec![
        ("trigger", Some(json!("the owner opens or closes the context")), "one-trigger"),
        ("observer", Some(json!("the owner and the caller")), "one-observer"),
        ("observer", Some(json!("the owner & the caller")), "one-observer"),
        ("observer", Some(json!("the owner, the caller")), "one-observer"),
        ("observer", Some(json!("the owner; the caller")), "one-observer"),
        ("verb", Some(json!("receives")), "allowed-verb"),
        ("kind", Some(json!("example")), "allowed-kind"),
    ];
    for slot in ["trigger", "observer", "verb", "outcome", "kind"] {
        for missing in [None, Some(json!("")), Some(json!(" \t\n")), Some(Value::Null), Some(json!(42))] {
            faults.push((slot, missing, "required-slot"));
        }
    }
    for (slot, value, rule) in faults {
        for approved in [false, true] {
            let temp = initialized_fixture(true);
            let before = tree(temp.path());
            let mut request = submission();
            if let Some(value) = value.clone() { request["submission"]["truths"][0][slot] = value; }
            else { request["submission"]["truths"][0].as_object_mut().unwrap().remove(slot); }
            if approved { request = approve(request); }
            let mut client = Client::open(temp.path());
            let answer = client.call("cadence_apply", request);
            expect_refusal(&answer, rule, slot, 0, "T1");
            client.finish();
            assert_eq!(tree(temp.path()), before);
        }
    }
}

#[test]
fn phase11_unobservable_attestation_is_refused() {
    for position in [0, 1, 2] {
        for attestation in [None, Some(false)] {
            for approved in [false, true] {
                let temp = initialized_fixture(true);
                let before = tree(temp.path());
                let mut request = submission();
                let mut truths = Vec::new();
                for i in 0..3 {
                    let mut truth = request["submission"]["truths"][0].clone();
                    truth["id"] = json!(format!("T{}", i+1));
                    truths.push(truth);
                }
                truths[position]["outcome"] = json!("ContextState.approved equals true inside the writer struct");
                if let Some(value) = attestation { truths[position]["observable"] = json!(value); }
                else { truths[position].as_object_mut().unwrap().remove("observable"); }
                request["submission"]["truths"] = json!(truths);
                let mut client = Client::open(temp.path());
                let answer = client.call("cadence_apply", if approved { approve(request.clone()) } else { request.clone() });
                expect_refusal(&answer, "unobservable", "observable", position, &format!("T{}",position+1));
                request["submission"]["truths"][position]["observable"] = json!(true);
                let control = client.call("cadence_apply", request);
                assert_eq!(control["status"], "ok", "owner attestation controls this decision: {control}");
                assert_eq!(control["persisted"], false);
                client.finish();
                assert_eq!(tree(temp.path()), before);
            }
        }
    }
}

#[test]
fn phase11_prose_oracle_attestation_is_refused() {
    for position in [0, 1, 2] {
        for attestation in [None, Some(false)] {
            for approved in [false, true] {
                let temp = initialized_fixture(true);
                let before = tree(temp.path());
                let mut request = submission();
                let mut truths = Vec::new();
                for i in 0..3 {
                    let mut truth = request["submission"]["truths"][0].clone();
                    truth["id"] = json!(format!("T{}", i+1));
                    truths.push(truth);
                }
                truths[position]["outcome"] = json!("the expected answer supplied by a fresh model prose call");
                if let Some(value) = attestation { truths[position]["fixed_oracle"] = json!(value); }
                else { truths[position].as_object_mut().unwrap().remove("fixed_oracle"); }
                request["submission"]["truths"] = json!(truths);
                let mut client = Client::open(temp.path());
                let answer = client.call("cadence_apply", if approved { approve(request.clone()) } else { request.clone() });
                expect_refusal(&answer, "prose-oracle", "fixed_oracle", position, &format!("T{}",position+1));
                request["submission"]["truths"][position]["fixed_oracle"] = json!(true);
                let control = client.call("cadence_apply", request);
                assert_eq!(control["status"], "ok", "owner attestation controls the oracle: {control}");
                assert_eq!(control["persisted"], false);
                client.finish();
                assert_eq!(tree(temp.path()), before);
            }
        }
    }
}
