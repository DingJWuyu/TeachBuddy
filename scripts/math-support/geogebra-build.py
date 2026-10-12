#!/usr/bin/env python3
"""Build the pinned, UI-resource-free GeoGebra browser runtime."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.parse

repository = Path(__file__).resolve().parents[2]
tools = repository / 'tools/geogebra'
manifest = json.loads((tools / 'manifest.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache', type=Path, default=tools / '.cache')
parser.add_argument('--check', action='store_true', help='Validate installed assets without downloading or compiling')
parser.add_argument('--record-dependencies', action='store_true', help='Maintainer: record Gradle dependency SHA-256 metadata')
parser.add_argument('--force', action='store_true', help='Recompile even when installed assets match inputs')
parser.add_argument('--destination', type=Path, default=repository / 'apps/web/public/vendor/math/geogebra')
args = parser.parse_args()
cache = args.cache.resolve()
destination = args.destination.resolve()
inputs = [tools / name for name in ['manifest.json', 'loader.js', 'canvas.css', 'EUPL-1.2.txt', 'NOTICE.txt']]
inputs += sorted((tools / 'licenses').rglob('*'))
inputs += sorted((tools / 'verification').rglob('*.xml'))
inputs += [repository / 'scripts/math-support/geogebra-patch.py', Path(__file__).resolve()]
def inputs_digest():
    return hashlib.sha256(b''.join(str(p.relative_to(repository)).encode() + b'\0' + p.read_bytes() + b'\0'
        for p in sorted(set(inputs), key=lambda item: str(item.relative_to(repository))) if p.is_file())).hexdigest()
input_hash = inputs_digest()
def installed():
    try:
        record = json.loads((destination / 'build-info.json').read_text())
        return record['inputHash'] == input_hash and all(
            hashlib.file_digest((destination / name).open('rb'), 'sha256').hexdigest() == digest
            for name, digest in record['files'].items())
    except (OSError, ValueError, KeyError):
        return False
if not args.force and not args.record_dependencies and installed():
    print(f'Validated local GeoGebra runtime: {destination}')
    raise SystemExit(0)
if args.check:
    raise SystemExit('Local GeoGebra runtime is missing or stale. Run python3 scripts/math-support/geogebra-build.py')
cache.mkdir(parents=True, exist_ok=True)

def download(item, target):
    if not target.exists():
        partial = target.with_suffix(target.suffix + '.partial')
        subprocess.run(['curl', '--fail', '--location', '--retry', '2', item['url'], '-o', str(partial)], check=True)
        partial.rename(target)
    actual = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
    if actual != item['sha256']:
        raise RuntimeError(f'Checksum mismatch: {target.name}: {actual}')

def extract(archive):
    with tarfile.open(archive) as bundle:
        directory = cache / bundle.getmembers()[0].name.split('/')[0]
        if not directory.exists():
            bundle.extractall(cache, filter='data')
    return directory

archive = cache / 'source.tar.gz'
download(manifest['source'], archive)
source = extract(archive)
jdk_archive = cache / 'jdk.tar.gz'
download(manifest['jdk'], jdk_archive)
jdk = extract(jdk_archive)
compile_archive = cache / 'jdk17.tar.gz'
download(manifest['compileJdk'], compile_archive)
compile_jdk = extract(compile_archive)
# Reset only the owned source directory when a patch changes.
patch = repository / 'scripts/math-support/geogebra-patch.py'
patch_hash = hashlib.file_digest(patch.open('rb'), 'sha256').hexdigest()
stamp = source / '.teacherworkspace-patch'
if not stamp.exists() or stamp.read_text() != patch_hash:
    shutil.rmtree(source)
    source = extract(archive)
    subprocess.run(['python3', str(patch), str(source)], check=True)
    stamp.write_text(patch_hash)
environment = dict(os.environ, JAVA_HOME=str(jdk), GRADLE_USER_HOME=str(cache / 'gradle'))
# Java does not honor conventional proxy variables. Translate a configured proxy
# without putting credentials into logs or repository configuration.
proxy = urllib.parse.urlsplit(os.environ.get('https_proxy', ''))
if proxy.hostname and proxy.port:
    opts = f'-Dhttps.proxyHost={proxy.hostname} -Dhttps.proxyPort={proxy.port} -Dhttp.proxyHost={proxy.hostname} -Dhttp.proxyPort={proxy.port}'
    environment['JAVA_TOOL_OPTIONS'] = (os.environ.get('JAVA_TOOL_OPTIONS', '') + ' ' + opts).strip()
for item in (tools / 'verification').rglob('*.xml'):
    target = source / item.relative_to(tools / 'verification')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(item, target)
# Recording is deliberately offline: GWT's successful build already resolved its
# required artifacts. Gradle otherwise downloads every unused test configuration.
gradle_options = ['--offline', '--write-verification-metadata', 'sha256'] if args.record_dependencies else []
subprocess.run([str(source / 'gradlew'), '-p', str(source / 'source/web'), ':web:gwtCompile',
                '-Porg.gradle.java.installations.paths=' + str(compile_jdk), '-Porg.gradle.java.installations.auto-download=false',
                '-Pgmodule=' + manifest['module'], '-Pgworkers=1', '--no-daemon', '--max-workers=1', '-Pkotlin.compiler.execution.strategy=in-process', '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8'] + gradle_options,
               env=environment, check=True)
war = source / 'source/web/web/war/web3d'
if not (war / 'web3d.nocache.js').is_file():
    raise RuntimeError('GWT compilation did not produce the expected runtime.')
if args.record_dependencies:
    for metadata in source.rglob('verification-metadata.xml'):
        target = tools / 'verification' / metadata.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(metadata, target)
    inputs += [p for p in sorted((tools / 'verification').rglob('*.xml')) if p not in inputs]
    input_hash = inputs_digest()
if hashlib.file_digest(patch.open('rb'), 'sha256').hexdigest() != patch_hash:
    raise RuntimeError('Patch changed during compilation; refusing to stamp old output.')
# Package only the canvas runtime, mathematical fonts and the SVG exporter.
# GWT's public-path copy also contains unrelated official HTML/service workers.
staging = destination.with_name(destination.name + '.building')
if staging.exists():
    raise RuntimeError(f'Previous incomplete packaging exists: {staging}')
staging.mkdir(parents=True)
for item in war.rglob('*'):
    relative = item.relative_to(war)
    keep = (item.name == 'web3d.nocache.js' or item.name == 'clear.cache.gif'
            or item.name.endswith('.cache.js') or relative.parts[0] == 'fonts'
            or str(relative) == 'js/canvas-to-svg.umd.min.js')
    if item.is_file() and keep:
        target = staging / 'web3d' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
previous_destination = destination
destination = staging
shutil.copytree(tools / 'licenses', destination / 'licenses')
for name in ['loader.js', 'canvas.css', 'manifest.json', 'EUPL-1.2.txt', 'NOTICE.txt']:
    shutil.copy2(tools / name, destination / name)
rebuild = destination / 'source/rebuild'
(rebuild / 'scripts/math-support').mkdir(parents=True)
shutil.copy2(patch, rebuild / 'scripts/math-support/geogebra-patch.py')
shutil.copy2(Path(__file__).resolve(), rebuild / 'scripts/math-support/geogebra-build.py')
shutil.copytree(tools, rebuild / 'tools/geogebra', ignore=shutil.ignore_patterns('.cache', '__pycache__'))
shutil.copy2(source / 'teacherworkspace-resource-replacements.json', destination / 'resource-replacements.json')
files = {str(p.relative_to(destination)): hashlib.file_digest(p.open('rb'), 'sha256').hexdigest()
         for p in sorted(destination.rglob('*')) if p.is_file() and p.name != 'build-info.json'}
(destination / 'build-info.json').write_text(json.dumps({'inputHash': input_hash, 'patchHash': patch_hash, 'source': manifest['source']['revision'], 'files': files}, indent=2) + '\n')
if previous_destination.exists():
    shutil.rmtree(previous_destination)
destination.rename(previous_destination)
print(f'Local GeoGebra runtime: {previous_destination}')
