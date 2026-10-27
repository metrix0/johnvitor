import os, re, json, tempfile, fcntl, pathlib, shutil, time

ROOT = pathlib.Path('/opt/imenu-migration/secrets')
PATHS = {'staging': ROOT/'app-stage.env', 'staging-build': ROOT/'app-build.env', 'production': ROOT/'app-production.env', 'production-build': ROOT/'app-production-build.env'}
KEY = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
LINE = re.compile(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=')

def manage_env(args):
    if set(args) - {'scope','action','key','value'}: raise ValueError('Invalid arguments')
    scope, action = args.get('scope'), args.get('action')
    if scope not in PATHS or action not in ('list','set','delete'): raise ValueError('Invalid request')
    path = PATHS[scope]
    key = args.get('key','')
    if action != 'list' and (not isinstance(key,str) or not KEY.fullmatch(key)): raise ValueError('Invalid key')
    if action == 'set':
        value = args.get('value')
        if not isinstance(value,str) or len(value.encode()) > 8192 or any(c in value for c in "\x00\r\n'"): raise ValueError('Invalid value')
    with open(ROOT/'.env-panel.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        lines = path.read_text().splitlines(keepends=True)
        keys = sorted({m.group(1) for line in lines if (m := LINE.match(line))})
        if action == 'list': return {'keys': keys}
        if action == 'delete' and key not in keys: raise ValueError('Key not found')
        backup = ROOT / '.env-panel-backups'
        backup.mkdir(mode=0o700,exist_ok=True)
        name = backup / (scope+'-'+str(time.time_ns())+'.env')
        shutil.copyfile(path,name); os.chmod(name,0o600)
        out = [line for line in lines if not ((m := LINE.match(line)) and m.group(1) == key)]
        if action == 'set':
            if out and not out[-1].endswith('\n'): out[-1] += '\n'
            out.append(key+'='+"'" + value + "'"+'\n')
        fd,tmp = tempfile.mkstemp(dir=ROOT,prefix='.env-panel-')
        try:
            os.fchmod(fd,0o600)
            with os.fdopen(fd,'w') as f:
                f.writelines(out); f.flush(); os.fsync(f.fileno())
            os.replace(tmp,path)
        finally:
            if os.path.exists(tmp): os.unlink(tmp)
        return {'ok': True, 'action': action, 'scope': scope, 'key': key}
