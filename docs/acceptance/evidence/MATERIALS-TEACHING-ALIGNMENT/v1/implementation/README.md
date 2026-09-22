# 独立复验入口

本目录是 `MATERIALS-TEACHING-FIX@1 / attempt 1` 的实现 self 证据。范围、版本、七项结果和未决归属见 [author.md](author.md)。独立验收在完整候选的独立 checkout 中运行，输出到自己的目录，不能重写本目录或 M43/R33/R35 旧证据。

## 启动真实页面

Node.js 22.23.2。使用较短的磁盘 TMPDIR，避免 Chrome Unix socket 路径长度限制。

```bash
npm ci
export TMPDIR=/home/liam_t/mta-review-tmp
mkdir -p "$TMPDIR"
SQLITE_PATH="$TMPDIR/build.sqlite" npm run build
MTA_DATA_DIR="$TMPDIR/manual" node apps/web/e2e/fixtures/math-integration/materials-teaching-manual.mjs
```

进程打印随机 HTTPS 地址。账户 `mta@example.test`，密码 `math-password`，真实认证、fake-mail、自签证书。首次通过真实 HTTP 创建 v1 手工题、含图片/表格/选项/公式与答案的题、复制题、纯文本正常导入确认题、真实数学公式作品与备课、两班混合来源记录。纯文本导入走本地解析，无模型 provider。重启复用已有账户和内容，不重复播种。目录必须独占；停止服务后再复制 SQLite 与 `files/`。

浏览器检查：班级教学选择一班，编辑记录，改变文字/日期/补充字段和 AI 输入，滚到关联处打开丰富题。核对正文、答案、图片、表格、公式，展开教学反馈，查看一班与二班；返回原记录核对现场。从反馈打开二班，核对独立原文及 math/lesson 链接。题库内切到其他题，反馈应跟随实际题目。用 1440×900、768×1024 两个视口，窄屏先关闭占满辅助区的 AI 面板再检查正文。

## 自动复跑

```bash
MTA_EVIDENCE="$TMPDIR/http" node --test \
  apps/api/test/teaching-time-classes-materials.test.js \
  apps/api/test/teaching-time-classes-materials-retained.test.js

MTA_EVIDENCE="$TMPDIR/browser" npx playwright test \
  -c apps/web/e2e/fixtures/math-integration/materials-teaching.config.mjs

node --test apps/api/test/teaching-time-classes-api.test.js \
  apps/api/test/teaching-time-classes-ports.test.js \
  apps/api/test/teaching-time-classes-migrations.test.js \
  apps/api/test/teaching-time-classes-math.test.js \
  apps/api/test/teaching-time-classes-math-upgrade.test.js \
  apps/api/test/workbench-catalog.test.js
```

本机 Chrome 路径由本次 Playwright config 固定为 `/opt/google/chrome/chrome`，其他机器须提供自己的等价浏览器配置。新测试可通过 `MTA_EVIDENCE` 独立输出；API 样本用真实 HTTPS 与真实认证，故障注入只替换公开提供方端口。浏览器丢响应/503/401通过网络边界注入，恢复使用真实后端。

保库测试会 `git archive` 固定组合 `2682475041aa187e3cd50ad743dc5e5bc243feda` 的实际旧产品，在旧产品上建库及成功回执，再复制给当前产品。须保留该 Git 对象。测试用自己当前安装的相同锁定依赖，未新增迁移；每次启动真实 HTTP。预期是旧库纯读不变，显式题目写入、记录写入及删除恢复各自升版，再两次重启保持。

如需复跑已保留的现场，从 [retained/original](retained/original/) 或 [retained/candidate](retained/candidate/) 复制 `workspace.sqlite` 与 `files/` 到自己的目录，通过原 M43 `manual.mjs` 或 `createIntegration({directory})` 启动。原保库账户为 `retained@example.test / math-password`。原 M43 manual 可能额外创建自己的测试账户，选择旧账户登录查看原对象，ID 与原键原体见 [retained.json](retained.json)。不要直接在证据源库上启动服务。提交的库只含 fixture 账户，未包含 TLS 私钥。

## 相邻回归与证据保护

R33 定向测试支持 `R33_LOCAL5_EVIDENCE`：

```bash
R33_LOCAL5_EVIDENCE="$TMPDIR/r33-api" node --test apps/api/test/materials-questions-local5.test.js
R33_LOCAL5_EVIDENCE="$TMPDIR/r33-ui" npx playwright test -c apps/web/e2e/fixtures/materials-questions/attempt5.config.mjs
```

继承 `math-integration.test.js` 和 `math-integration.spec.js` 会写 M43 旧相对路径，必须在自己的独立运行副本运行，不能在证据源工作区直接执行。只跑本次受影响切片：

```bash
MATERIALS_OFFICE_ROOT=/path/to/libreoffice-root node --test apps/api/test/math-integration.test.js
MATERIALS_OFFICE_ROOT=/path/to/libreoffice-root npx playwright test \
  -c apps/web/e2e/fixtures/math-integration/playwright.config.mjs \
  -g 'specified lesson section|old v2 unknown|scroll and selected'
```

本机 Office 只读安装为 `/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8`，沿 M43 交接使用，不代表其他 Office/设备通过。运行副本路径避免隐藏目录：本轮 `.work` 内的 webDist 经 `sendFile` 深链刷新被拒绝，移至非隐藏的独立目录后原场景通过，无产品修改。

红灯网络与截图见 [red-picker.json](red-picker.json)、[red-picker.png](red-picker.png)，仅换选择器时的保存422见 [red-save.json](red-save.json)。可将 fixed point 的 Web 独立构建后，以 `MTA_RED=1 MTA_BASELINE_WEB_DIST=/absolute/fixed/apps/web/dist MTA_EVIDENCE="$TMPDIR/red"` 运行新 E2E 的 `-g 'rich selection'`，预期因无法选择丰富题而失败。完整旧运行复现应同时使用 fixed point 的 API；本轮首次旧422是在任何产品修复前完成。
