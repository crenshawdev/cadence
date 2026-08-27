---
phase: 1
plan: 1
requirements:
  - FRG-03
  - FRG-04
  - FRG-05
  - FRG-06
files:
  - cadence-core/bin/lib/forge-decision.mjs
  - cadence-core/bin/forge-decision.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/config.schema.json
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/lib/issue-decision.mjs
  - cadence-core/bin/issue-decision.test.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/bin/issue-filing.test.mjs
  - cadence-core/bin/forge.mjs
  - cadence-core/bin/forge.test.mjs
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - cadence-core/references/config-catalog.md
  - cadence-core/references/config-reach.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 1: Land on a forge that is not on port 22 - Plan

## Goal

A user whose Forgejo lives on `forge.example:3001` can state that in config,
have `forge.mjs create` wire an origin that actually answers, and get a refusal
rather than silence when they pass something the arm will never read. Today the
first of those is impossible, which blocks landing outright.

## Must be true when done

- `config.mjs set git.forge_host=forge.example:3001` writes, and
  `config.mjs get git.forge_host` reads back `forge.example:3001` byte for byte.
- A `git.forge_host` or `git.forge_repo` value the user TYPES that the grammar
  refuses - a space in it, a leading `-`, a port outside 1-65535 or written with
  a leading zero, a one-segment slug - is refused by `config.mjs set` naming the
  key and what is wrong with the value, and the config file on disk is unchanged.
- With `git.forge_host` set to `forge.example.com:3001`, the land-time login
  resolution picks the `tea` login whose `url` names port 3001 and NOT the login
  on port 3000 at the same hostname; with a portless `git.forge_host` every
  login that resolves today still resolves.
- `forge.mjs create` on a repository whose persisted `git.forge_host` names a
  port refuses a `--remote-url` on that same host that names or implies a
  different port, names BOTH ports in the refusal, and spawns nothing at all.
- `forge.mjs create --provider gitlab` given a `--remote-url` refuses by naming
  the conflict with the pinned `--remoteName origin`, and spawns nothing.
- `references/config-catalog.md`'s `git.forge_host` row states the port grammar,
  and both setup workflows ask for a port where there is one and carry the value
  whole into the `--remote-url` they build.
- `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs`
  reports `ok:true`.
- The origin `create` wires against a PORTED instance is proven to ANSWER, not
  just to be well formed: an unattended
  `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" git ls-remote --exit-code <wired origin> HEAD`
  exits 0 (GH-102). This closes AC7's reachable clause, which `v3.7.1` left
  unproven because the execution environment could not verify a host key.

## Context

No `phases/1/CONTEXT.md` exists; this plan is derived from the ROADMAP goal and
its five success criteria.

**OQ-2 is resolved here as: `git.forge_host` grows a port grammar.** The roadmap
states the tie-breaker outright - "the one that leaves a ported instance
addressable wins" - and only this arm does. The other reading, dropping the port
from `loginNamesHost`, would delete a discriminator that already works and is
already tested (`forge.test.mjs:469`, two logins on one hostname told apart by
the port their `url` names) while still leaving `forge.example:3001` unstatable.
So criterion 1 stands as written and the `if OQ-2 resolves the other way` clause
does not apply.

Prior art this plan is built on, cited where it binds a task:
`.planning/ARCHIVE.md:752` and `:756` (v3.7.1 phase 1 SUMMARY) are the two
observations GH-103 and GH-106 were filed from.

Out of scope: nothing here validates a `git.forge_host` already sitting in a
hand-edited config at READ time. Criterion 3 scopes the check to the write face,
and `config.mjs validate` already reaches every persisted value through the same
`checkValue`.

## Tasks

### Task 1: State the `host[:port]` grammar once, beside the slug grammar

