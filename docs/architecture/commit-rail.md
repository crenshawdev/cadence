# Native commit rail

Install the native `cadence` executable on PATH before loading the plugin. The
PreToolUse registration invokes `cadence guard` for Bash, Write and Edit. It
retains the Write/Edit ownership rules and the unrelated hook registrations.
The public MCP surface remains cadence_version, cadence_query and cadence_apply.

Bash discovery walks from hook cwd to a `.planning` directory, stopping at a
`.git` boundary or the filesystem root. Outside Cadence projects it is silent.
A bounded linear scanner recognizes simple command segments separated by `;`,
newlines, `|`, `||`, `&` or `&&` outside quotes and escapes. Only a command word
`git` or ending in `/git` qualifies. Flags and the separate operands of `-C`,
`-c`, `--git-dir`, `--work-tree`, `--namespace`, `--exec-path` and `--config-env`
are skipped before reading the verb. A recognized push always asks and takes
precedence over commit. Wrappers, substitutions, redirection, shell groups,
comments and unresolved quoting are outside coverage; they produce no decision.
Quoted arguments are never scanned again as commands. `-C` does not retarget
branch observation, which uses hook cwd; earlier checkout commands are not
simulated. This detector does not guarantee coverage of every shell commit.

Protected commits use `git.on_protected`: ask, refuse (including the deny alias),
or allow. `git.protected_branches` accepts a nonblank string or a filtered array,
preserves an explicit empty array, and otherwise defaults to main/master.
Surviving branch names retain their original spelling. Normalization follows
layer merging; raw layers and provenance remain available. Branch creation and
workflow questions remain owned by pause and the other workflow consumers.

Unavailable Git or an unresolved branch produces no permission veto, a loud
stderr diagnostic and a confirmed guard-failure decision naming the unavailable
input. No `allow` response bypasses the host's remaining permission checks.
A torn controlling layer instead asks, even without a protected-branch hit or
when Git is also unavailable, and explains that the branch rails are deciding
with defaults rather than the user's settings. An independently established deny
keeps its decision and gains this reason.

`git.guard_hard_fail` is a native boolean, default false. On unavailable guard
inputs an explicit opt-in denies on a provably protected branch. A confirmed
snapshot of successfully read policy can retain denial across loss of the
opt-in layer; it never supplies cached permission to allow. Current symbolic
HEAD, including linked-worktree gitdir indirection, supplies fresh identity
when Git cannot run. Unknown branch or opt-in facts cannot establish a denial.
Healthy policy changes that refresh denial bookkeeping can record a policy pass
without emitting host permission JSON.

Decisions use the common store writer, root-scoped operation locks, validated
intents, synchronized replacement and confirmation. Audit-only cold startup is
marked and later normal import preserves its receipts. Host event identity
replays the prior receipt; events without tool-use identity receive independent
invocation identities. Records contain a command digest, never the raw command,
plus cwd/project, verb, branch, policy provenance, result and unavailable inputs.
If audit storage fails, stderr names the failure and does not claim durability;
the command proceeds unless an independently established hard denial remains.

Guard behaviour is proven by `cargo test -p cadence --test phase7_guard`, which feeds the binary the exact input a hook sends and asserts the returned decision. That decides what the binary answers; it does not decide whether a host enforces the answer, and no test in this repository makes that claim.

The execution continuation also requires [exact risk settlement](risk-rail.md)
after accepting signed task evidence. The Bash guard does not perform a review
or settle that evidence. Phase 7 adds no executor pre-commit round trip.
