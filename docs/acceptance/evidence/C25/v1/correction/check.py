"""C25-D01 offline structure, exchange and recovery audit; no product/runtime/model calls.
Run from repository root with jsonschema, PyYAML, openapi-spec-validator, gherkin-official.
"""
import copy
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urldefrag
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012
from openapi_spec_validator import validate
from gherkin.parser import Parser

ROOT = Path.cwd()
BASE = 'b7732f80a74111c5c30b1758335707324e5e7563'
CONTRACT = ROOT / 'docs/contracts/agent.openapi.json'
s = json.loads(CONTRACT.read_text())
files = [CONTRACT, ROOT / 'docs/contracts/workbench/first-flow.openapi.yaml', ROOT / 'docs/contracts/auth.openapi.yaml']
docs = {p.as_uri(): yaml.safe_load(p.read_text()) for p in files}
registry = Registry().with_resources((uri, Resource(contents=d, specification=DRAFT202012)) for uri, d in docs.items())
def validator(ref):
    return Draft202012Validator({'$ref': CONTRACT.as_uri() + ref}, registry=registry, format_checker=FormatChecker())
def inline(value, uri):
    if isinstance(value, list):
        return [inline(v, uri) for v in value]
    if not isinstance(value, dict):
        return value
    if '$ref' in value:
        target_uri, pointer = urldefrag(urljoin(uri, value['$ref']))
        target = docs[target_uri]
        for part in pointer.lstrip('/').split('/'):
            target = target[part.replace('~1', '/').replace('~0', '~')]
        return inline(target, target_uri)
    return {k: inline(v, uri) for k, v in value.items()}
validate(inline(s, CONTRACT.as_uri()))
for schema in s['components']['schemas'].values():
    Draft202012Validator.check_schema(schema)
cases = json.loads((ROOT / 'docs/contracts/agent-examples.json').read_text())['cases']
results = []
for c in cases:
    actual = validator(c['schema']).is_valid(c['value'])
    assert actual == c['valid'], c['name']
    results.append({'name': c['name'], 'expected': c['valid'], 'actual': actual})
by = {c['name']: c['value'] for c in cases}
# Direct per-tool mutations check the shared lifecycle constraints, not product execution.
tool_matrix = []
for t in s['x-agent-tools']:
    v = copy.deepcopy(by['公开成功-' + t['name']])
    check = validator('#/components/schemas/ToolCall')
    assert check.is_valid(v)
    for state in ['prepared', 'executing', 'cancelled', 'rejected'] + (['unconfirmed'] if t['mutation'] else ['failed', 'interrupted']):
        item = copy.deepcopy(v)
        item.update(state=state, result=None, problem=None)
        if state == 'rejected':
            item['problem'] = {'type': '/problems/workbench/not-found'}
        elif state == 'failed':
            item['problem'] = by['只读异常']['problem']
        elif state == 'unconfirmed':
            item['problem'] = by['未确认操作']['problem']
        assert check.is_valid(item), (t['name'], state)
    invalid = copy.deepcopy(v)
    invalid.update(arguments=None, operationId=None, state='rejected', result=None,
                   problem={'type': '/problems/workbench/invalid-input', 'field': '/arguments', 'reason': 'invalid-type'})
    assert check.is_valid(invalid)
    invalid['state'] = 'executing'
    assert not check.is_valid(invalid)
    forbidden = copy.deepcopy(v)
    forbidden.update(state='interrupted' if t['mutation'] else 'unconfirmed', result=None)
    assert not check.is_valid(forbidden)
    tool_matrix.append({'tool': t['name'], 'mutation': t['mutation'], 'lifecycleAndInvalidArguments': 'PASS'})
# Cross-object constraints are semantic assertions; JSON Schema cannot express these joins.
snapshots = []
for c in cases:
    if c['schema'] != '#/components/schemas/Snapshot' or not c['valid']:
        continue
    snap = c['value']
    turns = {x['id']: x for x in snap['turns']}
    ops = {x['id']: x for x in snap['operations']}
    keys, ordinals = set(), set()
    for call in snap['toolCalls']:
        key = (call['turnId'], call['toolCallId'])
        ordinal = (call['turnId'], call['ordinal'])
        assert key not in keys and ordinal not in ordinals
        keys.add(key); ordinals.add(ordinal)
        assert call['turnId'] in turns
        if call['operationId'] is not None:
            op = ops[call['operationId']]
            tool = next(t for t in s['x-agent-tools'] if t['name'] == call['name'])
            assert op['turnId'] == call['turnId']
            assert op['request'] == {'operationId': tool['operationId'], 'arguments': call['arguments']}
            assert all(op[k] == call[k] for k in ['state', 'result', 'problem'])
    for op in ops.values():
        assert (op['turnId'], op['toolCallId']) in keys
        aliases = [call for call in snap['toolCalls'] if call['operationId'] == op['id']]
        if len(aliases) > 1:
            assert op['state'] == 'confirmed'
    snapshots.append(c['name'])
