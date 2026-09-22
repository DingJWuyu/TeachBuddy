"""Run with LibreOffice's bundled Python and a task-owned UNO/GUI process."""
import json, pathlib, sys, subprocess, time
import uno
from com.sun.star.beans import PropertyValue

def prop(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p
root = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]).resolve(); out.mkdir(parents=True, exist_ok=True)
ctx = uno.getComponentContext()
resolver = ctx.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', ctx)
remote = resolver.resolve('uno:socket,host=127.0.0.1,port=50945;urp;StarOffice.ComponentContext')
manager = remote.ServiceManager
desktop = manager.createInstanceWithContext('com.sun.star.frame.Desktop', remote)
helper = manager.createInstanceWithContext('com.sun.star.frame.DispatchHelper', remote)
results = []
for kind in ['lesson-plan', 'handout', 'practice']:
    source = root / (kind + '-00.docx')
    doc = desktop.loadComponentFromURL(source.as_uri(), '_blank', 0, (prop('Hidden', False), prop('MacroExecutionMode', 0), prop('UpdateDocMode', 0)))
    try:
        objects = doc.getEmbeddedObjects()
        before = [objects.getByIndex(i).getEmbeddedObject().Formula for i in range(objects.Count)]
        assert len(before) >= 17
        record = {'source': source.name, 'formulas': len(before), 'images': doc.getGraphicObjects().Count}
        if kind == 'handout':
            for round_number in [1, 2]:
                cursor = doc.Text.createTextCursor(); cursor.gotoStart(False)
                doc.Text.insertString(cursor, '中文编辑第%d轮\n' % round_number, False)
                obj = doc.getEmbeddedObjects().getByIndex(0).getEmbeddedObject()
                obj.Formula = ('f(x) = {sqrt {2 x - 1}} over {x + 4}' if round_number == 1 else 'f(x) = {nroot {3} {2 x - 1}} over {x + 5}')
                saved = out / ('handout-edited-%d.docx' % round_number)
                doc.storeAsURL(saved.as_uri(), (prop('FilterName', 'Office Open XML Text'),))
                expected = obj.Formula
                inline = doc.getEmbeddedObjects().getByIndex(1).getEmbeddedObject()
                inline.Formula = '{sqrt {2 x + 1}} over {x + %d}' % (round_number + 3)
                inline_expected = inline.Formula
                doc.store()
                doc.close(True)
                doc = desktop.loadComponentFromURL(saved.as_uri(), '_blank', 0, (prop('Hidden', False), prop('MacroExecutionMode', 0), prop('UpdateDocMode', 0)))
                actual = doc.getEmbeddedObjects().getByIndex(0).getEmbeddedObject().Formula
                normalize = lambda f: f.replace(' ', '').replace('left', '').replace('right', '').replace('−', '-')
                assert normalize(actual) == normalize(expected), (expected, actual)
                inline_actual = doc.getEmbeddedObjects().getByIndex(1).getEmbeddedObject().Formula
                assert normalize(inline_actual) == normalize(inline_expected), (inline_expected, inline_actual)
                assert '中文编辑第%d轮' % round_number in doc.Text.String
                record['round%d' % round_number] = {'displayFormula': actual, 'inlineFormula': inline_actual, 'reopened': True, 'chineseRetained': True}
            doc.storeToURL((out / 'handout-edited.pdf').as_uri(), (prop('FilterName', 'writer_pdf_Export'),))
        controller = doc.getCurrentController(); cursor = controller.getViewCursor(); cursor.jumpToLastPage()
        record['pages'] = cursor.getPage()
        helper.executeDispatch(controller.getFrame(), '.uno:PrintPreview', '', 0, ())
        time.sleep(0.8)
        subprocess.run(['magick', 'import', '-display', ':154', '-window', 'root', str(out / (kind + '-print-preview.png'))], check=True)
        record['printPreview'] = True
        helper.executeDispatch(controller.getFrame(), '.uno:ClosePreview', '', 0, ())
        time.sleep(0.5)
        results.append(record)
    finally:
        doc.setModified(False); doc.close(True)
(out / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps(results, ensure_ascii=False))
