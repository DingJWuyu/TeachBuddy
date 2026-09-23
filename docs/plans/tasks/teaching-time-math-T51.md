# T51-MATH 领域任务参考

扩展已冻结并有实现，当前任务先读[教学入口](../../modules/teaching-time.md)。本页保留职责与验收条件，不是重新实现的指令。

- 背景与目标：在已交付普通班级记录上消费冻结数学接缝，实现完整记录 v2、作品选择与三类来源的双向反馈。所属 T51 接续，不自行扩 DAG 或派业务 session。
- 输入固定：从[当前输入](../run-inputs.md#暂停与后续设计)读取冻结扩展；新任务另固定实际产品候选、真实 math 提供方及写者。不采用初始设计的旧产品 HEAD。
- 模型与 skill：按[当前路由](../execution-protocol.md#模型与固定派发)，本页不复制模型配置。
- 必读：[新版契约](../../contracts/teaching-time-math.md)、其完整 OpenAPI 与 TM-C1-C7/样本；[UX](../../ux/teaching-time-math.md)、[架构写权](../../arch/teaching-time-math.md)、[WB-TM001-010](../../acceptance/teaching-time-math.feature)；[执行协议 implementation/receipt](../execution-protocol.md#implementation)及[技能路由](../skill-routing.md)。原 T50 的班级/共同协议按链接补读，时间算法不重设计。
- 写入边界：本任务独占 classes 前后端、classes 新迁移、teaching-time-classes API/E2E 测试及独占 fixtures；正式证据 `docs/acceptance/evidence/T51-MATH/v1/`。math、schedule、资源、共享目录/入口/锁文件和根台账归其原拥有者；共享需求列入本回执交外层唯一装配者。只在派发的 branch/worktree 开发，本包不授权 main 合并、push、部署。
- 完成条件：新旧记录共库且旧接口拒绝有损访问；math 首次标签、删源保留/重连、完整反查、404/503、冲突/幂等重放符合 TM-C1-C7。修正旧消费者 404→deleted 偏差并覆盖受影响 lesson/question 行为。新 Web 记录及反查统一使用 v2，给 M43 导出可组合反馈组件；日程摘要形状与行为不变。
- 验证：在隔离数据目录用公开 HTTP/真实 SQLite 验证 CRUD、迁移和重启，包括空库与含旧记录/旧成功回执的升级库；运行固定底座 `npm run test:api`、`npm run build`，以及本节点的 `npm run test:e2e -- apps/web/e2e/teaching-time-classes*.spec.js` 对应实际文件。浏览器验证两视口选择、取消、两班回看、草稿返回、保存失败；不写 UI 单元测试。真实提供方未到可用 TeachingWork 同版 adapter 先做局部自验，必须列明替身，不能将 WB-T020 标 PASS。实现收尾按适用 code-review skill 进行一次内部双轴审查，固定已提交候选，非本设计 session 代做。
- 回执：固定 base/result SHA、实际 model/effort、命令/场景证据和身份模式；同时提交短 integration 说明列真实 math SHA 或缺口、反馈组件出口、实际公共装配文件请求。局部 self 不等于完整 T51；完整 self 仍需 M44，独立验收归后续 T54。
- M43/单写者接续：M43 自身 M42/R35 前置不变；本包冻结且 T51 输出到达后，消费新反馈组件与稳定作品路由，串行接手公共文件采用目录 v3。M44 的提供方验收不等待 classes 反馈；WB-T020 必须在真实提供方及新的固定组合上验证。T54 验证任务指定的真实组合。

发起执行前由外层填齐实际候选、worktree、真实提供方和唯一共享写者；本文件不是 worker 自行启动其他 session 或修改现行验收输入的授权。
