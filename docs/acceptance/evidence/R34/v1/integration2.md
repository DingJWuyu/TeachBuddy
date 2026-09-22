# R34 attempt 2 固定材料组合接入

本候选把真实资源、题库与备课接到正式材料外壳。职责内共享注册、迁移清单及构建阻断已关闭；完整 R34 **BLOCKED**，未放行 R35。结果和归属见 [attempt2](attempt2.md)。前轮 author/integration 和原证据保留。

## 固定输入与运行身份

| 输入 | 实际消费完整 SHA | 产品 SHA |
| --- | --- | --- |
| R34 | `9269a3326ed300fc66aab5a31bb1ac9cff7b19d5` | `9767e4feeae24d6adabbe7b87ff4876b418fc80d` |
| R32 | `c074ad339ab2772446995153c7952028d30500d4` | `ac34ee0cca45b5ce6c11afa1259263ecf56342cf` |
| R33 | `c47937c2d3ba4da9f01c44f8138e6e75a1c4c7ab` | `5c42b24332671fa31e421a41a38309a7da64414a` |
| 共同 R31 | `2b6cbcda934057a89c0443437e03b2e30e850a8d` | `6225fc07a895113a667b5a41092a7a69e2f2fefa` |
| R30 | `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1` | independent 冻结 `88a89f00b78dd301ca9893a191277eb9970c4c18` |

组合 fixed point `aa7744ca1af4edf80a974e7429b7e72508db7af2`；最终产品 `dc1afe54e2848920f459fffd12bc2c5015b9cd28`。分支 `feat/r34-material-integration`，当前 AGENTS/run-state 保持原字节。源 worktree 只读；未消费 R33 活动修复、活动认证版本、其他 flow 候选。

浏览器使用固定 R31 的 **real-auth / fake-mail / 本地自签 HTTPS**，Cookie 与 X-TeachBuddy-Page 真实绑定。隔离 HTTP 24 输出测试使用 **test-principal / integration-a、integration-b**；这两种身份结果分列。所有材料 Module、File、Job、SQLite、Office 与输出字节均真实；本轮跨模块链没有 Reference Adapter 或 Provider 重放。全 API 中既有上游 Adapter 回归不计在线成功。

## 一步启动

在本 worktree，已安装依赖并完成 build 后：

```bash
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node apps/web/e2e/fixtures/materials-integration/server.mjs
```

首次准备：`npm ci && npm run build`。默认地址 `https://127.0.0.1:48436`，本地自签证书。真实注册/登录；发送验证码后读取 `test-results/r34-integration/manual/mail.json` 的 verificationCode，仅本机 fake-mail，不发外部邮件。数据在该 manual 目录，重启不清空。`R34_DATA_DIR` 可指定目录，`R34_PORT` 可指定端口，重启必须保持二者一致以恢复本地草稿/IndexedDB 未确认请求。Ctrl-C 停止本服务。

这个入口禁止 production，未注入 Provider，不读取产品模型密钥。生产组合现可装配四个真实 handler，缺项或 fixture 明确拒启；该门禁检查不证明真实 SMTP、公开 TLS、线上 Provider 或部署就绪。

## 已装配接口

- 唯一静态目录 version=2：questions、resources、lessons。API/Web 映射、资源主路由/深链、侧栏、辅助栏随同接入，math 仍只在既有隔离映射内。
- lessons 显式依赖 `questions.readForReferenceV2`、`resources.readForReferenceV2`；事务内真实读取、固定快照及 usages 按冻结契约运行。没有跨模块读表。
- 唯一 `jobs.start` 合并 files.preview、questions.extraction/question-asset、lessons.export；生产在最终装配后检查四项，不以环境 fixture 冒充生产能力。无网络 Provider 时保留原稿并返回 provider-unavailable。
- ResourcesPage 使用 A11 页面绑定 request；lessons 沿公共绑定 transport，questions 保留其既有 useAuth.request。资源来源深链通过公共外壳适配模块现场，写入失败明确阻止打开，已消费的 history entry 刷新保留当前资源现场。来源页提供返回备课现场。
- 迁移运行顺序：materials_files_001、materials_jobs_001、questions_0001_question_items、questions_materials_001、resources_001、lessons_0001_lesson_tables、lessons_materials_001。三个指定测试增加实际清单，原账户/布局/数据保留断言不减。其他共享目录断言和 R32 隔离 fixture 只作目录版本机械适配。
- API 显式依赖 `@xmldom/xmldom@0.9.12`，维护根唯一锁。无认证、资源/题库/math 业务内部或冻结 schema 改动。

## 验证入口

```bash
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
node --test apps/api/test/materials-integration.test.js
npm run test:api
npx playwright test --config apps/web/e2e/fixtures/materials-integration/playwright.config.mjs
npm run build
```

API 集成测试打印 `R34_OUTPUT_MANIFEST`。用该路径验证输出角色并生成全部 PDF 页图：

```bash
python3 apps/web/e2e/fixtures/materials-integration/verify-outputs.py <打印的manifest.json> <新的证据目录>
```

浏览器测试使用 `/opt/google/chrome/chrome` 的独立 context，不占其他会话浏览器；普通进程测试独占 48437。全 API 的既有 R33 测试会写其旧证据路径，复跑时应先保存原证据，结果另存本 attempt 并恢复原字节；本次已经这样处理。最终材料实证在 [attempt2/](attempt2/)。未完成完整节点，独立数据库、日志、输出、失败制品和浏览器进度保留，现场索引见 `attempt2/browser-environment.json`、`process-restart.json`、`outputs/manifest.json`。

## 接续边界

R33 固定候选仍 self FAIL：T/W 七项质量、复杂公式/结构、F/PS/全交互矩阵及在线识别未完成。其题库“使用位置”当前仅文字，主动加入备课成功后原 index 的 onDone 关闭对话框，没有保留前往备课反馈；业务内部只读，本轮未代改。根收到后继完整固定候选后再交接复验。

C21 已关闭，本轮零新产品模型请求、零产品密钥读取。Linux Office 旧证据仅沿用到未变导出实现；本轮输出转换/页图真实复验，没有重新声称执行 GUI 编辑打印，更不代签 Windows/WPS。目标设备和 R35 独立验收归外层/R35。M42、教学、Agent 正式汇合另归后续节点。
