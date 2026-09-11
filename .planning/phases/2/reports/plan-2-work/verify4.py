import json,pathlib,subprocess,tempfile,shutil,os,re,socket
root=pathlib.Path('/code/cadence');g=root/'crates/cadence/tests/golden';work=root/'.planning/phases/2/reports/plan-2-work'
def run(base=g,flags=[],env={},cwd=root):
 p=subprocess.run(['node',str(base/'record.mjs'),*flags],stdin=subprocess.DEVNULL,capture_output=True,text=True,env={**os.environ,'TMPDIR':'/tmp',**env},cwd=cwd)
 return p
def snapshot(base=g):return {p.name:p.read_bytes() for p in (base/'recordings').glob('*.json')}
def diff(a,b):return sorted(k for k in a.keys()|b.keys() if a.get(k)!=b.get(k))
results={}
def save(): (work/'task4-results.json').write_text(json.dumps(results,indent=2)+'\n')
results['taint']=json.loads((work/'task4-first-results.json').read_text())['taint'] # Already passed on the clean committed set before regeneration.
for name in ['first','second']:
 p=run();results[name]={'exit':p.returncode,'output':p.stdout+p.stderr};save();assert p.returncode==0,(name,p.stderr)
 if name=='first':baseline=snapshot()
 else:results['repeat_differences']=diff(baseline,snapshot());save();assert not results['repeat_differences'],results['repeat_differences']
with tempfile.TemporaryDirectory(prefix='golden-ambient-') as tmp:
 t=pathlib.Path(tmp);(t/'home').mkdir();(t/'tmp').mkdir()
 p=run(env={'TMPDIR':str(t/'tmp'),'HOME':str(t/'home'),'TZ':'Asia/Tokyo','LC_ALL':'de_DE.UTF-8'},cwd='/');results['ambient']={'exit':p.returncode,'output':p.stdout+p.stderr,'differences':diff(baseline,snapshot())};save();assert p.returncode==0 and not results['ambient']['differences'],results['ambient']
 overrides={}
 for key in ['CADENCE_GLOBAL_CONFIG','CADENCE_MANAGED_SETTINGS','CADENCE_USER_SETTINGS']:
  path=t/key;path.touch();overrides[key]=str(path)
 p=run(env=overrides);results['settings']={'exit':p.returncode,'output':p.stdout+p.stderr,'differences':diff(baseline,snapshot())};save();assert p.returncode==0 and not results['settings']['differences'],results['settings']
 alltext='\n'.join(v.decode() for v in baseline.values());fixtures=[p for p in (g/'fixtures').rglob('*') if p.is_file()];fixturetext=[p.read_text() for p in fixtures]
 paths=set(re.findall(r'(/(?:home|tmp|code|var/folders|Users)/[^"\s]*)',alltext));results['unexplained_paths']=sorted(p for p in paths if not any(p in text for text in fixturetext));results['path_count']=len(paths)
 date=r'[0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z?)?'
 dates=set(re.findall(date,alltext));inputs=set(re.findall(date,'\n'.join(fixturetext)+ (g/'operations.json').read_text()+(g/'record.mjs').read_text()));results['unexplained_dates']=sorted(dates-inputs);results['dates']=sorted(dates)
 results['hostname_files']=[name for name,b in baseline.items() if socket.gethostname() in b.decode()]
 results['duration_files']=[name+':'+path for name,b in baseline.items() for path,text in json.loads(b)['files'].items() if re.search(r'"duration_ms":\s*[0-9]',text)]
 results['now_files']=[name for name,b in baseline.items() if '<NOW>' in b.decode()];results['today_files']=[name for name,b in baseline.items() if '<TODAY>' in b.decode()];results['count']=len(baseline);save()
 assert not results['unexplained_paths'],results['unexplained_paths'];assert not results['unexplained_dates'],results['unexplained_dates'];assert not results['hostname_files'];assert not results['duration_files'],results['duration_files'];assert results['now_files'] and results['today_files'];assert len(baseline)==156
 copy=t/'golden';shutil.copytree(g,copy);(copy/'record.mjs').write_text((copy/'record.mjs').read_text().replace("const repo = realpathSync(resolve(here, '../../../..'));", "const repo = '/code/cadence';"))
 p=run(base=copy,flags=['--no-normalize']);results['negative_clock']={'exit':p.returncode,'output':p.stdout+p.stderr,'differences':diff(baseline,snapshot(copy))};save();assert p.returncode==0,p.stderr;assert {'cursor-set-ok.json','trace-append-ok.json'}<=set(results['negative_clock']['differences'])
print(json.dumps(results,indent=2))
