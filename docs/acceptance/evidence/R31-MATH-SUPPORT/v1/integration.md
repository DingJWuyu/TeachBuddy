# R31 数学公共支持接入

本候选交付 M41 可直接消费的 MathJax 3.2.2、本地字体/离线资产和 A11 页面身份入口，验证级别为 `self`。公共支持已完成；M41 业务、完整 R31、正式部署、真实邮件及目标设备仍未完成。本 session 交回后停止公共写入，外层固定候选再交 M41 消费。

## 固定组合

| 输入 | 完整版本 |
| --- | --- |
| 本分支起点，编排文档保留 | `c85d073a9582b6aab19c5db66f83ec4fdc6ad355` |
| R31 文件/内容产品 | `5f696b8ce611e67d940ce149ce13946a50b65510` |
| R31 原 self 交接 | `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/{author,integration}.md` |
| A11 原样内部依赖 | `9ecabbf60cbbaecce2e9be8191d270068eb675cf` |
| A11 作者 / A12 本地独立依据 | `4f45b40a323ff3db56e39d647367269bee63c214:docs/acceptance/evidence/A11/v1/attempt3.md`；`aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md` |
| 公共支持授权依据 | `2e67961b01f4ce90ab07dad1feb823b1f595266d:docs/arch/math-foundation-dependency.md`；作者 `76151489f28cfe1ccaddd8afa28db3c613f3c6a5`；限定 independent PASS `3783208100703efc6b00f14eaf9709ff501705a2:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md` |
| M40 冻结 | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/plans/tasks/math/M41.md`、README 及所指契约/UX/架构 |
| 引入组合基线，内部审查 fixed point | `1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51` |
| **完整产品候选** | **`07aeddc3a15b332cc941a86c340147facdef1425`** |

固定输入通过 Git blob 消费，不跟随源树活动 HEAD。组合提交引入 R31 的 apps/packages/scripts/manifests，以及 A11 新增认证内部和适用公共装配。保留 R31 files/content、Document 组件和 production 拒绝，再在产品提交中补公共接线与迁移断言。消费完整候选，不单摘最后一条产品提交。冻结材料 schema 原样引入，未修改语义；M40 文档/契约仍按上表 SHA 读取。

[environment.json](environment.json) 固定认证内部、认证契约、math 三目录和编排文档未变的核对结果。[author.md](author.md) 拥有验证范围及内部审查结论。

## 包与离线资产

Node.js 22.23.2，在仓库根执行 `npm ci`、`npm run build`。锁文件由 npm 生成；不复用其他工作树 node_modules。

| 消费目的 | 实际入口 |
| --- | --- |
| Node 公式渲染 | API 直接依赖 `mathjax-full@3.2.2`，导入 `mathjax-full/js/mathjax.js`、`input/tex.js`、`output/svg.js`、`adaptors/liteAdaptor.js`、`handlers/html.js` |
| 浏览器渲染 | Web 直接依赖 `mathjax@3.2.2`；构建输出 `/vendor/math/mathjax-3.2.2/tex-svg.js`，同目录包含发行版惰性加载依赖及数学字体 |
| 浏览器中文字体 | `/vendor/math/noto-sans-sc/400.css`，引用同目录 `files/noto-sans-sc-chinese-simplified-400-normal.woff2` / `.woff` |
| Node 中文字体 | API 直接依赖 `@fontsource/noto-sans-sc@5.2.9`；`createRequire(import.meta.url).resolve('@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff')` 可传给 sharp `text.fontfile` |
| 构建入口 | `scripts/math-support/prepare-assets.mjs` 导出 `prepareMathAssets(destination)` 和 `mathAssetsDirectory`；Web prebuild/predev 默认生成 `apps/web/public/vendor/math/`，Vite 复制至 `apps/web/dist/vendor/math/` |
| 许可证和完整性 | 上述 MathJax、Noto 字体目录各含 LICENSE；111 个构建资产、26,883,364 字节的摘要见 [assets-sha256.json](assets-sha256.json) |

M41 独有 Vite fixture 应调用 `prepareMathAssets()`，并设 `publicDir` 为本仓库 `apps/web/public` 的绝对路径；也可把 `prepareMathAssets(destination)` 的目标设为其独有 public 目录中的 `vendor/math`。导出离线文件时使用相对路径复制同一发行目录，或由 math 模块按冻结设计嵌入需要的字节。禁止将本公共 smoke 的固定公式/图片作为业务实现。

浏览器先配置 `MathJax`，再加载本地 `tex-svg.js`，等待 `MathJax.startup.promise`。页面排版用 `typesetPromise`，Node 独立 SVG 用 liteAdaptor + TeX + SVG；实际例子分别在 `apps/web/e2e/r31-math-support.spec.js` 和 `apps/api/test/r31-math-support.test.js`。公式纯 SVG 路径可设 `fontCache: 'none'`。透明图、中文布局及作品输出规范由 M41 自己验证。

当前已有 KaTeX 仍供首流 Document 阅读使用，不替代 M40 指定的 MathJax。`@xmldom/xmldom` 通过根 override 固定为 `0.9.12`，修复 MathJax Node 间接依赖的审计问题；MathJax 本身保持 3.2.2。干净安装审计为 0 项。

## 页面身份与公共装配

默认入口为 `apps/api/src/app.js#createApp`。除显式 `nodeEnv='test'` 且 `workbench.mode='test-principal'` 外，均装配 A11 真实认证。真实模式使用 `workbench.mode='none'`，这里表示不启用测试身份，实际 principal 由 A11 返回。

