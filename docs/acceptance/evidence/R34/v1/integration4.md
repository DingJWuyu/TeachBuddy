# R34 attempt 4 固定候选与复验入口

本轮只关闭 R35-LOCAL-001 默认四行空白尾页，结论为 [attempt4](attempt4.md) 的 self 切片，不是 independent 放行。

## 版本与写入边界

- main-based 起点：`a98f95a4dc1f241ceb7cb707ddd9c46dc1ffaf14`，分支 `fix/r34-output-pagination`。
- 固定产品：`6398bf2dae85d1872c929aa8ef32d5705d763687`，产品提交 `a0bde5546eeedf50498888da0ed9c5941fa1d76a`。
- 组合 fixed point：`4611f6a752533214b9e64c1664cf68bdac9a1efb`。以固定树组合，apps/packages/scripts及依赖清单与6398bf2完全相同；不是活动分支合入，也不声称6398bf2是该提交祖先。
- 根 AGENTS、run-state、获准新DAG及起点已有计划/旧证据原样保留，只补入固定产品缺少的任务文件/旧证据。
- 修复代码：`2d2e2189445b6c962cb1501d16edea1aa1ffcce4` + `00d1c5630f044c299dd5eeedadc81cff620aca63`；后者为最终代码。完整候选为包含本文件及 attempt4 证据的提交，最终回执给出其完整 SHA。
- fixed point 后仅 `lessons/output.js`、`apps/web/e2e/fixtures/lessons-pagination/` 和本轮证据写入。无共享运行、math、目录、依赖锁或契约修复。独立报告4c4b689只读消费，来源 worktree 未改。

## 冷启动快速回归

fixture `lesson.json`逐字来自固定R35的`local/output-lesson.json`（保存版本7）；三张PNG按其fileId从保留库副本读取，内容为真实W题图。它不需要账号、源数据库、在线模型或密钥。输出目录必须使用新的本轮临时目录，勿覆盖已提交证据。

```bash
npm ci
npm run build
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
PAGINATION_EVIDENCE=/tmp/r34-pagination-check node apps/web/e2e/fixtures/lessons-pagination/render.mjs
PAGINATION_LINES=20 PAGINATION_EVIDENCE=/tmp/r34-pagination-check-20 node apps/web/e2e/fixtures/lessons-pagination/render.mjs
(cd apps/api && node --test test/materials-lessons.test.js test/materials-integration.test.js)
```

需要系统 `bwrap`、`pdfinfo`、`pdftotext`、`pdftoppm`及本机 Office/字体。第一条渲染应四页无纯白；第二条是既存长空间不退化边界，允许基线的第8页纯白，绝不代表该问题关闭。`PAGINATION_KIND=handout`、`PAGINATION_ANSWERS=1`、`PAGINATION_NOTES=1`可重跑受影响过滤组合。渲染器真实调用产品输出/转换，身份在这一快速 seam 不适用；真实 UI 链另列如下。

## 真实用户入口

保留隔离数据 `/tmp/teacher-r34-attempt4`，来自只读复制 `/tmp/teacher-r35-local-retained-copy`，本轮已在副本生成新输出。源目录保持不动。端口49644、独立浏览器context；Office独立端口49645、Xvfb `:144`、配置 `/tmp/teacher-r34-attempt4-office3`。

```bash
R34_PORT=49644 R34_DATA_DIR=/tmp/teacher-r34-attempt4 \
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 \
node apps/web/e2e/fixtures/materials-integration/server.mjs
```

打开 `https://127.0.0.1:49644`，使用该本地验收账号真实登录；进入“备课 → R35 丢响应后保留 → 输出 → 练习 → PDF”，保持答案/注记关闭、全部环节、备用不选、作答4行，点“保存并生成”。新文件四页，第4页含第六题题图及作答区。不要以总页数必须降为3作为判据。

自动重复同一真实入口时，将本地账号邮箱/密码放入 `PAGINATION_EMAIL`、`PAGINATION_PASSWORD` 环境变量，不记入日志；账号出处见固定R35本地验收的`local/browser-actions.txt`注册步骤。脚本新建浏览器context并重新登录，不读取来源浏览器状态。

```bash
PAGINATION_ORIGIN=https://127.0.0.1:49644 \
PAGINATION_EVIDENCE=/tmp/r34-pagination-ui-check \
node apps/web/e2e/fixtures/lessons-pagination/reproduce.mjs
```

`PAGINATION_KIND=handout` / `PAGINATION_FORMAT=docx`用于受影响另外三输出。DOCX下载后真实Office转换再验页，不用OOXML计数冒充实际渲染。脚本依赖本机 `/opt/google/chrome/chrome`，结束关闭自己的浏览器。

## 原版对照与归属

`red-confirmed`是在工作区恢复 fixed point 的唯一输出文件并重启服务后，用最终同步策略采集的新受理/新下载；随后恢复最终输出代码重启，`ui-final-candidate`为最终代码的新受理/新下载。固定保存版本、四行和默认过滤完全一致。快速 `render-red` 与 `render-final` 另提供可重建的相同fixture对照。

根可在独立checkout运行fixed point与最终候选，使用新数据副本/端口/输出目录复验；不要消费本轮或其他session的活动分支。旧共享运行问题继续由外层既定独占写者处理。本轮只交self、固定代码和完整候选，提交后停写，独立复验/目标设备及唯一通知由根安排。
