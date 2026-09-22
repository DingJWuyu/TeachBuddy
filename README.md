# TeachBuddy 教师个人工作台

本分支是 **M43 数学工坊与真实材料、教学记录的局部集成候选**，未合入 main，也未完成完整 MVP 验收。固定输入、self 结果、剩余门槛和 M44 复跑入口见 [M43 集成回执](docs/acceptance/evidence/M43/v1/integration.md)。本页只描述该候选，不更新主干、DAG 或独立验收结论。

`apps/` 包含真实认证与 SQLite 服务，以及题库、资源库、备课、数学工坊、班级教学和日程。数学工坊使用固定 M42 的公式、平面、立体、动态和 HTML 能力。备课通过 lessons v3 保存数学版本快照，可以从具体环节进入工坊、复用或另存作品并带回；旧 v2 遇到不可表示的数学内容会拒绝有损读写。教学记录消费真实数学链接端口，数学页装配各班反馈。

备课输出 DOCX/PDF，公式采用受控数学源，图形和动态作品采用固定海报，HTML 只保留标题及单独文件提示。动态和外部 HTML 可以下载为隔离演示文件。本地验证不等于 Windows、PowerPoint、WPS 或真实课堂设备通过。AI 输入现场可以保留，本候选未调用产品模型，未交付真实 Agent 验收。

## 本地运行

使用 Node.js 22.23.2。以下入口使用真实认证、fake-mail、自签 HTTPS 和独立数据目录，不发送真实邮件：

```bash
npm ci
npm run build
node apps/web/e2e/fixtures/math-integration/manual.mjs
```

终端打印随机 HTTPS 地址。测试账户 `m43@example.test`，密码 `math-password`。默认数据在 `/tmp/teacher-m43-manual`，可通过 `M43_DATA_DIR` 指定其他隔离目录。重启保留数据；停止进程后才复制数据库及 files 目录。不要把 fixture 当作部署入口。

Office 转换依赖 Linux bubblewrap、LibreOffice 与 PDF 工具，实际验证环境通过 `MATERIALS_OFFICE_ROOT` 指向独立安装，详见回执。没有该环境时不得把导出失败记为通过。

## 验证与边界

```bash
node --test apps/api/test/math-integration*.test.js
npx playwright test -c apps/web/e2e/fixtures/math-integration/playwright.config.mjs
npm run test:api
npm run build
```

迁移检查需要固定 P 保留库副本和由固定 M 候选建立的作品库；参数及准备步骤见集成回执。部分继承测试会写入其旧任务证据目录，全 API 和继承 E2E 应在回执指定的独立验证副本运行，避免改写旧证据。

完整范围见 [PRODUCT_SCOPE](docs/PRODUCT_SCOPE.md)，页面规则见 [设计与验证规则](docs/rules/design-and-verification.md)，原型仅是 `prototype/` 中的交互参考。R35 历史自然 fetch 观察仍 OPEN，完整 R35/M43/M44 门槛保留；M43 self 不代签 M44、T51/T54、真实邮件或物理设备验收。
