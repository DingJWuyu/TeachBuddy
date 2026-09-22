# R35-LOCAL@1 attempt 2 独立定向复验

**M43 具名本地材料消费集合：independent PASS。R35-LOCAL-001：CLOSED。完整 R35：未通过，仍有在线技术缺口、未覆盖完整场景及目标环境 BLOCKED。** 两项历史自然 fetch 失败继续 OPEN。本回执证明新固定候选的本地消费前置，不代签完整 R35/M43/M44，也不自行启动 M43。

```yaml
task: R35-LOCAL@1
attempt: 2
role: acceptance
status: PASS
status_scope: M43 具名本地材料消费集合及本轮定向复验
verification_level: independent
finished_at_utc: "2026-09-22T14:46:55.334934+00:00"
session_id: 01a0c983-29a6-7103-9cdf-d2e74e499d65
runner: Codex / gpt-6-astra / medium
skills_used: [writing-for-agents]
base_revision: 83045e038084925dcef96fdc0b1a3489f7e845a7
candidate_revision: 3a10e0d5108a4950bba0851610bae7d8495dc8ff
product_revision: 18a80073380116e1d30165f0001a86e5fdb2304c
result_revision: 本文件及 local2/ 所在 review/r35-local-recheck 提交
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
identity_mode: real-auth；合成片段和 math fixture 为 test-principal，分项列明
failure_owner: null（本轮具名消费集合无阻断缺陷）
next_condition: 根固定 P/M/D 和公共唯一写权后可按已采纳限定边启动 M43 本地实现；完整门禁保留
open_items: [R35-LOCAL-OBS-001, R35-LOCAL-OBS-002, 完整材料场景, 在线技术缺口, Windows/WPS, 真实邮件及物理设备]
authorization_used: 本次用户固定候选、隔离复验、仅报告分支提交的派发；禁止产品改动及新增模型请求
```

## 固定输入与运行身份

| 用途 | 固定对象 |
| --- | --- |
| 受测完整候选 / 产品 | `3a10e0d5108a4950bba0851610bae7d8495dc8ff` / `18a80073380116e1d30165f0001a86e5fdb2304c`；两者 apps/packages/依赖树一致 |
| 作者交接，只作入口 | 同候选 `docs/acceptance/evidence/R34/v1/attempt5.md`、`integration5.md`；未直接升格作者 self 结论 |
| 旧独立报告，下称 OLD | `4c4b68965e3226e5d66bf8f16ad5f390541cb2da:docs/acceptance/evidence/R35/v1/local-review.md`；其产品候选为 `6398bf2dae85d1872c929aa8ef32d5705d763687`，旧现场和证据只读 |
| 本地边界 | 报告基线 `83045e038084925dcef96fdc0b1a3489f7e845a7` 的根 AGENTS、execution-protocol#acceptance、mvp-matrix#r35/#evidence、design-and-verification、tasks/materials/continuation、arch/materials-continuation#r35-m43-m44-gates |
| 冻结判据 | 受测候选中的 materials.feature、materials 契约及 auth 契约；materials.feature/契约相对旧受测候选未变。T 澄清沿用 `43b117c7ed6fe5aa408422351db46e23a6ea6f3e` |

运行 checkout 为 `/tmp/teacher-r35-local2-candidate`，detached 在完整候选。来源 `/home/liam_t/项目/TeacherWorkspace-r34-materials-candidate` 未写。报告分支从 main 的 `83045e0` 起步，仅写本报告和 `local2/`。产品、冻结规格、旧独立报告未改，末次校验见 [readonly-checks](local2/readonly-checks.json)。

环境见 [environment](local2/environment.json)：Linux、Node 22.23.2、Chrome 152.0.7977.64、LibreOffice Writer 26.8.0.3。`npm ci`、当前候选生产构建成功；[build.log](local2/build.log)含已有 >500 kB chunk 提示。没有重跑整套能力实验、全 API 或 diff review。

