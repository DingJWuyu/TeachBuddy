# R31-R34 最小任务包入口

状态：R30/v1 新固定候选，两项原实验消费阻断已有独立关闭证据，待外层对 [freeze-prep](../../../acceptance/evidence/R30/v1/freeze-prep.md) 列明的组合做最终 independent 冻结。本批没有新的实现授权或完整产品 PASS 声明；实际派发按节点前置与已有权限执行。

| 节点 | 必读任务包 | 启动前必须固定 |
| --- | --- | --- |
| R31 | [公共底座](R31.md) | R30 外层冻结结果、B16 候选 `612f0a9868743a1d5eea7e6f236d3ff903752439` 及独立回执 `d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md` |
| R32 | [资源](R32.md) | 同一R30冻结SHA、R31固定候选SHA与公共端口/fixture |
| R33 | [自动收题](R33.md) | 同上；真实模型接入权限/注入入口按本节点授权，缺少时不读密钥寻找替代 |
| R34 | [备课与集成](R34.md) | 同上可并行开发；最终集成再固定R32/R33候选SHA及停止写入回执 |

以上完整SHA由外层在派发记录填入，不能用“最新main”或活动分支代替。每个节点使用独立worktree、DB、文件目录和端口。R31 已有基础产品 `5f696b8ce611e67d940ce149ce13946a50b65510` 和 self 交接 `c08fa62d434efffc89b471151faa73308e3ce716`，只是可复用的既有成果，不等于完整 R31 PASS，也不单独放行 R32/R33/R34。完整 R31 固定并停止共享文件写入后，R32/R33/R34 才按同一 R30 冻结组合并行，不额外增加 R32→R34 或 R33→R34 开发依赖。

数学公共组合 `02340eb972d68221bde94976c0da5fa90648de89` 同样只是已固定的限定支持成果；M41 正在其他工作树独立推进，本包不消费浮动 HEAD，不借该组合补签完整 R31 或 R30。

共同必读：[实现协议](../../execution-protocol.md#implementation)、[所有权](../../execution-protocol.md#ownership)、[回执](../../execution-protocol.md#receipt)；[架构文件写权](../../../arch/materials.md#文件所有权)；[同版契约共用规则/B11过渡](../../../contracts/workbench/materials.md#共用规则与真实认证边界)。schema 和同名 cases 是字段/样本的唯一来源。需要UI时读本节点UX及设计规则；不通读整个DAG、认证候选或无关模块。

前后端实现按根AGENTS指定dsh headless及额度回退路由执行，具体实现方法由节点负责。适用的skill内部review仍由该节点聚合，不自行派顶层session或相互商议改契约。需要修改公共语义交R30新版独立冻结；共享文件需求写入本节点integration.md由唯一写者装配。

共同检查要求：在自己的冻结候选和隔离数据上运行 `npm run test:api`、`npm run build`，UI变更运行本节点真实浏览器E2E及截图；B16若已提供替代脚本名，回执记实际完整命令与等价覆盖，不空列通过。API定向入口使用 `node --test apps/api/test/materials-<节点前缀>*.test.js`，浏览器入口使用 `npx playwright test apps/web/e2e/materials-<节点前缀>*.spec.js`。前缀为 foundation/resources/questions/lessons/integration；R31没有UI流程测试文件时以公共编辑fixture的实际浏览器检查记录替代，不伪造空测试PASS。每个新缺陷先从实际HTTP/浏览器复现，再修复；不写UI单元测试。

回执写 `docs/acceptance/evidence/<节点>/v1/author.md`，集成需求写同目录 `integration.md`，运行入口/命令/输出/截图按同目录索引记录。必须含实际时钟、完整SHA、self、身份模式、mock与真实覆盖分别标识、未决项及责任节点。允许本节点候选提交；main合并、push、部署、外部发消息仍由本次具体授权决定。测试完成后清理自己的无用临时文件，未完成保留进度，始终保留原实验输入。
