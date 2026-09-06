import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const here='crates/cadence/tests/golden';
const run=(args,exit=0)=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});assert.equal(r.status,exit,r.stderr);return r.stdout;};
function snapshot(dir){let result={};for(const n of readdirSync(dir).sort()){const p=join(dir,n);if(statSync(p).isDirectory())Object.assign(result,snapshot(p));else result[p]=createHash('sha256').update(readFileSync(p)).digest('hex');}return result;}
run([here+'/build-fixtures.mjs']);const before=snapshot(here+'/fixtures');run([here+'/build-fixtures.mjs']);assert.deepEqual(snapshot(here+'/fixtures'),before);
const a=JSON.parse(readFileSync(here+'/operations.json')),named=[...new Set(a.map(e=>e.bundle))].sort(),dirs=readdirSync(here+'/fixtures').filter(n=>statSync(join(here,'fixtures',n)).isDirectory()).sort();assert.deepEqual(named,dirs);assert.equal(dirs.length,17);
const malformed=JSON.parse(run(['cadence-core/bin/planning.mjs','plan-overlap','--phase','1','--dir',here+'/fixtures/malformed/.planning']));assert(malformed.frontmatter_issues.length);
const unknown=JSON.parse(run(['cadence-core/bin/config.mjs','validate','--file',here+'/fixtures/config-unknown/.planning/config.json'],1));assert.equal(unknown.ok,false);assert(unknown.errors.some(e=>e.key==='unknown.golden'));
const provenance=JSON.parse(readFileSync(here+'/fixtures.json'));assert.deepEqual(Object.keys(provenance).sort(),dirs);for(const b of Object.values(provenance))assert(b.tag_paths.length||b.synthesized.length);
for(const e of a){if(e.global_config)assert(existsSync(join(here,'fixtures',e.bundle,e.global_config)));}
const result={deterministic:true,bundles:dirs.length,missing:0,unused:0,malformed,unknown,files:Object.keys(before).length};writeFileSync('.planning/phases/2/reports/finish-work/task6-results.json',JSON.stringify(result,null,2)+'\n');
console.log(`two builds byte-identical; bundles=${dirs.length}, missing=0, unused=0; frontmatter_issues=${malformed.frontmatter_issues.length}; unknown-key ok=false; provenance valid; files=${result.files}`);
