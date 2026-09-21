# TeachBuddy 教师个人工作台

送给一位中国大陆重点高中高一数学实习教师的个人工作台。目标是让他收集题目、组织备课、制作数学演示、复用资料、安排时间，并留下课堂反馈。首页是能操作这些内容的 Agent 工作区。

**当前尚未交付真实 MVP。** 仓库同时保留旧的可运行应用和新的交互原型，两者的进展不能混为一谈。已确认的完整交付范围以 [MVP 产品范围](docs/PRODUCT_SCOPE.md) 为准。

## 当前状态

下表描述 2026-09-21 整理时的代码状态，代码基线为 `911e624`。后续功能落地时同步更新本表；节点依赖和授权停止点见[交付 DAG](docs/plans/mvp-dag.md)，当前编排状态见[运行台账](docs/plans/run-state.md)，[路线图](docs/ROADMAP.md)提供状态导航。

| 部分 | 已有内容 | 距离目标的差距 |
| --- | --- | --- |
| `apps/web`、`apps/api` | 旧 React/Express 应用；Bearer 认证、密码找回、SQLite 账户与布局保存 | 未接入本轮已验收的账户 UI；业务模块为空，不是目标 MVP |
| `packages/shared` | 中性模块描述工具和空模块目录 | 尚无工作台业务接口定义；已有模块边界决议也未全部实现 |
| `prototype/` 账户入口 | 登录、注册、找回、会话恢复及失败分支已验收；此前行为缺口已补齐 | 使用模拟服务；认证契约尚未同步全部新增行为 |
| `prototype/` 工作台 | 既有侧栏与顶栏基线；已合入 Agent 首页、六模块及跨模块交互草稿 | 模块为内存数据，AI 为固定回复；模块稿尚未通过整体视觉与交互验收 |
| `docs/contracts/` | 认证契约、OpenAPI 和契约用例的部分约定 | 仍引用旧行为版本，状态为讨论中；没有工作台业务契约 |

登录注册由独立工作线负责。工作台对接登录后的账户身份与会话边界，退出按钮留在工作台设置中实现；当前原型没有退出入口。旧应用中的退出和 Bearer API 不代表新的交接契约已经完成。

## 从哪里开始读

| 要了解的内容 | 唯一入口 |
| --- | --- |
| MVP 必须做什么、哪些不做 | [PRODUCT_SCOPE](docs/PRODUCT_SCOPE.md) |
| 阶段、节点依赖、角色分工和授权停止点 | [交付 DAG](docs/plans/mvp-dag.md) |
| 当前编排状态和下一步 | [运行台账](docs/plans/run-state.md) |
| 页面共识、教师工作过程和跨模块联系 | [WORKBENCH_DESIGN](docs/WORKBENCH_DESIGN.md) |
| 美学、滚动、现场保留和验证要求 | [设计规则](docs/rules/design-and-verification.md) |
| 领域词汇 | [CONTEXT](CONTEXT.md) |
| 认证行为、场景和原型证据 | [原型行为索引](prototype/behavior/manifest.md) |
| 认证共享接口的已有约定和待补项 | [认证契约](docs/contracts/auth.md)，目前不完整 |
| 代码结构、旧底座与可复用部分 | [架构说明](docs/ARCHITECTURE.md) |

已确认的产品要求指导新实现；原型代码用于参考交互，旧应用用于参考可复用底座。二者均不能替代尚未形成的业务契约。原型证据只证明对应原型版本，正式应用的旧测试只证明其旧行为。

## 运行

使用 Node.js 22.23.2 和 npm 可复现此前运行环境。首次执行 `npm install`，其他环境要求见[安装与运行](docs/SETUP.md)。

| 查看什么 | 命令 | 默认入口 |
| --- | --- | --- |
| 当前交互原型，无需 API | `npm run prototype:sidebar` | `http://localhost:4174/` |
| 旧应用及真实 API | `npm run dev` | Web `http://localhost:5173/`；API `http://localhost:4000/` |

原型示例登录：`example@example.com` / `teachbuddy`。旧应用使用自身数据库中的账户，与原型模拟账户互不相通。

## 仓库边界

```text
apps/web/          真实前端的实现位置，目前仍是旧应用
apps/api/          真实后端的实现位置，目前仅账户与布局底座
packages/shared/   前后端确实需要共享的目录与契约代码
prototype/         交互参考、已验收的账户/外壳行为及模块草稿
docs/              产品范围、执行计划、契约、设计规则和技术说明
CONTEXT.md         领域术语
.agents/skills/    显式选用的原型评审、契约讨论流程
```

后续 MVP 直接在 `apps/` 实现。已验收的界面可按需迁入，迁入后由正式应用独立维护，生产代码不依赖原型源码。原型不会成为另一套需要同步开发的产品。旧执行计划 `PROJECT_PLAN.md` 已撤下，当前计划只维护在[交付 DAG](docs/plans/mvp-dag.md)，ROADMAP 仅作导航。

## 验证与部署

当前可用命令为 `npm run test:api`、`npm run test:e2e`、`npm run build`、`npm run prototype:build`。它们尚未覆盖目标 MVP；`build:api` 会检查并可能创建 SQLite 文件，详见安装指南。原型脚本的适用范围以行为索引为准，不能把旧空首页、九模块断言套到最新模块稿。

[API 指南](docs/API.md)描述旧 Bearer 应用；[旧部署说明](docs/DEPLOY_INFINITYFREE_RENDER.md)也仅供旧底座参考。新认证已确认同源 Cookie 方向，MVP 还需接通真实服务、持久文件和备份恢复，当前没有通过验证的 MVP 部署方案。可交付标准见[验收矩阵](docs/acceptance/mvp-matrix.md)。
