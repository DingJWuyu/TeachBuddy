from pathlib import Path
import json,subprocess,os
root=Path(__file__).resolve().parent.parent
login=json.loads(Path('/tmp/teacher-r35-local2-tools/login.json').read_text())
env={**os.environ,'PAGINATION_ORIGIN':'https://127.0.0.1:49935','PAGINATION_EMAIL':login['email'],'PAGINATION_PASSWORD':login['password'],'MATERIALS_OFFICE_ROOT':'/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8'}
for lines,kinds in [(4,['practice','handout','lesson-plan']),(20,['practice'])]:
 for kind in kinds:
  for fmt in ['pdf','docx']:
   name=f'{kind}-{lines}-{fmt}'
   print(name,flush=True)
   dest=root/name
   current={**env,'PAGINATION_KIND':kind,'PAGINATION_FORMAT':fmt,'PAGINATION_LINES':str(lines),'PAGINATION_EVIDENCE':str(dest)}
   with (root/(name+'.log')).open('w') as log:
    subprocess.run(['node',str(root/'scripts/download.mjs')],env=current,stdout=log,stderr=subprocess.STDOUT,check=True)
with (root/'options.log').open('w') as log:
 subprocess.run(['node',str(root/'scripts/options.mjs')],env={**env,'PAGINATION_EVIDENCE':str(root/'options')},stdout=log,stderr=subprocess.STDOUT,check=True)
