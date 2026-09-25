# Phase 11 plan check

Checked on 2026-09-09 against branch `cadence/binary-owns-process`, HEAD `66027a6726722256f767dbf03f34bf1921585da4`. The plan was an untracked file at the start of this review. This is a review of what executing the plan requires, not a claim that its new implementation or acceptance tests already exist. No cargo command was run; no plan or source was edited; no commit was made.

Read `docs/architecture/acceptance.md` first, then `/claude/.claude/plugins/cache/cadence/cadence/3.7.12/skills/cad-plan-checker-contract/SKILL.md`, then phase 11 CONTEXT before PLAN. Independently derived obligations were: approved publication of the exact truths and decisions; structural authoring refusals; observability attestation refusal; fixed-oracle attestation refusal; the seven-truth limit; scoped identity collision refusal; and unchanged persistence without approval. These follow from `.planning/phases/11/CONTEXT.md:13`, `.planning/phases/11/CONTEXT.md:37`, and `.planning/phases/11/CONTEXT.md:60`.

No BLOCKER or WARNING findings. All seven requested items pass as plan checks. References below are repository-relative file:line citations unless an absolute path is given.

## 1. Mechanical refusal-point checks

The authoritative truths are T1–T7 at `.planning/phases/11/CONTEXT.md:37`. The plan repeats them at `.planning/phases/11/PLAN.md:36`, lists all seven in `requirements` at `.planning/phases/11/PLAN.md:4`, and binds evidence references to phase 11 version 1 at `.planning/phases/11/PLAN.md:61`.

| Truth | Exactly one check | Other attached evidence | Check definition / command |
|---|---|---|---|
| T1 | C1 | A1, A2, A3, O1 | `.planning/phases/11/PLAN.md:100`; command at `.planning/phases/11/PLAN.md:119` |
| T2 | C2 | A4 | `.planning/phases/11/PLAN.md:159`; command at `.planning/phases/11/PLAN.md:174` |
| T3 | C3 | A5 | `.planning/phases/11/PLAN.md:186`; command at `.planning/phases/11/PLAN.md:197` |
| T4 | C4 | A6 | `.planning/phases/11/PLAN.md:207`; command at `.planning/phases/11/PLAN.md:217` |
| T5 | C5 | A7 | `.planning/phases/11/PLAN.md:226`; command at `.planning/phases/11/PLAN.md:235` |
| T6 | C6 | A8 | `.planning/phases/11/PLAN.md:244`; command at `.planning/phases/11/PLAN.md:260` |
| T7 | C7 | A3, A9, O1 | `.planning/phases/11/PLAN.md:271`; command at `.planning/phases/11/PLAN.md:286` |

Every evidence item names an existing truth, either through its T-number heading or explicit attachment. Artifact definitions are at `.planning/phases/11/PLAN.md:122`, `.planning/phases/11/PLAN.md:132`, `.planning/phases/11/PLAN.md:138`, `.planning/phases/11/PLAN.md:177`, `.planning/phases/11/PLAN.md:200`, `.planning/phases/11/PLAN.md:219`, `.planning/phases/11/PLAN.md:238`, `.planning/phases/11/PLAN.md:263`, and `.planning/phases/11/PLAN.md:289`. O1 is at `.planning/phases/11/PLAN.md:146`. The T7 cross-references at `.planning/phases/11/PLAN.md:295` attach existing items; they do not create additional checks.

Every check names its new test function, setup, public call, and expected result. The shared test file is explicitly `crates/cadence/tests/phase11_context.rs` at `.planning/phases/11/PLAN.md:68`. Each cited command has the form `cargo test -p cadence --test phase11_context <the named function> -- --exact`. The expected command result is explicitly `1 passed; 0 failed`, with zero selected tests rejected, at `.planning/phases/11/PLAN.md:85`. Per-check behavioral expectations appear at `.planning/phases/11/PLAN.md:109`, `.planning/phases/11/PLAN.md:167`, `.planning/phases/11/PLAN.md:191`, `.planning/phases/11/PLAN.md:212`, `.planning/phases/11/PLAN.md:229`, `.planning/phases/11/PLAN.md:253`, and `.planning/phases/11/PLAN.md:278`.

There are **no link items**, explicitly stated at `.planning/phases/11/PLAN.md:300`. No truth requires a distinct collaborator handoff: T1 names the published truths and decisions in CONTEXT, T7 names unchanged persisted context, and T2–T6 name caller-visible refusals. C1 observes the actual destination. An internal service-to-writer handoff is not an additional promise in any truth's text and does not need a link spy under `docs/architecture/acceptance.md:158` and `docs/architecture/acceptance.md:171`.

