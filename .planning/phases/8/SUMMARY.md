---
phase: 8
status: complete
completed: 2026-09-08
---

# Phase 8: Config and routing - Summary

Saved configuration now determines native execution's model and mapped agent
rung, with presence-aware resets, atomic writes and durable routing evidence.
The binary owns configuration facts, the shared thirteen-subject interview,
review-policy answers and the two plan-floor effects. New dispatch admission
compares the exact inputs that selected its route before installing the intent;
replay retains the admitted choice and leaves unobserved host facts missing.

## What shipped

- Plan 1: supported config facts and transactional multi-key writes through the
  existing cadence_query/cadence_apply tools; six-role model/effort resolution
  using stored presence and source layers; independent null resets that defeat
  legacy pins; explicit rung-agent mappings and one-step opt-in retry escalation.
  Native execution and its thin skill consume the selected parameters, and the
  writer admits route evidence alongside the dispatch. Unsupported model strings
  remain stored verbatim and resolve with an explicit warning and omitted model.
- Plan 2: missing global-parent infrastructure, reuse of valid shared global
  configuration across projects, and ownership of root/shared destination
  directories through validation, commit, confirmation and recovery. Stale
  participant observations refuse. Original stakes values retain layer/path
  evidence and a retirement explanation; snapshot mutations preserve import
  and source evidence without a migration state machine or legacy-file edits.
- Plan 3: one native conversation with six model subjects, six effort subjects
  and a floor answer. First acceptance writes all thirteen global choices;
  later ordinary answers write repo diffs, explicit global editing keeps its
  selected destination, and full protection persists a deliberate empty waiver
  array. Entry modes, intake and accepted suggestions share the same service.
  Structural surface selection remains a separate explicit answer; live provider
  setup returns its named unavailable result.
- Plan 4: the surviving plan/diff/risk_surface gate, reviewer, tier and effort
  bundle, including configured-provider filtering and named subagent fallback.
  Named-plan scope and phase unions use bounded, contained declared-file reads
  and shared risk signals. Incomplete reads raise conservatively. Unwaived risk
  recommends deep verification and can raise a non-explicit plan gate; explicit
  gates win. Waivers do not change model/rung or actual-diff surface selection,
  and the retired phase_diff trigger stays absent.
- Plan 5: final admission compares resolved paths, exact byte digests/presence,
  file stamps and alias status under writer ownership. A pre-intent changed-input
  failure returns no admitted prompt and leaves the resident reusable. Active
  routes require their exact Routing record and matching confirmed dispatch
  boundary; independently encoded partial intents recover one complete unit or
  refuse semantic mismatches despite consistent digests. Separate saved-input
  assertions cover sonnet/high, opus/xhigh and model-null/xhigh, complete source
  reasons, dispatch identities, requested effort and both prompt renderings.

## What this phase does not claim

The two live observations remain in [MANUAL.md](MANUAL.md): a roles interview
observed through a real host, and a saved routing choice honoured by a real
host. Binary tests establish saved values, schemas, resolution, admission and
prompt rendering. They do not establish host loading, consumer compliance,
observed effort, or model-generated output. No ignored live test or end-to-end
substitute was added for either item. Routing evidence keeps observed effort
and receipt missing until there is evidence to record.

Review-policy answers do not invoke reviewers, discover live providers or settle
reviews. Intake reuses the configuration service without implementing its later
workflows. The final configuration comparison protects admission against
cooperating writers; it does not freeze arbitrary external editors indefinitely.

Plan 1's tasks were executed outside the normal dispatch path, so no trace events
exist for them. Its report was reconstructed from the owner's completion record
and signed commits; historical verification receipts and counts are unavailable.
This summary does not invent that evidence or substitute later tests for it.

## Deviations

- Malformed workflow, concurrency and restart Verify lines were rewritten as
  independent function assertions, preserving the named test targets. Residual
  live-skill wording was corrected and host obligations remained manual. Removed
  AC1 was not restored as a regression criterion.
- Task leases were extended for required source and fixture paths throughout
  plans 2–5. The run records preserve the extensions and Verify rewrites. Plan 5
  also repaired two alias expectations left stale by Plan 3's alias-intent change
  and corrected reusable handling of a pre-intent routing-input refusal.
- The owner's command limits replaced historical workspace suites with named
  targets and at most one cadence-only clippy invocation per run. Plan 5's final
  named tests passed; its one clippy warning was fixed and the dispatch target
  passed afterward. The reports distinguish failed attempts, repairs and the
  absence of a second lint run.
- Phase closure is explicitly authorized documentation of completed binary
  scope. /cad-verify was not invoked; no UAT.md, STATE.md, ROADMAP checkbox or
  manual-checklist completion was changed. Unrelated phase-9 plans appearing
  during Plan 5 were excluded from its commits.

## Commits

The evidence record is [plan-1](reports/plan-1.md),
[plan-2](reports/plan-2.md), [plan-3](reports/plan-3.md),
[plan-4](reports/plan-4.md) and [plan-5](reports/plan-5.md).
Plan 5's report is committed as `c5cbdfd3`.

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `069b6f75` | feat(config): expose transactional config batches P8-1-T1 |
| 1 | 2 | `0931cbc7` | feat(routing): resolve presence-aware role choices P8-1-T2 |
| 1 | 3 | `ce5ae7c1` | feat(execution): persist admitted executor routing P8-1-T3 |
| 1 | 3 | `7f8a9ee0` | fix(config): enforce the planning policy the stub accepted |
| 2 | 1 | `74a0d7a8` | feat(config): complete shared global initialization P8-2-T1 |
| 2 | 2 | `d7348b8c` | feat(config): serialize shared global ownership P8-2-T2 |
| 2 | 3 | `f0730f73` | feat(config): preserve and disclose retired stakes evidence P8-2-T3 |
| 3 | 1 | `e072da97` | feat(config): prepare and atomically accept roles interviews P8-3-T1 |
| 3 | 2 | `71ddc10f` | feat(config): connect the grouped native configuration conversation P8-3-T2 |
| 3 | 3 | `238844c3` | test(config): prove native interview values and atomic writes P8-3-T3 |
| 4 | 1 | `f01e25e9` | feat(routing): return the surviving review policy bundle P8-4-T1 |
| 4 | 2 | `1e2c6429` | feat(routing): read declared plan scope conservatively P8-4-T2 |
| 4 | 3 | `85a93813` | feat(routing): apply the two plan floor effects at admission P8-4-T3 |
| 5 | 1 | `fecdd818` | feat(routing): bind final admission to captured config inputs P8-5-T1 |
| 5 | 2 | `43d54518` | fix(routing): require the complete confirmed admission on replay P8-5-T2 |
| 5 | 3 | `4197b950` | test(routing): prove saved choices and exact binary prompts P8-5-T3 |
