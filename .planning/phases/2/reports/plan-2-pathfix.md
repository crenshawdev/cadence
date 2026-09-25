PLAN COMPLETE
Plan: /code/cadence/.planning/phases/2/PLAN-2.md (path-fix amendment)
Tasks: 1 of 1 complete; both repository-location checks and the final Node suite passed.

| Task | Commit | Note |
|---|---|---|
| Neutralize authoring path in the fixture builder; rebuild and re-record | 460c9e437a436c734a9742287c3356e2eab243fe | fix(2-2): neutralize the authoring path in golden fixtures |

## Scope and implementation

Applied the cad-executor-contract and lean-build reference. This dispatch explicitly amends the old plan's output and authorizes the builder, fixtures, recordings, and this report. Its file scope supersedes PLAN-2's original lease (which excluded the builder and fixtures); the obsolete lease gate was not used to reject this authorized amendment. The dispatch also overrides the contract's report filename and final digest format. This report stays uncommitted for the orchestrator, per the sequential executor contract. Existing reports were preserved; this filename did not exist.

Cheap verification confirmed 19 literal authoring-path occurrences across ten fixture files. The requested `/srv/example-project` placeholder had no existing fixture collisions. `sanitizeTagContent` applies just the literal `/code/cadence` replacement when reading frozen tag content, including tag content used for derived files. The named comment explains why host-root substitution makes drift machine-specific and why deliberate absolute paths must remain intact. The copy provenance comment now acknowledges path sanitization. Neither recorder nor normalization semantics changed; `fixtures.json` regenerated without a diff. No recording was edited by hand.

Ran the builder, then the entire recorder manifest, then the builder again. The second build was byte-identical. A byte comparison against pre-fix HEAD proved every changed fixture equals exactly its old bytes with the requested replacement: ten files, 19 occurrences. All other bytes, including deliberate `/tmp/` paths, are unchanged.

## Recording impact

There are still 156 recordings. Exactly 11 changed; the other 145 are byte-identical. The committed diff totals 22 files, 70 insertions, 62 deletions (one builder, ten fixtures, eleven recordings).

| Recording | Cause |
|---|---|
| milestone-prune-ok.json | Two synthesized ARCHIVE rows now preserve `/srv/example-project` instead of host-dependent `<REPO>` substitution. |
| adjudication-ok.json | Changed planning-inputs fixture tree changes its deterministic Git base/head IDs in argv, stdout, and written adjudication. |
| adjudication-refused.json | Same planning-inputs Git IDs in argv. |
| deferred-record-ok.json | Same planning-inputs Git IDs in argv, stdout, and written deferred record. |
| deferred-record-refused.json | Same planning-inputs Git IDs in argv. |
| risk-check-run-ok.json | Changed project fixture tree changes deterministic base/head IDs in argv, stdout, and trace. |
| risk-check-run-refused.json | Same project Git IDs in argv. |
| task-record-ok.json | Same project Git IDs in argv, stdout, trace, and task record. |
| task-record-refused.json | Same project Git IDs in argv. |
| why-ok.json | Changed project base commit ID, including its abbreviated form, in stdout. |
| recall-ok.json | First result score changes from 4.3003 to 4.3004; path tokenization changes the corpus used for BM25 length normalization. Result source, snippet, order, and all other fields remain unchanged. |

The nine Git-ID changes follow the recorder's content-derived base commit (`record.mjs:45-47`); BM25 uses token lengths and corpus average length (`cadence-core/bin/lib/bm25.mjs:178-186,216`) and recall rounds scores to four decimals (`cadence-core/bin/planning/recall.mjs:193`).

## Verification

- `TMPDIR=/tmp node crates/cadence/tests/golden/record.mjs --check < /dev/null`: exit 0, no output, in `/code/cadence`.
- `grep -rl '/code/cadence' crates/cadence/tests/golden/fixtures/ crates/cadence/tests/golden/recordings/`: no output, exit 1 (no matches).
- `git diff --quiet v3.7.12 -- cadence-core/`: exit 0.
- `node --check crates/cadence/tests/golden/build-fixtures.mjs < /dev/null`: exit 0.
- `git diff --check`: exit 0.
- `RUSTC_WRAPPER= cargo clippy --offline --all-targets -- -D warnings`: exit 0.
- `node node_modules/typescript/bin/tsc -p tsconfig.ci.json < /dev/null`: exit 0, local TypeScript 7.0.2. The initially invoked global TypeScript 6.0.3 reported four errors in frozen files; selecting the already-installed repository compiler resolved the toolchain mismatch without edits or installs.
- `workflow.lint_command` and `workflow.test_command` resolve to null. `detect-commands` supplies Clippy and TypeScript; the final Node suite uses the repository's `cadence-core/bin/test.mjs` runner, as CI does.

## Deviations and open items

[deviation] Verification prediction expected only milestone-prune-ok to change; full regeneration changed eleven recordings. Inspection accounts for the ten additional changes above. The dispatch explicitly anticipated additional affected recordings; no acceptance criterion or locked decision changed.

Open items: none. No network access, push, tag, configuration edit, frozen-source edit, or attribution trailer was used.

## Final proof

- In-place check: `TMPDIR=/tmp node crates/cadence/tests/golden/record.mjs --check < /dev/null` in `/code/cadence`: exit 0, no output. The checked bytes are identical to the signed commit.
- Relocated check: created `/tmp/cadence-pathfix.MBiMVg` outside the repository; populated it with `git archive HEAD | tar -x -C "$scratch"`; ran `git -C "$scratch" init -q -b main`; changed into that directory and ran `TMPDIR=/tmp node crates/cadence/tests/golden/record.mjs --check < /dev/null`: exit 0, no output. The archive came directly from signed commit `460c9e437a436c734a9742287c3356e2eab243fe`, without copying working-tree files over it.
- Full Node suite: `TMPDIR=/tmp node cadence-core/bin/test.mjs < /dev/null`: exit 0; 3,751 tests passed, zero failures, zero skipped/cancelled/todo, 23.917 seconds. Full output: `/tmp/cadence-pathfix-node-suite.log`.
- Parsed recording inspection found only the two intended ARCHIVE row replacements in milestone-prune-ok. For the nine recordings carrying Git IDs, replacing precisely the expected old IDs (including the one abbreviated ID) makes their pre-fix bytes identical to the new recordings. Recall's only change is the first score, 4.3003 to 4.3004.
- `git verify-commit HEAD`: exit 0, good signature from John Crenshaw, fingerprint `904A3ED971D189EBDEABCCA6693AB15F91734B0C`; key `693AB15F91734B0C`. Author and committer are both `John Crenshaw <john@jcrenshaw.dev>`. Commit subject: `fix(2-2): neutralize the authoring path in golden fixtures`.
- Post-commit deletion check: no deleted files. Tracked working tree is clean; only the reports directory remains untracked, as it was on entry. One local signed commit on `cadence/binary-owns-process`; no push or tags.

## Spot checks

| Path:line | Evidence |
|---|---|
| crates/cadence/tests/golden/build-fixtures.mjs:108 | Named tag-content sanitizer, called by tagBytes. |
| crates/cadence/tests/golden/fixtures/slice/.planning/ARCHIVE.md:418 | Rebuilt prose uses the neutral placeholder. |
| crates/cadence/tests/golden/recordings/milestone-prune-ok.json:55 | Regenerated ARCHIVE bytes preserve the neutral path. |
| crates/cadence/tests/golden/recordings/recall-ok.json:29 | Regenerated BM25 score is 4.3004. |
