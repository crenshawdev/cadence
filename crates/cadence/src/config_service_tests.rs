#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{Diagnostics, Effective, reload::Input};
    use serde_json::json;

    fn gap_persisted(root: &Path, repo_bytes: &[u8], global: Option<&Path>) {
        use sha2::{Digest, Sha256};
        std::fs::create_dir_all(root).unwrap();
        let active = root.join("config.v4.json");
        std::fs::write(&active, repo_bytes).unwrap();
        let empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let mut snapshot = json!({"version":1,"generation":1,"items_digest":empty,"decisions_digest":empty,
            "data":{"import":{"format":1,"complete":true,"source_generation":"fixture","sources":[],
                "active":{"global":global,"repo":active},"created":[],"warnings":[]}},
            "operations":{},"integrity":""});
        snapshot["integrity"] = json!(format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&snapshot).unwrap())
        ));
        std::fs::write(
            root.join("state.json"),
            serde_json::to_vec(&snapshot).unwrap(),
        )
        .unwrap();
        std::fs::write(root.join("items.jsonl"), b"").unwrap();
        std::fs::write(root.join("decisions.jsonl"), b"").unwrap();
    }

    #[tokio::test]
    async fn phase8_gap_guard_grouped_apply_stays_usable() {
        let tree = tempfile::tempdir().unwrap();
        let root = tree.path().join("project/.planning");
        gap_persisted(&root, b"{}", None);
        let factory = SessionFactory::new(None, std::sync::Arc::new(config::planning_policy));
        let input = Command::Apply(Apply::Batch {
            layer: Layer::Repo,
            updates: vec![Update {
                key: "roles.cad-executor.model".into(),
                value: json!("sonnet"),
            }],
        });
        let result = execute(&factory, &root, input).await.unwrap();
        let (status, changed_keys) = match result {
            Envelope::Ok(Output::Applied { changed_keys, .. }) => ("ok", changed_keys),
            other => panic!(
                "unexpected apply: {}",
                serde_json::to_string(&other).unwrap()
            ),
        };
        assert_eq!((status, changed_keys, std::fs::read(root.join("config.v4.json")).unwrap()),
            ("ok", vec!["roles.cad-executor.model".to_owned()], b"{\n  \"roles\": {\n    \"cad-executor\": {\n      \"model\": \"sonnet\"\n    }\n  }\n}".to_vec()));
    }

    fn gap_answers() -> Vec<Update> {
        serde_json::from_str(
            r#"[
            {"key":"roles.cad-planner.model","value":null},
            {"key":"roles.cad-planner.effort","value":"high"},
            {"key":"roles.cad-assumptions-analyzer.model","value":null},
            {"key":"roles.cad-assumptions-analyzer.effort","value":"high"},
            {"key":"roles.cad-verifier.model","value":null},
            {"key":"roles.cad-verifier.effort","value":"high"},
            {"key":"roles.cad-reviewer.model","value":null},
            {"key":"roles.cad-reviewer.effort","value":"medium"},
            {"key":"roles.cad-executor.model","value":"opus"},
            {"key":"roles.cad-executor.effort","value":"xhigh"},
            {"key":"roles.cad-plan-checker.model","value":null},
            {"key":"roles.cad-plan-checker.effort","value":"low"},
            {"key":"review.triggers.risk_surface.waive_routing_floor","value":[]}
        ]"#,
        )
        .unwrap()
    }

    #[derive(Clone)]
    struct GapAbsentIo;
    impl ConfigIo for GapAbsentIo {
        fn read(&mut self, path: &Path) -> Result<Input> {
            Ok(Input {
                identity: path.into(),
                bytes: None,
                stamp: None,
            })
        }
    }

    async fn gap_no_answer(
        accepted: bool,
        answers: Option<Vec<Update>>,
    ) -> (&'static str, Vec<String>, bool, bool) {
        let tree = tempfile::tempdir().unwrap();
        let root = tree.path().join("project/.planning");
        let global = tree.path().join("global/config.json");
        let mutations = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let observed = mutations.clone();
        let factory = SessionFactory::with_io(
            Some(global.clone()),
            GapAbsentIo,
            std::sync::Arc::new(config::planning_policy),
        )
        .with_probe(std::sync::Arc::new(move |stage, path| {
            observed
                .lock()
                .unwrap()
                .push(format!("{stage:?}:{}", path.display()));
            Ok(())
        }));
        let stale_capture = interview::Captured {
            repo: interview::Input {
                identity: "/stale/config.v4.json".into(),
                content: Some("stale".into()),
                stamp: Some((1, 2, 3)),
            },
            global: None,
            global_alias: false,
        };
        let input = Command::Apply(Apply::Interview {
            mode: interview::Mode::Suggestion,
            captured: stale_capture,
            accepted,
            answers,
        });
        let result = execute(&factory, &root, input).await.unwrap();
        let variant = match result {
            Envelope::Ok(Output::Unchanged { .. }) => "Unchanged",
            _ => "other",
        };
        let observations = mutations.lock().unwrap().clone();
        (
            variant,
            observations,
            root.exists(),
            global.parent().unwrap().exists(),
        )
    }

    #[tokio::test]
    async fn phase8_gap_unanswered_suggestion_has_zero_writes() {
        assert_eq!(
            gap_no_answer(true, None).await,
            ("Unchanged", vec![], false, false)
        );
    }

    #[tokio::test]
    async fn phase8_gap_declined_suggestion_has_zero_writes() {
        assert_eq!(
            gap_no_answer(false, Some(gap_answers())).await,
            ("Unchanged", vec![], false, false)
        );
    }

    fn gap_capture(path: &Path, bytes: &[u8]) -> interview::Input {
        use sha2::{Digest, Sha256};
        use std::os::unix::fs::MetadataExt;
        let metadata = std::fs::metadata(path).unwrap();
        interview::Input {
            identity: path.into(),
            content: Some(format!("{:x}", Sha256::digest(bytes))),
            stamp: Some((metadata.dev(), metadata.ino(), metadata.mode())),
        }
    }

    #[tokio::test]
    async fn phase8_gap_accepted_entries_store_identical_literal_bytes() {
        const ACCEPTED_REPO: &[u8] = b"{\n  \"roles\": {\n    \"cad-executor\": {\n      \"model\": \"opus\",\n      \"effort\": \"xhigh\"\n    }\n  },\n  \"review\": {\n    \"triggers\": {\n      \"risk_surface\": {\n        \"waive_routing_floor\": []\n      }\n    }\n  }\n}";
        for mode in [
            interview::Mode::NewProject,
            interview::Mode::Adopt,
            interview::Mode::Suggestion,
        ] {
            let tree = tempfile::tempdir().unwrap();
            let root = tree.path().join("project/.planning");
            let global = tree.path().join("global/config.v4.json");
            std::fs::create_dir_all(global.parent().unwrap()).unwrap();
            std::fs::write(&global, b"{\"roles\":{}}").unwrap();
            gap_persisted(&root, b"{}", Some(&global));
            let captured = interview::Captured {
                repo: gap_capture(&root.join("config.v4.json"), b"{}"),
                global: Some(gap_capture(&global, b"{\"roles\":{}}")),
                global_alias: false,
            };
            let factory = SessionFactory::new(
                Some(global.with_file_name("config.json")),
                std::sync::Arc::new(config::planning_policy),
            );
            let input = Command::Apply(Apply::Interview {
                mode,
                captured,
                accepted: true,
                answers: Some(gap_answers()),
            });
            let _result = execute(&factory, &root, input).await.unwrap();
            assert_eq!(
                (
                    std::fs::read(root.join("config.v4.json")).unwrap(),
                    std::fs::read(&global).unwrap()
                ),
                (ACCEPTED_REPO.to_vec(), b"{\"roles\":{}}".to_vec()),
                "{mode:?}"
            );
        }
    }

    const GAP_REOPEN_CASES: [&str; 8] = [
        "invalid-effort",
        "retired-key",
        "unknown-key",
        "wrong-repo-scope",
        "stale-destination-observation",
        "stale-admission-token",
        "transient-reload-denial",
        "wrong-global-scope",
    ];

    async fn gap_reopen(alias: bool) -> (String, String, bool, Vec<u8>, Vec<u8>) {
        let tree = tempfile::tempdir().unwrap();
        let root = tree.path().join("project/.planning");
        let global_legacy = tree.path().join("global/config.json");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(global_legacy.parent().unwrap()).unwrap();
        let repo = root.join("config.v4.json");
        let global = if alias {
            repo.clone()
        } else {
            global_legacy.with_file_name("config.v4.json")
        };
        if alias {
            std::fs::write(root.join("config.json"), b"{}").unwrap();
            std::os::unix::fs::symlink(root.join("config.json"), &global_legacy).unwrap();
        } else {
            std::fs::write(&global, b"{\"roles\":{}}").unwrap();
        }
        // Independently persisted state, never output from a refusal invocation.
        gap_persisted(
            &root,
            b"{\"roles\":{\"cad-executor\":{\"model\":\"opus\"}}}",
            Some(&global),
        );
        let fresh_factory = SessionFactory::new(
            Some(global_legacy),
            std::sync::Arc::new(config::planning_policy),
        );
        let result = execute(&fresh_factory, &root, Command::Facts)
            .await
            .unwrap();
        let facts = match result {
            Envelope::Ok(Output::Facts { facts }) => facts,
            other => panic!(
                "unexpected facts: {}",
                serde_json::to_string(&other).unwrap()
            ),
        };
        let model = facts
            .keys
            .iter()
            .find(|fact| fact.key == "roles.cad-executor.model")
            .unwrap();
        (
            model.stored_repo.as_ref().unwrap().as_str().unwrap().into(),
            model.source.clone(),
            facts.global_alias,
            std::fs::read(&repo).unwrap(),
            std::fs::read(&global).unwrap(),
        )
    }

    #[tokio::test]
    async fn phase8_gap_reopened_refusal_reads_literal_bytes() {
        for row in GAP_REOPEN_CASES {
            let (model, _, _, repo, global) = gap_reopen(false).await;
            assert_eq!(
                (model, repo, global),
                (
                    "opus".to_owned(),
                    b"{\"roles\":{\"cad-executor\":{\"model\":\"opus\"}}}".to_vec(),
                    b"{\"roles\":{}}".to_vec()
                ),
                "{row}"
            );
        }
    }

    #[tokio::test]
    async fn phase8_gap_reopened_alias_refusal_reads_literal_bytes() {
        for row in GAP_REOPEN_CASES {
            let (model, source, alias, physical, _) = gap_reopen(true).await;
            assert_eq!(
                (model, source, alias, physical),
                (
                    "opus".to_owned(),
                    "repo".to_owned(),
                    true,
                    b"{\"roles\":{\"cad-executor\":{\"model\":\"opus\"}}}".to_vec()
                ),
                "{row}"
            );
        }
    }

    #[test]
    fn facts_returns_literal_presence_and_default_source_from_supplied_generation() {
        let generation = Generation {
            number: 1,
            global: None,
            repo: Input {
                identity: "/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: Effective {
                raw_global: None,
                raw_repo: Some(json!({"roles":{"cad-executor":{"model":null}}})),
                global: json!({}),
                repo: json!({"roles":{"cad-executor":{"model":null}}}),
                values: json!({"roles":{"cad-executor":{"model":null,"effort":"high"}}}),
                sources: [("roles.cad-executor.model".into(), Layer::Repo)].into(),
                global_intent: false,
                diagnostics: Diagnostics::default(),
            },
        };
        let result = facts(&generation);
        let model = result
            .keys
            .iter()
            .find(|fact| fact.key == "roles.cad-executor.model")
            .unwrap();
        assert_eq!(
            (
                model.present_global,
                model.present_repo,
                model.stored_repo.clone(),
                model.effective.clone(),
                model.source.as_str()
            ),
            (false, true, Some(Value::Null), Value::Null, "repo")
        );
        let effort = result
            .keys
            .iter()
            .find(|fact| fact.key == "roles.cad-executor.effort")
            .unwrap();
        assert_eq!(
            (
                effort.present_global,
                effort.present_repo,
                effort.effective.clone(),
                effort.source.as_str()
            ),
            (false, false, json!("high"), "defaults")
        );
    }
}

