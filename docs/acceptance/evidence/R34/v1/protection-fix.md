# R34@1 attempt 6：未知内容保护与备课冲突布局

**self PASS，等待外层另派独立验收。** 本次是 R35-LOCAL-006/007 各自第一次修复，不重置旧尝试，不改变001-005关闭结果。产品模型请求0、产品密钥读取0；未合main、未push、未部署。

## 固定输入与最终产品

| 输入/结果 | 完整版本 |
| --- | --- |
| main 控制基线 | `da5df67f056eb34b4d97b473f5447e032e9fcceb` |
| 产品 fixed point | `267cf5119e05e6caba8f2db58ece3487dc6c3e9d`，只读来源 `/home/liam_t/项目/TeacherWorkspace-teaching-math-integration` |
| 独立缺陷报告 | `7e2796e0613b6b71e3965039d9f9a84100c8d84f:docs/acceptance/evidence/R35/v1/local-review5.md` 及 local5；只读来源 `/home/liam_t/项目/TeacherWorkspace-r35-local-remainder` |
| 最终产品 SHA | **`c2cdd9d12428dadb6ac405ff5b8081d15b51f0d6`** |
| 交付分支 | `fix/r34-materials-protection` |
| 正式回执提交 | 本文件及 protection-fix/ 所在证据提交，完整 SHA 由最终回调给出；该提交无额外产品改动 |

从指定main起点的独立分支消费固定产品，再实施修复。[scope-checks](protection-fix/scope-checks.json)记录消费提交、完整SHA与文件差异：消费时 apps/packages/scripts 与固定产品一致；AGENTS、README、CONTEXT、执行协议、DAG、run-state 保持main字节。来源worktree、来源库没有写入；冻结契约未修改。

判据为独立报告006/007、固定产品 `materials.md` 内容/共用规则/兼容节、`materials.feature` M012/M019/M028及设计验证规则。没有新增未来版本能力，也没有新增产品最小像素门槛。

## 改动与影响

- 题目v2与备课v2/v3在变更前检查**已存**Document版本，包括题干、答案、复制来源快照、备课开头、环节和题目引用快照。未知版本返回既有 `422 invalid-input / unsupported-content-version`；先前成功幂等重放和过时版本409次序保持。保护也覆盖会改写题目的复制、原稿定位及分类删除关联，事务失败不部分更新分类。
- 前后端共享Document枚举和已有版本支持判断；页面将未知内容相关保存、删除/恢复及编辑操作置为只读，保留内容查看。正常文档不受阻。
- 备课标题与操作组按空间换行，保存状态独立占行；共享SaveStatus将带服务器版本的同句冲突原因合为一条，保留其他独立错误原因、草稿提示与冲突对照。未改保存状态机、重试、选择和冲突裁决。
- 新增真实HTTP/SQLite回归测试。既有题库测试的两个硬编码 `/tmp` 路径改用 `os.tmpdir()`，使定向回归消费本次TMPDIR。无UI单元测试、无认证本体改动。

具体文件见[影响清单](protection-fix/scope-checks.json)。原材料解析/文件预览/模型/六输出主体、教学关联和数学作品语义未改；独立报告对这些未变路径的具名复用范围继续有效，不重跑全材料阶段。

## 红绿证据

环境为独立新库 `/home/liam_t/r34p6/data`，短磁盘 `TMPDIR=/home/liam_t/r34p6/tmp`，HTTPS50635、Chrome50636及独立profile `/home/liam_t/r34p6/chrome`。Node22.23.2、Chrome152，本地真实注册/会话与fake-mail；无来源库复制。普通交互经本次Chrome的Playwright完成，axi用于独立连接与页面快照。未强制点击、注入CSS或写scrollTop冒充操作；SQLite仅种入本次新建对象的未知版本。

