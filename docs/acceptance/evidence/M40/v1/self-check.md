# M40/v1 作者自检

级别：self。只核查设计候选，不替代外层design-review、产品实现或M44。基线为 `0b7f8968d088b50e569af0e58dce36e36bb93b74`，候选版本由author回执固定。

| design-review 条目 | 本次结果与可复核入口 |
| --- | --- |
| 范围、用户价值、关键UX、成功/失败/恢复 | math故事8项、UX U-MA0至7、20个WB-MA场景；已与materials的WB-M前缀分开 |
| 每类制作/保存/二次编辑/导出 | formula/plane/space/dynamic/html五分支有精确Source及交换；外部HTML只承诺源码，原件/修改稿/包装下载分别定义 |
| 唯一schema与双侧实现 | 19个HTTP操作、72个命名类型、35个正负样本；schema与样本由Python jsonschema实际校验，跨文件$ref递归解析，输出见checks.txt |
| 认证与已有材料 | 当前PageContext逐操作外引；所有写操作有幂等；File/Document/旧Reference/Usage原定义外引；math来源冲突另建类型，不伪扩旧封闭联合 |
| 版本、文件、事务 | WorkRevision与File不可变；先文件再业务事务并复核基线；固定海报/演示文件进入引用快照；旧客户端拒绝有损投影，同键原路径重放 |
| 跨模块与公共写者 | math架构逐阶段/逐共享文件清单；M41→M42串行接同一骨架，M43等R35且由外层接公共写权；T51/T53消费者条件独立列明 |
| C23实际制品与能力边界 | 本轮浏览器复核和3份PNG目视；模型产物/实际下载物哈希匹配；记录第二步数学不一致、范围/步骤编辑未证、中文说明未入导出等限制，不覆盖旧报告 |
| 可派发任务包与验证 | M41/M42/M43各有必要输入、相关章节、路径、BDD、API/E2E/build要求和self回执位置；缺目标设备不代签，M44独立验收 |
| 教学时间扩展 | git show只读acbf48f候选，提供精确provider/Source分支与v2消费者增量；旧T50未修改，联合schema仍待其拥有者冻结 |
| 写权与临时材料 | 只增math文档/schema/BDD/证据和必要导航，无产品/根台账/DAG/旧证据修改；临时校验环境在完成后删除 |

实际校验方法：临时Python环境加载PyYAML 6.0.3、jsonschema（实际版本以checks.txt补记），逐一验证schema、正负样本、引用可达、必需头、no-store、目录唯一性/依赖无环、Markdown本地链接/锚点及场景ID唯一。一次性校验脚本与环境不作为产品工具入库；schema和samples足以重新运行标准validator。未运行产品test/build，因为本批无实现，不能空报通过。

本次没有派内部reviewer、业务session或追加模型调用。外层独立reviewer可直接按 `docs/acceptance/mvp-matrix.md#design-review` 核查固定候选，并决定冻结或将问题退M40。
