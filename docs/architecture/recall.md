# Recall

Recall implements D-04 by ranking the store's eligible item projection,
semantic decisions, and authored PROJECT, ROADMAP, CONTEXT and SUMMARY prose
in one BM25 corpus. UAT findings and task RECORD receipts remain compatibility
sources. PROJECT/ROADMAP and git retrieval expand the frozen corpus.

Live sources use explicit names and phase/task/archive directory shapes,
including `_archive-*` homes. Arbitrary markdown, DECLINED, config, source
evidence quarantine and operational logs are excluded. Imported CAPTURE and
FILED contribute through records. An empty Durable decisions heading in
CONTEXT suppresses the local Decisions section, including nested headings;
other authored sections remain searchable. Paragraph continuations and literal
phase directory spellings survive. Links are conservatively skipped and
reported as incomplete coverage. Missing optional documents are empty input;
unreadable permitted sources are incomplete input.

The git adapter is a new runtime dependency in 4.0. It walks only commits
reachable from HEAD, reads trees and blobs with argument-vector subprocesses,
and never writes refs, the index, worktree or object database. Optional locks,
prompts and lazy fetching are disabled. Unborn repositories, unavailable git,
shallow history, missing blobs and other read failures produce explicit
`incomplete` reasons beside available live results. An empty result with a
coverage reason is not proof that the missing history has no matches.

Historical documents carry their exact commit, planning-relative path and
line. Identical path/blob pairs are parsed once. Equivalent live/historical
snippets coalesce by path, line, heading and content; independent documents
with equal sentences remain separate. Structured item evidence coalesces by
identity and immutable text, decisions by identity/revision/content. Current
declined identities exclude earlier item records and translated FILED ledger
rows before ranking; equal words in unrelated prose do not imply that identity.
Historical DECLINED bytes are never read into the corpus.

Legacy ARCHIVE residue is read without being maintained or rewritten. Its
actual file/line, milestone label, origin path and phase spelling are separate
fields. A live residue has no commit; a historical residue cites the commit
containing ARCHIVE, not an invented commit for its lost source. A residue
snippet never claims to reconstruct a full document.

Queries share the frozen raw-stopword-before-suffix tokenizer and deduplicate
query terms. Positive BM25 scores sort descending, with corpus position as the
tie breaker. The default response has at most five hits; `total` counts all
matches before truncation. Limits must be positive integers. `none` returns an
explicit disabled answer; unknown backends and empty queries are refused.
Ranking and rendering perform no I/O. Public MCP tool selection remains phase 5.

The resident handler's clones carry request senders. One consumer owns the
derived indexes and uses the existing session factory to obtain one store owner
per resolved planning root. Each request has its own reply channel. Version
requests do not initialize planning storage. Accepted requests drain when the
last handle closes; dropping a reply receiver does not cancel admitted work.
The store and recall index require no lock; config, first-touch import and the
session registry retain PLAN-2's synchronization under the 2026-09-06 ruling.
The factory's `Sync` bound permits its borrow across a migratable task's await;
it does not make writable store or index state shared.

Before answering, recall reads the current confirmed store view and config,
document content and file identities, and HEAD-reachable commit/blob identities.
The derived index is reused only while these inputs and coverage reasons match.
Declines, appends, document edits, checkout and config changes invalidate the
affected result. Source reads still run on every query; only the ranking index
is cached, with no watcher or durable index file. Preparation runs off the async
worker, then rechecks store and config generations before rendering. A generation
change during preparation returns a retryable conflict; a failed controlling
config reload returns unavailable/error rather than cached enablement. The
checks observe inputs at their read points, not a filesystem-wide atomic snapshot.

The process regression test extracts actual `v3.7.12` planning inputs into an
external temporary repository and uses `CadenceServer::new` in three separate
processes. One response contains an appended structured capture and authored
CONTEXT prose with exact citations before and after restart. The first process
warms an eligible filed identity twice, declines it through the owner, and
requires zero hits and total immediately afterward. The second process verifies
that exclusion survives restart, then warms and declines a second eligible
identity. The third verifies both persisted declines. Earlier FILED and eligible
structured revisions remain in git throughout. Actual serialized responses,
including snippets and totals, are checked; unchanged inputs must produce equal
results across restarts. Current decline state controls historical item identity
eligibility, while independent authored prose retains its own provenance.
