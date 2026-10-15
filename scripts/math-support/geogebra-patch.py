"""Replace restricted UI inputs before GWT in the pinned source checkout."""
from pathlib import Path
import base64
import json
import re
import sys

root = Path(sys.argv[1]).resolve()
replaced = []

def method(file, signature, body):
    p = root / file
    text = p.read_text()
    start = text.index(signature)
    opening = text.index('{', start)
    depth = 1
    end = opening + 1
    while depth:
        depth += (text[end] == '{') - (text[end] == '}')
        end += 1
    p.write_text(text[:opening + 1] + '\n' + body + '\n\t' + text[end - 1:])
    replaced.append(file)

method('source/web/web-common/src/main/java/org/geogebra/web/html5/js/ResourcesInjector.java',
       'protected void injectResourcesGUI(', '\t\t// Host application owns all canvas styles.')
method('source/web/web/src/main/java/org/geogebra/web/full/helper/ResourcesInjectorFull.java',
       'protected void injectResourcesGUI(', '\t\t// No official language files or UI styles are injected.')
method('source/web/web-common/src/main/java/org/geogebra/web/html5/main/LocalizationW.java',
       'public void loadScript(', '\t\tpreferredTag = language.toLanguageTag();\n\t\tapp.doSetLanguage(preferredTag, false);')
# The resource processor still resolves every referenced asset. Keep valid, original
# transparent placeholders at those paths so no GeoGebra artwork reaches the JS.
png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=')
gif = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"/>\n'
for folder in [root / 'source/web', root / 'source/shared/common/src/main/resources']:
    for p in folder.rglob('*'):
        if not p.is_file() or 'renderer-web' in p.parts:
            continue
        ext = p.suffix.lower()
        if ext in ['.svg', '.png', '.gif']:
            p.write_bytes(svg.encode() if ext == '.svg' else gif if ext == '.gif' else png)
            replaced.append(str(p.relative_to(root)))
        elif p.name.startswith('properties_keys_') and ext == '.js':
            p.write_text('// No official translations included. English commands use source identifiers.\n')
            replaced.append(str(p.relative_to(root)))
# Use direct script installation for HTTP and file alike; there is no remote loader.
p = root / 'source/web/web/src/main/resources/org/geogebra/web/resources/js/installScriptDirect.js'
text = p.read_text()
a = text.index('    if (location.protocol.startsWith("http")')
b = text.index("    sendStats('moduleStartup', 'scriptTagAdded');", a)
p.write_text(text[:a] + '    script.src = code;\n    docbody.appendChild(script);\n\n' + text[b:])
# Bound the one-time compiler to one worker and modest JVM heaps.
p = root / 'source/build-logic/convention/src/main/kotlin/gwt-conventions.gradle.kts'
p.write_text(p.read_text().replace('maxHeapSize = "4096m"', 'maxHeapSize = "3072m"'))
p = root / 'source/web/web/build.gradle.kts'
p.write_text(p.read_text().replace('listOf("-Xmx4g")', 'listOf("-Xmx1536m")'))
(root / 'teachbuddy-resource-replacements.json').write_text(json.dumps(replaced, indent=2) + '\n')
print(f'Replaced {len(replaced)} restricted resource inputs and loading seams.')
# Native collaboration and native rich/script editors are outside this canvas API
# profile. Their bundled JS has no corresponding license/source in the Maven
# artifacts, and rich-editor JS also embeds its own UI styles.
for file, expression in [
    ('source/web/web/src/main/java/org/geogebra/web/full/gui/ShareControllerW.java', 'JavaScriptInjector.inject(MultiplayerResources.INSTANCE.multiplayer());'),
    ('source/web/web/src/main/java/org/geogebra/web/full/gui/util/CodeMirrorEditorWidget.java', 'JavaScriptInjector.inject(CodeMirrorResources.INSTANCE.codemirror());'),
    ('source/web/carota-web/src/main/java/org/geogebra/web/richtext/impl/CarotaUtil.java', 'JavaScriptInjector.inject(MurokResources.INSTANCE.murokJs());'),
]:
    p = root / file
    text = p.read_text()
    if expression not in text:
        raise RuntimeError(f'Expected native UI resource injection in {file}')
    p.write_text(text.replace(expression, '// Native editor/collaboration bundle excluded from the canvas profile.'))
    replaced.append(file)
(root / 'teachbuddy-resource-replacements.json').write_text(json.dumps(replaced, indent=2) + '\n')
# Works are edited through host-owned UI/API; embedded JavaScript is unsupported.
method('source/web/web-common/src/main/java/org/geogebra/web/html5/main/scripting/Sandbox.java',
       'public void run(String script)', '\t\tthrow new UnsupportedOperationException("Embedded JavaScript is disabled in this canvas runtime.");')
method('source/web/web-common/src/main/java/org/geogebra/web/html5/main/scripting/Sandbox.java',
       'static Promise<Object> loadContext(', '\t\treturn Promise.reject("Embedded JavaScript is disabled in this canvas runtime.");')
(root / 'teachbuddy-resource-replacements.json').write_text(json.dumps(replaced, indent=2) + '\n')
