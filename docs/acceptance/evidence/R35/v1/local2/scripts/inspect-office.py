import json, pathlib, sys, subprocess, time
import uno
from com.sun.star.beans import PropertyValue

def prop(name, value):
    item = PropertyValue(); item.Name = name; item.Value = value; return item
context = uno.getComponentContext()
resolver = context.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', context)
remote = resolver.resolve('uno:socket,host=127.0.0.1,port=49938;urp;StarOffice.ComponentContext')
manager = remote.ServiceManager
desktop = manager.createInstanceWithContext('com.sun.star.frame.Desktop', remote)
helper = manager.createInstanceWithContext('com.sun.star.frame.DispatchHelper', remote)
source = pathlib.Path(sys.argv[1]).resolve()
destination = pathlib.Path(sys.argv[2]).resolve(); destination.mkdir(parents=True, exist_ok=True)
doc = desktop.loadComponentFromURL(source.as_uri(), '_blank', 0, (prop('Hidden', False), prop('ReadOnly', True), prop('MacroExecutionMode', 0), prop('UpdateDocMode', 0)))
try:
    controller = doc.getCurrentController()
    cursor = controller.getViewCursor()
    cursor.jumpToLastPage()
    pages = cursor.getPage()
    paragraphs = []
    enumerator = doc.Text.createEnumeration()
    while enumerator.hasMoreElements():
        item = enumerator.nextElement()
        if not item.supportsService('com.sun.star.text.Paragraph'): continue
        cursor.gotoRange(item.getStart(), False)
        paragraphs.append({'text': item.String, 'page': cursor.getPage(), 'y': cursor.Position.Y,
                           'height': item.ParaLineSpacing.Height, 'mode': item.ParaLineSpacing.Mode,
                           'bottomMargin': item.ParaBottomMargin})
    doc.storeToURL((destination/'writer.pdf').as_uri(), (prop('FilterName', 'writer_pdf_Export'),))
    helper.executeDispatch(controller.getFrame(), '.uno:PrintPreview', '', 0, ())
    time.sleep(0.5)
    subprocess.run(['magick', 'import', '-display', ':1352', '-window', 'root', str(destination/'print-preview.png')], check=True)
    (destination/'layout.json').write_text(json.dumps({'pages': pages, 'paragraphs': paragraphs, 'formulas': doc.getEmbeddedObjects().getCount(), 'images': doc.getGraphicObjects().getCount(), 'printPreview': True}, ensure_ascii=False, indent=2))
finally:
    helper.executeDispatch(controller.getFrame(), '.uno:ClosePreview', '', 0, ())
    time.sleep(0.5)
    doc.setModified(False)
    doc.dispose()
