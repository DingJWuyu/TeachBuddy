# 资源库技术入口

改资源整理、文件历史或正文查找时读本页。行为见 [资源规格](../features/resources.md)，字段和 operationId 见 [材料 schema](../../apps/api/src/contracts/materials.openapi.yaml)，文件身份和保留保证见 [文件与定位](../contracts/materials.md#文件与定位)。

## 责任与调用面

[createResourcesModule](../../apps/api/src/modules/resources/index.js) 接收 `db/mutations/files/jobs/recognition/now`，返回 `router` 与 `port`。资源库拥有条目、分类、文件版本关联和正文缓存；原件、补充预览及识别任务归公共 files/jobs。条目版本不是 File ID。

业务 definitions 与 `port.operations` 由 [service](../../apps/api/src/modules/resources/service.js) 聚合，模块 [index](../../apps/api/src/modules/resources/index.js) 负责 HTTP 装配与返回公开 port：查询与收录、修改/替换文件、文件历史读取与恢复、批量整理、分类维护、补充预览、正文重试、归档/恢复及彻底删除。精确操作名与输入看 service 的 definitions 和材料 schema 的资源 operationId；没有另一个顶层 operations。`port.readForExport(principal)` 同步读取 resources、stored taxonomy 和 fileRevisions；导出的 `deleteAccountData` 由账户生命周期事务调用。目前 Agent adapter 没有接通全部资源操作，不能把进程内可调用等同模型工具已开放。

## 可信调用与提交

恢复文件历史由服务端当前会话提供 principal，读取条目取得当前 baseVersion，并由老师选择历史 fileVersion：

```js
const result = await resources.port.operations.restoreResourceFile({
  principal: verifiedPrincipal,
  key: logicalRequestKey,
  id: resourceId,
  input: { baseVersion: currentVersion, fileVersion: selectedFileVersion },
});
```

所有操作为异步函数，返回 `Promise<{status, body}>`，读取省略 key。身份不是 input；业务操作按 principal 限定账户并校验 id/query/schema。写操作校验 UUID key 后进入 `mutations.execute`；条目、历史关联与成功回执同事务提交，版本冲突和批量任一对象错误整笔回滚。公共 Error 携带 `status/problem`。未知结果按 [保存协议](../contracts/workbench.md#写入冲突与未知结果) 保留原键原体，不重复创建。

恢复读取 [history](../../apps/api/src/modules/resources/history.js) 中真实历史版本，核验原件与补充 File 仍属于账户，切换当前关联并捕获新历史；分类和备注不随文件回退。彻底删除只移除条目和所属历史关联，受管文件有独立生命周期。

## 运行路径与持久化

- [Web 资源库](../../apps/web/src/features/resources/index.jsx) 先经公共 files 上传不可变文件，再通过 HTTP index 适配到 service/operations 保存条目；文件上传成功与资源收录成功分别确认。
- 替换与恢复共用 `resource_items` 和 [history](../../apps/api/src/modules/resources/history.js) 的 `resource_file_history`；[taxonomy](../../apps/api/src/modules/resources/taxonomy.js) 持有文件夹与标签，删除分类关联的业务由资源拥有。
- 正文查询与重试沿 [text-search](../../apps/api/src/modules/resources/text-search.js)，读取受控文件/页识别成果并维护 `resource_text_cache`；识别任务和费用边界沿 [共用识别](../contracts/recognition.md)。GET 查找不是任意重新跑模型入口。

Web 的 PDF.js worker、CMap 和标准字体随本机构建提供，不依赖外部 CDN。

[模块迁移](../../apps/api/src/modules/resources/migrations/index.js) 提供表结构；其他模块不直接读取这些表，导出沿 readForExport。

## 验证入口

入口和受影响场景统一从[资源验证](../acceptance/README.md#资源专项)选择，执行分工沿[CI 与本地验证](../agents/github-workflow.md#ci-与本地验证)。核对真实收录、文件替换/历史恢复与正文读取；Office 工具、识别回放和真实模型分别记录。技术入口只描述调用路径，不声明本候选通过。
