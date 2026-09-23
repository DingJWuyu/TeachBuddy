# MANUAL-MATH@1

- 角色：implementation；Codex / gpt-6-astra / low；attempt 1。
- 结论：PASS，verification_level=self。本机既定数学手动范围已完成，非独立验收。
- 固定起点：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 产品提交：`d38f956eaae985679751c78f54e5627dca639e92`。
- 最终产品候选：`38ab193f98b218bb538f437ac1ca255945553ae5`，补充对象重名保护，分支 `feat/manual-math`。
- 完成时间：2026-09-23 05:42:59 UTC。
- 身份：真实 Cookie 注册登录，隔离测试邮件适配器；数据库、文件与临时目录均为本树测试数据，服务使用随机端口。
- 技能：writing-for-agents。未调用内部助手或独立 code-review；session ID unavailable。

## 实际能力与结果

| 页面操作 | 结果 |
| --- | --- |
| 输入公式、中文说明，保存、重开、继续修改 | 真实服务保存；保库重启后读回并保存第二版 |
| 函数、圆/椭圆、线段、多边形、文字标注 | 手工制作非默认图形，保存重开；PNG/SVG实际下载，PNG透明通道检查通过 |
| 空间点、棱、标注、线型、投影 | 自定义点与棱；改名同步棱端点，删点清理关联棱；保存重开并导出 |
| 空白动态制作、参数、拖动点、步骤 | 新建为空白；二次函数是可选起点。新增/改名/删除参数同步表达式、标签、步骤与拖动；范围变化按最近刻度调整步骤值 |
| 参数编辑现场、步骤文字 | 未应用的参数编辑保留到刷新，保存前要求应用；步骤标题与多行说明可编辑，保存与离线展示一致 |
| 动态对象编辑 | 新增对象加入步骤；改名更新引用；移除清理步骤/拖动；绑定自动设置点坐标。真实鼠标拖点和数值输入通过 |
| HTML导入修改保存与下载 | 导入自包含HTML，编辑源码、保存重开；页面隔离预览与断网离线按钮交互通过，沿用1 MiB/UTF-8边界 |
| 从备课进入并带回原环节 | 保留未提交课题草稿，将已保存作品插入原环节；刷新后关联仍在 |

作品操作沿用已有持久版本、另存、删除恢复与隔离机制。本次原始阻断是“添加参数后保存”返回422，新增真实页面回归已转绿。

## 检查与证据

- `apps/web/e2e/manual-math.spec.js`：7/7通过，覆盖上表；最终参数边界收尾后定向复跑动态2/2通过；新增对象重名保护先红后绿1/1，共8个业务场景。
- `apps/web/e2e/math-dynamic.spec.js`：2/2通过，包括真实拖动、键盘、服务重启、冷浏览器禁网下载，以及参数改名不误改科学计数法。
- `apps/api/test/math-dynamic.test.js`、`math-contract.test.js`：2/2通过，含实际HTTP、版本、关系校验和重启。
- `math-integration.spec.js` 的 `dynamic and exact external HTML`：系统Chrome离线集成场景通过。
- `npm run build` 与 `git diff --check` 通过；最终重名保护提交前再次完成`build:web`。构建仍有既有的大于500 kB前端chunk提示。
- 浏览器：主业务E2E使用Playwright配套Chromium 153.0.8010.12。系统Chrome 152.0.7977.64的嵌套srcdoc框自动化定位不稳定，实际截图有内容；改用配套浏览器完成该场景，未将此定位失败当成产品通过。
- 截图：[动态编辑](artifacts/dynamic.png)、[空白制作](artifacts/from-blank.png)、[平面](artifacts/plane-page.png)、[空间](artifacts/space-page.png)、[备课返回](artifacts/lesson-return.png)。
- 实际PNG、SVG、离线HTML保留在本工作树 `test-results/manual-math/` 和 `test-results/manual-math-final/`；下载物校验见 [artifacts.json](artifacts.json)。大字体制品不进入Git，可通过测试重新生成。

复现主业务检查：先安装依赖并构建，使用本树专用TMPDIR。

```bash
mkdir -p .tmp-mm
TMPDIR="$PWD/.tmp-mm" npm run build
TMPDIR="$PWD/.tmp-mm" M42_EVIDENCE_DIR="$PWD/test-results/manual-math/artifacts" \
  npx playwright test -c apps/web/e2e/manual-math.config.mjs
```

## 公共接线与边界

- `docs/contracts/workbench/math/math.openapi.json`：Step新增可选`description`，允许无参数动态与无可见对象的文字步骤；旧源无需迁移。
- `packages/shared/src/math/presentation.js`：步骤说明以普通文字进入在线和离线运行器。
- API渲染器版本更新为`math-v4-mathjax3.2.2-noto-sc5.2.9-dynamic-step-text`；既有已保存版本/制品不重写。
- 已有备课接口与认证实现未改；原Agent能力和数据保留，本次未开发Agent/runtime/tools/skills/plugin/connector。
- `AGENTS.md`用户改动保留且未提交；未操作50880、其他工作树、main、用户数据库或密钥，未push、部署或外发邮件。

## 尚欠项

本机既定手动能力无已知未完成项。目标Word/WPS、课堂物理设备、iPad/大陆网络及正式部署按任务要求暂缓；不承诺任意外部HTML获得可视化编辑或解除联网依赖。独立验收及集成者的实际体验尚未执行。
