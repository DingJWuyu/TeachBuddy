# R34@1 attempt 5 材料统一候选

**本轮组合与具名回归 self PASS，交根安排一次针对性的 R35 独立复验。** 默认四行四页且无纯白页，24 个作答段落完整。显式二十行八页、第八页全白，120 个作答段落完整；本固定样本的尾页承载第六题最后三行，是自然分页所需的可用作答续页。本判断有真实下载物和实际 Office 布局支持，仍须 R35 独立核验，不扩称所有白页合理，也不放行完整 R34/R35、M43 或 MVP。

```yaml
task: R34@1
attempt: 5
role: implement/integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T14:22:45.077440+00:00"
session_id: unavailable
runner: Codex / gpt-6-astra / low
skills_used: [diagnosing-bugs, implement, writing-for-agents, code-review]
base_revision: dfb3b4adf35f2657c8f001fd6c1ad6c8cc26726f
combination_fixed_point: 88d610f07b627533201ba59ac1d176d6bd1059ae
code_candidate: 18a80073380116e1d30165f0001a86e5fdb2304c
result_revision: 包含本报告的任务分支提交，完整 SHA 由最终回执提供
review_target:
  fixed_point: 88d610f07b627533201ba59ac1d176d6bd1059ae
  commit_range: 88d610f07b627533201ba59ac1d176d6bd1059ae...18a80073380116e1d30165f0001a86e5fdb2304c
  standards: PASS
  spec: PASS
  aggregate: attempt5/review.md
internal_reviewers:
  - Standards / inherited Codex gpt-6-astra low / read-only leaf
  - Spec / inherited Codex gpt-6-astra low / read-only leaf
identity_mode: real-auth；片段及 API fixture 为 test-principal，分项说明
failure_owner: null
next_condition: 根固定完整候选后安排 R35 针对性独立复验，见 integration5.md
```

实际完成时间和环境见 [environment](attempt5/environment.json)。授权来自本轮派发：固定成果组合、lessons 输出/专属回归/必要装配、仅任务分支提交、零模型调用。

## 实际消费与影响面

- 最新完整材料输入 `880e6e68be0855b3289dea8db3c87e8c67bc1042`，含 R33 `f73b7fe0deefb4adfe570519ae93754d1bd85e3a` / 产品 `812da1091724d5536eb4a3fbcf2c47033fa64555`，以及既有 math 诊断增强。该输入只是两项自然 fetch 失败的诊断/成功样本，未当作修复。
- 输出输入 `813c97fce9fa483d1094d8c4e5ad5fc37c9b3349` / 代码 `00d1c5630f044c299dd5eeedadc81cff620aca63`。消费它的 lessons/output.js、lessons-pagination fixture 和旧证据，未覆盖最新 R33 内核。
- 独立依据只读消费 `4c4b68965e3226e5d66bf8f16ad5f390541cb2da:docs/acceptance/evidence/R35/v1/local-review.md`，原缺陷及已通过项不改写。
- [composition](attempt5/composition.json)列实际产品差异。按固定树组合，不伪称输入提交都是祖先。根 AGENTS、run-state、DAG 保持起点字节，旧文件不覆盖；新输入缺少的文档/证据补入。初次取树遇 Git 引号路径解析问题，补全后才确定 `88d610f` 为组合点，前一个中间提交不是可交付候选。
- 本轮唯一实质新增修复为 `ExportsPanel.jsx` / `materials.css` 的输出设置排版。浏览器截图显示全局 input/select 宽度把标签挤成 2 至 4 行；局部覆盖宽度并复用 wb-input 后，1440/1280/1024 均单行、无横向溢出。[红灯](attempt5/options-red/layout.json)、[绿灯](attempt5/options-final/layout.json)及同目录截图可对照。未改 questions/resources/math/auth 内核、输出生成语义或冻结契约。

## 二十行的可核验判断