- 主输出现场：`https://127.0.0.1:49935`，`/tmp/teacher-r35-local2-runtime`。从停写 `/tmp/teacher-r34-attempt5` 完整复制，独立新 Chrome context 真实 UI 登录；下载重新受理的新条目，不复用作者成品。
- 重启现场：`https://127.0.0.1:49934`，`/tmp/teacher-r35-local2-retained`，另一份完整副本。实际 PID `1237767 → 1237972`；另有 49937 空库注册/上传重启，PID `1232320 → 1232339`。
- 浏览器回归新库在 `/tmp/teacher-r35-local2-e2e/`；片段独立端口 49939；math 隔离端口 49936。浏览器 contexts、fake-mail、TLS 和数据都与源运行现场分离。A/B 从真实认证入口登录或注册，不手工注入身份。
- Office 独立 profile `/tmp/teacher-r35-local2-office-final`、UNO 49938、Xvfb `:1352`；只读复用已安装 Office，不共用作者配置。
- **产品模型请求 0，产品模型密钥读取 0。** 本地 fake-mail、自签 HTTPS 不证明真实外发邮件或可信部署；1024/1280/1440 是模拟视口，不是物理设备。

## M43 本地消费集合逐项裁决

下表每行都是 independent 结论。复用只指 OLD 中具名、未受影响的独立证据，不是把旧 PASS 改名当成本轮新测。实际变化清单见 [impact-files](local2/impact-files.txt)。

| 具名消费项 | 结果 | 本轮证据及旧证据复用边界 |
| --- | --- | --- |
| File 写入、读取、原键确认 | PASS | 新浏览器实际 W/图片/课件上传、成果下载，49937 未知上传经普通进程重启后原键确认，预览仍可读：[process-restart](local2/e2e/process-restart.json)。File/存储内核未改，OLD 的原件字节、格式入口及重复上传结果继续适用。 |
| 原稿预览、独立定位、裁图 | PASS | 两个真实上传载体的合成 body/answer 片段，点击“答案 · 原稿2 · 第1页”确实切换 fileId；人工改标题保存刷新保持该原稿，见 [browser-synthetic](local2/e2e/browser-synthetic.json)。新片段 API 在自身 PDF 上实际裁图、缺乏证明的图关联仍阻断：[pdf-crop](local2/fragments-api/pdf-crop.json)、[裁图](local2/fragments-api/own-pdf-crop.png)。原生预览和人工裁图底座未变，OLD 的真实 W 指针裁图/格式预览复用。合成图关联不计在线识别分数。 |
| 已确认题、资源快照及明确采用 | PASS | 真实 W 修改分母、保存刷新、确认入库后取入环节并下载 DOCX；另一条真实认证链上传课件、替换原件、保留旧快照后明确采用，再混合取材输出：[8项浏览器结果](local2/e2e-run.log)、[native-word](local2/e2e/native-word-practice.docx)、[lesson-real](local2/e2e/lesson-real.png)。资源/快照内核未变；OLD 的题删除恢复、源更新及私密笔记快照证据复用。 |
| 备课取材、指定环节与往返现场 | PASS | 真实点击/键盘从使用位置进实际环节、刷新再返回题库，搜索、未保存标题及焦点保留；主动加入后的反馈/前往入口可用，响应丢失后同键确认不重复：[usage-return](local2/e2e/usage-return.png)、[e2e-run](local2/e2e-run.log)。 |
| 持久保存、失败草稿、幂等、普通重启 | PASS | 真实 PUT 已提交后阻断响应，UI 保留未知状态；同库普通进程重启、刷新、“重试确认”同键，版本 `8 → 9 → 9`，sections/materials 与受理结果一致：[retained/result](local2/retained/result.json)。另一浏览器场景确认原请求后保留随后新草稿，保存刷新成功。两项历史自然故障仍 OPEN，不据本行消案。 |
| 保留库及历史输出读回 | PASS | 新 Chrome context 无历史浏览器状态，真实重新登录读回重启后的备课，并实际下载重启前历史成果：[fresh-login-history](local2/retained/fresh-login-history.png)、[retained/http](local2/retained/http.json)。math fixture 同库两次重启保持文件/文档/题/重放/迁移：[target-api](local2/target-api.log)，此项单列 test-principal。 |
| 账户与匿名隔离 | PASS | 14 条具名路径覆盖备课、输出列表、六题、三张图、资源、Job、输出文件；逐条先证实 A=200，再核对 B=404、匿名=401：[isolation/result](local2/isolation/result.json)。真实退出后旧页面 401 另通过。未扩称完整认证安全验收。 |
| 六输出本机内容、过滤和布局 | PASS | 六种默认 UI 新下载，教案2页、讲义/练习4页；全部页图实际检查，PDF 与相应 DOCX 的 Office 转换逐页像素相同；17个正文 OMML、3图、六题、备用排除、答案/注记关闭有效：[content-checks](local2/content-checks.json)。Writer 三类实际打印预览见 `office-*-4/`。完整过滤四组合及数学编辑复用范围见下节。 |

