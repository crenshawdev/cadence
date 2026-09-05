---
phase: 4
plan: 1
requirements:
  - REL-02
  - BOT-01
  - BOT-02
files:
  - .github/workflows/release.yml
  - .github/scripts/release-check.sh
  - bin/cadence.pin
  - bin/cadence-bootstrap.sh
  - .mcp.json
  - crates/cadence/tests/bootstrap.sh
  - crates/cadence/tests/bootstrap.rs
  - hooks/hooks.json
  - cadence-core/bin/lib/hook-events.mjs
  - cadence-core/bin/hook-events.test.mjs
  - README.md
  - CONTRIBUTING.md
---

# Phase 4: The release path - the release, the bootstrap, the pin

## Goal

A tagged release publishes the four archives only when their sha256 values
match a pin file committed in the plugin, a POSIX shell SessionStart hook
fetches the platform's pinned archive and installs the verified binary at a
versioned path outside `${CLAUDE_PLUGIN_ROOT}`, and the plugin's committed
manifests already point the `cadence` MCP server at that path. Runs after
phase 1's plan, which it depends on for the crate and the `build` matrix.

## Must be true when done

- `bin/cadence.pin` exists in `sha256sum` line format (one line per target
  archive when filled) and is committed EMPTY at phase close: its lines name
  the tag `v<plugin version>`, `/cad-land` bumps that version at landing, and
  the currently published `v3.7.12` release carries no archives, so the pin is
  filled on the landing commit by the procedure CONTRIBUTING documents, never
  from this branch. The publish job refuses a release when any of the four
  archives is missing from the pin or differs from it, or when the tag,
  `plugin.json`, `crates/cadence/Cargo.toml` and `.mcp.json` name different
  versions - proven in-phase against a scratch pin built from a real dispatch
  run's summary and artifacts.
- On a machine with no binary, one session's SessionStart hook leaves an
  executable at `${CLAUDE_PLUGIN_DATA}/<version>/cadence` (which resolves to
  `~/.claude/plugins/data/cadence-cadence/<version>/cadence` for a plugin
  installed as `cadence@cadence`), prints nothing on stdout, and exits 0 on
  every path including failure, so the user sees no error (D-18). Observed
  in-phase under `claude --plugin-dir` with the working-copy pin filled from
  the dispatch run and the archives served from a local directory (task 5).
- With the pin empty - the committed state until landing - every session
  start exits 0, prints nothing, installs nothing, and appends one
  `fail no-pin-line-for-<triple>` line to `${CLAUDE_PLUGIN_DATA}/bootstrap.log`,
  so the reason is on disk and no network is touched.
- A tampered archive never lands: a one-byte change to the archive leaves no
  binary installed and one dated line in `${CLAUDE_PLUGIN_DATA}/bootstrap.log`
  naming the mismatch.
- `.mcp.json` at the plugin root declares one stdio server keyed `cadence`
  whose command is the installed binary path and whose argument is `serve`,
  so the wire names are `mcp__cadence__*` from the next session (D-17).
- `node cadence-core/bin/self-verify.mjs` reports `ok: true` with
  `SessionStart` registered in `hooks/hooks.json` and a matching row in
  `cadence-core/bin/lib/hook-events.mjs` (D-16).
- README's Install section documents the install path, that the binary is
  fetched at session start and serves from the next session, and that a
  failed fetch costs nothing; CONTRIBUTING documents the cargo checks and the
  dispatch-then-pin-then-tag release procedure.

## Context

- Locked: D-04 the expected sha256 per target is pinned in a committed file,
  never trusted from a sidecar beside the artifact; D-05 no `install`
  subcommand, the bootstrap only places a verified binary where the committed
  manifests point; D-06 the binary lives outside `${CLAUDE_PLUGIN_ROOT}` at a
  versioned path under a data directory; D-09 server key `cadence`; D-14 one
  release workflow; D-16 a `SessionStart` row in `hook-events.mjs` and a
  committed script; D-17 install-then-restart is documented, not engineered
  around; D-18 a failed bootstrap leaves the session working.
