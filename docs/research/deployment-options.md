# 部署选项研究：Cloudflare 与完整 MVP

研究日期：2026-09-21

研究对象：面向中国大陆一位教师、需要电脑和平板跨设备访问的完整 MVP。
范围依据：[README 当前状态](../../README.md)、[MVP 产品范围](../PRODUCT_SCOPE.md)。

用户侧事实：用户使用 Windows、WPS、Edge/Chrome；目前没有服务器，倾向不花托管费用，部署尚未选定。这里的 Windows 是用户侧和候选执行主机条件，不是已冻结的服务器系统结论。

当前状态：首次调研的独立核验结论为 CHANGES_REQUIRED；RR-01/02 已由作者修正并自查，用户取消独立复审，当前部署结论进入文档集成。未冻结部署候选，未进行目标网络实测或产品部署。

## 结论先行

- **[已证实]** Cloudflare Free 可以覆盖静态前端、轻量 Workers API、D1 关系数据，以及在配额内的 R2 文件对象和 Workflows 编排。静态资源请求不计费；动态请求、CPU、数据库读写、对象存储和操作都有明确免费额度。[Cloudflare Workers/Pages 价格与限制](https://developers.cloudflare.com/workers/platform/pricing/)、[Pages Functions 价格](https://developers.cloudflare.com/pages/functions/pricing/)、[D1 价格](https://developers.cloudflare.com/d1/platform/pricing/)、[R2 价格](https://developers.cloudflare.com/r2/pricing/)
- **[已证实]** Cloudflare 提供免费的平台子域名：Pages 项目的 `*.pages.dev`、Workers 的 `*.workers.dev`；TryCloudflare 的 `*.trycloudflare.com` 适合临时测试。它们都不是用户持有的免费注册域名。[Pages 自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)、[Workers `workers.dev`](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)、[Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- **[已证实]** Cloudflare Registrar 不是免费域名服务。它只承诺按注册局和 ICANN 的成本价注册、续费，不加价；域名注册费和续费费仍然要支付。[Cloudflare Registrar](https://developers.cloudflare.com/registrar/)
- **[依据来源推断]** 目前不能证明“完整 MVP 零成本且能在中国大陆可靠使用”。主要原因不是单用户配额，而是完整 MVP 需要真实 pi Agent runtime、文件持久化与备份、Office/PDF 处理和长期任务；Cloudflare Workers Free 不提供可直接运行完整 Node/系统进程的环境，Cloudflare 中国网络也不是 Free 服务。[Cloudflare Node.js 兼容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)、[Cloudflare Containers 价格](https://developers.cloudflare.com/containers/platform/pricing/)、[Cloudflare 中国网络概览](https://developers.cloudflare.com/china-network/)
- **[尚未验证]** 本次没有在中国大陆用户网络上访问候选 URL，也没有测试大陆运营商、DNS、TLS、流式响应、上传下载或三端浏览器行为。因此不能从本次外部工具的访问结果推断大陆可达性、速度或稳定性。

## 1. Cloudflare Free 能覆盖什么

额度是账户和服务的月度或日度上限，不等于完整产品容量。Free 计划超限时，官方文档通常描述为请求或操作失败，升级到 Paid 才能解除限制；不会因为单用户而自动获得更高额度。

|能力|官方当前免费额度或事实|收费、支付和适配边界|
|---|---|---|
|静态前端|Pages Free：每月 500 次构建、每项目 20,000 个文件、单文件 25 MiB、每项目 100 个自定义域名。纯静态 Pages 请求免费且不限量。[Pages 限制](https://developers.cloudflare.com/pages/platform/limits/)、[Pages Functions 计费](https://developers.cloudflare.com/pages/functions/pricing/)|静态前端本身可以是 `$0`。一旦使用 Pages Functions，函数请求计入 Workers Free 的动态额度。`*.pages.dev` 是平台子域名，不是自有域名；且大陆访问有单独限制，见下文。|
|Workers / Pages Functions|Workers Free：100,000 请求/天、每次 HTTP 调用 10 ms CPU、128 MB 内存、每次最多 50 个子请求；Free 账户 HTTP 请求体上限 100 MB。静态资源请求免费且不限量。[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)|Workers Paid 最低 `$5/月/账户`，提供更高的 CPU 和用量额度；Paid 与普通 Cloudflare 域名计划分开。需要付费计划才有 Cloudflare Containers。|
|D1 数据库|Workers Free：每天 500 万行读取、10 万行写入，账户总存储 5 GB；Free 单数据库最大 500 MB，最多 10 个数据库。D1 不收数据传输费。[D1 价格](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)|超出每日读写额度会暂时拒绝查询；达到存储上限后不能继续插入、建表、建索引。D1 Free 的 Time Travel 可恢复最近 7 天，适合误操作恢复，但不是完整个人资料备份方案。[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)|
|R2 文件存储|Standard 存储、Class A/B 操作和直接出网的当前免费额度见[R2 价格](https://developers.cloudflare.com/r2/pricing/)。|R2 的官方入门流程要求添加 R2 subscription 并完成 checkout；它是按使用量计费的服务。Cloudflare 账单政策允许对使用量服务预授权支付方式，付款失败可能暂停 R2 访问。因此不能把“免费额度”理解为一定无需支付方式；本次未验证中国大陆账户的具体结账门槛。[R2 入门](https://developers.cloudflare.com/r2/get-started/)、[Cloudflare 账单政策](https://developers.cloudflare.com/billing/understand/billing-policy/)|
|Workflows / 有状态编排|Workflows Free：100,000 请求/天并与 Workers 请求共享、每次调用 10 ms CPU、1 GB 状态存储、每天 3,000 steps；单个 step 的 wall-clock 时间没有硬上限，但仍受 CPU 限制。[Workflows 价格](https://developers.cloudflare.com/workflows/reference/pricing/)、[Workers wall-clock 限制](https://developers.cloudflare.com/workers/platform/limits/)|可用于等待外部 API、重试、保存步骤状态和恢复流程，不能因此获得完整 Node 进程或 Office 转换环境。一个用户的 Agent 对话是否会耗尽步骤、状态和 CPU 额度，尚未由真实任务量验证。|
|Durable Objects / KV|Durable Objects Free 支持 SQLite 存储后端，每天 100,000 请求、13,000 GB-s 运行时和 5 GB SQL 存储。KV Free 为 1 GB、每天 100,000 次读取、每天 1,000 次写入/删除/列举。[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)|可作为会话或协调状态的补充，不能替代主业务关系数据、文件对象或 pi 的宿主环境。对单用户 MVP 不应为了免费额度额外引入复杂状态层。|
|浏览器渲染|Browser Rendering Free 每天 10 分钟、最多 3 个并发浏览器；官方 PDF API 接受 URL 或 HTML 并返回渲染的 PDF。[Browser Rendering 额度](https://developers.cloudflare.com/changelog/post/2025-07-28-br-pricing/)、[PDF API](https://developers.cloudflare.com/api/resources/browser_rendering/subresources/pdf/methods/create/)|这可以帮助 HTML 到 PDF 的一条路径，但官方能力描述没有把 DOCX/PPT 输入预览或可编辑 Word 导出列为已解决能力。不能用它证明本 MVP 的 Office 预览和 Word 输出已覆盖。|
|系统运行时 / 容器|Workers Node.js 兼容层是子集；`node:child_process` 属于可导入但没有可用实现的 stub。Cloudflare Containers 能运行任意语言、完整文件系统和 Linux 类运行时，但 Free 额度为 N/A，属于 Workers Paid，基础 Paid 计划为 `$5/月` 后再按容器用量计费。[Node.js 兼容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)、[Containers 概览](https://developers.cloudflare.com/containers/)、[Containers 价格](https://developers.cloudflare.com/containers/platform/pricing/)|这是完整 MVP 的主要免费适配风险。pi 或 Office/PDF 工具若依赖真实 Node 进程、shell、系统二进制或长期本地文件，不能仅凭 Workers 的 npm 兼容说明视为可运行。|

### 免费域名、子域名和支付结论

1. **免费平台子域名已证实**：Pages 项目有 `*.pages.dev`，Workers 账户有 `*.workers.dev`。Workers 文档明确建议生产应用使用自定义域名或 route，而把 `workers.dev` 视为个人或爱好项目网站；这不是稳定性 SLA。[Workers `workers.dev`](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
2. **免费测试 URL 已证实**：TryCloudflare 可以把本机服务映射到随机 `*.trycloudflare.com` URL，无需先把域名加入 Cloudflare，但官方明确说明它仅用于测试和开发，没有 SLA，不支持 SSE，并限制同时在途请求数为 200。[Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
3. **自有域名不免费已证实**：Registrar 只是不加价，仍需支付注册局和 ICANN 成本；Cloudflare Free DNS、CDN、SSL 等不等于免费获得域名。[Cloudflare Registrar](https://developers.cloudflare.com/registrar/)、[Cloudflare Free 计划](https://www.cloudflare.com/plans/)
4. **R2 的支付条件未完全验证**：官方要求 R2 subscription checkout，并有使用量账单政策；若不愿设置支付方式，可将文件保存在已有主机或其他明确的持久化存储，但必须另行解决跨设备访问和独立备份。

## 2. 中国大陆访问：已知与未实测

### 已知的官方事实

- **[已证实]** Cloudflare China Network 是 Enterprise 客户的单独订阅，需要每个 apex domain 有有效 ICP 备案或许可证；官方没有在这些文档中给出 Free 价格，且入网还涉及内容审核和合作方 JD Cloud 的审核。[China Network 概览](https://developers.cloudflare.com/china-network/)、[China Network 入门](https://developers.cloudflare.com/china-network/get-started/)
- **[已证实] China Network 产品供应限制**：China Network FAQ 原文写有 “Pages is not available in Mainland China”，并说明 `pages.dev` 证书不位于中国大陆；同一 FAQ 另说明全球 zone 可能扩展到大陆。这里的“不可用”是 China Network 的产品供应和证书部署说明，不是对大陆客户端访问全球 Pages 的网络测量。[China Network FAQ](https://developers.cloudflare.com/china-network/faq/)
- **[已证实]** China Network 不是全球产品的简单开关，官方说明并非所有 Cloudflare 产品都可用。R2 bucket 不能在中国大陆创建，R2 自定义域名在中国大陆不支持，但可以通过 Global Acceleration 扩展；这仍需要单独验证路径和费用。[可用产品与功能](https://developers.cloudflare.com/china-network/reference/available-products/)
- **[已证实]** Cloudflare Tunnel 可在所有计划使用，采用本机 `cloudflared` 发起的出站连接，不需要公网 IP 或开放入站端口。[Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/)

### 尚未验证的部分

- **[尚未验证]** 本次未从中国大陆实际宽带、移动网络或校园网络访问 `pages.dev`、`workers.dev`、自定义域名、Tunnel URL 或 R2 下载地址。
- **[尚未验证]** 未测试 Edge/Chrome 在大陆的 Cookie、SSE/WebSocket、长连接、文件上传下载、PDF/Office 预览和动态 HTML 展示。
- **[尚未验证] 全球 Pages 的大陆访问**：本次未从目标大陆网络实测 Cloudflare 全球 Pages、Workers、Tunnel 或自定义域名的 DNS 解析、跨境路径、首字节时间、丢包和持续稳定性。因此不能保证大陆客户端可达或稳定，也不能依据 China Network FAQ 断言全球 Pages 必然不可达。
- **[尚未验证]** 是否需要 ICP、企业主体、特定支付方式或其他合规条件，取决于最终使用的域名、服务组合和是否购买 China Network；本次不注册账号、不提交备案、不作法律结论。

## 3. 与完整 MVP 后端能力的对照

仓库当前 README 已明确 `apps/web`、`apps/api` 仍是旧 React/Express 账户和布局底座，业务模块为空；`PRODUCT_SCOPE` 要求真实六模块 CRUD、真实账户和跨设备持久数据、文件和备份恢复、Office/PDF 预览、Word/PDF 输出、数学 HTML 离线演示，以及能实际操作六个模块的 pi Agent。[README 当前状态](../../README.md)、[MVP 基础交付要求](../PRODUCT_SCOPE.md#基础交付要求)、[工作台 Agent](../PRODUCT_SCOPE.md#工作台-agent)

|完整 MVP 能力|Cloudflare Free 的事实|当前判断|
|---|---|---|
|账户、CRUD、会话和元数据|Workers + D1/DO 在协议层面可以承载 HTTP API、关系数据和会话状态；D1 的 Free 额度对单用户小数据量看起来足够。|**[依据来源推断]** 额度不是业务契约和认证正确性的证明；真实认证、数据隔离、Cookie、跨设备现场恢复仍需在产品实现后验收。|
|真实文件和持久对象|R2 是对象存储，Free 有 10 GB-month 等额度；通过 Worker 代理上传时，Free 请求体上限为 100 MB。|**[依据来源推断]** 可以承载一部分文件保存，但实际文件大小、断点/分片上传、私有下载授权和预览缓存尚未确定。R2 耐久性不等于误删恢复，产品仍需备份和恢复流程。[R2 耐久性](https://developers.cloudflare.com/r2/reference/durability/)|
|数据库备份和整体资料恢复|D1 Free 有 7 天 Time Travel，能恢复数据库状态；R2 提供对象持久化、生命周期和锁定能力。|**[依据来源推断]** 不能把 7 天数据库恢复或 R2 对象锁当作“整体导出、独立备份、误删恢复”交付。至少要设计并实测数据库、文件和关联元数据的一致性备份。|
|长时、可恢复的 Agent 调用|HTTP 请求在客户端保持连接时没有 wall-clock 硬上限，Workflows 可等待和重试；但 Workers Free 每次只有 10 ms CPU，断开后 `waitUntil()` 只有最多 30 秒延伸。[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)|**[依据来源推断]** Cloudflare 编排层可承载等待外部模型和分步状态，但不能因此证明一个完整 pi 工具循环在 Free Worker 中稳定运行。应避免把一次用户请求绑定到任意长的同步进程。|
|pi Agent runtime|当前 pi 官方源码的 `pi-coding-agent` package 声明 Node `>=22.19.0`，shell 实现同时包含 Windows 与 Unix 路径；pi 默认运行时具有启动它的用户和进程权限。[pi 官方 package](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/package.json)、[pi shell](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/utils/shell.ts)|**[依据来源推断]** 仓库 README 的 Node 22.23.2 与当前 pi 源码的最低版本相容，但目标 pi 版本尚未冻结。Workers 的 `child_process` 是非功能 stub，虚拟文件系统是按请求的内存临时空间，不能直接当作完整 pi 宿主。具备所选 Node/pi、工具和持久会话能力的 Windows、Linux 或其他主机均可能成为执行节点，额度和完整能力尚未验证。|
|Word/PDF/PPT 处理与预览|Browser Rendering 可以从 URL 或 HTML 生成 PDF；Workers 可运行部分 JS/Wasm/Node API。|**[依据来源推断]** 这不足以覆盖 DOCX/PPT 输入预览、Office 文件结构保留、可编辑 Word 输出和依赖系统二进制的转换。若最终方案需要系统程序、shell 子进程、字体或完整文件系统，应使用具备这些能力的执行主机或其他已验证运行时；已有 Windows 是候选之一，已有或可取得的 Linux、免费运行环境未被排除，但它们的额度与完整能力尚未验证。具体转换方案尚未选定，不能预先删减范围。|
|模型费用|Cloudflare 托管额度不包含外部模型 API 费用。|模型接入事实、允许模型和 credits 限制统一见[Command Code API 接入说明](command-code-api.md)。本报告不重复模型名单，不调用模型接口；模型费用和托管费用分开核算。|

## 4. 至多两条候选路径

### 路径 A：已有可用主机作为唯一完整运行节点，加 Cloudflare Tunnel

这是当前最符合“不租服务器、不引入集群”的路径。

- 在一台已有且可持续联网的主机上运行完整 Node 后端、pi、文件目录和 Office/PDF 转换工具；数据库和文件也由该节点持久化。用户已有 Windows 设备是候选之一，但不是执行节点的唯一系统条件；其他具备所需能力的主机尚未被排除。
- 使用 Cloudflare Tunnel 将本机服务通过出站连接发布到互联网。Cloudflare Tunnel 官方称所有计划可用；稳定生产 hostname 仍通常需要自有域名和 Cloudflare DNS。[Tunnel 官方文档](https://developers.cloudflare.com/tunnel/)、[发布应用](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)
- 不租服务器的剩余成本是电脑电费、开机和网络可用性，以及一份不在同一工作目录或同一磁盘上的备份。电脑睡眠、关机或网络断开时，其他设备不可用；这不是高可用设计，也不需要为单用户增加高可用组件。
- **[依据来源推断]** 技术能力覆盖面最完整，最容易保留 pi 和 Office/PDF 真实能力；**[尚未验证]** Tunnel URL 在大陆的访问、长连接和三端表现仍需实测。
- `trycloudflare.com` 只能做临时验收或演示，不能作为最终部署，因为官方没有 SLA 且不支持 SSE。[Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)

### 路径 B：Cloudflare Free 承载前端、CRUD、数据和编排，加独立 Agent/文档执行节点

这是 Cloudflare 覆盖面更大的拆分路径，但仍不是纯 Cloudflare 零成本部署。

- Pages 或 Workers Static Assets 承载前端，Workers 承载 API，D1 保存结构化业务数据，R2 保存文件，Workflows 负责可恢复的外部调用和重试。
- 独立执行节点只暴露 pi、Office/PDF 处理和需要完整文件系统的任务接口；它仍需要开机，并可通过 Tunnel 或其他安全通道被 Workers 调用。该节点可以是已有 Windows 主机，也可以是其他具备所需能力的主机，尚未选定。
- 若使用 R2，需要完成 R2 subscription checkout，并接受使用量账单的支付条件；若使用自定义生产域名，需要购买或已有域名。若不用 R2，则文件和备份要回到执行主机或另一个明确的存储目标。
- **[依据来源推断]** 这条路径可以减少执行节点上的普通 CRUD 负担，但不消除它对 pi、文档转换和大陆网络的依赖。只有后续实验确认 Worker 与执行节点之间的任务、超时、幂等和恢复契约后，才能作为正式部署方案。

## 5. 本地完整运行与最终三端验收

本地完整运行是必要阶段，不是最终部署验收：

- 本地阶段应在选定的执行主机上验证真实前后端、账户、CRUD、pi 工具循环、文件保存、Word/PDF/PPT 预览和导出、数学 HTML 下载后在约定 Edge/Chrome 环境离线展示，以及备份恢复。用户侧验收环境保留为 Windows、WPS、Edge/Chrome，不据此冻结执行主机系统。
- 本地阶段只能证明程序和系统依赖在这台电脑上可用，不能证明公网 URL、Cloudflare quota、Tunnel、Cookie 域、跨设备同步、模型 API 访问或大陆网络可用。
- 最终三端验收需要在实际要使用的设备和中国大陆网络上走完整流程：登录和退出、刷新与换设备、上传下载、Office/PDF 预览、Word/PDF 导出、Agent 长任务和流式反馈、备份后恢复，以及数学演示离线打开。还要验证电脑和平板上的 Edge/Chrome 行为；WPS 只影响打开导出的 Office 文件，不等同于浏览器工作台验收。
- **[已证实]** 当前 README 明确目标 MVP 尚未交付，也没有通过验证的 MVP 部署方案；因此本报告不把本地旧应用或原型的可运行状态当成部署成功。[README 验证与部署](../SETUP.md)

## 6. 当前真正需要用户决定的外部事项

不需要现在注册、购买、部署或拍板实现细节。后续开始部署前，最小外部选择只有：

1. 是否允许一台已有且具备所需能力的主机在需要访问工作台时持续开机并连接互联网。已有 Windows 电脑是当前候选；若它不适用，需要另选能运行完整 Node/pi/Office/PDF 的主机，可能产生托管费用。
2. 是否接受为稳定生产 URL 支付域名注册/续费费；不接受时只能使用平台子域名或测试 URL，不能把它们当作大陆可靠生产入口。
3. 备份放在哪里，且是否与执行主机分离；若选择 R2，还要在后续确认账户能否接受 R2 subscription 和支付方式。
4. 在实现完成后配合一次中国大陆真实网络的三端验收。是否购买 Cloudflare China Network 不是当前默认选项，只有实测结果和可接受性要求证明全球路径不足时才需要重新评估；其官方前置条件是 Enterprise、单独订阅和 ICP，价格本次未查到公开数字。[China Network 入门](https://developers.cloudflare.com/china-network/get-started/)

## 当前状态标签

- **已证实**：Cloudflare Free 的额度、Workers/Pages/D1/R2/Workflows/Containers 的官方限制；免费平台子域名与自有域名的费用区别；China Network 的 Enterprise、ICP 和 Pages/R2 限制；仓库当前尚未交付真实 MVP。
- **依据来源推断**：Cloudflare Free 适合做轻量前端、CRUD、元数据和编排，但不能直接承载完整 pi 与 Office/PDF 系统处理；已有可用主机加 Tunnel 是最少外部设施的候选路径之一，尚未冻结。
- **尚未验证**：中国大陆真实访问、目标三端的性能和稳定性、最终文件转换方案、pi 版本和工具契约、实际配额消耗、备份恢复流程，以及 R2 在目标账户的支付/开通条件。

## 关键官方来源

- [Cloudflare Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/) / [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Pages 限制](https://developers.cloudflare.com/pages/platform/limits/) / [Pages Functions 价格](https://developers.cloudflare.com/pages/functions/pricing/)
- [D1 价格与限制](https://developers.cloudflare.com/d1/platform/pricing/) / [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [R2 价格](https://developers.cloudflare.com/r2/pricing/) / [R2 入门与订阅](https://developers.cloudflare.com/r2/get-started/)
- [Cloudflare Registrar](https://developers.cloudflare.com/registrar/)
- [Cloudflare China Network 概览](https://developers.cloudflare.com/china-network/) / [FAQ](https://developers.cloudflare.com/china-network/faq/) / [可用产品](https://developers.cloudflare.com/china-network/reference/available-products/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/) / [Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [Cloudflare Containers](https://developers.cloudflare.com/containers/) / [Containers 价格](https://developers.cloudflare.com/containers/platform/pricing/)
- [Cloudflare Workers Node.js 兼容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) / [Workers `fs`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)
- [pi 官方源码 package.json](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/package.json) / [pi shell](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/utils/shell.ts) / [LibreOffice 系统要求](https://www.libreoffice.org/system-requirements/)