**集合总体 PASS。** 当前候选可作为限定本地边的 P 输入；根仍须固定 M=`b0703907a7339513ed34bfed5c1e6787cc65d37d`、D=`1a5dd015863d749e5244346f4eaad24ac506670d` 和公共唯一写权。本报告未验 M42/M43 真实组合、lessons v3、含 math 输出或离线作品，不授予完整下游放行。

## R35-LOCAL-001 关闭依据与二十行独立判断

**R35-LOCAL-001，归属 R34 / lessons 输出排版，CLOSED 于本候选的固定六题默认路径。** 旧红灯只读引用 OLD，不重新制造或覆盖。新浏览器依次“备课 → R35 丢响应后保留 → 输出”，全部环节、备用不选、答案/注记关闭，默认4行，实际受理保存版本8后下载 PDF/DOCX。

| 成果 | 新下载证据 | 本机结果 |
| --- | --- | --- |
| 教案 | [PDF](local2/lesson-plan-4-pdf/lesson-plan.pdf)、[DOCX](local2/lesson-plan-4-docx/lesson-plan.docx) | 2页，无纯白页；忽略作答行选项 |
| 讲义 | [PDF](local2/handout-4-pdf/handout.pdf)、[DOCX](local2/handout-4-docx/handout.docx) | 4页，无纯白页；24个作答段落 |
| 练习默认4行 | [PDF](local2/practice-4-pdf/practice.pdf)、[DOCX](local2/practice-4-docx/practice.docx) | 4页，无纯白页；第4页有第六题图及4行空间，24行完整 |
| 练习明确20行 | [PDF](local2/practice-20-pdf/practice.pdf)、[DOCX](local2/practice-20-docx/practice.docx) | 8页，第8页像素全白；六题各20行，共120行，17个 OMML/3图完整 |

每个下载目录保存 `export.json`、`result.json`、实际 UI 截图和全部页图。默认缺陷没有通过减少行数、缩图或裁掉尾页隐藏。四行的真实 Writer 布局和[打印预览](local2/office-practice-4/print-preview.png)共同证明，第六题图和四行已经一起进入末页。

二十行独立裁决为 **PASS，尾页是合理、可用的作答续页**，理由来自本轮下载物：

1. [真实布局](local2/office-practice-20/layout.json)与[逐题空间摘要](local2/space-summary.json)显示，第六题第1至17行在第7页，第18至20行在第8页。不是只有页分隔符的空壳，也没有第9页。
2. A4 高297mm、上下边距各20mm，可用257mm。图段到首作答段约63.96mm，行节距约11.04mm，20行约220.8mm，合计约284.8mm，超出同一页可用高度；删末页会损失所选空间。第7页已用17行，保留字体、图、段距和顺序时剩余3行应续页。
3. 用真实 Writer 在独立检查副本的120个已有空段落写入短行号，未增删段落；写入前后全部段落页码和纵坐标一致，实际保存、关闭、重开文字/页码仍一致：[space-proof](local2/space-proof/space-proof.json)。[可见打印预览](local2/office-marked/print-preview.png)明确显示17行与尾页3行；[尾页标记](local2/space-proof/page-8.png)可独立核验。
4. 逐页查看原成品，前面各题也按所选空间自然续页，题文、数学和图未裁断。最后一题后的连续空白在此固定文稿中没有归属歧义，空白可用于继续作答。没有把标记版冒充成品，也未要求新增续题标题来改冻结契约。

此判断只涵盖当前固定文稿和本机布局，不宣称任意纯白页都合理或页数全局最优。实际 Word/WPS 的分页仍需目标应用复验。