Across the design's four lifecycle refusal points (`docs/architecture/acceptance.md:257`): authoring is delivered by Tasks 3–7; the planning evidence satisfies the mechanical map rules above; actual red/green records are future executor work explicitly required at `.planning/phases/11/PLAN.md:520`, and checks may not fake their subjects at `.planning/phases/11/PLAN.md:75`; verdict processing is not implemented or claimed here. The plan expressly excludes later evidence/verdict layers at `.planning/phases/11/PLAN.md:554`, consistent with `.planning/phases/11/CONTEXT.md:23`. Their absence from phase 11 is not a missing phase-11 task.

**PASS** — seven truths, seven checks, no orphan evidence, complete command/expected-result specifications, and no required link omitted (`.planning/phases/11/PLAN.md:59`; `docs/architecture/acceptance.md:147`).

## 2. Trigger, outcome, real boundary and falsifiability

The common setup starts the actual `cadence serve --project-root <temporary-project>` process, initializes MCP, and calls context authoring through `cadence_apply`; intake goes through `cadence_query` (`.planning/phases/11/PLAN.md:68`). Public decoding, service, resident, policy, writer, transaction and filesystem must remain real. Expectations are handwritten, not obtained from the validator or renderer (`.planning/phases/11/PLAN.md:75`, `.planning/phases/11/PLAN.md:81`). The existing reference client does launch the binary at `crates/cadence/tests/mcp.rs:45`, isolates global config at `crates/cadence/tests/mcp.rs:52`, and closes stdin and waits at `crates/cadence/tests/mcp.rs:135`.

For every persistence assertion, the plan requires process exit, discarded handles, reopened CONTEXT/JSONL/snapshot paths and tree-membership comparison before the final assertion. C1 additionally reopens the real Store. Absent-store and pending-intent cases deliberately use read-only file reopen so observation itself cannot create or recover state (`.planning/phases/11/PLAN.md:88`). This distinction is justified by `Filesystem::new` creating directories at `crates/cadence/src/store/filesystem.rs:55` and writer startup invoking recovery at `crates/cadence/src/store/writer.rs:280`.

| Check | Trigger and observed outcome | Concrete behavior that would fail it |
|---|---|---|
| C1 | Approve valid sets of 1–7 truths, both kinds and all verbs, with decisions and authored prose; inspect exact sentences, decisions and approval records after filesystem/store reopen (`.planning/phases/11/PLAN.md:100`). | Drop decisions, substitute fixed prose, change ordering/content, omit version/kind/status or approval evidence, or return success without eventual publication. |
| C2 | Submit one structural fault per row, with and without approval; require successful MCP responses carrying a typed refusal with the actual rule, slot and affected entry (`.planning/phases/11/PLAN.md:159`). | Skip a structural rule, erase slot identity, or fall through to generic execution refusal/MCP argument error. |
| C3 | Submit an internal outcome with `observable` absent/false; require unobservable refusal and no publication; the same text with true attestation is a draft control (`.planning/phases/11/PLAN.md:186`). | Default missing attestation to true, ignore false, or apply an internal-name classifier despite true attestation. |
| C4 | Submit a model-prose oracle with `fixed_oracle` absent/false; require prose-oracle refusal and unchanged files; true attestation is a draft control (`.planning/phases/11/PLAN.md:207`). | Default/ignore the attestation, conflate it with `observable`, or replace it with keyword classification. |
| C5 | Submit eight individually valid truths with approval; require refusal containing `split the phase`, with seven as a draft control (`.planning/phases/11/PLAN.md:226`). | Accept or silently truncate eight, omit the required message, or also refuse the valid boundary control. |
| C6 | Submit repeated full IDs within/between truth and decision sections and reuse committed identity after restart; require collision details and preserve the winner; another phase and distinct full IDs are controls (`.planning/phases/11/PLAN.md:244`). | Overwrite the winner, check only the current request, split decision-section identity scopes, or incorrectly enforce project-global uniqueness. |
| C7 | Query intake, submit corrected unapproved/declined drafts or incomplete approval, and end the session; require unchanged bytes and tree membership, including absent paths and retained intent (`.planning/phases/11/PLAN.md:271`). | Acquire a writer/recover/log/create files during authoring, or implement no supported draft operation: unknown-tool/invalid-operation is explicitly disallowed as a passing result. |

