PLAN COMPLETE
Plan: .planning/phases/1/PLAN-1.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1 - State the ARCHIVE.md residue grammar, once | 373c4be | `parseArchiveRows` / `appendArchiveRows` in `lib/planning-files.mjs`, one home beside the other corpus parsers; 10 grammar cases, suite 272/272 |
| 2 - Fold ARCHIVE.md into the recall corpus | 96f2442 | `cmdRecall` appends archived rows LAST through the same guarded `read()`, one flat BM25 ranking (D-05); 4 new recall cases |
| 3 - milestone-prune writes the residue before the directories go | 1394ead | Read + append ahead of the directory loop over the CANDIDATE set, per-label containment guard for idempotence, `residue_rows` on the envelope; 5 new seam cases |
| 4 - The end-to-end falsifier, with its watched FAIL | bc6fd92 | Two CLI-only cases (`delete` and `archive`), no task-1 import; watched failing at `182d2e1` - worktree run exit 1, `0 !== 1` at milestone-prune.test.mjs:949 on the post-close recall |
| 5 - The close stages the residue it just wrote | 0c5ce62, ef5de14 | milestone.md step 3 states the write, relays `residue_rows`, stages `.planning/ARCHIVE.md` with the why-not-transient clause; budget re-pinned 10797 -> 11413 |
| 6 - The recall contract names an archived row | 261c6d2 | `## The return` names the leading-label `source` and why there is no recency term or per-source cap; recall.md budget re-pinned 2831 -> 3472 |
Deviations: none
Open items:
- Declined a dedicated `write-failed` reason for the residue write. `atomicWrite` on `.planning/ARCHIVE.md` throws through the dispatcher as `fail('internal', ...)`, which is a refusal with nothing yet removed (the write is the first one in the seam and precedes the directory loop), so the task's `Verify:` is met by the existing path. Give it its own reason if a task ever needs the caller to branch on it.
- `ef5de14` corrects a sentence `0c5ce62` shipped: `residue_rows: 0` was described as "nothing was indexable", which is false on the re-run arm where the milestone's heading already carries the rows. Same task, same lease, fixed in a follow-on commit rather than left in shipped prose.
