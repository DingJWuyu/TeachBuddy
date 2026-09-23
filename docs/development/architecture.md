# 产品结构

实际产品由 `apps/web` 的 React 页面、`apps/api` 的同源 HTTPS 服务和 `packages/shared` 的共享代码组成。API 在开放端口前初始化模块目录并执行待运行的迁移；SQLite 保存账户和业务对象，受管理的文件目录保存上传与输出。浏览器通过 Cookie 会话访问 API。

## 模块边界

| 位置 | 责任 |
| --- | --- |
| `apps/web/src` | 页面、工作台外壳、六个业务模块与支持页面 |
| `apps/api/src/modules` | 题库、备课、资源、数学、班级与日程的业务接口 |
| `apps/api/src/workbench` | 身份、文件、作业、目录及跨模块公共能力 |
| `apps/api/src/agent` | 现有 Agent 运行接线；后续产品扩展暂停 |
| `docs/contracts` | API 运行时和测试读取的 schema、有效契约与样本 |

内容与文件的账户归属、版本冲突、幂等、软删除和引用恢复由服务端维护。页面取材和 Agent 写入应遵守同一业务规则。模块目录的静态组成由 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)约束。接口细节从 [契约目录](../contracts/README.md)进入，不从页面或原型反推。

## 部署边界

服务可同源提供构建后的 Web 和 API；生产路径要求 HTTPS、持久化 SQLite、持久文件目录及注册邮件配置。转换工具是本机依赖。目标 Word/WPS、课堂设备、iPad 与部署环境尚未完成验证，具体接续见 [当前状态](../plans/status.md)。