真实路径：复制停写 R35 保留库到 `/tmp/teacher-r34-attempt5`，独立端口 49754、新浏览器 context 真实登录，打开“R35 丢响应后保留 → 输出 → 练习 → PDF”，将作答空白行从默认 4 改为 20，答案/注记关闭、全部环节、备用不选，保存并生成，再下载新历史条目。保存版本为 8；快速 fixture 是固定 R35 保存版本 7，两者只有课题标题不同，题目及空间相同。

[初次 UI 下载](attempt5/ui20-baseline/result.json)为 8 页/白页 8；[红灯断言](attempt5/ui20-baseline.log)确实因白页失败。随后以实际内容而非这个笼统断言决定问题性质，未把断言失败掩盖为修复成功。最终样式候选同库重启后，[四行](attempt5/ui-final-restarted-4/result.json)与[二十行](attempt5/ui-final-restarted-20/result.json)再次下载，分别为 4 页无白页、8 页白页 8。

| 依据 | 实测结果 |
| --- | --- |
| 原版对照 | `render20-original` 用 880e6e6 的 output.js；`render20-combined` 用组合 output.js，相同固定六题/三图。两者均 8 页，第 8 页全白；移除 keepNext 后正文 XML 完全相同，无显式分页符。 |
| 实际段落 | [space-comparison](attempt5/space-comparison.json)：六题各 20 行，共 120 行，17 个正文 OMML 与三张真实图完整。原版与真实 UI DOCX 除课题标题外所有段落、页码、纵向坐标一致。 |
| 尾页承载 | [真实 Word 布局](attempt5/office20-ui-final/layout.json)：第六题第 1 至 17 行在第 7 页，第 18 至 20 行在第 8 页。没有空的第 9 页。 |
| 几何空间 | A4 高 297 mm，上下各 20 mm，可用高 257 mm。第 7 页配图段至首作答段约 63.96 mm；每行节距约 11.04 mm，20 行约 220.8 mm，合计约 284.8 mm，超出一页。第 7 页已排入 17 行，余下三行不能在保持图、字号、段距和所选空间时塞回该页。 |
| 可编辑/可用 | 在真实 UI 下载 DOCX 的检查副本中，使用实际 Writer 把每个已有空段落替换为短行号文字，没有增删段落。120 行标记前后的逐段页码与纵坐标完全一致，保存、关闭、重开文字和页码仍一致。[space-proof](attempt5/space-proof/space-proof.json)、[第7页](attempt5/space-proof/page-7.png)、[第8页](attempt5/space-proof/page-8.png)。 |
| 未改动的成品 | 产品下载物仍为空白作答空间；标记版仅是诊断副本，不是产品输出或新规格。[原版实际打印预览](attempt5/office20-original-final/print-preview.png)、[UI 下载物实际打印预览](attempt5/office20-ui-final/print-preview.png)保留自然续页。 |

据冻结契约“answerSpaceLines 控制每题后的空白行”和“段落可自然分页”，本样本的白色末页有必要且可写的用户所选空间，self 判定为合理布局，未实施二十行分页补丁。区别于默认四行：四行空间可与题末一起容纳，旧版只是将其中一行孤立推到尾页；本轮 `render4-original` 再现该红灯，而组合版保留 24 行且末页有第六题配图。没有删行、缩行距、缩图、隐藏 20 选项、裁掉白页或自行改规格。

此判断不是页数最优性的数学证明，不承诺任意文稿/字体/Office 都有同样布局；Windows/WPS 需实际复验。若 R35 认为需要额外续题标识或不同长空间编排，应按冻结判据指出具体可用性缺口，不以“旧版也这样”作为豁免。

## 本轮组合回归

