# TeachBuddy 教师个人工作台

面向高中数学教师的个人教学工作台。首页和业务右栏共用一个 Agent，可查询、录入、改编题目并组织备课。

当前分支为 C26 作者候选，尚未合入 main，未通过 C27 独立验收。已集成固定 A11 认证产品和 B16 题库/备课，新增 pi 0.85.1、持久对话/草稿/引用、13 个共用业务操作、工具结果和写入核实。DeepSeek 与 GLM 均已用真实模型完成查找、复制改编、加入指定备课环节的业务链。详细版本、请求账、场景证据和局限见 [C26 作者回执](docs/acceptance/evidence/C26/v1/author.md)。

认证自验使用真实 Cookie、页面绑定及 HTTPS，邮件由本地替身接收。真实邮件和目标物理设备仍未通过 A12；模拟视口不是物理设备验收。其他四模块、材料提取、部署及完整 MVP 尚未交付。范围由 [PRODUCT_SCOPE](docs/PRODUCT_SCOPE.md) 拥有，编排状态见 [run-state](docs/plans/run-state.md)。

## 运行与复验

Node.js 22.23.2，首次 `npm ci`，随后 `npm run build`。API 需要独立 SQLite、同源 HTTPS 和认证配置，变量见 `.env.example`。模型配置仅由 API 进程读取 `COMMANDCODE_API_KEY` 和 `COMMANDCODE_BASE_URL=https://api.commandcode.ai/provider/v1`；白名单固定为 `deepseek/deepseek-v4.1-flash` 与 `z-ai/glm-5.3-flash`。缺配置时历史与草稿仍可用，发送禁用；不自动换模型。

本地独立复验可沿用作者保留库，启动入口和账户见 [C26 作者回执](docs/acceptance/evidence/C26/v1/author.md)。`npm run review:agent -- <独占数据目录> <HTTPS端口>` 服务构建产物，默认不发送邮件、不配置模型。常规测试不调用真实 provider。

| 命令 | 验证范围 |
| --- | --- |
| `npm run test:api` | 认证、工作台首流、迁移、幂等与 Agent HTTP/真实 SDK 集成 |
| `npm run test:e2e` | A11 真实 HTTPS 账户及首流回归 |
| `npm run test:agent` | Agent 恢复、隔离、事件、错误与请求上限，provider 使用明确替身 |
| `npm run test:agent:e2e` | 首页/右栏、草稿冲突、失败恢复、保留 live 库的浏览器读取；需要作者证据中的保留库 |
| `npm run build` | 静态目录、隔离 SQLite 迁移和生产 Web 构建 |

真实模型验证 runner 为 `apps/api/test/fixtures/c26/live.mjs`，须另有当次费用授权才执行，不属于上述测试。已执行请求的账本不可覆盖；只展示 provider 已报告 usage，实际费用与余额未知。

## 仓库入口

- `apps/web/`、`apps/api/`：真实前后端；`packages/shared/`：静态模块目录与公共常量。
- `prototype/`：交互参考，不是生产依赖，也不证明真实交付。
- [C26/C27 冻结任务包](docs/plans/tasks/agent-implementation.md)：本批边界与独立验收入口。
- [Agent 契约](docs/contracts/agent.md)、[工作台契约](docs/contracts/workbench.md)、[认证契约](docs/contracts/auth.md)：对应行为及唯一 schema 入口。
- [工作台设计](docs/WORKBENCH_DESIGN.md)、[设计验证规则](docs/rules/design-and-verification.md)、[CONTEXT](CONTEXT.md)：布局、现场保留和共同词汇。

原 B16 独立结论与 A12 本地 independent PASS 只在其固定输入和未受影响范围内沿用，本分支的接线与恢复以 C26 自验及后续 C27 为准。旧 Bearer API/部署说明和原型账户不作为当前生产入口。
