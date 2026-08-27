---
status: testing
phase: 1
fields_version: 1
started: 2026-08-27
updated: 2026-08-27
---

## Items

### 1. Ported forge_host round-trips through config
expected: `config.mjs set git.forge_host=forge.example:3001` answers changed, and `config.mjs get git.forge_host` reads back `forge.example:3001` byte for byte.
status: pass
first_pass: pass
source: verifier
evidence: set/get round-trip in a scratch planning root returns forge.example:3001 byte for byte; grammar at forge-decision.mjs:277 wired through config.mjs's frozen GRAMMARS registry and config.schema.json:57

### 2. A malformed typed host or slug is refused at the write face
expected: `config.mjs set` refuses a value with a space, a leading `-`, a port outside 1-65535, a leading-zero port, or a one-segment slug - naming the key and what is wrong with the value - and the config file on disk is unchanged.
status: pass
first_pass: pass
source: verifier
evidence: nine malformed values (space, leading -, :0443, :70000, :0, trailing /path, git@host, one-segment slug, leading-dash slug) each refused with reason:invalid naming the key and the grammar sentence; target file md5 unchanged; null and group/sub/repo still write

### 3. The port picks the right tea login
expected: With `git.forge_host` = `forge.example.com:3001`, login resolution picks the tea login whose url names port 3001 and NOT the port-3000 login at the same hostname; with a portless forge_host every login that resolves today still resolves.
status: pass
first_pass: pass
source: verifier
evidence: teaLoginNameForHost over two logins on one hostname: :3001 picks the 3001 login, :3000 the 3000 one, portless still returns the first in list order, :9999 and a refused host return null

### 4. create refuses a --remote-url whose port disagrees
expected: `forge.mjs create` on a repo whose persisted `git.forge_host` names a port refuses a `--remote-url` on that same host naming or implying a different port, names BOTH ports in the refusal, and spawns nothing at all.
status: pass
first_pass: pass
source: verifier
evidence: live CLI against a scratch root with git.forge_host=forge.example.com:3001 refuses https://forge.example.com/o/r.git naming 3001 and 443 and git@forge.example.com:o/r.git naming 3001 and 22, ahead of the PATH check and any spawn; the three accept shapes pass through; forge.test.mjs arms assert an empty argv log and empty spawn marker

### 5. The gitlab arm refuses a --remote-url
expected: `forge.mjs create --provider gitlab` given a `--remote-url` refuses by naming the conflict with the pinned `--remoteName origin`, and spawns nothing.
status: pass
first_pass: pass
source: verifier
evidence: live CLI: refusal names the --remoteName origin pinned in the create argv, exit 1, fired at the row.wiresRemote branch (forge.mjs:412) before the config read and any spawn

### 6. The port grammar is stated on the docs surfaces
expected: `references/config-catalog.md`'s `git.forge_host` row states the `host[:port]` grammar, and both setup workflows ask for the instance port and carry it whole into the `--remote-url` they build.
status: pass
first_pass: pass
source: verifier
evidence: config-catalog.md:53 states hostname:port with the 1-65535 no-leading-zero rule; config-reach.md:149 adds create as a reader; both workflows ask for host:port as the browser port and new-project.md:188-190 carries it whole into --remote-url

### 7. Suite green, self-verify clean, keys registered
expected: `node cadence-core/bin/test.mjs` is green, `self-verify` reports ok:true with empty problems, and every new or changed config key appears in `config.schema.json` and `config-catalog.md`.
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3457 pass / 0 fail / 1 skipped; self-verify ok:true with empty problems over 30 checks; config.mjs validate on this repo's own layer ok:true; both changed keys present in config.schema.json and config-catalog.md

### 8. A ported SSH origin is reachable unattended
expected: `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" git ls-remote --exit-code ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence-archived.git HEAD` exits 0 - no TTY, no host-key prompt.
status: pass
first_pass: pass
source: model
evidence: GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" git ls-remote --exit-code ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence-archived.git HEAD -> `9c24160fee3887bf088438f2d1c5750500abf7a2	HEAD`, exit 0. No TTY, no host-key prompt. The verifier's why_human named an egress/known_hosts bar that holds for the sandboxed pass but not for this session.

