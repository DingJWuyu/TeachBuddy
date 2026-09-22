# R35-LOCAL@1 attempt 4 独立定向验收

**限定结论：independent PASS。R35-LOCAL-002、003、004、005 全部 CLOSED。** 结论只覆盖四项原缺陷及下述直接影响回归；完整 R35、在线识别和目标设备仍未通过。既有八项材料消费 PASS、R35-LOCAL-001 CLOSED 和两项历史 fetch OPEN 保持原边界。

```yaml
task: R35-LOCAL@1
attempt: 4
role: acceptance
status: PASS
status_scope: R35-LOCAL-002至005及直接影响；非完整R35
verification_level: independent
finished_at_utc: "2026-09-22T16:14:48Z"
session_id: "01a0c9d1-eb2c-7771-b35a-249a1c209d3f"
runner: Codex / gpt-6-astra / medium
skills_used: [writing-for-agents]
base_revision: 592c04d55b1113232b913f37001007de4a476a1b
candidate_revision: 42b0cde25f1f8602d25155b27620ac7da4289bd7
product_revision: 331bd367df450522fb54982984c452c6bb8d4c52
composition_revision: afdb8f96098e77cfac076179ea0fd2be05bb7c9c
result_revision: 本文件与local4/所在的review/r35-local-fixes提交
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: [下表固定Git对象及冻结materials行为和契约]
changed_files: [docs/acceptance/evidence/R35/v1/local-review4.md, docs/acceptance/evidence/R35/v1/local4/]
artifacts: [local4/manifest.json, local4/readonly-checks.json, local4/runtime.json]
checks: [WB-M009定向状态与保留内容, WB-M010分类入口和删除, WB-M024实际PNG, WB-M028四视口, 候选生产构建]
identity_mode: 分类及素材下载为real-auth/fake-mail；受控提取HTTP及其页面为test-principal
product_model_requests: 0
product_model_key_reads: 0
local_adapter_calls: 11
public_wiring_required: false
failure_owner: null
open_items: [R35-LOCAL-OBS-001, R35-LOCAL-OBS-002, 完整R35既有未决项, 在线质量, 目标环境]
next_condition: 外层以本报告提交和固定候选作为限定集成输入；公共接线需求无
authorization_used: 本轮用户指定独立验收、隔离运行、仅报告和local4证据提交；外层唯一回调
```

## 固定输入与隔离

| 输入 | 固定对象及消费边界 |
| --- | --- |
| 候选 | `42b0cde25f1f8602d25155b27620ac7da4289bd7`；其 `docs/acceptance/evidence/R33/v1/attempt5.md`、`integration5.md` 仅作运行入口和 self 说明。未运行作者 local5 测试来代签 independent。 |
| 原独立红灯 | `45c229de2040e82ee7cbbb10452015d6890b2d91:docs/acceptance/evidence/R35/v1/local-review3.md`，002至005及对应 `local3/`。引用原红灯，不重跑旧候选。 |
| 既有八项消费 | `55654c2d59f0130aeb31e24d5f52c04b4323f0a4:docs/acceptance/evidence/R35/v1/local-review2.md`，沿用其具名集合及复用限制。 |
| 判据 | 本报告基线的 AGENTS、`execution-protocol#acceptance/#receipt`、`mvp-matrix#r35/#evidence`；候选内 `materials.feature` 的 M009/M010/M024/M028、`contracts/workbench/materials.md` 的自动收题/分类/引用输出/短任务、UX U-M2/U-M3/U-M6/U-M8及设计验证规则。 |

独立 detached checkout 为 `/home/liam_t/项目/r35-local4-isolated/candidate`，Node 22.23.2、Chrome 152.0.7977.64、Linux。`TMPDIR` 指向自己工作盘的 `r35-local4-isolated/tmp`，未清理他人 `/tmp`。全新真实认证库与页面为 HTTPS 50435；HTTP受控库由自己的脚本以动态端口创建，重启后在50437打开同一库的题库fixture。Chrome使用50436及独立profile；路径和停服记录见 [runtime](local4/runtime.json)。

