"""Independent fixed-object C25-D01 contract audit. No product/runtime/model execution.
Run with jsonschema 4.26.0, PyYAML 6.0.3, openapi-spec-validator 0.9.0,
gherkin-official 42.0.1. Writes checks.json beside this script.
"""
import copy, hashlib, json, re, subprocess
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urljoin, urldefrag
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012
from openapi_spec_validator import validate
from gherkin.parser import Parser

REV = '18293e9389e739ed8aaf67ee568503ca8e87d475'
OLD = 'cadc61aa4ff36156b4a03fb9ba3401aba9783f9a'
AUTHOR = '5e1193524c9d1d91c3a35adec3df3c832313819b'
def raw(path, rev=REV):
    return subprocess.check_output(['git', 'show', f'{rev}:{path}'])
paths = ['docs/contracts/agent.openapi.json', 'docs/contracts/auth.openapi.yaml', 'docs/contracts/workbench/first-flow.openapi.yaml']
uri = 'https://offline.invalid/docs/contracts/agent.openapi.json'
docs = {urljoin('https://offline.invalid/', p): yaml.safe_load(raw(p)) for p in paths}
s = docs[uri]
registry = Registry().with_resources((u, Resource(contents=d, specification=DRAFT202012)) for u,d in docs.items())
def validator(ref):
    return Draft202012Validator({'$ref': urljoin(uri, ref)}, registry=registry, format_checker=FormatChecker())
def expand(x, base=uri):
    if isinstance(x, list): return [expand(v,base) for v in x]
    if not isinstance(x,dict): return x
    if '$ref' in x:
        u,p = urldefrag(urljoin(base,x['$ref']))
        v=docs[u]
        for k in p.lstrip('/').split('/'): v=v[k.replace('~1','/').replace('~0','~')]
        return expand(v,u)
    return {k:expand(v,base) for k,v in x.items()}
validate(expand(s))
for v in s['components']['schemas'].values(): Draft202012Validator.check_schema(v)
cases=json.loads(raw('docs/contracts/agent-examples.json'))['cases']
results=[]
for c in cases:
    actual=validator(c['schema']).is_valid(c['value'])
    assert actual == c['valid'], c['name']
    results.append({'name':c['name'],'expected':c['valid'],'actual':actual})
by={c['name']:c['value'] for c in cases}
checks=[]
def expect(label, value, valid, ref='#/components/schemas/ToolCall'):
    actual=validator(ref).is_valid(value)
    assert actual == valid, (label,actual)
    checks.append({'case':label,'expected':valid,'actual':actual})
for t in s['x-agent-tools']:
    good=by['公开成功-'+t['name']]
    # Every named branch must reference the tool's authoritative parameters/response.
    branch=next(b for b in s['components']['schemas']['ToolCall']['allOf'][3]['oneOf'] if b['properties']['name']['const']==t['name'])
    assert branch['properties']['arguments']['anyOf'][0]==t['parameters']
    assert branch['properties']['result']['anyOf'][0]==t['response']
    for field in s['components']['schemas']['ToolCall']['required']:
        v=copy.deepcopy(good); del v[field]
        expect(t['name']+' missing '+field,v,False)
    for state in s['components']['schemas']['ToolCall']['properties']['state']['enum']:
        v=copy.deepcopy(good); v.update(state=state,result=None,problem=None)
        if state in ['read','confirmed']: v['result']=good['result']
        if state=='rejected': v['problem']={'type':'/problems/workbench/not-found'}
        if state=='failed': v['problem']=by['只读异常']['problem']
        if state=='unconfirmed': v['problem']=by['未确认操作']['problem']
        allowed=['prepared','executing','rejected','cancelled']+(['confirmed','unconfirmed'] if t['mutation'] else ['read','failed','interrupted'])
        expect(t['name']+' state '+state,v,state in allowed)
    for args in [None, {'principal':'injected'}]:
        v=copy.deepcopy(good); v['arguments']=args
        expect(t['name']+' invalid successful arguments '+str(args),v,False)
    v=copy.deepcopy(good); v.update(arguments=None,operationId=None,state='rejected',result=None,problem={'type':'/problems/workbench/invalid-input','field':'/arguments','reason':'invalid-type'})
    expect(t['name']+' invalid-input rejection',v,True)
    v=copy.deepcopy(good); v['result']=None
    expect(t['name']+' missing success result',v,False)
    v=copy.deepcopy(good); v['operationId']=None if t['mutation'] else '11111111-1111-4111-8111-111111111111'
    expect(t['name']+' wrong journal association',v,False)
# Reconstruct from each possible disconnection boundary; generic identity-based upsert.
events=[by['只读失败链-事件-'+str(n)] for n in range(6,10)]
def apply(snap,ev):
    if ev['seq']<=snap['lastEventSeq']: return
    assert ev['seq']==snap['lastEventSeq']+1
    assert ev['conversationId']==snap['conversation']['id']
    if ev['type']=='conversation': snap['conversation']=copy.deepcopy(ev['value'])
    else:
        coll={'turn':'turns','toolCall':'toolCalls'}[ev['type']]
        key=lambda v: (v['turnId'],v['toolCallId']) if coll=='toolCalls' else v['id']
        matches=[i for i,v in enumerate(snap[coll]) if key(v)==key(ev['value'])]
        if matches: snap[coll][matches[0]]=copy.deepcopy(ev['value'])
        else: snap[coll].append(copy.deepcopy(ev['value']))
    snap['lastEventSeq']=ev['seq']
