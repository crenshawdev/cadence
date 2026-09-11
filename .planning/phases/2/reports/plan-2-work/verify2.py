import json, pathlib, subprocess, os
root=pathlib.Path('/code/cadence'); g=root/'crates/cadence/tests/golden'
ids=['trace-append-ok','cursor-set-ok','status-slice','cursor-get-slice','read-trace-ok','milestone-prune-ok','cite-count-ok','route-resolve-ok','route-resolve-refused','risk-check-run-ok']
p=subprocess.run(['node',str(g/'record.mjs'),*[a for i in ids for a in ['--only',i]]],stdin=subprocess.DEVNULL,capture_output=True,text=True,env={**os.environ,'TMPDIR':'/tmp'})
assert p.returncode==0,p.stderr
r={i:json.loads((g/'recordings'/f'{i}.json').read_text()) for i in ids}
t=r['trace-append-ok']; assert list(t['files'])==['.planning/trace.jsonl']; seeded=(g/'fixtures'/t['bundle']/'.planning/trace.jsonl').read_text(); added=t['files']['.planning/trace.jsonl'][len(seeded):]; assert t['files']['.planning/trace.jsonl'].startswith(seeded); assert len(added.splitlines())==1; assert json.loads(added)['event']==t['argv'][t['argv'].index('--event')+1]
c=r['cursor-set-ok']; assert 'Status: '+c['argv'][c['argv'].index('--status')+1] in c['files']['.planning/STATE.md']
for i in ['status-slice','cursor-get-slice']: assert r[i]['files']=={} and r[i]['deleted']==[]
h=r['read-trace-ok']; assert h['stdout'] is None and h['exit']==0 and any(p.endswith('reads.jsonl') for p in h['files'])
a=r['milestone-prune-ok']; assert a['files'] and a['deleted']; assert any('_archive-' in p for p in a['files'])
summary={i:{'exit':v['exit'],'files':list(v['files']),'deleted':v['deleted']} for i,v in r.items()}
(root/'.planning/phases/2/reports/plan-2-work/task2-results.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
