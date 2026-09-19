PLAN CHECKPOINT: structural
Plan: .planning/phases/9/PLAN-6.md
Tasks: 0 of 4

| Task | Commit | Signature | Status |
|---|---|---|---|
| P9-6-T1 | none | not applicable | Blocked during prerequisite inspection; no implementation edits. |
| P9-6-T2 | none | not applicable | Pending; depends on the same saved-model mismatch. |
| P9-6-T3 | none | not applicable | Pending. |
| P9-6-T4 | none | not applicable | Pending. |

## Checkpoint

Current task: P9-6-T1 — Register native review operations and unchanged forwarding.

Need: authorize an earlier-plan model repair and its isolated fixture/test lease,
or specify an approved saved representation of session-model inheritance.

T1 must save phase-8 routing values in the admitted attempts. T2 explicitly
requires local dispatch built from those saved values, inheriting the session
model when the admitted model is absent. The prerequisite representation cannot
express that absence:

- `crates/cadence/src/config/roles.rs:156` selects an optional model; absent,
  reset and unsupported choices produce `None`. Line 177 explicitly describes
  this as `omit model; inherit session`.
- `crates/cadence/src/config_service.rs:859` exposes that role resolution in
  the current route response. `resolve_route` uses the phase-8 resolver.
- `crates/cadence/src/review/model.rs:256` defines `RequestedVoice`, with
  `pub model: String` at line 258. There is no nullable model or documented
  inheritance sentinel in the saved review vocabulary. `Attempt.requested`
  uses this type at line 279.
- `crates/cadence/src/review/admission.rs::contribute_admission` persists the
  supplied typed attempts. T1 cannot preserve an absent requested model in
  this field by merely wiring the existing units.
- Existing fixtures use string pins, such as `model-A` in
  `tests/fixtures/phase9/h1-admission.json`. The existing binding test reads
  the saved requested model directly at `tests/phase9_binding.rs:106`.

The source path forcing the checkpoint is
`crates/cadence/src/review/model.rs`: an earlier-plan file absent from every
Plan 6 task lease and from the frontmatter union. The dispatch explicitly
requires a checkpoint before changing an earlier plan or editing around it.
No empty-string sentinel, hardcoded model, sidecar override, or recomputation
of current routing was introduced.

## Concrete proposed repair, not applied

Change only the requested model field to:

```rust
pub model: Option<String>,
```

This represents inherited dispatch as `None`/JSON null while retaining explicit
pins as `Some`/JSON strings. Existing string-valued saved records remain
decodable; observed model and usage fields remain unchanged. The Rust field
type changes, so compilation must check all consumers; no earlier-plan test
or compatibility fixture is proposed for modification.

If authorized, add independent model tests at
`crates/cadence/tests/phase9_model.rs`, compiling `model.rs` directly via
`#[path = "../src/review/model.rs"]`, with new hand-authored inputs at
`crates/cadence/tests/fixtures/phase9/requested-voice.json`. Test only this
module's saved representation, with literal results for pinned and absent
models. These two new paths also require explicit authorization. They are
proposed paths, not created files or completed tests. The owner must decide
whether this prerequisite is a separate repair commit before the four task
commits or a permitted extension of T1.

Alternative: the owner can specify an explicit saved inheritance representation
compatible with the current field. Choosing an undocumented sentinel here
would redefine saved model semantics and is not presumed authorized.

Impact: the source graph, service registration, grouped operation shapes,
reviewer contracts, hooks and pause behavior remain untouched. AC1, AC2,
AC148 and AC149 remain pending; their named new production units do not exist.

## Verification and regression record

No test, cargo check, clippy, host, MCP session, Node subprocess, install or
network operation ran. This is a source-inspection checkpoint, not a failing
test result. No test count prediction was made because no target was invoked.
The sole clippy invocation is still reserved for after the final task commit.

The existing phase-9 counts below are the prior Plan 5 report's baseline,
not results observed in this dispatch. Other counts were not measured.

| Target | Prior reported count | This dispatch |
|---|---:|---|
| phase7_guard | not measured | not run |
| phase7_risk | not measured | not run |
| phase7_lease | not measured | not run |
| phase8_config | not measured | not run |
| phase8_routing | not measured | not run |
| phase8_interview | not measured | not run |
| phase8_global | not measured | not run |
| phase8_dispatch | not measured | not run |
| mcp | not measured | not run |
| phase9_contract | 37 | not run |
| phase9_stream | 2 | not run |
| phase9_material | 20 | not run |
| phase9_manifest | 12 | not run |
| phase9_context | 13 | not run |
| phase9_policy | 21 | not run |
| phase9_selection | 30 | not run |
| phase9_specialist | 3 | not run |
| phase9_admission | 13 | not run |
| phase9_binding | 5 | not run |
| phase9_observations | 4 | not run |
| phase9_returns | 14 | not run |
| phase9_recovery | 10 | not run |
| phase9_consumers | 10 | not run |
| phase9_views | 5 | not run |
| phase9_inventory | 3 | not run |
| phase9_deferred | 13 | not run |
| phase9_forward forward_ | pending implementation | not run |
| phase9_invoking advisory_ | pending implementation | not run |
| cadence binary phase9_pause_tests::modern_ | pending implementation | not run |
| phase9_history history_ | pending implementation | not run |

## Run boundaries

- Main checkout `/code/cadence`, branch `cadence/binary-owns-process`, HEAD
  `c8f07ddd`. HEAD author is John Crenshaw <john@jcrenshaw.dev>, signature G.
- Initial status already contained a modified `.planning/STATE.md` and
  untracked `.planning/phases/9/reports/`. Those pre-existing paths were
  preserved. No earlier `plan-6.md` existed, so no rotation was needed.
- Published cad-executor contract and lean-build reference were consulted.
  The plan, context, project record, acceptance rules and manual checklist
  informed the prerequisite inspection. No CLAUDE.md was required.
- No source, test, fixture, skill, agent, hook, manifest, lockfile or git config
  was changed. Only this requested report was created, uncommitted.
- No agents or reviews were launched. No attempt was made to invoke edited
  skills or exercise installed hook behavior.
- The user's final-only clippy and named-target rules override the executor
  contract's per-task lint and whole-project suite defaults. The user's report
  format overrides the contract's shorter digest format.
- Read-only searches initially guessed nonexistent `config/routing.rs`,
  `config/dispatch.rs`, `config/route.rs` and `tests/phase9_attempts.rs` paths;
  those commands returned exit 2. File enumeration then located `config/roles.rs`
  and `tests/phase9_binding.rs`. These were navigation errors, not test failures.

Deviations: [deviation] Plan 6 assumes the completed saved review vocabulary can
preserve the absent phase-8 model required for local inheritance. The actual
requested model field is a mandatory string. Stopped for an earlier-plan repair
decision instead of introducing a substitute encoding or changing leased scope.

Lease extensions: none applied. Proposed prerequisite paths and the reason are
listed above; no authorization inferred.

Open items: the structural checkpoint and all four pending tasks. All four
MANUAL.md items remain untouched and unverified; no test stands in for them.
