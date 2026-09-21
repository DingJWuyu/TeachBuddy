# API 指南：旧演示应用

[返回主 README](../README.md)

本文描述 `apps/api` 在代码基线 `911e624` 的实际接口，供运行和迁移旧底座时参考。它不是 MVP 前后端契约。新的[认证契约](contracts/auth.md)已确认同源 Cookie 方向，但尚未完成；工作台业务契约将随真实流程形成，入口由[路线图](ROADMAP.md)维护。

旧接口替换后，本文改为实际契约的导航，不再维护另一份字段定义。下文的 Bearer、错误格式和空模块列表不能作为新实现要求。

## 基础地址

本地 API 地址为 http://localhost:4000/api。

除健康检查和账户入口外，API 路由都需要 Bearer 令牌。令牌通过注册或登录响应返回。

## 健康检查

- GET /api/health

响应包含应用名称、运行环境、状态和当前模块数量。当前模块数量为 0。

## 账户入口

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/password-reset/request
- POST /api/auth/password-reset/confirm
- GET /api/auth/me

注册请求接受 name、email、password 和 passwordConfirmation。邮箱按不区分大小写的规则保持唯一，注册成功后返回令牌并进入工作台。

密码找回请求接受 email。无论账户是否存在，都返回统一的 202 响应；已存在的账户会收到一次性六位验证码。验证码保存为非明文形式，十分钟后过期，确认成功后立即失效。

## 模块目录

- GET /api/modules

当前响应固定为空列表：

~~~
{ "items": [] }
~~~

模块注册契约由 packages/shared 提供。未来模块可以声明身份、侧栏入口、自有面板和后端能力；当前 API 不绑定首页聚合字段。

## 工作台布局

- GET /api/workspace/layout
- PUT /api/workspace/layout

布局按教师账户保存，响应包含：

~~~
{
  "hiddenModuleIds": [],
  "groups": [],
  "ungroupedModuleIds": []
}
~~~

分组 ID、模块位置和数组结构会在保存时校验。当前目录为空，因此默认布局和未分组区域均为空；核心首页和设置入口不属于可隐藏模块。

布局保存支持未来目录中的模块 ID。读取布局时，目录中尚未出现在布局里的模块会追加到未分组区域。

## 数据边界

账户、密码找回记录和工作台布局按教师账户隔离。当前版本不提供功能模块业务路由，也不提供模板、上传、导出或跨模块自动化端点。

## 统一错误

验证失败通常返回 400，认证失败返回 401，资源不存在返回 404，邮箱重复返回 409。响应使用 message 和 path 字段描述错误。