#[cfg(test)]
mod routing_inputs_tests {
    use super::*;
    use crate::config::{Diagnostics, Effective, reload::Input};
    use serde_json::json;

    fn generation() -> Generation {
        Generation {
            number: 1,
            global: None,
            repo: Input {
                identity: "/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: Effective {
                raw_global: None,
                raw_repo: None,
                global: json!({}),
                repo: json!({}),
                values: json!({"model":{"escalate_on_failure":false},"roles":{"cad-executor":{"model":null,"effort":"high"}}}),
                sources: Default::default(),
                global_intent: false,
                diagnostics: Diagnostics::default(),
            },
        }
    }

    #[test]
    fn routing_inputs_captures_resolved_identities_and_exact_byte_digests() {
        let mut supplied = generation();
        supplied.repo.bytes = Some(b"{}".to_vec());
        supplied.repo.stamp = Some((11, 22, 33));
        supplied.global = Some(Input {
            identity: "/global/config.v4.json".into(),
            bytes: Some(Vec::new()),
            stamp: None,
        });
        supplied.effective.global_intent = true;
        assert_eq!(
            routing_inputs(&supplied),
            cadence::execution::model::ConfigInputs {
                repo: cadence::execution::model::ConfigInput {
                    identity: "/project/.planning/config.v4.json".into(),
                    content: Some(
                        "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a".into()
                    ),
                    stamp: Some((11, 22, 33)),
                },
                global: Some(cadence::execution::model::ConfigInput {
                    identity: "/global/config.v4.json".into(),
                    content: Some(
                        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".into()
                    ),
                    stamp: None,
                }),
                global_alias: true,
            }
        );
    }

