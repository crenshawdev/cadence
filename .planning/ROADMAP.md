# Roadmap

## Overview

**`v3.5.2 - one reader, one transport`, opened 2026-08-16.** Scoped off the
Forgejo milestone, which holds two issues: #133 and #132.

**The theme is one sentence: two places that must agree about the same thing
were written twice, and the copies drifted.** Both issues came out of an
external deep dive against `v3.3.0`, both were adjudicated AGREE-high, and
neither is a bug a user has hit yet - they are surfaces where the tree already
concedes the correct rule in one place and prescribes the wrong one elsewhere.
That makes both cheap to fix and easy to reintroduce, which is why each phase
ships a check rather than only a correction.

`#133` is the shell transport. `planning.mjs:3815` already states why
caller-derived prose cannot ride in a double-quoted shell word: an item carrying
`$(...)` or a backtick executes before Node starts, and a path cannot. That
reasoning is conceded for `capture` alone, and roughly sixteen other workflow
sites still prescribe the unsafe form for values derived from agent output or
repository content. The fix is the transport stated once and applied everywhere
it governs, not sixteen local escapes.

`#132` is the lease. `plan-overlap` intersects declared `files:` by exact string
equality (`planning.mjs:1788`) while `lease-check` reads a trailing slash as a
directory prefix (`planning.mjs:2217-2218`), so a phase declaring `src/` in one
plan and `src/auth.js` in another produces an empty `overlaps`, passes the
parallel-safety gate, and then authorizes both plans to stage the same file.
`references/plan-frontmatter.md` documents no trailing-slash form, which bounds
the likelihood and not the validity: `lease-check` honours it, so it is live.
The fix shape is one shared lease-normalization module both readers call.

The two phases are independent - disjoint files, disjoint seams - and neither
depends on the other's outcome.

## Phases

- [ ] **Phase 1: One transport for caller-derived text** - the rule `planning.mjs` already concedes for one command is stated once and applied at every site that passes agent output or repository content to a seam, with a check that refuses the seventeenth
- [ ] **Phase 2: One reader for the lease grammar** - `plan-overlap` and `lease-check` resolve a declared path through one module, so the pre-flight gate cannot admit a pair the enforcement would refuse

## Phase Details

### Phase 1: One transport for caller-derived text
**Goal:** Caller-derived text reaches a seam through a transport that cannot
execute it, at every site that carries such text - not just the one command
where the reasoning is already written down.
**Depends on:** Nothing (first phase)
**Requirements:** TRN-01

`cmdCapture` states the rule in its own comment (`planning.mjs:3815-3820`):
`--text-file` is the safe transport and the one the workflows prescribe, because
`--text "<item>"` puts caller-derived prose inside a double-quoted shell word,
so an item carrying `$(...)` or a backtick executes before Node starts. A path
cannot. `--text` survives for a human typing at a shell, where the text is the
user's own.

The concession is scoped to one command and the reasoning is not. Roughly
sixteen other workflow sites hand a seam a value derived from agent output, a
plan file, a UAT finding or a requirement bullet, and prescribe the
double-quoted form for it. None of those values is the user's own typing. The
count is approximate on purpose: establishing which sites actually carry
caller-derived text - as opposed to a literal, a number, or a path the workflow
itself constructed - is work this phase does rather than an input it inherits.
A site passing `--phase 3` is not in scope and must not be swept into the fix.

The failure mode this guards is not hypothetical injection by a hostile user.
It is ordinary content: a requirement bullet containing backticks, a UAT finding
quoting a shell command, a commit subject with `$(`. Cadence's own planning docs
are full of all three.

Success criteria:
1. The transport rule is stated ONCE, in a reference the workflow sites cite
   rather than restate, and it names the test for when it governs: the value is
   derived from agent output or repository content rather than authored by the
   workflow itself.
2. Every workflow site carrying caller-derived text uses the file transport.
   The set is established by an enumeration committed as part of the phase -
   site, the value it passes, and whether that value is caller-derived - so a
   reviewer can check the classification rather than trust the count. Sites
   passing literals, numbers, or workflow-constructed paths are listed as
   out-of-scope with their reason, not silently omitted.