输出设置在1440/1280/1024下的标签均一行、无全页横溢出；成果、格式和行数通过普通控件实际操作。见 [layout](local2/options/layout.json)与[1024截图](local2/options/options-1024.png)。

## 证据复用与输入分类

复用基点是 OLD 的固定产品 `6398bf2`，不是作者 attempt5 的绿灯。相对新候选，File/Job/content、资源、认证、备课持久/快照内核及冻结契约未变。输出过滤树只新增作答段落 keepNext，Word 数学对象序列化未改；因此 OLD 中24份答案/注记过滤组合、私密笔记排除、三类 DOCX 中文/行内及独立公式的实际 Office 编辑重开、不支持公式拒绝可继续作为既有独立证据。本轮重新检查了受影响默认/长空间版式、六输出关闭项和 UI 控件，不宣称又执行了旧24组合或三类数学编辑全流程。

T/W 原生算法不是全部无变化：新 extraction 增加了答案歧义 unresolved、归并和草稿身份逻辑。旧固定 T/W 的单一答案、不缺已提供正文路径仍适用，缺图校验与原生 Word reader未改。本轮真实 W 校对/保存/刷新/入库/输出，以及同文重复导入独立 draft ID 检查通过；答案歧义、缺页和不确定 absence 由新定向控制流覆盖。OLD 的 T/W 六题质量表、T三题缺图阻断/部分确认保留为旧固定输入的独立结果，不重新评分为新的在线能力。

| 输入类型 | 本轮实际执行及结论 |
| --- | --- |
| 真实原生输入 | 固定 `W.docx` 经真实上传/自动原生读取，修改分母 `x-2 → x+2`、保存刷新、入库取材输出通过。此人工改动用于持久化验证，不声称原答案对改编题仍正确。原固定六题已确认快照用于新六输出。 |
| 合成控制流 | `local2-*.spec.mjs` 中小段文字、两个上传图片载体+合成 fragments；API 合成续文、重复编号、缺页、失败/重试/人工版保护、真实PDF裁图等10项片段测试中的适用项。图片载体不证明识别成功，fixture Provider不发网络。 |
| 历史模型正文重放 | `fragments-api` 一项读取固定 `attempt4/old-page-2.content.txt`，只保留真实存在的完整前缀，0份可确认草稿，`truncated-response`，未补造Q3/Q4：[old-response-replay](local2/fragments-api/old-response-replay.json)。这是旧 O 正文，不是新模型请求，不读取 reasoning。 |
| 独立执行数量 | [浏览器8/8](local2/e2e-run.log)；[定向API 11/11](local2/target-api.log)，含上述10项片段与1项保留库迁移重启。没有测试级 retries。主输出8份是6个默认组合+2个明确20行组合。 |

## 未决项与完整 R35

以下稳定观察编号用于接续定位，均不是本轮新增自然故障，也不与 R35-LOCAL-001 合并。

| 编号 | 状态 / 归属 | 事实与下一份所需证据 |
| --- | --- | --- |
| R35-LOCAL-OBS-001 | OPEN，R34共享HTTP/fixture生命周期诊断 | 原 R33 最终 MC13-15 `materials-resources.test.js:232` 首次 `POST /api/workbench/files` 自然 fetch 失败。本轮没有重跑该整个文件去追绿；实际上传/未知恢复成功不证明旧原因消失。 |
| R35-LOCAL-OBS-002 | OPEN，R34共享重启诊断 | 原 math 保留库第二次启动后原键 `POST /api/modules/questions/items` 自然 fetch 失败。本轮同类保留库重启成功，不回填旧 cause。 |

原始失败和诊断入口固定为 `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md` 及其引用。下一次必要业务复验若自然出现失败，保留当次 cause、请求/socket、监听代次、时序和数据库，不先重试覆盖。本轮仅定向API显式加载同候选的纯观察探针，[transport-summary](local2/transport-summary.json)及[完整轨迹](local2/transport/)共329/8请求、request:error为0，不能据此关闭历史故障。没有连接池补丁、等待补丁或盲跑。

**完整 R35 另列为未通过，不以本地 PASS 代签：**

