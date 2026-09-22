# M43@1 attempt 2：数学工具区滚动

本回执只覆盖 M44-LOCAL-001 的实现自验，不替代 M44 独立验收或完整阶段放行。**self PASS**，产品候选 `1c519f737d12da716d7c44cab804681c8004b838`；三尺寸与直接回归 5/5、构建通过。完整回执见末尾。

## 固定输入与写入边界

- 起始主干：`82b7b196ac2d5408eadb75433905fb8c042927f6`；开发分支 `fix/m43-tools-scroll`。
- 消费完整输入：`5da13ab3963a60948a69ae03ab5cf5f0988df13f`，产品 `2bdb865d6923e6aedb744d2f631ee5b5ef106541`。
- 实现前组合：`1e51d7947b9d83ca14bf5137d5b3d8e7b78c0330`。产品源码与固定输入一致；合入输入时仅根台账/DAG 有冲突，逐文件保留起始主干内容，没有改写编排状态。
- 缺陷规格：`e30ec1a3891dd364e120a7375adc075c4afcbfbb:docs/acceptance/evidence/M44/v1/local-review.md` 的 M44-LOCAL-001，来源 `/home/liam_t/项目/TeacherWorkspace-m44-local` 只读。
- 本次目标：正式数学工坊的工具区独立滚动；1440×900、1024×768、768×1024 通过普通滚轮、点击、键盘完成动态步骤、函数坐标窗、平面顶点、立体棱修改及保存重开；保留画布、其他区域和 AI 共用右栏行为。
- 产品仅修改 `apps/web/src/features/math/math.css`。数学算法、模型、服务端、契约、classes/questions、导航 JS、共享测试配置均不变。无需公共接线或根安排共享 JS 写者。

## 实现与红绿证据

数学工具挂载在高度已受约束的 `.wb-aux-body` 内，但 `.math-tools-panel` 原先只有 `min-width: 0`，没有建立滚动容器。修正为可收缩的 flex 子项，自身纵向滚动并阻止边界滚动传递。10px 内边距沿用共享 `.wb-tool` 的现有数值。局部恢复动态字段 label 的 flex 布局，避免已有 grid 覆盖使 `width: 0` 输入框被压窄；复选框保留自身宽度，让文字紧邻控件。

最小红色路径：真实注册 → 数学工坊 → 作品与工具 → 新建演示 → 保存 → 右栏滚轮 2600px → 普通点击步骤。实际步骤顶部 1647.7px，工具面板滚动前后均为 0，点击失败 `element is outside of the viewport`。见 [red/result.json](scroll-fix/red/result.json)、[红色截图](scroll-fix/red/unreachable-steps.png)、[red.log](scroll-fix/red.log)。

相同路径在局部修复后通过，见 [绿色最小测量](scroll-fix/final/minimal/result.json)。三尺寸正式测试使用 `wheelTo`：只读测量目标和面板，每次派发真实鼠标滚轮；控件完整进入视口后才点击。没有 DOM click、强制点击、写 scrollTop、CSS 注入或放大视口。键盘按实际 Tab 顺序进入步骤字段，其他修改通过点击后全选及输入完成。

## 实际验证

| 范围 | 证据与判据 |
| --- | --- |
| 原始缺陷 | 独立新库、正式 App、配套 Chromium；红色普通点击失败，绿色同路径成功。 |
| 三种尺寸的动态编辑 | 步骤标题、步骤排序、拖动 y 绑定修改；版本 1 → 2；刷新读回步骤标题；Tab/Enter 可达，标题输入宽度大于 100px。 |
| 三种尺寸的函数编辑 | `x^2-2*x-2`，坐标窗 xMin=-8、xMax=8、yMin=-4；版本 1 → 2；刷新读回。 |
| 三种尺寸的平面编辑 | 添加第四顶点并设为 (-2,1)；版本 1 → 2；刷新读回。 |
| 三种尺寸的立体编辑 | 正方体增加第 13 条棱 A→C1，设为 dashed；版本 1 → 2；刷新读回，关闭工具栏后画布预览可见。 |
| 独立滚动 | 滚动工具前后，画布、主区、侧栏、辅助正文的滚动值和位置不变；触底继续滚轮不带动其他区域或整页。 |
| AI 共用右栏 | 只有一个辅助栏；切换 AI/工具后未发送草稿保留，数学源保持；没有发送模型请求。 |
| 直接回归 | 备课未保存环节 → 数学工具中新建公式 → 保存 → 带回 → 刷新仍有公式引用。 |
| 构建 | `npm run build` 检查共享目录、隔离库迁移和 Web 构建；保留既有大 chunk 提示。无独立 typecheck/lint 命令。原始构建日志第 104 行保留 Vite 的尾随空格，因此全证据 diff 的空白检查有此一项；产品、测试和报告空白检查通过，不改写生成日志。 |

