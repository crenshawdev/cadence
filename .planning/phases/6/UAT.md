# Phase 6 PLAN-2 live UAT - blocked on query-schema filtering

Run date: 2026-09-07. Repository `/code/cadence`, branch
`cadence/binary-owns-process`, input HEAD
`636d2447bec532108acfb2afde53ca89aa4089a2`.

**Task 5 remains incomplete. Task 6 was not started.** This is a real retry,
including an actual noninteractive `/cad-execute 6` invocation. Task 7's root
object fix is present and verified: all six advertised schemas have root
`type: object`. The host now accepts the server listing but filters out
`cadence_query` because its input still has a top-level `oneOf`. The fixed
executor was never dispatched. This is a different rejection from the prior
missing-root defect. The complete earlier BLOCKED record is preserved in the
clearly labelled prior-attempt section below.

## Environment and fixture

External root: `/tmp/cadence-uat-20260907-5yt3jjm7`.
Project: `/tmp/cadence-uat-20260907-5yt3jjm7/fixture`.
All configuration, host streams/debug logs, setup scripts and independent
inspection receipts are under that temporary root. No repository plugin or
frozen JavaScript hook was loaded; both real-host init events report
`plugins: []`, one connected `cadence` server and the local `cad-executor` agent.
The host's built-in skills were also visible.

| Component | Observed value |
|---|---|
| host | `2.1.263 (Claude Code)` |
| cargo | `cargo 1.98.1 (797e8a9bc 2026-08-05) (Arch Linux rust 1:1.98.1-1.1)` |
| rustc | `rustc 1.98.1 (48a229cea 2026-09-01) (Arch Linux rust 1:1.98.1-1.1)` |
| node | `v26.8.1` |
| git | `git version 2.55.0` |
| gpg | `gpg (GnuPG) 2.4.9` |
| Selected model | `--model opus`; both init events report `claude-opus-5` |
| Binary | `/code/cadence/target/debug/cadence` |
| Binary SHA-256 | `c22ffb28740417a79a08edc3cfc5390ca5d16cec38c5e4d21f75f0f9b1be045d` |
| Signed fixture baseline | `9ed495ed128d88dd8838979396fd8a46d029d6d5` |
| Baseline signature and author | `G 693AB15F91734B0C`; John Crenshaw <john@jcrenshaw.dev> |

The build ran once with `TMPDIR=/tmp RUSTC_WRAPPER= cargo build -p cadence`,
exit 0. Fixture lockfile setup used
`TMPDIR=/tmp RUSTC_WRAPPER= cargo generate-lockfile --offline`, exit 0, before
the signed baseline. Git identity and signing configuration are fixture-local.
Installed `claude --help`/`--version` and current Context7 host documentation
were consulted. The installed host's observed behavior is the live evidence.

All fixture children set `CADENCE_GLOBAL_CONFIG` and `RUSTC_WRAPPER` empty and
`TMPDIR=/tmp`. The host uses `CLAUDE_CONFIG_DIR` under the external root,
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DISABLE_AUTOUPDATER=1`,
`ENABLE_TOOL_SEARCH=false`, and an npm cache under that same root. Inherited
`CLAUDE*` variables were removed before constructing the isolated host
environment. Existing authentication was supplied only in process memory;
no credentials were written into this record or setup files. Unused Node/host
stdin was DEVNULL. The global
`/home/john/.claude/cadence/config.v4.json` remained absent.

## Exact inputs and stubs

The fixture contains a minimal Rust library and test, two native plans and a
phase 6 ROADMAP entry. No source/test content is reproduced or evaluated here.
Both plans lease exactly `src/lib.rs`. Their operational frontmatter is:

```yaml
phase: 6
plan: 1
requirements: [AC3, AC7]
files: [src/lib.rs]
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline"
  tasks:
    - id: T1
      verify: ["TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline subtract_works"]
```

```yaml
phase: 6
plan: 2
requirements: [AC3, AC7]
files: [src/lib.rs]
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline"
  tasks:
    - id: T2
      verify: ["TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline multiply_works"]