    #[test]
    fn role_input_reads_six_schema_defaults_without_treating_effective_values_as_stored() {
        for (role, effort) in [
            ("cad-planner", "high"),
            ("cad-assumptions-analyzer", "high"),
            ("cad-verifier", "high"),
            ("cad-reviewer", "medium"),
            ("cad-executor", "high"),
            ("cad-plan-checker", "low"),
        ] {
            let request = RouteRequest {
                role: role.into(),
                phase: None,
                plan: None,
                attempt: None,
            };
            let input = role_input(&generation(), &request).unwrap();
            assert_eq!(input.default_effort, effort);
            assert_eq!(input.role_effort, None);
            assert_eq!(input.role_model, None);
            assert_eq!(input.legacy_effort, None);
            assert_eq!(input.legacy_model, None);
            assert_eq!(input.attempt, 1);
            assert!(!input.escalate_on_failure);
        }
    }

    #[test]
    fn role_input_uses_projected_layer_and_source_for_each_winning_leaf() {
        let mut generation = generation();
        generation.effective.global =
            json!({"roles":{"cad-executor":{"model":null,"effort":null}}});
        generation.effective.repo =
            json!({"model":{"overrides":{"cad-executor":"opus"},"effort":{"cad-executor":"max"}}});
        generation.effective.sources = [
            ("roles.cad-executor.model".into(), Layer::Global),
            ("roles.cad-executor.effort".into(), Layer::Global),
            ("model.overrides.cad-executor".into(), Layer::Repo),
            ("model.effort.cad-executor".into(), Layer::Repo),
        ]
        .into();
        let request = RouteRequest {
            role: "cad-executor".into(),
            phase: None,
            plan: None,
            attempt: None,
        };
        let input = role_input(&generation, &request).unwrap();
        assert_eq!(
            input.role_model,
            Some(roles::Stored {
                key: "roles.cad-executor.model".into(),
                layer: "global".into(),
                value: Value::Null
            })
        );
        assert_eq!(
            input.role_effort,
            Some(roles::Stored {
                key: "roles.cad-executor.effort".into(),
                layer: "global".into(),
                value: Value::Null
            })
        );
        assert_eq!(
            input.legacy_model,
            Some(roles::Stored {
                key: "model.overrides.cad-executor".into(),
                layer: "repo".into(),
                value: json!("opus")
            })
        );
        assert_eq!(
            input.legacy_effort,
            Some(roles::Stored {
                key: "model.effort.cad-executor".into(),
                layer: "repo".into(),
                value: json!("max")
            })
        );
    }
}

