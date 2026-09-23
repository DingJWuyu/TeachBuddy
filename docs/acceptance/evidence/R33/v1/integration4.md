# R33 attempt 4 固定组合与复现

本次仅为原 R33 零调用本地接续，级别 `self`。完整 R33 未通过；在线条件见 [attempt4](attempt4.md)。不改变公共 schema、目录、loader、锁、生命周期或其他业务。

## 固定组合

- main 基线：`598209b94c13e3f345638de298b0928388b3f9c6`。
- 固定产品输入：`6398bf2dae85d1872c929aa8ef32d5705d763687`，其中产品 `a0bde5546eeedf50498888da0ed9c5941fa1d76a`；未读活动来源分支。
- main-based 任务分支：`feat/r33-fragments`；无冲突组合点 `b938e473c45ca49fc2ae17fdd39c32815e2ec80b`。当前 AGENTS/run-state、接续提案和旧证据原样保留。
- 初审候选：`0675ef56f2425de6b020c73b7940d974a1fa7e58`；最终产品候选：`812da1091724d5536eb4a3fbcf2c47033fa64555`。双轴审查仅覆盖本次增量；两项修复与定向关闭见 `attempt4/internal-review.md`，不审全部旧产品。

## 启动与定向复现

Node 22.23.2；Chrome 152.0.7977.64；Linux。本轮独立端口 48449/48459、独立数据库及浏览器 context。正式产品 Provider 仍未注入。以下 fixture 为 `test-principal`，不能作为真实认证或生产部署证据。

```bash
npm ci
node apps/web/e2e/fixtures/materials-questions/build.mjs
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node apps/web/e2e/fixtures/materials-questions/server.mjs test-results/r33-attempt4/native-data 48449
```

浏览器打开 `http://localhost:48449/fixture/session`。T/W 原生及 F 保留链不注入 Provider。已保留数据库用于本任务重开；独立验收应另用空目录和自身端口。

```bash
node --test apps/api/test/materials-questions-fragments.test.js
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node --test apps/api/test/materials-questions*.test.js
npx playwright test --config apps/web/e2e/fixtures/materials-questions/attempt4.config.mjs materials-questions-fragments
npx playwright test --config apps/web/e2e/fixtures/materials-questions/attempt4.config.mjs materials-questions-local materials-questions-quality 'materials-questions.spec'
npm run test:api
npm run build
```

新 fragments 浏览器测试自行占用 48459 并关闭自身服务。E 选页测试只读固定外部原件，测试核对 SHA；原件缺失则显式 skip。它是 E 原件承载合成正文的控制流证据，不能计 E 内容分数。

**旧测试会写旧 evidence。** 执行前保存 `docs/acceptance/evidence/` 原字节，完成后把本次生成物另存并恢复原字节。本轮备份在 `test-results/r33-attempt4/old-evidence/`；新结果在 `attempt4/inherited-test-artifacts/`，恢复核对在 `attempt4/old-evidence-preserved.json`。新测试自身仅写 `attempt4/`。

## 组合需求与未决

无需共享 schema/迁移/装配变更。questions 自有任务 JSON 保存片段、机器投影、实际选页及来源；旧记录无新增必填公共字段。新处理结果只更新未修改的机器投影，人工版和已确认题保留。

本地 PDF 图关联复用已验证的长线条区域与原稿文字锚点思路，在本次上传字节和固定预览上重新裁图。只使用现有 Poppler、Sharp、bwrap；没有新增依赖或锁文件修改。扫描图没有可证明锚点时保留缺图疑点，不从模型描述猜框。若根要求当前无文字锚点的 I/PS 自动图关联进一步闭合，需要固定并由共享写者提供可用本地 OCR/布局依赖与其自身输入证据；本轮没有把旧实验 OCR 环境硬编码为产品依赖。

全 API 首轮出现资源用例和 math 旧库重启的 `fetch failed`，中间候选全量通过不消除此观察；最终候选再次复现，209/211 FAIL。日志 `attempt4/api-full-first.log`、`attempt4/api-reviewed.log`，归共享运行/重启拥有者；本 session 未修改或联络其写者。

结束仅在任务分支提交、保留未完成现场并停写；没有合 main、push、部署或业务 session 通信。外层唯一回调。