- **Files:** cadence-core/bin/lib/forge-decision.mjs, cadence-core/bin/forge-decision.test.mjs
- **Action:** Add to `lib/forge-decision.mjs`, beside `isForgeSlug` and
  `SLUG_SEGMENT`, an exported grammar for the value `git.forge_host` carries:
  a hostname, optionally followed by `:` and a port. It must both JUDGE a
  candidate and SPLIT an accepted one into its hostname and port halves, because
  two functions would be two answers to the same question - the hazard
  `isForgeSlug`'s own header states and the reason `AUTHORITY` in
  `lib/issue-decision.mjs` says there is one spelling of an authority. This
  module is the right home: `lib/issue-decision.mjs` already imports
  `missingForgeKeys` from here, so the import direction this creates for task 3
  already exists and no cycle is introduced.
  What the hostname admits: dot-separated labels of letters, digits and `-`,
  where no label opens or closes on `-`. A leading `-` is refused for exactly
  the reason `SLUG_SEGMENT` refuses one - the value is interpolated into a
  `config.mjs set` shell line and then into a `tea` argument vector, where a
  leading `-` reads as a FLAG. Everything outside that alphabet is refused
  rather than stripped: whitespace, quotes, `$`, backticks, `;`, `/`, `@`,
  newlines and the C0/C1 control range all end an argument and start something
  else, and there is no honest repaired form of a host nobody can serve. Cap the
  whole value at DNS's own 253 bytes, stated as a bound the way `SLUG_MAX` is.
  What the port admits: decimal digits only, no leading zero, and a value of 1
  through 65535. The no-leading-zero rule is load-bearing and not taste - the
  port persisted here is compared in task 3 against the port
  `httpPortOf` reads off a `tea` login's `url`, which normalizes through
  `Number`, so admitting `:0443` here would persist a value that compares
  unequal to `https://h:443` on one side and equal on the other. Refusing the
  non-canonical spelling at the door is what removes the second normalization
  rule entirely.
  Do NOT admit a bracketed IPv6 literal. No `tea` login record in this tree
  carries one, and the bracket form is a second authority grammar that
  `loginNamesHost`'s exact-equality vocabulary has no reading for; refusing it
  is honest where accepting it would persist a value nothing downstream can
  match. State that in the comment so it is a decision rather than an omission.
  Case is NOT refused and NOT normalized here: `teaLoginNameForHost` already
  lowercases the host it is handed, so folding case in two places would be the
  same drift this task exists to prevent.
- **Verify:** `node --test cadence-core/bin/forge-decision.test.mjs` passes with
  new arms showing: `forge.example.com` and `forge.example.com:3001` accepted and
  split into their two halves; `forge.example.com:0443`, `forge.example.com:0`,
  `forge.example.com:65536`, `forge.example.com:22x`, `-forge.example.com`,
  `forge example.com`, `forge.example.com/x`, `git@forge.example.com`, a value
  over 253 bytes and `[::1]:3001` each refused; and a portless value splitting
  to a null port rather than to a defaulted one.

### Task 2: Refuse a malformed typed forge value at the config write face