No check substitutes a fake, helper or internal service call for its promised public operation. Each has an observable failure condition. C3 and C4 test T3/T4 as qualified by D-79's recorded owner refusal, not a nonexistent semantic classifier (`.planning/phases/11/CONTEXT.md:52`, `.planning/phases/11/CONTEXT.md:66`). Artifact A2 additionally requires inspection of synchronization, confirmation and recovery; a successful reopen alone is not proof of crash durability (`.planning/phases/11/PLAN.md:132`). No tests were executed in this review.

**PASS** — C1–C7 drive their truth's trigger and observe its outcome at the required real boundary (`.planning/phases/11/PLAN.md:68`, `.planning/phases/11/PLAN.md:88`).

## 3. D-79 delivery and scope

D-79's source is `.planning/phases/11/CONTEXT.md:60`.

| D-79 obligation | Implementing task and evidence |
|---|---|
| Typed `trigger`, `observer`, `verb`, `outcome`, `kind`; three verbs and two kinds | Task 1 models slots at `.planning/phases/11/PLAN.md:321`; Task 3 validates values and retains individual slot failures at `.planning/phases/11/PLAN.md:391`; C1/C2 exercise them. |
| Binary renders the sentence | Task 2 fixes rendering order and rejects a separately supplied final sentence as authority at `.planning/phases/11/PLAN.md:350`; C1 uses handwritten sentences. |
| Trigger containing literal ` or ` refused | Task 3 at `.planning/phases/11/PLAN.md:392`; C2 at `.planning/phases/11/PLAN.md:161`. |
| Second observer refused mechanically | Task 3 specifies documented conjunction/list separators at `.planning/phases/11/PLAN.md:393`; C2 exercises conjunction and list forms at `.planning/phases/11/PLAN.md:164`. |
| Verb outside the three refused | Task 3 at `.planning/phases/11/PLAN.md:391`; C2 at `.planning/phases/11/PLAN.md:161`. |
| Empty slot refused | Task 3 requires nonblank slots and preserves decoder errors at `.planning/phases/11/PLAN.md:391`; C2 includes absent, empty and whitespace-only slots and invalid/missing kind at `.planning/phases/11/PLAN.md:162`. |
| More than seven refused with `split the phase` | Task 6 at `.planning/phases/11/PLAN.md:441`; C5 at `.planning/phases/11/PLAN.md:226`. |
| Truth or decision ID reused in scope refused | Task 7 checks full IDs across all submitted truth/decision entries and native approved phase records at `.planning/phases/11/PLAN.md:456`; C6 includes restart and cross-phase controls. |
| `observable` absent or false refused, rule named | Task 4 at `.planning/phases/11/PLAN.md:413`; C3 at `.planning/phases/11/PLAN.md:186`. |
| `fixed_oracle` absent or false refused, rule named | Task 5 at `.planning/phases/11/PLAN.md:428`; C4 at `.planning/phases/11/PLAN.md:207`. |
| Approval record holds who attested and when | Task 2 stores the owner identity/time, both attestations per truth, decisions and exact approved set at `.planning/phases/11/PLAN.md:354`; A1 at `.planning/phases/11/PLAN.md:128`; C1 at `.planning/phases/11/PLAN.md:113`. |

No D-79 obligation lacks a delivering task. The observer separator syntax is the documented mechanical interpretation required by D-79, not a third semantic attestation; the plan says so at `.planning/phases/11/PLAN.md:536`. Phase-local full identity scope is stated at `.planning/phases/11/PLAN.md:529`; one decision sequence across the durable/local headings is grounded in `cadence-core/templates/CONTEXT.md:23`. No project-global allocator, internal-name heuristic, prose-oracle classifier, extra attestation or outcome-language classifier is delivered (`.planning/phases/11/PLAN.md:397`, `.planning/phases/11/PLAN.md:418`, `.planning/phases/11/PLAN.md:432`, `.planning/phases/11/PLAN.md:469`).

Tasks do deliver things not individually requested by D-79, but all have another explicit phase obligation:

- Task 1's read-only intake, approval barrier and resident registration deliver T7 and the nothing-before-approval boundary (`.planning/phases/11/CONTEXT.md:13`; `.planning/phases/11/PLAN.md:316`).
- Task 2's authored Markdown renderer, version-1/pending truth records, transaction participant, confirmation and recovery deliver T1 and the carried persistence decisions (`.planning/phases/11/CONTEXT.md:88`, `.planning/phases/11/CONTEXT.md:107`, `.planning/phases/11/CONTEXT.md:129`; `.planning/phases/11/PLAN.md:348`).
- Task 8's compiled context-role instructions and generated host skill deliver the compiled-instruction decision and support T1/T7/O1 (`.planning/phases/11/CONTEXT.md:82`; `.planning/phases/11/PLAN.md:481`).
- The seven acceptance checks and red/green records implement the acceptance design's planning/execution discipline (`docs/architecture/acceptance.md:147`, `docs/architecture/acceptance.md:199`; `.planning/phases/11/PLAN.md:520`).