3. Any seam gaining a `--*-file` flag validates it the way `capture` already
   does: a missing or empty path is `bad-args`, an unreadable path is `bad-args`
   naming the read error, and passing both the inline and file forms is refused
   rather than resolved by precedence.
4. A self-verify check fails on a workflow site that prescribes the unsafe form
   for a caller-derived value, so site seventeen is refused mechanically. The
   check states what it cannot see - a value whose derivation it cannot
   determine from the text - rather than passing it silently.
5. Watched to FAIL first: the self-verify check is demonstrated failing against
   the tree as it stands, on the real sites, before the fix lands. A check that
   only ever ran green is not evidence.
6. The inline form is not deleted where the text is the user's own typing at a
   shell. This phase changes what the WORKFLOWS prescribe; it does not remove a
   human's ability to pass a string.
7. `node --test 'cadence-core/bin/*.test.mjs'` and
   `node cadence-core/bin/self-verify.mjs` both run clean.

### Phase 2: One reader for the lease grammar
**Goal:** `plan-overlap` and `lease-check` answer questions about the same
declared path through one module, so the pre-flight gate cannot admit a plan
pair whose files the enforcement would then refuse to separate.
**Depends on:** Nothing (independent of phase 1; disjoint files)
**Requirements:** LSE-01

Two readers, one grammar, opposite answers. `plan-overlap` intersects declared
`files:` by exact string equality - `declared[i].files.filter((x) =>
declared[j].files.includes(x))` at `planning.mjs:1788`. `lease-check` splits the
same declarations into `exact` and `prefixes` on a trailing slash
(`planning.mjs:2217-2218`) and honours the prefix form. So a phase declaring
`src/` in plan 1 and `src/auth.js` in plan 2 yields an empty `overlaps`, clears
the parallel-safety gate, and dispatches both plans concurrently - after which
`lease-check` considers `src/auth.js` leased to BOTH. Nested declarations
(`src/` and `src/auth/`) fail the same way for the same reason.

`references/plan-frontmatter.md` documents no trailing-slash form. That bounds
how often the shape appears; it does not bound whether it is live, because
`lease-check` honours it either way. The phase decides which reading is the
grammar - document the prefix form, or refuse it at the frontmatter reader -
rather than inheriting the assumption. `planning.mjs:2039` already notes the
frontmatter reader is shared with the overlap gate, which is why the divergence
is in the two consumers rather than in parsing.

Success criteria:
1. One module resolves a declared path to its lease meaning, and both
   `plan-overlap` and `lease-check` call it. Neither consumer re-implements
   containment, prefix handling, or normalization locally.
2. The trailing-slash question is DECIDED and the decision is recorded with its
   reasoning: either the directory-prefix form is documented in
   `references/plan-frontmatter.md` and both readers honour it, or it is refused
   at the frontmatter reader with a named diagnostic and neither reader sees it.
   A tree where one reader honours a form the grammar does not document is the
   defect, and shipping either resolution closes it.
3. `plan-overlap` reports a non-empty overlap for `src/` against `src/auth.js`,
   and for `src/` against `src/auth/`, under whichever resolution phase 2
   chooses - by refusing the declaration at parse time, or by intersecting it
   correctly. The gate never returns a clean pass on a pair `lease-check` would
   then treat as shared.
4. Both defective pairs are covered by failing-capable tests watched to FAIL
   against the current implementation before the fix lands. The existing
   fixtures pass today, which is why the divergence shipped.
5. Path normalization is settled once in the shared module rather than at each
   call site: at minimum the `./` prefix, redundant separators, and trailing
   slashes agree between the two readers. Cases the module deliberately does not
   normalize - symlinks, case folding, `..` traversal - are stated as
   out-of-scope with their reason rather than left undefined.
6. `lease-check`'s enforcement contract is unchanged for declarations that were
   already unambiguous. This phase removes a disagreement; it does not widen
   what a plan may lease, and a plan declaring no files remains unprovable and
   unsafe as it is today.
7. `node --test 'cadence-core/bin/*.test.mjs'` and
   `node cadence-core/bin/self-verify.mjs` both run clean.