```

The operator-authored bodies request the two corresponding source additions,
limit edits to the lease, require the command prefixes and configured signing,
and prohibit attribution notices, trailers, session URLs and credential output.
Full plan digests:

- `.planning/phases/6/PLAN-1.md`: `f61ae5a7c7e4f47ae4516e215abe6c1a1d72b6bec04d56c0d68908dac873bc88`.
- `.planning/phases/6/PLAN-2.md`: `07e50f1291cf93d183ad61b5ab4c45b33dedaf55f1dcb4ff199aa443b9255c82`.

Strict production policy remains exactly `rung: fixed; branch: current;
reviews: disabled`; there is no configurable routing, alternate branch or
review-provider substitution. Setup explicitly seeds continuation authority
through a temporary Rust helper and the production store, matching the existing
deterministic fixture. This is an authorization stub, not a live operator-answer
round trip or an executor. Its permissive `AllowFixture` store policy returns
`Ok(())`; it has no host/server proxy role.

The helper writes a version-1 gate in scope project/planning-root of this
fixture, cycle `live`, occurrence `phase-6-execution`, phase `6`, plan
`native-execution`, report `phases/6/SUMMARY.md`. Gate fields are
`id: fixture-progress`, `purpose: progress`, `checkpoint_id: null`,
`question: Continue?`, `need: Execution authority`, `options: []`.
The first state is `status: unanswered`; the second is `status: answered` with
`question_id: fixture-progress`, `actual_response: Proceed`,
`selected_option: null`, `adjustment: null`, `disposition: approve`, and
`authorization_id: fixture-authorization`. Transactions
`fixture-authority-0` and `fixture-authority-1` were actually applied after the
malformed-patch probe initialized the store. Their decisions are
`native-evidence:fixture-authority-0` and `native-evidence:fixture-authority-1`.
The helper build command was
`TMPDIR=/tmp RUSTC_WRAPPER= cargo build --offline --manifest-path
/tmp/cadence-uat-20260907-5yt3jjm7/seed/Cargo.toml --target-dir /code/cadence/target`
(exit 0). Direct helper invocation with the fixture path exited 0 and printed
the two transaction IDs. No execution dispatch was seeded.

The landed skill/agent copies were compared byte-for-byte and by SHA-256:

| Repository source (copied to matching project-local `.claude/` path) | SHA-256 |
|---|---|
| `skills/cad-execute/SKILL.md` | `ae4287825c25d772134cc3f7ce7fef6e5d2e242788d72528ded1330e107102cc` |
| `skills/cad-executor-contract/SKILL.md` | `0e71134a6172988fdaf95b042e72a2b19e983973087ddaf26c6008e6d889e1d7` |
| `agents/cad-executor.md` | `53d1bde82b501f8f954d9406ab1b1f64b3eacb709bdbd888bf9b0d96b4c507fb` |

Exact `conf/mcp.json`:

```json
{
  "mcpServers": {
    "cadence": {
      "command": "/code/cadence/target/debug/cadence",
      "args": [
        "serve",
        "--project-root",
        "/tmp/cadence-uat-20260907-5yt3jjm7/fixture"
      ],
      "env": {
        "CADENCE_GLOBAL_CONFIG": ""
      }
    }
  }
}
```

Exact `conf/settings.json`:

```json
{
  "attribution": {
    "commit": "",
    "pr": ""
  },
  "includeCoAuthoredBy": false,
  "autoMemoryEnabled": false,
  "enableAllProjectMcpServers": false,
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Grep",
      "Glob",
      "Task",
      "Agent",
      "Skill",
      "mcp__cadence__cadence_query",
      "mcp__cadence__cadence_apply",
      "mcp__cadence__cadence_version"
    ],
    "defaultMode": "dontAsk"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/code/cadence/target/debug/cadence guard"
          }
        ]
      }
    ]
  }
}
```

The host and hook launch the binary directly as `cadence serve --project-root
<fixture>` and `cadence guard`. No wrapper, plugin or JavaScript hook is between
the host and binary. Python only launches and observes its own fixture children.
The unused replacement observer would terminate its own server on the first
`next-plan` tool result, interrupt that host and resume the saved session with
a fresh server. That trigger never occurred; this prepared observer is not
replacement evidence. The separate guard probe was prepared but not launched.
`src/probe.txt` is the authorized source-write target, ignored locally through
`.git/info/exclude`; it was never created.

## Commands, prediction and actual results

Both real-host invocations ran from the fixture with this common command:

```text
claude -p <prompt>
  --mcp-config /tmp/cadence-uat-20260907-5yt3jjm7/conf/mcp.json
  --strict-mcp-config
  --settings /tmp/cadence-uat-20260907-5yt3jjm7/conf/settings.json
  --setting-sources project
  --model opus --effort high --permission-mode dontAsk
  --output-format stream-json --verbose --include-hook-events
  --forward-subagent-text
  --debug-file /tmp/cadence-uat-20260907-5yt3jjm7/evidence/<mode>-debug.log
