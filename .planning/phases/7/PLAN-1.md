---
phase: 7
plan: 1
requirements:
  - AC1
  - AC2
files:
  - crates/cadence/src/store/mod.rs
  - crates/cadence/src/store/filesystem.rs
  - crates/cadence/src/store/writer.rs
  - crates/cadence/src/store/transaction.rs
  - crates/cadence/tests/phase7_guard.rs
  - crates/cadence/src/guard/audit.rs
  - crates/cadence/src/import/mod.rs
  - crates/cadence/src/guard/mod.rs
  - crates/cadence/src/guard/bash.rs
  - crates/cadence/src/main.rs
  - crates/cadence/src/lib.rs
  - crates/cadence/src/rail/mod.rs
  - crates/cadence/src/rail/branch.rs
  - crates/cadence/src/config/schema.json
  - crates/cadence/src/config/merge.rs
  - crates/cadence/src/config/tests.rs
  - crates/cadence/src/pause/branch.rs
  - crates/cadence/src/config/reload.rs
  - hooks/hooks.json
  - docs/architecture/commit-rail.md
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --workspace && TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings && TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check"
  tasks:
    - id: P7-1-T1
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
    - id: P7-1-T2
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
    - id: P7-1-T3
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence guard"
    - id: P7-1-T4
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence config::"
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service"
    - id: P7-1-T5
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
    - id: P7-1-T6
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
    - id: P7-1-T7
      verify:
        - "TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard"
---

# Phase 7: The native Bash decision - Plan 1

## Goal

A Bash tool call reaches a native, durably recorded protected-branch decision, including deliberate unavailable-input failures. This plan alone proves the hook channel through a real host while retaining the shipped Write/Edit behavior.

## Must be true when done

- AC1: The installed PreToolUse registration invokes the Rust binary for Bash and the existing Write/Edit arm; no registration invokes the frozen JavaScript Git guard.
- AC1: The bounded scanner recognizes commit and push in its stated grammar; push asks, protected commits follow policy, and unrelated or unrecognized commands pass silently.
- AC1/AC2: Every non-silent Bash decision has a confirmed durable record; a concurrent resident cannot overwrite it.
- AC2: Unavailable Git and unresolved branches default to fail-open with an input-specific durable failure; a torn controlling config layer asks with the defaults-versus-user-settings reason, retaining any established deny; configured hard-fail denies on a provably protected branch.
- AC1/AC2: Given the exact input a hook sends, the binary returns a distinct decision for ask, deny and allow, and records the corresponding audit entry; intentionally broken inputs exercise both the default and opted-in failure policy.
- D-36/D-38: Shared protected-branch permission serves pause and the hook without importing branch creation or the workflow interview into the hook.

## Context

D-30 and D-34 through D-38 bind this plan. Start from guard::run, the existing owner-serialized store, config::reload and pause::branch::protected. The frozen scanner and protected-list resolver are behavior references. Direct hook execution adds another cooperating writer process; it does not add an MCP tool.

## Tasks

### Task 1: Serialize cooperating store processes (P7-1-T1)

- **Files:** `crates/cadence/src/store/mod.rs`, `crates/cadence/src/store/filesystem.rs` (Filesystem), `crates/cadence/src/store/writer.rs` (Writer::open / execute / revalidate), `crates/cadence/src/store/transaction.rs` (Intent / recover), `crates/cadence/tests/phase7_guard.rs`
- **Action:** Make a short-lived hook process and a resident use the same root-scoped interprocess serialization around recovery, observation and confirmed store mutation. Acquire ownership per operation, never for a resident's whole lifetime; refresh the validated view after acquiring it while preserving expected generation/integrity comparisons and changed-input refusals. Use the existing filesystem adapter and libc dependency, with no new package or external locking executable. Preserve the validate-before-replace, sync, intent and confirmation protocol. This is necessary because the hook writes the same decisions.jsonl and snapshot integrity as the resident; an unlocked append is not a valid store mutation. Keep the existing Storage implementations source-compatible where possible and embed new fixtures in the leased integration test.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` — runs two real processes sharing a store and proves both acknowledged decisions survive, generations remain valid, a waiting hook can run while the resident is idle, and stale conditional writes refuse. Kill one owner during admitted recovery; the replacement recovers exactly once, releases ownership on exit, and never overwrites foreign participant bytes.

