# R30/v1 作者自检

级别：self。设计状态 READY_FOR_REVIEW，不是独立冻结或产品验收。受检对象为本目录author.md所指同一候选提交；基线 `e6d2c220796ea0746bec3413db7ba259df4c2d45`，分支 `design/r30-materials`，起始工作区干净。实际完成时间见author回执。

## 实际检查

| 检查 | 结果与证据 |
| --- | --- |
| 实验版本与原件 | C21/C22固定SHA可解析；原响应、E原件、C22 GUI日志/编辑文件已只读复核，结果和校验值见[实验裁决](../../../../arch/materials-evidence.md)。 |
| C21独立核对 | 读取全部已有完整response的content/finish_reason；核对P/I/PS六题，原始T/W读取与评分脚本；E原PDF第7-8页重新渲染目视对照；A/F空正文和E截断均未升级为成功。 |
| C22独立核对 | 解包7份B DOCX、读取全部B PDF页数和文本；查看A/B分段公式页、旧DOC缺失公式页、修改前后页图、PPT/PPTX页图；从实际PDF重新渲染教案学生2页及练习学生第1页，确认正文中的配方法。没有重跑Office GUI动作。 |
| OpenAPI | openapi-spec-validator 0.9.0校验3.2.1通过，解析本地B11及只读认证引用。36条路径、49个唯一operationId，路径参数匹配。 |
| JSON Schema/样本 | jsonschema 4.26.0 Draft202012校验102个schema及56个规范/错误样本通过，使用UUID/时间format检查。 |
| 反例 | 未知accountId、布尔字符串、未知Document版本、HTML节点、虚构来源provider、缺输出选择六种形状均被拒绝。跨字段和事务断言另在cases/BDD中，未声称产品已执行。 |
| 六输出 | schema样本覆盖3种kind×docx/pdf恰好6组合及对应受理响应；现存DOCX/PDF原件逐种链接并标注泄漏反例。 |
| BDD | gherkin-official 42.0.1解析通过；28个唯一且连续的WB-M001至M028标签，含4入口/5物化输入、6输出和4种答案/注记组合。 |
| 文档链接 | 本次全部Markdown本地目标及标题/显式锚点检查；任务包、实验裁决、契约、UX、BDD、author/self-check均互相可达。 |
| 作者语义走查 | 逐MC01至MC22检查两侧请求、成功、失败和恢复；文件不可变/资源替换/引用采用、校对入库去重、任务未知结果、B11升级及共享写者一致。 |
| 写入范围 | 仅materials文档/schema/BDD、R31-R34任务包、两处必要入口指针及R30两份回执。未改实验原件、B11定义、C20、认证、产品、根台账/DAG或CHANGELOG。 |
| Git | git diff --check及最终暂存内容空白检查通过；固定候选提交后工作区应干净，SHA由外层可见最终回复给出。 |

## 可复现的检查方式

临时环境用 `uv venv /tmp/r30-doc-check`，再执行 `uv pip install --python /tmp/r30-doc-check/bin/python pyyaml jsonschema openapi-spec-validator gherkin-official`。未添加产品依赖或仓库校验平台；检查脚本仅在本次/tmp目录，完成后删除。核心检查可在仓库根以同样环境执行：

```python
from pathlib import Path
import yaml
from jsonschema import Draft202012Validator, RefResolver, FormatChecker
from openapi_spec_validator import validate
from gherkin.parser import Parser

path = Path('docs/contracts/workbench/materials.openapi.yaml').resolve()
spec = yaml.safe_load(path.read_text())
legacy = path.with_name('first-flow.openapi.yaml')
store = {path.as_uri(): spec, legacy.as_uri(): yaml.safe_load(legacy.read_text())}
validate(spec, base_uri=path.as_uri())
resolver = RefResolver(path.as_uri(), spec, store=store)
for schema in spec['components']['schemas'].values():
    Draft202012Validator.check_schema(schema)
for example in spec['components']['examples'].values():
    schema = {'$ref': '#/components/schemas/' + example['x-schema']}
    Draft202012Validator(schema, resolver=resolver,
                         format_checker=FormatChecker()).validate(example['value'])
Parser().parse(Path('docs/acceptance/materials.feature').read_text())
```

RefResolver在当前jsonschema中有弃用提示，本次校验仍实际完成；未因此为一次性检查增加封装。反例从合法CreateManualV2逐次仅改一个字段，断言验证失败；输出样本按kind/format集合比较。链接检查按本次Git变更集合解析Markdown路径及标题锚点。产品原子性、运行时隔离、实际UI与目标设备能力不在形状检查的证明范围。

## 限制与下一步

本次没有产品代码，因此未启动产品、运行产品构建/API/E2E或宣称运行PASS。行为稿的线框不是产品截图。临时PDF重渲染只供原件复核，不取代目标Office设备证据。

C21完整自动收题/公式与图归一化交R33；通用LaTeX到可编辑Word、学生内容隔离、三类打印交R34；旧DOC完整性和Windows/WPS目标环境交R31/R32/R35及外层提供设备。真实认证由原负责人接入principal。本包作者不自行冻结，外层独立reviewer核验同一候选及这些补验归属。