| 范围 | self 结果与证据 |
| --- | --- |
| 六种真实导出 | 新浏览器真实登录，三类各 PDF/DOCX 实际受理、下载、预览；DOCX 用真实隔离 Office 转 PDF。教案 2 页、讲义/练习 4 页，无全白页。[ui-results](attempt5/ui-results.json)及对应目录逐页图。[下载物内容检查](attempt5/download-content-checks.json)：默认讲义/练习 DOCX 保留 24 作答段落；教案忽略该选项。 |
| 最新 R33 组合 | [e2e.log](attempt5/e2e.log) 8/8：真实原生 Word 校对、保存刷新、引用输出；题库使用位置/返回现场、主动加入反馈、丢响应原键恢复、实际环节定位。 |
| 片段定位/校对 | 同轮 fragments 浏览器场景实际上传两图、点击独立答案定位、人工改标题、保存刷新、三个视口。输入是明确合成片段及旧图载体，身份 test-principal，不冒充新在线识别。 |
| 持久与身份 | 同轮真实注册/fake-mail 链完成混合取材、预览替换、六输出、新浏览器读持久数据；未知上传经普通进程重启、原键重试成功。49757 两个真实 PID 及保存目录见 [process-restart](attempt5/e2e/process-restart.json)。保存丢响应、草稿保留、退出后拒绝旧页面通过。 |
| 全 API | [api-full.log](attempt5/api-full.log) 原 npm 全量入口、默认并行一次运行，211/211。独立 network namespace，无重试补丁；显式加载 880e6e6 的纯观察探针。两个目标共 57/8 请求，无 request:error；有服务关闭时的 client socket UND_ERR_SOCKET 事件，完整保留，不把它们冒充 fetch 失败。[api-observations](attempt5/api-observations.json)。 |
| 构建 | [build-final.log](attempt5/build-final.log) 在最终代码上通过；已有 >500 kB chunk 提示仍在，不是失败。 |
| 实际 Office | 本机 Linux Writer 打开真实下载物，三类默认实际 PrintPreview 见 `office-default-*/print-preview.png`；二十行检查副本逐行写入、保存重开。初次黑屏/首次启动向导截图不计有效预览，最终 `office20-*-final` 有可见两页预览。不是 Windows Word/WPS 或实体打印通过。 |
| 内部审查 | [review](attempt5/review.md)：两轴 PASS，只审新增的输出 UI 修复。 |

原 API 两项自然 fetch 失败仍 **OPEN**。本轮未自然复现失败，不能从绿灯或闲置 socket 关闭推导历史因果；没有改连接池、等待/重试策略或业务算法，也没有反复盲跑。

## 证据与边界

- 源 worktree 只读；原数据库和旧证据不改。全 API 按原测试会重写 10 份旧证据，本轮结果先另存 `inherited-test-artifacts/` 再恢复固定旧字节，校验见 [old-evidence-preserved](attempt5/old-evidence-preserved.json)。
- real-auth 表示真实注册或登录、Cookie/page-bound 和真实 API；保留库账号来自原 fake-mail 注册、自签 HTTPS，不代表真实邮件或公网身份部署通过。截图中的 1024 等为浏览器视口，不是物理设备。
- 产品模型调用 0，产品模型密钥读取 0，无网络 Provider 成功替身。在线与 Windows/WPS 仍未通过，完整场景与 M43/MVP 不在本轮放行范围。
- 采集错误单列：教案不显示作答行控件，第一份复用脚本误等该控件，修正采集器后 `*-final` 成功；末轮首次浏览器导航时 49754 已无监听、原托管服务退出 0，保留连接拒绝日志后在同库明确重新启动并成功下载。该现场不是原 API 两项自然 fetch 失败，也未伪装成产品修复。Office 初次向导、连接未就绪及黑屏材料不作为可视 PASS。
- `run-sources/`保存本次实际运行脚本副本和 Office 探针；相对 import 按原 fixture 路径解释，复跑说明见 integration5。未提交账户 Cookie、数据库或本地口令。
- 完整 R35 未通过，运行库、检查副本、转换目录和调试现场保留；无用临时源码从产品目录移出，正式证据 hash 见 `attempt5/manifest.json`。收尾停止本轮服务/Office/Xvfb，任务分支提交后停写。未合 main、push、部署、扩派业务 session 或互聊，外层唯一回调。