各视口的 source、版本、区域测量、浏览器版本及新库原始路径位于 [1440×900](scroll-fix/final/1440x900/result.json)、[1024×768](scroll-fix/final/1024x768/result.json)、[768×1024](scroll-fix/final/768x1024/result.json)。对应目录包含步骤、坐标窗、顶点、棱、AI、画布截图。保留库已移至独立运行目录的 `libraries/`，原始路径与当前路径映射见制品索引；trace 保留在该运行目录，不提交含本机测试认证的 trace。正式运行日志、trace 校验值及停服状态由 [制品索引](scroll-fix/artifacts.json) 定位。

## 独立复验与手工入口

从最终完整候选建立自己的非隐藏目录 checkout，安装锁定依赖与配套浏览器。使用独立磁盘 TMPDIR，不复用来源验收者的库或浏览器。无需产品模型或密钥。

```bash
npm ci
mkdir -p /path/to/own-disk/tmp
export TMPDIR=/path/to/own-disk/tmp
npm run build
M43_SCROLL_EVIDENCE=/path/to/own-evidence \
M43_SCROLL_RESULTS=/path/to/own-traces \
  npx playwright test -c apps/web/e2e/fixtures/math-scroll/playwright.config.mjs
```

测试默认使用当前 Playwright 配套 Chromium，串行、零重试，独立 HTTPS 随机端口、真实注册、fake-mail 和自签证书。测试 context 在 fixture 服务关闭前先关闭。最小回归入口为 `math-scroll-repro.spec.js`；三尺寸编辑与直接回归为 `math-scroll.spec.js`。

手工运行仍使用固定产品已有入口：

```bash
M43_DATA_DIR=/path/to/own-library \
  node apps/web/e2e/fixtures/math-integration/manual.mjs
```

地址由进程打印；账户 `m43@example.test`，密码 `math-password`。从数学工坊打开作品与工具后，用普通滚轮到达控件。窄屏辅助栏沿既有设计覆盖主区，关闭后继续画布与保存；未改成桌面布局。Office 不是本次测试的前置条件。

## 保留边界与归属

- 本次不代签 M44 完整制作矩阵、全部动态数学一致性、下载/离线、全部备课往返、P/M 迁移、Office/Windows/Edge/WPS、Pad 触屏、投影课堂、完整 R35/M43/M44/T51/T54。旧报告逐项已通过、受阻、未验的原边界保持。
- R35-LOCAL-OBS-001/002 历史 fetch 观察仍归 R34；旧 SIGTRAP/response-guid 与 M44-LOCAL-OBS-001 仍由验收环境拥有者接续。本次仅用配套浏览器，不扩写为旧环境根因或修复结论。
- classes/questions 的教学关联与导航 JS 由 MATERIALS-TEACHING-FIX 拥有，最终合流由根固定。没有与该业务 session 互聊或混用其版本。
- 未合 main、push、部署、改根台账/DAG。零产品模型请求，零产品密钥读取。

## Code review

固定点 `1e51d7947b9d83ca14bf5137d5b3d8e7b78c0330`，受审提交 `d2e2e02a39835cd031954a58bb94f4d8794b19bb`，命令 `git diff 1e51d7947b9d83ca14bf5137d5b3d8e7b78c0330...d2e2e02a39835cd031954a58bb94f4d8794b19bb`。当时受审实现全部在 HEAD，diff 非空。两个只读叶子助手并行，继承 Codex / gpt-6-astra / low，没有再委派。

### Standards

PASS。明确规范违例 0，启发式 smell 0。滚动约束局限于数学工具容器，符合区域各自滚动规则；真实注册、导航、普通滚轮、点击和键盘符合用户路径验证，未以 UI 单元测试代替。专属 fixture 与配置复用既有环境，未改其他业务实现或契约。范围仅为指定候选 diff，不能代替最终回执完整性或独立验收。

