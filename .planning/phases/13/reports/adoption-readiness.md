# Phase 13 adoption-readiness report

Mandatory close work under D-130 (P13-CLOSE-READINESS). Not an acceptance-map
item; no observation. Every section names its producer and its subject.
Sections 2 to 5 are the orchestrator's, recorded 2026-09-11. **No section
of this report says the live system is "ready"; section 5 records the
owner's decision.**

## 1. Disposable rehearsal (executor; recorded 2026-09-11)

Procedure: `.planning/phases/13/close/readiness.md`. Regression:

```sh
cargo test -p cadence --test phase13_close phase13_adoption_copy_preserves_history_and_recovers -- --exact
```

Literal result of the recorded run, at rewrite HEAD `8b0717cbc67871eebaba10c336fc1a84cfbab1bf`
plus the uncommitted task-3 test text, binary
`/code/cadence/target/debug/cadence` (SHA-256
`2903c4b788b3d0c4e415aee047eb876f43dc928bba98aaf8dc696cb5aae44b5d`, self-reported
version `3.7.12` linux x86_64): exit 0;
`test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 18.10s`.
Exactly one function selected. No linker retry. The disposable roots below
were removed by their TempDir owners after the run; they are historical
identities, not paths to anything installed.

### 1a. The copied historical tree (subject: an isolated copy, never the live tree)

Source `/code/cadence/.planning`, 518 files, identity
`6abfb945bd89950ea09143ca67b5db2ce16d3cb6e52d39521dd05c2f03d540ad` (SHA-256 of
the sorted path/digest manifest). The copy and the explicit backup both
carried that identity before first touch; the live source carried it again,
unchanged, at the end of the run. The live tree has no native store and
received none.

Classification of the 30 declared phases from the copy's own authority, by
the real binary's `plan-read` (every plan `legacy-input`, every phase
`native_truths_approved: false`, no native publication anywhere):
16 imported, 14 unavailable, 0 native.

| phase | roadmap | classification | legacy plans | unretained historical inputs | UAT document |
|---|---|---|---|---|---|
| 1 | checked | imported | 1 | FINDINGS.json, verifier-findings.json | yes |
| 2 | checked | imported | 1, 2, 3 | - | yes |
| 3 | checked | imported | 1, 2, 3 | - | yes |
| 4 | checked | imported | 1, 2, 3 | - | yes |
| 5 | checked | imported | 1, 2, 3, 4 | - | yes |
| 6 | checked | imported | 1, 2, 3 | FALSIFICATION-3.md, FALSIFICATION.md, known-node-failures.txt | yes |
| 7 | checked | imported | 1, 2, 3, 4 | - | yes |
| 8 | checked | imported | 1, 2, 3, 4, 5, 6 | FINDINGS.json, MANUAL.md, verifier-findings.json | yes |
| 9 | checked | imported | 1, 2, 3, 4, 5, 6, 7, 8, 9 | FINDINGS.json, MANUAL.md, PRUNE.md, verifier-findings.json, verify-plan7.json, verify-plan8.json, verify-plan9.json | yes |
| 10 | checked | imported | 1, 2 | MANUAL.md | no |
| 11 | checked | imported | 1 | - | no |
| 12 | checked | imported | 1, 2, 3, 4 | - | no |
| 13 | open | imported | 1, 2, 3, 4 | close | no |
| 14 | open | unavailable | - | - | no |
| 15 | open | unavailable | - | - | no |
| 16 | open | unavailable | - | - | no |
| 17 | open | unavailable | - | - | no |
| 18 | open | unavailable | - | - | no |
| 19 | open | unavailable | - | - | no |
| 20 | open | unavailable | - | - | no |
| 21 | open | unavailable | - | - | no |
| 22 | open | unavailable | - | - | no |
| 23 | open | unavailable | - | - | no |
| 24 | open | unavailable | - | - | no |
| 25 | open | unavailable | - | - | no |
| 26 | open | unavailable | - | - | no |
| 27 | checked | imported | 1, 2 | - | no |
| 28 | checked | imported | 1, 2 | - | no |
| 29 | checked | imported | 1 | - | no |
| 30 | open | unavailable | - | - | no |

Incompatibilities and limits classified, not converted:

- **No native authority anywhere in the copy.** No phase has an approved
  context, a publication, a typed map, an admission or a red/green receipt;
  none may be invented (D-114). Every plan is `legacy-input`.
- **Root binding.** A native store binds records to its directory identity;
  the copy's store, created at first touch, is bound to the copy's root and
  says nothing about `/code/cadence/.planning`, which stays unbound.