| 场景 | 结果与证据 |
| --- | --- |
| 006 原候选真实复现 | 题目UI显示v99只读提示但普通删除成功；备课显示同提示、可进入删除确认，真实HTTP删除成功。两类对象恢复后合法v2 PUT均200、原节点丢失。[red-future.json](protection-fix/red-future.json)、[题目](protection-fix/red-future-question.png)、[备课](protection-fix/red-future-lesson.png)、[红灯断言](protection-fix/red-future.log)。该备课红灯不冒称点击完成了确认框，删除判定来自真实HTTP。 |
| 006 最终产品UI/HTTP | 两类对象读取仍返回完整v99；删除按钮禁用；直接删除和旧正文覆盖均422；数据库整行包括version、updatedAt、deletedAt和原未知节点逐字相同。[final-future.json](protection-fix/final-future.json)、[题目只读](protection-fix/final-future-question.png)、[备课只读](protection-fix/final-future-lesson.png)。 |
| 006 保护面与兼容 | 题干/答案/复制快照、两版备课开头/环节/引用快照均拒绝移除或覆盖；正常写/删除/恢复通过，旧成功键重放不检查当前内容，过时版本409、外账户404保持；分类移除遇未知题整体回滚。[红灯](protection-fix/red-api.log)、[绿灯](protection-fix/green-api.log)，测试 `apps/api/test/materials-protection.test.js`。 |
| 006 同库重启 | 新进程迁移0新增、11跳过，原绿色对象DB整行及HTTP未知Document一致。[restart-results](protection-fix/restart-results.json)。 |
| 007 同冲突态 | 1280×800、展开侧栏及300px AI栏、真实并发PUT后普通保存得到409。修复前课题34.9375px，仅见首字；最终416.953125px，课题及操作可辨，冲突原因、草稿与对照操作保留。[红图](protection-fix/red-conflict-1280.png)、[红测量](protection-fix/red-layout.json)、[红断言](protection-fix/red-layout.log)、[最终图](protection-fix/final-conflict-1280.png)、[最终测量](protection-fix/final-layout.json)。断言使用当前样例课题的实际文字宽度，不创建产品阈值。 |
| M019 原取材路径 | 六环节长备课，在第六环节资源取材期间用另一正常请求更新。确认409后取消冲突再取消取材，选择保持、标题文稿保持、滚动2029→2029、AI输入逐字保持，服务端无部分引用插入。[picker-results](protection-fix/picker-results.json)、[冲突](protection-fix/picker-conflict.png)、[取消后](protection-fix/picker-cancel-restored.png)。使用本次上传PNG资源承载取材，不作为PDF格式复验。 |
| 007 刷新接续与视口 | 原取材对象刷新后普通“重试确认”重新得到已知409，1440/1280/1024课题宽度分别576.95/416.95/460.95px，操作可见。[测量](protection-fix/conflict-active.json)、[1280图](protection-fix/conflict-active-1280.png)。768px原AI是覆盖式辅助栏，final-conflict-768不是正文通过证据；普通关闭辅助栏后同冲突态可读且无全页横溢出：[图](protection-fix/tablet-conflict-main.png)、[结果](protection-fix/tablet-results.json)。 |
| 正常可写UI | 题目改标题/笔记并保存、删除恢复、复制后笔记为空；备课改标题/文稿保存、刷新读回、删除确认及恢复通过。[normal-results](protection-fix/normal-results.json)、[正常题目](protection-fix/normal-question.png)、[正常备课](protection-fix/normal-lesson.png)。 |

原始业务交换在[http.ndjson](protection-fix/http.ndjson)、[network.ndjson](protection-fix/network.ndjson)，不含认证头或验证码。源版本、原节点和拒绝后DB比较在具名JSON中。

## 检查与内部审查

- 独立 `npm ci`、最终 `npm run build:shared`、`npm run build:web` 通过；保留Vite既有大chunk提示。[构建](protection-fix/build.log)、[共享检查](protection-fix/shared-check.log)。仓库无独立typecheck/lint脚本；执行JS语法检查和diff空白检查，不称执行了不存在的命令。产品及手写报告/脚本无空白错误；暂存检查仅报原始Vite构建日志与Node红灯断言日志共14处行尾空白，原日志原样保留。
- 首流题目/备课、材料备课、新保护测试、数学组合共29项定向测试，首跑24通过、5项输出失败。配置报告给定只读LibreOffice26.8路径后，涉及失败文件的10项全部通过；另题库分类/复制/重启与确认映射/定位2项通过。[首跑](protection-fix/regression-api.log)、[配置后](protection-fix/regression-office.log)、[题库](protection-fix/regression-questions.log)。最终保护测试单独再次通过。合计覆盖31个不同测试，未运行整套材料阶段。
- 首次输出失败是测试进程未配置已有 `MATERIALS_OFFICE_ROOT`，无产品代码修复掩盖。数学测试自带旧证据输出路径，写入本工作区后已收归本次[输出目录](protection-fix/regression-math-output/)，旧M43文件按Git原字节恢复且不进入差异；来源worktree始终未写。
- 采集脚本首跑的定位/授权错误单列 `collection-*.log`：备课删除菜单角色、保存按钮名、题目按钮包含摘要、上传遗漏页面绑定。修正采集后完成正式场景；没有把这些采集错误算成产品绿灯。最初布局断言曾在resize后立即读到旧布局，正式红断言改用截图对应的已记录1280几何，稳定退出1；红图始终显示同一个34.94px缺陷。
- `code-review` 两个只读内部叶子继承本session模型和effort，固定产品SHA至最终产品SHA三点diff非空、实现均已入HEAD。Standards PASS，0项；Spec PASS，0项。[分轴原结论与聚合](protection-fix/internal-review.md)。这不是independent阶段验收。

