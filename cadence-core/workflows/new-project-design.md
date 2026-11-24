# cad-new-project --brief workflow, the design route

`/cad-new-project`'s design route, read only when the path after `--brief` is
a directory: a finished Seldon design becomes a new project. `new-project.md`
holds the steps both routes share. There is no confirm step: typing the
command is the consent. The design folder is only read, never written, edited
or moved.

## 1. Check

Before anything is written, in this order:

1. If `.planning/PROJECT.md` exists, stop as `new-project.md`'s `setup` item 1
   does.
2. One call checks the design and writes nothing, and one read-back prints
   every path and text the later steps use. The path goes in quoted, exactly as
   typed:

   ```
   D="$(mktemp -d "${TMPDIR:-/tmp}/cad-design-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac \
     && { node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" design-read --design "<path>" --first-phase 1 > "$D/design.json" || [ -s "$D/design.json" ]; } \
     && node -e 'const f=require("fs");const d=process.argv[1];let r;try{r=JSON.parse(f.readFileSync(d+"/design.json","utf8"))}catch(e){console.error("scratch-unreadable: "+e.message);process.exit(1)}if(!r||typeof r!=="object"||typeof r.ok!=="boolean"){console.error("scratch-shape: "+d+"/design.json is not a design-read answer");process.exit(1)}if(!r.ok){if(typeof r.detail!=="string"||typeof r.hint!=="string"||(r.issues!==undefined&&!Array.isArray(r.issues))){console.error("scratch-shape: the refusal in "+d+"/design.json has no detail or hint");process.exit(1)}const out=["REFUSED "+r.reason+": "+r.detail];for(const i of r.issues||[])out.push("- "+JSON.stringify(i));out.push("hint: "+r.hint);console.log(out.join("\n"))}else{const ph=r.phases;if(!Array.isArray(ph)||!ph.length||ph.some((p)=>!p||typeof p.number!=="number"||typeof p.name!=="string"||typeof p.description!=="string")||!Array.isArray(r.requirements)||!Array.isArray(r.uncovered)||typeof r.title!=="string"||typeof r.active_text!=="string"||typeof r.sections_text!=="string"||typeof r.project_text!=="string"){console.error("scratch-shape: "+d+"/design.json lacks the phases, requirements, uncovered list, title or texts the new project writes");process.exit(1)}const out=["title: "+r.title];for(const p of ph){const n=d+"/name-"+p.number+".txt";const s=d+"/description-"+p.number+".txt";f.writeFileSync(n,p.name);f.writeFileSync(s,p.description);out.push("phase "+p.number+": "+p.name+"  name file: "+n+"  description file: "+s)}const pj=d+"/project.md";f.writeFileSync(pj,r.project_text);out.push("phases: "+ph.length+"  requirements: "+r.requirements.length+"  uncovered: "+JSON.stringify(r.uncovered));out.push("project text file: "+pj);out.push("=== project text ===",r.project_text+"=== active text ===",r.active_text+"=== sections text ===",r.sections_text+"=== end ===");console.log(out.join("\n"))}' "$D"
   ```

3. A refusal on stderr (`scratch-unsafe`, `scratch-unreadable`,
   `scratch-shape`) means no answer was read: say so and stop. A `REFUSED`
   answer: show the detail, every issue and the hint, then stop. A directory
   missing a document is refused here, never read as a freeform brief. Either
   way nothing was written: no `.git`, no `.planning/`, no config.
4. Only an accepted answer goes on, to `new-project.md`'s `setup` items 2
   to 7.

## 2. Write, after an accepted answer only, in this order

This route replaces `new-project.md`'s `questioning`, `write_project`,
`research`, `requirements` and `roadmap` steps, and shares its `setup`,
`testing_policy`, `state` and `done` steps. It asks only what those shared
steps ask, and no gate of the freeform path: the design already answers them.
Phase numbers, IDs, names and texts come only from the check's printout:
nothing is retyped or compared, no number is worked out in the session and
`brief.md` is never opened.

1. **Setup.** `new-project.md`'s `setup` items 2 to 7 as written: git init,
   `.planning/`, `trace ignore`, the config copy, the config and forge reads,
   the forge pick, the roles interview and the brownfield note. Print the note;
   its guidance for questioning doesn't apply.
2. **PROJECT.md.** Copy the printed project text file to `.planning/PROJECT.md`
   byte for byte (`cp "<project text file>" .planning/PROJECT.md`). Then
   replace its one bracketed Core Value line with one sentence you write from
   the brief, naming the one thing that must work. Ask nothing and change no
   other line.
3. **REQUIREMENTS.md**, laid out as
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/REQUIREMENTS.md`:
   - `# Requirements: <title>`, `**Defined:**` with today's date and
     `**Core Value:**` with the same sentence.
   - `## Active` holding the active text unchanged: every PRD requirement, the
     uncovered ones and any the PRD's own MVP scope defers included.
   - `## v2 Requirements` holding no requirement.
   - `## Out of Scope` as the template's table, one row per refusal in the
     project text's `### Out of Scope`, its `>` lines left out. The Feature
     cell is what it refuses and the Reason cell the reason it states; a
     refusal stating none gets "The design gives no reason.", never an
     invented one. A `|` in either cell is written `\|`.
   - `## Traceability` as bare headers, and the template's footer.

   No category scoping, no additions, no confirmation and no check of the Core
   Value against the requirements.
4. **Testing policy.** `new-project.md`'s `testing_policy` step as written. It
   reads the stack from PROJECT.md's Constraints.
5. **ROADMAP.md**, laid out as
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/ROADMAP.md`:
   - `# Roadmap: <title>`, then `## Overview` with one paragraph you write,
     saying the phases are the design's epics in its order.
   - An empty `## Phases`, then `## Phase Details` holding the sections text
     unchanged.

   Then one `phase-entry add` per printed phase line, in printed order, with
   the printed files. Never write a `## Phases` line, a phase number or a
   `## Traceability` row; `/cad-plan` adds the rows.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry add --phase <number> --name-file <name file> --description-file <description file>
   ```

   Then count the criteria, once, and carry each `over` entry to the report.
   Nothing is asked and there is no approval gate:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" criteria-size --roadmap-min 2 --roadmap-max 5
   ```
6. **State.** `new-project.md`'s `state` step's `cursor set` only. This
   route's one commit below replaces that step's commit.
7. **Commit.** With `planning.commit_docs` false there is no commit. When it
   is true, apply `new-project.md`'s `write_project` first-commit guard, the
   protected-branch guard of `references/git-guard.md` skipped in a repository
   with no commits yet. Then make one `docs: start the project from the
   design "<title>" (<N> phases)` commit, `<N>` the printed `phases:` count,
   naming `.planning/PROJECT.md`,
   `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`,
   `.planning/records/state.json`, `.planning/records/.gitignore`,
   `.planning/config.json` and `.github/cadence/coverage-policy.json`, which
   the `testing_policy` step wrote for this commit.

A seam that fails after the first write: stop, and name what went in. There is
no rollback.

## 3. Report

`new-project.md`'s `done` step, with the printed `phases:` count as its `{N}`,
plus:

- the Core Value sentence, and that the user can change it in PROJECT.md
- every uncovered requirement ID, or none
- each phase outside 2 to 5 criteria, with its count
- when `--research` was typed, one line saying research was skipped because
  this route replaces the requirements gathering it feeds. Research never runs
  here, whatever `workflow.research` holds.
