PLAN COMPLETE
Plan: .planning/phases/3/PLAN-4.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1 - Write the suggest workflow as the one statement of the rules | 6c82ec5 | `cadence-core/workflows/suggest.md` created at 5,141 B with a matching `weight-budgets.json` row; self-verify `problems:[]`, weight.mjs reports 5141 against the 5141 pin. |
| 2 - Ship `/cad-suggest` as a discoverable skill | da88390 | `skills/cad-suggest/SKILL.md` (818 B) in `cad-report`'s mold: one-line routing description, `argument-hint: "[phase]"`, `allowed-tools` exactly Read + Bash (no Write, no Edit anywhere in the file), `<execution_context>` `@`-including the new workflow only. Budget row pinned in the same commit. Verify: self-verify `problems:[]`; weight.mjs 818 against the 818 pin. Static analysis: `npx tsc -p tsconfig.ci.json` exit 0; `node --test cadence-core/bin/*.test.mjs` 1420/1420 pass. |
| 3 - Repoint the milestone close and the report footnote | 49414ea | `milestone.md` step 8 cut from 17 lines to 9: it now invokes `/cad-suggest` via SlashCommand (unscoped, matching the seam's whole-record default) and names `cadence-core/workflows/suggest.md` as where its rules live, keeping only the close's own posture (a failed or missing run degrades to a one-line note, never a halt). `report.md`'s `done` step names `/cad-suggest` and its workflow instead of the raw seam call, keeping "name it, do not run it unasked" - which is load-bearing, since `cad-report` does not declare SlashCommand. Both rows re-pinned in the same commit: milestone.md 9427 -> 9033, report.md 3750 -> 3794. Verify: self-verify `problems:[]`; both `grep -c 'workflows/suggest.md'` 1; `grep -c 'apply NOTHING' milestone.md` 0; weight.mjs 9033 and 3794 against their pins. Static analysis: tsc exit 0; 1420/1420 pass. |
| 4 - Register both new commands in the command reference | 6ba3da2 | `COMMANDS.md` gains `/cad-minimalism-review [path\|dir\|N]` under "## Review & quality gates" directly after `/cad-decision-review`, and `/cad-suggest [N]` under "## Support" after `/cad-spike` (alphabetical, health still trailing). Row re-pinned 4370 -> 4771 in the same commit; `skills/cad-help/SKILL.md` untouched, since its `@`-include IS the registration. Verify: self-verify `problems:[]`; combined grep 2; weight.mjs 4771 against the 4771 pin. Static analysis: tsc exit 0; 1420/1420 pass. |
| 5 - Update the README command lists and the skill count | fe9b9b9 | `/cad-minimalism-review` bullet added to "**Review & quality**" after `/cad-decision-review`; `/cad-suggest` bullet added to "**Support**" after `/cad-report`, both in the surrounding one-line voice with the file's own em-dash bullet form. Stale self-description corrected by RE-MEASURING, not incrementing: "Today it is 23 skills" -> 27, matching `grep -L "user-invocable: false" skills/*/SKILL.md | wc -l`; "19 rung files" already matched `ls agents/*.md | wc -l` and is unchanged, as is the rest of the GSD-comparison paragraph. README is not weight-budgeted, so nothing re-pinned. Verify: both greps 1; 27/19 equal the two measurements; self-verify `problems:[]`. Static analysis: tsc exit 0; 1420/1420 pass. |
| 6 - Carry the README shift into the claim ledger | 58a3d3b | 13 `README-*` `line` cells re-pinned to the live file (README-38 `97,115`->`97,116`, README-39 `105-128`->`105-130`, README-40 122->123, README-41 134->136, README-42/43/44 144->146, README-45 146->148, README-46 148->150, README-48 134->136, README-49/50 138->140, README-51 140->142); README-47 left at 10, it cites the install block. README-44's CLAIM text corrected to the measured sentence with `resolution` `corrected - fe9b9b9` and its `verdict` left as run 1 recorded it. A paragraph added to the line-shift section naming both inserted bullets, the one-then-two-line shift, README-39's widened range, and the single claim-text rewrite explicitly (the join is `doc` plus claim text). No rows added. Verify: `grep -c cad-suggest` 1; `sed -n 105,130p` spans the three command lists, `sed -n 136p` states the no-instrumentation and the usage-measurement claims, `sed -n 146p` states the corrected count; README-44 shows `corrected - fe9b9b9` with text byte-identical to README.md. Static analysis: self-verify `problems:[]`; tsc exit 0; 1420/1420 pass. |
Deviations: none
Open items:
- The task-2 `human-verify` half is not walkable from a dispatch and is routed to
  `/cad-verify 3` as CONTEXT AC6: run `/cad-suggest` in this repo and observe (1)
  each recommendation presented with the trace figures behind it and its
  `/cad-config` key named, (2) `.planning/config.json` and the global Cadence
  config byte-identical before and after, then run it against a `.planning/`
  whose trace is absent and observe exactly one refusal line and zero
  suggestions. The mechanical half of the Verify passed in full.
- The plan's task-4 Action places `/cad-suggest` "under `## Support` beside
  `/cad-report`", but `/cad-report`'s COMMANDS.md row lives in the Build spine
  cluster, so the two cannot both hold. The cluster was taken as binding
  (CONTEXT D-16 registers by cluster) and the row sits in Support after
  `/cad-spike`. In README.md, where both bullets ARE in the Support list, the
  `/cad-suggest` bullet is directly beneath `/cad-report` as written.
- `cadence-core/workflows/suggest.md` landed at 5,141 B against
  `workflows/report.md`'s 3,794 for a comparable thin relay. A first draft at
  5,899 was cut by dropping a `<success_criteria>` block that `report.md` also
  does not carry; the remaining weight is the D-15 relay-unchanged rationale and
  the two-line thin-record discriminator, both behaviour rather than aside. Worth
  a look at `/cad-verify 3` against this phase's own byte posture.
- `README.md:97` still describes the retune as `trace suggest` inside the
  `/cad-milestone` paragraph rather than naming `/cad-suggest`. It is a prose
  claim about the close, not a command-list row, and `.planning/DOCS-CLAIMS.md`
  carries no row over that sentence, so it was left alone: task 5's scope is the
  command lists plus the skill count.
- Working tree at commit time also carried unstaged `.planning/config.json` and
  `.planning/phases/3/PLAN-1.md` modifications and an untracked `.orphaned_at`,
  none of them this plan's and none staged.