Coverage, task completeness, sequencing, goal-backward delivery, scope and proportionality were reviewed. Tasks 1–2 establish the public path and publication, Tasks 3–7 add independently failing refusal cases, and Task 8 integrates those completed contracts into instructions (`.planning/phases/11/PLAN.md:307`, `.planning/phases/11/PLAN.md:475`, `.planning/phases/11/PLAN.md:514`). Each task has exact files, directives and falsifiable verification; Task 8 also names artifact inspection. No task invents a new production identifier beyond design-required record fields: names are explicitly left to the executor at `.planning/phases/11/PLAN.md:62`. There are eight sequential tasks; the dispatch supplied no task ceiling, so none was assumed. No compound task hiding unrelated delivery, self-policing tooling, or unneeded scope was found.

**PASS** — all D-79 requirements are delivered; additional work is supported by T1/T7 and carried design decisions (`.planning/phases/11/CONTEXT.md:60`; `.planning/phases/11/PLAN.md:305`).

## 4. Existing claims versus new work

Every named existing source seam was located; the final Symbols table gives individual anchors. No false existing-symbol claim was found.

The material behavioral claims are also supported:

- The MCP adapter binds the canonical project to `.planning` at `crates/cadence/src/server.rs:382`; actual public query/apply dispatch starts at `crates/cadence/src/server.rs:582` and `crates/cadence/src/server.rs:743`. The raw review branch precedes the generic apply decoder at `crates/cadence/src/server.rs:744`, matching the proposed context branch's reference pattern.
- The resident request/reply seam is real: review request at `crates/cadence/src/recall/mod.rs:206`, mailbox arm at `crates/cadence/src/recall/mod.rs:394`, method at `crates/cadence/src/recall/mod.rs:523`.
- Factory construction performs no I/O; read-only observation and first-touch initialization are distinct at `crates/cadence/src/import/mod.rs:682`, `crates/cadence/src/import/mod.rs:720`, and `crates/cadence/src/import/mod.rs:844`. The plan's explicit approval barrier is needed.
- Snapshot extension and conditional commit exist at `crates/cadence/src/store/model.rs:115`, `crates/cadence/src/review/persistence.rs:55`, and `crates/cadence/src/review/persistence.rs:82`. The writer checks generation/integrity and recognizes exact operation receipts at `crates/cadence/src/store/writer.rs:495` and `crates/cadence/src/store/writer.rs:505`.
- The current writer external allowlist is config-only at `crates/cadence/src/store/writer.rs:557`. Intent validation allows store/config/summary targets, not a CONTEXT participant, at `crates/cadence/src/store/transaction.rs:151`. Task 2 explicitly changes both leased files; the plan does not claim CONTEXT transactions already exist.
- Summary target resolution, safe directory creation, sync, installation and confirmation exist at `crates/cadence/src/store/filesystem.rs:101`, `crates/cadence/src/store/filesystem.rs:164`, `crates/cadence/src/store/filesystem.rs:317`, `crates/cadence/src/store/filesystem.rs:355`, and `crates/cadence/src/store/filesystem.rs:373`.
- Exact durable/local headings affect recall at `crates/cadence/src/recall/documents.rs:199` and `crates/cadence/src/recall/documents.rs:229`. `PhaseObservation` has plans, summary and UAT, without CONTEXT, at `crates/cadence/src/derivation/model.rs:112`. Existing `native_evidence` is routing facts, not the new acceptance map, at `crates/cadence/src/evidence/mod.rs:1` and `crates/cadence/src/evidence/mod.rs:46`.
- The current skill still loads the frozen context workflow at `skills/cad-context/SKILL.md:26`. The workflow's named steps and the template exist; Task 8 replaces that instruction source rather than pretending the binary-owned context role is already available.

The context service, context module files, typed context/approval/truth records, context query/apply branches, context transaction target, compiled context instructions and seven acceptance functions are **new**. Their absence is consistent with the creation leases and explicit status statement at `.planning/phases/11/PLAN.md:62`.

**PASS** — all existing claims are confirmed; all planned additions remain classified as new (`.planning/phases/11/PLAN.md:539`; Symbols below).

## 5. File lease

The frontmatter leases 16 exact files at `.planning/phases/11/PLAN.md:5`. A mechanical comparison of each task's Files list found no path outside it:

| Task | Task file-list anchor | Declared paths | Outside the lease |
|---|---|---:|---|
| 1 | `.planning/phases/11/PLAN.md:309` | 7 | None |
| 2 | `.planning/phases/11/PLAN.md:338` | 9 | None |
| 3 | `.planning/phases/11/PLAN.md:382` | 6 | None |
| 4 | `.planning/phases/11/PLAN.md:410` | 3 | None |
| 5 | `.planning/phases/11/PLAN.md:425` | 3 | None |
| 6 | `.planning/phases/11/PLAN.md:439` | 2 | None |
| 7 | `.planning/phases/11/PLAN.md:452` | 4 | None |
| 8 | `.planning/phases/11/PLAN.md:477` | 4 | None |

Tracing actions against the tree finds no necessary additional source write. New library registration is covered by `lib.rs`; public/service/mailbox registration by `server.rs` and `recall/mod.rs`; rendering entrypoint by `main.rs`; all transaction participant changes by the three store files. The schema extension can use a context-specific output type in leased files, as Task 3 directs, without changing `Envelope` and all its constructors (`.planning/phases/11/PLAN.md:398`; `crates/cadence/src/server.rs:272`; `crates/cadence/src/envelope.rs:47`). Missing parent handling can be implemented in the leased filesystem file rather than requiring an import-module change (`.planning/phases/11/PLAN.md:364`; `crates/cadence/src/store/filesystem.rs:164`).

The generated `skills/cad-context/SKILL.md` is leased. The reference MCP client, frozen workflow/template, and earlier CONTEXT are read-only references, not planned edits (`.planning/phases/11/PLAN.md:69`, `.planning/phases/11/PLAN.md:548`). Test publication writes occur in temporary projects (`.planning/phases/11/PLAN.md:71`), not the checked-in phase CONTEXT. Red/green may be returned in the executor patch; the plan does not require a new checked-in report file (`.planning/phases/11/PLAN.md:520`). This checker report is separately authorized by the dispatch.

No dependency change is planned (`.planning/phases/11/PLAN.md:562`); existing serialization, schema, runtime and temporary-project dependencies are already declared at `crates/cadence/Cargo.toml:21` and `crates/cadence/Cargo.toml:64`. No task requires a manifest or lockfile edit.

**PASS** — every task's writes are covered; no task must write outside the 16-file lease (`.planning/phases/11/PLAN.md:5`).

## 6. Carried decisions

| Carried decision | Plan delivery and code evidence |
|---|---|
| Write, confirm, return | Task 2 explicitly requires temporary-file sync, rename, directory sync, byte confirmation, final snapshot and intent removal before `ok` (`.planning/phases/11/PLAN.md:369`). These stages exist at `crates/cadence/src/store/filesystem.rs:337`, `crates/cadence/src/store/filesystem.rs:355`, `crates/cadence/src/store/filesystem.rs:373`, and `crates/cadence/src/store/transaction.rs:865`. Writer persist returns only after transaction completion (`crates/cadence/src/store/writer.rs:1276`). A2 inspection carries the protocol obligation, while C1 checks reopened publication. |
| CONTEXT remains authored Markdown for people | Task 1 accepts authored context sections; Task 2 preserves approved prose/citations and renders human-readable sections (`.planning/phases/11/PLAN.md:321`, `.planning/phases/11/PLAN.md:360`). C1 deliberately varies Markdown and non-ASCII decision prose to reject a fixed template (`.planning/phases/11/PLAN.md:104`). JSON stores the binary-owned truth/approval records alongside that document, as CONTEXT requires at `.planning/phases/11/CONTEXT.md:107`. |
| No refuse-to-start guard | Explicitly prohibited in Task 1 at `.planning/phases/11/PLAN.md:332`. Read-only context requests avoid writer ownership, matching the current lazy factory seam (`crates/cadence/src/import/mod.rs:682`). |
| Version 1 only | A1 and Task 2 require version 1 and initial `pending`, with no status-transition or revision operation (`.planning/phases/11/PLAN.md:125`, `.planning/phases/11/PLAN.md:353`, `.planning/phases/11/PLAN.md:374`). This honors the deliberate deferral to phase 26, rather than silently reducing scope (`.planning/phases/11/CONTEXT.md:29`). |
| Nothing on disk before approval | Task 1 forbids tokens, directory/config/store creation, recovery, write ownership, refusal logs and STATE mutation before the approval barrier (`.planning/phases/11/PLAN.md:320`). Task 3 validates even approved malformed submissions before `first_touch` (`.planning/phases/11/PLAN.md:389`); Tasks 4–7 extend that path. C7 checks intermediate boundaries, exit, absent paths and retained intent (`.planning/phases/11/PLAN.md:271`). |
| Instructions compiled into the binary; no user override | Task 8 compiles the interview, real public contract, attestations, exact-set approval and refusal handling, then renders the host skill (`.planning/phases/11/PLAN.md:481`). No release override is permitted (`.planning/phases/11/PLAN.md:497`). |
| Acknowledge the untestable live model/host behavior | O1 remains visible with observer/date and concerns cap; live conversation, host loading and attestation quality are knowingly untested (`.planning/phases/11/PLAN.md:146`, `.planning/phases/11/PLAN.md:559`). |

