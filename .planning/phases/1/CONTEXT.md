# Phase 1: Repair the cross-model review seam - Context

Gathered: 2026-07-22
Feeds: /cad-plan 1

## Scope boundary

In: Repair `cadence-core/bin/review-provider.mjs` so its run-as-script guard
follows symlinks (realpath on both sides), add a symlink regression test that
asserts non-empty JSON, and make the review `fire()` path surface one visible
line when a cross-model provider result is empty or unusable instead of falling
back to the `claude-subagent` reviewer silently. Serves REV-01 (#12).

Out: No changes to consult or detect-models surfacing (neither degrades to a
subagent); no new config keys, subcommands, or flags; no shared `isMainModule()`
helper extraction; no provider, transport, or model-detection behavior changes.

Deferred: None.

Plan shape: one plan (right-sized).

## Decisions

- D-01 (Run-as-script guard): Repair the guard at `review-provider.mjs:501` to
  compare the realpath of both operands (`fs.realpathSync` on
  `process.argv[1]` and on `fileURLToPath(import.meta.url)`) instead of
  `path.resolve(...)===path.resolve(...)`, which normalizes but does not follow
  symlinks. Evidence: `cadence-core/bin/review-provider.mjs:501`;
  `.planning/REQUIREMENTS.md` REV-01.
- D-02 (Guard robustness): Guard the `realpathSync` calls against throwing
  (e.g. ENOENT on a missing/odd `argv[1]`), falling back to the normalized
  comparison, preserving the module's never-throw-and-crash-the-spine contract.
  Evidence: `review-provider.mjs:18-23`, `:67-74`.
- D-03 (Scope of the fix): Keep the fix local to `review-provider.mjs`; do not
  extract a shared `isMainModule()` helper into `lib/seam-io.mjs`, because it is
  the only bin script with a run-as-script guard (the others dispatch at module
  top level and are tested via subprocess). Evidence: `config.mjs:202`,
  `route.mjs:165`.
- D-04 (Empty-provider surfacing): Surface an empty or unusable provider result
  as one visible line in the caller prose (`references/review-triggers.md`
  `fire()` step 4), scoped to the review path only, before falling back to
  `claude-subagent`. The script already emits structured reasons once `main()`
  runs; the gap is the caller swallowing them. Evidence:
  `references/review-triggers.md:46-56`; `references/consult.md:25-28`;
  `references/seams.md:129-134`.
- D-05 (Regression test): Add a symlink regression test to
  `review-provider.test.mjs` - symlink the script into a tmpdir, invoke it
  through the symlink over a no-network failure path (bad-provider /
  bad-command / no-key), and assert a single non-empty parseable JSON line.
  Evidence: `review-provider.test.mjs:19-34`, `:176-193`; REV-01.
- D-06 (Contract surface): No `self-verify.mjs` CONTRACTS change; the
  subcommands (`review` / `consult` / `detect-models`) and flags are unchanged.
  Evidence: `self-verify.mjs:86-91`.

## Acceptance criteria

- [ ] Invoking `review-provider.mjs` through a symlink emits a non-empty JSON
      line identical to invoking it by its real path (e.g. `detect-models
      --provider skynet` returns an `ok:false` bad-provider line either way);
      before the fix the symlinked invocation emitted nothing.
- [ ] `review-provider.test.mjs` contains a regression test that invokes the
      script through a symlink and asserts a single non-empty parseable JSON
      line, and the full `node --test` suite over `cadence-core/bin/` is green.
- [ ] `tsc --checkJs` and `node cadence-core/bin/self-verify.mjs` both pass with
      the change in place (no schema/CONTRACTS drift).
- [ ] In the review `fire()` path, an empty or unusable cross-model provider
      result produces one visible line naming the degradation before falling
      back to the `claude-subagent` reviewer, rather than degrading silently.
      (human-verify: needs a live review run with an empty/failing provider result)
- [ ] On a symlinked plugin install with a cross-model provider configured, a
      `review` / `consult` / `detect-models` invocation returns a real
      cross-model result instead of no-opping to the subagent.
      (human-verify: needs a configured provider API key)

## Flagged assumptions

- Node's main-module symlink resolution across the 22/24 CI matrix (whether
  `process.argv[1]` stays as-typed while `import.meta.url` is realpath'd, and
  whether `--preserve-symlinks-main` alters it) is unconfirmed from the
  codebase; realpath-ing both sides is robust either way, so it does not block
  planning.
- Whether the regression test symlinks the single `.mjs` file or a directory
  tree is the planner's call; a file symlink already reproduces the `argv[1]`
  vs `import.meta.url` divergence.
