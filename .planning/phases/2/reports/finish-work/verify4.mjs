import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const work=resolve('.planning/phases/2/reports/finish-work'), root=process.cwd();
const a=JSON.parse(readFileSync('crates/cadence/tests/golden/operations.json'));
const expected=[...readFileSync('.planning/phases/2/reports/resume-work/planning-ids.txt','utf8').trim().split('\n'),...readFileSync(join(work,'entry-ids.txt'),'utf8').trim().split('\n')].sort();
const ids=[...new Set(a.map(e=>e.operation))].sort();assert.deepEqual(ids,expected);assert.equal(ids.length,74);assert.equal(a.length,156);assert.equal(new Set(a.map(e=>e.invocation)).size,a.length);
const network=new Set(['forge create','git-publish publish','git-publish reap','issue-check check','issue-filing file','issue-filing unfixed','review-provider review','review-provider consult','review-provider detect-models']);
for(const e of a){assert(existsSync(e.script),e.script);assert(['handler','door','none'].includes(e.refusal_source));if(network.has(e.operation))assert(e.offline,e.invocation);if(['git-guard','read-trace','subagent-trace'].includes(e.operation))assert(JSON.parse(e.stdin));}
for(const id of ids){const es=a.filter(e=>e.operation===id);assert(es.length>=2,id);assert(new Set(es.map(e=>JSON.stringify([e.argv,e.stdin,e.bundle]))).size>=2,id);}
const count=es=>Object.fromEntries(['handler','door','none'].map(s=>[s,es.filter(e=>e.refusal_source===s).length]));
console.log(JSON.stringify({operations:ids.length,invocations:a.length,git:a.filter(e=>e.git).length,entries:count(a),operation_sources:count(ids.map(id=>a.find(e=>e.operation===id)))}));
const results=[];
const selected=a.filter(e=>e.refusal_source==='none'||(e.script!=='cadence-core/bin/planning.mjs'&&e.refusal_source==='door'&&e.invocation.endsWith('-refused')));
for(const e of selected){const scratch=mkdtempSync(join(work,'probe-'));try{
 for(const d of ['.planning','src','bin','home'])mkdirSync(join(scratch,d));
 writeFileSync(join(scratch,'.planning/config.json'),'{}\n');writeFileSync(join(scratch,'empty.json'),'{}\n');writeFileSync(join(scratch,'src/auth.mjs'),'// Golden source\nexport const enabled = true;\n');
 const seed=[{corr:'1',phase:1,ts:'2026-09-05T12:00:00.000Z',family:'lifecycle',event:'phase_start'},{corr:'1',phase:1,ts:'2026-09-05T12:00:01.000Z',family:'lifecycle',event:'dispatch',role:'cad-executor',plan:'1'}].map(r=>JSON.stringify(r)).join('\n')+'\n';
 writeFileSync(join(scratch,'.planning/trace.jsonl'),seed);writeFileSync(join(scratch,'.planning/reads.jsonl'),'');
 symlinkSync(process.execPath,join(scratch,'bin/node'));symlinkSync('/usr/bin/git',join(scratch,'bin/git'));
 const env={PATH:join(scratch,'bin'),HOME:join(scratch,'home'),TZ:'UTC',LC_ALL:'C.UTF-8',LANG:'C.UTF-8',CADENCE_GLOBAL_CONFIG:join(scratch,'empty.json'),CADENCE_MANAGED_SETTINGS:join(scratch,'empty.json'),CADENCE_USER_SETTINGS:join(scratch,'empty.json')};
 const sub=s=>s.replaceAll('<FIXTURE>',scratch),r=spawnSync(process.execPath,[resolve(e.script),...e.argv.map(sub)],{cwd:scratch,env,encoding:'utf8',stdio:[e.stdin===undefined?'ignore':'pipe','pipe','pipe'],...(e.stdin===undefined?{}:{input:sub(e.stdin)}),timeout:10000});
 assert(!r.error);assert.equal(r.stderr,'');const o=r.stdout?JSON.parse(r.stdout):null;
 let changed=null;
 if(e.refusal_source==='door'){assert.equal(r.status,1);assert.equal(o.reason,'missing-flag-value');}
 else {assert.equal(r.status,0);if(e.operation==='config keys'){assert.equal(o.ok,true);assert.equal(Object.keys(o.keys).length,94);}else{assert.equal(r.stdout,'');const file=e.operation==='read-trace'?'reads.jsonl':'trace.jsonl';changed=readFileSync(join(scratch,'.planning',file),'utf8')!==(file==='reads.jsonl'?'':seed);assert.equal(changed,e.invocation.endsWith('-ok'),e.invocation);}}
 results.push({invocation:e.invocation,exit:r.status,stdout:o===null?null:e.operation==='config keys'?{ok:o.ok,keys:Object.keys(o.keys).length}:o,changed});
 }finally{rmSync(scratch,{recursive:true,force:true});}}
writeFileSync(join(work,'task4-probes.json'),JSON.stringify(results,null,2)+'\n');console.log(`probes: ${results.length} matched; none-source hooks differ in written bytes; door refusals match`);
