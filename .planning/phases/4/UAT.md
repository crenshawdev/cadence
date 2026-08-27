---
status: testing
phase: 4
fields_version: 1
started: 2026-08-27
updated: 2026-08-27
---

## Items

### 1. An abandoned claim rotates on the next append
expected: On a trace root at or over 1 MiB whose trace.1.jsonl is a hard link to the live record and whose sidecar mtime is older than 30 s, the next appendEvent reports {written:true}, the live record is afterward under MAX_TRACE_BYTES, and trace.1.jsonl is a separate inode holding the prior generation.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Scratch probe on a directly built claim (linkSync + sidecar backdated 60 s): {written:true,corr:'1-abc1234'}, live record 354 bytes (under MAX_TRACE_BYTES), sibling a separate inode of 1,048,575 bytes whose first line is the anchor, appended event present in the live record. Also green through the CLI seam and via the named test at cadence-core/bin/trace.test.mjs:235.

### 2. After the reclaim the claim is gone and the cost stops
expected: statSync on the live record reports nlink === 1, and the following append completes in under 50 ms, against the 252/252/255 ms measured per append while the claim stood.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: statSync(live).nlink === 1 after the reclaim; the next appendEvent returned {written:true} in 0 ms measured across the call, against 252/252/255 ms while the claim stood. Named test at cadence-core/bin/trace.test.mjs:262.

### 3. A fresh sidecar leaves the claim standing
expected: With a sidecar mtime NEWER than 30 s, rotateTrace returns {rotated:false}, trace.1.jsonl still shares the live record's inode, and no .evict. file exists in the root.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: rotateTrace(dir,120) on a fixture whose sidecar was written NOW returned {rotated:false} with sameIno true, nlink 2, the live record's bytes unchanged and no .evict. file in the root.

### 4. A missing sidecar reads as live, never abandoned
expected: With the sibling present as a hard link and NO sidecar at all, rotateTrace returns {rotated:false} and leaves the claim in place.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: rotateTrace(dir,120) with no sidecar at all returned {rotated:false}, sameIno true, nlink 2, and left no sidecar behind - claimAbandoned's catch answers false (cadence-core/bin/lib/trace.mjs:614-620).

### 5. The sidecar name is spelled once and accounted for
expected: The sidecar name appears exactly once in the source as an export, .gitignore ignores it beside /.planning/trace.1.jsonl, and trace.test.mjs's siblings() helper accounts for it with the existing six-writer race tests still green.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: grep -rn 'trace\.1\.jsonl\.claim' cadence-core/ returns nothing - the name is only derived, at cadence-core/bin/lib/trace.mjs:138. git check-ignore exits 0 on .gitignore:34 (sidecar) and :35 (private stamp). siblings()/ROTATED_SET (cadence-core/bin/trace.test.mjs:133,136) carry the sidecar into 8 assertions including the six-writer race, all green.

### 6. The suite and self-verify are green
expected: node cadence-core/bin/test.mjs is green and node cadence-core/bin/self-verify.mjs reports ok:true.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs: 3490 pass / 0 fail. node cadence-core/bin/self-verify.mjs: ok:true, problems [].

### 7. A losing append does not restart the abandoned-claim clock
expected: An append that loses the linkSync writes its stamp to a private path, never the shared sidecar, so a record appended more often than 30 s still ages into a reclaim instead of having its claim refreshed forever.
status: pass
first_pass: pass
source: verifier
evidence: Three consecutive losing appends against a claim dated 20 s ago left the sidecar's mtime byte-identical and its age growing (20252, 20505, 20757 ms), and the same sidecar aged past 30 s then reclaimed on the next append. The stamp goes to `${claim}.${priv}` and only publish() moves it (cadence-core/bin/lib/trace.mjs:688-693, :747, :947).

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