### Task 2: Make guard audit independent of unavailable policy (P7-1-T2)

- **Files:** `crates/cadence/src/guard/audit.rs`, `crates/cadence/src/store/writer.rs` (Operation / persist), `crates/cadence/src/store/transaction.rs` (IntentKind / Intent::validate), `crates/cadence/src/import/mod.rs` (SessionPolicy::validate / SessionFactory / Session::request), `crates/cadence/tests/phase7_guard.rs`
- **Action:** Add a narrow, typed guard-audit operation using the existing Decision::Gate and Decision::Refusal record vocabulary. Its payload must preserve event identity, command digest, cwd/project identity, verb, branch observation, effective policy provenance, result and unavailable input, without recording raw shell commands or credentials. Audit admission and recovery may record that controlling config is unavailable, but may change only the guard audit data and decision/integrity bookkeeping; they cannot authorize an execution patch, rewrite lifecycle, edit config, render SUMMARY or recover an unrelated policy-dependent intent without its policy. Use the common writer and confirmation path from Task 1, not a second JSONL appender. Handle first hook contact deliberately: healthy first touch follows existing import ownership; an audit-only initialization when config is torn must be recognizable to subsequent normal first touch, which preserves the audit and completes import rather than treating it as a finished import or replacing it. Duplicate delivery of one host event replays its receipt; separate tool-use identities produce separate records. For a legacy event lacking tool-use identity allocate a per-invocation identity and do not coalesce distinct shell attempts by command digest.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` — confirms audit records with healthy, unreadable and malformed policy layers, both in an established store and on cold first touch; later import preserves the cold audit. Malicious audit payloads cannot write execution/config/SUMMARY. Inject failures at intent installation, decision replacement and final confirmation; no result claims a recorded decision before persistence is confirmed, and duplicate delivery does not append twice.

### Task 3: Connect the Bash hook to durable push decisions (P7-1-T3)

- **Files:** `crates/cadence/src/guard/mod.rs` (run / write_denial), `crates/cadence/src/guard/bash.rs`, `crates/cadence/src/guard/audit.rs`, `crates/cadence/src/main.rs` (Command::Guard / run_command), `crates/cadence/tests/phase7_guard.rs`
- **Action:** Add a separate Bash event arm to guard::run and wire it through Task 2's audit writer to the documented hookSpecificOutput permissionDecision response. Preserve Write/Edit input bounds, path resolution, denials and silent source allowance exactly. Establish a working direct binary -> Bash event -> project discovery -> recognized push -> durable ask -> host JSON path here, by the third task. Discover .planning upward from hook cwd, stopping at a .git boundary or filesystem root, and stay silent outside Cadence projects. Push takes precedence over commit and requires no branch/config permission to ask. Flush valid output and exit zero for hook decisions; stderr is diagnostic only. Do not use the resident's MCP queue or run any Git mutation.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence guard` — pipes real PreToolUse JSON into the compiled binary, then independently reads a confirmed push-ask record before accepting stdout. Nested cwd and non-Cadence repository cases prove discovery bounds. The original Write/Edit tests still deny the same paths and allow the same source writes.

### Task 4: Share protected-branch permission (P7-1-T4)

