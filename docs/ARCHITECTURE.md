# 当前代码结构

本页描述 `TeacherWorkspace-preview` 的实际产品。产品基线与运行限制见[当前台账](plans/run-state.md)；接口精确结构见[API 导航](API.md)，不从旧演示应用推导新契约。

## 请求与数据路径

```text
React 页面
  → 认证 transport（同源 Cookie、页面上下文）
  → Express / workbench 公共入口
  → 所属模块服务与公共端口
  → SQLite 事务、文件存储、转换任务
```

这是一个应用和一个 SQLite 持久底座。六模块通过单一静态目录装配，不拆成多服务或动态插件平台。重大约束见 [ADR 0001](adr/0001-use-a-single-static-module-catalog.md)。

| 代码位置 | 当前职责 |
| --- | --- |
| `apps/web/src/features/workbench/` | 外壳、共享文稿/保存/冲突/现场与支持页 |
| `apps/web/src/features/auth/` | 认证页面、会话恢复、请求 transport |
| `apps/web/src/features/{questions,lessons,resources,math,classes,schedule}/` | 六领域的界面与交互 |
| `apps/api/src/server.js` | 同源 HTTPS、启动完成后监听、停止连接 |
| `apps/api/src/app.js` | 组合认证、workbench、API 和 Web 构建产物 |
| `apps/api/src/features/auth/` | 真实账户、会话、页面绑定、验证码、迁移与恢复操作 |
| `apps/api/src/workbench/` | 共享身份、校验、幂等、迁移、目录装配、文件和任务底座 |
| `apps/api/src/modules/` | 题库、备课、资源、数学、班级和日程业务 |
| `apps/api/src/workbench/reliability/` | 个人资料包、备份、恢复与维护锁 |
| `packages/shared/` | 两侧消费的静态模块目录及共享定义 |
| `prototype/` | 已确认 UI/UX 的参考，生产运行不依赖原型源码 |

实际 API 装配映射在 `apps/api/src/workbench/moduleImplementations.js`；前端从对应静态目录消费入口。新增能力先找所属模块，不增加另一套全局注册表。

## 持久化与失败语义

业务通过自己的服务、仓储及迁移处理数据；跨模块采用公开端口，避免直接操作别人的表。保存、版本冲突、幂等与未知结果的共同规则由[工作台契约](contracts/workbench.md)拥有。

SQLite、持久文件目录、认证密钥和外部转换工具各有独立运行配置。UI 本地草稿和现场不等于服务端内容；备份仅复制数据库也不足以恢复文件。当前真实运行位置和保护方式见[运行指南](SETUP.md)。

## 修改影响从哪里查

- 业务模块变更：从[领域页](README.md#功能规格)查相关 UI、API、契约和测试。
- 共享写入、迁移、锁文件或全局样式：单一写者，核对实际消费者。
- 认证恢复：读取固定恢复操作，不在外层重新实现认证清理。
- 产品 Agent 代码仍装配，但开发暂停；它的存在不要求手动业务任务继续扩工具。

设计文档表达约定，源代码表达实现，具名证据表达已验证结果。发现三者不一致时指出具体位置与影响，不能靠改状态文字消除缺陷。
