# Config and import

The binary stores repo configuration in `.planning/config.v4.json` and global
configuration in a `config.v4.json` sibling of the resolved legacy global file.
Resolve both original identities before mapping destinations. If they alias,
there is one versioned destination with repo provenance. Explicit global request
intent remains separate: it cannot bypass the new-global-write guard on
`git.forge_repo`. An existing imported global slug keeps its actual global
provenance and a scope diagnostic, matching frozen merged readers.

Config changes are external participants in the existing store transaction. The
writer checks current config at admission and again before installing the durable
intent; a proposed new setting cannot authorize its own installation. Source bytes
and filesystem identity are re-read synchronously. Failure makes current config
unavailable. No watcher supplies correctness. Successful updates are visible on
the next operation. A changed config target binding requires reopening the session
before a config write; ordinary policy reads follow current resolved identities.

Repo wins over global, objects recurse, arrays/scalars/null replace, and absence
inherits. Defaults are read inputs and never persisted by config writes. Raw
layers preserve presence, source and unknown data as non-effective evidence;
effective values exclude unknown and retired keys. Scope diagnostics, invalid-layer
diagnostics and migration diagnostics have independent channels. Repo test/lint
commands and provider-key paths cannot suppress trusted global settings, even by
null or a blocking non-object ancestor. Credential files themselves are never read
by config translation.

The embedded schema lists all 94 frozen leaves: 80 keep-resemantic and 14 dead.
All eight D-06 retirements and six `workflow.max_dispatch_tokens.*` leaves are
non-effective, with no read defaults. `planning.max_capture_bullets` retains its
integer/path but reports active captured identities in **items**, excluding
completed, filed and declined identities. Revisions and continuation lines are not
units. A crossing never refuses an append. The old token windows are not budgets
and are not imported as enforced limits.

Explicit writes validate frozen types, bounds, enum membership, and forge grammars
(including 200-character slug and 253-character host limits). Import preserves the
unanswered null risk-surface arrays, while explicit writes require arrays. Legacy
role keys and `roles.*` remain separate; null fallback policy belongs to routing.

The original config files remain byte-identical. Rollback must remove the named
new outputs by hand; `git checkout` does not delete untracked versioned files.

## First-touch service and recovery

`import::SessionFactory` is the binary-root composition seam for PLAN-3. Construct
it with the global config address and a mandatory policy evaluator, then call
`first_touch(planning_root)`. It creates no service until first touch and shares
one owner for each resolved root. Session requests and config changes use the
store writer; queries report an error when controlling config is unavailable.

First touch reads every consumed legacy input before preparing outputs. It imports
CAPTURE/FILED/DECLINED, STATE and available trace generations; it records ARCHIVE's
availability without maintaining a fourth store. Whole source bytes remain labeled
non-effective evidence. Known `git.on_protected=deny` becomes `refuse`. Invalid
preferences are excluded with diagnostics and preserved originals; invalid policy
values fail closed. All eight D-06 names appear in one warning even when absent,
followed by accurate per-layer presence/removal lists. The six token retirements
have their own warning. Global forge provenance remains global.

One store transaction installs versioned config participants, item and decision
logs, then the state snapshot. The snapshot's `import` manifest contains the
source generation, source identities/digests, active paths, warnings, and an exact
`created` path list. It becomes complete only with the installed generation.
Pending intents are recovered before an incomplete root can be treated as empty.
Unrelated partial outputs are refused. During pending import recovery, legacy
sources are revalidated against the intent's generation and supply policy until
all participants are installed; partially installed config cannot authorize its
own import. Preparation and final validation both check source bytes.

The `created` list is the manual rollback inventory: ordinarily
`.planning/items.jsonl`, `.planning/decisions.jsonl`, `.planning/state.json`, and
`.planning/config.v4.json`, plus a global versioned sibling when a distinct global
source was present. Stop the resident service before removing those outputs.
Interrupted imports also have `.store-intent.json`; restart to finish recovery
before rolling back. A killed process can leave disposable `.<target>.<pid>.<n>.tmp` temporary
files, which do not signify completion and are not adopted as store data. Every
legacy file is retained; checkout alone removes none of these untracked outputs.