- Host facts from the Claude Code docs fetched 2026-09-05
  (`code.claude.com/docs/en/hooks.md`, `plugins-reference.md`, `mcp.md`):
  SessionStart stdout is added as context the model sees, so the hook must
  print nothing; a non-zero exit shows stderr to the user, so it must exit 0;
  matchers are `startup`, `resume`, `clear`, `compact`, `fork`, and a matcher
  made only of letters, digits, `_`, `-`, spaces, `,` and `|` is evaluated as
  "a list of exact strings separated by `|` or `,`" for every matcher-bearing
  event (hooks.md, the "Matcher value / Evaluated as" table and the sentence
  after it), so `startup|resume` is two exact sources, not a regex gamble;
  `${CLAUDE_PLUGIN_DATA}` resolves to `~/.claude/plugins/data/{id}/`, is
  created on first reference, survives plugin updates, is deleted on
  uninstall, is exported as an environment variable to hook processes and MCP
  server subprocesses, and is substituted in a plugin `.mcp.json`'s
  `command`, `args` and `env` (as is `${CLAUDE_PLUGIN_ROOT}`). Plugin
  `.mcp.json` at the plugin root is the documented place for a plugin's
  servers. A project-scope `.mcp.json` whose `${VAR}` names an unset variable
  still loads, with a missing-variable warning in `/mcp` and `claude mcp list`
  and the text left unexpanded (mcp.md). `claude --plugin-dir <path>` loads a
  plugin from a local checkout and takes precedence over an installed plugin
  of the same name for that session (plugins.md, "Test plugins locally"); the
  docs do not say which `{id}` such a plugin gets, so in-phase checks glob
  `~/.claude/plugins/data/*/` rather than assert one.
- Release state checked 2026-09-05: `.claude-plugin/plugin.json` is `3.7.12`
  and `gh release view v3.7.12` reports `"assets":[]`, so lines pinned from
  this branch would vouch for archives that do not exist at the published tag.
- Existing files, read 2026-09-05: `.github/workflows/release.yml` (`guard`
  then `publish`; `publish` checks tag vs `plugin.json`, slices CHANGELOG,
  runs `gh release create --verify-tag` with pre-release flags for
  `-rc`/`-alpha`/`-beta` tags), `hooks/hooks.json` (three events, each
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/<script>"` with a `timeout`),
  `cadence-core/bin/lib/hook-events.mjs` (`HOOK_EVENTS` rows with `event` and
  `why`), `cadence-core/bin/hook-events.test.mjs` (one arm per registered
  event, e.g. `SubagentStop is registered TODAY`), README `## Install`,
  CONTRIBUTING `## Running the checks`.
- Out of scope: any `cadence-core/` change beyond the D-16 row and its test;
  `/cad-land`'s own release steps (the procedure is documented for a human
  this cycle); Windows; a self-update path in the binary.

## Tasks

### Task 1: The plugin manifest points the `cadence` server at the installed binary

- **Files:** .mcp.json
- **Action:** Create `.mcp.json` at the plugin root declaring one stdio server
  keyed `cadence` (D-09) whose `command` is
  `${CLAUDE_PLUGIN_DATA}/<version>/cadence` with `<version>` written literally
  as the current `.claude-plugin/plugin.json` version, and whose `args` are
  `["serve"]`. The host substitutes `${CLAUDE_PLUGIN_DATA}` in a plugin
  server's `command` (plugins-reference, fetched 2026-09-05), and the literal
  version is what task 2's release check pins to the tag - so a release bump
  edits this file alongside `plugin.json` and the crate, and a forgotten edit
  fails the release rather than launching last version's binary. This file
  lands first in the plan because task 2's check reads it and must be able to
  exit 0 at task 2's own commit. No `env` block and no wrapper script: the
  manifest points straight at the binary the bootstrap places (D-05), and
  when the binary is not there yet the host reports the server as failed to
  connect while the session, still served by the JavaScript, carries on
  (D-17, D-18). The same file is also read as project-scope MCP config by
  anyone who opens `/code/cadence` itself, where `${CLAUDE_PLUGIN_DATA}` is
  not substituted: the expected in-repo symptom is a one-time approval prompt
  for a project `cadence` server, a missing-variable warning naming
  `CLAUDE_PLUGIN_DATA`, and a failed `cadence` row in `/mcp` - cosmetic, and
  task 6's CONTRIBUTING line tells contributors to decline it. Do not move
  the file to dodge that symptom: the plugin root is the documented location,
  and this task's human-verify is what decides whether it stays there.
