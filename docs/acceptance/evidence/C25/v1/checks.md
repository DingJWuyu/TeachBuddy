# C25/v1 实际自检与实验消费索引

本批只检查设计、schema、固定轨迹及本机零模型 SDK 能力，级别 self。未启动产品、未重跑付费实验、未使用浏览器对新产品做验收；不改变 C24/B16/A11 的证据级别。

## 实际结果

| 检查 | 实际输出 / 结果 |
| --- | --- |
| OpenAPI 3.2.1 | openapi-spec-validator 0.9.0 校验通过，含跨文件认证/业务引用。 |
| JSON Schema Draft 2020-12 | jsonschema 4.26.0，38 个 schema 通过结构校验；[50 个正反样本](../../../../contracts/agent-examples.json)预期全部一致，含空列表工具返回。[结果](contract-checks.json) |
| 操作映射 | 9 个新增 HTTP 操作均带页面上下文；写入均有来源/保护头/幂等键。13 个静态工具 operationId/method/path 与旧工作台精确相符，参数引用旧 body 与 query schema。 |
| BDD | gherkin-official 解析成功，18 个唯一 WB-AG ID 均在用户故事中关联。[结果](bdd-checks.json) |
| 固定输入 | 旧业务 `d826b72b2c8d4bec8360b82efa7d46eeb58c56ac`、基础探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3` 均为 `e8fdf9a139e429c05590925647a433a9da382579` 祖先；当前认证/首流 schema 去除 description/x-contract-status 后与认证固定源结构相同。 |
| 真实轨迹消费 | 从 Git 固定对象读取原始 JSONL/copy-history/report，逐字前缀、完整工具读回对象、原键/原体/结果 ID 元组、补验复制次数、409 及旧 aggregate=FAIL 均一致。[结果](offline/trace-audit.json) |
| 错误映射零模型复核 | 原样执行固定候选 verify-error-semantics.mjs 的本工作树副本；合成 assistant，无 provider 请求。正常返回嵌套 isError / 抛错 / afterToolCall 覆盖的外层与持久值为 false / true / true。[结果与三份本轮 JSONL](offline/error-semantics/result.json) |
| 无凭据重开 | 原样 verify-sdk.mjs，六份固定会话副本，移除 COMMANDCODE_API_KEY。消息数 2/2/4/4/29/24；精确两模型 registered=true，非法 ID=false，但 available=[]、重开模型 unknown。[原始输出](offline/sdk-reopen.json) |
| 原生 entries 重建 | 对两份真业务 JSONL 用 SessionManager.inMemory(cwd, undefined, entries) 和 SessionManager.open 比较，sessionId 与 buildSessionContext 深度相等，消息数 29/24，无 provider 请求。[结果](offline/entries-hydration.json) |
| 文档和权限 | 本批本地链接、故事/BDD 映射、契约样本、Git diff 空白检查；仅 Agent 文档/样本/BDD/任务包/本批证据及 workbench.md 追加导航。正式结果见 author。 |

Node 实际为 22.23.2，本机 pi 为 `@earendil-works/pi-coding-agent@0.85.1`。Python 校验依赖安装在本工作树临时目录，未写项目 package/lock。正式证据保留，临时输入副本、校验脚本及依赖完成后清理。

## 固定实验的复核方式

所有源文件取 `e8fdf9a139e429c05590925647a433a9da382579`。本批将所需文件通过 `git show <SHA>:<path>` 写到自己的 `.c25-review/experiments/C24/` 临时目录，保持脚本相对布局；没有执行 C24 目录中的原脚本，没有修改旧正式证据或其他工作树。SDK 输出里的临时路径只是这次输入副本的位置，稳定输入由固定 SHA 和相对路径定位。

实际执行命令（重验者先在自己的临时目录提取固定文件）：

```bash
node .c25-review/experiments/C24/business/verify-error-semantics.mjs
env -u COMMANDCODE_API_KEY PI_OFFLINE=1 node .c25-review/experiments/C24/verify-sdk.mjs \
  .c25-review/experiments/C24/runs/pi01-deepseek/session.jsonl \
  .c25-review/experiments/C24/runs/pi01-glm/session.jsonl \
  .c25-review/experiments/C24/runs/pi02-deepseek/session.jsonl \
  .c25-review/experiments/C24/runs/pi02-glm/session.jsonl \
  .c25-review/experiments/C24/business/fix-attempt1/live/sessions/pi03-deepseek.jsonl \
  .c25-review/experiments/C24/business/fix-attempt1/live/sessions/pi04-interrupt-deepseek.jsonl
```

entries 重建使用同一 SDK SessionManager 的 `inMemory` 与 `open`，比较 getSessionId() 和 buildSessionContext()，不调用 prompt。执行一次性本地断言即可，无需新建实验 runner。

未使用 verify-copy-read.mjs 重新启动 HTTP，因为它固定指向 B16 工作树和 C24 的持久数据目录。本任务没有其他工作树写入权；本批据固定真实 HTTP 轨迹做静态消费，不把这些检查写成新的活服务通过。

轨迹核对包含修复前会话前缀与补验会话完整工具返回，PI-03 新复制调用为 0，PI-04 为 1；后者新增重放与旧首写 keyHash、payloadHash、返回 ID 相同。旧冲突模型最后文本如实报告失败，但其“失败键已被消耗”的建议不作为契约。原题内容改变后任意中断恢复、实际备课写入和 GLM 业务行为仍未由 C24 证明，详见 [C25 架构裁决](../../../../arch/agent.md#实验消费结论)。

## 复验契约样本

在安装上述标准校验库的隔离 Python 环境运行以下公开入口即可重验；无需产品服务器、模型或秘密：

```python
import json, pathlib, yaml
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

base = pathlib.Path('docs/contracts').resolve()
p = base / 'agent.openapi.json'
contract = json.loads(p.read_text())
validate(contract, base_uri=p.as_uri())
documents = [(p, contract)]
for f in [base / 'auth.openapi.yaml', base / 'workbench/first-flow.openapi.yaml']:
    documents.append((f, yaml.safe_load(f.read_text())))
registry = Registry().with_resources(
    (f.as_uri(), Resource(contents=value, specification=DRAFT202012))
    for f, value in documents
)
for schema in contract['components']['schemas'].values():
    Draft202012Validator.check_schema(schema)
for case in json.loads((base / 'agent-examples.json').read_text())['cases']:
    validator = Draft202012Validator(
        {'$ref': p.as_uri() + case['schema']},
        registry=registry, format_checker=FormatChecker()
    )
    assert validator.is_valid(case['value']) == case['valid'], case['name']
```

这些是作者设计自检，不是独立冻结、UI 验收或产品测试。C26/C27 的启动条件和真实性要求见[任务包](../../../../plans/tasks/agent-implementation.md)。