## Artifact mapping and preserved meaning

| Frozen artifact | New maintained destination | Preserved source meaning |
|---|---|---|
| CAPTURE.md | items.jsonl | Independent byte-position identities, kind, checked completion and phase spelling; unsupported spans remain non-effective source evidence. An absent queue is empty. |
| FILED.md | items.jsonl | Provider/repository/fingerprint identity and the optional unconfirmed marker; filing does not imply confirmation. |
| DECLINED.md | items.jsonl | Fingerprint events and authored prose decisions with reasoning. Declines exclude the identity's entire revision history from recall. |
| STATE.md | state.json | Original cursor fields and spelling; phase 1 of 0 is preserved without deriving current phase status. |
| trace.jsonl and trace.1.jsonl | decisions.jsonl | Routing and explicit gate/refusal evidence only, with within-file positions and generation provenance. Missing receipts stay unavailable. |
| ARCHIVE.md | Preserved legacy file | PLAN-3 history input, never a fourth newly maintained store. |
| Repo config.json | Repo config.v4.json | Stored values remain in their source layer; read defaults are not written. |
| Resolved global config.json | Sibling config.v4.json, when a source exists | Shared identities collapse to the repo destination; distinct identities remain separate. |

Capture continuations, fences, unknown headings, invalid UTF-8, and unrecognized
fragments are retained as labeled original bytes rather than blindly indexed.
For a FILED/DECLINED collision, both events survive with one immutable identity and
a warning; declined wins by an explicit rule, not file-traversal chronology.
Authored declines are also terminal recall exclusions.

Malformed/incomplete historical log rows, read activity, worker brackets,
measurement data and rotation state stay in original evidence. Observed effort
requires agent identity; blank observations are omitted and unfamiliar nonblank
spelling is retained separately from requested effort. A rotation seal and an
exact anchored-tail copy can prove a carried event, preserving both origins.
Equal payloads alone do not justify deduplication. Partial copies without that
proof remain separate.

Service tests exercise import followed by policy changes on the same owner,
including failed reads, later restoration, rename replacement, symlink retargeting,
layer collapse/separation, internal config writes and interrupted import recovery.
Refusals compare every maintained store's bytes. Capture reporting uses current
identities across durable completed/filed/declined revisions; exceeding the bound
still permits a durable append. Rollback tests also load the original STATE,
FILED, DECLINED and config through readers extracted from v3.7.12. External test
fixtures never inherit the checkout's git ancestor, and required legacy files are
checked for exact frozen provenance before import.

## Complete frozen configuration disposition table

These are the 94 schema leaves, excluding metadata and object containers:
**80 keep-resemantic, 14 dead**. Every keep-resemantic row retains its stored value,
presence and original layer, with synchronous policy revalidation. Role and legacy
model keys remain distinct; dispatch precedence belongs to later routing work.
Unknown data is non-effective evidence, never an implicit new supported setting.
Scope, invalid-layer and migration diagnostics remain separate.

