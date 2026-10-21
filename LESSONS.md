# Lessons

修改代码前读本页，审查时核对相关条目。只记录本仓已证实失误产生的当前预防规则；稳定工程判据见[代码标准](docs/code-standards.md)。

## 当前条目

### 当前装配使用当前目录，历史样本只验证兼容

修改目录或协议后，运行当前功能的 fixture 直接使用产品装配；只有明确验证旧版本的测试才加载其冻结样本。目录示例不能替代当前 `moduleCatalog`，否则测试会在业务执行前失效，还会误报覆盖了旧库升级。固定旧版应用仍按其旧接口关闭资源，不能把当前 `close` 端口批量替换进同一升级测试的旧版阶段。

资源 HTTP fixture 曾用材料协议 v2 的示例替换当前资源描述，缺少 `webEnabled`，六个场景均启动失败；其“旧库迁移”场景实际初始化的是当前实现。依据：[原 fixture](https://github.com/DingJWuyu/TeachBuddy/blob/71877a7768c904fdd082d5d53864a52c5dc68236/apps/web/e2e/fixtures/materials-resources/server.mjs)、[原测试](https://github.com/DingJWuyu/TeachBuddy/blob/71877a7768c904fdd082d5d53864a52c5dc68236/apps/api/test/materials-resources.test.js)；升级夹具批量替换关闭接口导致两个固定 R31 场景失败的依据见 [CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38683706468)。当前保护在[资源 HTTP 测试](apps/api/test/materials-resources.test.js)和[固定旧库升级](apps/api/test/math-integration-migrations.test.js)。

出现日期：2026-10-14。已核实 1 个不同日期。

### 按实际工具依赖分配 CI 测试

把测试加入 CI 前，追到它实际执行的文件转换或浏览器入口，再选具备这些前置的 job。确定性 HTTP 测试也可能调用系统工具；工具安装还须覆盖实际格式，存在 `soffice` 不代表已安装 PPT 所需的 Impress。开发机已有工具的通过结果不能证明 Runner 前置足够。

资源 HTTP suite 的补充预览和正文搜索会调用 Bubblewrap 与 Poppler，曾被加入只准备 Node 的 API job；资源浏览器套件的 PPT/PPTX 预览还暴露了 Office 安装缺少 Impress。现按实际路径分组并补齐组件，保留原断言。依据：[错误分组](https://github.com/DingJWuyu/TeachBuddy/blob/2ee70e90e6c6c6428e277a5e605e9a9707c3a49c/package.json)、[分组失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38613661520)、[格式组件失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38614967580)；实际依赖见[文件转换器](apps/api/src/workbench/files/converter.js)和[转换 worker](apps/api/src/workbench/files/conversion-worker.mjs)。

出现日期：2026-10-14。已核实 1 个不同日期。

### 未决操作的接续入口由持久状态决定

修改保存、导入或列表恢复时，核对未决请求所在的每个实际页面：刷新后临时提示为空，仍应按持久请求状态显示确认或重选原文件的入口。不能只在已经打开编辑器的页面提供恢复动作，也不能以提示文字是否存在代替业务状态。

数学制作源导入和归档丢响应后刷新，首页曾保留 pending 却不显示确认；网页上传还有独立 importPending，只在旧编辑器显示重选入口，首页无法接续。两类失败均经真实首页操作复现，修复复用原请求键及原文件核实。依据：[旧首页条件](https://github.com/DingJWuyu/TeachBuddy/blob/71b6abf8aba732591906712f33eab520d00a80c0/apps/web/src/features/math/index.jsx)；当前保护在[制作源及归档恢复](apps/web/e2e/math-workspace.spec.js)和[网页原件重选](apps/web/e2e/manual-support/support.spec.js)。

出现日期：2026-10-14。已核实 1 个不同日期。

### 故障注入完成后再检查界面恢复状态

测试保存冲突或响应丢失时，先等待真实服务器操作和注入事件完成，再开始等待冲突、待确认等界面状态。服务器生成与持久化、网络故障送达、界面响应是不同阶段，不能把它们共同塞进短界面断言期限。保留各阶段已有时限及版本、原请求键和内容保护，不以重试或延长断言掩盖错误前置。

数学保存的两条用例曾在服务器更新尚未完成、或真实 201 与中断尚未发生时，先耗尽 10 秒界面断言；本地原用例能通过，云端 trace 明确显示顺序问题。[失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39438344786)及[修正提交](https://github.com/DingJWuyu/TeachBuddy/commit/d7fb9ec9516a775885af18e21f8f6b13ffcebb7d)保留证据；当前保护在[数学保存回归](apps/web/e2e/math-geogebra.spec.js)。

出现日期：2026-10-20。已核实 1 个不同日期。

### 浮层内操作完成后保留有效焦点

菜单移入 portal 时，验证打开、操作成功或失败、继续 Tab 和关闭的连续路径。失败保留输入以便重试；成功若会禁用或移除当前控件，在状态更新前把焦点交给同一浮层中仍有效的控件。异步返回时先确认原浮层仍打开且焦点未由用户移走。关闭后实际继续 Tab/Shift+Tab，核对焦点接回触发器相邻控件，不能只检查浮层消失。

班级题目标签菜单新增成功后清空输入，曾禁用当前“添加”按钮，使焦点落到 BODY，下一次 Tab 跳到工作台外壳。只验证立即 Escape 会漏掉这一步。依据：[原新增路径](https://github.com/DingJWuyu/TeachBuddy/blob/b110e6ad2d97862ba3df6e83693cf6ac2736e637/apps/web/src/features/classroom/Exams.jsx)、[修复 PR #47](https://github.com/DingJWuyu/TeachBuddy/pull/47)；当前保护在[班级完整保存回归](apps/web/e2e/classroom.spec.js)。

全站原型对照又发现共享 Menu 的 Tab 关闭只卸载浮层，焦点同样落到 BODY；修正为关闭前回到触发器，再由浏览器继续原顺序。依据：[修复 PR #49](https://github.com/DingJWuyu/TeachBuddy/pull/49)；连续 Tab/Shift+Tab、Escape 与不误选会话的保护在[历史菜单回归](apps/web/e2e/c26/agent.spec.js)。

题库删除分类前读取影响数，会先禁用当前删除按钮；取消确认后曾回到 BODY，Tab/Enter 跳到工作台首页。现在禁用前交给同行名称输入，再用取消、Tab、重开验证接续。依据：[原删除入口](https://github.com/DingJWuyu/TeachBuddy/blob/a91cc0e0306a2c5537cab6f868db94aa466b0bf1/apps/web/src/features/questions/MaterialsQuestionsPage.jsx)；当前保护在[题库交互回归](apps/web/e2e/questions-ux.spec.js)。

出现日期：2026-10-20、2026-10-21。已核实 2 个不同日期。

### 区分业务时钟与浏览器动效时间线

固定业务日期时，先确认测试工具是否同时接管 RAF 和定时器；JS 时钟推进不代表原生 CSS 时间线推进。验证短暂退出动效时，核对浏览器实际 transition 的插值，再检查卸载、焦点与后续操作。单次 RAF 采样未命中不足以证明动效缺失。

日程提醒浮层的 CI 失败中，采样与 Escape 仅隔 5.827 ms，节点已进入关闭态却未采到中间透明度。探针确认受控 JS 时钟与 CSS 时间线独立；原用例改为暂停 JS 卸载、读取真实 transition 中点，再播放完成并恢复时钟，保留原有卸载、归焦、重开和保存检查。移除淡出的对照仍明确失败。依据：[失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39493111710)、[固定修正](https://github.com/DingJWuyu/TeachBuddy/blob/9255745c163d260564a7ebc7132a45a99a6cd3f6/apps/web/e2e/schedule/capabilities.spec.js)；当前保护在[日程能力回归](apps/web/e2e/schedule/capabilities.spec.js)。

数学参数范围展开又因 Runner 忙帧误报：180ms 动效的前两次 RAF 相隔149.9ms，已有中间透明度，但四舍五入后只有3种高度，不满足原测试的4种门槛。此类检查从真实点击捕获浏览器已有 transition/keyframe，暂停并按进度读取插值；快速反向仍用真实点击，核对反转前后的连续性，并保留末项可达、卸载和归焦。移除对应动效的负对照须继续失败，不能只降低采样门槛。依据：[失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39588034823)；当前保护在[数学完整交互回归](apps/web/e2e/math-unified.spec.js)。

出现日期：2026-10-20、2026-10-21。已核实 2 个不同日期。

## 维护规则

1. 完整改动目的或阶段交付时，依据返工、回归、独立审查和用户纠正决定是否新增或更新；没有新的已证实教训时不修改。不建立夜间循环或社区监听。
2. 每条写清触发条件、可执行规则、保护的使用结果、固定本仓 commit/Issue/入库样本证据和出现日期。单次有充分证据即可记录；假设、普通命令错误和外仓事故不计数，不编造历史。
3. 同一规则在三个不同日期各有独立本仓证据时，合并到所属稳定权威页并移除本页重复条目；已被现行标准涵盖的内容直接改权威规则，不再制造第二副本。失效规则移除，历史由 Git 保留。
4. 证据只保留足以核查当前规则的链接，完整执行过程留任务产物；长期条目不能只依赖被忽略目录或个人机器路径。当前任务的未完成问题沿[当前任务记录](docs/agents/module-development.md#当前任务记录)维护，范围外待判断发现进入 [buffer](buffer.md)，Lessons 不替代待办。
