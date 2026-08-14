PLAN COMPLETE
Plan: .planning/phases/1/PLAN-1.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1. The guarded capture seam, wired end to end | cc469f7 | `lib/capture-file.mjs` + `planning.mjs capture` + the `CONTRACTS` row; all four Verify commands matched prediction exactly |
| 2. Prove the walk membership, and prove the proof can fail | ccf3482 | 21 module/CLI rows, plus the AC1 capture->recall round trip and its `## Archive` falsifier; pointing the module's `todo` heading at `## Archive` turns BOTH rows red, reverted after checking |
| 3. The concurrent-append guard | 1847c94 | `withCaptureLock`: `wx` exclusive create, jittered 500 ms retry budget, 120 s mtime stale break, `finally` release. 20-writer, held-lock and stale-lock rows; bypassing `takeLock` reddens the first two, so the guard is load-bearing |
| 4. Route debt-harvest through the seam | 16bd5e1 | `replaceSection` moved verbatim into the module; `cmdDebtHarvest`'s read-modify-write now runs under the same lock. Its tests are unedited (`git diff --stat` empty) and green; `planning.mjs` holds only the import |
| 5. /cad-capture writes through the seam | f8a004a | Steps 2-3 collapsed into the seam call, `--cadence` arm on `--file`, restated bullet format deleted, `ok:false` branch added, `Write`/`Edit` grants dropped. Budget row re-pinned 4839 -> 5533 (D-10) |
| 6. /cad-execute's open-items append writes through the seam | 852d245 | One `capture --kind todo` call per open item; `grep "phase <N>) <text>"` returns nothing. Budget row re-pinned 24828 -> 24992 (D-10) |

Deviations: none

Open items: `skills/cad-capture/SKILL.md` still declares `Read` in
`allowed-tools` although no remaining step reads a file - step 1's cursor read
and step 4's path resolution are both Bash. Task 5's Action named `Write` and
`Edit` specifically, and no `Verify:` exercises `Read`, so it was left in place
rather than removed on my own judgment; drop it when a task states the grant
audit.

Notes for the phase record (not deviations, no criterion moved):

- Task 1's `res.ok === false` is spelled out rather than `!res.ok`. Under
  `tsconfig.ci.json`'s `strict:false`, truthiness narrowing on a boolean-literal
  discriminant does not fire and `tsc` reported TS2339 on both `res.reason` and
  `res.detail`; the explicit comparison narrows. Same reason the `guarded`
  binding is annotated with its union spelled out instead of
  `ReturnType<typeof withCaptureLock>` - that helper is generic in its
  callback's return, and `ReturnType` erases the argument to `unknown`.
- `appendCapture` creates the target's PARENT directory when the file is absent.
  The plan's task 1 `Verify:` writes `--file <tmp>/elsewhere/CAPTURE.md` into a
  directory that does not exist, and `atomicWrite` renames a sibling temp into
  place, so the parent has to be there first. It is also what
  `/cad-capture --cadence`'s `~/.claude/cadence/` needs on a first run.
- `--text` is flattened to one line (any newline run becomes a single space).
  A multi-line bullet's second line is not a bullet, so the recall walk drops it
  in silence - this phase's headline bug arriving through the front door. One
  row pins it, including that no `## ` heading can be injected that way.
- `/cad-capture`'s steps renumber 1-5 to 1-4 because the plan directs steps 2
  and 3 to collapse into one seam call. Nothing outside the file cites those
  numbers (checked); the one comment in `lib/capture-file.mjs` that named
  "step 4" now names "the commit step" instead.
