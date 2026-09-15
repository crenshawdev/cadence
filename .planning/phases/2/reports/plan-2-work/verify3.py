import json,pathlib,subprocess,tempfile,shutil,os
root=pathlib.Path('/code/cadence');g=root/'crates/cadence/tests/golden'; work=root/'.planning/phases/2/reports/plan-2-work'
m=json.loads((g/'operations.json').read_text());providers=[e['invocation'] for e in m if e['operation'].startswith('review-provider ')]
ids=['cursor-set-ok','trace-append-ok','read-trace-ok','uat-init-ok','uat-refresh-ok','uat-record-ok','uat-merge-ok','milestone-prune-ok',*providers]
def run(base,ids,flags=[]):
 return subprocess.run(['node',str(base/'record.mjs'),*[a for i in ids for a in ['--only',i]],*flags],stdin=subprocess.DEVNULL,capture_output=True,text=True,env={**os.environ,'TMPDIR':'/tmp'})
def get(base,id):return json.loads((base/'recordings'/f'{id}.json').read_text())
p=run(g,ids);assert p.returncode==0,p.stderr
c=get(g,'cursor-set-ok');t=get(g,'trace-append-ok');assert c['stdout']['cursor']['updated']=='<TODAY>';assert 'Updated: <TODAY>' in c['files']['.planning/STATE.md']
seed=(g/'fixtures'/t['bundle']/'.planning/trace.jsonl').read_text();assert t['files']['.planning/trace.jsonl'].startswith(seed);assert json.loads(t['files']['.planning/trace.jsonl'][len(seed):])['ts']=='<NOW>'
assert not (g/'fixtures/config/.planning/STATE.md').exists();assert not (g/'fixtures/config/.planning/trace.jsonl').exists()
assert all(not get(g,i)['files'] for i in providers)
rules=json.loads((g/'normalization.json').read_text());assert rules['mechanism']=='named-fields';assert len(rules['rules'])==6
moved=get(g,'milestone-prune-ok')['files']['.planning/_archive-golden/1/UAT.md'];original=(g/'fixtures/slice/.planning/phases/1/UAT.md').read_text()
for line in original.splitlines():
 if line.startswith(('started:','updated:')):assert line in moved
results={'subset':ids,'rules':len(rules['rules']),'provider_events':0,'provider_reason':'review-provider.mjs:602 returns on absent config bundle cursor, after beginProviderCall','moved_uat_dates_preserved':True}
with tempfile.TemporaryDirectory(prefix='golden-rules-') as tmp:
 copy=pathlib.Path(tmp)/'golden';shutil.copytree(g,copy)
 script=(copy/'record.mjs').read_text().replace("const repo = realpathSync(resolve(here, '../../../..'));", "const repo = '/code/cadence';")
 (copy/'record.mjs').write_text(script)
 pair=['cursor-set-ok','trace-append-ok'];p=run(copy,pair,['--no-normalize']);assert p.returncode==0,p.stderr
 results['negative_clock_differences']=[i for i in pair if (copy/'recordings'/f'{i}.json').read_bytes()!=(g/'recordings'/f'{i}.json').read_bytes()];assert results['negative_clock_differences']==pair
 rulepath=copy/'normalization.json';valid=rulepath.read_bytes();bad=json.loads(valid);bad['rules'][0]['pattern']='['
 results['loader_failures']=[]
 for name,content in [('absent',None),('invalid-json',b'{'),('invalid-pattern',json.dumps(bad).encode())]:
  if content is None:rulepath.unlink()
  else:rulepath.write_bytes(content)
  before={p.name:p.read_bytes() for p in (copy/'recordings').glob('*.json')};p=run(copy,pair);after={p.name:p.read_bytes() for p in (copy/'recordings').glob('*.json')}
  assert p.returncode!=0 and len((p.stdout+p.stderr).splitlines())==1 and before==after,(name,p)
  results['loader_failures'].append({'case':name,'exit':p.returncode,'output':p.stdout+p.stderr});rulepath.write_bytes(valid)
 custom=rules['rules'][2].copy();custom['pattern']='[0-9]{2}-';custom['replace']='<TODAY>-';rulepath.write_text(json.dumps({'mechanism':'named-fields','rules':[custom]}))
 p=run(copy,['cursor-set-ok']);assert p.returncode==0,p.stderr;value=get(copy,'cursor-set-ok')['stdout']['cursor']['updated'];assert value.count('<TODAY>')==2,value;results['global_replace']=value
(work/'task3-results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