- **Files:** cadence-core/bin/config.mjs, cadence-core/config.schema.json, cadence-core/bin/config.test.mjs
- **Action:** `checkValue` in `bin/config.mjs` is the write face every typed
  forge answer passes through - `checkPairs` calls it for `set` and `check`, and
  `validate` calls it for a whole file - and today it judges `git.forge_repo`
  and `git.forge_host` as nothing narrower than `string_or_null`
  (`config.schema.json:56-57`). Give a schema spec an optional per-key GRAMMAR
  marker that `checkValue` evaluates after the type check has already passed,
  resolving it through a frozen registry of named predicates in `config.mjs`:
  register the slug grammar (`isForgeSlug`, imported from
  `lib/forge-decision.mjs` rather than restated) on `git.forge_repo`, and task
  1's host grammar on `git.forge_host`. A `null` value skips the grammar - null
  is the schema default on both keys and means the question was never asked, and
  making null fail would refuse the scaffolded `templates/config.json`.
  A marker naming a predicate the registry does not hold must be an ERROR from
  `checkValue`, in the same shape its `default:` arm already answers an unknown
  `spec.type`. Never a no-op: a marker silently treated as satisfied would let a
  future key claim a grammar nothing enforces, which is the silent pass
  `lib/schema-eval.mjs`'s header refuses at length for the same reason.
  The refusal string is what a user reads, so it must say what is wrong with the
  value - not merely that it failed - and the two keys refuse for different
  reasons, so give each grammar its own sentence. Do not widen either key's
  `type`; both stay `string_or_null` so the catalog's `str|null` column and the
  `keys` dump stay true. Update `_meta` at the head of `config.schema.json` so
  the marker is documented where `types` documents the type vocabulary, and
  extend `git.forge_host`'s `purpose` to state that the value may carry a port -
  `purpose` is where a user setting the value reads what it takes, which is the
  contract self-verify's config-reach check already leans on.
  Leave `git.forge_provider`, `git.forge_repo`'s `repo_only` marker and every
  other key untouched: `config.test.mjs` asserts the `repo_only` set is exactly
  `['git.forge_repo', 'git.auto_close']` and that `git.forge_host` carries no
  such marker, and neither fact moves here.
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes with new
  arms showing: `set git.forge_host=forge.example:3001` writes and
  `get git.forge_host` returns `forge.example:3001`; `set git.forge_host=` with
  a space, a leading `-`, `:0443`, `:70000` or a trailing `/path` refuses with
  `reason:"invalid"`, an error naming `git.forge_host`, and the target file
  unchanged on disk; `set git.forge_repo=onlyowner` and a `git.forge_repo` with
  a leading-`-` segment refuse the same way while `owner/name` and
  `group/sub/repo` still write; `set git.forge_host=null` and
  `set git.forge_repo=null` still write null; and a fixture schema (through
  `CADENCE_CONFIG_SCHEMA` with `CADENCE_TEST_SEAM` set, the gate
  `config.test.mjs:810` already uses) whose key names an unregistered grammar
  marker refuses that key rather than accepting any value for it. Also
  `node cadence-core/bin/config.mjs validate --file .planning/config.json`
  reports `ok:true` on this repository's own layer.

### Task 3: Carry the port from `git.forge_host` into the login match

- **Files:** cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-decision.test.mjs, cadence-core/bin/issue-check.test.mjs, cadence-core/bin/issue-filing.test.mjs
- **Action:** `teaLoginNameForHost` (`lib/issue-decision.mjs:520`) lowercases the
  persisted host and hands it to `loginNamesHost` as a bare hostname, so the
  optional `httpPort` third argument `loginNamesHost` already takes is null on
  every land-time call - the gap `.planning/ARCHIVE.md:756` recorded and GH-106
  was filed on. Split the host it is given with task 1's grammar and pass BOTH
  halves: the hostname where the hostname goes, the port as the `httpPort`
  argument. The port half must reach `loginNamesHost` as the same comparable
  decimal string `httpPortOf` produces, which task 1's no-leading-zero rule is
  what guarantees. A host carrying no port must produce a call byte for byte
  identical to today's - the port is a VETO and not a new requirement, as
  `loginNamesHost`'s header states, and every login resolving today must keep
  resolving. A host the grammar REFUSES answers null, the same answer an empty
  or non-string host already gets: this function's null is the caller's cue to
  take its `no-login` line, and there is no honest repair for a host that could
  not have been persisted through the write face task 2 built.
  Update the function's header where it now states the predicate's vocabulary is
  handed a host alone, and update `loginNamesHost`'s own header where it states
  that `httpPort` is null on "every land-time call - the persisted
  `git.forge_host` is a host and states no port". That sentence becomes false in
  this task, and leaving it standing is how the next reader re-derives the
  defect. Change nothing in `bin/issue-check.mjs` or `bin/issue-filing.mjs`:
  both already pass the persisted value straight through, and the whole point of
  putting the split here is that neither caller learns a host rule of its own.
- **Verify:** `node --test cadence-core/bin/issue-decision.test.mjs` passes with
  new arms showing: given two login records on one hostname whose `url`s name
  ports 3000 and 3001, `teaLoginNameForHost(logins, 'forge.example.com:3001')`
  returns the 3001 login's name and `...:3000` returns the 3000 one;
  `...:443` matches a login whose `url` is `https://forge.example.com` with no
  port spelled; a portless `forge.example.com` still returns the FIRST record in
  list order, unchanged; a port that matches no login returns null; and a host
  the grammar refuses returns null rather than throwing. `node --test
  cadence-core/bin/issue-check.test.mjs cadence-core/bin/issue-filing.test.mjs`
  stays green with no assertion loosened.