[安装](local4/install.log)、[生产构建](local4/build.log)、[题库fixture构建](local4/fixture-build.log)成功，保留原有大chunk提示。受测产品和来源树未写；候选 tracked status为空，产品与指定产品SHA一致，冻结契约/行为未变，见 [只读及影响检查](local4/readonly-checks.json)。未消费活动M43分支，未运行会重写旧证据目录的全API或原回归套件。

## 四项裁决

### R35-LOCAL-002：CLOSED

真实注册、fake-mail激活的新账户进入题库；1440×900下先确认辅助栏关闭，普通点击“分类管理”，立即出现“新分类名称”可用表单。[关闭前](local4/browser/closed-before.png)、[打开后](local4/browser/closed-entry-open.png)。

在AI页签输入草稿后，普通搜索保持AI页签；再明确点击分类管理，工具可见；切回AI后原草稿逐字保持。[搜索保留AI](local4/browser/ai-search-retained.png)、[AI转管理](local4/browser/ai-entry-open.png)、[草稿保留](local4/browser/ai-draft-retained.png)。这是普通点击和输入，没有DOM点击、强制点击或移除遮挡。影响限M010管理可达性及M028对应右栏场景；原归属R33 UI、R34外壳集成，本候选无需新增公共接线。

### R35-LOCAL-004：CLOSED

普通新增“几何证明”题型和长名称标签，在四个视口输入、测量并查看截图。桌面默认辅助栏宽300px；每个删除按钮均宽48px，文本高19px、行高20px，单行可辨，输入边界清晰，全页无横向溢出。[测量](local4/browser/measurements.json)、[1440×900](local4/browser/taxonomy-1440.png)、[1280×800](local4/browser/taxonomy-1280.png)、[1024×768](local4/browser/taxonomy-1024.png)、[768×1024](local4/browser/taxonomy-768.png)。窄屏采用既有覆盖式辅助栏，返回主区使用普通关闭按钮。

768×1024下保存分类得到200，刷新后两项名称和ID保留；普通点击删除、确认影响提示、保存后刷新，只剩原标签；再删除标签并保存，类型和标签均为空。见 [刷新](local4/browser/pad-reloaded.png)、[删除持久](local4/browser/pad-deleted-persisted.png)、[返回主区](local4/browser/pad-return-main.png)、[操作与响应](local4/browser/events.json)、[浏览器结果](local4/browser/result.json)。只关闭本项控件可读性和可操作性缺陷，不重签分类全生命周期。原归属R33分类样式、R34集成。

### R35-LOCAL-003：CLOSED

正常HTTP创建原独立报告的36组中文段落和分式长题，经正式 `/api/modules/questions/v2/items/{id}/assets` 生成新PNG。题面、公式和分片顺序逐片查看，没有对交付PNG裁剪或缩放来满足上限。

| 输入与预期 | 实际结果及证据 |
| --- | --- |
| 原长题，每片宽1600、高≤2400 | 三片为 **1600×2389、1600×2328、1600×575**；[输入/Job/尺寸](local4/http/long.json)、[原片1](local4/http/long-0.png)、[原片2](local4/http/long-1.png)、[原片3](local4/http/long-2.png)。第17、33段文字之后的公式完整落在下一片首部，36段连续，无公式半截。白底查看：[1](local4/views/long-0-white.png)、[2](local4/views/long-1-white.png)、[3](local4/views/long-2-white.png)。 |
| 2399、2400、2401边界 | 前两者仍单片且等于目标高度；2401拆为1092/1381。每片实际有透明像素和非透明内容。[2399](local4/http/boundary-2399.json)、[2400](local4/http/boundary-2400.json)、[2401](local4/http/boundary-2401.json)。 |
| 5000px超高单图 | question-png和figure-png均单片1600×2292；[题面](local4/http/tall-question-png.json)、[配图](local4/http/tall-figure-png.json)。 |
| 数学、实际图像与答案分片 | `sqrt(2x-1)/(x-2)`实际排版；图像保留；答案开启后另成128px分片，默认题面无答案和私密笔记。[HTTP对照](local4/http/math-with-answer.json)、[答案原片](local4/http/math-with-answer-1.png)。 |
| 真实认证外壳下载 | 正常API准备含公式和固定函数图的题目，普通展开“用于PPT”、生成、查看结果、点击下载，取得题面1600×503、配图1600×817，均有alpha。可全选文字/公式源不含关闭的答案和笔记。[操作结果](local4/browser/consume-result.json)、[生成与下载入口](local4/browser/figure-generated.png)、[实际题面](local4/browser/download-question.png)、[实际配图](local4/browser/download-figure.png)、[白底实看](local4/views/downloads-white.png)。 |

