import json,pathlib,sys,time,subprocess
import uno
from com.sun.star.beans import PropertyValue

def prop(n,v):
 p=PropertyValue();p.Name=n;p.Value=v;return p
ctx=uno.getComponentContext();resolver=ctx.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver',ctx)
remote=resolver.resolve('uno:socket,host=127.0.0.1,port=49755;urp;StarOffice.ComponentContext')
desktop=remote.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop',remote)
helper=remote.ServiceManager.createInstanceWithContext('com.sun.star.frame.DispatchHelper',remote)
src=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
doc=desktop.loadComponentFromURL(src.as_uri(),'_blank',0,(prop('Hidden',False),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
controller=doc.getCurrentController();cur=controller.getViewCursor()
def layout():
 result=[];en=doc.Text.createEnumeration();question=0;line=0
 while en.hasMoreElements():
  p=en.nextElement()
  if not p.supportsService('com.sun.star.text.Paragraph'):continue
  if 'W-Q' in p.String:question+=1;line=0
  cur.gotoRange(p.getStart(),False)
  blank=p.String==' '
  if blank:line+=1
  result.append({'text':p.String,'question':question,'answerLine':line if blank else None,'page':cur.getPage(),'y':cur.Position.Y,'fontSize':p.CharHeight,'lineHeight':p.ParaLineSpacing.Height,'lineMode':p.ParaLineSpacing.Mode,'bottomMargin':p.ParaBottomMargin})
 return result
before=layout();pageStyle=doc.StyleFamilies.getByName('PageStyles').getByName(cur.PageStyleName)
metrics={k:getattr(pageStyle,k) for k in ['Width','Height','TopMargin','BottomMargin','LeftMargin','RightMargin']}
# Mark the existing spaces in an inspection copy; do not add/delete paragraphs.
en=doc.Text.createEnumeration();question=0;line=0
while en.hasMoreElements():
 p=en.nextElement()
 if not p.supportsService('com.sun.star.text.Paragraph'):continue
 if 'W-Q' in p.String:question+=1;line=0
 if p.String==' ':
  line+=1;p.String=f'Q{question} - answer line {line:02d}'
marked=layout()
assert [x['page'] for x in before]==[x['page'] for x in marked], 'inspection labels changed page distribution'
assert [x['y'] for x in before]==[x['y'] for x in marked], 'inspection labels changed vertical spacing'
doc.storeAsURL((out/'marked-space.docx').as_uri(),(prop('FilterName','Office Open XML Text'),))
doc.storeToURL((out/'marked-space.pdf').as_uri(),(prop('FilterName','writer_pdf_Export'),))
cur.jumpToLastPage();helper.executeDispatch(controller.getFrame(),'.uno:PrintPreview','',0,());time.sleep(.6)
subprocess.run(['magick','import','-display',':154','-window','root',str(out/'print-preview.png')],check=True)
helper.executeDispatch(controller.getFrame(),'.uno:ClosePreview','',0,());time.sleep(.2);doc.dispose()
# Verify actual Office save/reopen keeps the labels on the same pages.
doc=desktop.loadComponentFromURL((out/'marked-space.docx').as_uri(),'_blank',0,(prop('Hidden',False),prop('ReadOnly',True),prop('MacroExecutionMode',0)))
controller=doc.getCurrentController();cur=controller.getViewCursor();reopened=layout()
assert [x['text'] for x in reopened]==[x['text'] for x in marked]
assert [x['page'] for x in reopened]==[x['page'] for x in marked]
(out/'space-proof.json').write_text(json.dumps({'source':str(src),'units':'1/100 mm for page geometry, cursor y and margins','pageStyle':metrics,'before':before,'marked':marked,'reopenedSameTextAndPages':True},ensure_ascii=False,indent=2))
doc.dispose()
subprocess.run(['pdftoppm','-scale-to','1100','-png',str(out/'marked-space.pdf'),str(out/'page')],check=True)
