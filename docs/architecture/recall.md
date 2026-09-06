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