| Frozen key | Disposition | Import behavior |
|---|---|---|
| `granularity` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `model.escalate_on_failure` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `model.overrides.cad-planner` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.overrides.cad-assumptions-analyzer` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.overrides.cad-verifier` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.overrides.cad-reviewer` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.overrides.cad-executor` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.overrides.cad-plan-checker` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.effort.cad-planner` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.effort.cad-assumptions-analyzer` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.effort.cad-verifier` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.effort.cad-reviewer` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.effort.cad-executor` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `model.effort.cad-plan-checker` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-planner.model` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-assumptions-analyzer.model` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-verifier.model` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-reviewer.model` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-executor.model` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-plan-checker.model` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-planner.effort` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-assumptions-analyzer.effort` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-verifier.effort` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-reviewer.effort` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-executor.effort` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `roles.cad-plan-checker.effort` | keep-resemantic | Carry independently, including explicit null; do not coalesce role and legacy paths. |
| `workflow.research` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.plan_check` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.verifier` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.skip_discuss` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.inline_plan_threshold` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.max_plan_tasks` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.max_plan_bytes` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `workflow.max_dispatch_tokens.cad-planner` | dead | Retire separately from D-06; no terminal-window measurement or budget enforcement survives. |
| `workflow.max_dispatch_tokens.cad-assumptions-analyzer` | dead | Retire separately from D-06; no terminal-window measurement or budget enforcement survives. |
| `workflow.max_dispatch_tokens.cad-verifier` | dead | Retire separately from D-06; no terminal-window measurement or budget enforcement survives. |
| `workflow.max_dispatch_tokens.cad-reviewer` | dead | Retire separately from D-06; no terminal-window measurement or budget enforcement survives. |
| `workflow.max_dispatch_tokens.cad-executor` | dead | Retire separately from D-06; no terminal-window measurement or budget enforcement survives. |
| `workflow.max_dispatch_tokens.cad-plan-checker` | dead | Retire separately from D-06; no terminal-window measurement or budget enforcement survives. |
| `workflow.test_command` | keep-resemantic | Global only; strip repo presence including null/blocking ancestors. Warn for non-null repo values; never promote them. |
| `workflow.lint_command` | keep-resemantic | Global only; strip repo presence including null/blocking ancestors. Warn for non-null repo values; never promote them. |
| `parallelization.enabled` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `parallelization.max_concurrent_agents` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `parallelization.min_plans_for_parallel` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `parallelization.use_worktrees` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `git.protected_branches` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.on_protected` | keep-resemantic | Carry; normalize legacy deny to refuse. Invalid permission values fail closed. |
| `git.integration_branch` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.auto_branch` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.base_branch` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.create_tag` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.on_land_cleanup` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.issue_check` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.forge_provider` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.forge_repo` | keep-resemantic | Preserve actual layer; imported global slug gets a scope diagnostic. New global writes refuse. |
| `git.forge_host` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `git.auto_close` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `planning.commit_docs` | keep-resemantic | Carry; false never disables durable store writes. |
| `planning.max_capture_bullets` | keep-resemantic | Retain integer; report active captured identities in items, excluding completed/filed/declined. Never refuse capture. |
| `memory.backend` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.mode` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.reviewers` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.key_file` | keep-resemantic | Global only; strip repo presence including null/blocking ancestors. Warn for non-null repo values; never promote them. |
| `review.request_timeout_ms` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.max_prompt_tokens` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.openai.tiers.flagship` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.openai.tiers.balanced` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.openai.tiers.cheap` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.gemini.tiers.flagship` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.gemini.tiers.balanced` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.gemini.tiers.cheap` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.deepseek.tiers.flagship` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.deepseek.tiers.balanced` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.providers.deepseek.tiers.cheap` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.plan.gate` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.plan.tier` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.plan.effort` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.diff.gate` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.diff.tier` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.diff.effort` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.risk_surface.gate` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.risk_surface.tier` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.risk_surface.effort` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.triggers.risk_surface.surfaces` | keep-resemantic | Keep absence, null and [] distinct. Import accepts unanswered null; explicit writes require arrays. |
| `review.triggers.risk_surface.waive_routing_floor` | keep-resemantic | Keep absence, null and [] distinct. Import accepts unanswered null; explicit writes require arrays. |
| `review.triggers.phase_diff.gate` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `review.triggers.phase_diff.tier` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `review.triggers.phase_diff.effort` | dead | Warn by name and remove from both effective layers/defaults; original is non-effective evidence. |
| `review.consult.enabled` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.consult.tier` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.consult.effort` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.consult.attempt_threshold` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.decision_review.tier` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
| `review.decision_review.effort` | keep-resemantic | Carry stored value and source layer; defaults remain read-time only. |
