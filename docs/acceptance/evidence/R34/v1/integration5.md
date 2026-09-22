# R34 attempt 5 统一材料候选与 R35 入口

本入口只交本轮材料组合及针对性复验，不是 M43 或全 MVP 集成。[attempt5](attempt5.md)为 self 回执；根安排 R35 independent，本 session 不自行派业务验收。

## 固定版本

| 用途 | 完整版本 |
| --- | --- |
| main-based 起点 / 当前任务分支 | `dfb3b4adf35f2657c8f001fd6c1ad6c8cc26726f` / `fix/r34-materials-candidate` |
| 完整材料输入 | `880e6e68be0855b3289dea8db3c87e8c67bc1042` |
| R33 实际产品 | `812da1091724d5536eb4a3fbcf2c47033fa64555`，完整 R33 `f73b7fe0deefb4adfe570519ae93754d1bd85e3a` |
| 输出修复输入 | `813c97fce9fa483d1094d8c4e5ad5fc37c9b3349`，代码 `00d1c5630f044c299dd5eeedadc81cff620aca63` |
| 两份输入的组合 fixed point | `88d610f07b627533201ba59ac1d176d6bd1059ae` |
| 统一代码候选 | `18a80073380116e1d30165f0001a86e5fdb2304c` |
| 统一完整候选 | 包含本文件、attempt5.md 和 attempt5/ 的提交，最终回执提供完整 SHA |
| 原独立缺陷及通过项 | `4c4b68965e3226e5d66bf8f16ad5f390541cb2da:docs/acceptance/evidence/R35/v1/local-review.md`，只读 |

两次固定树装配后才形成 fixed point，不声称输入是 Git 祖先。产品与 880e6e6 的差异列表见 [composition](attempt5/composition.json)：旧输出修复与专属 fixture，加本轮两个输出 UI 文件。没有接入 M42 新数学产品，没有改冻结 schema、认证/题库/资源/math 内核。起点根 AGENTS、run-state、DAG 原样保留；旧证据校验见 [old-evidence-preserved](attempt5/old-evidence-preserved.json)。

## 一次针对性 R35 复验的判据

1. **固定统一候选与实际身份。** 独立 checkout、端口、库与浏览器，从真实登录进入页面。完整候选同时含最新 R33 和默认分页修复，不使用活动分支/作者当前服务。旧 R35 未受影响通过项可按根的验收组织方式引用，不能直接签成新候选已验。
2. **默认四行。** 固定六道 W 题，全部环节、答案/注记关闭、备用不选，真实 UI 生成并下载练习 PDF/DOCX。应有六题、三图、17 个正文可编辑公式、24 作答段落，4 页且无纯白页；第 4 页包含第六题配图与四行空间。讲义同为 4 页，教案 2 页，核对实际内容与过滤。
3. **显式二十行。** 用同文稿在 UI 改为 20，下载 PDF/DOCX。应保留每题 20 行共 120 行；本机该样本 8 页，最后三行自然在第 8 页。必须核对实际页图、Office 段落布局与作答可用性后作独立判断，不以“旧版也白”或作者断言豁免，也不要求裁页/减行。依据是 [space-comparison](attempt5/space-comparison.json)及真实下载物，标记版仅用于把空段落位置显现出来。
4. **受影响组合。** 从最新 R33 的题/答案独立片段切换到正确原稿，人工校对保存刷新；实际取材到环节、来源/使用位置返回保持现场；保存或上传响应丢失后同键确认，服务普通重启、新浏览器读取持久数据及历史导出。合成控制流与原生 W 必须分列，不新增在线模型请求。
5. **排版与边界。** 1024/1280/1440 输出设置标签不竖排、选项均可操作。Windows/WPS、真实邮件、物理设备/打印、在线仍未通过；API 两项自然 fetch 失败仍 OPEN，若独立复验自然出现，捕获当次 cause/监听/socket 时序，不靠重试放绿。

## 冷启动与原物

安装 Node 22.23.2 及锁文件依赖，本机需要 bwrap、pdfinfo、pdftotext、pdftoppm 和可用 LibreOffice/字体。使用本机只读 Office 安装，独立配置由转换器创建。

