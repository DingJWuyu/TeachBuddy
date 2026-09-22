from pathlib import Path
import subprocess,os
root=Path('/tmp/m43-fixed-m-source');root.mkdir(exist_ok=True)
archive=subprocess.check_output(['git','archive','b0703907a7339513ed34bfed5c1e6787cc65d37d','apps','packages','scripts','package.json','docs/contracts'])
subprocess.run(['tar','-x','-C',str(root)],input=archive,check=True)
(root/'node_modules/@refatos').mkdir(parents=True,exist_ok=True)
current=Path.cwd()
for p in (current/'node_modules').iterdir():
 dest=root/'node_modules'/p.name
 if p.name!='@refatos' and not dest.exists():dest.symlink_to(p)
if not (root/'node_modules/@refatos/shared').exists():(root/'node_modules/@refatos/shared').symlink_to(root/'packages/shared')
for app in ['api','web']:
 p=root/'apps'/app/'node_modules'
 if not p.exists():p.symlink_to(current/'apps'/app/'node_modules')