for split in range(5):
    snap=copy.deepcopy(by['只读失败链-开始快照'])
    for ev in events[:split]: apply(snap,ev)
    for ev in events: apply(snap,ev); apply(snap,ev)
    assert snap==by['只读失败链-恢复快照']
    assert not snap['operations'] and all(m['role']=='user' for m in snap['messages'])
    assert snap['toolCalls'][0]['problem']=={'type':'/problems/workbench/not-found'}
# Semantic joins deliberately checked beyond JSON Schema's structural scope.
joins=[]
for c in cases:
    if not c['valid'] or c['schema']!='#/components/schemas/Snapshot': continue
    snap=c['value']; calls=snap['toolCalls']; ops={v['id']:v for v in snap['operations']}
    assert len({(v['turnId'],v['toolCallId']) for v in calls})==len(calls)
    assert len({(v['turnId'],v['ordinal']) for v in calls})==len(calls)
    for v in calls:
        assert v['turnId'] in {t['id'] for t in snap['turns']}
        if v['operationId'] is None: continue
        op=ops[v['operationId']]
        tool=next(t for t in s['x-agent-tools'] if t['name']==v['name'])
        assert op['request']=={'operationId':tool['operationId'],'arguments':v['arguments']}
        assert all(op[k]==v[k] for k in ['turnId','state','result','problem'])
    for op in ops.values():
        assert any(v['toolCallId']==op['toolCallId'] and v['operationId']==op['id'] and v['turnId']==op['turnId'] for v in calls)
    joins.append(c['name'])
for state in ['read','failed','cancelled','interrupted']:
    call=by['只读恢复-'+state]['toolCalls'][0]
    assert call['state']==state
    assert all(call[k]==by['只读失败链-开始快照']['toolCalls'][0][k] for k in ['turnId','toolCallId','ordinal','name','arguments','operationId'])
    assert by['只读结果事件-'+state]['value']==call
before=by['写入恢复-待确认']; after=by['写入恢复-核实后']
assert before['operations'][0]['request']==after['operations'][0]['request']
assert before['operations'][0]['id']==after['operations'][0]['id']
assert before['operations'][0]['state']=='unconfirmed' and after['operations'][0]['state']=='confirmed'
alias=by['复用已确认写入']
assert len(alias['operations'])==1 and len(alias['toolCalls'])==2
assert len({c['operationId'] for c in alias['toolCalls']})==1
feature=raw('docs/acceptance/agent.feature').decode()
ast=Parser().parse(feature)
ids=re.findall(r'@WB-AG-\d+',feature)
assert len(set(ids))==len(ids)==23
assert feature.startswith(raw('docs/acceptance/agent.feature',OLD).decode())
assert all(i[1:] in raw('docs/user-stories/agent.md').decode() for i in ids)
outline=next(c['scenario'] for c in ast['feature']['children'] if any(t['name']=='@WB-AG-022' for t in c.get('scenario',{}).get('tags',[])))
assert len(outline['examples'][0]['tableBody'])==6
old=json.loads(raw(paths[0],OLD))
assert old['paths']==s['paths'] and old['x-agent-tools']==s['x-agent-tools']
affected={'Snapshot','Event','Turn','ToolOutcome','AgentProblem'}
assert all(v==s['components']['schemas'][k] for k,v in old['components']['schemas'].items() if k not in affected)
assert all(raw(p)==raw(p,OLD) for p in paths[1:])
assert subprocess.check_output(['git','diff','--name-only',REV,AUTHOR]).decode().splitlines()==['docs/acceptance/evidence/C25/v1/correction.md']
for p in subprocess.check_output(['git','ls-tree','-r','--name-only',OLD,'docs/acceptance/evidence/C25/v1']).decode().splitlines(): assert raw(p)==raw(p,OLD)
review_paths=paths+['docs/contracts/agent-examples.json','docs/contracts/agent.md','docs/arch/agent.md','docs/ux/agent.md','docs/user-stories/agent.md','docs/acceptance/agent.feature','docs/plans/tasks/agent-implementation.md']
out={'utc':datetime.now(timezone.utc).isoformat(),'candidate':REV,'author':AUTHOR,'scope':'Independent static contract audit only; zero product/runtime/model execution','openapi':'PASS','schemas':len(s['components']['schemas']),'examples':results,'independentMutations':checks,'replayDisconnectBoundaries':5,'snapshotJoins':joins,'stopRestartSamples':'PASS','writeReconcileAndAlias':'PASS','bddIds':ids,'WB-AG-022Rows':6,'unchangedInputs':'PASS','sha256':{p:hashlib.sha256(raw(p)).hexdigest() for p in review_paths}}
Path(__file__).with_name('checks.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:len(out[k]) for k in ['examples','independentMutations','snapshotJoins']},ensure_ascii=False))