1. 提供独立 `sqlitePath`、`workbench.filesDir`、精确 HTTPS `workbench.publicOrigin`、`authCodeSecret` 与 `sendCode` adapter。隔离验证可使用 A11 现有 fake-mail；它不产生真实投递证据。
2. M41 将真实 math descriptor 加入 fixture 的 `catalogOverride`，`requires: []`；在 `extraImplementations.math` 提供 `factory` 和 `migrations` 的 import thunk，分别导出 `createMathModule` 与 `migrations`。这只装配 fixture，不改生产目录版本。
3. `createApp({env, sendCode})` 返回 `workbench`；先等待 `workbench.initialize()`，再开放 HTTPS 服务。真实 `{db,mutations,files,content}` 由底座注入 math 工厂，math 迁移先于首次请求。
4. 也可传入 `createApp({env, workbench, sendCode})`。预构造 workbench 必须来自本候选，且 `trustedOrigins` 仅含相同 HTTPS publicOrigin。createApp 会把其 identity 对象绑定到真实 A11 resolver，已有 routers 同时使用该对象。不要把注入身份当作真实认证旁路。

真实文件路由为 `/api/workbench/files`、`/:id` 和 `/:id/content`，与 `workbench.files.store/read/open` 共用持久实现。Cookie 与 `X-TeachBuddy-Page` 必须同时有效，pending、未绑定页面、到期及撤销均不能授权。认证存储不可用映射为 503；来源/保护头错误为 403；跨账户文件按原契约 404。没有增加业务凭据或认证表实现。

Web 复用 `features/auth/index.jsx` 的 `AuthProvider`、`AuthGate`、`useAuth().request`。现有 `WorkbenchRoot` 已用它绑定 `bindWorkbenchTransport`；M41 独立 fixture 若绕开 WorkbenchRoot，应在认证内容挂载时绑定并在卸载时调用返回的清理函数。文件字节使用 `features/workbench/apiClient.js#workbenchBlob`；`materials/DocumentView.jsx` 的受控图片已接入它。multipart 上传使用同一 `request` 并携带幂等键，不手工指定 FormData 的 Content-Type。下载需认证 fetch 后生成 Blob URL，普通链接或 img URL 无法携带页面头。

可消费的真实接线例子是 `apps/web/e2e/fixtures/r31-math-support/main.jsx`，其 UI 仅验证现有 auth/files 公共接口，没有 math 或转换替身。`apps/api/test/fixtures/auth-integration/harness.js#createIntegration({directory,webDist})` 提供随机端口、自签 HTTPS、真实 auth 与 fake-mail，适合定向集成验证。其时钟固定且数据隔离，不作为运行部署入口。

## 迁移与重启

没有新增材料或数学迁移。底座保留 R31 `materials_files_001` 和旧模块 ledger；A11 原有认证迁移在同一 SQLite 库上执行，稳定 accountKey 与旧引用不改写。遇到 `auth_legacy_gaps` 仍按 A11 原约定拒绝启动，不能派生昵称或把测试账户自动转换成真实账户。

首次使用新空数据目录；重启时停止 HTTPS 服务并关闭 workbench，继续指定原 `sqlitePath`、`filesDir`、验证码密钥及 publicOrigin，不做 reset、不删除数据库。备份/迁移时同时复制 SQLite 与 files 目录。`workbench.initialize()` 可重复启动，迁移不重跑；session 恢复由当前 Cookie、页面绑定与 A11 restore 流程决定。

从固定 R31 旧产品验证迁移的直接命令如下，均在本 worktree 新目录执行：

```bash
mkdir -p .scratch/r31-math-old test-results/r31-math-support
git archive 5f696b8ce611e67d940ce149ce13946a50b65510 apps/api/src apps/api/package.json packages/shared docs/contracts/workbench/materials.openapi.yaml docs/contracts/workbench/first-flow.openapi.yaml package.json | tar -x -C .scratch/r31-math-old
ln -s "$PWD/node_modules" .scratch/r31-math-old/node_modules
R31_FIXED_ARCHIVE=.scratch/r31-math-old node scripts/math-support/verify-upgrade.mjs
```

archive 只运行固定旧产品来创建隔离库，随后当前候选真实登录并重启两次；不读取或修改原 R31 工作树。已验证旧文件原字节、题目同键回放、旧账户/布局/文件/业务行和旧迁移 ledger 不变，见 [upgrade.log](upgrade.log)。纯 `test-principal` 的历史数据仍属其原账户键，不借此宣称所有测试账号均可真实登录。

## 重验和剩余归属

```bash
npm ci
npm run build
node --test apps/api/test/r31-math-support.test.js apps/api/test/materials-foundation.test.js
npx playwright test --config apps/web/e2e/r31-math-support.config.mjs
A11_EVIDENCE_DIR=test-results/r31-math-support/app-evidence npx playwright test --config apps/web/e2e/auth-integration.config.mjs --grep '真实注册、Cookie'
```

production 启动必须继续报缺少四 handler；改成 development 不能作为部署。公共支持本轮没有未接输入；M41 必须在自己的真实业务路径重新覆盖 MC09、作品保存/历史/冲突/导出等全项。完整 R31 的转换 handler、正式装配及材料后继归原材料节点；真实邮件 A10-EXT-001、真实目标设备 A10-EXT-002、备份恢复撤销 A10-OPS-001 归原认证/交付拥有者。本回执不放行 M42/M43，也不代签完整 R31/M41/A12。
