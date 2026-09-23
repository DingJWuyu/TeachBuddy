# MANUAL-RESOURCES@1 / attempt 2

状态：本机手动资源能力 self PASS，可集成。未合并 main，未部署或修改用户预览服务。实现与内部审查均为 Codex / gpt-6-astra / low；本回执不代表独立验收。

## 候选与公共改动

- 固定基线：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 产品提交：`7fc81363e368996496b00805b36806d96c4f0ce3`。
- 最终可集成候选：`f8da0116cf7b8288d3ced438cc37d45367c69cce`，包含上述产品提交及必要测试接线修正。
- 维护者按顺序引入这两个固定提交及本证据提交，不采用其他分支浮动 HEAD。注入的 `AGENTS.md` 不在提交内。
- 公共文件 `apps/api/src/workbench/files/conversion-worker.mjs`：允许普通 HTTP(S) 超链接，继续拒绝外链图片、对象、宏和危险归档；转换维持离线隔离。使用已声明的 `@xmldom/xmldom`，无新依赖或迁移。
- 资源 `Preview.jsx`：重试期间跟踪新任务；成功终态重新读取已提交页图，消除旧快照竞态。资源页面补齐分类入口和复选框对齐。
- 资源专用测试适配器暴露备课 v3 路径，测试拦截同步到 v3；不修改备课领域逻辑。README 已更新实际手动入口。

## 实际完成的手动功能

| 能力 | 验证范围与结果 |
| --- | --- |
| 真实文件上传、保存、内容预览 | PPTX、PPT、DOCX、DOC、PDF、PNG、JPEG、WebP 的真实页图与多页翻阅，本次浏览器通过 |
| 普通网页超链接 DOCX | 预览、下载逐字节一致、刷新重开，本次通过 |
| 分类、标签、备注、搜索 | 新建分类标签、改名与备注保存、按备注检索，本次通过；分类删除关联清理等未变路径沿用 R32 证据 |
| 备课复用与使用位置 | 真实登录后创建备课环节，从资源加入、返回使用位置，本次通过；备课内直接取材沿用 BUSINESS-MVP 已有证据 |
| 更新文件 | 保留条目名称、文件夹、标签、备注与关联；备课显示来源有更新；预览完成后保库重启仍能读取，本次通过 |
| 删除与恢复、布局 | 本次资源浏览器定向通过，包含 1440/1280/1024 宽度、辅助栏开关及无横向溢出 |
| 转换失败后重试 | 接续原 session 已通过的定向场景与 `browser/retry-recovered.png`；回归场景保留于 manual-resources.spec.js，未为报告重跑 |
| 旧 DOC 补充 PDF、阅读现场、未知写入结果恢复 | 沿用未变实现及 R32 的有效证据，不计为本轮新执行 |

未完成的本机手动功能：本次范围内无已知阻断。普通文件仍可保留和下载，不宣称所有任意格式都能生成内容预览。

限制与暂缓：旧 DOC 的对象/公式可能丢失，仍显示 `legacy-object-loss` 并支持补充 PDF，不宣称旧公式完整还原。转换中关闭服务按契约进入 interrupted，需要老师重试；保库重开通过结论针对已完成预览。目标 Word/WPS、课堂设备、iPad、大陆网络和正式部署环境尚未验证，按当前任务授权暂缓。

## 本轮验证

执行环境：本工作树隔离 SQLite/文件及本机 Chrome；真实业务测试使用随机 HTTPS 端口和测试邮件接收器，不发送外部邮件。适配器使用独占端口 49433。TMPDIR 为本树 `.tmp-mr`。Office 复用本机 C22 LibreOffice，Pandoc 复用 office-comparison 的 3.11 二进制，只读使用工具。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| `npm run build` | PASS；Vite 既有大 chunk 提示，未出现构建失败 | [build.log](build.log) |
| manual-resources，筛选“全部常用格式、网页超链接” | 2 PASS，36.6 秒 | [browser.log](browser.log)、[页面截图](browser/metadata-and-usage.png) |
| materials-foundation-preview，筛选 `rejects external 或 same conversion sandbox` | 2 PASS，外部关系、膨胀归档、超时、宿主文件及网络隔离 | [conversion-security.log](conversion-security.log) |
| 资源适配器构建 | PASS | [adapter-build.log](adapter-build.log) |
| materials-resources，筛选 `WB-M013-017、WB-M014 全格式、备课目标快速` | 3 PASS，23.0 秒 | [adapter-browser.log](adapter-browser.log) |
| `git diff --check` | PASS | 本轮提交检查 |

适配器测试临时配置仅覆盖端口 49433、本机 Chrome 路径和隔离数据库目录，运行后删除；保留的标准配置位于 `apps/web/e2e/fixtures/materials-resources/playwright.config.mjs`。通过 `R32_EVIDENCE_DIR` 可隔离截图，不覆盖历史证据。

测试条件说明：搜索列表断言先等待异步结果收敛；保库重启前确认新文件实际页图可见，再验证重开后可见。重启旧失败的隔离库中任务为 interrupted，与服务在转换中关闭一致；没有把这次失败冒充为预览持久化通过。

沿用证据：[R32 浏览器 10 场景](../../R32/v1/browser-final.log)、[R32 API](../../R32/v1/resources-api.log)、[基本业务回执](../../BUSINESS-MVP/v1/receipt.md)。这些是既有证据，不是本次重跑结果。

## Standards

只读内部 reviewer `/root/standards_review`：PASS，0 项发现。审查原候选全部 9 个文件，未发现明确违反注入 AGENTS、设计与验证规则或实现协议的变更，也没有值得单独整改的代码气味。对最终测试增量补审通过；v3 路径及隔离证据目录未削弱断言。reviewer 未运行测试。

## Spec

只读内部 reviewer `/root/spec_review`：PASS，0 项确定性发现。八格式、分类备注检索、备课复用和更新保留符合 PRODUCT_SCOPE 第4节；重试结果更新符合文件契约；超链接放行仍维持离线；旧 DOC 风险保留。最终测试增量补审 0 项发现。reviewer 未独立执行测试，不将本机通过推定为目标环境完成。

审查范围：`4db937daa4d5abd0a03f69917528665f94ebb001...7fc81363e368996496b00805b36806d96c4f0ce3`，再审测试增量 `7fc81363e368996496b00805b36806d96c4f0ce3...f8da0116cf7b8288d3ced438cc37d45367c69cce`。Standards 0 项，Spec 0 项，无待闭环发现。