### Spec

PASS，0 项发现。局部 CSS 实现可收缩滚动容器及边界限制；三尺寸覆盖原来受阻控件、版本递增、保存和刷新重开；其他区域不动、触底不串滚、AI 草稿保留、画布及备课带回均有验证。未发现缺失、越界或实现错误，无需新增公共接线。不代签 M44 独立全阶段。

聚合：Standards 0 项、Spec 0 项，各轴无最高严重项。审查后视觉核对仅补充同一区域复选框 `width: auto` 及可见宽度断言，未引入新范围或风险；实现者定向自检，不把此增量声称为两位助手已审。


## 结构化回执

```yaml
task: M43@1
attempt: 2
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T16:55:51Z"
session_id: "01a0c9fd-4017-70e3-84cc-5fddcd3c5e78"
runner: "Codex / gpt-6-astra / low"
skills_used: [diagnosing-bugs, implement, resolving-merge-conflicts, writing-for-agents, code-review]
base_revision: "1e51d7947b9d83ca14bf5137d5b3d8e7b78c0330"
product_revision: "1c519f737d12da716d7c44cab804681c8004b838"
result_revision: "产品如上；完整证据提交由最终交回消息固定:docs/acceptance/evidence/M43/v1/scroll-fix.md"
review_target:
  fixed_point: "1e51d7947b9d83ca14bf5137d5b3d8e7b78c0330"
  commit_range: "1e51d7947b9d83ca14bf5137d5b3d8e7b78c0330...d2e2e02a39835cd031954a58bb94f4d8794b19bb"
  standards: PASS
  spec: PASS
  aggregate: "本文件 Code review；后续复选框宽度增量由实现者定向验证，未冒称双轴已审"
internal_reviewers:
  - "Standards / Codex gpt-6-astra low / 只读叶子 / 0项"
  - "Spec / Codex gpt-6-astra low / 只读叶子 / 0项"
inputs:
  - "5da13ab3963a60948a69ae03ab5cf5f0988df13f；产品2bdb865d6923e6aedb744d2f631ee5b5ef106541"
  - "e30ec1a3891dd364e120a7375adc075c4afcbfbb:docs/acceptance/evidence/M44/v1/local-review.md"
changed_files:
  - apps/web/src/features/math/math.css
  - apps/web/e2e/math-scroll.spec.js
  - apps/web/e2e/math-scroll-repro.spec.js
  - apps/web/e2e/fixtures/math-scroll/helpers.mjs
  - apps/web/e2e/fixtures/math-scroll/interactions.mjs
  - apps/web/e2e/fixtures/math-scroll/playwright.config.mjs
  - docs/acceptance/evidence/M43/v1/scroll-fix.md
  - docs/acceptance/evidence/M43/v1/scroll-fix/
artifacts:
  - "scroll-fix/artifacts.json：逐文件SHA、6份trace、5份必要库、停服状态"
checks:
  - "M44-LOCAL-001 red：真实注册/新建演示/滚轮/普通点击，1 failed"
  - "同一普通操作最小回归：PASS"
  - "1440x900 / 1024x768 / 768x1024：四类修改、版本1→2、刷新重开、滚动隔离、键盘、AI草稿，3/3 PASS"
  - "公式工具与备课未保存环节带回及刷新：1/1 PASS"
  - "最终 E2E 合计5/5，Playwright1.63.0配套Chromium153.0.8010.12，零重试"
  - "npm run build：PASS；保留既有大chunk提示"
  - "产品写入范围与根台账/DAG字节核对：PASS"
identity_mode: "real-auth / fake-mail / 自签HTTPS / 本机视口模拟"
product_model_requests: 0
product_key_reads: 0
public_wiring_required: false
open_items:
  - "M44独立复验本候选，不能由本self关闭全阶段"
  - "其他未验项及历史观察按本文件保留边界归属"
  - "根固定与MATERIALS-TEACHING-FIX合流，双方产品路径没有重叠写入"
failure_owner: null
next_condition: "在独立checkout和磁盘TMPDIR按本文件命令复验；根负责最终合流"
authorization_used: "本轮用户M43@1 attempt2滚动修复、专属测试/证据与候选提交授权；不合main/push/部署"
```