白底仅属于浏览器查看层，原PNG透明像素统计和SHA在JSON中；配图自身原有白色像素不被移除。压力题、色块及公式/函数图对照是显示样本，不算新自动提取质量，也不把独立公式与图像声称为同一数学函数。初次HTTP显示样本误写“三角形”，其实际固定 `figure.png` 是函数图；该输入照实保留，真实外壳下载使用明确的“公式与函数图”对照文字。未以样本文字错误归责产品。素材重启后按原fileId下载字节一致。原归属R33 question-asset，公共呈现协作R31；结论不扩到六种备课输出或目标PPT应用。

### R35-LOCAL-005：CLOSED

实际PNG上传与收录走HTTP，仅Provider adapter返回指定本地正文。总共11次本地adapter调用，产品模型网络请求和密钥读取均0。原稿按下载SHA核对；全部8份材料和Job在服务重启后深比较一致，没有重新调用Provider。

| 正文输入 | 预期与实际 | 证据 |
| --- | --- | --- |
| 单页空正文、空白、两页全空 | failed，0草稿、0片段，包含empty-response | [空](local4/http/extraction-empty.json)、[空白](local4/http/extraction-whitespace.json)、[全空](local4/http/extraction-all-empty.json) |
| `not JSON` | partial，0草稿、1条原文未分配片段，原文不丢 | [HTTP](local4/http/extraction-invalid.json)、[展开后可见](local4/browser/controlled-invalid.png) |
| 完整题对象前缀加截断尾部 | partial，1待核对草稿、1原始截断文本片段；不修补尾部造题 | [HTTP](local4/http/extraction-prefix.json)、[页面](local4/browser/controlled-prefix.png) |
| 成功页后空页、空页后成功页 | 均partial，1草稿、0未分配片段，成功页文字保持 | [前成功](local4/http/extraction-mixed-success-first.json)、[后成功](local4/http/extraction-mixed-empty-first.json)、[页面](local4/browser/controlled-mixed-success-first.png) |
| 固定旧O第2页正文重放 | partial，0草稿、2片段：完整页头和原始截断文本；不造Q3/Q4 | [HTTP](local4/http/extraction-historical-prefix.json)、[页面](local4/browser/controlled-historical-prefix.png) |

浏览器从待整理材料列表普通点击进入，空正文明确显示“整理失败，原稿已保存”，原图可见；返回列表后依次打开其余材料，partial、完整候选及展开后的原文片段可见。[空正文页面](local4/browser/controlled-empty.png)。这些页面使用同一受控库的test-principal题库fixture，不冒充真实认证或在线识别；分类及素材下载另由真实认证外壳证明。旧O重放使用已固定PNG载体与正文，未读取私有完整response或reasoning，也不是重新识别O。原归属R33提取任务状态；M009及直接保留内容回归通过。

## 证据有效性与复用范围

运行入口为 [独立HTTP脚本](local4/scripts/http.mjs)、[分类浏览器脚本](local4/scripts/browser.mjs)、[素材准备](local4/scripts/asset-browser.mjs)、[页面与下载消费](local4/scripts/consume-browser.mjs)。它们调用候选现有fixture接线和产品入口，不调用作者的local5测试。原始交换在 [HTTP](local4/http/http.ndjson)，真实认证服务请求在 [real-auth](local4/real-auth-requests.jsonl)，受控服务请求在 [controlled](local4/controlled-requests.jsonl)。

采集异常保留，均有明确的采集输入/定位原因，不能读成产品FAIL或被最终结果掩盖：