证据索引及SHA256见[manifest](protection-fix/manifest.json)。最终环境状态见[runtime](protection-fix/runtime.json)。服务、专用Chrome与axi桥已停止，独占端口无监听。保留独立库/profile、红灯与失败现场供后继复验，未提交本地认证状态；未用的复制脚本已清理。

## 独立复验入口与未决

下一位从最终产品SHA建立自己的副本和独立库，独立安装/构建；通过 `scripts/setup.mjs` 建本地账户，或只读复制本次停写库/profile到自己的目录。把 `protection-fix/scripts/common.mjs` 及相关脚本中的候选路径、`/home/liam_t/r34p6`、50635/50636换为自己的隔离值。服务器入口仍是 `apps/web/e2e/fixtures/materials-integration/server.mjs`，配置本次报告上面的R34_DATA_DIR/R34_PORT/TMPDIR；涉及输出时配置独立报告给定的MATERIALS_OFFICE_ROOT。

006先运行 `scripts/future.mjs <证据前缀>`，随后定向HTTP测试；检查拒绝状态及DB原始字节，不能只看提示。007运行 `scripts/prepare-picker.mjs`、`scripts/picker.mjs`、`scripts/conflict-layout.mjs`；复制保留库/profile则直接从 `picker-id.json` 进入并点“重试确认”。`scripts/layout.mjs`提供更小的同409状态红绿循环，`scripts/normal.mjs`验证正常写路径，`scripts/restart.mjs`检查之前green对象重启后保持。

006/007目前仅实现自检通过，关闭由外层独立验收裁决。旧R34尝试及001-005关闭结果保留；R35-LOCAL-OBS-001/002继续OPEN，入口仍为 `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md`。在线、新材料质量、真实设备、同内容目标Office PDF、真实邮件及历史传输观察保持原报告状态。不扩C21窗口、不代签WB-MTA或全材料PASS。完成后停写，由外层唯一回调。

```yaml
task: R34@1
attempt: 6
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T18:33:04Z"
session_id: "01a0ca52-ca2d-78b1-9d5b-e2343804c867"
runner: "Codex / gpt-6-astra / low"
skills_used: [implement, diagnosing-bugs, code-review, writing-for-agents]
base_revision: "da5df67f056eb34b4d97b473f5447e032e9fcceb"
product_input_revision: "267cf5119e05e6caba8f2db58ece3487dc6c3e9d"
final_product_revision: "c2cdd9d12428dadb6ac405ff5b8081d15b51f0d6"
result_revision: "本文件与protection-fix所在证据提交；完整SHA由最终回调给出"
review_target:
  fixed_point: "267cf5119e05e6caba8f2db58ece3487dc6c3e9d"
  commit_range: "267cf5119e05e6caba8f2db58ece3487dc6c3e9d...c2cdd9d12428dadb6ac405ff5b8081d15b51f0d6"
  standards: PASS
  spec: PASS
  aggregate: "protection-fix/internal-review.md"
internal_reviewers: ["/root/standards: Codex/gpt-6-astra/low，只读叶子", "/root/spec: Codex/gpt-6-astra/low，只读叶子"]
inputs: ["本报告固定输入表及冻结契约"]
changed_files: ["protection-fix/scope-checks.json中的完整产品清单", "本报告", "protection-fix/"]
artifacts: ["protection-fix/manifest.json", "protection-fix/runtime.json"]
checks: ["006真实UI/HTTP红绿及DB完整比较", "007同409状态视口红绿", "取材取消现场", "正常题目/备课UI", "同库重启", "31个不同定向API测试", "生产构建", "共享目录检查", "JS语法及diff检查", "内部双轴审查"]
identity_mode: "real-auth/local fake-mail UI；API回归test-principal；独立库受控未来Document种子"
product_model_requests: 0
product_model_key_reads: 0
open_items: ["006/007待独立复验", "历史OBS-001/002", "原在线/真实材料/目标设备/邮件外部输入"]
failure_owner: null
next_condition: "外层固定最终候选另派独立验收，按上述006/007入口定向复验"
authorization_used: "本轮用户R34@1 attempt6限定修复、独立分支消费、候选提交及内部skill审查授权；不合main/push/部署"
```
