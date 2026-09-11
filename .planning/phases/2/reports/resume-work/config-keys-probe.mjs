import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const work=resolve('.planning/phases/2/reports/resume-work');
const scratch=mkdtempSync(join(work,'keys-probe-'));
const results=[];
try {
 mkdirSync(join(scratch,'home'));writeFileSync(join(scratch,'empty.json'),'{}\n');
 const env={PATH:'',HOME:join(scratch,'home'),TZ:'UTC',LC_ALL:'C.UTF-8',LANG:'C.UTF-8',CADENCE_GLOBAL_CONFIG:join(scratch,'empty.json'),CADENCE_MANAGED_SETTINGS:join(scratch,'empty.json'),CADENCE_USER_SETTINGS:join(scratch,'empty.json')};
 let baseline;
 for(const argv of [['keys'],['keys','--file'],['keys','--file','']]){
  const r=spawnSync(process.execPath,[resolve('cadence-core/bin/config.mjs'),...argv],{cwd:scratch,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000});
  const o=JSON.parse(r.stdout);assert.equal(r.status,0);assert.equal(o.ok,true);assert.equal(r.stderr,'');assert.equal(o.reason,undefined);assert.equal(o.detail,undefined);
  baseline??=r.stdout;assert.equal(r.stdout,baseline);
  const result={argv,exit:r.status,ok:o.ok,keys:Object.keys(o.keys).length,reason:null,detail:null,byte_identical:true};results.push(result);console.log(JSON.stringify(result));
 }
 writeFileSync(join(work,'config-keys-probes.json'),JSON.stringify(results,null,2)+'\n');
}finally{rmSync(scratch,{recursive:true,force:true});}
