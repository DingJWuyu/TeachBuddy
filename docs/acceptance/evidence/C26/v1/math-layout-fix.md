# C26 数学排版自验

C27-D01 的定向修复已通过生产页面自验，交 C27 零模型独立复验。产品仅统一 KaTeX 生成器/样式到 0.16.47，并让含数学内容的段落承接不可断长公式的横向滚动。业务、认证、冻结契约和外壳未修改。

## 固定输入和候选

- C27 缺陷权威：`34e668ae97e1eb0cd5744550b6b05a4c25aa9301:docs/acceptance/evidence/C27/v1/review.md`，来源 `/home/liam_t/项目/TeacherWorkspace-c27`。
- 完整 C26 输入 `31ade74207bf593260f8740be80882c936c97152`，原产品 `127c7e55b006acd5a06ad460f3380963cb51bce0`。从固定对象引入所有产品及必要设计/原证据；没有读取活动候选作为实现输入。
- 本轮组合基线、内部 review fixed point：`f76e24c94f43f5a09169e7ac2b41285ea22dc4e7`。产品文件与固定输入无差异；当前控制树的 AGENTS、协议、DAG、台账、技能路由和设计规则无差异，见 [baseline.json](math-layout-fix/baseline.json)。README 随固定候选引入。
- C25 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475` 和独立冻结 `741025bd0a8e09098b5877428b81c2bdd7f357d0` 保持。
- 新产品 SHA：`687121ec8d9afeccb527d2738f8b1ca22791dd69`。完整证据 SHA 由最终回执返回，本文件可用 `git log -1 --format=%H -- docs/acceptance/evidence/C26/v1/math-layout-fix.md` 定位。

## 复现与因果验证

真实 Chrome 独占 session `c26-math` 普通登录复制库，390×844 页面已保存回复出现底数与上下标跨行，见 [失败截图](math-layout-fix/before-390.png)、[最小结构结果](math-layout-fix/red.txt)。原 `/tmp/c27-31ade742-runtime` 全程只读，复制到自有 `/tmp/c26-math-layout-runtime/formula-short` 才启动服务；无模型配置。

按版本不匹配、正文换行、容器宽度三个假设依次探查。只注入与 Agent 生成器一致的 CSS，分离数降为0，`.base` 从 inline 恢复 inline-block；只取消正文换行规则仍有1处分离。见 [匹配 CSS 探针](math-layout-fix/probe-compatible-css.txt)、[换行探针](math-layout-fix/probe-wrapping.txt)。0.18.7 CSS 没有 0.16.47 HTML 使用的 `.base` 规则；版本统一修复的不只是某一个上下标，还覆盖重音类名等布局差异。没有用手写 `.base` 补丁冒充完整兼容。

同一个 [verify.mjs](math-layout-fix/verify.mjs) 在固定原生产产物上实际判红，三视口合计2处分离，见 [baseline-red.log](math-layout-fix/baseline-red.log) 与 [baseline-retained.json](math-layout-fix/baseline-retained.json)。统一依赖后原持久样本通过，但新增不可断长分式在390px使对话 scrollWidth=441、clientWidth=318，见 [新样本边界失败](math-layout-fix/new-dependency.log)。最终局部段落滚动关闭该边界，保留 KaTeX 在运算符附近的安全换行。

## 实际验证

| 范围 | 结果与证据 |
| --- | --- |
| 原持久回复，1440×900、820×1180、390×844 | 上下标分离0，分式根式正常，独立长公式可横向滚轮阅读；刷新及新进程重新登录恢复同一全文。[after-retained.json](math-layout-fix/after-retained.json)、[390px](math-layout-fix/after-retained-390.png) |
| 新回复，三视口 | 55项上下标、分式根式、hat/vec、不可断长分式、独立长公式；逐公式结构检查、真实横向滚轮及截图审看通过。最终记录 [stable-new.json](math-layout-fix/stable-new.json)，图片前缀 `stable-new-`，`scroll-*` 为实际滚动后的可读尾部。 |
| 原题库 MathText 与共用右栏 | 经真实认证 HTTP 保存题目，普通点击题库/题目打开，三视口公式阅读、分式根式及重音显示通过；桌面打开 AI 后全文和脚本结构保持，返回首页保持全文。[question-desktop.png](math-layout-fix/question-desktop.png)、[question-820.png](math-layout-fix/question-820.png)、[question-390.png](math-layout-fix/question-390.png)、[右栏](math-layout-fix/question-agent-panel.png) |
| 外壳与滚动 | 每个视口 document 宽度等于 viewport，对话 scrollWidth 不超过 clientWidth；滚动只发生在长公式段落/独立公式区域。原 Chrome 同页刷新后复核 [chrome-after.txt](math-layout-fix/chrome-after.txt)、[截图](math-layout-fix/chrome-after-390.png)。 |
| 生产构建 | `npm run build` PASS，[build.log](math-layout-fix/build.log)。保留原有大包提示，无 lint/typecheck 独立脚本。依赖实际树见 [versions.log](math-layout-fix/versions.log)。 |
| API | `npm run test:api` 首跑163/164，导出目录无 Git 导致旧库升级夹具失败；补只读 GIT_DIR 后单独升级项 PASS，合计164项均有通过执行。[api.log](math-layout-fix/api.log)、[api-upgrade.log](math-layout-fix/api-upgrade.log)。未改测试断言。 |
| Agent 与认证接线 | `npm run test:agent:e2e -- --grep-invert 'live模型'` 7/7，`npm run test:e2e` 10/10。覆盖草稿冲突/隔离、SSE恢复、丢响应幂等、工具卡重读、手工编辑冲突和认证恢复。[agent-browser.log](math-layout-fix/agent-browser.log)、[auth-browser.log](math-layout-fix/auth-browser.log)。 |

回归在自有 `/tmp/c26-math-regression` 固定产品导出和本轮文件上运行，截图写到该副本，未覆盖作者旧截图。公式测试是实际 HTTPS/API/浏览器 E2E，无 UI 单测。初次验证脚本混用了 innerText 与 textContent，导致恢复检查误报；保留 `retained-dependency.log`，后续统一全文投影并通过。题库初始截图曾采到侧栏动画中间态，最终脚本等待72px终态再截图。

## C27 零模型入口

先复制原保存数据到自己的目录，再在本次完整候选根启动，不直接运行原现场：

```bash
cp -a /tmp/c27-31ade742-runtime/formula-short /tmp/c27-math-recheck
npm ci
npm run build
npm run review:agent -- /tmp/c27-math-recheck 44649
```

打开 `https://localhost:44649`，允许本地测试自签证书。普通登录 `formula@c27.test` / `password-c27-formula`，首页选“请显示一段带上下标的长公式”。三视口审看行内底数/上下标、分式根式，横向滚动独立公式查看末项。此入口不配置模型，产品请求0。新扩展样本可从本回执 `stable-new.json` 的 directory 复制，再以同一账户登录，从历史选“检查长公式、上下标、分式和根式”。该自有样本作为复验制品保留到独立复验完成。

自动复核：在候选根执行 `node docs/acceptance/evidence/C26/v1/math-layout-fix/verify.mjs retained recheck`，先将脚本的 directory 常量改为自己的原库副本；`new recheck` 自动创建独占库并通过本地受控 provider 发一次合成回复。脚本从实际 cwd 加载产品，输出写在脚本所在目录，应在自有导出里运行。没有读取 `.env`，provider 禁用模型网络；它只替换回复来源，保留真实 SDK、认证、持久化和渲染器。

本轮新增产品模型请求 **0**，实际本地受控调用共4次，逐运行日志记数，不能加进付费账。C26 既有 **10次/79983 tokens**，C27 新增 **11次/88550 tokens** 各自独立保持，无重置、付费重试或账单推断。

## 内部审查与回执

内部双轴审查待聚合；产品自验通过不替代 C27 independent。仅提交任务分支，不合 main/push/部署，不改源 worktree 或根台账，不通知其他 session。