- [sharp入口](local4/http-startup-error.log)误用旧版`lib/index.js`，尚未启动HTTP；改用本候选实际`dist/index.mjs`。
- [历史片段计数](local4/historical-count-collection-error.json)初版预期1，实际还有保留的完整原始截断文本，共2。按固定契约核对两条内容后，在原库读回继续，没有重放已成功提取。初版脚本与日志保留；[最终HTTP运行](local4/http.log)的localProviderCalls=0只指续跑，累计11次见各输入JSON及runtime。
- axi的CSS运行助手返回`fn is not a function`；随后快照连接挂起。改用普通ref完成注册，并停止本轮桥接后以同一独立profile显式Chrome端口连接；没有改产品或账户。失效ref直接重新获取，不以DOM点击绕行。
- [分类响应采集](local4/browser-initial.log)在刷新后读取已离开页面的GET正文失败；此前保存PUT为200且已记录。续跑仅从原库刷新读回并完成删除，[最终分类日志](local4/browser.log)无错误。
- [素材准备缺页头](local4/asset-browser-missing-page-header.log)未受理上传；按真实页面请求补认证page header后完成准备，未提交该header。[折叠标题定位](local4/asset-browser-disclosure-error.log)把summary当button；实际通过axi普通点击summary打开。
- [状态节点定位](local4/consume-browser-status-node-error.log)遗漏同一节点的`1/1`；[初版记录](local4/consume-browser-label-error.log)也停在此处，未走到partial。最终按状态及进度完整匹配。[原文折叠](local4/consume-browser-collapsed-fragment.log)需普通展开未分配片段。[后台页截图](local4/consume-browser-background-screenshot.log)超时后先激活目标标签页，从已完成场景继续下载，未重建数据。[最终消费日志](local4/consume-browser.log)无错误。

本轮固定产品变化限五个questions文件；组合基线与原独立报告产品树一致，候选不改变lessons输出、资源、认证或公共文件内核。四项改动的入口/布局、PNG输出、零内容状态及完整前缀/混合页已直接复验；因此R2八项具名材料消费PASS和001 CLOSED继续按原范围复用。未重跑T/W质量表、六种输出、Office编辑或整套材料验收，没有给全M009/M010/M024/M028或完整R35代签。

`R35-LOCAL-OBS-001/002`均保持 **OPEN，归R34共享HTTP/fixture生命周期及重启诊断**。原固定入口为 `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md`。本轮必要请求没有自然出现同类fetch失败，不以新成功回填旧cause；未盲跑两个历史用例、改连接池或加等待补丁。在线提取、新教师材料质量、目标Windows Word/WPS、打印与物理设备等仍沿用原报告未决项。

## 后继集成与停写

外层消费本报告的提交，以及候选 `42b0cde25f1f8602d25155b27620ac7da4289bd7`；产品补丁入口仍为 `331bd367df450522fb54982984c452c6bb8d4c52`、组合基线 `afdb8f96098e77cfac076179ea0fd2be05bb7c9c`。**公共接线需求无。** 后继集成者只据此关闭四项稳定编号，既有门禁和历史OPEN不变；集成若改变相关产品，再定向检查受影响场景。

新复验先从固定候选建立自己的checkout并`npm ci && npm run build`，将`CANDIDATE`指向该checkout、`EVIDENCE`指向新输出目录、`RUN_DATA`指向新库、`TMPDIR`指向自己的工作盘，再运行`node <本证据目录>/scripts/http.mjs`。`RESUME_EXTRACTION`只用于本次已保留现场续跑；新库不设置。浏览器需自己的Chrome端口和profile，将脚本固定端口50435/50436/50437改为独占空闲端口；真实外壳启动方法沿用候选integration5，普通注册账户，不复用他人Cookie。浏览器脚本要求已有登录页面；新运行不设置`RESUME_BROWSER/RESUME_ASSETS`。`asset-browser.mjs`只负责准备与打开，随后在普通控件生成题面，再执行消费脚本。PNG白底查看入口为[长题与边界](local4/views/index.html)、[实际下载](local4/views/downloads.html)。

完整R35仍未满足，保留本轮独立库、checkout、profile和必要采集进度，后继使用时先复制到自己的新位置。此次服务及浏览器已停止，详见runtime；来源和旧证据未写。本轮只提交本文件及local4，未修产品/契约/旧报告/根台账，未合main、push、部署、派发业务session或跨session联系；提交后停止写入，由外层唯一回调。

证据JSON均可解析，报告相对链接存在，manifest逐文件记录字节数和SHA256。提交范围检查符合授权；`git diff --cached --check`仅报告两份原始构建日志的Vite提示行尾空格，原始字节保留，报告及脚本没有该问题，不宣称全diff空白检查通过。