```

The boundary prompt, preserved in `evidence/boundary-prompt.txt`, was:

```text
This is an authorized disposable-fixture boundary probe. Directly call mcp__cadence__cadence_apply with the empty object {} exactly once to observe its malformed-arguments response. Do not use ToolSearch, load tools, repair the input, invoke agents, or change files. Report the returned status/code/reason only.
```

The execution prompt was exactly `/cad-execute 6`. There was no ToolSearch
preamble, extra execution instruction, repository plugin option, tool restriction
or shell fallback. Exact argument arrays are retained in the corresponding
`evidence/*-command.json` files. Neither invocation used `--resume`, because no
first dispatch occurred to resume between plans.

Task 5 PREDICTION before Verify: three host tools available; successful typed
refusal for `{}`; two real executor dispatches, source changes, verification and
suite tool calls, two signed task commits, lossless accepted patches and exact
SUMMARY rows; six protected denials (both Write and Edit on each target), one
source Write allowance; distinct server PIDs with intentional replacement
between dispatches. No model-produced content quality was predicted or graded.

ACTUAL:

- Boundary host exit 0, 2 turns, 1 tool call, 0 Task/Agent calls, 0 hook events.
  The actual `cadence_apply` arguments were `{"dispatch_id":"null"}`, **not
  the requested `{}`**. The result was a successful `refused` envelope with
  `code: invalid-patch`; the tool result had no error flag. Tool-use ID:
  `toolu_01KmbY1XevmP7Z55YLuCVRVX`. This proves a direct malformed-patch
  refusal without ToolSearch; it does not prove the exact empty-object request.
- Execution host exit 0, 2 turns, 1 `cadence_version({})` call, 0 query/apply
  calls, 0 Task/Agent calls and 0 hook events. Version tool-use ID:
  `toolu_01FkKfKatJEpcLszMTu6nD4e`. Host exit 0 is not an execution pass.
- Both init events expose exactly two Cadence tools: `cadence_apply` and
  `cadence_version`. Neither exposes `cadence_query`.
- Both debug logs contain the host diagnostic:
  `Skipping tool "cadence_query": its input schema uses top-level oneOf, which the Anthropic API does not accept. Other tools from this server remain available.`
- The execution loop therefore never reached a plan dispatch. The model's
  diagnostic version call is recorded as an observed call outside the skill's
  prescribed query/Task/apply sequence; it is not a successful loop.

[deviation] Expected all three tools to be host-callable after the object-root
fix; observed host filtering of the remaining root input union. The producer
is outside the remaining lease, so no workaround or schema change was made.
[deviation] Expected the deliberately empty malformed-patch input; observed
`{"dispatch_id":"null"}`. An earlier progress message described `{}` as having
succeeded; independent stream inspection corrected that statement. Only the
actual malformed request is claimed here.

The targeted prerequisite `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence
--test mcp` returned **14 passed, 0 failed, 0 ignored, 0 filtered, exit 0**
(30.04 seconds). Its count was not separately predicted before invocation.
This prerequisite does not fill a live observation gap. No full Cargo or Node
suite was run in this checkpoint dispatch.

Closing wire PREDICTION before Verify: three names, six object roots and a
remaining root `oneOf` on query input. ACTUAL: direct diagnostic server PID
2761289, exit 0, exactly those results; `evidence/wire-tools-list.json` preserves
the raw response. The probe sent initialize, initialized and tools/list only.

| Schema | Root type | Root oneOf variants |
|---|---|---:|
| cadence_version.inputSchema | object | 0 |
| cadence_version.outputSchema | object | 4 |
| cadence_query.inputSchema | object | 1 |
| cadence_query.outputSchema | object | 4 |
| cadence_apply.inputSchema | object | 0 |
| cadence_apply.outputSchema | object | 4 |

Task 7's root requirement passes; this additional host input-union restriction
is not covered by that requirement. No negative-control mutation was repeated.

## Process evidence and independent inspection

| Invocation | Host PID | Rust server PID | Observed end |
|---|---:|---:|---|
| Direct malformed-patch host | 2757430 | 2757470 | Host exit 0; normal server closure |
| `/cad-execute 6` host | 2758322 | 2758359 | Host exit 0; normal server closure |
| Raw wire diagnostic | none | 2761289 | Server exit 0 after closing stdin |

**These are separate probes, NOT a replacement between plan dispatches.**
No intentional server termination, resumed execution session or outstanding
live dispatch occurred. All five owned PIDs were absent at closing inspection.
No unrelated process was inspected or terminated. No claim substitutes these
PID pairs for the required between-dispatch replacement.

Independent reads of Git, state, decisions and file existence are recorded in
`evidence/independent-inspection.json` and `closing-inspection.json`:

- Fixture HEAD is still `9ed495ed128d88dd8838979396fd8a46d029d6d5`; Git status
  is clean; source diff against that baseline is empty; task commit count is 0.
- State has only `import`, `cursor`, `source_evidence`, `archive` and
  `native_evidence` data keys; no execution namespace or dispatch exists.
- Decisions contain exactly one boundary refusal plus the two declared
  authorization-stub records. The refusal decision ID is
  `9418fc503a3dff8646f6eb53e684e200e0df92d8c78fc7c4954b4236c2139a37`, generation 2,
  root-refusal scope, outcome `refused:invalid-patch`, subject ID null.
- Its request digest is
  `14a34b9ead1e68a77b3b8471e8cf71dcc146df7b5d17614dd0e6db127b606d98`;
  response digest is
  `b51b658564dd868c696b0d9fcc0819ad57b4e29901e1f166c822c4aef189b44d`.
  Independent canonical JSON hashing matches both the observed malformed
  request and compact refusal envelope. The decision is durable and unique.
- `.planning/phases/6/SUMMARY.md` is absent. There are no dispatch IDs,
  accepted patch IDs, executor task SHAs or SUMMARY task rows to report.

## Live checklist, stop and unproved obligations

| Obligation | This retry |
|---|---|
| Actual host/model access, isolated direct stdio server | Observed |
| Six object roots and copied skill/agent identity | Observed |
| Direct malformed-patch refusal without ToolSearch | Observed for actual nonempty malformed input |
| Exact `{}` probe | Unverified; actual input differed |
| Real `/cad-execute 6` invocation | Observed; query tool unavailable |
| Query/Task/apply loop and exact fixed-executor prompt | Blocked; zero dispatches |
| Source changes and dispatched verify/suite commands | Unverified; none occurred |
| Ordered signed task commits and advertised patch return | Unverified; none occurred |
| Accepted patch calls and exact SUMMARY/full-SHA shape | Unverified; none occurred |
| Intentional replacement between plans and live resume | Unverified; not reached |
| Three protected Write denials | Unverified in retry; prior attempt observed three |
| Protected Edit denials | Unverified in both attempts |
| Authorized source Write allowance | Unverified in retry; prior attempt observed one |
| Real compaction and before/after calls | Not observed; causal conclusion INCONCLUSIVE |

The guard probe was not launched after discovering the blocking host rejection:
the user's stop instruction takes precedence over accumulating more partial
observations. Temporary guard registration is setup only. Neither an absent
hook event nor the previous Write-only probe proves live Edit denial.
AC3 and the full AC7 remain unverified. No assertion evaluates model-produced
source, test output, deviation/blocker prose or compaction causality.

OQ-1 retains no preamble: the real direct malformed apply call succeeded with
zero ToolSearch calls. OQ-2 remains non-decision-bearing under D-25's failed
negative control; there were zero compaction events and no new causal proof.
Phase 11 attempt history, checkpoints, general SUMMARY/task/lease behavior and
phase 7-9 commit/Bash/routing/review rails remain unimplemented by this slice.
Installed release wiring, general lifecycle flow and cross-format native resume
are not proved. The fixture authority stub is not product operator authorization.

Closing static/preservation PREDICTION before Verify: clippy, fmt, TypeScript
and protected-path comparisons exit 0; zero task commits/dispatches/SUMMARY.
ACTUAL: all those expectations matched. Commands:

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`: exit 0.
- `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null`: exit 0.
- `git diff --exit-code v3.7.12 -- cadence-core/`: exit 0.
- `git diff --exit-code 636d2447bec532108acfb2afde53ca89aa4089a2 --` every
  user-protected planning path: exit 0.

D-29 is applied: `TMPDIR=/tmp node --test` was not run as a gate, and no v3
Read anchor was restored. Task 6's AC1-AC8 acceptance map and final full-suite
work were **not started**, because Task 5 stopped at the blocker. The 14-test
MCP prerequisite is not a substitute for Task 6 or the live AC3/AC7 clauses.
A follow-up needs a host-loadable query input schema while preserving the
required discriminator and union constraints, plus the associated regression
coverage; that requires the producer outside this dispatch's lease. No repair
or narrowed acceptance criterion was silently substituted.

## Prior attempt - BLOCKED, preserved verbatim

The following is the full earlier record committed at
`c8277afe1a65fb7f79745c18b55c4190ad5995e4`. Its missing-root rejection, Write-only
denials, unobserved Edit behavior and non-replacement PID pairs remain historical
facts of that attempt. Its Task 6 wording is historical; the current D-29
instruction above controls this retry.

---

# Phase 6 PLAN-2 live UAT — blocked

Run date: 2026-09-07. Repository: `/code/cadence`, branch
`cadence/binary-owns-process`, input HEAD
`ad6da6baacdd73416b97c9c279a63a65489f2d8d`.

**Task 5 is incomplete. Task 6 was not started.** The actual host connects to
the Rust stdio server but rejects its advertised tool schemas. No Cadence tool
becomes available to the model. The live execution requirements cannot be
proved under the remaining file lease, so this record stops at that boundary.
The observed protected-write denials remain observations, not a completed UAT.

## Environment and evidence location

External UAT root: `/tmp/cadence-uat-20260907-aanq22_e`.
Project fixture: `/tmp/cadence-uat-20260907-aanq22_e/fixture`.
Configuration, raw host streams, host debug logs, process records and independent
inspection receipts live under that temporary root. No fixture is in the
Cadence repository. No repository plugin or frozen JavaScript hook was loaded;
both host init records report `plugins: []` and only `cadence` as the connected
MCP server. Host-provided built-in skills remain visible.

| Component | Observed version or identity |
|---|---|
| Host | `2.1.263 (Claude Code)` |
| Selected model | `--model opus`; host init reports `claude-opus-5` |
| Cargo | `cargo 1.98.1 (797e8a9bc 2026-08-05) (Arch Linux rust 1:1.98.1-1.1)` |
| Rust | `rustc 1.98.1 (48a229cea 2026-09-01) (Arch Linux rust 1:1.98.1-1.1)` |
| Node | `v26.8.1` |
| Git | `git version 2.55.0` |
| GPG | `gpg (GnuPG) 2.4.9` |
| Binary | `/code/cadence/target/debug/cadence` |
| Binary SHA-256 | `3c781ecfd6d29321eed011b66f3f5b5f3d533daac5f4d223b646a4d0e9eae19e` |
| Fixture baseline SHA | `45d9414bd86b0a1375ec02963962b638116db1c5` |
| Baseline author | `John Crenshaw <john@jcrenshaw.dev>` |
| Baseline signature | Git status `G`, key `693AB15F91734B0C` |

The binary was built once with
`TMPDIR=/tmp RUSTC_WRAPPER= cargo build -p cadence` (exit 0). The fixture's
lockfile was prepared with `TMPDIR=/tmp RUSTC_WRAPPER= cargo generate-lockfile
--offline --manifest-path /tmp/cadence-uat-20260907-aanq22_e/fixture/Cargo.toml`
(exit 0) and included in the signed baseline. `claude --help` and
`claude --version` were inspected before the run. Current Context7 host CLI and
hook documentation was consulted; installed behavior is the evidence here.

## Exact fixture inputs and stubs

The fixture has a minimal Rust library, a unit test, two native plans and a
ROADMAP phase 6 entry. Source and test content are deliberately not reproduced
or evaluated here. Both plans declare the same lease, `src/lib.rs`.

```yaml
# PLAN-1.md frontmatter
phase: 6
plan: 1
requirements: [AC3, AC7]
files: [src/lib.rs]
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline"
  tasks:
    - id: T1
      verify: ["TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline subtract_works"]
```

```yaml
# PLAN-2.md frontmatter
phase: 6
plan: 2
requirements: [AC3, AC7]
files: [src/lib.rs]
execution:
  schema: 1
  suite: "TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline"
  tasks:
    - id: T2
      verify: ["TMPDIR=/tmp RUSTC_WRAPPER= cargo test --offline multiply_works"]
```

Complete plan SHA-256 digests:

- PLAN-1: `61a0c56e7ba11fffc12ac6d230e7ba09ef3f763c0922faad9111be91b8ee40a4`.
- PLAN-2: `ecab3cc869b24f0db8b24eb5ea24c2b7903e1b277a8c68aff6a3812c0e19e6ab`.

The landed fixed policy is exactly `rung: fixed; branch: current;
reviews: disabled`. No configurable routing, alternate branch, review provider,
checkpoint or operator-answer flow was substituted. The native continuation
stub was prepared as a separate temporary Rust helper, built successfully but
**never run**. Its intended gate states were `unanswered`, then `answered` with
`question_id: fixture-progress`, `actual_response: Proceed`,
`selected_option: null`, `adjustment: null`, `disposition: approve`, and
`authorization_id: fixture-authorization`. Intended transactions were
`fixture-authority-0` and `fixture-authority-1`; neither exists in the fixture.
Its scope was project/planning-root of this fixture, cycle `live`, occurrence
`phase-6-execution`, phase `6`, plan `native-execution`, report
`phases/6/SUMMARY.md`; gate purpose `progress`, checkpoint null, question
`Continue?`, need `Execution authority`, options empty. This was setup for the
same explicit fixture authority used by the deterministic tests, not an
observed user-answer round trip. The helper build used
`TMPDIR=/tmp RUSTC_WRAPPER= cargo build --offline --manifest-path
/tmp/cadence-uat-20260907-aanq22_e/seed/Cargo.toml --target-dir
/code/cadence/target`, exit 0. It does not proxy the host or server.

Project-local copies were compared byte-for-byte and by SHA-256:

| Repository source → fixture destination | SHA-256 |
|---|---|
| `skills/cad-execute/SKILL.md` → `.claude/skills/cad-execute/SKILL.md` | `ae4287825c25d772134cc3f7ce7fef6e5d2e242788d72528ded1330e107102cc` |
| `skills/cad-executor-contract/SKILL.md` → `.claude/skills/cad-executor-contract/SKILL.md` | `0e71134a6172988fdaf95b042e72a2b19e983973087ddaf26c6008e6d889e1d7` |
| `agents/cad-executor.md` → `.claude/agents/cad-executor.md` | `53d1bde82b501f8f954d9406ab1b1f64b3eacb709bdbd888bf9b0d96b4c507fb` |

Exact `conf/mcp.json`:

```json
{
  "mcpServers": {
    "cadence": {
      "command": "/code/cadence/target/debug/cadence",
      "args": [
        "serve",
        "--project-root",
        "/tmp/cadence-uat-20260907-aanq22_e/fixture"
      ],
      "env": {
        "CADENCE_GLOBAL_CONFIG": ""
      }
    }
  }
}
```

Exact `conf/settings.json`:

```json
{
  "attribution": {
    "commit": "",
    "pr": ""
  },
  "includeCoAuthoredBy": false,
  "autoMemoryEnabled": false,
  "enableAllProjectMcpServers": false,
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Grep",
      "Glob",
      "Task",
      "Agent",
      "Skill",
      "mcp__cadence__cadence_query",
      "mcp__cadence__cadence_apply",
      "mcp__cadence__cadence_version"
    ],
    "defaultMode": "dontAsk"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/code/cadence/target/debug/cadence guard"
          }
        ]
      }
    ]
  }
}
```

All fixture child environments explicitly set `CADENCE_GLOBAL_CONFIG` to the
empty string, `TMPDIR=/tmp`, and `RUSTC_WRAPPER` to the empty string. The host
uses `CLAUDE_CONFIG_DIR=/tmp/cadence-uat-20260907-aanq22_e/host-config`,
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DISABLE_AUTOUPDATER=1`, and
`ENABLE_TOOL_SEARCH=false`. Inherited `CLAUDE*` variables were removed first,
so no parent-session messaging connection or config directory was inherited.
Existing authentication was supplied in process memory; credentials are not
included in this record. No user-global configuration was selected or changed.
The global `/home/john/.claude/cadence/config.v4.json` remains absent.

The Python harness starts `claude` with unused stdin set to DEVNULL and writes
streams under `evidence/`. It inspects only descendants of its own host PID.
The MCP definition and hook command invoke the built binary directly, with no
wrapper between host and binary. `src/probe.txt` is a separate authorized
source-write target, locally ignored through the fixture's `.git/info/exclude`.

## Commands and prediction-first record

Common host command, from the fixture directory:

```text
claude -p <probe-prompt>
  --mcp-config /tmp/cadence-uat-20260907-aanq22_e/conf/mcp.json
  --strict-mcp-config
  --settings /tmp/cadence-uat-20260907-aanq22_e/conf/settings.json
  --setting-sources project
  --model opus --effort high --permission-mode dontAsk
  --output-format stream-json --verbose --include-hook-events
  --forward-subagent-text
  --debug-file /tmp/cadence-uat-20260907-aanq22_e/evidence/<mode>-debug.log
```

Exact argument arrays and operator probe prompts are retained in
`evidence/preflight-command.json`, `preflight-prompt.txt`,
`boundary-command.json`, and `boundary-prompt.txt`. The first probe additionally
used `--tools Read,Write,Edit`; the second omitted that restriction. Both have
zero ToolSearch calls. Neither invokes the repository plugin.

PREDICTION before the initial live probe: direct MCP without ToolSearch,
a successful typed malformed-patch refusal, three protected denials and one
source write. ACTUAL: first host exit 0, eight turns, seven tool calls
(three Reads, four Writes), four hook responses, **zero MCP calls**, zero Task
calls. Three denials and one source allowance were observed. The initial
explanation that the explicit `--tools` restriction caused the missing MCP
surface was provisional; the unrestricted retry demonstrates the schema error.
That restriction's separate causal effect was not established.

The corrective boundary probe requested exactly one `cadence_apply({})` call,
without loading, searching, repairing, dispatching or changing files. Its
prediction of a typed refusal was restated after process launch and before
result inspection, so it is not counted as a prediction-first Verify pass.
ACTUAL: host exit 0, one turn, zero tool calls. Host exit 0 is not a UAT pass.

**The planned `/cad-execute 6` invocation was not reached.** Neither plan was
dispatched. Stopping at the schema rejection avoids claiming an execution
observation from an unavailable tool surface.

## Blocking host observation

Both host debug streams show a connected stdio transport followed by failed
`tools/list` validation. The unrestricted run records `invalid_value`, expected
`object`, at exactly these paths:

| Advertised schema | Root `type` on raw wire | Host result |
|---|---|---|
| `cadence_version.inputSchema` | `object` | No error at this path |
| `cadence_version.outputSchema` | absent | Rejected |
| `cadence_query.inputSchema` | absent | Rejected |
| `cadence_query.outputSchema` | absent | Rejected |
| `cadence_apply.inputSchema` | `object` | No error at this path |
| `cadence_apply.outputSchema` | absent | Rejected |

Host retries at 250, 500 and 1000 milliseconds do not resolve the error. The
unrestricted host init advertises zero `mcp__cadence__*` tools. The model makes
no boundary call. Raw diagnostic `initialize` and `tools/list` requests against
a separate direct binary child independently confirm the three names and
exactly four missing root types. This is schema inspection, not a substitute
host dispatch or model-compliance result.

PREDICTION before the diagnostic: exactly those four absent types and exit 0.
ACTUAL: three names, four absent types, diagnostic server exit 0; no execution
request sent. Full raw schema response is `evidence/raw-tools-list.json`.
The affected producer is `crates/cadence/src/server.rs`, especially `tool()` and
`PublicServer::list_tools`; that file is outside Tasks 5–6's remaining lease.
A continuation needs permission to repair that producer and add a regression
check for the host-required root schema shape. No schema was patched here.

## Process observations

| Run | Host PID | Rust server PID | Result |
|---|---:|---:|---|
| Guard/preflight | 2592420 | 2592479 | Host exit 0; direct server startup; schema listing rejected |
| Unrestricted boundary probe | 2592982 | 2593019 | Host exit 0; direct server startup; schema listing rejected |
| Raw schema diagnostic | none | 2594652 | Direct stdio inspection; exit 0 |

These are distinct processes, but **not replacement between plan dispatches**.
Neither execution-plan dispatch occurred; no MCP process was intentionally
terminated after an accepted patch. The two hosts closed their own servers on
normal exit. No unrelated process was monitored, killed or waited upon.
Execution-session resume, outstanding-dispatch preservation in a real host and
intentional replacement evidence remain unverified.

## Actual hook observations and independent inspection

The real model had Write/Edit permission. All four actual mutation attempts used
Write; no live Edit attempt is claimed. Events come from the host's
`--include-hook-events` stream, joined to tool-use IDs and independent file
inspection. Each guard invocation used the direct command
`/code/cadence/target/debug/cadence guard`.

| Target | Tool-use ID | Hook ID | Actual observation |
|---|---|---|---|
| `.planning/state.json` | `toolu_01BrFZiRuEkX6vLJgeg6uSEX` | `99224db1-d3ba-4fb0-85e8-013c50e0dada` | `permissionDecision: deny`, hook exit 0, tool result error |
| `.planning/decisions.jsonl` | `toolu_01SQhPZNdyNRKZa8Zrax74s9` | `07a4bcd6-adf2-4293-baf5-cf66406c6750` | `permissionDecision: deny`, hook exit 0, tool result error |
| `.planning/phases/6/SUMMARY.md` | `toolu_016ngY8f6FmpRpeZYzaQPzm5` | `ee1ba904-547d-4018-859d-aa7de3368f5d` | `permissionDecision: deny`, hook exit 0, tool result error |
| `src/probe.txt` | `toolu_01QTj4R8rffoZMGu29DJcYq2` | `b564e8de-43d6-4462-863e-750dfd50c0f7` | Empty hook stdout/stderr, exit 0; host Write succeeds; file exists |

Each denial's actual reason has the shape `Cadence owns <absolute target>; use
the native execution boundary instead of Write/Edit`. The source case is
permission passthrough plus a successful host write, not an explicit JSON
`allow` response. No claim grades its content.

Independent inspection (`evidence/independent-inspection.json`) found all three
protected targets absent before and after the Write attempts; `src/probe.txt`
exists at 12 bytes, SHA-256
`8492103428ce00fc6d84bd1b91078ddbfa61db4c2569efe2222b600c1d371434`.
Git status is clean, HEAD is still the signed baseline, and the number of new
task commits is exactly zero. `src/lib.rs` is unchanged against that baseline.
Native `state.json`, `decisions.jsonl` and phase `SUMMARY.md` are absent. There
are **no observed decision IDs, dispatch IDs, accepted patch IDs or task SHAs**.
The separate authorization helper was never applied.

## Live checklist and limits

| Obligation | Outcome |
|---|---|
| Actual host and real model access | Observed |
| Direct binary stdio startup and direct Rust guard registration | Observed |
| Copied skill/agent byte identity, two native plans and shared lease | Observed setup only |
| No ToolSearch preamble | Observed zero ToolSearch calls; no successful pre-load call |
| Pre-load MCP call success and malformed-patch refusal | Blocked by host schema rejection |
| Actual `/cad-execute 6` invocation | Unverified; not reached |
| Real fixed-executor Task invocation with exact returned prompt | Unverified; zero Task calls |
| Executor source mutation and dispatched verify/suite tool calls | Unverified; none occurred |
| One signed ordered task commit per task | Unverified; zero task commits |
| Field-for-field patch return/apply and accepted calls | Unverified; zero calls |
| Decisions and exact SUMMARY task/full-SHA shape | Unverified; files absent |
| Intentional server replacement between plans and host resume | Unverified; not attempted |
| Three protected Write denials and one authorized source write | Observed, with actual hook output and independent file checks |
| Protected Edit behavior in the live host | Unverified; no Edit call occurred |
| Compaction before/after and never-loaded control | Not observed; causal conclusion INCONCLUSIVE |

AC3 is unverified. AC7 has the Write observations above; the complete host and
executor criterion, and live Edit behavior, remain unverified. Deterministic
passes from Tasks 1–4 do not fill these gaps. No assertion evaluates source
quality, test output, model deviation/blocker prose or compaction causality.

OQ-1 retains D-25's no-preamble ruling; this failed startup adds no evidence of
direct callability. OQ-2 remains non-decision-bearing under the existing failed
negative control. No real compaction occurred in either host stream, so there
is no before/after observation or new causal conclusion. Phase 7–9 rails and
phase 11 attempt history, checkpoints, general SUMMARY/task/lease behavior
remain unimplemented by this slice.

## Closing checks and Task 6 status

PREDICTION before static checks: clippy, fmt and TypeScript exit 0. ACTUAL:

- `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings`: exit 0.
- `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check`: exit 0.
- `TMPDIR=/tmp npx tsc -p tsconfig.ci.json </dev/null`: exit 0.

The native UAT was stopped at its blocker, as required. No full Cargo or Node
suite was run in this dispatch, and no Task 6 completion or acceptance map is
claimed. In particular, **`TMPDIR=/tmp node --test` versus the known-16 list is
unverified here**; D-29 is applied as instructed and none of those expected
failures was repaired or reclassified. No seventeenth failure or disappearing
known failure is claimed without a run. Protected-file and signing checks for
the partial observation commit are recorded in the appended plan report.
