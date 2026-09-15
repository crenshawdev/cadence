# Phase 13 close-only rules-gate retirement

This procedure is unshipped phase-close support. PLAN-1 rehearses it on an
explicit disposable copy. Only the orchestrator at PLAN-4 close inspects and
removes installed state, then completes the installed section of
`../reports/hook-retirement.md`. The verifier inspects those records.

Prerequisite: identify the installed current binary, compiled planner front
door and its native publication path, binary-owned executor dispatch and
retained verifier dispatch. The existing planner surface is
`cadence plan-instructions` plus stdio `plan-read`/`plan-submit`; it is not
a retained planner-prompt query. The disposable regression records these
actual surfaces. PLAN-4 must inspect installed readiness, not infer it from
this rehearsal or a build.

## Inspect, bind and retire

Use an explicitly selected canonical absolute settings root; the script never
discovers settings, reads HOME or supplies an owner path. Quiesce settings
writers for inspection and removal. Read just this root's `settings.json` and
`hooks/rules-gate.mjs`, recording their exact raw bytes and SHA-256 values
(or the literal `absent` for a missing file). Inspect registrations and the
unrelated hook guards, sibling commands, event/group ordering and matchers.

The supported inspected command identity is two parsed arguments: `node`
(or an explicitly supplied node executable path) and this root's absolute
`hooks/rules-gate.mjs`. Supply the exact inspected command spelling. Matching
uses those full parsed arguments: equivalent quoting matches, extra flags,
suffixes and different executable spellings do not. Shell wrappers or a
different installed form require review before running this procedure;
never broaden the matcher or assume a near match is obsolete.

Use a new explicit recovery directory with a canonical existing parent,
outside any directory whose permissions might prevent recovery. Review this
concrete invocation with the inspected paths/hashes substituted; brackets
below are placeholders, not defaults:

```sh
python3 -B /code/cadence/.planning/phases/13/close/retire-rules-gate.py retire \
  --settings-root '<inspected canonical settings root>' \
  --settings-sha256 '<inspected settings sha256 or absent>' \
  --hook-sha256 '<inspected hook sha256 or absent>' \
  --command '<inspected node command and exact absolute hook path>' \
  --recovery '<new explicit canonical recovery directory>'
```

The script rejects symlink/non-file ambiguity, duplicate JSON keys, malformed
hook structures, command quoting ambiguity, stale preimages and incompatible
recovery records. It preserves raw originals in `settings.original` and
`hook.original` (missing originals remain absent) and a bound manifest,
fsyncs them before target changes, then rechecks preimages. JSON token edits
remove only matching array entries and required delimiters: surviving raw
text, ordering, matchers, sibling commands and event groups remain unchanged.
Empty groups remain. No guard or reviewer-stop bridge file is edited.
The script temporarily stages a replacement beside settings and preserves
its mode. Keep the recovery directory until installed review is complete.

Exit 0 with `retired` means the procedure reread and confirmed both the hook
file's absence and zero matching registrations. Compare actual settings
bytes with the reviewed removal and record unrelated guard bytes separately.
The orchestrator records both actual absences and preserved unrelated bytes
in the installed report. No prospective successful close claim is permitted.

## Refusal, interruption and recovery

Exit 1 `refused` requires inspection. Ambiguous or stale inputs are refused
before target mutation. Exit 2 `unfinished`, a killed process, or missing
confirmation is unfinished even if one target is already gone. Recovery
originals are authoritative recovery material, not a success receipt.
Failure while preparing recovery may leave an incomplete recovery directory
without changing targets; inspect that directory and both targets.

After a real partial failure, correct the environmental failure and use the
same original bindings and recovery path with `recover` instead of `retire`.
Recovery only accepts the exact original or planned post-removal settings
and original/absent hook; unrelated changes refuse. It restores and rereads
both originals. If a killed write left `settings.json.phase13-close-new`,
inspect its bytes against the recovery manifest before removing that staging
file and retrying recovery; never delete an uninspected file.

A rerun using a complete matching recovery record returns `already-retired`
only after both actual absences agree with the bound output. A partial rerun
refuses until recovery. After recovery, inspect again and use a fresh recovery
directory for retirement. Without a recovery record, already absent hook
and registrations return `already-absent` only under current inspected
bindings. A surviving registration or surviving hook still requires removal.

## Disposable regression

```sh
cargo test -p cadence --test phase13_close phase13_rules_gate_retirement_rehearsal -- --exact
```

It runs the exact close script above with explicit disposable roots and prints
JSON argument vectors, identities and outcomes. Native context approval,
plan preview/publication, admission, signed fixture completions, real red/green
receipts, executor dispatch and retained verify-next use the real binary and
stdio. The filesystem-denial case requires an unprivileged Linux user; it
makes only a disposable settings directory non-writable while leaving its
hook directory writable, observes the real partial result, restores
permissions and recovers. No owner's installed settings/hooks are read or
written. Fixture Git has private identity/signing configuration.