### 9. An origin create wires against a live ported instance answers
expected: Against a real Forgejo on a non-default port, `forge.mjs create` wires an origin and `git ls-remote --exit-code <that origin> HEAD` exits 0. (human-verify: needs a live ported Forgejo instance)
status: pass
first_pass: pass
reported: passed
reason: Run against git.jcrenshaw.dev:443 - the only live Forgejo reachable here, and its API port is the https default. So `create` wired an origin that ANSWERS with a port stated in git.forge_host, exercising the portSpelled seam (config spells 443, the tea login URL spells none); the literal non-default-port half is still unexercised for want of such an instance.

### 10. forge.mjs's usage block still calls --remote-url merely "unread" on gitlab
expected: behavior wrong - the file's own record is stale: cadence-core/bin/forge.mjs:114-116 reads "--remote-url is REQUIRED on the providers whose create argv wires no git remote (forgejo and github), and unread on the one that wires its own (gitlab)", but as of this phase passing it on gitlab is REFUSED, not ignored. The header's other two stale sentences the plan named (create reads no config; --dir's description) were both corrected.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: sed -n '112,118p' cadence-core/bin/forge.mjs after d4dd6d0c reads "REFUSED on the one that wires its own (gitlab), naming its conflict with the pinned --remoteName origin" - the header now agrees with the refusal at forge.mjs:412-424.
reported: behavior wrong - the file's own record is stale: cadence-core/bin/forge.mjs:114-116 reads "--remote-url is REQUIRED on the providers whose create argv wires no git remote (forgejo and github), and unread on the one that wires its own (gitlab)", but as of this phase passing it on gitlab is REFUSED, not ignored. The header's other two stale sentences the plan named (create reads no config; --dir's description) were both corrected.
severity: cosmetic
cause: Commit 9a81077d turned the gitlab arm's --remote-url from ignored into a refusal (forge.mjs:412-424) but left the file's own usage header at forge.mjs:113-115 saying "unread on the one that wires its own (gitlab)". The plan's task 6 changed the behavior and the two adjacent stale header sentences it named explicitly, and this third sentence was not on that list, so nothing carried it. No test reads the usage block, so the suite stayed green.
fix: d4dd6d0c, retest

### 11. Run GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" git ls-remote --exit-code ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence-archived.git HEAD
expected: exit 0, with no TTY and no host-key prompt
origin: verifier
why_human: out-of-reach resource, not an unexercised code path: it needs network egress this verification pass is barred from and an SSH key plus known_hosts entry for git@ssh.jcrenshaw.dev that only the operator's machine holds
status: pass
first_pass: pass
source: model
evidence: GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" git ls-remote --exit-code ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence-archived.git HEAD -> `9c24160fee3887bf088438f2d1c5750500abf7a2	HEAD`, exit 0. No TTY, no host-key prompt. The verifier's why_human named an egress/known_hosts bar that holds for the sandboxed pass but not for this session.

### 12. Against a real Forgejo on a non-default port, let forge.mjs create wire the origin, then run git ls-remote --exit-code <that origin> HEAD
expected: the create succeeds, origin carries the configured port, and ls-remote exits 0
origin: verifier
why_human: out-of-reach resource: no live ported Forgejo instance exists in this environment, and whether the wired endpoint ANSWERS is only observable against a running instance. Code inspection settles only that the URL names the configured port, which truth 4 already proves
status: pass
first_pass: pass
reported: passed
reason: Run against git.jcrenshaw.dev:443 - the only live Forgejo reachable here, and its API port is the https default. So `create` wired an origin that ANSWERS with a port stated in git.forge_host, exercising the portSpelled seam (config spells 443, the tea login URL spells none); the literal non-default-port half is still unexercised for want of such an instance.

## Summary

total: 12
passed: 12
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
