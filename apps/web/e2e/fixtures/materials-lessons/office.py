import json, pathlib, sys, time, subprocess
import uno
from com.sun.star.beans import PropertyValue
root=pathlib.Path.cwd()
evidence=root/'test-results/evidence/R34/v1/office'
evidence.mkdir(parents=True,exist_ok=True)
def prop(name,value):
 p=PropertyValue();p.Name=name;p.Value=value;return p
context=uno.getComponentContext()
resolver=context.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver',context)
remote=resolver.resolve('uno:socket,host=127.0.0.1,port=49435;urp;StarOffice.ComponentContext')
manager=remote.ServiceManager
desktop=manager.createInstanceWithContext('com.sun.star.frame.Desktop',remote)
helper=manager.createInstanceWithContext('com.sun.star.frame.DispatchHelper',remote)
def screenshot(name):
 subprocess.run(['magick','import','-display',':134','-window','root',str(evidence/name)],check=True)
def formulas(document):
 objects=document.getEmbeddedObjects();result=[]
 for name in objects.getElementNames():
  model=objects.getByName(name).getPropertyValue('Model')
  if model.supportsService('com.sun.star.formula.FormulaProperties'):result.append((name,model))
 return result
records=[]
for kind in ['lesson-plan','handout','practice']:
 source=root/f'test-results/evidence/R34/v1/outputs/{kind}-docx-00.docx'
 copy=evidence/f'{kind}-edited.docx';copy.write_bytes(source.read_bytes())
 doc=desktop.loadComponentFromURL(copy.as_uri(),'_blank',0,(prop('Hidden',False),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
 time.sleep(0.5)
 before={name:model.getPropertyValue('Formula') for name,model in formulas(doc)}
 if '--inspect' in sys.argv:
  print(json.dumps(before,ensure_ascii=False,indent=2));screenshot(f'{kind}-before.png');doc.close(True);break
 text=doc.createReplaceDescriptor();text.setSearchString('函数与定义域 - 输出核验');text.setReplaceString('函数与定义域 - 已编辑保存');assert doc.replaceAll(text)==1
 # Edit actual embedded Office formula objects while the document is visible.
 objects=formulas(doc)
 fraction=next((name,model) for name,model in objects if 'over' in model.getPropertyValue('Formula'))
 standalone=next((name,model) for name,model in objects if 'matrix' in model.getPropertyValue('Formula'))
 edits=[]
 for label,(name,model),new in [('inline',fraction,'{2 x + 1} over {x + 3}'),('display',standalone,'f(x) = left lbrace matrix {x^2 + 2 # x < 0 ## x + 1 # x >= 0} right none')]:
  prior=model.getPropertyValue('Formula');model.setPropertyValue('Formula',new);edits.append({'label':label,'object':name,'before':prior,'after':new})
 doc.setModified(True);doc.store();screenshot(f'{kind}-edited.png');doc.close(True)
 doc=desktop.loadComponentFromURL(copy.as_uri(),'_blank',0,(prop('Hidden',False),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
 after={name:model.getPropertyValue('Formula') for name,model in formulas(doc)}
 assert '已编辑保存' in doc.getText().getString()
 assert any('over' in value and '+ 1' in value for value in after.values()),after
 assert any('matrix' in value and '+ 2' in value for value in after.values()),after
 doc.storeToURL((evidence/f'{kind}-edited.pdf').as_uri(),(prop('FilterName','writer_pdf_Export'),))
 helper.executeDispatch(doc.getCurrentController().getFrame(),'.uno:PrintPreview','',0,())
 time.sleep(0.5);screenshot(f'{kind}-print-preview.png')
 records.append({'kind':kind,'before':before,'edits':edits,'reopened':after,'textPersisted':True,'printPreviewDispatch':True})
 doc.close(True)
(evidence/'gui.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
