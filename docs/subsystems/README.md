# 当前技术入口

修改实现、存储、模块装配或跨模块访问时从本页选技术职责，沿源码符号核对真实路径。产品行为归[规格](../README.md#功能规格)，交换保证归[契约](../README.md#契约说明)，运行准备归[SETUP](../SETUP.md)，验证选择归[验收入口](../acceptance/README.md)。接口、状态、兼容或失败行为改变时同步所属技术页；内部重排只更新源码与调用指针，不复制 DTO、完整路由或执行日志。

| 要解决的问题 | 技术页 |
| --- | --- |
| 登录表单、认证 transport、身份交接及账户生命周期 | [账户与身份](identity.md) |
| 外壳/导航/偏好、保存事务、文稿、文件/Job/识别与资料包/维护恢复 | [公共底座](foundation.md) |
| 对话、pi/provider、SSE、工具与持久 journal | [AI 助理](agent.md) |
| 题目 CRUD、富文稿复制、收录校对与题面输出 | [题库](questions.md) |
| 资源整理、替换/恢复历史文件与正文查找 | [资源库](resources.md) |
| 作品、版本、图片和离线课堂输出 | [数学工坊](math.md) |
| 安排与重复实例、修改前提醒结算与通知 | [日程](schedule.md) |
| 名单、成绩导入确认、统计和后端维护 | [班级](classroom.md) |

## 代码结构

### 请求与数据路径

```text
React 页面
  → 认证 transport（同源 Cookie、页面上下文）
  → Express / workbench 公共入口
  → 所属模块服务与公共端口
  → SQLite 事务、文件存储、转换任务
```

这是一个应用和一个 SQLite 持久底座。[八个产品分区](../PRODUCT_SCOPE.md#产品分区)用于职责与任务归属，其中五个教学业务模块通过单一静态目录装配，班级当前只注册后端；账户与身份、工作台与设置、AI 助理由应用组合。产品分区不要求一一对应顶层代码目录。重大约束见 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)；修改模块按本页技术导航找到其真实操作和状态约束。

| 代码位置 | 当前职责 |
| --- | --- |
| [apps/web/src/features/workbench/](../../apps/web/src/features/workbench) | 工作台与设置的外壳、导航、偏好、SettingsControls 和支持页；公共传输/设备状态/保存与文稿组件使用下面独立入口 |
| [apps/web/src/platform/](../../apps/web/src/platform) | 公共 HTTP transport、设备存储/现场与保存协议，按 http/device/saving 职责聚合 |
| [apps/web/src/components/](../../apps/web/src/components) | 公共文稿呈现/编辑、交互原语与图标；不拥有模块业务数据 |
| [apps/web/src/features/auth/](../../apps/web/src/features/auth) | 账户与身份的认证页面、会话恢复及请求 transport；删除确认后调用 App 注入的设备清理端口，各存储拥有者清理自己的资料 |
| `apps/web/src/features/{questions,resources,math,schedule}/` | 依次对应题库、资源库、数学工坊、日程的界面与交互 |
| [apps/web/src/features/agent/](../../apps/web/src/features/agent)、[apps/api/src/agent/](../../apps/api/src/agent) | AI 助理的对话、引用、模型运行与工具调用；首页/侧栏由工作台承载 |
| [apps/web/src/features/reliability/](../../apps/web/src/features/reliability) | 设置消费个人资料导出；隔离 archive/恢复底座保留，设备草稿管理 UI 未接入 |
| [apps/api/src/server.js](../../apps/api/src/server.js) | 同源 HTTPS、可选 Vite 开发服务、启动完成后监听与停止连接 |
| [apps/api/src/app.js](../../apps/api/src/app.js) | 组合认证、workbench、API 和 Web 入口，公开 close 统一释放运行资源；不公开旧 dataStore |
| [apps/api/src/features/auth/](../../apps/api/src/features/auth) | 账户与身份的账户、会话、页面绑定、验证码、迁移、删除与恢复操作 |
| [apps/api/src/contracts/](../../apps/api/src/contracts) | API 机器契约及其本地引用，供运行校验和测试读取；文字语义另见[契约说明](../README.md#契约说明) |
| [apps/api/src/workbench/](../../apps/api/src/workbench) | 应用装配与身份适配，以及校验、幂等、迁移、文件、识别和任务等技术底座；其中 `navigation.js` 属于工作台与设置 |
| [apps/api/src/workbench/preferences.js](../../apps/api/src/workbench/preferences.js) | 工作台与设置的账户偏好与输入校验 |
| [apps/api/src/modules/](../../apps/api/src/modules) | 题库、资源、数学、日程和班级业务；`classroom/` 拥有名单、考试及统计，消费公共文件端口 |
| [apps/api/src/workbench/reliability/](../../apps/api/src/workbench/reliability) | 个人资料包、备份、恢复与维护锁 |
| [packages/shared/](../../packages/shared) | 两侧消费的静态模块目录、协议及数学计算、源校验与浏览器/离线呈现；调用方使用 `@refatos/shared` 或显式 `@refatos/shared/math/*` 子路径，实际公开项以 package exports 为准 |
| `prototype/` | 按范围和确认状态读取的 UI/UX 参考；未确认模块稿不定义生产范围，产品运行不依赖原型源码 |

模块事实在 [packages/shared/src/moduleCatalog.js](../../packages/shared/src/moduleCatalog.js)，实际 API 工厂映射在 [apps/api/src/workbench/moduleImplementations.js](../../apps/api/src/workbench/moduleImplementations.js)，`moduleLoader.js` 校验并装配它们。Web 的 `features/modules/moduleRegistry.js` 将共享目录投影为页面与图标，外壳、导航、教程和全局搜索消费同一投影，顶层路由从共享目录匹配。目录 v4 的 `webEnabled` 明确页面开放资格，API 装配全部注册模块，Web 只投影已开放模块；班级不需要占位页面。资源深链接适配归属资源模块；日程由 `modules/schedule/index.js` 内部组合业务与提醒并合并迁移。新增能力先找所属模块，不增加另一套全局注册表。

## 公共持久化与失败边界

业务模块拥有服务、仓储和迁移，跨模块只调用公开端口。应用装配注入公共依赖；共享 mutations 使账户范围的业务变更与成功回执同事务，迁移 runner 按模块定义升级。当前源码路径和公共文件/识别/可靠性调用见[公共底座](foundation.md)，身份交接见[身份技术页](identity.md)。保存、版本与未知结果归[共享契约](../contracts/workbench.md)，恢复完整性归[数据契约](../contracts/data.md)。

组织方式参考 [yetone/magpie 的 subsystem references](https://github.com/yetone/magpie/blob/91b9065a5fdf5b7aa0adeeeb17266c121bf5691c/docs/subsystems/README.md)（MIT，固定版本 `91b9065a5fdf5b7aa0adeeeb17266c121bf5691c`）；本仓按实际职责独立整理。
