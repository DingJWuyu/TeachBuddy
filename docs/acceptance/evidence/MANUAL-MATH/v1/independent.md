# MANUAL-MATH-ACCEPTANCE@1

```yaml
task: MANUAL-MATH-ACCEPTANCE@1
attempt: 1
role: independent-acceptance
status: FAIL
verification_level: independent
finished_at_utc: "2026-09-23T05:53:46Z"
session_id: unavailable
runner: "Codex / gpt-6-astra / medium"
skills_used: [code-review, writing-for-agents]
base_revision: 4db937daa4d5abd0a03f69917528665f94ebb001
candidate_revision: cc5c014c8f6ffe7f859422361780ee18def3a3c0
product_revision: 38ab193f98b218bb538f437ac1ca255945553ae5
result_revision: "当前审查提交:docs/acceptance/evidence/MANUAL-MATH/v1/independent.md"
review_target:
  fixed_point: 4db937daa4d5abd0a03f69917528665f94ebb001
  commit_range: "4db937daa4d5abd0a03f69917528665f94ebb001...cc5c014c8f6ffe7f859422361780ee18def3a3c0"
  standards: PASS
  spec: FAIL
  aggregate: "本报告，双轴各执行一次"
internal_reviewers:
  - "Standards /root/standards；继承 Codex / gpt-6-astra / medium；只读叶子"
  - "Spec /root/spec；继承 Codex / gpt-6-astra / medium；只读叶子"
identity_mode: "real-auth；真实注册、Cookie、页面绑定；隔离内存邮件适配器"
open_items: [MM-SPEC-01]
failure_owner: "数学前端，起点替换逻辑"
next_condition: "实现者修复 MM-SPEC-01 后，在新固定候选上定向复验纯文字稿和取消替换；无需重复完整旧 DAG"
authorization_used: "用户 MANUAL-MATH-ACCEPTANCE@1 / attempt 1 任务包"
```

## 结论与范围

候选存在 **MM-SPEC-01：纯文字演示稿被无确认覆盖**，故不能给整体手动能力 PASS。问题影响教师已写的步骤内容，不是排版门槛。其他本轮选定场景通过。