- **Verify:** `python3 -c "import json; m=json.load(open('.mcp.json'))['mcpServers']; print(sorted(m), m['cadence']['command'], m['cadence']['args'])"`
  prints `['cadence'] ${CLAUDE_PLUGIN_DATA}/<plugin version>/cadence ['serve']`
  with the same version `jq -r .version .claude-plugin/plugin.json` prints.
  Human-verify (AC4; runs after task 5's human-verify has placed the binary,
  under the same `claude --plugin-dir /code/cadence` launch, one restart
  later): `/mcp` lists `cadence` as connected and a call to
  `mcp__cadence__cadence_version` returns structured content with
  `status: ok`; if the plugin-root `.mcp.json` turns out not to be read for a
  `--plugin-dir` or marketplace install (CONTEXT's flagged assumption), run
  the same call under `claude --mcp-config` naming the installed path, record
  which, and let that result - not this plan - decide whether the file
  belongs at the root at all.

### Task 2: The pin file, and a publish job that refuses a release the pin does not vouch for

- **Files:** bin/cadence.pin, .github/scripts/release-check.sh, .github/workflows/release.yml
- **Action:** Create `bin/cadence.pin` in exactly `sha256sum` output form and
  nothing else - one `<sha256>  cadence-<tag>-<triple>.tar.gz` line per
  target, no comments, no header, so `sha256sum -c` reads it whole and a POSIX
  `read` loop parses it. At this commit no release exists, so the file is
  committed EMPTY, and it stays empty until the landing commit: its lines
  name the tag `v<plugin version>`, `/cad-land` bumps that version at landing,
  and lines pinned from this branch would name `v3.7.12`, whose published
  release carries no archives (checked 2026-09-05) - every session start on
  `main` would then attempt a download that 404s instead of taking the
  no-pin-line path task 3 defines. The release procedure task 6 documents is
  what fills it, and this task's human-verify rehearses that procedure
  against a scratch pin. Write
  `.github/scripts/release-check.sh <tag> <artifacts-dir> [pin-file]` (pin
  defaults to `bin/cadence.pin`) as a POSIX shell script that fails with a
  named reason when: the tag minus its `v` differs from `.claude-plugin/plugin.json`'s
  `version` (the check `publish` already performs, moved here so it is
  testable), from the first `version = "..."` in `crates/cadence/Cargo.toml`,
  or from the version segment of the `command` path in `.mcp.json` (task 1
  wrote `${CLAUDE_PLUGIN_DATA}/<version>/cadence`, so the file exists at this
  commit and its absence is a failure, never a pass); the pin does not carry
  exactly four lines, one per excerpt target, each naming
  `cadence-<tag>-<triple>.tar.gz` for THIS tag; or `sha256sum -c --strict`
  against the pin, run inside the artifacts directory, does not report every
  archive OK. Rewire `publish` in `.github/workflows/release.yml`:
  `needs: [guard, build]`, download every build artifact into one directory
  (pin the download action by SHA the same way phase 1's task 7 pinned
  upload), replace the inline "Tag and plugin manifest agree" step with a
  call to the script, keep the CHANGELOG slice, and pass the four archives to
  the existing `gh release create` so they are attached to the release the
  tag creates. Keep `publish` gated to tag pushes only
  (`if: github.event_name == 'push'`), so a dispatch run builds and reports
  checksums and publishes nothing. Do not add a `.sha256` sidecar upload:
  D-04 rejects that model, and the pin is the only checksum a client trusts.
- **Verify:** With `bin/cadence.pin` empty, `sh .github/scripts/release-check.sh v<plugin-version> /nonexistent`
  exits non-zero naming the pin; with a temporary pin built from
  `.github/scripts/package.sh` output for four copies of the local release
  binary named for the four triples under a temp artifacts dir, the same
  script with that pin as its third argument exits 0 (which is also the proof
  that task 1's `.mcp.json` version segment agrees), and exits non-zero
  after one byte of one archive is changed, naming that archive; `sh .github/scripts/release-check.sh v9.9.9 <that dir> <that pin>`
  exits non-zero naming the version disagreement; with `.mcp.json`'s version
  segment edited to `9.9.9` the fixture run exits non-zero naming `.mcp.json`
  (revert the edit); with `.mcp.json` temporarily moved aside the fixture run
  exits non-zero naming `.mcp.json` (move it back);
  `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/release.yml')); p=d['jobs']['publish']; print(p['needs'], p.get('if'))"`
  prints a list containing both `guard` and `build` and an `if` mentioning
  `push`; `git show HEAD:bin/cadence.pin | wc -c` prints 0 at this commit.
  Human-verify, in two parts. (a) The rehearsal, from this branch, right
  after phase 1 task 7's dispatch: `gh run download <run id>` the four
  artifacts into one directory, paste the four sha256 lines from the run
  summary into a scratch pin file OUTSIDE the tree, and
  `sh .github/scripts/release-check.sh v<plugin version> <that dir> <scratch pin>`
  exits 0 - real CI bytes through the real check, and the paste is the exact
  motion the landing procedure asks for; then dispatch the workflow a second
  time on the same commit and confirm the summary's four lines are identical
  to the first run's, which is the byte-reproducibility across two CI runs
  that the tag's rebuild depends on (a difference on any leg is a finding to
  return, not a reason to loosen the check). Leave `bin/cadence.pin` empty in
  the tree. (b) At landing: the first tag after the pin is filled shows
  `publish` green with four `.tar.gz` assets on the GitHub release, and a
  deliberately wrong pin line on a throwaway `-rc` tag shows `publish` red at
  the check step with no release created.

### Task 3: The POSIX shell bootstrap fetches, verifies and installs the pinned binary

- **Files:** bin/cadence-bootstrap.sh
- **Action:** Write `bin/cadence-bootstrap.sh` for `sh` (POSIX: no arrays, no
  `[[`, no `local` assumptions beyond what dash and macOS `/bin/sh` share),
  runnable as `sh "${CLAUDE_PLUGIN_ROOT}/bin/cadence-bootstrap.sh"` so the
  executable bit need not survive a marketplace copy. Its only job is D-05's:
  place a verified binary at `${CLAUDE_PLUGIN_DATA}/<version>/cadence`, the
  path task 1's `.mcp.json` names, and get out of the way. In order: exit 0
  at once if `CLAUDE_PLUGIN_DATA` is unset or empty (an older host, D-18);
  resolve the pin as `cadence.pin` beside the script via `$(dirname "$0")`
  (no `CLAUDE_PLUGIN_ROOT` dependence, so a test can run a copy of the script
  beside a fixture pin); map `uname -s`/`uname -m` to one of the four triples
  (`Linux`/`x86_64`, `Linux`/`aarch64`, `Darwin`/`x86_64`, `Darwin`/`arm64`)
  and exit 0 on anything else; find the pin line whose archive name ends in
  `-<triple>.tar.gz`, take its sha256 and archive name, and derive the version
  from the name (`cadence-v<version>-<triple>.tar.gz`) - the pin is the single
  source of the version, so no JSON parsing. When no pin line ends in
  `-<triple>.tar.gz` - which includes an empty or missing pin, the committed
  state until landing and therefore the path every machine takes first -
  append one `<date> fail no-pin-line-for-<triple>` line to the log and exit
  0, creating no version directory and touching no network; and treat an
  empty derived version the same way, so no path is ever formed as
  `${CLAUDE_PLUGIN_DATA}//cadence`. Otherwise exit 0 immediately when
  `${CLAUDE_PLUGIN_DATA}/<version>/cadence` is already executable (this is
  every session but the first, and SessionStart hooks must be fast); otherwise
  download `${CADENCE_RELEASE_BASE_URL:-https://github.com/crenshawdev/cadence/releases/download}/v<version>/<archive>`
  with `curl -fsSL` into a `mktemp -d` directory created UNDER
  `${CLAUDE_PLUGIN_DATA}` (same filesystem, so the final move is a rename),
  compute the digest with `sha256sum` or `shasum -a 256`, and compare it to
  the pinned value BEFORE extracting anything - a mismatch deletes the download
  and installs nothing (D-04); on a match, `tar -xzf` into the temp dir, `chmod 755`
  the extracted `cadence`, `mkdir -p` the versioned directory and `mv` the
  binary into place as the last step so a concurrent session never sees a
  half-written file; clean the temp dir on every exit via `trap`. Every
  outcome except the fast path appends one line `<ISO-8601 UTC date> <ok|fail> <reason>`
  to `${CLAUDE_PLUGIN_DATA}/bootstrap.log`, and the script prints NOTHING on
  stdout on any path (the host adds SessionStart stdout to the model's
  context) and exits 0 on any path (a non-zero exit shows stderr to the user,
  which D-18 forbids). The base-URL override exists for the test in task 4
  and the in-phase session check in task 5, and cannot weaken anything: the
  pinned sha256 still governs whatever the URL serves. Keep the script under
  roughly sixty lines of logic; the design doc guessed forty and the log
  line and the platform map are the honest excess.
- **Verify:** In a temp `CLAUDE_PLUGIN_DATA` with a copy of the script beside
  a fixture pin naming a `cadence-v0.0.0-<local triple>.tar.gz` built by
  `.github/scripts/package.sh` from any executable named `cadence`, and
  `CADENCE_RELEASE_BASE_URL` set to a `file://` URL whose `v0.0.0/` directory
  holds that archive: `sh cadence-bootstrap.sh` exits 0, prints nothing on
  stdout, and leaves an executable at `$CLAUDE_PLUGIN_DATA/0.0.0/cadence`
  whose bytes equal the packaged one; deleting it, flipping one byte in the
  archive and re-running exits 0, prints nothing, leaves no file at that path,
  and `tail -1 $CLAUDE_PLUGIN_DATA/bootstrap.log` names a checksum mismatch;
  with the binary present and the URL pointing at a nonexistent directory,
  the run exits 0 in under one second and appends no log line; with
  `CLAUDE_PLUGIN_DATA` unset the run exits 0 and creates nothing; with an
  EMPTY pin beside the script and a fresh temp `CLAUDE_PLUGIN_DATA`, the run
  exits 0, prints nothing, creates no directory under `$CLAUDE_PLUGIN_DATA`,
  and `tail -1 $CLAUDE_PLUGIN_DATA/bootstrap.log` contains
  `no-pin-line-for-` followed by the local triple;
  `grep -c '\[\[\|declare\|\${BASH' bin/cadence-bootstrap.sh` prints 0.

### Task 4: A shell test drives the bootstrap end to end from `cargo test`

- **Files:** crates/cadence/tests/bootstrap.sh, crates/cadence/tests/bootstrap.rs
- **Action:** Write the scenarios as a POSIX shell test
  `crates/cadence/tests/bootstrap.sh` that takes the path of the binary to
  package as its one argument and is run from the repo root, so the apparatus
  is smaller than the script under test: `mktemp -d` for its root with a
  `trap` that removes it, `.github/scripts/package.sh` for the archives, and
  nothing else. Package the given binary FOUR times, once under each of the
  four triple names `cadence-v0.0.0-<triple>`, and write all four printed
  sha256 lines into the fixture pin beside a COPY of `bin/cadence-bootstrap.sh`
  - whichever triple the bootstrap resolves for this host, the pin has its
  line and the `file://` tree has its archive, so the test never maps
  `uname` or `std::env::consts` to a triple and there is no second copy of
  the mapping to drift (this is the reason for four archives, keep it in a
  comment). Serve the archives from a `v0.0.0/` subdirectory through
  `CADENCE_RELEASE_BASE_URL`. Five scenarios, each printing one `ok <name>`
  line on success and exiting non-zero with the failing assertion on the
  first failure: the happy path installs an executable at
  `<data>/0.0.0/cadence` whose `--version` prints what the packaged binary
  prints, with the bootstrap's stdout empty, exit 0 and a last log line whose
  second field is `ok`; a corrupted archive (one byte flipped in all four)
  installs nothing, exits 0, prints nothing, and the last log line contains
  `mismatch`; a present binary short-circuits (unreachable URL, exit 0, log
  line count unchanged); an unset `CLAUDE_PLUGIN_DATA` exits 0 and creates
  nothing; an empty pin exits 0, creates no version directory, and the last
  log line contains `no-pin-line-for-`. Exit 77 with a one-line reason when
  `curl` is absent. Then write `crates/cadence/tests/bootstrap.rs` as one
  `#[test]` that does one thing: locate the repo root from `CARGO_MANIFEST_DIR`
  two levels up, run `sh crates/cadence/tests/bootstrap.sh` from there with
  `env!("CARGO_BIN_EXE_cadence")` as the argument, treat exit 77 as a printed
  skip and any other non-zero exit as a failure that prints the script's
  stdout and stderr. Only `std`, so `crates/cadence/Cargo.toml` stays
  untouched; no temp-dir code, no cleanup code and no triple logic in Rust.
- **Verify:** `sh crates/cadence/tests/bootstrap.sh target/debug/cadence` from
  the repo root exits 0 and prints exactly five lines beginning `ok `;
  `cargo test --locked --test bootstrap` passes with one test listed;
  `grep -c 'tempfile' crates/cadence/Cargo.toml` prints 0; `git diff --stat crates/cadence/Cargo.toml`
  is empty; `grep -c 'uname\|consts::' crates/cadence/tests/bootstrap.sh crates/cadence/tests/bootstrap.rs`
  prints 0 for each file.

### Task 5: SessionStart runs the bootstrap, and self-verify knows the event

- **Files:** hooks/hooks.json, cadence-core/bin/lib/hook-events.mjs, cadence-core/bin/hook-events.test.mjs
- **Action:** Add a `SessionStart` entry to `hooks/hooks.json` with matcher
  `startup|resume` - which the hooks reference evaluates as two exact
  sources, not a regex: a matcher made only of letters, digits, `_`, `-`,
  spaces, `,` and `|` is "a list of exact strings separated by `|` or `,`"
  for every matcher-bearing event (hooks.md, "Matcher value / Evaluated as"
  table, fetched 2026-09-05), the same reading the repo's `PostToolUse` entry
  already relies on - one command hook
  `sh "${CLAUDE_PLUGIN_ROOT}/bin/cadence-bootstrap.sh"` in the same
  quoting style as the three existing entries, and a `timeout` of 120 seconds:
  the fast path is one `test -x`, and the slow path is one archive download
  that must not be cut short on a slow link (a cut run leaves nothing
  half-installed and the next session retries). Add a row to `HOOK_EVENTS`
  in `cadence-core/bin/lib/hook-events.mjs` with `event: 'SessionStart'` and a
  `why` in the register's voice naming what the event is FOR (fetching and
  verifying the release binary before any tool runs, so the MCP server exists
  for the next session), because without the row `self-verify` reports
  `unregistered-hook-event` and both CI workflows go red (D-16). Add the
  matching arm to `cadence-core/bin/hook-events.test.mjs` in the shape of the
  existing `SubagentStop is registered TODAY` test: the row exists, a
  `hooks.json` registering `SessionStart` reports nothing, and a misspelling
  is reported by name. Change nothing else under `cadence-core/`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true`;
  `node --test cadence-core/bin/hook-events.test.mjs` passes with one more
  test than before; `python3 -c "import json; h=json.load(open('hooks/hooks.json'))['hooks']; print(sorted(h), h['SessionStart'][0]['matcher'], h['SessionStart'][0]['hooks'][0]['timeout'])"`
  prints `['PostToolUse', 'PreToolUse', 'SessionStart', 'SubagentStop'] startup|resume 120`;
  the hook's command names a path that exists (`test -f bin/cadence-bootstrap.sh`).
  Human-verify (AC3), runnable in-phase on a machine with no binary: fill the
  WORKING-COPY `bin/cadence.pin` with the four lines from phase 1 task 7's
  dispatch summary (do not commit), export `CADENCE_RELEASE_BASE_URL` as a
  `file://` URL of a directory whose `v<plugin version>/` subdirectory holds
  the four downloaded artifacts, start `claude --plugin-dir /code/cadence`
  (the local copy overrides the installed plugin of the same name for that
  session), and after the session observe: `ls ~/.claude/plugins/data/*/bootstrap.log`
  finds the log - its presence is the proof the matcher fired, separate from
  whether the fetch succeeded - and `ls -l ~/.claude/plugins/data/*/<plugin version>/cadence`
  shows an executable whose `--version` prints the crate version; the session
  showed no hook error and added no text to the model's context. If no log
  appears anywhere under `~/.claude/plugins/data/`, `CLAUDE_PLUGIN_DATA` was
  not exported for a `--plugin-dir` plugin: repeat with the plugin installed
  from the pushed branch and record which. Restore the empty pin with
  `git checkout bin/cadence.pin` before the plan's last commit.

