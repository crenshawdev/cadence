# cad-docs-verify workflow

Verify the checkable claims in the target docs against the live code. Report
only; never rewrite (the writer is cut - DESIGN §2). The value is honest drift
detection for a distributed project, so precision matters: a false "stale" is
worse than an "unverifiable".

## 1. Resolve targets
`$ARGUMENTS` = a path or glob, else the default set: `README.md` plus `docs/**`
(and any `*.md` at the repo root that reads like user docs - not `.planning/`).
List what will be checked.

## 2. Extract checkable claims
Per doc, pull out the claims that can be tested against the repo. Ignore prose
opinion and intent; target concrete, falsifiable statements:
- **Paths** - referenced files/dirs ("see `src/foo.ts`", "config lives in `x/`").
- **Commands** - CLI examples, install/build/run/test invocations, script names.
- **Code symbols** - function/class/method names, exported API, CLI flags, env
  vars, config keys.
- **Structure/behavior** - "X does Y", "the default is Z", counts and version
  numbers stated as fact.
Record each claim with its doc + line so the report can point at it.

## 3. Verify each claim against the repo
Checks across claims are independent - batch them (path checks one pass, symbol
Greps parallel in one message, cited-code Reads one batch), serializing only a
check that needs a prior result (conventions.md Parallel work). Use the cheapest
check that decides each claim:
- Path -> does it exist (Glob / test -e)?
- Command -> does the entrypoint/script exist (package.json scripts, a bin, the
  binary on PATH)? Where safe and read-only, run `--help` or a dry form to
  confirm the flag/subcommand exists. Never run a destructive or state-changing
  command to verify it.
- Symbol / flag / config key / env var -> Grep the source for its definition.
- Structure/behavior -> Read the cited code and compare to the claim; a stated
  default or count is checked against the actual value.

## 4. Classify and report
Each claim is one of:
- **accurate** - the code confirms it.
- **stale** - the code contradicts it (path gone, symbol renamed/removed, flag
  no longer exists, default changed). Give the correct value when it is knowable.
- **unverifiable** - cannot be decided mechanically (needs runtime, external
  service, or judgment). Say why; do not guess a verdict.

Emit a per-doc table: `claim | location | verdict | correct value (if stale)`.
Lead with a one-line count (`N accurate, M stale, K unverifiable`) and list the
stale claims first - they are the actionable output.

## 5. Hand off
Stop at the report. Do not edit docs. If the user wants the stale claims fixed,
that is a separate edit they make or direct - name the exact file+line and the
correct value so the fix is mechanical. Optionally offer that follow-up via the
ask-user seam, but never auto-apply.
