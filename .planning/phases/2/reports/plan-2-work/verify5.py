import json,pathlib,subprocess,tempfile,shutil,os,re,yaml
root=pathlib.Path('/code/cadence');g=root/'crates/cadence/tests/golden';work=root/'.planning/phases/2/reports/plan-2-work'
def run(base=g,flags=[]):return subprocess.run(['node',str(base/'record.mjs'),*flags],stdin=subprocess.DEVNULL,capture_output=True,text=True,env={**os.environ,'TMPDIR':'/tmp'})
def snap(base):return {p.name:p.read_bytes() for p in (base/'recordings').glob('*.json')}
results={}
def save(): (work/'task5-results.json').write_text(json.dumps(results,indent=2)+'\n')
def record(name,p):results[name]={'exit':p.returncode,'output':p.stdout+p.stderr};save()
before=snap(g);p=run(flags=['--check']);record('clean_check',p);assert p.returncode==0 and snap(g)==before,p.stderr
chosen=g/'recordings/status-slice.json'
try:
 with chosen.open('ab') as f:f.write(b'x')
 damaged=chosen.read_bytes();p=run(flags=['--check']);record('one_byte',p);assert p.returncode==1 and 'crates/cadence/tests/golden/recordings/status-slice.json' in p.stdout+p.stderr and chosen.read_bytes()==damaged
finally:subprocess.run(['git','checkout','--',str(chosen)],check=True)
with tempfile.TemporaryDirectory(prefix='golden-major-') as tmp:
 copy=pathlib.Path(tmp)/'golden';shutil.copytree(g,copy);(copy/'record.mjs').write_text((copy/'record.mjs').read_text().replace("const repo = realpathSync(resolve(here, '../../../..'));", "const repo = '/code/cadence';"))
 one=copy/'recordings/status-slice.json';data=json.loads(one.read_text());data['node']='24';one.write_text(json.dumps(data,indent=2)+'\n')
 env={**os.environ,'GIT_CONFIG_GLOBAL':'/dev/null','GIT_CONFIG_SYSTEM':'/dev/null','GIT_AUTHOR_NAME':'Golden Fixture','GIT_AUTHOR_EMAIL':'golden@example.invalid','GIT_COMMITTER_NAME':'Golden Fixture','GIT_COMMITTER_EMAIL':'golden@example.invalid','GIT_AUTHOR_DATE':'2000-01-01T00:00:00Z','GIT_COMMITTER_DATE':'2000-01-01T00:00:00Z'}
 for args in [['init','-q','-b','main','--template='],['add','--all'],['commit','-q','-m','Golden major mismatch baseline']]:subprocess.run(['git',*args],cwd=copy,env=env,stdin=subprocess.DEVNULL,check=True)
 prior=snap(copy)
 for label,flags in [('check_major',['--check']),('default_major',[])]:
  p=run(copy,flags);record(label,p);assert p.returncode==1 and '26' in p.stderr and '24' in p.stderr and len(p.stderr.splitlines())==1 and 'recordings/' not in p.stderr and snap(copy)==prior
  status=subprocess.check_output(['git','status','--porcelain'],cwd=copy,text=True);assert not status,status
 p=run(copy,['--allow-node-change']);record('allow_major',p);assert p.returncode==0,p.stderr;assert snap(copy)==before
 # Missing and extra are observable too, and check never repairs either.
 one.unlink();extra=copy/'recordings/extra-recording.json';extra.write_bytes((copy/'recordings/trace-append-ok.json').read_bytes());prior=snap(copy)
 p=run(copy,['--check']);record('missing_extra',p);assert p.returncode==1 and 'status-slice.json: missing' in p.stderr and 'extra-recording.json: extra' in p.stderr and snap(copy)==prior
text=(root/'.github/workflows/test.yml').read_text();d=yaml.safe_load(text);jobs=d['jobs'];assert sorted(jobs)==['cargo-test','golden-drift','node-test','self-verify','typecheck'];pin=jobs['golden-drift']['steps'][1]['with']['node-version'];assert all(json.loads(v)['node']==pin for v in before.values())
old=subprocess.check_output(['git','show','HEAD:.github/workflows/test.yml'],text=True);assert text.startswith(old)
uses=re.findall(r'^\s*- uses: (.+)$',text,re.M);assert all(re.search(r'@[a-f0-9]{40}(?:\s|$)',u) for u in uses);assert 'concurrency' in d
results['ci']={'jobs':sorted(jobs),'node':pin,'existing_workflow_prefix_unchanged':True,'sha_pinned_uses':len(uses)}
assert snap(g)==before;save();print(json.dumps(results,indent=2))
