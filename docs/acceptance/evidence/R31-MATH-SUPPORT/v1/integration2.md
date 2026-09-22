# R31-MATH-SUPPORT attempt 2 接入

本候选把 M41 原生图形切片、R31 文件/内容、A11 页面身份和完整本地数学依赖装在同一版本，公共构建可通过。验证级别为 self。完整 M41 尚未完成，公式、业务 transport 和完整 MC09 由 M41 接续；M42/M43 门禁不变。旧 [integration.md](integration.md) 保留其原版本结论，本次接入以本页为准。

## 固定输入与组合

| 对象 | 完整版本 |
| --- | --- |
| 当前控制文档基线 | `0a1b432cb4f56a94ac242114f535936e6176bf17`，AGENTS.md 与 docs/plans 原样保留 |
| M41 产品 / 证据 | `6a54e55a36e9efec65381ad9ceaa7af0c8228f36` / `953840563d4689cdbefb8ddc43f559493e14e178` |
| 完整公共支持产品 / 证据 | `07aeddc3a15b332cc941a86c340147facdef1425` / `26c89fb40ece370c3b4b23079543766f9a2da428` |
| M40 冻结 | `1a5dd015863d749e5244346f4eaad24ac506670d` |
| 限定提案 / 独立依据 | `2e67961b01f4ce90ab07dad1feb823b1f595266d` / `3783208100703efc6b00f14eaf9709ff501705a2` |
| 引入组合基线 / 内部审查 fixed point | `4f0d6a9c9c28386297302b48c55bd6f82b4fb317` |
| 公共修复产品候选 | `7c6e7ade69a7e86cbfd8212def7a5620e8d857d6` |

消费完整候选及其祖先，不单摘末条提交。引入时先取公共支持的完整 apps/packages/scripts、manifest/锁和运行配置，再加入 M41 相对其组合基线的全部产品/fixture/测试增量及固定数学文档；两份旧证据树一并保留。没有从活动源树 HEAD 取产品。三个 math 业务目录、原 fixture、认证内部、文件/内容底座和冻结契约的 Git 对象核对见 [provenance.json](attempt2/provenance.json)。控制树和源树只读。

## 最短验证与原生运行路径

在完整候选的独立工作树中使用 Node.js 22.23.2：

```bash
npm ci
npm run build
node --test apps/api/test/r31-math-composition.test.js apps/api/test/r31-math-support.test.js
npx playwright test --config apps/web/e2e/r31-math-support.config.mjs
```

这条路径运行真实 A11 + fake-mail / 自签 HTTPS，使用随机端口和独立临时 SQLite/files，覆盖真实 math 原生保存及两次保留重启、公共文件身份和本地离线资产。不会发送真实邮件或调用产品模型；完成后测试清理自己的临时账户库。

现有 M41 原生界面仍可直接运行：

```bash
node apps/web/e2e/fixtures/math-static/build.mjs
M41_PORT=47411 M41_DATA_DIR=test-results/m41/data node apps/web/e2e/fixtures/math-static/server.mjs
```

打开 `http://localhost:47411/fixture/session`；另账户用 `?account=b`。停止后以相同 data-dir 重启可保留作品。这条原入口依然是 test-principal，浏览器 8 项通过只证明原生切片兼容组合，不证明真实页面身份消费或公式实现。

## 公共静态映射

`packages/shared/src/moduleCatalog.js#mathSupportCatalog` 为显式隔离目录，复用默认 questions/lessons 并增加真实 math 描述（`/math`、`requires: []`）。`apps/api/src/workbench/moduleImplementations.js#mathSupportImplementations` 指向原有 math 工厂和 `migrations.js`。Web 的 `resolveWorkbenchModules(mathSupportCatalog)` 可解析真实 `MathWorkbench` 页面，默认无参仍只返回原目录。

共同构建校验器检查默认目录与隔离目录，math 必须同时具有目录、API 实现映射和真实入口文件，Web 也参与投影验证。没有排除 math 目录、注册空实现或放松未知目录错误。真实 HTTP 回归验证工厂、迁移和文件端口确实可运行，而非只检查文件存在。