范围为 [PRODUCT_SCOPE 第3节](../../../../PRODUCT_SCOPE.md#3-数学工坊) 非 Agent 数学手动能力和既定数学行为；消费作者 [receipt.md](receipt.md)、现成测试与截图。物理设备、Word/WPS、平板、大陆网络和正式部署按用户决定暂缓；不宣称完成 M44 或完整旧 DAG。没有调用产品模型、联系其他业务 session、访问用户库或操作 50880 服务。

产品与契约保持只读，根 AGENTS.md 注入改动保留且不提交。报告提交仅新增本文件及 `independent-artifacts/` 内四张截图和结果 JSON。验收未通过，保留本轮 `.tmp-mm-independent/` 复现脚本、隔离数据和 `test-results/manual-math-independent/` 下载物供修复复验；本轮服务均已关闭。

## 独立实际结果

环境：Linux，Playwright Chromium **153.0.8010.12**，1440×900；固定候选重新生产构建；专用 TMPDIR、随机 HTTPS 端口、独立数据库和文件目录。页面操作使用现成 Playwright 真实浏览器路径；另写有界复现脚本，未修改产品或现成测试。

| 场景 | 独立实际结果与证据 |
| --- | --- |
| 动态参数改名、范围、步骤说明、对象增删 | PASS。`a` 改为 `b` 后表达式、步骤值和引用同步；保存、刷新后多行说明恢复；点改名/删除清理拖动。查看实际动态页面截图，说明和正弦曲线可读。 |
| 空白制作 | PASS。空白建立点、拖动绑定和步骤；真实鼠标移动改变参数；保存初始步；移除全部参数及步骤后仍能保存重开。查看实际最终页面，点及插值文字保留。 |
| 对象重名 | PASS。将点 P 改为已有 f 显示错误，原 ID、拖动引用及有效保存保留。 |
| 公式和备课往返 | PASS。真实输入求根公式与中文说明，下载透明 PNG/SVG；带回原环节保留备课草稿，刷新后引用存在；保库重启后重新打开公式并保存第二版。查看公式下载图及备课页面，根式/分式/说明完整，目标环节正确。 |
| 外部 HTML | PASS。导入、修改源码、保存重开、运行按钮及下载后离线按钮均通过。 |
| 服务关闭后的离线冷启动 | PASS。另开全新禁网 context，以 file 打开本轮动态和外部 HTML 下载物；动态切步、负参数及图文同步，外部计算按钮结果为12；没有 HTTP(S) 请求。查看 [动态离线](independent-artifacts/dynamic-offline.png)、[外部离线](independent-artifacts/external-offline.png)。 |
| 函数、圆/椭圆、线段、多边形、空间点棱与标注 | 复用未变作者证据，不冒充本轮重跑。核对作者制品索引全部16个 SHA256 一致；查看平面/空间实际页面及平面 PNG，图形、文字和虚线可见；作者保存重开及 PNG/SVG 检查见原回执。 |
| 纯文字步骤切换起点 | FAIL。MM-SPEC-01，见下方实际复现。 |

执行命令：

```bash
TMPDIR="$PWD/.tmp-mm-independent" npm run build
TMPDIR="$PWD/.tmp-mm-independent" M42_EVIDENCE_DIR="$PWD/.tmp-mm-independent/artifacts" \
  npx playwright test -c apps/web/e2e/manual-math.config.mjs \
  --output=test-results/manual-math-independent \
  --grep '动态参数|从空白|对象标识|HTML 导入|备课原环节'
TMPDIR="$PWD/.tmp-mm-independent" M42_EVIDENCE_DIR="$PWD/.tmp-mm-independent/artifacts" \
  node .tmp-mm-independent/probe.mjs
```

构建 PASS；选定现成 E2E **5/5 PASS，22.6秒**。定向复现记录了实际数据丢失，因此脚本正常退出不代表产品 PASS。`git diff --check` 通过。仅见既有前端 chunk >500 kB 构建提示，不构成本次使用阻断。复用科学计数法改名及已有 API 契约证据，没有重复运行整套测试。[results.json](independent-artifacts/results.json) 记录浏览器版本、复现前后值、离线请求和本轮下载物 SHA256。

## Standards

PASS，0 项发现。根 AGENTS、设计与验证规则、执行协议和技能路由已核对。新增编辑逻辑集中在 `editing.js`；未发现需报告的标准违规或基线代码异味。UI 使用真实 E2E，未新增 UI 单元测试，README 同步了手动能力。

公共 schema 的可选说明字段和集合下限放宽保留旧源有效性；缺说明回退为空，说明使用 `textContent`。未发现具有实际影响的既有内容或消费者兼容问题。作者漏做内部审查由本轮一次性补齐。

## Spec

FAIL，1 项发现 **MM-SPEC-01 / P2**；未发现越界实现或实际 schema 兼容性破坏。

规格 [UX U-MA0](../../../../ux/math.md#u-ma0-共同框架与保存) 要求“破坏性丢弃必须明确”。候选 `apps/web/src/features/math/index.jsx:1133-1143` 仅根据 `scene.elements.length` 判定是否需要确认；对象为空就直接用 `dynamicSource()` 覆盖源并清空参数编辑稿。步骤说明和参数也是制作内容，不能据“没有图形”判为没有草稿。

### MM-SPEC-01 复现及归属

1. 真实注册进入数学工坊，新建演示，打开“作品与工具”；不添加图形对象。
2. 添加步骤，标题填“判别式讨论”，说明填“先讨论判别式小于零的情况，再添加图形。”；不保存。
3. 点击“二次函数起点”。
4. 实际 **0 次确认框**，标题变为“母函数”，说明变为空，出现二次函数和点；刷新后说明仍为空。测试配置了遇到确认即取消的处理器，若实际出现确认则不会授权覆盖。

预期：已有步骤文字或参数编辑稿时，明确告知整稿替换并允许取消；取消后保留原稿。实际未保存步骤已丢失，刷新不能恢复。源码同一路径也会清空参数配置/待应用编辑，但本轮最小 UI 复现只主张步骤文字丢失。

证据：[替换前](independent-artifacts/text-step-before.png)、[替换后](independent-artifacts/text-step-after.png)、[结构化实际值](independent-artifacts/results.json)。归属：数学前端起点替换逻辑；不涉及后端保存或公共契约修订。本验收者未修产品。

双轴合计：Standards 0项，PASS；Spec 1项，最严重项 MM-SPEC-01/P2，FAIL。
