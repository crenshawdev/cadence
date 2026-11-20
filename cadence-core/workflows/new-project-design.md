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
2. One call checks the design and writes nothing. Its answer is too big for
   the transcript, so it goes to a file in a directory this run makes, and one
   read-back prints every path and text the later steps use, so nothing is
   retyped and `brief.md` is never opened. The path goes in quoted, exactly as
   typed:

   ```
   D="$(mktemp -d "${TMPDIR:-/tmp}/cad-design-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac \
     && { node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" design-read --design "<path>" --first-phase 1 > "$D/design.json" || [ -s "$D/design.json" ]; } \
     && node -e 'const f=require("fs");const d=process.argv[1];let r;try{r=JSON.parse(f.readFileSync(d+"/design.json","utf8"))}catch(e){console.error("scratch-unreadable: "+e.message);process.exit(1)}if(!r||typeof r!=="object"||typeof r.ok!=="boolean"){console.error("scratch-shape: "+d+"/design.json is not a design-read answer");process.exit(1)}if(!r.ok){if(typeof r.detail!=="string"||typeof r.hint!=="string"||(r.issues!==undefined&&!Array.isArray(r.issues))){console.error("scratch-shape: the refusal in "+d+"/design.json has no detail or hint");process.exit(1)}const out=["REFUSED "+r.reason+": "+r.detail];for(const i of r.issues||[])out.push("- "+JSON.stringify(i));out.push("hint: "+r.hint);console.log(out.join("\n"))}else{const ph=r.phases;if(!Array.isArray(ph)||!ph.length||ph.some((p)=>!p||typeof p.number!=="number"||typeof p.name!=="string"||typeof p.description!=="string")||!Array.isArray(r.requirements)||!Array.isArray(r.uncovered)||typeof r.title!=="string"||typeof r.active_text!=="string"||typeof r.sections_text!=="string"||typeof r.project_text!=="string"){console.error("scratch-shape: "+d+"/design.json lacks the phases, requirements, uncovered list, title or texts the new project writes");process.exit(1)}const out=["title: "+r.title];for(const p of ph){const n=d+"/name-"+p.number+".txt";const s=d+"/description-"+p.number+".txt";f.writeFileSync(n,p.name);f.writeFileSync(s,p.description);out.push("phase "+p.number+": "+p.name+"  name file: "+n+"  description file: "+s)}const pj=d+"/project.md";f.writeFileSync(pj,r.project_text);out.push("requirements: "+r.requirements.length+"  uncovered: "+JSON.stringify(r.uncovered));out.push("project text file: "+pj);out.push("=== project text ===",r.project_text+"=== active text ===",r.active_text+"=== sections text ===",r.sections_text+"=== end ===");console.log(out.join("\n"))}' "$D"
   ```

3. A refusal on stderr (`scratch-unsafe`, `scratch-unreadable`,
   `scratch-shape`) means no answer was read: say so and stop. A `REFUSED`
   answer: show the detail, every issue and the hint, then stop. A directory
   missing a document is refused here, never read as a freeform brief. Either
   way nothing was written: no `.git`, no `.planning/`, no config.
4. Only an accepted answer goes on, to `new-project.md`'s `setup` items 2
   to 7. Phase numbers, IDs and texts come from the printed answer only.
