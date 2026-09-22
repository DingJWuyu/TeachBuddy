# R34 attempt 3 固定组合与复现入口

限定集成接续与题库两项导航修复的 self 结果见 [attempt3](attempt3.md)；完整 R34 仍 BLOCKED，不是 R35 independent。

## 实际消费

| 输入 | 完整候选 | 产品 |
| --- | --- | --- |
| R34 attempt 2，已含固定 R31/R32及旧R33 | `f7ae8f866401520c45235af7143f4306704345c9` | `dc1afe54e2848920f459fffd12bc2c5015b9cd28` |
| R33 attempt 2 本地修复 | `cd31bf4f4d0bf5f7cd6f35cd1f912b81a16d680c` | `93d6dd3d1f60c9ffb1c446b781d5b2c84bd161d0` |

从 main-based `fdaa913ed12f483b0be33ef50c2b36ccfcd8545f` 的 `fix/r34-material-closure` 顺序组合两个固定输入；实际组合 fixed point 为 `ec3a44f024c5d18c13954fa9ee809ccbfb7a9a70`。两输入都是该 fixed point 的祖先，详见 `attempt3/composition.json`。没有读取或消费活动 C20-T-INPUT 分支。根 AGENTS/run-state、旧证据原样保留；来源 worktree 只读。

新增接线只包括 questions 前端的使用位置链接、成功反馈及 usage 刷新，公共外壳的返回题库现场，以及 lessons 对目标引用的滚动定位。已有三模块目录、四 handler、直接依赖、迁移运行和断言完整沿用固定 R34；R33算法仅通过固定输入消费，本轮未改写。

## 隔离启动与验证

```bash
npm ci
npm run build
R34_PORT=48446 R34_DATA_DIR=test-results/r34-attempt3/manual MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node apps/web/e2e/fixtures/materials-integration/server.mjs
```

访问 `https://127.0.0.1:48446`。real-auth、本地 fake-mail、自签 HTTPS；注册验证码只来自上述隔离目录的 `mail.json`。保持数据目录和端口不变可重新启动。此入口不注入 Provider，不是部署或真实外发邮件证明。

```bash
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 npx playwright test --config apps/web/e2e/fixtures/materials-integration/playwright.config.mjs materials-integration-navigation
node --test apps/api/test/math-static-migration.test.js
```

新浏览器测试自行创建独立 Chrome context、随机 HTTPS 端口、`test-results/r34-attempt3/` 独立数据库。只选择 `materials-integration-navigation`，不要为此回归重新运行全部旧实验。该测试写 `attempt3/`；正式接续时将输出另存新的 attempt，保留本证据。测试先关闭自身浏览器 context，再关闭服务，避免测试连接延长清理时间。

本轮已执行一次全 API 201/201。上游测试硬编码写旧 evidence 路径，执行前保存旧证据，执行后将本次制品复制到 `attempt3/api-artifacts/` 并恢复原字节。再次运行全 API 也必须保护旧证据。API集成24份输出的实际 manifest 路径在 `attempt3/api-full.log` 的 `R34_OUTPUT_MANIFEST`；本轮未重做全部输出视觉/设备实验。

## 实证和身份

- 浏览器4项：真实注册、页面保护头、原稿/校对/题目/备课真实 API；导航、草稿/搜索/面板现场、刷新返回；正常加入和丢响应按原键确认；W一题校对到DOCX。最终 `attempt3/browser-reviewed.log`。
- `attempt3/native-word-practice.docx` 来自真实 W 原稿，修改分母后保存/刷新/引用输出；检查5个OMML及修改后的`x+2`。只证明此接续切片，不重评分W七项、未检查目标Office GUI。
- 截图 `add-success-1440/1280/1024.png`、`usage-return.png`；对应视口无全页横向溢出。
- 全 API 包含已有 test-principal、故障 Adapter 和真实认证测试，其替身结果不计在线质量。本轮新增浏览器链仅 fake-mail 替代外部邮件，未新增 Provider 替身；丢响应由浏览器网络故障注入，服务真实提交。
- 最新隔离W数据库索引见 `attempt3/native-word-environment.json`。保留库、失败trace及中间现场位于本 worktree 的 `test-results/r34-attempt3/` 和 `test-results/r34-integration/`；服务与浏览器结束后停止。

C21关闭，零新产品模型请求、零产品密钥读取。P/I/PS/E在线、T缺图裁决、Windows/WPS与R35独立验收保持原归属。共享迁移偶发错误未复现，详见 [math-diagnosis](attempt3/math-diagnosis.md)，不因201/201消除此观察。不扩大到M42/教学/Agent，不合main、push、部署或通知业务session。
