Feature: 教学时间消费冻结数学接缝
  # T50-MATH-CONTRACT@1，设计候选，不是产品测试通过。
  # 扩展 WB-T020/WB-MA018；原 teaching-time.feature 保留。
  Background:
    Given T50 与 M40 固定契约及本新版已由独立 reviewer 冻结
    And 教师 A 使用可信身份，班级 C1 和 C2 各有独立实际记录

  @WB-TM001 @WB-T020 @T51
  Scenario: 一句话之后补关联真实作品
    Given 教师已保存一句话，作品目录有活动的公式、平面、立体、动态和 HTML 作品
    When 教师打开补充关联，选已有作品并显式保存
    Then 记录使用 kind math 和稳定作品 ID，首次标题由服务器保存
    And render invalid 的活动作品也能关联，不要求导出或作品版本快照
    And 刷新和保库重启后同一记录仍能打开作品

  @WB-TM002 @T51 @M43
  Scenario: 回看作品并返回未保存现场
    Given 班级记录有未保存文字，已展开来源并滚动到该记录
    When 打开关联作品再返回记录
    Then 当前班级、记录、日期、原草稿、展开和滚动恢复
    And 打开和返回不保存草稿或创建第二条记录
    And 桌面和平板均无页面级横向溢出，原 AI 对话保持

  @WB-TM003 @T51 @M43
  Scenario: 改名只改变当前标签
    Given 记录已保存的作品标题为函数图象
    When 作品改名为二次函数图象后读取记录
    Then currentLabel 为二次函数图象而 labelAtLink 仍为函数图象
    And 记录 ID、version、updatedAt 和所有原文不变

  @WB-TM004 @T51 @T54
  Scenario: 删源保留反馈而重新添加仍受限制
    Given 活动记录已经关联作品
    When 作品软删除后保留原链接编辑记录文字
    Then 保存成功且来源显示已删除并可只读回看
    When 新记录添加已删除作品，或成功移除链接后再次添加
    Then 整条写入被 reference-deleted 拒绝，草稿保留
    When 恢复作品
    Then 保留的链接恢复活动显示而记录自身版本不变

  @WB-TM005 @WB-MA018 @T51 @M43 @T54
  Scenario: 两班反向反馈遵守各自删除状态
    Given 两班记录都关联同一作品，日期相同而二班较晚更新
    When 从作品页查看反馈
    Then 完整返回二班再一班记录，各自原文与全部来源保持
    When 删除作品
    Then 原反馈仍可查看
    When 删除二班或其记录
    Then 活动反馈只剩一班，各自恢复后才按规则重新出现

  @WB-TM006 @T51
  Scenario: 旧客户端不能丢掉数学来源
    Given v2 为旧记录补入 math 来源
    When 旧路径读取详情、匹配班级列表或备课题目反向查询
    Then 整次返回 unsupported-content-version 而非删来源或漏记录
    When 旧路径使用当前版本更新或删除恢复该记录
    Then 同样拒绝且数据不变，过时版本仍优先返回 version-conflict
    And v2 可完整读写旧新记录，不要求迁移 ID 或纯读升版

  @WB-TM007 @T51
  Scenario: 未确认的旧请求在原路径确认
    Given 旧请求已提交但丢响应，另一写入已通过 v2 加入 math
    When 保库重启后用原键原体向原路径重试
    Then 返回原成功回执且不重复写入，再读 v2 得到当前记录
    And 使用相同键换成 v2 路径返回 idempotency-key-reused
    And 新草稿不被旧成功回执覆盖

  @WB-TM008 @T51
  Scenario: 提供方故障与越权不能成为假删除或空反馈
    Given 保存、读取或反查需要 math 公共端口
    When 端口返回 503 或外账户及不存在返回 404
    Then 请求如实失败，未提交的记录和成功回执均不落库
    And 只有成功 tombstone 才显示已删除，失败不显示暂无反馈
    And 恢复后原键可重试，切换账户看不到旧草稿和迟到响应

  @WB-TM009 @T51 @T53 @M43
  Scenario: 组合目录无环且日程只消费原摘要
    Given 数学和教学时间真实组合使用 ModuleCatalogV3
    Then classes 声明 math 教学读取且 math 没有 classes 必需服务端依赖
    And 已注册的资源与数学模块保留，缺提供方或环阻止装配
    When 作品改名、删除或读取故障
    Then 日程仍以原 RecordReference 定位记录，不请求作品源码
    And 时间、重复例外、提醒唯一性与计划实际分离保持原 T50 行为

  @WB-TM010 @WB-T020 @T54
  Scenario: 完整放行只依据真实组合
    Given T51 交付固定候选且真实作品提供方通过 M44
    When 独立验收在新的固定组合中执行真实选择、保存、重启、双向往返与删除恢复
    Then 才能判定 WB-T020 的作品关联部分通过
    And 设计样本、同版替身或进行中的旧 T54 候选均不能代替该证据
