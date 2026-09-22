# M41 attempt 2 接续入口

本候选完成隔离数学模块的公式、平面和空间制作、源保存、历史读取及 PNG/SVG/JSON 下载。真实身份消费 A11；邮件为 fake-mail，自签 HTTPS。自验和未决边界以 [attempt2.md](attempt2.md) 为准，旧 author/integration 报告保持原结论。正式目录 v3、四个材料 handler、跨模块联动和部署仍不属于此候选。

## 固定版本

| 对象 | 完整 SHA |
| --- | --- |
| 新分支起点 main | `309d62674e4ef26582932ad7578ab307a4d9423a` |
| 完整公共组合 / 其产品 | `02340eb972d68221bde94976c0da5fa90648de89` / `7c6e7ade69a7e86cbfd8212def7a5620e8d857d6` |
| 实现前完整引入提交 / 内部审查 fixed point | `97d466c307a5cd18063a5b78a047980a5b78720d` |
| M40 冻结 | `1a5dd015863d749e5244346f4eaad24ac506670d` |
| 限定依赖提案 / 独立依据 | `2e67961b01f4ce90ab07dad1feb823b1f595266d` / `3783208100703efc6b00f14eaf9709ff501705a2` |
| 本次最终产品 | `c3ab0dacd1ff172d8557117f028ebdd805235d41` |

完整引入的 292 个路径逐 blob 对齐公共组合；当前 main 的 AGENTS/docs/plans 原样保留。M40 任务包 README/M41 从固定 Git 对象读取，不以当前控制树缺文件认定缺契约。来源与保护目录核对见 [composition.json](attempt2/composition.json)。后继应消费本次完整证据提交及祖先，不只摘公式实现或审查修复。

## 真实运行与迁移

在本候选 worktree 根目录使用 Node.js 22.23.2：

```bash
npm ci
node apps/web/e2e/fixtures/math-static/build.mjs
M41_DATA_DIR=test-results/m41/manual node apps/web/e2e/fixtures/math-static/real.mjs
```

入口在终端打印为 `https://127.0.0.1:<随机端口>`。Web、认证、math 和 File API 同源。浏览器接受本地自签证书后，以 fixture 账户 `math-fixture@example.test` / `math-password` 登录。这是独占隔离库的公开测试账户，经真实注册和激活服务创建；没有真实邮件或产品模型请求。CLI 的 fake-mail 仅用于该账户初始化，不提供通用人工收码界面。浏览器自动验收直接从同一 harness 读取测试邮箱。

按 Ctrl+C 停止，再用相同 `M41_DATA_DIR` 启动，数据保留，HTTPS 端口可改变。手动入口已实测首次 45535、重启 43289，原账户仍能登录。真实浏览器测试、API 两次重启测试各使用独立临时目录及随机端口，不连接源树或用户现有材料页面。

迁移仍为 `apps/api/src/modules/math/migrations.js#math_001`，由既有 workbench runner 在接受请求前应用。SQLite 中 `math_works/math_revisions/math_exports` 与 File 底座共同持久；备份要保留整个数据目录，包括 `workspace.sqlite` 和相邻工作台文件目录。迁移不重写旧 revision、海报或幂等回执。旧 R31 库迁移、已含 M41 库两次重启均有测试。

原生回归入口保留：

```bash
M41_PORT=47411 M41_DATA_DIR=test-results/m41/native node apps/web/e2e/fixtures/math-static/server.mjs
```

访问 `http://localhost:47411/fixture/session`，账户 B 用 `?account=b`。仅此入口是 test-principal；它重定向到显式 `?testPrincipal=1` 的原生回归挂载，不能作为 MC09 身份证据。原有 HTTP 测试端口为 47412、47414、47415，原生浏览器配置使用 47413。

## 验证命令

```bash
node --test apps/api/test/math-static*.test.js apps/api/test/math-contract*.test.js
npx playwright test --config apps/web/e2e/fixtures/math-static/playwright.config.mjs
node apps/web/e2e/fixtures/math-static/build.mjs
npx playwright test --config apps/web/e2e/fixtures/math-static/real.config.mjs
npm run test:api
npm run build
```