### Task 4: Report whether an origin URL SPELLED a port

- **Files:** cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-decision.test.mjs
- **Action:** `classifyOrigin` (`lib/issue-decision.mjs:475`) returns `httpPort`,
  which is deliberately null for two DIFFERENT situations that task 5 has to
  tell apart: a URL that spelled no port at all (the scp form `git@host:o/r.git`,
  whose colon separates host from path and which has no port syntax) and a URL
  that spelled one over a scheme whose port is not comparable to an API url's
  (`ssh://git@host:2222/o/r.git`). Add one further fact to the classification
  saying whether the URL SPELLED a port, alongside `httpPort` and leaving
  `httpPort`'s meaning and every existing reader of it untouched - the rule
  `httpPortOf`'s header states about non-http(s) schemes is correct and is not
  being revised here. Derive it in `splitOrigin`, off the SAME `AUTHORITY` match
  that already yields the port group, so no second URL grammar appears: the
  schemed branch spelled a port when that group matched, and the scp branch never
  spelled one. Say in the header what the new fact is FOR - a caller that must
  decide whether a URL could have named a non-default endpoint at all - so it is
  not read as a second port comparison beside `httpPort`.
- **Verify:** `node --test cadence-core/bin/issue-decision.test.mjs` passes with
  new arms showing the three cases distinguished:
  `https://forge.example.com/o/r.git` spells no port and reports httpPort `443`;
  `https://forge.example.com:3001/o/r.git` spells one and reports `3001`;
  `ssh://git@forge.example.com:2222/o/r.git` spells one and reports httpPort
  null; `git@forge.example.com:o/r.git` spells none and reports httpPort null.
  Every existing arm in that file passes unchanged.

### Task 5: Refuse a `--remote-url` whose port the configured instance does not serve

