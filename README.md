# TeachBuddy 教师个人工作台

送给一位中国大陆重点高中高一数学实习教师的个人工作台。目标是让他收集题目、组织备课、制作数学演示、复用资料、安排时间，并留下课堂反馈。首页是能操作这些内容的 Agent 工作区。

**`main` 尚未交付真实 MVP。** 当前主干 `e9c3b58adf99a41e347947cccef646d85a3cd143` 的 `apps/` 仍是旧应用；已验证的首流、认证、教学时间、Agent 和静态数学能力都在独立任务分支，未合入 `main`。因此这些候选的 `self` 或 `independent` 结论不改变主干的运行方式，也不代表完整 MVP 通过。完整交付范围以 [MVP 产品范围](docs/PRODUCT_SCOPE.md) 为准，候选 SHA、验证级别和未决项以 [运行台账](docs/plans/run-state.md) 为准。

## 当前状态

下表描述 2026-09-22 的主干代码状态，基线为 `e9c3b58adf99a41e347947cccef646d85a3cd143`；认证文档当前消费候选为认证 `1.0.0-rc.2` 与工作台 `0.1.0-candidate.2`。节点依赖和授权停止点见[交付 DAG](docs/plans/mvp-dag.md)，当前编排状态见[运行台账](docs/plans/run-state.md)，[路线图](docs/ROADMAP.md)只提供状态导航。

| 部分 | 已有内容 | 距离目标的差距 |
| --- | --- | --- |
| `apps/web`、`apps/api` | 旧 React/Express 应用；Bearer 认证、密码找回、SQLite 账户与布局保存 | 未接入本轮已验收的账户 UI；业务模块为空，不是目标 MVP |
| `packages/shared` | 中性模块描述工具和空模块目录 | 尚无工作台业务接口定义；已有模块边界决议也未全部实现 |
| `prototype/` 账户入口 | 登录、注册、找回、会话恢复及失败分支已验收；此前行为缺口已补齐 | 使用模拟服务；正式认证契约已冻结，但真实认证服务尚未交付 |
| `prototype/` 工作台 | 既有侧栏与顶栏基线；已合入 Agent 首页、六模块及跨模块交互草稿 | 模块为内存数据，AI 为固定回复；模块稿尚未通过整体视觉与交互验收 |
| `docs/contracts/` | 认证 `1.0.0-rc.2`、工作台 `0.1.0-candidate.2` 及对应用例 | 契约冻结不等于主干已实现或产品已交付 |

### 已验证的分支候选

| 能力切片 | 固定候选与结论 | 仍保留的边界 |
| --- | --- | --- |
| 首条题库到备课流程 | 产品 `612f0a9868743a1d5eea7e6f236d3ff903752439`，[B16 独立报告](docs/acceptance/evidence/B16/v1/attempt2.md) PASS | 仍为 `test-principal`，不代表真实认证或完整题库范围 |
| 认证本地组合 | 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`，`aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md` 本地 independent PASS | 仍使用 fake-mail、本地自签 HTTPS 和视口模拟；真实邮件、目标物理设备、可信证书及备份恢复未验收 |
| 教学时间真实认证组合 | 产品 `f811a2778df3e47160377035ac1c3c8eacc09d8f`，`ab19d5d4858affda949470ec66475d5b6209ddd9:docs/acceptance/evidence/T54/v1/auth-review.md` 本地 independent PASS | 完整 T54 仍等待真实数学关联、M44/WB-T020 和外部设备条件 |
| Agent 真业务链 | 产品 `687121ec8d9afeccb527d2738f8b1ca22791dd69`、完整候选 `ec5094c00d122c77d2acdb376f4ede96eafb13e0`，`6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1:docs/acceptance/evidence/C27/v1/math-recheck.md` 本地 independent PASS | 与原 `34e668ae97e1eb0cd5744550b6b05a4c25aa9301` 中未变的两模型真业务链结论合用；不代表完整 MVP 或外部条件通过 |
| 静态数学模块 | 产品 `c3ab0dacd1ff172d8557117f028ebdd805235d41`、完整候选 `5a767dbc66ed6efb5fca1bcfe0870b7561c433b5`，self PASS | M42 正在实施；M43、M44 与完整数学关联尚未通过 |

材料 R30 候选 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1` 已完成最终限定冻结，只冻结设计、实验消费与后续放行边界；完整 R31 已启动，不代表材料产品已交付。真在线 C21 最新制品 `2b10b4ecbfef907de1d0c368c7a29eb49af803c4` 与回执 `4115bb66a5522879421ae8b49cb704b524b80b2c` 仍为 FAIL，因此不声称材料或在线采集已交付。Agent 两批真实模型账本保持分列：C26 为 10 次 / 79,983 totalTokens，C27 为 11 次 / 88,550 totalTokens；排版修复和限定复验没有新增产品模型请求。实际价格、余额和账单仍未知，SDK 中的 `cost=0` 不证明免费。

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
| 认证契约、版本消费和实现接缝 | [认证契约](docs/contracts/auth.md)；[认证实现架构](docs/arch/auth-implementation.md) |
| B10/B11 首条流程交接基线与旧 test-principal 边界 | [执行基线](docs/arch/execution-baseline.md) |
| 分支候选、验证级别、固定 SHA 与未决项 | [运行台账](docs/plans/run-state.md#固定候选与必要证据) |
| 代码结构、旧底座与可复用部分 | [架构说明](docs/ARCHITECTURE.md) |

已确认的产品要求指导新实现；原型代码用于参考交互，旧应用用于参考可复用底座。冻结的认证契约只定义实现边界，不证明真实服务已交付；原型证据只证明对应原型版本，正式应用的旧测试只证明其旧行为。

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

[API 指南](docs/API.md)描述旧 Bearer 应用；[旧部署说明](docs/DEPLOY_INFINITYFREE_RENDER.md)也仅供旧底座参考。分支候选已验证的本地真实 API、fake-mail、自签 HTTPS、普通进程重启和视口模拟，都不等于外部邮件、目标物理设备、可信证书、公开部署或备份恢复验收。可交付标准见[验收矩阵](docs/acceptance/mvp-matrix.md)。