- P/I/PS/E新在线质量、真实教师新材料与付费未知结果恢复仍未验证，既有在线技术 FAIL不消除；网络Provider接线/路线与有界调用授权归 C20/R30/R33/EMODEL，当前预算0。
- OLD 中明确未完整覆盖的分类全生命周期、拆分合并/补图恢复、所有删除恢复/冲突、故障组合、宏/恶意包等仍未补签；本轮8/11条不等于 materials.feature 全量完成。
- Windows Word/WPS实际编辑保存、目标PDF打印、真实邮件、课堂/触屏/物理设备仍待外层验收组织者与用户提供实际环境。Linux Writer和模拟视口只支持本报告具名结果。
- M43本地启动仍需根固定M/D/唯一写权；完整R35 → 完整M43 → 完整M44及后续门禁保留。两项历史 OPEN 不被忽略，也不否认本轮已经独立成立的具体重启/消费结果。

## 可直接接续入口与证据完整性

证据索引为 [manifest](local2/manifest.json)。运行脚本在 [scripts](local2/scripts/)，绝对 import 固定本次隔离 checkout。浏览器副本来自候选 attempt5/run-sources，仅改证据/库/端口/import及 `.mjs` 扩展；下载器去掉“20行必须恰好白页8”的作者断言，改由以上独立 Office 判据裁决。源脚本不覆盖。

恢复本地现场使用：

```bash
cd /tmp/teacher-r35-local2-candidate
R34_PORT=49935 R34_DATA_DIR=/tmp/teacher-r35-local2-runtime \
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 \
node apps/web/e2e/fixtures/materials-integration/server.mjs
```

新浏览器登录保留测试账号后打开“R35 丢响应后保留 → 输出”。本机隔离fixture登录输入保留 `/tmp/teacher-r35-local2-tools/login.json`，未提交该文件。`run-downloads.py`读取该输入；若新一轮复验，请先复制运行库、改为新端口/证据目录，不覆盖本次结果。`retained-restart.mjs`是一次性场景，重跑应从停写源再建新副本，不能在已创建B的现场重复注册。`isolation.mjs`使用已完成的本次保留库，逐项A/B/匿名三方对照。

定向E2E从候选根用 `node node_modules/@playwright/test/cli.js test --config=<本报告目录>/local2/scripts/playwright.config.mjs`；片段fixture构建使用候选的 `apps/web/e2e/fixtures/materials-questions/build.mjs`。定向API入口为 `node --test <报告目录>/local2/scripts/fragments-api.mjs <报告目录>/local2/scripts/math-restart.mjs`，同时显式设置新的 `M41_MIGRATION_PORT`、`R34_TRACE_DIR`，并 `--import=<候选>/docs/acceptance/evidence/R34/v1/restart-diagnosis2/trace-preload.mjs`。默认不加载诊断到产品。

Office检查由 `inspect-office.py` / `space-proof.py` 连接本轮独立UNO端口。使用 `SAL_USE_VCLPLUGIN=gen`、`DISPLAY=:1352`；本轮profile已完成初始化。`space-proof.py`只在检查副本填标记，原下载物不变；最终可见证据使用 `office-practice-4/`、`office-handout-4/`、`office-lesson-plan-4/`、`office-practice-20/`、`office-marked/`。

采集问题独立保留，不算产品故障：初始E2E副本缺少ESM扩展、sharp入口定位错误、登录误选旧B而保留源只有A，分别见 `e2e.log`、`download-startup-error.log`、`login-fixture-selection-error.log`；改正采集输入后才执行有效链。首次Office黑屏、首次向导及tip遮挡的截图留在 `office20/`、`space-proof-startup*/`及`space-proof/print-preview.png`，不作为可视通过证据。隔离第一版误写资源 `/v1/` 路径，旧结果保留；正式结论只用 `isolation/result.json` 的正确路径及A=200对照。

证据清单逐文件SHA复核一致，提交范围检查通过。`git diff --cached --check`仅指出原始构建日志的两处行尾空格和ESM启动错误日志的末尾空行；原始日志按实测字节保留，报告及脚本无该问题，不伪称全diff whitespace检查通过。

完整 R35 尚未满足，隔离库、checkout、Office配置、失败采集现场和进度保留。结束停止本 session 的服务/浏览器/Office/Xvfb，源运行库与旧证据未写。仅报告分支提交后停写，未合main、push、部署、扩派业务session或联系其他worker，由外层唯一回调。