#[cfg(test)]
mod retirement_tests {
    use super::*;
    use crate::config::reload::Input;
    use serde_json::json;

    fn generation() -> Generation {
        Generation {
            number: 1,
            global: Some(Input {
                identity: "/today/global/config.v4.json".into(),
                bytes: None,
                stamp: None,
            }),
            repo: Input {
                identity: "/today/project/.planning/config.v4.json".into(),
                bytes: None,
                stamp: None,
            },
            effective: merge::merge(None, None, false),
        }
    }

    fn source(path: &str, bytes: &[u8]) -> Value {
        json!({"source":{"path":path,"bytes":bytes},
            "generation":cadence::store::model::digest(bytes),"label":"non_effective_original_source"})
    }

    fn snapshot(bytes: &[u8]) -> Value {
        json!({"import":{"sources":[
            {"path":"/old/project/config.json","identity":"/old/project/config.json","content":null},
            {"path":"/old/global/config.json","identity":"/old/global/config.json","content":null}
        ]},"source_evidence":[source("/old/global/config.json", bytes)]})
    }

    macro_rules! exact_value {
        ($name:ident, $bytes:literal, $expected:expr) => {
            #[test]
            fn $name() {
                assert_eq!(
                    retirement(&generation(), Some(&snapshot($bytes))).originals,
                    vec![RetiredValue {
                        value: $expected,
                        layer: Layer::Global,
                        path: "/old/global/config.json".into(),
                        global_alias: None,
                        origin: "preserved".into()
                    }]
                );
            }
        };
    }
    exact_value!(
        retired_string_is_exact,
        br#"{"stakes":"high"}"#,
        json!("high")
    );
    exact_value!(
        unknown_retired_string_is_exact,
        br#"{"stakes":"unrecognized"}"#,
        json!("unrecognized")
    );
    exact_value!(
        retired_object_is_exact,
        br#"{"stakes":{"unknown":[1,null]}}"#,
        json!({"unknown":[1,null]})
    );
    exact_value!(retired_number_is_exact, br#"{"stakes":12.5}"#, json!(12.5));
    exact_value!(retired_null_is_present, br#"{"stakes":null}"#, Value::Null);
    exact_value!(
        retired_array_is_exact,
        br#"{"stakes":[1,"x",null]}"#,
        json!([1, "x", null])
    );
    exact_value!(
        retired_boolean_is_exact,
        br#"{"stakes":false}"#,
        json!(false)
    );

    #[test]
    fn distinct_originals_keep_their_historical_layer_and_path() {
        let mut snapshot = snapshot(br#"{"stakes":"global-original"}"#);
        snapshot["source_evidence"]
            .as_array_mut()
            .unwrap()
            .push(source(
                "/old/project/config.json",
                br#"{"stakes":{"repo":true}}"#,
            ));
        assert_eq!(retirement(&generation(), Some(&snapshot)), Retirement {
            message: "The stakes level is retired. Ordinary role questions use current settings; no equivalent spending profile is inferred.".into(),
            originals: vec![
                RetiredValue { value: json!("global-original"), layer: Layer::Global, path: "/old/global/config.json".into(), global_alias: None, origin: "preserved".into() },
                RetiredValue { value: json!({"repo":true}), layer: Layer::Repo, path: "/old/project/config.json".into(), global_alias: None, origin: "preserved".into() },
            ], evidence: "available".into(),
        });
    }

    #[test]
    fn collapsed_original_is_shown_once_with_its_preserved_global_alias() {
        let snapshot = json!({"import":{"sources":[
            {"path":"/old/project/config.json","identity":"/old/project/config.json","content":null},
            {"path":"/old/global-link.json","identity":"/old/project/config.json","content":null}
        ]},"source_evidence":[source("/old/project/config.json", br#"{"stakes":null}"#)]});
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).originals,
            vec![RetiredValue {
                value: Value::Null,
                layer: Layer::Repo,
                path: "/old/project/config.json".into(),
                global_alias: Some("/old/global-link.json".into()),
                origin: "preserved".into(),
            }]
        );
    }

    #[test]
    fn wrapped_original_evidence_is_read_without_normalizing_the_snapshot() {
        let snapshot =
            json!({"import":{"sources":[]},"current":snapshot(br#"{"stakes":{"wrapped":true}}"#)});
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).originals,
            vec![RetiredValue {
                value: json!({"wrapped":true}),
                layer: Layer::Global,
                path: "/old/global/config.json".into(),
                global_alias: None,
                origin: "preserved".into(),
            }]
        );
    }

    #[test]
    fn missing_historical_evidence_is_unavailable_without_reconstructing_originals() {
        assert_eq!(retirement(&generation(), Some(&json!({"import":{"complete":true}}))), Retirement {
            message: "The stakes level is retired. Ordinary role questions use current settings; no equivalent spending profile is inferred.".into(),
            originals: vec![], evidence: "unavailable".into(),
        });
    }

    #[test]
    fn active_raw_stakes_is_disclosed_without_becoming_preserved_evidence() {
        let mut generation = generation();
        generation.effective.raw_repo = Some(json!({"stakes":{"active":[1,null]}}));
        assert_eq!(
            retirement(&generation, None).originals,
            vec![RetiredValue {
                value: json!({"active":[1,null]}),
                layer: Layer::Repo,
                path: "/today/project/.planning/config.v4.json".into(),
                global_alias: None,
                origin: "active".into(),
            }]
        );
    }

    #[test]
    fn damaged_source_evidence_is_unavailable() {
        let mut snapshot = snapshot(br#"{"stakes":"original"}"#);
        snapshot["source_evidence"][0]["generation"] = json!("wrong-digest");
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).evidence,
            "unavailable"
        );
    }
    #[test]
    fn original_with_lost_layer_identity_is_unavailable() {
        let snapshot =
            json!({"source_evidence":[source("/old/config.json", br#"{"stakes":"original"}"#)]});
        assert_eq!(
            retirement(&generation(), Some(&snapshot)).evidence,
            "unavailable"
        );
    }
}
