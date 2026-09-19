import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const here='crates/cadence/tests/golden';
const run=args=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});assert.equal(r.status,0,r.stderr);return r.stdout;};
function snapshot(dir){let result={};for(const n of readdirSync(dir).sort()){const p=join(dir,n);if(statSync(p).isDirectory())Object.assign(result,snapshot(p));else result[p]=createHash('sha256').update(readFileSync(p)).digest('hex');}return result;}
run([here+'/build-fixtures.mjs']);const before=snapshot(here+'/fixtures');run([here+'/build-fixtures.mjs']);assert.deepEqual(snapshot(here+'/fixtures'),before);
const call=(bundle,...args)=>JSON.parse(run(['cadence-core/bin/planning.mjs',...args,'--dir',here+'/fixtures/'+bundle+'/.planning']));
const closed=call('closed','status'),incomplete=call('incomplete','replay-check','--phase','1'),multi=call('multi','replay-check','--phase','5');
assert.equal(closed.current,null);assert.equal(closed.total,0);assert.deepEqual(incomplete.dispatch_set,['PLAN-1.md','PLAN-2.md']);assert.equal(multi.replay,true);assert.equal(multi.reports.length,7);
const provenance=JSON.parse(readFileSync(here+'/fixtures.json'));for(const b of Object.values(provenance))assert(b.tag_paths.length||b.synthesized.length);
const result={deterministic:true,closed,incomplete,multi,bundles:Object.keys(provenance)};writeFileSync('.planning/phases/2/reports/finish-work/task5-results.json',JSON.stringify(result,null,2)+'\n');
console.log('two builds byte-identical; closed current=null,total=0; incomplete dispatch_set=PLAN-1.md,PLAN-2.md; multi replay=true, reports=7; provenance valid');