The new CONTEXT participant is explicitly within scope (`.planning/phases/11/CONTEXT.md:129`), and the plan does not add a cursor source or require approved truths before planning (`.planning/phases/11/PLAN.md:554`). The old workflow's gates, STATE mutation and commit sequence are explicitly excluded at `.planning/phases/11/PLAN.md:548`.

**PASS** — none of the carried decisions is contradicted (`.planning/phases/11/CONTEXT.md:75`; `.planning/phases/11/PLAN.md:316`, `.planning/phases/11/PLAN.md:348`, `.planning/phases/11/PLAN.md:481`).

## 7. O1 attachment

The owner-authored observation is at `.planning/phases/11/CONTEXT.md:116`. The plan includes it as **O1 — observation (T1, T7)** at `.planning/phases/11/PLAN.md:146`, with actual observer/date/seen provenance and no invented execution record. It explicitly caps both truths at `concerns`, even when seen, at `.planning/phases/11/PLAN.md:152`.

T7's attachment at `.planning/phases/11/PLAN.md:297` refers to the same O1. No O1 reference attaches it to T2–T6 or to C1–C7. Task 8 carries O1 but separates artifact inspection and the reused C7 run from live observation at `.planning/phases/11/PLAN.md:502` and `.planning/phases/11/PLAN.md:504`. The rendered skill Markdown is expressly not a check subject (`.planning/phases/11/PLAN.md:143`).

**PASS** — O1 is one observation, attached to T1 and T7 only and to no check (`.planning/phases/11/PLAN.md:146`, `.planning/phases/11/PLAN.md:297`).

## Symbols

`NOT FOUND` for a **new** row means the expected addition is absent at the reviewed HEAD, not a false existing claim. New production names/operation tags are deliberately unspecified. Design field names are required record contracts, not claims of implemented Rust types. Runtime filename constants confirm the existing store paths; hypothetical temporary-project output files are not asserted to exist in this checkout.