- **Files:** cadence-core/bin/forge.mjs, cadence-core/bin/forge.test.mjs
- **Action:** `create` in `bin/forge.mjs` validates the SHAPE of `--remote-url`
  through `classifyOrigin` and treats its correctness as the caller's job, so a
  wrong-port `origin` is wired silently - `.planning/ARCHIVE.md:752`, GH-103.
  Give `create` the instance the repository already named: read the merged
  config for `dir` exactly as `detect` does at `forge.mjs:258`, take
  `git.forge_host`, and split it with task 1's grammar. Then, BEFORE the PATH
  check at `forge.mjs:403` and before the login probe, so that a refusal has
  spawned nothing at all:
  When the persisted host names NO port, nothing below fires and behaviour is
  byte for byte what it is today. That is what keeps `github` and `gitlab` out
  of this entirely - their `git.forge_host` is null by contract - so the check is
  keyed on the persisted port and never on the provider name.
  When it names a port AND the `--remote-url`'s host equals that hostname:
  (a) an http(s) URL whose port - spelled, or its scheme's default - differs from
  the persisted port is REFUSED, naming both ports; (b) a URL that spelled no
  port and is not http(s), which is the scp form, is REFUSED naming the port it
  implies (22, SSH's default) and the persisted port, because an scp URL has no
  syntax that could ever name the instance the user configured; (c) a URL that
  spelled a port over a non-http(s) scheme is ACCEPTED, because an SSH port and a
  web port are different endpoints of one instance and comparing them is exactly
  the mistake `httpPortOf`'s header records. A `--remote-url` naming a DIFFERENT
  host is not compared at all: that is the split-endpoint deployment this
  repository itself has, and refusing it would refuse a working shape.
  Arm (b) is the observed fixture and its refusal must be ESCAPABLE, so the hint
  names the explicit spellings that pass - `ssh://<host>:<port>/<owner>/<name>.git`
  or `https://<host>:<port>/<owner>/<name>.git` - rather than leaving a user with
  a real SSH-on-22 instance no way through.
  Two things in the file's own record become false and must be corrected in the
  same edit, not left standing: the header's "`create` reads no config and is
  given no host of its own" (lines 78-84) and the usage block's description of
  `create --dir` as the directory the CLI is run in, which is now also the
  planning root the record is read from. Bind the `warnings[]` the merge returns
  and surface it on the create envelope the way `detect` does at
  `forge.mjs:298-303`; a torn config layer during the one face that MUTATES a
  forge must not be silent, and self-verify's merge-warnings check reads that
  binding. No third-party output reaches the envelope: the two ports named in
  the refusal are the persisted config value and the caller's own argument, never
  a byte a CLI printed.
- **Verify:** `node --test cadence-core/bin/forge.test.mjs` passes with new arms,
  each built on the harness's `planningRoot({...})` and asserting an EMPTY
  `$CAD_ARGV_LOG` and an empty spawn marker: with
  `git.forge_host: 'forge.example.com:3001'`, `--provider forgejo --remote-url
  https://forge.example.com/o/r.git` refuses with both `3001` and `443` present
  in the reason, and `--remote-url git@forge.example.com:o/r.git` refuses with
  both `3001` and `22` present; `--remote-url
  https://forge.example.com:3001/o/r.git` and `--remote-url
  ssh://git@forge.example.com:2222/o/r.git` both reach the create;
  `--remote-url https://ssh.example.com/o/r.git` reaches the create because the
  host differs; and with `git.forge_host` null or portless every existing create
  arm in the file passes unchanged. The success envelope carries `warnings`.

### Task 6: Refuse a `--remote-url` on the gitlab arm

- **Files:** cadence-core/bin/forge.mjs, cadence-core/bin/forge.test.mjs
- **Action:** `CREATE_TABLE`'s gitlab row pins `--remoteName origin` in its own
  argv (`lib/forge-decision.mjs:465-466`) and its `wiresRemote` is `true`, so
  `create` never reads `--remote-url` on that arm and a caller who passes one
  gets silence - GH-105. Refuse it instead, at the `row.wiresRemote` branch
  (`forge.mjs:391`) which is already where the question "does this run need a
  URL" is answered off the table rather than off a provider's name: make it the
  other side of that same decision so both answers sit in one place. The refusal
  must name the CONFLICT rather than merely decline the flag - that this
  provider's pinned create argv wires `origin` itself through `--remoteName
  origin`, so a URL passed here would be read by nothing and the origin would be
  whatever `glab` chose - and the hint must say to drop the flag. Key it on
  `row.wiresRemote`, never on the string `gitlab`: a fourth provider row that
  wires its own remote must inherit this refusal rather than need it written
  again. Fire it before the PATH check and before any spawn, per the header's
  "EVERY REFUSAL PRECEDES THE CREATE". Leave the existing no-URL refusal on the
  other two arms exactly as it is.
- **Verify:** `node --test cadence-core/bin/forge.test.mjs` passes with a new arm
  showing `create --provider gitlab --repo o/r --confirmed --remote-url
  https://gitlab.com/o/r.git` exits 1 with `ok:false`, a reason mentioning
  `--remoteName origin`, an empty `$CAD_ARGV_LOG` and an empty spawn marker;
  and the existing arm `create: the gitlab arm is never asked for a
  --remote-url` still passes, still producing exactly
  `glab repo create o/r --private --remoteName origin`.

### Task 7: Ask for the port, and carry it whole into the URL setup builds

- **Files:** cadence-core/workflows/new-project.md, cadence-core/workflows/adopt.md, cadence-core/bin/weight-budgets.json
- **Action:** Question c of the forge step - "Which Forgejo instance", at
  `new-project.md:108` and `adopt.md:95` - tells the user to give the host they
  reach in a BROWSER and says nothing about a port, so a user on
  `forge.example:3001` has no prompt that admits their answer. In BOTH files add
  to that question that the value may carry a port when the instance is not on
  the default one, spelled `host:port`, and that it is the port they reach in a
  browser and not their SSH port - the distinction task 5's refusal turns on.
  Do not touch the existing sentence about the browser host versus the SSH
  endpoint; it is still correct and is the reason a derived default is never
  offered.
  In `new-project.md` only - `adopt.md` has no create arm - the sentence that
  builds `--remote-url` (`new-project.md:186`, "on `forgejo` build it from the
  `git.forge_host` just confirmed above ... `https://<host>/<owner>/<name>.git`")
  must say the confirmed value goes in WHOLE, port included, because dropping it
  is now a refusal from the seam rather than a silently wrong origin.
  Both files sit exactly on their `weight-budgets.json` ceilings (25913 and
  20810), so re-pin both entries in the same commit; `self-verify`'s budget check
  fails the build otherwise. Do not move the `forge.mjs" create` invocation or
  the `Create <owner>/<name> on <provider> now?` confirmation relative to each
  other, and do not add a second `forge.mjs" create` invocation:
  `prose-agreement.test.mjs` asserts that ordering and that count by offset.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs
  cadence-core/bin/deferred-reads.test.mjs` passes, `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with an empty `problems`
  array, and `grep -n 'host:port' cadence-core/workflows/new-project.md
  cadence-core/workflows/adopt.md` shows the spelling present in both files.

### Task 8: State the port grammar on the two reference surfaces

- **Files:** cadence-core/references/config-catalog.md, cadence-core/references/config-reach.md, cadence-core/bin/weight-budgets.json
- **Action:** Criterion 5 requires every changed config key registered in
  `config-catalog.md`, and criterion 1 requires the resolution of OQ-2 stated
  there either way. Update the `git.forge_host` row
  (`config-catalog.md:53`): its **Value → Explanation** column reads `hostname,
  or empty→null` and must now state `hostname`, or `hostname:port` when the
  instance is not on the default port. The **Type** column stays `str|null`,
  because task 2 did not widen the key's type - the grammar is a narrowing of a
  string, not a new type, and the type key at the head of this file must keep
  meaning what it says. Update `git.forge_repo`'s row (`:52`) in the same pass to
  state that the slug is shape-checked at the write face, so the two keys read
  as the pair they are.
  In `config-reach.md`, `git.forge_host`'s reach row (`:149`) lists its readers -
  `bin/forge.mjs detect` and `bin/issue-check.mjs` - and gains one: task 5 makes
  `bin/forge.mjs create` read it to decide whether the `--remote-url` names the
  port the instance serves. Add that reader to the row. The reach stays
  `universal`, so no `purpose` clause is owed, but the row must be complete or
  self-verify's config-reach check is measuring a list that no longer describes
  the key.
  Both files sit exactly on their `weight-budgets.json` ceilings (12719 and
  23586); re-pin both entries in the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with an
  empty `problems` array, `node cadence-core/bin/test.mjs` runs the whole suite
  green, and `grep -n 'hostname:port' cadence-core/references/config-catalog.md`
  shows the grammar stated on the `git.forge_host` row.

## Notes

- **OQ-2 is answered in this plan** (see Context) rather than deferred: the port
  grammar arm. Criterion 1 is delivered as its primary reading and the
  alternative clause is not exercised.
- Every task's Verify is scoped to the test stems it touches so a task stays
  independently checkable; task 8 carries the whole-suite and `self-verify`
  runs criterion 5 asks for, and task 7 carries the second `self-verify` run
  because the budget re-pin is where that check most easily reddens.
- The two `weight-budgets.json` re-pins are split across tasks 7 and 8 because
  each belongs in the same commit as the surface that grew. That makes those two
  tasks share a declared file and therefore ORDERED, which is one reason this
  phase is a single plan rather than a split.
- **GH-102 folded in as a verification, not a task.** AC7's reachable half went
  unproven at the `v3.7.1` close (`.planning/ARCHIVE.md:751`) because
  `git ls-remote` hit `Host key verification failed` with no TTY. Re-measured
  2026-08-27 from this execution environment: `ssh.jcrenshaw.dev:2222` is in
  `known_hosts`, and
  `git ls-remote --exit-code ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence-archived.git HEAD`
  exits 0 under `BatchMode=yes` and `StrictHostKeyChecking=yes`. The blocker is
  gone, so the reachability proof belongs in this phase's UAT rather than in a
  ninth task - the phase already sits at the 8-task dispatch ceiling, and
  nothing about proving an origin answers requires a code change of its own.
- Nothing here touches `.planning/config.json`; this repository's own
  `git.forge_host` is null and its `git.forge_repo` is `crenshawdev/cadence`,
  which the new grammars accept unchanged.
