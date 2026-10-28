# 数学网页 AI 连接扩展

本扩展仅在 localhost / 127.0.0.1 工作台和 chat.deepseek.com 运行。使用用户正常登录的官方网页，每个工作台 tab/session 创建专用 DeepSeek tab。无 cookie/token 读取，无付费 API，无站内 HTTP 模拟，无额外服务。关闭工作台后保留 DeepSeek tab，扩展只移除绑定。

## 安装与连接

首批支持桌面 Chrome 与 Edge。产品连接设置按浏览器提供对应商店入口，安装后返回工作台，再按提示登录 DeepSeek。商店链接尚未配置时如实显示尚未上架；网站不能静默安装扩展，不能用占位链接冒充可安装条目。当前发布条件与验收范围见[项目状态](../../docs/plans/run-state.md#剩余事项)。

开发者可在 Chrome / Edge 扩展管理页加载本目录，或按开发包内的 `INSTALL.txt` 操作。此流程只供本机测试，不在老师的日常连接界面中展开。

安装或更新时扩展接入已打开的受支持页面，工作台重新探测连接，不重载作品或自动重发对话。正常商店更新由浏览器负责；新增权限可能需要用户确认。现有兼容版本继续使用，真正不兼容时才提示更新。关闭专用 DeepSeek 标签页后可从工作台重新连接。

### 可分发安装包

从仓库根执行：

```bash
node scripts/math-web-ai/package.mjs
```

产物为 `apps/web/public/downloads/teachbuddy-math-web-ai.zip`，产品下载地址固定为 `/downloads/teachbuddy-math-web-ai.zip`。在 web 构建复制 public 前执行；隔离构建可传入自己的 public 目录作为第一个参数。脚本使用仓库已有 JSZip，以固定时间和明确文件清单生成 ZIP，不包含测试夹具、任务产物或本机路径。安装后保留解压目录，Chrome 会从该目录加载扩展。资源准备脚本可导入 `packageMathWebAiExtension(publicDir)`，产物路径由返回值提供。

扩展文件修改后，在扩展管理页点击重新加载；已打开页面通过重新注入恢复连接。扩展由隔离脚本读写网页 DOM，不更改浏览器安全策略。页面改版导致选择器失效时显示错误，超时不会自动重发。

### 商店发布

生成 Chrome Web Store / Edge Add-ons 上传包：

```bash
node scripts/math-web-ai/package.mjs --store /absolute/output-directory
```

上传包的 `manifest.json` 位于 ZIP 根目录，包含运行脚本与项目现有图标，不包含本机安装说明、测试或账号配置。`icons/` 由工作台 `apps/web/public/favicon.svg` 生成；修改图标时用 `rsvg-convert --width <尺寸> --height <尺寸>` 重新导出对应 PNG。

正式条目发布后，将其真实 HTTPS 地址作为 Web 构建环境变量 `VITE_MATH_AI_CHROME_STORE_URL`、`VITE_MATH_AI_EDGE_STORE_URL` 传入，再构建前端。开发服务可在根 `.env` 中设置并重启。只接受对应官方商店的条目地址，默认留空。改变配置不自动发布扩展；同一扩展在两个商店分别维护条目和版本。正式工作台域名确定后，还须将该域名加入允许访问的地址并实际验证，当前包只连接本机工作台。

可使用的商店说明：

> 在 TeachBuddy 数学工坊中连接你已登录的 DeepSeek 网页账号。描述想画的内容，查看并继续修改当前数学作品。需要同时使用 TeachBuddy 工作台和 DeepSeek；这是独立的连接助手，与 DeepSeek 官方无隶属关系。

权限用途：`storage` 保留扩展重载或更新所需的连接关系；`scripting` 在安装或更新后接入已打开的工作台与 DeepSeek 页面；站点权限仅用于上述指定页面的连接和消息传递。全部扩展脚本随安装包提供，不下载执行远端脚本；模型回复作为数据送回工作台，由工作台校验并执行允许的数学操作。

商店账号、真实联系信息、公开隐私说明地址和审核可访问的工作台由发布者准备。截图使用当前真实界面，放在发布产物中，不收录进文档。提交包、审核通过、商店安装、浏览器自动更新是不同状态，按实际验证记录。发布操作仍遵守项目授权边界。

发布流程以 [Chrome 上架要求](https://developer.chrome.com/docs/webstore/prepare)及 [Edge 上架说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)为准。

### 数据说明

扩展只在老师发起对话时，将工作台提供的请求、当前数学作品上下文及必要对话内容发送到 DeepSeek 网页，随后把回答送回工作台。内容由用户所登录的 DeepSeek 服务处理，适用其服务规则。扩展不读取账号密码、Cookie 或令牌，不访问其他业务模块数据，不提供额外遥测或广告服务。

会话标识、标签页连接信息和未完成请求的标识保存在扩展的浏览器本地存储中，以便扩展更新时恢复连接；浏览器新启动时清除这些临时绑定，不存储请求正文或账号凭据。工作台负责自身的对话和作品保存；扩展卸载不等于删除工作台作品或 DeepSeek 中已经产生的对话。发布者应为这份说明提供公开可访问的地址和真实联系渠道，再填写商店隐私声明。

## 页面消息协议

页面使用 `window.postMessage(message, location.origin)`。请求：

```js
{ source: 'teachbuddy-workbench', type: 'STATUS' | 'CONNECT' | 'SEND' | 'CANCEL',
  requestId: '唯一请求ID', sessionId: '工作台会话ID', prompt: 'SEND时的完整上下文和请求' }
```

响应：

```js
{ source: 'teachbuddy-web-ai', type: 'STATUS' | 'CONNECTED' | 'PROGRESS' | 'DONE' | 'ERROR',
  requestId, sessionId, text?, providerSessionUrl?, loginRequired?, code?, message? }
```

注入时另发 `AVAILABILITY` 与 `extensionVersion`，仅通知工作台重查 `STATUS`，不证明已登录或可生成。新版回复携带扩展版本，避免更新前残留脚本的断连错误覆盖新连接。更新中止未完成请求，不自动重发；0.1 升级时旧会话存储会被浏览器清除，原 DeepSeek 页面保留，但须重新连接。

`STATUS` 用于发现扩展并探测既有专用网页，不创建标签页，不发送消息。响应包含 `extensionVersion`、`connectionState`，连接状态为 `available`（已安装但当前会话尚未连接）、`connecting`、`login`、`ready` 或 `disconnected`，另有 `loginRequired`、`providerSessionUrl` 和断连 `reason`。无扩展时没有响应；工作台请求超时后显示安装引导。UI 在展开、页面恢复焦点和扩展接入通知后重新请求 STATUS，以识别登录完成、网页刷新或关闭。状态仅说明 DOM 桥可用，不证明模型请求已成功。

`CONNECT` 重复调用复用该工作台会话已创建的专用 tab；`SEND` 只允许一个活跃请求，`PROGRESS` 的 text 是累计正文，只有 `DONE` 可用于完整指令解析；`CANCEL` 使用原 SEND 的 requestId。取消产生 `ERROR/CANCELLED`，后续迟到结果被后台丢弃。工作台也应按 requestId/sessionId 丢弃失效结果。新数学会话必须使用新 sessionId。

收到 `CONNECTED.loginRequired` 仍需登录，不代表模型请求已通过。发送前有草稿或网页正在生成时明确报错。发送成功由新增匹配 user 消息及输入清空确认，完成还要求新增 assistant、流式标志消失、回复动作按钮出现和正文稳定。真实 DeepSeek DOM 及后台标签页行为须由登录后的端到端验证确认。

回复动作按钮可能是消息的兄弟节点，扩展只在仅包含当前一条消息的回复容器中检查，避免旧回复按钮提前结束新请求。结构化指令优先从 `pre code` 精确读取，模型应输出 fenced JSON，以保留 `a*x^2` 等表达式中的乘号并排除代码块语言标题。

## 受控验证

从仓库根目录准备锁定依赖与 Chromium，再执行真实 MV3 桥回归：

```bash
npm ci
npx playwright install chromium
node --test extensions/math-web-ai/test/rebuilt/*.test.mjs
```

用例加载仓库扩展和固定网页夹具，使用全新隔离 profile；首个提供方 tab 导航前即设置不可达本机代理及 DNS 隔离，受控页面由 Playwright 路由返回，其余请求拒绝。测试不读取个人浏览器、不登录账号，也不调用真实模型。成功清理 profile，失败保留具名现场。

保护连接探测、同会话 tab 复用、连续两轮完整代码回复、取消后迟到结果，以及扩展重载后的原页面接续。精确收集以测试源码为准，具名运行结果见[运行台账](../../docs/plans/run-state.md#核查入口)；工作台界面接线从[数学专项](../../docs/acceptance/README.md#数学专项)进入。

开发扩展重载不证明 Chrome/Edge 商店签名、安装或自动下载更新，受控 DOM 不证明线上 DeepSeek 页面持续兼容。正式商店与真实浏览器专项仍需已发布条目、目标设备和授权。旧0.1兼容快照位于 `test/fixtures/legacy-0.1/`，来源见其 `provenance.json`；是否执行该升级路径须单独列明，不能从当前版本重载通过推断。

Linux 缺浏览器系统依赖时按运行指南准备，或执行 `npx playwright install --with-deps chromium`。测试不以本机旧 `test-results` 为启动前置。

无需账号的桥测试：在本机工作台打开控制台，安装本扩展后监听响应，再只发送 STATUS。

```js
window.addEventListener('message', (event) => {
  if (event.source === window && event.origin === location.origin && event.data?.source === 'teachbuddy-web-ai') {
    console.log(event.data);
  }
});
window.postMessage({ source: 'teachbuddy-workbench', type: 'STATUS', requestId: 'probe-status', sessionId: 'probe' }, location.origin);
```

此操作不创建远端会话，不发送模型消息。真实验证由用户登录后的专用 tab 执行 CONNECT 和两轮 SEND；普通网页夹具只验证事件和 DOM 行为，不能代替真实 DeepSeek 成功。扩展不需要单元测试。