- **Files:** `crates/cadence/src/lib.rs`, `crates/cadence/src/rail/mod.rs`, `crates/cadence/src/rail/branch.rs`, `crates/cadence/src/guard/bash.rs`, `crates/cadence/src/config/schema.json` (git.protected_branches / git.on_protected), `crates/cadence/src/config/merge.rs` (merge), `crates/cadence/src/config/tests.rs` (all_frozen_keys_have_exactly_one_disposition_and_retirements_have_no_defaults), `crates/cadence/src/pause/branch.rs` (Policy / protected / base), `crates/cadence/tests/phase7_guard.rs`
- **Action:** Extract the pure protected-branch permission used by pause::branch::protected into the shared rail and make both pause and Bash consume it. Keep pause's question construction, base integrity, integration advice and checkout behavior in their existing workflow owners. On successfully parsed, merged native config, preserve nonblank lone strings, filtered nonblank arrays, explicit empty arrays, the main/master fallback and the deny alias for refuse; do not trim surviving branch names. Normalize these two compatibility spellings after layer merging while retaining raw layers and provenance. Add one boolean native config key selecting hard-fail on protected branches, default false, in the schema and document its chosen spelling in Task 7. Preserve the frozen 94-key disposition census as a census of frozen keys, and test the added native key separately instead of pretending it existed in v3. No routing, role selection or branch interview enters the hook.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence config::`; `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --bin cadence pause_service` — tests ask/refuse/deny-alias/allow on protected branches, unprotected pass, string/list/empty/malformed-value coercion and two-layer precedence. The new key defaults false and accepts only booleans. Existing pause branch questions and branch-workflow tests retain their behavior.

### Task 5: Pin the bounded command grammar (P7-1-T5)

- **Files:** `crates/cadence/src/guard/bash.rs`, `crates/cadence/tests/phase7_guard.rs`
- **Action:** Port gitVerbs' bounded verb rules from the frozen git-segments reference: admit only first word git or a path ending /git, skip flags and the seven separate option operands, and take the first remaining word as the verb. Correct its unconditional separator split: recognize simple segment boundaries only outside quotes and escapes; never rescan quoted arguments or wrapped payloads as Git segments. If quote, escape, substitution or other unsupported structure cannot be resolved within the bounded scan, decline the input silently. Keep behavior linear with the existing event size limit. Commit consults Task 4's shared permission; push always asks. Wrappers, substitutions and unparsed inputs remain outside coverage; -C is skipped only for verb detection, branch inspection remains hook-cwd-based, and an earlier checkout is not simulated. Do not execute a shell parser or attempt wrapper expansion. A recognized commit with unavailable observation belongs to Task 6.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` — covers all separators, absolute git paths, all seven operand-taking options, glued options, push precedence, non-Git text, wrappers, substitutions, large separator input, git -C and checkout-then-commit. Quoted/escaped separators, malformed quotes and substitution payloads cannot expose false Git segments: include `echo "text; git push origin main"` and `bash -c "echo text; git commit -m x"`, plus single-quoted and other-separator variants. Silent cases produce neither hook stdout nor decision-log growth; genuine top-level Git segments still decide using the cwd repository.

### Task 6: Distinguish unavailable-input failures loudly (P7-1-T6)

- **Files:** `crates/cadence/src/guard/bash.rs`, `crates/cadence/src/guard/audit.rs`, `crates/cadence/src/config/reload.rs` (Reload::refresh / FileIo::read), `crates/cadence/tests/phase7_guard.rs`
- **Action:** Implement settled D-30 for a recognized commit: unreadable Git or an unresolvable branch defaults to proceeding, with an explicit diagnostic and a confirmed guard-failure record naming the input. This failure pass is not an approving policy result; pass means no Cadence permission veto, not an explicit allow bypassing other host checks. A torn controlling config layer instead asks, deliberately preserving v3: name the unavailable layer and say the branch rails are deciding with defaults rather than the user's settings because their protected-branch list is unavailable. Ask even without a protected-branch hit, including when Git or the branch is also unavailable; record each unavailable input durably. A torn layer never creates or cancels a deny: retain any independently established denial and append the torn-layer reason. For hard-fail, retain the confirmed denial-only snapshot of the opt-in and protected-list policy, refreshed only after a successful complete config read; use it or a currently readable explicit opt-in on torn config, never cached permission to allow. Read current symbolic HEAD identity safely from the cwd repository, including worktree gitdir indirection, when Git is unavailable; a last observation is usable only with unchanged current HEAD identity. Hard-fail still denies on a provably protected branch; unknown branch or opt-in facts cannot be invented and do not suppress a torn-layer ask. Exercise loss of the opt-in's own layer after confirmation and fresh-process failure with a readable opt-in. If audit storage is unavailable, fail open with loud stderr naming both failures and never claim durability; preserve any independently established hard denial. Do not relax Reload::refresh's no-cached-permission guarantee for other consumers.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` — independently proves unreadable Git and unresolved branch fail open with durable input-specific failures, torn controlling config returns ask with the defaults-versus-user-settings reason, and an established deny survives a torn layer with that reason appended. Tear repo and global layers, including loss of a custom protected list on a branch outside main/master and simultaneous Git failure. Hard-fail denies on provably protected main and custom branches; tearing the opt-in's own layer after a confirmed healthy read retains denial across restart, and a readable opt-in works in a fresh process. Healthy unprotected behavior stays unchanged. Audit-write failure cannot masquerade as a durable decision.

