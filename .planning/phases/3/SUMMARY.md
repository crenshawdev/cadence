## AC7: watched failures

Each requirement's falsifier was watched failing against the tree that preceded
its own first implementation commit. The SHA on each line is quoted from that
test's `WATCHED FAILING AT` header, which also carries the observed unpatched
output verbatim.

- **RVP-01** - `cadence-core/bin/review-provider.test.mjs`, watched failing at
  `e1e6c0a`. Re-watch: `git worktree add --detach <tmp> e1e6c0a`, copy
  `cadence-core/bin/review-provider.test.mjs` into that checkout's
  `cadence-core/bin/`, run
  `node --test --test-name-pattern='RVP-01' cadence-core/bin/review-provider.test.mjs`
  there, then remove the worktree.
- **RVP-02** - `cadence-core/bin/review-provider.test.mjs`, watched failing at
  `15b5d4c`. Re-watch: `git worktree add --detach <tmp> 15b5d4c`, copy
  `cadence-core/bin/review-provider.test.mjs` into that checkout's
  `cadence-core/bin/` AND `cadence-core/bin/lib/schema-eval.mjs` into that
  checkout's `cadence-core/bin/lib/`, run
  `node --test --test-name-pattern='RVP-02' cadence-core/bin/review-provider.test.mjs`
  there, then remove the worktree. The second copy is not optional - the
  evaluator cases import that module, so a checkout carrying only the test file
  fails at module resolution before any assertion runs.
- **WIR-01** - `cadence-core/bin/prose-agreement.test.mjs`, watched failing at
  `cdf8676`. Re-watch: `git worktree add --detach <tmp> cdf8676`, copy
  `cadence-core/bin/prose-agreement.test.mjs` into that checkout's
  `cadence-core/bin/`, run
  `node --test --test-name-pattern='WIR-01' cadence-core/bin/prose-agreement.test.mjs`
  there, then remove the worktree.