### Task 6: The install path, the restart step and the release procedure are written down

- **Files:** README.md, CONTRIBUTING.md
- **Action:** In README's `## Install` section, after the marketplace commands,
  add a short paragraph stating: the plugin's Rust server binary is fetched by
  a SessionStart hook on the first session after install or update, verified
  against the sha256 pinned in the plugin at `bin/cadence.pin`, and placed at
  `${CLAUDE_PLUGIN_DATA}/<version>/cadence`, which is
  `~/.claude/plugins/data/cadence-cadence/<version>/cadence` for a plugin
  installed as `cadence@cadence`; that the `cadence` MCP server is live from
  the NEXT session, so restart Claude Code once after the first start (D-17,
  the instruction excerpt's own install prints); and that a session whose
  fetch fails - offline, unsupported platform, mismatch - keeps working with
  nothing lost, with the reason in `bootstrap.log` beside the binary (D-18).
  Keep the paragraph honest about the current state: during this cycle the
  JavaScript still does the work. Reference the script by its
  `${CLAUDE_PLUGIN_ROOT}/bin/cadence-bootstrap.sh` path so self-verify's path
  check 3 covers it. In CONTRIBUTING's `## Running the checks`, revise the
  "no build step" sentence so it is true again - the Node scripts are still
  zero-dependency, and the Rust crate under `crates/cadence` builds with
  `cargo build --locked` and tests with `cargo test --locked` - and add one
  sentence saying that the root `.mcp.json` is the plugin's server manifest,
  that Claude Code also reads it as this repo's project-scope MCP config
  where `${CLAUDE_PLUGIN_DATA}` is not substituted, and that a contributor
  should decline the project-scope `cadence` server prompt once (the decline
  is remembered) and ignore its failed row in `/mcp`. Add a
  `## Cutting a release` subsection that states the procedure task 2's
  workflow enforces, in order: bump the version in `.claude-plugin/plugin.json`,
  `crates/cadence/Cargo.toml` (then `cargo build --locked` to refresh
  `Cargo.lock`) and `.mcp.json`, and add the CHANGELOG section; dispatch the
  `release` workflow on that commit and copy the four sha256 lines from the
  run summary into `bin/cadence.pin`; commit the pin; land on `main`; tag
  `v<version>` - the tag's own build must reproduce the pinned bytes or
  `publish` refuses, and the fix is a fresh dispatch, pin and a new patch
  version, never a moved tag. Note that `/cad-land` does not yet perform the
  dispatch-and-pin step, so it is a hand step this cycle.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true`
  (the two new `${CLAUDE_PLUGIN_ROOT}` paths resolve);
  `grep -c 'CLAUDE_PLUGIN_DATA}/<version>/cadence' README.md` prints 1 or
  more; `grep -c 'Cutting a release' CONTRIBUTING.md` prints 1; `grep -n 'no build step' CONTRIBUTING.md`
  prints nothing; `grep -ci 'project-scope\|project scope' CONTRIBUTING.md`
  prints 1 or more.

## Notes

- **Runs after phase 1.** Shares `.github/workflows/release.yml` with
  phase 1 (phase 1 adds `build`, this plan rewires `publish`), and every task
  here needs phase 1's crate, packaging script or matrix to verify; recorded
  here and in the return marker as the deviation from CONTEXT's parallel-shaped
  "multiple plans" line.
- **Task order inside this plan.** `.mcp.json` lands first because the
  release check reads its version segment and must exit 0 at its own commit
  with the file present; a check that tolerated the file's absence would
  disarm the very failure it exists to catch.
- **How the pin gets filled (design choice, recorded).** The pin must be in
  the tree BEFORE the tag for "the plugin tag pins the binary" (D-04) and AC2
  to hold in one tagged run, and the archives cannot be built locally (only
  `x86_64-unknown-linux-gnu` is installed). So: a `workflow_dispatch` run of
  the same workflow builds and reports checksums, the human commits them, and
  the tag's run rebuilds and refuses on any difference. That makes
  byte-reproducibility across two CI runs the load-bearing property, which is
  why phase 1 pins the toolchain and normalises the archive, and why task 2's
  human-verify dispatches twice and compares. The rejected alternative was a
  second tag namespace for binary releases (no reproducibility needed, but
  two tags per release and a version that drifts from the plugin's); it stays
  available if reproducibility proves flaky on the macOS runners, whose SDK
  is not pinned by anything in this repo.
- **`${CLAUDE_PLUGIN_DATA}` is the install root (refines D-06).** D-06 asked
  for a versioned path outside `${CLAUDE_PLUGIN_ROOT}` under a data directory
  because the plugin cache is per-version. The docs fetched 2026-09-05 name a
  host directory built for exactly that - survives updates, removed on
  uninstall, exported to hooks and MCP subprocesses, substituted in
  `.mcp.json` - so the manifest can point straight at the binary with no
  launcher script and no `${HOME}`/XDG guessing. If John meant an XDG path
  specifically, the change is two strings (the bootstrap's root and the
  manifest's `command`) and the launcher question reopens.
- **Two versions of one string.** `.mcp.json` carries the version literally;
  the release check refuses a tag where it disagrees with `plugin.json` or the
  crate. `/cad-land`'s bump step does not know about the crate, `.mcp.json`
  or the pin yet; folding the release procedure into `/cad-land` is later
  work for the human to schedule, not this phase.
- **Assumptions carried, both from CONTEXT's flagged list.** A plugin-root
  `.mcp.json` is read for a marketplace install (task 1's human-verify records
  which way it went); the CLI surfaces `structuredContent` to the model
  (nothing in this plan can observe it, and D-07 names the fallback).
- **What is observed in-phase and what waits.** AC3 and AC4 are observed
  in-phase under `claude --plugin-dir` with the working-copy pin filled from
  the dispatch run and the archives served from a local directory (tasks 5
  and 1); AC2 waits on the landing tag, which the `guard` only cuts from a
  commit reachable from `main`. The committed pin is empty until landing -
  "Must be true when done" says so, with the reason - so on `main` between
  merge and release the bootstrap takes the no-pin-line path: one log line
  per session start, no network, nothing installed.
- **The bootstrap test is shell, not Rust.** Task 4 packages the binary under
  all four triple names so the pin always carries the host's line; that is
  what lets the test avoid a second `uname` mapping, and it is why the Rust
  side is a one-test shim with no temp-dir, cleanup or platform code of its
  own.
- **Model-context hygiene.** SessionStart stdout becomes context the model
  sees (hooks docs, fetched 2026-09-05); the bootstrap therefore writes its
  outcome to a log file and nothing to stdout, which is also why a failure is
  not silent.