- **Unretained historical inputs** (table above): FINDINGS and
  verifier-findings JSON, MANUAL, PRUNE, FALSIFICATION and live-record
  documents, `verify-plan*.json`, `known-node-failures.txt`, and phase 13's
  `close/` directory. The binary neither reads nor rewrites them; they stayed
  byte-identical through first touch, two writers, three interruptions and
  restore.
- **Human results.** Phases 1 to 9 carry a UAT document. Under D-127 an
  imported UAT is retained verbatim as the caller-owned original only when a
  native human result is first written for that phase; none was written here.
- **Format.** Phases 1, 11 and 29 use a bare `PLAN.md` (plan 1); the others
  `PLAN-N.md`. Legacy plans carry no `execution:` schema or typed map and are
  refused by native admission until published natively.
- **Lifecycle disagreement in the copied history.** `execute-next 13` on the
  copy refused with `state-conflict`:
  `{"source":"ROADMAP.md:377 entry 8","field":"complete","declared":"true","derived":"false"}` -
  the copied ROADMAP declares phase 8 complete and the 4.0 lifecycle derives
  it incomplete from the copied documents. This is recorded as observed and
  repaired by nothing; it is one of the inputs phase 14's adoption decision
  must take as classified history.
- `verify-next 13` on the copy refused `native-approved-truths` (rule, slot
  `context`): no verifier dispatch can be composed from copied prose.
- `verification-audit 13` on the copy answered read-only: 0 traces in phase
  13's scope, 10 rows out of scope (BIN-01, BIN-02, REL-01 on Phase 1; HAR-01,
  HAR-05 on Phase 2; HAR-06, HAR-07 on Phase 17; REL-02, BOT-01, BOT-02 on
  Phase 18), counts met 0, broken 0. REQUIREMENTS.md digest
  `2f66b92857afdda3d0a0c6a45674606a9baf541bcd87e3eb766cf665f19bfe62`,
  ROADMAP.md digest `07e3376db8fc18a8906c82a54f1325e86ab9c2b78fa3d36a53a614f7861c3821`.
- **First touch** created exactly `config.v4.json`, `decisions.jsonl`,
  `items.jsonl`, `state.json` (generation 2) and nothing else; the imported
  snapshot holds no `context`, `plan_publications`, `acceptance_maps` or
  `verification` namespace.
- **One writer.** Two live servers each wrote one config key through the
  same store; both answered ok, the reopened generation advanced to 3, and
  both keys read back effective. The store's exclusive directory lock
  serializes writers.
- **Interruption and recovery.** Three writes were sent and the server
  killed at once each time. Each reopen recovered cleanly: no
  `.store-intent.json` remained, the effective value stayed at the prior
  `xhigh` (no write landed in any of the three), the generation stayed 3, and
  every copied byte was intact. This is the rollback branch of recovery as
  actually observed; the landed branch was not observed in this run.
- **Backup/restore.** The copy was deleted and restored from the backup; the
  restored identity equalled the backup identity
  `6abfb945bd89950ea09143ca67b5db2ce16d3cb6e52d39521dd05c2f03d540ad` and a fresh
  server read it (`plan-read 13`, `native_truths_approved: false`).