M41 的真实身份 fixture 可复用如下现成入口，无需复制认证或 math 服务：

```js
import { mathSupportCatalog } from '@refatos/shared';
import { mathSupportImplementations } from './apps/api/src/workbench/moduleImplementations.js';
import { createIntegration } from './apps/api/test/fixtures/auth-integration/harness.js';

const world = await createIntegration({
  directory: /* 本 fixture 独占的持久绝对路径 */,
  webDist: /* 本 fixture 构建产物绝对路径 */,
  workbench: {
    catalogOverride: mathSupportCatalog,
    extraImplementations: mathSupportImplementations
  }
});
// world.origin 是本次随机 HTTPS 地址；world.mailer 仅供测试读取验证码。
// 重启前 await world.close()，再次指定相同 directory，恢复后核验原作品/文件。
```

直接使用 `createApp` 时，同样传入上述 workbench 选项，并配置真实身份所需的 publicOrigin、验证码 secret、sendCode 与独立 SQLite/files，等待 `workbench.initialize()` 后接受请求。`mode: 'none'` 表示不启用测试身份，A11 提供实际 principal。可运行例子见 `r31-math-composition.test.js`；认证契约仍由原文件拥有。

这里没有改变默认目录版本或启用 lessons v3、classes/math 关联。正式 v3 目录与业务联动归 M43；生产缺四 handler 的拒启原样保留。隔离目录返回的版本沿底座投影，不是 M40 正式 ModuleCatalog v3 的交付声明。

## M41 精确接续点

| 位置 | M41 需要完成的适配 |
| --- | --- |
| `apps/web/e2e/fixtures/math-static/main.jsx` | 当前直接挂 MathWorkbench；真实身份入口应使用 AuthProvider/AuthGate，在账户内容挂载时绑定 `useAuth().request`，卸载清理。参考公共支持 fixture 与 WorkbenchRoot。 |
| `apps/web/src/features/math/api.js#mathRequest` | 当前裸 fetch 不携带页面头；改用 A11 request 或已绑定的公共 JSON transport，保留数学 Problem、幂等键、未知结果确认和账户代次语义。公共层不替 math 变换错误类型。 |
| `apps/web/src/features/math/index.jsx#runExport` | File 下载仍裸 fetch；接入 `workbenchBlob` 或等价认证字节请求，保留 Blob URL 与旧账户迟到响应丢弃。 |
| `apps/web/e2e/fixtures/math-static/build.mjs` | 公式接入时先调用 `prepareMathAssets()`，显式 `publicDir: path.resolve('apps/web/public')`；当前 fixture 不自动复制公共资产。 |
| `apps/web/e2e/fixtures/math-static/server.mjs` | 原手写 test-principal 覆盖目录可继续做原生回归；真实认证 fixture 改用本页显式映射和 A11 harness，不能把测试 Cookie 用作 MC09 证据。不要向 mathSupportCatalog 再追加 math。 |
| `apps/api/src/modules/math/render.js` 及 worker / 前端公式 UI | 当前公式明确 render-unavailable。消费已固定 MathJax 3.2.2 和本地中文字体，实现冻结公式行为并更新真实 rendererVersion；已存 revision 不重画。 |

Node 使用 `mathjax-full@3.2.2`；浏览器资源 `/vendor/math/mathjax-3.2.2/tex-svg.js`，中文 CSS `/vendor/math/noto-sans-sc/400.css`。Node 字体通过 `createRequire(import.meta.url).resolve('@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff')` 取得。包、复制脚本与 API 例子沿 [原公共支持说明](integration.md#包与离线资产)，本次重新核对 111 个输出资产，摘要见 [assets-sha256.json](attempt2/assets-sha256.json)。公共公式 smoke 不是 M41 的公式实现。

公共装配本次无未决契约冲突。M41 接完业务 transport、公式和完整原包后自行固定全项候选；材料四 handler、R35、M43 业务联动和认证外部邮件/目标设备各归原节点。本次不签完整 M41、R31、A12 或 M44 PASS。公共写者交回后停止写入，唯一通知由外层负责。
