use super::*;

#[test]
fn home_request_uses_saved_task_identity() {
    let input: Value =
        serde_json::from_str(include_str!("../tests/fixtures/phase9/h1-admission.json")).unwrap();
    let home: Home = serde_json::from_value(input["H"]["home"].clone()).unwrap();
    assert_eq!(
        home_path(
            &HomeInput {
                kind: home.kind,
                id: home.id
            },
            input["H"]["fire"].as_str().unwrap()
        )
        .unwrap(),
        "tasks/h1"
    );
}

/// An execute review of a committed range, the handoff that may supply its
/// own resolution.
fn execute_diff() -> AdmissionRequest {
    decode_admission(json!({
        "replay_key":"k1","caller":"execute","trigger":"diff","specialist":null,
        "project":"p1","cycle":"c1","home":{"kind":"phase","id":"9"},
        "discriminator":"d1","phase":9,"plan":null,"anchor":null,"round":1,
        "target":{"kind":"committed-range","base":"b1","head":"h1"},
        "decision":null,"risk_observation":null
    }))
    .unwrap()
}

/// A config generation whose diff trigger gates `advisory`, and the reviewer
/// route resolved from it.
fn advisory_route() -> (Generation, super::super::config_service::Route) {
    let generation = Generation {
        number: 17,
        global: None,
        repo: crate::config::reload::Input {
            identity: "/project/.planning/config.v4.json".into(),
            bytes: None,
            stamp: None,
        },
        effective: merge::merge(
            None,
            Some(json!({"review":{"triggers":{"diff":{"gate":"advisory"}}}})),
            false,
        ),
    };
    let route = super::super::config_service::resolve_route(
        &generation,
        &super::super::config_service::RouteRequest {
            role: "cad-reviewer".into(),
            phase: None,
            plan: None,
            attempt: None,
        },
    )
    .unwrap();
    (generation, route)
}

fn phase_home() -> Home {
    Home {
        kind: HomeKind::Phase,
        id: "9".into(),
        occurrence: String::new(),
    }
}

#[test]
fn a_recorded_replay_key_answers_its_saved_fire_and_attempt_as_replayed() {
    let records = json!({"replays":{"k1":{"fire":"f1","attempt":"f1-a1","attempts":["f1-a1"],"occurrence":"occ1","admitted_at":5}}});
    assert_eq!(
        replayed(&records, "k1"),
        Some(json!({"fire":"f1","attempt":"f1-a1","replayed":true}))
    );
    assert_eq!(replayed(&records, "k2"), None);
}

#[test]
fn a_supplied_resolution_is_used_as_given() {
    let (generation, route) = advisory_route();
    let supplied = supplied(
        &execute_diff(),
        AdmissionResolution::Supplied {
            generation: Box::new(generation),
            route: Box::new(route),
            gate: Gate::Deferred,
        },
    )
    .unwrap();
    let (generation, route) = advisory_route();
    assert_eq!(supplied, Some((generation, route, Gate::Deferred)));
}

#[test]
fn a_supplied_gate_is_recorded_over_the_triggers_own_gate() {
    let (_, route) = advisory_route();
    let recorded =
        ordinary(&execute_diff(), Some(&route), Some(Gate::Deferred), "f1", &phase_home()).unwrap();
    assert_eq!(recorded.gate, Some(Gate::Deferred));
}

#[test]
fn the_route_answer_is_recorded_with_its_evidence_under_the_fire() {
    let (_, route) = advisory_route();
    let recorded =
        ordinary(&execute_diff(), Some(&route), Some(Gate::Deferred), "f1", &phase_home()).unwrap();
    assert_eq!(
        recorded.saved_routing,
        Some(Routing {
            answer: route.choice.agent.clone(),
            evidence: "route:f1".into(),
        })
    );
}

#[test]
fn a_new_attempt_keeps_its_requested_model_and_has_no_observed_model() {
    let manifest = Manifest {
        manifest: "m1".into(),
        fire: "f1".into(),
        contract: Contract::current(),
        target: Target::NamedFile {
            path: "a.rs".into(),
            head: None,
        },
        entries: vec![],
    };
    let requested = RequestedVoice {
        agent: "cad-reviewer".into(),
        model: Some("opus".into()),
        effort: None,
        routing: None,
        selection_evidence: "route:f1".into(),
    };
    let attempt = intended_attempt("f1", 0, "A", 1, "m1", &manifest, requested);
    assert_eq!(attempt.requested.model.as_deref(), Some("opus"));
    assert_eq!(attempt.observed_model, None);
}

#[test]
fn provider_settings_record_the_capped_request_timeout_and_the_fixed_budgets() {
    for (configured, request) in [(json!({}), 540_000), (json!({"review":{"request_timeout_ms":1_000}}), 1_000),
        (json!({"review":{"request_timeout_ms":999_999}}), 540_000)]
    {
        let settings = provider_settings(&configured).unwrap();
        assert_eq!(
            [&settings["request_timeout_ms"], &settings["provider_work_timeout_ms"], &settings["acknowledgment_budget_ms"], &settings["attempt_budget_ms"]],
            [&json!(request), &json!(570_000), &json!(30_000), &json!(600_000)],
            "{configured}"
        );
    }
}
