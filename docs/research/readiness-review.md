# 前置调研独立核验

核验日期：2026-09-21。结论：**CHANGES_REQUIRED**。核验 session：`01a0c4b5-362a-7d60-a1b4-9c47602e9ee8`，独立审查，不是产品验收。

当前适用说明：本报告保留其固定受审版本的 `CHANGES_REQUIRED` 结论和证据，不代表修正后的独立 PASS。RR-01/02/03 已由作者修正并完成自查，用户随后取消独立复审；当前状态和正式回执见[运行台账](../plans/run-state.md)与[修正回执](../acceptance/evidence/readiness-correction.md)。本报告的“最小后续任务”段是原核验建议，不是当前待派发的复审入口。

API 配置的端点、精确模型 ID 和无秘密模板可用；两份研究报告有三项必须修正，见下表。当前不能证明完整 MVP 已接通、免费部署或在中国大陆可靠可达。缺少真实调用及目标网络实验不阻塞本次文档核验，也不构成启动产品 DAG 的授权。

## 必须修正

三个编号均为未关闭项，由后续文档执行者修改指定研究文件，本报告不直接修改受审文件。无需为这些修正调用模型、部署或购买服务。

| ID | 文件与章节 | 原始证据及问题 | 最小修改 | 关闭条件 |
| --- | --- | --- | --- | --- |
| RR-01 | [deployment-options.md](deployment-options.md) 第 2 节“已知的官方事实”，以及引用这一结论的摘要/状态标签 | [China Network FAQ](https://developers.cloudflare.com/china-network/faq/#is-pages-available-in-mainland-china)确有“Pages is not available in Mainland China”的表述，解释涉及证书位置，并称全球 zone 可能扩展进大陆。这是 China Network 文档中的产品供应说明，不是目标用户从大陆访问全球 Pages 的网络测量。“官方确认 Pages 在大陆不可用”脱离语境会把产品供应范围等同跨境网络不可达。 | 写明出处语境和原文含义；分别列 China Network 产品供应限制、全球 Pages 的跨境访问仍未知、本次未实测。保留不能保证可达或稳定的结论，也不能断言大陆客户端必然无法访问。 | 所有摘要与正文保持这三个概念分离；没有依据该 FAQ 排除一切全球 Pages 访问，也没有反向保证可达。 |
| RR-02 | [deployment-options.md](deployment-options.md) 第 3 节运行时判断、第 4 节两条路径、第 5-6 节及状态标签 | [pi shell 源码](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/utils/shell.ts)同时实现 Windows 与 Unix shell 路径；[LibreOffice 系统要求](https://www.libreoffice.org/system-requirements/)包含 GNU/Linux。Workers 的限制只能证明部分默认依赖不能原样运行，不能证明完整后端必须 Windows 或付费，也不能证明文件与备份本身必须 Windows。将两条候选都限定 Windows、把本地后端验证一律限定 Windows，混淆了用户客户端与服务器系统。 | 将执行节点表述为“具备所选 Node/pi、转换依赖和持久存储能力的主机，已有 Windows 是候选之一，已有/可取得的 Linux 或免费运行环境未被排除，但未验证其额度与完整能力”。Windows/WPS/Edge/Chrome 保留为用户侧验收环境。持久文件、独立备份分别说明，不归因于操作系统。A 是基于已有设备可用这一条件的简单候选，B 保留为非默认备选，不据此宣称免费托管全覆盖。 | 不再出现 Windows 或付费运行时的穷尽式判断；两条路径的主机可用性、成本、存储/恢复和网络条件清楚；不新增平台大调研，也不声称任何免费 Linux 托管已经通过。 |
| RR-03 | [command-code-api.md](command-code-api.md)“套餐、credits 和 API 之外的计费 / 已证实”模型单价条目 | [官方 Pricing & Limits](https://commandcode.ai/docs/resources/pricing-limits)在 DeepSeek V4.1 Flash 条目将 $0.15/$0.60 标为谷时 input/output 价格，同时注明峰时 $0.30/$1.20、周一至周五 UTC 01:00-04:00 与 06:00-10:00。原报告将谷时价写成当前统一单价，泛称价格会变化不能替代已知峰谷差异。 | 最简方式是删除固定 token 单价，仅保留实时价格链接及峰谷价提醒；若保留数字，标清每百万 token、谷时/峰时 input/output 和 UTC 时段。cache read 不臆测峰时值，按官方当前条目限定。 | 报告不再暗示 DeepSeek 全天统一按谷时价；GOAT credits 与额外 credits 的边界仍保留；不改变两个允许模型。 |

## A. Command Code API 与配置

### 已证实

官方 Provider 文档直接支持 base URL `https://api.commandcode.ai/provider/v1`、`POST /chat/completions`、OpenAI Chat Completions schema 和 `Authorization: Bearer <key>`。GOAT 有 API access，沿用套餐 credits 与模型访问权限，不必为了使用 GOAT API 另买 Provider 套餐。此处证明公开接入契约，不证明用户账户有效。[Provider API](https://commandcode.ai/docs/provider)、[GOAT](https://commandcode.ai/docs/plans/goat)

[官方模型目录](https://commandcode.ai/docs/reference/cli/models)正文分别列出以下精确 ID，本次实际打开并核对了 DeepSeek、Z AI 表格，不以搜索摘要或近似版本代替：

| 产品模型 | 必须使用的 Command Code ID |
| --- | --- |
| DeepSeek v4.1 Flash | `deepseek/deepseek-v4.1-flash` |
| GLM 5.3 Flash | `z-ai/glm-5.3-flash` |

GOAT 官方模型表包含这两个名称。公开文档说明 open models 使用 Chat Completions，同时要求以 live catalog 的 `supported_endpoints` 判断可用路由。本次没有获取带账户权限的目录或发送推理请求，故不能声称两个模型的当前账户调用均成功。[GOAT 模型表](https://commandcode.ai/docs/plans/goat)、[Provider 路由说明](https://commandcode.ai/docs/provider)

GOAT 当前价格页列 $10/月、最高约 $70 usage，具体取决于模型 allowance；included credits 有 5 小时 $14、每周 $35 窗口。额外 credits 按模型成本扣费、可结转，不能解释成无限免费 API。账户激活、余额、自动充值和支付费用未核验；模型报价必须按 RR-03 修正。[Pricing & Limits](https://commandcode.ai/docs/resources/pricing-limits)、[GOAT 超额用量](https://commandcode.ai/docs/plans/goat#usage-beyond-plan-limits)

### pi 适配的准确边界

`openai-completions` 确实是 pi 对 OpenAI Chat Completions 兼容接口的 API 类型；pi 官方提供自定义 provider 注册及模型配置机制。因此用 `commandcode` 作为拟注册 provider ID、使用该 API 类型和上述 base URL，是有依据的后续适配方向。`commandcode` 配置字符串本身不等于 TeacherWorkspace 已注册 provider，协议匹配也不证明所有流式、reasoning 或工具参数兼容。[pi Custom Providers](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/custom-provider.md)、[pi 模型配置](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/models.md)

原 API 报告已经说明“后续接入”“实际读取待实现”，无需因此判失败。建议在其 pi 小节补上述第一方引用，并明确“拟注册的自定义 provider ID”。本次没有读取 `~/.dsh`；作者关于 dsh 本机 overlay 的声明未独立复核，不作为接入成立的必要证据。

### 模板与本地静态核查：PASS

- [`.env.agent.example`](../../.env.agent.example)只有六个配置键：空 API key、base URL、provider ID、API 类型、默认模型、两模型声明性名单。键名、空值和无重复键检查通过，未发现秘密或额外模型。
- [`.gitignore`](../../.gitignore)的精确规则忽略 `.env`、`.env.agent`；示例文件不被忽略，真实配置没有被 Git 跟踪。
- 本 worktree 根目录 `.env` 存在、权限 `0600`，`COMMANDCODE_API_KEY` **未填**。仅核对变量名、是否填写和五项公开配置；未输出或复制秘密。用户可从 [Studio API keys](https://commandcode.ai/settings/keys)取得 key，填入本地 `/home/liam_t/项目/TeacherWorkspace-mvp/.env`。该文件不随 Git 合入 main；后续集成到另一 worktree 应从模板准备并保护当地现值。
- 当前 [API 环境配置](../../apps/api/src/config/env.js)只处理旧账户/SMTP/SQLite 等变量，相关应用源码未发现 Command Code 配置消费或 provider 注册。不能声称“只填 key，旧应用即具备 Agent 能力”。
- 原报告诚实区分 `.env` allowlist 声明与后端强制校验。后续实现应在实际模型请求边界强制这两个精确 ID，拒绝其他模型及 fallback；缺 key 时明确失败，不能静默回退到开发 harness 或个人凭据。这些均为待实现要求，本次没有写代码。

尚未验证：真实鉴权、账户额度、当前模型权限、实际账单、流式/tool use、模型效果、Windows 接通和服务端配置加载。未发请求就没有这些通过结论。

## B. 部署可用性

### 第一方额度与费用核对

以下支持“部分基础设施有免费额度”，不支持“完整产品免费可用”。

| 能力 | 独立核对结果 |
| --- | --- |
| 平台子域名/静态站点 | Pages 提供 `*.pages.dev`，Workers 提供 `*.workers.dev`；静态 Pages 请求免费且不限量。Pages Free 为 500 builds/月、20,000 文件、单文件 25 MiB、每项目 100 自定义域名。[Pages 域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)、[Pages 价格](https://developers.cloudflare.com/pages/functions/pricing/)、[Pages 限制](https://developers.cloudflare.com/pages/platform/limits/)、[workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) |
| 自有域名 | Registrar 按注册局及 ICANN 成本注册/续费，不是免费赠送自有域名。官方推荐生产 Worker 使用 route 或自定义域名，不能将这个建议变成个人项目必须买域名的普遍定律。[Registrar](https://developers.cloudflare.com/registrar/)、[workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) |
| Workers | Free 每天 100,000 动态请求、每次 10 ms CPU、每 isolate 128 MB。普通子请求为 50/次，内部服务另有分类；Cloudflare Free 账户请求体上限 100 MB，不是由 Workers 计划独自决定。Paid 基础为 $5/月，仍有超额用量费用。[价格](https://developers.cloudflare.com/workers/platform/pricing/)、[限制](https://developers.cloudflare.com/workers/platform/limits/) |
| D1 | Free 每日读 500 万行、写 10 万行，总存储 5 GB；单库 500 MB、10 库、7 天 Time Travel。额度及恢复窗口成立，不能替代数据库、文件、关联元数据的整体备份恢复。[价格](https://developers.cloudflare.com/d1/platform/pricing/)、[限制](https://developers.cloudflare.com/d1/platform/limits/) |
| R2 | Standard 免费额度为每月 10 GB-month、100 万 Class A、1,000 万 Class B，直接出网免费；超过免费额度按量计费。开通需 subscription checkout，不能承诺免支付方式。支付方式预授权失败可导致访问中断，不能把对象耐久性等同独立备份。[价格](https://developers.cloudflare.com/r2/pricing/)、[开通](https://developers.cloudflare.com/r2/get-started/)、[账单政策](https://developers.cloudflare.com/billing/understand/billing-policy/#account-payment-method-preauthorization) |
| Workflows / DO / KV | 研究列出的 Workflows Free 每天 3,000 steps、1 GB-month 状态、共享请求额度和 10 ms CPU，DO Free 的请求/时长/SQLite 配额、KV 配额均有官方表支持。它们不是单用户产品必须引入的组件。[Workflows 价格](https://developers.cloudflare.com/workflows/reference/pricing/)、[Workers 综合价格](https://developers.cloudflare.com/workers/platform/pricing/) |
| PDF / 完整运行时 | Browser Run Free 每日 10 分钟、3 个并发浏览器，PDF API 可处理 URL/HTML；这不等于已解决 Office 预览或 Word 导出。Containers 无 Free 配额，属于 Workers Paid，并有资源计费。[浏览器限制](https://developers.cloudflare.com/browser-run/limits/)、[PDF API](https://developers.cloudflare.com/api/resources/browser_rendering/subresources/pdf/methods/create/)、[Containers 价格](https://developers.cloudflare.com/containers/platform/pricing/) |

### 大陆访问与运行时判断

China Network 要求 Enterprise、单独订阅及入网域名的 ICP 和内容审核；其产品清单/FAQ 的 Pages、R2 限制必须保留产品语境。全球服务从目标大陆网络是否可达、是否能稳定登录/流式/上传下载，本次均未测试。不能保证成功，也不能依据 China Network FAQ 断言全部失败。[China Network 入门](https://developers.cloudflare.com/china-network/get-started/)、[产品清单](https://developers.cloudflare.com/china-network/reference/available-products/)、[FAQ](https://developers.cloudflare.com/china-network/faq/)

Workers 的 `node:child_process` 是非功能 stub，`fs` 的可写 `/tmp` 按请求隔离、不持久；这足以否定“npm 能导入，所以默认完整 pi/系统转换工具无需适配即可运行”。它不等于所有 pi SDK 集成方式都不可行，也不决定运行主机必须 Windows。[Node 兼容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)、[Workers fs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)

pi 当前 package 要求 Node `>=22.19.0`，有 SDK 与可替换工具/会话机制；默认 shell 工具有 Unix 路径。LibreOffice 也提供 GNU/Linux 版本。这里只说明 Linux 不应被排除，不指定它为转换方案，更不证明其数学排版、字体或 WPS 兼容效果。[pi package](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/package.json)、[pi SDK 入口](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/README.md)、[pi shell](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/utils/shell.ts)、[LibreOffice](https://www.libreoffice.org/system-requirements/)

### 两条候选的核验结论

依据[真实产品范围](../PRODUCT_SCOPE.md#基础交付要求)和[账户同源约定](../contracts/auth.md#已确认浏览器访问与登录凭据传递)，两条路径都只是待验证候选，尚无一条证明完整部署成功。

| 候选 | 可以保留的判断 | 必须显露的条件及复杂度 |
| --- | --- | --- |
| A：单台已有主机运行完整服务，加 Tunnel | 若已有合适且可持续联网的设备，这是组件较少的直接路径；Windows 是用户已有环境的候选，不是服务器系统约束。 | 主机运行 Node/pi/转换依赖、业务数据与文件，独立位置备份；公网入口同源 HTTPS，提供真实账户及邮件发码能力，服务端持有模型 key。开机、电费、网络、备份空间不是免费托管。Tunnel 发布应用的官方流程要求 Cloudflare 上的域名，不能拿临时 URL 消除这一条件。[Tunnel 前提](https://developers.cloudflare.com/tunnel/get-started/#prerequisites) |
| B：Cloudflare 前端/API/数据，加独立执行主机 | 可作为有明确常在线 CRUD 需求时的备选；不是为单用户默认增加拆分。 | 仍需完整执行主机、私有文件权限、数据库与对象一致恢复、同源浏览器入口、执行节点身份验证及任务恢复，不能裸露 pi 接口。D1/R2/Workflows 分别按实际需求选择，不为追求免费而全数堆叠。此路径未消除主机、邮件、模型、域名或支付条件，现有证据不足以冻结为方案。 |

Tunnel 可在所有计划使用，不需要源站公网 IP；不代表大陆目标链路已验证。Quick Tunnel 官方定位开发测试、无 SLA、不支持 SSE，因此不能作为正式 Agent 流式链路验收环境。[Tunnel](https://developers.cloudflare.com/tunnel/)、[Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)

**可对用户陈述的部署结论**：Cloudflare 有免费子域名和部分计算/存储额度，自有域名通常需要注册续费；目前没有证明完整 MVP 能零新增托管费用且在大陆可靠运行。免费/已有 Linux 资源没有被排除，也没有被验证为可用服务。单用户降低用量，不自动消除运行依赖、账户邮件、文件备份和外部模型费用。

## C. 认证交付现状，只读

### 仓库证据

核查时 main 为 `911e62469a0298339613385b7e4a1f8d90822191`，主目录工作区干净；本 worktree 为 `5eab55d64463215b7e9c044ffb71edb5c365d0e9`，分支 `docs/mvp-delivery-baseline`，已有他人文档改动保留。本次没有 fetch，结论限于本地仓库。

| 交付层 | 已有证据 | 结论 |
| --- | --- | --- |
| 账户行为与原型 | `c7420af8c2740ddee5e01caa6da8bf7f57c134e2` 集成账户入口行为；[auth.md](../../prototype/behavior/auth.md)与[manifest](../../prototype/behavior/manifest.md)明确登录、注册、找回、恢复、失败和输入边界已验收，CA53 退出入口明确暂缺。 | 已交付的是模拟原型和行为资料，包含 G01-G06 的新行为；不是新正式认证服务。本次未重跑任何产品/原型测试。 |
| 认证契约 | `5757141a61e719c8002736ae5af0ac1778dad054` 保存契约草稿，提交说明明确保持原讨论状态。[契约](../contracts/auth.md)与[用例](../contracts/auth-cases.md)仍引用 `a496c5a4727e2900bd110198819295e068739439` / prototype tree `05dc1e5244cd9224d3480f0a1935dac56d8f3fcd`。 | 尚未同步新版行为。它仍把昵称、开放注册、会话和输入边界列为缺口，不能据此反称原型没补齐。 |
| 精确交换及测试 | [OpenAPI](../contracts/auth.openapi.yaml)为 `0.1.0-draft.9`，全局与六个操作为 `partial`；[契约用例](../contracts/auth-cases.md)是未执行片段。 | 成功响应、身份恢复 I06、完整会话和退出 I07 等未交付；结构校验通过不是接口实现或 E2E 通过。 |
| apps 正式位置的旧实现 | [requireAuth.js](../../apps/api/src/middleware/requireAuth.js)从 Authorization Bearer 读取 token；[api.js](../../apps/web/src/utils/api.js)从 localStorage 读取 `refatos-token`，默认独立 API origin；[app.js](../../apps/api/src/app.js)保留旧接口。 | 与新契约的同源 HttpOnly Cookie 方向不一致。不能把旧登录、找回及 localStorage 会话视为新契约完成，也不能假定复制原型即可无缝集成。 |

三份认证契约及 `prototype/behavior/auth.md` 在 main 与本 worktree 内容相同；后者 blob 均为 `928dfd6f8e304de57b2cef059d1ea1a836f9da14`，旧源对应 blob 为 `22b12bd7eab17d850215abe415e8def8ad67db43`。当前 main prototype tree 为 `65a196ab459892abc260f6df6c818322af408ffb`，本 worktree 为 `1281d51665a740573a0a6f237b9e37d0335cf2c3`，都不同于契约记录；manifest 的 worktree 差异是验证脚本适用性说明，账户行为没有另一个分叉版本。旧 auth-behavior worktree 元数据为 prunable 且指向已不存在位置，不能据此推断认证没有工作。

### 工作台需要的边界

- 登录/注册/恢复经认证确认后进入 S21，使用账户保存的昵称；昵称数据由 auth 提供，账号行布局由工作台拥有。已有门禁上下文的工作台路径按当前行为保持，不另造返回地址规则。[账户行为 J11/J25/G05](../../prototype/behavior/auth.md)
- 记住我为 7 天绝对有效期，未记住只当前页面；恢复等待不能先展示工作台，过期、撤销和重置引发身份变化。重置撤销目标账户旧会话，不能误退其他账户。它们已有原型行为依据，正式凭据/服务器交换仍待契约。[账户行为 G03](../../prototype/behavior/auth.md)
- 新契约已确认同源 HTTPS、`__Host-teachbuddy_session`、HttpOnly/Secure/Path=/、SameSite=Lax、无 Domain、来源检查及 `X-TeachBuddy-Request: 1`、认证响应 `no-store`。浏览器不读写凭据，不能沿用旧 localStorage Bearer 当作完成。[契约 D11-D14](../contracts/auth.md)
- 退出按钮由工作台设置页负责，原型 CA53 暂缺；仅 `POST /api/auth/logout` 方法/路径已定。请求形状、退出影响范围、重复退出、成功/失败、清凭据及返回登录时机尚未完整定义。退出入口归属已经知道，不能要求用户重答，也不能因此推导服务端退出语义已冻结。[README](../../README.md)、[契约 D05-B/I07](../contracts/auth.md)、[OpenAPI logout](../contracts/auth.openapi.yaml)

### 已定位 session 与对接动作

本地 Codex 持久 session 索引和只读 `state_5.sqlite` 元数据把以下 ID 关联到 `/home/liam_t/项目/TeacherWorkspace`。只核对这两个认证相关 session 的最后最终回执，没有遍历无关会话、联系作者或检查其运行进度。

| session ID | 已识别职责与最后回执 | 编排者下一步 |
| --- | --- | --- |
| `01a0bea6-5119-7861-b060-e5f1da67947b` | 认证契约讨论；2026-09-20 17:47:54 UTC 最后回执确认已定片段检查通过，等待行为集成后补完整请求、响应、用例。 | 向这条已识别认证工作线交接 main 中 `c7420af` 的行为和 `5757141` 的草稿位置，取得当前负责人/交付位置、最新契约版本、I01/I03/I06/I07 身份与退出边界、未决项和实现/验证状态回执。是否已有更新成果由其回执确认，不让用户搬运。 |
| `01a0c2b4-6c79-7d23-933d-8d6c1a84533f` | 行为集成与修正；2026-09-21 11:41:13 UTC 最后回执指向已合入的 `c7420af`，报告 357 条三端记录及构建/集成通过，并保留 CA53、条款跳转、真实后端/邮件的既定边界。 | 其行为成果已在仓库，不需再索取复制包。357 条是作者回执与已保存验收资料的声明，本审查未执行这些测试。 |

持久文件与提交是项目后续使用依据，上述 session ID 只用于编排者路由交接，不要求后续执行者读取本地会话日志。已确认的是本地交付状态，不是“认证 session 没有继续工作”的断言。

## 原核验时的最小后续任务与外部条件

1. 原核验时建议文档执行者修正 RR-01、RR-02、RR-03；该动作及作者自查已由[稳定修正回执](../acceptance/evidence/readiness-correction.md)记录。用户已取消独立复审，因此本条不再产生新的 reviewer 任务，也不把真实 API 或部署测试加成本轮文档状态。
2. 编排者按上述 ID 安排认证交接。先获取可核查的版本、文件与未决边界，不启动或接管其产品实现。本地仓库已经足以确认新版行为可供契约续接，不需要普通技术问题问卷。
3. 文档执行者同步已有 research conclusions 或台账时，采用本报告三个结果：API 配置准备成立但未接通；完整免费且大陆可靠部署未证实；认证行为已集成而契约/新正式实现未交付。将过时“拆分待审”与最新独立审查 PASS 对齐，同时明确“main 合并已获用户授权、另有集成执行者负责；产品 DAG 未获启动授权”。后两项为本次用户明确给定的编排事实，本次未重审规划，也不设计新台账系统。
4. 外部条件收敛为：用户私下填入 key 并在之后授权真实调用；若保留已有主机候选，确认能否在需要访问时保持开机联网；仅在具体入口/存储方案需要时确认域名或支付条件。备份目标和邮件服务属于后续方案必须明确的依赖，不把普通选型先退回用户。大陆 DNS/TLS、Cookie、模型出站、流式、文件/预览、恢复及 Windows/WPS/Edge/Chrome 实机验收留待获准实施后进行。

## 输入稳定性与执行边界

固定受审输入如下，核验开始及报告完成前均与指定 SHA-256 一致；本报告不依赖临时任务提示或日志。

| 文件 | SHA-256 |
| --- | --- |
| `AGENTS.md` | `a1f50ccbf7b735f273dfa3695cf4268c5d9fabba958cd54babba593016d716d4` |
| `docs/research/command-code-api.md` | `53540fec8db5b50a56b7f0b87a6e8b35755b59fab08110d5b6c8167f91986623` |
| `docs/research/deployment-options.md` | `aed25a5435e98e4524fd1389a47d5ccc9367aa13be5eb9193de1f9d58dc93e3f` |
| `.env.agent.example` | `d1a2a7106b2b9b68472e3ca80ad68f5ed2447a55ffc8ce79e35dceb419815e97` |
| `.gitignore` | `315e2d591daa1859cb45aacf576464f58be3621c643811643f43b93bc2bbb200` |

唯一写入为本报告。没有产品实现、产品测试、安装依赖、计费 API 请求、注册/购买/部署、子代理、对外消息、秘密回显/复制、修改受审文件、提交/合并/push。没有创建需要清理的临时文件；他人工作及调度资料保留。
