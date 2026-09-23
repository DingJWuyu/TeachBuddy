# 数学关联交换用例

教学记录 v2 数学关联验收规格。精确形状见 [OpenAPI](teaching-time-math.openapi.json)，语义见[契约](../teaching-time-math.md)。[机器样本](math-samples.json)中的 `valid` 只表示 schema 判断，`exchanges` 才记录跨请求的预期；样本本身不是产品通过记录。

固定账户 A/B 由可信测试入口提供，客户端不提交 accountKey。C1/C2、L1、Q1、R1 复用[旧用例](cases.md)；W1 为 `60000000-0000-4000-8000-000000000001`，R2 为 `30000000-0000-4000-8000-000000000002`。初始时间 `2026-09-21T06:00:00Z`，记录日期 `2026-09-21`，每次写入推进一分钟。W1 初始 title=“函数图象”、version=1、deletedAt=null。真实复验通过公共操作建立对象并映射真实 ID，固定 UUID 仅用于同版替身。

所有 HTTP 写入沿 T50/B11 的 Cookie、同源保护、Content-Type、独立 Idempotency-Key；成功和失败均 no-store。每个分支使用独立 fixture，除明确连续步骤外不跨 case 继承状态。

## TM-C1 新旧记录与当前作品

1. `POST /api/modules/classes/v2/records` 使用 `create-mixed` -> 201 `record-linked`。sources 顺序 lesson/question/math，W1 首次标题为“函数图象”。只填一句话无来源的 `create-quick-v2` 同样可保存。
2. v2 GET 旧无 math 记录 -> 同 ID/version/updatedAt/labelAtLink；旧 GET 仍能读。v2 PUT 给旧记录补 math，只加一次 version；v2 保存与旧记录处于同一班级列表。
3. 通过 math 公共操作改 W1 为“二次函数图象”，再 GET R1 -> `record-renamed`，除 sources 的 currentLabel 外逐字段等于 `record-linked`。提供方新 version 不增加记录 version/updatedAt。
4. 活动但 render=invalid 的作品可被新记录关联；数学渲染、源码、导出或快照不进入教学请求。`workVersion/accountId/labelAtLink/attrs` 等客户端附加字段被严格拒绝。

## TM-C2 软删除、保留、移除、重连

1. 删 W1；v2 GET R1 -> `record-work-deleted`，deleted=true，原文、保存时标题、version/updatedAt 不变。反查 math/W1 仍可返回它，作品只读路由仍可打开。
2. v2 PUT R1 保留原 sources，改 note -> `record-retained-update`（version=2）；新建记录或原记录成功移除后再添加 W1 -> 409 `error-deleted`，无部分记录/关联或成功回执。
3. v2 删除 R1 -> version+1，反查不再返回；v2 恢复 R1 -> version+1，原来源恢复并仍标作品已删除。删 C1 时 R1 只读且不进入反查；仅恢复 C1 不恢复单独删除的 R1。
4. 恢复 W1，现有 R1 链接只改 deleted=false；若此前已移除，重新添加成功，以当前标题重新保存 labelAtLink。

## TM-C3 两班反查与完整结果

1. 两班各建混合记录指向 W1。R1.updatedAt=06:00Z、R2.updatedAt=06:01Z，recordedOn 相同；`GET /api/modules/classes/v2/source-records/math/W1` -> `reverse-two-classes`，顺序 R2/R1，完整来源保留，班级可辨认。
2. v2 反查 lesson/L1、question/Q1 同样返回含 math 的完整记录。删 W1 仍返回，删 R2 或 C2 只剩 R1。相同时间/日期时 ID 升序；恢复后重新按排序返回。
3. 不存在或 B 账户作品 -> 404；先校验来源，不可返回 `{items:[]}` 掩盖越权。提供方 503 或列表某记录的其他来源投影失败 -> 整次失败，无部分成功。

## TM-C4 旧接口的可表示性

| 动作 | 预期 |
| --- | --- |
| 旧 GET R1（含 math，包括已删除 R1） | 422 `error-v1-record` |
| 旧 GET records?classId=C1&state=active 或旧反查 lesson/L1，匹配集中有 R1 | 422 `error-v1-list`；不能只返回能表示的行或删掉 math |
| math 记录不在所请求 classId/state/反查匹配集合内 | 不影响此旧查询，返回原可表示结果 |
| 旧 PUT R1 使用当前版本并提交只含 lesson/question 的完整体 | 422 `error-v1-record`，不能借覆盖移除 math |
| 旧 POST R1/deletion 使用当前版本 | 422 同上，不改变删除态 |
| 上两项 expectedVersion 已过期 | 409 `error-version`，先于可表示性检查 |
| 旧创建/更新体带 math 或旧 source-records/math/W1 | 422 invalid-input，字段和 reason 见契约；旧 schema 继续拒绝 |
| v2 显式移除全部 math，随后旧 GET | 返回原 Record 形状；旧 expectedVersion 仍不可覆盖新版本 |

## TM-C5 丢响应、版本与隔离

先在旧路径成功创建无 math 的 R1（K1），丢弃响应；通过另一操作 v2 给 R1 加 math。保库重启后用 K1、旧路径、原体重试 -> 原 201/原 Record/version=1，不查询当前来源；随后 v2 GET 取得 version=2，二者各自正确。把 K1 改投 v2 路径 -> 409 `error-key-reused`。新版成功写同样可跨重启重放，不重新验证已改变/删除的作品。

基本 schema 和身份保护仍先于重放，外账户不能得到 A 的成功结果。401/403/404 按原协议；v2 旧版本更新 -> 409 currentVersion/objectId，全部草稿和 sources 保留，对照后新键保存。未知结果不换路由或新键重发。

## TM-C6 故障与输入拒绝

- 首次保存/已有记录读取/反查中注入 math 存储 503 -> `error-unavailable`，写入与成功回执回滚；恢复后原键只成功一次。任何 provider 404 -> `error-not-found`，不得伪装 deleted=true，tombstone 成功结果与错误明确区分。
- 两个同 kind/id source 形状合法但业务拒绝 `422 invalid-input`、`/sources/1/id`、`duplicate-id`；math 与 lesson 恰好同 UUID 是不同来源。
- 输入 `kind=work`、多余 workVersion/accountId/attrs/labelAtLink、缺 math id、非法 UUID 或 null sources 均失败；五段文字全空即使已选作品也无有效教学记录，仍按旧规则拒绝。
- 提供方不存在导致旧关联读取失败时保留旧画面和草稿；用户可显式移除该关联并保存其余有效内容。删除/恢复操作返回完整 RecordV2，若投影失败须回滚本次状态变化，不能成功删记录却返回伪造 sources。

## TM-C7 目录与无关行为保留

`catalog-combined-target` 逐字值取自固定 M40 样本：version=3，六模块顺序和 requires 相同。生产投影实际模块子集；数学与教学时间真实装配时 classes 必须含 math.readForTeachingLinkV1。静态 duplicate-id/path、缺 math 提供方、依赖环变体按旧 TT-C7 的 field/reason 拒绝，不能用 shape valid 代替语义校验。

原 79 个 T50 样本、schema、时间/提醒/班级操作仍保留；新 schema 的原 60 个 schema 与所有 schedule 操作逐项相等。记录作品更新/删源不重置 armedAt、不结算或生成通知、不写日程。已有日程关联 R1 时仍使用原 RecordReference，math 故障不影响该摘要。实现变更须验证这些不变量，当前已测范围见[能力证据](../../plans/run-inputs.md)。
