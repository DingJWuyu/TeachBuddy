# R33 attempt 2 接入

输入完整候选 `c47937c2d3ba4da9f01c44f8138e6e75a1c4c7ab`；本次组合 fixed point `9b0d09a9152d47f0039ca01bf16ff3beb938f757`。产品候选为 `93d6dd3d1f60c9ffb1c446b781d5b2c84bd161d0`，最终固定值以 [attempt2.md](attempt2.md) 为准。原 [integration.md](integration.md) 的公共 API、端口、迁移与 R34 清单保持；本轮未改契约和公共文件。

## 独立运行

从本 worktree 根目录运行，Node 22.23.2。`npm ci` 后运行 `npm run build` 和 `node apps/web/e2e/fixtures/materials-questions/build.mjs`。隔离服务：

```bash
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node apps/web/e2e/fixtures/materials-questions/server.mjs test-results/r33-attempt2/browser-data 48349
```

浏览器 `http://localhost:48349/fixture/session`，仍是 test-principal r33-a，不是正式登录。数据库与文件在本目录 `test-results/r33-attempt2/browser-data`；原来源 worktree 不启动、不写。后继必须用自己的数据目录和端口。交付时服务停止，未完成现场保留。

```bash
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node --test apps/api/test/materials-questions*.test.js
npx playwright test --config apps/web/e2e/fixtures/materials-questions/attempt2.config.mjs
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 npm run test:api
npm run build
```

E2E 的取消场景另外短暂使用 48350 和 `/tmp/r33-attempt2-cancel-*`，使用独立本地延迟 Provider 替身检查取消/迟到/重试。替身无网络模型实现、无密钥加载；其结果只计控制流，不计在线质量。其余页面服务无 Provider。Chrome 每次创建独立 context，不操作共享浏览器会话。

新增 F-obscured.jpg、I-clear.jpg、F-truncated.pdf、PS.pdf 分别来自固定 C21 的 F/page-2.jpg、I/page-2.jpg、F-truncated.pdf、PS.pdf。原字节哈希见 attempt2/inputs.json；原实验不变。旧 API/E2E 的证据输出已指向 attempt2，避免再运行覆盖首轮报告。迁移标识和数据库结构未变。

## 下游边界

- R34 继续拥有原 integration.md 的 5 项共享接线清单，尤其 6 个迁移 ID 断言、公共 handler/catalog/直接依赖和正式外壳。不得为总 green 删除 questions 迁移或减断言。
- R33 本地 T/W 评分以 [quality.md](attempt2/quality.md) 为准。W 达标，T 缺实际原图仍未达到联合门槛；不把图描述算成功。
- P/I/PS/E 的真实自动识别仍在线 BLOCKED。PS/F 的真实本地入口、原件保留、预览/损坏定位、补充与重试可单独消费，不等于在线提取 PASS。
- 本候选不注入生产 Provider；零新产品模型请求、零密钥读取。不读取 R34 活动分支，根固定本次交付后转交。

共享测试附加观察：最终全套另见 math-static-migration.test.js 重启后一次 fetch failed，单独复验通过。详情与归属见 attempt2.md，不将该不稳定结果隐藏为仅6项失败。
