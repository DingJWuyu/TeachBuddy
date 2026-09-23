# RESTORE-SHELL@1 / attempt 3

结论：**PASS，实施者自验**。RUI-01/02/03 均已复现并完成定向验证，候选尚未部署。

```yaml
task: RESTORE-SHELL@1
attempt: 3
role: implement
verification_level: self
status: PASS
finished_at_utc: "2026-09-23T08:20:01Z"
session_id: unavailable
runner: "Codex / gpt-6-astra / high（用户指定）"
skills_used: [diagnosing-bugs, writing-for-agents]
base_revision: 325fba2abc29f5326142eb58dd8175451ce24f80
result_revision: 3ca87b08102e039e7cf6389db3cf42c3016072e5
review_target: {fixed_point: not-applicable, commit_range: not-applicable, standards: not-applicable, spec: not-applicable, aggregate: not-applicable}
internal_reviewers: []
identity_mode: real-auth / isolated HTTPS + SQLite / in-memory mail sink
open_items: []
failure_owner: null
authorization_used: "用户 RESTORE-SHELL@1 attempt 3：本树前端、必要 E2E、增量提交与回执"
next_condition: "维护者接收固定候选，负责更新原入口；按本回执定向独立复验"
```

`result_revision` 是包含全部产品和 E2E 改动的固定提交；后续证据提交只增加本回执与截图日志。基线来自用户指定在线 SHA，独立报告受测版本为 `3dcaa5e18d7545a22ae13330e571edc82d8a42ad`。

## 三项结果

| 编号 | 结果与证据 |
| --- | --- |
| RUI-01 | **PASS**。390×844 抽屉恢复为 x=0、y=0、326×844；账户行 y=76、学期按钮宽 301、工作台标题 y=312；顶栏操作间距 8px。逐项与运行中的原型一致。[产品抽屉](attempt3/after/product-narrow-nav.png)、[原型抽屉](attempt3/after/prototype-narrow-nav.png)。窄屏五模块进入后自动收起，无页面横向溢出。 |
| RUI-02 | **PASS**。复用原型首页容器、标题、段落、输入区与建议按钮的间距和尺寸，恢复 29×29 方形 SVG 箭头及新会话工具显隐。1680×910 输入框 y=445.21875、680×136；390×844 为 y=337.4375、352×136、标题 23px，与原型一致。[桌面产品](attempt3/after/product-home-1680.png)、[桌面原型](attempt3/after/prototype-home-1680.png)、[窄屏产品](attempt3/after/product-home-390.png)、[窄屏原型](attempt3/after/prototype-home-390.png)。建议语会等待真实草稿就绪再写入和聚焦，切模块返回保留输入。[实际输入](attempt3/after/narrow-home-input.png)。 |
| RUI-03 | **PASS**。搜索弹层打开时读取现有班级与备课列表接口，分区筛选真实名称，结果进入对应 ID 的详情页。通过 UI 创建、保存、刷新后检索两类数据，桌面点击和窄屏键盘选择均通过。[班级结果](attempt3/after/search-class.png)、[班级详情](attempt3/after/search-class-open.png)、[备课结果](attempt3/after/search-lesson.png)、[备课详情](attempt3/after/search-lesson-open.png)、[窄屏搜索](attempt3/after/narrow-search-lesson.png)。单接口失败保留另一类结果、显示失败并可重试，恢复后可继续检索。[失败反馈](attempt3/after/search-partial-error.png)。 |

实测坐标、尺寸、字号、实际 API 路径与状态见 [results.json](attempt3/after/results.json)。已实际打开用户图 `/tmp/codex-clipboard-TtOMEv.png`，并查看以上原型/产品截图。原型静态示例数据未进入产品，侧栏底部 AI 入口继续排除。

## 验证与复现

先在固定基线运行真实注册、首页对照、创建班级与备课并检索的最小浏览器流程，三个编号均失败：[复现日志](attempt3/before.log)、[复现数据](attempt3/before/results.json)。根因分别是外壳末尾响应式覆盖、另写的首页间距与字形发送按钮、搜索仅过滤静态模块。

同一 Chromium，桌面 1680×910、窄屏 390×844，等待字体和有限动画结束后截图。产品使用本树生产构建、随机 loopback HTTPS 端口、独立临时 SQLite；验证码仅在进程内存捕获，无真实邮件。浏览器操作使用既有 Playwright E2E 路径。最终定向流程和导航退出流程均退出码 0，无页面异常。

| 检查 | 结果 |
| --- | --- |
| `npm run build:web` | PASS，[构建日志](attempt3/build.log)；保留既有 >500kB chunk 提示。 |
| `apps/web/e2e/restore-shell/attempt3.mjs` | PASS，[定向日志](attempt3/after.log)。包含几何对照、真实持久化搜索、详情路由、失败重试、无结果、窄屏导航及草稿交互。 |
| `apps/web/e2e/restore-shell/remaining.mjs` | PASS，[回归日志](attempt3/regression.log)。桌面反馈/教程/隐私、通知进入日程、通知和模块真实 `dragAndDrop`、学期保存、模块导航、区域滚动、窄屏反馈、首页输入保留。 |
| `apps/web/e2e/restore-shell/verify.mjs` | PASS，[导航及认证日志](attempt3/navigation.log)。五模块、日程、帮助/更新日志/设置、注册、刷新及退出。 |
| `git diff --check` | PASS。无临时调试代码。 |

从仓库根目录，安装依赖并构建后，启动独立原型服务，再运行定向 E2E：

```bash
./node_modules/.bin/vite prototype --host 127.0.0.1 --port 4198 --strictPort
```

另一个终端：

```bash
mkdir -p /tmp/rs3
TMPDIR=/tmp/rs3 PROTOTYPE_ORIGIN=http://127.0.0.1:4198 SHELL_EVIDENCE=/tmp/rs3/check node apps/web/e2e/restore-shell/attempt3.mjs
```

## 范围与局限

- 仅修改 `chrome/Home.jsx`、`chrome/TopbarSurfaces.jsx`、`chrome/chrome.css` 及新增定向 E2E。后端、契约、认证、产品 Agent、原型及其他任务树均未修改。`AGENTS.md` 原有未提交改动保留且不入库。
- 认证像素、找回/重置、桌面未改弹层的原型对照沿用既有独立报告的通过证据；本轮只补受影响回归，未重跑全后端和所有业务功能。
- 搜索使用现有 active 列表，覆盖模块入口、活动班级和活动备课名称；不扩展全文索引、已删除资料或其他业务实体。
- 首页真实草稿中的模型选择、保存状态、引用及 AI 不可用反馈继续保留，因此有真实状态时输入区可以比空首页更高。没有调用模型验证暂停中的 Agent runtime。
- 浏览器窄屏验证不等于实体触屏拖放验证；拖放通过证据来自桌面 Chromium。尚无独立验收签字。
- 未操作或重启 50880、未接触用户库或 preview、未联系其他 session、未合并 main 或推送。README 的在线状态继续保持，部署由维护者负责。本任务临时服务、隔离库及无用失败截图在完成后清理，正式前后对照证据保留于本目录。