| Symbol / path / record | Claimed status | Confirmed at file:line or NOT FOUND |
|---|---|---|
| `crates/cadence/src/lib.rs` | exists | `crates/cadence/src/lib.rs:1` |
| `crates/cadence/src/main.rs` | exists | `crates/cadence/src/main.rs:1` |
| `crates/cadence/src/server.rs` | exists | `crates/cadence/src/server.rs:28` |
| `crates/cadence/src/recall/mod.rs` | exists | `crates/cadence/src/recall/mod.rs:18` |
| `crates/cadence/src/store/transaction.rs` | exists | `crates/cadence/src/store/transaction.rs:1` |
| `crates/cadence/src/store/writer.rs` | exists | `crates/cadence/src/store/writer.rs:1` |
| `crates/cadence/src/store/filesystem.rs` | exists | `crates/cadence/src/store/filesystem.rs:1` |
| `crates/cadence/tests/mcp.rs` | exists | `crates/cadence/tests/mcp.rs:1` |
| `Client` | exists | `crates/cadence/tests/mcp.rs:25` |
| `isolated_client` | exists | `crates/cadence/tests/mcp.rs:498` |
| `envelope` test helper | exists | `crates/cadence/tests/mcp.rs:488` |
| MCP client global-config isolation | exists | `crates/cadence/tests/mcp.rs:52` |
| `cadence serve --project-root` entrypoint | exists | `crates/cadence/src/main.rs:22`; `crates/cadence/src/main.rs:28`; `crates/cadence/src/main.rs:56` |
| `cadence_query` public tool | exists | `crates/cadence/src/server.rs:582` |
| `cadence_apply` public tool | exists | `crates/cadence/src/server.rs:743` |
| `PublicServer` | exists | `crates/cadence/src/server.rs:392` |
| `PublicServer::call_tool` | exists | `crates/cadence/src/server.rs:560` |
| Root-bound adapter / `bind_project` | exists | `crates/cadence/src/server.rs:382` |
| `QueryArguments` | exists | `crates/cadence/src/server.rs:232` |
| `ApplyArguments` | exists | `crates/cadence/src/server.rs:262` |
| `query_schema` | exists | `crates/cadence/src/server.rs:352` |
| `apply_schema` | exists | `crates/cadence/src/server.rs:377` |
| `Resident` | exists | `crates/cadence/src/recall/mod.rs:179`; `crates/cadence/src/recall/mod.rs:275` |
| `Resident::review` | exists | `crates/cadence/src/recall/mod.rs:523` |
| Resident review request / mailbox arm | exists | `crates/cadence/src/recall/mod.rs:206`; `crates/cadence/src/recall/mod.rs:394` |
| `SessionFactory` | exists | `crates/cadence/src/import/mod.rs:684` |
| `SessionFactory::first_touch` / `first_touch` | exists | `crates/cadence/src/import/mod.rs:844` |
| `observe_config` read-only pattern | exists | `crates/cadence/src/import/mod.rs:720` |
| `Store` | exists | `crates/cadence/src/store/writer.rs:129` |
| `Store::open` | exists | `crates/cadence/src/store/writer.rs:134` |
| `Writer` | exists | `crates/cadence/src/store/writer.rs:269` |
| `Writer::execute_store` | exists | `crates/cadence/src/store/writer.rs:453` |
| Writer config-only external allowlist | exists | `crates/cadence/src/store/writer.rs:557` |
| `Writer::persist` | exists | `crates/cadence/src/store/writer.rs:1250` |
| `Operation::CompareTransact` / `CompareTransact` | exists | `crates/cadence/src/store/writer.rs:82` |
| Conditional generation/integrity precondition | exists | `crates/cadence/src/store/writer.rs:505` |
| Exact-operation durable receipt | exists | `crates/cadence/src/store/model.rs:116`; `crates/cadence/src/store/writer.rs:495` |
| `Snapshot` / `Snapshot.data` | exists | `crates/cadence/src/store/model.rs:110`; `crates/cadence/src/store/model.rs:115` |
| Real snapshot record reader / validation | exists | `crates/cadence/src/store/model.rs:164`; `crates/cadence/src/store/model.rs:151` |
| `items.jsonl` | exists | `crates/cadence/src/store/model.rs:9` |
| `decisions.jsonl` | exists | `crates/cadence/src/store/model.rs:10` |
| `state.json` | exists | `crates/cadence/src/store/model.rs:11` |
| Pending intent `.store-intent.json` | exists | `crates/cadence/src/store/transaction.rs:9` |
| `ExternalChange` | exists | `crates/cadence/src/store/transaction.rs:80` |
| `Intent` / `Intent::validate` | exists | `crates/cadence/src/store/transaction.rs:131`; `crates/cadence/src/store/transaction.rs:147` |
| Intent store/config/summary allowlist | exists | `crates/cadence/src/store/transaction.rs:151` |
| `transaction::commit` / transaction `commit` | exists | `crates/cadence/src/store/transaction.rs:791` |
| `transaction::recover` / `recover` | exists | `crates/cadence/src/store/transaction.rs:883` |
| `Filesystem` | exists | `crates/cadence/src/store/filesystem.rs:35` |
| `Filesystem::target` | exists | `crates/cadence/src/store/filesystem.rs:101` |
| `phase_summary_target` | exists | `crates/cadence/src/store/filesystem.rs:198` |
| `ensure_directory` | exists | `crates/cadence/src/store/filesystem.rs:164` |
| Filesystem `prepare` | exists | `crates/cadence/src/store/filesystem.rs:317` |
| Filesystem `install` | exists | `crates/cadence/src/store/filesystem.rs:355` |
| Filesystem `confirm` | exists | `crates/cadence/src/store/filesystem.rs:373` |
| Review persistence `contribute` | exists | `crates/cadence/src/review/persistence.rs:55` |
| Review persistence `commit` | exists | `crates/cadence/src/review/persistence.rs:82` |
| Review JSON namespace | exists | `crates/cadence/src/review/persistence.rs:9` |
| `native_evidence` namespace / routing facts | exists | `crates/cadence/src/evidence/persistence.rs:11`; `crates/cadence/src/evidence/mod.rs:46` |
| `recall::documents::snippets` | exists | `crates/cadence/src/recall/documents.rs:193` |
| Recall `## Durable decisions` / `## Decisions` recognition | exists | `crates/cadence/src/recall/documents.rs:201`; `crates/cadence/src/recall/documents.rs:229` |
| `Envelope`; `ok` / `refused` / `unknown` / `not-applicable`; `code` / `reason` | exists | `crates/cadence/src/envelope.rs:1`; `crates/cadence/src/envelope.rs:42` |
| `Cli` | exists | `crates/cadence/src/main.rs:17` |
| `Command` | exists | `crates/cadence/src/main.rs:26` |
| `run_command` | exists | `crates/cadence/src/main.rs:43` |
| `render_dispatch_prompt` | exists | `crates/cadence/src/execution/render.rs:133` |
| `PhaseObservation` | exists | `crates/cadence/src/derivation/model.rs:112` |
| `skills/cad-context/SKILL.md` / frozen `/cad-context` skill | exists | `skills/cad-context/SKILL.md:1`; `skills/cad-context/SKILL.md:26` |
| `cadence-core/workflows/context.md` | exists | `cadence-core/workflows/context.md:23` |
| Workflow `resolve_phase` | exists | `cadence-core/workflows/context.md:23` |
| Workflow `confirm_decisions` | exists | `cadence-core/workflows/context.md:224` |
| Workflow `write_context` | exists | `cadence-core/workflows/context.md:333` |
| Frozen `criteria-size` command (excluded from implementation) | exists | `cadence-core/bin/planning.mjs:272`; `cadence-core/workflows/context.md:347` |
| `cadence-core/templates/CONTEXT.md` / continuing D-NN sequence | exists | `cadence-core/templates/CONTEXT.md:1`; `cadence-core/templates/CONTEXT.md:25` |
| Phase 10 CONTEXT | exists | `.planning/phases/10/CONTEXT.md:1` |
| Phase 11 CONTEXT; T1–T7; D-79; O1 | exists | `.planning/phases/11/CONTEXT.md:1`; `.planning/phases/11/CONTEXT.md:37`; `.planning/phases/11/CONTEXT.md:60`; `.planning/phases/11/CONTEXT.md:116` |
| Acceptance design / truth record specification | exists | `docs/architecture/acceptance.md:1`; `docs/architecture/acceptance.md:130` |
| `crates/cadence/src/context_service.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:312` |
| `crates/cadence/src/context/mod.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:313` |
| `crates/cadence/src/context/model.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:314` |
| `crates/cadence/src/context/validation.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:384` |
| `crates/cadence/src/context/persistence.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:340` |
| `crates/cadence/src/context/render.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:341` |
| `crates/cadence/src/context/instructions.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:478` |
| `crates/cadence/tests/phase11_context.rs` | new | NOT FOUND — creation at `.planning/phases/11/PLAN.md:315` |
| `phase11_approved_context_persists_truths_and_decisions` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:100` |
| `phase11_sentence_fault_names_rule_and_slot` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:159` |
| `phase11_unobservable_attestation_is_refused` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:186` |
| `phase11_prose_oracle_attestation_is_refused` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:207` |
| `phase11_eighth_truth_requires_phase_split` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:226` |
| `phase11_identity_collision_is_refused` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:244` |
| `phase11_unapproved_context_changes_nothing` | new | NOT FOUND — named at `.planning/phases/11/PLAN.md:271` |
| Typed context submission: `trigger`, `observer`, `verb`, `outcome`, `kind` | new | NOT FOUND — required model at `.planning/phases/11/PLAN.md:321` |
| Per-truth `observable` and `fixed_oracle` attestations | new | NOT FOUND — required at `.planning/phases/11/PLAN.md:200`; `.planning/phases/11/PLAN.md:219` |
| Native `truth { id, phase, version, pattern, text, kind, status }` records | new | NOT FOUND — required at `.planning/phases/11/PLAN.md:125` |
| Dedicated context JSON namespace, context decisions and exact-set approval record with who/when | new | NOT FOUND — required at `.planning/phases/11/PLAN.md:122`; `.planning/phases/11/PLAN.md:354` |
| Context intake/query and authoring/apply operations, schemas, typed rule/slot refusal and resident registration | new | NOT FOUND — required at `.planning/phases/11/PLAN.md:318`; `.planning/phases/11/PLAN.md:398` |
| CONTEXT transaction participant / approved `.planning/phases/<N>/CONTEXT.md` publication | new | NOT FOUND as native participant — required at `.planning/phases/11/PLAN.md:364`; authored Markdown examples already exist above |
| Compiled context-role text, rendering entrypoint and regenerated host skill contents | new | NOT FOUND — required at `.planning/phases/11/PLAN.md:481`; the existing skill file is confirmed separately above |
