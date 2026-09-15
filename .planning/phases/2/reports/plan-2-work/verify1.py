import json, pathlib, subprocess, tempfile, os
root=pathlib.Path('/code/cadence'); golden=root/'crates/cadence/tests/golden'; out=golden/'recordings'
manifest=json.loads((golden/'operations.json').read_text()); entries=[e for e in manifest if e['git']]
result={'prediction':'47 identical pairs, stable risk SHAs across TMPDIR, risk/debt success, written marker, configured github, no GPG'}
result['runs']=[]
for entry in entries:
 args=['node',str(golden/'record.mjs'),'--only',entry['invocation']]
 for n in range(2):
  p=subprocess.run(args,stdin=subprocess.DEVNULL,capture_output=True,text=True,env={**os.environ,'TMPDIR':'/tmp'})
  assert p.returncode==0,(entry['invocation'],p.stderr)
  data=(out/(entry['invocation']+'.json')).read_bytes()
  if n==0: before=data
 result['runs'].append({'invocation':entry['invocation'],'identical':before==data})
risk=json.loads((out/'risk-check-run-ok.json').read_text()); debt=json.loads((out/'debt-harvest-ok.json').read_text()); forge=json.loads((out/'forge-detect-ok.json').read_text())
with tempfile.TemporaryDirectory(prefix='golden-other-') as other:
 p=subprocess.run(['node',str(golden/'record.mjs'),'--only','risk-check-run-ok'],stdin=subprocess.DEVNULL,capture_output=True,text=True,env={**os.environ,'TMPDIR':other})
 assert p.returncode==0,p.stderr
 result['risk_other_tmp_identical']=risk==json.loads((out/'risk-check-run-ok.json').read_text())
result['risk']=risk; result['debt']=debt; result['forge']=forge
result['gpg_matches']=[str(p.relative_to(root)) for p in out.glob('*.json') if 'gpgsig' in p.read_text() or 'GPG' in p.read_text()]
(root/'.planning/phases/2/reports/plan-2-work/task1-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'pairs':len(entries),'differing':[r['invocation'] for r in result['runs'] if not r['identical']], 'tmp_identical':result['risk_other_tmp_identical'],'risk_exit':risk['exit'],'risk_ok':risk['stdout'].get('ok'),'risk_argv':risk['argv'],'debt_exit':debt['exit'],'debt_stdout':debt['stdout'],'debt_files':debt['files'],'forge_stdout':forge['stdout'],'gpg_matches':result['gpg_matches']},indent=2))
