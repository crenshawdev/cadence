import { readFileSync, existsSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(), work=resolve('.planning/phases/2/reports/resume-work');
const all=JSON.parse(readFileSync('crates/cadence/tests/golden/operations.json'));
const a=all.filter(e=>e.script==='cadence-core/bin/planning.mjs');
const ids=[...new Set(a.map(e=>e.operation))].sort();
assert.equal(ids.join('\n')+'\n',readFileSync(join(work,'planning-ids.txt'),'utf8'));
assert.equal(ids.length,43); assert.equal(new Set(all.map(e=>e.invocation)).size,all.length);
for(const id of ids)assert(a.filter(e=>e.operation===id).length>=2,id);
for(const e of all){ for(const k of ['invocation','operation','bundle','script','argv','git'])assert(k in e); assert(existsSync(e.script)); if(e.git)for(let i=0;i<e.argv.length;i++)if(['--base','--head','--sha'].includes(e.argv[i]))assert(['<BASE>','<HEAD>'].includes(e.argv[i+1])); }
console.log(`inventory: ${ids.length} ids, ${a.length} invocations, unique and structurally valid`);
const rows=JSON.parse(readFileSync(join(work,'task3-rows.json'))), results=[];
for(const row of rows){
 const e=a.find(e=>e.invocation===row[2]), scratch=mkdtempSync(join(work,'probe-'));
 try {
 cpSync('crates/cadence/tests/golden/fixtures/slice',scratch,{recursive:true});
 writeFileSync(join(scratch,'invalid.json'),'{}\n');writeFileSync(join(scratch,'uat-items.json'),'[{"name":"Golden item","expected":"A result","criterion":"AC1"}]\n');
 if(e.bundle==='unreadable-reads'){rmSync(join(scratch,'.planning/reads.jsonl'));mkdirSync(join(scratch,'.planning/reads.jsonl'));}
 mkdirSync(join(scratch,'bin'));mkdirSync(join(scratch,'home'));symlinkSync(process.execPath,join(scratch,'bin/node'));symlinkSync('/usr/bin/git',join(scratch,'bin/git'));writeFileSync(join(scratch,'empty.json'),'{}\n');
 const env={PATH:join(scratch,'bin'),HOME:join(scratch,'home'),TZ:'UTC',LC_ALL:'C.UTF-8',LANG:'C.UTF-8',CADENCE_GLOBAL_CONFIG:join(scratch,'empty.json'),CADENCE_MANAGED_SETTINGS:join(scratch,'empty.json'),CADENCE_USER_SETTINGS:join(scratch,'empty.json')};
 const r=spawnSync(process.execPath,[resolve(e.script),...e.argv.map(s=>s.replaceAll('<FIXTURE>',scratch))],{cwd:scratch,env,encoding:'utf8',stdio:[e.stdin===undefined?'ignore':'pipe','pipe','pipe'],...(e.stdin===undefined?{}:{input:e.stdin}),timeout:10000});
 const o=JSON.parse(r.stdout);assert.equal(r.status,1,e.invocation);assert.equal(o.reason,row[3],e.invocation);assert.equal(o.ok,false);
 if(row[4]==='door')assert(o.detail.includes('needs a phase number: --phase <N>'));else assert(!o.hint?.startsWith('correct the flag the detail names'),e.invocation);
 results.push({invocation:e.invocation,source:row[4],exit:r.status,stdout:o});
 }finally{rmSync(scratch,{recursive:true,force:true});}
}
writeFileSync(join(work,'refusal-probes.json'),JSON.stringify(results,null,2)+'\n');
console.log(`refusals: ${results.length} matched; handler=40, door=3`);
