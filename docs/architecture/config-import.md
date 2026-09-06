# Config and import

The binary stores repo configuration in `.planning/config.v4.json` and global
configuration in a `config.v4.json` sibling of the resolved legacy global file.
Resolve both original identities before mapping destinations. If they alias,
there is one versioned destination with repo provenance. Explicit global request
intent remains separate: it cannot bypass the new-global-write guard on
`git.forge_repo`. An existing imported global slug keeps its actual global
provenance and a scope diagnostic, matching frozen merged readers.

Config changes are external participants in the existing store transaction. The
writer checks current config at admission and again before installing the durable
intent; a proposed new setting cannot authorize its own installation. Source bytes
and filesystem identity are re-read synchronously. Failure makes current config
unavailable. No watcher supplies correctness. Successful updates are visible on
the next operation. A changed config target binding requires reopening the session
before a config write; ordinary policy reads follow current resolved identities.

Repo wins over global, objects recurse, arrays/scalars/null replace, and absence
inherits. Defaults are read inputs and never persisted by config writes. Raw
layers preserve presence, source and unknown data as non-effective evidence;
effective values exclude unknown and retired keys. Scope diagnostics, invalid-layer
diagnostics and migration diagnostics have independent channels. Repo test/lint
commands and provider-key paths cannot suppress trusted global settings, even by
null or a blocking non-object ancestor. Credential files themselves are never read
by config translation.

The embedded schema lists all 94 frozen leaves: 80 keep-resemantic and 14 dead.
All eight D-06 retirements and six `workflow.max_dispatch_tokens.*` leaves are
non-effective, with no read defaults. `planning.max_capture_bullets` retains its
integer/path but reports active captured identities in **items**, excluding
completed, filed and declined identities. Revisions and continuation lines are not
units. A crossing never refuses an append. The old token windows are not budgets
and are not imported as enforced limits.

Explicit writes validate frozen types, bounds, enum membership, and forge grammars
(including 200-character slug and 253-character host limits). Import preserves the
unanswered null risk-surface arrays, while explicit writes require arrays. Legacy
role keys and `roles.*` remain separate; null fallback policy belongs to routing.

The original config files remain byte-identical. Rollback must remove the named
new outputs by hand; `git checkout` does not delete untracked versioned files.
