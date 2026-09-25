import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,cpSync,symlinkSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(),work=resolve('.planning/phases/2/reports/finish-work'),here=resolve('crates/cadence/tests/golden');
const old=new Set(['slice','closed','multi','incomplete','malformed','config-unknown']);
const entries=JSON.parse(readFileSync(join(here,'operations.json'))).filter(e=>!e.git&&!old.has(e.bundle));
function files(dir,base=dir){let out={};for(const n of readdirSync(dir).sort()){if(n==='.probe-env')continue;const p=join(dir,n);if(statSync(p).isDirectory())Object.assign(out,files(p,base));else out[relative(base,p)]=readFileSync(p,'utf8');}return out;}
const results=[];
for(const e of entries){const scratch=mkdtempSync(join(work,'fixture-probe-'));try{
 cpSync(join(here,'fixtures',e.bundle),scratch,{recursive:true});const before=files(scratch);const support=join(scratch,'.probe-env');mkdirSync(support);for(const d of ['bin','home'])mkdirSync(join(support,d));symlinkSync(process.execPath,join(support,'bin/node'));symlinkSync('/usr/bin/git',join(support,'bin/git'));writeFileSync(join(support,'empty.json'),'{}\n');
 const env={PATH:join(support,'bin'),HOME:join(support,'home'),TZ:'UTC',LC_ALL:'C.UTF-8',LANG:'C.UTF-8',CADENCE_GLOBAL_CONFIG:e.global_config?join(scratch,e.global_config):join(support,'empty.json'),CADENCE_MANAGED_SETTINGS:join(support,'empty.json'),CADENCE_USER_SETTINGS:join(support,'empty.json'),GIT_CEILING_DIRECTORIES:scratch};
 const sub=s=>s.replaceAll('<FIXTURE>',scratch),r=spawnSync(process.execPath,[join(root,e.script),...e.argv.map(sub)],{cwd:scratch,env,encoding:'utf8',stdio:[e.stdin===undefined?'ignore':'pipe','pipe','pipe'],...(e.stdin===undefined?{}:{input:sub(e.stdin)}),timeout:10000});
 assert(!r.error,e.invocation);const stdout=r.stdout?JSON.parse(r.stdout):null;
 const refused=e.invocation.endsWith('-refused')||e.invocation.startsWith('review-provider-')||e.invocation.startsWith('forge-create-');
 assert.equal(r.status,refused?1:0,e.invocation+': '+r.stdout);
 if(stdout&&e.refusal_source!=='none')assert.equal(stdout.ok,!refused,e.invocation);
 const after=files(scratch),changed=Object.keys(after).filter(p=>after[p]!==before[p]);
 if(['read-trace','subagent-trace'].includes(e.operation)){assert.equal(r.stdout,'');assert.equal(changed.length,e.invocation.endsWith('-ok')?1:0,e.invocation);}
 if(['uat-init-ok','uat-refresh-ok','uat-merge-ok','release-bump-bump-ok','config-set-ok','config-unset-ok','deferred-carry-ok'].includes(e.invocation))assert(changed.length,e.invocation);
 if(e.invocation==='detect-commands-ok'){assert.equal(stdout.lint,null);assert.equal(stdout.typecheck,null);assert(stdout.warnings.length);}
 if(e.invocation==='deferred-list-ok')assert(JSON.stringify(stdout).includes('DEFERRED-diff-golden.json'));
 results.push({invocation:e.invocation,exit:r.status,stdout,stderr:r.stderr,changed});
 }finally{rmSync(scratch,{recursive:true,force:true});}}
writeFileSync(join(work,'new-bundle-probes.json'),JSON.stringify(results,null,2)+'\n');console.log(`new bundle probes: ${results.length} matched, expected writes observed`);
