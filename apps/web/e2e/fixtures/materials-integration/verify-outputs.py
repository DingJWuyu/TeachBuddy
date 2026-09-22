"""Check the real HTTP run's output role filtering and render every PDF page."""
import json
import pathlib
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

manifest_path = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)
manifest = json.loads(manifest_path.read_text())
results = []
for item in manifest['manifest']:
    source = manifest_path.parent / 'outputs' / item['name']
    destination = target / item['name']
    shutil.copy2(source, destination)
    if source.suffix == '.docx':
        with zipfile.ZipFile(source) as archive:
            text = ''.join(ET.fromstring(archive.read('word/document.xml')).itertext())
    else:
        text = subprocess.check_output(['pdftotext', str(source), '-']).decode()
        subprocess.run(['pdftoppm', '-scale-to', '900', '-png', str(source), str(target / source.stem)], check=True)
    assert ('答案专用标记' in text) == item['options']['includeAnswers'], source.name
    assert ('本课专用标记' in text) == item['options']['includeTeacherNotes'], source.name
    assert '长期私密笔记' not in text, source.name
    if item['options']['kind'] == 'practice':
        assert '文稿专用标记' not in text and '真实资源' not in text, source.name
    (target / (source.name + '.txt')).write_text(text)
    results.append(dict(item, filterCheck='PASS'))
(target / 'manifest.json').write_text(json.dumps({'directory': manifest['directory'], 'outputs': results}, ensure_ascii=False, indent=2))
print(f'{len(results)} real output role checks PASS')
