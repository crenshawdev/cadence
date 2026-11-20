# cad-phase add --brief workflow

Adds a finished Seldon design to a project already under Cadence: its PRD
requirements join `## Active` and each epic becomes one phase after the last
one. Read only when `$ARGUMENTS` carries `--brief`; `phase.md` holds the rest
of `/cad-phase`. There is no confirm step: typing the command is the consent.

## 1. Route

`--brief` goes only with `add`. Any other op carrying it is refused here,
naming that `--brief` works only with `add`, before anything is read. The word
after `--brief` is the design folder, passed on quoted and exactly as typed;
with nothing after `--brief`, pass `""`. There is no default folder: design-read
alone judges a missing path and a file.

## 2. Check

One call checks the design and the project together and writes nothing. Its
answer is too big for the transcript, so it goes to a file in a directory this
run makes, and one read-back prints what the next steps need:

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-design-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac \
  && { node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" design-read --add --design "<path>" > "$D/design.json" || [ -s "$D/design.json" ]; } \
  && node -e 'const f=require("fs");const d=process.argv[1];let r;try{r=JSON.parse(f.readFileSync(d+"/design.json","utf8"))}catch(e){console.error("scratch-unreadable: "+e.message);process.exit(1)}if(!r||typeof r!=="object"||typeof r.ok!=="boolean"){console.error("scratch-shape: "+d+"/design.json is not a design-read answer");process.exit(1)}if(!r.ok){if(typeof r.detail!=="string"||typeof r.hint!=="string"||(r.issues!==undefined&&!Array.isArray(r.issues))){console.error("scratch-shape: the refusal in "+d+"/design.json has no detail or hint");process.exit(1)}const out=["REFUSED "+r.reason+": "+r.detail];for(const i of r.issues||[])out.push("- "+JSON.stringify(i));out.push("hint: "+r.hint);console.log(out.join("\n"))}else{const ph=r.phases;if(!Array.isArray(ph)||!ph.length||ph.some((p)=>!p||typeof p.number!=="number"||typeof p.name!=="string"||typeof p.description!=="string")||!Array.isArray(r.requirements)||!Array.isArray(r.uncovered)||typeof r.active_text!=="string"||typeof r.sections_text!=="string"){console.error("scratch-shape: "+d+"/design.json lacks the phases, requirements, uncovered list or texts the add writes");process.exit(1)}const out=[];for(const p of ph){const n=d+"/name-"+p.number+".txt";const s=d+"/description-"+p.number+".txt";f.writeFileSync(n,p.name);f.writeFileSync(s,p.description);out.push("phase "+p.number+": "+p.name+"  name file: "+n+"  description file: "+s)}out.push("requirements: "+r.requirements.length+"  uncovered: "+JSON.stringify(r.uncovered));out.push("=== active text ===",r.active_text+"=== sections text ===",r.sections_text+"=== end ===");console.log(out.join("\n"))}' "$D"
```

A refusal on stderr (`scratch-unreadable`, `scratch-shape`) means no answer was
read: say so and stop. A `REFUSED` answer: show the detail, every issue and the
hint, then stop - nothing was written. Phase numbers, IDs and texts come from
the answer only; never compare IDs or work out a number in the session.

## 3. Write, after an accepted answer only, in this order

1. One `phase-entry add` per phase line, in the order printed, with the
   printed files:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-entry add --phase <number> --name-file <name file> --description-file <description file>
   ```

   Never run `cursor set` afterward and never write `## Traceability` rows;
   `/cad-plan` adds those. Note whether the FIRST add answered
   `opened_cycle: true`.
2. The active text, inserted unchanged at the end of REQUIREMENTS.md's
   `## Active`, after everything already there, one blank line before it. A
   category matching an existing heading still gets its own new heading.
3. The sections text, inserted unchanged after the last existing
   `### Phase N:` section in ROADMAP.md's `## Phase Details`, or at the end of
   that section when none is left, one blank line before it.
4. When the first add opened a cycle, the no-cycle-open rewrite in `phase.md`'s
   `### add`, PROJECT.md's `### Active` sentence included.

No other existing line is edited, and the design is written nowhere else, so
PROJECT.md's description stays as it is.

## 4. A failure after the first write

Stop. Name which phases went in, and whether the active text and the sections
text did. There is no rollback.

## 5. Report

The phases added by number and name, the requirement count and every
uncovered requirement ID (none when the list is empty). Then follow
`phase.md`'s Finish, with `chore: add phases <first>-<last> from a design` as
the commit.