两套浏览器配置共覆盖 `math-static*.spec.js`：原生配置排除真实身份 spec，真实配置只运行该 spec。设置 `M41_EVIDENCE_DIR` 可选择公式 API/真实浏览器输出目录。正式证据在本目录 attempt2/，不使用旧报告中的截图替代本次输出。冷浏览器禁网打开真实下载 SVG，不能外推 Windows/Edge、PPT/WPS 或触屏兼容性。

## 接口与渲染消费

- `apps/api/src/modules/math/index.js#createMathModule({db,mutations,files,content})` 及 `service.js` 提供统一 HTTP/port 路径。`/api/modules/math/v1/works` 的方法与 DTO 来自冻结 `math.openapi.json`，没有平行 schema。
- `port.operations.<operationId>({principal,key,input,id,query})` 供可信调用者使用；`getWorkVersion` 的 `query.version` 为整数。同步 `readForReferenceV1`、`readForTeachingLinkV1` 和异步 `operations.listWorks` 均有实际结果。成功/失败示例见 [provider-fixtures.json](attempt2/provider-fixtures.json)，其中生成 ID 属隔离测试库，不能作为生产种子。
- Web `MathWorkbench` 默认从 `useAuth()` 消费 request，按 accountKey 挂载独立账户现场；`api.js#createMathClient` 同时处理 JSON 与 File Blob、页面头、请求键、取消和结果未知。卸载及账户代次守卫丢弃迟到回包。正式外壳接入时挂在已有 AuthProvider/AuthGate 内。
- 文件下载仍为 `/api/workbench/files/{id}/content`，经同一 A11 transport；附件保护由固定 R31 File 层拥有。SVG 以图片显示，不注入主页面 DOM。
- `packages/shared/src/math/formula.js` 拥有公式检查、SVG 排版和字体内嵌；表达式与 native 图形继续使用 `expression.js/graphics.js`。Node MathJax 与浏览器本地发行版只启用 base/ams；无 autoload/require/HTML 注入包。
- 本次 `rendererVersion=math-v2-mathjax3.2.2-noto-sc5.2.9-native`。公式、原生 SVG 内嵌 Noto Sans SC 5.2.9；PNG 栅格化前注册同一字体。公式始终透明，中文说明按 includeCaption 进入输出；无效公式保存原文并置 invalid/null poster，仅允许源码导出。字体或渲染服务故障不伪装成用户语法错误。
- 已保存 revision 的源、rendererVersion 和海报保持不变。当前静态导出按指定 revision 的源生成；本次修正全无定义区间消耗采样预算的问题，字体发行标识已更新。后继修改渲染器时必须继续保留旧 revision/海报，不回写历史。

## 公共归属与 M42 条件

1. **A11 公共认证缺口**：退出最后一个会话后，Cookie 容器被清除；不刷新同页再次登录/注册得到 `browser-context-required`。页面提示刷新，刷新后登录成功，证据见 [auth-bootstrap-boundary.json](attempt2/auth-bootstrap-boundary.json) 和截图。归 `apps/web/src/features/auth/AuthProvider.jsx#logout` 与后续入口 bootstrap 的拥有者。本次没有写权修改认证。数学 MC09 已用真实过期、同账户恢复、同文档新账户和迟到 File 回包验证；本报告不宣称 A12 或完整认证 PASS。
2. **README 同步**：固定公共 README 第 12/16 行仍描述 M41 待接状态。README 不在本次新增写权，公共装配者下次接入应将该行改为“公式、native 静态作品及页面身份消费已完成 M41 self；完整产品/独立验收仍待后续”，并将运行说明指向本页。当前业务事实以本次回执为准。
3. **M42**：外层消费完整产品/证据 SHA，确认本 session 已停止三个 math 目录写入后，可顺序接手共用骨架。回归本页全部 M41 测试；dynamic/html 当前仍明确不可用，由 M42 实现。内部 self 不替代 M44 independent。
4. **M43**：继续等待完整 M42 和 R35 independent PASS 受测候选，以及公共装配独占权。材料四 handler、目录 v3、备课和教学联动、生产部署及目标设备门槛不变。

仅提交本分支；未合 main、push、部署、读取密钥或调用产品模型。唯一通知由外层负责。