### Task 7: Prove the shipped hook on a real host (P7-1-T7)

- **Files:** `hooks/hooks.json` (PreToolUse), `crates/cadence/tests/phase7_guard.rs`, `docs/architecture/commit-rail.md`
- **Action:** Replace the Bash JavaScript registration with a direct cadence guard command resolved to the installed native executable; wire the already-implemented Write/Edit arm to that same command. Preserve unrelated hook registrations and frozen cadence-core bytes. Document the binary-on-PATH installation assumption, scanner bounds, default failure policy, exact new config key and audit limits. The hook registration must still invoke the production binary directly, without a decision-emitting wrapper. Correlate actual host hook/tool events, Git before/after and confirmed decisions after process restart; capture actual versions, exits and content digests in the leased validation document. No live task targets this checkout or an external publishing destination.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test phase7_guard` - proves the shipped manifest registers the native guard command rather than a JavaScript shim, that a protected commit is denied, that unreadable Git allows the command while recording a guard-failure decision, that a torn config layer asks with the defaults-versus-user-settings reason, that an established deny survives a torn layer, and that hard-fail prevents the command on a protected branch. Each case feeds the binary the exact input a hook sends and asserts its returned decision; no host, skill or model is involved.

## Requirements mapping

| Requirement or decision | Implementing tasks |
|---|---|
| D-30 / AC2 | P7-1-T2, P7-1-T6, P7-1-T7 |
| D-34 / AC1 | P7-1-T3, P7-1-T7 |
| D-35 / AC1 | P7-1-T5, P7-1-T7 |
| D-36 / D-38 | P7-1-T4 |
| D-44 | P7-1-T3, P7-1-T7 |

## Notes

Execute PLAN-1 -> PLAN-2 -> PLAN-3 -> PLAN-4. Shared store, service, rail and test files make this sequence mandatory; the owner's explicit ordered-plan instruction overrides the contract's independent-slices default. No task ceiling was supplied. Task 4 crosses module wiring and config consumers for one permission concern; it is not permission to refactor other config policy.

The first three tasks establish a runnable hook-to-store path. Use existing dependencies only; all fixtures and signing material stay under /tmp. Clear RUSTC_WRAPPER on Cargo commands. No task edits frozen cadence-core or the historical phase plans. Commits made before this gate are historical inputs, not retroactively checked or rewritten.

The installed host was found at /home/john/.local/bin/claude, version 2.1.263. Current Context7 host documentation confirms hookSpecificOutput permissionDecision, zero-exit JSON, --settings, --mcp-config and --strict-mcp-config. Recheck installed help at execution. From each prepared fixture cwd the live test must launch: `claude -p --output-format stream-json --verbose --include-hook-events --setting-sources '' --settings /tmp/cadence-phase7-live/guard-settings.json --strict-mcp-config --mcp-config /tmp/cadence-phase7-live/mcp.json --permission-mode default --allowedTools Bash Read Write Edit -- 'Run the exact guard probe commands in the supplied fixture instructions; report every tool refusal.'` The harness creates isolated per-case paths under that named /tmp parent and substitutes those real paths. Do not use --bare (it skips hooks) or bypassPermissions. The settings carry no attribution text. Ask UI that cannot be established from print-mode hook events requires the same command without -p in an interactive host as human-verify; it cannot be inferred from a unit test.

Settled D-30 deliberately preserves v3's torn-config ask and retention of an already-computed deny with the defaults-versus-user-settings reason (cadence-core/bin/git-guard.mjs:168-176); only unavailable Git or an unresolvable branch defaults to fail-open. Store input unavailability is a distinct failure from unavailable guard inputs; stderr does not count as decisions.jsonl durability.