```bash
npm ci
npm run build
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
PAGINATION_EVIDENCE=/tmp/r35-attempt5-default node apps/web/e2e/fixtures/lessons-pagination/render.mjs
PAGINATION_LINES=20 PAGINATION_EVIDENCE=/tmp/r35-attempt5-long node apps/web/e2e/fixtures/lessons-pagination/render.mjs
```

目录必须是该验收者的新目录，不覆盖旧证据。第一条应 4 页无白页，第二条 8 页/尾页白；继承的长空间 fixture 只保证不增加页数，不能代替本轮的空间证明。fixture 的 lesson.json 为 R35 版本 7，真实 UI 保留库版本 8 改了课题标题；题与空间一致，详见 space-comparison 的 titleDifference。原版渲染使用 880e6e6 的 output.js，对照结果位于 `attempt5/render20-original/` 与 `render4-original/`；四行原版刻意红灯，二十行不得删掉最后三行。

真实 UI 独立保留库复制入口如下，源 `/tmp/teacher-r34-attempt5`已停写，含本轮新受理/下载历史；复制前确认根接收的是本轮最终完整 SHA。

```bash
cp -a /tmp/teacher-r34-attempt5 /tmp/r35-attempt5-copy
R34_PORT=49854 R34_DATA_DIR=/tmp/r35-attempt5-copy \
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 \
node apps/web/e2e/fixtures/materials-integration/server.mjs
```

在 `https://127.0.0.1:49854` 新 context 登录本地验收账号，进入“备课 → R35 丢响应后保留 → 输出”。本地账号来源仍是固定 R35 的 `local/browser-actions.txt` 注册步骤，口令不复制进新证据。也可独立注册并从真实 W 收录构造链，相关原生 UI 场景在 `materials-integration-navigation.spec.js`。

现有 `lessons-pagination/reproduce.mjs` 专验默认四行。二十行和本轮设置截图采集脚本保存在 `attempt5/run-sources/reproduce.mjs.txt`、`options.mjs.txt`；若需重放，将副本放入 `apps/web/e2e/fixtures/lessons-pagination/` 以保持相对 import，使用 `PAGINATION_ORIGIN`、`PAGINATION_EMAIL`、`PAGINATION_PASSWORD`、`PAGINATION_EVIDENCE`、`PAGINATION_LINES=20`。这些脚本的 `[8]` 像素期望只是已观察样本的记录，不是长空间可用性判据；最终由独立页图与 Office 检查决定。

实际 Writer 辅助脚本 `run-sources/inspect-office.py`、`space-proof.py` 连接本轮独立 UNO 端口 49755、Xvfb :154，验收者须替换为自己的端口/显示和配置。后者只在独立副本给已有空段落填标记，断言所有段落页码/纵坐标不变，并实际保存、关闭、重开。产品原物不改写。最终有效原版与下载物打印预览见 `office20-original-final/`、`office20-ui-final/`；三类默认打印预览见 `office-default-*/`。

## 回归、现场和未决

- 全 API 一次原入口：在隔离 network namespace 执行 `npm run test:api`，`NODE_OPTIONS=--import=<checkout>/docs/acceptance/evidence/R34/v1/restart-diagnosis2/trace-preload.mjs`，`R34_TRACE_DIR`指向独立已建目录。211/211 不关闭历史 OPEN；两个目标完整轨迹与索引在 attempt5/。
- E2E 8/8 的实际副本位于 `run-sources/attempt5-*.spec.js`，原始文件路径是 `apps/web/e2e/`。仅改证据路径、数据目录、固定端口，不改动作/断言；浏览器配置为单 worker、Chrome 152、180 秒超时、HTTPS 忽略本地自签。片段场景先运行 `node apps/web/e2e/fixtures/materials-questions/build.mjs`。
- 本轮正式制品索引 [manifest](attempt5/manifest.json)。API 新写旧路径的结果另存后恢复，不覆盖输入证据。首次导出脚本/Office 启动问题保留日志，报告明确区分采集故障与产品缺陷。
- 数据、浏览器回归库、Office 配置、转换临时目录仍保留在 `/tmp/teacher-r34-attempt5*`、`test-results/r34-attempt5/`及各 fixture 本轮独立目录，供未闭环项使用。没有把数据库、认证状态或产品密钥提交到 Git。
- 完成本轮后停止自己的服务、浏览器、Office/Xvfb，仅任务分支提交，未合 main/push/部署、未扩派业务 session、未发跨 session 消息。根接收后安排 R35；外层唯一回调。