Record, verbatim from the run (the `phases` array is the table above and the
audit's `traces`/`out_of_scope` arrays are summarized in the bullet):

```json
{"source_root":"/code/cadence/.planning","source_files":518,"source_identity":"6abfb945bd89950ea09143ca67b5db2ce16d3cb6e52d39521dd05c2f03d540ad","copy_root":"/tmp/.tmpQKxbGm/project/.planning","backup_root":"/tmp/.tmpQKxbGm/backup","backup_identity":"6abfb945bd89950ea09143ca67b5db2ce16d3cb6e52d39521dd05c2f03d540ad","binary":"/code/cadence/target/debug/cadence","version":{"status":"ok","version":"3.7.12","os":"linux","arch":"x86_64"},"classification_counts":{"imported":16,"unavailable":14},"first_touch_created":["config.v4.json","decisions.jsonl","items.jsonl","state.json"],"verify_next":{"status":"refused","code":"invalid-plan","reason":"native approved truths required","rule":"native-approved-truths","slot":"context","phase":13,"entry":null,"id":null},"execute_next":{"status":"refused","code":"state-conflict","rule":null,"reason":"{\"source\":\"ROADMAP.md:377 entry 8\",\"field\":\"complete\",\"declared\":\"true\",\"derived\":\"false\"}"},"audit_counts":{"met":0,"waived":0,"concerns":0,"unmet":0,"pending":0,"broken":0,"out_of_scope":10},"audit_sources":{"requirements":{"path":"REQUIREMENTS.md","available":true,"digest":"2f66b92857afdda3d0a0c6a45674606a9baf541bcd87e3eb766cf665f19bfe62","active":["BIN-01","BIN-02","BOT-01","BOT-02","HAR-01","HAR-05","HAR-06","HAR-07","REL-01","REL-02"],"rows":[{"line":676,"id":"BIN-01","phase":"Phase 1","status":"Complete"},{"line":677,"id":"BIN-02","phase":"Phase 1","status":"Complete"},{"line":678,"id":"REL-01","phase":"Phase 1","status":"Complete"},{"line":679,"id":"REL-02","phase":"Phase 18","status":"Pending"},{"line":680,"id":"BOT-01","phase":"Phase 18","status":"Pending"},{"line":681,"id":"BOT-02","phase":"Phase 18","status":"Pending"},{"line":682,"id":"HAR-01","phase":"Phase 2","status":"Complete"},{"line":683,"id":"HAR-05","phase":"Phase 2","status":"Complete"},{"line":684,"id":"HAR-06","phase":"Phase 17","status":"Deferred"},{"line":685,"id":"HAR-07","phase":"Phase 17","status":"Deferred"}]},"roadmap":{"path":"ROADMAP.md","available":true,"digest":"07e3376db8fc18a8906c82a54f1325e86ab9c2b78fa3d36a53a614f7861c3821","phases":[{"phase":"1","line":369,"checked":true},{"phase":"2","line":370,"checked":true},{"phase":"3","line":371,"checked":true},{"phase":"4","line":372,"checked":true},{"phase":"5","line":373,"checked":true},{"phase":"6","line":374,"checked":true},{"phase":"7","line":375,"checked":true},{"phase":"8","line":376,"checked":true},{"phase":"9","line":377,"checked":true},{"phase":"10","line":378,"checked":true},{"phase":"11","line":379,"checked":true},{"phase":"12","line":380,"checked":true},{"phase":"13","line":381,"checked":false},{"phase":"14","line":382,"checked":false},{"phase":"15","line":383,"checked":false},{"phase":"16","line":384,"checked":false},{"phase":"17","line":385,"checked":false},{"phase":"18","line":386,"checked":false},{"phase":"19","line":387,"checked":false},{"phase":"20","line":388,"checked":false},{"phase":"21","line":389,"checked":false},{"phase":"22","line":390,"checked":false},{"phase":"23","line":391,"checked":false},{"phase":"24","line":392,"checked":false},{"phase":"25","line":393,"checked":false},{"phase":"26","line":394,"checked":false},{"phase":"27","line":395,"checked":true},{"phase":"28","line":396,"checked":true},{"phase":"29","line":397,"checked":true},{"phase":"30","line":398,"checked":false}]}},"import_generation":2,"writers_generation":3,"interruptions":[{"requested":"medium","before":"xhigh","landed":false,"generation":3},{"requested":"high","before":"xhigh","landed":false,"generation":3},{"requested":"low","before":"xhigh","landed":false,"generation":3}]}
```

### 1b. The disposable native demonstration (subject: a separately authored fixture only)

The fixture is `Completed::new()` from `crates/cadence/tests/support/phase13.rs`:
a fresh Git project with two Python subjects, native context approval for
truths `truth/A` and `truth/B`, two plans published with attached typed maps,
one admission covering both, per-plan authorization, dispatch, red then green
commits with observed runs, exact owner Inspection approval, task close,
suite and risk settlement and plan completion - all over real serve/stdio.
On top of that the regression ran `verify-next`, one `verification-run` per
saved check, one complete `verification-submit`, `verification-read`
(counts met 2), `verification-audit` (read-only; REQUIREMENTS.md absent in the
fixture, so its one plan-claimed requirement `T1` reports as
`plan->requirement` broken - an honest result, not a met one) and
`verification-complete` (label `complete`; ROADMAP box checked; readback
`completion.status: complete`). These identities describe that disposable
project and cannot stand in for the seven outer rewrite functions.

```json
{"project":"/tmp/.tmpcR8Vyn","root_binding":"57:18732;57:18731;57:1;36:256;","occurrence":"active-cycle:phase:13","context_digest":"6e50782e7340147d0b5fcdc0d8f88f74c842d5d9293a1c2fec027b9307d3e8af","truths":[{"id":"truth/A","version":1},{"id":"truth/B","version":1}],"publications":[{"plan":1,"publication_request":"two-plans","content_revision":"831e395859ff9b90c5752880d6108bc132baa8567efb87bbfcc45228efedc22d","map_revision":"09ffa62ac192cd42979246158d952701d2a3f81ce25096823a7ed0d97d5d4630"},{"plan":2,"publication_request":"two-plans","content_revision":"af8a45780b6b1fa02dc160c93160e4dcdc0a8293c31932d19138223a25f9489f","map_revision":"022c54e26ca2651d50e4d377743fdebdceeaf35f267ab3243d71329f75340a4a"}],"map_digest":"fadaf08f0e36982a8ae600edf815d477c8200915b4065aab9c8568ffdfcb37b1","admission_digests":["e889f9215c1b47e51c508563143cd9671b55abfb4b219f52b7946bfd07c5642f"],"execution_digest":"8681d101910d8dd2260cf66964e8dc4be82281326aa97705813a52f6e90a9321","source":{"head":"c21dd363b9c82bf93b393a7f2915be1b1fe5237d","tree":"c91c1b1ca1ce5e9999dac1d2f244df1cfb016789","index_digest":"720cbe5a094753465a4def06248418e2ed16138f7245432f5b98d818a73b2710","material_digest":"0b3c81a743e855a8fb4b6518e5172dddd27a5448eef3c4ce5ef34aa7bbf199e4"},"allocation":[{"plan":1,"task":"task-a","checks":[{"id":"check/A","item_revision":"3d87ebe081d1fe6aefc4550865de74cd66d6bf2050aa88d00741fc19950d2069"}]},{"plan":2,"task":"task-b","checks":[{"id":"check/B","item_revision":"5ec93d3bdaa0910f041f4b34e77f55bccd2c467f7071feff28dd71bc8bf2aee7"}]}],"red_green":[{"check":{"id":"check/A","item_revision":"3d87ebe081d1fe6aefc4550865de74cd66d6bf2050aa88d00741fc19950d2069"},"red_commit":"7138306dd301a5faf78193443660df2316a8449d","green_commit":"34840815b88f60e52e86bb6e21a265f3e6521e8b","red_run":"red-1","green_run":"green-1"},{"check":{"id":"check/B","item_revision":"5ec93d3bdaa0910f041f4b34e77f55bccd2c467f7071feff28dd71bc8bf2aee7"},"red_commit":"b4594d57f25097a592016e9b7a82c627ce6c04ad","green_commit":"c21dd363b9c82bf93b393a7f2915be1b1fe5237d","red_run":"red-2","green_run":"green-2"}],"verification_attempt":"72ac2d72d628fa5780c1a37887ac7032bddfabf3f2ce1f71089c1ad8a6e2cd89","verification_runs":["adoption-native-check/A","adoption-native-check/B"],"patch":"adoption-native-patch","completion":"7db66b8e1fba006c7f2e59d6fa059192097f990ad433f812e339e74333c255df","audit_counts":{"met":0,"waived":0,"concerns":0,"unmet":0,"pending":0,"broken":1,"out_of_scope":0},"audit_digest":"98418e9afc9d3c267426207f6092f7be8ecb6b9556560350030c4fafa15367ae","store_generation":39}
```

### 1c. Phase-14 adoption choice (executor's recorded recommendation; the decision is the orchestrator's go/no-go)

- Phase 14 is the first intended native self-hosting phase (D-130, P3).
  Its context and plans are authored through the existing native approval
  path (`context-submit`, `plan-read` preview, `plan-submit`), never imported.
- Prior history (phases 1 to 13, 27 to 29) stays classified as imported
  historical input: readable, unretained where the binary has no record kind
  for it, never a native approval, map or red record. No first touch of the
  live tree happens before the orchestrator's installed close is recorded.
- Native human results go through `verification-human-result` with the phase
  UAT projection; a preexisting UAT.md is retained verbatim as the imported
  original at the first native write for that phase.
- Delivery order is selected explicitly per cycle (this phase's own order
  was 27, 28, 29, 12, 13), never by sorting phase numbers.
- Explicit limits carried forward: missing-return handling and the
  read/subagent-trace hook removal (phase 14, P2); progress/health (phase
  14); installed-model acceptance (phase 18, P1); review edit application
  (phase 30, P4).

## 2. Outer rewrite checks (orchestrator; recorded 2026-09-11)

For each of the seven `crates/cadence/tests/phase13_verification.rs`
functions, record the implementation red and green commits with their P13
task subjects and one independent rerun of the exact saved command at the
final reviewed rewrite revision. The executor-recorded commits are:

| check | red commit | green commit | task |
|---|---|---|---|
| `phase13_dispatch_carries_current_verification_inputs` | `095a30d364d73ed2fe2e259bd9db859330871239` | `79e0ab4ffb9980a5bf17495206cbf8ac200bf604` | P13-1-T2 |
| `phase13_mismatched_verdict_patch_is_refused` | `dedf770c405cd213e88fae840c121c7a9e21bd42` | `e1def106a207e0c86b353a97f6f6cae4ee8056b1` | P13-2-T1 |
| `phase13_report_derives_truth_status_from_every_item` | `f6c2b060f602c0db737f1a977b04242e2f39ed34` | `5082bf2d2758b8d57b1b3649637705b9cd63ba70` | P13-2-T2 |
| `phase13_owner_waiver_is_distinct_from_met` | `7a337777cb1ae690dca36c97dc6f5bb5b1f657e5` | `1589adfbffc0957bb12088ed2379f149bb88ed7c` | P13-3-T1 |
| `phase13_incomplete_verification_cannot_complete_phase` | `b2c1da4e6c93caf9fb623de31ed0651eb302f4d3` | `8588090746b8fbe150c1ab923e52b14dfd5f8d6d` | P13-3-T5 |
| `phase13_review_surface_selects_target_and_intent` | `459c60e3c8b4ba6f94f5e9bdf99ecf5e1c72d415` | `4abb9da55a91cd31269ce39fb596c6d0fd9a58b9` | P13-4-T1 |
| `phase13_audit_reports_broken_verification_traces` | `743967fb653574f887c7749aa37c2d05c2442bc3` | `8b0717cbc67871eebaba10c336fc1a84cfbab1bf` | P13-4-T2 |

Still owed per function, by the orchestrator, labelled orchestrator-observed
implementation and independent rerun records (never native verification-run
receipts): the exact command
`cargo test -p cadence --test phase13_verification <function> -- --exact`,
test file/function and file digest, checkout root, full HEAD and tree, index
and material identity, binary identity, exit disposition, bounded stdout and
stderr with digests, observed selection and count (`1 passed; 0 failed`, one
selected), observer and time. The verifier's item judgments bind to these
same outer identities; the orchestrator records that result with its inputs
and any unresolved limit.

### 2a. Orchestrator-observed independent reruns at the final reviewed revision

Recorded by the orchestrator (John Crenshaw's session) on 2026-09-11T19:30:12Z, host hephaestus, rustc 1.98.1 (48a229cea 2026-09-01) (Arch Linux rust 1:1.98.1-1.1), cargo 1.98.1 (797e8a9bc 2026-08-05) (Arch Linux rust 1:1.98.1-1.1).

Common identities: checkout root `/code/cadence`; HEAD `99126c45fe8e36b244752d059f5ba9ad2d04cd68`; tree `19aa8f2411ff3084003187ad54dcc05f098745ad`; index (git write-tree) `19aa8f2411ff3084003187ad54dcc05f098745ad`; material identity (sha256 of `git diff HEAD` plus the sorted untracked list) `9bfc8a040027669151004c79f2f777188818028cef38a0d33bae0fbb824dde8e`; untracked files at the time: .planning/phases/13/reports/plan-1.md .planning/phases/13/reports/plan-2.md .planning/phases/13/reports/plan-3.md .planning/phases/13/reports/plan-4.md ; test file `crates/cadence/tests/phase13_verification.rs` sha256 `80e5ba6cf3f11436f17b386b8af3439ff1a4a93a64f77fbcb1eeecbc47aafe3e`.

| function | exit | selection | binary sha256 | stdout sha256 | stderr sha256 | finished |
|---|---|---|---|---|---|---|
| `phase13_dispatch_carries_current_verification_inputs` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_dispatch_carries_current_verification_inputs ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `af0d9c0673d892324f76fa28e5d9a6033be94f7ef9ad05afaa949b2d2a6e80d3` | `aae223cc38ffe875686218adc1216e26722073f25dc6b8c883d9c788bd1a67d6` | finished in 7.83s |
| `phase13_mismatched_verdict_patch_is_refused` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_mismatched_verdict_patch_is_refused ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `b0a9444324f1741125c7ab45ed916ea5f0687e9a7c2c9e7927f58ab972d0aa53` | `a1e5cf2ba0cc10b1e662e414fac367994e5fc9bea2d850a953f1ff5429effe63` | finished in 51.99s |
| `phase13_report_derives_truth_status_from_every_item` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_report_derives_truth_status_from_every_item ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `9c297b77f36b44b25a60b75a62e24091149b44c6c36613c84b590a4fe259d8d0` | `a1e5cf2ba0cc10b1e662e414fac367994e5fc9bea2d850a953f1ff5429effe63` | finished in 84.95s |
| `phase13_owner_waiver_is_distinct_from_met` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_owner_waiver_is_distinct_from_met ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `176287f6ad16550f4311c53b7ac557c05752e8359a740710d38b39373204d356` | `f959ad00bad02412b5a97f7e6b9d476aeb776ba8e1f88e9621694f968ec587f8` | finished in 56.28s |
| `phase13_incomplete_verification_cannot_complete_phase` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_incomplete_verification_cannot_complete_phase ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `90706dd3739a1ae67cb682ccf0660e92b5ca1fd0e42350f3f7478de1f5b63187` | `aae223cc38ffe875686218adc1216e26722073f25dc6b8c883d9c788bd1a67d6` | finished in 40.96s |
| `phase13_review_surface_selects_target_and_intent` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_review_surface_selects_target_and_intent ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `da0f9ed8cd9979a6f520f4cfee2bd24db832df80c504d3e84de5d9b0b5ea6bfa` | `a1e5cf2ba0cc10b1e662e414fac367994e5fc9bea2d850a953f1ff5429effe63` | finished in 18.42s |
| `phase13_audit_reports_broken_verification_traces` | 0 | 1 passed; 0 failed, 6 filtered out (`phase13_audit_reports_broken_verification_traces ... ok`) | `79b7cf06f124e0ecf04ffdc1814d515a54c13421cdfe2a25a5259889db5c0e8e` (`target/debug/deps/phase13_verification-88890940e5771de5`) | `df0d9f4fac35fb6d11f70cc2701d60396b1433175ad254f290b8f92da23e00cf` | `a1e5cf2ba0cc10b1e662e414fac367994e5fc9bea2d850a953f1ff5429effe63` | finished in 23.55s |

Bounded stdout and stderr for each run are kept beside this session's scratchpad (`section2-logs/<function>.stdout|.stderr`); the digests above are of those exact files. These are orchestrator-observed implementation and independent rerun records, never native verification-run receipts.

Unresolved limit: the seven red commits were confirmed as behavioral failures by the executors' recorded failure lines and, for P13-4-T1 and P13-4-T2, by the orchestrator's own rerun of each red commit in a throwaway worktree (`invalid-review-operation` and `verification-audit is not implemented`); the other five reds are left to the verifier's inspection.

## 3. Installed state (orchestrator; recorded 2026-09-11)

Owed: the installed binary path and SHA-256; the installed path and SHA-256
of each generated front door and contract (`skills/cad-verify`,
`cad-verifier-contract`, `cad-execute`, `cad-executor-contract`, `cad-review`,
`cad-decision-review`, `cad-minimalism-review`, `cad-plan-review`,
`cad-audit`, `cad-coverage`) and of each directly edited agent metadata
adapter; the explicitly selected settings root; and the confirmation, on a
fresh disposable native project, that planner, executor and verifier
dispatches come from that installed binary. Nothing here is inferred from
this tree or from a build.

### 3a. What "installed" means at this close

The owner decided on 2026-09-11, before this close, that no Cadence is
installed in the live Claude setup until 4.0 ships (the 3.7.12 plugin was
uninstalled everywhere that day). At this close the owner chose an isolated
install: the current built binary and the generated front doors are installed
into a dedicated Claude config root that is not the live `~/.claude`, and the
dispatch confirmation below is made from that root. Nothing below is inferred
from the tree or a build; every byte was copied to the root and hashed there.

- Install root: `/claude/cadence-close-13` (private, outside every repository).
- Config root for Claude (`CLAUDE_CONFIG_DIR`): `/claude/cadence-close-13/config`,
  whose `.claude.json` registers the MCP server `cadence` as
  `/claude/cadence-close-13/bin/cadence serve` and whose `settings.json` has
  no hooks.
- Binary: the debug build at HEAD `99126c45` (the same build the section 2
  reruns exercised), copied to `/claude/cadence-close-13/bin/cadence`;
  `cadence --version` reports `cadence 3.7.12` (the crate's version string,
  not yet bumped).
- Each installed skill is byte-equal (`cmp`) to the binary's own render:
  `verifier-instructions` = cad-verifier-contract, `verifier-instructions
  --frontdoor` = cad-verify, `executor-instructions` = cad-executor-contract,
  `executor-instructions --frontdoor` = cad-execute, `review-instructions` =
  cad-review, `review-instructions --alias <name>` = the three aliases,
  `audit-instructions` = cad-audit, `audit-instructions --coverage` =
  cad-coverage.

### 3b. Installed identities (sha256 of the bytes at the install root)

| path under `/claude/cadence-close-13` | sha256 |
|---|---|
| `bin/cadence` | `bdc52e89734cb15883664701b996c8e5281c75613fb82f6138d9629931ad5ceb` |
| `config/agents/cad-executor-low.md` | `c6857c7cad893798b63e8c15487c324b527e561bc25a346d328cf6cc592bcd75` |
| `config/agents/cad-executor-max.md` | `94c541df5e116c4fc7cd78d52697bab7a709196ac3f4142910b6ade306d67200` |
| `config/agents/cad-executor.md` | `d39857c787a0d1e6241bf745d5c44f28eb07ca2a205468cc7ff345943109160a` |
| `config/agents/cad-executor-medium.md` | `0572233e7aeaf5875f15b363521a837a89506f349ba9510467ffd0d33148a017` |
| `config/agents/cad-executor-xhigh.md` | `2f1a84c63d737e6548e18e76286228d4a9e7ca849e4cbf6b98bba16d24feae24` |
| `config/agents/cad-verifier-low.md` | `99bc2db17afaab2e1b46d4208149a41b3a6e76a6ff7bd56c3504cf3bcb19f9e5` |
| `config/agents/cad-verifier-max.md` | `81c117891fc920bfa508e23cd0ebe15404724f1db1a9302456490c0362c81317` |
| `config/agents/cad-verifier.md` | `decb90830eafb9f6ac6960c14fb4b27a488958e98c5d4847839668354daeaf11` |
| `config/agents/cad-verifier-medium.md` | `a62fac3e813776c3b5ae5e6c6c42b8fe150f7de4e2da2e564fcfe0c89d5215cc` |
| `config/agents/cad-verifier-xhigh.md` | `f1d379a90bb0fd8fdbe4df10fae7b4f0953faa32e0a6c8092b5892b6f8b89b7d` |
| `config/.claude.json` | `2b5e7cf89529ab99edb08ee0aff40ab267c1ea9ef127b13b906b9fa414dc4fda` |
| `config/settings.json` | `78922a784ee78e9e50587e93628cd3b9d4dfbe49087adc4514e6781cea38cbb9` |
| `config/skills/cad-audit/SKILL.md` | `bdee5eaf572d9a393db6a56bc42b4965efecfa8fc37302be3eb9a14578e8e763` |
| `config/skills/cad-coverage/SKILL.md` | `ad7a05b4e3872dce8e941e3bd4c7f7d1ac051d4c0ce1d72e4c02e61c412c43f3` |
| `config/skills/cad-decision-review/SKILL.md` | `aa7407a9d90bec8a17dee555e3b7122302b35357048c14866c6838c9aba5f870` |
| `config/skills/cad-execute/SKILL.md` | `b9d4f86db8566cb97435773945b2d70a6341a1847c9aed9c81b99b51f25cccd4` |
| `config/skills/cad-executor-contract/SKILL.md` | `b3350a25726a1948a0d410935f449f79c4cccc7bfb1f3e9978a3281d025e897c` |
| `config/skills/cad-minimalism-review/SKILL.md` | `ae401595fc534232781bd4d30684303f09220174749ba6a12a164e4cdd9e96e6` |
| `config/skills/cad-plan-review/SKILL.md` | `9c50fbea8f10e4253a77998fccae48e9d393b53ddf4197a5717ee96428ab7f6c` |
| `config/skills/cad-review/SKILL.md` | `98aaab67acafdf2a70fe0eb7b814dfcbc095f109c4edc7099f57592325adc8db` |
| `config/skills/cad-verifier-contract/SKILL.md` | `8d57bda3ac1abfc35d6b21bab6469894ee64d6cf3b6d6f321f7d35e9355d23ac` |
| `config/skills/cad-verify/SKILL.md` | `cf5ef35af9a622a36beb866fbb0769760a9b47b3b668361ff2226c823d640ba9` |
| `MANIFEST.sha256` | `e859067baa7f13c6b0cd96595fdf3aeadafcbc3e4fb0b55f763e1d260f5c08d4` |

### 3c. Dispatch confirmation on a fresh disposable project

Driver: a stdio JSON-RPC client spawning
`/claude/cadence-close-13/bin/cadence serve --project-root <fresh tmp dir>`,
`initialize`, `notifications/initialized`, `tools/list`, then one
`cadence_query` each for the planner (`plan-read`), executor (`execute-next`)
and verifier (`verify-next`) dispatch on phase 13. Literal output:

    serverInfo {"name": "cadence", "version": "3.7.12"}
    tools ['cadence_version', 'cadence_query', 'cadence_apply']
    plan-read {"status": "ok", "operation": "plan-read", "phase": "13", "persisted": false, "plans": [], "inventory": {"occupied": [], "high_water": 0, "basis": "965c9e45df128c77a0712c52f1ed15bb0df58d28b944865f56a98269f4c5b4b8", "documents": {}, "provenance": {}}, "targets": [], "occurrence": "active-cycle:phase:
    execute-next {"status": "refused", "code": "missing-roadmap", "reason": "execution validation failed (missing-roadmap); check the controlling inputs and retry"}
    verify-next {"status": "refused", "code": "invalid-plan", "reason": "native approved truths required", "rule": "native-approved-truths", "slot": "context", "phase": 13, "entry": null, "id": null}
    server exit 0
    project /tmp/cadence-close13-fresh-bqb65uyg ['.planning']
    binary sha256 bdc52e89734cb15883664701b996c8e5281c75613fb82f6138d9629931ad5ceb pid-binary /claude/cadence-close-13/bin/cadence

Each answer comes from the installed binary (serverInfo and the running
executable path above). On a fresh project the executor and verifier
dispatches are located refusals, which is the correct answer for a project
with no roadmap and no native approved truths; the planner preview returns
an empty inventory for the phase. No live project was touched.

## 4. Hook retirement (orchestrator; inspected 2026-09-11, not performed)

The live root `/claude/.claude` was inspected and recorded in
`hook-retirement.md`, "Installed result": settings `c9c601f7404c0d2d…`, hook
`017568fd9bc069d5…`, one `PreToolUse` registration spelled
`node "$HOME/.claude/hooks/rules-gate.mjs"`. The script was not run. Two
reasons, both recorded there: the owner's 2026-09-11 decision keeps the live
root free of Cadence until 4.0 ships, so D-121's installed precondition is
not met at that root; and the `$HOME` spelling is not the absolute command
identity `close/rules-gate.md` accepts, which requires a reviewed step before
any run. Retirement is carried to phase 18 with fresh inspection.

## 5. Go/no-go (decided by the owner 2026-09-11: GO)

Inputs on the table: section 1's rehearsal and classified limits; section 2's
seven independent reruns at `99126c45`, all `1 passed; 0 failed`; the
verifier's report `verify.md`, twenty items accepted, none rejected, none not
seen, with every red confirmed behavioral in its own rerun and both links
traced to file and line; section 3's isolated install with dispatch confirmed
from the installed binary; section 4's inspected, not performed, hook
retirement.

Decision, confirmed by the owner on 2026-09-11 as written:

- Phase 13 closes on its checks: every truth T1 to T7 has its accepted
  check, links and observations. Two close steps are carried, not done:
  live installation at the owner's root and the rules-gate retirement, both
  to phase 18 under the owner's 2026-09-11 decision that nothing goes live
  before 4.0 ships. They are recorded as explicit limits, not as done.
- Phase 14 is GO as the first native self-hosting phase, on these terms:
  its context and plans are authored natively (`context-submit`, `plan-read`,
  `plan-submit`), history before it stays imported and unapproved, and the
  one classified incompatibility from the rehearsal, `execute-next 13`
  refusing with `state-conflict` at `ROADMAP.md:377 entry 8` (phase 8
  declared complete, derived incomplete), is the first thing phase 14's
  context must decide: repair the roadmap row or record the declared state
  as imported and unverified.
- The verifier's seven notes outside the map (T1's red is the later of two
  test commits, T5's red is partial, T3's shared-link case is single-truth,
  T7 exercises rejected not not_seen, T1-C's configured-command assertion is
  negative only) change no verdict and are left as recorded for the phase
  14 planner to read before reusing those checks (D-120).

No section of this report says the live system is ready; readiness is
claimed only for what sections 2 and 3 observed.
