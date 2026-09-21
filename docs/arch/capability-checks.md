# C20/v1 能力实验设计

状态：READY_FOR_REVIEW，作者自检，不是独立冻结或实验 PASS。输入为 `b938f8af0b8152718f5063d4326d494bf8b5426c` 的 [B11 风险表](first-flow.md#c20-需验证的问题与外部缺口)及已独立通过的 [B11/v1](../acceptance/evidence/B11/v1/review.md)。本包不修改 B11 契约。

## 派发入口

独立冻结本包后，实验者只需读本节、共同边界、自己的短包及其中指定的样本/环境段落，按[执行者协议](../plans/execution-protocol.md#implementation)交付。候选、标准和样本内容以本包所在提交固定；实验结果不能反过来改变门槛。

| 节点 | 短包 | 现在可做 | 真正待补的条件 | 结果消费者 |
| --- | --- | --- | --- | --- |
| C21 提取 | [C21](capability-checks/C21.md) | 固定四入口样本、原生读取、准备 OCR、允许模型的文本/图片探针 | 本任务不读取密钥；执行时由已授权服务端凭据入口注入。OCR 组件尚未安装，模型视觉链路未实测 | R30、R31、R33 |
| C22 Office | [C22](capability-checks/C22.md) | 准备格式样本；在隔离环境安装免费转换器和编辑器后做本机实验 | 本机未发现 Office 编辑器；必须真编辑公式保存。Windows/WPS 设备访问尚未核实 | R30、R32、R34 |
| C23 数学 | [C23](capability-checks/C23.md) | 本机 Chrome 制作、修改、导出和离线冷启动实验；按需安装免费组件 | Windows 课堂设备与大陆实际网络尚未验证，只影响相应环境结论 | M40、M41-M43 |
| C24 pi | [C24](capability-checks/C24.md) | 核实已装 SDK、隔离会话、两允许模型正常输出/无业务工具探针 | 真业务部分必须等 B16 固定服务、页面和运行回执；不能用假服务宣称完成 | C25、C26 |

## 共同边界和交付

1. 每项最多两条候选，优先跑第一条；第一条满足标准即可停止，只有记录了具体缺口才启用第二条。每条完成一次固定样本批次；普通配置/实现错误允许一次修正复测受影响项。两条都不成立时携失败证据回 C20，普通不可行判 FAIL，真实缺设备/权限/凭据判相应切片 BLOCKED。
2. 仅调用 `deepseek/deepseek-v4.1-flash` 与 `z-ai/glm-5.3-flash`；使用用户已授权的 GOAT 套餐额度，不购买服务、不启用充值或付费 fallback。凭据交给已有服务端注入渠道，报告只记引用及脱敏结果。C20 不读写密钥。
3. [EMODEL](evidence/EMODEL.md)仅证明两个精确 ID 返回 HTTP 200。实验者需另证非空正常输出、工具循环、模型用量与计费配置；不能把旧报告中的空 content 当正常完成，也不因缺余额截图重问已获额度授权。遇额度/额外计费提示即停止有关调用，保留本地可继续部分。
4. 每次请求设置有限输出预算和超时，记录实际次数、usage、耗时；按任务包的有限场景执行，禁止无限重试或开放式自动探索。截断可以据响应结构调整一次预算。耗时/体积是观察值，不设没有课堂依据的速度或像素一致性硬门槛。
5. 写入仅限 `experiments/C21/` 至 `experiments/C24/` 各自隔离目录、各自 `docs/arch/evidence/Cxx.md` 和 `docs/acceptance/evidence/Cxx/v1/`。各自依赖清单、锁文件、数据、端口也放隔离目录，不改根依赖、产品代码或 B11。执行方法由实验者选择；免费依赖的隔离安装属于准备工作，安装失败才报告具体网络/权限缺口。
6. 报告按[证据与回执协议](../plans/execution-protocol.md#receipt)记录候选提交、组件版本、样本路径/校验值、实际运行命令、逐场景预期与结果、失败原件、继续校对/重试入口及建议。正式结果用 self 的 PASS/FAIL/BLOCKED，并分列本机和目标设备结果；独立复核归[实验验收矩阵](../acceptance/mvp-matrix.md#experiments)的消费节点。本次设计只交 READY_FOR_REVIEW。

## 公共材料

- [样本索引](capability-checks/samples.md)：固定内容、外部原件定位和待物化文件，尚未生成的文件明确标注。
- [环境说明](capability-checks/environment.md)：本机实查、授权边界、单进程 Node/SQLite/持久目录交付候选及缺口归属。
- [一手来源](capability-checks/sources.md)：技术文档支持什么、尚未证明什么；不代替实验。
- [作者回执](../acceptance/evidence/C20/v1/author.md)：本次设计与检查结果。