# Reapply persisted SSE after a gap; duplicate seq is ignored; only public fields are used.
replayed = copy.deepcopy(by['只读失败链-开始快照'])
for seq in [6, 7, 7, 8, 9]:
    ev = by['只读失败链-事件-' + str(seq)]
    if seq <= replayed['lastEventSeq']:
        continue
    assert seq == replayed['lastEventSeq'] + 1
    if ev['type'] == 'conversation':
        replayed['conversation'] = copy.deepcopy(ev['value'])
    else:
        collection = 'toolCalls' if ev['type'] == 'toolCall' else 'turns'
        replayed[collection] = [copy.deepcopy(ev['value'])]
    replayed['lastEventSeq'] = seq
assert replayed == by['只读失败链-恢复快照']
assert replayed['operations'] == [] and all(m['role'] == 'user' for m in replayed['messages'])
assert replayed['toolCalls'][0]['problem'] == {'type': '/problems/workbench/not-found'}
# State examples preserve identity while specifying stop/restart outcomes.
origin = by['只读失败链-开始快照']['toolCalls'][0]
for name in ['只读恢复-read', '只读恢复-failed', '只读恢复-cancelled', '只读恢复-interrupted']:
    call = by[name]['toolCalls'][0]
    assert all(call[k] == origin[k] for k in ['turnId', 'toolCallId', 'ordinal', 'name', 'arguments', 'operationId'])
# Unaffected design remains byte/structure-identical; no old evidence is regenerated.
def old(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'])
original = json.loads(old('docs/contracts/agent.openapi.json'))
assert 'toolCalls' not in original['components']['schemas']['Snapshot']['properties']
assert 'toolCall' not in [x['properties']['type']['const'] for x in original['components']['schemas']['Event']['oneOf']]
assert original['paths'] == s['paths'] and original['x-agent-tools'] == s['x-agent-tools']
affected = {'Snapshot', 'Event', 'Turn', 'ToolOutcome', 'AgentProblem'}
assert all(v == s['components']['schemas'][k] for k, v in original['components']['schemas'].items() if k not in affected)
assert s['components']['schemas']['Event']['oneOf'][:-1] == original['components']['schemas']['Event']['oneOf']
feature = (ROOT / 'docs/acceptance/agent.feature').read_text()
assert feature.startswith(old('docs/acceptance/agent.feature').decode())
Parser().parse(feature)
ids = re.findall(r'@WB-AG-\d+', feature)
assert len(ids) == len(set(ids)) == 23
stories = (ROOT / 'docs/user-stories/agent.md').read_text()
assert all(tag[1:] in stories for tag in ids)
for path in ['docs/contracts/auth.openapi.yaml', 'docs/contracts/workbench/first-flow.openapi.yaml']:
    assert (ROOT / path).read_bytes() == old(path)
preserved = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE, 'docs/acceptance/evidence/C25/v1']).decode().splitlines()
assert all((ROOT / p).read_bytes() == old(p) for p in preserved)
paths = ['docs/contracts/agent.openapi.json', 'docs/contracts/agent-examples.json', 'docs/contracts/agent.md',
         'docs/arch/agent.md', 'docs/ux/agent.md', 'docs/user-stories/agent.md',
         'docs/acceptance/agent.feature', 'docs/plans/tasks/agent-implementation.md']
out = {'checkedAtUTC': datetime.now(timezone.utc).isoformat(), 'base': BASE, 'scope': 'Static design only; no product, browser, runtime or provider requests.',
       'openapi': 'PASS', 'schemas': len(s['components']['schemas']), 'examples': results,
       'tools': tool_matrix, 'snapshotAssociations': snapshots, 'readFailureReplayWithoutAssistantOrMutation': 'PASS',
       'stopRestartIdentitySamples': 'PASS', 'bddIds': ids, 'unaffectedDesignAndOldEvidence': 'PASS',
       'sha256': {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths}}
Path(__file__).with_name('checks.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'openapi': out['openapi'], 'schemas': out['schemas'], 'examples': len(results), 'tools': len(tool_matrix), 'bdd': len(ids), 'recovery': 'PASS'}, ensure_ascii=False))
