# 数学网页 AI 连接扩展

本扩展仅在 localhost / 127.0.0.1 工作台和 chat.deepseek.com 运行。使用用户正常登录的官方网页，每个工作台 tab/session 创建专用 DeepSeek tab。无 cookie/token 读取，无付费 API，无站内 HTTP 模拟，无额外服务。关闭工作台后保留 DeepSeek tab，扩展只移除绑定。

## 安装与连接

1. Chrome / Edge 打开 `chrome://extensions` / `edge://extensions`，开启开发者模式。
2. 选择“加载已解压的扩展程序”，选本目录 `extensions/math-web-ai`，无需构建。
3. 刷新工作台页面，点击工作台的连接操作。扩展创建专用 DeepSeek 后台标签页；需要登录时自动切到该标签页。用户正常完成登录及验证码后，回工作台再次连接。
4. 保留专用 DeepSeek 标签页。在工作台发送数学请求，完整回复自动回到工作台。不要在专用标签页切换其他会话或同时编辑草稿。

扩展文件修改后，在扩展管理页点击重新加载，再刷新工作台和专用 DeepSeek 标签页。扩展由隔离脚本读写网页 DOM，不更改浏览器安全策略。页面改版导致选择器失效时显示错误，超时不会自动重发。

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

`STATUS` 用于发现扩展；`CONNECT` 重复调用复用该工作台会话已创建的专用 tab；`SEND` 只允许一个活跃请求，`PROGRESS` 的 text 是累计正文，只有 `DONE` 可用于完整指令解析；`CANCEL` 使用原 SEND 的 requestId。取消产生 `ERROR/CANCELLED`，后续迟到结果被后台丢弃。工作台也应按 requestId/sessionId 丢弃失效结果。新数学会话必须使用新 sessionId。

收到 `CONNECTED.loginRequired` 仍需登录，不代表模型请求已通过。发送前有草稿或网页正在生成时明确报错。发送成功由新增匹配 user 消息及输入清空确认，完成还要求新增 assistant、流式标志消失、回复动作按钮出现和正文稳定。真实 DeepSeek DOM 及后台标签页行为须由登录后的端到端验证确认。

回复动作按钮可能是消息的兄弟节点，扩展只在仅包含当前一条消息的回复容器中检查，避免旧回复按钮提前结束新请求。结构化指令优先从 `pre code` 精确读取，模型应输出 fenced JSON，以保留 `a*x^2` 等表达式中的乘号并排除代码块语言标题。

## 受控验证

从仓库根目录执行已入库的离线 Chromium 集成回归：

```bash
npm ci
npx playwright install chromium
node extensions/math-web-ai/test/offline.mjs
```

Linux 新环境缺浏览器系统依赖时，按仓库运行指南安装，或使用 `npx playwright install --with-deps chromium`。测试使用仓库 Playwright 和系统临时目录中的全新隔离 profile，不读取个人浏览器配置，也不依赖 `test-results` 中的旧证据。成功自动删除 profile，失败保留 profile 并打印现场位置。

脚本实际加载 MV3 扩展，覆盖发现与连接、连续两轮、当前回复兄弟 footer、代码块中乘号与语言标题、取消后迟到结果、独立标签页和关闭错误。DeepSeek URL 由入库 HTML 夹具响应，其他请求中止，并禁用测试浏览器 DNS 解析，防止扩展新建标签页在 Playwright 挂载拦截前访问真实站点。此回归不登录账户、不调用真实模型，不证明线上网页、登录状态或生成流程仍兼容。

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

DOM 适配参考 MIT 项目 [Better DeepSeek](https://github.com/EdgeTypE/better-deepseek/tree/1c5453f18241a118257293700f640cb0ee5e7e1e/src/content) 的输入事件、消息角色和生成状态做法；本实现为专用消息桥，没有引入该项目源码或运行依赖。
